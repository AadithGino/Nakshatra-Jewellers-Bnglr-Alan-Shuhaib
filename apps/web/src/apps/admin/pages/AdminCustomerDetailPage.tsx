import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Copy,
  Edit3,
  Gem,
  HandCoins,
  KeyRound,
  Layers3,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { AadhaarDocumentSection } from '../../../shared/components/AadhaarDocumentSection';
import { AadhaarUploadFields } from '../../../shared/components/AadhaarUploadFields';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { AdminSelect } from '../components/AdminSelect';

const typeLabel = (type?: string) =>
  type === 'GOLD_WEIGHT' ? 'Gold weight' : type === 'CASH' ? 'Cash' : '—';

const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
};

const editEmpty = {
  name: '',
  phone: '',
  customerCode: '',
  status: 'ACTIVE',
  line1: '',
  city: '',
  district: '',
  state: '',
  postalCode: '',
  nomineeName: '',
  nomineeRelationship: '',
  nomineePhone: '',
  aadhaarFrontKey: '',
  aadhaarBackKey: '',
};

function CopyChip({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <button
      type="button"
      className="phonepe-copy-chip"
      title={`Copy ${label}`}
      onClick={() => void navigator.clipboard.writeText(value)}
    >
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
      <Copy />
    </button>
  );
}

function initials(name?: string) {
  if (!name) return '—';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AdminCustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'edit' | 'enroll' | 'payout' | 'password' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(editEmpty);
  const [password, setPassword] = useState('');
  const [enrollment, setEnrollment] = useState({
    schemePlanId: '',
    enrollmentNumber: '',
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [payout, setPayout] = useState({
    schemeId: '',
    payoutType: 'REDEEM' as 'REDEEM' | 'PAYOUT',
    method: 'BANK',
    payoutDate: new Date().toISOString().slice(0, 10),
    referenceNumber: '',
    notes: '',
  });

  const details = useQuery({
    queryKey: ['admin-customer-detail', id],
    queryFn: () => api<any>(`/admin/customers/${id}`),
    enabled: Boolean(id),
  });
  const plans = useQuery({
    queryKey: ['admin-scheme-plans'],
    queryFn: () => api<any[]>('/admin/scheme-plans'),
    enabled: modal === 'enroll',
  });

  const customer = details.data?.customer;
  const schemes = details.data?.schemes ?? [];
  const payments = details.data?.payments ?? [];
  const payouts = details.data?.payouts ?? [];

  const refresh = async () => {
    await details.refetch();
    await queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
  };

  function handleError(requestError: unknown) {
    setError(
      requestError instanceof ApiError ? requestError.message : 'Action could not be completed.',
    );
  }

  const update = useMutation({
    mutationFn: () =>
      api(`/admin/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: edit.name,
          phone: edit.phone,
          status: edit.status,
          address: {
            line1: edit.line1 || undefined,
            city: edit.city || undefined,
            district: edit.district || undefined,
            state: edit.state || undefined,
            postalCode: edit.postalCode || undefined,
          },
          aadhaar:
            edit.aadhaarFrontKey || edit.aadhaarBackKey
              ? {
                  frontKey: edit.aadhaarFrontKey || undefined,
                  backKey: edit.aadhaarBackKey || undefined,
                }
              : undefined,
          nominee: edit.nomineeName
            ? {
                name: edit.nomineeName,
                relationship: edit.nomineeRelationship,
                phone: edit.nomineePhone || undefined,
              }
            : undefined,
        }),
      }),
    onSuccess: async () => {
      setModal(null);
      setMessage('Customer details updated.');
      await refresh();
    },
    onError: handleError,
  });

  const enroll = useMutation({
    mutationFn: () =>
      api('/admin/enrollments', {
        method: 'POST',
        body: JSON.stringify({ customerId: id, ...enrollment }),
      }),
    onSuccess: async () => {
      setModal(null);
      setMessage('Customer enrolled in the selected scheme.');
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] });
    },
    onError: handleError,
  });

  const createPayout = useMutation({
    mutationFn: () =>
      api('/admin/payouts', {
        method: 'POST',
        body: JSON.stringify({
          customerId: id,
          schemeId: payout.schemeId,
          payoutType: payout.payoutType,
          ...(payout.payoutType === 'PAYOUT' ? { method: payout.method } : {}),
          payoutDate: payout.payoutDate,
          referenceNumber: payout.referenceNumber || undefined,
          notes: payout.notes || undefined,
        }),
      }),
    onSuccess: async () => {
      setModal(null);
      setMessage(
        payout.payoutType === 'REDEEM'
          ? 'Gold redemption completed and the scheme was settled.'
          : 'Amount payout completed and the scheme was settled.',
      );
      await refresh();
    },
    onError: handleError,
  });

  const resetPassword = useMutation({
    mutationFn: () =>
      api(`/admin/customers/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: password }),
      }),
    onSuccess: async () => {
      setModal(null);
      setPassword('');
      setMessage('Password reset and existing sessions invalidated.');
    },
    onError: handleError,
  });

  const openEdit = () => {
    const nominee = customer?.nomineeId;
    setEdit({
      ...editEmpty,
      name: customer?.userId?.name ?? '',
      phone: customer?.userId?.phone ?? '',
      customerCode: customer?.customerCode ?? '',
      status: customer?.status ?? 'ACTIVE',
      line1: customer?.address?.line1 ?? '',
      city: customer?.address?.city ?? '',
      district: customer?.address?.district ?? '',
      state: customer?.address?.state ?? '',
      postalCode: customer?.address?.postalCode ?? '',
      nomineeName: nominee?.name ?? '',
      nomineeRelationship: nominee?.relationship ?? '',
      nomineePhone: nominee?.phone ?? '',
      aadhaarFrontKey: customer?.aadhaar?.frontKey ?? '',
      aadhaarBackKey: customer?.aadhaar?.backKey ?? '',
    });
    setError('');
    setModal('edit');
  };

  const openEnroll = () => {
    setError('');
    setEnrollment({
      schemePlanId: '',
      enrollmentNumber: '',
      startDate: new Date().toISOString().slice(0, 10),
    });
    setModal('enroll');
  };

  const openPassword = () => {
    setError('');
    setPassword('');
    setModal('password');
  };

  const openSettlement = (scheme?: any) => {
    const eligibleScheme =
      scheme ?? schemes.find((item: any) => ['ACTIVE', 'MATURED'].includes(item.status));
    setPayout({
      schemeId: eligibleScheme?._id ?? '',
      payoutType: eligibleScheme?.schemeType === 'GOLD_WEIGHT' ? 'REDEEM' : 'PAYOUT',
      method: 'BANK',
      payoutDate: new Date().toISOString().slice(0, 10),
      referenceNumber: '',
      notes: '',
    });
    setError('');
    setModal('payout');
  };

  const successfulPaid = payments
    .filter((item: any) => item.status === 'SUCCESS')
    .reduce((sum: number, item: any) => sum + (item.amountPaise ?? 0), 0);
  const totalPayoutPaise = payouts
    .filter((item: any) => item.status === 'SUCCESS')
    .reduce((sum: number, item: any) => sum + (item.amountPaise ?? 0), 0);
  const openSchemes = schemes.filter((item: any) =>
    ['ACTIVE', 'MATURED'].includes(item.status),
  );
  const remainingPaise = openSchemes.reduce(
    (sum: number, item: any) =>
      sum + Math.max(0, (item.totalPaidPaise ?? 0) - (item.totalPayoutPaise ?? 0)),
    0,
  );
  const remainingGoldMg = openSchemes.reduce(
    (sum: number, item: any) => sum + (item.totalGoldWeightMg ?? 0),
    0,
  );
  const activeSchemes = openSchemes.length;
  const canSettle = openSchemes.some(
    (item: any) => (item.totalPaidPaise ?? 0) - (item.totalPayoutPaise ?? 0) > 0,
  );

  const schemeRemainingPaise = (scheme: any) =>
    ['ACTIVE', 'MATURED'].includes(scheme.status)
      ? Math.max(0, (scheme.totalPaidPaise ?? 0) - (scheme.totalPayoutPaise ?? 0))
      : 0;
  const schemeGoldLeftMg = (scheme: any) =>
    ['ACTIVE', 'MATURED'].includes(scheme.status) ? (scheme.totalGoldWeightMg ?? 0) : 0;

  const selectedScheme = schemes.find((scheme: any) => scheme._id === payout.schemeId);
  const availablePayoutPaise = selectedScheme
    ? Math.max(0, (selectedScheme.totalPaidPaise ?? 0) - (selectedScheme.totalPayoutPaise ?? 0))
    : 0;
  const isGoldScheme = selectedScheme?.schemeType === 'GOLD_WEIGHT';

  const planOptions = (plans.data ?? [])
    .filter((plan: any) => plan.status === 'ACTIVE')
    .map((plan: any) => ({
      value: plan._id,
      label: plan.name,
      hint: `${typeLabel(plan.type)} · ${plan.durationMonths} months`,
    }));
  const selectedPlan = (plans.data ?? []).find((plan: any) => plan._id === enrollment.schemePlanId);

  const schemeOptions = schemes
    .filter((scheme: any) => ['ACTIVE', 'MATURED'].includes(scheme.status))
    .map((scheme: any) => ({
      value: scheme._id,
      label: scheme.enrollmentNumber,
      hint: `${scheme.schemePlanId?.name ?? 'Plan'} · ${typeLabel(scheme.schemeType)}`,
    }));

  const closeModal = () => {
    if (update.isPending || enroll.isPending || createPayout.isPending || resetPassword.isPending)
      return;
    setModal(null);
  };

  return (
    <Page
      title="Customer"
      actions={
        <div className="customer-page-actions">
          <button className="secondary" onClick={() => navigate('/admin/customers')}>
            <ArrowLeft /> Back
          </button>
          {customer && (
            <>
              <button type="button" className="secondary" onClick={openEdit}>
                <Edit3 /> Edit
              </button>
              <button type="button" className="secondary" onClick={openPassword}>
                <KeyRound /> Password
              </button>
              <button type="button" className="primary" onClick={openEnroll}>
                <Plus /> Enroll
              </button>
              <button
                type="button"
                className="primary"
                disabled={!canSettle}
                onClick={() => openSettlement()}
              >
                <HandCoins /> Settle
              </button>
            </>
          )}
        </div>
      }
    >
      <Notice>{message}</Notice>
      {modal === null && <Notice error>{error}</Notice>}
      <QueryState
        loading={details.isLoading}
        error={details.error}
        empty={!details.isLoading && !customer}
        retry={() => void details.refetch()}
      >
        {customer && (
          <div className="customer-detail-page">
            <section className="phonepe-detail-hero">
              <div className="phonepe-brand-badge payment customer-detail-avatar-badge">
                {initials(customer.userId?.name)}
              </div>
              <div className="phonepe-detail-main">
                <div className="phonepe-detail-title-row">
                  <h2>{customer.userId?.name}</h2>
                  <div className="phonepe-detail-badges">
                    <Status value={customer.status} />
                    <span className="phonepe-pill">
                      {schemes.length} scheme{schemes.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <p>
                  {customer.customerCode} · {customer.userId?.phone}
                  {customer.nomineeId?.name ? ` · Nominee ${customer.nomineeId.name}` : ''}
                </p>
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-facts-row">
                <div className="phonepe-fact highlight">
                  <small>Balance left</small>
                  <b>{money(remainingPaise)}</b>
                  <em>Still with customer</em>
                </div>
                <div className="phonepe-fact highlight">
                  <small>Gold left</small>
                  <b>{goldGrams(remainingGoldMg) ?? '0 g'}</b>
                  <em>Outstanding weight</em>
                </div>
                <div className="phonepe-fact">
                  <small>Collected</small>
                  <b>{money(successfulPaid)}</b>
                  <em>Lifetime payments</em>
                </div>
                <div className="phonepe-fact">
                  <small>Settled</small>
                  <b>{money(totalPayoutPaise)}</b>
                  <em>Paid out / redeemed</em>
                </div>
                <div className="phonepe-fact">
                  <small>Open schemes</small>
                  <b>
                    {activeSchemes}/{schemes.length}
                  </b>
                </div>
                <div className="phonepe-fact">
                  <small>Last login</small>
                  <b>{customer.userId?.lastLoginAt ? date(customer.userId.lastLoginAt) : 'Never'}</b>
                </div>
              </div>
            </section>

            <AadhaarDocumentSection
              aadhaar={customer.aadhaar}
              customerName={customer.userId?.name}
            />

            <section className="reports-table-card">
              <div className="reports-table-head">
                <h2>Scheme history</h2>
              </div>
              <QueryState loading={false} error={null} empty={!schemes.length}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Enrollment</th>
                        <th>Plan</th>
                        <th>Paid</th>
                        <th>Balance left</th>
                        <th>Gold left</th>
                        <th>Maturity</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemes.map((scheme: any) => (
                        <tr
                          key={scheme._id}
                          className="reports-clickable-row"
                          onClick={() => navigate(`/admin/enrollments/${scheme._id}`)}
                        >
                          <td>
                            <span className="scheme-admin-name-cell">
                              <b className="reports-inline-link">{scheme.enrollmentNumber}</b>
                              <small>{typeLabel(scheme.schemeType)}</small>
                            </span>
                          </td>
                          <td>{scheme.schemePlanId?.name ?? '—'}</td>
                          <td>{money(scheme.totalPaidPaise)}</td>
                          <td>{money(schemeRemainingPaise(scheme))}</td>
                          <td>{goldGrams(schemeGoldLeftMg(scheme)) ?? '0 g'}</td>
                          <td>{date(scheme.maturityDate)}</td>
                          <td>
                            <Status value={scheme.status} />
                          </td>
                          <td>
                            {['ACTIVE', 'MATURED'].includes(scheme.status) ? (
                              <button
                                type="button"
                                className="secondary compact"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openSettlement(scheme);
                                }}
                              >
                                Settle
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </section>

            <section className="reports-table-card">
              <div className="reports-table-head">
                <h2>Payments</h2>
              </div>
              <QueryState loading={false} error={null} empty={!payments.length}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Gold</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment: any) => (
                        <tr
                          key={payment._id}
                          className="reports-clickable-row"
                          onClick={() => navigate(`/admin/payments/${payment._id}`)}
                        >
                          <td>
                            <b className="reports-inline-link">
                              {payment.receiptNumber ?? payment.merchantTransactionId ?? payment._id.slice(-6)}
                            </b>
                          </td>
                          <td>{date(payment.paymentDate)}</td>
                          <td>{payment.method ?? '—'}</td>
                          <td>{money(payment.amountPaise)}</td>
                          <td>{goldGrams(payment.goldWeightMg) ?? '—'}</td>
                          <td>
                            <Status value={payment.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </section>

            <section className="reports-table-card">
              <div className="reports-table-head">
                <h2>Payout / redemption</h2>
              </div>
              <QueryState loading={false} error={null} empty={!payouts.length}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Gold</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((item: any) => (
                        <tr key={item._id}>
                          <td>{date(item.payoutDate)}</td>
                          <td>{item.payoutType === 'REDEEM' ? 'Gold redeemed' : 'Amount paid out'}</td>
                          <td>{item.method ?? '—'}</td>
                          <td>{money(item.amountPaise)}</td>
                          <td>{goldGrams(item.goldWeightMg) ?? '—'}</td>
                          <td>
                            <Status value={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Reference</h2>
              </div>
              <div className="phonepe-copy-list">
                <CopyChip label="Passbook ID" value={customer.customerCode} />
                <CopyChip label="Customer ID" value={customer._id} />
                <CopyChip label="User ID" value={resolveId(customer.userId)} />
                <CopyChip label="Phone" value={customer.userId?.phone} />
              </div>
            </section>
          </div>
        )}
      </QueryState>

      <Modal title="Edit customer" open={modal === 'edit'} onClose={closeModal}>
        <form
          className="plan-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            update.mutate();
          }}
        >
          <p className="plan-modal-lead">
            Updates profile, address and nominee. Login phone changes apply to the linked user account.
          </p>

          <div className="plan-modal-preview">
            <div>
              <small>Customer</small>
              <strong>{edit.name || '—'}</strong>
              <em>{edit.customerCode || '—'}</em>
            </div>
            <div>
              <small>Status</small>
              <strong>{edit.status}</strong>
              <em>{edit.phone || '—'}</em>
            </div>
          </div>

          <div className="plan-modal-fields">
            <label>
              <span>Name</span>
              <input
                className="form-control"
                required
                value={edit.name}
                onChange={(event) => setEdit({ ...edit, name: event.target.value })}
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                className="form-control"
                required
                value={edit.phone}
                onChange={(event) => setEdit({ ...edit, phone: event.target.value })}
              />
            </label>
            <label>
              <span>Passbook ID</span>
              <input className="form-control" value={edit.customerCode} disabled readOnly />
            </label>
            <label>
              <span>Status</span>
              <AdminSelect
                icon={<ShieldCheck />}
                value={edit.status}
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE', hint: 'Can enroll and pay' },
                  { value: 'INACTIVE', label: 'INACTIVE', hint: 'Hidden from new activity' },
                ]}
                onChange={(value) => setEdit({ ...edit, status: value })}
              />
            </label>
            <label className="full">
              <span>Address line</span>
              <input
                className="form-control"
                value={edit.line1}
                onChange={(event) => setEdit({ ...edit, line1: event.target.value })}
              />
            </label>
            <label>
              <span>City</span>
              <input
                className="form-control"
                value={edit.city}
                onChange={(event) => setEdit({ ...edit, city: event.target.value })}
              />
            </label>
            <label>
              <span>District</span>
              <input
                className="form-control"
                value={edit.district}
                onChange={(event) => setEdit({ ...edit, district: event.target.value })}
              />
            </label>
            <label>
              <span>State</span>
              <input
                className="form-control"
                value={edit.state}
                onChange={(event) => setEdit({ ...edit, state: event.target.value })}
              />
            </label>
            <label>
              <span>Postal code</span>
              <input
                className="form-control"
                value={edit.postalCode}
                onChange={(event) => setEdit({ ...edit, postalCode: event.target.value })}
              />
            </label>
            <AadhaarUploadFields
              frontKey={edit.aadhaarFrontKey || undefined}
              backKey={edit.aadhaarBackKey || undefined}
              frontUrl={customer?.aadhaar?.frontUrl}
              backUrl={customer?.aadhaar?.backUrl}
              disabled={update.isPending}
              onChange={({ frontKey, backKey }) =>
                setEdit({
                  ...edit,
                  aadhaarFrontKey: frontKey ?? '',
                  aadhaarBackKey: backKey ?? '',
                })
              }
            />
            <label>
              <span>Nominee name</span>
              <input
                className="form-control"
                value={edit.nomineeName}
                onChange={(event) => setEdit({ ...edit, nomineeName: event.target.value })}
              />
            </label>
            <label>
              <span>Relationship</span>
              <input
                className="form-control"
                value={edit.nomineeRelationship}
                onChange={(event) => setEdit({ ...edit, nomineeRelationship: event.target.value })}
              />
            </label>
            <label>
              <span>Nominee phone</span>
              <input
                className="form-control"
                value={edit.nomineePhone}
                onChange={(event) => setEdit({ ...edit, nomineePhone: event.target.value })}
              />
            </label>
          </div>

          <Notice error>{error}</Notice>
          <div className="plan-modal-actions">
            <button type="button" className="secondary" disabled={update.isPending} onClick={closeModal}>
              Cancel
            </button>
            <button className="primary" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Enroll customer" open={modal === 'enroll'} onClose={closeModal}>
        <form
          className="enroll-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            if (!enrollment.schemePlanId) {
              setError('Select a scheme plan.');
              return;
            }
            enroll.mutate();
          }}
        >
          <p className="enroll-modal-lead">
            {customer?.userId?.name} · {customer?.customerCode}. Maturity follows the selected plan
            and start date.
          </p>

          {selectedPlan && (
            <div className="enroll-modal-preview">
              <div>
                <small>Customer</small>
                <strong>{customer?.userId?.name ?? '—'}</strong>
                <em>{customer?.customerCode}</em>
              </div>
              <div>
                <small>Plan</small>
                <strong>{selectedPlan.name}</strong>
                <em>
                  {typeLabel(selectedPlan.type)} · {selectedPlan.durationMonths} months
                </em>
              </div>
            </div>
          )}

          <div className="enroll-modal-fields">
            <label>
              <span>Scheme plan</span>
              <AdminSelect
                required
                icon={<Layers3 />}
                placeholder="Select plan"
                value={enrollment.schemePlanId}
                options={planOptions}
                onChange={(value) => setEnrollment({ ...enrollment, schemePlanId: value })}
              />
            </label>
            <label>
              <span>Enrollment number</span>
              <input
                className="form-control"
                required
                placeholder="e.g. 1002"
                value={enrollment.enrollmentNumber}
                onChange={(event) =>
                  setEnrollment({ ...enrollment, enrollmentNumber: event.target.value })
                }
              />
            </label>
            <label className="full">
              <span>Start date</span>
              <div className="enroll-modal-date">
                <CalendarDays />
                <input
                  className="form-control"
                  type="date"
                  required
                  value={enrollment.startDate}
                  onChange={(event) => setEnrollment({ ...enrollment, startDate: event.target.value })}
                />
              </div>
            </label>
          </div>

          <Notice error>{error}</Notice>
          <div className="enroll-modal-actions">
            <button type="button" className="secondary" disabled={enroll.isPending} onClick={closeModal}>
              Cancel
            </button>
            <button className="primary" disabled={enroll.isPending}>
              {enroll.isPending ? 'Enrolling…' : 'Confirm enrollment'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Settle customer scheme" open={modal === 'payout'} onClose={closeModal}>
        <form
          className="settle-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            createPayout.mutate();
          }}
        >
          <p className="settle-modal-lead">
            {customer?.userId?.name} · {customer?.customerCode}
          </p>

          <div className="settle-modal-fields">
            <label className="full">
              <span>Scheme to settle</span>
              <AdminSelect
                required
                icon={<Layers3 />}
                placeholder="Select scheme"
                value={payout.schemeId}
                options={schemeOptions}
                onChange={(value) => {
                  const scheme = schemes.find((item: any) => item._id === value);
                  setPayout({
                    ...payout,
                    schemeId: value,
                    payoutType: scheme?.schemeType === 'GOLD_WEIGHT' ? 'REDEEM' : 'PAYOUT',
                  });
                }}
              />
            </label>
          </div>

          {selectedScheme && (
            <>
              <div className="settle-modal-result">
                <div>
                  <small>Available</small>
                  <strong>
                    {payout.payoutType === 'REDEEM'
                      ? (goldGrams(selectedScheme.totalGoldWeightMg) ?? '0 g')
                      : money(availablePayoutPaise)}
                  </strong>
                  <em>
                    {payout.payoutType === 'REDEEM' ? '916 gold weight' : 'Remaining paid amount'}
                  </em>
                </div>
                <ArrowRight className="settle-modal-arrow" />
                <div>
                  <small>After settlement</small>
                  <strong>{payout.payoutType === 'REDEEM' ? 'REDEEMED' : 'WITHDRAWN'}</strong>
                  <em>Scheme closed permanently</em>
                </div>
              </div>

              <div className="settle-modal-toggle" role="radiogroup" aria-label="Settlement option">
                <button
                  type="button"
                  role="radio"
                  aria-checked={payout.payoutType === 'REDEEM'}
                  className={payout.payoutType === 'REDEEM' ? 'active' : ''}
                  disabled={!isGoldScheme || (selectedScheme.totalGoldWeightMg ?? 0) <= 0}
                  onClick={() => setPayout({ ...payout, payoutType: 'REDEEM' })}
                >
                  <Gem />
                  <span>
                    <b>Redeem gold</b>
                    <small>
                      {isGoldScheme
                        ? (goldGrams(selectedScheme.totalGoldWeightMg) ?? '0 g')
                        : 'Gold schemes only'}
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={payout.payoutType === 'PAYOUT'}
                  className={payout.payoutType === 'PAYOUT' ? 'active' : ''}
                  disabled={availablePayoutPaise <= 0}
                  onClick={() => setPayout({ ...payout, payoutType: 'PAYOUT' })}
                >
                  <Banknote />
                  <span>
                    <b>Payout amount</b>
                    <small>{money(availablePayoutPaise)}</small>
                  </span>
                </button>
              </div>

              <div className="settle-modal-fields">
                {payout.payoutType === 'PAYOUT' && (
                  <label>
                    <span>Payout method</span>
                    <AdminSelect
                      value={payout.method}
                      placeholder="Select method"
                      icon={<Banknote />}
                      options={[
                        { value: 'BANK', label: 'Bank transfer' },
                        { value: 'UPI', label: 'UPI' },
                        { value: 'CASH', label: 'Cash' },
                      ]}
                      onChange={(value) => setPayout({ ...payout, method: value })}
                    />
                  </label>
                )}
                <label>
                  <span>Settlement date</span>
                  <div className="enroll-modal-date">
                    <CalendarDays />
                    <input
                      className="form-control"
                      type="date"
                      required
                      value={payout.payoutDate}
                      onChange={(event) => setPayout({ ...payout, payoutDate: event.target.value })}
                    />
                  </div>
                </label>
                <label className={payout.payoutType === 'PAYOUT' ? '' : 'full'}>
                  <span>Reference / voucher</span>
                  <input
                    className="form-control"
                    placeholder="Optional voucher number"
                    value={payout.referenceNumber}
                    onChange={(event) =>
                      setPayout({ ...payout, referenceNumber: event.target.value })
                    }
                  />
                </label>
                <label className="full">
                  <span>Notes</span>
                  <input
                    className="form-control"
                    placeholder="Optional settlement note"
                    value={payout.notes}
                    onChange={(event) => setPayout({ ...payout, notes: event.target.value })}
                  />
                </label>
              </div>

              <p className="settle-modal-note">
                This completes the scheme. Entitlement is calculated by the server and cannot be
                increased manually.
              </p>
            </>
          )}

          <Notice error>{error}</Notice>
          <div className="settle-modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={createPayout.isPending}
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              className="primary"
              disabled={
                createPayout.isPending ||
                !selectedScheme ||
                availablePayoutPaise <= 0 ||
                (payout.payoutType === 'REDEEM' &&
                  (!isGoldScheme || (selectedScheme.totalGoldWeightMg ?? 0) <= 0))
              }
            >
              {createPayout.isPending
                ? 'Settling…'
                : payout.payoutType === 'REDEEM'
                  ? 'Confirm redemption'
                  : 'Confirm payout'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Reset password" open={modal === 'password'} onClose={closeModal}>
        <form
          className="settle-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            if (password.length < 10) {
              setError('Password must be at least 10 characters.');
              return;
            }
            resetPassword.mutate();
          }}
        >
          <p className="settle-modal-lead">
            Sets a new temporary password for {customer?.userId?.name ?? 'this customer'} and signs
            out all existing sessions.
          </p>

          <div className="settle-modal-fields">
            <label className="full">
              <span>New password</span>
              <div className="enroll-modal-date">
                <KeyRound />
                <input
                  className="form-control"
                  type="password"
                  minLength={10}
                  required
                  placeholder="Minimum 10 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>
          </div>

          <p className="settle-modal-note">Share the new password securely. It is not stored in plain text.</p>
          <Notice error>{error}</Notice>
          <div className="settle-modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={resetPassword.isPending}
              onClick={closeModal}
            >
              Cancel
            </button>
            <button className="primary" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
