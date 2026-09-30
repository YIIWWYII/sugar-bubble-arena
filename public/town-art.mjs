import { TOWN, TOWN_BUILDINGS } from "./town.mjs";
// 小镇只使用当前游戏已导入的场景图块；静态拼装结果缓存一次。
export function bakeTown(images, manifest) {
  const canvas = document.createElement("canvas");
  canvas.width = TOWN.width;
  canvas.height = TOWN.height;
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  const sprite = (key, x, y, w, h, filter = "none") => {
    const im = images.get(key),
      m = manifest[key];
    if (!im || !m) return;
    c.save();
    c.filter = filter;
    c.drawImage(
      im,
      0,
      0,
      m.w,
      m.h,
      Math.round(x),
      Math.round(y),
      w ?? m.w,
      h ?? m.h,
    );
    c.restore();
  };
  function plaque(title, x, y) {
    c.fillStyle = "#245b79";
    c.fillRect(x - 62, y, 124, 25);
    c.strokeStyle = "#9fd8dc";
    c.strokeRect(x - 61, y + 1, 122, 23);
    c.fillStyle = "#fff5c9";
    c.font = '14px "Fusion Pixel",sans-serif';
    c.textAlign = "center";
    c.fillText(title, x, y + 17);
  }
  for (let y = 0; y < TOWN.height; y += 40)
    for (let x = 0; x < TOWN.width; x += 40) {
      const road = (x >= 440 && x < 840) || (y >= 340 && y < 600);
      sprite(
        "tile13",
        x,
        y,
        40,
        40,
        road ? "sepia(.25) saturate(.55) brightness(1.14)" : "none",
      );
    }
  // 绿荫和山石使用原图的光照、纹理与描边。
  for (const [x, y] of [
    [32, 20],
    [1020, 20],
    [30, 700],
    [1080, 730],
  ])
    sprite("tile8", x, y, 160, 125);
  for (const [x, y] of [
    [105, 150],
    [100, 265],
    [1140, 145],
    [1130, 280],
    [80, 625],
    [1175, 625],
    [110, 840],
    [1110, 840],
  ])
    sprite("tile12", x, y, 63, 93);
  for (const x of [160, 870])
    for (let n = 0; n < 5; n++) sprite("tile12", x + n * 48, 34, 42, 62);
  for (const x of [442, 814])
    for (const y of [290, 602]) sprite("water-5004", x, y, 36, 63);
  // 以原版水面、石岸、珊瑚柱拼出中央水景。
  c.fillStyle = "#5f848d";
  c.beginPath();
  c.ellipse(640, 439, 89, 53, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.beginPath();
  c.ellipse(640, 432, 80, 44, 0, 0, Math.PI * 2);
  c.clip();
  for (let y = 388; y < 478; y += 40)
    for (let x = 560; x < 720; x += 40) sprite("water-5001", x, y, 40, 40);
  c.restore();
  sprite("water-5011", 550, 447, 88, 40);
  sprite("water-5011", 645, 447, 88, 40);
  sprite("water-5014", 614, 378, 53, 66);
  const variants = [
    { base: "tile9", filter: "none", icon: "item213" },
    { base: "tile10", filter: "hue-rotate(15deg)", icon: "item98" },
    { base: "tile10", filter: "hue-rotate(145deg)", icon: "item24" },
    { base: "tile9", filter: "hue-rotate(-18deg)", icon: "bun-original" },
  ];
  for (let i = 0; i < TOWN_BUILDINGS.length; i++) {
    const b = TOWN_BUILDINGS[i],
      v = variants[i],
      center = b.x + b.w / 2;
    // 主体保持原包房比例；侧楼、门前陈设区分设施用途。
    for (let y = b.y + 120; y < b.y + b.h + 35; y += 40)
      for (let x = b.x; x < b.x + b.w; x += 40) sprite("tile11", x, y, 40, 40);
    if (i === 0) {
      sprite("water-5010", b.x - 4, b.y + 35, 55, 91);
      sprite("water-5010", b.x + b.w - 50, b.y + 35, 55, 91);
    }
    if (i === 2) sprite("tile10", b.x - 15, b.y - 30, 97, 111, v.filter);
    sprite(v.base, center - 91, b.y + b.h - 207, 182, 207, v.filter);
    // 覆盖包房字样，以原版物品作为用途标志。
    const glow = c.createRadialGradient(
      center,
      b.y + 47,
      3,
      center,
      b.y + 47,
      22,
    );
    glow.addColorStop(0, "#fff4b9");
    glow.addColorStop(1, "#d99b39");
    c.fillStyle = glow;
    c.beginPath();
    c.ellipse(center, b.y + 47, 22, 20, 0, 0, Math.PI * 2);
    c.fill();
    sprite(v.icon, center - 16, b.y + 27, 32, 38);
    for (const x of [b.x + 2, b.x + b.w - 38])
      sprite(i === 1 ? "item301" : "tile6", x, b.y + b.h - 42, 36, 44);
    if (i === 3) {
      sprite("tile5", b.x + 16, b.y + b.h + 58, 40, 53);
      sprite("tile5", b.x + 170, b.y + b.h + 58, 40, 53);
      sprite("bun-original", b.x + 21, b.y + b.h + 50, 30, 25);
      sprite("bun-original", b.x + 175, b.y + b.h + 50, 30, 25);
    }
    plaque(b.name, center, b.y + b.h + 14);
  }
  plaque("糖泡中央广场", 640, 509);
  return canvas;
}
