import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Globe, Wallet, Percent } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SETTING_GROUPS = [
  {
    label: 'Deposit Addresses',
    icon: Wallet,
    settings: [
      { key: 'deposit_address_btc', label: 'Bitcoin (BTC) Address', placeholder: 'bc1q...' },
      { key: 'deposit_address_eth', label: 'Ethereum (ETH) Address', placeholder: '0x...' },
      { key: 'deposit_address_usdt_trc20', label: 'USDT TRC20 Address', placeholder: 'T...' },
      { key: 'deposit_address_usdt_erc20', label: 'USDT ERC20 Address', placeholder: '0x...' },
      { key: 'deposit_address_bnb', label: 'BNB Address', placeholder: 'bnb...' },
    ],
  },
  {
    label: 'Platform Fees & Limits',
    icon: Percent,
    settings: [
      { key: 'trading_fee_pct', label: 'Trading Fee (%)', placeholder: '0.5' },
      { key: 'withdrawal_fee_pct', label: 'Withdrawal Fee (%)', placeholder: '1.0' },
      { key: 'min_deposit_usd', label: 'Minimum Deposit (USD)', placeholder: '50' },
      { key: 'min_withdrawal_usd', label: 'Minimum Withdrawal (USD)', placeholder: '20' },
    ],
  },
  {
    label: 'Platform Info',
    icon: Globe,
    settings: [
      { key: 'platform_name', label: 'Platform Name', placeholder: 'Salarn' },
      { key: 'support_email', label: 'Support Email', placeholder: 'support@salarn.com' },
      { key: 'telegram_support', label: 'Telegram Support', placeholder: '@SalarnSupport' },
    ],
  },
];

export default function PlatformSettingsPage() {
  const { user } = useOutletContext<any>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.platformSettings.list().then(rows => {
      const map: Record<string, string> = {};
      rows.forEach((r: any) => { map[r.key] = r.value; });
      setValues(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const all: Promise<void>[] = [];
      SETTING_GROUPS.forEach(g => g.settings.forEach(s => {
        if (values[s.key] !== undefined) {
          all.push(api.platformSettings.upsert(s.key, values[s.key], s.label, user?.email || 'admin'));
        }
      }));
      await Promise.all(all);
      toast.success('Platform settings saved!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader user={user} title="Platform Settings" subtitle="Configure fees, addresses, and platform info" />

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-48 shimmer rounded-2xl" />)}</div>
      ) : (
        <>
          {SETTING_GROUPS.map(({ label, icon: Icon, settings }, gi) => (
            <motion.div key={gi} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.07 }}
              className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="font-semibold text-sm">{label}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {settings.map(s => (
                  <div key={s.key}>
                    <label className="text-xs text-muted-foreground mb-1.5 block">{s.label}</label>
                    <Input
                      value={values[s.key] || ''}
                      onChange={e => setValues(p => ({ ...p, [s.key]: e.target.value }))}
                      placeholder={s.placeholder}
                      className="bg-secondary border-border font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          <Button onClick={handleSave} disabled={saving} className="gradient-green text-white font-bold glow-green-sm h-12 px-8">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save All Settings'}
          </Button>
        </>
      )}
    </div>
  );
}
