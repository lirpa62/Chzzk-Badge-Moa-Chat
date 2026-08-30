(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.captureApi && typeof ns.captureApi === "object") return;

  const ITEM_SELECTOR =
    ".chzzk-badge-moa-item[data-chzzk-badge-moa-capture-key]";
  const SELECTED_CLASS = "is-capture-selected";
  const CHUNK_SIZE = 15;
  const STYLE_SCAN_YIELD_INTERVAL = 24;
  const DRAG_THRESHOLD = 5;
  const AUTO_SCROLL_EDGE = 36;
  const AUTO_SCROLL_MAX_SPEED = 14;
  const IMAGE_FETCH_MESSAGE = "chzzk_badge_moa_capture_image_fetch";
  const TRANSPARENT_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";
  const URL_PATTERN = /url\((['"]?)([^'")]+?)\1\)/g;

  function yieldCaptureMainThread() {
    if (typeof globalThis.scheduler?.yield === "function") {
      return globalThis.scheduler.yield();
    }
    return new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  function ensureCaptureState(state) {
    if (!state.capture || typeof state.capture !== "object") {
      state.capture = {};
    }
    if (!(state.capture.selectedKeys instanceof Set)) {
      state.capture.selectedKeys = new Set();
    }
    state.capture.active = state.capture.active === true;
    state.capture.busy = state.capture.busy === true;
    state.capture.lastKey = String(state.capture.lastKey || "");
    state.capture.progressCurrent = Math.max(
      0,
      Number(state.capture.progressCurrent || 0),
    );
    state.capture.progressTotal = Math.max(
      0,
      Number(state.capture.progressTotal || 0),
    );
    state.capture.runToken = Math.max(0, Number(state.capture.runToken || 0));
    return state.capture;
  }

  function ensureCaptureDragState(capture) {
    if (!capture.drag || typeof capture.drag !== "object") {
      capture.drag = {};
    }
    const drag = capture.drag;
    drag.active = drag.active === true;
    drag.started = drag.started === true;
    drag.pointerId = Number.isFinite(drag.pointerId) ? drag.pointerId : null;
    drag.startX = Number(drag.startX || 0);
    drag.startY = Number(drag.startY || 0);
    drag.clientX = Number(drag.clientX || 0);
    drag.clientY = Number(drag.clientY || 0);
    drag.mode = drag.mode === "remove" ? "remove" : "select";
    if (!(drag.visitedKeys instanceof Set)) drag.visitedKeys = new Set();
    drag.autoScrollFrame = Number(drag.autoScrollFrame || 0);
    drag.suppressClick = drag.suppressClick === true;
    drag.suppressClickTimer = Number(drag.suppressClickTimer || 0);
    return drag;
  }

  function getEntryCaptureKey(entry, index) {
    if (Number.isFinite(entry?.sequence)) {
      return `seq:${entry.sequence}`;
    }
    const dedupeKey = String(entry?.dedupeKey || "").trim();
    if (dedupeKey) return `dedupe:${dedupeKey}`;
    return `fallback:${Number(entry?.timestamp || 0) || 0}:${String(
      entry?.nickname || "",
    )}:${index}`;
  }

  function getCaptureItems(state) {
    const list = state?.ui?.list;
    if (!(list instanceof HTMLElement)) return [];
    return Array.from(list.querySelectorAll(ITEM_SELECTOR));
  }

  function getItemKey(item) {
    return String(item?.dataset?.chzzkBadgeMoaCaptureKey || "");
  }

  function syncCaptureItems(state) {
    const capture = ensureCaptureState(state);
    const validKeys = new Set();
    getCaptureItems(state).forEach((item) => {
      const key = getItemKey(item);
      if (key) validKeys.add(key);
      const selected = !!key && capture.selectedKeys.has(key);
      item.classList.toggle(SELECTED_CLASS, selected);
      item.classList.toggle("is-capture-selectable", capture.active);
      if (capture.active) {
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-pressed", String(selected));
        item.title = selected
          ? "캡처 선택 해제"
          : "캡처할 채팅 선택 (Shift+클릭: 범위 선택)";
      } else {
        item.removeAttribute("role");
        item.removeAttribute("tabindex");
        item.removeAttribute("aria-pressed");
        item.removeAttribute("title");
      }
    });
    Array.from(capture.selectedKeys).forEach((key) => {
      if (!validKeys.has(key)) capture.selectedKeys.delete(key);
    });
    if (capture.lastKey && !validKeys.has(capture.lastKey)) {
      capture.lastKey = "";
    }
  }

  function syncCaptureUi(state) {
    const capture = ensureCaptureState(state);
    const captureEnabled = state?.settings?.showCaptureButton === true;
    const dragEnabled =
      state?.settings?.enableCaptureDragSelection === true;
    if (!captureEnabled) {
      if (capture.active || capture.busy || capture.selectedKeys.size > 0) {
        capture.runToken += 1;
      }
      if (typeof capture.previewClose === "function") {
        capture.previewClose(false);
      }
      finishCaptureDrag(state, null, false);
      capture.active = false;
      capture.busy = false;
      capture.lastKey = "";
      capture.progressCurrent = 0;
      capture.progressTotal = 0;
      capture.selectedKeys.clear();
    } else if (!dragEnabled) {
      finishCaptureDrag(state, null, false);
    }
    syncCaptureItems(state);
    const selectButton = state?.ui?.captureSelectButton;
    const downloadButton = state?.ui?.captureDownloadButton;
    const toggleAllButton = state?.ui?.captureToggleAllButton;
    const progressOverlay = state?.ui?.captureProgressOverlay;
    const progressText = state?.ui?.captureProgressText;
    const root = state?.ui?.root;
    const list = state?.ui?.list;
    const itemKeys = new Set(
      getCaptureItems(state).map(getItemKey).filter(Boolean),
    );
    const itemCount = itemKeys.size;
    const selectedCount = capture.selectedKeys.size;
    const allSelected =
      itemCount > 0 &&
      Array.from(itemKeys).every((key) => capture.selectedKeys.has(key));

    root?.classList.toggle("is-capture-selecting", capture.active);
    root?.classList.toggle(
      "is-capture-drag-enabled",
      capture.active && dragEnabled,
    );
    root?.classList.toggle("is-capture-busy", capture.busy);
    if (list instanceof HTMLElement) {
      list.setAttribute("aria-busy", String(capture.busy));
    }
    if (progressOverlay instanceof HTMLElement) {
      progressOverlay.hidden = !capture.busy;
      if (capture.busy) positionCaptureProgressOverlay(state);
    }
    if (progressText instanceof HTMLElement) {
      progressText.textContent =
        capture.progressTotal > 0
          ? `이미지 준비 중 (${Math.min(
              capture.progressCurrent,
              capture.progressTotal,
            )}/${capture.progressTotal})`
          : "이미지 준비 중";
    }
    if (selectButton instanceof HTMLButtonElement) {
      selectButton.hidden = !captureEnabled;
      selectButton.disabled = capture.busy || itemCount === 0;
      selectButton.setAttribute("aria-pressed", String(capture.active));
      selectButton.setAttribute(
        "aria-label",
        capture.active ? "채팅 캡처 선택 종료" : "캡처할 채팅 선택",
      );
      selectButton.title = capture.active
        ? "선택 종료"
        : "캡처할 채팅 선택";
    }
    if (downloadButton instanceof HTMLButtonElement) {
      downloadButton.hidden = !captureEnabled || !capture.active;
      downloadButton.disabled = capture.busy || selectedCount === 0;
      downloadButton.classList.toggle("is-busy", capture.busy);
      downloadButton.setAttribute(
        "aria-label",
        capture.busy
          ? "선택한 채팅 이미지 생성 중"
          : `선택한 채팅 ${selectedCount}개 PNG로 저장`,
      );
      downloadButton.title = capture.busy
        ? "PNG 생성 중"
        : selectedCount > 0
          ? `${selectedCount}개 채팅 PNG 저장`
          : "저장할 채팅을 선택하세요";
    }
    if (toggleAllButton instanceof HTMLButtonElement) {
      toggleAllButton.hidden = !captureEnabled || !capture.active;
      toggleAllButton.disabled = capture.busy || itemCount === 0;
      toggleAllButton.classList.toggle(
        "is-partial",
        selectedCount > 0 && !allSelected,
      );
      toggleAllButton.setAttribute(
        "aria-pressed",
        allSelected ? "true" : selectedCount > 0 ? "mixed" : "false",
      );
      const label = allSelected ? "전체 해제" : "전체 선택";
      const text = toggleAllButton.querySelector(
        ".chzzk-badge-moa-popup-capture-toggle-all-text",
      );
      if (text) text.textContent = label;
      toggleAllButton.setAttribute("aria-label", label);
      toggleAllButton.title = label;
    }
  }

  function resetCaptureSelection(state) {
    const capture = ensureCaptureState(state);
    capture.runToken += 1;
    if (typeof capture.previewClose === "function") {
      capture.previewClose(false);
    }
    finishCaptureDrag(state, null, false);
    capture.active = false;
    capture.busy = false;
    capture.lastKey = "";
    capture.progressCurrent = 0;
    capture.progressTotal = 0;
    capture.selectedKeys.clear();
    syncCaptureUi(state);
  }

  function toggleCaptureSelectionMode(state) {
    const capture = ensureCaptureState(state);
    if (capture.busy || state?.settings?.showCaptureButton !== true) return;
    finishCaptureDrag(state, null, false);
    capture.active = !capture.active;
    capture.lastKey = "";
    capture.selectedKeys.clear();
    syncCaptureUi(state);
  }

  function toggleAllCaptureItems(state) {
    const capture = ensureCaptureState(state);
    if (!capture.active || capture.busy) return false;
    const keys = Array.from(
      new Set(getCaptureItems(state).map(getItemKey).filter(Boolean)),
    );
    if (keys.length === 0) return false;
    const allSelected = keys.every((key) => capture.selectedKeys.has(key));
    if (allSelected) {
      keys.forEach((key) => capture.selectedKeys.delete(key));
      capture.lastKey = "";
    } else {
      keys.forEach((key) => capture.selectedKeys.add(key));
      capture.lastKey = keys[keys.length - 1] || "";
    }
    syncCaptureUi(state);
    return true;
  }

  function selectCaptureRange(state, currentKey) {
    const capture = ensureCaptureState(state);
    const items = getCaptureItems(state);
    const keys = items.map(getItemKey);
    const start = keys.indexOf(capture.lastKey);
    const end = keys.indexOf(currentKey);
    if (start < 0 || end < 0) return false;
    const from = Math.min(start, end);
    const to = Math.max(start, end);
    for (let index = from; index <= to; index += 1) {
      if (keys[index]) capture.selectedKeys.add(keys[index]);
    }
    return true;
  }

  function toggleCaptureItem(state, item, rangeSelect) {
    const capture = ensureCaptureState(state);
    const key = getItemKey(item);
    if (!capture.active || capture.busy || !key) return false;
    if (rangeSelect && capture.lastKey && selectCaptureRange(state, key)) {
      capture.lastKey = key;
      syncCaptureUi(state);
      return true;
    }
    if (capture.selectedKeys.has(key)) capture.selectedKeys.delete(key);
    else capture.selectedKeys.add(key);
    capture.lastKey = key;
    syncCaptureUi(state);
    return true;
  }

  function findCaptureItemFromEvent(state, event) {
    const target = event?.target;
    const list = state?.ui?.list;
    if (!(target instanceof Element) || !(list instanceof HTMLElement)) {
      return null;
    }
    const item = target.closest(ITEM_SELECTOR);
    return item instanceof HTMLElement && list.contains(item) ? item : null;
  }

  function findCaptureItemAtPoint(state, clientX, clientY) {
    const list = state?.ui?.list;
    if (!(list instanceof HTMLElement)) return null;
    const target = document.elementFromPoint(clientX, clientY);
    if (!(target instanceof Element)) return null;
    const item = target.closest(ITEM_SELECTOR);
    return item instanceof HTMLElement && list.contains(item) ? item : null;
  }

  function applyCaptureDragItem(state, item) {
    const capture = ensureCaptureState(state);
    const drag = ensureCaptureDragState(capture);
    const key = getItemKey(item);
    if (!drag.started || !key || drag.visitedKeys.has(key)) return false;
    drag.visitedKeys.add(key);
    if (drag.mode === "remove") capture.selectedKeys.delete(key);
    else capture.selectedKeys.add(key);
    capture.lastKey = key;
    syncCaptureUi(state);
    return true;
  }

  function scrollCaptureListAtPointer(state) {
    const capture = ensureCaptureState(state);
    const drag = ensureCaptureDragState(capture);
    if (!drag.active || !drag.started) return false;
    const list = state?.ui?.list;
    if (!(list instanceof HTMLElement)) return false;
    const rect = list.getBoundingClientRect();
    let speed = 0;
    if (drag.clientY < rect.top + AUTO_SCROLL_EDGE) {
      const ratio = Math.min(
        1,
        Math.max(
          0,
          (rect.top + AUTO_SCROLL_EDGE - drag.clientY) / AUTO_SCROLL_EDGE,
        ),
      );
      speed = -Math.max(2, Math.round(AUTO_SCROLL_MAX_SPEED * ratio));
    } else if (drag.clientY > rect.bottom - AUTO_SCROLL_EDGE) {
      const ratio = Math.min(
        1,
        Math.max(
          0,
          (drag.clientY - (rect.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE,
        ),
      );
      speed = Math.max(2, Math.round(AUTO_SCROLL_MAX_SPEED * ratio));
    }
    if (speed !== 0) {
      const before = list.scrollTop;
      list.scrollTop += speed;
      if (list.scrollTop !== before) {
        const item = findCaptureItemAtPoint(state, drag.clientX, drag.clientY);
        if (item) applyCaptureDragItem(state, item);
        return true;
      }
    }
    return false;
  }

  function runCaptureAutoScroll(state) {
    const capture = ensureCaptureState(state);
    const drag = ensureCaptureDragState(capture);
    drag.autoScrollFrame = 0;
    if (!drag.active || !drag.started) return;
    scrollCaptureListAtPointer(state);
    drag.autoScrollFrame = window.requestAnimationFrame(() =>
      runCaptureAutoScroll(state),
    );
  }

  function startCaptureAutoScroll(state) {
    const drag = ensureCaptureDragState(ensureCaptureState(state));
    if (drag.autoScrollFrame) return;
    drag.autoScrollFrame = window.requestAnimationFrame(() =>
      runCaptureAutoScroll(state),
    );
  }

  function finishCaptureDrag(state, event, suppressClick) {
    const capture = ensureCaptureState(state);
    const drag = ensureCaptureDragState(capture);
    const list = state?.ui?.list;
    const wasStarted = drag.started;
    if (drag.autoScrollFrame) {
      window.cancelAnimationFrame(drag.autoScrollFrame);
      drag.autoScrollFrame = 0;
    }
    if (
      drag.pointerId !== null &&
      list instanceof HTMLElement &&
      typeof list.hasPointerCapture === "function" &&
      list.hasPointerCapture(drag.pointerId)
    ) {
      try {
        list.releasePointerCapture(drag.pointerId);
      } catch (_error) {}
    }
    drag.active = false;
    drag.started = false;
    drag.pointerId = null;
    drag.visitedKeys.clear();
    state?.ui?.root?.classList.remove("is-capture-dragging");
    if (wasStarted && suppressClick) {
      drag.suppressClick = true;
      if (drag.suppressClickTimer) clearTimeout(drag.suppressClickTimer);
      drag.suppressClickTimer = window.setTimeout(() => {
        drag.suppressClick = false;
        drag.suppressClickTimer = 0;
      }, 0);
      event?.preventDefault?.();
      event?.stopPropagation?.();
    }
    return wasStarted;
  }

  function handleCapturePointerDown(state, event) {
    const capture = ensureCaptureState(state);
    if (
      !capture.active ||
      capture.busy ||
      event?.button !== 0 ||
      event?.isPrimary === false
    ) {
      return false;
    }
    const item = findCaptureItemFromEvent(state, event);
    if (!item) return false;
    event.preventDefault();
    if (state?.settings?.enableCaptureDragSelection !== true) return true;
    const drag = ensureCaptureDragState(capture);
    finishCaptureDrag(state, null, false);
    drag.active = true;
    drag.pointerId = Number.isFinite(event.pointerId) ? event.pointerId : 1;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    drag.mode = capture.selectedKeys.has(getItemKey(item)) ? "remove" : "select";
    drag.visitedKeys.clear();
    return true;
  }

  function handleCapturePointerMove(state, event) {
    const capture = ensureCaptureState(state);
    const drag = ensureCaptureDragState(capture);
    if (!drag.active || event?.pointerId !== drag.pointerId) return false;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    if (!drag.started) {
      const distance = Math.hypot(
        drag.clientX - drag.startX,
        drag.clientY - drag.startY,
      );
      if (distance < DRAG_THRESHOLD) return false;
      drag.started = true;
      state?.ui?.root?.classList.add("is-capture-dragging");
      const list = state?.ui?.list;
      if (
        list instanceof HTMLElement &&
        typeof list.setPointerCapture === "function"
      ) {
        try {
          list.setPointerCapture(drag.pointerId);
        } catch (_error) {}
      }
      const startItem = findCaptureItemAtPoint(state, drag.startX, drag.startY);
      if (startItem) applyCaptureDragItem(state, startItem);
      startCaptureAutoScroll(state);
    }
    event.preventDefault();
    event.stopPropagation();
    const item = findCaptureItemAtPoint(state, drag.clientX, drag.clientY);
    if (item) applyCaptureDragItem(state, item);
    scrollCaptureListAtPointer(state);
    return true;
  }

  function handleCapturePointerEnd(state, event) {
    const drag = ensureCaptureDragState(ensureCaptureState(state));
    if (!drag.active || event?.pointerId !== drag.pointerId) return false;
    return finishCaptureDrag(state, event, true);
  }

  function handleCaptureListClick(state, event) {
    const capture = ensureCaptureState(state);
    if (!capture.active) return false;
    const drag = ensureCaptureDragState(capture);
    if (drag.suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      return true;
    }
    const item = findCaptureItemFromEvent(state, event);
    if (!item) return false;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    return toggleCaptureItem(state, item, event.shiftKey === true);
  }

  function handleCaptureListKeydown(state, event) {
    const capture = ensureCaptureState(state);
    if (!capture.active || (event.key !== "Enter" && event.key !== " ")) {
      return false;
    }
    const item = findCaptureItemFromEvent(state, event);
    if (!item) return false;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    return toggleCaptureItem(state, item, event.shiftKey === true);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.runtime ||
        typeof chrome.runtime.sendMessage !== "function"
      ) {
        resolve(null);
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
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

  async function fetchImageAsDataUrl(url, cache) {
    const source = String(url || "").trim();
    if (!source || source.startsWith("data:")) return source || null;
    if (!cache.has(source)) {
      cache.set(
        source,
        sendRuntimeMessage({ type: IMAGE_FETCH_MESSAGE, url: source }).then(
          (response) =>
            response?.ok && typeof response.dataUrl === "string"
              ? response.dataUrl
              : null,
        ),
      );
    }
    return cache.get(source);
  }

  function extractStyleUrls(value) {
    const matches = [];
    if (!value || value === "none") return matches;
    const pattern = new RegExp(URL_PATTERN.source, "g");
    let match;
    while ((match = pattern.exec(value)) !== null) {
      if (!String(match[2] || "").startsWith("data:")) {
        matches.push({ raw: match[0], url: match[2] });
      }
    }
    return matches;
  }

  async function replaceStyleUrls(value, cache) {
    let next = value;
    for (const match of extractStyleUrls(value)) {
      const dataUrl = await fetchImageAsDataUrl(match.url, cache);
      if (dataUrl) next = next.replace(match.raw, `url("${dataUrl}")`);
    }
    return next;
  }

  async function inlineCaptureImages(root, cache) {
    const resourceCache = cache instanceof Map ? cache : new Map();
    const tasks = [];
    root.querySelectorAll("img").forEach((image) => {
      const source = image.currentSrc || image.src;
      if (!source || source.startsWith("data:")) return;
      tasks.push(
        fetchImageAsDataUrl(source, resourceCache).then((dataUrl) => {
          if (dataUrl) {
            image.removeAttribute("srcset");
            image.src = dataUrl;
          }
        }),
      );
    });

    const styleRules = [];
    const elements = [root, ...root.querySelectorAll("*")];
    let pseudoIndex = 0;
    const properties = [
      ["background-image", "backgroundImage"],
      ["mask-image", "maskImage"],
      ["-webkit-mask-image", "webkitMaskImage"],
    ];
    for (
      let elementIndex = 0;
      elementIndex < elements.length;
      elementIndex += 1
    ) {
      const element = elements[elementIndex];
      const computed = getComputedStyle(element);
      properties.forEach(([cssName, styleName]) => {
        const value = computed.getPropertyValue(cssName);
        if (extractStyleUrls(value).length === 0) return;
        tasks.push(
          replaceStyleUrls(value, resourceCache).then((next) => {
            element.style[styleName] = next;
          }),
        );
      });
      ["::before", "::after"].forEach((pseudo) => {
        const pseudoStyle = getComputedStyle(element, pseudo);
        properties.forEach(([cssName]) => {
          const value = pseudoStyle.getPropertyValue(cssName);
          if (extractStyleUrls(value).length === 0) return;
          const className = `chzzk-badge-moa-capture-pseudo-${pseudoIndex++}`;
          element.classList.add(className);
          tasks.push(
            replaceStyleUrls(value, resourceCache).then((next) => {
              styleRules.push(
                `.${className}${pseudo}{${cssName}:${next}!important;}`,
              );
            }),
          );
        });
      });
      if (
        elementIndex > 0 &&
        elementIndex % STYLE_SCAN_YIELD_INTERVAL === 0
      ) {
        await yieldCaptureMainThread();
      }
    }
    await Promise.all(tasks);
    if (styleRules.length > 0) {
      const style = document.createElement("style");
      style.textContent = styleRules.join("\n");
      root.prepend(style);
    }
  }

  function getCaptureBackground(state) {
    const candidates = [state?.ui?.popup, state?.ui?.list];
    for (const element of candidates) {
      if (!(element instanceof HTMLElement)) continue;
      const color = getComputedStyle(element).backgroundColor;
      if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") {
        return color;
      }
    }
    return document.documentElement.classList.contains("theme_dark") ||
      document.documentElement.dataset.theme === "dark"
      ? "#1c1d1f"
      : "#ffffff";
  }

  function buildCaptureStage(state, items) {
    const list = state?.ui?.list;
    const root = state?.ui?.root;
    if (!(list instanceof HTMLElement) || !(root instanceof HTMLElement)) {
      return null;
    }
    const stage = document.createElement("div");
    stage.className = `${root.className} chzzk-badge-moa-capture-stage`;
    stage.classList.remove(
      "is-capture-selecting",
      "is-capture-dragging",
      "is-capture-drag-enabled",
      "is-capture-busy",
    );
    stage.style.cssText = root.style.cssText;
    const surface = document.createElement("div");
    surface.className = `${list.className} chzzk-badge-moa-capture-surface`;
    const listStyle = getComputedStyle(list);
    const width = Math.max(
      220,
      Math.round(list.clientWidth || list.getBoundingClientRect().width),
    );
    surface.style.width = `${width}px`;
    surface.style.minWidth = `${width}px`;
    surface.style.maxWidth = `${width}px`;
    surface.style.setProperty("padding", listStyle.padding, "important");
    surface.style.setProperty("gap", listStyle.gap, "important");
    surface.style.backgroundColor = getCaptureBackground(state);
    items.forEach((item) => {
      const clone = item.cloneNode(true);
      const itemWidth = Math.round(item.getBoundingClientRect().width);
      clone.classList.remove(SELECTED_CLASS, "is-capture-selectable");
      clone.removeAttribute("role");
      clone.removeAttribute("tabindex");
      clone.removeAttribute("aria-pressed");
      clone.removeAttribute("title");
      if (itemWidth > 0) {
        clone.style.setProperty("width", `${itemWidth}px`, "important");
        clone.style.setProperty("min-width", `${itemWidth}px`, "important");
        clone.style.setProperty("max-width", `${itemWidth}px`, "important");
        clone.style.setProperty("flex", "0 0 auto", "important");
      }
      surface.appendChild(clone);
    });
    stage.appendChild(surface);
    document.body.appendChild(stage);
    return { stage, surface };
  }

  function positionCaptureProgressOverlay(state) {
    const popup = state?.ui?.popup;
    const list = state?.ui?.list;
    const overlay = state?.ui?.captureProgressOverlay;
    if (
      !(popup instanceof HTMLElement) ||
      !(list instanceof HTMLElement) ||
      !(overlay instanceof HTMLElement)
    ) {
      return;
    }
    const popupRect = popup.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    overlay.style.left = `${Math.max(0, listRect.left - popupRect.left)}px`;
    overlay.style.top = `${Math.max(0, listRect.top - popupRect.top)}px`;
    overlay.style.width = `${Math.max(0, listRect.width)}px`;
    overlay.style.height = `${Math.max(0, listRect.height)}px`;
  }

  function createCaptureStamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate(),
    )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  function createCaptureFilename(index, total, stamp) {
    const suffix = total > 1 ? `-${index + 1}` : "";
    return `badge-moa-chat-${stamp || createCaptureStamp()}${suffix}.png`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function waitWithTimeout(promise, timeoutMs) {
    let timeoutId = 0;
    const timeout = new Promise((resolve) => {
      timeoutId = window.setTimeout(resolve, timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timeoutId) window.clearTimeout(timeoutId);
    });
  }

  async function waitForCaptureImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      images.map(async (image) => {
        if (typeof image.decode === "function") {
          try {
            await waitWithTimeout(image.decode(), 3000);
            return;
          } catch (_error) {}
        }
        if (image.complete) return;
        await waitWithTimeout(
          new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }),
          3000,
        );
      }),
    );
  }

  function wrapCaptureUnicodeEmojis(root) {
    const emojiPattern =
      /\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?)*/gu;
    const textNodes = [];
    root
      .querySelectorAll(".chzzk-badge-moa-item-message-body")
      .forEach((message) => {
        const walker = document.createTreeWalker(
          message,
          NodeFilter.SHOW_TEXT,
        );
        let node = walker.nextNode();
        while (node) {
          emojiPattern.lastIndex = 0;
          if (emojiPattern.test(node.nodeValue || "")) textNodes.push(node);
          node = walker.nextNode();
        }
      });

    textNodes.forEach((textNode) => {
      const text = String(textNode.nodeValue || "");
      const pattern = new RegExp(emojiPattern.source, emojiPattern.flags);
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match = pattern.exec(text);
      while (match) {
        if (match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastIndex, match.index)),
          );
        }
        const emoji = document.createElement("span");
        emoji.className = "chzzk-badge-moa-capture-unicode-emoji";
        emoji.textContent = match[0];
        fragment.appendChild(emoji);
        lastIndex = pattern.lastIndex;
        match = pattern.exec(text);
      }
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.replaceWith(fragment);
    });
  }

  function stabilizeCaptureItemHeights(root) {
    root.querySelectorAll(".chzzk-badge-moa-item").forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      item.style.removeProperty("height");
      item.style.removeProperty("min-height");
      const itemRect = item.getBoundingClientRect();
      const itemStyle = getComputedStyle(item);
      const bottomSpacing =
        (Number.parseFloat(itemStyle.paddingBottom) || 0) +
        (Number.parseFloat(itemStyle.borderBottomWidth) || 0);

      // 콘텐츠 하단은 요소 단위 getBoundingClientRect 로만 측정한다.
      // Range.getBoundingClientRect 는 일부 메시지(링크/특수 노드 등)에서 수천 px 의
      // 엉뚱한 값을 반환해(진단으로 확인) 항목 높이를 폭주시켰다 → 사용하지 않는다.
      let contentBottom = itemRect.top + item.scrollHeight;
      item
        .querySelectorAll(
          [
            ".chzzk-badge-moa-item-head",
            ".chzzk-badge-moa-item-message",
            ".chzzk-badge-moa-item-message img",
            ".chzzk-badge-moa-capture-unicode-emoji",
          ].join(", "),
        )
        .forEach((content) => {
          contentBottom = Math.max(
            contentBottom,
            content.getBoundingClientRect().bottom,
          );
        });

      const requiredHeight = Math.ceil(
        Math.max(
          itemRect.height,
          item.scrollHeight,
          contentBottom - itemRect.top + bottomSpacing,
        ),
      ) + 1;
      item.style.setProperty("box-sizing", "border-box", "important");
      item.style.setProperty("height", `${requiredHeight}px`, "important");
      item.style.setProperty("min-height", `${requiredHeight}px`, "important");
      item.style.setProperty(
        "overflow",
        item.classList.contains("chzzk-badge-moa-item-original-chat")
          ? "visible"
          : "hidden",
        "important",
      );
    });
  }

  function createCapturePreviewModal(state, results) {
    return new Promise((resolve) => {
      const capture = ensureCaptureState(state);
      const modal = document.createElement("section");
      modal.className = "chzzk-badge-moa-capture-preview-modal is-open";
      modal.setAttribute("role", "presentation");

      const backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "chzzk-badge-moa-capture-preview-backdrop";
      backdrop.setAttribute("aria-label", "캡처 미리보기 닫기");

      const dialog = document.createElement("div");
      dialog.className = "chzzk-badge-moa-capture-preview-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", "캡처 미리보기");
      dialog.tabIndex = -1;

      const header = document.createElement("div");
      header.className = "chzzk-badge-moa-capture-preview-header";
      const title = document.createElement("strong");
      title.textContent = "캡처 미리보기";
      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "chzzk-badge-moa-capture-preview-close";
      closeButton.setAttribute("aria-label", "미리보기 닫기");
      closeButton.title = "닫기";
      closeButton.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      header.append(title, closeButton);

      const body = document.createElement("div");
      body.className = "chzzk-badge-moa-capture-preview-body";
      const image = document.createElement("img");
      image.className = "chzzk-badge-moa-capture-preview-image";
      image.alt = "선택한 채팅 캡처 미리보기";
      body.appendChild(image);

      const navigator = document.createElement("div");
      navigator.className = "chzzk-badge-moa-capture-preview-nav";
      const previousButton = document.createElement("button");
      previousButton.type = "button";
      previousButton.className = "chzzk-badge-moa-capture-preview-nav-button";
      previousButton.setAttribute("aria-label", "이전 이미지");
      previousButton.title = "이전 이미지";
      previousButton.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
      const pageText = document.createElement("span");
      pageText.className = "chzzk-badge-moa-capture-preview-page";
      const nextButton = document.createElement("button");
      nextButton.type = "button";
      nextButton.className = "chzzk-badge-moa-capture-preview-nav-button";
      nextButton.setAttribute("aria-label", "다음 이미지");
      nextButton.title = "다음 이미지";
      nextButton.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
      navigator.append(previousButton, pageText, nextButton);

      const footer = document.createElement("div");
      footer.className = "chzzk-badge-moa-capture-preview-footer";
      const fileInfo = document.createElement("span");
      fileInfo.className = "chzzk-badge-moa-capture-preview-file";
      const actions = document.createElement("div");
      actions.className = "chzzk-badge-moa-capture-preview-actions";
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "chzzk-badge-moa-capture-preview-cancel";
      cancelButton.textContent = "취소";
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "chzzk-badge-moa-capture-preview-save";
      saveButton.textContent = results.length > 1 ? "전체 저장" : "저장";
      actions.append(cancelButton, saveButton);
      footer.append(fileInfo, actions);

      dialog.append(header, body, navigator, footer);
      modal.append(backdrop, dialog);

      const urls = results.map((result) => URL.createObjectURL(result.blob));
      let index = 0;
      let settled = false;
      const close = (shouldSave) => {
        if (settled) return;
        settled = true;
        if (capture.previewClose === close) capture.previewClose = null;
        document.removeEventListener("keydown", handleKeydown, true);
        modal.remove();
        urls.forEach((url) => URL.revokeObjectURL(url));
        resolve(shouldSave === true);
      };
      const render = () => {
        const result = results[index];
        image.src = urls[index];
        pageText.textContent = `${index + 1} / ${results.length}`;
        fileInfo.textContent = result.filename;
        previousButton.disabled = index === 0;
        nextButton.disabled = index === results.length - 1;
      };
      const handleKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(false);
        } else if (event.key === "ArrowLeft" && index > 0) {
          index -= 1;
          render();
        } else if (event.key === "ArrowRight" && index < results.length - 1) {
          index += 1;
          render();
        }
      };
      backdrop.addEventListener("click", () => close(false));
      closeButton.addEventListener("click", () => close(false));
      cancelButton.addEventListener("click", () => close(false));
      saveButton.addEventListener("click", () => close(true));
      previousButton.addEventListener("click", () => {
        if (index <= 0) return;
        index -= 1;
        render();
      });
      nextButton.addEventListener("click", () => {
        if (index >= results.length - 1) return;
        index += 1;
        render();
      });
      capture.previewClose = close;
      document.addEventListener("keydown", handleKeydown, true);
      document.body.appendChild(modal);
      render();
      dialog.focus({ preventScroll: true });
    });
  }

  async function renderCaptureChunk(
    state,
    items,
    index,
    total,
    stamp,
    resourceCache,
  ) {
    const renderer = globalThis.htmlToImage;
    if (!renderer || typeof renderer.toBlob !== "function") {
      throw new Error("html-to-image unavailable");
    }
    const built = buildCaptureStage(state, items);
    if (!built) throw new Error("capture stage unavailable");
    try {
      wrapCaptureUnicodeEmojis(built.surface);
      await inlineCaptureImages(built.surface, resourceCache);
      await waitForCaptureImages(built.surface);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      stabilizeCaptureItemHeights(built.surface);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      stabilizeCaptureItemHeights(built.surface);
      await yieldCaptureMainThread();
      const blob = await renderer.toBlob(built.surface, {
        backgroundColor: getCaptureBackground(state),
        pixelRatio: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
        skipFonts: true,
        cacheBust: false,
        imagePlaceholder: TRANSPARENT_PNG,
      });
      if (!(blob instanceof Blob)) throw new Error("capture blob unavailable");
      return {
        blob,
        filename: createCaptureFilename(index, total, stamp),
      };
    } finally {
      built.stage.remove();
    }
  }

  async function captureSelectedChats(state) {
    const capture = ensureCaptureState(state);
    if (!capture.active || capture.busy || capture.selectedKeys.size === 0) {
      return false;
    }
    const selectedItems = getCaptureItems(state).filter((item) =>
      capture.selectedKeys.has(getItemKey(item)),
    );
    if (selectedItems.length === 0) {
      syncCaptureUi(state);
      return false;
    }
    const chunks = [];
    for (let index = 0; index < selectedItems.length; index += CHUNK_SIZE) {
      chunks.push(selectedItems.slice(index, index + CHUNK_SIZE));
    }
    capture.runToken += 1;
    const runToken = capture.runToken;
    capture.busy = true;
    capture.progressCurrent = 1;
    capture.progressTotal = chunks.length;
    syncCaptureUi(state);
    const resourceCache = new Map();
    try {
      const results = [];
      const captureStamp = createCaptureStamp();
      if (document.fonts?.ready) await document.fonts.ready;
      for (let index = 0; index < chunks.length; index += 1) {
        if (capture.runToken !== runToken) return false;
        await yieldCaptureMainThread();
        capture.progressCurrent = index + 1;
        syncCaptureUi(state);
        results.push(
          await renderCaptureChunk(
            state,
            chunks[index],
            index,
            chunks.length,
            captureStamp,
            resourceCache,
          ),
        );
        await yieldCaptureMainThread();
      }
      if (capture.runToken !== runToken) return false;
      capture.busy = false;
      capture.progressCurrent = 0;
      capture.progressTotal = 0;
      syncCaptureUi(state);
      const shouldSave =
        state?.settings?.showCapturePreview === true
          ? await createCapturePreviewModal(state, results)
          : true;
      if (!shouldSave || capture.runToken !== runToken) return false;
      results.forEach((result) => downloadBlob(result.blob, result.filename));
      resetCaptureSelection(state);
      return true;
    } catch (error) {
      console.error("[badge-moa] PNG capture failed", error);
      window.alert("선택한 채팅을 PNG로 저장하지 못했습니다.");
      return false;
    } finally {
      resourceCache.clear();
      if (capture.runToken === runToken) {
        capture.busy = false;
        capture.progressCurrent = 0;
        capture.progressTotal = 0;
        syncCaptureUi(state);
      }
    }
  }

  ns.captureApi = {
    getEntryCaptureKey,
    syncCaptureUi,
    resetCaptureSelection,
    toggleCaptureSelectionMode,
    toggleAllCaptureItems,
    handleCapturePointerDown,
    handleCapturePointerMove,
    handleCapturePointerEnd,
    handleCaptureListClick,
    handleCaptureListKeydown,
    captureSelectedChats,
  };
})();
