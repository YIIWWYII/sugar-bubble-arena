import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Match, RULES } from "../public/engine.mjs";
import { BOT_LEVELS, addBot, tickBot, blastCells } from "../bots.mjs";
const map = JSON.parse(
  readFileSync(new URL("../public/assets/map.json", import.meta.url)),
);

for (const level of Object.keys(BOT_LEVELS))
  test(`${level} AI clears paths, returns three buns and can replay without stat bonuses`, () => {
    for (const seed of [42, 12345, 99]) {
      const match = new Match(map, false, seed);
      match.addPlayer("human", "Human", 0);
      const bot = addBot(match, level),
        p = match.players[1];
      assert.equal(p.speed, RULES.speed);
      assert.equal(p.power, RULES.power);
      assert.equal(p.capacity, RULES.capacity);
      assert(Object.values(p.mods).every((value) => !value));
      match.start();
      for (let i = 0; i < 244 / RULES.tick && match.state !== "finished"; i++) {
        tickBot(match, bot);
        match.tick();
        assert(Number.isFinite(p.x) && Number.isFinite(p.y));
      }
      assert.equal(
        p.captures,
        3,
        `seed ${seed}: AI must finish against an idle opponent`,
      );
      assert.equal(match.winner, 1);
      assert.equal(
        match.snapshot().players.find((q) => q.id === bot.id).bot,
        true,
      );
      match.start();
      const spawn = [p.x, p.y];
      for (let i = 0; i < 8 / RULES.tick; i++) {
        tickBot(match, bot);
        match.tick();
      }
      assert.notDeepEqual([p.x, p.y], spawn);
    }
  });

test("AI escapes a visible incoming blast using normal movement", () => {
  const match = new Match(map);
  match.addPlayer("human", "Human", 0);
  const bot = addBot(match, "hard"),
    p = match.players[1];
  match.start();
  match.state = "playing";
  match.blocks.fill(0);
  p.x = 7.5;
  p.y = 9.5;
  p.shieldUntil = 0;
  match.bombs.push({
    id: 999,
    x: 6,
    y: 9,
    power: 3,
    owner: "human",
    team: 0,
    explodeAt: 1.5,
  });
  for (let i = 0; i < 2 / RULES.tick; i++) {
    tickBot(match, bot);
    match.tick();
  }
  assert.equal(p.status, "alive");
  assert.equal(p.deaths, 0);
});

test("blast prediction respects permanent walls and house corners", () => {
  const match = new Match(map);
  match.blocks.fill(0);
  match.setBlock(7, 9, 8012);
  const ray = blastCells(match, { x: 6, y: 9, power: 5 });
  assert(!ray.some((c) => c.x >= 7));
  assert.throws(() => addBot(match, "invalid"), /difficulty/);
});
