import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { OutletContext } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Clock,
  CheckCircle, XCircle, X, Copy, KeyRound, Info,
  ShieldCheck, Loader2, Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';

const TYPE_META: Record<string, any> = {
  deposit:     { label: 'Deposit',     icon: ArrowDownLeft,  color: 'text-up bg-up' },
  withdrawal:  { label: 'Withdrawal',  icon: ArrowUpRight,   color: 'text-down bg-down' },
  buy:         { label: 'Buy',         icon: ArrowLeftRight, color: 'text-blue-400 bg-blue-400/10' },
  sell:        { label: 'Sell',        icon: ArrowLeftRight, color: 'text-purple-400 bg-purple-400/10' },
  copy_profit: { label: 'Copy Profit', icon: ArrowDownLeft,  color: 'text-up bg-up' },
};

const STATUS_META: Record<string, any> = {
  pending:   { label: 'Pending',   icon: Clock,        cls: 'text-yellow-400 bg-yellow-400/10' },
  approved:  { label: 'Approved',  icon: CheckCircle,  cls: 'text-up bg-up' },
  completed: { label: 'Completed', icon: CheckCircle,  cls: 'text-up bg-up' },
  rejected:  { label: 'Rejected',  icon: XCircle,      cls: 'text-down bg-down' },
};

const DEPOSIT_NETWORKS = [
  { key: 'btc',        label: 'Bitcoin (BTC)',  settingKey: 'deposit_address_btc' },
  { key: 'eth',        label: 'Ethereum (ETH)', settingKey: 'deposit_address_eth' },
  { key: 'usdt_trc20', label: 'USDT (TRC20)',   settingKey: 'deposit_address_usdt_trc20' },
  { key: 'usdt_erc20', label: 'USDT (ERC20)',   settingKey: 'deposit_address_usdt_erc20' },
  { key: 'bnb',        label: 'BNB',            settingKey: 'deposit_address_bnb' },
];

export default function Transactions() {
  const { user } = useOutletContext<OutletContext>();
  const navigate = useNavigate();

  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState<null | 'deposit' | 'withdrawal'>(null);
  const [submitting, setSubmitting] = useState(false);
  const [depositAddresses, setDepositAddresses] = useState<Record<string, string>>({});
  const [selectedNetwork, setSelectedNetwork] = useState('btc');
  const [savedWallet, setSavedWallet] = useState('');
  const [depositStep, setDepositStep] = useState<'address' | 'submit'>('address');
  const [depositAmount, setDepositAmount] = useState('');

  // Withdrawal form state
  const [wdAmount, setWdAmount] = useState('');
  const [wdWallet, setWdWallet] = useState('');

  // OTP flow state for withdrawal verification
  const [wdOtpSending, setWdOtpSending] = useState(false);
  const [wdOtpStep, setWdOtpStep] = useState<'form' | 'otp'>('form');
  const [wdOtpCode, setWdOtpCode] = useState('');
  const [wdOtpVerifying, setWdOtpVerifying] = useState(false);
  // Saved form while user is on OTP screen
  const [wdPending, setWdPending] = useState<{ amount: string; wallet: string } | null>(null);

  useEffect(() => {
    api.platformSettings.list().then(rows => {
      const map: Record<string, string> = {};
      rows.forEach((r: any) => { map[r.key] = r.value; });
      setDepositAddresses(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.id) {
      api.users.getById(user.id).then(data => {
        if (data?.wallet_address) { setSavedWallet(data.wallet_address); setWdWallet(data.wallet_address); }
      }).catch(() => {});
    }
  }, [user?.id]);

  const load = useCallback(() => {
    if (!user?.email) return;
    api.transactions.getByEmail(user.email, 50)
      .then(t => { setTxns(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? txns : txns.filter(t => t.type === filter);

  // ── Step 1: Send OTP to user's email ──────────────────────────
  const handleWithdrawalSubmit = async () => {
    if (!user) return;
    const amt = parseFloat(wdAmount);
    if (!wdAmount || isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!wdWallet.trim()) { toast.error('Enter your wallet address'); return; }

    const minWd = parseFloat(depositAddresses['min_withdrawal_usd'] || '0') || 0;
    if (minWd > 0 && amt < minWd) {
      toast.error(`Minimum withdrawal is $${minWd.toFixed(2)}`);
      return;
    }

    // Check balance
    setSubmitting(true);
    try {
      const bal = await api.balances.getByEmail(user.email);
      if (!bal || (bal.balance_usd ?? 0) < amt) {
        toast.error(`Insufficient balance — you have $${(bal?.balance_usd ?? 0).toFixed(2)}`);
        setSubmitting(false);
        return;
      }
    } catch {
      toast.error('Could not verify balance. Please try again.');
      setSubmitting(false);
      return;
    }

    setWdOtpSending(true);
    try {
      // Supabase auth email OTP — re-authenticates the user's identity before withdrawal
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;

      setWdPending({ amount: wdAmount, wallet: wdWallet.trim() });
      setWdOtpStep('otp');
      toast.success('A 6-digit verification code has been sent to your email address.', {
        description: 'Check your inbox and enter the code to confirm your withdrawal.',
        duration: 6000,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.toLowerCase().includes('smtp') || msg.toLowerCase().includes('email')) {
        toast.error('Email delivery failed. Please contact support or try again.', {
          description: 'Your Supabase SMTP settings may need configuration.',
        });
      } else if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
        toast.error('Too many verification attempts. Please wait 60 seconds and try again.');
      } else {
        toast.error(msg || 'Failed to send verification code. Please try again.');
      }
    }
    setWdOtpSending(false);
    setSubmitting(false);
  };

  // ── Step 2: Verify OTP and create withdrawal transaction ───────
  const handleWithdrawalOtpVerify = async () => {
    if (!user || !wdPending) return;
    if (!wdOtpCode || wdOtpCode.length !== 6) {
      toast.error('Enter the 6-digit code from your email');
      return;
    }
    setWdOtpVerifying(true);
    try {
      // Verify the Supabase email OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: user.email,
        token: wdOtpCode,
        type: 'email',
      });
      if (verifyError) {
        if (verifyError.message?.toLowerCase().includes('expired')) {
          toast.error('Code has expired. Please request a new one.');
        } else {
          toast.error('Invalid code. Please check your email and try again.');
        }
        setWdOtpVerifying(false);
        return;
      }

      // Identity verified — create the withdrawal transaction and get its ID
      const txId = await api.transactions.createAndReturn({
        user_email: user.email,
        type: 'withdrawal',
        amount: parseFloat(wdPending.amount),
        wallet_address: wdPending.wallet,
        status: 'pending',
        notes: 'User identity verified via Supabase email OTP',
      });

      // Clean up all state
      setModal(null);
      setWdAmount('');
      setWdWallet(savedWallet);
      setWdOtpCode('');
      setWdPending(null);
      setWdOtpStep('form');

      // Navigate to the live processing page
      navigate(`/transactions/processing/${txId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Verification failed. Please try again.');
    }
    setWdOtpVerifying(false);
  };

  const currentAddress = depositAddresses[DEPOSIT_NETWORKS.find(n => n.key === selectedNetwork)?.settingKey || ''];

  const handleDepositSubmit = async () => {
    if (!user || !depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Enter the amount you sent');
      return;
    }
    setSubmitting(true);
    try {
      await api.transactions.create({
        user_email: user.email,
        type: 'deposit',
        amount: parseFloat(depositAmount),
        status: 'pending',
        notes: `Network: ${DEPOSIT_NETWORKS.find(n => n.key === selectedNetwork)?.label ?? selectedNetwork}`,
      });
      toast.success('Deposit submitted for review! We\'ll credit your account once confirmed.');
      setModal(null);
      setDepositAmount('');
      setDepositStep('address');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit deposit');
    }
    setSubmitting(false);
  };

  const closeWithdrawalModal = () => {
    setModal(null);
    setWdOtpStep('form');
    setWdOtpCode('');
    setWdPending(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader user={user} title="Transactions" subtitle="Deposits, withdrawals & history" />

      {/* Filters + action buttons */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['all', 'deposit', 'withdrawal', 'buy', 'sell', 'copy_profit'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filter === f ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {f === 'copy_profit' ? 'Copy Profit' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setModal('deposit'); setDepositStep('address'); }}
            className="gradient-green text-white font-semibold text-xs h-9 px-4 glow-green-xs">
            Deposit
          </Button>
          <Button onClick={() => { setModal('withdrawal'); setWdOtpStep('form'); }}
            variant="outline" className="border-border text-xs h-9 px-4">
            Withdraw
          </Button>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="space-y-px">{[1,2,3,4].map(i => <div key={i} className="h-16 shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Make a deposit to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(tx => {
              const meta = TYPE_META[tx.type] || TYPE_META.deposit;
              const statusMeta = STATUS_META[tx.status] || STATUS_META.pending;
              const TIcon = meta.icon;
              const SIcon = statusMeta.icon;
              return (
                <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <TIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {tx.crypto_symbol ? `${tx.crypto_amount} ${tx.crypto_symbol} · ` : ''}
                      {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-mono font-bold ${tx.type === 'withdrawal' || tx.type === 'buy' ? 'text-down' : 'text-up'}`}>
                      {tx.type === 'withdrawal' || tx.type === 'buy' ? '-' : '+'}${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                      <SIcon className="w-2.5 h-2.5" />
                      {statusMeta.label}
                    </div>
                  </div>
                  {/* If withdrawal is still pending, link to processing page */}
                  {tx.type === 'withdrawal' && (tx.status === 'pending' || tx.status === 'approved') && (
                    <button
                      onClick={() => navigate(`/transactions/processing/${tx.id}`)}
                      className="ml-2 text-xs text-primary underline underline-offset-2 hover:text-primary/80 flex-shrink-0">
                      Track
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DEPOSIT MODAL ──────────────────────────────────────── */}
      <AnimatePresence>
        {modal === 'deposit' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-lg">Deposit Funds</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${depositStep === 'address' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>1 Send</span>
                    <div className="w-6 h-px bg-border" />
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${depositStep === 'submit' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>2 Submit</span>
                  </div>
                </div>
                <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {depositStep === 'address' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Select Network</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {DEPOSIT_NETWORKS.map(n => (
                        <button key={n.key} onClick={() => setSelectedNetwork(n.key)}
                          className={`px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors ${selectedNetwork === n.key ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                          {n.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {currentAddress ? (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground block">Deposit Address</label>
                      <div className="flex items-start gap-2 px-3 py-3 bg-secondary rounded-xl">
                        <p className="font-mono text-xs break-all flex-1">{currentAddress}</p>
                        <button onClick={() => { navigator.clipboard.writeText(currentAddress); toast.success('Address copied'); }}
                          className="text-muted-foreground hover:text-primary flex-shrink-0">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground/70 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Send only {DEPOSIT_NETWORKS.find(n => n.key === selectedNetwork)?.label} to this address. Wrong network = lost funds.
                      </p>
                    </div>
                  ) : (
                    <div className="px-3 py-3 rounded-xl bg-secondary text-xs text-muted-foreground">
                      Deposit address not configured yet. Please contact support.
                    </div>
                  )}
                  <Button onClick={() => setDepositStep('submit')} className="w-full gradient-green text-white font-bold">
                    I've Sent — Continue
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="px-3 py-3 rounded-xl bg-primary/8 border border-primary/15 text-xs text-primary/80 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Enter the exact amount you sent. Your account will be credited after admin confirmation.
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Amount Sent (USD)</label>
                    <Input type="number" placeholder="0.00" value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      className="bg-secondary border-border font-mono text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDepositStep('address')} className="border-border">Back</Button>
                    <Button onClick={handleDepositSubmit} disabled={submitting} className="flex-1 gradient-green text-white font-bold">
                      {submitting ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Submitting...</span>
                      ) : 'Submit Deposit'}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── WITHDRAWAL MODAL ─────────────────────────────────────── */}
      <AnimatePresence>
        {modal === 'withdrawal' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) closeWithdrawalModal(); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">

              <AnimatePresence mode="wait">
                {/* ── FORM STEP ── */}
                {wdOtpStep === 'form' && (
                  <motion.div key="form" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
                          Withdraw Funds
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Identity verification required</p>
                      </div>
                      <button onClick={closeWithdrawalModal} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Amount (USD)</label>
                        <Input type="number" placeholder="0.00" value={wdAmount}
                          onChange={e => setWdAmount(e.target.value)}
                          className="bg-secondary border-border font-mono text-sm" />
                        {depositAddresses['min_withdrawal_usd'] && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Minimum: ${parseFloat(depositAddresses['min_withdrawal_usd'] || '0').toFixed(2)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Destination Wallet Address</label>
                        <Input placeholder="0x... or bc1q..." value={wdWallet}
                          onChange={e => setWdWallet(e.target.value)}
                          className="bg-secondary border-border font-mono text-sm" />
                      </div>
                      <div className="px-3 py-3 rounded-xl bg-yellow-500/8 border border-yellow-500/15 text-xs text-yellow-300/80 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-400" />
                        A 6-digit verification code will be sent to your email address to confirm your identity before this withdrawal is submitted.
                      </div>
                      <Button
                        onClick={handleWithdrawalSubmit}
                        disabled={submitting || wdOtpSending}
                        className="w-full h-11 font-bold bg-foreground text-background hover:bg-foreground/90">
                        {wdOtpSending ? (
                          <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Sending Code...</span>
                        ) : (
                          <span className="flex items-center gap-2"><Mail className="w-4 h-4" />Send Verification Code</span>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ── OTP STEP ── */}
                {wdOtpStep === 'otp' && (
                  <motion.div key="otp" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-primary" />
                          Verify Identity
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Code sent to {user?.email}</p>
                      </div>
                      <button onClick={closeWithdrawalModal} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-5">
                      <div className="text-center px-4 py-5 rounded-2xl"
                        style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
                          <Mail className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-sm font-semibold mb-1">Check your email</p>
                        <p className="text-xs text-muted-foreground">
                          We sent a 6-digit code to <span className="text-foreground font-medium">{user?.email}</span>.
                          Enter it below to confirm your withdrawal of <span className="text-foreground font-mono font-bold">${wdPending?.amount}</span>.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Verification Code</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          placeholder="000000"
                          value={wdOtpCode}
                          onChange={e => setWdOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="bg-secondary border-border font-mono text-2xl text-center tracking-[0.5em] h-14"
                          autoFocus
                        />
                      </div>

                      <Button
                        onClick={handleWithdrawalOtpVerify}
                        disabled={wdOtpVerifying || wdOtpCode.length !== 6}
                        className="w-full h-11 font-bold gradient-green text-white glow-green-xs">
                        {wdOtpVerifying ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />Verifying...
                          </span>
                        ) : 'Confirm Withdrawal'}
                      </Button>

                      <button
                        onClick={() => { setWdOtpStep('form'); setWdOtpCode(''); setWdPending(null); }}
                        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                        ← Go back and edit details
                      </button>

                      <button
                        onClick={handleWithdrawalSubmit}
                        disabled={wdOtpSending}
                        className="w-full text-xs text-muted-foreground hover:text-primary transition-colors py-1">
                        {wdOtpSending ? 'Sending...' : "Didn't receive the code? Resend"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
