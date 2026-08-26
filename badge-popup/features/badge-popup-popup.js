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
    renderListFn(true);
    renderPillFn();

    schedulePopupLayoutReflow(state, { scrollToBottom: true });
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
    // 모아보기 전용 창에서는 팝업이 곧 창 전체이므로 닫지 않는다.
    if (!immediate && state.isMoaWindow === true) return;
    if (!immediate && state.settings?.keepPopupOpen === true) return;
    if (!immediate && state.popupPinned) return;

    resolveConfirmDialogFn(false);
    state.isOpen = false;
    state._popupOpenScrollToBottom = false;
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
    const keepPopupOpen = state?.settings?.keepPopupOpen === true;
    if (root) {
      root.classList.toggle("is-popup-pinned", state.popupPinned === true);
      root.classList.toggle("is-popup-locked-open", keepPopupOpen);
    }
    if (pinButton) {
      pinButton.disabled = keepPopupOpen;
      pinButton.setAttribute(
        "aria-pressed",
        String(state.popupPinned === true),
      );
      pinButton.setAttribute(
        "aria-label",
        keepPopupOpen
          ? "모아보기 팝업창 항상 펼침 사용 중"
          : state.popupPinned
            ? "배지 채팅 팝업 고정 해제"
            : "배지 채팅 팝업 고정",
      );
      pinButton.title = keepPopupOpen
        ? "항상 펼침 설정 중에는 고정핀을 사용할 수 없습니다"
        : state.popupPinned
          ? "고정됨 - 클릭하여 고정 해제"
          : "팝업창 고정";
    }
    if (closeButton) {
      closeButton.disabled = keepPopupOpen || state.popupPinned === true;
      closeButton.title = keepPopupOpen
        ? "항상 펼침 설정 중에는 닫을 수 없습니다"
        : state.popupPinned
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
    // 사용자가 직접 드래그한 높이는 곧 새 의도 높이다.
    state.popupHeightIntent = clampPopupHeightFn(nextHeight);
    state.popupHeight = state.popupHeightIntent;
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
    const intent = Number.isFinite(Number(state.popupHeightIntent))
      ? state.popupHeightIntent
      : state.popupHeight;
    savePopupHeightFn(intent);
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

    // 사용자가 의도한 높이(popupHeightIntent)를 보존한 채, 현재 가용 공간에 맞춰
    // 표시 높이만 클램프한다. 예전엔 clamp 결과로 popupHeight 자체를 덮어써,
    // 전체화면 등으로 채팅 영역이 잠깐 작아졌을 때 측정된 작은 max 로 높이가
    // 영구히 줄어들고 공간이 돌아와도 복구되지 않았다(와이드 모드 제보 원인).
    if (!Number.isFinite(Number(state.popupHeightIntent))) {
      state.popupHeightIntent = state.popupHeight;
    }
    state.popupHeight = clampPopupHeightFn(state.popupHeightIntent);
    popup.style.height = `${state.popupHeight}px`;
    if (!state.filterBarCollapsed) {
      applyFilterBarMaxHeightFn();
    }
    syncPopupContentHeight(state);
    syncPillPositionForHeaderFn();
  }

  function getRenderedHeight(element) {
    if (!(element instanceof HTMLElement)) return 0;
    const win = element.ownerDocument?.defaultView || window;
    const style = win.getComputedStyle(element);
    if (style.display === "none") return 0;
    return Math.ceil(element.getBoundingClientRect().height || 0);
  }

  function syncPopupContentHeight(state) {
    const popup = state?.ui?.popup;
    const head = state?.ui?.popupHead;
    const filterBar = state?.ui?.filterBar;
    const list = state?.ui?.list;
    const empty = state?.ui?.empty;
    const resizer = state?.ui?.resizer;
    if (!(popup instanceof HTMLElement)) return;

    const popupHeight =
      Math.floor(popup.clientHeight || 0) ||
      Math.floor(Number(state.popupHeight || 0));
    if (!Number.isFinite(popupHeight) || popupHeight <= 0) return;

    const fixedHeight =
      getRenderedHeight(head) +
      getRenderedHeight(filterBar) +
      getRenderedHeight(resizer);
    const contentHeight = Math.max(0, popupHeight - fixedHeight);

    [list, empty].forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.style.flex = `0 1 ${contentHeight}px`;
      element.style.height = `${contentHeight}px`;
      element.style.maxHeight = `${contentHeight}px`;
      element.style.minHeight = "0";
    });
  }

  function isPopupLayoutMisaligned(state) {
    const popup = state?.ui?.popup;
    const head = state?.ui?.popupHead;
    const resizer = state?.ui?.resizer;
    if (
      !(popup instanceof HTMLElement) ||
      !(head instanceof HTMLElement) ||
      !(resizer instanceof HTMLElement)
    ) {
      return false;
    }

    const popupRect = popup.getBoundingClientRect();
    const headRect = head.getBoundingClientRect();
    const resizerRect = resizer.getBoundingClientRect();
    if (
      popupRect.height <= 0 ||
      headRect.height <= 0 ||
      resizerRect.height <= 0
    ) {
      return true;
    }

    const resizerBottomGap = Math.abs(popupRect.bottom - resizerRect.bottom);
    const headEscapedTop = headRect.top < popupRect.top - 2;
    const headEscapedBottom = headRect.bottom > popupRect.bottom + 2;
    return resizerBottomGap > 3 || headEscapedTop || headEscapedBottom;
  }

  function resetPopupLayoutReflow(state) {
    const popup = state?.ui?.popup;
    if (!state?.isOpen || !(popup instanceof HTMLElement)) return;

    const height = Number(state.popupHeight || 0);
    if (!Number.isFinite(height) || height <= 0) return;

    popup.style.height = "";
    if (state.ui?.list instanceof HTMLElement) {
      state.ui.list.style.height = "";
      state.ui.list.style.maxHeight = "";
      state.ui.list.style.flex = "";
    }
    if (state.ui?.empty instanceof HTMLElement) {
      state.ui.empty.style.height = "";
      state.ui.empty.style.maxHeight = "";
      state.ui.empty.style.flex = "";
    }
    void popup.offsetHeight;
    popup.style.height = `${height}px`;
    syncPopupContentHeight(state);
    void popup.offsetHeight;
  }

  function settlePopupLayout(state) {
    const popup = state?.ui?.popup;
    if (!state?.isOpen || !(popup instanceof HTMLElement)) return;

    const height = Number(state.popupHeight || 0);
    if (!Number.isFinite(height) || height <= 0) return;

    popup.style.height = `${height}px`;
    syncPopupContentHeight(state);
    syncPopupOpenScroll(state);
    void popup.offsetHeight;

    if (
      !popup.classList.contains("is-opening") &&
      isPopupLayoutMisaligned(state)
    ) {
      resetPopupLayoutReflow(state);
      syncPopupOpenScroll(state);
    }
  }

  function schedulePopupLayoutReflow(state, options = {}) {
    if (!state) return;
    if (Array.isArray(state._popupLayoutReflowTimers)) {
      state._popupLayoutReflowTimers.forEach((timer) => clearTimeout(timer));
    }
    state._popupLayoutReflowTimers = [];

    state._popupOpenScrollToBottom = options.scrollToBottom === true;

    const run = () => settlePopupLayout(state);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(run);
      });
    } else {
      run();
    }

    // 다시보기 헤더는 채팅 패널의 접힘/마진 조정이 늦게 확정되는 경우가
    // 있어 몇 번 더 동기화한다.
    [60, 180, 360].forEach((delay, index, delays) => {
      const timer = setTimeout(() => {
        run();
        if (index === delays.length - 1) {
          state._popupOpenScrollToBottom = false;
        }
      }, delay);
      state._popupLayoutReflowTimers.push(timer);
    });
  }

  function syncPopupOpenScroll(state) {
    if (state?._popupOpenScrollToBottom !== true) return;
    const list = state?.ui?.list;
    if (!(list instanceof HTMLElement)) return;
    list.scrollTop = list.scrollHeight;
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

  // 채팅 입력 영역(텍스트에어리어가 든 하단 블록)을 찾는다. 클래스명이
  // 빌드마다 바뀌므로 구버전 클래스 → textarea 기반 순으로 탐색한다. 이
  // 영역의 top이 팝업이 펼쳐질 수 있는 하한이다(일반/시네마틱 모드별로 다름).
  function findChatInputArea(aside, doc) {
    const scope = aside instanceof Element ? aside : doc;
    // 구버전
    const legacy =
      (aside && aside.querySelector("[class*='live_chatting_area']")) ||
      doc.querySelector("[class*='live_chatting_area']");
    if (legacy instanceof Element) return legacy;

    // 새 구조: 채팅 입력 textarea가 든 하단 블록.
    const textarea =
      scope.querySelector("textarea[class*='_input_']") ||
      scope.querySelector("textarea[placeholder*='채팅']") ||
      scope.querySelector("textarea");
    if (textarea instanceof Element) {
      // textarea를 감싼 입력 영역 컨테이너(_area_ 등)를 우선 반환.
      const areaWrap =
        textarea.closest("[class*='_area_']") ||
        textarea.closest("[class*='_container_']") ||
        textarea.parentElement;
      if (areaWrap instanceof Element && (!aside || aside.contains(areaWrap))) {
        return areaWrap;
      }
      return textarea;
    }
    return null;
  }

  function getMaxPopupHeight(deps = {}) {
    const doc = deps.document || document;
    const aside =
      doc.querySelector("aside#aside-chatting") ||
      doc.querySelector("aside#vod-aside") ||
      doc.querySelector("[class*='vod_chatting_container']");
    if (!aside) return 520;

    const inputArea = findChatInputArea(aside, doc);
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

    // 새 다시보기(aside#vod-aside)는 채팅 입력 영역이 없다. 팝업 상단(=헤더
    // 아래)부터 "다시보기 채팅 패널의 하단"까지를 가용 높이로 잡는다. 패널
    // 하단은 채팅 리스트 컨테이너 → aside → 뷰포트 순으로 신뢰도가 높은 값을
    // 사용한다(뷰포트로만 잡으면 패널 아래 영역까지 드래그되는 문제 발생).
    if (aside.id === "vod-aside") {
      const viewportHeight = Number(
        (deps.window || window).innerHeight ||
          doc.documentElement.clientHeight ||
          0,
      );
      const root = doc.querySelector(".chzzk-badge-moa-root");
      const popup = doc.querySelector(".chzzk-badge-moa-popup");
      const rootRect =
        root && typeof root.getBoundingClientRect === "function"
          ? root.getBoundingClientRect()
          : null;
      const popupRect =
        popup && typeof popup.getBoundingClientRect === "function"
          ? popup.getBoundingClientRect()
          : null;
      const popupTop =
        popupRect && popupRect.height > 0
          ? popupRect.top
          : rootRect && rootRect.height > 0
            ? rootRect.bottom
            : null;

      // 패널 하단 후보: 채팅 리스트 컨테이너 → aside rect → 뷰포트.
      const listEl =
        aside.querySelector("[role='log']") ||
        aside.querySelector("[class*='_list_']");
      const listRect =
        listEl && typeof listEl.getBoundingClientRect === "function"
          ? listEl.getBoundingClientRect()
          : null;
      const asideRect =
        typeof aside.getBoundingClientRect === "function"
          ? aside.getBoundingClientRect()
          : null;

      const candidates = [];
      if (listRect && listRect.bottom > 0) candidates.push(listRect.bottom);
      if (asideRect && asideRect.bottom > 0) candidates.push(asideRect.bottom);
      if (viewportHeight > 0) candidates.push(viewportHeight);
      // 패널 하단은 가장 위(작은 값)를 택해 패널 밖으로 넘치지 않게 한다.
      // 단, popupTop보다는 충분히 아래여야 하므로 popupTop+160 미만은 제외.
      const bottomLimit = candidates
        .filter((value) => Number.isFinite(popupTop) && value > popupTop + 160)
        .reduce((min, value) => (value < min ? value : min), Infinity);

      if (Number.isFinite(popupTop) && Number.isFinite(bottomLimit)) {
        return Math.max(160, Math.floor(bottomLimit - popupTop - 24));
      }
      if (viewportHeight > 0 && Number.isFinite(popupTop)) {
        return Math.max(160, Math.floor(viewportHeight - popupTop - 24));
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
    const isNearBottomFn =
      typeof deps.isNearBottom === "function"
        ? deps.isNearBottom
        : isNearBottom;

    const nextStyle = normalizeDisplayStyleFn(style);
    if (state.displayStyle === nextStyle) return;

    const list = state?.ui?.list;
    const preserveBottom = list ? isNearBottomFn(list) : false;

    state.displayStyle = nextStyle;
    savePopupDisplayStyleFn(nextStyle);
    renderListFn(preserveBottom ? "preserve-bottom" : false);
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

  function normalizeChatWidth(value, deps = {}) {
    const numeric = Number(value);
    const minWidth = Number(deps.MIN_CHAT_WIDTH);
    const safeMin = Number.isFinite(minWidth) ? minWidth : 220;
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.max(safeMin, Math.round(numeric));
  }

  function getMinChatWidth(deps = {}) {
    const minWidth = Number(deps.MIN_CHAT_WIDTH);
    return Number.isFinite(minWidth) ? minWidth : 220;
  }

  function clampChatWidth(value, deps = {}) {
    const numeric = Number(value);
    const safeMin = getMinChatWidth(deps);
    const maxWidth = Number(deps.maxWidth);
    const safeMax =
      Number.isFinite(maxWidth) && maxWidth > 0
        ? Math.max(safeMin, Math.floor(maxWidth))
        : Infinity;
    if (!Number.isFinite(numeric) || numeric <= 0) return safeMin;
    return Math.min(safeMax, Math.max(safeMin, Math.round(numeric)));
  }

  function getVodMaxChatWidth(doc, aside, deps = {}) {
    if (!(aside instanceof HTMLElement) || aside.id !== "vod-aside") {
      return Infinity;
    }
    const scope = doc || document;
    const player =
      aside.querySelector("[class*='_player_']") ||
      scope.querySelector("aside#vod-aside [class*='_player_']") ||
      scope.querySelector("[class*='_player_']");
    const title =
      scope.querySelector(
        "aside#vod-aside [class*='_player_'] + [class*='_area_'] " +
          "[class*='_content_'] [class*='_content_left_'] " +
          "[class*='_details_'] [class*='_container_'] " +
          "[class*='_row_'] h2[class*='_title_']",
      ) ||
      scope.querySelector(
        "[class*='_player_'] + [class*='_area_'] " +
          "[class*='_content_'] [class*='_content_left_'] " +
          "[class*='_details_'] [class*='_container_'] " +
          "[class*='_row_'] h2[class*='_title_']",
      );
    if (!(player instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      return Infinity;
    }

    const playerRect = player.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const maxWidth = Math.floor(
      Number(playerRect.width || 0) - Number(titleRect.width || 0) - 55,
    );
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) return Infinity;
    return Math.max(getMinChatWidth(deps), maxWidth);
  }

  function getMaxChatWidth(doc, deps = {}, aside = null) {
    const vodMaxWidth = getVodMaxChatWidth(doc, aside, deps);
    if (Number.isFinite(vodMaxWidth)) return vodMaxWidth;

    const scope = doc || document;
    const container = scope.querySelector(
      'div#layout-body[aria-label="콘텐츠"] section[class*="_container_"]',
    );
    if (!(container instanceof HTMLElement)) return Infinity;

    const rect = container.getBoundingClientRect();
    const maxWidth = Math.floor(Number(rect.width || 0) - 275);
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) return Infinity;
    return Math.max(getMinChatWidth(deps), maxWidth);
  }

  function findResizableChatAside(doc) {
    const scope = doc || document;
    const aside =
      scope.querySelector("aside#aside-chatting") ||
      scope.querySelector("aside#vod-aside");
    if (isStandaloneChatPopupAside(aside)) return null;
    return aside instanceof HTMLElement ? aside : null;
  }

  function isStandaloneChatPopupAside(aside) {
    if (!(aside instanceof HTMLElement)) return false;
    if (aside.id !== "aside-chatting") return false;
    return String(aside.className || "").includes("_is_popup_chat_");
  }

  function isStandaloneChatPopupDocument(doc = document) {
    const scope = doc || document;
    if (
      isStandaloneChatPopupAside(scope.querySelector("aside#aside-chatting"))
    ) {
      return true;
    }
    const location = scope.defaultView?.location || window.location;
    return /\/live\/[^/?#]+\/chat(?:[/?#]|$)/.test(
      String(location?.pathname || ""),
    );
  }

  function isChatAsideLeftPositionEnabled(state, aside) {
    return (
      state?.settings?.placeChatOnLeft === true &&
      aside instanceof HTMLElement &&
      aside.id === "aside-chatting" &&
      !isStandaloneChatPopupAside(aside)
    );
  }

  function getEffectiveChatFontScale(doc, chatFontScale) {
    const numeric = Number(chatFontScale);
    if (!Number.isFinite(numeric)) return 1;
    if (isStandaloneChatPopupDocument(doc)) {
      return Math.min(1, numeric);
    }
    return numeric;
  }

  function isChatWidthStackedLayout(doc, targetAside = null) {
    const scope = doc || document;
    const aside =
      targetAside instanceof HTMLElement
        ? targetAside
        : findResizableChatAside(scope);
    if (!(aside instanceof HTMLElement)) return false;

    const view = scope.defaultView || window;

    // 1차: 영상/채팅을 감싸는 플렉스 래퍼(_wrapper_gzfy8_)가 세로(column)로 쌓였는지로
    // 판정한다. 치지직이 @media (aspect-ratio <= 1/1) 에서 flex-direction:column 을
    // 주므로, 우리가 채팅창 폭을 강제로 줄여 놨더라도 영향받지 않는 신뢰 가능한 신호다.
    let node = aside.parentElement;
    while (node instanceof HTMLElement && node !== scope.documentElement) {
      const className = String(node.className || "");
      if (className.includes("_wrapper_") || className.includes("layout-body")) {
        const style = view.getComputedStyle
          ? view.getComputedStyle(node)
          : null;
        if (style) {
          const direction = String(style.flexDirection || "");
          if (style.display.includes("flex") && direction.startsWith("column")) {
            return true;
          }
        }
      }
      node = node.parentElement;
    }

    // 2차(폴백): 채팅 aside 가 콘텐츠 영역보다 아래에 위치하면 세로 배치로 본다.
    // (폭 비교는 우리가 폭을 줄여 놓으면 깨지므로 위치만 본다.)
    const container = scope.querySelector(
      'div#layout-body[aria-label="콘텐츠"] section[class*="_container_"]',
    );
    if (container instanceof HTMLElement) {
      const asideRect = aside.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (asideRect.top > containerRect.top + 40) return true;
    }
    return false;
  }

  function setChatAsideWidth(aside, width, deps = {}) {
    if (!(aside instanceof HTMLElement)) return;
    const normalizeChatWidthFn =
      typeof deps.normalizeChatWidth === "function"
        ? deps.normalizeChatWidth
        : (value) => normalizeChatWidth(value, deps);
    const nextWidth = clampChatWidth(normalizeChatWidthFn(width), deps);
    aside.style.setProperty("width", `${nextWidth}px`, "important");
    aside.style.setProperty("flex-basis", `${nextWidth}px`, "important");
    aside.style.setProperty(
      "min-width",
      `${getMinChatWidth(deps)}px`,
      "important",
    );
    syncChatResizeCssVars(aside, nextWidth, deps);
    syncLiveMiniPlayerSize(aside, nextWidth, deps);
  }

  function resetChatAsideWidth(aside) {
    if (!(aside instanceof HTMLElement)) return;
    resetVodBannerWidth(aside);
    resetChatResizeCssVars(aside, { document });
    resetLiveMiniPlayerSize(aside, { document });
    aside.style.removeProperty("width");
    aside.style.removeProperty("flex-basis");
    aside.style.removeProperty("min-width");
  }

  function getLiveMiniPlayerHeight(width) {
    const numeric = Number(width);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.max(1, Math.round((numeric * 206) / 353));
  }

  function syncChatResizeCssVars(aside, width, deps = {}) {
    if (!(aside instanceof HTMLElement)) return;
    const doc = deps.document || document;
    const root = doc.documentElement;
    if (!(root instanceof HTMLElement)) return;
    const numeric = Math.round(Number(width || 0));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    root.style.setProperty(
      "--chzzk-badge-moa-chat-resized-width",
      `${numeric}px`,
    );
    root.style.setProperty(
      "--chzzk-badge-moa-chat-profile-popup-width",
      `${Math.max(1, numeric - 12)}px`,
    );
    root.style.setProperty(
      "--chzzk-badge-moa-chat-popover-width",
      `${Math.max(1, numeric - 16)}px`,
    );
  }

  function resetChatResizeCssVars(aside, deps = {}) {
    if (!(aside instanceof HTMLElement)) return;
    const doc = deps.document || document;
    const root = doc.documentElement;
    if (!(root instanceof HTMLElement)) return;
    root.style.removeProperty("--chzzk-badge-moa-chat-resized-width");
    root.style.removeProperty("--chzzk-badge-moa-chat-profile-popup-width");
    root.style.removeProperty("--chzzk-badge-moa-chat-popover-width");
  }

  function syncLiveMiniPlayerSize(aside, width, deps = {}) {
    if (!(aside instanceof HTMLElement) || aside.id !== "aside-chatting") {
      return;
    }
    const doc = deps.document || document;
    const root = doc.documentElement;
    if (!(root instanceof HTMLElement)) return;
    const numeric = Math.round(Number(width || 0));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    root.style.setProperty(
      "--chzzk-badge-moa-live-miniplayer-height",
      `${getLiveMiniPlayerHeight(numeric)}px`,
    );
  }

  function resetLiveMiniPlayerSize(aside, deps = {}) {
    if (!(aside instanceof HTMLElement) || aside.id !== "aside-chatting") {
      return;
    }
    const doc = deps.document || document;
    const root = doc.documentElement;
    if (!(root instanceof HTMLElement)) return;
    root.style.removeProperty("--chzzk-badge-moa-live-miniplayer-height");
  }

  function getVodBannerScope(aside) {
    if (!(aside instanceof HTMLElement) || aside.id !== "vod-aside")
      return null;
    const candidates = [];
    let current = aside;
    while (current instanceof HTMLElement && candidates.length < 8) {
      candidates.push(current);
      current = current.parentElement;
    }
    return (
      candidates.find((element) => {
        if (
          element.querySelector("[class*='_container_'][class*='_banner_']")
        ) {
          return true;
        }
        if (element.querySelector("#vod_rs_banner")) return true;
        return false;
      }) || aside
    );
  }

  function resetHeaderBannerWidth(doc = document) {
    const header = doc.querySelector(
      "header#header, header[aria-label='헤더']",
    );
    if (!(header instanceof HTMLElement)) return;
    header.querySelectorAll("[class*='_banner_']").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.style.removeProperty("width");
      element.style.removeProperty("max-width");
      element.style.removeProperty("min-width");
      element.style.removeProperty("box-sizing");
    });
  }

  function applyVodBannerWidthStyle(aside, callback) {
    resetHeaderBannerWidth(aside.ownerDocument || document);
    const scope = getVodBannerScope(aside);
    if (!(scope instanceof HTMLElement)) return;

    const selectors = [
      "[class*='_container_'][class*='_banner_']",
      "#vod_rs_banner",
      "#vod_rs_banner > div",
      "#vod_rs_banner iframe",
    ];
    selectors.forEach((selector) => {
      scope.querySelectorAll(selector).forEach((element) => {
        if (element instanceof HTMLElement) {
          callback(element);
        }
      });
    });
  }

  function syncVodBannerWidth(aside) {
    if (!(aside instanceof HTMLElement) || aside.id !== "vod-aside") return;
    const width = Math.round(Number(aside.getBoundingClientRect().width || 0));
    if (!Number.isFinite(width) || width <= 0) return;

    applyVodBannerWidthStyle(aside, (element) => {
      element.style.setProperty("width", `${width}px`, "important");
      element.style.setProperty("max-width", `${width}px`, "important");
      element.style.setProperty("min-width", "0", "important");
      element.style.setProperty("box-sizing", "border-box", "important");
    });
  }

  function resetVodBannerWidth(aside) {
    applyVodBannerWidthStyle(aside, (element) => {
      element.style.removeProperty("width");
      element.style.removeProperty("max-width");
      element.style.removeProperty("min-width");
      element.style.removeProperty("box-sizing");
    });
  }

  function isTextareaElement(element) {
    return (
      element instanceof Element &&
      String(element.tagName || "").toLowerCase() === "textarea"
    );
  }

  function findLiveChatInputTextarea(aside) {
    if (!(aside instanceof Element)) return null;
    const textarea =
      aside.querySelector("textarea[placeholder*='채팅을 입력해주세요']") ||
      aside.querySelector("textarea[class*='_input_']") ||
      aside.querySelector("textarea[placeholder*='채팅']");
    return isTextareaElement(textarea) ? textarea : null;
  }

  function normalizeLiveChatInputHeight(aside, doc = document) {
    const textarea = findLiveChatInputTextarea(aside);
    if (!isTextareaElement(textarea)) return;
    if (!String(textarea.placeholder || "").includes("채팅")) {
      return;
    }
    if (String(textarea.value || "").length > 0) return;
    if (doc.activeElement === textarea) return;

    const currentHeight = textarea.style.getPropertyValue("height");
    const currentPriority = textarea.style.getPropertyPriority("height");
    if (currentHeight === "40px" && currentPriority === "important") return;
    textarea.style.setProperty("height", "40px", "important");
  }

  function cleanupChatInputHeightWatcher(resizeState) {
    if (!resizeState) return;
    if (resizeState.inputHeightObserver) {
      resizeState.inputHeightObserver.disconnect();
      resizeState.inputHeightObserver = null;
    }
    if (resizeState.inputHeightAside instanceof HTMLElement) {
      if (resizeState.inputHeightBlurHandler) {
        resizeState.inputHeightAside.removeEventListener(
          "blur",
          resizeState.inputHeightBlurHandler,
          true,
        );
        resizeState.inputHeightAside.removeEventListener(
          "focusout",
          resizeState.inputHeightBlurHandler,
          true,
        );
      }
    }
    if (resizeState.inputHeightTimer) {
      clearTimeout(resizeState.inputHeightTimer);
      resizeState.inputHeightTimer = null;
    }
    resizeState.inputHeightAside = null;
    resizeState.inputHeightObservedElement = null;
    resizeState.inputHeightBlurHandler = null;
  }

  function syncChatInputHeightWatcher(state, aside, deps = {}) {
    const resizeState = state?.chatWidthResize;
    if (!resizeState || !(aside instanceof HTMLElement)) return;
    const doc = deps.document || document;

    const isVodAside = aside.id === "vod-aside";
    const observeTarget = isVodAside
      ? getVodBannerScope(aside) || aside
      : findLiveChatInputTextarea(aside);

    if (
      resizeState.inputHeightAside === aside &&
      resizeState.inputHeightObservedElement === observeTarget
    ) {
      syncVodBannerWidth(aside);
      normalizeLiveChatInputHeight(aside, doc);
      return;
    }

    cleanupChatInputHeightWatcher(resizeState);

    const scheduleNormalize = () => {
      if (resizeState.inputHeightTimer) {
        clearTimeout(resizeState.inputHeightTimer);
      }
      syncVodBannerWidth(aside);
      normalizeLiveChatInputHeight(aside, doc);
      resizeState.inputHeightTimer = setTimeout(() => {
        resizeState.inputHeightTimer = null;
        syncVodBannerWidth(aside);
        normalizeLiveChatInputHeight(aside, doc);
      }, 80);
    };

    const observer =
      isVodAside &&
      observeTarget instanceof HTMLElement &&
      typeof MutationObserver === "function"
        ? new MutationObserver((mutations) => {
            if (
              mutations.some((mutation) => {
                if (mutation.type === "childList") return true;
                return (
                  mutation.type === "attributes" &&
                  mutation.attributeName === "style" &&
                  mutation.target instanceof HTMLElement
                );
              })
            ) {
              scheduleNormalize();
            }
          })
        : null;
    if (observer) {
      observer.observe(observeTarget, {
        subtree: isVodAside,
        childList: isVodAside,
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    const onInputOrBlur = () => scheduleNormalize();
    aside.addEventListener("blur", onInputOrBlur, true);
    aside.addEventListener("focusout", onInputOrBlur, true);

    resizeState.inputHeightObserver = observer;
    resizeState.inputHeightAside = aside;
    resizeState.inputHeightObservedElement = observeTarget;
    resizeState.inputHeightBlurHandler = onInputOrBlur;
    scheduleNormalize();
  }

  function cleanupChatWidthResize(state, options = {}) {
    const resizeState = state?.chatWidthResize;
    if (!resizeState) return;
    const doc = options.document || document;

    if (resizeState.moveHandler) {
      doc.removeEventListener("mousemove", resizeState.moveHandler, true);
    }
    if (resizeState.upHandler) {
      doc.removeEventListener("mouseup", resizeState.upHandler, true);
    }
    if (resizeState.handle && resizeState.handle.parentNode) {
      resizeState.handle.parentNode.removeChild(resizeState.handle);
    }
    cleanupChatInputHeightWatcher(resizeState);
    if (options.resetWidth === true) {
      resetChatAsideWidth(resizeState.aside);
    }
    if (doc.documentElement instanceof HTMLElement) {
      doc.documentElement.classList.remove("chzzk-badge-moa-chat-resizing");
    }

    resizeState.handle = null;
    resizeState.aside = null;
    resizeState.active = false;
    resizeState.startX = 0;
    resizeState.startWidth = 220;
    resizeState.moveHandler = null;
    resizeState.upHandler = null;
  }

  function syncChatWidthResize(state, deps = {}) {
    const doc = deps.document || document;
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const syncPillPositionForHeaderFn =
      typeof deps.syncPillPositionForHeader === "function"
        ? deps.syncPillPositionForHeader
        : () => {};
    const normalizeChatWidthFn =
      typeof deps.normalizeChatWidth === "function"
        ? deps.normalizeChatWidth
        : (value) => normalizeChatWidth(value, deps);
    const rootElement =
      doc.documentElement instanceof HTMLElement ? doc.documentElement : null;
    const enabled = state?.settings?.enableChatWidthResize === true;
    const aside = findResizableChatAside(doc);
    const stackedLayout = isChatWidthStackedLayout(doc, aside);
    const placeChatOnLeft = isChatAsideLeftPositionEnabled(state, aside);
    if (rootElement) {
      rootElement.classList.toggle(
        "chzzk-badge-moa-chat-width-resize-enabled",
        enabled && !stackedLayout && aside instanceof HTMLElement,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-chat-left-position",
        placeChatOnLeft && !stackedLayout,
      );
    }

    if (!enabled || stackedLayout) {
      // 세로(위아래) 배치에서는 조절된 폭이 남아 영상과 너비가 어긋나므로,
      // resizeState.aside 가 비어 있어도 현재 aside 폭을 직접 원복한다.
      if (stackedLayout) resetChatAsideWidth(aside);
      cleanupChatWidthResize(state, { document: doc, resetWidth: true });
      return;
    }

    if (!(aside instanceof HTMLElement)) {
      cleanupChatWidthResize(state, { document: doc, resetWidth: true });
      return;
    }

    const resizeState = state.chatWidthResize;
    if (!resizeState) return;

    if (
      resizeState.aside instanceof HTMLElement &&
      resizeState.aside !== aside
    ) {
      cleanupChatWidthResize(state, { document: doc, resetWidth: false });
    }

    const maxWidth = getMaxChatWidth(doc, deps, aside);
    const savedWidth = normalizeChatWidthFn(state.settings.chatWidth);
    const currentWidth = aside.getBoundingClientRect().width;
    const appliedWidth =
      savedWidth > 0
        ? clampChatWidth(savedWidth, { ...deps, maxWidth })
        : clampChatWidth(currentWidth, { ...deps, maxWidth });
    state.settings.chatWidth = savedWidth;
    setChatAsideWidth(aside, appliedWidth, {
      normalizeChatWidth: normalizeChatWidthFn,
      maxWidth,
      MIN_CHAT_WIDTH: deps.MIN_CHAT_WIDTH,
    });
    syncVodBannerWidth(aside);
    if (aside.id === "vod-aside") {
      syncPillPositionForHeaderFn();
    }
    syncChatInputHeightWatcher(state, aside, deps);

    if (
      resizeState.handle instanceof HTMLElement &&
      resizeState.handle.isConnected &&
      resizeState.aside === aside
    ) {
      resizeState.handle.setAttribute(
        "aria-valuemin",
        String(getMinChatWidth(deps)),
      );
      if (Number.isFinite(maxWidth)) {
        resizeState.handle.setAttribute(
          "aria-valuemax",
          String(Math.floor(maxWidth)),
        );
      } else {
        resizeState.handle.removeAttribute("aria-valuemax");
      }
      resizeState.handle.setAttribute("aria-valuenow", String(appliedWidth));
      return;
    }

    const handle = doc.createElement("div");
    handle.className = "chzzk-badge-moa-chat-width-resizer";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", "채팅창 넓이 조절");
    handle.setAttribute("aria-valuemin", String(getMinChatWidth(deps)));
    if (Number.isFinite(maxWidth)) {
      handle.setAttribute("aria-valuemax", String(Math.floor(maxWidth)));
    }
    handle.setAttribute("aria-valuenow", String(appliedWidth));
    handle.title = "채팅창 넓이 조절";

    const onMouseMove = (event) => {
      if (!resizeState.active) return;
      event.preventDefault();
      const deltaX = Number(event.clientX || 0) - resizeState.startX;
      const direction = isChatAsideLeftPositionEnabled(state, aside) ? 1 : -1;
      const dragMaxWidth = getMaxChatWidth(doc, deps, aside);
      const nextWidth = clampChatWidth(resizeState.startWidth + deltaX * direction, {
        ...deps,
        maxWidth: dragMaxWidth,
      });
      state.settings.chatWidth = nextWidth;
      setChatAsideWidth(aside, nextWidth, {
        normalizeChatWidth: normalizeChatWidthFn,
        maxWidth: dragMaxWidth,
        MIN_CHAT_WIDTH: deps.MIN_CHAT_WIDTH,
      });
      syncVodBannerWidth(aside);
      if (aside.id === "vod-aside") {
        syncPillPositionForHeaderFn();
      }
      if (Number.isFinite(dragMaxWidth)) {
        handle.setAttribute("aria-valuemax", String(Math.floor(dragMaxWidth)));
      } else {
        handle.removeAttribute("aria-valuemax");
      }
      handle.setAttribute("aria-valuenow", String(nextWidth));
    };

    const onMouseUp = () => {
      if (!resizeState.active) return;
      resizeState.active = false;
      if (rootElement) {
        rootElement.classList.remove("chzzk-badge-moa-chat-resizing");
      }
      saveSettingsFn();
    };

    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = aside.getBoundingClientRect();
      resizeState.active = true;
      resizeState.startX = Number(event.clientX || 0);
      resizeState.startWidth = clampChatWidth(rect.width || appliedWidth, {
        ...deps,
        maxWidth: getMaxChatWidth(doc, deps, aside),
      });
      if (rootElement) {
        rootElement.classList.add("chzzk-badge-moa-chat-resizing");
      }
    });

    doc.addEventListener("mousemove", onMouseMove, true);
    doc.addEventListener("mouseup", onMouseUp, true);
    aside.appendChild(handle);

    resizeState.handle = handle;
    resizeState.aside = aside;
    resizeState.moveHandler = onMouseMove;
    resizeState.upHandler = onMouseUp;
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
    const normalizeChatFontScaleFn =
      typeof deps.normalizeChatFontScale === "function"
        ? deps.normalizeChatFontScale
        : normalizePopupFontScaleFn;
    const applyHiddenChatElementsFn =
      typeof deps.applyHiddenChatElements === "function"
        ? deps.applyHiddenChatElements
        : () => {};
    const syncPopupFontScaleControlFn =
      typeof deps.syncPopupFontScaleControl === "function"
        ? deps.syncPopupFontScaleControl
        : () => {};
    const rootElement =
      doc.documentElement instanceof HTMLElement ? doc.documentElement : null;
    const root = state?.ui?.root;
    const popup = state?.ui?.popup;
    const chatFontScale = getEffectiveChatFontScale(
      doc,
      normalizeChatFontScaleFn(state.settings.chatFontScale),
    );
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
      rootElement.classList.toggle(
        "chzzk-badge-moa-chat-left-position",
        isChatAsideLeftPositionEnabled(
          state,
          findResizableChatAside(doc),
        ) && !isChatWidthStackedLayout(doc),
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-keep-popup-open",
        state.settings.keepPopupOpen === true &&
          state.settings.hidePillButton !== true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-hide-chat-ranking",
        state.settings.hideChatRanking === true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-hide-chat-mission",
        state.settings.hideChatMission === true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-hide-chat-mission-message",
        state.settings.hideChatMissionMessage === true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-hide-chat-prediction",
        state.settings.hideChatPrediction === true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-hide-chat-subscription",
        state.settings.hideChatSubscription === true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-hide-chat-donation",
        state.settings.hideChatDonation === true,
      );
      rootElement.classList.toggle(
        "chzzk-badge-moa-chat-font-scale-enabled",
        Math.abs(Number(chatFontScale) - 1) > 0.001,
      );
      rootElement.classList.add("chzzk-badge-moa-chat-font-scale-ready");
      rootElement.style.setProperty(
        "--chzzk-badge-moa-chat-font-scale",
        String(chatFontScale),
      );
    }
    syncChatWidthResize(state, deps);
    applyHiddenChatElementsFn();

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
    syncPopupFontScaleControlFn();
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
    syncPopupContentHeight,
    clampPopupHeight,
    getMaxPopupHeight,
    loadPopupHeight,
    savePopupHeight,
    loadPopupDisplayStyle,
    savePopupDisplayStyle,
    setDisplayStyle,
    normalizeDisplayStyle,
    normalizePopupFontScale,
    normalizeChatWidth,
    toggleSettingsPanel,
    applySettingsClasses,
    syncChatWidthResize,
  };
})();
