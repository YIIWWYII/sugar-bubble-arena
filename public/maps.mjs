// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { designTacticalMap } from './tactical-maps.mjs';
// Original maps stay intact. Expanded maps share asset metadata, not terrain.
export function createMaps(original, water) {
  const maps=[{...original,supportedModes:['classic']},water];
  const classicSpawns=[[1,4],[2,4],[1,5],[2,5],[13,4],[12,4],[13,5],[12,5]];
  const arenaSpawns=[[3,3],[4,3],[3,4],[4,4],[5,3],[3,5],[5,4],[4,5]];
  for(const [id,name,mode,theme,width,height] of [
    ['garden','糖果花园','classic','garden',15,13],
    ['harbor','港湾栈道','classic','harbor',15,13],
    ['frost','冰雪迷城','classic','frost',15,13],
    ['forest-crossing','林间营地','classic','forest',15,13],
    ['dune-market','沙漠集市','classic','dune',15,13],
    ['boss-court','首领竞技场','boss','garden',15,13],
    ['boss-foundry','冰霜要塞','boss','frost',15,13],
    ['boss-ring','环形堡垒','boss','garden',25,21],
    ['boss-caldera','熔岩锻炉','boss','lava',23,19],
    ['boss-ruins','星晶遗迹','boss','ruin',27,23],
    ['bio-lab','隔离水道','bio','harbor',31,25],
    ['bio-maze','废弃迷宫','bio','frost',31,25],
    ['bio-district','隔离城区','bio','harbor',41,33],
    ['bio-forest','雾林哨站','bio','forest',31,25],
    ['bio-mine','废弃矿区','bio','dune',35,27],
    ['survivor-grove','幸存者林地','survivor','forest',25,23],
    ['survivor-ruins','幸存者遗迹','survivor','ruin',31,25],
    ['survivor-dunes','幸存者沙原','survivor','dune',27,23],
  ]){
    const cx=Math.floor(width/2),cy=Math.floor(height/2);
    const bases=mode==='classic'?[{team:0,x:1,y:1,w:3,h:3,doorX:2,doorY:4},{team:1,x:11,y:1,w:3,h:3,doorX:12,doorY:4}]:[];
    const structures=Array(width*height).fill(0);
    for(const b of bases)for(let y=b.y;y<b.y+3;y++)for(let x=b.x;x<b.x+3;x++)structures[y*width+x]=(x===b.x&&y===b.y?1:-1)*(8009+b.team);
    maps.push({...original,id,name,mode,theme,width,height,supportedModes:[mode],bases,structures,extendedItems:true,
      spawns:mode==='classic'?classicSpawns:mode==='survivor'?[[cx,cy],[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]:width===15?[[1,1],[2,1],[1,2],[2,2],[3,1],[1,3],[3,2],[2,3]]:arenaSpawns});
  }
  // 水面变体重排洞口、礁石与可破坏补给，沿用水手及洞口规则。
  for (const [id, name, theme] of [
    ["water-reef", "珊瑚礁湾", "harbor"],
    ["water-ice", "浮冰港口", "frost"],
  ]) {
    const arena = {
      ...water,
      id,
      name,
      theme,
      supportedModes: ["water11"],
      description:
        id === "water-reef"
          ? "15×13 · 双礁分流与交错洞口"
          : "15×13 · 横向冰堤与中央缺口",
      blocks: Array(195).fill(0),
      structures: Array(195).fill(0),
      ground: Array(195).fill(5001),
      objects: [],
      spawns: [
        [2, 2],
        [12, 2],
        [2, 10],
        [12, 10],
        [7, 2],
        [7, 10],
        [2, 6],
        [12, 6],
      ],
    };
    delete arena.nativeLayers;
    const add = (type, x, y) => {
      const template = water.objects.find((o) => o.id === type),
        o = { ...template, x, y };
      if (theme === "frost" && type !== 5010) {
        o.renderKey = type === 5002 ? "frost-block" : "frost-pillar";
        o.offset = [0, type === 5002 ? 13 : 22];
      }
      arena.objects.push(o);
      arena.blocks[y * 15 + x] =
        type === 5010 ? 0 : type === 5002 ? 8001 : 8005;
    };
    for (let y = 0; y < 13; y++)
      for (let x = 0; x < 15; x++) {
        if (x === 0 || x === 14 || y === 0 || y === 12) add(5005, x, y);
        else if (
          id === "water-reef"
            ? [5, 9].includes(x) && [2, 4, 8, 10].includes(y)
            : y === 6 && x >= 3 && x <= 11 && x !== 7
        )
          add(5005, x, y);
        else if (
          arena.spawns.every(
            ([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) > 1,
          ) &&
          y >= 3 &&
          y <= 9 &&
          (x + y * 2) % 7 === 0 &&
          ![
            [4, 5],
            [10, 7],
          ].some(([cx, cy]) => cx === x && cy === y)
        )
          add(5002, x, y);
      }
    for (const [x, y] of [
      [4, 5],
      [10, 7],
    ])
      add(5010, x, y);
    maps.push(arena);
  }
  return new Map(maps.map(m=>[m.id,designTacticalMap(m)]));
}

export const GAME_MODES = {
  classic: "经典抢包",
  boss: "首领挑战",
  bio: "生化生存",
  water11: "水面合作",
  survivor: "幸存者",
};
export function modeCompatibility(map, mode) {
  if (!Object.hasOwn(GAME_MODES, mode)) return "无效的游戏模式";
  if (map.supportedModes && !map.supportedModes.includes(mode))
    return `该地图适用于${map.supportedModes.map((m) => GAME_MODES[m]).join("、")}，请更换地图或模式`;
  if (mode === "water11")
    return map.mode === "water11" ? "" : "水面合作需要水面 11 的洞口与水域地形";
  if (map.mode === "water11") return "该地图仅支持水面合作，请更换模式或地图";
  if (mode === "classic" && map.bases.length < 2)
    return "经典抢包需要双方包房，请选择抢包地图";
  return "";
}
export function mapForMode(map, mode) {
  const error = modeCompatibility(map, mode);
  if (error) throw Error(error);
  if (mode === "classic" || mode === "water11") return { ...map, mode };
  if (mode === "bio" && (map.width || 15) < 25) {
    const width = 31,
      height = 25,
      blocks = Array(width * height).fill(0);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const edge = !x || !y || x === width - 1 || y === height - 1;
        const wall =
          map.theme === "frost"
            ? x % 6 === 0 && y % 7 > 1 && y % 7 < 6
            : y % 6 === 0 && x % 8 > 1 && x % 8 < 7;
        if (edge || wall) blocks[y * width + x] = 8005;
        else if (x > 6 && y > 6 && (x * 3 + y * 7) % 19 === 0)
          blocks[y * width + x] = 8001 + ((x + y) % 4);
      }
    map = {
      ...map,
      width,
      height,
      blocks,
      ground: Array(width * height).fill(8011),
      spawns: [
        [3, 3],
        [4, 3],
        [3, 4],
        [4, 4],
        [5, 3],
        [3, 5],
        [5, 4],
        [4, 5],
      ],
      temporarySpawns: [],
    };
  }
  const selected = {
    ...map,
    mode,
    bases: [],
    structures: Array((map.width || 15) * (map.height || 13)).fill(0),
  };
  if (mode === "bio" && !map.defenseZone) {
    const width = map.width || 15,
      height = map.height || 13;
    selected.blocks = [...map.blocks];
    selected.defenseZone = { x: 1, y: 1, w: 5, h: 5 };
    for (let y = 1; y <= 6; y++)
      for (let x = 1; x <= 6; x++)
        selected.blocks[y * width + x] = x === 6 || y === 6 ? 8005 : 0;
    // 双入口接通地图主路，避免防守区堵住出生点或形成封闭安全屋。
    for (let x = 3; x < width - 1; x++) selected.blocks[3 * width + x] = 0;
    for (let y = 3; y < height - 1; y++) selected.blocks[y * width + 3] = 0;
  }
  return selected;
}
