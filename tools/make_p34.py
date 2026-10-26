# Part 3·4 세트 생성 (작성 도구). 결과물: toeic/data/p3.json, p4.json
# 각 문항: (type, concept, difficulty, question, [A,B,C,D], answer, why, traps, para)
import json, os

def S(g, a): return {'g': g, 'accent': a}

def q(t, c, d, text, ch, ans, why, traps, para=None, tags=None):
    o = {'type': t, 'concept': c, 'difficulty': d, 'question': text, 'choices': ch, 'answer': ans,
         'explanation': {'why': why, 'traps': traps}}
    if para: o['para'] = para
    if tags: o['tags'] = tags
    return o

P3 = []

P3.append(dict(speakers={'W': S('f', 'GB'), 'M': S('m', 'US')}, script=[
 ('W', "Hi, Marcus. I'm putting together this week's order for office supplies. Is there anything your team needs?"),
 ('M', "Actually, yes. We're almost out of printer cartridges, and a few people have asked for larger monitors."),
 ('W', "Cartridges are no problem, but monitors have to be approved by the finance department, since they cost more than two hundred dollars each."),
 ('M', "I see. Then I'll send a request to finance this afternoon with the number of monitors we need.")],
 vocab=[{'w': 'put together', 'pos': 'phr', 'm': '준비하다, 만들다'}],
 qs=[
 q('gist', 'p3.gist', 1, "What are the speakers mainly discussing?",
   ["An order for office supplies", "A new printer model", "A budget meeting", "Hiring new team members"], 0,
   "여자가 첫 문장에서 이번 주 사무용품 주문을 준비 중이라며 필요한 것이 있는지 묻고, 대화 전체가 그 주문 품목 이야기다.",
   [None, "프린터 카트리지가 언급될 뿐 새 프린터 모델 이야기는 없다.", "재무팀은 모니터 승인 주체로만 나온다. 예산 회의를 하는 것이 아니다.", "'a few people have asked'는 팀원 요청이지 채용 이야기가 아니다."]),
 q('detail', 'p3.detail', 2, "According to the woman, why do the monitors need approval?",
   ["They cost over a certain amount.", "They are currently out of stock.", "They must be ordered from overseas.", "They are for the finance department."], 0,
   "여자는 모니터가 개당 200달러가 넘기 때문에(since they cost more than two hundred dollars each) 재무팀 승인이 필요하다고 했다.",
   [None, "품절(out of stock)이라는 말은 없다. 'almost out of'는 카트리지 이야기다.", "해외 주문 이야기는 없다.", "재무팀은 승인을 하는 부서이지 모니터를 쓰는 부서가 아니다."],
   [{'p': 'cost more than two hundred dollars each', 'a': 'cost over a certain amount'}]),
 q('next', 'p3.next', 2, "What will the man do this afternoon?",
   ["Submit a request", "Install some monitors", "Buy printer cartridges", "Meet with the woman"], 0,
   "남자는 오늘 오후에 필요한 모니터 수를 적어 재무팀에 요청을 보내겠다(I'll send a request to finance this afternoon)고 했다.",
   [None, "모니터는 아직 승인도 받지 않았다.", "카트리지는 여자가 주문서에 넣어 처리한다.", "여자와 만나겠다는 말은 없다."],
   [{'p': 'send a request', 'a': 'Submit a request'}])]))

P3.append(dict(speakers={'M': S('m', 'AU'), 'W': S('f', 'US')}, script=[
 ('M', "Good evening. I have a reservation under the name Daniel Okafor."),
 ('W', "Welcome, Mr. Okafor. I see you're staying with us for three nights. Unfortunately, the room with a city view that you requested won't be ready until tomorrow."),
 ('M', "Hmm, I've got a really early meeting tomorrow."),
 ('W', "I understand. In that case, I can give you a garden-view room tonight at no extra charge, and you won't need to move tomorrow if you'd rather stay there."),
 ('M', "That works. Could I also get a wake-up call at five thirty?")],
 vocab=[{'w': 'at no extra charge', 'pos': 'phr', 'm': '추가 요금 없이'}],
 qs=[
 q('gist', 'p3.gist', 1, "Where most likely are the speakers?",
   ["At a hotel", "At an airport", "At a restaurant", "At a conference center"], 0,
   "예약자 이름 확인, 3박 투숙, 시티뷰 객실, 모닝콜 요청 등으로 보아 호텔 프런트 대화다.",
   [None, "공항 관련 표현(탑승, 수하물)은 없다.", "식당 예약이 아니라 객실 이야기다.", "meeting이 언급되지만 회의 장소에서 나누는 대화가 아니다."]),
 q('intent', 'p3.intent', 4, "Why does the man say, “I've got a really early meeting tomorrow”?",
   ["He does not want to change rooms in the morning.", "He wants to check out early.", "He needs directions to a meeting.", "He wants to cancel his reservation."], 0,
   "원하는 방이 내일에야 준비된다는 말에 '내일 아침 일찍 회의가 있다'고 답한다. 아침에 방을 옮기기 곤란하다는 뜻이고, 여자도 '내일 옮기지 않아도 된다'고 응답한다.",
   [None, "3박 예약이고 일찍 체크아웃하겠다는 말은 없다.", "회의 장소를 묻는 것이 아니다.", "예약 취소 의도는 없다. 대안을 받아들인다."], tags=['trap']),
 q('detail', 'p3.detail', 2, "What does the man request?",
   ["A wake-up call", "A late checkout", "A city map", "A ride to the airport"], 0,
   "마지막에 5시 30분 모닝콜을 요청했다.",
   [None, "늦은 체크아웃 요청은 없다.", "city는 객실 전망(city view)에서 나온 단어일 뿐이다.", "공항 교통편 요청은 없다."])]))

P3.append(dict(speakers={'W': S('f', 'AU'), 'M': S('m', 'GB')}, script=[
 ('W', "Hi, I'd like to order some flyers for our bakery's grand opening next Saturday."),
 ('M', "Sure. How many do you need?"),
 ('W', "A thousand should be enough. Oh, and I'd like them printed on heavier paper, if possible."),
 ('M', "Heavier paper adds ten dollars to the price. We can have them ready by Thursday."),
 ('W', "Thursday's perfect. I'll pick them up after work.")],
 graphic={'kind': 'table', 'title': 'Printing Price List', 'header': ['Item', 'Price'],
          'rows': [['Business cards (500)', '$40'], ['Flyers (1,000)', '$85'], ['Posters (50)', '$120'], ['Brochures (500)', '$150']]},
 vocab=[{'w': 'flyer', 'pos': 'n', 'm': '전단지'}, {'w': 'grand opening', 'pos': 'n', 'm': '개업'}],
 qs=[
 q('gist', 'p3.gist', 2, "Why is the woman placing an order?",
   ["To advertise a store opening", "To replace damaged flyers", "To prepare for a job fair", "To send wedding invitations"], 0,
   "빵집 개업(grand opening)을 위해 전단지를 주문한다고 했다. 전단지 = 홍보용.",
   [None, "손상된 전단지를 교체한다는 말은 없다.", "채용 박람회 이야기는 없다.", "결혼 초대장 이야기는 없다."],
   [{'p': "flyers for our bakery's grand opening", 'a': 'advertise a store opening'}]),
 q('graphic', 'p3.graphic', 3, "Look at the graphic. How much will the woman most likely pay?",
   ["$85", "$95", "$120", "$130"], 1,
   "가격표에서 전단지 1,000장은 85달러이고, 남자가 두꺼운 종이는 10달러가 추가된다고 했다. 85 + 10 = 95달러.",
   ["85달러는 기본 가격이다. 두꺼운 종이 추가 요금을 놓치면 고르게 되는 함정.", None, "120달러는 포스터 가격이다.", "130달러는 포스터 가격에 10달러를 더한 값으로 품목이 다르다."], tags=['trap']),
 q('detail', 'p3.detail', 1, "When will the woman pick up her order?",
   ["On Thursday", "On Friday", "On Saturday", "On Monday"], 0,
   "목요일까지 준비된다는 말에 '목요일 좋아요, 퇴근 후에 찾으러 갈게요'라고 했다.",
   [None, "금요일은 언급되지 않았다.", "토요일은 개업일이다.", "월요일은 언급되지 않았다."])]))

P3.append(dict(speakers={'W': S('f', 'US'), 'M1': S('m', 'GB'), 'M2': S('m', 'AU')}, script=[
 ('W', "Hi Tom, hi Raj. Thanks for meeting. We need to fill the sales coordinator position by the end of the month."),
 ('M1', "We've received over forty applications so far. I've narrowed them down to six."),
 ('M2', "That's great. Could we interview all six on Thursday?"),
 ('W', "I'll be at a client's site all day Thursday. How about Friday?"),
 ('M1', "Friday works for me. I'll reserve the small meeting room and send the candidates an invitation.")],
 vocab=[{'w': 'narrow down', 'pos': 'phr', 'm': '(범위를) 좁히다'}],
 qs=[
 q('gist', 'p3.gist', 1, "What are the speakers discussing?",
   ["Filling a job opening", "Planning a client visit", "Renovating a meeting room", "Reviewing sales figures"], 0,
   "첫 문장에서 영업 코디네이터 자리를 이달 말까지 채워야 한다고 하고, 지원서·면접 일정 이야기가 이어진다.",
   [None, "고객사 방문은 여자가 목요일에 바쁜 이유로만 나온다.", "회의실은 면접 장소로 예약할 뿐이다.", "sales는 직책 이름(sales coordinator)에 들어간 단어일 뿐이다."]),
 q('detail', 'p3.detail', 2, "Why is the woman unavailable on Thursday?",
   ["She will be visiting a client.", "She will be on vacation.", "She has a training session.", "She is moving to a new office."], 0,
   "여자는 목요일 하루 종일 고객사 현장에 있을 것(I'll be at a client's site all day Thursday)이라고 했다.",
   [None, "휴가 이야기는 없다.", "교육 일정은 언급되지 않았다.", "사무실 이전 이야기는 없다."],
   [{'p': "at a client's site", 'a': 'visiting a client'}]),
 q('next', 'p3.next', 2, "What does Tom say he will do?",
   ["Reserve a room", "Post a job advertisement", "Call a client", "Review more applications"], 0,
   "Tom(첫 번째 남자)은 작은 회의실을 예약하고 후보자들에게 초대장을 보내겠다고 했다.",
   [None, "이미 지원서 40여 건을 받았으므로 채용 공고를 올릴 필요가 없다.", "고객에게 연락하는 것은 여자의 일정과 관련된 내용이 아니다.", "이미 6명으로 좁혔다."])]))

P3.append(dict(speakers={'M': S('m', 'US'), 'W': S('f', 'AU')}, script=[
 ('M', "Hi, this is Kenji from Accounting. The air conditioning on our floor has stopped working again."),
 ('W', "Oh, no. That's the third time this month."),
 ('M', "I know. It's getting really hot in here, and we have clients coming in at two."),
 ('W', "I'll call the repair company right away and ask them to replace the unit instead of just fixing it. In the meantime, you could use the conference room on the fourth floor. It's on a different system.")],
 vocab=[{'w': 'in the meantime', 'pos': 'phr', 'm': '그동안'}],
 qs=[
 q('detail', 'p3.detail', 1, "What problem does the man report?",
   ["An air-conditioning system is not working.", "A meeting room is double-booked.", "Some clients are late.", "A floor needs cleaning."], 0,
   "남자는 자기 층의 에어컨이 또 작동을 멈췄다고 보고했다.",
   [None, "회의실 이중 예약 이야기는 없다.", "고객은 2시에 올 예정이라고 했을 뿐 늦는다는 말은 없다.", "floor(층)라는 단어를 이용한 함정이다."]),
 q('intent', 'p3.intent', 3, "What does the woman imply when she says, “That's the third time this month”?",
   ["The problem keeps happening.", "She has called the man before.", "The repair was inexpensive.", "The building is new."], 0,
   "에어컨이 '또(again)' 멈췄다는 말에 '이번 달만 세 번째'라고 반응한다. 같은 문제가 반복된다는 뜻이고, 이후 수리 대신 교체를 요청하겠다고 한다.",
   [None, "남자에게 세 번 전화했다는 뜻이 아니다.", "수리비 이야기는 없다.", "건물이 새것이라는 근거는 없다."]),
 q('suggest', 'p3.next', 2, "What does the woman suggest the man do?",
   ["Use a different room", "Reschedule a client meeting", "Call the repair company", "Open the windows"], 0,
   "그동안 다른 냉방 시스템을 쓰는 4층 회의실을 이용하라고 제안했다.",
   [None, "고객 미팅 일정을 바꾸라는 말은 없다.", "수리 업체에는 여자가 직접 전화하겠다고 했다. 주어를 바꾼 함정.", "창문 이야기는 없다."],
   [{'p': 'you could use the conference room on the fourth floor', 'a': 'Use a different room'}])]))

P3.append(dict(speakers={'W': S('f', 'GB'), 'M': S('m', 'AU')}, script=[
 ('W', "Hello. I reserved a compact car for pickup at noon today. My name is Grace Lim."),
 ('M', "Yes, Ms. Lim. All our compact cars are out at the moment, so we're upgrading you to a midsize car at no extra cost."),
 ('W', "Oh, that's great. Does it have a navigation system? I'm driving to a client's office in a town I've never been to."),
 ('M', "It does. I'll just need to see your driver's license and a credit card, and then I'll show you how to use the navigation system.")],
 vocab=[{'w': 'upgrade', 'pos': 'v', 'm': '상위 등급으로 바꿔 주다'}],
 qs=[
 q('gist', 'p3.gist', 1, "Where most likely does the man work?",
   ["At a car rental agency", "At a repair shop", "At a travel agency", "At a parking garage"], 0,
   "소형차 예약·픽업, 중형차 업그레이드, 운전면허증 확인으로 보아 렌터카 업체 직원이다.",
   [None, "차를 고치는 이야기는 없다.", "여행사는 차량을 직접 내주지 않는다.", "주차장 이야기는 없다."]),
 q('detail', 'p3.detail', 2, "What is the woman told about her reservation?",
   ["She will receive a larger vehicle.", "She must pay an additional fee.", "Her pickup time has changed.", "Her reservation was canceled."], 0,
   "소형차가 다 나가 '추가 비용 없이 중형차로 업그레이드'해 준다고 했다.",
   [None, "'at no extra cost'라고 했다. 반대 내용 함정.", "픽업 시간 변경 이야기는 없다.", "예약은 유지되고 차종만 바뀌었다."],
   [{'p': 'upgrading you to a midsize car', 'a': 'receive a larger vehicle'}]),
 q('next', 'p3.next', 2, "What will the man do after checking the woman's documents?",
   ["Explain how to use a device", "Give directions to a client's office", "Wash the car", "Print a map"], 0,
   "면허증과 카드를 확인한 뒤 내비게이션 사용법을 알려 주겠다고 했다. 내비게이션 = 기기(device).",
   [None, "고객사로 가는 길을 직접 알려 주겠다는 말은 없다.", "세차 이야기는 없다.", "지도를 출력한다는 말은 없다."],
   [{'p': 'show you how to use the navigation system', 'a': 'Explain how to use a device'}])]))

P3.append(dict(speakers={'M': S('m', 'GB'), 'W': S('f', 'US')}, script=[
 ('M', "Excuse me. My ticket says my train leaves at nine twenty-five, but I don't see it on the board for platform two."),
 ('W', "Let me check. Ah, that train's been delayed, and it's departing from platform five today."),
 ('M', "Oh, thanks. Do I have time to get a coffee?"),
 ('W', "You do. There's a café right next to platform five.")],
 graphic={'kind': 'table', 'title': 'Departures', 'header': ['Destination', 'Departure', 'Status'],
          'rows': [['Oakton', '9:10', 'On time'], ['Bridgeport', '9:25', 'Delayed (9:50)'], ['Millbrook', '9:40', 'On time'], ['Weston', '10:05', 'On time']]},
 vocab=[{'w': 'depart', 'pos': 'v', 'm': '출발하다'}],
 qs=[
 q('graphic', 'p3.graphic', 3, "Look at the graphic. Where is the man traveling to?",
   ["Oakton", "Bridgeport", "Millbrook", "Weston"], 1,
   "남자의 기차는 9시 25분 출발이다. 표에서 9:25 출발 열차의 목적지는 Bridgeport이고, 상태도 '지연'으로 여자의 말과 일치한다.",
   ["Oakton은 9시 10분 열차다.", None, "Millbrook은 9시 40분 열차다.", "Weston은 10시 5분 열차다."]),
 q('detail', 'p3.detail', 2, "What does the woman tell the man?",
   ["His train will leave from a different platform.", "His train has been canceled.", "His ticket is not valid.", "He needs to change trains."], 0,
   "기차가 지연되었고 오늘은 5번 승강장에서 출발한다고 했다. 원래 보던 2번이 아닌 다른 승강장이다.",
   [None, "취소가 아니라 지연(delayed)이다.", "표에 문제가 있다는 말은 없다.", "환승 이야기는 없다."],
   [{'p': "it's departing from platform five today", 'a': 'leave from a different platform'}]),
 q('next', 'p3.next', 2, "What will the man most likely do next?",
   ["Buy a beverage", "Exchange his ticket", "Take a taxi", "Call his office"], 0,
   "커피 마실 시간이 있냐고 묻자 여자가 시간이 있고 5번 승강장 옆에 카페가 있다고 했다. 음료를 살 것이다.",
   [None, "표를 바꿀 필요는 없다.", "택시 이야기는 없다.", "사무실에 전화한다는 말은 없다."],
   [{'p': 'get a coffee', 'a': 'Buy a beverage'}])]))

P3.append(dict(speakers={'W': S('f', 'AU'), 'M': S('m', 'US')}, script=[
 ('W', "Hi Dev. Are you going to the product launch in Singapore next month?"),
 ('M', "I'm supposed to, but my travel budget hasn't been approved yet."),
 ('W', "Didn't Ms. Romero say she'd approve it by Friday?"),
 ('M', "She did, but I wouldn't count on it. She's been traveling all week."),
 ('W', "Well, if you need a backup plan, the launch will also be streamed online."),
 ('M', "Good to know. I'll register for the online version just in case.")],
 vocab=[{'w': 'count on', 'pos': 'phr', 'm': '~을 믿다, 기대하다'}, {'w': 'stream', 'pos': 'v', 'm': '(온라인으로) 실시간 중계하다'}],
 qs=[
 q('gist', 'p3.gist', 1, "What event are the speakers discussing?",
   ["A product launch", "A budget meeting", "A training workshop", "A trade show"], 0,
   "첫 문장에서 다음 달 싱가포르 제품 출시 행사(product launch)에 가는지 묻는다.",
   [None, "예산은 출장 경비 승인 이야기일 뿐 회의가 아니다.", "교육 워크숍 이야기는 없다.", "무역 박람회는 언급되지 않았다."]),
 q('intent', 'p3.intent', 4, "What does the man imply when he says, “I wouldn't count on it”?",
   ["He doubts the approval will come on time.", "He does not know how much the trip will cost.", "He disagrees with the budget.", "He thinks the event will be canceled."], 0,
   "금요일까지 승인해 준다고 하지 않았냐는 말에 '그렇긴 한데 기대하지 않는다, 그녀가 일주일 내내 출장 중'이라고 답한다. 제때 승인이 나지 않을 것 같다는 뜻이다.",
   [None, "비용 이야기가 아니다.", "예산 자체에 반대하는 것이 아니다.", "행사가 취소된다는 말이 아니라 온라인 중계도 있다."], tags=['trap']),
 q('next', 'p3.next', 2, "What does the man say he will do?",
   ["Sign up for an online event", "Book a flight to Singapore", "Contact Ms. Romero", "Prepare a presentation"], 0,
   "만약을 대비해 온라인 버전에 등록하겠다(register for the online version)고 했다.",
   [None, "아직 출장 승인을 받지 못했다.", "Ms. Romero에게 연락하겠다는 말은 없다.", "발표 준비 이야기는 없다."],
   [{'p': 'register for the online version', 'a': 'Sign up for an online event'}])]))

P3.append(dict(speakers={'M': S('m', 'AU'), 'W': S('f', 'GB')}, script=[
 ('M', "Hi. I'd like to book a table for eight people this Thursday at seven."),
 ('W', "Let me see. We're fully booked at seven, but we have a private room available at eight thirty."),
 ('M', "That's a bit late for my clients. Is there anything earlier?"),
 ('W', "Six o'clock is open in the main dining area."),
 ('M', "Six it is, then. And could you prepare a vegetarian menu for two of the guests?"),
 ('W', "Certainly. I'll note that on the reservation.")],
 vocab=[{'w': 'fully booked', 'pos': 'phr', 'm': '예약이 꽉 찬'}],
 qs=[
 q('gist', 'p3.gist', 1, "Why is the man calling?",
   ["To make a reservation", "To cancel a booking", "To complain about a meal", "To order takeout"], 0,
   "첫 문장에서 목요일 8명 테이블을 예약하고 싶다고 했다.",
   [None, "취소가 아니라 새로 예약한다.", "불만 이야기는 없다.", "포장 주문이 아니다."]),
 q('detail', 'p3.detail', 3, "What time will the man's group most likely arrive?",
   ["At 6:00", "At 7:00", "At 8:00", "At 8:30"], 0,
   "7시는 만석, 8시 30분은 늦다고 해서 결국 'Six it is'라며 6시로 정했다.",
   [None, "7시는 처음 원했지만 예약이 찬 시간이다.", "8시는 언급되지 않았다.", "8시 30분은 고객에게 너무 늦다고 거절한 시간이다."], tags=['trap']),
 q('detail', 'p3.detail', 2, "What does the man request?",
   ["Special meals for some guests", "A private room", "A discount", "A parking space"], 0,
   "손님 두 명을 위한 채식 메뉴를 준비해 달라고 했다.",
   [None, "개별 룸은 8시 30분에만 가능해 선택하지 않았다.", "할인 요청은 없다.", "주차 이야기는 없다."],
   [{'p': 'a vegetarian menu for two of the guests', 'a': 'Special meals for some guests'}])]))

P3.append(dict(speakers={'W': S('f', 'US'), 'M': S('m', 'GB')}, script=[
 ('W', "Andre, have you started using the new scheduling software?"),
 ('M', "I tried this morning, but I couldn't figure out how to add recurring meetings."),
 ('W', "There's a training video on the company intranet. It's only ten minutes long."),
 ('M', "Ten minutes? I've got a full afternoon of calls."),
 ('W', "Then why don't I just show you? I'm free right now, and it only takes a few clicks."),
 ('M', "That'd be great, thanks.")],
 vocab=[{'w': 'recurring', 'pos': 'adj', 'm': '반복되는, 정기적인'}],
 qs=[
 q('detail', 'p3.detail', 2, "What problem does the man have?",
   ["He doesn't know how to use a software feature.", "His computer is not working.", "He missed an important meeting.", "He cannot access the intranet."], 0,
   "새 일정 관리 프로그램에서 반복 회의를 추가하는 방법을 모르겠다고 했다.",
   [None, "컴퓨터 고장 이야기는 없다.", "meetings는 프로그램 기능 이름(recurring meetings)에 나올 뿐이다.", "인트라넷 접속 문제는 언급되지 않았다."],
   [{'p': "couldn't figure out how to add recurring meetings", 'a': "doesn't know how to use a software feature"}]),
 q('intent', 'p3.intent', 3, "Why does the man say, “I've got a full afternoon of calls”?",
   ["To indicate he has no time to watch a video", "To ask the woman to cancel his calls", "To request a new phone", "To ask for help with a call"], 0,
   "10분짜리 교육 영상이 있다는 말에 '오후 내내 통화가 잡혀 있다'고 답한다. 영상 볼 시간이 없다는 뜻이고, 여자가 직접 보여 주겠다고 제안한다.",
   [None, "통화를 취소해 달라는 것이 아니다.", "새 전화기 이야기가 아니다.", "통화에 도움을 청하는 것이 아니다."], tags=['trap']),
 q('next', 'p3.next', 2, "What will the woman most likely do next?",
   ["Demonstrate a process", "Send a link to a video", "Schedule a meeting", "Call technical support"], 0,
   "'제가 그냥 보여 줄게요(why don't I just show you?)'라고 하고 남자가 수락한다. 사용 방법을 직접 시연할 것이다.",
   [None, "영상 대신 직접 보여 주기로 했다.", "회의 일정을 잡는 것이 아니다.", "기술 지원팀에 전화하지 않는다."],
   [{'p': "why don't I just show you?", 'a': 'Demonstrate a process'}])]))

P3.append(dict(speakers={'M': S('m', 'US'), 'W': S('f', 'AU')}, script=[
 ('M', "Welcome to the team, Sara. Let me show you to your desk. You'll be sharing an office with Yuna from the design team."),
 ('W', "Thanks. Is it the office next to the kitchen?"),
 ('M', "No, that one's for the accountants. Yours is the corner office at the end of the hall."),
 ('W', "Great. Oh, and where can I get a parking permit?"),
 ('M', "Just stop by the security office on the first floor. They'll issue one in a few minutes.")],
 graphic={'kind': 'table', 'title': 'Third Floor Offices', 'header': ['Room', 'Location'],
          'rows': [['301', 'Next to the elevator'], ['302', 'Next to the kitchen'], ['303', 'Corner office'], ['304', 'Next to the stairs']]},
 vocab=[{'w': 'parking permit', 'pos': 'n', 'm': '주차 허가증'}, {'w': 'issue', 'pos': 'v', 'm': '발급하다'}],
 qs=[
 q('gist', 'p3.gist', 1, "Who most likely is the woman?",
   ["A new employee", "A client", "A security guard", "An accountant"], 0,
   "'Welcome to the team'과 자리를 안내해 주는 내용으로 보아 새로 입사한 직원이다.",
   [None, "팀에 합류하고 사무실을 배정받으므로 고객이 아니다.", "보안실은 주차 허가증을 받는 곳으로 나올 뿐이다.", "부엌 옆 사무실을 쓰는 사람들이 회계 담당자다."]),
 q('graphic', 'p3.graphic', 3, "Look at the graphic. Which office will the woman use?",
   ["301", "302", "303", "304"], 2,
   "부엌 옆이냐는 질문에 남자가 아니라며 '복도 끝 코너 사무실'이라고 했다. 표에서 Corner office는 303호다.",
   ["301호는 엘리베이터 옆이다.", "302호(부엌 옆)는 회계 담당자들의 방이라고 했다. 여자가 먼저 말한 위치라 고르기 쉬운 함정.", None, "304호는 계단 옆이다."], tags=['trap']),
 q('suggest', 'p3.next', 1, "What does the man suggest the woman do?",
   ["Visit the security office", "Meet the design team", "Park on the street", "Fill out a form online"], 0,
   "주차 허가증은 1층 보안실에 들르면(stop by the security office) 몇 분 안에 발급해 준다고 했다.",
   [None, "디자인팀 Yuna는 사무실을 같이 쓸 사람으로 소개되었을 뿐이다.", "길가에 주차하라는 말은 없다.", "온라인 양식 이야기는 없다."],
   [{'p': 'stop by the security office', 'a': 'Visit the security office'}])]))

P3.append(dict(speakers={'M': S('m', 'GB'), 'W': S('f', 'US')}, script=[
 ('M', "Hi, Ms. Varga. This is Leo from Atlas Components. I'm calling about your order of steel brackets."),
 ('W', "Yes, we need them by the fifteenth for an assembly line upgrade."),
 ('M', "Unfortunately, one of our machines broke down, so we can only ship half the order by then. The rest would arrive about a week later."),
 ('W', "Hmm. Half should let us start the upgrade, but I'd like the remaining brackets sent by express shipping."),
 ('M', "Of course. We'll cover the cost of express shipping, since the delay is on our end.")],
 vocab=[{'w': 'bracket', 'pos': 'n', 'm': '받침대, 까치발'}, {'w': 'break down', 'pos': 'phr', 'm': '고장 나다'}],
 qs=[
 q('gist', 'p3.gist', 2, "Why is the man calling?",
   ["To report a delay with an order", "To request a payment", "To schedule a factory tour", "To offer a new product"], 0,
   "브래킷 주문 건으로 전화해, 기계 고장으로 절반만 기한 내 보낼 수 있다고 알린다. 주문 지연을 알리는 전화다.",
   [None, "결제 요청은 없다.", "공장 견학 이야기는 없다.", "신제품 제안은 없다."]),
 q('detail', 'p3.detail', 2, "What caused the problem?",
   ["A machine stopped working.", "A shipment was lost.", "Materials became more expensive.", "An employee was absent."], 0,
   "기계 한 대가 고장 났다(one of our machines broke down)고 했다.",
   [None, "배송품 분실 이야기는 없다.", "재료비 인상 이야기는 없다.", "직원 결근 이야기는 없다."],
   [{'p': 'one of our machines broke down', 'a': 'A machine stopped working.'}]),
 q('detail', 'p3.detail', 3, "What does the man offer to do?",
   ["Pay for faster delivery", "Give a discount on the next order", "Provide a full refund", "Send a technician"], 0,
   "지연이 자기 회사 탓이니 특급 배송비를 부담하겠다(We'll cover the cost of express shipping)고 했다.",
   [None, "다음 주문 할인은 언급되지 않았다.", "환불 이야기는 없다.", "기술자 파견 이야기는 없다. 고장 난 것은 공급업체의 기계다."],
   [{'p': 'cover the cost of express shipping', 'a': 'Pay for faster delivery'}])]))

P4 = []

P4.append(dict(speakers={'S': S('f', 'US')}, kind='announcement', script=[
 ('S', "Attention, shoppers. Thank you for visiting Greenleaf Market."),
 ('S', "Our seafood counter will be closing early today, at five o'clock, for equipment maintenance."),
 ('S', "If you'd like fresh fish for tonight's dinner, please visit the counter before then."),
 ('S', "Also, don't forget that this week only, all frozen vegetables are twenty percent off."),
 ('S', "And customers who use our mobile app will receive an extra five percent off at checkout. Thank you for shopping with us.")],
 vocab=[{'w': 'checkout', 'pos': 'n', 'm': '계산대, 계산'}],
 qs=[
 q('gist', 'p4.gist', 1, "Where is the announcement being made?",
   ["At a supermarket", "At a restaurant", "At a fish farm", "At an appliance store"], 0,
   "'Attention, shoppers'와 Greenleaf Market, 해산물 코너, 냉동 채소 할인으로 보아 슈퍼마켓 안내 방송이다.",
   [None, "dinner는 손님이 집에서 먹을 저녁 이야기다.", "생선을 '판매'하는 코너가 있을 뿐 양식장이 아니다.", "equipment는 해산물 코너 장비 점검 이야기다."]),
 q('detail', 'p4.detail', 2, "Why will the seafood counter close early?",
   ["To perform maintenance on equipment", "Because some staff are absent", "Because of a holiday", "To count its inventory"], 0,
   "해산물 코너는 장비 점검(for equipment maintenance) 때문에 5시에 일찍 닫는다.",
   [None, "직원 결근 이야기는 없다.", "휴일 이야기는 없다.", "재고 조사 이야기는 없다."],
   [{'p': 'for equipment maintenance', 'a': 'To perform maintenance on equipment'}]),
 q('detail', 'p4.detail', 2, "How can customers receive an additional discount?",
   ["By using a mobile application", "By buying fresh fish", "By shopping before five o'clock", "By signing up for a newsletter"], 0,
   "모바일 앱을 쓰는 고객은 계산 시 5퍼센트를 추가로 할인받는다.",
   [None, "생선 구매는 할인 조건이 아니다.", "5시는 해산물 코너 마감 시간이다. 숫자 재활용 함정.", "소식지 이야기는 없다."],
   [{'p': 'customers who use our mobile app', 'a': 'By using a mobile application'}])]))

P4.append(dict(speakers={'S': S('m', 'AU')}, kind='telephone message', script=[
 ('S', "Hi, Ms. Duarte. This is Phil from Crestview Realty, returning your call about the office space on Elm Street."),
 ('S', "You mentioned you'd like to move in by the first of next month. Well, the current tenant is leaving two weeks early, so that won't be a problem."),
 ('S', "I know you were concerned about parking. The building has twenty reserved spaces for tenants."),
 ('S', "That's not all. There's also a public garage across the street that offers monthly rates."),
 ('S', "I've arranged a viewing for Wednesday at ten. If that doesn't suit you, please call me at 555-0172.")],
 vocab=[{'w': 'tenant', 'pos': 'n', 'm': '세입자, 입주자'}, {'w': 'viewing', 'pos': 'n', 'm': '(부동산) 둘러보기'}],
 qs=[
 q('gist', 'p4.gist', 2, "What is the purpose of the message?",
   ["To respond to an inquiry about office space", "To confirm that a lease has been signed", "To request a payment", "To advertise a parking garage"], 0,
   "Elm Street 사무실에 대한 전화에 회신(returning your call)하며 입주 시기, 주차, 둘러보기 일정을 안내한다.",
   [None, "아직 둘러보기 단계라 계약 체결 확인이 아니다.", "결제 요청은 없다.", "주차장은 문의에 답하며 소개한 정보일 뿐 광고가 목적이 아니다."],
   [{'p': 'returning your call about the office space', 'a': 'respond to an inquiry about office space'}]),
 q('intent', 'p4.intent', 4, "Why does the speaker say, “That's not all”?",
   ["To introduce another parking option", "To say the building has more than twenty spaces", "To correct a previous mistake", "To recommend a different building"], 0,
   "건물에 전용 주차 공간 20개가 있다고 말한 뒤 '그게 다가 아니다'라며 길 건너 공영 주차장을 추가로 소개한다.",
   [None, "건물 안 주차 공간이 20개보다 많다는 뜻이 아니다. 문장 뜻 그대로 해석하게 만드는 함정.", "앞의 말을 정정하는 것이 아니라 정보를 덧붙인다.", "다른 건물을 추천하는 것이 아니다."], tags=['trap']),
 q('detail', 'p4.next', 2, "What has the speaker arranged?",
   ["A tour of a property", "A meeting with the current tenant", "A parking permit", "A moving company"], 0,
   "수요일 10시에 사무실 둘러보기(a viewing)를 잡아 두었다고 했다.",
   [None, "현 세입자는 일찍 나간다는 정보로만 나온다.", "주차 허가증 이야기는 없다.", "이사 업체 이야기는 없다."],
   [{'p': "I've arranged a viewing", 'a': 'A tour of a property'}])]))

P4.append(dict(speakers={'S': S('f', 'GB')}, kind='tour', script=[
 ('S', "Good morning, everyone, and welcome to the Halston Glass Factory tour. My name is Irene, and I'll be your guide today."),
 ('S', "We'll start in the furnace room, where you'll see our artists shaping glass by hand. It gets very hot in there, so please stay behind the yellow line at all times."),
 ('S', "After that, we'll visit the design studio, where our team creates new patterns for vases and lamps."),
 ('S', "The tour ends in our gift shop, where you'll receive ten percent off with your tour ticket."),
 ('S', "You're welcome to take photos everywhere except in the design studio. Now, let's get started.")],
 vocab=[{'w': 'furnace', 'pos': 'n', 'm': '용광로'}],
 qs=[
 q('gist', 'p4.gist', 1, "Who most likely is the speaker?",
   ["A tour guide", "A glass artist", "A gift shop clerk", "A safety inspector"], 0,
   "공장 견학 환영 인사와 함께 'I'll be your guide today'라고 소개했다.",
   [None, "유리 작가들은 견학 중 보게 될 사람들이다.", "선물 가게는 견학 마지막 장소일 뿐이다.", "안전 수칙을 안내하지만 점검관이 아니다."]),
 q('detail', 'p4.detail', 2, "What are listeners asked to do in the furnace room?",
   ["Stay behind a marked line", "Wear protective glasses", "Turn off their phones", "Keep their hands in their pockets"], 0,
   "용광로실은 매우 뜨거우니 항상 노란 선 뒤에 있으라고 했다.",
   [None, "보안경 이야기는 없다.", "휴대폰을 끄라는 말은 없다.", "손을 주머니에 넣으라는 말은 없다."],
   [{'p': 'stay behind the yellow line', 'a': 'Stay behind a marked line'}]),
 q('detail', 'p4.detail', 3, "Where are listeners NOT allowed to take pictures?",
   ["In the furnace room", "In the design studio", "In the gift shop", "In the lobby"], 1,
   "디자인 스튜디오를 제외한 모든 곳에서 사진 촬영이 가능하다고 했다.",
   ["용광로실은 안전선 주의 장소이지 촬영 금지 장소가 아니다.", None, "선물 가게는 할인 정보와 함께 나왔을 뿐이다.", "로비는 언급되지 않았고 '디자인 스튜디오 외 모든 곳'에 해당한다."], tags=['trap'])]))

P4.append(dict(speakers={'S': S('m', 'US')}, kind='broadcast', script=[
 ('S', "This is Mike Sullivan with your morning traffic report."),
 ('S', "Drivers heading downtown on Highway 9 should expect delays of about twenty minutes because of road repairs near the Fulton Bridge. Two of the three lanes are closed until noon."),
 ('S', "If you can, take Route 4 instead. It's moving smoothly this morning."),
 ('S', "Also, the city's free shuttle bus to Riverside Stadium will begin running tomorrow, ahead of Saturday's championship game."),
 ('S', "Stay tuned for the weather forecast after this short break.")],
 vocab=[{'w': 'stay tuned', 'pos': 'phr', 'm': '(채널을) 고정하다'}],
 qs=[
 q('detail', 'p4.detail', 2, "What is causing delays on Highway 9?",
   ["Construction work", "A traffic accident", "Bad weather", "A sports event"], 0,
   "Fulton Bridge 근처 도로 보수 공사(road repairs) 때문에 지연된다고 했다.",
   [None, "사고 이야기는 없다.", "날씨는 다음에 나올 예보일 뿐이다.", "경기는 셔틀버스 안내에서 나온 정보다."],
   [{'p': 'road repairs', 'a': 'Construction work'}]),
 q('suggest', 'p4.next', 2, "What does the speaker recommend?",
   ["Using a different road", "Taking a shuttle bus", "Leaving home early", "Taking the subway"], 0,
   "가능하면 Route 4를 대신 이용하라(take Route 4 instead)고 권했다.",
   [None, "셔틀버스는 경기장행이며 내일부터 운행한다는 소식일 뿐이다.", "일찍 출발하라는 말은 없다.", "지하철 이야기는 없다."],
   [{'p': 'take Route 4 instead', 'a': 'Using a different road'}]),
 q('next', 'p4.next', 2, "What will listeners hear after the break?",
   ["A weather forecast", "A sports update", "An interview", "Some music"], 0,
   "'Stay tuned for the weather forecast after this short break'라고 했다.",
   [None, "경기 이야기는 셔틀버스 안내에서 나왔을 뿐이다.", "인터뷰 예고는 없다.", "음악 이야기는 없다."])]))

P4.append(dict(speakers={'S': S('f', 'AU')}, kind='meeting', script=[
 ('S', "Let's look at last quarter's sales figures."),
 ('S', "As you can see, the East region had the strongest results again, thanks largely to the new distribution center there."),
 ('S', "But today I want to focus on the region with the lowest sales. Starting next month, we'll be adding three sales representatives there and running a regional advertising campaign."),
 ('S', "I'd like each of you to send me your ideas for the campaign by Friday.")],
 graphic={'kind': 'table', 'title': 'Last Quarter Sales by Region', 'header': ['Region', 'Sales'],
          'rows': [['North', '$2.1 million'], ['South', '$1.4 million'], ['East', '$2.8 million'], ['West', '$1.9 million']]},
 vocab=[{'w': 'sales representative', 'pos': 'n', 'm': '영업 사원'}],
 qs=[
 q('graphic', 'p4.graphic', 3, "Look at the graphic. Which region will receive additional staff?",
   ["North", "South", "East", "West"], 1,
   "판매 실적이 가장 낮은 지역에 영업 사원 3명을 추가한다고 했다. 표에서 가장 낮은 곳은 South(140만 달러)다.",
   ["North는 두 번째로 높다.", None, "East는 가장 높은 지역으로 칭찬받았다. 담화에서 직접 들린 지역명 함정.", "West는 두 번째로 낮다."], tags=['trap']),
 q('detail', 'p4.detail', 2, "According to the speaker, why did the East region perform well?",
   ["A new distribution center opened there.", "Prices were reduced.", "More staff were hired.", "An advertising campaign was launched."], 0,
   "'thanks largely to the new distribution center there'라고 이유를 밝혔다.",
   [None, "가격 인하 이야기는 없다.", "인력 추가는 판매가 가장 낮은 지역에 대한 계획이다.", "광고 캠페인도 앞으로 판매가 낮은 지역에서 할 일이다."]),
 q('request', 'p4.next', 2, "What are listeners asked to do by Friday?",
   ["Submit suggestions", "Visit a regional office", "Hire representatives", "Review a budget"], 0,
   "금요일까지 캠페인 아이디어를 보내 달라(send me your ideas)고 했다.",
   [None, "지역 사무소 방문 이야기는 없다.", "채용은 회사 계획이지 청자에게 시킨 일이 아니다.", "예산 검토 요청은 없다."],
   [{'p': 'send me your ideas', 'a': 'Submit suggestions'}])]))

P4.append(dict(speakers={'S': S('m', 'GB')}, kind='speech', script=[
 ('S', "Good evening, and thank you all for coming to the Westbrook Business Awards."),
 ('S', "Our next award honors an entrepreneur who has made a lasting contribution to our community."),
 ('S', "Ten years ago, Leila Haddad opened a small bicycle repair shop on Main Street. Today, Haddad Cycles has four stores and employs more than sixty people."),
 ('S', "Ms. Haddad also started a program that teaches bicycle maintenance to local high school students, free of charge."),
 ('S', "Please join me in welcoming this year's Business Leader of the Year, Leila Haddad.")],
 vocab=[{'w': 'entrepreneur', 'pos': 'n', 'm': '기업가'}, {'w': 'free of charge', 'pos': 'phr', 'm': '무료로'}],
 qs=[
 q('gist', 'p4.gist', 1, "What is the purpose of the speech?",
   ["To present an award", "To open a new store", "To announce a retirement", "To promote a product"], 0,
   "시상식에서 올해의 비즈니스 리더 수상자를 소개하는 연설이다.",
   [None, "매장 수(four stores)는 성과 소개일 뿐 개점 행사가 아니다.", "은퇴 이야기는 없다.", "제품 홍보가 목적이 아니다."]),
 q('detail', 'p4.detail', 2, "What is mentioned about Haddad Cycles?",
   ["It has grown to several locations.", "It sells used cars.", "It opened last year.", "It is moving to Main Street."], 0,
   "작은 수리점에서 시작해 지금은 매장 네 곳과 직원 60명 이상이 있다고 했다.",
   [None, "자전거 회사다.", "10년 전에 문을 열었다.", "Main Street는 처음 가게를 연 곳이다."],
   [{'p': 'has four stores', 'a': 'has grown to several locations'}]),
 q('detail', 'p4.detail', 2, "What does Ms. Haddad's program offer?",
   ["Free lessons for students", "Discounted bicycles", "Jobs for retirees", "College scholarships"], 0,
   "지역 고등학생에게 자전거 정비를 무료로 가르치는 프로그램이다.",
   [None, "자전거 할인 이야기는 없다.", "은퇴자 일자리 이야기는 없다.", "장학금 이야기는 없다."],
   [{'p': 'teaches bicycle maintenance to local high school students, free of charge', 'a': 'Free lessons for students'}])]))

P4.append(dict(speakers={'S': S('f', 'US')}, kind='workplace talk', script=[
 ('S', "Before we open the warehouse this morning, I have an update."),
 ('S', "Starting today, all incoming packages must be scanned at the receiving desk before they're moved to the shelves."),
 ('S', "I know what you're thinking. It'll slow us down. But last month, we lost track of nearly fifty packages, and scanning will let us see exactly where every item is."),
 ('S', "To make this easier, we've added two more scanners at the receiving desk. Jamal will show you how to use them right after this meeting.")],
 vocab=[{'w': 'lose track of', 'pos': 'phr', 'm': '~의 행방을 놓치다'}],
 qs=[
 q('gist', 'p4.gist', 1, "Where does the talk most likely take place?",
   ["At a warehouse", "At a post office", "At an electronics store", "At a library"], 0,
   "'Before we open the warehouse this morning'이라고 했고, 입고 상품 스캔과 선반 이야기가 이어진다.",
   [None, "packages가 나오지만 우체국 직원 대상 이야기가 아니다.", "scanners는 업무 도구일 뿐이다.", "shelves가 나오지만 도서관이 아니다."]),
 q('intent', 'p4.intent', 4, "Why does the speaker say, “I know what you're thinking”?",
   ["To acknowledge a likely concern", "To ask listeners for ideas", "To correct a mistake", "To introduce a new employee"], 0,
   "새 스캔 절차를 발표한 뒤 '무슨 생각하는지 안다, 느려질 거라고'라며 직원들이 가질 만한 우려를 먼저 인정하고 이유를 설명한다.",
   [None, "의견을 묻는 것이 아니다.", "실수를 정정하는 것이 아니다.", "Jamal은 시연할 사람으로 나오며 신입 소개가 아니다."], tags=['trap']),
 q('next', 'p4.next', 2, "What will happen right after the meeting?",
   ["Staff will receive a demonstration.", "Packages will be delivered.", "New scanners will be ordered.", "The warehouse will close."], 0,
   "회의 직후 Jamal이 스캐너 사용법을 보여 줄 것이라고 했다.",
   [None, "배송 이야기는 없다.", "스캐너는 이미 두 대 추가했다.", "오히려 창고 문을 열기 전 회의다."],
   [{'p': 'Jamal will show you how to use them', 'a': 'receive a demonstration'}])]))

P4.append(dict(speakers={'S': S('f', 'GB')}, kind='recorded message', script=[
 ('S', "Thank you for calling Lumen Internet. Please note that our office will be closed on Monday for a national holiday."),
 ('S', "If you're calling because your Internet service is not working, we may already be aware of the issue. Please check the service status page on our Web site before speaking with a technician."),
 ('S', "To speak with a technician now, please choose the appropriate option from the menu."),
 ('S', "Calls may be recorded for training purposes.")],
 graphic={'kind': 'table', 'title': 'Customer Service Menu', 'header': ['Press', 'Department'],
          'rows': [['1', 'Billing'], ['2', 'Technical support'], ['3', 'New accounts'], ['4', 'Operator']]},
 vocab=[{'w': 'appropriate', 'pos': 'adj', 'm': '적절한'}],
 qs=[
 q('graphic', 'p4.graphic', 3, "Look at the graphic. Which number should a caller press to speak with a technician?",
   ["1", "2", "3", "4"], 1,
   "기술자와 통화하려면 메뉴에서 알맞은 번호를 고르라고 했다. 기술자 = Technical support이므로 2번이다.",
   ["1번은 요금 청구(Billing)다.", None, "3번은 신규 가입(New accounts)이다.", "4번 상담원(Operator)은 일반 안내라 기술자 연결이 아니다."]),
 q('detail', 'p4.detail', 1, "Why will the office be closed on Monday?",
   ["Because of a holiday", "Because of a power outage", "Because staff will be in training", "Because the office is moving"], 0,
   "'closed on Monday for a national holiday'라고 했다.",
   [None, "정전은 언급되지 않았다. 인터넷 장애와 혼동시키는 함정.", "training은 통화 녹음 목적(training purposes)에 나온 단어다.", "이전 이야기는 없다."]),
 q('suggest', 'p4.next', 2, "What are callers encouraged to do?",
   ["Check a Web page", "Restart their equipment", "Call back on Monday", "Send an e-mail"], 0,
   "기술자와 통화하기 전에 웹사이트의 서비스 상태 페이지를 확인하라고 했다.",
   [None, "장비 재시작 이야기는 없다.", "월요일은 휴무일이다.", "이메일 이야기는 없다."],
   [{'p': 'check the service status page on our Web site', 'a': 'Check a Web page'}])]))

P4.append(dict(speakers={'S': S('f', 'AU')}, kind='workshop', script=[
 ('S', "Welcome to today's workshop on writing effective business e-mails. I'm Grace Tan, and I've been teaching business communication for fifteen years."),
 ('S', "In the first hour, we'll look at common mistakes, such as writing subject lines that are too vague."),
 ('S', "Then, after a short coffee break, you'll practice rewriting some real e-mails that our company has received."),
 ('S', "The handouts I'm passing around now include a checklist you can keep at your desk."),
 ('S', "Let's begin by having everyone introduce themselves and say which department they're from.")],
 vocab=[{'w': 'vague', 'pos': 'adj', 'm': '모호한'}, {'w': 'handout', 'pos': 'n', 'm': '유인물'}],
 qs=[
 q('gist', 'p4.gist', 1, "What is the workshop about?",
   ["Writing business e-mails", "Giving presentations", "Managing a team", "Using new software"], 0,
   "첫 문장에서 '효과적인 비즈니스 이메일 작성' 워크숍이라고 했다.",
   [None, "발표 기술 이야기는 없다.", "팀 관리 이야기는 없다.", "소프트웨어 이야기는 없다."]),
 q('detail', 'p4.detail', 2, "What will listeners do after the break?",
   ["Rewrite some e-mails", "Watch a video", "Take a test", "Meet with clients"], 0,
   "커피 휴식 후 회사가 받은 실제 이메일을 고쳐 쓰는 연습을 한다고 했다.",
   [None, "영상 이야기는 없다.", "시험 이야기는 없다.", "고객을 만나는 일정은 없다."],
   [{'p': 'practice rewriting some real e-mails', 'a': 'Rewrite some e-mails'}]),
 q('next', 'p4.next', 2, "What will listeners do next?",
   ["Introduce themselves", "Take a coffee break", "Read the checklist aloud", "Fill out a survey"], 0,
   "마지막에 '모두 자기소개와 소속 부서를 말하는 것으로 시작하자'고 했다.",
   [None, "커피 휴식은 첫 한 시간 이후다.", "체크리스트는 책상에 두고 쓰라고 했을 뿐 읽으라는 말은 없다.", "설문 이야기는 없다."])]))

P4.append(dict(speakers={'S': S('m', 'US')}, kind='announcement', script=[
 ('S', "Hello, everyone. I have some news about our office relocation."),
 ('S', "The new building on Harbor Road is finally ready, and we'll be moving in two weeks."),
 ('S', "Believe it or not, it's even closer to the subway station than our current office."),
 ('S', "Each department will receive packing materials on Monday. Please label all boxes with your name and department."),
 ('S', "The IT team will move the computers over the weekend, so you won't have to worry about those. If you have any questions, please contact Olivia Grant in Facilities.")],
 vocab=[{'w': 'relocation', 'pos': 'n', 'm': '이전'}],
 qs=[
 q('gist', 'p4.gist', 1, "What is the main topic of the announcement?",
   ["An office move", "A new subway line", "A computer upgrade", "A hiring plan"], 0,
   "첫 문장에서 사무실 이전(office relocation) 소식을 전한다고 했다.",
   [None, "지하철역은 새 건물의 위치 장점으로 나온다.", "컴퓨터는 IT팀이 옮긴다는 정보일 뿐이다.", "채용 이야기는 없다."],
   [{'p': 'office relocation', 'a': 'An office move'}]),
 q('intent', 'p4.intent', 3, "What does the speaker imply when he says, “Believe it or not, it's even closer to the subway station”?",
   ["The new location is surprisingly convenient.", "He is not sure where the building is.", "Employees should drive to work.", "The subway station will close soon."], 0,
   "'믿기 어렵겠지만 지하철역에서 더 가깝다'는 말은 새 위치가 생각보다 편리하다는 뜻이다.",
   [None, "위치를 모르는 것이 아니다.", "운전하라는 뜻이 아니다. 오히려 지하철이 더 가깝다.", "역이 문을 닫는다는 말은 없다."]),
 q('detail', 'p4.detail', 2, "What will the IT team do?",
   ["Move the computers", "Provide packing boxes", "Label the equipment", "Answer employees' questions"], 0,
   "IT팀이 주말에 컴퓨터를 옮길 것이라고 했다.",
   [None, "포장 자재는 부서별로 '받는' 것이고 IT팀이 준다는 말은 없다.", "상자에 이름을 붙이는 것은 직원들의 일이다.", "문의는 시설팀의 Olivia Grant에게 하라고 했다."])]))


def build(sets, part, prefix):
    units = []
    for i, s in enumerate(sets, start=1):
        uid = f'{prefix}-s{i:02d}'
        u = {'id': uid, 'part': part, 'speakers': s['speakers'],
             'script': [{'s': a, 't': b} for a, b in s['script']], 'questions': []}
        if s.get('kind'): u['kind'] = s['kind']
        if s.get('graphic'): u['graphic'] = s['graphic']
        for j, qq in enumerate(s['qs'], start=1):
            qq = dict(qq)
            qq['id'] = f'{uid}-{j}'
            if j == 1 and s.get('vocab'): qq['vocab'] = s['vocab']
            u['questions'].append(qq)
        units.append(u)
    return units

base = os.path.join(os.path.dirname(__file__), '..', 'toeic', 'data')
for part, sets, prefix in ((3, P3, 'p3'), (4, P4, 'p4')):
    with open(os.path.join(base, f'p{part}.json'), 'w', encoding='utf-8') as f:
        json.dump({'units': build(sets, part, prefix)}, f, ensure_ascii=False, indent=1)
print('ok', len(P3), len(P4))
