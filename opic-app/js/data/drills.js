/* 훈련용 데이터: 막혔을 때 이어 가는 표현, 키워드 3개 말하기, 과거 경험 틀, 자가 체크, 등급 체크리스트 */
(function (root) {
  'use strict';

  /* 말이 막혔을 때 시간을 벌고 이어 가는 표현 */
  const STALL_PHRASES = [
    { en: 'Let me think...', ko: '음, 생각해 볼게요…', use: '질문을 듣고 바로 떠오르지 않을 때' },
    { en: "That's a good question.", ko: '좋은 질문이네요.', use: '첫마디로 시간을 벌 때' },
    { en: "Hmm, I've never really thought about that, but...", ko: '그건 생각해 본 적이 없는데요…', use: '처음 보는 주제일 때' },
    { en: 'Well, how should I put it...', ko: '어떻게 말해야 할까…', use: '표현이 생각나지 않을 때' },
    { en: 'What I mean is...', ko: '제 말은…', use: '방금 한 말을 다시 정리할 때' },
    { en: 'In other words...', ko: '다시 말하면…', use: '쉬운 말로 바꿔 말할 때' },
    { en: "I'm not sure what it's called in English, but it's like...", ko: '영어로 뭐라고 하는지 모르겠지만…', use: '단어가 생각나지 않을 때 설명으로 돌아가기' },
    { en: 'Anyway, the point is...', ko: '아무튼 요점은…', use: '이야기가 길어졌을 때 핵심으로 돌아오기' },
    { en: 'Where was I? Oh, right.', ko: '어디까지 했죠? 아, 맞다.', use: '말하다 흐름을 놓쳤을 때' },
    { en: 'To be honest,...', ko: '솔직히 말하면…', use: '의견을 말하기 시작할 때' },
    { en: "I guess I'd say...", ko: '아마 이렇게 말할 수 있을 것 같아요…', use: '확신이 없을 때 답을 시작하기' },
    { en: "It's hard to say exactly, but...", ko: '정확히 말하긴 어렵지만…', use: '숫자·날짜가 기억나지 않을 때' },
    { en: "I can't remember exactly when it was, but...", ko: '정확히 언제였는지 기억은 안 나지만…', use: '과거 경험에서 날짜가 막힐 때' },
    { en: 'Let me give you an example.', ko: '예를 하나 들어 볼게요.', use: '추상적인 말 다음에 구체적인 예로 넘어갈 때' },
    { en: 'So, to sum up,...', ko: '정리하자면…', use: '답변을 마무리할 때' },
    { en: "That's pretty much it.", ko: '대략 그 정도예요.', use: '답변을 자연스럽게 끝낼 때' }
  ];

  /* 키워드 3개만 보고 말하기 */
  const KEYWORD_SETS = [
    { kw: ['last summer', 'beach', 'lost my phone'], hint: '과거 경험' },
    { kw: ['first day', 'university', 'nervous'], hint: '과거 경험' },
    { kw: ['favorite cafe', 'quiet', 'window seat'], hint: '묘사' },
    { kw: ['weekend', 'sleep in', 'meet friends'], hint: '루틴' },
    { kw: ['subway', 'rush hour', 'late for class'], hint: '과거 경험' },
    { kw: ['birthday', 'surprise', 'my friends'], hint: '과거 경험' },
    { kw: ['online shopping', 'wrong size', 'refund'], hint: '과거 경험' },
    { kw: ['smartphone', 'every morning', 'alarm'], hint: '루틴' },
    { kw: ['childhood', 'neighborhood', 'changed'], hint: '비교' },
    { kw: ['heavy rain', 'canceled', 'stayed home'], hint: '과거 경험' },
    { kw: ['part-time job', 'customer', 'mistake'], hint: '과거 경험' },
    { kw: ['English class', 'teacher', 'improve'], hint: '루틴·경험' },
    { kw: ['trip', 'train', 'missed'], hint: '과거 경험' },
    { kw: ['movie theater', 'popcorn', 'disappointed'], hint: '과거 경험' },
    { kw: ['cooking', 'recipe', 'burned'], hint: '과거 경험' },
    { kw: ['park', 'evening walk', 'relax'], hint: '루틴' },
    { kw: ['family dinner', 'holiday', 'grandparents'], hint: '과거 경험' },
    { kw: ['concert', 'tickets', 'sold out'], hint: '과거 경험' },
    { kw: ['social media', 'too much time', 'compare'], hint: '이슈' },
    { kw: ['cafes now', 'cafes before', 'study'], hint: '비교' },
    { kw: ['hometown', 'mountains', 'fresh air'], hint: '묘사' },
    { kw: ['gym', 'sore', 'gave up'], hint: '과거 경험' },
    { kw: ['laptop', 'broke', 'assignment'], hint: '과거 경험' },
    { kw: ['friend', 'argument', 'made up'], hint: '과거 경험' }
  ];

  /* 과거 경험 이야기 틀: 배경 → 일어난 일 → 감정 → 결과 */
  const STORY_STEPS = [
    { id: 'bg', ko: '배경', guide: '언제, 어디서, 누구와? 왜 거기 있었나?',
      phrases: ['It was about two years ago, when I was...', 'Last summer, I went to ... with ...', 'Back then, I was ...'] },
    { id: 'event', ko: '일어난 일', guide: '무슨 일이 순서대로 일어났나? (처음 → 그다음 → 갑자기)',
      phrases: ['At first, ...', 'Then, all of a sudden, ...', 'After that, ...', 'The problem was that ...'] },
    { id: 'feeling', ko: '감정', guide: '그때 기분이 어땠나? 왜 그랬나?',
      phrases: ['I was so nervous because ...', 'Honestly, I felt a bit embarrassed.', "I couldn't believe it."] },
    { id: 'result', ko: '결과·느낀 점', guide: '어떻게 끝났나? 지금 돌아보면 어떤 의미인가?',
      phrases: ['In the end, ...', 'Luckily, it all worked out.', 'Since then, I always ...', 'Looking back, I learned that ...'] }
  ];

  /* 자가 체크(유형별) — 「자가 평가」로 따로 표시 */
  const SELF_CHECK_COMMON = [
    { id: 'answered', t: '질문이 물은 것에 실제로 답했다' },
    { id: 'example', t: '구체적인 예시나 디테일(이름·장소·숫자·장면)이 있다' },
    { id: 'ending', t: '마무리 문장으로 자연스럽게 끝냈다' }
  ];
  const SELF_CHECK_BY_TYPE = {
    past: [
      { id: 'bg', t: '배경(언제·어디서·누구와)을 말했다' },
      { id: 'event', t: '일어난 일을 순서대로 말했다' },
      { id: 'feeling', t: '그때의 감정을 말했다' },
      { id: 'result', t: '결과나 느낀 점으로 끝냈다' },
      { id: 'pasttense', t: '과거 시제를 끝까지 유지했다' }
    ],
    describe: [
      { id: 'what', t: '무엇인지·어디 있는지 먼저 말했다' },
      { id: 'detail', t: '모습·분위기를 2가지 이상 묘사했다' },
      { id: 'why', t: '내가 좋아하는(중요하게 여기는) 이유를 말했다' }
    ],
    routine: [
      { id: 'freq', t: '얼마나 자주·언제 하는지 말했다' },
      { id: 'order', t: '순서대로(first, then, after that) 설명했다' },
      { id: 'why', t: '그렇게 하는 이유를 덧붙였다' }
    ],
    compare: [
      { id: 'two', t: '두 대상을 모두 설명했다' },
      { id: 'diff', t: '차이점을 2가지 이상 말했다' },
      { id: 'opinion', t: '내 생각이나 선호를 이유와 함께 말했다' }
    ],
    rp_ask: [
      { id: 'open', t: '인사와 상황 설명으로 시작했다' },
      { id: 'q3', t: '질문을 3개 이상 했다' },
      { id: 'varied', t: '질문 형태를 다양하게 했다 (Do you…? / Could you…? / What… ?)' },
      { id: 'close', t: '감사 인사로 마무리했다' }
    ],
    rp_solve: [
      { id: 'situation', t: '문제 상황을 상대에게 분명히 설명했다' },
      { id: 'alt', t: '해결책을 2~3개 제시했다' },
      { id: 'polite', t: '정중한 표현을 썼다 (I was wondering if… / Would it be possible…)' }
    ],
    issue: [
      { id: 'opinion', t: '내 의견을 먼저 분명히 말했다' },
      { id: 'reason', t: '근거를 2가지 이상 말했다' },
      { id: 'example', t: '주변이나 사회의 예를 들었다' }
    ],
    intro: [
      { id: 'basic', t: '이름·학교/일·사는 곳 등 기본 정보를 말했다' },
      { id: 'more', t: '취미나 성격 등 나를 보여 주는 내용을 덧붙였다' }
    ]
  };

  /* 등급 체크리스트 — ACTFL 말하기 지침의 등급 설명을 참고한 연습용 기준(공식 채점 아님) */
  const LEVEL_CHECKLIST = [
    { level: 'IM (Intermediate Mid)', items: [
      '친숙한 주제(나, 일상, 취미)에 대해 문장으로 답한다',
      '간단한 문장을 여러 개 이어서 말할 수 있다',
      '간단한 질문을 만들어 물어볼 수 있다',
      '머뭇거림·고쳐 말하기가 있어도 대화가 이어진다'
    ] },
    { level: 'IH (Intermediate High)', items: [
      '문장들을 연결어로 묶어 문단에 가까운 길이로 말한다',
      '과거·현재·미래를 오가며 이야기하려고 시도하고, 대부분 시제를 맞춘다',
      '과거 경험을 처음부터 끝까지 이야기로 풀어낸다 (가끔 흐름이 끊겨도 됨)',
      '예상하지 못한 질문·롤플레이 문제 상황에도 답을 이어 간다',
      '모르는 단어는 다른 말로 풀어서 설명한다'
    ] },
    { level: 'AL (Advanced Low)', items: [
      '문단 단위로 길고 짜임새 있게 말한다 (도입 → 전개 → 마무리)',
      '과거 경험을 시간 순서와 시제를 거의 일관되게 지키며 이야기한다',
      '묘사·비교에서 구체적인 디테일과 이유를 든다',
      '문제 상황 롤플레이에서 상황을 설명하고 대안을 제시한다',
      '사회적 주제에 대해서도 의견과 근거를 말하려고 시도한다',
      '실수가 있어도 원어민이 이해하는 데 큰 어려움이 없다'
    ] }
  ];

  /* 4지선다 오답 보충용 자연스러운 표현(노트가 적을 때만 사용) */
  const DISTRACTOR_POOL = [
    'I was really looking forward to it.', 'It took me a while to get used to it.', 'I ended up staying home.',
    'It was way more crowded than I expected.', 'I usually grab a coffee on the way.', 'I could barely keep my eyes open.',
    'It turned out to be a great decision.', "I'm not really into that kind of thing.", 'We ran out of time.',
    'It was a real eye-opener for me.', 'I had no idea what to do.', 'I try to go there at least once a week.',
    'It reminds me of my hometown.', 'I made a reservation in advance.', 'I was about to leave when it happened.',
    "It's within walking distance of my place.", 'I got stuck in traffic.', 'It was totally worth it.',
    'I tend to stay up late on weekends.', 'I had to call them back later.', 'They gave me a full refund.',
    "I've been meaning to try it.", 'It depends on my mood.', 'I felt a lot better afterwards.'
  ];

  /* 다시 녹음할 때 이번에 써 볼 기본 표현(노트·첨삭이 없을 때 보조 제안) */
  const DEFAULT_TARGETS = {
    past: ['It was about ... ago, when I was ...', 'All of a sudden, ...', 'Looking back, ...'],
    describe: ["It's located ...", 'What I like most about it is ...', 'It has a really cozy atmosphere.'],
    routine: ['I usually ..., and then ...', 'Once I get there, ...', "It's kind of my routine."],
    compare: ['Compared to ..., ...', 'The biggest difference is that ...', 'These days, ... whereas back then ...'],
    rp_ask: ['I was wondering if ...', 'Could you tell me ...?', 'Is there any chance ...?'],
    rp_solve: ["I'm afraid there's a problem with ...", 'Would it be possible to ...?', 'Another option would be ...'],
    issue: ['Personally, I think ...', 'One reason is that ...', 'For example, ...'],
    intro: ["I'm currently ...", 'In my free time, I ...', 'People say I am ...']
  };

  const api = { STALL_PHRASES, KEYWORD_SETS, STORY_STEPS, SELF_CHECK_COMMON, SELF_CHECK_BY_TYPE, LEVEL_CHECKLIST, DISTRACTOR_POOL, DEFAULT_TARGETS };
  root.OPIC = root.OPIC || {};
  root.OPIC.drills = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
