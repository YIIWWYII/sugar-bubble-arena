import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProfileStore } from "../profiles.mjs";
import {
  freshProfile,
  changeProfile,
  publicProfile,
} from "../public/progression.mjs";
import {
  DEFAULT_APPEARANCE,
  NPC_DESIGNS,
  validateAppearance,
} from "../public/appearance.mjs";
import { Match } from "../public/engine.mjs";
const map = JSON.parse(
  readFileSync(new URL("../public/assets/map.json", import.meta.url)),
);
test("old profiles gain defaults without losing resources or unlocked skills", () => {
  const p = freshProfile();
  delete p.collection;
  delete p.appearance;
  delete p.claimed;
  delete p.milestones;
  delete p.skills.ward;
  const view = publicProfile(p);
  assert.equal(view.coins, 60);
  assert.deepEqual(view.collection, []);
  assert.equal(view.skills.ward, 0);
  assert.deepEqual(view.appearance, DEFAULT_APPEARANCE);
});
test("appearance accepts bounded parts and rejects malformed or out of range input", () => {
  const p = freshProfile();
  const appearance = { ...DEFAULT_APPEARANCE, hair: 2, eyes: 2, accessory: 3 };
  changeProfile(p, { type: "appearance", value: appearance });
  assert.deepEqual(p.appearance, appearance);
  assert(p.appearanceConfigured);
  assert.throws(() => validateAppearance({ ...appearance, hair: 99 }));
  assert.throws(() => validateAppearance({ hair: 1 }));
  assert.throws(() => validateAppearance([]));
  for (const npc of Object.values(NPC_DESIGNS))
    assert.doesNotThrow(() => validateAppearance(npc));
});
test("collection records only qualified rounds, rewards and milestones can be claimed once and persist", () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "qqt-collection-"));
  try {
    const file = path.join(temp, "profiles.json"),
      store = new ProfileStore(file),
      id = store.create(),
      m = new Match(map),
      p = m.addPlayer("p", "P", 0);
    m.start();
    m.state = "playing";
    for (const kind of ["haste", "guard", "surge"]) m.collectItem(p, { kind });
    m.time = 20;
    m.finish(0);
    m.practice = true;
    assert.equal(store.reward(id, "practice", m, p), null);
    assert.equal(store.view(id).collection.length, 0);
    m.practice = false;
    store.reward(id, "round", m, p);
    assert.equal(store.view(id).collection.length, 4);
    const before = store.view(id).coins;
    store.change(id, { type: "claim", key: "item:haste" });
    assert.equal(store.view(id).coins, before + 25);
    assert.throws(
      () => store.change(id, { type: "claim", key: "item:haste" }),
      /已领取/,
    );
    assert.throws(
      () => store.change(id, { type: "claim", key: "enemy:boss" }),
      /尚未/,
    );
    assert.throws(
      () => store.change(id, { type: "upgrade", kind: "skill", key: "ward" }),
      /图鉴/,
    );
    store.change(id, { type: "milestone", count: 3 });
    assert.equal(store.view(id).skills.ward, 1);
    assert.throws(
      () => store.change(id, { type: "milestone", count: 3 }),
      /已领取/,
    );
    assert.throws(
      () => store.change(id, { type: "milestone", count: 8 }),
      /不足/,
    );
    const restored = new ProfileStore(file).view(id);
    assert.equal(restored.skills.ward, 1);
    assert.deepEqual(restored.claimed, ["item:haste"]);
    assert.equal(store.reward(id, "round", m, p), null);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
test("limited skills apply protective haste and rescue allies within range", () => {
  const m = new Match(map),
    p = m.addPlayer("p", "P", 0),
    ally = m.addPlayer("a", "Ally", 0);
  m.start();
  m.state = "playing";
  m.time = 10;
  p.skill = "ward";
  p.skillLevel = 1;
  m.useSkill("p");
  assert(p.shieldUntil > m.time);
  assert(p.hasteUntil > m.time);
  p.skill = "purify";
  p.skillReadyAt = 0;
  p.slowUntil = 50;
  ally.status = "trapped";
  ally.x = p.x + 1;
  ally.y = p.y;
  assert(m.useSkill("p"));
  assert.equal(p.slowUntil, 0);
  assert.equal(ally.status, "alive");
  assert(ally.shieldUntil > m.time);
});

test("expanded appearance migrates legacy slots and persists decorations", () => {
  const legacy = {
    hair: 2,
    skin: 1,
    outfit: 3,
    style: 1,
    eyes: 2,
    mouth: 1,
    accessory: 3,
  };
  assert.deepEqual(validateAppearance(legacy), {
    ...DEFAULT_APPEARANCE,
    ...legacy,
  });
  const p = freshProfile();
  p.appearance = legacy;
  assert.deepEqual(publicProfile(p).appearance, {
    ...DEFAULT_APPEARANCE,
    ...legacy,
  });
  const decorated = {
    ...DEFAULT_APPEARANCE,
    ...legacy,
    wings: 3,
    back: 2,
    held: 4,
    shoes: 2,
    aura: 3,
    mount: 2,
  };
  changeProfile(p, { type: "appearance", value: decorated });
  assert.deepEqual(publicProfile(p).appearance, decorated);
  for (const invalid of [{ wings: 5 }, { mount: -1 }, { mount: 1.5 }])
    assert.throws(() => validateAppearance({ ...decorated, ...invalid }));
});
