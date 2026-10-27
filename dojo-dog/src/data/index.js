// 모든 이벤트 데이터를 모은다.
import core from './core_events.js';
import kid from './cast_kid.js';
import roshi from './cast_roshi.js';
import shihan from './cast_shihan.js';
import okami from './cast_okami.js';
import worker from './cast_worker.js';
import elder from './cast_elder.js';
import kor from './cast_kor.js';
import walk from './daily_walk.js';
import beside from './daily_beside.js';
import life from './daily_life.js';
import life2 from './daily_life2.js';
import kendo from './kendo.js';
import subs from './subs.js';
import iincho from './iincho.js';
import chains from './chains.js';

export const ALL_EVENTS = [
  ...core, ...kid, ...roshi, ...shihan, ...okami, ...worker, ...elder, ...kor,
  ...walk, ...beside, ...life, ...life2, ...kendo, ...subs, ...iincho, ...chains,
];
export { SUB_TITLES } from './subs.js';
