import { CHARACTERS } from './characters.mjs';
import { openLobbyPage, closeLobbyPage } from './career-ui.mjs';
export function manualUI(release,restoreFocus){
  const $=id=>document.getElementById(id),content=document.createElement('div');content.id='manual-content';
  const chapters={
    controls:['操作与手机','<h2>基础操作</h2><p>方向键或 WASD 移动，空格放泡，Q 使用养成技能，F 使用角色专属技能。E 切换战术泡泡，R 引爆遥控泡泡；小镇中 E 打开居民或建筑交互。</p><h3>道具 1–4</h3><p>1 叉子：被泡泡困住时自救。2 香蕉：在脚下放置滑行陷阱。3 笑脸：在脚下放置减速陷阱。4 解毒剂：生化人类在潜伏感染期间使用。没有库存或状态不符时按钮不可用。</p><h3>手机横屏</h3><p>横置手机后，左侧摇杆移动，右侧按钮放泡和使用技能，下方小按钮使用道具。可同时操作摇杆与放泡。自动锁定方向取决于浏览器支持，无法锁定时请关闭系统方向锁定并手动旋转。</p><h3>三选一</h3><p>电脑使用主键盘 1、2、3 选择升级，出现后有短暂防误触保护；手机先点选卡片，再确认。选择升级期间不会使用同编号道具。</p>'],
    modes:['模式与地图','<h2>经典抢包</h2><p>将敌方包子运回己方包子房，先夺取三个获胜。背包时移动变慢、不能放泡。经典模式保留自身爆炸与困泡规则。</p><h2>首领挑战</h2><p>击败首领。陆地战场提供战术泡泡；水域地图保留水手、洞口和海盗首领的机制。可在同一入口选择适配地图。</p><h2>生化生存</h2><p>开局有 20 秒准备时间，并进行三次三选一。母体从场上人员中产生，感染者追击人类；感染潜伏期间可使用解毒剂。援助物资每 30 秒随机出现，内容揭晓前不显示具体物品。人类与丧尸分别强化，以模式胜利提示为准。</p><h2>幸存者</h2><p>抵御持续怪潮，通过击杀获取经验并三选一升级。生命、护盾、陷阱与泡泡组合决定生存能力。部分合作模式取消自身及友方爆炸伤害。</p><p>地图按当前模式筛选；大地图摄像机跟随人物。</p>'],
    characters:['人物与养成','<h2>人物模板与装扮</h2><p>人物模板决定基础属性、专属技能和普通泡泡。外观装扮仅改变视觉；选择模板会应用其基础发型与配色，已选翅膀、坐骑等装饰保留。保存后从下一局生效，局内不能换人物。生命差异只适用于有血条的模式，感染为丧尸后使用丧尸属性。</p>'+Object.values(CHARACTERS).map(h=>`<article><h3>${h.name} · ${h.role}</h3><p>${h.trait}</p><p>${h.bubble} · ${(h.fuse).toFixed(1)} 秒引爆。F ${h.skill}：${h.description} 冷却 ${h.cooldown} 秒。</p></article>`).join('')+'<h3>养成技能</h3><p>人物专属技使用 F，原有养成技能使用 Q，各自冷却。战术泡泡保留本身的功能和引爆时间。成长属性叠加在人物基础属性之上。首领陆地、生化和幸存者提供模式初始加成：基础泡数至少 3、威力至少 2，再计算人物差异。</p>'],
    items:['道具与泡泡','<h2>道具与战术泡泡</h2><div id="manual-items"></div>'],
    social:['小镇与交友','<h2>居民交互</h2><p>点击 NPC，或靠近后按 E，选择交谈、交友与关系、赠礼。地图右侧上方是小镇交流，下方是好友列表。点击好友可查看私聊、备注、好感度与关系。</p><p>玩家昵称在右上角个人资料中修改。NPC 明确标注为游戏角色并使用预设台词，玩家交友暂未开放。</p><h3>好感度与赠礼</h3><p>每天前 5 次私聊各增加 1 点好感度，按北京时间重置。好感度 20、60、120 分别解锁朋友、伙伴、挚友关系。礼物消耗糖币或技能星，确认后扣费；好感度上限 200。</p>'],
    saves:['资源与存档','<h2>资源与本地存档</h2><div id="manual-save"></div><p>右上角个人资料可导出或导入养成存档。聊天记录另存浏览器数据库，不包含在存档备份内。清除网站数据会删除本地进度，当前无账号同步和跨设备恢复服务。</p>']
  };
  content.innerHTML='<nav class="manual-tabs" aria-label="手册目录">'+Object.entries(chapters).map(([id,[name]])=>`<button class="blue-button" data-chapter="${id}" aria-pressed="${id==='controls'}">${name}</button>`).join('')+'</nav><div class="manual-reading">'+Object.entries(chapters).map(([id,[,body]])=>`<section data-manual="${id}" ${id==='controls'?'':'hidden'}>${body}</section>`).join('')+'</div>';
  $('manual-home').append(content);
  const guide=document.querySelector('.guide-reference');if(guide){guide.open=true;$('manual-items').append(guide);}
  const save=document.querySelector('.save-details');if(save){save.open=true;$('manual-save').append(save);}
  for(const b of content.querySelectorAll('[data-chapter]'))b.onclick=()=>{for(const other of content.querySelectorAll('[data-chapter]'))other.setAttribute('aria-pressed',String(other===b));for(const pane of content.querySelectorAll('[data-manual]'))pane.hidden=pane.dataset.manual!==b.dataset.chapter;};
  function open(){release();if(document.body.dataset.screen==='home'){ $('manual-home').append(content);openLobbyPage('manual-dialog');}else{$('manual-game').append(content);$('help-dialog').showModal();}}
  $('manual-open').onclick=open;$('help-button').onclick=open;$('help-button').textContent='游戏手册';
  $('close-manual').onclick=()=>closeLobbyPage();$('close-help').onclick=()=>{$('help-dialog').close();restoreFocus();};
  window.addEventListener('lobby-page-change',e=>{if(e.detail==='manual-dialog')$('manual-home').append(content);});
}
