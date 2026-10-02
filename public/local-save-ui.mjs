// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { openLobbyPage, closeLobbyPage } from './career-ui.mjs';
import { readLocalProfile, writeLocalProfile, saveEnvelope, validateSave } from './local-profile.mjs';

export function setupLocalSaveUI() {
  const $ = id => document.getElementById(id);
  $('account-open').textContent = '个人资料';
  $('account-dialog').setAttribute('aria-label','个人资料');
  $('account-dialog').querySelector('.window-title span').textContent = '个人资料';
  $('account-dialog').querySelector('.window-content').innerHTML = `
    <div id="personal-social"></div><p id="friend-self-status" role="status"></p><h2>存档管理</h2><p>角色、装扮、养成资源与图鉴保存在当前浏览器，不会自动同步至其他设备。</p>
    <p>清除浏览器数据或更换访问地址后，原存档不会自动恢复。备份包含交友关系与昵称；聊天记录单独保存在本地数据库，不包含在此备份中。</p>
    <button id="save-export" class="gold-button">导出存档</button>
    <label class="field" style="margin-top:24px">导入存档文件<input id="save-import" type="file" accept=".json,application/json"></label>
    <p id="save-preview"></p><button id="save-confirm" class="blue-button" hidden>确认替换当前存档并重新进入</button>
    <p id="save-status" role="status"></p>`;
  const social=document.getElementById('social-profile-settings');social.hidden=false;$('personal-social').append(social);
  document.querySelector('.save-details p').textContent = '完成正式对局获得糖币、技能星和经验，胜利额外奖励。新档案赠送 60 糖币、3 技能星和疾风步。档案保存在当前浏览器，可通过本地存档导出、导入备份；暂不提供账号和跨设备同步。';
  let pending;
  const open = () => {
    pending = null; $('save-confirm').hidden = true; $('save-preview').textContent = '';
    $('save-status').textContent = ''; $('save-import').value = '';
    openLobbyPage('account-dialog');
  };
  $('account-open').onclick = open;
  $('close-account').onclick = () => closeLobbyPage();
  // A damaged save can be replaced before entering the game, without erasing it.
  const entry = document.createElement('button');
  entry.className = 'secondary-link'; entry.textContent = '导入已有存档';
  document.getElementById('entry-choices').append(entry);
  entry.onclick = () => { document.body.dataset.entry = 'save'; $('entry-screen').hidden = true; open(); };
  $('close-account').addEventListener('click', () => {
    if (document.body.dataset.entry) { document.body.dataset.entry = 'login'; $('entry-screen').hidden = false; }
  });
  $('save-export').onclick = () => {
    try {
      const blob = new Blob([JSON.stringify(saveEnvelope(readLocalProfile()),null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `糖泡对战存档-${new Date().toISOString().slice(0,10)}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
      $('save-status').textContent = '已导出存档，请保存下载的文件。';
    } catch (error) { $('save-status').textContent = error.message; }
  };
  $('save-import').onchange = async () => {
    pending = null; $('save-confirm').hidden = true; $('save-preview').textContent = '';
    try {
      const file = $('save-import').files[0];
      if (!file) return;
      if (file.size > 1024*1024) throw Error('存档文件过大');
      pending = validateSave(JSON.parse(await file.text()));
      $('save-preview').textContent = `待导入：${pending.matches} 场对局 · ${pending.coins} 糖币 · ${pending.gems} 技能星。导入会替换当前进度。`;
      $('save-status').textContent = ''; $('save-confirm').hidden = false;
    } catch { $('save-status').textContent = '存档格式无效，当前进度未更改。'; }
  };
  $('save-confirm').onclick = () => {
    try {
      if (!pending) return;
      writeLocalProfile(pending);
      location.reload();
    } catch { $('save-status').textContent = '存档写入失败，未执行重新进入。请检查浏览器存储权限。'; }
  };
}
