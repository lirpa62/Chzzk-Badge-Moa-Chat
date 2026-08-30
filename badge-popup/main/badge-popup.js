(() => {
  const ns = window.__chzzkBadgeMoa;
  if (!ns || typeof ns !== "object") {
    console.error("[badge-moa] namespace not initialized");
    return;
  }
  if (!ns.bootstrapApi || typeof ns.bootstrapApi !== "object") {
    console.error("[badge-moa] bootstrap module not loaded");
    return;
  }
  const bootstrapApi = ns.bootstrapApi;
  if (!bootstrapApi.begin()) return;
  bootstrapApi.cleanupStaleRoots();

  if (
    !ns.constants ||
    !ns.state ||
    typeof ns.createDefaultSettingsState !== "function" ||
    !ns.storage ||
    !ns.channel ||
    !ns.cache ||
    !ns.settingsApi ||
    !ns.filterApi ||
    !ns.pillApi ||
    !ns.confirmApi ||
    !ns.trackedApi ||
    !ns.observerApi ||
    !ns.entryApi ||
    !ns.uiCoreApi ||
    !ns.captureApi ||
    !ns.renderApi ||
    !ns.feedApi ||
    !ns.lifecycleApi ||
    !ns.popupApi
  ) {
    console.error("[badge-moa] required modules not loaded");
    return;
  }

  const {
    MESSAGE_MARK,
    INJECT_TRACKED_SYNC_TYPE,
    INJECT_CHAT_FEATURES_REQUEST_TYPE,
    STORAGE_HEIGHT_KEY,
    STORAGE_HEIGHT_KEY_LIVE,
    STORAGE_HEIGHT_KEY_LIVE_WIDE,
    STORAGE_HEIGHT_KEY_VOD,
    STORAGE_HEIGHT_KEY_VOD_WIDE,
    STORAGE_HEIGHT_KEY_CHAT_POPUP,
    STORAGE_DISPLAY_STYLE_KEY,
    STORAGE_SETTINGS_KEY,
    STORAGE_CHANNEL_CACHE_PREFIX,
    STORAGE_SESSION_FALLBACK_PREFIX,
    OFFICIAL_MARK_URL,
    MANAGER_BADGE_FALLBACK_URL,
    CHANNEL_OWNER_BADGE_FALLBACK_URL,
    OWNER_BADGE_FALLBACK_URL,
    ACHIEVEMENT_BADGE_URL_MAP,
    DEFAULT_POPUP_HEIGHT,
    MIN_POPUP_HEIGHT,
    MAX_KEEP_ENTRIES,
    MAX_TRACKED_NICKNAMES_PER_SCOPE,
    MAX_TRACKED_GLOBAL_NICKNAMES,
    OPEN_ANIMATION_MS,
    CLOSE_ANIMATION_MS,
    PILL_CYCLE_INTERVAL_MS,
    PILL_ATTENTION_DURATION_MS,
    PILL_ROLE_CLASS_PREFIX,
    PILL_ROLE_CLASSES,
    SETTINGS_ROLE_BADGE_TYPES,
    DEFAULT_POPUP_FONT_SCALE,
    MIN_POPUP_FONT_SCALE,
    MAX_POPUP_FONT_SCALE,
    DEFAULT_CHAT_FONT_SCALE,
    MIN_CHAT_FONT_SCALE,
    MAX_CHAT_FONT_SCALE,
    MIN_CHAT_WIDTH,
    LIVE_CHAT_LIST_CONTAINER_SELECTORS,
    VOD_CHAT_LIST_CONTAINER_SELECTORS,
    LIVE_CHAT_ITEM_SELECTOR,
    VOD_CHAT_ITEM_SELECTOR,
    CHAT_ITEM_SELECTOR,
  } = ns.constants;
  const storageApi = ns.storage;
  const {
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
  } = storageApi;
  const channelApi = ns.channel;
  const cacheApi = ns.cache;
  const settingsApi = ns.settingsApi;
  const filterApi = ns.filterApi;
  const pillApi = ns.pillApi;
  const confirmApi = ns.confirmApi;
  const trackedApi = ns.trackedApi;
  const observerApi = ns.observerApi;
  const entryApi = ns.entryApi;
  const uiCoreApi = ns.uiCoreApi;
  const captureApi = ns.captureApi;
  const renderApi = ns.renderApi;
  const feedApi = ns.feedApi;
  const lifecycleApi = ns.lifecycleApi;
  const popupApi = ns.popupApi;
  const state = ns.state;
  const createDefaultSettingsStateFromNs = ns.createDefaultSettingsState;
  const POPUP_FONT_SCALE_STEPS = [0.8, 0.9, 1, 1.1, 1.2];

  const observerRefs = {
    observer: null,
    chatHighlightObserver: null,
    ensureQueued: false,
    chatScanQueued: false,
  };

  bootstrapApi.ensurePingListener({
    chromeObj: typeof chrome !== "undefined" ? chrome : null,
    getSettingsContext: buildSettingsContextResponse,
    applySettingsPayload: applySettingsFromPopupPayload,
    clearCurrentChannelEntries,
    hasCurrentChannelData,
  });

  init();
  registerSyncHandlers();

  function registerSyncHandlers() {
    const syncApi = ns.sync;
    if (!syncApi || typeof syncApi.setReadHandler !== "function") return;
    syncApi.setReadHandler(({ channelId }) => {
      const currentId = normalizeChannelId(state.resolvedChannelId || "");
      const incomingId = normalizeChannelId(channelId || "");
      if (!currentId || !incomingId || currentId !== incomingId) return;
      if (state.unseenCount <= 0 && state.unseenActors.size === 0) return;
      state.unseenCount = 0;
      state.unseenActors.clear();
      resetPillCycle(true);
      renderPill();
      renderList();
      schedulePersistChannelCache();
    });
  }

  async function init() {
    // 모아보기 전용 창(분리 버튼으로 연 창)이면 표식을 세운다. CSS 로 치지직 채팅을
    // 숨기고 모아보기 팝업만 창을 채우게 하며, render 에서 항상 펼침으로 동작시킨다.
    state.isMoaWindow = isMoaWindowContext();
    if (state.isMoaWindow && document.documentElement) {
      document.documentElement.classList.add("chzzk-badge-moa-window-mode");
    }
    await lifecycleApi.init(state, {
      loadPopupHeight,
      loadPopupDisplayStyle,
      loadRuntimeTabId,
      normalizeChannelId,
      getChannelIdFromLocationPath,
      getLocationKey,
      getSettingsScopeKey,
      loadSettings,
      applyNicknameFilterStateFromSettings,
      syncTrackedTargetsToInject,
      isSessionCacheEnabled,
      restoreChannelCache,
      clearSessionCachesForCurrentTab,
      bindEvents,
      ensureUi,
      startObserver,
      refreshChatHighlightObserver,
      scheduleChatHighlightScan,
    });
    // 설정 로드 후 inject에 블라인드 캡처 on/off 동기화
    syncBlindCaptureToInject();
    syncChatTimestampToInject();
    syncOriginalChatCaptureToInject();

    if (state.isMoaWindow) {
      startMoaWindowHeartbeat();
    } else {
      registerMoaWindowPresenceHandler();
    }
  }

  // 전용 창(자식): 살아있는 동안 alive 신호를 방송하고, 닫힐 때 closed 를 방송해
  // 원래 탭이 인라인 UI 를 감추거나 복원하도록 한다.
  let _moaHeartbeatTimer = null;
  function startMoaWindowHeartbeat() {
    const syncApi = ns.sync;
    if (!syncApi || typeof syncApi.broadcastMoaWindow !== "function") return;
    const channelId = normalizeChannelId(
      state.resolvedChannelId || getChannelIdFromLocationPath() || "",
    );
    if (!channelId) return;
    const beat = () => syncApi.broadcastMoaWindow(channelId, true);
    beat();
    _moaHeartbeatTimer = setInterval(beat, 2000);
    const announceClosed = () => {
      if (_moaHeartbeatTimer) {
        clearInterval(_moaHeartbeatTimer);
        _moaHeartbeatTimer = null;
      }
      syncApi.broadcastMoaWindow(channelId, false);
    };
    window.addEventListener("pagehide", announceClosed);
    window.addEventListener("beforeunload", announceClosed);
  }

  // 원래 탭: 전용 창 생존 신호를 받아 인라인 UI 를 감추거나 복원한다. alive 는
  // 하트비트라 일정 시간 신호가 끊기면(창이 강제 종료 등) 자동 복원한다.
  let _detachedPresenceTimer = null;
  // 하트비트(2s)의 3배 동안 신호가 없으면 창이 사라진 것으로 보고 복원한다.
  // 창을 막 열어 아직 하트비트가 오기 전에도, 로드 실패 시 원복되도록 무장해 둔다.
  function armDetachedPresenceTimeout() {
    if (_detachedPresenceTimer) clearTimeout(_detachedPresenceTimer);
    _detachedPresenceTimer = setTimeout(() => {
      _detachedPresenceTimer = null;
      setDetachedMoaWindowActive(false);
    }, 6000);
  }

  function registerMoaWindowPresenceHandler() {
    const syncApi = ns.sync;
    if (!syncApi || typeof syncApi.setMoaWindowHandler !== "function") return;
    syncApi.setMoaWindowHandler(({ channelId, alive }) => {
      const myChannel = normalizeChannelId(state.resolvedChannelId || "");
      const msgChannel = normalizeChannelId(channelId || "");
      if (!myChannel || myChannel !== msgChannel) return;
      if (alive) {
        setDetachedMoaWindowActive(true);
        armDetachedPresenceTimeout();
      } else {
        if (_detachedPresenceTimer) {
          clearTimeout(_detachedPresenceTimer);
          _detachedPresenceTimer = null;
        }
        setDetachedMoaWindowActive(false);
      }
    });
  }

  let _lastHeightKey = "";
  let _heightSwitchInFlight = false;

  function bindEvents() {
    _lastHeightKey = getActiveStorageHeightKey();
    lifecycleApi.bindEvents(state, {
      windowObj: window,
      documentObj: document,
      chromeObj: typeof chrome !== "undefined" ? chrome : null,
      onWindowMessage,
      onWindowResize,
      onPageHide,
      onDocumentMouseDown,
      onStorageChanged,
      onAsideResize,
    });
  }

  function onAsideResize() {
    if (_heightSwitchInFlight) return;
    // 사용자가 리사이저를 드래그하는 중에는 모드 전환 감지를 건너뛴다.
    // (드래그로 인한 aside 크기 변화가 ResizeObserver를 발화시켜 높이가
    // 기본값으로 리셋되는 문제 방지)
    if (state.resize && state.resize.active) return;
    const currentKey = getActiveStorageHeightKey();
    if (currentKey !== _lastHeightKey) {
      _heightSwitchInFlight = true;
      if (state._resizeReclampTimer) {
        clearTimeout(state._resizeReclampTimer);
        state._resizeReclampTimer = null;
      }
      _lastHeightKey = currentKey;
      loadPopupHeight().then((height) => {
        // 모드 전환으로 새로 불러온 높이는 그 모드의 새 의도 높이다.
        state.popupHeightIntent = height;
        state.popupHeight = height;
        applyPopupHeight();
        _heightSwitchInFlight = false;
      }, () => {
        _heightSwitchInFlight = false;
      });
      return;
    }
    onWindowResize();
  }

  function onPageHide() {
    lifecycleApi.onPageHide(state, {
      clearPersistChannelCacheTimer,
      isSessionCacheEnabled,
      persistChannelCacheNow,
      unbindEvents,
    });
  }

  function onWindowResize() {
    lifecycleApi.onWindowResize(state, {
      applyPopupHeight,
    });
  }

  function unbindEvents() {
    lifecycleApi.unbindEvents(state, {
      windowObj: window,
      documentObj: document,
      chromeObj: typeof chrome !== "undefined" ? chrome : null,
      onWindowMessage,
      onWindowResize,
      onPageHide,
      onDocumentMouseDown,
      onStorageChanged,
    });
  }

  function onStorageChanged(changes, areaName) {
    lifecycleApi.onStorageChanged(state, changes, areaName, {
      STORAGE_DISPLAY_STYLE_KEY,
      STORAGE_SETTINGS_KEY,
      STORAGE_HEIGHT_KEY,
      getActiveStorageHeightKey,
      normalizeDisplayStyle,
      normalizeSettings,
      applyNicknameFilterStateFromSettings,
      syncTrackedTargetsToInject,
      syncBlindCaptureToInject,
      syncChatTimestampToInject,
      syncOriginalChatCaptureToInject,
      isSessionCacheEnabled,
      clearPersistChannelCacheTimer,
      clearSessionCachesForCurrentTab,
      persistChannelCacheNow,
      restoreChannelCache,
      clampPopupHeight,
      applyPopupHeight,
      render,
    });
  }

  function onDocumentMouseDown(event) {
    lifecycleApi.onDocumentMouseDown(state, event, {
      closePopup,
    });
  }

  function startObserver() {
    observerApi.startObserver(state, observerRefs, {
      ensureUi,
      refreshChatHighlightObserver,
      scheduleHiddenChatElementSync,
    });
  }

  function onWindowMessage(event) {
    observerApi.onWindowMessage(state, observerRefs, event, {
      MESSAGE_MARK,
      INJECT_CHAT_FEATURES_REQUEST_TYPE,
      handleLocationChange,
      enqueueIncomingPayload,
      scheduleChatHighlightScan,
      syncBlindCaptureToInject,
      syncChatTimestampToInject,
      syncOriginalChatCaptureToInject,
      applyOriginalChatSnapshot,
    });
  }

  function enqueueIncomingPayload(payload) {
    observerApi.enqueueIncomingPayload(state, payload, {
      scheduleIncomingPayloadFlush,
    });
  }

  function scheduleIncomingPayloadFlush() {
    observerApi.scheduleIncomingPayloadFlush(state, {
      flushIncomingPayloads,
    });
  }

  function flushIncomingPayloads() {
    observerApi.flushIncomingPayloads(state, {
      updateResolvedChannelIdFromPayload,
      appendBadgeChat,
      render,
      normalizeChannelId,
      isStableChannelId,
      getLocationKey,
      getRawChannelIdFromLocationPath,
      MAX_KEEP_ENTRIES,
    });
  }

  function handleLocationChange(forceReset) {
    channelApi.handleLocationChange(state, forceReset, {
      clearPersistChannelCacheTimer,
      isSessionCacheEnabled,
      persistChannelCacheNow,
      rebuildEffectiveTrackedNicknames,
      syncTrackedTargetsToInject,
      reloadSettingsForScope,
      resetPillCycle,
      closePopup,
      render,
      restoreChannelCache,
      refreshChatHighlightObserver,
      scheduleChatHighlightScan,
    });
  }

  async function reloadSettingsForScope(scopeKey) {
    await lifecycleApi.reloadSettingsForScope(state, scopeKey, {
      loadSettings,
      applyNicknameFilterStateFromSettings,
      syncTrackedTargetsToInject,
      applySettingsClasses,
      render,
    });
    syncBlindCaptureToInject();
    syncChatTimestampToInject();
    syncOriginalChatCaptureToInject();
  }

  function getLocationKey() {
    return channelApi.getLocationKey();
  }

  function getSettingsScopeKey(resolvedChannelIdCandidate = "") {
    return channelApi.getSettingsScopeKey(resolvedChannelIdCandidate);
  }

  function getChannelIdFromLocationPath() {
    return channelApi.getChannelIdFromLocationPath();
  }

  function getRawChannelIdFromLocationPath() {
    return channelApi.getRawChannelIdFromLocationPath();
  }

  function normalizeChannelId(value) {
    return channelApi.normalizeChannelId(value);
  }

  function isStableChannelId(value) {
    return channelApi.isStableChannelId(value);
  }

  function isVideoPage() {
    return channelApi.isVideoPage();
  }

  function updateResolvedChannelIdFromPayload(payload) {
    const prevResolvedChannelId = normalizeChannelId(state.resolvedChannelId);
    channelApi.updateResolvedChannelIdFromPayload(state, payload, {
      rebuildEffectiveTrackedNicknames,
      syncTrackedTargetsToInject,
      reloadSettingsForScope,
    });
    const nextResolvedChannelId = normalizeChannelId(state.resolvedChannelId);
    if (
      nextResolvedChannelId &&
      nextResolvedChannelId !== prevResolvedChannelId
    ) {
      resetCollectedEntriesForChannelSwitch(prevResolvedChannelId);
      maybeRestoreResolvedChannelCache(nextResolvedChannelId);
    }
  }

  function resetCollectedEntriesForChannelSwitch(previousChannelId) {
    clearPersistChannelCacheTimer();
    if (
      isSessionCacheEnabled() &&
      isStableChannelId(previousChannelId) &&
      Array.isArray(state.entries) &&
      state.entries.length > 0
    ) {
      persistChannelCacheNow(previousChannelId);
    }

    state.entries = [];
    state.dedupeKeys.clear();
    state.unseenCount = 0;
    state.unseenActors.clear();
    if (state.nicknameRoleBadgesByNickname instanceof Map) {
      state.nicknameRoleBadgesByNickname.clear();
    }
    state.sequence = 0;
    if (state.originalChatSnapshots instanceof Map) {
      state.originalChatSnapshots.clear();
    }
    if (state.cache && typeof state.cache === "object") {
      state.cache.restoreToken = Number(state.cache.restoreToken || 0) + 1;
      state.cache.resolvedRestoreChannelId = "";
      state.cache.resolvedRestoreInFlight = "";
    }
    resetPillCycle(true);
    render();
  }

  function maybeRestoreResolvedChannelCache(resolvedChannelId) {
    if (!isSessionCacheEnabled()) return;
    if (!isVideoPage()) return;

    const nextChannelId = normalizeChannelId(resolvedChannelId);
    if (!nextChannelId) return;

    const cacheState =
      state.cache && typeof state.cache === "object" ? state.cache : null;
    if (!cacheState) return;

    const restoredChannelId = normalizeChannelId(
      cacheState.resolvedRestoreChannelId,
    );
    if (restoredChannelId === nextChannelId) return;

    const restoringChannelId = normalizeChannelId(
      cacheState.resolvedRestoreInFlight,
    );
    if (restoringChannelId === nextChannelId) return;

    cacheState.resolvedRestoreInFlight = nextChannelId;
    state.incoming.pauseProcessing = true;

    Promise.resolve()
      .then(() => restoreChannelCache(nextChannelId))
      .catch(() => {})
      .finally(() => {
        const currentRestoringChannelId = normalizeChannelId(
          cacheState.resolvedRestoreInFlight,
        );
        const currentResolvedChannelId = normalizeChannelId(
          state.resolvedChannelId,
        );
        if (
          currentRestoringChannelId !== nextChannelId ||
          currentResolvedChannelId !== nextChannelId
        ) {
          return;
        }
        cacheState.resolvedRestoreInFlight = "";
        cacheState.resolvedRestoreChannelId = nextChannelId;
        state.incoming.pauseProcessing = false;
        scheduleIncomingPayloadFlush();
      });
  }

  function ensureUi() {
    uiCoreApi.ensureUi(state, {
      findLiveChatHeader,
      cleanupDetachedUi,
      refreshChatHighlightObserver,
      isVodChatHeader,
      applyPopupHeight,
      syncPillPositionForHeader,
      teardownUi,
      setViewModeButtonContent,
      setPopupActionButtonContent,
      onPillClick,
      openMoaWindow,
      isMoaWindowContext,
      closePopup,
      setDisplayStyle,
      renderList,
      updatePopupPinStateUi,
      onResizeStart,
      resolveConfirmDialog,
      updateViewModeButtons,
      applySettingsClasses,
      render,
      scheduleChatHighlightScan,
      adjustPopupFontScale,
      syncPopupFontScaleControl,
      toggleCaptureSelectionMode,
      toggleAllCaptureItems,
      captureSelectedChats,
      handleCapturePointerDown,
      handleCapturePointerMove,
      handleCapturePointerEnd,
      handleCaptureListClick,
      handleCaptureListKeydown,
      syncCaptureUi,
    });
  }

  function findLiveChatHeader() {
    return uiCoreApi.findLiveChatHeader();
  }

  function isVodChatHeader(header) {
    return uiCoreApi.isVodChatHeader(header);
  }

  function syncPillPositionForHeader() {
    uiCoreApi.syncPillPositionForHeader(state, {
      isVodChatHeader,
      MIN_CHAT_WIDTH,
    });
  }

  function cleanupDetachedUi() {
    uiCoreApi.cleanupDetachedUi(state, { teardownUi });
  }

  function teardownUi() {
    captureApi.resetCaptureSelection(state);
    uiCoreApi.teardownUi(state, {
      resolveConfirmDialog,
      resetPillCycle,
    });
  }

  function onPillClick(event) {
    popupApi.onPillClick(state, event, {
      closePopup,
      openPopup,
    });
  }

  function openPopup() {
    popupApi.openPopup(state, {
      resetPillCycle,
      schedulePersistChannelCache,
      updatePopupPinStateUi,
      applyPopupHeight,
      flushIncomingPayloads,
      renderList,
      renderPill,
      isVideoPage,
      OPEN_ANIMATION_MS,
    });
  }

  function closePopup(immediate = false) {
    const wasOpen = state.isOpen === true;
    popupApi.closePopup(state, immediate, {
      resolveConfirmDialog,
      updateFilterToggleButton,
      getNicknameStats,
      releasePopupFocus,
      updatePopupPinStateUi,
      renderPill,
      CLOSE_ANIMATION_MS,
    });
    if (wasOpen && state.isOpen !== true) {
      captureApi.resetCaptureSelection(state);
    }
  }

  function updatePopupPinStateUi() {
    popupApi.updatePopupPinStateUi(state);
  }

  function releasePopupFocus() {
    popupApi.releasePopupFocus(state, { document });
  }

  async function requestDeleteConfirm(message, options = {}) {
    return confirmApi.requestDeleteConfirm(state, message, options, {
      window,
      document,
      showConfirmDialog,
    });
  }

  function showConfirmDialog({
    title = "삭제 확인",
    message = "",
    confirmText = "삭제",
    secondaryText = "",
    cancelText = "취소",
  } = {}) {
    return confirmApi.showConfirmDialog(
      state,
      { title, message, confirmText, secondaryText, cancelText },
      {
        window,
        document,
        resolveConfirmDialog,
        trapFocusInConfirmDialog,
      },
    );
  }

  function resolveConfirmDialog(confirmed, options = { restoreFocus: true }) {
    confirmApi.resolveConfirmDialog(state, confirmed, options, {
      document,
    });
  }

  function trapFocusInConfirmDialog(event) {
    confirmApi.trapFocusInConfirmDialog(state, event, {
      document,
      getFocusableElements,
    });
  }

  function getFocusableElements(container) {
    return confirmApi.getFocusableElements(container);
  }

  function appendBadgeChat(payload, options = {}) {
    return entryApi.appendBadgeChat(state, payload, options, {
      normalizeNickname,
      isExcludedCollectNickname,
      isBadgeTargetProfile,
      normalizeEntry,
      insertEntrySorted,
      rememberNicknameRoleBadgesFromEntry,
      MAX_KEEP_ENTRIES,
      updateUnseenActor,
      triggerAttention,
      schedulePersistChannelCache,
      render,
    });
  }

  function insertEntrySorted(entry) {
    entryApi.insertEntrySorted(state, entry);
  }

  function normalizeHiddenByScope(rawMap) {
    return settingsApi.normalizeHiddenByScope(rawMap, { normalizeNickname });
  }

  function normalizeExcludedCollectByScope(rawMap) {
    return settingsApi.normalizeExcludedCollectByScope(rawMap, {
      normalizeNickname,
    });
  }

  function normalizeTrackedTargetsByScope(rawMap) {
    return settingsApi.normalizeTrackedTargetsByScope(rawMap, {
      normalizeTrackedNickname,
    });
  }

  function normalizeNicknameFiltersByScope(rawMap) {
    return settingsApi.normalizeNicknameFiltersByScope(rawMap, {
      normalizeNickname,
    });
  }

  function normalizeSettings(raw, scopeKey) {
    return settingsApi.normalizeSettings(raw, scopeKey, {
      createDefaultSettingsState: createDefaultSettingsStateFromNs,
      getSettingsScopeKey,
      normalizeNickname,
      normalizeTrackedNickname,
      normalizePopupFontScale,
      normalizeChatFontScale,
      normalizeChatWidth,
    });
  }

  async function loadSettings(scopeKey) {
    return settingsApi.loadSettings(scopeKey, {
      getStorageValue,
      createDefaultSettingsState: createDefaultSettingsStateFromNs,
      getSettingsScopeKey,
      normalizeNickname,
      normalizeTrackedNickname,
      normalizePopupFontScale,
      normalizeChatFontScale,
      normalizeChatWidth,
    });
  }

  function saveSettings() {
    settingsApi.saveSettings(state, {
      getSettingsScopeKey,
      normalizePopupFontScale,
      normalizeChatFontScale,
      normalizeChatWidth,
      setStorageValue,
      getStorageValue,
      syncTrackedTargetsToInject,
    });
  }

  function syncTrackedTargetsToInject() {
    settingsApi.syncTrackedTargetsToInject(state, {
      normalizeTrackedNickname,
    });
  }

  function rebuildEffectiveTrackedNicknames() {
    state.settings.trackedNicknames = new Set([
      ...(state.settings.trackedScopedNicknames || []),
      ...(state.settings.trackedGlobalNicknames || []),
    ]);
  }

  function buildSettingsContextResponse() {
    return settingsApi.buildSettingsContextResponse(state, {
      getSettingsScopeKey,
      resolveChannelDisplayName,
      getPillNicknameSettingItems,
      normalizePopupFontScale,
      normalizeChatFontScale,
      normalizeChatWidth,
    });
  }

  function resolveChannelDisplayName() {
    return channelApi.resolveChannelDisplayName(state, { normalizeNickname });
  }

  function getChannelDisplayNameFromDom() {
    return channelApi.getChannelDisplayNameFromDom();
  }

  function applySettingsFromPopupPayload(payload) {
    settingsApi.applySettingsFromPopupPayload(state, payload, {
      normalizeTrackedNickname,
      normalizeNickname,
      normalizePopupFontScale,
      normalizeChatFontScale,
      normalizeChatWidth,
      isSessionCacheEnabled,
      clearPersistChannelCacheTimer,
      clearSessionCachesForCurrentTab,
      persistChannelCacheNow,
      restoreChannelCache,
      rebuildEffectiveTrackedNicknames,
      pruneExcludedEntriesFromState,
      schedulePersistChannelCache,
      saveSettings,
      render,
      syncBlindCaptureToInject,
      syncChatTimestampToInject,
      syncOriginalChatCaptureToInject,
    });
  }

  function refreshChatHighlightObserver() {
    observerApi.refreshChatHighlightObserver(state, observerRefs, {
      findChatListContainer,
      processHighlightNode,
      applyHighlightToItem,
      applyHiddenChatElementsToNode,
      CHAT_ITEM_SELECTOR,
    });
  }

  function syncBlindCaptureToInject() {
    settingsApi.syncBlindCaptureToInject(state);
  }

  function syncChatTimestampToInject() {
    settingsApi.syncChatTimestampToInject(state);
  }

  function syncOriginalChatCaptureToInject() {
    settingsApi.syncOriginalChatCaptureToInject(state);
  }

  function applyOriginalChatSnapshot(payload) {
    return entryApi.applyOriginalChatSnapshot(state, payload, {
      renderList,
      schedulePersistChannelCache,
    });
  }

  function findChatListContainer() {
    return observerApi.findChatListContainer(state, {
      isVideoPage,
      isLikelyVisibleElement,
      VOD_CHAT_LIST_CONTAINER_SELECTORS,
      LIVE_CHAT_LIST_CONTAINER_SELECTORS,
      CHAT_ITEM_SELECTOR,
      VOD_CHAT_ITEM_SELECTOR,
      LIVE_CHAT_ITEM_SELECTOR,
    });
  }

  function isLikelyVisibleElement(element) {
    return observerApi.isLikelyVisibleElement(element);
  }

  function processHighlightNode(node) {
    observerApi.processHighlightNode(node, {
      matchesChatItem,
      applyHighlightToItem,
      CHAT_ITEM_SELECTOR,
    });
  }

  function scheduleChatHighlightScan() {
    observerApi.scheduleChatHighlightScan(observerRefs, {
      applyHighlightToAll,
    });
  }

  function scheduleHiddenChatElementSync() {
    observerApi.scheduleHiddenChatElementSync(state, observerRefs, {
      applyHiddenChatElements,
    });
  }

  function applyHiddenChatElements() {
    observerApi.applyHiddenChatElements(state);
  }

  function applyHiddenChatElementsToNode(node) {
    observerApi.applyHiddenChatElementsToNode(state, node);
  }

  function applyHighlightToAll() {
    observerApi.applyHighlightToAll(state, {
      findChatListContainer,
      applyHighlightToItem,
      CHAT_ITEM_SELECTOR,
    });
  }

  function applyHighlightToItem(item) {
    observerApi.applyHighlightToItem(item, {
      matchesChatItem,
      detectBadgeTypeFromItem,
    });
  }

  function detectBadgeTypeFromItem(item) {
    return observerApi.detectBadgeTypeFromItem(item, {
      hasChannelOwnerBadge,
      hasManagerBadge,
      hasOperatorBadge,
      hasPartnerMark,
    });
  }

  function hasManagerBadge(item) {
    return observerApi.hasManagerBadge(item);
  }

  function hasOperatorBadge(item) {
    return observerApi.hasOperatorBadge(item);
  }

  function hasChannelOwnerBadge(item) {
    return observerApi.hasChannelOwnerBadge(item);
  }

  function hasPartnerMark(item) {
    return observerApi.hasPartnerMark(item);
  }

  function matchesChatItem(node) {
    return observerApi.matchesChatItem(node);
  }

  function isBadgeTargetProfile(profile, payload) {
    return entryApi.isBadgeTargetProfile(profile, payload, {
      extractRoleInfo,
      isTrackedTarget,
    });
  }

  function normalizeEntry(payload) {
    return entryApi.normalizeEntry(state, payload, {
      extractRoleInfo,
      isTrackedTarget,
      normalizeEmojiMap,
      extractTitleColor,
      buildEntryTypeMeta,
      buildPillBadges,
      buildPopupBadges,
      makeBadge,
      buildAchievementMark,
      OFFICIAL_MARK_URL,
    });
  }

  function buildEntryTypeMeta(source) {
    return entryApi.buildEntryTypeMeta(source, {
      getDonationTone,
      buildGiftMessage,
      getPillTypeLabel,
      getPillTypeTone,
    });
  }

  function getDonationTone(amount) {
    return entryApi.getDonationTone(amount);
  }

  function getPillTypeLabel(source) {
    return entryApi.getPillTypeLabel(source);
  }

  function getPillTypeTone(source, donationTone) {
    return entryApi.getPillTypeTone(source, donationTone);
  }

  function buildGiftMessage(gift, identity) {
    return entryApi.buildGiftMessage(gift, identity);
  }

  function extractTitleColor(profile) {
    return entryApi.extractTitleColor(profile);
  }

  function normalizeEmojiMap(emojis) {
    return entryApi.normalizeEmojiMap(emojis);
  }

  function extractRoleInfo(profile) {
    return entryApi.extractRoleInfo(profile);
  }

  function buildPillBadges(profile, roleInfo) {
    return entryApi.buildPillBadges(profile, roleInfo, {
      makeBadge,
      pushBadgeUnique,
      MANAGER_BADGE_FALLBACK_URL,
      CHANNEL_OWNER_BADGE_FALLBACK_URL,
      OWNER_BADGE_FALLBACK_URL,
      OFFICIAL_MARK_URL,
    });
  }

  function buildPopupBadges(profile, roleInfo) {
    return entryApi.buildPopupBadges(profile, roleInfo, {
      makeBadge,
      pushBadgeUnique,
      MANAGER_BADGE_FALLBACK_URL,
      CHANNEL_OWNER_BADGE_FALLBACK_URL,
      OWNER_BADGE_FALLBACK_URL,
    });
  }

  function getFirstActivatedAchievementBadgeId(profile) {
    return entryApi.getFirstActivatedAchievementBadgeId(profile);
  }

  function buildAchievementMark(profile) {
    return entryApi.buildAchievementMark(profile, {
      makeBadge,
      getFirstActivatedAchievementBadgeId,
      ACHIEVEMENT_BADGE_URL_MAP,
    });
  }

  function makeBadge(type, label, iconUrl) {
    return entryApi.makeBadge(type, label, iconUrl);
  }

  function pushBadgeUnique(list, seen, badge) {
    entryApi.pushBadgeUnique(list, seen, badge);
  }

  function render() {
    renderApi.render(state, {
      applySettingsClasses,
      updatePopupPinStateUi,
      syncPillPositionForHeader,
      renderPill,
      renderList,
      openPopup,
    });
  }

  function renderPill() {
    renderApi.renderPill(state, {
      clearAttentionIfNeeded,
      applyPillRoleClass,
      resetPillCycle,
      getUnseenActorsForPill,
      ensurePillCycleForActors,
      resolvePillRoleFromIdentity,
      renderPillIdentity,
    });
  }

  function renderList(scrollToBottom) {
    renderApi.renderList(state, scrollToBottom, {
      updateViewModeButtons,
      isNearBottom,
      renderNicknameFilters,
      getNicknameStats,
      syncNicknameFilterSelection,
      getVisibleEntriesByNickname,
      getDateKey,
      createDateDivider,
      getItemTypeToneClass,
      createBadgeList,
      createBadgeVisual,
      formatTime,
      createMessageTagRow,
      buildMessageContent,
      syncPopupContentHeight,
      isExcludedCollectInScope,
      setExcludedCollect,
    });
    captureApi.syncCaptureUi(state);
  }

  function toggleCaptureSelectionMode() {
    captureApi.toggleCaptureSelectionMode(state);
  }

  function toggleAllCaptureItems() {
    return captureApi.toggleAllCaptureItems(state);
  }

  function handleCaptureListClick(event) {
    return captureApi.handleCaptureListClick(state, event);
  }

  function handleCapturePointerDown(event) {
    return captureApi.handleCapturePointerDown(state, event);
  }

  function handleCapturePointerMove(event) {
    return captureApi.handleCapturePointerMove(state, event);
  }

  function handleCapturePointerEnd(event) {
    return captureApi.handleCapturePointerEnd(state, event);
  }

  function handleCaptureListKeydown(event) {
    return captureApi.handleCaptureListKeydown(state, event);
  }

  function syncCaptureUi() {
    captureApi.syncCaptureUi(state);
  }

  async function captureSelectedChats() {
    return captureApi.captureSelectedChats(state);
  }

  function syncPopupContentHeight() {
    popupApi.syncPopupContentHeight(state);
  }

  function getItemTypeToneClass(entry) {
    return renderApi.getItemTypeToneClass(entry);
  }

  async function deleteEntriesByNickname(nickname) {
    await filterApi.deleteEntriesByNickname(state, nickname, {
      normalizeNickname,
      requestDeleteConfirm,
      loadSettings,
      resetPillCycle,
      pruneHiddenNicknameIfOrphanedInPopup,
      saveSettings,
      schedulePersistChannelCache,
      render,
    });
  }

  // 확인 없이 특정 닉네임의 이미 모아둔 채팅을 즉시 제거(모아보기 제외 시 사용).
  function removeEntriesByNickname(nickname) {
    const target = normalizeNickname(nickname);
    if (!target || !Array.isArray(state.entries)) return;
    const kept = [];
    for (const entry of state.entries) {
      if (normalizeNickname(entry.nickname) === target) {
        if (state.dedupeKeys instanceof Set) {
          state.dedupeKeys.delete(entry.dedupeKey);
        }
      } else {
        kept.push(entry);
      }
    }
    state.entries = kept;
    schedulePersistChannelCache();
  }

  function selectAllNicknameFilters(stats) {
    filterApi.selectAllNicknameFilters(state, stats, {
      normalizeNickname,
      saveSettings,
      renderList,
    });
  }

  function clearAllNicknameFilters() {
    filterApi.clearAllNicknameFilters(state, {
      saveSettings,
      renderList,
    });
  }

  async function deleteAllEntriesFromFilters() {
    await filterApi.deleteAllEntriesFromFilters(state, {
      requestDeleteConfirm,
      resetPillCycle,
      saveSettings,
      schedulePersistChannelCache,
      render,
    });
  }

  function getNicknameStats(entries) {
    return filterApi.getNicknameStats(entries);
  }

  function syncNicknameFilterSelection(stats) {
    filterApi.syncNicknameFilterSelection(state, stats, {
      saveSettings,
      applyPendingTrackedFilterSelection,
    });
  }

  function applyPendingTrackedFilterSelection(available, selected) {
    return filterApi.applyPendingTrackedFilterSelection(
      state,
      available,
      selected,
      {
        normalizeNickname,
      },
    );
  }

  function getVisibleEntriesByNickname() {
    return filterApi.getVisibleEntriesByNickname(state);
  }

  function renderNicknameFilters(stats) {
    renderApi.renderNicknameFilters(state, stats, {
      updateFilterToggleButton,
      applyFilterBarMaxHeight,
      selectAllNicknameFilters,
      clearAllNicknameFilters,
      deleteAllEntriesFromFilters,
      saveSettings,
      renderList,
      deleteEntriesByNickname,
      syncPopupContentHeight,
    });
  }

  function applyFilterBarMaxHeight() {
    renderApi.applyFilterBarMaxHeight(state);
  }

  function updateFilterToggleButton(filterCount) {
    renderApi.updateFilterToggleButton(state, filterCount);
  }

  function renderSettingsPanel() {
    renderApi.renderSettingsPanel(state, {
      createSettingToggleRow,
      saveSettings,
      applySettingsClasses,
      renderList,
      getPillNicknameSettingItems,
      normalizeNickname,
      renderPill,
      openPopup,
      renderSettingsPanel,
      addTrackedTarget,
      getTrackedTargetSettingItems,
      createTrackedTargetChip,
      syncOriginalChatCaptureToInject,
    });
  }

  function getPillNicknameSettingItems() {
    return trackedApi.getPillNicknameSettingItems(state, {
      getNicknameStats,
      normalizeNickname,
      extractSettingsRoleBadges,
    });
  }

  function extractSettingsRoleBadges(entry) {
    return trackedApi.extractSettingsRoleBadges(entry, {
      SETTINGS_ROLE_BADGE_TYPES,
    });
  }

  function rememberNicknameRoleBadgesFromEntry(entry) {
    trackedApi.rememberNicknameRoleBadgesFromEntry(state, entry, {
      normalizeNickname,
      extractSettingsRoleBadges,
    });
  }

  function syncRoleBadgeCacheFromEntries(entries) {
    trackedApi.syncRoleBadgeCacheFromEntries(state, entries, {
      rememberNicknameRoleBadgesFromEntry,
    });
  }

  function addTrackedTarget(rawValue, scope = state.settingsTrackedScope) {
    return trackedApi.addTrackedTarget(state, rawValue, {
      scope,
      normalizeTrackedNickname,
      rebuildEffectiveTrackedNicknames,
      saveSettings,
      renderList,
      MAX_TRACKED_NICKNAMES_PER_SCOPE,
      MAX_TRACKED_GLOBAL_NICKNAMES,
    });
  }

  function removeTrackedTarget(item) {
    trackedApi.removeTrackedTarget(state, item, {
      normalizeTrackedNickname,
      rebuildEffectiveTrackedNicknames,
      pruneHiddenNicknameIfOrphanedInPopup,
      saveSettings,
    });
  }

  function shouldKeepHiddenNickname(nickname, options = {}) {
    return trackedApi.shouldKeepHiddenNickname(state, nickname, options, {
      normalizeNickname,
    });
  }

  function pruneHiddenNicknameIfOrphanedInPopup(nickname, options = {}) {
    trackedApi.pruneHiddenNicknameIfOrphanedInPopup(
      state,
      nickname,
      options,
      {
        normalizeNickname,
        shouldKeepHiddenNickname,
      },
    );
  }

  function getTrackedTargetSettingItems(scope = state.settingsTrackedScope) {
    return trackedApi.getTrackedTargetSettingItems(state, {
      scope,
      normalizeTrackedNickname,
    });
  }

  function createTrackedTargetChip(item) {
    return trackedApi.createTrackedTargetChip(item, {
      document,
      removeTrackedTarget,
      renderSettingsPanel,
    });
  }

  function createSettingToggleRow(labelText, checked, onChange, options = {}) {
    return trackedApi.createSettingToggleRow(
      labelText,
      checked,
      onChange,
      options,
      { document },
    );
  }

  function toggleSettingsPanel(forceOpen) {
    popupApi.toggleSettingsPanel(state, forceOpen, {
      renderSettingsPanel,
    });
  }

  function applySettingsClasses() {
    popupApi.applySettingsClasses(state, {
      document,
      normalizePopupFontScale,
      normalizeChatFontScale,
      normalizeChatWidth,
      MIN_CHAT_WIDTH,
      saveSettings,
      applyHiddenChatElements,
      syncPopupFontScaleControl,
    });
  }

  function adjustPopupFontScale(direction) {
    if (
      state.isMoaWindow !== true &&
      state.settings.showPopupFontScaleControl !== true
    ) {
      return;
    }
    const current = normalizePopupFontScale(state.settings.popupFontScale);
    const next =
      direction < 0
        ? [...POPUP_FONT_SCALE_STEPS]
            .reverse()
            .find((value) => value < current - 0.001)
        : POPUP_FONT_SCALE_STEPS.find((value) => value > current + 0.001);
    if (!Number.isFinite(next)) return;
    state.settings.popupFontScale = next;
    applySettingsClasses();
    saveSettings();
  }

  function syncPopupFontScaleControl() {
    const root = state.ui && state.ui.root;
    const wrap = state.ui && state.ui.popupFontScaleWrap;
    const decrease = state.ui && state.ui.popupFontScaleDecrease;
    const text = state.ui && state.ui.popupFontScaleText;
    const increase = state.ui && state.ui.popupFontScaleIncrease;
    if (!root || !wrap || !decrease || !text || !increase) return;

    const showInInlinePopup =
      state.settings.showPopupFontScaleControl === true;
    const shouldShow = state.isMoaWindow === true || showInInlinePopup;
    wrap.hidden = !shouldShow;
    root.classList.toggle(
      "chzzk-badge-moa-show-popup-font-scale",
      showInInlinePopup,
    );

    const current = normalizePopupFontScale(state.settings.popupFontScale);
    const min = POPUP_FONT_SCALE_STEPS[0];
    const max = POPUP_FONT_SCALE_STEPS[POPUP_FONT_SCALE_STEPS.length - 1];
    text.textContent = `${Math.round(current * 100)}%`;
    decrease.disabled = current <= min + 0.001;
    increase.disabled = current >= max - 0.001;
  }

  function setDisplayStyle(style) {
    popupApi.setDisplayStyle(state, style, {
      normalizeDisplayStyle,
      savePopupDisplayStyle,
      renderList,
      isNearBottom,
    });
  }

  function normalizeDisplayStyle(style) {
    return popupApi.normalizeDisplayStyle(style);
  }

  function normalizePopupFontScale(value) {
    return popupApi.normalizePopupFontScale(value, {
      DEFAULT_POPUP_FONT_SCALE,
      MIN_POPUP_FONT_SCALE,
      MAX_POPUP_FONT_SCALE,
    });
  }

  function normalizeChatFontScale(value) {
    return popupApi.normalizePopupFontScale(value, {
      DEFAULT_POPUP_FONT_SCALE: DEFAULT_CHAT_FONT_SCALE,
      MIN_POPUP_FONT_SCALE: MIN_CHAT_FONT_SCALE,
      MAX_POPUP_FONT_SCALE: MAX_CHAT_FONT_SCALE,
    });
  }

  function normalizeChatWidth(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.max(Number(MIN_CHAT_WIDTH) || 220, Math.round(numeric));
  }

  function applyNicknameFilterStateFromSettings() {
    filterApi.applyNicknameFilterStateFromSettings(state);
  }

  function normalizeNickname(value) {
    return filterApi.normalizeNickname(value);
  }

  function normalizeTrackedNickname(value) {
    return filterApi.normalizeTrackedNickname(value, {
      normalizeNickname,
    });
  }

  function isTrackedTarget(profile, payload) {
    return filterApi.isTrackedTarget(state, profile, payload, {
      normalizeTrackedNickname,
    });
  }

  function isPillNicknameHidden(nickname) {
    return filterApi.isPillNicknameHidden(state, nickname, {
      normalizeNickname,
    });
  }

  function isExcludedCollectNickname(nickname) {
    return trackedApi.isExcludedCollectNickname(state, nickname, {
      normalizeNickname,
    });
  }

  function isExcludedCollectInScope(nickname, scope) {
    return trackedApi.isExcludedCollectNicknameInScope(state, nickname, scope, {
      normalizeNickname,
    });
  }

  // 프로필 팝오버의 제외 버튼 처리. 제외로 켤 때 기존 기록까지 삭제할지 선택하고,
  // 스코프 제외 목록에 반영한다. 제외 해제는 확인 없이 목록에서 제거한다.
  // 반환값: 실제로 상태가 바뀌었으면 true(취소 시 false).
  async function setExcludedCollect(nickname, scope, excluded) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return false;
    const useGlobal = scope === "global";
    let deleteExistingEntries = false;

    if (excluded) {
      const count = (state.entries || []).reduce(
        (n, e) => n + (normalizeNickname(e?.nickname) === normalized ? 1 : 0),
        0,
      );
      const scopeLabel = useGlobal ? "모든 채널" : "현재 채널";
      const message =
        count > 0
          ? `'${normalized}' 닉네임을 ${scopeLabel} 모아보기에서 제외합니다. 현재 모아둔 배지 채팅 ${count}개도 함께 삭제할까요?`
          : `'${normalized}' 닉네임을 ${scopeLabel} 모아보기에서 제외할까요?`;
      if (count > 0) {
        const choice = await showConfirmDialog({
          title: "모아보기 제외",
          message,
          confirmText: "삭제+제외",
          secondaryText: "제외",
          cancelText: "취소",
        });
        if (choice !== true && choice !== "secondary") return false;
        deleteExistingEntries = choice === true;
      } else {
        const confirmed = await requestDeleteConfirm(message, {
          title: "모아보기 제외",
          confirmText: "제외",
        });
        if (!confirmed) return false;
      }
    }

    const changed = trackedApi.setExcludedCollect(
      state,
      normalized,
      scope,
      excluded,
      { normalizeNickname },
    );
    if (!changed) return false;

    if (excluded && deleteExistingEntries) {
      removeEntriesByNickname(normalized);
    }
    saveSettings();
    resetPillCycle(true);
    render();
    return true;
  }

  function pruneExcludedEntriesFromState() {
    return feedApi.pruneExcludedEntriesFromState(state, {
      normalizeNickname,
      resetPillCycle,
      syncNicknameFilterSelection,
      getNicknameStats,
    });
  }

  function getLatestVisiblePillEntry() {
    return feedApi.getLatestVisiblePillEntry(state, {
      isPillNicknameHidden,
    });
  }

  function updateUnseenActor(entry) {
    feedApi.updateUnseenActor(state, entry);
  }

  function getUnseenActorsForPill() {
    return feedApi.getUnseenActorsForPill(state, {
      isPillNicknameHidden,
    });
  }

  function getPillSignature(items) {
    return pillApi.getPillSignature(items);
  }

  function ensurePillCycleForActors(actors) {
    pillApi.ensurePillCycleForActors(state, actors, {
      resetPillCycle,
      getUnseenActorsForPill,
      renderPill,
      PILL_CYCLE_INTERVAL_MS,
    });
  }

  function resetPillCycle(resetIndex = false) {
    pillApi.resetPillCycle(state, resetIndex);
  }

  function renderPillIdentity(identity, countValue, showCount) {
    renderApi.renderPillIdentity(state, identity, countValue, showCount, {
      createBadgeList,
      createBadgeVisual,
    });
  }

  function normalizePillRoleForGlow(badgeType) {
    return pillApi.normalizePillRoleForGlow(badgeType);
  }

  function resolvePillRoleFromIdentity(identity) {
    return pillApi.resolvePillRoleFromIdentity(identity, {
      normalizePillRoleForGlow,
    });
  }

  function applyPillRoleClass(badgeType) {
    pillApi.applyPillRoleClass(state, badgeType, {
      PILL_ROLE_CLASSES,
      PILL_ROLE_CLASS_PREFIX,
      normalizePillRoleForGlow,
    });
  }

  function updateViewModeButtons() {
    renderApi.updateViewModeButtons(state);
  }

  function setPopupActionButtonContent(button, type) {
    uiCoreApi.setPopupActionButtonContent(button, type);
  }

  function setViewModeButtonContent(button, mode) {
    uiCoreApi.setViewModeButtonContent(button, mode);
  }

  function buildMessageContent(message, emojiMap) {
    return renderApi.buildMessageContent(message, emojiMap, {
      appendTextWithLinks,
    });
  }

  function appendTextWithLinks(fragment, text) {
    renderApi.appendTextWithLinks(fragment, text);
  }

  function createMessageTagRow(tags) {
    return renderApi.createMessageTagRow(tags);
  }

  function createBadgeList(badges, variant = "popup") {
    return renderApi.createBadgeList(badges, variant, {
      createBadgeVisual,
    });
  }

  function createBadgeVisual(badge, variant = "popup") {
    return renderApi.createBadgeVisual(badge, variant);
  }

  function triggerAttention(entry) {
    popupApi.triggerAttention(state, entry, {
      isPillNicknameHidden,
      getUnseenActorsForPill,
      PILL_ATTENTION_DURATION_MS,
    });
  }

  function clearAttentionIfNeeded() {
    popupApi.clearAttentionIfNeeded(state);
  }

  function isNearBottom(container) {
    return popupApi.isNearBottom(container);
  }

  function formatTime(timestamp, format) {
    return renderApi.formatTime(timestamp, format);
  }

  function getDateKey(timestamp) {
    return renderApi.getDateKey(timestamp);
  }

  function formatDateLabel(timestamp) {
    return renderApi.formatDateLabel(timestamp);
  }

  function createDateDivider(timestamp) {
    return renderApi.createDateDivider(timestamp, { formatDateLabel });
  }

  function onResizeStart(event) {
    popupApi.onResizeStart(state, event, {
      document,
      onResizeMove,
      onResizeEnd,
    });
  }

  function onResizeMove(event) {
    popupApi.onResizeMove(state, event, {
      clampPopupHeight,
      applyPopupHeight,
    });
  }

  function onResizeEnd() {
    popupApi.onResizeEnd(state, {
      document,
      onResizeMove,
      savePopupHeight,
    });
  }

  function applyPopupHeight() {
    popupApi.applyPopupHeight(state, {
      clampPopupHeight,
      applyFilterBarMaxHeight,
      syncPillPositionForHeader,
    });
    popupApi.syncChatWidthResize(state, {
      document,
      normalizeChatWidth,
      MIN_CHAT_WIDTH,
      saveSettings,
      syncPillPositionForHeader,
    });
  }

  function clampPopupHeight(height) {
    return popupApi.clampPopupHeight(state, height, {
      DEFAULT_POPUP_HEIGHT,
      MIN_POPUP_HEIGHT,
      getMaxPopupHeight,
    });
  }

  function getMaxPopupHeight() {
    return popupApi.getMaxPopupHeight({ document });
  }

  function isVodContext() {
    return !!(
      document.querySelector("aside#vod-aside") ||
      document.querySelector("[class*='vod_chatting_container']") ||
      document.querySelector("[class*='vod_chatting_header']") ||
      document.querySelector("[class*='vod_chatting_list_container']")
    );
  }

  function isWideMode() {
    // 구버전 클래스
    const legacyLarge = !!document.querySelector(
      "section[class*='live_container'][class*='live_is_large']," +
        "aside#aside-chatting[class*='live_chatting_is_large']," +
        "[class*='vod_container'][class*='vod_is_large']," +
        "[class*='vod_chatting_container'][class*='vod_chatting_is_large']",
    );
    if (legacyLarge) return true;

    // 새 구조: 극장(와이드) 모드는 최상위 컨테이너 section/main에 _is_large_가
    // 붙는다(예: _container_gzfy8_1 _is_large_gzfy8_7). 클래스 해시가 바뀌므로
    // 컨테이너 성격(section/main)으로 범위를 좁혀 오탐을 줄인다.
    const newLarge = !!document.querySelector(
      "section[class*='_container_'][class*='_is_large_']," +
        "main[class*='_container_'][class*='_is_large_']",
    );
    return newLarge;
  }

  // /live/{id}/chat 형태의 채팅 전용 팝업 페이지 판정
  function isChatPopupContext() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[0] === "live" && parts[2] === "chat";
  }

  // 이 문서가 "모아보기 전용 창"으로 열린 창인지(분리 버튼으로 연 창).
  function isMoaWindowContext() {
    try {
      return (
        new URLSearchParams(window.location.search).get("moaOnly") === "1"
      );
    } catch (_error) {
      return false;
    }
  }

  // 모아보기를 별도 창으로 분리해서 연다. 치지직 채팅 팝업 URL(/live/{id}/chat)에
  // moaOnly=1 을 붙여 새 창으로 띄우면, 그 창에서 우리 스크립트가 채팅은 숨기고
  // 모아보기 팝업만 자동으로 펼친다(그 창은 자기 WebSocket으로 배지 채팅을 독립
  // 수집하고, 세션 캐시가 켜져 있으면 과거분도 복원한다). 연 뒤 이 탭의 인라인
  // 팝업은 접는다.
  let _moaWindowRef = null;

  // 전용 창이 열려 있는 동안 이 탭의 인라인 UI(필+팝업)를 감춘다. 같은 채널 배지
  // 채팅이 두 곳에 중복 표시되고, '항상 펼침' 설정 탓에 접어도 다시 펼쳐지던 문제를
  // 막기 위함이다. 표식(state + <html> 클래스)으로 render/필/자동펼침을 모두 억제한다.
  // 실제 창 생존 추적은 BroadcastChannel 하트비트가 담당한다(원래 탭 새로고침에도 견고).
  function setDetachedMoaWindowActive(active) {
    const next = active === true;
    if (state.hasDetachedMoaWindow === next) return;
    state.hasDetachedMoaWindow = next;
    const rootEl = document.documentElement;
    if (rootEl) {
      // 설정(detachedOriginView)에 따라 원래 탭에 무엇을 남길지 결정한다.
      //  hide: 필+팝업 숨김 / pill: 필만 유지(팝업 접기) / keep: 그대로 유지
      const view = String(state.settings?.detachedOriginView || "hide");
      rootEl.classList.toggle(
        "chzzk-badge-moa-detached-hide-all",
        next && view === "hide",
      );
      rootEl.classList.toggle(
        "chzzk-badge-moa-detached-pill-only",
        next && view === "pill",
      );
    }
    if (next) {
      // keep 가 아니면(=hide/pill) 인라인 팝업을 접는다(항상 펼침이어도).
      if (String(state.settings?.detachedOriginView || "hide") !== "keep") {
        closePopup(true);
      }
    } else {
      // 전용 창이 닫혔으니 인라인 UI 복원.
      render();
    }
  }

  function openMoaWindow() {
    const channelId = normalizeChannelId(
      state.resolvedChannelId || getChannelIdFromLocationPath() || "",
    );
    if (!channelId) return;

    // 이미 열어둔 창이 살아 있으면 그 창을 앞으로.
    if (_moaWindowRef && !_moaWindowRef.closed) {
      try {
        _moaWindowRef.focus();
        setDetachedMoaWindowActive(true);
        return;
      } catch (_error) {
        _moaWindowRef = null;
      }
    }

    const url = `${window.location.origin}/live/${channelId}/chat?moaOnly=1`;
    const width = 420;
    const height = Math.max(
      480,
      Math.min(900, Math.round(window.screen?.availHeight || 720)),
    );
    const features = `popup=yes,noopener=no,width=${width},height=${height}`;
    let win = null;
    try {
      win = window.open(url, `chzzk-badge-moa-${channelId}`, features);
    } catch (_error) {
      win = null;
    }
    if (win) {
      _moaWindowRef = win;
      try {
        win.focus();
      } catch (_error) {}
      // 전용 창이 살아 있는 동안 이 탭의 인라인 UI 를 감춘다(하트비트가 유지/복원).
      // 하트비트가 오기 전이라도 로드 실패 시 원복되도록 안전 타임아웃을 무장한다.
      setDetachedMoaWindowActive(true);
      armDetachedPresenceTimeout();
    }
  }

  function getActiveStorageHeightKey() {
    if (isChatPopupContext()) {
      return STORAGE_HEIGHT_KEY_CHAT_POPUP;
    }
    const wide = isWideMode();
    const vod = isVodContext();
    const key = vod
      ? wide
        ? STORAGE_HEIGHT_KEY_VOD_WIDE
        : STORAGE_HEIGHT_KEY_VOD
      : wide
        ? STORAGE_HEIGHT_KEY_LIVE_WIDE
        : STORAGE_HEIGHT_KEY_LIVE;
    return key;
  }

  async function loadPopupHeight() {
    // 1차: 현재 컨텍스트의 키 + (popup.js의) 가장 오래된 STORAGE_HEIGHT_KEY fallback
    const primary = await popupApi.loadPopupHeight(state, {
      getStorageValue,
      STORAGE_HEIGHT_KEY,
      getActiveStorageHeightKey,
      DEFAULT_POPUP_HEIGHT,
      clampPopupHeight,
      skipLegacyFallback: isChatPopupContext(),
    });

    // chat-popup 컨텍스트는 추가로 LIVE/LIVE_WIDE → STORAGE_HEIGHT_KEY 순서로 마이그레이션
    if (!isChatPopupContext()) return primary;

    const activeKey = getActiveStorageHeightKey();
    const stored = await getStorageValue(activeKey);
    if (Number.isFinite(stored)) return clampPopupHeight(stored);

    const fallbackKeys = [
      STORAGE_HEIGHT_KEY_LIVE_WIDE,
      STORAGE_HEIGHT_KEY_LIVE,
      STORAGE_HEIGHT_KEY,
    ];
    for (const key of fallbackKeys) {
      if (!key || key === activeKey) continue;
      const value = await getStorageValue(key);
      if (Number.isFinite(value)) return clampPopupHeight(value);
    }
    return primary;
  }

  function savePopupHeight(height) {
    const key = getActiveStorageHeightKey();
    if (!_heightSwitchInFlight && _lastHeightKey && key !== _lastHeightKey) {
      onAsideResize();
      return;
    }
    popupApi.savePopupHeight(state, height, {
      setStorageValue,
      STORAGE_HEIGHT_KEY,
      getActiveStorageHeightKey,
      clampPopupHeight,
    });
  }

  async function loadPopupDisplayStyle() {
    return popupApi.loadPopupDisplayStyle(state, {
      getStorageValue,
      STORAGE_DISPLAY_STYLE_KEY,
      normalizeDisplayStyle,
    });
  }

  function savePopupDisplayStyle(style) {
    popupApi.savePopupDisplayStyle(state, style, {
      setStorageValue,
      STORAGE_DISPLAY_STYLE_KEY,
      normalizeDisplayStyle,
    });
  }

  function getChannelCacheStorageKey(
    channelIdCandidate = state.resolvedChannelId,
  ) {
    return cacheApi.getChannelCacheStorageKey(state, channelIdCandidate, {
      normalizeChannelId,
      getChannelIdFromLocationPath,
      getRawChannelIdFromLocationPath,
    });
  }

  function isSessionCacheEnabled() {
    return cacheApi.isSessionCacheEnabled(state);
  }

  function clearPersistChannelCacheTimer() {
    cacheApi.clearPersistChannelCacheTimer(state);
  }

  function schedulePersistChannelCache() {
    cacheApi.schedulePersistChannelCache(state, {
      persistChannelCacheNow,
    });
  }

  function persistChannelCacheNow(
    channelIdCandidate = state.resolvedChannelId,
  ) {
    cacheApi.persistChannelCacheNow(state, {
      normalizeChannelId,
      getChannelIdFromLocationPath,
      getRawChannelIdFromLocationPath,
      getStorageValue,
      removeStorageValue,
      setStorageValue,
      persistOriginalChatHtml,
      persistOriginalChatHtmlBatch,
      serializeEntryForCache,
      serializeUnseenStateForCache,
    }, channelIdCandidate);
  }

  async function hasCurrentChannelData() {
    const entriesCount = Array.isArray(state.entries) ? state.entries.length : 0;
    const hasEntries = entriesCount > 0;
    const storageKeys = cacheApi.getChannelCacheStorageKeys(
      state,
      state.resolvedChannelId,
      {
        normalizeChannelId,
        getChannelIdFromLocationPath,
        getRawChannelIdFromLocationPath,
        ignoreEnabledCheck: true,
      },
    );
    let hasCachedSession = false;
    for (const storageKey of storageKeys) {
      try {
        const value = await getStorageValue(storageKey, "session");
        if (value != null && value !== "") {
          hasCachedSession = true;
          break;
        }
      } catch (_error) {
        // ignore and continue probing remaining keys
      }
    }
    return { ok: true, hasEntries, hasCachedSession, entriesCount };
  }

  async function clearCurrentChannelEntries() {
    clearPersistChannelCacheTimer();

    await removeOriginalChatHtmlRefs(
      state.entries
        .map((entry) => String(entry?.originalChatRef || "").trim())
        .filter((ref) => !!ref),
    );

    const storageKeys = cacheApi.getChannelCacheStorageKeys(
      state,
      state.resolvedChannelId,
      {
        normalizeChannelId,
        getChannelIdFromLocationPath,
        getRawChannelIdFromLocationPath,
        ignoreEnabledCheck: true,
      },
    );

    storageKeys.forEach((storageKey) => {
      removeStorageValue(storageKey, "session");
    });

    state.entries = [];
    state.dedupeKeys = new Set();
    state.unseenCount = 0;
    state.unseenActors = new Map();
    state.nicknameRoleBadgesByNickname = new Map();

    render();

    return { ok: true, cleared: storageKeys.length };
  }

  async function restoreChannelCache(
    channelIdCandidate = state.resolvedChannelId,
  ) {
    await cacheApi.restoreChannelCache(state, {
      normalizeChannelId,
      getChannelIdFromLocationPath,
      getRawChannelIdFromLocationPath,
      getStorageValue,
      loadOriginalChatHtml,
      normalizeCachedEntry,
      syncRoleBadgeCacheFromEntries,
      normalizeCachedUnseenState,
      applyNicknameFilterStateFromSettings,
      resetPillCycle,
      render,
    }, channelIdCandidate);
  }

  function serializeUnseenStateForCache() {
    return cacheApi.serializeUnseenStateForCache(state, {
      normalizeBadgeArray,
      normalizeBadgeValue,
    });
  }

  function normalizeCachedUnseenState(rawUnseen) {
    return cacheApi.normalizeCachedUnseenState(rawUnseen, {
      normalizeBadgeArray,
      normalizeBadgeValue,
    });
  }

  function serializeEntryForCache(entry) {
    return cacheApi.serializeEntryForCache(entry, {
      normalizeEmojiMap,
      normalizeBadgeArray,
      normalizeBadgeValue,
      normalizeTagArray,
    });
  }

  function normalizeCachedEntry(rawEntry, index) {
    return cacheApi.normalizeCachedEntry(rawEntry, index, {
      normalizeEmojiMap,
      normalizeCachedBadgeType,
      normalizeBadgeArray,
      normalizeBadgeValue,
      normalizeTagArray,
    });
  }

  function normalizeCachedBadgeType(rawEntry) {
    return cacheApi.normalizeCachedBadgeType(rawEntry);
  }

  function normalizeBadgeArray(badges) {
    return cacheApi.normalizeBadgeArray(badges);
  }

  function normalizeBadgeValue(badge) {
    return cacheApi.normalizeBadgeValue(badge);
  }

  function normalizeTagArray(tags) {
    return cacheApi.normalizeTagArray(tags);
  }
})();
