(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.observerApi && typeof ns.observerApi === "object") return;
  const HIGHLIGHT_CLASS_LIST = [
    "chzzk-badge-moa-chat-highlight",
    "chzzk-badge-moa-chat-highlight-manager",
    "chzzk-badge-moa-chat-highlight-operator",
    "chzzk-badge-moa-chat-highlight-channel_owner",
    "chzzk-badge-moa-chat-highlight-owner",
    "chzzk-badge-moa-chat-highlight-partner",
  ];
  const HIGHLIGHT_TYPE_ATTR = "data-chzzk-badge-moa-highlight";

  function startObserver(state, refs, deps = {}) {
    if (refs.observer) return;

    const ensureUi = typeof deps.ensureUi === "function" ? deps.ensureUi : () => {};
    const refreshChatHighlightObserver =
      typeof deps.refreshChatHighlightObserver === "function"
        ? deps.refreshChatHighlightObserver
        : () => {};

    refs.observer = new MutationObserver(() => {
      const uiStable =
        state?.ui?.root &&
        state.ui.root.isConnected &&
        state?.ui?.header &&
        state.ui.header.isConnected;
      const highlightObserverStable =
        refs.chatHighlightObserver &&
        state?.chatListContainer &&
        state.chatListContainer.isConnected;
      if (uiStable && highlightObserverStable) return;

      if (refs.ensureQueued) return;
      refs.ensureQueued = true;
      requestAnimationFrame(() => {
        refs.ensureQueued = false;
        ensureUi();
        refreshChatHighlightObserver();
      });
    });

    const root = document.documentElement || document.body;
    if (!root) return;

    refs.observer.observe(root, { childList: true, subtree: true });
  }

  function onWindowMessage(state, refs, event, deps = {}) {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const messageMark = deps.MESSAGE_MARK;
    const data = event.data;
    if (!data || typeof data !== "object" || data[messageMark] !== true) {
      return;
    }

    const handleLocationChange =
      typeof deps.handleLocationChange === "function"
        ? deps.handleLocationChange
        : () => {};
    const enqueueIncomingPayload =
      typeof deps.enqueueIncomingPayload === "function"
        ? deps.enqueueIncomingPayload
        : () => {};
    const scheduleChatHighlightScan =
      typeof deps.scheduleChatHighlightScan === "function"
        ? deps.scheduleChatHighlightScan
        : () => {};

    if (data.type === "CHZZK_URL_CHANGED") {
      handleLocationChange(true);
      return;
    }

    if (data.type === "CHZZK_CHAT_CHANNEL_ID") {
      const chatChannelId =
        data.payload && typeof data.payload === "object"
          ? String(data.payload.chatChannelId || "").trim()
          : "";
      if (chatChannelId && /^[A-Za-z0-9_-]{2,32}$/.test(chatChannelId)) {
        state.chatChannelId = chatChannelId;
      }
      return;
    }

    if (data.type !== "CHZZK_CHAT_LOG") return;

    handleLocationChange(false);
    enqueueIncomingPayload(data.payload);
    if (!refs.chatHighlightObserver || !state.chatListContainer) {
      scheduleChatHighlightScan();
    }
  }

  function enqueueIncomingPayload(state, payload, deps = {}) {
    state.incoming.queue.push(payload);
    const scheduleIncomingPayloadFlush =
      typeof deps.scheduleIncomingPayloadFlush === "function"
        ? deps.scheduleIncomingPayloadFlush
        : () => {};
    scheduleIncomingPayloadFlush();
  }

  function scheduleIncomingPayloadFlush(state, deps = {}) {
    if (state.incoming.flushQueued) return;
    state.incoming.flushQueued = true;
    const flushIncomingPayloads =
      typeof deps.flushIncomingPayloads === "function"
        ? deps.flushIncomingPayloads
        : () => {};
    requestAnimationFrame(() => {
      flushIncomingPayloads();
    });
  }

  function flushIncomingPayloads(state, deps = {}) {
    state.incoming.flushQueued = false;
    if (state?.incoming?.pauseProcessing === true) {
      return;
    }
    if (!Array.isArray(state.incoming.queue) || state.incoming.queue.length === 0) {
      return;
    }

    const updateResolvedChannelIdFromPayload =
      typeof deps.updateResolvedChannelIdFromPayload === "function"
        ? deps.updateResolvedChannelIdFromPayload
        : () => {};
    const appendBadgeChat =
      typeof deps.appendBadgeChat === "function" ? deps.appendBadgeChat : () => null;
    const render = typeof deps.render === "function" ? deps.render : () => {};

    const normalizeChannelId =
      typeof deps.normalizeChannelId === "function"
        ? deps.normalizeChannelId
        : (v) => String(v || "").trim();
    const isStableChannelId =
      typeof deps.isStableChannelId === "function"
        ? deps.isStableChannelId
        : () => false;

    const queue = state.incoming.queue.splice(0, state.incoming.queue.length);
    let appendedCount = 0;
    for (let i = 0; i < queue.length; i += 1) {
      const payload = queue[i];
      updateResolvedChannelIdFromPayload(payload);
      if (state?.incoming?.pauseProcessing === true) {
        const remaining = queue.slice(i);
        if (remaining.length > 0) {
          state.incoming.queue.unshift(...remaining);
        }
        break;
      }
      const currentChannelId = normalizeChannelId(state.resolvedChannelId);
      if (isStableChannelId(currentChannelId) && payload) {
        const payloadChannelId = normalizeChannelId(
          payload.streamingChannelId || payload.channelId || "",
        );
        if (
          isStableChannelId(payloadChannelId) &&
          payloadChannelId !== currentChannelId
        ) {
          continue;
        }
      }
      const appended = appendBadgeChat(payload, {
        deferRender: true,
        skipAttention: false,
      });
      if (appended) {
        appendedCount += 1;
      }
    }

    if (state?.incoming?.pauseProcessing === true) {
      return;
    }
    if (appendedCount > 0) {
      render();
    }
  }

  function refreshChatHighlightObserver(state, refs, deps = {}) {
    const findChatListContainer =
      typeof deps.findChatListContainer === "function"
        ? deps.findChatListContainer
        : () => null;
    const processHighlightNode =
      typeof deps.processHighlightNode === "function"
        ? deps.processHighlightNode
        : () => {};
    const applyHighlightToItem =
      typeof deps.applyHighlightToItem === "function"
        ? deps.applyHighlightToItem
        : () => {};
    const chatItemSelector = String(deps.CHAT_ITEM_SELECTOR || "");

    const container = findChatListContainer();
    if (!container) {
      state.chatListContainer = null;
      if (refs.chatHighlightObserver) {
        refs.chatHighlightObserver.disconnect();
        refs.chatHighlightObserver = null;
      }
      return;
    }

    if (refs.chatHighlightObserver && state.chatListContainer === container) {
      return;
    }

    if (refs.chatHighlightObserver) {
      refs.chatHighlightObserver.disconnect();
      refs.chatHighlightObserver = null;
    }

    state.chatListContainer = container;
    refs.chatHighlightObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;

        if (mutation.target instanceof Element) {
          const targetItem = mutation.target.closest(chatItemSelector);
          if (targetItem) applyHighlightToItem(targetItem);
        }

        mutation.addedNodes.forEach((node) => {
          processHighlightNode(node);
        });
      }
    });

    refs.chatHighlightObserver.observe(container, {
      childList: true,
      subtree: true,
    });
  }

  function findChatListContainer(state, deps = {}) {
    const isVideoPage = typeof deps.isVideoPage === "function" ? deps.isVideoPage : () => false;
    const isLikelyVisibleElement =
      typeof deps.isLikelyVisibleElement === "function"
        ? deps.isLikelyVisibleElement
        : () => false;
    const vodListSelectors = Array.isArray(deps.VOD_CHAT_LIST_CONTAINER_SELECTORS)
      ? deps.VOD_CHAT_LIST_CONTAINER_SELECTORS
      : [];
    const liveListSelectors = Array.isArray(deps.LIVE_CHAT_LIST_CONTAINER_SELECTORS)
      ? deps.LIVE_CHAT_LIST_CONTAINER_SELECTORS
      : [];
    const chatItemSelector = String(deps.CHAT_ITEM_SELECTOR || "");
    const vodItemSelector = String(deps.VOD_CHAT_ITEM_SELECTOR || "");
    const liveItemSelector = String(deps.LIVE_CHAT_ITEM_SELECTOR || "");

    const selectors = isVideoPage()
      ? vodListSelectors
      : liveListSelectors;

    let visibleFallback = null;
    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (!(candidate instanceof Element)) continue;
        if (!isLikelyVisibleElement(candidate)) continue;
        if (!visibleFallback) {
          visibleFallback = candidate;
        }
        if (!candidate.querySelector(chatItemSelector)) continue;
        return candidate;
      }
    }

    if (visibleFallback) {
      return visibleFallback;
    }

    const fallbackItem = document.querySelector(
      isVideoPage() ? vodItemSelector : liveItemSelector,
    );
    if (
      fallbackItem instanceof Element &&
      fallbackItem.parentElement instanceof Element
    ) {
      return fallbackItem.parentElement;
    }

    return null;
  }

  function isLikelyVisibleElement(element) {
    if (!(element instanceof Element)) return false;
    if (!element.isConnected) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    return true;
  }

  function processHighlightNode(node, deps = {}) {
    if (!(node instanceof Element)) return;
    const matchesChatItem =
      typeof deps.matchesChatItem === "function" ? deps.matchesChatItem : () => false;
    const applyHighlightToItem =
      typeof deps.applyHighlightToItem === "function"
        ? deps.applyHighlightToItem
        : () => {};
    const chatItemSelector = String(deps.CHAT_ITEM_SELECTOR || "");

    if (matchesChatItem(node)) {
      applyHighlightToItem(node);
    }

    const items = node.querySelectorAll(chatItemSelector);
    items.forEach((item) => applyHighlightToItem(item));
  }

  function scheduleChatHighlightScan(refs, deps = {}) {
    if (refs.chatScanQueued) return;
    const now = Date.now();
    const lastScanAt = Number(refs.lastChatScanAt || 0);
    if (now - lastScanAt < 300) return;
    refs.chatScanQueued = true;

    const applyHighlightToAll =
      typeof deps.applyHighlightToAll === "function" ? deps.applyHighlightToAll : () => {};
    requestAnimationFrame(() => {
      refs.chatScanQueued = false;
      refs.lastChatScanAt = Date.now();
      applyHighlightToAll();
    });
  }

  function applyHighlightToAll(state, deps = {}) {
    const findChatListContainer =
      typeof deps.findChatListContainer === "function"
        ? deps.findChatListContainer
        : () => null;
    const applyHighlightToItem =
      typeof deps.applyHighlightToItem === "function"
        ? deps.applyHighlightToItem
        : () => {};
    const chatItemSelector = String(deps.CHAT_ITEM_SELECTOR || "");

    const container = state.chatListContainer || findChatListContainer();
    if (!container) {
      const fallbackItems = document.querySelectorAll(chatItemSelector);
      fallbackItems.forEach((item) => applyHighlightToItem(item));
      return;
    }
    state.chatListContainer = container;
    const items = container.querySelectorAll(chatItemSelector);
    items.forEach((item) => applyHighlightToItem(item));
  }

  function applyHighlightToItem(item, deps = {}) {
    if (!(item instanceof Element)) return;
    const matchesChatItem =
      typeof deps.matchesChatItem === "function" ? deps.matchesChatItem : () => false;
    const detectBadgeTypeFromItem =
      typeof deps.detectBadgeTypeFromItem === "function"
        ? deps.detectBadgeTypeFromItem
        : () => "";
    if (!matchesChatItem(item)) return;

    const previousType = String(item.getAttribute(HIGHLIGHT_TYPE_ATTR) || "");
    const badgeType = detectBadgeTypeFromItem(item);
    if (badgeType === previousType) return;

    if (!badgeType && !previousType) return;
    item.classList.remove(...HIGHLIGHT_CLASS_LIST);
    if (!badgeType) {
      item.removeAttribute(HIGHLIGHT_TYPE_ATTR);
      return;
    }

    item.classList.add(
      "chzzk-badge-moa-chat-highlight",
      `chzzk-badge-moa-chat-highlight-${badgeType}`,
    );
    item.setAttribute(HIGHLIGHT_TYPE_ATTR, badgeType);
  }

  function detectBadgeTypeFromItem(item, deps = {}) {
    const hasChannelOwnerBadge =
      typeof deps.hasChannelOwnerBadge === "function"
        ? deps.hasChannelOwnerBadge
        : () => false;
    const hasManagerBadge =
      typeof deps.hasManagerBadge === "function" ? deps.hasManagerBadge : () => false;
    const hasOperatorBadge =
      typeof deps.hasOperatorBadge === "function"
        ? deps.hasOperatorBadge
        : () => false;
    const hasPartnerMark =
      typeof deps.hasPartnerMark === "function" ? deps.hasPartnerMark : () => false;

    if (hasChannelOwnerBadge(item)) return "channel_owner";
    if (hasManagerBadge(item)) return "manager";
    if (hasOperatorBadge(item)) return "operator";
    if (hasPartnerMark(item)) return "partner";
    return "";
  }

  function hasManagerBadge(item) {
    return !!item.querySelector(
      "img[src*='/icon/manager.png'], img[alt*='채널 관리자'], img[alt*='채팅 운영자'], img[alt*='manager']",
    );
  }

  function hasOperatorBadge(item) {
    const images = item.querySelectorAll("img");
    for (const img of images) {
      const src = String(img.getAttribute("src") || "")
        .trim()
        .toLowerCase();
      if (src.includes("/icon/owner.png")) return true;

      const alt = String(img.getAttribute("alt") || "")
        .trim()
        .toLowerCase();
      const title = String(img.getAttribute("title") || "")
        .trim()
        .toLowerCase();
      const metaText = `${alt} ${title}`.trim();
      if (!metaText) continue;

      const looksLikeOperator =
        metaText.includes("네이버 게임 운영자") ||
        metaText.includes("치지직 운영자");
      const looksLikeManager =
        metaText.includes("채팅 운영자") ||
        metaText.includes("채널 관리자") ||
        metaText.includes("manager");
      if (looksLikeOperator && !looksLikeManager) {
        return true;
      }
    }
    return false;
  }

  function hasChannelOwnerBadge(item) {
    return !!item.querySelector(
      "img[src*='/icon/streamer'], img[alt*='스트리머'], img[alt*='방장'], img[alt*='채널 주인'], img[alt*='broadcaster']",
    );
  }

  function hasPartnerMark(item) {
    const blindNodes = item.querySelectorAll(".blind");
    for (const node of blindNodes) {
      const text = String(node.textContent || "").trim();
      if (text.includes("인증 마크")) return true;
    }

    return !!item.querySelector(
      "img[alt*='파트너'], img[src*='icon_official_mark']",
    );
  }

  function matchesChatItem(node) {
    return (
      node instanceof Element &&
      typeof node.className === "string" &&
      (node.className.includes("live_chatting_list_item") ||
        node.className.includes("vod_chatting_item"))
    );
  }

  ns.observerApi = {
    startObserver,
    onWindowMessage,
    enqueueIncomingPayload,
    scheduleIncomingPayloadFlush,
    flushIncomingPayloads,
    refreshChatHighlightObserver,
    findChatListContainer,
    isLikelyVisibleElement,
    processHighlightNode,
    scheduleChatHighlightScan,
    applyHighlightToAll,
    applyHighlightToItem,
    detectBadgeTypeFromItem,
    hasManagerBadge,
    hasOperatorBadge,
    hasChannelOwnerBadge,
    hasPartnerMark,
    matchesChatItem,
  };
})();
