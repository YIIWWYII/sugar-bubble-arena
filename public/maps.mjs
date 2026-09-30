// 经典地图保留原版格网；合作地图使用独立尺寸与模式兼容配置。
export function createMaps(original, water) {
  const maps = [{ ...original, supportedModes: ["classic"] }, water];
  const spawns = [
    [1, 4],
    [2, 4],
    [1, 5],
    [2, 5],
    [13, 4],
    [12, 4],
    [13, 5],
    [12, 5],
  ];
  for (const [id, name, theme, description] of [
    ["garden", "糖果花园", "garden", "开阔中庭 · 三路抢包"],
    ["harbor", "港湾栈道", "harbor", "狭长通道 · 交叉封锁"],
    ["frost", "冰雪迷城", "frost", "回廊迷宫 · 绕路突袭"],
    ["forest-crossing", "林间营地", "forest", "双侧林带 · 中路争夺"],
    ["dune-market", "沙漠集市", "dune", "纵向街巷 · 横向突破"],
  ]) {
    const bases = [
      { team: 0, x: 1, y: 1, w: 3, h: 3, doorX: 2, doorY: 4 },
      { team: 1, x: 11, y: 1, w: 3, h: 3, doorX: 12, doorY: 4 },
    ];
    const map = {
      ...original,
      id,
      name,
      theme,
      description,
      supportedModes: ["classic"],
      bases,
      blocks: Array(195).fill(0),
      ground: Array(195).fill(8011),
      structures: Array(195).fill(0),
      spawns,
      extendedItems: true,
    };
    for (const b of bases)
      for (let y = b.y; y < b.y + 3; y++)
        for (let x = b.x; x < b.x + 3; x++)
          map.structures[y * 15 + x] =
            (x === b.x && y === b.y ? 1 : -1) * (8009 + b.team);
    const put = (x, y, n) => {
      map.blocks[y * 15 + x] = n;
      map.blocks[y * 15 + 14 - x] = n;
    };
    for (let y = 0; y < 13; y++)
      for (let x = 0; x <= 7; x++) {
        if (x === 0 || y === 0 || y === 12) put(x, y, 8005);
        else if (theme === "garden") {
          if (y >= 5 && y <= 10 && y % 2 === 0 && x % 3 === 0) put(x, y, 8005);
          else if (y >= 5 && y <= 10 && (x + y) % 3 === 0)
            put(x, y, 8001 + ((x + y) % 4));
        } else if (theme === "forest") {
          if (y >= 6 && y <= 10 && x % 3 === 0 && y % 2 === 0) put(x, y, 8005);
          else if (y >= 5 && y <= 10 && (x + y) % 4 === 0)
            put(x, y, 8001 + ((x + y) % 4));
        } else if (theme === "dune") {
          if (y >= 5 && y <= 10 && (x === 3 || x === 5) && y !== 7 && y !== 10)
            put(x, y, 8005);
          else if (y >= 5 && y <= 10 && x !== 7 && (x * 3 + y) % 5 === 0)
            put(x, y, 8001 + ((x + y) % 4));
        } else if (theme === "harbor") {
          if ((y === 6 || y === 9) && ![2, 5, 7].includes(x)) put(x, y, 8005);
          else if (y >= 4 && y <= 10 && (x * 2 + y) % 4 === 0)
            put(x, y, 8001 + (y % 4));
        } else {
          if (y >= 5 && y <= 10 && x % 2 === 0 && y % 2 === 0) put(x, y, 8005);
          else if (y >= 4 && y <= 10 && (x + y) % 2 === 1)
            put(x, y, 8001 + ((x + y) % 4));
        }
      }
    for (let y = 1; y <= 4; y++) put(7, y, 8005);
    // 包房十字入口、出生格及相邻逃生格始终畅通。
    for (const b of map.bases)
      for (let y = b.y; y <= b.y + b.h; y++)
        for (let x = b.x; x < b.x + b.w; x++) map.blocks[y * 15 + x] = 0;
    for (const [x, y] of spawns)
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (x + dx > 0 && x + dx < 14) map.blocks[(y + dy) * 15 + x + dx] = 0;
    map.temporarySpawns = [
      { x: 7, y: 5, kind: "haste" },
      { x: 7, y: 7, kind: "guard" },
      { x: 5, y: 9, kind: "surge" },
      { x: 9, y: 9, kind: "magnet" },
    ];
    for (const p of map.temporarySpawns) map.blocks[p.y * 15 + p.x] = 0;
    maps.push(map);
  }
  for (const [id, name, mode, theme, description] of [
    ["boss-court", "首领竞技场", "boss", "garden", "开阔战场 · 首领轰炸"],
    ["boss-foundry", "冰霜要塞", "boss", "frost", "交叉掩体 · 分区规避"],
    ["bio-lab", "隔离水道", "bio", "harbor", "交错回廊 · 追踪生存"],
    ["bio-maze", "废弃迷宫", "bio", "frost", "多路迷宫 · 屏障阻击"],
  ]) {
    const arena = {
      ...original,
      id,
      name,
      mode,
      theme,
      description,
      supportedModes: id === "boss-foundry" ? ["boss", "bio"] : [mode],
      bases: [],
      structures: Array(195).fill(0),
      ground: Array(195).fill(8011),
      blocks: Array(195).fill(0),
      spawns: [
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
        [3, 1],
        [1, 3],
        [3, 2],
        [2, 3],
      ],
      temporarySpawns: [],
    };
    for (let y = 0; y < 13; y++)
      for (let x = 0; x < 15; x++) {
        const edge = x === 0 || x === 14 || y === 0 || y === 12;
        const pillar =
          mode === "boss"
            ? id === "boss-court"
              ? x % 4 === 0 && y % 4 === 0
              : x % 3 === 0 && y % 3 === 0
            : id === "bio-lab"
              ? x % 3 === 0 && y > 2 && y < 11 && y % 4 !== 1
              : x % 2 === 0 && y % 2 === 0;
        if (edge || pillar) arena.blocks[y * 15 + x] = 8005;
        else if (x > 3 && y > 2 && (x * 7 + y * 3) % 11 === 0)
          arena.blocks[y * 15 + x] = 8001 + ((x + y) % 4);
      }
    if (id === "bio-maze") {
      arena.blocks.fill(8005);
      const stack = [[1, 1]],
        visited = new Set(["1,1"]);
      arena.blocks[16] = 0;
      while (stack.length) {
        const [x, y] = stack.at(-1),
          directions =
            (x + y) % 4
              ? [
                  [2, 0],
                  [0, 2],
                  [-2, 0],
                  [0, -2],
                ]
              : [
                  [0, 2],
                  [-2, 0],
                  [0, -2],
                  [2, 0],
                ];
        const next = directions
          .map(([dx, dy]) => [x + dx, y + dy])
          .find(
            ([nx, ny]) =>
              nx > 0 &&
              nx < 14 &&
              ny > 0 &&
              ny < 12 &&
              !visited.has(`${nx},${ny}`),
          );
        if (!next) {
          stack.pop();
          continue;
        }
        const [nx, ny] = next;
        arena.blocks[((y + ny) / 2) * 15 + (x + nx) / 2] = 0;
        arena.blocks[ny * 15 + nx] = 0;
        visited.add(`${nx},${ny}`);
        stack.push(next);
      }
      for (let y = 3; y < 11; y += 4)
        for (let x = 2; x < 13; x += 4) arena.blocks[y * 15 + x] = 8001;
    }
    for (const [x, y] of arena.spawns)
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ])
        if (x + dx < 14 && y + dy < 12)
          arena.blocks[(y + dy) * 15 + x + dx] = 0;
    // 首领出生点、两条纵向通路及补给格始终开放。
    for (let y = 1; y < 12; y++)
      for (const x of [1, 7, 13]) arena.blocks[y * 15 + x] = 0;
    for (const [x, y, kind] of [
      [3, 5, "guard"],
      [11, 5, "haste"],
      [7, 9, "surge"],
      [5, 9, "power"],
    ]) {
      arena.blocks[y * 15 + x] = 0;
      arena.temporarySpawns.push({ x, y, kind });
    }
    maps.push(arena);
  }
  for (const [id, name, width, height, mode, theme] of [
    ["boss-ring", "环形堡垒", 25, 21, "boss", "garden"],
    ["bio-district", "隔离城区", 41, 33, "bio", "harbor"],
    ["boss-caldera", "熔岩锻炉", 23, 19, "boss", "lava"],
    ["boss-ruins", "星晶遗迹", 27, 23, "boss", "ruin"],
    ["bio-forest", "雾林哨站", 31, 25, "bio", "forest"],
    ["bio-mine", "废弃矿区", 35, 27, "bio", "dune"],
  ]) {
    const arena = {
      ...original,
      id,
      name,
      width,
      height,
      mode,
      theme,
      supportedModes: [mode],
      description: `${width}×${height} · ${{ "boss-ring": "中央决战区与环形掩体", "bio-district": "多出口街区与交错回廊", "boss-caldera": "四组锻炉与十字通道", "boss-ruins": "断续石环与宽阔侧翼", "bio-forest": "稀疏林带与多向绕行", "bio-mine": "长廊分区与交错出口" }[id]}`,
      bases: [],
      structures: Array(width * height).fill(0),
      ground: Array(width * height).fill(8011),
      blocks: Array(width * height).fill(0),
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
      extendedItems: true,
    };
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        const dx = Math.abs(x - Math.floor(width / 2)),
          dy = Math.abs(y - Math.floor(height / 2));
        const wall =
          id === "boss-caldera"
            ? dx >= 4 && dx <= 5 && dy >= 3 && dy <= 4
            : id === "boss-ruins"
              ? (dx === 8 && dy % 4 < 2 && dy < 8) ||
                (dy === 7 && dx % 4 < 2 && dx < 9)
              : id === "bio-forest"
                ? x % 5 === 0 && y % 4 !== 1 && y % 4 !== 2
                : id === "bio-mine"
                  ? y % 6 === 0 && x % 10 > 2 && x % 10 < 9
                  : mode === "boss"
                    ? (dx === 7 && dy <= 6 && dy > 2) ||
                      (dy === 6 && dx <= 7 && dx > 2)
                    : (x % 8 === 0 && y % 8 > 2 && y % 8 < 7) ||
                      (y % 8 === 0 && x % 8 > 2 && x % 8 < 7);
        if (edge || wall) arena.blocks[y * width + x] = 8005;
        else if (
          x > 6 &&
          y > 6 &&
          (mode === "bio" || dx > 8 || dy > 7) &&
          (x * 3 + y * 7) % 17 === 0
        )
          arena.blocks[y * width + x] = 8001 + ((x + y) % 4);
      }
    for (const [x, y] of arena.spawns)
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        arena.blocks[(y + dy) * width + x + dx] = 0;
    for (let y = 4; y < height - 2; y += 8)
      for (let x = 4; x < width - 2; x += 8) {
        arena.blocks[y * width + x] = 0;
        arena.temporarySpawns.push({
          x,
          y,
          kind: ["guard", "haste", "surge", "magnet"][(((x + y) / 8) % 4) | 0],
        });
      }
    maps.push(arena);
  }
  for (const [id, name, theme, width, height] of [
    ["survivor-grove", "幸存者林地", "forest", 25, 23],
    ["survivor-ruins", "幸存者遗迹", "ruin", 31, 25],
    ["survivor-dunes", "幸存者沙原", "dune", 27, 23],
  ]) {
    const cx = Math.floor(width / 2),
      cy = Math.floor(height / 2),
      arena = {
        ...original,
        id,
        name,
        theme,
        width,
        height,
        mode: "survivor",
        supportedModes: ["survivor"],
        description: `${width}×${height} · 中央集结与环绕怪物潮`,
        bases: [],
        structures: Array(width * height).fill(0),
        ground: Array(width * height).fill(8011),
        blocks: Array(width * height).fill(0),
        spawns: [
          [cx, cy],
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ],
        temporarySpawns: [],
      };
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (
          x === 0 ||
          y === 0 ||
          x === width - 1 ||
          y === height - 1 ||
          ((theme === "forest"
            ? x % 6 === 0 && y % 5 === 0
            : theme === "ruin"
              ? x % 7 === 0 && y % 4 < 2
              : y % 6 === 0 && x % 8 < 3) &&
            Math.hypot(x - cx, y - cy) > 4)
        )
          arena.blocks[y * width + x] = 8005;
    maps.push(arena);
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
  return new Map(maps.map((m) => [m.id, m]));
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
  if (mode === "bio") {
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
