// 진행 속도 모델. UI와 테스트가 같은 함수를 쓴다 (테스트는 이 값으로 한 판의 소요 시간을 계산한다).
import { plainKo } from './text.js';

export const SPEEDS = [1, 2, 4, 8, 16];

// 1배속 기준 한 계절의 기본 흐름 시간(이벤트 시간 제외)
export const SEASON_MS = 10500;
// 계절이 시작되고 첫 이벤트가 뜰 때까지
export const FIRST_EVENT_MS = 900;
// 오토가 고른 선택지를 잠깐 보여 주는 시간
export const AUTO_PICK_MS = 1500;
// 고비의 한마디를 오토가 고를 때까지
export const AUTO_WORD_MS = 2600;

export function readMs(chars) {
  return Math.min(5500, 1300 + chars * 22);
}
export function seasonMs(speed) {
  return SEASON_MS / speed;
}
// 오토일 때 이벤트(선택 전)를 보여 주는 시간
export function eventShowMs(view) {
  if (!view) return AUTO_PICK_MS;
  return view.mini ? AUTO_PICK_MS : AUTO_PICK_MS + Math.min(2200, plainKo(view.text || '').length * 12);
}
// 오토일 때 결과를 보여 주는 시간
export function resultShowMs(res) {
  const chars = plainKo(res.res || '').length + res.lines.reduce((a, l) => a + l[1].length, 0);
  return readMs(chars) + (res.clear || res.foil ? 1200 : 0);
}
