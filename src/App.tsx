import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import { lazy, Suspense } from 'react';

const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const Landing = lazy(() => import('@/pages/Landing'));
const AuthPage = lazy(() => import('@/pages/Auth'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Portfolio = lazy(() => import('@/pages/Portfolio'));
const Trade = lazy(() => import('@/pages/Trade'));
const CopyTrading = lazy(() => import('@/pages/CopyTrading'));
const Transactions = lazy(() => import('@/pages/Transactions'));
const Settings = lazy(() => import('@/pages/Settings'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const ManageUsers = lazy(() => import('@/pages/admin/ManageUsers'));
const ManageCryptos = lazy(() => import('@/pages/admin/ManageCryptos'));
const ManageTraders = lazy(() => import('@/pages/admin/ManageTraders'));
const AdminTransactions = lazy(() => import('@/pages/admin/AdminTransactions'));
const PlatformSettingsPage = lazy(() => import('@/pages/admin/PlatformSettings'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const WithdrawalProcessing = lazy(() => import('@/pages/WithdrawalProcessing'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
});

function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl gradient-green flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Loading Salarn...</p>
      </div>
    </div>
  );
}

function App() {
  const basePath = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={basePath} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/trade" element={<Trade />} />
                  <Route path="/copy-trading" element={<CopyTrading />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/transactions/processing/:txId" element={<WithdrawalProcessing />} />
                </Route>
                <Route element={<AdminRoute><AppLayout /></AdminRoute>}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/users" element={<ManageUsers />} />
                  <Route path="/admin/cryptos" element={<ManageCryptos />} />
                  <Route path="/admin/traders" element={<ManageTraders />} />
                  <Route path="/admin/transactions" element={<AdminTransactions />} />
                  <Route path="/admin/settings" element={<PlatformSettingsPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Sonner position="top-right" theme="dark" richColors />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
