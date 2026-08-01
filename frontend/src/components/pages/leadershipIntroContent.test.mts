import assert from 'node:assert/strict';
import test from 'node:test';
import { getLeadershipIntro } from './leadershipIntroContent.ts';

test('returns the Traditional Chinese leadership responsibilities and composition', () => {
  const content = getLeadershipIntro('zh');

  assert.equal(content.title, '領導委員會');
  assert.match(content.responsibility, /策略方向/);
  assert.deepEqual(
    content.composition.map(item => item.title),
    ['主席團', '專業委員', '顧問團隊'],
  );
});

test('returns the English leadership responsibilities and composition', () => {
  const content = getLeadershipIntro('en');

  assert.equal(content.title, 'Leadership Committee');
  assert.match(content.responsibility, /strategic direction/i);
  assert.deepEqual(
    content.composition.map(item => item.title),
    ['Chairmanship', 'Committee Members', 'Advisory Network'],
  );
});
