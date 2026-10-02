import { characterOf } from './characters.mjs';
import { BubbleMatch, bubbleHit } from "./bubble-combat.mjs";
import { mapForMode } from "./maps.mjs";
import { NPC_DESIGNS } from "./appearance.mjs";
import { Match, RULES, DIR } from "./engine.mjs";

export const EXPEDITION_MODES = ["boss", "bio", "survivor"];
export const BOMB_TYPES = Object.freeze({
  normal: {
    name: "标准糖泡",
    description: "十字爆炸，伤害敌人并破坏砖块。",
    fuse: 3,
    color: "#ffd665",
  },
  shock: {
    name: "震退糖泡",
    description: "十字冲击，击退两格并短暂眩晕；首领击退一格，丧尸有控制抗性。",
    fuse: 1.6,
    color: "#ffb65e",
  },
  frost: {
    name: "冰冻糖泡",
    description: "冻结普通敌人 2.5 秒，首领 1.2 秒；丧尸按控制抗性缩短时间。",
    fuse: 2,
    color: "#85e7ff",
  },
  barrier: {
    name: "屏障糖泡",
    description: "阻挡敌人与爆炸，持续 7 秒；被爆炸击中后消失。",
    fuse: 7,
    color: "#b4a0ff",
  },
  remote: {
    name: "遥控糖泡",
    description: "按 R 引爆已放置糖泡，最迟 10 秒自动引爆。",
    fuse: 10,
    color: "#ff829b",
  },
});
export const BIO_LEVELS = {
  easy: {
    name: "简单",
    speed: 0.85,
    think: 0.6,
    interval: 25,
    limit: 6,
    wave: 1,
    charges: 5,
  },
  normal: {
    name: "普通",
    speed: 1,
    think: 0.3,
    interval: 20,
    limit: 9,
    wave: 2,
    charges: 3,
  },
  hard: {
    name: "困难",
    speed: 1.15,
    think: 0.15,
    interval: 14,
    limit: 12,
    wave: 3,
    charges: 2,
  },
};
export function validateBioOptions(options = {}) {
  const difficulty = options.difficulty ?? "normal",
    infectionSeconds = options.infectionSeconds ?? 12;
  if (
    !Object.hasOwn(BIO_LEVELS, difficulty) ||
    ![8, 12, 20].includes(infectionSeconds)
  )
    throw Error("请选择有效的生化难度和感染潜伏时间");
  return { difficulty, infectionSeconds };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 合作模式共用原版碰撞、泡弹和技能，新增敌人及胜负规则。
export class ExpeditionMatch extends BubbleMatch {
  constructor(map, practice = false, seed = 12345, options = {}) {
    super(map.mode === "bio" ? mapForMode(map, "bio") : map, practice, seed);
    this.bioOptions = validateBioOptions(options);
    this.bioLevel = BIO_LEVELS[this.bioOptions.difficulty];
    this.cureCharges = this.bioLevel.charges;
    this.enemies = [];
    this.warnings = [];
    this.wave = 0;
    this.nextWave = 0;
    this.trapDuration = 6;
  }
  spawn(p) {
    super.spawn(p);
    const spot = this.map.spawns[this.players.indexOf(p) % 5];
    p.x = spot[0] + 0.5;
    p.y = spot[1] + 0.5;
    p.team = 0;
    p.bombKind ??= "normal";
    p.infectedUntil = 0;
    p.cureProgress = 0;
  }
  removePlayer(id) {
    this.players = this.players.filter((p) => p.id !== id);
  }
  kill(p, killer) {
    super.kill(p, killer);
    if (p.status === "dead") {
      p.respawnAt = 1e9;
      p.infectedUntil = 0;
      p.cureProgress = 0;
    }
  }
  setupDrill() {
    return false;
  }
  start() {
    super.start();
    this.remaining = this.map.mode === "boss" ? 180 : 120;
    this.cureCharges = this.bioLevel.charges;
    this.enemies = [];
    this.warnings = [];
    this.wave = 0;
    this.nextWave = 6;
    this.nextAttack = 7;
    if (this.map.mode === "boss") {
      const cells = [];
      for (let y = 1; y < this.height - 1; y++)
        for (let x = 1; x < this.width - 1; x++)
          if (!this.solid(x, y)) cells.push({ x: x + 0.5, y: y + 0.5 });
      cells.sort(
        (a, b) =>
          Math.hypot(a.x - this.width / 2, a.y - this.height / 2) -
          Math.hypot(b.x - this.width / 2, b.y - this.height / 2),
      );
      this.enemies.push(
        this.enemy(
          "boss",
          cells[0].x,
          cells[0].y,
          18 + 6 * (this.players.length - 1),
        ),
      );
    }
    for (const p of this.players) {
      p.bombKind = "normal";
      p.capacity = Math.max(3, p.capacity-characterOf(p.character).capacity)+characterOf(p.character).capacity;
      p.power = Math.max(2, p.power-characterOf(p.character).power)+characterOf(p.character).power;
    }
  }
  enemy(kind, x, y, hp) {
    return {
      appearance: NPC_DESIGNS[kind],
      id: `enemy-${++this.serial}`,
      kind,
      x,
      y,
      hp,
      maxHp: hp,
      dir: "down",
      moving: false,
      hurtUntil: 0,
      frozenUntil: 0,
      stunUntil: 0,
      nextAbility: this.time + 5,
      passes: [],
      path: [],
      thinkAt: 0,
      phase: "hunt",
      phaseUntil: 0,
    };
  }
  cycleBomb(id) {
    const p = this.players.find((p) => p.id === id);
    if (!p || this.state !== "playing" || p.status !== "alive") return false;
    const kinds = Object.keys(BOMB_TYPES);
    p.bombKind = kinds[(kinds.indexOf(p.bombKind) + 1) % kinds.length];
    return true;
  }
  detonate(id) {
    if (
      this.state !== "playing" ||
      !this.players.some((p) => p.id === id && p.status === "alive")
    )
      return false;
    const bombs = this.bombs.filter(
      (b) => b.owner === id && b.kind === "remote" && this.time - b.born >= 0.5,
    );
    for (const b of bombs) this.explode(b);
    return bombs.length > 0;
  }
  placeBomb(p) {
    if (!super.placeBomb(p)) return false;
    const b = this.bombs.at(-1),
      kind = Object.hasOwn(BOMB_TYPES, p.bombKind) ? p.bombKind : "normal";
    b.kind = kind;
    b.explodeAt = this.time + (kind==='normal' ? characterOf(p.character).fuse : BOMB_TYPES[kind].fuse);
    b.support = ["shock", "frost", "barrier"].includes(kind);
    if (kind === "shock" || kind === "frost") b.power = Math.max(3, b.power);
    return true;
  }
  explode(bomb) {
    if (bomb.kind === "barrier") {
      this.bombs = this.bombs.filter((b) => b !== bomb);
      this.event("barrier-end", { x: bomb.x, y: bomb.y });
      return;
    }
    super.explode(bomb);
  }
  push(entity, bomb, steps = 2) {
    let dx = entity.x - bomb.x - 0.5,
      dy = entity.y - bomb.y - 0.5;
    if (Math.abs(dx) >= Math.abs(dy)) {
      dx = Math.sign(dx) || 1;
      dy = 0;
    } else {
      dy = Math.sign(dy);
      dx = 0;
    }
    // 按小步检测碰撞，击退不能穿过墙体或其他炸弹。
    const proxy = { ...entity, passes: [], wallPasses: [], onWall: null };
    for (let n = 0; n < steps * 10; n++) {
      const x = entity.x + dx * 0.1,
        y = entity.y + dy * 0.1;
      if (!this.canStand(proxy, x, y)) break;
      entity.x = x;
      entity.y = y;
    }
    entity.path = [];
    entity.thinkAt = 0;
  }
  resolveBlast(bomb, cells) {
    if (!this.players.some((p) => p.id === bomb.owner)) return;
    for (const enemy of this.enemies) {
      if (
        enemy.hp <= 0 ||
        !cells.some(
          (c) => Math.floor(enemy.x) === c.x && Math.floor(enemy.y) === c.y,
        )
      )
        continue;
      if (bomb.kind === "frost") {
        enemy.frozenUntil = this.time + (enemy.kind === "boss" ? 1.2 : 2.5);
        enemy.path = [];
        continue;
      }
      if (bomb.kind === "shock") {
        this.push(enemy, bomb, enemy.kind === "boss" ? 1 : 2);
        enemy.stunUntil = this.time + 0.8;
      }
      if (enemy.hurtUntil > this.time) continue;
      const popped = bubbleHit(
        enemy,
        this.time,
        bomb.kind === "shock" ? 1 : 2,
        enemy.kind === "boss" ? 1.8 : 4,
      );
      if (popped) this.event("bubble-pop", { x: enemy.x, y: enemy.y });
      if (popped && enemy.hp === 0 && this.map.mode === "bio")
        this.cureCharges = Math.min(8, this.cureCharges + 1);
      enemy.hurtUntil = this.time + 0.35;
      const owner = this.players.find((p) => p.id === bomb.owner);
      if (enemy.hp === 0 && owner) {
        owner.kills++;
        owner.discoveries ??= [];
        const key = `enemy:${enemy.kind}`;
        if (!owner.discoveries.includes(key)) owner.discoveries.push(key);
      }
      if (enemy.hp === 0) {
        this.combatNotice(bomb.owner, enemy.id);
        this.enemySupply(enemy);
      }
      this.event("enemy-hit", { x: enemy.x, y: enemy.y, hp: enemy.hp });
    }
    if (bomb.kind === "shock")
      for (const p of this.players)
        if (
          !this.friendlySource(p, bomb) &&
          p.status === "alive" &&
          cells.some((c) => Math.floor(p.x) === c.x && Math.floor(p.y) === c.y)
        )
          this.push(p, bomb);
  }
  pathTo(enemy, target) {
    const sx = Math.floor(enemy.x),
      sy = Math.floor(enemy.y),
      tx = Math.floor(target.x),
      ty = Math.floor(target.y);
    const queue = [{ x: sx, y: sy, path: [] }],
      seen = new Set([`${sx},${sy}`]);
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      if (node.x === tx && node.y === ty) return node.path;
      for (const [dir, [dx, dy]] of Object.entries(DIR)) {
        const x = node.x + dx,
          y = node.y + dy,
          key = `${x},${y}`;
        if (seen.has(key) || this.solid(x, y) || this.bombAt(x, y)) continue;
        seen.add(key);
        queue.push({
          x,
          y,
          path: [...node.path, { x: x + 0.5, y: y + 0.5, dir }],
        });
      }
    }
    return [];
  }
  warn(x, y, delay, power = 2) {
    if (this.solid(x, y) || this.warnings.some((w) => w.x === x && w.y === y))
      return;
    this.warnings.push({
      id: ++this.serial,
      x,
      y,
      until: this.time + delay,
      power,
    });
  }
  moveEnemy(e, target, dt) {
    this.enemyItems(e);
    e.moving = false;
    if (
      e.bubbleUntil > this.time ||
      e.frozenUntil > this.time ||
      e.stunUntil > this.time
    )
      return;
    if (
      this.time >= e.thinkAt &&
      (!e.path.length ||
        distance(e, { x: Math.floor(e.x) + 0.5, y: Math.floor(e.y) + 0.5 }) <
          0.05)
    ) {
      e.path = this.pathTo(e, target);
      e.thinkAt =
        this.time + (this.map.mode === "bio" ? this.bioLevel.think : 0.3);
      const center = {
        x: Math.floor(e.x) + 0.5,
        y: Math.floor(e.y) + 0.5,
        dir: e.dir,
      };
      if (distance(e, center) > 0.01) e.path.unshift(center);
    }
    const next = e.path[0];
    if (!next) return;
    let speed =
      e.moveSpeed ??
      (e.kind === "boss"
        ? 2
        : e.kind === "runner"
          ? 5.6
          : e.kind === "dasher"
            ? e.phase === "dash"
              ? 7
              : 4.5
            : 4.1);
    if (this.map.mode === "bio" && e.moveSpeed === undefined)
      speed *= this.bioLevel.speed;
    if (e.slowUntil > this.time) speed *= 0.45;
    if (e.phase === "windup") speed = 0;
    const d = distance(e, next),
      step = Math.min(d, speed * dt);
    if (d < 0.01) {
      e.path.shift();
      return;
    }
    const x = e.x + ((next.x - e.x) / d) * step,
      y = e.y + ((next.y - e.y) / d) * step;
    e.passes = (e.passes || []).filter((id) => {
      const b = this.bombs.find((b) => b.id === id);
      return b && this.overlaps(e, b.x, b.y);
    });
    if (this.canStand({ ...e, wallPasses: [], onWall: null }, x, y)) {
      e.x = x;
      e.y = y;
      e.dir = next.dir;
      e.moving = step > 0;
    } else {
      e.path = [];
      e.thinkAt = 0;
    }
  }
  spawnWave() {
    this.wave++;
    const count = Math.min(
      this.bioLevel.wave + Math.floor(this.wave / 2) + this.players.length - 1,
      6,
    );
    const players = this.players.filter((p) => p.status !== "dead"),
      cells = [];
    for (let y = 1; y < this.height - 1; y++)
      for (let x = 1; x < this.width - 1; x++)
        if (
          !this.inDefense({ x: x + 0.5, y: y + 0.5 }) &&
          !this.solid(x, y) &&
          !this.bombAt(x, y) &&
          players.every((p) => distance(p, { x: x + 0.5, y: y + 0.5 }) > 5) &&
          players.some((p) => distance(p, { x: x + 0.5, y: y + 0.5 }) < 12)
        )
          cells.push({ x: x + 0.5, y: y + 0.5 });
    for (
      let i = 0;
      i < count &&
      this.enemies.filter((e) => e.hp > 0).length < this.bioLevel.limit &&
      cells.length;
      i++
    ) {
      const spot = cells.splice(Math.floor(this.random() * cells.length), 1)[0],
        kind = ["runner", "dasher", "spitter"][(this.wave + i - 1) % 3];
      this.enemies.push(
        this.enemy(kind, spot.x, spot.y, kind === "runner" ? 2 : 4),
      );
    }
    this.nextWave = this.time + this.bioLevel.interval;
  }
  inDefense(p) {
    const z = this.map.defenseZone;
    return (
      !!z && p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h
    );
  }
  infect(p) {
    if (
      p.status !== "alive" ||
      p.shieldUntil >= this.time ||
      p.infectedUntil > 0
    )
      return false;
    p.infectedUntil = this.time + this.bioOptions.infectionSeconds;
    p.cureProgress = 0;
    this.event("infection", { player: p.id, x: p.x, y: p.y });
    return true;
  }
  cure(p) {
    p.infectedUntil = 0;
    p.cureProgress = 0;
    p.shieldUntil = Math.max(p.shieldUntil, this.time + 2);
    this.event("purified", { player: p.id, x: p.x, y: p.y });
  }
  useSkill(id) {
    if (!super.useSkill(id)) return false;
    const p = this.players.find((p) => p.id === id);
    if (this.map.mode === "bio" && p.skill === "purify")
      for (const ally of this.players)
        if (
          ally.status !== "dead" &&
          ally.infectedUntil > 0 &&
          distance(ally, p) <= 2
        )
          this.cure(ally);
    return true;
  }
  updateInfections(dt) {
    for (const p of this.players) {
      if (p.status === "dead" || !p.infectedUntil) continue;
      if (p.infectedUntil <= this.time + dt) {
        this.kill(p, "virus");
        continue;
      }
      const safe =
        p.status === "alive" &&
        this.inDefense(p) &&
        this.cureCharges > 0 &&
        !this.enemies.some((e) => e.hp > 0 && distance(e, p) < 3);
      p.cureProgress = safe ? (p.cureProgress || 0) + dt : 0;
      if (p.cureProgress >= 3) {
        this.cureCharges--;
        this.cure(p);
      }
    }
  }
  tick(dt = RULES.tick) {
    if (this.state === "playing" && this.map.mode === "bio")
      this.updateInfections(dt);
    if (
      this.state === "playing" &&
      this.players.length &&
      this.players.every((p) => p.status === "dead")
    ) {
      this.finish(1, "全体队员已阵亡");
      return;
    }
    if (this.state === "playing" && this.remaining <= dt) {
      this.finish(
        this.map.mode === "bio" ? 0 : 1,
        this.map.mode === "bio" ? "已完成生存目标" : "挑战时间结束",
      );
      return;
    }
    if (this.practice && this.state === "playing") this.remaining -= dt;
    super.tick(dt);
    if (this.state !== "playing") return;
    const alive = this.players.filter((p) => p.status === "alive");
    if (!this.players.some((p) => p.status !== "dead")) {
      this.finish(1, "全体队员已阵亡");
      return;
    }
    if (this.map.mode === "boss" && this.enemies[0]?.hp === 0) {
      this.finish(0, "已击败首领");
      return;
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.map.mode === "bio" && this.time >= this.nextWave) this.spawnWave();
    for (const w of [...this.warnings])
      if (w.until <= this.time) {
        this.warnings = this.warnings.filter((x) => x !== w);
        if (!this.solid(w.x, w.y) && !this.bombAt(w.x, w.y)) {
          const b = {
            id: ++this.serial,
            x: w.x,
            y: w.y,
            owner: "hostile",
            team: 1,
            power: w.power,
            born: this.time,
            explodeAt: this.time + 1.8,
            kind: "hostile",
          };
          this.bombs.push(b);
          for (const actor of [...this.players, ...this.enemies])
            if (this.overlaps(actor, b.x, b.y)) {
              actor.passes ??= [];
              actor.passes.push(b.id);
            }
        }
      }
    for (const e of this.enemies) {
      if (
        e.bubbleUntil > this.time ||
        e.frozenUntil > this.time ||
        e.stunUntil > this.time
      ) {
        e.moving = false;
        continue;
      }
      const target = [...alive].sort(
        (a, b) => distance(e, a) - distance(e, b),
      )[0];
      if (!target) continue;
      if (e.kind === "boss" && this.time >= this.nextAttack) {
        const rage = e.hp <= e.maxHp / 2;
        e.phase = rage ? "rage" : "hunt";
        this.warn(
          Math.floor(target.x),
          Math.floor(target.y),
          1.2,
          rage ? 3 : 2,
        );
        for (const [dx, dy] of [
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
        ])
          this.warn(Math.floor(e.x) + dx, Math.floor(e.y) + dy, 1.2, 2);
        this.nextAttack = this.time + (rage ? 3.5 : 5.5);
      }
      if (e.kind === "dasher") {
        if (this.time >= e.nextAbility) {
          e.phase = "windup";
          e.phaseUntil = this.time + 1;
          e.nextAbility = this.time + 7;
        } else if (e.phase === "windup" && this.time >= e.phaseUntil) {
          e.phase = "dash";
          e.phaseUntil = this.time + 1.3;
        } else if (e.phase === "dash" && this.time >= e.phaseUntil)
          e.phase = "hunt";
      }
      if (e.kind === "spitter" && this.time >= e.nextAbility) {
        this.warn(Math.floor(target.x), Math.floor(target.y), 1.3, 1);
        e.nextAbility = this.time + 7;
      }
      this.moveEnemy(e, target, dt);
      for (const p of alive)
        if (
          p.status === "alive" &&
          p.shieldUntil < this.time &&
          e.frozenUntil <= this.time &&
          e.stunUntil <= this.time &&
          distance(e, p) < 0.62
        ) {
          if (this.map.mode === "bio") this.infect(p);
          this.trapPlayer(p, e.id);
        }
    }
  }
  snapshot() {
    return {
      ...super.snapshot(),
      mode: this.map.mode,
      enemies: this.enemies.map(({ path, thinkAt, ...e }) => e),
      warnings: this.warnings,
      wave: this.wave,
      bio:
        this.map.mode === "bio"
          ? {
              ...this.bioOptions,
              zone: this.map.defenseZone,
              cureCharges: this.cureCharges,
              cureSeconds: 3,
            }
          : undefined,
      objective:
        this.map.mode === "boss"
          ? "先困泡限制首领，再次命中造成双倍破泡伤害"
          : `生存 120 秒 · ${this.bioLevel.name} · 感染潜伏 ${this.bioOptions.infectionSeconds} 秒，防守区净化，破泡击杀补充次数`,
    };
  }
}
