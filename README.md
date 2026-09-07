# Splatoon3 Gear Generator

Splatoon 3 装备 JSON 生成器的 Web 项目。项目分为静态前端和 Cloudflare Worker API，前端负责引导用户操作，Worker 负责 Nintendo 登录流程和最终 `gear_*.json` 的生成。

## 目录结构

```text
.
├── frontend/       # 静态网页，可部署到 Cloudflare Pages
├── worker/         # Cloudflare Worker API
├── docs/           # 素材候选记录和开发说明
└── README.md
```

## 本地预览前端

进入 `frontend/`，使用任意静态文件服务器打开即可。预览模式不会调用 Worker，也不会打开 Nintendo 登录页：

```text
?preview
?preview=welcome
?preview=login
?preview=paste
?preview=generating
?preview=success
?preview=error
```

默认使用中文。添加 `?lang=en` 可以打开英文界面，例如：

```text
?preview&lang=en
```

直接打开 `?preview` 时，可以使用页面上的“上一个”和“下一个”按钮浏览全部页面。

## 本地运行 Worker

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`，填写本地密钥：

```text
NXAPI_AUTH_CLIENT_ID=你的 nxapi client id
FLOW_SECRET=一段足够长的随机字符串
```

启动本地 Worker：

```bash
npm run dev
```

然后在 `frontend/config.js` 中配置：

```js
window.S3S_WEB_CONFIG = {
  apiBaseUrl: "http://127.0.0.1:8787",
  demoMode: false,
};
```

## API 接口

- `GET /api/health`：检查 Worker 是否在线
- `POST /api/start`：创建一次性的登录流程并返回 Nintendo 登录链接
- `POST /api/generate`：接收“选择此人”的链接，生成 `gear_*.json`

token 只在当前流程和请求的内存变量中使用，前端不会通过 `localStorage` 或 `sessionStorage` 持久化用户信息。

## 部署到 Cloudflare

### 部署 Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put NXAPI_AUTH_CLIENT_ID
npx wrangler secret put FLOW_SECRET
npx wrangler deploy
```

将部署后得到的 Worker 地址填写到 `frontend/config.js`，并将 `demoMode` 设置为 `false`。

### 部署 Pages

只部署 `frontend/` 目录，不要把 `worker/` 源码作为网页静态文件上传：

```bash
npx wrangler pages project create s3-gear-generator
npx wrangler pages deploy frontend --project-name s3-gear-generator
```

部署完成后，将 `worker/wrangler.jsonc` 中的 `WEB_ORIGIN` 改成实际 Pages 域名，再重新部署 Worker。

## 安全说明

- 不要提交 `.dev.vars`、token、client secret 或个人登录链接。
- 生成的 `gear_*.json` 只下载到用户本地，不由前端主动持久化。
- `worker/node_modules/` 和 `worker/.wrangler/` 是本地生成目录，不应提交。
