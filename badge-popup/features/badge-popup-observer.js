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
  const HIDDEN_CHAT_ELEMENT_CLASSES = [
    "chzzk-badge-moa-hidden-chat-ranking",
    "chzzk-badge-moa-hidden-chat-mission",
    "chzzk-badge-moa-hidden-chat-mission-message",
    "chzzk-badge-moa-hidden-chat-prediction",
    "chzzk-badge-moa-hidden-chat-subscription",
    "chzzk-badge-moa-hidden-chat-donation",
  ];
  const HIDDEN_CHAT_ELEMENT_CLASS_BY_SETTING = {
    hideChatRanking: "chzzk-badge-moa-hidden-chat-ranking",
    hideChatMission: "chzzk-badge-moa-hidden-chat-mission",
    hideChatMissionMessage: "chzzk-badge-moa-hidden-chat-mission-message",
    hideChatPrediction: "chzzk-badge-moa-hidden-chat-prediction",
    hideChatSubscription: "chzzk-badge-moa-hidden-chat-subscription",
    hideChatDonation: "chzzk-badge-moa-hidden-chat-donation",
  };

  function startObserver(state, refs, deps = {}) {
    if (refs.observer) return;

    const ensureUi = typeof deps.ensureUi === "function" ? deps.ensureUi : () => {};
    const refreshChatHighlightObserver =
      typeof deps.refreshChatHighlightObserver === "function"
        ? deps.refreshChatHighlightObserver
        : () => {};
    const scheduleHiddenChatElementSync =
      typeof deps.scheduleHiddenChatElementSync === "function"
        ? deps.scheduleHiddenChatElementSync
        : () => {};

    refs.observer = new MutationObserver(() => {
      scheduleHiddenChatElementSync();

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

  function hasHiddenChatElementSettings(state) {
    const settings = state?.settings || {};
    return (
      settings.hideChatRanking === true ||
      settings.hideChatMission === true ||
      settings.hideChatMissionMessage === true ||
      settings.hideChatPrediction === true ||
      settings.hideChatSubscription === true ||
      settings.hideChatDonation === true
    );
  }

  function scheduleHiddenChatElementSync(state, refs, deps = {}) {
    if (!hasHiddenChatElementSettings(state)) return;
    if (refs.hiddenChatElementSyncQueued) return;
    const now = Date.now();
    const lastSyncAt = Number(refs.lastHiddenChatElementSyncAt || 0);
    if (now - lastSyncAt < 300) return;
    refs.hiddenChatElementSyncQueued = true;

    const applyHiddenChatElements =
      typeof deps.applyHiddenChatElements === "function"
        ? deps.applyHiddenChatElements
        : () => {};
    requestAnimationFrame(() => {
      refs.hiddenChatElementSyncQueued = false;
      refs.lastHiddenChatElementSyncAt = Date.now();
      applyHiddenChatElements();
    });
  }

  function addHiddenClass(element, className) {
    if (element instanceof HTMLElement) {
      element.classList.add(className);
    }
  }

  function getDisabledHiddenChatElementClasses(settings = {}) {
    return Object.entries(HIDDEN_CHAT_ELEMENT_CLASS_BY_SETTING)
      .filter(([settingName]) => settings[settingName] !== true)
      .map(([, className]) => className);
  }

  function removeHiddenClasses(classes, scope = document) {
    if (!classes.length) return;
    safeQueryAll(scope, `.${classes.join(", .")}`).forEach((element) => {
      if (element instanceof HTMLElement) {
        element.classList.remove(...classes);
      }
    });
  }

  function findClosestContainer(element) {
    return safeClosest(element, "[class*='_container_']");
  }

  function findClosestChatItem(element) {
    const item = safeClosest(element, "[class*='_item_']");
    if (!(item instanceof HTMLElement)) return null;
    const className = String(item.className || "");
    if (
      className.includes("_small_padding_") ||
      className.includes("_big_padding_")
    ) {
      return item;
    }
    return null;
  }

  // scope(자기 자신 포함) 안에서 selector에 맞는 요소를 모은다.
  function queryAllWithSelf(scope, selector) {
    const matches = safeQueryAll(scope, selector);
    if (scope instanceof Element && safeMatches(scope, selector)) {
      matches.push(scope);
    }
    return matches;
  }

  function safeMatches(element, selector) {
    if (!(element instanceof Element) || typeof element.matches !== "function") {
      return false;
    }
    try {
      return element.matches(selector);
    } catch (_error) {
      return false;
    }
  }

  // 주어진 scope(전체 aside 또는 새로 추가된 노드) 안에서 숨김 대상 채팅
  // 요소에 숨김 클래스를 적용한다. MutationObserver에서 노드 추가 즉시
  // 동기적으로 호출하면 페인트 전에 display:none이 적용되어 깜빡임이 없다.
  function applyHiddenChatElementsInScope(state, scope) {
    if (!hasHiddenChatElementSettings(state)) return;
    if (!(scope instanceof Element)) return;
    const settings = state?.settings || {};

    if (settings.hideChatRanking === true) {
      queryAllWithSelf(scope, "button[class*='_ranking_button_']").forEach(
        (button) => {
          addHiddenClass(
            findClosestContainer(button),
            "chzzk-badge-moa-hidden-chat-ranking",
          );
        },
      );
    }

    if (settings.hideChatMission === true) {
      queryAllWithSelf(scope, "button[class*='_mission_button_']").forEach(
        (button) => {
          addHiddenClass(
            findClosestContainer(button),
            "chzzk-badge-moa-hidden-chat-mission",
          );
        },
      );
    }

    if (settings.hideChatMissionMessage === true) {
      queryAllWithSelf(scope, "[class*='_is_mission_']").forEach((badge) => {
        addHiddenClass(
          findClosestChatItem(badge),
          "chzzk-badge-moa-hidden-chat-mission-message",
        );
      });
    }

    if (settings.hideChatPrediction === true) {
      queryAllWithSelf(scope, "[class*='_status_']").forEach((status) => {
        const container = findClosestContainer(status);
        if (container && container.querySelector("button[class*='_title_']")) {
          addHiddenClass(container, "chzzk-badge-moa-hidden-chat-prediction");
        }
      });
    }

    if (settings.hideChatSubscription === true) {
      queryAllWithSelf(scope, "[class*='_is_subscription_']").forEach(
        (badge) => {
          addHiddenClass(
            findClosestChatItem(badge),
            "chzzk-badge-moa-hidden-chat-subscription",
          );
        },
      );
    }

    if (settings.hideChatDonation === true) {
      queryAllWithSelf(scope, "[class*='_is_donation_']").forEach((badge) => {
        addHiddenClass(
          findClosestChatItem(badge),
          "chzzk-badge-moa-hidden-chat-donation",
        );
      });
    }
  }

  // 새로 추가된 노드에 대해 동기적으로 숨김을 적용한다(깜빡임 방지용).
  function applyHiddenChatElementsToNode(state, node) {
    if (!hasHiddenChatElementSettings(state)) return;
    applyHiddenChatElementsInScope(state, node);
  }

  function applyHiddenChatElements(state) {
    const settings = state?.settings || {};
    const disabledClasses = hasHiddenChatElementSettings(state)
      ? getDisabledHiddenChatElementClasses(settings)
      : HIDDEN_CHAT_ELEMENT_CLASSES;
    removeHiddenClasses(disabledClasses);

    if (!hasHiddenChatElementSettings(state)) return;

    const asides = safeQueryAll(document, "aside#aside-chatting, aside#vod-aside");
    asides.forEach((aside) => applyHiddenChatElementsInScope(state, aside));
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
    const syncBlindCaptureToInject =
      typeof deps.syncBlindCaptureToInject === "function"
        ? deps.syncBlindCaptureToInject
        : () => {};
    const syncChatTimestampToInject =
      typeof deps.syncChatTimestampToInject === "function"
        ? deps.syncChatTimestampToInject
        : () => {};

    if (data.type === deps.INJECT_CHAT_FEATURES_REQUEST_TYPE) {
      syncBlindCaptureToInject();
      syncChatTimestampToInject();
      return;
    }

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
      // 이 탭이 아직 자기 채널을 확정하지 못했으면 append 를 보류한다. 확정 전에 붙이면
      // 채널 없는 이벤트(미션 등)나 초기 채팅이 엉뚱한 채널로 귀속돼 캐시가 오염된다.
      // 남은 payload 는 큐에 되돌려 두고, 채널이 잡히는 다음 flush(다음 수신 메시지나
      // 위치 변경 시 자동 호출)에서 처리한다. 채널이 끝내 안 잡히는 경우(예: 홈)를 대비해
      // 보류 큐 크기를 상한으로 제한한다.
      if (!isStableChannelId(currentChannelId)) {
        const remaining = queue.slice(i);
        if (remaining.length > 0) {
          const HELD_QUEUE_MAX = Number(deps.MAX_KEEP_ENTRIES) || 500;
          const trimmed =
            remaining.length > HELD_QUEUE_MAX
              ? remaining.slice(remaining.length - HELD_QUEUE_MAX)
              : remaining;
          state.incoming.queue.unshift(...trimmed);
        }
        break;
      }
      if (payload) {
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
    const applyHiddenChatElementsToNode =
      typeof deps.applyHiddenChatElementsToNode === "function"
        ? deps.applyHiddenChatElementsToNode
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
          const targetItem = safeClosest(mutation.target, chatItemSelector);
          if (targetItem) applyHighlightToItem(targetItem);
        }

        mutation.addedNodes.forEach((node) => {
          // 페인트 전에 동기적으로 숨김을 적용해 깜빡임을 방지한다.
          applyHiddenChatElementsToNode(node);
          processHighlightNode(node);
        });
      }
    });

    refs.chatHighlightObserver.observe(container, {
      childList: true,
      subtree: true,
    });

    // 옵저버는 부착 이후 추가되는 항목만 처리하므로, 부착 시점에 이미 존재하는
    // 항목들을 즉시 한 번 훑어 하이라이트/숨김 적용한다(초기 적용 지연 방지).
    applyHiddenChatElementsToNode(container);
    safeQueryAll(container, chatItemSelector).forEach((item) =>
      applyHighlightToItem(item),
    );
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

    // 페이지 타입은 우선순위 힌트일 뿐, 다시보기(#vod-aside)가 라이브 경로에서
    // 뜰 수도 있어 두 셀렉터 집합을 모두 시도한다.
    const selectors = isVideoPage()
      ? [...vodListSelectors, ...liveListSelectors]
      : [...liveListSelectors, ...vodListSelectors];

    let visibleFallback = null;
    for (const selector of selectors) {
      const candidates = safeQueryAll(document, selector);
      for (const candidate of candidates) {
        if (!(candidate instanceof Element)) continue;
        if (!isLikelyVisibleElement(candidate)) continue;
        // 후보 안에 실제 채팅 항목(matchesChatItem 통과)이 있어야 한다.
        const items = safeQueryAll(candidate, chatItemSelector);
        const hasChatItem = items.some((item) => matchesChatItem(item));
        if (!visibleFallback && hasChatItem) {
          visibleFallback = candidate;
        }
        if (hasChatItem) return candidate;
      }
    }

    if (visibleFallback) {
      return visibleFallback;
    }

    const fallbackItem = [
      ...safeQueryAll(document, vodItemSelector),
      ...safeQueryAll(document, liveItemSelector),
    ].find((item) => matchesChatItem(item));
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

  // :has 등 일부 셀렉터가 환경에 따라 throw할 수 있어 안전하게 감싼다.
  function safeQueryAll(scope, selector) {
    if (!scope || typeof scope.querySelectorAll !== "function" || !selector) {
      return [];
    }
    try {
      return Array.from(scope.querySelectorAll(selector));
    } catch (_error) {
      return [];
    }
  }

  function safeClosest(node, selector) {
    if (!(node instanceof Element) || typeof node.closest !== "function" || !selector) {
      return null;
    }
    try {
      return node.closest(selector);
    } catch (_error) {
      return null;
    }
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

    const items = safeQueryAll(node, chatItemSelector);
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
      const fallbackItems = safeQueryAll(document, chatItemSelector);
      fallbackItems.forEach((item) => applyHighlightToItem(item));
      return;
    }
    state.chatListContainer = container;
    const items = safeQueryAll(container, chatItemSelector);
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
    if (!(node instanceof Element)) return false;
    const className = typeof node.className === "string" ? node.className : "";
    // 구버전 클래스
    if (
      className.includes("live_chatting_list_item") ||
      className.includes("vod_chatting_item")
    ) {
      return true;
    }
    // 새 구조: 클래스명이 빌드마다 바뀌므로 채팅 메시지(_chatting_message_)와
    // 닉네임 버튼(_nickname_ + aria-haspopup)을 가진 항목을 채팅으로 본다.
    return isNewChatItem(node);
  }

  // 새 치지직 채팅 항목 판별: 직접 자식으로 메시지 컨테이너를 가지며 그 안에
  // 닉네임 버튼이 있다. (라이브/다시보기 공통 내부 구조)
  function isNewChatItem(node) {
    if (!(node instanceof Element)) return false;
    const message = node.querySelector("[class*='_chatting_message_']");
    if (!(message instanceof Element)) return false;
    if (!node.contains(message)) return false;
    // 너무 상위(리스트 컨테이너 등)가 잡히지 않도록, 메시지가 항목의 가까운
    // 후손인지 확인한다(컨테이너 한두 단계 이내).
    const messageItem = message.closest(
      "[class*='_item_'], [class*='chatting_list_item'], [class*='vod_chatting_item']",
    );
    if (messageItem && messageItem !== node) return false;
    return !!node.querySelector("button[aria-haspopup='true'][class*='_nickname_']");
  }

  ns.observerApi = {
    startObserver,
    onWindowMessage,
    enqueueIncomingPayload,
    scheduleIncomingPayloadFlush,
    flushIncomingPayloads,
    scheduleHiddenChatElementSync,
    applyHiddenChatElements,
    applyHiddenChatElementsToNode,
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
