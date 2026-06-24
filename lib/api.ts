const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();

if (!API_BASE_URL) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_API_URL or NEXT_PUBLIC_API_BASE_URL');
}

export function getApiBaseUrl(): string {
  return API_BASE_URL.replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/** All API calls use POST (production convention). */
export async function apiPost<TBody extends object = Record<string, unknown>>(
  path: string,
  body?: TBody
): Promise<Response> {
  return fetch(apiUrl(path), {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

/** @deprecated Use apiPost — all API routes are POST-only */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return apiPost(path, init?.body ? JSON.parse(String(init.body)) : {});
}
