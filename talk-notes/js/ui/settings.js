/* 설정: 화면·음성·학습량·백업 */
import { S, setSetting, exportJSON, parseBackup, applyBackup, resetAll, rec, DEFAULT_SETTINGS } from '../core/store.js';
import { tts, stt, recorder } from '../core/speech.js';
import { CARDS, PHRASES, PRON_ROWS, PAIRS, PATTERNS } from '../core/deck.js';
import { LESSONS } from '../data/notes.js';
import { $, $$, esc, toast, confirmSheet, applyTheme, speak } from './ui.js';
import { FREEZE_MAX, FREEZE_EVERY } from '../core/game.js';

function sw(k, label, sub) {
  return `<label class="set"><div class="lb"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div><span class="switch"><input type="checkbox" data-k="${k}" ${S.settings[k] ? 'checked' : ''}><span></span></span></label>`;
}
function seg(k, label, opts, sub) {
  return `<div class="set"><div class="lb"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div><div class="seg" data-seg="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(S.settings[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
}
function sel(k, label, opts, sub) {
  return `<div class="set"><div class="lb"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div><select data-sel="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(S.settings[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
}

export default {
  title: '설정', tab: 'settings',
  render(view, params, query) {
    const sttMsg = stt.status();
    view.innerHTML = `
      <div class="panel"><h2>화면</h2>
        ${seg('theme', '테마', [['system', '기기'], ['light', '밝게'], ['dark', '어둡게']])}
        ${sw('hideKr', '노트에서 해석 가리기', '수업별 문장의 한국어 해석')}
        ${sw('sound', '맞음·틀림 효과음')}
      </div>
      <div class="panel"><h2>음성</h2>
        <div class="set"><div class="lb"><b>읽어 주는 목소리</b><span id="vinfo"></span></div><select data-sel="voice" id="voice"><option value="">자동 (가장 좋은 음성)</option></select></div>
        ${seg('rate', '읽기 속도', [[0.75, '0.75'], [0.9, '0.9'], [1, '1.0'], [1.1, '1.1']])}
        <div class="set"><div class="lb"><b>목소리 들어 보기</b></div><button class="btn sm" id="vtest">🔊 Let me think for a second.</button></div>
        ${sw('stt', '음성 인식으로 채점', sttMsg.ok ? '말한 문장을 글자로 바꿔 수정문과 비교해요 (Chrome은 인터넷 필요)' : esc(sttMsg.msg))}
        ${sw('record', '내 목소리 녹음', recorder.supported() ? '답할 때 녹음해서 정답 소리와 비교해 들어요. 일부 안드로이드 폰은 녹음과 음성 인식을 같이 못 해요.' : '이 브라우저는 녹음을 지원하지 않아요')}
        ${sw('autoplay', '정답을 펼치면 읽어 주기')}
      </div>
      <div class="panel"><h2>학습량</h2>
        ${sel('newPerDay', '하루 새 문장', [[5, '5개'], [10, '10개'], [15, '15개'], [20, '20개'], [30, '30개'], [50, '50개']])}
        ${sel('sessionSize', '한 번에 푸는 문제', [[10, '10문제'], [15, '15문제'], [20, '20문제'], [30, '30문제'], [40, '40문제']])}
        ${sel('goal', '하루 목표', [[10, '10문제'], [20, '20문제'], [30, '30문제'], [50, '50문제'], [80, '80문제']])}
        ${sel('newOrder', '새 문장 순서', [['recent', '최근 수업부터'], ['first', '첫 수업부터'], ['weak', '약한 실수 유형부터'], ['random', '무작위']])}
      </div>
      <div class="panel"><h2>매일 하게 만들기</h2>
        <div class="set"><div class="lb"><b>매일 알림</b><span>휴대폰 캘린더에 매일 반복 일정을 넣어요(앱은 알림을 직접 보낼 수 없어요). 시간을 고르고 받은 파일을 열어 추가하세요.</span></div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><input type="time" id="remind-t" value="${esc(S.settings.remindAt || '21:00')}" style="height:40px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;padding:0 8px"><button class="btn sm" id="remind">📅 캘린더에 넣기</button></div></div>
        <div class="set"><div class="lb"><b>휴식권 🧊 ${S.freezes || 0}/${FREEZE_MAX}</b><span>${FREEZE_EVERY}일 연속마다 1장. 하루 빼먹으면 자동으로 써서 연속을 지켜요.</span></div></div>
      </div>
      <div class="panel" id="backup"><h2>백업</h2>
        <p class="small muted" style="margin:0 0 10px">기록은 이 기기 브라우저에만 있어요. 아이폰 Safari는 오래 안 쓴 사이트 기록을 지울 수 있으니 가끔 내보내 두세요. 다른 기기로 옮길 때도 써요. (녹음은 포함되지 않아요)</p>
        <div class="grid2"><button class="btn" id="exp">⤓ 내보내기</button><label class="btn" for="imp">⤒ 가져오기</label></div>
        <input type="file" id="imp" accept="application/json,.json" hidden>
        <p class="tiny muted" style="margin:8px 0 0">${S.lastBackup ? '마지막 백업: ' + new Date(S.lastBackup).toLocaleString('ko-KR') : '아직 백업하지 않았어요'}</p>
      </div>
      <div class="panel"><h2>초기화</h2>
        <div class="grid2"><button class="btn danger" id="rs">학습 기록 지우기</button><button class="btn danger" id="rr">녹음 지우기</button></div>
        <p class="tiny muted" style="margin:8px 0 0">별표·메모·진도가 모두 지워져요. 설정은 남아요.</p>
      </div>
      <div class="panel"><h2>이 앱</h2>
        <p class="small" style="margin:0">원본 「영어 회화 교정 노트」의 수업 ${LESSONS.length}회 · 문장 ${CARDS.length}개, 실수 패턴 예문 ${PATTERNS.length}개, 발음 단어 ${PRON_ROWS.length}개(소리 구분 짝 ${PAIRS.length}개), 바로 쓸 표현 ${PHRASES.length}개를 모두 담았어요.</p>
        <p class="tiny muted" style="margin:8px 0 0">서버·계정 없이 기기 안에서만 동작해요. 음성 인식은 브라우저 기능이라 Chrome에서는 음성이 Google 서버로 전송돼요. 자동 채점은 참고용이고, 원어민 검수를 대신하지 않아요.</p>
      </div>`;

    // 목소리 목록
    const vs = $('#voice', view);
    const fill = list => {
      vs.innerHTML = '<option value="">자동 (가장 좋은 음성)</option>' + list.map(v => `<option value="${esc(v.name)}" ${v.name === S.settings.voice ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})${tts.isGood(v) ? ' ★' : ''}</option>`).join('');
      const best = list[0];
      $('#vinfo', view).textContent = !tts.supported() ? '이 브라우저는 읽어 주기를 지원하지 않아요' : best ? (tts.isGood(best) ? '★ 고품질 음성' : '아이폰: 설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성에서 영어 「향상된」 음성을 받으면 더 자연스러워요') : '영어 음성을 찾는 중…';
    };
    const offV = tts.onVoices(fill); fill(tts.voices());
    $('#vtest', view).onclick = e => speak('Let me think for a second.', e.currentTarget);

    view.addEventListener('change', e => {
      const c = e.target.closest('[data-k]');
      if (c) { setSetting(c.dataset.k, c.checked); if (c.dataset.k === 'record' && c.checked && recorder.supported()) navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => toast('마이크 권한이 필요해요')); return; }
      const s = e.target.closest('[data-sel]');
      if (s) { const v = s.value; setSetting(s.dataset.sel, typeof DEFAULT_SETTINGS[s.dataset.sel] === 'number' ? +v : v); toast('저장했어요', 900); }
    });
    view.addEventListener('click', e => {
      const b = e.target.closest('[data-seg] button');
      if (!b) return;
      const g = b.parentElement, k = g.dataset.seg;
      $$('button', g).forEach(x => x.classList.toggle('on', x === b));
      setSetting(k, typeof DEFAULT_SETTINGS[k] === 'number' ? +b.dataset.v : b.dataset.v);
      if (k === 'theme') applyTheme();
      if (k === 'rate') speak('That works for me.');
    });

    $('#remind', view).onclick = () => {
      const t = $('#remind-t', view).value || '21:00';
      setSetting('remindAt', t);
      const [hh, mm] = t.split(':').map(Number);
      const d = new Date(); d.setHours(hh, mm, 0, 0); if (d < Date.now()) d.setDate(d.getDate() + 1);
      const pad = n => String(n).padStart(2, '0');
      const local = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//talk-notes//KO', 'BEGIN:VEVENT', `UID:talk-notes-daily-${Date.now()}@local`, `DTSTAMP:${stamp}`,
        `DTSTART:${local}`, `DTEND:${local.slice(0, 9)}${pad(hh)}${pad(Math.min(59, mm + 10))}00`, 'RRULE:FREQ=DAILY', 'SUMMARY:회화 교정 노트 5문제', `DESCRIPTION:${location.origin}${location.pathname}`,
        `URL:${location.origin}${location.pathname}`, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:회화 교정 노트', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.download = 'talk-notes-daily.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('캘린더 파일을 받았어요. 열어서 추가하면 매일 ' + t + '에 알려 줘요.', 3500);
    };
    $('#exp', view).onclick = () => {
      const blob = new Blob([exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `talk-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('백업 파일을 저장했어요');
    };
    $('#imp', view).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = parseBackup(await f.text());
        e.target.value = '';
        if (!await confirmSheet('백업 가져오기', `지금 이 기기의 기록을 백업 파일 내용(문제 기록 ${Object.keys(data.srs).length}개)으로 바꿔요. 계속할까요?`, '가져오기')) return;
        const n = applyBackup(data);
        applyTheme();
        toast(`기록 ${n}개를 가져왔어요`);
        window.TN.refresh();
      } catch (err) { toast(err.message || '가져오지 못했어요', 3500); }
      e.target.value = '';
    };
    $('#rs', view).onclick = async () => {
      if (!await confirmSheet('학습 기록 지우기', '진도·별표·메모·통계가 모두 지워지고 되돌릴 수 없어요. 먼저 백업을 권해요.', '모두 지우기', true)) return;
      resetAll(); toast('기록을 지웠어요'); window.TN.refresh();
    };
    $('#rr', view).onclick = async () => {
      if (!await confirmSheet('녹음 지우기', '저장된 내 목소리 녹음을 모두 지워요.', '지우기', true)) return;
      try { await rec.clear(); toast('녹음을 지웠어요'); } catch (e) { toast('지우지 못했어요'); }
    };
    if (query.backup) setTimeout(() => $('#backup', view).scrollIntoView({ block: 'center' }), 50);
    return () => offV();
  }
};
