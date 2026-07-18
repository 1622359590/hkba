'use client';
// Schema-driven property form (ui-interaction-system §5.4).
//
// The registry definition's schema.content/settings field maps drive every
// control: string/integer/enum/boolean inputs, nested objects (link fields),
// arrays of objects (FAQ/stat items) and media reference pickers. Editing
// writes through onChange; the studio page owns debounce + persistence.

import { RenderBlock } from '@/components/blocks/BlockRenderer';

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
}: {
  definition: Definition;
  block: RenderBlock;
  lang: 'zh' | 'en';
  onChange: (scope: 'contentZh' | 'contentEn' | 'settings', key: string, value: unknown) => void;
  onPickMedia: (apply: (mediaId: string | null) => void) => void;
}) {
  const scope = lang === 'en' ? 'contentEn' : 'contentZh';
  const content = block[scope] as Record<string, unknown>;
  const settings = block.settings as Record<string, unknown>;
  const contentFields = Object.entries(definition.schema.content.fields);
  const settingsFields = Object.entries(definition.schema.settings.fields);

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
          {settingsFields.map(([key, def]) => (
            <FieldInput key={`${block.id}:settings:${key}`} fieldKey={key} def={def} value={settings[key]} onChange={(value) => onChange('settings', key, value)} onPickMedia={onPickMedia} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
