/* 화면 공통 헬퍼: 토스트, 대화상자, 복사, 내려받기 */
(function (root) {
  'use strict';
  const { util } = root.OPIC;
  const esc = util.escapeHtml;

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.from((el || document).querySelectorAll(sel)); }

  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }

  /* modal({title, html, actions:[{label, value, kind:'primary'|'danger'|''}], onMount(el)}) → Promise(value) */
  function modal(o) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-wrap';
      wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(o.title || '')}">
        ${o.title ? `<h2>${esc(o.title)}</h2>` : ''}
        <div class="modal-body">${o.html || ''}</div>
        <div class="modal-actions">${(o.actions || [{ label: '확인', value: true, kind: 'primary' }]).map((a, i) =>
          `<button class="btn ${a.kind || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
      document.body.appendChild(wrap);
      const acts = o.actions || [{ label: '확인', value: true }];
      const close = v => { wrap.remove(); resolve(v); };
      wrap.addEventListener('click', e => {
        const b = e.target.closest('.modal-actions button');
        if (b) { const a = acts[+b.dataset.i]; close(typeof a.value === 'function' ? a.value(wrap) : a.value); }
        else if (e.target === wrap && o.dismissable !== false) close(null);
      });
      o.onMount && o.onMount(wrap);
      const f = $('.modal-actions .primary', wrap) || $('.modal-actions button', wrap);
      f && f.focus({ preventScroll: true });
    });
  }
  function confirmDlg(msg, okLabel, danger) {
    return modal({ title: '확인', html: `<p>${esc(msg).replace(/\n/g, '<br>')}</p>`, actions: [{ label: '취소', value: false }, { label: okLabel || '확인', value: true, kind: danger ? 'danger' : 'primary' }] });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && root.isSecureContext) { await navigator.clipboard.writeText(text); toast('복사했습니다. 사용하는 AI 채팅 창에 붙여 넣으세요.'); return true; }
    } catch (e) { /* 아래 방법으로 */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (ok) { toast('복사했습니다.'); return true; }
    /* 복사가 막힌 환경: 직접 선택해서 복사하도록 보여 준다 */
    await modal({ title: '직접 복사해 주세요', html: `<p class="muted">이 브라우저가 자동 복사를 막았습니다. 아래 글을 길게 눌러 전체 선택 → 복사하세요.</p><textarea class="copy-area" readonly>${esc(text)}</textarea>`,
      onMount: w => { const t = $('textarea', w); t.focus(); t.select(); } });
    return false;
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  /* 휴대폰에서는 공유 시트(파일 앱에 저장 등)가 편하다 */
  async function shareOrDownload(files) {
    const fs = files.map(f => new File([f.blob], f.name, { type: f.blob.type || 'application/octet-stream' }));
    if (navigator.canShare && navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try { if (navigator.canShare({ files: fs })) { await navigator.share({ files: fs, title: 'OPIc 연습 녹음' }); return 'shared'; } }
      catch (e) { if (e && e.name === 'AbortError') return 'aborted'; }
    }
    for (const f of files) { download(f.blob, f.name); await new Promise(r => setTimeout(r, 400)); }
    return 'downloaded';
  }

  function fileName(rec, ext) {
    const d = new Date(rec.createdAt);
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    const q = (rec.questionId || rec.mode || 'rec').replace(/[^a-z0-9_.-]/gi, '_');
    return `opic_${stamp}_${q}.${ext}`;
  }

  /* 화면 하단 고정 영역(녹음 버튼) */
  function dock(html) {
    const d = $('#dock');
    d.innerHTML = html || '';
    d.hidden = !html;
    document.body.classList.toggle('has-dock', !!html);
    return d;
  }

  root.OPIC.screens = root.OPIC.screens || {};
  root.OPIC.ui = { $, $$, esc, toast, modal, confirmDlg, copyText, download, shareOrDownload, fileName, dock };
})(window);
