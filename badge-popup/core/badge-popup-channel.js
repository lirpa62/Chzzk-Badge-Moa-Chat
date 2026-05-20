(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.channel && typeof ns.channel === "object") return;
  const VIDEO_CHANNEL_HINTS_STORAGE_KEY = "chzzk_badge_moa_video_channel_hints_v1";
  const VIDEO_CHANNEL_HINTS_MAX = 120;
  const LIVE_CHANNEL_HINTS_STORAGE_KEY = "chzzk_badge_moa_live_channel_hints_v1";
  const LIVE_CHANNEL_HINTS_MAX = 120;

  function isStableChannelId(value) {
    return /^[a-f0-9]{32}$/i.test(String(value || "").trim());
  }

  function normalizeChannelId(value) {
    const normalized = String(value || "").trim();
    if (isStableChannelId(normalized)) {
      return normalized.toLowerCase();
    }
    return normalized;
  }

  function getVideoNoFromLocationPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] !== "video") return "";
    return String(parts[1] || "").trim();
  }

  function readVideoChannelHints() {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return {};
      const raw = window.sessionStorage.getItem(VIDEO_CHANNEL_HINTS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeVideoChannelHints(hints) {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;
      window.sessionStorage.setItem(
        VIDEO_CHANNEL_HINTS_STORAGE_KEY,
        JSON.stringify(hints),
      );
    } catch (_error) {}
  }

  function getVideoChannelHint(videoNo) {
    const key = String(videoNo || "").trim();
    if (!key) return "";
    const hints = readVideoChannelHints();
    const hintedChannelId = normalizeChannelId(hints[key] || "");
    return isStableChannelId(hintedChannelId) ? hintedChannelId : "";
  }

  function rememberVideoChannelHint(videoNo, channelId) {
    const key = String(videoNo || "").trim();
    const normalizedChannelId = normalizeChannelId(channelId);
    if (!key || !isStableChannelId(normalizedChannelId)) return;

    const hints = readVideoChannelHints();
    if (hints[key] === normalizedChannelId) return;
    delete hints[key];
    hints[key] = normalizedChannelId;

    const keys = Object.keys(hints);
    while (keys.length > VIDEO_CHANNEL_HINTS_MAX) {
      const oldestKey = keys.shift();
      if (!oldestKey) break;
      delete hints[oldestKey];
    }
    writeVideoChannelHints(hints);
  }

  function readLiveChannelHints() {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return {};
      const raw = window.sessionStorage.getItem(LIVE_CHANNEL_HINTS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeLiveChannelHints(hints) {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;
      window.sessionStorage.setItem(
        LIVE_CHANNEL_HINTS_STORAGE_KEY,
        JSON.stringify(hints),
      );
    } catch (_error) {}
  }

  function getLivePathHintKeyFromParts(parts) {
    if (!Array.isArray(parts) || parts[0] !== "live") return "";
    const liveSegment = String(parts[1] || "").trim();
    if (liveSegment) return `live:${liveSegment}`;
    const pathname = String(window.location.pathname || "").trim();
    const search = String(window.location.search || "").trim();
    if (pathname || search) {
      return `live:${pathname}${search}`;
    }
    return "live:/live";
  }

  function getLiveChannelHint(hintKey) {
    const key = String(hintKey || "").trim();
    if (!key) return "";
    const hints = readLiveChannelHints();
    const hintedChannelId = normalizeChannelId(hints[key] || "");
    return isStableChannelId(hintedChannelId) ? hintedChannelId : "";
  }

  function rememberLiveChannelHint(hintKey, channelId) {
    const key = String(hintKey || "").trim();
    const normalizedChannelId = normalizeChannelId(channelId);
    if (!key || !isStableChannelId(normalizedChannelId)) return;

    const hints = readLiveChannelHints();
    if (hints[key] === normalizedChannelId) return;
    delete hints[key];
    hints[key] = normalizedChannelId;

    const keys = Object.keys(hints);
    while (keys.length > LIVE_CHANNEL_HINTS_MAX) {
      const oldestKey = keys.shift();
      if (!oldestKey) break;
      delete hints[oldestKey];
    }
    writeLiveChannelHints(hints);
  }

  function extractChannelIdFromUrl(urlCandidate) {
    try {
      const url = new URL(String(urlCandidate || ""), window.location.origin);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return "";
      if (parts[0] === "video") return "";
      if (parts[0] === "live") {
        return normalizeChannelId(parts[1] || "");
      }
      return normalizeChannelId(parts[0] || "");
    } catch (_error) {
      return "";
    }
  }

  function getStableChannelIdFromDom() {
    const selectors = [
      "a.video_information_link__2OrbG",
      "a[class*='video_information_link']",
      "section[class*='video_information'] a[href]",
      "[class*='video_information'] a[href]",
      "a[href*='/live/']",
    ];
    for (const selector of selectors) {
      const anchor = document.querySelector(selector);
      if (!(anchor instanceof HTMLAnchorElement)) continue;
      const fromHref = extractChannelIdFromUrl(anchor.href);
      if (isStableChannelId(fromHref)) {
        return fromHref;
      }
    }
    return "";
  }

  function getRawChannelIdFromLocationPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts[0] === "video") return "";
    if (parts[0] === "live") {
      return normalizeChannelId(parts[1] || "");
    }
    return normalizeChannelId(parts[0] || "");
  }

  function getChannelIdFromLocationPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts[0] === "video") {
      const videoNo = getVideoNoFromLocationPath();
      const fromDom = getStableChannelIdFromDom();
      if (fromDom) {
        rememberVideoChannelHint(videoNo, fromDom);
        return fromDom;
      }
      return getVideoChannelHint(videoNo);
    }
    if (parts[0] === "live") {
      const liveHintKey = getLivePathHintKeyFromParts(parts);
      const rawChannelId = normalizeChannelId(parts[1] || "");
      if (isStableChannelId(rawChannelId)) {
        rememberLiveChannelHint(liveHintKey, rawChannelId);
        return rawChannelId;
      }
      const fromDom = getStableChannelIdFromDom();
      if (fromDom) {
        rememberLiveChannelHint(liveHintKey, fromDom);
        return fromDom;
      }
      const hintedChannelId = getLiveChannelHint(liveHintKey);
      if (hintedChannelId) return hintedChannelId;
      return rawChannelId;
    }
    return normalizeChannelId(parts[0] || "");
  }

  function isVideoPage() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[0] === "video";
  }

  function getLocationKey() {
    if (isVideoPage()) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const videoNo = String(parts[1] || "").trim();
      return videoNo ? `video:${videoNo}` : "video";
    }
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "home";
    if (parts[0] === "live") {
      const liveId = normalizeChannelId(parts[1] || "");
      if (liveId) return `live:${liveId}`;
      const pathname = String(window.location.pathname || "").trim();
      const search = String(window.location.search || "").trim();
      const fallback = `${pathname}${search}`;
      return fallback ? `live:${fallback}` : "live";
    }
    const rawChannelId = normalizeChannelId(parts[0] || "");
    if (rawChannelId) return `live:${rawChannelId}`;
    return "home";
  }

  function getSettingsScopeKey(resolvedChannelIdCandidate = "") {
    const resolvedChannelId = normalizeChannelId(resolvedChannelIdCandidate);
    if (isStableChannelId(resolvedChannelId)) {
      return `channel:${resolvedChannelId}`;
    }

    const hintedChannelId = getChannelIdFromLocationPath();
    if (isStableChannelId(hintedChannelId)) {
      return `channel:${hintedChannelId}`;
    }

    if (resolvedChannelId) {
      return `channel:${resolvedChannelId}`;
    }
    if (hintedChannelId) {
      return `channel:${hintedChannelId}`;
    }
    return "home";
  }

  function updateResolvedChannelIdFromPayload(state, payload, deps = {}) {
    if (!payload || typeof payload !== "object") return;

    const fromStreaming = normalizeChannelId(payload.streamingChannelId || "");
    const fromChannel = normalizeChannelId(payload.channelId || "");
    const nextChannelId = isStableChannelId(fromStreaming)
      ? fromStreaming
      : fromStreaming || fromChannel;
    if (!nextChannelId) return;
    const hintedVideoNo =
      payload && typeof payload === "object" ? String(payload.videoNo || "").trim() : "";
    if (hintedVideoNo && isStableChannelId(nextChannelId)) {
      rememberVideoChannelHint(hintedVideoNo, nextChannelId);
    }
    if (isStableChannelId(nextChannelId)) {
      const livePathParts = window.location.pathname.split("/").filter(Boolean);
      const liveHintKey = getLivePathHintKeyFromParts(livePathParts);
      if (liveHintKey) {
        rememberLiveChannelHint(liveHintKey, nextChannelId);
      }
    }

    const currentChannelId = normalizeChannelId(state.resolvedChannelId || "");
    if (
      isStableChannelId(currentChannelId) &&
      !isStableChannelId(nextChannelId)
    ) {
      return;
    }
    if (nextChannelId === currentChannelId) return;

    state.resolvedChannelId = nextChannelId;
    const nextScopeKey = getSettingsScopeKey(state.resolvedChannelId);
    if (nextScopeKey === state.settingsScopeKey) return;

    state.settingsScopeKey = nextScopeKey;
    state.settings.hiddenPillNicknames = new Set();
    state.settings.trackedScopedNicknames = new Set();
    if (typeof deps.rebuildEffectiveTrackedNicknames === "function") {
      deps.rebuildEffectiveTrackedNicknames();
    }
    if (typeof deps.syncTrackedTargetsToInject === "function") {
      deps.syncTrackedTargetsToInject();
    }
    if (typeof deps.reloadSettingsForScope === "function") {
      deps.reloadSettingsForScope(nextScopeKey);
    }
  }

  function handleLocationChange(state, forceReset, deps = {}) {
    const nextKey = getLocationKey();
    const nextResolvedChannelId = getChannelIdFromLocationPath();
    const prevResolvedChannelId = normalizeChannelId(state.resolvedChannelId);
    const nextResolvedChannelIdNormalized = normalizeChannelId(
      nextResolvedChannelId,
    );

    let isChannelIdChanged =
      nextResolvedChannelIdNormalized !== prevResolvedChannelId;
    if (isVideoPage() && !nextResolvedChannelIdNormalized) {
      isChannelIdChanged = false;
    }

    const activeChannelId = isChannelIdChanged
      ? nextResolvedChannelIdNormalized
      : prevResolvedChannelId;
    const nextScopeKey = getSettingsScopeKey(activeChannelId);
    const scopeChanged = nextScopeKey !== state.settingsScopeKey;
    const locationChanged = nextKey !== state.locationKey || isChannelIdChanged;

    if (!forceReset && !locationChanged) return;
    if (forceReset && !locationChanged && !scopeChanged) {
      if (typeof deps.refreshChatHighlightObserver === "function") {
        deps.refreshChatHighlightObserver();
      }
      if (typeof deps.scheduleChatHighlightScan === "function") {
        deps.scheduleChatHighlightScan();
      }
      return;
    }

    if (typeof deps.clearPersistChannelCacheTimer === "function") {
      deps.clearPersistChannelCacheTimer();
    }
    const prevChannelId = normalizeChannelId(state.resolvedChannelId);
    if (nextKey.startsWith("video:") && isStableChannelId(prevChannelId)) {
      rememberVideoChannelHint(nextKey.slice("video:".length), prevChannelId);
    }
    if (isStableChannelId(prevChannelId)) {
      const livePathParts = window.location.pathname.split("/").filter(Boolean);
      const liveHintKey = getLivePathHintKeyFromParts(livePathParts);
      if (liveHintKey) {
        rememberLiveChannelHint(liveHintKey, prevChannelId);
      }
    }
    if (typeof deps.isSessionCacheEnabled === "function" && deps.isSessionCacheEnabled()) {
      if (typeof deps.persistChannelCacheNow === "function") {
        deps.persistChannelCacheNow(prevChannelId);
      }
    }

    state.resolvedChannelId = activeChannelId;
    if (scopeChanged) {
      state.settingsScopeKey = nextScopeKey;
      state.settings.hiddenPillNicknames = new Set();
      state.settings.trackedScopedNicknames = new Set();
      if (typeof deps.rebuildEffectiveTrackedNicknames === "function") {
        deps.rebuildEffectiveTrackedNicknames();
      }
      if (typeof deps.syncTrackedTargetsToInject === "function") {
        deps.syncTrackedTargetsToInject();
      }
      if (typeof deps.reloadSettingsForScope === "function") {
        deps.reloadSettingsForScope(nextScopeKey);
      }
    }

    state.locationKey = nextKey;
    state.incoming.queue = [];
    state.incoming.flushQueued = false;
    state.incoming.pauseProcessing = false;
    state.chatChannelId = "";
    state.entries = [];
    state.dedupeKeys.clear();
    state.unseenCount = 0;
    state.unseenActors.clear();
    state.isSettingsOpen = false;
    if (state.cache && typeof state.cache === "object") {
      state.cache.resolvedRestoreChannelId = "";
      state.cache.resolvedRestoreInFlight = "";
    }
    if (scopeChanged) {
      state.nicknameFilter.selected.clear();
      state.nicknameFilter.autoSelectNew = true;
      state.nicknameFilter.pendingTrackedNicknames.clear();
    }

    if (typeof deps.resetPillCycle === "function") {
      deps.resetPillCycle(true);
    }
    if (typeof deps.closePopup === "function") {
      deps.closePopup(true);
    }
    if (typeof deps.render === "function") {
      deps.render();
    }
    if (typeof deps.isSessionCacheEnabled === "function" && deps.isSessionCacheEnabled()) {
      if (typeof deps.restoreChannelCache === "function") {
        deps.restoreChannelCache(state.resolvedChannelId);
      }
    }
    if (typeof deps.refreshChatHighlightObserver === "function") {
      deps.refreshChatHighlightObserver();
    }
    if (typeof deps.scheduleChatHighlightScan === "function") {
      deps.scheduleChatHighlightScan();
    }
  }

  const channelDisplayNameCache = new Map();

  function getChannelDisplayNameFromDom() {
    const selectors = [
      "a.video_information_link__2OrbG .name_text__yQG50",
      "a[class*='video_information_link'] [class*='name_text']",
      "section[class*='video_information'] a[href^='/'] [class*='name_text']",
      "[class*='video_information'] [class*='name_text']",
      "h2[class*='channel_profile_name'] [class*='name_text']",
      "[class*='channel_profile_information'] [class*='name_text']",
      "[class*='live_information_player_channel'] [class*='name_text']",
      "[class*='live_information_player'] [class*='name_text']",
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = String(node && node.textContent ? node.textContent : "").trim();
      if (text) return text;
    }

    return "";
  }

  function resolveChannelDisplayName(state, deps = {}) {
    const channelId = normalizeChannelId(state.resolvedChannelId || "");
    const fromDom = getChannelDisplayNameFromDom();
    if (fromDom) {
      if (isStableChannelId(channelId)) {
        channelDisplayNameCache.set(channelId, fromDom);
      }
      return fromDom;
    }

    if (isStableChannelId(channelId) && channelDisplayNameCache.has(channelId)) {
      return channelDisplayNameCache.get(channelId);
    }

    const normalizeNickname =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    for (let i = state.entries.length - 1; i >= 0; i -= 1) {
      const entry = state.entries[i];
      if (!entry) continue;
      if (entry.badgeType !== "channel_owner" && entry.badgeType !== "owner") {
        continue;
      }
      const nickname = normalizeNickname(entry.nickname);
      if (nickname) return nickname;
    }
    return "";
  }

  ns.channel = {
    isStableChannelId,
    normalizeChannelId,
    getRawChannelIdFromLocationPath,
    getChannelIdFromLocationPath,
    isVideoPage,
    getLocationKey,
    getSettingsScopeKey,
    updateResolvedChannelIdFromPayload,
    handleLocationChange,
    getChannelDisplayNameFromDom,
    resolveChannelDisplayName,
  };
})();
