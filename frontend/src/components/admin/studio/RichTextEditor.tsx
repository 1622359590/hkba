'use client';

import { useEffect, useRef, useState } from 'react';

const SAFE_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br']);

function safeUrl(value: string): boolean {
  const url = value.trim();
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url);
}

export function normalizeRichTextHtml(input: string): string {
  if (typeof window === 'undefined' || !input) return input || '';
  const parsed = new DOMParser().parseFromString(input, 'text/html');
  const output = document.implementation.createHTMLDocument('');

  const clean = (node: Node): Node => {
    if (node.nodeType === Node.TEXT_NODE) return output.createTextNode(node.textContent || '');
    if (!(node instanceof HTMLElement)) return output.createDocumentFragment();

    const sourceTag = node.tagName.toLowerCase();
    if (sourceTag === 'script' || sourceTag === 'style' || sourceTag === 'iframe') {
      return output.createDocumentFragment();
    }

    const tag = sourceTag === 'b' ? 'strong' : sourceTag === 'i' ? 'em' : sourceTag;
    const children = output.createDocumentFragment();
    node.childNodes.forEach((child) => children.appendChild(clean(child)));
    if (!SAFE_TAGS.has(tag)) return children;

    const element = output.createElement(tag);
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (!safeUrl(href)) return children;
      element.setAttribute('href', href.trim());
    }
    element.appendChild(children);
    return element;
  };

  const container = output.createElement('div');
  parsed.body.childNodes.forEach((node) => container.appendChild(clean(node)));
  return (container.textContent || '').trim() ? container.innerHTML : '';
}

export default function RichTextEditor({
  value,
  onChange,
  label,
  required = false,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  maxLength?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState('');
  const [count, setCount] = useState(0);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const normalized = normalizeRichTextHtml(value);
    if (editor.innerHTML !== normalized) editor.innerHTML = normalized;
    setCount((editor.textContent || '').trim().length);
  }, [value]);

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setCount((editor.textContent || '').trim().length);
    onChange((editor.textContent || '').trim() ? editor.innerHTML : '');
  };

  const run = (command: string, argument?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    emit();
  };

  const openLink = () => {
    const selection = window.getSelection();
    savedRangeRef.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    setLinkValue('');
    setLinkError('');
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!safeUrl(linkValue)) {
      setLinkError('請輸入 https://、mailto:、tel: 或站內連結');
      return;
    }
    const selection = window.getSelection();
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
    run('createLink', linkValue.trim());
    setLinkOpen(false);
  };

  const paste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const clean = html
      ? normalizeRichTextHtml(html)
      : text.split(/\n{2,}/).map((part) => `<p>${part.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('');
    document.execCommand('insertHTML', false, clean);
    emit();
  };

  return (
    <div className="hk-field hk-rich-field">
      <div className="hk-field__head">
        <span className="hk-field__label">{label}{required ? <small>必填</small> : null}</span>
        {maxLength ? <span className="hk-field__count">{count} / {maxLength}</span> : null}
      </div>
      <div className="hk-rich-editor">
        <div className="hk-rich-editor__toolbar" role="toolbar" aria-label={`${label}格式工具`}>
          <select aria-label="段落格式" defaultValue="p" onChange={(event) => run('formatBlock', event.target.value)}>
            <option value="p">正文</option>
            <option value="h2">標題 2</option>
            <option value="h3">標題 3</option>
            <option value="h4">標題 4</option>
          </select>
          <span className="hk-rich-editor__divider" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run('bold')} aria-label="粗體" title="粗體"><strong>B</strong></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run('italic')} aria-label="斜體" title="斜體"><em>I</em></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={openLink} aria-label="加入連結" title="加入連結">↗</button>
          <span className="hk-rich-editor__divider" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertUnorderedList')} aria-label="項目列表" title="項目列表">•≡</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertOrderedList')} aria-label="編號列表" title="編號列表">1≡</button>
          <span className="hk-rich-editor__divider" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run('undo')} aria-label="復原" title="復原">↶</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run('redo')} aria-label="重做" title="重做">↷</button>
        </div>
        {linkOpen ? (
          <div className="hk-rich-editor__link">
            <input ref={linkInputRef} value={linkValue} onChange={(event) => setLinkValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyLink(); if (event.key === 'Escape') setLinkOpen(false); }} placeholder="https:// 或 /站內路徑" aria-label="連結地址" />
            <button type="button" onClick={applyLink}>套用</button>
            <button type="button" onClick={() => setLinkOpen(false)} aria-label="取消加入連結">取消</button>
            {linkError ? <span role="alert">{linkError}</span> : null}
          </div>
        ) : null}
        <div
          ref={editorRef}
          className="hk-rich-editor__surface"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          data-placeholder="輸入內容，或貼上已格式化文字"
          onInput={emit}
          onPaste={paste}
        />
        <div className="hk-rich-editor__foot"><span>{count} 個字</span><span>HTML 會在背景自動產生</span></div>
      </div>
    </div>
  );
}
