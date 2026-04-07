import { TrendingUp, TrendingDown } from 'lucide-react';

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', BNB: '#F3BA2F', SOL: '#9945FF',
  DOGE: '#C2A633', ADA: '#0033AD', XRP: '#00AAE4', AVAX: '#E84142',
  MATIC: '#8247E5', DOT: '#E6007A', LINK: '#2A5ADA', LTC: '#BFBBBB',
  UNI: '#FF007A', ATOM: '#2E3148', NEAR: '#00C1DE', FTM: '#1969FF',
  USDT: '#26A17B', USDC: '#2775CA',
};

export function getCoinColor(symbol: string) {
  return COIN_COLORS[symbol?.toUpperCase()] || '#6366f1';
}

export function CoinIcon({ symbol, size = 8 }: { symbol: string; size?: number }) {
  const color = getCoinColor(symbol);
  const px = size * 4;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ backgroundColor: color, width: px, height: px, fontSize: size <= 8 ? '10px' : '12px' }}
    >
      {symbol?.slice(0, 2)}
    </div>
  );
}

interface Crypto {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change_24h: number;
}

export default function CryptoRow({ crypto, onClick }: { crypto: Crypto; onClick?: () => void }) {
  const isPos = crypto.change_24h >= 0;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer group"
    >
      <CoinIcon symbol={crypto.symbol} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{crypto.symbol}</p>
        <p className="text-xs text-muted-foreground truncate">{crypto.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-semibold text-foreground">
          ${crypto.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
        </p>
        <div className={`flex items-center justify-end gap-0.5 text-xs font-semibold ${isPos ? 'text-up' : 'text-down'}`}>
          {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPos ? '+' : ''}{crypto.change_24h?.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
