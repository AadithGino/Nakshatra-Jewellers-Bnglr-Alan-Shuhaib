import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Database, Edit3, Fingerprint, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { Card, Modal, Notice, Page, QueryState } from '../../../shared/components/ui';
import { displayOperationValue, getOperationValue, operationConfigs } from './OperationsPage';

export function OperationDetailPage({ module }: { module: string }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const config = operationConfigs[module];
  const [fallbackRecord, setFallbackRecord] = useState<any>(
    (location.state as any)?.record ?? null,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const detail = useQuery({
    queryKey: ['admin-operation-detail', module, id],
    queryFn: () => api<any>(`/admin/operation-records/${module}/${id}`),
    initialData: fallbackRecord ?? undefined,
  });
  const record = detail.data ?? fallbackRecord;
  const refresh = async () => {
    const result = await detail.refetch();
    if (result.data) setFallbackRecord(result.data);
    await queryClient.invalidateQueries({ queryKey: [config.endpoint] });
  };
  const action = useMutation({
    mutationFn: async (decision: string) => {
      if (module === 'payments') {
        const reason = window.prompt('Reason for payment reversal');
        if (!reason) return;
        await api(`/admin/payments/${id}/reverse`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
      }
      if (module === 'corrections') {
        const reviewNotes = window.prompt(`Review notes for ${decision}`);
        if (!reviewNotes) return;
        await api(`/admin/corrections/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ decision, reviewNotes }),
        });
      }
      if (module === 'enrollments') {
        const reason = window.prompt('Reason for status change');
        if (!reason) return;
        await api(`/admin/enrollments/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: decision, reason }),
        });
      }
    },
    onSuccess: async () => {
      setMessage('Action completed successfully.');
      await refresh();
    },
    onError: (requestError) =>
      setError(requestError instanceof ApiError ? requestError.message : 'Action failed.'),
  });
  const save = useMutation({
    mutationFn: () => {
      const body: any = { ...values };
      if (body.minimumPaymentRupees) {
        body.minimumPaymentPaise = Math.round(Number(body.minimumPaymentRupees) * 100);
        delete body.minimumPaymentRupees;
      }
      if (body.rateRupees) {
        body.ratePerGramPaise = Math.round(Number(body.rateRupees) * 100);
        delete body.rateRupees;
      }
      for (const key of ['durationMonths', 'flexibleMonths', 'capMonths'])
        if (body[key]) body[key] = Number(body[key]);
      return api(`${config.endpoint}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: async () => {
      setEditOpen(false);
      setMessage('Record updated successfully.');
      await refresh();
    },
    onError: (requestError) =>
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to save record.'),
  });
  const openEdit = () => {
    if (!record) return;
    setValues(
      Object.fromEntries(
        (config.fields ?? []).map((field) => {
          let value = record[field.key];
          if (field.key === 'minimumPaymentRupees') value = record.minimumPaymentPaise / 100;
          if (field.key === 'rateRupees') value = record.ratePerGramPaise / 100;
          if (field.type === 'datetime-local' && value)
            value = new Date(value).toISOString().slice(0, 16);
          return [field.key, value == null ? '' : String(value)];
        }),
      ),
    );
    setError('');
    setEditOpen(true);
  };
  const fields = record
    ? Object.keys(record).filter(
        (key) =>
          ![
            '__v',
            'originalSnapshot',
            'rawPayload',
            'flexibleMonths',
            'capMonths',
            'averageMonthlyCapPaise',
          ].includes(key),
      )
    : [];

  return (
    <Page
      title={`${config.title} detail`}
      subtitle="Complete record information and available actions."
      actions={
        <button className="secondary" onClick={() => navigate(`/admin/${module}`)}>
          <ArrowLeft /> Back to {config.title.toLowerCase()}
        </button>
      }
    >
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <QueryState
        loading={detail.isLoading && !record}
        error={detail.error}
        empty={!detail.isLoading && !record}
        retry={() => void detail.refetch()}
      >
        {record && (
          <div className="record-detail-stack">
            <section className="record-detail-hero">
              <span className="record-detail-icon"><Database /></span>
              <div className="record-detail-title">
                <small>{config.title} record</small>
                <h2>
                  {record.name ??
                    record.enrollmentNumber ??
                    record.receiptNumber ??
                    record.merchantTransactionId ??
                    'Record'}
                </h2>
                <p><Fingerprint /> {record._id}</p>
              </div>
              <div className="actions">
                {['scheme-plans', 'gold-rates'].includes(module) && (
                  <button className="primary" onClick={openEdit}>
                    <Edit3 /> Edit record
                  </button>
                )}
                {module === 'payments' && record.status === 'SUCCESS' && (
                  <button className="danger" onClick={() => action.mutate('REVERSED')}>
                    Reverse payment
                  </button>
                )}
                {module === 'corrections' && record.status === 'PENDING' && (
                  <>
                    <button className="primary" onClick={() => action.mutate('APPROVED')}>
                      Approve
                    </button>
                    <button className="danger" onClick={() => action.mutate('REJECTED')}>
                      Reject
                    </button>
                  </>
                )}
                {module === 'enrollments' &&
                  ['ACTIVE', 'MATURED'].map((status) => (
                    <button
                      className="secondary"
                      key={status}
                      onClick={() => action.mutate(status)}
                    >
                      {status}
                    </button>
                  ))}
              </div>
            </section>
            <Card className="record-fields-card"><div className="section-heading"><div><span>Record data</span><h2>Complete information</h2></div><ShieldCheck /></div><div className="record-fields-grid">
              {fields.map((key) => (
                <article key={key}>
                  <small>{key.replaceAll(/([A-Z])/g, ' $1')}</small>
                  <b>{displayOperationValue(key, getOperationValue(record, key))}</b>
                </article>
              ))}
            </div></Card>
          </div>
        )}
      </QueryState>
      <Modal
        title={`Edit ${config.title.toLowerCase()}`}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="form-grid">
            {config.fields?.map((field) => (
              <label
                className={field.key.includes('Text') || field.key === 'notes' ? 'full' : ''}
                key={field.key}
              >
                <span>{field.label}</span>
                {field.options ? (
                  <select
                    className="form-control"
                    required
                    value={values[field.key] ?? ''}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  >
                    <option value="">Select</option>
                    {field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-control"
                    type={field.type ?? 'text'}
                    required={
                      !['benefitText', 'makingChargeBenefit', 'wastageBenefit', 'notes'].includes(
                        field.key,
                      )
                    }
                    value={values[field.key] ?? ''}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={save.isPending}>
            Save changes
          </button>
        </form>
      </Modal>
    </Page>
  );
}
