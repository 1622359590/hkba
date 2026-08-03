'use client';
// Schema-driven property form (ui-interaction-system §5.4).
//
// The registry definition's schema.content/settings field maps drive every
// control: string/integer/enum/boolean inputs, nested objects (link fields),
// arrays of objects (FAQ/stat items) and media reference pickers. Editing
// writes through onChange; the studio page owns debounce + persistence.

import { AssocGroup, AssocPerson, RenderBlock } from '@/components/blocks/BlockRenderer';
import MediaField from '@/components/admin/studio/MediaField';
import MemberRoleSelector from '@/components/admin/studio/MemberRoleSelector';
import RichTextEditor from '@/components/admin/studio/RichTextEditor';
import { useEffect, useState } from 'react';

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

function MemberSelector({
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

function hasObjectValue(record: Record<string, unknown>): boolean {
  return Object.values(record).some((entry) => {
    if (typeof entry === 'string') return entry.trim().length > 0;
    if (Array.isArray(entry)) return entry.length > 0;
    return entry !== undefined && entry !== null && entry !== false && entry !== '';
  });
}

function ObjectField({
  componentType,
  fieldKey,
  def,
  record,
  onChange,
  onPickMedia,
}: {
  componentType: string;
  fieldKey: string;
  def: FieldDef;
  record: Record<string, unknown>;
  onChange: (value: unknown) => void;
  onPickMedia: (apply: (mediaId: string | null) => void) => void;
}) {
  const fields = Object.entries(def.fields || {});
  const optional = fields.length > 0 && fields.every(([, child]) => !child.required);
  const populated = hasObjectValue(record);
  const [enabled, setEnabled] = useState(!optional || populated);

  useEffect(() => {
    if (populated) setEnabled(true);
  }, [populated]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      onChange(Object.fromEntries(fields.map(([key, child]) => [key, defaultFor(child)])));
    }
  };

  return (
    <div className="hk-field hk-object-field">
      <div className="hk-object-field__head">
        <div>
          <span className="hk-field__label">{def.label || fieldKey}</span>
          {optional ? <small>{enabled ? '已啟用' : '需要時再開啟'}</small> : null}
        </div>
        {optional ? (
          <button type="button" className={`hk-switch${enabled ? ' is-on' : ''}`} role="switch" aria-checked={enabled} onClick={toggle} aria-label={`${enabled ? '停用' : '啟用'}${def.label || fieldKey}`}><span /></button>
        ) : null}
      </div>
      {enabled ? (
        <div className="hk-form__compound">
          {fields.map(([subKey, subDef]) => (
            <FieldInput
              key={subKey}
              componentType={componentType}
              fieldKey={subKey}
              def={subDef}
              value={record[subKey]}
              onChange={(next) => onChange({ ...record, [subKey]: next })}
              onPickMedia={onPickMedia}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FieldInput({
  componentType,
  fieldKey,
  def,
  value,
  onChange,
  onPickMedia,
}: {
  componentType: string;
  fieldKey: string;
  def: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onPickMedia: (apply: (mediaId: string | null) => void) => void;
}) {
  const label = (
    <span className="hk-field__label">{def.label || fieldKey}{def.required ? <small>必填</small> : null}</span>
  );

  if (def.media) {
    const current = typeof value === 'string' ? value : '';
    return (
      <MediaField value={current} onChange={onChange} label={def.label || fieldKey} required={def.required} onPickMedia={onPickMedia} />
    );
  }

  if (def.type === 'boolean') {
    return (
      <label className="hk-toggle-field">
        <span><strong>{def.label || fieldKey}</strong><small>{Boolean(value) ? '已啟用' : '已停用'}</small></span>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <i aria-hidden="true" />
      </label>
    );
  }

  if (def.type === 'integer') {
    return (
      <div className="hk-field">
        <div className="hk-field__head">{label}</div>
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
        <div className="hk-field__head">{label}</div>
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
    return <ObjectField componentType={componentType} fieldKey={fieldKey} def={def} record={record} onChange={onChange} onPickMedia={onPickMedia} />;
  }

  if (def.type === 'array') {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    if (def.item?.type === 'object') {
      return (
        <div className="hk-field">
          <div className="hk-field__head">{label}<span className="hk-field__meta">{items.length} 項</span></div>
          {items.map((item, index) => (
            <div className="hk-form__repeat" key={index}>
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
                  componentType={componentType}
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
        <div className="hk-field__head">{label}<span className="hk-field__meta">以逗號分隔</span></div>
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
  if (componentType === 'content.rich-text' && fieldKey === 'html') {
    return <RichTextEditor value={text} onChange={onChange} label={def.label || fieldKey} required={def.required} maxLength={def.maxLength} />;
  }
  return (
    <div className="hk-field">
      <div className="hk-field__head">
        {label}
        {def.maxLength ? <span className="hk-field__count">{text.length} / {def.maxLength}</span> : null}
      </div>
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
  groups = [],
  contentFallback = {},
}: {
  definition: Definition;
  block: RenderBlock;
  lang: 'zh' | 'en';
  onChange: (scope: 'contentZh' | 'contentEn' | 'settings', key: string, value: unknown) => void;
  onPickMedia: (apply: (mediaId: string | null) => void) => void;
  people?: AssocPerson[];
  groups?: AssocGroup[];
  contentFallback?: Record<string, unknown>;
}) {
  const scope = lang === 'en' ? 'contentEn' : 'contentZh';
  const content = { ...contentFallback, ...(block[scope] as Record<string, unknown>) };
  const settings = block.settings as Record<string, unknown>;
  const contentFields = Object.entries(definition.schema.content.fields);
  const isPeopleComponent = definition.type === 'association.board' || definition.type === 'association.members';
  const hasSelectedMembers = isPeopleComponent && Array.isArray(settings.selectedMemberIds) && settings.selectedMemberIds.length > 0;
  const automaticBoardFields = new Set(['term', 'roles', 'status', 'limit']);
  const legacyMemberFields = new Set(['memberType', 'industry', 'letter']);
  const managedMemberFields = new Set(['roles', 'roleOrder']);
  const settingsFields = Object.entries(definition.schema.settings.fields).filter(([key]) => (
    (!isPeopleComponent || key !== 'selectedMemberIds')
    && (definition.type !== 'association.members' || !legacyMemberFields.has(key))
    && (definition.type !== 'association.members' || !managedMemberFields.has(key))
    && (!hasSelectedMembers || !automaticBoardFields.has(key))
  ));

  return (
    <div className="hk-form">
      <section className="hk-form__section">
        <div className="hk-form__section-head"><span>{lang === 'en' ? '內容' : '內容'}</span><small>{lang === 'en' ? 'English' : '繁體中文'}</small></div>
        {contentFields.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-3)' }}>此組件沒有內容欄位</div> : null}
        {contentFields.map(([key, def]) => (
          <FieldInput key={`${block.id}:${scope}:${key}`} componentType={definition.type} fieldKey={key} def={def} value={content[key]} onChange={(value) => onChange(scope, key, value)} onPickMedia={onPickMedia} />
        ))}
      </section>
      {settingsFields.length > 0 ? (
        <section className="hk-form__section">
          <div className="hk-form__section-head"><span>顯示設定</span><small>只影響版面</small></div>
          {isPeopleComponent ? (
            <MemberSelector
              people={people}
              lang={lang}
              value={settings.selectedMemberIds}
              onChange={(value) => onChange('settings', 'selectedMemberIds', value)}
            />
          ) : null}
          {definition.type === 'association.members' && !hasSelectedMembers ? (
            <MemberRoleSelector
              groups={groups}
              selected={settings.roles}
              order={settings.roleOrder}
              onChange={(roles, roleOrder) => {
                onChange('settings', 'roles', roles);
                onChange('settings', 'roleOrder', roleOrder);
              }}
            />
          ) : null}
          {settingsFields.map(([key, def]) => (
            <FieldInput key={`${block.id}:settings:${key}`} componentType={definition.type} fieldKey={key} def={def} value={settings[key]} onChange={(value) => onChange('settings', key, value)} onPickMedia={onPickMedia} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
