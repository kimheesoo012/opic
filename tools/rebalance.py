# 정답 위치 고르게 재배치 (작성 후 한 번 실행하는 정리 도구).
# 사용: python3 tools/rebalance.py p5-5.json p6-2.json ...  (인자 없으면 모든 파일)
# 지정한 파일만 바꾸고, 나머지 파일의 정답 위치 분포를 출발점으로 삼는다.
# 순서가 의미 있는 선택지(숫자·시간·가격, 문장 위치 [1]~[4])는 그대로 둔다.
import json, os, re, sys, hashlib
base = os.path.join(os.path.dirname(__file__), '..', 'toeic', 'data')
idx = json.load(open(os.path.join(base, 'index.json')))
targets = sys.argv[1:] or idx['files']
counts = {3: [0, 0, 0], 4: [0, 0, 0, 0]}
def qs(u): return u.get('questions') or [u]
def ordered(q):
    if all(re.fullmatch(r'\[\d\]', c) for c in q['choices']): return True
    if all(re.search(r'\d', c) for c in q['choices']): return True
    return False
for f in idx['files']:
    if f in targets: continue
    for u in json.load(open(os.path.join(base, f)))['units']:
        for q in qs(u): counts[len(q['choices'])][q['answer']] += 1
kept = 0
for f in targets:
    p = os.path.join(base, f)
    d = json.load(open(p))
    for u in d['units']:
        for q in qs(u):
            n = len(q['choices'])
            if ordered(q):
                counts[n][q['answer']] += 1; kept += 1; continue
            c = counts[n]
            m = min(c)
            cands = [i for i in range(n) if c[i] == m]
            t = cands[int(hashlib.md5(q['id'].encode()).hexdigest(), 16) % len(cands)]
            a = q['answer']
            order = [i for i in range(n) if i != a]
            order.insert(t, a)
            q['choices'] = [q['choices'][i] for i in order]
            q['explanation']['traps'] = [q['explanation']['traps'][i] for i in order]
            q['answer'] = t
            c[t] += 1
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('분포', counts, '순서 유지', kept)
