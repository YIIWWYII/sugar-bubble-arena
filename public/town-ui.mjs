// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { localMode } from "./local-profile.mjs";
import { bakeTown } from "./town-art.mjs";
import { TOWN, TOWN_RESIDENTS, TOWN_BUILDINGS, stepTown, townPath, townEntrance, townClickedBuilding } from "./town.mjs";
import { appearanceSheet, NPC_DESIGNS } from "./appearance.mjs";
export function townUI({
  send,
  images,
  manifest,
  nickname,
  openLobbyPage,
  closeLobbyPage,
}) {
  const $ = (id) => document.getElementById(id),
    canvas = $("town-canvas"),
    c = canvas.getContext("2d");
  let active = false,
    id = null,
    players = [],
    messages = [],
    target = null,
    held = new Set(),
    camera = { x: 0, y: 0 },
    near = null, nearNPC = null, dismissedEntrance = null,
    connected = true;
  const scene = bakeTown(images, manifest);
  let lastFrame = 0,
    receivedAt = 0;
  const poses = new Map();
  let local = null, command = 0, npcs = [], marker = null, renderedNPCs = [], selectedNPC = null;
  const vector = () => ({
    x:
      Number(held.has("d") || held.has("ArrowRight")) -
      Number(held.has("a") || held.has("ArrowLeft")),
    y:
      Number(held.has("s") || held.has("ArrowDown")) -
      Number(held.has("w") || held.has("ArrowUp")),
  });
  const transmit = () => {
    if (active && connected) {
      marker=null;
      command++;
      if(local){local.path=[];local.input=vector();}
      send({ type: "town-move", ...vector(), command });
    }
  };
  const stop = () => {
    held.clear();
    target = null;
    if(local){local.path=[];local.input={x:0,y:0};local.moving=false;}
    marker=null;
    if (active && connected) send({ type: "town-move", x: 0, y: 0, command:++command });
  };
  $("town-open").onclick = () => openLobbyPage("town-dialog");
  $("town-profile-open").onclick=()=>$("account-open").click();
  $("close-town").onclick = () => closeLobbyPage();
  window.addEventListener("lobby-page-change", (e) => {
    const next = e.detail === "town-dialog" && (localMode || document.body.dataset.multiplayer !== "false");
    if (next && !active) {
      local=null;players=[];npcs=[];renderedNPCs=[];poses.clear();near=null;nearNPC=null;
      active = true;
      send({ type: "town-enter", name: nickname() });
      canvas.focus();
    } else if (active && !next) {
      stop();
      send({ type: "town-leave" });
      active = false;
      closeNPCMenu(); near=null; dismissedEntrance=null; $("town-entry").hidden=true;
      players = [];
      local=null;poses.clear();npcs=[];
    }
  });
  function enterBuilding() {
    if (!near || dismissedEntrance === near.name) return;
    const destination=near.page;
    stop();
    if (localMode && destination === 'rooms-dialog') closeLobbyPage(true);
    else openLobbyPage(destination);
  }
  $('town-entry-confirm').onclick = enterBuilding;
  $('town-entry-cancel').onclick = () => { dismissedEntrance=near?.name; $('town-entry').hidden=true; };
  for(const key of ['close-tea','tea-return'])$(key).onclick=()=>openLobbyPage('town-dialog');
  function closeNPCMenu(){selectedNPC=null;$('town-npc-menu').hidden=true;}
  function showNPCMenu(npc){
    stop();selectedNPC=npc.id;$('town-npc-name').textContent=npc.name;
    $('town-npc-menu').hidden=false;
  }
  $('town-npc-close').onclick=closeNPCMenu;
  for(const button of document.querySelectorAll('[data-npc-action]'))button.onclick=()=>{
    if(!selectedNPC)return;
    window.dispatchEvent(new CustomEvent('town-npc-action',{detail:{id:selectedNPC,action:button.dataset.npcAction}}));
    closeNPCMenu();
  };
  function interact() {
    if(nearNPC){showNPCMenu(nearNPC);return;}
    if (near) { dismissedEntrance=null; $('town-entry').hidden=false; }
  }
  window.addEventListener('keydown',e=>{if(e.key==='Escape' && !$('town-npc-menu').hidden){e.preventDefault();e.stopImmediatePropagation();closeNPCMenu();canvas.focus();}},true);
  $("town-interact").onclick = interact;
  $("town-wave").onclick = () => send({ type: "town-emote" });
  window.addEventListener("keydown", (e) => {
    if (!active || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      return;
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.key)
    ) {
      e.preventDefault();
      target = null;
      closeNPCMenu();
      if (!held.has(e.key)) {
        held.add(e.key);
        transmit();
      }
    }
    if (e.key.toLowerCase() === "e" && !e.repeat) { e.preventDefault();interact(); }
    if (e.key === "Enter") {
      $("town-chat-input").focus();
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (held.delete(e.key)) transmit();
  });
  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  $("town-chat-input").onfocus = stop;
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    target = {
      x: ((e.clientX - r.left - canvas.clientLeft) / (canvas.clientWidth)) * canvas.width + camera.x,
      y: ((e.clientY - r.top - canvas.clientTop) / (canvas.clientHeight)) * canvas.height + camera.y,
    };
    if(!local || !connected) return;
    const clickedNPC=[...renderedNPCs].reverse().find(p=>Math.abs(target.x-p.x)<=34 && target.y>=p.y-74 && target.y<=p.y+20);
    if(clickedNPC){showNPCMenu(clickedNPC);return;}
    closeNPCMenu();
    held.clear();
    const building=townClickedBuilding(target);
    if(building) { target=townEntrance(building); dismissedEntrance=null; }
    const route=townPath(local,target);
    marker={...target,valid:!!route,until:performance.now()+1200};
    local.path=route||[];local.input={x:0,y:0};
    $("town-hint").textContent=route?(building?`正在前往${building.name}入口`:'正在前往目标位置'):'此处无法到达，请点击道路或空地。';
    if(route)send({type:'town-target',...target,command:++command});
    else { const feedback=marker;stop();marker=feedback; }
    canvas.focus();
  });
  const channel=$('town-chat').parentElement;
  if(localMode)channel.querySelector('h2').textContent='小镇聊天 · 本地';
  const note=document.createElement('p');note.className='town-chat-note';
  note.textContent=localMode?'仅本地可见，可与附近 NPC 交流。聊天保存在浏览器数据库中。':'与小镇中的玩家交流。';channel.querySelector('h2').after(note);
  const emotes=document.createElement('div');emotes.className='town-emotes';emotes.setAttribute('aria-label','小镇表情');
  for(const [icon,label] of [['👋','挥手'],['😊','开心'],['😂','大笑'],['👍','赞同'],['🎉','庆祝'],['☕','休息']]){
    const button=document.createElement('button');button.type='button';button.textContent=icon;button.title=label;button.setAttribute('aria-label',label);
    button.onclick=()=>{stop();send({type:'chat',text:icon,name:nickname()});};emotes.append(button);
  }
  $('town-chat-form').before(emotes);
  $('town-chat-form').onsubmit = (e) => {
    e.preventDefault();
    const input = $("town-chat-input");
    if (input.value.trim()) {
      send({ type: "chat", text: input.value, name: nickname() });
      input.value = "";
    }
  };
  function chat() {
    const log = $("town-chat");
    log.replaceChildren();
    for (const m of messages.slice(-30)) {
      const p = document.createElement("p"),
        b = document.createElement("b");
      const legacyNPC=Object.entries(NPC_DESIGNS).find(([key,n])=>n.name===(m.name || m.sender));
      const displayName=m.kind==='npc' && legacyNPC ? TOWN_RESIDENTS[legacyNPC[0]] : m.name || m.sender;
      b.textContent = `${m.kind === "npc" ? "NPC" : localMode || m.player === id ? "玩家 · 你" : "玩家"} · ${displayName}：`;
      p.append(b, document.createTextNode(m.text));
      if(Array.from(m.text).length<=3)p.classList.add("town-chat-emote");
      log.append(p);
    }
    log.scrollTop = log.scrollHeight;
  }
  setInterval(() => {
    if(active && connected && held.size) send({type:'town-move',...vector(),command});
  }, 200);
  const rect = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  function label(text, x, y, color = "#164968", size = 16) {
    c.fillStyle = color;
    c.font = `${size}px "Fusion Pixel",sans-serif`;
    c.textAlign = "center";
    c.fillText(text, x, y);
  }
  function draw(now) {
    requestAnimationFrame(draw);
    if (!active) return;
    const mobile = matchMedia('(pointer:coarse)').matches || innerWidth <= 800,
      landscape = mobile && innerWidth > innerHeight,
      w = landscape ? 640 : mobile ? 480 : 960,
      h = landscape ? 360 : mobile ? 440 : 580;
    canvas.style.aspectRatio = `${w}/${h}`;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if(local){
      const wasWalking=local.path?.length>0;
      stepTown(local,dt);
      if(wasWalking&&!local.path?.length){target=null;if(marker)marker.until=now+500;$("town-hint").textContent='已到达。可点击地面继续移动。';}
    }
    const visible = [...players,...npcs].map((p) => {
      if(p.id===id&&local)return {...p,...local};
      const estimate = { ...p, path:p.path?.map(v=>({...v})), input: p.motion };
      stepTown(estimate, Math.min(0.1, (now - receivedAt) / 1000));
      let pose = poses.get(p.id);
      if (!pose) {
        pose = { x: p.x, y: p.y };
        poses.set(p.id, pose);
      }
      const blend = 1 - Math.exp(-24 * dt);
      pose.x += (estimate.x - pose.x) * blend;
      pose.y += (estimate.y - pose.y) * blend;
      return { ...p, x: pose.x, y: pose.y };
    });
    renderedNPCs=visible.filter(p=>p.npc);
    const me = visible.find((p) => p.id === id);
    camera.x = Math.max(
      0,
      Math.min(TOWN.width - canvas.width, (me?.x || 640) - canvas.width / 2),
    );
    camera.y = Math.max(
      0,
      Math.min(TOWN.height - canvas.height, (me?.y || 570) - canvas.height / 2),
    );
    c.imageSmoothingEnabled = false;
    c.save();
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.translate(-Math.round(camera.x), -Math.round(camera.y));
    if (scene) c.drawImage(scene, 0, 0);
    else {
      c.fillStyle = "#85bd89";
      c.fillRect(0, 0, TOWN.width, TOWN.height);
    }
    if(marker && (local?.path?.length || now<marker.until)){
      c.strokeStyle=marker.valid?'#ffe66d':'#e24c49';c.lineWidth=3;
      c.beginPath();c.ellipse(marker.x,marker.y,14,8,0,0,Math.PI*2);c.stroke();
      c.beginPath();c.moveTo(marker.x-6,marker.y);c.lineTo(marker.x+6,marker.y);c.moveTo(marker.x,marker.y-6);c.lineTo(marker.x,marker.y+6);c.stroke();
    }
    for (const p of visible.sort((a, b) => a.y - b.y)) {
      c.fillStyle = "#33534f44";
      c.beginPath();
      c.ellipse(p.x, p.y + 8, 20, 7, 0, 0, Math.PI * 2);
      c.fill();
      const key = `prince-red-${p.moving ? "walk" : "stand"}-${p.dir ?? 3}`,
        img = images.get(key);
      if (img)
        c.drawImage(
          appearanceSheet(img, key, p.appearance),
          p.moving ? (Math.floor(now / 110) % 6) * 100 : 0,
          0,
          100,
          100,
          Math.round(p.x - 50),
          Math.round(p.y - 74),
          100,
          100,
        );
      if(p.npc && p.activity && p.activity!=='散步')label(p.activity,p.x,p.y+28,'#486578',11);
      label(
        p.name + (p.npc ? " · NPC" : p.id === id ? " · 玩家（你）" : " · 玩家"),
        p.x,
        p.y - 77,
        "#123c59",
        12,
      );
      if (p.bubble && p.bubbleUntil > Date.now()) {
        const text = Array.from(p.bubble).slice(0, 80).join("");
        const lines = text.match(/.{1,18}/gu) || [''], w = Math.min(236,text.length*12+20), h=lines.length*18+12;
        const bx=Math.max(camera.x+w/2+4,Math.min(camera.x+canvas.width-w/2-4,p.x)),by=Math.max(camera.y+4,p.y-92-h);
        rect(bx-w/2,by,w,h,"#f4fcffe6");
        lines.forEach((line,i)=>label(line,bx,by+18+i*18,"#164968",12));
      }
    }
    c.restore();
    near = me
      ? TOWN_BUILDINGS.find(
          (b) => Math.hypot(me.x - b.x - b.w / 2, me.y - b.y - b.h - 18) < 95,
        )
      : null;
    if(!near || dismissedEntrance!==near.name) dismissedEntrance=null;
    $('town-entry').hidden=!!selectedNPC || !near || dismissedEntrance===near.name;
    if(near) $('town-entry-title').textContent=`是否进入${near.name}？`;
    nearNPC=me ? visible.filter(p=>p.npc && Math.hypot(p.x-me.x,p.y-me.y)<90).sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y))[0] : null;
    const button = $("town-interact"),
      title = nearNPC ? `E 与${nearNPC.name}互动` : near ? `E 进入${near.name}` : "E 角色 / 设施交互";
    button.disabled = !near && !nearNPC;
    if (button.textContent !== title) button.textContent = title;
    const count = localMode ? "· 单人漫游" : connected ? `· ${players.length} 人在线` : "· 连接已断开";
    if ($("town-count").textContent !== count)
      $("town-count").textContent = count;
  }
  requestAnimationFrame(draw);
  return {
    message(m) {
      if (m.type === "hello") id = m.id;
      if (m.type === "town-state") {
        if(!active)return;
        players = m.players;
        npcs = m.npcs || [];
        const self=players.find(p=>p.id===id);
        if(self && (!local || self.command===command)) {
          if(!local || Math.hypot(local.x-self.x,local.y-self.y)>100 || (!self.path?.length && !self.moving))
            local={...self,input:self.motion,path:self.path?.map(p=>({...p}))||[]};
        }
        receivedAt = performance.now();
        for (const key of poses.keys())
          if (![...players,...npcs].some((p) => p.id === key)) poses.delete(key);
      }
      if(m.type==='town-target-result' && m.command===command && !m.accepted){stop();$('town-hint').textContent='此处无法到达，请重新选择位置。';}
      if (m.type === "town-history") {
        messages = m.messages;
        chat();
      }
      if (m.type === "chat" && m.scope === "town") {
        if(!messages.some(item=>item.id && item.id===m.id))messages.push(m);
        messages = messages.slice(-30);
        chat();
      }
    },
    disconnected() {
      connected = false;
      players = [];
      local=null;poses.clear();npcs=[];
      stop();
    },
    reconnect() {
      connected = true;
      if (active && connected) send({ type: "town-enter", name: nickname() });
    },
  };
}
