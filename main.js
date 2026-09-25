const menuButton=document.querySelector('.pole-toggle');
const menu=document.querySelector('.pole-menu');
function setMenu(open){
  menuButton.setAttribute('aria-expanded',String(open));
  menuButton.setAttribute('aria-label',open?'Close menu':'Open menu');
  menu.classList.toggle('open',open);
  menu.inert=!open;
  menuButton.querySelector('small').textContent=open?'CLOSE':'MENU';
  menuButton.classList.remove('pole-pop'); void menuButton.offsetWidth; menuButton.classList.add('pole-pop');
  if(open) menu.querySelector('a')?.focus();
  else menuButton.focus();
}
const poleShaft=menuButton.querySelector('.pole-shaft');
const idlePoleRate=1.2/1.9;
const fastPoleRate=1.2/.19;
let poleSlowdownTimer;
let poleSlowdownFrame;
function poleAnimation(){
  return poleShaft.getAnimations().find(animation=>animation.animationName==='pole');
}
function setIdlePoleSpeed(){
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const animation=poleAnimation();
    if(animation)animation.playbackRate=idlePoleRate;
  }
}
function boostPole(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  clearTimeout(poleSlowdownTimer);
  cancelAnimationFrame(poleSlowdownFrame);
  const animation=poleAnimation();
  if(!animation)return;
  animation.playbackRate=fastPoleRate;
  poleSlowdownTimer=setTimeout(()=>{
    let started;
    function easeBack(now){
      if(started===undefined)started=now;
      const progress=Math.min(1,(now-started)/600);
      const smooth=progress*progress*(3-2*progress);
      animation.playbackRate=fastPoleRate+(idlePoleRate-fastPoleRate)*smooth;
      if(progress<1)poleSlowdownFrame=requestAnimationFrame(easeBack);
    }
    poleSlowdownFrame=requestAnimationFrame(easeBack);
  },1400);
}
setIdlePoleSpeed();
menuButton.addEventListener('click',()=>{
  setMenu(menuButton.getAttribute('aria-expanded')!=='true');
  requestAnimationFrame(boostPole);
});

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menuButton.getAttribute('aria-expanded')==='true')setMenu(false);});
const profiles={
  gabriel:{number:'01',role:'OWNER & MASTER BARBER',name:'GABRIEL SALAZAR',copy:"Sonder's owner. Skin fades and straight razor shaves are his signature.",action:'BOOK WITH GABRIEL'},
  erick:{number:'02',role:'NEW TO SONDER',name:'ERICK RIOS',copy:"Erick brings his own eye for clean blends, balanced shape, and beard detail. Call the shop for his current availability.",action:'TRY BOOKING WITH ERICK'}
};
let selectedProfile='gabriel';
const detail=document.querySelector('#barber-detail');
function selectProfile(id){
  selectedProfile=id;
  const p=profiles[id];
  document.querySelectorAll('.barber-tile').forEach(b=>{
    const active=b.dataset.barber===id;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',String(active));
  });
  detail.innerHTML='<div class="detail-number">'+p.number+' <span>/ 04</span></div><div><p class="detail-kicker">'+p.role+'</p><h3>'+p.name+'</h3><p class="detail-copy">'+p.copy+'</p></div><a class="detail-action" href="'+'#booking'+'">'+p.action+' <span>&#8599;</span></a>';
}
document.querySelectorAll('.barber-tile[data-barber]').forEach(b=>b.addEventListener('click',()=>runCut(()=>selectProfile(b.dataset.barber),'clippers',b.dataset.barber.toUpperCase()+'.'))); 
selectProfile('gabriel');
const services=['Full Haircut','Haircut & Beard Trim','Beard Trim','Hot Towel Shave'];
const booking={step:1,service:null,barber:null,date:null,time:null};
const panel=document.querySelector('#booking-panel');
const progress=document.querySelectorAll('.booking-progress li');
let calendarMonthOffset=0;
const maxCalendarMonthOffset=12;
function dateInfo(key){
 const [year,month,day]=key.split('-').map(Number);
 const d=new Date(year,month-1,day,12);
 return {key,day:new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(d),date:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(d),saturday:d.getDay()===6};
}
function calendar(){
 const now=new Date();
 const first=new Date(now.getFullYear(),now.getMonth()+calendarMonthOffset,1,12);
 const title=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(first);
 const cells=[];
 for(let i=0;i<first.getDay();i++)cells.push('<span class="calendar-blank" aria-hidden="true"></span>');
 const last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 for(let day=1;day<=last;day++){
  const d=new Date(first.getFullYear(),first.getMonth(),day,12);
  const key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
  const open=d>today&&d.getDay()!==0&&d.getDay()!==1;
  cells.push('<button type="button" data-date="'+key+'" class="'+(booking.date===key?'chosen':'')+'" '+(!open?'disabled':'')+' aria-label="'+new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(d)+(open?' sample times':' unavailable')+'">'+day+'</button>');
 }
 return '<div class="calendar-head"><button type="button" data-month="-1" '+(calendarMonthOffset===0?'disabled':'')+' aria-label="Previous month">&#8592;</button><strong>'+title+'</strong><button type="button" data-month="1" '+(calendarMonthOffset===maxCalendarMonthOffset?'disabled':'')+' aria-label="Next month">&#8594;</button></div><div class="calendar-weekdays">'+['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="date-options">'+cells.join('')+'</div><p class="calendar-range">Browse sample dates up to one year ahead.</p>';
}
function renderBooking(){
  panel.classList.remove('booking-enter'); void panel.offsetWidth; panel.classList.add('booking-enter');
  panel.dataset.tool=['','SCISSORS','CLIPPERS','RAZOR','SCISSORS','DONE'][booking.step];
  progress.forEach((li,i)=>{li.classList.toggle('current',booking.step===i+1);li.classList.toggle('complete',booking.step>i+1);});
  if(booking.step===1){
    panel.innerHTML='<div class="booking-step-head"><span>STEP 01 / THE SERVICE</span><h3>Choose a service</h3><p>Pick exactly what you&#39;re in for.</p></div><div class="booking-options">'+services.map((s,i)=>'<button type="button" data-service="'+i+'"><span>0'+(i+1)+'</span><strong>'+s+'</strong><b>&#8599;</b></button>').join('')+'</div>';
    panel.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',()=>{booking.service=Number(b.dataset.service);booking.step=2;cutOverride=['clippers','scissors','razor','brush'][booking.service];renderBooking();}));
  }else if(booking.step===2){
    panel.innerHTML='<div class="booking-step-head"><span>STEP 02 / YOUR BARBER</span><h3>Pick your barber</h3><p>Or leave it to whoever&#39;s free first.</p></div><div class="booking-options">'+[['gabriel','Gabriel Salazar','Owner & master barber'],['erick','Erick Rios','New to Sonder'],['any','First available','Let the shop choose']].map(([id,name,role],i)=>'<button type="button" data-choice="'+id+'" class="'+(booking.barber===id?'chosen':'')+'"><span>0'+(i+1)+'</span><strong>'+name+'</strong><small>'+role+'</small><b>&#8599;</b></button>').join('')+'</div><button type="button" class="step-back" data-back>Back to services</button>';
    panel.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{booking.barber=b.dataset.choice;booking.step=3;cutOverride={gabriel:'clippers',erick:'scissors',any:'pole'}[booking.barber];renderBooking();}));
  }else if(booking.step===3){
    const slots=booking.date&&dateInfo(booking.date).saturday?['9:00 AM','10:30 AM','12:00 PM','2:00 PM']:['10:00 AM','11:30 AM','2:00 PM','4:00 PM'];
    panel.innerHTML='<div class="booking-step-head"><span>STEP 03 / THE TIME</span><h3>Confirm a time</h3><p>Grab an open slot that fits your day. Sample dates and times only; these are not live openings.</p></div>'+calendar()+'<div class="time-options">'+(booking.date?slots.map(t=>'<button type="button" data-time="'+t+'" class="'+(booking.time===t?'chosen':'')+'">'+t+'</button>').join(''):'<p>Choose a date to see sample times.</p>')+'</div><div class="step-actions"><button type="button" class="step-back" data-back>Back to barber</button><button type="button" class="step-next" data-next '+(!booking.date||!booking.time?'disabled':'')+'>Review selection &#8599;</button></div>';
    panel.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>{calendarMonthOffset+=Number(b.dataset.month);booking.date=null;booking.time=null;cutOverride='comb';renderBooking();}));
    panel.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{booking.date=b.dataset.date;booking.time=null;cutOverride='scissors';renderBooking();}));
    panel.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{booking.time=b.dataset.time;cutOverride='razor';renderBooking();}));
    panel.querySelector('[data-next]').addEventListener('click',()=>{booking.step=4;cutOverride='brush';renderBooking();});
  }else if(booking.step===4){
    const barberName={gabriel:'Gabriel Salazar',erick:'Erick Rios',any:'First available'}[booking.barber];
    const date=dateInfo(booking.date);
    panel.innerHTML='<div class="booking-step-head"><span>STEP 04 / REVIEW</span><h3>Looks good?</h3><p>See how a Sonder booking could come together in one place.</p></div><dl class="review-list"><div><dt>SERVICE</dt><dd>'+services[booking.service]+'</dd></div><div><dt>BARBER</dt><dd>'+barberName+'</dd></div><div><dt>SAMPLE TIME</dt><dd>'+date.day+', '+date.date+' / '+booking.time+'</dd></div><div><dt>LOCATION</dt><dd>1600 S Halsted St, Chicago</dd></div></dl><p class="review-warning">This is a design preview. No appointment will be submitted, reserved, or confirmed.</p><div class="step-actions"><button type="button" class="step-back" data-back>Change time</button><button type="button" class="step-next" data-finish>Finish demo &#8599;</button></div>';
    panel.querySelector('[data-finish]').addEventListener('click',()=>{booking.step=5;cutOverride='scissors';renderBooking();});
  }else{
    panel.innerHTML='<div class="demo-complete"><span class="complete-mark">&#10003;</span><p class="detail-kicker">CONCEPT COMPLETE</p><h3>THAT IS THE FLOW.</h3><p>You made a sample selection without leaving Sonder. No request was sent and no time was held.</p><div class="step-actions"><button type="button" class="step-next" data-restart>Try another cut</button><a href="tel:+13126479768" class="step-call">Call the shop for a real appointment &#8599;</a></div></div>';
    panel.querySelector('[data-restart]').addEventListener('click',()=>{Object.assign(booking,{step:1,service:null,barber:null,date:null,time:null});calendarMonthOffset=0;cutOverride='pole';renderBooking();});
  }
  panel.querySelector('[data-back]')?.addEventListener('click',()=>{booking.step--;cutOverride='razor';renderBooking();});
}
const renderBookingNow=renderBooking;
let bookingReady=false;
let cutOverride=null;
renderBooking=function(){
 if(!bookingReady){bookingReady=true;return renderBookingNow();}
 const mode=cutOverride||({1:'scissors',2:'clippers',3:'comb',4:'razor',5:'brush'})[booking.step];
 cutOverride=null;
 return runCut(()=>renderBookingNow(),mode);
};
renderBooking();

const reviews=[
  {
    "name": "Jay Denyar",
    "copy": "Great environment, great music, great hair cut!!",
    "source": "GOOGLE REVIEW"
  },
  {
    "name": "Cesar Delgado",
    "copy": "The shop feels comfortable, and you can tell he takes pride in his work.",
    "source": "GOOGLE REVIEW"
  },
  {
    "name": "Kenneth Official",
    "copy": "Clean shop, professional atmosphere, and solid customer service.",
    "source": "GOOGLE REVIEW"
  },
  {
    "name": "David Gamboa",
    "copy": "His attention to detail and consistency are unmatched.",
    "source": "GOOGLE REVIEW"
  },
  {
    "name": "Angel T",
    "copy": "His scissor work, fade, and overall professionalism\u2014along with a great conversation\u2014made for an exceptional experience.",
    "source": "GOOGLE REVIEW"
  },
  {
    "name": "Antonio Gonzalez",
    "copy": "The shop has a good vibe, professional atmosphere, and you always leave feeling fresh and confident.",
    "source": "GOOGLE REVIEW"
  },
  {
    "name": "Danayla Gamboa",
    "copy": "The shop has a clean, welcoming vibe \u2014 definitely our go-to spot.",
    "source": "GOOGLE REVIEW"
  },
  {
    "name": "Taras Bubbles",
    "copy": "Got a haircut over lunch and will 1000% be going back!",
    "source": "GOOGLE REVIEW"
  },
  {
    "name": "Xander Sanchez",
    "copy": "His attention to detail is excellent, and he consistently takes the time to ensure every cut is done with precision.",
    "source": "GOOGLE REVIEW"
  }
];
const reviewWindow=document.querySelector('.reviews-window');
const reviewTrack=document.querySelector('#reviews-track');
const reviewMarkup=reviews.map(r=>'<article class="review-card"><span class="review-stars" aria-label="Five stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span><p>'+r.copy+'</p><strong>'+r.name+' <span>/ '+r.source+'</span></strong></article>').join('');
reviewTrack.innerHTML='<div class="review-set">'+reviewMarkup+'</div><div class="review-set" aria-hidden="true">'+reviewMarkup+'</div>';
const reviewSetWidth=()=>reviewTrack.querySelector('.review-set').getBoundingClientRect().width;
const reducedReviewMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let reviewPaused=false;
let reviewResumeTimer;
let lastReviewFrame;
let reviewPosition=0;
function moveReviews(position){
 const width=reviewSetWidth();
 reviewPosition=width?((position%width)+width)%width:position;
 reviewWindow.scrollLeft=reviewPosition;
}
function pauseReviews(){reviewPaused=true;clearTimeout(reviewResumeTimer);}
function resumeReviewsSoon(){
 clearTimeout(reviewResumeTimer);
 reviewResumeTimer=setTimeout(()=>{reviewPosition=reviewWindow.scrollLeft;reviewPaused=false;},1200);
}
function animateReviews(now){
 if(lastReviewFrame!==undefined&&!reviewPaused&&!reducedReviewMotion.matches){
  moveReviews(reviewPosition+(now-lastReviewFrame)*.075);
 }else if(reviewPaused){
  reviewPosition=reviewWindow.scrollLeft;
 }
 lastReviewFrame=now;
 requestAnimationFrame(animateReviews);
}
reviewWindow.addEventListener('touchstart',pauseReviews,{passive:true});
reviewWindow.addEventListener('touchend',resumeReviewsSoon,{passive:true});
reviewWindow.addEventListener('wheel',event=>{
 const movement=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
 if(!movement)return;
 event.preventDefault();
 pauseReviews();
 moveReviews(reviewPosition+movement);
 resumeReviewsSoon();
},{passive:false});
reviewWindow.addEventListener('keydown',event=>{
 if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
 event.preventDefault();
 pauseReviews();
 moveReviews(reviewPosition+(event.key==='ArrowRight'?180:-180));
 resumeReviewsSoon();
});
requestAnimationFrame(animateReviews);
const workItems=[
 {src:'assets/haircut.png',alt:'Haircut from Erick Rios portfolio',label:'THE CUT'},
 {src:'assets/lineup.png',alt:'Haircut detail from Erick Rios portfolio',label:'THE DETAIL'},
 {src:'assets/haircut-beard.png',alt:'Finished haircut from Erick Rios portfolio',label:'THE FINISH'}
];
const workImage=document.querySelector('#work-image');
const workLabel=document.querySelector('.work-stage-label');
const workButtons=[...document.querySelectorAll('[data-work]')];
let activeWork=0;
function showWork(i,instant=false){
 if(i===activeWork)return;
 activeWork=i;
 workImage.classList.add('changing');
 const update=()=>{workImage.src=workItems[i].src;workImage.alt=workItems[i].alt;workLabel.textContent='ERICK / '+workItems[i].label+' / 0'+(i+1);workImage.classList.remove('changing');};
 if(instant)update();else setTimeout(update,130);
 workButtons.forEach((b,n)=>{b.classList.toggle('active',n===i);b.setAttribute('aria-pressed',String(n===i));});
}
workButtons.forEach((b,i)=>b.addEventListener('click',()=>runCut(()=>showWork(i,true),i===1?'razor':i===2?'brush':'comb',workItems[i].label+'.')));
let scrollFrame=0;
window.addEventListener('scroll',()=>{
 if(scrollFrame)return;
 scrollFrame=requestAnimationFrame(()=>{
  const r=document.querySelector('#work').getBoundingClientRect();
  const span=Math.max(1,r.height-innerHeight);
  const progress=Math.min(1,Math.max(0,-r.top/span));
  if(r.top<innerHeight*0.45&&r.bottom>innerHeight*0.55)showWork(Math.min(2,Math.floor(progress*3)));
  scrollFrame=0;
 });
},{passive:true});
const transition=document.querySelector('.cut-transition');
const cutWord=document.querySelector('.cut-word');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const cutNames={scissors:'SCISSORS / SNIP',clippers:'CLIPPERS / FADE',razor:'RAZOR / EDGE',comb:'COMB / SWEEP',brush:'BRUSH / REVEAL',pole:'POLE / SPIN'};
const toolWords={scissors:'SNIP.',clippers:'CLIP.',razor:'SLICE.',comb:'SWEEP.',brush:'REVEAL.',pole:'SPIN.'};
const toolArt={
 scissors:'<g class="scissor-half scissor-upper"><path class="handle" d="M108 120L82 153"/><ellipse class="handle-loop" cx="57" cy="173" rx="31" ry="25"/><path class="blade" d="M110 120L286 35Q299 30 291 43L132 132Z"/><path class="blade-shine" d="M133 119L271 52"/></g><g class="scissor-half scissor-lower"><path class="handle" d="M108 120L82 88"/><ellipse class="handle-loop" cx="57" cy="68" rx="31" ry="25"/><path class="blade" d="M110 120L286 205Q299 210 291 197L132 108Z"/><path class="blade-shine" d="M133 121L271 188"/></g><circle class="scissor-pivot" cx="110" cy="120" r="15"/><circle class="scissor-pivot-inner" cx="110" cy="120" r="6"/>',
 clippers:'<path class="clipper-body" d="M98 61h126l-13 163H111Z"/><path class="clipper-edge" d="M111 68h100l-4 35H115Z"/><g class="clipper-teeth"><path d="M111 64V23h16v41M131 64V19h16v45M151 64V15h16v49M171 64V19h16v45M191 64V23h16v41"/></g><path class="clipper-grip" d="M127 138h68M127 153h68M127 168h68"/><circle class="clipper-switch" cx="161" cy="196" r="12"/>',
 razor:'<path class="razor-handle" d="M45 171Q98 128 154 163L234 211 217 230 141 191Q95 170 56 199Z"/><circle class="razor-pivot" cx="150" cy="171" r="12"/><g class="razor-fold"><path class="razor-blade" d="M147 169L248 26 283 43 197 178Z"/><path class="razor-shine" d="M166 163L256 47"/></g>',
 comb:'<path class="comb-back" d="M29 61h259v39H29z"/><g class="comb-teeth"><path d="M40 100v130M59 100v130M78 100v130M97 100v130M116 100v130M135 100v130M154 100v130M173 100v130M192 100v130M211 100v130M230 100v130M249 100v130M268 100v130"/></g>',
 brush:'<path class="brush-body" d="M90 30h143v135H90z"/><path class="brush-grip" d="M145 165h33v78h-33z"/><g class="brush-bristles"><path d="M105 165v57M124 165v57M143 165v57M162 165v57M181 165v57M200 165v57M219 165v57"/></g>',
 pole:'<path class="pole-body" d="M101 27h117v205H101z"/><path class="pole-cap-live" d="M91 17h137v20H91zM91 222h137v20H91z"/><g class="pole-stripes"><path d="M102 66l68-39M102 116l116-67M102 166l116-67M102 216l116-67M151 232l67-39"/></g>'
};
const movingParts={clippers:['clipper-teeth','clippers-teeth'],razor:['razor-fold','razor-blade-part'],comb:['comb-teeth','comb-teeth-part'],brush:['brush-bristles','brush-bristles-part'],pole:['pole-stripes','pole-stripes-part']};
function piece(name,art){const metal='<defs><linearGradient id="steel-'+name+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".38" stop-color="#abb2b3"/><stop offset=".64" stop-color="#f5f6f3"/><stop offset="1" stop-color="#6d7678"/></linearGradient></defs>';art=art.replace(/class="(blade|razor-blade)"/g,(_,kind)=>'class="'+kind+'" style="fill:url(#steel-'+name+')"');return '<svg class="cut-piece" style="view-transition-name:'+name+'" viewBox="0 0 320 250" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+metal+art+'</svg>';}
function cutPieces(mode){
 const art=toolArt[mode];
 if(mode==='scissors'){
  const upper=art.match(/<g class="scissor-half scissor-upper">[\s\S]*?<\/g>/)[0];
  const lower=art.match(/<g class="scissor-half scissor-lower">[\s\S]*?<\/g>/)[0];
  const pivot=art.slice(art.indexOf('</g>',art.indexOf('scissor-lower'))+4);
  const sparks='<g class="scissor-sparks"><path d="M283 83v-28M283 157v28M245 120h-27M312 120h-23M253 91l-20-20M253 149l-20 20M304 91l16-16M304 149l16 16"/></g>';
  return piece('scissor-upper',upper+pivot)+piece('scissor-lower',lower)+piece('scissor-sparks',sparks);
 }
 const [group,name]=movingParts[mode];
 const start=art.indexOf('<g class="'+group+'">');
 const moving=art.slice(start,art.indexOf('</g>',start)+4);
 return piece(mode+'-base',art.replace(moving,''))+piece(name,moving);
}
let cutBusy=false;
let queuedCut=null;
function finishCut(){
 transition.classList.remove('is-armed','fallback');
 cutWord.classList.remove('is-armed');
 cutBusy=false;
 delete document.documentElement.dataset.cut;
 if(queuedCut){const next=queuedCut;queuedCut=null;runCut(next.update,next.mode,next.caption);}
}
function runCut(update,mode='scissors',caption){
 if(reducedMotion.matches){update();return;}
 if(cutBusy){queuedCut={update,mode,caption};return;}
 cutBusy=true;
 document.documentElement.dataset.cut=mode;
 transition.innerHTML=cutPieces(mode);
 transition.classList.add('is-armed');
 cutWord.textContent=caption||toolWords[mode];
 cutWord.classList.add('is-armed');
 if(document.startViewTransition){
  const cut=document.startViewTransition(()=>{transition.classList.remove('is-armed');cutWord.classList.remove('is-armed');update();});
  cut.finished.finally(finishCut);
 }else{
  transition.classList.add('fallback');
  setTimeout(update,850);
  setTimeout(finishCut,1500);
 }
}
const sectionTools={top:'pole',booking:'scissors',barbers:'clippers',services:'comb',work:'razor',visit:'brush',faq:'brush'};
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
 const target=document.querySelector(a.getAttribute('href'));
 if(!target)return;
 e.preventDefault();
 const card=a.closest('.service-card');
 const cardIndex=card?[...document.querySelectorAll('.service-card')].indexOf(card):-1;
 const fromBarber=a.classList.contains('detail-action');
 const mode=cardIndex>=0?['scissors','clippers','razor','brush'][cardIndex]:fromBarber?'clippers':sectionTools[target.id]||'scissors';
 runCut(()=>{
  if(menu.classList.contains('open'))setMenu(false);
  if(cardIndex>=0){booking.service=cardIndex;booking.step=2;renderBookingNow();}
  if(fromBarber){booking.barber=selectedProfile;booking.step=1;renderBookingNow();}
  target.scrollIntoView({behavior:'instant'});
  history.replaceState(null,'','#'+target.id);
 },mode,cardIndex>=0?['THE CUT.','THE COMBO.','THE DETAIL.','THE SHAVE.'][cardIndex]:fromBarber?selectedProfile.toUpperCase()+'.':({top:'HOME.',booking:'BOOK.',barbers:'THE TEAM.',services:'SERVICES.',work:'THE WORK.',visit:'PILSEN.',faq:'THE DETAILS.'})[target.id]);
}));
document.querySelectorAll('.faq-list summary').forEach(summary=>summary.addEventListener('click',e=>{
 e.preventDefault();
 runCut(()=>{summary.parentElement.open=!summary.parentElement.open;},'brush');
}));
