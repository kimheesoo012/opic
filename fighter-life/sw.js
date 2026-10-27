const C='fls-87cad46f';const A=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('fls-')&&x!==C).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{const q=e.request;if(q.method!=='GET')return;const u=q.url;const mine=u.startsWith(self.registration.scope);const font=u.includes('fonts.googleapis.com')||u.includes('fonts.gstatic.com');if(!mine&&!font)return;
if(q.mode==='navigate'){e.respondWith(fetch(q).then(r=>{const cp=r.clone();if(r.ok)caches.open(C).then(c=>c.put('index.html',cp));return r;}).catch(()=>caches.match('index.html')));return;}
e.respondWith(caches.match(q).then(r=>r||fetch(q).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(q,cp));}return res;})));});