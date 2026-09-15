(() => {
  "use strict";

  const config = window.S3S_WEB_CONFIG || {};
  const apiBaseUrl = String(config.apiBaseUrl || "").replace(/\/$/, "");
  const demoMode = config.demoMode !== false;
  const previewScreens = new Set(["welcome", "login", "paste", "generating", "success", "error"]);
  const previewQuery = new URLSearchParams(window.location.search);
  const previewRequested = previewQuery.has("preview");
  const requestedPreviewScreen = previewQuery.get("preview");
  const previewScreen = previewScreens.has(requestedPreviewScreen) ? requestedPreviewScreen : "welcome";
  const previewMode = previewRequested;
  const localDemoMode = demoMode || previewMode;
  const card = document.querySelector("#game-card");
  const content = document.querySelector("#card-content");
  const toast = document.querySelector("#toast");
  const footerSummary = document.querySelector("#footer-summary");
  const footerThanksLabel = document.querySelector("#footer-thanks-label");
  const footerAuthorLabel = document.querySelector("#footer-author-label");
  const footerGithub = document.querySelector("#footer-github");
  const languageToggle = document.querySelector("#language-toggle");
  const previewSwitcher = document.querySelector("#preview-switcher");
  const previewLabel = document.querySelector("#preview-label");
  const previewPrev = document.querySelector("#preview-prev");
  const previewNext = document.querySelector("#preview-next");

  const previewOrder = [...previewScreens];
  const previewLabels = {
    welcome: "previewWelcome",
    login: "previewLogin",
    paste: "previewPaste",
    generating: "previewGenerating",
    success: "previewSuccess",
    error: "previewError",
  };

  const translations = {
    zh: {
      languageButton: "English",
      footerSummary: "Splatoon3 gear generator · 不保存用户信息",
      footerAuthor: "作者：",
      footerGithub: "github",
      previewWelcome: "欢迎页",
      previewLogin: "Step 1",
      previewPaste: "Step 2",
      previewGenerating: "生成中",
      previewSuccess: "生成成功",
      previewError: "错误页",
      previous: "上一个",
      next: "下一个",
      appEyebrow: "Splatoon3 GEAR GENERATOR",
      welcomeTitle: "准备生成装备数据？",
      privacy: "本次流程不会保存你的个人信息或登录 token",
      riskLabel: "风险说明与免责声明",
      riskTitle: "风险说明与免责声明",
      riskItem1: "请确认地址为 accounts.nintendo.com。",
      riskItem2: "依赖第三方服务，不保证可用性或安全性。",
      riskItem3: "JSON 可能含敏感数据，请勿分享或上传。",
      riskItem4: "请遵守 Nintendo 条款，作者不对限制、中断或错误负责。",
      thanks: "感谢项目",
      close: "关闭网页",
      continue: "继续",
      continueWaiting: "继续（{seconds}s）",
      step1: "STEP 1 / 3",
      loginTitle: "前往任天堂网站登录",
      loginInstruction1: "点击下方按钮打开登录网站。",
      loginInstruction2: "完成 Nintendo 账号登录并选择要使用的用户。",
      loginInstruction3: "右键点击“选择此人”按钮，复制链接地址，然后返回这里。",
      loginLinkTitle: "登录链接",
      demoNotice: "当前为演示模式，接入 Worker 后这里会显示真实登录链接。",
      goWebsite: "前往网站",
      back: "返回上一步",
      step2: "STEP 2 / 3",
      pasteTitle: "粘贴“选择此人”的链接地址",
      pasteDescription: "回到本页面，将刚才复制的“选择此人”页面链接粘贴到下面。",
      fieldLabel: "任天堂页面链接",
      pastePlaceholder: "粘贴“选择此人”的链接地址",
      generateJson: "生成 JSON",
      backLogin: "返回登录说明",
      step3: "STEP 3 / 3",
      generatingTitle: "正在生成 JSON",
      generatingDescription: "请保持页面打开，不要重复提交。",
      progressVerify: "验证登录链接",
      progressAuth: "获取 nxapi 授权",
      progressF: "生成 f 参数",
      progressToken: "获取 Nintendo 服务 token",
      progressGear: "生成装备数据",
      complete: "COMPLETE",
      successTitle: "生成成功",
      successDescription: "你的装备数据已经准备好，可以下载到本地。",
      regenerate: "重新生成",
      downloadJson: "下载 JSON",
      sensitiveNotice: "下载的文件包含敏感数据，请妥善保存，不要分享给他人。",
      sorry: "SORRY",
      errorTitle: "生成没有完成",
      restart: "重新开始",
      backPaste: "返回粘贴链接",
      previewErrorNotice: "这是错误页面预览，不会发送请求。",
      loginLinkNotReady: "登录链接还没有准备好。",
      pasteRequired: "请先粘贴任天堂页面链接。",
      invalidUrl: "链接格式不正确，请粘贴完整的 https 链接。",
      noLoginLink: "服务端没有返回登录链接。",
      startFailed: "无法获取登录链接，请稍后重试。",
      generateFailed: "生成失败，请重新尝试。",
      closeBlocked: "浏览器阻止了自动关闭，请手动关闭当前标签页。",
    },
    en: {
      languageButton: "中文",
      footerSummary: "Splatoon3 gear generator · Your information is not stored",
      footerAuthor: "Author: ",
      footerGithub: "github",
      previewWelcome: "Welcome",
      previewLogin: "Step 1",
      previewPaste: "Step 2",
      previewGenerating: "Generating",
      previewSuccess: "Success",
      previewError: "Error",
      previous: "Previous",
      next: "Next",
      appEyebrow: "Splatoon3 GEAR GENERATOR",
      welcomeTitle: "Ready to generate your gear data?",
      privacy: "Your personal information and login token are not stored",
      riskLabel: "Risk notice and disclaimer",
      riskTitle: "Risk notice and disclaimer",
      riskItem1: "Use accounts.nintendo.com.",
      riskItem2: "Third-party service; availability and security are not guaranteed.",
      riskItem3: "JSON may contain sensitive data. Do not share it.",
      riskItem4: "Follow Nintendo's terms. No liability for outages or errors.",
      thanks: "Thanks to",
      close: "Close page",
      continue: "Continue",
      continueWaiting: "Continue ({seconds}s)",
      step1: "STEP 1 / 3",
      loginTitle: "Sign in on the Nintendo website",
      loginInstruction1: "Click the button below to open the sign-in website.",
      loginInstruction2: "Sign in to your Nintendo Account and choose the user you want to use.",
      loginInstruction3: "Right-click the “Select this account” button and copy its link address, then return here.",
      loginLinkTitle: "Sign-in link",
      demoNotice: "Demo mode is active. A real sign-in link will appear here after connecting a Worker.",
      goWebsite: "Open website",
      back: "Back",
      step2: "STEP 2 / 3",
      pasteTitle: "Paste the “Select this account” link",
      pasteDescription: "Return to this page and paste the “Select this account” page link below.",
      fieldLabel: "Nintendo page link",
      pastePlaceholder: "Paste the “Select this account” link",
      generateJson: "Generate JSON",
      backLogin: "Back to sign-in instructions",
      step3: "STEP 3 / 3",
      generatingTitle: "Generating JSON",
      generatingDescription: "Keep this page open and do not submit again.",
      progressVerify: "Verifying sign-in link",
      progressAuth: "Getting nxapi authorization",
      progressF: "Generating f parameter",
      progressToken: "Getting Nintendo service token",
      progressGear: "Generating gear data",
      complete: "COMPLETE",
      successTitle: "Generation complete",
      successDescription: "Your gear data is ready to download.",
      regenerate: "Generate again",
      downloadJson: "Download JSON",
      sensitiveNotice: "The downloaded file contains sensitive data. Keep it safe and do not share it.",
      sorry: "SORRY",
      errorTitle: "Generation was not completed",
      restart: "Start over",
      backPaste: "Back to link",
      previewErrorNotice: "This is an error-page preview. No request will be sent.",
      loginLinkNotReady: "The sign-in link is not ready yet.",
      pasteRequired: "Please paste the Nintendo page link first.",
      invalidUrl: "The link format is invalid. Please paste the complete https link.",
      noLoginLink: "The server did not return a sign-in link.",
      startFailed: "Could not get the sign-in link. Please try again later.",
      generateFailed: "Generation failed. Please try again.",
      closeBlocked: "Your browser blocked automatic closing. Please close this tab manually.",
    },
  };

  let currentLanguage = previewQuery.get("lang") === "en" ? "en" : "zh";
  const t = (key) => translations[currentLanguage][key] || key;

  const state = {
    screen: previewMode ? previewScreen : "welcome",
    loginUrl: previewMode ? "https://accounts.nintendo.com/preview" : "",
    flowToken: "",
    selectPersonUrl: "",
    error: previewMode ? t("previewErrorNotice") : "",
    filename: previewMode ? "gear_preview.json" : "",
    generatedData: previewMode ? { preview: true, gear: [] } : null,
  };

  const CONTINUE_DELAY_SECONDS = 5;
  const CONTINUE_DELAY_MS = CONTINUE_DELAY_SECONDS * 1000;
  let continueReadyAt = 0;
  let continueCountdownTimer = 0;

  const clearContinueCountdown = () => {
    if (!continueCountdownTimer) return;
    window.clearTimeout(continueCountdownTimer);
    continueCountdownTimer = 0;
  };

  const syncContinueButton = () => {
    clearContinueCountdown();
    const button = content.querySelector('[data-action="continue"]');

    if (state.screen !== "welcome" || !button) {
      continueReadyAt = 0;
      return;
    }

    if (!continueReadyAt) continueReadyAt = Date.now() + CONTINUE_DELAY_MS;

    const update = () => {
      const remaining = Math.max(0, Math.ceil((continueReadyAt - Date.now()) / 1000));
      const isWaiting = remaining > 0;
      const label = button.querySelector(".button-label");

      button.disabled = isWaiting;
      if (label) {
        label.textContent = isWaiting
          ? t("continueWaiting").replace("{seconds}", String(remaining))
          : t("continue");
      }

      if (isWaiting) continueCountdownTimer = window.setTimeout(update, 200);
    };

    update();
  };

  const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3600);
  };

  const setScreen = (screen, extra = {}) => {
    content.classList.remove("card-enter");
    content.classList.add("card-exit");

    window.setTimeout(() => {
      Object.assign(state, extra, { screen });
      render();
      content.classList.remove("card-exit");
      content.classList.add("card-enter");
    }, 210);
  };

  const closePage = () => {
    window.close();
    window.setTimeout(() => {
      showToast(t("closeBlocked"));
    }, 120);
  };

  const restart = () => {
    state.loginUrl = "";
    state.flowToken = "";
    state.selectPersonUrl = "";
    state.error = "";
    state.filename = "";
    state.generatedData = null;
    setScreen("welcome");
  };

  const requestJson = async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `请求失败（${response.status}）`);
    }
    return payload;
  };

  const startFlow = async () => {
    state.error = "";
    if (localDemoMode) {
      state.loginUrl = "https://accounts.nintendo.com/";
      setScreen("login");
      return;
    }

    try {
      const payload = await requestJson("/api/start", { method: "POST" });
      if (!payload?.login_url) throw new Error(t("noLoginLink"));
      state.loginUrl = payload.login_url;
      state.flowToken = payload.flow_token || "";
      setScreen("login");
    } catch (error) {
      state.error = error.message || t("startFailed");
      setScreen("error");
    }
  };

  const openLogin = () => {
    if (!state.loginUrl) {
      showToast(t("loginLinkNotReady"));
      return;
    }
    if (!previewMode) {
      window.open(state.loginUrl, "_blank", "noopener,noreferrer");
    }
    // 登录页在新标签页打开，当前页直接进入粘贴步骤，方便用户返回继续操作。
    setScreen("paste");
  };

  const isLikelyUrl = (value) => {
    try {
      const url = new URL(value);
      const isNintendoCallback = /^npf[0-9a-z]+:$/.test(url.protocol)
        && url.hostname === "auth";
      const isHttpsLink = url.protocol === "https:" && Boolean(url.hostname);
      const hasSessionTokenCode = url.hash.includes("session_token_code=")
        || url.searchParams.has("session_token_code")
        || url.searchParams.has("de");
      return (isNintendoCallback || isHttpsLink) && hasSessionTokenCode;
    } catch {
      return false;
    }
  };

  const createDemoData = () => ({
    generated_at: new Date().toISOString(),
    source: "s3s-web-demo",
    gear: [],
  });

  const createFilename = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `gear_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  };

  const generate = async () => {
    const input = document.querySelector("#select-person-url");
    const value = input?.value.trim() || "";
    if (!value) {
      showToast(t("pasteRequired"));
      input?.focus();
      return;
    }
    if (!isLikelyUrl(value)) {
      showToast(t("invalidUrl"));
      input?.focus();
      return;
    }

    // 只在当前请求期间使用，提交后立即清空输入框和内存中的链接。
    state.selectPersonUrl = value;
    input.value = "";
    setScreen("generating");

    try {
      let payload;
      if (localDemoMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 850));
        payload = createDemoData();
      } else {
        payload = await requestJson("/api/generate", {
          method: "POST",
          body: JSON.stringify({
            select_person_url: state.selectPersonUrl,
            flow_token: state.flowToken,
          }),
        });
      }

      state.selectPersonUrl = "";
      state.generatedData = payload?.data || payload;
      state.filename = payload?.filename || createFilename();
      setScreen("success");
    } catch (error) {
      state.selectPersonUrl = "";
      state.error = error.message || t("generateFailed");
      setScreen("error");
    }
  };

  const download = () => {
    if (!state.generatedData) return;
    const blob = new Blob([JSON.stringify(state.generatedData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = state.filename || createFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const renderWelcome = () => `
    <div class="screen-layout">
      <div class="screen-header">
        <p class="eyebrow">${t("appEyebrow")}</p>
        <h1>${t("welcomeTitle")}</h1>
      </div>
      <div class="screen-body welcome-body">
        <aside class="risk-notice" aria-label="${t("riskLabel")}">
          <div class="risk-notice-heading">
            <span class="risk-notice-icon" aria-hidden="true">!</span>
            <strong>${t("riskTitle")}</strong>
          </div>
          <p class="risk-privacy">${t("privacy")}</p>
          <ul class="risk-notice-list">
            <li>${t("riskItem1")}</li>
            <li>${t("riskItem2")}</li>
            <li>${t("riskItem3")}</li>
            <li>${t("riskItem4")}</li>
          </ul>
        </aside>
      </div>
      <div class="screen-footer">
        <div class="actions">
          <button class="ink-button secondary" data-action="close"><span class="button-label">${t("close")}</span></button>
          <button class="ink-button" data-action="continue" disabled><span class="button-label">${t("continueWaiting").replace("{seconds}", String(CONTINUE_DELAY_SECONDS))}</span></button>
        </div>
      </div>
    </div>
  `;

  const renderLogin = () => `
    <div class="screen-layout">
      <div class="screen-header">
        <p class="eyebrow">${t("step1")}</p>
        <h2>${t("loginTitle")}</h2>
      </div>
      <div class="screen-body login-body">
        <div class="instructions">
          <div class="instruction"><span class="instruction-number">1</span><span>${t("loginInstruction1")}</span></div>
          <div class="instruction"><span class="instruction-number">2</span><span>${t("loginInstruction2")}</span></div>
          <div class="instruction"><span class="instruction-number">3</span><span>${t("loginInstruction3")}</span></div>
        </div>
        <div class="login-link" title="${t("loginLinkTitle")}">${escapeHtml(state.loginUrl)}</div>
        ${demoMode ? `<p class="subtle">${t("demoNotice")}</p>` : ""}
      </div>
      <div class="screen-footer">
        <div class="actions">
          <button class="ink-button secondary" data-action="close"><span class="button-label">${t("close")}</span></button>
          <button class="ink-button" data-action="open-login"><span class="button-label">${t("goWebsite")}</span></button>
        </div>
        <button class="text-button" data-action="back">${t("back")}</button>
      </div>
    </div>
  `;

  const renderPaste = () => `
    <div class="screen-layout">
      <div class="screen-header">
        <p class="eyebrow">${t("step2")}</p>
        <h2>${t("pasteTitle")}</h2>
      </div>
      <div class="screen-body paste-body">
        <p class="subtle">${t("pasteDescription")}</p>
        <label class="field-label" for="select-person-url">${t("fieldLabel")}</label>
        <textarea id="select-person-url" class="link-input" placeholder="${t("pastePlaceholder")}" autocomplete="off" spellcheck="false"></textarea>
      </div>
      <div class="screen-footer">
        <div class="actions">
          <button class="ink-button secondary" data-action="close"><span class="button-label">${t("close")}</span></button>
          <button class="ink-button" data-action="generate"><span class="button-label">${t("generateJson")}</span></button>
        </div>
        <button class="text-button" data-action="back-login">${t("backLogin")}</button>
      </div>
    </div>
  `;

  const progressItems = [
    "progressVerify",
    "progressAuth",
    "progressF",
    "progressToken",
    "progressGear",
  ];

  const renderGenerating = () => `
    <div class="screen-layout">
      <div class="screen-header">
        <p class="eyebrow">${t("step3")}</p>
        <h2>${t("generatingTitle")}</h2>
      </div>
      <div class="screen-body generating-body">
        <div class="generating-stack">
          <p class="subtle">${t("generatingDescription")}</p>
          <div class="progress-list">
            ${progressItems.map((item, index) => `
              <div class="progress-item ${index === 0 ? "active" : ""}" data-progress-index="${index}">
                <span class="progress-dot"></span><span>${t(item)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="screen-footer"></div>
    </div>
  `;

  const renderSuccess = () => `
    <div class="screen-layout">
      <div class="screen-header">
        <p class="eyebrow">${t("complete")}</p>
        <h2>${t("successTitle")}</h2>
      </div>
      <div class="screen-body success-body">
        <p class="subtle">${t("successDescription")}</p>
        <p class="file-name">${escapeHtml(state.filename)}</p>
      </div>
      <div class="screen-footer">
        <div class="actions">
          <button class="ink-button secondary" data-action="restart"><span class="button-label">${t("regenerate")}</span></button>
          <button class="ink-button" data-action="download"><span class="button-label">${t("downloadJson")}</span></button>
        </div>
        <p class="subtle footer-hint">${t("sensitiveNotice")}</p>
      </div>
    </div>
  `;

  const renderError = () => `
    <div class="screen-layout">
      <div class="screen-header">
        <p class="eyebrow">${t("sorry")}</p>
        <h2>${t("errorTitle")}</h2>
      </div>
      <div class="screen-body error-body">
        <div class="error-box">${escapeHtml(state.error || t("generateFailed"))}</div>
      </div>
      <div class="screen-footer">
        <div class="actions">
          <button class="ink-button secondary" data-action="restart"><span class="button-label">${t("restart")}</span></button>
          <button class="ink-button" data-action="back-paste"><span class="button-label">${t("backPaste")}</span></button>
        </div>
      </div>
    </div>
  `;

  const render = () => {
    const templates = {
      welcome: renderWelcome,
      login: renderLogin,
      paste: renderPaste,
      generating: renderGenerating,
      success: renderSuccess,
      error: renderError,
    };
    card.dataset.screen = state.screen;
    content.innerHTML = templates[state.screen]();
    document.documentElement.lang = currentLanguage === "en" ? "en" : "zh-CN";
    footerSummary.textContent = t("footerSummary");
    footerThanksLabel.textContent = t("thanks");
    footerAuthorLabel.textContent = t("footerAuthor");
    footerGithub.textContent = t("footerGithub");
    languageToggle.textContent = t("languageButton");
    languageToggle.setAttribute("aria-label", t("languageButton"));
    if (previewMode) {
      previewSwitcher.hidden = false;
      previewLabel.textContent = `${t(previewLabels[state.screen]) || t("previewWelcome")} · ${previewOrder.indexOf(state.screen) + 1}/6`;
      previewPrev.textContent = t("previous");
      previewNext.textContent = t("next");
    }

    if (state.screen === "generating") {
      const items = [...content.querySelectorAll("[data-progress-index]")];
      items.forEach((item, index) => {
        window.setTimeout(() => {
          items.forEach((candidate, candidateIndex) => {
            candidate.classList.toggle("active", candidateIndex === index);
            candidate.classList.toggle("done", candidateIndex < index);
          });
        }, index * 760);
      });
    }

    syncContinueButton();
  };

  const navigatePreview = (offset) => {
    const currentIndex = previewOrder.indexOf(state.screen);
    const nextIndex = (currentIndex + offset + previewOrder.length) % previewOrder.length;
    const nextScreen = previewOrder[nextIndex];
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("preview", nextScreen);
    window.location.assign(nextUrl.href);
  };

  previewPrev.addEventListener("click", () => navigatePreview(-1));
  previewNext.addEventListener("click", () => navigatePreview(1));

  languageToggle.addEventListener("click", () => {
    currentLanguage = currentLanguage === "zh" ? "en" : "zh";
    const nextUrl = new URL(window.location.href);
    if (currentLanguage === "en") nextUrl.searchParams.set("lang", "en");
    else nextUrl.searchParams.delete("lang");
    window.history.replaceState({}, "", nextUrl.href);
    if (previewMode) state.error = t("previewErrorNotice");
    render();
  });

  content.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "close") closePage();
    if (action === "continue") {
      if (event.target.closest("button")?.disabled) return;
      startFlow();
    }
    if (action === "open-login") openLogin();
    if (action === "back") setScreen("welcome");
    if (action === "back-login") setScreen("login");
    if (action === "generate") generate();
    if (action === "download") download();
    if (action === "restart") restart();
    if (action === "back-paste") setScreen("paste");
  });

  render();
})();
