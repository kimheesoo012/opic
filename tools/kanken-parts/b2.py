import os,re,json,collections,xml.etree.ElementTree as ET
D='dl/kvg/kanji'; NS='{http://kanjivg.tagaini.net}'
kd=json.load(open('dl/kd/kanji.json'))
# Korean 훈음
ko=collections.defaultdict(list)
for line in open('dl/lh/data/hanja/hanja.txt',encoding='utf-8'):
    if line.startswith('#'): continue
    p=line.rstrip('\n').split(':')
    if len(p)>=3 and len(p[1])==1 and p[2] and p[2] not in ko[p[1]]:
        ko[p[1]].append(p[2])
def parse(ch):
    f=f'{D}/{ord(ch):05x}.svg'
    if not os.path.exists(f): return None
    root=ET.parse(f).getroot()
    for x in root.iter('{http://www.w3.org/2000/svg}g'):
        if x.get('id')==f'kvg:{ord(ch):05x}': return x
def tree(g):
    out=[]
    for c in g:
        if not c.tag.endswith('g'): continue
        el=c.get(NS+'element')
        if el:
            n={'c':el}
            for a,k in (('position','pos'),('original','orig'),('radical','rad')):
                v=c.get(NS+a)
                if v: n[k]=v
            if c.get(NS+'part'): n['_p']=1
            s=tree(c)
            if s: n['sub']=s
            out.append(n)
        else: out.extend(tree(c))
    # merge split parts
    m=[];seen={}
    for n in out:
        key=n['c']
        if n.pop('_p',None) and key in seen:
            o=seen[key]; o.setdefault('sub',[]); o['sub']+= [x for x in n.get('sub',[]) if x['c'] not in [y['c'] for y in o['sub']]]
            if not o['sub']: o.pop('sub')
            continue
        seen[key]=n; m.append(n)
    return m
chars=[c for c in kd]
# also KanjiVG-only CJK chars used as parts later
T={}
for c in chars:
    g=parse(c)
    if g is not None: T[c]=tree(g)
print('trees',len(T))
json.dump({'T':T,'ko':ko},open('build/stage1.json','w'),ensure_ascii=False)
# components lacking Korean
need=collections.Counter()
def walk(ns):
    for n in ns:
        if not ko.get(n['c']): need[n['c']]+=1
        walk(n.get('sub',[]))
for c in T:
    if kd[c].get('grade'): walk(T[c])
print(len(need)); print(' '.join(f'{k}{v}' for k,v in need.most_common(200)))
