# 公网部署

## 当前发布：GitHub Pages 单人版

- 地址：https://yiiwwyii.github.io/sugar-bubble-arena/
- `master` 分支通过 `.github/workflows/pages.yml` 运行测试、构建并发布 `dist/`。GitHub 仓库 Settings → Pages 使用 GitHub Actions。
- 手动构建：`npm ci`、`npm run build:pages`；本地预览：`node tools/preview-pages.mjs`。
- 构建产物只包含网页、游戏逻辑和素材，不包含服务器、数据库、账号或 `.runtime` 文件。
- 五种模式使用现有引擎与 AI，在 Web Worker 内模拟；离开页面可见区域时暂停，返回后继续。刷新页面会结束当前未完成对局，已保存的角色与奖励保留。
- 存档写入当前浏览器 localStorage，用户可导出 JSON 或校验后导入替换。没有云端同步；旧服务端存档不自动迁移。
- 联机、公共小镇和聊天统一提示「暂未开放，敬请等待」。不使用隧道，也不要求个人电脑开机。

以下是保留的服务端部署说明，不是当前公网版的运行方式。服务端默认也关闭联机；仅设置 `MULTIPLAYER_ENABLED=true` 才启用原联机功能。

## Windows 电脑作为服务器（保留方案）

1. 安装 Node.js 24 或更高版本，双击 `启动公网游戏.cmd`。首次启动会从官方发布页下载并校验 Cloudflare Tunnel。
2. 将窗口显示的 HTTPS 地址分享给朋友，也可在 `.runtime/public-url.txt` 查看。无需路由器端口映射。
3. 游戏内打开「账号与存档」，注册后保留当前进度，并可在其他设备登录。妥善保存只显示一次的恢复码。
4. 停止服务时双击 `停止公网游戏.cmd`。再次运行公网启动脚本会重启游戏，结束正在进行的对局。

电脑必须保持开机、联网。启动脚本会在游戏进程运行期间阻止自动休眠，但无法防止关机、断电或合盖休眠；未配置开机自启。临时隧道重启后网址会变化，注册账号可以在新地址重新登录，访客 Cookie 不会跨地址迁移。建议长期使用前绑定账号。

当前使用免费的 Quick Tunnel，适合朋友测试，无可用性保证，不代表各国家和地区都能稳定低延迟访问。固定地址需要后续配置自己的域名和固定隧道。参见 [官方说明](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)。

### 存档和备份

- 数据库：`.runtime/profiles.sqlite`，保存角色、资源、装扮、账号和会话。首次启动会迁移旧的 `.runtime/profiles.json`，保留原文件。
- 密码采用加盐 scrypt 散列；恢复码和登录令牌也只保存散列。注册绑定当前存档，登录其他账号不会合并资源。
- 同一账号只允许一个活跃游戏连接；其他设备登录后，原连接会提示刷新。房间和对局不持久化，重启服务会结束对局。
- 启动时及运行期间每 6 小时自动备份，目录 `.runtime/backups`，保留最近 28 份。手动备份：`node tools/backup-profiles.mjs`。
- 恢复时先停止公网服务，将现有数据库另存，再把选定备份复制为 `.runtime/profiles.sqlite`，随后启动。恢复会回退备份之后的进度及账号变更。
- 备份位于同一磁盘；请定期复制到其他磁盘，避免磁盘损坏同时丢失存档和备份。不要上传 `.runtime` 到 GitHub。

## Linux 固定域名部署

需要：一台支持 Docker Compose 的 Linux 服务器、一个解析到该服务器的域名，以及可访问的 TCP 80/443 端口。

1. 把仓库传到服务器。原图和音频已在 `public/assets` 内，无需额外素材。
2. 把 `.env.example` 复制为 `.env`，将 `GAME_DOMAIN` 改成自己的域名。
3. 运行 `docker compose up -d --build`。
4. 打开 `https://你的域名`。所有玩家进入同一个大厅，通过 WebSocket 共享房间与对局。

Caddy 负责 HTTPS 和 WebSocket 反向代理，应用端口 8787 只在容器网络内使用。
参见 [Caddy 反向代理说明](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)、[自动 HTTPS](https://caddyserver.com/docs/automatic-https)。

本机运行仍使用 `启动游戏.cmd`，不需要 Docker。

## 应用配置

`server.mjs` 按 **环境变量 > `.runtime/config.json` > 默认值** 的顺序读取配置：

```json
{ "port": 8787, "publicOrigin": "https://你的域名" }
```

- `port` —— 监听端口，默认 8787
- `publicOrigin` —— 用于校验浏览器来源（Origin）；本地留空即可

无法注入环境变量的托管面板可使用配置文件。`.runtime/` 已在
`.gitignore` 内，不会进版本库。

## 手动部署（不用 Docker）

任意能跑 Node.js 24+ 的方式都可以，也可以挂在宝塔面板的 Node 项目、systemd 或 PM2 下。
两条实测经验：

1. **托管面板的「启动脚本」字段要填 npm script 名（如 `start`），不要填文件名。**
   部分面板面板判定的是 `package.json` 里的 `scripts` 键，填 `server.mjs` 会落到不带解释器的
   分支，改用系统自带的旧版 Node，顶层 `await` 直接语法错误。
2. **确认实际执行的是 Node 24+。** 多数发行版自带的 `node` 版本过旧；绕过包管理器直接裸跑
   `node` 时尤其容易踩到。用绝对路径指向正确的解释器最稳妥。

反向代理需支持 WebSocket：`proxy_http_version 1.1` 加上 `Upgrade` / `Connection` 头映射，
超时建议放宽到 600s。

## 当前运行约束

- 纯真人房间，2–8 人；双方人数相等且其余玩家准备后由房主开局；练习场不展示在公共大厅。
- 大厅和房间保存在**单个服务进程内**，重启会结束现有对局。暂不做多实例扩容和跨实例房间分配。
- 已有基础的消息频率限制、包大小限制和连接心跳；公网高延迟下的移动预测、重连续局及长时间
  压力测试仍需完成。
- 支持访客和本地账号登录，不要求第三方账号。数据库通过 Docker 命名卷保留；不要使用 `docker compose down -v` 删除存档卷。
- Docker 与公网 TLS 配置建议先在目标服务器做两地真人对局测试再正式上线。
