let cachedToken: string | null = null;
let fetchPromise: Promise<string> | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/auth/csrf-token', { credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) {
        console.error('Failed to fetch CSRF token:', res.status, res.statusText);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      cachedToken = data.csrfToken;
      fetchPromise = null;
      return cachedToken!;
    })
    .catch((error) => {
      console.error('Error fetching CSRF token:', error);
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
