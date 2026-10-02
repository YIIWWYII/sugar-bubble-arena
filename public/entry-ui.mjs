// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { localMode, readLocalProfile, writeLocalProfile } from "./local-profile.mjs";
// Entry is resolved only after an explicit identity choice and a server profile.
export function enterGame() {
  if (localMode) return enterLocalGame();
  const $ = id => document.getElementById(id);
  let mode = 'login', busy = false;
  const profile = async () => {
    const response = await fetch('/api/profile', {cache:'no-store'});
    if(!response.ok) throw Error('无法读取存档，请检查连接后重试');
    return response.json();
  };
  const post = async (kind, body = {}) => {
    const response = await fetch(`/api/account/${kind}`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const data = await response.json();
    if(!response.ok) throw Error(data.error || '登录未完成，请重试');
    return data;
  };
  const lock = value => {
    busy = value;
    for(const button of document.querySelectorAll('#entry-screen button')) button.disabled = value;
  };
  for(const button of document.querySelectorAll('[data-entry-mode]')) button.onclick = () => {
    if(busy) return;
    mode = button.dataset.entryMode;
    $('entry-submit').textContent = {login:'账号登录',register:'注册并进入',recover:'重设密码并进入'}[mode];
    $('entry-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('entry-recovery-field').hidden = mode !== 'recover';
    $('entry-recovery').required = mode === 'recover';
    $('entry-status').textContent = '';
    for(const choice of document.querySelectorAll('[data-entry-mode]')) choice.hidden = choice.dataset.entryMode === mode;
  };
  return new Promise(resolve => {
    const finish = async () => {
      const saved = await profile();
      history.replaceState(null,'',location.pathname + location.search);
      $('entry-password').value = '';
      $('entry-recovery').value = '';
      $('entry-screen').hidden = true;
      document.body.dataset.entry = 'loading';
      resolve(saved);
    };
    const run = async action => {
      if(busy) return;
      lock(true); $('entry-status').textContent = '正在连接…';
      try { await action(); }
      catch(error) { $('entry-status').textContent = error instanceof TypeError ? '连接失败，请检查网络后重试' : error.message; }
      finally { lock(false); }
    };
    $('entry-guest').onclick = () => run(async () => {
      // Explicit guest entry must never expose the previous account's character.
      const current = await profile();
      if(current.accountName) await post('logout');
      await finish();
    });
    $('entry-form').onsubmit = event => {
      event.preventDefault();
      run(async () => {
        if(mode === 'register') {
          const current = await profile();
          if(current.accountName) { await post('logout'); await profile(); }
        }
        const data = await post(mode,{name:$('entry-name').value,password:$('entry-password').value,recovery:$('entry-recovery').value.trim()});
        $('entry-password').value = '';
        if(data.recovery) {
          $('entry-recovery-code').textContent = data.recovery;
          $('entry-recovery-result').hidden = false;
          $('entry-form').hidden = true;
          $('entry-choices').hidden = true;
          $('entry-status').textContent = '账号已保存，请妥善保管恢复码。';
        } else await finish();
      });
    };
    $('entry-done').onclick = () => run(finish);
  });
}

function enterLocalGame() {
  const $ = id => document.getElementById(id);
  document.querySelector('#entry-screen h1').textContent = '单人游戏';
  document.querySelector('#entry-screen h1 + p').textContent = '体验单人挑战与 AI 对战，进度自动保存在当前浏览器。';
  $('entry-form').hidden = true;
  document.querySelector('.entry-links').hidden = true;
  document.querySelector('.entry-note').textContent = '暂不提供账号同步。请定期导出存档，清除浏览器数据可能导致进度丢失。';
  $('entry-guest').textContent = '进入游戏';
  return new Promise(resolve => {
    $('entry-guest').onclick = () => {
      try {
        const profile = readLocalProfile();
        const saved = writeLocalProfile(profile);
        history.replaceState(null, "", location.pathname + location.search);
        $('entry-screen').hidden = true;
        document.body.dataset.entry = 'loading';
        resolve(saved);
      } catch {
        $('entry-status').textContent = '无法读取或保存本地存档。请检查浏览器存储权限，或通过存档管理导入有效备份。';
        $('account-open').hidden = false;
      }
    };
  });
}
