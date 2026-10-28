// 밸런스 시험: 능력치가 끝(0/100)에 붙어 버리지 않는지, 견생마다 사건 순서가 충분히 다른지,
// 「一生」 연표가 노년까지 고르게 담는지를 여러 시드로 잰다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/engine/core.js';
import { STAT_KEYS, ROLES } from '../src/engine/world.js';
import { TITLES } from '../src/data/titles.js';
import { hashSeed, rand } from '../src/engine/rng.js';

const LIVES = 200;

// 선택 방식: auto(성격대로), random(아무거나), focus:<능력치>(그 능력치를 가장 올리는 것)
function pickChoice(s, mode, h) {
  const e = G.EV.get(s.cur.id);
  if (mode === 'auto') return G.autoChoice(s);
  const cs = (e.choices || []).map((c, i) => ({ c, i })).filter((x) => G.choiceAvailable(s, x.c));
  if (!cs.length) return -1;
  if (mode.startsWith('focus:')) {
    const k = mode.slice(6);
    const val = (c) => {
      const fx = c.fx && typeof c.fx === 'object' ? c.fx : {};
      const ck = c.check ? ((c.check.ok?.fx?.[k] || 0) + (c.check.ng?.fx?.[k] || 0)) / 2 : 0;
      return (fx[k] || 0) + ck;
    };
    const best = Math.max(...cs.map((x) => val(x.c)));
    const top = cs.filter((x) => val(x.c) === best);
    return top[Math.floor(rand(h) * top.length)].i;
  }
  return cs[Math.floor(rand(h) * cs.length)].i;
}

function play(seed, mode = 'auto', hook = null) {
  const s = G.newLife({ seed });
  const h = { rng: hashSeed('pick|' + seed) };
  const seasons = [];
  let small = 0;
  let smallShown = 0;
  for (let n = 0; s.phase !== 'ended'; n++) {
    assert.ok(n < 20000, seed + ': 끝나지 않음');
    if (hook) hook(s);
    if (s.phase === 'event') {
      const e = G.EV.get(s.cur.id);
      const i = pickChoice(s, mode, h);
      const c = i >= 0 && e.choices ? e.choices[i] : null;
      const before = { ...s.st };
      G.choose(s, i, mode === 'auto');
      if (c && c.fx && typeof c.fx === 'object') {
        for (const [k, v] of Object.entries(c.fx)) {
          if (!STAT_KEYS.includes(k) || !v || Math.abs(v) > 2) continue;
          if ((v > 0 && before[k] >= 100) || (v < 0 && before[k] <= 0)) continue;
          small++;
          if (s.st[k] !== before[k]) smallShown++;
        }
      }
      continue;
    }
    const t0 = s.t;
    G.stepAuto(s);
    if (s.t !== t0) seasons.push({ t: t0, ...s.st });
  }
  return { s, seasons, small, smallShown };
}

const cache = new Map();
function lives(mode, n = LIVES) {
  const key = mode + n;
  if (!cache.has(key)) cache.set(key, Array.from({ length: n }, (_, i) => play('bal-' + i, mode)));
  return cache.get(key);
}

const median = (a) => {
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};

test('효과 크기: 끝에 가까울수록 덜 움직이지만, 끝이 아니면 ±2도 반드시 보인다', () => {
  for (let x = 0; x < 100; x++) {
    assert.ok(G.statDelta(x, 2) >= 1, `x=${x}: +2가 사라짐`);
    assert.ok(G.statDelta(x, 1) === 1, `x=${x}: +1`);
    assert.ok(x + G.statDelta(x, 9) <= 100);
  }
  for (let x = 1; x <= 100; x++) {
    assert.ok(G.statDelta(x, -2) <= -1, `x=${x}: -2가 사라짐`);
    assert.ok(x + G.statDelta(x, -9) >= 0);
  }
  assert.equal(G.statDelta(100, 5), 0);
  assert.equal(G.statDelta(0, -5), 0);
  assert.equal(G.statDelta(50, 5), 5, '가운데에서는 효과 그대로');
  assert.ok(G.statDelta(90, 5) < 5, '끝 가까이에서는 덜');
});

for (const mode of ['auto', 'random']) {
  test(`능력치가 100(0)에 붙지 않는다 (${mode}, ${LIVES}개 견생)`, () => {
    const L = lives(mode);
    for (const k of STAT_KEYS) {
      let n = 0;
      let top = 0;
      let bottom = 0;
      for (const { seasons } of L)
        for (const p of seasons) {
          n++;
          if (p[k] >= 100) top++;
          if (p[k] <= 0) bottom++;
        }
      console.log(`  ${mode} ${k}: 100에 있던 계절 ${((100 * top) / n).toFixed(2)}%, 0에 있던 계절 ${((100 * bottom) / n).toFixed(2)}%`);
      assert.ok(top / n < 0.02, `${k}: 100에 있던 계절 ${((100 * top) / n).toFixed(1)}%`);
      assert.ok(bottom / n < 0.02, `${k}: 0에 있던 계절 ${((100 * bottom) / n).toFixed(1)}%`);
    }
    // 어떤 능력치든 처음 100에 닿는 나이: 가운데 견생이 8살 전에 닿으면 안 된다
    const first = L.map(({ seasons }) => {
      const p = seasons.find((x) => STAT_KEYS.some((k) => x[k] >= 100));
      return p ? p.t / 4 : 99;
    });
    const early = first.filter((a) => a < 8).length / L.length;
    console.log(`  ${mode}: 8살 전에 능력치 하나라도 100에 닿은 견생 ${(100 * early).toFixed(1)}%, 가운데 견생 ${median(first) === 99 ? '닿지 않음' : median(first) + '살'}`);
    assert.ok(median(first) >= 8, `가운데 견생이 ${median(first)}살에 100`);
    assert.ok(early < 0.15, `8살 전에 100에 닿은 견생 ${(100 * early).toFixed(1)}%`);
    // 작은 효과(±2)도 화면의 변화로 보인다
    const small = L.reduce((a, x) => a + x.small, 0);
    const shown = L.reduce((a, x) => a + x.smallShown, 0);
    assert.ok(shown / small > 0.99, `±2 효과가 보인 비율 ${((100 * shown) / small).toFixed(1)}%`);
    // 그래도 견생마다 성격이 갈린다: 늘그막(10살)의 값이 넓게 퍼져 있다
    for (const k of ['soc', 'brave', 'mis']) {
      const v = L.map(({ seasons }) => (seasons.find((p) => p.t === 40) || seasons[seasons.length - 1])[k]).sort((a, b) => a - b);
      const spread = v[Math.floor(v.length * 0.9)] - v[Math.floor(v.length * 0.1)];
      assert.ok(spread >= 10, `${mode} ${k}: 10살 값의 폭 ${spread}`);
    }
  });
}

test('능력치 조건이 있는 칭호·결말이 모두 나올 수 있다', () => {
  const all = [...lives('auto'), ...lives('random')];
  const focus = {};
  for (const k of ['mis', 'brave', 'soc', 'hap']) focus[k] = Array.from({ length: 100 }, (_, i) => play('focus-' + i, 'focus:' + k));
  const pool = [...all, ...Object.values(focus).flat()];
  const rate = (list, id) => list.filter((x) => x.s.summary.titles.some((t) => t.id === id)).length / list.length;
  // 그 능력치를 노리고 키우면 대개 얻는다
  const want = { mis: 'prank', brave: 'guard', soc: 'idol', hap: 'happy' };
  for (const [k, id] of Object.entries(want)) {
    const r = rate(focus[k], id);
    console.log(`  ${k}을(를) 노린 견생의 「${TITLES.find((t) => t.id === id).ja}」: ${(100 * r).toFixed(0)}% (아무거나 고른 견생 ${(100 * rate(lives('random'), id)).toFixed(0)}%, 오토 ${(100 * rate(lives('auto'), id)).toFixed(0)}%)`);
    assert.ok(r >= 0.6, `${k}을(를) 노려도 ${id} ${(100 * r).toFixed(0)}%`);
  }
  // 노리지 않아도 저절로 다 얻지는 않는다 (예전에는 장난꾸러기가 100%였다)
  for (const id of ['prank', 'guard', 'idol']) assert.ok(rate(lives('random'), id) < 0.6, `아무거나 골라도 ${id} ${(100 * rate(lives('random'), id)).toFixed(0)}%`);
  // 모든 칭호가 어딘가에서 나온다
  for (const t of TITLES) assert.ok(rate(pool, t.id) > 0, `칭호 ${t.id}가 한 번도 나오지 않음`);
  // 도장 결말 셋, 식구 후일담은 사람마다 두 가지 이상
  const dojo = new Set(pool.map((x) => x.s.summary.dojoState));
  for (const d of ['saved', 'moved', 'kominkan']) assert.ok(dojo.has(d), '도장 결말 ' + d);
  for (const r of ROLES) {
    const eps = new Set(pool.map((x) => x.s.summary.cast[r].epilogue));
    if (r !== 'kid') assert.ok(eps.size >= 2, `${r} 후일담 ${eps.size}가지`);
  }
});

test('견생마다 사건 순서가 다르다 (고정된 고비와 이어지는 이야기 순서는 지킨다)', () => {
  const L = lives('auto').slice(0, 50);
  const seqs = L.map(({ s }) => s.hist.filter((x) => !x.brief && G.EV.get(x.id).cat !== 'hub').slice(0, 20).map((x) => x.id));
  let same = 0;
  let pairs = 0;
  for (let i = 0; i < seqs.length; i++)
    for (let j = i + 1; j < seqs.length; j++) {
      for (let k = 0; k < 20; k++) if (seqs[i][k] && seqs[i][k] === seqs[j][k]) same++;
      pairs++;
    }
  console.log(`  처음 20개 사건 중 두 견생이 같은 자리에 같은 사건: 평균 ${(same / pairs).toFixed(2)}개 (예전 3.95)`);
  assert.ok(same / pairs < 3, `같은 자리 ${(same / pairs).toFixed(2)}개`);
  // 첫째 사건별 빈도: 맨 앞(도장에 온 날) 다음 자리가 늘 같은 사건이면 안 된다
  const second = {};
  for (const q of seqs) second[q[1]] = (second[q[1]] || 0) + 1;
  assert.ok(Math.max(...Object.values(second)) <= seqs.length * 0.4, '두 번째 사건이 거의 늘 같음: ' + JSON.stringify(second));
  for (const { s } of lives('auto')) {
    const hs = s.hist.filter((x) => !x.brief);
    assert.equal(hs[0].id, 'a_arrive', '첫 장면은 도장에 온 날');
    for (const [t, id] of Object.entries(G.MILESTONE_T)) {
      const h = s.hist.find((x) => x.id === id);
      assert.ok(h && h.t === +t, `${s.seed}: ${id}는 ${t}계절에 (실제 ${h && h.t})`);
      assert.equal(hs.find((x) => x.t === +t)?.id, id, `${s.seed}: ${id}는 그 계절의 첫 장면`);
    }
    // 같은 사람의 장은 번호 순서대로
    for (const r of ROLES) {
      const chs = s.hist.map((x) => G.EV.get(x.id)).filter((e) => e && e.cat === 'cast' && e.who === r && typeof e.ch === 'number').map((e) => e.ch);
      for (let i = 1; i < chs.length; i++) assert.ok(chs[i] > chs[i - 1], `${s.seed} ${r}: 장 순서 ${chs.join(',')}`);
      // 장이 열리는 나이는 원래 나이에서 한 계절 앞 ~ 두 계절 뒤 안에서 (밀려서 늦어지는 것은 예전과 같다)
      for (const x of s.hist) {
        const e = G.EV.get(x.id);
        if (e && e.cat === 'cast' && e.who === r && typeof e.ch === 'number') assert.ok(x.t / 4 >= e.at - 0.25, `${s.seed} ${x.id}: ${x.t / 4}살 < ${e.at}`);
      }
    }
    // 서브스토리는 1편 → 2편 → 3편
    const subs = {};
    for (const x of hs) {
      const e = G.EV.get(x.id);
      if (e.sub) (subs[e.sub] ||= []).push(x.id);
    }
    for (const [sub, ids] of Object.entries(subs)) assert.equal(ids[0], sub, `${s.seed}: ${sub} 순서 ${ids.join(',')}`);
  }
});

test('「一生」 연표는 어른·노년의 큰 일까지 고르게 담는다', () => {
  const L = lives('auto');
  let senior = 0;
  const lastAge = [];
  for (const { s } of L) {
    const tl = G.lifeTimeline(s);
    assert.ok(tl.length >= 8 && tl.length <= 14, `${s.seed}: 연표 ${tl.length}줄`);
    assert.equal(tl[0].id, 'a_arrive');
    assert.ok(tl.some((x) => x.id === 'm_last'), '마지막 해');
    for (let i = 1; i < tl.length; i++) assert.ok(tl[i].t >= tl[i - 1].t, '시간 순서');
    assert.deepEqual(s.summary.timeline.map((x) => x.id), tl.map((x) => x.id));
    const story = (x) => G.EV.get(x.id).cat !== 'milestone';
    const adult = tl.filter((x) => story(x) && x.t >= 12 && x.t < 40).length;
    const late = tl.filter((x) => story(x) && x.t >= 24).length;
    assert.ok(adult >= 4, `${s.seed}: 3~9살 일이 ${adult}줄`);
    assert.ok(late >= 4, `${s.seed}: 6살 이후 일이 ${late}줄`);
    if (tl.some((x) => story(x) && x.t >= 40)) senior++;
    lastAge.push(tl.filter(story).pop().t / 4);
    // 한 서브스토리는 한 줄
    const subs = tl.map((x) => G.EV.get(x.id).sub).filter(Boolean);
    assert.equal(new Set(subs).size, subs.length, '서브스토리 중복');
  }
  console.log(`  연표에 10살 이후의 일이 있는 견생 ${((100 * senior) / L.length).toFixed(0)}%, 마지막 줄 나이 가운데값 ${median(lastAge)}살`);
  assert.ok(senior / L.length >= 0.9, `노년의 일이 있는 견생 ${((100 * senior) / L.length).toFixed(0)}%`);
});

test('예전 저장 데이터(타고난 값 없음)도 그대로 이어서 끝난다', () => {
  for (let i = 0; i < 20; i++) {
    let dropped = false;
    const { s } = play('old-save-' + i, 'auto', (st) => {
      if (!dropped && st.t === 20 && st.phase === 'season') {
        delete st.base;
        delete st.stf;
        dropped = true;
      }
    });
    assert.equal(s.phase, 'ended');
    assert.ok(s.base && STAT_KEYS.every((k) => Number.isInteger(s.st[k]) && s.st[k] >= 0 && s.st[k] <= 100));
  }
});
