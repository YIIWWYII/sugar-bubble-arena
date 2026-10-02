import { bubbleHit } from "./bubble-combat.mjs";
import { ExpeditionMatch } from "./expedition.mjs";
import { Match, RULES, DIR } from "./engine.mjs";

export const SURVIVOR_UPGRADES = {
  force: {
    name: "高压糖芯",
    family: "爆破",
    description: "自动糖泡伤害 +1，手动糖泡伤害同步增加。",
    max: 5,
    icon: "ui-force",
  },
  cadence: {
    name: "快速装填",
    family: "爆破",
    description: "自动攻击间隔缩短 14%。",
    max: 5,
    icon: "ui-cadence",
  },
  reach: {
    name: "远程引信",
    family: "爆破",
    description: "自动糖泡射程增加 1 格。",
    max: 4,
    icon: "ui-reach",
  },
  burst: {
    name: "碎糖冲击",
    family: "爆破",
    description: "命中产生小范围溅射，每级扩大范围。",
    max: 3,
    icon: "ui-burst",
  },
  frost: {
    name: "冰霜糖衣",
    family: "寒霜",
    description: "自动攻击冻结敌人，每级延长 0.4 秒。",
    max: 3,
    icon: "ui-frost",
  },
  chain: {
    name: "连锁糖泡",
    family: "雷电",
    description: "命中后弹向附近额外 1 名敌人，每级增加目标。",
    max: 3,
    icon: "ui-chain",
  },
  supplies: {
    name: "道具补给",
    family: "生存",
    description: "获得 1 把叉子、2 个香蕉皮和 2 个笑脸。",
    max: 100000,
    icon: "ui-supplies",
  },
  health: {
    name: "坚韧体魄",
    family: "生存",
    description: "生命上限 +1，并立即恢复 1 点生命。",
    max: 5,
    icon: "ui-health",
  },
  speed: {
    name: "轻盈跑鞋",
    family: "生存",
    description: "移动速度 +0.3。",
    max: 4,
    icon: "ui-speed",
  },
  magnet: {
    name: "经验磁场",
    family: "成长",
    description: "经验拾取半径增加 0.75 格。",
    max: 3,
    icon: "ui-experience",
  },
  learning: {
    name: "战术研习",
    family: "成长",
    description: "全队拾取经验时，自身额外获得 20% 经验。",
    max: 3,
    icon: "ui-learning",
  },
  regen: {
    name: "再生糖浆",
    family: "生存",
    description: "每 20 秒恢复 1 点生命，每级缩短恢复间隔。",
    max: 3,
    icon: "ui-regen",
  },
  thorns: {
    name: "反击装甲",
    family: "生存",
    description: "受到接触伤害时，对攻击者造成每级 2 点反伤。",
    max: 3,
    icon: "ui-thorns",
  },
  glacier: {
    name: "极寒碎裂",
    family: "进化",
    description: "冰霜命中扩散至周围 1.8 格，碎糖冲击一并触发。",
    max: 1,
    requires: { frost: 2, force: 2 },
    icon: "ui-glacier",
  },
  storm: {
    name: "雷霆回路",
    family: "进化",
    description: "电弧额外传导 3 次，传导伤害提高至 100%。",
    max: 1,
    requires: { chain: 2, cadence: 2 },
    icon: "ui-storm",
  },
  sustain: {
    name: "应急补给",
    family: "补给",
    description: "立即恢复 2 点生命。",
    max: 100000,
    icon: "ui-sustain",
  },
  overpower: {
    name: "持续增压",
    family: "补给",
    description: "本局自动攻击伤害 +0.2。",
    max: 100000,
    icon: "ui-overpower",
  },
  reservoir: {
    name: "储备糖芯",
    family: "补给",
    description: "生命上限 +1（最高 20），恢复 1 点生命。",
    max: 100000,
    icon: "ui-reservoir",
  },
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class SurvivorMatch extends ExpeditionMatch {
  start() {
    super.start();
    this.remaining = 1e9;
    this.elapsed = 0;
    this.nextSpawn = 0;
    this.nextElite = 30;
    this.gems = [];
    this.shots = [];
    this.wave = 1;
    this.flows = new Map();
    for (const p of this.players) {
      p.run = {
        level: 1,
        xp: 0,
        nextXp: 6,
        hp: 5,
        maxHp: 5,
        ranks: {},
        offers: ["force", "frost", "chain"],
        offerId: ++this.serial,
        rerolls: 2,
        nextShot: 0,
        nextHeal: 20,
      };
    }
  }
  paused() {
    return (
      this.state === "playing" &&
      this.players.some((p) => p.status !== "dead" && p.run?.offers.length)
    );
  }
  roll(p, excluded = []) {
    let pool = Object.keys(SURVIVOR_UPGRADES).filter((key) => {
      const u = SURVIVOR_UPGRADES[key];
      return (
        !excluded.includes(key) &&
        (p.run.ranks[key] || 0) < u.max &&
        Object.entries(u.requires || {}).every(
          ([k, n]) => (p.run.ranks[k] || 0) >= n,
        )
      );
    });
    const main = pool.filter((k) => SURVIVOR_UPGRADES[k].family !== "补给");
    if (main.length >= 3) pool = main;
    const offers = [],
      evolution = pool.find((k) => SURVIVOR_UPGRADES[k].requires);
    if (evolution) {
      offers.push(evolution);
      pool = pool.filter((k) => k !== evolution);
    }
    while (offers.length < 3 && pool.length) {
      const weights = pool.map((k) => (p.run.ranks[k] ? 2 : 1)),
        sum = weights.reduce((a, b) => a + b, 0);
      let pick = this.random() * sum,
        index = 0;
      while (index < weights.length - 1 && pick >= weights[index])
        pick -= weights[index++];
      offers.push(pool.splice(index, 1)[0]);
    }
    p.run.offers = offers;
    p.run.offerId = ++this.serial;
  }
  levelUp(p) {
    const r = p.run;
    if (!r.offers.length && r.xp >= r.nextXp) {
      r.xp -= r.nextXp;
      r.level++;
      r.nextXp = 4 + r.level * 2;
      this.roll(p);
    }
  }
  choose(id, key, offerId) {
    const p = this.players.find((p) => p.id === id),
      r = p?.run;
    if (
      this.state !== "playing" ||
      p?.status === "dead" ||
      !r ||
      r.offerId !== offerId ||
      !r.offers.includes(key)
    )
      return false;
    const u = SURVIVOR_UPGRADES[key];
    if (!u || (r.ranks[key] || 0) >= u.max) return false;
    r.ranks[key] = (r.ranks[key] || 0) + 1;
    r.offers = [];
    if (key === "health" || key === "reservoir") {
      r.maxHp = Math.min(20, r.maxHp + 1);
      r.hp = Math.min(r.maxHp, r.hp + 1);
    }
    if (key === "supplies") {
      p.forks++;
      p.bananas += 2;
      p.smiles += 2;
    }
    if (key === "sustain") r.hp = Math.min(r.maxHp, r.hp + 2);
    if (key === "speed") p.speed = Math.min(8, p.speed + 0.3);
    this.levelUp(p);
    return true;
  }
  reroll(id, offerId) {
    const p = this.players.find((p) => p.id === id),
      r = p?.run;
    if (
      this.state !== "playing" ||
      p?.status === "dead" ||
      !r?.offers.length ||
      r.rerolls <= 0 ||
      r.offerId !== offerId
    )
      return false;
    r.rerolls--;
    this.roll(p, r.offers);
    return true;
  }
  clearShot(a, b) {
    const steps = Math.ceil(distance(a, b) * 4);
    for (let i = 1; i <= steps; i++) {
      const x = Math.floor(a.x + ((b.x - a.x) * i) / steps),
        y = Math.floor(a.y + ((b.y - a.y) * i) / steps);
      if (this.solid(x, y)) return false;
    }
    return true;
  }
  hit(e, amount, p) {
    if (e.hp <= 0) return;
    bubbleHit(e, this.time, amount, 1.2);
    if (!e.hp) {
      this.combatNotice(p.id, e.id);
      this.enemySupply(e);
      p.kills++;
      this.gems.push({
        id: ++this.serial,
        x: e.x,
        y: e.y,
        value: e.kind === "boss" ? 8 : 1,
      });
      if (this.gems.length > 250) {
        const a = this.gems.shift();
        this.gems[0].value += a.value;
      }
    }
  }
  hurt(p, owner) {
    if (p.status !== "alive" || p.shieldUntil >= this.time) return;
    p.run.hp = Math.max(0, p.run.hp - 1);
    p.shieldUntil = this.time + 1;
    const enemy = this.enemies.find((e) => e.id === owner);
    if (enemy && p.run.ranks.thorns) this.hit(enemy, 2 * p.run.ranks.thorns, p);
    if (!p.run.hp) this.kill(p, owner);
  }
  trapPlayer(p, owner) {
    if (this.players.some((other) => other.id === owner)) return;
    this.hurt(p, owner);
  }
  resolveBlast(bomb, cells) {
    const p = this.players.find((p) => p.id === bomb.owner);
    if (!p?.run) return;
    for (const e of this.enemies)
      if (
        e.hp > 0 &&
        cells.some((c) => Math.floor(e.x) === c.x && Math.floor(e.y) === c.y)
      ) {
        if (bomb.kind === "frost") {
          e.frozenUntil = this.time + 2;
          continue;
        }
        if (bomb.kind === "shock") this.push(e, bomb);
        this.hit(e, 2 + (p.run.ranks.force || 0), p);
      }
  }
  pathTo(enemy, target) {
    const key = target.id,
      tx = Math.floor(target.x),
      ty = Math.floor(target.y);
    let flow = this.flows.get(key);
    if (!flow || flow.until <= this.time || flow.tx !== tx || flow.ty !== ty) {
      const cells = new Int32Array(this.width * this.height).fill(-1),
        queue = [[tx, ty]];
      cells[ty * this.width + tx] = 0;
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i];
        for (const [dx, dy] of Object.values(DIR)) {
          const nx = x + dx,
            ny = y + dy,
            index = ny * this.width + nx;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= this.width ||
            ny >= this.height ||
            cells[index] >= 0 ||
            this.solid(nx, ny) ||
            this.bombAt(nx, ny)
          )
            continue;
          cells[index] = cells[y * this.width + x] + 1;
          queue.push([nx, ny]);
        }
      }
      flow = { tx, ty, cells, until: this.time + 0.35 };
      this.flows.set(key, flow);
    }
    const x = Math.floor(enemy.x),
      y = Math.floor(enemy.y),
      steps = [];
    for (const [dir, [dx, dy]] of Object.entries(DIR)) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
      const d = flow.cells[ny * this.width + nx];
      if (d >= 0 && !this.solid(nx, ny) && !this.bombAt(nx, ny))
        steps.push({ x: nx + 0.5, y: ny + 0.5, dir, d });
    }
    steps.sort((a, b) => a.d - b.d);
    return steps.length ? [steps[0]] : [];
  }
  spawnHorde() {
    const alive = this.players.filter((p) => p.status === "alive");
    if (!alive.length) return;
    const cells = [];
    for (let y = 1; y < this.height - 1; y++)
      for (let x = 1; x < this.width - 1; x++) {
        const point = { x: x + 0.5, y: y + 0.5 };
        if (
          !this.solid(x, y) &&
          !this.bombAt(x, y) &&
          alive.every((p) => distance(p, point) > 6) &&
          alive.some((p) => distance(p, point) < 12) &&
          !this.enemies.some((e) => distance(e, point) < 0.8)
        )
          cells.push(point);
      }
    const elite = this.elapsed >= this.nextElite,
      quantity = elite ? 1 : Math.min(5, 2 + Math.floor(this.elapsed / 45));
    let spawned = 0;
    for (
      let i = 0;
      i < quantity && cells.length && this.enemies.length < 40;
      i++
    ) {
      const spot = cells.splice(Math.floor(this.random() * cells.length), 1)[0],
        kind = elite
          ? "boss"
          : this.elapsed < 25
            ? "runner"
            : ["runner", "runner", "dasher", "spitter"][
                Math.floor(this.random() * 4)
              ],
        hp = (elite ? 12 : 2) + Math.floor(this.elapsed / 45) * (elite ? 3 : 1);
      this.enemies.push(this.enemy(kind, spot.x, spot.y, hp));
      spawned++;
    }
    if (elite && spawned) this.nextElite += 30;
    this.nextSpawn = this.elapsed + Math.max(0.7, 2 - this.elapsed / 180);
  }
  autoAttack(p) {
    const r = p.run,
      k = r.ranks;
    if (this.elapsed < r.nextShot) return;
    r.nextShot = this.elapsed + 1.15 * Math.pow(0.86, k.cadence || 0);
    const target = this.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          distance(p, e) <= 6 + (k.reach || 0) &&
          this.clearShot(p, e),
      )
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (!target) return;
    this.launch(
      p,
      target,
      p,
      2 +
        (k.force || 0) +
        Math.min(20, (k.overpower || 0) * 0.2) +
        (p.surgeUntil > this.time ? 2 : 0),
      (k.chain || 0) + (k.storm ? 3 : 0),
      [],
    );
  }
  launch(from, target, p, damage, chain, visited) {
    const d = distance(from, target) || 1;
    this.shots.push({
      x: from.x,
      y: from.y,
      vx: ((target.x - from.x) / d) * 8,
      vy: ((target.y - from.y) / d) * 8,
      left: 6 + (p.run.ranks.reach || 0),
      owner: p.id,
      damage,
      chain,
      visited,
      kind: p.run.ranks.frost ? "frost" : "normal",
    });
  }
  tickShots(dt) {
    const pending = this.shots;
    this.shots = [];
    for (const s of pending) {
      const p = this.players.find((p) => p.id === s.owner);
      if (!p?.run) continue;
      const k = p.run.ranks,
        steps = Math.max(1, Math.ceil(dt * 32));
      let done = false;
      for (let i = 0; i < steps && !done; i++) {
        s.x += (s.vx * dt) / steps;
        s.y += (s.vy * dt) / steps;
        s.left -= (8 * dt) / steps;
        if (s.left <= 0 || this.solid(Math.floor(s.x), Math.floor(s.y))) {
          done = true;
          break;
        }
        const e = this.enemies.find(
          (e) => e.hp > 0 && !s.visited.includes(e.id) && distance(s, e) < 0.55,
        );
        if (!e) continue;
        done = true;
        this.hit(e, s.damage, p);
        if (k.frost) e.frozenUntil = this.time + 0.4 * k.frost;
        if (k.burst || k.glacier)
          for (const other of this.enemies)
            if (
              other !== e &&
              other.hp > 0 &&
              distance(e, other) < (k.glacier ? 1.8 : 1 + 0.3 * k.burst) &&
              this.clearShot(e, other)
            ) {
              this.hit(other, s.damage * 0.5, p);
              if (k.glacier) other.frozenUntil = this.time + 1.2;
            }
        const visited = [...s.visited, e.id];
        if (s.chain > 0) {
          const next = this.enemies
            .filter(
              (n) =>
                n.hp > 0 &&
                !visited.includes(n.id) &&
                distance(e, n) < 3 &&
                this.clearShot(e, n),
            )
            .sort((a, b) => distance(e, a) - distance(e, b))[0];
          if (next)
            this.launch(
              e,
              next,
              p,
              s.damage * (k.storm ? 1 : 0.5),
              s.chain - 1,
              visited,
            );
        }
      }
      if (!done) this.shots.push(s);
    }
  }
  tick(dt = RULES.tick) {
    if (this.paused()) {
      for (const p of this.players) {
        p.input.dir = null;
        p.actions = [];
      }
      return;
    }
    if (
      this.state === "playing" &&
      this.players.every((p) => p.status === "dead")
    ) {
      this.finish(
        1,
        `生存 ${Math.floor(this.elapsed)} 秒 · 第 ${this.wave} 波`,
      );
      return;
    }
    this.remaining = 1e9;
    Match.prototype.tick.call(this, dt);
    if (this.state !== "playing") return;
    this.elapsed += dt;
    this.wave = 1 + Math.floor(this.elapsed / 30);
    this.tickShots(dt);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.elapsed >= this.nextSpawn) this.spawnHorde();
    const alive = this.players.filter((p) => p.status === "alive");
    for (const p of alive) {
      this.autoAttack(p);
      const r = p.run;
      if (r.ranks.regen && this.elapsed >= r.nextHeal) {
        r.hp = Math.min(r.maxHp, r.hp + 1);
        r.nextHeal = this.elapsed + 20 / r.ranks.regen;
      }
      for (const gem of [...this.gems])
        if (distance(p, gem) < 1.8 + 0.75 * (r.ranks.magnet || 0)) {
          this.gems = this.gems.filter((g) => g !== gem);
          for (const ally of alive) {
            ally.run.xp +=
              gem.value * (1 + 0.2 * (ally.run.ranks.learning || 0));
            this.levelUp(ally);
          }
        }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const p = [...alive].sort((a, b) => distance(e, a) - distance(e, b))[0];
      if (!p) continue;
      this.moveEnemy(e, p, dt * Math.min(1.25, 0.55 + this.elapsed / 600));
      for (const victim of alive)
        if (
          !(e.bubbleUntil > this.time) &&
          e.frozenUntil <= this.time &&
          e.stunUntil <= this.time &&
          distance(e, victim) < 0.62
        )
          this.hurt(victim, e.id);
    }
    if (this.players.every((p) => p.status === "dead"))
      this.finish(
        1,
        `生存 ${Math.floor(this.elapsed)} 秒 · 第 ${this.wave} 波`,
      );
  }
  snapshot() {
    const state = super.snapshot();
    return {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        run: this.players.find((actor) => actor.id === p.id)?.run,
      })),
      objective: "无尽怪物潮 · 拾取经验，升级三选一",
      survivor: {
        elapsed: this.elapsed || 0,
        paused: this.paused(),
        gems: this.gems || [],
        shots: this.shots || [],
      },
    };
  }
}
