import { Link } from 'react-router-dom';
import { TrendingUp, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/6 blur-3xl" />
      </div>
      <div className="relative text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl gradient-green flex items-center justify-center glow-green-sm mx-auto mb-6">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <p className="text-8xl font-black text-primary/20 mb-4">404</p>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/"
          className="inline-flex items-center gap-2 gradient-green text-white font-semibold px-6 py-3 rounded-xl glow-green-sm hover:opacity-90 transition-opacity text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
