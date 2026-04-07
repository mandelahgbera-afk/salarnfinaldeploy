import { supabase } from './supabase';

export const api = {
  users: {
    list: async () => {
      const { data, error } = await supabase.from('users').select('*, user_balances(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    updateRole: async (id: string, role: 'user' | 'admin') => {
      const { error } = await supabase.from('users').update({ role }).eq('id', id);
      if (error) throw error;
    },
    updateWalletAddress: async (id: string, wallet_address: string) => {
      const { error } = await supabase.from('users').update({ wallet_address, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    getById: async (id: string) => {
      const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      return data;
    },
  },

  balances: {
    getByEmail: async (email: string) => {
      const { data } = await supabase.from('user_balances').select('*').eq('user_email', email).maybeSingle();
      return data;
    },
    update: async (email: string, updates: Partial<{ balance_usd: number; total_invested: number; total_profit_loss: number }>) => {
      // Guard against negative balance — clamp to 0 to prevent constraint violation
      const safeUpdates = { ...updates };
      if (typeof safeUpdates.balance_usd === 'number' && safeUpdates.balance_usd < 0) {
        safeUpdates.balance_usd = 0;
      }
      // Use upsert so a missing balance row (rare but possible for users created
      // before the trigger was installed) is created rather than silently ignored.
      const { error } = await supabase
        .from('user_balances')
        .upsert(
          { user_email: email, ...safeUpdates, updated_at: new Date().toISOString() },
          { onConflict: 'user_email' }
        );
      if (error) throw error;
    },
  },

  cryptos: {
    list: async () => {
      const { data, error } = await supabase.from('cryptocurrencies').select('*').order('market_cap', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    active: async () => {
      const { data, error } = await supabase.from('cryptocurrencies').select('*').eq('is_active', true).order('market_cap', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    create: async (data: { symbol: string; name: string; price: number; change_24h: number; market_cap: number; volume_24h: number; icon_color: string; is_active: boolean }) => {
      const { error } = await supabase.from('cryptocurrencies').insert(data);
      if (error) throw error;
    },
    update: async (id: string, data: Partial<{ symbol: string; name: string; price: number; change_24h: number; market_cap: number; volume_24h: number; is_active: boolean }>) => {
      const { error } = await supabase.from('cryptocurrencies').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('cryptocurrencies').delete().eq('id', id);
      if (error) throw error;
    },
  },

  portfolio: {
    getByEmail: async (email: string) => {
      const { data, error } = await supabase.from('portfolio').select('*').eq('user_email', email);
      if (error) throw error;
      return data || [];
    },

    upsert: async (email: string, symbol: string, amount: number, avgPrice: number) => {
      const { data: existing } = await supabase
        .from('portfolio')
        .select('*')
        .eq('user_email', email)
        .eq('crypto_symbol', symbol)
        .maybeSingle();

      if (existing) {
        const newAmount = existing.amount + amount;
        const newAvg = (existing.avg_buy_price * existing.amount + avgPrice * amount) / newAmount;
        const { error } = await supabase
          .from('portfolio')
          .update({ amount: newAmount, avg_buy_price: newAvg, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('portfolio')
          .insert({ user_email: email, crypto_symbol: symbol, amount, avg_buy_price: avgPrice });
        if (error) throw error;
      }
    },

    reduce: async (email: string, symbol: string, amount: number) => {
      const { data: existing } = await supabase
        .from('portfolio')
        .select('*')
        .eq('user_email', email)
        .eq('crypto_symbol', symbol)
        .maybeSingle();

      if (!existing) throw new Error(`No ${symbol} holdings found for this user`);

      const newAmount = existing.amount - amount;
      if (newAmount < -0.00000001) throw new Error(`Insufficient ${symbol} holdings (have ${existing.amount}, need ${amount})`);

      if (newAmount <= 0.00000001) {
        const { error } = await supabase.from('portfolio').delete().eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('portfolio')
          .update({ amount: newAmount, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      }
    },
  },

  transactions: {
    getByEmail: async (email: string, limit = 50) => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    getAll: async (limit = 200) => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    create: async (data: {
      user_email: string;
      type: string;
      amount: number;
      crypto_symbol?: string;
      crypto_amount?: number;
      status: string;
      wallet_address?: string;
      notes?: string;
    }) => {
      const { error } = await supabase.from('transactions').insert(data);
      if (error) throw error;
    },
    // Like create but returns the new row's ID — used for navigation to processing page
    createAndReturn: async (data: {
      user_email: string;
      type: string;
      amount: number;
      crypto_symbol?: string;
      crypto_amount?: number;
      status: string;
      wallet_address?: string;
      notes?: string;
    }): Promise<string> => {
      const { data: rows, error } = await supabase
        .from('transactions')
        .insert(data)
        .select('id')
        .single();
      if (error) throw error;
      return rows.id as string;
    },
    update: async (id: string, data: {
      status?: string;
      notes?: string;
      otp_code?: string;
      otp_expires_at?: string;
      otp_verified?: boolean;
      reviewed_by?: string;
      reviewed_at?: string;
    }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    verifyOtp: async (id: string, code: string) => {
      // Use maybeSingle — .single() throws if RLS hides the row
      const { data, error } = await supabase
        .from('transactions')
        .select('otp_code, otp_expires_at, otp_verified')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Transaction not found or access denied');
      if (data.otp_verified) throw new Error('OTP already used');
      if (!data.otp_code) throw new Error('No OTP has been generated for this withdrawal');
      if (data.otp_expires_at && new Date(data.otp_expires_at) < new Date()) throw new Error('OTP has expired — contact support');
      if (data.otp_code !== code) throw new Error('Invalid OTP code');

      const { error: updErr } = await supabase
        .from('transactions')
        .update({ otp_verified: true, status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updErr) throw updErr;
    },
  },

  traders: {
    list: async () => {
      const { data, error } = await supabase.from('copy_traders').select('*').eq('is_approved', true).order('total_profit_pct', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    all: async () => {
      const { data, error } = await supabase.from('copy_traders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    create: async (data: Record<string, unknown>) => {
      const { error } = await supabase.from('copy_traders').insert(data);
      if (error) throw error;
    },
    update: async (id: string, data: Record<string, unknown>) => {
      const { error } = await supabase.from('copy_traders').update(data).eq('id', id);
      if (error) throw error;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('copy_traders').delete().eq('id', id);
      if (error) throw error;
    },
  },

  copyTrades: {
    getByEmail: async (email: string) => {
      const { data, error } = await supabase.from('copy_trades').select('*').eq('user_email', email).eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    getAll: async () => {
      const { data, error } = await supabase.from('copy_trades').select('*').eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    create: async (data: { user_email: string; trader_id: string; trader_name: string; allocation: number }) => {
      const { error } = await supabase
        .from('copy_trades')
        .insert({ ...data, profit_loss: 0, profit_loss_pct: 0, is_active: true });
      if (error) throw error;
    },
    stop: async (id: string) => {
      const { error } = await supabase
        .from('copy_trades')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    updateProfit: async (id: string, profitLoss: number, profitLossPct: number) => {
      const { error } = await supabase
        .from('copy_trades')
        .update({ profit_loss: profitLoss, profit_loss_pct: profitLossPct, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    distributeProfit: async (copyTradeId: string, profitAmount: number, traderFeesPct: number) => {
      const { data: ct } = await supabase.from('copy_trades').select('*').eq('id', copyTradeId).maybeSingle();
      if (!ct) throw new Error('Copy trade not found');

      const userShare = (profitAmount * (100 - traderFeesPct)) / 100;

      const { data: balData } = await supabase.from('user_balances').select('balance_usd, total_invested, total_profit_loss').eq('user_email', ct.user_email).maybeSingle();
      const { error: balErr } = await supabase
        .from('user_balances')
        .upsert({
          user_email: ct.user_email,
          balance_usd: (balData?.balance_usd || 0) + userShare,
          total_invested: balData?.total_invested || 0,
          total_profit_loss: (balData?.total_profit_loss || 0) + userShare,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email' });
      if (balErr) throw balErr;

      await supabase.from('transactions').insert({
        user_email: ct.user_email,
        type: 'copy_profit',
        amount: userShare,
        status: 'completed',
        notes: `Copy profit from ${ct.trader_name}`,
      });

      return userShare;
    },
  },

  platformSettings: {
    list: async () => {
      const { data, error } = await supabase.from('platform_settings').select('*');
      if (error) throw error;
      return data || [];
    },
    upsert: async (key: string, value: string, label: string, updatedBy: string) => {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({ key, value, label, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
  },
};
