'use client';

import { useLang } from '@/lib/useLang';
import { getLeadershipIntro } from './leadershipIntroContent';

export default function LeadershipIntro({ headingLevel = 'h1' }: { headingLevel?: 'h1' | 'h2' }) {
  const { lang } = useLang();
  const content = getLeadershipIntro(lang);
  const Title = headingLevel;

  return (
    <section className="leadership-intro" aria-labelledby="leadership-intro-title">
      <div className="leadership-intro__ambient" aria-hidden="true" />
      <div className="leadership-intro__container">
        <div className="leadership-intro__identity">
          <div className="leadership-intro__meta">
            <span>{content.eyebrow}</span>
            <span aria-hidden="true">HKBA / 01</span>
          </div>

          <Title id="leadership-intro-title" className="leadership-intro__title">
            {content.title}
          </Title>
          <p className="leadership-intro__lead">{content.lead}</p>
          <p className="leadership-intro__responsibility">{content.responsibility}</p>

          <div className="leadership-intro__scope" aria-label={content.scopeLabel}>
            <span className="leadership-intro__scope-label">{content.scopeLabel}</span>
            <div className="leadership-intro__scope-items">
              {content.scope.map(item => <span key={item}>{item}</span>)}
            </div>
          </div>
        </div>

        <aside className="leadership-intro__composition" aria-label={content.compositionLabel}>
          <div className="leadership-intro__composition-label">{content.compositionLabel}</div>
          <ol className="leadership-intro__composition-list">
            {content.composition.map((item, index) => (
              <li key={item.title}>
                <span className="leadership-intro__composition-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}
