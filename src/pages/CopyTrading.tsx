import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { OutletContext } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Users, Shield, Zap, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';

const RISK_COLORS: Record<string, string> = {
  low: 'text-up bg-up',
  medium: 'text-yellow-400 bg-yellow-400/10',
  high: 'text-down bg-down',
};
const RISK_ICONS: Record<string, any> = { low: Shield, medium: Zap, high: TrendingUp };

function TraderCard({ trader, activeCopy, onCopy, onStop, stopping }: any) {
  const isFollowing = activeCopy?.trader_id === trader.id;
  const RiskIcon = RISK_ICONS[trader.risk_level] || Shield;
  const isStopping = stopping === activeCopy?.id;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-5 hover:border-primary/25 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base"
            style={{ background: trader.avatar_color || '#6366f1' }}>
            {trader.trader_name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-sm">{trader.trader_name}</p>
            <p className="text-xs text-muted-foreground">{trader.specialty || 'Multi-Strategy'}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${RISK_COLORS[trader.risk_level] || RISK_COLORS.medium}`}>
          <RiskIcon className="w-3 h-3" />{trader.risk_level}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Total Profit', value: `+${trader.total_profit_pct?.toFixed(1)}%`, up: true },
          { label: 'Win Rate', value: `${trader.win_rate?.toFixed(1)}%` },
          { label: 'Trades', value: trader.total_trades },
        ].map(s => (
          <div key={s.label} className="bg-secondary rounded-xl px-3 py-2 text-center">
            <p className={`text-sm font-bold font-mono ${s.up ? 'text-up' : ''}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
        <span>{trader.followers} followers</span>
        <span className="text-foreground font-semibold">{trader.profit_split_pct}% profit split</span>
        <span>Min ${trader.min_allocation}</span>
      </div>

      {isFollowing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/10 border border-primary/25">
            <span className="text-xs font-semibold text-primary">✓ Following • ${activeCopy.allocation}</span>
            <span className={`text-xs font-mono font-bold ${activeCopy.profit_loss >= 0 ? 'text-up' : 'text-down'}`}>
              {activeCopy.profit_loss >= 0 ? '+' : ''}${activeCopy.profit_loss?.toFixed(2)}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 text-xs disabled:opacity-50"
            disabled={isStopping}
            onClick={() => onStop(activeCopy)}>
            {isStopping ? (
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 border border-destructive/60 border-t-transparent rounded-full animate-spin" />
                Stopping...
              </span>
            ) : (
              <span className="flex items-center gap-1.5"><X className="w-3 h-3" /> Stop Copying</span>
            )}
          </Button>
        </div>
      ) : (
        <Button onClick={() => onCopy(trader)} className="w-full h-9 text-sm font-semibold gradient-green text-white glow-green-sm">
          Copy Trader
        </Button>
      )}
    </motion.div>
  );
}

export default function CopyTrading() {
  const { user } = useOutletContext<OutletContext>();
  const [traders, setTraders] = useState<any[]>([]);
  const [myCopies, setMyCopies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyModal, setCopyModal] = useState<any>(null);
  const [alloc, setAlloc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api.traders.list(),
      user?.email ? api.copyTrades.getByEmail(user.email) : Promise.resolve([]),
    ]).then(([t, c]) => { setTraders(t); setMyCopies(c); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  const handleCopy = async () => {
    if (!user) return;
    const allocAmt = parseFloat(alloc);
    if (!alloc || isNaN(allocAmt) || allocAmt < copyModal.min_allocation) {
      toast.error(`Minimum allocation is ${copyModal.min_allocation}`);
      return;
    }
    setSubmitting(true);
    try {
      const bal = await api.balances.getByEmail(user.email);
      if (!bal || bal.balance_usd < allocAmt) {
        toast.error(`Insufficient balance — you have ${(bal?.balance_usd || 0).toFixed(2)}, need ${allocAmt.toFixed(2)}`);
        setSubmitting(false);
        return;
      }
      // Deduct balance FIRST — if copy trade creation fails, roll back
      const newBal = Math.max(0, bal.balance_usd - allocAmt);
      await api.balances.update(user.email, { balance_usd: newBal });
      try {
        await api.copyTrades.create({
          user_email: user.email,
          trader_id: copyModal.id,
          trader_name: copyModal.trader_name,
          allocation: allocAmt,
        });
      } catch (createErr: unknown) {
        // Rollback: restore original balance before re-throwing
        await api.balances.update(user.email, { balance_usd: bal.balance_usd });
        throw createErr;
      }
      toast.success(`Now copying ${copyModal.trader_name}! ${allocAmt.toLocaleString()} allocated.`);
      setCopyModal(null); setAlloc('');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to start copying');
    }
    setSubmitting(false);
  };

  const handleStop = async (copy: any) => {
    if (stoppingId === copy.id) return;
    setStoppingId(copy.id);
    try {
      const refund = Math.max(0, (copy.allocation ?? 0) + (copy.profit_loss ?? 0));
      let previousBal = 0;
      if (refund > 0) {
        // Credit the refund FIRST — if stopping the trade fails, roll it back
        const bal = await api.balances.getByEmail(user!.email);
        previousBal = bal?.balance_usd ?? 0;
        await api.balances.update(user!.email, { balance_usd: previousBal + refund });
      }
      try {
        await api.copyTrades.stop(copy.id);
      } catch (stopErr: unknown) {
        // Rollback: restore balance to pre-refund state
        if (refund > 0) {
          await api.balances.update(user!.email, { balance_usd: previousBal });
        }
        throw stopErr;
      }
      if (refund > 0) {
        toast.success(`Stopped copying ${copy.trader_name}. ${refund.toFixed(2)} returned to your balance.`);
      } else {
        toast.success('Stopped copying trader');
      }
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to stop');
    }
    setStoppingId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader user={user} title="Copy Trading" subtitle="Mirror top traders automatically" />

      {myCopies.length > 0 && (
        <div className="bg-primary/8 border border-primary/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold">Active Copies</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {myCopies.map(c => (
              <div key={c.id} className="flex items-center gap-2 bg-primary/10 border border-primary/25 px-3 py-2 rounded-xl text-xs">
                <span className="font-semibold">{c.trader_name}</span>
                <span className="text-muted-foreground">• ${c.allocation}</span>
                <span className={c.profit_loss >= 0 ? 'text-up font-mono' : 'text-down font-mono'}>
                  {c.profit_loss >= 0 ? '+' : ''}${c.profit_loss?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 shimmer rounded-2xl" />)}
        </div>
      ) : traders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No approved traders available yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {traders.map(t => (
            <TraderCard key={t.id} trader={t}
              activeCopy={myCopies.find(c => c.trader_id === t.id)}
              onCopy={setCopyModal}
              onStop={handleStop}
              stopping={stoppingId}
            />
          ))}
        </div>
      )}

      {copyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Copy {copyModal.trader_name}</h3>
              <button onClick={() => { setCopyModal(null); setAlloc(''); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="px-4 py-3 rounded-xl bg-secondary text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Profit Split</span><span className="font-semibold">{copyModal.profit_split_pct}% to trader</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Min Allocation</span><span className="font-semibold">${copyModal.min_allocation}</span></div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Allocation (USD)</label>
                <Input type="number" placeholder={`Min $${copyModal.min_allocation}`} value={alloc} onChange={e => setAlloc(e.target.value)}
                  className="bg-secondary border-border font-mono" />
              </div>
              <Button onClick={handleCopy} disabled={submitting} className="w-full gradient-green text-white font-bold h-11">
                {submitting ? 'Starting...' : 'Start Copying'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
