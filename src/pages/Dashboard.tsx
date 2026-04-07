import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import type { OutletContext } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, ArrowDownLeft,
  ArrowUpRight, ArrowLeftRight, Copy, Eye, EyeOff,
  Sparkles, ChevronRight, RefreshCw, Activity,
  BarChart2, Zap
} from 'lucide-react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/ui/PageHeader';
import { CoinIcon } from '@/components/ui/CryptoRow';
import { fetchTopMarkets, fetchChart, type CoinMarket, type ChartPoint } from '@/lib/marketData';

const QUICK_ACTIONS = [
  { label: 'Deposit',  icon: ArrowDownLeft,  path: '/transactions', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.2)' },
  { label: 'Withdraw', icon: ArrowUpRight,   path: '/transactions', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.2)' },
  { label: 'Trade',    icon: ArrowLeftRight, path: '/trade',        color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.2)' },
  { label: 'Copy',     icon: Copy,           path: '/copy-trading', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.2)' },
];

const MARKET_PERIODS = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
];

const PORTFOLIO_PERIODS = [
  { label: '7D',  days: 7 },
  { label: '30D', days: 30 },
  { label: '3M',  days: 90 },
  { label: 'All', days: 0 },
];

const PIE_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

function buildChartData(txns: any[], currentBalance: number, days: number) {
  if (!txns.length) return [];
  const cutoff = days > 0 ? new Date(Date.now() - days * 86400000) : new Date(0);
  const sorted = [...txns]
    .filter(tx => days === 0 || new Date(tx.created_at) >= cutoff)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let running = 0;
  const points: { t: string; v: number }[] = [];
  for (const tx of sorted) {
    if (tx.status === 'rejected') continue;
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'deposit' && (tx.status === 'approved' || tx.status === 'completed')) running += amt;
    else if (tx.type === 'withdrawal' && tx.status === 'completed') running -= amt;
    else if (tx.type === 'buy' && (tx.status === 'approved' || tx.status === 'completed')) running -= amt;
    else if (tx.type === 'sell' && (tx.status === 'approved' || tx.status === 'completed')) running += amt;
    else if (tx.type === 'copy_profit' && (tx.status === 'approved' || tx.status === 'completed')) running += amt;
    const d = new Date(tx.created_at);
    points.push({ t: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), v: Math.max(0, running) });
  }
  if (points.length > 0 && currentBalance > 0) points[points.length - 1].v = currentBalance;
  if (points.length === 1) points.unshift({ t: 'Start', v: 0 });
  return points;
}

function PortfolioTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(8,12,24,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}
      className="px-4 py-3 shadow-2xl">
      <p className="text-[10px] text-muted-foreground mb-1 font-medium">{payload[0].payload.t}</p>
      <p className="font-mono font-black text-sm text-emerald-400">
        ${payload[0].value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function CoinDetailTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background: 'rgba(8,12,24,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}
      className="px-4 py-3 shadow-2xl">
      <p className="text-[10px] text-muted-foreground mb-1 font-medium">{payload[0].payload.t}</p>
      <p className="font-mono font-black text-sm text-white">
        ${v > 1 ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
               : v.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
      </p>
    </div>
  );
}

function SparkLine({ data, color, positive }: { data: ChartPoint[]; color: string; positive: boolean }) {
  if (!data || !Array.isArray(data) || data.length < 2) {
    return <div className="h-10 w-full flex items-center justify-center">
      <div className="w-full h-px opacity-20" style={{ background: color }} />
    </div>;
  }
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <filter id={`spark-glow-${color.replace('#','')}`}>
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id={`spark-grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" fill={`url(#spark-grad-${color.replace('#','')})`} stroke="none" />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#spark-glow-${color.replace('#','')})`}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

export default function Dashboard() {
  const { user } = useOutletContext<OutletContext>();

  // Portfolio state
  const [balance, setBalance] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [dbCryptos, setDbCryptos] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [hideBalance, setHideBalance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [portfolioPeriod, setPortfolioPeriod] = useState(3);

  // Live market state
  const [marketCoins, setMarketCoins] = useState<CoinMarket[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [selectedCoin, setSelectedCoin] = useState<CoinMarket | null>(null);
  const [coinChart, setCoinChart] = useState<ChartPoint[]>([]);
  const [coinChartLoading, setCoinChartLoading] = useState(false);
  const [marketPeriod, setMarketPeriod] = useState(0);
  const [sparklines, setSparklines] = useState<Record<string, ChartPoint[]>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const marketRefTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load user portfolio data
  const loadAll = useCallback(async () => {
    if (!user?.email) return;
    try {
      const [bal, port, cry, allTx] = await Promise.all([
        api.balances.getByEmail(user.email),
        api.portfolio.getByEmail(user.email),
        api.cryptos.active(),
        api.transactions.getByEmail(user.email, 500),
      ]);
      setBalance(bal || { balance_usd: 0, total_invested: 0, total_profit_loss: 0 });
      setPortfolio(port);
      setDbCryptos(cry);
      setTxns(allTx.slice(0, 5));
      setAllTxns(allTx);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [user?.email]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.email) return;
    const channel = supabase
      .channel(`dash-${user.email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_balances', filter: `user_email=eq.${user.email}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_email=eq.${user.email}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio', filter: `user_email=eq.${user.email}` }, () => loadAll())
      .subscribe();
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
  }, [user?.email, loadAll]);

  // Load live market data
  // Mirror selectedCoin in a ref so the stable interval callback reads the latest value
  // without being listed as a useCallback dependency (which would re-register the interval on every coin select)
  const selectedCoinRef = useRef<CoinMarket | null>(null);
  useEffect(() => { selectedCoinRef.current = selectedCoin; }, [selectedCoin]);

  const loadMarket = useCallback(async () => {
    try {
      const coins = await fetchTopMarkets(12);
      setMarketCoins(coins);
      setLastUpdated(new Date());
      // Read via ref — never stale, never causes interval re-registration
      if (!selectedCoinRef.current && coins.length > 0) setSelectedCoin(coins[0]);
      setMarketLoading(false);

      // Load sparklines (1-day charts) for each coin
      const sparks: Record<string, ChartPoint[]> = {};
      await Promise.allSettled(
        coins.slice(0, 8).map(async (c) => {
          try {
            const data = await fetchChart(c.symbol, 1);
            // Downsample to ~20 points
            const step = Math.max(1, Math.floor(data.length / 20));
            sparks[c.symbol] = data.filter((_, i) => i % step === 0);
          } catch { sparks[c.symbol] = []; }
        })
      );
      setSparklines(sparks);
    } catch { setMarketLoading(false); }
  }, []);

  useEffect(() => {
    loadMarket();
    marketRefTimer.current = setInterval(loadMarket, 60_000);
    return () => { if (marketRefTimer.current) clearInterval(marketRefTimer.current); };
  }, [loadMarket]);

  // Load selected coin detail chart
  useEffect(() => {
    if (!selectedCoin) return;
    let cancelled = false;
    setCoinChartLoading(true);
    fetchChart(selectedCoin.symbol, MARKET_PERIODS[marketPeriod].days)
      .then(data => { if (!cancelled) { setCoinChart(data); setCoinChartLoading(false); } })
      .catch(() => { if (!cancelled) setCoinChartLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCoin?.symbol, marketPeriod]);

  // Derived values
  const totalBalance = balance?.balance_usd || 0;
  const pl = balance?.total_profit_loss || 0;
  const plPct = balance?.total_invested > 0 ? ((pl / balance.total_invested) * 100).toFixed(2) : '0.00';
  const isUp = pl >= 0;
  const isNewUser = !loading && totalBalance === 0 && txns.length === 0 && portfolio.length === 0;

  const portfolioWithPrices = portfolio.map((p, i) => {
    const crypto = dbCryptos.find(c => c.symbol === p.crypto_symbol);
    const currentValue = (crypto?.price || 0) * p.amount;
    return { ...p, currentValue, price: crypto?.price || 0, color: PIE_COLORS[i % PIE_COLORS.length] };
  });
  const totalPortfolioValue = portfolioWithPrices.reduce((s, p) => s + p.currentValue, 0);

  const selectedDays = PORTFOLIO_PERIODS[portfolioPeriod]?.days ?? 0;
  const chartData = useMemo(
    () => buildChartData(allTxns, totalBalance, selectedDays),
    [allTxns, totalBalance, selectedDays]
  );

  const coinChartUp = coinChart.length >= 2
    ? coinChart[coinChart.length - 1].v >= coinChart[0].v
    : (selectedCoin?.change_24h ?? 0) >= 0;

  const coinChange = coinChart.length >= 2
    ? ((coinChart[coinChart.length - 1].v - coinChart[0].v) / coinChart[0].v * 100)
    : (selectedCoin?.change_24h ?? 0);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader user={user} title="Dashboard" subtitle={`Welcome back, ${user?.full_name?.split(' ')[0] || 'Trader'}`} />

      {/* Balance + Quick Actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Balance Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 relative rounded-3xl p-6 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(16,185,129,0.1) 0%, rgba(6,182,212,0.04) 50%, rgba(10,14,28,0.98) 100%)',
            border: '1px solid rgba(16,185,129,0.15)',
            boxShadow: '0 0 80px rgba(16,185,129,0.06), inset 0 1px 0 rgba(255,255,255,0.04)'
          }}>
          {/* Ambient glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />

          <div className="relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Balance</p>
                  {!loading && !isNewUser && (
                    <p className="text-[10px] text-muted-foreground/60">Across all assets</p>
                  )}
                </div>
              </div>
              <button onClick={() => setHideBalance(h => !h)}
                className="p-2 rounded-xl transition-all hover:bg-white/5 text-muted-foreground hover:text-white"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                {hideBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-end gap-4 mb-2">
              <h2 className="text-5xl font-black font-mono tabular-nums tracking-tight leading-none">
                {loading
                  ? <span className="text-muted-foreground/20 animate-pulse">$0.00</span>
                  : hideBalance ? <span className="tracking-widest text-3xl">••••••</span>
                  : `$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </h2>
              {!loading && !isNewUser && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className={`flex items-center gap-1.5 text-sm font-bold mb-1.5 px-3 py-1.5 rounded-xl ${isUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}
                  style={{ border: `1px solid ${isUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {isUp ? '+' : ''}{plPct}%
                </motion.div>
              )}
            </div>

            {!loading && !isNewUser && (
              <p className={`text-sm font-mono font-semibold ${isUp ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                {isUp ? '+' : ''}${Math.abs(pl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total P&L
              </p>
            )}
            {!loading && isNewUser && (
              <p className="text-sm text-muted-foreground">Deposit funds to start trading</p>
            )}

            {/* Mini portfolio chart inside balance card */}
            {!loading && chartData.length >= 2 && (
              <div className="mt-5 h-16 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity={0.4} />
                        <stop offset="50%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity={0} />
                      </linearGradient>
                      <filter id="balGlow">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <Area type="natural" dataKey="v" stroke={isUp ? '#10b981' : '#ef4444'}
                      strokeWidth={2} fill="url(#balGrad)" dot={false} filter="url(#balGlow)" isAnimationActive={true} />
                    <Tooltip content={<PortfolioTooltip />} cursor={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map(({ label, icon: Icon, path, color, bg, border }) => (
            <Link key={label} to={path}
              className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl transition-all hover:scale-[1.04] active:scale-[0.97] group relative overflow-hidden"
              style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `radial-gradient(circle at 50% 50%, ${color}22, transparent 70%)` }} />
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <span className="text-xs font-bold text-foreground/90">{label}</span>
            </Link>
          ))}
        </motion.div>
      </div>

      {/* ── LIVE MARKET SECTION ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-3xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,12,24,0.8)', backdropFilter: 'blur(24px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <Activity className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-bold">Live Markets</p>
              {lastUpdated && (
                <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                  <LiveDot /> Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadMarket} className="p-1.5 rounded-lg text-muted-foreground hover:text-white transition-colors hover:bg-white/5">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <Link to="/trade" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-semibold transition-colors">
              Trade <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5">
          {/* Coin list */}
          <div className="lg:col-span-2 overflow-y-auto max-h-[380px]"
            style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            {marketLoading ? (
              <div className="space-y-px p-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
                ))}
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {marketCoins.slice(0, 10).map((coin) => {
                  const isSelected = selectedCoin?.id === coin.id;
                  const spark = sparklines[coin.symbol] || [];
                  const sparkUp = coin.change_24h >= 0;
                  return (
                    <button key={coin.id}
                      onClick={() => setSelectedCoin(coin)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all group"
                      style={{
                        background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                      }}>
                      <CoinIcon symbol={coin.symbol} size={8} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">{coin.symbol}</span>
                          <span className="text-xs font-mono font-bold tabular-nums">
                            ${coin.price > 1
                              ? coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : coin.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-muted-foreground truncate">{coin.name}</span>
                          <span className={`text-[10px] font-bold ${coin.change_24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {coin.change_24h >= 0 ? '+' : ''}{coin.change_24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      {/* Mini sparkline */}
                      <div className="w-14 flex-shrink-0">
                        <SparkLine data={spark} color={sparkUp ? '#10b981' : '#ef4444'} positive={sparkUp} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coin Detail Chart */}
          <div className="lg:col-span-3 p-5">
            <AnimatePresence mode="wait">
              {selectedCoin && (
                <motion.div key={selectedCoin.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}>

                  {/* Coin header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <CoinIcon symbol={selectedCoin.symbol} size={10} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black">{selectedCoin.name}</h3>
                          <span className="text-xs font-bold text-muted-foreground px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {selectedCoin.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-2xl font-black font-mono tabular-nums">
                            ${selectedCoin.price > 1
                              ? selectedCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : selectedCoin.price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                          </p>
                          <span className={`text-sm font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 ${coinChartUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}
                            style={{ border: `1px solid ${coinChartUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                            {coinChartUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {coinChartUp ? '+' : ''}{coinChange.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Period selector */}
                    <div className="flex items-center gap-0.5 p-0.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {MARKET_PERIODS.map((p, i) => (
                        <button key={p.label} onClick={() => setMarketPeriod(i)}
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                          style={{
                            background: i === marketPeriod ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: i === marketPeriod ? 'white' : 'rgba(255,255,255,0.4)',
                            border: i === marketPeriod ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                          }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2.5 mb-5">
                    {[
                      { label: 'Market Cap', value: selectedCoin.market_cap > 1e9 ? `$${(selectedCoin.market_cap / 1e9).toFixed(1)}B` : `$${(selectedCoin.market_cap / 1e6).toFixed(0)}M` },
                      { label: '24h Volume', value: selectedCoin.volume_24h > 1e9 ? `$${(selectedCoin.volume_24h / 1e9).toFixed(1)}B` : `$${(selectedCoin.volume_24h / 1e6).toFixed(0)}M` },
                      { label: '24h Change', value: `${selectedCoin.change_24h >= 0 ? '+' : ''}${selectedCoin.change_24h.toFixed(2)}%`, isChange: true, up: selectedCoin.change_24h >= 0 },
                    ].map(stat => (
                      <div key={stat.label} className="px-3 py-2.5 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] text-muted-foreground/70 mb-1 font-medium">{stat.label}</p>
                        <p className={`text-sm font-bold font-mono tabular-nums ${stat.isChange ? (stat.up ? 'text-emerald-400' : 'text-red-400') : 'text-foreground/90'}`}>
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Main chart */}
                  <div className="h-44 -mx-1">
                    {coinChartLoading ? (
                      <div className="h-full rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
                    ) : coinChart.length < 2 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Chart data loading...</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={coinChart} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                          <defs>
                            <linearGradient id="coinGradUp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                              <stop offset="60%" stopColor="#10b981" stopOpacity={0.06} />
                              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="coinGradDown" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                              <stop offset="60%" stopColor="#ef4444" stopOpacity={0.06} />
                              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                            <filter id="lineGlow">
                              <feGaussianBlur stdDeviation="2.5" result="blur" />
                              <feComponentTransfer>
                                <feFuncA type="linear" slope="0.8" />
                              </feComponentTransfer>
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>
                          <XAxis dataKey="t"
                            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)', fontWeight: 600 }}
                            axisLine={false} tickLine={false}
                            interval="preserveStartEnd"
                            tickCount={5} />
                          <YAxis
                            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)', fontWeight: 600 }}
                            axisLine={false} tickLine={false} width={55}
                            tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : v >= 1 ? `$${v.toFixed(0)}` : `$${v.toFixed(4)}`}
                            domain={['auto', 'auto']} />
                          <Tooltip content={<CoinDetailTooltip />}
                            cursor={{ stroke: coinChartUp ? '#10b981' : '#ef4444', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.4 }} />
                          <Area
                            type="monotone" dataKey="v"
                            stroke={coinChartUp ? '#10b981' : '#ef4444'}
                            strokeWidth={2}
                            fill={coinChartUp ? 'url(#coinGradUp)' : 'url(#coinGradDown)'}
                            dot={false}
                            activeDot={{ r: 4, fill: coinChartUp ? '#10b981' : '#ef4444', stroke: 'rgba(0,0,0,0.5)', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Portfolio Performance Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-3xl p-5"
        style={{ background: 'rgba(8,12,24,0.8)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold">Portfolio Performance</p>
              {!loading && chartData.length >= 2 && (
                <p className={`text-[10px] mt-0.5 font-mono font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isUp ? '+' : ''}{plPct}% all time
                </p>
              )}
            </div>
          </div>
          {!loading && chartData.length >= 2 && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {PORTFOLIO_PERIODS.map(({ label }, i) => (
                <button key={label} onClick={() => setPortfolioPeriod(i)}
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                  style={{
                    background: i === portfolioPeriod ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: i === portfolioPeriod ? 'white' : 'rgba(255,255,255,0.4)',
                    border: i === portfolioPeriod ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-52 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
        ) : isNewUser || chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-52 gap-4">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <Zap className="w-7 h-7 text-emerald-400/40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground/70 mb-1">Your performance chart appears here</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs">Make your first deposit to start tracking your portfolio growth over time</p>
            </div>
            <Link to="/transactions"
              className="text-xs font-bold text-emerald-400 px-5 py-2.5 rounded-xl transition-all hover:bg-emerald-500/10"
              style={{ border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)' }}>
              Make a deposit →
            </Link>
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="perfGradUp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="60%" stopColor="#10b981" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="perfGradDown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="60%" stopColor="#ef4444" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)', fontWeight: 600 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                <Tooltip content={<PortfolioTooltip />}
                  cursor={{ stroke: isUp ? '#10b981' : '#ef4444', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.4 }} />
                <Area type="monotone" dataKey="v" stroke={isUp ? '#10b981' : '#ef4444'} strokeWidth={2}
                  fill={isUp ? 'url(#perfGradUp)' : 'url(#perfGradDown)'} dot={false}
                  activeDot={{ r: 4, fill: isUp ? '#10b981' : '#ef4444', stroke: 'rgba(0,0,0,0.4)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Portfolio Allocation + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Allocation */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="rounded-3xl p-5"
          style={{ background: 'rgba(8,12,24,0.8)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)' }}>
          <p className="text-sm font-bold mb-4">Allocation</p>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}
            </div>
          ) : portfolioWithPrices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Sparkles className="w-8 h-8 text-muted-foreground/20" />
              <div className="text-center">
                <p className="text-xs font-medium text-muted-foreground/60">No holdings yet</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">Trade to build your portfolio</p>
              </div>
              <Link to="/trade" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">Trade now →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground/60 font-mono mb-3">
                ${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} total value
              </p>
              {portfolioWithPrices.map((p) => {
                const pct = totalPortfolioValue > 0 ? (p.currentValue / totalPortfolioValue) * 100 : 0;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                        <span className="text-xs font-bold">{p.crypto_symbol}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{p.amount.toFixed(4)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold">${p.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        className="h-full rounded-full"
                        style={{ background: p.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent Transactions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-3xl p-5"
          style={{ background: 'rgba(8,12,24,0.8)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold">Recent Transactions</p>
            <Link to="/transactions" className="text-xs text-muted-foreground hover:text-white flex items-center gap-0.5 font-semibold transition-colors">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}
            </div>
          ) : txns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Sparkles className="w-5 h-5 text-muted-foreground/20" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-muted-foreground/60">No transactions yet</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">Deposit funds to get started</p>
              </div>
              <Link to="/transactions"
                className="text-xs font-bold text-emerald-400 px-4 py-2 rounded-xl transition-all"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                Make your first deposit
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {txns.map((tx, idx) => {
                const isIn = ['deposit', 'sell', 'copy_profit'].includes(tx.type);
                return (
                  <motion.div key={tx.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all cursor-default group"
                    style={{ border: '1px solid transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)', e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)') }
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.borderColor = 'transparent')}>
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: isIn ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isIn ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                      {isIn ? <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold capitalize">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-muted-foreground/60">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-mono font-bold tabular-nums ${isIn ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isIn ? '+' : '-'}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className={`text-[10px] font-bold capitalize ${
                        tx.status === 'completed' || tx.status === 'approved' ? 'text-emerald-400/70'
                        : tx.status === 'rejected' ? 'text-red-400/70' : 'text-yellow-400/70'
                      }`}>{tx.status}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
