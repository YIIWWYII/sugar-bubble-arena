import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';import path from 'node:path';
import {chromium} from '@playwright/test';import {ProfileStore} from '../profiles.mjs';import {Match} from '../public/engine.mjs';
const root=process.cwd(),work=path.resolve(root,'../../work'),temp=mkdtempSync(path.join(work,'character-test-')),file=path.join(temp,'profiles.json'),port=18901;
const store=new ProfileStore(file),friendId=store.create();const map=JSON.parse(readFileSync('public/assets/map.json'));const match=new Match(map),player=match.addPlayer('fixture','Friend',0);match.start();match.time=30;match.state='finished';match.winner=0;player.discoveries=['item:haste','item:guard','item:surge','item:magnet','enemy:boss','enemy:runner','enemy:dasher'];store.reward(friendId,'fixture',match,player);
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),PROFILE_FILE:file,PUBLIC_ORIGIN:''},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`server exit ${code}`)))});
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 let state;page.on('websocket',ws=>ws.on('framereceived',({payload})=>{const m=JSON.parse(payload);if(m.type==='state')state=m;}));
 const until=async(fn,timeout=12000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('condition timeout');await page.waitForTimeout(40)}};
 await page.goto(`http://localhost:${port}`);await page.locator('#appearance-dialog').waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);
 const assertPreview=async()=>{await page.waitForFunction(()=>{const img=document.getElementById('appearance-preview');return img.complete&&img.naturalWidth>0;});assert(await page.locator('#appearance-preview').evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);}));};
 await assertPreview();const initialPreview=await page.locator('#appearance-preview').getAttribute('src');
 // Each named item must actually affect every facing, both idle and walking.
 // This catches missing atlases and accessories hidden entirely behind the body.
 const wardrobeFailures=await page.evaluate(async()=>{
  const {APPEARANCE_OPTIONS,DEFAULT_APPEARANCE,appearanceSheet,setAppearanceAssets}=await import('/appearance.mjs');
  const manifest=await fetch('/assets/manifest.json').then(r=>r.json()),images=new Map(),failures=[];
  await Promise.all(Object.entries(manifest).filter(([key])=>key.startsWith('wardrobe-')||/^prince-red-(stand|walk)-/.test(key)).map(async([key,meta])=>{
   const image=new Image();image.src=meta.src;await image.decode();images.set(key,image);
  }));
  setAppearanceAssets(images);
  // SVG source and its PNG fallback must decode to the same native pixels.
  for(const [key,image] of images){
   if(!key.startsWith('wardrobe-'))continue;
   const fallback=new Image();fallback.src=manifest[key].src.replace(/\.svg$/,'.png');await fallback.decode();
   const pixels=im=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height).data;};
   const a=pixels(image),b=pixels(fallback);
   if(a.length!==b.length||a.some((v,i)=>v!==b[i]))failures.push(`SVG/PNG mismatch ${key}`);
  }
  for(const slot of ['accessory','wings','back','held','shoes','mount','aura'])for(let value=1;value<APPEARANCE_OPTIONS[slot].values.length;value++){
   if(!images.has(`wardrobe-${slot}-${value}`))failures.push(`missing ${slot}:${value}`);
   for(const motion of ['stand','walk'])for(const direction of [0,1,2,3]){
    const key=`prince-red-${motion}-${direction}`,source=images.get(key);
    const plain=appearanceSheet(source,key,DEFAULT_APPEARANCE),decorated=appearanceSheet(source,key,{...DEFAULT_APPEARANCE,[slot]:value});
    const a=plain.getContext('2d').getImageData(0,0,plain.width,plain.height).data,b=decorated.getContext('2d').getImageData(0,0,decorated.width,decorated.height).data;
    for(let f=0;f<plain.width/100;f++){
     let changed=0;
     for(let y=0;y<100;y++)for(let x=f*100;x<(f+1)*100;x++){
      const i=(y*plain.width+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;
     }
     if(changed<12)failures.push(`invisible ${slot}:${value} ${key} frame ${f}`);
    }
   }
  }
  // Verify layering contracts with controlled pixels, independent of item artwork.
  const {EQUIPMENT_LAYOUT}=await import('/appearance.mjs');
  const mock=new Map();
  const swatches={aura:'#111111',mount:'#222222',wings:'#333333',back:'#444444',shoes:'#555555',accessory:'#666666',held:'#777777'};
  for(const [slot,color] of Object.entries(swatches)){
   const sheet=document.createElement('canvas');sheet.width=2800;sheet.height=100;
   const ctx=sheet.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,2800,100);mock.set(`wardrobe-${slot}-1`,sheet);
  }
  setAppearanceAssets(mock);
  const pixel=(canvas,x,y)=>Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data);
  for(const direction of [0,1,2,3]){
   const body=document.createElement('canvas');body.width=body.height=100;
   const ctx=body.getContext('2d');ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,100,100);
   const key=`prince-red-stand-${direction}`;
   const face=EQUIPMENT_LAYOUT.face[direction];
   const plain=appearanceSheet(body,key,DEFAULT_APPEARANCE);
   const all=appearanceSheet(body,key,{...DEFAULT_APPEARANCE,...Object.fromEntries(Object.keys(swatches).map(s=>[s,1]))});
   if(face&&JSON.stringify(pixel(all,face[0]+2,face[1]+2-8))!==JSON.stringify(pixel(plain,face[0]+2,face[1]+2)))failures.push(`face protection ${direction}`);
   const riding=appearanceSheet(body,key,{...DEFAULT_APPEARANCE,mount:1,shoes:1});
   if(pixel(riding,50,70)[0]!==85)failures.push(`riding footwear ${direction}`);
   const back=appearanceSheet(body,key,{...DEFAULT_APPEARANCE,back:1});
   const actual=pixel(back,50,65),expected=direction===1?[68,68,68,255]:pixel(plain,50,65);
   if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push(`back depth ${direction}`);
  }
  setAppearanceAssets(images);
  return failures;
 });
 assert.deepEqual(wardrobeFailures,[]);
 const catalogue=await page.evaluate(async()=>{
  const {APPEARANCE_OPTIONS,DEFAULT_APPEARANCE,appearanceSheet,setAppearanceAssets}=await import('/appearance.mjs');
  const manifest=await fetch('/assets/manifest.json').then(r=>r.json()),images=new Map();
  await Promise.all(Object.entries(manifest).filter(([key])=>key.startsWith('wardrobe-')||/^prince-red-stand-/.test(key)).map(async([key,meta])=>{const im=new Image();im.src=meta.src;await im.decode();images.set(key,im);}));setAppearanceAssets(images);
  const c=document.createElement('canvas');c.width=1320;c.height=1620;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#e9f7fa';g.fillRect(0,0,c.width,c.height);g.fillStyle='#204d6a';g.font='bold 26px Microsoft YaHei';g.fillText('仿像素 SVG · 30 款装扮总览',30,42);
  let i=0;
  for(const slot of ['accessory','wings','back','held','shoes','mount','aura'])for(let value=1;value<APPEARANCE_OPTIONS[slot].values.length;value++){
   const x=20+(i%5)*260,y=70+Math.floor(i/5)*255;i++;
   g.fillStyle='#c5e6f0';g.fillRect(x,y,245,240);g.fillStyle='#204d6a';g.font='17px Microsoft YaHei';g.fillText(APPEARANCE_OPTIONS[slot].values[value],x+12,y+25);
   const key='prince-red-stand-3',im=appearanceSheet(images.get(key),key,{...DEFAULT_APPEARANCE,[slot]:value});g.drawImage(im,0,0,100,100,x+32,y+35,180,180);
   g.font='12px Microsoft YaHei';g.fillStyle='#608398';g.fillText(APPEARANCE_OPTIONS[slot].label,x+12,y+227);
  }
  return c.toDataURL();
 });
 writeFileSync(path.join(work,'wardrobe-svg-catalogue.png'),Buffer.from(catalogue.split(',')[1],'base64'));
 await page.reload();await page.locator('#appearance-dialog').waitFor({state:'visible'});await assertPreview();assert.equal(await page.locator('#appearance-preview').getAttribute('src'),initialPreview);
 await page.screenshot({path:path.join(work,'character-initial-preview.png')});
 await page.selectOption('[data-appearance=hair]','1');await page.selectOption('[data-appearance=style]','1');await page.selectOption('[data-appearance=eyes]','1');await page.selectOption('[data-appearance=outfit]','3');await page.selectOption('[data-appearance=accessory]','3');
 for(const preset of ['crystal','machine','night','cloud']){await page.click(`[data-preset=${preset}]`);assert.notEqual(await page.locator('[data-appearance=mount]').inputValue(),'0');}
 await page.click('[data-preset=crystal]');await page.selectOption('[data-appearance=hair]','1');
 const directions=new Set();for(const dir of [0,1,2,3]){await page.click(`[data-preview-dir="${dir}"]`);directions.add(await page.locator('#appearance-preview').getAttribute('src'));}assert.equal(directions.size,4);
 await page.screenshot({path:path.join(work,'character-editor.png'),fullPage:true});const preview=await page.locator('#appearance-preview').getAttribute('src');await page.click('#appearance-save');await page.locator('#home-panel').waitFor({state:'visible'});assert.equal(await page.locator('.hero-character').getAttribute('src'),preview);
 await page.reload();await page.locator('#appearance-dialog').waitFor({state:'visible'});await assertPreview();assert.equal(await page.locator('#appearance-preview').getAttribute('src'),initialPreview);assert.equal(await page.locator('[data-appearance=hair]').inputValue(),'0');assert.equal(await page.locator('[data-appearance=mount]').inputValue(),'0');
 const savedProfile=await page.evaluate(()=>fetch('/api/profile').then(r=>r.json()));assert.equal(savedProfile.appearance.hair,1);assert.equal(savedProfile.appearance.mount,2);
 await page.goto(`http://localhost:${port}/#appearance`);await page.reload();await page.locator('#career-open:not([disabled])').waitFor({state:'attached'});await assertPreview();assert.equal(await page.locator('#appearance-preview').getAttribute('src'),initialPreview);
 await page.click('[data-preset=crystal]');await page.selectOption('[data-appearance=hair]','1');await page.click('#appearance-save');await page.locator('#home-panel').waitFor({state:'visible'});
 await page.click('#career-open');await page.click('#appearance-open');assert.equal(await page.locator('[data-appearance=hair]').inputValue(),'1');assert.equal(await page.locator('[data-appearance=wings]').inputValue(),'3');assert.equal(await page.locator('[data-appearance=mount]').inputValue(),'2');await page.click('#close-appearance');await page.click('#close-career');
 await page.click('#rooms-open');assert.equal(await page.locator('#room-create-mode').inputValue(),'classic');assert.equal(await page.locator('#room-create-map option[value="boss-court"]').getAttribute('disabled'),'');await page.selectOption('#room-create-mode','boss');await page.selectOption('#room-create-map','boss-court');await page.screenshot({path:path.join(work,'character-rooms.png'),fullPage:true});await page.click('#room-create-button');await page.locator('#room-panel').waitFor({state:'visible'});const code=await page.locator('#room-number').innerText();
 const friendContext=await browser.newContext({viewport:{width:1280,height:900}});await friendContext.addCookies([{name:'qqt_profile',value:friendId,url:`http://localhost:${port}`,httpOnly:true,sameSite:'Strict'}]);const friend=await friendContext.newPage();friend.on('pageerror',e=>errors.push(e.message));
 await friend.goto(`http://localhost:${port}`);await friend.locator('#appearance-dialog').waitFor({state:'visible'});await friend.click('#appearance-save');await friend.locator('#career-open:not([disabled])').waitFor();await friend.click('#guide-open');await friend.click('[data-claim="item:haste"]');await friend.locator('[data-claim="item:haste"]:disabled').waitFor();await friend.click('[data-milestone="3"]');await friend.locator('[data-milestone="3"]:disabled').waitFor();await friend.click('[data-milestone="8"]');await friend.locator('[data-milestone="8"]:disabled').waitFor();
 await friend.screenshot({path:path.join(work,'character-collection.png'),fullPage:true});await friend.click('#close-guide');await friend.click('#career-open');await friend.click('[data-career-tab="skills"]');await friend.click('[data-equip="ward"]');await friend.locator('[data-equip="ward"]:disabled').waitFor();await friend.click('#close-career');
 await friend.click('#rooms-open');await friend.fill('#room-code',code);await friend.click('#join-room');await friend.locator('#room-panel').waitFor({state:'visible'});await friend.click('#ready-button');await until(()=>state?.players.length===2&&state.players.some(p=>p.ready));await page.click('#ready-button');await until(()=>state.state==='playing');
 assert(state.players.some(p=>p.appearance.hair===1&&p.appearance.accessory===3&&p.appearance.wings===3&&p.appearance.mount===2));assert(state.enemies[0].appearance.accessory===3);await friend.locator('#game').focus();await friend.keyboard.press('q');await until(()=>state.players.some(p=>p.skill==='ward'&&p.hasteUntil>state.time));await page.screenshot({path:path.join(work,'character-match.png')});
 await friend.close();await page.click('#leave-game');await page.locator('#home-panel').waitFor({state:'visible'});await page.click('#career-open');await page.click('#appearance-open');await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(work,'character-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS: first-entry design, persisted appearance, room-page creation and friend join, collection claims, limited skill, shared NPC appearance, mobile layout');
}finally{await browser?.close();server.kill();await new Promise(resolve=>server.once('exit',resolve));rmSync(temp,{recursive:true,force:true});}
