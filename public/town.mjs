// 小镇地形由客户端与服务端共用，移动及碰撞由服务端裁定。
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
  return Object.entries(appearances).slice(0,5).map(([key,appearance],i)=>({id:`npc-${key}`,npc:true,name:appearance.name||'小镇居民',appearance,x:480+i*70,y:570,dir:3,input:{x:0,y:0},path:[],pauseUntil:0,routeIndex:i}));
}
const activities = [
  {x:480,y:360,name:'训练',line:'先练习走位，再放置糖泡。',duration:5500},
  {x:800,y:360,name:'整理装备',line:'出发前，检查一下今天的装备。',duration:6500},
  {x:800,y:600,name:'休息',line:'休息片刻，下一场再继续挑战。',duration:8000},
  {x:480,y:600,name:'阅读',line:'图鉴中的每次发现都值得记录。',duration:7000},
  {x:640,y:850,name:'观景',line:'广场的水声，总能让人放松。',duration:6000},
];
const conversations = [
  ['训练时记得给自己留一条退路。','经典抢包中，自己的糖泡也会造成伤害。','想试试走位，可以进入自由练习。'],
  ['我正在整理装备，要看看你的新装扮吗？','翅膀和坐骑只是外观，不改变碰撞范围。','角色界面可以预览装扮的四个方向。'],
  ['刚结束训练，准备休息一会儿。','生化潜伏期内，可以使用随身解毒剂。','援助物资里可能还有其他补给。'],
  ['我正在阅读图鉴中的地图记录。','正式对局中的发现，会在结算后记入图鉴。','收集奖励需要在图鉴中领取。'],
  ['欢迎来到小镇。一起看看广场吧。','海盗水手可以在首领挑战的水域地图中找到。','幸存者中，糖泡和地面陷阱可以配合使用。'],
];
export function talkTownNPC(npcs, actor, npcId, now) {
  const npc=npcs.find(n=>n.id===npcId);
  if(!npc || Math.hypot(npc.x-actor.x,npc.y-actor.y)>105 || now<(npc.talkReadyAt||0))return false;
  npc.talkReadyAt=now+700;
  const lines=conversations[npcs.indexOf(npc)%conversations.length];
  npc.bubble=lines[(npc.talkIndex||0)%lines.length];npc.talkIndex=(npc.talkIndex||0)+1;
  npc.path=[];npc.input={x:0,y:0};npc.moving=false;npc.activity='交谈';npc.pauseUntil=now+6500;npc.bubbleUntil=now+6500;
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
