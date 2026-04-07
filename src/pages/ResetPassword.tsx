import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Verify we actually have a recovery session — if not, redirect to auth.
    supabase.auth.getSession().then(({ data }) => {
      if (!mountedRef.current) return;
      if (!data.session) {
        toast.error('Reset link expired or already used. Request a new one.');
        navigate('/auth', { replace: true });
      } else {
        setHasSession(true);
      }
    });
    return () => { mountedRef.current = false; };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { toast.error('Enter your new password'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (!mountedRef.current) return;
      if (error) {
        toast.error(error.message || 'Failed to update password');
        setLoading(false);
        return;
      }
      setDone(true);
      // Sign out so they log in fresh with their new password
      await supabase.auth.signOut().catch(() => {});
      setTimeout(() => {
        if (mountedRef.current) navigate('/auth', { replace: true });
      }, 3000);
    } catch (err: unknown) {
      if (mountedRef.current) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
        setLoading(false);
      }
    }
  };

  if (hasSession === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/8 blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl gradient-green flex items-center justify-center glow-green-sm">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl">Salarn</span>
        </div>

        <div className="bg-card border border-border rounded-3xl p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Password updated!</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been changed. Redirecting you to sign in…
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-1">Set new password</h2>
              <p className="text-sm text-muted-foreground mb-6">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">New Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      autoComplete="new-password"
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:border-primary/50 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Confirm Password</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl gradient-green text-white font-bold text-sm glow-green-sm hover:opacity-90 transition-all disabled:opacity-60">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Updating…
                    </div>
                  ) : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
