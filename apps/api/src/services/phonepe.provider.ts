import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import type {
  CheckoutRequest,
  CheckoutResponse,
  GatewayStatus,
  PaymentGatewayProvider,
} from './payment-gateway.js';

export class PhonePeProvider implements PaymentGatewayProvider {
  private token?: { value: string; expiresAt: number };
  private get base() {
    return env.PHONEPE_ENV === 'PRODUCTION'
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
  }
  private get authUrl() {
    return env.PHONEPE_ENV === 'PRODUCTION'
      ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';
  }
  private ensureEnabled() {
    if (!env.PHONEPE_ENABLED)
      throw new AppError('PAYMENT_GATEWAY_DISABLED', 'Online payment is not enabled', 503);
  }
  private async accessToken() {
    this.ensureEnabled();
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const body = new URLSearchParams({
      client_id: env.PHONEPE_CLIENT_ID,
      client_version: String(env.PHONEPE_CLIENT_VERSION),
      client_secret: env.PHONEPE_CLIENT_SECRET,
      grant_type: 'client_credentials',
    });
    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new AppError(
        'GATEWAY_AUTHENTICATION_FAILED',
        'Payment gateway authentication failed',
        502,
        true,
      );
    const data = (await response.json()) as any;
    this.token = { value: data.access_token, expiresAt: Number(data.expires_at) * 1000 };
    return this.token.value;
  }
  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        authorization: `O-Bearer ${await this.accessToken()}`,
        'content-type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new AppError('GATEWAY_REQUEST_FAILED', 'Payment gateway request failed', 502, true, [
        { providerCode: (body as any).code },
      ]);
    return body as any;
  }
  async createPayment(input: CheckoutRequest): Promise<CheckoutResponse> {
    const data = await this.request('/checkout/v2/pay', {
      method: 'POST',
      body: JSON.stringify({
        merchantOrderId: input.merchantOrderId,
        amount: input.amountPaise,
        expireAfter: 1200,
        paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: input.redirectUrl } },
        prefillUserLoginDetails: { phoneNumber: input.customerPhone },
        disablePaymentRetry: false,
        metaInfo: { udf1: input.customerId, udf2: input.schemeId },
      }),
    });
    return {
      providerOrderId: data.orderId,
      state: data.state,
      redirectUrl: data.redirectUrl,
      expiresAt: new Date(Number(data.expireAt)),
    };
  }
  async checkStatus(merchantOrderId: string): Promise<GatewayStatus> {
    const data = await this.request(
      `/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`,
    );
    const state =
      data.state === 'COMPLETED' ? 'SUCCESS' : data.state === 'FAILED' ? 'FAILED' : 'PENDING';
    return {
      state,
      amountPaise: Number(data.amount),
      transactionId: data.paymentDetails?.find((x: any) => x.state === 'COMPLETED')?.transactionId,
      raw: data,
    };
  }
  verifyWebhook(authorization: string | undefined, rawBody: Buffer) {
    this.ensureEnabled();
    const expected = createHash('sha256')
      .update(`${env.PHONEPE_WEBHOOK_USERNAME}:${env.PHONEPE_WEBHOOK_PASSWORD}`)
      .digest('hex');
    const actual = (authorization ?? '').replace(/^SHA256\s+/i, '').trim();
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      throw new AppError('GATEWAY_VERIFICATION_FAILED', 'Invalid webhook authorization', 401);
    let raw: any;
    try {
      raw = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new AppError('INVALID_WEBHOOK', 'Malformed webhook body', 400);
    }
    const payload = raw.payload ?? {};
    return {
      event: String(raw.event ?? raw.type ?? ''),
      merchantOrderId: String(payload.originalMerchantOrderId ?? payload.merchantOrderId ?? ''),
      amountPaise: Number(payload.amount),
      state: String(payload.state),
      transactionId: payload.paymentDetails?.find((x: any) => x.state === 'COMPLETED')
        ?.transactionId,
      raw,
    };
  }
}
export const phonePeProvider = new PhonePeProvider();
