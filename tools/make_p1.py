# Part 1 장면 SVG + 문항 생성 (작성 도구). 결과물: toeic/data/p1.json
import json, os

SKIN = '#e2b38c'
INK = '#3b4652'

def svg(body, bg='#eef2f5', floor='#d9cdbb', floor_y=160):
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200' role='img'>"
            f"<rect width='320' height='200' fill='{bg}'/>"
            + (f"<rect y='{floor_y}' width='320' height='{200-floor_y}' fill='{floor}'/>" if floor else '')
            + body + "</svg>")

def person(x, y, shirt, pants='#4a5563', hair='#3b2a20', arm_l=None, arm_r=None, skirt=False, legs=True):
    """x,y = 머리 중심. arm_* = (끝x, 끝y) 손 위치."""
    s = f"<circle cx='{x}' cy='{y}' r='11' fill='{SKIN}'/>"
    s += f"<path d='M{x-11} {y-2} q11 -14 22 0 q-3 -9 -11 -10 q-8 1 -11 10z' fill='{hair}'/>"
    # 몸통
    if skirt:
        s += f"<path d='M{x-12} {y+13} h24 l7 52 h-38z' fill='{shirt}'/>"
        leg_top = y + 65
    else:
        s += f"<rect x='{x-12}' y='{y+13}' width='24' height='36' rx='6' fill='{shirt}'/>"
        if legs:
            s += f"<rect x='{x-11}' y='{y+47}' width='10' height='38' fill='{pants}'/><rect x='{x+1}' y='{y+47}' width='10' height='38' fill='{pants}'/>"
        leg_top = None
    if skirt and legs:
        s += f"<line x1='{x-6}' y1='{leg_top}' x2='{x-7}' y2='{leg_top+22}' stroke='{SKIN}' stroke-width='5' stroke-linecap='round'/>"
        s += f"<line x1='{x+6}' y1='{leg_top}' x2='{x+7}' y2='{leg_top+22}' stroke='{SKIN}' stroke-width='5' stroke-linecap='round'/>"
    al = arm_l or (x - 16, y + 45)
    ar = arm_r or (x + 16, y + 45)
    s += f"<line x1='{x-10}' y1='{y+18}' x2='{al[0]}' y2='{al[1]}' stroke='{shirt}' stroke-width='6' stroke-linecap='round'/>"
    s += f"<line x1='{x+10}' y1='{y+18}' x2='{ar[0]}' y2='{ar[1]}' stroke='{shirt}' stroke-width='6' stroke-linecap='round'/>"
    s += f"<circle cx='{al[0]}' cy='{al[1]}' r='3.5' fill='{SKIN}'/><circle cx='{ar[0]}' cy='{ar[1]}' r='3.5' fill='{SKIN}'/>"
    return s

def chair(x, y, color='#7a5c43'):
    # 옆에서 본 의자: 등받이 + 좌판 + 다리
    return (f"<rect x='{x}' y='{y-30}' width='5' height='34' fill='{color}'/>"
            f"<rect x='{x}' y='{y}' width='30' height='5' fill='{color}'/>"
            f"<rect x='{x+1}' y='{y+5}' width='4' height='22' fill='{color}'/><rect x='{x+25}' y='{y+5}' width='4' height='22' fill='{color}'/>")

def bike(x, y, frame='#2f6fb3'):
    return (f"<circle cx='{x}' cy='{y}' r='15' fill='none' stroke='{INK}' stroke-width='3'/>"
            f"<circle cx='{x+44}' cy='{y}' r='15' fill='none' stroke='{INK}' stroke-width='3'/>"
            f"<path d='M{x} {y} L{x+16} {y-22} L{x+38} {y-22} L{x+44} {y} M{x+16} {y-22} L{x+22} {y} L{x} {y} M{x+22} {y} L{x+38} {y-22}' fill='none' stroke='{frame}' stroke-width='3.5' stroke-linejoin='round'/>"
            f"<line x1='{x+14}' y1='{y-27}' x2='{x+22}' y2='{y-27}' stroke='{INK}' stroke-width='4' stroke-linecap='round'/>"
            f"<path d='M{x+38} {y-22} l2 -8 h7' fill='none' stroke='{INK}' stroke-width='3' stroke-linecap='round'/>")

def box(x, y, w=40, h=28):
    return (f"<rect x='{x}' y='{y}' width='{w}' height='{h}' fill='#c99a62' stroke='#9c7442' stroke-width='2'/>"
            f"<line x1='{x+w/2}' y1='{y}' x2='{x+w/2}' y2='{y+h}' stroke='#e8d3a8' stroke-width='4'/>")

scenes = {}

# 1. 여자가 화분에 물을 주는 장면
b = ("<rect x='190' y='22' width='104' height='76' fill='#cfe6f7' stroke='#6b7a88' stroke-width='4'/>"
     "<line x1='242' y1='22' x2='242' y2='98' stroke='#6b7a88' stroke-width='4'/>"
     "<rect x='180' y='122' width='126' height='8' fill='#8a6a4a'/><rect x='186' y='130' width='7' height='30' fill='#8a6a4a'/><rect x='293' y='130' width='7' height='30' fill='#8a6a4a'/>")
for px in (204, 244, 282):
    b += f"<circle cx='{px}' cy='96' r='13' fill='#4f9a55'/><circle cx='{px-8}' cy='104' r='8' fill='#5aa860'/><circle cx='{px+8}' cy='104' r='8' fill='#5aa860'/>"
    b += f"<path d='M{px-12} 104 h24 l-4 18 h-16z' fill='#c46b3c'/>"
b += person(112, 58, '#3a7bd5', skirt=True, arm_r=(150, 92), hair='#2b1d14')
b += "<rect x='146' y='84' width='28' height='18' rx='4' fill='#7c8a96'/><path d='M150 84 q10 -14 20 0' fill='none' stroke='#7c8a96' stroke-width='3'/>"
b += "<line x1='173' y1='90' x2='190' y2='80' stroke='#7c8a96' stroke-width='4' stroke-linecap='round'/>"
b += "<ellipse cx='193' cy='86' rx='2' ry='3.5' fill='#3d8fd6'/><ellipse cx='197' cy='93' rx='2' ry='3.5' fill='#3d8fd6'/><ellipse cx='194' cy='99' rx='2' ry='3.5' fill='#3d8fd6'/>"
scenes['p1-001'] = svg(b)

# 2. 사람 없는 방, 벽에 의자들이 쌓여 있고 테이블 하나
b = "<rect x='0' y='0' width='320' height='8' fill='#d5dde3'/>"
for i in range(4):
    b += chair(28 + i * 3, 96 + i * 12, '#7a5c43' if i % 2 == 0 else '#8b6b50')
b += "<rect x='170' y='108' width='120' height='8' fill='#9a7a5a'/><rect x='178' y='116' width='7' height='44' fill='#9a7a5a'/><rect x='275' y='116' width='7' height='44' fill='#9a7a5a'/>"
b += "<rect x='120' y='30' width='60' height='40' fill='#f7f7f2' stroke='#9aa5ae' stroke-width='3'/>"
scenes['p1-002'] = svg(b)

# 3. 울타리를 따라 세워진 자전거들, 오른쪽에 나무
b = "<rect y='0' width='320' height='130' fill='#dcebf5'/>"
b += "<rect y='130' width='320' height='70' fill='#c9d6b4'/>"
for fx in range(10, 310, 26):
    b += f"<rect x='{fx}' y='92' width='8' height='60' fill='#b8a07e'/>"
b += "<rect x='0' y='102' width='320' height='7' fill='#a48c69'/><rect x='0' y='128' width='320' height='7' fill='#a48c69'/>"
for bx in (30, 110, 190):
    b += bike(bx, 160)
b += "<rect x='284' y='70' width='10' height='80' fill='#7a5a3c'/><circle cx='289' cy='60' r='28' fill='#5c9e5c'/>"
scenes['p1-003'] = svg(b, floor=None)

# 4. 사다리에 올라선 남자가 천장 조명을 만지는 장면
b = "<rect x='0' y='0' width='320' height='14' fill='#cfd7de'/>"
b += "<line x1='170' y1='14' x2='170' y2='26' stroke='#6b7a88' stroke-width='3'/><path d='M154 26 h32 l-6 12 h-20z' fill='#f0d66b' stroke='#b49a2f' stroke-width='2'/>"
# A형 사다리
b += "<line x1='140' y1='70' x2='118' y2='160' stroke='#9aa5ae' stroke-width='5'/><line x1='160' y1='70' x2='186' y2='160' stroke='#9aa5ae' stroke-width='5'/>"
for ry in (95, 120, 145):
    b += f"<line x1='{140-(ry-70)*22/90:.0f}' y1='{ry}' x2='{160+(ry-70)*26/90:.0f}' y2='{ry}' stroke='#9aa5ae' stroke-width='4'/>"
b += person(150, 22 + 2, '#d9822b', pants='#33415a', arm_l=(158, 40), arm_r=(166, 36), legs=False)
b += "<rect x='139' y='72' width='10' height='22' fill='#33415a'/><rect x='151' y='72' width='10' height='22' fill='#33415a'/>"
b += "<rect x='240' y='60' width='50' height='70' fill='#e3e8ec' stroke='#a7b1ba' stroke-width='3'/>"
scenes['p1-004'] = svg(b)

# 5. 손수레 위에 실린 상자들 (사람 없음), 창고 문
b = "<rect x='230' y='40' width='70' height='120' fill='#aab4bd' stroke='#7d8892' stroke-width='3'/>"
for ly in range(52, 160, 14):
    b += f"<line x1='232' y1='{ly}' x2='298' y2='{ly}' stroke='#8e99a3' stroke-width='2'/>"
b += "<rect x='70' y='140' width='110' height='8' fill='#56616c'/><circle cx='84' cy='154' r='7' fill='#2e353c'/><circle cx='166' cy='154' r='7' fill='#2e353c'/>"
b += "<line x1='178' y1='140' x2='190' y2='88' stroke='#56616c' stroke-width='5'/><line x1='186' y1='88' x2='198' y2='88' stroke='#56616c' stroke-width='6' stroke-linecap='round'/>"
b += box(78, 112) + box(122, 112) + box(98, 84) + box(142, 84, 32, 28) + box(110, 56, 36, 28)
scenes['p1-005'] = svg(b)

# 6. 안내 데스크 뒤의 여자가 앞에 선 남자에게 서류를 건네는 장면 (모니터 있음)
b = "<rect x='40' y='112' width='170' height='48' fill='#8b7b6b'/><rect x='36' y='106' width='178' height='8' fill='#a8968a'/>"
b += "<rect x='54' y='72' width='40' height='28' rx='2' fill='#2f3b47'/><rect x='70' y='100' width='8' height='6' fill='#2f3b47'/>"
b += person(130, 58, '#7d4fb2', skirt=False, arm_r=(176, 88), legs=False)
b += person(240, 52, '#2e7d6b', pants='#3b4652', arm_l=(194, 86))
b += "<rect x='174' y='76' width='22' height='16' fill='#ffffff' stroke='#8a96a1' stroke-width='1.5' transform='rotate(-8 185 84)'/>"
scenes['p1-006'] = svg(b)

# 7. 부두에 밧줄로 묶인 배, 물
b = "<rect y='0' width='320' height='110' fill='#dcebf5'/><rect y='110' width='320' height='90' fill='#7fb3d9'/>"
b += "<rect x='0' y='96' width='120' height='12' fill='#a07b52'/>"
for px in (12, 56, 100):
    b += f"<rect x='{px}' y='96' width='9' height='60' fill='#7b5a39'/>"
b += "<path d='M150 120 h140 l-18 30 h-104z' fill='#f4f4f0' stroke='#56616c' stroke-width='3'/>"
b += "<rect x='196' y='96' width='44' height='24' fill='#e1e6ea' stroke='#56616c' stroke-width='2'/>"
b += "<path d='M104 100 q30 30 52 22' fill='none' stroke='#6b4f2f' stroke-width='3'/>"
for wx in (40, 140, 250):
    b += f"<path d='M{wx} 172 q8 -6 16 0 q8 6 16 0' fill='none' stroke='#5b95c2' stroke-width='2'/>"
scenes['p1-007'] = svg(b, floor=None)

# 8. 손님 없는 식당, 식탁 두 개에 접시·컵·포크가 차려져 있음
b = "<rect x='0' y='0' width='320' height='160' fill='#f3ece2'/>"
for tx in (40, 180):
    b += f"<rect x='{tx}' y='110' width='100' height='8' fill='#ffffff' stroke='#c9bfb2' stroke-width='2'/><rect x='{tx+8}' y='118' width='6' height='42' fill='#8a6a4a'/><rect x='{tx+86}' y='118' width='6' height='42' fill='#8a6a4a'/>"
    b += f"<ellipse cx='{tx+28}' cy='108' rx='14' ry='4' fill='#ffffff' stroke='#9aa5ae' stroke-width='2'/><ellipse cx='{tx+70}' cy='108' rx='14' ry='4' fill='#ffffff' stroke='#9aa5ae' stroke-width='2'/>"
    b += f"<rect x='{tx+45}' y='92' width='8' height='16' fill='#d6ecf7' stroke='#8fb3c9' stroke-width='1.5'/>"
    b += f"<line x1='{tx+10}' y1='104' x2='{tx+10}' y2='110' stroke='#7d8892' stroke-width='2'/><line x1='{tx+88}' y1='104' x2='{tx+88}' y2='110' stroke='#7d8892' stroke-width='2'/>"
    b += chair(tx - 26, 118, '#7a5c43')
b += "<circle cx='160' cy='40' r='16' fill='#f7e7a8' stroke='#c9b45c' stroke-width='2'/><line x1='160' y1='0' x2='160' y2='24' stroke='#9aa5ae' stroke-width='2'/>"
scenes['p1-008'] = svg(b, floor='#cbb79c')

SPK = {'US': {'g': 'm', 'accent': 'US'}, 'GB': {'g': 'f', 'accent': 'GB'}, 'AU': {'g': 'm', 'accent': 'AU'}, 'US-f': {'g': 'f', 'accent': 'US'}}

items = [
 dict(id='p1-001', concept='p1.action', difficulty=1, spk='GB',
      alt='창가 선반 위 화분 세 개에 한 여자가 물뿌리개로 물을 주고 있다. 뒤쪽 창문은 닫혀 있다.',
      choices=['A woman is watering some plants.', 'A woman is planting a tree.', 'Some flowers are being arranged in a vase.', 'A woman is opening a window.'], answer=0,
      why='여자가 물뿌리개를 기울여 화분에 물을 주고 있다. 사람의 동작은 현재진행형으로 묘사하며, watering some plants가 사진과 정확히 일치한다.',
      traps=[None, 'plant(심다)는 plants(식물)와 소리가 같은 유사 발음 함정이다. 나무를 심는 동작은 없다.', '꽃병도, 꽃을 꽂는 동작도 사진에 없다. is being p.p.는 그 동작을 하는 사람이 있어야 한다.', '창문은 사진에 있지만 여자는 창문을 열고 있지 않다. 사진 속 사물을 이용한 함정.'],
      vocab=[{'w': 'water', 'pos': 'v', 'm': '물을 주다'}]),
 dict(id='p1-002', concept='p1.state', difficulty=3, spk='US', tags=['trap'],
      alt='사람이 없는 방. 왼쪽 벽 쪽에 의자 네 개가 겹겹이 쌓여 있고, 오른쪽에 빈 테이블이 있다.',
      choices=['Some chairs are being stacked by a worker.', 'Some chairs have been stacked against a wall.', 'A table is being cleaned.', 'People are sitting around a table.'], answer=1,
      why='의자들이 벽 쪽에 이미 쌓여 있는 상태다. 사물의 완료된 상태는 have been p.p.로 묘사하므로 have been stacked가 정답이다.',
      traps=['is/are being p.p.는 지금 그 동작이 진행 중이라는 뜻이라, 의자를 쌓는 사람이 사진에 있어야 한다. 사람이 없는 사진의 대표 함정.', None, '테이블을 닦는 사람이 없으므로 진행 수동태로 묘사할 수 없다.', '사진에 사람이 없다.'],
      vocab=[{'w': 'stack', 'pos': 'v', 'm': '쌓다'}]),
 dict(id='p1-003', concept='p1.scene', difficulty=2, spk='AU',
      alt='야외 울타리 앞에 자전거 세 대가 나란히 세워져 있다. 사람은 없고 오른쪽에 나무가 있다.',
      choices=['A man is riding a bicycle.', 'A fence is being painted.', 'Some bicycles are parked along a fence.', 'Bicycles are lined up inside a shop.'], answer=2,
      why='자전거 세 대가 울타리를 따라(along a fence) 세워져 있다. 위치 관계를 정확히 말한 parked along a fence가 정답이다.',
      traps=['자전거를 타는 사람이 없다. 사진 속 사물(bicycle)을 넣은 동작 함정.', '울타리를 칠하는 사람이 없으므로 진행 수동태가 성립하지 않는다.', None, '자전거는 가게 안이 아니라 야외에 있다. 장소를 바꾼 함정.'],
      vocab=[{'w': 'along', 'pos': 'prep', 'm': '~을 따라'}]),
 dict(id='p1-004', concept='p1.action', difficulty=2, spk='US-f',
      alt='한 남자가 A자형 사다리 위에 서서 두 손을 천장 조명 쪽으로 뻗고 있다.',
      choices=['A man is carrying a ladder.', 'A man is climbing down some stairs.', 'A man is painting a wall.', 'A man is standing on a ladder.'], answer=3,
      why='남자가 사다리 위에 올라서 있다. standing on a ladder가 남자의 현재 자세를 정확히 묘사한다.',
      traps=['사다리는 있지만 남자가 들고 옮기는 것이 아니라 그 위에 서 있다. 같은 명사, 다른 동작 함정.', '계단(stairs)은 사진에 없다.', '남자는 벽이 아니라 천장 조명 쪽에 손을 뻗고 있고, 붓이나 페인트가 없다.', None],
      vocab=[{'w': 'ladder', 'pos': 'n', 'm': '사다리'}]),
 dict(id='p1-005', concept='p1.state', difficulty=3, spk='GB', tags=['trap'],
      alt='창고 셔터 앞, 손수레 위에 상자 다섯 개가 실려 있다. 사람은 없다.',
      choices=['A worker is pushing a cart.', 'Some boxes have been loaded onto a cart.', 'Some boxes are being unloaded from a truck.', 'Shelves are filled with books.'], answer=1,
      why='상자들이 손수레 위에 이미 실려 있는 상태다. have been loaded onto a cart가 사람 없는 사물 상태를 정확히 묘사한다.',
      traps=['손수레를 미는 작업자가 사진에 없다.', None, '트럭도, 상자를 내리는 사람도 없다. is being p.p. 함정.', '선반이나 책은 사진에 없다.'],
      vocab=[{'w': 'load', 'pos': 'v', 'm': '(짐을) 싣다'}]),
 dict(id='p1-006', concept='p1.action', difficulty=2, spk='AU',
      alt='안내 데스크 뒤에 앉은 여자가 데스크 앞에 선 남자에게 종이 한 장을 건네고 있다. 데스크 위에 모니터가 있다.',
      choices=['A woman is handing a document to a man.', 'They are shaking hands.', 'A man is typing on a keyboard.', 'A woman is putting on her jacket.'], answer=0,
      why='여자가 손을 뻗어 남자에게 종이를 건네고, 남자가 그것을 받고 있다. handing a document to a man이 정답이다.',
      traps=[None, '두 사람의 손은 서류를 사이에 두고 있을 뿐 악수하는 것이 아니다.', '모니터는 있지만 남자는 키보드를 치고 있지 않다. 사진 속 사물로 만든 함정.', '재킷을 입는 동작(putting on)은 없다.'],
      vocab=[{'w': 'hand', 'pos': 'v', 'm': '건네주다'}]),
 dict(id='p1-007', concept='p1.scene', difficulty=3, spk='US',
      alt='물 위에 흰 배 한 척이 떠 있고, 배에서 나온 밧줄이 왼쪽 나무 부두의 기둥에 묶여 있다. 사람은 없다.',
      choices=['Some people are swimming in the water.', 'A boat is being repaired.', 'A bridge crosses over a river.', 'A boat is tied to a pier.'], answer=3,
      why='배에서 나온 밧줄이 부두 기둥에 연결되어 있다. 사물의 상태를 나타내는 is tied to a pier가 정답이다.',
      traps=['물은 있지만 수영하는 사람은 없다.', '배를 수리하는 사람이 없으므로 진행 수동태가 맞지 않는다.', '다리는 사진에 없다. 부두(pier)와 다리(bridge)를 혼동시키는 함정.', None],
      vocab=[{'w': 'pier', 'pos': 'n', 'm': '부두'}, {'w': 'tie', 'pos': 'v', 'm': '묶다'}]),
 dict(id='p1-008', concept='p1.state', difficulty=4, spk='US-f', tags=['trap'],
      alt='손님이 없는 식당. 식탁 두 개에 각각 접시 두 개, 물컵 하나, 포크가 놓여 있고 의자가 있다.',
      choices=['A waiter is pouring water into glasses.', 'Diners are looking at their menus.', 'Some tables have been set for a meal.', 'Some plates are being stacked in a cabinet.'], answer=2,
      why='식탁마다 접시·컵·포크가 이미 차려져 있다. 식사 준비가 끝난 상태이므로 have been set for a meal이 정답이다.',
      traps=['물을 따르는 종업원이 없다.', '손님(diners)도 메뉴판도 없다.', None, '접시는 식탁 위에 놓여 있고, 찬장에 쌓는 사람도 없다. is being p.p. 함정.'],
      vocab=[{'w': 'set a table', 'pos': 'phr', 'm': '상을 차리다'}]),
]

units = []
for it in items:
    u = {'id': it['id'], 'part': 1, 'type': 'photo', 'concept': it['concept'], 'difficulty': it['difficulty'],
         'image': {'svg': scenes[it['id']], 'alt': it['alt']},
         'speakers': {'N': SPK[it['spk']]},
         'choices': it['choices'], 'answer': it['answer'],
         'explanation': {'why': it['why'], 'traps': it['traps']}, 'vocab': it['vocab']}
    if it.get('tags'):
        u['tags'] = it['tags']
    units.append(u)

out = os.path.join(os.path.dirname(__file__), '..', 'toeic', 'data', 'p1.json')
with open(out, 'w', encoding='utf-8') as f:
    json.dump({'units': units}, f, ensure_ascii=False, indent=1)
# 미리보기용 HTML
prev = os.path.join(os.path.dirname(__file__), 'p1-preview.html')
with open(prev, 'w', encoding='utf-8') as f:
    f.write('<html><body style="display:grid;grid-template-columns:repeat(2,330px);gap:8px">' + ''.join(f'<div>{k}<br>{v}</div>' for k, v in scenes.items()) + '</body></html>')
print('ok', len(units))
