export function touchControls({canPlay, move, bomb, action, chat}) {
  const root = document.getElementById('touch-controls');
  const pad = root.querySelector('.touch-pad');
  const media = matchMedia('(any-pointer: coarse), (max-width: 900px)');
  let pointer = null, direction = null;
  const setDirection = next => {
    if (direction === next) return;
    direction = next;
    for (const button of pad.querySelectorAll('button')) button.classList.toggle('held', button.dataset.dir === next);
    move(next);
  };
  const stop = () => { pointer = null; setDirection(null); };
  const at = e => document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-dir]');
  pad.addEventListener('pointerdown', e => {
    if (!canPlay() || pointer !== null) return;
    const button = at(e); if (!button || !pad.contains(button)) return;
    e.preventDefault(); pointer = e.pointerId; pad.setPointerCapture(pointer); setDirection(button.dataset.dir);
  });
  pad.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer) return;
    const button = at(e); setDirection(button && pad.contains(button) ? button.dataset.dir : null);
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture']) pad.addEventListener(event, e => { if (e.pointerId === pointer) stop(); });
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
