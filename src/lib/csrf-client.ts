
let cachedToken: string | null = null;
let fetchPromise: Promise<string> | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/auth/csrf-token', { credentials: 'same-origin' })
    .then(async (res) => {
      const data = await res.json();
      cachedToken = data.csrfToken;
      fetchPromise = null;
      return cachedToken!;
    })
    .catch(() => {
      fetchPromise = null;
      return '';
    });

  return fetchPromise;
}

export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getCsrfToken();

  const headers = new Headers(options.headers || {});
  headers.set('x-csrf-token', token);

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
}

export async function secureJsonPost(url: string, body: unknown): Promise<Response> {
  return secureFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function secureFormPost(url: string, body: FormData): Promise<Response> {
  return secureFetch(url, {
    method: 'POST',
    body,
  });
}

export function clearCsrfToken(): void {
  cachedToken = null;
}
