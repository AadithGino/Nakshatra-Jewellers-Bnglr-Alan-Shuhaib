import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeIndianRupee,
  CalendarDays,
  Edit3,
  Gem,
  Layers3,
  ShieldCheck,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { money } from '../../../shared/utils/format';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { AdminSelect } from '../components/AdminSelect';

const typeLabel = (type?: string) =>
  type === 'GOLD_WEIGHT' ? 'Gold weight' : type === 'CASH' ? 'Cash' : '—';

export function SchemePlanDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    type: 'GOLD_WEIGHT',
    durationMonths: '11',
    minimumPaymentRupees: '',
    termsText: '',
    benefitText: '',
    makingChargeBenefit: '',
    wastageBenefit: '',
    status: 'ACTIVE',
  });

  const detail = useQuery({
    queryKey: ['admin-scheme-plan', id],
    queryFn: () => api<any>(`/admin/scheme-plans/${id}`),
    enabled: Boolean(id),
  });
  const record = detail.data;

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/scheme-plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          durationMonths: Number(form.durationMonths),
          minimumPaymentPaise: Math.round(Number(form.minimumPaymentRupees) * 100),
          termsText: form.termsText,
          benefitText: form.benefitText || undefined,
          makingChargeBenefit: form.makingChargeBenefit || undefined,
          wastageBenefit: form.wastageBenefit || undefined,
          status: form.status,
        }),
      }),
    onSuccess: async () => {
      setEditOpen(false);
      setMessage('Scheme plan updated successfully.');
      await queryClient.invalidateQueries({ queryKey: ['admin-scheme-plan', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-scheme-plans'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to update scheme plan.',
      ),
  });

  const openEdit = () => {
    if (!record) return;
    setForm({
      name: record.name ?? '',
      type: record.type ?? 'GOLD_WEIGHT',
      durationMonths: String(record.durationMonths ?? 11),
      minimumPaymentRupees: String((record.minimumPaymentPaise ?? 0) / 100),
      termsText: record.termsText ?? '',
      benefitText: record.benefitText ?? '',
      makingChargeBenefit: record.makingChargeBenefit ?? '',
      wastageBenefit: record.wastageBenefit ?? '',
      status: record.status ?? 'ACTIVE',
    });
    setError('');
    setEditOpen(true);
  };

  return (
    <Page
      title="Scheme plan"
      actions={
        <button className="secondary" onClick={() => navigate('/admin/scheme-plans')}>
          <ArrowLeft /> Back
        </button>
      }
    >
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        empty={!detail.isLoading && !record}
        retry={() => void detail.refetch()}
      >
        {record && (
          <div className="plan-detail-page">
            <section className="plan-detail-hero">
              <div className="plan-detail-hero-main">
                <div className="plan-detail-hero-top">
                  <span className="plan-detail-eyebrow">
                    <Layers3 />
                    Scheme catalogue
                  </span>
                  <div className="admin-hero-toolbar">
                    <div className="plan-detail-badges">
                      <Status value={record.status} />
                      <span className={`scheme-type-pill ${record.type?.toLowerCase()}`}>
                        {typeLabel(record.type)}
                      </span>
                    </div>
                    <button type="button" className="primary" onClick={openEdit}>
                      <Edit3 /> Edit plan
                    </button>
                  </div>
                </div>
                <h2>{record.name}</h2>
                <p>{record.benefitText || 'Flexible monthly savings scheme'}</p>
                <div className="plan-detail-stats">
                  <article>
                    <small>Duration</small>
                    <strong>
                      {record.durationMonths}
                      <em> months</em>
                    </strong>
                  </article>
                  <article>
                    <small>Minimum payment</small>
                    <strong>{money(record.minimumPaymentPaise)}</strong>
                  </article>
                  <article>
                    <small>Making charge</small>
                    <strong>{record.makingChargeBenefit || '—'}</strong>
                  </article>
                  <article>
                    <small>Wastage</small>
                    <strong>{record.wastageBenefit || '—'}</strong>
                  </article>
                </div>
              </div>
              <div className="plan-detail-hero-side">
                <div className="plan-detail-type-card">
                  <span>{record.type === 'GOLD_WEIGHT' ? <Gem /> : <BadgeIndianRupee />}</span>
                  <div>
                    <small>Scheme type</small>
                    <b>{typeLabel(record.type)}</b>
                  </div>
                </div>
              </div>
            </section>

            <div className="plan-detail-grid">
              <article className="plan-detail-card">
                <span>
                  <CalendarDays />
                </span>
                <div>
                  <small>Flexible period</small>
                  <b>{record.flexibleMonths ?? record.durationMonths} months</b>
                  <em>
                    {(record.capMonths ?? 0) > 0
                      ? 'Variable contribution months'
                      : 'Full-duration flexible contributions'}
                  </em>
                </div>
              </article>
              <article className="plan-detail-card">
                <span>
                  <ShieldCheck />
                </span>
                <div>
                  <small>Status</small>
                  <b>{record.status}</b>
                  <em>{record.status === 'ACTIVE' ? 'Open for enrollment' : 'Hidden from new enrollments'}</em>
                </div>
              </article>
              <article className="plan-detail-card">
                <span>
                  <Layers3 />
                </span>
                <div>
                  <small>Cap months</small>
                  <b>{record.capMonths ?? 0}</b>
                  <em>
                    {(record.capMonths ?? 0) > 0
                      ? 'Average-capped contribution months'
                      : 'No average cap on this plan'}
                  </em>
                </div>
              </article>
            </div>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Terms</h2>
              </div>
              <p className="scheme-admin-copy">{record.termsText || '—'}</p>
            </section>

            {record.benefitText && (
              <section className="phonepe-panel">
                <div className="phonepe-panel-head">
                  <h2>Customer benefit</h2>
                </div>
                <p className="scheme-admin-copy">{record.benefitText}</p>
              </section>
            )}
          </div>
        )}
      </QueryState>

      <Modal
        title="Edit scheme plan"
        open={editOpen}
        onClose={() => {
          if (!save.isPending) setEditOpen(false);
        }}
      >
        <form
          className="plan-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            save.mutate();
          }}
        >
          <p className="plan-modal-lead">
            Changes apply to new enrollments. Existing memberships keep their saved plan rules.
          </p>

          <div className="settle-modal-toggle" role="radiogroup" aria-label="Scheme type">
            <button
              type="button"
              role="radio"
              aria-checked={form.type === 'GOLD_WEIGHT'}
              className={form.type === 'GOLD_WEIGHT' ? 'active' : ''}
              onClick={() => setForm({ ...form, type: 'GOLD_WEIGHT' })}
            >
              <Gem />
              <span>
                <b>Gold weight</b>
                <small>Accumulate 916 gold</small>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={form.type === 'CASH'}
              className={form.type === 'CASH' ? 'active' : ''}
              onClick={() => setForm({ ...form, type: 'CASH' })}
            >
              <BadgeIndianRupee />
              <span>
                <b>Cash</b>
                <small>Cash savings scheme</small>
              </span>
            </button>
          </div>

          <div className="plan-modal-fields">
            <label>
              <span>Plan name</span>
              <input
                className="form-control"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              <span>Status</span>
              <AdminSelect
                icon={<ShieldCheck />}
                value={form.status}
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE', hint: 'Open for enrollment' },
                  { value: 'INACTIVE', label: 'INACTIVE', hint: 'Hidden from new enrollments' },
                ]}
                onChange={(value) => setForm({ ...form, status: value })}
              />
            </label>
            <label>
              <span>Duration</span>
              <AdminSelect
                icon={<Layers3 />}
                value={form.durationMonths}
                options={[
                  { value: '6', label: '6 months' },
                  { value: '11', label: '11 months' },
                  { value: '12', label: '12 months' },
                  { value: '18', label: '18 months' },
                  { value: '24', label: '24 months' },
                  ...(form.durationMonths &&
                  !['6', '11', '12', '18', '24'].includes(form.durationMonths)
                    ? [{ value: form.durationMonths, label: `${form.durationMonths} months` }]
                    : []),
                ]}
                onChange={(value) => setForm({ ...form, durationMonths: value })}
              />
            </label>
            <label>
              <span>Minimum payment ₹</span>
              <input
                className="form-control"
                type="number"
                min="1"
                step="0.01"
                required
                value={form.minimumPaymentRupees}
                onChange={(event) => setForm({ ...form, minimumPaymentRupees: event.target.value })}
              />
            </label>
            <label className="full">
              <span>Terms</span>
              <textarea
                className="form-control"
                rows={3}
                required
                value={form.termsText}
                onChange={(event) => setForm({ ...form, termsText: event.target.value })}
              />
            </label>
            <label className="full">
              <span>Benefit summary</span>
              <input
                className="form-control"
                value={form.benefitText}
                onChange={(event) => setForm({ ...form, benefitText: event.target.value })}
              />
            </label>
            <label>
              <span>Making charge benefit</span>
              <input
                className="form-control"
                value={form.makingChargeBenefit}
                onChange={(event) => setForm({ ...form, makingChargeBenefit: event.target.value })}
              />
            </label>
            <label>
              <span>Wastage benefit</span>
              <input
                className="form-control"
                value={form.wastageBenefit}
                onChange={(event) => setForm({ ...form, wastageBenefit: event.target.value })}
              />
            </label>
          </div>

          <Notice error>{error}</Notice>
          <div className="plan-modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={save.isPending}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button className="primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
