import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const root=process.cwd(),work=path.resolve(root,'../../work');mkdirSync(work,{recursive:true});
const temp=mkdtempSync(path.join(work,'modes-test-')),port=18899;
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),PROFILE_FILE:path.join(temp,'profiles.json'),PUBLIC_ORIGIN:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`server exit ${code}`)))});
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 let state;page.on('websocket',ws=>ws.on('framereceived',({payload})=>{const m=JSON.parse(payload);if(m.type==='state')state=m;}));
 const until=async(fn,timeout=12000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('condition timeout');await page.waitForTimeout(40)}};
 const chooseBio=async()=>{if(state?.mode!=='bio')return;for(let i=0;i<3;i++){await page.locator('#survivor-picks').waitFor({state:'visible'});const token=state.players[0].bioBuild.offerId;await page.locator('.survivor-card').first().click();await until(()=>state.players[0].bioBuild.offerId!==token||!state.bio.paused);}await until(()=>!state.bio.paused);};
 await page.goto(`http://localhost:${port}`);await page.locator('#career-open:not([disabled])').waitFor({state:'attached'});if(await page.locator('#appearance-dialog').isVisible()){await page.click('#appearance-skip');await page.locator('#home-panel').waitFor({state:'visible'});}await page.evaluate(()=>document.fonts.ready);
 await page.click('[data-ruleset="boss"]');assert.equal(await page.locator('#map-title').innerText(),'首领竞技场');await page.screenshot({path:path.join(work,'modes-lobby.png')});
 await page.click('#ai-play');await until(()=>state?.mode==='boss'&&state.state==='playing');
 assert.equal(state.mapId,'boss-court');assert.equal(state.players.length,1);assert.equal(state.enemies[0].maxHp,18);
 for(const kind of ['shock','frost','barrier','remote']){await page.click('#cycle-bomb');await until(()=>state.players[0].bombKind===kind);}
 await page.locator('#game').focus();await page.keyboard.press('Space');await until(()=>state.bombs.some(b=>b.kind==='remote'));await page.waitForTimeout(600);await page.click('#detonate-bomb');await until(()=>!state.bombs.some(b=>b.kind==='remote'));
 await until(()=>state.warnings.length>0);await page.screenshot({path:path.join(work,'modes-boss.png')});
 await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});
 await page.click('[data-ruleset="bio"]');await page.selectOption('#bio-level','hard');await page.selectOption('#bio-incubation','20');await page.screenshot({path:path.join(work,'bio-settings.png')});await page.click('#ai-play');await until(()=>state?.mode==='bio'&&state.state==='playing');await until(()=>state.enemies.length>0);await chooseBio();
 assert.equal(state.bio.difficulty,'hard');assert.equal(state.bio.infectionSeconds,20);assert.equal(state.bio.phase,'preparation');assert(state.enemies.every(e=>e.faction==='human'));assert(state.bio.zone);assert.equal(state.mapId,'bio-lab');assert(state.enemies.some(e=>e.kind==='runner'));await page.screenshot({path:path.join(work,'modes-bio.png')});
 await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});
 // Both remaining maps are reachable from the map page.
 for(const id of ['boss-foundry','bio-maze']){
  await page.click('#map-picker-open');await page.click(`[data-map="${id}"]`);assert.equal(await page.locator('[data-ruleset="bio"]').getAttribute('aria-pressed'),'true');await page.click('#ai-play');await until(()=>state?.mapId===id&&state.state==='playing');await chooseBio();
  await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});
 }
 // Two independent browser profiles join one cooperative room.
 await page.click('[data-ruleset="boss"]');await page.click('#map-picker-open');await page.click('[data-map="boss-foundry"]');await page.click('[data-mode="online"]');await page.click('#create-room');await page.locator('#room-panel').waitFor({state:'visible'});
 const code=await page.locator('#room-number').innerText();const friend=await (await browser.newContext()).newPage();
 await friend.goto(`http://localhost:${port}`);await friend.locator('#career-open:not([disabled])').waitFor({state:'attached'});if(await friend.locator('#appearance-dialog').isVisible()){await friend.click('#appearance-skip');await friend.locator('#home-panel').waitFor({state:'visible'});}await friend.click('#rooms-open');await friend.fill('#room-code',code);await friend.click('#join-room');await friend.locator('#room-panel').waitFor({state:'visible'});await friend.click('#ready-button');
 await until(()=>state.players.length===2&&state.players.some(p=>p.ready));await page.click('#ready-button');await until(()=>state.state==='playing');assert(state.players.every(p=>p.team===0));assert.equal(state.enemies[0].maxHp,24);
 await friend.close();await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});
 for(const [id,mode] of [['boss-ring','boss'],['bio-district','bio']]){
  await page.click(`[data-ruleset="${mode}"]`);await page.click('#map-picker-open');await page.click(`[data-map="${id}"]`);await page.click('[data-mode="ai"]');await page.click('#ai-play');await until(()=>state?.mapId===id&&state.state==='playing');await chooseBio();
  await page.locator('#game').focus();if(mode==='boss'){await page.keyboard.down('ArrowUp');await page.waitForTimeout(600);await page.keyboard.up('ArrowUp');}
  await page.keyboard.down('ArrowRight');await until(()=>state.players[0].x>16,5000);await page.keyboard.up('ArrowRight');
  await page.screenshot({path:path.join(work,`${id}-camera.png`)});
  await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});
 }
 for(const [mode,count]of [['classic',6],['boss',5],['bio',6],['water11',3]]){
  await page.click(`[data-ruleset="${mode}"]`);await page.click('#map-picker-open');
  assert.equal(await page.locator('#map-options button:visible').count(),count);await page.screenshot({path:path.join(work,`catalogue-${mode}.png`)});await page.click('#close-maps');
 }
 for(const [id,mode]of [['forest-crossing','classic'],['dune-market','classic'],['boss-caldera','boss'],['boss-ruins','boss'],['bio-forest','bio'],['bio-mine','bio'],['water-reef','water11'],['water-ice','water11']]){
  await page.click(`[data-ruleset="${mode}"]`);await page.click('#map-picker-open');await page.click(`[data-map="${id}"]`);
  await page.click('[data-mode="ai"]');await page.click('#ai-play');await until(()=>state?.mapId===id&&state.state==='playing');await chooseBio();
  await page.screenshot({path:path.join(work,`theme-${id}.png`)});
  assert.equal(state.mode,mode);await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});
 }
 await page.click('[data-ruleset="classic"]');assert.equal(await page.locator('#map-select').inputValue(),'dune-market');
 await page.click('[data-ruleset="water11"]');assert.equal(await page.locator('#map-select').inputValue(),'water-ice');
 await page.click('#rooms-open');await page.selectOption('#room-create-mode','bio');assert(await page.locator('#room-bio-settings').isVisible());await page.selectOption('#room-bio-level','easy');await page.selectOption('#room-bio-incubation','8');assert.equal(await page.locator('#room-create-map option:not([disabled])').count(),6);await page.selectOption('#room-create-map','bio-mine');
 await page.selectOption('#room-create-mode','classic');assert.equal(await page.locator('#room-create-map option:not([disabled])').count(),6);
 await page.selectOption('#room-create-mode','bio');assert.equal(await page.locator('#room-create-map').inputValue(),'bio-mine');await page.click('#close-rooms');
 await page.click('[data-ruleset="bio"]');await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(work,'modes-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS: all eight new themes, mode-filtered catalogues and remembered selections, large-map movement and camera screenshots, boss telegraphs, five bomb selections, bio enemies, solo/cooperative starts, mobile layout, no browser errors');
}finally{await browser?.close();server.kill();await new Promise(resolve=>server.once('exit',resolve));rmSync(temp,{recursive:true,force:true});}
