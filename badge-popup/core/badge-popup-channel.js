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
      const candidates = document.querySelectorAll(selector);
      for (const anchor of candidates) {
        if (!(anchor instanceof HTMLAnchorElement)) continue;
        // 팔로우/추천 사이드바(nav) 링크는 현재 스트리머가 아니므로 제외.
        if (anchor.closest("nav")) continue;
        const fromHref = extractChannelIdFromUrl(anchor.href);
        if (isStableChannelId(fromHref)) {
          return fromHref;
        }
      }
    }

    // 새 구조 폴백: 썸네일+이름이 쌍을 이루는 스트리머 프로필 앵커에서 id 추출.
    // (사이드바의 단일 /live/{id} 링크를 잘못 잡지 않도록 한다.)
    const profile = findStreamerProfileNameAnchor();
    if (profile && isStableChannelId(profile.channelId)) {
      return profile.channelId;
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
    state.settings.excludedCollectScopedNicknames = new Set();
    state.settings.excludedCollectNicknames = new Set([
      ...(state.settings.excludedCollectGlobalNicknames || []),
    ]);
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
      state.settings.excludedCollectScopedNicknames = new Set();
      state.settings.excludedCollectNicknames = new Set([
        ...(state.settings.excludedCollectGlobalNicknames || []),
      ]);
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
    if (state.originalChatSnapshots instanceof Map) {
      state.originalChatSnapshots.clear();
    }
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

  function getChannelDisplayNameFromDom(preferredChannelId = "") {
    // 구버전 폴백: 클래스명 기반 탐색
    const legacySelectors = [
      "a.video_information_link__2OrbG .name_text__yQG50",
      "a[class*='video_information_link'] [class*='name_text']",
      "section[class*='video_information'] a[href^='/'] [class*='name_text']",
      "[class*='video_information'] [class*='name_text']",
      "h2[class*='channel_profile_name'] [class*='name_text']",
      "[class*='channel_profile_information'] [class*='name_text']",
      "[class*='live_information_player_channel'] [class*='name_text']",
      "[class*='live_information_player'] [class*='name_text']",
    ];

    for (const selector of legacySelectors) {
      const node = document.querySelector(selector);
      const text = String(node && node.textContent ? node.textContent : "").trim();
      if (text) return text;
    }

    // 새 구조: 치지직 클래스명이 빌드마다 바뀌므로 채널 id(32 hex)를 가리키는
    // 앵커의 텍스트로 스트리머명을 추출한다.
    const fromChannelAnchor =
      getChannelDisplayNameFromChannelAnchor(preferredChannelId);
    if (fromChannelAnchor) return fromChannelAnchor;

    return "";
  }

  // 앵커 텍스트에는 배지/인증마크(.blind, <i>, <svg>)가 섞여 들어오므로
  // 이를 제외하고 순수 닉네임 텍스트만 추출한다. 닉네임만 담은 안쪽
  // 텍스트 노드(아이콘 자식이 없는 span 등)를 우선한다.
  function extractCleanNameFromAnchor(anchor) {
    if (!(anchor instanceof Element)) return "";

    const isIconLike = (el) => {
      if (!(el instanceof Element)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "i" || tag === "svg" || tag === "img") return true;
      if (el.classList.contains("blind")) return true;
      return false;
    };

    // 아이콘/blind 자식이 없는, 텍스트만 가진 가장 안쪽 span을 찾는다.
    const spans = anchor.querySelectorAll("span");
    for (const span of spans) {
      if (isIconLike(span)) continue;
      if (span.querySelector("i, svg, img, .blind")) continue;
      const text = String(span.textContent || "").replace(/\s+/g, " ").trim();
      if (text) return text;
    }

    // 폴백: 아이콘/blind 노드를 제외한 직접 텍스트만 모은다.
    let collected = "";
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          collected += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE && !isIconLike(child)) {
          walk(child);
        }
      }
    };
    walk(anchor);
    return collected.replace(/\s+/g, " ").trim();
  }

  // 팔로우/추천 사이드바(nav) 안의 링크는 현재 스트리머가 아니므로 제외한다.
  function isInsideRecommendationNav(anchor) {
    return !!(anchor instanceof Element && anchor.closest("nav"));
  }

  // 스트리머 프로필 블록은 같은 채널 id를 가리키는 "썸네일 앵커(img 포함)"와
  // "이름 앵커(텍스트 포함)"가 한 컨테이너 안에 쌍을 이룬다. 사이드바의
  // 단일 링크("내 채널", 팔로우 목록 등)는 이 패턴을 만족하지 않는다.
  function hasPairedThumbnailAnchor(anchor, channelId) {
    let scope = anchor.parentElement;
    for (let depth = 0; depth < 4 && scope instanceof Element; depth += 1) {
      const siblingAnchors = scope.querySelectorAll("a[href]");
      for (const sibling of siblingAnchors) {
        if (sibling === anchor) continue;
        if (!(sibling instanceof HTMLAnchorElement)) continue;
        if (!sibling.querySelector("img")) continue;
        if (extractChannelIdFromUrl(sibling.getAttribute("href")) === channelId) {
          return true;
        }
      }
      scope = scope.parentElement;
    }
    return false;
  }

  // 현재 스트리머의 프로필 "이름 앵커"를 찾는다(채널 id + 닉네임을 모두 보장).
  // 이름 앵커는 img를 직접 포함하지 않고, 정제된 텍스트(닉네임)를 가지며,
  // 같은 id의 썸네일 앵커와 쌍을 이루고, 추천 nav 밖에 있어야 한다.
  function findStreamerProfileNameAnchor(targetChannelId = "") {
    const target = normalizeChannelId(targetChannelId);
    const anchors = document.querySelectorAll("a[href]");
    for (const anchor of anchors) {
      if (!(anchor instanceof HTMLAnchorElement)) continue;
      if (isInsideRecommendationNav(anchor)) continue;
      if (anchor.querySelector("img")) continue;
      const channelId = extractChannelIdFromUrl(anchor.getAttribute("href"));
      if (!isStableChannelId(channelId)) continue;
      if (isStableChannelId(target) && channelId !== target) continue;
      if (!hasPairedThumbnailAnchor(anchor, channelId)) continue;
      const text = extractCleanNameFromAnchor(anchor);
      if (!text) continue;
      return { anchor, channelId, name: text };
    }
    return null;
  }

  // 채널 홈(프로필) 페이지의 새 구조: 썸네일 앵커(/live/<id>)와 형제로
  // h2._name_ > ... > _text_ 안에 닉네임이 있다(이름이 <a>가 아님). 썸네일
  // 앵커를 기준으로 같은 컨테이너 안의 이름 텍스트를 찾는다.
  function getChannelDisplayNameFromProfileThumbnail(targetChannelId = "") {
    const target = normalizeChannelId(targetChannelId);
    const anchors = document.querySelectorAll("a[href]");
    for (const anchor of anchors) {
      if (!(anchor instanceof HTMLAnchorElement)) continue;
      if (isInsideRecommendationNav(anchor)) continue;
      if (!anchor.querySelector("img")) continue; // 썸네일 앵커
      const channelId = extractChannelIdFromUrl(anchor.getAttribute("href"));
      if (!isStableChannelId(channelId)) continue;
      if (isStableChannelId(target) && channelId !== target) continue;

      // 썸네일 앵커에서 위로 올라가며 같은 컨테이너 안의 이름 노드를 찾는다.
      let scope = anchor.parentElement;
      for (let depth = 0; depth < 4 && scope instanceof Element; depth += 1) {
        const nameNode =
          scope.querySelector("h2[class*='_name_'] [class*='_text_']") ||
          scope.querySelector("[class*='_name_'] [class*='_text_']") ||
          scope.querySelector("h2[class*='_name_']");
        if (nameNode instanceof Element) {
          const text = extractCleanNameFromAnchor(nameNode);
          if (text) return text;
        }
        scope = scope.parentElement;
      }
    }
    return "";
  }

  function getChannelDisplayNameFromChannelAnchor(preferredChannelId = "") {
    const preferred = normalizeChannelId(preferredChannelId);
    // 신뢰 가능한 현재 채널 id가 없으면 URL에서 유추한다.
    const targetChannelId = isStableChannelId(preferred)
      ? preferred
      : getRawChannelIdFromLocationPath();

    const profile = findStreamerProfileNameAnchor(targetChannelId);
    if (profile && profile.name) return profile.name;

    // 채널 홈 프로필(이름이 <a>가 아니라 <h2>에 있는 구조) 폴백.
    return getChannelDisplayNameFromProfileThumbnail(targetChannelId);
  }

  // 채널명을 표시할 수 있는 URL 형태인지 판정한다.
  // 허용: /<32hex>, /live/<32hex>, /video/*  (그 외는 채널명 대신 '-')
  function isChannelScopedUrl() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return false;
    if (parts[0] === "video") {
      return !!String(parts[1] || "").trim();
    }
    if (parts[0] === "live") {
      return isStableChannelId(parts[1] || "");
    }
    return isStableChannelId(parts[0] || "");
  }

  function resolveChannelDisplayName(state, deps = {}) {
    // 허용된 채널/라이브/다시보기 URL이 아니면 채널명 대신 '-' 표시.
    if (!isChannelScopedUrl()) {
      return "-";
    }

    const channelId = normalizeChannelId(state.resolvedChannelId || "");
    const fromDom = getChannelDisplayNameFromDom(channelId);
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
    isChannelScopedUrl,
  };
})();
