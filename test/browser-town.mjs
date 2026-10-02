import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {chromium} from '@playwright/test';
const temp=mkdtempSync(path.join(os.tmpdir(),'town-ui-')),port=18916;
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,MULTIPLAYER_ENABLED:"true",PORT:String(port),PUBLIC_ORIGIN:'',PROFILE_FILE:path.join(temp,'profiles.sqlite')},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j)});browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let town;const sent=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>{ws.on('framereceived',({payload})=>{const m=JSON.parse(payload);if(m.type==='town-state')town=m});ws.on('framesent',({payload})=>sent.push(JSON.parse(payload)));});
 const until=async f=>{for(let i=0;i<350;i++){if(f())return;await page.waitForTimeout(30)}throw Error('town timeout')};
 await page.goto(`http://localhost:${port}`);await page.click('#entry-guest');await page.click('#appearance-skip');await page.click('#town-open');await until(()=>town?.players.length);assert(town.npcs.length>0);
 const initial=town.npcs.map(p=>[p.x,p.y]);await page.waitForTimeout(400);assert(town.npcs.some((p,i)=>p.x!==initial[i][0]||p.y!==initial[i][1]));
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(150);
  const ratio=await page.locator('#town-canvas').evaluate(c=>({width:c.clientWidth-6,height:c.clientHeight-6,iw:c.width,ih:c.height}));assert(Math.abs(ratio.width/ratio.height-ratio.iw/ratio.ih)<.02,JSON.stringify(ratio));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 const before=town.players[0],box=await page.locator('#town-canvas').boundingBox();await page.locator('#town-canvas').click({position:{x:box.width/2+45,y:box.height/2}});await until(()=>sent.some(m=>m.type==='town-target'));const goal=sent.findLast(m=>m.type==='town-target');
 await page.screenshot({path:'../../work/town-click-feedback.png',fullPage:true});await until(()=>Math.hypot(town.players[0].x-goal.x,town.players[0].y-goal.y)<.1&&!town.players[0].moving);const final={x:town.players[0].x,y:town.players[0].y};await page.waitForTimeout(700);assert.equal(town.players[0].x,final.x);assert.equal(town.players[0].y,final.y);assert(!sent.some(m=>m.type==='town-move'&&(m.x||m.y)),'click does not stream stale direction commands');
 await page.screenshot({path:'../../work/town-mobile-fixed.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(150);await page.screenshot({path:'../../work/town-desktop-fixed.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: shared NPC motion, desktop/mobile/landscape aspect ratio, click target protocol, exact arrival and stable stop, no browser errors');
}finally{await browser?.close();await new Promise(r=>{server.once('exit',r);server.kill()});rmSync(temp,{recursive:true,force:true});}
