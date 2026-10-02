import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {chromium} from '@playwright/test';
const temp=mkdtempSync(path.join(os.tmpdir(),'bubble-ui-')),port=18909,base=`http://localhost:${port}`;
let server,browser;const start=async()=>{server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),PUBLIC_ORIGIN:'',PROFILE_FILE:path.join(temp,'profiles.sqlite')},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);server.once('exit',c=>j(Error('startup '+c)))});};
const stop=()=>new Promise(r=>{server.once('exit',r);server.kill()});
try{
 await start();browser=await chromium.launch({channel:'chrome',headless:true});const a=await browser.newContext(),p=await a.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await p.locator('#entry-guest').click();await p.locator('#appearance-skip').click();await p.locator('#account-open').click();
 await p.locator('#account-name').fill('ui_player');await p.locator('#account-password').fill('ui-password-123');await p.locator('#account-submit').click();await p.locator('#account-recovery-result').waitFor({state:'visible'});
 const recovery=await p.locator('#account-recovery-code').textContent();assert.equal(recovery.length,36);await p.locator('#account-done').click();await p.waitForLoadState('networkidle');
 const saved=await p.evaluate(()=>fetch('/api/profile').then(r=>r.json()));assert.equal(saved.accountName,'ui_player');
 await stop();await start();await p.reload();assert.deepEqual(await p.evaluate(()=>fetch('/api/profile').then(r=>r.json())),saved);
 const b=await browser.newContext({viewport:{width:390,height:844}}),q=await b.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto(base);assert(await q.locator('#entry-screen').isVisible());assert.equal(await q.locator('#appearance-dialog').isVisible(),false);await q.locator('#entry-name').fill('ui_player');await q.locator('#entry-password').fill('wrong-password');await q.locator('#entry-submit').click();await q.waitForFunction(()=>document.getElementById('entry-status').textContent.includes('不正确'));
 await q.locator('#entry-password').fill('ui-password-123');await q.locator('#entry-submit').click();await q.locator('#career-open:not([disabled])').waitFor();assert.equal(await q.locator('#appearance-dialog').isVisible(),false);assert.deepEqual(await q.evaluate(()=>fetch('/api/profile').then(r=>r.json())),saved);
 await q.locator('#account-open').click();assert(await q.locator('#account-current').textContent().then(t=>t.includes('ui_player')));assert(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await Promise.all([q.waitForNavigation({waitUntil:'networkidle'}),q.locator('#account-logout').click()]);assert.equal((await q.evaluate(()=>fetch('/api/profile').then(r=>r.json()))).accountName,undefined);
 // New accounts enter character creation once; returning guests do not inherit accounts.
 await q.locator('#entry-screen').waitFor({state:'visible'});
 await q.screenshot({path:'../../work/login-mobile.png',fullPage:true});
 await q.locator('[data-entry-mode="register"]').click();await q.locator('#entry-name').fill('first_character');await q.locator('#entry-password').fill('new-player-123');await q.locator('#entry-submit').click();await q.locator('#entry-recovery-result').waitFor({state:'visible'});await q.locator('#entry-done').click();await q.locator('#appearance-dialog').waitFor({state:'visible'});
 await q.keyboard.press('Escape');assert(await q.locator('#appearance-dialog').isVisible());
 await q.locator('#appearance-skip').click();await q.locator('#home-panel').waitFor({state:'visible'});
 assert.equal((await q.evaluate(()=>fetch('/api/profile').then(r=>r.json()))).appearanceConfigured,true);
 await q.reload();await q.locator('#entry-guest').click();await q.locator('#appearance-dialog').waitFor({state:'visible'});
 assert.equal((await q.evaluate(()=>fetch('/api/profile').then(r=>r.json()))).accountName,undefined);
 await q.locator('#appearance-skip').click();await q.locator('#home-panel').waitFor({state:'visible'});await q.reload();await q.locator('#entry-guest').click();await q.locator('#career-open:not([disabled])').waitFor();assert.equal(await q.locator('#appearance-dialog').isVisible(),false);
 await p.reload();await p.screenshot({path:'../../work/login-desktop.png',fullPage:true});
 const denied=await fetch(base+'/api/account/login',{method:'POST',headers:{origin:'https://unrelated.invalid','content-type':'application/json'},body:'{}'});assert.equal(denied.status,403);
 assert.equal((await fetch(base+'/.runtime/profiles.sqlite')).status,404);assert.deepEqual(errors,[]);
 console.log('PASS: register UI, recovery code, process restart, wrong-password UI, mobile login, cross-device persistence, logout, origin validation, database private, no browser errors');
}finally{await browser?.close();if(server&&!server.killed)await stop();rmSync(temp,{recursive:true,force:true});}
