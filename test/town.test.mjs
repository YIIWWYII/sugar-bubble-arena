import test from "node:test";
import assert from "node:assert/strict";
import { TOWN, townWalkable, moveTown, townPath, stepTown, createTownNPCs, tickTownNPC } from "../public/town.mjs";
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

test('target movement routes around fountain and stops exactly without oscillation',()=>{
 const p={x:640,y:570,input:{x:0,y:0}},goal={x:640,y:290};p.path=townPath(p,goal);assert(p.path.length>1);
 for(let i=0;i<1000;i++){stepTown(p,1/60);assert(townWalkable(p.x,p.y));}
 assert(Math.hypot(p.x-goal.x,p.y-goal.y)<.001);assert.equal(p.moving,false);
 for(let i=0;i<100;i++)stepTown(p,.1);assert.equal(p.x,goal.x);assert.equal(p.y,goal.y);
 assert.equal(townPath(p,{x:640,y:430}),null);
});
test('NPCs patrol traversable paths, pause, and continue',()=>{
 const [npc]=createTownNPCs({guide:{name:'向导'}});const first={x:npc.x,y:npc.y};
 for(let i=0;i<300;i++){tickTownNPC(npc,1/60,i*1000/60);assert(townWalkable(npc.x,npc.y));}
 assert(Math.hypot(npc.x-first.x,npc.y-first.y)>10);
});
