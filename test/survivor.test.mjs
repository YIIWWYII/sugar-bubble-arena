import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMaps, mapForMode } from "../public/maps.mjs";
import { Match } from "../public/engine.mjs";
import { SurvivorMatch, SURVIVOR_UPGRADES } from "../public/survivor.mjs";
const load = (f) =>
    JSON.parse(
      readFileSync(new URL(`../public/assets/${f}.json`, import.meta.url)),
    ),
  maps = createMaps(load("map"), load("water11"));
function setup(players = 1) {
  const m = new SurvivorMatch(
    mapForMode(maps.get("survivor-grove"), "survivor"),
    false,
    42,
  );
  for (let i = 0; i < players; i++) m.addPlayer(`p${i}`, "P", 0);
  m.start();
  m.state = "playing";
  return m;
}
function chooseAll(m) {
  for (const p of m.players)
    if (p.run.offers.length) m.choose(p.id, p.run.offers[0], p.run.offerId);
}
test("three choices pause authoritative time until all living teammates choose; stale requests fail", () => {
  const m = setup(2),
    p = m.players[0],
    time = m.time;
  assert.equal(p.run.offers.length, 3);
  m.tick(1);
  assert.equal(m.time, time);
  const token = p.run.offerId;
  assert(!m.choose(p.id, "glacier", token));
  assert(m.choose(p.id, "force", token));
  assert(!m.choose(p.id, "force", token));
  m.tick(1);
  assert.equal(m.time, time);
  chooseAll(m);
  m.tick(0.1);
  assert(m.time > time);
});
test("rerolls consume limited stock, exclude previous cards and invalidate old choices", () => {
  const m = setup(),
    p = m.players[0],
    old = [...p.run.offers],
    token = p.run.offerId;
  assert(m.reroll(p.id, token));
  assert.equal(p.run.rerolls, 1);
  assert(p.run.offers.every((k) => !old.includes(k)));
  assert(!m.choose(p.id, p.run.offers[0], token));
  assert(m.reroll(p.id, p.run.offerId));
  assert(!m.reroll(p.id, p.run.offerId));
});
test("experience gems are shared once, level up and offer three distinct eligible upgrades", () => {
  const m = setup(2);
  chooseAll(m);
  m.nextSpawn = 1e9;
  const p = m.players[0];
  m.gems = [{ id: 1, x: p.x, y: p.y, value: 8 }];
  m.tick();
  assert.equal(m.gems.length, 0);
  for (const p of m.players) {
    assert.equal(p.run.level, 2);
    assert.equal(new Set(p.run.offers).size, 3);
    assert(p.run.offers.every((k) => !SURVIVOR_UPGRADES[k].requires));
  }
  const xp = p.run.xp;
  m.tick(1);
  assert.equal(p.run.xp, xp);
});
test("auto attacks respect walls and damage upgrades, kills drop experience exactly once", () => {
  const m = setup();
  chooseAll(m);
  m.blocks.fill(0);
  const p = m.players[0];
  p.x = 3.5;
  p.y = 3.5;
  const e = m.enemy("runner", 5.5, 3.5, 3);
  m.enemies = [e];
  m.setBlock(4, 3, 8005);
  m.autoAttack(p);
  assert.equal(e.hp, 3);
  m.setBlock(4, 3, 0);
  m.elapsed = 2;
  m.autoAttack(p);
  assert.equal(e.hp, 3);
  m.tickShots(0.4);
  assert.equal(e.hp, 0);
  assert.equal(m.gems.length, 1);
  m.hit(e, 9, p);
  assert.equal(m.gems.length, 1);
});
test("evolutions require prerequisite ranks and are offered once eligible; maxed pools still have three choices", () => {
  const m = setup(),
    p = m.players[0];
  p.run.ranks = { frost: 2, force: 2 };
  m.roll(p);
  assert(p.run.offers.includes("glacier"));
  p.run.ranks = Object.fromEntries(
    Object.entries(SURVIVOR_UPGRADES)
      .filter(([, v]) => v.family !== "补给")
      .map(([k, v]) => [k, v.max]),
  );
  m.roll(p);
  assert.equal(new Set(p.run.offers).size, 3);
  assert(p.run.offers.every((k) => SURVIVOR_UPGRADES[k].family === "补给"));
});
test("damage immunity prevents contact stacking, death finishes the endless run and replay clears builds", () => {
  const m = setup();
  chooseAll(m);
  const p = m.players[0];
  m.time = 10;
  p.shieldUntil = 0;
  m.hurt(p, "enemy");
  assert.equal(p.run.hp, 4);
  m.hurt(p, "enemy");
  assert.equal(p.run.hp, 4);
  p.run.hp = 1;
  p.status = "alive";
  p.shieldUntil = 0;
  m.hurt(p, "enemy");
  m.tick();
  assert.equal(m.state, "finished");
  m.start();
  assert.equal(p.run.hp, 5);
  assert.deepEqual(p.run.ranks, {});
  assert.equal(p.run.rerolls, 2);
});
test("endless spawning escalates and respects its cap, elites arrive after 30 seconds", () => {
  const m = setup();
  chooseAll(m);
  m.elapsed = 31;
  m.spawnHorde();
  assert(m.enemies.some((e) => e.kind === "boss"));
  for (let i = 0; i < 100; i++) {
    m.elapsed += 2;
    m.spawnHorde();
  }
  assert(m.enemies.length <= 40);
  assert(m.enemies.every((e) => !m.solid(Math.floor(e.x), Math.floor(e.y))));
});
test("removing a choosing teammate releases the pause", () => {
  const m = setup(2);
  m.choose("p0", "force", m.players[0].run.offerId);
  assert(m.paused());
  m.removePlayer("p1");
  assert(!m.paused());
});
test("survivor terrain is connected and all player spawns are open", () => {
  for (const map of maps.values())
    if (map.mode === "survivor") {
      const m = new SurvivorMatch(map),
        q = [map.spawns[0]],
        seen = new Set([q[0].join(",")]);
      for (let i = 0; i < q.length; i++)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const x = q[i][0] + dx,
            y = q[i][1] + dy,
            k = `${x},${y}`;
          if (!m.solid(x, y) && !seen.has(k)) {
            seen.add(k);
            q.push([x, y]);
          }
        }
      for (let y = 0; y < m.height; y++)
        for (let x = 0; x < m.width; x++)
          if (!m.solid(x, y))
            assert(seen.has(`${x},${y}`), `${map.id} ${x},${y}`);
      for (const [x, y] of map.spawns) assert(!m.solid(x, y));
    }
});

test("cooperative blasts protect owner and allies even after owner leaves; enemy blasts still hurt", () => {
  const m = setup(2);
  chooseAll(m);
  m.blocks.fill(0);
  m.time = 10;
  for (const p of m.players) {
    p.x = 4.5;
    p.y = 4.5;
    p.shieldUntil = 0;
  }
  const p = m.players[0],
    q = m.players[1],
    bomb = {
      id: ++m.serial,
      x: 4,
      y: 4,
      power: 2,
      owner: p.id,
      team: 0,
      born: 0,
      explodeAt: 10,
    };
  m.bombs.push(bomb);
  m.explode(bomb);
  assert.equal(p.run.hp, 5);
  assert.equal(q.run.hp, 5);
  m.removePlayer(p.id);
  const old = { ...bomb, id: ++m.serial };
  m.bombs.push(old);
  m.explode(old);
  assert.equal(q.run.hp, 5);
  const hostile = { ...bomb, id: ++m.serial, owner: "hostile", team: 1 };
  m.bombs.push(hostile);
  m.explode(hostile);
  assert.equal(q.run.hp, 4);
});

test("ice and chain upgrades change combat, while walls block secondary hits", () => {
  const m = setup();
  chooseAll(m);
  m.blocks.fill(0);
  const p = m.players[0];
  p.x = 3.5;
  p.y = 3.5;
  p.run.ranks = { frost: 2, chain: 1 };
  const a = m.enemy("runner", 5.5, 3.5, 8),
    b = m.enemy("runner", 5.5, 5.5, 8);
  m.enemies = [a, b];
  m.autoAttack(p);
  assert.equal(a.hp, 8);
  m.tickShots(0.3);
  assert(a.frozenUntil > m.time);
  m.tickShots(0.3);
  assert(b.hp < 8);
  assert.equal(m.shots.length, 0);
});
test("survivor runs do not end at expedition time limits and snapshots preserve empty choice arrays", () => {
  const m = setup();
  chooseAll(m);
  const p = m.players[0];
  p.shieldUntil = 1e9;
  m.elapsed = 180;
  m.time = 183;
  m.remaining = 0.001;
  m.tick();
  assert.equal(m.state, "playing");
  assert(m.elapsed > 180);
  assert.deepEqual(m.snapshot().players[0].run.offers, []);
});

test("friendly-fire protection applies only to cooperative modes and also ignores friendly floor traps", () => {
  for (const mode of ["classic", "boss", "bio", "water11", "survivor"]) {
    const m = new Match({ ...maps.get("survivor-grove"), mode });
    const p = m.addPlayer("p", "P", 0),
      q = m.addPlayer("q", "Q", 0);
    m.start();
    m.blocks.fill(0);
    m.time = 10;
    for (const a of [p, q]) {
      a.x = 3.5;
      a.y = 3.5;
      a.shieldUntil = 0;
    }
    const b = {
      id: ++m.serial,
      owner: "p",
      team: 0,
      x: 3,
      y: 3,
      power: 2,
      born: 0,
      explodeAt: 10,
    };
    m.bombs.push(b);
    m.explode(b);
    assert.equal(p.status, mode === "classic" ? "trapped" : "alive");
    assert.equal(q.status, p.status);
    q.status = "alive";
    q.slowUntil = 0;
    m.items = [
      {
        id: 9,
        x: 3,
        y: 3,
        kind: "smile-trap",
        owner: "p",
        team: 0,
        availableAt: 0,
      },
    ];
    m.objectives(q);
    assert.equal(q.slowUntil > m.time, mode === "classic");
  }
});

test("flying bubbles collide with newly placed walls and follow-up hits pop trapped enemies", () => {
  const m = setup();
  chooseAll(m);
  m.blocks.fill(0);
  const p = m.players[0];
  p.x = 3.5;
  p.y = 3.5;
  const e = m.enemy("runner", 5.5, 3.5, 20);
  m.enemies = [e];
  m.autoAttack(p);
  m.setBlock(4, 3, 8005);
  m.tickShots(0.5);
  assert.equal(e.hp, 20);
  assert.equal(m.shots.length, 0);
  m.setBlock(4, 3, 0);
  m.hit(e, 2, p);
  assert.equal(e.hp, 18);
  assert(e.bubbleUntil > m.time);
  m.hit(e, 2, p);
  assert.equal(e.hp, 14);
  assert.equal(e.bubbleUntil, 0);
});
test("survivor contact costs health without trapping; equipment still controls monsters", () => {
  const m = setup();
  chooseAll(m);
  const p = m.players[0],
    e = m.enemy("runner", 4.5, 4.5, 8);
  m.time = 10;
  p.shieldUntil = 0;
  m.hurt(p, e.id);
  assert.equal(p.status, "alive");
  assert.equal(p.run.hp, 4);
  assert.equal(p.trappedUntil, 0);
  m.hurt(p, e.id);
  assert.equal(p.run.hp, 4);
  m.items = [
    { id: 1, x: 4, y: 4, owner: p.id, kind: "banana-trap", availableAt: 0 },
  ];
  m.enemyItems(e);
  assert(e.stunUntil > m.time);
  assert.equal(m.items.length, 0);
  m.items = [
    { id: 2, x: 4, y: 4, owner: p.id, kind: "smile-trap", availableAt: 0 },
  ];
  m.enemyItems(e);
  assert.equal(e.slowUntil, m.time + 5);
  p.shieldUntil = 0;
  m.hurt(p, e.id);
  assert.equal(p.status, "alive");
  assert.equal(p.run.hp, 3);
  p.run.hp = 1;
  p.shieldUntil = 0;
  m.hurt(p, e.id);
  assert.equal(p.status, "dead");
  assert.equal(p.run.hp, 0);
  assert(p.respawnAt > 1e8);
});
