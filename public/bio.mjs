import { characterHealth } from './characters.mjs';
import { ExpeditionMatch } from "./expedition.mjs";
import { Match, RULES } from "./engine.mjs";
import { bubbleHit } from "./bubble-combat.mjs";
import { NPC_DESIGNS } from "./appearance.mjs";

export const BIO_UPGRADES = {
  vitality: {
    name: "应急护甲",
    family: "人类",
    description: "生命上限 +2，恢复 2 点生命。",
    max: 5,
    icon: "ui-vitality",
  },
  boots: {
    name: "机动跑鞋",
    family: "人类",
    description: "移动速度 +0.35。",
    max: 4,
    icon: "ui-boots",
  },
  pressure: {
    name: "高压糖芯",
    family: "人类",
    description: "糖泡对丧尸伤害 +1。",
    max: 5,
    icon: "ui-pressure",
  },
  pockets: {
    name: "陷阱补给",
    family: "人类",
    description: "获得 2 个香蕉皮、2 个笑脸和 1 把叉子。",
    max: 999,
    icon: "ui-pockets",
  },
  medicine: {
    name: "解毒储备",
    family: "人类",
    description: "获得 2 支解毒剂，可在潜伏期按 4 使用。",
    max: 999,
    icon: "ui-medicine",
  },
  capacity: {
    name: "布防扩容",
    family: "人类",
    description: "糖泡放置上限 +1，最多 8 个。",
    max: 5,
    icon: "ui-capacity",
  },
  recovery: {
    name: "急救包",
    family: "人类",
    description: "恢复 3 点生命，并获得 5 秒护盾。",
    max: 999,
    icon: "ui-recovery",
  },
  claws: {
    name: "锐化利爪",
    family: "丧尸",
    description: "接触与近身攻击伤害 +1。",
    max: 3,
    icon: "ui-claws",
  },
  pursuit: {
    name: "迅捷追猎",
    family: "丧尸",
    description: "移动速度 +0.3。",
    max: 4,
    icon: "ui-pursuit",
  },
  carapace: {
    name: "增生甲壳",
    family: "丧尸",
    description: "生命上限 +3，恢复 3 点生命。",
    max: 6,
    icon: "ui-carapace",
  },
  tenacity: {
    name: "抗性进化",
    family: "丧尸",
    description: "在基础 30% 控制抗性上，每级再提高 10%，最高 70%。",
    max: 4,
    icon: "ui-tenacity",
  },
  virulence: {
    name: "病毒强化",
    family: "丧尸",
    description: "感染目标的潜伏期缩短 1 秒，最低 4 秒。",
    max: 4,
    icon: "ui-virulence",
  },
  regeneration: {
    name: "组织再生",
    family: "丧尸",
    description: "基础每 6 秒恢复 1 点生命，每级额外恢复 1 点。",
    max: 3,
    icon: "ui-regeneration",
  },
  adrenaline: {
    name: "应激狂化",
    family: "丧尸",
    description: "获得 10 秒加速与 3 秒护盾。",
    max: 999,
    icon: "ui-adrenaline",
  },
  growth: {
    name: "持续增生",
    family: "丧尸",
    description: "生命上限 +1，恢复 1 点生命。",
    max: 999,
    icon: "ui-growth",
  },
  renewal: {
    name: "活性修复",
    family: "丧尸",
    description: "立即恢复 4 点生命。",
    max: 999,
    icon: "ui-renewal",
  },
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class BioMatch extends ExpeditionMatch {
  actors() {
    return [...this.players, ...this.enemies];
  }
  start() {
    this.phase = "preparation";
    for (const p of this.players)
      if (p.humanAppearance) p.appearance = p.humanAppearance;
    super.start();
    this.remaining = 200;
    this.elapsed = 0;
    this.phase = "preparation";
    this.nextSupply = 30;
    this.nextGrowth = 20;
    this.nextRegen = 6;
    this.motherId = null;
    this.enemies = [];
    for (const p of this.players) {
      p.humanAppearance = { ...p.appearance };
      delete p.run;
      this.initHuman(p);
      p.bioBuild = this.newBuild(3);
      this.roll(p);
    }
    // 只在开局生成场内人员，之后不增加人口；出生点均可从玩家区域到达。
    this.openCells = this.reachableCells();
    const cells = [...this.openCells];
    const count = Math.min(
      24,
      Math.max(12, Math.floor((this.width * this.height) / 55)),
    );
    for (let i = 0; i < count && cells.length; i++) {
      const candidates = cells.filter((c) =>
        this.actors().every((a) => dist(a, c) > 2),
      );
      if (!candidates.length) break;
      const spot = candidates[Math.floor(this.random() * candidates.length)];
      cells.splice(cells.indexOf(spot), 1);
      const e = this.enemy("runner", spot.x, spot.y, 5);
      Object.assign(e, {
        name: `队员 ${i + 1}`,
        status: "alive",
        carry: null,
        capacity: 3,
        power: 2,
        lastBomb: -10,
        wallPasses: [],
        onWall: null,
        input: { dir: null },
        actions: [],
        forks: 1,
        bananas: 2,
        smiles: 2,
        shieldUntil: 0,
        skillReadyAt: 0,
      });
      this.initHuman(e);
      e.appearance = {
        ...NPC_DESIGNS.runner,
        hair: i % 6,
        skin: 0,
        outfit: i % 6,
      };
      e.bioBuild = this.newBuild(0);
      this.enemies.push(e);
      for (let j = 0; j < 3; j++) {
        this.roll(e);
        this.applyUpgrade(e, e.bioBuild.offers[Math.floor(this.random() * 3)]);
      }
      e.bioBuild.offers = [];
    }
  }
  initHuman(p) {
    Object.assign(p, {
      faction: "human",
      team: 0,
      hp: characterHealth(p),
      maxHp: characterHealth(p),
      antidotes: 1,
      infectedUntil: 0,
      infectedBy: null,
      speed: p.speed || 4.2,
      nextContact: 0,
    });
  }
  newBuild(pending) {
    return {
      level: 1,
      xp: 0,
      nextXp: 6,
      pending,
      opening: pending,
      ranks: {},
      offers: [],
      offerId: 0,
      rerolls: 2,
    };
  }
  reachableCells() {
    const p = this.players[0],
      queue = [{ x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 }],
      seen = new Set([`${Math.floor(p.x)},${Math.floor(p.y)}`]);
    for (let i = 0; i < queue.length; i++)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = Math.floor(queue[i].x) + dx,
          y = Math.floor(queue[i].y) + dy,
          k = `${x},${y}`;
        if (
          x < 1 ||
          y < 1 ||
          x >= this.width - 1 ||
          y >= this.height - 1 ||
          seen.has(k) ||
          this.solid(x, y)
        )
          continue;
        seen.add(k);
        queue.push({ x: x + 0.5, y: y + 0.5 });
      }
    return queue;
  }
  paused() {
    return (
      this.state === "playing" &&
      this.players.some((p) => p.status !== "dead" && p.bioBuild?.offers.length)
    );
  }
  roll(p, excluded = []) {
    const r = p.bioBuild,
      family = p.faction === "zombie" ? "丧尸" : "人类";
    let pool = Object.keys(BIO_UPGRADES).filter(
      (k) =>
        BIO_UPGRADES[k].family === family &&
        (r.ranks[k] || 0) < BIO_UPGRADES[k].max &&
        !excluded.includes(k),
    );
    if (pool.length < 3)
      pool = Object.keys(BIO_UPGRADES).filter(
        (k) =>
          BIO_UPGRADES[k].family === family &&
          (r.ranks[k] || 0) < BIO_UPGRADES[k].max,
      );
    r.offers = [];
    while (r.offers.length < 3 && pool.length)
      r.offers.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    r.offerId = ++this.serial;
  }
  applyUpgrade(p, key) {
    const r = p.bioBuild;
    r.ranks[key] = (r.ranks[key] || 0) + 1;
    if (key === "vitality" || key === "carapace") {
      const n = key === "vitality" ? 2 : 3;
      p.maxHp += n;
      p.hp = Math.min(p.maxHp, p.hp + n);
    }
    if (key === "boots" || key === "pursuit")
      p.speed = Math.min(
        key === "boots" ? 8 : 9,
        p.speed + (key === "boots" ? 0.35 : 0.3),
      );
    if (key === "pockets") {
      p.bananas += 2;
      p.smiles += 2;
      p.forks++;
    }
    if (key === "medicine") p.antidotes += 2;
    if (key === "capacity") p.capacity = Math.min(8, p.capacity + 1);
    if (key === "recovery") {
      p.hp = Math.min(p.maxHp, p.hp + 3);
      p.shieldUntil = this.time + 5;
    }
    if (key === "adrenaline") {
      p.hasteUntil = this.time + 10;
      p.shieldUntil = this.time + 3;
    }
    if (key === "growth") {
      p.maxHp++;
      p.hp = Math.min(p.maxHp, p.hp + 1);
    }
    if (key === "renewal") p.hp = Math.min(p.maxHp, p.hp + 4);
  }
  choose(id, key, token) {
    const p = this.players.find((p) => p.id === id),
      r = p?.bioBuild;
    if (
      this.state !== "playing" ||
      !r ||
      p.status === "dead" ||
      r.offerId !== token ||
      !r.offers.includes(key)
    )
      return false;
    this.applyUpgrade(p, key);
    r.offers = [];
    r.pending = Math.max(0, r.pending - 1);
    r.opening = Math.max(0, r.opening - 1);
    if (r.pending) this.roll(p);
    return true;
  }
  reroll(id, token) {
    const p = this.players.find((p) => p.id === id),
      r = p?.bioBuild;
    if (
      this.state !== "playing" ||
      !r ||
      !r.offers.length ||
      r.offerId !== token ||
      !r.rerolls ||
      p.status === "dead"
    )
      return false;
    r.rerolls--;
    this.roll(p, r.offers);
    return true;
  }
  gain(p, xp) {
    if (!p?.bioBuild) return;
    const r = p.bioBuild;
    r.xp += xp;
    while (r.xp >= r.nextXp) {
      r.xp -= r.nextXp;
      r.level++;
      r.nextXp = 6 + r.level * 2;
      r.pending++;
    }
    if (!r.pending || r.offers.length) return;
    this.roll(p);
    if (!this.players.includes(p)) {
      while (r.pending) {
        this.applyUpgrade(
          p,
          r.offers[Math.floor(this.random() * r.offers.length)],
        );
        r.pending--;
        if (r.pending) this.roll(p);
      }
      r.offers = [];
    }
  }
  transform(p, mother = false) {
    if (p.faction === "zombie") return;
    if (!mother) this.combatNotice(p.infectedBy, p.id, "感染转化");
    const source = this.actors().find((a) => a.id === p.infectedBy);
    if (source) {
      source.kills = (source.kills || 0) + 1;
      this.gain(source, 6);
    }
    Object.assign(p, {
      faction: "zombie",
      team: 1,
      status: "alive",
      mother,
      hp: mother ? 64 : 32,
      maxHp: mother ? 64 : 32,
      speed: Math.max(6.4, 6.8 * this.bioLevel.speed),
      infectedUntil: 0,
      infectedBy: null,
      antidotes: 0,
      shieldUntil: this.time + 2,
      bubbleUntil: 0,
      frozenUntil: 0,
      stunUntil: 0,
      slowUntil: 0,
      slideDir: null,
      trappedUntil: 0,
      trappedBy: null,
      hasteUntil: 0,
      surgeUntil: 0,
      magnetUntil: 0,
      forks: 0,
      bananas: 0,
      smiles: 0,
      appearance: { ...NPC_DESIGNS.runner },
      path: [],
      thinkAt: 0,
      nextContact: 0,
      skillReadyAt: 0,
    });
    p.bioBuild = this.newBuild(1);
    this.roll(p);
    if (!this.players.includes(p)) {
      this.applyUpgrade(p, p.bioBuild.offers[Math.floor(this.random() * 3)]);
      p.bioBuild.offers = [];
      p.bioBuild.pending = 0;
    }
    this.event("infection-turn", { player: p.id, x: p.x, y: p.y, mother });
  }
  infect(p, source) {
    if (
      this.phase !== "outbreak" ||
      p.faction !== "human" ||
      p.status === "dead" ||
      p.infectedUntil > 0 ||
      p.shieldUntil >= this.time
    )
      return false;
    p.infectionDuration = Math.max(
      4,
      this.bioOptions.infectionSeconds -
        (source?.bioBuild?.ranks.virulence || 0),
    );
    p.infectedUntil = this.time + p.infectionDuration;
    p.infectedBy = source?.id;
    this.event("infection", { player: p.id, x: p.x, y: p.y });
    return true;
  }
  useAntidote(id) {
    const p = this.actors().find((p) => p.id === id);
    if (
      this.state !== "playing" ||
      this.paused() ||
      !p ||
      p.status === "dead" ||
      p.faction !== "human" ||
      !p.antidotes ||
      p.infectedUntil <= this.time
    )
      return false;
    p.antidotes--;
    p.infectedUntil = 0;
    p.infectedBy = null;
    p.shieldUntil = this.time + 3;
    this.event("purified", { player: p.id, x: p.x, y: p.y });
    return true;
  }
  refreshSupply() {
    this.items = this.items.filter((i) => i.kind !== "aid");
    const cells = this.reachableCells().filter(
      (c) =>
        !this.bombAt(Math.floor(c.x), Math.floor(c.y)) &&
        !this.items.some(
          (i) => i.x === Math.floor(c.x) && i.y === Math.floor(c.y),
        ),
    );
    for (
      let n = 0;
      n < Math.max(4, Math.ceil(this.actors().length / 4)) && cells.length;
      n++
    ) {
      const c = cells.splice(Math.floor(this.random() * cells.length), 1)[0];
      this.items.push({
        id: ++this.serial,
        kind: "aid",
        x: Math.floor(c.x),
        y: Math.floor(c.y),
        availableAt: this.time,
      });
    }
  }
  collectAid(p) {
    const roll = this.random();
    let name;
    if (p.faction === "zombie") {
      if (roll < 0.35) {
        p.hp = Math.min(p.maxHp, p.hp + 5);
        name = "活性修复剂";
      } else if (roll < 0.6) {
        p.hasteUntil = this.time + 10;
        p.shieldUntil = this.time + 3;
        name = "狂化增益";
      } else {
        p.bioBuild.pending++;
        this.gain(p, 0);
        name = "额外进化选择";
      }
      p.lastAid = { name, until: this.time + 5 };
      this.event("aid-open", { player: p.id, name });
      return;
    }
    if (roll < 0.35) {
      p.antidotes += 2;
      name = "解毒剂 ×2";
    } else if (roll < 0.55) {
      p.shieldUntil = this.time + 10;
      p.hp = Math.min(p.maxHp, p.hp + 2);
      name = "强化护盾与急救";
    } else if (roll < 0.72) {
      p.surgeUntil = this.time + 15;
      p.hasteUntil = this.time + 15;
      name = "强力糖芯与疾风跑鞋";
    } else if (roll < 0.85) {
      p.bananas += 3;
      p.smiles += 3;
      p.forks += 2;
      name = "防御道具组合";
    } else {
      p.bioBuild.pending++;
      this.gain(p, 0);
      name = "额外强化选择";
    }
    p.lastAid = { name, until: this.time + 5 };
    this.event("aid-open", { player: p.id, name });
  }
  collectItem(p, item) {
    if (item.kind === "aid") {
      this.collectAid(p);
      return;
    }
    super.collectItem(p, item);
  }
  objectives(p) {
    if (p.faction === "zombie") {
      for (const i of [...this.items])
        if (
          i.kind === "aid" &&
          Math.floor(p.x) === i.x &&
          Math.floor(p.y) === i.y
        ) {
          this.collectAid(p);
          this.items = this.items.filter((item) => item !== i);
        }
      return;
    }
    super.objectives(p);
  }
  friendlySource(p, bomb) {
    return bomb.team === p.team;
  }
  placeTrap(id, kind) {
    const p = this.players.find((p) => p.id === id);
    if (this.paused() || p?.faction === "zombie") return false;
    return super.placeTrap(id, kind);
  }
  placeBomb(p) {
    if (this.paused()) return false;
    if (p.faction === "zombie") return this.claw(p);
    const ok = super.placeBomb(p);
    if (ok)
      for (const a of this.enemies)
        if (this.overlaps(a, Math.floor(p.x), Math.floor(p.y)))
          a.passes.push(this.bombs.at(-1).id);
    return ok;
  }
  cycleBomb(id) {
    if (
      this.players.find((p) => p.id === id)?.faction === "zombie" ||
      this.paused()
    )
      return false;
    return super.cycleBomb(id);
  }
  useSkill(id) {
    const p = this.players.find((p) => p.id === id);
    if (this.paused()) return false;
    if (p?.faction !== "zombie") {
      return super.useSkill(id);
    }
    if (p.status !== "alive" || p.skillReadyAt > this.time) return false;
    p.hasteUntil = this.time + 3;
    p.skillReadyAt = this.time + 8;
    return true;
  }
  movementSpeed(p) {
    return p.frozenUntil > this.time || p.stunUntil > this.time
      ? 0
      : super.movementSpeed(p);
  }
  claw(p) {
    if (
      this.phase !== "outbreak" ||
      p.status !== "alive" ||
      p.nextContact > this.time ||
      p.bubbleUntil > this.time ||
      p.stunUntil > this.time ||
      p.frozenUntil > this.time
    )
      return false;
    const target = this.actors()
      .filter(
        (a) =>
          a.faction === "human" &&
          a.status !== "dead" &&
          dist(p, a) < 1.05 &&
          this.clearContact(p, a),
      )
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (!target) return false;
    p.nextContact = this.time + 1.05;
    this.infect(target, p);
    if (target.shieldUntil < this.time) {
      target.hp = Math.max(
        0,
        target.hp - (p.mother ? 3 : 2) - (p.bioBuild.ranks.claws || 0),
      );
      target.shieldUntil = this.time + 1;
      if (!target.hp) this.transform(target);
    }
    return true;
  }
  clearContact(a, b) {
    return (
      !this.solid(Math.floor((a.x + b.x) / 2), Math.floor((a.y + b.y) / 2)) &&
      !this.bombAt(Math.floor((a.x + b.x) / 2), Math.floor((a.y + b.y) / 2))
    );
  }
  trapPlayer() {
    /* 生化玩家的泡弹命中由 resolveBlast 按阵营及生命统一结算。 */
  }
  kill(p, owner) {
    if (p.faction === "human") {
      this.transform(p);
      return;
    }
    if (p.status === "trapped" && this.time >= p.trappedUntil) {
      this.burstTrap(p, owner);
      return;
    }
    if (p.status === "dead") return;
    this.combatNotice(owner, p.id);
    p.status = "dead";
    p.hp = 0;
    p.deaths = (p.deaths || 0) + 1;
    p.respawnAt = this.time + 8;
    p.bioBuild.offers = [];
    p.bioBuild.pending = 0;
  }
  spawn(p) {
    if (
      this.phase === "outbreak" &&
      p.faction === "zombie" &&
      p.status === "dead"
    ) {
      const cells = this.openCells.filter(
        (c) =>
          !this.solid(Math.floor(c.x), Math.floor(c.y)) &&
          !this.bombAt(Math.floor(c.x), Math.floor(c.y)) &&
          this.actors()
            .filter((a) => a.faction === "human")
            .every((a) => dist(c, a) > 5),
      );
      const c =
        cells[Math.floor(this.random() * cells.length)] || this.openCells[0];
      Object.assign(p, {
        ...c,
        status: "alive",
        hp: p.maxHp,
        shieldUntil: this.time + 2,
        bubbleUntil: 0,
        frozenUntil: 0,
        stunUntil: 0,
        slowUntil: 0,
        trappedUntil: 0,
        trappedBy: null,
        path: [],
        thinkAt: 0,
      });
      return;
    }
    super.spawn(p);
  }
  resolveBlast(bomb, cells) {
    if (bomb.team !== 0) return;
    const owner = this.actors().find((p) => p.id === bomb.owner);
    for (const a of this.actors()) {
      if (
        a.faction !== "zombie" ||
        a.status === "dead" ||
        a.shieldUntil > this.time ||
        a.hurtUntil > this.time ||
        !cells.some((c) => Math.floor(a.x) === c.x && Math.floor(a.y) === c.y)
      )
        continue;
      const resist = 0.7 - 0.1 * (a.bioBuild.ranks.tenacity || 0);
      if (bomb.kind === "frost") {
        a.frozenUntil = this.time + 2.5 * resist;
        continue;
      }
      if (bomb.kind === "shock") {
        this.push(a, bomb);
        a.stunUntil = this.time + 0.8 * resist;
      }
      bubbleHit(
        a,
        this.time,
        2 + (owner?.bioBuild.ranks.pressure || 0),
        3 * resist,
      );
      a.hurtUntil = this.time + 0.3;
      if (this.players.includes(a) && a.hp > 0) {
        a.status = a.bubbleUntil > this.time ? "trapped" : "alive";
        a.trappedUntil = a.bubbleUntil;
        a.trappedBy = bomb.owner;
      }
      if (!a.hp) {
        this.kill(a, bomb.owner);
        if (owner) {
          owner.kills = (owner.kills || 0) + 1;
          this.gain(owner, 6);
        }
      }
    }
  }
  enemyItems(e) {
    if (e.faction !== "zombie") return;
    const scale = 0.7 - 0.1 * (e.bioBuild.ranks.tenacity || 0);
    for (const item of [...this.items]) {
      if (
        item.team !== 0 ||
        item.availableAt > this.time ||
        dist(e, { x: item.x + 0.5, y: item.y + 0.5 }) > 0.65
      )
        continue;
      if (item.kind === "banana-trap") e.stunUntil = this.time + 1.5 * scale;
      else if (item.kind === "smile-trap") e.slowUntil = this.time + 5 * scale;
      else continue;
      this.items = this.items.filter((i) => i !== item);
    }
  }

  tickNpc(e, dt) {
    if (e.status === "dead") {
      if (e.respawnAt <= this.time) this.spawn(e);
      return;
    }
    if (
      e.bubbleUntil > this.time ||
      e.stunUntil > this.time ||
      e.frozenUntil > this.time
    ) {
      e.moving = false;
      return;
    }
    for (const item of [...this.items])
      if (
        item.kind === "aid" &&
        Math.floor(e.x) === item.x &&
        Math.floor(e.y) === item.y
      ) {
        this.collectAid(e);
        this.items = this.items.filter((i) => i !== item);
      }
    const threats = this.actors().filter(
      (a) => a.faction !== e.faction && a.status !== "dead",
    );
    const nearest = threats.sort((a, b) => dist(e, a) - dist(e, b))[0];
    if (e.faction === "zombie") {
      if (nearest) {
        e.moveSpeed = e.speed * (e.hasteUntil > this.time ? 1.35 : 1);
        this.moveEnemy(e, nearest, dt);
        this.claw(e);
      }
      return;
    }
    if (
      e.infectedUntil > this.time &&
      e.infectedUntil - this.time < this.bioOptions.infectionSeconds - 2
    )
      this.useAntidote(e.id);
    if (!e.goal || this.time >= e.goalUntil || dist(e, e.goal) < 0.6) {
      const meds = this.items
        .filter((i) => i.kind === "aid")
        .map((i) => ({ x: i.x + 0.5, y: i.y + 0.5 }));
      let candidates =
        !e.antidotes && meds.length
          ? meds
          : this.openCells.filter((c) => dist(c, e) > 2 && dist(c, e) < 7);
      if (nearest && dist(e, nearest) < 7)
        candidates.sort((a, b) => dist(b, nearest) - dist(a, nearest));
      e.goal =
        nearest && dist(e, nearest) < 7
          ? candidates[0]
          : candidates[Math.floor(this.random() * candidates.length)];
      e.goalUntil = this.time + 2;
      e.path = [];
      e.thinkAt = 0;
    }
    if (nearest && dist(e, nearest) < 4 && this.time - e.lastBomb > 2.5) {
      this.placeBomb(e);
      if (e.bananas > 0 && this.random() < 0.02) {
        e.bananas--;
        this.items.push({
          id: ++this.serial,
          x: Math.floor(e.x),
          y: Math.floor(e.y),
          kind: "banana-trap",
          owner: e.id,
          team: 0,
          availableAt: this.time + 0.4,
        });
      }
    }
    if (e.goal) {
      e.moveSpeed = e.speed;
      this.moveEnemy(e, e.goal, dt);
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
    if (this.state !== "playing") {
      Match.prototype.tick.call(this, dt);
      return;
    }
    // 感染转化先于回合判定，避免最后一帧潜伏到期仍判定人类胜利。
    for (const a of this.actors())
      if (
        a.faction === "human" &&
        a.infectedUntil > 0 &&
        a.infectedUntil <= this.time + dt
      )
        this.transform(a);
    if (this.paused()) return;
    if (this.remaining <= dt) {
      this.finish(
        this.actors().some((a) => a.faction === "human") ? 0 : 1,
        this.actors().some((a) => a.faction === "human")
          ? "防守时间结束，仍有人类存活"
          : "全部人类已转化",
      );
      return;
    }
    Match.prototype.tick.call(this, dt);
    if (this.state !== "playing") return;
    if (this.practice) this.remaining = Math.max(0, this.remaining - dt);
    this.elapsed += dt;
    if (this.phase === "preparation" && this.elapsed >= 20) {
      this.phase = "outbreak";
      const candidates = this.enemies.filter((e) => e.faction === "human");
      const mother = candidates[Math.floor(this.random() * candidates.length)];
      this.motherId = mother.id;
      this.transform(mother, true);
    }
    if (this.elapsed >= this.nextSupply) {
      this.refreshSupply();
      this.nextSupply += 30;
    }
    if (this.elapsed >= this.nextGrowth) {
      for (const a of this.actors()) if (a.status !== "dead") this.gain(a, 2);
      this.nextGrowth += 20;
    }
    if (this.elapsed >= this.nextRegen) {
      for (const a of this.actors())
        if (a.faction === "zombie" && a.status !== "dead")
          a.hp = Math.min(
            a.maxHp,
            a.hp + 1 + (a.bioBuild.ranks.regeneration || 0),
          );
      this.nextRegen += 6;
    }
    for (const e of this.enemies) this.tickNpc(e, dt);
    for (const p of this.players)
      if (p.faction === "zombie" && p.status === "alive") {
        this.enemyItems(p);
        this.claw(p);
      }
    if (
      this.phase === "outbreak" &&
      !this.actors().some((a) => a.faction === "human")
    )
      this.finish(1, "全部人类已转化，丧尸获胜");
  }
  finish(winner, reason) {
    super.finish(winner, reason);
    this.victory = winner === 0 ? "人类胜利" : "丧尸胜利";
  }
  snapshot() {
    const state = Match.prototype.snapshot.call(this),
      actors = this.actors();
    return {
      ...state,
      victory: this.state === "finished" ? this.victory : undefined,
      players: state.players.map((p) => ({
        ...p,
        bioBuild: this.players.find((a) => a.id === p.id).bioBuild,
      })),
      enemies: this.enemies
        .filter((e) => e.status !== "dead")
        .map(({ path, goal, bioBuild, input, actions, ...e }) => e),
      warnings: [],
      bio: {
        ...this.bioOptions,
        phase: this.phase,
        elapsed: this.elapsed || 0,
        preparationRemaining: Math.max(0, 20 - (this.elapsed || 0)),
        supplyRemaining: Math.max(0, this.nextSupply - this.elapsed),
        humans: actors.filter((a) => a.faction === "human").length,
        zombies: actors.filter((a) => a.faction === "zombie").length,
        motherId: this.motherId,
        paused: this.paused(),
        zone: this.map.defenseZone,
      },
      objective:
        this.phase === "preparation"
          ? "寻找防御地形，布置陷阱；20 秒后从场内 AI 中产生母体"
          : "人类使用解毒剂抵御感染；丧尸追踪并感染所有人类",
    };
  }
}
