import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  freshProfile,
  publicProfile,
  changeProfile,
  roundReward,
  COLLECTION,
} from "./public/progression.mjs";

export class ProfileStore {
  constructor(filename) {
    this.filename = filename;
    this.data = {};
    try {
      this.data = JSON.parse(readFileSync(filename, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  commit(id, value) {
    const next = { ...this.data, [id]: value };
    mkdirSync(path.dirname(this.filename), { recursive: true });
    writeFileSync(this.filename + ".tmp", JSON.stringify(next), "utf8");
    renameSync(this.filename + ".tmp", this.filename);
    this.data = next;
    return publicProfile(value);
  }
  identify(cookie = "") {
    const id = cookie.match(/(?:^|;\s*)qqt_profile=([a-f0-9]{48})(?:;|$)/)?.[1];
    return id && Object.hasOwn(this.data, id) ? id : null;
  }
  create() {
    const id = randomBytes(24).toString("hex");
    this.commit(id, freshProfile());
    return id;
  }
  view(id) {
    return id ? publicProfile(this.data[id]) : null;
  }
  change(id, action) {
    if (!id) throw Error("档案尚未连接，请刷新页面");
    const next = structuredClone(this.data[id]);
    changeProfile(next, action);
    return this.commit(id, next);
  }
  reward(id, receipt, match, player, aiLevel) {
    if (!id || this.data[id].receipts.includes(receipt)) return null;
    const reward = roundReward(match, player, aiLevel);
    if (!reward) return null;
    const next = structuredClone(this.data[id]);
    next.coins += reward.coins;
    next.gems += reward.gems;
    next.xp += reward.xp;
    next.collection ??= [];
    const discoveries = [`map:${match.map.id}`, ...(player.discoveries || [])];
    if (aiLevel && reward.won) discoveries.push("enemy:bot");
    for (const key of discoveries)
      if (Object.hasOwn(COLLECTION, key) && !next.collection.includes(key))
        next.collection.push(key);
    next.matches++;
    if (reward.won) next.wins++;
    next.receipts = [...next.receipts, receipt].slice(-64);
    return { reward, profile: this.commit(id, next) };
  }
}
