/* 설정(음성·속도·받아쓰기·목표 등급·화면) + 시험 구성·등급 체크리스트 안내 */
(function (root) {
  'use strict';
  const { util, bank, drills, recorder, tts, stt, store, ui, xp } = root.OPIC;
  const esc = util.escapeHtml;

  root.OPIC.screens.settings = {
    title: '설정', tab: 'settings',
    render(el) {
      const S = store.S.settings;
      const env = recorder.environment();
      const sttSt = stt.status();
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      el.innerHTML = `
      <section class="card"><h2>목표</h2>
        <label class="lbl">목표 등급</label>
        <div class="seg wide" id="tgt">${['IH', 'AL'].map(l => `<button class="${S.targetLevel === l ? 'on' : ''}" data-v="${l}">${l}</button>`).join('')}</div>
        <p class="muted small">AI 첨삭용 복사 글의 목표 등급으로 들어갑니다.</p>
        <label class="lbl">하루 목표 XP</label>
        <div class="seg wide" id="goal">${xp.GOALS.map(g => `<button class="${(S.dailyGoal || 40) === g.xp ? 'on' : ''}" data-v="${g.xp}">${g.label}<br><small>${g.xp} XP</small></button>`).join('')}</div>
        <p class="muted small">답변 하나에 보통 10~18 XP예요. 「보통」은 하루 2~3문제 정도입니다.</p></section>

      <section class="card"><h2>매일 알림</h2>
        <p class="small">이 앱은 서버가 없어 직접 알림을 보낼 수 없어요. 대신 휴대폰 캘린더에 <b>매일 반복 알림</b>을 넣어 두세요.</p>
        <div class="row"><input type="time" id="remT" value="${esc(S.remindTime || '20:00')}"><button class="btn primary" id="remBtn">캘린더에 매일 알림 추가</button></div>
        <p class="muted small">내려받은 .ics 파일을 열면 아이폰 캘린더·삼성 캘린더·구글 캘린더에 추가할 수 있어요.</p></section>

      <section class="card"><h2>질문 음성</h2>
        <label class="lbl">음성</label><select id="voice" class="full"></select>
        <p class="small" id="vq"></p>
        <label class="lbl">속도</label>
        <div class="seg wide" id="rate">${[0.8, 1.0].map(r => `<button class="${S.rate === r ? 'on' : ''}" data-v="${r}">${r.toFixed(1)}x</button>`).join('')}</div>
        <button class="btn block" id="preview">▶ 미리 듣기</button>
        <p class="note small">기기에 들어 있는 합성 음성이라 실제 시험 성우보다 기계적으로 들릴 수 있어요.</p>
        <details ${isIOS ? 'open' : ''}><summary>아이폰에서 더 자연스러운 음성 받기</summary>
          <ol class="small"><li>설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성</li><li>영어 → 예: Ava, Zoe, Evan 중 <b>향상됨</b> 또는 <b>프리미엄</b> 내려받기</li><li>Safari를 완전히 닫았다가 다시 열면 이 목록 맨 위에 자동으로 선택됩니다.</li></ol>
          <p class="small muted">갤럭시: 설정 → 일반 → 텍스트 음성 변환(TTS)에서 Google 음성 엔진의 영어(미국) 음성 데이터를 설치하세요.</p></details></section>

      <section class="card"><h2>녹음·받아쓰기</h2>
        <p class="small">녹음: ${env.hasGUM && env.hasMR ? `사용 가능 (형식 ${esc(env.mime || '기본')})` : '<span class="warn">사용 불가 — ' + esc(recorder.micError(null).msg) + '</span>'}</p>
        ${isIOS ? '<p class="muted small">아이폰에서 녹음할 때마다 마이크 허용을 묻는다면: Safari 주소창 「aA」 → 웹 사이트 설정 → 마이크 → 허용.</p>' : ''}
        <label class="opt"><input type="checkbox" id="auto" ${S.autoRecord ? 'checked' : ''}> 질문이 끝나면 자동으로 녹음 시작 (연습 화면)</label>
        <label class="opt"><input type="checkbox" id="showT" ${S.showTextPractice ? 'checked' : ''}> 연습에서 문제 글 처음부터 보이기 (기본: 숨김)</label>
        <label class="opt"><input type="checkbox" id="stt" ${S.stt ? 'checked' : ''} ${sttSt.ok ? '' : 'disabled'}> 자동 받아쓰기 사용 (선택 기능)</label>
        <p class="small ${sttSt.ok ? 'muted' : 'warn'}">${sttSt.ok ? '브라우저 음성 인식을 씁니다. Chrome은 인식에 인터넷이 필요하고, 일부 휴대폰은 녹음과 동시에 인식하지 못할 수 있어요. 결과는 실제 말과 다를 수 있으니 복사 전에 고쳐 주세요.' : esc(sttSt.msg)}</p>
        <p class="muted small">받아쓰기를 끄거나 쓸 수 없어도 녹음·재생·길이·무음 분석·자가 체크·복습은 모두 됩니다. 받아쓴 글은 직접 입력하거나 다른 앱(예: 휴대폰 받아쓰기, 녹음 앱 전사)에서 만든 글을 붙여 넣을 수 있어요.</p></section>

      <section class="card"><h2>화면</h2>
        <div class="seg wide" id="theme">${[['dark', '다크'], ['light', '라이트']].map(([v, l]) => `<button class="${S.theme === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></section>

      <section class="card"><h2>앱 설치·오프라인</h2>
        <p class="small">${isIOS ? 'Safari 공유 버튼 → 「홈 화면에 추가」' : 'Chrome 메뉴(⋮) → 「홈 화면에 추가」 또는 「앱 설치」'}로 설치하면 인터넷 없이도 열립니다 (자동 받아쓰기는 인터넷 필요).</p>
        <p class="small muted">${'serviceWorker' in navigator && /^https?:$/.test(location.protocol) ? '오프라인 실행 준비됨' : '이 주소에서는 오프라인 실행을 쓸 수 없습니다 (https 필요).'}</p>
        <a class="btn block" href="#/records?go=backup">기록 백업·가져오기</a>
        <a class="btn block" href="#/guide">시험 구성 · 등급 체크리스트</a></section>
      <p class="muted small center">문제 ${bank.QUESTIONS.length}개 · 버전 1.0 · 서버·계정 없음, 모든 기록은 이 기기에만 저장</p>`;

      const seg = (id, fn) => ui.$$(`#${id} button`, el).forEach(b => b.onclick = async () => { ui.$$(`#${id} button`, el).forEach(x => x.classList.toggle('on', x === b)); await fn(b.dataset.v); });
      seg('tgt', v => store.setSettings({ targetLevel: v }));
      seg('goal', v => store.setSettings({ dailyGoal: +v }));
      ui.$('#remBtn', el).onclick = async () => {
        const t = ui.$('#remT', el).value || '20:00';
        await store.setSettings({ remindTime: t });
        const [h, mi] = t.split(':');
        const d = new Date(); d.setHours(+h, +mi, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1);
        const loc = n => String(n).padStart(2, '0');
        const dt = `${d.getFullYear()}${loc(d.getMonth() + 1)}${loc(d.getDate())}T${loc(d.getHours())}${loc(d.getMinutes())}00`;
        const url = location.href.split('#')[0];
        const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//opic-app//KO', 'BEGIN:VEVENT', `UID:opic-daily-${Date.now()}@opic-app`,
          `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART:${dt}`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
          'SUMMARY:🔥 OPIc 말하기 연습 (오늘 목표)', `DESCRIPTION:오늘의 3문제로 연속 학습 이어 가기\\n${url}`, `URL:${url}`,
          'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:OPIc 말하기 연습', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
        ui.download(new Blob([ics], { type: 'text/calendar' }), 'opic-daily-reminder.ics');
      };
      seg('rate', v => store.setSettings({ rate: +v }));
      seg('theme', async v => { await store.setSettings({ theme: v }); root.OPIC.applyTheme(); });
      ui.$('#auto', el).onchange = e => store.setSettings({ autoRecord: e.target.checked });
      ui.$('#showT', el).onchange = e => store.setSettings({ showTextPractice: e.target.checked });
      ui.$('#stt', el).onchange = e => store.setSettings({ stt: e.target.checked });
      const sel = ui.$('#voice', el), vq = ui.$('#vq', el);
      const fill = vs => {
        if (!vs.length) { sel.innerHTML = '<option>영어 음성을 찾지 못했습니다</option>'; vq.textContent = tts.supported() ? '음성 목록을 불러오는 중이거나 영어 음성이 없습니다.' : '이 브라우저는 음성 합성을 지원하지 않습니다. 문제 글 보기로 연습하세요.'; return; }
        const cur = vs.find(v => v.name === S.voiceName) || vs[0];
        sel.innerHTML = vs.map((v, i) => `<option value="${esc(v.name)}" ${v === cur ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})${i === 0 ? ' · 추천' : ''}${tts.isHighQuality(v) ? ' · 고품질' : ''}</option>`).join('');
        vq.textContent = S.voiceName ? '' : '자동 선택: 기기에서 가장 자연스러운 영어 음성';
      };
      fill(tts.voices());
      tts.onVoices(fill);
      sel.onchange = () => store.setSettings({ voiceName: sel.value });
      ui.$('#preview', el).onclick = () => tts.speak('Tell me about a memorable trip you took. Where did you go, and what happened?', { voiceName: store.S.settings.voiceName, rate: store.S.settings.rate });
    }
  };

  root.OPIC.screens.guide = {
    title: '시험 구성 · 등급', parentTab: 'settings',
    render(el) {
      el.innerHTML = `<section class="card"><h2>OPIc 시험 구성 (연습 앱 반영 내용)</h2>
        <ul class="dots small">
          <li><b>오리엔테이션</b>: Background Survey(직업·학생 여부·거주 형태·여가/취미/운동/여행 12개 이상) → Self Assessment(6단계) → 장비 점검 → 샘플 문제</li>
          <li><b>문항 수</b>: Self Assessment 1·2단계 12문항, 3~6단계 15문항. 본 시험 40분</li>
          <li><b>질문 듣기</b>: 음성으로만 제시. 질문이 끝나고 5초 안에 한 번 더 들을 수 있음(총 2회)</li>
          <li><b>난이도 재조정</b>: 1차 세션이 끝나면 남은 문제를 쉽게/비슷하게/어렵게 선택 (이 앱은 7번 뒤에 묻습니다)</li>
          <li><b>흔한 구성(3~6단계)</b>: 1 자기소개 → 설문 주제 콤보(묘사·습관·과거 경험) → 돌발 주제 콤보 → 설문 주제 콤보 → 11~13 롤플레이(질문하기·문제 해결·관련 경험) → 14~15 비교·사회 이슈. 회차·난이도에 따라 달라집니다</li>
          <li class="muted">공식 시험 화면·캐릭터·로고는 쓰지 않은 연습용 재현입니다. 최신 규정은 OPIc 공식 사이트에서 확인하세요.</li></ul></section>
        <section class="card"><h2>등급 체크리스트 <span class="badge">연습용</span></h2>
        <p class="note small">ACTFL 말하기 지침의 등급 설명을 참고해 만든 <b>연습용 기준</b>입니다. 공식 채점이 아니며, 이 앱은 등급이나 점수를 판정하지 않습니다.</p>
        ${drills.LEVEL_CHECKLIST.map(l => `<h3>${esc(l.level)}</h3><ul class="checks">${l.items.map(i => `<li><label><input type="checkbox"> ${esc(i)}</label></li>`).join('')}</ul>`).join('')}
        <p class="muted small">녹음을 들으며 스스로 체크해 보세요. 체크 결과는 저장되지 않습니다.</p></section>
        <section class="card"><h2>현재 → 목표</h2><p class="small">지금 IM1에서 IH로 가는 핵심은 <b>문장을 이어 문단으로 말하기</b>와 <b>과거 경험을 처음부터 끝까지 이야기하기</b>, 그리고 <b>예상 못 한 질문에도 말을 이어 가기</b>입니다. 「과거 경험 이야기」와 「즉흥 답변」 훈련을 매주 섞어 주세요.</p></section>`;
    }
  };
})(window);
