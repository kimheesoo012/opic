// 닥스훈트다운 일상과 계절 사건
const has = (s, f) => s.flags[f] !== undefined;
const age = (s) => s.t / 4;

export default [
  {
    id: 'd_stairs', cat: 'daily', stage: ['puppy'], w: 2,
    title: '탈의실 계단이라는 벽',
    text: '도장 2층 탈의실로 이어지는 계단. {N}의 짧은 다리로는 한 칸 한 칸이 절벽이다. 모두가 저 위로 사라진다.',
    lines: [['okami', 'あら、{N}。[階段]は[無理]よ。[腰]に[悪]いんだから。', '어머, {N}. 계단은 무리야. 허리에 안 좋으니까.']],
    choices: [
      { t: '끝까지 혼자 올라가 본다', tag: 'brave', fx: { brave: 4, back: -5 }, risk: 0.12, set: 'stairs_tried', res: '세 칸째에서 미끄러져 엉덩이부터 떨어졌다. 그 뒤로 계단 아래에는 「개 출입 금지」 종이가 붙었다.' },
      { t: '계단 아래에서 낑낑 울어 사람을 부른다', tag: 'sweet', fx: { b_okami: 4, hap: 2 }, set: 'stairs_called', res: '내려온 사람마다 {N|을} 쓰다듬고 갔다. 올라갈 필요가 없었다. 다들 내려오니까.' },
      { t: '계단 대신 계단 밑 공간을 탐험한다', tag: 'play', fx: { mis: 4 }, set: 'under_stairs', res: '계단 밑에는 잃어버린 머리 수건 세 장과 아이들 양말 한 짝이 있었다. 보물 창고다.' },
    ],
  },
  {
    id: 'd_teeth', cat: 'daily', stage: ['puppy'], w: 1.5,
    title: '이갈이와 조리',
    text: '이가 근질근질하다. 현관에 가지런히 놓인 조리 한 켤레. {roshi}의 것이다.',
    choices: [
      { t: '조리 끈을 씹는다', tag: 'play', fx: { mis: 5, b_roshi: -3 }, set: 'chewed_zori', res: '연습을 마치고 나온 {roshi|은} 끈이 반쯤 끊어진 조리를 오래 바라보았다. 그리고 그걸 신고 집에 갔다.', lines: [['roshi', '……[歯]が[生]え[変]わる[時期]か。[仕方]ない。', '……이갈이할 때가 됐구먼. 어쩔 수 없지.']] },
      { t: '{okami|가} 준 개껌으로 참는다', tag: 'calm', fx: { b_okami: 3, hap: 1 }, res: '개껌을 세 개째 씹었을 때 근질거림이 가라앉았다. 조리는 무사했다.' },
    ],
  },
  {
    id: 'd_collar', cat: 'daily', stage: ['puppy'],
    title: '첫 목걸이',
    text: '{kid|이} 용돈으로 산 목걸이를 가져왔다. 작은 이름표에 「{N}」 그리고 그 아래 「{D}」라고 새겨져 있다.',
    lines: [['kid', 'これ〘さえあれば|さえ～ば〙、[迷子]になっても[大丈夫]だよ。', '이것만 있으면 길을 잃어도 괜찮아.']],
    choices: [
      { t: '목걸이를 자랑하며 도장을 한 바퀴 돈다', tag: 'social', fx: { b_kid: 6, soc: 2 }, set: 'kid_collar', res: '이름표가 짤랑짤랑 울렸다. 그날부터 그 소리가 {N}의 발소리가 되었다.' },
      { t: '목걸이를 뒷발로 긁어 벗으려 한다', tag: 'guard', fx: { b_kid: 3, mis: 2 }, set: 'kid_collar', res: '사흘 동안 저항했다. 나흘째에 포기했다. {kid|은} 그 사흘이 제일 귀여웠다고 한다.' },
    ],
  },
  {
    id: 'd_accident', cat: 'daily', stage: ['puppy'], gag: true,
    title: '방석 위의 대참사',
    text: '사무실 방석이 축축하다. 범인은 현장에 남아 있었다. 꼬리를 흔들면서.',
    lines: [['okami', '{N}……！　ここは[トイレ]じゃないのよ……。もう、その顔じゃ叱り〘ようがない|ようがない〙わ。', '{N}……! 여긴 화장실이 아니야……. 정말, 그런 얼굴을 하면 혼낼 수가 없잖아.']],
    choices: [
      { t: '귀를 뒤로 젖히고 반성하는 얼굴을 한다', tag: 'sweet', fx: { b_okami: 2, hap: -1 }, res: '반성하는 얼굴에 {okami|은} 졌다. 방석은 세탁소에 갔다. 화장실 시트는 두 장으로 늘었다.' },
      { t: '방석을 끌고 도망간다', tag: 'play', fx: { mis: 5, b_okami: -2 }, res: '증거 인멸은 실패했다. 도장 마루에 젖은 자국이 한 줄로 이어졌다.' },
    ],
  },
  {
    id: 'd_dig', cat: 'daily', w: 1.2, gag: true,
    title: '방석 굴 파기',
    text: '사범실 방석. 닥스훈트는 원래 굴에 사는 짐승을 쫓던 사냥개다. 잠자리를 만들려면 일단 파야 한다.',
    choices: [
      { t: '방석이 납작해질 때까지 판다', tag: 'play', fx: { mis: 4, hap: 2 }, res: '파고 돌고 파고 돌고. 다섯 바퀴 만에 완벽한 굴이 완성됐다. 방석 가장자리가 조금 풀렸다.' },
      { t: '세 번만 파고 바로 눕는다', tag: 'lazy', fx: { hap: 3 }, res: '세 번이면 충분하다. 베테랑의 둥지 만들기에 쓸데없는 동작은 없다.' },
    ],
  },
  {
    id: 'd_kote', cat: 'daily', w: 1.4, gag: true,
    title: '《小手》와의 결투',
    text: '마루에 벗어 둔 《小手》 한 짝. 손가락 모양으로 불룩하고, 냄새가 진하다. 이건 사냥감이다.',
    choices: [
      { t: '《小手》를 물고 흔들어 「제압」한다', tag: 'brave', fx: { brave: 3, mis: 4 }, cnt: 'kote', res: '좌우로 세 번 흔들고, 마루에 내려놓고, 다시 덮쳤다. 주인이 돌아왔을 때 《小手》는 침에 젖어 있었다.', lines: [['worker', 'それ[僕]の小手！　……まあ、洗っ〘たところで|たところで〙[臭]いのは同じか。', '그거 내 《小手》! ……뭐, 빨아 봤자 냄새나는 건 똑같나.']] },
      { t: '《小手》 안에 머리를 넣어 본다', tag: 'play', fx: { mis: 5 }, cnt: 'kote', set: 'kote_head', res: '머리가 빠지지 않았다. 《小手》를 쓴 닥스훈트가 도장을 질주했다. 다들 연습을 멈추고 웃었다.' },
      { t: '냄새만 맡고 지나간다', tag: 'calm', fx: { hap: 1 }, res: '노련한 개는 사냥감을 고른다. 이 《小手》는 다음 기회에.' },
    ],
  },
  {
    id: 'd_bag', cat: 'daily', w: 1.4,
    title: '죽도 가방 속',
    text: '현관 벽에 기대 놓은 죽도 가방. 입구가 살짝 벌어져 있다. 길쭉한 몸이 딱 들어갈 것 같은 폭이다.',
    choices: [
      { t: '쏙 들어가서 잔다', tag: 'lazy', fx: { hap: 4 }, cnt: 'bag', res: '죽도 가방 속은 어둡고 좁고, 대나무 냄새가 났다. 죽도를 꺼내러 온 사람이 비명을 질렀다.' },
      { t: '죽도 가방을 쓰러뜨리고 끈을 문다', tag: 'play', fx: { mis: 4 }, res: '죽도 가방이 쓰러지는 소리에 사무실에서 {okami|이} 뛰어나왔다. {N|은} 이미 끈을 물고 있었다.' },
    ],
  },
  {
    id: 'd_bogu_smell', cat: 'daily', w: 1.1,
    title: '호구 냄새',
    text: '연습이 끝난 직후의 탈의실. 줄지어 널린 호구에서 김이 오른다. 사람한테는 고약한 냄새지만, 개한테는 정보의 보물 창고다.',
    choices: [
      { t: '《面》마다 냄새를 맡아 주인을 외운다', tag: 'brave', fx: { soc: 3, brave: 1 }, set: 'bogu_memory', res: '《面》 열두 개의 냄새를 다 외웠다. 다음 날부터 {N|은} 탈의실에 누가 왔는지 문이 열리기 전에 알았다.' },
      { t: '제일 냄새나는 《胴》 옆에서 잔다', tag: 'lazy', fx: { hap: 3 }, res: '《胴》의 주인은 {worker}였다. 본인은 크게 감동했다. 이유는 묻지 않았다.' },
    ],
  },
  {
    id: 'd_beg', cat: 'daily', w: 1.2, req: (s) => s.st.hea >= 20,
    title: '간식 조르기 기술',
    text: '{okami}의 앞치마 주머니에서 간식 봉지 소리가 났다. 세 방 너머에서도 들리는 소리다.',
    choices: [
      { t: '「손」「다른 손」「엎드려」를 연달아 한다', tag: 'food', fx: { hap: 3, hea: -1, b_okami: 2 }, res: '시키지도 않은 재주를 전부 보여 주었다. {okami|은} 졌다. 하지만 하나만 주었다.' },
      { t: '눈만 위로 뜨고 가만히 쳐다본다', tag: 'sweet', fx: { hap: 2, b_okami: 3 }, res: '가장 오래된 기술이 가장 강했다. 간식은 두 개였다.' },
      { t: '오늘은 참는다', tag: 'calm', fx: { hea: 2 }, res: '{okami|이} 놀라서 {N}의 이마를 짚어 보았다. 「어디 아파?」' },
    ],
  },
  {
    id: 'd_slip', cat: 'daily', w: 1.3, gag: true,
    title: '걸레질 직후의 마루',
    text: '아침 걸레질이 막 끝난 마루. 반질반질하다. 달리기 시작하면 멈출 수 없다.',
    choices: [
      { t: '전력으로 달려서 미끄러진다', tag: 'play', fx: { mis: 5, back: -3 }, risk: 0.08, set: 'floor_slide', res: '마루 끝에서 끝까지 미끄러졌다. 신기록. 벽에 부딪히기 직전, {shihan|이} 발로 받아 냈다.', lines: [['shihan', 'こら！　[腰]を[痛]めたらどうする！', '이 녀석! 허리 다치면 어쩌려고!']] },
      { t: '마른 곳만 골라 천천히 걷는다', tag: 'calm', fx: { back: 2 }, res: '조심스러운 발걸음. 마루 위에 작은 발자국이 점선처럼 찍혔다. 다시 걸레질.' },
    ],
  },
  {
    id: 'd_gap', cat: 'daily', gag: true, minAge: 1,
    title: '호구 선반 틈새',
    text: '호구 선반과 벽 사이 틈새에 공이 굴러 들어갔다. 틈은 좁지만, 닥스훈트는 길다.',
    choices: [
      { t: '몸을 쭉 펴서 들어간다', tag: 'brave', fx: { brave: 3, mis: 3 }, res: '공은 꺼냈다. 그런데 몸이 빠지지 않았다. {shihan|과} {worker|가} 선반을 들어 올려 구조했다. 구조 시간 15분.' },
      { t: '틈새 앞에서 짖어 사람을 부른다', tag: 'guard', fx: { b_shihan: 2, soc: 1 }, res: '{shihan|이} 죽도로 공을 꺼내 주었다. 죽도 쓰임새가 하나 늘었다.' },
    ],
  },
  {
    id: 'd_kamidana', cat: 'daily',
    title: '신단을 향해',
    text: '연습 시작 전, 다 함께 도장 정면의 신단을 향해 예를 올린다. 그 순간 도장이 조용해진다.',
    choices: [
      { t: '모두와 같은 방향을 보고 엎드린다', tag: 'calm', fx: { b_roshi: 3, b_shihan: 3 }, set: 'dog_rei', res: '{roshi|이} 그걸 보고 아무 말도 하지 않았다. 그 침묵이 칭찬이라는 걸, 도장 사람들은 다 알았다.' },
      { t: '조용해진 틈에 꼬리로 마루를 친다', tag: 'play', fx: { mis: 3 }, res: '탁, 탁, 탁. 조용한 도장에 꼬리 소리가 울렸다. 아이들 어깨가 들썩였다.' },
    ],
  },
  {
    id: 'd_vacuum', cat: 'daily', gag: true,
    title: '청소기라는 괴물',
    text: '토요일 아침. {okami|이} 창고에서 청소기를 꺼냈다. 그 소리가 시작됐다.',
    choices: [
      { t: '괴물에게 정면으로 맞선다', tag: 'brave', fx: { brave: 5, hap: -1 }, res: '짖고, 물러서고, 다시 짖었다. 청소기는 물러서지 않았다. 무승부.' },
      { t: '죽도 가방 속으로 피난한다', tag: 'calm', fx: { hap: 1 }, cnt: 'bag', res: '대청소가 끝날 때까지 죽도 가방 속에 있었다. 죽도 가방 안은 청소되지 않았다.' },
    ],
  },
  {
    id: 'd_mirror', cat: 'daily', stage: ['puppy', 'young'], gag: true,
    title: '거울 속의 개',
    text: '휘두르기 자세를 확인하는 도장 거울. 그 안에 길쭉한 개가 한 마리 있다. 이쪽을 노려본다.',
    choices: [
      { t: '거울 속 개에게 짖는다', tag: 'guard', fx: { brave: 3, mis: 2 }, res: '상대도 짖었다(소리는 안 났다). 30분의 대치 끝에 {N|은} 지쳐서 잤다. 상대도 잤다.' },
      { t: '거울 앞에서 꼬리를 흔들어 본다', tag: 'social', fx: { soc: 2, hap: 2 }, res: '상대도 꼬리를 흔들었다. 친구가 생겼다. 거울에 코 자국이 늘었다.' },
    ],
  },
  {
    id: 'd_sock', cat: 'daily', gag: true,
    title: '양말 도둑',
    text: '검도는 맨발로 한다. 그래서 탈의실에는 양말이 잔뜩 있다. 한 짝씩.',
    choices: [
      { t: '한 짝씩 모아 개집에 쌓는다', tag: 'play', fx: { mis: 5 }, set: 'sock_thief', res: '한 달 뒤 개집에서 양말 열네 짝이 나왔다. 짝이 맞는 건 하나도 없었다.' },
      { t: '양말 한 짝을 주인에게 가져다준다', tag: 'social', fx: { soc: 3, b_worker: 2 }, res: '주인은 {worker}였다. 하필 구멍 난 쪽이었다.' },
    ],
  },
  {
    id: 'd_tenugui', cat: 'daily', w: 1.1,
    title: '머리 수건 줄다리기',
    text: '{kid|이} 머리 수건을 흔들어 보였다. 도전장이다.',
    choices: [
      { t: '온몸으로 당긴다', tag: 'play', fx: { mis: 3, b_kid: 4, hea: 1 }, res: '닥스훈트의 턱 힘은 생각보다 세다. {kid|이} 엉덩방아를 찧었다. 머리 수건은 {N}의 것이 되었다.' },
      { t: '져 주는 척하다가 갑자기 당긴다', tag: 'brave', fx: { b_kid: 4, brave: 2 }, res: '「사람 같은 전술이야!」 {kid|은} 감탄했다. 《打たせて打つ》를 아는 개다.' },
    ],
  },
  {
    id: 'd_thunder', cat: 'daily', season: ['summer'],
    title: '천둥',
    text: '저녁 연습 중 천둥이 쳤다. 도장 유리창이 덜컹거렸다.',
    choices: [
      { t: '연습하는 사람들 사이를 지나 {roshi} 옆으로', tag: 'brave', req: (s) => !has(s, 'roshi_gone'), fx: { brave: 3, b_roshi: 4 }, res: '{roshi|은} 정좌한 채로 {N}의 등에 손을 얹었다. 천둥이 멀어질 때까지.' },
      { t: '사무실 책상 밑에 숨는다', tag: 'calm', fx: { hap: -1, b_okami: 3 }, res: '책상 밑에는 이미 {okami}의 발이 있었다. 둘이 같이 천둥을 견뎠다.' },
      { t: '천둥을 향해 짖는다', tag: 'guard', fx: { brave: 4, hap: -1 }, res: '천둥은 대답했다. 더 크게. {N|은} 다섯 번째에 포기했다.' },
    ],
  },
  {
    id: 'd_heat', cat: 'daily', season: ['summer'],
    title: '한여름의 타일',
    text: '35도. 도장 마루도 미지근하다. 가장 시원한 곳은 화장실 앞 타일 바닥이다.',
    choices: [
      { t: '타일 위에 납작 엎드린다', tag: 'lazy', fx: { hea: 2, hap: 2 }, res: '배를 타일에 붙이고 뒷다리를 쭉 뻗었다. 「닥스 펼침」이라 불리는 자세다.' },
      { t: '{okami|가} 뿌리는 물줄기에 뛰어든다', tag: 'play', fx: { hap: 3, mis: 2 }, res: '현관 앞에 뿌린 물을 맞으러 갔다. 물을 뿌리는 쪽이 더 신나 보였다.' },
    ],
  },
  {
    id: 'd_cicada', cat: 'daily', season: ['summer'], gag: true,
    title: '매미',
    text: '마당에 매미가 떨어져 있다. 뒤집혀서 움직이지 않는다. 다가가면…….',
    choices: [
      { t: '코로 툭 건드린다', tag: 'brave', fx: { brave: 2, hap: -1 }, res: '매미가 맹렬하게 울며 날아올랐다. 매미의 마지막 반격이다. {N|은} 세 바퀴를 굴렀다.' },
      { t: '멀리서 지켜본다', tag: 'calm', fx: { hap: 1 }, res: '30분 뒤에도 매미는 거기 있었다. {N}도 거기 있었다. 여름이란 그런 것이다.' },
    ],
  },
  {
    id: 'd_fireworks', cat: 'daily', season: ['summer'],
    title: '불꽃놀이 밤',
    text: '강 건너에서 불꽃놀이가 시작됐다. 쿵, 쿵 소리가 가슴을 울린다.',
    choices: [
      { t: '{kid|과} 툇마루에서 같이 본다', tag: 'sweet', fx: { b_kid: 5, brave: 1 }, res: '{kid|이} 소리 날 때마다 {N}의 귀를 막아 주었다. 덕분에 불꽃의 색만 보았다.' },
      { t: '죽도 가방 속에 숨어 끝날 때까지 버틴다', tag: 'calm', fx: { hap: -1 }, cnt: 'bag', res: '죽도 가방 속에서 쿵 소리를 백 번 셌다. 마지막 백한 번째가 제일 컸다.' },
    ],
  },
  {
    id: 'd_snow', cat: 'daily', season: ['winter'], req: (s) => s.world.region.snow >= 0.3,
    title: '눈이 쌓였다',
    text: '아침에 일어나니 세상이 하얗다. 쌓인 눈이 {N}의 다리보다 깊다.',
    choices: [
      { t: '눈 속으로 돌진한다', tag: 'brave', fx: { brave: 3, hea: 1, hap: 3 }, res: '하얀 눈 속에 길쭉한 터널이 생겼다. 꼬리만 보였다. 꼬리가 움직이는 곳이 곧 {N}의 위치다.' },
      { t: '현관에서 꿈쩍도 안 한다', tag: 'lazy', fx: { hap: 1 }, res: '{shihan|이} 눈을 치워 길을 만들어 주었다. 개 한 마리 폭의 길이었다.' },
    ],
  },
  {
    id: 'd_kotatsu', cat: 'daily', season: ['winter'],
    title: '사무실의 고타쓰',
    text: '사무실에 고타쓰가 나왔다. 이불 속은 따뜻하고 어둡다. 굴을 좋아하는 개에게는 낙원이다.',
    choices: [
      { t: '고타쓰 속에서 나오지 않는다', tag: 'lazy', fx: { hap: 4 }, set: 'kotatsu_dweller', res: '고타쓰에 발을 넣은 사람마다 비명을 질렀다. 안에 털 뭉치가 있으니까.' },
      { t: '고타쓰 위의 귤을 노린다', tag: 'food', fx: { mis: 3 }, res: '귤은 굴러 떨어졌다. 껍질이 써서 그만두었다. 귤 껍질은 {elder}의 차 위에 떨어졌다.' },
    ],
  },
  {
    id: 'd_leaves', cat: 'daily', season: ['autumn'],
    title: '낙엽 더미',
    text: '{shihan|이} 도장 마당의 낙엽을 쓸어 모았다. 커다란 낙엽 더미 하나.',
    choices: [
      { t: '낙엽 더미에 뛰어든다', tag: 'play', fx: { mis: 4, hap: 3 }, res: '낙엽이 사방으로 흩어졌다. {shihan|은} 빗자루를 든 채 한숨을 쉬었다. 그리고 다시 쓸었다. 그리고 {N|은} 다시 뛰어들었다.' },
      { t: '낙엽 더미 속에 굴을 파고 숨는다', tag: 'lazy', fx: { hap: 3 }, res: '{shihan|이} 더미를 쓰레기봉투에 담으려다 털 뭉치를 발견했다. 위험한 순간이었다.' },
    ],
  },
  {
    id: 'd_rabies', cat: 'daily', season: ['spring'], minAge: 0.75,
    title: '봄의 주사',
    text: '봄은 광견병 예방 주사의 계절이다. 동물병원 대기실. {N|은} 이미 알고 있다.',
    choices: [
      { t: '진찰대 위에서 의젓하게 버틴다', tag: 'brave', fx: { brave: 3, hea: 2 }, res: '수의사 선생님이 「도장 개답네요」라고 칭찬했다. 대기실로 나오자마자 {okami}의 다리에 매달렸다.' },
      { t: '{okami}의 겨드랑이에 머리를 박는다', tag: 'sweet', fx: { b_okami: 3, hea: 2 }, res: '보지 않으면 무섭지 않다. 주사는 3초 만에 끝났다.' },
    ],
  },
  {
    id: 'd_groom', cat: 'daily',
    title: '털 손질의 날',
    text: [
      { if: (s) => s.dog.hair === 'long', v: '장모 닥스훈트의 귀털과 꼬리털은 빗질하지 않으면 금방 엉킨다. {okami|이} 빗을 들었다.' },
      { if: (s) => s.dog.hair === 'wire', v: '와이어 닥스훈트의 털은 가끔 손으로 뽑아 정리해 줘야 한다. 오늘은 트리밍 날. 눈썹과 수염은 남긴다.' },
      { if: (s) => s.dog.hair === 'smooth', v: '단모라도 털은 빠진다. 많이. 도장 마루에 떨어진 털을 보다 못한 {okami|이} 고무 브러시를 들었다.' },
    ],
    lines: [
      { if: (s) => s.dog.hair === 'wire', l: [['shihan', '[眉毛]が[立派]だな。{roshi.s}先生みたいだ。', '눈썹이 멋지네. {roshi.s} 선생님 같다.']] },
    ],
    choices: [
      { t: '눈을 감고 맡긴다', tag: 'calm', fx: { b_okami: 4, hea: 1 }, res: '손질이 끝나자 {N|은} 한층 반짝였다. 오늘의 연습 견학은 특등석에서.' },
      { t: '빗을 물고 도망간다', tag: 'play', fx: { mis: 4 }, res: '빗은 탈의실 구석에서 발견됐다. 손질은 다음 날로 미뤄졌다.' },
    ],
  },
  {
    id: 'd_birthday', cat: 'daily', minAge: 1.5, maxAge: 9,
    title: '개 케이크',
    text: '{kid|이} 고구마와 요구르트로 만든 개용 케이크를 가져왔다. 초는 꽂혀 있지만 불은 안 붙였다. 위험하니까.',
    lines: [['kid', '[本当]の[誕生日]は調べ〘ようがない|ようがない〙から、[今日]にしよう！', '진짜 생일은 알아볼 길이 없으니까, 오늘로 하자!']],
    choices: [
      { t: '한입에 먹는다', tag: 'food', fx: { hap: 5, hea: -1 }, res: '케이크는 2초 만에 사라졌다. 사진은 찍지 못했다. {kid|은} 다음 해에 다시 만들겠다고 했다.' },
      { t: '노래가 끝날 때까지 기다린다', tag: 'calm', fx: { hap: 4, b_kid: 4 }, res: '생일 축하 노래 1절이 끝날 때까지 침을 흘리며 기다렸다. 박수가 터졌다. 케이크는 3초 만에 사라졌다.' },
    ],
  },
  {
    id: 'd_xmas', cat: 'daily', season: ['winter'],
    title: '도장의 크리스마스',
    text: '아이들 연습 마지막 날. {okami|이} 산타 모자를 꺼냈다. 개 사이즈다.',
    choices: [
      { t: '모자를 쓰고 선물을 나눠 주는 역을 맡는다', tag: 'social', fx: { soc: 4, b_kid: 3 }, res: '과자 봉지를 등에 묶고 아이들 사이를 돌았다. 산타보다 인기가 많았다.' },
      { t: '모자를 벗겨서 씹는다', tag: 'play', fx: { mis: 4 }, res: '산타 모자의 방울이 떨어져 나갔다. {shihan|이} 그걸 주머니에 넣고 「내년엔 이거 없이」라고 했다.' },
    ],
  },
  {
    id: 'd_setsubun', cat: 'daily', season: ['winter'], gag: true,
    title: '세쓰분의 도깨비',
    text: '2월 세쓰분. 콩을 던져 도깨비를 쫓는 날이다. 도깨비 가면을 쓴 사람은 {shihan}. 아이들이 볶은 콩을 던진다.',
    lines: [['@子どもたち', '[鬼]は[外]！　[福]は[内]！', '도깨비는 밖으로! 복은 안으로!'], ['okami', '{N}、豆は[拾]って[食]べちゃダメよ。[喉]に[詰]まるから。', '{N}, 콩은 주워 먹으면 안 돼. 목에 걸리니까.']],
    choices: [
      { t: '도깨비를 향해 용감하게 짖는다', tag: 'guard', fx: { brave: 4, b_kid: 2 }, set: 'oni_barked', res: '도깨비는 도장 밖으로 쫓겨났다. 가면을 벗은 {shihan|이} 「{N|이} 제일 무서웠다」고 했다.' },
      { t: '도깨비 편에 서서 아이들을 막는다', tag: 'play', fx: { mis: 5, b_shihan: 3 }, res: '도깨비와 개 연합군. 아이들의 콩 세례를 같이 맞았다. 도깨비가 {N|을} 안고 도망쳤다.' },
    ],
  },
  {
    id: 'd_tsukimi', cat: 'daily', season: ['autumn'],
    title: '달맞이',
    text: '보름달 밤. 도장 툇마루에 억새와 달맞이 경단이 놓였다. 다들 연습을 마치고 잠깐 앉았다.',
    choices: [
      { t: '달을 보며 길게 운다', tag: 'brave', fx: { hap: 2, mis: 2 }, res: '「아오오오」. 늑대의 피가 아주 조금 남아 있었다. 다들 박수를 쳤다.' },
      { t: '경단 접시 옆에서 조용히 달을 본다', tag: 'calm', fx: { hap: 3, soc: 1 }, res: '경단은 못 먹었지만, 그 자리에 있었다는 게 좋았다.' },
    ],
  },
  {
    id: 'd_postman', cat: 'daily', w: 1.1,
    title: '택배 기사와의 숙명',
    text: '현관 초인종. 택배 기사다. 개와 택배 기사는 태곳적부터 숙적이다.',
    choices: [
      { t: '현관에서 맹렬히 짖는다', tag: 'guard', fx: { brave: 3, soc: -1 }, res: '택배 기사는 익숙하게 상자를 내려놓고 「오늘도 수고!」 하고 갔다. 정작 수고한 건 개였다.' },
      { t: '꼬리를 흔들며 상자 냄새를 맡는다', tag: 'social', fx: { soc: 4 }, set: 'postman_friend', res: '택배 기사가 쪼그려 앉아 {N|을} 쓰다듬었다. 「이 집 개는 착하네.」 숙적의 역사가 끝났다.' },
    ],
  },
  {
    id: 'd_crow', cat: 'daily', gag: true,
    title: '까마귀의 습격',
    text: '마당에서 간식 뼈를 즐기고 있는데, 담장 위에 까마귀가 내려앉았다. 노리고 있다.',
    choices: [
      { t: '뼈를 물고 집 안으로 도망친다', tag: 'calm', fx: { hap: 2 }, res: '전략적 후퇴. 뼈는 무사했다. 까마귀는 「캬」 하고 한 번 울고 날아갔다.' },
      { t: '까마귀를 향해 돌진한다', tag: 'brave', fx: { brave: 4, hap: -2 }, res: '돌진하는 사이 다른 까마귀가 뼈를 가져갔다. 2인조였다. 검도로 치면 《二段技》였다.' },
    ],
  },
  {
    id: 'd_bath', cat: 'daily',
    title: '목욕 날',
    text: '도장 뒤 개수대. {shihan|이} 소매를 걷었다. 오늘은 목욕 날이다.',
    choices: [
      { t: '얌전히 몸을 맡긴다', tag: 'calm', fx: { hea: 2, b_shihan: 3 }, res: '깨끗해졌다. 그리고 바로 마당 흙 위에서 등을 비볐다.' },
      { t: '젖은 채로 탈의실까지 질주해 몸을 턴다', tag: 'play', fx: { mis: 5, b_worker: -2 }, res: '널어 둔 호구에 물방울이 튀었다. 그날 호구에서는 샴푸 냄새가 났다. 의외로 평이 좋았다.' },
    ],
  },
  {
    id: 'd_nails', cat: 'daily', minAge: 1,
    title: '발톱 깎기',
    text: '마루 위에서 발톱 소리가 탁탁 난다. 발톱을 깎을 때가 됐다.',
    choices: [
      { t: '{kor}의 무릎 위에서 깎는다', tag: 'sweet', req: (s) => !has(s, 'kor_left'), fx: { b_kor: 5 }, res: '{kor|은} 한국에서 키우던 개 발톱도 자기가 깎았다고 한다. 솜씨가 좋았다. 한국어로 「착하다」라고 계속 말해 주었다.' },
      { t: '발을 숨기고 끝까지 저항한다', tag: 'guard', fx: { mis: 3, b_okami: -1 }, res: '결국 동물병원에 가서 깎았다. 진료비 500엔. {okami|은} 「다음엔 집에서 깎자」며 달력에 동그라미를 쳤다.' },
    ],
  },
  {
    id: 'd_diet', cat: 'daily', minAge: 3, req: (s) => s.st.hea < 65 || s.dog.per === 'kuishinbo',
    title: '다이어트 선언',
    text: '동물병원에서 「살이 조금 쪘네요. 닥스훈트는 허리를 위해서라도 체중 관리가 중요해요」라는 말을 들었다. {okami|이} 도장 사람들에게 선언했다.',
    lines: [['okami', '[獣医]さんに[言]われたので、[今日]から{N}に[勝手]におやつをあげるの、[禁止]です！', '수의사 선생님이 그러셨으니까, 오늘부터 {N}한테 멋대로 간식 주는 거 금지입니다!']],
    choices: [
      { t: '받아들이고 산책을 늘린다', tag: 'brave', fx: { hea: 5, back: 2, hap: -2 }, set: 'diet_ok', res: '한 달 뒤, 체중이 300그램 줄었다. 허리선이 돌아왔다.' },
      { t: '{elder}의 가방을 몰래 노린다', tag: 'food', fx: { hap: 3, hea: -2, mis: 3 }, set: 'diet_fail', res: '고구마 말랭이 밀거래가 발각됐다. {elder|은} {okami}에게 혼났다. 70대 어른이.' },
    ],
  },
  {
    id: 'd_dream', cat: 'daily', minAge: 2,
    title: '잠꼬대',
    text: '낮잠 중. 다리가 바동바동 움직인다. 꿈속에서 무언가를 쫓고 있다. 「웁, 웁」 작은 소리도 난다.',
    lines: [['kid', '[夢]の中で[走]ってる……。何を[追]いかけてるんだろ。', '꿈에서 뛰고 있나 봐……. 뭘 쫓아가는 걸까.']],
    choices: [
      { t: '꿈속에서 《小手》를 쫓는다', tag: 'brave', fx: { brave: 2, hap: 2 }, res: '깨어나서 제일 먼저 탈의실의 《小手》 냄새를 맡으러 갔다. 확인 작업이다.' },
      { t: '꿈속에서 고로케를 쫓는다', tag: 'food', fx: { hap: 3 }, res: '깨어나서 입맛을 다셨다. {kid|이} 「먹었구나」 하며 웃었다.' },
    ],
  },
  {
    id: 'd_hide_treat', cat: 'daily', minAge: 1,
    title: '간식 은닉',
    text: '간식을 하나 받았다. 지금 먹기는 아깝다. 숨길 곳을 찾아야 한다.',
    choices: [
      { t: '누군가의 《小手》 속에 숨긴다', tag: 'play', fx: { mis: 4 }, cnt: 'kote', set: 'treat_in_kote', res: '다음 날 연습에서 {kid|이} 《小手》를 끼다가 비명을 질렀다. 「뭔가 있어!」 간식은 몰수됐다.' },
      { t: '사무실 방석 밑에 숨긴다', tag: 'calm', fx: { hap: 2 }, res: '방석 밑은 안전했다. 사흘 뒤 꺼내 먹었다. 맛은 그대로였다(고 믿고 싶다).' },
    ],
  },
  {
    id: 'd_sns', cat: 'daily', minAge: 1.5, social: true,
    title: '조회수 3만',
    text: '{kid|이} 올린 「죽도 가방에서 자는 닥스훈트」 영상이 동네를 넘어 퍼졌다. 조회수 3만.',
    lines: [['kid', '{N}、[有名人]……[有名犬]だよ！　写真が広まる〘につれて|につれて〙、どんどん増えてる！', '{N}, 유명인……유명견이야! 사진이 퍼질수록 계속 늘고 있어!']],
    choices: [
      { t: '찾아온 구경꾼들에게 서비스한다', tag: 'social', fx: { soc: 5, hap: 2 }, set: 'sns_famous', res: '주말마다 도장 앞에 사진 찍으러 오는 사람이 생겼다. 그중 둘은 체험 연습까지 하고 갔다.' },
      { t: '평소처럼 죽도 가방에 들어가 버린다', tag: 'lazy', fx: { hap: 3 }, cnt: 'bag', res: '유명해져도 죽도 가방은 죽도 가방이다. 구경꾼들은 「실물이다!」 하며 같은 장면을 또 찍었다.' },
    ],
  },
  {
    id: 'd_hide_seek', cat: 'daily', maxAge: 9,
    title: '숨바꼭질',
    text: '연습 전 아이들이 숨바꼭질을 시작했다. 술래는 {N}.',
    choices: [
      { t: '냄새로 한 명씩 찾아낸다', tag: 'brave', fx: { soc: 3, b_kid: 3 }, res: '호구 선반 뒤, 탈의실 사물함, 사무실 커튼 뒤. 3분 만에 전원 발견. 아이들은 「반칙이야!」라고 항의했다.' },
      { t: '찾는 척하다가 같이 숨는다', tag: 'play', fx: { mis: 3, b_kid: 4 }, res: '결국 {shihan|이} 연습 시작 시간에 다 같이 찾아냈다. 커튼 뒤에 아이 셋과 개 한 마리.' },
    ],
  },
  {
    id: 'd_new_puppy', cat: 'daily', minAge: 5, maxAge: 11, major: true,
    title: '새 강아지가 왔다',
    text: '{worker|이} 친척 집에서 태어난 강아지를 잠시 맡게 됐다며 도장에 데려왔다. 작은 닥스훈트. 겁도 없이 {N}의 꼬리를 문다.',
    lines: [['worker', '[一週間]だけ[頼]めませんか。……{N}、[先輩]になった〘からには|からには〙、[色々]教えてやってくれ。', '일주일만 부탁드려도 될까요. ……{N}, 선배가 된 이상 이것저것 가르쳐 줘.']],
    choices: [
      { t: '대장답게 도장 규칙을 가르친다', tag: 'guard', fx: { brave: 3, b_worker: 3 }, set: 'puppy_mentor', res: '마루 앞에서 멈추기, 죽도 가방은 주인이 없을 때만, 《小手》는 냄새만. 일주일 뒤 강아지는 의젓해져서 돌아갔다.' },
      { t: '질투해서 {okami}의 무릎을 독점한다', tag: 'sweet', fx: { b_okami: 4, hap: -1 }, set: 'puppy_jealous', res: '일주일 동안 {okami}의 무릎에서 내려오지 않았다. 강아지는 {kid}의 무릎으로 갔다. 공평한 분배였다.' },
      { t: '같이 마루에서 미끄러지며 논다', tag: 'play', fx: { mis: 4, hap: 4, back: -2 }, risk: 0.05, set: 'puppy_play', res: '길쭉한 개 두 마리의 미끄럼 대회. {shihan|은} 말리는 걸 포기했다.' },
    ],
  },
  {
    id: 'd_boss', cat: 'daily', minAge: 3, w: 1.1,
    title: '대장 행세',
    text: '봄. 새로 입문한 초등학생들이 줄줄이 현관에 들어온다. 이제는 「후배」가 아니라 도장 최고참 「선배」로서 할 일이 있다.',
    choices: [
      { t: '현관에서 한 명씩 냄새 심사를 한다', tag: 'guard', fx: { brave: 3, soc: 2 }, set: 'boss_check', res: '신입생들은 {N}의 심사를 받고 나서야 마루에 올라갔다. {shihan|은} 그걸 「입문 의식」이라고 부르기 시작했다.' },
      { t: '신입생 무릎마다 올라가 본다', tag: 'social', fx: { soc: 5 }, res: '대장의 위엄은 없었다. 대신 신입생 전원이 첫날부터 도장을 좋아하게 됐다.' },
    ],
  },
  {
    id: 'd_rain', cat: 'daily', w: 1.2, req: (s) => !has(s, 'rain_refuse'),
    title: '비 오는 날의 산책',
    text: '비가 온다. 우비를 든 {okami|이} 현관에서 기다리고 있다. 그런데 {N}의 다리가 움직이지 않는다.',
    lines: [['okami', 'ほら、お[散歩]！　……え、[行]かないの？　雨が嫌いな〘わけでもない|わけではない〙でしょうに。', '자, 산책! ……어, 안 가? 비를 싫어하는 것도 아니면서.']],
    choices: [
      { t: '현관 매트 위에서 버틴다', tag: 'lazy', fx: { hap: 2, hea: -1 }, set: 'rain_refuse', later: ['c_raincoat', 2], res: '네 다리를 쭉 뻗고 버텼다. 닥스훈트는 바닥에 가깝다. 한번 버티면 들기 어렵다. 산책은 취소됐다.' },
      { t: '우비를 입고 씩씩하게 나간다', tag: 'brave', fx: { brave: 3, hea: 2 }, res: '배가 땅에 가까운 개에게 빗물 웅덩이는 강이다. 그래도 끝까지 걸었다. 배는 흠뻑 젖었다.' },
    ],
  },
  {
    id: 'd_cleanup', cat: 'daily', season: ['winter'], cal: true,
    title: '연말 대청소',
    text: '12월 마지막 연습 날. 연습 대신 모두가 걸레를 들었다. 도장 대청소다. 창문, 마루, 호구 선반, 그리고 신단.',
    choices: [
      { t: '걸레질하는 사람들 뒤를 졸졸 따라다닌다', tag: 'social', fx: { soc: 3, b_shihan: 2 }, res: '걸레가 지나간 자리에 발자국을 찍는 개, 그 발자국을 지우는 사람. 대청소는 예정보다 한 시간 길어졌다.' },
      { t: '마루 밑에서 1년 치 보물을 꺼내 온다', tag: 'play', fx: { mis: 4 }, res: '양말 다섯, 머리 수건 둘, 고무공 하나, 그리고 누군가의 차 열쇠. 열쇠 주인은 석 달째 찾고 있었다.' },
    ],
  },
];
