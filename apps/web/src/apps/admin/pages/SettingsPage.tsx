import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  Save,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { Notice, Page, QueryState } from '../../../shared/components/ui';

type SettingsFormState = {
  businessName: string;
  supportPhone: string;
  supportEmail: string;
  businessAddress: string;
  receiptFooter: string;
  customerPhonePeEnabled: boolean;
};

const empty: SettingsFormState = {
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
    queryFn: () => api<SettingsFormState>('/admin/settings'),
  });

  return (
    <Page title="Settings" subtitle="Business presentation and customer payment controls.">
      <QueryState
        loading={settings.isLoading}
        error={settings.error}
        retry={() => void settings.refetch()}
      >
        {settings.data && (
          <SettingsForm
            key={String(settings.dataUpdatedAt)}
            initial={{ ...empty, ...settings.data }}
          />
        )}
      </QueryState>
    </Page>
  );
}

function SettingsForm({ initial }: { initial: SettingsFormState }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const dirty = useMemo(
    () =>
      form.businessName !== initial.businessName ||
      form.supportPhone !== initial.supportPhone ||
      form.supportEmail !== initial.supportEmail ||
      form.businessAddress !== initial.businessAddress ||
      form.receiptFooter !== initial.receiptFooter ||
      form.customerPhonePeEnabled !== initial.customerPhonePeEnabled,
    [form, initial],
  );

  const cancelIdentityEdit = () => {
    setForm((current) => ({
      ...current,
      businessName: initial.businessName,
      supportPhone: initial.supportPhone,
      supportEmail: initial.supportEmail,
      businessAddress: initial.businessAddress,
      receiptFooter: initial.receiptFooter,
    }));
    setEditingIdentity(false);
    setError('');
  };

  const save = useMutation({
    mutationFn: () => api('/admin/settings', { method: 'PATCH', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setMessage('Settings saved and audit logged.');
      setError('');
      setEditingIdentity(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to save settings.',
      ),
  });

  const previewName = form.businessName.trim() || 'Business name';
  const phonePeOn = form.customerPhonePeEnabled;

  const identityFields = [
    { key: 'businessName' as const, label: 'Business name', value: form.businessName },
    { key: 'supportPhone' as const, label: 'Support phone', value: form.supportPhone },
    { key: 'supportEmail' as const, label: 'Support email', value: form.supportEmail },
    {
      key: 'businessAddress' as const,
      label: 'Business address',
      value: form.businessAddress,
      full: true,
      multiline: true,
    },
    {
      key: 'receiptFooter' as const,
      label: 'Receipt footer',
      value: form.receiptFooter,
      full: true,
      multiline: true,
    },
  ];

  return (
    <>
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>

      <form
        className="settings-page"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!dirty || save.isPending) return;
          save.mutate();
        }}
      >
        <section className="settings-hero">
          <div className="settings-hero-main">
            <div className="settings-hero-top">
              <span className="settings-hero-eyebrow">
                <Building2 />
                Platform settings
              </span>
              <div className="admin-hero-toolbar">
                <div className="settings-hero-badges">
                  <span className={`settings-status-pill ${phonePeOn ? 'on' : 'off'}`}>
                    {phonePeOn ? <CheckCircle2 /> : <Smartphone />}
                    PhonePe · {phonePeOn ? 'Enabled' : 'Disabled'}
                  </span>
                  {dirty ? (
                    <span className="settings-status-pill dirty">Unsaved changes</span>
                  ) : (
                    <span className="settings-status-pill clean">Up to date</span>
                  )}
                </div>
                <button
                  type="submit"
                  className="primary"
                  disabled={!dirty || save.isPending}
                >
                  <Save />
                  {save.isPending ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </div>
            <div className="settings-hero-title-row">
              <h2>{previewName}</h2>
              <p>Shown on receipts, customer screens and collection confirmations.</p>
            </div>
            <div className="settings-hero-stats">
              <article>
                <small>Support phone</small>
                <strong>{form.supportPhone.trim() || '—'}</strong>
              </article>
              <article>
                <small>Support email</small>
                <strong>{form.supportEmail.trim() || '—'}</strong>
              </article>
              <article>
                <small>Receipt footer</small>
                <strong>{form.receiptFooter.trim() ? 'Configured' : 'Default'}</strong>
              </article>
              <article>
                <small>Customer checkout</small>
                <strong>{phonePeOn ? 'Open' : 'Closed'}</strong>
              </article>
            </div>
          </div>
          <div className="settings-hero-side">
            <div className="settings-hero-icon">
              <ShieldCheck />
            </div>
          </div>
        </section>

        <div className="settings-facts">
          <article className="settings-fact">
            <span>
              <Phone />
            </span>
            <div>
              <small>Support phone</small>
              <b>{form.supportPhone.trim() || 'Not set'}</b>
              <em>Customer help line</em>
            </div>
          </article>
          <article className="settings-fact">
            <span>
              <Mail />
            </span>
            <div>
              <small>Support email</small>
              <b>{form.supportEmail.trim() || 'Not set'}</b>
              <em>Written enquiries</em>
            </div>
          </article>
          <article className="settings-fact">
            <span>
              <MapPin />
            </span>
            <div>
              <small>Business address</small>
              <b>{form.businessAddress.trim() || 'Not set'}</b>
              <em>Shown where needed on receipts</em>
            </div>
          </article>
          <article className="settings-fact">
            <span>
              <ReceiptText />
            </span>
            <div>
              <small>Receipt identity</small>
              <b>{previewName}</b>
              <em>Brand on collection receipts</em>
            </div>
          </article>
        </div>

        <div className="settings-split">
          <section className="reports-table-card settings-panel">
            <div className="reports-table-head">
              <h2>Business identity</h2>
              {editingIdentity ? (
                <button
                  type="button"
                  className="secondary settings-panel-action"
                  onClick={cancelIdentityEdit}
                >
                  <X /> Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary settings-panel-action"
                  onClick={() => {
                    setMessage('');
                    setEditingIdentity(true);
                  }}
                >
                  <Pencil /> Edit
                </button>
              )}
            </div>

            {editingIdentity ? (
              <div className="settings-fields">
                {identityFields.map((field) => (
                  <label className={field.full ? 'full' : undefined} key={field.key}>
                    <span>{field.label}</span>
                    {field.multiline ? (
                      <textarea
                        className="form-control"
                        rows={3}
                        required={field.key === 'businessName'}
                        value={field.value}
                        onChange={(event) =>
                          setForm({ ...form, [field.key]: event.target.value })
                        }
                      />
                    ) : (
                      <input
                        className="form-control"
                        type={field.key === 'supportEmail' ? 'email' : 'text'}
                        required={field.key === 'businessName'}
                        value={field.value}
                        onChange={(event) =>
                          setForm({ ...form, [field.key]: event.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <div className="settings-readonly-grid">
                {identityFields.map((field) => (
                  <article className={field.full ? 'full' : undefined} key={field.key}>
                    <small>{field.label}</small>
                    <b>{field.value.trim() || '—'}</b>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="settings-side-stack">
            <section className="reports-table-card settings-panel">
              <div className="reports-table-head">
                <h2>Customer payments</h2>
                <small>PhonePe checkout</small>
              </div>
              <label className={`settings-toggle ${phonePeOn ? 'on' : ''}`}>
                <span className="settings-toggle-copy">
                  <CreditCard />
                  <span>
                    <b>Allow PhonePe payments</b>
                    <small>
                      When off, customers cannot open PhonePe checkout from the app.
                    </small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.customerPhonePeEnabled}
                  onChange={(event) =>
                    setForm({ ...form, customerPhonePeEnabled: event.target.checked })
                  }
                />
                <i aria-hidden="true" />
              </label>
            </section>

            <aside className="settings-safeguard">
              <span>
                <ShieldCheck />
              </span>
              <div>
                <h3>Production safeguards</h3>
                <p>
                  Settings apply server-side. Every save is linked to the signed-in administrator
                  and remains visible in audit logs.
                </p>
                <ul>
                  <li>Receipt identity stays consistent</li>
                  <li>PhonePe can be disabled instantly</li>
                  <li>All changes remain audit visible</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>

        <div className="settings-footer-bar">
          <span>
            <ShieldCheck />
            {dirty ? 'You have unsaved changes.' : 'All changes are validated and audit logged.'}
          </span>
          <button type="submit" className="primary" disabled={!dirty || save.isPending}>
            <Save />
            {save.isPending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </>
  );
}
