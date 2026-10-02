import { localMode } from "./local-profile.mjs";
import { setupLocalSaveUI } from "./local-save-ui.mjs";
import {openLobbyPage,closeLobbyPage} from './career-ui.mjs';
const $=id=>document.getElementById(id);
if (localMode) setupLocalSaveUI();
else {
let mode='register';
$('account-open').onclick=async()=>{
  openLobbyPage('account-dialog');
  try{
    const r=await fetch('/api/profile',{cache:'no-store'});if(!r.ok)throw Error('读取账号失败');
    const p=await r.json();$('account-current').textContent=p.accountName?`当前账号：${p.accountName}`:'当前为访客。注册账号将保留现有角色、资源和装扮。';
    $('account-logout').hidden=!p.accountName;
  }catch(e){$('account-status').textContent=e.message;}
};
$('close-account').onclick=()=>closeLobbyPage();
for(const button of document.querySelectorAll('[data-account-mode]'))button.onclick=()=>{
  mode=button.dataset.accountMode;
  for(const b of document.querySelectorAll('[data-account-mode]'))b.setAttribute('aria-pressed',String(b===button));
  $('account-submit').textContent={register:'注册并保存当前进度',login:'登录账号',recover:'恢复账号并设置新密码'}[mode];
  $('account-recovery-field').hidden=mode!=='recover';
  $('account-password').autocomplete=mode==='login'?'current-password':'new-password';
  $('account-status').textContent='';
};
$('account-form').onsubmit=async event=>{
  event.preventDefault();$('account-submit').disabled=true;$('account-status').textContent='正在处理…';
  try{
    const r=await fetch(`/api/account/${mode}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:$('account-name').value,password:$('account-password').value,recovery:$('account-recovery').value.trim()})});
    const data=await r.json();if(!r.ok)throw Error(data.error);
    $('account-password').value='';$('account-recovery').value='';
    if(data.recovery){
      $('account-recovery-result').hidden=false;$('account-recovery-code').textContent=data.recovery;
      $('account-form').hidden=true;$('account-status').textContent='账号已保存。请妥善保存恢复码，再返回游戏。';
    }else location.replace(location.pathname);
  }catch(e){$('account-status').textContent=e.message;}
  finally{$('account-submit').disabled=false;}
};
$('account-done').onclick=()=>location.replace(location.pathname);
$('account-logout').onclick=async()=>{
  const r=await fetch('/api/account/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  if(r.ok)location.replace(location.pathname);else $('account-status').textContent='退出失败，请重试';
};

}
