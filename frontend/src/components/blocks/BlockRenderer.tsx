'use client';
// Shared block renderer (ui-interaction-system §14: 前台组件一致性).
//
// One renderer serves both the studio canvas and the public site: given the
// persisted block list (page version or news revision), the registry
// definitions and a language, it renders every registered component type.
// News-display components render their query configuration as data cards
// until the public query endpoints mount with the frontend-switch milestone.

import { CSSProperties, ReactNode } from 'react';

export type RenderBlock = {
  id: string;
  component_type: string;
  parent_block_id?: string | null;
  is_visible?: number | boolean;
  sort_order?: number;
  anchor_id?: string | null;
  contentZh: Record<string, unknown>;
  contentEn: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export type MediaMap = Record<string, { url: string; altZh?: string; altEn?: string }>;

type Lang = 'zh' | 'en';

function text(block: RenderBlock, lang: Lang, field: string, fallback = ''): string {
  const scope = lang === 'en' ? block.contentEn : block.contentZh;
  const value = scope[field];
  if (typeof value === 'string' && value) return value;
  const other = (lang === 'en' ? block.contentZh : block.contentEn)[field];
  return typeof other === 'string' && other ? other : fallback;
}

function MediaImage({ id, media, lang, ratio }: { id?: unknown; media: MediaMap; lang: Lang; ratio?: string }) {
  const asset = typeof id === 'string' ? media[id] : undefined;
  const aspect = ratio === '4:3' ? '4 / 3' : ratio === '1:1' ? '1 / 1' : '16 / 9';
  if (!asset) {
    return <div className="hk-block__media-placeholder" style={{ aspectRatio: aspect }}>未選擇媒體</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.url}
      alt={lang === 'en' ? asset.altEn || asset.altZh || '' : asset.altZh || asset.altEn || ''}
      style={{ width: '100%', aspectRatio: aspect, objectFit: 'cover', borderRadius: 14, display: 'block' }}
    />
  );
}

function RichText({ html }: { html: string }) {
  return <div className="hk-block__richtext" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Button({ link, lang }: { link: unknown; lang: Lang }) {
  const value = (link || {}) as { label?: string; url?: string };
  if (!value.label) return null;
  return (
    <span className="hk-block__button" data-url={value.url || '#'}>
      {value.label || (lang === 'en' ? 'Learn more' : '了解更多')}
    </span>
  );
}

function BlockShell({
  block,
  children,
  style,
}: {
  block: RenderBlock;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section className="hk-block" data-block-id={block.id} data-component={block.component_type} id={block.anchor_id || undefined} style={style}>
      {children}
    </section>
  );
}

function PlaceholderCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="hk-block__placeholder">
      <div className="hk-block__placeholder-title">{title}</div>
      {lines.map((line, index) => (
        <div key={index} className="hk-block__placeholder-line">
          {line}
        </div>
      ))}
    </div>
  );
}

function renderBlock(block: RenderBlock, lang: Lang, media: MediaMap, children: ReactNode): ReactNode {
  const t = block.component_type;
  const settings = block.settings as Record<string, unknown>;

  // ---- layout containers ----
  if (t.startsWith('layout.')) {
    const columns = Number(settings.columns) || 2;
    const style: CSSProperties =
      t === 'layout.columns'
        ? { display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, columns))}, 1fr)`, gap: 20 }
        : t === 'layout.grid'
          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }
          : {};
    return (
      <BlockShell block={block} style={style}>
        {children}
      </BlockShell>
    );
  }

  // ---- news display (query placeholders until public endpoints mount) ----
  if (t.startsWith('news.') && t !== 'news.header') {
    const names: Record<string, string> = {
      'news.grid': '新聞卡片',
      'news.list': '新聞列表',
      'news.featured': '焦點新聞',
      'news.archive': '年度歸檔',
      'news.category-tabs': '分類標籤',
      'news.related': '相關新聞',
    };
    const yearMode = String(settings.yearMode || 'latest');
    const yearText = yearMode === 'specific' ? `指定 ${settings.year}` : { latest: '最新', all: '全部', 'visitor-select': '訪客選擇' }[yearMode] || yearMode;
    return (
      <BlockShell block={block}>
        <PlaceholderCard
          title={`${names[t] || t}（查詢組件）`}
          lines={[`年份：${yearText}`, `數量：${settings.limit ?? settings.count ?? 6}`, text(block, lang, 'title') && `標題：${text(block, lang, 'title')}`].filter(Boolean) as string[]}
        />
      </BlockShell>
    );
  }

  // ---- news header ----
  if (t === 'news.header') {
    return (
      <BlockShell block={block}>
        <div className="hk-block__news-header">
          <MediaImage id={block.contentZh.coverMediaId} media={media} lang={lang} />
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '18px 0 8px', color: 'var(--text-1)' }}>{text(block, lang, 'title')}</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 15 }}>{text(block, lang, 'summary')}</p>
          <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 10 }}>
            {[text(block, lang, 'author'), String(block.contentZh.publishedAt || '')].filter(Boolean).join(' · ')}
          </div>
        </div>
      </BlockShell>
    );
  }

  // ---- content components ----
  switch (t) {
    case 'content.hero':
      return (
        <BlockShell block={block}>
          <div className="hk-block__hero">
            <div>
              <h1 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>{text(block, lang, 'title')}</h1>
              <p style={{ color: 'var(--text-2)', fontSize: 16, marginBottom: 18 }}>{text(block, lang, 'subtitle')}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button link={block.contentZh.primaryButton} lang={lang} />
                <Button link={block.contentZh.secondaryButton} lang={lang} />
              </div>
            </div>
            <MediaImage id={block.contentZh.backgroundMediaId} media={media} lang={lang} />
          </div>
        </BlockShell>
      );
    case 'content.rich-text':
      return (
        <BlockShell block={block}>
          <RichText html={text(block, lang, 'html')} />
        </BlockShell>
      );
    case 'content.cta':
      return (
        <BlockShell block={block}>
          <div className="hk-block__cta">
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 750, color: 'var(--text-1)' }}>{text(block, lang, 'title')}</h2>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 6 }}>{text(block, lang, 'description')}</p>
            </div>
            <Button link={block.contentZh.button} lang={lang} />
          </div>
        </BlockShell>
      );
    case 'content.image-text': {
      const mediaFirst = block.contentZh.mediaPosition !== 'right';
      return (
        <BlockShell block={block}>
          <div className="hk-block__image-text">
            {mediaFirst && <MediaImage id={block.contentZh.mediaId} media={media} lang={lang} />}
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 750, color: 'var(--text-1)', marginBottom: 10 }}>{text(block, lang, 'title')}</h2>
              <RichText html={text(block, lang, 'html')} />
              <Button link={block.contentZh.button} lang={lang} />
            </div>
            {!mediaFirst && <MediaImage id={block.contentZh.mediaId} media={media} lang={lang} />}
          </div>
        </BlockShell>
      );
    }
    case 'content.faq': {
      const items = Array.isArray(block.contentZh.items) ? (block.contentZh.items as { q?: string; a?: string }[]) : [];
      return (
        <BlockShell block={block}>
          <h2 style={{ fontSize: 22, fontWeight: 750, color: 'var(--text-1)', marginBottom: 14 }}>{text(block, lang, 'title')}</h2>
          {items.map((item, index) => (
            <details key={index} className="hk-block__faq-item">
              <summary>{item.q || `問題 ${index + 1}`}</summary>
              <p>{item.a || ''}</p>
            </details>
          ))}
        </BlockShell>
      );
    }
    case 'content.stats': {
      const items = Array.isArray(block.contentZh.items) ? (block.contentZh.items as { value?: string; label?: string }[]) : [];
      return (
        <BlockShell block={block}>
          <div className="hk-block__stats">
            {items.map((item, index) => (
              <div key={index} className="hk-block__stat">
                <div className="hk-block__stat-value">{item.value || '—'}</div>
                <div className="hk-block__stat-label">{item.label || ''}</div>
              </div>
            ))}
          </div>
        </BlockShell>
      );
    }
    case 'content.quote':
      return (
        <BlockShell block={block}>
          <blockquote className="hk-block__quote">
            <p>{text(block, lang, 'quote')}</p>
            <footer>{text(block, lang, 'attribution')}</footer>
          </blockquote>
        </BlockShell>
      );
    case 'content.embed':
      return (
        <BlockShell block={block}>
          <PlaceholderCard title="嵌入內容" lines={[String(block.contentZh.url || '未設定 URL')]} />
        </BlockShell>
      );

    // ---- media components ----
    case 'media.image':
      return (
        <BlockShell block={block}>
          <MediaImage id={block.contentZh.mediaId} media={media} lang={lang} ratio={String(settings.ratio || '16:9')} />
          {text(block, lang, 'caption') ? <div className="hk-block__caption">{text(block, lang, 'caption')}</div> : null}
        </BlockShell>
      );
    case 'media.gallery': {
      const items = Array.isArray(block.contentZh.items) ? (block.contentZh.items as { mediaId?: string }[]) : [];
      return (
        <BlockShell block={block}>
          <div className="hk-block__gallery">
            {items.map((item, index) => (
              <MediaImage key={index} id={item.mediaId} media={media} lang={lang} ratio="4:3" />
            ))}
          </div>
        </BlockShell>
      );
    }
    case 'media.video':
      return (
        <BlockShell block={block}>
          {block.contentZh.externalUrl ? (
            <div className="hk-block__video">
              <a href={String(block.contentZh.externalUrl)} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>
                {text(block, lang, 'title') || String(block.contentZh.externalUrl)}
              </a>
            </div>
          ) : (
            <MediaImage id={block.contentZh.mediaId} media={media} lang={lang} />
          )}
        </BlockShell>
      );

    // ---- association components ----
    case 'association.related-pages':
    case 'association.members':
    case 'association.partners':
    case 'association.events':
    case 'association.timeline':
    case 'association.contact':
      return (
        <BlockShell block={block}>
          <PlaceholderCard title={`協會數據組件 ${t}`} lines={['前台切換里程碑接入真實數據']} />
        </BlockShell>
      );
    default:
      return (
        <BlockShell block={block}>
          <PlaceholderCard title={t} lines={['渲染器待補充']} />
        </BlockShell>
      );
  }
}

export default function BlockRenderer({
  blocks,
  lang = 'zh',
  media = {},
  onSelect,
  selectedId,
}: {
  blocks: RenderBlock[];
  lang?: Lang;
  media?: MediaMap;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const visible = blocks.filter((block) => block.is_visible !== 0 && block.is_visible !== false);
  const childrenOf = new Map<string | null, RenderBlock[]>();
  for (const block of visible) {
    const key = block.parent_block_id || null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(block);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  const renderTree = (parentId: string | null): ReactNode =>
    (childrenOf.get(parentId) || []).map((block) => {
      const rendered = renderBlock(block, lang, media, renderTree(block.id));
      if (!onSelect) return <div key={block.id}>{rendered}</div>;
      return (
        <div
          key={block.id}
          role="button"
          tabIndex={0}
          aria-label={`選擇組件 ${block.component_type}`}
          className={`hk-canvas-block${selectedId === block.id ? ' is-selected' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(block.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.stopPropagation();
              onSelect(block.id);
            }
          }}
        >
          {rendered}
          <span className="hk-canvas-block__tag">{block.component_type}</span>
        </div>
      );
    });

  return <div className="hk-renderer">{renderTree(null)}</div>;
}
