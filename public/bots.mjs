// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { NPC_DESIGNS } from "./appearance.mjs";
import { DIR, RULES, cell } from "./engine.mjs";

export const BOT_LEVELS = Object.freeze({
  easy: {
    name: "简单",
    reaction: 0.65,
    bombDelay: 3.5,
    items: false,
    hunt: false,
  },
  normal: {
    name: "普通",
    reaction: 0.3,
    bombDelay: 2,
    items: true,
    hunt: false,
  },
  hard: {
    name: "困难",
    reaction: 0.12,
    bombDelay: 0.8,
    items: true,
    hunt: true,
  },
});
const breakable = (n) => n >= 8001 && n <= 8004;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function goalCosts(match, goal, carrying) {
  const costs = new Map([[cell(goal.x, goal.y), 0]]),
    queue = [goal];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i],
      cost = costs.get(cell(node.x, node.y));
    for (const [dx, dy] of Object.values(DIR)) {
      const x = node.x + dx,
        y = node.y + dy,
        block = match.blockAt(x, y),
        key = cell(x, y);
      if (
        match.houseCornerAt(x, y) ||
        (block && (carrying || !breakable(block)))
      )
        continue;
      const next = cost + (breakable(block) ? 5 : 1);
      if (next < (costs.get(key) ?? Infinity)) {
        costs.set(key, next);
        queue.push({ x, y });
      }
    }
  }
  return costs;
}

// 只读取场上可见的泡弹、砖块、玩家和道具；不读取隐藏道具或玩家输入。
export function blastCells(match, bomb) {
  const cells = [{ x: bomb.x, y: bomb.y }];
  const power = bomb.livePower
    ? (match.players.find((p) => p.id === bomb.owner)?.power ?? bomb.power) +
      (bomb.bonusPower || 0)
    : bomb.power;
  for (const [dx, dy] of Object.values(DIR))
    for (let i = 1; i <= power; i++) {
      const x = bomb.x + dx * i,
        y = bomb.y + dy * i,
        block = match.blockAt(x, y);
      if (
        block === -1 ||
        match.houseCornerAt(x, y) ||
        (block && !breakable(block))
      )
        break;
      cells.push({ x, y });
      if (block || match.bombAt(x, y)) break;
    }
  return cells;
}

function hazards(match, extra) {
  const bombs = extra ? [...match.bombs, extra] : match.bombs;
  const times = bombs.map((b) => b.explodeAt);
  const rays = bombs.map((b) => blastCells(match, b));
  // 连锁引爆会提前危险时刻。
  for (let pass = 0; pass < bombs.length; pass++)
    for (let i = 0; i < bombs.length; i++) {
      for (let j = 0; j < bombs.length; j++)
        if (
          times[j] > times[i] &&
          rays[i].some((c) => c.x === bombs[j].x && c.y === bombs[j].y)
        )
          times[j] = times[i];
    }
  const danger = new Map();
  rays.forEach((ray, i) =>
    ray.forEach((c) => {
      const key = cell(c.x, c.y);
      danger.set(
        key,
        Math.min(danger.get(key) ?? Infinity, times[i] - match.time),
      );
    }),
  );
  return danger;
}

function routes(match, p, danger, extra) {
  const start = { x: Math.floor(p.x), y: Math.floor(p.y), path: [] };
  const queue = [start],
    visited = new Set([cell(start.x, start.y)]);
  const speed = match.movementSpeed(p);
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dy] of Object.values(DIR)) {
      const node = queue[i],
        x = node.x + dx,
        y = node.y + dy,
        key = cell(x, y);
      if (
        visited.has(key) ||
        match.solid(x, y) ||
        match.bombAt(x, y) ||
        (extra?.x === x && extra?.y === y)
      )
        continue;
      // 留出半格身位的撤离余量，不穿过即将引爆的格子。
      if (
        (danger.get(key) ?? Infinity) <=
        (node.path.length + 2) / speed + 0.15
      )
        continue;
      visited.add(key);
      queue.push({ x, y, path: [...node.path, { x, y }] });
    }
  return queue;
}

export function addBot(match, level) {
  if (!Object.hasOwn(BOT_LEVELS, level))
    throw new Error("Unknown AI difficulty");
  const p = match.addPlayer("bot-1", `AI · ${BOT_LEVELS[level].name}`, 1);
  p.appearance = NPC_DESIGNS[level];
  p.name = NPC_DESIGNS[level].name;
  p.bot = true;
  p.ready = true;
  return { id: p.id, level, nextThink: 0, path: [], lastTime: -1 };
}

export function tickBot(match, bot) {
  const p = match.players.find((p) => p.id === bot.id);
  if (!p) return;
  if (match.time < bot.lastTime) {
    bot.nextThink = 0;
    bot.path = [];
  }
  bot.lastTime = match.time;
  if (match.state !== "playing" || p.status !== "alive") {
    bot.path = [];
    bot.nextThink = 0;
    if (
      match.state === "playing" &&
      p.status === "trapped" &&
      bot.level !== "easy"
    )
      match.useFork(p.id);
    return;
  }
  const config = BOT_LEVELS[bot.level];
  const atCenter =
    Math.abs((p.x % 1) - 0.5) < 0.001 && Math.abs((p.y % 1) - 0.5) < 0.001;
  if (match.time >= bot.nextThink && (atCenter || !bot.path.length)) {
    bot.nextThink = match.time + config.reaction;
    const danger = hazards(match),
      startKey = cell(Math.floor(p.x), Math.floor(p.y));
    const reachable = routes(match, p, danger);
    const safe = reachable.filter((n) => !danger.has(cell(n.x, n.y)));
    let target;
    if (danger.has(startKey)) {
      target = safe.find((n) => n.path.length);
    } else {
      const home = match.map.bases.find((b) => b.team === p.team);
      const homeOpen = goalCosts(
        match,
        { x: home.x + 1, y: home.y + 1 },
        true,
      ).has(startKey);
      // 携包不能放泡，出发抢包前先打通回家的通路。
      const base = match.map.bases.find(
        (b) => b.team === (p.carry === null && homeOpen ? 1 - p.team : p.team),
      );
      const goal = { x: base.x + 1, y: base.y + 1 };
      const costs = goalCosts(match, goal, p.carry !== null);
      const enemies = match.players.filter(
        (q) => q.team !== p.team && q.status !== "dead",
      );
      const score = (n) => {
        let value =
          -(costs.get(cell(n.x, n.y)) ?? 1000) * 2 - n.path.length * 0.3;
        if (p.carry === null) {
          if (
            config.items &&
            match.items.some(
              (i) =>
                i.x === n.x &&
                i.y === n.y &&
                i.availableAt <= match.time &&
                !i.kind.endsWith("-trap"),
            )
          )
            value += 6;
          if (
            config.hunt &&
            enemies.some(
              (e) =>
                e.status === "trapped" &&
                distance(n, { x: Math.floor(e.x), y: Math.floor(e.y) }) === 0,
            )
          )
            value += 30;
        }
        return value;
      };
      target = safe.sort((a, b) => score(b) - score(a))[0];
      const centered =
        Math.abs((p.x % 1) - 0.5) < 0.06 && Math.abs((p.y % 1) - 0.5) < 0.06;
      if (
        p.carry === null &&
        centered &&
        match.time - p.lastBomb >= config.bombDelay
      ) {
        const bomb = {
          x: Math.floor(p.x),
          y: Math.floor(p.y),
          power: p.power + (p.surgeUntil > match.time ? 2 : 0),
          explodeAt: match.time + RULES.fuse,
        };
        const ray = blastCells(match, bomb);
        const useful =
          ray.some((c) => breakable(match.blockAt(c.x, c.y))) ||
          enemies.some(
            (e) =>
              e.status === "alive" &&
              ray.some(
                (c) => c.x === Math.floor(e.x) && c.y === Math.floor(e.y),
              ),
          );
        if (useful) {
          const future = hazards(match, bomb);
          const escape = routes(match, p, future, bomb).find(
            (n) => n.path.length && !future.has(cell(n.x, n.y)),
          );
          if (escape && match.placeBomb(p)) target = escape;
        }
      }
    }
    // 不在格子中途转向：先走到当前格中心，再接续新路线。
    bot.path = [
      { x: Math.floor(p.x), y: Math.floor(p.y) },
      ...(target?.path ?? []),
    ];
  }
  let dir = null;
  while (bot.path.length) {
    const next = bot.path[0],
      dx = next.x + 0.5 - p.x,
      dy = next.y + 0.5 - p.y;
    const tolerance = 0.001;
    if (Math.abs(dx) <= tolerance && Math.abs(dy) <= tolerance) {
      bot.path.shift();
      continue;
    }
    dir =
      Math.abs(dx) > tolerance
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";
    break;
  }
  match.setInput(p.id, { seq: p.lastSequence + 1, dir });
}
