// 마지막 인사와 식구들의 후일담
import { EPILOGUE } from './ja/misc.js';

const has = (s, f) => s.flags[f] !== undefined;

// 마지막 인사 대사 전체 (루비 생성 도구가 이 목록을 읽는다)
export const FW = {
  f0: ['okami', '{roshi}がね、[最後]まで「{N}は[元気]か」って[聞]いてたのよ。', '{roshi}님이 마지막까지 「{N|은} 잘 있나」 하고 물으셨어.'],
  f1: ['roshi', '{N}。……よく[務]めたね。[礼]。', '{N}. ……수고 많았구나. 예.'],
  f2: ['roshi', 'お[前]がいないと、[道場]が[広]すぎるな。', '네가 없으니 도장이 너무 넓구나.'],
  f3: ['shihan', 'お前がいたから、この道場は[続]いた。[本当]だぞ。', '네가 있어서 이 도장이 버텼어. 진짜야.'],
  f4: ['shihan', '[毎日]、[稽古]を[見]に[来]てたな。……ありがとな。', '매일 연습 보러 왔었지. ……고맙다.'],
  f5: ['okami', 'うちに[来]た日、ずっと[私]の[足元]から[離]れなかったよね。……[結局]、[最後]までそうだったね。', '처음 온 날, 내 발치에서 한시도 안 떨어졌지. ……결국 끝까지 그랬네.'],
  f5b: ['okami', 'また[防具]をつけ[始]めた[頃]、いつも[私]の[名札]の[上]で[待]っててくれたよね。', '다시 호구를 입기 시작했을 때, 늘 내 이름표 위에서 기다려 줬지.'],
  f6: ['okami', 'ありがとう、{N}。[最高]の道場犬だったよ。', '고마워, {N}. 최고의 도장 개였어.'],
  f7: ['kid', '[予選]の[前]の[夜]、[一緒]に[寝]てくれたよね。……[布団]、[半分]とられたけど。', '예선 전날 밤에 같이 자 줬잖아. ……이불은 반이나 뺏겼지만.'],
  f8: ['kid', '[泣き虫]だった{I}の[涙]、いつも[拭]いてくれたよね。', '울보였던 내 눈물, 늘 닦아 줬잖아.'],
  f9: ['kid', '{N}、[大好]きだよ。ずっと。', '{N}, 정말 좋아해. 앞으로도 쭉.'],
  f10: ['worker', '[初]めて[会]った[日]、[僕]のおにぎり[狙]ってたよな。……ありがとうな。', '처음 만난 날, 내 주먹밥 노렸었지. ……고마웠다.'],
  f11: ['worker', '[残業]の[後]でも、お前の[顔]を[見]ると、まあいっかって[思]えたよ。', '야근하고 와도 네 얼굴 보면, 뭐 됐다 싶었어.'],
  f12: ['elder', 'あの[句]、[覚]えてる？　「春の[床]　[短]き[足]の　[行き来]かな」。……ありがとうね。', '그 하이쿠, 기억나? 「봄날의 마루 / 짧은 다리가 / 오가는구나」. ……고마웠다.'],
  f13: ['elder', 'また[会]いましょうね。[向こう]で[待]っててちょうだい。', '또 만나자꾸나. 먼저 가서 기다려 주렴.'],
  f14: ['kor', '[韓国]から、[電話]で[言]わせてね。……コマウォ、{N}。', '한국에서 전화로 말할게. ……고마워, {N}.'],
  f15: ['kor', '{N}のおかげで、ここが[私]の[居場所]になったんだよ。コマウォ。', '{N} 덕분에 여기가 내 자리가 됐어. 고마워.'],
  f16: ['kor', 'ありがとうございました。……[最後]まで[敬語]でごめんね。', '감사했습니다. ……끝까지 존댓말이라 미안해.'],
  f17: ['iincho', '作戦名「また会おう」。……[以上]だ。', '작전명 「또 만나자」. ……이상이다.'],
  f18: ['iincho', 'わたくしの[宿敵]よ、[安]らかに[眠]れ。', '나의 숙적이여, 편히 잠들어라.'],

  // ── 노사범: 그 견생에 있었던 일에 따라 (떠난 뒤에는 사범·살림이 대신 말한다)
  r_partner: ['shihan', '先生の[最後]の[冬]、ずっと[隣]にいてくれたな。……あれは[俺]にはできなかった。[本当]に。', '선생님 마지막 겨울에 내내 옆에 있어 줬지. ……그건 나는 못 했던 일이야. 정말로.'],
  r_imo: ['okami', '[先生]の[煮干]し、まだ[引き出し]に[残]ってるのよ。……[結局]、あなたが[全部][食]べるはずだったのにね。', '선생님 멸치, 아직 서랍에 남아 있어. ……결국 네가 다 먹을 거였는데.'],
  r_chair: ['shihan', '先生の[椅子]の[下]、お前の[定位置]だったな。……[今日]は[俺]が[座]っとく。[誰]も[使]わないように。', '선생님 의자 밑, 네 지정석이었지. ……오늘은 내가 앉아 있을게. 아무도 못 쓰게.'],
  r_shoe: ['okami', '[玄関]の、先生の[靴]の[場所]。……[隣]、あなたの[分]も[空]けておくからね。', '현관에 선생님 신발 자리 있잖아. ……그 옆에 네 자리도 비워 둘게.'],
  r_walk: ['shihan', '先生、お前と[歩]くときだけは[杖]をゆっくりついてた。……[向こう]でも[歩幅]、[合]わせてもらえよ。', '선생님은 너랑 걸을 때만 지팡이를 천천히 짚으셨어. ……거기서도 보폭 맞춰 달라고 해.'],
  r_bark: ['shihan', '先生との最後の[稽古]、お前の[一声]で[終]わったんだよな。……あれだけは[今]でも、[負]けた[気]がしない。', '선생님과의 마지막 연습, 네 한 마디로 끝났지. ……그것만은 지금도 진 기분이 안 들어.'],
  r_story: ['roshi', '「[続]きはまた[今度]」と[言]ったな。……[覚]えているよ。[向こう]で、ゆっくり[聞]かせてやろう。', '「나머지는 다음에」 했었지. ……기억하고 있다. 거기서 천천히 들려주마.'],
  r_suburi: ['roshi', 'この[膝]で[竹刀]を[振]らせたのは、[後]にも[先]にもお[前]だけだ。……よく[務]めたね。', '이 무릎으로 죽도를 휘두르게 한 건 전에도 후에도 너뿐이다. ……수고 많았구나.'],
  r_waited: ['roshi', '[入院]のとき、[毎日][門]の[前]にいたそうだな。……[今度]は、わしが[待]つ[番]かね。', '입원했을 때 날마다 대문 앞에 와 있었다지. ……이번엔 내가 기다릴 차례구나.'],

  // ── 사범
  s_8dan: ['shihan', '[八段]に[受]かった日、[真]っ[先]に[報告]したのはお前だ。……あくびされたけどな。[忘]れてないぞ。', '8단에 붙던 날, 제일 먼저 알린 건 너였어. ……하품을 하긴 했지만. 안 잊었다.'],
  s_8try: ['shihan', '八段、[結局][間]に[合]わなかったな。……[次]に[受]かったら、[玄関]のお前の[写真]に[報告]する。[約束]だ。', '8단, 결국 못 보여 줬네. ……다음에 붙으면 현관에 걸린 네 사진한테 보고할게. 약속이다.'],
  s_keys: ['shihan', 'あの[夜]、[鍵]を[持]ってきただろ。……[明日]も道場は[開]ける。お前に[言]われた〘とおり|どおり〙だ。', '그날 밤 열쇠 물어다 줬잖아. ……내일도 도장 문은 연다. 네가 시킨 대로.'],
  s_floor: ['shihan', '[新]しい[床]の[最初]の[足跡]、お前のだ。……[消]さなくてよかったよ。', '새 마루에 처음 찍힌 발자국, 네 거다. ……안 지우길 잘했어.'],
  s_foreman: ['shihan', '[工事]のあいだ、[毎日][現場]を[見張]ってたな。……[床]のすみの[足跡]、あれはずっとそのままだ。', '공사하는 동안 날마다 현장을 지켰지. ……마루 구석의 발자국, 그건 계속 그대로 둔다.'],
  s_pingpong: ['shihan', '[卓球台]をたたむ[音]で[吠]えるやつがいないと、[稽古]の[始]まりが[分]からなくなるな。……[困]ったもんだ。', '탁구대 접는 소리에 짖는 녀석이 없으면, 연습 시작을 모르겠는데. ……곤란하네.'],
  s_night: ['shihan', 'あの夜の[話]、[誰]にも[言]ってないよな。……[分]かってる。ありがとな。', '그날 밤 얘기, 아무한테도 안 했지. ……알아. 고맙다.'],
  s_kiai: ['shihan', 'お前の[声]より[小]さい声は、[今]でも「もう[一回]」だ。……[子]どもたちには[内緒]だぞ。', '네 목소리보다 작은 소리는 지금도 「한 번 더」야. ……애들한테는 비밀이다.'],
  s_succeed: ['shihan', '先生から道場を[継]いだ日、お前もそこにいた。……[見届]け[人]だったんだよ、お前は。', '선생님한테 도장을 물려받던 날, 너도 거기 있었지. ……넌 증인이었어.'],

  // ── 늦깎이 어르신
  e_tsuba: ['elder', '[主人]の[鍔]を[見]つけてくれて、ありがとうね。……[向こう]で主人に[会]ったら、[自慢]しておいてちょうだい。', '우리 영감 코등이를 찾아 줘서 고마웠다. ……거기서 영감을 만나거든 자랑 좀 해 주렴.'],
  e_3dan: ['elder', '[三段]の[審査]の日、[外]で[待]っててくれたわね。……[合格証]、[本当]はあなたに[一番]に[見]せたかったのよ。', '3단 심사 날, 밖에서 기다려 줬지. ……합격증, 사실은 너한테 제일 먼저 보여 주고 싶었단다.'],
  e_paw: ['elder', '「[右足]よ」って[教]えてくれたのは、あなた。……[今]でも[順番]の[最後]で、あなたの[顔]を[思]い[出]すの。', '「오른발」이라고 가르쳐 준 건 너였지. ……지금도 순서 마지막에서 네 얼굴이 떠오른단다.'],
  e_stairs: ['elder', '[階段]の[下]で、いつも[待]っててくれたわね。……おやつ[目当]てだとしても、うれしかったのよ。', '계단 밑에서 늘 기다려 줬지. ……간식 때문이었대도, 기뻤단다.'],
  e_card: ['elder', '「[拝見]」のカード、まだ[取]ってあるのよ。[歯型]つきでね。……あれで{kor}さんは[一度]も[間違]えなかったわ。', '「拝見」 카드, 아직 가지고 있단다. 이빨 자국째로. ……그 덕에 {kor|은} 한 번도 안 틀렸어.'],
  e_step: ['elder', '[足]が[四本]あるのはずるい、って[言]ったわね。……[今度]は、ゆっくり[歩]いてちょうだい。', '다리가 넷이라 반칙이라고 했었지. ……이번엔 천천히 걸어 주렴.'],
  e_ink: ['elder', 'あの[紙]の[隅]の、[黒]い[鼻]。……あれ、あなたの[肖像画]よ。[一生]、はがさないわ。', '그 종이 구석의 까만 코. ……그거 네 초상화란다. 평생 안 뗄 거야.'],

  // ── 委員長
  i_rival: ['iincho', 'わたくしの[作戦]をこれほど[邪魔]したのは、[貴様]だけだ。……[誇]っていいぞ。[宿敵]よ。', '내 작전을 이렇게까지 방해한 건 네 녀석뿐이다. ……자랑스러워해도 좋다. 숙적이여.'],
  i_bribed: ['iincho', '[部下]一[号]、[任務][終了]。……[経費]は、[惜]しくなかった。[一円]も。', '부하 1호, 임무 종료. ……경비는 아깝지 않았다. 일 엔도.'],
  i_fish: ['iincho', '[管轄第一号]は、まだ[泳]いでいる。……[貴様]の[分]まで[長生]きさせる。[命令]だ。', '관할 제1호는 아직 헤엄치고 있다. ……네 몫까지 오래 살게 하겠다. 명령이다.'],
  i_sweep: ['iincho', '[夜明]けの[商店街]を、[一緒]に[掃]いたな。……あれは作戦ではなかった。[一応]、[言]っておく。', '새벽 상점가를 같이 쓸었지. ……그건 작전이 아니었다. 일단 말해 둔다.'],
  i_four: ['iincho', '[四票]のうち[二票]は、貴様の[手柄]だった。……[礼]は[言]わん。言わんが……ありがとう。', '네 표 중 두 표는 네 녀석 공이었다. ……고맙다는 말은 안 한다. 안 하지만…… 고맙다.'],
  i_kite: ['iincho', '[凧]の[件]は、[借]りにしておく。……[向こう]で[返]す。[利子]つきで。', '연 사건은 빚으로 해 두지. ……거기서 갚겠다. 이자까지 쳐서.'],
  i_noenemy: ['iincho', '……[敵]がいないと、作戦が[立]てられん。[困]ったものだ。', '……적이 없으면 작전을 세울 수가 없다. 난처하군.'],
};

// 견생마다 다른 줄을 고르기 위한 시드 해시 (저장이 필요 없고, 같은 견생에서는 늘 같은 줄이 나온다)
function seedPick(s, key, n) {
  let h = 2166136261;
  for (const c of String(s.seed) + '|' + key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % n;
}

// 사람마다 「이 견생에서 있었던 일」에 맞는 줄을 모아, 그중 하나를 시드로 고른다.
//  - 셋째 칸이 true인 「큰 일」(노사범의 마지막 겨울, 8단 합격, 남편의 코등이 …)이 있으면 그중에서 고른다
//  - 맞는 줄이 없으면 예전의 기본 줄(fallback)
export function farewellLines(s) {
  const L = [];
  const b = s.bond;
  const f = (key, list, fallback) => {
    const hit = list.filter(([cond]) => cond);
    const top = hit.filter(([, , strong]) => strong);
    const pool = top.length ? top : hit;
    if (pool.length) L.push(pool[seedPick(s, key, pool.length)][1]);
    else L.push(fallback);
  };
  if (has(s, 'roshi_gone')) {
    f('roshi', [
      [has(s, 'roshi_last_partner'), FW.r_partner, true],
      [has(s, 'r_imo'), FW.r_imo],
      [has(s, 'r_chair') && b.shihan >= 50, FW.r_chair],
      [has(s, 'r_shoe_spot'), FW.r_shoe],
      [has(s, 'r_walk_home'), FW.r_walk],
      [has(s, 'r_tachiai_bark'), FW.r_bark],
    ], FW.f0);
  } else {
    f('roshi', [
      [has(s, 'r_story') && !has(s, 'r_seated_suburi'), FW.r_story],
      [has(s, 'r_seated_suburi'), FW.r_suburi],
      [has(s, 'r_waited'), FW.r_waited],
    ], b.roshi >= 50 ? FW.f1 : FW.f2);
  }
  f('shihan', [
    [has(s, 'shihan_8dan'), FW.s_8dan, true],
    [has(s, 's_keys'), FW.s_keys],
    [has(s, 'o_first_step'), FW.s_floor],
    [has(s, 'o_foreman'), FW.s_foreman],
    [has(s, 'o_pingpong'), FW.s_pingpong],
    [has(s, 's_night_talk'), FW.s_night],
    [has(s, 'r_tachiai_watch') && has(s, 'shihan_succeeded'), FW.s_succeed],
    [has(s, 's_bark_kiai'), FW.s_kiai],
    [has(s, 'shihan_8dan_try') && !has(s, 'shihan_8dan') && b.shihan >= 50, FW.s_8try],
    [b.shihan >= 50, FW.f3],
  ], FW.f4);
  if (has(s, 'o_tare')) L.push(FW.f5b);
  else if (has(s, 'arrive_clung')) L.push(FW.f5);
  else L.push(FW.f6);
  if (has(s, 'slept_before_match')) L.push(FW.f7);
  else if (has(s, 'kid_licked') || has(s, 'kid_tenugui')) L.push(FW.f8);
  else L.push(FW.f9);
  if (has(s, 'w_bogu_smell')) L.push(FW.f10);
  else L.push(FW.f11);
  f('elder', [
    [has(s, 'tsuba_returned'), FW.e_tsuba, true],
    [has(s, 'e_3dan'), FW.e_3dan],
    [has(s, 'e_paw_hint'), FW.e_paw],
    [has(s, 'e_card_stolen'), FW.e_card],
    [has(s, 'e_stairs_guard'), FW.e_stairs],
    [has(s, 'e_ink_nose'), FW.e_ink],
    [has(s, 'e_haiku'), FW.f12],
    [has(s, 'e_step_dog'), FW.e_step],
  ], FW.f13);
  if (has(s, 'kor_left')) L.push(FW.f14);
  else if (b.kor >= 45) L.push(FW.f15);
  else L.push(FW.f16);
  if (has(s, 'i_final_done')) {
    f('iincho', [
      [s.foiled >= 5, FW.i_rival],
      [has(s, 'i6_bribed'), FW.i_bribed],
      [has(s, 'i9_help'), FW.i_sweep],
      [has(s, 'i4_one'), FW.i_fish],
      [has(s, 'i8_four'), FW.i_four],
      [has(s, 'i7_help'), FW.i_kite],
      [true, FW.f17],
    ], FW.f17);
  } else if (s.iinchoMet) {
    f('iincho', [
      [s.foiled >= 5, FW.f18],
      [has(s, 'i6_bribed'), FW.i_bribed],
      [has(s, 'i4_one'), FW.i_fish],
    ], FW.i_noenemy);
  }
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
