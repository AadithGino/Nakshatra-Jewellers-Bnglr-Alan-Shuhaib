export type CheckoutRequest = {
  merchantOrderId: string;
  amountPaise: number;
  redirectUrl: string;
  customerPhone: string;
  customerId: string;
  schemeId: string;
};
export type CheckoutResponse = {
  providerOrderId: string;
  state: string;
  redirectUrl: string;
  expiresAt: Date;
};
export type GatewayStatus = {
  state: 'PENDING' | 'SUCCESS' | 'FAILED';
  amountPaise: number;
  transactionId?: string;
  raw: unknown;
};
export interface PaymentGatewayProvider {
  createPayment(input: CheckoutRequest): Promise<CheckoutResponse>;
  checkStatus(merchantOrderId: string): Promise<GatewayStatus>;
  verifyWebhook(
    authorization: string | undefined,
    rawBody: Buffer,
  ): {
    event: string;
    merchantOrderId: string;
    amountPaise: number;
    state: string;
    transactionId?: string;
    raw: any;
  };
}
