export const openapi = {
  openapi: '3.1.0',
  info: { title: 'Nakshathra Scheme API', version: '1.0.0' },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { const: false },
          error: { type: 'object' },
          requestId: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/auth/login': { post: { summary: 'Role-independent secure login' } },
    '/auth/me': { get: { summary: 'Current authenticated session' } },
    '/admin/dashboard': {
      get: { summary: 'Admin financial dashboard', security: [{ cookieAuth: [] }] },
    },
    '/staff/dashboard': {
      get: { summary: 'Staff-owned financial dashboard', security: [{ cookieAuth: [] }] },
    },
    '/customer/home': {
      get: { summary: 'Customer-owned home data', security: [{ cookieAuth: [] }] },
    },
    '/customer/payments/phonepe': {
      post: {
        summary: 'Initiate PhonePe checkout for owned scheme',
        security: [{ cookieAuth: [] }],
      },
    },
    '/webhooks/phonepe': { post: { summary: 'Verified PhonePe webhook' } },
  },
};
