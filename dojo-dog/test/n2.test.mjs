// JLPT N2 데이터: 어휘·문법·문제은행·독해·청해의 형식과 개수 (정답이 하나뿐인지는 자동으로 판정할 수 없어 사람이 표본 검토)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { VOCAB } from '../src/data/vocab.js';
import { GRAMMAR } from '../src/data/grammar.js';
import { BANK, BANK_TYPES } from '../src/data/n2/bank.js';
import READING from '../src/data/n2/reading.js';
import LISTENING from '../src/data/n2/listening.js';

const run = (tool, args = []) => execFileSync('node', [`tools/${tool}`, ...args, '--quiet'], { encoding: 'utf8' });

test('N2 어휘 1000개 이상, 문법 120개 이상 (수준은 추정)', () => {
  assert.ok(Object.values(VOCAB).filter((v) => v.lv === 'N2').length >= 1000);
  assert.ok(Object.values(GRAMMAR).filter((g) => g.lv === 'N2').length >= 120);
  for (const [k, g] of Object.entries(GRAMMAR)) for (const f of ['use', 'style', 'err', 'ex', 'qx']) assert.ok(g[f], `${k}.${f}`);
});

test('어휘·문법 DB 검사 도구: 오류 0', () => {
  assert.match(run('n2-check.mjs'), /오류 0/);
});

test('문제은행: 9유형, 검사 오류 0, 유형마다 정답 위치가 고르다', () => {
  const out = run('bank-check.mjs');
  assert.match(out, /오류 0/);
  for (const t of Object.keys(BANK_TYPES)) assert.ok(BANK.filter((q) => q.type === t).length >= 40, t);
  for (const t of Object.keys(BANK_TYPES)) {
    const pos = [0, 0, 0, 0];
    BANK.filter((q) => q.type === t).forEach((q) => pos[q.a]++);
    assert.ok(Math.max(...pos) - Math.min(...pos) <= Math.ceil(BANK.filter((q) => q.type === t).length * 0.1), `${t} ${pos}`);
  }
});

test('독해·청해: 형식 (선택지별 해설, 번역, 정답 번호)', () => {
  const H = /[가-힣]/;
  for (const p of READING) {
    assert.ok(!H.test(p.text) && H.test(p.ko), p.id);
    for (const q of p.qs) {
      assert.equal(q.why.length, q.opts.length, p.id);
      assert.ok(q.a >= 0 && q.a < q.opts.length, p.id);
    }
  }
  for (const l of LISTENING) {
    assert.equal(l.ko.length, l.lines.length, l.id);
    assert.equal(l.why.length, l.opts.length, l.id);
    assert.ok(l.a >= 0 && l.a < l.opts.length, l.id);
  }
  assert.ok(READING.length >= 40 && LISTENING.length >= 30);
});
