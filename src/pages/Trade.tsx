import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { OutletContext } from '@/lib/auth';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpDown, Search, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { fetchChart, fetchMarkets, type ChartPoint } from '@/lib/marketData';
import PageHeader from '@/components/ui/PageHeader';
import { CoinIcon, getCoinColor } from '@/components/ui/CryptoRow';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PERIODS: { label: string; days: number | string }[] = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
];

function TradeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-muted-foreground mb-0.5">{label}</p>}
      <p className="font-mono font-bold text-primary">
        ${Number(payload[0].value).toLocaleString(undefined, {
          minimumFractionDigits: payload[0].value > 1 ? 2 : 4,
          maximumFractionDigits: payload[0].value > 1 ? 2 : 6,
        })}
      </p>
    </div>
  );
}

export default function Trade() {
  const { user } = useOutletContext<OutletContext>();
  const [cryptos, setCryptos] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(0);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!user?.email) return;
    Promise.all([
      api.cryptos.active(),
      api.balances.getByEmail(user.email),
      api.portfolio.getByEmail(user.email),
    ]).then(([cry, bal, port]) => {
      setCryptos(cry);
      if (cry.length > 0) setSelected((prev: any) => prev ?? cry[0]);
      setBalance(bal || { balance_usd: 0 });
      setPortfolio(port);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setChartLoading(true);
    const { days } = PERIODS[period];
    fetchChart(selected.symbol, days)
      .then(data => {
        if (!cancelled) {
          setChartData(data);
          setChartLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => { cancelled = true; };
  }, [selected?.symbol, period]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetchMarkets([selected.symbol])
      .then(coins => {
        if (!cancelled && coins.length > 0) setLivePrice(coins[0].price);
      })
      .catch(() => {});
    const id = setInterval(() => {
      fetchMarkets([selected.symbol])
        .then(coins => { if (!cancelled && coins.length > 0) setLivePrice(coins[0].price); })
        .catch(() => {});
    }, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selected?.symbol]);

  const filtered = cryptos.filter(c =>
    c.symbol.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const displayPrice = livePrice ?? selected?.price ?? 0;

  const usdAmt = selected && amount && !isNaN(parseFloat(amount))
    ? side === 'buy' ? parseFloat(amount) : parseFloat(amount) * displayPrice
    : 0;
  const cryptoAmt = selected && amount && !isNaN(parseFloat(amount))
    ? side === 'buy'
      ? displayPrice > 0 ? parseFloat(amount) / displayPrice : 0  // guard divide-by-zero
      : parseFloat(amount)
    : 0;

  const currentHolding = selected
    ? portfolio.find(p => p.crypto_symbol === selected.symbol)
    : null;

  const priceChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].v;
    const last = chartData[chartData.length - 1].v;
    const pct = ((last - first) / first) * 100;
    return { pct, up: pct >= 0 };
  }, [chartData]);

  const coinColor = selected ? getCoinColor(selected.symbol) : '#10b981';

  const handleTrade = async () => {
    if (!user) return;
    if (!selected) { toast.error('Select a cryptocurrency'); return; }
    if (!amount || parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) { toast.error('Enter a valid amount'); return; }
    if (!displayPrice || displayPrice <= 0) { toast.error('Price not loaded yet — please wait a moment.'); return; }
    if (side === 'buy' && usdAmt > (balance?.balance_usd || 0)) { toast.error('Insufficient USD balance'); return; }
    if (side === 'sell' && !currentHolding) { toast.error(`You have no ${selected.symbol} to sell`); return; }
    if (side === 'sell' && cryptoAmt > (currentHolding?.amount || 0)) {
      toast.error(`Insufficient ${selected.symbol} — you have ${currentHolding?.amount?.toFixed(6)}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.transactions.create({
        user_email: user.email,
        type: side,
        amount: usdAmt,
        crypto_symbol: selected.symbol,
        crypto_amount: cryptoAmt,
        status: 'pending',
      });
      toast.success(`${side === 'buy' ? 'Buy' : 'Sell'} order placed successfully!`);
      setAmount('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to place order');
    }
    setSubmitting(false);
  };

  const pcts = [25, 50, 75, 100];

  return (
    <div className="space-y-6">
      <PageHeader user={user} title="Trade" subtitle="Buy & sell cryptocurrencies" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market list */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold">Markets</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-secondary border-border text-sm h-9 pl-8" />
          </div>
          <div className="space-y-0.5 max-h-[480px] overflow-y-auto pr-1">
            {loading ? [1,2,3,4,5].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse mb-1" />) :
              filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No markets found</p>
              ) : filtered.map(c => (
              <button key={c.id} onClick={() => { setSelected(c); setAmount(''); setLivePrice(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${selected?.id === c.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary'}`}>
                <CoinIcon symbol={c.symbol} size={7} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{c.symbol}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{c.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-semibold">${c.price?.toLocaleString(undefined, { maximumFractionDigits: c.price < 1 ? 4 : 2 })}</p>
                  <p className={`text-[10px] font-semibold ${c.change_24h >= 0 ? 'text-up' : 'text-down'}`}>
                    {c.change_24h >= 0 ? '+' : ''}{c.change_24h?.toFixed(2)}%
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chart + trading panel */}
        <div className="lg:col-span-2 space-y-4">
          {selected && (
            <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CoinIcon symbol={selected.symbol} size={10} />
                  <div>
                    <p className="font-bold">{selected.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xl font-mono font-black">
                        ${displayPrice.toLocaleString(undefined, { minimumFractionDigits: displayPrice < 1 ? 4 : 2, maximumFractionDigits: displayPrice < 1 ? 6 : 2 })}
                      </span>
                      {priceChange && (
                        <span className={`text-sm font-semibold ${priceChange.up ? 'text-up' : 'text-down'}`}>
                          {priceChange.up ? '+' : ''}{priceChange.pct.toFixed(2)}%
                        </span>
                      )}
                      {livePrice && (
                        <span className="flex items-center gap-1 text-[10px] text-up font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentHolding && (
                    <div className="text-right mr-2">
                      <p className="text-xs text-muted-foreground">Your balance</p>
                      <p className="text-sm font-mono font-bold">{currentHolding.amount?.toFixed(6)} {selected.symbol}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
                    {PERIODS.map(({ label }, i) => (
                      <button key={label} onClick={() => setPeriod(i)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${i === period ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-48 relative">
                {chartLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Loading chart...
                    </div>
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tradeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={coinColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={coinColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="t"
                        tick={{ fontSize: 9, fill: 'hsl(215,14%,46%)' }}
                        axisLine={false} tickLine={false}
                        interval={Math.floor(chartData.length / 6)}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 9, fill: 'hsl(215,14%,46%)' }}
                        axisLine={false} tickLine={false} width={60}
                        tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : v >= 1 ? `$${v.toFixed(0)}` : `$${v.toFixed(4)}`}
                      />
                      <Tooltip content={<TradeTooltip />} />
                      <Area
                        type="monotone" dataKey="v"
                        stroke={coinColor} strokeWidth={2}
                        fill="url(#tradeGrad)" dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: coinColor }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                    Chart unavailable — check your connection
                  </div>
                )}
              </div>

              {chartData.length > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span>Low: <span className="font-mono text-foreground">${Math.min(...chartData.map(d => d.v)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
                  <span className="text-[10px]">Real data via CoinGecko</span>
                  <span>High: <span className="font-mono text-foreground">${Math.max(...chartData.map(d => d.v)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
                </div>
              )}
            </motion.div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex bg-secondary rounded-xl p-1 mb-5">
              {(['buy', 'sell'] as const).map(s => (
                <button key={s} onClick={() => { setSide(s); setAmount(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${side === s ? (s === 'buy' ? 'gradient-green text-white' : 'bg-destructive text-destructive-foreground') : 'text-muted-foreground hover:text-foreground'}`}>
                  {s === 'buy' ? 'Buy' : 'Sell'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-muted-foreground">
                    {side === 'buy' ? 'Amount (USD)' : `Amount (${selected?.symbol || 'COIN'})`}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {side === 'buy'
                      ? `Available: $${(balance?.balance_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : currentHolding
                        ? `Have: ${currentHolding.amount?.toFixed(6)} ${selected?.symbol}`
                        : `No ${selected?.symbol || ''} held`}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">
                    {side === 'buy' ? '$' : selected?.symbol?.slice(0, 3) || ''}
                  </span>
                  <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                    className="bg-secondary border-border pl-10 font-mono text-base h-12" min="0" step="any" />
                </div>
                {side === 'buy' && balance && balance.balance_usd > 0 && (
                  <div className="flex gap-2 mt-2">
                    {pcts.map(p => (
                      <button key={p} onClick={() => setAmount(((balance.balance_usd * p) / 100).toFixed(2))}
                        className="flex-1 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        {p}%
                      </button>
                    ))}
                  </div>
                )}
                {side === 'sell' && currentHolding && currentHolding.amount > 0 && (
                  <div className="flex gap-2 mt-2">
                    {pcts.map(p => (
                      <button key={p} onClick={() => setAmount(((currentHolding.amount * p) / 100).toFixed(6))}
                        className="flex-1 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        {p}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {amount && parseFloat(amount) > 0 && selected && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">You {side === 'buy' ? 'receive' : 'pay'}</p>
                    <p className="font-mono font-bold">
                      {side === 'buy'
                        ? `${cryptoAmt.toFixed(6)} ${selected.symbol}`
                        : `$${usdAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </p>
                  </div>
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-0.5">At price</p>
                    <p className="font-mono text-sm font-semibold">
                      ${displayPrice.toLocaleString(undefined, { minimumFractionDigits: displayPrice < 1 ? 4 : 2 })}
                    </p>
                  </div>
                </div>
              )}

              <Button onClick={handleTrade} disabled={submitting || !selected || !amount || !parseFloat(amount)}
                className={`w-full h-12 text-sm font-bold rounded-xl ${side === 'buy' ? 'gradient-green text-white glow-green-sm' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}`}>
                {submitting ? 'Placing order...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${selected?.symbol || ''}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
