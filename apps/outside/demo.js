/* Demo mode: open the app with ?demo to try it with sample people and plans.
   Everything runs in your browser and resets when you reload. Nothing is saved. */
(function(){
const now=Date.now(),iso=h=>new Date(now+h*3600e3).toISOString(),uid=()=>Math.random().toString(36).slice(2,10);
const day=(n,h)=>{const d=new Date();d.setDate(d.getDate()+n);d.setHours(h,0,0,0);return d.toISOString()};
const P=(id,name,city,wants,x)=>({id,name,city,age_band:'25–34',is_woman:true,wants,verified:true,suspended:false,strike_reset:0,pass_until:null,invited_by:null,ref_note:null,created_at:iso(-200),...x});
const db={
 out_profiles:[P('me','Ada','Abuja',['Paint and sip']),P('p1','Zainab','Abuja',['Paint and sip','Go to a December concert']),P('p2','Chioma','Abuja',['Paint and sip','Start running'],{verified:false,ref_note:'Zainab'}),P('p3','Temi','Abuja',['Go to a December concert','Paint and sip'],{is_woman:false}),P('p4','Halima','Abuja',['Paint and sip','Board games night']),P('p5','Ngozi','Lagos',['Beach day']),P('p6','Ifeoma','Lagos',['Go to a December concert'])],
 out_private:[{id:'me',phone:'0803 000 0000',tc_name:'Mum',tc_phone:'0803 111 0000'},{id:'p1',phone:'0803 000 0001',tc_name:'Amina',tc_phone:'0803 111 0001'},{id:'p2',phone:'0803 000 0002'},{id:'p3',phone:'0803 000 0003'},{id:'p4',phone:'0803 000 0004'},{id:'p5',phone:'0803 000 0005'},{id:'p6',phone:'0803 000 0006'}],
 out_events:[
  {id:'e1',title:'Saturday brunch & new friends',city:'Abuja',kind:'eat',starts_at:day(4,11),venue:'A café',area:'Wuse 2',cap:6,fee:0,budget:'₦8k–₦15k',ages:'Ages 25–34',women_only:true,partner:true,notes:null},
  {id:'e2',title:'Sunday reading hour',city:'Abuja',kind:'read',starts_at:day(5,15),venue:'A book café',area:'Jabi',cap:5,fee:0,budget:'₦3k–₦6k',ages:'Any adult age',women_only:false,partner:false,notes:"Bring whatever you're reading."},
  {id:'e3',title:'Evening walk at Jabi Lake',city:'Abuja',kind:'move',starts_at:iso(-1),venue:'Jabi Lake',area:'Jabi',cap:8,fee:0,budget:'Free',ages:'Any adult age',women_only:false,partner:false,notes:null},
  {id:'e4',title:'Rooftop dinner',city:'Lagos',kind:'eat',starts_at:day(6,19),venue:'A rooftop spot',area:'Lekki Phase 1',cap:6,fee:0,budget:'₦15k–₦25k',ages:'Any adult age',women_only:false,partner:false,notes:null}],
 out_rsvps:[
  {id:'r1',event_id:'e3',user_id:'me',status:'confirmed',paid:true,amount:500,sent:true,checked_in_at:null,home_safe_at:null,created_at:iso(-50)},
  {id:'r2',event_id:'e3',user_id:'p1',status:'confirmed',paid:true,amount:500,checked_in_at:iso(-0.9),created_at:iso(-50)},
  {id:'r3',event_id:'e3',user_id:'p4',status:'confirmed',paid:true,amount:500,checked_in_at:iso(-0.8),created_at:iso(-50)},
  {id:'r4',event_id:'e1',user_id:'p2',status:'requested',paid:false,amount:500,sent:true,created_at:iso(-5)},
  {id:'r5',event_id:'e1',user_id:'p1',status:'confirmed',paid:true,amount:0,created_at:iso(-5)},
  {id:'r6',event_id:'e2',user_id:'p3',status:'confirmed',paid:true,amount:500,created_at:iso(-5)},
  {id:'r7',event_id:'e4',user_id:'p5',status:'confirmed',paid:true,amount:500,created_at:iso(-5)}],
 out_feedback:[{rsvp_id:'r2',event_id:'e3',user_id:'p1',meet_again:['me'],rating:5,note:null}],
 out_asks:[
  {id:'a1',by_user:'p1',city:'Abuja',what:'Cinema on Saturday night',when_at:day(4,19),place:'Ceddi Plaza',budget:'₦6k',seats:3,ring:'everyone',invite:[],joins:['p3'],status:'open',hap_id:null,created_at:iso(-3)},
  {id:'a2',by_user:'p4',city:'Abuja',what:'Going to Wizkid at Eagle Square',when_at:'2026-12-13T17:00:00.000Z',place:'Meet at the main gate',budget:'₦50k ticket',seats:2,ring:'everyone',invite:[],joins:[],status:'open',hap_id:'h-wizkid-abj',created_at:iso(-20)},
  {id:'a3',by_user:'p5',city:'Lagos',what:'Beach day at Elegushi',when_at:day(3,12),place:'Elegushi Beach entrance',budget:'₦10k',seats:4,ring:'everyone',invite:[],joins:['p6'],status:'open',hap_id:null,created_at:iso(-6)}],
 out_ask_fb:[],
 out_circles:[{id:'c1',name:'Sunday readers',city:'Abuja',members:['me','p1','p3'],from_event:null,history:[{what:'Sunday reading hour',when_at:day(-7,15)}],next_plan:{what:'Brunch, then the bookshop',when_at:day(5,12),place:'Wuse 2',going:['p1']},host_idx:1}],
 out_happenings:[
  {id:'h-wizkid-abj',title:'Wizkid at Live Out Loud Music Festival',city:'Abuja',start_date:'2026-12-13',end_date:null,venue:'Eagle Square',price:'Standard tickets ₦50,000 on Tix Africa',link:'https://www.riotimesonline.com/wizkid-abuja-eagle-square-concert-2026/',note:null},
  {id:'h-apitainment',title:'Apitainment Music Festival with Seyi Vibez',city:'Abuja',start_date:'2026-12-19',end_date:null,venue:'Abuja Velodrome',price:null,link:'https://guardian.ng/?p=2954676',note:null},
  {id:'h-add-fit',title:'Abuja FitFest (Abuja Detty December)',city:'Abuja',start_date:'2026-12-27',end_date:null,venue:null,price:null,link:'https://leadership.ng/abuja-detty-december-debuts/',note:null},
  {id:'h-davido',title:'Davido: Oriadè, The Residency',city:'Lagos',start_date:'2026-12-17',end_date:'2026-12-19',venue:'National Theatre, Iganmu',price:'Ticket prices not announced yet',link:'https://guardian.ng/?p=2919857',note:null},
  {id:'h-ddfest',title:'Detty December Fest (Wizkid opens on the 18th)',city:'Lagos',start_date:'2026-12-18',end_date:'2026-12-30',venue:'Detty December Village, Ilubirin',price:null,link:'https://africa.com/entertainment/wizkid-to-open-detty-december-fest-2026-as-lagos-13-day-two-stage-festival-returns',note:null}],
 out_notes:[{id:1,user_id:'me',body:'Zainab is down for Cinema on Saturday night.',link:'#ask-a1',read:false,created_at:iso(-1)}],
 out_reports:[{id:'rp1',by_user:'p1',about:'p2',ask_id:null,why:'Sample report: kept asking for my number in the group.',status:'open',created_at:iso(-4)}],
 out_settings:[{id:1,first_fee:500,pay_info:'https://paystack.com/pay/outside-demo',pass_price:0,pass_note:null}],
 out_admins:[{user_id:'me'}]};
const KEY={out_settings:'id',out_feedback:'rsvp_id'};
const keyOf=t=>KEY[t]||'id';
const ok=d=>Promise.resolve({data:d===undefined?null:d,error:null});
function q(t){
  const f=[];let mode='select',payload=null;
  const rows=()=>(db[t]=db[t]||[]);
  const run=()=>{
    const hit=rows().filter(r=>f.every(x=>x(r)));
    if(mode==='update'){hit.forEach(r=>Object.assign(r,payload));return ok(null)}
    if(mode==='delete'){db[t]=rows().filter(r=>!hit.includes(r));return ok(null)}
    return ok(JSON.parse(JSON.stringify(hit)));
  };
  const b={select(){return b},order(){return b},limit(){return b},
    eq(k,v){f.push(r=>r[k]===v);return b},gte(k,v){f.push(r=>r[k]>=v);return b},
    maybeSingle(){return run().then(r=>({data:(r.data||[])[0]||null,error:null}))},
    insert(o){const k=keyOf(t);const row={created_at:new Date().toISOString(),...o};if(!row[k])row[k]=uid();
      if(t==='out_rsvps'){row.user_id=row.user_id||'me';const ev=db.out_events.find(x=>x.id===row.event_id);const taken=rows().filter(x=>x.event_id===row.event_id&&['requested','confirmed'].includes(x.status)).length;
        row.status=taken>=ev.cap?'waitlist':'requested';row.paid=false;row.sent=false;row.amount=rows().some(x=>x.user_id==='me'&&x.paid)?ev.fee:Math.max(ev.fee,500);if(!row.amount){row.paid=true;row.status='confirmed'}}
      if(t==='out_asks'){row.by_user='me';row.joins=[];row.status='open';row.invite=row.invite||[]}
      if(t==='out_circles'){row.history=row.history||[];row.host_idx=0;row.next_plan=null}
      if(t==='out_reports'){row.by_user='me';row.status='open'}
      rows().push(row);return ok(null)},
    upsert(o){const k=keyOf(t);const ex=rows().find(r=>r[k]===o[k]);if(ex)Object.assign(ex,o);else b.insert(o);return ok(null)},
    update(o){mode='update';payload=o;return b},
    delete(){mode='delete';return b},
    then(res,rej){return run().then(res,rej)}};
  return b;
}
const rpc=(n,a)=>{
  if(n==='out_my_people'){const m={};const add=(p,w,t)=>{if(p==='me')return;const x=m[p]||(m[p]={person:p,times:0,last_what:w,last_at:t,mutual:false});x.times++;if(t>x.last_at){x.last_at=t;x.last_what=w}};
    db.out_events.forEach(ev=>{const ids=db.out_rsvps.filter(r=>r.event_id===ev.id&&r.checked_in_at).map(r=>r.user_id);if(ids.includes('me'))ids.forEach(p=>add(p,ev.title,ev.starts_at))});
    db.out_circles.forEach(c=>{if(c.members.includes('me'))(c.history||[]).forEach(h=>c.members.forEach(p=>add(p,h.what,h.when_at)))});
    db.out_asks.forEach(k=>{const ids=[k.by_user,...k.joins];if(new Date(k.when_at)<new Date()&&ids.includes('me'))ids.forEach(p=>add(p,k.what,k.when_at))});
    const mine=db.out_feedback.filter(f=>f.user_id==='me');mine.forEach(f=>f.meet_again.forEach(p=>{if(m[p]&&db.out_feedback.some(g=>g.event_id===f.event_id&&g.user_id===p&&g.meet_again.includes('me')))m[p].mutual=true}));
    db.out_ask_fb.filter(f=>f.user_id==='me').forEach(f=>(f.meet_again||[]).forEach(p=>{if(m[p])m[p].mutual=true}));
    return ok(Object.values(m))}
  if(n==='out_join_ask'){const k=db.out_asks.find(x=>x.id===a.aid);if(k.joins.length>=k.seats)return Promise.resolve({data:null,error:{message:'It just filled up.'}});if(!k.joins.includes('me'))k.joins.push('me');return ok(null)}
  if(n==='out_leave_ask'){const k=db.out_asks.find(x=>x.id===a.aid);k.joins=k.joins.filter(x=>x!=='me');return ok(null)}
  if(n==='out_leave_circle'){const c=db.out_circles.find(x=>x.id===a.cid);c.members=c.members.filter(x=>x!=='me');return ok(null)}
  if(n==='out_crew_contacts'){let ids=[];if(a.aid){const k=db.out_asks.find(x=>x.id===a.aid);ids=[k.by_user,...k.joins]}if(a.cid){ids=db.out_circles.find(x=>x.id===a.cid).members}
    return ok(ids.filter(x=>x!=='me').map(x=>({user_id:x,name:db.out_profiles.find(p=>p.id===x).name,phone:(db.out_private.find(p=>p.id===x)||{}).phone||'—'})))}
  if(n==='out_my_invites')return ok([{code:'demo1234',used:1}]);
  if(n==='out_notify_wanters')return ok(db.out_profiles.filter(p=>(p.wants||[]).includes(a.want)).length);
  return ok(null);
};
window.OUTSIDE_CONFIG={supabaseUrl:'https://demo.local',supabaseAnonKey:'demo'};
window.supabase={createClient:()=>({from:q,rpc,auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:'me'}}}}),signOut:async()=>{location.href=location.pathname},signInWithPassword:async()=>({}),signUp:async()=>({data:{}}),resetPasswordForEmail:async()=>({}),updateUser:async()=>({})}})};
document.addEventListener('DOMContentLoaded',()=>{const n=document.createElement('div');n.className='note';n.style.cssText='background:#ffb400;color:#121114;font-weight:600';n.innerHTML='Demo with sample people. You\'re a member and the host. Nothing is saved; reload to start over. <a href="./">Leave demo</a>';document.querySelector('main').before(n)});
})();
