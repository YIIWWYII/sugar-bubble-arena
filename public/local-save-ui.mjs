import { openLobbyPage, closeLobbyPage } from './career-ui.mjs';
import { readLocalProfile, writeLocalProfile, saveEnvelope, validateSave } from './local-profile.mjs';

export function setupLocalSaveUI() {
  const $ = id => document.getElementById(id);
  $('account-open').textContent = '本地存档';
  $('account-dialog').setAttribute('aria-label','本地存档');
  $('account-dialog').querySelector('.window-title span').textContent = '本地存档';
  $('account-dialog').querySelector('.window-content').innerHTML = `
    <h2>存档管理</h2><p>角色、装扮、养成资源与图鉴保存在当前浏览器，不会自动同步至其他设备。</p>
    <p>清除浏览器数据或更换访问地址后，原存档不会自动恢复。请定期导出备份。</p>
    <button id="save-export" class="gold-button">导出存档</button>
    <label class="field" style="margin-top:24px">导入存档文件<input id="save-import" type="file" accept=".json,application/json"></label>
    <p id="save-preview"></p><button id="save-confirm" class="blue-button" hidden>确认替换当前存档并重新进入</button>
    <p id="save-status" role="status"></p>`;
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
