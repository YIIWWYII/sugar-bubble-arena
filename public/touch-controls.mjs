export function touchControls({canPlay, move, bomb, action, chat}) {
  const root = document.getElementById('touch-controls');
  const pad = root.querySelector('.touch-pad');
  const media = matchMedia('(pointer: coarse) and (hover: none)');
  pad.innerHTML = '<div class="joystick-ring"><span class="joystick-thumb"></span></div><span class="joystick-label">移动</span>';
  pad.setAttribute('aria-label','移动摇杆');
  const thumb = pad.querySelector('.joystick-thumb');
  let pointer = null, direction = null;
  const setDirection = next => {
    if (direction === next) return;
    direction = next; move(next);
  };
  const stop = () => {
    pointer = null; setDirection(null); thumb.style.transform = 'translate(-50%, -50%)';
    pad.classList.remove('held');
  };
  const steer = e => {
    const r = pad.getBoundingClientRect(), radius = Math.min(r.width,r.height)*.3;
    let x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2;
    const distance=Math.hypot(x,y), scale=Math.min(1,radius/(distance||1));
    x*=scale;y*=scale;
    thumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    setDirection(joystickDirection(x/radius,y/radius));
  };
  pad.addEventListener('pointerdown', e => {
    if (!canPlay() || pointer !== null) return;
    e.preventDefault(); pointer=e.pointerId; pad.setPointerCapture(pointer);pad.classList.add('held');steer(e);
  });
  pad.addEventListener('pointermove', e => { if(e.pointerId===pointer)steer(e); });
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
  const links = [['touch-skill','skill-use'],['touch-antidote','bio-antidote'],['touch-cycle','cycle-bomb'],['touch-detonate','detonate-bomb']];
  for(const [target,source] of links) document.getElementById(target).onclick = () => { if(canPlay()) document.getElementById(source).click(); };
  const sync = () => {
    root.hidden = !media.matches || document.body.dataset.screen !== 'game' || !!document.body.dataset.lobbyPage;
    if (root.hidden || !canPlay()) stop();
    for(const [target,source] of links){
      const a=document.getElementById(target), b=document.getElementById(source);
      a.hidden = b.hidden || !!b.parentElement.closest('[hidden]'); a.disabled=b.disabled;
      a.textContent=b.textContent.replace(/^[QER4]\s*/, '').replace(/ Lv\.\d+/, '').replace(/　/g, ' ');
    }
  };
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-screen','data-lobby-page','data-picking']});
  const observer=new MutationObserver(sync);
  observer.observe(document.getElementById('combat-tools'),{attributes:true,childList:true,subtree:true,characterData:true,attributeFilter:['hidden','disabled']});
  media.addEventListener('change',sync); sync();
}

// Four-way engine movement with a circular dead zone; visual thumb remains analog.
export function joystickDirection(x,y) {
  if(Math.hypot(x,y)<.2)return null;
  return Math.abs(x)>Math.abs(y) ? (x>0?'right':'left') : (y>0?'down':'up');
}
