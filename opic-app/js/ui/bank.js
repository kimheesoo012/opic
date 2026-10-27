/* 문제은행 둘러보기: 분류·주제·유형 필터, 복습 지정 */
(function (root) {
  'use strict';
  const { util, bank, store, ui } = root.OPIC;
  const esc = util.escapeHtml;

  root.OPIC.screens.bank = {
    title: '문제은행', parentTab: 'practice',
    render(el, params, query) {
      const f = { cat: query.cat || '', topic: query.topic || '', type: query.type || '', s: query.s || '', review: query.review || '' };
      const list = bank.QUESTIONS.filter(q => (!f.cat || q.cat === f.cat) && (!f.topic || q.topic === f.topic) && (!f.type || q.type === f.type)
        && (!f.s || q.text.toLowerCase().includes(f.s.toLowerCase())) && (!f.review || (store.S.qs[q.id] && store.S.qs[q.id].review)));
      const typeCount = {};
      bank.QUESTIONS.forEach(q => { typeCount[q.type] = (typeCount[q.type] || 0) + 1; });
      const topics = bank.TOPICS.filter(t => !f.cat || t.cat === f.cat);
      el.innerHTML = `<section class="card filters">
        <select id="fCat"><option value="">전체 분류</option>${Object.keys(bank.CAT_LABELS).map(c => `<option value="${c}" ${f.cat === c ? 'selected' : ''}>${bank.CAT_LABELS[c]}</option>`).join('')}</select>
        <select id="fTopic"><option value="">전체 주제</option>${topics.map(t => `<option value="${t.id}" ${f.topic === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
        <select id="fType"><option value="">전체 유형</option>${Object.keys(bank.TYPE_LABELS).map(t => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${bank.TYPE_LABELS[t]} (${typeCount[t] || 0})</option>`).join('')}</select>
        <label class="opt"><input type="checkbox" id="fRev" ${f.review ? 'checked' : ''}> 복습 지정만</label>
        <input id="fS" placeholder="영어로 검색" value="${esc(f.s)}">
        <p class="muted small">${list.length}문항 / 전체 ${bank.QUESTIONS.length}문항 · ★ 복습 지정한 문제는 모의고사·연습에 다시 출제됩니다.</p></section>
        <ul class="qlist bankl">${list.slice(0, 200).map(q => { const s = store.S.qs[q.id]; const n = store.recsFor(q.id).length; return `<li>
          <a href="#/q/${encodeURIComponent(q.id)}"><span class="chips"><span class="chip type">${esc(bank.TYPE_LABELS[q.type])}</span><span class="chip">${esc(bank.topicById[q.topic].label)}</span>${q.level === 3 ? '<span class="chip warn">고난도</span>' : ''}${n ? `<span class="chip">녹음 ${n}</span>` : ''}</span>
          <span class="qprev" lang="en">${esc(q.text)}</span></a><button class="star ${s && s.review ? 'on' : ''}" data-q="${esc(q.id)}" aria-label="복습 지정">★</button></li>`; }).join('')}</ul>`;
      const apply = () => {
        const p = { cat: ui.$('#fCat', el).value, topic: ui.$('#fTopic', el).value, type: ui.$('#fType', el).value, s: ui.$('#fS', el).value.trim(), review: ui.$('#fRev', el).checked ? '1' : '' };
        if (p.cat && p.topic && bank.topicById[p.topic].cat !== p.cat) p.topic = '';
        const qs = Object.keys(p).filter(k => p[k]).map(k => k + '=' + encodeURIComponent(p[k])).join('&');
        history.replaceState(null, '', '#/bank' + (qs ? '?' + qs : ''));
        root.OPIC.refresh();
      };
      ['#fCat', '#fTopic', '#fType', '#fRev'].forEach(s => { ui.$(s, el).onchange = apply; });
      let t = null; ui.$('#fS', el).oninput = () => { clearTimeout(t); t = setTimeout(apply, 600); };
      ui.$$('.star', el).forEach(b => b.onclick = async () => {
        const s = store.q(b.dataset.q); s.review = !s.review; await store.saveQ(s); b.classList.toggle('on', s.review);
      });
    }
  };
})(window);
