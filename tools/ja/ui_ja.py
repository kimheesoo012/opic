# toeic-ja/ 코드 생성: toeic/의 코드·화면을 복사한 뒤 (원문, 번역) 쌍을 파일별로 정확히 치환한다.
# 원문이 없거나 화면 문구에 한글이 남으면 실패. 문제 데이터는 merge.py가 만든다.
import re
import shutil
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / 'toeic'
ROOT = Path(__file__).resolve().parents[2] / 'toeic-ja'

T = {}

T['index.html'] = [
    ('lang="ko"', 'lang="ja"'),
    ('<title>토익 RC 트레이너</title>', '<title>TOEIC RCトレーナー</title>'),
    ('TOEIC RC Part 5·6·7 고득점 훈련. 진단, 맞춤 추천, 단계별 오답 복습, 속도 훈련, 실전 모의고사.', 'TOEIC RC Part 5・6・7 スコアアップ練習。診断、おすすめ学習、ステップ復習、スピード練習、本番模試。'),
    ('content="토익RC"', 'content="TOEIC RC"'),
    ('<h1>토익 RC 트레이너</h1><p class="muted">불러오는 중…</p>', '<h1>TOEIC RCトレーナー</h1><p class="muted">読み込み中…</p>'),
    ('이 앱은 JavaScript가 필요합니다.', 'このアプリにはJavaScriptが必要です。'),
]

T['manifest.webmanifest'] = [
    ('"name": "토익 RC 트레이너"', '"name": "TOEIC RCトレーナー"'),
    ('"short_name": "토익RC"', '"short_name": "TOEIC RC"'),
    ('"description": "TOEIC RC Part 5·6·7 고득점 훈련"', '"description": "TOEIC RC Part 5・6・7 スコアアップ練習"'),
    ('"lang": "ko"', '"lang": "ja"'),
]

T['css/app.css'] = [
    ("'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic'", "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', Meiryo"),
]

T['js/bank.js'] = [
    ("{ 1: '기본', 2: '중급', 3: '고급' }", "{ 1: '基礎', 2: '中級', 3: '上級' }"),
]

T['js/util.js'] = [
    ('return `${m}분`;', 'return `${m}分`;'),
    ('`${Math.floor(m / 60)}시간 ${m % 60}분`', '`${Math.floor(m / 60)}時間${m % 60}分`'),
    ("{ 5: '단문 빈칸', 6: '장문 빈칸', 7: '독해' }", "{ 5: '短文穴埋め', 6: '長文穴埋め', 7: '読解' }"),
    ('export const TARGETS = [800, 850, 900, 950, 990];', 'export const TARGETS = [700, 730, 800, 860, 900];'),
]

T['js/selection.js'] = [
    ('''const GOAL_DIFF = {
  800: [0.35, 0.4, 0.25],
  850: [0.28, 0.4, 0.32],
  900: [0.2, 0.4, 0.4],
  950: [0.14, 0.36, 0.5],
  990: [0.1, 0.32, 0.58],
};''', '''const GOAL_DIFF = {
  700: [0.55, 0.35, 0.1],
  730: [0.5, 0.38, 0.12],
  800: [0.35, 0.4, 0.25],
  860: [0.25, 0.4, 0.35],
  900: [0.2, 0.4, 0.4],
};'''),
    ('return GOAL_DIFF[goal] || GOAL_DIFF[850];', 'return GOAL_DIFF[goal] || GOAL_DIFF[730];'),
]

T['js/stats.js'] = [
    ("label: '모르는 어휘'", "label: '知らない単語'"),
    ("label: '문법'", "label: '文法'"),
    ("label: '근거 못 찾음'", "label: '根拠が見つからない'"),
    ("label: '시간 부족'", "label: '時間不足'"),
    ("label: '실수'", "label: 'ケアレスミス'"),
    ("label: '함정'", "label: 'ひっかけ'"),
]

T['js/store.js'] = [
    ("export const APP_ID = 'toeic-trainer';", "export const APP_ID = 'toeic-trainer-ja';"),
    ("idbAdapter(name = 'toeic-trainer')", "idbAdapter(name = 'toeic-trainer-ja')"),
    ("const P = 'tt:';", "const P = 'ttja:';"),
    ("goal: 800, rcScore: 360, lcBase: 395", "goal: 730, rcScore: 300, lcBase: 350"),
    ("['JSON 객체가 아닙니다.']", "['JSONオブジェクトではありません。']"),
    ("'이 앱에서 내보낸 파일이 아닙니다.'", "'このアプリから書き出したファイルではありません。'"),
    ("'버전 정보가 없습니다.'", "'バージョン情報がありません。'"),
    ('`더 새로운 버전(${obj.schema})의 파일입니다. 앱을 업데이트하세요.`', '`新しいバージョン${obj.schema}のファイルです。アプリを更新すると読み込めます。`'),
    ("'data 항목이 없습니다.'", "'data項目がありません。'"),
    ("'attempts가 배열이 아닙니다.'", "'attemptsが配列ではありません。'"),
    ('`attempts[${bad}] 형식 오류`', '`attempts[${bad}] 形式エラー`'),
    ('`${k} 형식 오류`', '`${k} 形式エラー`'),
    ("'목표 점수 형식 오류'", "'目標スコア形式エラー'"),
]

T['js/review.js'] = [
    ("label: '핵심 개념'", "label: '要点'"),
    ("label: '쉬운 문제'", "label: 'やさしい問題'"),
    ("label: '어려운 문제'", "label: '難しい問題'"),
    ("label: '제한 시간'", "label: '制限時間'"),
    ("label: '1일 뒤 확인'", "label: '1日後の確認'"),
    ("label: '3일 뒤 확인'", "label: '3日後の確認'"),
    ("label: '7일 뒤 확인'", "label: '7日後の確認'"),
    ("label: '유지 확인'", "label: '定着確認'"),
]

T['js/scoring.js'] = [
    ("""  if (rc < 300) return 'RC 300 도전 단계';
  if (rc < 350) return 'RC 350 도전 단계';
  if (rc < 400) return 'RC 400 도전 단계';
  if (rc < 450) return 'RC 450 도전 단계';
  return 'RC 만점 도전 단계';""", """  if (rc < 250) return 'RC 250を目指す段階';
  if (rc < 300) return 'RC 300を目指す段階';
  if (rc < 350) return 'RC 350を目指す段階';
  if (rc < 400) return 'RC 400を目指す段階';
  if (rc < 450) return 'RC 450を目指す段階';
  return 'RC満点を目指す段階';"""),
]

T['js/sessions.js'] = [
    ("{ diag: '간단 진단', deep: '심화 진단', mock: '하프 모의고사', full: 'RC 실전 모의고사' }", "{ diag: 'クイック診断', deep: '詳細診断', mock: 'ハーフ模試', full: 'RC本番模試' }"),
    ('`${bank.conceptById.get(params.concept)?.name || params.concept} 집중`', '`${bank.conceptById.get(params.concept)?.name || params.concept} 集中練習`'),
    (": '맞춤 연습');", ": 'おすすめ練習');"),
    ("title = 'Part 5 연속 풀이';", "title = 'Part 5 連続解答';"),
    ("title = 'Part 7 지문별 시간 훈련';", "title = 'Part 7 文書別タイム練習';"),
    ("title = '시간 초과 문제 다시 풀기';", "title = '時間オーバー問題の解き直し';"),
    ("title = '오답 다시 풀기';", "title = '間違えた問題の解き直し';"),
    ("title = '단계별 복습';", "title = 'ステップ復習';"),
]

T['js/recommend.js'] = [
    ('const goal = profile.goal || 800;', 'const goal = profile.goal || 730;'),
    ('profile.lcBase ?? 395', 'profile.lcBase ?? 350'),
    ("kind: 'diag', title: '간단 진단'", "kind: 'diag', title: 'クイック診断'"),
    ('`기록이 ${totalN}문항뿐이라 약점 파트를 판단하기 어려움. 세 파트를 고르게 진단.`', '`記録が${totalN}問だけで、苦手パートはまだ判断できない。3パートをバランスよく診断。`'),
    ("'기록이 없어 약점 파트를 알 수 없음. 세 파트를 고르게 진단.'", "'記録がなく、苦手パートはまだ分からない。3パートをバランスよく診断。'"),
    ('`단계별 복습 ${due.length}개 유형`', '`ステップ復習 ${due.length}タイプ`'),
    ("`틀렸던 ${names}${due.length > 2 ? ' 등' : ''}을 복습할 시기. 새 문제로 다시 확인.`", "`間違えた${names}${due.length > 2 ? 'など' : ''}の復習時期。新しい問題で確認。`"),
    ('`Part ${p} ${PART_NAMES[p]} 기본 연습`', '`Part ${p} ${PART_NAMES[p]} 基本練習`'),
    ('`Part ${p} 기록이 ${ps[p].n}문항뿐이라 실력을 판단하기 어려움. 먼저 기록을 모음.`', '`Part ${p}の記録が${ps[p].n}問だけで、実力はまだ判断できない。まず記録を集める。`'),
    ('`${conceptName(bank, concept)} 정답률 ${pct(s.acc)}%, ${s.n}문항.`', '`${conceptName(bank, concept)} 正答率${pct(s.acc)}%、${s.n}問。`'),
    ('` 평균 ${Math.round(s.avgSec)}초로 목표 ${s.target}초보다 느림.`', '`平均${Math.round(s.avgSec)}秒で、目標${s.target}秒より遅い。`'),
    ('` 최근 ${pct(s.recentAcc)}%로 하락.`', '`最近は${pct(s.recentAcc)}%に下がっている。`'),
    ('` RC ${gg.want}점에 필요한 약 ${pct(need)}%보다 낮음.`', '`RC ${gg.want}点に必要な約${pct(need)}%より低い。`'),
    ('title: `${conceptName(bank, concept)} 집중`', 'title: `${conceptName(bank, concept)} 集中練習`'),
    ("title: 'Part 5 연속 풀이'", "title: 'Part 5 連続解答'"),
    ('`Part 5 정답률 ${pct(p5.acc)}%로 정확하지만 문항당 평균 ${Math.round(p5.avgSec)}초. 목표 20초에 맞추는 속도 훈련.`', '`Part 5は正答率${pct(p5.acc)}%と正確だが、1問平均${Math.round(p5.avgSec)}秒。目標20秒に合わせるスピード練習。`'),
    ("title: 'Part 7 패러프레이즈 훈련'", "title: 'Part 7 言い換え練習'"),
    ('`Part 7 시간은 충분하지만 정답률 ${pct(p7.acc)}%. 지문 표현과 정답 표현의 바꿔 말하기 훈련.`', '`Part 7は時間に余裕があるが正答率${pct(p7.acc)}%。本文の表現と正解の表現の言い換え練習。`'),
    ("title: 'Part 7 지문별 시간 훈련'", "title: 'Part 7 文書別タイム練習'"),
    ('`Part 7 정답률 ${pct(p7.acc)}%, 목표 시간의 ${pct(p7.medRatio)}%를 씀. 지문마다 정한 시간 안에 근거 찾기.`', '`Part 7は正答率${pct(p7.acc)}%、目標時間の${pct(p7.medRatio)}%を使っている。文書ごとの制限時間内に根拠を探す。`'),
    ('`시간 초과 문제 ${Math.min(over.length, 10)}개`', '`時間オーバー問題 ${Math.min(over.length, 10)}問`'),
    ('`목표 시간을 넘긴 문제 ${over.length}개. 제한 시간 안에 다시 풀기.`', '`目標時間を超えた問題が${over.length}問。制限時間内に解き直す。`'),
    ('`단어장 복습 ${Math.min(dueWords || words.length, 15)}개`', '`単語帳の復習 ${Math.min(dueWords || words.length, 15)}語`'),
    ('`오답 원인 중 모르는 어휘 ${causes.vocab}건. 문제에서 저장한 단어 복습.`', '`ミスの原因のうち「知らない単語」が${causes.vocab}件。問題から保存した単語を復習。`'),
    ('`복습할 단어 ${dueWords}개.`', '`復習する単語が${dueWords}語。`'),
    ('`오답 다시 풀기 ${Math.min(stale.length, 8)}문항`', '`間違えた問題の解き直し ${Math.min(stale.length, 8)}問`'),
    ('`하루 넘게 다시 풀지 않은 오답 ${stale.length}문항. 같은 문제 재풀이로 따로 기록.`', '`1日以上解き直していない問題が${stale.length}問。同じ問題の解き直しとして別に記録。`'),
    ("title: 'Part 5 실전 15문항 5분'", "title: 'Part 5 本番形式 15問5分'"),
    ("'실제 시험 시간 배분대로 풀어 감각 유지.'", "'本番の時間配分で解いて感覚を保つ。'"),
    ('`Part ${p} 맞춤 연습`', '`Part ${p} おすすめ練習`'),
    ('`목표 ${goal}점에 맞춘 난이도 구성. 고급·함정 문제 포함.`', '`目標${goal}点に合わせた難易度で出題。`'),
]

T['js/player.js'] = [
    ("toast('조건에 맞는 문제가 부족합니다.');", "toast('条件に合う問題が足りません。');"),
    ("toast('제한 시간이 끝났습니다. 남은 문항은 미응답 처리됩니다.', 3500);", "toast('制限時間が終わりました。残りの問題は未回答になります。', 3500);"),
    ("label: '문항', text:", "label: '1問', text:"),
    ("label: '지문', text:", "label: '文書', text:"),
    ("label: '남은 시간', text:", "label: '残り時間', text:"),
    ('aria-label="나가기"', 'aria-label="終了"'),
    ('<span class="tag accent">복습 1단계 · 핵심 개념</span>', '<span class="tag accent">復習ステップ1・要点</span>'),
    ('다음: 쉬운 문제 → 어려운 문제 → 제한 시간 문제 → 1·3·7일 뒤 새 문제', '次: やさしい問題 → 難しい問題 → 制限時間つきの問題 → 1・3・7日後に新しい問題'),
    ('data-act="conceptOk">확인</button>', 'data-act="conceptOk">確認</button>'),
    ('head.push(`${s.qIdx + 1}/${qs.length}번`);', 'head.push(`${s.qIdx + 1}/${qs.length}問目`);'),
    ("head.push(`복습 ${it.stage}단계 · ${STAGES[it.stage].label}${it.isNew === false ? ' · 같은 문제' : ''}`);", "head.push(`復習ステップ${it.stage}・${STAGES[it.stage].label}${it.isNew === false ? '・同じ問題' : ''}`);"),
    ('`목표 ${targetSec(C.bank, q, unit)}초` : `지문 목표 ${fmtSec(unitTarget(unit))} · 경과 <span data-set-elapsed>', '`目標${targetSec(C.bank, q, unit)}秒` : `文書の目標${fmtSec(unitTarget(unit))}・経過<span data-set-elapsed>'),
    ("`<div class=\"xs muted\">빈칸 (${q.blank})${q.type === 'insert' ? ' · 문장 삽입' : ''}</div>`", "`<div class=\"xs muted\">空所(${q.blank})${q.type === 'insert' ? '・文挿入' : ''}</div>`"),
    ("${P.wide ? '문제 크게' : '지문 크게'}", "${P.wide ? '問題を大きく' : '本文を大きく'}"),
    ("${isLast(s, qs) ? '결과 보기' : '다음'}", "${isLast(s, qs) ? '結果を見る' : '次へ'}"),
    ("${isLast(s, qs) ? '제출' : '다음'}", "${isLast(s, qs) ? '提出' : '次へ'}"),
    ('<div class="verdict bad">시간 초과 <span class="small muted">정답 ${LETTERS[q.answer]}</span></div>', '<div class="verdict bad">時間切れ <span class="small muted">正解 ${LETTERS[q.answer]}</span></div>'),
    ("${ok ? '정답' : '오답'}${ans.xp ? ` <span class=\"xp-pop\">+${ans.xp} XP</span>` : ''} <span class=\"small muted\">${ok ? LETTERS[q.answer] : `정답 ${LETTERS[q.answer]} · 내 답 ${LETTERS[ans.choice]}`} · ${Math.round(ans.sec)}초 · 목표 ${tgt}초</span>", "${ok ? '正解' : '不正解'}${ans.xp ? ` <span class=\"xp-pop\">+${ans.xp} XP</span>` : ''} <span class=\"small muted\">${ok ? LETTERS[q.answer] : `正解 ${LETTERS[q.answer]}・自分の答え ${LETTERS[ans.choice]}`}・${Math.round(ans.sec)}秒・目標${tgt}秒</span>"),
    ('<div class="verdict bad">미응답 <span class="small muted">정답 ${LETTERS[q.answer]}</span></div>', '<div class="verdict bad">未回答 <span class="small muted">正解 ${LETTERS[q.answer]}</span></div>'),
    ("${h(concept ? concept.name : q.concept)} · ${LEVELS[q.difficulty]}${q.tags && q.tags.includes('trap') ? ' · 함정' : ''}", "${h(concept ? concept.name : q.concept)}・${LEVELS[q.difficulty]}${q.tags && q.tags.includes('trap') ? '・ひっかけ' : ''}"),
    ('<p class="tip"><b>핵심</b> ${h(concept.tip)}</p>', '<p class="tip"><b>ポイント</b> ${h(concept.tip)}</p>'),
    ("'<span class=\"tag ok\">정답</span> '", "'<span class=\"tag ok\">正解</span> '"),
    ('<div class="para"><b>바꿔 말하기</b>${q.para.map((p) => `<div>지문: ${h(p.p)}<br>정답: ${h(p.a)}</div>`).join(\'\')}</div>', '<div class="para"><b>言い換え</b>${q.para.map((p) => `<div>本文: ${h(p.p)}<br>正解: ${h(p.a)}</div>`).join(\'\')}</div>'),
    ('<div class="small"><b>오답 원인</b></div>', '<div class="small"><b>ミスの原因</b></div>'),
    ("toast(ok ? `통과 +${XP.reviewPass} XP. 다음 단계로.` : '다시. 이전 단계로.');", "toast(ok ? `クリア +${XP.reviewPass} XP。次のステップへ。` : 'もう一度。前のステップへ。');"),
    ('<h3>나갈까요?</h3><p class="muted small">푼 문제는 저장되어 있고 홈에서 이어서 풀 수 있습니다.</p>', '<h3>中断しますか？</h3><p class="muted small">解いた問題は保存されていて、ホームから続きを解けます。</p>'),
    ('data-act="exitKeep">나가기</button>', 'data-act="exitKeep">中断する</button>'),
    ('data-act="exitFinish">여기서 끝내고 결과 보기</button>', 'data-act="exitFinish">ここで終えて結果を見る</button>'),
    ('data-act="closeSheet">계속 풀기</button>', 'data-act="closeSheet">続ける</button>'),
    ("sessionStorage.setItem('tt-last'", "sessionStorage.setItem('ttja-last'"),
]

T['js/app.js'] = [
    ("[['home', '홈', 'home'], ['learn', '학습', 'learn'], ['review', '복습', 'review'], ['stats', '기록', 'stats'], ['prefs', '설정', 'settings']]", "[['home', 'ホーム', 'home'], ['learn', '学習', 'learn'], ['review', '復習', 'review'], ['stats', '記録', 'stats'], ['prefs', '設定', 'settings']]"),
    ('aria-label="주 메뉴"', 'aria-label="メインメニュー"'),
    ('<h3>RC 추정 점수</h3><p class="muted small">기록이 없습니다. 간단 진단을 풀면 파트별 약점과 학습 수준이 나옵니다.</p>', '<h3>RC推定スコア</h3><p class="muted small">記録がありません。クイック診断を解くと、パートごとの苦手と学習レベルが分かります。</p>'),
    ('<h3>학습 수준</h3><span class="tag warn">데이터 부족</span>', '<h3>学習レベル</h3><span class="tag warn">データ不足</span>'),
    ('기록 ${est.n}문항. 점수 범위를 내기엔 부족해 수준만 표시합니다.', '記録${est.n}問。スコア範囲を出すには足りないため、レベルだけ表示します。'),
    ('<h3>RC 추정 점수 범위</h3><span class="tag accent">추정</span>', '<h3>RC推定スコア範囲</h3><span class="tag accent">推定</span>'),
    ('중앙값 ${R.point} · ${h(est.level)}', '中央値 ${R.point}・${h(est.level)}'),
    ("`RC 목표 <b>${g.want}</b>까지 약 <b>+${gap}점</b>` : `RC 목표 <b>${g.want}</b> 도달권`} · <a href=\"#goal\">파트별 차이</a>", "`RC目標<b>${g.want}</b>まであと約<b>+${gap}点</b>` : `RC目標<b>${g.want}</b>に届くレベル`}・<a href=\"#goal\">パート別の差</a>"),
    ('검증된 환산 모델이 아닌 추정치입니다. <a href="#about">계산 방식</a>', '検証済みの換算モデルではない推定値です。<a href="#about">計算方法</a>'),
    ('aria-label="RC 추정 점수 추이"', 'aria-label="RC推定スコアの推移"'),
    ('<h1>오늘의 RC</h1><a class="tag accent" href="#goal">목표 ${st.profile.goal}</a>', '<h1>今日のRC</h1><a class="tag accent" href="#goal">目標 ${st.profile.goal}</a>'),
    ('<h3>이어서 풀기</h3><p class="small muted" style="margin:0">${h(s.title)} · ${Object.keys(s.answers).length}문항 풀이 중</p>', '<h3>続きから解く</h3><p class="small muted" style="margin:0">${h(s.title)}・${Object.keys(s.answers).length}問解答済み</p>'),
    ('data-act="resume">이어 풀기</button></div></div>`;', 'data-act="resume">続ける</button></div></div>`;'),
    ('<div class="xs muted">오늘 학습</div>', '<div class="xs muted">今日の学習</div>'),
    ('<div class="xs muted">푼 문제</div>', '<div class="xs muted">解いた問題</div>'),
    ('<div><div class="xs muted">정답률</div><div class="stat">${today.length ?', '<div><div class="xs muted">正答率</div><div class="stat">${today.length ?'),
    ('<h2>오늘의 추천</h2><div class="row between wrap"><div class="seg" role="group" aria-label="코스 길이">', '<h2>今日のおすすめ</h2><div class="row between wrap"><div class="seg" role="group" aria-label="コースの長さ">'),
    ('aria-pressed="${minutes === m}">${m}분</button>', 'aria-pressed="${minutes === m}">${m}分</button>'),
    ('data-act="courseRefresh">다시 추천</button>', 'data-act="courseRefresh">別のおすすめ</button>'),
    ("${done ? ' <span class=\"tag ok\">완료</span>' : ''} <span class=\"tag\">${c.minutes}분</span>", "${done ? ' <span class=\"tag ok\">完了</span>' : ''} <span class=\"tag\">${c.minutes}分</span>"),
    ("${done ? '다시' : '시작'}</button></div>`;", "${done ? 'もう一度' : '開始'}</button></div>`;"),
    ('<h3>복습 대기 ${due.length}개 유형</h3>', '<h3>復習待ち ${due.length}タイプ</h3>'),
    ('<a class="btn sm" href="#review">복습</a>', '<a class="btn sm" href="#review">復習</a>'),
    ('<h3>풀던 세션이 있습니다</h3><p class="small muted">${h(C.state.active.title)}. 이어서 풀거나 버리고 새로 시작합니다.</p>', '<h3>途中のセッションがあります</h3><p class="small muted">${h(C.state.active.title)}。続きから解くか、破棄して新しく始めます。</p>'),
    ('data-act="resume">이어서 풀기</button><button class="btn block" data-act="discardAndStart">버리고 새로 시작</button>', 'data-act="resume">続きから解く</button><button class="btn block" data-act="discardAndStart">破棄して新しく始める</button>'),
    ("toast(kind === 'review' ? '지금 복습할 단계가 없습니다.' : '조건에 맞는 문제가 부족합니다.');", "toast(kind === 'review' ? '今復習するステップはありません。' : '条件に合う問題が足りません。');"),
    ('data-act="${act}" ${attrs}>시작</button>', 'data-act="${act}" ${attrs}>開始</button>'),
    ('<h1>학습</h1><h2>진단</h2>', '<h1>学習</h1><h2>診断</h2>'),
    ("${row('간단 진단', '20분', '세 파트에서 약 30문항. 약점 파트 파악.', 'startKind', 'data-k=\"diag\"', true)}", "${row('クイック診断', '20分', '3パートから約30問。苦手パートが分かる。', 'startKind', 'data-k=\"diag\"', true)}"),
    ("${row('심화 진단', '45분', '약 60문항, 이중·삼중 지문 포함. 유형별 실력과 시간 관리 분석.', 'startKind', 'data-k=\"deep\"')}", "${row('詳細診断', '45分', '約60問、ダブル・トリプルパッセージを含む。タイプ別の実力と時間配分を分析。', 'startKind', 'data-k=\"deep\"')}"),
    ('<h2>파트별 연습</h2>', '<h2>パート別練習</h2>'),
    ('<span class="tag">${C.bank.count(p)}문항</span>', '<span class="tag">${C.bank.count(p)}問</span>'),
    ("`정답률 ${pct(s.acc)}% · ${s.n}문항${s.avgSec != null ? ` · 평균 ${Math.round(s.avgSec)}초` : ''}` : '기록 없음'", "`正答率${pct(s.acc)}%・${s.n}問${s.avgSec != null ? `・平均${Math.round(s.avgSec)}秒` : ''}` : '記録なし'"),
    ('data-n="${nQ}">${nQ}문항</button><button class="btn sm ghost" data-act="conceptList" data-p="${p}">유형별</button>', 'data-n="${nQ}">${nQ}問</button><button class="btn sm ghost" data-act="conceptList" data-p="${p}">タイプ別</button>'),
    ('<b>Part 7 이중·삼중 지문</b> <span class="tag">${(C.bank.byPart[7] || []).filter((u) => u.passages.length > 1).length}세트</span><p>지문 사이 정보를 연결하는 연계 문제.</p></div><button class="btn sm" data-act="startMulti">2세트</button>', '<b>Part 7 ダブル・トリプルパッセージ</b> <span class="tag">${(C.bank.byPart[7] || []).filter((u) => u.passages.length > 1).length}セット</span><p>複数の文書の情報をつなげて解く問題。</p></div><button class="btn sm" data-act="startMulti">2セット</button>'),
    ('<h2>속도 훈련</h2>', '<h2>スピード練習</h2>'),
    ("${row('Part 5 연속 풀이', '12문항', '문항당 20초. 시간이 다 되면 다음 문항으로 넘어갑니다.', 'startKind', 'data-k=\"speed\"', true)}", "${row('Part 5 連続解答', '12問', '1問20秒。時間が来ると次の問題に進みます。', 'startKind', 'data-k=\"speed\"', true)}"),
    ("${row('Part 7 지문별 시간 훈련', '2~3세트', '지문 길이로 정한 목표 시간 안에 풀기.', 'startKind', 'data-k=\"p7time\"')}", "${row('Part 7 文書別タイム練習', '2〜3セット', '文書の長さで決めた目標時間内に解く。', 'startKind', 'data-k=\"p7time\"')}"),
    ("${row('시간 초과 문제 모음', `${over}문항`, '목표 시간을 넘겼던 문제를 시간 안에 다시 풀기.', 'startKind', `data-k=\"overtime\" ${over ? '' : 'disabled'}`)}", "${row('時間オーバー問題', `${over}問`, '目標時間を超えた問題を時間内に解き直す。', 'startKind', `data-k=\"overtime\" ${over ? '' : 'disabled'}`)}"),
    ('<h2>실전</h2>', '<h2>本番形式</h2>'),
    ("${row('RC 실전 모의고사', '75분', '100문항. Part 5 30, Part 6 16, Part 7 54. 해설은 끝나고.', 'startKind', 'data-k=\"full\"', true)}", "${row('RC本番模試', '75分', '100問。Part 5 30問、Part 6 16問、Part 7 54問。解説は最後に表示。', 'startKind', 'data-k=\"full\"', true)}"),
    ("${row('하프 모의고사', '38분', '약 50문항. 해설은 끝나고.', 'startKind', 'data-k=\"mock\"')}", "${row('ハーフ模試', '38分', '約50問。解説は最後に表示。', 'startKind', 'data-k=\"mock\"')}"),
    ('<b>파트별 시간 제한</b>', '<b>パート別の時間制限</b>'),
    ('>Part 5 · 15문항 · 5분</button>', '>Part 5・15問・5分</button>'),
    ('>Part 6 · 2세트 · 4분</button>', '>Part 6・2セット・4分</button>'),
    ('>Part 7 · 약 10문항 · 11분</button>', '>Part 7・約10問・11分</button>'),
    ('<h2>독해·어휘</h2>', '<h2>読解・語彙</h2>'),
    ('<b>바꿔 말하기 훈련</b><p>지문 표현과 정답 표현을 짝지어 보기.</p></div><a class="btn sm" href="#train-para">열기</a>', '<b>言い換え練習</b><p>本文の表現と正解の表現を組み合わせる。</p></div><a class="btn sm" href="#train-para">開く</a>'),
    ('<b>단어장</b><p>문제에서 저장한 어휘를 4지선다로 복습.</p></div><a class="btn sm" href="#train-vocab">열기</a>', '<b>単語帳</b><p>問題から保存した単語を4択で復習。</p></div><a class="btn sm" href="#train-vocab">開く</a>'),
    ("title: 'Part 7 이중·삼중 지문' }", "title: 'Part 7 ダブル・トリプルパッセージ' }"),
    ('<h3>Part ${p} 유형별 연습</h3>', '<h3>Part ${p} タイプ別練習</h3>'),
    ("${n}문항 · ${s ? `정답률 ${pct(s.acc)}%, ${s.n}문항 풀이` : '기록 없음'}", "${n}問・${s ? `正答率${pct(s.acc)}%、${s.n}問解答` : '記録なし'}"),
    ("${n ? '' : 'disabled'}>연습</button>", "${n ? '' : 'disabled'}>練習</button>"),
    ('data-act="closeSheet">닫기</button>`);\n});', 'data-act="closeSheet">閉じる</button>`);\n});'),
    ("sessionStorage.getItem('tt-last')", "sessionStorage.getItem('ttja-last')"),
    ('<h1>결과</h1><p class="muted">표시할 결과가 없습니다.</p>', '<h1>結果</h1><p class="muted">表示する結果がありません。</p>'),
    ('<h1>${h(s.title)} 결과</h1>', '<h1>${h(s.title)}の結果</h1>'),
    ('<div class="xs muted">정답</div><div class="score-big">', '<div class="xs muted">正解</div><div class="score-big">'),
    ('<div><div class="xs muted">정답률</div><div class="stat">${sum.n ?', '<div><div class="xs muted">正答率</div><div class="stat">${sum.n ?'),
    ('<div class="xs muted">시간</div>', '<div class="xs muted">時間</div>'),
    ("목표 시간 초과 ${sum.over}문항${sum.unanswered ? ` · 미응답 ${sum.unanswered}문항${s.timeUp ? ', 제한 시간 종료' : ''}` : ''}", "目標時間オーバー ${sum.over}問${sum.unanswered ? `・未回答 ${sum.unanswered}問${s.timeUp ? '、制限時間終了' : ''}` : ''}"),
    ('href="#goal">목표와 파트별 차이 보기</a>', 'href="#goal">目標とパート別の差を見る</a>'),
    ('<h3>시간 관리</h3>', '<h3>時間配分</h3>'),
    ("Part ${p}: ${info.timeRatio == null ? '기록 부족' : `목표 시간의 ${pct(info.timeRatio)}%`}", "Part ${p}: ${info.timeRatio == null ? '記録不足' : `目標時間の${pct(info.timeRatio)}%`}"),
    ("`이 속도라면 실제 RC 75분 안에 Part 7 약 ${R.unanswered}문항을 못 풀 것으로 추정.` : '이 속도라면 RC 75분 안에 모두 풀 수 있는 페이스.'", "`このペースだと、本番RC 75分ではPart 7が約${R.unanswered}問解き終わらない推定。` : 'このペースなら、RC 75分で全問解き終わる。'"),
    ('<h3>파트별</h3><table class="t"><thead><tr><th>파트</th><th class="num">정답률</th><th class="num">평균</th><th class="num">초과</th></tr>', '<h3>パート別</h3><table class="t"><thead><tr><th>パート</th><th class="num">正答率</th><th class="num">平均</th><th class="num">超過</th></tr>'),
    ("${v.n ? Math.round(v.sec / v.n) + '초' : '–'}", "${v.n ? Math.round(v.sec / v.n) + '秒' : '–'}"),
    ('<h2>다시 볼 문제 ${wrongQs.length}</h2>', '<h2>見直す問題 ${wrongQs.length}</h2>'),
    ("slow ? ['warn', '시간 초과'] : !a ? ['bad', '미응답'] : a.choice === -1 ? ['bad', '시간 초과'] : ['bad', '오답']", "slow ? ['warn', '時間オーバー'] : !a ? ['bad', '未回答'] : a.choice === -1 ? ['bad', '時間切れ'] : ['bad', '不正解']"),
    ('`빈칸 (${q.blank})` : q.question;\n      html', '`空所(${q.blank})` : q.question;\n      html'),
    ('<summary class="small">지문과 해석</summary>', '<summary class="small">本文と訳</summary>'),
    ('>틀린 유형 단계별 복습 · ${concepts.length}개</button>', '>間違えたタイプをステップ復習・${concepts.length}タイプ</button>'),
    ('<p class="muted">틀린 문제가 없습니다.</p>', '<p class="muted">間違えた問題はありません。</p>'),
    ('<a class="btn block" href="#home">홈으로</a>', '<a class="btn block" href="#home">ホームへ</a>'),
    ('<h3>유형별 실력</h3><table class="t"><thead><tr><th>유형</th><th class="num">정답률</th><th class="num">평균/목표</th></tr>', '<h3>タイプ別の実力</h3><table class="t"><thead><tr><th>タイプ</th><th class="num">正答率</th><th class="num">平均/目標</th></tr>'),
    ('${Math.round(v.target / v.n)}초</td>', '${Math.round(v.target / v.n)}秒</td>'),
    ('2문항 이상 나온 유형만. 약점 판단은 유형당 4문항 이상 누적 기록으로 합니다.', '2問以上出たタイプのみ。苦手の判定はタイプごとに4問以上の累積記録で行います。'),
    ("if (!s) { toast('지금 복습할 단계가 없습니다.'); return; }", "if (!s) { toast('今復習するステップはありません。'); return; }"),
    ('<h1>목표 설정</h1>', '<h1>目標設定</h1>'),
    ('총점 목표를 고르면 LC 기준 점수를 뺀 만큼이 RC 목표가 됩니다. 목표가 높을수록 고급·함정 문제 비중이 올라갑니다.', 'トータルの目標を選ぶと、LCの基準スコアを引いた分がRCの目標になります。目標が高いほど上級・ひっかけ問題が増えます。'),
    ('aria-label="목표 점수"', 'aria-label="目標スコア"'),
    ('<span>RC 목표</span>', '<span>RC目標</span>'),
    ("${gg.overflow ? ` · RC 만점으로도 ${gg.overflow}점 부족. LC도 올려야 하는 목표.` : ''}", "${gg.overflow ? `・RC満点でも${gg.overflow}点足りない。LCも上げる必要がある目標。` : ''}"),
    ('<h3>파트별 차이</h3>', '<h3>パート別の差</h3>'),
    ('실제 시험 난이도 분포를 가정한 정답률 추정. 막대는 현재, 세로선은 RC ${gg.want}점에 필요한 수준.', '本番の難易度分布を想定した正答率の推定。バーは現在、縦線はRC ${gg.want}点に必要な水準。'),
    ("'<span class=\"tag warn\">기록 부족</span>'", "'<span class=\"tag warn\">記録不足</span>'"),
    ('<h3>기준 점수</h3>', '<h3>基準スコア</h3>'),
    ('<span>LC 기준 점수</span>', '<span>LC基準スコア</span>'),
    ('<span>최근 RC 점수</span>', '<span>最近のRCスコア</span>'),
    ('LC 기준 점수는 RC 목표 계산에만 씁니다. 최근 RC 점수는 기록이 적을 때만 추정에 약하게 반영됩니다.', 'LC基準スコアはRC目標の計算だけに使います。最近のRCスコアは、記録が少ないときだけ推定に弱く反映されます。'),
    ('href="#home">오늘의 학습으로</a>', 'href="#home">今日の学習へ</a>'),
    ("toast('저장했습니다');", "toast('保存しました');"),
    ("toast('이 브라우저에서는 기록이 저장되지 않습니다.', 4000);", "toast('このブラウザでは記録が保存されません。', 4000);"),
    ("localStorage.setItem('tt:probe', '1'); localStorage.removeItem('tt:probe');", "localStorage.setItem('ttja:probe', '1'); localStorage.removeItem('ttja:probe');"),
    ('if (p.lcBase == null) p.lcBase = 395;', 'if (p.lcBase == null) p.lcBase = 350;'),
    ('<h1>문제를 불러오지 못했습니다</h1>', '<h1>問題を読み込めませんでした</h1>'),
    ('처음 실행에는 인터넷 연결이 필요합니다. 한 번 열린 뒤에는 오프라인에서도 실행됩니다.', '初回はインターネット接続が必要です。一度開いた後はオフラインでも使えます。'),
]

T['js/screens.js'] = [
    ("d <= 0 ? '오늘' : `${d}일 뒤`", "d <= 0 ? '今日' : `${d}日後`"),
    ('<h1>복습</h1><h2>단계별 복습</h2>', '<h1>復習</h1><h2>ステップ復習</h2>'),
    ('틀린 문제의 유형이 여기에 쌓입니다. 순서: 개념 → 쉬운 문제 → 어려운 문제 → 제한 시간 → 1·3·7일 뒤 새 문제.', '間違えた問題のタイプがここにたまります。順番: 要点 → やさしい問題 → 難しい問題 → 制限時間 → 1・3・7日後に新しい問題。'),
    ('data-act="startReview">지금 복습 · ${Math.min(due.length, 5)}개 유형</button>', 'data-act="startReview">今すぐ復習・${Math.min(due.length, 5)}タイプ</button>'),
    ('<span class="tag accent">지금</span>', '<span class="tag accent">今</span>'),
    ('<h2>예정</h2>', '<h2>予定</h2>'),
    ('<h2>오답노트 <span class="muted small">${notes.length}문항</span></h2>', '<h2>間違いノート <span class="muted small">${notes.length}問</span></h2>'),
    ("${p ? `P${p}` : '전체'}", "${p ? `P${p}` : 'すべて'}"),
    ('data-act="wnAll">다시 맞히지 못한 문제 풀기 · ${', 'data-act="wnAll">まだ正解していない問題を解く・${'),
    ('`빈칸 (${ref.q.blank})` : ref.q.question;', '`空所(${ref.q.blank})` : ref.q.question;'),
    ("P${n.part} · ${h(conceptName(C.bank, n.concept))} · 틀림 ${n.wrongCount}${n.rightAfter ? ` · 이후 정답 ${n.rightAfter}` : ''}${n.cause ? ` · ${h(", "P${n.part}・${h(conceptName(C.bank, n.concept))}・不正解${n.wrongCount}${n.rightAfter ? `・その後正解${n.rightAfter}` : ''}${n.cause ? `・${h("),
    ('data-act="wnOne" data-q="${n.qid}">다시</button>', 'data-act="wnOne" data-q="${n.qid}">解き直す</button>'),
    ('<p class="muted small">해당하는 오답이 없습니다.</p>', '<p class="muted small">該当する問題はありません。</p>'),
    ('<h2>시간 초과 문제 <span class="muted small">${over.length}문항</span></h2>', '<h2>時間オーバー問題 <span class="muted small">${over.length}問</span></h2>'),
    ('data-act="overtimeStart">시간 안에 다시 풀기 · ${', 'data-act="overtimeStart">時間内に解き直す・${'),
    ("'<p class=\"muted small\">목표 시간을 넘긴 문제가 여기에 모입니다.</p>'", "'<p class=\"muted small\">目標時間を超えた問題がここに集まります。</p>'"),
    ('<h2>복습 효과</h2><div class="card small">같은 문제 다시 맞힘 <b>${r.repeatRight}/${r.repeatTotal}</b><br>같은 개념의 새 문제 맞힘 <b>', '<h2>復習の効果</h2><div class="card small">同じ問題の再正解 <b>${r.repeatRight}/${r.repeatTotal}</b><br>同じタイプの新しい問題の正解 <b>'),
    ('같은 문제는 기억, 새 문제는 이해를 확인합니다. 둘을 따로 기록합니다.', '同じ問題は記憶、新しい問題は理解の確認です。2つを分けて記録します。'),
    ('<h2>단어장 <span class="muted small">${Object.keys(st.vocab).length}개</span></h2><a class="btn block" href="#train-vocab">단어장 열기</a>', '<h2>単語帳 <span class="muted small">${Object.keys(st.vocab).length}語</span></h2><a class="btn block" href="#train-vocab">単語帳を開く</a>'),
    ("toast('지금 복습할 단계가 없습니다.');", "toast('今復習するステップはありません。');"),
    ("toast('모두 한 번 이상 다시 맞혔습니다.');", "toast('すべて1回以上正解しています。');"),
    ('`[토익 RC 훈련 요약] ${dayKey(Date.now())}`', '`[TOEIC RC 学習まとめ] ${dayKey(Date.now())}`'),
    ("`오늘 푼 문제: ${today.length}문항${today.length ? `, 정답률 ${pct(today.filter((a) => a.correct).length / today.length)}%` : ''}, 학습 ${fmtMin(todayStudySec(st.studyLog))}`", "`今日解いた問題: ${today.length}問${today.length ? `、正答率${pct(today.filter((a) => a.correct).length / today.length)}%` : ''}、学習${fmtMin(todayStudySec(st.studyLog))}`"),
    ('`P${p} ${pct(ps[p].acc)}% ${ps[p].n}문항`', '`P${p} ${pct(ps[p].acc)}% ${ps[p].n}問`'),
    ("`파트별 정답률${today.length ? ' 오늘' : ' 전체'}: ${parts.join(', ') || '기록 없음'}`", "`パート別正答率${today.length ? '・今日' : '・全期間'}: ${parts.join('、') || '記録なし'}`"),
    ("`약점 유형: ${weak.length ? weak.map((w) => `${conceptName(C.bank, w.concept)} ${pct(w.acc)}% ${w.n}문항`).join(', ') : '판단할 기록 부족'}`", "`苦手なタイプ: ${weak.length ? weak.map((w) => `${conceptName(C.bank, w.concept)} ${pct(w.acc)}% ${w.n}問`).join('、') : '判断できる記録が不足'}`"),
    ("`RC 추정 점수 범위: ${est.rc.lo}–${est.rc.hi}, 공식 환산 아님 · 목표 ${st.profile.goal}` : `학습 수준: ${est.level}, 데이터 부족 · 목표 ${st.profile.goal}`", "`RC推定スコア範囲: ${est.rc.lo}–${est.rc.hi}、公式換算ではない・目標${st.profile.goal}` : `学習レベル: ${est.level}、データ不足・目標${st.profile.goal}`"),
    ('<h1>기록</h1>', '<h1>記録</h1>'),
    ('<h3>파트별 정답률·풀이 시간</h3><table class="t"><thead><tr><th>파트</th><th class="num">문항</th><th class="num">정답률</th><th class="num">평균</th></tr>', '<h3>パート別の正答率・解答時間</h3><table class="t"><thead><tr><th>パート</th><th class="num">問題数</th><th class="num">正答率</th><th class="num">平均</th></tr>'),
    ('`${Math.round(ps[p].avgSec)}초${p >= 5 && ps[p].target ? `<div class="xs muted">목표 ${ps[p].target}초</div>`', '`${Math.round(ps[p].avgSec)}秒${p >= 5 && ps[p].target ? `<div class="xs muted">目標${ps[p].target}秒</div>`'),
    ('<h3>자주 틀리는 유형 TOP 3</h3>', '<h3>よく間違えるタイプ TOP 3</h3>'),
    ("정답률 ${pct(w.acc)}% · ${w.n}문항${w.avgSec != null ? ` · 평균 ${Math.round(w.avgSec)}초` : ''}", "正答率${pct(w.acc)}%・${w.n}問${w.avgSec != null ? `・平均${Math.round(w.avgSec)}秒` : ''}"),
    ('data-act="drillConcept" data-c="${w.concept}">연습</button>', 'data-act="drillConcept" data-c="${w.concept}">練習</button>'),
    ("'<p class=\"small muted\">유형당 4문항 이상 풀어야 약점으로 판단합니다.</p>'", "'<p class=\"small muted\">タイプごとに4問以上解くと苦手を判定します。</p>'"),
    ('<h3>오답 원인 분포</h3>', '<h3>ミスの原因</h3>'),
    ("'<p class=\"small muted\">해설 아래에서 고른 오답 원인이 여기에 모입니다.</p>'", "'<p class=\"small muted\">解説の下で選んだミスの原因がここに集まります。</p>'"),
    ('<h3>복습 효과</h3><div class="small">같은 문제 다시 맞힘 ${r.repeatRight}/${r.repeatTotal} · 같은 개념 새 문제 맞힘 ${r.newRight}/${r.newTotal}</div>', '<h3>復習の効果</h3><div class="small">同じ問題の再正解 ${r.repeatRight}/${r.repeatTotal}・同じタイプの新しい問題の正解 ${r.newRight}/${r.newTotal}</div>'),
    ('<h3>결과 요약</h3>', '<h3>学習まとめ</h3>'),
    ('data-act="copySummary">결과 요약 복사</button>', 'data-act="copySummary">まとめをコピー</button>'),
    ('<h3>학습 기록 백업</h3><p class="xs muted" style="margin:0 0 8px">기록은 이 기기 브라우저에만 저장됩니다. 다른 기기로 옮길 때 JSON으로 내보냅니다.</p>', '<h3>学習記録のバックアップ</h3><p class="xs muted" style="margin:0 0 8px">記録はこの端末のブラウザにだけ保存されます。別の端末に移すときはJSONで書き出します。</p>'),
    ('data-act="exportData">JSON 내보내기</button><button class="btn grow" data-act="importPick">가져오기</button>', 'data-act="exportData">JSON書き出し</button><button class="btn grow" data-act="importPick">読み込み</button>'),
    ("(await copyText(summaryText())) ? '복사했습니다' : '복사하지 못했습니다. 텍스트를 길게 눌러 복사합니다.'", "(await copyText(summaryText())) ? 'コピーしました' : 'コピーできませんでした。テキストを長押ししてコピーできます。'"),
    ("<h3>기록 JSON ${ok ? '복사됨' : '복사 실패'}</h3><p class=\"small\">이 페이지는 파일 저장이 막혀 있습니다. ${ok ? '클립보드에 복사했으니 메모 앱에 붙여 넣어 .json으로 저장합니다.' : '복사도 실패했습니다. GitHub Pages 버전에서 내보냅니다.'}</p><button class=\"btn block\" data-act=\"closeSheet\">닫기</button>", "<h3>記録JSON ${ok ? 'コピー済み' : 'コピー失敗'}</h3><p class=\"small\">このページではファイル保存ができません。${ok ? 'クリップボードにコピーしたので、メモアプリに貼り付けて.jsonで保存できます。' : 'コピーもできませんでした。GitHub Pages版から書き出せます。'}</p><button class=\"btn block\" data-act=\"closeSheet\">閉じる</button>"),
    ("toast('내보냈습니다');", "toast('書き出しました');"),
    ("toast('JSON 파일을 읽지 못했습니다. 기존 기록은 그대로입니다.', 3500);", "toast('JSONファイルを読めませんでした。今の記録はそのままです。', 3500);"),
    ('<h3>가져올 수 없는 파일</h3><p class="small">기존 기록은 바뀌지 않았습니다.</p>', '<h3>読み込めないファイル</h3><p class="small">今の記録は変わっていません。</p>'),
    ('<button class="btn block" data-act="closeSheet">닫기</button>`); return; }', '<button class="btn block" data-act="closeSheet">閉じる</button>`); return; }'),
    ("<h3>기록을 바꿀까요?</h3><p class=\"small\">파일의 기록 ${obj.data.attempts.length}문항, 내보낸 날 ${h(String(obj.exportedAt || '').slice(0, 10))}. 현재 기록 ${C.state.attempts.length}문항을 대체합니다. ${C.embedded ? '이 페이지는 자동 백업을 저장할 수 없습니다. 필요하면 먼저 내보내기로 복사해 둡니다.' : '현재 기록은 먼저 파일로 내려받아 둡니다.'}</p>", "<h3>記録を置き換えますか？</h3><p class=\"small\">ファイルの記録${obj.data.attempts.length}問、書き出し日${h(String(obj.exportedAt || '').slice(0, 10))}。今の記録${C.state.attempts.length}問と置き換えます。${C.embedded ? 'このページでは自動バックアップを保存できません。必要なら先に書き出しでコピーしておきます。' : '今の記録は先にファイルとしてダウンロードされます。'}</p>"),
    ('data-act="importConfirm">바꾸기</button><button class="btn block ghost" data-act="closeSheet">취소</button>', 'data-act="importConfirm">置き換える</button><button class="btn block ghost" data-act="closeSheet">キャンセル</button>'),
    ('download(`toeic-trainer-backup-before-import-${Date.now()}.json`', 'download(`toeic-trainer-ja-backup-before-import-${Date.now()}.json`'),
    ('download(`toeic-trainer-${dayKey(Date.now())}.json`', 'download(`toeic-trainer-ja-${dayKey(Date.now())}.json`'),
    ("toast('가져오지 못했습니다. 기존 기록은 그대로입니다.');", "toast('読み込めませんでした。今の記録はそのままです。');"),
    ('toast(`${r.count}문항 기록을 가져왔습니다`);', 'toast(`${r.count}問の記録を読み込みました`);'),
    ('<h1>설정</h1>', '<h1>設定</h1>'),
    ('<h3>목표 점수</h3><div class="small muted">총점 ${st.profile.goal} · LC 기준 ${st.profile.lcBase}</div></div><a class="btn sm" href="#goal">바꾸기</a>', '<h3>目標スコア</h3><div class="small muted">トータル${st.profile.goal}・LC基準${st.profile.lcBase}</div></div><a class="btn sm" href="#goal">変更</a>'),
    ("<h3>화면</h3><div class=\"seg\" style=\"display:flex\">${[['auto', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']]", "<h3>画面</h3><div class=\"seg\" style=\"display:flex\">${[['auto', '端末の設定'], ['light', 'ライト'], ['dark', 'ダーク']]"),
    ('<h3>데이터</h3><div class="stack"><button class="btn block" data-act="exportData">학습 기록 내보내기</button><button class="btn block" data-act="importPick">학습 기록 가져오기</button><button class="btn block ghost" data-act="resetAsk">모든 기록 지우기</button>', '<h3>データ</h3><div class="stack"><button class="btn block" data-act="exportData">学習記録を書き出す</button><button class="btn block" data-act="importPick">学習記録を読み込む</button><button class="btn block ghost" data-act="resetAsk">すべての記録を消去</button>'),
    ("<h3>앱 정보</h3>앱 ${h(C.version)} · 문제은행 ${h(C.dataVersion)}<br>${RC_PARTS.map((p) => `Part ${p} ${C.bank.count(p)}문항`).join(' · ')} · 합계 ${total}<br>Part 6 ${(C.bank.byPart[6] || []).length}세트 · Part 7 단일 ${(C.bank.byPart[7] || []).filter((u) => u.passages.length === 1).length}세트, 이중·삼중 ${(C.bank.byPart[7] || []).filter((u) => u.passages.length > 1).length}세트<br>저장 방식 ${h(C.store.adapter.kind)}<br><a href=\"#about\">추정 점수 계산 방식과 한계</a>", "<h3>アプリ情報</h3>アプリ ${h(C.version)}・問題データ ${h(C.dataVersion)}<br>${RC_PARTS.map((p) => `Part ${p} ${C.bank.count(p)}問`).join('・')}・合計${total}<br>Part 6 ${(C.bank.byPart[6] || []).length}セット・Part 7 シングル${(C.bank.byPart[7] || []).filter((u) => u.passages.length === 1).length}セット、ダブル・トリプル${(C.bank.byPart[7] || []).filter((u) => u.passages.length > 1).length}セット<br>保存方式 ${h(C.store.adapter.kind)}<br><a href=\"#about\">推定スコアの計算方法と限界</a>"),
    ('RC 전용 앱입니다. 모든 문제는 이 앱을 위해 새로 작성했고 실제 시험·교재 문제가 아닙니다. TOEIC은 ETS의 등록 상표입니다.', 'RC専用アプリです。すべての問題はこのアプリのために新しく作ったもので、実際の試験や教材の問題ではありません。TOEICはETSの登録商標です。'),
    ('<h3>모든 기록을 지울까요?</h3><p class="small">풀이 기록, 복습 카드, 단어장, XP·연속 기록, 설정이 모두 지워지고 되돌릴 수 없습니다.</p>', '<h3>すべての記録を消去しますか？</h3><p class="small">解答記録、復習カード、単語帳、XP・連続記録、設定がすべて消え、元に戻せません。</p>'),
    ('data-act="exportData">먼저 내보내기</button><button class="btn primary block" data-act="resetConfirm">지우기</button><button class="btn ghost block" data-act="closeSheet">취소</button>', 'data-act="exportData">先に書き出す</button><button class="btn primary block" data-act="resetConfirm">消去する</button><button class="btn ghost block" data-act="closeSheet">キャンセル</button>'),
    ("toast('기록을 지웠습니다');", "toast('記録を消去しました');"),
    ('<div class="xs muted">문제 속 문맥</div>', '<div class="xs muted">問題での使われ方</div>'),
    ('<div class="xs muted">예문</div>', '<div class="xs muted">例文</div>'),
    ("${saved ? '단어장에 있음' : '단어장에 저장'}</button><button class=\"btn ghost block\" data-act=\"closeSheet\">닫기</button>", "${saved ? '単語帳に保存済み' : '単語帳に保存'}</button><button class=\"btn ghost block\" data-act=\"closeSheet\">閉じる</button>"),
    ("el.textContent = '저장했습니다';", "el.textContent = '保存しました';"),
    ('<p>알 수 없는 훈련</p>', '<p>不明な練習</p>'),
    ('<h1>바꿔 말하기 훈련</h1>', '<h1>言い換え練習</h1>'),
    ('data-m="quiz" aria-pressed="${PT.mode === \'quiz\'}">퀴즈</button><button data-act="ptMode" data-m="list" aria-pressed="${PT.mode === \'list\'}">짝 모아 보기</button>', 'data-m="quiz" aria-pressed="${PT.mode === \'quiz\'}">クイズ</button><button data-act="ptMode" data-m="list" aria-pressed="${PT.mode === \'list\'}">ペア一覧</button>'),
    ('<p class="small muted">지문 표현과 정답 표현 ${pool.length}쌍</p>', '<p class="small muted">本文の表現と正解の表現 ${pool.length}組</p>'),
    ('<p class="small">맞힘 ${PT.right}/${PT.total}</p>', '<p class="small">正解 ${PT.right}/${PT.total}</p>'),
    ('지문 표현: <b>${h(item.p)}</b>', '本文の表現: <b>${h(item.p)}</b>'),
    ('<p class="small muted">이 지문 표현을 바꿔 말한 선택지</p>', '<p class="small muted">この本文の表現を言い換えた選択肢</p>'),
    ('<b>짝</b><br>지문: ${h(item.p)}<br>정답: <b>${h(item.a)}</b></div><div class="foot-actions"><button class="btn primary" data-act="ptNext">다음</button>', '<b>ペア</b><br>本文: ${h(item.p)}<br>正解: <b>${h(item.a)}</b></div><div class="foot-actions"><button class="btn primary" data-act="ptNext">次へ</button>'),
    ('<h1>단어장 <span class="muted small">${list.length}개</span></h1>', '<h1>単語帳 <span class="muted small">${list.length}語</span></h1>'),
    ('data-m="quiz" aria-pressed="${VT.mode === \'quiz\'}">퀴즈</button><button data-act="vtMode" data-m="list" aria-pressed="${VT.mode === \'list\'}">목록</button>', 'data-m="quiz" aria-pressed="${VT.mode === \'quiz\'}">クイズ</button><button data-act="vtMode" data-m="list" aria-pressed="${VT.mode === \'list\'}">一覧</button>'),
    ('해설의 단어를 탭해 저장하면 여기에 쌓입니다. 퀴즈는 4개부터 열립니다.', '解説の単語をタップして保存するとここにたまります。クイズは4語から使えます。'),
    ('data-act="vtSeed">틀린 문제의 어휘 자동 추가</button>', 'data-act="vtSeed">間違えた問題の単語をまとめて追加</button>'),
    ('data-w="${h(v.w.toLowerCase())}">삭제</button>', 'data-w="${h(v.w.toLowerCase())}">削除</button>'),
    ("${VT.hideMeaning ? '뜻 보이기' : '뜻 가리기'}", "${VT.hideMeaning ? '意味を表示' : '意味を隠す'}"),
    ('${entry.box || 0}단계</span>', '${entry.box || 0}段階</span>'),
    ('data-act="vtNext">다음</button>', 'data-act="vtNext">次へ</button>'),
    ("toast(added ? `${added}개 추가했습니다` : '추가할 어휘가 없습니다. 먼저 문제를 풀어 보세요.');", "toast(added ? `${added}語追加しました` : '追加する単語がありません。間違えた問題の単語が対象です。');"),
    ('<h1>추정 점수 계산 방식</h1>', '<h1>推定スコアの計算方法</h1>'),
    ('<p><b>쓰는 기록</b><br>최근 90일 RC 풀이의 정답 여부, 문항 난이도, 풀이 시간, 파트별 성취도. 같은 문제 재풀이와 단계별 복습 기록은 뺍니다. 진단·모의고사는 가중치 1, 일반 연습은 0.6입니다.</p>', '<p><b>使う記録</b><br>直近90日のRC解答の正誤、問題の難易度、解答時間、パート別の成績。同じ問題の解き直しとステップ復習の記録は除きます。診断・模試は重み1、通常の練習は0.6です。</p>'),
    ('<p><b>계산 순서</b><br>1. 난이도와 찍어서 맞힐 확률을 넣은 문항반응 모델로 능력값 분포를 구합니다. 실제 시험 파트 비중으로 가중해 많이 푼 파트가 결과를 독점하지 않게 합니다. Part 7은 RC의 54%입니다.<br>', '<p><b>計算の手順</b><br>1. 難易度と当てずっぽうで正解する確率を入れた項目反応モデルで能力値の分布を求めます。本番のパート比率で重みをつけ、多く解いたパートだけで結果が決まらないようにします。Part 7はRCの54%です。<br>'),
    ('2. 파트별 능력값은 전체 능력값 쪽으로 당겨 기록이 적은 파트가 튀지 않게 합니다.<br>', '2. パート別の能力値は全体の能力値に寄せ、記録が少ないパートの値が極端にならないようにします。<br>'),
    ('3. 실제 시험 문항 수와 가정한 난이도 분포로 예상 원점수를 구합니다. 내 풀이 속도로 75분 안에 못 푸는 문항은 찍는다고 보고 깎습니다.<br>', '3. 本番の問題数と想定した難易度分布から予想素点を求めます。自分の解答ペースで75分以内に解き終わらない問題は、当てずっぽうで答えるとみなして減らします。<br>'),
    ('4. 원점수 비율을 근사 환산표로 5~495점으로 바꿉니다.<br>', '4. 素点の割合を近似換算表で5〜495点に換算します。<br>'),
    ('5. 능력값 분포의 10~90% 구간에 환산표 오차 20점과 안 풀어 본 파트 비중만큼을 더해 범위로 표시합니다. 15문항 미만이거나 파트 비중 절반 이상을 안 풀었으면 점수 대신 학습 수준만 보여 줍니다.</p>', '5. 能力値分布の10〜90%区間に、換算表の誤差20点と未解答パートの比率分を加えて範囲で表示します。15問未満、またはパート比率の半分以上を解いていない場合は、スコアの代わりに学習レベルだけを表示します。</p>'),
    ('<p><b>최근 RC 점수</b><br>목표 화면의 최근 RC 점수는 기록이 적을 때만 약하게 반영됩니다. 기본값은 360입니다.</p>', '<p><b>最近のRCスコア</b><br>目標画面の「最近のRCスコア」は、記録が少ないときだけ弱く反映されます。初期値は300です。</p>'),
    ('<p><b>한계</b><br>검증된 환산 모델이 아닙니다. 난이도는 작성자가 매긴 값이고 응시자 데이터로 보정하지 않았습니다. 환산표도 공식 표가 아닙니다. 실제 점수를 정확히 예측하지 않으며 학습 방향을 잡는 참고치입니다.</p>', '<p><b>限界</b><br>検証済みの換算モデルではありません。難易度は作成者がつけた値で、受験者データで補正していません。換算表も公式のものではありません。実際のスコアを正確に予測するものではなく、学習の方向を決めるための目安です。</p>'),
    ('href="#stats">기록으로</a>', 'href="#stats">記録へ</a>'),
]

# ---- 학습 동기 (2.1) ----
T['js/game.js'] = [
    ("['미학습', '입문', '기초', '익숙', '숙련', '마스터']", "['未学習', '入門', '基礎', '習得中', '得意', 'マスター']"),
    ("label: '첫 걸음', desc: '첫 세션 완료'", "label: 'はじめの一歩', desc: '最初のセッション完了'"),
    ("label: '첫 목표', desc: '하루 목표 처음 달성'", "label: '初目標', desc: '1日の目標を初めて達成'"),
    ("label: '3일 연속', desc: '3일 연속 목표 달성'", "label: '3日連続', desc: '3日連続で目標達成'"),
    ("label: '7일 연속', desc: '7일 연속 목표 달성'", "label: '7日連続', desc: '7日連続で目標達成'"),
    ("label: '30일 연속', desc: '30일 연속 목표 달성'", "label: '30日連続', desc: '30日連続で目標達成'"),
    ("label: '100문항', desc: '누적 100문항 풀이'", "label: '100問', desc: '累計100問解答'"),
    ("label: '500문항', desc: '누적 500문항 풀이'", "label: '500問', desc: '累計500問解答'"),
    ("label: '만점', desc: '10문항 이상 세션 만점'", "label: '満点', desc: '10問以上のセッションで満点'"),
    ("label: '첫 마스터', desc: '유형 하나 마스터'", "label: '初マスター', desc: 'タイプを1つマスター'"),
    ("label: '마스터 10', desc: '10개 유형 마스터'", "label: 'マスター10', desc: '10タイプをマスター'"),
    ("label: '복습 10단계', desc: '단계별 복습 10번 통과'", "label: '復習10ステップ', desc: 'ステップ復習を10回クリア'"),
    ("label: '실전 완주', desc: 'RC 실전 모의고사 완주'", "label: '本番模試完走', desc: 'RC本番模試を完走'"),
]
T['js/app.js'] += [
    ("toast(`오늘 목표 달성 · 연속 ${ev.streak}일`, 3000)", "toast(`今日の目標達成・${ev.streak}日連続`, 3000)"),
    ("toast(`레벨 ${ev.levelUp} 달성`, 3000)", "toast(`レベル${ev.levelUp}に到達`, 3000)"),
    ("const WD = ['일', '월', '화', '수', '목', '금', '토'];", "const WD = ['日', '月', '火', '水', '木', '金', '土'];"),
    ('aria-label="오늘 ${xp}/${daily} XP"', 'aria-label="今日 ${xp}/${daily} XP"'),
    ("`오늘 목표 달성. 내일도 채우면 ${si.days + 1}일 연속.`", "`今日の目標達成。明日も達成すれば${si.days + 1}日連続。`"),
    ("`${left} XP 더 채우면 ${si.days + 1}일 연속. 약 ${Math.ceil(left / 10)}문항.`", "`あと${left} XPで${si.days + 1}日連続。約${Math.ceil(left / 10)}問。`"),
    ("`오늘 ${left} XP를 채우면 연속 1일째. 약 ${Math.ceil(left / 10)}문항.`", "`今日${left} XPで連続1日目。約${Math.ceil(left / 10)}問。`"),
    ('<div class="streak-n">${si.days}일 연속</div><div class="xs muted">최고 ${Math.max(g.best, si.days)}일${g.freezes ? ` · 휴식권 ${g.freezes}` : \'\'}</div>', '<div class="streak-n">${si.days}日連続</div><div class="xs muted">最高${Math.max(g.best, si.days)}日${g.freezes ? `・お休みパス ${g.freezes}` : \'\'}</div>'),
    ('data-act="quick">빠른 5문항</button>', 'data-act="quick">サクッと5問</button>'),
    ("title: '빠른 5문항' }));", "title: 'サクッと5問' }));"),
    ("<b>오늘 목표 달성 · 연속 ${s.goalHit}일</b>", "<b>今日の目標達成・${s.goalHit}日連続</b>"),
    ("${si.doneToday ? `오늘 목표 달성 · 연속 ${si.days}일` : `오늘 목표까지 ${Math.max(0, g.daily - si.todayXp)} XP`}", "${si.doneToday ? `今日の目標達成・${si.days}日連続` : `今日の目標まであと${Math.max(0, g.daily - si.todayXp)} XP`}"),
    ("<span>휴식권 1개 획득. 하루 빠져도 연속 기록 유지.</span>", "<span>お休みパスを1枚獲得。1日休んでも連続記録が続きます。</span>"),
    ("<b>레벨 ${s.levelUp} 달성</b>", "<b>レベル${s.levelUp}に到達</b>"),
    ("<span>배지 <b>${h(b.label)}</b> · ${h(b.desc)}</span>", "<span>バッジ <b>${h(b.label)}</b>・${h(b.desc)}</span>"),
    ('<div class="xs muted">이번 학습</div><div class="xp-big">', '<div class="xs muted">今回の学習</div><div class="xp-big">'),
]
T['js/player.js'] += [
    ('sheet(`<h3>풀던 세션이 있습니다</h3><p class="small muted">${h(cur.title)}. 이어서 풀거나 버리고 새로 시작합니다.</p>', 'sheet(`<h3>途中のセッションがあります</h3><p class="small muted">${h(cur.title)}。続きから解くか、破棄して新しく始めます。</p>'),
    ('data-act="resume">이어서 풀기</button><button class="btn block" data-act="discardAndStartPending">버리고 새로 시작</button>', 'data-act="resume">続きから解く</button><button class="btn block" data-act="discardAndStartPending">破棄して新しく始める</button>'),
]
T['js/screens.js'] += [
    ("`연속 ${si.days}일 · Lv.${levelOf(st.game.total).level} · 누적 ${st.game.total} XP · 오늘 ${si.todayXp}/${st.game.daily} XP`", "`${si.days}日連続・Lv.${levelOf(st.game.total).level}・累計${st.game.total} XP・今日${si.todayXp}/${st.game.daily} XP`"),
    ('<h3>최근 7일</h3>', '<h3>直近7日</h3>'),
    ('<div class="xs muted">푼 문제</div><div class="stat">${cur.length}', '<div class="xs muted">解いた問題</div><div class="stat">${cur.length}'),
    ('<div class="xs muted">정답률</div><div class="stat">${acc(cur)', '<div class="xs muted">正答率</div><div class="stat">${acc(cur)'),
    ('aria-label="날짜별 XP"', 'aria-label="日別XP"'),
    ('숫자 옆은 그 전 7일과의 차이. 선은 하루 목표 ${g.daily} XP.', '数字の横はその前の7日間との差。線は1日の目標${g.daily} XP。'),
    ("const WD = ['일', '월', '화', '수', '목', '금', '토'];", "const WD = ['日', '月', '火', '水', '木', '金', '土'];"),
    ('<h3>실력 지도</h3>', '<h3>実力マップ</h3>'),
    ('<div class="xs muted">전체 숙련도</div>', '<div class="xs muted">全体の習熟度</div>'),
    ('<div class="xs muted">숙련 이상</div>', '<div class="xs muted">得意以上</div>'),
    ('<div class="xs muted">마스터</div>', '<div class="xs muted">マスター</div>'),
    ('단계: 입문 → 기초(2문항, 50%) → 익숙(4문항, 70%) → 숙련(6문항, 80%, 중급 정답) → 마스터(8문항, 85%, 고급 정답, 목표 시간 안). 정답률은 최근 10번 기준.', '段階: 入門 → 基礎（2問、50%）→ 習得中（4問、70%）→ 得意（6問、80%、中級に正解）→ マスター（8問、85%、上級に正解、目標時間内）。正答率は直近10回で計算。'),
    ('<h3>배지 <span class="muted small">', '<h3>バッジ <span class="muted small">'),
    ('<h3>하루 목표</h3>', '<h3>1日の目標</h3>'),
    ('XP 기준. 정답 10, 오답 2, 같은 문제 다시 풀기는 절반. 50 XP는 약 5문항.', 'XPで設定。正解10、不正解2、同じ問題の解き直しは半分。50 XPは約5問。'),
    ("<h3 style=\"margin:0\">효과음</h3><div class=\"seg\">${[['1', '켜기'], ['0', '끄기']]", "<h3 style=\"margin:0\">効果音</h3><div class=\"seg\">${[['1', 'オン'], ['0', 'オフ']]"),
    ("if (ev.goalReached) toast('오늘 목표 달성');", "if (ev.goalReached) toast('今日の目標達成');"),
]

# ---- 해설 구조 (2.2) ----
T['js/player.js'] += [
    ('<div class="qtr"><span class="lbl">질문</span>${h(q.trans)}</div>', '<div class="qtr"><span class="lbl">設問</span>${h(q.trans)}</div>'),
    ("sec('정답 이유',", "sec('正解の理由',"),
    ("out += sec('해석',", "out += sec('訳',"),
    ("sec(q.type === 'insert' ? '삽입 문장 해석' : '빈칸 문장 해석',", "sec(q.type === 'insert' ? '挿入文の訳' : '空所の文の訳',"),
    ("sec('근거 문장',", "sec('根拠の文',"),
    ('data-act="scrollEv">지문에서 보기</button>', 'data-act="scrollEv">本文で見る</button>'),
    ('<div class="lbl">선택지</div><ul class="traps">', '<div class="lbl">選択肢</div><ul class="traps">'),
    ("toast('이 지문에는 강조할 문장이 없습니다.');", "toast('この文書には強調する文がありません。');"),
]

# ---- 지문 해석 (2.3) ----
T['js/player.js'] += [
    ("${trOn ? '해석 숨기기' : '해석 보기'}", "${trOn ? '訳を隠す' : '訳を表示'}"),
    ('data-act="ptransGo">지문 전체 해석 보기</button>', 'data-act="ptransGo">本文全体の訳を見る</button>'),
    ('세트의 마지막 문제까지 풀면 지문 전체 해석이 열립니다.', 'セットの最後の問題まで解くと、本文全体の訳が表示されます。'),
]

HANGUL = re.compile(r'[가-힣]')


def strip_comments(src, ext):
    if ext == '.css':
        return re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    if ext == '.js':
        out = []
        for line in src.split('\n'):
            s = line.strip()
            if s.startswith('//'):
                continue
            line = re.sub(r'\s//\s.*$', '', line)
            line = re.sub(r'/\*[^*]*\*/', '', line)
            out.append(line)
        return '\n'.join(out)
    return src


def copy_from_korean():
    for name in ('index.html', 'manifest.webmanifest'):
        shutil.copy2(SRC / name, ROOT / name)
    for d in ('css', 'js', 'icons'):
        shutil.rmtree(ROOT / d, ignore_errors=True)
        shutil.copytree(SRC / d, ROOT / d)


def main():
    copy_from_korean()
    fail = False
    for rel, pairs in T.items():
        p = ROOT / rel
        src = p.read_text(encoding='utf-8')
        for old, new in pairs:
            if old not in src:
                print(f'[없음] {rel}: {old[:70]}')
                fail = True
                continue
            src = src.replace(old, new)
        p.write_text(src, encoding='utf-8')
    # schema.js 검사 메시지는 개발용(콘솔·테스트)이라 남긴다
    for p in sorted(ROOT.rglob('*')):
        if p.suffix not in ('.js', '.html', '.css', '.webmanifest') or p.name in ('schema.js', 'sw.js'):
            continue
        body = strip_comments(p.read_text(encoding='utf-8'), p.suffix)
        for i, line in enumerate(body.split('\n'), 1):
            if HANGUL.search(line) and 'console.warn' not in line:
                print(f'[한글 남음] {p.relative_to(ROOT)}: {line.strip()[:100]}')
                fail = True
    sys.exit(1 if fail else 0)


main()
