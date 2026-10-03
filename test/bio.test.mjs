import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BioMatch, BIO_UPGRADES } from "../public/bio.mjs";
import { createMaps, mapForMode } from "../public/maps.mjs";
const load = (f) =>
    JSON.parse(
      readFileSync(new URL(`../public/assets/${f}.json`, import.meta.url)),
    ),
  maps = createMaps(load("map"), load("water11"));
function setup(count = 1) {
  const m = new BioMatch(
    mapForMode(maps.get("bio-district"), "bio"),
    false,
    42,
  );
  for (let i = 0; i < count; i++) m.addPlayer(`p${i}`, "P", 0);
  m.start();
  m.state = "playing";
  return m;
}
function pick(m) {
  for (const p of m.players)
    while (p.bioBuild.offers.length)
      m.choose(p.id, p.bioBuild.offers[0], p.bioBuild.offerId);
}
function advance(m, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 30) && m.state === "playing"; i++) {
    pick(m);
    m.tick(1 / 30);
  }
}
test("each human receives an invulnerable safety bubble that can be broken and rebuilt after cooldown", () => {
  const m = setup();
  pick(m);
  advance(m, 20.2);
  const p = m.players[0];
  assert.equal(m.phase, "outbreak");
  assert(p.dome?.active);
  assert(m.inDome(p, p));
  assert(!m.infect(p, m.enemies[0]));
  assert.equal(m.placeDome(p.id), false);
  m.damageDome(p, p.dome.maxHp);
  assert.equal(p.dome.active, false);
  assert(p.domeCooldownAt > m.time);
});
test("three initial choices per player pause clocks, validate tokens and keep human-only options", () => {
  const m = setup(2),
    p = m.players[0],
    r = p.bioBuild;
  assert.equal(r.pending, 3);
  assert.equal(r.offers.length, 3);
  assert(r.offers.every((k) => BIO_UPGRADES[k].family === "人类"));
  const time = m.time,
    old = r.offerId;
  assert(!m.choose(p.id, "claws", old));
  assert(m.choose(p.id, r.offers[0], old));
  assert.equal(r.pending, 2);
  assert(!m.choose(p.id, r.offers[0], old));
  m.tick(1);
  assert.equal(m.time, time);
  while (r.offers.length) m.choose(p.id, r.offers[0], r.offerId);
  assert.equal(
    Object.values(r.ranks).reduce((a, b) => a + b, 0),
    3,
  );
  assert(m.paused());
  pick(m);
  assert(!m.paused());
  assert.equal(m.elapsed, 0);
});
test("only existing AI becomes mother after twenty preparation seconds; population stays fixed", () => {
  const m = setup();
  pick(m);
  const ids = m.enemies.map((e) => e.id),
    size = m.actors().length;
  assert(m.enemies.every((e) => e.faction === "human"));
  assert(new Set(m.enemies.map((e) => `${e.x},${e.y}`)).size === ids.length);
  advance(m, 19.9);
  assert.equal(m.phase, "preparation");
  assert.equal(m.motherId, null);
  advance(m, 0.2);
  assert.equal(m.phase, "outbreak");
  assert(ids.includes(m.motherId));
  assert(m.enemies.find((e) => e.id === m.motherId).mother);
  advance(m, 60);
  assert.equal(m.actors().length, size);
  assert.deepEqual(
    m.enemies.map((e) => e.id),
    ids,
  );
});
test("contact infects and damages without trapping; carried antidote cures once", () => {
  const m = setup();
  pick(m);
  m.phase = "outbreak";
  m.time = 10;
  const p = m.players[0],
    e = m.enemies[0];
  m.transform(e);
  e.x = p.x;
  e.y = p.y;
  p.shieldUntil = 0;
  e.shieldUntil = 0;
  m.claw(e);
  assert.equal(p.status, "alive");
  assert(p.infectedUntil > m.time);
  assert.equal(p.trappedUntil, 0);
  assert(p.hp < p.maxHp);
  const stock = p.antidotes;
  assert(m.useAntidote(p.id));
  assert.equal(p.antidotes, stock - 1);
  assert.equal(p.infectedUntil, 0);
  assert(!m.useAntidote(p.id));
});
test("incubation turns player into controllable zombie with fresh evolution, rather than eliminating them", () => {
  const m = setup(2);
  pick(m);
  m.phase = "outbreak";
  m.time = 10;
  const [p, q] = m.players,
    e = m.enemies[0];
  m.transform(e);
  p.shieldUntil = 0;
  assert(m.infect(p, e));
  m.time = p.infectedUntil;
  m.tick();
  assert.equal(p.faction, "zombie");
  assert.equal(p.status, "alive");
  assert.equal(p.team, 1);
  assert(p.bioBuild.offers.every((k) => BIO_UPGRADES[k].family === "丧尸"));
  assert.equal(p.antidotes, 0);
  pick(m);
  p.x = q.x;
  p.y = q.y;
  q.shieldUntil = 0;
  assert(m.claw(p));
  assert(q.infectedUntil > m.time);
  assert.equal(q.status, "alive");
  assert(m.useSkill(p.id));
  assert(p.hasteUntil > m.time);
});
test("aid refresh is thirty-second, reachable and opaque; rewards include medicine, buffs and choices", () => {
  const m = setup();
  pick(m);
  m.nextGrowth = 1e9;
  advance(m, 29.9);
  assert(!m.items.some((i) => i.kind === "aid"));
  advance(m, 0.2);
  const aid = m.items.filter((i) => i.kind === "aid");
  assert(aid.length >= 4);
  assert(aid.every((i) => !m.solid(i.x, i.y) && !("reward" in i)));
  const ids = aid.map((i) => i.id);
  m.refreshSupply();
  assert(
    m.items.filter((i) => i.kind === "aid").every((i) => !ids.includes(i.id)),
  );
  const p = m.players[0];
  for (const value of [0.1, 0.4, 0.6, 0.8, 0.99]) {
    pick(m);
    m.random = () => value;
    m.collectAid(p);
    assert(p.lastAid.name);
  }
  assert(p.bioBuild.offers.length === 3);
  assert(p.antidotes >= 3);
  assert(p.surgeUntil > m.time);
  assert(p.bananas >= 3);
  pick(m);
  m.transform(p);
  pick(m);
  m.random = () => 0.99;
  m.collectAid(p);
  assert(p.bioBuild.offers.every((k) => BIO_UPGRADES[k].family === "丧尸"));
});
test("growth and zombie kills grant upgrades; friendly blasts cannot harm uninfected NPCs", () => {
  const m = setup();
  pick(m);
  m.phase = "outbreak";
  m.time = 10;
  const p = m.players[0],
    e = m.enemies[0],
    h = m.enemies[1];
  m.transform(e);
  e.shieldUntil = 0;
  e.hp = 1;
  e.x = h.x;
  e.y = h.y;
  const hp = h.hp,
    token = p.bioBuild.offerId;
  m.resolveBlast({ owner: p.id, team: 0, kind: "normal" }, [
    { x: Math.floor(e.x), y: Math.floor(e.y) },
  ]);
  assert.equal(e.status, "dead");
  assert.equal(h.hp, hp);
  assert.equal(p.kills, 1);
  assert(p.bioBuild.offers.length);
  assert(p.bioBuild.offerId !== token);
  pick(m);
  const before = p.bioBuild.xp;
  m.gain(p, 2);
  assert(p.bioBuild.xp > before);
  m.time = e.respawnAt;
  m.spawn(e);
  assert.equal(e.status, "alive");
  assert.equal(e.faction, "zombie");
  assert.equal(e.hp, e.maxHp);
});
test("evolved resistance reduces traps, player zombie bubble expiry never recurses, replay resets faction", () => {
  const m = setup();
  pick(m);
  m.phase = "outbreak";
  m.time = 10;
  const p = m.players[0];
  m.transform(p);
  pick(m);
  p.bioBuild.ranks.tenacity = 4;
  m.items = [
    {
      id: 1,
      x: Math.floor(p.x),
      y: Math.floor(p.y),
      kind: "banana-trap",
      team: 0,
      availableAt: 0,
    },
  ];
  m.enemyItems(p);
  assert(Math.abs(p.stunUntil - m.time - 0.45) < 0.001);
  p.status = "trapped";
  p.trappedUntil = m.time;
  p.hp = 1;
  m.kill(p, "bubble");
  assert.equal(p.status, "dead");
  m.start();
  assert.equal(p.faction, "human");
  assert.equal(p.team, 0);
  assert.equal(p.hp, 5);
  assert.equal(p.antidotes, 1);
  assert.equal(p.bioBuild.pending, 3);
});
test("every bio-compatible map has large connected spawning area and valid supply cells", () => {
  for (const map of maps.values())
    if (map.supportedModes?.includes("bio")) {
      const m = new BioMatch(mapForMode(map, "bio"));
      m.addPlayer("p", "P", 0);
      m.start();
      assert(m.width >= 25 && m.height >= 23, map.id);
      assert(m.enemies.length >= 12, map.id);
      m.refreshSupply();
      assert(
        m.items
          .filter((i) => i.kind === "aid")
          .every((i) => !m.solid(i.x, i.y)),
      );
    }
});
test("removing a choosing player releases pause; no AI creates mandatory UI selections", () => {
  const m = setup(2);
  const p = m.players[0];
  while (p.bioBuild.offers.length)
    m.choose(p.id, p.bioBuild.offers[0], p.bioBuild.offerId);
  assert(m.paused());
  m.removePlayer("p1");
  assert(!m.paused());
  m.gain(m.enemies[0], 100);
  assert.equal(m.enemies[0].bioBuild.offers.length, 0);
});

test("maxed faction trees retain three repeatable choices and zombie aid grants evolution", () => {
  const m = setup();
  pick(m);
  const p = m.players[0];
  m.phase = "outbreak";
  m.transform(p);
  pick(m);
  p.bioBuild.ranks = Object.fromEntries(
    Object.entries(BIO_UPGRADES)
      .filter(([, u]) => u.family === "丧尸" && u.max < 999)
      .map(([k, u]) => [k, u.max]),
  );
  m.roll(p);
  assert.equal(p.bioBuild.offers.length, 3);
  assert(p.bioBuild.offers.every((k) => BIO_UPGRADES[k].max === 999));
  pick(m);
  m.random = () => 0.99;
  m.items = [
    {
      id: 1,
      kind: "aid",
      x: Math.floor(p.x),
      y: Math.floor(p.y),
      availableAt: 0,
    },
  ];
  m.objectives(p);
  assert.equal(m.items.length, 0);
  assert(p.bioBuild.offers.length === 3);
});

test("zombies have major health, movement and control advantages, and explicit faction victories", () => {
  const m = setup();
  pick(m);
  m.phase = "outbreak";
  const p = m.players[0],
    e = m.enemies[0];
  const humanHP = p.hp;
  m.transform(e, true);
  assert(e.maxHp >= 64);
  assert(e.maxHp > humanHP * 8);
  assert(e.speed > p.speed);
  m.transform(p);
  assert.equal(p.maxHp, 32);
  assert.equal(p.faction, "zombie");
  m.finish(0, "defended");
  assert.equal(m.snapshot().victory, "人类胜利");
  m.finish(1, "infected");
  assert.equal(m.snapshot().victory, "丧尸胜利");
});

test("survival deadline awards humans, while complete conversion awards zombies", () => {
  const humans = setup();
  pick(humans);
  humans.phase = "outbreak";
  humans.remaining = 0.001;
  humans.tick();
  assert.equal(humans.winner, 0);
  assert.equal(humans.snapshot().victory, "人类胜利");
  const zombies = setup();
  pick(zombies);
  zombies.phase = "outbreak";
  for (const a of zombies.actors()) zombies.transform(a);
  pick(zombies);
  zombies.tick();
  assert.equal(zombies.winner, 1);
  assert.equal(zombies.snapshot().victory, "丧尸胜利");
});


test("purify cures incubation without consuming an antidote and respects cooldown", () => {
  const m=setup(); pick(m); const p=m.players[0];
  p.skill="purify"; p.skillLevel=1; p.skillReadyAt=0; p.antidotes=0; p.infectedUntil=m.time+10;
  assert.equal(m.useSkill(p.id),true);
  assert.equal(p.infectedUntil,0); assert.equal(p.antidotes,0);
  assert.ok(p.shieldUntil>m.time); assert.equal(m.useSkill(p.id),false);
});
test("bio practice still advances its defense timer", () => {
  const m=setup(); pick(m); m.practice=true;
  const before=m.remaining; m.tick(.1); assert.ok(m.remaining<before);
});
test("human rescue cleanses contact debuffs without requiring a bubble", () => {
  const m=setup(); pick(m); const p=m.players[0];
  p.skill="rescue";p.skillLevel=1;p.skillReadyAt=0;
  p.slowUntil=p.frozenUntil=p.stunUntil=m.time+10;
  assert.equal(m.useSkill(p.id),true);
  assert.equal(p.slowUntil+p.frozenUntil+p.stunUntil,0);
  assert.ok(p.shieldUntil>m.time);assert.equal(m.useSkill(p.id),false);
});
