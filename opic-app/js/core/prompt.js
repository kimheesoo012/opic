/* AI 첨삭용 복사 텍스트 — 특정 AI 서비스에 묶이지 않는 일반 문장 */
(function (root) {
  'use strict';

  const TEMPLATE = [
    '당신은 영어 OPIc 말하기 코치입니다. 학습자의 현재 수준은 IM1이며, 목표는 {{target_level}}입니다. 공식 등급 판정이 아니라 연습을 위한 피드백을 주세요.',
    '1. 질문에 충분히 답했는지 평가해 주세요.',
    '2. 문법 오류와 부자연스러운 표현을 고쳐 주세요. 원래 말하려던 의미와 개인 경험은 유지해 주세요.',
    '3. 배경, 구체적인 경험, 감정, 결과가 자연스럽게 이어지는지 확인해 주세요.',
    '4. 원어민이 일상에서 쓰는 자연스러운 표현을 제안하되, 지나치게 어려운 단어나 외우기 힘든 문장은 피해 주세요.',
    '5. 가장 중요한 개선점 3개만 알려 주세요.',
    '6. 학습자 수준보다 조금 높은 자연스러운 개선 답변을 써 주세요.',
    '7. 다음 녹음에서 꼭 써 볼 표현 3개를 골라 주세요.',
    '설명은 한국어로 해 주세요.',
    '[질문] {{question}}',
    '[학습자 답변] {{transcript}}',
    '[답변 시간] {{duration}}'
  ].join('\n');

  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m}분 ${s}초` : `${s}초`;
  }

  function buildCoachPrompt(o) {
    const transcript = String(o.transcript || '').trim() || '(받아쓴 글 없음 — 녹음만 있음)';
    return TEMPLATE
      .replace('{{target_level}}', o.targetLevel || 'IH')
      .replace('{{question}}', String(o.question || '').trim())
      .replace('{{transcript}}', transcript)
      .replace('{{duration}}', fmtDuration(o.durationSec));
  }

  /* 첨삭 결과에서 「다음에 써 볼 표현」을 붙여 넣었을 때 줄 단위로 정리 */
  function parseExpressions(text) {
    return String(text || '').split(/\r?\n/)
      .map(s => s.replace(/^\s*(?:[-*•·]|\d+[.)]|[①②③④⑤])\s*/, '').replace(/^["“'‘]|["”'’]$/g, '').trim())
      .filter(s => s && /[a-zA-Z]/.test(s))
      .slice(0, 12);
  }

  const api = { TEMPLATE, buildCoachPrompt, parseExpressions, fmtDuration };
  root.OPIC = root.OPIC || {};
  root.OPIC.prompt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
