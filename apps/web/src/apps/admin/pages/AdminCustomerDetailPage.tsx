import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Edit3, Gem, HandCoins, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import {
  Card,
  Metric,
  Modal,
  Notice,
  Page,
  QueryState,
  Status,
} from '../../../shared/components/ui';

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
};

export function AdminCustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'edit' | 'enroll' | 'payout' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(editEmpty);
  const [enrollment, setEnrollment] = useState({
    schemePlanId: '',
    enrollmentNumber: '',
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [payout, setPayout] = useState({
    schemeId: '',
    payoutType: 'REDEEM',
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
  });
  const customer = details.data?.customer;
  const refresh = async () => {
    await details.refetch();
    await queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
  };
  const update = useMutation({
    mutationFn: () =>
      api(`/admin/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: edit.name,
          phone: edit.phone,
          customerCode: edit.customerCode,
          status: edit.status,
          address: {
            line1: edit.line1 || undefined,
            city: edit.city || undefined,
            district: edit.district || undefined,
            state: edit.state || undefined,
            postalCode: edit.postalCode || undefined,
          },
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
    mutationFn: (newPassword: string) =>
      api(`/admin/customers/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }),
    onSuccess: () => setMessage('Password reset and existing sessions invalidated.'),
    onError: handleError,
  });
  function handleError(requestError: unknown) {
    setError(
      requestError instanceof ApiError ? requestError.message : 'Action could not be completed.',
    );
  }
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
    });
    setError('');
    setModal('edit');
  };
  const successfulPaid =
    details.data?.payments
      ?.filter((item: any) => item.status === 'SUCCESS')
      .reduce((sum: number, item: any) => sum + item.amountPaise, 0) ?? 0;
  const selectedScheme = details.data?.schemes?.find(
    (scheme: any) => scheme._id === payout.schemeId,
  );
  const availablePayoutPaise = selectedScheme
    ? selectedScheme.totalPaidPaise - selectedScheme.totalPayoutPaise
    : 0;
  const isGoldScheme = selectedScheme?.schemeType === 'GOLD_WEIGHT';
  const openSettlement = (scheme?: any) => {
    const eligibleScheme =
      scheme ??
      details.data?.schemes?.find((item: any) => ['ACTIVE', 'MATURED'].includes(item.status));
    setPayout((current) => ({
      ...current,
      schemeId: eligibleScheme?._id ?? '',
      payoutType: eligibleScheme?.schemeType === 'GOLD_WEIGHT' ? 'REDEEM' : 'PAYOUT',
      method: 'BANK',
      referenceNumber: '',
      notes: '',
    }));
    setError('');
    setModal('payout');
  };

  return (
    <Page
      title={customer?.userId?.name ?? 'Customer detail'}
      subtitle={
        customer
          ? `${customer.customerCode} · ${customer.userId?.phone}`
          : 'Complete customer workspace'
      }
      actions={
        <button className="secondary" onClick={() => navigate('/admin/customers')}>
          <ArrowLeft /> Customers
        </button>
      }
    >
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <QueryState
        loading={details.isLoading}
        error={details.error}
        retry={() => void details.refetch()}
      >
        {customer && (
          <div className="stack">
            <Card className="stack admin-entity-hero customer-entity-hero">
              <div className="toolbar">
                <div>
                  <h2>{customer.userId?.name}</h2>
                  <p>
                    {customer.customerCode} · <Status value={customer.status} />
                  </p>
                </div>
                <div className="actions">
                  <button className="secondary" onClick={openEdit}>
                    <Edit3 /> Edit
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      setError('');
                      setModal('enroll');
                    }}
                  >
                    <Plus /> Enroll scheme
                  </button>
                  <button
                    className="primary"
                    disabled={
                      !details.data.schemes?.some((item: any) =>
                        ['ACTIVE', 'MATURED'].includes(item.status),
                      )
                    }
                    onClick={() => openSettlement()}
                  >
                    <HandCoins /> Redeem / payout
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      const value = window.prompt('New password (minimum 10 characters)');
                      if (value) resetPassword.mutate(value);
                    }}
                  >
                    Reset password
                  </button>
                </div>
              </div>
              <div className="metrics">
                <Metric label="Schemes" value={details.data.schemes?.length ?? 0} />
                <Metric label="Successful paid" value={money(successfulPaid)} />
                <Metric
                  label="Gold accumulated"
                  value={`${((details.data.schemes?.reduce((sum: number, item: any) => sum + (item.totalGoldWeightMg ?? 0), 0) ?? 0) / 1000).toFixed(3)} g`}
                />
                <Metric
                  label="Total payouts"
                  value={money(
                    details.data.payouts?.reduce(
                      (sum: number, item: any) => sum + item.amountPaise,
                      0,
                    ),
                  )}
                />
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <small>Address</small>
                  <b>
                    {[
                      customer.address?.line1,
                      customer.address?.city,
                      customer.address?.district,
                      customer.address?.state,
                      customer.address?.postalCode,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </b>
                </div>
                <div className="detail-item">
                  <small>Nominee</small>
                  <b>
                    {customer.nomineeId?.name ?? '—'}{' '}
                    {customer.nomineeId?.relationship ? `· ${customer.nomineeId.relationship}` : ''}
                  </b>
                </div>
                <div className="detail-item">
                  <small>Last login</small>
                  <b>
                    {customer.userId?.lastLoginAt ? date(customer.userId.lastLoginAt) : 'Never'}
                  </b>
                </div>
              </div>
            </Card>
            <Card title="Scheme history" className="admin-detail-section">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Enrollment</th>
                      <th>Plan</th>
                      <th>Maturity</th>
                      <th>Paid</th>
                      <th>Gold</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.data.schemes?.map((scheme: any) => (
                      <tr key={scheme._id}>
                        <td>{scheme.enrollmentNumber}</td>
                        <td>{scheme.schemePlanId?.name}</td>
                        <td>{date(scheme.maturityDate)}</td>
                        <td>{money(scheme.totalPaidPaise)}</td>
                        <td>{((scheme.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g</td>
                        <td>
                          <Status value={scheme.status} />
                        </td>
                        <td>
                          {['ACTIVE', 'MATURED'].includes(scheme.status) ? (
                            <button
                              className="secondary compact"
                              onClick={() => openSettlement(scheme)}
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
            </Card>
            <Card title="Payments and receipts" className="admin-detail-section">
              {details.data.payments?.map((payment: any) => (
                <div className="list-row" key={payment._id}>
                  <div>
                    <b>{payment.receiptNumber ?? payment.merchantTransactionId ?? 'Pending'}</b>
                    <small>
                      {date(payment.paymentDate)} · {payment.method}
                      {payment.goldWeightMg
                        ? ` · ${(payment.goldWeightMg / 1000).toFixed(3)} g`
                        : ''}
                    </small>
                  </div>
                  <div>
                    <strong>{money(payment.amountPaise)}</strong>
                    <Status value={payment.status} />
                  </div>
                </div>
              ))}
            </Card>
            <Card title="Payout / redemption history" className="admin-detail-section">
              {details.data.payouts?.length ? (
                details.data.payouts.map((item: any) => (
                  <div className="list-row" key={item._id}>
                    <div>
                      <b>
                        {item.payoutType === 'REDEEM' ? 'Gold redeemed' : 'Amount paid out'} ·{' '}
                        {item.method}
                      </b>
                      <small>
                        {date(item.payoutDate)} ·{' '}
                        {item.referenceNumber ?? item.notes ?? 'No reference'}
                      </small>
                    </div>
                    <div>
                      <strong>
                        {item.payoutType === 'REDEEM' && item.goldWeightMg
                          ? `${(item.goldWeightMg / 1000).toFixed(3)} g gold`
                          : money(item.amountPaise)}
                      </strong>
                      {item.payoutType === 'REDEEM' && (
                        <small>{money(item.amountPaise)} paid value settled</small>
                      )}
                      <Status value={item.status} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="helper">No payouts recorded.</p>
              )}
            </Card>
          </div>
        )}
      </QueryState>
      <Modal title="Edit customer" open={modal === 'edit'} onClose={() => setModal(null)}>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            update.mutate();
          }}
        >
          <div className="form-grid">
            {Object.entries({
              name: 'Name',
              phone: 'Phone',
              customerCode: 'Customer / passbook ID',
              line1: 'Address line',
              city: 'City',
              district: 'District',
              state: 'State',
              postalCode: 'Postal code',
              nomineeName: 'Nominee name',
              nomineeRelationship: 'Relationship',
              nomineePhone: 'Nominee phone',
            }).map(([key, label]) => (
              <label className={key === 'line1' ? 'full' : ''} key={key}>
                <span>{label}</span>
                <input
                  className="form-control"
                  required={['name', 'phone', 'customerCode'].includes(key)}
                  value={(edit as any)[key]}
                  onChange={(event) => setEdit({ ...edit, [key]: event.target.value })}
                />
              </label>
            ))}
            <label>
              <span>Status</span>
              <select
                className="form-control"
                value={edit.status}
                onChange={(event) => setEdit({ ...edit, status: event.target.value })}
              >
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </label>
          </div>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={update.isPending}>
            Save customer
          </button>
        </form>
      </Modal>
      <Modal
        title="Enroll customer in a scheme"
        open={modal === 'enroll'}
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            enroll.mutate();
          }}
        >
          <label>
            <span>Scheme plan</span>
            <select
              className="form-control"
              required
              value={enrollment.schemePlanId}
              onChange={(event) =>
                setEnrollment({ ...enrollment, schemePlanId: event.target.value })
              }
            >
              <option value="">Select active plan</option>
              {plans.data
                ?.filter((plan) => plan.status === 'ACTIVE')
                .map((plan) => (
                  <option value={plan._id} key={plan._id}>
                    {plan.name} · {plan.type}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Enrollment / passbook number</span>
            <input
              className="form-control"
              required
              value={enrollment.enrollmentNumber}
              onChange={(event) =>
                setEnrollment({ ...enrollment, enrollmentNumber: event.target.value })
              }
            />
          </label>
          <label>
            <span>Start date</span>
            <input
              className="form-control"
              type="date"
              required
              value={enrollment.startDate}
              onChange={(event) => setEnrollment({ ...enrollment, startDate: event.target.value })}
            />
          </label>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={enroll.isPending}>
            Create enrollment
          </button>
        </form>
      </Modal>
      <Modal
        title="Settle customer scheme"
        open={modal === 'payout'}
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            createPayout.mutate();
          }}
        >
          <div className="settlement-flow">
            <label>
              <span>Scheme to settle</span>
              <select
                className="form-control"
                required
                value={payout.schemeId}
                onChange={(event) => {
                  const scheme = details.data?.schemes?.find(
                    (item: any) => item._id === event.target.value,
                  );
                  setPayout({
                    ...payout,
                    schemeId: event.target.value,
                    payoutType: scheme?.schemeType === 'GOLD_WEIGHT' ? 'REDEEM' : 'PAYOUT',
                  });
                }}
              >
                <option value="">Select scheme</option>
                {details.data?.schemes
                  ?.filter((scheme: any) => ['ACTIVE', 'MATURED'].includes(scheme.status))
                  .map((scheme: any) => (
                    <option value={scheme._id} key={scheme._id}>
                      {scheme.enrollmentNumber} · {scheme.schemePlanId?.name} · {scheme.schemeType}
                    </option>
                  ))}
              </select>
            </label>

            {selectedScheme && (
              <>
                <div className="settlement-summary">
                  <div>
                    <small>Remaining paid amount</small>
                    <strong>{money(availablePayoutPaise)}</strong>
                  </div>
                  <div>
                    <small>Accumulated gold</small>
                    <strong>{((selectedScheme.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g</strong>
                  </div>
                  <div>
                    <small>Scheme status</small>
                    <Status value={selectedScheme.status} />
                  </div>
                </div>

                <fieldset className="settlement-options">
                  <legend>Choose one settlement option</legend>
                  <button
                    className={`settlement-option ${payout.payoutType === 'REDEEM' ? 'selected' : ''}`}
                    type="button"
                    disabled={!isGoldScheme || selectedScheme.totalGoldWeightMg <= 0}
                    onClick={() => setPayout({ ...payout, payoutType: 'REDEEM' })}
                  >
                    <span className="settlement-icon">
                      <Gem />
                    </span>
                    <span>
                      <b>Redeem gold</b>
                      <small>
                        {isGoldScheme
                          ? `Issue ${(selectedScheme.totalGoldWeightMg / 1000).toFixed(3)} g of 916 gold`
                          : 'Available only for gold schemes'}
                      </small>
                    </span>
                  </button>
                  <button
                    className={`settlement-option ${payout.payoutType === 'PAYOUT' ? 'selected' : ''}`}
                    type="button"
                    disabled={availablePayoutPaise <= 0}
                    onClick={() => setPayout({ ...payout, payoutType: 'PAYOUT' })}
                  >
                    <span className="settlement-icon">
                      <Banknote />
                    </span>
                    <span>
                      <b>Payout amount</b>
                      <small>
                        Return the remaining paid amount of {money(availablePayoutPaise)}
                      </small>
                    </span>
                  </button>
                </fieldset>

                <div className="form-grid">
                  {payout.payoutType === 'PAYOUT' && (
                    <label>
                      <span>Payout method</span>
                      <select
                        className="form-control"
                        value={payout.method}
                        onChange={(event) => setPayout({ ...payout, method: event.target.value })}
                      >
                        <option value="BANK">Bank transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="CASH">Cash</option>
                      </select>
                    </label>
                  )}
                  <label>
                    <span>Settlement date</span>
                    <input
                      className="form-control"
                      type="date"
                      required
                      value={payout.payoutDate}
                      onChange={(event) => setPayout({ ...payout, payoutDate: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Reference / voucher number</span>
                    <input
                      className="form-control"
                      value={payout.referenceNumber}
                      onChange={(event) =>
                        setPayout({ ...payout, referenceNumber: event.target.value })
                      }
                    />
                  </label>
                  <label className="full">
                    <span>Settlement notes</span>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={payout.notes}
                      onChange={(event) => setPayout({ ...payout, notes: event.target.value })}
                    />
                  </label>
                </div>

                <div className="settlement-warning">
                  <b>This action completes the scheme.</b>
                  <span>
                    The entitlement is calculated by the server and cannot be manually increased.
                  </span>
                </div>
              </>
            )}
          </div>
          <Notice error>{error}</Notice>
          <button
            className="primary"
            disabled={
              createPayout.isPending ||
              !selectedScheme ||
              availablePayoutPaise <= 0 ||
              (payout.payoutType === 'REDEEM' &&
                (!isGoldScheme || selectedScheme.totalGoldWeightMg <= 0))
            }
          >
            {createPayout.isPending
              ? 'Completing settlement…'
              : payout.payoutType === 'REDEEM'
                ? 'Confirm gold redemption'
                : 'Confirm amount payout'}
          </button>
        </form>
      </Modal>
    </Page>
  );
}
