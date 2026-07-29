import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Gem,
  IndianRupee,
  MapPin,
  Phone,
  Plus,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { useAuth } from '../../../shared/hooks/useAuth';
import { date, money } from '../../../shared/utils/format';
import { AadhaarDocumentSection } from '../../../shared/components/AadhaarDocumentSection';
import { Card, Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

export function StaffCustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [enrollment, setEnrollment] = useState({
    schemePlanId: '',
    enrollmentNumber: '',
    startDate: new Date().toISOString().slice(0, 10),
  });
  const details = useQuery({
    queryKey: ['staff-customer-detail', id],
    queryFn: () => api<any>(`/staff/customers/${id}`),
    enabled: Boolean(id),
  });
  const plans = useQuery({
    queryKey: ['staff-scheme-plans'],
    queryFn: () => api<any[]>('/staff/scheme-plans'),
  });
  const enroll = useMutation({
    mutationFn: () =>
      api('/staff/enrollments', {
        method: 'POST',
        body: JSON.stringify({ customerId: id, ...enrollment }),
      }),
    onSuccess: async () => {
      setEnrollOpen(false);
      setMessage('Customer enrolled successfully.');
      await details.refetch();
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to enroll customer.',
      ),
  });
  const customer = details.data?.customer;
  const canEnroll = session?.permissions.includes('canEnrollScheme');
  const canCollect = session?.permissions.includes('canCollectPayment');
  const hasActiveScheme = details.data?.schemes?.some((scheme: any) => scheme.status === 'ACTIVE');

  return (
    <Page
      title={customer?.userId?.name ?? 'Customer detail'}
      subtitle={
        customer
          ? `${customer.customerCode} · ${customer.userId?.phone}`
          : 'Customer account details'
      }
      actions={
        <Link className="scheme-back-link" to="/staff/customers">
          <ArrowLeft />
          <span>Back</span>
        </Link>
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
          <div className="customer-workspace-stack">
            <section className="customer-workspace-hero">
              <span className="workspace-avatar">
                <UserRound />
              </span>
              <div className="workspace-identity">
                <small>Customer account</small>
                <h2>{customer.userId?.name}</h2>
                <p>
                  <Phone /> {customer.userId?.phone}
                </p>
                <p className="workspace-code">{customer.customerCode}</p>
              </div>
              <Status value={customer.status} />
              <div className="workspace-actions">
                {canCollect && hasActiveScheme && (
                  <button
                    className="primary"
                    onClick={() => navigate(`/staff/collect?customer=${id}`)}
                  >
                    <WalletCards /> Collect
                  </button>
                )}
                {canEnroll && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setError('');
                      setEnrollOpen(true);
                    }}
                  >
                    <Plus /> Enroll
                  </button>
                )}
              </div>
            </section>

            <AadhaarDocumentSection
              aadhaar={customer.aadhaar}
              customerName={customer.userId?.name}
            />

            <section className="detail-highlight-grid scheme-facts-grid">
              <article>
                <MapPin />
                <span>
                  <small>Address</small>
                  <b>
                    {[customer.address?.line1, customer.address?.city, customer.address?.state]
                      .filter(Boolean)
                      .join(', ') || 'Not provided'}
                  </b>
                </span>
              </article>
              <article>
                <UsersRound />
                <span>
                  <small>Nominee</small>
                  <b>
                    {customer.nomineeId?.name ?? 'Not provided'}
                    {customer.nomineeId?.relationship
                      ? ` · ${customer.nomineeId.relationship}`
                      : ''}
                  </b>
                </span>
              </article>
            </section>

            <Card className="workspace-schemes-card">
              <div className="section-heading">
                <div>
                  <span>Savings plan</span>
                  <h2>Scheme overview</h2>
                </div>
                <small>{details.data.schemes?.length ?? 0} schemes</small>
              </div>
              {details.data.schemes?.length ? (
                <div className="passbook-ledger">
                  {details.data.schemes.map((scheme: any) => {
                    const isGold = scheme.schemeType === 'GOLD_WEIGHT';
                    return (
                      <article className="passbook-entry" key={scheme._id}>
                        <div className="passbook-entry-top">
                          <span className={`scheme-type-icon ${isGold ? 'gold' : ''}`}>
                            {isGold ? <Gem /> : <IndianRupee />}
                          </span>
                          <div className="passbook-entry-copy">
                            <b>{scheme.enrollmentNumber}</b>
                            <small>
                              {isGold ? 'Gold weight' : 'Cash'} · Flexible contributions
                            </small>
                            <small>
                              <CalendarDays /> Completes {date(scheme.maturityDate)}
                            </small>
                          </div>
                          <div className="passbook-entry-value">
                            <strong>{money(scheme.totalPaidPaise)}</strong>
                            {scheme.totalGoldWeightMg > 0 && (
                              <small>{(scheme.totalGoldWeightMg / 1000).toFixed(3)} g</small>
                            )}
                          </div>
                        </div>
                        <div className="passbook-entry-footer">
                          <em className={isGold ? '' : 'cash'}>
                            {isGold ? '916 gold scheme' : 'Cash savings scheme'}
                          </em>
                          <Status value={scheme.status} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="helper">No schemes enrolled yet.</p>
              )}
            </Card>

            <Card className="workspace-payments-card">
              <div className="section-heading">
                <div>
                  <span>Passbook</span>
                  <h2>Payment history</h2>
                </div>
                <small>{details.data.payments?.length ?? 0} receipts</small>
              </div>
              {details.data.payments?.length ? (
                <div className="passbook-ledger">
                  {details.data.payments.map((payment: any) => (
                    <article className="passbook-entry" key={payment._id}>
                      <div className="passbook-entry-top">
                        <span className="ledger-status" aria-hidden="true">
                          <CheckCircle2 />
                        </span>
                        <div className="passbook-entry-copy">
                          <b>{payment.receiptNumber ?? 'Pending receipt'}</b>
                          <small>
                            {date(payment.paymentDate)} · {payment.method}
                          </small>
                        </div>
                        <div className="passbook-entry-value">
                          <strong>{money(payment.amountPaise)}</strong>
                          {payment.goldWeightMg ? (
                            <small>{(payment.goldWeightMg / 1000).toFixed(3)} g</small>
                          ) : (
                            <Status value={payment.status} />
                          )}
                        </div>
                      </div>
                      <div className="passbook-entry-footer">
                        {payment.goldWeightMg ? (
                          <em>{(payment.goldWeightMg / 1000).toFixed(3)} g credited</em>
                        ) : (
                          <em className="cash">Cash contribution</em>
                        )}
                        <span>
                          Receipt
                          <ChevronRight />
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="helper">No payments recorded.</p>
              )}
            </Card>
          </div>
        )}
      </QueryState>
      <Modal
        title="Enroll customer in scheme"
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
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
              {plans.data?.map((plan) => (
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
            Enroll customer
          </button>
        </form>
      </Modal>
    </Page>
  );
}
