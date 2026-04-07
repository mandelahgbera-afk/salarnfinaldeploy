import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, X, Search, Shield, Zap, TrendingUp, Check } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const RISK_COLORS: Record<string, string> = {
  low: 'text-up bg-up', medium: 'text-yellow-400 bg-yellow-400/10', high: 'text-down bg-down'
};
const EMPTY = {
  trader_name: '', specialty: '', total_profit_pct: '', monthly_profit_pct: '', win_rate: '',
  total_trades: '', followers: '', profit_split_pct: '', min_allocation: '100',
  risk_level: 'medium', avatar_color: '#6366f1', is_approved: false,
};

export default function ManageTraders() {
  const { user } = useOutletContext<any>();
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = () => api.traders.all().then(t => { setTraders(t); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = traders.filter(t => t.trader_name?.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    if (!form.trader_name) { toast.error('Trader name required'); return; }
    setSubmitting(true);
    try {
      await api.traders.create({
        trader_name: form.trader_name,
        specialty: form.specialty,
        total_profit_pct: parseFloat(form.total_profit_pct) || 0,
        monthly_profit_pct: parseFloat(form.monthly_profit_pct) || 0,
        win_rate: parseFloat(form.win_rate) || 0,
        total_trades: parseInt(form.total_trades) || 0,
        followers: parseInt(form.followers) || 0,
        profit_split_pct: parseFloat(form.profit_split_pct) || 10,
        min_allocation: parseFloat(form.min_allocation) || 100,
        risk_level: form.risk_level,
        avatar_color: form.avatar_color,
        is_approved: form.is_approved,
      });
      toast.success('Trader created!');
      setModal(false); setForm({ ...EMPTY }); load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create');
    }
    setSubmitting(false);
  };

  const toggleApproved = async (t: any) => {
    try {
      await api.traders.update(t.id, { is_approved: !t.is_approved });
      toast.success(`${t.trader_name} ${t.is_approved ? 'unapproved' : 'approved'}`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteTrader = async (t: any) => {
    try {
      await api.traders.delete(t.id);
      toast.success('Trader deleted');
      setConfirmDeleteId(null);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader user={user} title="Manage Copy Traders" subtitle={`${traders.length} traders registered`} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search traders..."
            className="pl-9 bg-secondary border-border" />
        </div>
        <Button onClick={() => setModal(true)} className="gradient-green text-white font-semibold">
          <Plus className="w-4 h-4 mr-2" /> Add Trader
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 shimmer rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No traders found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold"
                    style={{ background: t.avatar_color || '#6366f1' }}>
                    {t.trader_name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{t.trader_name}</p>
                    <p className="text-xs text-muted-foreground">{t.specialty || 'Multi-Strategy'}</p>
                  </div>
                </div>
                <div className="flex gap-1 items-center">
                  <button onClick={() => toggleApproved(t)}
                    className={`p-1.5 rounded-lg transition-colors ${t.is_approved ? 'bg-up text-up' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  {confirmDeleteId === t.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteTrader(t)}
                        className="px-2 py-1 rounded-lg bg-destructive/15 text-destructive text-xs font-semibold hover:bg-destructive/25 transition-colors">
                        Delete
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs hover:text-foreground transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(t.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                {[
                  { label: 'Profit', value: `+${t.total_profit_pct?.toFixed(1)}%`, up: true },
                  { label: 'Win %', value: `${t.win_rate?.toFixed(1)}%` },
                  { label: 'Trades', value: t.total_trades },
                ].map(s => (
                  <div key={s.label} className="bg-secondary rounded-xl px-2 py-2">
                    <p className={`text-xs font-bold font-mono ${s.up ? 'text-up' : ''}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${RISK_COLORS[t.risk_level]}`}>
                  {t.risk_level} risk
                </span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${t.is_approved ? 'bg-up text-up' : 'bg-secondary text-muted-foreground'}`}>
                  {t.is_approved ? '✓ Approved' : 'Pending'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Add Copy Trader</h3>
              <button onClick={() => { setModal(false); setForm({ ...EMPTY }); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Trader Name *', key: 'trader_name', placeholder: 'Alex Chen' },
                { label: 'Specialty', key: 'specialty', placeholder: 'DeFi Expert' },
                { label: 'Total Profit %', key: 'total_profit_pct', placeholder: '248.5', type: 'number' },
                { label: 'Monthly Profit %', key: 'monthly_profit_pct', placeholder: '18.2', type: 'number' },
                { label: 'Win Rate %', key: 'win_rate', placeholder: '76.5', type: 'number' },
                { label: 'Total Trades', key: 'total_trades', placeholder: '1240', type: 'number' },
                { label: 'Followers', key: 'followers', placeholder: '3200', type: 'number' },
                { label: 'Profit Split %', key: 'profit_split_pct', placeholder: '20', type: 'number' },
                { label: 'Min Allocation ($)', key: 'min_allocation', placeholder: '100', type: 'number' },
                { label: 'Avatar Color', key: 'avatar_color', placeholder: '#6366f1', type: 'color' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                  <Input type={f.type || 'text'} placeholder={f.placeholder} value={form[f.key]}
                    onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    className={`bg-secondary border-border text-sm ${f.type === 'color' ? 'h-10 cursor-pointer' : ''}`} />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground mb-1 block">Risk Level</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map(r => (
                  <button key={r} onClick={() => setForm((p: any) => ({ ...p, risk_level: r }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors capitalize ${form.risk_level === r ? RISK_COLORS[r] + ' border border-current/30' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <input type="checkbox" id="approved" checked={form.is_approved} onChange={e => setForm((p: any) => ({ ...p, is_approved: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
              <label htmlFor="approved" className="text-sm font-medium cursor-pointer">Approve immediately</label>
            </div>
            <div className="flex gap-3 mt-5">
              <Button onClick={handleSave} disabled={submitting} className="flex-1 gradient-green text-white font-bold">
                {submitting ? 'Saving...' : 'Create Trader'}
              </Button>
              <Button variant="outline" onClick={() => { setModal(false); setForm({ ...EMPTY }); }} className="border-border">Cancel</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
