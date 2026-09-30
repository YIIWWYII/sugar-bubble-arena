import assert from 'node:assert/strict';
import {spawn}from 'node:child_process';import{mkdtempSync,rmSync}from'node:fs';import path from'node:path';import{chromium}from'@playwright/test';
const root=process.cwd(),work=path.resolve(root,'../../work'),temp=mkdtempSync(path.join(work,'survivor-browser-')),port=18904;
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),PROFILE_FILE:path.join(temp,'profiles.json'),PUBLIC_ORIGIN:''},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error(`server ${c}`)))});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await(await browser.newContext({viewport:{width:1280,height:900}})).newPage(),errors=[];let state;
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack)});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});page.on('websocket',ws=>ws.on('framereceived',({payload})=>{const m=JSON.parse(payload);if(m.type==='state')state=m;}));
 const until=async(fn,timeout=15000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('survivor condition timeout');await page.waitForTimeout(50)}};
 const enter=async(p)=>{await p.goto(`http://localhost:${port}`);await p.locator('#career-open:not([disabled])').waitFor({state:'attached'});if(await p.locator('#appearance-dialog').isVisible())await p.click('#appearance-skip');await p.locator('#home-panel').waitFor({state:'visible'});};
 await enter(page);await page.click('[data-ruleset="survivor"]');await page.click('#map-picker-open');assert.equal(await page.locator('#map-options button:visible').count(),3);await page.click('[data-map="survivor-grove"]');await page.click('#ai-play');await page.locator('#survivor-picks').waitFor({state:'visible'});
 assert.equal(await page.locator('.survivor-card').count(),3);const time=state.time;await page.waitForTimeout(700);assert.equal(state.time,time);await page.screenshot({path:path.join(work,'survivor-choices.png')});
 await page.click('#survivor-reroll');await until(()=>state.players[0].run.rerolls===1);assert.equal(await page.locator('.survivor-card').count(),3);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(work,'survivor-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1280,height:900});
 await page.locator('.survivor-card').first().click();await until(()=>!state.survivor.paused);await until(()=>state.survivor.gems.length>0,20000);assert(state.enemies.length>0);await page.screenshot({path:path.join(work,'survivor-combat.png')});
 // Collect a real kill drop by following adjacent open map cells.
 const deadline=Date.now()+25000;await page.locator('#game').focus();
 while(state.players[0].run.xp===0&&state.players[0].run.level===1&&Date.now()<deadline&&state.players[0].status==='alive'){
  const p=state.players[0],g=state.survivor.gems[0];if(!g){await page.waitForTimeout(100);continue;}
  const dx=g.x-p.x,dy=g.y-p.y,key=Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');await page.keyboard.down(key);await page.waitForTimeout(90);await page.keyboard.up(key);
 }
 assert(state.players[0].run.xp>0||state.players[0].run.level>1,'real experience gem collected');
 if(state.survivor.paused)await page.click('#survivor-pick-leave');else await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});
 // Shared pause and independent choices in a real two-client room.
 await page.click('[data-mode="online"]');await page.click('#create-room');await page.locator('#room-panel').waitFor({state:'visible'});const code=await page.locator('#room-number').innerText();
 const friend=await(await browser.newContext()).newPage();await enter(friend);await friend.click('#rooms-open');await friend.fill('#room-code',code);await friend.click('#join-room');await friend.locator('#room-panel').waitFor({state:'visible'});await friend.click('#ready-button');await until(()=>state.players.length===2&&state.players.some(p=>p.ready));await page.click('#ready-button');await page.locator('#survivor-picks').waitFor({state:'visible'});await friend.locator('#survivor-picks').waitFor({state:'visible'});
 await page.locator('.survivor-card').first().click();await until(()=>!state.players[0].run.offers.length);assert(state.survivor.paused);assert.equal(await page.locator('#survivor-pick-title').innerText(),'等待队友选择');await friend.locator('.survivor-card').first().click();await until(()=>!state.survivor.paused);assert(state.players.every(p=>Object.keys(p.run.ranks).length===1));await friend.close();await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);console.log('PASS: solo start, three choices, paused clock, reroll, automatic combat, real XP pickup, co-op shared pause and independent choices, mobile page, no browser errors');
}finally{await browser?.close();server.kill();await new Promise(resolve=>server.once('exit',resolve));rmSync(temp,{recursive:true,force:true});}
