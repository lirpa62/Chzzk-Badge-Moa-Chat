(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  const constants = ns.constants;
  if (!constants || typeof constants !== "object") {
    console.error("[badge-moa] constants module not loaded");
    return;
  }
  if (ns.storage && typeof ns.storage === "object") return;

  const { STORAGE_SESSION_FALLBACK_PREFIX } = constants;

  function getStorageValue(key, areaName = "local") {
    if (areaName === "session") {
      return getSessionCacheValue(key);
    }

    return new Promise((resolve) => {
      try {
        const storageArea =
          typeof chrome !== "undefined" &&
          chrome.storage &&
          chrome.storage[areaName]
            ? chrome.storage[areaName]
            : null;
        if (typeof chrome === "undefined" || !chrome.storage || !storageArea) {
          resolve(null);
          return;
        }

        storageArea.get([key], (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(result ? result[key] : null);
        });
      } catch (_error) {
        resolve(null);
      }
    });
  }

  function setStorageValue(key, value, areaName = "local") {
    if (areaName === "session") {
      void setSessionCacheValue(key, value);
      return;
    }

    try {
      const storageArea =
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage[areaName]
          ? chrome.storage[areaName]
          : null;
      if (typeof chrome === "undefined" || !chrome.storage || !storageArea) {
        return;
      }
      storageArea.set({ [key]: value }, () => {});
    } catch (_error) {}
  }

  function removeStorageValue(key, areaName = "local") {
    if (areaName === "session") {
      void removeSessionCacheValue(key);
      return;
    }

    try {
      const storageArea =
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage[areaName]
          ? chrome.storage[areaName]
          : null;
      if (typeof chrome === "undefined" || !chrome.storage || !storageArea) {
        return;
      }
      storageArea.remove([key], () => {});
    } catch (_error) {}
  }

  async function loadRuntimeTabId() {
    try {
      const response = await sendRuntimeMessage({
        type: "chzzk_badge_moa_get_tab_context",
      });
      const tabId = Number(response && response.tabId);
      return Number.isInteger(tabId) ? tabId : null;
    } catch (_error) {
      return null;
    }
  }

  async function getSessionCacheValue(key) {
    if (!key) return null;
    const response = await sendRuntimeMessage({
      type: "chzzk_badge_moa_session_get",
      key,
    });
    if (response && response.ok === true && response.value != null) {
      return response.value;
    }

    const fallback = getSessionFallbackValue(key);
    if (fallback != null) {
      void sendRuntimeMessage({
        type: "chzzk_badge_moa_session_set",
        key,
        value: fallback,
      });
      return fallback;
    }
    return null;
  }

  async function setSessionCacheValue(key, value) {
    if (!key) return false;
    setSessionFallbackValue(key, value);
    const response = await sendRuntimeMessage({
      type: "chzzk_badge_moa_session_set",
      key,
      value,
    });
    return !!(response && response.ok);
  }

  async function removeSessionCacheValue(key) {
    if (!key) return false;
    removeSessionFallbackValue(key);
    const response = await sendRuntimeMessage({
      type: "chzzk_badge_moa_session_remove",
      key,
    });
    return !!(response && response.ok);
  }

  async function clearSessionCachesForCurrentTab() {
    clearSessionFallbackStorage();
    await sendRuntimeMessage({
      type: "chzzk_badge_moa_session_remove_cache_prefixes",
    });
  }

  async function persistOriginalChatHtml(entry) {
    if (!entry || typeof entry !== "object") return "";
    const html = String(entry.originalChatHtml || "").trim();
    const kind = String(entry.originalChatKind || "").trim().toLowerCase();
    if (!html || !kind) return "";
    const response = await sendRuntimeMessage({
      type: "chzzk_badge_moa_original_html_put",
      ref: String(entry.originalChatRef || "").trim(),
      cacheId: `${String(entry.channelId || "").trim()}:${String(
        entry.dedupeKey || entry.sourceKey || "",
      ).trim()}`,
      html,
      kind,
    });
    return response?.ok === true ? String(response.ref || "").trim() : "";
  }

  async function persistOriginalChatHtmlBatch(entries) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const startIndex = Math.max(0, safeEntries.length - 200);
    const entriesToPersist = safeEntries.slice(startIndex);
    const response = await sendRuntimeMessage({
      type: "chzzk_badge_moa_original_html_put_batch",
      items: entriesToPersist.map((entry) => ({
        ref: String(entry?.originalChatRef || "").trim(),
        cacheId: `${String(entry?.channelId || "").trim()}:${String(
          entry?.dedupeKey || entry?.sourceKey || "",
        ).trim()}`,
        html: String(entry?.originalChatHtml || "").trim(),
        kind: String(entry?.originalChatKind || "").trim().toLowerCase(),
      })),
    });
    const refs = Array(safeEntries.length).fill("");
    if (response?.ok !== true || !Array.isArray(response.refs)) return refs;
    response.refs.forEach((ref, index) => {
      refs[startIndex + index] = String(ref || "").trim();
    });
    return refs;
  }

  async function loadOriginalChatHtml(refs) {
    const response = await sendRuntimeMessage({
      type: "chzzk_badge_moa_original_html_get",
      refs: Array.isArray(refs) ? refs : [],
    });
    const result = new Map();
    if (response?.ok !== true || !Array.isArray(response.items)) return result;
    response.items.forEach((item) => {
      const ref = String(item?.ref || "").trim();
      const html = String(item?.html || "").trim();
      const kind = String(item?.kind || "").trim().toLowerCase();
      if (!ref || !html || !kind) return;
      result.set(ref, { html, kind });
    });
    return result;
  }

  async function removeOriginalChatHtmlRefs(refs) {
    const response = await sendRuntimeMessage({
      type: "chzzk_badge_moa_original_html_remove",
      refs: Array.isArray(refs) ? refs : [],
    });
    return response?.ok === true;
  }

  async function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        if (
          typeof chrome === "undefined" ||
          !chrome.runtime ||
          typeof chrome.runtime.sendMessage !== "function"
        ) {
          resolve(null);
          return;
        }

        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response || null);
        });
      } catch (_error) {
        resolve(null);
      }
    });
  }

  function clearSessionFallbackStorage() {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) {
        return;
      }
      const keysToRemove = [];
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (!key) continue;
        if (!key.startsWith(STORAGE_SESSION_FALLBACK_PREFIX)) continue;
        keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => {
        window.sessionStorage.removeItem(key);
      });
    } catch (_error) {}
  }

  function getSessionFallbackStorageKey(key) {
    const normalized = String(key || "").trim();
    if (!normalized) return "";
    return `${STORAGE_SESSION_FALLBACK_PREFIX}${normalized}`;
  }

  function getSessionFallbackValue(key) {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) {
        return null;
      }
      const storageKey = getSessionFallbackStorageKey(key);
      if (!storageKey) return null;
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  function setSessionFallbackValue(key, value) {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) {
        return false;
      }
      const storageKey = getSessionFallbackStorageKey(key);
      if (!storageKey) return false;
      window.sessionStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function removeSessionFallbackValue(key) {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) {
        return false;
      }
      const storageKey = getSessionFallbackStorageKey(key);
      if (!storageKey) return false;
      window.sessionStorage.removeItem(storageKey);
      return true;
    } catch (_error) {
      return false;
    }
  }

  ns.storage = {
    getStorageValue,
    setStorageValue,
    removeStorageValue,
    loadRuntimeTabId,
    getSessionCacheValue,
    setSessionCacheValue,
    removeSessionCacheValue,
    clearSessionCachesForCurrentTab,
    persistOriginalChatHtml,
    persistOriginalChatHtmlBatch,
    loadOriginalChatHtml,
    removeOriginalChatHtmlRefs,
    sendRuntimeMessage,
    clearSessionFallbackStorage,
    getSessionFallbackStorageKey,
    getSessionFallbackValue,
    setSessionFallbackValue,
    removeSessionFallbackValue,
  };
})();
