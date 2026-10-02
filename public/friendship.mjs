import { TOWN_RESIDENTS } from './town.mjs';
import { NPC_DESIGNS } from './appearance.mjs';
export const FRIENDS = Object.fromEntries(Object.entries(NPC_DESIGNS).slice(0,5).map(([key,value])=>[`npc-${key}`,{...value,name:TOWN_RESIDENTS[key],id:`npc-${key}`,kind:'npc'}]));
export const GIFTS = {
  candy:{name:'糖果小袋',coins:15,gems:0,affinity:5,icon:'🍬'},
  tea:{name:'暖茶礼盒',coins:40,gems:0,affinity:15,icon:'🍵'},
  ribbon:{name:'星纹纪念章',coins:90,gems:0,affinity:35,icon:'🎖️'},
  star:{name:'星光挂饰',coins:0,gems:1,affinity:12,icon:'⭐'},
};
export const RELATIONS = {acquaintance:{name:'相识',min:0},friend:{name:'朋友',min:20},partner:{name:'伙伴',min:60},confidant:{name:'挚友',min:120}};
export const freshSocial = () => ({nickname:'糖友',contacts:{}});
export const contactOf = (profile,id) => profile.social?.contacts?.[id] || {alias:'',affinity:0,relation:'acquaintance',gifts:0,chatDay:'',chatCount:0};
export function validateSocial(source) {
  if(source===undefined)return freshSocial();
  if(!source || typeof source.nickname!=='string' || !source.nickname.trim() || source.nickname.length>12 || !source.contacts || typeof source.contacts!=='object' || Array.isArray(source.contacts))throw Error('交友存档无效');
  const next={nickname:source.nickname,contacts:{}};
  for(const [id,c] of Object.entries(source.contacts)){
    if(!Object.hasOwn(FRIENDS,id) || !c || typeof c.alias!=='string' || c.alias.length>12 || !Object.hasOwn(RELATIONS,c.relation))throw Error('联系人存档无效');
    for(const k of ['affinity','gifts','chatCount'])if(!Number.isSafeInteger(c[k])||c[k]<0)throw Error('好感度存档无效');
    if(c.affinity>200 || c.chatCount>5 || c.affinity<RELATIONS[c.relation].min || typeof c.chatDay!=='string' || !/^(?:|\d{4}-\d{2}-\d{2})$/.test(c.chatDay))throw Error('关系存档无效');
    next.contacts[id]={alias:c.alias,affinity:c.affinity,relation:c.relation,gifts:c.gifts,chatDay:c.chatDay,chatCount:c.chatCount};
  }
  return next;
}
export function changeFriendship(profile,action,now=Date.now()) {
  profile.social=validateSocial(profile.social);
  if(action.type==='nickname'){
    if(typeof action.value!=='string' || !action.value.trim() || action.value.trim().length>12)throw Error('昵称请输入 1–12 个字符');
    profile.social.nickname=action.value.trim();return;
  }
  if(!Object.hasOwn(FRIENDS,action.id))throw Error('请选择有效的 NPC 联系人');
  const c={...contactOf(profile,action.id)};
  if(action.type==='settings'){
    if(typeof action.alias!=='string'||action.alias.trim().length>12)throw Error('备注最多 12 个字符');
    if(!Object.hasOwn(RELATIONS,action.relation)||c.affinity<RELATIONS[action.relation].min)throw Error('好感度尚未达到该关系要求');
    c.alias=action.alias.trim();c.relation=action.relation;
  } else if(action.type==='alias'){
    if(typeof action.value!=='string'||action.value.trim().length>12)throw Error('备注最多 12 个字符');c.alias=action.value.trim();
  } else if(action.type==='relation'){
    if(!Object.hasOwn(RELATIONS,action.value) || c.affinity<RELATIONS[action.value].min)throw Error('好感度尚未达到该关系要求');c.relation=action.value;
  } else if(action.type==='gift'){
    if(!Object.hasOwn(GIFTS,action.gift))throw Error('礼物不存在');const gift=GIFTS[action.gift];
    if(c.affinity>=200)throw Error('好感度已满，无需继续消耗资源');
    if(profile.coins<gift.coins || profile.gems<gift.gems)throw Error('资源不足，赠礼未完成');
    profile.coins-=gift.coins;profile.gems-=gift.gems;c.affinity=Math.min(200,c.affinity+gift.affinity);c.gifts++;
  } else if(action.type==='chat'){
    const day=new Date(now+8*60*60*1000).toISOString().slice(0,10);
    if(c.chatDay!==day){c.chatDay=day;c.chatCount=0;}
    if(c.chatCount<5){c.chatCount++;c.affinity=Math.min(200,c.affinity+1);}
  } else throw Error('无效的交友操作');
  profile.social.contacts[action.id]=c;
}
