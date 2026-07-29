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

let refreshInFlight: Promise<boolean> | null = null;

/** Renew access cookie using the refresh cookie. Safe to call concurrently. */
export async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        return response.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const run = () =>
    fetch(`/api/v1${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });

  let response = await run();

  // Access token expired — renew once with refresh cookie, then retry.
  if (
    response.status === 401 &&
    path !== '/auth/login' &&
    path !== '/auth/refresh' &&
    path !== '/auth/logout'
  ) {
    const refreshed = await refreshSession();
    if (refreshed) response = await run();
  }

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
