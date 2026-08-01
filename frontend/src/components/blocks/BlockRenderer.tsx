'use client';
// Shared block renderer (ui-interaction-system §14: 前台组件一致性).
//
// One renderer serves both the studio canvas and the public site: given the
// persisted block list (page version or news revision), the registry
// definitions and a language, it renders every registered component type.
// News-display components render their query configuration as data cards
// until the public query endpoints mount with the frontend-switch milestone.

import { CSSProperties, FormEvent, ReactNode, useState } from 'react';
import PartnerCarousel from '@/components/ui/PartnerCarousel';
import LeadershipGlassCard from '@/components/ui/LeadershipGlassCard';
import { partnerShowsDetails, resolvePartnerCarouselOptions } from '@/lib/partnerCarousel.mjs';
import { newsCardClassName, shouldShowMediaPlaceholder } from '@/lib/publicMediaPresentation.mjs';
import { selectBoardMembers } from '@/lib/selectBoardMembers.mjs';
import NewsHero from '@/components/news/NewsHero';
import FeaturedNews from '@/components/news/FeaturedNews';
import NewsFeed from '@/components/news/NewsFeed';
import NewsFilters from '@/components/news/NewsFilters';
import { selectNewsLayout } from '@/components/news/newsViewModel.mjs';
import type { NewsViewItem } from '@/components/news/newsTypes';

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

// Card data for news display components in the public context (M8). The
// caller resolves language; the renderer only truncates to the configured
// limit. When no news prop is provided (studio canvas), query components
// keep rendering their configuration placeholder cards.
export type NewsCardData = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  year: number | null;
  publishedAt?: string | null;
  coverUrl?: string | null;
  categoryId?: string;
  category?: string;
};

// Structured association data for association.* components (visual-strike
// task). Served by GET /api/public/association straight from the structured
// tables; when absent (studio canvas) the components keep their
// configuration placeholder cards.
export type AssocPartner = { id: number; name: string; logoUrl: string; websiteUrl: string; group: string };
export type AssocPerson = {
  id: number;
  nameZh: string;
  nameEn: string;
  titleZh: string;
  titleEn: string;
  bioZh: string;
  bioEn: string;
  avatarUrl: string;
  group: string;
  facebook: string;
  twitter: string;
  linkedin: string;
  instagram: string;
};
export type AssocMilestone = { id: number; year: string; titleZh: string; titleEn: string; descriptionZh: string; descriptionEn: string };
export type AssocEvent = {
  id: number;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  eventDate: string;
  endDate: string;
  locationZh: string;
  locationEn: string;
  coverUrl: string;
  registrationUrl: string;
};
export type AssocData = {
  partners: AssocPartner[];
  people: AssocPerson[];
  milestones: AssocMilestone[];
  events: AssocEvent[];
  contact: Record<string, string>;
  resources: unknown[];
};

type Lang = 'zh' | 'en';

function text(block: RenderBlock, lang: Lang, field: string, fallback = ''): string {
  const scope = lang === 'en' ? block.contentEn : block.contentZh;
  const value = scope[field];
  if (typeof value === 'string' && value) return value;
  const other = (lang === 'en' ? block.contentZh : block.contentEn)[field];
  return typeof other === 'string' && other ? other : fallback;
}

function localizedContent(block: RenderBlock, lang: Lang): Record<string, unknown> {
  return lang === 'en' ? block.contentEn : block.contentZh;
}

function MediaImage({ id, media, lang, ratio, editable = true }: { id?: unknown; media: MediaMap; lang: Lang; ratio?: string; editable?: boolean }) {
  const asset = typeof id === 'string' ? media[id] : undefined;
  const aspect = ratio === '4:3' ? '4 / 3' : ratio === '1:1' ? '1 / 1' : '16 / 9';
  if (!asset) {
    return shouldShowMediaPlaceholder({ hasAsset: false, editable })
      ? <div className="hk-block__media-placeholder" style={{ aspectRatio: aspect }}>未選擇媒體</div>
      : null;
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

function ExternalImage({ src, alt }: { src: string; alt: string }) {
  if (!src) return null;
  return <img src={src} alt={alt} loading="lazy" className="hk-block__external-image" />;
}

function RichText({ html }: { html: string }) {
  return <div className="hk-block__richtext" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Button({ link, lang }: { link: unknown; lang: Lang }) {
  const value = (link || {}) as { label?: string; url?: string };
  if (!value.label) return null;
  return (
    <a
      className="hk-block__button"
      href={value.url || '#'}
      onClick={(event) => {
        if (event.currentTarget.closest('.hk-canvas-block')) event.preventDefault();
      }}
    >
      {value.label || (lang === 'en' ? 'Learn more' : '了解更多')}
    </a>
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

function NewsCards({ type, settings, news, lang }: { type: string; settings: Record<string, unknown>; news: NewsCardData[]; lang: Lang }) {  const limit = Number(settings.limit ?? settings.count ?? 6) || 6;
  const items = news.slice(0, type === 'news.featured' ? Math.min(3, limit) : limit);
  if (!items.length) {
    return <div className="hk-block__placeholder-line">{lang === 'en' ? 'No published news yet.' : '暫無已發佈新聞。'}</div>;
  }
  const featured = type === 'news.featured';
  return (
    <div
      className={`hk-news-cards hk-news-cards--${type.replace('news.', '')}`}
    >
      {items.map((item) => (
        <a
          key={item.slug}
          href={`/news/${item.slug}`}
          className={newsCardClassName(type, Boolean(item.coverUrl))}
        >
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.coverUrl} alt={item.title} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
          ) : null}
          <span className="hk-news-card__body">
            <span className="hk-news-card__meta">
              {[item.year, item.publishedAt ? String(item.publishedAt).slice(0, 10) : ''].filter(Boolean).join(' · ')}
            </span>
            <span className="hk-news-card__title">{item.title}</span>
            {type !== 'news.list' && item.summary ? (
              <span className="hk-news-card__summary">{item.summary}</span>
            ) : null}
            <span className="hk-news-card__action">{lang === 'en' ? 'Read article' : '閱讀文章'} <span aria-hidden="true">↗</span></span>
          </span>
        </a>
      ))}
    </div>
  );
}

function premiumNewsItems(news: NewsCardData[]): NewsViewItem[] {
  return news.map((item) => ({
    id: item.id || item.slug,
    href: `/news/${item.slug}`,
    title: item.title,
    summary: item.summary,
    category: item.category || '',
    date: item.publishedAt ? String(item.publishedAt).slice(0, 10) : '',
    year: item.year || undefined,
    image: item.coverUrl ? { src: item.coverUrl, alt: item.title } : undefined,
  }));
}

// ---- association data components (public context) ----

const GROUP_LABELS: Record<string, { zh: string; en: string }> = {
  honorary_chairman: { zh: '榮譽主席', en: 'Honorary Chairman' },
  co_chairman: { zh: '聯席會長', en: 'Co-Chairman' },
  chairman: { zh: '會長', en: 'Chairman' },
  president: { zh: '主席', en: 'President' },
  vice_chairman: { zh: '副主席', en: 'Vice Chairman' },
  industry_expert: { zh: '業界專家顧問', en: 'Industry Expert' },
  ambassador: { zh: '協會大使', en: 'HKBA Ambassador' },
  secretary_general: { zh: '聯席秘書長', en: 'Secretary General' },
  advisor: { zh: '顧問', en: 'Advisor' },
  member: { zh: '成員', en: 'Member' },
};

function groupLabel(group: string, lang: Lang): string {
  const entry = GROUP_LABELS[group];
  if (entry) return lang === 'en' ? entry.en : entry.zh;
  return group || (lang === 'en' ? 'Member' : '成員');
}

function personName(person: AssocPerson, lang: Lang): string {
  return (lang === 'en' ? person.nameEn || person.nameZh : person.nameZh || person.nameEn) || '';
}

function personTitle(person: AssocPerson, lang: Lang): string {
  return (lang === 'en' ? person.titleEn || person.titleZh : person.titleZh || person.titleEn) || '';
}

function personBio(person: AssocPerson, lang: Lang): string {
  return (lang === 'en' ? person.bioEn || person.bioZh : person.bioZh || person.bioEn) || '';
}

function AssocHead({ block, lang }: { block: RenderBlock; lang: Lang }) {
  const title = text(block, lang, 'title');
  const description = text(block, lang, 'description');
  if (!title && !description) return null;
  return (
    <div className="hk-assoc__head">
      {title ? <h2 className="hk-assoc__head-title">{title}</h2> : null}
      {description ? <p className="hk-assoc__head-desc">{description}</p> : null}
    </div>
  );
}

// Every partner logo shares the same neutral glass mat so transparent artwork
// remains legible without introducing one-off per-brand treatments.
function LogoTile({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="hk-partner__tile">
      {!failed && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="hk-partner__initial">{(name || '?').slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

function PersonAvatar({ src, name, large }: { src: string; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const className = `hk-person__avatar${large ? ' hk-person__avatar--large' : ''}`;
  if (failed || !src) {
    return (
      <div className={`${className} hk-person__avatar-fallback`} aria-hidden>
        {(name || '?').slice(0, 1)}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />;
}

const SOCIAL_ICONS: Record<string, { label: string; path: string }> = {
  facebook: { label: 'Facebook', path: 'M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5H16V4.9c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V11H7.5v3h2.3v7h3.7Z' },
  twitter: { label: 'X', path: 'M4 4.5 10.9 13 4.2 20h2.3l5.4-5.7 4 5.7H20l-7.2-9.2 6.4-6.3h-2.3l-5.1 5.2-3.7-5.2H4Z' },
  linkedin: { label: 'LinkedIn', path: 'M6.9 8.6H4V20h2.9V8.6ZM5.4 4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4ZM10 20v-6.2c0-1.6.8-2.6 2.2-2.6 1.3 0 1.9.9 1.9 2.6V20h2.9v-6.7c0-3-1.6-4.4-3.8-4.4-1.5 0-2.5.8-3.2 1.8V8.6H10Z' },
  instagram: { label: 'Instagram', path: 'M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2ZM17.4 4H6.6A2.6 2.6 0 0 0 4 6.6v10.8A2.6 2.6 0 0 0 6.6 20h10.8a2.6 2.6 0 0 0 2.6-2.6V6.6A2.6 2.6 0 0 0 17.4 4Zm1 13.4a1 1 0 0 1-1 1H6.6a1 1 0 0 1-1-1V6.6a1 1 0 0 1 1-1h10.8a1 1 0 0 1 1 1v10.8ZM16.9 6.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z' },
  youtube: { label: 'YouTube', path: 'M20.6 8.2a2.5 2.5 0 0 0-1.8-1.8C17.2 6 12 6 12 6s-5.2 0-6.8.4A2.5 2.5 0 0 0 3.4 8.2 26 26 0 0 0 3 12a26 26 0 0 0 .4 3.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 6.8.4 6.8.4s5.2 0 6.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 21 12a26 26 0 0 0-.4-3.8ZM10 15V9l5.2 3L10 15Z' },
};

function SocialLink({ kind, url }: { kind: string; url: string }) {
  const icon = SOCIAL_ICONS[kind];
  if (!icon || !url) return null;
  return (
    <a className="hk-social" href={url} target="_blank" rel="noreferrer" aria-label={icon.label} title={icon.label}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d={icon.path} />
      </svg>
    </a>
  );
}

function AssocPartners({ block, lang, settings, assoc }: { block: RenderBlock; lang: Lang; settings: Record<string, unknown>; assoc: AssocData }) {
  const group = String(settings.group || '').trim();
  const variant = String(settings.variant || 'logo-wall');
  const items = assoc.partners.filter((partner) => !group || partner.group === group);
  if (!items.length) return <AssocEmpty lang={lang} kind="partners" />;
  const carouselOptions = resolvePartnerCarouselOptions(settings);
  const showDetails = partnerShowsDetails(variant);
  const renderPartner = (partner: AssocPartner, duplicate: boolean) => {
    const card = (
      <>
        <LogoTile src={partner.logoUrl} name={partner.name} />
        {showDetails ? <span className="hk-partner__name">{partner.name}</span> : null}
        {showDetails && partner.websiteUrl ? (
          <span className="hk-partner__site">{partner.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
        ) : null}
      </>
    );
    return partner.websiteUrl ? (
      <a
        key={`${duplicate ? 'duplicate-' : ''}${partner.id}`}
        className="hk-partner"
        href={partner.websiteUrl}
        target="_blank"
        rel="noreferrer"
        tabIndex={duplicate ? -1 : undefined}
      >
        {card}
      </a>
    ) : (
      <div key={`${duplicate ? 'duplicate-' : ''}${partner.id}`} className="hk-partner">
        {card}
      </div>
    );
  };
  return (
    <>
      <AssocHead block={block} lang={lang} />
      {variant === 'carousel' ? (
        <PartnerCarousel
          items={items}
          ariaLabel={lang === 'en' ? 'Partners' : '合作夥伴'}
          autoPlay={carouselOptions.autoPlay}
          speed={carouselOptions.speed}
          direction={carouselOptions.direction}
          pauseOnHover={carouselOptions.pauseOnHover}
          className="hk-partner-carousel"
          renderItem={renderPartner}
        />
      ) : (
        <div className={`hk-partner-grid${variant === 'cards' ? ' hk-partner-grid--cards' : ''}`}>
          {items.map((partner) => renderPartner(partner, false))}
        </div>
      )}
    </>
  );
}

function AssocTimeline({ block, lang, settings, assoc }: { block: RenderBlock; lang: Lang; settings: Record<string, unknown>; assoc: AssocData }) {
  const items = [...assoc.milestones];
  if (String(settings.order) === 'desc') items.reverse();
  if (!items.length) return <AssocEmpty lang={lang} kind="timeline" />;
  return (
    <>
      <AssocHead block={block} lang={lang} />
      <div className="hk-timeline">
        {items.map((milestone) => (
          <div key={milestone.id} className="hk-timeline__item">
            <div className="hk-timeline__year">{milestone.year}</div>
            <div className="hk-timeline__title">{(lang === 'en' ? milestone.titleEn || milestone.titleZh : milestone.titleZh || milestone.titleEn) || ''}</div>
            {(lang === 'en' ? milestone.descriptionEn || milestone.descriptionZh : milestone.descriptionZh || milestone.descriptionEn) ? (
              <div className="hk-timeline__desc">{lang === 'en' ? milestone.descriptionEn || milestone.descriptionZh : milestone.descriptionZh || milestone.descriptionEn}</div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

function AssocPeople({ block, lang, settings, assoc, board }: { block: RenderBlock; lang: Lang; settings: Record<string, unknown>; assoc: AssocData; board: boolean }) {
  const [activePersonId, setActivePersonId] = useState<number | null>(null);
  const items = board ? selectBoardMembers(assoc.people, settings) as AssocPerson[] : assoc.people;
  if (!items.length) return <AssocEmpty lang={lang} kind="people" />;
  const showBio = board && settings.showBio !== false;
  const showSocial = board && settings.showSocial !== false;
  return (
    <>
      <AssocHead block={block} lang={lang} />
      <div className={`hk-people-grid${board ? ' hk-people-grid--board' : ''}`}>
        {items.map((person) => {
          const name = personName(person, lang);
          if (board) {
            return (
              <LeadershipGlassCard
                key={person.id}
                personId={person.id}
                role={person.group}
                activePersonId={activePersonId}
                setActivePersonId={setActivePersonId}
              >
                <div className="hk-person__portrait">
                  <PersonAvatar src={person.avatarUrl} name={name} large />
                </div>
                <span className="hk-person__badge">{groupLabel(person.group, lang)}</span>
                <div className="hk-person__name">{name}</div>
                <div className="hk-person__title">{personTitle(person, lang)}</div>
                {showBio && personBio(person, lang) ? <div className="hk-person__bio">{personBio(person, lang)}</div> : null}
                {showSocial ? (
                  <div className="hk-person__socials">
                    <SocialLink kind="facebook" url={person.facebook} />
                    <SocialLink kind="twitter" url={person.twitter} />
                    <SocialLink kind="linkedin" url={person.linkedin} />
                    <SocialLink kind="instagram" url={person.instagram} />
                  </div>
                ) : null}
              </LeadershipGlassCard>
            );
          }
          return (
            <div key={person.id} className="hk-person hk-person--compact">
              <PersonAvatar src={person.avatarUrl} name={name} />
              <div>
                <div className="hk-person__name">{name}</div>
                <div className="hk-person__title">{personTitle(person, lang)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AssocContact({ block, lang, settings, assoc }: { block: RenderBlock; lang: Lang; settings: Record<string, unknown>; assoc: AssocData }) {
  const contact = assoc.contact || {};
  const address = (lang === 'en' ? contact.address_en || contact.address_zh : contact.address_zh || contact.address_en) || '';
  const showMap = settings.showMap !== false && !!address;
  const showSocial = settings.showSocial !== false;
  const showHours = settings.showHours === true && !!(contact.hours_zh || contact.hours_en);
  const hasAny = contact.phone || contact.email || address || showSocial;
  if (!hasAny) return <AssocEmpty lang={lang} kind="contact" />;
  return (
    <>
      <AssocHead block={block} lang={lang} />
      <div className="hk-contact">
        {contact.phone ? (
          <div>
            <div className="hk-contact__label">{lang === 'en' ? 'Phone' : '電話'}</div>
            <div className="hk-contact__value"><a href={`tel:${String(contact.phone).replace(/\s+/g, '')}`}>{contact.phone}</a></div>
          </div>
        ) : null}
        {contact.email ? (
          <div>
            <div className="hk-contact__label">{lang === 'en' ? 'Email' : '電郵'}</div>
            <div className="hk-contact__value"><a href={`mailto:${contact.email}`}>{contact.email}</a></div>
          </div>
        ) : null}
        {address ? (
          <div>
            <div className="hk-contact__label">{lang === 'en' ? 'Address' : '地址'}</div>
            <div className="hk-contact__value">
              {showMap ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
                  {address}
                </a>
              ) : (
                address
              )}
            </div>
          </div>
        ) : null}
        {showHours ? (
          <div>
            <div className="hk-contact__label">{lang === 'en' ? 'Hours' : '辦公時間'}</div>
            <div className="hk-contact__value">{lang === 'en' ? contact.hours_en || contact.hours_zh : contact.hours_zh || contact.hours_en}</div>
          </div>
        ) : null}
        {showSocial && (contact.facebook || contact.twitter || contact.linkedin || contact.instagram || contact.youtube) ? (
          <div>
            <div className="hk-contact__label">{lang === 'en' ? 'Follow' : '關注我們'}</div>
            <div className="hk-contact__socials">
              <SocialLink kind="facebook" url={contact.facebook} />
              <SocialLink kind="twitter" url={contact.twitter} />
              <SocialLink kind="linkedin" url={contact.linkedin} />
              <SocialLink kind="instagram" url={contact.instagram} />
              <SocialLink kind="youtube" url={contact.youtube} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function AssocMap({ block, lang, settings, assoc }: { block: RenderBlock; lang: Lang; settings: Record<string, unknown>; assoc: AssocData }) {
  const src = String(assoc.contact?.map_embed_url || '');
  if (!src) return <AssocEmpty lang={lang} kind="contact" />;
  const height = Math.max(240, Math.min(800, Number(settings.height) || 460));
  return (
    <>
      <AssocHead block={block} lang={lang} />
      <iframe
        className={`hk-map${settings.rounded === false ? ' hk-map--square' : ''}`}
        src={src}
        title={lang === 'en' ? 'HKBA location map' : '香港區塊鏈協會地圖'}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        style={{ height }}
      />
    </>
  );
}

type MembershipPlan = {
  name?: string;
  price?: string;
  benefits?: string[];
  buttonLabel?: string;
  buttonUrl?: string;
};

function MembershipPlans({ block, lang, settings }: { block: RenderBlock; lang: Lang; settings: Record<string, unknown> }) {
  const scope = localizedContent(block, lang);
  const plans = Array.isArray(scope.plans) ? (scope.plans as MembershipPlan[]) : [];
  const columns = Math.max(1, Math.min(4, Number(settings.columns) || 3));
  return (
    <BlockShell block={block}>
      <AssocHead block={block} lang={lang} />
      <div className="hk-plan-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {plans.map((plan, index) => (
          <article key={`${plan.name}-${index}`} className="hk-plan">
            <div className="hk-plan__name">{plan.name}</div>
            <div className="hk-plan__price">{plan.price}</div>
            <ul className="hk-plan__benefits">
              {(Array.isArray(plan.benefits) ? plan.benefits : []).map((benefit, benefitIndex) => <li key={benefitIndex}>{benefit}</li>)}
            </ul>
            {plan.buttonUrl ? <a className="hk-block__button" href={plan.buttonUrl}>{plan.buttonLabel || (lang === 'en' ? 'Download form' : '下載登記表格')}</a> : null}
          </article>
        ))}
      </div>
    </BlockShell>
  );
}

function ContactForm({ block, lang, settings }: { block: RenderBlock; lang: Lang; settings: Record<string, unknown> }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    try {
      const response = await fetch('/api/contact/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error('submit failed');
      setForm({ name: '', email: '', subject: '', message: '' });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <BlockShell block={block}>
      <AssocHead block={block} lang={lang} />
      <form className="hk-contact-form" onSubmit={submit}>
        <label>{lang === 'en' ? 'Name' : '姓名'}<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
        <label>{lang === 'en' ? 'Email' : '電郵'}<input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
        {settings.showSubject !== false ? <label className="hk-contact-form__wide">{lang === 'en' ? 'Subject' : '主旨'}<input value={form.subject} onChange={(event) => update('subject', event.target.value)} /></label> : null}
        <label className="hk-contact-form__wide">{lang === 'en' ? 'Message' : '留言'}<textarea required rows={6} value={form.message} onChange={(event) => update('message', event.target.value)} /></label>
        <div className="hk-contact-form__actions">
          <button className="hk-block__button" type="submit" disabled={status === 'sending'}>{status === 'sending' ? (lang === 'en' ? 'Sending...' : '提交中...') : text(block, lang, 'submitLabel', lang === 'en' ? 'Submit' : '提交')}</button>
          {status === 'sent' ? <span className="is-success">{lang === 'en' ? 'Message sent.' : '留言已送出。'}</span> : null}
          {status === 'error' ? <span className="is-error">{lang === 'en' ? 'Please try again.' : '提交失敗，請稍後重試。'}</span> : null}
        </div>
      </form>
    </BlockShell>
  );
}

function AssocEvents({ block, lang, settings, assoc }: { block: RenderBlock; lang: Lang; settings: Record<string, unknown>; assoc: AssocData }) {
  const today = new Date().toISOString().slice(0, 10);
  const status = String(settings.status || 'all');
  const limit = Math.max(1, Math.min(50, Number(settings.limit) || 12));
  const showLocation = settings.showLocation !== false;
  const events = (assoc.events || [])
    .filter((event) => status === 'all' || (status === 'upcoming' ? event.eventDate >= today : event.eventDate < today))
    .slice(0, limit);

  return (
    <>
      <AssocHead block={block} lang={lang} />
      {events.length ? (
        <div className="hk-block__events">
          {events.map((event) => {
            const title = lang === 'en' ? event.titleEn || event.titleZh : event.titleZh || event.titleEn;
            const description = lang === 'en' ? event.descriptionEn || event.descriptionZh : event.descriptionZh || event.descriptionEn;
            const location = lang === 'en' ? event.locationEn || event.locationZh : event.locationZh || event.locationEn;
            return (
              <article key={event.id} className="hk-block__event-card">
                <time className="hk-block__event-date" dateTime={event.eventDate}>{event.eventDate || (lang === 'en' ? 'Date pending' : '日期待定')}</time>
                <h3>{title}</h3>
                {description ? <p>{description}</p> : null}
                {showLocation && location ? <div className="hk-block__event-meta">{location}</div> : null}
                {event.registrationUrl ? (
                  <a className="hk-block__event-link" href={event.registrationUrl} target="_blank" rel="noreferrer">
                    {lang === 'en' ? 'View event' : '查看活動'} →
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : <AssocEmpty lang={lang} kind="events" />}
    </>
  );
}

function AssocEmpty({ lang, kind }: { lang: Lang; kind: 'partners' | 'timeline' | 'people' | 'events' | 'contact' | 'resources' }) {
  const labels = {
    partners: { zh: '暫無合作夥伴資料', en: 'No partners yet' },
    timeline: { zh: '暫無里程碑資料', en: 'No milestones yet' },
    people: { zh: '暫無成員資料', en: 'No members yet' },
    events: { zh: '暫無活動資料', en: 'No events yet' },
    contact: { zh: '暫無聯繫資料', en: 'No contact details yet' },
    resources: { zh: '暫無資源下載', en: 'No resources yet' },
  }[kind];
  return (
    <div className="hk-empty">
      <div className="hk-empty__glyph" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" />
        </svg>
      </div>
      <div className="hk-empty__title">{lang === 'en' ? labels.en : labels.zh}</div>
      <div className="hk-empty__desc">{lang === 'en' ? 'Content is being prepared.' : '內容整理中，敬請期待。'}</div>
    </div>
  );
}

function renderBlock(block: RenderBlock, lang: Lang, media: MediaMap, children: ReactNode, news?: NewsCardData[], assoc?: AssocData, editable = false): ReactNode {
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

  // ---- news display ----
  if (t.startsWith('news.') && t !== 'news.header') {
    const variant = String(settings.variant || '');
    if (news && variant === 'flagship') {
      const requestedIds = Array.isArray(settings.pinnedIds) ? settings.pinnedIds.filter((id): id is string => typeof id === 'string') : [];
      const allItems = premiumNewsItems(news);
      const pinnedItems = settings.source === 'pinned' ? requestedIds.map((id) => allItems.find((item) => item.id === id)).filter((item): item is NewsViewItem => Boolean(item)) : [];
      const layout = selectNewsLayout(allItems, pinnedItems, Math.min(4, Math.max(2, Number(settings.secondaryCount || 2))));
      return <BlockShell block={block}>{settings.source === 'pinned' && requestedIds.length && pinnedItems.length < requestedIds.length ? <p className="news-preview-note">{lang === 'en' ? 'Some pinned stories are not published; showing the latest available stories.' : '部分指定新聞尚未發佈，預覽已回退至最新內容。'}</p> : null}{layout.featured ? <FeaturedNews featured={layout.featured} secondary={layout.secondary} lang={lang} /> : null}</BlockShell>;
    }
    if (news && variant === 'editorial') {
      return <BlockShell block={block}><NewsFeed items={premiumNewsItems(news).slice(0, Number(settings.pageSize || settings.limit || 9))} lang={lang} showSummary={settings.showSummary !== false} showDate={settings.showDate !== false} /></BlockShell>;
    }
    if (news && variant === 'technology') {
      const yearValues = [...new Set(news.map((item) => item.year).filter((value): value is number => Number.isInteger(value)))].sort((a, b) => b - a);
      const categoryValues = [...new Map(news.filter((item) => item.categoryId && item.category).map((item) => [item.categoryId!, { id: item.categoryId!, name: item.category! }])).values()];
      return <BlockShell block={block}><NewsFilters lang={lang} years={yearValues} categories={categoryValues} year={0} categoryId="" loading={false} showYearFilter={settings.showYearFilter !== false} showCategoryFilter={settings.showCategoryFilter !== false} onYearChange={() => undefined} onCategoryChange={() => undefined} /></BlockShell>;
    }
    // Public context: real published cards when the caller supplies data.
    if (news && (t === 'news.grid' || t === 'news.list' || t === 'news.featured')) {
      return (
        <BlockShell block={block}>
          {text(block, lang, 'title') ? (
            <h2 style={{ fontSize: 22, fontWeight: 750, color: 'var(--text-1)', marginBottom: 14 }}>{text(block, lang, 'title')}</h2>
          ) : null}
          <NewsCards type={t} settings={settings} news={news} lang={lang} />
        </BlockShell>
      );
    }
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
    const coverId = block.contentZh.coverMediaId || block.contentEn.coverMediaId;
    const hasCover = typeof coverId === 'string' && Boolean(media[coverId]);
    return (
      <BlockShell block={block}>
        <div className={`hk-block__news-header${hasCover ? ' has-cover' : ' is-no-cover'}`}>
          <MediaImage id={coverId} media={media} lang={lang} editable={editable} />
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
      {
      const scope = localizedContent(block, lang);
      if (settings.variant === 'network-news') {
        return <BlockShell block={block}><NewsHero lang={lang} title={text(block, lang, 'title')} subtitle={text(block, lang, 'subtitle')} total={news?.length || 0} categoryCount={new Set((news || []).map((item) => item.categoryId).filter(Boolean)).size} activeYear={(news || []).find((item) => item.year)?.year || undefined} latestDate={(news || []).find((item) => item.publishedAt)?.publishedAt?.slice(0, 10)} /></BlockShell>;
      }
      const hasMedia = typeof scope.backgroundMediaId === 'string' && Boolean(scope.backgroundMediaId);
      return (
        <BlockShell block={block}>
          <div className={`hk-block__hero${hasMedia ? '' : ' hk-block__hero--no-media'}`}>
            <div>
              <h1 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>{text(block, lang, 'title')}</h1>
              <p style={{ color: 'var(--text-2)', fontSize: 16, marginBottom: 18 }}>{text(block, lang, 'subtitle')}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button link={scope.primaryButton} lang={lang} />
                <Button link={scope.secondaryButton} lang={lang} />
              </div>
            </div>
            {hasMedia ? <MediaImage id={scope.backgroundMediaId} media={media} lang={lang} /> : null}
          </div>
        </BlockShell>
      );
      }
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
      const scope = localizedContent(block, lang);
      const mediaFirst = settings.mediaPosition !== 'right';
      const visual = scope.externalMediaUrl
        ? <ExternalImage src={String(scope.externalMediaUrl)} alt={text(block, lang, 'title')} />
        : <MediaImage id={scope.mediaId} media={media} lang={lang} />;
      return (
        <BlockShell block={block}>
          <div className="hk-block__image-text">
            {mediaFirst && visual}
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 750, color: 'var(--text-1)', marginBottom: 10 }}>{text(block, lang, 'title')}</h2>
              <RichText html={text(block, lang, 'body')} />
              <Button link={scope.button} lang={lang} />
            </div>
            {!mediaFirst && visual}
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
      const scope = localizedContent(block, lang);
      const items = Array.isArray(scope.items) ? (scope.items as { value?: string; unit?: string; label?: string; description?: string }[]) : [];
      const features = settings.variant === 'features';
      return (
        <BlockShell block={block}>
          {text(block, lang, 'title') ? <h2 className="hk-block__stats-title">{text(block, lang, 'title')}</h2> : null}
          <div className={`hk-block__stats${features ? ' hk-block__stats--features' : ''}`}>
            {items.map((item, index) => (
              <div key={index} className="hk-block__stat">
                <div className="hk-block__stat-value">{item.value || '—'}{item.unit || ''}</div>
                <div className="hk-block__stat-label">{item.label || ''}</div>
                {item.description ? <div className="hk-block__stat-description">{item.description}</div> : null}
              </div>
            ))}
          </div>
        </BlockShell>
      );
    }
    case 'content.membership-plans':
      return <MembershipPlans block={block} lang={lang} settings={settings} />;
    case 'content.contact-form':
      return <ContactForm block={block} lang={lang} settings={settings} />;
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
    case 'association.partners':
    case 'association.timeline':
    case 'association.members':
    case 'association.board':
    case 'association.contact':
    case 'association.map':
    case 'association.events':
    case 'association.resources': {
      // Studio canvas (no assoc data): keep the configuration placeholder.
      if (!assoc) {
        return (
          <BlockShell block={block}>
            <PlaceholderCard title={`協會數據組件 ${t}`} lines={['前台發佈後以結構化數據渲染']} />
          </BlockShell>
        );
      }
      return (
        <BlockShell block={block}>
          {t === 'association.partners' ? <AssocPartners block={block} lang={lang} settings={settings} assoc={assoc} /> : null}
          {t === 'association.timeline' ? <AssocTimeline block={block} lang={lang} settings={settings} assoc={assoc} /> : null}
          {t === 'association.members' ? <AssocPeople block={block} lang={lang} settings={settings} assoc={assoc} board={false} /> : null}
          {t === 'association.board' ? <AssocPeople block={block} lang={lang} settings={settings} assoc={assoc} board /> : null}
          {t === 'association.contact' ? <AssocContact block={block} lang={lang} settings={settings} assoc={assoc} /> : null}
          {t === 'association.map' ? <AssocMap block={block} lang={lang} settings={settings} assoc={assoc} /> : null}
          {t === 'association.events' ? <AssocEvents block={block} lang={lang} settings={settings} assoc={assoc} /> : null}
          {t === 'association.resources' ? (
            <>
              <AssocHead block={block} lang={lang} />
              <AssocEmpty lang={lang} kind="resources" />
            </>
          ) : null}
        </BlockShell>
      );
    }
    case 'association.related-pages':
      // Not part of the current registry; keep a quiet placeholder.
      return (
        <BlockShell block={block}>
          <PlaceholderCard title={`協會數據組件 ${t}`} lines={['渲染器待補充']} />
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
  news,
  assoc,
}: {
  blocks: RenderBlock[];
  lang?: Lang;
  media?: MediaMap;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  news?: NewsCardData[];
  assoc?: AssocData;
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
      const rendered = renderBlock(block, lang, media, renderTree(block.id), news, assoc, Boolean(onSelect));
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
