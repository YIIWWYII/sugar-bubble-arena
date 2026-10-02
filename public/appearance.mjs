// 玩家编辑、服务端校验与 NPC 配方共用有限选项。
export const APPEARANCE_OPTIONS = {
  hair: {
    label: "发色",
    values: ["赤红", "深蓝", "栗棕", "银白", "墨黑", "青绿"],
    colors: ["#dc2227", "#356fc4", "#875238", "#d4dde5", "#30384a", "#4e9b65"],
  },
  skin: {
    label: "肤色",
    values: ["暖白", "小麦", "深棕", "冷白"],
    colors: ["#ffd1a0", "#d6a275", "#966a4d", "#d8e0ca"],
  },
  outfit: {
    label: "服装配色",
    values: ["云白", "天蓝", "金黄", "紫罗兰", "墨绿", "绯红"],
    colors: ["#dce7e7", "#64b5df", "#edc362", "#957bd0", "#50977a", "#cf6578"],
  },
  style: { label: "发型", values: ["经典短发", "侧束发", "尖翘短发"] },
  eyes: { label: "眼型", values: ["专注", "圆眼", "弯眼"] },
  mouth: { label: "表情", values: ["平静", "微笑", "坚毅"] },
  accessory: {
    label: "头饰",
    values: [
      "无头饰",
      "星石头环",
      "机甲头盔",
      "金色冠饰",
      "翡翠头环",
      "绒耳发饰",
      "紫晶头环",
      "银色头盔",
    ],
  },
  wings: {
    label: "翅膀",
    values: ["无翅膀", "冰晶羽翼", "暮夜蝠翼", "星辉羽翼", "鎏金机械翼"],
  },
  back: {
    label: "背饰",
    values: ["无背饰", "绯红披风", "旅行行囊", "星纹战旗", "蝶结背饰"],
  },
  held: {
    label: "手持装饰",
    values: ["无手持", "如意长杖", "金光三叉", "冰晶三叉", "星辉长杖"],
  },
  shoes: {
    label: "脚部装饰",
    values: ["经典鞋履", "星光靴", "机甲战靴", "幻彩战靴"],
  },
  aura: {
    label: "脚下光环",
    values: ["无光环", "星辉环", "暖焰环", "冰晶环", "紫雾环"],
  },
  mount: {
    label: "坐骑",
    values: ["无坐骑", "水灵泡泡", "蜜桃泡泡", "机甲团团", "奶油糖包"],
  },
};
export const DEFAULT_APPEARANCE = {
  hair: 0,
  skin: 0,
  outfit: 0,
  style: 0,
  eyes: 0,
  mouth: 0,
  accessory: 0,
  wings: 0,
  back: 0,
  held: 0,
  shoes: 0,
  aura: 0,
  mount: 0,
};
export const APPEARANCE_PRESETS = {
  crystal: {
    name: "星晶骑士",
    value: {
      hair: 3,
      outfit: 3,
      accessory: 3,
      wings: 3,
      back: 4,
      held: 3,
      shoes: 1,
      aura: 3,
      mount: 2,
    },
  },
  machine: {
    name: "机甲巡游",
    value: {
      hair: 1,
      outfit: 1,
      accessory: 7,
      wings: 4,
      back: 2,
      held: 2,
      shoes: 2,
      aura: 1,
      mount: 3,
    },
  },
  night: {
    name: "暗夜领主",
    value: {
      hair: 4,
      outfit: 5,
      accessory: 6,
      wings: 2,
      back: 1,
      held: 1,
      shoes: 3,
      aura: 2,
      mount: 1,
    },
  },
  cloud: {
    name: "云端精灵",
    value: {
      hair: 5,
      outfit: 2,
      accessory: 5,
      wings: 1,
      back: 3,
      held: 4,
      shoes: 1,
      aura: 4,
      mount: 4,
    },
  },
};
export function validateAppearance(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("外观配置无效");
  const result = {};
  for (const [key, option] of Object.entries(APPEARANCE_OPTIONS)) {
    if (
      value[key] === undefined &&
      ["wings", "back", "held", "shoes", "aura", "mount"].includes(key)
    ) {
      result[key] = 0;
      continue;
    }
    if (
      !Number.isInteger(value[key]) ||
      value[key] < 0 ||
      value[key] >= option.values.length
    )
      throw Error("外观选项超出范围");
    result[key] = value[key];
  }
  return result;
}
export const NPC_DESIGNS = {
  easy: {
    name: "见习队员",
    hair: 2,
    skin: 1,
    outfit: 1,
    style: 0,
    eyes: 1,
    mouth: 1,
    accessory: 0,
  },
  normal: {
    name: "巡逻队员",
    hair: 1,
    skin: 0,
    outfit: 4,
    style: 1,
    eyes: 0,
    mouth: 0,
    accessory: 2,
  },
  hard: {
    name: "精英队员",
    hair: 4,
    skin: 2,
    outfit: 3,
    style: 2,
    eyes: 0,
    mouth: 2,
    accessory: 1,
  },
  boss: {
    name: "重装领主",
    hair: 4,
    skin: 2,
    outfit: 5,
    style: 2,
    eyes: 0,
    mouth: 2,
    accessory: 3,
  },
  runner: {
    name: "追踪感染者",
    hair: 5,
    skin: 3,
    outfit: 4,
    style: 0,
    eyes: 1,
    mouth: 2,
    accessory: 0,
  },
  dasher: {
    name: "突袭感染者",
    hair: 3,
    skin: 3,
    outfit: 1,
    style: 2,
    eyes: 0,
    mouth: 2,
    accessory: 2,
  },
  spitter: {
    name: "投掷感染者",
    hair: 1,
    skin: 3,
    outfit: 3,
    style: 1,
    eyes: 2,
    mouth: 0,
    accessory: 1,
  },
};
const cache = new WeakMap();
let artwork = new Map();
export function setAppearanceAssets(images) {
  artwork = images;
}

const rgb = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
export function appearanceSheet(image, key, recipe = DEFAULT_APPEARANCE) {
  const a = { ...DEFAULT_APPEARANCE, ...recipe },
    signature = key + JSON.stringify(a);
  let sheets = cache.get(image);
  if (!sheets) {
    sheets = new Map();
    cache.set(image, sheets);
  }
  if (sheets.has(signature)) return sheets.get(signature);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const c = canvas.getContext("2d");
  c.drawImage(image, 0, 0);
  const data = c.getImageData(0, 0, canvas.width, canvas.height);
  const hair = rgb(APPEARANCE_OPTIONS.hair.colors[a.hair]),
    skin = rgb(APPEARANCE_OPTIONS.skin.colors[a.skin]),
    outfit = rgb(APPEARANCE_OPTIONS.outfit.colors[a.outfit]);
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4,
        [r, g, b, alpha] = data.data.slice(i, i + 4);
      if (!alpha) continue;
      let target,
        shade = 1;
      if (y < 62 && r > g * 1.7 && r > b * 1.7) {
        target = hair;
        shade = Math.max(0.3, r / 225);
      } else if (
        y >= 48 &&
        y <= 73 &&
        r > g * 1.06 &&
        g > b * 1.06 &&
        r > 105
      ) {
        target = skin;
        shade = r / 255;
      } else if (
        y >= 62 &&
        y <= 73 &&
        Math.max(r, g, b) - Math.min(r, g, b) < 35 &&
        r > 100
      ) {
        target = outfit;
        shade = r / 235;
      }
      if (target)
        for (let k = 0; k < 3; k++)
          data.data[i + k] = Math.min(255, Math.round(target[k] * shade));
    }
  c.putImageData(data, 0, 0);
  const front = key.endsWith("-3") || key.endsWith("trigger"),
    back = key.endsWith("-1");
  for (let f = 0; f < canvas.width / 100; f++) {
    const x = f * 100;
    c.fillStyle = APPEARANCE_OPTIONS.hair.colors[a.hair];
    if (a.style === 1) {
      c.fillRect(x + 30, 37, 5, 13);
      c.fillRect(x + 65, 37, 5, 13);
      c.fillStyle = "#ffe672";
      c.fillRect(x + 30, 43, 5, 2);
      c.fillRect(x + 65, 43, 5, 2);
    }
    if (a.style === 2) {
      c.fillRect(x + 42, 21, 5, 8);
      c.fillRect(x + 49, 18, 5, 11);
      c.fillRect(x + 56, 22, 4, 8);
    }
    if (front) {
      if (a.eyes) {
        c.fillStyle = APPEARANCE_OPTIONS.skin.colors[a.skin];
        c.fillRect(x + 39, 51, 23, 5);
        c.fillStyle = "#293442";
        for (const eyeX of [41, 55]) {
          if (a.eyes === 1) {
            c.fillRect(x + eyeX, 51, 3, 4);
            c.fillStyle = "#fff";
            c.fillRect(x + eyeX, 51, 1, 1);
            c.fillStyle = "#293442";
          } else {
            c.fillRect(x + eyeX, 52, 5, 1);
            c.fillRect(x + eyeX + 1, 51, 3, 1);
          }
        }
      }
      if (a.mouth) {
        c.fillStyle = APPEARANCE_OPTIONS.skin.colors[a.skin];
        c.fillRect(x + 46, 57, 9, 3);
        c.fillStyle = "#8a4d3b";
        c.fillRect(x + 47, 58, a.mouth === 1 ? 6 : 7, 1);
        if (a.mouth === 1) {
          c.fillRect(x + 46, 57, 1, 1);
          c.fillRect(x + 53, 57, 1, 1);
        }
      }
    }
  }
  const decorated = decorateSheet(canvas, key, a);
  if (sheets.size > 48) sheets.clear();
  sheets.set(signature, decorated);
  return decorated;
}
export function hasLargeDecor(recipe) {
  return (
    ["wings", "back", "held", "shoes", "aura", "mount"].some(
      (k) => recipe?.[k] > 0,
    ) || (recipe?.accessory || 0) > 0
  );
}
// All previews use the same 100px equipment cell, anchor and body scale.
export function portraitURL(image, recipe, key = "prince-red-stand-3") {
  const sheet = appearanceSheet(image, key, recipe), c = document.createElement("canvas");
  c.width = c.height = 100;
  c.getContext("2d").drawImage(sheet, 0, 0, 100, 100, 0, 0, 100, 100);
  return c.toDataURL();
}

// Every option has a dedicated atlas: direction × (idle + six walking frames).
// Slot rules apply to all item IDs. Coordinates are in the unmounted 100px cell.
export const EQUIPMENT_LAYOUT = {
  ridingLift: 8,
  // right / back / left / front
  backOffsetX: [0, 0, 0, -18],
  heldOffsetX: [7, -7, -7, 7],
  face: [[45, 48, 25, 15], null, [30, 48, 25, 15], [34, 48, 32, 15]],
  frontLayers: ["aura", "mount", "wings", "back", "body", "shoes", "accessory", "held"],
  rearLayers: ["aura", "mount", "wings", "body", "back", "shoes", "accessory", "held"],
};

function drawEquipment(c, slot, value, key, frame, x = 0, y = 0) {
  if (!value) return;
  const image = artwork.get(`wardrobe-${slot}-${value}`);
  if (!image) return;
  const direction = Number(key.match(/-(\d)$/)?.[1] ?? 3);
  const index = direction * 7 + (key.includes("walk") ? 1 + frame % 6 : 0);
  c.drawImage(image, index * 100, 0, 100, 100, x, y, 100, 100);
}

function decorateSheet(source, key, a) {
  if (!hasLargeDecor(a)) return source;
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const c = out.getContext("2d"), direction = Number(key.match(/-(\d)$/)?.[1] ?? 3);
  const layout = EQUIPMENT_LAYOUT;
  const layers = direction === 1 ? layout.rearLayers : layout.frontLayers;
  c.imageSmoothingEnabled = false;
  for (let f = 0; f < source.width / 100; f++) {
    c.save();
    c.translate(f * 100, 0);
    c.beginPath();
    c.rect(0, 0, 100, 100);
    c.clip();
    const lift = a.mount ? layout.ridingLift : 0;
    for (const slot of layers) {
      if (slot === "body") {
        c.drawImage(source, f * 100, 0, 100, source.height, 0, -lift, 100, source.height);
        continue;
      }
      const x = slot === "back" ? layout.backOffsetX[direction]
        : slot === "held" ? layout.heldOffsetX[direction] : 0;
      const y = slot === "aura" || slot === "mount" ? 0 : -lift;
      c.save();
      // Keep eyes, nose and mouth readable even for newly authored equipment.
      const face = layout.face[direction];
      if (face) {
        c.beginPath();
        c.rect(0, 0, 100, 100);
        c.rect(face[0], face[1] - lift, face[2], face[3]);
        c.clip("evenodd");
      }
      drawEquipment(c, slot, a[slot], key, f, x, y);
      c.restore();
    }
    c.restore();
  }
  return out;
}
