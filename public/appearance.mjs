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
    values: ["无翅膀", "冰蓝蝶翼", "暮紫蝶翼", "星辉蝶翼", "金辉蝶翼"],
  },
  back: {
    label: "背饰",
    values: ["无背饰", "如意背饰", "旅行行囊", "金色如意", "蝶纹背饰"],
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
    if (a.accessory) {
      const part = [
        "",
        "circlet",
        "helmet",
        "crown",
        "circlet",
        "ears",
        "circlet",
        "helmet",
      ][a.accessory];
      const tint = { 1: 170, 4: 65, 6: 270, 7: 175 }[a.accessory] || 0;
      drawPart(
        c,
        part,
        key,
        f,
        x,
        a.accessory === 5 ? -24 : a.accessory === 3 ? -22 : -8,
        100,
        100,
        tint,
      );
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
    ) || (recipe?.accessory || 0) >= 4
  );
}
export function portraitURL(image, recipe, key = "prince-red-stand-3") {
  const sheet = appearanceSheet(image, key, recipe),
    c = document.createElement("canvas"),
    large = hasLargeDecor(recipe);
  c.width = large ? 100 : 44;
  c.height = large ? 100 : 64;
  c.getContext("2d").drawImage(
    sheet,
    large ? 0 : 28,
    large ? 0 : 17,
    c.width,
    c.height,
    0,
    0,
    c.width,
    c.height,
  );
  return c.toDataURL();
}

function drawPart(c, part, key, frame, x, y, w = 100, h = 100, hue = 0) {
  const img = artwork.get("dress-" + part);
  if (!img) return;
  const match = key.match(/-(\d)$/),
    dir = match ? Number(match[1]) : 3,
    index = dir * 7 + (key.includes("walk") ? 1 + (frame % 6) : 0);
  c.save();
  if (hue) c.filter = typeof hue === "string" ? hue : `hue-rotate(${hue}deg)`;
  c.drawImage(img, index * 100, 0, 100, 100, x, y, w, h);
  c.restore();
}
function drawItem(c, key, x, y, w, h, hue = 0) {
  const img = artwork.get(key);
  if (!img) return;
  const sizes = {
    item4: [39, 51],
    item98: [41, 65],
    item11: [35, 42],
    item24: [27, 50],
    item3: [40, 47],
    item8: [40, 45],
  };
  const size = sizes[key] || [img.width, img.height];
  c.save();
  if (hue) c.filter = typeof hue === "string" ? hue : `hue-rotate(${hue}deg)`;
  c.drawImage(img, 0, 0, size[0], size[1], x, y, w, h);
  c.restore();
}
function decorateSheet(source, key, a) {
  if (!hasLargeDecor(a)) return source;
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const c = out.getContext("2d"),
    back = key.endsWith("-1"),
    side = key.endsWith("-0") || key.endsWith("-2");
  c.imageSmoothingEnabled = false;
  for (let f = 0; f < source.width / 100; f++) {
    c.save();
    c.translate(f * 100, 0);
    c.beginPath();
    c.rect(0, 0, 100, 100);
    c.clip();
    const bob = key.includes("walk") ? Math.sin((f * Math.PI) / 3) : 0,
      lift = a.mount ? 10 : 0;
    if (a.aura) {
      c.save();
      const colors = ["", "#ffdc83", "#ffad8d", "#9beaff", "#deb2ff"];
      c.strokeStyle = colors[a.aura];
      c.shadowColor = colors[a.aura];
      c.shadowBlur = 4;
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(50, 83, 27, 5, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    if (a.back && !(a.back === 4 && a.wings))
      drawPart(
        c,
        a.back === 2 ? "pack" : a.back === 4 ? "butterfly" : "staff",
        key,
        f,
        a.back === 4 ? 4 : 0,
        5 - lift,
        92,
        92,
        a.back === 3 ? 40 : 0,
      );
    if (a.wings) {
      c.save();
      if (side) {
        c.translate(20, 0);
        c.scale(0.6, 1);
      }
      drawPart(
        c,
        "butterfly",
        key,
        f,
        0,
        -7 - lift + bob,
        100,
        100,
        [
          0,
          "hue-rotate(-35deg) saturate(.65) brightness(1.2)",
          0,
          "saturate(.2) brightness(1.5)",
          "sepia(.8) saturate(.9) brightness(1.2)",
        ][a.wings],
      );
      c.restore();
    }
    if (a.mount) {
      if (a.mount === 3) drawPart(c, "owl", key, f, 9, 35 + bob, 82, 70);
      else
        drawItem(
          c,
          ["", "item4", "item4", "", "item11"][a.mount],
          28,
          49 + bob,
          44,
          44,
          a.mount === 2 ? 140 : 0,
        );
    }
    c.drawImage(
      source,
      f * 100,
      0,
      100,
      source.height,
      0,
      -lift,
      100,
      source.height,
    );
    // 骑乘姿态：原坐骑的前缘覆盖腿部，脸部与躯干保持清楚。
    if (a.mount && a.mount !== 3 && !back) {
      c.save();
      c.beginPath();
      c.rect(23, 73 + bob, 54, 20);
      c.clip();
      drawItem(
        c,
        ["", "item4", "item4", "", "item11"][a.mount],
        28,
        49 + bob,
        44,
        44,
        a.mount === 2 ? 140 : 0,
      );
      c.restore();
    }
    if (a.shoes && !a.mount) {
      drawItem(
        c,
        a.shoes === 2 ? "item3" : "item8",
        36,
        71,
        15,
        15,
        a.shoes === 3 ? 160 : 0,
      );
      drawItem(
        c,
        a.shoes === 2 ? "item3" : "item8",
        50,
        71,
        15,
        15,
        a.shoes === 3 ? 160 : 0,
      );
    }
    if (a.held) {
      if (a.held === 1 || a.held === 4)
        drawPart(
          c,
          "staff",
          key,
          f,
          29,
          13 - lift,
          80,
          80,
          a.held === 4 ? 160 : 0,
        );
      else
        drawItem(
          c,
          "item24",
          side ? 66 : 65,
          45 - lift,
          19,
          32,
          a.held === 3 ? 150 : 0,
        );
    }
    c.restore();
  }
  return out;
}
