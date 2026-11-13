import json,collections,sys
sys.path.insert(0,'build'); from names import M,O
S=json.load(open('build/stage1.json')); T=S['T']; ko=S['ko']
kd=json.load(open('dl/kd/kanji.json'))
trad={}
for f in ['dl/occ/data/dictionary/JPShinjitaiCharacters.txt','dl/occ/data/dictionary/STCharacters.txt']:
    for l in open(f,encoding='utf-8'):
        if l.startswith('#') or '\t' not in l: continue
        a,b=l.rstrip('\n').split('\t'); vs=[v for v in b.split() if v!=a]
        if vs and a not in trad: trad[a]=vs
def short(lst):
    out=[];snd=set()
    for e in lst:
        toks=e.split()
        if not toks: continue
        sound=toks[-1]
        first=e.split(',')[0].strip()
        if not first.endswith(sound) and len(sound)==1: first=first+' '+sound
        if sound in snd: continue
        snd.add(sound); out.append(first)
        if len(out)==2: break
    return ' / '.join(out)
def kname(c, orig=None, prefer_radical=True):
    if c in O: return O[c]
    if prefer_radical and c in M and M[c]: return M[c]
    if ko.get(c): return short(ko[c])
    for t in trad.get(c,[]):
        if ko.get(t): return short(ko[t])
    if c in M: return M[c]
    if orig and orig!=c: 
        n=kname(orig,None)
        if n: return n+' 변형'
    return ''
POS={'left':'왼쪽','right':'오른쪽','top':'위','bottom':'아래','nyo':'받침','nyoc':'받침 안','tare':'엄','tarec':'엄 안','kamae':'둘레','kamaec':'둘레 안','kamae1':'둘레','kamae2':'둘레'}
joyo=[c for c in T if kd[c].get('grade') and kd[c]['grade']<=8]
def rank(c): d=kd[c]; return (d.get('grade') or 99, d.get('freq') or 9999)
joyo.sort(key=rank)
# contains index (any depth)
def allparts(ns,acc):
    for n in ns:
        acc.add(n['c']); 
        if n.get('orig'): acc.add(n['orig'])
        allparts(n.get('sub',[]),acc)
    return acc
AP={c:allparts(T[c],set()) for c in T}
inside=collections.defaultdict(list)
for c in joyo:
    for p in AP[c]: inside[p].append(c)
# component-first order
order=[];done=set()
def visit(c,stack=()):
    if c in done or c in stack: return
    for n in T.get(c,[]):
        for p in [n['c'],n.get('orig')]:
            if p and p in T and p in set(joyo) and p!=c: visit(p,stack+(c,))
        def deep(ns):
            for m in ns:
                if m['c'] in T and kd.get(m['c'],{}).get('grade',99) and (kd[m['c']].get('grade') or 99)<=8: visit(m['c'],stack+(c,))
                deep(m.get('sub',[]))
        deep(n.get('sub',[]))
    done.add(c); order.append(c)
JS=set(joyo)
for c in joyo: visit(c)
ordi={c:i+1 for i,c in enumerate(order)}
def conv(ns,self_c,depth=0):
    out=[]
    for n in ns:
        o={'c':n['c']}
        nm=kname(n['c'],n.get('orig'))
        if nm: o['ko']=nm
        if n.get('pos') in POS: o['pos']=POS[n['pos']]
        if n.get('rad'): o['rad']=1
        if n.get('orig') and n['orig']!=n['c']: o['orig']=n['orig']
        ins=[x for x in inside.get(n['c'],[]) if x!=self_c]
        if depth<2 and ins: o['in']=ins[:14]; o['inN']=len(ins)
        if n.get('sub') and depth<3: o['sub']=conv(n['sub'],self_c,depth+1)
        out.append(o)
    return out
n=0
with open('build/kanji_parts.jsonl','w',encoding='utf-8') as f:
    for c in T:
        d=kd[c]
        e={'k':c,'ko':kname(c,prefer_radical=False),'parts':conv(T[c],c)}
        ins=[x for x in inside.get(c,[]) if x!=c]
        if ins: e['in']=ins[:20]; e['inN']=len(ins)
        if c in ordi: e['ord']=ordi[c]
        f.write(json.dumps(e,ensure_ascii=False,separators=(',',':'))+'\n'); n+=1
print(n,len(order),len(joyo))
