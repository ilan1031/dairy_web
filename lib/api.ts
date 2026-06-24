function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  return value ?? '';
}

export function getApiBaseUrl(): string {
  const url = readEnv('NEXT_PUBLIC_API_URL') || readEnv('NEXT_PUBLIC_API_BASE_URL');

  if (!url) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_API_URL or NEXT_PUBLIC_API_BASE_URL');
  }

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
