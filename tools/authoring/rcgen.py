# RC 문항 작성 도구: 짧은 파이썬 표기 → toeic/data/*.json. JSON이 원본이며 이 스크립트는 작성 기록이다.
# 주의: 작성 후 tools/rebalance.py로 정답 위치를 재배치했다. toeic/data의 JSON이 원본이며, 스크립트를 다시 실행하면 재배치도 다시 해야 한다.
import json, os
BASE = os.path.join(os.path.dirname(__file__), '..', '..', 'toeic', 'data')

def V(*items):
    return [{'w': w, 'pos': p, 'm': m} for (w, p, m) in items]

def p5(id, concept, d, question, choices, answer, why, traps, vocab=(), trap=False):
    assert '-------' in question, id
    assert traps[answer] is None, id
    u = {'id': id, 'part': 5, 'type': 'vocab' if '.voc.' in concept else 'grammar', 'concept': concept, 'difficulty': d,
         'question': question, 'choices': choices, 'answer': answer, 'explanation': {'why': why, 'traps': traps}}
    if vocab: u['vocab'] = V(*vocab)
    if trap: u['tags'] = ['trap']
    return u

def q(type, concept, d, choices, answer, why, traps, question=None, blank=None, sentence=None, para=None, vocab=(), trap=False):
    assert traps[answer] is None, (concept, choices)
    o = {'type': type, 'concept': concept, 'difficulty': d, 'choices': choices, 'answer': answer, 'explanation': {'why': why, 'traps': traps}}
    if question: o['question'] = question
    if blank: o['blank'] = blank
    if sentence: o['sentence'] = sentence
    if para: o['para'] = [{'p': a, 'a': b} for a, b in para]
    if vocab: o['vocab'] = V(*vocab)
    if trap: o['tags'] = ['trap']
    return o

def P(kind, title, text, table=None):
    o = {'kind': kind, 'title': title, 'text': text}
    if table: o['table'] = {'header': table[0], 'rows': table[1:]}
    return o

def setunit(id, part, passages, questions):
    for i, qq in enumerate(questions, 1):
        qq['id'] = f'{id}-{i}'
    return {'id': id, 'part': part, 'passages': passages, 'questions': questions}

def write(name, units):
    with open(os.path.join(BASE, name), 'w', encoding='utf-8') as f:
        json.dump({'units': units}, f, ensure_ascii=False, indent=1)
    print(name, len(units))
