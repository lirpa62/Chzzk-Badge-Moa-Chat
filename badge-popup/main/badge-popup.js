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
  const renderApi = ns.renderApi;
  const feedApi = ns.feedApi;
  const lifecycleApi = ns.lifecycleApi;
  const popupApi = ns.popupApi;
  const state = ns.state;
  const createDefaultSettingsStateFromNs = ns.createDefaultSettingsState;

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
      onWindowUnload,
      onDocumentMouseDown,
      onStorageChanged,
      onAsideResize,
    });
  }

  function onAsideResize() {
    if (_heightSwitchInFlight) return;
    const currentKey = getActiveStorageHeightKey();
    if (currentKey !== _lastHeightKey) {
      _heightSwitchInFlight = true;
      if (state._resizeReclampTimer) {
        clearTimeout(state._resizeReclampTimer);
        state._resizeReclampTimer = null;
      }
      _lastHeightKey = currentKey;
      loadPopupHeight().then((height) => {
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
    });
  }

  function onWindowUnload() {
    lifecycleApi.onWindowUnload(state, {
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
      onWindowUnload,
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
    });
  }

  function onWindowMessage(event) {
    observerApi.onWindowMessage(state, observerRefs, event, {
      MESSAGE_MARK,
      handleLocationChange,
      enqueueIncomingPayload,
      scheduleChatHighlightScan,
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
      maybeRestoreResolvedChannelCache(nextResolvedChannelId);
    }
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
        if (currentRestoringChannelId === nextChannelId) {
          cacheState.resolvedRestoreInFlight = "";
        }
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
    });
  }

  function findLiveChatHeader() {
    return uiCoreApi.findLiveChatHeader();
  }

  function isVodChatHeader(header) {
    return uiCoreApi.isVodChatHeader(header);
  }

  function syncPillPositionForHeader() {
    uiCoreApi.syncPillPositionForHeader(state, { isVodChatHeader });
  }

  function cleanupDetachedUi() {
    uiCoreApi.cleanupDetachedUi(state, { teardownUi });
  }

  function teardownUi() {
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
    popupApi.closePopup(state, immediate, {
      resolveConfirmDialog,
      updateFilterToggleButton,
      getNicknameStats,
      releasePopupFocus,
      updatePopupPinStateUi,
      renderPill,
      CLOSE_ANIMATION_MS,
    });
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
    cancelText = "취소",
  } = {}) {
    return confirmApi.showConfirmDialog(
      state,
      { title, message, confirmText, cancelText },
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
    });
  }

  function saveSettings() {
    settingsApi.saveSettings(state, {
      getSettingsScopeKey,
      normalizePopupFontScale,
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
    ]);
  }

  function buildSettingsContextResponse() {
    return settingsApi.buildSettingsContextResponse(state, {
      getSettingsScopeKey,
      resolveChannelDisplayName,
      getPillNicknameSettingItems,
      normalizePopupFontScale,
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
    });
  }

  function refreshChatHighlightObserver() {
    observerApi.refreshChatHighlightObserver(state, observerRefs, {
      findChatListContainer,
      processHighlightNode,
      applyHighlightToItem,
      CHAT_ITEM_SELECTOR,
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
    });
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
      renderSettingsPanel,
      addTrackedTarget,
      getTrackedTargetSettingItems,
      createTrackedTargetChip,
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

  function addTrackedTarget(rawValue) {
    return trackedApi.addTrackedTarget(state, rawValue, {
      normalizeTrackedNickname,
      rebuildEffectiveTrackedNicknames,
      saveSettings,
      renderList,
      MAX_TRACKED_NICKNAMES_PER_SCOPE,
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

  function getTrackedTargetSettingItems() {
    return trackedApi.getTrackedTargetSettingItems(state, {
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
    });
  }

  function setDisplayStyle(style) {
    popupApi.setDisplayStyle(state, style, {
      normalizeDisplayStyle,
      savePopupDisplayStyle,
      renderList,
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

  function formatTime(timestamp) {
    return renderApi.formatTime(timestamp);
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
      document.querySelector("[class*='vod_chatting_container']") ||
      document.querySelector("[class*='vod_chatting_header']") ||
      document.querySelector("[class*='vod_chatting_list_container']")
    );
  }

  function isWideMode() {
    const liveContainerLarge = !!document.querySelector(
      "section[class*='live_container'][class*='live_is_large']",
    );
    const liveChatLarge = !!document.querySelector(
      "aside#aside-chatting[class*='live_chatting_is_large']",
    );
    const vodContainerLarge = !!document.querySelector(
      "[class*='vod_container'][class*='vod_is_large']",
    );
    const vodChatLarge = !!document.querySelector(
      "[class*='vod_chatting_container'][class*='vod_chatting_is_large']",
    );
    return liveContainerLarge || liveChatLarge || vodContainerLarge || vodChatLarge;
  }

  // /live/{id}/chat 형태의 채팅 전용 팝업 페이지 판정
  function isChatPopupContext() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[0] === "live" && parts[2] === "chat";
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
