// Admin API client (M2: dual-mode session transition).
//
// Requests always send credentials: 'include' so the HttpOnly session cookie
// rides along, plus the custom CSRF header on every call. The legacy Bearer
// token from localStorage is still attached when present as a fallback until
// the UI cutover completes (D3: removal is a later milestone).

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hkba_admin_token');
}

const CSRF_HEADERS: Record<string, string> = { 'x-requested-with': 'XMLHttpRequest' };

function redirectToLogin(): never {
  if (typeof window !== 'undefined') {
    // Give mounted pages a chance to stash unsaved form state before unload.
    window.dispatchEvent(new CustomEvent('hkba:session-expired'));
    localStorage.removeItem('hkba_admin_token');
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/admin/login?next=${next}`;
  }
  throw new Error('Unauthorized');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...CSRF_HEADERS, ...(options.headers as Record<string, string> || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(path, { ...options, headers, cache: 'no-store', credentials: 'include' });
    if (res.status === 401) redirectToLogin();
    if (!res.ok) {
      let message = `Error: ${res.status}`;
      try {
        const body = await res.json() as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // Keep the status message when the server response is not JSON.
      }
      throw new Error(message);
    }
    return res.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') throw err;
    if (err instanceof TypeError) throw new Error('網絡錯誤，請確認後端服務是否運行');
    throw err;
  }
}

export function adminRequestError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '操作失敗，請稍後重試。';
}

export function notifyAdminDataChanged(event: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(`hkba:${event}`));
}

export async function adminGet<T>(path: string): Promise<T> { return request<T>(path); }
export async function adminPost<T>(path: string, body: unknown): Promise<T> { return request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
export async function adminPut<T>(path: string, body: unknown): Promise<T> { return request<T>(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
export async function adminDelete<T>(path: string): Promise<T> { return request<T>(path, { method: 'DELETE' }); }

export async function adminUpload(file: File, dir: string = 'general'): Promise<{ url: string }> {
  const headers: Record<string, string> = { ...CSRF_HEADERS };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/upload?dir=${dir}`, { method: 'POST', headers, body: formData, credentials: 'include' });
  if (res.status === 401) redirectToLogin();
  if (!res.ok) throw new Error(`Upload Error: ${res.status}`);
  return res.json();
}
