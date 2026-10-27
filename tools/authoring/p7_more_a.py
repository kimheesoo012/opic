# Part 7 추가 단일 지문 s16~s30
from rcgen import q, P, setunit, write
N = None
INS = "In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong?"
POS = ["[1]", "[2]", "[3]", "[4]"]
U = []

U.append(setunit('p7-s16', 7, [P('text message chain', 'Text-message chain', "Nadia Ruiz [8:47 A.M.]\nI'm stuck in traffic on the bridge. Could you set up the projector for the 9:30 client meeting?\n\nBen Park [8:49 A.M.]\nSure. Which room are you in?\n\nNadia Ruiz [8:50 A.M.]\nRoom 6B. The slides are on the shared drive in the \"Harlow\" folder.\n\nBen Park [8:52 A.M.]\nGot it. Should I order coffee for the clients too?\n\nNadia Ruiz [8:53 A.M.]\nThat's taken care of. Ms. Liu ordered it yesterday.")], [
 q('purpose', 'p7.purpose', 1, ["To ask for help preparing for a meeting", "To reschedule a client meeting", "To ask for directions to a client's office", "To report a broken projector"], 0,
   "교통 체증으로 늦는 Ms. Ruiz가 9시 30분 회의용 프로젝터 설치를 부탁하며 대화를 시작한다.",
   [N, "회의 시간을 바꾸자는 말은 없다.", "고객사 위치를 묻지 않는다. 회의실은 6B로 이미 정해져 있다.", "프로젝터가 고장 났다는 말이 아니라 설치를 부탁한 것이다."],
   question="Why did Ms. Ruiz send the first message?", para=[("Could you set up the projector for the 9:30 client meeting?", "ask for help preparing for a meeting")]),
 q('intent', 'p7.intent', 2, ["Coffee has already been arranged.", "She wants Mr. Park to order coffee.", "The meeting has been canceled.", "Ms. Liu will set up the projector."], 0,
   "커피를 주문할지 묻자 '그건 해결됐다, Ms. Liu가 어제 주문했다'고 답한다. 이미 준비되었다는 뜻이다.",
   [N, "주문할 필요가 없다는 뜻이라 반대다.", "회의 취소 이야기는 없다.", "Ms. Liu는 커피를 주문한 사람이다. 프로젝터는 Mr. Park이 설치한다."],
   question="At 8:53 A.M., what does Ms. Ruiz mean when she writes, “That's taken care of”?"),
]))

U.append(setunit('p7-s17', 7, [P('email', 'E-mail', "To: Marco Bianchi <mbianchi@bianchipack.example>\nFrom: Grace Owusu <gowusu@tellismfg.example>\nDate: March 2\nSubject: Supplier registration\n\nDear Mr. Bianchi,\n\nThank you for agreeing to supply packaging materials to Tellis Manufacturing. Before we can process your first invoice, we need you to complete our supplier registration. Please send us the following by March 14: a completed supplier information form (attached), a copy of your business registration certificate, and your bank account details for direct deposit.\n\nPlease note that every invoice must include a Tellis purchase order number. Invoices without this number will be returned to the sender. Payments are made within 30 days of receiving a valid invoice.\n\nIf you have any questions, you can reach me at extension 4417.\n\nGrace Owusu\nAccounts Payable, Tellis Manufacturing")], [
 q('purpose', 'p7.purpose', 2, ["To explain what a new supplier must do", "To place an order for packaging materials", "To request payment of an overdue invoice", "To announce a change in payment terms"], 0,
   "첫 대금 처리 전에 공급업체 등록을 마쳐야 한다며 제출 서류와 청구서 규칙을 안내한다.",
   [N, "Mr. Bianchi가 이미 공급하기로 했고, 이 이메일은 주문서가 아니다.", "오히려 Tellis가 대금을 지급하는 쪽이며 연체 이야기는 없다.", "결제 조건(30일 이내)을 안내할 뿐 변경했다는 말은 없다."],
   question="What is the purpose of the e-mail?"),
 q('not', 'p7.not', 2, ["A completed form", "A business certificate", "Banking information", "A product catalog"], 3,
   "요청한 것은 공급업체 정보 양식, 사업자 등록증 사본, 은행 계좌 정보 세 가지다. 제품 카탈로그는 없다.",
   ["'a completed supplier information form'을 요청했다.", "'a copy of your business registration certificate'를 요청했다.", "'your bank account details for direct deposit'을 요청했다.", N],
   question="What is Mr. Bianchi NOT asked to send?"),
 q('detail', 'p7.detail', 2, ["It will be sent back.", "It will be paid late.", "It will be paid in cash.", "It will be forwarded to a manager."], 0,
   "'Invoices without this number will be returned to the sender'라고 했다. returned = sent back.",
   [N, "늦게 지급된다는 말이 아니라 아예 반송된다.", "현금 지급 이야기는 없다.", "관리자에게 전달된다는 말은 없다."],
   question="According to the e-mail, what will happen to an invoice that lacks a purchase order number?", para=[("will be returned to the sender", "will be sent back")]),
]))

U.append(setunit('p7-s18', 7, [P('notice', 'Notice', "FIRE DRILL NOTICE — Corden Tower\n\nA building-wide fire drill will take place on Wednesday, May 7, at 10:00 A.M. — [1] — When the alarm sounds, all occupants must leave the building using the nearest stairway. Elevators must not be used. — [2] —\n\nOnce outside, please go to your floor's assigned meeting point in Corden Plaza and report to your floor warden. — [3] — The drill should take about 20 minutes, after which an announcement will let everyone know it is safe to return.\n\nVisitors in the building at the time of the drill must also take part. — [4] — Questions may be sent to facilities@cordentower.example.")], [
 q('detail', 'p7.detail', 1, ["Report to a designated person", "Return to their desks", "Call the facilities office", "Wait near the elevators"], 0,
   "밖으로 나간 뒤 층별 집결지로 가서 floor warden(층 안전 담당자)에게 보고하라고 했다.",
   [N, "안전하다는 안내 방송이 나온 뒤에야 돌아갈 수 있다.", "facilities 이메일은 문의처일 뿐이다.", "엘리베이터는 사용하지 말라고 했고 집결지는 건물 밖 광장이다."],
   question="What should people do once they are outside the building?", para=[("report to your floor warden", "Report to a designated person")]),
 q('detail', 'p7.detail', 2, ["They are required to leave the building during the drill.", "They may use the elevators.", "They must register in advance.", "They will receive a separate notice."], 0,
   "'Visitors in the building at the time of the drill must also take part'라고 했다. 훈련에 참여한다는 것은 다른 사람들처럼 건물에서 나가야 한다는 뜻이다.",
   [N, "엘리베이터는 누구도 사용할 수 없다.", "사전 등록 이야기는 없다.", "방문객에게 별도 공지를 보낸다는 말은 없다."],
   question="What is indicated about visitors?", para=[("must also take part", "are required to leave the building during the drill")]),
 q('insert', 'p7.insert', 3, POS, 2,
   "주어진 문장의 Each meeting point는 바로 앞 문장의 assigned meeting point를 받는다. 집결지 안내 직후인 [3]이 알맞다.",
   ["[1] 앞에는 훈련 일시만 있어 집결지가 아직 언급되지 않았다.", "[2] 앞은 계단 이용·엘리베이터 금지 내용이라 집결지 표지판과 연결되지 않는다.", N, "[4] 앞은 방문객 참여 내용이라 흐름이 맞지 않는다."],
   question=INS, sentence="Each meeting point is marked by a sign showing the floor number."),
]))

U.append(setunit('p7-s19', 7, [P('article', 'Article', "Kiro Robotics to Open Research Center in Daejeon\n\nDAEJEON (June 12) — Kiro Robotics, a maker of warehouse robots, announced yesterday that it will open a research center in Daejeon next spring. The center will employ about 80 engineers and will focus on developing robots that can safely work alongside people.\n\nKiro chose Daejeon because of its strong universities and many research institutes, said chief executive Min-jae Oh. “We want to be close to the talent,” he said. The company has already signed agreements with two local universities that will allow graduate students to complete internships at the center.\n\nKiro currently employs 350 people at its headquarters in Seoul, where its robots are designed and assembled. Sales of the company's robots have tripled over the past three years, driven largely by demand from online retailers.\n\nThe new center will occupy two floors of the Daejeon Innovation Tower, which is still under construction. Hiring is expected to begin in the fall.")], [
 q('purpose', 'p7.purpose', 1, ["To report a company's plans for a new facility", "To review a new type of robot", "To announce a merger of two universities", "To describe the history of online retail"], 0,
   "기사는 Kiro Robotics가 대전에 연구 센터를 열 계획과 그 이유, 규모, 일정을 다룬다.",
   [N, "로봇 제품 평가가 아니다.", "대학 두 곳과 협약을 맺었을 뿐 합병 이야기는 없다.", "온라인 소매업은 매출 증가 이유로만 언급된다."],
   question="What is the article mainly about?"),
 q('detail', 'p7.detail', 2, ["Access to well-educated workers", "Lower office rents", "Its location near major customers", "Tax benefits from the city"], 0,
   "대학과 연구소가 많아서 대전을 골랐고 'We want to be close to the talent'라고 했다. 인재 확보가 이유다.",
   [N, "임대료 이야기는 없다.", "주요 고객은 온라인 소매업체라고만 했고 위치 이야기는 없다.", "세금 혜택은 언급되지 않았다."],
   question="Why did Kiro Robotics choose Daejeon?", para=[("strong universities ... close to the talent", "Access to well-educated workers")]),
 q('synonym', 'p7.synonym', 2, ["caused", "operated", "steered", "delivered"], 0,
   "'매출이 세 배가 되었는데 주로 온라인 소매업체 수요 때문'이라는 뜻이다. driven by = caused by.",
   [N, "operated(운영된)는 drive의 '기계를 움직이다' 뜻에서 온 함정이다.", "steered(조종된)는 drive의 '운전하다' 뜻이다.", "delivered(배달된)는 문맥과 맞지 않는다."],
   question="The word “driven” in paragraph 3 is closest in meaning to"),
 q('inference', 'p7.inference', 3, ["It will not open until its building is completed.", "Its engineers will assemble robots there.", "It will be located in Seoul.", "It has already hired 80 engineers."], 0,
   "센터는 아직 공사 중인 Daejeon Innovation Tower 두 개 층을 쓸 예정이고, 내년 봄에 문을 연다. 건물이 완공되어야 문을 열 수 있다.",
   [N, "조립은 서울 본사에서 한다. 센터는 연구 개발용이다.", "센터는 대전에 생긴다.", "채용은 가을에 시작될 예정이다."],
   question="What is suggested about the research center?", trap=True),
]))

U.append(setunit('p7-s20', 7, [P('online chat discussion', 'Online chat discussion', "Sarah Kim [3:02 P.M.]\nThe caterer just told me they can't deliver before 11:30 on Friday.\n\nLuis Ortega [3:03 P.M.]\nThe workshop lunch starts at 11:45, right?\n\nSarah Kim [3:04 P.M.]\nRight. So it should be fine, but it'll be tight.\n\nDana Wells [3:06 P.M.]\nI can come in early and set up the tables and plates beforehand. That way they'll just need to bring the food in.\n\nSarah Kim [3:07 P.M.]\nThat would help a lot.\n\nLuis Ortega [3:09 P.M.]\nI'll ask the speaker to finish her morning session a few minutes early, just in case.\n\nDana Wells [3:10 P.M.]\nGood idea. I'll also put up signs pointing to the dining room.")], [
 q('detail', 'p7.detail', 1, ["A delivery cannot be made early.", "The caterer canceled the order.", "The workshop has been moved to another day.", "The dining room is too small."], 0,
   "케이터링 업체가 금요일 11시 30분 전에는 배달할 수 없다고 했다.",
   [N, "주문 취소가 아니라 배달 시간 제약이다.", "워크숍 날짜 변경 이야기는 없다.", "식당 크기 이야기는 없다."],
   question="What problem does Ms. Kim mention?", para=[("can't deliver before 11:30", "A delivery cannot be made early")]),
 q('intent', 'p7.intent', 2, ["There will be little extra time.", "The dining room will be crowded.", "The budget is limited.", "The schedule needs to be changed."], 0,
   "배달 11시 30분, 점심 11시 45분이라 '괜찮겠지만 빠듯하다'는 말이다. 여유 시간이 거의 없다는 뜻.",
   [N, "tight를 '공간이 좁다'로 오해하게 만드는 함정이다.", "예산 이야기는 없다.", "'should be fine'이라고 했으므로 일정을 바꿀 필요는 없다."],
   question="At 3:04 P.M., what does Ms. Kim mean when she writes, “it'll be tight”?", trap=True),
 q('detail', 'p7.detail', 1, ["Prepare the room before the food arrives", "Pick up the food herself", "Lead the morning session", "Call the caterer"], 0,
   "일찍 와서 테이블과 접시를 미리 차려 두겠다고 했다.",
   [N, "음식을 직접 가져오겠다는 말은 없다.", "오전 세션 진행자는 강연자다.", "케이터링 업체에 연락하겠다는 말은 없다."],
   question="What does Ms. Wells offer to do?", para=[("set up the tables and plates beforehand", "Prepare the room before the food arrives")]),
 q('inference', 'p7.inference', 2, ["Contact a presenter", "Order more food", "Reserve a different room", "Put up signs"], 0,
   "Mr. Ortega는 강연자에게 오전 세션을 몇 분 일찍 끝내 달라고 부탁하겠다고 했다.",
   [N, "음식 추가 주문 이야기는 없다.", "다른 장소를 예약하겠다는 말은 없다.", "안내 표지판은 Ms. Wells가 붙이겠다고 했다."],
   question="What will Mr. Ortega most likely do next?", para=[("ask the speaker to finish her morning session", "Contact a presenter")]),
]))

U.append(setunit('p7-s21', 7, [P('advertisement', 'Advertisement', "Ledgerly Small Business Accounting\n\nSpend less time on bookkeeping and more time growing your business. Ledgerly automatically sorts your expenses, sends invoices to your customers, and prepares reports for tax season. You can connect your bank account in minutes, and our mobile app lets you photograph receipts wherever you are.\n\nPlans start at $12 per month for a single user. Our Team plan, at $30 per month, includes up to five users and priority phone support.\n\nTry Ledgerly free for 30 days. No credit card is required to start your trial. Sign up at www.ledgerly.example.")], [
 q('not', 'p7.not', 2, ["Sorting expenses", "Sending invoices", "Preparing tax reports", "Processing employee payroll"], 3,
   "지출 분류, 청구서 발송, 세금 보고서 작성은 언급되지만 급여 처리는 없다.",
   ["'automatically sorts your expenses'에 나온다.", "'sends invoices to your customers'에 나온다.", "'prepares reports for tax season'에 나온다.", N],
   question="What is NOT mentioned as a feature of Ledgerly?"),
 q('detail', 'p7.detail', 2, ["Faster access to phone support", "An unlimited number of users", "A free mobile device", "In-person training"], 0,
   "Team 플랜에는 최대 5명 사용과 priority phone support(우선 전화 지원)가 포함된다.",
   [N, "사용자는 최대 5명이다.", "모바일 기기 제공 이야기는 없다. 앱이 있을 뿐이다.", "대면 교육은 언급되지 않았다."],
   question="What is included in the Team plan?", para=[("priority phone support", "Faster access to phone support")]),
 q('detail', 'p7.detail', 1, ["Users do not need to enter payment information to begin.", "It lasts for twelve months.", "It is available only for the Team plan.", "It must be started at a store."], 0,
   "'No credit card is required to start your trial'이라고 했다.",
   [N, "체험 기간은 30일이다.", "플랜 제한 이야기는 없다.", "웹사이트에서 가입한다."],
   question="What is indicated about the free trial?", para=[("No credit card is required", "do not need to enter payment information")]),
]))

U.append(setunit('p7-s22', 7, [P('form', 'Registration Confirmation', "Coastline Marketing Conference — Registration Confirmation\nAttendee: Hye-jin Cho, Tidewater Hotels\nConfirmation number: CMC-2291\n\nNote: Badges can be picked up at the registration desk starting at 8:00 A.M. on October 13. Please bring photo identification. Cancellations made before September 30 will receive a full refund minus a $25 processing fee.",
   [["Item", "Date", "Price"], ["Full conference pass", "Oct. 14–15", "$480.00"], ["Workshop: Social Media Analytics", "Oct. 13", "$95.00"], ["Networking dinner", "Oct. 14", "$60.00"], ["Early registration discount (10%)", "", "−$63.50"], ["Total paid", "", "$571.50"]])], [
 q('detail', 'p7.detail', 2, ["The day before the main conference begins", "On the first day of the main conference", "On the evening of October 14", "After the conference ends"], 0,
   "워크숍은 10월 13일이고 본 행사 패스는 10월 14~15일이다. 본 행사 전날에 열린다.",
   [N, "본 행사 첫날은 10월 14일이다.", "10월 14일 저녁에는 네트워킹 만찬이 있다.", "워크숍은 행사 뒤가 아니라 앞이다."],
   question="When will the workshop take place?"),
 q('inference', 'p7.inference', 2, ["She registered early.", "She will speak at the conference.", "She works for a marketing firm.", "She canceled her registration."], 0,
   "결제 내역에 조기 등록 할인 10%가 적용되어 있다. 일찍 등록했음을 알 수 있다.",
   [N, "연사라는 정보는 없다.", "소속은 Tidewater Hotels다.", "결제 완료 확인서이며 취소 흔적은 없다."],
   question="What is suggested about Ms. Cho?"),
 q('detail', 'p7.detail', 1, ["Photo identification", "A printed receipt", "A business card", "Her conference pass number"], 0,
   "'Please bring photo identification'이라고 했다.",
   [N, "영수증을 가져오라는 말은 없다.", "명함은 언급되지 않았다.", "확인 번호를 가져오라는 말은 없다."],
   question="What must attendees bring to pick up their badges?"),
]))

U.append(setunit('p7-s23', 7, [P('email', 'E-mail', "To: sales@pinpointprint.example\nFrom: Tomas Varga\nDate: February 3\nSubject: Quote request\n\nHello,\n\nI manage the gift shop at the Harmon History Museum. — [1] — We are planning to sell a set of six postcards featuring photographs from our new exhibit, which opens on April 10. — [2] —\n\nWe would like 2,000 sets printed on heavy, glossy card stock. Could you send me a price quote, along with samples of the paper you would recommend? — [3] — Our board must approve all purchases over $1,000, and it next meets on February 24, so I would need your quote before then.\n\n— [4] — Thank you,\nTomas Varga")], [
 q('purpose', 'p7.purpose', 1, ["To ask for pricing information", "To complain about a printing error", "To promote a museum exhibit", "To apply for a job"], 0,
   "엽서 인쇄 견적과 종이 샘플을 요청하는 이메일이다.",
   [N, "인쇄 오류 불만이 아니다.", "전시는 엽서 사진의 출처로 언급될 뿐 홍보 목적이 아니다.", "구직 이메일이 아니다."],
   question="Why did Mr. Varga write the e-mail?", para=[("Could you send me a price quote", "To ask for pricing information")]),
 q('detail', 'p7.detail', 2, ["A group must approve the expense.", "The exhibit opens on that date.", "The gift shop will close for repairs.", "He will be away on vacation."], 0,
   "1,000달러가 넘는 구매는 이사회 승인이 필요하고 이사회가 2월 24일에 열린다.",
   [N, "전시는 4월 10일에 열린다.", "기념품점 공사 이야기는 없다.", "휴가 이야기는 없다."],
   question="Why does Mr. Varga need a quote before February 24?", para=[("Our board must approve all purchases over $1,000", "A group must approve the expense")]),
 q('insert', 'p7.insert', 3, POS, 1,
   "The images는 바로 앞 문장의 photographs from our new exhibit를 가리킨다. 엽서 사진 소개 직후인 [2]가 알맞다.",
   ["[1] 앞에는 기념품점을 운영한다는 소개만 있어 The images가 가리킬 대상이 없다.", N, "[3] 앞은 견적과 종이 샘플 요청이라 사진 설명이 끼어들 자리가 아니다.", "[4]는 마무리 인사 직전이라 흐름이 맞지 않는다."],
   question=INS, sentence="The images were taken by local photographers in the 1920s."),
]))

U.append(setunit('p7-s24', 7, [P('notice', 'Notice', "Notice to Customers\n\nMartel Hardware will be closed on Sunday, January 12, so that our staff can complete our annual inventory count. We will reopen at our regular time, 8:00 A.M., on Monday, January 13.\n\nOnline orders can still be placed during this time, but they will not be processed until Monday. Customers who need to pick up special orders that weekend are asked to do so by 6:00 P.M. on Saturday, January 11.\n\nWe thank you for your patience.")], [
 q('detail', 'p7.detail', 1, ["To count the items in stock", "To renovate the store", "To celebrate a holiday", "To train new employees"], 0,
   "'so that our staff can complete our annual inventory count'라고 했다. 재고 조사 = 재고 수량 확인.",
   [N, "공사 이야기는 없다.", "휴일 이야기는 없다.", "직원 교육 이야기는 없다."],
   question="Why will Martel Hardware be closed on January 12?", para=[("annual inventory count", "count the items in stock")]),
 q('detail', 'p7.detail', 2, ["Collect them before the store closes", "Pick them up on Monday afternoon", "Reorder them online", "Call the store on Sunday"], 0,
   "그 주말에 특별 주문품을 찾아야 하는 고객은 토요일 오후 6시까지 찾아가라고 했다. 휴무 전에 찾아가라는 뜻.",
   [N, "월요일은 재개장일이지만 주말에 필요한 고객에게 준 안내가 아니다.", "온라인 재주문을 권하지 않는다.", "일요일에는 문을 닫는다."],
   question="What are customers with special orders asked to do?", para=[("pick up ... by 6:00 P.M. on Saturday", "Collect them before the store closes")]),
]))

U.append(setunit('p7-s25', 7, [P('text message chain', 'Text-message chain', "Paolo Greco [1:15 P.M.]\nHi Amina, the delivery van broke down on Route 9. I won't make it to the Linwood store by 2.\n\nAmina Osei [1:17 P.M.]\nOh no. Is the truck from the north depot free?\n\nPaolo Greco [1:18 P.M.]\nIt's out until 4.\n\nAmina Osei [1:19 P.M.]\nThen I'll call Linwood and move the delivery to tomorrow morning. Can you get the van towed?\n\nPaolo Greco [1:20 P.M.]\nAlready on it. The tow company says 30 minutes.")], [
 q('intent', 'p7.intent', 2, ["Another vehicle is not available.", "The store closes at 4 o'clock.", "He will arrive at the store at 4.", "The van will be repaired by 4."], 0,
   "북쪽 창고 트럭을 쓸 수 있는지 묻자 '4시까지 나가 있다'고 답한다. 대체 차량을 쓸 수 없다는 뜻이고, 그래서 배송을 내일로 미룬다.",
   [N, "매장 영업 시간 이야기가 아니다.", "Mr. Greco가 4시에 도착한다는 말이 아니다.", "밴 수리 시간 이야기가 아니다. 견인 차는 30분 뒤에 온다."],
   question="At 1:18 P.M., what does Mr. Greco imply when he writes, “It's out until 4”?"),
 q('inference', 'p7.inference', 1, ["Contact a store to change a delivery time", "Drive the north depot truck", "Call a tow company", "Repair the van"], 0,
   "Ms. Osei는 Linwood 매장에 전화해 배송을 내일 아침으로 옮기겠다고 했다.",
   [N, "트럭은 4시까지 쓸 수 없다.", "견인 업체에는 Mr. Greco가 이미 연락했다.", "수리 이야기는 없다."],
   question="What will Ms. Osei most likely do next?", para=[("call Linwood and move the delivery to tomorrow morning", "Contact a store to change a delivery time")]),
]))

U.append(setunit('p7-s26', 7, [P('article', 'Article', "Local Bakery Wins Regional Award\n\nGLENWOOD (May 20) — Rosewood Bakery has been named Small Business of the Year by the Glenwood Regional Business Council. The award recognizes companies that have shown strong growth, community involvement, and excellent customer service.\n\nFounded six years ago by Elena Park, Rosewood started as a stand at the weekend farmers market. It now operates two shops and supplies bread to more than 20 restaurants. Last year, the bakery launched a training program that teaches baking skills to young adults looking for work. Eight graduates have since been hired by local businesses, including three by Rosewood itself.\n\nMs. Park will accept the award at the council's annual dinner on June 3. “This award belongs to my whole team,” she said.")], [
 q('not', 'p7.not', 2, ["It supplies bread to restaurants.", "It began at a market.", "It runs a training program.", "It plans to open a third shop."], 3,
   "식당 공급, 시장 노점에서 시작, 교육 프로그램은 모두 나오지만 세 번째 매장 계획은 없다.",
   ["'supplies bread to more than 20 restaurants'에 나온다.", "'started as a stand at the weekend farmers market'에 나온다.", "'launched a training program'에 나온다.", N],
   question="What is NOT mentioned about Rosewood Bakery?"),
 q('synonym', 'p7.synonym', 3, ["honors", "identifies", "admits", "remembers"], 0,
   "상이 '성장·지역 기여·고객 서비스를 보여 준 기업을 기린다'는 뜻이다. recognize = honor.",
   [N, "identifies(알아보다)는 recognize의 대표 뜻이지만 시상 문맥에서는 맞지 않는다. 사전 1순위 뜻 함정.", "admits(인정하다, 입장시키다)는 문맥과 맞지 않는다.", "remembers(기억하다)도 시상 문맥과 맞지 않는다."],
   question="The word “recognizes” in paragraph 1 is closest in meaning to", trap=True),
 q('detail', 'p7.detail', 2, ["Some of its graduates now work at Rosewood.", "It is offered only to restaurant owners.", "It began six years ago.", "It is funded by the business council."], 0,
   "수료생 8명이 지역 업체에 채용되었고 그중 3명은 Rosewood가 직접 채용했다.",
   [N, "구직 중인 청년 대상이다.", "작년에 시작했다. 6년 전은 빵집 창업 시점이다.", "재원 이야기는 없다."],
   question="What is indicated about the training program?", para=[("three by Rosewood itself", "Some of its graduates now work at Rosewood")]),
]))

U.append(setunit('p7-s27', 7, [P('web page', 'Web Page', "Frequently Asked Questions — CityWheels Car Sharing\n\nHow do I reserve a car?\nUse the CityWheels app to see available cars near you. You can reserve a car up to 14 days in advance or start a trip right away.\n\nWhat if I return a car late?\nLate returns are charged at $1 per minute, up to a maximum of $50, because another member may be waiting for the car. If you know you will be late, you can extend your trip in the app as long as the car has not been reserved by someone else.\n\nIs fuel included?\nYes. Each car contains a fuel card that members can use at any major gas station. Please refill the tank if it is less than one-quarter full at the end of your trip.")], [
 q('detail', 'p7.detail', 1, ["Up to two weeks", "Up to one month", "Only on the same day", "Up to 48 hours"], 0,
   "'up to 14 days in advance'라고 했다. 14일 = 2주.",
   [N, "한 달이라는 말은 없다.", "당일 바로 이용도 가능하지만 최대 14일 전까지 예약할 수 있다.", "48시간은 언급되지 않았다."],
   question="How far in advance can members reserve a car?", para=[("up to 14 days in advance", "Up to two weeks")]),
 q('inference', 'p7.inference', 2, ["It is not always possible.", "It is free of charge.", "It requires a phone call.", "It is limited to 50 minutes."], 0,
   "다른 회원이 그 차를 예약하지 않았을 때만(as long as) 연장할 수 있다. 연장이 항상 가능한 것은 아니다.",
   [N, "연장 요금 이야기는 없다.", "앱에서 연장한다.", "50달러는 지각 요금 상한이지 연장 시간 제한이 아니다."],
   question="What is suggested about extending a trip?"),
 q('detail', 'p7.detail', 1, ["Add fuel when the tank is low", "Return the fuel card to the office", "Pay for fuel in cash", "Use one specific gas station"], 0,
   "반납 시 연료가 4분의 1 미만이면 주유하라고 했다.",
   [N, "주유 카드를 반납하라는 말은 없다. 차 안에 있다.", "주유 카드를 쓰므로 현금 이야기는 없다.", "주요 주유소 어디서나 쓸 수 있다."],
   question="What are members asked to do at the end of a trip?", para=[("refill the tank if it is less than one-quarter full", "Add fuel when the tank is low")]),
]))

U.append(setunit('p7-s28', 7, [P('letter', 'Letter', "Dear Ms. Alvarez,\n\nI am writing to invite Seaview Logistics to take part in the Westbrook University Spring Career Fair, which will be held on March 18 in the Student Center. Last year, more than 1,500 students attended, and 85 employers participated.\n\nBooths are available to employers free of charge. Each booth comes with a table, two chairs, and access to electricity. If you would like to offer on-site interviews, we can also reserve a private room near the main hall for $50.\n\nStudents attending the fair will come mainly from our business, engineering, and computer science programs. Many of them are looking for summer internships as well as full-time positions after graduation.\n\nTo reserve a booth, please complete the online form at careers.westbrook.example by February 20. Booth locations are assigned in the order in which registrations are received.\n\nSincerely,\nMichael Osei\nDirector of Career Services")], [
 q('purpose', 'p7.purpose', 1, ["To invite a company to an event", "To request a donation", "To announce a new degree program", "To offer Ms. Alvarez a job"], 0,
   "Seaview Logistics를 봄 채용 박람회에 초대하는 편지다.",
   [N, "부스는 무료이고 기부 요청은 없다.", "학과는 참석 학생들의 전공으로만 언급된다.", "채용 제안 편지가 아니다."],
   question="What is the purpose of the letter?"),
 q('not', 'p7.not', 2, ["A table", "Chairs", "Electricity", "A display screen"], 3,
   "부스에는 테이블, 의자 두 개, 전기가 제공된다. 화면은 언급되지 않았다.",
   ["'a table'이 제공된다.", "'two chairs'가 제공된다.", "'access to electricity'가 제공된다.", N],
   question="What is NOT provided with each booth?"),
 q('detail', 'p7.detail', 1, ["A private space for interviews", "A booth near the entrance", "Extra chairs", "A list of student résumés"], 0,
   "현장 면접용 별도 방을 50달러에 예약해 준다고 했다.",
   [N, "입구 쪽 부스 요금 이야기는 없다.", "추가 의자 요금은 없다.", "이력서 목록 판매 이야기는 없다."],
   question="What is available for an additional fee?", para=[("a private room ... for $50", "A private space for interviews")]),
 q('detail', 'p7.detail', 2, ["They depend on when a company registers.", "They are chosen by students.", "They are assigned by industry.", "They cost more near the main hall."], 0,
   "'Booth locations are assigned in the order in which registrations are received'라고 했다. 등록 순서대로 배정된다.",
   [N, "학생이 고른다는 말은 없다.", "업종별 배정 이야기는 없다.", "부스는 무료이고 위치별 요금 차이는 없다."],
   question="What is indicated about booth locations?", para=[("assigned in the order in which registrations are received", "depend on when a company registers")]),
]))

U.append(setunit('p7-s29', 7, [P('memo', 'Memo', "MEMO\nTo: All Finance Department staff\nFrom: Helen Wu, Finance Director\nDate: August 18\nSubject: Move to the fifth floor\n\nAs you know, the Finance Department will move from the second floor to the fifth floor over the weekend of August 30. — [1] — Movers will transport all furniture and files, but you are responsible for packing the items in your own desk. — [2] —\n\nBoxes and labels will be delivered to the department on August 26. Please label each box with your name and new desk number, which you will find on the seating chart posted in the break room. — [3] —\n\nOur phone numbers and e-mail addresses will stay the same. — [4] — Thank you for your cooperation.")], [
 q('detail', 'p7.detail', 1, ["Packing their own desk items", "Moving the department's files", "Delivering boxes", "Assigning new desks"], 0,
   "이사 업체가 가구와 서류를 옮기지만 각자 책상 안 물건은 직접 싸야 한다.",
   [N, "서류는 이사 업체가 옮긴다.", "상자는 8월 26일에 배달된다.", "자리는 이미 좌석표로 정해져 있다."],
   question="What are employees responsible for?", para=[("packing the items in your own desk", "Packing their own desk items")]),
 q('detail', 'p7.detail', 1, ["On a chart in the break room", "On the boxes", "In an e-mail from Ms. Wu", "At the fifth-floor reception desk"], 0,
   "새 자리 번호는 휴게실에 붙은 좌석표에서 확인하라고 했다.",
   [N, "상자에는 직원이 자리 번호를 적는다.", "이메일 이야기는 없다.", "5층 안내 데스크는 언급되지 않았다."],
   question="Where can employees find their new desk numbers?"),
 q('insert', 'p7.insert', 3, POS, 2,
   "앞 문장이 '상자마다 이름과 새 자리 번호를 적으라'는 지시다. 라벨이 없으면 제자리에 가지 못할 수 있다는 경고가 그 직후 [3]에 들어간다.",
   ["[1] 앞에서는 상자·라벨이 아직 나오지 않았다.", "[2] 앞에서도 라벨 안내가 나오기 전이다.", N, "[4] 앞은 전화번호·이메일 유지 내용이라 연결되지 않는다."],
   question=INS, sentence="Boxes without labels may not reach the correct location."),
]))

U.append(setunit('p7-s30', 7, [P('email', 'E-mail', "To: billing@harborviewhotel.example\nFrom: Kenji Watanabe\nDate: November 4\nSubject: Charges for stay, October 28–30\n\nDear Billing Department,\n\nI stayed at the Harborview Hotel from October 28 to 30 while attending a conference. When I reviewed my credit card statement, I noticed two charges that I believe were made in error.\n\nFirst, I was charged $35 for parking each night. However, when I booked my room, I was told that parking was included in the conference rate, and this is stated in my booking confirmation, which I have attached. Second, there is a $22 charge for the minibar, but I did not use anything from it during my stay.\n\nI would appreciate it if you could look into these charges and refund the correct amount. I can be reached at this e-mail address or at 555-0193.\n\nSincerely,\nKenji Watanabe")], [
 q('purpose', 'p7.purpose', 1, ["To question charges on a bill", "To book a room for a conference", "To praise the hotel staff", "To change a reservation"], 0,
   "잘못 청구된 것으로 보이는 두 항목에 대해 확인과 환불을 요청한다.",
   [N, "숙박은 이미 끝났다.", "칭찬 내용은 없다.", "예약 변경 요청이 아니다."],
   question="Why did Mr. Watanabe write the e-mail?", para=[("two charges that I believe were made in error", "question charges on a bill")]),
 q('detail', 'p7.detail', 1, ["A booking confirmation", "A credit card statement", "A minibar receipt", "A conference program"], 0,
   "주차 포함 조건이 적힌 예약 확인서를 첨부했다고 했다.",
   [N, "카드 명세서를 확인했다고 했을 뿐 첨부하지 않았다.", "미니바 영수증은 언급되지 않았다.", "컨퍼런스 일정표는 첨부하지 않았다."],
   question="What did Mr. Watanabe include with the e-mail?"),
 q('inference', 'p7.inference', 3, ["$35", "$57", "$92", "$127"], 2,
   "10월 28일부터 30일까지는 2박이다. 주차비 35달러 × 2박 = 70달러에 미니바 22달러를 더하면 92달러.",
   ["35달러는 주차비 1박분뿐이다.", "57달러는 주차 1박분과 미니바만 더한 값이다.", N, "127달러는 3박으로 잘못 계산한 값이다. 28·29·30일 세 날짜를 박수로 세면 빠지는 함정."],
   question="How much does Mr. Watanabe most likely expect to be refunded?", trap=True),
 q('synonym', 'p7.synonym', 2, ["investigate", "enter", "watch", "expect"], 0,
   "'이 청구 내역을 조사해 달라'는 뜻이다. look into = investigate.",
   [N, "enter(들어가다)는 look into의 글자 뜻에 끌린 함정이다.", "watch(지켜보다)는 문맥과 맞지 않는다.", "expect(기대하다)는 의미가 다르다."],
   question="The phrase “look into” in paragraph 3 is closest in meaning to"),
]))

write('p7-5.json', U)
