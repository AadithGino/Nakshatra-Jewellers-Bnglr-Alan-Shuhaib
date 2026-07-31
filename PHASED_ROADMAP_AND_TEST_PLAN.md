# Nakshathra Platform: Phased Roadmap and Test Plan

## Scope Requested

1. Admin should be able to mark payment collection.
2. Staff collection app should support dynamic amount-based payment QR and webhook-confirmed success.
3. While adding a customer, select the joining scheme and auto-generate enrollment number.
4. Staff should see payment-type-wise collection reports, and admin should also see the same with date filter.
5. Staff should see customer scheme history plus payment history.

---

## Current System Findings (from code walkthrough)

- Manual collection already exists for both admin and staff via `createManualPayment`.
- Customer detail screens already show scheme history + payment history:
  - Admin: `apps/web/src/apps/admin/pages/AdminCustomerDetailPage.tsx`
  - Staff: `apps/web/src/apps/staff/pages/StaffCustomerDetailPage.tsx`
- Enrollment number is currently mandatory input (not auto-generated) in `createEnrollmentSchema`.
- Staff report supports date range and totals, but does not return payment-type split detail in staff-specific API output.
- **Critical blocker in PhonePe flow:** `initiatePhonePe` currently force-finalizes payment immediately (temporary test logic), so webhook-based truth is bypassed. This must be fixed before staff QR flow.

---

## Phase-by-Phase Delivery Plan

## Phase 0 - Safety Baseline (Must complete first)

### Goal
Remove behavior that can create false-positive payment success.

### Changes
- In `apps/api/src/services/gateway.service.ts`:
  - Remove the temporary "force success" block inside `initiatePhonePe`.
  - Keep intent as `PENDING` after checkout creation.
  - Let success happen only through webhook/status verification path (`processPhonePeWebhook` + `finalizeGatewayPayment`).
- Verify idempotency and duplicate webhook protection remain intact.

### Risk Control
- Feature flag fallback: keep customer online payment toggle (`customerPhonePeEnabled`) usable for emergency disable.
- Add logs/metrics around webhook processing failures.

---

## Phase 1 - Dynamic QR Collection for Staff

### Goal
Staff can generate dynamic amount-specific QR/checkout and collect payment after webhook confirmation.

### API Changes
- Add staff endpoint to initiate PhonePe for staff collections, for example:
  - `POST /staff/payments/phonepe`
  - Input: `customerId`, `schemeId`, `amountPaise`, `idempotencyKey`
  - Output: `merchantTransactionId`, `checkoutUrl`, `status`
- Add endpoint for status polling in staff app:
  - `GET /staff/payment-intents/:orderId`
- Reuse existing gateway intent model; add `collectorRole` + `collectedBy` metadata on intent if needed.
- On webhook success, create final `Payment` with `collectorRole: STAFF` and `collectedBy` as logged-in staff user.

### Web Changes
- Update `apps/web/src/apps/staff/pages/StaffCollectPaymentPage.tsx`:
  - New method option: `PHONEPE`.
  - If method is `PHONEPE`, call staff PhonePe init API and render QR/checkout link.
  - Show "Awaiting payment confirmation" state.
  - Poll status endpoint or provide refresh CTA until success/failure.
  - Generate receipt only after success is persisted.

### Risk Control
- Keep existing manual methods (`CASH/UPI/BANK/CARD`) untouched.
- Add timeout/expiry UX for stale QR intents.

---

## Phase 2 - Admin Payment Marking Improvements

### Goal
Admin can confidently mark/record payment from admin side with clear customer-scheme linkage.

### Changes
- Keep existing `POST /admin/payments/manual` path, but strengthen UX and validation:
  - In `PaymentsPage`, filter enrollments by selected customer to avoid mismatch.
  - Enforce reference number requirement for non-cash methods at UI level (align staff behavior).
  - Improve success feedback with generated receipt number.
- Optional enhancement: expose "mark as pending verification" path for online/manual references if business needs approval workflow later.

### Risk Control
- No schema-breaking change required.
- Existing reverse and correction workflows remain as fallback controls.

---

## Phase 3 - Customer Creation + Scheme Join in One Flow

### Goal
When adding customer, admin/staff can select scheme plan immediately and auto-generate enrollment number.

### API Changes
- Extend customer creation workflow to optionally accept enrollment payload:
  - `schemePlanId`
  - `startDate`
- Add enrollment number allocator service (similar to passbook and receipt allocators), e.g.:
  - Scope key: `ENROLLMENT-NUMBER`
  - Format example: `ENR-2026-000001` (final format to be frozen before implementation)
- In one transaction:
  1. create user + customer
  2. create enrollment with auto number (if scheme selected)
- Make `enrollmentNumber` optional/removed from create enrollment input exposed to UI.

### Web Changes
- Customer create modal (`CustomerManagementPage`) and staff create/enroll path:
  - Add "Join scheme now?" toggle.
  - If enabled: pick scheme plan + start date.
  - Show enrollment number as "Auto-generated".
- Admin customer detail enroll modal:
  - Remove manual enrollment number input.

### Risk Control
- Keep old `createEnrollment` endpoint backward-compatible for one release if external callers exist.

---

## Phase 4 - Payment-Type-Wise Reports (Staff + Admin)

### Goal
Staff and admin can view collection split by payment type with date filters.

### API Changes
- Extend `staffMemberReport` response to include:
  - `byMethod: [{ method, totalPaise, count }]`
  - date-filtered output
- Add/extend staff self-report endpoint:
  - either in `/staff/dashboard` payload or new `/staff/reports/collections`.
- Admin side:
  - existing reports already have date filters; add explicit "staff by method" report option if needed.

### Web Changes
- Staff payments/report page:
  - add date range picker
  - add method-wise cards/table (Cash/UPI/Bank/Card/PhonePe)
- Admin staff detail and reports page:
  - show method split per staff with date range.

### Risk Control
- Reporting is read-only; low operational risk.
- Validate sums against ledger totals for consistency.

---

## Phase 5 - Customer Scheme + Payment History (Staff Confirmation)

### Goal
Ensure staff can always access complete customer history in one place.

### Changes
- Staff customer detail already shows both sections; improve if needed:
  - Add scheme filter for payment list.
  - Add status filters and pagination for larger histories.
  - Add navigation to receipt/payment detail.

### Risk Control
- Mostly UI/UX; no major data model changes.

---

## Suggested Delivery Order and Ownership

1. Phase 0 (Backend, critical)  
2. Phase 1 (Backend + Staff Web)  
3. Phase 2 (Admin Web polish + validation)  
4. Phase 3 (Backend transaction + Admin/Staff create flows)  
5. Phase 4 (Backend reports + Admin/Staff reports UI)  
6. Phase 5 (Staff history UX hardening)

---

## Test Plan

## A. Environment Setup

- Seed at least:
  - 2 staff users with permissions
  - 5 customers
  - active cash and gold scheme plans
  - active gold rate
- Configure PhonePe sandbox credentials and webhook endpoint.
- Ensure webhook route is reachable: `POST /gateway/phonepe`.

---

## B. Phase 0 Tests (Webhook Truth)

1. Initiate customer PhonePe payment.
2. Verify no `Payment` row is created before webhook success.
3. Send valid success webhook -> verify one `Payment` created, receipt generated.
4. Replay same webhook -> verify duplicate-safe, no extra payment.
5. Send failed/cancel webhook after success -> verify payment is not downgraded.

Pass criteria:
- Exactly one successful ledger entry per successful transaction.

---

## C. Phase 1 Tests (Staff Dynamic QR)

1. Staff opens collect page, selects customer + scheme, enters amount, chooses `PHONEPE`.
2. System returns checkout URL/QR payload.
3. Complete payment in sandbox.
4. Webhook arrives and finalizes payment.
5. Staff UI updates to success and shows receipt.
6. Repeat with same idempotency key -> no duplicate.
7. Expired/abandoned payment -> status remains pending/failed, no receipt.

Pass criteria:
- Staff online collection is amount-accurate and webhook-confirmed.

---

## D. Phase 2 Tests (Admin Mark Collection)

1. Admin records manual cash payment.
2. Admin records UPI/BANK/CARD with reference number.
3. Verify customer-scheme mismatch is rejected.
4. Verify receipt number uniqueness.
5. Reverse one payment and confirm scheme totals decrement.

Pass criteria:
- Admin manual records are correct, auditable, reversible.

---

## E. Phase 3 Tests (Create Customer + Join Scheme)

1. Create customer without scheme -> customer created, no enrollment.
2. Create customer with scheme plan selected -> customer + enrollment created in one transaction.
3. Verify auto-generated enrollment number format and uniqueness.
4. Force failure in enrollment creation path -> ensure customer is not partially created (transaction rollback).
5. Verify staff and admin both see new scheme history immediately.

Pass criteria:
- No partial writes; enrollment number always auto-generated and unique.

---

## F. Phase 4 Tests (Payment-Type Reports)

1. Create payments in CASH, UPI, BANK, CARD, PHONEPE for same staff.
2. Query staff report for date range.
3. Verify by-method totals and counts match payment ledger rows.
4. Check admin reports for same period; verify consistency with staff report.
5. Test empty range behavior (all zero, no crash).

Pass criteria:
- Method-wise totals are accurate and consistent across staff/admin views.

---

## G. Phase 5 Tests (History Visibility)

1. Open staff customer detail for customer with multiple schemes and payments.
2. Verify scheme history list is complete and sorted.
3. Verify payment history includes method/status/receipt and reflects reversals.
4. Apply filters (if added) and confirm results are correct.

Pass criteria:
- Staff can audit full customer scheme and payment journey from one workspace.

---

## Regression Checklist (Run after every phase)

- Customer payment preview still validates caps/minimums correctly.
- Gold conversion (`goldWeightMg`) remains correct in manual and gateway flows.
- Cash submission and staff cash balance remain accurate.
- Correction request + approval/reversal flow still works.
- Admin reports export CSV still works for collection/staff/scheme/maturity.

---

## Rollout Recommendation

- Deploy in feature-flagged slices:
  1. webhook truth fix
  2. staff QR
  3. customer create + enrollment auto-number
  4. report enhancements
- Use sandbox test scripts for webhook replay before each production release.
- Keep rollback ready by toggling online payment enablement in settings if gateway anomalies occur.
