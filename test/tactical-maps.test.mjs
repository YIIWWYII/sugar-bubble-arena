import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMaps,mapForMode} from '../public/maps.mjs';
import {Match} from '../public/engine.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../public/assets/'+n+'.json',import.meta.url)));
const original=load('map'),water=load('water11'),maps=createMaps(original,water);
function flood(m,start,removed=false,blocked){
 const w=m.width || 15,h=m.height || 13,seen=new Set(),queue=[start];
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i],k=y*w+x;if(x<0||y<0||x>=w||y>=h||seen.has(k)||k===blocked)continue;
  const b=m.blocks[k];if(b && !(removed && b>=8001 && b<=8004))continue;
  seen.add(k);queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
 }
 return seen;
}
test('original asset maps are preserved',()=>{assert.deepEqual(maps.get(original.id).blocks,original.blocks);assert.deepEqual(maps.get(water.id).objects,water.objects);});
test('all designed maps have reachable spawns and supply stations without demolition',()=>{
 for(const m of maps.values())if(m.strategy){
  const seen=flood(m,m.spawns[0]);
  for(const [x,y] of m.spawns)assert.ok(seen.has(y*m.width+x),m.id+' spawn '+x+','+y);
  for(const n of m.supplyNodes || [])assert.ok(seen.has(n.y*m.width+n.x),m.id+' supply '+n.x+','+n.y);
  const opened=flood(m,m.spawns[0],true);
  for(let i=0;i<m.blocks.length;i++)if(m.blocks[i]===0)assert.ok(opened.has(i),m.id+' isolated cell '+i);
 }
});
test('classic layouts and renewable supplies are symmetric for both teams',()=>{
 for(const m of maps.values())if(m.strategy && m.supportedModes.includes('classic')){
  for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)assert.equal(m.blocks[y*m.width+x],m.blocks[y*m.width+m.width-1-x],m.id);
  for(const n of m.supplyNodes)assert.ok(m.supplyNodes.some(p=>p.x===m.width-1-n.x && p.y===n.y && p.kind===n.kind && p.interval===n.interval),m.id);
 }
});
test('bio layouts survive mode selection and forts have two independent exits',()=>{
 for(const m of maps.values())if(m.supportedModes?.includes('bio')){
  const selected=mapForMode(m,'bio');assert.deepEqual(selected.blocks,m.blocks,m.id);assert.ok(m.width>=25);
  for(const blocked of [3*m.width+6,6*m.width+3])assert.ok(flood(m,[3,3],false,blocked).size>100,m.id);
 }
});
test('renewable supplies refill without stacking and reset next round',()=>{
 const m=new Match(mapForMode(maps.get('garden'),'classic'),true);m.addPlayer('p','p',0);m.start();m.state='playing';
 const n=m.map.supplyNodes[0];m.time=m.supplySchedule[0];m.tick(0);
 assert.equal(m.items.filter(i=>i.supplyNode===0).length,1);
 m.time+=n.interval;m.tick(0);assert.equal(m.items.filter(i=>i.supplyNode===0).length,1);
 m.items=m.items.filter(i=>i.supplyNode!==0);m.time+=n.interval;m.tick(0);assert.equal(m.items.filter(i=>i.supplyNode===0).length,1);
 m.start();assert.equal(m.items.filter(i=>i.supplyNode!==undefined).length,0);assert.equal(m.supplySchedule[0],3+n.first);
});

test('demolishing ring side gates opens a real shortcut while hard cover survives',()=>{
 const map=maps.get('boss-ring'),m=new Match({...map,mode:'classic'},true);m.addPlayer('p','P',0);m.start();
 const x=Math.floor(map.width/2)-6,y=Math.floor(map.height/2);
 assert.equal(m.blockAt(x,y),8001);assert.equal(m.blockAt(x,y-3),8005);
 const player=m.players[0];player.x=x-.5;player.y=y+.5;player.power=2;m.state='playing';assert.ok(m.placeBomb(player));m.explode(m.bombs.at(-1));
 assert.equal(m.blockAt(x,y),0);assert.equal(m.blockAt(x,y-3),8005);
});
