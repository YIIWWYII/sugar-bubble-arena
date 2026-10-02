// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { FRIENDS, GIFTS, RELATIONS, contactOf } from './friendship.mjs';
import { localMode } from './local-profile.mjs';
import { readMessages } from './social-db.mjs';
import { portraitURL } from './appearance.mjs';
export function friendsUI(send,images,initialProfile) {
  const $=id=>document.getElementById(id);
  let profile=initialProfile,selected=Object.keys(FRIENDS)[0],pending=null,messages=[],loadVersion=0;
  const portraits=new Map(Object.entries(FRIENDS).map(([id,n])=>[id,portraitURL(images.get('prince-red-stand-3'),n)]));
  const status=text=>{ $('friend-status').textContent=text;if($('friend-self-status'))$('friend-self-status').textContent=text; };
  function lock(value){for(const el of [...$('friends-dialog').querySelectorAll('input,select,button'),...$('friend-self-form').querySelectorAll('input,button')])if(!['close-friends','battle-open','career-open','town-open','guide-open','friends-open'].includes(el.id))el.disabled=value;}
  function renderHistory(){
    const log=$('friend-history');log.replaceChildren();
    if(!messages.length){const p=document.createElement('p');p.textContent='还没有聊天记录，发送一句问候吧。';log.append(p);}
    for(const m of messages){const row=document.createElement('p'),name=document.createElement('b'),body=document.createElement('span'),time=document.createElement('small');
      row.className=`friend-message ${m.kind}`;name.textContent=`${m.kind==='npc'?'NPC':m.kind==='player'?'玩家 · 你':'系统'} · ${m.kind==='npc' ? FRIENDS[selected].name : m.sender || m.name}`;body.textContent=m.text;time.textContent=new Date(m.time).toLocaleString();row.append(name,body,time);log.append(row);}
    log.scrollTop=log.scrollHeight;
  }
  function render(){
    const c=contactOf(profile,selected),npc=FRIENDS[selected];
    $('friend-name').textContent=c.alias?`${c.alias}（${npc.name}）`:npc.name;
    $('friend-portrait').src=portraits.get(selected);$('friend-portrait').alt=npc.name;
    $('friend-relation-label').textContent=`关系：${RELATIONS[c.relation].name} · 已赠礼 ${c.gifts} 次`;
    $('friend-affinity-label').textContent=`好感度 ${c.affinity} / 200`;$('friend-affinity').value=c.affinity;
    $('friend-self-name').value=profile.social?.nickname || '糖友';$('friend-alias').value=c.alias;
    $('friend-relation').replaceChildren();for(const [key,r] of Object.entries(RELATIONS)){const o=new Option(`${r.name} · 需要 ${r.min} 好感度`,key);o.disabled=c.affinity<r.min;$('friend-relation').add(o);}$('friend-relation').value=c.relation;
    for(const b of $('friend-list').children){const data=contactOf(profile,b.dataset.id);b.querySelector('span').textContent=data.alias || FRIENDS[b.dataset.id].name;b.setAttribute('aria-pressed',String(b.dataset.id===selected));}
  }
  async function load(){const version=++loadVersion;messages=[];renderHistory();try{const rows=await readMessages(selected);if(version===loadVersion){messages=rows;renderHistory();}}catch{if(version===loadVersion)status('聊天数据库读取失败，请检查浏览器存储权限。');}}
  function action(data){if(pending)return;pending=crypto.randomUUID();lock(true);status('正在保存…');send({type:'friend-action',requestId:pending,action:{id:selected,...data}});}
  function selectFriend(id,section='chat') {
    if(pending || !FRIENDS[id])return;
    selected=id;status('');$('friend-gift-confirmation').hidden=true;
    $('friend-content').hidden=false;$('friend-player-notice').hidden=true;
    $('friends-npc').setAttribute('aria-pressed','true');$('friends-players').setAttribute('aria-pressed','false');
    $('friends-dialog').querySelector('.friend-main').hidden=false;render();load();
    const target=$(section==='gift'?'friend-gift':section==='settings'?'friend-alias':'friend-message');
    target.focus({preventScroll:true});
    const sidebar=$('friends-dialog').parentElement;
    sidebar.scrollTop+=target.getBoundingClientRect().top-sidebar.getBoundingClientRect().top-sidebar.clientHeight/2;
  }
  window.addEventListener('town-npc-action',e=>selectFriend(e.detail.id,e.detail.action));
  for(const [id,npc] of Object.entries(FRIENDS)){const b=document.createElement('button'),im=document.createElement('img'),name=document.createElement('span'),badge=document.createElement('small');b.type='button';b.dataset.id=id;im.src=portraits.get(id);im.alt='';name.textContent=npc.name;badge.textContent='NPC';b.append(im,name,badge);b.onclick=()=>{selectFriend(id);};$('friend-list').append(b);}
  for(const [key,g] of Object.entries(GIFTS))$('friend-gift').add(new Option(`${g.icon} ${g.name} · ${g.coins?g.coins+' 糖币':g.gems+' 技能星'} · 好感 +${g.affinity}`,key));
  $('close-friend-detail').onclick=()=>{$('friends-dialog').querySelector('.friend-main').hidden=true;};
  for(const [id,isNPC] of [['friends-npc',true],['friends-players',false]])$(id).onclick=()=>{$('friend-content').hidden=!isNPC;$('friend-player-notice').hidden=isNPC;$(id).setAttribute('aria-pressed','true');$(isNPC?'friends-players':'friends-npc').setAttribute('aria-pressed','false');};
  $('friend-self-form').onsubmit=e=>{e.preventDefault();action({type:'nickname',value:$('friend-self-name').value});};
  $('friend-settings').onsubmit=e=>{e.preventDefault();action({type:'settings',alias:$('friend-alias').value,relation:$('friend-relation').value});};
  $('friend-chat-form').onsubmit=e=>{e.preventDefault();if($('friend-message').value.trim())action({type:'chat',text:$('friend-message').value.trim()});};
  $('friend-gift-open').onclick=()=>{const g=GIFTS[$('friend-gift').value];$('friend-gift-summary').textContent=`向${contactOf(profile,selected).alias || FRIENDS[selected].name}赠送${g.name}，消耗 ${g.coins} 糖币、${g.gems} 技能星，好感度增加 ${Math.min(g.affinity,200-contactOf(profile,selected).affinity)}。当前持有 ${profile.coins} 糖币、${profile.gems} 技能星。`;$('friend-gift-confirmation').hidden=false;};
  $('friend-gift').onchange=()=>{$('friend-gift-confirmation').hidden=true;};$('friend-gift-cancel').onclick=()=>{$('friend-gift-confirmation').hidden=true;};
  $('friend-gift-send').onclick=()=>action({type:'gift',gift:$('friend-gift').value});
  window.addEventListener('lobby-page-change',e=>{if(e.detail==='town-dialog'){if(pending)return;if(!localMode){$('friend-content').hidden=true;status('当前交友功能仅在公网单人版开放。');lock(true);return;}render();load();}});
  render();
  return {message(m){
    if(['profile','round-reward'].includes(m.type) && m.profile){profile=m.profile;if(!pending)render();}
    if(m.type==='friend-result' && m.requestId===pending){pending=null;lock(false);if(m.error){status(m.error);render();return;}profile=m.profile;messages.push(...(m.entries||[]));render();renderHistory();$('friend-message').value='';$('friend-gift-confirmation').hidden=true;status(m.warning || '已保存');}
    if(m.type==='error' && pending){pending=null;lock(false);render();status(m.message);}
  }};
}
