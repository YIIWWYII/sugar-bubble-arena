import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const out=path.resolve('../../work/output/playwright/audit-mobile');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[],errors=[];
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
await context.addInitScript(()=>{window.audit={state:null,sent:[]};const Native=Worker;window.Worker=class extends Native{constructor(...a){super(...a);this.addEventListener('message',({data:m})=>{if(m.type==='state')audit.state=m;});}postMessage(m,...a){audit.sent.push(m);return super.postMessage(m,...a);}};});
const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const pass=(name,detail)=>{results.push({name,detail});console.log('PASS',name,JSON.stringify(detail||''));};
async function contained(selector){const b=await page.locator(selector).boundingBox(),v=page.viewportSize();assert(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,`${selector} not inside viewport: ${JSON.stringify(b)}`);}
try{
 await page.goto(process.env.AUDIT_URL||'http://127.0.0.1:8892/sugar-bubble-arena/');await page.locator('#landscape-prompt').waitFor({state:'visible'});await page.locator('#landscape-dismiss').tap();await page.locator('#entry-guest').tap();await page.locator('#appearance-dialog').waitFor({state:'visible'});await page.locator('#appearance-skip').tap();await page.locator('#home-panel').waitFor({state:'visible'});pass('竖屏引导、首次创建');
 await page.setViewportSize({width:844,height:390});
 for(const [button,pane] of [['career-open','career-dialog'],['guide-open','guide-dialog'],['manual-open','manual-dialog'],['town-open','town-dialog']]){
  await page.locator('#'+button).tap();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,pane);await contained('#'+button);pass('横屏页面 '+pane);
 }
 await page.locator('#town-profile-open').tap();await page.locator('#friend-self-name').fill('手机旅人');await page.locator('#friend-self-form button').tap();await page.waitForFunction(()=>document.querySelector('#account-open').textContent.includes('手机旅人'));pass('横屏小镇个人资料');await page.locator('#battle-open').tap();
 for(const [mode,rules,map] of [['classic','classic','garden'],['boss','boss','boss-ring'],['bio','bio','bio-lab'],['survivor','survivor','survivor-grove'],['water11','boss','water-reef']]){
  await page.locator(`[data-ruleset=${rules}]`).tap();await page.locator('#map-picker-open').tap();await page.locator(`[data-map=${map}]`).tap();await page.locator('[data-mode=practice]').tap();await page.evaluate(()=>audit.state=null);await page.locator('#practice').tap();await page.waitForFunction(m=>audit.state?.mode===m,mode);
  for(let n=0;n<(mode==='bio'?3:mode==='survivor'?1:0);n++){
   await page.locator('#survivor-picks').waitFor({state:'visible'});await page.waitForTimeout(450);await contained('#survivor-picks');const b=await page.locator('#survivor-picks').boundingBox();assert(b.height<390*.9,'choice panel covers whole screen');
   const before=await page.evaluate(()=>audit.sent.filter(m=>m.type==='survivor-pick').length);await page.locator('.survivor-card').first().tap();assert.equal(await page.evaluate(()=>audit.sent.filter(m=>m.type==='survivor-pick').length),before);await page.locator('#survivor-confirm').tap();await page.waitForFunction(n=>audit.sent.filter(m=>m.type==='survivor-pick').length>n,before);
  }
  await page.waitForFunction(()=>audit.state.state==='playing'&&!(audit.state.bio?.paused||audit.state.survivor?.paused));await contained('#touch-bomb');await contained('.touch-pad');await contained('#touch-character');
  await page.locator('#touch-character').tap();await page.waitForFunction(()=>audit.state.players[0].characterReadyAt>audit.state.time);
  const cdp=await context.newCDPSession(page),pad=await page.locator('.touch-pad').boundingBox(),bomb=await page.locator('#touch-bomb').boundingBox();
  const move={id:1,x:pad.x+pad.width/2,y:pad.y+pad.height*.8},fire={id:2,x:bomb.x+bomb.width/2,y:bomb.y+bomb.height/2};
  const before=await page.evaluate(()=>audit.state.players[0].y);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[move]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[move,fire]});await page.waitForTimeout(250);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>audit.state.bombs.some(b=>b.owner==='local-player'));assert.notEqual(await page.evaluate(()=>audit.state.players[0].y),before);
  if(['boss','bio','survivor','water11'].includes(mode)){
   for(const [action,field] of [['place-banana','bananas'],['place-smile','smiles']]){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[move]});await page.waitForTimeout(260);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const count=await page.evaluate(f=>audit.state.players[0][f],field);assert(count>0);await page.locator(`[data-touch-action=${action}]`).tap();await page.waitForFunction(({f,n})=>audit.state.players[0][f]===n-1,{f:field,n:count});
   }
  }
  await cdp.detach();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,mode+'.png')});pass('手机操作 '+mode,{joystick:true,multitouch:true,characterSkill:true});await page.locator('#leave-game').tap();await page.locator('#home-panel').waitFor({state:'visible'});
 }
 assert.deepEqual(errors,[]);
}catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw e;}
finally{writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));await browser.close();}
