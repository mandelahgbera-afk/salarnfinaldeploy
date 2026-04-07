import { Bell } from 'lucide-react';

interface PageHeaderProps {
  user: { full_name?: string | null; email: string } | null;
  title: string;
  subtitle?: string;
}

export default function PageHeader({ user, title, subtitle }: PageHeaderProps) {
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || 'U').toUpperCase();

  return (
    <div className="flex items-center justify-between mb-6 lg:mb-8">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
          {initials}
        </div>
      </div>
    </div>
  );
}
