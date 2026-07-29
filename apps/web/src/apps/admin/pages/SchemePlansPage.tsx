import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BadgeIndianRupee,
  ChevronLeft,
  ChevronRight,
  Gem,
  Layers3,
  Plus,
  Search,
  WalletCards,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { money } from '../../../shared/utils/format';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { AdminSelect } from '../components/AdminSelect';

const PAGE_SIZE = 10;

const typeLabel = (type?: string) =>
  type === 'GOLD_WEIGHT' ? 'Gold weight' : type === 'CASH' ? 'Cash' : '—';

const emptyForm = {
  name: '',
  type: 'GOLD_WEIGHT',
  durationMonths: '11',
  minimumPaymentRupees: '',
  termsText: '',
  benefitText: '',
  makingChargeBenefit: '',
  wastageBenefit: '',
};

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="reports-pagination">
      <span>
        Showing {from} to {to} of {total.toLocaleString('en-IN')} entries
      </span>
      <div>
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft />
        </button>
        <button type="button" className="active">
          {page}
        </button>
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

export function SchemePlansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const list = useQuery({
    queryKey: ['admin-scheme-plans'],
    queryFn: () => api<any[]>('/admin/scheme-plans'),
  });

  const plans = list.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((row) =>
      [row.name, row.type, row.status, typeLabel(row.type), money(row.minimumPaymentPaise)]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [plans, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const summary = useMemo(() => {
    const active = plans.filter((row) => row.status === 'ACTIVE');
    return {
      total: plans.length,
      active: active.length,
      gold: active.filter((row) => row.type === 'GOLD_WEIGHT').length,
      cash: active.filter((row) => row.type === 'CASH').length,
    };
  }, [plans]);

  const openCreate = () => {
    setError('');
    setForm(emptyForm);
    setCreateOpen(true);
  };

  const create = useMutation({
    mutationFn: () =>
      api('/admin/scheme-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          durationMonths: Number(form.durationMonths),
          minimumPaymentPaise: Math.round(Number(form.minimumPaymentRupees) * 100),
          termsText: form.termsText,
          benefitText: form.benefitText || undefined,
          makingChargeBenefit: form.makingChargeBenefit || undefined,
          wastageBenefit: form.wastageBenefit || undefined,
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setMessage('Scheme plan created successfully.');
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['admin-scheme-plans'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to create scheme plan.',
      ),
  });

  return (
    <Page title="Scheme plans" subtitle="Product catalogue for gold-weight and cash savings schemes.">
      <Notice>{message}</Notice>
      <div className="scheme-admin-page">
        <section className="admin-module-strip">
          <div className="admin-module-strip-main">
            <span className="admin-module-strip-icon">
              <Layers3 />
            </span>
            <div className="admin-module-strip-copy">
              <small>Active catalogue</small>
              <strong>{summary.active.toLocaleString('en-IN')} live plans</strong>
            </div>
            <span className="admin-module-strip-meta">
              {summary.gold} gold · {summary.cash} cash
            </span>
          </div>
          <button type="button" className="admin-module-action" onClick={openCreate}>
            <Plus />
            Create plan
          </button>
        </section>

        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <WalletCards />
            </span>
            <div>
              <small>Total plans</small>
              <strong>{summary.total.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi success">
            <span>
              <Layers3 />
            </span>
            <div>
              <small>Active</small>
              <strong>{summary.active.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Gem />
            </span>
            <div>
              <small>Gold weight</small>
              <strong>{summary.gold.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <BadgeIndianRupee />
            </span>
            <div>
              <small>Cash</small>
              <strong>{summary.cash.toLocaleString('en-IN')}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card">
          <div className="reports-table-head">
            <h2>Plan catalogue</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search plan, type, status..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
          <QueryState
            loading={list.isLoading}
            error={list.error}
            empty={!list.isLoading && !filtered.length}
            retry={() => void list.refetch()}
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Minimum</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => (
                    <tr
                      key={row._id}
                      className="reports-clickable-row"
                      onClick={() => navigate(`/admin/scheme-plans/${row._id}`)}
                    >
                      <td>
                        <span className="scheme-admin-name-cell">
                          <b className="reports-inline-link">{row.name}</b>
                          <small>{row.benefitText || 'Flexible monthly contributions'}</small>
                        </span>
                      </td>
                      <td>
                        <span className={`scheme-type-pill ${row.type?.toLowerCase()}`}>
                          {typeLabel(row.type)}
                        </span>
                      </td>
                      <td>{row.durationMonths} months</td>
                      <td>{money(row.minimumPaymentPaise)}</td>
                      <td>
                        <Status value={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={filtered.length} onChange={setPage} />
          </QueryState>
        </section>
      </div>

      <Modal title="Create scheme plan" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          className="plan-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            create.mutate();
          }}
        >
          <p className="plan-modal-lead">
            New plans become available for enrollment immediately when saved as active.
          </p>

          <div className="plan-modal-preview">
            <div>
              <small>Plan type</small>
              <strong>{typeLabel(form.type)}</strong>
              <em>{form.durationMonths || '—'} month tenure</em>
            </div>
            <div>
              <small>Minimum payment</small>
              <strong>
                {form.minimumPaymentRupees
                  ? `₹${Number(form.minimumPaymentRupees).toLocaleString('en-IN')}`
                  : '—'}
              </strong>
              <em>{form.name || 'Name this plan'}</em>
            </div>
          </div>

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
            <label className="full">
              <span>Plan name</span>
              <input
                className="form-control"
                required
                placeholder="e.g. Nakshathra Gold Eleven"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
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
                placeholder="100"
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
                placeholder="Customer-facing scheme terms"
                value={form.termsText}
                onChange={(event) => setForm({ ...form, termsText: event.target.value })}
              />
            </label>
            <label className="full">
              <span>Benefit summary</span>
              <input
                className="form-control"
                placeholder="Short benefit line shown to customers"
                value={form.benefitText}
                onChange={(event) => setForm({ ...form, benefitText: event.target.value })}
              />
            </label>
            <label>
              <span>Making charge benefit</span>
              <input
                className="form-control"
                placeholder="Optional"
                value={form.makingChargeBenefit}
                onChange={(event) => setForm({ ...form, makingChargeBenefit: event.target.value })}
              />
            </label>
            <label>
              <span>Wastage benefit</span>
              <input
                className="form-control"
                placeholder="Optional"
                value={form.wastageBenefit}
                onChange={(event) => setForm({ ...form, wastageBenefit: event.target.value })}
              />
            </label>
          </div>

          <Notice error>{error}</Notice>
          <div className="plan-modal-actions">
            <button type="button" className="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="primary" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create plan'}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
