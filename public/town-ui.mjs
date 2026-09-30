import { bakeTown } from "./town-art.mjs";
import { TOWN, TOWN_BUILDINGS, moveTown } from "./town.mjs";
import { appearanceSheet } from "./appearance.mjs";
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
    near = null,
    connected = true;
  const scene = bakeTown(images, manifest);
  let lastFrame = 0,
    receivedAt = 0;
  const poses = new Map();
  const vector = () => ({
    x:
      Number(held.has("d") || held.has("ArrowRight")) -
      Number(held.has("a") || held.has("ArrowLeft")),
    y:
      Number(held.has("s") || held.has("ArrowDown")) -
      Number(held.has("w") || held.has("ArrowUp")),
  });
  const transmit = () => {
    if (active && connected) send({ type: "town-move", ...vector() });
  };
  const stop = () => {
    held.clear();
    target = null;
    if (active && connected) send({ type: "town-move", x: 0, y: 0 });
  };
  $("town-open").onclick = () => openLobbyPage("town-dialog");
  $("close-town").onclick = () => closeLobbyPage();
  window.addEventListener("lobby-page-change", (e) => {
    const next = e.detail === "town-dialog";
    if (next && !active) {
      active = true;
      send({ type: "town-enter", name: nickname() });
      canvas.focus();
    } else if (active && !next) {
      stop();
      send({ type: "town-leave" });
      active = false;
      players = [];
    }
  });
  function interact() {
    if (!near) return;
    if (near.page) openLobbyPage(near.page);
    else {
      send({ type: "town-emote" });
      $("town-hint").textContent =
        "茶馆：欢迎休憩。可通过公共频道与附近玩家交流。";
    }
  }
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
      if (!held.has(e.key)) {
        held.add(e.key);
        transmit();
      }
    }
    if (e.key.toLowerCase() === "e") interact();
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
      x: ((e.clientX - r.left) / r.width) * canvas.width + camera.x,
      y: ((e.clientY - r.top) / r.height) * canvas.height + camera.y,
    };
    canvas.focus();
  });
  $("town-chat-form").onsubmit = (e) => {
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
      b.textContent = m.name + "：";
      p.append(b, document.createTextNode(m.text));
      log.append(p);
    }
    log.scrollTop = log.scrollHeight;
  }
  setInterval(() => {
    if (!active || !connected) return;
    const me = players.find((p) => p.id === id);
    let v = vector();
    if (target && me) {
      const dx = target.x - me.x,
        dy = target.y - me.y;
      v = {
        x: Math.abs(dx) > 8 ? Math.sign(dx) : 0,
        y: Math.abs(dy) > 8 ? Math.sign(dy) : 0,
      };
      if (!v.x && !v.y) target = null;
    }
    send({ type: "town-move", ...v });
  }, 100);
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
    const mobile = innerWidth <= 800,
      w = mobile ? 480 : 960,
      h = mobile ? 440 : 580;
    if (canvas.width !== w) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.aspectRatio = `${w}/${h}`;
    }
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const visible = players.map((p) => {
      const estimate = { ...p, input: p.motion };
      moveTown(estimate, Math.min(0.1, (now - receivedAt) / 1000));
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
      label(
        p.name + (p.id === id ? " · 我" : ""),
        p.x,
        p.y - 77,
        "#123c59",
        12,
      );
      if (p.bubble && p.bubbleUntil > Date.now()) {
        const text = Array.from(p.bubble).slice(0, 22).join("");
        const w = Math.min(290, text.length * 12 + 20);
        rect(p.x - w / 2, p.y - 115, w, 27, "#f4fcffe6");
        label(text, p.x, p.y - 96, "#164968", 12);
      }
    }
    c.restore();
    near = me
      ? TOWN_BUILDINGS.find(
          (b) => Math.hypot(me.x - b.x - b.w / 2, me.y - b.y - b.h - 18) < 95,
        )
      : null;
    const button = $("town-interact"),
      title = near ? `E ${near.name}` : "E 设施交互";
    if (button.disabled !== !near) button.disabled = !near;
    if (button.textContent !== title) button.textContent = title;
    const count = connected ? `· ${players.length} 人在线` : "· 连接已断开";
    if ($("town-count").textContent !== count)
      $("town-count").textContent = count;
  }
  requestAnimationFrame(draw);
  return {
    message(m) {
      if (m.type === "hello") id = m.id;
      if (m.type === "town-state") {
        players = m.players;
        receivedAt = performance.now();
        for (const key of poses.keys())
          if (!players.some((p) => p.id === key)) poses.delete(key);
      }
      if (m.type === "town-history") {
        messages = m.messages;
        chat();
      }
      if (m.type === "chat" && m.scope === "town") {
        messages.push(m);
        messages = messages.slice(-30);
        chat();
      }
    },
    disconnected() {
      connected = false;
      players = [];
      stop();
    },
    reconnect() {
      connected = true;
      if (active && connected) send({ type: "town-enter", name: nickname() });
    },
  };
}
