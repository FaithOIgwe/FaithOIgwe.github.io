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
const typing=()=>{const a=document.activeElement;return a&&$('#app').contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)};
const VIEWS=['plans','down','around','people','me','host','notes'];
function view(){const h=location.hash.slice(1);if(h.startsWith('ask-'))return'down';if(h==='host'&&!S.admin)return'plans';return VIEWS.includes(h)?h:'plans'}
function render(force){
  if(!force&&typing()){S.dirty=true;return}S.dirty=false;
  const signed=!!S.uid;$('#nav').hidden=!signed;$('#bell').hidden=!signed;$('#hostTab').hidden=!S.admin;
  const unread=S.notes.filter(n=>!n.read).length;$('#bell').textContent=unread?`${unread} new`:'Updates';$('#bell').classList.toggle('hot',!!unread);
  document.querySelectorAll('[data-city]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.city===S.city));
  const v=view();document.querySelectorAll('#nav a').forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')==='#'+v?'page':'false'));
  const app=$('#app');
  if(!CFG.supabaseUrl){app.innerHTML='<div class="empty"><h2>Almost there</h2><p>Add your Supabase Project URL and anon key to config.js (see SETUP.md).</p></div>';return}
  if(!S.loaded){app.innerHTML='<p class="mute">Loading…</p>';return}
  if(S.recovery){app.innerHTML=vRecovery();return}
  if(!signed){app.innerHTML=vLanding();return}
  if(!me()&&v!=='me'){app.innerHTML=vMe();return}
  app.innerHTML=({plans:vPlans,down:vDown,around:vAround,people:vPeople,me:vMe,host:vHost,notes:vNotes})[v]();
}

/* ---------- landing & auth ---------- */
function vLanding(){
  const hs=list('haps').filter(h=>h.city===S.city&&(h.end_date||h.start_date)>=today()).sort((a,b)=>a.start_date.localeCompare(b.start_date)).slice(0,4);
  const up=S.authMode==='up';
  return`<section class="hero"><h2>We outside.</h2><p>Want to go somewhere and your friends can't make it? Outside finds you people who are down: small groups, public places, verified members.</p></section>
  <div class="split"><form id="authForm" class="form card"><h3>${up?'Join Outside':'Welcome back'}</h3>
   <label class="fld">Email<input type="email" name="email" required autocomplete="email"></label>
   <label class="fld">Password<input type="password" name="pw" required minlength="8" autocomplete="${up?'new-password':'current-password'}"></label>
   <div class="row"><button class="btn">${up?'Create account':'Sign in'}</button><button type="button" class="link" data-act="authMode">${up?'I already have an account':'I need an account'}</button></div>
   ${up?'':'<button type="button" class="link" data-act="forgot">Forgot password?</button>'}
   ${localStorage.getItem('out-invite')?'<p class="small ok-text">You were invited by a member, so verification is quicker.</p>':''}</form>
  <div><h3 class="h3" style="margin-top:0">How it works</h3><ol class="steps"><li><b>Say what you want to do.</b> Brunch, a concert, a run, a quiet reading hour.</li><li><b>Verified people who are free join you.</b> Everyone is checked on a short video call first.</li><li><b>Click with someone? Keep it going.</b> When you both want to meet again, start a circle and plan the next one together.</li><li><b>Meet at a public place.</b> Check in when you arrive and tap "home safe" when you're back.</li></ol>
  ${hs.length?`<h3 class="h3">Happening in ${e(S.city)}</h3><ul class="list">${hs.map(h=>`<li><b>${e(h.title)}</b> <span class="mute">${e(fmtDay(h.start_date+'T12:00'))}</span></li>`).join('')}</ul>`:''}</div></div>
  <p class="small mute">By joining you agree to the <a href="privacy.html">privacy notice and community rules</a>.</p>`;
}
function vRecovery(){return`<form id="newPw" class="form card"><h3>Choose a new password</h3><label class="fld">New password<input type="password" name="pw" required minlength="8" autocomplete="new-password"></label><div><button class="btn">Save password</button></div></form>`}

/* ---------- plans ---------- */
function feed(){
  const ids=new Set(Object.keys(S.people));list('circles').forEach(c=>c.members.forEach(m=>{if(m!==S.uid)ids.add(m)}));
  const lines=[];
  list('rsvps').forEach(r=>{const ev=S.events[r.event_id];if(ids.has(r.user_id)&&ev&&!isPast(ev)&&r.status!=='cancelled'&&ev.city===S.city)lines.push({t:ev.starts_at,h:`<b>${e(pname(r.user_id))}</b> is going to ${e(ev.title)}`,go:'#plans'})});
  list('asks').forEach(a=>{if(a.by_user!==S.uid&&ids.has(a.by_user)&&!askPast(a)&&a.status==='open')lines.push({t:a.when_at,h:`<b>${e(pname(a.by_user))}</b> wants company: ${e(a.what)}`,go:'#ask-'+a.id})});
  lines.sort((a,b)=>String(a.t).localeCompare(String(b.t)));
  return lines.length?`<section class="card feed"><h3>Your people are going</h3><ul class="list">${lines.slice(0,6).map(l=>`<li>${l.h} <span class="mute">· ${e(fmtDay(l.t))}</span> <a href="${l.go}">See</a></li>`).join('')}</ul></section>`:'';
}
function vPlans(){
  const evs=events().filter(x=>x.city===S.city),up=evs.filter(x=>!isPast(x)),past=evs.filter(isPast);
  const fb=past.filter(x=>{const r=myR(x.id);return r&&r.checked_in_at&&!S.feedback[r.id]});
  const haps=list('haps').filter(h=>h.city===S.city&&(h.end_date||h.start_date)>=today()).length;
  const pass=S.settings.pass_price>0?`<div class="card pass"><b>December Pass: ${naira(S.settings.pass_price)}</b> ${e(S.settings.pass_note||'Every hosted plan until 31 December.')} <span class="small">Pay${payText()?': '+payText():' with the link below'}, then send your receipt to the host on WhatsApp.</span><div class="row">${payBtn()}</div></div>`:'';
  return`${feed()}${fb.length?`<h2 class="h">How did it go?</h2><div class="tickets">${fb.map(ticket).join('')}</div>`:''}
  <h2 class="h">Hosted plans in ${e(S.city)}</h2>${pass}
  <div class="tickets">${up.map(ticket).join('')||`<div class="empty"><h3>No hosted plans in ${e(S.city)} yet</h3><p>Ask who's down, or see what's on this month.</p><div class="row"><a class="btn" href="#down">Ask who's down</a>${haps?`<a class="btn ghost" href="#around">${haps} things happening</a>`:''}</div></div>`}</div>
  ${past.length?`<details class="past"><summary>Past plans (${past.length})</summary><div class="tickets">${past.map(ticket).join('')}</div></details>`:''}`;
}
function ticket(ev){
  const rs=active(ev.id),n=rs.length,cap=ev.cap,d=dt(ev.starts_at),wl=rsvpsOf(ev.id).length-n;
  return`<article class="ticket"><div class="stub"><b>${d.getDate()}</b><span>${e(d.toLocaleDateString('en-GB',{month:'short'}))} · ${e(d.toLocaleDateString('en-GB',{weekday:'short'}))}</span><span>${e(fmtTime(ev.starts_at))}</span></div>
  <div class="body"><p class="kind">${e(KINDS[ev.kind]||'Plan')}${ev.partner?' · <span class="badge ok">Outside spot</span>':''}</p><h3>${e(ev.title)}</h3>
  <p class="meta">${e(ev.venue||'Public venue to be confirmed')}${ev.area?' · '+e(ev.area):''}, ${e(ev.city)}</p>
  <p class="meta">${ev.women_only?'Women only':'All genders'} · ${e(ev.ages||'Any adult age')}${ev.budget?' · Budget '+e(ev.budget):''}</p>
  <div class="meter"><i style="width:${Math.min(100,n/cap*100)}%"></i></div>
  <p class="small">${n} of ${cap} spots taken${n?' · '+rs.slice(0,6).map(x=>e(pname(x.user_id))).join(', '):''}${wl?` · ${wl} on the waitlist`:''}</p>${ev.notes?`<p class="small mute">${e(ev.notes)}</p>`:''}
  ${actions(ev,myR(ev.id),n,cap)}</div></article>`;
}
function actions(ev,r,n,cap){
  const id=e(ev.id),p=me(),g=gate(false);
  if(!r||r.status==='cancelled'){
    if(isPast(ev))return'';if(g)return`<p class="small mute">${g}</p>`;
    if(strikes(S.uid)>=2)return'<p class="small mute">Joining is paused after two no-shows. Message the host to sort it out.</p>';
    if(ev.women_only&&!p.is_woman)return'<button class="btn" disabled>Women-only plan</button>';
    if(ev.women_only&&!p.verified)return'<button class="btn" disabled>Women-only plans need a verified profile</button>';
    const first=!list('rsvps').some(x=>x.user_id===S.uid&&x.paid);
    return`<div class="row"><button class="btn" data-act="join" data-id="${id}">${n>=cap?'Join the waitlist':"I'm in"}</button>${first&&S.settings.first_fee>0?`<span class="small mute">First plan: ${naira(Math.max(ev.fee,S.settings.first_fee))} to hold your spot</span>`:ev.fee?`<span class="small mute">${naira(ev.fee)} to hold your spot</span>`:''}</div>`;
  }
  let h='';
  if(r.status==='waitlist')h='<div class="step"><b>You\'re on the waitlist.</b> If a spot opens, it\'s yours and we\'ll let you know here.</div>';
  else if(!r.paid)h=r.sent?'<div class="step"><b>Payment sent.</b> The host will confirm your spot soon.</div>'
    :`<div class="step"><b>Hold your spot:</b> send ${naira(r.amount)}. ${payText()||(payBtn()?'':'The host will send payment details on WhatsApp.')} This one-time fee keeps flakes out and keeps Outside running.<div class="row">${payBtn()}<button class="btn ghost" data-act="sent" data-id="${id}">I've paid</button></div></div>`;
  else if(!r.checked_in_at)h=`<div class="step ok"><b>You're confirmed.</b> ${isLive(ev)?'Tap when you get there.':'Check-in opens 3 hours before the start.'}<div class="row">${isLive(ev)?`<button class="btn" data-act="arrive" data-id="${id}">I've arrived</button>`:''}<button class="btn ghost" data-act="share" data-id="${id}">Copy plan for my trusted contact</button><button class="btn ghost" data-act="cardEv" data-id="${id}">Share to Status</button></div></div>`;
  else{h=`<div class="step ok"><b>Checked in at ${e(fmtTime(r.checked_in_at))}.</b>${r.home_safe_at?` Home safe at ${e(fmtTime(r.home_safe_at))}.`:`<div class="row"><button class="btn" data-act="safe" data-id="${id}">I'm home safe</button></div>`}</div>`;
    h+=S.feedback[r.id]?'<p class="small">Thanks. If someone you picked also picked you, you\'ll find each other in My people.</p>':feedbackForm(ev,r)}
  if(!r.checked_in_at&&!isPast(ev))h+=`<button class="link" data-act="leave" data-id="${id}">I can't make it</button>`;
  return h;
}
function feedbackForm(ev,r){
  const others=rsvpsOf(ev.id).filter(x=>x.user_id!==S.uid&&x.checked_in_at);
  return`<form class="fb" data-fb="${e(r.id)}"><p style="margin:0"><b>Would you meet them again?</b> Only the host sees your answers. You're matched only when it's mutual.</p>
  ${others.length?others.map(o=>`<label class="chk"><input type="checkbox" name="again" value="${e(o.user_id)}"> ${e(pname(o.user_id))}</label>`).join(''):'<p class="small mute">No one else has checked in yet. Come back later.</p>'}
  <fieldset class="stars"><legend>How was it, out of 5?</legend>${[1,2,3,4,5].map(n=>`<label><input type="radio" name="rating" value="${n}"><span>${n}</span></label>`).join('')}</fieldset>
  <label class="fld">Anything we should change?<textarea name="note" rows="2" maxlength="300"></textarea></label><div><button class="btn">Save answers</button></div></form>`;
}

/* ---------- who's down ---------- */
function vDown(){
  const p=me(),g=gate(true),d=S.askDraft||{},mine=new Set(p.wants||[]),pool={};
  const focus=location.hash.startsWith('#ask-')?location.hash.slice(5):null;
  const end=new Date();end.setHours(23,59,0,0);const wk=new Date();wk.setDate(wk.getDate()+((7-wk.getDay())%7));wk.setHours(23,59,0,0);
  let asks=list('asks').filter(a=>!askPast(a)&&a.status==='open'&&(a.by_user===S.uid||a.city===S.city));
  if(S.filter==='tonight')asks=asks.filter(a=>dt(a.when_at)<=end);if(S.filter==='weekend')asks=asks.filter(a=>dt(a.when_at)<=wk);
  asks.sort((a,b)=>a.when_at.localeCompare(b.when_at));
  const fa=focus&&S.asks[focus];
  list('profiles').filter(x=>x.city===S.city).forEach(x=>(x.wants||[]).forEach(w=>{const k=String(w).trim();if(k)pool[k]=(pool[k]||0)+1}));
  const all=[...new Set([...WANTS,...Object.keys(pool)])].sort((a,b)=>(pool[b]||0)-(pool[a]||0)),max=Math.max(1,...Object.values(pool));
  const known=Object.keys(S.people).length>0;const inv=(d.invite||[]).length?`<p class="small"><b>Inviting:</b> ${d.invite.map(x=>e(pname(x))).join(', ')} <button type="button" class="link" data-act="clearInvite">Send wider instead</button></p>`:'';
  const form=g?`<p class="step">${g}</p>`:`<form id="askForm" class="form grid2"><label class="fld span2">What do you want to do?<input name="what" required maxlength="100" value="${e(d.what)}" placeholder="Cinema on Saturday night"></label>
   <label class="fld">When<input type="datetime-local" name="when" required value="${e(d.when)}"></label>
   <label class="fld">Where (a public place)<input name="place" required maxlength="100" value="${e(d.place)}" placeholder="Ceddi Plaza cinema"></label>
   <label class="fld">Budget per person<input name="budget" maxlength="40" value="${e(d.budget)}" placeholder="₦5,000–₦10,000"></label>
   <label class="fld">How many people?<select name="seats">${[1,2,3,4,5,6,8].map(n=>`<option ${+(d.seats||3)===n?'selected':''}>${n}</option>`).join('')}</select></label>
   ${(d.invite||[]).length?'':known?`<label class="fld span2">Who can see it?<select name="ring">${['everyone','met','circles'].map(k=>`<option value="${k}" ${(d.ring||'everyone')===k?'selected':''}>${k==='circles'?'Only my circles':k==='met'?"Only people I've met":'Everyone verified in '+e(S.city)}</option>`).join('')}</select></label>`:`<input type="hidden" name="ring" value="everyone"><p class="small span2" style="margin:0"><b>Everyone verified in ${e(S.city)} will see this.</b> After you meet, you'll each say if you'd hang out again. When it's mutual, they become your people and you can start a circle.</p>`}
   <div class="span2">${inv}<p class="small mute" style="margin:0">Meet in a public place and send your plan to your trusted contact.</p></div>
   <div class="row span2"><button class="btn">Ask who's down</button><button type="button" class="btn ghost" data-act="tonight">Tonight, 7pm</button></div></form>`;
  return`${fa?`<h2 class="h">Invitation</h2>${askSafe(fa)}`:focus?'<div class="step">This invitation isn\'t open to you yet. Ask the person to invite you directly, or meet them at a hosted plan first.</div>':''}
  <h2 class="h">Who's down?</h2><p class="lede">Want to do something and your friends can't make it? Put it out there. Verified members in ${e(S.city)} who are free can join you.</p>
  ${pending()}
  ${form}
  <div class="row sec"><h2 class="h" style="margin:0;flex:1">Open invitations</h2><div class="chips" role="group" aria-label="When">${[['all','All'],['tonight','Tonight'],['weekend','This weekend']].map(([k,l])=>`<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${S.filter===k}">${l}</button>`).join('')}</div></div>
  ${asks.filter(a=>a.id!==focus).map(askSafe).join('')||'<p class="mute">Nothing open right now. Be the first to ask.</p>'}
  <h2 class="h sec">Things people want to do, but haven't, because they have no one to go with</h2>
  <p class="lede">Tap what you'd do with company. When enough people want the same thing, it becomes a hosted plan.</p>
  <ul class="wants">${all.map(w=>{const n=pool[w]||0,on=mine.has(w);return`<li><button class="want ${on?'on':''}" data-act="want" data-w="${e(w)}" aria-pressed="${on}"><span>${e(w)}</span><em>${n?n+(n===1?' person in ':' people in ')+e(S.city):'Be the first'}</em><i class="bar" style="width:${n/max*100}%"></i></button>${p.verified?`<button class="link" data-act="askThis" data-w="${e(w)}">Ask who's down</button>`:''}</li>`}).join('')}</ul>
  <form id="wantForm" class="inline"><label class="fld">Something else<input name="w" maxlength="60" placeholder="e.g. Try pottery"></label><button class="btn">Add</button></form>`;
}
function pending(){
  const due=list('asks').filter(a=>dt(a.when_at)<new Date()&&Date.now()-dt(a.when_at)<14*864e5&&(a.joins||[]).length&&(a.by_user===S.uid||(a.joins||[]).includes(S.uid))&&!S.askFb[a.id]);
  return due.map(a=>{const crew=[a.by_user,...a.joins].filter(x=>x!==S.uid);return`<form class="card fb" data-askfb="${e(a.id)}"><p style="margin:0"><b>How was "${e(a.what)}"?</b> Would you hang out with them again? Only you see your answer; it counts only when it's mutual.</p>
  ${crew.map(x=>`<label class="chk"><input type="checkbox" name="again" value="${e(x)}"> ${e(pname(x))}</label>`).join('')}
  <fieldset class="stars"><legend>Out of 5</legend>${[1,2,3,4,5].map(n=>`<label><input type="radio" name="rating" value="${n}"><span>${n}</span></label>`).join('')}</fieldset><div><button class="btn">Save</button></div></form>`}).join('')}
function askSafe(a){
  const joins=a.joins||[],left=a.seats-joins.length,mineA=a.by_user===S.uid,inA=joins.includes(S.uid),hap=a.hap_id&&S.haps[a.hap_id];
  const widen=mineA&&left>0&&!['everyone','invite'].includes(a.ring)?`<button class="mini" data-act="widen" data-id="${e(a.id)}">Widen to ${a.ring==='circles'?"people I've met":'everyone in '+e(a.city)}</button>`:'';
  return`<article class="card"><div class="rhead"><div><p class="kind">${mineA?'Your invitation':e(pname(a.by_user))+' is asking'}${hap?' · '+e(hap.title):''}</p><h3>${e(a.what)}</h3>
  <p class="meta">${e(fmtDay(a.when_at))} · ${e(fmtTime(a.when_at))} · ${e(a.place)}${a.budget?' · Budget '+e(a.budget):''}</p></div><span class="badge ${left>0?'':'ok'}">${left>0?left+' seat'+(left===1?'':'s')+' left':'Full'}</span></div>
  <p class="small mute">Sent to ${e(RINGS[a.ring])}${joins.length?' · Going: '+joins.map(x=>e(pname(x))).join(', '):''}</p>
  ${(mineA||inA)&&joins.length?`<div class="contacts" data-contacts="${e(a.id)}"><button class="mini" data-act="contacts" data-id="${e(a.id)}">Show WhatsApp numbers</button></div>`:''}
  <div class="row">${mineA?`${widen}<button class="mini" data-act="cardAsk" data-id="${e(a.id)}">Share to Status</button>${joins.length?`<button class="mini" data-act="askIntro" data-id="${e(a.id)}">Copy group intro</button>`:''}<button class="mini" data-act="closeAsk" data-id="${e(a.id)}">Close</button>`
   :inA?`<button class="mini" data-act="unjoin" data-id="${e(a.id)}">I can't make it</button>`:left>0&&!gate(true)?`<button class="btn" data-act="joinAsk" data-id="${e(a.id)}">I'm down</button>`:''}
   <button class="mini" data-act="copyLink" data-id="${e(a.id)}">Copy link</button>${mineA?'':`<button class="link" data-act="report" data-k="a:${e(a.id)}:${e(a.by_user)}">Report</button>`}</div>${reportForm('a:'+a.id+':'+a.by_user)}</article>`;
}
function reportForm(k){return S.reportOpen===k?`<form class="fb" data-report="${e(k)}"><label class="fld">What happened? Only the host sees this.<textarea name="why" required rows="3" maxlength="500"></textarea></label><div class="row"><button class="btn">Send report</button><button type="button" class="btn ghost" data-act="report" data-k="${e(k)}">Cancel</button></div></form>`:''}

/* ---------- happening ---------- */
function vAround(){
  const hs=list('haps').filter(h=>h.city===S.city&&(h.end_date||h.start_date)>=today()).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  return`<h2 class="h">Happening in ${e(S.city)}</h2><p class="lede">December plans you don't have to do alone. Find someone to go with, meet first at a public spot, and enjoy it together.</p>
  ${hs.map(h=>{const d=dt(h.start_date+'T12:00'),lf=list('asks').filter(a=>a.hap_id===h.id&&!askPast(a)&&a.status==='open').length;
   return`<article class="card hap"><div class="date"><b>${d.getDate()}</b><span>${e(d.toLocaleDateString('en-GB',{month:'short',weekday:'short'}))}</span></div><div>
   <h3>${e(h.title)}</h3><p class="meta">${h.end_date?`${e(fmtDay(h.start_date+'T12:00'))} to ${e(fmtDay(h.end_date+'T12:00'))} · `:''}${e(h.venue||'Venue to be announced')}</p>
   ${h.price?`<p class="meta">${e(h.price)}</p>`:''}${h.note?`<p class="small mute">${e(h.note)}</p>`:''}
   <div class="row">${lf?`<span class="badge hot">${lf} looking for company</span>`:''}<button class="btn" data-act="hapAsk" data-id="${e(h.id)}">Find someone to go with</button>${/^https:\/\//.test(h.link||'')?`<a class="link" href="${e(h.link)}" target="_blank" rel="noopener">Details</a>`:''}</div></div></article>`}).join('')||'<p class="mute">Nothing listed yet.</p>'}
  <p class="small mute">Dates come from news reports and organisers' announcements. Check with the organiser before you buy tickets.</p>`;
}

/* ---------- my people ---------- */
function vPeople(){
  const g=gate(false);if(g)return`<h2 class="h">My people</h2><p class="step">${g}</p>`;
  const cs=list('circles').filter(c=>c.members.includes(S.uid)),ids=Object.keys(S.people).sort((a,b)=>(S.people[b].mutual?1:0)-(S.people[a].mutual?1:0)||S.people[b].times-S.people[a].times);
  const mutual=ids.filter(x=>S.people[x].mutual&&!cs.some(c=>c.members.includes(x)));
  const suggest=mutual.length?`<div class="card suggest"><h3>Start a circle?</h3><p>You and ${mutual.map(x=>e(pname(x))).join(', ')} both said you'd meet again. A circle keeps you planning together: one person picks the next outing, everyone taps "I'm in".</p><div class="row"><button class="btn" data-act="suggestCircle" data-ids="${e(mutual.join(','))}">Start a circle with them</button></div></div>`:'';
  return`<h2 class="h">Your circles</h2>${suggest}${cs.map(circleCard).join('')||(suggest?'':`<div class="empty"><h3>How circles happen</h3><ol class="steps"><li><b>Go out once.</b> Join a hosted plan or say "I'm down" to someone's invitation.</li><li><b>Say who you'd see again.</b> After you meet, Outside asks privately.</li><li><b>When it's mutual, start a circle.</b> Then your circle plans the next thing together.</li></ol><div class="row"><a class="btn" href="#down">See who's going out</a></div></div>`)}
  <h2 class="h sec">People you've met</h2>
  ${ids.length?`<ul class="people">${ids.map(pid=>{const x=S.people[pid];return`<li class="person"><label class="who"><input type="checkbox" data-pick="${e(pid)}" ${S.pick.has(pid)?'checked':''} aria-label="Pick ${e(pname(pid))}">${av(pid)}<span><b>${e(pname(pid))}</b> ${x.mutual?'<span class="badge ok">You both want to meet again</span>':''}<br><span class="small mute">Met ${x.times} time${+x.times===1?'':'s'} · last: ${e(x.last_what)}</span></span></label>
    <div class="row" style="margin:0"><button class="mini" data-act="invite" data-p="${e(pid)}">Invite to something</button><button class="link" data-act="report" data-k="p:${e(pid)}">Report</button></div>${reportForm('p:'+pid)}</li>`}).join('')}</ul>
   <form id="circleForm" class="inline"><label class="fld">Start a circle with the people you ticked<input name="name" required maxlength="40" placeholder="Sunday readers"></label><button class="btn">Start circle</button></form>`
  :"<p class=\"mute\">After you check in at a plan or meet through Who's down, the people you met show up here.</p>"}`;
}
function circleCard(c){
  const mem=c.members,hist=c.history||[],host=mem[(c.host_idx||0)%mem.length],n=c.next_plan,going=n&&n.going||[],last=hist[hist.length-1];
  let next;
  if(!n)next=`<div class="step"><b>${host===S.uid?"You're picking this time.":e(pname(host))+' is picking this time.'}</b> Anyone can set the next plan.
    <form class="inline nextForm" data-c="${e(c.id)}"><label class="fld">What<input name="what" required maxlength="80" placeholder="Brunch, then a walk"></label><label class="fld">When<input type="datetime-local" name="when" required></label><label class="fld">Where<input name="place" required maxlength="80"></label><button class="btn">Set the plan</button></form></div>`;
  else{const happened=Date.now()>dt(n.when_at).getTime();
    next=`<div class="step ok"><b>Next: ${e(n.what)}</b><br>${e(fmtDay(n.when_at))} · ${e(fmtTime(n.when_at))} · ${e(n.place)}<br><span class="small">${going.length?'Going: '+going.map(x=>e(pname(x))).join(', '):'No one has confirmed yet.'}</span>
    <div class="row">${happened?`<button class="btn" data-act="cDone" data-c="${e(c.id)}">We met!</button><button class="mini" data-act="cSkip" data-c="${e(c.id)}">It didn't happen</button>`
     :going.includes(S.uid)?`<button class="mini" data-act="cOut" data-c="${e(c.id)}">I can't make it</button>`:`<button class="btn" data-act="cIn" data-c="${e(c.id)}">I'm in</button>`}
     ${happened?'':`<button class="mini" data-act="cSeat" data-c="${e(c.id)}">Open a spare seat</button><button class="mini" data-act="cCopy" data-c="${e(c.id)}">Copy WhatsApp reminder</button>`}</div></div>`}
  return`<article class="card"><div class="rhead"><div><h3>${e(c.name)}</h3><p class="small mute">${mem.map(x=>e(pname(x))).join(', ')} · ${e(c.city)}</p></div><span class="badge ${hist.length?'ok':''}">${hist.length} meetup${hist.length===1?'':'s'} together</span></div>
  ${last?`<p class="small">Last time: ${e(last.what)}, ${e(fmtDay(last.when_at))}</p>`:''}<div class="contacts" data-ccontacts="${e(c.id)}"><button class="mini" data-act="ccontacts" data-c="${e(c.id)}">Show WhatsApp numbers</button></div>${next}
  <button class="link" data-act="leaveCircle" data-c="${e(c.id)}">Leave circle</button></article>`;
}

/* ---------- notifications ---------- */
function vNotes(){
  return`<h2 class="h">Updates</h2>${S.notes.length?`<ul class="people">${S.notes.map(n=>`<li class="person ${n.read?'':'unread'}"><span>${e(n.body)}<br><span class="small mute">${e(fmtDay(n.created_at))} · ${e(fmtTime(n.created_at))}</span></span>${/^#[a-z0-9-]+$/i.test(n.link||'')?`<a class="mini" href="${e(n.link)}">Open</a>`:''}</li>`).join('')}</ul>`:'<p class="mute">Nothing yet. When someone joins your invitation, invites you, or a spot opens up, it shows here.</p>'}
  <p class="small mute">Add Outside to your home screen (see Me) so it's one tap away.</p>`;
}

/* ---------- me ---------- */
function vMe(){
  const base=me(),pv=S.privates[S.uid]||{},p=S.meDraft||{...(base||{}),phone:pv.phone,tc_name:pv.tc_name,tc_phone:pv.tc_phone};
  const mine=list('rsvps').filter(r=>r.user_id===S.uid&&r.checked_in_at).length,cs=list('circles').filter(c=>c.members.includes(S.uid)).length,met=Object.keys(S.people).length;
  const status=!base?'<p class="step">Tell us a bit about you. The host checks every new member on a 2-minute WhatsApp video call before women-only plans and invitations open up.</p>'
    :base.suspended?'<p class="step"><b>Paused.</b> Message the host on WhatsApp.</p>':base.verified?'<p class="step ok"><b>Verified.</b> You can join any plan and post invitations.</p>'
    :'<p class="step"><b>Waiting for verification.</b> The host will message you on WhatsApp for a 2-minute video call.</p>';
  const inv=S.invites&&base?`<div class="card"><h3>Invite your people</h3><p class="small">Members who join with your link show as vouched for by you, and get verified faster. You have ${Math.max(0,3-S.invites.used)} of 3 invites left.</p><div class="row"><button class="btn" data-act="copyInvite">Copy my invite link</button></div></div>`:'';
  return`<h2 class="h">${base?'Your profile':'Join Outside'}</h2>${status}
  ${base?`<div class="tiles wrap"><div class="tile"><span>Plans you've been to</span><b>${mine}</b></div><div class="tile"><span>People you've met</span><b>${met}</b></div><div class="tile"><span>Circles</span><b>${cs}</b></div></div><div class="row"><button class="btn ghost" data-act="cardWrap">Share my December so far</button></div>`:''}
  <form id="meForm" class="form">
  <label class="fld">First name<input name="name" required maxlength="40" value="${e(p.name)}" autocomplete="given-name"></label>
  <label class="fld">WhatsApp number (only the host and people you make plans with see this)<input name="phone" required inputmode="tel" minlength="5" maxlength="20" value="${e(p.phone)}" placeholder="080…"></label>
  <label class="fld">City<select name="city" required>${CITIES.map(x=>`<option ${(p.city||S.city)===x?'selected':''}>${x}</option>`).join('')}</select></label>
  <label class="fld">Age range<select name="age_band" required><option value="">Choose</option>${AGES.map(a=>`<option ${p.age_band===a?'selected':''}>${a}</option>`).join('')}</select></label>
  <label class="chk"><input type="checkbox" name="is_woman" ${p.is_woman?'checked':''}> I'm a woman. This lets you join women-only plans after verification.</label>
  <label class="fld">Trusted contact's name<input name="tc_name" required maxlength="40" value="${e(p.tc_name)}"></label>
  <label class="fld">Trusted contact's number (only the host sees this)<input name="tc_phone" required inputmode="tel" maxlength="20" value="${e(p.tc_phone)}"></label>
  ${base?'':`<label class="fld">Who invited you? (optional)<input name="ref_note" maxlength="60" value="${e(p.ref_note)}"></label>`}
  <label class="chk"><input type="checkbox" name="adult" required ${base?'checked':''}> I'm 18 or older.</label>
  <label class="chk"><input type="checkbox" name="rules" required ${base?'checked':''}> I agree to the community rules below and the <a href="privacy.html">privacy notice</a>.</label>
  <div><button class="btn">${base?'Save profile':'Join Outside'}</button></div></form>
  ${inv}
  <div class="card"><h3>Put Outside on your phone</h3>${installEvt?'<div class="row"><button class="btn" data-act="install">Install Outside</button></div>':''}<p class="small"><b>iPhone:</b> open this page in Safari, tap Share, then "Add to Home Screen".<br><b>Android:</b> in Chrome, tap the menu (three dots), then "Install app" or "Add to Home screen".</p></div>
  <h3 class="h3">Community rules</h3><ol class="rules">${RULES.map(r=>`<li>${e(r)}</li>`).join('')}</ol>
  <h3 class="h3">How safety works</h3><ul class="list"><li>Every member gives a WhatsApp number and a trusted contact, and the host verifies each person on a short video call.</li><li>Members vouch for the people they invite.</li><li>There's no private messaging before you meet, and first meetups happen only at public places, in small groups.</li><li>You check in when you arrive and tap "home safe" when you're back.</li><li>Reports go straight to the host, who can pause or remove anyone.</li></ul>
  ${base?'<div class="row"><button class="btn ghost" data-act="signout">Sign out</button></div>':''}`;
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
  return`<h2 class="h">Pilot scorecard</h2>
  <div class="tiles">${tile('Members',ppl.length,ppl.filter(x=>x.verified).length+' verified')}${tile('Plan sign-ups',rs.length,paid.length+' paid')}${tile('Show-up rate',pc(due.filter(r=>r.checked_in_at).length,due.length),'Target 80%',showRate==null?null:showRate>=.8)}${tile('Want to meet again',again==null?'—':Math.round(again*100)+'%','Target 40%',again==null?null:again>=.4)}${tile('Home safe',pc(came.filter(r=>r.home_safe_at).length,came.length),'of attendees')}${tile('Average rating',rated.length?(rated.reduce((s,f)=>s+f.rating,0)/rated.length).toFixed(1)+'/5':'—')}${tile('Circles',list('circles').length)}${tile('Open invitations',list('asks').filter(a=>!askPast(a)&&a.status==='open').length)}${tile('Fees collected',naira(revenue))}${tile('Payments to check',owed,'people say they paid')}</div>
  ${openRep.length?`<h2 class="h sec">Reports to review <span class="badge hot">${openRep.length}</span></h2>${openRep.map(r=>`<div class="card"><p><b>${e(pname(r.by_user))}</b> reported <b>${e(pname(r.about))}</b>${r.ask_id&&S.asks[r.ask_id]?` about "${e(S.asks[r.ask_id].what)}"`:''} · ${e(fmtDay(r.created_at))}</p><p>${e(r.why)}</p><div class="row"><button class="mini" data-act="suspend" data-p="${e(r.about)}">${(S.profiles[r.about]||{}).suspended?'Unpause':'Pause'} ${e(pname(r.about))}</button><button class="mini" data-act="resolve" data-id="${e(r.id)}">Mark resolved</button></div></div>`).join('')}`:''}
  ${ready.length?`<h2 class="h sec">Ready to plan in ${e(S.city)}</h2><p class="small mute">Four or more people want these. Create the plan and everyone who wants it gets told.</p><ul class="people">${ready.map(([w,n])=>`<li class="person"><span><b>${e(w)}</b> · ${n} people</span><button class="mini" data-act="mkplan" data-w="${e(w)}">Create plan and tell them</button></li>`).join('')}</ul>`:''}
  <h2 class="h sec">Members</h2><p class="small mute">Verify each person on a 2-minute WhatsApp video call: check the face matches, and ask who invited them.</p>
  ${sorted.length?`<div class="scroll"><table><thead><tr><th>Name</th><th>City</th><th>WhatsApp</th><th>Trusted contact</th><th>Invited by</th><th>Verified</th><th>No-shows</th><th>Pass</th><th>Status</th></tr></thead><tbody>${sorted.map(p=>{const c=S.privates[p.id]||{},sk=strikes(p.id);
    return`<tr><td>${e(p.name)}${p.is_woman?' <span class="mute">(woman)</span>':''}${p.age_band?' · '+e(p.age_band):''}</td><td>${e(p.city)}</td><td>${e(c.phone||'—')}</td><td>${c.tc_name?e(c.tc_name)+' '+e(c.tc_phone||''):'—'}</td><td>${p.invited_by?e(pname(p.invited_by))+' (member)':e(p.ref_note||'—')}</td>
    <td><button class="mini ${p.verified?'on':''}" aria-pressed="${p.verified}" data-act="verify" data-p="${e(p.id)}">${p.verified?'Verified':'Verify'}</button></td>
    <td>${sk}${sk?` <button class="mini" data-act="clearStrikes" data-p="${e(p.id)}">Clear</button>`:''}</td><td><button class="mini ${p.pass_until?'on':''}" data-act="pass" data-p="${e(p.id)}">${p.pass_until?'Has pass':'Give pass'}</button></td><td><button class="mini" data-act="suspend" data-p="${e(p.id)}">${p.suspended?'Paused: unpause':'Pause'}</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="mute">No members yet.</p>'}
  <h2 class="h sec">${S.editing?'Edit plan':'New hosted plan'}</h2>
  <form id="evForm" class="form grid2">
  <label class="fld span2">Title<input name="title" required maxlength="80" value="${e(d.title)}" placeholder="Saturday brunch & new friends"></label>
  <label class="fld">City<select name="city">${CITIES.map(x=>`<option ${(d.city||S.city)===x?'selected':''}>${x}</option>`).join('')}</select></label>
  <label class="fld">Type<select name="kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}" ${d.kind===k?'selected':''}>${v}</option>`).join('')}</select></label>
  <label class="fld">Date and time<input type="datetime-local" name="starts_at" required value="${e(d.starts_at)}"></label>
  <label class="fld">Spots<input type="number" name="cap" min="2" max="50" value="${e(d.cap||6)}"></label>
  <label class="fld">Venue<input name="venue" maxlength="80" value="${e(d.venue)}" placeholder="Name of a public venue"></label>
  <label class="fld">Area<input name="area" maxlength="40" value="${e(d.area)}" placeholder="Wuse 2 / Lekki Phase 1"></label>
  <label class="fld">Budget per person<input name="budget" maxlength="40" value="${e(d.budget)}" placeholder="₦8,000–₦15,000"></label>
  <label class="fld">Fee for returning members (₦)<input type="number" name="fee" min="0" step="100" value="${e(d.fee??0)}"></label>
  <label class="fld">Ages<select name="ages">${['Any adult age',...AGES.map(a=>'Ages '+a)].map(a=>`<option ${d.ages===a?'selected':''}>${a}</option>`).join('')}</select></label>
  <label class="chk"><input type="checkbox" name="women_only" ${d.women_only?'checked':''}> Women only</label>
  <label class="chk"><input type="checkbox" name="partner" ${d.partner?'checked':''}> Partner venue (shows as an "Outside spot")</label>
  <label class="fld span2">Notes for guests<input name="notes" maxlength="200" value="${e(d.notes)}" placeholder="What to bring, dress code, how to find us"></label>
  <div class="row span2"><button class="btn">${S.editing?'Save changes':'Create plan'}</button>${S.editing||S.draft?'<button type="button" class="btn ghost" data-act="cancelEdit">Cancel</button>':''}${S.editing?'<button type="button" class="link" data-act="delEv">Delete plan</button>':''}</div></form>
  ${events().filter(x=>x.city===S.city).map(roster).join('')||`<p class="mute">No hosted plans in ${e(S.city)}.</p>`}
  <h2 class="h sec">Money settings</h2>
  <form id="setForm" class="form grid2"><label class="fld">First-plan fee (₦)<input type="number" name="first_fee" min="0" step="100" value="${e(st.first_fee)}"></label>
  <label class="fld">December Pass price (₦, 0 hides it)<input type="number" name="pass_price" min="0" step="500" value="${e(st.pass_price||0)}"></label>
  <label class="fld span2">How to pay (a Paystack link starting with https://, or bank details)<input name="pay_info" maxlength="300" value="${e(st.pay_info)}"></label>
  <label class="fld span2">Pass description<input name="pass_note" maxlength="200" value="${e(st.pass_note)}" placeholder="Every hosted plan until 31 December."></label>
  <div class="span2"><button class="btn">Save money settings</button></div></form>
  <h2 class="h sec">${S.hapEditing?'Edit listing':'Add something happening'}</h2>
  <form id="hapForm" class="form grid2"><label class="fld span2">Name<input name="title" required maxlength="100" value="${e(hd.title)}"></label>
  <label class="fld">City<select name="city">${CITIES.map(x=>`<option ${(hd.city||S.city)===x?'selected':''}>${x}</option>`).join('')}</select></label>
  <label class="fld">Venue<input name="venue" maxlength="80" value="${e(hd.venue)}"></label>
  <label class="fld">Date<input type="date" name="start_date" required value="${e(hd.start_date)}"></label><label class="fld">Ends (optional)<input type="date" name="end_date" value="${e(hd.end_date)}"></label>
  <label class="fld">Price<input name="price" maxlength="60" value="${e(hd.price)}"></label><label class="fld">Link (https)<input name="link" maxlength="300" value="${e(hd.link)}"></label>
  <label class="fld span2">Note<input name="note" maxlength="140" value="${e(hd.note)}"></label>
  <div class="row span2"><button class="btn">${S.hapEditing?'Save listing':'Add listing'}</button>${S.hapEditing?'<button type="button" class="btn ghost" data-act="hapCancel">Cancel</button><button type="button" class="link" data-act="hapDel">Delete listing</button>':''}</div></form>
  <ul class="list">${list('haps').filter(h=>h.city===S.city).sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(h=>`<li>${e(h.start_date)} · ${e(h.title)} <button class="mini" data-act="hapEdit" data-id="${e(h.id)}">Edit</button></li>`).join('')}</ul>
  <div class="row"><button class="btn ghost" data-act="csv">Copy plan data as CSV</button></div>`;
}
function tog(r,f,on,label){return`<button class="mini ${on?'on':''}" aria-pressed="${on}" data-act="tog" data-f="${f}" data-r="${e(r.id)}">${label}</button>`}
function roster(ev){
  const rs=rsvpsOf(ev.id),past=isPast(ev),gs=groupsFor(ev.id);
  const saved=new Set(list('circles').filter(c=>c.from_event===ev.id).map(c=>c.members.slice().sort().join(',')));
  const rows=rs.map(r=>{const p=S.profiles[r.user_id]||{},f=S.feedback[r.id];
    return`<tr><td>${e(p.name||'Someone')}${p.verified?'':' <span class="mute">(not verified)</span>'}${r.status==='waitlist'?' <span class="badge">waitlist</span>':''}</td><td>${e((S.privates[r.user_id]||{}).phone||'—')}</td>
    <td>${naira(r.amount)} ${tog(r,'paid',r.paid,r.paid?'Paid':'Not paid')}${r.sent&&!r.paid?' <span class="badge hot">says paid</span>':''}</td><td>${tog(r,'checked_in_at',!!r.checked_in_at,r.checked_in_at?e(fmtTime(r.checked_in_at)):'No')}</td>
    <td>${r.home_safe_at?e(fmtTime(r.home_safe_at)):r.checked_in_at?'<span class="badge hot">not yet</span>':'—'}</td><td>${f?`${(f.meet_again||[]).length} yes · ${f.rating||'—'}/5${f.note?' · '+e(f.note):''}`:'—'}</td>
    <td><button class="mini" data-act="remove" data-r="${e(r.id)}">Remove</button></td></tr>`}).join('');
  return`<section class="roster"><div class="rhead"><div><h3>${e(ev.title)}</h3><p class="small mute">${e(fmtDay(ev.starts_at))} · ${e(fmtTime(ev.starts_at))} · ${active(ev.id).length} of ${ev.cap}</p></div><button class="btn ghost" data-act="edit" data-id="${e(ev.id)}">Edit</button></div>
  ${rs.length?`<div class="scroll"><table><thead><tr><th>Name</th><th>WhatsApp</th><th>Payment</th><th>Arrived</th><th>Home safe</th><th>Meet again · rating</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="mute small">No one yet.</p>'}
  ${gs.length?`<div class="circles"><h4>Mutual matches</h4>${gs.map((g,i)=>`<div class="circle"><span>${g.map(x=>e(pname(x))).join(', ')}</span>${saved.has(g.join(','))?'<span class="badge ok">Circle saved</span>':`<button class="mini" data-act="saveCircle" data-ev="${e(ev.id)}" data-c="${i}">Save as circle</button>`}</div>`).join('')}</div>`:past?'<p class="small mute">No mutual matches yet.</p>':''}</section>`;
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
function goAsk(d){S.askDraft=d;location.hash='#down';render(true);setTimeout(()=>{const f=$('#askForm');if(f){f.scrollIntoView({block:'center'});f.elements.what.focus()}},40)}
function sure(b,msg){if(b.dataset.sure)return true;b.dataset.sure=1;b.textContent=msg;return false}
async function showContacts(box,args){const r=await sb.rpc('out_crew_contacts',args);if(r.error){toast(r.error.message);return}
  box.innerHTML=(r.data||[]).length?(r.data||[]).map(x=>`<a class="mini" href="https://wa.me/${e(String(x.phone).replace(/\D/g,'').replace(/^0/,'234'))}" target="_blank" rel="noopener">${e(x.name)}: ${e(x.phone)}</a>`).join(' '):'<span class="small mute">No numbers yet.</span>'}

document.addEventListener('click',async ev=>{
  const cb=ev.target.closest('[data-city]');if(cb){S.city=cb.dataset.city;try{localStorage.setItem('out-city',S.city)}catch(x){}render(true);return}
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
document.addEventListener('change',ev=>{const t=ev.target;if(t.dataset&&t.dataset.pick){t.checked?S.pick.add(t.dataset.pick):S.pick.delete(t.dataset.pick)}});
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
    if(r)S.askDraft=null;render(true)}
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
