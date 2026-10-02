import { characterHealth } from './characters.mjs';
import { Match } from "./engine.mjs";

// 合作模式的生命与困泡规则；经典 Match 保持原样。
export class BubbleMatch extends Match {
  spawn(p) {
    super.spawn(p);
    p.hp = characterHealth(p);
    p.maxHp = characterHealth(p);
    p.forks = 1;
    p.bananas = 2;
    p.smiles = 2;
  }
  enemyItems(e) {
    for (const item of [...this.items]) {
      if (
        !this.players.some((p) => p.id === item.owner) ||
        item.availableAt > this.time ||
        Math.hypot(e.x - item.x - 0.5, e.y - item.y - 0.5) > 0.65
      )
        continue;
      if (item.kind === "banana-trap") e.stunUntil = this.time + 1.5;
      else if (item.kind === "smile-trap") e.slowUntil = this.time + 5;
      else continue;
      this.items = this.items.filter((i) => i !== item);
    }
  }
  enemySupply(e) {
    if (this.random() > 0.35) return;
    const kinds = ["fork", "banana", "smile", "haste", "guard", "surge"];
    this.items.push({
      id: ++this.serial,
      x: Math.floor(e.x),
      y: Math.floor(e.y),
      kind: kinds[Math.floor(this.random() * kinds.length)],
      availableAt: this.time + 0.2,
    });
  }
  trapPlayer(p, owner) {
    if (
      p.status !== "alive" ||
      p.shieldUntil >= this.time ||
      this.trainingEnabled(p, "invincible")
    )
      return;
    p.hp = Math.max(0, p.hp - 1);
    if (!p.hp) {
      this.kill(p, owner);
      return;
    }
    super.trapPlayer(p, owner);
  }
  burstTrap(p, owner) {
    if (p.status !== "trapped") return;
    const health = p.run || p;
    health.hp = Math.max(0, health.hp - 1);
    if (!health.hp) {
      p.status = "alive";
      this.kill(p, owner);
      return;
    }
    p.status = "alive";
    p.trappedUntil = 0;
    p.trappedBy = null;
    p.shieldUntil = this.time + 1;
    p.input.dir = null;
    p.actions = [];
    this.event("bubble-break", { player: p.id, x: p.x, y: p.y });
  }
  kill(p, owner) {
    if (
      p.status === "trapped" &&
      this.time >= p.trappedUntil &&
      owner !== "virus"
    ) {
      this.burstTrap(p, owner);
      return;
    }
    (p.run || p).hp = 0;
    super.kill(p, owner);
    p.respawnAt = 1e9;
  }
}
export function bubbleHit(enemy, time, damage, duration = 3) {
  const popped = enemy.bubbleUntil > time;
  enemy.hp = Math.max(0, enemy.hp - damage * (popped ? 2 : 1));
  enemy.bubbleUntil = popped ? 0 : time + duration;
  enemy.path = [];
  enemy.thinkAt = 0;
  return popped;
}
