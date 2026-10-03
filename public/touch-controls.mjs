// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
export function touchControls({canPlay, move, bomb, action, chat}) {
  const root = document.getElementById('touch-controls');
  const pad = root.querySelector('.touch-pad');
  const media = matchMedia('(pointer: coarse) and (hover: none)');
  pad.innerHTML = '<div class="joystick-ring"><span class="joystick-thumb"></span></div><span class="joystick-label">移动</span>';
  pad.setAttribute('aria-label','移动摇杆');
  const thumb = pad.querySelector('.joystick-thumb');
  let pointer = null, direction = null, origin = null;
  const setDirection = next => {
    if (direction === next) return;
    direction = next; move(next);
  };
  const stop = () => {
    pointer = null; origin = null; setDirection(null); thumb.style.transform = 'translate(-50%, -50%)';
    pad.classList.remove('held');
  };
  const steer = e => {
    const r = pad.getBoundingClientRect(), radius = Math.min(r.width,r.height)*.3;
    let x=e.clientX-(origin?.x ?? r.left+r.width/2), y=e.clientY-(origin?.y ?? r.top+r.height/2);
    const distance=Math.hypot(x,y), scale=Math.min(1,radius/(distance||1));
    x*=scale;y*=scale;
    thumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    setDirection(joystickDirection(x/radius,y/radius,direction));
  };
  pad.addEventListener('pointerdown', e => {
    if (!canPlay() || pointer !== null) return;
    e.preventDefault(); origin={x:e.clientX,y:e.clientY}; pointer=e.pointerId; pad.setPointerCapture(pointer);pad.classList.add('held');steer(e);
  });
  pad.addEventListener('pointermove', e => { if(e.pointerId===pointer){if(canPlay())steer(e);else stop();} });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) pad.addEventListener(event,e=>{if(e.pointerId===pointer)stop();});
  window.addEventListener('blur', stop);
  window.addEventListener('resize', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  root.addEventListener('contextmenu', e => e.preventDefault());
  document.getElementById('touch-bomb').addEventListener('pointerdown', e => { e.preventDefault(); if(canPlay()) bomb(); });
  // Keyboard/assistive activation remains available without duplicating touch clicks.
  document.getElementById('touch-bomb').onclick = e => { if(e.detail === 0 && canPlay()) bomb(); };
  document.getElementById('touch-chat').onclick = chat;
  for(const button of root.querySelectorAll('[data-touch-action]')) button.onclick = () => { if(canPlay()) action(button.dataset.touchAction); };
  const links = [['touch-character','character-skill-use'],['touch-skill','skill-use'],['touch-dome','bio-dome'],['touch-antidote','bio-antidote'],['touch-cycle','cycle-bomb'],['touch-detonate','detonate-bomb']];
  for(const [target,source] of links) document.getElementById(target).onclick = () => { if(canPlay()) document.getElementById(source).click(); };
  const paths={
    'touch-bomb':'<circle cx="24" cy="25" r="16"/><path d="M14 22q0-8 8-8M30 11l3-5m-4-1h8"/>',
    'touch-character':'<path d="m24 5 6 12 13 2-10 10 2 14-11-7-12 7 3-14L5 19l13-2Z"/>',
    'touch-skill':'<path d="m28 4-17 23h12l-3 17 18-26H26Z"/>',
    'touch-dome':'<path d="M6 36a18 18 0 0 1 36 0ZM24 8v-4M7 15l-4-4m38 4 4-4"/><circle cx="24" cy="27" r="5"/>',
    'touch-antidote':'<path d="M19 5h10v10l8 12v14H11V27l8-12ZM18 28h12m-6-6v12"/>',
    'touch-cycle':'<path d="M9 19a16 16 0 0 1 29-6l3 6m0-12v12H29M39 29a16 16 0 0 1-29 6l-3-6m0 12V29h12"/>',
    'touch-detonate':'<rect x="12" y="17" width="24" height="26" rx="5"/><path d="M24 17V5m-6 1h12"/><circle cx="24" cy="30" r="5"/>',
    'touch-chat':'<path d="M5 7h38v27H22L10 43v-9H5ZM13 17h22m-22 8h16"/>',
    'use-fork':'<path d="M16 4v14q0 8 8 8v18M24 4v22M32 4v14q0 8-8 8"/>',
    'place-banana':'<path d="M34 5q7 30-23 31-6 0-7-5 27 3 26-22Z"/>',
    'place-smile':'<circle cx="24" cy="24" r="18"/><path d="M15 28q9 12 18 0M17 15v6m14-6v6"/>'
  };
  for(const button of root.querySelectorAll('button')){
    const label=button.textContent;button.setAttribute('aria-label',label);button.title=label;
    button.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true">'+(paths[button.id] || paths[button.dataset.touchAction] || paths['touch-skill'])+'</svg><span class="touch-cooldown"></span>';
  }
  const sync = () => {
    root.hidden = !media.matches || document.body.dataset.screen !== 'game' || !!document.body.dataset.lobbyPage;
    if (root.hidden || !canPlay()) stop();
    for(const [target,source] of links){
      const a=document.getElementById(target), b=document.getElementById(source);
      a.hidden = b.hidden || !!b.parentElement.closest('[hidden]'); a.disabled=b.disabled;
      const label=b.textContent.replace(/^[QERFG]\s*/, '').replace(/ Lv\.\d+/, '').replace(/　/g, ' ');
      a.setAttribute('aria-label',label);a.title=label;
      a.querySelector('.touch-cooldown').textContent=label.match(/(\d+)s/)?.[1] || '';

    }
  };
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-screen','data-lobby-page','data-picking']});
  const observer=new MutationObserver(sync);
  observer.observe(document.getElementById('combat-tools'),{attributes:true,childList:true,subtree:true,characterData:true,attributeFilter:['hidden','disabled']});
  media.addEventListener('change',sync); sync();
}

// Four-way engine movement with a circular dead zone; visual thumb remains analog.
export function joystickDirection(x,y,previous=null) {
  if(Math.hypot(x,y)<.12)return null;
  if(previous && Math.abs(Math.abs(x)-Math.abs(y))<.12){
    if((previous==='left'&&x<0)||(previous==='right'&&x>0)||(previous==='up'&&y<0)||(previous==='down'&&y>0))return previous;
  }
  return Math.abs(x)>Math.abs(y) ? (x>0?'right':'left') : (y>0?'down':'up');
}

export function landscapeControls(){
  const panel=document.createElement('section');panel.id='landscape-prompt';panel.setAttribute('aria-label','横屏游戏提示');
  panel.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="12" y="28" width="76" height="44" rx="5"/><path d="M23 43v14m-7-7h14M70 44h2m5 10h2M32 15Q60 0 80 20m-1-10 1 10-10-1"/></svg><h2>横屏游玩，视野更完整</h2><p id="landscape-note">请横置手机。横屏可同时显示地图、操作按钮与小镇交流。</p><button id="landscape-enter" class="gold-button">全屏并尝试横屏</button><button id="landscape-dismiss" class="blue-button">暂时使用竖屏</button>';
  document.body.append(panel);
  document.getElementById('landscape-dismiss').onclick=()=>{panel.hidden=true;};
  document.getElementById('landscape-enter').onclick=async()=>{
    try{if(!document.fullscreenElement && document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();await screen.orientation.lock('landscape');}
    catch{document.getElementById('landscape-note').textContent='此浏览器不支持自动横屏，请关闭手机方向锁定后横置手机。';}
  };
}
