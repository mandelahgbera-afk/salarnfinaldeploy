import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Salarn] Missing Supabase environment variables.\n' +
    '  VITE_SUPABASE_URL:', supabaseUrl ? '✓ set' : '✗ MISSING',
    '\n  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ set' : '✗ MISSING',
    '\nAdd them to your Vercel project → Settings → Environment Variables and redeploy.'
  );
}

export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'salarn.auth',
    },
  }
);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string | null;
          email: string;
          full_name: string | null;
          role: 'user' | 'admin';
          wallet_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      user_balances: {
        Row: {
          id: string;
          user_email: string;
          balance_usd: number;
          total_invested: number;
          total_profit_loss: number;
          created_at: string;
          updated_at: string;
        };
      };
      cryptocurrencies: {
        Row: {
          id: string;
          symbol: string;
          name: string;
          price: number;
          change_24h: number;
          market_cap: number;
          volume_24h: number;
          icon_color: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      portfolio: {
        Row: {
          id: string;
          user_email: string;
          crypto_symbol: string;
          amount: number;
          avg_buy_price: number;
          created_at: string;
          updated_at: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_email: string;
          type: 'deposit' | 'withdrawal' | 'buy' | 'sell' | 'copy_profit';
          amount: number;
          crypto_symbol: string | null;
          crypto_amount: number | null;
          status: 'pending' | 'approved' | 'rejected' | 'completed';
          notes: string | null;
          wallet_address: string | null;
          otp_code: string | null;
          otp_verified: boolean | null;
          otp_expires_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      copy_traders: {
        Row: {
          id: string;
          trader_name: string;
          specialty: string | null;
          total_profit_pct: number;
          monthly_profit_pct: number;
          win_rate: number;
          total_trades: number;
          followers: number;
          profit_split_pct: number;
          min_allocation: number;
          is_approved: boolean;
          risk_level: 'low' | 'medium' | 'high';
          avatar_color: string;
          created_at: string;
        };
      };
      copy_trades: {
        Row: {
          id: string;
          user_email: string;
          trader_id: string;
          trader_name: string;
          allocation: number;
          profit_loss: number;
          profit_loss_pct: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      platform_settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          label: string | null;
          updated_by: string | null;
          updated_at: string;
        };
      };
    };
  };
};
