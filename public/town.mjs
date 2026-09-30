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
  p.moving = !!(dx || dy);
  if (dx) p.dir = dx > 0 ? 0 : 2;
  else if (dy) p.dir = dy > 0 ? 3 : 1;
  if (townWalkable(x, p.y)) p.x = x;
  if (townWalkable(p.x, y)) p.y = y;
}
