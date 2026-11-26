(() => {
 const C=globalThis.GNRCore;if(!C)return;
 const allowed=u=>{try{let x=new URL(u,location.href);return /(^|\.)gmgn\.ai$/.test(x.hostname)&&/search|trench|pump|rank|token_info|token\/info|mutil_window_token_info|new_creation/i.test(x.pathname)&&!/wallet|trade|order|user|auth|login|private/i.test(x.pathname);}catch{return false;}};
 const emit=(d,ch,source)=>{try{let tokens=C.extract(d,ch);if(tokens.length)window.postMessage({gnr:1,tokens:tokens.slice(0,1000),source},location.origin);}catch{}};
 function chainOf(url){try{let u=new URL(url,location.href);return C.chain(u.searchParams.get('chain')||u.pathname.split('/').find(s=>C.chain(s)))||C.current();}catch{return C.current();}}
 function inspect(url,data){if(allowed(url))emit(data,chainOf(url),/search/i.test(url)?'search':'market');}
 const f=window.fetch;window.fetch=function(...args){const p=f.apply(this,args);let u=args[0]?.url||args[0];if(typeof u==='string'&&allowed(u))p.then(r=>{if(r.ok&&/json/i.test(r.headers.get('content-type')||''))r.clone().json().then(d=>inspect(u,d)).catch(()=>{});}).catch(()=>{});return p;};
 const op=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;let urls=new WeakMap();XMLHttpRequest.prototype.open=function(m,u,...a){urls.set(this,String(u));return op.call(this,m,u,...a);};XMLHttpRequest.prototype.send=function(...a){let u=urls.get(this);if(allowed(u))this.addEventListener('load',()=>{try{if(this.status>=200&&this.status<300)inspect(u,this.responseType==='json'?this.response:JSON.parse(this.responseText));}catch{}},{once:true});return send.apply(this,a);};
 // Read only the props belonging to a visible token card, not arbitrary application state.
 document.addEventListener('gnr-read-card',()=>{for(let el of document.querySelectorAll('[data-gnr-read="1"]')){el.removeAttribute('data-gnr-read');let addr=el.getAttribute('data-gnr-address');if(!C.address(addr))continue;let found=[];for(let node of [el,...Array.from(el.querySelectorAll('a,span,div')).slice(0,35)]){let key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));if(!key)continue;let props=node[key];if(!props)continue;for(let v of [props.token,props.item,props.data,props.tokenInfo,props.children?.props?.token,props.children?.props?.data,props.children?.props?.item]){if(v&&typeof v==='object')found.push(...C.extract(v,C.current()).filter(x=>x.address===addr));}}if(found.length)window.postMessage({gnr:1,tokens:found,source:'props'},location.origin);}});

 // 按需搜索：只响应本扩展 content script 的请求，请求 GMGN 自己的网页搜索接口（同源、同一会话），带上 GMGN 页面自己的公共查询参数。
 let qp='';const f0=window.fetch;
 const keepQp=u=>{try{let x=new URL(u,location.href);if(/(^|\.)gmgn\.ai$/.test(x.hostname)&&x.searchParams.get('device_id')){let p=new URLSearchParams();for(let k of ['device_id','fp_did','client_id','from_app','app_ver','tz_name','tz_offset','app_lang','os'])if(x.searchParams.has(k))p.set(k,x.searchParams.get(k));qp=p.toString();}}catch{}};
 const pick=c=>({address:c.address,chain:c.chain,holder_count:c.holder_count,is_show_alert:c.is_show_alert,is_honeypot:c.is_honeypot,renounced_freeze_account:c.renounced_freeze_account,volume_1h:c.volume_1h,liquidity:c.liquidity});
 window.fetch=function(...a){let u=a[0]?.url||a[0];if(typeof u==='string')keepQp(u);let p=f0.apply(this,a);
  // GMGN 自己的搜索结果（用户正在搜的词）顺手缓存，省掉一次请求
  if(typeof u==='string'&&u.includes('/vas/api/v1/search_v4')){let body;try{body=JSON.parse(a[1]?.body||'{}');}catch{}if(body?.q&&body.chain_filters&&Object.keys(body.chain_filters).length===1){let chain=Object.keys(body.chain_filters)[0];p.then(r=>r.clone().json()).then(j=>{if(j?.code===0)window.postMessage({gnr:4,q:body.q,chain,coins:(j.data?.coins||[]).filter(c=>c.chain===chain).map(pick)},location.origin);}).catch(()=>{});}}
  return p;};
 window.addEventListener('message',async e=>{if(e.source!==window||e.origin!==location.origin||e.data?.gnr!==2||e.data.op!=='search')return;let {id,q,chain}=e.data;if(typeof q!=='string'||!q.trim()||q.length>60||!/^[a-z]+$/.test(chain||''))return;
  try{let r=await f0.call(window,'/vas/api/v1/search_v4'+(qp?'?'+qp:''),{method:'POST',headers:{'content-type':'application/json'},credentials:'include',body:JSON.stringify({q:q.trim(),chain_filters:{[chain]:{}},wallet_chains:[chain]})});let j=await r.json();
   let coins=(j?.data?.coins||[]).filter(c=>c.chain===chain).map(pick);
   window.postMessage({gnr:3,id,ok:r.ok&&j?.code===0,coins},location.origin);}catch(err){window.postMessage({gnr:3,id,ok:false},location.origin);}});
})();
