// JLPT N2 대비 어휘 DB (오리지널 예문). 주제별 파일을 모은다.
// 한 줄 형식: [표기, 읽기, 품사, 뜻, 예문, 예문 해석, { syn 유의어[], ant 반의어[], conf 헷갈리는 말[], gram 관련 문법 키[], note 메모 }]
// 품사: n 명사 / sn する명사 / v 동사 / a い형용사 / na な형용사 / adv 부사 / exp 표현 / kata 외래어
// 수준은 공식 목록이 없으므로 모두 「N2 추정」이다. 학습 상태·복습일은 이 데이터가 아니라 복습 기록(SRS)에 있다.
// 게임 어휘/시험 어휘 구분은 데이터가 아니라 빌드 결과(대사에 실제로 나오는가)로 정한다 → study.js vocabSet
import abstract from './vocab_abstract.js';
import society from './vocab_society.js';
import work from './vocab_work.js';
import life from './vocab_life.js';
import verbs from './vocab_verbs.js';
import adverbs from './vocab_adverbs.js';
import kata from './vocab_kata.js';
import confuse from './vocab_confuse.js';

export const N2X_FILES = { abstract, society, work, life, verbs, adverbs, kata, confuse };
export const N2X_TAG_KO = { abstract: '추상·사고', society: '사회·뉴스', work: '일·학교·절차', life: '생활·관계·감정', verbs: '동사·복합동사', adverbs: '부사·형용사', kata: '외래어', confuse: '헷갈리는 말' };

const POS = new Set(['n', 'sn', 'v', 'a', 'na', 'adv', 'exp', 'kata']);
export const N2X = {};
for (const [tag, rows] of Object.entries(N2X_FILES)) {
  for (const row of rows) {
    const [key, r, pos, m, ex, exk, extra = {}] = row;
    if (N2X[key] || !POS.has(pos)) continue; // 검사 도구(tools/n2-check.mjs)가 따로 알려 준다
    N2X[key] = { r, m, ex, exk, lv: 'N2', pos: pos === 'sn' ? 'n' : pos === 'kata' ? 'n' : pos, sn: pos === 'sn', tag, x: 1, ...extra };
  }
}
