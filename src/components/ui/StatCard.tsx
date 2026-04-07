import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  change?: number;
  icon?: LucideIcon;
  gradient?: string;
  index?: number;
}

export default function StatCard({ title, value, sub, change, icon: Icon, gradient, index = 0 }: StatCardProps) {
  const isPos = (change ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="bg-card border border-border rounded-2xl p-5 hover:border-primary/25 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
          <p className="text-2xl font-bold font-mono text-foreground truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${isPos ? 'text-up' : 'text-down'}`}>
              {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPos ? '+' : ''}{change}%
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${gradient || 'bg-primary/15'}`}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
