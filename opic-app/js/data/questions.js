/* 문제은행
   - 행 형식: [id 접미사, 유형, 난이도(1 기본·2 중간·3 고난도), 영어 질문, 플래그]
   - 유형: intro 자기소개 · describe 묘사 · routine 습관/루틴 · past 과거 경험 · compare 비교
           rp_ask 롤플레이(질문하기) · rp_solve 롤플레이(문제 해결) · issue 고난도 이슈
   - 분류(cat): survey 설문 주제 · surprise 돌발 주제 · roleplay 롤플레이 세트 · general 공통
   - 플래그: L = 기존 시뮬레이터 문항을 다듬어 가져옴, tw = 관점 바꾸기(즉흥 훈련용) 질문
   기존 문항 정리 내역은 opic-app/README.md 「문제은행」 참고. */
(function (root) {
  'use strict';

  const TOPICS = [];
  const QUESTIONS = [];
  function T(id, label, cat, rows) {
    TOPICS.push({ id, label, cat });
    rows.forEach(r => {
      const flags = r[4] || '';
      QUESTIONS.push({
        id: id + '.' + r[0], topic: id, cat, type: r[1], level: r[2], text: r[3],
        legacy: flags.includes('L'), twist: flags.includes('tw')
      });
    });
  }

  /* ───────── 공통 ───────── */
  T('intro', '자기소개', 'general', [
    ['1', 'intro', 1, "Let's start the interview now. Tell me a little about yourself.", 'L'],
    ['2', 'intro', 1, "Before we begin, I'd like to get to know you. Please introduce yourself."]
  ]);

  /* ───────── 설문 주제: 거주지·학교·일 ───────── */
  T('home', '거주지', 'survey', [
    ['d1', 'describe', 1, 'I would like to know where you live. Describe your home in detail. What does it look like, and which room is your favorite? Why?', 'L'],
    ['r1', 'routine', 1, 'What do you usually do at home on weekdays and on weekends? Describe a typical day at home from morning to night.', 'L'],
    ['p1', 'past', 2, 'Tell me about a problem you had at home, such as something breaking or a noise issue. What was the problem, and how did you solve it?', 'L'],
    ['d2', 'describe', 1, 'Tell me about your favorite piece of furniture or appliance at home. What is it, and why is it important to you?', 'L'],
    ['c1', 'compare', 2, 'Compare the home you live in now with a home you lived in before. How are they different?', 'L'],
    ['p2', 'past', 2, 'Tell me about a change you made to your home, such as rearranging the furniture or buying something new. Why did you make the change, and how did it turn out?', 'L'],
    ['r2', 'routine', 1, 'Who does the housework where you live? Tell me about the chores you usually do and how often you do them.'],
    ['t1', 'compare', 2, 'Think about the neighborhood around your home. How has it changed since you first moved there?', 'tw'],
    ['i1', 'issue', 3, 'Housing prices are a big topic in many countries. Why is it so hard for young people to find a place to live these days, and what could be done about it?']
  ]);
  T('school', '학교·수업', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you are a student. Tell me about your school. Where is it, and what does the campus look like?'],
    ['r1', 'routine', 1, 'Describe a typical day at school. What classes do you take, and what do you do between classes?'],
    ['p1', 'past', 2, 'Tell me about a memorable project or assignment you worked on. What was it about, who did you work with, and how did it go?'],
    ['d2', 'describe', 1, 'What is your major, and why did you choose it? Tell me what you study in your major.'],
    ['c1', 'compare', 2, 'Compare your life as a university student with your life in high school. What has changed the most?'],
    ['t1', 'past', 2, 'Think about your first week at university. What was it like, and what surprised you the most?', 'tw'],
    ['i1', 'issue', 3, 'Many students worry about getting a job after graduation. What do students in your country do to prepare, and do you think it is too much pressure?']
  ]);
  T('work', '일·아르바이트', 'survey', [
    ['d1', 'describe', 1, 'Tell me about a place where you have worked, such as a part-time job. What did you do there, and what was the place like?'],
    ['r1', 'routine', 1, 'Describe a typical working day at that job, from the moment you arrived until you left.'],
    ['p1', 'past', 2, 'Tell me about a difficult situation you had at work, such as a rude customer or a mistake. What happened, and how did you handle it?'],
    ['c1', 'compare', 2, 'Compare working a part-time job with studying. What did each one teach you?'],
    ['i1', 'issue', 3, 'Many young people in your country work part-time while studying. What are the good and bad points of this trend?']
  ]);

  /* ───────── 설문 주제: 여가 ───────── */
  T('movie', '영화 보기', 'survey', [
    ['d1', 'describe', 1, 'You indicated in the survey that you like to watch movies. Tell me about your favorite type of movie. Why do you like that genre? Please describe it in as much detail as possible.', 'L'],
    ['r1', 'routine', 1, 'Tell me about the movie theater you usually go to. Who do you usually go to the movies with, and what do you typically do before and after a movie?', 'L'],
    ['p1', 'past', 2, 'Tell me about the most memorable movie you have ever seen. What was it about, who did you watch it with, and why was it so memorable? Tell me everything from beginning to end.', 'L'],
    ['d2', 'describe', 1, 'Tell me about an actor you like. What movies have they been in, and why do you like them?', 'L'],
    ['c1', 'compare', 2, 'Compare watching movies at a theater with watching movies at home on streaming services. What are the advantages of each?', 'L'],
    ['p2', 'past', 2, 'Tell me about a time when you watched a movie that was very different from what you expected. What happened, and how did you feel?', 'L'],
    ['t1', 'compare', 2, 'Think about the first movie you remember seeing in a theater. How is going to the movies different now from when you were a child?', 'tw'],
    ['i1', 'issue', 3, 'Movie ticket prices have gone up a lot, and many people now just wait for movies to come out on streaming services. What do you think this means for movie theaters?']
  ]);
  T('performance', '공연 보기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you enjoy watching performances, such as plays or musicals. Tell me about a theater you have been to. What does it look like?', 'L'],
    ['r1', 'routine', 1, 'How often do you go to see performances, and who do you usually go with? Describe what you typically do on the day you see a show.', 'L'],
    ['p1', 'past', 2, 'Tell me about a performance that left a strong impression on you. What was it about, and why do you still remember it?', 'L'],
    ['c1', 'compare', 2, 'Compare watching a live performance with watching a recorded one on a screen. What feels different?'],
    ['t1', 'past', 2, 'Think about the first live performance you ever saw. How did you feel back then, and how has your taste changed since?', 'tw']
  ]);
  T('concert', '콘서트 보기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like going to concerts. What kind of concerts do you like, and where are they usually held? Describe the place.'],
    ['p0', 'past', 1, 'Tell me about the last concert you went to. Who was performing, and what was the atmosphere like?', 'L'],
    ['r1', 'routine', 1, 'How do you usually prepare for a concert? How do you get tickets, who do you go with, and what do you do before and after the show?', 'L'],
    ['p1', 'past', 2, 'Tell me about the most memorable concert you have ever been to. What made it so special? Describe the experience from beginning to end.', 'L'],
    ['p2', 'past', 2, 'Have you ever had trouble getting concert tickets? Tell me what happened and how it worked out.'],
    ['i1', 'issue', 3, 'Some people buy concert tickets just to resell them at much higher prices. Why is this a problem, and how could it be stopped?']
  ]);
  T('museum', '박물관 가기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like going to museums. Tell me about a museum you like. Where is it, and what can people see there?'],
    ['r1', 'routine', 1, 'What do you usually do when you visit a museum? Who do you go with, and how long do you usually stay?'],
    ['p1', 'past', 2, 'Tell me about a museum visit you remember well. When was it, what did you see, and what made it memorable?'],
    ['c1', 'compare', 2, 'Compare museums today with museums when you were a child. How have they changed?', 'tw']
  ]);
  T('park', '공원 가기', 'survey', [
    ['d1', 'describe', 1, 'You indicated in the survey that you go to parks. Describe a park you often visit. Where is it, and what does it look like? What can people do there?', 'L'],
    ['r1', 'routine', 1, 'How often do you go to the park, and when do you usually go? What do you typically do there, and who do you go with?', 'L'],
    ['p1', 'past', 2, 'Tell me about something memorable that happened at a park. When did it happen, and who was there? What exactly happened, and how did it end?', 'L'],
    ['d2', 'describe', 1, 'What do people do at the parks in your country? What kinds of activities and facilities can you find there?', 'L'],
    ['p2', 'past', 1, 'Tell me about the last time you went to a park. When was it, who were you with, and what did you do there from start to finish?', 'L'],
    ['c1', 'compare', 2, 'Compare the park you go to now with a park you used to visit when you were young. How are they different?', 'L'],
    ['t1', 'compare', 2, 'Think about your favorite park. How has it changed over the past few years, and do you like the changes?', 'tw']
  ]);
  T('camping', '캠핑하기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you enjoy camping. Where do you usually go camping? Describe the place and what you like about it.', 'L'],
    ['r1', 'routine', 1, 'What do you usually prepare before going camping, and what do you do at the campsite? Describe a typical camping trip.', 'L'],
    ['p1', 'past', 2, 'Tell me about the most memorable camping trip you have taken. What happened, and why was it so memorable?', 'L'],
    ['p2', 'past', 2, 'Tell me about a time when something went wrong on a camping trip, such as bad weather or forgotten gear. How did you deal with it?'],
    ['c1', 'compare', 2, 'Camping has become very popular in Korea. Compare how people camp now with how they camped in the past.']
  ]);
  T('beach', '해변 가기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like going to the beach. Describe a beach you often go to. Where is it, and what does it look like?', 'L'],
    ['r1', 'routine', 1, 'What do you usually do when you go to the beach? Who do you go with, and what do you bring? Describe everything from the moment you arrive until you leave.', 'L'],
    ['p1', 'past', 2, 'Tell me about the most memorable experience you have had at a beach. When was it, and what happened? Why does it stand out in your memory?', 'L'],
    ['d2', 'describe', 1, 'Tell me about the beaches in your country. Where are the famous ones, and what makes them popular?', 'L'],
    ['p2', 'past', 1, 'Tell me about the last time you went to the beach. What did you do there, and what was the weather like?', 'L'],
    ['c1', 'compare', 2, 'Compare going to the beach in summer with going in other seasons. How are the atmosphere and the activities different?', 'L'],
    ['i1', 'issue', 3, 'Many beaches have problems with trash and crowds during the summer. What causes these problems, and what can be done about them?']
  ]);
  T('sports_watch', '스포츠 관람', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like watching sports. Which sport do you like to watch, and which team or player do you support? Why?'],
    ['r1', 'routine', 1, 'Where and with whom do you usually watch games? Describe what you do on a game day.'],
    ['p1', 'past', 2, 'Tell me about the most exciting game you have ever watched. What happened, and how did you feel?'],
    ['c1', 'compare', 2, 'Compare watching a game at the stadium with watching it at home. Which do you prefer, and why?']
  ]);
  T('bar', '술집/바에 가기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you go to bars. Describe a bar or pub you like. Where is it, and what is it like inside?'],
    ['r1', 'routine', 1, 'When do you usually go to bars, and who do you go with? What do you usually order and talk about?'],
    ['p1', 'past', 2, 'Tell me about a memorable night out with your friends. Where did you go, and what happened?'],
    ['c1', 'compare', 2, 'Compare the drinking culture of young people today with that of your parents’ generation. What has changed?'],
    ['i1', 'issue', 3, 'Some people say company dinners with drinking are disappearing in Korea. Why do you think this is happening, and is it a good change?']
  ]);
  T('cafe', '카페 가기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like going to cafes. Describe your favorite cafe in detail. Where is it, what does it look like inside, and what makes it special to you?', 'L'],
    ['r1', 'routine', 1, 'How often do you go to cafes, and what do you usually do there? Who do you go with, and what do you normally order?', 'L'],
    ['p1', 'past', 2, 'Tell me about a memorable experience you had at a cafe. When was it, who were you with, and what exactly happened?', 'L'],
    ['d2', 'describe', 1, 'Tell me about the cafes in your neighborhood. What do they look like, and how are they different from each other?', 'L'],
    ['c1', 'compare', 2, 'Compare cafes today with cafes when you were younger. How have they changed in terms of menu, atmosphere, and the way people use them?', 'L'],
    ['p2', 'past', 2, 'Tell me about a time when something went wrong at a cafe, such as a wrong order or bad service. What happened, and how was it resolved?', 'L'],
    ['t1', 'compare', 2, 'Think about your favorite cafe. How has it changed since you started going there?', 'tw'],
    ['i1', 'issue', 3, 'Many students study at cafes for hours after buying just one drink. What do you think about this, from both the customer’s and the owner’s point of view?']
  ]);
  T('game', '게임하기', 'survey', [
    ['d1', 'describe', 1, 'You indicated in the survey that you like playing games. What games do you usually play? Tell me about your favorite game and why you like it.', 'L'],
    ['r1', 'routine', 1, 'When and where do you usually play games? Who do you play with, and how long do you usually play?', 'L'],
    ['p1', 'past', 2, 'Tell me about a memorable moment you had while playing a game. What happened, and why was it so memorable?', 'L'],
    ['c1', 'compare', 2, 'Compare the games you played as a child with the games you play now. How are they different?'],
    ['i1', 'issue', 3, 'Some parents worry that their children play games too much. Do you think this is a real problem? What should be done?']
  ]);
  T('sns', 'SNS', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you post on social media. Which platforms do you use, and what kind of content do you usually post or look at?', 'L'],
    ['r1', 'routine', 1, 'When do you usually check social media during the day? Describe how you use it from morning to night.', 'L'],
    ['c1', 'compare', 2, 'Compare how people shared their daily lives before social media with how they share them now. What has changed the most?', 'L'],
    ['p1', 'past', 2, 'Tell me about a post or a video that got a strong reaction, or something surprising you saw on social media. What happened?'],
    ['i1', 'issue', 3, 'Some people say social media makes people feel worse about their own lives. Do you agree? Why or why not?']
  ]);
  T('news', '뉴스 보기·듣기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you follow the news. How do you usually get the news, and what kinds of news are you interested in?'],
    ['r1', 'routine', 1, 'When do you usually check the news during the day? Describe your routine.'],
    ['p1', 'past', 2, 'Tell me about a news story that you remember well. What was it about, and why did it catch your attention?'],
    ['c1', 'compare', 2, 'Compare the way people got the news in the past with the way they get it today.'],
    ['i1', 'issue', 3, 'Fake news spreads quickly online. Why is this a problem, and what can people do to avoid being misled?']
  ]);
  T('drive', '드라이브하기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like going for drives. Where do you like to drive, and what do you see along the way?'],
    ['r1', 'routine', 1, 'Who do you usually go for a drive with, and what do you do during the drive? Do you listen to music or stop somewhere?'],
    ['p1', 'past', 2, 'Tell me about a memorable drive. Where did you go, and what happened on the way?'],
    ['p2', 'past', 2, 'Tell me about a problem you had while driving, such as getting lost or having car trouble. How did you handle it?']
  ]);
  T('shopping', '쇼핑하기', 'survey', [
    ['d1', 'describe', 1, 'You indicated in the survey that you like shopping. Where do you usually go shopping? Describe the place, what it looks like, and what stores are there.', 'L'],
    ['r1', 'routine', 1, 'How often do you go shopping, and what do you usually buy? Do you shop alone or with someone? Describe a typical shopping trip.', 'L'],
    ['p1', 'past', 2, 'Tell me about a memorable shopping experience. Maybe you bought something special, or something unexpected happened. Tell me the whole story.', 'L'],
    ['d2', 'describe', 1, 'Tell me about the stores or shopping malls in your neighborhood. What can people buy there?', 'L'],
    ['c1', 'compare', 2, 'Compare shopping online with shopping in stores. Which do you prefer, and what are the advantages and disadvantages of each?', 'L'],
    ['p2', 'past', 2, 'Tell me about a time when you had a problem with something you bought and needed a refund or an exchange. What happened?', 'L'],
    ['i1', 'issue', 3, 'Online shopping has made it very easy to buy things we do not really need. What do you think about this, and how does it affect the environment?']
  ]);
  T('tv', 'TV 보기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like watching TV. What kinds of programs do you usually watch? Tell me about your favorite program.', 'L'],
    ['r1', 'routine', 1, 'When and where do you usually watch TV? Do you watch alone or with someone? Describe your usual routine.', 'L'],
    ['c1', 'compare', 2, 'Compare the TV programs you watched as a child with the programs you watch now. How have your tastes changed?', 'L'],
    ['p1', 'past', 2, 'Tell me about a TV show or episode that you remember clearly. What was it about, and why did it stay with you?'],
    ['i1', 'issue', 3, 'Many people now watch shows on their phones instead of on a TV. How has this changed the way people watch, and the shows that get made?']
  ]);

  /* ───────── 설문 주제: 취미 ───────── */
  T('music', '음악 감상하기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like listening to music. What kind of music do you like, and who are your favorite musicians? Why do you like their music?', 'L'],
    ['r1', 'routine', 1, 'When and where do you usually listen to music? What devices or apps do you use?', 'L'],
    ['c1', 'compare', 2, 'How has your taste in music changed over the years? Compare the music you listened to in the past with the music you listen to now.', 'L'],
    ['d2', 'describe', 1, 'Tell me about a singer or band that is popular in your country these days. Why do you think they are popular?', 'L'],
    ['c2', 'compare', 2, 'Tell me about the devices you use to listen to music. How have they changed over the years?', 'L'],
    ['p1', 'past', 2, 'Tell me about a time when you heard live music, or a memorable moment related to music. What happened?', 'L'],
    ['p2', 'past', 2, 'When did you first become interested in music? Tell me how it started.'],
    ['t1', 'describe', 2, 'Imagine you have to recommend one song to a foreign friend who wants to learn about Korea. What would you choose, and why?', 'tw']
  ]);
  T('instrument', '악기 연주하기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you play a musical instrument. What instrument do you play, and what does it sound like?'],
    ['r1', 'routine', 1, 'How often do you practice, and where? Describe your usual practice routine.'],
    ['p1', 'past', 2, 'How did you first learn to play the instrument? Tell me about the time you started and what was hard at first.'],
    ['p2', 'past', 2, 'Tell me about a time when you played in front of other people. What happened, and how did you feel?']
  ]);
  T('sing', '노래 부르기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like singing. What kinds of songs do you like to sing, and where do you usually sing?'],
    ['r1', 'routine', 1, 'Tell me about the last time you went to a karaoke room. Who did you go with, and what did you do there?'],
    ['p1', 'past', 2, 'Tell me about a memorable experience related to singing, such as a performance or a funny moment at karaoke.']
  ]);
  T('dance', '춤추기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like dancing. What kind of dancing do you do, and where do you dance?'],
    ['r1', 'routine', 1, 'How do you practice dancing? Describe what you do from the beginning to the end of a practice.'],
    ['p1', 'past', 2, 'Tell me about how you started dancing, or a memorable moment while dancing.']
  ]);
  T('writing', '글쓰기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like writing. What do you usually write, such as a diary, letters, or short stories?'],
    ['r1', 'routine', 1, 'When and where do you usually write? Describe your writing routine.'],
    ['p1', 'past', 2, 'Tell me about something you wrote that is special to you. What was it, and why did you write it?']
  ]);
  T('drawing', '그림 그리기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like drawing. What do you usually draw, and what tools do you use?'],
    ['r1', 'routine', 1, 'When do you usually draw, and how long do you spend on one drawing?'],
    ['p1', 'past', 2, 'Tell me about a drawing you are proud of, or how you first got into drawing.']
  ]);
  T('cooking', '요리하기', 'survey', [
    ['d1', 'describe', 1, 'You indicated in the survey that you like cooking. What kind of food do you usually cook? Tell me about a dish you make well and how you make it.', 'L'],
    ['r1', 'routine', 1, 'How often do you cook, and when? Describe your typical routine in the kitchen, from preparation to cleanup.', 'L'],
    ['p1', 'past', 2, 'Tell me about a memorable experience you had while cooking. Maybe something went wrong, or you cooked for a special occasion. What happened?', 'L'],
    ['c1', 'compare', 2, 'Compare cooking at home with eating out or ordering delivery. What are the good and bad points of each?'],
    ['t1', 'past', 2, 'Think about the first dish you ever cooked by yourself. How did it turn out, and how have your cooking skills changed since then?', 'tw']
  ]);
  T('pet', '애완동물 기르기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you have a pet. Tell me about your pet. What does it look like, and what is its personality like?'],
    ['r1', 'routine', 1, 'How do you take care of your pet? Describe what you do for it every day.'],
    ['p1', 'past', 2, 'Tell me about a memorable or funny thing that happened with your pet.'],
    ['i1', 'issue', 3, 'More and more people in Korea live with pets. What changes has this brought to society, and what problems still need to be solved?']
  ]);
  T('reading', '독서', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like reading. What kinds of books do you enjoy, and who is your favorite author? Tell me about a book you liked.', 'L'],
    ['r1', 'routine', 1, 'When and where do you usually read? How often do you read, and how do you choose books?', 'L'],
    ['p1', 'past', 2, 'Tell me about a book that influenced you or that you could not forget. What was it about, and why did it affect you?', 'L'],
    ['c1', 'compare', 2, 'Compare reading paper books with reading e-books. Which do you prefer, and why?']
  ]);
  T('photo', '사진 촬영하기', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you enjoy taking photos. What do you usually take pictures of, and what device do you use? Tell me about your favorite photo.', 'L'],
    ['r1', 'routine', 1, 'When do you usually take photos, and what do you do with them afterwards? Describe your routine from taking a photo to sharing or storing it.', 'L'],
    ['p1', 'past', 2, 'Tell me about a memorable experience related to taking photos, such as a special moment you captured. What happened?', 'L'],
    ['c1', 'compare', 2, 'Compare taking photos with a phone today with taking photos with a film camera in the past.'],
    ['t1', 'describe', 2, 'Look back at the photos on your phone. Which one would you show a friend to explain your life right now, and why?', 'tw']
  ]);

  /* ───────── 설문 주제: 운동 ───────── */
  T('sport', '구기·라켓 운동', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you play a sport. Which sport do you play, and how is it played? Explain the basic rules.'],
    ['r1', 'routine', 1, 'When and where do you usually play, and who do you play with? Describe a typical game or practice.'],
    ['p1', 'past', 2, 'Tell me about a memorable game or match you played. What happened, and how did it end?'],
    ['p2', 'past', 2, 'Have you ever been injured while playing sports? Tell me what happened and how you recovered.']
  ]);
  T('swimming', '수영', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you enjoy swimming. Where do you usually swim? Describe the place.', 'L'],
    ['r1', 'routine', 1, 'Describe your swimming routine. How often do you swim, and what do you do before and after swimming?', 'L'],
    ['p1', 'past', 2, 'Tell me how you first learned to swim, or about a memorable experience you had while swimming.', 'L']
  ]);
  T('bike', '자전거', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you ride a bike. Where do you usually ride, and what kind of bike do you have?'],
    ['r1', 'routine', 1, 'How often do you ride, and what do you do before and after a ride?'],
    ['p1', 'past', 2, 'Tell me about a memorable bike ride, or a time something went wrong while you were riding.']
  ]);
  T('jogging', '조깅', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you enjoy jogging. Where do you usually jog, and why did you start? Describe the place where you jog.', 'L'],
    ['r1', 'routine', 1, 'Describe your jogging routine. How often do you jog, when do you go, and what do you do before and after?', 'L'],
    ['p1', 'past', 2, 'Tell me about a memorable experience you had while jogging. What happened, and why was it memorable?', 'L']
  ]);
  T('walking', '걷기', 'survey', [
    ['d1', 'describe', 1, 'You indicated in the survey that you enjoy walking. Where do you usually walk? Describe the place and tell me why you like walking there.', 'L'],
    ['r1', 'routine', 1, 'How often do you go for a walk, and what is your routine like? What do you wear or bring, and what do you do while walking?', 'L'],
    ['p1', 'past', 2, 'Tell me about something memorable or unexpected that happened while you were walking. When was it, what happened, and how did you handle it?', 'L']
  ]);
  T('yoga', '요가', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you do yoga. Where do you do yoga, and what is a class like?'],
    ['r1', 'routine', 1, 'Describe your yoga routine from the moment you arrive until you finish.'],
    ['p1', 'past', 2, 'How did you get started with yoga? Tell me about your first class and how you felt.']
  ]);
  T('hiking', '하이킹/트레킹', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you enjoy hiking. Tell me about a mountain or trail you like. What does it look like, and why do you like it?', 'L'],
    ['r1', 'routine', 1, 'What do you usually prepare before going hiking? Describe what you bring and what you do on a typical hike.', 'L'],
    ['p1', 'past', 2, 'Tell me about a memorable or unexpected experience you had while hiking. What happened, and how did you deal with it?', 'L']
  ]);
  T('gym', '헬스', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you work out at a gym. Describe your gym. Where is it, what does it look like, and what equipment do you use?', 'L'],
    ['r1', 'routine', 1, 'Describe your workout routine. How often do you go, what exercises do you do, and in what order?', 'L'],
    ['p1', 'past', 2, 'Tell me how you started working out. What made you start, and how has your routine changed since then?', 'L'],
    ['i1', 'issue', 3, 'Health and fitness have become a big trend among young people. Why do you think that is, and are there any downsides?']
  ]);

  /* ───────── 설문 주제: 여행 ───────── */
  T('domestic', '국내 여행', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like traveling in your country. Tell me about a place in your country that you like to visit. What does it look like, and why do you like it?', 'L'],
    ['r1', 'routine', 1, 'What do you usually do to prepare before a trip? Describe everything from planning the trip to packing your bags.', 'L'],
    ['p1', 'past', 2, 'Tell me about the most memorable trip you have taken in your country. Where did you go, who did you go with, and what made it so memorable?', 'L'],
    ['d2', 'describe', 1, 'Tell me about places in your country that are popular with tourists. Why do people like to visit them?', 'L'],
    ['p2', 'past', 2, 'Tell me about a trip you took when you were young. Where did you go, who did you go with, and what do you remember about it?', 'L'],
    ['c1', 'compare', 2, 'Compare traveling alone with traveling with family or friends. What are the good and bad points of each?', 'L'],
    ['p3', 'past', 2, 'Tell me about a problem you had during a trip, such as a missed train or bad weather. How did you deal with it?'],
    ['i1', 'issue', 3, 'Some popular tourist spots are getting too crowded, and local residents are unhappy. What problems does this cause, and what could be done?']
  ]);
  T('overseas', '해외 여행', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like traveling abroad. Tell me about a country or city you have visited. What was it like, and what impressed you the most?', 'L'],
    ['r1', 'routine', 1, 'How do you usually prepare for an overseas trip? How do you plan, and what do you always bring with you?', 'L'],
    ['p1', 'past', 2, 'Tell me about the most memorable experience you had during an overseas trip. What happened, and why do you still remember it? Describe it from beginning to end.', 'L'],
    ['c1', 'compare', 2, 'Compare the country you visited with Korea. What were the biggest differences in food, people, or daily life?'],
    ['p2', 'past', 2, 'Tell me about a time you had trouble communicating in a foreign country. What happened, and how did you manage?'],
    ['t1', 'describe', 2, 'If a foreign friend asked you which city in the world they should visit first, what would you recommend and why?', 'tw']
  ]);
  T('homevacation', '집에서 보내는 휴가', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you like to spend your vacations at home. Why do you like staying home during a vacation, and what do you usually do?'],
    ['r1', 'routine', 1, 'Who do you usually see when you spend a vacation at home? Describe what you do together.'],
    ['p1', 'past', 2, 'Tell me about a vacation you spent at home that you remember well. What did you do, and why was it special?'],
    ['c1', 'compare', 2, 'Compare spending a vacation at home with going on a trip. What are the good and bad points of each?']
  ]);
  T('biztrip', '출장', 'survey', [
    ['d1', 'describe', 1, 'You indicated that you have been on business trips. Where do you usually go, and what do you do there?'],
    ['r1', 'routine', 1, 'How do you prepare for a business trip? Describe what you do before you leave.'],
    ['p1', 'past', 2, 'Tell me about a memorable business trip. What happened, and how did it go?']
  ]);

  /* ───────── 돌발 주제 ───────── */
  T('s_weather', '돌발 — 날씨·계절', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about the weather in your country. What are the seasons like, and which season do you like the most? Why?', 'L'],
    ['r1', 'routine', 1, 'What do people in your country usually do in your favorite season? What do you personally like to do?', 'L'],
    ['p1', 'past', 2, 'Tell me about a time when the weather caused a problem for you, such as a canceled plan or a difficult trip. What happened, and how did you deal with it?', 'L'],
    ['c1', 'compare', 2, 'Compare the weather today with the weather when you were a child. Have you noticed any changes?'],
    ['i1', 'issue', 3, 'Extreme weather, such as heat waves and heavy rain, seems to be happening more often. How does this affect people’s lives?']
  ]);
  T('s_recycle', '돌발 — 재활용', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about recycling in your country. How do people recycle, and what kinds of items do they recycle?', 'L'],
    ['r1', 'routine', 1, 'How do you recycle at home? Describe what you do step by step, from separating items to taking them out.', 'L'],
    ['p1', 'past', 2, 'Tell me about a memorable or unusual experience related to recycling. What happened, and how was it resolved?', 'L'],
    ['c1', 'compare', 2, 'Compare how people recycled in the past with how they recycle now. What has changed?']
  ]);
  T('s_internet', '돌발 — 인터넷', 'surprise', [
    ['d1', 'describe', 1, 'People do many things on the internet. What do you usually do online? Tell me about the websites or apps you use most often.', 'L'],
    ['p1', 'past', 2, 'When did you first start using the internet? Tell me what you did online back then.', 'L'],
    ['c1', 'compare', 2, 'Compare how people found information in the past with how they find it now on the internet. What are the biggest differences?', 'L'],
    ['p2', 'past', 2, 'Tell me about a time when your internet connection stopped working at a bad moment. What happened, and what did you do?']
  ]);
  T('s_bank', '돌발 — 은행', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about the banks in your country. What do they look like, and where are they usually located?', 'L'],
    ['r1', 'routine', 1, 'What do people usually do at a bank? How do you usually handle your banking these days?', 'L'],
    ['p1', 'past', 2, 'When was the last time you went to a bank? Why did you go, and what happened there?', 'L'],
    ['c1', 'compare', 2, 'Compare banking in the past with banking today. How has technology such as mobile banking changed the way people use banks?', 'L']
  ]);
  T('s_transport', '돌발 — 교통', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about the transportation system in your country. What kinds of public transportation do people use?', 'L'],
    ['r1', 'routine', 1, 'How do you usually get around? Describe the transportation you use most often and why you prefer it.', 'L'],
    ['p1', 'past', 2, 'Tell me about a problem you had while using public transportation. What happened, and how did you handle it?', 'L'],
    ['c1', 'compare', 2, 'Compare public transportation now with when you were younger. What has improved?']
  ]);
  T('s_fashion', '돌발 — 패션', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about the clothes people in your country usually wear. What do people wear at work, and what do they wear on weekends?', 'L'],
    ['r1', 'routine', 1, 'What kind of clothes do you usually wear? Where do you buy them, and what do you think about when choosing them?', 'L'],
    ['c1', 'compare', 2, 'Compare fashion today with fashion when you were younger. How has it changed?', 'L'],
    ['p1', 'past', 2, 'Tell me about a piece of clothing you bought that you really liked, or one that you regretted buying.']
  ]);
  T('s_phone', '돌발 — 휴대폰·기술', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about the phone you are using now. What does it look like, and what functions do you use the most?', 'L'],
    ['r1', 'routine', 1, 'What do you usually do with your phone during the day? Describe how you use it from morning to night.', 'L'],
    ['p1', 'past', 2, 'Tell me about a time when you had a problem with your phone, such as breaking or losing it. What happened, and how did you solve the problem?', 'L'],
    ['c1', 'compare', 2, 'Compare your first phone with the phone you use now. What are the biggest differences?'],
    ['i1', 'issue', 3, 'Some people say we rely too much on our smartphones. What problems can this cause, and what do you think about it?', 'L']
  ]);
  T('s_holiday', '돌발 — 명절·휴일', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about the major holidays in your country. What do people usually do during those holidays?', 'L'],
    ['r1', 'routine', 1, 'How do you usually spend the holidays? Who do you spend them with, and what special food do you eat?', 'L'],
    ['p1', 'past', 2, 'Tell me about your most memorable holiday. What made it special, and what did you do? Tell me the story in detail.', 'L'],
    ['c1', 'compare', 2, 'Compare how people spent holidays in the past with how they spend them now. What has changed?']
  ]);
  T('s_food', '돌발 — 음식·외식', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about your favorite food. What is it, and why do you like it?'],
    ['r1', 'routine', 1, 'What do you usually eat in a day? Describe your typical meals.'],
    ['p1', 'past', 1, 'Tell me about a delicious meal you had recently. Where did you eat it, and who were you with?'],
    ['d2', 'describe', 2, 'Tell me about a restaurant you like. Where is it, what does it look like, and what do you usually order?'],
    ['c1', 'compare', 2, 'Compare two restaurants or cafes you know. How are they similar, and how are they different? Which one do you prefer?', 'L'],
    ['i1', 'issue', 3, 'Food delivery apps have become very popular. How have they changed the way people eat, and are there any problems?']
  ]);
  T('s_neighborhood', '돌발 — 동네', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about your neighborhood. What does it look like, and what is around your home?'],
    ['r1', 'routine', 1, 'What do people in your neighborhood usually do on weekends? Where do they go?'],
    ['c1', 'compare', 2, 'How has your neighborhood changed since you first moved there?'],
    ['p1', 'past', 2, 'Tell me about something memorable that happened in your neighborhood.']
  ]);
  T('s_appliance', '돌발 — 가전제품', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about the home appliances you use every day. Which one is the most useful to you?'],
    ['c1', 'compare', 2, 'Compare the home appliances of today with those of the past. How have they made life easier?'],
    ['p1', 'past', 2, 'Tell me about a time when an appliance at home broke down. What happened, and how did you fix it?']
  ]);
  T('s_health', '돌발 — 건강', 'surprise', [
    ['d1', 'describe', 1, 'What do people around you do to stay healthy? Describe some common habits.', 'L'],
    ['r1', 'routine', 1, 'What do you do to stay healthy? Describe your habits for eating, sleeping, and exercising.'],
    ['p1', 'past', 2, 'Tell me about a time when you were sick or hurt. What happened, and how did you get better?'],
    ['i1', 'issue', 3, 'Health has become a major concern for many people. Why has it become such an important issue, and what effects has this had on society?', 'L']
  ]);
  T('s_family', '돌발 — 가족·친구', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about your best friend. What is your friend like, and how did you meet?', 'L'],
    ['r1', 'routine', 1, 'What do you usually do when you meet your friends? Where do you go, and what do you talk about?', 'L'],
    ['p1', 'past', 1, 'Tell me about a fun memory you have with your friends or family. What did you do together?', 'L'],
    ['d2', 'describe', 1, 'Tell me about your family. Who are they, and what are they like?'],
    ['c1', 'compare', 2, 'Compare family life in Korea now with family life when your parents were young.']
  ]);
  T('s_weekend', '돌발 — 주말·여가', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about your favorite day of the week. Why do you like that day?', 'L'],
    ['r1', 'routine', 1, 'What do you usually do on weekends? Describe a typical weekend from Saturday morning to Sunday night.', 'L'],
    ['p1', 'past', 1, 'Tell me about what you did last weekend. Where did you go, and what did you do?', 'L']
  ]);
  T('s_country', '돌발 — 지형·나라', 'surprise', [
    ['d1', 'describe', 1, 'Tell me about the geography of your country. Are there many mountains, rivers, or beaches?'],
    ['r1', 'routine', 1, 'What outdoor activities do people in your country enjoy because of its geography?'],
    ['p1', 'past', 2, 'Tell me about a beautiful natural place in your country that you have visited. What did you do there?']
  ]);
  T('s_appointment', '돌발 — 약속', 'surprise', [
    ['d1', 'describe', 1, 'How do people in your country usually make appointments with friends, doctors, or businesses?'],
    ['p1', 'past', 2, 'Tell me about a time when an appointment was canceled or you missed one. What happened?'],
    ['c1', 'compare', 2, 'Compare how people made plans before smartphones with how they make plans now.']
  ]);

  /* ───────── 고난도 이슈·비교 (14·15번 고난도 / 난이도 재조정 '어려운 질문') ───────── */
  T('issue', '사회 이슈', 'general', [
    ['c1', 'compare', 3, 'Compare how people worked or studied in the past with how they do now using technology such as smartphones and the internet. What are the biggest changes?', 'L'],
    ['i1', 'issue', 3, 'What new technology are people in your country interested in these days? Why do you think it has become so popular?', 'L'],
    ['i2', 'issue', 3, 'What environmental problems are people in your country concerned about these days? Why have they become serious?', 'L'],
    ['c2', 'compare', 3, 'Compare people’s attitudes toward the environment in the past with their attitudes now. How have they changed?', 'L'],
    ['i3', 'issue', 3, 'What are individuals and the government in your country doing to protect the environment? Do you think these efforts are working?', 'L'],
    ['c3', 'compare', 3, 'Compare the lifestyle of young people today with the lifestyle of their parents’ generation. What are the main differences?', 'L'],
    ['i4', 'issue', 3, 'Work-life balance is a popular topic these days. Why have people become so interested in it, and what changes has it brought?', 'L'],
    ['c4', 'compare', 3, 'Compare the way people communicated in the past with the way they communicate today. What are the advantages and disadvantages of these changes?', 'L'],
    ['i5', 'issue', 3, 'Artificial intelligence tools are becoming part of everyday life. What are people excited about, and what are they worried about?'],
    ['i6', 'issue', 3, 'Many young people in Korea are choosing to live alone. Why do you think this is happening, and how is it changing society?'],
    ['i7', 'issue', 3, 'Some companies now let employees work from home. What are the good and bad points of working from home?'],
    ['i8', 'issue', 3, 'Online classes became very common in recent years. Do you think online learning is as effective as learning in a classroom? Why or why not?']
  ]);

  /* ───────── 롤플레이 세트 (질문하기 → 문제 해결 → 관련 경험) ───────── */
  T('rp_movie', '롤플레이 — 영화표', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. You want to see a movie with a friend this weekend. Call the movie theater and ask three or four questions to get the information you need about the movie and the tickets.", 'L'],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. When you arrive at the theater, you find out that your seats were double-booked and someone else is sitting in them. Explain the situation to your friend and give two or three alternatives to solve the problem.", 'L'],
    ['p', 'past', 3, "That's the end of the situation. Have you ever had a problem with a reservation or an appointment that was canceled or changed? Tell me what happened and how you dealt with it.", 'L']
  ]);
  T('rp_cafe', '롤플레이 — 카페', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. A new cafe has opened near your home. Call the cafe and ask three or four questions about the menu, opening hours, and seating.", 'L'],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. You ordered a drink to go, but when you got home, you found out it was the wrong drink. Call the cafe, explain the situation, and suggest two or three ways to solve the problem.", 'L'],
    ['p', 'past', 3, "That's the end of the situation. Have you ever received the wrong item or been disappointed with something you ordered? Tell me what happened and how you resolved it.", 'L']
  ]);
  T('rp_hotel', '롤플레이 — 호텔', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. You are planning a trip and want to book a hotel. Call the hotel and ask three or four questions about the rooms, prices, and facilities.", 'L'],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. When you arrive at the hotel, you find out that your reservation was canceled by mistake. Explain the situation to the manager and give two or three alternatives to solve the problem.", 'L'],
    ['p', 'past', 3, "That's the end of the situation. Have you ever had a problem while traveling, such as a booking issue or a delay? Tell me what happened and how you handled it from beginning to end.", 'L']
  ]);
  T('rp_shopping', '롤플레이 — 옷 가게', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. You want to buy a new jacket. Call a clothing store and ask three or four questions about the jacket, such as size, color, and price.", 'L'],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. You bought the jacket, but when you got home, you found a hole in it. Call the store, explain the problem, and give two or three alternatives to resolve the situation.", 'L'],
    ['p', 'past', 3, "That's the end of the situation. Have you ever bought something that was damaged or did not work? Tell me what it was, what was wrong with it, and how you dealt with the problem.", 'L']
  ]);
  T('rp_gym', '롤플레이 — 헬스장', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. You want to join a new gym. Visit the front desk and ask three or four questions about membership, prices, and classes."],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. You paid for a three-month membership, but you hurt your leg and can't work out for a while. Talk to the gym manager, explain the situation, and suggest two or three solutions."],
    ['p', 'past', 3, "That's the end of the situation. Have you ever had to cancel or change a plan because you got sick or injured? Tell me what happened."]
  ]);
  T('rp_flight', '롤플레이 — 항공편', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. You are planning a trip abroad. Call a travel agency and ask three or four questions about flights to the place you want to visit."],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. At the airport, you learn that your flight has been canceled because of the weather. Talk to the airline staff, explain your situation, and suggest two or three alternatives."],
    ['p', 'past', 3, "That's the end of the situation. Tell me about a time when your travel plans did not go as expected. What happened, and how did you handle it?"]
  ]);
  T('rp_party', '롤플레이 — 친구 모임', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. Your friend has invited you to a party this weekend. Call your friend and ask three or four questions about the party."],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. On the day of the party, something urgent comes up and you can't go. Call your friend, explain the situation, and suggest two or three ways to make it up to them."],
    ['p', 'past', 3, "That's the end of the situation. Have you ever had to cancel plans with a friend at the last minute? Tell me what happened and how your friend reacted."]
  ]);
  T('rp_repair', '롤플레이 — 수리', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. Your phone screen is cracked. Call a repair shop and ask three or four questions about the repair."],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. You picked up your phone from the repair shop, but it still does not work properly. Call the shop, explain the problem, and suggest two or three solutions."],
    ['p', 'past', 3, "That's the end of the situation. Tell me about a time when something you owned broke and you had to get it fixed. What happened?"]
  ]);
  T('rp_restaurant', '롤플레이 — 식당 예약', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. You want to have dinner at a new restaurant with your family. Call the restaurant and ask three or four questions to make a reservation."],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. When you arrive at the restaurant, they cannot find your reservation and there are no tables left. Explain the situation to the staff and suggest two or three alternatives."],
    ['p', 'past', 3, "That's the end of the situation. Tell me about a memorable experience you had at a restaurant, good or bad. What happened?"]
  ]);
  T('rp_concert', '롤플레이 — 공연 티켓', 'roleplay', [
    ['a', 'rp_ask', 2, "I'd like to give you a situation and ask you to act it out. You want to buy tickets for a concert. Call the ticket office and ask three or four questions about the concert and the tickets."],
    ['s', 'rp_solve', 3, "I'm sorry, but there is a problem I need you to resolve. You bought two tickets, but your friend can't come with you. Call another friend, explain the situation, and try to convince them to come."],
    ['p', 'past', 3, "That's the end of the situation. Tell me about a time when you had to change your plans because someone else couldn't come. What happened?"]
  ]);
  /* 1~4단계에서 자주 나오는 '면접관에게 질문하기' 유형 */
  T('rp_interviewer', '롤플레이 — 면접관에게 질문', 'roleplay', [
    ['a1', 'rp_ask', 1, 'I also like to go to cafes. Ask me three or four questions about the cafes I go to.'],
    ['a2', 'rp_ask', 1, 'I live in a house in the city. Ask me three or four questions about where I live.'],
    ['a3', 'rp_ask', 1, 'I like to travel during my vacations. Ask me three or four questions about my travels.'],
    ['a4', 'rp_ask', 1, 'I enjoy watching movies on weekends. Ask me three or four questions about the movies I like.']
  ]);

  const TYPE_LABELS = {
    intro: '자기소개', describe: '묘사', routine: '습관·루틴', past: '과거 경험', compare: '비교',
    rp_ask: '롤플레이(질문하기)', rp_solve: '롤플레이(문제 해결)', issue: '이슈'
  };
  /* 연습 화면의 유형 그룹(롤플레이는 하나로, 돌발은 분류 기준) */
  const FOCUS_GROUPS = [
    { id: 'describe', label: '묘사', match: q => q.type === 'describe' },
    { id: 'routine', label: '습관·루틴', match: q => q.type === 'routine' },
    { id: 'past', label: '과거 경험', match: q => q.type === 'past' },
    { id: 'compare', label: '비교', match: q => q.type === 'compare' },
    { id: 'roleplay', label: '롤플레이', match: q => q.type === 'rp_ask' || q.type === 'rp_solve' },
    { id: 'surprise', label: '돌발 주제', match: q => q.cat === 'surprise' },
    { id: 'issue', label: '고난도 이슈', match: q => q.type === 'issue' }
  ];
  const CAT_LABELS = { survey: '설문 주제', surprise: '돌발 주제', roleplay: '롤플레이', general: '공통' };

  const byId = {};
  QUESTIONS.forEach(q => { byId[q.id] = q; });
  const topicById = {};
  TOPICS.forEach(t => { topicById[t.id] = t; });

  const api = { TOPICS, QUESTIONS, TYPE_LABELS, FOCUS_GROUPS, CAT_LABELS, byId, topicById };
  root.OPIC = root.OPIC || {};
  root.OPIC.bank = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
