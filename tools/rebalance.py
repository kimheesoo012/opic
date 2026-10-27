# 정답 위치 고르게 재배치 (한 번 실행하는 정리 도구).
# 순서가 의미 있는 선택지(숫자·시간·가격, 문장 위치 [1]~[4])는 그대로 둔다.
import json, os, re, hashlib
base = os.path.join(os.path.dirname(__file__), '..', 'toeic', 'data')
idx = json.load(open(os.path.join(base, 'index.json')))
counts = {3: [0, 0, 0], 4: [0, 0, 0, 0]}
kept = 0
def ordered(q):
    if all(re.fullmatch(r'\[\d\]', c) for c in q['choices']): return True
    if all(re.search(r'\d', c) for c in q['choices']): return True
    return False
for f in idx['files']:
    p = os.path.join(base, f)
    d = json.load(open(p))
    for u in d['units']:
        for q in (u.get('questions') or [u]):
            n = len(q['choices'])
            if ordered(q):
                counts[n][q['answer']] += 1; kept += 1; continue
            c = counts[n]
            m = min(c)
            cands = [i for i in range(n) if c[i] == m]
            h = int(hashlib.md5(q['id'].encode()).hexdigest(), 16)
            t = cands[h % len(cands)]
            a = q['answer']
            order = [i for i in range(n) if i != a]
            order.insert(t, a)  # 새 위치 t에 정답, 나머지는 원래 상대 순서
            q['choices'] = [q['choices'][i] for i in order]
            q['explanation']['traps'] = [q['explanation']['traps'][i] for i in order]
            q['answer'] = t
            c[t] += 1
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('분포', counts, '순서 유지', kept)
