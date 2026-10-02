import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalSession} from '../public/local-session.mjs';
import {createMaps} from '../public/maps.mjs';
import {freshProfile,SKILLS} from '../public/progression.mjs';
import {CHARACTERS} from '../public/characters.mjs';
const load=n=>JSON.parse(readFileSync(new URL(`../public/assets/${n}.json`,import.meta.url)));
const maps=createMaps(load('map'),load('water11'));
function start(map,character,practice=false){
 const profile=freshProfile();profile.character=character;const errors=[];
 const s=new LocalSession(maps,profile,m=>{if(m.type==='error')errors.push(m.message);});
 const mode=map.mode||'classic';s.receive({type:'create',mode,mapId:map.id,solo:true,practice,aiLevel:mode==='classic'&&!practice?'normal':undefined});
 assert.deepEqual(errors,[]);return {s,m:s.match,p:s.match.players[0],errors};
}
function choose(s,p){const b=p.bioBuild||p.run;if(s.match.state==='playing'&&p.status!=='dead'&&b?.offers.length)s.receive({type:'survivor-pick',key:b.offers[0],offerId:b.offerId});}
test('survivor tactical bubbles apply advertised control to ordinary enemies and bosses',()=>{
 const {s,m,p}=start(maps.get('survivor-grove'),'sea',true);
 for(let i=0;i<400;i++){choose(s,p);s.tick();}m.time=10;
 m.blocks.fill(0);m.enemies=[];
 for(const kind of ['runner','boss']){
  const enemy=m.enemy(kind,10.5,10.5,30);m.enemies=[enemy];
  m.resolveBlast({kind:'frost',owner:p.id,x:9,y:10},[{x:10,y:10}]);assert.equal(enemy.frozenUntil,10+(kind==='boss'?1.2:2.5));
  m.resolveBlast({kind:'shock',owner:p.id,x:9,y:10},[{x:10,y:10}]);assert.equal(enemy.stunUntil,10.8);assert(Math.abs(enemy.x-10.5-(kind==='boss'?1:2))<.001);
 }
});
for(const map of maps.values())test(`all four characters complete startup and combat simulation on ${map.id}`,()=>{
 for(const id of Object.keys(CHARACTERS)){
  const {s,m,p,errors}=start(map,id);
  for(let frame=0;frame<4200&&m.state!=='finished';frame++){
   choose(s,p);
   if(frame%60===0)s.receive({type:'input',dir:['down','right','up','left'][Math.floor(frame/60)%4],bomb:frame%120===0});
   s.tick();
   assert(Number.isFinite(p.x)&&Number.isFinite(p.y),`${id} position`);
   assert(p.x>=0&&p.x<m.width&&p.y>=0&&p.y<m.height,`${id} map bounds`);
   for(const e of m.enemies||[])assert(Number.isFinite(e.hp)&&Number.isFinite(e.x)&&Number.isFinite(e.y),`${id} enemy state`);
  }
  assert(m.time>3,`${id} clock must advance`);assert.deepEqual(errors,[]);
  s.receive({type:'leave'});assert.equal(s.match,null);
 }
});
for(const [mode,mapId] of Object.entries({classic:'garden',boss:'boss-ring',bio:'bio-lab',survivor:'survivor-grove',water11:'water-reef'}))test(`all growth skills activate and cool down in ${mode}`,()=>{
 for(const skill of Object.keys(SKILLS)){
  const {s,m,p}=start(maps.get(mapId),'sea',true);
  for(let i=0;i<400;i++){choose(s,p);s.tick();}
  m.state='playing';m.time=10;p.skill=skill;p.skillLevel=3;p.skillReadyAt=0;
  if(skill==='rescue'&&!['bio','survivor'].includes(mode))p.status='trapped';
  assert.equal(m.useSkill(p.id),true,skill);assert.equal(m.useSkill(p.id),false,`${skill} cooldown`);
  assert.equal(p.skillReadyAt,10+SKILLS[skill].cooldown[2]);
  if(['ward','shield','rescue','purify'].includes(skill))assert(p.shieldUntil>10,skill);
  if(['ward','sprint'].includes(skill))assert(p.hasteUntil>10,skill);
  if(skill==='magnet')assert(p.magnetUntil>10);
 }
});
