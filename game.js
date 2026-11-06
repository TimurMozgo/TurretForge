'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const tg=window.Telegram?.WebApp;
try{tg?.ready();tg?.expand();if(tg?.isVersionAtLeast('6.1')){tg.setHeaderColor('#14252b');tg.setBackgroundColor('#14252b')}if(tg?.isVersionAtLeast('7.7'))tg.disableVerticalSwipes()}catch(e){console.info('Telegram',e.message)}
const outcomeAudio={victory:new Audio('assets/victory.mp3'),defeat:new Audio('assets/defeat.mp3')};
for(const a of Object.values(outcomeAudio)){a.volume=.18;a.preload='auto'}
function stopOutcome(){for(const a of Object.values(outcomeAudio)){a.pause();a.currentTime=0}}
function playOutcome(kind){stopOutcome();if(!state.sound)return;outcomeAudio[kind].play().catch(()=>{})}
let view={sx:1,sy:1,top:0,w:420,h:540,dpr:1,unit:1};
function resizeField(){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),compact=r.height<500;
 const badgeRect=document.getElementById("status").getBoundingClientRect(); const top=Math.max(compact?122:132,(badgeRect.bottom||0)+8),bottom=compact?70:115;
 view={sx:r.width/420,sy:Math.max(180,r.height-top-bottom)/540,top,w:r.width,h:r.height,dpr,unit:1};view.unit=Math.min(view.sx,view.sy*1.35);
 canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
}
window.addEventListener('resize',resizeField);try{tg?.onEvent('viewportChanged',resizeField)}catch{}resizeField();
const KEY='turret-forge-v1',fresh=()=>({coins:180,hp:100,wave:1,best:1,slots:[1,1,0,0,0,0,0,0,0,0,0,0],sound:true});
let state=fresh();try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&Number.isFinite(s.coins)&&s.coins>=0&&Number.isInteger(s.best)&&s.best>=1&&Number.isInteger(s.wave)&&s.wave>0&&s.wave<=10000&&s.hp>=0&&s.hp<=100&&Array.isArray(s.slots)&&s.slots.length===12&&s.slots.every(n=>Number.isInteger(n)&&n>=0&&n<=20))state={...state,...s}}catch{}
let running=false,started=false,selected=-1,enemies=[],shots=[],particles=[],cool=Array(12).fill(0),spawn=0,spawned=0,killed=0,delay=1,clock=0,last=0,saveTime=0,audio,drag=-1,down=null;
const TYPES=[
{id:'GreenBeetle',hp:1,speed:25,armor:0,color:'#9ddf76'},
{id:'OrangeBeetle',hp:.7,speed:43,armor:0,color:'#ffc16d'},
{id:'BlueBeetle',hp:1.4,speed:23,armor:.2,color:'#86c9ff'},
{id:'FlyingBlue',hp:.8,speed:37,armor:0,color:'#83e5ff',fly:true},
{id:'BlackBeetle',hp:2,speed:19,armor:.3,color:'#b2abbc'},
{id:'FlyingOrange',hp:.75,speed:46,armor:0,color:'#ffbf72',fly:true},
{id:'HybridGreen',hp:1.25,speed:23,armor:.1,color:'#bbef9c',hybrid:true},
{id:'PurpleBeetle',hp:1.1,speed:32,armor:.1,color:'#d4a0ef'},
{id:'HornBeetle',hp:2.7,speed:18,armor:.4,color:'#dfb780'},
{id:'FlyingBrown',hp:1.2,speed:34,armor:.15,color:'#dfbb88',fly:true},
{id:'HybridBlue',hp:1.5,speed:24,armor:.15,color:'#8acbff',hybrid:true},
{id:'RedBeetle',hp:1,speed:39,armor:0,color:'#ff8a80'},
{id:'DarkBeetle',hp:2.2,speed:21,armor:.35,color:'#c6a6c9'},
{id:'HybridPur',hp:1.6,speed:25,armor:.15,color:'#e2a3ff',hybrid:true},
{id:'HybridRed',hp:1.4,speed:30,armor:.1,color:'#ff9a9a',hybrid:true}];
const ANIM={
  "HybridRed-StartFly": 20,
  "HybridBlue-StartFly": 20,
  "HybridBlue-Move": 30,
  "FlyingOrange": 20,
  "FlyingBlue": 20,
  "HybridRed-Move": 30,
  "HornBeetle": 20,
  "HybridPur-StartFly": 20,
  "HybridGreen-StartFly": 20,
  "HybridPur-Move": 30,
  "FlyingBrown": 20,
  "OrangeBeetle": 20,
  "HybridRed-Flying": 20,
  "HybridGreen-Move": 30,
  "HybridGreen-Flying": 20,
  "HybridBlue-Flying": 20,
  "GreenBeetle": 20,
  "RedBeetle": 20,
  "BlueBeetle": 20,
  "BlackBeetle": 20,
  "DarkBeetle": 20,
  "PurpleBeetle": 20,
  "HybridPur-Flying": 20
}
;
let bullets=[],packLeft=0,enemyId=0,pulseCooldown=0;
const art={};function load(name,url){return new Promise(resolve=>{const i=new Image();i.onload=()=>{art[name]=i;resolve()};i.onerror=()=>resolve();i.src=url})}let ready=false;Promise.all([load('bg','assets/background.png'),...Object.keys(ANIM).map(k=>load(k,'assets/animated/'+k+'.png')),...Array.from({length:20},(_,i)=>load('t'+(i+1),'assets/t'+(i+1)+'.png'))]).then(()=>{ready=true;hud()});
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('saved').textContent='Прогресс сохранён'}catch{$('saved').textContent='Сохранение недоступно'}}
function unlock(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume()}catch{}}
function tone(freq,dur,type='sine',vol=.06,offset=0,end=freq){if(!state.sound||!audio)return;const t=audio.currentTime+offset,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+dur)}
function sound(kind){if(kind==='shot')tone(170,.065,'triangle',.035,0,45);if(kind==='merge')[392,523,784].forEach((f,i)=>tone(f,.19,'sine',.1,i*.07));if(kind==='buy')tone(520,.12,'sine');if(kind==='hit')tone(70,.18,'sawtooth',.07,0,25);if(kind==='wave')playOutcome('victory')}
function haptic(){try{if(tg?.isVersionAtLeast('6.1'))tg.HapticFeedback.impactOccurred('light')}catch{}}
const pos=i=>({x:66+(i%4)*96,y:342+Math.floor(i/4)*71});
function hud(){ $('coins').textContent=Math.floor(state.coins);$('wave').textContent=String(state.wave).padStart(2,'0');$('best').textContent=String(state.best).padStart(2,'0');$('hp').textContent=Math.ceil(state.hp)+'%';$('health').style.width=state.hp+'%';$('sound').textContent=state.sound?'♫ Звук: включён':'♫ Звук: выключен';$('sound').setAttribute('aria-pressed',String(state.sound));$('buy').disabled=!running||state.coins<50||!state.slots.includes(0);$('repair').disabled=!running||state.coins<80||state.hp>=100;$('pause').disabled=!started;$('pulse').disabled=!running||pulseCooldown>0;$('pulse').textContent=pulseCooldown>0?'Импульс · '+Math.ceil(pulseCooldown)+' с':'ϟ Импульс';$('status').textContent=running?(delay>0?'ВОЛНА '+state.wave+' • ПРИГОТОВЬСЯ':'ВОЛНА '+state.wave+' • '+killed+'/'+total()):'ОБОРОНА ПЕРИМЕТРА'}
function hint(s){$('hint').textContent=s}function burst(x,y,color,n=14){for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,v=20+Math.random()*100;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.6,color})}}
function total(){return 10+Math.min(38,state.wave*2)}
function spawnEnemy(){
 const pool=TYPES.slice(0,Math.min(15,3+(state.wave-1)*2));
 const boss=state.wave%5===0&&spawned===total()-1;
 const type=boss?TYPES[8]:pool[(spawned+state.wave-1)%pool.length];
 const max=48*Math.pow(1.23,state.wave-1)*type.hp*(boss?7:1);
 enemies.push({id:++enemyId,type,x:45+Math.random()*330,y:-35,hp:max,max,speed:type.speed*(1+Math.min(.6,state.wave*.025))*(boss?.72:1),size:boss?83:(type.fly?53:58),age:0,boss,hit:0,slow:0,phase:'Move'});spawned++;
}
function damage(e,amount){if(e.hp<=0)return;e.hp-=amount*(1-e.type.armor);e.hit=.12;if(e.hp<=0){killed++;state.coins+=(e.boss?75:7+Math.floor(state.wave/3));burst(e.x,e.y,e.type.color,e.boss?35:14)}}
function resetBattle(){enemies=[];bullets=[];shots=[];particles=[];cool.fill(0);spawned=killed=packLeft=0;delay=3;spawn=0;selected=-1;pulseCooldown=0}
$('pulse').onclick=()=>{unlock();if(!running||pulseCooldown>0)return;pulseCooldown=25;for(const e of enemies){if(e.y>40){damage(e,32*Math.pow(1.17,state.wave-1));e.slow=3;burst(e.x,e.y,'#86e6ff',8)}}sound('merge');haptic();hint('Импульс: враги замедлены на 3 секунды.');hud()};
$('newgame').onclick=()=>{if(running)pause();modal('Новый поход?', 'Начать с первой волны и стартовых турелей? Рекорд останется.','Начать заново →');$('start').onclick=()=>{const best=state.best,soundSetting=state.sound;state=fresh();state.best=best;state.sound=soundSetting;resetBattle();save();startGame();$('start').onclick=startGame}};
function select(i){if(!running||i<0)return;if(selected<0){if(state.slots[i]){selected=i;hint('Выбери такую же турель для слияния или пустую клетку.')}return}const a=state.slots[selected],b=state.slots[i];if(selected===i){selected=-1;return}if(!b){state.slots[i]=a;state.slots[selected]=0;selected=-1;hint('Турель перемещена.')}else if(a===b&&a<20){state.slots[i]++;state.slots[selected]=0;selected=-1;const p=pos(i);burst(p.x,p.y,'#d6ff80',30);sound('merge');haptic();hint('Слияние! Турель уровня '+state.slots[i]+'.')}else{selected=i;hint(a===20&&b===20?'Достигнут максимальный уровень.':'Для слияния нужны одинаковые уровни.')}save();hud()}
function cell(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/view.sx,y=(e.clientY-r.top-view.top)/view.sy;return Array.from({length:12},(_,i)=>i).find(i=>{const p=pos(i);return Math.abs(x-p.x)<45&&Math.abs(y-p.y)<34})??-1}
canvas.addEventListener('pointerdown',e=>{unlock();drag=cell(e);down={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointerup',e=>{const target=cell(e);if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>12){if(drag>=0&&state.slots[drag]){selected=drag;if(target>=0)select(target)}}else select(target);drag=-1;down=null});canvas.addEventListener('pointercancel',()=>{drag=-1;down=null});
$('buy').onclick=()=>{unlock();if(!running||state.coins<50)return;const i=state.slots.indexOf(0);if(i<0)return;state.coins-=50;state.slots[i]=1;sound('buy');burst(pos(i).x,pos(i).y,'#fff1ab');hint('Новая турель готова. Объединяй одинаковые!');save();hud()};
$('repair').onclick=()=>{if(!running||state.coins<80||state.hp>=100)return;state.coins-=80;state.hp=Math.min(100,state.hp+35);sound('buy');save();hud()};
$('sound').onclick=()=>{unlock();state.sound=!state.sound;if(!state.sound)stopOutcome();save();hud()};
function modal(title,desc,button){$('overlay').classList.toggle('pause-sheet',title==='Пауза'||title==='Новый поход?');$('pauseSettings').hidden=title!=='Пауза';$('title').innerHTML=title;$('description').textContent=desc;$('start').textContent=button;$('closeModal').hidden=title!=='Пауза'&&title!=='Новый поход?';$('overlay').classList.remove('hidden');$('overlay').removeAttribute('inert')}
$('closeModal').onclick=()=>{ $('start').onclick=startGame;if(started&&state.hp>0)startGame();else{modal('Держи<br>оборону.','Покупай турели, объединяй одинаковые и защищай базу.','Начать оборону →')}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(running)pause();else if(!$('closeModal').hidden)$('closeModal').onclick()}});
function pause(){if(!running)return;running=false;save();modal('Пауза', 'Турели ждут приказа. Прогресс сохранён на этом устройстве.','Продолжить →');hud()}
$('pause').onclick=pause;document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});try{tg?.onEvent('deactivated',pause)}catch{}
function startGame(){unlock();stopOutcome();if(!ready){hint('Графика загружается…');return}if(state.hp<=0){const best=state.best,soundSetting=state.sound;state=fresh();state.best=best;state.sound=soundSetting;enemies=[];shots=[];particles=[];cool.fill(0);spawned=killed=packLeft=0;delay=3;spawn=0;selected=-1;bullets=[];pulseCooldown=0}started=true;running=true;$('overlay').classList.add('hidden');$('overlay').setAttribute('inert','');hud()};$('start').onclick=startGame;
function step(dt){
 clock+=dt;pulseCooldown=Math.max(0,pulseCooldown-dt);
 if(delay>0)delay-=dt;else{spawn-=dt;if(spawn<=0&&spawned<total()){if(!packLeft)packLeft=Math.min(3+Math.floor(state.wave/3),total()-spawned);spawnEnemy();packLeft--;spawn=packLeft?.26:Math.max(1.5,3.2-state.wave*.06)}}
 for(const e of enemies){if(e.hp<=0)continue;e.age+=dt;e.hit=Math.max(0,e.hit-dt);e.slow=Math.max(0,e.slow-dt);
 if(e.type.hybrid&&e.y>115&&e.phase==='Move'){e.phase='StartFly';e.transition=.8}
 if(e.phase==='StartFly'){e.transition-=dt;if(e.transition<=0)e.phase='Flying'}
 const flying=e.type.fly||e.phase==='Flying';
 e.y+=e.speed*dt*(flying?1.2:1)*(e.phase==='StartFly'?.3:1)*(e.slow>0?.4:1);
 if(flying)e.x=Math.max(25,Math.min(395,e.x+Math.sin(e.age*3+e.id)*dt*18));
 if(e.y>292){e.hp=0;state.hp=Math.max(0,state.hp-(e.boss?30:e.type.armor>.2?12:7));killed++;sound('hit');burst(e.x,290,'#ff9c65')}
 }
 for(let i=0;i<12;i++){cool[i]-=dt;const lv=state.slots[i];if(!lv||cool[i]>0)continue;const p=pos(i),range=320+Math.min(30,lv*3);
 const target=enemies.filter(e=>e.hp>0&&e.y>65&&Math.hypot(e.x-p.x,e.y-p.y)<range).sort((a,b)=>b.y-a.y)[0];if(!target)continue;
 bullets.push({x:p.x,y:p.y-26,target,damage:10*Math.pow(2.1,lv-1),life:2,color:lv>2?'#91edff':'#ffe3a0'});cool[i]=Math.max(.42,.85-lv*.015);sound('shot');
 }
 for(const b of bullets){b.life-=dt;if(b.target.hp<=0){b.life=0;continue}const dx=b.target.x-b.x,dy=b.target.y-b.y,d=Math.hypot(dx,dy),travel=460*dt;if(d<travel+9){damage(b.target,b.damage);b.life=0}else{b.x+=dx/d*travel;b.y+=dy/d*travel}}
 bullets=bullets.filter(b=>b.life>0);enemies=enemies.filter(e=>e.hp>0);
 if(state.hp<=0){running=false;playOutcome('defeat');state.best=Math.max(state.best,state.wave);save();modal('База потеряна','Волна '+state.wave+'. Ставь сильные турели ближе к фронту и используй импульс против групп.','Попробовать снова →');hud();return}
 if(spawned>=total()&&!enemies.length){state.coins+=25+state.wave*3;state.wave++;state.best=Math.max(state.best,state.wave);state.hp=Math.min(100,state.hp+4);spawned=killed=packLeft=0;delay=4;spawn=0;bullets=[];sound('wave');hint(state.wave%5===0?'Внимание: к рою присоединится бронированный босс!':'Передышка. Усиль передний ряд и подготовься к новой волне.');save()}
 saveTime+=dt;if(saveTime>3){saveTime=0;save()}hud()
}
function sprite(img,x,y,w,h=w,angle=0){if(!img)return;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(view.unit/view.sx,view.unit/view.sy);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore()}
function draw(dt){ctx.setTransform(view.dpr,0,0,view.dpr,0,0);ctx.clearRect(0,0,view.w,view.h);if(art.bg)ctx.drawImage(art.bg,0,0,view.w,view.h);else{ctx.fillStyle='#536744';ctx.fillRect(0,0,view.w,view.h)}ctx.fillStyle='#11292285';ctx.fillRect(0,0,view.w,view.top);ctx.fillRect(0,view.top+540*view.sy,view.w,view.h);ctx.setTransform(view.dpr*view.sx,0,0,view.dpr*view.sy,0,view.top*view.dpr);if(art.bg)ctx.drawImage(art.bg,0,0,420,540);else{ctx.fillStyle='#7c855b';ctx.fillRect(0,0,420,540)}ctx.fillStyle='#18271c30';ctx.fillRect(0,0,420,300);ctx.strokeStyle='#e6e8b575';ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(0,295);ctx.lineTo(420,295);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#172c30df';ctx.fillRect(0,305,420,235);
ctx.fillStyle='#b5c6a9';ctx.font='9px Segoe UI';ctx.textAlign='center';ctx.fillText('ЛИНИЯ ОБОРОНЫ',210,286);
for(let i=0;i<12;i++){const p=pos(i);ctx.fillStyle=selected===i?'#b8e47755':'#ffffff09';ctx.strokeStyle=selected===i?'#d3ff8e':'#70877a70';ctx.lineWidth=selected===i?2:1;ctx.beginPath();ctx.roundRect(p.x-42,p.y-32,84,64,10);ctx.fill();ctx.stroke();if(state.slots[i]){const recoil=cool[i]>.7?2:0;sprite(art['t'+state.slots[i]],p.x,p.y+recoil,125)}else{ctx.fillStyle='#638078';ctx.font='18px Segoe UI';ctx.fillText('+',p.x,p.y+6)}}
for(const e of enemies){const key=e.type.hybrid?e.type.id+'-'+e.phase:e.type.id,img=art[key],count=ANIM[key]||20;const f=e.phase==='StartFly'?Math.min(count-1,Math.floor((.8-e.transition)/.8*count)):Math.floor(e.age*20)%count;
 ctx.fillStyle='#00000035';ctx.beginPath();ctx.ellipse(e.x,e.y+e.size*.3,e.size*.3,e.size*.12,0,0,Math.PI*2);ctx.fill();
 if(img){ctx.save();ctx.globalAlpha=e.hit>0?.65:1;ctx.drawImage(img,128*f,0,128,128,e.x-e.size*view.unit/view.sx/2,e.y-e.size*view.unit/view.sy/2,e.size*view.unit/view.sx,e.size*view.unit/view.sy);ctx.restore()}
 ctx.fillStyle='#1e2420';ctx.fillRect(e.x-22,e.y-e.size/2-5,44,5);ctx.fillStyle=e.slow>0?'#86e6ff':e.type.color;ctx.fillRect(e.x-22,e.y-e.size/2-5,44*Math.max(0,e.hp/e.max),5);
 if(e.type.armor>0){ctx.fillStyle='#e3e8e7';ctx.font='9px Segoe UI';ctx.fillText(e.boss?'БОСС':'◆',e.x,e.y-e.size/2-10)}
 }
 for(const b of bullets){ctx.fillStyle=b.color;ctx.shadowColor=b.color;ctx.shadowBlur=9;ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
 if(selected>=0){const p=pos(selected);ctx.save();ctx.beginPath();ctx.rect(0,0,420,295);ctx.clip();ctx.strokeStyle='#c9f67888';ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(p.x,p.y,320+Math.min(30,state.slots[selected]*3),0,Math.PI*2);ctx.stroke();ctx.restore()}
for(const s of shots){ctx.globalAlpha=s.life/.13;ctx.strokeStyle='#fff5b0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.tx,s.ty);ctx.stroke();if(running)s.life-=dt}ctx.globalAlpha=1;shots=shots.filter(s=>s.life>0);for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.6);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);if(running){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0)}
function frame(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;if(running)step(dt);draw(dt);requestAnimationFrame(frame)}hud();requestAnimationFrame(frame);



// Dismiss the pause sheet through its backdrop or a downward drag.
const pauseOverlay=$('overlay'),pausePanel=pauseOverlay.querySelector('.modal');
let pauseDrag=null;
const canDismissPause=()=>!pauseOverlay.classList.contains('hidden')&&$('title').textContent==='Пауза';
pauseOverlay.addEventListener('click',e=>{if(e.target===pauseOverlay&&canDismissPause())$('closeModal').onclick()});
pausePanel.addEventListener('pointerdown',e=>{
 if(!canDismissPause()||e.button!==0||e.target.closest('button,input,a')||pausePanel.scrollTop>0)return;
 pauseDrag={id:e.pointerId,x:e.clientX,y:e.clientY,dy:0,active:false};
 pausePanel.setPointerCapture(e.pointerId);
});
pausePanel.addEventListener('pointermove',e=>{
 if(!pauseDrag||pauseDrag.id!==e.pointerId)return;
 const dx=e.clientX-pauseDrag.x,dy=e.clientY-pauseDrag.y;
 if(!pauseDrag.active){if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)){pauseDrag=null;return}if(dy<8)return;pauseDrag.active=true;pausePanel.classList.add('dragging')}
 pauseDrag.dy=Math.max(0,dy);pausePanel.style.setProperty('--sheet-drag',pauseDrag.dy+'px');
});
function finishPauseDrag(e,cancelled=false){
 if(!pauseDrag||pauseDrag.id!==e.pointerId)return;
 const close=!cancelled&&pauseDrag.active&&pauseDrag.dy>=Math.min(90,pausePanel.clientHeight*.22);
 pauseDrag=null;pausePanel.classList.remove('dragging');
 if(close&&canDismissPause())$('closeModal').onclick();
 pausePanel.style.removeProperty('--sheet-drag');
}
pausePanel.addEventListener('pointerup',e=>finishPauseDrag(e));
pausePanel.addEventListener('pointercancel',e=>finishPauseDrag(e,true));
pausePanel.addEventListener('lostpointercapture',e=>finishPauseDrag(e,true));
