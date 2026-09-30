import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";

test("static assets revalidate without a body and HEAD preserves metadata", async () => {
  const port = 18895;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // 使用原始 HTTP，避免 fetch 自动处理缓存校验头。
  const get = (path, headers = {}, method = "GET") =>
    new Promise((resolve, reject) => {
      const req = request(
        { hostname: "localhost", port, path, headers, method },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks),
            }),
          );
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.end();
    });
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
      server.once("exit", (code) => reject(Error(`server exit ${code}`)));
    });
    for (const path of ["/", "/app.mjs", "/assets/tile2.png"]) {
      const first = await get(path);
      assert.equal(first.status, 200);
      assert(first.body.length > 0);
      assert(first.headers.etag);
      assert.equal(first.headers["cache-control"], "no-cache");
      for (const tag of [
        first.headers.etag,
        first.headers.etag.slice(2),
        `"old", ${first.headers.etag}`,
        "*",
      ]) {
        const cached = await get(path, { "if-none-match": tag });
        assert.equal(cached.status, 304);
        assert.equal(cached.body.length, 0);
        assert.equal(cached.headers.etag, first.headers.etag);
      }
      const stale = await get(path, { "if-none-match": 'W/"outdated"' });
      assert.equal(stale.status, 200);
      assert.deepEqual(stale.body, first.body);
      const head = await get(path, {}, "HEAD");
      assert.equal(head.status, 200);
      assert.equal(head.body.length, 0);
      assert.equal(Number(head.headers["content-length"]), first.body.length);
      assert.equal(head.headers.etag, first.headers.etag);
    }
    assert.equal(
      (await get("/missing-file.png", { "if-none-match": "*" })).status,
      404,
    );
    const rooms = await get("/api/rooms", { "if-none-match": "*" });
    assert.equal(rooms.status, 200);
    assert.equal(rooms.headers["cache-control"], "no-store");
    assert.equal(rooms.headers.etag, undefined);
  } finally {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
});
