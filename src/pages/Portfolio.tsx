import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { OutletContext } from '@/lib/auth';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { CoinIcon } from '@/components/ui/CryptoRow';

const PIE_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

function PnlTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const isPos = v >= 0;
  return (
    <div className="rounded-2xl px-4 py-3 border border-white/10 shadow-2xl"
      style={{ background: 'rgba(10,15,30,0.95)', backdropFilter: 'blur(16px)' }}>
      <p className="text-[10px] text-muted-foreground mb-1">{payload[0].payload.name}</p>
      <p className={`font-mono font-black text-sm ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPos ? '+' : ''}${Math.abs(v).toFixed(2)}
      </p>
    </div>
  );
}

export default function Portfolio() {
  const { user } = useOutletContext<OutletContext>();
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [cryptos, setCryptos] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    Promise.all([
      api.portfolio.getByEmail(user.email),
      api.cryptos.active(),
      api.balances.getByEmail(user.email),
    ]).then(([port, cry, bal]) => {
      setPortfolio(port);
      setCryptos(cry);
      setBalance(bal);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.email]);

  const enriched = portfolio.map((p, i) => {
    const crypto = cryptos.find(c => c.symbol === p.crypto_symbol);
    const price = crypto?.price || 0;
    const change = crypto?.change_24h || 0;
    const currentValue = price * p.amount;
    const invested = p.avg_buy_price * p.amount;
    const pnl = currentValue - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    return { ...p, price, change, currentValue, invested, pnl, pnlPct, color: PIE_COLORS[i % PIE_COLORS.length] };
  });

  const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
  const totalInvested = enriched.reduce((s, p) => s + p.invested, 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const isUp = totalPnl >= 0;

  const pieData = enriched.map(p => ({ name: p.crypto_symbol, value: p.currentValue }));
  const barData = enriched.map(p => ({ name: p.crypto_symbol, pnl: p.pnl, color: p.pnl >= 0 ? '#10b981' : '#ef4444' }));

  const stats = [
    { label: 'Total Value', value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, mono: true },
    { label: 'Total Invested', value: `$${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, mono: true },
    { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`, sub: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`, up: totalPnl >= 0, mono: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader user={user} title="Portfolio" subtitle="Your crypto holdings" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-card border border-border rounded-2xl p-5"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-2xl font-black font-mono ${'up' in s && s.up !== undefined ? (s.up ? 'text-emerald-400' : 'text-red-400') : ''}`}>{s.value}</p>
            {s.sub && <p className={`text-xs mt-1 font-semibold ${'up' in s && s.up !== undefined ? (s.up ? 'text-emerald-400' : 'text-red-400') : 'text-muted-foreground'}`}>{s.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Donut Chart */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-bold mb-1">Allocation</p>
          {!loading && enriched.length > 0 && (
            <p className="text-xs text-muted-foreground mb-3 font-mono">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} total</p>
          )}
          {loading ? (
            <div className="h-52 shimmer rounded-xl" />
          ) : enriched.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <Sparkles className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No holdings yet</p>
            </div>
          ) : (
            <>
              <div className="h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {PIE_COLORS.map((color, i) => (
                        <radialGradient key={i} id={`portPieGrad${i}`} cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor={color} stopOpacity={1} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                        </radialGradient>
                      ))}
                    </defs>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={76}
                      strokeWidth={2}
                      stroke="hsl(222,40%,10%)"
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={`url(#portPieGrad${i % PIE_COLORS.length})`} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [`$${Number(v).toFixed(2)}`, '']}
                      contentStyle={{
                        background: 'rgba(10,15,30,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                      }}
                      labelStyle={{ display: 'none' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Holdings</p>
                    <p className="text-2xl font-black">{enriched.length}</p>
                    <p className={`text-[10px] font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? '+' : ''}{totalPnlPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                {enriched.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-black/30" style={{ background: p.color }} />
                    <span className="text-xs text-muted-foreground flex-1 font-medium">{p.crypto_symbol}</span>
                    <span className="text-xs font-mono font-bold">{totalValue > 0 ? ((p.currentValue / totalValue) * 100).toFixed(1) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Holdings Table + P&L Bar */}
        <div className="lg:col-span-2 space-y-5">

          {/* P&L Bar Chart */}
          {!loading && barData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm font-bold mb-4">P&L by Asset</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,14%,42%)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(215,14%,42%)', fontWeight: 500 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `$${v}`} />
                    <Tooltip content={<PnlTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Holdings Table */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-bold mb-4">Holdings</p>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>
            ) : enriched.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No holdings. Start trading to build your portfolio.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left pb-3 font-semibold">Asset</th>
                      <th className="text-right pb-3 font-semibold">Amount</th>
                      <th className="text-right pb-3 font-semibold">Price</th>
                      <th className="text-right pb-3 font-semibold">Value</th>
                      <th className="text-right pb-3 font-semibold">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {enriched.map(p => (
                      <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-2.5">
                            <CoinIcon symbol={p.crypto_symbol} size={7} />
                            <div>
                              <p className="font-bold">{p.crypto_symbol}</p>
                              <p className={`text-xs font-semibold ${p.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {p.change >= 0 ? '+' : ''}{p.change?.toFixed(2)}% 24h
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 text-right font-mono text-muted-foreground">{p.amount}</td>
                        <td className="py-3.5 text-right font-mono font-semibold">${p.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="py-3.5 text-right font-mono font-bold">${p.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3.5 text-right">
                          <div className={`inline-flex flex-col items-end px-2 py-1 rounded-xl ${p.pnl >= 0 ? 'bg-emerald-500/8' : 'bg-red-500/8'}`}>
                            <div className="flex items-center gap-1">
                              {p.pnl >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                              <p className={`font-mono font-black text-xs ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {p.pnl >= 0 ? '+' : ''}${Math.abs(p.pnl).toFixed(2)}
                              </p>
                            </div>
                            <p className={`text-[10px] font-bold ${p.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
