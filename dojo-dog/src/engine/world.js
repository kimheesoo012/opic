// 세계 설정: 성격, 털, 지역, 도장, 인물. 모두 오리지널 설정.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
export const SEASON_JA = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

export const STAGES = [
  { id: 'puppy', ko: '강아지', ja: '子犬', from: 0 },
  { id: 'young', ko: '청년견', ja: '若犬', from: 1 },
  { id: 'adult', ko: '성견', ja: '成犬', from: 3 },
  { id: 'senior', ko: '노견', ja: '老犬', from: 10 },
];
export function stageOf(ageYears) {
  let st = STAGES[0];
  for (const x of STAGES) if (ageYears >= x.from) st = x;
  return st.id;
}

export const STAT_KEYS = ['hap', 'hea', 'back', 'soc', 'brave', 'mis'];
export const STAT_KO = { hap: '행복', hea: '건강', back: '허리 건강', soc: '사회성', brave: '용감함', mis: '장난기' };

// 자동 선택 성향: 선택지 태그별 가중치
export const PERSONALITIES = [
  { id: 'nonbiri', ja: 'のんびり屋', ko: '느긋한 성격', desc: '서두르는 법이 없다. 낮잠이 특기.', st: { hap: 8, brave: -4, mis: -4 }, tags: { lazy: 3, calm: 2.2, food: 1.4, sweet: 1.2 } },
  { id: 'amaenbo', ja: '甘えん坊', ko: '응석받이', desc: '사람 무릎이 세상에서 제일 좋은 자리.', st: { soc: 6, hap: 4, brave: -6 }, tags: { sweet: 3.2, social: 1.6, calm: 1.2 } },
  { id: 'koukishin', ja: '好奇心旺盛', ko: '호기심 왕성', desc: '처음 보는 것은 일단 냄새부터.', st: { brave: 8, mis: 6, back: -3 }, tags: { brave: 2.6, play: 2.2, social: 1.2 } },
  { id: 'ganko', ja: '頑固者', ko: '고집쟁이', desc: '싫은 건 싫다. 하지만 지킬 것은 지킨다.', st: { brave: 6, soc: -6 }, tags: { guard: 3, calm: 1.6, lazy: 1.2 } },
  { id: 'bibiri', ja: 'ビビり', ko: '겁쟁이', desc: '竹刀 소리에 매번 놀란다. 그래도 도장이 좋다.', st: { brave: -12, back: 4, hap: -2 }, tags: { calm: 2.4, sweet: 2.4, brave: 0.4 } },
  { id: 'ochoshi', ja: 'お調子者', ko: '촐랑이', desc: '모두가 웃으면 더 신이 난다.', st: { mis: 12, soc: 4, back: -4 }, tags: { play: 3, social: 2.2, brave: 1.2 } },
  { id: 'kuishinbo', ja: '食いしん坊', ko: '먹보', desc: '간식 봉지 소리는 세 방 너머에서도 듣는다.', st: { hap: 4, hea: -4, mis: 4 }, tags: { food: 3.4, sweet: 1.4, play: 1.2 } },
];

export const COATS = [
  { id: 'black_tan', ja: 'ブラックタン', ko: '블랙 탄', base: '#2b2420', tan: '#b8743a', spot: null },
  { id: 'red', ja: 'レッド', ko: '레드', base: '#b5582b', tan: '#c96d3a', spot: null },
  { id: 'choco_tan', ja: 'チョコレートタン', ko: '초콜릿 탄', base: '#5a3622', tan: '#c08a55', spot: null },
  { id: 'cream', ja: 'クリーム', ko: '크림', base: '#e3c191', tan: '#efd3a8', spot: null },
  { id: 'dapple', ja: 'シルバーダップル', ko: '실버 대플', base: '#3a3634', tan: '#b07a45', spot: '#a9a6a3' },
  { id: 'wildboar', ja: 'ワイルドボア', ko: '와일드 보어', base: '#6b5646', tan: '#9b7a5c', spot: null },
];
export const HAIRS = [
  { id: 'smooth', ja: 'スムース', ko: '스무스(단모)' },
  { id: 'long', ja: 'ロング', ko: '롱(장모)' },
  { id: 'wire', ja: 'ワイヤー', ko: '와이어(강모)' },
];

export const DOG_NAMES = [
  ['コテツ', '코테츠'], ['ムサシ', '무사시'], ['あずき', '아즈키'], ['きなこ', '키나코'], ['ちくわ', '치쿠와'],
  ['モナカ', '모나카'], ['ダイズ', '다이즈'], ['こむぎ', '코무기'], ['ゴンタ', '곤타'], ['おもち', '오모치'],
  ['ハナ', '하나'], ['マメ', '마메'], ['ポン太', '폰타'], ['ゴマ', '고마'], ['サブレ', '사브레'], ['テツ', '테츠'],
];

export const REGIONS = [
  { id: 'tokyo', ja: '東京・下町', ko: '도쿄 시타마치(下町)', town: 'よもぎ町', townKo: '요모기초', street: 'よもぎ銀座', streetKo: '요모기 긴자 상점가', shrine: 'よもぎ稲荷', shrineKo: '요모기 이나리 신사', river: 'すみれ川', riverKo: '스미레강', snow: 0.15, desc: '좁은 골목, 오래된 銭湯, 저녁이면 고로케 냄새.' },
  { id: 'osaka', ja: '大阪', ko: '오사카', town: 'ひさご町', townKo: '히사고초', street: 'ひさご通り', streetKo: '히사고도리 상점가', shrine: 'ひさご天神', shrineKo: '히사고 덴진 신사', river: 'なにわ川', riverKo: '나니와강', snow: 0.08, desc: '아케이드 상점가와 다코야키 굽는 소리. 모두 말이 빠르다.' },
  { id: 'fukuoka', ja: '福岡', ko: '후쿠오카', town: 'あかね浜', townKo: '아카네하마', street: 'あかね浜通り', streetKo: '아카네하마 상점가', shrine: 'あかね八幡', shrineKo: '아카네 하치만 신사', river: 'あかね川', riverKo: '아카네강', snow: 0.1, desc: '바닷바람과 屋台의 불빛. 사람들이 정이 많다.' },
  { id: 'hokkaido', ja: '北海道', ko: '홋카이도', town: 'しらかば町', townKo: '시라카바초', street: 'しらかば通り', streetKo: '시라카바 상점가', shrine: 'しらかば神社', shrineKo: '시라카바 신사', river: 'しらかば川', riverKo: '시라카바강', snow: 0.9, desc: '겨울이면 다리가 짧은 개에게는 눈이 벽이다.' },
  { id: 'inaka', ja: '山あいの里', ko: '산골 마을', town: 'こもれび村', townKo: '코모레비 마을', street: 'こもれび通り', streetKo: '코모레비 거리', shrine: '鎮守の森', shrineKo: '마을 숲 신사', river: 'せせらぎ川', riverKo: '세세라기강', snow: 0.5, desc: '논두렁과 산 그림자. 도장은 마을 공민관 옆에 있다.' },
];

export const DOJOS = [
  { id: 'old', ko: '엄격한 노사범의 낡은 도장', name: '灯心館', nameKo: '도신칸', desc: '마룻바닥이 삐걱거리는 목조 도장. 와시오 선생이 50년 넘게 지켜 왔다.', st: { brave: 4 }, bg: '鷲尾先生の一番弟子', bgKo: '와시오 선생의 첫 제자' },
  { id: 'kids', ko: '아이들로 북적이는 동네 도장', name: 'こども剣友会', nameKo: '어린이 검우회', desc: '저녁 6시가 되면 아이들 목소리로 지붕이 들썩인다.', st: { soc: 6 }, bg: '元・小学校の先生', bgKo: '전직 초등학교 교사' },
  { id: 'pro', ko: '경찰·실업팀 출신 사범의 도장', name: '坂上剣道場', nameKo: '사카가미 검도장', desc: '현경 특련(特練) 출신 사범이 연 도장. 연습은 짧고 굵다.', st: { hea: 6 }, bg: '元・県警の特練員', bgKo: '전직 현경 특별훈련원' },
];

// 인물. 역할(role)에 사람이 배정되고, 세대가 바뀌면 다른 사람이 같은 역할을 맡는다.
// call: 일본어 기본 호칭 / g: 이름 / s: 성 / c: 친근한 호칭 / ko: 한국어 해설용 이름 / I: 1인칭
export const PEOPLE = {
  washio: { ks: '와시오', s: '鷲尾', g: '源一郎', call: '鷲尾先生', c: '鷲尾先生', ko: '와시오 선생', I: 'わし', age: 78, dan: '八段', desc: '노사범. 말수가 적고 竹刀 끝이 무섭게 정확하다.' },
  makoto: { ks: '사카가미', s: '坂上', g: '誠', call: '坂上先生', c: '誠さん', ko: '사카가미 사범', I: '俺', age: 42, dan: '七段', desc: '사범. 도장 경영과 지도를 맡고 있다.' },
  chiharu: { s: '坂上', g: '千春', call: '千春さん', c: '千春さん', ko: '치하루 씨', I: '私', age: 40, dan: '三段', desc: '사범의 배우자. 도장 사무와 회계 담당, 개 담당.' },
  hinata: { ks: '모리카와', s: '森川', g: 'ひなた', call: 'ひなた', c: 'ひなたちゃん', ko: '히나타', I: 'わたし', age: 9, dan: '無級', desc: '초등학교 3학년. 자주 운다.' },
  miura: { s: '三浦', g: '健司', call: '三浦さん', c: '三浦さん', ko: '미우라 씨', I: '僕', age: 34, dan: '三段', desc: '영업직 회사원. 평일 밤 稽古에 넥타이를 풀며 뛰어온다.' },
  fumi: { s: '松尾', g: 'フミ', call: 'フミさん', c: 'フミさん', ko: '후미 씨', I: '私', age: 67, dan: '無級', desc: '65세에 검도를 시작했다. 전직 국어 교사.' },
  sojin: { s: 'ハン', g: 'ソジン', call: 'ソジンさん', c: 'ソジンさん', ko: '서진', I: '私', age: 27, dan: '無級', desc: '한국에서 온 회사원. 일본에 와서 검도를 시작했다. N2는 따 두었고 N1을 노린다.' },
  iincho: { s: '', g: '', call: '委員長', c: '委員長', ko: '위원장', I: 'わたくし', age: 0, dan: '', desc: '옆 건물에 사는 정체불명의 사람. 이 동네를 「접수」하려 한다.' },
  // 다음 세대용
  youta: { ks: '오노데라', s: '小野寺', g: '陽太', call: '陽太', c: '陽太くん', ko: '요타', I: 'ぼく', age: 9, dan: '無級', desc: '초등학교 3학년. 자주 운다.' },
  minori: { ks: '미즈노', s: '水野', g: 'みのり', call: 'みのり', c: 'みのりちゃん', ko: '미노리', I: 'わたし', age: 9, dan: '無級', desc: '초등학교 3학년. 자주 운다.' },
  kouhei: { s: '中村', g: '浩平', call: '中村さん', c: '中村さん', ko: '나카무라 씨', I: '僕', age: 31, dan: '三段', desc: '간호사. 야근 다음 날에도 稽古에 온다.' },
  takumi: { s: '野村', g: '拓海', call: '野村さん', c: '野村さん', ko: '노무라 씨', I: '僕', age: 33, dan: '三段', desc: '버스 운전사. 시간표처럼 정확하게 稽古에 온다.' },
  kiyo: { s: '中島', g: 'キヨ', call: 'キヨさん', c: 'キヨさん', ko: '키요 씨', I: '私', age: 68, dan: '無級', desc: '정년 퇴직한 목수. 66세에 검도를 시작했다.' },
  setsuko: { s: '大塚', g: 'セツ子', call: 'セツ子さん', c: 'セツ子さん', ko: '세츠코 씨', I: '私', age: 66, dan: '無級', desc: '은퇴한 미용사. 66세에 검도를 시작했다.' },
  dabin: { s: 'ユン', g: 'ダビン', call: 'ダビンさん', c: 'ダビンさん', ko: '다빈', I: '私', age: 26, dan: '無級', desc: '한국에서 온 대학원생. 일본에서 검도를 시작했다.' },
  haneul: { s: 'チェ', g: 'ハヌル', call: 'ハヌルさん', c: 'ハヌルさん', ko: '하늘', I: '私', age: 28, dan: '無級', desc: '한국에서 온 요리사. 일본에서 검도를 시작했다.' },
  yuki: { s: '朝倉', g: 'ユキ', call: 'ユキさん', c: 'ユキさん', ko: '유키 씨', I: '私', age: 38, dan: '二段', desc: '도장 사무 담당. 개 담당.' },
};

// 다음 세대에서 역할을 이어받을 때의 호칭
export const PROMOTE = {
  makoto: { roshi: { call: '坂上先生', c: '坂上先生', ko: '사카가미 선생' } },
  hinata: { shihan: { call: '森川先生', c: 'ひなた先生', ko: '모리카와 사범', I: '私' }, roshi: { call: '森川先生', c: '森川先生', ko: '모리카와 선생', I: '私' } },
  youta: { shihan: { call: '小野寺先生', c: '陽太先生', ko: '오노데라 사범', I: '俺' }, roshi: { call: '小野寺先生', c: '小野寺先生', ko: '오노데라 선생', I: '俺' } },
  minori: { shihan: { call: '水野先生', c: 'みのり先生', ko: '미즈노 사범', I: '私' }, roshi: { call: '水野先生', c: '水野先生', ko: '미즈노 선생', I: '私' } },
};

export const ROLES = ['roshi', 'shihan', 'okami', 'kid', 'worker', 'elder', 'kor'];
export const ROLE_KO = { roshi: '노사범', shihan: '사범', okami: '도장 살림', kid: '초등부', worker: '사회인 수련생', elder: '늦깎이 어르신', kor: '한국인 수련생', iincho: '이웃' };

export const GEN1 = { roshi: 'washio', shihan: 'makoto', okami: 'chiharu', kid: 'hinata', worker: 'miura', elder: 'fumi', kor: 'sojin' };
const POOLS = { kid: ['youta', 'minori', 'hinata'], worker: ['takumi', 'kouhei', 'miura'], elder: ['setsuko', 'kiyo', 'fumi'], kor: ['dabin', 'haneul', 'sojin'], okami: ['yuki', 'chiharu'] };

// 이어지는 세계: 사범 → 노사범, 아이 → 사범. 나머지는 새 얼굴.
export function nextGeneration(prev, gen) {
  const staying = new Set([prev.shihan, prev.kid, prev.okami]);
  const take = (role) => {
    const free = POOLS[role].filter((p) => !staying.has(p) && p !== prev[role]);
    return free.length ? free[0] : POOLS[role][0];
  };
  return {
    roshi: prev.shihan,
    shihan: prev.kid,
    okami: gen === 2 ? prev.okami : take('okami'),
    kid: take('kid'),
    worker: take('worker'),
    elder: take('elder'),
    kor: take('kor'),
  };
}

export function personFor(cast, role) {
  const id = cast[role];
  const p = { id, ...PEOPLE[id] };
  const promo = PROMOTE[id] && PROMOTE[id][role];
  return promo ? { ...p, ...promo } : p;
}
