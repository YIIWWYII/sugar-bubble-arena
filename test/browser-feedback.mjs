import assert from 'node:assert/strict';
import {spawn}from 'node:child_process';import {mkdtempSync,rmSync,readFileSync}from 'node:fs';import path from 'node:path';import {chromium}from '@playwright/test';
import {createMaps,mapForMode}from '../public/maps.mjs';import {MODE_MUSIC}from '../public/music.mjs';
const root=process.cwd(),work=path.resolve(root,'../../work'),temp=mkdtempSync(path.join(work,'feedback-browser-')),port=18906;
const load=f=>JSON.parse(readFileSync(`public/assets/${f}.json`)),maps=createMaps(load('map'),load('water11'));
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),PROFILE_FILE:path.join(temp,'profiles.json'),PUBLIC_ORIGIN:''},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error(`server ${c}`)))});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await(await browser.newContext({viewport:{width:1280,height:900}})).newPage();let last,fixture;const errors=[];
 // Authoritative rules are unit-tested separately; render controlled incoming states for UI boundaries.
 await page.routeWebSocket(`ws://localhost:${port}/`,ws=>{const upstream=ws.connectToServer();upstream.onMessage(message=>{const m=JSON.parse(message);if(m.type==='state'){last=m;ws.send(JSON.stringify(fixture||m));}else ws.send(message);});ws.onMessage(message=>upstream.send(message));});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 const until=async(fn,timeout=12000)=>{const start=Date.now();while(!await fn()){if(Date.now()-start>timeout)throw Error('feedback timeout');await page.waitForTimeout(50)}};
 await page.goto(`http://localhost:${port}`);await page.locator('#career-open:not([disabled])').waitFor({state:'attached'});if(await page.locator('#appearance-dialog').isVisible())await page.click('#appearance-skip');await page.locator('#home-panel').waitFor({state:'visible'});
 await page.click('[data-ruleset="bio"]');await page.click('#ai-play');await page.locator('#survivor-picks').waitFor({state:'visible'});
 for(let i=0;i<3;i++){const token=last.players[0].bioBuild.offerId;await page.locator('.survivor-card').first().click();await until(()=>last.players[0].bioBuild.offerId!==token||!last.bio.paused);}
 const p=last.players[0];fixture=structuredClone(last);fixture.time=30;fixture.players[0]={...p,infectedUntil:37,infectionDuration:12,antidotes:1};fixture.bio.paused=false;fixture.events=[{id:1000001,type:'combat-feed',time:30,killerId:p.id,victimId:'npc',killer:p.name,victim:'感染者',action:'击败'}];
 await until(()=>page.locator('#infection-alert').isVisible());assert.equal(await page.locator('#infection-countdown').innerText(),'7.0 秒');assert.equal(await page.locator('.kill-notice').count(),1);assert((await page.locator('#infection-action').innerText()).includes('按 4'));await page.screenshot({path:path.join(work,'infection-feed.png')});
 fixture.time=34.5;await until(async()=>await page.locator('#infection-countdown').innerText()==='2.5 秒');assert.equal(await page.locator('#infection-alert').getAttribute('data-urgent'),'true');await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(work,'infection-feed-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1280,height:900});
 fixture.time=38;fixture.players[0].infectedUntil=0;await until(async()=>!await page.locator('#infection-alert').isVisible());assert.equal(await page.locator('.kill-notice').count(),0);
 for(const [mode,id]of [['classic','bun06_8'],['boss','boss-court'],['bio','bio-lab'],['survivor','survivor-grove'],['water11','water11_8']]){
  const map=mapForMode(maps.get(id),mode);fixture={...fixture,mode,mapId:id,blocks:map.blocks,events:[],survivor:undefined,state:'playing'};if(mode==='survivor')fixture.survivor={paused:false,elapsed:10,gems:[],shots:[]};
  await until(async()=>await page.locator('#mode-music').getAttribute('data-track')===MODE_MUSIC[mode].file);await until(()=>page.locator('#mode-music').evaluate(a=>a.readyState>=2&&!a.paused));
  const duration=await page.locator('#mode-music').evaluate(a=>a.duration);assert(duration>20);assert(await page.locator('#mode-music').evaluate(a=>a.loop));
 }
 await page.click('#sound-button');assert(await page.locator('#mode-music').evaluate(a=>a.paused));await page.click('#sound-button');await until(()=>page.locator('#mode-music').evaluate(a=>!a.paused));
 const bio=mapForMode(maps.get('bio-lab'),'bio');fixture={...fixture,mode:'bio',mapId:'bio-lab',blocks:bio.blocks,survivor:undefined,state:'finished',winner:0,reason:'防守时间结束'};await until(async()=>await page.locator('#result-title').innerText()==='人类胜利');assert(await page.locator('#mode-music').evaluate(a=>a.paused));await page.screenshot({path:path.join(work,'bio-human-victory.png')});
 fixture.state='playing';await page.waitForTimeout(150);fixture.state='finished';fixture.winner=1;await until(async()=>await page.locator('#result-title').innerText()==='丧尸胜利');assert.deepEqual(errors,[]);
 console.log('PASS: infection countdown and urgency, feed deduplication/expiry, mobile, all five music tracks decode/play/loop/mute, faction result titles; UI state fixtures used for boundary cases');
}finally{await browser?.close();server.kill();if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));rmSync(temp,{recursive:true,force:true});}
