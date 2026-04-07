import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle, XCircle, ArrowLeft, Shield,
  Loader2, Copy, ExternalLink, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import type { OutletContext } from '@/lib/auth';
import { toast } from 'sonner';

type TxStatus = 'pending' | 'approved' | 'completed' | 'rejected';

const STAGES: Record<TxStatus, {
  Icon: React.FC<any>;
  iconColor: string;
  glowColor: string;
  ringColor: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeCls: string;
  progress: number;
}> = {
  pending: {
    Icon: Clock,
    iconColor: '#f59e0b',
    glowColor: 'rgba(245,158,11,0.22)',
    ringColor: '#f59e0b',
    title: 'Under Review',
    subtitle: 'Your withdrawal request has been submitted and is awaiting admin review. You will see this page update in real time.',
    badge: 'PROCESSING',
    badgeCls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25',
    progress: 33,
  },
  approved: {
    Icon: CheckCircle,
    iconColor: '#10b981',
    glowColor: 'rgba(16,185,129,0.28)',
    ringColor: '#10b981',
    title: 'Approved & Sending',
    subtitle: 'Your withdrawal has been approved. Funds are being processed and will arrive at your wallet shortly.',
    badge: 'APPROVED',
    badgeCls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
    progress: 66,
  },
  completed: {
    Icon: CheckCircle,
    iconColor: '#10b981',
    glowColor: 'rgba(16,185,129,0.35)',
    ringColor: '#10b981',
    title: 'Successfully Sent!',
    subtitle: 'Your withdrawal has been completed. The funds have been sent to your wallet address.',
    badge: 'COMPLETED',
    badgeCls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
    progress: 100,
  },
  rejected: {
    Icon: XCircle,
    iconColor: '#ef4444',
    glowColor: 'rgba(239,68,68,0.22)',
    ringColor: '#ef4444',
    title: 'Request Declined',
    subtitle: 'Your withdrawal request was not approved. Your balance has been fully restored. Please contact support if you need help.',
    badge: 'DECLINED',
    badgeCls: 'bg-red-500/10 text-red-400 border border-red-500/25',
    progress: 0,
  },
};

function PulsingOrb({ color, size = 80 }: { color: string; size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outermost ring — slowest */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: size, height: size, border: `1px solid ${color}`, opacity: 0.15 }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.15, 0, 0.15] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Middle ring */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: size * 0.75, height: size * 0.75, border: `1px solid ${color}`, opacity: 0.25 }}
        animate={{ scale: [1, 1.35, 1], opacity: [0.25, 0, 0.25] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      />
      {/* Inner filled */}
      <div
        className="relative z-10 rounded-full flex items-center justify-center"
        style={{
          width: size * 0.55,
          height: size * 0.55,
          background: `radial-gradient(circle at 35% 35%, ${color}33, ${color}11)`,
          border: `1.5px solid ${color}44`,
          boxShadow: `0 0 24px ${color}44, 0 0 48px ${color}22`,
        }}
      />
    </div>
  );
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
        initial={{ width: '0%' }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

export default function WithdrawalProcessing() {
  const { txId } = useParams<{ txId: string }>();
  const navigate = useNavigate();
  const { user } = useOutletContext<OutletContext>();
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const completedRedirect = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial transaction
  useEffect(() => {
    if (!txId || !user?.email) return;
    supabase
      .from('transactions')
      .select('*')
      .eq('id', txId)
      .eq('user_email', user.email) // security: only own transactions
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) { setError('Failed to load transaction.'); setLoading(false); return; }
        if (!data) { setError('Transaction not found or access denied.'); setLoading(false); return; }
        setTx(data);
        setLoading(false);
      });
  }, [txId, user?.email]);

  // Realtime subscription for live status updates
  useEffect(() => {
    if (!txId || !user?.email) return;
    const channel = supabase
      .channel(`withdrawal-processing-${txId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `id=eq.${txId}` },
        (payload) => {
          if ((payload.new as any).user_email !== user.email) return; // safety
          setTx(payload.new);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [txId, user?.email]);

  // Auto-redirect after completion/rejection
  useEffect(() => {
    if (!tx) return;
    if (tx.status === 'completed' || tx.status === 'rejected') {
      if (completedRedirect.current) clearTimeout(completedRedirect.current);
      completedRedirect.current = setTimeout(() => {
        navigate('/transactions');
      }, tx.status === 'completed' ? 8000 : 6000);
    }
    return () => {
      if (completedRedirect.current) clearTimeout(completedRedirect.current);
    };
  }, [tx?.status, navigate]);

  const handleCopyId = () => {
    if (!txId) return;
    navigator.clipboard.writeText(txId).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading withdrawal status...</p>
        </div>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-base mb-1">{error || 'Transaction not found'}</p>
          <p className="text-sm text-muted-foreground">This transaction may belong to a different account.</p>
        </div>
        <Button onClick={() => navigate('/transactions')} variant="outline" className="border-border">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Transactions
        </Button>
      </div>
    );
  }

  const status: TxStatus = tx.status in STAGES ? tx.status : 'pending';
  const stage = STAGES[status];
  const Icon = stage.Icon;
  const isTerminal = status === 'completed' || status === 'rejected';
  const isSuccess = status === 'completed' || status === 'approved';

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
      <div className="w-full max-w-lg space-y-6">
        {/* Back link */}
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/transactions')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Transactions
        </motion.button>

        {/* Main card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-3xl border border-border bg-card"
            style={{ boxShadow: `0 0 80px ${stage.glowColor}, 0 1px 0 rgba(255,255,255,0.04) inset` }}
          >
            {/* Ambient glow background */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${stage.glowColor}, transparent 70%)`,
              }}
            />

            <div className="relative z-10 p-8 flex flex-col items-center text-center gap-6">
              {/* Badge */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={`text-[10px] font-bold tracking-[0.15em] px-3 py-1 rounded-full ${stage.badgeCls}`}
              >
                {stage.badge}
              </motion.div>

              {/* Animated icon */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="relative"
              >
                {!isTerminal && (
                  <PulsingOrb color={stage.iconColor} size={100} />
                )}
                <div
                  className={`${isTerminal ? '' : 'absolute inset-0'} flex items-center justify-center`}
                >
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${stage.iconColor}22, ${stage.iconColor}08)`,
                      border: `1.5px solid ${stage.iconColor}30`,
                      boxShadow: `0 0 32px ${stage.glowColor}`,
                    }}
                  >
                    {status === 'pending' ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      >
                        <Clock className="w-9 h-9" style={{ color: stage.iconColor }} />
                      </motion.div>
                    ) : (
                      <Icon className="w-9 h-9" style={{ color: stage.iconColor }} />
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Title & subtitle */}
              <div className="space-y-2">
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-black tracking-tight"
                >
                  {stage.title}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-sm text-muted-foreground leading-relaxed max-w-sm"
                >
                  {stage.subtitle}
                </motion.p>
              </div>

              {/* Progress bar (not shown for rejected) */}
              {status !== 'rejected' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="w-full space-y-1.5"
                >
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                    <span>Submitted</span>
                    <span>In Review</span>
                    <span>Completed</span>
                  </div>
                  <ProgressBar progress={stage.progress} color={stage.iconColor} />
                </motion.div>
              )}

              {/* Amount & wallet */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="w-full space-y-3"
              >
                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-xs text-muted-foreground">Withdrawal Amount</span>
                  <span className="font-mono font-bold text-base" style={{ color: stage.iconColor }}>
                    ${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {tx.wallet_address && (
                  <div
                    className="flex items-start justify-between gap-2 px-4 py-3.5 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">Destination Wallet</p>
                      <p className="font-mono text-xs text-foreground/80 break-all">{tx.wallet_address}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                )}

                {tx.notes && (
                  <div
                    className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">{tx.notes}</p>
                  </div>
                )}
              </motion.div>

              {/* Auto-redirect message */}
              {isTerminal && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs text-muted-foreground/60"
                >
                  Redirecting to transactions in a few seconds...
                </motion.p>
              )}

              {/* Live indicator for non-terminal */}
              {!isTerminal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground/70"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Live — this page updates automatically
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Transaction ID row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-card border border-border"
        >
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground mb-0.5 font-medium uppercase tracking-wide">Transaction ID</p>
            <p className="font-mono text-xs text-foreground/60 truncate">{txId}</p>
          </div>
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary flex-shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            {copySuccess ? 'Copied!' : 'Copy'}
          </button>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="flex gap-3"
        >
          <Button
            onClick={() => navigate('/transactions')}
            variant="outline"
            className="flex-1 border-border hover:bg-secondary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Transactions
          </Button>
          {!isTerminal && (
            <Button
              onClick={async () => {
                if (!txId || !user?.email) return;
                const { data } = await supabase
                  .from('transactions')
                  .select('*')
                  .eq('id', txId)
                  .eq('user_email', user.email)
                  .maybeSingle();
                if (data) { setTx(data); toast.success('Status refreshed'); }
              }}
              variant="outline"
              className="border-border hover:bg-secondary"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
