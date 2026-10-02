import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProfileStore} from '../profiles.mjs';
import {freshProfile} from '../public/progression.mjs';

test('JSON migration is retained, idempotent and survives restart and SQLite backup restore',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'bubble-account-'));
 try{
  const id='a'.repeat(48),old=path.join(dir,'profiles.json'),file=path.join(dir,'profiles.sqlite');
  const original={...freshProfile(),coins:567};writeFileSync(old,JSON.stringify({[id]:original}));
  let store=new ProfileStore(file);assert.equal(store.view(id).coins,567);
  store.change(id,{type:'upgrade',kind:'attribute',key:'speed'});const coins=store.view(id).coins;
  store=new ProfileStore(file);assert.equal(store.view(id).coins,coins);assert.equal(JSON.parse(readFileSync(old))[id].coins,567);
  const backup=store.backup();const recovered=new ProfileStore(backup);assert.deepEqual(recovered.view(id),store.view(id));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('account binding, cross-device login, password rejection, logout and one-use recovery',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'bubble-account-'));
 try{
  const file=path.join(dir,'profiles.sqlite'),store=new ProfileStore(file),id=store.create();
  store.change(id,{type:'upgrade',kind:'attribute',key:'speed'});
  const saved=store.view(id),registered=await store.register('Player_One','password-test-123',id);
  assert.equal(store.identify(`qqt_session=${registered.token}`),id);
  assert.equal(store.identify(`qqt_profile=${id}`),null,'old guest cookie cannot bypass password');
  await assert.rejects(store.login('Player_One','wrong-password-123'),/不正确/);
  await assert.rejects(store.register('player_one','password-test-123',store.create()),/已存在/);
  const device2=new ProfileStore(file),login=await device2.login('PLAYER_ONE','password-test-123');
  assert.equal(device2.identify(`qqt_session=${login.token}`),id);assert.equal(device2.view(id).coins,saved.coins);
  device2.logout(`qqt_session=${login.token}`);assert.equal(device2.identify(`qqt_session=${login.token}`),null);
  const reset=await store.recover('player_one','new-password-456',registered.recovery);
  assert.equal(store.identify(`qqt_session=${registered.token}`),null);
  await assert.rejects(store.recover('player_one','new-password-789',registered.recovery),/不正确/);
  await assert.rejects(store.login('player_one','password-test-123'),/不正确/);
  assert.equal((await store.login('player_one','new-password-456')).id,id);
  const raw=readFileSync(file).toString('latin1');assert(!raw.includes('password-test-123'));assert(!raw.includes(registered.recovery));assert(!raw.includes(reset.token));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
