import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CheckCircle, XCircle, Search, Key, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const STATUS_META: Record<string, any> = {
  pending:   { label: 'Pending',   cls: 'text-yellow-400 bg-yellow-400/10' },
  approved:  { label: 'Approved',  cls: 'text-up bg-up' },
  completed: { label: 'Completed', cls: 'text-up bg-up' },
  rejected:  { label: 'Rejected',  cls: 'text-down bg-down' },
};

const TYPE_COLORS: Record<string, string> = {
  deposit:     'text-up bg-up',
  withdrawal:  'text-down bg-down',
  buy:         'text-blue-400 bg-blue-400/10',
  sell:        'text-purple-400 bg-purple-400/10',
  copy_profit: 'text-up bg-up',
};

const EMPTY_FORM = { user_email: '', type: 'deposit', amount: '', status: 'pending', notes: '', wallet_address: '', crypto_symbol: '', crypto_amount: '' };

export default function AdminTransactions() {
  const { user } = useOutletContext<any>();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);

  const load = () =>
    api.transactions.getAll(200)
      .then(t => { setTxns(t); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = txns.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || t.user_email?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || t.status === statusFilter;
    const matchT = typeFilter === 'all' || t.type === typeFilter;
    return matchQ && matchS && matchT;
  });

  const handleCreate = async () => {
    if (!form.user_email.trim()) { toast.error('Enter user email'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setCreating(true);
    try {
      // Validate balance before transaction if withdrawal, buy
      const email = form.user_email.trim();
      if ((form.type === 'withdrawal' || form.type === 'buy') && form.status === 'completed') {
        const balance = await api.balances.getByEmail(email);
        if ((balance?.balance_usd ?? 0) < parseFloat(form.amount)) {
          toast.error('Insufficient user balance');
          setCreating(false);
          return;
        }
      }

      const payload: any = {
        user_email: email,
        type: form.type,
        amount: parseFloat(form.amount),
        status: form.status,
      };
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (form.wallet_address.trim()) payload.wallet_address = form.wallet_address.trim();
      if (form.crypto_symbol.trim()) payload.crypto_symbol = form.crypto_symbol.trim().toUpperCase();
      if (form.crypto_amount && parseFloat(form.crypto_amount) > 0) payload.crypto_amount = parseFloat(form.crypto_amount);

      await api.transactions.create(payload);

      if (form.status === 'completed') {
        const amount = parseFloat(form.amount);
        const cryptoSymbol = form.crypto_symbol.trim().toUpperCase();
        const cryptoAmt = parseFloat(form.crypto_amount);

        if (form.type === 'deposit' || form.type === 'copy_profit') {
          const current = await api.balances.getByEmail(email);
          const currentBal = current?.balance_usd ?? 0;
          await api.balances.update(email, { balance_usd: currentBal + amount });
          toast.success(`$${amount.toLocaleString()} credited to ${email}`);
        } else if (form.type === 'sell') {
          if (cryptoSymbol && cryptoAmt > 0) {
            await api.portfolio.reduce(email, cryptoSymbol, cryptoAmt).catch(() => {});
          }
          const current = await api.balances.getByEmail(email);
          const currentBal = current?.balance_usd ?? 0;
          await api.balances.update(email, { balance_usd: currentBal + amount });
          toast.success(`Sell created — $${amount.toLocaleString()} credited to ${email}`);
        } else if (form.type === 'buy') {
          const current = await api.balances.getByEmail(email);
          const currentBal = current?.balance_usd ?? 0;
          await api.balances.update(email, { balance_usd: Math.max(0, currentBal - amount) });
          if (cryptoSymbol && cryptoAmt > 0) {
            const avgPrice = cryptoAmt > 0 ? amount / cryptoAmt : 0;
            await api.portfolio.upsert(email, cryptoSymbol, cryptoAmt, avgPrice);
          }
          toast.success(`Buy created — $${amount.toLocaleString()} deducted, crypto added to portfolio`);
        } else if (form.type === 'withdrawal') {
          const current = await api.balances.getByEmail(email);
          const currentBal = current?.balance_usd ?? 0;
          await api.balances.update(email, { balance_usd: Math.max(0, currentBal - amount) });
          toast.success(`Withdrawal created — $${amount.toLocaleString()} deducted from ${email}`);
        } else {
          toast.success('Transaction created successfully');
        }
      } else {
        toast.success('Transaction created successfully');
      }

      setCreateModal(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create transaction');
    }
    setCreating(false);
  };

  const approve = async (tx: any, action: 'approved' | 'rejected') => {
    setUpdating(tx.id);
    try {
      if (action === 'rejected') {
        await api.transactions.update(tx.id, { status: 'rejected' });
        toast.success('Transaction rejected');

      } else if (tx.type === 'deposit') {
        const current = await api.balances.getByEmail(tx.user_email);
        const currentBal = current?.balance_usd ?? 0;
        await api.balances.update(tx.user_email, { balance_usd: currentBal + tx.amount });
        try {
          await api.transactions.update(tx.id, {
            status: 'completed',
            reviewed_by: user?.email,
            reviewed_at: new Date().toISOString(),
          });
        } catch (e) {
          await api.balances.update(tx.user_email, { balance_usd: currentBal }).catch(() => {});
          throw e;
        }
        toast.success(`Deposit approved — $${tx.amount.toLocaleString()} credited to ${tx.user_email}`);

      } else if (tx.type === 'withdrawal') {
        // User already verified identity with Supabase email OTP at withdrawal submission time.
        // Admin approval directly completes the withdrawal — the user's processing page updates via realtime.
        const current = await api.balances.getByEmail(tx.user_email);
        const currentBal = current?.balance_usd ?? 0;
        if (currentBal < tx.amount) {
          toast.error(`Insufficient balance — user has ${currentBal.toFixed(2)}, needs ${tx.amount.toFixed(2)}`);
          setUpdating(null);
          return;
        }
        await api.balances.update(tx.user_email, { balance_usd: currentBal - tx.amount });
        try {
          await api.transactions.update(tx.id, {
            status: 'completed',
            reviewed_by: user?.email,
            reviewed_at: new Date().toISOString(),
          });
        } catch (e) {
          await api.balances.update(tx.user_email, { balance_usd: currentBal }).catch(() => {});
          throw e;
        }
        toast.success(
          `Withdrawal approved — ${tx.amount.toFixed(2)} deducted and sent to ${tx.user_email}`,
          { description: 'User\'s withdrawal processing page has been updated in real time.' }
        );

      } else if (tx.type === 'buy') {
        const current = await api.balances.getByEmail(tx.user_email);
        const currentBal = current?.balance_usd ?? 0;
        if (currentBal < tx.amount) {
          toast.error(`Insufficient balance — user has $${currentBal.toFixed(2)}, order is $${tx.amount.toFixed(2)}`);
          setUpdating(null);
          return;
        }
        await api.balances.update(tx.user_email, { balance_usd: currentBal - tx.amount });
        try {
          if (tx.crypto_symbol && tx.crypto_amount && tx.crypto_amount > 0) {
            const avgPrice = tx.amount / tx.crypto_amount;
            await api.portfolio.upsert(tx.user_email, tx.crypto_symbol, tx.crypto_amount, avgPrice);
          }
          await api.transactions.update(tx.id, {
            status: 'completed',
            reviewed_by: user?.email,
            reviewed_at: new Date().toISOString(),
          });
        } catch (e) {
          await api.balances.update(tx.user_email, { balance_usd: currentBal }).catch(() => {});
          throw e;
        }
        toast.success(`Buy approved — $${tx.amount.toFixed(2)} deducted, ${tx.crypto_amount} ${tx.crypto_symbol} added to portfolio`);

      } else if (tx.type === 'sell') {
        let preReduceHolding: any = null;
        if (tx.crypto_symbol && tx.crypto_amount && tx.crypto_amount > 0) {
          const holdings = await api.portfolio.getByEmail(tx.user_email);
          preReduceHolding = holdings.find((h: any) => h.crypto_symbol === tx.crypto_symbol) || null;
          await api.portfolio.reduce(tx.user_email, tx.crypto_symbol, tx.crypto_amount);
        }
        const current = await api.balances.getByEmail(tx.user_email);
        const currentBal = current?.balance_usd ?? 0;
        await api.balances.update(tx.user_email, { balance_usd: currentBal + tx.amount });
        try {
          await api.transactions.update(tx.id, {
            status: 'completed',
            reviewed_by: user?.email,
            reviewed_at: new Date().toISOString(),
          });
        } catch (e) {
          await api.balances.update(tx.user_email, { balance_usd: currentBal }).catch(() => {});
          if (preReduceHolding && tx.crypto_symbol && tx.crypto_amount > 0) {
            await api.portfolio.upsert(
              tx.user_email, tx.crypto_symbol, tx.crypto_amount, preReduceHolding.avg_buy_price
            ).catch(() => {});
          }
          throw e;
        }
        toast.success(`Sell approved — ${tx.crypto_amount} ${tx.crypto_symbol} removed, $${tx.amount.toFixed(2)} credited`);

      } else if (tx.type === 'copy_profit') {
        const current = await api.balances.getByEmail(tx.user_email);
        const currentBal = current?.balance_usd ?? 0;
        await api.balances.update(tx.user_email, { balance_usd: currentBal + tx.amount });
        try {
          await api.transactions.update(tx.id, {
            status: 'completed',
            reviewed_by: user?.email,
            reviewed_at: new Date().toISOString(),
          });
        } catch (e) {
          await api.balances.update(tx.user_email, { balance_usd: currentBal }).catch(() => {});
          throw e;
        }
        toast.success(`Copy profit approved — $${tx.amount.toFixed(2)} credited to ${tx.user_email}`);

      } else {
        await api.transactions.update(tx.id, {
          status: action,
          reviewed_by: user?.email,
          reviewed_at: new Date().toISOString(),
        });
        toast.success(`Transaction ${action}`);
      }

      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update transaction');
    }
    setUpdating(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        user={user}
        title="Transaction Management"
        subtitle={`${txns.filter(t => t.status === 'pending').length} pending approvals`}
      />

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email..."
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'completed', 'rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'deposit', 'withdrawal', 'buy', 'sell', 'copy_profit'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${typeFilter === t ? 'bg-accent text-foreground border border-border' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {t === 'copy_profit' ? 'Copy Profit' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <Button onClick={() => setCreateModal(true)} className="gradient-green text-white font-semibold glow-green-sm text-xs h-9 px-4">
          <Plus className="w-4 h-4 mr-1.5" /> Create Transaction
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-7 text-xs text-muted-foreground px-5 py-3 border-b border-border/60 font-medium">
          <span className="col-span-2">User</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Status</span>
          <span>OTP</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No transactions found</div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(tx => (
              <div key={tx.id}
                className="grid grid-cols-1 sm:grid-cols-7 items-center gap-3 px-5 py-4 hover:bg-secondary/30 transition-colors">

                <div className="sm:col-span-2 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground truncate">{tx.user_email}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                  {tx.wallet_address && (
                    <p className="text-[10px] text-muted-foreground font-mono truncate" title={tx.wallet_address}>
                      {tx.wallet_address.slice(0, 16)}…
                    </p>
                  )}
                  {tx.crypto_symbol && tx.crypto_amount && (
                    <p className="text-[10px] text-muted-foreground">{tx.crypto_amount} {tx.crypto_symbol}</p>
                  )}
                </div>

                <span className={`w-fit text-xs font-semibold px-2 py-1 rounded-lg capitalize ${TYPE_COLORS[tx.type] || 'bg-secondary text-muted-foreground'}`}>
                  {tx.type.replace('_', ' ')}
                </span>

                <p className="text-sm font-mono font-bold">
                  ${tx.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>

                <span className={`w-fit text-xs font-semibold px-2 py-1 rounded-lg capitalize ${STATUS_META[tx.status]?.cls || ''}`}>
                  {STATUS_META[tx.status]?.label || tx.status}
                </span>

                <div className="text-xs">
                  {tx.type === 'withdrawal' && tx.otp_code ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <Key className="w-3 h-3 text-yellow-400" />
                        <span className="font-mono font-bold text-yellow-300 tracking-widest">{tx.otp_code}</span>
                      </div>
                      <span className={`text-[10px] ${tx.otp_verified ? 'text-up' : 'text-yellow-400'}`}>
                        {tx.otp_verified
                          ? '✓ Verified'
                          : tx.otp_expires_at && new Date(tx.otp_expires_at) < new Date()
                            ? '⚠ Expired'
                            : 'Awaiting user'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {tx.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => approve(tx, 'approved')}
                        disabled={updating === tx.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-up text-up text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {updating === tx.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => approve(tx, 'rejected')}
                        disabled={updating === tx.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-down text-down text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {tx.status === 'completed' ? 'Done' : tx.status === 'approved' ? 'OTP sent' : 'Processed'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-secondary/60 border border-border rounded-2xl px-5 py-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground">Approval Logic Reference</p>
        <p><span className="text-up font-semibold">Deposit:</span> Credits user balance immediately → status moves to <em>Completed</em>.</p>
        <p><span className="text-down font-semibold">Withdrawal:</span> Checks &amp; reserves balance → generates OTP shown above → status <em>Approved</em>. Send OTP to user. Moves to <em>Completed</em> after user verifies.</p>
        <p><span className="text-blue-400 font-semibold">Buy:</span> Verifies balance → deducts USD → adds crypto to portfolio → status <em>Completed</em>.</p>
        <p><span className="text-purple-400 font-semibold">Sell:</span> Removes crypto from portfolio → credits USD → status <em>Completed</em>.</p>
        <p><span className="text-up font-semibold">Copy Profit:</span> Credits profit amount to user balance → status <em>Completed</em>.</p>
      </div>

      {createModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Create Transaction</h3>
              <button onClick={() => { setCreateModal(false); setForm({ ...EMPTY_FORM }); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">User Email *</label>
                <Input value={form.user_email} onChange={e => setForm(p => ({ ...p, user_email: e.target.value }))}
                  placeholder="user@example.com" className="bg-secondary border-border text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Type *</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full h-10 rounded-xl bg-secondary border border-border text-sm px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                    <option value="copy_profit">Copy Profit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Status *</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full h-10 rounded-xl bg-secondary border border-border text-sm px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Amount (USD) *</label>
                <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00" className="bg-secondary border-border text-sm font-mono" />
              </div>

              {(form.type === 'buy' || form.type === 'sell') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Crypto Symbol</label>
                    <Input value={form.crypto_symbol} onChange={e => setForm(p => ({ ...p, crypto_symbol: e.target.value }))}
                      placeholder="BTC" className="bg-secondary border-border text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Crypto Amount</label>
                    <Input type="number" value={form.crypto_amount} onChange={e => setForm(p => ({ ...p, crypto_amount: e.target.value }))}
                      placeholder="0.001" className="bg-secondary border-border text-sm font-mono" />
                  </div>
                </div>
              )}

              {form.type === 'withdrawal' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Wallet Address</label>
                  <Input value={form.wallet_address} onChange={e => setForm(p => ({ ...p, wallet_address: e.target.value }))}
                    placeholder="0x... or bc1q..." className="bg-secondary border-border text-sm font-mono" />
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Admin note..." className="bg-secondary border-border text-sm" />
              </div>

              {form.status === 'completed' && (form.type === 'deposit' || form.type === 'copy_profit') && (
                <div className="px-3 py-2.5 rounded-xl bg-up/8 border border-up/20 text-xs text-up">
                  <strong>Auto-apply:</strong> ${form.amount || '0'} will be credited to this user's balance immediately.
                </div>
              )}
              {form.status === 'completed' && form.type === 'sell' && (
                <div className="px-3 py-2.5 rounded-xl bg-up/8 border border-up/20 text-xs text-up">
                  <strong>Auto-apply:</strong> Crypto will be removed from portfolio and ${form.amount || '0'} credited to balance.
                </div>
              )}
              {form.status === 'completed' && form.type === 'buy' && (
                <div className="px-3 py-2.5 rounded-xl bg-blue-400/8 border border-blue-400/20 text-xs text-blue-400">
                  <strong>Auto-apply:</strong> ${form.amount || '0'} deducted from balance and crypto added to portfolio.
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <Button onClick={handleCreate} disabled={creating} className="flex-1 gradient-green text-white font-bold">
                {creating ? 'Creating...' : 'Create Transaction'}
              </Button>
              <Button variant="outline" onClick={() => { setCreateModal(false); setForm({ ...EMPTY_FORM }); }}
                className="border-border hover:bg-secondary">Cancel</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
