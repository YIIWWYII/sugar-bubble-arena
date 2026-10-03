// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { mkdirSync, readFileSync, existsSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomBytes, createHash, scrypt as derive, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { freshProfile, publicProfile, changeProfile, roundReward, COLLECTION } from "./public/progression.mjs";

const scrypt = promisify(derive);
const digest = value => createHash("sha256").update(value).digest("hex");
const cookieToken = cookie => String(cookie || "").match(/(?:^|;\s*)qqt_session=([a-f0-9]{64})(?:;|$)/)?.[1];
const credentials = (name, password) => {
  if (typeof name !== "string" || !/^[a-zA-Z0-9_]{3,24}$/.test(name)) throw Error("账号须为 3–24 位字母、数字或下划线");
  if (typeof password !== "string" || password.length < 10 || password.length > 128) throw Error("密码须为 10–128 个字符");
  return name.toLowerCase();
};

export class ProfileStore {
  constructor(filename) {
    this.filename = filename;
    mkdirSync(path.dirname(filename), { recursive: true });
    let legacy;
    if (existsSync(filename) && readFileSync(filename).subarray(0,16).toString() !== "SQLite format 3\0") {
      legacy = JSON.parse(readFileSync(filename, "utf8"));
      renameSync(filename, filename + ".legacy.json");
    }
    this.db(db => {
      db.exec(`CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS accounts (name TEXT PRIMARY KEY, profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id), salt TEXT NOT NULL, password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id), expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS visit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign TEXT NOT NULL, ip_hash TEXT NOT NULL, ip_masked TEXT NOT NULL, user_agent TEXT NOT NULL, referer TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
      if (!db.prepare("SELECT 1 FROM metadata WHERE key='legacy-import'").get()) {
        const old = path.join(path.dirname(filename), "profiles.json");
        if (!legacy && old !== filename && existsSync(old)) legacy = JSON.parse(readFileSync(old, "utf8"));
        const insert = db.prepare("INSERT OR IGNORE INTO profiles VALUES (?, ?)");
        for (const [id, value] of Object.entries(legacy || {})) {
          if (!/^[a-f0-9]{48}$/.test(id) || !value || typeof value !== "object") throw Error("旧存档格式无效，迁移已取消");
          publicProfile(value);
          insert.run(id, JSON.stringify(value));
        }
        db.prepare("INSERT INTO metadata VALUES ('legacy-import', ?)").run(new Date().toISOString());
      }
    });
  }
  // Short transactions release Windows file locks and serialize writes across processes.
  db(fn) {
    const db = new DatabaseSync(this.filename);
    try {
      db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
      const result = fn(db); db.exec("COMMIT"); return result;
    } catch (error) { try { db.exec("ROLLBACK"); } catch {} throw error; }
    finally { db.close(); }
  }
  record(id) {
    return this.db(db => { const row = db.prepare("SELECT value FROM profiles WHERE id=?").get(id); return row ? JSON.parse(row.value) : null; });
  }
  commit(id, value) {
    this.db(db => db.prepare("INSERT INTO profiles VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(id,JSON.stringify(value)));
    return this.view(id);
  }
  identify(cookie = "") {
    const token = cookieToken(cookie);
    if (token) return this.db(db => db.prepare("SELECT profile_id FROM sessions WHERE token_hash=? AND expires>?").get(digest(token),Date.now())?.profile_id || null);
    const id = cookie.match(/(?:^|;\s*)qqt_profile=([a-f0-9]{48})(?:;|$)/)?.[1];
    return id ? this.db(db => db.prepare("SELECT id FROM profiles WHERE id=? AND NOT EXISTS(SELECT 1 FROM accounts WHERE profile_id=?)").get(id,id)?.id || null) : null;
  }
  create() { const id=randomBytes(24).toString("hex"); this.commit(id,freshProfile()); return id; }
  recordQrVisit({ campaign = "default", ip = "", userAgent = "", referer = "" } = {}) {
    const cleanCampaign = String(campaign).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64) || "default";
    const cleanIp = String(ip).replace(/[^a-fA-F0-9:.%]/g, "").slice(0, 96) || "unknown";
    const masked = cleanIp.includes(":")
      ? cleanIp.split(":").slice(0, 4).join(":") + "::"
      : cleanIp.split(".").slice(0, 3).join(".") + ".0";
    const hash = digest(`${process.env.ANALYTICS_SALT || "sugar-bubble-analytics"}:${cleanIp}`);
    this.db(db => db.prepare("INSERT INTO visit_events (campaign,ip_hash,ip_masked,user_agent,referer,created_at) VALUES (?,?,?,?,?,?)")
      .run(cleanCampaign, hash, masked, String(userAgent).slice(0, 300), String(referer).slice(0, 300), Date.now()));
  }
  view(id) {
    if (!id) return null;
    return this.db(db => {
      const row=db.prepare("SELECT value FROM profiles WHERE id=?").get(id);
      if (!row) return null;
      const profile=publicProfile(JSON.parse(row.value));
      const account=db.prepare("SELECT name FROM accounts WHERE profile_id=?").get(id);
      return account ? {...profile, accountName:account.name} : profile;
    });
  }
  change(id, action) {
    if (!id) throw Error("档案尚未连接，请刷新页面");
    this.db(db => {
      const row=db.prepare("SELECT value FROM profiles WHERE id=?").get(id);
      if (!row) throw Error("档案不存在");
      const next=JSON.parse(row.value);changeProfile(next,action);
      db.prepare("UPDATE profiles SET value=? WHERE id=?").run(JSON.stringify(next),id);
    });
    return this.view(id);
  }
  session(db,id) {
    const token=randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(digest(token),id,Date.now()+30*86400000);
    return token;
  }
  async register(name,password,id) {
    name=credentials(name,password);
    const salt=randomBytes(16).toString("hex"),hash=await scrypt(password,salt,64),recovery=randomBytes(18).toString("hex");
    const token=this.db(db=>{
      if (db.prepare("SELECT 1 FROM accounts WHERE name=?").get(name)) throw Error("账号已存在");
      if (!id || !db.prepare("SELECT 1 FROM profiles WHERE id=?").get(id)) throw Error("请先加载角色档案");
      if (db.prepare("SELECT 1 FROM accounts WHERE profile_id=?").get(id)) throw Error("当前档案已绑定账号");
      db.prepare("INSERT INTO accounts VALUES (?,?,?,?,?)").run(name,id,salt,hash.toString("hex"),digest(recovery));
      return this.session(db,id);
    });
    return {id,token,recovery};
  }
  async login(name,password) {
    name=credentials(name,password);
    const account=this.db(db=>db.prepare("SELECT * FROM accounts WHERE name=?").get(name));
    const hash=await scrypt(password,account?.salt || "invalid-account-salt",64);
    if (!account || !timingSafeEqual(hash,Buffer.from(account.password_hash,"hex"))) throw Error("账号或密码不正确");
    return this.db(db=>{
      if(db.prepare("SELECT password_hash FROM accounts WHERE name=?").get(name)?.password_hash!==account.password_hash)throw Error("账号已更新，请重新登录");
      return {id:account.profile_id,token:this.session(db,account.profile_id)};
    });
  }
  logout(cookie) { const token=cookieToken(cookie); if(token)this.db(db=>db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token))); }
  async recover(name,password,code) {
    name=credentials(name,password);
    if(typeof code!=="string"||!/^[a-f0-9]{36}$/.test(code))throw Error("账号或恢复码不正确");
    const salt=randomBytes(16).toString("hex"),hash=await scrypt(password,salt,64),recovery=randomBytes(18).toString("hex");
    return this.db(db=>{
      const account=db.prepare("SELECT * FROM accounts WHERE name=? AND recovery_hash=?").get(name,digest(code));
      if(!account)throw Error("账号或恢复码不正确");
      db.prepare("UPDATE accounts SET salt=?,password_hash=?,recovery_hash=? WHERE name=?").run(salt,hash.toString("hex"),digest(recovery),name);
      db.prepare("DELETE FROM sessions WHERE profile_id=?").run(account.profile_id);
      return {id:account.profile_id,token:this.session(db,account.profile_id),recovery};
    });
  }
  backup(directory=path.join(path.dirname(this.filename),"backups")) {
    mkdirSync(directory,{recursive:true});
    const target=path.join(directory,`profiles-${new Date().toISOString().replace(/[:.]/g,"-")}.sqlite`);
    const db=new DatabaseSync(this.filename);
    try {db.exec("PRAGMA busy_timeout=5000");db.prepare("VACUUM INTO ?").run(target);} finally {db.close();}
    const files=readdirSync(directory).filter(n=>/^profiles-.*\.sqlite$/.test(n)).sort().reverse();
    for(const file of files.slice(28))unlinkSync(path.join(directory,file));
    return target;
  }
  reward(id, receipt, match, player, aiLevel) {
    if (!id) return null;
    return this.db(db => {
    const row=db.prepare("SELECT value FROM profiles WHERE id=?").get(id);
    if(!row) return null;
    const saved=JSON.parse(row.value);
    if(saved.receipts.includes(receipt)) return null;
    const reward = roundReward(match, player, aiLevel);
    if (!reward) return null;
    const next = saved;
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
    db.prepare("UPDATE profiles SET value=? WHERE id=?").run(JSON.stringify(next),id);
    const account=db.prepare("SELECT name FROM accounts WHERE profile_id=?").get(id);
    const profile=publicProfile(next);
    return {reward,profile:account?{...profile,accountName:account.name}:profile};
    });
  }
}
