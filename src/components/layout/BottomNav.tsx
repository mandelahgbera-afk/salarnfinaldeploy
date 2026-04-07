import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, ArrowLeftRight,
  Users, History, Shield, TrendingUp, SlidersHorizontal, Coins
} from 'lucide-react';

const userTabs = [
  { path: '/dashboard',    label: 'Home',    icon: LayoutDashboard },
  { path: '/portfolio',    label: 'Portfolio', icon: BarChart3 },
  { path: '/trade',        label: 'Trade',   icon: ArrowLeftRight },
  { path: '/copy-trading', label: 'Copy',    icon: TrendingUp },
  { path: '/transactions', label: 'Txns',    icon: History },
];

const adminTabs = [
  { path: '/admin',              label: 'Overview', icon: Shield },
  { path: '/admin/users',        label: 'Users',    icon: Users },
  { path: '/admin/transactions', label: 'Txns',     icon: History },
  { path: '/admin/traders',      label: 'Traders',  icon: TrendingUp },
  { path: '/admin/settings',     label: 'Settings', icon: SlidersHorizontal },
];

export default function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const location = useLocation();
  const tabs = isAdmin ? adminTabs : userTabs;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[hsl(222,28%,4%)]/98 backdrop-blur-xl border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch h-[58px]">
        {tabs.map(({ path, label, icon: Icon }) => {
          const active =
            location.pathname === path ||
            (path !== '/dashboard' && path !== '/admin' && location.pathname.startsWith(path)) ||
            (path === '/admin' && location.pathname === '/admin');

          return (
            <Link
              key={path}
              to={path}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                active ? 'text-primary' : 'text-muted-foreground/70'
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-[20%] h-[2px] rounded-full bg-primary" />
              )}
              <Icon className={`w-[19px] h-[19px] transition-all duration-150 ${active ? 'scale-110' : ''}`} />
              <span className={`text-[9px] font-bold tracking-wide transition-colors ${active ? 'text-primary' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
