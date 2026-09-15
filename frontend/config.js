// 本地直接预览默认使用本地 Worker。
// Cloudflare Pages 构建时会用 S3_GEAR_GENERATOR_API_URL 生成 dist/config.js。
window.S3S_WEB_CONFIG = {
  apiBaseUrl: "http://127.0.0.1:8787",
  demoMode: false,
};
