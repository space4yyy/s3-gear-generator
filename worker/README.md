# Splatoon 3 Gear Generator Worker API

独立的 Cloudflare Worker API，用于生成 Splatoon 3 的装备 json 文件。

## 接口

### `GET /api/health`

检查 Worker 是否在线。

### `POST /api/start`

返回 Nintendo 登录链接和短期流程凭据：

```json
{
  "login_url": "https://accounts.nintendo.com/…",
  "flow_token": "…"
}
```

流程凭据只包含 PKCE verifier、签名和十分钟有效期，不写入数据库。前端应只在内存中保留它，并在生成请求完成后清除。

### `POST /api/generate`

请求：

```json
{
  "select_person_url": "https://accounts.nintendo.com/…",
  "flow_token": "…"
}
```

成功响应：

```json
{
  "filename": "gear_1234567890.json",
  "data": {
    "key": "…",
    "h": 123,
    "timestamp": 1234567890,
    "gear": {}
  }
}
```

所有 token 只在当前请求的内存变量中使用，响应中不会返回 session token、gtoken、bullet token 或 nxapi access token。

## 本地配置

复制 `.dev.vars.example` 为 `.dev.vars`，填写：

```text
NXAPI_AUTH_CLIENT_ID=你的 nxapi client id
FLOW_SECRET=一段足够长的随机字符串
```

不要把 `.dev.vars` 提交到 Git。

## 部署

在 `worker` 目录安装 Wrangler 后运行：

```text
npx wrangler secret put NXAPI_AUTH_CLIENT_ID
npx wrangler secret put FLOW_SECRET
npx wrangler deploy
```

部署后，将 `wrangler.jsonc` 中的 `WEB_ORIGIN` 改成实际 Pages 域名，或通过对应环境变量配置，再把该 Worker 地址填入前端 `config.js`。

Cloudflare 官方文档：

- https://developers.cloudflare.com/workers/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/wrangler/configuration/
