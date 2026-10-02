// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
// 小镇地形由客户端与服务端共用，移动及碰撞由服务端裁定。
export const TOWN_RESIDENTS = {easy:'栗栗',normal:'青禾',hard:'星野',boss:'岩叔',runner:'小满'};
export const TOWN = { width: 1280, height: 960, spawn: { x: 640, y: 570 } };
export const TOWN_BUILDINGS = [
  {
    x: 180,
    y: 150,
    w: 240,
    h: 170,
    name: "对战会馆",
    page: "rooms-dialog",
    color: "#238ab6",
  },
  {
    x: 860,
    y: 150,
    w: 240,
    h: 170,
    name: "装扮工坊",
    page: "appearance-dialog",
    color: "#ae76b5",
  },
  {
    x: 180,
    y: 650,
    w: 240,
    h: 170,
    name: "探索书屋",
    page: "guide-dialog",
    color: "#d8a344",
  },
  {
    x: 860,
    y: 650,
    w: 240,
    h: 170,
    name: "糖果茶馆",
    page: "tea-dialog",
    color: "#d67c89",
  },
];
export function townEntrance(building) {
  return {x:building.x+building.w/2,y:building.y+building.h+28};
}
export function townClickedBuilding(point) {
  return TOWN_BUILDINGS.find(b=>point.x>=b.x-12 && point.x<=b.x+b.w+12 && point.y>=b.y-40 && point.y<=b.y+b.h+42);
}
export function townWalkable(x, y) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 24 &&
    y >= 40 &&
    x <= TOWN.width - 24 &&
    y <= TOWN.height - 24 &&
    !TOWN_BUILDINGS.some(
      (b) =>
        x > b.x - 12 &&
        x < b.x + b.w + 12 &&
        y > b.y - 10 &&
        y < b.y + b.h + 12,
    ) &&
    Math.hypot(x - 640, y - 430) > 66
  );
}
export function moveTown(p, dt) {
  const dx = p.input?.x || 0,
    dy = p.input?.y || 0,
    n = Math.hypot(dx, dy) || 1,
    s = 150 * Math.min(dt, 0.1);
  const x = p.x + (dx / n) * s,
    y = p.y + (dy / n) * s;
  const beforeX = p.x, beforeY = p.y;
  if (dx) p.dir = dx > 0 ? 0 : 2;
  else if (dy) p.dir = dy > 0 ? 3 : 1;
  if (townWalkable(x, p.y)) p.x = x;
  if (townWalkable(p.x, y)) p.y = y;
  p.moving = p.x !== beforeX || p.y !== beforeY;
}

// Shared navigation: only traversable grid edges, with exact final coordinates.
function clearSegment(a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5));
  for(let i=0;i<=steps;i++) if(!townWalkable(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps)) return false;
  return true;
}
export function townPath(start, goal) {
  if(!townWalkable(goal.x,goal.y)) return null;
  if(clearSegment(start,goal)) return [{...goal}];
  const size=20, cols=TOWN.width/size;
  const point=k=>({x:(k%cols)*size,y:Math.floor(k/cols)*size});
  const nearest=p=>{
    let best=null,distance=Infinity;
    for(let y=40;y<TOWN.height;y+=size) for(let x=40;x<TOWN.width;x+=size){
      const d=Math.hypot(x-p.x,y-p.y);
      if(d<distance&&clearSegment(p,{x,y})){best=y/size*cols+x/size;distance=d;}
    }
    return best;
  };
  const first=nearest(start),last=nearest(goal);if(first===null||last===null)return null;
  const queue=[first],parents=new Map([[first,null]]);
  for(let i=0;i<queue.length&&!parents.has(last);i++) {
    const key=queue[i],a=point(key);
    for(const offset of [-1,1,-cols,cols]){
      const next=key+offset,b=point(next);
      if(Math.hypot(a.x-b.x,a.y-b.y)!==size||parents.has(next)||!clearSegment(a,b))continue;
      parents.set(next,key);queue.push(next);
    }
  }
  if(!parents.has(last))return null;
  const route=[{...goal}];for(let key=last;key!==null;key=parents.get(key))route.push(point(key));
  route.reverse();return route;
}
export function stepTown(p,dt) {
  if(!p.path?.length){moveTown(p,dt);return;}
  let budget=150*Math.min(dt,.1);p.moving=false;
  while(p.path.length&&budget>0){
    const target=p.path[0],dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);
    if(d<.001){p.path.shift();continue;}
    p.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?0:2):(dy>0?3:1);
    const step=Math.min(budget,d),next={x:p.x+dx/d*step,y:p.y+dy/d*step};
    if(!clearSegment(p,next)){p.path=[];p.input={x:0,y:0};break;}
    p.x=next.x;p.y=next.y;p.moving=true;budget-=step;
    if(step===d)p.path.shift();
  }
  if(!p.path.length){p.input={x:0,y:0};p.moving=false;}
}
export function createTownNPCs(appearances) {
  return Object.entries(appearances).slice(0,5).map(([key,appearance],i)=>({id:`npc-${key}`,npc:true,name:TOWN_RESIDENTS[key] || '小镇居民',appearance,x:480+i*70,y:570,dir:3,input:{x:0,y:0},path:[],pauseUntil:0,routeIndex:i}));
}
const activities = [
  {x:480,y:360,name:'训练',line:'先练习走位，再放置糖泡。',duration:5500},
  {x:800,y:360,name:'整理装备',line:'出发前，检查一下今天的装备。',duration:6500},
  {x:800,y:600,name:'休息',line:'休息片刻，下一场再继续挑战。',duration:8000},
  {x:480,y:600,name:'阅读',line:'图鉴中的每次发现都值得记录。',duration:7000},
  {x:640,y:850,name:'观景',line:'广场的水声，总能让人放松。',duration:6000},
];
const conversations = [
  [
    '今天的目标：放完泡泡，还能找到回去的路。',
    '训练时记得给自己留一条退路。',
    '我刚学会绕柱子。还没学会不绕晕自己。',
    '再练一局。真的，这回只练一局。',
    '经典抢包中，自己的糖泡也会造成伤害。',
    '刚才那次不算，我先看了一眼你的帽子。',
    '想试试走位，可以进入自由练习。',
    '我把训练计划写好了，第一条是别紧张。',
    '输给困难对手以后，我先去茶馆坐了一会儿。',
    '新鞋很轻，就是还没习惯转弯。',
    '抢到包子以后，我连路边的糖币都不敢多看。',
    '等我练熟了，也想带别人认识这张地图。',
  ],
  [
    '广场巡查完毕。今天没有人往喷泉里放泡泡。',
    '门口请留条路，茶馆主人还要搬东西。',
    '你可以直接点击建筑，我带路就不必了。',
    '刚才有人问路，问完和我一起走反了。',
    '这里的每块地砖我都认识，除了那块总绊脚的。',
    '巡逻不只是走路，还要看看大家有没有需要帮忙。',
    '今天很安静，适合慢慢走一圈。',
    '出发前检查装备，比进场以后着急要好。',
    '翅膀和坐骑只是外观，不改变碰撞范围。',
    '角色界面可以预览装扮的四个方向。',
    '我也想换顶帽子，不过这顶已经戴习惯了。',
    '有事可以叫我。没事也可以打个招呼。',
  ],
  [
    '赢了可以再来一局，输了更得再来一局。',
    '别急着追击，先看对手给自己留了哪条路。',
    '我也会失误，只是尽量不在同一个地方失误。',
    '香蕉皮摆得好，比跑得快还管用。',
    '生化潜伏期内，可以使用随身解毒剂。',
    '援助物资里可能还有其他补给。',
    '首领准备攻击的时候，先找掩体。',
    '幸存者中，糖泡和地面陷阱可以配合使用。',
    '熟悉一张地图，比急着换下一张更有用。',
    '今天不比赛。我来看看见习队员练得怎么样。',
    '别只记着输赢，也想想这一局学会了什么。',
    '休息好了再练，手忙的时候脑子也容易跟着乱。',
  ],
  [
    '这顶王冠有点重。先替我保密。',
    '披风要整理好，不然坐下时会压住。',
    '我说来茶馆巡视，其实是来看看还有没有点心。',
    '威严当然重要，但早饭也不能少。',
    '刚才那阵风很好。再大一点，王冠就要飞了。',
    '装备整齐了，出门也精神些。',
    '这身装扮只是看着结实，可别拿它试糖泡。',
    '工坊里每个小零件，都得有人耐心修好。',
    '我答应帮忙搬的箱子，已经搬进去了。',
    '茶馆椅子有点小，不过坐得下。',
    '图鉴奖励记得领取，收集到了不等于领过了。',
    '如果你找到更轻的王冠，记得告诉我。',
  ],
  [
    '别紧张，今天只是出来散步。',
    '我走得快，但在小镇里会慢一点。',
    '这边通向书屋。别问我怎么知道，我来过很多次。',
    '今天不追人，追一片被风吹走的叶子。',
    '我喜欢站在喷泉旁边，水声听着舒服。',
    '地图越大，越要记住自己从哪里来。',
    '海盗水手可以在首领挑战的水域地图中找到。',
    '我看过图鉴里的画像，画得还挺像。',
    '正式对局中的发现，会在结算后记入图鉴。',
    '那边的居民又在练转身了，一会儿朝左一会儿朝右。',
    '别把我的散步路线当捷径，我偶尔也会绕远。',
    '你先走吧，我还想在这里待一会儿。',
  ],
];
const rareConversations = {
  1:'以前做错了，总有人提醒。后来慢慢改了不少，偶尔还是想让那个人知道。',
  3:'以前总说，改天给你做好。后来才懂，答应的事要做完，不能只让人等。',
  4:'修小镇的人不常玩这个。不过，他记得有人很喜欢。',
};
export function talkTownNPC(npcs, actor, npcId, now, random = Math.random) {
  const npc=npcs.find(n=>n.id===npcId);
  if(!npc || Math.hypot(npc.x-actor.x,npc.y-actor.y)>105 || now<(npc.talkReadyAt||0))return false;
  npc.talkReadyAt=now+700;
  const index=npcs.indexOf(npc)%conversations.length, lines=conversations[index];
  const count=npc.talkIndex||0;
  if(count>=3 && !npc.rareSpoken && rareConversations[index] && random()<0.03){
    npc.bubble=rareConversations[index];npc.rareSpoken=true;
  } else {
    npc.bubble=lines[count%lines.length];npc.talkIndex=count+1;
  }
  npc.path=[];npc.input={x:0,y:0};npc.moving=false;npc.activity='交谈';npc.pauseUntil=now+Math.max(6500,npc.bubble.length*220);npc.bubbleUntil=npc.pauseUntil;
  const dx=actor.x-npc.x,dy=actor.y-npc.y;
  npc.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?0:2):(dy>0?3:1);
  return true;
}
export function tickTownNPC(p,dt,now) {
  if(!p.path.length && now<p.pauseUntil){
    p.moving=false;
    if(p.activity==='训练')p.dir=Math.floor(now/700)%4;
    return;
  }
  if(!p.path.length){
    p.routeIndex=(p.routeIndex+1)%activities.length;
    p.path=townPath(p,activities[p.routeIndex])||[];p.activity='散步';
  }
  const walking=p.path.length>0;stepTown(p,dt);
  if(walking&&!p.path.length){
    const a=activities[p.routeIndex];p.activity=a.name;p.pauseUntil=now+a.duration;
    p.bubble=a.line;p.bubbleUntil=now+4500;p.dir=3;
  }
}
