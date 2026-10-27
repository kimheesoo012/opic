# 번역할 한국어 문자열을 키와 함께 뽑는다. 출력: <out>/src-NN.tsv (키\t원문)
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2] / 'toeic'
HANGUL = re.compile(r'[가-힣]')

def items():
    for c in json.load(open(ROOT / 'data/concepts.json'))['concepts']:
        for k in ('name', 'summary', 'tip'):
            if c.get(k): yield f"c|{c['id']}|{k}", c[k]
    idx = json.load(open(ROOT / 'data/index.json'))
    vocab_seen = set()
    for f in idx['files']:
        for u in json.load(open(ROOT / 'data' / f))['units']:
            qs = u.get('questions') or [u]
            for q in qs:
                ex = q['explanation']
                yield f"{q['id']}|why", ex['why']
                for i, t in enumerate(ex['traps']):
                    if t is not None: yield f"{q['id']}|t{i}", t
            for holder in [u] + (u.get('questions') or []):
                for v in holder.get('vocab') or []:
                    key = f"v|{v['w']}|{v['m']}"
                    if key in vocab_seen: continue
                    vocab_seen.add(key)
                    yield key, v['m']

def main(out, size):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    rows = [(k, v) for k, v in items()]
    for k, v in rows:
        assert '\t' not in v and '\n' not in v, k
    other = [r for r in rows if not HANGUL.search(r[1])]
    print('total', len(rows), 'no-hangul', len(other), other[:5])
    # 단어 뜻은 짧으니 한 파일에 모은다
    vrows = [r for r in rows if r[0].startswith('v|')]
    rest = [r for r in rows if not r[0].startswith('v|')]
    chunks = [vrows] + [rest[i:i + size] for i in range(0, len(rest), size)]
    for n, ch in enumerate(chunks):
        (out / f'src-{n:02d}.tsv').write_text(''.join(f'{k}\t{v}\n' for k, v in ch), encoding='utf-8')
    print('chunks', len(chunks), [len(c) for c in chunks], [sum(len(v) for _, v in c) for c in chunks])

main(sys.argv[1], int(sys.argv[2]))
