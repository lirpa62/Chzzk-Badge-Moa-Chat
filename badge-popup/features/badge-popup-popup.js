(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.popupApi && typeof ns.popupApi === "object") return;

  function onPillClick(state, event, deps = {}) {
    if (event && typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }
    const closePopupFn =
      typeof deps.closePopup === "function" ? deps.closePopup : () => {};
    const openPopupFn =
      typeof deps.openPopup === "function" ? deps.openPopup : () => {};

    if (state && state.isOpen) {
      closePopupFn();
      return;
    }
    openPopupFn();
  }

  function openPopup(state, deps = {}) {
    const resetPillCycleFn =
      typeof deps.resetPillCycle === "function"
        ? deps.resetPillCycle
        : () => {};
    const schedulePersistChannelCacheFn =
      typeof deps.schedulePersistChannelCache === "function"
        ? deps.schedulePersistChannelCache
        : () => {};
    const updatePopupPinStateUiFn =
      typeof deps.updatePopupPinStateUi === "function"
        ? deps.updatePopupPinStateUi
        : () => {};
    const applyPopupHeightFn =
      typeof deps.applyPopupHeight === "function"
        ? deps.applyPopupHeight
        : () => {};
    const flushIncomingPayloadsFn =
      typeof deps.flushIncomingPayloads === "function"
        ? deps.flushIncomingPayloads
        : () => {};
    const renderListFn =
      typeof deps.renderList === "function" ? deps.renderList : () => {};
    const renderPillFn =
      typeof deps.renderPill === "function" ? deps.renderPill : () => {};
    const isVideoPageFn =
      typeof deps.isVideoPage === "function" ? deps.isVideoPage : () => false;
    const openAnimationMs = Number(deps.OPEN_ANIMATION_MS) || 0;

    const root = state?.ui?.root;
    const popup = state?.ui?.popup;
    const pill = state?.ui?.pill;
    if (!root || !popup || !pill || state.isOpen) return;

    state.isOpen = true;
    state.unseenCount = 0;
    state.unseenActors.clear();
    resetPillCycleFn(true);
    schedulePersistChannelCacheFn();

    try {
      const syncApi = window.__chzzkBadgeMoa && window.__chzzkBadgeMoa.sync;
      if (syncApi && typeof syncApi.broadcastRead === "function") {
        syncApi.broadcastRead(state.resolvedChannelId);
      }
    } catch (_error) {}

    clearTimeout(state.closeTimer);
    popup.classList.remove("is-closing");
    popup.removeAttribute("inert");
    popup.setAttribute("aria-hidden", "false");
    root.classList.add("is-open");
    pill.setAttribute("aria-expanded", "true");
    updatePopupPinStateUiFn();

    popup.classList.remove("is-opening");
    void popup.offsetWidth;
    popup.classList.add("is-opening");

    setTimeout(() => {
      popup.classList.remove("is-opening");
    }, openAnimationMs);

    applyPopupHeightFn();
    flushIncomingPayloadsFn();
    renderListFn(isVideoPageFn() ? "latest-sequence" : true);
    renderPillFn();
  }

  function closePopup(state, immediate = false, deps = {}) {
    const resolveConfirmDialogFn =
      typeof deps.resolveConfirmDialog === "function"
        ? deps.resolveConfirmDialog
        : () => {};
    const updateFilterToggleButtonFn =
      typeof deps.updateFilterToggleButton === "function"
        ? deps.updateFilterToggleButton
        : () => {};
    const getNicknameStatsFn =
      typeof deps.getNicknameStats === "function"
        ? deps.getNicknameStats
        : () => [];
    const releasePopupFocusFn =
      typeof deps.releasePopupFocus === "function"
        ? deps.releasePopupFocus
        : () => {};
    const updatePopupPinStateUiFn =
      typeof deps.updatePopupPinStateUi === "function"
        ? deps.updatePopupPinStateUi
        : () => {};
    const renderPillFn =
      typeof deps.renderPill === "function" ? deps.renderPill : () => {};
    const closeAnimationMs = Number(deps.CLOSE_ANIMATION_MS) || 0;

    const root = state?.ui?.root;
    const popup = state?.ui?.popup;
    const pill = state?.ui?.pill;
    if (!root || !popup || !pill) return;
    if (!immediate && state.popupPinned) return;

    resolveConfirmDialogFn(false);
    state.isOpen = false;
    state.filterBarCollapsed = true;
    pill.setAttribute("aria-expanded", "false");

    if (state.ui.filterBar) {
      state.ui.filterBar.style.display = "none";
      state.ui.filterBar.style.maxHeight = "";
    }
    updateFilterToggleButtonFn(getNicknameStatsFn(state.entries).length);

    clearTimeout(state.closeTimer);
    releasePopupFocusFn();

    if (immediate) {
      state.popupPinned = false;
      updatePopupPinStateUiFn();
      popup.classList.remove("is-opening", "is-closing");
      popup.setAttribute("inert", "");
      popup.setAttribute("aria-hidden", "true");
      root.classList.remove("is-open");
      renderPillFn();
      return;
    }

    popup.classList.remove("is-opening");
    popup.classList.add("is-closing");
    popup.setAttribute("inert", "");

    state.closeTimer = setTimeout(() => {
      if (state.isOpen) return;
      popup.classList.remove("is-closing");
      popup.setAttribute("aria-hidden", "true");
      root.classList.remove("is-open");
    }, closeAnimationMs);

    renderPillFn();
  }

  function updatePopupPinStateUi(state) {
    const root = state?.ui?.root;
    const pinButton = state?.ui?.pinButton;
    const closeButton = state?.ui?.closeButton;
    if (root) {
      root.classList.toggle("is-popup-pinned", state.popupPinned === true);
    }
    if (pinButton) {
      pinButton.setAttribute(
        "aria-pressed",
        String(state.popupPinned === true),
      );
      pinButton.setAttribute(
        "aria-label",
        state.popupPinned ? "배지 채팅 팝업 고정 해제" : "배지 채팅 팝업 고정",
      );
      pinButton.title = state.popupPinned
        ? "고정됨 - 클릭하여 고정 해제"
        : "팝업창 고정";
    }
    if (closeButton) {
      closeButton.disabled = state.popupPinned === true;
      closeButton.title = state.popupPinned
        ? "고정 해제 후 닫기 가능"
        : "팝업 닫기";
    }
  }

  function releasePopupFocus(state, deps = {}) {
    const doc = deps.document || document;
    const popup = state?.ui?.popup;
    const pill = state?.ui?.pill;
    if (!popup) return;

    const active = doc.activeElement;
    if (!(active instanceof HTMLElement)) return;
    if (!popup.contains(active)) return;

    if (pill && typeof pill.focus === "function") {
      try {
        pill.focus({ preventScroll: true });
      } catch (_error) {
        pill.focus();
      }
      return;
    }

    if (typeof active.blur === "function") {
      active.blur();
    }
  }

  function triggerAttention(state, entry, deps = {}) {
    const isPillNicknameHiddenFn =
      typeof deps.isPillNicknameHidden === "function"
        ? deps.isPillNicknameHidden
        : () => false;
    const getUnseenActorsForPillFn =
      typeof deps.getUnseenActorsForPill === "function"
        ? deps.getUnseenActorsForPill
        : () => [];
    const attentionDuration = Number(deps.PILL_ATTENTION_DURATION_MS) || 0;

    const pill = state?.ui?.pill;
    if (!pill || state.isOpen || state.unseenCount <= 0) return;
    if (state.settings.pillGlowEnabled !== true) return;
    if (entry && isPillNicknameHiddenFn(entry.nickname)) return;
    if (getUnseenActorsForPillFn().length <= 0) return;

    state.pillCycle.lockUntil = Date.now() + attentionDuration;
    state.pillCycle.index = 0;

    pill.classList.remove("is-attention");
    void pill.offsetWidth;
    pill.classList.add("is-attention");

    clearTimeout(state.attentionTimer);
    state.attentionTimer = setTimeout(() => {
      pill.classList.remove("is-attention");
      state.pillCycle.lockUntil = 0;
    }, attentionDuration);
  }

  function clearAttentionIfNeeded(state) {
    if (state.isOpen || state.unseenCount <= 0) {
      clearTimeout(state.attentionTimer);
      state.pillCycle.lockUntil = 0;
      if (state.ui.pill) state.ui.pill.classList.remove("is-attention");
    }
  }

  function isNearBottom(container) {
    const gap =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return gap < 24;
  }

  function onResizeStart(state, event, deps = {}) {
    const doc = deps.document || document;
    const onResizeMoveFn =
      typeof deps.onResizeMove === "function" ? deps.onResizeMove : () => {};
    const onResizeEndFn =
      typeof deps.onResizeEnd === "function" ? deps.onResizeEnd : () => {};

    if (!state.isOpen) return;
    event.preventDefault();

    state.resize.active = true;
    state.resize.startY = event.clientY;
    state.resize.startHeight = state.popupHeight;

    doc.addEventListener("mousemove", onResizeMoveFn);
    doc.addEventListener("mouseup", onResizeEndFn, { once: true });
  }

  function onResizeMove(state, event, deps = {}) {
    const clampPopupHeightFn =
      typeof deps.clampPopupHeight === "function"
        ? deps.clampPopupHeight
        : (v) => v;
    const applyPopupHeightFn =
      typeof deps.applyPopupHeight === "function"
        ? deps.applyPopupHeight
        : () => {};

    if (!state.resize.active) return;

    const deltaY = event.clientY - state.resize.startY;
    const nextHeight = state.resize.startHeight + deltaY;
    state.popupHeight = clampPopupHeightFn(nextHeight);
    applyPopupHeightFn();
  }

  function onResizeEnd(state, deps = {}) {
    const doc = deps.document || document;
    const onResizeMoveFn =
      typeof deps.onResizeMove === "function" ? deps.onResizeMove : () => {};
    const savePopupHeightFn =
      typeof deps.savePopupHeight === "function"
        ? deps.savePopupHeight
        : () => {};

    state.resize.active = false;
    doc.removeEventListener("mousemove", onResizeMoveFn);
    savePopupHeightFn(state.popupHeight);
  }

  function applyPopupHeight(state, deps = {}) {
    const clampPopupHeightFn =
      typeof deps.clampPopupHeight === "function"
        ? deps.clampPopupHeight
        : (v) => v;
    const applyFilterBarMaxHeightFn =
      typeof deps.applyFilterBarMaxHeight === "function"
        ? deps.applyFilterBarMaxHeight
        : () => {};
    const syncPillPositionForHeaderFn =
      typeof deps.syncPillPositionForHeader === "function"
        ? deps.syncPillPositionForHeader
        : () => {};

    const popup = state?.ui?.popup;
    if (!popup) return;

    state.popupHeight = clampPopupHeightFn(state.popupHeight);
    popup.style.height = `${state.popupHeight}px`;
    if (!state.filterBarCollapsed) {
      applyFilterBarMaxHeightFn();
    }
    syncPillPositionForHeaderFn();
  }

  function clampPopupHeight(state, height, deps = {}) {
    const numeric = Number(height);
    const fallbackDefault = Number(deps.DEFAULT_POPUP_HEIGHT);
    const fallback = Number.isFinite(numeric)
      ? numeric
      : Number.isFinite(fallbackDefault)
        ? fallbackDefault
        : 360;
    const getMaxPopupHeightFn =
      typeof deps.getMaxPopupHeight === "function"
        ? deps.getMaxPopupHeight
        : () => 520;
    const maxHeight = getMaxPopupHeightFn();
    const minPopupHeight = Number(deps.MIN_POPUP_HEIGHT);
    const minHeight = Number.isFinite(minPopupHeight) ? minPopupHeight : 160;
    return Math.max(minHeight, Math.min(Math.round(fallback), maxHeight));
  }

  function getMaxPopupHeight(deps = {}) {
    const doc = deps.document || document;
    const aside =
      doc.querySelector("aside#aside-chatting") ||
      doc.querySelector("[class*='vod_chatting_container']");
    if (!aside) return 520;

    const inputArea =
      aside.querySelector("[class*='live_chatting_area']") ||
      doc.querySelector("[class*='live_chatting_area']");
    if (inputArea && typeof inputArea.getBoundingClientRect === "function") {
      const inputRect = inputArea.getBoundingClientRect();
      const popup = doc.querySelector(".chzzk-badge-moa-popup");
      const root = doc.querySelector(".chzzk-badge-moa-root");
      const popupRect =
        popup && typeof popup.getBoundingClientRect === "function"
          ? popup.getBoundingClientRect()
          : null;
      const rootRect =
        root && typeof root.getBoundingClientRect === "function"
          ? root.getBoundingClientRect()
          : null;
      const popupTop =
        popupRect && popupRect.height > 0
          ? popupRect.top
          : rootRect && rootRect.height > 0
            ? rootRect.bottom - 1
            : null;
      if (
        Number.isFinite(inputRect.top) &&
        Number.isFinite(popupTop) &&
        inputRect.top > popupTop
      ) {
        return Math.max(160, Math.floor(inputRect.top - popupTop - 6));
      }
    }

    return Math.max(160, aside.clientHeight - 86);
  }

  async function loadPopupHeight(state, deps = {}) {
    const getStorageValueFn =
      typeof deps.getStorageValue === "function"
        ? deps.getStorageValue
        : async () => null;
    const clampPopupHeightFn =
      typeof deps.clampPopupHeight === "function"
        ? deps.clampPopupHeight
        : (v) => v;
    const getActiveStorageHeightKeyFn =
      typeof deps.getActiveStorageHeightKey === "function"
        ? deps.getActiveStorageHeightKey
        : () => deps.STORAGE_HEIGHT_KEY;
    const storageKey = getActiveStorageHeightKeyFn();
    const legacyKey = deps.STORAGE_HEIGHT_KEY;
    const defaultHeight = Number(deps.DEFAULT_POPUP_HEIGHT);
    const fallbackDefault = Number.isFinite(defaultHeight)
      ? defaultHeight
      : 360;

    const stored = await getStorageValueFn(storageKey);
    if (Number.isFinite(stored)) {
      return clampPopupHeightFn(stored);
    }
    const skipLegacyFallback = deps.skipLegacyFallback === true;
    if (!skipLegacyFallback && legacyKey && legacyKey !== storageKey) {
      const legacyStored = await getStorageValueFn(legacyKey);
      if (Number.isFinite(legacyStored)) {
        return clampPopupHeightFn(legacyStored);
      }
    }
    return fallbackDefault;
  }

  function savePopupHeight(state, height, deps = {}) {
    const setStorageValueFn =
      typeof deps.setStorageValue === "function"
        ? deps.setStorageValue
        : () => {};
    const clampPopupHeightFn =
      typeof deps.clampPopupHeight === "function"
        ? deps.clampPopupHeight
        : (v) => v;
    const getActiveStorageHeightKeyFn =
      typeof deps.getActiveStorageHeightKey === "function"
        ? deps.getActiveStorageHeightKey
        : () => deps.STORAGE_HEIGHT_KEY;
    const storageKey = getActiveStorageHeightKeyFn();
    setStorageValueFn(storageKey, clampPopupHeightFn(height));
  }

  function normalizeDisplayStyle(style) {
    return style === "inline" ? "inline" : "block";
  }

  async function loadPopupDisplayStyle(state, deps = {}) {
    const getStorageValueFn =
      typeof deps.getStorageValue === "function"
        ? deps.getStorageValue
        : async () => null;
    const normalizeDisplayStyleFn =
      typeof deps.normalizeDisplayStyle === "function"
        ? deps.normalizeDisplayStyle
        : normalizeDisplayStyle;

    const stored = await getStorageValueFn(deps.STORAGE_DISPLAY_STYLE_KEY);
    return normalizeDisplayStyleFn(stored);
  }

  function savePopupDisplayStyle(state, style, deps = {}) {
    const setStorageValueFn =
      typeof deps.setStorageValue === "function"
        ? deps.setStorageValue
        : () => {};
    const normalizeDisplayStyleFn =
      typeof deps.normalizeDisplayStyle === "function"
        ? deps.normalizeDisplayStyle
        : normalizeDisplayStyle;
    setStorageValueFn(
      deps.STORAGE_DISPLAY_STYLE_KEY,
      normalizeDisplayStyleFn(style),
    );
  }

  function setDisplayStyle(state, style, deps = {}) {
    const normalizeDisplayStyleFn =
      typeof deps.normalizeDisplayStyle === "function"
        ? deps.normalizeDisplayStyle
        : normalizeDisplayStyle;
    const savePopupDisplayStyleFn =
      typeof deps.savePopupDisplayStyle === "function"
        ? deps.savePopupDisplayStyle
        : () => {};
    const renderListFn =
      typeof deps.renderList === "function" ? deps.renderList : () => {};

    const nextStyle = normalizeDisplayStyleFn(style);
    if (state.displayStyle === nextStyle) return;

    state.displayStyle = nextStyle;
    savePopupDisplayStyleFn(nextStyle);
    renderListFn(false);
  }

  function normalizePopupFontScale(value, deps = {}) {
    const numeric = Number(value);
    const defaultScale = Number(deps.DEFAULT_POPUP_FONT_SCALE);
    const minScale = Number(deps.MIN_POPUP_FONT_SCALE);
    const maxScale = Number(deps.MAX_POPUP_FONT_SCALE);
    const safeDefault = Number.isFinite(defaultScale) ? defaultScale : 1;
    const safeMin = Number.isFinite(minScale) ? minScale : 0.6;
    const safeMax = Number.isFinite(maxScale) ? maxScale : 1.6;
    if (!Number.isFinite(numeric)) return safeDefault;
    const clamped = Math.min(safeMax, Math.max(safeMin, numeric));
    return Math.round(clamped * 100) / 100;
  }

  function toggleSettingsPanel(state, forceOpen, deps = {}) {
    const renderSettingsPanelFn =
      typeof deps.renderSettingsPanel === "function"
        ? deps.renderSettingsPanel
        : () => {};

    const nextOpen =
      typeof forceOpen === "boolean" ? forceOpen : !state.isSettingsOpen;
    state.isSettingsOpen = nextOpen;

    const settingsButton = state?.ui?.settingsButton;
    const settingsPanel = state?.ui?.settingsPanel;
    if (settingsButton) {
      settingsButton.setAttribute("aria-expanded", String(nextOpen));
    }
    if (settingsPanel) {
      settingsPanel.classList.toggle("is-open", nextOpen);
      if (nextOpen) {
        renderSettingsPanelFn();
      } else {
        settingsPanel.innerHTML = "";
      }
    }
  }

  function applySettingsClasses(state, deps = {}) {
    const doc = deps.document || document;
    const normalizePopupFontScaleFn =
      typeof deps.normalizePopupFontScale === "function"
        ? deps.normalizePopupFontScale
        : (value) => normalizePopupFontScale(value, deps);
    const rootElement =
      doc.documentElement instanceof HTMLElement ? doc.documentElement : null;
    const root = state?.ui?.root;
    const popup = state?.ui?.popup;
    if (rootElement) {
      rootElement.classList.toggle(
        "chzzk-badge-moa-no-chat-bg",
        state.settings.hideChatBackground === true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-no-chat-border",
        state.settings.hideChatBorder === true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-hide-pill",
        state.settings.hidePillButton === true,
      );
    }

    if (!root) return;

    root.classList.toggle(
      "chzzk-badge-moa-no-popup-bg",
      state.settings.hidePopupBackground === true,
    );
    root.classList.toggle(
      "chzzk-badge-moa-no-popup-border",
      state.settings.hidePopupBorder === true,
    );
    const popupFontScale = String(
      normalizePopupFontScaleFn(state.settings.popupFontScale),
    );
    root.style.setProperty("--chzzk-popup-font-scale", popupFontScale);
    if (popup) {
      popup.style.setProperty("--chzzk-popup-font-scale", popupFontScale);
    }
  }

  ns.popupApi = {
    onPillClick,
    openPopup,
    closePopup,
    updatePopupPinStateUi,
    releasePopupFocus,
    triggerAttention,
    clearAttentionIfNeeded,
    isNearBottom,
    onResizeStart,
    onResizeMove,
    onResizeEnd,
    applyPopupHeight,
    clampPopupHeight,
    getMaxPopupHeight,
    loadPopupHeight,
    savePopupHeight,
    loadPopupDisplayStyle,
    savePopupDisplayStyle,
    setDisplayStyle,
    normalizeDisplayStyle,
    normalizePopupFontScale,
    toggleSettingsPanel,
    applySettingsClasses,
  };
})();
