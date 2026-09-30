import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMaps, mapForMode, modeCompatibility } from "../public/maps.mjs";
import {
  ExpeditionMatch,
  BIO_LEVELS,
  validateBioOptions,
} from "../public/expedition.mjs";
const load = (name) =>
  JSON.parse(
    readFileSync(new URL(`../public/assets/${name}`, import.meta.url)),
  );
const maps = createMaps(load("map.json"), load("water11.json"));
function match(mode = "boss", open = true) {
  const m = new ExpeditionMatch(
    maps.get(mode === "boss" ? "boss-court" : "bio-maze"),
  );
  const p = m.addPlayer("p", "Player", 0);
  m.start();
  m.state = "playing";
  m.time = 10;
  p.shieldUntil = 0;
  if (open) {
    m.blocks.fill(0);
    m.hiddenItems = [];
  }
  return [m, p];
}
function bomb(m, x, y, kind = "normal") {
  const b = {
    id: ++m.serial,
    x,
    y,
    owner: "p",
    power: 3,
    born: m.time,
    explodeAt: m.time + 3,
    kind,
    support: ["frost", "shock"].includes(kind),
  };
  m.bombs.push(b);
  return b;
}

test("all four cooperative maps have connected terrain after crates are removed", () => {
  for (const map of [...maps.values()].filter((m) =>
    ["boss", "bio"].includes(m.mode),
  )) {
    const width = map.width || 15,
      height = map.height || 13;
    const pass = (x, y) =>
      x >= 0 &&
      x < width &&
      y >= 0 &&
      y < height &&
      (!map.blocks[y * width + x] || map.blocks[y * width + x] < 8005);
    const q = [map.spawns[0]],
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
        if (pass(x, y) && !seen.has(k)) {
          seen.add(k);
          q.push([x, y]);
        }
      }
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (pass(x, y)) assert(seen.has(`${x},${y}`), `${map.id}: ${x},${y}`);
  }
});
test("boss health scales with player count and player blasts can finish the challenge", () => {
  const [m, p] = match();
  m.addPlayer("q", "Friend", 0);
  m.start();
  assert.equal(m.enemies[0].maxHp, 24);
  m.state = "playing";
  m.time = 10;
  m.blocks.fill(0);
  p.x = 1.5;
  p.y = 1.5;
  const boss = m.enemies[0];
  boss.x = 7.5;
  boss.y = 6.5;
  boss.hp = 2;
  m.explode(bomb(m, 7, 5));
  m.tick();
  assert.equal(m.winner, 0);
  assert.equal(m.state, "finished");
  assert.equal(p.kills, 1);
});
test("wall blocks damage and a barrier absorbs a chain explosion", () => {
  const [m] = match();
  const e = m.enemies[0];
  e.x = 7.5;
  e.y = 6.5;
  const hp = e.hp;
  m.setBlock(7, 5, 8005);
  m.explode(bomb(m, 7, 4));
  assert.equal(e.hp, hp);
  m.setBlock(7, 5, 0);
  const barrier = bomb(m, 7, 5, "barrier");
  m.explode(bomb(m, 7, 4));
  assert(!m.bombs.includes(barrier));
  assert.equal(e.hp, hp);
});
test("frost freezes enemies without trapping players, shock stops before walls", () => {
  const [m, p] = match("bio");
  p.x = 7.5;
  p.y = 5.5;
  const e = m.enemy("runner", 7.5, 6.5, 4);
  m.enemies = [e];
  m.explode(bomb(m, 7, 5, "frost"));
  assert.equal(e.frozenUntil, 12.5);
  assert.equal(p.status, "alive");
  m.setBlock(7, 8, 8005);
  m.explode(bomb(m, 7, 5, "shock"));
  assert(e.y < 7.6);
  assert(e.y > 6.5);
  assert(e.stunUntil > m.time);
  assert.equal(p.status, "alive");
});
test("remote requires arming time and only its living owner can detonate", () => {
  const [m, p] = match();
  p.bombKind = "remote";
  p.x = 3.5;
  p.y = 3.5;
  assert(m.placeBomb(p));
  assert.equal(m.detonate("p"), false);
  m.time += 0.6;
  assert.equal(m.detonate("other"), false);
  assert(m.detonate("p"));
  assert.equal(m.bombs.length, 0);
});
test("barrier blocks an enemy path and automatically expires", () => {
  const [m, p] = match("bio");
  p.x = 3.5;
  p.y = 3.5;
  p.bombKind = "barrier";
  assert(m.placeBomb(p));
  const e = m.enemy("runner", 3.5, 5.5, 2);
  const path = m.pathTo(e, { x: 3.5, y: 1.5 });
  assert(path.length);
  assert(!path.some((n) => n.x === 3.5 && n.y === 3.5));
  m.time += 7.1;
  m.tick();
  assert(!m.bombs.some((b) => b.kind === "barrier"));
});
test("runner outruns base player and retains progress between route updates", () => {
  const [m, p] = match("bio");
  m.nextWave = 1e9;
  p.x = 12.5;
  p.y = 1.5;
  p.shieldUntil = 1e9;
  const e = m.enemy("runner", 2.5, 1.5, 2);
  m.enemies = [e];
  for (let i = 0; i < 60; i++) m.tick(1 / 120);
  assert(e.x > 5);
  assert(e.x < 5.5);
  assert.equal(p.status, "alive");
});
test("contact infects before expiry eliminates the player without respawn", () => {
  const [m, p] = match("bio");
  m.enemies = [m.enemy("runner", p.x, p.y, 2)];
  m.nextWave = 1e9;
  m.tick();
  assert.equal(p.status, "trapped");
  assert.equal(p.hp, 4);
  assert(p.infectedUntil > m.time);
  const deadline = p.infectedUntil;
  m.infect(p);
  assert.equal(p.infectedUntil, deadline);
  m.time = deadline;
  m.tick();
  assert.equal(p.status, "dead");
  assert(p.respawnAt > 1e8);
  m.tick();
  assert.equal(m.winner, 1);
});
test("survival timeout wins, boss timeout loses, cooperative departure does not award victory", () => {
  for (const mode of ["bio", "boss"]) {
    const [m] = match(mode);
    m.remaining = 0.001;
    m.tick();
    assert.equal(m.winner, mode === "bio" ? 0 : 1);
  }
  const [m] = match();
  m.addPlayer("q", "Friend", 0);
  m.removePlayer("p");
  assert.equal(m.state, "playing");
});
test("boss telegraphs hostile bombs and becomes more aggressive below half health", () => {
  const [m, p] = match();
  p.shieldUntil = 1e9;
  const e = m.enemies[0];
  e.hp = 8;
  m.nextAttack = 0;
  m.tick();
  assert.equal(e.phase, "rage");
  assert(m.warnings.length >= 1);
  assert(m.nextAttack - m.time <= 3.5);
  for (let i = 0; i < 160; i++) m.tick();
  assert(m.bombs.some((b) => b.owner === "hostile"));
  assert(m.bombs.every((b) => b.explodeAt > b.born));
});

test("dasher warns before sprinting and spitter warns before throwing", () => {
  const [m, p] = match("bio");
  p.shieldUntil = 1e9;
  m.nextWave = 1e9;
  p.x = 12.5;
  p.y = 1.5;
  const dasher = m.enemy("dasher", 2.5, 1.5, 4),
    spitter = m.enemy("spitter", 2.5, 8.5, 4);
  dasher.nextAbility = spitter.nextAbility = 0;
  m.enemies = [dasher, spitter];
  m.tick();
  assert.equal(dasher.phase, "windup");
  assert(m.warnings.length);
  const x = dasher.x;
  for (let i = 0; i < 60; i++) m.tick();
  assert.equal(dasher.x, x);
  for (let i = 0; i < 75; i++) m.tick();
  assert.equal(dasher.phase, "dash");
  assert(dasher.x > x);
});
test("last survivor cannot win by dying on the final timer tick", () => {
  const [m, p] = match("bio");
  m.kill(p);
  m.remaining = 0.001;
  m.tick();
  assert.equal(m.winner, 1);
});

test("an enemy bomb appearing under a player allows exit but not re-entry", () => {
  const [m, p] = match();
  m.enemies = [];
  p.x = 3.5;
  p.y = 3.5;
  m.warnings = [{ id: 1, x: 3, y: 3, until: m.time, power: 1 }];
  m.tick();
  const b = m.bombs[0];
  assert(b);
  assert(p.passes.includes(b.id));
  assert(m.canStand(p, 3.6, 3.5));
  p.x = 5.5;
  p.passes = [];
  assert.equal(m.canStand(p, 3.5, 3.5), false);
});

test("game mode is explicit and the same terrain supports both cooperative rule sets", () => {
  for (const terrain of [...maps.values()].filter((m) => m.mode !== "water11"))
    for (const mode of ["boss", "bio"]) {
      if (modeCompatibility(terrain, mode)) {
        assert.throws(() => mapForMode(terrain, mode));
        continue;
      }
      const selected = mapForMode(terrain, mode);
      assert.equal(selected.id, terrain.id);
      assert.equal(selected.mode, mode);
      if (mode !== "bio") assert.deepEqual(selected.blocks, terrain.blocks);
      else assert(selected.defenseZone);
      assert.equal(selected.bases.length, 0);
      const match = new ExpeditionMatch(selected);
      match.addPlayer("p", "P", 0);
      match.start();
      assert.equal(match.snapshot().mode, mode);
      if (mode === "boss") {
        const boss = match.enemies[0];
        assert.equal(
          match.solid(Math.floor(boss.x), Math.floor(boss.y)),
          false,
        );
      }
    }
  assert(modeCompatibility(maps.get("boss-court"), "classic"));
  assert.throws(() => mapForMode(maps.get("water11_8"), "boss"));
  assert.throws(() => mapForMode(maps.get("garden"), "invalid"));
  assert.equal(mapForMode(maps.get("garden"), "classic").bases.length, 2);
});

test("large maps retain collision, movement and enemy paths beyond the original viewport", () => {
  for (const id of ["boss-ring", "bio-district"]) {
    const map = maps.get(id),
      m = new ExpeditionMatch(map),
      p = m.addPlayer("p", "P", 0);
    m.start();
    m.state = "playing";
    assert.equal(m.blocks.length, map.width * map.height);
    p.x = 17.5;
    p.y = 3.5;
    p.input.dir = "right";
    for (let i = 0; i < 60; i++) m.tick();
    assert(p.x > 19);
    assert(p.x < map.width);
    assert.equal(m.blockAt(map.width, 3), -1);
    m.setBlock(18, 3, 8005);
    assert(m.solid(18, 3));
    m.setBlock(18, 3, 0);
    assert(m.pathTo(m.enemy("runner", 17.5, 3.5, 2), p).length > 0);
    assert(modeCompatibility(map, map.mode === "boss" ? "bio" : "boss"));
  }
});

test("defense purification requires three uninterrupted safe seconds and spends shared charges", () => {
  const [m, p] = match("bio");
  m.nextWave = 1e9;
  m.enemies = [];
  p.x = 2.5;
  p.y = 2.5;
  m.infect(p);
  const charges = m.cureCharges;
  for (let i = 0; i < 240; i++) m.tick();
  assert(p.infectedUntil > 0);
  assert(p.cureProgress > 1.9);
  m.enemies = [m.enemy("runner", p.x + 2, p.y, 2)];
  m.enemies[0].frozenUntil = 1e9;
  m.tick();
  assert.equal(p.cureProgress, 0);
  m.enemies = [];
  for (let i = 0; i < 362; i++) m.tick();
  assert.equal(p.infectedUntil, 0);
  assert.equal(m.cureCharges, charges - 1);
  p.shieldUntil = 0;
  m.cureCharges = 0;
  m.infect(p);
  for (let i = 0; i < 362; i++) m.tick();
  assert(p.infectedUntil > 0);
  assert.equal(p.cureProgress, 0);
});
test("purification skill cures nearby infection and replay resets infection and supplies", () => {
  const [m, p] = match("bio");
  m.nextWave = 1e9;
  p.skill = "purify";
  p.skillLevel = 1;
  m.infect(p);
  const q = m.addPlayer("q", "Q", 0);
  q.shieldUntil = 0;
  q.x = p.x + 0.5;
  q.y = p.y;
  m.infect(q);
  const count = m.cureCharges;
  assert(m.useSkill(p.id));
  assert.equal(p.infectedUntil, 0);
  assert.equal(q.infectedUntil, 0);
  assert.equal(m.cureCharges, count);
  p.infectedUntil = m.time + 3;
  m.cureCharges = 0;
  m.start();
  assert.equal(p.infectedUntil, 0);
  assert.equal(m.cureCharges, m.bioLevel.charges);
});
test("bio difficulty changes pursuit speed, reaction and wave pressure; settings are validated", () => {
  const samples = [];
  for (const difficulty of ["easy", "normal", "hard"]) {
    const m = new ExpeditionMatch(maps.get("bio-district"), false, 42, {
      difficulty,
      infectionSeconds: 20,
    });
    const p = m.addPlayer("p", "P", 0);
    m.start();
    m.state = "playing";
    m.time = 10;
    m.nextWave = 1e9;
    m.blocks.fill(0);
    p.x = 20.5;
    p.y = 10.5;
    p.shieldUntil = 1e9;
    const e = m.enemy("runner", 10.5, 10.5, 2);
    m.enemies = [e];
    for (let i = 0; i < 60; i++) m.tick();
    samples.push(e.x);
    m.spawnWave();
    assert.equal(m.nextWave, m.time + BIO_LEVELS[difficulty].interval);
    assert(m.enemies.every((e) => !m.inDefense(e)));
    assert.equal(m.snapshot().bio.infectionSeconds, 20);
  }
  assert(samples[0] < samples[1] && samples[1] < samples[2]);
  assert.throws(() => validateBioOptions({ difficulty: "unknown" }));
  assert.throws(() => validateBioOptions({ infectionSeconds: 0 }));
});
test("infection expiry takes priority over survival win on the final tick", () => {
  const [m, p] = match("bio");
  p.infectedUntil = m.time + 0.001;
  m.remaining = 0.001;
  m.tick();
  assert.equal(m.winner, 1);
});
test("every bio map has clear spawn cells, two entrances and no enemies spawning in the defense zone", () => {
  for (const terrain of maps.values()) {
    if (modeCompatibility(terrain, "bio")) continue;
    const m = new ExpeditionMatch(mapForMode(terrain, "bio")),
      p = m.addPlayer("p", "P", 0);
    m.start();
    assert(m.inDefense(p));
    for (const [x, y] of m.map.spawns) assert(!m.solid(x, y));
    assert(!m.solid(6, 3));
    assert(!m.solid(3, 6));
    assert(m.solid(6, 2));
    m.spawnWave();
    assert(m.enemies.every((e) => !m.inDefense(e)));
  }
});

test("cooperative bombs and shock do not trap or push teammates, hostile bombs remain dangerous", () => {
  for (const mode of ["boss", "bio"]) {
    const [m, p] = match(mode);
    m.enemies = [];
    const q = m.addPlayer("q", "Q", 0);
    p.x = q.x = 5.5;
    p.y = q.y = 5.5;
    p.shieldUntil = q.shieldUntil = 0;
    m.explode(bomb(m, 5, 5));
    assert.equal(p.status, "alive");
    assert.equal(q.status, "alive");
    m.explode(bomb(m, 5, 5, "shock"));
    assert.equal(p.x, 5.5);
    assert.equal(q.x, 5.5);
    const hostile = bomb(m, 5, 5);
    hostile.owner = "hostile";
    hostile.team = 1;
    m.explode(hostile);
    assert.equal(p.status, "trapped");
  }
});
