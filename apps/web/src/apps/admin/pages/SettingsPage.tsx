import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../shared/services/api.client';
import { Building2, CreditCard, Save, ShieldCheck } from 'lucide-react';
import { Card, Notice, Page, QueryState } from '../../../shared/components/ui';

const empty = {
  businessName: '',
  supportPhone: '',
  supportEmail: '',
  businessAddress: '',
  receiptFooter: '',
  customerPhonePeEnabled: true,
};

export function SettingsPage() {
  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api<typeof empty>('/admin/settings'),
  });

  return (
    <Page title="Settings" subtitle="Business presentation and customer payment controls.">
      <QueryState
        loading={settings.isLoading}
        error={settings.error}
        retry={() => void settings.refetch()}
      >
        {settings.data && <SettingsForm initial={{ ...empty, ...settings.data }} />}
      </QueryState>
    </Page>
  );
}

function SettingsForm({ initial }: { initial: typeof empty }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => api('/admin/settings', { method: 'PATCH', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setMessage('Settings saved and audit logged.');
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to save settings.',
      ),
  });

  return (
    <>
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <div className="settings-layout">
      <Card className="settings-card">
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="section-title-row"><span className="section-icon"><Building2 /></span><div><h2>Business identity</h2><p>Information shown on receipts and customer-facing screens.</p></div></div>
          <div className="form-grid settings-form-grid">
            {[
              ['businessName', 'Business name'],
              ['supportPhone', 'Support phone'],
              ['supportEmail', 'Support email'],
              ['businessAddress', 'Business address'],
              ['receiptFooter', 'Receipt footer'],
            ].map(([key, label]) => (
              <label
                className={key.includes('Address') || key.includes('Footer') ? 'full' : ''}
                key={key}
              >
                <span>{label}</span>
                <input
                  className="form-control"
                  type={key === 'supportEmail' ? 'email' : 'text'}
                  required={key === 'businessName'}
                  value={(form as any)[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="settings-divider" />
          <div className="section-title-row"><span className="section-icon"><CreditCard /></span><div><h2>Customer payments</h2><p>Control whether customers can open the PhonePe checkout.</p></div></div>
            <label className="settings-toggle-row">
              <input
                type="checkbox"
                checked={form.customerPhonePeEnabled}
                onChange={(event) =>
                  setForm({ ...form, customerPhonePeEnabled: event.target.checked })
                }
              />
              <span>Allow customers to initiate PhonePe payments</span>
              <i aria-hidden="true" />
            </label>
          <div className="settings-save-bar"><span><ShieldCheck /> Changes are validated and audit logged.</span><button className="primary" disabled={save.isPending}>
            <Save />
            {save.isPending ? 'Saving…' : 'Save settings'}
          </button></div>
        </form>
      </Card>
      <aside className="settings-help-card"><ShieldCheck /><h3>Production safeguards</h3><p>Payment settings are applied server-side. Every update is linked to the signed-in administrator.</p><ul><li>Receipt identity remains consistent</li><li>PhonePe can be disabled instantly</li><li>All changes remain audit visible</li></ul></aside>
      </div>
    </>
  );
}
