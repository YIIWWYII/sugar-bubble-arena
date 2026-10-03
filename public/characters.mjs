// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
// Character identity is independent of cosmetic equipment and growth skills.
export const CHARACTERS = {
  sea:{name:'海王子',role:'均衡守护',color:'#49bce8',speed:0,capacity:0,power:0,hp:0,fuse:3.001,bubble:'潮汐泡泡',trait:'均衡的速度与泡泡数量，适合初次出战。',skill:'潮汐庇护',description:'获得 2 秒护盾，解除减速与滑行。',cooldown:24,look:{hair:0,outfit:0,style:0,eyes:0,mouth:0}},
  wind:{name:'风铃',role:'机动游击',color:'#74d89b',speed:0.6,capacity:0,power:0,hp:-1,fuse:2.4,bubble:'疾风泡泡',trait:'速度 +0.6，生命 -1；普通泡泡 2.4 秒引爆，需更快撤离。',skill:'轻羽疾行',description:'移动加速 4 秒，起步获得 0.6 秒护盾。',cooldown:20,look:{hair:5,outfit:4,style:1,eyes:1,mouth:1}},
  stone:{name:'岩卫',role:'重装防守',color:'#e3b969',speed:-0.5,capacity:-1,power:1,hp:3,fuse:3.6,bubble:'岩甲泡泡',trait:'生命 +3、威力 +1；速度 -0.5、泡数 -1，普通泡泡 3.6 秒引爆。',skill:'磐石守卫',description:'获得 3 秒护盾，解除减速。',cooldown:28,look:{hair:4,outfit:2,style:2,eyes:0,mouth:2}},
  star:{name:'星术师',role:'范围布阵',color:'#b995f5',speed:-0.2,capacity:1,power:0,hp:0,fuse:3.2,bubble:'星轨泡泡',trait:'泡数 +1、速度 -0.2；普通泡泡 3.2 秒引爆，便于连续布阵。',skill:'星光涌动',description:'6 秒内放置的泡泡威力 +2，并吸取附近增益道具。',cooldown:26,look:{hair:3,outfit:3,style:1,eyes:2,mouth:1}},
};
export const characterOf = id => CHARACTERS[id] || CHARACTERS.sea;
export function validateCharacter(id='sea') {if(!Object.hasOwn(CHARACTERS,id))throw Error('人物模板无效');return id;}
export const characterHealth = p => 5 + characterOf(p.character).hp;

// Each profession owns independent ranks; shared Q skills remain compatible.
export const PROFESSION_TREES = {
 sea: [
  {name:'潮汐延续',description:'每级使潮汐庇护延长 0.5 秒'},
  {name:'回流节律',description:'每级使职业技能冷却缩短 2 秒'},
  {name:'净潮',description:'施放时清除冻结与眩晕，每级额外获得 1 秒道具吸引'}
 ],
 wind: [
  {name:'长风',description:'每级使轻羽疾行加速延长 1 秒'},
  {name:'轻羽回旋',description:'每级使职业技能冷却缩短 2 秒'},
  {name:'疾行护体',description:'每级使起步护盾延长 0.3 秒，并解除滑行与减速'}
 ],
 stone: [
  {name:'厚重岩甲',description:'每级使磐石守卫护盾延长 0.75 秒'},
  {name:'坚壁回响',description:'每级使职业技能冷却缩短 2 秒'},
  {name:'震荡备战',description:'施放时每级获得 2 秒强力糖泡效果，期间新泡泡威力 +2'}
 ],
 star: [
  {name:'星轨延展',description:'每级使星光涌动的强化与吸引延长 1 秒'},
  {name:'星辰轮转',description:'每级使职业技能冷却缩短 2 秒'},
  {name:'星光跃动',description:'施放时每级获得 1 秒加速与 0.3 秒护盾'}
 ]
};
export function professionRanks(profile, id=profile.character || 'sea') {
 return [0,1,2].map(i => Math.max(0,Math.min(3,Math.floor(profile.professions?.[id]?.[i] || 0))));
}
export function validateProfessions(value={}) {
 const result={};
 for(const id of Object.keys(PROFESSION_TREES)){
  const ranks=value[id] ?? [0,0,0];
  if(!Array.isArray(ranks)||ranks.length!==3||ranks.some(n=>!Number.isInteger(n)||n<0||n>3)|| (ranks[1]>0&&ranks[0]<1)||(ranks[2]>0&&ranks[1]<1)) throw Error('职业技能树存档无效');
  result[id]=[...ranks];
 }
 return result;
}
