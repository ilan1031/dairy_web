const DEFAULT_API_URL = 'http://localhost:5096';

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  return url.replace(/\/+$/, '');
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
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

/** @deprecated Use apiPost — all API routes are POST-only */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return apiPost(path, init?.body ? JSON.parse(String(init.body)) : {});
}
