'use client';
// Global admin search (ui-interaction-system §4.3): locates sections, pages,
// news and system modules. Client-side over already-fetched lists — the
// simplified galaxy phase adds no backend search endpoint.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type SearchEntry = {
  group: string;
  label: string;
  hint?: string;
  href: string;
  keywords?: string;
};

export default function GlobalSearch({ entries }: { entries: SearchEntry[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return entries
      .filter((entry) =>
        [entry.label, entry.hint || '', entry.keywords || '', entry.group]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 12);
  }, [entries, query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const go = (entry: SearchEntry) => {
    setOpen(false);
    setQuery('');
    router.push(entry.href);
  };

  const groups: { name: string; items: { entry: SearchEntry; index: number }[] }[] = [];
  results.forEach((entry, index) => {
    let group = groups.find((item) => item.name === entry.group);
    if (!group) {
      group = { name: entry.group, items: [] };
      groups.push(group);
    }
    group.items.push({ entry, index });
  });

  return (
    <div className="hk-search" ref={boxRef}>
      <span className="hk-search__icon">
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
      </span>
      <input
        className="hk-search__input"
        type="search"
        placeholder="搜索欄目、頁面、新聞或系統模組…"
        aria-label="全局搜索"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (!results.length) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((value) => (value + 1) % results.length);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((value) => (value - 1 + results.length) % results.length);
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            go(results[active]);
          }
        }}
      />
      {open && query.trim() ? (
        <div className="hk-search__results" role="listbox">
          {results.length === 0 ? (
            <div className="hk-search__empty">沒有匹配「{query.trim()}」的內容</div>
          ) : (
            groups.map((group) => (
              <div key={group.name}>
                <div className="hk-search__group">{group.name}</div>
                {group.items.map(({ entry, index }) => (
                  <button
                    key={`${entry.group}-${entry.href}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className={`hk-search__item${index === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(entry)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</span>
                    {entry.hint ? <small>{entry.hint}</small> : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
