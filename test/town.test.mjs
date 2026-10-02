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


test('town residents stop for activities, converse in range and resume walking', async()=>{
  const {createTownNPCs,tickTownNPC,talkTownNPC}=await import('../public/town.mjs');
  const npcs=createTownNPCs({a:{name:'居民'}}),n=npcs[0];
  let now=10000;
  for(let i=0;i<600 && !n.activity?.includes('装备');i++){now+=100;tickTownNPC(n,.1,now);}
  assert.equal(n.activity,'整理装备');assert.equal(n.moving,false);assert.ok(n.bubble);
  assert.equal(talkTownNPC(npcs,{x:0,y:0},n.id,now),false);
  assert.equal(talkTownNPC(npcs,{x:n.x+20,y:n.y},n.id,now),true);
  const first=n.bubble;assert.equal(n.activity,'交谈');assert.equal(n.dir,0);
  assert.equal(talkTownNPC(npcs,n,n.id,now+100),false);
  assert.equal(talkTownNPC(npcs,n,n.id,now+800),true);assert.notEqual(n.bubble,first);
  tickTownNPC(n,.1,now+1000);assert.equal(n.moving,false);
  tickTownNPC(n,.1,now+8000);assert.equal(n.activity,'散步');assert.ok(n.path.length);
});


test('clicking each building routes to a walkable doorway',async()=>{
 const {TOWN_BUILDINGS,TOWN,townEntrance,townClickedBuilding,townPath,townWalkable}=await import('../public/town.mjs');
 for(const b of TOWN_BUILDINGS){
  assert.equal(townClickedBuilding({x:b.x+b.w/2,y:b.y+b.h-20}),b);
  const goal=townEntrance(b);assert.ok(townWalkable(goal.x,goal.y));
  const path=townPath(TOWN.spawn,goal);assert.ok(path?.length);assert.deepEqual(path.at(-1),goal);
 }
});


test('each resident has twelve ordinary lines and rare dialogue cannot repeat',async()=>{
 const {talkTownNPC}=await import('../public/town.mjs');
 const npcs=createTownNPCs(Object.fromEntries(['a','b','c','d','e'].map(k=>[k,{name:k}])));
 for(const n of npcs){
  const lines=new Set();
  for(let i=0;i<12;i++){assert.ok(talkTownNPC(npcs,n,n.id,10000+i*1000,()=>1));lines.add(n.bubble);}
  assert.equal(lines.size,12);
 }
 const n=npcs[1];
 assert.ok(talkTownNPC(npcs,n,n.id,30000,()=>0));assert.equal(n.rareSpoken,true);
 const rare=n.bubble;assert.ok(n.bubbleUntil>=30000+rare.length*220);
 assert.ok(talkTownNPC(npcs,n,n.id,31000,()=>0));assert.notEqual(n.bubble,rare);
});
