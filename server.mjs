#!/usr/bin/env node
// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { NPC_DESIGNS } from "./public/appearance.mjs";
import { TOWN, stepTown, townPath, createTownNPCs, tickTownNPC, talkTownNPC } from "./public/town.mjs";
import { BioMatch } from "./public/bio.mjs";
import { SurvivorMatch } from "./public/survivor.mjs";
import http from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import os from "node:os";
import { WebSocketServer, WebSocket } from "ws";
import { Match, RULES } from "./public/engine.mjs";
import {
  ExpeditionMatch,
  EXPEDITION_MODES,
  validateBioOptions,
} from "./public/expedition.mjs";
import { WaterMatch } from "./public/water11.mjs";
import { BOT_LEVELS, addBot, tickBot } from "./bots.mjs";
import { createMaps, mapForMode } from "./public/maps.mjs";
import { ProfileStore } from "./profiles.mjs";
import { accountAPI } from "./accounts.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const map = JSON.parse(
  await readFile(path.join(root, "assets/map.json"), "utf8"),
);
const waterMap = JSON.parse(
  await readFile(path.join(root, "assets/water11.json"), "utf8"),
);
const maps = createMaps(map, waterMap);
const profiles = new ProfileStore(
  process.env.PROFILE_FILE ||
    path.join(root, "..", ".runtime", "profiles.sqlite"),
);
const rooms = new Map();
const cooperative = (map) =>
  ["water11", ...EXPEDITION_MODES].includes(map.mode);
const lobbyChat = [];
const townChat = [];
const townNPCs = createTownNPCs(NPC_DESIGNS);
function publishTown() {
  const members = [...wss.clients].filter((c) => c.town);
  if (!members.length) return;
  broadcast(
    members,
    JSON.stringify({
      type: "town-state",
      npcs: townNPCs,
      players: members.map((c) => ({
        id: c.pid,
        ...c.town,
        motion: c.town.input,
        input: undefined,
      })),
    }),
  );
}

// 环境变量优先；无法注入 env 的托管面板可使用 .runtime/config.json。
let fileConfig = {};
try {
  fileConfig = JSON.parse(
    readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        ".runtime/config.json",
      ),
      "utf8",
    ).replace(/^\uFEFF/, ""),
  );
} catch {}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".png": "image/png",
  ".json": "application/json",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};
const port = Number(process.env.PORT || fileConfig.port || 8787);
const publicOrigin = String(
  process.env.PUBLIC_ORIGIN ?? fileConfig.publicOrigin ?? "",
).replace(/\/$/, "");
const multiplayerEnabled = process.env.MULTIPLAYER_ENABLED === "true";
const closedMessage = "暂未开放，敬请等待";
const addresses = Object.entries(os.networkInterfaces())
  .flatMap(([name, entries]) => entries.map((x) => ({ ...x, name })))
  .filter(
    (x) =>
      x.family === "IPv4" &&
      !x.internal &&
      /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address),
  )
  .sort(
    (a, b) =>
      Number(/virtual|vethernet|docker|wsl/i.test(a.name)) -
      Number(/virtual|vethernet|docker|wsl/i.test(b.name)),
  )
  .map((x) => `http://${x.address}:${port}`);
const accounts = accountAPI(profiles, publicOrigin, id => {
  if (id) for(const client of wss.clients) if(client.profileId===id) client.close(4001,'Account changed');
});
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (await accounts(req,res,url)) return;
    if (url.pathname === "/api/profile") {
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end();
        return;
      }
      try {
        let id = profiles.identify(req.headers.cookie);
        const headers = {
          "content-type": "application/json",
          "cache-control": "no-store",
        };
        if (!id) {
          id = profiles.create();
          headers["set-cookie"] =
            [`qqt_profile=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${publicOrigin.startsWith('https:') ? '; Secure' : ''}`, 'qqt_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'];
        }
        res.writeHead(200, headers);
        res.end(JSON.stringify(profiles.view(id)));
      } catch {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(
          JSON.stringify({ error: "档案暂时无法保存，请检查磁盘后重试" }),
        );
      }
      return;
    }
    if (url.pathname === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, version: "0.6.0" }));
      return;
    }
    if (url.pathname === "/api/rooms") {
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(lobbyPacket()));
      return;
    }
    if (url.pathname === "/api/info") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          game: "sugar-bubble-arena",
          multiplayerEnabled,
          addresses: publicOrigin ? [publicOrigin] : addresses,
          port,
          version: "0.6.0",
          map: map.name,
        }),
      );
      return;
    }
    const relative = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
    const filename = path.resolve(root, "." + relative);
    if (!filename.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const info = await stat(filename);
    if (!info.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
    const headers = {
      "content-type":
        mime[path.extname(filename)] || "application/octet-stream",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      etag,
    };
    // 保留更新检查，命中浏览器缓存时省去文件读取和响应正文。
    const matches = req.headers["if-none-match"]
      ?.split(",")
      .some(
        (tag) =>
          tag.trim() === "*" ||
          tag.trim().replace(/^W\//, "") === etag.slice(2),
      );
    if ((req.method === "GET" || req.method === "HEAD") && matches) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    if (req.method === "HEAD") {
      res.writeHead(200, { ...headers, "content-length": info.size });
      res.end();
      return;
    }
    const data = await readFile(filename);
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
const wss = new WebSocketServer({
  server,
  maxPayload: 4096,
  verifyClient: ({ origin }) => !publicOrigin || origin === publicOrigin || origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`,
});
const send = (ws, data) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
};
const msgError = (error) =>
  error instanceof SyntaxError
    ? "消息格式错误"
    : error.code
      ? "操作未保存，请稍后重试"
      : error.message;
function broadcast(clients, encoded) {
  for (const ws of clients)
    if (ws.readyState === WebSocket.OPEN) ws.send(encoded);
}
function lobbyPacket() {
  return {
    type: "lobby",
    online: multiplayerEnabled ? [...wss.clients].filter((c) => c.readyState === WebSocket.OPEN)
      .length : 0,
    rooms: [...rooms.values()]
      .filter((r) => multiplayerEnabled && !r.match.practice && !r.bot)
      .map((r) => ({
        code: r.code,
        host: r.match.players.find((p) => p.id === r.host)?.name || "糖友",
        map: r.match.map.name,
        mode: r.match.map.mode,
        count: r.match.players.length,
        max: cooperative(r.match.map) ? 5 : RULES.maxPlayers,
        red: r.match.players.filter((p) => p.team === 0).length,
        blue: r.match.players.filter((p) => p.team === 1).length,
        status: r.match.state,
        joinable:
          r.match.state === "lobby" &&
          r.match.players.length <
            (cooperative(r.match.map) ? 5 : RULES.maxPlayers),
      })),
  };
}
let lastDirectory = "";
function publishLobby(force = false) {
  const packet = lobbyPacket(),
    signature = JSON.stringify(packet);
  if (!force && signature === lastDirectory) return;
  lastDirectory = signature;
  broadcast(wss.clients, signature);
}
function publish(room, forceBlocks = false) {
  const packet = {
    type: "state",
    room: room.code,
    host: room.host,
    aiLevel: room.bot?.level,
    ...room.match.snapshot(),
  };
  // 中途加入的客户端本地没有地图，必须补发一次完整 blocks
  if (forceBlocks && !packet.blocks) packet.blocks = room.match.blocks;
  // 困泡时长整局只在下发一次，中途加入的人也要补上
  if (forceBlocks && packet.trapDuration === undefined)
    packet.trapDuration = room.match.trapDuration;
  broadcast(room.clients.values(), JSON.stringify(packet));
}
function startRoom(room) {
  settleRoom(room);
  for (const ws of room.clients.values()) {
    room.match.setLoadout(ws.pid, profiles.view(ws.profileId));
    send(ws, { type: "round-start" });
  }
  room.match.start();
  room.rewarded = new Set();
  room.rewardRetryAt = 0;
}
function settleRoom(room) {
  if (room.match.state !== "finished" || Date.now() < (room.rewardRetryAt || 0))
    return;
  room.rewarded ??= new Set();
  for (const ws of room.clients.values()) {
    if (room.rewarded.has(ws.pid)) continue;
    const player = room.match.players.find((p) => p.id === ws.pid);
    if (!player) continue;
    try {
      const result = profiles.reward(
        ws.profileId,
        `${room.sessionId}:${room.match.roundId}`,
        room.match,
        player,
        room.bot?.level,
      );
      room.rewarded.add(ws.pid);
      send(ws, { type: "round-reward", ...(result || { reward: null }) });
    } catch {
      room.rewardRetryAt = Date.now() + 5000;
      send(ws, {
        type: "error",
        message: "奖励暂未写入存档，将自动重试，请暂勿退出",
      });
    }
  }
}
function leave(ws) {
  const room = ws.room;
  if (!room) return;
  settleRoom(room);
  room.clients.delete(ws.pid);
  room.match.removePlayer(ws.pid);
  ws.room = null;
  if (!room.clients.size) rooms.delete(room.code);
  else {
    if (room.host === ws.pid) room.host = room.clients.keys().next().value;
    publish(room);
  }
  publishLobby();
}
wss.on("connection", (ws, req) => {
  ws.profileId = profiles.identify(req.headers.cookie);
  ws.authCookie = req.headers.cookie;
  // One active connection per saved character prevents simultaneous matches
  // from different devices using the same loadout and reward identity.
  if (ws.profileId) for(const other of wss.clients) {
    if(other!==ws && other.profileId===ws.profileId) other.close(4001,'Signed in elsewhere');
  }
  ws.pid = randomBytes(6).toString("hex");
  ws.window = Date.now();
  ws.messages = 0;
  ws.alive = true;
  ws.on("pong", () => (ws.alive = true));
  send(ws, { type: "hello", id: ws.pid });
  if (ws.profileId)
    send(ws, { type: "profile", profile: profiles.view(ws.profileId) });
  send(ws, { type: "chat-history", scope: "lobby", messages: lobbyChat });
  publishLobby(true);
  ws.on("message", (raw) => {
    if (Date.now() - ws.window > 1000) {
      ws.window = Date.now();
      ws.messages = 0;
    }
    if (++ws.messages > 180) {
      ws.close(1008, "Too many messages");
      return;
    }
    try {
      const msg = JSON.parse(raw.toString());
      if (!multiplayerEnabled && (msg.type === "join" || msg.type === "chat" || String(msg.type).startsWith("town-") ||
          (msg.type === "create" && msg.practice !== true && !Object.hasOwn(BOT_LEVELS,msg.aiLevel ?? '') && !(msg.solo === true && ['boss','bio','survivor','water11'].includes(msg.mode))))) {
        send(ws,{type:"error",message:closedMessage});return;
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "ping") {
        send(ws, { type: "pong", sent: msg.sent });
        return;
      }
      if (msg.type === "profile-change") {
        if (ws.room) {
          send(ws, {
            type: "error",
            message: "请先退出房间，再调整养成和技能",
          });
          return;
        }
        const profile = profiles.change(ws.profileId, msg.action || {});
        for (const client of wss.clients)
          if (client.profileId === ws.profileId)
            send(client, { type: "profile", profile });
        return;
      }
      if (msg.type === "town-enter") {
        if (ws.room) return;
        ws.town = {
          ...TOWN.spawn,
          name:
            String(msg.name || "糖友")
              .trim()
              .slice(0, 12) || "糖友",
          appearance: profiles.view(ws.profileId).appearance,
          dir: 3,
          input: { x: 0, y: 0 },
        };
        send(ws, { type: "town-history", messages: townChat });
        publishTown();
        return;
      }
      if (msg.type === "town-leave") {
        delete ws.town;
        publishTown();
        return;
      }
      if (msg.type === "town-target") {
        if(ws.town && Number.isFinite(msg.x) && Number.isFinite(msg.y)){
          ws.lastTownTarget=Date.now();
          const route=townPath(ws.town,{x:msg.x,y:msg.y});
          ws.town.path=route||[];ws.town.input={x:0,y:0};ws.town.command=msg.command;
          send(ws,{type:'town-target-result',command:msg.command,accepted:!!route});publishTown();
        }
        return;
      }
      if (msg.type === "town-move") {
        if (
          ws.town &&
          [-1, 0, 1].includes(msg.x) &&
          [-1, 0, 1].includes(msg.y)
        ) {
          ws.town.path = [];
          ws.town.command = msg.command;
          ws.town.input = { x: msg.x, y: msg.y };
          ws.town.inputAt = Date.now();
        }
        return;
      }
      if (msg.type === "town-talk") {
        if(ws.town && talkTownNPC(townNPCs,ws.town,msg.npcId,Date.now()))publishTown();
        return;
      }
      if (msg.type === "town-emote") {
        if (ws.town && Date.now() - (ws.lastWave || 0) > 1500) {
          ws.lastWave = Date.now();
          const near=townNPCs.find(n=>Math.hypot(n.x-ws.town.x,n.y-ws.town.y)<105);
          if(near)talkTownNPC(townNPCs,ws.town,near.id,Date.now());
          ws.town.bubble = "你好！";
          ws.town.bubbleUntil = Date.now() + 3000;
          publishTown();
        }
        return;
      }
      if (msg.type === "lobby") {
        send(ws, lobbyPacket());
        return;
      }
      if (msg.type === "chat") {
        if (typeof msg.text !== "string") return;
        const message = Array.from(
          msg.text.replace(/[\u0000-\u001f\u007f]/g, " ").trim(),
        )
          .slice(0, 140)
          .join("");
        if (!message) return;
        if (Date.now() - (ws.lastChat || 0) < 600) {
          send(ws, { type: "error", message: "发言太快，请稍候" });
          return;
        }
        ws.lastChat = Date.now();
        const room = ws.room,
          p = room?.match.players.find((p) => p.id === ws.pid);
        const packet = {
          type: "chat",
          id: randomBytes(6).toString("hex"),
          scope: room ? "room" : ws.town ? "town" : "lobby",
          player: ws.pid,
          name:
            p?.name ||
            ws.town?.name ||
            String(msg.name || "糖友")
              .trim()
              .slice(0, 12),
          text: message,
          time: Date.now(),
        };
        const history = room
          ? (room.chat ??= [])
          : ws.town
            ? townChat
            : lobbyChat;
        history.push(packet);
        if (history.length > 30) history.shift();
        for (const client of room ? room.clients.values() : wss.clients)
          if (room || (ws.town ? !!client.town : !client.room && !client.town))
            send(client, packet);
        if (ws.town) {
          ws.town.bubble = message;
          ws.town.bubbleUntil = Date.now() + 5000;
        }
        return;
      }
      if (msg.type === "leave") {
        leave(ws);
        send(ws, { type: "left" });
        send(ws, { type: "chat-history", scope: "lobby", messages: lobbyChat });
        return;
      }
      if (msg.type === "create" || msg.type === "join") {
        let room;
        if (msg.type === "create") {
          const selected = mapForMode(
            maps.get(msg.mapId) || map,
            msg.mode ?? "classic",
          );
          if (
            msg.aiLevel !== undefined &&
            (!Object.hasOwn(BOT_LEVELS, msg.aiLevel) ||
              msg.practice === true ||
              cooperative(selected))
          ) {
            send(ws, {
              type: "error",
              message: "人机对战支持抢包地图，请选择有效难度",
            });
            return;
          }
          if (msg.mapId !== undefined && !maps.has(msg.mapId)) {
            send(ws, { type: "error", message: "没有找到这张地图" });
            return;
          }
          if (rooms.size >= 50) {
            send(ws, { type: "error", message: "房间已满，请稍后再试" });
            return;
          }
          let code;
          do {
            code = String(100000 + (randomBytes(4).readUInt32LE() % 900000));
          } while (rooms.has(code));
          const bioOptions =
            selected.mode === "bio" ? validateBioOptions(msg.bioOptions) : {};
          const Engine =
            selected.mode === "bio"
              ? BioMatch
              : selected.mode === "survivor"
                ? SurvivorMatch
                : EXPEDITION_MODES.includes(selected.mode)
                  ? ExpeditionMatch
                  : selected.mode === "water11"
                    ? WaterMatch
                    : Match;
          room = {
            code,
            sessionId: randomBytes(12).toString("hex"),
            match: new Engine(
              selected,
              msg.practice === true,
              randomBytes(4).readUInt32LE(),
              bioOptions,
            ),
            clients: new Map(),
            host: ws.pid,
          };
        } else {
          room = rooms.get(String(msg.code || "").replace(/\s/g, ""));
          if (!room) {
            send(ws, {
              type: "error",
              message: "没有找到这个房间，请核对房间号",
            });
            return;
          }
          if (room.bot) {
            send(ws, {
              type: "error",
              message: "人机对战仅供单人挑战，请创建联机房间",
            });
            return;
          }
          if (room.match.practice) {
            send(ws, {
              type: "error",
              message: "练习场仅供单人使用，请创建联机房间",
            });
            return;
          }
          if (room.match.state !== "lobby") {
            send(ws, {
              type: "error",
              message: "该房间正在对局，请等房主返回房间",
            });
            return;
          }
          if (room.clients.size >= RULES.maxPlayers) {
            send(ws, { type: "error", message: "房间已有 8 人" });
            return;
          }
        }
        if (cooperative(room.match.map) && room.match.players.length >= 5) {
          send(ws, { type: "error", message: "合作模式最多支持 5 人" });
          return;
        }
        delete ws.town;
        publishTown();
        leave(ws);
        rooms.set(room.code, room);
        ws.room = room;
        room.clients.set(ws.pid, ws);
        const red = room.match.players.filter((p) => p.team === 0).length;
        const blue = room.match.players.filter((p) => p.team === 1).length;
        const joinedPlayer = room.match.addPlayer(
          ws.pid,
          String(msg.name || "糖友")
            .trim()
            .slice(0, 12) || "糖友",
          cooperative(room.match.map) ? 0 : red <= blue ? 0 : 1,
        );
        joinedPlayer.skin = msg.skin === "fire" ? "fire" : "classic";
        room.match.setLoadout(ws.pid, profiles.view(ws.profileId));
        if (msg.type === "create" && msg.aiLevel)
          room.bot = addBot(room.match, msg.aiLevel);
        send(ws, {
          type: "joined",
          room: room.code,
          id: ws.pid,
          practice: room.match.practice,
        });
        send(ws, {
          type: "chat-history",
          scope: "room",
          messages: room.chat || [],
        });
        if (
          room.match.practice ||
          room.bot ||
          (msg.type === "create" &&
            msg.solo === true &&
            cooperative(room.match.map))
        )
          startRoom(room);
        publish(room, true);
        publishLobby();
        return;
      }
      const room = ws.room;
      if (!room) return;
      const p = room.match.players.find((p) => p.id === ws.pid);
      if (!p) return;
      if (msg.type === "survivor-pick" || msg.type === "survivor-reroll") {
        const ok =
          msg.type === "survivor-pick"
            ? room.match.choose?.(ws.pid, msg.key, msg.offerId)
            : room.match.reroll?.(ws.pid, msg.offerId);
        if (!ok)
          send(ws, {
            type: "error",
            message: "强化选择已更新，请选择当前选项",
          });
        publish(room);
        return;
      }
      if (room.match.paused?.()) return;
      if (msg.type === "bio-antidote") {
        room.match.useAntidote?.(ws.pid);
        publish(room);
        return;
      }
      if (msg.type === "cycle-bomb") {
        room.match.cycleBomb?.(ws.pid);
        publish(room);
        return;
      }
      if (msg.type === "detonate") {
        room.match.detonate?.(ws.pid);
        publish(room);
        return;
      }
      if (msg.type === "character-skill") {
        if(room.match.useCharacterSkill(ws.pid))publish(room);
        else send(ws,{type:"error",message:"角色技能冷却中，或当前状态无法使用"});
        return;
      }
      if (msg.type === "skill") {
        if (room.match.useSkill(ws.pid)) publish(room);
        else
          send(ws, {
            type: "error",
            message: "技能冷却中，或当前状态无法使用",
          });
        return;
      }
      if (msg.type === "use-fork") {
        if (room.match.useFork(ws.pid)) publish(room);
        return;
      }
      if (msg.type === "place-banana") {
        if (room.match.placeBanana(ws.pid)) publish(room);
        return;
      }
      if (msg.type === "place-smile") {
        if (room.match.placeTrap(ws.pid, "smile")) publish(room);
        return;
      }
      if (msg.type === "emote") {
        if (
          room.match.state === "playing" &&
          p.status === "alive" &&
          typeof msg.key === "string" &&
          /^[tyuiop]$/.test(msg.key) &&
          (!p.emoteUntil || p.emoteUntil - room.match.time < 2)
        ) {
          p.emote = msg.key;
          p.emoteUntil = room.match.time + 3;
          publish(room);
        }
        return;
      }
      if (msg.type === "training-mod" || msg.type === "training-win") {
        if (
          !room.match.practice ||
          room.clients.size !== 1 ||
          room.host !== ws.pid
        ) {
          send(ws, {
            type: "error",
            message: "训练修改功能只允许在单人训练中使用",
          });
          return;
        }
        const ok =
          msg.type === "training-win"
            ? room.match.beginTrainingWin(ws.pid)
            : room.match.setTrainingMod(ws.pid, msg.key, msg.enabled);
        if (!ok) send(ws, { type: "error", message: "无效的训练选项" });
        else publish(room);
        return;
      }
      if (msg.type === "appearance")
        p.skin = msg.skin === "fire" ? "fire" : "classic";
      if (msg.type === "input") {
        room.match.setInput(ws.pid, msg);
        return;
      }
      if (msg.type === "ready" && room.match.state === "lobby")
        p.ready = !p.ready;
      if (msg.type === "team" && room.match.state === "lobby") {
        if (room.bot) return;
        if (cooperative(room.match.map)) return;
        const target = 1 - p.team;
        if (room.match.players.filter((p) => p.team === target).length >= 4) {
          send(ws, { type: "error", message: "这支队伍已满" });
          return;
        }
        p.team = target;
        p.ready = false;
        room.match.spawn(p);
      }
      if (
        msg.type === "start" &&
        room.host === ws.pid &&
        room.match.state === "lobby"
      ) {
        const red = room.match.players.filter((p) => p.team === 0).length,
          blue = room.match.players.length - red;
        if (!cooperative(room.match.map) && (!red || red !== blue)) {
          send(ws, {
            type: "error",
            message: "需要红蓝双方人数相等（至少 1 对 1）",
          });
          return;
        }
        if (room.match.players.some((p) => p.id !== room.host && !p.ready)) {
          send(ws, { type: "error", message: "请等待其他玩家准备" });
          return;
        }
        startRoom(room);
      }
      if (
        msg.type === "drill" &&
        room.match.practice &&
        ["map", "phase", "run", "wall", "wall3", "pillar", "house"].includes(
          msg.mode,
        )
      )
        room.match.setupDrill(ws.pid, msg.mode);
      if (
        msg.type === "return" &&
        room.host === ws.pid &&
        room.match.state === "finished"
      ) {
        settleRoom(room);
        if (room.bot) {
          startRoom(room);
          publish(room, true);
          return;
        }
        room.match.state = "lobby";
        for (const p of room.match.players) {
          p.ready = false;
          room.match.spawn(p);
        }
      }
      publish(room);
      publishLobby();
    } catch (error) {
      send(ws, { type: "error", message: msgError(error) });
    }
  });
  ws.on("close", () => {
    delete ws.town;
    publishTown();
    leave(ws);
    publishLobby(true);
  });
  ws.on("error", () => {});
});
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    if(ws.profileId && profiles.identify(ws.authCookie)!==ws.profileId){ws.close(4001,'Session expired');continue;}
    ws.ping();
  }
}, 30000);
let previous = performance.now(),
  accumulator = 0,
  broadcasts = 0;
const timer = setInterval(() => {
  const now = performance.now();
  accumulator += Math.min(0.25, (now - previous) / 1000);
  previous = now;
  while (accumulator >= RULES.tick) {
    for (const room of rooms.values()) {
      if (room.bot) tickBot(room.match, room.bot);
      room.match.tick();
      settleRoom(room);
    }
    for (const client of wss.clients)
      if (client.town) {
        if (Date.now() - (client.town.inputAt || 0) > 600)
          client.town.input = { x: 0, y: 0 };
        stepTown(client.town, RULES.tick);
      }
    if ([...wss.clients].some(c=>c.town)) for(const npc of townNPCs) tickTownNPC(npc,RULES.tick,Date.now());
    if (broadcasts % 3 === 0) publishTown();
    accumulator -= RULES.tick;
    broadcasts++;
    if (broadcasts % 2 === 0) for (const room of rooms.values()) publish(room);
    if (broadcasts % 120 === 0) publishLobby();
  }
}, 8);
const backupTimer = setInterval(() => {
  try { profiles.backup(); } catch(error) { console.error('Database backup failed:', error.message); }
},6*60*60*1000);
backupTimer.unref();
server.listen(port, process.env.HOST || "0.0.0.0", async () => {
  if(!process.env.PROFILE_FILE)try{profiles.backup();}catch(error){console.error('Database backup failed:',error.message);}
  if (port === 8787) {
    const runtime = path.join(root, "..", ".runtime");
    await mkdir(runtime, { recursive: true });
    await writeFile(path.join(runtime, "server.pid"), String(process.pid));
  }
  console.log(
    `糖泡对战\nLocal: http://localhost:${port}\n${addresses.map((a) => `LAN: ${a}`).join("\n")}`,
  );
});
server.on("error", (err) => {
  console.error(err.message);
  clearInterval(timer);
  process.exit(1);
});
process.on("SIGTERM", () => {
  clearInterval(timer);
  clearInterval(heartbeat);
  clearInterval(backupTimer);
  for (const ws of wss.clients) ws.close();
  wss.close();
  server.close();
});
