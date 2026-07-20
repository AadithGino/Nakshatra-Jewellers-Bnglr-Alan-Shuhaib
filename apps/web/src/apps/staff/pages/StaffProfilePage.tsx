import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CalendarClock, Check, KeyRound, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date } from '../../../shared/utils/format';
import { Page, QueryState } from '../../../shared/components/ui';

const permissionLabels: Record<string, string> = {
  canCreateCustomer: 'Create customer accounts',
  canEnrollScheme: 'Enroll customers in schemes',
  canCollectPayment: 'Collect customer payments',
  canViewCustomers: 'View customer records',
  canSubmitCorrectionRequest: 'Request payment corrections',
};

export function StaffProfilePage() {
  const query = useQuery({
    queryKey: ['staff-profile'],
    queryFn: () => api<any>('/staff/profile'),
  });
  const profile = query.data;
  const initials =
    profile?.userId?.name
      ?.split(' ')
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'ST';

  return (
    <Page title="My profile" subtitle="Your account details and assigned permissions.">
      <QueryState
        loading={query.isLoading}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {profile && (
          <div className="staff-profile-stack">
            <section className="staff-profile-hero">
              <span className="profile-avatar">{initials}</span>
              <div>
                <small>Nakshathra staff</small>
                <h2>{profile.userId?.name}</h2>
                <p>{profile.employeeCode}</p>
              </div>
              <span className="verified-customer">
                <BadgeCheck /> Active
              </span>
            </section>

            <section className="staff-profile-info">
              <article>
                <span>
                  <Phone />
                </span>
                <div>
                  <small>Mobile number</small>
                  <b>{profile.userId?.phone}</b>
                </div>
              </article>
              <article>
                <span>
                  <UserRound />
                </span>
                <div>
                  <small>Employee code</small>
                  <b>{profile.employeeCode || '—'}</b>
                </div>
              </article>
              <article>
                <span>
                  <CalendarClock />
                </span>
                <div>
                  <small>Last login</small>
                  <b>
                    {profile.userId?.lastLoginAt
                      ? date(profile.userId.lastLoginAt)
                      : 'Current session'}
                  </b>
                </div>
              </article>
            </section>

            <section className="permissions-panel">
              <div className="section-title-row">
                <span className="section-icon">
                  <ShieldCheck />
                </span>
                <div>
                  <h2>Assigned permissions</h2>
                  <p>Actions enabled for this staff account.</p>
                </div>
              </div>
              <div className="permission-list">
                {profile.permissions?.map((permission: string) => (
                  <article key={permission}>
                    <span>
                      <Check />
                    </span>
                    <div>
                      <b>{permissionLabels[permission] || permission}</b>
                      <small>Approved by administrator</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <p className="profile-security-note">
              <KeyRound /> Contact an administrator to change access permissions or account details.
            </p>
          </div>
        )}
      </QueryState>
    </Page>
  );
}
