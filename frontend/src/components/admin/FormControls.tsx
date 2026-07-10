'use client';
import { useState, ReactNode } from 'react';

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6, fontWeight: 500 };

export function FormField({ label, children, required, htmlFor }: { label: string; children: ReactNode; required?: boolean; htmlFor?: string }) {
  return <div style={{ marginBottom: 16 }}><label htmlFor={htmlFor} style={labelStyle}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>{children}</div>;
}

export function Input({ value, onChange, type, placeholder, id, ariaLabel }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; id?: string; ariaLabel?: string }) {
  return <input id={id} aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder} className="form-input" style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13 }} />;
}

export function Textarea({ value, onChange, rows = 4, id, ariaLabel }: { value: string; onChange: (v: string) => void; rows?: number; id?: string; ariaLabel?: string }) {
  return <textarea id={id} aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)} rows={rows} className="form-input" style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, resize: 'vertical' as const }} />;
}

export function Select({ value, onChange, options, id, ariaLabel }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; id?: string; ariaLabel?: string }) {
  return <select id={id} aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)} className="form-input" style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>{options.map(o => <option key={o.value} value={o.value} style={{ background: '#17171a' }}>{o.label}</option>)}</select>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <div style={{ width: 36, height: 20, borderRadius: 10, background: checked ? '#6366f1' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: 2, transform: checked ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
      </div>
      <span style={{ fontSize: 13, color: '#a1a1aa' }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
    </label>
  );
}

export function BilingualField({ label, valueZh, valueEn, onChangeZh, onChangeEn, type = 'text', rows = 4, required }: { label: string; valueZh: string; valueEn: string; onChangeZh: (v: string) => void; onChangeEn: (v: string) => void; type?: 'text' | 'textarea'; rows?: number; required?: boolean }) {
  return (
    <FormField label={label} required={required}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><span style={{ fontSize: 10, color: '#52525b', display: 'block', marginBottom: 4 }}>繁中</span>{type === 'textarea' ? <Textarea id={`${label}-zh`} ariaLabel={`${label} 繁中`} value={valueZh} onChange={onChangeZh} rows={rows} /> : <Input id={`${label}-zh`} ariaLabel={`${label} 繁中`} value={valueZh} onChange={onChangeZh} />}</div>
        <div><span style={{ fontSize: 10, color: '#52525b', display: 'block', marginBottom: 4 }}>English</span>{type === 'textarea' ? <Textarea id={`${label}-en`} ariaLabel={`${label} English`} value={valueEn} onChange={onChangeEn} rows={rows} /> : <Input id={`${label}-en`} ariaLabel={`${label} English`} value={valueEn} onChange={onChangeEn} />}</div>
      </div>
    </FormField>
  );
}

export function ImageField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true); setUploadError('');
    try {
      const { adminUpload } = await import('@/lib/adminApi');
      const r = await adminUpload(file, 'general');
      onChange(r.url);
    } catch {
      setUploadError('上傳失敗，請稍後重試或直接輸入圖片 URL。');
    } finally {
      e.target.value = '';
      setUploading(false);
    }
  };
  return (
    <FormField label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        {value && <img src={value.startsWith('http') ? value : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:37900'}${value}`} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }} />}
        <label className="admin-action is-muted" style={{ cursor: 'pointer' }}>{uploading ? '上傳中...' : '選擇圖片'}<input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} /></label>
        {value && <button type="button" onClick={() => onChange('')} className="admin-action is-danger" aria-label={`${label}移除圖片`}>移除</button>}
      </div>
      <Input value={value} onChange={onChange} placeholder="或輸入圖片 URL" />
      <p style={{ color: '#71717a', fontSize: 11, marginTop: 6 }}>JPG、PNG、GIF、WebP、SVG、ICO，最大 5MB</p>
      {uploadError && <p style={{ color: '#fca5a5', fontSize: 12, marginTop: 6 }}>{uploadError}</p>}
    </FormField>
  );
}

export function AdminCard({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="admin-panel" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{title}</h3>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}
