import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, X, Search, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { fetchMarkets, COIN_ID_MAP } from '@/lib/marketData';
import PageHeader from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CoinIcon } from '@/components/ui/CryptoRow';
import { toast } from 'sonner';

const EMPTY = { symbol: '', name: '', price: '', change_24h: '', market_cap: '', volume_24h: '', icon_color: '#6366f1', is_active: true };

export default function ManageCryptos() {
  const { user } = useOutletContext<any>();
  const [cryptos, setCryptos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = () => api.cryptos.list().then(c => { setCryptos(c); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const syncMarketData = async () => {
    setSyncing(true);
    try {
      const dbCoins = await api.cryptos.list();
      if (dbCoins.length === 0) {
        toast.error('No cryptocurrencies in database to sync');
        setSyncing(false);
        return;
      }
      const symbols = dbCoins.map((c: any) => c.symbol.toUpperCase());
      const knownSymbols = symbols.filter((s: string) => COIN_ID_MAP[s]);
      if (knownSymbols.length === 0) {
        toast.error('None of your listed coins are in our market data mapping');
        setSyncing(false);
        return;
      }
      const liveData = await fetchMarkets(knownSymbols);
      if (liveData.length === 0) {
        toast.error('Could not fetch market data. CoinGecko may be rate-limiting. Try again in a minute.');
        setSyncing(false);
        return;
      }
      const liveMap = new Map(liveData.map(c => [c.symbol.toUpperCase(), c]));
      let updated = 0;
      for (const dbCoin of dbCoins) {
        const live = liveMap.get(dbCoin.symbol.toUpperCase());
        if (!live) continue;
        await api.cryptos.update(dbCoin.id, {
          price: live.price,
          change_24h: live.change_24h,
          market_cap: live.market_cap,
          volume_24h: live.volume_24h,
        });
        updated++;
      }
      toast.success(`Synced ${updated}/${dbCoins.length} coins with live market data`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    }
    setSyncing(false);
  };

  const filtered = cryptos.filter(c =>
    c.symbol.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.symbol || !form.name || !form.price) { toast.error('Fill required fields'); return; }
    setSubmitting(true);
    try {
      await api.cryptos.create({
        symbol: form.symbol.toUpperCase(),
        name: form.name,
        price: parseFloat(form.price) || 0,
        change_24h: parseFloat(form.change_24h) || 0,
        market_cap: parseFloat(form.market_cap) || 0,
        volume_24h: parseFloat(form.volume_24h) || 0,
        icon_color: form.icon_color,
        is_active: form.is_active,
      });
      toast.success('Cryptocurrency added!');
      setModal(false); setForm({ ...EMPTY }); load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add');
    }
    setSubmitting(false);
  };

  const toggleActive = async (c: any) => {
    try {
      await api.cryptos.update(c.id, { is_active: !c.is_active });
      toast.success(`${c.symbol} ${c.is_active ? 'disabled' : 'enabled'}`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const deleteCrypto = async (c: any) => {
    try {
      await api.cryptos.delete(c.id);
      toast.success(`${c.symbol} deleted`);
      setConfirmDeleteId(null);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader user={user} title="Manage Cryptocurrencies" subtitle={`${cryptos.length} coins listed`} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="pl-9 bg-secondary border-border" />
        </div>
        <Button onClick={syncMarketData} disabled={syncing} variant="outline" className="border-border hover:bg-secondary font-semibold">
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Market Prices'}
        </Button>
        <Button onClick={() => setModal(true)} className="gradient-green text-white font-semibold glow-green-sm">
          <Plus className="w-4 h-4 mr-2" /> Add Crypto
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 text-xs text-muted-foreground px-5 py-3 border-b border-border/60 font-medium">
          <span className="col-span-2">Asset</span>
          <span>Price</span>
          <span>24h Change</span>
          <span>Status</span>
        </div>
        {loading ? (
          <div className="space-y-px">{[1,2,3,4].map(i => <div key={i} className="h-14 shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No cryptocurrencies found</div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(c => (
              <div key={c.id} className="grid grid-cols-1 sm:grid-cols-5 items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3 col-span-2">
                  <CoinIcon symbol={c.symbol} size={8} />
                  <div>
                    <p className="text-sm font-bold">{c.symbol}</p>
                    <p className="text-xs text-muted-foreground">{c.name}</p>
                  </div>
                </div>
                <p className="text-sm font-mono font-semibold">${c.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <div className={`flex items-center gap-1 text-xs font-semibold ${c.change_24h >= 0 ? 'text-up' : 'text-down'}`}>
                  {c.change_24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {c.change_24h >= 0 ? '+' : ''}{c.change_24h?.toFixed(2)}%
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(c)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${c.is_active ? 'bg-up text-up' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </button>
                  {confirmDeleteId === c.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteCrypto(c)}
                        className="px-2 py-1 rounded-lg bg-destructive/15 text-destructive text-xs font-semibold hover:bg-destructive/25 transition-colors">
                        Delete
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs hover:text-foreground transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(c.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Add Cryptocurrency</h3>
              <button onClick={() => { setModal(false); setForm({ ...EMPTY }); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Symbol *', key: 'symbol', placeholder: 'BTC' },
                { label: 'Name *', key: 'name', placeholder: 'Bitcoin' },
                { label: 'Price (USD) *', key: 'price', placeholder: '45000', type: 'number' },
                { label: '24h Change (%)', key: 'change_24h', placeholder: '2.5', type: 'number' },
                { label: 'Market Cap', key: 'market_cap', placeholder: '800000000000', type: 'number' },
                { label: '24h Volume', key: 'volume_24h', placeholder: '25000000000', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                  <Input type={f.type || 'text'} placeholder={f.placeholder} value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="bg-secondary border-border text-sm" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
              <label htmlFor="active" className="text-sm font-medium cursor-pointer">Active (visible to users)</label>
            </div>
            <div className="flex gap-3 mt-5">
              <Button onClick={handleSave} disabled={submitting} className="flex-1 gradient-green text-white font-bold">
                {submitting ? 'Adding...' : 'Add Crypto'}
              </Button>
              <Button variant="outline" onClick={() => { setModal(false); setForm({ ...EMPTY }); }}
                className="border-border hover:bg-secondary">Cancel</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
