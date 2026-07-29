import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Gem,
  Minus,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { dayChange, formatPercent } from '../../../shared/utils/goldRateChart';
import { GoldRateSparkline, rowSparklineValues } from '../../../shared/components/GoldRateSparkline';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

const PAGE_SIZE = 12;

function ChangeBadge({ percent, paise }: { percent: number | null; paise: number }) {
  if (percent == null) {
    return (
      <span className="gold-rate-change flat">
        <Minus /> —
      </span>
    );
  }
  const tone = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  return (
    <span className={`gold-rate-change ${tone}`}>
      {percent > 0 ? <ArrowUpRight /> : percent < 0 ? <ArrowDownRight /> : <Minus />}
      <span>{formatPercent(percent)}</span>
      {paise ? <em>{money(Math.abs(paise))}</em> : null}
    </span>
  );
}

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

export function GoldRatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    rateRupees: '',
    effectiveFrom: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  const list = useQuery({
    queryKey: ['admin-gold-rates'],
    queryFn: () => api<any[]>('/admin/gold-rates'),
  });

  const rates = list.data ?? [];
  const current = rates[0];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rates;
    return rates.filter((row) =>
      [date(row.effectiveFrom), row.purity, row.status, row.notes, money(row.ratePerGramPaise)]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [rates, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const summary = useMemo(() => {
    const values = rates.slice(0, 30).map((row) => row.ratePerGramPaise);
    const latestChange = dayChange(rates[0]?.ratePerGramPaise, rates[1]?.ratePerGramPaise);
    return {
      current: rates[0]?.ratePerGramPaise ?? 0,
      updates: rates.length,
      dayPercent: latestChange.percent,
      dayPaise: latestChange.paise,
      high: values.length ? Math.max(...values) : 0,
      low: values.length ? Math.min(...values) : 0,
    };
  }, [rates]);

  const previewRatePaise = form.rateRupees
    ? Math.round(Number(form.rateRupees) * 100)
    : null;
  const previewChange = previewRatePaise
    ? dayChange(previewRatePaise, current?.ratePerGramPaise)
    : null;

  const openPublish = () => {
    setError('');
    setForm({
      rateRupees: current?.ratePerGramPaise ? String(current.ratePerGramPaise / 100) : '',
      effectiveFrom: new Date().toISOString().slice(0, 16),
      notes: '',
    });
    setCreateOpen(true);
  };

  const create = useMutation({
    mutationFn: () =>
      api('/admin/gold-rates', {
        method: 'POST',
        body: JSON.stringify({
          ratePerGramPaise: Math.round(Number(form.rateRupees) * 100),
          purity: '916',
          effectiveFrom: form.effectiveFrom,
          notes: form.notes || undefined,
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setMessage('Gold rate published successfully.');
      setForm({
        rateRupees: '',
        effectiveFrom: new Date().toISOString().slice(0, 16),
        notes: '',
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-gold-rates'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to publish gold rate.',
      ),
  });

  return (
    <Page
      title="Gold rates"
      subtitle="916 purity ledger with day-over-day movement and inline trend sparklines."
    >
      <Notice>{message}</Notice>
      <div className="gold-rates-page">
        <section className="admin-gold-rate-strip">
          <div className="admin-gold-rate-strip-main">
            <span className="admin-gold-rate-strip-icon">
              <Gem />
            </span>
            <div className="admin-gold-rate-strip-copy">
              <small>Current 916 rate</small>
              <strong>{current?.ratePerGramPaise ? money(current.ratePerGramPaise) : 'Not set'}</strong>
            </div>
            {summary.dayPercent != null && (
              <span
                className={`admin-gold-rate-strip-shift ${summary.dayPercent >= 0 ? 'up' : 'down'}`}
              >
                {summary.dayPercent >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                {formatPercent(summary.dayPercent)}
              </span>
            )}
            {current?.effectiveFrom && (
              <span className="admin-gold-rate-strip-meta">
                Effective {date(current.effectiveFrom)}
              </span>
            )}
          </div>
          <button type="button" className="admin-gold-rate-publish" onClick={openPublish}>
            <Plus />
            Publish new rate
          </button>
        </section>

        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <Gem />
            </span>
            <div>
              <small>Published updates</small>
              <strong>{summary.updates.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article
            className={`dashboard-kpi ${summary.dayPercent != null && summary.dayPercent >= 0 ? 'success' : ''}`}
          >
            <span>
              {summary.dayPercent != null && summary.dayPercent < 0 ? (
                <TrendingDown />
              ) : (
                <TrendingUp />
              )}
            </span>
            <div>
              <small>Latest day shift</small>
              <strong>{formatPercent(summary.dayPercent)}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <ArrowUpRight />
            </span>
            <div>
              <small>30-day high</small>
              <strong>{money(summary.high)}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <ArrowDownRight />
            </span>
            <div>
              <small>30-day low</small>
              <strong>{money(summary.low)}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card gold-rates-table-card">
          <div className="reports-table-head">
            <h2>Rate ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search date, notes, status..."
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
              <table className="gold-rates-table">
                <thead>
                  <tr>
                    <th>Effective</th>
                    <th>Rate / g</th>
                    <th>Day shift</th>
                    <th>Recent trend</th>
                    <th>Payments</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => {
                    const absoluteIndex = rates.findIndex((item) => item._id === row._id);
                    const previous = rates[absoluteIndex + 1];
                    const change = dayChange(row.ratePerGramPaise, previous?.ratePerGramPaise);
                    const sparkValues = rowSparklineValues(rates, absoluteIndex);

                    return (
                      <tr
                        key={row._id}
                        className="reports-clickable-row"
                        onClick={() => navigate(`/admin/gold-rates/${row._id}`)}
                      >
                        <td>
                          <span className="gold-rate-date-cell">
                            <b className="reports-inline-link">{date(row.effectiveFrom)}</b>
                            <small>{row.notes || '916 published rate'}</small>
                          </span>
                        </td>
                        <td>
                          <strong className="gold-rate-amount">{money(row.ratePerGramPaise)}</strong>
                        </td>
                        <td>
                          <ChangeBadge percent={change.percent} paise={change.paise} />
                        </td>
                        <td className="gold-rate-spark-cell">
                          <GoldRateSparkline values={sparkValues} id={row._id} />
                        </td>
                        <td>{row.usageCount?.toLocaleString('en-IN') ?? 0}</td>
                        <td>
                          <Status value={row.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={filtered.length} onChange={setPage} />
          </QueryState>
        </section>
      </div>

      <Modal title="Publish gold rate" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          className="gold-rate-publish-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <p className="gold-rate-publish-lead">
            This rate applies to new gold-weight collections from the effective time onward.
          </p>

          <div className="gold-rate-publish-preview">
            <div>
              <small>Current</small>
              <strong>{current?.ratePerGramPaise ? money(current.ratePerGramPaise) : '—'}</strong>
            </div>
            <ArrowRight />
            <div>
              <small>New</small>
              <strong>
                {previewRatePaise ? money(previewRatePaise) : 'Enter rate'}
              </strong>
            </div>
            {previewChange?.percent != null && (
              <span
                className={`gold-rate-change ${
                  previewChange.percent > 0 ? 'up' : previewChange.percent < 0 ? 'down' : 'flat'
                }`}
              >
                {previewChange.percent > 0 ? <ArrowUpRight /> : previewChange.percent < 0 ? <ArrowDownRight /> : <Minus />}
                {formatPercent(previewChange.percent)}
              </span>
            )}
          </div>

          <label className="gold-rate-publish-rate">
            <span>Rate per gram</span>
            <div className="gold-rate-publish-input">
              <em>₹</em>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="0.00"
                value={form.rateRupees}
                onChange={(event) => setForm({ ...form, rateRupees: event.target.value })}
              />
              <em>/g · 916</em>
            </div>
          </label>

          <div className="gold-rate-publish-fields">
            <label>
              <span>Effective from</span>
              <input
                className="form-control"
                type="datetime-local"
                required
                value={form.effectiveFrom}
                onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
              />
            </label>
            <label>
              <span>Notes</span>
              <input
                className="form-control"
                placeholder="Optional context for this update"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
          </div>

          <Notice error>{error}</Notice>

          <div className="gold-rate-publish-actions">
            <button type="button" className="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="primary" disabled={create.isPending}>
              {create.isPending ? 'Publishing…' : 'Publish rate'}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
