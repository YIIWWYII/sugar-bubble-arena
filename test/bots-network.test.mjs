import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("AI rooms validate difficulty, start alone, stay private and clean up on leave", async () => {
  const port = 18896,
    clients = [];
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), PUBLIC_ORIGIN: "" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
      server.once("exit", (code) => reject(Error(`exit ${code}`)));
    });
    const connect = async () => {
      const ws = new WebSocket(`ws://localhost:${port}`),
        c = { ws, messages: [] };
      clients.push(c);
      ws.on("message", (raw) => c.messages.push(JSON.parse(raw)));
      await new Promise((resolve) => ws.once("open", resolve));
      return c;
    };
    const wait = async (c, predicate) => {
      for (let i = 0; i < 150; i++) {
        const found = c.messages.find(predicate);
        if (found) return found;
        await delay(20);
      }
      throw Error("AI protocol timeout");
    };
    const send = (c, data) => c.ws.send(JSON.stringify(data));
    const a = await connect(),
      visitor = await connect();
    for (const level of ["easy", "normal", "hard"]) {
      a.messages = [];
      send(a, { type: "create", aiLevel: level, name: "Player" });
      const state = await wait(
        a,
        (m) => m.type === "state" && m.aiLevel === level,
      );
      assert.equal(state.state, "countdown");
      assert.equal(state.players.length, 2);
      assert.equal(state.players.filter((p) => p.bot).length, 1);
      assert(!state.practice);
      const directory = await fetch(`http://localhost:${port}/api/rooms`).then(
        (r) => r.json(),
      );
      assert(!directory.rooms.some((r) => r.code === state.room));
      visitor.messages = [];
      send(visitor, { type: "join", code: state.room });
      await wait(
        visitor,
        (m) => m.type === "error" && m.message.includes("人机对战"),
      );
      send(a, { type: "training-mod", key: "invincible", enabled: true });
      await wait(
        a,
        (m) => m.type === "error" && m.message.includes("单人训练"),
      );
      send(a, { type: "leave" });
      await wait(a, (m) => m.type === "left");
      visitor.messages = [];
      send(visitor, { type: "join", code: state.room });
      await wait(
        visitor,
        (m) => m.type === "error" && m.message.includes("没有找到"),
      );
    }
    for (const args of [
      { aiLevel: "invalid" },
      { aiLevel: "hard", practice: true },
      { aiLevel: "easy", mapId: "water11_8" },
    ]) {
      a.messages = [];
      send(a, { type: "create", ...args });
      await wait(
        a,
        (m) =>
          m.type === "error" &&
          (m.message.includes("有效难度") ||
            m.message.includes("仅支持水面合作")),
      );
      assert(!a.messages.some((m) => m.type === "joined"));
    }
    a.messages = [];
    send(a, {
      type: "create",
      mode: "bio",
      mapId: "bio-lab",
      bioOptions: { difficulty: "invalid", infectionSeconds: 12 },
    });
    await wait(a, (m) => m.type === "error" && m.message.includes("生化难度"));
    assert(!a.messages.some((m) => m.type === "joined"));
    for (const [difficulty, infectionSeconds] of [
      ["easy", 8],
      ["normal", 12],
      ["hard", 20],
    ]) {
      a.messages = [];
      visitor.messages = [];
      send(a, {
        type: "create",
        mode: "bio",
        mapId: "bio-lab",
        bioOptions: { difficulty, infectionSeconds },
      });
      const state = await wait(
        a,
        (m) => m.type === "state" && m.mode === "bio",
      );
      assert.equal(state.bio.difficulty, difficulty);
      assert.equal(state.bio.infectionSeconds, infectionSeconds);
      assert(state.bio.zone);
      send(visitor, { type: "join", code: state.room });
      const joined = await wait(
        visitor,
        (m) => m.type === "state" && m.mode === "bio",
      );
      assert.deepEqual(joined.bio, state.bio);
      send(visitor, { type: "leave" });
      await wait(visitor, (m) => m.type === "left");
      send(a, { type: "leave" });
      await wait(a, (m) => m.type === "left");
    }
  } finally {
    for (const c of clients) c.ws.terminate();
    server.kill();
  }
});
