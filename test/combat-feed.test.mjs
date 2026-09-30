import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Match } from "../public/engine.mjs";
import { ExpeditionMatch } from "../public/expedition.mjs";
import { SurvivorMatch } from "../public/survivor.mjs";
import { BioMatch } from "../public/bio.mjs";
import { WaterMatch } from "../public/water11.mjs";
import { createMaps, mapForMode } from "../public/maps.mjs";
const load = (f) =>
    JSON.parse(
      readFileSync(new URL(`../public/assets/${f}.json`, import.meta.url)),
    ),
  maps = createMaps(load("map"), load("water11"));
const feed = (m) => m.events.filter((e) => e.type === "combat-feed");
test("classic eliminations emit one named feed entry, including self damage", () => {
  const m = new Match(maps.get("bun06_8")),
    p = m.addPlayer("p", "甲", 0),
    q = m.addPlayer("q", "乙", 1);
  m.start();
  m.kill(q, p.id);
  m.kill(q, p.id);
  assert.equal(feed(m).length, 1);
  assert.equal(feed(m)[0].killer, "甲");
  assert.equal(feed(m)[0].victim, "乙");
  m.kill(p, p.id);
  assert.equal(feed(m)[1].action, "误伤自身");
});
test("boss and survivor kills emit a notice only on lethal damage", () => {
  for (const [Engine, id, mode] of [
    [ExpeditionMatch, "boss-court", "boss"],
    [SurvivorMatch, "survivor-grove", "survivor"],
  ]) {
    const m = new Engine(mapForMode(maps.get(id), mode)),
      p = m.addPlayer("p", "甲", 0);
    m.start();
    m.state = "playing";
    const e = m.enemy("runner", 7.5, 7.5, 2);
    m.enemies = [e];
    if (mode === "survivor") {
      m.hit(e, 2, p);
      m.hit(e, 2, p);
    } else {
      m.resolveBlast({ owner: p.id, kind: "normal" }, [{ x: 7, y: 7 }]);
      m.resolveBlast({ owner: p.id, kind: "normal" }, [{ x: 7, y: 7 }]);
    }
    assert.equal(feed(m).length, 1);
    assert.equal(feed(m)[0].killer, "甲");
  }
});
test("bio conversion and zombie elimination produce distinct named notices", () => {
  const m = new BioMatch(mapForMode(maps.get("bio-district"), "bio")),
    p = m.addPlayer("p", "甲", 0);
  m.start();
  m.state = "playing";
  m.phase = "outbreak";
  const e = m.enemies[0];
  m.transform(e, true);
  p.infectedBy = e.id;
  m.transform(p);
  assert.equal(feed(m).at(-1).action, "感染转化");
  m.kill(p, e.id);
  m.kill(p, e.id);
  assert.equal(feed(m).length, 2);
});
test("water sailor defeat emits a kill notice", () => {
  const m = new WaterMatch(maps.get("water11_8")),
    p = m.addPlayer("p", "甲", 0);
  m.start();
  m.state = "playing";
  m.time = 10;
  m.blocks.fill(0);
  Object.assign(m.boss, {
    x: 7.5,
    y: 7.5,
    hp: 1,
    phase: "chase",
    hurtUntil: 0,
  });
  const b = {
    id: ++m.serial,
    x: 7,
    y: 7,
    power: 1,
    owner: p.id,
    team: 0,
    born: 0,
    explodeAt: 10,
  };
  m.bombs.push(b);
  m.explode(b);
  assert.equal(feed(m).length, 1);
  assert.equal(feed(m)[0].victim, "海盗水手");
});
