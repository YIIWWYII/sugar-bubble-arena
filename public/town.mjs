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
    page: "career-dialog",
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
    page: null,
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
const stops=[{x:480,y:360},{x:800,y:360},{x:800,y:600},{x:480,y:600},{x:640,y:850}];
export function tickTownNPC(p,dt,now) {
  if(!p.path.length&&now>=p.pauseUntil){p.routeIndex=(p.routeIndex+1)%stops.length;p.path=townPath(p,stops[p.routeIndex])||[];}
  const walking=p.path.length>0;stepTown(p,dt);
  if(walking&&!p.path.length)p.pauseUntil=now+1800;
}
