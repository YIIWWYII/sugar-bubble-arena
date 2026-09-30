import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Match, RULES } from "../public/engine.mjs";
import { createMaps, modeCompatibility, mapForMode } from "../public/maps.mjs";
import {
  freshProfile,
  changeProfile,
  roundReward,
  TEMP_ITEMS,
  SKILLS,
} from "../public/progression.mjs";
import { ProfileStore } from "../profiles.mjs";
import { WaterMatch } from "../public/water11.mjs";
import { ExpeditionMatch } from "../public/expedition.mjs";
import { addBot, tickBot } from "../bots.mjs";
const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`../public/assets/${name}.json`, import.meta.url)),
  );
const maps = createMaps(read("map"), read("water11"));
const setup = () => {
  const match = new Match(maps.get("garden"));
  match.addPlayer("p", "Player", 0);
  match.addPlayer("other", "Other", 1);
  match.start();
  match.state = "playing";
  return match;
};

test("persistent profile atomically charges upgrades, restores identity and awards each round once", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "qqt-profile-")),
    filename = path.join(dir, "profiles.json");
  try {
    const store = new ProfileStore(filename),
      id = store.create();
    assert.equal(store.identify(`other=a; qqt_profile=${id}`), id);
    assert.equal(store.identify("qqt_profile=missing"), null);
    assert.equal(store.view(id).coins, 60);
    store.change(id, { type: "upgrade", kind: "attribute", key: "speed" });
    assert.equal(store.view(id).coins, 20);
    assert.equal(store.view(id).attributes.speed, 1);
    assert.throws(
      () =>
        store.change(id, { type: "upgrade", kind: "attribute", key: "speed" }),
      /不足/,
    );
    assert.equal(new ProfileStore(filename).view(id).coins, 20);
    assert.throws(
      () => store.change(id, { type: "equip", key: "rescue" }),
      /解锁/,
    );
    const m = setup();
    m.time = 40;
    m.finish(0);
    const player = m.players[0];
    const award = store.reward(id, "round:1", m, player, "normal");
    assert.equal(award.reward.coins, 50);
    assert.equal(store.reward(id, "round:1", m, player, "normal"), null);
    assert.equal(new ProfileStore(filename).view(id).matches, 1);
    assert.equal(new ProfileStore(filename).view(id).coins, 70);
    store.change(id, { type: "upgrade", kind: "skill", key: "shield" });
    store.change(id, { type: "equip", key: "shield" });
    assert.equal(new ProfileStore(filename).view(id).equipped, "shield");
    const before = store.view(id);
    assert.throws(() =>
      store.change(id, { type: "upgrade", kind: "skill", key: "__proto__" }),
    );
    assert.deepEqual(store.view(id), before);
  } finally {
    unlinkSync(filename);
    rmdirSync(dir);
  }
});

test("practice, countdown exits and forfeits cannot issue resources; completed losses can", () => {
  const m = setup(),
    p = m.players[0];
  m.time = 40;
  m.finish(1);
  assert.equal(roundReward(m, p).coins, 25);
  m.practice = true;
  assert.equal(roundReward(m, p), null);
  m.practice = false;
  m.reason = "对方已离开";
  assert.equal(roundReward(m, p), null);
  m.reason = "时间到";
  m.time = 3;
  assert.equal(roundReward(m, p), null);
});

test("permanent attributes survive death and restart, temporary pickups do not", () => {
  const m = setup(),
    p = m.players[0],
    profile = freshProfile();
  profile.attributes = { speed: 3, power: 2, capacity: 2 };
  m.setLoadout(p.id, profile);
  m.start();
  m.state = "playing";
  assert.equal(p.speed, 5.75);
  assert.equal(p.power, 3);
  assert.equal(p.capacity, 4);
  m.collectItem(p, { kind: "speed" });
  m.collectItem(p, { kind: "haste" });
  assert(m.movementSpeed(p) > p.speed);
  m.kill(p);
  assert.equal(p.speed, 5.75);
  assert.equal(p.hasteUntil, 0);
  m.spawn(p);
  assert.equal(p.power, 3);
  m.start();
  assert.equal(p.capacity, 4);
});

for (const key of Object.keys(SKILLS))
  test(`${key} skill enforces unlock, state and cooldown and benefits from upgrades`, () => {
    const m = setup(),
      p = m.players[0],
      profile = freshProfile();
    profile.skills[key] = 3;
    profile.equipped = key;
    m.setLoadout(p.id, profile);
    m.time = 5;
    if (key === "rescue") {
      assert(!m.useSkill(p.id));
      p.status = "trapped";
    }
    assert(m.useSkill(p.id));
    assert(!m.useSkill(p.id));
    assert.equal(p.skillReadyAt, 5 + SKILLS[key].cooldown[2]);
    if (key === "rescue") assert.equal(p.status, "alive");
    if (key === "shield") assert.equal(p.shieldUntil, 7);
    if (key === "sprint") {
      assert.equal(p.hasteUntil, 9);
      m.time = 10;
      assert.equal(m.movementSpeed(p), p.speed);
    }
    if (key === "magnet") assert.equal(p.magnetUntil, 10);
    m.start();
    assert.equal(p.skillReadyAt, 0);
    assert(!m.useSkill(p.id), "not usable during countdown");
  });

test("temporary pickups expire, surge belongs to placed bomb, magnet excludes hidden loot and traps", () => {
  const m = setup(),
    p = m.players[0];
  m.blocks.fill(0);
  p.x = 7.5;
  p.y = 9.5;
  m.time = 10;
  for (const kind of Object.keys(TEMP_ITEMS)) m.collectItem(p, { kind });
  assert.equal(p.hasteUntil, 16);
  assert.equal(p.shieldUntil, 13);
  assert.equal(p.surgeUntil, 18);
  assert.equal(p.magnetUntil, 18);
  assert(m.placeBomb(p));
  assert.equal(m.bombs[0].power, p.power + 2);
  assert.equal(m.bombs[0].bonusPower, 2);
  m.items = [
    { id: 500, x: 8, y: 9, kind: "power", availableAt: 0 },
    { id: 501, x: 7, y: 10, kind: "banana-trap", availableAt: 0 },
  ];
  const power = p.power;
  m.objectives(p);
  assert.equal(p.power, power + 1);
  assert.equal(m.items.length, 1);
  assert.equal(m.items[0].kind, "banana-trap");
  m.time = 20;
  m.items.push({ id: 502, x: 8, y: 9, kind: "power", availableAt: 0 });
  m.objectives(p);
  assert.equal(m.items.length, 2);
  assert.equal(m.movementSpeed(p), p.speed);
});

for (const id of ["garden", "harbor", "frost"])
  test(`${id} map has valid spawns, connected objectives, visible supplies and playable AI`, () => {
    const map = maps.get(id),
      m = new Match(map, false, 42);
    assert.equal(map.blocks.length, 195);
    assert.equal(map.ground.length, 195);
    for (const [x, y] of map.spawns) {
      assert(!m.solid(x, y));
      assert(m.canStand({ passes: [], wallPasses: [] }, x + 0.5, y + 0.5));
    }
    m.addPlayer("p", "Player", 0);
    const bot = addBot(m, "normal");
    m.start();
    for (const item of map.temporarySpawns)
      assert(
        m.items.some(
          (i) => i.kind === item.kind && i.x === item.x && i.y === item.y,
        ),
      );
    for (let i = 0; i < 244 / RULES.tick && m.state !== "finished"; i++) {
      tickBot(m, bot);
      m.tick();
    }
    assert.equal(m.players[1].captures, 3);
    assert(m.time >= 18);
    assert.equal(m.winner, 1);
  });

test("skill and attribute levels cannot exceed their configured limits", () => {
  const p = freshProfile();
  p.coins = 10000;
  p.gems = 1000;
  for (let i = 0; i < 3; i++)
    changeProfile(p, { type: "upgrade", kind: "attribute", key: "speed" });
  assert.throws(
    () =>
      changeProfile(p, { type: "upgrade", kind: "attribute", key: "speed" }),
    /最高/,
  );
  for (let i = 0; i < 2; i++)
    changeProfile(p, { type: "upgrade", kind: "skill", key: "sprint" });
  assert.throws(
    () => changeProfile(p, { type: "upgrade", kind: "skill", key: "sprint" }),
    /最高/,
  );
});

const themedMapIds = [
  "forest-crossing",
  "dune-market",
  "boss-caldera",
  "boss-ruins",
  "bio-forest",
  "bio-mine",
  "water-reef",
  "water-ice",
];
test("new themed maps have valid spawns, reachable supplies and connected traversable terrain", () => {
  for (const id of themedMapIds) {
    const terrain = maps.get(id),
      mode = terrain.mode === "water11" ? "water11" : terrain.mode || "classic";
    const map = mapForMode(terrain, mode),
      Type =
        mode === "water11"
          ? WaterMatch
          : mode === "classic"
            ? Match
            : ExpeditionMatch,
      m = new Type(map);
    m.addPlayer("p", "P", 0);
    m.start();
    for (const [x, y] of map.spawns)
      assert(!m.solid(x, y), `${id}: blocked spawn ${x},${y}`);
    for (let i = 0; i < m.blocks.length; i++)
      if (m.blocks[i] >= 8001 && m.blocks[i] <= 8004) m.blocks[i] = 0;
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
          key = `${x},${y}`;
        if (!m.solid(x, y) && !seen.has(key)) {
          seen.add(key);
          q.push([x, y]);
        }
      }
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++)
        if (!m.solid(x, y))
          assert(seen.has(`${x},${y}`), `${id}: isolated ${x},${y}`);
    for (const item of map.temporarySpawns || [])
      assert(seen.has(`${item.x},${item.y}`));
    m.state = "playing";
    for (let i = 0; i < 1200; i++) m.tick();
    if (mode === "water11") assert(m.boss.hp > 0);
    if (mode === "bio") assert(m.enemies.length > 0);
  }
});
test("every game mode has a curated multi-map catalogue and rejects unrelated terrain", () => {
  for (const mode of ["classic", "boss", "bio", "water11"])
    assert(
      [...maps.values()].filter((m) => !modeCompatibility(m, mode)).length >= 3,
    );
  assert(modeCompatibility(maps.get("forest-crossing"), "boss"));
  assert(modeCompatibility(maps.get("water-reef"), "bio"));
  assert(modeCompatibility(maps.get("boss-caldera"), "classic"));
});
