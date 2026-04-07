import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, BarChart3, ArrowLeftRight,
  Users, History, Settings, Shield, Coins,
  TrendingUp, LogOut, ChevronLeft, ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const userNav = [
  { path: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/portfolio',    label: 'Portfolio',     icon: BarChart3 },
  { path: '/trade',        label: 'Trade',         icon: ArrowLeftRight },
  { path: '/copy-trading', label: 'Copy Trading',  icon: Users },
  { path: '/transactions', label: 'Transactions',  icon: History },
  { path: '/settings',     label: 'Settings',      icon: Settings },
];

const adminNav = [
  { path: '/admin',              label: 'Overview',          icon: Shield },
  { path: '/admin/users',        label: 'Users',             icon: Users },
  { path: '/admin/cryptos',      label: 'Cryptos',           icon: Coins },
  { path: '/admin/traders',      label: 'Copy Traders',      icon: TrendingUp },
  { path: '/admin/transactions', label: 'Transactions',      icon: History },
  { path: '/admin/settings',     label: 'Platform Settings', icon: SlidersHorizontal },
];

interface SidebarProps {
  user: { full_name?: string | null; email: string; role: string } | null;
  isAdmin: boolean;
}

export default function Sidebar({ user, isAdmin }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const links = isAdmin ? adminNav : userNav;

  const handleLogout = async () => {
    await signOut();
    toast.success('Signed out');
    navigate('/');
  };

  return (
    <aside
      className={`hidden lg:flex flex-col bg-[hsl(222,28%,4%)] border-r border-border/60 transition-[width] duration-200 h-screen sticky top-0 flex-shrink-0 ${
        collapsed ? 'w-[64px]' : 'w-[230px]'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-border/40 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-xl gradient-green flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        {!collapsed && <span className="font-black text-base tracking-tight">Salarn</span>}
      </div>

      {/* User info */}
      {user && !collapsed && (
        <div className="px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
              {(user.full_name || user.email)?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{user.full_name || user.email}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                user.role === 'admin' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-primary/15 text-primary'
              }`}>
                {user.role}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {links.map((link) => {
          const active =
            location.pathname === link.path ||
            (link.path !== '/dashboard' && link.path !== '/admin' && location.pathname.startsWith(link.path)) ||
            (link.path === '/admin' && location.pathname === '/admin');
          const Icon = link.icon;
          return (
            <Link
              key={link.path}
              to={link.path}
              title={collapsed ? link.label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors duration-100 group ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {active && (
                <motion.div
                  layoutId={`activeNav-${isAdmin ? 'admin' : 'user'}`}
                  className="absolute inset-0 bg-primary/10 rounded-2xl border border-primary/20"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className={`relative w-[17px] h-[17px] flex-shrink-0 ${active ? 'text-primary' : 'group-hover:text-foreground'}`} />
              {!collapsed && <span className="relative truncate text-[13px]">{link.label}</span>}
              {active && !collapsed && <span className="relative ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="px-2 pb-2 pt-2 space-y-0.5 border-t border-border/40">
        {user?.role === 'admin' && !isAdmin && (
          <Link to="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-2xl text-xs text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            title={collapsed ? 'Admin Panel' : undefined}>
            <Shield className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </Link>
        )}
        {isAdmin && (
          <Link to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-2xl text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title={collapsed ? 'User View' : undefined}>
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>User View</span>}
          </Link>
        )}
        <button onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="px-2 pb-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
