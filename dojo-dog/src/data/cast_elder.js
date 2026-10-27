// 늦깎이 어르신: すり足 → 1級 → 初段 → 가족의 걱정 → 二段과 일본어 수업 → 계단 → 三段 → 하이쿠
const korHere = (s) => s.flags.kor_left === undefined;

export default [
  {
    id: 'e0', cat: 'cast', who: 'elder', ch: 0, at: 0.25,
    title: '오른발부터',
    text: '{elder|은} 65세에 검도를 시작했다. 아직 호구도 없다. 오늘도 마루 끝에서 혼자 발 끌기 연습을 한다. 앞으로, 뒤로, 앞으로.',
    lines: [['elder', '[右足]から出て、[左足]を[引]きつけて……。あら、{N}ちゃんも[一緒]にやる？', '오른발부터 나가서, 왼발을 끌어당기고……. 어머, {N}도 같이 할래?']],
    choices: [
      { t: '그녀의 발을 따라 앞뒤로 걷는다', tag: 'play', fx: { b_elder: 7 }, set: 'e_step_dog',
        res: '앞으로, 뒤로. 짧은 다리 넷이 긴 다리 둘을 따라 움직였다.', lines: [['elder', '[足]が四本あるのはずるいわねえ。', '다리가 네 개라니 반칙이네.']] },
      { t: '그녀의 발등 위에 털썩 앉는다', tag: 'sweet', fx: { b_elder: 5, mis: 2 }, set: 'e_feet_sit',
        res: '{elder|은} 꼼짝 못 하고 웃었다.', lines: [['elder', 'はいはい、[休憩]ね。[休]むのも[稽古]のうち。', '네네, 휴식이네. 쉬는 것도 연습 중 하나지.']] },
    ],
    brief: { res: '{elder|이} 오늘도 마루 끝에서 발 끌기 연습을 했다고 한다.', news: { elder: '호구 없이 발 끌기 연습 중.' } },
  },
  {
    id: 'e1', cat: 'cast', who: 'elder', ch: 1, at: 1.0, kendo: true, deep: 20,
    title: '1급 심사',
    text: '{elder|이} 지역 검도연맹의 급 심사를 본다. 초등학생들 틈에 섞여, 번호표를 가슴에 달았다.',
    lines: [['elder', '[小学生]と[同じ]列に[並]ぶのよ。[孫]より[若]い子たちと。でも、[年齢]〘にかかわらず|にかかわらず〙初心者は初心者だものね。', '초등학생들이랑 같은 줄에 서는 거야. 손주보다 어린 애들이랑. 그래도 나이와 관계없이 초보는 초보니까.']],
    choices: [
      { t: '대기 의자 아래에서 발을 핥아 긴장을 풀어 준다', tag: 'sweet', fx: { b_elder: 6 }, set: ['e_1kyu', 'e_1kyu_lick'], cnt: 'exam_watch', ach: ['elder', '1급 합격'], news: { elder: '1급. 다음은 초단.' },
        res: '「간지러워」 하다가 어깨 힘이 빠졌다. 옆의 초등학생이 「할머니, 개 키워요?」 하고 물었다. 둘은 같이 합격했다.' },
      { t: '심사장 문 앞에서 지킨다', tag: 'guard', fx: { b_elder: 4, brave: 2 }, set: ['e_1kyu', 'e_1kyu_guard'], cnt: 'exam_watch', ach: ['elder', '1급 합격'], news: { elder: '1급. 다음은 초단.' },
        res: '문 앞을 지키는 닥스훈트는 그날 심사장의 작은 명물이 되었다. {elder|은} 1급에 합격했다.' },
    ],
    brief: { res: '{elder|이} 1급 심사에 합격했다고 한다.', set: 'e_1kyu', ach: ['elder', '1급 합격'], news: { elder: '1급.' } },
  },
  {
    id: 'e2', cat: 'cast', who: 'elder', ch: 2, at: 1.75, kendo: true, deep: 25, major: true,
    title: '반듯한 답안, 떨리는 죽도',
    text: '초단 심사. 필기 답안은 전직 국어 교사답게 원고지에 쓴 것처럼 반듯하다. 문제는 실기다.',
    lines: [['elder', '[字]を[書]くのは[得意]なのよ。でも竹刀を[持]つと、[手]が[勝手]に[震]えるの。', '글씨 쓰는 건 자신 있어. 근데 죽도를 잡으면 손이 제멋대로 떨려.']],
    choices: [
      { t: '출발 전에 그녀의 손을 핥는다', tag: 'sweet', cnt: 'exam_watch',
        check: { st: 'b_elder', dc: 35,
          ok: { set: 'e_shodan', fx: { b_elder: 5 }, ach: ['elder', '초단 합격'], news: { elder: '초단. 「인생은 지금부터」.' }, res: '심사장에서 손이 떨릴 때마다 {elder|은} {N}의 혀 감촉을 떠올렸다고 한다. 초단 합격.' },
          ng: { fx: { b_elder: 3 }, later: ['e2r', 2], news: { elder: '초단 불합격. 다시 도전한다.' }, res: '실기에서 죽도가 손에서 빠질 뻔했다. 불합격. {elder|은} 「다음이 있잖아」 하며 {N}의 머리를 쓰다듬었다.' } } },
      { t: '현관에서 「왕!」 하고 기합을 넣어 준다', tag: 'brave', fx: { brave: 2 }, cnt: 'exam_watch',
        check: { st: 'b_elder', dc: 40,
          ok: { set: 'e_shodan', fx: { b_elder: 5 }, ach: ['elder', '초단 합격'], news: { elder: '초단. 「인생은 지금부터」.' }, res: '{elder|이} 심사장에서 낸 기합은 「{N}의 흉내」였다고 한다. 초단 합격.' },
          ng: { fx: { b_elder: 3 }, later: ['e2r', 2], news: { elder: '초단 불합격. 다시 도전한다.' }, res: '기합은 좋았지만 발성이 너무 커서 스스로 놀랐다. 불합격.' } } },
    ],
    brief: { res: '{elder|이} 초단 심사를 봤다고 한다.', later: ['e2r', 1] },
  },
  {
    id: 'e2r', cat: 'cast', who: 'elder', chainOnly: true, kendo: true,
    title: '초단, 두 번째',
    text: '석 달 뒤 초단 재심사. 이번에는 손이 떨리지 않았다.',
    lines: [['elder', '[震]えてもいいって[決]めたら、[不思議]な〘ことに|ことに〙、[震]えなくなったのよ。', '떨려도 된다고 마음먹었더니, 신기하게도 안 떨리더라.']],
    choices: [
      { t: '돌아온 그녀에게 제일 먼저 달려간다', tag: 'sweet', fx: { b_elder: 5 }, set: 'e_shodan', ach: ['elder', '초단 합격(재도전)'], news: { elder: '초단.' }, res: '합격증을 쥔 손이 이번에는 기뻐서 떨렸다.' },
      { t: '축하 케이크 냄새를 맡으러 사무실로 간다', tag: 'food', fx: { hap: 3, b_okami: 2 }, set: 'e_shodan', ach: ['elder', '초단 합격(재도전)'], news: { elder: '초단.' }, res: '{okami|이} 몰래 사 둔 케이크가 있었다. {N}의 몫은 없었지만, 크림 한 방울은 받았다.' },
    ],
  },
  {
    id: 'e3', cat: 'cast', who: 'elder', ch: 3, at: 3.0, deep: 30,
    title: '「이제 그만두셔도」',
    text: '{elder}의 자식이 도장에 찾아왔다. 나이도 있으니 이제 그만두는 게 어떻겠냐는 이야기였다.',
    lines: [
      ['@家族', 'うちの[親]がお[世話]になってます。……でも、もう[歳]ですから。[怪我]でもしたらと[思]うと。', '저희 부모님이 신세 지고 있습니다. ……그래도 이제 연세가 있으시니까요. 다치기라도 하면 어쩌나 싶어서.'],
      ['elder', '[心配]してくれるのはありがたいけどね。やめる〘わけにはいかない|わけにはいかない〙の。[今]がいちばん[楽]しいんだから。', '걱정해 주는 건 고맙지만. 그만둘 수는 없어. 지금이 제일 즐거우니까.'],
    ],
    choices: [
      { t: '그 자식의 무릎에 올라가 꼬리를 흔든다', tag: 'social', fx: { soc: 2, b_elder: 4 }, set: 'e_family_ok', news: { elder: '가족도 응원하게 되었다.' },
        res: '무릎 위의 닥스훈트를 쓰다듬다가, 그 사람의 표정이 조금 풀렸다.', lines: [['@家族', '……[続]けていいけど、[無理]はしないでよ。', '……계속하셔도 되는데, 무리는 하지 마세요.']] },
      { t: '{elder} 옆에 딱 붙어 앉는다', tag: 'guard', fx: { b_elder: 6, brave: 1 }, set: 'e_stand', news: { elder: '가족의 걱정을 뒤로하고 계속한다.' },
        res: '{elder|은} {N}의 등에 손을 얹고 말했다. 「이 아이도 다리가 짧은데 매일 연습을 보러 와요.」 이상하게 설득력이 있었다.' },
    ],
    brief: { res: '{elder}의 가족이 걱정하고 있다고 한다. 그래도 {elder|은} 계속한다.' },
  },
  {
    id: 'e4', cat: 'cast', who: 'elder', ch: 4, at: 3.75, deep: 30, req: korHere, skip: true,
    title: '사무실의 일본어 교실',
    text: '연습이 끝나면 {elder|은} 사무실 탁자에서 {kor}에게 일본어를 가르친다. 전직 국어 교사의 수업은 엄격하다. 두 사람 다 다음 달에 2단 심사가 있어서, 필기 답안도 같이 쓰는 중이다.',
    lines: [
      ['elder', '「[拝見]します」と「見ます」は[違]うのよ。[目上]の[人]には……。', '「배견합니다」랑 「봅니다」는 달라. 윗사람한테는…….'],
      ['kor', 'は、はい。「拝見します」……。[漢字]は[韓国語]と[似]てるのに、[使い方]が[難]しいです。', '네, 네. 「拝見します」……. 한자는 한국어랑 비슷한데 쓰는 법이 어려워요.'],
      ['elder', 'それから二段の[学科]、[一緒]に[書]きましょう。', '그리고 2단 학과, 같이 쓰자.'],
    ],
    choices: [
      { t: '탁자 아래, 두 사람 발 사이에 눕는다', tag: 'calm', fx: { b_elder: 4, b_kor: 4 }, set: ['fumi_teaches_kor', 'e_2dan'], ach: ['elder', '2단 합격'], news: { elder: '2단. {kor}의 일본어 선생님.' },
        res: '두 사람은 그날 밤 10시까지 답안을 썼다. 한 달 뒤, {elder|은} 2단에 합격했다.' },
      { t: '단어 카드 한 장을 물고 도망간다', tag: 'play', fx: { mis: 4, b_kor: 2, b_elder: 2 }, set: ['fumi_teaches_kor', 'e_card_stolen', 'e_2dan'], ach: ['elder', '2단 합격'], news: { elder: '2단. {kor}의 일본어 선생님.' },
        res: '도망가다 떨어뜨린 카드에는 「拝見」이라고 적혀 있었다. 둘은 그 단어만큼은 평생 안 잊을 거라고 웃었다.' },
    ],
    brief: { res: '{elder|이} 2단에 합격했다고 한다.', set: 'e_2dan', ach: ['elder', '2단 합격'], news: { elder: '2단.' } },
  },
  {
    id: 'e4b', cat: 'cast', who: 'elder', ch: 5, at: 3.75, kendo: true, deep: 30, req: (s) => s.flags.e_2dan === undefined, skip: true,
    title: '2단 심사',
    text: '{elder|이} 2단 심사를 본다. 《日本剣道形》은 《太刀》 1본부터 5본까지. 형 상대는 {shihan|이} 맡아 연습해 주었다.',
    lines: [['elder', '[五本目]の[最後]、どっちの[足]だったかしら……。歳を取ると、忘れ〘がち|がち〙で困るわ。', '5본째 마지막이 어느 발이었더라……. 나이 들면 잊어버리기 일쑤라 곤란해.']],
    choices: [
      { t: '오른쪽 앞발을 들어 보인다', tag: 'play', fx: { mis: 2, b_elder: 4 }, set: ['e_2dan', 'e_paw_hint'], ach: ['elder', '2단 합격'], news: { elder: '2단.' }, cnt: 'exam_watch', res: '맞는지 틀린지는 아무도 몰랐지만 {elder|은} 크게 웃었다. 그리고 합격했다.' },
      { t: '그녀의 발치에서 조용히 순서를 지켜본다', tag: 'calm', fx: { b_elder: 5 }, set: 'e_2dan', ach: ['elder', '2단 합격'], news: { elder: '2단.' }, cnt: 'exam_watch', res: '세 번 반복하자 순서가 몸에 붙었다. 2단 합격.' },
    ],
  },
  {
    id: 'e5', cat: 'cast', who: 'elder', ch: 6, at: 5.5, deep: 25,
    title: '계단의 엉덩방아',
    text: '{elder|이} 도장 계단에서 발을 헛디뎌 엉덩방아를 찧었다. 다친 곳은 없었지만 모두 가슴을 쓸어내렸다.',
    lines: [
      ['elder', '[平気]、平気。……でも、転んだら骨を折り〘かねない|かねない〙わね。{N}ちゃんと[同]じ、[階段]には気をつけないと。', '괜찮아, 괜찮아. ……그래도 넘어지면 뼈가 부러질 수도 있겠네. {N|이랑} 똑같이 계단은 조심해야지.'],
      ['shihan', '[手すり]をつけましょう。[明日]にでも。', '난간을 달죠. 당장 내일이라도.'],
      { if: 'ramp', l: [['elder', '{N}ちゃんのスロープの[隣]に、私の手すりね。', '{N}의 경사로 옆에 내 난간이구나.']] },
    ],
    choices: [
      { t: '계단 아래에서 그녀가 다 내려올 때까지 기다린다', tag: 'calm', fx: { b_elder: 5 }, set: 'e_stairs_guard',
        res: '그 뒤로 {elder|이} 계단을 내려올 때면 {N|이} 꼭 아래에서 기다렸다. 누가 시킨 것도 아닌데.' },
      { t: '계단 아래에서 짖어 사람들을 부른다', tag: 'guard', fx: { brave: 2, b_shihan: 2, b_elder: 3 }, set: 'e_called_help',
        res: '{N}의 짖는 소리에 탈의실에서 세 명이 뛰어나왔다. {elder|은} 「구급차는 필요 없어요」 하며 웃었다.' },
    ],
    brief: { res: '{elder|이} 계단에서 미끄러졌지만 다친 데는 없다고 한다. 도장에 난간이 생겼다.' },
  },
  {
    id: 'e6', cat: 'cast', who: 'elder', ch: 7, at: 6.75, kendo: true, deep: 30, major: true, req: (s) => s.flags.e_2dan !== undefined, skip: true,
    title: '3단 심사',
    text: '{elder|이} 3단 심사를 본다. 《日本剣道形》은 《太刀》 7본까지. 같은 날 심사를 보는 사람 중 최고령이다.',
    lines: [
      ['elder', 'この歳で三段なんて、[夢]みたいね。段が取れた〘ばかりか|ばかりか〙、友達まで増えたのよ。', '이 나이에 3단이라니, 꿈만 같네. 단을 땄을 뿐 아니라 친구까지 늘었어.'],
      { if: 'e_family_ok', l: [['@家族', '[今日]は[見]に[来]たよ。……[応援]してる。', '오늘은 보러 왔어요. ……응원해요.']] },
    ],
    choices: [
      { t: '심사장 밖 벤치에서 가족과 함께 기다린다', tag: 'calm', cnt: 'exam_watch',
        check: { st: 'b_elder', dc: 45, ok: { set: 'e_3dan', fx: { b_elder: 6 }, ach: ['elder', '3단 합격'], news: { elder: '3단. 도장 최고의 노력가.' }, res: '심사장에서 나온 {elder|이} 손가락으로 동그라미를 만들어 보였다. 합격.' },
          ng: { fx: { b_elder: 3 }, ach: ['elder', '3단 심사 도전'], res: '나온 {elder|은} 「넘어질 뻔했어」라며 웃었다. 불합격. 「3단은 다음 생에 노려도 되지.」' } } },
      { t: '출발 전 그녀의 죽도 가방에 들어가 같이 가자고 한다', tag: 'play', fx: { mis: 2 }, cnt: ['exam_watch', 'bag'],
        check: { st: 'b_elder', dc: 50, ok: { set: 'e_3dan', fx: { b_elder: 6, hap: 2 }, ach: ['elder', '3단 합격'], news: { elder: '3단.' }, res: '죽도 가방에서 꺼내지는 동안 웃음이 나서 긴장이 다 풀렸다고 한다. 합격.' },
          ng: { fx: { b_elder: 3 }, ach: ['elder', '3단 심사 도전'], res: '죽도 가방이 무거워서 늦을 뻔했다. 불합격. 그래도 「즐거웠다」고 했다.' } } },
    ],
    brief: { res: '{elder|이} 3단 심사를 봤다고 한다.' },
  },
  {
    id: 'e7', cat: 'cast', who: 'elder', ch: 8, at: 9.0, deep: 25,
    title: '벽에 붙은 한 수',
    text: '{elder|이} 도장 사무실 벽에 붓글씨로 쓴 종이를 붙였다. 하이쿠다.',
    lines: [
      ['elder', '[一句]できたのよ。「春の[床]　[短]き[足]の　[行き来]かな」', '한 수 지었어. 「봄날의 마루 / 짧은 다리가 / 오가는구나」'],
      ['okami', '{N}のことですか？　道場の景色が目に浮かぶようです。', '{N} 얘기예요? 도장 풍경이 눈앞에 떠오르는 것 같아요.'],
      ['elder', 'さあ、どうかしら。', '글쎄, 어떨까.'],
      { if: 'e_step_dog', l: [['elder', 'すり[足]の[稽古]、{N}ちゃんと[一緒]にやったものね。', '스리아시 연습, {N}이랑 같이 했었지.']] },
    ],
    choices: [
      { t: '종이 아래에 앉아 감상한다', tag: 'calm', fx: { b_elder: 5, hap: 2 }, set: 'e_haiku', news: { elder: '도장 사무실 벽에 하이쿠를 붙였다.' },
        res: '먹 냄새가 좋았다. 종이는 그 뒤로 몇 년이나 그 벽에 붙어 있었다.' },
      { t: '먹물 냄새를 맡다가 코에 묻힌다', tag: 'play', fx: { mis: 3, b_elder: 3 }, set: ['e_haiku', 'e_ink_nose'], news: { elder: '도장 사무실 벽에 하이쿠를 붙였다.' },
        res: '코끝이 새까매졌다. {elder|은} 웃으며 그 얼굴을 종이 한쪽에 작게 그려 넣었다.' },
    ],
    brief: { res: '{elder|이} 사무실 벽에 하이쿠를 붙였다고 한다.', set: 'e_haiku' },
  },
];
