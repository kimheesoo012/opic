/* Background Survey 항목 · Self Assessment 단계
   기존 시뮬레이터(index.html)의 SV / SA_LEVELS / 기본 세트를 그대로 가져와 정리했다.
   각 선택지 id는 문제은행(questions.js)의 주제 id로 연결된다(SURVEY_TOPIC_MAP). */
(function (root) {
  'use strict';

  const SURVEY = {
    job: [
      ['biz', '사업 / 회사'], ['homework', '재택근무 / 재택사업'], ['teacher', '교사 / 교육자'],
      ['military', '군 복무'], ['nojob', '일 경험 없음']
    ],
    student: [
      ['yes', '예 — 현재 수강 중입니다'], ['no_recent', '아니오 — 수강 후 5년 미만입니다'],
      ['no_old', '아니오 — 수강 후 5년 이상 지났습니다']
    ],
    home: [
      ['alone', '개인주택이나 아파트에 홀로 거주'], ['roommate', '친구나 룸메이트와 함께 주택이나 아파트에 거주'],
      ['family', '가족(배우자/자녀/기타 가족 일원)과 함께 주택이나 아파트에 거주'], ['dorm', '학교 기숙사'],
      ['barracks', '군대 막사']
    ],
    leisure: [
      ['movie', '영화 보기'], ['performance', '공연 보기'], ['concert', '콘서트 보기'], ['museum', '박물관 가기'],
      ['park', '공원 가기'], ['camping', '캠핑하기'], ['beach', '해변 가기'], ['sports_watch', '스포츠 관람'],
      ['bar', '술집/바에 가기'], ['cafe', '카페/커피전문점에 가기'], ['game', '게임하기'],
      ['sns', 'SNS에 글 올리기'], ['news', '뉴스를 보거나 듣기'], ['drive', '차로 드라이브하기'],
      ['shopping', '쇼핑하기'], ['tv', 'TV 보기']
    ],
    hobby: [
      ['music', '음악 감상하기'], ['instrument', '악기 연주하기'], ['sing', '혼자 노래 부르거나 합창하기'],
      ['dance', '춤추기'], ['writing', '글쓰기(편지, 단문, 시 등)'], ['drawing', '그림 그리기'],
      ['cooking', '요리하기'], ['pet', '애완동물 기르기'], ['reading', '독서'], ['photo', '사진 촬영하기']
    ],
    sport: [
      ['basketball', '농구'], ['baseball', '야구/소프트볼'], ['soccer', '축구'], ['golf', '골프'],
      ['tennis', '테니스'], ['badminton', '배드민턴'], ['pingpong', '탁구'], ['swimming', '수영'],
      ['bike', '자전거'], ['ski', '스키/스노보드'], ['jogging', '조깅'], ['walking', '걷기'],
      ['yoga', '요가'], ['hiking', '하이킹/트레킹'], ['gym', '헬스'], ['nosport', '운동을 전혀 하지 않음']
    ],
    travel: [
      ['biztrip_dom', '국내 출장'], ['biztrip_intl', '해외 출장'], ['homevacation', '집에서 보내는 휴가'],
      ['domestic', '국내 여행'], ['overseas', '해외 여행']
    ]
  };

  /* 설문 선택지 → 문제은행 주제 */
  const SURVEY_TOPIC_MAP = {
    movie: 'movie', performance: 'performance', concert: 'concert', museum: 'museum', park: 'park',
    camping: 'camping', beach: 'beach', sports_watch: 'sports_watch', bar: 'bar', cafe: 'cafe', game: 'game',
    sns: 'sns', news: 'news', drive: 'drive', shopping: 'shopping', tv: 'tv',
    music: 'music', instrument: 'instrument', sing: 'sing', dance: 'dance', writing: 'writing',
    drawing: 'drawing', cooking: 'cooking', pet: 'pet', reading: 'reading', photo: 'photo',
    basketball: 'sport', baseball: 'sport', soccer: 'sport', golf: 'sport', tennis: 'sport',
    badminton: 'sport', pingpong: 'sport', ski: 'sport', swimming: 'swimming', bike: 'bike',
    jogging: 'jogging', walking: 'walking', yoga: 'yoga', hiking: 'hiking', gym: 'gym',
    biztrip_dom: 'biztrip', biztrip_intl: 'biztrip', homevacation: 'homevacation',
    domestic: 'domestic', overseas: 'overseas'
  };

  /* Self Assessment 6단계 (기존 시뮬레이터 설명을 다듬음). 1·2단계 12문항, 3~6단계 15문항 */
  const SA_LEVELS = [
    '10단어 이하의 단어로 말할 수 있습니다.',
    '기본적인 물건, 색깔, 요일, 음식, 옷, 숫자 등을 말할 수 있습니다. 항상 완벽한 문장을 말하지는 못하고, 간단한 질문도 하기 어렵습니다.',
    '나 자신, 직장, 친한 사람, 장소, 일상에 대한 기본 정보를 간단한 문장으로 전달할 수 있습니다. 간단한 질문을 할 수 있습니다.',
    '나 자신, 일상, 일/학교, 취미에 대해 간단한 대화를 할 수 있습니다. 친숙한 주제에 대해 간단한 문장들을 쉽게 만들 수 있고, 원하는 질문도 할 수 있습니다.',
    '친숙한 주제와 가정, 일/학교, 개인적·사회적 관심사에 대해 대화할 수 있습니다. 일어난 일, 일어나고 있는 일, 일어날 일을 문장을 연결해 말할 수 있고, 필요하면 설명도 할 수 있습니다. 예상치 못한 상황에도 임기응변으로 대처할 수 있습니다.',
    '일/학교, 개인적인 관심사, 시사 문제에 대한 대화나 토론에 자신 있게 참여할 수 있습니다. 대부분의 주제에 대해 정확하고 자세한 어휘로 말할 수 있습니다.'
  ];
  const SA_SAMPLES = [
    'Apple. Dog. Monday. Blue.',
    'I like pizza. My shirt is blue. Today is Friday.',
    'I live in Busan. I am a university student. My house is small but comfortable.',
    'I usually go to a cafe on weekends, and I like to study English there with my friends.',
    'Last summer, I traveled to Jeju Island with my family, and even though our flight was delayed, we still managed to enjoy the whole trip.',
    'In my opinion, remote work has changed the way companies measure productivity, and that raises real questions about work-life balance.'
  ];

  /* 기존 시뮬레이터의 「기본 세트」 */
  const SEED_PRESETS = [
    { name: '기본 세트 (기존 시뮬레이터)', job: 'nojob', student: 'no_old', home: 'alone',
      picks: ['movie', 'performance', 'concert', 'park', 'beach', 'bar', 'cafe', 'music', 'photo', 'nosport', 'domestic', 'homevacation'] },
    { name: '대학생 세트', job: 'nojob', student: 'yes', home: 'family',
      picks: ['movie', 'cafe', 'park', 'shopping', 'music', 'cooking', 'walking', 'jogging', 'gym', 'domestic', 'overseas', 'homevacation'] }
  ];

  const api = { SURVEY, SURVEY_TOPIC_MAP, SA_LEVELS, SA_SAMPLES, SEED_PRESETS };
  root.OPIC = root.OPIC || {};
  root.OPIC.survey = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
