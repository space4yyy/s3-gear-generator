const DEFAULT_F_GEN_URL = "https://nxapi-znca-api.fancy.org.uk/api/znca/f";
const NXAPI_AUTH_URL = "https://nxapi-auth.fancy.org.uk/api/oauth/token";
const NXAPI_AUTH_SCOPE = "ca:gf ca:er ca:dr";
const PROJECT_URL = "https://github.com/space4yyy/s3-gear-generator";
const NXAPI_CLIENT_VERSION = "d8fAZDPzwimzQ7c6";
const NXAPI_NSO_VERSION = "3.5.0";
// Coral currently expects the same Android client signature used by the
// working CLI implementation. It is paired with the pinned NSO app version
// above and is separate from X-ProductVersion.
const CORAL_ANDROID_VERSION = "12";
const SPLATNET3_URL = "https://api.lp1.av5ja.srv.nintendo.net";
const GRAPHQL_URL = `${SPLATNET3_URL}/api/graphql`;
const ZNC_URL = "https://api-lp1.znc.srv.nintendo.net";
const NSO_CLIENT_ID = "71b963c1b7b6d119";
const AUTH_REDIRECT_URI = "npf71b963c1b7b6d119://auth";
const DEFAULT_APP_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7a) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.6099.230 Mobile Safari/537.36";
const WEB_VIEW_VERSION_FALLBACK = "10.0.0-88706e32";
const F_API_TIMEOUT_RETRIES = 2;
const FLOW_MAX_AGE_MS = 10 * 60 * 1000;

const QUERY_HASHES = {
  LatestBattleHistoriesQuery:
    "b24d22fd6cb251c515c2b90044039698aa27bc1fab15801d83014d919cd45780",
  MyOutfitCommonDataEquipmentsQuery:
    "45a4c343d973864f7bb9e9efac404182be1d48cf2181619505e9b7cd3b56a6e8",
  CoopHistoryQuery:
    "e11a8cf2c3de7348495dea5cdcaa25e0c153541c4ed63f044b6c174bc5b703df",
};

class ApiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function config(env, key, fallback = "") {
  return String(env?.[key] || fallback).trim();
}

function projectUserAgent(env) {
  return `s3-gear-generator/${config(env, "S3_GEAR_GENERATOR_VERSION", "1.0.0")} (+${PROJECT_URL})`;
}

function jsonResponse(data, status, request, env) {
  const origin = request.headers.get("Origin") || "";
  const configuredOrigin = config(env, "WEB_ORIGIN", "*");
  const allowOrigin = configuredOrigin === "*" || configuredOrigin === origin
    ? configuredOrigin
    : "null";
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Vary": "Origin",
    },
  });
}

function errorResponse(error, request, env) {
  const known = error instanceof ApiError;
  return jsonResponse({
    error: known ? error.code : "internal_error",
    message: known ? error.message : "服务暂时无法完成请求，请稍后重试。",
  }, known ? error.status : 502, request, env);
}

function randomBytes(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64Encode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(value)));
}

async function sign(value, secret) {
  if (!secret) throw new ApiError("server_config_error", "服务端尚未配置流程签名密钥。", 500);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function verifySignature(value, signature, secret) {
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    new TextEncoder().encode(value),
  );
}

async function createFlowToken(verifier, state, env) {
  const payload = encodeJson({
    verifier,
    state,
    issuedAt: Date.now(),
    nonce: base64UrlEncode(randomBytes(16)),
  });
  return `${payload}.${await sign(payload, config(env, "FLOW_SECRET"))}`;
}

async function readFlowToken(token, env) {
  if (typeof token !== "string") {
    throw new ApiError("invalid_flow", "流程已失效，请重新开始。", 400);
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !(await verifySignature(parts[0], parts[1], config(env, "FLOW_SECRET")))) {
    throw new ApiError("invalid_flow", "流程已失效，请重新开始。", 400);
  }
  let payload;
  try {
    payload = decodeJson(parts[0]);
  } catch {
    throw new ApiError("invalid_flow", "流程已失效，请重新开始。", 400);
  }
  if (!payload.verifier || !payload.issuedAt || Date.now() - payload.issuedAt > FLOW_MAX_AGE_MS) {
    throw new ApiError("expired_flow", "登录流程已过期，请重新开始。", 400);
  }
  return payload;
}

function getFGenUrl(env) {
  const value = config(env, "F_GEN_URL", DEFAULT_F_GEN_URL);
  if (!value.startsWith("https://nxapi-znca-api.fancy.org.uk/")) {
    throw new ApiError("server_config_error", "f 参数服务地址配置不正确。", 500);
  }
  return value;
}

function nxapiEndpoint(fGenUrl, path) {
  return `${fGenUrl.slice(0, fGenUrl.lastIndexOf("/"))}/${path.replace(/^\/+/, "")}`;
}

function isNxapiFUrl(url) {
  return url.startsWith("https://nxapi-znca-api.fancy.org.uk/");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError("upstream_timeout", "上游服务响应超时，请稍后重试。", 504);
    }
    throw new ApiError("upstream_unavailable", "暂时无法连接上游服务，请稍后重试。", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response, serviceName) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApiError("invalid_upstream_response", `${serviceName} 返回了无法识别的响应。`, 502);
  }
  if (!response.ok) {
    throw new ApiError("upstream_error", `${serviceName} 请求失败：${describeUpstreamError(payload, response.status)}`, 502);
  }
  return payload;
}

function describeUpstreamError(payload, httpStatus = 0) {
  const message = [
    payload?.error_description,
    payload?.error_message,
    payload?.errorMessage,
    payload?.message,
    payload?.error,
  ].find((value) => typeof value === "string" && value.trim());
  const status = httpStatus ? `HTTP ${httpStatus}` : "";
  const debugId = typeof payload?.debug_id === "string" && payload.debug_id.trim()
    ? `debug_id ${payload.debug_id.trim().slice(0, 80)}`
    : "";
  const suffix = [status, debugId].filter(Boolean).join(", ");
  const detail = message ? message.replace(/[\r\n]/g, " ").slice(0, 180) : "请求未成功";
  return suffix ? `${detail}（${suffix}）` : detail;
}

async function getNxapiAuthToken(runtime, env) {
  if (runtime.nxapiAuthToken) return runtime.nxapiAuthToken;
  const clientId = config(env, "NXAPI_AUTH_CLIENT_ID");
  if (!clientId) throw new ApiError("server_config_error", "服务端尚未配置 nxapi client id。", 500);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    scope: NXAPI_AUTH_SCOPE,
  });
  const response = await fetchWithTimeout(NXAPI_AUTH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": projectUserAgent(env),
    },
    body,
  }, 30000);
  const payload = await readJson(response, "nxapi-auth");
  if (!payload.access_token) throw new ApiError("upstream_error", "nxapi-auth 未返回 access token。", 502);
  runtime.nxapiAuthToken = payload.access_token;
  return runtime.nxapiAuthToken;
}

async function getNsoappVersion(runtime) {
  if (runtime.nsoappVersion) return runtime.nsoappVersion;
  runtime.nsoappVersion = NXAPI_NSO_VERSION;
  return runtime.nsoappVersion;
}

async function makeLoginUrl(verifier, state) {
  const challengeBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const params = new URLSearchParams({
    state,
    redirect_uri: AUTH_REDIRECT_URI,
    client_id: NSO_CLIENT_ID,
    scope: "openid user user.birthday user.mii user.screenName",
    response_type: "session_token_code",
    session_token_code_challenge: base64UrlEncode(challengeBytes),
    session_token_code_challenge_method: "S256",
    theme: "login_form",
  });
  return `https://accounts.nintendo.com/connect/1.0.0/authorize?${params.toString()}`;
}

async function startFlow(env) {
  const verifier = base64UrlEncode(randomBytes(32));
  const state = base64UrlEncode(randomBytes(36));
  return {
    login_url: await makeLoginUrl(verifier, state),
    flow_token: await createFlowToken(verifier, state, env),
  };
}

function getSessionTokenCode(value) {
  try {
    const url = new URL(value);
    const fragmentParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const code = fragmentParams.get("session_token_code")
      || url.searchParams.get("session_token_code")
      || url.searchParams.get("de");
    if (!code) throw new Error("missing de");
    return code;
  } catch {
    throw new ApiError("invalid_login_url", "请粘贴“选择此人”的完整链接地址。", 400);
  }
}

async function getSessionToken(sessionTokenCode, verifier, nsoappVersion) {
  const response = await fetchWithTimeout("https://accounts.nintendo.com/connect/1.0.0/api/session_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `OnlineLounge/${nsoappVersion} NASDKAPI Android`,
    },
    body: new URLSearchParams({
      client_id: NSO_CLIENT_ID,
      session_token_code: sessionTokenCode,
      session_token_code_verifier: verifier,
    }),
  }, 30000);
  const payload = await readJson(response, "Nintendo 登录");
  if (!payload.session_token) throw new ApiError("nintendo_login_failed", "登录链接已过期，请重新登录后再试。", 400);
  return payload.session_token;
}

function buildFRequest(options) {
  const requestBody = {
    token: options.accessToken,
    hash_method: options.step,
    na_id: options.userId,
  };
  if (options.step === 2 && options.coralUserId !== undefined && options.coralUserId !== null) {
    requestBody.coral_user_id = options.coralUserId;
  }
  if (options.url && options.parameter) {
    requestBody.encrypt_token_request = {
      url: options.url,
      parameter: options.parameter,
    };
  }
  return requestBody;
}

function coralHeaders(nsoappVersion, token = "") {
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "Content-Type": "application/json; charset=utf-8",
    "User-Agent": `com.nintendo.znca/${nsoappVersion}(Android/${CORAL_ANDROID_VERSION})`,
    "X-Platform": "Android",
    "X-ProductVersion": nsoappVersion,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseCoralResponse(runtime, env, response, fGenUrl, encrypted) {
  if (!encrypted) return readJson(response, "Nintendo Coral");
  const encryptedResponse = new Uint8Array(await response.arrayBuffer());
  const payload = {
    data: base64Encode(encryptedResponse),
  };
  const decryptResponse = await fetchWithTimeout(nxapiEndpoint(fGenUrl, "decrypt-response"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getNxapiAuthToken(runtime, env)}`,
      "Content-Type": "application/json",
      Accept: "text/plain",
      "User-Agent": projectUserAgent(env),
    },
    body: JSON.stringify(payload),
  }, 60000);
  if (!decryptResponse.ok) throw new ApiError("decrypt_failed", "无法解密 Nintendo 返回的数据。", 502);
  const text = await decryptResponse.text();
  try {
    const json = JSON.parse(text);
    return typeof json?.data === "string" ? JSON.parse(json.data) : json;
  } catch {
    throw new ApiError("decrypt_failed", "无法解析解密后的 Nintendo 数据。", 502);
  }
}

async function postCoralRequest(url, body, encryptedBody, nsoappVersion, coralAccessToken = "") {
  const headers = coralHeaders(nsoappVersion, coralAccessToken);
  let requestBody = JSON.stringify(body);
  if (encryptedBody) {
    headers["Content-Type"] = "application/octet-stream";
    headers.Accept = "application/octet-stream, application/json";
    requestBody = encryptedBody;
  }
  return fetchWithTimeout(url, { method: "POST", headers, body: requestBody }, 60000);
}

async function callFApi(runtime, env, options) {
  const fGenUrl = options.fGenUrl;
  const nsoappVersion = await getNsoappVersion(runtime);
  const requestBody = buildFRequest(options);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "User-Agent": projectUserAgent(env),
    "X-znca-Platform": "Android",
    "X-znca-Version": nsoappVersion,
    Authorization: `Bearer ${await getNxapiAuthToken(runtime, env)}`,
    "X-znca-Client-Version": NXAPI_CLIENT_VERSION,
  };

  let payload;
  for (let attempt = 0; attempt <= F_API_TIMEOUT_RETRIES; attempt += 1) {
    const response = await fetchWithTimeout(fGenUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    }, 60000);
    payload = await readJson(response, "f 参数服务");
    if (payload.error !== "timeout" || attempt === F_API_TIMEOUT_RETRIES) break;
    await sleep(2 ** (attempt + 1) * 1000);
  }
  if (payload.error) throw new ApiError("f_generation_failed", `f 参数生成失败：${String(payload.error_message || payload.error).slice(0, 180)}`, 502);
  if (!payload.f || !payload.request_id || !payload.timestamp) {
    throw new ApiError("f_generation_failed", "f 参数服务返回的数据不完整。", 502);
  }

  let encryptedBody = null;
  if (payload.encrypted_token_request) {
    try {
      encryptedBody = base64UrlDecode(payload.encrypted_token_request);
    } catch {
      throw new ApiError("f_generation_failed", "f 参数服务返回的加密数据无效。", 502);
    }
  }
  return {
    f: payload.f,
    requestId: payload.request_id,
    timestamp: payload.timestamp,
    encryptedBody,
    nsoappVersion,
  };
}

async function callCoralApiWithF(runtime, env, options) {
  const fData = await callFApi(runtime, env, options);
  const parameter = {
    ...options.parameter,
    f: fData.f,
    requestId: fData.requestId,
    timestamp: fData.timestamp,
  };
  if (options.coralUserId !== null && options.coralUserId !== undefined && "registrationToken" in parameter) {
    parameter.registrationToken = options.accessToken;
  }
  const body = { parameter };
  const response = await postCoralRequest(
    options.url,
    body,
    fData.encryptedBody,
    fData.nsoappVersion,
    options.step === 2 ? options.accessToken : "",
  );
  return parseCoralResponse(runtime, env, response, options.fGenUrl, Boolean(fData.encryptedBody));
}

function describeCoralResponse(payload) {
  if (!payload || typeof payload !== "object") return "";
  const message = [payload.errorMessage, payload.error_message, payload.message, payload.error]
    .find((value) => typeof value === "string" && value.trim());
  const status = payload.status !== undefined && payload.status !== null
    ? `status ${String(payload.status).slice(0, 32)}`
    : "";
  if (message && status) return `${message.replace(/[\r\n]/g, " ").slice(0, 180)}（${status}）`;
  if (message) return message.replace(/[\r\n]/g, " ").slice(0, 180);
  return status;
}

function getCoralServiceToken(payload) {
  return payload?.result?.accessToken || payload?.data?.result?.accessToken;
}

function shouldRetryCoralResponse(payload) {
  const status = Number(payload?.status);
  return status === 9403 || status === 9599;
}

async function getGtoken(runtime, env, fGenUrl, sessionToken) {
  const nsoappVersion = await getNsoappVersion(runtime);
  const tokenResponse = await fetchWithTimeout("https://accounts.nintendo.com/connect/1.0.0/api/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 14; Pixel 7a Build/UQ1A.240105.004)",
    },
    body: JSON.stringify({
      client_id: NSO_CLIENT_ID,
      session_token: sessionToken,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer-session-token",
    }),
  }, 30000);
  const idResponse = await readJson(tokenResponse, "Nintendo token");
  if (!idResponse.access_token || !idResponse.id_token) {
    throw new ApiError("nintendo_token_failed", "Nintendo 没有返回有效的身份 token。", 400);
  }

  const userResponse = await fetchWithTimeout("https://api.accounts.nintendo.com/2.0.0/users/me", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${idResponse.access_token}`,
      "Content-Type": "application/json",
      "User-Agent": "NASDKAPI; Android",
    },
  }, 30000);
  const userInfo = await readJson(userResponse, "Nintendo 用户信息");
  const requiredFields = ["nickname", "language", "country", "id", "birthday"];
  if (requiredFields.some((field) => !userInfo[field])) {
    throw new ApiError("nintendo_user_failed", "Nintendo 用户信息不完整。", 400);
  }

  const loginUrl = `${ZNC_URL}/v4/Account/Login`;
  const loginParameter = {
    f: "",
    language: userInfo.language,
    naBirthday: userInfo.birthday,
    naCountry: userInfo.country,
    naIdToken: idResponse.id_token,
    requestId: "",
    timestamp: 0,
  };
  let splatoonToken = await callCoralApiWithF(runtime, env, {
    accessToken: idResponse.id_token,
    step: 1,
    fGenUrl,
    userId: userInfo.id,
    coralUserId: null,
    url: loginUrl,
    parameter: loginParameter,
  });
  let accessToken = splatoonToken?.result?.webApiServerCredential?.accessToken;
  let coralUserId = splatoonToken?.result?.user?.id;
  if ((!accessToken || coralUserId === undefined || coralUserId === null)
    && shouldRetryCoralResponse(splatoonToken)) {
    splatoonToken = await callCoralApiWithF(runtime, env, {
      accessToken: idResponse.id_token,
      step: 1,
      fGenUrl,
      userId: userInfo.id,
      coralUserId: null,
      url: loginUrl,
      parameter: loginParameter,
    });
    accessToken = splatoonToken?.result?.webApiServerCredential?.accessToken;
    coralUserId = splatoonToken?.result?.user?.id;
  }
  if (!accessToken || coralUserId === undefined || coralUserId === null) {
    const detail = describeCoralResponse(splatoonToken);
    throw new ApiError(
      "nintendo_coral_login_failed",
      detail ? `Nintendo Coral 登录失败：${detail}` : "Nintendo Coral 登录失败，请稍后重试。",
      502,
    );
  }

  const serviceUrl = `${ZNC_URL}/v4/Game/GetWebServiceToken`;
  const serviceParameter = {
    f: "",
    id: 4834290508791808,
    registrationToken: "",
    requestId: "",
    timestamp: 0,
  };
  let serviceResponse = await callCoralApiWithF(runtime, env, {
    accessToken,
    step: 2,
    fGenUrl,
    userId: userInfo.id,
    coralUserId: String(coralUserId),
    url: serviceUrl,
    parameter: serviceParameter,
  });
  let webServiceToken = getCoralServiceToken(serviceResponse);
  if (!webServiceToken && shouldRetryCoralResponse(serviceResponse)) {
    serviceResponse = await callCoralApiWithF(runtime, env, {
      accessToken,
      step: 2,
      fGenUrl,
      userId: userInfo.id,
      coralUserId: String(coralUserId),
      url: serviceUrl,
      parameter: serviceParameter,
    });
    webServiceToken = getCoralServiceToken(serviceResponse);
  }
  if (!webServiceToken) {
    const detail = describeCoralResponse(serviceResponse);
    throw new ApiError(
      "nintendo_service_token_failed",
      detail ? `Nintendo 服务 token 获取失败：${detail}` : "Nintendo 服务 token 获取失败。",
      502,
    );
  }

  return {
    webServiceToken,
    nickname: userInfo.nickname,
    language: userInfo.language,
    country: userInfo.country,
    appUserAgent: config(env, "APP_USER_AGENT", DEFAULT_APP_USER_AGENT),
    nsoappVersion,
  };
}

function getMainScriptUrl(html) {
  const matches = [...html.matchAll(/<script[^>]+src=["']([^"']*static[^"']*)["']/gi)];
  if (!matches.length) return null;
  return new URL(matches[matches.length - 1][1], SPLATNET3_URL).toString();
}

async function getWebViewVersion(runtime, env, webServiceToken, language, country, appUserAgent) {
  if (runtime.webViewVersion) return runtime.webViewVersion;
  const cookie = `_dnt=1; _gtoken=${webServiceToken}`;
  const homeResponse = await fetchWithTimeout(SPLATNET3_URL, {
    headers: {
      Accept: "*/*",
      "Accept-Encoding": "gzip",
      "User-Agent": appUserAgent,
      "X-AppColorScheme": "DARK",
      "X-Requested-With": "com.nintendo.znca",
      Cookie: cookie,
    },
  }, 30000);
  if (!homeResponse.ok) {
    runtime.webViewVersion = WEB_VIEW_VERSION_FALLBACK;
    return runtime.webViewVersion;
  }
  const mainScriptUrl = getMainScriptUrl(await homeResponse.text());
  if (!mainScriptUrl) {
    runtime.webViewVersion = WEB_VIEW_VERSION_FALLBACK;
    return runtime.webViewVersion;
  }
  const scriptResponse = await fetchWithTimeout(mainScriptUrl, {
    headers: {
      Accept: "*/*",
      "Accept-Encoding": "gzip",
      Referer: SPLATNET3_URL,
      "User-Agent": appUserAgent,
      "X-Requested-With": "com.nintendo.znca",
      Cookie: cookie,
    },
  }, 30000);
  if (!scriptResponse.ok) {
    runtime.webViewVersion = WEB_VIEW_VERSION_FALLBACK;
    return runtime.webViewVersion;
  }
  const script = await scriptResponse.text();
  const match = /\b(?<revision>[0-9a-f]{40})\b[\S]*?void 0[\S]*?"revision_info_not_set"\}`,.*?=`(?<version>\d+\.\d+\.\d+)-/.exec(script);
  runtime.webViewVersion = match
    ? `${match.groups.version}-${match.groups.revision.slice(0, 8)}`
    : WEB_VIEW_VERSION_FALLBACK;
  return runtime.webViewVersion;
}

async function getBulletToken(runtime, env, webServiceToken, language, country, appUserAgent) {
  const webViewVersion = await getWebViewVersion(runtime, env, webServiceToken, language, country, appUserAgent);
  const response = await fetchWithTimeout(`${SPLATNET3_URL}/api/bullet_tokens`, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Accept-Encoding": "gzip",
      "Accept-Language": language,
      "Content-Type": "application/json",
      Origin: SPLATNET3_URL,
      "User-Agent": appUserAgent,
      "X-NACOUNTRY": country,
      "X-Requested-With": "com.nintendo.znca",
      "X-Web-View-Ver": webViewVersion,
      Cookie: `_dnt=1; _gtoken=${webServiceToken}`,
    },
  }, 60000);
  if (response.status === 204) throw new ApiError("not_registered", "该 Nintendo 账号尚未使用过 Splatoon 3 在线服务。", 400);
  if (response.status === 401) throw new ApiError("invalid_game_token", "Nintendo 游戏 token 无效，请重新生成。", 400);
  if (response.status === 403) throw new ApiError("obsolete_version", "Nintendo 服务版本已更新，请稍后重试。", 502);
  const payload = await readJson(response, "SplatNet bullet token");
  if (!payload.bulletToken) throw new ApiError("bullet_token_failed", "未能获取 SplatNet bullet token。", 502);
  return { token: payload.bulletToken, webViewVersion };
}

function graphqlBody(hash, variableName = null, variableValue = null) {
  return JSON.stringify({
    extensions: { persistedQuery: { sha256Hash: hash, version: 1 } },
    variables: variableName && variableValue !== null ? { [variableName]: variableValue } : {},
  });
}

function graphqlHeaders(bulletToken, webViewVersion, language, country, appUserAgent) {
  return {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": language,
    Authorization: `Bearer ${bulletToken}`,
    "Content-Type": "application/json",
    Origin: SPLATNET3_URL,
    Referer: `${SPLATNET3_URL}?lang=${language}&na_country=${country}&na_lang=${language}`,
    "User-Agent": appUserAgent,
    "X-Requested-With": "com.nintendo.znca",
    "X-Web-View-Ver": webViewVersion,
  };
}

async function graphQL(runtime, env, hash, bulletToken, webServiceToken, language, country, appUserAgent) {
  const webViewVersion = await getWebViewVersion(runtime, env, webServiceToken, language, country, appUserAgent);
  const response = await fetchWithTimeout(GRAPHQL_URL, {
    method: "POST",
    headers: graphqlHeaders(bulletToken, webViewVersion, language, country, appUserAgent),
    body: graphqlBody(hash),
  }, 60000);
  return readJson(response, "SplatNet GraphQL");
}

function decodeBase64Text(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0)));
}

function rotl32(value, bits) {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function murmurHash3(value, seed = 0) {
  const bytes = new TextEncoder().encode(value);
  let hash = seed >>> 0;
  const blocks = Math.floor(bytes.length / 4);
  for (let index = 0; index < blocks; index += 1) {
    const offset = index * 4;
    let k = (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
    k = Math.imul(k, 0xcc9e2d51) >>> 0;
    k = rotl32(k, 15);
    k = Math.imul(k, 0x1b873593) >>> 0;
    hash ^= k;
    hash = rotl32(hash, 13);
    hash = (Math.imul(hash, 5) + 0xe6546b64) >>> 0;
  }
  let tail = 0;
  const tailOffset = blocks * 4;
  switch (bytes.length & 3) {
    case 3: tail ^= bytes[tailOffset + 2] << 16; // falls through
    case 2: tail ^= bytes[tailOffset + 1] << 8; // falls through
    case 1:
      tail ^= bytes[tailOffset];
      tail = Math.imul(tail, 0xcc9e2d51) >>> 0;
      tail = rotl32(tail, 15);
      tail = Math.imul(tail, 0x1b873593) >>> 0;
      hash ^= tail;
      break;
    default:
      break;
  }
  hash ^= bytes.length;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function createGearExport(outfit, history) {
  let recentId = history?.data?.latestBattleHistories?.historyGroupsOnlyFirst?.nodes?.[0]?.historyDetails?.nodes?.[0]?.player?.id;
  let identifier = "";
  if (recentId) {
    identifier = decodeBase64Text(recentId).split(":").at(-1) || "";
  } else {
    const coopId = history?.data?.coopResult?.historyGroupsOnlyFirst?.nodes?.[0]?.historyDetails?.nodes?.[0]?.id;
    if (coopId) {
      identifier = decodeBase64Text(coopId).replace("CoopHistoryDetail-", "").split(":")[0];
    }
  }
  const hash = murmurHash3(identifier);
  const bytes = new TextEncoder().encode(identifier).map((byte) => byte ^ (hash & 0xff));
  return {
    key: base64Encode(bytes),
    h: hash,
    timestamp: Math.floor(Date.now() / 1000),
    gear: outfit,
  };
}

async function generateGear(runtime, env, tokens) {
  const outfit = await graphQL(
    runtime,
    env,
    QUERY_HASHES.MyOutfitCommonDataEquipmentsQuery,
    tokens.bulletToken,
    tokens.webServiceToken,
    tokens.language,
    tokens.country,
    tokens.appUserAgent,
  );
  let history = await graphQL(
    runtime,
    env,
    QUERY_HASHES.LatestBattleHistoriesQuery,
    tokens.bulletToken,
    tokens.webServiceToken,
    tokens.language,
    tokens.country,
    tokens.appUserAgent,
  );
  const hasRecentBattle = Boolean(history?.data?.latestBattleHistories?.historyGroupsOnlyFirst?.nodes?.[0]?.historyDetails?.nodes?.[0]?.player?.id);
  if (!hasRecentBattle) {
    history = await graphQL(
      runtime,
      env,
      QUERY_HASHES.CoopHistoryQuery,
      tokens.bulletToken,
      tokens.webServiceToken,
      tokens.language,
      tokens.country,
      tokens.appUserAgent,
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    filename: `gear_${timestamp}.json`,
    data: createGearExport(outfit, history),
  };
}

async function generateFlow(body, env) {
  if (!body || typeof body !== "object") throw new ApiError("invalid_request", "请求数据格式不正确。", 400);
  const flow = await readFlowToken(body.flow_token, env);
  const selectPersonUrl = String(body.select_person_url || "").trim();
  if (!selectPersonUrl) throw new ApiError("invalid_login_url", "请粘贴登录完成后的页面链接。", 400);
  const sessionTokenCode = getSessionTokenCode(selectPersonUrl);
  const fGenUrl = getFGenUrl(env);
  const runtime = {};
  const nsoappVersion = await getNsoappVersion(runtime);
  const sessionToken = await getSessionToken(sessionTokenCode, flow.verifier, nsoappVersion);
  const gtoken = await getGtoken(runtime, env, fGenUrl, sessionToken);
  const bullet = await getBulletToken(runtime, env, gtoken.webServiceToken, gtoken.language, gtoken.country, gtoken.appUserAgent);
  return generateGear(runtime, env, {
    ...gtoken,
    bulletToken: bullet.token,
    webViewVersion: bullet.webViewVersion,
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return jsonResponse(null, 204, request, env);
  if (url.pathname === "/api/health" && request.method === "GET") {
    return jsonResponse({ ok: true, service: "s3-gear-generator-api" }, 200, request, env);
  }
  if (url.pathname === "/api/start" && request.method === "POST") {
    return jsonResponse(await startFlow(env), 200, request, env);
  }
  if (url.pathname === "/api/generate" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("invalid_request", "请求数据格式不正确。", 400);
    }
    return jsonResponse(await generateFlow(body, env), 200, request, env);
  }
  throw new ApiError("not_found", "接口不存在。", 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return errorResponse(error, request, env);
    }
  },
};

export {
  buildFRequest,
  coralHeaders,
  createGearExport,
  describeCoralResponse,
  describeUpstreamError,
  getCoralServiceToken,
  shouldRetryCoralResponse,
  murmurHash3,
  getSessionTokenCode,
};
