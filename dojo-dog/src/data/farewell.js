// 마지막 인사와 식구들의 후일담
const has = (s, f) => s.flags[f] !== undefined;

// 마지막 인사 대사 전체 (루비 생성 도구가 이 목록을 읽는다)
export const FW = {
  f0: ['okami', '{roshi}がね、[生前]よく言ってたのよ。「あの犬は[礼儀]を知っておる」って。', '{roshi}님이 살아 계실 때 자주 말씀하셨어. 「그 개는 예의를 안다」고.'],
  f1: ['roshi', '{N}。……よく[務]めた。[礼]。', '{N}. ……잘 해냈다. 예.'],
  f2: ['roshi', '[静]かな犬だった。……[道場]が少し[広]くなるな。', '조용한 개였다. ……도장이 조금 넓어지겠구나.'],
  f3: ['shihan', 'お前がいたから、この道場は[続]いた。[本当]だぞ。', '네가 있었기에 이 도장은 이어졌다. 정말이야.'],
  f4: ['shihan', '[毎日]、[稽古]を見ててくれてありがとうな。', '매일 연습을 지켜봐 줘서 고마웠다.'],
  f5: ['okami', 'うちに来てくれてありがとう。……毎晩、[帳簿]の[横]で[寝]てたの、ずっと[覚]えてるからね。', '우리 집에 와 줘서 고마워. ……매일 밤 장부 옆에서 자던 거, 계속 기억할게.'],
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
  if (has(s, 'okami_ledger')) L.push(FW.f5);
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

export function castEpilogue(s, role) {
  switch (role) {
    case 'roshi':
      if (has(s, 'roshi_gone')) return has(s, 'roshi_last_partner') ? '마지막 겨울을 {N|과} 함께 보내고, 조용히 세상을 떠났다.' : '도장을 제자에게 맡기고 조용히 세상을 떠났다.';
      if (has(s, 'roshi_retired')) return '은퇴한 뒤에도 가끔 도장 구석에 앉아 연습을 지켜본다.';
      return '오늘도 도장 맨 안쪽에 앉아 있다.';
    case 'shihan':
      if (has(s, 'shihan_8dan')) return '여러 번의 도전 끝에 8단에 합격했다.';
      if (has(s, 'shihan_8dan_try')) return '8단 심사는 아직 통과하지 못했다. 「다음에 또」라고 웃는다.';
      return '도장을 지키며 아이들을 가르치고 있다.';
    case 'okami':
      if (has(s, 'dojo_saved')) return '상점가의 도움으로 낡은 도장을 고쳐 지켜 냈다.';
      if (has(s, 'dojo_moved')) return '도장을 옮겨 새 간판을 걸었다. 이름은 그대로다.';
      if (has(s, 'dojo_kominkan')) return '도장 건물은 사라졌지만, 공민관에서 연습은 계속된다.';
      return '도장 살림을 꾸려 가고 있다.';
    case 'kid':
      if (has(s, 'kid_cycle') || has(s, 'kid_coach')) return '주말마다 아이들을 가르친다. 언젠가 이 도장의 사범이 될 것이다.';
      if (has(s, 'kid_continue')) return '대학에서 검도를 계속하고 있다.';
      return '어른이 되었다. 가끔 도장에 얼굴을 비춘다.';
    case 'worker':
      if (has(s, 'w_5dan')) return '5단. 이제는 아이와 함께 연습에 온다.';
      if (has(s, 'w_4dan')) return '4단. 일과 가족과 검도 사이에서 균형을 잡고 있다.';
      return '오늘도 넥타이를 풀며 연습에 뛰어온다.';
    case 'elder':
      if (has(s, 'e_3dan')) return '75세에 3단에 합격했다. 도장 최고의 노력가.';
      if (has(s, 'e_2dan')) return '2단. 연습 뒤에는 늘 단어장을 펼친 누군가에게 일본어를 가르친다.';
      if (has(s, 'e_shodan')) return '초단. 「인생은 지금부터」가 입버릇이다.';
      return '오늘도 足さばき부터 차근차근.';
    case 'kor':
      if (has(s, 'kor_left')) return '한국으로 돌아가 그곳의 도장에서 검도를 계속한다. 해마다 연하장이 온다.';
      if (has(s, 'kor_4dan')) return '일본에 남아 4단이 되었다. 이제는 새로 온 외국인 수련생을 돌본다.';
      if (has(s, 'kor_3dan')) return '일본에 남아 3단이 되었다. 일본어 필기 답안은 도장에서 제일 잘 쓴다.';
      return '일본에서 검도를 계속하고 있다.';
    default:
      return '';
  }
}
