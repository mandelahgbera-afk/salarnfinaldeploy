import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, signUp, resetPassword, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const signInTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (signInTimeoutRef.current) {
        clearTimeout(signInTimeoutRef.current);
        signInTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      if (signInTimeoutRef.current) {
        clearTimeout(signInTimeoutRef.current);
        signInTimeoutRef.current = null;
      }
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) toast.error(decodeURIComponent(err));
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPassword('');
    setLoading(false);
    setResetSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Enter your email'); return; }

    if (mode === 'forgot') {
      setLoading(true);
      const { error } = await resetPassword(email.trim());
      if (!mountedRef.current) return;
      setLoading(false);
      if (error) {
        toast.error(error.message || 'Failed to send reset email');
      } else {
        setResetSent(true);
      }
      return;
    }

    if (!password) { toast.error('Enter your password'); return; }
    if (mode === 'signup' && !fullName.trim()) { toast.error('Enter your full name'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error, sessionCreated } = await signUp(email.trim(), password, fullName.trim());
        if (error) {
          if (mountedRef.current) {
            toast.error(error.message || 'Signup failed. Please try again.');
            setLoading(false);
          }
          return;
        }
        if (mountedRef.current) {
          if (sessionCreated) {
            // Email confirmation is disabled — user is already signed in.
            // The auth state change will fire and redirect automatically.
            toast.success('Account created! Welcome to Salarn.');
            // Keep spinner; the useEffect above will redirect once user loads.
          } else {
            // Email confirmation is required — ask them to check their inbox.
            toast.success('Account created! Check your email to confirm, then sign in.');
            switchMode('signin');
          }
        }
        return;
      }

      const { error } = await signIn(email.trim(), password);

      if (error) {
        let msg = error.message || 'Sign in failed.';
        if (msg.toLowerCase().includes('invalid login credentials')) {
          msg = 'Incorrect email or password.';
        } else if (msg.toLowerCase().includes('email not confirmed')) {
          msg = 'Email not confirmed. Check your inbox and click the confirmation link first.';
        } else if (msg.toLowerCase().includes('too many requests')) {
          msg = 'Too many attempts. Please wait a minute and try again.';
        }
        if (mountedRef.current) {
          toast.error(msg);
          setLoading(false);
        }
        return;
      }

      if (signInTimeoutRef.current) {
        clearTimeout(signInTimeoutRef.current);
        signInTimeoutRef.current = null;
      }
      signInTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && signInTimeoutRef.current) {
          signInTimeoutRef.current = null;
          setLoading(false);
          toast.error('Sign in is taking longer than expected. Please check your connection and try again.');
        }
      }, 8_000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed. Check your internet connection.';
      if (mountedRef.current) {
        toast.error(msg);
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/8 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl gradient-green flex items-center justify-center glow-green-sm">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl">Salarn</span>
        </div>

        <div className="bg-card border border-border rounded-3xl p-8">

          {mode === 'forgot' ? (
            <AnimatePresence mode="wait">
              {resetSent ? (
                <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="text-center py-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Check your email</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    We sent a password reset link to <span className="text-foreground font-medium">{email}</span>.
                    Click the link in the email to set a new password.
                  </p>
                  <button onClick={() => switchMode('signin')}
                    className="text-sm text-primary hover:underline">
                    Back to sign in
                  </button>
                </motion.div>
              ) : (
                <motion.div key="forgot-form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <button onClick={() => switchMode('signin')}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                  </button>
                  <h2 className="text-2xl font-bold mb-1">Reset password</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
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
                          Sending...
                        </div>
                      ) : 'Send reset link'}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-1">
                {mode === 'signin' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {mode === 'signin' ? 'Sign in to your trading account' : 'Start your crypto journey today'}
              </p>

              <div className="flex bg-secondary rounded-xl p-1 mb-6">
                {(['signin', 'signup'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {m === 'signin' ? 'Sign In' : 'Sign Up'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Full Name</label>
                    <input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="John Doe"
                      autoComplete="name"
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted-foreground">Password</label>
                    {mode === 'signin' && (
                      <button type="button" onClick={() => switchMode('forgot')}
                        className="text-xs text-primary hover:underline transition-colors">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:border-primary/50 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl gradient-green text-white font-bold text-sm glow-green-sm hover:opacity-90 transition-all disabled:opacity-60 mt-2"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                    </div>
                  ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-6">
                By continuing you agree to our{' '}
                <span className="text-primary cursor-pointer hover:underline">Terms</span> and{' '}
                <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
