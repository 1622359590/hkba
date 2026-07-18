// Public content client (M8: frontend rendering switch).
//
// Thin fetch wrappers over /api/public/* (the M8 published-content API).
// Every helper returns null on failure or 404 so callers can fall back to
// the legacy data sources — the live site must keep rendering unmigrated
// content until M9 lands.

import type { MediaMap, RenderBlock } from '@/components/blocks/BlockRenderer';

export type PublicPage = {
  path: string;
  titleZh: string;
  titleEn: string;
  seo: Record<string, string | undefined>;
  revision: number;
  publishedAt: string | null;
  blocks: RenderBlock[];
  media: MediaMap;
};

export type PublicNewsListItem = {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  year: number | null;
  publishedAt: string | null;
  cover: { url: string; altZh: string; altEn: string } | null;
  categories: { id: string; slug: string; nameZh: string; nameEn: string }[];
  tags: { id: string; slug: string; nameZh: string; nameEn: string }[];
};

export type PublicNewsList = { items: PublicNewsListItem[]; total: number; page: number; pageSize: number };

export type PublicCategory = { id: string; slug: string; nameZh: string; nameEn: string; publishedCount: number };

export type PublicNewsDetail = {
  item: PublicNewsListItem & { seo: Record<string, unknown>; coverMediaId: string | null; revision: number };
  blocks: RenderBlock[];
  media: MediaMap;
};

type Envelope<T> = { success: true; data: T };

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as Envelope<T>;
    if (!body || body.success !== true) return null;
    return body.data;
  } catch {
    return null;
  }
}

export function fetchPublicPage(path: string): Promise<PublicPage | null> {
  return get<PublicPage>(`/api/public/page?path=${encodeURIComponent(path)}`);
}

export function fetchPublicNews(params: { year?: number; categoryId?: string; tagId?: string; page?: number; pageSize?: number } = {}): Promise<PublicNewsList | null> {
  const search = new URLSearchParams();
  if (params.year) search.set('year', String(params.year));
  if (params.categoryId) search.set('categoryId', params.categoryId);
  if (params.tagId) search.set('tagId', params.tagId);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const suffix = search.toString();
  return get<PublicNewsList>(`/api/public/news${suffix ? `?${suffix}` : ''}`);
}

export async function fetchPublicYears(): Promise<number[] | null> {
  const data = await get<{ years: number[] }>('/api/public/news/years');
  return data ? data.years : null;
}

export async function fetchPublicCategories(): Promise<PublicCategory[] | null> {
  const data = await get<{ items: PublicCategory[] }>('/api/public/news/categories');
  return data ? data.items : null;
}

export type PublicNewsItemResult = { kind: 'detail'; detail: PublicNewsDetail } | { kind: 'redirect'; to: string } | { kind: 'missing' };

export async function fetchPublicNewsItem(slug: string): Promise<PublicNewsItemResult> {
  const data = await get<PublicNewsDetail & { redirect?: string }>(`/api/public/news/item/${encodeURIComponent(slug)}`);
  if (!data) return { kind: 'missing' };
  if (data.redirect) return { kind: 'redirect', to: data.redirect };
  return { kind: 'detail', detail: data };
}
