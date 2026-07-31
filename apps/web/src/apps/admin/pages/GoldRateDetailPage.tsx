import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Edit3,
  Gem,
  Minus,
  ReceiptText,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { dayChange, formatPercent } from '../../../shared/utils/goldRateChart';
import { GoldRateTrendChart } from '../../../shared/components/GoldRateSparkline';
import { Select } from '../../../shared/components/Select';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="phonepe-fact">
      <small>{label}</small>
      <b>{value}</b>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

function ChangeStat({
  label,
  percent,
  paise,
}: {
  label: string;
  percent: number | null;
  paise: number;
}) {
  const tone = percent == null ? 'flat' : percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  return (
    <article className={`gold-rate-shift-stat ${tone}`}>
      <small>{label}</small>
      <strong>
        {percent == null ? (
          '—'
        ) : (
          <>
            {percent > 0 ? <ArrowUpRight /> : percent < 0 ? <ArrowDownRight /> : <Minus />}
            {formatPercent(percent)}
          </>
        )}
      </strong>
      {paise ? <span>{money(Math.abs(paise))}</span> : null}
    </article>
  );
}

export function GoldRateDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    rateRupees: '',
    effectiveFrom: '',
    notes: '',
    status: 'ACTIVE',
  });

  const detail = useQuery({
    queryKey: ['admin-gold-rate', id],
    queryFn: () => api<any>(`/admin/gold-rates/${id}`),
    enabled: Boolean(id),
  });
  const history = useQuery({
    queryKey: ['admin-gold-rates'],
    queryFn: () => api<any[]>('/admin/gold-rates'),
  });

  const record = detail.data;
  const rates = history.data ?? [];
  const index = rates.findIndex((row) => row._id === id);
  const previous = index >= 0 ? rates[index + 1] : undefined;
  const next = index > 0 ? rates[index - 1] : undefined;
  const locked = (record?.usageCount ?? 0) > 0;

  const shifts = useMemo(() => {
    if (!record) return null;
    const weekAgo = rates[index + 7];
    const monthAgo = rates[index + 30];
    return {
      previous: dayChange(record.ratePerGramPaise, previous?.ratePerGramPaise),
      next: dayChange(next?.ratePerGramPaise, record.ratePerGramPaise),
      week: dayChange(record.ratePerGramPaise, weekAgo?.ratePerGramPaise),
      month: dayChange(record.ratePerGramPaise, monthAgo?.ratePerGramPaise),
    };
  }, [record, rates, index, previous, next]);

  const chartWindow = useMemo(() => {
    if (index < 0) return rates.slice(0, 24);
    const start = Math.max(0, index - 12);
    const end = Math.min(rates.length, index + 13);
    return rates.slice(start, end);
  }, [rates, index]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        notes: form.notes || undefined,
        status: form.status,
      };
      if (!locked) {
        if (form.rateRupees) body.ratePerGramPaise = Math.round(Number(form.rateRupees) * 100);
        if (form.effectiveFrom) body.effectiveFrom = form.effectiveFrom;
      }
      return api(`/admin/gold-rates/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: async () => {
      setEditOpen(false);
      setMessage('Gold rate updated successfully.');
      await queryClient.invalidateQueries({ queryKey: ['admin-gold-rate', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-gold-rates'] });
    },
    onError: (requestError) =>
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to update rate.'),
  });

  const openEdit = () => {
    if (!record) return;
    setForm({
      rateRupees: String(record.ratePerGramPaise / 100),
      effectiveFrom: new Date(record.effectiveFrom).toISOString().slice(0, 16),
      notes: record.notes ?? '',
      status: record.status ?? 'ACTIVE',
    });
    setError('');
    setEditOpen(true);
  };

  return (
    <Page
      title="Gold rate"
      actions={
        <button className="secondary" onClick={() => navigate('/admin/gold-rates')}>
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
        {record && shifts && (
          <div className="phonepe-detail-stack gold-rate-detail-stack">
            <section className="phonepe-detail-hero">
              <div className="phonepe-brand-badge payment">
                <Gem />
              </div>
              <div className="phonepe-detail-main">
                <div className="phonepe-detail-title-row">
                  <h2>{money(record.ratePerGramPaise)}</h2>
                  <div className="phonepe-detail-badges">
                    <Status value={record.status} />
                    <span className="phonepe-pill">916 purity</span>
                    <span className="phonepe-pill generated">{date(record.effectiveFrom)}</span>
                  </div>
                </div>
                <p>{record.notes || 'Published 916 gold rate for scheme collections'}</p>
              </div>
              <div className="phonepe-detail-actions">
                <button className="primary" onClick={openEdit}>
                  <Edit3 /> Edit
                </button>
              </div>
            </section>

            <section className="gold-rate-shift-grid">
              <ChangeStat
                label="Vs previous update"
                percent={shifts.previous.percent}
                paise={shifts.previous.paise}
              />
              <ChangeStat
                label="Vs next update"
                percent={shifts.next.percent}
                paise={shifts.next.paise}
              />
              <ChangeStat label="Vs ~7 updates ago" percent={shifts.week.percent} paise={shifts.week.paise} />
              <ChangeStat
                label="Vs ~30 updates ago"
                percent={shifts.month.percent}
                paise={shifts.month.paise}
              />
            </section>

            <section className="phonepe-panel gold-rate-chart-panel">
              <div className="phonepe-panel-head">
                <h2>Rate movement around this publish</h2>
                <small>{chartWindow.length} nearby updates</small>
              </div>
              {history.isLoading ? (
                <div className="gold-rate-trend-chart empty">
                  <p>Loading rate history…</p>
                </div>
              ) : (
                <GoldRateTrendChart
                  rates={chartWindow}
                  highlightId={id}
                  windowSize={chartWindow.length}
                />
              )}
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-facts-row">
                <Fact label="Effective from" value={date(record.effectiveFrom)} />
                <Fact label="Purity" value={record.purity ?? '916'} />
                <Fact
                  label="Used in payments"
                  value={String(record.usageCount ?? 0)}
                  hint={locked ? 'Financial fields locked' : 'Not used yet'}
                />
                <Fact label="Created by" value={record.createdBy?.name ?? '—'} />
                <Fact label="Updated by" value={record.updatedBy?.name ?? '—'} />
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Neighbouring rates</h2>
              </div>
              <div className="gold-rate-neighbours">
                {previous && (
                  <button
                    type="button"
                    className="gold-rate-neighbour"
                    onClick={() => navigate(`/admin/gold-rates/${previous._id}`)}
                  >
                    <CalendarDays />
                    <div>
                      <small>Previous</small>
                      <b>{date(previous.effectiveFrom)}</b>
                    </div>
                    <strong>{money(previous.ratePerGramPaise)}</strong>
                    <span className="gold-rate-change flat">
                      baseline
                    </span>
                  </button>
                )}
                <article className="gold-rate-neighbour current">
                  <ReceiptText />
                  <div>
                    <small>This rate</small>
                    <b>{date(record.effectiveFrom)}</b>
                  </div>
                  <strong>{money(record.ratePerGramPaise)}</strong>
                  <span
                    className={`gold-rate-change ${
                      shifts.previous.percent != null && shifts.previous.percent > 0
                        ? 'up'
                        : shifts.previous.percent != null && shifts.previous.percent < 0
                          ? 'down'
                          : 'flat'
                    }`}
                  >
                    {shifts.previous.percent != null && shifts.previous.percent > 0 ? (
                      <ArrowUpRight />
                    ) : shifts.previous.percent != null && shifts.previous.percent < 0 ? (
                      <ArrowDownRight />
                    ) : (
                      <Minus />
                    )}
                    {formatPercent(shifts.previous.percent)}
                  </span>
                </article>
                {next && (
                  <button
                    type="button"
                    className="gold-rate-neighbour"
                    onClick={() => navigate(`/admin/gold-rates/${next._id}`)}
                  >
                    <CalendarDays />
                    <div>
                      <small>Next</small>
                      <b>{date(next.effectiveFrom)}</b>
                    </div>
                    <strong>{money(next.ratePerGramPaise)}</strong>
                    <span
                      className={`gold-rate-change ${
                        shifts.next.percent != null && shifts.next.percent > 0
                          ? 'up'
                          : shifts.next.percent != null && shifts.next.percent < 0
                            ? 'down'
                            : 'flat'
                      }`}
                    >
                      {formatPercent(shifts.next.percent)}
                    </span>
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </QueryState>

      <Modal title="Edit gold rate" open={editOpen} onClose={() => setEditOpen(false)}>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {locked && (
            <p className="helper">
              This rate is already used in {record?.usageCount} payment(s). Only notes and status can
              be edited.
            </p>
          )}
          <div className="form-grid">
            <label>
              <span>Rate per gram ₹</span>
              <input
                className="form-control"
                type="number"
                min="1"
                step="0.01"
                required={!locked}
                disabled={locked}
                value={form.rateRupees}
                onChange={(event) => setForm({ ...form, rateRupees: event.target.value })}
              />
            </label>
            <label>
              <span>Effective from</span>
              <input
                className="form-control"
                type="datetime-local"
                required={!locked}
                disabled={locked}
                value={form.effectiveFrom}
                onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
              />
            </label>
            <label>
              <span>Status</span>
              <Select
                value={form.status}
                options={['ACTIVE', 'INACTIVE'].map((status) => ({
                  value: status,
                  label: status,
                }))}
                onChange={(value) => setForm({ ...form, status: value })}
              />
            </label>
            <label className="full">
              <span>Notes</span>
              <input
                className="form-control"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
          </div>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Modal>
    </Page>
  );
}
