// 순수 로직 검사: node --test talk-notes/tests/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { words, similarity, compare, makeCloze, heardWord, sameSentence, stripHtml } from '../js/core/text.js';
import { grade, nextInterval, dayNum, dayKey, isDue, level, suggestGrade, fresh } from '../js/core/srs.js';
import { LESSONS, TAGS, MIST, GROW, PHR, PRON } from '../js/data/notes.js';
import { CARDS, CARD, PHRASES, PATTERNS, PRON_ROWS, PAIRS, clozeOf, clozeBank, poolFor, buildSession, buildToday, resolve, itemKey, parseKey, search } from '../js/core/deck.js';

const blankS = () => ({ settings: { newOrder: 'recent' }, srs: {}, stars: {}, tagStats: {} });

test('원본 노트 내용이 빠짐없이 들어 있다', () => {
  assert.equal(LESSONS.length, 10);
  assert.equal(CARDS.length, 633);
  assert.deepEqual(LESSONS.map(l => l.cards.length), [73, 64, 68, 47, 55, 70, 84, 59, 67, 46]);
  assert.equal(MIST.length, 11);
  assert.equal(GROW.length, 12);
  assert.equal(PHR.length, 6);
  assert.equal(PHRASES.length, 36);
  assert.equal(PRON.length, 3);
  assert.equal(PRON_ROWS.length, 36);
  assert.equal(Object.keys(TAGS).length, 13);
  for (const c of CARDS) {
    for (const k of ['c', 'o', 'f', 't', 'e', 'n', 'nk', 'g']) assert.ok(k in c, c.id + ' ' + k);
    assert.ok(c.f && c.t && c.n && c.nk && c.e.length && c.g.length, c.id);
    for (const t of c.g) assert.ok(TAGS[t], c.id + ' 태그 ' + t);
  }
  assert.equal(new Set(CARDS.map(c => c.id)).size, CARDS.length);
});

test('문장 비교: 줄임말·대소문자·문장부호 무시', () => {
  assert.deepEqual(words("I'm FINE, thanks!"), ['i', 'am', 'fine', 'thanks']);
  assert.deepEqual(words("I can't go."), ['i', 'can', 'not', 'go']);
  assert.equal(similarity("I've been pretty busy these days", 'I have been pretty busy these days.'), 1);
  assert.equal(similarity('', 'hello'), 0);
  const c = compare('I listen music', 'I listen to music');
  assert.deepEqual(c.missing, ['to']);
  assert.deepEqual(c.extra, []);
  assert.ok(c.score > 0.8 && c.score < 1);
  assert.ok(sameSentence('Yeah, I think so.', 'yeah i think so'));
  assert.equal(stripHtml('<b>near</b> + 장소'), 'near + 장소');
});

test('빈칸: 고친 말이 빈칸, 원래 한 말이 함정', () => {
  const z = makeCloze('I feel confident in these words.', 'I feel confident with these words.');
  assert.equal(z.blanks.length, 1);
  assert.equal(z.blanks[0].answer, 'with');
  assert.deepEqual(z.bank.map(b => [b.text, b.correct]), [['with', true], ['in', false]]);
  assert.equal(makeCloze('', 'abc def ghi'), null);
  assert.equal(makeCloze('totally different words here now', 'Nothing in common at all, really.'), null);
  // 모든 빈칸 문제: 빈칸 답을 넣으면 수정문이 그대로 된다
  let n = 0;
  for (const c of CARDS) {
    const z = clozeOf(c);
    if (!z) continue;
    n++;
    const filled = z.parts.map(p => p.raw != null ? p.raw : p.lead + z.blanks[p.blank].answer + p.trail).join(' ');
    assert.equal(filled.replace(/\s+/g, ' '), stripHtml(c.f).trim().split(/\s+/).join(' '), c.id);
    assert.ok(z.bank.filter(b => b.correct).length === z.blanks.length, c.id);
    const bank = clozeBank(c, () => 0.3);
    assert.ok(bank.length >= z.blanks.length + 1, c.id);
    assert.equal(new Set(bank.map(b => b.keys)).size, bank.length, c.id + ' 보기 중복');
  }
  assert.ok(n > 150, '빈칸 문제 수 ' + n);
});

test('발음 확인', () => {
  assert.ok(heardWord('rice', ['I like rice']));
  assert.ok(!heardWord('rice', ['lice']));
  assert.ok(heardWord('small talk', ['small talk is hard']));
  assert.ok(!heardWord('small talk', ['smart talk']));
  assert.ok(heardWord('genres', ['genre']));
});

test('간격 반복', () => {
  const t0 = Date.UTC(2026, 9, 27, 12);
  let s = grade(null, 2, t0);
  assert.equal(s.i, 1); assert.equal(s.n, 1); assert.equal(s.c, 1);
  s = grade(s, 2, t0); assert.equal(s.i, 3);
  s = grade(s, 2, t0); assert.ok(s.i >= 7);
  const big = s.i;
  s = grade(s, 0, t0); assert.equal(s.i, 0); assert.equal(s.l, 1); assert.equal(s.r, 0);
  assert.ok(isDue(s, dayNum(t0)));
  assert.equal(nextInterval(fresh(), 3), 3);
  assert.equal(nextInterval(fresh(), 0), 0);
  assert.ok(big > 3);
  assert.equal(level(null), 'new');
  assert.equal(level({ n: 3, i: 30 }), 'mastered');
  assert.equal(suggestGrade(0.97), 3); assert.equal(suggestGrade(0.85), 2); assert.equal(suggestGrade(0.65), 1); assert.equal(suggestGrade(0.2), 0);
  assert.match(dayKey(dayNum(t0)), /^2026-10-2[67]$/);
});

test('문제 목록과 세션', () => {
  const S = blankS();
  assert.equal(poolFor('speak', {}, S).length, 633);
  assert.equal(poolFor('speak', { lesson: 0 }, S).length, 73);
  assert.equal(poolFor('speak', { tag: 'cond' }, S).length, 11);
  assert.equal(poolFor('pron', {}, S).length, 36);
  assert.equal(poolFor('pair', {}, S).length, PAIRS.length);
  assert.equal(poolFor('phrase', { group: 0 }, S).length, 6);
  assert.equal(poolFor('pattern', {}, S).length, PATTERNS.length);
  for (const m of ['speak', 'cloze', 'fix', 'shadow', 'pron', 'pair', 'phrase', 'pattern'])
    for (const k of poolFor(m, {}, S)) { const r = resolve(k); assert.ok(r && r.type === m, k); assert.equal(parseKey(k).type, m); }
  // 새 세션: 맞는 문장(ok) 카드는 뒤로, 최근 수업부터
  const s1 = buildSession('speak', {}, S, { size: 10, order: 'due' });
  assert.equal(s1.length, 10);
  assert.ok(s1.every(k => !resolve(k).card.ok));
  assert.equal(resolve(s1[0]).card.li, 9);
  // 복습할 것이 먼저
  const k = itemKey('speak', '0807-3');
  S.srs[k] = Object.assign(fresh(), { n: 1, d: dayNum() - 1, i: 1 });
  assert.equal(buildSession('speak', {}, S, { size: 5 })[0], k);
  assert.deepEqual(buildSession('speak', {}, S, { size: 5, order: 'weak' }), [k]);
  // 오늘의 학습: 새 카드 제한
  const t = buildToday(S, { size: 20, newLimit: 3 });
  assert.ok(t.includes(k));
  assert.ok(t.length <= 1 + 3 + 3);
  // 별표
  S.stars['0828-1'] = 1;
  assert.deepEqual(poolFor('speak', { star: '1' }, S), [itemKey('speak', '0828-1')]);
  assert.ok(search('prepare for').length > 3);
  assert.ok(CARD['1026a-5']);
});
