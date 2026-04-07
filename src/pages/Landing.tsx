import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, Shield, Zap, ArrowRight,
  Users, BarChart3, Lock, Globe, Star, CheckCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchTopMarkets, type CoinMarket } from '@/lib/marketData';

const STATS = [
  { value: '$2.4B+', label: 'Trading Volume' },
  { value: '48,000+', label: 'Active Traders' },
  { value: '99.8%', label: 'Platform Uptime' },
  { value: '120+', label: 'Cryptocurrencies' },
];

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Copy Top Traders',
    desc: 'Mirror the strategies of verified expert traders automatically. Set your allocation and let the pros trade for you — hands free.',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/15',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Portfolio',
    desc: 'Track all your holdings, profit & loss, and performance in one powerful dashboard with live market data and beautiful charts.',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/15',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
  },
  {
    icon: Shield,
    title: 'Bank-Level Security',
    desc: 'Advanced encryption, OTP withdrawal confirmation, and cold storage ensure your assets are always protected.',
    gradient: 'from-purple-500/20 to-pink-500/10',
    border: 'border-purple-500/15',
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-400',
  },
  {
    icon: Zap,
    title: 'Lightning Execution',
    desc: 'Ultra-fast trade execution across 120+ crypto pairs. Buy, sell, and copy — all in seconds with minimal slippage.',
    gradient: 'from-yellow-500/20 to-orange-500/10',
    border: 'border-yellow-500/15',
    iconBg: 'bg-yellow-500/15',
    iconColor: 'text-yellow-400',
  },
  {
    icon: Globe,
    title: 'Global Markets 24/7',
    desc: 'Access Bitcoin, Ethereum, Solana, and 120+ cryptocurrencies across multiple networks — available around the clock, worldwide.',
    gradient: 'from-rose-500/20 to-red-500/10',
    border: 'border-rose-500/15',
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
  },
  {
    icon: Lock,
    title: 'Transparent & Compliant',
    desc: 'KYC/AML compliant with transparent fee structures, zero hidden charges, and a clear OTP-secured withdrawal process.',
    gradient: 'from-indigo-500/20 to-violet-500/10',
    border: 'border-indigo-500/15',
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
  },
];

const TRADERS = [
  { name: 'Alex Chen', specialty: 'DeFi Expert', profit: '+248%', winRate: '78%', color: '#10b981' },
  { name: 'Sarah Kim', specialty: 'BTC Maxi', profit: '+184%', winRate: '82%', color: '#3b82f6' },
  { name: 'Marcus O.', specialty: 'Alt Season', profit: '+312%', winRate: '71%', color: '#a855f7' },
];

const TICKER_ITEMS = [
  { sym: 'BTC', price: '$67,420', change: '+3.14%', up: true },
  { sym: 'ETH', price: '$3,892', change: '+2.87%', up: true },
  { sym: 'SOL', price: '$178.50', change: '+5.23%', up: true },
  { sym: 'BNB', price: '$612', change: '-0.82%', up: false },
  { sym: 'DOGE', price: '$0.0412', change: '+8.91%', up: true },
  { sym: 'ADA', price: '$0.622', change: '-1.44%', up: false },
  { sym: 'AVAX', price: '$39.80', change: '+4.12%', up: true },
  { sym: 'DOT', price: '$8.90', change: '+1.77%', up: true },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Create your free account', desc: 'Sign up in under 60 seconds. No credit card needed.' },
  { step: '02', title: 'Fund your wallet', desc: 'Deposit crypto in BTC, ETH, USDT and more. Fast and secure.' },
  { step: '03', title: 'Copy top traders', desc: 'Browse verified expert traders and allocate funds to copy them.' },
  { step: '04', title: 'Watch your portfolio grow', desc: 'Track every trade, profit, and return in real time on your dashboard.' },
];

const TESTIMONIALS = [
  {
    name: 'James R.',
    role: 'Retail Investor',
    text: 'I\'ve tried multiple platforms but Salarn\'s copy trading is on another level. +67% portfolio growth in 4 months.',
    rating: 5,
    avatar: 'JR',
    color: '#10b981',
  },
  {
    name: 'Priya S.',
    role: 'First-time Crypto User',
    text: 'The dashboard is incredibly clean. I could immediately see my portfolio breakdown and track every transaction in real time.',
    rating: 5,
    avatar: 'PS',
    color: '#3b82f6',
  },
  {
    name: 'David K.',
    role: 'Day Trader',
    text: 'The OTP withdrawal security gives me peace of mind. No other platform does this level of protection.',
    rating: 5,
    avatar: 'DK',
    color: '#a855f7',
  },
];

export default function Landing() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [liveCoins, setLiveCoins] = useState<CoinMarket[]>([]);

  useEffect(() => {
    if (!isLoading && user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    fetchTopMarkets(20).then(setLiveCoins).catch(() => {});
    const id = setInterval(() => fetchTopMarkets(20).then(setLiveCoins).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, []);

  const tickerItems = liveCoins.length > 0 ? liveCoins : TICKER_ITEMS.map(t => ({
    id: t.sym, symbol: t.sym, name: t.sym,
    price: parseFloat(t.price.replace(/[^0-9.]/g, '')),
    change_24h: parseFloat(t.change),
    market_cap: 0, volume_24h: 0, image: '',
  }));
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl gradient-green flex items-center justify-center glow-green-sm" aria-hidden="true">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight">Salarn</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#traders" className="hover:text-foreground transition-colors">Top Traders</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Sign In
            </Link>
            <Link to="/auth"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-green text-white text-sm font-bold glow-green-sm hover:opacity-90 transition-all">
              Get Started
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Live Ticker */}
      <div className="overflow-hidden border-b border-border/30 bg-card/30 py-2.5" aria-label="Live cryptocurrency prices">
        <div className="flex gap-8 whitespace-nowrap" style={{ animation: 'ticker 40s linear infinite', width: 'max-content' }}>
          {doubled.map((item, i) => {
            const up = (item as any).change_24h !== undefined ? (item as any).change_24h >= 0 : (item as any).up;
            const price = (item as any).price !== undefined
              ? (item as any).price >= 1
                ? `$${Number((item as any).price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : `$${Number((item as any).price).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`
              : (item as any).price;
            const change = (item as any).change_24h !== undefined
              ? `${(item as any).change_24h >= 0 ? '+' : ''}${Number((item as any).change_24h).toFixed(2)}%`
              : (item as any).change;
            return (
              <div key={i} className="flex items-center gap-2 text-xs flex-shrink-0">
                <span className="font-bold text-foreground">{(item as any).symbol || (item as any).sym}</span>
                <span className="font-mono text-muted-foreground">{price}</span>
                <span className={`font-semibold ${up ? 'text-up' : 'text-down'}`}>{change}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 px-4 sm:px-6 lg:px-8 text-center" aria-label="Hero section">
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px]" />
          <div className="absolute top-20 left-1/4 w-64 h-64 rounded-full bg-blue-500/5 blur-[80px]" />
          <div className="absolute top-20 right-1/4 w-64 h-64 rounded-full bg-purple-500/5 blur-[80px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-primary/8 text-primary text-xs font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            48,000+ traders already earning on Salarn
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight mb-6 leading-[1.05]">
            Copy the World's
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Best Crypto Traders</span>
            <br />
            Automatically
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Salarn lets you mirror top-performing traders in real time. No experience needed —
            just set your allocation and watch your portfolio grow.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link to="/auth"
              className="group flex items-center gap-2 px-8 py-4 rounded-2xl gradient-green text-white font-bold text-base glow-green hover:opacity-90 transition-all w-full sm:w-auto justify-center"
              aria-label="Create your free Salarn account">
              Start Trading Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Link>
            <a href="#how-it-works"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-border bg-secondary text-foreground font-bold text-base hover:bg-secondary/80 transition-all w-full sm:w-auto justify-center">
              See How It Works
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground flex-wrap">
            {['No credit card required', 'Free to get started', 'Secure & encrypted', 'Cancel anytime'].map((t, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                {t}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="relative max-w-3xl mx-auto mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4"
          aria-label="Platform statistics"
        >
          {STATS.map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl px-5 py-4 text-center">
              <p className="text-2xl lg:text-3xl font-black text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">Platform Features</p>
            <h2 id="features-heading" className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              Everything You Need to Trade Smarter
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Professional-grade tools once reserved for institutional investors — now accessible to everyone on Salarn.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.article
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className={`bg-gradient-to-br ${f.gradient} border ${f.border} rounded-2xl p-6`}
              >
                <div className={`w-11 h-11 rounded-2xl ${f.iconBg} flex items-center justify-center mb-4`} aria-hidden="true">
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-card/30" aria-labelledby="how-heading">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">Getting Started</p>
            <h2 id="how-heading" className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              Start Earning in 4 Simple Steps
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From account creation to your first copy trade — it takes less than 5 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative bg-card border border-border rounded-2xl p-6"
              >
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -right-3 w-6 h-px bg-border" aria-hidden="true" />
                )}
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4" aria-hidden="true">
                  <span className="text-sm font-black text-primary">{step.step}</span>
                </div>
                <h3 className="font-bold text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Traders */}
      <section id="traders" className="py-24 px-4 sm:px-6 lg:px-8" aria-labelledby="traders-heading">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">Top Performers</p>
            <h2 id="traders-heading" className="text-3xl sm:text-4xl font-black mb-4">
              Verified Expert Traders You Can Copy
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Every trader on Salarn is verified and their track record is fully transparent.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TRADERS.map((trader, i) => (
              <motion.article
                key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                    style={{ background: trader.color }}
                    aria-hidden="true"
                  >
                    {trader.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{trader.name}</p>
                    <p className="text-xs text-muted-foreground">{trader.specialty}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-secondary rounded-xl px-3 py-2.5 text-center">
                    <p className="text-lg font-black text-up">{trader.profit}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Total Return</p>
                  </div>
                  <div className="bg-secondary rounded-xl px-3 py-2.5 text-center">
                    <p className="text-lg font-black">{trader.winRate}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Win Rate</p>
                  </div>
                </div>

                <Link to="/auth" className="block w-full text-center py-2.5 rounded-xl gradient-green text-white text-sm font-bold hover:opacity-90 transition-all glow-green-sm">
                  Copy This Trader
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-card/30" aria-labelledby="testimonials-heading">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">User Reviews</p>
            <h2 id="testimonials-heading" className="text-3xl sm:text-4xl font-black mb-4">
              Trusted by Thousands of Traders Worldwide
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.article
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex gap-0.5 mb-4" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: t.color }}
                    aria-hidden="true"
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8" aria-label="Sign up call to action">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-3xl p-12"
          >
            <div className="w-14 h-14 rounded-2xl gradient-green flex items-center justify-center glow-green mx-auto mb-6" aria-hidden="true">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              Ready to Start Earning?
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Join 48,000+ traders already growing their wealth with Salarn. Create your free account in 60 seconds.
            </p>
            <Link to="/auth"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl gradient-green text-white font-bold text-lg glow-green hover:opacity-90 transition-all">
              Create Free Account
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </Link>
            <p className="text-muted-foreground/70 text-sm mt-6">No credit card required — free to get started</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-4 sm:px-6 lg:px-8" aria-label="Site footer">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl gradient-green flex items-center justify-center" aria-hidden="true">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-black text-base">Salarn</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              &copy; {new Date().getFullYear()} Salarn. All rights reserved.{' '}
              <span className="text-muted-foreground/60">Crypto trading involves substantial risk of loss.</span>
            </p>
            <nav className="flex items-center gap-5 text-xs text-muted-foreground" aria-label="Footer links">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </nav>
          </div>
          <div className="border-t border-border/30 pt-6 text-center">
            <p className="text-xs text-muted-foreground/50">
              Salarn — Professional crypto copy-trading and investment platform. Trading cryptocurrency involves risk. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .gradient-green {
          background: linear-gradient(135deg, hsl(142 71% 45%), hsl(160 80% 40%));
        }
        .glow-green {
          box-shadow: 0 0 20px hsl(142 71% 45% / 0.35);
        }
        .glow-green-sm {
          box-shadow: 0 0 12px hsl(142 71% 45% / 0.25);
        }
        .text-up { color: hsl(142 71% 45%); }
        .text-down { color: hsl(0 72% 51%); }
      `}</style>
    </div>
  );
}
