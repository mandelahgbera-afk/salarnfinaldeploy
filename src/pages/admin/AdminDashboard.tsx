import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, DollarSign, TrendingUp, Clock, CheckCircle, ChevronRight, Activity, Copy } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line
} from 'recharts';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/ui/PageHeader';

function buildMonthlyChart(txns: any[]) {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }) });
  }
  const map: Record<string, { m: string; deposits: number; withdrawals: number; volume: number }> = {};
  months.forEach(({ key, label }) => { map[key] = { m: label, deposits: 0, withdrawals: 0, volume: 0 }; });
  txns.forEach(tx => {
    if (tx.status === 'rejected') return;
    const d = new Date(tx.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map[key]) return;
    const amt = Number(tx.amount) || 0;
    if (tx.status === 'approved' || tx.status === 'completed') {
      map[key].volume += amt;
      if (tx.type === 'deposit') map[key].deposits += amt;
      if (tx.type === 'withdrawal') map[key].withdrawals += amt;
    }
  });
  return months.map(({ key }) => map[key]);
}

function buildUserGrowthChart(users: any[]) {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }) });
  }
  const map: Record<string, { m: string; newUsers: number; total: number }> = {};
  months.forEach(({ key, label }) => { map[key] = { m: label, newUsers: 0, total: 0 }; });
  users.forEach(u => {
    const d = new Date(u.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (map[key]) map[key].newUsers++;
  });
  let running = 0;
  return months.map(({ key }) => {
    running += map[key].newUsers;
    return { ...map[key], total: running };
  });
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs shadow-xl">
      <p className="font-semibold mb-1.5 text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-mono" style={{ color: p.fill }}>
          {p.dataKey === 'deposits' ? 'Deposits' : p.dataKey === 'withdrawals' ? 'Withdrawals' : 'Volume'}:{' '}
          ${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  );
}

function LineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs shadow-xl">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      <p className="font-mono text-primary">+{payload[0]?.payload?.newUsers} new users</p>
      <p className="font-mono text-muted-foreground">{payload[0]?.value} total</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useOutletContext<any>();
  const [stats, setStats] = useState({
    users: 0, pendingTxns: 0, totalDeposits: 0, activeTraders: 0,
    activeCopyTrades: 0, totalVolume: 0,
  });
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveSignal, setLiveSignal] = useState(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashLive = useCallback(() => {
    setLiveSignal(true);
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => setLiveSignal(false), 2000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [users, txns, traders, copyTrades] = await Promise.all([
        api.users.list(),
        api.transactions.getAll(1000),
        api.traders.all(),
        api.copyTrades.getAll(),
      ]);
      const pending = txns.filter((t: any) => t.status === 'pending' || t.status === 'approved').length;
      const totalDep = txns
        .filter((t: any) => t.type === 'deposit' && (t.status === 'approved' || t.status === 'completed'))
        .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      const totalVol = txns
        .filter((t: any) => t.status === 'approved' || t.status === 'completed')
        .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      setStats({
        users: users.length,
        pendingTxns: pending,
        totalDeposits: totalDep,
        activeTraders: traders.filter((t: any) => t.is_approved).length,
        activeCopyTrades: copyTrades.length,
        totalVolume: totalVol,
      });
      setAllTxns(txns);
      setAllUsers(users);
      setRecentTxns(txns.slice(0, 8));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        flashLive(); loadData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => {
        flashLive(); loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData, flashLive]);

  const chartData = useMemo(() => buildMonthlyChart(allTxns), [allTxns]);
  const userGrowthData = useMemo(() => buildUserGrowthChart(allUsers), [allUsers]);
  const hasChartData = chartData.some(d => d.deposits > 0 || d.withdrawals > 0);
  const hasUserData = userGrowthData.some(d => d.newUsers > 0);

  const statCards = [
    { label: 'Total Users',        value: stats.users.toString(),                       icon: Users,      bg: 'bg-primary/15',         color: 'text-primary',     link: '/admin/users' },
    { label: 'Pending Approvals',  value: stats.pendingTxns.toString(),                 icon: Clock,      bg: 'bg-yellow-400/10',      color: 'text-yellow-400',  link: '/admin/transactions' },
    { label: 'Total Deposits',     value: `$${stats.totalDeposits.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, bg: 'bg-emerald-500/15', color: 'text-emerald-400', link: '/admin/transactions' },
    { label: 'Active Traders',     value: stats.activeTraders.toString(),               icon: TrendingUp, bg: 'bg-blue-400/10',        color: 'text-blue-400',    link: '/admin/traders' },
    { label: 'Copy Trades Active', value: stats.activeCopyTrades.toString(),            icon: Copy,       bg: 'bg-purple-400/10',      color: 'text-purple-400',  link: '/admin/users' },
    { label: 'Total Volume',       value: `$${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: Activity,   bg: 'bg-cyan-400/10',    color: 'text-cyan-400',    link: '/admin/transactions' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader user={user} title="Admin Overview" subtitle="Platform performance at a glance" />
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${liveSignal ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-card border-border text-muted-foreground'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${liveSignal ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
          Live
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map(({ label, value, icon: Icon, bg, color, link }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={link} className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight">{label}</p>
                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              {loading ? (
                <div className="h-7 w-20 shimmer rounded-lg" />
              ) : (
                <p className="text-xl font-bold font-mono tabular-nums truncate">{value}</p>
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold">Transaction Volume</p>
              <p className="text-xs text-muted-foreground mt-0.5">Deposits & withdrawals · last 6 months</p>
            </div>
            <Link to="/admin/transactions" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="h-52 shimmer rounded-xl" />
          ) : !hasChartData ? (
            <div className="h-52 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground/80">No transaction data yet</p>
                <p className="text-xs text-muted-foreground mt-1">Charts will populate as users deposit and withdraw</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,18%,14%)" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'hsl(215,14%,46%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(215,14%,46%)' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(222,18%,14%)' }} />
                    <Bar dataKey="deposits" fill="hsl(160,84%,39%)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="withdrawals" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Deposits
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Withdrawals
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold">User Growth</p>
              <p className="text-xs text-muted-foreground mt-0.5">New registrations · last 6 months</p>
            </div>
            <Link to="/admin/users" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="h-52 shimmer rounded-xl" />
          ) : !hasUserData ? (
            <div className="h-52 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                <Users className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground/80">No user data yet</p>
                <p className="text-xs text-muted-foreground mt-1">Chart will populate as users register</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userGrowthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160,84%,42%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(160,84%,42%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,18%,14%)" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'hsl(215,14%,46%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(215,14%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<LineTooltip />} />
                    <Area type="monotone" dataKey="total" stroke="hsl(160,84%,42%)" strokeWidth={2}
                      fill="url(#userGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 justify-center">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Cumulative registered users
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold">Recent Transactions</p>
          <Link to="/admin/transactions" className="flex items-center gap-0.5 text-xs text-primary hover:underline">
            All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 shimmer rounded-xl" />)}
          </div>
        ) : recentTxns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 gap-2 text-center">
            <CheckCircle className="w-8 h-8 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {recentTxns.map(tx => {
              const statusCls = tx.status === 'completed' || tx.status === 'approved'
                ? 'text-emerald-400' : tx.status === 'rejected' ? 'text-red-400' : 'text-yellow-400';
              return (
                <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold capitalize">{tx.type?.replace('_', ' ')}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{tx.user_email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono font-bold">
                      ${(Number(tx.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-[10px] font-semibold capitalize ${statusCls}`}>{tx.status}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
