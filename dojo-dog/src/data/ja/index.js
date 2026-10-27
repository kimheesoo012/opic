// 이벤트의 일본어(서술·제목·선택지·결과·근황). 원래의 한국어 데이터와 같은 모양으로, 이벤트 id로 짝을 짓는다.
// 한국어는 그대로 남아 「번역」으로 쓰인다. 일본어 문장 수는 한국어와 같게 맞춘다(문장 단위 번역).
export const JA = {};
export function addJa(obj) {
  for (const [id, v] of Object.entries(obj)) {
    if (JA[id]) throw new Error('일본어 데이터 중복: ' + id);
    JA[id] = v;
  }
}

// 일본어를 원래 필드 옆에 붙인다: title → titleJa, text → textJa, choices[i].t → tJa, res → resJa, news → newsJa …
// 조건부 문장 배열([{if, v}])은 같은 길이의 일본어 배열과 짝지어 [{if, v: 일본어}]로 만든다.
export function attachJa(target, ja) {
  if (!target || !ja) return;
  for (const [k, v] of Object.entries(ja)) {
    const cur = target[k];
    if (cur === undefined) throw new Error('일본어만 있는 필드: ' + k);
    if (k === 'choices') v.forEach((c, i) => attachJa(cur[i], c));
    else if (k === 'news' || k === 'ach' || k === 'presets') target[k + 'Ja'] = v;
    else if (typeof v === 'string') target[k + 'Ja'] = v;
    else if (Array.isArray(v) && Array.isArray(cur)) target[k + 'Ja'] = cur.map((x, i) => (typeof x === 'string' ? v[i] : { ...x, v: v[i] }));
    else if (typeof v === 'object') attachJa(cur, v);
  }
}
