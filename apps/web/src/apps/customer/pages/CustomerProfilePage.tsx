import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, HandCoins, MapPin, Phone, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Page, QueryState, Status } from '../../../shared/components/ui';

export function CustomerProfilePage() {
  const profile=useQuery({queryKey:['customer-profile'],queryFn:()=>api<any>('/customer/profile')});
  const payouts=useQuery({queryKey:['customer-payouts'],queryFn:()=>api<any[]>('/customer/payouts')});
  const notifications=useQuery({queryKey:['customer-notifications'],queryFn:()=>api<any[]>('/customer/notifications')});
  const customer=profile.data;
  const initials=customer?.userId?.name?.split(' ').map((part:string)=>part[0]).slice(0,2).join('').toUpperCase() || 'CU';
  return <Page title="Profile" subtitle="Your account, nominee and settlement activity.">
    <QueryState loading={profile.isLoading} error={profile.error} retry={()=>void profile.refetch()}>
      {customer&&<div className="profile-page-stack">
        <section className="profile-hero"><span className="profile-avatar">{initials}</span><div><small>Customer account</small><h2>{customer.userId?.name}</h2><p>{customer.customerCode}</p></div><Status value={customer.status}/></section>
        <section className="profile-info-card"><div className="section-heading"><div><span>Verified details</span><h2>Personal information</h2></div><ShieldCheck /></div><div className="profile-info-list"><article><span><Phone/></span><div><small>Mobile number</small><b>{customer.userId?.phone}</b></div></article><article><span><MapPin/></span><div><small>Address</small><b>{[customer.address?.line1,customer.address?.city,customer.address?.district,customer.address?.state,customer.address?.postalCode].filter(Boolean).join(', ')||'Not provided'}</b></div></article><article><span><UsersRound/></span><div><small>Nominee</small><b>{customer.nomineeId?.name??'Not provided'}</b><p>{customer.nomineeId?.relationship}{customer.nomineeId?.phone?` · ${customer.nomineeId.phone}`:''}</p></div></article></div></section>
        <section><div className="section-heading"><div><span>Settlements</span><h2>Redemption / payout history</h2></div><HandCoins/></div><QueryState loading={payouts.isLoading} error={payouts.error} empty={!payouts.isLoading&&!payouts.data?.length} retry={()=>void payouts.refetch()}>{payouts.data?.map((item)=><article className="activity-card" key={item._id}><span className="activity-icon"><HandCoins/></span><div><b>{item.payoutType==='REDEEM'?'Gold redemption':'Amount payout'}</b><small>{date(item.payoutDate)} · {item.method}</small><p>{item.notes||item.referenceNumber||'Scheme settlement'}</p></div><div><strong>{item.payoutType==='REDEEM'&&item.goldWeightMg?`${(item.goldWeightMg/1000).toFixed(3)} g`:money(item.amountPaise)}</strong><Status value={item.status}/></div><ChevronRight/></article>)}</QueryState></section>
        <section><div className="section-heading"><div><span>Account messages</span><h2>Notifications</h2></div><Bell/></div><QueryState loading={notifications.isLoading} error={notifications.error} empty={!notifications.isLoading&&!notifications.data?.length} retry={()=>void notifications.refetch()}>{notifications.data?.map((item)=><article className="notification-card" key={item._id}><span><Bell/></span><div><b>{item.title}</b><p>{item.body}</p><small>{date(item.createdAt)}</small></div></article>)}</QueryState></section>
        <p className="profile-security-note"><UserRound/> Contact Nakshathra staff to update verified account or nominee details.</p>
      </div>}
    </QueryState>
  </Page>;
}
