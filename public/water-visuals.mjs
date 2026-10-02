// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
// Native mapElem offsets locate the tile anchor inside the source image.
export function waterElementPosition(object, tileSize = 40) {
  return {
    x: object.x * tileSize - object.offset[0],
    y: object.y * tileSize - object.offset[1],
  };
}
export function hiddenInWater(map, actor) {
  if (map.mode !== "water11") return false;
  return map.objects.some(
    (o) =>
      o.id === 5010 &&
      actor.x >= o.x &&
      actor.x < o.x + o.w &&
      actor.y >= o.y &&
      actor.y < o.y + o.h,
  );
}
