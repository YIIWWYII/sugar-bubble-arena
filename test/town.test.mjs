import test from "node:test";
import assert from "node:assert/strict";
import { TOWN, townWalkable, moveTown } from "../public/town.mjs";
test("town blocks buildings, fountain and edges and bounds diagonal speed", () => {
  assert(townWalkable(TOWN.spawn.x, TOWN.spawn.y));
  for (const [x, y] of [
    [200, 200],
    [640, 430],
    [-1, 10],
    [1300, 500],
  ])
    assert(!townWalkable(x, y));
  const p = { x: 640, y: 570, input: { x: 1, y: 1 } };
  moveTown(p, 0.1);
  assert(Math.abs(Math.hypot(p.x - 640, p.y - 570) - 15) < 0.001);
  const wall = { x: 300, y: 338, input: { x: 0, y: -1 } };
  moveTown(wall, 0.1);
  assert.equal(wall.y, 338);
});
