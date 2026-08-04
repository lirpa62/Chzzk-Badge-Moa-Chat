const CHZZK_TAB_MATCH_PATTERNS = ["https://chzzk.naver.com/*"];
const UPDATE_BANNER_ENABLED_KEY =
  "chzzk_badge_moa_update_banner_enabled";
const SESSION_CACHE_PREFIX_V1 = "chzzk_badge_moa_tab_channel_cache_v1:";
const SESSION_CACHE_PREFIX_LEGACY = "chzzk_badge_moa_channel_cache_v1:";

function getChzzkContentScriptFiles(key, options = {}) {
  const manifest =
    chrome.runtime && typeof chrome.runtime.getManifest === "function"
      ? chrome.runtime.getManifest()
      : null;
  const scripts = Array.isArray(manifest?.content_scripts)
    ? manifest.content_scripts
    : [];
  return scripts
    .filter((script) => {
      const matches = Array.isArray(script.matches) ? script.matches : [];
      if (!matches.includes("https://chzzk.naver.com/*")) return false;
      if (options.excludeMainWorld === true && script.world === "MAIN") {
        return false;
      }
      return Array.isArray(script[key]) && script[key].length > 0;
    })
    .flatMap((script) => script[key]);
}

function getSessionStorageArea() {
  if (
    typeof chrome === "undefined" ||
    !chrome.storage ||
    !chrome.storage.session
  ) {
    return null;
  }
  return chrome.storage.session;
}

async function getSessionValue(key) {
  const storage = getSessionStorageArea();
  if (!storage || !key) return null;
  const result = await storage.get([key]);
  return result ? result[key] : null;
}

async function setSessionValue(key, value) {
  const storage = getSessionStorageArea();
  if (!storage || !key) return false;
  await storage.set({ [key]: value });
  return true;
}

async function removeSessionValue(key) {
  const storage = getSessionStorageArea();
  if (!storage || !key) return false;
  await storage.remove([key]);
  return true;
}

async function removeSessionValuesByPrefixes(prefixes) {
  const storage = getSessionStorageArea();
  if (!storage) return false;
  const list = Array.isArray(prefixes) ? prefixes : [];
  if (list.length === 0) return true;

  const all = await storage.get(null);
  const keys = Object.keys(all || {}).filter((key) =>
    list.some((prefix) => key.startsWith(prefix)),
  );
  if (keys.length === 0) return true;

  await storage.remove(keys);
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message && message.type ? String(message.type) : "";
  if (!type) return false;

  if (type === "chzzk_badge_moa_get_tab_context") {
    const tabId = Number(sender && sender.tab && sender.tab.id);
    sendResponse({
      ok: Number.isInteger(tabId),
      tabId: Number.isInteger(tabId) ? tabId : null,
    });
    return false;
  }

  if (type === "chzzk_badge_moa_session_get") {
    const key = String(message && message.key ? message.key : "");
    (async () => {
      try {
        const value = await getSessionValue(key);
        sendResponse({ ok: true, value });
      } catch (_error) {
        sendResponse({ ok: false, value: null });
      }
    })();
    return true;
  }

  if (type === "chzzk_badge_moa_session_set") {
    const key = String(message && message.key ? message.key : "");
    const value = message ? message.value : null;
    (async () => {
      try {
        await setSessionValue(key, value);
        sendResponse({ ok: true });
      } catch (_error) {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (type === "chzzk_badge_moa_session_remove") {
    const key = String(message && message.key ? message.key : "");
    (async () => {
      try {
        await removeSessionValue(key);
        sendResponse({ ok: true });
      } catch (_error) {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (type === "chzzk_badge_moa_session_remove_cache_prefixes") {
    const tabId = Number(message && message.tabId);
    const prefixes = [
      `${SESSION_CACHE_PREFIX_V1}channel:`,
      SESSION_CACHE_PREFIX_LEGACY,
    ];
    if (Number.isInteger(tabId)) {
      prefixes.push(`${SESSION_CACHE_PREFIX_V1}tab:${tabId}:`);
    }
    (async () => {
      try {
        await removeSessionValuesByPrefixes(prefixes);
        sendResponse({ ok: true });
      } catch (_error) {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  return false;
});

async function pingChzzkContentScript(tabId) {
  if (!Number.isInteger(tabId)) return false;
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(
        tabId,
        { type: "chzzk_badge_moa_content_ping" },
        (response) => {
          const runtimeError =
            chrome.runtime && chrome.runtime.lastError
              ? chrome.runtime.lastError
              : null;
          if (runtimeError) {
            resolve(false);
            return;
          }
          resolve(!!(response && response.ok));
        },
      );
    } catch (_error) {
      resolve(false);
    }
  });
}

async function reinjectChzzkContentScripts(tabId) {
  if (!Number.isInteger(tabId)) return false;
  try {
    await chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        files: ["inject.js"],
        world: "MAIN",
      })
      .catch(() => {});

    await chrome.scripting
      .insertCSS({
        target: { tabId, allFrames: true },
        files: getChzzkContentScriptFiles("css"),
      })
      .catch(() => {});

    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: getChzzkContentScriptFiles("js", { excludeMainWorld: true }),
      world: "ISOLATED",
    });
    return true;
  } catch (_error) {
    return false;
  }
}

async function showUpdateBannerOnTab(tabId) {
  if (!Number.isInteger(tabId)) return;
  if (!(await isUpdateBannerEnabled())) return;
  await chrome.scripting
    .executeScript({
      target: { tabId },
      func: showUpdateNotificationBanner,
    })
    .catch(() => {});
}

async function isUpdateBannerEnabled() {
  try {
    const result = await chrome.storage.local.get([UPDATE_BANNER_ENABLED_KEY]);
    return result[UPDATE_BANNER_ENABLED_KEY] !== false;
  } catch (_error) {
    return true;
  }
}

function removeUpdateNotificationBanner() {
  document.getElementById("chzzk-badge-moa-ext-update-banner")?.remove();
}

async function removeUpdateBannersFromChzzkTabs() {
  const tabs = await chrome.tabs.query({
    url: CHZZK_TAB_MATCH_PATTERNS,
  });
  await Promise.all(
    tabs.map((tab) => {
      const tabId = Number(tab && tab.id);
      if (!Number.isInteger(tabId)) return Promise.resolve();
      return chrome.scripting
        .executeScript({
          target: { tabId },
          func: removeUpdateNotificationBanner,
        })
        .catch(() => {});
    }),
  );
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const change = changes[UPDATE_BANNER_ENABLED_KEY];
  if (!change || change.newValue !== false) return;
  void removeUpdateBannersFromChzzkTabs();
});

// 설치 및 업데이트 감지 리스너
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install" && details.reason !== "update") return;

  const tabs = await chrome.tabs.query({
    url: CHZZK_TAB_MATCH_PATTERNS,
  });

  const isUpdate = details.reason === "update";

  for (const tab of tabs) {
    const tabId = Number(tab && tab.id);
    if (!Number.isInteger(tabId)) continue;

    // 업데이트 시에는 기존 페이지에 구버전 content script가 살아 있을 수 있어
    // 강제 재주입하면 UI가 중복 생성될 수 있으므로 배너만 노출한다.
    if (!isUpdate) {
      let reachable = await pingChzzkContentScript(tabId);
      if (!reachable) {
        await reinjectChzzkContentScripts(tabId);
        reachable = await pingChzzkContentScript(tabId);
      }
    }

    await showUpdateBannerOnTab(tabId);
  }
});

// 3. 페이지에 주입될 배너 생성 함수
function showUpdateNotificationBanner() {
  // 이미 배너가 있다면 중복 생성 방지
  if (document.getElementById("chzzk-badge-moa-ext-update-banner")) {
    return;
  }

  const banner = document.createElement("div");
  banner.id = "chzzk-badge-moa-ext-update-banner";

  // 스타일 설정
  banner.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 50px;
    background-color: #772ce8;
    color: white;
    text-align: center;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transform: translateY(-100%);
    transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
  `;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
  `;

  const message = document.createElement("span");
  message.innerText =
    "🚀 배지 모아 챗 확장 프로그램이 업데이트 되었습니다. 원활한 사용을 위해 새로고침 해주세요.";
  message.style.fontWeight = "500";

  const refreshButton = document.createElement("button");
  refreshButton.innerText = "새로고침";
  refreshButton.style.cssText = `
    background-color: #00ffa3;
    color: #121212;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-weight: 800;
    cursor: pointer;
    font-size: 13px;
    transition: filter 0.2s;
  `;

  refreshButton.onmouseover = () => {
    refreshButton.style.filter = "brightness(0.9)";
  };
  refreshButton.onmouseout = () => {
    refreshButton.style.filter = "brightness(1)";
  };

  refreshButton.onclick = () => {
    banner.style.transform = "translateY(-100%)";
    setTimeout(() => location.reload(), 200);
  };

  const closeButton = document.createElement("span");
  closeButton.innerText = "×";
  closeButton.style.cssText = `
    cursor: pointer;
    font-size: 24px;
    font-weight: bold;
    margin-left: 20px;
    opacity: 0.8;
    line-height: 1;
  `;
  closeButton.onmouseover = () => {
    closeButton.style.opacity = "1";
  };
  closeButton.onmouseout = () => {
    closeButton.style.opacity = "0.8";
  };

  closeButton.onclick = () => {
    banner.style.transform = "translateY(-100%)";
    setTimeout(() => banner.remove(), 500);
  };

  wrapper.appendChild(message);
  wrapper.appendChild(refreshButton);
  banner.appendChild(wrapper);
  banner.appendChild(closeButton);

  document.body.appendChild(banner);

  // 애니메이션 실행
  setTimeout(() => {
    banner.style.transform = "translateY(0)";
  }, 100);
}
