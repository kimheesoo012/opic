// 화면 모듈들이 공유하는 실행 컨텍스트(앱 시작 시 채워진다)
export const C = {
  bank: null, store: null, state: null, tts: null, rng: null, version: '', dataVersion: '',
  route: 'home', lastSession: null, trainUnit: null,
  go: () => {}, render: () => {}, save: () => {}, snapshotScore: () => {}, estimateNow: () => null,
};
