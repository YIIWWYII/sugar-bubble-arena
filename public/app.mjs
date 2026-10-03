// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { CHARACTERS } from './characters.mjs';
import { manualUI } from './manual-ui.mjs';
import { friendsUI } from './friends-ui.mjs';
import { localMode } from "./local-profile.mjs";
import { LocalConnection } from "./local-connection.mjs";
import { enterGame } from "./entry-ui.mjs";
import { touchControls, landscapeControls } from "./touch-controls.mjs";
import { townUI } from "./town-ui.mjs";
import { MODE_MUSIC } from "./music.mjs";
import { BIO_UPGRADES } from "./bio.mjs";
import { SURVIVOR_UPGRADES } from "./survivor.mjs";
import {
  appearanceSheet,
  portraitURL,
  hasLargeDecor,
  setAppearanceAssets,
} from "./appearance.mjs";
import { EXPEDITION_MODES, BOMB_TYPES, BIO_LEVELS } from "./expedition.mjs";
import { Match, RULES, DIR, hydratePlayers } from "./engine.mjs";
import { hiddenInWater, waterElementPosition } from "./water-visuals.mjs";
import {
  createMaps,
  GAME_MODES,
  modeCompatibility,
  mapForMode,
} from "./maps.mjs";
import { ITEM_ICONS } from "./progression.mjs";
import { careerUI, openLobbyPage, closeLobbyPage } from "./career-ui.mjs";

const releaseInfo = localMode ? {multiplayerEnabled:false} : await fetch('/api/info', {cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
const multiplayerEnabled = releaseInfo.multiplayerEnabled === true;
document.body.dataset.multiplayer = String(multiplayerEnabled);
document.body.dataset.local = String(localMode);
landscapeControls();
const entryProfile = await enterGame();
const $ = (id) => document.getElementById(id);
const canvas = $("game"),
  ctx = canvas.getContext("2d");
const manifest = await fetch("/assets/manifest.json").then((r) => r.json());
const bunMap = await fetch("/assets/map.json").then((r) => r.json());
const waterMap = await fetch("/assets/water11.json").then((r) => r.json());
const maps = createMaps(bunMap, waterMap);
const themedTiles = ["forest", "dune", "lava", "ruin"];
let ruleset = "classic";
let pickSignature = "", pickReadyAt = 0, activePick = null, mobilePick = null;
const heldPhysicalKeys = new Set();
const touchDevice = () => matchMedia('(pointer: coarse) and (hover: none)').matches;
function chooseUpgrade(index) {
  if (!activePick || performance.now() < pickReadyAt) return;
  const key = activePick.offers[index];
  if (!key) return;
  send({type:'survivor-pick',key,offerId:activePick.offerId});
  activePick = null;
}
const selectedMaps = {
    classic: "bun06_8",
    boss: "boss-court",
    bio: "bio-lab",
    water11: "water11_8",
    survivor: "survivor-grove",
  },
  roomMaps = {};
let map = bunMap;
const images = new Map();
const characterBubbles = new Map();
await Promise.all(Object.keys(CHARACTERS).map(id=>new Promise(resolve=>{const img=new Image();img.onload=()=>{characterBubbles.set(id,img);resolve();};img.onerror=resolve;img.src=`/assets/character-bubble-${id}.svg`;})));
let loaded = 0;
await Promise.all(
  Object.entries(manifest).map(
    ([key, meta]) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          images.set(key, image);
          loaded++;
          $("load-progress").textContent =
            `正在加载素材中... ${loaded} / ${Object.keys(manifest).length}`;
          resolve();
        };
        image.onerror = () => reject(new Error(`无法加载 ${meta.src}`));
        image.src = meta.src;
      }),
  ),
).catch((err) => {
  $("load-progress").textContent = err.message;
  throw err;
});
setAppearanceAssets(images);
$("loading").hidden = !localMode;
if (localMode) $("load-progress").textContent = "正在初始化单人引擎…";
$("home-panel").hidden = localMode;

const demo = new Match(map);
let state = demo.snapshot(),
  socket,
  myId = null,
  roomCode = null,
  hostId = null;
let killFeed = [],
  feedSignature = "";
let sequence = 0,
  keys = [],
  seenEvent = 0,
  localEffects = [],
  debug = false;
let sound = true,
  bgm,
  result,
  wasFinished = false,
  toastTimer,
  lastStateAt = performance.now(),
  previousFrame = performance.now();
// 本机玩家视觉预测：按住方向键时立即位移，服务器确认后平滑收敛。
// maxLead 限制视觉位置最多超前权威位置多少格（0.75 格≈30px，足以消除往返延迟的粘滞感，
// 又不会在撞墙时滑出去）；reconcile 越大归位越快，过大则收敛会显得突兀。
const PREDICT = { speed: RULES.speed, maxLead: 0.75, reconcile: 8 };
let predicted = null;
let rendered = new Map(),
  countdownSound = false,
  lastUI = "",
  reconnectTimer;
// 服务器省略空值/默认值字段以压缩快照，这里按引擎给出的同一套默认值补齐，
// 否则 undefined 会让 `carry !== null`、`trappedUntil - RULES.trap` 之类的判断失真。
let blocksCache = null;
// 服务器按需下发 blocks，所以缓存为空时回退到原始地图（demo 快照的 blocks 就是 map.blocks）。
// 绝不能返回 undefined —— 渲染循环用 blocks()[y*(map.width||15)+x] 取值，一旦抛异常整个画面会只剩背景。
const blocks = () => blocksCache || state.blocks || map.blocks;
let directory = { online: 0, rooms: [] },
  roomFilter = "all";
let chatMessages = [],
  lastExplosionSound = -1000;
const urlRoom = new URL(location.href).searchParams.get("room");
if (urlRoom) $("room-code").value = urlRoom.replace(/\D/g, "").slice(0, 6);
$("nickname").value = localStorage.getItem("qqt-name") || "糖友";

function sprite(
  name,
  x,
  y,
  frame = 0,
  scale = 1,
  alpha = 1,
  appearance = null,
) {
  const meta = manifest[name],
    img = images.get(name);
  if (!meta || !img) return;
  frame = ((Math.floor(frame) % meta.frames) + meta.frames) % meta.frames;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    appearance ? appearanceSheet(img, name, appearance) : img,
    frame * meta.w,
    0,
    meta.w,
    meta.h,
    Math.round(x),
    Math.round(y),
    meta.w * scale,
    meta.h * scale,
  );
  ctx.restore();
}
function text(
  value,
  x,
  y,
  size = 12,
  color = "#fff",
  align = "center",
  outline = true,
) {
  ctx.save();
  ctx.font = `bold ${size}px "Fusion Pixel","Microsoft YaHei",sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (outline) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#165c80";
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}
function carriedBun(x, y, s = 1) {
  const m = manifest["bun-original"];
  if (!m) return;
  const scale = (s * 20) / m.w;
  sprite(
    "bun-original",
    x - (m.w * scale) / 2,
    y - (m.h * scale) / 2,
    performance.now() / m.duration,
    scale,
  );
}
function bun(x, y, s = 1, owner = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = owner === 1 ? "#ffb7d0" : "#ffdf91";
  ctx.strokeStyle = owner === 1 ? "#cc7297" : "#d58d42";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 1, 7, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = owner === 1 ? "#ffedf5" : "#fff4c3";
  ctx.beginPath();
  ctx.ellipse(-1, -1, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d6a15b";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2, -4);
    ctx.quadraticCurveTo(i * 3, -1, i * 3, 1);
    ctx.stroke();
  }
  ctx.restore();
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3500);
}
function send(data) {
  if (socket?.readyState === WebSocket.OPEN) {
    if (data.type === "create" || data.type === "join") data.skin = "classic";
    socket.send(JSON.stringify(data));
    return true;
  }
  toast("连接尚未就绪，请稍候");
  return false;
}
function play(name, volume = 0.35) {
  if (!sound) return;
  const a = new Audio(`/assets/${name}`);
  a.volume = volume;
  a.play().catch(() => {});
}
// 结算音乐（PlayerWin/PlayerLoss，约 18 秒）比普通音效长得多，必须留着引用才停得掉，
// 否则它会一路盖着背景音乐响进下一局。
function stopResult() {
  if (result) {
    result.pause();
    result = null;
  }
}
function playResult(name, volume = 0.35) {
  stopResult();
  if (!sound) return;
  result = new Audio(`/assets/${name}`);
  result.volume = volume;
  result.play().catch(() => {});
}
function updateMusic() {
  const track = MODE_MUSIC[state.mode] || MODE_MUSIC.classic;
  if (!bgm) {
    bgm = new Audio();
    bgm.id = "mode-music";
    bgm.loop = true;
    bgm.preload = "auto";
    document.body.append(bgm);
  }
  if (bgm.dataset.track !== track.file) {
    bgm.pause();
    bgm.src = `/assets/${track.file}`;
    bgm.dataset.track = track.file;
    bgm.title = track.name;
  }
  bgm.volume =
    state.survivor?.paused || state.bio?.paused
      ? track.volume * 0.45
      : track.volume;
  if (sound && roomCode && ["playing", "countdown"].includes(state.state)) {
    if (bgm.paused) bgm.play().catch(() => {});
  } else bgm.pause();
}
function updateCombatNotices() {
  killFeed = killFeed.filter((e) => state.time - e.time < 7);
  const sig = killFeed.map((e) => e.id).join(",");
  if (sig !== feedSignature) {
    feedSignature = sig;
    $("kill-feed").replaceChildren();
    for (const e of killFeed) {
      const row = document.createElement("div");
      row.className = "kill-notice";
      row.dataset.self = String(e.killerId === myId || e.victimId === myId);
      for (const [tag, value] of [
        ["b", e.killer],
        ["span", e.action],
        ["b", e.victim],
      ]) {
        const el = document.createElement(tag);
        el.textContent = value;
        row.append(el);
      }
      $("kill-feed").append(row);
    }
  }
  $("kill-feed").hidden =
    !roomCode || !["playing", "finished"].includes(state.state);
  const p = state.players.find((p) => p.id === myId),
    left = Math.max(0, (p?.infectedUntil || 0) - state.time),
    show =
      state.mode === "bio" &&
      state.state === "playing" &&
      p?.faction === "human" &&
      left > 0;
  $("infection-alert").hidden = !show;
  if (show) {
    $("infection-countdown").textContent = `${left.toFixed(1)} 秒`;
    $("infection-progress").style.width =
      `${Math.min(100, (left / (p.infectionDuration || state.bio.infectionSeconds)) * 100)}%`;
    $("infection-alert").dataset.urgent = String(left <= 3);
    $("infection-action").textContent = p.antidotes
      ? `按 4 使用解毒剂 · 剩余 ${p.antidotes} 支`
      : "解毒剂不足 · 寻找援助物资";
  }
}

function connect() {
  socket = localMode ? new LocalConnection(maps) : new WebSocket(
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`,
  );
  socket.addEventListener("open", () => {
    $("connection-dot").classList.add("online");
    $("connection-label").textContent = localMode ? "单人模式 · 本地存档" : "游戏服务已连接";
    if (localMode) {
      $("loading").hidden = true;
      $("home-panel").hidden = false;
      career.profile(entryProfile);
      delete document.body.dataset.entry;
    }
    town.reconnect();
  });
  socket.addEventListener("message", ({ data }) => {
    const msg = JSON.parse(data);
    town.message(msg);
    friends.message(msg);
    if (msg.type === "hello") myId = msg.id;
    if (msg.type === "chat") {
      chatMessages.push(msg);
      chatMessages = chatMessages.slice(-8);
      renderChat();
    }
    if (msg.type === "chat-history") {
      chatMessages = msg.messages.slice(-8);
      renderChat();
    }
    if (msg.type === "lobby") {
      directory = msg;
      renderLobby();
    }
    if (msg.type === "pong")
      $("latency").textContent =
        localMode ? "" : `${Math.round(performance.now() - msg.sent)} ms`;
    if (msg.type === "error") {
      toast(msg.message);
      resetButtons();
      career.error();
    }
    if (msg.type === "profile") career.profile(msg.profile);
    if (msg.type === "round-start") career.resetReward();
    if (msg.type === "round-reward") {
      career.reward(msg.reward);
      if (msg.profile) career.profile(msg.profile);
    }
    if (msg.type === "joined") {
      roomCode = msg.room;
      myId = msg.id;
      seenEvent = 0;
      rendered.clear();
      lastUI = "";
      keys = [];
      sequence = 0;
      predicted = null;
      career.room(true);
      if (localMode) $("account-open").disabled = true;
      closeLobbyPage(true);
      localStorage.setItem("qqt-name", $("nickname").value.trim());
      updateMusic();
      resetButtons();
    }
    if (msg.type === "state") {
      const sourceMap = maps.get(msg.mapId) || bunMap;
      const nextMap =
        map.id === sourceMap.id && map.mode === (msg.mode || "classic")
          ? map
          : mapForMode(sourceMap, msg.mode || "classic");
      if (map !== nextMap) {
        map = nextMap;
        blocksCache = null;
        predicted = null;
        rendered.clear();
      }
      if (msg.blocks) blocksCache = msg.blocks;
      hydratePlayers(msg.players);
      state = msg;
      hostId = msg.host;
      lastStateAt = performance.now();
      for (const event of msg.events)
        if (event.id > seenEvent) {
          handleEvent(event);
          seenEvent = event.id;
        }
      updateUI();
      updateMusic();
      career.combat(state, myId);
    }
    if (msg.type === "left") resetHome();
  });
  socket.addEventListener("close", (event) => {
    town.disconnected();
    $("connection-dot").classList.remove("online");
    $("connection-label").textContent = "连接断开 · 正在重连";
    $("latency").textContent = "— ms";
    if (roomCode) {
      resetHome();
      toast("与本地服务断开连接，请重新加入房间");
    }
    clearTimeout(reconnectTimer);
    if(event.code===4001){
      $("connection-label").textContent="登录状态已更新，请刷新页面";
      return;
    }
    reconnectTimer = setTimeout(connect, 1600);
  });
}
const town = townUI({
  send,
  images,
  manifest,
  nickname,
  openLobbyPage,
  closeLobbyPage,
});
if (!multiplayerEnabled) {
  $("rooms-open").textContent = "联机大厅 · 暂未开放";
  document.querySelector('[data-mode="online"]').textContent = '好友联机 · 未开放';
  $("touch-chat").hidden = true;
  $("copy-invite").hidden = true;
}
const career = careerUI(manifest, send, images, (id) => {
  const preview = document.createElement("canvas");
  preview.width = 150;
  preview.height = 130;
  paintLobbyMap(preview.getContext("2d"), maps.get(id));
  return preview.toDataURL();
});
if (!localMode) { career.profile(entryProfile); delete document.body.dataset.entry; }
const friends = friendsUI(send, images, entryProfile);
connect();
setInterval(() => {
  if (socket?.readyState === 1)
    socket.send(JSON.stringify({ type: "ping", sent: performance.now() }));
}, 2000);
function resetButtons() {
  for (const id of [
    "create-room",
    "room-create-button",
    "join-room",
    "practice",
    "ai-play",
  ])
    $(id).disabled = false;
  if (document.querySelector("[data-map]")) {
    mapPreview();
    roomCompatibility();
  }
}
function renderLobby() {
  $("lobby-count").textContent = multiplayerEnabled ? `在线 ${directory.online} 人 · ${directory.rooms.length} 个房间` : "单人挑战与 AI 对战已开放";
  const list = $("public-rooms");
  list.replaceChildren();
  const filtered = directory.rooms.filter(
    (r) => roomFilter === "all" || r.mode === roomFilter,
  );
  $("room-filter-count").textContent =
    `显示 ${filtered.length} / ${directory.rooms.length} 个房间`;
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-lobby";
    empty.textContent = "当前分类暂无房间，可切换筛选或创建房间。";
    list.append(empty);
    return;
  }
  for (const room of filtered) {
    const row = document.createElement("div");
    row.className = "public-room";
    const info = document.createElement("div"),
      name = document.createElement("strong"),
      detail = document.createElement("span");
    name.textContent = `${room.host}的房间`;
    detail.textContent = `${room.code} · ${room.count}/${room.max} 人 · ${GAME_MODES[room.mode] || room.mode} · ${room.map}`;
    info.append(name, detail);
    const join = document.createElement("button");
    join.className = "blue-button small";
    join.disabled = !room.joinable;
    join.textContent = room.joinable
      ? "加入"
      : room.status === "lobby"
        ? "已满"
        : room.status === "finished"
          ? "结算中"
          : "对战中";
    join.setAttribute("aria-label", `加入房间 ${room.code}`);
    join.onclick = () =>
      send({ type: "join", code: room.code, name: nickname() });
    row.append(info, join);
    list.append(row);
  }
}
function resetHome() {
  delete document.body.dataset.picking;
  $("survivor-picks").hidden = true;
  pickSignature = "";
  document.body.dataset.screen = "home";
  career.room(false);
  if (localMode) { $("account-open").disabled = false; $("connection-label").textContent = "单人模式 · 本地存档"; }
  $("combat-tools").hidden = true;
  map = bunMap;
  roomCode = null;
  killFeed = [];
  feedSignature = "";
  $("kill-feed").replaceChildren();
  $("infection-alert").hidden = true;
  state = demo.snapshot();
  keys = [];
  rendered.clear();
  localEffects = [];
  predicted = null;
  blocksCache = null;
  stopResult();
  updateMusic();
  $("home-panel").hidden = false;
  $("room-panel").hidden = true;
  $("result-panel").hidden = true;
  $("leave-game").hidden = true;
  $("footer-status").textContent =
    "抢走对方全部包子并运回自己的包房，即可获胜。";
  resetButtons();
  $("death-screen").hidden = true;
  if ($("training-dialog").open) $("training-dialog").close();
  closeChat();
  chatMessages = [];
  renderChat();
}
function renderChat() {
  const log = $("chat-log");
  log.replaceChildren();
  for (const message of chatMessages) {
    const line = document.createElement("div");
    line.className = "chat-message";
    const author = document.createElement("strong");
    author.textContent = `${message.name}：`;
    line.append(author, document.createTextNode(message.text));
    log.append(line);
  }
  log.scrollTop = log.scrollHeight;
}
function openChat() {
  if (!multiplayerEnabled) { toast("暂未开放，敬请等待"); return; }
  release();
  $("chat-form").hidden = false;
  $("chat-panel").classList.add("typing");
  $("chat-scope").textContent = roomCode ? "房间" : "大厅";
  $("chat-input").focus();
}
function closeChat() {
  $("chat-form").hidden = true;
  $("chat-panel").classList.remove("typing");
  canvas.focus();
}
function handleEvent(e) {
  if (e.type === "combat-feed" && state.time - e.time < 7)
    killFeed = [e, ...killFeed].slice(0, 5);
  if (e.type === "start") {
    killFeed = [];
    if (bgm) bgm.currentTime = 0;
  }
  if (e.type === "boss-loot" && e.player === myId)
    toast(
      "获得" +
        { rose: "玫瑰花", chest: "宝箱", luckybag: "福袋", kubi: "酷比" }[
          e.kind
        ],
    );
  if (e.type === "aid-open" && e.player === myId)
    toast(`获得援助物资：${e.name}`);
  if (e.type === "start") {
    stopResult();
    play("ReadyGo.wav", 0.5);
    countdownSound = true;
  }
  if (e.type === "bomb" && e.player === myId) play("place.wav", 0.28);
  if (e.type === "explode" && performance.now() - lastExplosionSound > 60) {
    play("bomb.wav", 0.25);
    lastExplosionSound = performance.now();
  }
  if (e.type === "death") play("trapped-pop.wav", 0.3);
  if (e.type === "break")
    localEffects.push({ ...e, received: performance.now() });
  if (e.type === "death" || e.type === "training-warp" || e.type === "cave-lit")
    localEffects.push({ ...e, received: performance.now() });
  // 穿泡/借泡只留地面光环，不再弹「穿泡成功 · x 秒」这类文字提示。
  if (e.type === "phase" || e.type === "wall")
    localEffects.push({ ...e, received: performance.now() });
  // 「放泡太早/太晚」的提示同理已去掉。
  if (e.type === "steal")
    toast(
      `${state.players.find((p) => p.id === e.player)?.name || "糖友"} 已夺取包子`,
    );
  if (e.type === "capture") {
    toast(`${e.team === 0 ? "红队" : "蓝队"} 带回一个包子！`);
    play("uiMain.wav");
  }
  if (e.type === "recover" && e.player === myId)
    toast(
      e.own
        ? "捡回己方包子，带回自己的包子铺！"
        : "捡到包子，带回自己的包子铺！",
    );
  if (e.type === "return-bun")
    toast(`${e.team === 0 ? "红队" : "蓝队"} 护送包子回家了！`);
  if (e.type === "enter-house" && e.player === myId)
    toast("已进入包子房 · 蓝色箭头标记当前角色位置");
  if (e.type === "finish") {
    const me = state.players.find((p) => p.id === myId);
    playResult(
      me?.team === e.winner ? "PlayerWin.ogg" : "PlayerLoss.ogg",
      0.35,
    );
  }
}
function roster(target, team) {
  const list = $(target);
  list.replaceChildren();
  const players = state.players.filter((p) => p.team === team);
  for (
    let i = 0;
    i <
    (["water11", ...EXPEDITION_MODES].includes(state.mode) && team === 0
      ? 5
      : 4);
    i++
  ) {
    const row = document.createElement("div");
    row.className = "roster-row";
    const p = players[i];
    if (p) {
      const image = document.createElement("img");
      image.src = p.appearance
        ? portraitURL(images.get("prince-red-stand-3"), p.appearance)
        : `/assets/prince-${team === 0 ? "red" : "blue"}-stand-3.png`;
      image.alt = "";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = p.name + (p.id === myId ? "（你）" : "");
      const ready = document.createElement("em");
      ready.textContent =
        p.id === hostId ? "房主" : p.ready ? "已准备" : "等待";
      row.append(image, name, ready);
    } else {
      row.textContent = "等待加入";
      row.classList.add("roster-empty");
    }
    list.append(row);
  }
}
function updateSurvivorUI() {
  const paused = !!(state.survivor?.paused || state.bio?.paused);
  document.querySelector("#survivor-picks header p").textContent =
    state.mode === "bio" ? "生化对抗 · 局内成长" : "幸存者 · 局内成长";
  $("survivor-picks").hidden = !paused;
  if (!paused) {
    delete document.body.dataset.picking;
    pickSignature = "";
    activePick = null;
    return;
  }
  if (!document.body.dataset.picking) {
    release();
    document.body.dataset.picking = "true";
  }
  const self = state.players.find((p) => p.id === myId),
    run = state.mode === "bio" ? self?.bioBuild : self?.run,
    catalog = state.mode === "bio" ? BIO_UPGRADES : SURVIVOR_UPGRADES,
    signature = JSON.stringify([run?.offerId, run?.offers, run?.rerolls]);
  if (signature === pickSignature) return;
  pickSignature = signature;
  pickReadyAt = performance.now() + 350;
  activePick = run?.offers.length ? {offerId:run.offerId,offers:[...run.offers]} : null;
  mobilePick = null;
  $('survivor-confirm').hidden = !touchDevice();
  $('survivor-confirm').disabled = true;
  $("survivor-pick-title").textContent = run?.offers.length
    ? `${state.mode === "bio" ? (self.faction === "zombie" ? "丧尸进化" : run.opening ? `开局强化 ${4 - run.opening}/3` : "人类强化") : `Lv.${run.level}`} · 三选一`
    : "等待队友选择";
  $("survivor-pick-hint").textContent =
    touchDevice() ? "战斗已暂停。点选一项，再点击确认强化。" : "战斗已暂停。使用主键盘 1、2、3 选择；鼠标、空格、回车与小键盘不会确认。";
  const container = $("survivor-options");
  container.replaceChildren();
  for (const [i, key] of (run?.offers || []).entries()) {
    const u = catalog[key],
      button = document.createElement("button");
    button.className = "survivor-card";
    button.dataset.upgrade = key;
    const icon = document.createElement("img"),
      meta = manifest[u.icon],
      frame = document.createElement("canvas");
    frame.width = meta.w;
    frame.height = meta.h;
    frame
      .getContext("2d")
      .drawImage(
        images.get(u.icon),
        0,
        0,
        meta.w,
        meta.h,
        0,
        0,
        meta.w,
        meta.h,
      );
    icon.src = frame.toDataURL();
    icon.alt = "";
    const tag = document.createElement("small");
    tag.textContent = `${i + 1} · ${u.family} · Lv.${(run.ranks[key] || 0) + 1}`;
    const title = document.createElement("h2");
    title.textContent = u.name;
    const detail = document.createElement("p");
    detail.textContent = u.description;
    const condition = document.createElement("span");
    condition.textContent = u.requires
      ? "进化条件已满足"
      : `最高 ${u.max > 100 ? "不限" : u.max} 级`;
    button.append(tag, icon, title, detail, condition);
    button.tabIndex = -1;
    button.onclick = () => {
      if (performance.now() < pickReadyAt) return;
      mobilePick = i;
      for (const card of container.children)
        card.setAttribute('aria-pressed', String(card === button));
      if (touchDevice()) {
        $('survivor-confirm').disabled = false;
      } else {
        chooseUpgrade(i);
      }
    };
    container.append(button);
  }
  $("survivor-reroll").disabled = !run?.offers.length || !run.rerolls;
  $("survivor-reroll").textContent = `重抽 · 剩余 ${run?.rerolls || 0} 次`;
  $("survivor-build").textContent =
    Object.entries(run?.ranks || {})
      .map(([k, v]) => `${catalog[k].name} ${v}`)
      .join(" · ") || "选择初始强化，开始构筑本局流派。";
  $("survivor-picks").focus({preventScroll:true});
}
$('survivor-confirm').onclick = () => { if(touchDevice() && mobilePick !== null)chooseUpgrade(mobilePick); };
window.addEventListener('keyup',e=>heldPhysicalKeys.delete(e.code));
window.addEventListener('blur',()=>heldPhysicalKeys.clear());
$("bio-antidote").onclick = () => send({ type: "bio-antidote" });
$("bio-dome").onclick = () => send({ type: "bio-dome" });
$("survivor-pick-leave").onclick = () => send({ type: "leave" });
$("survivor-reroll").onclick = () =>
  send({
    type: "survivor-reroll",
    offerId: (state.mode === "bio"
      ? state.players.find((p) => p.id === myId)?.bioBuild
      : state.players.find((p) => p.id === myId)?.run
    )?.offerId,
  });
function updateUI() {
  updateCombatNotices();
  updateSurvivorUI();
  const lobby = state.state === "lobby",
    finished = state.state === "finished";
  document.body.dataset.screen = lobby ? "lobby" : finished ? "result" : "game";
  if (wasFinished && !finished) stopResult();
  wasFinished = finished;
  $("home-panel").hidden = true;
  $("room-panel").hidden = !lobby;
  $("result-panel").hidden = !finished;
  $("leave-game").hidden = lobby;
  const self = state.players.find((p) => p.id === myId);
  for (const [action, field, label] of [['use-fork','forks','1 叉子'],['place-banana','bananas','2 香蕉'],['place-smile','smiles','3 笑脸']]) {
    const button = document.querySelector(`[data-touch-action="${action}"]`);
    button.setAttribute("aria-label", `${label} ${self?.[field] || 0}`);
    const count=button.querySelector(".touch-cooldown");
    if(count)count.textContent=String(self?.[field] || 0);
    button.disabled = !self?.[field] || (action==='use-fork' ? self?.status!=='trapped' : self?.status!=='alive') || (state.mode==='bio' && self?.faction==='zombie');
    button.title = action==='use-fork' ? '被泡泡困住时使用叉子自救' : action==='place-banana' ? '在脚下放置香蕉陷阱' : '在脚下放置笑脸减速陷阱';
  }
  const expedition = EXPEDITION_MODES.includes(state.mode),
    water = state.mode === "water11" || expedition;
  $("bio-antidote").hidden = state.mode !== "bio" || self?.faction === "zombie";
  $("bio-antidote").textContent = `4 解毒剂 · ${self?.antidotes || 0}`;
  $("bio-antidote").disabled =
    !self?.antidotes || !(self.infectedUntil > state.time);
  const dome = self?.dome;
  $("bio-dome").hidden = state.mode !== "bio" || self?.faction === "zombie";
  $("bio-dome").textContent = dome?.active
    ? `G 安全泡泡 · ${Math.ceil(dome.hp)}/${dome.maxHp}`
    : self?.domeCooldownAt > state.time
      ? `G 重建冷却 · ${Math.ceil(self.domeCooldownAt - state.time)}s`
      : "G 重建安全泡泡";
  $("bio-dome").disabled = !!dome?.active || (self?.domeCooldownAt || 0) > state.time || self?.status !== "alive";
  const domeStatus = $("bio-dome-status");
  domeStatus.hidden = state.mode !== "bio" || self?.faction === "zombie";
  if (!domeStatus.hidden) {
    const cooldown = Math.max(0, (self?.domeCooldownAt || 0) - state.time);
    domeStatus.textContent = dome?.active
      ? `罩体 ${Math.ceil(dome.hp)}/${dome.maxHp} · G 可查看`
      : cooldown > 0
        ? `罩体已破 · ${Math.ceil(cooldown)} 秒后可按 G 重建`
        : "罩体可用 · 按 G 部署";
    domeStatus.dataset.ready = String(!dome?.active && cooldown <= 0);
  }
  $("bomb-tools").hidden =
    !expedition || state.state !== "playing" || self?.faction === "zombie";
  if (expedition) {
    const kind = self?.bombKind || "normal";
    $("cycle-bomb").textContent = `E ${BOMB_TYPES[kind].name}`;
    $("bomb-description").textContent = BOMB_TYPES[kind].description;
    $("cycle-bomb").disabled = self?.status !== "alive";
    $("detonate-bomb").disabled =
      self?.status !== "alive" ||
      !state.bombs.some((b) => b.owner === myId && b.kind === "remote");
  }
  $("switch-team").hidden = water;
  $("blue-roster").parentElement.hidden = water;
  document.querySelector(".red-heading").textContent = water
    ? "合作队伍"
    : "红队";
  document.querySelector("#room-panel .window-title span").textContent =
    `${GAME_MODES[state.mode] || "经典抢包"} · ${map.name}`;
  $("death-screen").hidden = !(
    self?.status === "dead" && state.state === "playing"
  );
  if (self?.status === "dead")
    $("respawn-count").textContent =
      water && self?.faction !== "zombie"
        ? "观战"
        : String(Math.max(0, Math.ceil(self.respawnAt - state.time)));
  $("death-screen").querySelector("small").textContent =
    self?.faction === "zombie"
      ? "丧尸重生中"
      : water
        ? "等待队友完成挑战"
        : "等待复活";
  let cry = $("death-cry-overlay");
  if (!cry) {
    cry = document.createElement("img");
    cry.id = "death-cry-overlay";
    cry.src = "/assets/death-cry.gif";
    cry.alt = "";
    $("death-screen").append(cry);
  }
  cry.hidden = !(
    self?.status === "dead" && state.time - self.respawnAt + RULES.respawn < 2
  );
  if (!cry.hidden) {
    cry.style.left = `${((self.x * 40 - 50) / 600) * 100}%`;
    cry.style.top = `${((22 + self.y * 40 - 64) / 542) * 100}%`;
  }
  if (!state.practice && $("training-dialog").open)
    $("training-dialog").close();
  for (const checkbox of document.querySelectorAll("[data-mod]"))
    checkbox.checked = !!self?.mods?.[checkbox.dataset.mod];
  $("connection-label").textContent = state.aiLevel
    ? `人机对战 · ${{ easy: "简单", normal: "普通", hard: "困难" }[state.aiLevel]}`
    : state.practice
      ? "单人练习场"
      : localMode ? `${GAME_MODES[state.mode]} · 单人挑战` : `房间 ${roomCode}`;
  // 水面11 不在这条状态栏里报血量：血条按原版挂在 boss 头上，这一行整行留空。
  // 用清空而不是 hidden —— footer 是 space-between，藏掉左侧会把它右对齐的落款挤到左边。
  $("footer-status").textContent = water
    ? ""
    : localMode ? (state.mode === "classic" ? `带回敌包 红 ${state.captured?.[0] || 0}/3 · 蓝 ${state.captured?.[1] || 0}/3` : `${GAME_MODES[state.mode]} · 单人挑战`) : `房间 ${roomCode} · ${state.players.length}/8 人 · 带回敌包 红 ${state.captured?.[0] || 0}/3 · 蓝 ${state.captured?.[1] || 0}/3`;
  const signature = JSON.stringify([
    state.state,
    hostId,
    state.players.map((p) => [p.id, p.name, p.team, p.ready]),
  ]);
  if (signature !== lastUI) {
    lastUI = signature;
    if (lobby) {
      $("room-number").textContent = roomCode;
      roster("red-roster", 0);
      roster("blue-roster", 1);
      const me = state.players.find((p) => p.id === myId);
      $("ready-button").textContent =
        myId === hostId ? "开始游戏" : me?.ready ? "取消准备" : "准 备";
      $("room-hint").textContent =
        state.players.length < 2
          ? "至少需要两名玩家加入对战"
          : "双方人数相等且全体玩家准备后，即可开始对局";
      if (water)
        $("room-hint").textContent = expedition
          ? `${state.objective} · 1–5 人合作，全员准备后开始`
          : "水面11 · 1–5人合作挑战海盗水手，全员准备后开局";
    }
    if (finished) {
      $("result-title").textContent =
        state.winner === null
          ? "平 局"
          : state.winner === 0
            ? "红队获胜！"
            : "蓝队获胜！";
      if (water)
        $("result-title").textContent =
          state.mode === "bio"
            ? state.winner === 0
              ? "人类胜利"
              : "丧尸胜利"
            : state.winner === 0
              ? "挑战成功！"
              : "挑战失败";
      $("result-reason").textContent = state.reason;
      $("result-stats").replaceChildren();
      for (const p of state.players) {
        const row = document.createElement("div");
        row.className = "result-stat";
        const name = document.createElement("span");
        name.textContent =
          state.mode === "bio"
            ? `${p.name} · ${p.faction === "zombie" ? "丧尸阵营" : "人类阵营"}`
            : p.name;
        const result = document.createElement("span");
        result.textContent = expedition
          ? `击杀 ${p.kills} · 阵亡 ${p.deaths}`
          : `抢回 ${p.captures} · 击破 ${p.kills}`;
        row.append(name, result);
        $("result-stats").append(row);
      }
      $("return-room").textContent = state.practice
        ? "再练一次"
        : myId === hostId
          ? "返回房间"
          : "等待房主返回房间";
      $("return-room").disabled = myId !== hostId;
      if (state.aiLevel) $("return-room").textContent = "再挑战一次";
    }
  }
  if (state.practice) {
  }
}
function updateBioSettings() {
  const level = BIO_LEVELS[$("bio-level").value];
  document.querySelector("#bio-settings p").textContent =
    `${level.name} · 开局三轮强化，20 秒找点后产生母体。每名人类拥有安全泡泡罩，援助物资每 30 秒刷新；潜伏结束转为丧尸继续对抗。`;
}
$("bio-level").onchange = updateBioSettings;
updateBioSettings();
function bioOptions(room = false) {
  return {
    difficulty: $(room ? "room-bio-level" : "bio-level").value,
    infectionSeconds: Number(
      $(room ? "room-bio-incubation" : "bio-incubation").value,
    ),
  };
}
function nickname() {
  return $("nickname").value.trim() || "糖友";
}
function roomCompatibility() {
  const mode = $("room-create-mode").value;
  $("room-bio-settings").hidden = mode !== "bio";
  filterMapSelect($("room-create-map"), mode);
  roomMaps[mode] = $("room-create-map").value;
  const issue = lobbyCompatibility(
    maps.get($("room-create-map").value),
    $("room-create-mode").value,
  );
  $("room-mode-compatibility").textContent = issue;
  $("room-create-button").disabled = !!issue;
}
$("room-create-map").onchange = roomCompatibility;
$("room-create-mode").onchange = () => {
  $("room-create-map").value = roomMaps[$("room-create-mode").value] || "";
  roomCompatibility();
};
$("room-create-button").onclick = () => {
  if (
    send({
      type: "create",
      mapId: $("room-create-map").value,
      mode: engineMode(maps.get($("room-create-map").value), $("room-create-mode").value),
      bioOptions: bioOptions(true),
      name: nickname(),
    })
  )
    $("room-create-button").disabled = true;
};
$("create-room").onclick = () => {
  if (
    send({
      type: "create",
      mapId: $("map-select").value,
      mode: launchMode(),
      bioOptions: bioOptions(),
      name: nickname(),
    })
  )
    $("create-room").disabled = true;
};
$("join-room").onclick = () => {
  const code = $("room-code").value.trim();
  if (!/^\d{6}$/.test(code)) {
    toast("请输入 6 位房间号");
    return;
  }
  if (send({ type: "join", code, name: nickname() }))
    $("join-room").disabled = true;
};
$("room-code").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("join-room").click();
});
$("practice").onclick = () => {
  if (
    send({
      type: "create",
      practice: true,
      mapId: $("map-select").value,
      mode: launchMode(),
      bioOptions: bioOptions(),
      name: nickname(),
    })
  ) {
    $("practice").disabled = true;
    canvas.focus();
  }
};
$("ai-play").onclick = () => {
  if (EXPEDITION_MODES.includes(ruleset) || ruleset === "water11") {
    send({
      type: "create",
      mapId: $("map-select").value,
      mode: launchMode(),
      bioOptions: bioOptions(),
      solo: true,
      name: nickname(),
    });
    return;
  }
  if ($("map-select").value === "water11_8") {
    toast("水面 11 为合作地图，请选择一张抢包地图挑战 AI");
    return;
  }
  if (
    send({
      type: "create",
      mapId: $("map-select").value,
      mode: launchMode(),
      aiLevel: $("ai-level").value,
      name: nickname(),
    })
  ) {
    $("ai-play").disabled = true;
    canvas.focus();
  }
};
$("ready-button").onclick = () => {
  send({ type: myId === hostId ? "start" : "ready" });
  canvas.focus();
};
$("cycle-bomb").onclick = () => send({ type: "cycle-bomb" });
$("detonate-bomb").onclick = () => send({ type: "detonate" });
$("bomb-guide").innerHTML = Object.entries(BOMB_TYPES)
  .map(
    ([key, b]) =>
      `<article class="growth-card"><b>${b.name}</b><p>${b.description}</p></article>`,
  )
  .join("");
$("switch-team").onclick = () => send({ type: "team" });
for (const id of ["leave-lobby", "leave-game"])
  $(id).onclick = () => {
    release();
    play("uiLeave.wav", 0.25);
    send({ type: "leave" });
  };
$("return-room").onclick = () =>
  send(
    state.practice && state.mode === "classic"
      ? { type: "drill", mode: state.drill || "map" }
      : { type: "return" },
  );
$("result-home").onclick = () => send({ type: "leave" });
$("copy-invite").onclick = async () => {
  try {
    await navigator.clipboard.writeText(`${location.origin}/?room=${roomCode}`);
    toast("邀请链接已复制；局域网朋友请使用房主局域网地址");
  } catch {
    toast(`房间号：${roomCode}`);
  }
};
$("sound-button").onclick = () => {
  sound = !sound;
  if (!sound) stopResult();
  $("sound-button").textContent = `声音：${sound ? "开" : "关"}`;
  updateMusic();
  if (sound) play("uiNormal.wav");
  canvas.focus();
};
$("fullscreen-button").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (!document.documentElement.requestFullscreen) toast("当前浏览器不支持全屏，可横屏游玩");
  else
    document.documentElement
      .requestFullscreen()
      .catch(() => toast("当前浏览器不支持全屏"));
  canvas.focus();
};
manualUI(release,()=>canvas.focus());
$("chat-form").onsubmit = (e) => {
  e.preventDefault();
  const message = $("chat-input").value.trim();
  if (message && !send({ type: "chat", name: nickname(), text: message }))
    return;
  $("chat-input").value = "";
  closeChat();
};
$("chat-input").addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    closeChat();
  }
});
document.addEventListener("click", (e) => {
  if (sound && bgm?.paused) updateMusic();
  const button = e.target.closest("button");
  if (button && button.id !== "sound-button") play("uiMain.wav", 0.12);
});
$("close-training").onclick = () => {
  $("training-dialog").close();
  canvas.focus();
};
for (const checkbox of document.querySelectorAll("[data-mod]"))
  checkbox.onchange = () =>
    send({
      type: "training-mod",
      key: checkbox.dataset.mod,
      enabled: checkbox.checked,
    });
$("training-win").onclick = () => {
  send({ type: "training-win" });
  $("training-dialog").close();
  canvas.focus();
};

const keyMap = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
let touchDirection = null;
const moveDirection = () => touchDirection || (keys.length ? keyMap[keys.at(-1)] : null);
function input(bomb = false) {
  if (roomCode && socket?.readyState === 1)
    socket.send(
      JSON.stringify({
        type: "input",
        seq: ++sequence,
        dir: moveDirection(),
        bomb,
      }),
    );
}
function release() {
  touchDirection = null;
  keys = [];
  input();
}
window.addEventListener("keydown", (e) => {
  const wasHeld = heldPhysicalKeys.has(e.code);
  heldPhysicalKeys.add(e.code);
  if (document.body.dataset.lobbyPage === "town-dialog") return;
  if (state.survivor?.paused || state.bio?.paused) {
    const i = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
    e.preventDefault();
    if (i >= 0 && !e.repeat && !wasHeld) chooseUpgrade(i);
    return;
  }
  if (document.body.dataset.lobbyPage) return;
  if (
    e.code === "Enter" &&
    !["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(
      document.activeElement?.tagName,
    ) &&
    !$("help-dialog").open &&
    !$("training-dialog").open
  ) {
    e.preventDefault();
    openChat();
    return;
  }
  if (e.code === "F2") {
    e.preventDefault();
    if (!state.practice || state.mode !== "classic" || !roomCode) {
      toast("F2 特殊训练工具仅用于经典练习；其他模式按原规则练习");
      return;
    }
    release();
    if ($("training-dialog").open) $("training-dialog").close();
    else $("training-dialog").showModal();
    return;
  }
  if (
    ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) ||
    $("help-dialog").open ||
    $("training-dialog").open ||
    !roomCode ||
    !["playing", "countdown"].includes(state.state)
  )
    return;
  if (keyMap[e.code]) {
    e.preventDefault();
    if (!keys.includes(e.code)) {
      keys.push(e.code);
      input();
    }
  }
  if (e.code === "Space") {
    e.preventDefault();
    if (
      !e.repeat ||
      (state.practice && state.players.find((p) => p.id === myId)?.mods?.bombs)
    )
      input(true);
  }
  if (e.code === "KeyE" && !e.repeat && EXPEDITION_MODES.includes(state.mode))
    send({ type: "cycle-bomb" });
  if (e.code === "KeyR" && !e.repeat && EXPEDITION_MODES.includes(state.mode))
    send({ type: "detonate" });
  if (e.code === "Digit4" && !e.repeat && state.mode === "bio") {
    e.preventDefault();
    send({ type: "bio-antidote" });
  }
  if (e.code === "KeyG" && !e.repeat && state.mode === "bio") {
    e.preventDefault();
    send({ type: "bio-dome" });
  }
  if (e.code === "KeyF" && !e.repeat) { e.preventDefault();send({type:"character-skill"}); }
  if (e.code === "KeyQ" && !e.repeat) {
    e.preventDefault();
    send({ type: "skill" });
  }
  if ((e.code === "Digit1" || e.code === "Numpad1") && !e.repeat) {
    e.preventDefault();
    socket?.send(JSON.stringify({ type: "use-fork" }));
  }
  if ((e.code === "Digit2" || e.code === "Numpad2") && !e.repeat) {
    e.preventDefault();
    socket?.send(JSON.stringify({ type: "place-banana" }));
  }
  if ((e.code === "Digit3" || e.code === "Numpad3") && !e.repeat) {
    e.preventDefault();
    socket?.send(JSON.stringify({ type: "place-smile" }));
  }
  if (/^Key[TYUIOP]$/.test(e.code) && !e.repeat) {
    e.preventDefault();
    socket?.send(
      JSON.stringify({ type: "emote", key: e.code.at(-1).toLowerCase() }),
    );
  }
});
window.addEventListener("keyup", (e) => {
  if (keyMap[e.code]) {
    keys = keys.filter((k) => k !== e.code);
    input();
  }
});
window.addEventListener("blur", release);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) release();
});
canvas.addEventListener("pointerdown", () => canvas.focus());
// Touch input uses the same protocol and movement prediction as the keyboard.
touchControls({
  canPlay: () => !!roomCode && state.state === "playing" && !document.body.dataset.lobbyPage && !document.body.dataset.picking && !document.querySelector('dialog[open]'),
  move: dir => { touchDirection = dir; input(); },
  bomb: () => input(true),
  action: type => send({type}),
  chat: () => { release(); if ($("chat-form").hidden) openChat(); else closeChat(); },
});


const OX = 8,
  OY = 22,
  T = 40;
function groundKey(selected) {
  if (themedTiles.includes(selected.theme)) return `${selected.theme}-ground`;
  return selected.theme === "frost"
    ? "frost-ground"
    : selected.theme === "harbor"
      ? "water-5001"
      : "tile11";
}
function tileKey(tile, selected = map) {
  if (themedTiles.includes(selected.theme) && tile >= 1 && tile <= 5)
    return `${selected.theme}-${tile === 5 ? "pillar" : "block"}`;
  if (selected.theme === "frost")
    return tile >= 1 && tile <= 4
      ? "frost-block"
      : tile === 5
        ? "frost-pillar"
        : `tile${tile}`;
  if (selected.theme === "harbor")
    return tile >= 1 && tile <= 4
      ? "water-5002"
      : tile === 5
        ? "water-5005"
        : `tile${tile}`;
  return `tile${tile}`;
}
function paintDefense(context, z, ox = 0, oy = 0) {
  if (!z) return;
  context.save();
  context.fillStyle = "#69e7b02b";
  context.fillRect(ox + z.x * 40, oy + z.y * 40, z.w * 40, z.h * 40);
  context.strokeStyle = "#a3ffe2";
  context.lineWidth = 3;
  context.setLineDash([10, 6]);
  context.strokeRect(
    ox + z.x * 40 + 3,
    oy + z.y * 40 + 3,
    z.w * 40 - 6,
    z.h * 40 - 6,
  );
  context.setLineDash([]);
  const cx = ox + (z.x + z.w / 2) * 40,
    cy = oy + (z.y + z.h / 2) * 40;
  context.fillStyle = "#a3ffe2";
  context.fillRect(cx - 13, cy - 4, 26, 8);
  context.fillRect(cx - 4, cy - 13, 8, 26);
  context.restore();
}
function paintTactics(context,selected,ox=0,oy=0,preview=false){
  context.save();
  for(const z of selected.tacticalZones || []){
    const color={risk:'#efb964',route:'#80d8ed',defense:'#71dfad'}[z.type];
    context.fillStyle=color+'24';context.fillRect(ox+z.x*40,oy+z.y*40,z.w*40,z.h*40);
    if(!preview){context.fillStyle='#194b63';context.font='11px "Fusion Pixel",sans-serif';context.textAlign='center';context.fillText(z.label,ox+(z.x+z.w/2)*40,oy+z.y*40+13);}
  }
  for(const [i,n] of (selected.supplyNodes || []).entries()){
    const x=ox+(n.x+.5)*40,y=oy+(n.y+.5)*40;
    context.strokeStyle='#ffe48b';context.lineWidth=2;context.strokeRect(x-14,y-14,28,28);
    context.fillStyle='#ffe48b';context.fillRect(x-3,y-3,6,6);
    if(!preview){const seconds=Math.max(0,Math.ceil((state.supplySchedule?.[i] || n.first+3)-state.time));const available=state.items?.some(item=>item.supplyNode===i);context.font='10px "Fusion Pixel",sans-serif';context.textAlign='center';context.fillStyle='#f9f6cf';context.fillText(available?'补给':`${seconds}s`,x,y+25);}
  }
  context.restore();
}
function paintLobbyMap(preview, selected) {
  preview.clearRect(0, 0, 150, 130);
  preview.save();
  preview.scale(
    150 / ((selected.width || 15) * 40),
    130 / ((selected.height || 13) * 40),
  );
  const draw = (key, x, y) => {
    const meta = manifest[key],
      source = images.get(key);
    if (meta && source)
      preview.drawImage(source, 0, 0, meta.w, meta.h, x, y, meta.w, meta.h);
  };
  for (let y = 0; y < (selected.height || 13); y++)
    for (let x = 0; x < (selected.width || 15); x++)
      draw(
        selected.mode === "water11" && selected.theme !== "frost"
          ? `water-${selected.ground[y * (selected.width || 15) + x]}`
          : groundKey(selected),
        x * 40,
        y * 40,
      );
  if (selected.mode === "water11") {
    for (const o of [...selected.objects].sort(
      (a, b) => a.y + a.h - b.y - b.h,
    )) {
      const anchor = waterElementPosition(o, 40);
      draw(o.renderKey || `water-${o.id}`, anchor.x, anchor.y);
    }
  } else
    for (let y = 0; y < (selected.height || 13); y++)
      for (let x = 0; x < (selected.width || 15); x++) {
        const tile = selected.blocks[y * (selected.width || 15) + x] - 8000,
          building = selected.structures[y * (selected.width || 15) + x] - 8000;
        if (tile > 0) {
          const key = tileKey(tile, selected);
          if (manifest[key]) draw(key, x * 40, (y + 1) * 40 - manifest[key].h);
        }
        if (building > 0 && manifest[`tile${building}`])
          draw(
            `tile${building}`,
            x * 40,
            (y + 3) * 40 - manifest[`tile${building}`].h,
          );
      }
  paintTactics(preview,selected,0,0,true);
  paintDefense(preview, selected.defenseZone);
  preview.restore();
}
const engineMode = (map, mode) => mode === 'boss' && map?.mode === 'water11' ? 'water11' : mode;
const launchMode = () => engineMode(maps.get($("map-select").value),ruleset);
const lobbyCompatibility = (map,mode) => modeCompatibility(map,engineMode(map,mode));
function filterMapSelect(select, mode, preferred) {
  for (const option of select.options) {
    const blocked = !!lobbyCompatibility(maps.get(option.value), mode);
    option.hidden = blocked;
    option.disabled = blocked;
  }
  if (!select.value || lobbyCompatibility(maps.get(select.value), mode))
    select.value =
      preferred && !lobbyCompatibility(maps.get(preferred), mode)
        ? preferred
        : [...select.options].find((o) => !o.disabled)?.value || "";
}
function mapPreview() {
  filterMapSelect($("map-select"), ruleset, selectedMaps[ruleset]);
  selectedMaps[ruleset] = $("map-select").value;
  let count = 0;
  for (const button of document.querySelectorAll("[data-map]")) {
    button.hidden = !!lobbyCompatibility(maps.get(button.dataset.map), ruleset);
    if (!button.hidden) {
      count++;
      if (button.dataset.previewMode !== ruleset) {
        paintLobbyMap(
          button.querySelector("canvas").getContext("2d"),
          mapForMode(maps.get(button.dataset.map), engineMode(maps.get(button.dataset.map),ruleset)),
        );
        button.dataset.previewMode = ruleset;
      }
    }
  }
  document.querySelector("#maps-dialog .window-title span").textContent =
    `${GAME_MODES[ruleset]} · 选择地图`;
  document.querySelector("#maps-dialog .section-description").textContent =
    `${count} 张可选地图 · 选择地形后返回大厅开始对局。`;

  const selected = maps.get($("map-select").value),
    preview = $("map-preview").getContext("2d");
  document.querySelector('#mode-practice p').textContent = ruleset === 'classic' ? '自由练习走位和穿泡。按 F2 打开训练菜单，不结算养成资源。' : '按当前地图和模式进行练习，保留首领、怪物与强化机制，不结算养成资源。';
  $("bio-settings").hidden = ruleset !== "bio";
  const expedition =
    EXPEDITION_MODES.includes(ruleset) || ruleset === "water11";
  for (const button of document.querySelectorAll("[data-ruleset]"))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.ruleset === ruleset),
    );
  $("ai-level").hidden = expedition;
  document.querySelector("label[for=ai-level]").hidden = expedition;
  document.querySelector("[data-mode=ai]").textContent = expedition
    ? "单人挑战"
    : "人机挑战";
  document.querySelector("[data-mode=practice]").disabled = false;

  document.querySelector("#mode-ai p").textContent = expedition
    ? ruleset === "survivor"
      ? "自动发射糖泡，拾取经验选择强化；利用陷阱阻滞怪物，接触受伤后短暂无敌。每 30 秒出现精英。"
      : launchMode() === "water11"
        ? (localMode ? "独自挑战海盗水手。用陷阱限制移动，连续糖泡命中破泡增伤。" : "1–5 人合作挑战水手。用陷阱限制移动，连续糖泡命中破泡增伤，及时救援队友。")
        : ruleset === "boss"
          ? "180 秒内击败首领。使用陷阱创造攻击时机，先困泡再连续命中造成双倍伤害。"
          : "开局三轮强化与 20 秒找点。每名人类拥有可被击破的安全泡泡罩；护罩破裂后按 G 冷却重建，使用解毒剂抵御感染。"
    : "1 对 1 抢包，完成对局获得养成资源。";
  document.querySelector("#mode-online p").textContent = expedition
    ? "支持 1–5 人合作。阵亡后观战，全员阵亡则挑战失败。"
    : "创建房间后邀请好友加入。抢包地图支持 2–8 人，水面 11 支持 1–5 人合作。";
  $("map-title").textContent = selected.name;
  $("map-description").textContent =
    `${selected.description || "经典包房 · 绕路争夺"} · 适用：${(selected.supportedModes || Object.keys(GAME_MODES).filter((mode) => !lobbyCompatibility(selected, mode))).map((mode) => GAME_MODES[mode]).join("、")}`;
  paintLobbyMap(
    preview,
    lobbyCompatibility(selected, ruleset)
      ? selected
      : mapForMode(selected, engineMode(selected,ruleset)),
  );
  for (const button of document.querySelectorAll("[data-map]"))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.map === selected.id),
    );
  const issue = lobbyCompatibility(selected, ruleset);
  $("mode-compatibility").textContent = issue;
  $("mode-compatibility").hidden = !issue;
  for (const id of ["ai-play", "create-room", "practice"])
    $(id).disabled = !!issue;
  document.querySelector('[data-mode="ai"]').disabled = false;
}
for (const selected of maps.values())
  if (!["bun06_8", "water11_8"].includes(selected.id)) {
    const option = document.createElement("option");
    option.value = selected.id;
    option.textContent = `${selected.name} · ${selected.description}${selected.supportedModes ? " · " + selected.supportedModes.map((mode) => GAME_MODES[mode]).join(" / ") : ""}`;
    $("map-select").append(option);
  }
let lobbyMode = "ai";
function selectLobbyMode(mode) {
  lobbyMode = mode;
  for (const button of document.querySelectorAll("[data-mode]"))
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  for (const key of ["ai", "online", "practice"])
    $(`mode-${key}`).hidden = key !== mode;
}
for (const button of document.querySelectorAll("[data-mode]"))
  button.onclick = () => selectLobbyMode(button.dataset.mode);
$("map-select").onchange = mapPreview;
for (const button of document.querySelectorAll("[data-ruleset]"))
  button.onclick = () => {
    ruleset = button.dataset.ruleset;
    $("map-select").value = selectedMaps[ruleset];
    mapPreview();
  };
for (const selected of maps.values()) {
  const roomOption = document.createElement("option");
  roomOption.value = selected.id;
  roomOption.textContent = selected.name;
  $("room-create-map").append(roomOption);
  const button = document.createElement("button");
  button.className = "map-option";
  button.dataset.map = selected.id;
  button.setAttribute("aria-label", `选择${selected.name}`);
  const preview = document.createElement("canvas");
  preview.width = 150;
  preview.height = 130;
  preview.setAttribute("aria-hidden", "true");
  paintLobbyMap(preview.getContext("2d"), selected);
  const title = document.createElement("b");
  title.textContent = selected.name;
  const caption = document.createElement("small");
  caption.textContent =
    (selected.description ||
      (selected.mode === "water11" ? "1–5 人合作挑战" : "经典抢包 · 2–8 人")) +
    (selected.supportedModes
      ? " · " +
        selected.supportedModes.map((mode) => GAME_MODES[mode]).join(" / ")
      : "");
  button.append(preview, title, caption);
  if(selected.strategy){const tactics=document.createElement('small');tactics.className='map-strategy';tactics.textContent=selected.strategy;button.append(tactics);}
  button.onclick = () => {
    $("map-select").value = selected.id;
    mapPreview();
    closeLobbyPage();
  };
  $("map-options").append(button);
}
$("map-picker-open").onclick = () => openLobbyPage("maps-dialog");
$("close-maps").onclick = () => closeLobbyPage();
for (const id of ["rooms-open", "rooms-shortcut"])
  $(id).onclick = () => {
    $("room-create-map").value = $("map-select").value;
    $("room-create-mode").value = ruleset;
    $("room-bio-level").value = $("bio-level").value;
    $("room-bio-incubation").value = $("bio-incubation").value;
    roomCompatibility();
    openLobbyPage("rooms-dialog");
  };
for (const [key, label] of Object.entries({ all: "全部", ...GAME_MODES })) {
  const b = document.createElement("button");
  b.textContent = label;
  b.dataset.roomFilter = key;
  b.setAttribute("aria-pressed", String(key === roomFilter));
  b.onclick = () => {
    roomFilter = key;
    for (const el of $("room-filters").children)
      el.setAttribute("aria-pressed", String(el === b));
    renderLobby();
  };
  $("room-filters").append(b);
}
$("close-rooms").onclick = () => closeLobbyPage();
mapPreview();
// 困泡时长由服务端决定（PVE 水面11 是 RULES.trapPve），快照里只下发一次。
// 破泡动画的播放进度要靠它反推：写成函数是为了每次读当前 state，而不是建场时的那份。
const trapDuration = () => state.trapDuration ?? RULES.trap;
function standingLift(p) {
  if (p.renderLayer !== "wall" || !p.renderWallCell) return 0;
  const [x, y] = p.renderWallCell.split(",").map(Number);
  return Math.max(
    0,
    (manifest[`tile${blocks()[y * (map.width || 15) + x] - 8000}`]?.h || 40) -
      40,
  );
}
function playerSprite(p, x, y, time, alpha = 1) {
  if (hiddenInWater(map, p)) return;
  const team = p.appearance ? "red" : p.team === 0 ? "red" : "blue",
    action = p.moving ? "walk" : "stand",
    dir = DIR[p.dir]?.[2] ?? 3;
  const lift = standingLift(p);
  ctx.save();
  ctx.fillStyle = p.team === 0 ? "#e55b6777" : "#4c9bea77";
  ctx.beginPath();
  ctx.ellipse(x, y + 17, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (p.status === "trapped") {
    const age = Math.max(0, state.time - (p.trappedUntil - trapDuration())),
      key = age < 0.4 ? "trap-bubble" : "trap-shell",
      m = manifest[key];
    sprite(
      key,
      x - m.w / 2,
      y + 19 - m.h - lift,
      age < 0.4 ? age * 12 : time / 100,
      1,
      0.85,
    );
    sprite(
      `prince-${team}-trigger`,
      x - 50,
      y - 64 - lift,
      time / 100,
      1,
      alpha,
      p.appearance,
    );
    sprite(
      key,
      x - m.w / 2,
      y + 19 - m.h - lift,
      age < 0.4 ? age * 12 : time / 100,
      1,
      0.28,
    );
  } else
    sprite(
      `prince-${team}-${action}-${dir}`,
      x - 50,
      y - 64 - lift,
      p.moving ? time / 80 : 0,
      1,
      alpha,
      p.appearance,
    );
  ctx.restore();
}
function selfMarker(p) {
  const pos = rendered.get(p.id) || p,
    rawY = OY + pos.y * T - (p.carry === null ? 48 : 72) - standingLift(p);
  const x =
      OX +
      pos.x * T +
      (p.carry !== null && rawY < 16 ? (pos.x > 13.5 ? -24 : 24) : 0),
    y = Math.max(16, rawY);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#eaffff";
  ctx.fillStyle = "#44b7ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(4, -10);
  ctx.lineTo(4, -3);
  ctx.lineTo(9, -3);
  ctx.lineTo(0, 6);
  ctx.lineTo(-9, -3);
  ctx.lineTo(-4, -3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function render(now) {
  if (document.body.dataset.lobbyPage || document.hidden) {
    previousFrame = now;
    requestAnimationFrame(render);
    return;
  }
  const dt = Math.min(0.05, (now - previousFrame) / 1000);
  previousFrame = now;
  ctx.clearRect(0, 0, 800, 600);
  ctx.fillStyle = "#2594cb";
  ctx.fillRect(0, 0, 800, 600);
  ctx.save();
  ctx.beginPath();
  ctx.rect(8, 0, 600, 542);
  ctx.clip();
  ctx.save();
  const focus = state.players.find((p) => p.id === myId),
    position = focus && (rendered.get(focus.id) || focus);
  const following =
    position && ((map.width || 15) > 15 || (map.height || 13) > 13);
  const minX = following ? Math.max(0, Math.floor(position.x) - 9) : 0,
    maxX = following
      ? Math.min(map.width, Math.ceil(position.x) + 9)
      : map.width || 15;
  const minY = following ? Math.max(0, Math.floor(position.y) - 9) : 0,
    maxY = following
      ? Math.min(map.height, Math.ceil(position.y) + 10)
      : map.height || 13;
  ctx.fillStyle = "#123b58";
  ctx.fillRect(8, 0, 600, 542);
  if (following)
    ctx.translate(
      Math.round(300 - position.x * T),
      Math.round(260 - position.y * T),
    );
  for (let y = minY; y < maxY; y++)
    for (let x = minX; x < maxX; x++)
      sprite(
        map.mode === "water11" && map.theme !== "frost"
          ? `water-${map.ground[y * (map.width || 15) + x]}`
          : groundKey(map),
        OX + x * T,
        OY + y * T,
      );
  paintTactics(ctx,map,OX,OY);
  if (state.mode === "bio") {
    for (const p of state.players || []) {
      const d = p.dome;
      if (!d?.active) continue;
      const x = OX + d.x * T, y = OY + d.y * T, r = d.radius * T;
      const g = ctx.createRadialGradient(x, y, r * .15, x, y, r);
      g.addColorStop(0, "#9beeff18"); g.addColorStop(.78, "#3dc8e92a"); g.addColorStop(1, "#84e8ff78");
      ctx.fillStyle = g; ctx.strokeStyle = p.id === myId ? "#fff0a0" : "#83dff0"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#ffdf6b"; ctx.lineWidth = 4; ctx.beginPath();
      ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, d.hp / d.maxHp)); ctx.stroke();
      ctx.fillStyle = "#08324dcc"; ctx.fillRect(x - 30, y - r - 18, 60, 7);
      ctx.fillStyle = "#7ff0c4"; ctx.fillRect(x - 29, y - r - 17, 58 * Math.max(0, d.hp / d.maxHp), 5);
    }
  }
  if (map.mode !== "water11")
    for (let y = minY; y < maxY; y++)
      for (let x = minX; x < maxX; x++) {
        const tile = map.ground[y * (map.width || 15) + x];
        if (tile > 0 && tile !== 8011)
          sprite(`tile${tile - 8000}`, OX + x * T, OY + y * T);
      }
  if (state.survivor) {
    for (const gem of state.survivor.gems) {
      const x = OX + gem.x * T,
        y = OY + gem.y * T;
      ctx.fillStyle = "#6affe1";
      ctx.fillRect(x - 4, y - 6, 8, 12);
      ctx.fillStyle = "#e9fff9";
      ctx.fillRect(x - 2, y - 4, 3, 5);
    }
    for (const shot of state.survivor.shots) {
      const x = OX + shot.x * T,
        y = OY + shot.y * T;
      ctx.fillStyle = shot.kind === "frost" ? "#99efff88" : "#80eaff88";
      ctx.strokeStyle = "#efffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - 3, y - 4, 3, 3);
    }
  }

  // 生化模式使用每名玩家独立的安全泡泡；不再绘制固定防守区。
  for (const item of state.items || []) {
    if (item.availableAt > state.time) continue;
    if (item.kind === "aid") {
      const x = OX + (item.x + 0.5) * T,
        y = OY + (item.y + 0.5) * T;
      ctx.fillStyle = "#173c54";
      ctx.fillRect(x - 12, y - 11, 24, 23);
      ctx.fillStyle = "#d7ae59";
      ctx.fillRect(x - 10, y - 9, 20, 19);
      ctx.fillStyle = "#ffe49b";
      ctx.fillRect(x - 10, y - 9, 20, 5);
      ctx.fillStyle = "#268cac";
      ctx.fillRect(x - 4, y - 9, 8, 19);
      text("?", x, y + 5, 14, "#fff");
      text("援助物资", x, y - 17, 9, "#e7ffff");
      continue;
    }
    const key = ITEM_ICONS[item.kind];
    const m = manifest[key];
    if (m)
      sprite(
        key,
        OX + (item.x + 0.5) * T - m.w / 2,
        OY + (item.y + 0.5) * T - m.h / 2,
        now / 130,
      );
  }
  for (const b of state.buns || [])
    bun(OX + (b.x + 0.5) * T, OY + (b.y + 0.5) * T, 1.5, b.owner);
  for (const f of state.flames || []) {
    if (
      map.bases.some(
        (b) => f.x >= b.x && f.x < b.x + b.w && f.y >= b.y && f.y < b.y + b.h,
      )
    )
      continue;
    const x = OX + (f.x + 0.5) * T,
      y = OY + (f.y + 0.5) * T;
    if (f.kind === "frost" || f.kind === "shock") {
      ctx.fillStyle = f.kind === "frost" ? "#8be7ffee" : "#ffd665dd";
      ctx.fillRect(x - 17, y - 17, 34, 34);
      text(f.kind === "frost" ? "❄" : "↔", x, y + 7, 20, "#fff");
      continue;
    }
    const parts = { right: [2, 6], up: [3, 7], left: [4, 8], down: [5, 9] };
    const key =
      f.arm === "center" ? "flame1" : `flame${parts[f.arm][f.end ? 1 : 0]}`;
    const m = manifest[key];
    sprite(
      key,
      x - m.w / 2,
      y - m.h / 2,
      Math.min(m.frames - 1, ((state.time - f.born) / RULES.flame) * m.frames),
    );
  }
  for (const w of state.warnings || []) {
    const x = OX + w.x * T,
      y = OY + w.y * T;
    ctx.fillStyle = Math.floor(now / 180) % 2 ? "#ffdb6566" : "#ff685566";
    ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
    ctx.strokeStyle = "#ffdf65";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
    text("!", x + T / 2, y + 27, 24, "#fff2a2");
  }
  const drawables = [];
  for (const e of state.enemies || [])
    if (e.status !== "dead")
      drawables.push({
        z: e.y,
        type: e.kind === "boss" ? "boss" : "zombie",
        p: e,
      });
  if (map.mode === "water11") {
    for (const o of map.objects)
      if (!o.breakable || blocks()[o.y * (map.width || 15) + o.x])
        drawables.push({ ...o, z: o.y + o.h - 0.2, type: "water" });
    if (state.boss)
      drawables.push({ z: state.boss.y, type: "boss", p: state.boss });
  }
  if (map.mode !== "water11")
    for (let y = minY; y < maxY; y++)
      for (let x = minX; x < maxX; x++) {
        const tile = blocks()[y * (map.width || 15) + x];
        if (tile > 0)
          drawables.push({ z: y + 0.8, type: "tile", tile: tile - 8000, x, y });
        const building = map.structures[y * (map.width || 15) + x];
        if (building > 0)
          drawables.push({
            z: y + 2.7,
            type: "building",
            tile: building - 8000,
            x,
            y,
          });
      }
  for (const b of state.bombs || []) {
    // 洞口里的糖泡跟人和水手一样藏起来；爆炸不藏，火焰照常画。
    if (hiddenInWater(map, { x: b.x + 0.5, y: b.y + 0.5 })) continue;
    const occupants = (state.players || []).filter(
      (p) => Math.floor(p.x) === b.x && Math.floor(p.y) === b.y,
    );
    drawables.push({
      z: Math.min(b.y + 0.35, ...occupants.map((p) => p.y - 0.01)),
      type: "bomb",
      b,
    });
  }
  for (const p of state.players || [])
    if (p.status !== "dead" && p.inHouse === null && p.renderLayer !== "wall")
      drawables.push({ z: p.y, type: "player", p });
  drawables.sort((a, b) => a.z - b.z);
  for (const d of drawables) {
    if (d.type === "water") {
      const anchor = waterElementPosition(d, T);
      sprite(
        d.renderKey || `water-${d.id}`,
        OX + anchor.x,
        OY + anchor.y,
        now / 100,
      );
      // 玩家踏进洞口时铺上原版 trigger 的 5 帧点亮动画。和洞口同一层画，站在洞口
      // 前面的角色才不会被它盖住。
      if (d.id === 5010) {
        const lit = localEffects.find(
            (e) => e.type === "cave-lit" && e.x === d.x && e.y === d.y,
          ),
          m = manifest["water-trigger-5010"];
        if (lit && m) {
          const age = (now - lit.received) / 1000;
          sprite(
            "water-trigger-5010",
            OX + anchor.x,
            OY + anchor.y,
            Math.min(m.frames - 1, age * 12),
            1,
            Math.max(0, 1 - age / 0.6),
          );
        }
      }
    } else if (d.type === "boss") {
      if (d.p.appearance) {
        const e = d.p,
          key = `prince-red-${e.moving ? "walk" : "stand"}-${DIR[e.dir][2]}`;
        sprite(
          key,
          OX + e.x * T - 70,
          OY + e.y * T - 90,
          e.moving ? now / 100 : 0,
          1.4,
          1,
          e.appearance,
        );
        continue;
      }
      if (
        hiddenInWater(map, d.p) ||
        (d.p.hp <= 0 && state.time > d.p.phaseUntil)
      )
        continue;
      const b = d.p,
        action =
          b.hp <= 0
            ? "die"
            : b.phase === "birth"
              ? "birth"
              : b.moving
                ? `walk-${DIR[b.dir][2]}`
                : `stand-${DIR[b.dir][2]}`,
        key = `sailor-${action}`,
        m = manifest[key];
      if (m) {
        const frame =
          b.hp <= 0
            ? Math.min(m.frames - 1, (state.time - b.phaseUntil + 0.9) * 10)
            : b.phase === "birth"
              ? Math.min(m.frames - 1, state.time * 10)
              : now / 100;
        sprite(
          key,
          OX + b.x * T - m.w / 2,
          OY + b.y * T - 64,
          frame,
          1,
          state.time < b.hurtUntil && Math.floor(now / 90) % 2 ? 0.5 : 1,
        );
      }
    } else if (d.type === "zombie") {
      const e = d.p,
        key = `prince-red-${e.moving ? "walk" : "stand"}-${DIR[e.dir][2]}`;
      sprite(
        key,
        OX + e.x * T - 50,
        OY + e.y * T - 64,
        e.moving ? now / 85 : 0,
        1,
        state.time < e.hurtUntil && Math.floor(now / 90) % 2 ? 0.5 : 1,
        e.appearance,
      );
      if (e.frozenUntil > state.time) {
        ctx.fillStyle = "#89eaff66";
        ctx.fillRect(OX + e.x * T - 18, OY + e.y * T - 42, 36, 44);
      }
      if (e.phase === "windup")
        text("!", OX + e.x * T, OY + e.y * T - 55, 20, "#ffdf65");
    } else if (d.type === "tile" || d.type === "building") {
      const key = d.type === "building" ? `tile${d.tile}` : tileKey(d.tile),
        m = manifest[key];
      if (m)
        sprite(
          key,
          OX + d.x * T,
          OY + (d.y + (d.type === "building" ? 3 : 1)) * T - m.h,
        );
    } else if (d.type === "bomb") {
      const b = d.b,
        key = manifest[`bomb-${b.kind}`]
          ? `bomb-${b.kind}`
          : b.skin === "fire"
            ? "bomb-fire"
            : "bomb1",
        m = manifest[key];
      const bubble = (!b.kind || b.kind==='normal') && characterBubbles.get(b.character);
      if(bubble){const pulse=1+Math.sin(now/170)*.05;ctx.drawImage(bubble,OX+(b.x+.5)*T-20*pulse,OY+(b.y+.5)*T-20*pulse,40*pulse,40*pulse);}
      else sprite(
        key,
        OX + (b.x + 0.5) * T - m.w / 2,
        OY + (b.y + 0.5) * T - m.h / 2 - (b.skin === "fire" ? 5 : 0),
        now / (b.skin === "fire" ? 200 : 170),
      );
    } else {
      const p = d.p;
      let pos = rendered.get(p.id);
      if (!pos || Math.hypot(pos.x - p.x, pos.y - p.y) > 1.5)
        pos = { x: p.x, y: p.y };
      else {
        const blend = 1 - Math.exp(-dt * 65);
        pos.x += (p.x - pos.x) * blend;
        pos.y += (p.y - pos.y) * blend;
      }
      rendered.set(p.id, pos);
      // 本机玩家：立刻按当前按键位移，消除输入往返延迟带来的粘滞感。
      // 服务器确认后偏移自然收敛，且总量被限制在 maxLead 内 ——
      // 即使顶着墙走也不会滑出去，最多超前一点再平滑归位。
      let rx = pos.x,
        ry = pos.y;
      if (p.id === myId && roomCode) {
        if (!predicted) predicted = { x: 0, y: 0 };
        if (p.status === "alive" && moveDirection()) {
          const dir = moveDirection();
          if (dir) {
            const [dx, dy] = DIR[dir],
              speed =
                (p.carry === null ? p.speed : RULES.carrySpeed) *
                (p.hasteUntil > state.time ? 1.35 : 1);
            predicted.x += dx * speed * dt;
            predicted.y += dy * speed * dt;
          }
        }
        const decay = 1 - Math.exp(-dt * PREDICT.reconcile);
        predicted.x *= decay;
        predicted.y *= decay;
        const m = Math.hypot(predicted.x, predicted.y);
        if (m > PREDICT.maxLead) {
          predicted.x *= PREDICT.maxLead / m;
          predicted.y *= PREDICT.maxLead / m;
        }
        rx += predicted.x;
        ry += predicted.y;
      }
      playerSprite(p, OX + rx * T, OY + ry * T, now);
    }
  }
  for (const base of map.bases) {
    const colors = state.stored
      ? [
          ...Array(state.stored[base.team][0]).fill(0),
          ...Array(state.stored[base.team][1]).fill(1),
        ]
      : Array(state.stock[base.team]).fill(base.team);
    for (let i = 0; i < Math.min(colors.length, 6); i++)
      bun(
        OX + base.x * T + 45 + (i % 3) * 12,
        OY + base.y * T - 1 + Math.floor(i / 3) * 9,
        0.68,
        colors[i],
      );
  }
  localEffects = localEffects.filter((e) => now - e.received < 600);
  for (const e of localEffects) {
    const age = (now - e.received) / 1000;
    if (e.type === "break") {
      const o =
          map.mode === "water11"
            ? map.objects.find((o) => o.x === e.x && o.y === e.y)
            : null,
        key = o ? `water-break-${o.id}` : `break${e.tile}`,
        m = manifest[key];
      if (m)
        sprite(
          key,
          OX + e.x * T - (o?.offset[0] || 0),
          o ? OY + e.y * T - o.offset[1] : OY + (e.y + 1) * T - m.h,
          Math.min(m.frames - 1, age * 16),
          1,
          Math.max(0, 1 - age / 0.6),
        );
    } else if (e.type === "death") {
      const m = manifest["trap-pop"];
      sprite(
        "trap-pop",
        OX + e.x * T - m.w / 2,
        OY + e.y * T + 19 - m.h,
        Math.min(1, age * 10),
        1,
        Math.max(0, 1 - age / 0.3),
      );
    } else if (e.type === "training-warp") {
      ctx.strokeStyle = `rgba(255,238,125,${Math.max(0, 1 - age / 0.3)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(OX + e.fromX * T, OY + e.fromY * T);
      ctx.lineTo(OX + e.x * T, OY + e.y * T);
      ctx.stroke();
    } else if (e.type === "cave-lit") {
      /* 画在洞口自己那一层，见上面 water drawable */
    } else {
      ctx.strokeStyle = `rgba(205,255,255,${Math.max(0, 1 - age / 0.6)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        OX + e.x * T,
        OY + e.y * T,
        15 + age * 35,
        7 + age * 18,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  // Elevated actors are a separate foreground pass; scenery cannot cover them.
  if (state.practice)
    for (const item of state.hiddenItems || []) {
      const key = ITEM_ICONS[item.kind],
        m = manifest[key],
        x = OX + (item.x + 0.5) * T,
        y = OY + (item.y + 0.5) * T;
      ctx.save();
      ctx.fillStyle = "#e9fbff66";
      ctx.fillRect(x - 17, y - 17, 34, 34);
      ctx.strokeStyle = "#8be8ff";
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x - 18, y - 18, 36, 36);
      ctx.restore();
      sprite(key, x - m.w / 2, y - m.h / 2, now / 130, 1, 0.9);
    }
  for (const p of state.players)
    if (
      p.status !== "dead" &&
      (p.renderLayer === "wall" || (state.practice && p.warpUntil > state.time))
    ) {
      rendered.set(p.id, { x: p.x, y: p.y });
      playerSprite(p, OX + p.x * T, OY + p.y * T, now);
    }
  // Carry icons and labels are always above scenery and actor sprites.
  for (const item of state.items || []) {
    if (!item.flight || item.availableAt <= state.time) continue;
    const f = item.flight,
      t = Math.max(0, Math.min(1, (state.time - f.born) / f.duration));
    const key = ITEM_ICONS[item.kind],
      m = manifest[key];
    if (!m) continue;
    const x = OX + (f.x + (item.x + 0.5 - f.x) * t) * T;
    const y =
      OY +
      (f.y + (item.y + 0.5 - f.y) * t) * T -
      (48 +
        Math.min(40, Math.hypot(item.x + 0.5 - f.x, item.y + 0.5 - f.y) * 4)) *
        4 *
        t *
        (1 - t);
    sprite(key, x - m.w / 2, y - m.h / 2, now / 130);
  }
  // 原版怪物血条：贴在 boss 头上，不占顶部 HUD。画在所有 actor 之后，墙和火焰盖不住它。
  if (
    state.mode === "water11" &&
    state.boss &&
    state.boss.hp > 0 &&
    !hiddenInWater(map, state.boss)
  ) {
    const b = state.boss,
      plate = manifest["boss-hp-plate"],
      bar = manifest["boss-hp"],
      x = OX + b.x * T;
    // 帧号 = 血量 - 1（10 滴血对 10 帧）。锚定格子而不是动画帧，走动时不会上下抖。
    // 分两帧画：misc196 是 41x8 的深色底板，比 39x6 的血条各边大 1 像素。
    const top = Math.max(2, OY + b.y * T - 61);
    if (plate) sprite("boss-hp-plate", x - plate.w / 2, top);
    if (bar) sprite("boss-hp", x - bar.w / 2, top + 1, b.hp - 1);
  }
  // Shield follows the same server timer as invulnerability, above terrain.
  for (const p of state.players) {
    if (
      hiddenInWater(map, p) ||
      p.status !== "alive" ||
      state.state !== "playing" ||
      !(state.time < p.shieldUntil || (state.practice && p.mods?.invincible))
    )
      continue;
    const m = manifest["spawn-halo"],
      pos = rendered.get(p.id) || p;
    const age =
      p.shieldUntil < 1e8
        ? Math.max(0, state.time - (p.shieldUntil - RULES.shield))
        : state.time;
    if (m)
      sprite(
        "spawn-halo",
        OX + pos.x * T - m.w / 2,
        OY + pos.y * T - 20 - m.h / 2 - standingLift(p),
        age * 10,
        1,
        0.8,
      );
  }
  for (const p of state.players) {
    const age = state.time - (p.diedAt ?? p.respawnAt - RULES.respawn);
    if (p.status === "dead" && age >= 0 && age < 2)
      sprite(
        p.team === 0 ? "death-cry" : "death-cry-blue",
        OX + p.x * T - 50,
        OY + p.y * T - 64,
        age * 2,
      );
    if (p.status !== "dead" && p.emoteUntil > state.time) {
      const key = `emote-${p.emote}`,
        m = manifest[key],
        pos = rendered.get(p.id) || p;
      if (m)
        sprite(
          key,
          OX + pos.x * T - m.w / 2,
          Math.max(0, OY + pos.y * T - 80 - standingLift(p)),
          0,
        );
    }
  }
  for (const p of state.players) {
    if (p.status === "dead") continue;
    const pos = p.inHouse !== null ? p : rendered.get(p.id) || p,
      lift = standingLift(p);
    if (p.carry !== null)
      carriedBun(
        OX + pos.x * T,
        Math.max(12, OY + pos.y * T - 49 - lift),
        1.55,
      );
    if (roomCode && p.id !== myId && p.inHouse === null && p.name)
      text(
        p.name,
        OX + pos.x * T,
        Math.max(10, OY + pos.y * T - (p.carry === null ? 49 : 72) - lift),
        9,
        p.team === 0 ? "#ffdddd" : "#d6f1ff",
      );
  }
  for (const p of [
    ...state.players,
    ...(state.mode === "bio" ? state.enemies || [] : []),
  ])
    if (p.status !== "dead" && p.infectedUntil > state.time) {
      const pos = rendered.get(p.id) || p;
      text(
        `感染 ${Math.ceil(p.infectedUntil - state.time)}秒`,
        OX + pos.x * T,
        OY + pos.y * T - 62,
        11,
        "#ffe17a",
      );
    }
  if (["boss", "bio", "water11", "survivor"].includes(state.mode)) {
    const actors = [
      ...state.players,
      ...(state.enemies || []),
      ...(state.boss ? [state.boss] : []),
    ];
    for (const actor of actors) {
      const health = actor.run || actor;
      if (
        actor.status === "dead" ||
        health.hp <= 0 ||
        !health.maxHp ||
        hiddenInWater(map, actor)
      )
        continue;
      const pos = rendered.get(actor.id) || actor,
        x = OX + pos.x * T,
        y = OY + pos.y * T;
      if (actor.bubbleUntil > state.time) {
        ctx.fillStyle = "#74dfff55";
        ctx.strokeStyle = "#d6ffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y - 20, 24, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (actor.faction) {
        ctx.strokeStyle = actor.faction === "zombie" ? "#df80dc" : "#70edb1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y - 1, 14, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (actor.mother) text("母体", x, y - 82, 10, "#ffd665");
      }
      if (actor === state.boss) continue;
      const barY = y - (actor.status ? 74 : 57);
      ctx.fillStyle = "#123b54";
      ctx.fillRect(x - 21, barY, 42, 7);
      ctx.fillStyle =
        actor.faction === "zombie"
          ? "#db85db"
          : actor.faction === "human" || actor.status
            ? "#70edb1"
            : "#ffbd69";
      ctx.fillRect(
        x - 20,
        barY + 1,
        40 * Math.max(0, Math.min(1, health.hp / health.maxHp)),
        5,
      );
    }
  }
  const markerPlayer = state.players.find(
    (p) => p.id === myId && p.status !== "dead",
  );
  if (markerPlayer) {
    if (markerPlayer.inHouse !== null)
      rendered.set(markerPlayer.id, { x: markerPlayer.x, y: markerPlayer.y });
    selfMarker(markerPlayer);
  }
  if (debug && state.practice) {
    ctx.strokeStyle = "#ffffff55";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= 15; x++) {
      ctx.beginPath();
      ctx.moveTo(OX + x * T, OY);
      ctx.lineTo(OX + x * T, OY + 13 * T);
      ctx.stroke();
    }
    for (let y = 0; y <= 13; y++) {
      ctx.beginPath();
      ctx.moveTo(OX, OY + y * T);
      ctx.lineTo(OX + 15 * T, OY + y * T);
      ctx.stroke();
    }
    for (const p of state.players) {
      ctx.strokeStyle = "#ff355c";
      ctx.strokeRect(
        OX + (p.x - RULES.radius) * T,
        OY + (p.y - RULES.radius) * T,
        RULES.radius * T * 2,
        RULES.radius * T * 2,
      );
    }
  }
  ctx.restore();
  if (state.state === "countdown") {
    const elapsed = 3 - state.countdown;
    // Original ready.eff: two sweeps behind the text, at 0s and 1s.
    for (const start of [0, 1]) {
      const age = elapsed - start,
        m = manifest["ready-streak"];
      if (age < 0 || age >= 0.8 || !m) continue;
      const offset =
        age < 0.3 ? -600 + (600 * age) / 0.3 : (600 * (age - 0.3)) / 0.5;
      const alpha = age < 0.3 ? 1 : (0.8 - age) / 0.5;
      sprite(
        "ready-streak",
        308 + m.offsetX + offset,
        260 + m.offsetY,
        0,
        1,
        alpha,
      );
    }
    for (const [name, start] of [
      ["ready-original", 0],
      ["go-original", 1],
    ]) {
      const age = elapsed - start,
        m = manifest[name];
      if (age < 0 || age > 2 || !m) continue;
      const offset =
        age < 0.3
          ? -600 + (650 * age) / 0.3
          : age < 0.4
            ? (50 * (0.4 - age)) / 0.1
            : 0;
      const alpha = age < 0.8 ? 1 : Math.max(0, (2 - age) / 1.2);
      sprite(name, 308 + m.offsetX + offset, 260 + m.offsetY, 0, 1, alpha);
    }
  }
  ctx.restore();
  // Original 800x600 client frame and player list.
  sprite("dlg_playerList", 609, 0);
  sprite("dlg_statusBar", 0, 541);
  const time = state.survivor
      ? Math.floor(state.survivor.elapsed)
      : Math.ceil(state.remaining),
    clock =
      state.practice && state.mode !== "water11"
        ? "练习"
        : `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
  if (state.practice && state.mode !== "water11")
    text(clock, 713, 71, 30, "#ffe12e");
  if (state.practice) text(clock, 713, 71, 30, "#ffe12e");
  else
    for (let i = 0; i < clock.length; i++)
      sprite(
        "timer-digits",
        713 - (clock.length * 27) / 2 + i * 27,
        53,
        "0123456789/:-+.".indexOf(clock[i]),
      );
  if (state.mode === "water11") text("水面11", 750, 24, 12, "#e8f8ff");
  else {
    bun(687, 23, 0.85);
    text(map.name, 748, 24, 11, "#e8f8ff");
  }
  const coop = ["water11", ...EXPEDITION_MODES].includes(state.mode);
  const red = state.players.filter((p) => p.team === 0),
    blue = state.players.filter((p) => p.team === 1);
  for (
    let slot = 0;
    slot < (EXPEDITION_MODES.includes(state.mode) ? 5 : 8);
    slot++
  ) {
    const p = coop
        ? state.players[slot]
        : slot < 4
          ? red[slot]
          : blue[slot - 4],
      y = 105 + slot * 51;
    const rowGradient = ctx.createLinearGradient(649, y, 794, y);
    rowGradient.addColorStop(0, "#202630");
    rowGradient.addColorStop(1, "#3a4655");
    ctx.fillStyle = rowGradient;
    ctx.fillRect(649, y + 2, 145, 46);
    ctx.fillStyle = slot < 4 ? "#fb6871" : "#73bcff";
    ctx.fillRect(650, y + 4, 2, 41);
    if (p) {
      const largeDecor = hasLargeDecor(p.appearance);
      sprite(
        `prince-${p.appearance ? "red" : p.team === 0 ? "red" : "blue"}-stand-3`,
        largeDecor ? 651 : 636,
        largeDecor ? y + 1 : y - 18,
        0,
        largeDecor ? 0.46 : 0.8,
        p.status === "dead" ? 0.35 : 1,
        p.appearance,
      );
      text(p.name || "毛毛", 700, y + 16, 10, "#fff", "left");
      const status =
        p.status === "dead"
          ? coop && p.faction !== "zombie"
            ? "阵亡 · 观战"
            : `${Math.max(0, Math.ceil(p.respawnAt - state.time))} 秒复活`
          : p.infectedUntil > state.time
            ? `感染 ${Math.ceil(p.infectedUntil - state.time)}秒`
            : p.status === "trapped"
              ? "等待营救"
              : p.carry !== null
                ? "正在背包"
                : p.ready
                  ? "已准备"
                  : "对局中";
      text(
        status,
        700,
        y + 34,
        8,
        p.carry !== null ? "#ffdd6c" : "#98c9e0",
        "left",
        false,
      );
      text(String(slot + 1), 633, y + 24, 15, "#e5faff");
    } else {
      text("等待加入", 718, y + 26, 10, "#8fbad1", "center", false);
    }
  }
  if (EXPEDITION_MODES.includes(state.mode)) {
    ctx.fillStyle = "#0a2d47";
    ctx.fillRect(649, 366, 145, 150);
    text(
      state.mode === "survivor"
        ? "幸存者"
        : state.mode === "boss"
          ? "首领挑战"
          : "生化生存",
      721,
      389,
      16,
      "#ffe672",
    );
    if (state.mode === "survivor") {
      const run = state.players.find((p) => p.id === myId)?.run;
      if (run) {
        text(
          `生命 ${run.hp}/${run.maxHp} · Lv.${run.level}`,
          721,
          415,
          11,
          "#e6faff",
        );
        ctx.fillStyle = "#173b50";
        ctx.fillRect(661, 426, 121, 8);
        ctx.fillStyle = "#6ce4b2";
        ctx.fillRect(661, 426, 121 * Math.max(0, Math.min(1, run.xp / Math.max(1, run.nextXp))), 8);
        text(
          `经验 ${Math.floor(run.xp)}/${run.nextXp}`,
          721,
          449,
          10,
          "#a3ffe2",
        );
        text(
          `第 ${state.wave} 波 · 敌人 ${state.enemies.length}`,
          721,
          469,
          10,
          "#ffe17a",
        );
        text(
          `已获：${(run.acquired || []).slice(-2).join(" · ") || "暂无强化"}`,
          721,
          489,
          8,
          "#bde9fa",
        );
      }
    } else if (state.mode === "boss") {
      const boss = state.enemies?.find((e) => e.kind === "boss");
      if (boss) {
        ctx.fillStyle = "#254660";
        ctx.fillRect(661, 408, 121, 12);
        ctx.fillStyle = "#ef707a";
        ctx.fillRect(661, 408, (121 * boss.hp) / boss.maxHp, 12);
        text(`${boss.hp} / ${boss.maxHp}`, 721, 443, 14, "#fff");
        text(
          boss.hp <= boss.maxHp / 2 ? "强化阶段" : "常规阶段",
          721,
          468,
          12,
          "#ffda65",
        );
      }
    } else {
      const self = state.players.find((p) => p.id === myId),
        bio = state.bio || {},
        build = self?.bioBuild;
      text(
        bio.phase === "preparation"
          ? `母体出现 ${Math.ceil(bio.preparationRemaining)} 秒`
          : self?.faction === "zombie"
            ? "丧尸 · 感染人类"
            : "人类 · 抵御感染",
        721,
        411,
        11,
        "#ffe17a",
      );
      text(
        `人类 ${bio.humans || 0} · 丧尸 ${bio.zombies || 0}`,
        721,
        431,
        11,
        "#e6faff",
      );
      text(
        `强化 ${Math.floor(build?.xp || 0)}/${build?.nextXp || 6} · Lv.${build?.level || 1}`,
        721,
        452,
        10,
        "#a3ffe2",
      );
      text(
        `物资刷新 ${Math.ceil(bio.supplyRemaining || 0)} 秒`,
        721,
        473,
        10,
        "#bde9fa",
      );
    }

    text(
      state.mode === "bio" &&
        state.players.find((p) => p.id === myId)?.faction === "zombie"
        ? "空格 利爪 · Q 突进"
        : "E 切换 · R 引爆",
      721,
      499,
      12,
      "#bde9fa",
    );
  }
  const me = state.players.find((p) => p.id === myId);
  if (me) {
    text(String(me.capacity - RULES.capacity), 53, 590, 10, "#ffe066");
    for (const [i, [key, count]] of [
      ["item24", me.forks],
      ["item23", me.bananas],
      ["item25", me.smiles],
    ].entries()) {
      if (!count) continue;
      const m = manifest[key],
        cx = 204 + i * 54,
        scale = Math.min(1, 30 / m.w, 30 / m.h);
      sprite(
        key,
        cx - (m.w * scale) / 2,
        565 - (m.h * scale) / 2,
        now / 130,
        scale,
      );
      text(String(count), cx, 587, 12, "#fff");
    }
    text(String(me.power - RULES.power), 103, 590, 10, "#ffe066");
    text(String(me.speed - RULES.speed), 156, 590, 10, "#ffe066");
  }
  if (roomCode && performance.now() - lastStateAt > 2500)
    text(localMode ? "正在恢复单人对局…" : "等待服务器响应…", 307, 30, 12, "#ffe99d");
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
