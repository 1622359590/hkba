'use client';

import { useMemo, useState } from 'react';
import type { AssocGroup } from '@/components/blocks/BlockRenderer';
import { moveMemberRole, toggleMemberRole } from '@/lib/memberRoleSelection.mjs';

export default function MemberRoleSelector({
  groups,
  selected,
  order,
  onChange,
}: {
  groups: AssocGroup[];
  selected: unknown;
  order: unknown;
  onChange: (selected: string[], order: string[]) => void;
}) {
  const [message, setMessage] = useState('');
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
    [groups],
  );
  const allCodes = sortedGroups.map((group) => group.code);
  const selectedCodes = Array.isArray(selected)
    ? [...new Set(selected.map(String).filter((code) => allCodes.includes(code)))]
    : [];
  const explicitSelected = selectedCodes.length ? selectedCodes : allCodes;
  const requestedOrder = Array.isArray(order)
    ? order.map(String).filter((code) => explicitSelected.includes(code))
    : [];
  const displayOrder = [...new Set([...requestedOrder, ...explicitSelected])];
  const groupByCode = new Map(sortedGroups.map((group) => [group.code, group]));
  const rows = [
    ...displayOrder.map((code) => groupByCode.get(code)).filter((group): group is AssocGroup => Boolean(group)),
    ...sortedGroups.filter((group) => !explicitSelected.includes(group.code)),
  ];

  const toggle = (code: string) => {
    const result = toggleMemberRole(allCodes, selectedCodes, displayOrder, code);
    if (result.blocked) {
      setMessage('至少需要保留一個展示身份。');
      return;
    }
    setMessage('');
    onChange(result.selected, result.order);
  };

  const move = (code: string, direction: -1 | 1) => {
    setMessage('');
    onChange(explicitSelected, moveMemberRole(allCodes, explicitSelected, displayOrder, code, direction));
  };

  if (!sortedGroups.length) {
    return <div className="hk-role-selector__empty">尚未建立可用身份，請先到「團隊管理 → 身份結構」新增。</div>;
  }

  return (
    <div className="hk-field hk-role-selector">
      <div className="hk-role-selector__head">
        <div>
          <span className="hk-field__label">展示身份與排序</span>
          <p>勾選要顯示的身份；已勾選身份按下列次序排列。</p>
        </div>
        <span className="hk-role-selector__count">{explicitSelected.length}/{allCodes.length}</span>
      </div>
      <div className="hk-role-selector__list">
        {rows.map((group) => {
          const checked = explicitSelected.includes(group.code);
          const index = displayOrder.indexOf(group.code);
          return (
            <div className={`hk-role-selector__row${checked ? ' is-selected' : ''}`} key={group.code}>
              <label>
                <input type="checkbox" checked={checked} onChange={() => toggle(group.code)} />
                <span className="hk-role-selector__rank">{checked ? index + 1 : '–'}</span>
                <span className="hk-role-selector__name">
                  <strong>{group.labelZh}</strong>
                  <small>{group.labelEn || group.code}</small>
                </span>
                <span className="hk-role-selector__members">{group.memberCount} 人</span>
              </label>
              {checked ? (
                <div className="hk-role-selector__actions">
                  <button type="button" aria-label={`${group.labelZh}向上移動`} title="向上移動" disabled={index === 0} onClick={() => move(group.code, -1)}>↑</button>
                  <button type="button" aria-label={`${group.labelZh}向下移動`} title="向下移動" disabled={index === displayOrder.length - 1} onClick={() => move(group.code, 1)}>↓</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {message ? <p className="hk-role-selector__message" role="alert">{message}</p> : null}
    </div>
  );
}
