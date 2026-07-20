import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarDays, Gem, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { GoldRateBanner, Page, QueryState } from '../../../shared/components/ui';

export function CustomerRateHistoryPage() {
  const rates = useQuery({ queryKey: ['customer-gold-rates'], queryFn: () => api<any[]>('/customer/gold-rates') });
  const current = rates.data?.[0];
  const recent = rates.data?.slice(0, 12) ?? [];
  const values = [...recent].reverse().map((item) => item.ratePerGramPaise);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const points = values.map((value, index) => `${values.length === 1 ? 50 : (index / (values.length - 1)) * 100},${90 - ((value - min) / Math.max(1, max - min)) * 75}`).join(' ');
  return <Page title="916 rate history" subtitle="See the published rate used to calculate gold weight." actions={<Link className="secondary" to="/customer"><ArrowLeft /> Home</Link>}>
    <QueryState loading={rates.isLoading} error={rates.error} empty={!rates.isLoading && !rates.data?.length} retry={() => void rates.refetch()}>
      <div className="rate-history-stack">
        <GoldRateBanner ratePaise={current?.ratePerGramPaise} updatedAt={current?.effectiveFrom} />
        <section className="rate-chart-card"><div className="section-heading"><div><span>Recent movement</span><h2>916 gold rate trend</h2></div><small>Last {recent.length} updates</small></div><div className="rate-chart-summary"><div><small>Highest</small><strong>{money(Math.max(...values))}/g</strong></div><div><small>Lowest</small><strong>{money(Math.min(...values))}/g</strong></div><div><small>Latest</small><strong>{money(current?.ratePerGramPaise)}/g</strong></div></div><div className="rate-line-chart" aria-label="Recent 916 gold rate trend"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c89222" stopOpacity=".35"/><stop offset="1" stopColor="#c89222" stopOpacity="0"/></linearGradient></defs><polyline className="rate-area" points={`0,100 ${points} 100,100`} /><polyline className="rate-line" points={points} /></svg></div><div className="chart-caption"><span>{recent.at(-1) ? date(recent.at(-1).effectiveFrom) : ''}</span><span>{current ? date(current.effectiveFrom) : ''}</span></div></section>
        <section><div className="section-heading"><div><span>Published ledger</span><h2>Rate updates</h2></div><small>916 purity only</small></div><div className="rate-ledger">{rates.data?.map((item,index)=>{const previous=rates.data?.[index+1];const difference=previous ? item.ratePerGramPaise-previous.ratePerGramPaise : 0;return <article key={item._id}><span className="rate-date-icon"><CalendarDays /></span><div><b>{date(item.effectiveFrom)}</b><small>{item.notes || 'Published 916 gold rate'}</small></div><strong>{money(item.ratePerGramPaise)}<small>/g</small></strong><span className={`rate-change ${difference>0?'up':difference<0?'down':''}`}>{difference>0?<ArrowUpRight/>:difference<0?<ArrowDownRight/>:<Minus/>}{difference ? money(Math.abs(difference)) : '—'}</span></article>})}</div></section>
        <p className="rate-disclaimer"><Gem /> For gold-weight schemes, the rate saved against each successful payment is permanent and shown in your passbook.</p>
      </div>
    </QueryState>
  </Page>;
}
