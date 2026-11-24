(()=>{
'use strict';
const CFG=window.OUTSIDE_CONFIG||{};
const $=s=>document.querySelector(s);
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-NG');
const naira=n=>'₦'+fmt(n);
const pad=n=>String(n).padStart(2,'0');
const BASE=location.origin+location.pathname;
const CITIES=['Abuja','Lagos'];
const KINDS={eat:'Brunch & dinner',read:'Read together',move:'Move together',work:'Work together',explore:'Explore somewhere new',party:'Music & nights out'};
const WANTS=['Go to a December concert','Kayak or boat ride','Try a new brunch spot','Sunday reading at a café','Start running','Paint and sip','Coworking day','Visit an art gallery','Board games night','Beach day','Christmas service or carols',"New Year's Eve countdown"];
const AGES=['18–24','25–34','35–44','45+'];
const RINGS={circles:'your circles',met:"people you've met",everyone:'everyone verified in the city',invite:'people you invited'};
const RULES=['Meet only at the public place in the plan. No moving the group to a private home or hotel.','Show up, or cancel early. Two no-shows pause your account until the host reviews it.','Be who your profile says you are. Fake profiles are removed.','No dating pressure, selling, or recruiting. This is for friendship.','Look out for each other, and report anything that feels off.'];
const PCOLS='id,name,city,age_band,is_woman,wants,invited_by,ref_note,verified,suspended,strike_reset,pass_until,created_at';

const S={session:null,uid:null,admin:false,loaded:false,recovery:false,authMode:'up',city:'Abuja',
  askFb:{},profiles:{},events:{},rsvps:{},feedback:{},asks:{},circles:{},haps:{},notes:[],people:{},privates:{},reports:{},settings:{first_fee:500},invites:null,
  draft:null,editing:null,hapDraft:null,hapEditing:null,askDraft:null,meDraft:null,reportOpen:null,pick:new Set(),filter:'all',dirty:false,busy:false};
try{const c=localStorage.getItem('out-city');if(CITIES.includes(c))S.city=c}catch(x){}
try{const i=new URLSearchParams(location.search).get('i');if(i)localStorage.setItem('out-invite',i)}catch(x){}
let sb=null,installEvt=null;

/* ---------- helpers ---------- */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),3200)}
function note(m){const n=$('#note');n.hidden=!m;n.textContent=m||''}
const errMsg=r=>r&&r.error?(r.error.message||'Something went wrong.'):'';
async function run(p,ok){if(S.busy)return null;S.busy=true;try{const r=await p;const m=errMsg(r);if(m){toast(m);return null}if(ok)toast(ok);await loadAll();return r||{}}catch(x){toast(x.message||"Couldn't reach the server. Check your connection.");return null}finally{S.busy=false}}
const dt=s=>new Date(s);
const fmtDay=s=>dt(s).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
const fmtTime=s=>dt(s).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const toInput=s=>{if(!s)return'';const d=dt(s);return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
const fromInput=v=>v?new Date(v).toISOString():null;
const today=()=>{const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const isPast=ev=>Date.now()>dt(ev.starts_at).getTime()+3*3600e3;
const isLive=ev=>{const t=dt(ev.starts_at).getTime(),n=Date.now();return n>t-3*3600e3&&n<t+10*3600e3};
const askPast=a=>Date.now()>dt(a.when_at).getTime()+2*3600e3;
const list=k=>Object.values(S[k]);
const me=()=>S.uid?S.profiles[S.uid]:null;
const pname=id=>(S.profiles[id]&&S.profiles[id].name)||'Someone';
const rsvpsOf=eid=>list('rsvps').filter(r=>r.event_id===eid&&r.status!=='cancelled');
const active=eid=>rsvpsOf(eid).filter(r=>r.status!=='waitlist');
const myR=eid=>list('rsvps').find(r=>r.event_id===eid&&r.user_id===S.uid);
const events=()=>list('events').sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at)));
const av=id=>`<span class="av" aria-hidden="true">${e(pname(id).slice(0,1).toUpperCase())}</span>`;
const noShows=id=>list('rsvps').filter(r=>r.user_id===id&&r.paid&&!r.checked_in_at&&r.status!=='cancelled'&&S.events[r.event_id]&&isPast(S.events[r.event_id])).length;
const strikes=id=>Math.max(0,noShows(id)-((S.profiles[id]||{}).strike_reset||0));
const payBtn=()=>/^https:\/\//.test(S.settings.pay_info||'')?`<a class="btn" href="${e(S.settings.pay_info)}" target="_blank" rel="noopener">Pay now</a>`:'';
const payText=()=>S.settings.pay_info&&!/^https:\/\//.test(S.settings.pay_info)?e(S.settings.pay_info):'';
function gate(needVerified){const p=me();
  if(!p)return'Set up your profile first. <a href="#me">Go to Me</a>';
  if(p.suspended)return'Your account is paused. Message the host on WhatsApp.';
  if(needVerified&&!p.verified)return'This opens once the host has verified you on a quick WhatsApp video call.';
  return''}
function groupsFor(eid){
  const fb=list('feedback').filter(f=>f.event_id===eid),by={};fb.forEach(f=>by[f.user_id]=f);
  const par={},f=x=>par[x]===x?x:(par[x]=f(par[x]));
  fb.forEach(a=>(a.meet_again||[]).forEach(b=>{if(a.user_id<b&&by[b]&&(by[b].meet_again||[]).includes(a.user_id)){par[a.user_id]=par[a.user_id]||a.user_id;par[b]=par[b]||b;par[f(a.user_id)]=f(b)}}));
  const g={};Object.keys(par).forEach(x=>{const r=f(x);(g[r]=g[r]||[]).push(x)});return Object.values(g).map(x=>x.sort())}

/* ---------- data ---------- */
async function loadAll(){
  if(!sb)return;
  if(!S.uid){const r=await sb.from('out_happenings').select('*');S.haps=Object.fromEntries((r.data||[]).map(x=>[x.id,x]));S.loaded=true;render();return}
  const since=new Date(Date.now()-60*864e5).toISOString();
  const [pr,ev,rs,ak,ci,hp,nt,fb,pp,st,pv,ad,iv,afb]=await Promise.all([
    sb.from('out_profiles').select(PCOLS),sb.from('out_events').select('*').order('starts_at'),sb.from('out_rsvps').select('*'),
    sb.from('out_asks').select('*').gte('when_at',since),sb.from('out_circles').select('*'),sb.from('out_happenings').select('*'),
    sb.from('out_notes').select('*').order('created_at',{ascending:false}).limit(40),sb.from('out_feedback').select('*'),
    sb.rpc('out_my_people'),sb.from('out_settings').select('*').eq('id',1).maybeSingle(),sb.from('out_private').select('*'),
    sb.from('out_admins').select('user_id'),sb.rpc('out_my_invites'),sb.from('out_ask_fb').select('*')]);
  const first=[pr,ev,rs].find(r=>r.error);if(first){note(first.error.message.includes('does not exist')?"Outside's database tables aren't set up yet. Run supabase/schema.sql in Supabase (see SETUP.md).":"Couldn't load everything: "+first.error.message)}else note('');
  const map=(r,k='id')=>Object.fromEntries((r.data||[]).map(x=>[x[k],x]));
  S.profiles=map(pr);S.events=map(ev);S.rsvps=map(rs);S.asks=map(ak);S.circles=map(ci);S.haps=map(hp);S.notes=nt.data||[];
  S.feedback=map(fb,'rsvp_id');S.people=Object.fromEntries((pp.data||[]).map(x=>[x.person,x]));S.settings=st.data||S.settings;
  S.privates=map(pv);S.admin=!!(ad.data||[]).length;S.invites=(iv.data||[])[0]||null;S.askFb=Object.fromEntries((afb.data||[]).map(x=>[x.ask_id,x]));
  if(S.admin){const r=await sb.from('out_reports').select('*').order('created_at',{ascending:false});S.reports=map(r)}
  if(!S.loaded&&me()&&!localStorage.getItem('out-city'))S.city=me().city;
  S.loaded=true;render();
}

/* ---------- render ---------- */
const ICON={
 pin:'<svg class="i" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
 clock:'<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 wallet:'<svg class="i" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/></svg>',
 shield:'<svg class="i" viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.8 3.2 8 7.5 9.5 4.3-1.5 7.5-4.7 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>',
 chat:'<svg class="i" viewBox="0 0 24 24"><path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.3-4.4a8 8 0 1 1 15.2-4.1z"/></svg>',
 loop:'<svg class="i" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.5-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/></svg>'};
const GLYPH={
 eat:'<path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2.5M11 3v2.5M14 3v2.5"/>',
 read:'<path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v13c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6.5v13"/>',
 move:'<path d="M3 16c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2M3 10.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2"/>',
 work:'<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
 explore:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
 party:'<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'};
const KCOL={eat:'#f0532e',read:'#2f5bea',move:'#0b9aa8',work:'#3b3a40',explore:'#e79a00',party:'#d9245a'};
const AVC=['#f0532e','#2f5bea','#0b9aa8','#e79a00','#d9245a','#6b4ce6','#1f8a5b','#c2410c'];
const avc=id=>{let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return AVC[h%AVC.length]};
const avatar=(id,cls='')=>`<span class="av ${cls}" style="background:${avc(id)}" aria-hidden="true">${e(pname(id).slice(0,1).toUpperCase())}</span>`;
const avStack=ids=>`<span class="avs">${ids.slice(0,5).map(x=>avatar(x)).join('')}</span>`;
const typing=()=>{const a=document.activeElement;return a&&$('#app').contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)};
const VIEWS=['plans','down','around','people','me','host','notes'];
function view(){const h=location.hash.slice(1);if(h.startsWith('ask-'))return'down';if(h==='host'&&!S.admin)return'me';return VIEWS.includes(h)?h:'plans'}
function render(force){
  if(!force&&typing()){S.dirty=true;return}S.dirty=false;
  const signed=!!S.uid&&!!me();$('#nav').hidden=!signed;$('#bell').hidden=!signed;$('#city').value=S.city;
  const unread=S.notes.filter(n=>!n.read).length;const bell=$('#bell');const dot=bell.querySelector('.dot');if(dot)dot.remove();if(unread)bell.insertAdjacentHTML('beforeend',`<span class="dot">${unread>9?'9+':unread}</span>`);
  const v=view();document.querySelectorAll('#nav a').forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')==='#'+v||(v==='host'&&a.getAttribute('href')==='#me')||(v==='notes'&&false)?'page':'false'));
  const app=$('#app');app.classList.toggle('wide',v==='host');
  if(!CFG.supabaseUrl){app.innerHTML='<div class="empty"><h3>Almost there</h3><p>Add your Supabase details to config.js (see SETUP.md).</p></div>';return}
  if(!S.loaded){app.innerHTML='<p class="mute" style="padding:40px 0;text-align:center">Loading…</p>';return}
  if(S.recovery){app.innerHTML=vRecovery();return}
  if(!S.uid){app.innerHTML=vLanding();return}
  if(!me()){app.innerHTML=vOnboard();return}
  app.innerHTML=({plans:vPlans,down:vDown,around:vAround,people:vPeople,me:vMe,host:vHost,notes:vNotes})[v]();
}

/* ---------- landing & auth ---------- */
function vLanding(){
  const up=S.authMode==='up',hs=list('haps').filter(h=>h.city===S.city&&(h.end_date||h.start_date)>=today()).length;
  return`<section class="hero"><h1>Your friends can't make it? Go anyway.</h1><p>Find people in ${e(S.city)} who are down for the same thing, this week.</p></section>
  <form id="authForm" class="form card">
   <label class="fld">Email<input type="email" name="email" required autocomplete="email" placeholder="you@email.com"></label>
   <label class="fld">Password<input type="password" name="pw" required minlength="8" autocomplete="${up?'new-password':'current-password'}" placeholder="At least 8 characters"></label>
   <button class="btn block">${up?'Create account':'Log in'}</button>
   <div class="row" style="justify-content:space-between"><button type="button" class="link" data-act="authMode">${up?'I have an account':'New here? Sign up'}</button>${up?'':'<button type="button" class="link" data-act="forgot">Forgot password?</button>'}</div>
  </form>
  <div class="feat"><div>${ICON.chat}<p style="margin:0"><b>Post what you want to do</b><span>Brunch, a concert, a run, a reading hour.</span></p></div>
   <div>${ICON.shield}<p style="margin:0"><b>Everyone's verified</b><span>Every member is checked on a quick video call. You always meet at a public place.</span></p></div>
   <div>${ICON.loop}<p style="margin:0"><b>Keep the good ones</b><span>Clicked with someone? Make it a circle and go again.</span></p></div></div>
  ${hs?`<p class="tiny" style="text-align:center">${hs} things happening in ${e(S.city)} this month</p>`:''}
  <p class="tiny" style="text-align:center">18+ only · <a href="privacy.html">Privacy & rules</a></p>`;
}
function vRecovery(){return`<h1 class="title">New password</h1><form id="newPw" class="form card"><label class="fld">Password<input type="password" name="pw" required minlength="8" autocomplete="new-password"></label><button class="btn block">Save</button></form>`}
function vOnboard(){return`<h1 class="title">Let's set you up</h1><p class="sub">Takes a minute. We'll WhatsApp you for a quick video check.</p>${profileForm(null)}`}
function profileForm(base){
  const pv=S.privates[S.uid]||{},p=S.meDraft||{...(base||{}),phone:pv.phone,tc_name:pv.tc_name,tc_phone:pv.tc_phone};
  return`<form id="meForm" class="form">
  <label class="fld">First name<input name="name" required maxlength="40" value="${e(p.name)}" autocomplete="given-name"></label>
  <div class="two"><label class="fld">City<select name="city" required>${CITIES.map(x=>`<option ${(p.city||S.city)===x?'selected':''}>${x}</option>`).join('')}</select></label>
  <label class="fld">Age<select name="age_band" required><option value="">Choose</option>${AGES.map(a=>`<option ${p.age_band===a?'selected':''}>${a}</option>`).join('')}</select></label></div>
  <label class="fld">WhatsApp number<input name="phone" required inputmode="tel" minlength="5" maxlength="20" value="${e(p.phone)}" placeholder="0803 000 0000"></label>
  <label class="chk"><input type="checkbox" name="is_woman" ${p.is_woman?'checked':''}> I'm a woman (for women-only plans)</label>
  <div class="two"><label class="fld">Emergency contact<input name="tc_name" required maxlength="40" value="${e(p.tc_name)}" placeholder="Name"></label>
  <label class="fld">Their number<input name="tc_phone" required inputmode="tel" maxlength="20" value="${e(p.tc_phone)}" placeholder="0803 000 0000"></label></div>
  ${base?'':`<label class="fld">Who told you about Outside? (optional)<input name="ref_note" maxlength="60" value="${e(p.ref_note)}"></label>`}
  ${base?'':`<label class="chk"><input type="checkbox" name="adult" required> I'm 18+ and agree to the <a href="privacy.html">rules</a></label>`}
  <button class="btn block">${base?'Save':'Continue'}</button>
  <p class="tiny">Only the host sees your numbers. People you go out with can see your WhatsApp.</p></form>`;
}

/* ---------- plans (home) ---------- */
function feed(){
  const ids=new Set(Object.keys(S.people));list('circles').forEach(c=>c.members.forEach(m=>{if(m!==S.uid)ids.add(m)}));
  const lines=[];
  list('rsvps').forEach(r=>{const ev=S.events[r.event_id];if(ids.has(r.user_id)&&ev&&!isPast(ev)&&r.status!=='cancelled'&&ev.city===S.city)lines.push({t:ev.starts_at,id:r.user_id,h:`<b>${e(pname(r.user_id))}</b> is going to ${e(ev.title)}`,go:'#plans'})});
  list('asks').forEach(a=>{if(a.by_user!==S.uid&&ids.has(a.by_user)&&!askPast(a)&&a.status==='open')lines.push({t:a.when_at,id:a.by_user,h:`<b>${e(pname(a.by_user))}</b> wants company: ${e(a.what)}`,go:'#ask-'+a.id})});
  lines.sort((a,b)=>String(a.t).localeCompare(String(b.t)));
  return lines.length?`<div class="sec-h"><h2>Your people</h2></div><div class="list">${lines.slice(0,5).map(l=>`<a class="li" href="${l.go}">${avatar(l.id)}<div class="grow"><div class="small">${l.h}</div><div class="d">${e(fmtDay(l.t))}</div></div></a>`).join('')}</div>`:'';
}
function vPlans(){
  const evs=events().filter(x=>x.city===S.city),up=evs.filter(x=>!isPast(x)),past=evs.filter(isPast);
  const fb=past.filter(x=>{const r=myR(x.id);return r&&r.checked_in_at&&!S.feedback[r.id]});
  const hi=me().name.split(' ')[0];
  const pass=S.settings.pass_price>0?`<div class="card" style="margin-top:14px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>December Pass · ${naira(S.settings.pass_price)}</b><div class="small mute">${e(S.settings.pass_note||'Every hosted plan until 31 December.')}</div></div>${payBtn().replace('class="btn"','class="btn sm"')||'<span class="tiny">Ask the host</span>'}</div>`:'';
  return`<h1 class="title">Hey ${e(hi)}</h1><p class="sub">What are you doing this week?</p>
  <div class="row"><a class="btn" href="#down">Ask who's down</a><a class="btn soft" href="#around">What's on</a></div>
  ${fb.length?`<div class="sec-h"><h2>How was it?</h2></div><div class="stack">${fb.map(ticket).join('')}</div>`:''}
  ${feed()}
  <div class="sec-h"><h2>Hosted plans</h2><span class="tiny">${e(S.city)}</span></div>${pass}
  <div class="stack" style="margin-top:12px">${up.map(ticket).join('')||'<div class="empty"><h3>Nothing hosted yet</h3><p>New plans drop every week.</p></div>'}</div>
  ${past.length?`<details class="acc"><summary>Past plans</summary><div class="body stack">${past.map(ticket).join('')}</div></details>`:''}`;
}
function ticket(ev){
  const rs=active(ev.id),n=rs.length,left=ev.cap-n,d=dt(ev.starts_at),col=KCOL[ev.kind]||KCOL.eat;
  return`<article class="event"><div class="cover" style="background:${col}"><div class="when">${e(d.toLocaleDateString('en-GB',{weekday:'short'}))}<b>${d.getDate()}</b>${e(d.toLocaleDateString('en-GB',{month:'short'}))}</div>
  <svg class="glyph" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">${GLYPH[ev.kind]||GLYPH.eat}</svg>
  <span class="tag">${ev.women_only?'Women only':KINDS[ev.kind]||'Plan'}</span></div>
  <div class="in"><h3>${e(ev.title)}</h3>
  <div class="meta">${ICON.clock}${e(fmtTime(ev.starts_at))}<span>·</span>${ICON.pin}${e(ev.venue||ev.area||ev.city)}${ev.venue&&ev.area?', '+e(ev.area):''}</div>
  <div class="pills">${ev.budget?`<span class="pill">${e(ev.budget)}</span>`:''}${ev.ages&&ev.ages!=='Any adult age'?`<span class="pill">${e(ev.ages.replace('Ages ',''))}</span>`:''}${ev.partner?'<span class="pill ok">Outside spot</span>':''}<span class="pill ${left<=2&&left>0?'hot':''}">${left>0?left+' spot'+(left===1?'':'s')+' left':'Full · waitlist'}</span></div>
  ${n?`<div class="going">${avStack(rs.map(x=>x.user_id))}<span>${e(pname(rs[0].user_id))}${n>1?` + ${n-1} going`:' is going'}</span></div>`:''}
  ${ev.notes?`<p class="small mute" style="margin:10px 0 0">${e(ev.notes)}</p>`:''}
  ${actions(ev,myR(ev.id),n,ev.cap)}</div></article>`;
}
function actions(ev,r,n,cap){
  const id=e(ev.id),p=me(),g=gate(false);
  if(!r||r.status==='cancelled'){
    if(isPast(ev))return'';if(g)return`<p class="small mute">${g}</p>`;
    let price='';const first=!list('rsvps').some(x=>x.user_id===S.uid&&x.paid);const amt=first?Math.max(ev.fee,S.settings.first_fee):ev.fee;
    if(amt>0)price=`<span class="price">${naira(amt)}</span>`;else price='<span class="price">Free</span>';
    let btn=`<button class="btn" data-act="join" data-id="${id}">${n>=cap?'Join waitlist':"I'm in"}</button>`;
    if(strikes(S.uid)>=2)btn='<button class="btn" disabled>Paused</button>';
    else if(ev.women_only&&!p.is_woman)btn='<button class="btn" disabled>Women only</button>';
    else if(ev.women_only&&!p.verified)btn='<button class="btn" disabled>Verify to join</button>';
    return`<div class="foot">${price}${btn}</div>`;
  }
  let h='';
  if(r.status==='waitlist')h='<div class="status"><b>You\'re on the waitlist</b>We\'ll tell you if a spot opens.</div>';
  else if(!r.paid)h=r.sent?'<div class="status"><b>Payment sent</b>The host will confirm your spot soon.</div>'
    :`<div class="status"><b>Pay ${naira(r.amount)} to hold your spot</b>${payText()||'Only your first plan costs this.'}<div class="row">${payBtn().replace('class="btn"','class="btn sm"')}<button class="btn soft sm" data-act="sent" data-id="${id}">I've paid</button></div></div>`;
  else if(!r.checked_in_at)h=`<div class="status ok"><b>You're going</b>${isLive(ev)?'Tap when you get there.':'Check in when you arrive.'}<div class="row">${isLive(ev)?`<button class="btn sm" data-act="arrive" data-id="${id}">I'm here</button>`:''}<button class="btn soft sm" data-act="share" data-id="${id}">Send to emergency contact</button><button class="btn soft sm" data-act="cardEv" data-id="${id}">Share</button></div></div>`;
  else{h=`<div class="status ok"><b>Checked in ${e(fmtTime(r.checked_in_at))}</b>${r.home_safe_at?`Home safe ${e(fmtTime(r.home_safe_at))}`:`<div class="row"><button class="btn sm" data-act="safe" data-id="${id}">I'm home safe</button></div>`}</div>`;
    h+=S.feedback[r.id]?'':feedbackForm(ev,r)}
  if(!r.checked_in_at&&!isPast(ev))h+=`<button class="link" data-act="leave" data-id="${id}">Can't make it</button>`;
  return h;
}
function feedbackForm(ev,r){
  const others=rsvpsOf(ev.id).filter(x=>x.user_id!==S.uid&&x.checked_in_at);
  return`<form class="form" data-fb="${e(r.id)}" style="margin-top:14px"><b>Would you hang out again?</b><span class="tiny" style="margin-top:-8px">Private. It only counts if it's mutual.</span>
  ${others.length?`<div class="chips">${others.map(o=>`<label class="chip"><input type="checkbox" name="again" value="${e(o.user_id)}" style="width:18px;height:18px;min-height:0;margin:0;accent-color:var(--ink)">${e(pname(o.user_id))}</label>`).join('')}</div>`:'<span class="tiny">No one else has checked in yet.</span>'}
  <fieldset class="stars"><legend>Rate it</legend>${[1,2,3,4,5].map(n=>`<label><input type="radio" name="rating" value="${n}"><span>${n}</span></label>`).join('')}</fieldset>
  <input name="note" maxlength="300" placeholder="Anything we should change? (optional)"><button class="btn block">Done</button></form>`;
}

/* ---------- who's down ---------- */
function pending(){
  const due=list('asks').filter(a=>dt(a.when_at)<new Date()&&Date.now()-dt(a.when_at)<14*864e5&&(a.joins||[]).length&&(a.by_user===S.uid||(a.joins||[]).includes(S.uid))&&!S.askFb[a.id]);
  return due.map(a=>{const crew=[a.by_user,...a.joins].filter(x=>x!==S.uid);return`<form class="card form" data-askfb="${e(a.id)}" style="margin-bottom:14px"><b>How was ${e(a.what)}?</b><span class="tiny" style="margin-top:-8px">Would you hang out again? Private, only counts if mutual.</span>
  <div class="chips">${crew.map(x=>`<label class="chip"><input type="checkbox" name="again" value="${e(x)}" style="width:18px;height:18px;min-height:0;margin:0;accent-color:var(--ink)">${e(pname(x))}</label>`).join('')}</div>
  <fieldset class="stars"><legend>Rate it</legend>${[1,2,3,4,5].map(n=>`<label><input type="radio" name="rating" value="${n}"><span>${n}</span></label>`).join('')}</fieldset><button class="btn block">Done</button></form>`}).join('')}
function vDown(){
  const p=me(),g=gate(true),d=S.askDraft||{},mine=new Set(p.wants||[]),pool={};
  const focus=location.hash.startsWith('#ask-')?location.hash.slice(5):null,fa=focus&&S.asks[focus];
  const end=new Date();end.setHours(23,59,0,0);const wk=new Date();wk.setDate(wk.getDate()+((7-wk.getDay())%7));wk.setHours(23,59,0,0);
  let asks=list('asks').filter(a=>!askPast(a)&&a.status==='open'&&a.id!==focus&&(a.by_user===S.uid||a.city===S.city));
  if(S.filter==='tonight')asks=asks.filter(a=>dt(a.when_at)<=end);if(S.filter==='weekend')asks=asks.filter(a=>dt(a.when_at)<=wk);
  asks.sort((a,b)=>a.when_at.localeCompare(b.when_at));
  list('profiles').filter(x=>x.city===S.city).forEach(x=>(x.wants||[]).forEach(w=>{const k=String(w).trim();if(k)pool[k]=(pool[k]||0)+1}));
  const all=[...new Set([...WANTS,...Object.keys(pool)])].sort((a,b)=>(pool[b]||0)-(pool[a]||0));
  const known=Object.keys(S.people).length>0,open=S.askOpen||d.what||(d.invite||[]).length;
  const form=g?`<div class="status">${g}</div>`:!open?`<button class="btn block" data-act="openAsk">+ Ask who's down</button>`:`<form id="askForm" class="card form">
   ${(d.invite||[]).length?`<div class="row">${d.invite.map(x=>avatar(x)).join('')}<span class="small">Just ${d.invite.map(x=>e(pname(x))).join(', ')}</span><button type="button" class="link" data-act="clearInvite">Make it open</button></div>`:''}
   <input name="what" required maxlength="100" value="${e(d.what)}" placeholder="What do you want to do?" style="font-size:18px;font-weight:600">
   <div class="two"><label class="fld">When<input type="datetime-local" name="when" required value="${e(d.when)}"></label><label class="fld">Where<input name="place" required maxlength="100" value="${e(d.place)}" placeholder="A public place"></label></div>
   <div class="two"><label class="fld">Budget<input name="budget" maxlength="40" value="${e(d.budget)}" placeholder="₦5k–₦10k"></label><label class="fld">People<select name="seats">${[1,2,3,4,5,6,8].map(n=>`<option ${+(d.seats||3)===n?'selected':''}>${n}</option>`).join('')}</select></label></div>
   ${(d.invite||[]).length?'':known?`<label class="fld">Who can see it<select name="ring">${['everyone','met','circles'].map(k=>`<option value="${k}" ${(d.ring||'everyone')===k?'selected':''}>${k==='circles'?'Only my circles':k==='met'?"People I've met":'Everyone in '+e(S.city)}</option>`).join('')}</select></label>`:'<input type="hidden" name="ring" value="everyone">'}
   <div class="row"><button class="btn" style="flex:1">Post</button><button type="button" class="btn soft" data-act="tonight">Tonight 7pm</button><button type="button" class="link" data-act="closeForm">Cancel</button></div></form>`;
  return`<h1 class="title">Who's down?</h1><p class="sub">Post it. Verified people in ${e(S.city)} who are free can join.</p>
  ${fa?`<div style="margin-bottom:14px">${askSafe(fa)}</div>`:focus?'<div class="status" style="margin-bottom:14px">This invite isn\'t open to you yet.</div>':''}
  ${pending()}${form}
  <div class="sec-h"><h2>Open now</h2><div class="seg" role="group" aria-label="When">${[['all','All'],['tonight','Tonight'],['weekend','Weekend']].map(([k,l])=>`<button data-act="filter" data-f="${k}" aria-pressed="${S.filter===k}">${l}</button>`).join('')}</div></div>
  <div class="stack">${asks.map(askSafe).join('')||'<div class="empty"><h3>Quiet right now</h3><p>Be the first to post something.</p></div>'}</div>
  <div class="sec-h"><h2>People want to</h2><span class="tiny">Tap yours</span></div>
  <div class="chips">${all.map(w=>{const n=pool[w]||0,on=mine.has(w);return`<button class="chip" data-act="want" data-w="${e(w)}" aria-pressed="${on}">${e(w)}${n?` <span class="n">${n}</span>`:''}</button>`}).join('')}</div>
  <form id="wantForm" class="row" style="margin-top:12px"><input name="w" maxlength="60" placeholder="Add your own" style="flex:1"><button class="btn soft">Add</button></form>`;
}
function askSafe(a){
  const joins=a.joins||[],left=a.seats-joins.length,mineA=a.by_user===S.uid,inA=joins.includes(S.uid),hap=a.hap_id&&S.haps[a.hap_id];
  const widen=mineA&&left>0&&['circles','met'].includes(a.ring)?`<button class="mini" data-act="widen" data-id="${e(a.id)}">Open it up</button>`:'';
  const ago=Math.round((Date.now()-dt(a.created_at||a.when_at))/36e5);
  const cta=mineA?'':inA?`<button class="btn soft sm" data-act="unjoin" data-id="${e(a.id)}">Can't go</button>`:left>0&&!gate(true)?`<button class="btn sm" data-act="joinAsk" data-id="${e(a.id)}">I'm down</button>`:'';
  return`<article class="card ask"><div class="who">${avatar(a.by_user)}<div class="grow"><div class="nm">${mineA?'You':e(pname(a.by_user))}</div><div class="tiny">${ago<1?'Just now':ago<24?ago+'h ago':Math.round(ago/24)+'d ago'}${a.ring==='circles'?' · circles':a.ring==='met'?" · people they've met":a.ring==='invite'?' · invite':''}</div></div>${cta}</div>
  <h3>${e(a.what)}</h3>
  <div class="meta">${ICON.clock}${e(fmtDay(a.when_at))}, ${e(fmtTime(a.when_at))}</div><div class="meta">${ICON.pin}${e(a.place)}</div>
  <div class="pills">${a.budget?`<span class="pill">${e(a.budget)}</span>`:''}${hap?`<span class="pill">${e(hap.title)}</span>`:''}<span class="pill ${left>0?'':'ok'}">${left>0?left+' spot'+(left===1?'':'s'):'Full'}</span></div>
  ${joins.length?`<div class="going">${avStack(joins)}<span>${joins.length} down</span></div>`:''}
  ${(mineA||inA)&&joins.length?`<div class="row" style="margin-top:10px" data-contacts="${e(a.id)}"><button class="mini" data-act="contacts" data-id="${e(a.id)}">WhatsApp numbers</button></div>`:''}
  <div class="row" style="margin-top:10px">${mineA?`${widen}<button class="mini" data-act="cardAsk" data-id="${e(a.id)}">Share</button>${joins.length?`<button class="mini" data-act="askIntro" data-id="${e(a.id)}">Copy group intro</button>`:''}<button class="mini" data-act="closeAsk" data-id="${e(a.id)}">Close</button>`:''}<button class="mini" data-act="copyLink" data-id="${e(a.id)}">Copy link</button>${mineA?'':`<button class="link" data-act="report" data-k="a:${e(a.id)}:${e(a.by_user)}" style="margin-left:auto">Report</button>`}</div>${reportForm('a:'+a.id+':'+a.by_user)}</article>`;
}
function reportForm(k){return S.reportOpen===k?`<form class="form" data-report="${e(k)}" style="margin-top:10px"><textarea name="why" required rows="3" maxlength="500" placeholder="What happened? Only the host sees this."></textarea><div class="row"><button class="btn sm">Send</button><button type="button" class="btn soft sm" data-act="report" data-k="${e(k)}">Cancel</button></div></form>`:''}

/* ---------- happening ---------- */
function vAround(){
  const hs=list('haps').filter(h=>h.city===S.city&&(h.end_date||h.start_date)>=today()).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  return`<h1 class="title">Happening</h1><p class="sub">What's on in ${e(S.city)}. Don't go alone.</p>
  <div class="list">${hs.map(h=>{const d=dt(h.start_date+'T12:00'),lf=list('asks').filter(a=>a.hap_id===h.id&&!askPast(a)&&a.status==='open');
   return`<div class="li" style="align-items:flex-start"><div class="date-sq"><span>${e(d.toLocaleDateString('en-GB',{month:'short'}))}</span><b>${d.getDate()}</b></div><div class="grow">
   <div class="t">${e(h.title)}</div><div class="d">${h.end_date?'Until '+e(fmtDay(h.end_date+'T12:00'))+' · ':''}${e(h.venue||'Venue TBA')}${h.price?' · '+e(h.price):''}</div>
   ${lf.length?`<div class="going" style="margin-top:8px">${avStack(lf.map(a=>a.by_user))}<span>${lf.length} looking for company</span></div>`:''}
   <div class="row" style="margin-top:10px"><button class="btn sm" data-act="hapAsk" data-id="${e(h.id)}">Find a plus one</button>${/^https:\/\//.test(h.link||'')?`<a class="mini" href="${e(h.link)}" target="_blank" rel="noopener" style="text-decoration:none">Details</a>`:''}</div></div></div>`}).join('')||'<div class="empty"><h3>Nothing listed yet</h3></div>'}</div>
  <p class="tiny" style="margin-top:12px">From news reports and organisers. Check details before you buy tickets.</p>`;
}

/* ---------- my people ---------- */
function vPeople(){
  const g=gate(false);if(g)return`<h1 class="title">People</h1><div class="status">${g}</div>`;
  const cs=list('circles').filter(c=>c.members.includes(S.uid)),ids=Object.keys(S.people).sort((a,b)=>(S.people[b].mutual?1:0)-(S.people[a].mutual?1:0)||S.people[b].times-S.people[a].times);
  const mutual=ids.filter(x=>S.people[x].mutual&&!cs.some(c=>c.members.includes(x)));
  const suggest=mutual.length?`<div class="card" style="background:var(--okbg);box-shadow:none;margin-bottom:14px"><div class="row">${avStack(mutual)}<b style="flex:1">You and ${mutual.map(x=>e(pname(x))).join(', ')} want to go again</b></div><button class="btn block" style="margin-top:12px" data-act="suggestCircle" data-ids="${e(mutual.join(','))}">Start a circle</button></div>`:'';
  return`<h1 class="title">People</h1><p class="sub">Your circles and everyone you've met.</p>${suggest}
  ${cs.length?`<div class="stack">${cs.map(circleCard).join('')}</div>`:suggest?'':`<div class="card"><b>No circles yet</b><ol class="plain small mute" style="margin-top:8px"><li>Go out once: a hosted plan or someone's invite.</li><li>Say who you'd see again. It's private.</li><li>When it's mutual, start a circle.</li></ol><a class="btn block" style="margin-top:14px" href="#down">See who's going out</a></div>`}
  ${ids.length?`<div class="sec-h"><h2>Met</h2><span class="tiny">${ids.length}</span></div><div class="list">${ids.map(pid=>{const x=S.people[pid];return`<div class="li"><input type="checkbox" data-pick="${e(pid)}" ${S.pick.has(pid)?'checked':''} aria-label="Pick ${e(pname(pid))}" style="width:20px;height:20px;min-height:0;accent-color:var(--ink)">${avatar(pid)}<div class="grow"><div class="t">${e(pname(pid))}${x.mutual?' <span class="pill ok" style="padding:2px 8px">Mutual</span>':''}</div><div class="d">${x.times}× · ${e(x.last_what)}</div></div><button class="mini" data-act="invite" data-p="${e(pid)}">Invite</button></div>${reportForm('p:'+pid)}`}).join('')}</div>
   <form id="circleForm" class="row" style="margin-top:12px"><input name="name" required maxlength="40" placeholder="Circle name, e.g. Sunday readers" style="flex:1"><button class="btn">Start circle</button></form><p class="tiny">Tick people above first.</p>`:''}`;
}
function circleCard(c){
  const mem=c.members,hist=c.history||[],host=mem[(c.host_idx||0)%mem.length],n=c.next_plan,going=n&&n.going||[];
  let next;
  if(!n)next=`<div class="status"><b>${host===S.uid?'Your turn to pick':e(pname(host))+"'s turn to pick"}</b>Anyone can set the next one.<form class="form nextForm" data-c="${e(c.id)}" style="margin-top:10px"><input name="what" required maxlength="80" placeholder="What?"><div class="two"><input type="datetime-local" name="when" required aria-label="When"><input name="place" required maxlength="80" placeholder="Where?"></div><button class="btn sm">Set plan</button></form></div>`;
  else{const happened=Date.now()>dt(n.when_at).getTime();
    next=`<div class="status ok"><b>${e(n.what)}</b>${e(fmtDay(n.when_at))}, ${e(fmtTime(n.when_at))} · ${e(n.place)}${going.length?`<div class="going" style="margin-top:8px">${avStack(going)}<span>${going.length} in</span></div>`:''}
    <div class="row">${happened?`<button class="btn sm" data-act="cDone" data-c="${e(c.id)}">We went</button><button class="btn soft sm" data-act="cSkip" data-c="${e(c.id)}">Didn't happen</button>`
     :going.includes(S.uid)?`<button class="btn soft sm" data-act="cOut" data-c="${e(c.id)}">Can't make it</button>`:`<button class="btn sm" data-act="cIn" data-c="${e(c.id)}">I'm in</button>`}
     ${happened?'':`<button class="mini" data-act="cSeat" data-c="${e(c.id)}">Add a spare seat</button><button class="mini" data-act="cCopy" data-c="${e(c.id)}">Copy reminder</button>`}</div></div>`}
  return`<article class="card"><div class="row">${avStack(mem)}<div class="grow" style="flex:1"><h3 style="font-size:18px">${e(c.name)}</h3><div class="tiny">${hist.length} time${hist.length===1?'':'s'} together</div></div></div>
  ${next}<div class="row" style="margin-top:8px" data-ccontacts="${e(c.id)}"><button class="mini" data-act="ccontacts" data-c="${e(c.id)}">WhatsApp numbers</button><button class="link" data-act="leaveCircle" data-c="${e(c.id)}" style="margin-left:auto">Leave</button></div></article>`;
}

/* ---------- notifications ---------- */
function vNotes(){
  return`<h1 class="title">Updates</h1>${S.notes.length?`<div class="list">${S.notes.map(n=>`<a class="li ${n.read?'':'unread'}" href="${/^#[a-z0-9-]+$/i.test(n.link||'')?e(n.link):'#notes'}"><div class="grow"><div class="small">${e(n.body)}</div><div class="d">${e(fmtDay(n.created_at))}, ${e(fmtTime(n.created_at))}</div></div></a>`).join('')}</div>`:'<div class="empty"><h3>All caught up</h3><p>Joins, invites and open spots show up here.</p></div>'}`;
}

/* ---------- me ---------- */
function vMe(){
  const base=me(),been=list('rsvps').filter(r=>r.user_id===S.uid&&r.checked_in_at).length,cs=list('circles').filter(c=>c.members.includes(S.uid)).length,met=Object.keys(S.people).length;
  const badge=base.suspended?'<span class="pill hot">Paused</span>':base.verified?'<span class="pill ok">Verified</span>':'<span class="pill">Verification pending</span>';
  return`<div class="prof">${avatar(S.uid,'lg')}<div><h2>${e(base.name)}</h2><div class="row" style="margin-top:6px">${badge}<span class="tiny">${e(base.city)}</span></div></div></div>
  ${base.verified?'':'<div class="status" style="margin-bottom:14px"><b>Almost in</b>The host will WhatsApp you for a 2-minute video call. Then invites and women-only plans open up.</div>'}
  <div class="stats"><div class="stat"><b>${been}</b><span>Plans</span></div><div class="stat"><b>${met}</b><span>People met</span></div><div class="stat"><b>${cs}</b><span>Circles</span></div></div>
  ${S.invites?`<div class="card"><div class="row" style="justify-content:space-between"><div><b>Invite friends</b><div class="tiny">${Math.max(0,3-S.invites.used)} of 3 left · they get verified faster</div></div><button class="btn sm" data-act="copyInvite">Copy link</button></div></div>`:''}
  ${S.admin?'<a class="btn soft block" href="#host" style="margin-top:10px">Host dashboard</a>':''}
  <details class="acc"><summary>Edit profile</summary><div class="body">${profileForm(base)}</div></details>
  <details class="acc"><summary>Add to your home screen</summary><div class="body small">${installEvt?'<button class="btn block" data-act="install" style="margin-bottom:10px">Install Outside</button>':''}<b>iPhone:</b> in Safari, tap Share, then Add to Home Screen.<br><b>Android:</b> in Chrome, tap ⋮, then Install app.</div></details>
  <details class="acc"><summary>Your December so far</summary><div class="body"><p class="small mute" style="margin-top:0">${been} plans, ${met} new people, ${cs} circles.</p><button class="btn soft block" data-act="cardWrap">Share it</button></div></details>
  <details class="acc"><summary>Rules & safety</summary><div class="body"><ol class="plain">${RULES.map(r=>`<li>${e(r)}</li>`).join('')}</ol><p class="small"><a href="privacy.html">Privacy notice</a></p></div></details>
  <button class="link" data-act="signout" style="display:block;margin:18px auto 0">Log out</button>`;
}

/* ---------- host ---------- */
function vHost(){
  const rs=list('rsvps').filter(r=>r.status!=='cancelled'&&S.events[r.event_id]),paid=rs.filter(r=>r.paid),came=rs.filter(r=>r.checked_in_at);
  const due=paid.filter(r=>r.checked_in_at||isPast(S.events[r.event_id])),fb=list('feedback'),rated=fb.filter(f=>f.rating);
  const pc=(a,b)=>b?Math.round(a/b*100)+'%':'—',ppl=list('profiles');
  const revenue=paid.reduce((s,r)=>s+(r.amount||0),0),owed=rs.filter(r=>r.sent&&!r.paid).length;
  const tile=(l,v,t,ok)=>`<div class="tile ${ok==null?'':ok?'good':'warn'}"><span>${l}</span><b>${v}</b>${t?`<small>${t}</small>`:''}</div>`;
  const showRate=due.length?due.filter(r=>r.checked_in_at).length/due.length:null,again=fb.length?fb.filter(f=>(f.meet_again||[]).length).length/fb.length:null;
  const d=S.draft||{},hd=S.hapDraft||{},st=S.settings;
  const pool={};ppl.filter(x=>x.city===S.city).forEach(x=>(x.wants||[]).forEach(w=>pool[w]=(pool[w]||0)+1));
  const ready=Object.entries(pool).filter(([,n])=>n>=4).sort((a,b)=>b[1]-a[1]);
  const openRep=list('reports').filter(r=>r.status==='open');
  const sorted=ppl.slice().sort((a,b)=>(a.verified?1:0)-(b.verified?1:0)||String(b.created_at).localeCompare(String(a.created_at)));
  return`<h1 class="title">Host</h1><p class="sub">${e(S.city)} · switch city at the top</p>
  <div class="tiles">${tile('Members',ppl.length,ppl.filter(x=>x.verified).length+' verified')}${tile('Sign-ups',rs.length,paid.length+' paid')}${tile('Show-up rate',pc(due.filter(r=>r.checked_in_at).length,due.length),'target 80%',showRate==null?null:showRate>=.8)}${tile('Want to go again',again==null?'—':Math.round(again*100)+'%','target 40%',again==null?null:again>=.4)}${tile('Home safe',pc(came.filter(r=>r.home_safe_at).length,came.length))}${tile('Rating',rated.length?(rated.reduce((s,f)=>s+f.rating,0)/rated.length).toFixed(1):'—')}${tile('Circles',list('circles').length)}${tile('Open invites',list('asks').filter(a=>!askPast(a)&&a.status==='open').length)}${tile('Collected',naira(revenue))}${tile('To confirm',owed,'say they paid',owed?false:null)}</div>
  ${openRep.length?`<div class="sec-h"><h2>Reports</h2><span class="pill hot">${openRep.length}</span></div><div class="stack">${openRep.map(r=>`<div class="card"><p style="margin-top:0"><b>${e(pname(r.by_user))}</b> reported <b>${e(pname(r.about))}</b>${r.ask_id&&S.asks[r.ask_id]?` · ${e(S.asks[r.ask_id].what)}`:''} · ${e(fmtDay(r.created_at))}</p><p>${e(r.why)}</p><div class="row"><button class="mini" data-act="suspend" data-p="${e(r.about)}">${(S.profiles[r.about]||{}).suspended?'Unpause':'Pause'} ${e(pname(r.about))}</button><button class="mini" data-act="resolve" data-id="${e(r.id)}">Resolved</button></div></div>`).join('')}</div>`:''}
  ${ready.length?`<div class="sec-h"><h2>Ready to plan</h2><span class="tiny">4+ people want these</span></div><div class="list">${ready.map(([w,n])=>`<div class="li"><div class="grow"><div class="t">${e(w)}</div><div class="d">${n} people</div></div><button class="mini" data-act="mkplan" data-w="${e(w)}">Create & notify</button></div>`).join('')}</div>`:''}
  <div class="sec-h"><h2>Members</h2><span class="tiny">Verify on a 2-min WhatsApp video call</span></div>
  ${sorted.length?`<div class="scroll"><table><thead><tr><th>Name</th><th>City</th><th>WhatsApp</th><th>Emergency contact</th><th>Invited by</th><th></th><th>No-shows</th><th>Pass</th><th></th></tr></thead><tbody>${sorted.map(p=>{const c=S.privates[p.id]||{},sk=strikes(p.id);
    return`<tr><td>${e(p.name)}${p.is_woman?' <span class="tiny">W</span>':''}${p.age_band?' <span class="tiny">'+e(p.age_band)+'</span>':''}</td><td>${e(p.city)}</td><td>${e(c.phone||'—')}</td><td>${c.tc_name?e(c.tc_name)+' '+e(c.tc_phone||''):'—'}</td><td>${p.invited_by?e(pname(p.invited_by)):e(p.ref_note||'—')}</td>
    <td><button class="mini ${p.verified?'on':''}" aria-pressed="${p.verified}" data-act="verify" data-p="${e(p.id)}">${p.verified?'Verified':'Verify'}</button></td>
    <td>${sk}${sk?` <button class="mini" data-act="clearStrikes" data-p="${e(p.id)}">Clear</button>`:''}</td><td><button class="mini ${p.pass_until?'on':''}" data-act="pass" data-p="${e(p.id)}">${p.pass_until?'Has pass':'Give'}</button></td><td><button class="mini" data-act="suspend" data-p="${e(p.id)}">${p.suspended?'Unpause':'Pause'}</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="mute">No members yet.</p>'}
  <div class="sec-h"><h2>${S.editing?'Edit plan':'New plan'}</h2></div>
  <form id="evForm" class="card form"><input name="title" required maxlength="80" value="${e(d.title)}" placeholder="Title" style="font-size:18px;font-weight:600">
  <div class="two"><label class="fld">City<select name="city">${CITIES.map(x=>`<option ${(d.city||S.city)===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="fld">Type<select name="kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}" ${d.kind===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
  <div class="two"><label class="fld">Starts<input type="datetime-local" name="starts_at" required value="${e(d.starts_at)}"></label><label class="fld">Spots<input type="number" name="cap" min="2" max="50" value="${e(d.cap||6)}"></label></div>
  <div class="two"><label class="fld">Venue<input name="venue" maxlength="80" value="${e(d.venue)}"></label><label class="fld">Area<input name="area" maxlength="40" value="${e(d.area)}" placeholder="Wuse 2"></label></div>
  <div class="two"><label class="fld">Budget<input name="budget" maxlength="40" value="${e(d.budget)}" placeholder="₦8k–₦15k"></label><label class="fld">Fee after first plan (₦)<input type="number" name="fee" min="0" step="100" value="${e(d.fee??0)}"></label></div>
  <label class="fld">Ages<select name="ages">${['Any adult age',...AGES.map(a=>'Ages '+a)].map(a=>`<option ${d.ages===a?'selected':''}>${a}</option>`).join('')}</select></label>
  <label class="chk"><input type="checkbox" name="women_only" ${d.women_only?'checked':''}> Women only</label>
  <label class="chk"><input type="checkbox" name="partner" ${d.partner?'checked':''}> Partner venue (Outside spot)</label>
  <input name="notes" maxlength="200" value="${e(d.notes)}" placeholder="Note for guests (optional)">
  <div class="row"><button class="btn">${S.editing?'Save':'Create plan'}</button>${S.editing||S.draft?'<button type="button" class="btn soft" data-act="cancelEdit">Cancel</button>':''}${S.editing?'<button type="button" class="link" data-act="delEv">Delete</button>':''}</div></form>
  ${events().filter(x=>x.city===S.city).map(roster).join('')}
  <div class="sec-h"><h2>Money</h2></div>
  <form id="setForm" class="card form"><div class="two"><label class="fld">First-plan fee (₦)<input type="number" name="first_fee" min="0" step="100" value="${e(st.first_fee)}"></label><label class="fld">December Pass (₦, 0 = off)<input type="number" name="pass_price" min="0" step="500" value="${e(st.pass_price||0)}"></label></div>
  <label class="fld">Payment link or bank details<input name="pay_info" maxlength="300" value="${e(st.pay_info)}" placeholder="https://paystack.com/pay/…"></label>
  <label class="fld">Pass description<input name="pass_note" maxlength="200" value="${e(st.pass_note)}" placeholder="Every hosted plan until 31 December."></label><button class="btn">Save</button></form>
  <div class="sec-h"><h2>${S.hapEditing?'Edit listing':'Add to Happening'}</h2></div>
  <form id="hapForm" class="card form"><input name="title" required maxlength="100" value="${e(hd.title)}" placeholder="Event name">
  <div class="two"><label class="fld">City<select name="city">${CITIES.map(x=>`<option ${(hd.city||S.city)===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="fld">Venue<input name="venue" maxlength="80" value="${e(hd.venue)}"></label></div>
  <div class="two"><label class="fld">Date<input type="date" name="start_date" required value="${e(hd.start_date)}"></label><label class="fld">Ends<input type="date" name="end_date" value="${e(hd.end_date)}"></label></div>
  <div class="two"><label class="fld">Price<input name="price" maxlength="60" value="${e(hd.price)}"></label><label class="fld">Link<input name="link" maxlength="300" value="${e(hd.link)}" placeholder="https://"></label></div>
  <input name="note" maxlength="140" value="${e(hd.note)}" placeholder="Note (optional)">
  <div class="row"><button class="btn">${S.hapEditing?'Save':'Add'}</button>${S.hapEditing?'<button type="button" class="btn soft" data-act="hapCancel">Cancel</button><button type="button" class="link" data-act="hapDel">Delete</button>':''}</div></form>
  <div class="list" style="margin-top:12px">${list('haps').filter(h=>h.city===S.city).sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(h=>`<div class="li"><div class="grow"><div class="t">${e(h.title)}</div><div class="d">${e(h.start_date)}</div></div><button class="mini" data-act="hapEdit" data-id="${e(h.id)}">Edit</button></div>`).join('')}</div>
  <button class="btn soft" data-act="csv" style="margin-top:18px">Copy plan data as CSV</button>`;
}
function tog(r,f,on,label){return`<button class="mini ${on?'on':''}" aria-pressed="${on}" data-act="tog" data-f="${f}" data-r="${e(r.id)}">${label}</button>`}
function roster(ev){
  const rs=rsvpsOf(ev.id),past=isPast(ev),gs=groupsFor(ev.id);
  const saved=new Set(list('circles').filter(c=>c.from_event===ev.id).map(c=>c.members.slice().sort().join(',')));
  const rows=rs.map(r=>{const p=S.profiles[r.user_id]||{},f=S.feedback[r.id];
    return`<tr><td>${e(p.name||'Someone')}${p.verified?'':' <span class="tiny">unverified</span>'}${r.status==='waitlist'?' <span class="pill">waitlist</span>':''}</td><td>${e((S.privates[r.user_id]||{}).phone||'—')}</td>
    <td>${naira(r.amount)} ${tog(r,'paid',r.paid,r.paid?'Paid':'Unpaid')}${r.sent&&!r.paid?' <span class="pill hot">says paid</span>':''}</td><td>${tog(r,'checked_in_at',!!r.checked_in_at,r.checked_in_at?e(fmtTime(r.checked_in_at)):'No')}</td>
    <td>${r.home_safe_at?e(fmtTime(r.home_safe_at)):r.checked_in_at?'<span class="pill hot">not yet</span>':'—'}</td><td>${f?`${(f.meet_again||[]).length} yes · ${f.rating||'—'}/5${f.note?' · '+e(f.note):''}`:'—'}</td>
    <td><button class="mini" data-act="remove" data-r="${e(r.id)}">Remove</button></td></tr>`}).join('');
  return`<div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between"><div><b>${e(ev.title)}</b><div class="tiny">${e(fmtDay(ev.starts_at))}, ${e(fmtTime(ev.starts_at))} · ${active(ev.id).length}/${ev.cap}</div></div><button class="mini" data-act="edit" data-id="${e(ev.id)}">Edit</button></div>
  ${rs.length?`<div class="scroll"><table><thead><tr><th>Name</th><th>WhatsApp</th><th>Payment</th><th>Arrived</th><th>Home safe</th><th>Go again · rating</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="tiny">No one yet.</p>'}
  ${gs.length?`<div class="status ok"><b>Mutual matches</b>${gs.map((g,i)=>`<div class="row" style="justify-content:space-between"><span>${g.map(x=>e(pname(x))).join(', ')}</span>${saved.has(g.join(','))?'<span class="pill ok">Circle saved</span>':`<button class="mini" data-act="saveCircle" data-ev="${e(ev.id)}" data-c="${i}">Save as circle</button>`}</div>`).join('')}</div>`:''}</div>`;
}

/* ---------- share cards ---------- */
async function shareCard(lines,link,file){
  const c=document.createElement('canvas');c.width=1080;c.height=1920;const x=c.getContext('2d');
  x.fillStyle='#ffb400';x.fillRect(0,0,1080,1920);x.fillStyle='#1a1423';x.fillRect(0,1340,1080,580);
  x.fillStyle='#1a1423';x.font='700 64px "Familjen Grotesk", sans-serif';x.fillText('Outside',90,170);
  const wrap=(t,y,size,col,max=900)=>{x.fillStyle=col;x.font=`700 ${size}px "Familjen Grotesk", sans-serif`;let line='';for(const w of String(t).split(' ')){const tst=line?line+' '+w:w;if(x.measureText(tst).width>max&&line){x.fillText(line,90,y);y+=size*1.15;line=w}else line=tst}x.fillText(line,90,y);return y+size*1.4};
  let y=wrap(lines[0],520,118,'#1a1423');y=wrap(lines[1]||'',y+20,54,'#1a1423');if(lines[2])wrap(lines[2],y,44,'#5a4a10');
  x.fillStyle='#ffb400';x.font='700 72px "Familjen Grotesk", sans-serif';x.fillText("Who's down?",90,1500);
  x.fillStyle='#ffffff';x.font='500 40px Inter, sans-serif';x.fillText(link.replace(/^https:\/\//,''),90,1600);
  x.font='400 34px Inter, sans-serif';x.fillStyle='#d8d0e0';x.fillText('Small groups · public places · verified members',90,1680);
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));const f=new File([blob],file,{type:'image/png'});
  try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],text:lines[0]+' '+link});return}}catch(err){if(err&&err.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file;document.body.appendChild(a);a.click();a.remove();toast('Saved the image. Post it to your Status or Story.');
}

/* ---------- events ---------- */
async function copy(t,msg){try{await navigator.clipboard.writeText(t);toast(msg)}catch(x){toast("Couldn't copy on this device.")}}
function goAsk(d){S.askDraft=d;S.askOpen=true;location.hash='#down';render(true);setTimeout(()=>{const f=$('#askForm');if(f){f.scrollIntoView({block:'center'});f.elements.what.focus()}},40)}
function sure(b,msg){if(b.dataset.sure)return true;b.dataset.sure=1;b.textContent=msg;return false}
async function showContacts(box,args){const r=await sb.rpc('out_crew_contacts',args);if(r.error){toast(r.error.message);return}
  box.innerHTML=(r.data||[]).length?(r.data||[]).map(x=>`<a class="mini" href="https://wa.me/${e(String(x.phone).replace(/\D/g,'').replace(/^0/,'234'))}" target="_blank" rel="noopener">${e(x.name)}: ${e(x.phone)}</a>`).join(' '):'<span class="small mute">No numbers yet.</span>'}

document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,id=b.dataset.id,rid=b.dataset.r,pid=b.dataset.p,cid=b.dataset.c;
  const R=rid&&S.rsvps[rid],A=id&&S.asks[id],C=cid&&S.circles[cid],E=id&&S.events[id];
  switch(a){
  case'authMode':S.authMode=S.authMode==='up'?'in':'up';render(true);break;
  case'forgot':{const em=$('#authForm').elements.email.value.trim();if(!em){toast('Type your email first.');return}const r=await sb.auth.resetPasswordForEmail(em,{redirectTo:BASE});toast(r.error?r.error.message:'Check your email for a reset link.');break}
  case'signout':await sb.auth.signOut();break;
  case'install':if(installEvt){installEvt.prompt();installEvt=null;render(true)}break;
  case'join':{const r=myR(id);await run(r?sb.from('out_rsvps').update({status:'requested'}).eq('id',r.id):sb.from('out_rsvps').insert({event_id:id}),"You're on the list.");break}
  case'sent':await run(sb.from('out_rsvps').update({sent:true}).eq('id',myR(id).id),'Thanks. The host will confirm your spot.');break;
  case'arrive':await run(sb.from('out_rsvps').update({checked_in_at:new Date().toISOString()}).eq('id',myR(id).id),'Checked in. Enjoy!');break;
  case'safe':await run(sb.from('out_rsvps').update({home_safe_at:new Date().toISOString()}).eq('id',myR(id).id),"Glad you're home.");break;
  case'leave':if(sure(b,'Tap again to give up your spot'))await run(sb.from('out_rsvps').update({status:'cancelled'}).eq('id',myR(id).id),'Spot released.');break;
  case'share':copy(`I'm going to "${E.title}" at ${E.venue||'a public venue'}${E.area?', '+E.area:''}, ${E.city} on ${fmtDay(E.starts_at)} at ${fmtTime(E.starts_at)}. It's a small group arranged through Outside. I'll message you when I'm home.`,'Copied. Paste it to your trusted contact.');break;
  case'cardEv':shareCard([E.title,`${fmtDay(E.starts_at)} · ${fmtTime(E.starts_at)}`,`${E.area||E.city}`],BASE,'outside-plan.png');break;
  case'cardAsk':shareCard([A.what,`${fmtDay(A.when_at)} · ${fmtTime(A.when_at)}`,A.place],BASE+'#ask-'+A.id,'outside-invite.png');break;
  case'cardWrap':shareCard([`My December, outside`,`${list('rsvps').filter(r=>r.user_id===S.uid&&r.checked_in_at).length} plans · ${Object.keys(S.people).length} new people`,`${list('circles').filter(c=>c.members.includes(S.uid)).length} circles`],BASE,'outside-december.png');break;
  case'copyLink':copy(BASE+'#ask-'+id,'Link copied.');break;
  case'copyInvite':copy(`Join me on Outside, for when your friends can't make it: ${BASE}?i=${S.invites.code}`,'Invite link copied. Send it to up to 3 people.');break;
  case'want':toggleWant(b.dataset.w);break;
  case'askThis':goAsk({what:b.dataset.w,ring:'everyone',seats:3});break;
  case'openAsk':S.askOpen=true;render(true);setTimeout(()=>{const f=$('#askForm');if(f)f.elements.what.focus()},30);break;
  case'closeForm':S.askOpen=false;S.askDraft=null;render(true);break;
  case'tonight':{const f=$('#askForm');const d=new Date();d.setHours(19,0,0,0);f.elements.when.value=toInput(d);S.askDraft={...(S.askDraft||{}),when:f.elements.when.value};break}
  case'filter':S.filter=b.dataset.f;render(true);break;
  case'hapAsk':{const h=S.haps[id];if(gate(true)){location.hash='#down';return}goAsk({what:'Going to '+h.title,when:h.start_date+'T18:00',place:h.venue||'',ring:'everyone',seats:2,hap:id});break}
  case'invite':goAsk({invite:[pid],ring:'invite',seats:1});break;
  case'clearInvite':S.askDraft={...S.askDraft,invite:[],ring:'everyone'};render(true);break;
  case'joinAsk':await run(sb.rpc('out_join_ask',{aid:id}),"You're in. Get their WhatsApp numbers on the card.");break;
  case'unjoin':await run(sb.rpc('out_leave_ask',{aid:id}),'Done.');break;
  case'widen':await run(sb.from('out_asks').update({ring:A.ring==='circles'?'met':'everyone'}).eq('id',id),'Widened.');break;
  case'closeAsk':if(sure(b,'Tap again to close'))await run(sb.from('out_asks').update({status:'closed'}).eq('id',id),'Closed.');break;
  case'askIntro':copy(`Hi ${[A.by_user,...A.joins].map(pname).join(', ')}! We're going to: ${A.what}, ${fmtDay(A.when_at)} at ${fmtTime(A.when_at)}, meeting at ${A.place}. See you there!`,'Copied. Paste it into a WhatsApp group.');break;
  case'contacts':showContacts(b.parentElement,{aid:id});break;
  case'ccontacts':showContacts(b.parentElement,{cid});break;
  case'report':S.reportOpen=S.reportOpen===b.dataset.k?null:b.dataset.k;render(true);break;
  case'suggestCircle':{S.pick=new Set(b.dataset.ids.split(','));render(true);const f=$('#circleForm');if(f){f.scrollIntoView({block:'center'});f.elements.name.focus()}break}
  case'cIn':case'cOut':{const g=C.next_plan.going||[];await run(sb.from('out_circles').update({next_plan:{...C.next_plan,going:a==='cIn'?[...new Set([...g,S.uid])]:g.filter(x=>x!==S.uid)}}).eq('id',cid));break}
  case'cDone':await run(sb.from('out_circles').update({history:[...(C.history||[]),{what:C.next_plan.what,when_at:C.next_plan.when_at,going:C.next_plan.going||[]}],next_plan:null,host_idx:(C.host_idx||0)+1}).eq('id',cid),'Logged. Someone else picks next time.');break;
  case'cSkip':await run(sb.from('out_circles').update({next_plan:null}).eq('id',cid));break;
  case'cCopy':copy(`${C.name}: ${C.next_plan.what}, ${fmtDay(C.next_plan.when_at)} at ${fmtTime(C.next_plan.when_at)}, ${C.next_plan.place}. Tap "I'm in" on Outside so we know who's coming: ${BASE}#people`,"Copied. Paste it into your circle's WhatsApp group.");break;
  case'cSeat':await run(sb.from('out_asks').insert({city:C.city,what:C.next_plan.what+' (with my circle)',when_at:C.next_plan.when_at,place:C.next_plan.place,seats:1,ring:'met',circle_id:cid}),"Spare seat posted in Who's down.");break;
  case'leaveCircle':if(sure(b,'Tap again to leave'))await run(sb.rpc('out_leave_circle',{cid}),'You left the circle.');break;
  case'mkplan':S.editing=null;S.draft={title:b.dataset.w,cap:6,fee:0,city:S.city,want:b.dataset.w};location.hash='#host';render(true);$('#evForm').scrollIntoView();break;
  case'edit':S.editing=id;S.draft={...E,starts_at:toInput(E.starts_at)};render(true);$('#evForm').scrollIntoView();break;
  case'cancelEdit':S.editing=null;S.draft=null;render(true);break;
  case'delEv':if(sure(b,'Tap again to delete this plan')){const x=S.editing;S.editing=null;S.draft=null;await run(sb.from('out_events').delete().eq('id',x),'Plan deleted.')}break;
  case'tog':{const f=b.dataset.f;await run(sb.from('out_rsvps').update(f==='paid'?{paid:!R.paid}:{checked_in_at:R.checked_in_at?null:new Date().toISOString()}).eq('id',rid));break}
  case'remove':if(sure(b,'Tap again'))await run(sb.from('out_rsvps').update({status:'cancelled'}).eq('id',rid),'Removed.');break;
  case'saveCircle':{const g=groupsFor(b.dataset.ev)[+cid]||[],e0=S.events[b.dataset.ev];await run(sb.from('out_circles').insert({name:e0.title+' crew',city:e0.city,members:g,from_event:e0.id,history:[{what:e0.title,when_at:e0.starts_at,going:g}]}),"Circle saved. They'll see it in My people.");break}
  case'verify':await run(sb.from('out_profiles').update({verified:!S.profiles[pid].verified}).eq('id',pid));break;
  case'suspend':await run(sb.from('out_profiles').update({suspended:!S.profiles[pid].suspended}).eq('id',pid));break;
  case'clearStrikes':await run(sb.from('out_profiles').update({strike_reset:noShows(pid)}).eq('id',pid),'Cleared.');break;
  case'pass':await run(sb.from('out_profiles').update({pass_until:S.profiles[pid].pass_until?null:'2026-12-31'}).eq('id',pid));break;
  case'resolve':await run(sb.from('out_reports').update({status:'resolved'}).eq('id',id));break;
  case'hapEdit':S.hapEditing=id;S.hapDraft={...S.haps[id]};render(true);$('#hapForm').scrollIntoView();break;
  case'hapCancel':S.hapEditing=null;S.hapDraft=null;render(true);break;
  case'hapDel':if(sure(b,'Tap again to delete')){const h=S.hapEditing;S.hapEditing=null;S.hapDraft=null;await run(sb.from('out_happenings').delete().eq('id',h),'Deleted.')}break;
  case'csv':{const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=[['Plan','City','Starts','Name','WhatsApp','Status','Amount','Paid','Arrived','Home safe','Rating','Note'].map(q).join(',')];
    list('rsvps').forEach(r=>{const x=S.events[r.event_id];if(!x)return;const f=S.feedback[r.id]||{};rows.push([x.title,x.city,x.starts_at,pname(r.user_id),(S.privates[r.user_id]||{}).phone,r.status,r.amount,r.paid?'yes':'no',r.checked_in_at||'',r.home_safe_at||'',f.rating||'',f.note||''].map(q).join(','))});
    copy(rows.join('\n'),'Copied. Paste it into a spreadsheet.');break}
  }
});
function toggleWant(w,addOnly){const p=me();if(!p){location.hash='#me';return}const s=new Set(p.wants||[]);if(s.has(w)&&!addOnly)s.delete(w);else s.add(w);
  if(s.size>30){toast('Your list is full. Remove one first.');return}run(sb.from('out_profiles').update({wants:[...s]}).eq('id',S.uid))}
document.addEventListener('change',ev=>{const t=ev.target;if(t.id==='city'){S.city=t.value;try{localStorage.setItem('out-city',S.city)}catch(x){}render(true);return}if(t.dataset&&t.dataset.pick){t.checked?S.pick.add(t.dataset.pick):S.pick.delete(t.dataset.pick)}});
document.addEventListener('input',ev=>{const f=ev.target.form;if(!f)return;const o=Object.fromEntries(new FormData(f));
  if(f.id==='evForm'){o.women_only=!!o.women_only;o.partner=!!o.partner;S.draft={...(S.draft||{}),...o}}
  else if(f.id==='meForm'){o.is_woman=!!o.is_woman;S.meDraft=o}
  else if(f.id==='askForm')S.askDraft={...S.askDraft,...o};
  else if(f.id==='hapForm')S.hapDraft=o;});
document.addEventListener('focusout',()=>setTimeout(()=>{if(S.dirty&&!typing())render()},60));

document.addEventListener('submit',async ev=>{
  ev.preventDefault();const f=ev.target,fd=new FormData(f),g=k=>String(fd.get(k)||'').trim();
  if(f.id==='authForm'){const email=g('email'),password=g('pw');
    if(S.authMode==='up'){const r=await sb.auth.signUp({email,password,options:{emailRedirectTo:BASE}});if(r.error){toast(r.error.message);return}
      if(!r.data.session){S.authMode='in';render(true);toast('Check your email to confirm, then sign in here.')}}
    else{const r=await sb.auth.signInWithPassword({email,password});if(r.error)toast(r.error.message)}}
  else if(f.id==='newPw'){const r=await sb.auth.updateUser({password:g('pw')});if(r.error){toast(r.error.message);return}S.recovery=false;toast('Password saved.');render(true)}
  else if(f.id==='meForm'){const base=me();const row={name:g('name'),city:g('city'),age_band:g('age_band'),is_woman:!!fd.get('is_woman')};
    S.city=row.city;try{localStorage.setItem('out-city',S.city)}catch(x){}
    if(base){const r=await run(sb.from('out_profiles').update(row).eq('id',S.uid));if(!r)return}
    else{let inv=null;try{const c=localStorage.getItem('out-invite');if(c){const o=await sb.rpc('out_code_owner',{code:c});inv=o.data||null}}catch(x){}
      const r=await sb.from('out_profiles').insert({id:S.uid,...row,ref_note:g('ref_note')||null,invited_by:inv});if(r.error){toast(r.error.message);return}}
    const pr=await sb.from('out_private').upsert({id:S.uid,phone:g('phone'),tc_name:g('tc_name'),tc_phone:g('tc_phone')});if(pr.error){toast(pr.error.message);return}
    S.meDraft=null;await loadAll();toast(base?'Profile saved.':"Welcome! The host will message you on WhatsApp to verify.");location.hash='#plans'}
  else if(f.id==='wantForm'){const w=g('w');if(w){toggleWant(w,true);f.reset()}}
  else if(f.id==='askForm'){const d=S.askDraft||{},inv=d.invite||[];
    const r=await run(sb.from('out_asks').insert({city:S.city,what:g('what'),when_at:fromInput(g('when')),place:g('place'),budget:g('budget')||null,seats:+g('seats')||1,ring:inv.length?'invite':(g('ring')||'everyone'),invite:inv,hap_id:d.hap||null}),inv.length?'Invitation sent.':'Posted.');
    if(r){S.askDraft=null;S.askOpen=false}render(true)}
  else if(f.id==='circleForm'){const mem=[S.uid,...S.pick];if(mem.length<2){toast('Tick at least one person first.');return}
    if(await run(sb.from('out_circles').insert({name:g('name'),city:S.city,members:mem}),'Circle started.'))S.pick=new Set()}
  else if(f.classList.contains('nextForm'))await run(sb.from('out_circles').update({next_plan:{what:g('what'),when_at:fromInput(g('when')),place:g('place'),going:[S.uid],set_by:S.uid}}).eq('id',f.dataset.c),"Plan set. Copy the reminder for your circle's WhatsApp group.");
  else if(f.dataset.report){const k=f.dataset.report.split(':');if(await run(sb.from('out_reports').insert({about:k[0]==='p'?k[1]:k[2],ask_id:k[0]==='a'?k[1]:null,why:g('why')}),'Sent to the host. Thank you.')){S.reportOpen=null;render(true)}}
  else if(f.dataset.askfb)await run(sb.from('out_ask_fb').upsert({ask_id:f.dataset.askfb,meet_again:fd.getAll('again').map(String),rating:+fd.get('rating')||null}),'Thanks. If it\'s mutual, they\'ll show up in My people.');
  else if(f.dataset.fb){const r=S.rsvps[f.dataset.fb];await run(sb.from('out_feedback').upsert({rsvp_id:r.id,event_id:r.event_id,user_id:S.uid,meet_again:fd.getAll('again').map(String),rating:+fd.get('rating')||null,note:g('note')||null}),'Answers saved.')}
  else if(f.id==='evForm'){const want=(S.draft||{}).want;const row={title:g('title'),city:g('city'),kind:g('kind'),starts_at:fromInput(g('starts_at')),venue:g('venue')||null,area:g('area')||null,cap:+g('cap')||6,fee:+g('fee')||0,budget:g('budget')||null,ages:g('ages'),women_only:!!fd.get('women_only'),partner:!!fd.get('partner'),notes:g('notes')||null};
    const r=await run(S.editing?sb.from('out_events').update(row).eq('id',S.editing):sb.from('out_events').insert(row),'Plan saved.');
    if(r){if(want&&!S.editing){const n=await sb.rpc('out_notify_wanters',{want,in_city:row.city,msg:`A plan for "${want}" is up: ${row.title}, ${fmtDay(row.starts_at)}. Grab a spot!`,lnk:'#plans'});if(!n.error)toast(`Plan saved. ${n.data} people were told.`)}
      S.editing=null;S.draft=null;render(true)}}
  else if(f.id==='setForm')await run(sb.from('out_settings').update({first_fee:+g('first_fee')||0,pass_price:+g('pass_price')||0,pay_info:g('pay_info')||null,pass_note:g('pass_note')||null}).eq('id',1),'Saved.');
  else if(f.id==='hapForm'){const id=S.hapEditing||('h-'+Date.now().toString(36));const row={id,title:g('title'),city:g('city'),venue:g('venue')||null,start_date:g('start_date'),end_date:g('end_date')||null,price:g('price')||null,link:/^https:\/\//.test(g('link'))?g('link'):null,note:g('note')||null};
    if(await run(sb.from('out_happenings').upsert(row),'Listing saved.')){S.hapEditing=null;S.hapDraft=null;render(true)}}
});
window.addEventListener('hashchange',()=>{render(true);window.scrollTo(0,0);if(location.hash==='#notes'&&S.notes.some(n=>!n.read))sb.from('out_notes').update({read:true}).eq('user_id',S.uid).eq('read',false).then(()=>loadAll())});
window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();installEvt=ev;render()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.uid)loadAll()});
setInterval(()=>{if(!document.hidden&&S.uid&&!typing())loadAll()},30000);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});

/* ---------- start ---------- */
render(true);
(async()=>{
  if(!CFG.supabaseUrl||!window.supabase)return;
  sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey);
  sb.auth.onAuthStateChange((evt,session)=>{if(evt==='PASSWORD_RECOVERY')S.recovery=true;const u=session&&session.user?session.user.id:null;
    if(u!==S.uid){S.uid=u;S.loaded=false;render(true);setTimeout(loadAll,0)}else render(true)});
  const {data}=await sb.auth.getSession();S.uid=data.session?data.session.user.id:null;await loadAll();
})();
window.__outside={S,render};
})();
