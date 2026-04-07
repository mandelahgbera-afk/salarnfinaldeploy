import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { OutletContext } from '@/lib/auth';
import { motion } from 'framer-motion';
import {
  Shield, Bell, Palette, LogOut, Eye, EyeOff, Wallet,
  CheckCircle, XCircle, Clock, ArrowDownLeft, ArrowUpRight,
  TrendingUp, ArrowLeftRight, KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';

type Tab = 'profile' | 'wallet' | 'notifications' | 'security';

const TABS = [
  { id: 'profile' as Tab, icon: Palette, label: 'Profile' },
  { id: 'wallet' as Tab, icon: Wallet, label: 'Wallet Address' },
  { id: 'notifications' as Tab, icon: Bell, label: 'Notifications' },
  { id: 'security' as Tab, icon: Shield, label: 'Security' },
];

interface NotifItem {
  id: string;
  title: string;
  description: string;
  time: string;
  kind: 'success' | 'error' | 'warning' | 'info';
  icon: React.FC<any>;
}

function buildNotifications(txns: any[]): NotifItem[] {
  const items: NotifItem[] = [];

  for (const tx of txns) {
    const amt = `$${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const time = new Date(tx.updated_at || tx.created_at).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    if (tx.type === 'deposit') {
      if (tx.status === 'completed' || tx.status === 'approved') {
        items.push({ id: tx.id + '-n', title: 'Deposit Successful', description: `${amt} has been credited to your account.`, time, kind: 'success', icon: ArrowDownLeft });
      } else if (tx.status === 'rejected') {
        items.push({ id: tx.id + '-n', title: 'Deposit Rejected', description: `Your deposit of ${amt} was rejected. Contact support for details.`, time, kind: 'error', icon: XCircle });
      } else if (tx.status === 'pending') {
        items.push({ id: tx.id + '-n', title: 'Deposit Pending', description: `${amt} deposit is awaiting admin review.`, time, kind: 'warning', icon: Clock });
      }

    } else if (tx.type === 'withdrawal') {
      if (tx.status === 'completed') {
        items.push({ id: tx.id + '-n', title: 'Withdrawal Successful', description: `${amt} withdrawal has been processed and sent to your wallet.`, time, kind: 'success', icon: CheckCircle });
      } else if (tx.status === 'approved' && tx.otp_code && !tx.otp_verified) {
        items.push({ id: tx.id + '-n', title: 'Withdrawal Approved — OTP Required', description: `Your ${amt} withdrawal was approved. Enter your OTP on the Transactions page to confirm.`, time, kind: 'warning', icon: KeyRound });
      } else if (tx.status === 'approved') {
        items.push({ id: tx.id + '-n', title: 'Withdrawal Approved', description: `${amt} withdrawal has been approved and is being processed.`, time, kind: 'success', icon: CheckCircle });
      } else if (tx.status === 'rejected') {
        items.push({ id: tx.id + '-n', title: 'Withdrawal Rejected', description: `Your withdrawal of ${amt} was rejected. Funds remain in your account.`, time, kind: 'error', icon: XCircle });
      } else if (tx.status === 'pending') {
        items.push({ id: tx.id + '-n', title: 'Withdrawal Pending', description: `${amt} withdrawal request is awaiting admin review.`, time, kind: 'info', icon: ArrowUpRight });
      }

    } else if (tx.type === 'buy') {
      if (tx.status === 'completed') {
        const label = tx.crypto_symbol ? `${tx.crypto_amount} ${tx.crypto_symbol}` : 'crypto';
        items.push({ id: tx.id + '-n', title: 'Buy Order Filled', description: `You successfully purchased ${label} for ${amt}.`, time, kind: 'success', icon: ArrowLeftRight });
      } else if (tx.status === 'rejected') {
        items.push({ id: tx.id + '-n', title: 'Buy Order Rejected', description: `Your buy order of ${amt} was rejected. Your balance has not been affected.`, time, kind: 'error', icon: XCircle });
      } else if (tx.status === 'pending') {
        items.push({ id: tx.id + '-n', title: 'Buy Order Processing', description: `${amt} buy order is being processed.`, time, kind: 'info', icon: Clock });
      }

    } else if (tx.type === 'sell') {
      if (tx.status === 'completed') {
        const label = tx.crypto_symbol ? `${tx.crypto_amount} ${tx.crypto_symbol}` : 'crypto';
        items.push({ id: tx.id + '-n', title: 'Sell Order Filled', description: `You sold ${label} and received ${amt}.`, time, kind: 'success', icon: ArrowLeftRight });
      } else if (tx.status === 'rejected') {
        items.push({ id: tx.id + '-n', title: 'Sell Order Rejected', description: `Your sell order was rejected. Your portfolio has not been affected.`, time, kind: 'error', icon: XCircle });
      } else if (tx.status === 'pending') {
        items.push({ id: tx.id + '-n', title: 'Sell Order Processing', description: `Sell order is being processed.`, time, kind: 'info', icon: Clock });
      }

    } else if (tx.type === 'copy_profit') {
      if (tx.status === 'completed' || tx.status === 'approved') {
        items.push({ id: tx.id + '-n', title: 'Copy Trading Profit', description: `You earned ${amt} from your copied trader's performance.`, time, kind: 'success', icon: TrendingUp });
      }
    }
  }

  return items;
}

const KIND_STYLES = {
  success: { bg: 'bg-up/10 border-up/20', icon: 'text-up', dot: 'bg-up' },
  error:   { bg: 'bg-down/10 border-down/20', icon: 'text-down', dot: 'bg-down' },
  warning: { bg: 'bg-yellow-500/10 border-yellow-500/20', icon: 'text-yellow-400', dot: 'bg-yellow-400' },
  info:    { bg: 'bg-primary/8 border-primary/20', icon: 'text-primary', dot: 'bg-primary' },
};

export default function Settings() {
  const { user } = useOutletContext<OutletContext>();
  const { updateProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [form, setForm] = useState({ full_name: user?.full_name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);
  const [notifItems, setNotifItems] = useState<NotifItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      api.users.getById(user.id).then(data => {
        if (data?.wallet_address) setWalletAddress(data.wallet_address);
        setWalletLoading(false);
      }).catch(() => setWalletLoading(false));
    }
  }, [user?.id]);

  const loadNotifications = useCallback(() => {
    if (!user?.email) return;
    setNotifLoading(true);
    api.transactions.getByEmail(user.email, 100)
      .then(txns => {
        const sorted = [...txns].sort(
          (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
        setNotifItems(buildNotifications(sorted));
        setNotifLoading(false);
      })
      .catch(() => setNotifLoading(false));
  }, [user?.email]);

  useEffect(() => {
    if (activeTab === 'notifications') loadNotifications();
  }, [activeTab, loadNotifications]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await updateProfile({ full_name: form.full_name });
    if (error) toast.error(error.message || 'Failed to save');
    else toast.success('Profile updated successfully');
    setSaving(false);
  };

  const handleSaveWallet = async () => {
    if (!user?.id) return;
    if (!walletAddress.trim()) { toast.error('Enter a valid wallet address'); return; }
    setWalletSaving(true);
    try {
      await api.users.updateWalletAddress(user.id, walletAddress.trim());
      toast.success('Withdrawal wallet address saved!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save wallet address');
    }
    setWalletSaving(false);
  };

  const handleChangePassword = async () => {
    if (!pwForm.next) { toast.error('Enter a new password'); return; }
    if (pwForm.next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    if (error) toast.error(error.message || 'Failed to update password');
    else { toast.success('Password updated successfully'); setPwForm({ current: '', next: '', confirm: '' }); }
    setPwSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader user={user} title="Settings" subtitle="Manage your account" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          {TABS.map(({ id, icon: Icon, label }) => (
            <motion.button key={id} onClick={() => setActiveTab(id)} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${activeTab === id ? 'bg-primary/12 text-primary border border-primary/20' : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
              <Icon className="w-4 h-4" />
              {label}
            </motion.button>
          ))}
          <motion.button onClick={signOut} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 mt-4">
            <LogOut className="w-4 h-4" />
            Sign Out
          </motion.button>
        </div>

        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">

          {activeTab === 'profile' && (
            <>
              <p className="text-sm font-semibold mb-5">Profile Information</p>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                  {user?.full_name?.slice(0, 2).toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-semibold">{user?.full_name || 'No name set'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <span className={`text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded-md ${user?.role === 'admin' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-primary/15 text-primary'}`}>
                    {user?.role || 'user'}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Full Name</label>
                  <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    className="bg-secondary border-border" placeholder="Your full name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Email Address</label>
                  <Input value={form.email} disabled className="bg-secondary border-border opacity-60 cursor-not-allowed" />
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here</p>
                </div>
                <div className="pt-2">
                  <Button onClick={handleSaveProfile} disabled={saving} className="gradient-green text-white font-semibold glow-green-sm">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'wallet' && (
            <>
              <p className="text-sm font-semibold mb-2">Withdrawal Wallet Address</p>
              <p className="text-xs text-muted-foreground mb-5">
                This is the default wallet address used for withdrawal requests. You can change it at any time. Admin will send funds to this address once your withdrawal is approved.
              </p>
              {walletLoading ? (
                <div className="h-10 shimmer rounded-xl" />
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-primary">Default Withdrawal Address</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Used for all withdrawal requests unless overridden at time of request.</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Wallet Address (BTC / ETH / USDT / any network)</label>
                    <Input
                      value={walletAddress}
                      onChange={e => setWalletAddress(e.target.value)}
                      className="bg-secondary border-border font-mono text-sm"
                      placeholder="Enter your crypto wallet address..."
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Double-check this address. Funds sent to a wrong address cannot be recovered.
                    </p>
                  </div>
                  <div className="pt-1">
                    <Button onClick={handleSaveWallet} disabled={walletSaving} className="gradient-green text-white font-semibold glow-green-sm">
                      {walletSaving ? 'Saving...' : 'Save Wallet Address'}
                    </Button>
                  </div>
                  {walletAddress && (
                    <div className="p-3 bg-secondary rounded-xl">
                      <p className="text-xs text-muted-foreground mb-0.5">Current saved address</p>
                      <p className="text-xs font-mono text-foreground break-all">{walletAddress}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold">Notifications</p>
                <button onClick={loadNotifications}
                  className="text-xs text-primary hover:underline disabled:opacity-50">
                  Refresh
                </button>
              </div>

              {notifLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 shimmer rounded-2xl" />)}
                </div>
              ) : notifItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Bell className="w-8 h-8 opacity-25" />
                  <p className="text-sm text-center">No notifications yet.<br />Your deposit, withdrawal and trade updates will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifItems.map(item => {
                    const style = KIND_STYLES[item.kind];
                    const Icon = item.icon;
                    return (
                      <div key={item.id}
                        className={`flex items-start gap-3 p-4 rounded-2xl border ${style.bg}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-background/40`}>
                          <Icon className={`w-4 h-4 ${style.icon}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                            <p className="text-sm font-semibold truncate">{item.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1.5">{item.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'security' && (
            <>
              <p className="text-sm font-semibold mb-5">Security Settings</p>
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-2xl space-y-1">
                  <p className="text-sm font-medium">Change Password</p>
                  <p className="text-xs text-muted-foreground">Update your account password. Must be at least 8 characters.</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">New Password</label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={pwForm.next}
                      onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                      className="bg-secondary border-border pr-10"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Confirm New Password</label>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                    className="bg-secondary border-border"
                  />
                </div>
                {pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
                <div className="pt-1">
                  <Button onClick={handleChangePassword} disabled={pwSaving} variant="destructive" className="font-semibold">
                    {pwSaving ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>

                <div className="border-t border-border pt-4 mt-4 space-y-3">
                  <p className="text-sm font-medium">Account Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-secondary rounded-xl">
                      <p className="text-xs text-muted-foreground mb-0.5">Account type</p>
                      <p className="text-sm font-semibold capitalize">{user?.role || 'User'}</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-xl">
                      <p className="text-xs text-muted-foreground mb-0.5">Auth method</p>
                      <p className="text-sm font-semibold">Email + Password</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
