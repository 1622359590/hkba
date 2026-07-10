const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:37900';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export async function apiDelete<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export function imgUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

export type Lang = 'zh' | 'en';

export interface Banner { id: number; title_zh: string; title_en: string; subtitle_zh: string; subtitle_en: string; description_zh: string; description_en: string; image_url: string; link_url: string; video_url: string; sort_order: number; is_active: number; }
export interface Announcement { id: number; content_zh: string; content_en: string; link_url: string; is_active: number; }
export interface Partner { id: number; name: string; logo_url: string; website_url: string; group_name: string; }
export interface TeamMember { id: number; name_zh: string; name_en: string; title_zh: string; title_en: string; bio_zh: string; bio_en: string; avatar_url: string; group_name: string; social_facebook: string; social_twitter: string; social_linkedin: string; social_instagram: string; }
export interface NewsItem { id: number; title_zh: string; title_en: string; summary_zh: string; summary_en: string; content_zh: string; content_en: string; cover_image: string; category: string; is_published: number; published_at: string; }
export interface EventItem { id: number; title_zh: string; title_en: string; description_zh: string; description_en: string; content_zh: string; content_en: string; cover_image: string; event_date: string; end_date: string; location_zh: string; location_en: string; max_attendees: number; registration_url: string; }
export interface PageContent { id: number; slug: string; title_zh: string; title_en: string; content_zh: string; content_en: string; }
export interface StatItem { id: number; label_zh: string; label_en: string; value: string; icon: string; }
export interface Milestone { id: number; year: string; title_zh: string; title_en: string; description_zh: string; description_en: string; }

export function isPlaceholderPartnerName(name: string): boolean {
  return /^Partner\s+\d+$/i.test(name.trim());
}
