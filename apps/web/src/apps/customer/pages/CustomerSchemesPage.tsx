import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Gem,
  History,
  IndianRupee,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../shared/services/api.client";
import { date, money } from "../../../shared/utils/format";
import { BrandLogo } from "../../../shared/components/BrandLogo";
import { Page, QueryState } from "../../../shared/components/ui";

export function CustomerSchemesPage() {
  const schemesQuery = useQuery({
    queryKey: ["/customer/schemes"],
    queryFn: () => api<any[]>("/customer/schemes"),
  });
  const homeQuery = useQuery({
    queryKey: ["customer-home"],
    queryFn: () => api<any>("/customer/home"),
  });

  const activeScheme = schemesQuery.data?.find(
    (scheme) => scheme.status === "ACTIVE",
  );
  const status = homeQuery.data?.schemeStatus;
  const recentPayments = homeQuery.data?.recentPayments ?? [];
  const isGold = activeScheme?.schemeType === "GOLD_WEIGHT";
  const planName =
    activeScheme?.schemePlanId?.name ??
    (isGold ? "Gold Weight Scheme" : "Cash Scheme");
  const phaseLabel = status?.flexibleThroughout
    ? "Flexible"
    : status?.phase === "CAPPED"
      ? "Capped"
      : "Flexible";

  return (
    <Page
      title="My Scheme"
      subtitle="Track and manage your jewellery savings."
      actions={
        <BrandLogo variant="badge" size={40} className="my-scheme-page-logo" />
      }
    >
      <QueryState
        loading={schemesQuery.isLoading}
        error={schemesQuery.error}
        empty={!schemesQuery.isLoading && !schemesQuery.data?.length}
        retry={() => void schemesQuery.refetch()}
      >
        {activeScheme && (
          <div className="scheme-page-stack">
            <section className={`nsk-scheme-card ${isGold ? "gold" : "cash"}`}>
              <div className="nsk-scheme-top">
                <BrandLogo
                  variant="badge"
                  size={48}
                  className="nsk-scheme-logo"
                />
                <div className="nsk-scheme-identity">
                  <div className="nsk-scheme-title-row">
                    <h2>{planName}</h2>
                    <span className="nsk-active-pill">ACTIVE</span>
                  </div>
                  <b className="nsk-enrollment">
                    {activeScheme.enrollmentNumber}
                  </b>
                  <div className="nsk-chip-row">
                    <span className="nsk-outline-chip">
                      <CalendarDays /> Month {status?.schemeMonth ?? "—"} of{" "}
                      {activeScheme.durationMonths}
                    </span>
                    <span
                      className={`nsk-outline-chip phase-${phaseLabel.toLowerCase()}`}
                    >
                      {phaseLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="nsk-metrics">
                <div>
                  <small>Total Contributed</small>
                  <strong>{money(activeScheme.totalPaidPaise ?? 0)}</strong>
                </div>
                <i aria-hidden="true" />
                <div>
                  <small>
                    {isGold ? "Gold Accumulated" : "Scheme Duration"}
                  </small>
                  <strong>
                    {isGold
                      ? `${((activeScheme.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g`
                      : `${activeScheme.durationMonths} months`}
                  </strong>
                </div>
              </div>

              <div className="nsk-completion">
                <CalendarDays />
                <span>
                  Expected Completion Date{" "}
                  <b>{date(activeScheme.maturityDate)}</b>
                </span>
              </div>

              <Link
                className="nsk-pay-btn"
                to={`/customer/schemes/${activeScheme._id}/pay`}
              >
                <Lock /> Pay
              </Link>
              <Link
                className="nsk-details-link"
                to={`/customer/schemes/${activeScheme._id}`}
              >
                View complete scheme details <ChevronRight />
              </Link>
            </section>

            <section className="nsk-history-section">
              <div className="nsk-history-heading">
                <div>
                  <History />
                  <h2>Scheme History</h2>
                </div>
                <Link to="/customer/payments">
                  View All <ChevronRight />
                </Link>
              </div>
              <div className="nsk-history-list">
                {recentPayments.length
                  ? recentPayments.map((payment: any) => (
                      <Link
                        className="nsk-history-row"
                        key={payment._id}
                        to={`/customer/payments?receipt=${payment._id}`}
                      >
                        <span className="nsk-history-check" aria-hidden="true">
                          <CheckCircle2 />
                        </span>
                        <div>
                          <b>Payment Received</b>
                          <small>{date(payment.paymentDate)}</small>
                        </div>
                        <strong>{money(payment.amountPaise ?? 0)}</strong>
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    ))
                  : schemesQuery.data?.map((scheme) => (
                      <Link
                        className="nsk-history-row"
                        key={scheme._id}
                        to={`/customer/schemes/${scheme._id}`}
                      >
                        <span
                          className={`nsk-history-check ${
                            scheme.status === "ACTIVE" ? "" : "muted"
                          }`}
                          aria-hidden="true"
                        >
                          {scheme.schemeType === "GOLD_WEIGHT" ? (
                            <Gem />
                          ) : (
                            <IndianRupee />
                          )}
                        </span>
                        <div>
                          <b>
                            {scheme.schemePlanId?.name ??
                              scheme.schemeType.replace("_", " ")}
                          </b>
                          <small>{scheme.enrollmentNumber}</small>
                        </div>
                        <strong>{money(scheme.totalPaidPaise ?? 0)}</strong>
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    ))}
              </div>
            </section>
          </div>
        )}
      </QueryState>
    </Page>
  );
}
