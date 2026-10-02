import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const url=process.env.AUDIT_URL || 'http://127.0.0.1:8892/sugar-bubble-arena/';
const out=path.resolve('../../work/output/playwright/audit');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[];
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(()=>{
 window.audit={state:null,town:null,sent:[],profile:null};
 const Native=Worker;
 window.Worker=class extends Native{
  constructor(...args){super(...args);this.addEventListener('message',({data:m})=>{if(m.type==='state')audit.state=m;if(m.type==='town-state')audit.town=m;if(m.profile)audit.profile=m.profile;});}
  postMessage(m,...args){audit.sent.push(m);return super.postMessage(m,...args);}
 };
});
const page=await context.newPage();page.setDefaultTimeout(10000);
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const record=(name,detail)=>{results.push({name,detail});console.log('PASS',name,JSON.stringify(detail||''));};
async function home(){await page.locator('#battle-open').click();await page.locator('#home-panel').waitFor({state:'visible'});}
async function picks(count){for(let n=0;n<count;n++){
 await page.locator('#survivor-picks').waitFor({state:'visible'});await page.waitForTimeout(450);
 const before=await page.evaluate(()=>audit.sent.filter(m=>m.type==='survivor-pick').length);
 await page.locator('.survivor-card').first().click();await page.keyboard.press('Numpad1');await page.keyboard.press('Space');
 assert.equal(await page.evaluate(()=>audit.sent.filter(m=>m.type==='survivor-pick').length),before,'mouse/numpad/space must not choose');
 await page.keyboard.press('Digit1');await page.waitForFunction(n=>audit.sent.filter(m=>m.type==='survivor-pick').length>n,before);
}}
try{
 await page.goto(url);await page.locator('#entry-guest').click();await page.locator('#appearance-dialog').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#appearance-preview').naturalWidth>0);
 assert.match(await page.locator('.character-template[aria-pressed=true]').innerText(),/海王子/);
 await page.locator('#appearance-skip').click();await page.locator('#home-panel').waitFor({state:'visible'});record('首次进入与默认角色');
 await page.reload();await page.locator('#entry-guest').click();await page.locator('#home-panel').waitFor({state:'visible'});record('再次进入跳过角色设计');
 await page.locator('#account-open').click();await page.locator('#friend-self-name').fill('验收旅人');await page.locator('#friend-self-form button').click();await page.waitForFunction(()=>document.querySelector('#account-open').textContent.includes('验收旅人'));await home();assert.match(await page.locator('#hero-player-name').innerText(),/验收旅人/);record('昵称保存及大厅同步');
 for(const [button,pane] of [['career-open','career-dialog'],['town-open','town-dialog'],['guide-open','guide-dialog'],['manual-open','manual-dialog']]){
  await page.locator('#'+button).click();assert(await page.locator('#'+pane).isVisible());assert(await page.locator('#'+pane+' .lobby-nav').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);record('页面导航 '+pane);
 }
 for(const b of await page.locator('[data-chapter]').all()){await b.click();assert(await page.locator('[data-manual]:visible').innerText());}
 await home();
 if(!process.env.AUDIT_UI_ONLY) for(const [id,name] of [['sea','海王子'],['wind','风铃'],['stone','岩卫'],['star','星术师']]){
  await page.locator('#career-open').click();await page.locator('#appearance-open').click();await page.locator('#template-tab').click();await page.locator('.character-template').filter({hasText:name}).click();
  await page.locator('#outfit-tab').click();await page.locator('[data-appearance=wings]').selectOption('1');await page.locator('[data-appearance=mount]').selectOption('1');
  for(const b of await page.locator('[data-preview-dir]').all()){await b.click();await page.waitForFunction(()=>document.querySelector('#appearance-preview').complete&&document.querySelector('#appearance-preview').naturalWidth>0);}
  await page.locator('#appearance-save').click();await page.waitForFunction(id=>audit.profile?.character===id,id);await home();
  assert.equal(await page.locator('#hero-character-name').innerText(),name);
  for(const [mode,rules,map] of [['classic','classic','garden'],['boss','boss','boss-ring'],['bio','bio','bio-lab'],['survivor','survivor','survivor-grove'],['water11','boss','water-reef']]){
   await page.locator(`[data-ruleset=${rules}]`).click();await page.locator('#map-picker-open').click();await page.locator(`[data-map="${map}"]`).click();await page.locator('[data-mode=practice]').click();
   await page.evaluate(()=>audit.state=null);await page.locator('#practice').click();await page.waitForFunction(m=>audit.state?.mode===m,mode);
   await picks(mode==='bio'?3:mode==='survivor'?1:0);
   await page.waitForFunction(()=>audit.state?.state==='playing'&&!(audit.state.bio?.paused||audit.state.survivor?.paused));
   assert.equal(await page.evaluate(()=>audit.state.players.find(p=>p.id==='local-player').character),id);
   await page.locator('#game').focus();await page.keyboard.press('KeyF');await page.waitForFunction(()=>audit.state.players.find(p=>p.id==='local-player').characterReadyAt>audit.state.time);
   const start=await page.evaluate(()=>audit.state.players.find(p=>p.id==='local-player'));
   await page.keyboard.down('ArrowDown');await page.waitForTimeout(250);await page.keyboard.up('ArrowDown');await page.keyboard.press('Space');
   await page.waitForFunction(()=>audit.state.bombs.some(b=>b.owner==='local-player'));
   const end=await page.evaluate(()=>audit.state.players.find(p=>p.id==='local-player'));assert(start.x!==end.x||start.y!==end.y,'movement');
   if(id==='sea')await page.screenshot({path:path.join(out,mode+'.png')});
   await page.locator('#leave-game').click();await page.locator('#home-panel').waitFor({state:'visible'});record(`${name} / ${mode}`,{skill:true,bubble:true,movement:true});
  }
 }
 await page.locator('#town-open').click();await page.waitForFunction(()=>audit.town?.npcs.length===5);
 const npcs=await page.evaluate(()=>audit.town.npcs.map(n=>({id:n.id,x:n.x,y:n.y})));
 await page.locator('#town-chat-input').fill('小镇验收消息');await page.locator('#town-chat-form button').click();await page.waitForFunction(()=>document.querySelector('#town-chat').textContent.includes('小镇验收消息'));
 await page.locator('.town-emotes button').first().click();
 for(const b of await page.locator('#friend-list button').all()){await b.click();assert(await page.locator('#friend-message').isVisible());}
 await page.locator('#friend-list button').first().click();await page.locator('#friend-message').fill('私聊验收消息');await page.locator('#friend-chat-form button').click();await page.waitForFunction(()=>document.querySelector('#friend-status').textContent==='已保存');
 await page.locator('#friend-alias').fill('测试好友');await page.locator('#friend-settings button').click();await page.waitForFunction(()=>document.querySelector('#friend-status').textContent==='已保存');
 const coins=await page.evaluate(()=>audit.profile.coins);await page.locator('#friend-gift-open').click();await page.locator('#friend-gift-cancel').click();assert.equal(await page.evaluate(()=>audit.profile.coins),coins);
 await page.locator('#friend-gift-open').click();await page.locator('#friend-gift-send').click();await page.waitForFunction(n=>audit.profile.coins<n,coins);
 const after=await page.evaluate(()=>audit.profile.coins);assert.equal(coins-after,15);
 record('小镇文字、表情、5 位好友、私聊、备注及赠礼扣费');
 await page.reload();await page.locator('#entry-guest').click();await page.locator('#home-panel').waitFor({state:'visible'});await page.locator('#town-open').click();await page.locator('#friend-list button').first().click();
 await page.waitForFunction(()=>document.querySelector('#friend-history').textContent.includes('私聊验收消息'));assert.match(await page.locator('#friend-name').innerText(),/测试好友/);await page.waitForFunction(()=>document.querySelector('#town-chat').textContent.includes('小镇验收消息'));record('聊天数据库与关系刷新恢复');
 // Click world coordinates through the visible camera, without changing game state.
 async function clickTown(x,y){const point=await page.evaluate(({x,y})=>{const c=document.querySelector('#town-canvas'),r=c.getBoundingClientRect(),p=audit.town.players[0];const cx=Math.max(0,Math.min(1280-c.width,p.x-c.width/2)),cy=Math.max(0,Math.min(960-c.height,p.y-c.height/2));return {x:r.x+(x-cx)*r.width/c.width,y:r.y+(y-cy)*r.height/c.height};},{x,y});await page.mouse.click(point.x,point.y);}
 await page.locator('#close-friend-detail').click();
 const npc=await page.evaluate(()=>audit.town.npcs.find(n=>Math.abs(n.x-audit.town.players[0].x)<350&&Math.abs(n.y-audit.town.players[0].y)<230));
 if(npc){await clickTown(npc.x,npc.y-22);await page.locator('#town-npc-menu').waitFor({state:'visible'});await page.locator('[data-npc-action=gift]').click();assert(await page.locator('#friend-gift').isVisible());record('点击居民打开交互与赠礼');}
 for(const [name,x,y,target] of [['对战会馆',300,315,'home-panel'],['装扮工坊',980,315,'appearance-dialog'],['探索书屋',300,805,'guide-dialog'],['糖果茶馆',980,805,'tea-dialog']]){
  await home();await page.evaluate(()=>audit.town=null);await page.locator('#town-open').click();await page.waitForFunction(()=>audit.town?.players.length);await page.waitForTimeout(150);
  await clickTown(x,y);await page.locator('#town-entry').waitFor({state:'visible',timeout:12000});assert.match(await page.locator('#town-entry-title').innerText(),new RegExp(name));await page.locator('#town-entry-confirm').click();assert(await page.locator('#'+target).isVisible());record('建筑入口 '+name);
 }
 await home();await page.locator('#account-open').click();
 const download=page.waitForEvent('download');await page.locator('#save-export').click();await (await download).saveAs(path.join(out,'save.json'));
 await page.locator('#save-import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('格式无效'));assert(await page.locator('#save-confirm').isHidden());
 await page.locator('#save-import').setInputFiles(path.join(out,'save.json'));await page.locator('#save-confirm').waitFor({state:'visible'});await page.locator('#save-confirm').click();await page.locator('#entry-guest').click();await page.locator('#home-panel').waitFor({state:'visible'});assert.match(await page.locator('#hero-player-name').innerText(),/验收旅人/);record('存档导出、错误导入保护、正确导入恢复');
 await page.locator('#career-open').click();const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('sugar-bubble-local-v1')).profile.coins);await page.locator('[data-upgrade=speed]').click();await page.waitForFunction(()=>audit.profile.attributes.speed===1);assert.equal(before-await page.evaluate(()=>audit.profile.coins),40);record('养成升级扣费与保存');
 await home();await page.locator('[data-ruleset=classic]').click();await page.locator('#map-picker-open').click();await page.locator('[data-map=garden]').click();await page.locator('[data-mode=practice]').click();await page.locator('#practice').click();await page.waitForFunction(()=>audit.state?.state==='playing');
 await page.locator('#help-button').click();assert(await page.locator('#help-dialog').isVisible());await page.locator('#close-help').click();
 await page.locator('#game').focus();await page.keyboard.press('F2');await page.locator('[data-mod=invincible]').check();await page.waitForFunction(()=>audit.state.players[0].mods.invincible);await page.locator('#training-win').click();await page.locator('#result-panel').waitFor({state:'visible'});assert.match(await page.locator('#round-reward').innerText(),/不.*资源|练习/);
 await page.locator('#return-room').click();await page.waitForFunction(()=>audit.state.state==='playing');await page.locator('#leave-game').click();await page.locator('#home-panel').waitFor({state:'visible'});record('局内手册、训练开关、结算、再来一局及退出');
 assert.deepEqual(errors,[]);record('浏览器错误与资源加载',errors);
}catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw e;}
finally{writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));await browser.close();}
