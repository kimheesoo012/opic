// 마지막 인사와 식구들의 후일담
import { EPILOGUE } from './ja/misc.js';

const has = (s, f) => s.flags[f] !== undefined;

// 마지막 인사 대사 전체 (루비 생성 도구가 이 목록을 읽는다)
export const FW = {
  f0: ['okami', '{roshi}がね、[生前]よく言ってたのよ。「あの犬は[礼儀]を知っておる」って。', '{roshi}님이 살아 계실 때 자주 말씀하셨어. 「그 개는 예의를 안다」고.'],
  f1: ['roshi', '{N}。……よく[務]めた。[礼]。', '{N}. ……잘 해냈다. 예.'],
  f2: ['roshi', '[静]かな犬だった。……[道場]が少し[広]くなるな。', '조용한 개였다. ……도장이 조금 넓어지겠구나.'],
  f3: ['shihan', 'お前がいたから、この道場は[続]いた。[本当]だぞ。', '네가 있었기에 이 도장은 이어졌다. 정말이야.'],
  f4: ['shihan', '[毎日]、[稽古]を見ててくれてありがとうな。', '매일 연습을 지켜봐 줘서 고마웠다.'],
  f5: ['okami', 'うちに来た日、ずっと私の足元から離れなかったよね。……あの日から、ずっと一緒だったね。', '우리 집에 온 날, 계속 내 발치에서 안 떨어졌었지. ……그날부터 쭉 같이였네.'],
  f5b: ['okami', 'また防具をつけ始めた頃、いつも垂れの上で待っててくれたよね。……あれ、本当に嬉しかったのよ。', '다시 호구를 입기 시작했을 때, 늘 다레 위에서 기다려 줬지. ……그거 정말 기뻤어.'],
  f6: ['okami', 'ありがとう、{N}。あなたは[最高]の道場犬だったよ。', '고마워, {N}. 너는 최고의 도장 개였어.'],
  f7: ['kid', 'あの[夜]、一緒に寝てくれたこと、[一生][忘]れない。', '그날 밤 같이 자 준 거, 평생 안 잊을게.'],
  f8: ['kid', '[泣き虫]だった{I}の[涙]、いつも[拭]いてくれたよね。', '울보였던 내 눈물, 늘 닦아 줬었지.'],
  f9: ['kid', '{N}、[大好]きだよ。ずっと。', '{N}, 정말 좋아해. 계속.'],
  f10: ['worker', '僕の[防具]の[匂]い、そんなに好きだった？　……ありがとうな。', '내 호구 냄새가 그렇게 좋았어? ……고마웠다.'],
  f11: ['worker', '[仕事]で[疲]れた日も、お前の[顔]見たら[元気]が出たよ。', '일로 지친 날에도 네 얼굴 보면 힘이 났어.'],
  f12: ['elder', 'あの[句]、[覚]えてる？　「春の[床]　[短]き[足]の　[行き来]かな」。……ありがとうね。', '그 하이쿠, 기억나? 「봄날의 마루 / 짧은 다리가 / 오가는구나」. ……고마웠어.'],
  f13: ['elder', 'また[会]いましょうね。[向こう]で[待]っててちょうだい。', '또 만나요. 저쪽에서 기다려 줘요.'],
  f14: ['kor', '[韓国]から[言]わせてね。コマウォ、{N}。……[韓国語]で「ありがとう」って[意味]だよ。', '한국에서 말할게. 고마워, {N}. ……한국어로 「ありがとう」라는 뜻이야.'],
  f15: ['kor', '{N}のおかげで、ここが私の[居場所]になったんだよ。コマウォ。', '{N} 덕분에 여기가 내 자리가 됐어. 고마워.'],
  f16: ['kor', 'ありがとうございました。……[最後]まで、[敬語]でごめんね。', '감사했습니다. ……끝까지 존댓말이라 미안해.'],
  f17: ['iincho', '作戦名「また会おう」。……[以上]だ。', '작전명 「또 만나자」. ……이상이다.'],
  f18: ['iincho', 'わたくしの[宿敵]よ、[安]らかに[眠]れ。', '나의 숙적이여, 편히 잠들어라.'],
};

export function farewellLines(s) {
  const L = [];
  const b = s.bond;
  if (has(s, 'roshi_gone')) {
    L.push(FW.f0);
  } else if (b.roshi >= 50) {
    L.push(FW.f1);
  } else {
    L.push(FW.f2);
  }
  if (b.shihan >= 50) L.push(FW.f3);
  else L.push(FW.f4);
  if (has(s, 'o_tare')) L.push(FW.f5b);
  else if (has(s, 'arrive_clung')) L.push(FW.f5);
  else L.push(FW.f6);
  if (has(s, 'slept_before_match')) L.push(FW.f7);
  else if (has(s, 'kid_licked') || has(s, 'kid_tenugui')) L.push(FW.f8);
  else L.push(FW.f9);
  if (has(s, 'w_bogu_smell')) L.push(FW.f10);
  else L.push(FW.f11);
  if (has(s, 'e_haiku')) L.push(FW.f12);
  else L.push(FW.f13);
  if (has(s, 'kor_left')) L.push(FW.f14);
  else if (b.kor >= 45) L.push(FW.f15);
  else L.push(FW.f16);
  if (has(s, 'i_final_done')) L.push(FW.f17);
  else if (s.iinchoMet) L.push(FW.f18);
  return L;
}

// 후일담 키: 깃발에 따라 고른다. 문장은 ja/misc.js의 EPILOGUE에 [한국어, 일본어]로 있다.
function epilogueKey(s, role) {
  switch (role) {
    case 'roshi':
      if (has(s, 'roshi_gone')) return has(s, 'roshi_last_partner') ? 'roshi_gone_partner' : 'roshi_gone';
      if (has(s, 'roshi_retired')) return 'roshi_retired';
      return 'roshi';
    case 'shihan':
      if (has(s, 'shihan_8dan')) return 'shihan_8dan';
      if (has(s, 'shihan_8dan_try')) return 'shihan_8dan_try';
      return 'shihan';
    case 'okami':
      if (has(s, 'dojo_saved')) return 'dojo_saved';
      if (has(s, 'dojo_moved')) return 'dojo_moved';
      if (has(s, 'dojo_kominkan')) return 'dojo_kominkan';
      return 'okami';
    case 'kid':
      if (has(s, 'kid_cycle') || has(s, 'kid_coach')) return 'kid_coach';
      if (has(s, 'kid_continue')) return 'kid_continue';
      return 'kid';
    case 'worker':
      if (has(s, 'w_5dan')) return 'w_5dan';
      if (has(s, 'w_4dan')) return 'w_4dan';
      return 'worker';
    case 'elder':
      if (has(s, 'e_3dan')) return 'e_3dan';
      if (has(s, 'e_2dan')) return 'e_2dan';
      if (has(s, 'e_shodan')) return 'e_shodan';
      return 'elder';
    case 'kor':
      if (has(s, 'kor_left')) return 'kor_left';
      if (has(s, 'kor_4dan')) return 'kor_4dan';
      if (has(s, 'kor_3dan')) return 'kor_3dan';
      return 'kor';
    default:
      return null;
  }
}

export function castEpilogue(s, role, ja = false) {
  const k = epilogueKey(s, role);
  return k ? EPILOGUE[k][ja ? 1 : 0] : '';
}
