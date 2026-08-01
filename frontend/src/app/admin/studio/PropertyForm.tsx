'use client';
// Schema-driven property form (ui-interaction-system §5.4).
//
// The registry definition's schema.content/settings field maps drive every
// control: string/integer/enum/boolean inputs, nested objects (link fields),
// arrays of objects (FAQ/stat items) and media reference pickers. Editing
// writes through onChange; the studio page owns debounce + persistence.

import { AssocPerson, RenderBlock } from '@/components/blocks/BlockRenderer';

export type FieldDef = {
  type: 'string' | 'integer' | 'enum' | 'boolean' | 'array' | 'object';
  label?: string;
  required?: boolean;
  default?: unknown;
  maxLength?: number;
  min?: number;
  max?: number;
  values?: string[];
  media?: boolean;
  item?: FieldDef;
  fields?: Record<string, FieldDef>;
};

export type Definition = {
  type: string;
  version: number;
  category: string;
  name: { zh: string; en?: string };
  description?: string;
  allowedPageTypes: string[];
  isLayout: boolean;
  schema: {
    content: { fields: Record<string, FieldDef> };
    settings: { fields: Record<string, FieldDef> };
  };
};

function defaultFor(def: FieldDef): unknown {
  if (def.default !== undefined) return def.default;
  if (def.type === 'object') {
    const value: Record<string, unknown> = {};
    for (const [key, sub] of Object.entries(def.fields || {})) value[key] = defaultFor(sub);
    return value;
  }
  if (def.type === 'array') return [];
  if (def.type === 'boolean') return false;
  if (def.type === 'integer') return '';
  return '';
}

function BoardMemberSelector({
  people,
  lang,
  value,
  onChange,
}: {
  people: AssocPerson[];
  lang: 'zh' | 'en';
  value: unknown;
  onChange: (value: number[]) => void;
}) {
  const selectedIds = Array.isArray(value)
    ? [...new Set(value.map(Number).filter(Number.isInteger))]
    : [];
  const selectedSet = new Set(selectedIds);
  const peopleById = new Map(people.map((person) => [Number(person.id), person]));
  const orderedPeople = [
    ...selectedIds.map((id) => peopleById.get(id)).filter((person): person is AssocPerson => Boolean(person)),
    ...people.filter((person) => !selectedSet.has(Number(person.id))),
  ];

  const move = (id: number, direction: -1 | 1) => {
    const index = selectedIds.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="hk-field hk-member-selector">
      <div className="hk-member-selector__head">
        <span className="hk-field__label">指定展示成員</span>
        {selectedIds.length ? <button type="button" className="hk-text-action" onClick={() => onChange([])}>清除選擇</button> : null}
      </div>
      <p className="hk-member-selector__hint">
        {selectedIds.length ? `已指定 ${selectedIds.length} 位，按下列順序展示。` : '目前為自動模式，會依角色篩選與顯示數量取用成員。'}
      </p>
      <div className="hk-member-selector__list">
        {orderedPeople.map((person) => {
          const id = Number(person.id);
          const selectedIndex = selectedIds.indexOf(id);
          const selected = selectedIndex >= 0;
          const name = (lang === 'en' ? person.nameEn || person.nameZh : person.nameZh || person.nameEn) || `#${id}`;
          const title = lang === 'en' ? person.titleEn || person.titleZh : person.titleZh || person.titleEn;
          return (
            <div className={`hk-member-selector__row${selected ? ' is-selected' : ''}`} key={id}>
              <label className="hk-member-selector__identity">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => onChange(event.target.checked ? [...selectedIds, id] : selectedIds.filter((entry) => entry !== id))}
                />
                <span className="hk-member-selector__avatar">
                  {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : name.slice(0, 1)}
                </span>
                <span className="hk-member-selector__copy">
                  <strong>{name}</strong>
                  {title ? <small>{title}</small> : null}
                </span>
              </label>
              {selected ? (
                <div className="hk-member-selector__order">
                  <span>{selectedIndex + 1}</span>
                  <button type="button" title="向前移動" aria-label={`${name} 向前移動`} disabled={selectedIndex === 0} onClick={() => move(id, -1)}>↑</button>
                  <button type="button" title="向後移動" aria-label={`${name} 向後移動`} disabled={selectedIndex === selectedIds.length - 1} onClick={() => move(id, 1)}>↓</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldInput({
  fieldKey,
  def,
  value,
  onChange,
  onPickMedia,
}: {
  fieldKey: string;
  def: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onPickMedia: (apply: (mediaId: string | null) => void) => void;
}) {
  const label = (
    <span className="hk-field__label">
      {def.label || fieldKey}
      {def.required ? <small>必填</small> : null}
    </span>
  );

  if (def.media) {
    const current = typeof value === 'string' ? value : '';
    return (
      <div className="hk-field">
        {label}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="hk-input" value={current} readOnly placeholder="未選擇媒體" style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => onPickMedia((id) => onChange(id || ''))}>
            選擇
          </button>
          {current ? (
            <button type="button" className="btn-secondary" style={{ padding: '8px 10px', fontSize: 12 }} onClick={() => onChange('')} aria-label="清除媒體">
              ✕
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (def.type === 'boolean') {
    return (
      <label className="hk-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span className="hk-field__label">{def.label || fieldKey}</span>
      </label>
    );
  }

  if (def.type === 'integer') {
    return (
      <div className="hk-field">
        {label}
        <input
          className="hk-input"
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          min={def.min}
          max={def.max}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        />
      </div>
    );
  }

  if (def.type === 'enum') {
    return (
      <div className="hk-field">
        {label}
        <select className="hk-select" value={String(value ?? def.default ?? '')} onChange={(event) => onChange(event.target.value)}>
          {(def.values || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (def.type === 'object') {
    const record = (value || {}) as Record<string, unknown>;
    return (
      <div className="hk-field">
        {label}
        <div className="hk-form__group">
          {Object.entries(def.fields || {}).map(([subKey, subDef]) => (
            <FieldInput
              key={subKey}
              fieldKey={subKey}
              def={subDef}
              value={record[subKey]}
              onChange={(next) => onChange({ ...record, [subKey]: next })}
              onPickMedia={onPickMedia}
            />
          ))}
        </div>
      </div>
    );
  }

  if (def.type === 'array') {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    if (def.item?.type === 'object') {
      return (
        <div className="hk-field">
          {label}
          {items.map((item, index) => (
            <div className="hk-form__group" key={index}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="hk-form__group-title">#{index + 1}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={() => onChange(items.filter((_, entry) => entry !== index))}
                >
                  刪除
                </button>
              </div>
              {Object.entries(def.item?.fields || {}).map(([subKey, subDef]) => (
                <FieldInput
                  key={subKey}
                  fieldKey={subKey}
                  def={subDef}
                  value={item[subKey]}
                  onChange={(next) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [subKey]: next } : entry)))}
                  onPickMedia={onPickMedia}
                />
              ))}
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: 12 }}
            onClick={() => onChange([...items, defaultFor(def.item as FieldDef)])}
          >
            ＋ 新增一項
          </button>
        </div>
      );
    }
    // Array of primitives: comma-separated input is the v1 editor.
    const list = Array.isArray(value) ? (value as unknown[]).map(String) : [];
    return (
      <div className="hk-field">
        {label}
        <input
          className="hk-input"
          value={list.join(', ')}
          placeholder="以逗號分隔多個值"
          onChange={(event) =>
            onChange(
              event.target.value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
            )
          }
        />
      </div>
    );
  }

  // Plain string (default).
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  const long = (def.maxLength || 0) > 200;
  return (
    <div className="hk-field">
      {label}
      {long ? (
        <textarea className="hk-textarea" value={text} maxLength={def.maxLength} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="hk-input" value={text} maxLength={def.maxLength} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

export default function PropertyForm({
  definition,
  block,
  lang,
  onChange,
  onPickMedia,
  people = [],
}: {
  definition: Definition;
  block: RenderBlock;
  lang: 'zh' | 'en';
  onChange: (scope: 'contentZh' | 'contentEn' | 'settings', key: string, value: unknown) => void;
  onPickMedia: (apply: (mediaId: string | null) => void) => void;
  people?: AssocPerson[];
}) {
  const scope = lang === 'en' ? 'contentEn' : 'contentZh';
  const content = block[scope] as Record<string, unknown>;
  const settings = block.settings as Record<string, unknown>;
  const contentFields = Object.entries(definition.schema.content.fields);
  const isBoard = definition.type === 'association.board';
  const hasSelectedMembers = isBoard && Array.isArray(settings.selectedMemberIds) && settings.selectedMemberIds.length > 0;
  const automaticBoardFields = new Set(['term', 'roles', 'status', 'limit']);
  const settingsFields = Object.entries(definition.schema.settings.fields).filter(([key]) => (
    (!isBoard || key !== 'selectedMemberIds') && (!hasSelectedMembers || !automaticBoardFields.has(key))
  ));

  return (
    <div className="hk-form">
      <div className="hk-form__group">
        <div className="hk-form__group-title">{lang === 'en' ? '內容（英文）' : '內容（中文）'}</div>
        {contentFields.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-3)' }}>此組件沒有內容欄位</div> : null}
        {contentFields.map(([key, def]) => (
          <FieldInput key={`${block.id}:${scope}:${key}`} fieldKey={key} def={def} value={content[key]} onChange={(value) => onChange(scope, key, value)} onPickMedia={onPickMedia} />
        ))}
      </div>
      {settingsFields.length > 0 ? (
        <div className="hk-form__group">
          <div className="hk-form__group-title">設置</div>
          {isBoard ? (
            <BoardMemberSelector
              people={people}
              lang={lang}
              value={settings.selectedMemberIds}
              onChange={(value) => onChange('settings', 'selectedMemberIds', value)}
            />
          ) : null}
          {settingsFields.map(([key, def]) => (
            <FieldInput key={`${block.id}:settings:${key}`} fieldKey={key} def={def} value={settings[key]} onChange={(value) => onChange('settings', key, value)} onPickMedia={onPickMedia} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
