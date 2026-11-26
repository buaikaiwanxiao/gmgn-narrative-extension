importScripts('core.js');
const C=GNRCore;

const fourMem=new Map();let fourLast=0,fourChain=Promise.resolve(),fourLoaded=null;
const fourClean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g,' ').trim().slice(0,n):'';
const fourLink=v=>{let s=fourClean(v,300);return /^https?:\/\//i.test(s)?s:'';};
async function fourStore(){if(!fourLoaded)fourLoaded=chrome.storage.local.get('gnrFour').then(x=>{for(let [k,v] of Object.entries(x.gnrFour||{}))fourMem.set(k,v);});await fourLoaded;}
function fourFresh(v){return v&&Date.now()-v.at<(v.r?.ok?86400000:600000);}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.type!=='gnr-four'||!/^https:\/\/(www\.)?gmgn\.ai\//.test(sender.url||''))return false;
 let addr=C.address(msg.addr);if(!addr||!addr.startsWith('0x')){reply({ok:false,reason:'invalid'});return false;}
 (async()=>{await fourStore();let v=fourMem.get(addr);if(fourFresh(v)){reply(v.r);return;}
  fourChain=fourChain.catch(()=>{}).then(async()=>{let v2=fourMem.get(addr);if(fourFresh(v2))return v2.r;
   await new Promise(r=>setTimeout(r,Math.max(0,1000-(Date.now()-fourLast))));fourLast=Date.now();let r;
   try{let res=await fetch('https://four.meme/meme-api/v1/private/token/get?address='+addr,{credentials:'omit',headers:{'Accept':'application/json'},signal:AbortSignal.timeout(8000)});
    if(!res.ok)throw Error('HTTP '+res.status);let j=await res.json();let d=j?.data;
    if(Number(j?.code)!==0||!d||String(d.address||'').toLowerCase()!==addr)r={ok:false,reason:'not four.meme'};
    else r={ok:true,descr:fourClean(d.descr,600),twitter:fourLink(d.twitterUrl),website:fourLink(d.webUrl),telegram:fourLink(d.telegramUrl),name:fourClean(d.name,120),ticker:fourClean(d.shortName,40),quote:fourClean(d.symbol,20)};
   }catch(e){r={ok:false,reason:String(e.message).slice(0,80)};}
   fourMem.set(addr,{at:Date.now(),r});if(fourMem.size>1500)fourMem.delete(fourMem.keys().next().value);
   chrome.storage.local.set({gnrFour:Object.fromEntries([...fourMem].filter(([k,v])=>v.r?.ok).slice(-1000))}).catch(()=>{});return r;});
  reply(await fourChain);})();
 return true;});

// 叙事索引服务：默认公网 HTTPS（需访问密钥），也兼容本地隧道 http://127.0.0.1:18777
const GNR_DEFAULT_INDEX='';// 公开版不内置地址，首次安装时在设置页填写
// 预配置版：扩展包里可带 defaults.json（{"indexUrl":"…","indexKey":"…"}），没设置时用它；公开版没有这个文件
let GNR_DEF={};const gnrDefReady=fetch(chrome.runtime.getURL('defaults.json')).then(r=>r.ok?r.json():{}).then(j=>{GNR_DEF=j&&typeof j==='object'?j:{};}).catch(()=>{});
const idxUrlOf=p=>(p&&typeof p.indexUrl==='string')?p.indexUrl.trim():(GNR_DEF.indexUrl||GNR_DEFAULT_INDEX);
function idxBase(cfg){let b=idxUrlOf(cfg.gnrPrefs).replace(/\/+$/,'');if(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(b)||/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(b))return b;return '';}
function idxHeaders(cfg,json){let h={'Accept':'application/json'};if(json)h['content-type']='application/json';let k=cfg.gnrIndexKey||GNR_DEF.indexKey;if(k)h['x-narr-key']=k;return h;}
const idxErr=st=>st===401?'访问密钥缺失或无效':st===429?'请求太快（按密钥限频）':st===501?'该链暂未开放':'HTTP '+st;
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.type!=='gnr-ping'||sender.id!==chrome.runtime.id||/^https?:/.test(sender.url||''))return false;
 (async()=>{await gnrDefReady;let cfg=await chrome.storage.local.get(['gnrPrefs','gnrIndexKey']);let base=idxBase(cfg);if(!base){reply({ok:false,reason:'服务地址无效（只允许 https:// 或 http://127.0.0.1/localhost）'});return;}
  try{let local=base.startsWith('http://');let res=await fetch(base+(local?'/health':'/me'),{headers:idxHeaders(cfg),credentials:'omit',signal:AbortSignal.timeout(10000)});
   if(!res.ok){reply({ok:false,reason:idxErr(res.status)});return;}let j=await res.json();reply({ok:true,base,local,name:j.name,rps:j.rps,chains:j.chains});}catch(e){reply({ok:false,reason:'连不上：'+String(e.message).slice(0,80)});}})();
 return true;});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.type!=='gnr-batch'||!/^https:\/\/(www\.)?gmgn\.ai\//.test(sender.url||''))return false;
 (async()=>{await gnrDefReady;let cfg=await chrome.storage.local.get(['gnrPrefs','gnrIndexKey']);let base=idxBase(cfg);
  if(!base){reply({ok:false,reason:'off'});return;}let chain=msg.chain==='sol'?'sol':'bsc';
  let addrs=[...new Set((msg.addrs||[]).map(C.address).filter(a=>a&&(chain==='sol'?!a.startsWith('0x'):a.startsWith('0x'))))].slice(0,100);if(!addrs.length){reply({ok:true,items:{}});return;}
  try{let res=await fetch(base+'/batch',{method:'POST',headers:idxHeaders(cfg,true),body:JSON.stringify({chain,addrs}),credentials:'omit',signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error(idxErr(res.status));
   let j=await res.json();reply({ok:!!j.ok,items:j.items||{},coverage:j.coverage});}catch(e){reply({ok:false,reason:e?.name==='TypeError'||e?.name==='TimeoutError'?'连不上服务地址（隧道地址可能变了：VPS 上运行 ./ctl.sh url 查新地址，填进插件设置的服务地址）':String(e.message).slice(0,100)});}})();
 return true;});
const idxCache=new Map();
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.type!=='gnr-index'||!/^https:\/\/(www\.)?gmgn\.ai\//.test(sender.url||''))return false;
 (async()=>{await gnrDefReady;let cfg=await chrome.storage.local.get(['gnrPrefs','gnrIndexKey']);let base=idxBase(cfg);
  if(!base){reply({ok:false,reason:'off'});return;}
  let addr=C.address(msg.addr);if(!addr||C.chain(msg.chain)!=='bsc'){reply({ok:false,reason:'invalid'});return;}
  let old=idxCache.get(addr);if(old&&Date.now()-old.at<(old.r?.target?.label==='?'?60000:600000)){reply(old.r);return;}
  try{let u=new URL(base+'/search');u.searchParams.set('addr',addr);u.searchParams.set('limit','3');u.searchParams.set('chain','bsc');for(let q of (msg.q||[]).map(C.str).filter(Boolean).slice(0,4))u.searchParams.append('q',q);
   let res=await fetch(u,{headers:idxHeaders(cfg),credentials:'omit',signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error(idxErr(res.status));
   let j=await res.json();let r={ok:!!j.ok,target:j.target,coverage:j.coverage,first:j.first,exact_count:j.exact_count,pre:j.pre_coverage_count,fuzzy_count:j.fuzzy_count};
   idxCache.set(addr,{at:Date.now(),r});if(idxCache.size>3000)idxCache.delete(idxCache.keys().next().value);reply(r);
  }catch(e){reply({ok:false,reason:String(e.message).slice(0,100)});}})();
 return true;});
let queue=Promise.resolve(),last=0,paused=0;const cache=new Map();
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.type==='gnr-defaults'&&sender.id===chrome.runtime.id){gnrDefReady.then(()=>reply({indexUrl:GNR_DEF.indexUrl||GNR_DEFAULT_INDEX,hasKey:!!GNR_DEF.indexKey}));return true;}
 if(msg?.type==='gnr-config'){gnrDefReady.then(()=>chrome.storage.local.get(['gnrPrefs','gnrApiKey'])).then(x=>reply({prefs:{...(x.gnrPrefs||{}),indexUrl:idxUrlOf(x.gnrPrefs)},api:!!x.gnrApiKey}));return true;}
 if(msg?.type!=='gnr-lookup'||!/^https:\/\/(www\.)?gmgn\.ai\//.test(sender.url||''))return false;
 let chain=C.chain(msg.chain),q=C.str(msg.q);if(!chain||!q||q.length>100){reply({ok:false,reason:'invalid'});return false;}
 let key=chain+':'+C.norm(q);let now=Date.now();let old=cache.get(key);if(old&&now-old.at<15*60000){reply(old.result);return false;}
 queue=queue.catch(()=>{}).then(async()=>{let cfg=await chrome.storage.local.get(['gnrApiKey','gnrPrefs']);if(!cfg.gnrApiKey||!cfg.gnrPrefs?.auto){reply({ok:false,reason:'off'});return;}if(Date.now()<paused){reply({ok:false,reason:'rate'});return;}let saved=cache.get(key);if(saved&&Date.now()-saved.at<15*60000){reply(saved.result);return;}await new Promise(r=>setTimeout(r,Math.max(0,12000-(Date.now()-last))));last=Date.now();try{let u=new URL('https://openapi.gmgn.ai/v1/market/search');u.searchParams.set('q',q);u.searchParams.set('chain',chain);let res=await fetch(u,{headers:{'X-APIKEY':cfg.gnrApiKey,'Accept':'application/json'},credentials:'omit',signal:AbortSignal.timeout(12000)});if(res.status===429){paused=Date.now()+Math.max(60000,(Number(res.headers.get('Retry-After'))||300)*1000);throw Error('rate');}if(!res.ok)throw Error('HTTP '+res.status);let body=await res.json();if(body.code!==undefined&&Number(body.code)!==0)throw Error('API '+body.code);let tokens=C.extract(body.data??body,chain).filter(t=>t.chain===chain);let result={ok:true,tokens};cache.set(key,{at:Date.now(),result});if(cache.size>500)cache.delete(cache.keys().next().value);reply(result);}catch(e){reply({ok:false,reason:String(e.message).slice(0,100)});}});return true;
});

// 首次安装：没配置服务地址/密钥（也没有内置 defaults.json）时，自动打开设置页引导填写。升级/重新加载不会触发，也不会清掉已填设置（都存在 chrome.storage.local）。
chrome.runtime.onInstalled.addListener(async d=>{if(d.reason!=='install')return;await gnrDefReady;let s=await chrome.storage.local.get(['gnrPrefs','gnrIndexKey']);
 let configured=(typeof s.gnrPrefs?.indexUrl==='string'&&s.gnrPrefs.indexUrl)||GNR_DEF.indexUrl;if(!configured||!(s.gnrIndexKey||GNR_DEF.indexKey))chrome.runtime.openOptionsPage();});
