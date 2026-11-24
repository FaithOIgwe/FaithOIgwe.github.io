{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ---------- STATE ---------- */
const KEY='cahier-fr-v1';
const tk=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const addDays=(k,n)=>{const d=new Date(k+'T12:00');d.setDate(d.getDate()+n);return tk(d)};
const diffDays=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);
const DEF=()=>({plan:{start:'A1',target:'B2',exam:addDays(tk(),270),min:60,dpw:6,cls:0,type:'canada',mode:'normal'},done:{},srs:{},nt:{d:'',n:0},log:{},rate:0.9,drafts:{},mine:[],t:0});
let S=DEF();
try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&typeof raw==='object'){S=Object.assign(DEF(),raw);S.plan=Object.assign(DEF().plan,raw.plan||{})}}catch(e){}
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const save=()=>{S.t=Date.now();persist();cloudQueue()};
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2600)};
const fmtDate=k=>new Date(k+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

/* ---------- SPEECH ---------- */
const hasTTS='speechSynthesis' in window;let VOICE=null,playId=0;
const voiceScore=v=>{const n=(v.name||'')+' '+(v.voiceURI||'');let sc=0;if(/^fr[-_]FR/i.test(v.lang))sc+=40;else if(/^fr/i.test(v.lang))sc+=20;else return -1;
  if(/premium|enhanced|natural|neural|siri|online/i.test(n))sc+=50;else if(/google/i.test(n))sc+=30;
  if(/compact|espeak/i.test(n))sc-=30;if(v.localService===false)sc+=5;return sc};
const frVoices=()=>{try{return speechSynthesis.getVoices().filter(v=>voiceScore(v)>=0).sort((a,b)=>voiceScore(b)-voiceScore(a))}catch(e){return[]}};
const pickVoice=()=>{const vs=frVoices();VOICE=vs.find(v=>v.voiceURI===S.voice)||vs[0]||null};
if(hasTTS){pickVoice();try{speechSynthesis.onvoiceschanged=()=>{pickVoice();if(location.hash==='#sounds'&&!document.getElementById('vpick'))route()}}catch(e){}}
/* Audio order: 1) a native speaker's clip recorded in the Voice studio, 2) a real speaker from Lingua Libre (words),
   3) the device's French voice as a fallback. Human clips are looked up in advance so playback starts inside the tap. */
const CLIPS={};let CUR=null;
const LLK='cahier-ll-v1';let LL={};try{LL=JSON.parse(localStorage.getItem(LLK)||'{}')||{}}catch(e){}
const LLQ=new Set();
function credit(h){const c=document.getElementById('credit');if(!c)return;clearTimeout(credit.t);if(!h){c.hidden=true;return}
  c.innerHTML=h.kind==='ll'?`Real voice: ${esc(h.sp)} · <a href="${esc(h.pg)}" target="_blank" rel="noopener">Lingua Libre, CC BY-SA 4.0</a>`:`Real voice: ${esc(h.sp)}`;c.hidden=false;credit.t=setTimeout(()=>{c.hidden=true},6000)}
function stopAudio(){if(CUR){const c=CUR;CUR=null;try{c.a.pause()}catch(e){}c.res()}}
function humanFor(t){const k=String(t).trim();if(CLIPS[k])return CLIPS[k];const l=LL[k];return l?Object.assign({kind:'ll'},l):null}
function tts(t,rate,res){if(!hasTTS){toast('This browser has no speech voice.');return res()}
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='fr-FR';if(VOICE)u.voice=VOICE;u.rate=rate||S.rate;u.onend=res;u.onerror=res;speechSynthesis.speak(u)}catch(e){res()}}
const say=(t,rate)=>new Promise(res=>{stopAudio();if(hasTTS)try{speechSynthesis.cancel()}catch(e){}
  const k=String(t).trim(),h=humanFor(k);
  if(h){const a=new Audio(h.u);let started=false;CUR={a,res};a.playbackRate=rate||Math.max(.75,S.rate);try{a.preservesPitch=true}catch(e){}
    a.onplaying=()=>{started=true;credit(h)};a.onended=()=>{if(CUR&&CUR.a===a)CUR=null;res()};
    const fail=()=>{if(started)return;if(CUR&&CUR.a===a)CUR=null;credit(null);tts(k,rate,res)};a.onerror=fail;a.play().catch(fail);return}
  credit(null);tts(k,rate,res);if(!(k in LL))llLookup(k)});
const llKeys=t=>{const w=t.split(',')[0].replace(/\(.*?\)/g,'').replace(/["«»?!.]/g,'').trim().toLowerCase();const out=[w];const m=w.match(/^(?:le|la|les|un|une|des|du|de la|se|s')\s*(.+)$/)||w.match(/^l'(.+)$/);if(m)out.push(m[1].trim());return out.filter(x=>x&&x.split(/\s+/).length<=4)};
async function llLookup(t){if(LLQ.has(t)||t in LL)return;const keys=llKeys(t);if(!keys.length){LL[t]=0;return}LLQ.add(t);
  try{for(const w of keys){const q=`intitle:"LL-Q150 (fra)" intitle:"${w}"`;
      const r=await fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=25&prop=imageinfo&iiprop=url&gsrsearch='+encodeURIComponent(q));
      const j=await r.json(),end=('-'+w+'.wav').toLowerCase(),pre='File:LL-Q150 (fra)-';
      const hit=Object.values((j.query&&j.query.pages)||{}).filter(p=>p.title.startsWith(pre)&&p.title.toLowerCase().endsWith(end)&&p.imageinfo&&p.imageinfo[0]);
      if(hit.length){hit.sort((a,b)=>a.title.localeCompare(b.title));const p=hit[0];LL[t]={u:p.imageinfo[0].url,pg:p.imageinfo[0].descriptionurl,sp:p.title.slice(pre.length,p.title.length-end.length)};break}}
    if(!(t in LL))LL[t]=0;try{localStorage.setItem(LLK,JSON.stringify(LL))}catch(e){}}catch(e){}finally{LLQ.delete(t)}}
async function prefetchVoices(){const want=[...new Set($$('[data-say]').map(b=>b.dataset.say.trim()))].filter(k=>!CLIPS[k]&&!(k in LL)&&llKeys(k).length).slice(0,60);
  let i=0;const worker=async()=>{while(i<want.length){await llLookup(want[i++])}};await Promise.all([worker(),worker(),worker()])}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const playSeq=async(arr,rate)=>{const id=++playId;for(const t of arr){if(id!==playId)return;await say(t,rate);await sleep(350)}};
const SPK='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.6 8.6 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const sb=(t,l)=>`<button class="say" data-say="${esc(t)}" aria-label="Listen: ${esc(l||t)}">${SPK}</button>`;
const voicePicker=()=>{const vs=frVoices();if(!vs.length)return'';return`<h3>Backup voice</h3><p class="small">Used when no real recording exists yet. Your device's voices sound different on each phone and computer; pick the most natural one.</p><div class="row"><select id="vpick" aria-label="French voice">${vs.map(v=>`<option value="${esc(v.voiceURI)}" ${VOICE&&v.voiceURI===VOICE.voiceURI?'selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select><button class="sm" id="vtest">Test</button></div>`};
const voiceNote=()=>hasTTS&&!VOICE?`<p class="note">No French voice was found on this device, so audio may sound English. Add one in your device settings (iPhone: Settings › Accessibility › Spoken Content › Voices › French; Android: Text-to-speech settings).</p>`:'';
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;

/* ---------- HELPERS ---------- */
const norm=s=>String(s).toLowerCase().replace(/[’`]/g,"'").replace(/…/g,' ').replace(/\s+/g,' ').replace(/[.!?;,]+$/,'').trim();
const strip=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'');
const checkAns=(inp,ans)=>{const a=norm(inp),o=ans.split('|').map(norm);if(o.includes(a))return 2;if(o.map(strip).includes(strip(a)))return 1;return 0};
const words=s=>norm(s).replace(/[«»"!?.,;:()]/g,' ').split(/\s+/).filter(Boolean);
function wdiff(exp,got){const A=words(exp),B=words(got),n=A.length,m=B.length;const L=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=strip(A[i])===strip(B[j])?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  let i=0,j=0;const out=[];let good=0;while(i<n){if(j<m&&strip(A[i])===strip(B[j])){const ok=A[i]===B[j];out.push([A[i],ok?'w-ok':'w-acc']);good+=ok?1:.5;i++;j++}else if(j<m&&L[i][j+1]>=L[i+1][j])j++;else{out.push([A[i],'w-miss']);i++}}
  return{html:out.map(([w,c])=>`<span class="${c}">${esc(w)}</span>`).join(' '),score:Math.round(100*good/Math.max(n,1))}}
const sentences=lv=>UNITS.filter(u=>u.lv===lv).flatMap(u=>u.ex.map(e=>({f:e[0],e:e[1],u:u.t})));
let TIMERS=[];const stopTimers=()=>{TIMERS.forEach(clearInterval);TIMERS=[]};
const mmss=s=>Math.floor(s/60)+':'+String(Math.max(0,s)%60).padStart(2,'0');
const seg=(name,items,cur)=>`<div class="seg" role="group">${items.map(([v,l])=>`<button data-${name}="${esc(v)}" aria-pressed="${v===cur}">${esc(l)}</button>`).join('')}</div>`;
function micCheck(target,out){
  if(!SR){out.textContent="Speech recognition isn't available in this browser. Record yourself with your phone's voice memo and compare it with the model.";return}
  try{const r=new SR();r.lang='fr-FR';r.interimResults=false;r.maxAlternatives=1;
    r.onresult=e=>{const said=e.results[0][0].transcript;const d=wdiff(target,said);out.innerHTML=`Heard: <b>${esc(said)}</b><br>${d.html}<br><b>${d.score}%</b> of the words matched.`};
    r.onerror=e=>{out.textContent=(e.error==='not-allowed'||e.error==='service-not-allowed')?'The microphone is blocked in this view. Open the app in its own browser tab, or record yourself on your phone.':'Could not hear you ('+e.error+'). Try again.'};
    r.start();out.textContent='Listening… speak now.'}catch(e){out.textContent='The microphone is not available here.'}}

/* ---------- PLAN MATH ---------- */
function stats(){
  const p=S.plan,li=LV.indexOf(p.start),ti=LV.indexOf(p.target),k=tk();
  let nowH=prevEnd(p.start);UNITS.forEach(u=>{if(LV.indexOf(u.lv)>=li&&S.done[u.id])nowH+=uH(u)});
  const daysRaw=diffDays(k,p.exam),days=Math.max(1,daysRaw),weeks=days/7,studyDays=Math.max(1,Math.round(days*p.dpw/7));
  const needH=Math.max(0,END[p.target]-nowH),classH=p.cls*weeks,selfNeed=Math.max(0,needH-classH);
  const reqMin=Math.ceil(selfNeed*60/studyDays/5)*5;
  const perDay=p.min/60*p.dpw/7+p.cls/7;const projH=nowH+perDay*days;
  const pending=UNITS.filter(u=>{const i=LV.indexOf(u.lv);return i>=li&&i<=ti&&!S.done[u.id]});
  const cur=pending[0]||UNITS.find(u=>LV.indexOf(u.lv)>=li&&!S.done[u.id])||null;
  return{p,nowH,days,daysRaw,studyDays,needH,reqMin,projH,perDay,pending,cur,dpu:Math.max(1,Math.round(studyDays/Math.max(1,pending.length))),ok:needH===0||p.min>=reqMin,exam:daysRaw>=0&&daysRaw<=42}}
function levelAt(h){if(h>=END.C2)return'C2 complete';for(const l of LV){if(h<END[l]){const f=(h-prevEnd(l))/(END[l]-prevEnd(l));return(f<.34?'early ':f<.67?'mid ':'late ')+l}}return'C2'}
function workLevel(){const st=stats();return st.cur?st.cur.lv:S.plan.target}

/* ---------- DAILY SESSION ---------- */
const dayNum=()=>Math.floor(new Date(tk()+'T12:00')/864e5);
function taskFor(lv,seed){const i=LV.indexOf(lv);if(i<2)return 1;if(i===2)return 1+seed%2;return 1+seed%3}
const MODES={normal:{n:'Normal',min:0,d:'One focused session a day, at the minutes you set.'},intensive:{n:'Intensive',min:150,d:'Two sessions a day, morning and evening. About 2½ hours.'},bootcamp:{n:'Bootcamp',min:300,d:'Three sessions a day with immersion. About 5 hours: for a hard final push.'}};
function session(st){
  const mode=MODES[S.plan.mode]?S.plan.mode:'normal',M=S.plan.min,seed=dayNum(),lv=st.cur?st.cur.lv:S.plan.target,dueN=dueCards().length,dow=new Date().getDay();
  const wt=WT[taskFor(lv,seed)-1],sp=ST[taskFor(lv,seed+1)-1];
  const B={
   srs:{t:'Vocabulary review',d:dueN?`${dueN} cards waiting. Say each word aloud before you turn the card.`:'No cards due. Finish today’s lesson to unlock its words.',go:'#words'},
   unit:{t:st.cur?`Lesson ${st.cur.lv}.${st.cur.n}: ${st.cur.t}`:'Revise your weakest unit',d:st.cur?`Read the rule, play every example, do the exercises, then record yourself reading the examples. Plan about ${st.dpu} study day${st.dpu>1?'s':''} on this unit.`:'Pick any unit and redo its exercises without looking at the rule.',go:st.cur?'#u-'+st.cur.id:'#course'},
   drill:{t:'Grammar drill',d:'Ten mixed questions from every unit you have covered. Type the answers without looking back.',go:'#drill'},
   shadow:{t:'Sounds and shadowing',d:`Shadow ${lv} sentences at 0.85×: listen once, speak with the voice, then without the text.`,go:'#shadow'},
   listen:{t:'Listening',d:'Five dictée sentences, then the comprehension questions for your level.',go:'#listen'},
   read:{t:'Reading',d:`Read one ${lv} text aloud and answer its questions in under three minutes.`,go:'#read'},
   write:{t:`Writing: TCF ${wt.t}`,d:`${wt.w[0]}–${wt.w[1]} words, against the timer. « ${wt.p[seed%wt.p.length]} »`,go:'#write'},
   speak:{t:`Speaking: TCF ${sp.t}`,d:`« ${sp.p[seed%sp.p.length]} » Record yourself for the full time, then listen back.`,go:'#speak'},
   record:{t:'Record and compare',d:'Record a shadowing sentence, play the model and your voice back to back, and redo it until they match.',go:'#shadow'},
   immersion:{t:'Immersion',d:'French audio or video with French subtitles: news, a series or a podcast. Add five new expressions to your own words in Mots.',go:'#words'},
   community:{t:'Community',d:'Answer one question or give feedback on one text in the community.',go:'#community'},
   tcf:{t:st.exam?'Exam phase: timed TCF drill':'Timed TCF drill',d:'Do the 18-question structures test against the clock and review every mistake.',go:'#tcf'}};
  let parts;
  if(mode==='normal')parts=[['',[['srs',.13],['unit',st.exam?.15:.25],['shadow',.15],['listen',.14],['read',st.exam?.08:.11],[dow%2?'write':'speak',.22]].concat(st.exam?[['tcf',.12]]:[])]];
  else if(mode==='intensive')parts=[['Morning',[['srs',.07],['unit',.18],['shadow',.08],['listen',.09],['read',.06]]],['Evening',[['drill',.08],['write',.14],['speak',.12],['record',.06],['immersion',.07]].concat(st.exam?[['tcf',.09]]:[])]];
  else parts=[['Morning',[['srs',.05],['unit',.14],['drill',.06],['shadow',.06]]],['Afternoon',[['listen',.08],['read',.07],['write',.12],['tcf',.08]]],['Evening',[['speak',.1],['record',.05],['immersion',.15],['community',.04]]]];
  const tw=parts.reduce((a,p)=>a+p[1].reduce((x,y)=>x+y[1],0),0);
  return parts.map(([name,list])=>({name,blocks:list.map(([id,w])=>Object.assign({id,m:Math.max(5,Math.round(M*w/tw/5)*5)},B[id]))}))}

/* ---------- SRS ---------- */
const IV=[0,1,3,7,14,30,60];
function cardPool(){const st=stats();const ids=new Set(UNITS.filter(u=>S.done[u.id]).map(u=>u.id));if(st.cur)ids.add(st.cur.id);
  const out=[];UNITS.forEach(u=>{if(ids.has(u.id))u.v.forEach(([f,e])=>out.push({f,e,lv:u.lv}))});(S.mine||[]).forEach(([f,e])=>out.push({f,e,lv:'Mine'}));return out}
function dueCards(){const k=tk();if(S.nt.d!==k)S.nt={d:k,n:0};const p=cardPool();
  return p.filter(c=>S.srs[c.f]&&S.srs[c.f].due<=k).concat(p.filter(c=>!S.srs[c.f]).slice(0,Math.max(0,12-S.nt.n)))}
function grade(c,g){const r=S.srs[c.f];if(!r)S.nt.n++;const b=g===0?0:Math.min(6,(r?r.b:0)+(g===2?2:1));S.srs[c.f]={b,due:addDays(tk(),g===0?0:IV[b])};save()}

/* ---------- VIEWS ---------- */
let INIT=null;
function streak(){let n=0,k=tk();if(!(S.log[k]&&Object.values(S.log[k]).some(Boolean)))k=addDays(k,-1);while(S.log[k]&&Object.values(S.log[k]).some(Boolean)){n++;k=addDays(k,-1)}return n}
function ladder(st){return`<div class="ladder">${LV.map(l=>{const lo=prevEnd(l),f=Math.max(0,Math.min(1,(st.nowH-lo)/(END[l]-lo)));return`<div class="rung ${l===S.plan.target?'tg':''}"><b>${l}</b><div class="bar" role="img" aria-label="${l} ${Math.round(f*100)}% covered"><i style="width:${f*100}%"></i></div><span class="small mute">${l===S.plan.target?'target':Math.round(f*100)+'%'}</span></div>`}).join('')}</div>`}

function rToday(){
  const st=stats(),parts=session(st),ses=parts.flatMap(p=>p.blocks),k=tk(),lg=S.log[k]||{},dn=ses.filter(b=>lg[b.id]).length,tot=ses.reduce((a,b)=>a+b.m,0);
  const status=st.daysRaw<0?`<span class="warn">Your exam date has passed. Set the next one in Plan.</span>`:st.needH===0?`<span class="ok">You've covered the course up to ${S.plan.target}. Keep up the timed TCF practice.</span>`:st.ok?`<span class="ok">On track.</span> ${S.plan.target} needs about ${st.reqMin} min a day; you've planned ${S.plan.min}.`:`<span class="warn">Behind.</span> ${S.plan.target} needs about ${st.reqMin} min a day. At ${S.plan.min} min you would reach roughly ${levelAt(st.projH)} by exam day. <a href="#plan">Adjust the plan</a>.`;
  INIT=()=>{$$('[data-blk]').forEach(c=>c.addEventListener('change',()=>{S.log[k]=S.log[k]||{};S.log[k][c.dataset.blk]=c.checked;save();route()}))};
  return`<section class="band"><div class="wrap">
  <div class="row" style="justify-content:space-between;align-items:end"><div><h1>Aujourd'hui</h1><p class="hand">${esc(new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))}</p></div><p class="small" style="max-width:52ch">${status}</p></div>
  <div class="tgrid" style="margin-top:14px">
   <div class="paper session">${parts.map(p=>(p.name?`<p class="hand" style="margin-top:6px">${p.name} · ${p.blocks.reduce((a,b)=>a+b.m,0)} min</p>`:'')+'<ol>'+p.blocks.map(b=>`<li class="blk ${lg[b.id]?'done':''}"><div class="mins">${b.m}<small> min</small></div><div><h3>${esc(b.t)}</h3><p class="small">${esc(b.d)}</p><a class="btn sm" href="${b.go}">Open</a></div><label class="tick"><input type="checkbox" data-blk="${b.id}" ${lg[b.id]?'checked':''}><span></span><b class="sr">Done: ${esc(b.t)}</b></label></li>`).join('')+'</ol>').join('')}
   <p class="small mute" style="margin:10px 0 0">${dn} of ${ses.length} done · ${tot} minutes planned · ${MODES[S.plan.mode||'normal'].n} mode${st.exam?' · exam phase':''}</p></div>
   <aside class="card"><div class="count">J–${st.daysRaw<0?0:st.daysRaw}</div><p>until your ${S.plan.type==='canada'?'TCF Canada':'TCF tout public'} on <b>${fmtDate(S.plan.exam)}</b>. Target <b>${S.plan.target}</b>.</p>
   ${ladder(st)}<p class="small mute" style="margin-top:12px">About ${Math.round(st.nowH)} of ${END[S.plan.target]} study hours covered. Streak: <b>${streak()}</b> day${streak()===1?'':'s'}.</p></aside>
  </div>${voiceNote()}</div></section>`}

let CL=null;
function rCourse(){
  CL=CL||workLevel();const us=UNITS.filter(u=>u.lv===CL),[nm,band,can]=LVINFO[CL],dn=us.filter(u=>S.done[u.id]).length;
  INIT=()=>$$('[data-cl]').forEach(b=>b.onclick=()=>{CL=b.dataset.cl;route()});
  return`<section class="band"><div class="wrap"><h1>Parcours A1 → C2</h1>
  <p>Every grammar point, the core vocabulary and the TCF skills, in order. Mark a unit done when you can do its exercises without looking. Its words then join your review cards.</p>
  ${seg('cl',LV.map(l=>[l,l]),CL)}
  <div class="card" style="margin-bottom:16px"><h2 style="margin-top:0">${CL} · ${nm}</h2><p>${esc(can)}</p><p class="small mute">TCF score band ${band} · about ${END[CL]-prevEnd(CL)} study hours · ${dn} of ${us.length} units done</p></div>
  <div class="units">${us.map(u=>`<a class="card unit ${S.done[u.id]?'dn':''}" href="#u-${u.id}"><span class="n">${S.done[u.id]?'✓':u.n}</span><span><b>${esc(u.t)}</b><br><span class="small mute">${u.ex.length} examples · ${u.v.length} words · ${u.q.length} exercises</span></span></a>`).join('')}</div>
  <p class="small mute" style="margin-top:18px">Hours follow the usual guided-learning estimates for each CEFR level; real progress varies with your classes, practice and exposure.</p></div></section>`}

function rLesson(id){
  const u=UNITS.find(x=>x.id===id);if(!u){location.hash='#course';return''}
  const i=UNITS.indexOf(u),pv=UNITS[i-1],nx=UNITS[i+1];CL=u.lv;
  INIT=()=>{$('#playall').onclick=()=>playSeq(u.ex.map(e=>e[0]));const pd=$('#playdlg');if(pd)pd.onclick=()=>playSeq(DEEP[u.id].dialogue.map(d=>d[1]));
    $$('.q').forEach((q,qi)=>{const inp=$('input',q),fb=$('.fb',q),go=()=>{const r=checkAns(inp.value,u.q[qi][1]);fb.className='fb '+(r===2?'ok':r===1?'warn':'bad');fb.textContent=r===2?'Correct.':r===1?'Almost: check the accents. Answer: '+u.q[qi][1].split('|')[0]:'Not yet. '+(u.q[qi][2]?'Hint: '+u.q[qi][2]+'. ':'')+'Try again or reveal.'};
      $('.chk',q).onclick=go;inp.onkeydown=e=>{if(e.key==='Enter')go()};$('.rev',q).onclick=()=>{fb.className='fb mute';fb.textContent='Answer: '+u.q[qi][1].split('|').join(' or ')}});
    $('#done').onclick=()=>{S.done[u.id]=!S.done[u.id];save();toast(S.done[u.id]?'Unit done. Its words are now in your review cards.':'Marked as not done.');route()}};
  return`<section class="band"><div class="wrap"><a href="#course" class="small">← Parcours ${u.lv}</a>
  <div class="two" style="margin-top:10px"><div class="paper"><p class="hand">${u.lv} · unit ${u.n} of ${CNT[u.lv]}</p><h1>${esc(u.t)}</h1>${deepHTML(u)}
   <h2>Examples</h2><div>${u.ex.map(e=>`<div class="ex">${sb(e[0])}<div><div class="fr" lang="fr">${esc(e[0])}</div><div class="en">${esc(e[1])}</div></div></div>`).join('')}</div>
   <div class="row" style="margin-top:10px"><button id="playall">${SPK} Play all</button><span class="small mute">Then say each one out loud, copying the rhythm.</span></div>
   <h3 style="margin-top:18px">Record yourself reading the examples</h3>${recHTML(u.lv+'.'+u.n+' '+u.t,u.ex.map(e=>e[0]).join(' '))}</div>
   <div><div class="card"><h2 style="margin-top:0">Vocabulary</h2><div class="vocab">${u.v.map(v=>`<div class="vw">${sb(v[0])}<span><b lang="fr">${esc(v[0])}</b><br><span class="small mute">${esc(v[1])}</span></span></div>`).join('')}</div></div>
   <div class="card" style="margin-top:16px"><h2 style="margin-top:0">Practice</h2>${u.q.map(q=>`<div class="q"><p lang="fr"><b>${esc(q[0])}</b></p><div class="row"><input aria-label="Your answer" autocomplete="off" autocapitalize="off" spellcheck="false" lang="fr"><button class="chk sm">Check</button><button class="rev sm">Reveal</button></div><p class="fb" aria-live="polite"></p></div>`).join('')}</div>
   <div class="row" style="margin-top:16px"><button id="done" class="${S.done[u.id]?'':'pri'}">${S.done[u.id]?'Mark as not done':'Mark unit as done'}</button>${pv?`<a class="btn" href="#u-${pv.id}">← Previous</a>`:''}${nx?`<a class="btn" href="#u-${nx.id}">Next →</a>`:''}</div></div></div>
  ${voiceNote()}</div></section>`}

let PQ=null,PS=[0,0];
function rSounds(){
  const groups=[...new Set(SND.map(s=>s[0]))];
  const newPair=()=>{const p=PAIRS[Math.floor(Math.random()*PAIRS.length)];PQ={p,a:Math.round(Math.random()),done:false}};if(!PQ)newPair();
  INIT=()=>{const vp=$('#vpick');if(vp){vp.onchange=()=>{S.voice=vp.value;save();pickVoice()};$('#vtest').onclick=()=>{playId++;stopAudio();credit(null);tts('Bonjour ! Je m\'appelle Claire et j\'apprends le français avec vous.',0,()=>{})}}const draw=()=>{$('#pq').innerHTML=`<p class="small mute">Sounds: ${esc(PQ.p[2])}</p><div class="row"><button class="pri" id="pplay">${SPK} Play the word</button></div><div class="row" style="margin-top:12px">${PQ.p.slice(0,2).map((w,i)=>`<button class="chip" data-pick="${i}" style="font-size:20px;padding:8px 24px" lang="fr">${esc(w)}</button>`).join('')}</div><p class="fb" id="pfb" aria-live="polite"></p><p class="small mute">Score ${PS[0]} / ${PS[1]}</p>`;
      $('#pplay').onclick=()=>{playId++;say(PQ.p[PQ.a],.85)};
      $$('[data-pick]').forEach(b=>b.onclick=()=>{if(PQ.done)return;PQ.done=true;PS[1]++;const ok=+b.dataset.pick===PQ.a;if(ok)PS[0]++;const f=$('#pfb');f.className='fb '+(ok?'ok':'bad');f.innerHTML=(ok?'Right: ':'It was: ')+esc(PQ.p[PQ.a])+` <button class="sm" id="pnext">Next pair</button>`;$('#pnext').onclick=()=>{newPair();draw()}})};draw()};
  return`<section class="band"><div class="wrap"><h1>Les sons du français</h1>
  <p>French has 16 vowel sounds, including four you won't find in English (u, eu, and the nasals). Tap a word to hear it, copy it three times, then test your ear below.</p><p class="small mute">Words play real speakers' recordings from Lingua Libre (CC BY-SA 4.0) where one exists, and sentences play our native speaker's recordings as they are added. The speaker's name appears at the bottom of the screen while it plays. Anything not recorded yet uses your device's French voice.</p>${voiceNote()}
  <div class="two"><div class="card"><h2 style="margin-top:0">Ear training: minimal pairs</h2><div id="pq"></div></div>
  <div class="card"><h2 style="margin-top:0">Speed</h2><p class="small">Applies to all audio in the app.</p>${seg('rate',[['0.7','0.7×'],['0.85','0.85×'],['0.9','0.9×'],['1','1×']],String(S.rate))}${voicePicker()}</div></div>
  ${groups.map(g=>`<h2>${g}</h2><div class="snd">${SND.filter(s=>s[0]===g).map(s=>`<div class="card"><div class="row" style="justify-content:space-between"><span class="ipa">/${esc(s[1])}/</span><span class="mute small">${esc(s[2])}</span></div><p class="small">${esc(s[3])}</p><div class="chips">${s[4].map(w=>`<button class="chip" data-say="${esc(w)}" lang="fr">${esc(w)}</button>`).join('')}</div></div>`).join('')}</div>`).join('')}
  <h2>Linking, rhythm and melody</h2><div class="snd">${RULES.map(r=>`<div class="card"><h3>${esc(r[0])}</h3><p class="small">${esc(r[1])}</p><div class="chips">${r[2].map(w=>`<button class="chip" data-say="${esc(w)}" lang="fr">${esc(w)}</button>`).join('')}</div></div>`).join('')}</div></div></section>`}

let SH=null;
function rShadow(){
  SH=SH||{lv:workLevel(),i:0,rate:.85,show:true,reps:3};const list=sentences(SH.lv);SH.i=Math.min(SH.i,list.length-1);const s=list[SH.i];
  INIT=()=>{$$('[data-shl]').forEach(b=>b.onclick=()=>{SH.lv=b.dataset.shl;SH.i=0;route()});
    $$('[data-shr]').forEach(b=>b.onclick=()=>{SH.rate=+b.dataset.shr;route()});
    $('#shprev').onclick=()=>{SH.i=(SH.i-1+list.length)%list.length;route()};$('#shnext').onclick=()=>{SH.i=(SH.i+1)%list.length;route()};
    $('#shplay').onclick=()=>{playId++;say(s.f,SH.rate)};$('#shtext').onclick=()=>{SH.show=!SH.show;route()};
    $('#shreps').onchange=e=>{SH.reps=+e.target.value};
    $('#shloop').onclick=async()=>{const id=++playId,ph=$('#phase'),gap=Math.round(s.f.length*75/SH.rate)+700;
      for(let r=0;r<SH.reps;r++){if(id!==playId)break;ph.textContent=`Round ${r+1}: speak with the voice`;await say(s.f,SH.rate);if(id!==playId)break;ph.textContent='Your turn: say it alone';await sleep(gap)}if(id===playId)ph.textContent='Done. Try it at 1×, or hide the text.'};
    $('#shmic').onclick=()=>micCheck(s.f,$('#shout'))};
  return`<section class="band"><div class="wrap"><h1>Shadowing</h1>
  <p>Shadowing builds rhythm, linking and speed. Listen once while reading. Then speak <i>at the same time</i> as the voice, a split second behind it. Then hide the text and do it from memory. Exaggerate the melody.</p>${voiceNote()}
  ${seg('shl',LV.map(l=>[l,l]),SH.lv)}
  <div class="two"><div class="paper"><p class="hand">${SH.i+1} / ${list.length} · ${esc(s.u)}</p>
   <p class="big" lang="fr">${SH.show?esc(s.f):'· · · listen · · ·'}</p><p class="mute">${SH.show?esc(s.e):''}</p>
   <div class="row"><button id="shprev" aria-label="Previous sentence">←</button><button id="shplay">${SPK} Listen</button><button id="shloop" class="pri">Shadow ×${SH.reps}</button><button id="shnext" aria-label="Next sentence">→</button></div>
   <p class="phase" id="phase" aria-live="polite"></p></div>
  <div class="card"><h2 style="margin-top:0">Settings</h2><p class="small"><b>Speed</b></p>${seg('shr',[['0.7','0.7×'],['0.85','0.85×'],['1','1×']],String(SH.rate))}
   <div class="row"><button id="shtext">${SH.show?'Hide text (blind)':'Show text'}</button><label class="row" style="font-weight:400">Rounds <select id="shreps">${[1,2,3,5].map(n=>`<option ${n===SH.reps?'selected':''}>${n}</option>`).join('')}</select></label></div>
   <h3 style="margin-top:18px">Record and compare</h3>${recHTML('Shadowing '+SH.lv+': '+s.f,s.f)}<h3 style="margin-top:18px">Automatic check</h3><button id="shmic">Say it and check</button><p class="small" id="shout" aria-live="polite"></p>
   <p class="small mute">The automatic check works best in Chrome. Your recordings are listed on the Oral page.</p></div></div></div></section>`}

let DC=null,LQ={};
function rListen(){
  DC=DC||{lv:workLevel(),i:Math.floor(Math.random()*99)};const pool=sentences(DC.lv),s=pool[DC.i%pool.length];
  const items=LIS.filter(x=>x[0]===DC.lv);
  INIT=()=>{$$('[data-dcl]').forEach(b=>b.onclick=()=>{DC.lv=b.dataset.dcl;route()});
    $('#dplay').onclick=()=>{playId++;say(s.f)};$('#dslow').onclick=()=>{playId++;say(s.f,.7)};
    const chk=()=>{const d=wdiff(s.f,$('#dtxt').value);$('#dres').innerHTML=`<p>${d.html}</p><p><b>${d.score}%</b> · <span class="w-ok">correct</span>, <span class="w-acc">accent or spelling</span>, <span class="w-miss">missed</span></p><p class="mute small">${esc(s.f)}</p>`};
    $('#dchk').onclick=chk;$('#dnext').onclick=()=>{DC.i++;route()};
    $$('.lis').forEach(el=>{const it=items[+el.dataset.i];$('.lp',el).onclick=()=>{playId++;say(it[1])};
      $$('[data-o]',el).forEach(b=>b.onclick=()=>{$$('[data-o]',el).forEach(x=>{x.disabled=true;if(+x.dataset.o===it[4])x.classList.add('right')});if(+b.dataset.o!==it[4])b.classList.add('wrong');$('.tr',el).hidden=false})})};
  return`<section class="band"><div class="wrap"><h1>Écoute</h1>${voiceNote()}${seg('dcl',LV.map(l=>[l,l]),DC.lv)}
  <div class="two"><div class="paper"><h2 style="margin-top:0">Dictée</h2><p class="small">Play the sentence as often as you need and type exactly what you hear, with accents and punctuation.</p>
   <div class="row"><button id="dplay" class="pri">${SPK} Play</button><button id="dslow">Play slowly</button></div>
   <textarea id="dtxt" lang="fr" spellcheck="false" autocapitalize="off" style="min-height:130px;margin-top:12px" aria-label="Type what you hear"></textarea>
   <div class="row"><button id="dchk">Check</button><button id="dnext">Next sentence</button></div><div id="dres" aria-live="polite"></div></div>
  <div class="card"><h2 style="margin-top:0">Comprehension</h2><p class="small">Like the TCF: listen first without reading. The transcript appears after you answer.</p>
   ${items.map((it,i)=>`<div class="lis q" data-i="${i}"><button class="lp sm">${SPK} Play audio ${i+1}</button><p><b lang="fr">${esc(it[2])}</b></p><div class="opts">${it[3].map((o,j)=>`<button data-o="${j}" lang="fr">${esc(o)}</button>`).join('')}</div><p class="tr small mute" lang="fr" hidden>${esc(it[1])}</p></div>`).join('')}</div></div></div></section>`}

let RL=null;
function rRead(){
  RL=RL||workLevel();const r=READ.find(x=>x[0]===RL);
  INIT=()=>{$$('[data-rl]').forEach(b=>b.onclick=()=>{RL=b.dataset.rl;route()});$('#rplay').onclick=()=>{playId++;say(r[2])};
    $$('.rq').forEach((el,qi)=>$$('[data-o]',el).forEach(b=>b.onclick=()=>{const a=r[3][qi][2];$$('[data-o]',el).forEach(x=>{x.disabled=true;if(+x.dataset.o===a)x.classList.add('right')});if(+b.dataset.o!==a)b.classList.add('wrong')}))};
  return`<section class="band"><div class="wrap"><h1>Lecture</h1><p>Read once for the gist, once for detail. Then read it aloud and listen to compare. In the TCF you have about a minute and a half per question.</p>
  ${seg('rl',LV.map(l=>[l,l]),RL)}
  <div class="two"><div class="paper"><p class="hand">${RL} · ${esc(r[1])}</p><p lang="fr" style="font-size:18px;line-height:32px">${esc(r[2])}</p><button id="rplay">${SPK} Listen to the text</button></div>
  <div class="card">${r[3].map((q,i)=>`<div class="rq q"><p><b lang="fr">${esc(q[0])}</b></p><div class="opts">${q[1].map((o,j)=>`<button data-o="${j}" lang="fr">${esc(o)}</button>`).join('')}</div></div>`).join('')}
  <p class="small mute">For more reading at your level, try a French news site written for learners and the official TCF sample tests.</p></div></div></div></section>`}

let W=null;
function rWrite(){
  const seed=dayNum();W=W||{t:taskFor(workLevel(),seed),i:seed};const T=WT[W.t-1],pr=T.p[W.i%T.p.length],key='w'+W.t+'-'+(W.i%T.p.length);
  INIT=()=>{const ta=$('#wtxt'),wc=$('#wc'),upd=()=>{const n=ta.value.trim().split(/\s+/).filter(Boolean).length;wc.textContent=n+' words';wc.className=n<T.w[0]?'warn':n>T.w[1]?'bad':'ok';S.drafts[key]=ta.value;save()};
    ta.value=S.drafts[key]||'';upd();ta.oninput=upd;
    $$('[data-wt]').forEach(b=>b.onclick=()=>{W.t=+b.dataset.wt;route()});$('#wnext').onclick=()=>{W.i++;route()};
    let left=T.min*60,run=false;const tm=$('#wtime');tm.textContent=mmss(left);
    $('#wstart').onclick=e=>{if(run){stopTimers();run=false;e.target.textContent='Resume timer';return}run=true;e.target.textContent='Pause timer';TIMERS.push(setInterval(()=>{left--;tm.textContent=mmss(left);if(left<=0){stopTimers();tm.textContent='Time!';toast('Time is up. Finish your sentence and check the word count.')}},1000))};
    $('#wcopy').onclick=async()=>{const n=ta.value.trim().split(/\s+/).filter(Boolean).length;const txt=`Corrige mon texte pour la ${T.t} de l'expression écrite du TCF (niveau visé : ${S.plan.target}).\nConsigne : ${pr}\n\nMon texte (${n} mots) :\n${ta.value}\n\nDonne-moi une note estimée sur 20 avec le niveau CECR, mes erreurs corrigées et expliquées en anglais, puis une version améliorée au niveau visé.`;
      try{await navigator.clipboard.writeText(txt);toast('Copied. Paste it into Claude for a full correction.')}catch(e){ta.value=txt;ta.select();toast('Copy blocked here: the request is in the box, select and copy it.')}};
    $('#wclear').onclick=()=>{ta.value='';upd()}};
  return`<section class="band"><div class="wrap"><h1>Écriture</h1><p>The TCF written test is 60 minutes for three tasks. A task under the word count, off topic or left blank can sink the whole paper, so always write all three.</p>
  ${seg('wt',WT.map(t=>[String(t.n),t.t]),String(W.t))}
  <div class="two"><div class="paper"><p class="hand">${T.w[0]}–${T.w[1]} words · about ${T.min} min</p><p lang="fr"><b>${esc(pr)}</b></p>
   <textarea id="wtxt" lang="fr" aria-label="Your text"></textarea>
   <div class="row" style="justify-content:space-between"><b id="wc" aria-live="polite"></b><span class="timer" id="wtime"></span></div>
   <div class="row" style="margin-top:8px"><button id="wstart" class="pri">Start timer</button><button id="wcopy">Copy for correction</button><button id="wnext">Another prompt</button><button id="wclear">Clear</button></div>
   <p class="small mute">Your draft saves in this browser as you type.</p></div>
  <div class="card"><h2 style="margin-top:0">${esc(T.t)}</h2><p class="small">${esc(T.d)}</p><h3>Before you hand it in</h3><ul class="small">${T.c.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
   <h3>Useful connectors</h3><div class="chips">${['d\'abord','ensuite','enfin','de plus','cependant','en revanche','par conséquent','c\'est pourquoi','pour ma part','en conclusion'].map(w=>`<button class="chip" data-say="${esc(w)}" lang="fr">${esc(w)}</button>`).join('')}</div></div></div></div></section>`}

let SPk=null;
function rSpeak(){
  const seed=dayNum();SPk=SPk||{t:taskFor(workLevel(),seed+1),i:seed};const T=ST[SPk.t-1],pr=T.p[SPk.i%T.p.length];
  INIT=()=>{$$('[data-spt]').forEach(b=>b.onclick=()=>{SPk.t=+b.dataset.spt;route()});$('#snext').onclick=()=>{SPk.i++;route()};
    $('#sprompt').onclick=()=>{playId++;say(pr)};recList($('#myrecs'));
    $('#sgo').onclick=()=>{stopTimers();let phase=T.prep?'prep':'talk',left=T.prep||T.talk;const tm=$('#stime'),lb=$('#slab');
      const tick=()=>{tm.textContent=mmss(left);lb.textContent=phase==='prep'?'Preparation: notes only, no full sentences':'Speak now. Keep going until the time is up.'};tick();
      TIMERS.push(setInterval(()=>{left--;if(left<0){if(phase==='prep'){phase='talk';left=T.talk;toast('Preparation over. Start speaking.')}else{stopTimers();tm.textContent='0:00';lb.textContent='Finished. How many connectors did you use?';return}}tick()},1000))}};
  return`<section class="band"><div class="wrap"><h1>Oral</h1><p>The TCF speaking test lasts 12 minutes, face to face with an examiner, in three tasks. Practise out loud every time: thinking the answer isn't speaking it.</p>
  ${seg('spt',ST.map(t=>[String(t.n),t.t]),String(SPk.t))}
  <div class="two"><div class="paper"><p class="hand">${T.prep?mmss(T.prep)+' preparation + ':''}${mmss(T.talk)} speaking</p><p class="big" lang="fr">${esc(pr)}</p>
   <div class="row"><button id="sprompt">${SPK} Hear the question</button><button id="sgo" class="pri">Start</button><button id="snext">Another prompt</button></div>
   <div class="row" style="margin-top:10px;align-items:baseline"><span class="timer" id="stime">${mmss(T.prep||T.talk)}</span><span id="slab" class="small" aria-live="polite"></span></div>
   <p class="small mute" id="sout" aria-live="polite"></p></div>
  <div class="card"><h2 style="margin-top:0">${esc(T.t)}</h2><p class="small">${esc(T.d)}</p><h3>Phrases to have ready</h3><div class="chips">${T.ph.map(w=>`<button class="chip" data-say="${esc(w)}" lang="fr">${esc(w)}</button>`).join('')}</div>
   <h3 style="margin-top:16px">Record your answer</h3>${recHTML(T.t+': '+pr,'')}<p class="small mute">Then listen for hesitations, missing liaisons and English vowels. Redo the same prompt tomorrow and compare.</p></div></div><h2>My recordings</h2><div id="myrecs" class="units"><p class="mute">Loading…</p></div></div></section>`}

let Q=null,QI=0,FLIP=false,DIR='fe';
function rWords(){
  if(!Q){Q=dueCards();QI=0;FLIP=false}const c=Q[QI],pool=cardPool();
  INIT=()=>{const fc=$('#fc');if(fc){fc.onclick=()=>{FLIP=true;route();if(DIR==='ef')say(c.f)};fc.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fc.click()}}}
    $$('[data-g]').forEach(b=>b.onclick=()=>{const g=+b.dataset.g;grade(c,g);if(g===0)Q.push(c);QI++;FLIP=false;route();const n=Q[QI];if(n&&DIR==='fe')say(n.f)});
    $$('[data-dir]').forEach(b=>b.onclick=()=>{DIR=b.dataset.dir;FLIP=false;route()});const wr=$('#wreload');if(wr)wr.onclick=()=>{Q=null;route()};$('#addw').onsubmit=e=>{e.preventDefault();const f=e.target.f.value.trim(),en=e.target.e.value.trim();if(!f||!en)return;S.mine=(S.mine||[]).filter(x=>x[0]!==f).concat([[f,en]]);save();Q=null;toast('Added to your review cards.');route()}};
  const front=c?(DIR==='fe'?c.f:c.e):'',back=c?(DIR==='fe'?c.e:c.f):'';
  return`<section class="band"><div class="wrap"><h1>Mots</h1><p>Spaced repetition: words you know come back less and less often; words you miss come back today. Up to 12 new words a day from your current and finished units.</p>
  ${seg('dir',[['fe','French → English'],['ef','English → French']],DIR)}
  <div class="two"><div>${c?`<div class="paper flash" id="fc" role="button" tabindex="0" aria-label="Card: tap to turn"><div><p class="hand">${QI+1} / ${Q.length} · ${c.lv}</p><p class="big" ${DIR==='fe'?'lang="fr"':''}>${esc(front)}</p>${FLIP?`<p class="big" style="color:var(--blue)" ${DIR==='ef'?'lang="fr"':''}>${esc(back)}</p>`:'<p class="mute small">Say it aloud, then tap to turn</p>'}</div></div>
   <div class="row" style="margin-top:12px;justify-content:center">${sb(c.f)}${FLIP?`<button data-g="0">Again</button><button data-g="1" class="pri">Good</button><button data-g="2">Easy</button>`:''}</div>`
   :`<div class="paper"><p class="big">Nothing due right now.</p><p>${pool.length?'Come back tomorrow, or open your current lesson for new words.':'Open your first lesson in Parcours: its words appear here.'}</p><button id="wreload">Check again</button></div>`}</div>
  <div class="card"><h2 style="margin-top:0">Add your own word</h2><form id="addw" class="row"><input name="f" placeholder="en français" lang="fr" required maxlength="80" aria-label="French"><input name="e" placeholder="in English" required maxlength="80" aria-label="English"><button class="pri">Add</button></form><p class="small mute">For words you meet in class, films or podcasts.</p>
  <h2>Your words (${pool.length})</h2><div class="vocab">${pool.slice(-24).reverse().map(v=>`<div class="vw">${sb(v.f)}<span><b lang="fr">${esc(v.f)}</b><br><span class="small mute">${esc(v.e)}</span></span></div>`).join('')}</div>${pool.length>24?'<p class="small mute">Showing the 24 newest.</p>':''}</div></div></div></section>`}

let MK=null;
function rTcf(){
  INIT=()=>{$('#mk').onsubmit=e=>{e.preventDefault();const res={};MOCK.forEach((m,i)=>{const v=$(`input[name=m${i}]:checked`);res[m[0]]=(res[m[0]]||0)+(v&&+v.value===m[3]?1:0)});
      let est=null;for(const l of LV){if(res[l]>=2)est=l;else break}const tot=Object.values(res).reduce((a,b)=>a+b,0);
      MOCK.forEach((m,i)=>{$$(`input[name=m${i}]`).forEach(x=>{const lab=x.parentElement;lab.style.color=+x.value===m[3]?'var(--ok)':x.checked?'var(--red)':''})});
      MK=est;$('#mkres').innerHTML=`<p class="big">${tot} / 18</p><p>${est?`Structures estimate: <b>${est}</b>. A rough guide from 18 questions, not a TCF score.`:'Below A1 on this sample: start at unit A1.1.'}</p>${est?`<button id="mkset" class="pri">Start my plan from ${est==='C2'?'C2':LV[LV.indexOf(est)+1]}</button>`:''}`;
      const b=$('#mkset');if(b)b.onclick=()=>{S.plan.start=est==='C2'?'C2':LV[LV.indexOf(est)+1];if(LV.indexOf(S.plan.target)<LV.indexOf(S.plan.start))S.plan.target=S.plan.start;save();toast('Plan updated.');location.hash='#plan'}};
    $('#mkt').onclick=e=>{stopTimers();let left=900;const t=$('#mktime');TIMERS.push(setInterval(()=>{left--;t.textContent=mmss(left);if(left<=0){stopTimers();toast('Time! Submit now.')}},1000));t.textContent=mmss(left);e.target.disabled=true}};
  return`<section class="band"><div class="wrap"><h1>Le TCF</h1><p>The TCF tests general French, not a syllabus, so the course above plus daily timed practice is the preparation. Check the official France Éducation international page for your centre's dates before you book.</p>
  <div class="two"><div class="card"><h2 style="margin-top:0">Test format</h2>
  <table class="stack"><thead><tr><th>Section</th><th>TCF Canada</th><th>TCF tout public</th></tr></thead><tbody>
  <tr><td>Listening (CO)</td><td>39 questions · 35 min</td><td>29 questions · 25 min</td></tr>
  <tr><td>Language structures</td><td>Not included</td><td>18 questions · 15 min</td></tr>
  <tr><td>Reading (CE)</td><td>39 questions · 60 min</td><td>29 questions · 45 min</td></tr>
  <tr><td>Writing (EE)</td><td>3 tasks · 60 min</td><td>3 tasks · 60 min (optional)</td></tr>
  <tr><td>Speaking (EO)</td><td>3 tasks · 12 min, 2 of them preparation</td><td>3 tasks · 12 min (optional)</td></tr>
  <tr><td>Total</td><td>2 h 47, all four compulsory</td><td>1 h 25 for the compulsory part</td></tr></tbody></table>
  <p class="small mute">Tout public figures are for the paper version; on computer the multiple-choice part has 91 items. Since 1 September 2026, re-marking requests for writing and speaking are suspended for about a year.</p></div>
  <div class="card"><h2 style="margin-top:0">Scores</h2><table><thead><tr><th>Level</th><th class="num">CO, CE, structures</th></tr></thead><tbody>${LV.map(l=>`<tr><td>${l}</td><td class="num">${LVINFO[l][1]}</td></tr>`).join('')}</tbody></table>
  <p class="small">Writing and speaking are marked out of 20. For Canada's Express Entry French category, NCLC 7 means 458 in listening, 453 in reading and 10/20 in writing and speaking.</p>
  <h3>Strategy</h3><ul class="small"><li>Listening and reading get harder as you go: bank the early points, don't stall.</li><li>Read the question before the audio plays and listen for its keywords.</li><li>Writing: do all three tasks within the word counts; a missing task can be marked “A1 not reached”.</li><li>Speaking: develop every answer with a reason and an example.</li></ul></div></div>
  <h2>Mock test: language structures</h2><p>18 questions, three per level, like the tout public structures section. Give yourself 15 minutes.</p>
  <div class="row"><button id="mkt">Start 15-minute timer</button><span class="timer" id="mktime"></span></div>
  <form id="mk" class="card" style="margin-top:12px">${MOCK.map((m,i)=>`<fieldset style="border:0;padding:8px 0;margin:0;border-bottom:1px dashed var(--line)"><legend style="padding:0"><span class="small mute">${i+1}.</span> <b lang="fr">${esc(m[1])}</b></legend><div class="row">${m[2].map((o,j)=>`<label style="font-weight:400;min-height:44px;display:inline-flex;align-items:center;gap:6px"><input type="radio" name="m${i}" value="${j}" style="min-height:auto"> <span lang="fr">${esc(o)}</span></label>`).join('')}</div></fieldset>`).join('')}
  <button class="pri" style="margin-top:14px">See my result</button><div id="mkres" aria-live="polite"></div></form>
  <p class="small"><a href="https://www.france-education-international.fr/test/tcf-canada">Official TCF Canada page</a> · <a href="https://www.france-education-international.fr/test/tcf-tout-public">Official TCF tout public page</a></p></div></section>`}

function rPlan(){
  const p=S.plan;
  const proj=()=>{const st=stats();const rows=LV.filter(l=>END[l]>st.nowH).map(l=>{const d=Math.ceil((END[l]-st.nowH)/st.perDay),k=addDays(tk(),d),before=d<=st.days;return`<tr><td><b>${l}</b>${l===p.target?' (target)':''}</td><td class="num">${fmtDate(k)}</td><td class="${before?'ok':'warn'}">${before?'before exam':'after exam'}</td></tr>`}).join('');
    $('#proj').innerHTML=`<p class="big">${st.needH===0?'Target covered':st.ok?'On track':'Needs more time'}</p>
    <p>${st.needH===0?'You have covered every unit up to your target.':`Reaching <b>${p.target}</b> means about <b>${Math.round(st.needH)} more hours</b>. With ${p.dpw} study days a week${p.cls?` and ${p.cls} class hours`:''}, that is <b>${st.reqMin} minutes a day</b>. You've planned ${p.min}.`}</p>
    ${st.needH&&!st.ok?`<p class="warn">At your current pace you'd reach about ${levelAt(st.projH)} by ${fmtDate(p.exam)}. Raise your daily minutes, add class hours, move the exam date, or aim for a closer target first.</p>`:''}
    <p class="small">${st.pending.length} units left to ${p.target}: about ${(st.pending.length/Math.max(1,st.days/7)).toFixed(1)} units a week, ${st.dpu} study day${st.dpu>1?'s':''} each.</p>
    <table><thead><tr><th>Level</th><th class="num">Projected</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`};
  INIT=()=>{const f=$('#pf'),E=f.elements;f.onsubmit=e=>e.preventDefault();f.oninput=f.onchange=()=>{const nm=E.mode.value;if(nm!==(p.mode||'normal')){p.mode=nm;if(MODES[nm].min&&p.min<MODES[nm].min){p.min=MODES[nm].min;E.min.value=p.min}$('#moded').textContent=MODES[nm].d}p.type=E.type.value;p.exam=E.exam.value||p.exam;p.start=E.start.value;p.target=E.target.value;if(LV.indexOf(p.target)<LV.indexOf(p.start)){p.target=p.start;E.target.value=p.start}
      p.min=+E.min.value;p.dpw=+E.dpw.value;p.cls=Math.max(0,+E.cls.value||0);$('#minv').textContent=p.min+' min';save();proj()};proj();
    $('#bcopy').onclick=async()=>{const code=btoa(unescape(encodeURIComponent(JSON.stringify(S))));try{await navigator.clipboard.writeText(code);toast('Progress code copied. Keep it somewhere safe.')}catch(e){$('#bcode').value=code;$('#bcode').select();toast('Copy blocked: the code is in the box below.')}};
    $('#bload').onclick=()=>{try{const o=JSON.parse(decodeURIComponent(escape(atob($('#bcode').value.trim()))));if(!o||!o.plan)throw 0;S=Object.assign(DEF(),o);S.plan=Object.assign(DEF().plan,o.plan);save();toast('Progress restored.');route()}catch(e){toast('That code is not valid.')}};
    $('#breset').onclick=e=>{if(e.target.dataset.sure){S=DEF();save();toast('Everything reset.');route()}else{e.target.dataset.sure=1;e.target.textContent='Tap again to erase all progress'}}};
  return`<section class="band"><div class="wrap"><h1>Mon plan</h1><p>Tell the app when you sit the TCF and how much time you have. It works out the daily load, your pace through the units and when you should reach each level.</p>
  <div class="two"><form id="pf" class="card form">
   <label>Test<select name="type"><option value="canada" ${p.type==='canada'?'selected':''}>TCF Canada</option><option value="tp" ${p.type==='tp'?'selected':''}>TCF tout public</option></select></label>
   <label>Exam date<input type="date" name="exam" value="${esc(p.exam)}"></label>
   <label>I'm starting at<select name="start">${LV.map(l=>`<option ${l===p.start?'selected':''}>${l}</option>`).join('')}</select></label>
   <label>Target level<select name="target">${LV.slice(1).map(l=>`<option ${l===p.target?'selected':''}>${l}</option>`).join('')}</select></label>
   <label>Study mode<select name="mode">${Object.entries(MODES).map(([k,m])=>`<option value="${k}" ${k===(p.mode||'normal')?'selected':''}>${m.n}</option>`).join('')}</select><span class="small mute" style="font-weight:400" id="moded">${MODES[p.mode||'normal'].d}</span></label>
   <label>Minutes a day <span id="minv" class="mute">${p.min} min</span><input type="range" name="min" min="15" max="360" step="5" value="${p.min}" style="padding:0"></label>
   <label>Study days a week<select name="dpw">${[3,4,5,6,7].map(n=>`<option ${n===p.dpw?'selected':''}>${n}</option>`).join('')}</select></label>
   <label>Class hours a week<input type="number" name="cls" min="0" max="40" step="0.5" value="${p.cls}" inputmode="decimal"></label>
   <p class="small mute" style="grid-column:1/-1">Not sure of your level? Take the 18-question test in the TCF tab. Units below your starting level count as known.</p></form>
  <div class="card" id="proj" aria-live="polite"></div></div>
  <h2>Keep your progress</h2><p class="small">Progress lives in this browser only. Copy your progress code to move it to another device or keep a backup.</p>
  <div class="row"><button id="bcopy">Copy progress code</button><button id="bload">Restore from code</button><button id="breset">Reset everything</button></div>
  <textarea id="bcode" style="min-height:90px;margin-top:10px;line-height:1.4;background-image:none" placeholder="Paste a progress code here to restore it" aria-label="Progress code"></textarea></div></section>`}

/* ---------- RECORDINGS (kept on the device in IndexedDB; copied to the cloud when signed in) ---------- */
const IDB={p:null,open(){return this.p||(this.p=new Promise((res,rej)=>{try{const r=indexedDB.open('cahier',1);r.onupgradeneeded=()=>r.result.createObjectStore('rec',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}))},
  async run(mode,fn){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction('rec',mode),r=fn(t.objectStore('rec'));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})},
  put(o){return this.run('readwrite',s=>s.put(o))},all(){return this.run('readonly',s=>s.getAll())},del(id){return this.run('readwrite',s=>s.delete(id))}};
let REC=null;
const recHTML=(label,model)=>`<div class="rec" data-label="${esc(label)}" data-model="${esc(model||'')}"><div class="row"><button data-rec="start" class="pri">● Record</button><span class="rtime timer" style="font-size:30px"></span></div><div class="rout small" aria-live="polite"></div></div>`;
async function recStart(box){
  recStop();const out=$('.rout',box);
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){out.textContent='Recording is not supported in this browser. Try Chrome, or Safari on iPhone.';return}
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg'].find(m=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(m))||'';
    const mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined),chunks=[];
    mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());recDone(box,new Blob(chunks,{type:(mr.mimeType||mime||'audio/webm')}))};
    mr.start();const btn=$('[data-rec]',box);btn.dataset.rec='stop';btn.textContent='■ Stop';out.textContent='Recording…';
    REC={mr,box,t0:Date.now(),iv:setInterval(()=>{const t=$('.rtime',box);if(t)t.textContent=mmss(Math.round((Date.now()-REC.t0)/1000))},500)};
  }catch(e){out.textContent='The microphone is blocked. Allow microphone access for this site in your browser settings, then try again. (It does not work inside the Claude preview.)'}}
function recStop(){if(!REC)return;clearInterval(REC.iv);const b=$('[data-rec="stop"]',REC.box);if(b){b.dataset.rec='start';b.textContent='● Record again'}try{REC.mr.stop()}catch(e){}REC=null}
function recDone(box,blob){if(!document.body.contains(box))return;box._blob=blob;const model=box.dataset.model,out=$('.rout',box);
  out.innerHTML=box.dataset.key?`<audio controls style="width:100%;margin-top:8px"></audio><div class="row" style="margin-top:6px"><button data-rec="upload" class="sm pri">Use this take</button></div>`:`<audio controls style="width:100%;margin-top:8px"></audio><div class="row" style="margin-top:6px">${model?'<button data-rec="compare" class="sm">Model, then me</button>':''}<button data-rec="save" class="sm">Save recording</button></div>`;
  $('audio',out).src=URL.createObjectURL(blob)}
async function recAction(btn){const box=btn.closest('.rec'),a=btn.dataset.rec;if(!box)return;
  if(a==='start')return recStart(box);if(a==='stop')return recStop();if(a==='upload'&&box._blob)return studioUpload(box,btn);
  if(a==='compare'){const au=$('audio',box);const id=++playId;await say(box.dataset.model);if(id===playId&&au){au.currentTime=0;au.play().catch(()=>{})}return}
  if(a==='save'&&box._blob){const r={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),label:box.dataset.label,model:box.dataset.model,created:new Date().toISOString(),blob:box._blob,mime:box._blob.type};
    try{await IDB.put(r);btn.disabled=true;btn.textContent='Saved';toast(USER?'Saved and backing up to your account.':'Saved on this device.');if(USER)cloudSaveRec(r)}catch(e){toast('Could not save on this device.')}}}
async function recList(el){if(!el)return;let local=[];try{local=await IDB.all()}catch(e){}
  let cloud=[];if(db&&USER){try{const r=await db.from('recordings').select('id,label,created_at,path,mime').order('created_at',{ascending:false}).limit(50);cloud=r.data||[]}catch(e){}}
  const ids=new Set(local.map(r=>r.id));const items=local.map(r=>({id:r.id,label:r.label,created:r.created,blob:r.blob,cloud:cloud.some(c=>c.id===r.id)})).concat(cloud.filter(c=>!ids.has(c.id)).map(c=>({id:c.id,label:c.label,created:c.created_at,path:c.path,cloud:true})));
  items.sort((x,y)=>String(y.created).localeCompare(String(x.created)));
  if(!items.length){el.innerHTML='<p class="mute">No recordings yet. Record yourself in a lesson, in Shadowing or here.</p>';return}
  el.innerHTML=items.map((r,i)=>`<div class="card"><p class="small"><b lang="fr">${esc(r.label||'Recording')}</b><br><span class="mute">${esc(new Date(r.created).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}${r.cloud?' · backed up':''}</span></p><audio controls style="width:100%" data-i="${i}"></audio><div class="row" style="margin-top:6px"><button class="sm" data-del="${i}">Delete</button></div></div>`).join('');
  items.forEach(async(r,i)=>{const au=$(`audio[data-i="${i}"]`,el);if(r.blob)au.src=URL.createObjectURL(r.blob);else if(r.path&&db){try{const {data}=await db.storage.from('recordings').createSignedUrl(r.path,3600);if(data)au.src=data.signedUrl}catch(e){}}});
  $$('[data-del]',el).forEach(b=>b.onclick=async()=>{const r=items[+b.dataset.del];try{await IDB.del(r.id)}catch(e){}if(r.cloud&&db&&USER){const path=r.path||`${USER.id}/${r.id}`;try{await db.storage.from('recordings').remove([path]);await db.from('recordings').delete().eq('id',r.id)}catch(e){}}recList(el)})}

/* ---------- GRAMMAR DRILL ---------- */
let DR=null;
function rDrill(){
  if(!DR){const st=stats();const pool=UNITS.filter(u=>S.done[u.id]||(st.cur&&u.id===st.cur.id)).flatMap(u=>u.q.map(q=>({q,u})));
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}DR={items:pool.slice(0,10),i:0,score:0,checked:false}}
  const head=`<a href="#course" class="small">← Parcours</a><h1>Grammar drill</h1><p>Ten questions mixed from every unit you have covered, so old grammar stays fresh. No rules on screen: retrieve it from memory.</p>`;
  if(!DR.items.length){INIT=null;return`<section class="band"><div class="wrap">${head}<div class="paper"><p>Open your first lesson and the drill will fill up as you go.</p><a class="btn pri" href="#course">Go to Parcours</a></div></div></section>`}
  if(DR.i>=DR.items.length){const sc=DR.score,n=DR.items.length;INIT=()=>{$('#drnew').onclick=()=>{DR=null;route()}};
    return`<section class="band"><div class="wrap">${head}<div class="paper"><p class="count">${sc}/${n}</p><p>${sc>=n*.8?'Strong. Keep moving forward.':sc>=n*.5?'Getting there. Reread the units you missed, then drill again.':'Go back over the units below before you move on.'}</p><button id="drnew" class="pri">New drill</button></div></div></section>`}
  const it=DR.items[DR.i];
  INIT=()=>{const inp=$('#drin'),fb=$('#drfb'),go=()=>{if(DR.checked){DR.i++;DR.checked=false;route();return}const r=checkAns(inp.value,it.q[1]);DR.checked=true;if(r===2)DR.score++;else if(r===1)DR.score+=.5;
      fb.className='fb '+(r===2?'ok':r===1?'warn':'bad');fb.innerHTML=(r===2?'Correct.':r===1?'Almost: watch the accents.':'Not quite.')+` Answer: <b lang="fr">${esc(it.q[1].split('|').join(' or '))}</b>. From <a href="#u-${it.u.id}">${esc(it.u.lv+'.'+it.u.n+' '+it.u.t)}</a>.`;$('#drgo').textContent='Next'};
    $('#drgo').onclick=go;inp.onkeydown=e=>{if(e.key==='Enter')go()};inp.focus()};
  return`<section class="band"><div class="wrap">${head}<div class="paper"><p class="hand">${DR.i+1} / ${DR.items.length} · score ${DR.score}</p><p class="big" lang="fr">${esc(it.q[0])}</p>
  <div class="row"><input id="drin" lang="fr" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Your answer"><button id="drgo" class="pri">Check</button></div><p id="drfb" class="fb" aria-live="polite"></p></div></div></section>`}

/* ---------- CLOUD: accounts, sync, community (Supabase = hosted PostgreSQL) ---------- */
const CFG=window.CAHIER_CONFIG||{},CLOUD_ON=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey);
let db=null,USER=null,PROFILE=null,RECORDER=null,syncT=null,LASTSYNC=null,PWRESET=false;
const loadScript=src=>new Promise((res,rej)=>{const t=document.createElement('script');t.src=src;t.onload=res;t.onerror=rej;document.head.appendChild(t)});
function acctChip(){const a=$('#acct');if(!a)return;a.textContent=!CLOUD_ON?'':USER?(PROFILE?PROFILE.display_name:'My account'):'Sign in';a.hidden=!CLOUD_ON}
async function cloudInit(){acctChip();if(!CLOUD_ON)return;
  try{await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
    db=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey);loadClips();
    db.auth.onAuthStateChange((ev,session)=>{if(ev==='PASSWORD_RECOVERY'){PWRESET=true;location.hash='#account'}setTimeout(()=>onAuth(session),0)});
    const {data}=await db.auth.getSession();await onAuth(data.session)}catch(e){console.warn('cloud',e)}}
async function onAuth(session){const u=session?session.user:null;if((u&&u.id)===(USER&&USER.id))return;USER=u;PROFILE=null;
  RECORDER=null;if(USER){await pullMerge();await loadProfile();try{const r=await db.from('voice_recorders').select('speaker_name').eq('user_id',USER.id).maybeSingle();RECORDER=r.data||null}catch(e){}}acctChip();route()}
async function loadProfile(){try{const {data}=await db.from('profiles').select('*').eq('id',USER.id).maybeSingle();PROFILE=data||null}catch(e){}}
function mergeState(a,b){const n=(b.t||0)>(a.t||0)?b:a,o=n===a?b:a,m=Object.assign(DEF(),o,n);
  m.plan=Object.assign(DEF().plan,n.plan||{});m.done=Object.assign({},o.done,n.done);
  m.srs=Object.assign({},o.srs);for(const k in n.srs||{}){const x=n.srs[k],y=m.srs[k];if(!y||x.b>=y.b)m.srs[k]=x}
  m.log=Object.assign({},o.log);for(const d in n.log||{})m.log[d]=Object.assign({},m.log[d],n.log[d]);
  m.drafts=Object.assign({},o.drafts,n.drafts);const seen=new Set();m.mine=[].concat(n.mine||[],o.mine||[]).filter(x=>!seen.has(x[0])&&seen.add(x[0]));
  m.t=Math.max(a.t||0,b.t||0);return m}
async function pullMerge(){try{const {data}=await db.from('progress').select('state').eq('user_id',USER.id).maybeSingle();if(data&&data.state)S=mergeState(S,data.state);persist();await cloudPush()}catch(e){console.warn(e)}}
async function cloudPush(){if(!db||!USER)return;try{const {error}=await db.from('progress').upsert({user_id:USER.id,state:S,updated_at:new Date().toISOString()});if(!error)LASTSYNC=new Date()}catch(e){}}
function cloudQueue(){if(!db||!USER)return;clearTimeout(syncT);syncT=setTimeout(cloudPush,2000)}
async function cloudSaveRec(r){try{const path=`${USER.id}/${r.id}`;const up=await db.storage.from('recordings').upload(path,r.blob,{contentType:(r.mime||'audio/webm').split(';')[0],upsert:true});if(up.error)throw up.error;
  await db.from('recordings').insert({id:r.id,path,label:(r.label||'').slice(0,300),mime:r.mime});
  const {data}=await db.from('recordings').select('id,path').order('created_at',{ascending:false});if(data&&data.length>30){const old=data.slice(30);await db.storage.from('recordings').remove(old.map(x=>x.path));await db.from('recordings').delete().in('id',old.map(x=>x.id))}}catch(e){toast('Saved on this device; the cloud backup failed.')}}
const ago=d=>{const s=(Date.now()-new Date(d))/1000;return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':Math.floor(s/86400)+' d ago'};
const notReady=what=>`<section class="band"><div class="wrap"><h1>${what}</h1><div class="paper"><p class="big">Coming online soon.</p><p>Accounts and the learner community are being connected. Until then your progress is saved in this browser; use the progress code in Plan to move it between devices.</p></div></div></section>`;

function profileForm(){const p=PROFILE||{};return`<form id="pform" class="card form"><h2 style="grid-column:1/-1;margin:0">${PROFILE?'Your profile':'Create your learner profile'}</h2>
  <label>Display name<input name="display_name" required minlength="2" maxlength="40" value="${esc(p.display_name||'')}" autocomplete="nickname"></label>
  <label>Current level<select name="level">${LV.map(l=>`<option ${l===(p.level||workLevel())?'selected':''}>${l}</option>`).join('')}</select></label>
  <label>Target<select name="target">${LV.slice(1).map(l=>`<option ${l===(p.target||S.plan.target)?'selected':''}>${l}</option>`).join('')}</select></label>
  <label>Exam month<input type="month" name="exam_month" value="${esc(p.exam_month||S.plan.exam.slice(0,7))}"></label>
  <label style="grid-column:1/-1">About you (optional, shown to other learners)<textarea name="bio" maxlength="280" style="min-height:90px;line-height:1.5;background-image:none" placeholder="Why you're learning, what you want to practise">${esc(p.bio||'')}</textarea></label>
  <label style="grid-column:1/-1;display:flex;gap:10px;align-items:center;font-weight:400"><input type="checkbox" name="looking_for_partner" style="min-height:auto" ${p.looking_for_partner?'checked':''}> Show me in the speaking-partner list</label>
  ${PROFILE?'':'<label style="grid-column:1/-1;display:flex;gap:10px;align-items:center;font-weight:400"><input type="checkbox" name="adult" required style="min-height:auto"> I am 18 or older and I will keep the community respectful</label>'}
  <div style="grid-column:1/-1"><button class="pri">${PROFILE?'Save profile':'Join the community'}</button> <span id="pmsg" class="small" aria-live="polite"></span></div></form>`}
function bindProfileForm(){const f=$('#pform');if(!f)return;f.onsubmit=async e=>{e.preventDefault();const E=f.elements;
  const row={id:USER.id,display_name:E.display_name.value.trim(),level:E.level.value,target:E.target.value,exam_month:E.exam_month.value||null,bio:E.bio.value.trim().slice(0,280),looking_for_partner:E.looking_for_partner.checked};
  const {error}=await db.from('profiles').upsert(row);if(error){$('#pmsg').textContent='Could not save: '+error.message;return}PROFILE=row;acctChip();toast('Profile saved.');route()}}

let CH='questions',CHL='all';
const CHANNELS=[['questions','Questions'],['writing','Writing feedback'],['partners','Speaking partners'],['wins','Wins']];
const CHHELP={questions:'Ask anything about grammar, vocabulary or the TCF. Answer someone else’s question too: explaining is the fastest way to learn.',writing:'Paste a text you wrote, say which TCF task it was for, and ask for corrections. Be specific and kind when you correct others.',partners:'Find people to practise speaking with. Say your level, your exam month and when you are free. Arrange calls in the replies; never post your phone number or address publicly.',wins:'Passed a unit, finished a mock, got your TCF result? Share it here.'};
function rCommunity(){
  if(!CLOUD_ON)return notReady('Communauté');
  if(!USER){INIT=null;return`<section class="band"><div class="wrap"><h1>Communauté</h1><div class="paper"><p class="big">Learn with other TCF candidates.</p><p>Ask questions, swap writing for corrections and find speaking partners at your level. Sign in or create a free account to join.</p><a class="btn pri" href="#account">Sign in or create an account</a></div></div></section>`}
  if(!PROFILE){INIT=bindProfileForm;return`<section class="band"><div class="wrap"><h1>Communauté</h1>${profileForm()}</div></section>`}
  INIT=()=>{$$('[data-ch]').forEach(b=>b.onclick=()=>{CH=b.dataset.ch;route()});$$('[data-chl]').forEach(b=>b.onclick=()=>{CHL=b.dataset.chl;route()});
    const ta=$('#cbody');$('#cform').onsubmit=async e=>{e.preventDefault();const body=ta.value.trim();if(!body)return;const btn=$('#cform button');btn.disabled=true;
      const {error}=await db.from('posts').insert({channel:CH,level:PROFILE.level,body:body.slice(0,2000)});btn.disabled=false;if(error){toast(/limit/i.test(error.message)?'Daily post limit reached. Try again tomorrow.':'Could not post: '+error.message);return}ta.value='';S.drafts['post-'+CH]='';persist();loadFeed()};
    ta.value=S.drafts['post-'+CH]||'';ta.oninput=()=>{S.drafts['post-'+CH]=ta.value;persist()};$('#crefresh').onclick=loadFeed;loadFeed();loadPartners()};
  return`<section class="band"><div class="wrap"><div class="row" style="justify-content:space-between;align-items:end"><h1>Communauté</h1><a href="#account" class="small">Signed in as ${esc(PROFILE.display_name)} · edit profile</a></div>
  ${seg('ch',CHANNELS,CH)}
  <div class="two"><div><form id="cform" class="paper"><p class="small">${esc(CHHELP[CH])}</p><textarea id="cbody" maxlength="2000" lang="fr" style="min-height:140px" aria-label="Write a post" placeholder="Écrivez ici…"></textarea><div class="row"><button class="pri">Post to ${esc(CHANNELS.find(c=>c[0]===CH)[1])}</button><button type="button" id="crefresh">Refresh</button></div></form>
   ${seg('chl',[['all','All levels'],['mine','My level ('+PROFILE.level+')']],CHL)}<div id="feed"><p class="mute">Loading…</p></div></div>
  <aside><div class="card"><h2 style="margin-top:0">Speaking partners</h2><p class="small mute">Learners near your level who asked to be listed.</p><div id="partners"><p class="mute">Loading…</p></div></div>
   <div class="card note" style="margin-top:16px"><b>Community rules.</b> Be kind and constructive. French or English. No phone numbers, addresses or links to paid services in posts. Anything reported by three people is hidden automatically.</div></aside></div></div></section>`}
async function loadFeed(){const el=$('#feed');if(!el)return;
  let q=db.from('posts').select('id,body,level,created_at,user_id,profiles(display_name,level),replies(count)').eq('channel',CH).order('created_at',{ascending:false}).limit(40);
  if(CHL==='mine')q=q.eq('level',PROFILE.level);const {data,error}=await q;
  if(error){el.innerHTML=`<p class="bad">Could not load posts: ${esc(error.message)}</p>`;return}
  if(!data.length){el.innerHTML='<p class="mute">Nothing here yet. Be the first to post.</p>';return}
  el.innerHTML=data.map(p=>`<article class="card" style="margin-bottom:12px" data-post="${p.id}"><p class="small"><b>${esc(p.profiles?p.profiles.display_name:'Learner')}</b> <span class="mute">· ${esc(p.level||'')} · ${ago(p.created_at)}</span></p><p style="white-space:pre-wrap" lang="fr">${esc(p.body)}</p>
   <div class="row"><button class="sm" data-rep="${p.id}">Replies (${p.replies&&p.replies[0]?p.replies[0].count:0})</button>${p.user_id===USER.id?`<button class="sm" data-pdel="${p.id}">Delete</button>`:`<button class="sm" data-report="${p.id}">Report</button>`}</div><div class="replies" hidden></div></article>`).join('');
  $$('[data-rep]',el).forEach(b=>b.onclick=()=>openReplies(b.closest('article'),+b.dataset.rep));
  $$('[data-pdel]',el).forEach(b=>b.onclick=async()=>{if(b.dataset.sure){await db.from('posts').delete().eq('id',+b.dataset.pdel);loadFeed()}else{b.dataset.sure=1;b.textContent='Tap again to delete'}});
  $$('[data-report]',el).forEach(b=>b.onclick=()=>report(b,{post_id:+b.dataset.report}))}
async function report(btn,target){const {error}=await db.from('reports').insert(target);btn.disabled=true;btn.textContent=error&&!/duplicate/i.test(error.message)?'Could not report':'Reported';toast('Thanks. Reported posts are reviewed and hidden after three reports.')}
async function openReplies(art,id){const box=$('.replies',art);if(!box.hidden&&box.dataset.loaded){box.hidden=true;return}box.hidden=false;box.innerHTML='<p class="mute small">Loading…</p>';
  const {data,error}=await db.from('replies').select('id,body,created_at,user_id,profiles(display_name,level)').eq('post_id',id).order('created_at');
  if(error){box.innerHTML=`<p class="bad small">${esc(error.message)}</p>`;return}box.dataset.loaded=1;
  box.innerHTML=`<div style="border-left:3px solid var(--line);padding-left:12px;margin-top:10px">${data.map(r=>`<div style="margin-bottom:10px"><p class="small"><b>${esc(r.profiles?r.profiles.display_name:'Learner')}</b> <span class="mute">· ${esc(r.profiles?r.profiles.level:'')} · ${ago(r.created_at)}</span> ${r.user_id===USER.id?`<button class="sm" data-rdel="${r.id}">Delete</button>`:`<button class="sm" data-rreport="${r.id}">Report</button>`}</p><p style="white-space:pre-wrap;margin:0" lang="fr">${esc(r.body)}</p></div>`).join('')}
   <form class="row rform"><textarea maxlength="1000" lang="fr" required style="min-height:70px;line-height:1.5;background-image:none" aria-label="Write a reply" placeholder="Votre réponse…"></textarea><button class="pri sm">Reply</button></form></div>`;
  $('.rform',box).onsubmit=async e=>{e.preventDefault();const t=$('textarea',e.target).value.trim();if(!t)return;const {error}=await db.from('replies').insert({post_id:id,body:t.slice(0,1000)});if(error){toast('Could not reply: '+error.message);return}box.dataset.loaded='';box.hidden=true;openReplies(art,id)};
  $$('[data-rdel]',box).forEach(b=>b.onclick=async()=>{await db.from('replies').delete().eq('id',+b.dataset.rdel);box.dataset.loaded='';box.hidden=true;openReplies(art,id)});
  $$('[data-rreport]',box).forEach(b=>b.onclick=()=>report(b,{reply_id:+b.dataset.rreport}))}
async function loadPartners(){const el=$('#partners');if(!el)return;const i=LV.indexOf(PROFILE.level),near=LV.slice(Math.max(0,i-1),i+2);
  const {data,error}=await db.from('profiles').select('id,display_name,level,target,exam_month,bio').eq('looking_for_partner',true).in('level',near).neq('id',USER.id).limit(20);
  if(error||!data.length){el.innerHTML='<p class="small mute">No one listed near your level yet. Tick “Show me in the speaking-partner list” on your profile and post in Speaking partners.</p>';return}
  el.innerHTML=data.map(p=>`<div style="padding:8px 0;border-bottom:1px dashed var(--line)"><p class="small" style="margin:0"><b>${esc(p.display_name)}</b> <span class="mute">· ${esc(p.level)}${p.target?' → '+esc(p.target):''}${p.exam_month?' · exam '+esc(p.exam_month):''}</span></p>${p.bio?`<p class="small" style="margin:2px 0">${esc(p.bio)}</p>`:''}<button class="sm" data-invite="${esc(p.display_name)}">Invite to practise</button></div>`).join('');
  $$('[data-invite]',el).forEach(b=>b.onclick=()=>{CH='partners';S.drafts['post-partners']=`@${b.dataset.invite} Bonjour ! Je suis ${PROFILE.level} et je prépare le TCF. Tu veux pratiquer l'oral ensemble ? Je suis disponible …`;persist();route()})}

function rAccount(){
  if(!CLOUD_ON)return notReady('Mon compte');
  if(PWRESET&&USER){INIT=()=>{$('#npw').onsubmit=async e=>{e.preventDefault();const {error}=await db.auth.updateUser({password:e.target.pw.value});if(error){$('#amsg').textContent=error.message;return}PWRESET=false;toast('Password updated.');route()}};
    return`<section class="band"><div class="wrap"><h1>New password</h1><form id="npw" class="paper"><label>New password<input type="password" name="pw" minlength="8" required autocomplete="new-password"></label><div class="row" style="margin-top:12px"><button class="pri">Save password</button></div><p id="amsg" class="small bad" aria-live="polite"></p></form></div></section>`}
  if(!USER){let mode='in';INIT=()=>{const f=$('#auth'),msg=$('#amsg'),set=m=>{mode=m;$$('[data-am]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.am===m));f.pw.closest('label').hidden=m==='reset';f.pw.required=m!=='reset';f.pw.autocomplete=m==='up'?'new-password':'current-password';$('#ago').textContent=m==='in'?'Sign in':m==='up'?'Create account':'Send reset link';msg.textContent=''};
      $$('[data-am]').forEach(b=>b.onclick=()=>set(b.dataset.am));set('in');
      f.onsubmit=async e=>{e.preventDefault();const email=f.email.value.trim(),pw=f.pw.value,redirect=location.origin+location.pathname;msg.className='small';msg.textContent='Working…';let r;
        if(mode==='in')r=await db.auth.signInWithPassword({email,password:pw});
        else if(mode==='up')r=await db.auth.signUp({email,password:pw,options:{emailRedirectTo:redirect}});
        else r=await db.auth.resetPasswordForEmail(email,{redirectTo:redirect+'#account'});
        if(r.error){msg.className='small bad';msg.textContent=r.error.message;return}
        msg.className='small ok';msg.textContent=mode==='up'?(r.data.session?'Account created.':'Check your email and tap the confirmation link, then sign in.'):mode==='reset'?'If that email has an account, a reset link is on its way.':'Signed in.'}};
    return`<section class="band"><div class="wrap"><h1>Mon compte</h1><p>A free account keeps your progress, words and recordings safe and lets you pick up on any device. It also opens the learner community.</p>
    <div class="two"><form id="auth" class="paper">${seg('am',[['in','Sign in'],['up','Create account'],['reset','Forgot password']],'in')}
     <label style="display:grid;gap:6px">Email<input type="email" name="email" required autocomplete="email"></label>
     <label style="display:grid;gap:6px;margin-top:12px">Password<input type="password" name="pw" minlength="8" required></label>
     <div class="row" style="margin-top:14px"><button class="pri" id="ago">Sign in</button></div><p id="amsg" class="small" aria-live="polite"></p></form>
    <div class="card"><h2 style="margin-top:0">What gets saved</h2><ul class="small"><li>Your plan, finished units, flashcard schedule and streak</li><li>Your writing drafts and your own words</li><li>Your last 30 voice recordings</li></ul><p class="small mute">The progress you've made on this device is merged into your account when you sign in.</p></div></div></div></section>`}
  INIT=()=>{bindProfileForm();$('#aout').onclick=async()=>{await cloudPush();await db.auth.signOut();toast('Signed out. Your progress stays saved in your account.')};$('#async').onclick=async()=>{await cloudPush();toast(LASTSYNC?'Synced.':'Sync failed. Check your connection.');route()};
    $('#adel').onclick=async e=>{const b=e.target;if(!b.dataset.sure){b.dataset.sure=1;b.textContent='Tap again: this deletes your account, progress, posts and recordings';return}
      try{const {data}=await db.from('recordings').select('path');if(data&&data.length)await db.storage.from('recordings').remove(data.map(x=>x.path));const {error}=await db.rpc('delete_my_account');if(error)throw error;await db.auth.signOut();toast('Your account has been deleted.')}catch(err){toast('Could not delete: '+(err.message||err))}}};
  return`<section class="band"><div class="wrap"><h1>Mon compte</h1><div class="two"><div>${profileForm()}</div>
   <div class="card"><h2 style="margin-top:0">${esc(USER.email||'Signed in')}</h2><p class="small">Progress syncs automatically a couple of seconds after each change.${LASTSYNC?' Last synced '+esc(LASTSYNC.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))+'.':''}</p>
    <div class="row"><button id="async">Sync now</button><button id="aout">Sign out</button></div>
    ${RECORDER?`<h3 style="margin-top:20px">Voice studio</h3><p class="small">You record the native audio that every learner hears.</p><a class="btn pri" href="#studio">Open the voice studio</a>`:''}
    <h3 style="margin-top:20px">Delete account</h3><p class="small mute">Removes your account, progress, profile, posts, replies and recordings for good.</p><button id="adel">Delete my account</button></div></div></div></section>`}


/* ---------- VOICE STUDIO: a native speaker records every sentence once; everyone hears it ---------- */
const hash=s=>{let h=2166136261;for(const c of s){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const pubUrl=path=>`${CFG.supabaseUrl}/storage/v1/object/public/voices/${path}`;
async function loadClips(){try{const {data}=await db.from('voice_clips').select('text_key,path,speaker_name').limit(5000);(data||[]).forEach(r=>{CLIPS[r.text_key]={kind:'clip',u:pubUrl(r.path),sp:r.speaker_name,path:r.path}})}catch(e){}}
function studioGroups(){const uniq=a=>[...new Set(a.map(x=>String(x).trim()).filter(Boolean))];return[
  ['Lesson examples',uniq(UNITS.flatMap(u=>u.ex.map(e=>e[0])))],['Lesson dialogues and tables',uniq(Object.values(typeof DEEP!=='undefined'?DEEP:{}).flatMap(D=>D.dialogue.map(d=>d[1]).concat(D.steps.filter(x=>x.say&&x.t).flatMap(x=>x.t.map(r=>r[0])))))],['Listening',uniq(LIS.map(x=>x[1]))],['Reading',uniq(READ.map(x=>x[2]))],
  ['Speaking',uniq(ST.flatMap(t=>t.p.concat(t.ph)))],['Pronunciation',uniq(RULES.flatMap(r=>r[2]).concat(SND.flatMap(s=>s[4]),PAIRS.flatMap(p=>[p[0],p[1]])))],
  ['Vocabulary',uniq(UNITS.flatMap(u=>u.v.map(v=>v[0])))]]}
let SG=0,SMISS=true;
function rStudio(){
  if(!CLOUD_ON||!USER||!RECORDER){INIT=null;return`<section class="band"><div class="wrap"><h1>Voice studio</h1><div class="paper"><p>This page is for the native speakers who record the course audio. If that's you, ask the app owner to add your account as a recorder, then sign in.</p></div></div></section>`}
  const G=studioGroups(),all=G.flatMap(g=>g[1]),done=all.filter(k=>CLIPS[k]).length,[gn,items]=G[SG],list=items.filter(k=>!SMISS||!CLIPS[k]);
  INIT=()=>{$$('[data-sg]').forEach(b=>b.onclick=()=>{SG=+b.dataset.sg;route()});$$('[data-sm]').forEach(b=>b.onclick=()=>{SMISS=b.dataset.sm==='1';route()})};
  return`<section class="band"><div class="wrap"><h1>Voice studio</h1>
  <p>Recording as <b>${esc(RECORDER.speaker_name)}</b>. Read each line naturally, at normal speed, in a quiet room with the phone about 20 cm from your mouth. Leave half a second of silence before and after. You can re-record any line; the newest take replaces the old one for every learner.</p>
  <div class="card" style="margin-bottom:14px"><b>${done} of ${all.length}</b> lines recorded<div class="bar" style="margin-top:8px"><i style="width:${all.length?done/all.length*100:0}%"></i></div></div>
  ${seg('sg',G.map((g,i)=>[String(i),`${g[0]} (${g[1].filter(k=>CLIPS[k]).length}/${g[1].length})`]),String(SG))}
  ${seg('sm',[['1','Not recorded yet'],['0','All lines']],SMISS?'1':'0')}
  <div class="units">${list.length?list.slice(0,80).map(k=>`<div class="card"><p lang="fr" style="font-size:18px;margin-top:0"><b>${esc(k)}</b></p>${CLIPS[k]?`<p class="small ok">Recorded by ${esc(CLIPS[k].sp)} ${sb(k)}</p>`:''}<div class="rec" data-key="${esc(k)}" data-label="" data-model=""><div class="row"><button data-rec="start" class="pri">● Record</button><span class="rtime timer" style="font-size:30px"></span></div><div class="rout small" aria-live="polite"></div></div></div>`).join(''):'<p class="ok">Every line in this section is recorded. Merci !</p>'}</div>
  ${list.length>80?'<p class="small mute">Showing 80 lines; record these and the next ones appear.</p>':''}</div></section>`}
async function studioUpload(box,btn){const key=box.dataset.key,blob=box._blob;btn.disabled=true;btn.textContent='Uploading…';
  try{const ext=/mp4/.test(blob.type)?'m4a':/ogg/.test(blob.type)?'ogg':'webm',path=`${hash(key)}-${Date.now().toString(36)}.${ext}`;
    const up=await db.storage.from('voices').upload(path,blob,{contentType:blob.type.split(';')[0]||'audio/webm'});if(up.error)throw up.error;
    const old=CLIPS[key];const {error}=await db.from('voice_clips').upsert({text_key:key,path,speaker_name:RECORDER.speaker_name,user_id:USER.id});if(error)throw error;
    if(old&&old.path)db.storage.from('voices').remove([old.path]).catch(()=>{});
    CLIPS[key]={kind:'clip',u:pubUrl(path),sp:RECORDER.speaker_name,path};btn.textContent='Saved for everyone';toast('Saved. Learners now hear this recording.')}
  catch(e){btn.disabled=false;btn.textContent='Use this take';toast('Upload failed: '+(e.message||e))}}

/* ---------- FULL LESSON RENDERING ---------- */
function deepHTML(u){const D=(typeof DEEP!=='undefined')&&DEEP[u.id];if(!D)return`<p>${esc(u.g)}</p>`;
  const tbl=st=>st.t?`<div class="scroll"><table class="stack lt">${st.th?`<thead><tr>${st.th.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>`:''}<tbody>${st.t.map(r=>`<tr>${r.map((c,i)=>`<td${i===0&&st.say?' class="frc"':''}>${i===0&&st.say?`<span class="row" style="gap:6px;flex-wrap:nowrap">${sb(c)}<b lang="fr">${esc(c)}</b></span>`:esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'';
  return`<p class="lead">${esc(D.hook)}</p>
  ${D.steps.map((st,i)=>`<h2><span class="hand" style="font-size:30px">${i+1}.</span> ${esc(st.h)}</h2>${st.p?`<p>${esc(st.p)}</p>`:''}${tbl(st)}`).join('')}
  <div class="trick"><p class="hand">Memory trick</p><p style="margin:0">${esc(D.trick)}</p></div>
  <h2>Mistakes beginners make</h2><div class="scroll"><table class="stack lt"><thead><tr><th>Don't say</th><th>Say</th><th>Why</th></tr></thead><tbody>${D.mistakes.map(m=>`<tr><td class="bad" lang="fr"><s>${esc(m[0])}</s></td><td class="ok" lang="fr"><b>${esc(m[1])}</b></td><td>${esc(m[2])}</td></tr>`).join('')}</tbody></table></div>
  <h2>Say it right</h2><p>${esc(D.sound)}</p>
  <h2>In real life</h2><div class="dlg">${D.dialogue.map(d=>`<div class="ex">${sb(d[1])}<div><div class="fr" lang="fr"><span class="mute">${esc(d[0])} :</span> ${esc(d[1])}</div><div class="en">${esc(d[2])}</div></div></div>`).join('')}</div>
  <div class="row" style="margin-top:10px"><button id="playdlg">${SPK} Play the dialogue</button><span class="small mute">Then hide the English and act it out loud, both parts.</span></div>
  <h2>In one line</h2><p class="mute">${esc(u.g)}</p>`}
/* ---------- ROUTER ---------- */
const VIEWS={today:rToday,course:rCourse,drill:rDrill,sounds:rSounds,shadow:rShadow,listen:rListen,read:rRead,write:rWrite,speak:rSpeak,words:rWords,tcf:rTcf,plan:rPlan,community:rCommunity,account:rAccount,studio:rStudio};
function route(){
  playId++;stopAudio();if(hasTTS)try{speechSynthesis.cancel()}catch(e){}stopTimers();recStop();INIT=null;
  const h=location.hash.slice(1)||'today',isL=h.startsWith('u-'),v=isL?'course':(VIEWS[h]?h:'today'),tab=v==='drill'?'course':v==='studio'?'account':v;
  if(v!=='words')Q=null;
  $$('.tabs a').forEach(a=>{const on=a.getAttribute('href')==='#'+tab;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  const m=$('#main'),scroll=route.last===h?window.scrollY:0;m.innerHTML=isL?rLesson(h.slice(2)):VIEWS[v]();route.last=h;
  if(INIT){const f=INIT;INIT=null;f()}window.scrollTo(0,scroll);setTimeout(prefetchVoices,300)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b){playId++;say(b.dataset.say)}
  const rb=e.target.closest('[data-rec]');if(rb)recAction(rb);
  const r=e.target.closest('[data-rate]');if(r){S.rate=+r.dataset.rate;save();route()}});
window.addEventListener('hashchange',route);
route();
cloudInit();
}
