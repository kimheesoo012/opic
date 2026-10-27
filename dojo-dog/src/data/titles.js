// 칭호. p가 클수록 먼저 표시된다.
const has = (s, f) => s.flags[f] !== undefined;
const c = (s, k) => s.cnt[k] || 0;

export const TITLES = [
  { id: 'interhigh', p: 90, ja: 'インターハイを見届けた犬', ko: '인터하이를 지켜본 개', cond: (s) => has(s, 'saw_interhigh') },
  { id: 'roshi_last', p: 88, ja: '老師範の最後の相棒', ko: '노사범의 마지막 짝꿍', cond: (s) => has(s, 'roshi_last_partner') },
  { id: 'fish', p: 86, ja: '魚泥棒事件', ko: '생선 도둑 사건', cond: (s) => has(s, 'fish_thief') },
  { id: 'eight', p: 85, ja: '八段を見届けた犬', ko: '8단 합격을 지켜본 개', cond: (s) => has(s, 'shihan_8dan') },
  { id: 'saved', p: 84, ja: '道場を救った胴長', ko: '도장을 구한 롱다리……가 아니라 롱허리', cond: (s) => has(s, 'dojo_saved') && s.subs.length >= 4 },
  { id: 'rival', p: 80, ja: '委員長の宿敵', ko: '위원장의 숙적', cond: (s) => s.foiled >= 5 },
  { id: 'iincho_friend', p: 79, ja: '委員長の友', ko: '위원장의 친구', cond: (s) => has(s, 'i_final_done') && s.foiled < 5 },
  { id: 'interpreter', p: 78, ja: '異国の剣士の通訳犬', ko: '이국 검사의 통역견', cond: (s) => s.bond.kor >= 70 },
  { id: 'tambourine', p: 76, ja: 'タンバリンの名手', ko: '탬버린의 명수', cond: (s) => has(s, 'tambourine_master') },
  { id: 'bag', p: 70, ja: '竹刀袋の住人', ko: '죽도 가방의 주민', cond: (s) => c(s, 'bag') >= 3 },
  { id: 'kote', p: 68, ja: '小手ハンター', ko: '《小手》 사냥꾼', cond: (s) => c(s, 'kote') >= 2 },
  { id: 'exam', p: 66, ja: '段審査の見守り番', ko: '段 심사 지킴이', cond: (s) => c(s, 'exam_watch') >= 4 },
  { id: 'idol', p: 64, ja: '町内会のアイドル', ko: '동네 아이돌', cond: (s) => s.st.soc >= 80 },
  { id: 'rain', p: 60, ja: '雨の日は休む派', ko: '비 오는 날은 쉬는 파', cond: (s) => has(s, 'rain_refuse') },
  { id: 'stairs', p: 58, ja: '階段に勝った犬', ko: '계단을 이긴 개', cond: (s) => has(s, 'stairs_won') },
  { id: 'guard', p: 56, ja: '道場の守り神', ko: '도장의 수호신', cond: (s) => s.st.brave >= 80 },
  { id: 'prank', p: 54, ja: '道場一のいたずら犬', ko: '도장 제일의 장난꾸러기', cond: (s) => s.st.mis >= 85 },
  { id: 'subs', p: 52, ja: '町の何でも屋', ko: '동네 해결사', cond: (s) => s.subs.length >= 8 },
  { id: 'nap', p: 40, ja: '昼寝の達人', ko: '낮잠의 달인', cond: (s) => has(s, 'life_nap') || has(s, 'last_engawa') },
  { id: 'happy', p: 30, ja: '幸せな道場犬', ko: '행복한 도장 개', cond: (s) => s.st.hap >= 70 },
  { id: 'default', p: 1, ja: '道場の犬', ko: '도장의 개', cond: () => true },
];
