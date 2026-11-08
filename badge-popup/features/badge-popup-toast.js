(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.toastApi && typeof ns.toastApi === "object") return;

  // 새 배지 채팅 토스트 알림.
  // 채팅창 헤더 바로 아래에 잠시 띄운다. 누를 때 동작은 설정(chatToastClickAction):
  //  - "popup"(기본): 읽지 않은 채팅이 하나면 그 채팅을, 여럿이면
  //    "OOO 외 N명의 채팅 M개" 요약을 보여 주고, 누르면 모아보기 팝업을 연다.
  //  - "list": 가장 최근 채팅 아래로 카드가 겹쳐 보이고(+N), 누르면 그 자리에서
  //    채팅 목록이 펼쳐진다. 카드를 누르면 팝업을 열어 그 채팅으로 이동한다.

  const TOAST_CLASS = "chzzk-badge-moa-toast";
  // 표시 시간: 떠 있는 동안 새 채팅이 오면 다시 visibleMs 동안 보이되,
  // 처음 뜬 때부터 visibleMs + MAX_EXTEND_MS 를 넘기지 않는다.
  // 커스텀의 "계속 표시"면 직접 닫거나 팝업을 열 때까지 남는다.
  const VISIBLE_MS = 5000;
  const MAX_EXTEND_MS = 7000;
  const HOVER_LEAVE_MS = 2500;
  const UPDATE_DELAY_MS = 120;
  const MIN_ANCHOR_WIDTH = 160;
  // 알림 목록: 팝업을 열거나 모두 지울 때까지 대상 채팅을 모아 둔다.
  const MAX_QUEUE = 200;
  // 펼친 목록은 개수 제한 없이(모아 둔 MAX_QUEUE 개까지) 정해진 높이 안에서 스크롤한다.
  // 카드 캡처는 지금 목록에 절반 이상 보이는 카드만 담는다.
  const VISIBLE_CARD_RATIO = 0.5;
  // 펼친 목록 높이: 아래 손잡이를 끌어 조절하고(모아보기 팝업처럼) 저장해 둔다.
  const LIST_HEIGHT_STORAGE_KEY = "chzzk_badge_moa_toast_list_height";
  const LIST_HEIGHT_DEFAULT = 360;
  const LIST_HEIGHT_MIN = 120;
  // 흐림 막은 펼친 목록 아래로 이만큼만 더 덮는다.
  const BACKDROP_EXTRA_PX = 28;
  // 팝업이 열리며 맨 아래로 맞추는 동작(최대 360ms)이 끝난 뒤 이동한다.
  const JUMP_DELAY_MS = 420;
  const JUMP_HIGHLIGHT_MS = 1800;

  // 알림 빈도: gatherMs 동안 모았다가 한 번에 띄우고, 사라진 뒤 cooldownMs 동안은
  // 새 토스트를 띄우지 않는다(그동안 온 채팅은 다음 토스트에 합쳐진다).
  // 토스트가 떠 있는 동안 온 채팅은 빈도와 관계없이 떠 있는 토스트 내용만 바꾼다.
  const FREQUENCY_TIMING = {
    high: { gatherMs: 600, cooldownMs: 0 },
    normal: { gatherMs: 1500, cooldownMs: 5000 },
    low: { gatherMs: 3000, cooldownMs: 10000 },
  };

  const BADGE_TYPES = [
    "channel_owner",
    "manager",
    "operator",
    "partner",
    "custom",
  ];

  function normalizeFrequency(value) {
    return value === "high" || value === "low" || value === "custom"
      ? value
      : "normal";
  }

  function normalizeClickAction(value) {
    return value === "list" ? "list" : "popup";
  }

  // 펼친 알림 목록 순서: newest(최신순) | oldest(과거순)
  function getListOrder(state) {
    return state?.settings?.chatToastListOrder === "oldest"
      ? "oldest"
      : "newest";
  }

  function getClickAction(state) {
    return normalizeClickAction(state?.settings?.chatToastClickAction);
  }

  function clampMs(value, fallback, maxMs) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.min(maxMs, Math.max(0, num)) : fallback;
  }

  function normalizeBadgeTypes(value) {
    if (!Array.isArray(value)) return BADGE_TYPES.slice();
    const allowed = new Set(BADGE_TYPES);
    return BADGE_TYPES.filter(
      (type) => allowed.has(type) && value.includes(type),
    );
  }

  function ensureToastState(state) {
    if (!state.toast || typeof state.toast !== "object") {
      state.toast = {
        element: null,
        body: null,
        visible: false,
        shownAt: 0,
        cooldownUntil: 0,
        gatherTimer: 0,
        hideTimer: 0,
        updateTimer: 0,
        hovering: false,
        expanded: false,
        queue: [],
        // 눌러서 본 구독권 선물 닉네임(토스트를 접거나 닫으면 다시 가린다)
        revealedKeys: new Set(),
        listHeight: 0,
        listHeightLoaded: false,
        lastEntry: null,
        listenersBound: false,
        deps: {},
      };
    }
    return state.toast;
  }

  function isTopFrame() {
    try {
      return window.top === window;
    } catch (_error) {
      return false;
    }
  }

  function isMoaWindowContext() {
    try {
      return new URLSearchParams(window.location.search).get("moaOnly") === "1";
    } catch (_error) {
      return false;
    }
  }

  // 토스트를 띄울 수 있는 화면인지. 멀티뷰처럼 iframe 안의 채팅창이나 모아보기 전용 창,
  // 전용 창을 따로 열어 둔 탭에서는 띄우지 않는다.
  function isToastContextAllowed(state) {
    if (state?.settings?.chatToastEnabled !== true) return false;
    if (!isTopFrame() || isMoaWindowContext()) return false;
    if (state?.hasDetachedMoaWindow === true) return false;
    return true;
  }

  function getTargetBadgeTypes(state) {
    return new Set(normalizeBadgeTypes(state?.settings?.chatToastBadgeTypes));
  }

  function isEntryTarget(state, entry, deps) {
    if (!entry || !entry.nickname) return false;
    if (!getTargetBadgeTypes(state).has(String(entry.badgeType || ""))) {
      return false;
    }
    const isHidden =
      typeof deps.isPillNicknameHidden === "function"
        ? deps.isPillNicknameHidden
        : () => false;
    return !isHidden(entry.nickname);
  }

  // 알림 대상 배지의 읽지 않은 채팅 요약. 최근에 채팅한 사람이 앞에 온다.
  function getUnseenSummary(state, deps) {
    const getActors =
      typeof deps.getUnseenActorsForPill === "function"
        ? deps.getUnseenActorsForPill
        : () => [];
    const targets = getTargetBadgeTypes(state);
    const actors = getActors().filter((actor) =>
      targets.has(String(actor?.badgeType || "")),
    );
    const count = actors.reduce(
      (sum, actor) => sum + Math.max(0, Number(actor?.count || 0) || 0),
      0,
    );
    return { actors, count };
  }

  function clearTimer(toast, key) {
    if (toast[key]) clearTimeout(toast[key]);
    toast[key] = 0;
  }

  function getTiming(state) {
    const settings = state?.settings || {};
    const frequency = normalizeFrequency(settings.chatToastFrequency);
    if (frequency === "custom") {
      return {
        gatherMs: clampMs(settings.chatToastGatherMs, 1500, 10000),
        cooldownMs: clampMs(settings.chatToastCooldownMs, 5000, 60000),
        visibleMs: Math.max(
          2000,
          clampMs(settings.chatToastVisibleMs, VISIBLE_MS, 30000),
        ),
        keepVisible: settings.chatToastKeepVisible === true,
      };
    }
    return {
      ...FREQUENCY_TIMING[frequency],
      visibleMs: VISIBLE_MS,
      keepVisible: false,
    };
  }

  function getChatHeader(state) {
    return state?.ui?.header instanceof HTMLElement && state.ui.header.isConnected
      ? state.ui.header
      : null;
  }

  function getChatAside(state) {
    const header = getChatHeader(state);
    const aside =
      (header && header.closest("aside")) ||
      document.querySelector("aside#aside-chatting") ||
      document.querySelector("aside#vod-aside");
    return aside instanceof HTMLElement ? aside : null;
  }

  // 펼친 목록 뒤의 채팅창 영역을 흐리게 덮는 막(설정에서 끌 수 있다).
  function syncBackdrop(state) {
    const toast = ensureToastState(state);
    const show =
      toast.visible &&
      toast.expanded &&
      state?.settings?.chatToastBackdropBlur !== false;
    let backdrop = toast.backdrop;
    if (!show) {
      backdrop?.classList.remove("is-visible");
      return;
    }
    if (!(backdrop instanceof HTMLElement) || !backdrop.isConnected) {
      backdrop = document.createElement("div");
      backdrop.className = `${TOAST_CLASS}-backdrop`;
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        collapseToast(state);
      });
      (document.body || document.documentElement).appendChild(backdrop);
      toast.backdrop = backdrop;
    }
    const aside = getChatAside(state);
    if (!aside) {
      backdrop.classList.remove("is-visible");
      return;
    }
    const rect = aside.getBoundingClientRect();
    // 채팅창 전체가 아니라 펼친 목록 아래 여유분까지만 덮는다.
    const toastBottom =
      toast.element instanceof HTMLElement
        ? toast.element.getBoundingClientRect().bottom
        : rect.bottom;
    const bottom = Math.min(rect.bottom, toastBottom + BACKDROP_EXTRA_PX);
    backdrop.style.top = `${Math.round(rect.top)}px`;
    backdrop.style.left = `${Math.round(rect.left)}px`;
    backdrop.style.width = `${Math.round(rect.width)}px`;
    backdrop.style.height = `${Math.max(0, Math.round(bottom - rect.top))}px`;
    backdrop.classList.add("is-visible");
  }

  // 토스트 위치: 채팅 헤더 바로 아래, 채팅창 너비에 맞춘다.
  function getAnchorRect(state) {
    const header = getChatHeader(state);
    const aside = getChatAside(state);
    if (!aside) return null;
    const asideRect = aside.getBoundingClientRect();
    if (asideRect.width < MIN_ANCHOR_WIDTH || asideRect.height <= 0) return null;
    const headerRect = header ? header.getBoundingClientRect() : null;
    const top =
      headerRect && headerRect.height > 0 ? headerRect.bottom : asideRect.top;
    return {
      top: Math.max(0, top) + 6,
      left: asideRect.left + 8,
      width: asideRect.width - 16,
    };
  }

  function positionToast(state) {
    const toast = ensureToastState(state);
    const element = toast.element;
    if (!(element instanceof HTMLElement)) return false;
    const rect = getAnchorRect(state);
    if (!rect) return false;
    const top = Math.round(rect.top);
    const left = Math.round(rect.left);
    const width = Math.round(rect.width);
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
    element.style.width = `${width}px`;
    const widthChanged = toast.anchorWidth !== width;
    toast.anchorKey = `${top}|${left}|${width}`;
    toast.anchorWidth = width;
    if (toast.expanded) {
      // 창 크기가 바뀌면 목록이 채팅창 밖으로 나가지 않게 다시 맞춘다.
      applyListHeight(state);
      syncBackdrop(state);
      if (widthChanged) syncPanelCompact(state);
    }
    return true;
  }

  // 채팅창이 크기는 그대로인 채 자리만 옮겨지면(다른 확장 프로그램이 좌우를 바꾸는 등)
  // ResizeObserver 가 알려 주지 않으므로, 떠 있는 동안만 가끔 자리를 확인한다.
  const ANCHOR_POLL_MS = 500;

  function checkAnchorMoved(state) {
    const toast = ensureToastState(state);
    if (!toast.visible || document.hidden) return;
    const rect = getAnchorRect(state);
    if (!rect) {
      hideToast(state);
      return;
    }
    const key = `${Math.round(rect.top)}|${Math.round(rect.left)}|${Math.round(rect.width)}`;
    if (key === toast.anchorKey) return;
    watchAnchor(state);
    positionToast(state);
  }

  function createIconButton(className, label, svgPath) {
    return createSvgIconButton(className, label, `<path d="${svgPath}"/>`);
  }

  // Lucide 아이콘(ISC, THIRD_PARTY_NOTICES.md 참고):
  // app-window, camera, trash-2, clock-arrow-down(최신순), clock-arrow-up(과거순)
  const ICON_CLOCK_ARROW_DOWN =
    '<path d="M12 6v6l2 1"/><path d="M12.337 21.994a10 10 0 1 1 9.588-8.767"/><path d="m14 18 4 4 4-4"/><path d="M18 14v8"/>';
  const ICON_CLOCK_ARROW_UP =
    '<path d="M12 6v6l1.56.78"/><path d="M13.227 21.925a10 10 0 1 1 8.767-9.588"/><path d="m14 18 4-4 4 4"/><path d="M18 22v-8"/>';
  const ICON_TRASH =
    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
  const ICON_APP_WINDOW =
    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/>';
  const ICON_CAMERA =
    '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/>';

  function createSvgIconButton(className, label, shapes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes}</svg>`;
    return button;
  }

  // 구조: 토스트(위치·애니메이션) > 카드(배경·테두리) + 겹친 카드 모양.
  // 카드 안: 접힌 내용(body)·닫기 버튼, 펼친 목록(panel).
  // 토스트는 좌표를 직접 잡으므로, 떠 있는 동안 채팅창·헤더의 크기가 바뀌면 따라간다
  // (페이지 로딩 중 배치 변경, 넓은 화면 전환, 채팅창 너비 조절 등).
  function watchAnchor(state) {
    const toast = ensureToastState(state);
    if (!toast.anchorPoll) {
      toast.anchorPoll = setInterval(
        () => checkAnchorMoved(state),
        ANCHOR_POLL_MS,
      );
    }
    if (typeof ResizeObserver !== "function") return;
    const header = getChatHeader(state);
    const aside = getChatAside(state);
    if (
      toast.anchorObserver &&
      toast.watchedHeader === header &&
      toast.watchedAside === aside
    ) {
      return;
    }
    if (!toast.anchorObserver) {
      toast.anchorObserver = new ResizeObserver(() => {
        if (toast.visible && !positionToast(state)) hideToast(state);
      });
    }
    toast.anchorObserver.disconnect();
    toast.watchedHeader = header;
    toast.watchedAside = aside;
    if (aside) toast.anchorObserver.observe(aside);
    if (header) toast.anchorObserver.observe(header);
  }

  function unwatchAnchor(toast) {
    if (toast.anchorPoll) clearInterval(toast.anchorPoll);
    toast.anchorPoll = 0;
    toast.anchorObserver?.disconnect();
    toast.watchedHeader = null;
    toast.watchedAside = null;
  }

  // 채팅 헤더가 새로 만들어졌을 때(ensureUi) 떠 있는 토스트를 새 헤더에 맞춘다.
  function reposition(state) {
    const toast = ensureToastState(state);
    if (!toast.visible) return;
    watchAnchor(state);
    if (!positionToast(state)) hideToast(state);
  }

  function ensureToastElement(state) {
    const toast = ensureToastState(state);
    if (toast.element instanceof HTMLElement && toast.element.isConnected) {
      return toast.element;
    }
    const element = document.createElement("div");
    element.className = TOAST_CLASS;
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");

    const card = document.createElement("div");
    card.className = `${TOAST_CLASS}-card`;

    const body = document.createElement("button");
    body.type = "button";
    body.className = `${TOAST_CLASS}-body`;
    const content = document.createElement("span");
    content.className = `${TOAST_CLASS}-content`;
    const more = document.createElement("span");
    more.className = `${TOAST_CLASS}-more`;
    more.hidden = true;
    body.append(content, more);

    const close = createIconButton(
      `${TOAST_CLASS}-close`,
      "알림 닫기",
      "M6 6l12 12M18 6 6 18",
    );

    const panel = document.createElement("div");
    panel.className = `${TOAST_CLASS}-panel`;
    panel.hidden = true;

    const stack = document.createElement("span");
    stack.className = `${TOAST_CLASS}-stack`;
    stack.setAttribute("aria-hidden", "true");
    stack.append(document.createElement("span"), document.createElement("span"));

    body.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (getClickAction(state) === "list") {
        expandToast(state);
        return;
      }
      // 알림 버튼을 숨긴 경우에도 토스트로는 모아보기 팝업을 열 수 있다.
      openPopupFromToast(state);
    });
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideToast(state);
    });
    element.addEventListener("mouseenter", () => {
      toast.hovering = true;
      clearTimer(toast, "hideTimer");
    });
    element.addEventListener("mouseleave", () => {
      toast.hovering = false;
      if (!toast.visible || toast.expanded) return;
      clearTimer(toast, "hideTimer");
      const timing = getTiming(state);
      if (timing.keepVisible) return;
      toast.hideTimer = setTimeout(
        () => hideToast(state),
        Math.min(HOVER_LEAVE_MS, timing.visibleMs),
      );
    });

    card.append(body, close, panel);
    element.append(card, stack);
    (document.body || document.documentElement).appendChild(element);
    toast.element = element;
    toast.body = body;
    toast.content = content;
    toast.more = more;
    toast.panel = panel;
    return element;
  }

  function bindGlobalListeners(state) {
    const toast = ensureToastState(state);
    if (toast.listenersBound) return;
    toast.listenersBound = true;
    // 채팅창이 사라지거나 접혀 붙을 자리가 없으면 토스트를 거둔다.
    window.addEventListener("resize", () => {
      if (toast.visible && !positionToast(state)) hideToast(state);
    });
    // 펼친 목록은 바깥을 누르거나 Esc 로 접는다.
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!toast.expanded || !toast.visible) return;
        const target = event.target;
        if (
          toast.captureMenu &&
          !(target instanceof Node && toast.captureMenu.element.parentElement?.contains(target))
        ) {
          closeCaptureMenu(state);
        }
        if (target instanceof Node && toast.element?.contains(target)) return;
        if (target instanceof Node && toast.backdrop?.contains(target)) return;
        collapseToast(state);
      },
      true,
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || !toast.expanded || !toast.visible) return;
        event.stopPropagation();
        if (toast.captureMenu) {
          const button = toast.captureMenu.button;
          closeCaptureMenu(state);
          button.focus();
          return;
        }
        collapseToast(state, { focusBody: true });
      },
      true,
    );
    // 다른 탭을 보는 동안 미뤄 둔 알림은 돌아왔을 때 띄운다.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !toast.pendingWhileHidden) return;
      toast.pendingWhileHidden = false;
      flushToast(state);
    });
  }

  function appendPlainText(fragment, text) {
    if (text) fragment.appendChild(document.createTextNode(text));
  }

  function createBadges(badges) {
    const renderApi = ns.renderApi;
    if (!renderApi || typeof renderApi.createBadgeList !== "function") return null;
    const list = renderApi.createBadgeList(badges, "pill");
    if (!(list instanceof HTMLElement) || list.childNodes.length === 0) {
      return null;
    }
    list.classList.add(`${TOAST_CLASS}-badges`);
    return list;
  }

  // 배지·닉네임·인증 마크. 알림 버튼과 같이 역할 배지는 닉네임 앞에,
  // 인증 마크(파트너·챌린저·오피셜)는 닉네임 뒤에 붙인다.
  function appendIdentity(container, identity) {
    const pillBadges = Array.isArray(identity?.pillBadges)
      ? identity.pillBadges
      : [];
    const partnerMark =
      identity?.partnerMark ||
      pillBadges.find((badge) => badge && badge.type === "partner") ||
      null;
    const badges = createBadges(
      pillBadges.filter((badge) => badge && badge.type !== "partner"),
    );
    if (badges) container.appendChild(badges);
    container.appendChild(
      createNickname(identity?.nickname, identity?.titleColor),
    );
    const createBadgeVisual = ns.renderApi?.createBadgeVisual;
    if (partnerMark && typeof createBadgeVisual === "function") {
      const mark = createBadgeVisual(partnerMark, "pillpartnermark");
      if (mark instanceof HTMLElement) {
        mark.classList.add(`${TOAST_CLASS}-mark`);
        container.appendChild(mark);
      }
    }
  }

  function createNickname(nickname, titleColor) {
    const element = document.createElement("strong");
    element.className = `${TOAST_CLASS}-nickname`;
    element.textContent = String(nickname || "");
    if (titleColor) element.style.color = titleColor;
    return element;
  }

  // 채팅 시각: 모아보기 팝업과 같은 시간 표시 형식을 쓴다.
  function createEntryTime(state, entry) {
    const formatTime = ns.renderApi?.formatTime;
    const timestamp = Number(entry?.timestamp);
    if (typeof formatTime !== "function" || !Number.isFinite(timestamp)) {
      return null;
    }
    const time = document.createElement("time");
    time.className = `${TOAST_CLASS}-time`;
    // 날짜는 카드 밖 날짜 머리글(createDateHeader)로 보여 주고, 카드에는 시각만 둔다.
    time.textContent = formatTime(
      timestamp,
      state?.settings?.popupTimestampFormat || "24h",
    );
    try {
      time.dateTime = new Date(timestamp).toISOString();
    } catch (_error) {}
    return time;
  }

  // 채팅 하나: 배지·닉네임(·시각) + (특수 채팅 칩) 본문. 본문은 길면 말줄임한다.
  function renderSingleEntry(body, entry, options = {}) {
    const renderApi = ns.renderApi || {};
    const head = document.createElement("span");
    head.className = `${TOAST_CLASS}-head`;
    appendIdentity(head, entry);
    if (options.state && options.showTime) {
      const time = createEntryTime(options.state, entry);
      if (time) head.appendChild(time);
    }

    const message = document.createElement("span");
    message.className = `${TOAST_CLASS}-message`;
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    let cheeseRow = null;
    if (options.popupStyle) {
      // 펼친 카드: 모아보기 팝업과 같이 종류 태그는 닉네임 옆에,
      // 후원 치즈는 본문 아래 치즈 배지로 보여 준다.
      const isCheese = (tag) => String(tag?.tone || "").startsWith("donation-");
      const tagRow =
        typeof renderApi.createMessageTagRow === "function"
          ? renderApi.createMessageTagRow(tags.filter((tag) => !isCheese(tag)))
          : null;
      if (tagRow instanceof HTMLElement) {
        tagRow.classList.add(`${TOAST_CLASS}-tags`);
        const time = head.querySelector(`.${TOAST_CLASS}-time`);
        head.insertBefore(tagRow, time);
      }
      const cheeseTags = tags.filter(isCheese);
      if (cheeseTags.length > 0) {
        cheeseRow = document.createElement("span");
        cheeseRow.className = `chzzk-badge-moa-item-cheese ${TOAST_CLASS}-cheese`;
        cheeseTags.forEach((tag) => {
          const cheese = document.createElement("em");
          cheese.className = `chzzk-badge-moa-item-cheese-amount is-${String(tag.tone || "donation-neutral")}`;
          cheese.textContent = String(tag.label || "").replace(/치즈$/, "");
          const blind = document.createElement("span");
          blind.className = "blind";
          blind.textContent = "치즈";
          cheese.appendChild(blind);
          cheeseRow.appendChild(cheese);
        });
      }
    } else {
      tags.forEach((tag) => {
        const label = String(tag?.label || "").trim();
        if (!label) return;
        const chip = document.createElement("span");
        chip.className = `${TOAST_CLASS}-chip is-${String(tag.tone || "neutral")}`;
        chip.textContent = label;
        message.appendChild(chip);
      });
    }
    const text = String(entry.message || "");
    if (entry.gift && typeof renderApi.buildGiftMessageContent === "function") {
      // 구독권 선물: 모아보기 팝업과 같은 문구·색. 일반 시청자 닉네임은 가려 둔다.
      const toast = options.state ? ensureToastState(options.state) : null;
      const key = String(entry.dedupeKey || "");
      message.appendChild(
        renderApi.buildGiftMessageContent(options.state, entry.gift, {
          revealed: !!toast && toast.revealedKeys.has(key),
          onReveal: () => {
            if (toast && key) toast.revealedKeys.add(key);
          },
        }),
      );
    } else if (text && typeof renderApi.buildMessageContent === "function") {
      // 토스트를 누르면 팝업이 열리므로 본문의 링크는 일반 글자로 둔다.
      message.appendChild(
        renderApi.buildMessageContent(text, entry.emojis, {
          appendTextWithLinks: appendPlainText,
        }),
      );
    } else if (text) {
      message.appendChild(document.createTextNode(text));
    }

    body.append(head);
    if (message.childNodes.length > 0) body.append(message);
    if (cheeseRow) body.append(cheeseRow);
    body.dataset.label =
      `${entry.nickname} 배지 채팅: ${text || entry.typeLabel || ""}`.trim();
  }

  // 여러 개: "OOO 채팅 N개가 있어요" / "OOO 외 N명의 채팅 M개가 있어요"
  function renderSummary(body, summary) {
    const [latest] = summary.actors;
    const others = summary.actors.length - 1;
    const line = document.createElement("span");
    line.className = `${TOAST_CLASS}-summary`;
    appendIdentity(line, latest);
    const rest = document.createElement("span");
    rest.className = `${TOAST_CLASS}-summary-text`;
    rest.textContent =
      others > 0
        ? ` 외 ${others}명의 채팅 ${summary.count}개가 있어요`
        : ` 채팅 ${summary.count}개가 있어요`;
    line.appendChild(rest);
    body.append(line);
    body.dataset.label = `${latest.nickname}${rest.textContent}`;
  }

  // 알림 목록에 모아 둔 채팅 중 지금도 보여 줄 것(숨김·제외·삭제된 것 빼고).
  function getQueuedEntries(state) {
    const toast = ensureToastState(state);
    const keys = state?.dedupeKeys instanceof Set ? state.dedupeKeys : null;
    return toast.queue.filter(
      (entry) =>
        isEntryTarget(state, entry, toast.deps) &&
        (!keys || !entry.dedupeKey || keys.has(entry.dedupeKey)),
    );
  }

  function rememberEntry(state, entry) {
    const toast = ensureToastState(state);
    const key = String(entry?.dedupeKey || "");
    if (key && toast.queue.some((item) => item.dedupeKey === key)) return;
    toast.queue.push(entry);
    if (toast.queue.length > MAX_QUEUE) {
      toast.queue.splice(0, toast.queue.length - MAX_QUEUE);
    }
  }

  // 목록 모드의 접힌 모양: 가장 최근 채팅 + 겹친 카드 + "+N".
  function renderStackContent(state, entries) {
    const toast = ensureToastState(state);
    const latest = entries[entries.length - 1];
    const rest = entries.length - 1;
    renderSingleEntry(toast.content, latest, { state, showTime: true });
    toast.more.hidden = rest <= 0;
    toast.more.textContent = rest > 0 ? `+${rest}` : "";
    toast.element.classList.add("is-single");
    toast.element.classList.toggle("is-stacked", rest > 0);
    const label = toast.content.dataset.label || "";
    toast.body.setAttribute(
      "aria-label",
      rest > 0 ? `${label}, 외 ${rest}개. 눌러서 알림 목록 펼치기` : label,
    );
    toast.body.setAttribute("aria-expanded", String(toast.expanded));
    toast.body.title = "알림 목록 펼치기";
  }

  function createPanelButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${TOAST_CLASS}-panel-btn${className ? ` ${className}` : ""}`;
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  // 채팅 시각 순(오래된 것부터). 다시보기는 되감으면 도착 순서와 시각이 달라진다.
  function sortByChatTime(entries) {
    return entries.slice().sort(
      (a, b) =>
        (Number(a?.timestamp) || 0) - (Number(b?.timestamp) || 0) ||
        (Number(a?.sequence) || 0) - (Number(b?.sequence) || 0),
    );
  }

  // 펼친 목록의 날짜 머리글(카드 밖).
  function createDateHeader(timestamp, dateKey) {
    const label = ns.renderApi?.formatDateLabel?.(timestamp) || "";
    if (!label) return null;
    const header = document.createElement("div");
    header.className = `${TOAST_CLASS}-date`;
    header.dataset.dateKey = dateKey;
    header.setAttribute("role", "listitem");
    const text = document.createElement("span");
    text.className = `${TOAST_CLASS}-date-text`;
    text.textContent = label;
    header.appendChild(text);
    return header;
  }

  // 머리줄의 목록 순서 버튼: 아이콘은 지금 순서, 누르면 반대로 바꾸고 설정에도 저장한다.
  function createOrderButton(state) {
    const oldest = getListOrder(state) === "oldest";
    const current = oldest ? "과거순" : "최신순";
    const next = oldest ? "최신순" : "과거순";
    const button = createSvgIconButton(
      `${TOAST_CLASS}-panel-icon ${TOAST_CLASS}-order-btn`,
      `목록 순서: ${current}. 누르면 ${next}으로 바꿉니다`,
      oldest ? ICON_CLOCK_ARROW_UP : ICON_CLOCK_ARROW_DOWN,
    );
    button.title = `${current} · 누르면 ${next}`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleListOrder(state);
    });
    return button;
  }

  function toggleListOrder(state) {
    const toast = ensureToastState(state);
    if (!state?.settings) return;
    const hadFocus =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.classList.contains(`${TOAST_CLASS}-order-btn`);
    state.settings.chatToastListOrder =
      getListOrder(state) === "oldest" ? "newest" : "oldest";
    // 설정 화면의 "목록 순서"와 다른 탭도 같은 값을 쓰도록 저장한다.
    if (typeof toast.deps.saveSettings === "function") toast.deps.saveSettings();
    // 다시 그려도 보던 카드는 제자리에 남는다(renderListMode).
    renderListMode(state);
    if (hadFocus) {
      toast.panelHead?.querySelector(`.${TOAST_CLASS}-order-btn`)?.focus();
    }
  }

  // 목록 모드의 펼친 모양: 머리줄(개수·버튼) + 채팅 카드 목록.
  function renderPanel(state, queuedEntries) {
    const toast = ensureToastState(state);
    const entries = sortByChatTime(queuedEntries);
    const panel = toast.panel;
    panel.textContent = "";

    const head = document.createElement("div");
    head.className = `${TOAST_CLASS}-panel-head`;
    const title = document.createElement("span");
    title.className = `${TOAST_CLASS}-panel-title`;
    const newBadge = document.createElement("span");
    newBadge.className = `${TOAST_CLASS}-new`;
    newBadge.textContent = "New";
    // 좁으면(is-compact) "New"와 "개"를 빼고 숫자만 색 알약으로 보여 준다.
    const count = document.createElement("span");
    count.className = `${TOAST_CLASS}-panel-count`;
    const countNum = document.createElement("span");
    countNum.className = `${TOAST_CLASS}-panel-num`;
    countNum.textContent = String(entries.length);
    const countUnit = document.createElement("span");
    countUnit.className = `${TOAST_CLASS}-panel-unit`;
    countUnit.textContent = "개";
    count.append(countNum, countUnit);
    // 스크롤해 날짜 머리글이 위로 지나가면 지금 보는 날짜를 줄여 보여 준다.
    const dateLabel = document.createElement("span");
    dateLabel.className = `${TOAST_CLASS}-panel-date`;
    dateLabel.hidden = true;
    title.append(newBadge, count, dateLabel);
    title.setAttribute("aria-label", `새 배지 채팅 ${entries.length}개`);
    title.title = `새 배지 채팅 ${entries.length}개`;
    toast.panelHead = head;
    toast.panelDate = dateLabel;
    const actions = document.createElement("span");
    actions.className = `${TOAST_CLASS}-panel-actions`;
    const openButton = createSvgIconButton(
      `${TOAST_CLASS}-panel-icon`,
      "모아보기 팝업 열기",
      ICON_APP_WINDOW,
    );
    openButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPopupFromToast(state);
    });
    const captureWrap = document.createElement("span");
    captureWrap.className = `${TOAST_CLASS}-capture-wrap`;
    const captureButton = createSvgIconButton(
      `${TOAST_CLASS}-panel-icon`,
      "캡처",
      ICON_CAMERA,
    );
    captureButton.setAttribute("aria-haspopup", "menu");
    captureButton.setAttribute("aria-expanded", "false");
    captureButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleCaptureMenu(state, captureWrap, captureButton, entries);
    });
    captureWrap.append(captureButton);
    // 좁으면 글자 대신 아이콘만 보인다.
    const clearButton = createPanelButton("", "", () => clearAllFromToast(state));
    clearButton.setAttribute("aria-label", "모두 지우기");
    clearButton.title = "모두 지우기";
    clearButton.innerHTML = `<span class="${TOAST_CLASS}-panel-btn-label">모두 지우기</span><svg class="${TOAST_CLASS}-panel-btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_TRASH}</svg>`;
    actions.append(createOrderButton(state), openButton, captureWrap, clearButton);
    const collapse = createIconButton(
      `${TOAST_CLASS}-panel-collapse`,
      "목록 접기",
      "m18 15-6-6-6 6",
    );
    collapse.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      collapseToast(state, { focusBody: true });
    });
    actions.append(collapse);
    head.append(title, actions);

    const list = document.createElement("div");
    list.className = `${TOAST_CLASS}-list`;
    list.setAttribute("role", "list");
    let lastDateKey = "";
    (getListOrder(state) === "oldest" ? entries : entries.slice().reverse())
      .forEach((entry) => {
        // 날짜가 바뀌는 곳마다 카드 밖에 날짜 머리글을 둔다(라이브·다시보기 모두).
        const dateKey = ns.renderApi?.getDateKey?.(entry.timestamp) || "";
        if (dateKey && dateKey !== lastDateKey) {
          const header = createDateHeader(entry.timestamp, dateKey);
          if (header) list.appendChild(header);
        }
        lastDateKey = dateKey;
        const item = document.createElement("button");
        item.type = "button";
        item.className = `${TOAST_CLASS}-item`;
        item.dataset.entryKey = String(entry.dedupeKey || "");
        item.dataset.dateKey = dateKey;
        item.dataset.timestamp = String(Number(entry.timestamp) || 0);
        item.setAttribute("role", "listitem");
        // 후원·구독 등 특수 채팅은 모아보기 팝업과 같은 색으로 칠한다.
        const toneClass =
          typeof ns.renderApi?.getItemTypeToneClass === "function"
            ? ns.renderApi.getItemTypeToneClass(entry)
            : "";
        if (toneClass) {
          item.classList.add(
            "is-typed",
            toneClass.replace("chzzk-badge-moa-item-type-", "is-type-"),
          );
        }
        // 특정 사람에게 준 구독권 선물은 팝업과 같이 회색 바탕
        if (ns.renderApi?.getGiftItemClass?.(entry)) {
          item.classList.add("is-gift-direct");
        }
        const itemContent = document.createElement("span");
        itemContent.className = `${TOAST_CLASS}-content`;
        renderSingleEntry(itemContent, entry, {
          state,
          showTime: true,
          popupStyle: true,
        });
        item.setAttribute(
          "aria-label",
          `${itemContent.dataset.label || ""}. 눌러서 모아보기에서 보기`,
        );
        item.title = "모아보기에서 이 채팅 보기";
        item.appendChild(itemContent);
        item.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openPopupFromToast(state, entry);
        });
        list.appendChild(item);
      });
    panel.append(head, list, createListResizer(state));
    toast.list = list;
    // 스크롤하면 보이는 카드 수(열린 캡처 메뉴 문구)와 제목 옆 날짜를 맞춘다.
    let scrollFrame = 0;
    list.addEventListener(
      "scroll",
      () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          syncCaptureMenuCount(state);
          updatePanelDate(state);
        });
      },
      { passive: true },
    );
  }

  // 머리줄이 넘치면(채팅창이 좁으면) 줄인 모양으로 바꾼다.
  // 1단계 is-compact: "New"·"개"를 빼고 숫자만, "모두 지우기"는 아이콘만.
  // 2단계 is-tight: 그래도 넘치면 개수와 날짜 중 하나만 보인다.
  //   스크롤해 날짜가 보이는 동안(has-date)은 날짜, 아니면 개수(CSS).
  // 3단계 is-tighter: 그래도 넘치면 순서 버튼도 뺀다(설정에서는 바꿀 수 있다).
  const COMPACT_STEPS = ["is-compact", "is-tight", "is-tighter"];

  function syncPanelCompact(state) {
    const toast = ensureToastState(state);
    const head = toast.panelHead;
    if (!(head instanceof HTMLElement) || !head.isConnected) return;
    const title = head.querySelector(`.${TOAST_CLASS}-panel-title`);
    const overflowing = () =>
      head.scrollWidth > head.clientWidth + 1 ||
      (title instanceof HTMLElement && title.scrollWidth > title.clientWidth + 1);
    // 스크롤하면 날짜가 나타나므로 날짜가 보인다고 치고 단계를 정한다.
    // (그러지 않으면 스크롤할 때마다 버튼이 생겼다 사라지며 머리줄이 흔들린다.)
    const label = toast.panelDate;
    const realText = label ? label.textContent : "";
    const realHidden = label ? label.hidden : true;
    const hadDate = head.classList.contains("has-date");
    if (label) {
      // 실제 날짜보다 좁게 재면 날짜가 바뀔 때 단계가 흔들리므로 늘 넓은 쪽으로 잰다.
      label.textContent =
        realText.length > "12.31.".length ? realText : "12.31.";
      label.hidden = false;
      head.classList.add("has-date");
    }
    head.classList.remove(...COMPACT_STEPS);
    for (const step of COMPACT_STEPS) {
      if (!overflowing()) break;
      head.classList.add(step);
    }
    if (label) {
      label.textContent = realText;
      label.hidden = realHidden;
      head.classList.toggle("has-date", hadDate);
    }
  }

  // 제목 옆 날짜: 같은 해면 "11.7.", 다른 해면 "25.11.7."
  function formatShortDate(timestamp) {
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime()) || Number(timestamp) <= 0) return "";
    const year =
      date.getFullYear() === new Date().getFullYear()
        ? ""
        : `${String(date.getFullYear()).slice(-2)}.`;
    return `${year}${date.getMonth() + 1}.${date.getDate()}.`;
  }

  // 맨 위에 보이는 카드의 날짜 머리글이 위로 지나갔으면 그 날짜를 제목 옆에 보여 준다.
  function updatePanelDate(state) {
    const toast = ensureToastState(state);
    const list = toast.list;
    const label = toast.panelDate;
    if (!(list instanceof HTMLElement) || !list.isConnected || !label) return;
    let text = "";
    if (list.scrollTop > 0) {
      const listTop = list.getBoundingClientRect().top + 1;
      const card = getListCards(list).find(
        (item) => item.getBoundingClientRect().bottom > listTop,
      );
      if (card) {
        const header = Array.from(
          list.querySelectorAll(`.${TOAST_CLASS}-date`),
        ).find((item) => item.dataset.dateKey === card.dataset.dateKey);
        if (!header || header.getBoundingClientRect().bottom <= listTop) {
          text = formatShortDate(card.dataset.timestamp);
        }
      }
    }
    if (label.textContent === text && label.hidden === !text) return;
    label.textContent = text;
    label.hidden = !text;
    toast.panelHead?.classList.toggle("has-date", !!text);
    syncPanelCompact(state);
  }

  // 목록 스크롤 영역에 절반 이상 보이는 카드
  function getVisibleCards(state) {
    const toast = ensureToastState(state);
    const list = toast.list;
    if (!(list instanceof HTMLElement) || !list.isConnected) return [];
    const listRect = list.getBoundingClientRect();
    return Array.from(list.querySelectorAll(`.${TOAST_CLASS}-item`)).filter(
      (card) => {
        const rect = card.getBoundingClientRect();
        if (rect.height <= 0) return false;
        const visible =
          Math.min(rect.bottom, listRect.bottom) -
          Math.max(rect.top, listRect.top);
        return visible >= rect.height * VISIBLE_CARD_RATIO;
      },
    );
  }

  function getCardCaptureDescription(state, count) {
    const captureApi = ns.captureApi || {};
    const copyAction =
      typeof captureApi.getCaptureAction === "function" &&
      captureApi.getCaptureAction(state) === "copy";
    return `지금 보이는 카드 ${count}개를 그대로 ${copyAction ? "클립보드에 복사합니다" : "PNG로 저장합니다"}. 스크롤하면 보이는 카드가 바뀝니다.`;
  }

  function syncCaptureMenuCount(state) {
    const toast = ensureToastState(state);
    const desc = toast.captureMenu?.cardDesc;
    if (!(desc instanceof HTMLElement)) return;
    desc.textContent = getCardCaptureDescription(
      state,
      getVisibleCards(state).length,
    );
  }

  // 캡처 버튼 메뉴: (가) 모아보기에서 골라 캡처 / (나) 카드 이미지로 저장·복사
  function closeCaptureMenu(state) {
    const toast = ensureToastState(state);
    const menu = toast.captureMenu;
    toast.captureMenu = null;
    if (!menu) return;
    menu.element.remove();
    menu.button.setAttribute("aria-expanded", "false");
  }

  function createCaptureMenuItem(title, description, disabled, onClick) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `${TOAST_CLASS}-menu-item`;
    item.setAttribute("role", "menuitem");
    item.disabled = disabled;
    const titleEl = document.createElement("span");
    titleEl.className = `${TOAST_CLASS}-menu-title`;
    titleEl.textContent = title;
    const descEl = document.createElement("span");
    descEl.className = `${TOAST_CLASS}-menu-desc`;
    descEl.textContent = description;
    item.append(titleEl, descEl);
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!item.disabled) onClick();
    });
    return item;
  }

  function toggleCaptureMenu(state, wrap, button, entries) {
    const toast = ensureToastState(state);
    if (toast.captureMenu) {
      closeCaptureMenu(state);
      return;
    }
    const captureApi = ns.captureApi || {};
    const captureEnabled = state?.settings?.showCaptureButton === true;
    const copyAction =
      typeof captureApi.getCaptureAction === "function" &&
      captureApi.getCaptureAction(state) === "copy";
    const cardCount = getVisibleCards(state).length;
    const menu = document.createElement("div");
    menu.className = `${TOAST_CLASS}-menu`;
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "캡처 방법");
    menu.append(
      createCaptureMenuItem(
        "모아보기에서 골라 캡처",
        captureEnabled
          ? `팝업의 캡처 선택 모드에서 이 채팅 ${entries.length}개를 미리 선택해 둡니다.`
          : "설정 > 캡처에서 '캡처 버튼 표시'를 켜면 쓸 수 있습니다.",
        !captureEnabled || typeof captureApi.startCaptureWithKeys !== "function",
        () => {
          closeCaptureMenu(state);
          captureInPopup(state, entries);
        },
      ),
      createCaptureMenuItem(
        copyAction ? "카드 이미지로 복사" : "카드 이미지로 저장",
        getCardCaptureDescription(state, cardCount),
        typeof captureApi.captureToastCards !== "function",
        () => {
          closeCaptureMenu(state);
          captureCards(state);
        },
      ),
    );
    wrap.appendChild(menu);
    button.setAttribute("aria-expanded", "true");
    toast.captureMenu = {
      element: menu,
      button,
      cardDesc: menu.querySelector(
        `.${TOAST_CLASS}-menu-item:nth-child(2) .${TOAST_CLASS}-menu-desc`,
      ),
    };
    if (button.matches(":focus-visible")) {
      menu.querySelector(`.${TOAST_CLASS}-menu-item:not(:disabled)`)?.focus();
    }
  }

  // (가) 팝업을 열고 캡처 선택 모드로 바꾼 뒤 목록의 채팅을 미리 선택한다.
  function captureInPopup(state, entries) {
    const toast = ensureToastState(state);
    const captureApi = ns.captureApi || {};
    const keys = entries
      .map((entry, index) => captureApi.getEntryCaptureKey?.(entry, index))
      .filter((key) => key && !String(key).startsWith("fallback:"));
    hideToast(state);
    if (typeof toast.deps.openPopup !== "function") return;
    toast.deps.openPopup();
    setTimeout(() => {
      const selected = captureApi.startCaptureWithKeys?.(state, keys) || 0;
      // 선택된 것 중 가장 오래된 채팅이 보이도록 옮긴다.
      if (selected > 0) jumpToEntry(state, entries[0], { highlight: false });
    }, JUMP_DELAY_MS);
  }

  // (나) 펼친 카드를 그대로 이미지로. 결과는 머리줄 제목 자리에 잠깐 보여 준다.
  function captureCards(state) {
    const toast = ensureToastState(state);
    const captureApi = ns.captureApi || {};
    const cards = getVisibleCards(state);
    if (typeof captureApi.captureToastCards !== "function" || !cards.length) {
      return;
    }
    // 캡처한 카드의 날짜 머리글도 함께 담는다(날짜가 바뀌는 곳마다).
    const nodes = [];
    let lastDateKey = "";
    cards.forEach((card) => {
      const dateKey = card.dataset.dateKey || "";
      if (dateKey && dateKey !== lastDateKey) {
        const header = Array.from(
          toast.list?.querySelectorAll(`.${TOAST_CLASS}-date`) || [],
        ).find((item) => item.dataset.dateKey === dateKey);
        if (header) nodes.push(header);
      }
      lastDateKey = dateKey;
      nodes.push(card);
    });
    const job = captureApi.captureToastCards(state, nodes, toast.element);
    showPanelStatus(state, "이미지 만드는 중…", "busy");
    Promise.resolve(job).then((result) => {
      showPanelStatus(
        state,
        result === "copied"
          ? "클립보드에 복사했습니다"
          : result === "saved"
            ? "PNG로 저장했습니다"
            : "캡처하지 못했습니다",
        result ? "done" : "error",
      );
    });
  }

  // 카드 캡처 진행 상태: 진행 중이면 스피너, 끝나면 체크(실패면 ✕) 애니메이션.
  // 제목 자리가 좁아 글자 대신 아이콘으로 보여 주고, 글은 화면 읽기·툴팁으로만 둔다.
  const STATUS_ICONS = {
    busy: '<span class="chzzk-badge-moa-toast-status-spinner"></span>',
    done: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="ring" cx="12" cy="12" r="9"/><path class="mark" d="m7.5 12.5 3 3 6-6.5"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="ring" cx="12" cy="12" r="9"/><path class="mark" d="M9 9l6 6M15 9l-6 6"/></svg>',
  };

  function showPanelStatus(state, message, variant) {
    const toast = ensureToastState(state);
    const title = toast.panel?.querySelector(`.${TOAST_CLASS}-panel-title`);
    if (!(title instanceof HTMLElement)) return;
    let status = title.querySelector(`.${TOAST_CLASS}-panel-status`);
    if (!(status instanceof HTMLElement)) {
      status = document.createElement("span");
      status.className = `${TOAST_CLASS}-panel-status`;
      status.setAttribute("role", "status");
      title.appendChild(status);
    }
    status.innerHTML = STATUS_ICONS[variant] || STATUS_ICONS.busy;
    const label = document.createElement("span");
    label.className = "blind";
    label.textContent = message;
    status.appendChild(label);
    status.dataset.variant = variant;
    title.title = message;
    title.classList.add("has-status");
    clearTimer(toast, "statusTimer");
    if (variant === "busy") return;
    toast.statusTimer = setTimeout(() => {
      toast.statusTimer = 0;
      status.remove();
      title.removeAttribute("title");
      title.classList.remove("has-status");
    }, 1600);
  }

  // 목록의 채팅 카드(날짜 머리글 제외)
  function getListCards(list) {
    return Array.from(list.querySelectorAll(`.${TOAST_CLASS}-item`));
  }

  // 목록을 다시 그려도 보던 카드가 그 자리에 남게 한다. 맨 위에 있었다면 맨 위 그대로.
  function readListAnchor(list) {
    if (!(list instanceof HTMLElement) || !list.isConnected) return null;
    if (list.scrollTop <= 0) return null;
    const listTop = list.getBoundingClientRect().top;
    const card = getListCards(list).find(
      (item) => item.getBoundingClientRect().bottom > listTop,
    );
    return {
      scrollTop: list.scrollTop,
      key: card?.dataset.entryKey || "",
      offset: card ? card.getBoundingClientRect().top - listTop : 0,
    };
  }

  function restoreListAnchor(list, anchor) {
    if (!anchor || !(list instanceof HTMLElement)) return;
    list.scrollTop = anchor.scrollTop;
    if (!anchor.key) return;
    const card = getListCards(list).find(
      (item) => item.dataset.entryKey === anchor.key,
    );
    if (!card) return;
    list.scrollTop +=
      card.getBoundingClientRect().top -
      list.getBoundingClientRect().top -
      anchor.offset;
  }

  function renderListMode(state) {
    const toast = ensureToastState(state);
    const entries = getQueuedEntries(state);
    if (entries.length === 0) return false;
    ensureToastElement(state);
    toast.content.textContent = "";
    renderStackContent(state, entries);
    toast.element.classList.toggle("is-expanded", toast.expanded);
    toast.panel.hidden = !toast.expanded;
    closeCaptureMenu(state);
    if (toast.expanded) {
      const anchor = readListAnchor(toast.list);
      renderPanel(state, entries);
      applyListHeight(state);
      restoreListAnchor(toast.list, anchor);
      syncPanelCompact(state);
      updatePanelDate(state);
    } else {
      toast.panel.textContent = "";
    }
    syncBackdrop(state);
    return true;
  }

  // ── 펼친 목록 높이 조절 ─────────────────────────────────────────────
  function getMaxListHeight(state) {
    const toast = ensureToastState(state);
    const list = toast.list;
    const aside = getChatAside(state);
    if (!(list instanceof HTMLElement) || !aside) return LIST_HEIGHT_DEFAULT;
    // 채팅창 아래쪽 끝까지(손잡이 자리를 남기고)
    const room =
      aside.getBoundingClientRect().bottom - list.getBoundingClientRect().top - 36;
    return Math.max(LIST_HEIGHT_MIN, Math.round(room));
  }

  function clampListHeight(state, height) {
    const value = Number(height);
    const base = Number.isFinite(value) && value > 0 ? value : LIST_HEIGHT_DEFAULT;
    return Math.round(
      Math.min(getMaxListHeight(state), Math.max(LIST_HEIGHT_MIN, base)),
    );
  }

  function applyListHeight(state) {
    const toast = ensureToastState(state);
    if (!toast.listHeightLoaded) loadListHeight(state);
    if (!(toast.list instanceof HTMLElement)) return;
    toast.list.style.maxHeight = `${clampListHeight(state, toast.listHeight)}px`;
  }

  function loadListHeight(state) {
    const toast = ensureToastState(state);
    toast.listHeightLoaded = true;
    const getValue = ns.storage?.getStorageValue;
    if (typeof getValue !== "function") return;
    Promise.resolve(getValue(LIST_HEIGHT_STORAGE_KEY))
      .then((value) => {
        const height = Number(value);
        if (!Number.isFinite(height) || height <= 0) return;
        toast.listHeight = height;
        if (toast.expanded && toast.visible) {
          applyListHeight(state);
          syncBackdrop(state);
        }
      })
      .catch(() => {});
  }

  // 설정 가져오기·전체 복원이나 다른 탭에서 목록 높이가 바뀌면 따라간다.
  function onStorageChanged(state, changes, areaName) {
    if (areaName !== "local" || !changes) return;
    const change = changes[LIST_HEIGHT_STORAGE_KEY];
    if (!change) return;
    const toast = ensureToastState(state);
    const height = Number(change.newValue);
    toast.listHeight = Number.isFinite(height) && height > 0 ? height : 0;
    toast.listHeightLoaded = true;
    if (toast.expanded && toast.visible) {
      applyListHeight(state);
      syncBackdrop(state);
    }
  }

  function saveListHeight(height) {
    const setValue = ns.storage?.setStorageValue;
    if (typeof setValue === "function") {
      setValue(LIST_HEIGHT_STORAGE_KEY, Math.round(height));
    }
  }

  // 목록 아래 손잡이: 끌어서 높이를 바꾸고, 놓으면 저장한다.
  function createListResizer(state) {
    const toast = ensureToastState(state);
    const handle = document.createElement("div");
    handle.className = `${TOAST_CLASS}-resizer`;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "horizontal");
    handle.setAttribute("aria-label", "알림 목록 높이 조절");
    handle.title = "끌어서 목록 높이 조절";
    handle.tabIndex = 0;
    let startY = 0;
    let startHeight = 0;
    let dragging = false;
    const setHeight = (height) => {
      toast.listHeight = clampListHeight(state, height);
      applyListHeight(state);
      syncBackdrop(state);
    };
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !(toast.list instanceof HTMLElement)) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      startY = event.clientY;
      startHeight = toast.list.getBoundingClientRect().height;
      handle.setPointerCapture?.(event.pointerId);
      toast.element?.classList.add("is-resizing");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      setHeight(startHeight + (event.clientY - startY));
    });
    const finish = (event) => {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture?.(event.pointerId);
      toast.element?.classList.remove("is-resizing");
      saveListHeight(toast.listHeight);
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    // 키보드: ↑↓ 로 24px 씩
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      event.stopPropagation();
      const current =
        toast.list instanceof HTMLElement
          ? toast.list.getBoundingClientRect().height
          : toast.listHeight;
      setHeight(current + (event.key === "ArrowDown" ? 24 : -24));
      saveListHeight(toast.listHeight);
    });
    return handle;
  }

  // 지금 읽지 않은 채팅으로 토스트 내용을 다시 그린다. 보여줄 것이 없으면 false.
  function renderToastContent(state) {
    const toast = ensureToastState(state);
    const deps = toast.deps;
    if (state.isOpen) return false;
    if (getClickAction(state) === "list") return renderListMode(state);
    toast.expanded = false;
    const summary = getUnseenSummary(state, deps);
    if (summary.count <= 0 || summary.actors.length === 0) return false;
    ensureToastElement(state);
    const body = toast.body;
    const content = toast.content;
    content.textContent = "";
    toast.more.hidden = true;
    toast.panel.hidden = true;
    toast.panel.textContent = "";
    toast.element.classList.remove("is-stacked", "is-expanded");
    body.removeAttribute("aria-expanded");
    const latestEntry = toast.lastEntry;
    const single =
      summary.count === 1 &&
      latestEntry &&
      latestEntry.nickname === summary.actors[0].nickname;
    toast.element.classList.toggle("is-single", !!single);
    if (single) {
      renderSingleEntry(content, latestEntry, { state });
    } else {
      renderSummary(content, summary);
    }
    body.setAttribute("aria-label", content.dataset.label || "");
    body.title = "모아보기 팝업 열기";
    return true;
  }

  function scheduleHide(state) {
    const toast = ensureToastState(state);
    clearTimer(toast, "hideTimer");
    // 펼친 목록은 사용자가 보고 있으므로 저절로 닫지 않는다.
    if (toast.hovering || toast.expanded) return;
    const timing = getTiming(state);
    if (timing.keepVisible) return;
    const remainingLifetime =
      toast.shownAt + timing.visibleMs + MAX_EXTEND_MS - Date.now();
    const delay = Math.max(0, Math.min(timing.visibleMs, remainingLifetime));
    toast.hideTimer = setTimeout(() => hideToast(state), delay);
  }

  function flushToast(state) {
    const toast = ensureToastState(state);
    clearTimer(toast, "gatherTimer");
    if (!isToastContextAllowed(state) || state.isOpen) return;
    if (document.hidden) {
      toast.pendingWhileHidden = true;
      return;
    }
    if (!renderToastContent(state)) return false;
    if (!positionToast(state)) return false;
    const element = toast.element;
    toast.visible = true;
    toast.shownAt = Date.now();
    element.classList.remove("is-visible");
    void element.offsetWidth;
    element.classList.add("is-visible");
    watchAnchor(state);
    scheduleHide(state);
    return true;
  }

  function expandToast(state) {
    const toast = ensureToastState(state);
    if (!toast.visible || toast.expanded) return;
    const viaKeyboard = toast.body?.matches?.(":focus-visible") === true;
    toast.expanded = true;
    clearTimer(toast, "hideTimer");
    if (!renderToastContent(state)) {
      hideToast(state);
      return;
    }
    positionToast(state);
    if (viaKeyboard) {
      toast.panel.querySelector(`.${TOAST_CLASS}-item`)?.focus();
    }
  }

  function collapseToast(state, options = {}) {
    const toast = ensureToastState(state);
    if (!toast.expanded) return;
    toast.expanded = false;
    toast.revealedKeys.clear();
    if (!toast.visible) return;
    if (!renderToastContent(state)) {
      hideToast(state);
      return;
    }
    if (options.focusBody) toast.body?.focus();
    // 접은 뒤에는 표시 시간을 처음부터 다시 센다.
    toast.shownAt = Date.now();
    scheduleHide(state);
  }

  // 팝업이 다 열린 뒤 해당 채팅을 목록 가운데로 옮기고 잠깐 강조한다.
  // 필터 등으로 목록에 없으면 팝업만 연 상태로 둔다.
  function jumpToEntry(state, entry, options = {}) {
    const list = state?.ui?.list;
    const getKey = ns.captureApi?.getEntryCaptureKey;
    if (!(list instanceof HTMLElement) || typeof getKey !== "function") return;
    const key = getKey(entry, 0);
    if (!key || key.startsWith("fallback:")) return;
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(key)
        : key.replace(/["\\]/g, "\\$&");
    const item = list.querySelector(
      `[data-chzzk-badge-moa-capture-key="${escaped}"]`,
    );
    if (!(item instanceof HTMLElement)) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    list.scrollTop +=
      itemRect.top - listRect.top - (listRect.height - itemRect.height) / 2;
    if (options.highlight === false) return;
    const focusClass = "chzzk-badge-moa-item-toast-focus";
    item.classList.remove(focusClass);
    void item.offsetWidth;
    item.classList.add(focusClass);
    setTimeout(() => item.classList.remove(focusClass), JUMP_HIGHLIGHT_MS);
  }

  function openPopupFromToast(state, entry = null) {
    const toast = ensureToastState(state);
    hideToast(state);
    if (typeof toast.deps.openPopup !== "function") return;
    toast.deps.openPopup();
    if (entry) setTimeout(() => jumpToEntry(state, entry), JUMP_DELAY_MS);
  }

  // "모두 지우기": 읽지 않은 채팅을 모두 확인한 것으로 처리한다
  // (상단 알림 버튼의 미확인 개수도 0 이 된다).
  function clearAllFromToast(state) {
    const toast = ensureToastState(state);
    if (typeof toast.deps.markAllSeen === "function") toast.deps.markAllSeen();
    dismiss(state);
  }

  function hideToast(state) {
    const toast = ensureToastState(state);
    clearTimer(toast, "hideTimer");
    clearTimer(toast, "updateTimer");
    toast.hovering = false;
    toast.revealedKeys.clear();
    closeCaptureMenu(state);
    if (toast.expanded) {
      toast.expanded = false;
      toast.element?.classList.remove("is-expanded");
      if (toast.panel) toast.panel.hidden = true;
    }
    syncBackdrop(state);
    if (!toast.visible) return;
    toast.visible = false;
    unwatchAnchor(toast);
    toast.cooldownUntil = Date.now() + getTiming(state).cooldownMs;
    if (toast.element instanceof HTMLElement) {
      toast.element.classList.remove("is-visible");
    }
  }

  // 새 배지 채팅이 들어왔을 때(팝업이 닫혀 있을 때만) 부른다.
  function notify(state, entry, deps = {}) {
    const toast = ensureToastState(state);
    toast.deps = deps;
    if (!isToastContextAllowed(state) || state.isOpen) return;
    if (!isEntryTarget(state, entry, deps)) return;
    bindGlobalListeners(state);
    toast.lastEntry = entry;
    rememberEntry(state, entry);

    if (toast.visible) {
      // 떠 있는 토스트는 새로 띄우지 않고 내용만 바꾼다(연속 채팅은 잠깐 모아서).
      if (toast.updateTimer) return;
      toast.updateTimer = setTimeout(() => {
        toast.updateTimer = 0;
        if (!toast.visible) return;
        if (!renderToastContent(state) || !positionToast(state)) {
          hideToast(state);
          return;
        }
        scheduleHide(state);
      }, UPDATE_DELAY_MS);
      return;
    }

    if (toast.gatherTimer) return;
    const timing = getTiming(state);
    const delay = Math.max(
      timing.gatherMs,
      toast.cooldownUntil - Date.now(),
    );
    toast.gatherTimer = setTimeout(() => flushToast(state), delay);
  }

  // 새로고침 뒤 세션 캐시에서 복원한 읽지 않은 채팅으로 토스트를 다시 띄운다.
  // 채팅창 UI 가 아직 준비되지 않았으면 잠시 뒤 다시 시도한다.
  // 새로고침 직후는 페이지가 바쁜 때라, 시도는 브라우저가 한가할 때(requestIdleCallback) 한다.
  const RESTORE_RETRY_MS = 500;
  const RESTORE_RETRY_LIMIT = 12;
  const RESTORE_IDLE_TIMEOUT_MS = 1000;

  function cancelRestore(toast) {
    clearTimer(toast, "restoreTimer");
    if (toast.restoreIdle && typeof cancelIdleCallback === "function") {
      cancelIdleCallback(toast.restoreIdle);
    }
    toast.restoreIdle = 0;
  }

  function scheduleRestoreAttempt(toast, fn, delayMs) {
    const runWhenIdle = () => {
      toast.restoreTimer = 0;
      if (typeof requestIdleCallback === "function") {
        toast.restoreIdle = requestIdleCallback(
          () => {
            toast.restoreIdle = 0;
            fn();
          },
          { timeout: RESTORE_IDLE_TIMEOUT_MS },
        );
      } else {
        fn();
      }
    };
    toast.restoreTimer = setTimeout(runWhenIdle, delayMs);
  }

  function restore(state, entries, deps = {}) {
    const toast = ensureToastState(state);
    toast.deps = deps;
    if (!isToastContextAllowed(state) || state.isOpen) return;
    const targets = (Array.isArray(entries) ? entries : []).filter((entry) =>
      isEntryTarget(state, entry, deps),
    );
    if (targets.length === 0) return;
    bindGlobalListeners(state);
    toast.queue = [];
    targets.forEach((entry) => rememberEntry(state, entry));
    toast.lastEntry = targets[targets.length - 1];
    clearTimer(toast, "gatherTimer");
    cancelRestore(toast);
    if (toast.visible) {
      if (!renderToastContent(state) || !positionToast(state)) hideToast(state);
      return;
    }
    toast.cooldownUntil = 0;
    let tries = 0;
    const attempt = () => {
      if (toast.visible || toast.queue.length === 0 || state.isOpen) return;
      // 채팅 헤더가 준비되기 전에는 띄우지 않는다. 헤더 없이 채팅창 맨 위를 기준으로
      // 잡으면 토스트가 알림 버튼 자리에 겹친다.
      const ready = !!getChatHeader(state) && !!getAnchorRect(state);
      if (ready && (flushToast(state) !== false || toast.pendingWhileHidden)) {
        return;
      }
      tries += 1;
      if (tries < RESTORE_RETRY_LIMIT) {
        scheduleRestoreAttempt(toast, attempt, RESTORE_RETRY_MS);
      }
    };
    scheduleRestoreAttempt(toast, attempt, 0);
  }

  // 표시 시간 설정이 바뀌면 떠 있는 토스트의 사라질 시각을 다시 잡는다.
  // 누를 때 동작이 바뀌면 떠 있는 토스트의 모양도 다시 그린다.
  function refreshTiming(state) {
    const toast = ensureToastState(state);
    if (!toast.visible) return;
    if (getClickAction(state) !== "list") toast.expanded = false;
    if (!renderToastContent(state)) {
      hideToast(state);
      return;
    }
    positionToast(state);
    toast.shownAt = Date.now();
    scheduleHide(state);
  }

  // 팝업을 열었거나 채널을 옮겨 읽지 않은 채팅이 없어졌을 때 토스트를 거둔다.
  function dismiss(state) {
    const toast = ensureToastState(state);
    clearTimer(toast, "gatherTimer");
    cancelRestore(toast);
    toast.pendingWhileHidden = false;
    toast.lastEntry = null;
    toast.queue = [];
    if (toast.visible) {
      hideToast(state);
      // 사용자가 직접 확인한 것이므로 다음 알림을 늦추지 않는다.
      toast.cooldownUntil = 0;
    }
  }

  ns.toastApi = {
    BADGE_TYPES,
    normalizeFrequency,
    normalizeBadgeTypes,
    normalizeClickAction,
    notify,
    restore,
    reposition,
    dismiss,
    refreshTiming,
    onStorageChanged,
  };
})();
