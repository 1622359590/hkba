const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:37900';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hkba_admin_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) { window.location.href = '/admin/login'; throw new Error('No token'); }
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}), 'Authorization': `Bearer ${token}` };
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: 'no-store' });
    if (res.status === 401) { localStorage.removeItem('hkba_admin_token'); window.location.href = '/admin/login'; throw new Error('Unauthorized'); }
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
    if (err instanceof Error && (err.message === 'No token' || err.message === 'Unauthorized')) throw err;
    if (err instanceof Error && (err.message === 'No token' || err.message === 'Unauthorized')) throw err;
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
  const token = getToken();
  if (!token) { window.location.href = '/admin/login'; throw new Error('No token'); }
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/upload?dir=${dir}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
  if (!res.ok) throw new Error(`Upload Error: ${res.status}`);
  return res.json();
}
