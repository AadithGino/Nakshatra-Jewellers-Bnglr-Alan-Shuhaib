export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details: unknown[] = [],
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? 'Request failed',
      response.status,
      body?.error?.details ?? [],
    );
  return body.data as T;
}
