import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Shield, User } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ManageUsers() {
  const { user } = useOutletContext<any>();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => api.users.list().then(u => { setUsers(u); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = (u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q));
    const matchR = roleFilter === 'all' || u.role === roleFilter;
    return matchQ && matchR;
  });

  const toggleRole = async (u: any) => {
    if (u.id === user?.id) {
      toast.error("You can't change your own role — ask another admin.");
      return;
    }
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    setUpdating(u.id);
    try {
      await api.users.updateRole(u.id, newRole);
      toast.success(`${u.email} is now ${newRole}`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role');
    }
    setUpdating(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader user={user} title="Manage Users" subtitle={`${users.length} total users`} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="pl-9 bg-secondary border-border" />
        </div>
        <div className="flex gap-2">
          {['all', 'user', 'admin'].map(f => (
            <button key={f} onClick={() => setRoleFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${roleFilter === f ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-4 text-xs text-muted-foreground px-5 py-3 border-b border-border/60 font-medium">
          <span>User</span>
          <span>Email</span>
          <span>Balance</span>
          <span>Role</span>
        </div>
        {loading ? (
          <div className="space-y-px">{[1,2,3,4,5].map(i => <div key={i} className="h-16 shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">No users found</div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(u => {
              const bal = u.user_balances?.[0];
              return (
                <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3 px-5 py-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                      {(u.full_name || u.email)?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <p className="text-sm font-semibold truncate">{u.full_name || '—'}</p>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                  <p className="text-sm font-mono">${(bal?.balance_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${u.role === 'admin' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-primary/10 text-primary'}`}>
                      {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {u.role}
                    </span>
                    {u.id === user?.id ? (
                      <span className="text-xs text-muted-foreground px-2 h-7 flex items-center italic">You</span>
                    ) : (
                      <Button variant="ghost" size="sm" disabled={updating === u.id}
                        onClick={() => toggleRole(u)}
                        className="text-xs text-muted-foreground hover:text-foreground px-2 h-7">
                        {updating === u.id ? '...' : (u.role === 'admin' ? 'Demote' : 'Promote')}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
