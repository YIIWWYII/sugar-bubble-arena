import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const work=path.resolve(root,'../../work');mkdirSync(work,{recursive:true});
const temp=mkdtempSync(path.join(work,'expansion-test-')),profileFile=path.join(temp,'profiles.json');
const port=18898;
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),PROFILE_FILE:profileFile,PUBLIC_ORIGIN:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`server exit ${code}`)))});
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  let state,reward;
  page.on('websocket',ws=>ws.on('framereceived',({payload})=>{const m=JSON.parse(payload);if(m.type==='state')state=m;if(m.type==='round-reward')reward=m;}));
  const until=async(fn,timeout=10000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('Browser condition timeout');await page.waitForTimeout(50)}};
  await page.goto(`http://localhost:${port}`);await page.locator('#career-open:not([disabled])').waitFor({state:'attached'});if(await page.locator('#appearance-dialog').isVisible()){await page.click('#appearance-skip');await page.locator('#home-panel').waitFor({state:'visible'});}
  await page.screenshot({path:path.join(work,'expansion-lobby.png')});
  await page.click('#career-open');await page.screenshot({path:path.join(work,'expansion-career.png')});
  await page.click('[data-upgrade="speed"]');await page.waitForFunction(()=>document.getElementById('career-wallet').textContent.includes('糖币 20'));
  await page.click('#close-career');await page.reload();await page.locator('#career-open:not([disabled])').waitFor({state:'attached'});if(await page.locator('#appearance-dialog').isVisible()){await page.click('#appearance-skip');await page.locator('#home-panel').waitFor({state:'visible'});}
  assert((await page.locator('#lobby-wallet').innerText()).includes('20 糖币'));
  await page.click('#rooms-open');assert(await page.locator('#rooms-dialog').isVisible());await page.click('#close-rooms');
  await page.click('#map-picker-open');assert(await page.locator('[data-map="water11_8"]').isHidden());await page.click('#close-maps');
  await page.click('[data-ruleset="water11"]');assert(!(await page.locator('#ai-play').isDisabled()));assert.equal(await page.locator('#map-select').inputValue(),'water11_8');
  await page.click('[data-ruleset="classic"]');await page.click('#map-picker-open');await page.click('[data-map="garden"]');await page.click('[data-mode="online"]');
  await page.click('#create-room');await page.locator('#room-panel:not([hidden])').waitFor();
  await page.screenshot({path:path.join(work,'lobby-modern-room.png')});
  await page.click('#leave-lobby');await page.locator('#home-panel:not([hidden])').waitFor();
  await page.click('[data-mode="practice"]');await page.click('#practice');await until(()=>state?.state==='playing'&&state.practice);
  await page.click('#leave-game');await page.locator('#home-panel:not([hidden])').waitFor();
  await page.click('[data-mode="ai"]');await page.click('#ai-play');await until(()=>state?.state==='playing'&&!state.practice);
  const human=()=>state.players.find(p=>!p.bot);
  assert.equal(state.mapId,'garden');assert.equal(human().speed,5.25);
  await page.locator('#game').focus();await page.keyboard.press('q');await until(()=>human().hasteUntil>state.time);
  assert(await page.locator('#skill-use').isDisabled());
  await page.screenshot({path:path.join(work,'expansion-garden.png')});
  console.log('PASS: profile created, attribute upgraded and restored, new map started, Q skill activated');
  await until(()=>state?.state==='finished'&&reward,120000);
  assert(reward.reward.coins>=25);assert((await page.locator('#round-reward').innerText()).includes('已保存'));
  await page.screenshot({path:path.join(work,'lobby-modern-result.png')});
  await page.click('#result-home');await page.locator('#career-open').waitFor();await page.click('#career-open');
  await page.click('[data-career-tab="skills"]');
  await page.click('[data-upgrade="shield"]');
  await page.locator('[data-equip="shield"]:not([disabled])').waitFor();await page.click('[data-equip="shield"]');
  await page.waitForFunction(()=>document.getElementById('career-equipped').textContent.includes('泡泡护盾'));
  await page.click('#close-career');await page.reload();await page.locator('#career-open:not([disabled])').waitFor({state:'attached'});if(await page.locator('#appearance-dialog').isVisible()){await page.click('#appearance-skip');await page.locator('#home-panel').waitFor({state:'visible'});}
  for(const id of ['harbor','frost']){
    state=null;await page.click('#map-picker-open');await page.click(`[data-map="${id}"]`);await page.click('#ai-play');await until(()=>state?.state==='playing');
    assert.equal(state.mapId,id);assert.equal(human().skill,'shield');
    await page.screenshot({path:path.join(work,`expansion-${id}.png`)});
    await page.click('#skill-use');await until(()=>human().skillReadyAt>state.time);
    await page.click('#leave-game');await page.locator('#ai-play').waitFor();
  }
  await page.click('#guide-open');assert.equal(await page.locator('#item-guide article').count(),4);await page.click('#close-guide');
  await page.setViewportSize({width:390,height:844});await page.click('#career-open');
  await page.click('[data-career-tab="skills"]');
  await page.locator('[data-equip="magnet"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(work,'expansion-mobile.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS: natural match settlement, reward saved, skill unlocked/equipped and restored, all maps rendered, mobile panel reachable, no JS/HTTP errors');
}finally{
  if(browser)await browser.close();const exit=new Promise(resolve=>server.once('exit',resolve));server.kill();await exit;
  try{unlinkSync(profileFile);}catch(error){if(error.code!=='ENOENT')throw error;}rmdirSync(temp);
}
