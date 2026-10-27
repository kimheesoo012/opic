// 한자 수사 + 조수사의 읽기 (형태소 분석기는 토큰마다 따로 읽어 촉음·반탁음·와어 수사를 틀린다)
// 例: 三十八票 → さんじゅうはっぴょう, 十分間 → じゅっぷんかん, 二日 → ふつか, 四人 → よにん, 何百人 → なんびゃくにん
const DIG = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNIT = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
const DR = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];

export function parseNum(s) {
  if (s === '何') return { v: null, nan: true };
  let total = 0;
  let cur = 0;
  let nan = false;
  for (const c of s) {
    if (c === '何') {
      nan = true;
      cur = 1;
    } else if (c in DIG) cur = DIG[c];
    else if (c in UNIT) {
      if (UNIT[c] === 10000) {
        total = (total + (cur || 1)) * 10000;
      } else total += (cur || 1) * UNIT[c];
      cur = 0;
    } else return null;
  }
  return { v: total + cur, nan };
}

// 수 읽기 (何十・何百 포함)
export function numReading(s) {
  const p = parseNum(s);
  if (!p) return null;
  if (s === '何') return 'なん';
  const out = [];
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const nx = chars[i + 1];
    if (c === '何') {
      out.push('なん');
      if (nx === '百') { out.push('びゃく'); i++; } else if (nx === '千') { out.push('ぜん'); i++; }
      continue;
    }
    if (c in DIG) {
      if (nx === '百') {
        out.push({ 1: 'ひゃく', 3: 'さんびゃく', 6: 'ろっぴゃく', 8: 'はっぴゃく' }[DIG[c]] || DR[DIG[c]] + 'ひゃく');
        i++;
      } else if (nx === '千') {
        out.push({ 1: 'せん', 3: 'さんぜん', 8: 'はっせん' }[DIG[c]] || DR[DIG[c]] + 'せん');
        i++;
      } else if (nx === '十') {
        out.push((DIG[c] === 1 ? '' : DR[DIG[c]]) + 'じゅう');
        i++;
      } else out.push(DR[DIG[c]]);
    } else if (c === '十') out.push('じゅう');
    else if (c === '百') out.push('ひゃく');
    else if (c === '千') out.push('せん');
    else if (c === '万') out.push('まん');
  }
  return out.join('');
}

// 조수사: r 기본 읽기, row 첫소리 줄(k/s/t/h), b3 = 3·何 뒤 탁음, p3 = 3·何 뒤 반탁음, p4 = 4 뒤 반탁음, g = 촉음이 되는 끝자리
const C = (r, row, x = {}) => ({ r, row, ...x });
export const COUNTERS = {
  本: C('ほん', 'h', { b3: 1 }), 匹: C('ひき', 'h', { b3: 1 }), 杯: C('はい', 'h', { b3: 1 }), 分: C('ふん', 'h', { p3: 1, p4: 1 }), 泊: C('はく', 'h', { p3: 1, p4: 1 }),
  発: C('はつ', 'h', { p3: 1, p4: 1 }), 票: C('ひょう', 'h', { b3: 1 }), 歩: C('ほ', 'h', { p3: 1 }), 遍: C('へん', 'h', { b3: 1 }),
  回: C('かい', 'k'), 個: C('こ', 'k'), か月: C('かげつ', 'k'), ヶ月: C('かげつ', 'k'), カ月: C('かげつ', 'k'), 階: C('かい', 'k', { g3: 'がい' }), 軒: C('けん', 'k', { g3: 'げん' }),
  画: C('かく', 'k'), 曲: C('きょく', 'k'), 級: C('きゅう', 'k'), 件: C('けん', 'k'), 校: C('こう', 'k'), 箇所: C('かしょ', 'k'), か所: C('かしょ', 'k'),
  冊: C('さつ', 's'), 歳: C('さい', 's'), 才: C('さい', 's'), 足: C('そく', 's', { z3: 'ぞく' }), 週: C('しゅう', 's'), 週間: C('しゅうかん', 's'), 勝: C('しょう', 's'), 寸: C('すん', 's'), 戦: C('せん', 's'),
  通: C('つう', 't'), 頭: C('とう', 't'), 点: C('てん', 't'), 着: C('ちゃく', 't'),
  枚: C('まい'), 台: C('だい'), 度: C('ど'), 番: C('ばん'), 秒: C('びょう'), 部: C('ぶ'), 名: C('めい'), 羽: C('わ'), 位: C('い'), 段: C('だん'), 組: C('くみ'), 列: C('れつ'), 色: C('しょく', 's'),
  円: C('えん', null, { y4: 1 }), 年: C('ねん', null, { y4: 1 }), 時: C('じ', null, { y4: 1, s7: 1, k9: 1 }), 時間: C('じかん', null, { y4: 1, s7: 1, k9: 1 }),
  人: C('にん', null, { y4: 1 }), 日: C('にち'), 日間: C('にちかん'), つ: C(''),
};
export const COUNTER_KEYS = Object.keys(COUNTERS).sort((a, b) => b.length - a.length);
const DAYS = { 1: 'ついたち', 2: 'ふつか', 3: 'みっか', 4: 'よっか', 5: 'いつか', 6: 'むいか', 7: 'なのか', 8: 'ようか', 9: 'ここのか', 10: 'とおか', 14: 'じゅうよっか', 20: 'はつか', 24: 'にじゅうよっか' };
const TSU = { 1: 'ひとつ', 2: 'ふたつ', 3: 'みっつ', 4: 'よっつ', 5: 'いつつ', 6: 'むっつ', 7: 'ななつ', 8: 'やっつ', 9: 'ここのつ', 10: 'とお' };
const H2P = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const H2B = { は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };

// 수(표기) + 조수사 → 읽기. 못 정하면 null.
export function counterReading(numStr, ctr) {
  const c = COUNTERS[ctr];
  const p = parseNum(numStr);
  if (!c || !p) return null;
  const v = p.v;
  if (ctr === 'つ') return !p.nan && TSU[v] ? TSU[v] : p.nan ? 'いくつ' : null;
  if (ctr === '人') {
    if (numStr === '何') return 'なんにん';
    if (v === 1) return 'ひとり';
    if (v === 2) return 'ふたり';
  }
  if (ctr === '日' || ctr === '日間') {
    if (numStr === '何') return 'なんにち' + (ctr === '日間' ? 'かん' : '');
    if (DAYS[v]) return (v === 1 ? (ctr === '日間' ? 'いちにち' : 'いちにち') : DAYS[v]) + (ctr === '日間' ? 'かん' : '');
  }
  let n = numReading(numStr);
  if (n == null) return null;
  let r = c.r;
  const last = p.nan && !/[十百千]$/.test(numStr) ? 'nan' : v % 10 ? String(v % 10) : v % 100 ? '10' : v % 1000 ? '100' : '1000';
  if (c.y4 && last === '4') n = n.replace(/よん$/, 'よ');
  if (c.s7 && last === '7') n = n.replace(/なな$/, 'しち');
  if (c.k9 && last === '9') n = n.replace(/きゅう$/, 'く');
  const gem = (from, to) => (n.endsWith(from) ? ((n = n.slice(0, -from.length) + to), true) : false);
  if (c.row) {
    let g = false;
    if (last === '1') g = gem('いち', 'いっ');
    else if (last === '8') g = gem('はち', 'はっ');
    else if (last === '10') g = gem('じゅう', 'じゅっ');
    else if (last === '6' && (c.row === 'k' || c.row === 'h')) g = gem('ろく', 'ろっ');
    else if (last === '100' && (c.row === 'k' || c.row === 'h')) g = gem('ゃく', 'ゃっ');
    if (g && c.row === 'h') r = H2P[r[0]] + r.slice(1);
    if (!g && c.row === 'h') {
      if ((last === '3' || last === 'nan') && c.b3) r = H2B[r[0]] + r.slice(1);
      if ((last === '3' || last === 'nan') && c.p3) r = H2P[r[0]] + r.slice(1);
      if (last === '4' && c.p4) r = H2P[r[0]] + r.slice(1);
      if (last === '1000' && (c.b3 || c.p3)) r = H2B[r[0]] + r.slice(1);
    }
    if ((last === '3' || last === 'nan') && c.g3) r = c.g3;
    if ((last === '3' || last === 'nan') && c.z3) r = c.z3;
  }
  return n + r;
}

// 자리표시(〓, 例: {Y}年) 뒤의 조수사는 조수사 읽기만
export function counterAfterHole(plain, i) {
  if (plain[i - 1] !== '〓') return null;
  const ctr = COUNTER_KEYS.find((k) => plain.startsWith(k, i));
  if (!ctr || !COUNTERS[ctr].r || ['人', 'つ'].includes(ctr)) return null;
  return { len: ctr.length, r: COUNTERS[ctr].r };
}

// 문장(plain) 속 i 위치에서 수+조수사(+目・間・来)를 읽는다 → { len, r } | null
const NUMCH = /[〇一二三四五六七八九十百千万何]/;
export function numberAt(plain, i) {
  if (!NUMCH.test(plain[i] || '')) return null;
  // 앞이 한자면 낱말의 일부 (統一・唯一 등). 第는 허용
  const prev = plain[i - 1] || '';
  if (/[一-鿿々]/.test(prev) && prev !== '第' && !NUMCH.test(prev)) return null;
  if (NUMCH.test(prev)) return null;
  let j = i;
  while (j < plain.length && NUMCH.test(plain[j])) j++;
  const num = plain.slice(i, j);
  if (num.length > 1 && num.includes('何') && num[0] !== '何') return null;
  const ctr = COUNTER_KEYS.find((k) => plain.startsWith(k, j));
  if (!ctr) {
    // 조수사 없이: 十·百·千이 든 두 글자 이상의 수만 (三十・五十・三百)
    if (num.length < 2 || !/[十百千]/.test(num) || /[一-鿿々]/.test(plain[j] || '')) return null;
    const r = numReading(num);
    return r ? { len: num.length, r } : null;
  }
  // 分: 분수(四分の一 → よんぶんのいち)와 「충분」의 十分(じゅうぶん)
  if (ctr === '分' && plain[j + 1] === 'の' && NUMCH.test(plain[j + 2] || '')) {
    const n = numReading(num);
    return n ? { len: num.length + 1, r: n + 'ぶん' } : null;
  }
  if (num === '十' && ctr === '分' && !plain.startsWith('だけ', j + 1) && !/^[ほもくぐ後前間のおた遅以待経ず]/.test(plain[j + 1] || '')) return null;
  let r = counterReading(num, ctr);
  if (!r) return null;
  let len = num.length + ctr.length;
  // 뒤에 붙는 말
  const nx = plain[i + len] || '';
  if (nx === '目') { r += 'め'; len++; }
  else if (nx === '間' && ['年', '時', '分', '秒', 'か月', 'ヶ月', 'カ月', '週'].includes(ctr)) { r += 'かん'; len++; }
  else if (nx === '来' && ctr === '年') { r += 'らい'; len++; }
  else if (nx === '生' && ctr === '年') { r += 'せい'; len++; }
  else if (nx === '半' && ['時', '時間', '年', 'か月'].includes(ctr)) { r += 'はん'; len++; }
  // 조수사 뒤가 한자로 이어져 다른 낱말이 되는 경우 (一人前 등)는 호출하는 쪽의 사전이 먼저 잡는다
  return { len, r };
}
