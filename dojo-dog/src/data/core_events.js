// 시작, 허리, 고비(1·3·7·10살·마지막 해), 허브(누구 옆에 / 산책 코스) 이벤트
const alive = (s) => s.flags.roshi_gone === undefined;
const korHere = (s) => s.flags.kor_left === undefined;
// 계절 번호(0 봄 · 1 여름 · 2 가을 · 3 겨울): 허브 첫 문장을 계절마다 바꾼다
const sea = (n) => (s) => (s.startSeason + s.t) % 4 === n;

export default [
  {
    id: 'a_arrive', cat: 'daily', chainOnly: true, major: true,
    title: '도장에 온 날',
    text: '생후 석 달. 작은 상자에 담겨 {D}에 도착했다. 상자 밖으로 코를 내밀어 보니, 마룻바닥이 끝도 없이 넓었다.',
    lines: [
      ['okami', '今日からここがあなたのおうちよ、{N}。', '오늘부터 여기가 네 집이야, {N}.'],
      ['shihan', '犬か……。まあ、[稽古]の[邪魔]だけはするなよ。', '개라……. 뭐, 연습 방해만 하지 마라.'],
      ['roshi', '……。', '…….'],
    ],
    choices: [
      { t: '마루 한가운데로 힘껏 달려간다', tag: 'play', fx: { mis: 4, brave: 3, b_roshi: -3 }, set: 'arrive_ran',
        res: '발톱이 마루 위에서 다다닥 헛돌았다. 노사범의 눈썹이 한 번 움직였다.',
        lines: [['roshi', '[板の間]は[遊び場]ではないよ。……[爪]を[切]ってやりなさい。', '마루는 놀이터가 아니란다. ……발톱 좀 깎아 주게.']] },
      { t: '{okami} 발치에서 떨어지지 않는다', tag: 'sweet', fx: { b_okami: 6, hap: 3 }, set: 'arrive_clung',
        res: '{okami|이} 웃으며 안아 올렸다. 품이 따뜻했다. 삼 초 만에 잠들었다.',
        lines: [['okami', 'よしよし、[怖]くないよ。……えっ、もう[寝]た？', '옳지 옳지, 안 무서워. ……어, 벌써 자?']] },
      { t: '노사범 앞에 가서 얌전히 앉는다', tag: 'calm', fx: { b_roshi: 6, brave: 2 }, set: 'arrive_sat',
        res: '노사범이 잠깐 내려다보더니, 아주 조금 고개를 끄덕였다.',
        lines: [['roshi', 'ほう。……[礼儀]の[分]かる[子]だな。', '호오. ……예의를 아는 녀석이구나.'], ['shihan', '[先生]が[初日]から[褒]めるなんて……。[俺]のときはなかったぞ。', '선생님이 첫날부터 칭찬을 하시다니……. 난 그런 적 없었는데.']] },
    ],
  },
  {
    id: 'l_intro', cat: 'daily', chainOnly: true, major: true,
    title: '다시, 이 도장에서',
    text: '{P|이} 무지개다리를 건넌 지 {Y}년. {D}의 현관에는 지금도 {P}의 사진이 걸려 있다. 그리고 오늘, 새 강아지가 왔다.',
    lines: [
      ['shihan', '先代の{P}も、最初はこうやって[震]えてたんだって。', '선대 {P}도 처음엔 이렇게 떨었대.'],
      ['roshi', '[懐]かしいな。あいつも[竹刀袋]に潜り込んでは、よく叱られた〘ものだ|ものだ〙。', '그립구나. 그 녀석도 죽도 가방에 기어들어 가서는 자주 혼나곤 했지.'],
      ['okami', '{N}、ここはね、ずっと犬のいる道場なの。……[竹刀袋]に[入]るのも、まあ[伝統]みたいなものね。', '{N}, 여기는 늘 개가 있는 도장이야. ……죽도 가방에 들어가는 것도 뭐, 전통 같은 거고.'],
    ],
    choices: [
      { t: '현관의 사진 냄새를 맡는다', tag: 'calm', fx: { b_roshi: 5, hap: 3 }, set: 'sniffed_photo',
        res: '사진 속 개는 죽도 가방에서 고개만 내밀고 의기양양한 얼굴을 하고 있었다. 어쩐지 선배 같다.' },
      { t: '사범의 무릎에 뛰어오른다', tag: 'sweet', fx: { b_shihan: 6 }, risk: 0.05, set: 'jumped_shihan',
        res: '사범이 웃었다. 예전에 이 도장에서 울던 아이였다고는 믿기지 않는 웃음이다.' },
      { t: '도장 구석구석을 탐험한다', tag: 'brave', fx: { brave: 4, mis: 3 },
        res: '마루 틈에서 오래된 개껌을 발견했다. 선대의 비상식량이었던 모양이다.' },
    ],
  },
  {
    id: 'x_back_vet', cat: 'daily', chainOnly: true,
    title: '동물병원에 다녀왔다',
    text: '{N|이} 뒷다리를 살짝 끌기 시작했다. {okami|이} 허둥지둥 동물병원에 데려갔다. 닥스훈트한테 허리는 늘 조심해야 하는 곳이다.',
    lines: [
      ['okami', '[獣医]さんがね、[無理]をすると[悪化]し〘かねない|かねない〙から、しばらく[階段]は[禁止]だって。', '수의사 선생님이 그러는데, 무리하면 더 나빠질 수도 있으니까 한동안 계단은 금지래.'],
      ['shihan', 'よし、[段差]には[板]を[渡]しておこう。', '좋아, 턱에는 판자를 걸쳐 두자.'],
    ],
    choices: [
      { t: '케이지 안에서 얌전히 쉰다', tag: 'calm', fx: { back: 10, hap: -4 }, set: 'back_care',
        res: '심심했지만 꾹 참았다. 일주일 뒤, 발걸음이 가벼워졌다. 케이지 문은 이빨 자국투성이가 되었다.' },
      { t: '꼬리를 흔들어 괜찮다고 말한다', tag: 'sweet', fx: { back: 5, hap: 3, b_okami: 4 }, set: 'back_care',
        res: '{okami|이} "알았어, 알았어" 하며 웃었다. 그래도 계단 앞에는 판자가 놓였다.' },
    ],
  },
  {
    id: 'x_back_vet2', cat: 'daily', chainOnly: true,
    title: '계단을 조심하자',
    text: '또 허리가 뻐근하다. 이번에는 사범이 주말 내내 무언가를 만들었다. 현관 계단 옆에 생긴 완만한 비탈길.',
    lines: [
      ['shihan', 'ほら、スロープだ。今日からここを[通]れ。', '자, 경사로다. 오늘부터 여기로 다녀.'],
      ['worker', '先生、それ[手作り]ですか？　[意外]と[器用]ですね。', '선생님, 그거 직접 만드신 거예요? 의외로 손재주가 있으시네요.'],
      ['shihan', '「[意外]と」は[余計]だ。', '「의외로」는 빼.'],
    ],
    choices: [
      { t: '경사로로 천천히 내려간다', tag: 'calm', fx: { back: 8, b_shihan: 5 }, set: ['ramp', 'back_care'],
        res: '비탈은 딱 닥스훈트 한 마리 폭이었다. 사범이 몰래 줄자로 재 둔 모양이다.' },
      { t: '습관대로 계단으로 가려 한다', tag: 'guard', fx: { back: 3, b_shihan: 2 }, set: ['ramp', 'back_care'], cnt: 'stubborn',
        res: '사범에게 번쩍 들려서 경사로 위에 놓였다. 세 번 반복하고 나서야 포기했다.' },
    ],
  },

  // ───────── 고비 ─────────
  {
    id: 'm_1', cat: 'milestone',
    title: '1살이 되었다',
    text: '{D}에 온 지 1년. 이제 죽도 소리에 놀라 숨는 일은 거의 없다. 도장에서 가장 좋아하는 장소는?',
    lines: [['okami', '{N}、お[誕生日]おめでとう！　……あ、ケーキは[人間]用だから、あげる〘わけにはいかない|わけにはいかない〙の。', '{N}, 생일 축하해! ……아, 케이크는 사람용이라서 줄 수가 없어.']],
    choices: [
      { t: '현관에 세워 둔 죽도 가방 속', tag: 'lazy', fx: { hap: 5, mis: 2 }, set: 'fav_bag', cnt: 'bag', res: '죽도 가방 속은 어둡고 좁고, 딱 맞는다.' },
      { t: '사범실 방석 위', tag: 'calm', fx: { b_shihan: 5, hap: 3 }, set: 'fav_cushion', res: '사범 방석은 사범 엉덩이 모양으로 꺼져 있다. 그 자리에 몸을 끼워 넣으면 딱 맞는다.' },
      { t: '마루 끝, 모두가 보이는 자리', tag: 'guard', fx: { brave: 4, b_roshi: 3 }, set: 'fav_edge', res: '여기서는 연습하는 모두가 한눈에 보인다. 감독 자리다.' },
    ],
    word: { q: '1살의 {N}에게 한마디', presets: ['이 도장에 와 줘서 고마워', '죽도 가방은 네 침대가 아니야', '천천히 커도 돼', '오늘도 짧은 다리로 열심히'] },
  },
  {
    id: 'm_3', cat: 'milestone',
    title: '3살이 되었다',
    text: '어엿한 성견이 되었다. 도장 사람들의 발소리만 들어도 누가 왔는지 안다. 요즘 가장 마음이 가는 사람은?',
    lines: [['shihan', '三歳か。[体]は[小]さい〘ながらも|ながらも〙、もう[一人前]だな、{N}。……[態度]だけは。', '세 살인가. 몸은 작아도 이제 어엿한 어른이네, {N}. ……태도만큼은.']],
    choices: [
      { t: '{kid}', tag: 'play', fx: { b_kid: 8 }, set: 'fav_kid', res: '{kid|이} 오는 시간이 되면 현관에서 기다리게 되었다.' },
      { t: '{kor}', tag: 'social', fx: { b_kor: 8 }, set: 'fav_kor', req: (s) => s.flags.kor_left === undefined, res: '{kor}의 서툰 일본어가 들리면 귀가 쫑긋 선다.' },
      { t: '{elder}', tag: 'calm', fx: { b_elder: 8 }, set: 'fav_elder', res: '{elder}의 가방에서는 늘 고구마 말랭이 냄새가 난다.' },
      { t: '{worker}', tag: 'sweet', fx: { b_worker: 8 }, set: 'fav_worker', res: '밤늦게 넥타이를 풀며 들어오는 {worker}에게 제일 먼저 달려간다.' },
    ],
    word: { q: '3살의 {N}에게 한마디', presets: ['너는 이 도장의 식구야', '좋아하는 사람이 많아서 다행이다', '검도 장갑이랑 싸우는 건 이제 그만', '언제나 마루 끝에서 지켜봐 줘'] },
  },
  {
    id: 'm_7', cat: 'milestone',
    title: '7살이 되었다',
    text: '도장에서 {N}보다 오래 다닌 사람은 손에 꼽는다. 요즘 {N}의 하루는?',
    lines: [{ if: (s) => s.flags.roshi_gone === undefined, l: [['roshi', '{N}も[貫禄]が出てきたな。歳を重ねる〘につれて|につれて〙、顔つきが変わってきた。', '{N}도 관록이 붙었구나. 나이가 들수록 얼굴이 달라지는군.']], else: [['shihan', '{N}も[貫禄]が出てきたな。歳を重ねる〘につれて|につれて〙、顔つきが変わってきた。', '{N}도 관록이 붙었네. 나이가 들수록 얼굴이 달라지는구나.'], ['okami', '{roshi}がいたら、きっとそう[言]ったわね。', '{roshi}님이 계셨다면 분명 그렇게 말씀하셨겠지.']] }],
    choices: [
      { t: '연습 지켜보기가 본업', tag: 'guard', fx: { b_shihan: 4, b_roshi: 3, brave: 2 }, set: 'life_watch', res: '죽도 소리만 들어도 누가 치는지 안다. 방금 헛친 건 {worker}다.' },
      { t: '산책이 인생', tag: 'brave', fx: { hea: 5, soc: 3 }, risk: 0.04, set: 'life_walk', res: '상점가 사람들 절반은 {N}의 이름을 안다.' },
      { t: '낮잠이 본업', tag: 'lazy', fx: { hap: 6, hea: -1 }, set: 'life_nap', res: '오후 3시에 볕이 드는 자리를 정확히 안다.' },
    ],
    word: { q: '7살의 {N}에게 한마디', presets: ['벌써 7년이라니', '도장의 터줏대감', '앞으로도 잘 부탁해', '간식은 하루 두 번까지야'] },
  },
  {
    id: 'm_10', cat: 'milestone',
    title: '10살이 되었다',
    text: '주둥이에 흰 털이 섞이기 시작했다. 계단 앞에서 잠깐 멈추는 일이 늘었다. 앞으로의 시간을 어떻게 보낼까?',
    lines: [['okami', '{N}も、もうおじいちゃん……おばあちゃん？　どっちでもいいわね。まだまだ元気でいてもらわなきゃ困るんだから。', '{N}도 이제 할아버지……할머니? 어느 쪽이면 어때. 아직은 한참 건강해야 해, 안 그러면 곤란하다니까.']],
    choices: [
      { t: '좋아하는 사람 곁에서 천천히', tag: 'calm', fx: { hap: 6, b_okami: 3, b_shihan: 3, b_kid: 3 }, set: 'old_slow', res: '서두를 일은 이제 없다. 지나가는 사람마다 머리를 한 번씩 쓰다듬고 간다. 덕분에 정수리 털이 늘 납작하다.' },
      { t: '아직 현역! 도장 순찰은 계속', tag: 'brave', fx: { brave: 5, hea: 2 }, risk: 0.08, set: 'old_active', res: '매일 도장 네 귀퉁이를 확인하는 일은 그만두지 않았다. 세 번째 귀퉁이에서 꼭 한 번 쉬어 가지만.' },
      { t: '새로운 일에도 도전', tag: 'play', fx: { mis: 6, hap: 3 }, set: 'old_new', res: '요즘은 「하이파이브」를 연습 중이다. 성공률은 3할 정도.' },
    ],
    word: { q: '10살의 {N}에게 한마디', presets: ['흰 털도 잘 어울려', '계단은 안아 줄게', '오래오래 같이 있자', '네 덕분에 도장이 따뜻해'] },
  },
  {
    id: 'm_last', cat: 'milestone',
    title: '조용한 계절',
    text: '요즘 낮잠이 길어졌다. 밥을 먹는 데도 시간이 걸린다. 그래도 연습 시작 소리가 들리면 고개를 든다. 가장 따뜻한 자리를 고른다면?',
    lines: [['shihan', '{N}、無理して歩く〘ことはない|ことはない〙からな。', '{N}, 무리해서 걸을 거 없다.']],
    choices: [
      { t: '신단 아래, 도장이 다 보이는 자리', tag: 'guard', fx: { hap: 4, b_shihan: 5 }, set: 'last_kamidana', res: '모두가 연습 전에 고개를 숙이는 그 자리 아래에서, {N|은} 눈을 감고 기합 소리를 들었다.' },
      { t: '{okami}의 무릎', tag: 'sweet', fx: { hap: 6, b_okami: 6 }, set: 'last_lap', res: '아이들 도복에 이름표를 다는 {okami}의 무릎은 오늘도 따뜻했다.' },
      { t: '햇볕 드는 툇마루', tag: 'lazy', fx: { hap: 5, hea: 2 }, set: 'last_engawa', res: '툇마루에 누워 있으면 상점가 쪽에서 고로케 냄새가 바람에 실려 온다.' },
      { t: '죽도 가방 속', tag: 'play', fx: { hap: 5, mis: 2 }, set: 'last_bag', cnt: 'bag', req: (s) => s.st.back >= 25, why: '허리 때문에 들어가기 어렵다', res: '누군가 죽도 가방 입구를 조금 넓혀 두었다. 다들 알고 있었나 보다.' },
    ],
    word: { q: '마지막 해의 {N}에게 한마디', presets: ['고마워, 정말로', '천천히 쉬어도 돼', '언제나 여기 있을게', '최고의 도장 개였어'] },
  },

  // ───────── 허브 ─────────
  {
    id: 'h_beside_a', cat: 'hub', once: false, cd: 5, max: 5, w: 1.1,
    title: '오늘은 누구 옆에?',
    text: [
      { if: sea(0), v: '연습이 끝난 저녁. 창문으로 벚꽃잎이 날아든다. 누구 옆에 가 볼까.' },
      { if: sea(1), v: '연습이 끝난 저녁. 다들 선풍기 앞에 모여 있다. 누구 옆에 가 볼까.' },
      { if: sea(2), v: '연습이 끝난 저녁. 해가 부쩍 짧아졌다. 누구 옆에 가 볼까.' },
      { if: sea(3), v: '연습이 끝난 저녁. 다들 난로 근처에서 꾸물거린다. 누구 옆에 가 볼까.' },
    ],
    choices: [
      { t: '{roshi} 옆', tag: 'calm', req: alive, fx: { b_roshi: 5 }, pool: 'beside_roshi', poolEmpty: '{roshi|은} 말없이 {N}의 등을 한 번 쓸었다.' },
      { t: '{shihan} 옆', tag: 'guard', fx: { b_shihan: 5 }, pool: 'beside_shihan', poolEmpty: '{shihan|은} 죽도를 손질하며 {N|을} 발로 살짝 밀어 자리를 내 주었다.' },
      { t: '{okami} 옆', tag: 'sweet', fx: { b_okami: 5 }, pool: 'beside_okami', poolEmpty: '{okami}의 무릎 위에서 바늘이 천을 지나가는 소리를 들으며 졸았다.' },
      { t: '{kid} 옆', tag: 'play', fx: { b_kid: 5 }, pool: 'beside_kid', poolEmpty: '{kid|와} 마루를 몇 번이고 오가며 놀았다.' },
    ],
  },
  {
    id: 'h_beside_b', cat: 'hub', once: false, cd: 5, max: 5, w: 1.1,
    title: '오늘은 누구 옆에?',
    text: [
      { if: sea(0), v: '연습 전, 탈의실 앞이 북적인다. 새 학기라 처음 보는 얼굴도 있다. 누구한테 가 볼까.' },
      { if: sea(1), v: '연습 전, 탈의실 앞. 다들 「덥다」는 말만 하고 있다. 누구한테 가 볼까.' },
      { if: sea(2), v: '연습 전, 탈의실 앞이 북적인다. 대회가 가까워서인지 다들 말수가 적다. 누구한테 가 볼까.' },
      { if: sea(3), v: '연습 전, 탈의실 앞. 다들 맨발로 마루에 올라서기를 망설이고 있다. 누구한테 가 볼까.' },
    ],
    choices: [
      { t: '{worker} 옆', tag: 'sweet', fx: { b_worker: 5 }, pool: 'beside_worker', poolEmpty: '{worker|은} 넥타이를 풀며 "오늘도 수고했다" 하고 혼잣말을 했다. {N}에게 한 말인지도 모른다.' },
      { t: '{elder} 옆', tag: 'calm', fx: { b_elder: 5 }, pool: 'beside_elder', poolEmpty: '{elder|은} 고구마 말랭이를 반으로 쪼개 주었다.' },
      { t: '{kor} 옆', tag: 'social', req: korHere, fx: { b_kor: 5 }, pool: 'beside_kor', poolEmpty: '{kor|은} 단어장을 넘기며 {N}의 귀를 만지작거렸다.' },
      { t: '아무 데도 안 가고 죽도 가방 속으로', tag: 'lazy', fx: { hap: 4 }, cnt: 'bag', res: '죽도 가방 속에서 모두의 발소리를 들었다. 이것도 나쁘지 않다.' },
    ],
  },
  {
    id: 'h_walk', cat: 'hub', once: false, cd: 3, max: 8, w: 1.4,
    title: '산책 코스 고르기',
    text: [
      { if: sea(0), v: '목줄이 찰칵 소리를 냈다. 바람이 따뜻하다. 오늘은 어디로 갈까?' },
      { if: sea(1), v: '목줄이 찰칵 소리를 냈다. 아스팔트가 뜨거워지기 전에 나가야 한다. 오늘은 어디로 갈까?' },
      { if: sea(2), v: '목줄이 찰칵 소리를 냈다. 낙엽 밟는 소리가 좋은 계절이다. 오늘은 어디로 갈까?' },
      { if: sea(3), v: '목줄이 찰칵 소리를 냈다. 바깥 공기가 코끝에 시리다. 오늘은 어디로 갈까?' },
    ],
    lines: [['okami', 'さあ、お[散歩]行こうか。今日はどっちにする？', '자, 산책 갈까. 오늘은 어느 쪽으로 할래?']],
    choices: [
      { t: '{S}', tag: 'social', fx: { soc: 2 }, pool: 'walk_street', poolEmpty: '상점가 사람들에게 인사를 한 바퀴 돌고 왔다.' },
      { t: '{RV} 강변', tag: 'brave', fx: { hea: 3 }, risk: 0.03, req: (s) => s.st.back >= 30 && s.st.hea >= 25, why: '긴 산책은 지금 몸에 무리다', pool: 'walk_river', poolEmpty: '강바람을 맞으며 풀 냄새를 실컷 맡았다.' },
      { t: '{SH}', tag: 'calm', fx: { hap: 2 }, pool: 'walk_shrine', poolEmpty: '신사의 돌계단 아래에서 비둘기를 구경했다.' },
      { t: '학교 앞', tag: 'play', fx: { b_kid: 2, soc: 1 }, pool: 'walk_school', poolEmpty: '하교하는 아이들에게 둘러싸여 실컷 쓰다듬을 받았다.' },
    ],
  },
];
