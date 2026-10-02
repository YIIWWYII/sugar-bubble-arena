import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';
import {chromium} from '@playwright/test';
const temp=mkdtempSync(path.join(os.tmpdir(),'bubble-mobile-')),port=18912,base=`http://localhost:${port}`;
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,MULTIPLAYER_ENABLED:"true",PORT:String(port),PUBLIC_ORIGIN:'',PROFILE_FILE:path.join(temp,'profiles.sqlite')},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j)});
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],sent=[];let state,id;
 page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>{ws.on('framereceived',({payload})=>{const m=JSON.parse(payload);if(m.type==='hello')id=m.id;if(m.type==='state')state=m;});ws.on('framesent',({payload})=>sent.push(JSON.parse(payload)));});
 const until=async f=>{for(let i=0;i<250;i++){if(f())return;await page.waitForTimeout(40)}throw Error('state timeout')};
 const fit=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');
 await page.goto(base);await page.locator("#entry-guest").tap();await page.locator('#appearance-skip').tap();await page.locator('#home-panel').waitFor({state:'visible'});await fit();await page.screenshot({path:'../../work/mobile-home.png',fullPage:true});
 await page.locator('#account-open').tap();await fit();await page.locator('#close-account').tap();await page.locator('#rooms-open').tap();await fit();await page.locator('#close-rooms').tap();
 await page.locator('[data-mode=practice]').tap();await page.locator('#practice').tap();await until(()=>state?.state==='playing');await page.locator('#touch-controls').waitFor({state:'visible'});await fit();
 const cdp=await context.newCDPSession(page),box=await page.locator('[data-dir=up]').boundingBox(),bomb=await page.locator('#touch-bomb').boundingBox();
 const point=(b,id)=>({x:b.x+b.width/2,y:b.y+b.height/2,id});const up=point(box,1),bubble=point(bomb,2);
 const before=state.players.find(p=>p.id===id).y;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[up]});await page.waitForTimeout(250);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[up,bubble]});await page.waitForTimeout(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[up]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);
 assert(state.players.find(p=>p.id===id).y<before,'touch moves character');assert(sent.some(m=>m.type==='input'&&m.bomb&&m.dir==='up'),'simultaneous movement and bomb');assert.equal(sent.filter(m=>m.type==='input').at(-1).dir,null,'release stops');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[up]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(100);assert.equal(sent.filter(m=>m.type==='input').at(-1).dir,null,'cancel stops');
 await page.screenshot({path:'../../work/mobile-game.png'});
 await page.locator('#touch-chat').tap();await page.locator('#chat-input').fill('手机触屏测试');await page.locator('#chat-form button').tap();await until(()=>sent.some(m=>m.type==='chat'));
 await page.setViewportSize({width:844,height:390});await fit();await page.screenshot({path:'../../work/mobile-landscape.png'});assert(await page.locator('#touch-bomb').isVisible());
 await page.locator('#leave-game').tap();await page.setViewportSize({width:390,height:844});await page.locator('#town-open').tap();await fit();await page.locator('#town-canvas').tap({position:{x:120,y:110}});await until(()=>sent.some(m=>m.type.startsWith('town')));await page.locator('#close-town').tap();
 await page.setViewportSize({width:360,height:740});await fit();await page.locator('[data-ruleset=survivor]').tap();await page.locator('[data-mode=ai]').tap();await page.locator('#ai-play').tap();await page.locator('#survivor-picks').waitFor({state:'visible'});await fit();const pick=await page.locator('#survivor-picks').boundingBox();assert(pick.height<740*.7);await page.locator('.survivor-card').first().tap();
 const desktop=await browser.newContext({viewport:{width:1440,height:1000}}),d=await desktop.newPage();await d.goto(base);await d.locator("#entry-guest").click();await d.locator('#appearance-skip').click();await d.screenshot({path:'../../work/mobile-desktop-regression.png',fullPage:true});assert.equal(await d.locator('#touch-controls').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS: mobile pages, multi-touch move+bomb, release, chat, landscape, town touch, compact upgrade selection; no browser errors');
}finally{await browser?.close();await new Promise(r=>{server.once('exit',r);server.kill()});rmSync(temp,{recursive:true,force:true});}
