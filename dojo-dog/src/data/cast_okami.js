// 도장 살림(사범의 배우자): 체험회 → 稽古 복귀 → 건물 위기 → 모금 → 존속/이전/공민관 → 四段 → 앨범
const has = (s, f) => s.flags[f] !== undefined;

// 도장 위기의 결말 점수: 서브스토리, 체험회, 모금, 간판 사진, 委員長 저지, 사회성
export function dojoScore(s) {
  return (
    Math.min(5, s.subs.length) +
    (has(s, 'taiken_success') ? 2 : has(s, 'taiken_chase') ? 1 : 0) +
    (has(s, 'crowd_support') ? 2 : has(s, 'crowd_some') ? 1 : 0) +
    (has(s, 'o_sign_sit') ? 1 : 0) +
    (s.foiled >= 3 ? 1 : 0) +
    (s.st.soc >= 65 ? 1 : 0)
  );
}

export default [
  // o0 「밤 11시의 장부」는 뺐다(계산기 개그·적자 한탄이 반복되고 억지스러워서). 저장 데이터의 장 순서를 지키려고 빈 자리만 남긴다.
  { id: 'o0', cat: 'cast', who: 'okami', ch: 0, at: 0.5, req: () => false, skip: true, removed: true, title: '', lines: [], choices: [] },
  {
    id: 'o1', cat: 'cast', who: 'okami', ch: 1, at: 1.5, major: true,
    title: '무료 체험회',
    text: '봄의 「무료 체험회」. 전단지에는 {N}의 사진이 크게 실렸다. {okami}의 작전이다.',
    lines: [
      ['okami', '[看板犬]の[出番]よ、{N}。今日は子どもだけじゃなくて、お父さんお母さんも来るんだから。', '간판견 출동이야, {N}. 오늘은 아이들뿐 아니라 엄마 아빠도 오니까.'],
      ['@体験に来た親子', 'わあ、犬がいる道場なんですね。', '와, 개가 있는 도장이네요.'],
    ],
    choices: [
      { t: '현관에서 오는 아이마다 꼬리를 흔든다', tag: 'social',
        check: { st: 'soc', dc: 45,
          ok: { fx: { b_okami: 5, soc: 3 }, set: 'taiken_success', ach: ['okami', '체험회로 신입 회원 5명'], news: { okami: '체험회 성공. 신입 회원이 늘었다.' },
            res: '아이들이 줄을 섰다. 「개 만지려면 먼저 예부터」라는 {okami}의 규칙 덕분에, 모두 예쁘게 인사하는 법부터 배웠다.' },
          ng: { fx: { b_okami: 2 }, set: 'taiken_meh', ach: ['okami', '체험회 개최(신입 2명)'],
            res: '너무 반가운 나머지 달려들었다가, 꼬마 하나를 울리고 말았다. 그래도 두 명이 등록했다.' } } },
      { t: '체험용 죽도를 하나 물고 달아난다', tag: 'play', fx: { mis: 5, b_okami: 2 }, set: 'taiken_chase', ach: ['okami', '체험회 개최(신입 3명, 이유: 개가 웃겨서)'],
        res: '죽도를 문 닥스훈트와 그걸 쫓는 아이들. 체험회의 하이라이트는 그 술래잡기였다. 설문지 「좋았던 점」 칸에는 「개」라고만 적혀 있었다.' },
    ],
    brief: { res: '체험회가 열렸다고 한다.', set: 'taiken_meh', ach: ['okami', '체험회 개최'] },
  },
  {
    id: 'o2', cat: 'cast', who: 'okami', ch: 2, at: 3.0, kendo: true, deep: 30,
    title: '12년 만의 호구',
    text: '{okami|이} 창고에서 오래된 호구 상자를 꺼냈다. 12년 만이다.',
    lines: [
      ['okami', '[実]は私、[三段]なのよ。[腰]を[痛]めたり、[経営]が[忙]しかったりで、ずっと[離]れてたけど。', '사실 나 3단이야. 허리를 다치기도 하고 운영이 바쁘기도 해서 계속 떨어져 있었지만.'],
      ['okami', '……もう一回、やってみようかな。', '……한 번 더 해 볼까.'],
      ['shihan', '[待]ってたよ。', '기다렸어.'],
    ],
    choices: [
      { t: '호구 냄새를 킁킁 맡는다', tag: 'brave', fx: { b_okami: 4, brave: 1 }, set: 'o_bogu_sniff', ach: ['okami', '12년 만에 연습 복귀'], news: { okami: '12년 만에 연습에 복귀했다.' },
        res: '12년 묵은 냄새. {N|은} 재채기를 세 번 했다. {okami|은} 웃으며 머리 수건을 머리에 둘렀다.' },
      { t: '{okami}의 《垂》 위에 눕는다', tag: 'sweet', fx: { b_okami: 6 }, set: 'o_tare', ach: ['okami', '12년 만에 연습 복귀'], news: { okami: '12년 만에 연습에 복귀했다.' },
        res: '《垂》에 붙은 이름표 위에 정확히 엎드렸다. {okami|은} {N|을} 들어 올리며 이름표를 쓰다듬었다.' },
    ],
    brief: { res: '{okami|이} 12년 만에 연습을 다시 시작했다고 한다.', ach: ['okami', '12년 만에 연습 복귀'], news: { okami: '연습 복귀.' } },
  },
  {
    id: 'o3', cat: 'cast', who: 'okami', ch: 3, at: 4.0, major: true,
    title: '건물 주인의 편지',
    text: '도장 건물 주인에게서 편지가 왔다. 건물이 낡아 내진 기준에 맞지 않으니, 2년 안에 큰 공사를 하거나 나가 달라는 내용이었다. 공사비는 도장 1년 회비 수입의 다섯 배.',
    lines: [
      ['okami', 'どうしよう……。', '어떡하지…….'],
      ['shihan', '[閉]めるわけにはいかない。でも[金]はない。', '닫을 수는 없어. 하지만 돈이 없어.'],
      { if: (s) => s.flags.roshi_gone === undefined, l: [['roshi', '……[道場]は[建物]ではない。[人]だ。', '……도장은 건물이 아니다. 사람이다.']] },
    ],
    choices: [
      { t: '도장 간판 아래에 앉아 움직이지 않는다', tag: 'guard', fx: { brave: 3, b_shihan: 3 }, set: 'o_sign_sit',
        res: '한참을 앉아 있었다. 지나가던 고등학생이 그 모습을 사진으로 찍었다. 그 사진이 나중에 쓰이게 될 줄은 아무도 몰랐다.' },
      { t: '{okami} 옆에서 같이 한숨을 쉰다', tag: 'sweet', fx: { b_okami: 6, hap: -2 }, set: 'o_sigh',
        res: '"흐응" 하는 소리에 {okami|이} 웃음을 터뜨렸다.', lines: [['okami', 'あなたまで[溜息]？　……そうね、[落ち込]んでても[始]まらないわ。', '너까지 한숨이야? ……그래, 우울해한다고 뭐가 시작되진 않지.']] },
    ],
    brief: { res: '도장 건물이 낡아서 공사를 하거나 나가야 한다고 한다.' },
    onShow: { news: { okami: '도장 건물 문제로 고민 중.', shihan: '도장 건물 문제로 고민 중.' } },
  },
  {
    id: 'o4', cat: 'cast', who: 'okami', ch: 4, at: 5.0, major: true,
    title: '「도장을 지키는 모임」',
    text: '{okami|이} 상점가에 「도장을 지키는 모임」 전단지를 돌리러 간다. {N}도 따라나섰다.',
    lines: [
      { if: 'o_sign_sit', l: [['@八百屋の大将', 'この[写真]の犬、[看板]の下に[座]ってた子だろ？　[孫]が[見]せてくれたんだよ。', '이 사진 속 개, 간판 밑에 앉아 있던 애지? 손주가 보여 줬어.']] },
      ['okami', '[少]しでも[協力]していただけたら……。', '조금이라도 협력해 주시면…….'],
    ],
    choices: [
      { t: '가게마다 들어가 인사한다', tag: 'social',
        check: { st: 'soc', dc: 50,
          ok: { fx: { b_okami: 4, soc: 3 }, set: 'crowd_support', ach: ['okami', '상점가 모금 시작'],
            res: '생선 가게, 채소 가게, 목욕탕, 이자카야. 가게마다 모금함이 하나씩 놓였다. {N|이} 들어간 가게는 빠짐없이.' },
          ng: { fx: { b_okami: 2 }, set: 'crowd_some',
            res: '반쯤 돌았을 때 고양이를 쫓아가 버렸다. 그래도 모금함 세 개가 놓였다.' } } },
      { t: '전단지 뭉치를 물고 따라다닌다', tag: 'play', fx: { mis: 3, b_okami: 3 }, set: 'crowd_some',
        res: '침 묻은 전단지가 의외로 화제가 됐다. 「개가 직접 배달한 전단지」라며 사진을 찍는 사람도 있었다.' },
    ],
    brief: { res: '{okami|이} 상점가에 모금 전단지를 돌렸다고 한다.', set: 'crowd_some' },
  },
  {
    id: 'o5a', cat: 'cast', who: 'okami', ch: 5, at: 6.0, major: true, req: (s) => dojoScore(s) >= 6, skip: true,
    title: '모금함이 가득 찼다',
    text: '모금액이 목표에 닿았다. 상점가 사람들, 옛 제자들, 그리고 {S}의 단골들. 도장은 고쳐서 지키게 되었다.',
    lines: [
      ['okami', 'みんな、ありがとう……！', '모두들, 고마워요……!'],
      { if: 'fish_thief', l: [['@魚屋の大将', '{N}にはさんざん[魚]を……いや、なんでもねえ。[祝]いだ、[祝]い！', '{N}한테는 생선을 실컷……아니, 아무것도 아냐. 축하다, 축하!']] },
      { if: (s) => s.foiled >= 3, l: [['iincho', 'ふん。わたくしが[支配]する[町]に、道場の一つくらいあってもよかろう。', '흥. 내가 지배할 마을에 도장 하나쯤은 있어도 괜찮겠지.']] },
    ],
    choices: [
      { t: '공사 현장 감시 담당이 된다', tag: 'guard', fx: { brave: 2, b_shihan: 3 }, set: ['dojo_saved', 'o_foreman'], ach: ['okami', '모금으로 도장을 지켜 냄'], news: { okami: '도장 수리 완료. 마루가 새것처럼 반짝인다.', shihan: '수리한 도장에서 연습을 이어 간다.' },
        res: '석 달 동안 {N|은} 공사장 입구에 앉아 목수들을 감시했다. 마지막 날 목수 반장이 새 마루 한구석에 작은 발자국 모양을 새겨 주었다.' },
      { t: '모금함 옆에서 인사 담당을 한다', tag: 'social', fx: { soc: 3, b_okami: 4 }, set: ['dojo_saved', 'o_greeter'], ach: ['okami', '모금으로 도장을 지켜 냄'], news: { okami: '도장 수리 완료.', shihan: '수리한 도장에서 연습을 이어 간다.' },
        res: '모금함 옆 방석이 {N}의 자리가 되었다. 공사가 끝난 뒤 그 방석은 새 도장 현관에 그대로 놓였다.' },
    ],
  },
  {
    id: 'o5b', cat: 'cast', who: 'okami', ch: 6, at: 6.0, major: true, req: (s) => dojoScore(s) >= 3 && dojoScore(s) < 6 && s.flags.dojo_saved === undefined, skip: true,
    title: '새 간판',
    text: '모금은 목표의 절반에서 멈췄다. {shihan|과} {okami|은} 도장을 옮기기로 했다. 상점가 끝, 문을 닫은 옛 쌀가게 창고. 천장은 낮지만, 마루를 새로 깔 수 있다.',
    lines: [
      ['shihan', '[名前]はそのままだ。{D}は、ここで[続]ける。', '이름은 그대로다. {D|는} 여기서 이어 간다.'],
      ['okami', '[引っ越し]の前に、荷物を減らさないとね。[手伝]ってね、{N}。', '이사 전에 짐을 줄여야겠어. 도와줘, {N}.'],
    ],
    choices: [
      { t: '새 도장 마루에 제일 먼저 발자국을 찍는다', tag: 'brave', fx: { brave: 3, b_shihan: 3 }, set: ['dojo_moved', 'o_first_step'], ach: ['okami', '도장 이전, 새 간판'], news: { okami: '새 도장으로 이사. 이름은 그대로.', shihan: '새 도장에서 연습을 이어 간다.' },
        res: '니스가 덜 마른 마루에 짧은 발자국이 네 개 찍혔다. 아무도 지우지 않았다.' },
      { t: '옛 도장 마루를 마지막으로 한 바퀴 돈다', tag: 'calm', fx: { hap: 2, b_okami: 4 }, set: ['dojo_moved', 'o_last_lap'], ach: ['okami', '도장 이전, 새 간판'], news: { okami: '새 도장으로 이사. 이름은 그대로.', shihan: '새 도장에서 연습을 이어 간다.' },
        res: '삐걱이는 자리, 해가 드는 자리, 죽도 가방이 놓이던 자리. 한 바퀴를 다 돌자 {okami|이} 문을 잠갔다.' },
    ],
  },
  {
    id: 'o5c', cat: 'cast', who: 'okami', ch: 7, at: 6.0, major: true, req: (s) => s.flags.dojo_saved === undefined && s.flags.dojo_moved === undefined, skip: true,
    title: '공민관 체육실',
    text: '모금은 모자랐다. 도장 건물은 헐리고, 연습은 마을 공민관 체육실에서 이어 가기로 했다. 월요일과 목요일 저녁, 탁구대를 접어 벽에 세우고 나서야 연습이 시작된다.',
    lines: [
      ['shihan', '道場は[建物]じゃない。[人]だ。……先生がそう[言]ってた。', '도장은 건물이 아니야. 사람이지. ……선생님이 그렇게 말씀하셨어.'],
      ['okami', 'ありがたい〘ことに|ことに〙、[看板]は[体育室]の[入口]に[掛]けさせてもらえたのよ。', '고맙게도 간판은 체육실 입구에 걸게 해 줬어.'],
    ],
    choices: [
      { t: '체육실 입구 간판 아래에 자리를 잡는다', tag: 'guard', fx: { brave: 2, b_shihan: 4 }, set: ['dojo_kominkan', 'o_kominkan_guard'], ach: ['okami', '공민관에서 연습을 이어 감'], news: { okami: '공민관 체육실에서 연습을 이어 간다.', shihan: '공민관에서 지도한다.' },
        res: '공민관 관리인이 「개는 원래 안 되는데……」 하다가, 결국 {N} 전용 방석을 하나 갖다 놓았다.' },
      { t: '탁구대 접는 소리에 맞춰 짖는다', tag: 'play', fx: { mis: 3, b_okami: 4 }, set: ['dojo_kominkan', 'o_pingpong'], ach: ['okami', '공민관에서 연습을 이어 감'], news: { okami: '공민관 체육실에서 연습을 이어 간다.', shihan: '공민관에서 지도한다.' },
        res: '탁구대 접는 소리에 맞춰 짖는 게 {N}의 새 일이 됐다. 아이들은 그게 연습 시작 신호라고 믿게 되었다.' },
    ],
  },
  {
    id: 'o6', cat: 'cast', who: 'okami', ch: 8, at: 8.0, kendo: true, deep: 30,
    title: '{okami}의 4단 심사',
    text: '{okami|이} 4단 심사를 본다. 12년 쉬고 돌아온 뒤 다시 쌓은 시간이다.',
    lines: [['okami', '[若]い人に[混]ざって[受]けるの、[緊張]するなあ。', '젊은 사람들 사이에 섞여서 보는 거, 긴장되네.']],
    choices: [
      { t: '현관에서 결과를 기다린다', tag: 'calm', cnt: 'exam_watch',
        check: { st: 'b_okami', dc: 45,
          ok: { fx: { b_okami: 5 }, set: 'o_4dan', ach: ['okami', '4단 합격'], news: { okami: '4단.' }, res: '저녁에 돌아온 {okami|은} 현관에서 {N|을} 번쩍 들어 올렸다. 그걸로 결과는 충분히 알 수 있었다.' },
          ng: { fx: { b_okami: 3 }, ach: ['okami', '4단 심사 도전'], res: '{okami|은} 「다음에 또!」 하고 웃었다. 그리고 그날 밤, 연습 일지에 다음 목표를 적었다.' } } },
      { t: '돌아온 신발 냄새로 결과를 맞힌다', tag: 'play', fx: { mis: 2 }, cnt: 'exam_watch',
        check: { st: 'b_okami', dc: 50,
          ok: { fx: { b_okami: 4, hap: 3 }, set: 'o_4dan', ach: ['okami', '4단 합격'], news: { okami: '4단.' }, res: '신발 냄새를 맡은 {N}의 꼬리가 맹렬히 흔들렸다. 정답이었다.' },
          ng: { fx: { b_okami: 3 }, ach: ['okami', '4단 심사 도전'], res: '꼬리를 맹렬히 흔들었지만 오답이었다. {okami|은} 그래도 고맙다며 웃었다.' } } },
    ],
    brief: { res: '{okami|이} 4단 심사를 봤다고 한다.' },
  },
  {
    id: 'o7', cat: 'cast', who: 'okami', ch: 9, at: 10.5, deep: 30,
    title: '사진첩',
    text: '{okami|이} 지금까지 찍은 {N}의 사진을 한 권의 앨범으로 정리했다. 첫 장은 상자에 담겨 온 날이다.',
    lines: [
      ['okami', '見て、これ[来]た日。こんなに[小]さかったのよ。', '봐, 이거 온 날. 이렇게 작았어.'],
      { if: 'arrive_ran', l: [['okami', '[初日]に道場の[真ん中]まで[走]っていったの、[覚]えてる？', '첫날 도장 한가운데까지 달려갔던 거, 기억나?']] },
      { if: 'arrive_sat', l: [['okami', '[初日]に{roshi.s}先生の前に[座]ったでしょ。あれでみんな[驚]いたのよ。', '첫날 {roshi.s} 선생님 앞에 앉았잖아. 그걸로 다들 놀랐어.']] },
      { if: 'arrive_clung', l: [['okami', '初日はずっと私の[足]にくっついてたわね。', '첫날엔 계속 내 다리에 붙어 있었지.']] },
      { if: 'arrive_ran', l: [['okami', 'これ、[来]た[日]に[板]の[間]を[走]り[回]ってたとき。……[先生]の[顔]、[見]て。', '이거, 온 날 마루를 뛰어다닐 때. ……선생님 얼굴 좀 봐.']] },
    ],
    choices: [
      { t: '앨범 위에 엎드린다', tag: 'sweet', fx: { hap: 5, b_okami: 4 }, set: 'o_album_lie',
        res: '{okami|은} 앨범을 덮지 않고 그대로 두었다. 사진 속 강아지와 지금의 {N|이} 같은 자세로 자고 있었다.' },
      { t: '사진 속 강아지 냄새를 맡고 고개를 갸웃한다', tag: 'play', fx: { mis: 3, hap: 3 }, set: 'o_album_sniff',
        res: '종이 냄새밖에 안 났다. {N}의 갸웃한 얼굴이 마지막 페이지에 한 장 더 추가되었다.' },
    ],
    brief: { res: '{okami|이} {N}의 사진첩을 만들었다고 한다.' },
  },
];
