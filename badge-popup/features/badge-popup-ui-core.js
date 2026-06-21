(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.uiCoreApi && typeof ns.uiCoreApi === "object") return;

  function ensureUi(state, deps = {}) {
    const findLiveChatHeader =
      typeof deps.findLiveChatHeader === "function"
        ? deps.findLiveChatHeader
        : () => null;
    const cleanupDetachedUi =
      typeof deps.cleanupDetachedUi === "function"
        ? deps.cleanupDetachedUi
        : () => {};
    const refreshChatHighlightObserver =
      typeof deps.refreshChatHighlightObserver === "function"
        ? deps.refreshChatHighlightObserver
        : () => {};
    const isVodChatHeader =
      typeof deps.isVodChatHeader === "function"
        ? deps.isVodChatHeader
        : () => false;
    const applyPopupHeight =
      typeof deps.applyPopupHeight === "function"
        ? deps.applyPopupHeight
        : () => {};
    const syncPillPositionForHeader =
      typeof deps.syncPillPositionForHeader === "function"
        ? deps.syncPillPositionForHeader
        : () => {};
    const teardownUi =
      typeof deps.teardownUi === "function" ? deps.teardownUi : () => {};
    const setViewModeButtonContent =
      typeof deps.setViewModeButtonContent === "function"
        ? deps.setViewModeButtonContent
        : () => {};
    const setPopupActionButtonContent =
      typeof deps.setPopupActionButtonContent === "function"
        ? deps.setPopupActionButtonContent
        : () => {};
    const onPillClick =
      typeof deps.onPillClick === "function" ? deps.onPillClick : () => {};
    const closePopup =
      typeof deps.closePopup === "function" ? deps.closePopup : () => {};
    const setDisplayStyle =
      typeof deps.setDisplayStyle === "function"
        ? deps.setDisplayStyle
        : () => {};
    const renderList =
      typeof deps.renderList === "function" ? deps.renderList : () => {};
    const updatePopupPinStateUi =
      typeof deps.updatePopupPinStateUi === "function"
        ? deps.updatePopupPinStateUi
        : () => {};
    const onResizeStart =
      typeof deps.onResizeStart === "function" ? deps.onResizeStart : () => {};
    const resolveConfirmDialog =
      typeof deps.resolveConfirmDialog === "function"
        ? deps.resolveConfirmDialog
        : () => {};
    const updateViewModeButtons =
      typeof deps.updateViewModeButtons === "function"
        ? deps.updateViewModeButtons
        : () => {};
    const applySettingsClasses =
      typeof deps.applySettingsClasses === "function"
        ? deps.applySettingsClasses
        : () => {};
    const render = typeof deps.render === "function" ? deps.render : () => {};
    const scheduleChatHighlightScan =
      typeof deps.scheduleChatHighlightScan === "function"
        ? deps.scheduleChatHighlightScan
        : () => {};

    const header = findLiveChatHeader();
    if (!header) {
      cleanupDetachedUi();
      refreshChatHighlightObserver();
      return;
    }

    const isVodHeader = isVodChatHeader(header);

    if (
      state.ui.root &&
      state.ui.header === header &&
      header.contains(state.ui.root)
    ) {
      state.ui.root.classList.toggle("is-vod-header", isVodHeader);
      applyPopupHeight();
      syncPillPositionForHeader();
      return;
    }

    teardownUi();

    const root = document.createElement("div");
    root.className = "chzzk-badge-moa-root";
    root.classList.toggle("is-vod-header", isVodHeader);

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "chzzk-badge-moa-pill";
    pill.setAttribute("aria-expanded", "false");

    const iconWrap = document.createElement("span");
    iconWrap.className = "chzzk-badge-moa-pill-icon-wrap";

    const text = document.createElement("span");
    text.className = "chzzk-badge-moa-pill-text";

    const count = document.createElement("span");
    count.className = "chzzk-badge-moa-pill-count";

    pill.append(iconWrap, text, count);

    const popup = document.createElement("section");
    popup.className = "chzzk-badge-moa-popup";
    popup.setAttribute("aria-hidden", "true");
    popup.setAttribute("inert", "");

    const popupHead = document.createElement("div");
    popupHead.className = "chzzk-badge-moa-popup-head";

    const headTop = document.createElement("div");
    headTop.className = "chzzk-badge-moa-popup-head-top";

    const headBottom = document.createElement("div");
    headBottom.className = "chzzk-badge-moa-popup-head-bottom";

    const title = document.createElement("strong");
    title.textContent = "배지 채팅 모아보기";

    const actionWrap = document.createElement("div");
    actionWrap.className = "chzzk-badge-moa-popup-actions";

    const subActionWrap = document.createElement("div");
    subActionWrap.className = "chzzk-badge-moa-popup-subactions";

    const viewModeWrap = document.createElement("div");
    viewModeWrap.className = "chzzk-badge-moa-popup-view-modes";

    const inlineButton = document.createElement("button");
    inlineButton.type = "button";
    inlineButton.className = "chzzk-badge-moa-view-mode-btn";
    inlineButton.dataset.mode = "inline";
    setViewModeButtonContent(inlineButton, "inline");

    const blockButton = document.createElement("button");
    blockButton.type = "button";
    blockButton.className = "chzzk-badge-moa-view-mode-btn";
    blockButton.dataset.mode = "block";
    setViewModeButtonContent(blockButton, "block");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "chzzk-badge-moa-popup-close";
    closeButton.setAttribute("aria-label", "배지 채팅 팝업 닫기");
    closeButton.title = "팝업 닫기";
    setPopupActionButtonContent(closeButton, "close");

    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "chzzk-badge-moa-popup-pin";
    pinButton.setAttribute("aria-label", "배지 채팅 팝업 고정");
    pinButton.title = "팝업창 고정";
    setPopupActionButtonContent(pinButton, "pin");
    pinButton.setAttribute("aria-pressed", "false");

    const filterToggleButton = document.createElement("button");
    filterToggleButton.type = "button";
    filterToggleButton.className = "chzzk-badge-moa-popup-filter-toggle";
    filterToggleButton.setAttribute("aria-expanded", "false");
    filterToggleButton.textContent = "필터 펴기";

    viewModeWrap.append(inlineButton, blockButton);
    actionWrap.append(pinButton, closeButton);
    subActionWrap.append(viewModeWrap, filterToggleButton);
    headTop.append(title, actionWrap);
    headBottom.append(subActionWrap);
    popupHead.append(headTop, headBottom);

    const list = document.createElement("div");
    list.className = "chzzk-badge-moa-popup-list";

    const filterBar = document.createElement("div");
    filterBar.className = "chzzk-badge-moa-popup-filters";

    const empty = document.createElement("div");
    empty.className = "chzzk-badge-moa-empty";
    empty.textContent = "배지 채팅 없음";

    const resizer = document.createElement("div");
    resizer.className = "chzzk-badge-moa-popup-resizer";

    const confirmModal = document.createElement("section");
    confirmModal.className = "chzzk-badge-moa-confirm-modal";
    confirmModal.setAttribute("aria-hidden", "true");
    confirmModal.setAttribute("inert", "");

    const confirmBackdrop = document.createElement("button");
    confirmBackdrop.type = "button";
    confirmBackdrop.className = "chzzk-badge-moa-confirm-backdrop";
    confirmBackdrop.setAttribute("aria-label", "삭제 확인 모달 닫기");

    const confirmDialog = document.createElement("div");
    confirmDialog.className = "chzzk-badge-moa-confirm-dialog";
    confirmDialog.setAttribute("role", "dialog");
    confirmDialog.setAttribute("aria-modal", "true");
    confirmDialog.tabIndex = -1;
    confirmDialog.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const confirmTitle = document.createElement("strong");
    confirmTitle.className = "chzzk-badge-moa-confirm-title";
    confirmTitle.textContent = "삭제 확인";

    const confirmMessage = document.createElement("p");
    confirmMessage.className = "chzzk-badge-moa-confirm-message";
    confirmMessage.textContent = "";

    const confirmActions = document.createElement("div");
    confirmActions.className = "chzzk-badge-moa-confirm-actions";

    const confirmCancelButton = document.createElement("button");
    confirmCancelButton.type = "button";
    confirmCancelButton.className = "chzzk-badge-moa-confirm-btn";
    confirmCancelButton.textContent = "취소";

    const confirmDeleteButton = document.createElement("button");
    confirmDeleteButton.type = "button";
    confirmDeleteButton.className = "chzzk-badge-moa-confirm-btn is-danger";
    confirmDeleteButton.textContent = "삭제";

    confirmActions.append(confirmCancelButton, confirmDeleteButton);
    confirmDialog.append(confirmTitle, confirmMessage, confirmActions);
    confirmModal.append(confirmBackdrop, confirmDialog);

    popup.append(popupHead, filterBar, list, empty, resizer);
    root.append(pill, popup, confirmModal);

    if (
      header instanceof HTMLElement &&
      window.getComputedStyle(header).position === "static"
    ) {
      header.style.position = "relative";
    }
    header.appendChild(root);

    pill.addEventListener("click", onPillClick);
    popup.addEventListener("click", (event) => {
      if (state.filterBarCollapsed) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (filterBar.contains(target)) return;
      if (filterToggleButton.contains(target)) return;
      state.filterBarCollapsed = true;
      renderList(false);
    });
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      closePopup();
    });
    inlineButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setDisplayStyle("inline");
    });
    blockButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setDisplayStyle("block");
    });
    filterToggleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.filterBarCollapsed = !state.filterBarCollapsed;
      renderList(false);
    });
    pinButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.popupPinned = !state.popupPinned;
      updatePopupPinStateUi();
    });
    resizer.addEventListener("mousedown", onResizeStart);
    confirmBackdrop.addEventListener("click", (event) => {
      event.stopPropagation();
      resolveConfirmDialog(false);
    });
    confirmCancelButton.addEventListener("click", (event) => {
      event.stopPropagation();
      resolveConfirmDialog(false);
    });
    confirmDeleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      resolveConfirmDialog(true);
    });

    state.ui = {
      header,
      root,
      pill,
      iconWrap,
      text,
      count,
      popup,
      popupHead,
      filterToggleButton,
      filterBar,
      list,
      empty,
      inlineButton,
      blockButton,
      pinButton,
      closeButton,
      resizer,
      confirmModal,
      confirmDialog,
      confirmTitle,
      confirmMessage,
      confirmCancelButton,
      confirmDeleteButton,
    };

    applyPopupHeight();
    syncPillPositionForHeader();
    updateViewModeButtons();
    updatePopupPinStateUi();
    applySettingsClasses();
    render();
    refreshChatHighlightObserver();
    scheduleChatHighlightScan();
  }

  const VOD_HEADER_TITLE_TEXT = "라이브 채팅 다시보기";
  const LIVE_HEADER_TITLE_TEXTS = ["채팅"];

  // 치지직은 빌드마다 클래스명이 바뀌므로(예: _container_mb8xy_2) 클래스
  // 부분일치 대신 안정적인 aside id와 h2 제목 텍스트로 헤더를 찾는다.
  function findHeaderTitleByText(scope, texts) {
    if (!(scope instanceof Element)) return null;
    const titles = scope.querySelectorAll("h2");
    for (const title of titles) {
      const text = String(title.textContent || "").trim();
      if (texts.includes(text)) return title;
    }
    return null;
  }

  function findLiveHeaderContainer(scope, titleNode) {
    if (!(scope instanceof Element)) return null;
    // 새 구조: 제목(h2)을 감싼 컨테이너에 토글/메뉴 버튼이 함께 들어있다.
    if (titleNode instanceof Element) {
      const container = titleNode.closest("div");
      if (container instanceof Element && scope.contains(container)) {
        return container;
      }
    }
    // 구버전 폴백
    const legacy = scope.querySelector(
      "[class*='live_chatting_header_container']",
    );
    return legacy || null;
  }

  function findVodHeaderContainer(scope, titleNode) {
    if (!(scope instanceof Element)) return null;
    if (titleNode instanceof Element) {
      const container = titleNode.closest("div");
      if (container instanceof Element && scope.contains(container)) {
        return container;
      }
    }
    const legacy = scope.querySelector("[class*='vod_chatting_header']");
    return legacy || null;
  }

  function findLiveChatHeader() {
    const liveAside = document.querySelector("aside#aside-chatting");
    if (liveAside) {
      const liveTitle = findHeaderTitleByText(liveAside, LIVE_HEADER_TITLE_TEXTS);
      const liveHeader = findLiveHeaderContainer(liveAside, liveTitle);
      if (liveHeader) return liveHeader;
    }

    const vodAside = document.querySelector("aside#vod-aside");
    if (vodAside) {
      const vodTitle = findHeaderTitleByText(vodAside, [VOD_HEADER_TITLE_TEXT]);
      const vodHeader = findVodHeaderContainer(vodAside, vodTitle);
      if (vodHeader) return vodHeader;
    }

    // 구버전 폴백: 클래스명 기반 탐색
    const legacyVodCandidates = document.querySelectorAll(
      "[class*='vod_chatting_header']",
    );
    for (const candidate of legacyVodCandidates) {
      if (!(candidate instanceof Element)) continue;
      if (candidate.querySelector("h2[class*='vod_chatting_header_title']")) {
        return candidate;
      }
    }

    return null;
  }

  function findVodHeaderTitleNode(header) {
    if (!(header instanceof Element)) return null;
    const byText = findHeaderTitleByText(header, [VOD_HEADER_TITLE_TEXT]);
    if (byText) return byText;
    return header.querySelector("h2[class*='vod_chatting_header_title']");
  }

  function isVodChatHeader(header) {
    if (!(header instanceof Element)) return false;
    const className = String(header.className || "");
    if (className.includes("vod_chatting_header")) return true;
    if (header.closest("aside#vod-aside")) return true;
    return !!findVodHeaderTitleNode(header);
  }

  function updateLivePillMaxWidth(state) {
    const { root, header } = state.ui;
    if (!root || !(header instanceof HTMLElement)) return;
    const headerRect = header.getBoundingClientRect();
    if (headerRect.width <= 0) return;
    const pillLeft = 52;
    const availableWidth = Math.round(headerRect.width - pillLeft - 8);
    const maxWidth = Math.max(68, Math.min(150, availableWidth));
    root.style.setProperty("--chzzk-vod-pill-max-width", `${maxWidth}px`);
  }

  function attachLivePillResizeObserver(state) {
    const { header } = state.ui;
    if (!(header instanceof HTMLElement)) return;
    detachLivePillResizeObserver(state);
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => updateLivePillMaxWidth(state));
    observer.observe(header);
    state.ui.livePillResizeObserver = observer;
  }

  function detachLivePillResizeObserver(state) {
    const observer = state.ui && state.ui.livePillResizeObserver;
    if (observer && typeof observer.disconnect === "function") {
      observer.disconnect();
    }
    if (state.ui) state.ui.livePillResizeObserver = null;
  }

  function syncPillPositionForHeader(state, deps = {}) {
    const isVodChatHeader =
      typeof deps.isVodChatHeader === "function"
        ? deps.isVodChatHeader
        : () => false;

    const { root, header } = state.ui;
    if (!root || !header) return;

    if (!isVodChatHeader(header)) {
      root.classList.remove("is-vod-header");
      root.style.removeProperty("--chzzk-vod-pill-left");
      root.style.removeProperty("--chzzk-vod-pill-top");
      attachLivePillResizeObserver(state);
      updateLivePillMaxWidth(state);
      return;
    }

    detachLivePillResizeObserver(state);

    root.classList.add("is-vod-header");

    const title = findVodHeaderTitleNode(header);
    if (!(title instanceof HTMLElement)) return;

    const headerRect = header.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    if (headerRect.width <= 0 || titleRect.width <= 0) return;

    const vodAside =
      header.closest("aside#vod-aside") ||
      document.querySelector("aside#vod-aside");
    const vodAsideRect =
      vodAside instanceof HTMLElement ? vodAside.getBoundingClientRect() : null;
    const effectiveWidth =
      vodAsideRect && vodAsideRect.width > 0
        ? Math.round(vodAsideRect.width)
        : Math.round(headerRect.width);
    const minChatWidth = Number(deps.MIN_CHAT_WIDTH) || 220;
    const defaultVodChatWidth = Number(deps.DEFAULT_VOD_CHAT_WIDTH) || 353;
    const pillHeight = 32;
    const minLeft = 15;
    const minMaxWidth = 150;
    const naturalLeft = Math.max(
      8,
      Math.round(titleRect.right - headerRect.left + 8),
    );
    const top = Math.max(
      2,
      Math.round(
        titleRect.top - headerRect.top + (titleRect.height - pillHeight) / 2,
      ),
    );

    const closeButton =
      header.querySelector("button[class*='vod_chatting_close_button']") ||
      header.querySelector("button[class*='close_button']") ||
      Array.from(header.querySelectorAll("button")).find(
        (button) => !root.contains(button),
      );

    let left = naturalLeft;
    let maxWidth = Math.max(68, Math.round(headerRect.width - left - 8));
    if (effectiveWidth < defaultVodChatWidth) {
      const widthDelta = Math.max(0, effectiveWidth - minChatWidth);
      const transitionRange = Math.max(1, defaultVodChatWidth - minChatWidth);
      const progress = Math.min(1, widthDelta / transitionRange);
      left = Math.round(minLeft + (naturalLeft - minLeft) * progress);
      const maxWidthAtDefault = Math.max(
        minMaxWidth,
        Math.round(defaultVodChatWidth - naturalLeft - 8),
      );
      maxWidth = Math.round(
        minMaxWidth + (maxWidthAtDefault - minMaxWidth) * progress,
      );
    } else if (closeButton instanceof HTMLElement) {
      const closeRect = closeButton.getBoundingClientRect();
      const closeLeft = Math.round(closeRect.left - headerRect.left);
      maxWidth = Math.max(68, Math.round(closeLeft - left - 8));
    }
    maxWidth = Math.max(68, maxWidth);

    root.style.setProperty("--chzzk-vod-pill-left", `${left}px`);
    root.style.setProperty("--chzzk-vod-pill-top", `${top}px`);
    root.style.setProperty("--chzzk-vod-pill-max-width", `${maxWidth}px`);
  }

  function cleanupDetachedUi(state, deps = {}) {
    const teardownUi =
      typeof deps.teardownUi === "function" ? deps.teardownUi : () => {};
    if (!state.ui.root) return;
    if (state.ui.root.isConnected) return;
    teardownUi();
  }

  function teardownUi(state, deps = {}) {
    const resolveConfirmDialog =
      typeof deps.resolveConfirmDialog === "function"
        ? deps.resolveConfirmDialog
        : () => {};
    const resetPillCycle =
      typeof deps.resetPillCycle === "function"
        ? deps.resetPillCycle
        : () => {};

    resolveConfirmDialog(false, { restoreFocus: false });

    detachLivePillResizeObserver(state);

    if (state.ui.root && state.ui.root.parentNode) {
      state.ui.root.parentNode.removeChild(state.ui.root);
    }
    state.popupPinned = false;
    resetPillCycle(false);

    state.ui = {
      header: null,
      root: null,
      pill: null,
      iconWrap: null,
      text: null,
      count: null,
      popup: null,
      popupHead: null,
      settingsButton: null,
      settingsPanel: null,
      filterToggleButton: null,
      filterBar: null,
      list: null,
      empty: null,
      inlineButton: null,
      blockButton: null,
      pinButton: null,
      closeButton: null,
      resizer: null,
      confirmModal: null,
      confirmDialog: null,
      confirmTitle: null,
      confirmMessage: null,
      confirmCancelButton: null,
      confirmDeleteButton: null,
      livePillResizeObserver: null,
    };
  }

  function setPopupActionButtonContent(button, type) {
    if (!button) return;
    button.textContent = "";

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("width", "13");
    svg.setAttribute("height", "13");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("chzzk-badge-moa-popup-action-icon");

    if (type === "close") {
      const path1 = document.createElementNS(svgNs, "path");
      path1.setAttribute("d", "M6 6L18 18");
      path1.setAttribute("stroke-linecap", "round");
      path1.setAttribute("stroke-linejoin", "round");
      const path2 = document.createElementNS(svgNs, "path");
      path2.setAttribute("d", "M18 6L6 18");
      path2.setAttribute("stroke-linecap", "round");
      path2.setAttribute("stroke-linejoin", "round");
      svg.append(path1, path2);
    } else {
      svg.setAttribute("viewBox", "0 0 19 20");
      svg.removeAttribute("stroke");
      svg.removeAttribute("stroke-width");
      const path1 = document.createElementNS(svgNs, "path");
      path1.setAttribute("fill", "currentColor");
      path1.setAttribute("fill-rule", "evenodd");
      path1.setAttribute("clip-rule", "evenodd");
      path1.setAttribute(
        "d",
        "m11.18 4.207.024.272-.01-.01-1.916 1.924A1.595 1.595 0 0 0 9 6.387l-2.356.156A.602.602 0 0 0 6.26 7.57l4.223 4.242.007.006.465.467a.598.598 0 0 0 1.021-.397l.03-.66.001-.009.082-1.761c.002-.04.003-.081.002-.121l1.974-1.984-.01-.01.27.023.25.022a.3.3 0 0 0 .238-.512l-.178-.179-.625-.628-.019-.019-.183-.184-1.133-1.138-.184-.185-.018-.018-.625-.628-.178-.179a.3.3 0 0 0-.51.239l.022.251Z",
      );
      const path2 = document.createElementNS(svgNs, "path");
      path2.setAttribute("fill", "currentColor");
      path2.setAttribute(
        "d",
        "m11.204 4.48-.353.353.969.973-.119-1.37-.497.043Zm-.023-.273.497-.043-.497.043Zm.013.262.352-.355-.352-.354-.353.354.353.355ZM9.278 6.393l-.054.498.238.026.17-.17-.354-.354ZM9 6.387l.033.5-.033-.5Zm-2.356.156.033.5-.033-.5Zm5.332 5.344-.498-.023.498.023Zm.03-.66-.498-.023.499.023Zm.001-.009.499.024v-.004l-.499-.02Zm0 0-.498-.023v.004l.498.02Zm.082-1.761.499.023-.499-.023Zm.002-.121-.353-.355-.152.153.006.216.498-.014Zm1.974-1.984.353.354.353-.354-.353-.354-.353.354Zm-.01-.01.043-.5-1.365-.12.969.974.352-.355Zm.27.023.043-.5-.043.5Zm.25.022-.043.5.043-.5ZM11.16 3.956l-.497.043.497-.043Zm.542.48-.023-.272-.994.087.023.272.994-.087Zm-.86.387.01.01.706-.708-.01-.01-.706.708Zm-1.21 1.924 1.915-1.924-.705-.709-1.915 1.924.705.709Zm-.299-.853a2.091 2.091 0 0 0-.366-.007l.066 1c.065-.005.13-.003.192.004l.108-.997Zm-.366-.007-2.356.156.066 1 2.356-.156-.066-1Zm-2.356.156c-.941.063-1.37 1.21-.703 1.88l.705-.709a.1.1 0 0 1 .064-.17l-.066-1Zm-.703 1.88 4.222 4.242.706-.709-4.223-4.242-.705.71Zm4.222 4.242.706-.709-.706.709Zm0 0 .007.007.705-.71-.006-.006-.706.709Zm.007.007.465.466.705-.708-.465-.467-.705.709Zm.465.466c.674.678 1.828.229 1.872-.727l-.996-.047a.095.095 0 0 1-.018.055.106.106 0 0 1-.046.033.104.104 0 0 1-.056.007.093.093 0 0 1-.05-.03l-.706.71Zm1.872-.727.031-.66-.996-.047-.031.66.996.046Zm.031-.66v-.01l-.996-.046v.009l.996.047Zm0-.013-.996-.04.997.04Zm0 .004.083-1.762-.997-.047-.082 1.762.997.046Zm.083-1.762c.002-.053.003-.106.001-.158l-.997.028v.083l.996.047Zm1.124-2.482L11.737 8.98l.705.71 1.975-1.985-.706-.708Zm-.01.698.01.01.706-.708-.01-.011-.706.709Zm.666-.83-.27-.024-.087.998.27.024.087-.998Zm.25.022-.25-.022-.086.998.25.022.087-.998Zm-.158.341a.2.2 0 0 1 .159-.341l-.087.998c.742.065 1.16-.836.634-1.366l-.706.709Zm-.178-.179.178.179.706-.709-.178-.178-.706.708Zm-.625-.627.625.627.706-.708-.625-.628-.706.709Zm-.018-.02.018.02.706-.71-.019-.018-.705.709Zm-.184-.184.184.185.705-.71-.183-.183-.706.708Zm-1.133-1.138 1.133 1.138.706-.708-1.133-1.139-.706.71Zm-.183-.184.183.184.706-.709-.184-.184-.705.709Zm-.02-.02.02.02.705-.709-.019-.019-.705.709Zm-.624-.627.625.628.705-.709-.625-.628-.705.709Zm-.178-.179.178.179.705-.709-.178-.178-.705.708Zm.34-.159a.2.2 0 0 1-.34.16l.705-.71c-.526-.528-1.424-.108-1.36.637l.995-.087Zm.022.252-.022-.252-.994.087.022.252.994-.087Z",
      );
      const path3 = document.createElementNS(svgNs, "path");
      path3.setAttribute("fill", "currentColor");
      path3.setAttribute("fill-rule", "evenodd");
      path3.setAttribute("clip-rule", "evenodd");
      path3.setAttribute("stroke", "currentColor");
      path3.setAttribute("stroke-width", "0.5");
      path3.setAttribute(
        "d",
        "M6.674 11.13 7.5 12l-2.665 2.166c-.26.185-.578-.138-.394-.4l2.233-2.637Z",
      );
      svg.append(path1, path2, path3);
    }

    button.appendChild(svg);
  }

  function setViewModeButtonContent(button, mode) {
    if (!button) return;
    button.textContent = "";

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("width", "13");
    svg.setAttribute("height", "13");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    if (mode === "inline") {
      const path = document.createElementNS(svgNs, "path");
      path.setAttribute("d", "M4 6h16M4 12h16M4 18h16");
      svg.appendChild(path);
    } else {
      const rectPaths = [
        { x: "3", y: "3", width: "7", height: "7" },
        { x: "14", y: "3", width: "7", height: "7" },
        { x: "14", y: "14", width: "7", height: "7" },
        { x: "3", y: "14", width: "7", height: "7" },
      ];
      rectPaths.forEach((rectInfo) => {
        const rect = document.createElementNS(svgNs, "rect");
        rect.setAttribute("x", rectInfo.x);
        rect.setAttribute("y", rectInfo.y);
        rect.setAttribute("width", rectInfo.width);
        rect.setAttribute("height", rectInfo.height);
        svg.appendChild(rect);
      });
    }

    const label = document.createElement("span");
    label.className = "chzzk-badge-moa-view-mode-label";
    label.textContent = mode === "inline" ? "한줄" : "블록";

    button.append(svg, label);
  }

  ns.uiCoreApi = {
    ensureUi,
    findLiveChatHeader,
    isVodChatHeader,
    syncPillPositionForHeader,
    cleanupDetachedUi,
    teardownUi,
    setPopupActionButtonContent,
    setViewModeButtonContent,
  };
})();
