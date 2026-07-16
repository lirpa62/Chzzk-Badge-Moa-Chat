(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.lifecycleApi && typeof ns.lifecycleApi === "object") return;

  function init(state, deps = {}) {
    const loadPopupHeightFn =
      typeof deps.loadPopupHeight === "function" ? deps.loadPopupHeight : async () => 0;
    const loadPopupDisplayStyleFn =
      typeof deps.loadPopupDisplayStyle === "function"
        ? deps.loadPopupDisplayStyle
        : async () => "block";
    const loadRuntimeTabIdFn =
      typeof deps.loadRuntimeTabId === "function" ? deps.loadRuntimeTabId : async () => null;
    const normalizeChannelIdFn =
      typeof deps.normalizeChannelId === "function"
        ? deps.normalizeChannelId
        : (value) => String(value || "").trim();
    const getChannelIdFromLocationPathFn =
      typeof deps.getChannelIdFromLocationPath === "function"
        ? deps.getChannelIdFromLocationPath
        : () => "";
    const getLocationKeyFn =
      typeof deps.getLocationKey === "function" ? deps.getLocationKey : () => "home";
    const getSettingsScopeKeyFn =
      typeof deps.getSettingsScopeKey === "function"
        ? deps.getSettingsScopeKey
        : () => "home";
    const loadSettingsFn =
      typeof deps.loadSettings === "function" ? deps.loadSettings : async () => ({});
    const applyNicknameFilterStateFromSettingsFn =
      typeof deps.applyNicknameFilterStateFromSettings === "function"
        ? deps.applyNicknameFilterStateFromSettings
        : () => {};
    const syncTrackedTargetsToInjectFn =
      typeof deps.syncTrackedTargetsToInject === "function"
        ? deps.syncTrackedTargetsToInject
        : () => {};
    const isSessionCacheEnabledFn =
      typeof deps.isSessionCacheEnabled === "function"
        ? deps.isSessionCacheEnabled
        : () => false;
    const restoreChannelCacheFn =
      typeof deps.restoreChannelCache === "function"
        ? deps.restoreChannelCache
        : async () => {};
    const clearSessionCachesForCurrentTabFn =
      typeof deps.clearSessionCachesForCurrentTab === "function"
        ? deps.clearSessionCachesForCurrentTab
        : async () => {};
    const bindEventsFn =
      typeof deps.bindEvents === "function" ? deps.bindEvents : () => {};
    const ensureUiFn =
      typeof deps.ensureUi === "function" ? deps.ensureUi : () => {};
    const startObserverFn =
      typeof deps.startObserver === "function" ? deps.startObserver : () => {};
    const refreshChatHighlightObserverFn =
      typeof deps.refreshChatHighlightObserver === "function"
        ? deps.refreshChatHighlightObserver
        : () => {};
    const scheduleChatHighlightScanFn =
      typeof deps.scheduleChatHighlightScan === "function"
        ? deps.scheduleChatHighlightScan
        : () => {};

    return (async () => {
      state.popupHeight = await loadPopupHeightFn();
      state.displayStyle = await loadPopupDisplayStyleFn();
      state.tabId = await loadRuntimeTabIdFn();
      state.resolvedChannelId = normalizeChannelIdFn(getChannelIdFromLocationPathFn());
      state.locationKey = getLocationKeyFn();
      state.settingsScopeKey = getSettingsScopeKeyFn(state.resolvedChannelId);
      state.settings = await loadSettingsFn(state.settingsScopeKey);
      applyNicknameFilterStateFromSettingsFn();
      syncTrackedTargetsToInjectFn();
      if (isSessionCacheEnabledFn()) {
        await restoreChannelCacheFn(state.resolvedChannelId);
      } else {
        await clearSessionCachesForCurrentTabFn();
      }
      bindEventsFn();
      ensureUiFn();
      startObserverFn();
      refreshChatHighlightObserverFn();
      scheduleChatHighlightScanFn();
    })();
  }

  function bindEvents(state, deps = {}) {
    const windowObj = deps.windowObj || window;
    const documentObj = deps.documentObj || document;
    const chromeObj = deps.chromeObj || (typeof chrome !== "undefined" ? chrome : null);

    const onWindowMessage =
      typeof deps.onWindowMessage === "function" ? deps.onWindowMessage : () => {};
    const onWindowResize =
      typeof deps.onWindowResize === "function" ? deps.onWindowResize : () => {};
    const onPageHide =
      typeof deps.onPageHide === "function" ? deps.onPageHide : () => {};
    const onDocumentMouseDown =
      typeof deps.onDocumentMouseDown === "function"
        ? deps.onDocumentMouseDown
        : () => {};
    const onStorageChanged =
      typeof deps.onStorageChanged === "function" ? deps.onStorageChanged : () => {};

    windowObj.addEventListener("message", onWindowMessage);
    windowObj.addEventListener("resize", onWindowResize);
    windowObj.addEventListener("pagehide", onPageHide);
    documentObj.addEventListener("mousedown", onDocumentMouseDown, true);

    if (
      chromeObj &&
      chromeObj.storage &&
      chromeObj.storage.onChanged &&
      typeof chromeObj.storage.onChanged.addListener === "function"
    ) {
      chromeObj.storage.onChanged.addListener(onStorageChanged);
    }

    const onAsideResize =
      typeof deps.onAsideResize === "function" ? deps.onAsideResize : onWindowResize;
    if (typeof ResizeObserver === "function") {
      const aside =
        documentObj.querySelector("aside#aside-chatting") ||
        documentObj.querySelector("aside#vod-aside") ||
        documentObj.querySelector("[class*='vod_chatting_container']");
      if (aside) {
        const observer = new ResizeObserver(() => {
          onAsideResize();
        });
        observer.observe(aside);
        state._asideResizeObserver = observer;
      }
    }

    if (typeof MutationObserver === "function") {
      const root = documentObj.documentElement || documentObj.body;
      if (root) {
        const observer = new MutationObserver((mutations) => {
          let shouldCheckModeSwitch = false;

          mutations.forEach((mutation) => {
            if (!mutation) return;
            if (
              mutation.type === "attributes" &&
              mutation.attributeName === "class" &&
              mutation.target instanceof Element
            ) {
              const element = mutation.target;
              const className = String(element.className || "");
              const tag = element.tagName ? element.tagName.toLowerCase() : "";
              const isRelevantElement =
                element.id === "aside-chatting" ||
                element.id === "vod-aside" ||
                className.includes("live_is_large") ||
                className.includes("live_chatting_is_large") ||
                className.includes("vod_is_large") ||
                className.includes("vod_chatting_is_large") ||
                className.includes("live_container") ||
                className.includes("vod_container") ||
                className.includes("chatting_container") ||
                // 새 구조: 극장(와이드) 토글은 최상위 section/main의 _is_large_가
                // 붙고/떨어진다.
                ((tag === "section" || tag === "main") &&
                  className.includes("_is_large_")) ||
                ((tag === "section" || tag === "main") &&
                  className.includes("_container_"));
              if (isRelevantElement) {
                shouldCheckModeSwitch = true;
              }
            } else if (mutation.type === "childList") {
              const addedNodes = Array.from(mutation.addedNodes || []).filter(
                (node) => node instanceof Element,
              );
              if (
                addedNodes.some((node) => {
                  if (!(node instanceof Element)) return false;
                  const className = String(node.className || "");
                  return (
                    node.id === "aside-chatting" ||
                    node.id === "vod-aside" ||
                    className.includes("live_container") ||
                    className.includes("vod_container") ||
                    className.includes("chatting_container") ||
                    node.querySelector?.("aside#aside-chatting") ||
                    node.querySelector?.("aside#vod-aside")
                  );
                })
              ) {
                shouldCheckModeSwitch = true;
              }
            }
          });

          if (!shouldCheckModeSwitch) return;
          if (state._modeClassObserverTimer) {
            clearTimeout(state._modeClassObserverTimer);
          }
          state._modeClassObserverTimer = setTimeout(() => {
            state._modeClassObserverTimer = null;
            onAsideResize();
          }, 0);
        });

        observer.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["class"],
        });
        state._modeClassObserver = observer;
      }
    }
  }

  function unbindEvents(state, deps = {}) {
    const windowObj = deps.windowObj || window;
    const documentObj = deps.documentObj || document;
    const chromeObj = deps.chromeObj || (typeof chrome !== "undefined" ? chrome : null);

    const onWindowMessage =
      typeof deps.onWindowMessage === "function" ? deps.onWindowMessage : () => {};
    const onWindowResize =
      typeof deps.onWindowResize === "function" ? deps.onWindowResize : () => {};
    const onPageHide =
      typeof deps.onPageHide === "function" ? deps.onPageHide : () => {};
    const onDocumentMouseDown =
      typeof deps.onDocumentMouseDown === "function"
        ? deps.onDocumentMouseDown
        : () => {};
    const onStorageChanged =
      typeof deps.onStorageChanged === "function" ? deps.onStorageChanged : () => {};

    windowObj.removeEventListener("message", onWindowMessage);
    windowObj.removeEventListener("resize", onWindowResize);
    windowObj.removeEventListener("pagehide", onPageHide);
    documentObj.removeEventListener("mousedown", onDocumentMouseDown, true);

    if (
      chromeObj &&
      chromeObj.storage &&
      chromeObj.storage.onChanged &&
      typeof chromeObj.storage.onChanged.removeListener === "function"
    ) {
      chromeObj.storage.onChanged.removeListener(onStorageChanged);
    }

    if (state._asideResizeObserver) {
      state._asideResizeObserver.disconnect();
      state._asideResizeObserver = null;
    }
    if (state._modeClassObserver) {
      state._modeClassObserver.disconnect();
      state._modeClassObserver = null;
    }
    if (state._modeClassObserverTimer) {
      clearTimeout(state._modeClassObserverTimer);
      state._modeClassObserverTimer = null;
    }
  }

  function onPageHide(state, deps = {}) {
    const clearPersistChannelCacheTimerFn =
      typeof deps.clearPersistChannelCacheTimer === "function"
        ? deps.clearPersistChannelCacheTimer
        : () => {};
    const isSessionCacheEnabledFn =
      typeof deps.isSessionCacheEnabled === "function"
        ? deps.isSessionCacheEnabled
        : () => false;
    const persistChannelCacheNowFn =
      typeof deps.persistChannelCacheNow === "function"
        ? deps.persistChannelCacheNow
        : () => {};
    // 리스너/옵저버 정리는 예전에 'unload'에서 했지만, 치지직 Permissions-Policy가
    // unload 를 금지해 콘솔 경고가 뜬다. pagehide 는 허용되고 동일한 종료 시점을
    // (bfcache 포함) 커버하므로 여기서 정리한다.
    const unbindEventsFn =
      typeof deps.unbindEvents === "function" ? deps.unbindEvents : () => {};

    clearPersistChannelCacheTimerFn();
    if (isSessionCacheEnabledFn()) {
      persistChannelCacheNowFn();
    }
    unbindEventsFn();
  }

  function onWindowResize(state, deps = {}) {
    const applyPopupHeightFn =
      typeof deps.applyPopupHeight === "function" ? deps.applyPopupHeight : () => {};
    applyPopupHeightFn();
    if (state._resizeReclampTimer) {
      clearTimeout(state._resizeReclampTimer);
    }
    state._resizeReclampTimer = setTimeout(() => {
      state._resizeReclampTimer = null;
      applyPopupHeightFn();
    }, 150);
  }

  function onStorageChanged(state, changes, areaName, deps = {}) {
    if (areaName !== "local" || !changes || typeof changes !== "object") {
      return;
    }

    const normalizeDisplayStyleFn =
      typeof deps.normalizeDisplayStyle === "function"
        ? deps.normalizeDisplayStyle
        : (value) => value;
    const clampPopupHeightFn =
      typeof deps.clampPopupHeight === "function" ? deps.clampPopupHeight : (v) => v;
    const normalizeSettingsFn =
      typeof deps.normalizeSettings === "function"
        ? deps.normalizeSettings
        : (value) => value;
    const applyNicknameFilterStateFromSettingsFn =
      typeof deps.applyNicknameFilterStateFromSettings === "function"
        ? deps.applyNicknameFilterStateFromSettings
        : () => {};
    const syncTrackedTargetsToInjectFn =
      typeof deps.syncTrackedTargetsToInject === "function"
        ? deps.syncTrackedTargetsToInject
        : () => {};
    const syncBlindCaptureToInjectFn =
      typeof deps.syncBlindCaptureToInject === "function"
        ? deps.syncBlindCaptureToInject
        : () => {};
    const syncChatTimestampToInjectFn =
      typeof deps.syncChatTimestampToInject === "function"
        ? deps.syncChatTimestampToInject
        : () => {};
    const isSessionCacheEnabledFn =
      typeof deps.isSessionCacheEnabled === "function"
        ? deps.isSessionCacheEnabled
        : () => false;
    const clearPersistChannelCacheTimerFn =
      typeof deps.clearPersistChannelCacheTimer === "function"
        ? deps.clearPersistChannelCacheTimer
        : () => {};
    const clearSessionCachesForCurrentTabFn =
      typeof deps.clearSessionCachesForCurrentTab === "function"
        ? deps.clearSessionCachesForCurrentTab
        : async () => {};
    const persistChannelCacheNowFn =
      typeof deps.persistChannelCacheNow === "function"
        ? deps.persistChannelCacheNow
        : () => {};
    const restoreChannelCacheFn =
      typeof deps.restoreChannelCache === "function"
        ? deps.restoreChannelCache
        : async () => {};
    const applyPopupHeightFn =
      typeof deps.applyPopupHeight === "function" ? deps.applyPopupHeight : () => {};
    const renderFn = typeof deps.render === "function" ? deps.render : () => {};

    const storageDisplayStyleKey = deps.STORAGE_DISPLAY_STYLE_KEY;
    const storageSettingsKey = deps.STORAGE_SETTINGS_KEY;
    const getActiveStorageHeightKeyFn =
      typeof deps.getActiveStorageHeightKey === "function"
        ? deps.getActiveStorageHeightKey
        : () => deps.STORAGE_HEIGHT_KEY;
    const storageHeightKey = getActiveStorageHeightKeyFn();

    let shouldRender = false;

    if (Object.prototype.hasOwnProperty.call(changes, storageDisplayStyleKey)) {
      const nextStyle = normalizeDisplayStyleFn(
        changes[storageDisplayStyleKey] && changes[storageDisplayStyleKey].newValue,
      );
      if (state.displayStyle !== nextStyle) {
        state.displayStyle = nextStyle;
        shouldRender = true;
      }
    }

    if (Object.prototype.hasOwnProperty.call(changes, storageSettingsKey)) {
      const nextRawSettings =
        changes[storageSettingsKey] && changes[storageSettingsKey].newValue;
      const prevCacheEnabled = isSessionCacheEnabledFn();

      state.settings = normalizeSettingsFn(nextRawSettings, state.settingsScopeKey);
      applyNicknameFilterStateFromSettingsFn();
      syncTrackedTargetsToInjectFn();
      syncBlindCaptureToInjectFn();
      syncChatTimestampToInjectFn();

      const nextCacheEnabled = isSessionCacheEnabledFn();
      if (!nextCacheEnabled) {
        clearPersistChannelCacheTimerFn();
        void clearSessionCachesForCurrentTabFn();
      } else if (!prevCacheEnabled && nextCacheEnabled) {
        if (Array.isArray(state.entries) && state.entries.length > 0) {
          persistChannelCacheNowFn(state.resolvedChannelId);
        } else {
          void restoreChannelCacheFn(state.resolvedChannelId);
        }
      }
      shouldRender = true;
    }

    if (Object.prototype.hasOwnProperty.call(changes, storageHeightKey)) {
      const nextHeightRaw =
        changes[storageHeightKey] && changes[storageHeightKey].newValue;
      const nextHeight = clampPopupHeightFn(nextHeightRaw);
      if (state.popupHeight !== nextHeight) {
        state.popupHeight = nextHeight;
        applyPopupHeightFn();
      }
    }

    if (shouldRender) {
      renderFn();
    }
  }

  function onDocumentMouseDown(state, event, deps = {}) {
    if (!state.isOpen) return;
    if (state.confirmDialog && state.confirmDialog.open) return;

    const root = state?.ui?.root;
    if (!root) return;

    const target = event && event.target;
    if (!(target instanceof Node)) return;
    if (root.contains(target)) return;

    const targetElement = target instanceof Element ? target : target.parentElement;
    if (
      targetElement &&
      targetElement.closest(".chzzk-badge-moa-profile-card")
    ) {
      return;
    }
    if (targetElement && targetElement.closest("button")) return;

    const closePopupFn =
      typeof deps.closePopup === "function" ? deps.closePopup : () => {};
    closePopupFn();
  }

  function reloadSettingsForScope(state, scopeKey, deps = {}) {
    const loadSettingsFn =
      typeof deps.loadSettings === "function" ? deps.loadSettings : async () => ({});
    const applyNicknameFilterStateFromSettingsFn =
      typeof deps.applyNicknameFilterStateFromSettings === "function"
        ? deps.applyNicknameFilterStateFromSettings
        : () => {};
    const syncTrackedTargetsToInjectFn =
      typeof deps.syncTrackedTargetsToInject === "function"
        ? deps.syncTrackedTargetsToInject
        : () => {};
    const applySettingsClassesFn =
      typeof deps.applySettingsClasses === "function"
        ? deps.applySettingsClasses
        : () => {};
    const renderFn = typeof deps.render === "function" ? deps.render : () => {};

    return (async () => {
      const loaded = await loadSettingsFn(scopeKey);
      if (scopeKey !== state.settingsScopeKey) return;
      state.settings = loaded;
      applyNicknameFilterStateFromSettingsFn();
      syncTrackedTargetsToInjectFn();
      applySettingsClassesFn();
      renderFn();
    })();
  }

  ns.lifecycleApi = {
    init,
    bindEvents,
    unbindEvents,
    onPageHide,
    onWindowResize,
    onStorageChanged,
    onDocumentMouseDown,
    reloadSettingsForScope,
  };
})();
