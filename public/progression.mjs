// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { validateCharacter } from './characters.mjs';
import { freshSocial } from './friendship.mjs';
import { DEFAULT_APPEARANCE, validateAppearance } from "./appearance.mjs";
// 客户端展示与服务端校验共用的养成规则。
export const ATTRIBUTES = {
  speed: {
    name: "轻快步伐",
    icon: "item3",
    max: 3,
    description: "每级初始速度 +0.25 格/秒",
  },
  capacity: {
    name: "泡泡口袋",
    icon: "item1",
    max: 2,
    description: "每级初始泡数 +1",
  },
  power: {
    name: "糖泡研习",
    icon: "item2",
    max: 2,
    description: "每级初始威力 +1 格",
  },
};
export const SKILLS = {
  ward: {
    name: "风行护佑",
    icon: "ui-ward",
    limited: true,
    description: "获得护盾与加速，仅能通过图鉴解锁",
    duration: [1.5, 2, 2.5],
    cooldown: [30, 27, 24],
  },
  purify: {
    name: "净化援护",
    icon: "ui-purify",
    limited: true,
    description: "清除自身减速，营救两格内队友并施加护盾",
    duration: [1, 1.5, 2],
    cooldown: [36, 32, 28],
  },
  sprint: {
    name: "疾风步",
    icon: "ui-sprint",
    description: "短时间加速，携包时也可使用",
    duration: [2, 3, 4],
    cooldown: [20, 18, 16],
  },
  shield: {
    name: "泡泡护盾",
    icon: "ui-shield",
    description: "短时间免疫糖泡伤害",
    duration: [1, 1.5, 2],
    cooldown: [30, 27, 24],
  },
  rescue: {
    name: "脱困术",
    icon: "ui-rescue",
    description: "被困时自行脱困并获得保护；生化与幸存者中可主动解除减速并获得保护",
    duration: [0.5, 0.8, 1],
    cooldown: [45, 38, 32],
  },
  magnet: {
    name: "糖果磁场",
    icon: "ui-magnet",
    description: "吸取附近可见增益道具，不吸陷阱和包子",
    duration: [3, 4, 5],
    cooldown: [25, 22, 19],
  },
};
export const TEMP_ITEMS = {
  haste: {
    name: "疾风鞋",
    icon: "item8",
    duration: 6,
    description: "6 秒内移动速度 +35%",
  },
  guard: {
    name: "护身泡",
    icon: "item4",
    duration: 3,
    description: "3 秒内免疫糖泡伤害",
  },
  surge: {
    name: "强力糖泡",
    icon: "item6",
    duration: 8,
    description: "8 秒内放出的糖泡威力 +2",
  },
  magnet: {
    name: "磁力糖果",
    icon: "item-magnet",
    duration: 8,
    description: "8 秒内吸取两格范围的可见增益道具",
  },
};
export const ITEM_ICONS = {
  capacity: "item1",
  power: "item2",
  speed: "item3",
  fork: "item24",
  banana: "item23",
  "banana-trap": "item42",
  smile: "item25",
  "smile-trap": "item25",
  rose: "item301",
  chest: "item213",
  luckybag: "item202",
  kubi: "item98",
  ...Object.fromEntries(
    Object.entries(TEMP_ITEMS).map(([k, v]) => [k, v.icon]),
  ),
};
export function upgradeCost(kind, level) {
  return kind === "attribute"
    ? { coins: 40 + level * 40, gems: level }
    : { coins: 50 + level * 50, gems: 2 + level * 2 };
}
export function freshProfile() {
  return {
    appearance: { ...DEFAULT_APPEARANCE },
    appearanceConfigured: false,
    collection: [],
    claimed: [],
    milestones: [],
    coins: 60,
    gems: 3,
    xp: 0,
    matches: 0,
    wins: 0,
    attributes: { speed: 0, capacity: 0, power: 0 },
    skills: { ward: 0, purify: 0, sprint: 1, shield: 0, rescue: 0, magnet: 0 },
    equipped: "sprint",
    receipts: [],
    social: freshSocial(),
    character: "sea",
  };
}
export function publicProfile(profile) {
  const { receipts, ...data } = profile;
  data.character = profile.character || "sea";
  data.appearance = { ...DEFAULT_APPEARANCE, ...profile.appearance };
  data.collection = profile.collection || [];
  data.claimed = profile.claimed || [];
  data.milestones = profile.milestones || [];
  data.skills = { ward: 0, purify: 0, ...profile.skills };
  return { ...data, level: 1 + Math.floor(profile.xp / 100) };
}
export const COLLECTION = Object.fromEntries([
  ...Object.entries(TEMP_ITEMS).map(([key, item]) => [
    `item:${key}`,
    { name: item.name, condition: "正式对局中拾取该道具", coins: 25, gems: 1 },
  ]),
  ...[
    ["bun06_8", "抢包山 6"],
    ["water11_8", "水面 11"],
    ["garden", "糖果花园"],
    ["harbor", "港湾栈道"],
    ["frost", "冰雪迷城"],
    ["boss-court", "首领竞技场"],
    ["boss-foundry", "冰霜要塞"],
    ["bio-lab", "隔离水道"],
    ["bio-maze", "废弃迷宫"],
    ["boss-ring", "环形堡垒"],
    ["bio-district", "隔离城区"],
    ["forest-crossing", "林间营地"],
    ["dune-market", "沙漠集市"],
    ["boss-caldera", "熔岩锻炉"],
    ["boss-ruins", "星晶遗迹"],
    ["bio-forest", "雾林哨站"],
    ["bio-mine", "废弃矿区"],
    ["water-reef", "珊瑚礁湾"],
    ["water-ice", "浮冰港口"],
    ["survivor-grove", "幸存者林地"],
    ["survivor-ruins", "幸存者遗迹"],
    ["survivor-dunes", "幸存者沙原"],
  ].map(([id, name]) => [
    `map:${id}`,
    { name, condition: "在该地图完成一场正式对局", coins: 30, gems: 1 },
  ]),
  ...[
    ["boss", "重装领主"],
    ["runner", "追踪感染者"],
    ["dasher", "突袭感染者"],
    ["spitter", "投掷感染者"],
    ["bot", "竞技队员"],
  ].map(([id, name]) => [
    `enemy:${id}`,
    {
      name,
      condition: id === "bot" ? "赢得一次人机对战" : "正式对局中击败该敌人",
      coins: 40,
      gems: 2,
    },
  ]),
]);
export const COLLECTION_MILESTONES = [
  { count: 3, skill: "ward", coins: 80, gems: 3 },
  { count: 8, skill: "purify", coins: 150, gems: 5 },
];
export function changeProfile(profile, action) {
  profile.collection ??= [];
  profile.claimed ??= [];
  profile.milestones ??= [];
  profile.skills.ward ??= 0;
  profile.skills.purify ??= 0;
  if (action.type === "appearance") {
    const character = validateCharacter(action.character ?? profile.character);
    const appearance = validateAppearance(action.value);
    profile.character = character;
    profile.appearance = appearance;
    profile.appearanceConfigured = true;
    return;
  }
  if (action.type === "claim") {
    const entry = COLLECTION[action.key];
    if (!entry || !profile.collection.includes(action.key))
      throw Error("尚未收集该图鉴");
    if (profile.claimed.includes(action.key)) throw Error("该奖励已领取");
    profile.coins += entry.coins;
    profile.gems += entry.gems;
    profile.claimed.push(action.key);
    return;
  }
  if (action.type === "milestone") {
    const milestone = COLLECTION_MILESTONES.find(
      (m) => m.count === action.count,
    );
    if (!milestone || profile.collection.length < milestone.count)
      throw Error("图鉴收集数量不足");
    if (profile.milestones.includes(milestone.count))
      throw Error("该里程碑已领取");
    profile.coins += milestone.coins;
    profile.gems += milestone.gems;
    profile.skills[milestone.skill] = Math.max(
      1,
      profile.skills[milestone.skill],
    );
    profile.milestones.push(milestone.count);
    return;
  }
  if (action.type === "equip") {
    if (!Object.hasOwn(SKILLS, action.key) || !profile.skills[action.key])
      throw Error("请先解锁这个技能");
    profile.equipped = action.key;
    return;
  }
  const catalog =
    action.kind === "attribute"
      ? ATTRIBUTES
      : action.kind === "skill"
        ? SKILLS
        : null;
  if (
    action.type !== "upgrade" ||
    !catalog ||
    !Object.hasOwn(catalog, action.key)
  )
    throw Error("无效的养成选项");
  const levels =
    action.kind === "attribute" ? profile.attributes : profile.skills;
  if (
    action.kind === "skill" &&
    catalog[action.key].limited &&
    !levels[action.key]
  )
    throw Error("该技能须通过图鉴里程碑解锁");
  const level = levels[action.key],
    max = catalog[action.key].max ?? 3;
  if (level >= max) throw Error("已达到最高等级");
  const cost = upgradeCost(action.kind, level);
  if (profile.coins < cost.coins || profile.gems < cost.gems)
    throw Error("资源不足，完成对局可获得糖币和技能星");
  profile.coins -= cost.coins;
  profile.gems -= cost.gems;
  levels[action.key]++;
}
export function roundReward(match, player, aiLevel) {
  if (
    match.practice ||
    match.state !== "finished" ||
    match.time < 18 ||
    match.reason === "对方已离开"
  )
    return null;
  const won = match.winner === player.team;
  return {
    coins:
      25 +
      (won ? 20 : 0) +
      Math.min(player.captures, 3) * 5 +
      (aiLevel === "hard" ? 10 : aiLevel === "normal" ? 5 : 0),
    gems: won ? 3 : 1,
    xp: won ? 50 : 25,
    won,
  };
}
