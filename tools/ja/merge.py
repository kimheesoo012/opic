# ja-NN.tsv 번역을 검사하고 toeic-ja/data/*.json을 만든다.
# 사용: python3 tools/ja/merge.py [tsv 폴더, 기본 tools/ja/tsv] [--check-only]
import json, re, sys
from pathlib import Path
REPO = Path(__file__).resolve().parents[2]
SRC, DST = REPO / 'toeic', REPO / 'toeic-ja'
HANGUL = re.compile(r'[가-힣]')
LATIN = re.compile(r"[A-Za-z][A-Za-z'’-]+|\d+")

def load(p):
    rows = []
    for n, line in enumerate(p.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip(): continue
        k, _, v = line.partition('\t')
        if not v: sys.exit(f'{p.name}:{n} 탭 없음')
        rows.append((k, v))
    return rows

def main(folder, check_only):
    folder = Path(folder)
    tr, problems, missing = {}, [], []
    for src in sorted(folder.glob('src-*.tsv')):
        ja = folder / src.name.replace('src-', 'ja-')
        s = load(src)
        if not ja.exists(): missing.append(ja.name); continue
        j = load(ja)
        if [k for k, _ in s] != [k for k, _ in j]:
            sk, jk = [k for k, _ in s], [k for k, _ in j]
            diff = next((i for i, (a, b) in enumerate(zip(sk, jk)) if a != b), min(len(sk), len(jk)))
            sys.exit(f'{ja.name}: 키 불일치 {diff}번째 src={sk[diff] if diff < len(sk) else None} ja={jk[diff] if diff < len(jk) else None} ({len(sk)} vs {len(jk)})')
        for (k, ko), (_, v) in zip(s, j):
            if HANGUL.search(v): problems.append(f'{k}: 한글 남음')
            lost = [w for w in set(x.strip("'’-") for x in LATIN.findall(ko)) if w not in v and w != 'vs']
            if lost: problems.append(f'{k}: 영문·숫자 누락 {lost}')
            tr[k] = v
    for p in problems: print(p)
    print(f'번역 {len(tr)}개, 문제 {len(problems)}개, 남은 파일 {missing}')
    if problems or missing or check_only: sys.exit(1 if problems else 0)

    def t(k):
        if k not in tr: sys.exit(f'번역 없음: {k}')
        return tr[k]
    cj = json.load(open(SRC / 'data/concepts.json'))
    for c in cj['concepts']:
        for k in ('name', 'summary', 'tip'):
            if c.get(k) and f"c|{c['id']}|{k}" in tr: c[k] = tr[f"c|{c['id']}|{k}"]
    (DST / 'data/concepts.json').write_text(json.dumps(cj, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    idx = json.load(open(SRC / 'data/index.json'))
    for f in idx['files']:
        d = json.load(open(SRC / 'data' / f))
        for u in d['units']:
            for q in u.get('questions') or [u]:
                if q.get('trans'): q['trans'] = t(f"{q['id']}|trans")
                ex = q['explanation']
                ex['why'] = t(f"{q['id']}|why")
                ex['traps'] = [None if x is None else t(f"{q['id']}|t{i}") for i, x in enumerate(ex['traps'])]
            for holder in [u] + (u.get('questions') or []):
                for v in holder.get('vocab') or []:
                    v['m'] = t(f"v|{v['w']}|{v['m']}")
        (DST / 'data' / f).write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    left = [p.name for p in (DST / 'data').glob('*.json') if HANGUL.search(p.read_text(encoding='utf-8'))]
    print('한글 남은 데이터 파일:', left or '없음')
    sys.exit(1 if left else 0)

args = [a for a in sys.argv[1:] if not a.startswith('--')]
main(args[0] if args else Path(__file__).parent / 'tsv', '--check-only' in sys.argv)
