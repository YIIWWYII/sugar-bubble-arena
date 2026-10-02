import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LocalSession } from '../public/local-session.mjs';
import { createMaps } from '../public/maps.mjs';
import { SKILLS, TEMP_ITEMS, freshProfile } from '../public/progression.mjs';
import { saveEnvelope, validateSave, readLocalProfile, writeLocalProfile, LOCAL_SAVE_KEY } from '../public/local-profile.mjs';
const maps = createMaps(JSON.parse(readFileSync(new URL('../public/assets/map.json',import.meta.url))),JSON.parse(readFileSync(new URL('../public/assets/water11.json',import.meta.url))));
const fixture = () => {
  const packets = [], session = new LocalSession(maps,freshProfile(),p => packets.push(structuredClone(p)));
  return {session,packets};
};
for (const [mode,mapId] of Object.entries({classic:'bun06_8',boss:'boss-court',bio:'bio-lab',survivor:'survivor-grove',water11:'water11_8'})) {
  test(`browser engine starts and advances ${mode} without a server`,() => {
    const {session,packets} = fixture();
    session.receive({type:'create',mode,mapId,aiLevel:mode === 'classic'?'normal':undefined,solo:true});
    assert.equal(packets.find(p => p.type === 'error'),undefined);
    assert.ok(packets.some(p => p.type === 'joined'));
    for(let i=0;i<1200;i++) {
      const m=session.match;
      const p=m.players.find(p=>p.id===session.id), build=p.bioBuild || p.run;
      if (build?.offers.length) session.receive({type:'survivor-pick',key:build.offers[0],offerId:build.offerId});
      session.tick();
    }
    assert.ok(session.match.players.some(p=>p.id===session.id));
    assert.ok(session.match.time > 1, 'simulation advances after choices');
    assert.ok(['countdown','playing','finished'].includes(session.match.state));
    session.receive({type:'leave'});
    assert.equal(session.match,null);
  });
}
test('local mode rejects all multiplayer entry points',() => {
  const {session,packets}=fixture();
  for (const msg of [{type:'join',code:'123456'},{type:'chat',text:'hello'},{type:'create',mode:'classic',mapId:'bun06_8'}]) {
    session.receive(msg); assert.equal(packets.at(-1).message,'暂未开放，敬请等待');
  }
  assert.equal(session.match,undefined);
});
test('appearance is persisted; one completed round earns resources exactly once',() => {
  const {session,packets}=fixture();
  session.receive({type:'profile-change',action:{type:'appearance',value:{...session.profile.appearance,wings:1}}});
  assert.equal(packets.at(-1).save.appearanceConfigured,true);
  session.receive({type:'create',mode:'classic',mapId:'bun06_8',aiLevel:'hard'});
  session.match.time=30;session.match.state='finished';session.match.winner=0;
  session.settle();session.settle();
  const reward=packets.filter(p=>p.type==='round-reward');
  assert.equal(reward.length,1);assert.equal(reward[0].profile.matches,1);
  assert.ok(reward[0].profile.coins>60);assert.ok(reward[0].profile.collection.includes('enemy:bot'));
  session.receive({type:'return'});assert.equal(session.match.roundId,2);
  assert.equal(session.profile.matches,1);
});
test('practice earns no resources and invalid imports preserve the old save',() => {
  const {session,packets}=fixture();
  session.receive({type:'create',mode:'classic',mapId:'bun06_8',practice:true});
  session.match.time=30;session.match.state='finished';session.match.winner=0;session.settle();
  assert.ok(!packets.some(p=>p.type==='round-reward'));
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  writeLocalProfile(freshProfile(),storage);
  const before=data.get(LOCAL_SAVE_KEY);
  for (const profile of [{...freshProfile(),coins:-1},{...freshProfile(),skills:{}},{...freshProfile(),equipped:'bad'},{...freshProfile(),collection:['bad']}]) {
    assert.throws(()=>writeLocalProfile(profile,storage));assert.equal(data.get(LOCAL_SAVE_KEY),before);
  }
  assert.deepEqual(validateSave(JSON.parse(before)),readLocalProfile(storage));
  assert.throws(()=>validateSave({...saveEnvelope(freshProfile()),version:2}));
});


test('server release gate blocks rooms and town while allowing AI',async () => {
  const {spawn} = await import('node:child_process');
  const {mkdtemp,rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {default:path} = await import('node:path');
  const {WebSocket} = await import('ws');
  const temp=await mkdtemp(path.join(tmpdir(),'bubble-gate-')),port=18931;
  const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,MULTIPLAYER_ENABLED:'false',PORT:String(port),PUBLIC_ORIGIN:'',PROFILE_FILE:path.join(temp,'profiles.sqlite')},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let ws;
  try {
    await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`server exit ${code}`)));});
    const info=await fetch(`http://localhost:${port}/api/info`).then(r=>r.json());
    assert.equal(info.multiplayerEnabled,false);
    ws=new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
    const request=(msg,type)=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ws.off('message',receive);reject(Error('protocol timeout'));},3000);
      const receive=raw=>{const packet=JSON.parse(raw);if(packet.type===type){clearTimeout(timer);ws.off('message',receive);resolve(packet);}};
      ws.on('message',receive);ws.send(JSON.stringify(msg));
    });
    for(const msg of [{type:'create'},{type:'join',code:'123456'},{type:'town-enter'},{type:'chat',text:'test'}]) assert.equal((await request(msg,'error')).message,'暂未开放，敬请等待');
    assert.equal((await request({type:'create',mode:'classic',mapId:'bun06_8',aiLevel:'easy'},'joined')).type,'joined');
    const lobby=await fetch(`http://localhost:${port}/api/rooms`).then(r=>r.json());
    assert.deepEqual(lobby.rooms,[]);assert.equal(lobby.online,0);
  } finally {
    ws?.terminate();
    await new Promise(resolve=>{server.once('exit',resolve);server.kill();});
    await rm(temp,{recursive:true,force:true});
  }
});


test('local town moves inhabitants and stops the player at the clicked destination',()=>{
  const {session,packets}=fixture(); session.receive({type:'town-enter'});
  const npc=session.townNPCs[0], origin={x:npc.x,y:npc.y};
  session.receive({type:'town-target',x:680,y:570,command:1});
  assert.equal(packets.find(p=>p.type==='town-target-result').accepted,true);
  for(let i=0;i<360;i++)session.tick();
  assert.equal(session.town.x,680);assert.equal(session.town.y,570);
  assert.equal(session.town.moving,false);assert.notDeepEqual({x:npc.x,y:npc.y},origin);
  session.receive({type:'town-leave'});assert.equal(session.town,null);
});
for(const [mode,mapId] of Object.entries({boss:'boss-court',bio:'bio-lab',survivor:'survivor-grove',water11:'water11_8'})){
  test(`${mode} practice starts and never grants persistent rewards`,()=>{
    const {session,packets}=fixture();session.receive({type:'create',mode,mapId,practice:true});
    assert.ok(session.match);assert.equal(packets.find(p=>p.type==='error'),undefined);
    session.match.state='finished';session.match.time=60;session.match.winner=0;session.settle();
    assert.ok(!packets.some(p=>p.type==='round-reward'));
  });
}


for(const [mode,mapId] of Object.entries({classic:'bun06_8',boss:'boss-court',bio:'bio-lab',survivor:'survivor-grove',water11:'water11_8'})) {
  test(`${mode} applies every equipped skill and all temporary pickups`,()=>{
    const {session}=fixture();session.receive({type:'create',mode,mapId,practice:true});
    const m=session.match,p=m.players[0];m.state='playing';m.time=10;
    const build=p.bioBuild || p.run;
    while(build?.offers.length)m.choose(p.id,build.offers[0],build.offerId);
    for(const key of Object.keys(SKILLS)) {
      p.skill=key;p.skillLevel=3;p.skillReadyAt=0;p.status=key==='rescue'&&!['bio','survivor'].includes(mode)?'trapped':'alive';
      p.shieldUntil=p.hasteUntil=p.magnetUntil=0;p.slowUntil=20;
      assert.equal(m.useSkill(p.id),true,`${key} activates`);
      assert.equal(m.useSkill(p.id),false,`${key} respects cooldown`);
      assert.equal(p.skillReadyAt,10+SKILLS[key].cooldown[2]);
      if(['shield','ward','purify','rescue'].includes(key))assert.ok(p.shieldUntil>10);
      if(['sprint','ward'].includes(key))assert.ok(m.movementSpeed(p)>p.speed);
      if(key==='purify'||key==='rescue')assert.equal(p.slowUntil,0);
      if(key==='magnet')assert.ok(p.magnetUntil>10);
    }
    for(const kind of Object.keys(TEMP_ITEMS))m.collectItem(p,{kind});
    for(const field of ['hasteUntil','shieldUntil','surgeUntil','magnetUntil'])assert.ok(p[field]>m.time,field);
  });
}


test('local town chat accepts text and emotes, preserves history and stays town-only',()=>{
 const {session,packets}=fixture();session.receive({type:'town-enter'});
 session.receive({type:'chat',text:'你好'});session.receive({type:'chat',text:'😊'});
 assert.ok(packets.some(p=>p.type==='chat' && p.text==='你好' && p.scope==='town'));
 assert.ok(packets.some(p=>p.type==='chat' && p.text==='😊'));
 session.receive({type:'town-leave'});session.receive({type:'town-enter'});
 assert.ok(packets.findLast(p=>p.type==='town-history').messages.some(p=>p.text==='你好'));
 for(let i=0;i<40;i++)session.receive({type:'chat',text:String(i)});
 assert.equal(session.townChat.length,30);
 session.receive({type:'town-leave'});session.receive({type:'chat',text:'outside'});
 assert.equal(packets.at(-1).type,'error');
});


test('friend gifts only commit after saving and duplicate requests never double charge',()=>{
 const {session,packets}=fixture(),id='npc-easy';
 session.receive({type:'friend-action',requestId:'gift-1',action:{type:'gift',id,gift:'candy'}});
 const proposal=packets.at(-1);assert.equal(proposal.type,'friend-proposal');
 assert.equal(session.profile.coins,60);assert.equal(proposal.save.coins,45);
 session.receive({type:'friend-commit',requestId:'gift-1',success:false});assert.equal(session.profile.coins,60);
 session.receive({type:'friend-action',requestId:'gift-2',action:{type:'gift',id,gift:'candy'}});
 session.receive({type:'friend-commit',requestId:'gift-2',success:true});assert.equal(session.profile.coins,45);
 session.receive({type:'friend-action',requestId:'gift-2',action:{type:'gift',id,gift:'candy'}});assert.equal(packets.at(-1).type,'error');assert.equal(session.profile.coins,45);
 session.receive({type:'friend-action',requestId:'gift-3',action:{type:'gift',id,gift:'ribbon'}});assert.equal(packets.at(-1).type,'error');assert.equal(session.profile.coins,45);
});
test('friendship records survive export and old saves get an empty contact list',async()=>{
 const {changeFriendship}=await import('../public/friendship.mjs');const p=freshProfile();
 changeFriendship(p,{type:'gift',id:'npc-easy',gift:'tea'});
 changeFriendship(p,{type:'gift',id:'npc-easy',gift:'candy'});
 changeFriendship(p,{type:'settings',id:'npc-easy',alias:'小队员',relation:'friend'});
 assert.deepEqual(validateSave(saveEnvelope(p)).social,p.social);
 const old=freshProfile();delete old.social;assert.deepEqual(validateSave(saveEnvelope(old)).social.contacts,{});
 assert.throws(()=>changeFriendship(p,{type:'relation',id:'npc-easy',value:'confidant'}));
 assert.throws(()=>validateSave(saveEnvelope({...p,social:{nickname:'玩家',contacts:{bad:{}}}})));
});
test('friend chat affinity is capped per day and gifts cap at 200',async()=>{
 const {changeFriendship}=await import('../public/friendship.mjs');const p=freshProfile(),action={type:'chat',id:'npc-easy'};
 for(let i=0;i<20;i++)changeFriendship(p,action,Date.UTC(2026,9,2));assert.equal(p.social.contacts['npc-easy'].affinity,5);
 changeFriendship(p,action,Date.UTC(2026,9,3));assert.equal(p.social.contacts['npc-easy'].affinity,6);
 p.social.contacts['npc-easy'].affinity=199;changeFriendship(p,{type:'gift',id:'npc-easy',gift:'candy'});assert.equal(p.social.contacts['npc-easy'].affinity,200);
 const before=p.coins;assert.throws(()=>changeFriendship(p,{type:'gift',id:'npc-easy',gift:'candy'}));assert.equal(p.coins,before);
});


test('player identity remains distinct even when nickname equals an NPC name',()=>{
 const {session,packets}=fixture();session.profile.social.nickname='巡逻队员';session.receive({type:'town-enter'});
 session.receive({type:'chat',text:'same name'});
 assert.equal(packets.find(p=>p.type==='chat'&&p.text==='same name').kind,'player');
 assert.ok(packets.some(p=>p.type==='chat'&&p.kind==='npc'));
});


test('town identities match social contacts without renaming battle designs',async()=>{
  const {FRIENDS}=await import('../public/friendship.mjs');
  const {NPC_DESIGNS}=await import('../public/appearance.mjs');
  const {session}=fixture();
  assert.equal(new Set(session.townNPCs.map(n=>n.name)).size,5);
  for(const npc of session.townNPCs){assert.equal(npc.name,FRIENDS[npc.id].name);assert.notEqual(npc.name,NPC_DESIGNS[npc.id.slice(4)].name);}
});
test('local item commands consume inventory and create the expected effects',()=>{
  const {session}=fixture();session.receive({type:'create',mode:'classic',mapId:'bun06_8',practice:true});
  const m=session.match,p=m.players.find(p=>p.id===session.id);m.state='playing';p.forks=1;p.bananas=1;p.smiles=1;
  p.status='trapped';session.receive({type:'use-fork'});assert.equal(p.status,'alive');assert.equal(p.forks,0);
  m.items=[];session.receive({type:'place-banana'});assert.equal(p.bananas,0);assert.equal(m.items.at(-1).kind,'banana-trap');
  m.items=[];session.receive({type:'place-smile'});assert.equal(p.smiles,0);assert.equal(m.items.at(-1).kind,'smile-trap');
});

for(const mode of ['classic','boss','bio','survivor','water11']) {
  test(`character templates affect stats, health, bubbles and skills in ${mode}`,async()=>{
    const {CHARACTERS}=await import('../public/characters.mjs');
    const ids={classic:'bun06_8',boss:'boss-court',bio:'bio-lab',survivor:'survivor-grove',water11:'water11_8'};
    for(const [id,hero] of Object.entries(CHARACTERS)){
      const {session}=fixture();session.profile.character=id;
      session.receive({type:'create',mode,mapId:ids[mode],solo:true,aiLevel:mode==='classic'?'easy':undefined});
      const m=session.match,p=m.players.find(p=>p.id===session.id);
      assert.equal(p.character,id);assert.equal(p.speed,5+hero.speed);const expedition=['boss','bio','survivor'].includes(mode);assert.equal(p.capacity,(expedition?3:2)+hero.capacity);assert.equal(p.power,(expedition?2:1)+hero.power);
      if(mode==='survivor'){assert.equal(p.run.maxHp,5+hero.hp);p.run.offers=[];}
      else if(mode!=='classic')assert.equal(p.maxHp,5+hero.hp);
      if(p.bioBuild){p.bioBuild.pending=0;p.bioBuild.offers=[];}
      m.state='playing';m.time=10;
      assert.equal(m.useCharacterSkill(p.id),true);assert.equal(m.useCharacterSkill(p.id),false);
      assert.equal(p.characterReadyAt,10+hero.cooldown);
      if(id==='star'){assert.equal(p.surgeUntil,16);assert.equal(p.magnetUntil,16);}
      else if(id==='wind'){assert.equal(p.hasteUntil,14);assert.ok(p.shieldUntil>10);}
      else assert.equal(p.shieldUntil,10+(id==='stone'?3:2));
      assert.equal(m.placeBomb(p),true);const b=m.bombs.at(-1);assert.equal(b.character,id);assert.ok(Math.abs(b.explodeAt-10-hero.fuse)<0.0001);
      p.faction='zombie';p.characterReadyAt=0;assert.equal(m.useCharacterSkill(p.id),false);
    }
  });
}
test('character choice survives saves while cosmetic edits cannot change its abilities',async()=>{
  const {changeProfile}=await import('../public/progression.mjs');const p=freshProfile();
  changeProfile(p,{type:'appearance',value:p.appearance,character:'stone'});
  changeProfile(p,{type:'appearance',value:{...p.appearance,wings:2,mount:1}});
  assert.equal(p.character,'stone');assert.equal(validateSave(saveEnvelope(p)).character,'stone');
  const old=saveEnvelope(p);delete old.profile.character;assert.equal(validateSave(old).character,'sea');
  assert.throws(()=>changeProfile(p,{type:'appearance',value:p.appearance,character:'unknown'}));
});
