if (!window.__chzzkBadgeMoaMainInjected) {
  window.__chzzkBadgeMoaMainInjected = true;

  // 브라우저의 원래 WebSocket/fetch 객체를 가로챔
  const OriginalWebSocket = window.WebSocket;
  const OriginalFetch = window.fetch;
  const OriginalXHR = window.XMLHttpRequest;

  // content script로 안전하게 전달하기 위한 메시지 헬퍼
  // - targetOrigin을 '*' 대신 현재 origin으로 제한
  // - marker를 붙여 다른 스크립트의 우연한 충돌을 줄임
  const CHZZK_BADGE_MOA_MSG_MARK = "__CHZZK_BADGE_MOA__";
  const CHZZK_BADGE_MOA_TARGET_ORIGIN = window.location.origin;
  const INJECT_TRACKED_SYNC_TYPE = "CHZZK_BADGE_MOA_SET_TRACKED_NICKNAMES";
  // content→inject 토글 (constants.js와 동일 문자열)
  const INJECT_BLIND_CAPTURE_TOGGLE_TYPE = "CHZZK_BADGE_MOA_SET_BLIND_CAPTURE";
  const INJECT_CHAT_TIMESTAMP_TOGGLE_TYPE = "CHZZK_BADGE_MOA_SET_CHAT_TIMESTAMP";
  // 가려진 채팅 표시 / 채팅 시간 표시 토글 상태(원문은 MAIN world 메모리에만).
  let restoreBlindedChat = false;
  let showChatTimestamp = false;
  const trackedNicknameTargets = new Set();
  const PROFILE_CACHE_MAX = 600;
  const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
  const profileLiteByNickname = new Map();
  const VOD_CHAT_RESPONSE_QUEUE_MAX = 120;
  const VOD_CHAT_PENDING_MAX = 20000;
  const VOD_CHAT_PENDING_KEY_MAX = 60000;
  const VOD_SYNC_INTERVAL_MS = 250;
  const VOD_SYNC_TOLERANCE_MS = 400;
  const VOD_CHAT_FETCH_URL_RE =
    /^https:\/\/api\.chzzk\.naver\.com\/service\/v1\/videos\/(\d+)\/chats(?:[/?#]|$)/i;
  const VOD_VIDEO_INFO_URL_PATH_RE = /^\/service\/v\d+\/videos\/(\d+)\/?$/i;
  const vodResponseQueue = [];
  const vodPendingChats = [];
  const vodPendingChatKeys = new Set();
  const vodChannelHintsByVideoNo = new Map();
  let vodSyncTimer = null;

  function postArchiveMessage(type, payload) {
    try {
      window.postMessage(
        { [CHZZK_BADGE_MOA_MSG_MARK]: true, type, payload },
        CHZZK_BADGE_MOA_TARGET_ORIGIN,
      );
    } catch (e) {}
  }

  function normalizeNickname(value) {
    return String(value || "").trim();
  }

  // 프로필 카드 조회용 userIdHash 정규화.
  // 32자 hex만 통과시키고 anonymous/SYSTEM_MESSAGE 등 sentinel은 제외.
  function normalizeUserIdHash(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (trimmed === "anonymous" || trimmed === "SYSTEM_MESSAGE") return "";
    if (!/^[a-f0-9]{32}$/i.test(trimmed)) return "";
    return trimmed.toLowerCase();
  }

  function sanitizeKeyPart(value, maxLength = 48) {
    const normalized = String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[|]/g, " ");
    if (!normalized) return "";
    return normalized.slice(0, maxLength);
  }

  function makeUniqueKey({
    prefix = "MSG",
    stableId = "",
    timestamp = Date.now(),
    nickname = "",
    message = "",
  } = {}) {
    const safePrefix = sanitizeKeyPart(prefix, 12) || "MSG";
    const stable = sanitizeKeyPart(stableId, 64);
    if (stable) return `${safePrefix}_${stable}`;

    const ts = Number(timestamp || 0) || Date.now();
    const safeNickname = sanitizeKeyPart(nickname, 24) || "unknown";
    const safeMessage = sanitizeKeyPart(message, 32) || "empty";
    return `${safePrefix}_${ts}_${safeNickname}_${safeMessage}`;
  }

  function setTrackedNicknameTargets(values) {
    trackedNicknameTargets.clear();
    if (!Array.isArray(values)) return;
    values.forEach((value) => {
      const nickname = normalizeNickname(value);
      if (!nickname) return;
      trackedNicknameTargets.add(nickname);
    });
  }

  // ===== 가려진 채팅 표시 + 채팅 시간 표시 (MAIN world: React props 직접 접근) =====

  const BLIND_PLACEHOLDER_TEXTS = [
    "메시지가 블라인드 처리되었습니다.",
    "클린봇이 부적절한 표현을 감지했습니다.",
  ];
  let chatRowObserver = null;
  let chatRowObserverRetryTimer = null;
  let blindRestoreWriting = false;
  // 행 → { placeholder, nickname }: OFF 시 원래 가림 문구로 되돌리기 위함.
  const restoredRowInfo = new WeakMap();

  function getReactProps(node) {
    if (node == null) return null;
    const key = Object.keys(node).find((k) => k.startsWith("__reactProps$"));
    return key ? node[key] : null;
  }

  function getReactFiber(node) {
    if (node == null) return null;
    const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
    return key ? node[key] : null;
  }

  // 채팅 행 노드에서 React props의 chatMessage 객체를 얻는다.
  function getChatMessage(row) {
    const props = getReactProps(row);
    const direct = props && props.children && props.children.props
      ? props.children.props.chatMessage
      : null;
    if (direct && typeof direct === "object") return direct;
    // 폴백: fiber 서브트리에서 chatMessage를 가진 props 탐색
    let fiber = getReactFiber(row);
    let guard = 0;
    while (fiber != null && guard < 60) {
      const mp = fiber.memoizedProps;
      if (mp) {
        if (mp.chatMessage && typeof mp.chatMessage === "object") {
          return mp.chatMessage;
        }
        if (
          mp.children &&
          mp.children.props &&
          mp.children.props.chatMessage &&
          typeof mp.children.props.chatMessage === "object"
        ) {
          return mp.children.props.chatMessage;
        }
      }
      fiber = fiber.child;
      guard += 1;
    }
    return null;
  }

  // 실제 전송 시각(epoch ms)을 찾는다. playerMessageTime(영상 경과)은 제외.
  function readChatEpochMs(chatMessage) {
    if (!chatMessage || typeof chatMessage !== "object") return null;
    const candidates = [
      chatMessage.time,
      chatMessage.messageTime,
      chatMessage.createTime,
      chatMessage.ctime,
      chatMessage.regTime,
      chatMessage.msgTime,
    ];
    for (const value of candidates) {
      const n = Number(value);
      // 2001년 이후(ms)만 타당한 실제 시각으로 인정
      if (Number.isFinite(n) && n > 1e12) return n;
    }
    return null;
  }

  // chatMessage에서 원문 텍스트와 이모티콘 맵을 읽는다(객체/JSON 문자열 모두).
  function readChatOriginal(chatMessage) {
    if (!chatMessage || typeof chatMessage !== "object") return null;
    const msgTypeCode =
      chatMessage.msgTypeCode || chatMessage.messageTypeCode || 1;
    if (msgTypeCode === 30 || msgTypeCode === 11 || msgTypeCode === 12) {
      return null; // 시스템/구독 합성 메시지 제외
    }
    const text = String(chatMessage.content || chatMessage.msg || "");
    if (!text) return null;
    let extras = chatMessage.extras;
    if (typeof extras === "string") extras = parseJsonSafe(extras);
    const emojis =
      extras && typeof extras.emojis === "object" && extras.emojis
        ? extras.emojis
        : {};
    return { text, emojis };
  }

  function getRowNickname(row) {
    const node = row.querySelector("[class*='_nickname_'] [class*='_text_']");
    return node ? String(node.textContent || "").trim() : "";
  }

  // 메시지 텍스트 span = _chatting_message_ 하위 _text_ 중 _nickname_ 버튼 밖의 것.
  function getRowMessageSpan(row) {
    const message =
      row.querySelector("[class*='_chatting_message_']") || row;
    const candidates = message.querySelectorAll("[class*='_text_']");
    for (const span of candidates) {
      if (!span.closest("[class*='_nickname_']")) return span;
    }
    return null;
  }

  function isHiddenRow(row) {
    return (
      row.matches("[class*='_is_hidden_']") ||
      !!row.querySelector("[class*='_is_hidden_']")
    );
  }

  // {:emojiKey:} 토큰을 텍스트 노드 + <img>로 조립.
  function buildRestoredMessageFragment(text, emojiMap) {
    const fragment = document.createDocumentFragment();
    const messageText = String(text || "");
    if (!messageText) return fragment;
    const hasEmojis =
      emojiMap &&
      typeof emojiMap === "object" &&
      Object.keys(emojiMap).length > 0;
    if (!hasEmojis) {
      fragment.appendChild(document.createTextNode(messageText));
      return fragment;
    }
    const tokenPattern = /\{:([^:}]+):\}/g;
    let lastIndex = 0;
    let match = null;
    while ((match = tokenPattern.exec(messageText)) !== null) {
      const key = String(match[1] || "").trim();
      const url = emojiMap[key];
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(messageText.slice(lastIndex, match.index)),
        );
      }
      if (typeof url === "string" && url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        img.className = "chzzk-badge-moa-blind-emoji";
        img.width = 24;
        img.height = 24;
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;
        fragment.appendChild(img);
      } else {
        fragment.appendChild(document.createTextNode(match[0]));
      }
      lastIndex = tokenPattern.lastIndex;
    }
    if (lastIndex < messageText.length) {
      fragment.appendChild(document.createTextNode(messageText.slice(lastIndex)));
    }
    return fragment;
  }

  // 닉네임 앞에 회색 HH:MM 시간 span을 삽입.
  function applyTimestamp(row, epochMs) {
    if (row.querySelector(":scope .chzzk-badge-moa-chat-time")) return;
    const nicknameBtn =
      row.querySelector("button[class*='_nickname_']") ||
      row.querySelector("[class*='_nickname_']");
    if (!nicknameBtn || !nicknameBtn.parentNode) return;
    const d = new Date(epochMs);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const span = document.createElement("span");
    span.className = "chzzk-badge-moa-chat-time";
    span.textContent = `${hh}:${mm}`;
    nicknameBtn.parentNode.insertBefore(span, nicknameBtn);
  }

  function removeAllTimestamps() {
    document
      .querySelectorAll(".chzzk-badge-moa-chat-time")
      .forEach((el) => el.remove());
  }

  // 가려진 행을 원문(텍스트+이모티콘)으로 복원.
  function applyRestore(row, original) {
    const span = getRowMessageSpan(row);
    if (!(span instanceof HTMLElement)) return;
    // 원래 가림 문구 보관(OFF 시 되돌리기). 이미 복원된 경우 덮지 않음.
    if (!restoredRowInfo.has(row)) {
      restoredRowInfo.set(row, {
        placeholder: String(span.textContent || ""),
        nickname: getRowNickname(row),
      });
    }
    const fragment = buildRestoredMessageFragment(original.text, original.emojis);
    blindRestoreWriting = true;
    try {
      span.textContent = "";
      span.appendChild(fragment);
      span.classList.add("chzzk-badge-moa-blind-restored-text");
    } finally {
      if (typeof queueMicrotask === "function") {
        queueMicrotask(() => {
          blindRestoreWriting = false;
        });
      } else {
        Promise.resolve().then(() => {
          blindRestoreWriting = false;
        });
      }
    }
  }

  // OFF: 복원된 행을 원래 가림 문구로 되돌린다.
  function revertAllRestores() {
    document
      .querySelectorAll(".chzzk-badge-moa-blind-restored-text")
      .forEach((span) => {
        const row = span.closest("[class*='_item_']");
        const info = row ? restoredRowInfo.get(row) : null;
        blindRestoreWriting = true;
        try {
          span.textContent = info ? info.placeholder : span.textContent;
          span.classList.remove("chzzk-badge-moa-blind-restored-text");
        } finally {
          if (typeof queueMicrotask === "function") {
            queueMicrotask(() => {
              blindRestoreWriting = false;
            });
          } else {
            Promise.resolve().then(() => {
              blindRestoreWriting = false;
            });
          }
        }
        if (row) restoredRowInfo.delete(row);
      });
  }

  // 채팅 행 하나 처리: 시간 삽입 + 가림 복원.
  function processRow(row) {
    if (!(row instanceof HTMLElement)) return;
    const chatMessage = getChatMessage(row);
    if (!chatMessage) return;

    if (showChatTimestamp) {
      const epoch = readChatEpochMs(chatMessage);
      if (epoch) applyTimestamp(row, epoch);
    }

    if (restoreBlindedChat && isHiddenRow(row)) {
      const span = getRowMessageSpan(row);
      // 이미 복원된 행이면 skip(클래스로 식별)
      if (span && !span.classList.contains("chzzk-badge-moa-blind-restored-text")) {
        const original = readChatOriginal(chatMessage);
        if (original) applyRestore(row, original);
      }
    }
  }

  // React 재렌더로 다시 가림 문구가 된 복원행을 재복원.
  function reapplyRestoreForTarget(target) {
    if (!restoreBlindedChat || blindRestoreWriting) return;
    if (!(target instanceof Element)) return;
    const row = target.closest("[class*='_item_']");
    if (!(row instanceof HTMLElement)) return;
    const info = restoredRowInfo.get(row);
    if (!info) return;
    // 노드 재활용 가드
    if (getRowNickname(row) !== info.nickname) {
      restoredRowInfo.delete(row);
      return;
    }
    const span = getRowMessageSpan(row);
    if (!(span instanceof HTMLElement)) return;
    const current = String(span.textContent || "").trim();
    if (BLIND_PLACEHOLDER_TEXTS.includes(current)) {
      const chatMessage = getChatMessage(row);
      const original = chatMessage ? readChatOriginal(chatMessage) : null;
      if (original) applyRestore(row, original);
    }
  }

  function findChatListContainers() {
    const containers = [];
    const live = document.querySelector(
      "aside#aside-chatting [class*='live_chatting_list_container'], aside#aside-chatting [role='log']",
    );
    if (live) containers.push(live);
    const vod = document.querySelector(
      "aside#vod-aside [class*='vod_chatting_list_container'], aside#vod-aside [role='log']",
    );
    if (vod) containers.push(vod);
    if (containers.length === 0) {
      const aside =
        document.querySelector("aside#aside-chatting") ||
        document.querySelector("aside#vod-aside");
      if (aside) containers.push(aside);
    }
    return containers;
  }

  function isChatRowNode(node) {
    if (!(node instanceof HTMLElement)) return false;
    return (
      node.matches(
        "[class*='live_chatting_list_item'], [class*='vod_chatting_item'], [class*='_item_']",
      ) && !!node.querySelector("[class*='_chatting_message_']")
    );
  }

  function sweepExistingRows() {
    findChatListContainers().forEach((container) => {
      container
        .querySelectorAll(
          "[class*='live_chatting_list_item'], [class*='vod_chatting_item'], [class*='_item_']",
        )
        .forEach((row) => {
          if (row.querySelector("[class*='_chatting_message_']")) processRow(row);
        });
    });
  }

  function ensureChatRowObserver() {
    if (!restoreBlindedChat && !showChatTimestamp) return;
    const containers = findChatListContainers();
    if (containers.length === 0) {
      scheduleChatRowObserverRetry();
      return;
    }
    clearChatRowObserverRetry();
    if (chatRowObserver) chatRowObserver.disconnect();
    chatRowObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;
        if (mutation.target instanceof Element) {
          reapplyRestoreForTarget(mutation.target);
        }
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (isChatRowNode(node)) {
            processRow(node);
          } else {
            node
              .querySelectorAll(
                "[class*='live_chatting_list_item'], [class*='vod_chatting_item'], [class*='_item_']",
              )
              .forEach((row) => {
                if (row.querySelector("[class*='_chatting_message_']")) {
                  processRow(row);
                }
              });
          }
        });
      }
    });
    containers.forEach((c) =>
      chatRowObserver.observe(c, { childList: true, subtree: true }),
    );
    sweepExistingRows();
  }

  function scheduleChatRowObserverRetry() {
    if (!restoreBlindedChat && !showChatTimestamp) return;
    if (chatRowObserverRetryTimer) return;
    chatRowObserverRetryTimer = setTimeout(() => {
      chatRowObserverRetryTimer = null;
      ensureChatRowObserver();
    }, 500);
  }

  function clearChatRowObserverRetry() {
    if (!chatRowObserverRetryTimer) return;
    clearTimeout(chatRowObserverRetryTimer);
    chatRowObserverRetryTimer = null;
  }

  function disconnectChatRowObserverIfIdle() {
    if (!restoreBlindedChat && !showChatTimestamp && chatRowObserver) {
      chatRowObserver.disconnect();
      chatRowObserver = null;
    }
    if (!restoreBlindedChat && !showChatTimestamp) {
      clearChatRowObserverRetry();
    }
  }

  function isTrackedNickname(nickname) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return false;
    return trackedNicknameTargets.has(normalized);
  }

  function getProfileLiteCacheWeight(profileLite) {
    const safe =
      profileLite && typeof profileLite === "object" ? profileLite : {};
    let score = 0;
    if (normalizeNickname(safe.nickname)) score += 1;
    if (String(safe.userRoleCode || "").trim()) score += 1;
    if (safe.verifiedMark === true) score += 1;
    if (String(safe?.badge?.imageUrl || "").trim()) score += 1;
    if (String(safe?.title?.color || "").trim()) score += 1;
    if (
      String(
        safe?.streamingProperty?.subscription?.badge?.imageUrl || "",
      ).trim()
    )
      score += 1;
    const achievementCount = Array.isArray(
      safe?.streamingProperty?.activatedAchievementBadgeIds,
    )
      ? safe.streamingProperty.activatedAchievementBadgeIds.length
      : 0;
    if (achievementCount > 0) score += 1;
    const viewerBadgeCount = Array.isArray(safe.viewerBadges)
      ? safe.viewerBadges.length
      : 0;
    if (viewerBadgeCount > 0) score += 2;
    return score;
  }

  function trimProfileCache(map, now = Date.now()) {
    for (const [key, entry] of map.entries()) {
      if (!entry || typeof entry !== "object") {
        map.delete(key);
        continue;
      }
      if (!entry.profileLite || typeof entry.profileLite !== "object") {
        map.delete(key);
        continue;
      }
      if ((Number(entry.expiresAt) || 0) <= now) {
        map.delete(key);
      }
    }
    while (map.size > PROFILE_CACHE_MAX) {
      const oldestKey = map.keys().next().value;
      map.delete(oldestKey);
    }
  }

  function upsertProfileCache(map, key, profileLite, now = Date.now()) {
    if (!key || !profileLite || typeof profileLite !== "object") return;
    const existing = map.get(key);
    const incomingWeight = getProfileLiteCacheWeight(profileLite);
    let selectedProfileLite = profileLite;
    let selectedWeight = incomingWeight;

    if (
      existing &&
      typeof existing === "object" &&
      existing.profileLite &&
      typeof existing.profileLite === "object"
    ) {
      const existingWeight =
        Number(existing.weight) ||
        getProfileLiteCacheWeight(existing.profileLite);
      if (existingWeight > incomingWeight) {
        selectedProfileLite = existing.profileLite;
        selectedWeight = existingWeight;
      }
    }

    map.delete(key);
    map.set(key, {
      profileLite: selectedProfileLite,
      weight: selectedWeight,
      expiresAt: now + PROFILE_CACHE_TTL_MS,
    });
    trimProfileCache(map, now);
  }

  function getProfileCacheValue(map, key) {
    if (!key) return null;
    const now = Date.now();
    trimProfileCache(map, now);
    const entry = map.get(key);
    if (!entry || typeof entry !== "object") return null;
    const cachedLite =
      entry.profileLite && typeof entry.profileLite === "object"
        ? entry.profileLite
        : null;
    if (!cachedLite) {
      map.delete(key);
      return null;
    }
    map.delete(key);
    map.set(key, {
      profileLite: cachedLite,
      weight: Number(entry.weight) || getProfileLiteCacheWeight(cachedLite),
      expiresAt: now + PROFILE_CACHE_TTL_MS,
    });
    return cachedLite;
  }

  function rememberProfileLite(profileLite) {
    if (!profileLite || typeof profileLite !== "object") return;
    const nickname = normalizeNickname(profileLite.nickname);
    const now = Date.now();

    if (nickname) {
      upsertProfileCache(profileLiteByNickname, nickname, profileLite, now);
    }
  }

  function getCachedProfileLiteForReceiver(receiverNickname) {
    const nickname = normalizeNickname(receiverNickname);
    if (nickname) {
      const cachedByNickname = getProfileCacheValue(
        profileLiteByNickname,
        nickname,
      );
      if (cachedByNickname) return cachedByNickname;
    }

    return null;
  }

  function buildProfileLiteFromGiftReceiverEvent(bdy) {
    const safeBody = bdy && typeof bdy === "object" ? bdy : {};

    const receiverProfile = parseJsonSafe(
      safeBody.receiverProfile || safeBody.profile || null,
    );
    if (receiverProfile && typeof receiverProfile === "object") {
      const lite = buildProfileLite(receiverProfile);
      if (lite) {
        rememberProfileLite(lite);
        return lite;
      }
    }

    const cached = getCachedProfileLiteForReceiver(safeBody.receiverNickname);
    if (cached) {
      return cached;
    }

    const badgeImageUrl = String(
      safeBody?.receiverBadge?.imageUrl ||
        safeBody.receiverBadgeImageUrl ||
        safeBody.badgeImageUrl ||
        "",
    ).trim();
    const nickname = normalizeNickname(safeBody.receiverNickname || "");
    const roleCode = String(safeBody.receiverUserRoleCode || "").trim();
    const verifiedMark = safeBody.receiverVerifiedMark === true;
    if (!nickname && !roleCode && !verifiedMark && !badgeImageUrl) {
      return null;
    }

    return {
      nickname,
      userRoleCode: roleCode,
      verifiedMark,
      badge: {
        imageUrl: badgeImageUrl,
      },
      title: {
        color: "",
      },
      viewerBadges: [],
      streamingProperty: {
        subscription: {
          badge: {
            imageUrl: "",
          },
        },
        activatedAchievementBadgeIds: [],
      },
    };
  }

  function getGiftEventSenderDisplayNickname(bdy) {
    const safeBody = bdy && typeof bdy === "object" ? bdy : {};
    const senderRawNickname = normalizeNickname(
      safeBody.senderNickname ||
        safeBody.giverNickname ||
        safeBody.giftSenderNickname ||
        safeBody.userNickname ||
        safeBody.nickname ||
        safeBody.senderName ||
        "",
    );
    if (!senderRawNickname) return "";

    const isAnonymous =
      safeBody.isAnonymous === true ||
      safeBody.senderAnonymous === true ||
      senderRawNickname === "익명의 후원자";
    if (isAnonymous) return "익명의 후원자";

    const roleCode = String(
      safeBody.senderUserRoleCode ||
        safeBody.giverUserRoleCode ||
        safeBody.userRoleCode ||
        "",
    )
      .trim()
      .toLowerCase();
    const badgeImageUrl = String(
      safeBody?.senderBadge?.imageUrl ||
        safeBody.senderBadgeImageUrl ||
        safeBody?.giverBadge?.imageUrl ||
        safeBody.giverBadgeImageUrl ||
        "",
    )
      .trim()
      .toLowerCase();
    const verifiedMark =
      safeBody.senderVerifiedMark === true || safeBody.verifiedMark === true;

    const hasRoleBadge =
      roleCode.includes("manager") ||
      roleCode.includes("streamer") ||
      roleCode.includes("owner") ||
      roleCode.includes("operator") ||
      roleCode.includes("admin") ||
      roleCode.includes("staff") ||
      badgeImageUrl.includes("/icon/manager.png") ||
      badgeImageUrl.includes("/icon/streamer.png") ||
      badgeImageUrl.includes("/icon/owner.png") ||
      verifiedMark;

    return hasRoleBadge ? senderRawNickname : "???";
  }

  function extractRoleInfo(profile) {
    const safeProfile = profile && typeof profile === "object" ? profile : {};
    const roleCode = String(safeProfile.userRoleCode || "").toLowerCase();
    const roleBadgeUrl = String(safeProfile?.badge?.imageUrl || "").trim();
    const isOperator =
      roleCode.includes("operator") ||
      roleCode.includes("admin") ||
      roleCode.includes("staff") ||
      roleBadgeUrl.includes("/icon/owner.png");
    const isChannelOwner =
      roleCode.includes("streamer") ||
      (roleCode.includes("owner") && !isOperator) ||
      roleCode.includes("broadcaster") ||
      roleBadgeUrl.includes("/icon/streamer.png");
    const isManager = roleCode.includes("manager") && !isOperator;
    const isPartner = safeProfile.verifiedMark === true;
    return { isOperator, isChannelOwner, isManager, isPartner };
  }

  function buildProfileLite(profile) {
    const safeProfile = profile && typeof profile === "object" ? profile : null;
    if (!safeProfile) return null;

    const lite = {
      nickname: String(safeProfile.nickname || "").trim(),
      userRoleCode: String(safeProfile.userRoleCode || "").trim(),
      verifiedMark: safeProfile.verifiedMark === true,
      badge: {
        imageUrl: String(safeProfile?.badge?.imageUrl || "").trim(),
      },
      title: {
        color: String(safeProfile?.title?.color || "").trim(),
      },
      viewerBadges: [],
      streamingProperty: {
        subscription: {
          badge: {
            imageUrl: String(
              safeProfile?.streamingProperty?.subscription?.badge?.imageUrl ||
                "",
            ).trim(),
          },
        },
        activatedAchievementBadgeIds: [],
      },
    };

    const activatedAchievementBadgeIds = Array.isArray(
      safeProfile?.streamingProperty?.activatedAchievementBadgeIds,
    )
      ? safeProfile.streamingProperty.activatedAchievementBadgeIds
      : [];
    const firstActivatedAchievementBadgeId = String(
      activatedAchievementBadgeIds[0] || "",
    ).trim();
    if (firstActivatedAchievementBadgeId) {
      lite.streamingProperty.activatedAchievementBadgeIds = [
        firstActivatedAchievementBadgeId,
      ];
    }

    const viewerBadges = Array.isArray(safeProfile.viewerBadges)
      ? safeProfile.viewerBadges
      : [];
    viewerBadges.forEach((viewerBadge) => {
      const imageUrl = String(viewerBadge?.badge?.imageUrl || "").trim();
      if (!imageUrl) return;
      lite.viewerBadges.push({
        badge: {
          imageUrl,
          badgeId: String(viewerBadge?.badge?.badgeId || "").trim(),
        },
      });
    });

    return lite;
  }

  function buildProfileLiteForCache(profile) {
    const safeProfile = profile && typeof profile === "object" ? profile : null;
    if (!safeProfile) return null;

    const nickname = normalizeNickname(safeProfile.nickname);
    const userRoleCode = String(safeProfile.userRoleCode || "").trim();
    const verifiedMark = safeProfile.verifiedMark === true;
    const badgeImageUrl = String(safeProfile?.badge?.imageUrl || "").trim();
    const titleColor = String(safeProfile?.title?.color || "").trim();
    const subscriptionBadgeImageUrl = String(
      safeProfile?.streamingProperty?.subscription?.badge?.imageUrl || "",
    ).trim();
    const activatedAchievementBadgeIds = Array.isArray(
      safeProfile?.streamingProperty?.activatedAchievementBadgeIds,
    )
      ? safeProfile.streamingProperty.activatedAchievementBadgeIds
      : [];
    const firstActivatedAchievementBadgeId = String(
      activatedAchievementBadgeIds[0] || "",
    ).trim();

    if (
      !nickname &&
      !userRoleCode &&
      !verifiedMark &&
      !badgeImageUrl &&
      !subscriptionBadgeImageUrl &&
      !titleColor &&
      !firstActivatedAchievementBadgeId
    ) {
      return null;
    }

    return {
      nickname,
      userRoleCode,
      verifiedMark,
      badge: {
        imageUrl: badgeImageUrl,
      },
      title: {
        color: titleColor,
      },
      viewerBadges: [],
      streamingProperty: {
        subscription: {
          badge: {
            imageUrl: subscriptionBadgeImageUrl,
          },
        },
        activatedAchievementBadgeIds: firstActivatedAchievementBadgeId
          ? [firstActivatedAchievementBadgeId]
          : [],
      },
    };
  }

  function postArchiveMessageIfTarget(payload) {
    if (!payload || typeof payload !== "object") return;

    const nickname = normalizeNickname(payload.nickname);
    if (nickname && isTrackedNickname(nickname)) {
      postArchiveMessage("CHZZK_CHAT_LOG", payload);
      return;
    }

    const profile = payload.profileLite || payload.profile;
    if (!profile || typeof profile !== "object") return;

    const roleInfo = extractRoleInfo(profile);
    if (
      roleInfo.isOperator ||
      roleInfo.isChannelOwner ||
      roleInfo.isManager ||
      roleInfo.isPartner
    ) {
      postArchiveMessage("CHZZK_CHAT_LOG", payload);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== CHZZK_BADGE_MOA_TARGET_ORIGIN) return;

    const data = event.data;
    if (
      !data ||
      typeof data !== "object" ||
      data[CHZZK_BADGE_MOA_MSG_MARK] !== true
    ) {
      return;
    }
    const messageType = String(data.type || "");
    const payload =
      data.payload && typeof data.payload === "object" ? data.payload : {};

    if (messageType === INJECT_TRACKED_SYNC_TYPE) {
      const nicknames = Array.isArray(payload.nicknames)
        ? payload.nicknames
        : [];
      setTrackedNicknameTargets(nicknames);
      return;
    }

    // 가려진 채팅 표시 on/off
    if (messageType === INJECT_BLIND_CAPTURE_TOGGLE_TYPE) {
      const next = payload.enabled === true;
      if (next === restoreBlindedChat) return;
      restoreBlindedChat = next;
      if (restoreBlindedChat) {
        ensureChatRowObserver();
        sweepExistingRows();
      } else {
        revertAllRestores();
        disconnectChatRowObserverIfIdle();
      }
      return;
    }

    // 채팅 시간 표시 on/off
    if (messageType === INJECT_CHAT_TIMESTAMP_TOGGLE_TYPE) {
      const next = payload.enabled === true;
      if (next === showChatTimestamp) return;
      showChatTimestamp = next;
      if (showChatTimestamp) {
        ensureChatRowObserver();
        sweepExistingRows();
      } else {
        removeAllTimestamps();
        disconnectChatRowObserverIfIdle();
      }
      return;
    }
  });

  function normalizeUrlForMatching(url) {
    if (!url) return "";
    try {
      return new URL(String(url), window.location.origin).href;
    } catch (_error) {
      return String(url || "");
    }
  }

  function resolveFetchRequestUrl(input) {
    if (typeof input === "string") {
      return normalizeUrlForMatching(input);
    }
    if (input && typeof input.url === "string") {
      return normalizeUrlForMatching(input.url);
    }
    return "";
  }

  function getVideoNoFromChatFetchUrl(url) {
    const matched = String(url || "").match(VOD_CHAT_FETCH_URL_RE);
    return matched ? String(matched[1] || "") : "";
  }

  function getVideoNoFromVodVideoInfoUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(String(url), window.location.origin);
      const matched = parsed.pathname.match(VOD_VIDEO_INFO_URL_PATH_RE);
      return matched ? String(matched[1] || "") : "";
    } catch (_error) {
      return "";
    }
  }

  function getCurrentVideoNoFromLocation() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] !== "video") return "";
    const videoNo = String(parts[1] || "").trim();
    return /^\d+$/.test(videoNo) ? videoNo : "";
  }

  function makeVodPendingChatKey(videoNo, chatItem) {
    const safeVideoNo = String(videoNo || "").trim();
    const safeItem = chatItem && typeof chatItem === "object" ? chatItem : {};
    const playerMessageTime = Number(safeItem.playerMessageTime || 0) || 0;
    const messageTime = Number(safeItem.messageTime || 0) || 0;
    const messageTypeCode = Number(safeItem.messageTypeCode || 0) || 0;
    const userIdHash = String(safeItem.userIdHash || "").trim();
    const content = String(safeItem.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    return [
      safeVideoNo,
      playerMessageTime,
      messageTime,
      messageTypeCode,
      userIdHash,
      content,
    ].join("|");
  }

  function trimVodPendingChatKeys() {
    while (vodPendingChatKeys.size > VOD_CHAT_PENDING_KEY_MAX) {
      const oldest = vodPendingChatKeys.values().next().value;
      if (!oldest) break;
      vodPendingChatKeys.delete(oldest);
    }
  }

  function trimVodResponseQueue() {
    while (vodResponseQueue.length > VOD_CHAT_RESPONSE_QUEUE_MAX) {
      vodResponseQueue.shift();
    }
  }

  function trimVodPendingChats() {
    if (vodPendingChats.length <= VOD_CHAT_PENDING_MAX) return;
    vodPendingChats.splice(0, vodPendingChats.length - VOD_CHAT_PENDING_MAX);
  }

  function insertVodPendingChat(queueItem) {
    if (!queueItem || typeof queueItem !== "object") return;

    if (vodPendingChats.length === 0) {
      vodPendingChats.push(queueItem);
      return;
    }

    const targetTime = Number(queueItem.playerMessageTime || 0) || 0;
    const lastItem = vodPendingChats[vodPendingChats.length - 1];
    const lastTime = Number(lastItem?.playerMessageTime || 0) || 0;
    if (targetTime >= lastTime) {
      vodPendingChats.push(queueItem);
      return;
    }

    for (let i = vodPendingChats.length - 1; i >= 0; i -= 1) {
      const currentTime =
        Number(vodPendingChats[i]?.playerMessageTime || 0) || 0;
      if (targetTime >= currentTime) {
        vodPendingChats.splice(i + 1, 0, queueItem);
        return;
      }
    }

    vodPendingChats.unshift(queueItem);
  }

  function ensureVodSyncTimer() {
    if (vodSyncTimer) return;
    vodSyncTimer = setInterval(() => {
      flushVodPendingChatsByPlaybackTime();
    }, VOD_SYNC_INTERVAL_MS);
  }

  function enqueueVodChatResponse(videoNo, responseJson) {
    const safeVideoNo = String(videoNo || "").trim();
    if (!safeVideoNo || !responseJson || typeof responseJson !== "object") {
      return;
    }

    vodResponseQueue.push({
      videoNo: safeVideoNo,
      timestamp: Date.now(),
      responseJson,
    });
    trimVodResponseQueue();

    const content =
      responseJson.content && typeof responseJson.content === "object"
        ? responseJson.content
        : {};
    const chatGroups = [
      Array.isArray(content.previousVideoChats)
        ? content.previousVideoChats
        : [],
      Array.isArray(content.videoChats) ? content.videoChats : [],
    ];

    chatGroups.forEach((group) => {
      group.forEach((chatItem) => {
        if (!chatItem || typeof chatItem !== "object") return;

        const playerMessageTime = Number(chatItem.playerMessageTime || 0);
        if (!Number.isFinite(playerMessageTime)) return;

        const pendingKey = makeVodPendingChatKey(safeVideoNo, chatItem);
        if (!pendingKey || vodPendingChatKeys.has(pendingKey)) return;

        vodPendingChatKeys.add(pendingKey);
        trimVodPendingChatKeys();

        insertVodPendingChat({
          videoNo: safeVideoNo,
          playerMessageTime: Math.max(0, Math.floor(playerMessageTime)),
          chatItem,
        });
      });
    });

    trimVodPendingChats();
    ensureVodSyncTimer();
  }

  function emitVodChatByPlayback(chatItem, videoNo) {
    const safeItem = chatItem && typeof chatItem === "object" ? chatItem : null;
    if (!safeItem) return;

    const adaptedItem = {
      ...safeItem,
      uid: safeItem.uid || safeItem.userIdHash || "",
      msgTypeCode: safeItem.msgTypeCode || safeItem.messageTypeCode || 0,
      msg: safeItem.msg || safeItem.content || "",
      msgTime: safeItem.msgTime || safeItem.messageTime || Date.now(),
    };

    const isSystemMessage =
      Number(adaptedItem.messageTypeCode || adaptedItem.msgTypeCode || 0) ===
        30 ||
      adaptedItem.uid === "SYSTEM_MESSAGE" ||
      adaptedItem.userIdHash === "SYSTEM_MESSAGE";

    if (isSystemMessage) {
      const systemPayload = parseSystemMessage(adaptedItem);
      if (systemPayload && typeof systemPayload === "object") {
        systemPayload.playerMessageTime =
          Number(safeItem.playerMessageTime || 0) || 0;
        systemPayload.videoNo = String(videoNo || "");
        postArchiveMessageIfTarget(systemPayload);
      }
      return;
    }

    const payload = parseNormalMessage(adaptedItem);
    const playerMessageTime = Number(safeItem.playerMessageTime || 0) || 0;
    const videoNoStr = String(videoNo || "");

    if (payload && typeof payload === "object") {
      payload.playerMessageTime = playerMessageTime;
      payload.videoNo = videoNoStr;
      postArchiveMessage("CHZZK_CHAT_LOG", payload);
    }

    // [구독권 선물] msgTypeCode 12: 라이브의 SUBSCRIPTION_GIFT_RECEIVER(93006)
    // 이벤트가 VOD에는 없으므로, 수신자 기준 entry를 별도로 생성한다.
    const giftMsgTypeCode = Number(
      adaptedItem.messageTypeCode || adaptedItem.msgTypeCode || 0,
    );
    if (giftMsgTypeCode === 12) {
      const extras = parseJsonSafe(adaptedItem.extras) || {};
      const receiverNickname = normalizeNickname(extras.receiverNickname || "");
      if (receiverNickname) {
        const receiverProfileLite = buildProfileLiteFromGiftReceiverEvent({
          receiverNickname,
          receiverProfile: extras.receiverProfile || null,
          receiverUserRoleCode: extras.receiverUserRoleCode || "",
          receiverVerifiedMark: extras.receiverVerifiedMark === true,
          receiverBadge: extras.receiverBadge || null,
          receiverBadgeImageUrl: extras.receiverBadgeImageUrl || "",
        });

        const senderProfile = parseJsonSafe(adaptedItem.profile) || null;
        const senderDisplayNickname = getGiftEventSenderDisplayNickname({
          senderNickname: senderProfile?.nickname || adaptedItem.nickname || "",
          isAnonymous:
            adaptedItem.uid === "anonymous" ||
            adaptedItem.userIdHash === "anonymous",
          senderUserRoleCode: senderProfile?.userRoleCode || "",
          senderVerifiedMark: senderProfile?.verifiedMark === true,
        });

        const timestamp =
          Number(
            adaptedItem.msgTime ||
              adaptedItem.messageTime ||
              safeItem.msgTime ||
              safeItem.messageTime ||
              0,
          ) || Date.now();

        const giftData = {
          tierNo: extras.giftTierNo,
          tierName: extras.giftTierName,
          selectionType: extras.selectionType,
          quantity: extras.quantity || 1,
          receiverNickname,
          senderNickname: senderDisplayNickname,
        };

        const receiverPayload = {
          uniqueKey: makeUniqueKey({
            prefix: "GIFT",
            stableId:
              safeItem.msgTid ||
              safeItem.messageId ||
              adaptedItem.msgTid ||
              adaptedItem.messageId ||
              "",
            timestamp,
            nickname: receiverNickname,
            message: `${giftData.tierName || "구독권"} 선물`,
          }),
          nickname: receiverNickname,
          message: "",
          profileLite: receiverProfileLite,
          timestamp,
          isAnonymous: false,
          isGift: true,
          giftSubscription: giftData,
          channelId:
            payload?.streamingChannelId ||
            payload?.channelId ||
            getStreamingChannelId(adaptedItem, extras, senderProfile) ||
            "",
          streamingChannelId:
            payload?.streamingChannelId ||
            payload?.channelId ||
            getStreamingChannelId(adaptedItem, extras, senderProfile) ||
            "",
          playerMessageTime,
          videoNo: videoNoStr,
          type: "INSERT",
        };

        postArchiveMessageIfTarget(receiverPayload);
      }
    }
  }

  function flushVodPendingChatsByPlaybackTime() {
    if (vodPendingChats.length === 0) return;

    const currentVideoNo = getCurrentVideoNoFromLocation();
    if (!currentVideoNo) return;

    const videoElement = document.querySelector("video");
    if (!(videoElement instanceof HTMLMediaElement)) return;
    if (!Number.isFinite(videoElement.currentTime)) return;

    const currentTimeMs = Math.max(
      0,
      Math.floor(videoElement.currentTime * 1000),
    );
    const allowedTimeMs = currentTimeMs + VOD_SYNC_TOLERANCE_MS;

    let safety = 0;
    while (vodPendingChats.length > 0 && safety < 1200) {
      safety += 1;
      const next = vodPendingChats[0];
      if (!next || typeof next !== "object") {
        vodPendingChats.shift();
        continue;
      }

      if (String(next.videoNo || "") !== currentVideoNo) {
        vodPendingChats.shift();
        continue;
      }

      if ((Number(next.playerMessageTime || 0) || 0) > allowedTimeMs) {
        break;
      }

      vodPendingChats.shift();
      emitVodChatByPlayback(next.chatItem, currentVideoNo);
    }
  }

  function pruneVodPendingChatsForLocation() {
    const currentVideoNo = getCurrentVideoNoFromLocation();
    if (!currentVideoNo) {
      vodPendingChats.length = 0;
      vodPendingChatKeys.clear();
      return;
    }

    if (vodPendingChats.length === 0) return;

    for (let i = vodPendingChats.length - 1; i >= 0; i -= 1) {
      const queueItem = vodPendingChats[i];
      if (String(queueItem?.videoNo || "") === currentVideoNo) continue;
      vodPendingChats.splice(i, 1);
    }
  }

  function trimVodChannelHints() {
    while (vodChannelHintsByVideoNo.size > 60) {
      const oldestVideoNo = vodChannelHintsByVideoNo.keys().next().value;
      if (!oldestVideoNo) break;
      vodChannelHintsByVideoNo.delete(oldestVideoNo);
    }
  }

  function extractVodChannelIdFromVideoInfoResponse(responseJson) {
    if (!responseJson || typeof responseJson !== "object") return "";
    const content =
      responseJson.content && typeof responseJson.content === "object"
        ? responseJson.content
        : {};
    const channel =
      content.channel && typeof content.channel === "object"
        ? content.channel
        : {};

    return resolveStreamingChannelId(
      channel.channelId,
      content.channelId,
      content.streamingChannelId,
    );
  }

  function emitVodChannelHint(videoNo, channelId) {
    const safeVideoNo = String(videoNo || "").trim();
    const safeChannelId = resolveStreamingChannelId(channelId);
    if (!safeVideoNo || !safeChannelId) return;

    const currentVideoNo = getCurrentVideoNoFromLocation();
    if (!currentVideoNo || currentVideoNo !== safeVideoNo) return;

    const prevChannelId = vodChannelHintsByVideoNo.get(safeVideoNo);
    if (prevChannelId === safeChannelId) return;

    vodChannelHintsByVideoNo.set(safeVideoNo, safeChannelId);
    trimVodChannelHints();

    postArchiveMessage("CHZZK_CHAT_LOG", {
      type: "CHANNEL_HINT",
      channelId: safeChannelId,
      streamingChannelId: safeChannelId,
      videoNo: safeVideoNo,
      timestamp: Date.now(),
    });
  }

  function handleVodVideoInfoResponse(videoNo, responseJson) {
    const safeVideoNo = String(videoNo || "").trim();
    if (!safeVideoNo || !responseJson || typeof responseJson !== "object") {
      return;
    }
    const channelId = extractVodChannelIdFromVideoInfoResponse(responseJson);
    if (!channelId) return;
    emitVodChannelHint(safeVideoNo, channelId);
  }

  if (typeof OriginalFetch === "function") {
    window.fetch = function () {
      const args = Array.from(arguments);
      const requestUrl = resolveFetchRequestUrl(args[0]);
      const targetVideoNo = getVideoNoFromChatFetchUrl(requestUrl);
      const targetVodInfoVideoNo = getVideoNoFromVodVideoInfoUrl(requestUrl);
      const fetchPromise = OriginalFetch.apply(this, args);

      if (!targetVideoNo && !targetVodInfoVideoNo) {
        return fetchPromise;
      }

      return fetchPromise.then((response) => {
        try {
          if (response && typeof response.clone === "function") {
            const clonedResponse = response.clone();
            Promise.resolve()
              .then(() => clonedResponse.json())
              .then((json) => {
                if (targetVideoNo) {
                  enqueueVodChatResponse(targetVideoNo, json);
                }
                if (targetVodInfoVideoNo) {
                  handleVodVideoInfoResponse(targetVodInfoVideoNo, json);
                }
              })
              .catch(() => {});
          }
        } catch (_error) {}
        return response;
      });
    };
  }
  if (typeof OriginalXHR === "function") {
    const OriginalXHROpen = OriginalXHR.prototype.open;
    OriginalXHR.prototype.open = function (method, url) {
      this._requestUrl = resolveFetchRequestUrl(url);
      return OriginalXHROpen.apply(this, arguments);
    };

    const OriginalXHRSend = OriginalXHR.prototype.send;
    OriginalXHR.prototype.send = function () {
      this.addEventListener("load", function () {
        const targetVideoNo = getVideoNoFromChatFetchUrl(this._requestUrl);
        const targetVodInfoVideoNo = getVideoNoFromVodVideoInfoUrl(
          this._requestUrl,
        );
        if (!targetVideoNo && !targetVodInfoVideoNo) return;
        try {
          const responseText = this.responseText;
          if (!responseText) return;
          const json = JSON.parse(responseText);
          if (targetVideoNo) {
            enqueueVodChatResponse(targetVideoNo, json);
          }
          if (targetVodInfoVideoNo) {
            handleVodVideoInfoResponse(targetVodInfoVideoNo, json);
          }
        } catch (e) {
          // ignore
        }
      });
      return OriginalXHRSend.apply(this, arguments);
    };
  }

  // 프로필 카드 API 호출에 필요한 chat channel ID. WebSocket 메시지에서 캡처됨.
  let lastChatChannelId = "";
  function rememberChatChannelId(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(trimmed)) return;
    if (trimmed === lastChatChannelId) return;
    lastChatChannelId = trimmed;
    postArchiveMessage("CHZZK_CHAT_CHANNEL_ID", { chatChannelId: trimmed });
  }

  window.WebSocket = class extends OriginalWebSocket {
    constructor(url, protocols) {
      super(url, protocols);

      // 메시지를 받을 때마다 실행되는 이벤트 리스너를 가로챔
      this.addEventListener("message", (event) => {
        try {
          // 데이터가 텍스트인 경우만 처리
          if (typeof event.data === "string") {
            const raw = event.data.trim();
            if (!raw || raw[0] !== "{" || raw.indexOf('"cmd"') === -1) {
              return;
            }
            const data = JSON.parse(raw);

            // 채팅 메시지의 cid에는 프로필 카드 API에 쓰이는 chat channel ID가 담겨 있음
            if (data && typeof data.cid === "string") {
              rememberChatChannelId(data.cid);
            }

            // 1. 일반 채팅 (93101) 및 고액 후원/구독 (93102)
            if ((data.cmd === 93101 || data.cmd === 93102) && data.bdy) {
              // bdy가 배열인 경우와 객체인 경우 모두 처리
              const list = Array.isArray(data.bdy) ? data.bdy : [data.bdy];
              parseAndSend(list);
            }
            // 2. 과거 내역 (15101) - messageList가 있는 경우
            else if (data.cmd === 15101 && data.bdy && data.bdy.messageList) {
              parseAndSend(data.bdy.messageList);
            }
            // 3. 시스템 이벤트: 선물, 미션 (93006)
            else if (data.cmd === 93006 && data.bdy) {
              handleSystemEvent(data.bdy);
            }
          }
        } catch (e) {
          // JSON 파싱 에러 등은 무시 (Socket.io 핑퐁 메시지 등)
        }
      });
    }
  };

  // [공통] 메시지 파싱 및 전송
  function parseAndSend(list) {
    list.forEach((item) => {
      let payload = null;

      // A. 시스템 메시지 (관리자 채팅 활성화, 운영자 임명 등)
      if (item.messageTypeCode === 30 || item.uid === "SYSTEM_MESSAGE") {
        payload = parseSystemMessage(item);
        postArchiveMessageIfTarget(payload);
      }
      // B. 일반 채팅 / 후원 / 구독
      else {
        payload = parseNormalMessage(item);
        if (payload && typeof payload === "object") {
          // parseNormalMessage는 타깃 필터링을 이미 마친 payload만 반환
          postArchiveMessage("CHZZK_CHAT_LOG", payload);
        }
      }
    });
  }

  // 일반 메시지 파싱
  function parseNormalMessage(item) {
    // 1. 기본 정보 추출
    const extras = parseJsonSafe(item.extras) || {};
    const rawProfile = parseJsonSafe(item.profile) || null;
    const cachedProfileLite = buildProfileLiteForCache(rawProfile);
    rememberProfileLite(cachedProfileLite);

    // 미션 최초 등록(ALONE) 패킷 무시
    if (
      extras.missionDonationType === "ALONE" &&
      extras.donationType === "MISSION"
    ) {
      return null;
    }

    let nickname = "";
    const isAnonymous =
      item.uid === "anonymous" ||
      item.userIdHash === "anonymous" ||
      extras.isAnonymous === true;

    const nicknameCandidates = [
      normalizeNickname(rawProfile && rawProfile.nickname),
      normalizeNickname(item.nickname),
      normalizeNickname(item.userNickname),
      isAnonymous ? "익명의 후원자" : "",
    ].filter(Boolean);

    nickname = nicknameCandidates[0] || "";

    // 닉네임 없으면 스킵 (단, 시스템 관련은 위에서 처리함)
    if (!normalizeNickname(nickname)) return null;

    // 조기 필터링:
    // - 역할/파트너 대상도 아니고
    // - 추가 모아보기(닉네임) 대상도 아니면
    // 무거운 객체 조립(profileLite/emojis/subscription) 전에 즉시 종료
    const roleInfo = extractRoleInfo(cachedProfileLite || rawProfile);
    const isRoleTarget =
      roleInfo.isOperator ||
      roleInfo.isChannelOwner ||
      roleInfo.isManager ||
      roleInfo.isPartner;
    const isTrackedTarget = nicknameCandidates.some((candidate) =>
      isTrackedNickname(candidate),
    );
    if (!isRoleTarget && !isTrackedTarget) {
      return null;
    }

    const profileLite = buildProfileLite(rawProfile) || cachedProfileLite;
    rememberProfileLite(profileLite);
    const streamingChannelId = getStreamingChannelId(item, extras, rawProfile);
    if (profileLite && normalizeNickname(profileLite.nickname)) {
      nickname = profileLite.nickname;
    }

    const timestamp = item.msgTime || item.messageTime || Date.now();
    let messageContent = item.msg || item.content || "";

    // 2. 메시지 타입별 처리
    const msgTypeCode = item.msgTypeCode || item.messageTypeCode || 1;

    const isVideo = extras.donationType === "VIDEO";
    const isMission =
      extras.missionDonationType !== "ALONE" &&
      (extras.donationType === "MISSION" ||
        extras.donationType === "MISSION_PARTICIPATION");
    let isGift = false;

    let partyDonationData = null;
    const isPartyDonation = extras.donationType === "PARTY";
    if (isPartyDonation) {
      partyDonationData = {
        partyName: extras.partyName,
        partyNo: extras.partyNo,
        payAmount: extras.payAmount,
      };
    }

    // [구독] msgTypeCode: 11
    let subscriptionData = null;
    if (msgTypeCode === 11 && extras.month) {
      subscriptionData = {
        month: extras.month,
        tierName: extras.tierName || "구독",
        tierNo: extras.tierNo,
      };
    }

    // [구독권 선물] msgTypeCode: 12
    let giftSubscription = null;

    if (msgTypeCode === 12 && extras) {
      giftSubscription = {
        tierNo: extras.giftTierNo,
        tierName: extras.giftTierName,
        selectionType: extras.selectionType,
        quantity: extras.quantity || 1,
        receiverNickname: extras.receiverNickname,
        senderNickname: nickname,
      };
      isGift = true;
      messageContent = "";
    }

    const uniqueKey = makeUniqueKey({
      prefix: "CHAT",
      stableId: item.msgTid || item.messageId || "",
      timestamp,
      nickname,
      message: messageContent,
    });

    return {
      uniqueKey,
      nickname: nickname,
      isAnonymous,
      profileLite,
      message: messageContent,
      emojis: extras.emojis || {},
      timestamp: timestamp,
      isDonation: msgTypeCode !== 1 && msgTypeCode !== 11 && msgTypeCode !== 12, // 구독(11), 구독권 선물(12) 후원 태그 제외 여부 결정
      subscription: subscriptionData,
      isSubscription: !!subscriptionData,
      isGift: isGift,
      giftSubscription: giftSubscription,
      partyDonation: partyDonationData,
      isPartyDonation: isPartyDonation,
      isVideoDonation: isVideo,
      isMissionDonation: isMission,
      missionDonationType: extras.missionDonationType || null,
      donationAmount: extras.payAmount || 0,
      channelId: streamingChannelId,
      streamingChannelId,
      authorUserIdHash: normalizeUserIdHash(
        item.userIdHash ||
          item.uid ||
          (rawProfile && rawProfile.userIdHash) ||
          (item.member && item.member.userIdHash),
      ),
      type: "INSERT", // DB 저장용
    };
  }

  // 시스템 메시지 파싱 (운영자 임명 등)
  function parseSystemMessage(item) {
    const extras = parseJsonSafe(item.extras) || {};
    const timestamp = item.msgTime || item.messageTime || Date.now();
    const streamingChannelId = getStreamingChannelId(item, extras, null);

    // 채팅 운영자 임명
    if (extras.type === "CHAT_MANAGER_ADD" && extras.params) {
      const message = extras.description || "채팅 운영자로 임명되었습니다.";
      return {
        uniqueKey: makeUniqueKey({
          prefix: "SYSTEM",
          stableId: item.msgTid || item.messageId || "",
          timestamp,
          nickname: "(스트리머/관리자)",
          message,
        }),
        nickname: "(스트리머/관리자)",
        message,
        emojis: {},
        timestamp: timestamp,
        isDonation: false,
        channelId: streamingChannelId,
        streamingChannelId,
        type: "INSERT",
      };
    } else if (extras.params && extras.params.followerHighRecord) {
      const splitedContent = item.content.split("🎊");
      const nickname = `🎊${splitedContent[1]}🎊`;
      const message = splitedContent[2].trim();
      return {
        uniqueKey: makeUniqueKey({
          prefix: "SYSTEM",
          stableId: item.msgTid || item.messageId || "",
          timestamp,
          nickname,
          message,
        }),
        nickname,
        message,
        emojis: {},
        timestamp: timestamp,
        isDonation: false,
        channelId: streamingChannelId,
        streamingChannelId,
        type: "INSERT",
      };
    } else {
      const message = item.msg || item.content;
      const fullMessage = `${message} ${extras.description}`;
      return {
        uniqueKey: makeUniqueKey({
          prefix: "SYSTEM",
          stableId: item.msgTid || item.messageId || "",
          timestamp,
          nickname: "(스트리머/관리자)",
          message: fullMessage,
        }),
        nickname: "(스트리머/관리자)",
        message: fullMessage,
        emojis: {},
        timestamp: timestamp,
        isDonation: false,
        channelId: streamingChannelId,
        streamingChannelId,
        type: "INSERT",
      };
    }
    // 관리자 전용 채팅 등 기타 시스템 메시지는 로그에 남길 필요가 없다면 null 반환
    return null;
  }

  // [이벤트] 시스템 이벤트: 선물, 미션 (93006)
  function handleSystemEvent(bdy) {
    const type = bdy.type || bdy.donationType;
    const timestamp = Date.now(); // 실시간 이벤트이므로 현재 시간 사용
    const streamingChannelId = resolveStreamingChannelId(
      bdy && bdy.streamingChannelId,
      bdy && bdy.channelId,
    );

    // 1. 구독권 선물 (SUBSCRIPTION_GIFT_RECEIVER)
    if (type === "SUBSCRIPTION_GIFT_RECEIVER") {
      // 선물 받은 사람
      const receiverNickname = normalizeNickname(
        bdy.receiverNickname || "(알 수 없음)",
      );
      const giftData = {
        tierNo: bdy.giftTierNo,
        tierName: bdy.giftTierName,
        selectionType: bdy.selectionType,
        quantity: bdy.quantity || bdy.count || 1,
        receiverNickname: receiverNickname,
        senderNickname: getGiftEventSenderDisplayNickname(bdy),
      };

      if (receiverNickname) {
        const receiverProfileLite = buildProfileLiteFromGiftReceiverEvent(bdy);
        postArchiveMessageIfTarget({
          uniqueKey: makeUniqueKey({
            prefix: "GIFT",
            stableId:
              bdy.msgTid || bdy.messageId || bdy.giftNo || bdy.giftId || "",
            timestamp,
            nickname: receiverNickname,
            message: `${giftData.tierName || "구독권"} 선물`,
          }),
          nickname: receiverNickname || "(알 수 없음)",
          message: "",
          profileLite: receiverProfileLite,
          timestamp: timestamp,
          isAnonymous: false,
          isGift: true,
          giftSubscription: giftData,
          channelId: streamingChannelId,
          streamingChannelId,
          type: "INSERT",
        });
      }
    }
    // 2. 미션 도네이션
    else if (
      bdy.donationType === "MISSION" ||
      type === "DONATION_MISSION_IN_PROGRESS"
    ) {
      // 3-1. 미션 참여(PARTICIPATION)는 93006에서 무시 (93102 채팅 패킷으로 처리)
      if (bdy.missionDonationType === "PARTICIPATION") {
        return;
      }

      // 3-2. 최초 미션 등록 (PENDING)
      if (bdy.status === "PENDING") {
        const isAnon = bdy.isAnonymous;
        const nickname = isAnon
          ? "익명의 후원자"
          : bdy.nickname || "(알 수 없음)";
        const uniqueKey = bdy.missionDonationId
          ? `MISSION_${bdy.missionDonationId}`
          : makeUniqueKey({
              prefix: "MISSION",
              timestamp,
              nickname,
              message: bdy.missionText,
            });

        postArchiveMessageIfTarget({
          uniqueKey: uniqueKey,
          nickname: nickname,
          message: bdy.missionText,
          timestamp: timestamp,
          isAnonymous: isAnon,
          isDonation: true,
          isMissionDonation: true,
          donationAmount: bdy.payAmount,
          channelId: streamingChannelId,
          streamingChannelId,
          type: "INSERT",
        });
      }

      // 3-3. 미션 결과 (COMPLETED) - 성공/실패/취소
      else if (bdy.status === "COMPLETED") {
        // 시스템 로그로 처리
        postArchiveMessageIfTarget({
          uniqueKey: `SYSTEM_MISSION_${bdy.missionDonationId}_${timestamp}`,
          nickname: "미션 결과",
          message: bdy.missionText,
          timestamp: timestamp,
          isAnonymous: false,
          isDonation: false, // 후원 집계에는 포함 X (이미 등록/참여 때 집계됨)
          isMissionDonation: true, // 스타일링을 위해 태그 유지
          missionResult: {
            isSuccess: bdy.success,
            totalPayAmount: bdy.totalPayAmount || 0,
          },
          channelId: streamingChannelId,
          streamingChannelId,
          type: "INSERT",
        });
      }
      // 3-3. 미션 거절 (REJECTED)
      else if (bdy.status === "REJECTED") {
        postArchiveMessageIfTarget({
          uniqueKey: `SYSTEM_MISSION_REJECTED_${bdy.missionDonationId}_${timestamp}`,
          nickname: "미션 거절",
          message: bdy.missionText,
          timestamp: timestamp,
          isAnonymous: false,
          isDonation: false,
          isMissionDonation: true,
          missionStatus: "REJECTED",
          channelId: streamingChannelId,
          streamingChannelId,
          type: "INSERT",
        });
      }
    }
  }

  function resolveStreamingChannelId(...candidates) {
    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (!value) continue;
      if (/^[a-f0-9]{32}$/i.test(value)) return value.toLowerCase();
    }

    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (value) return value;
    }
    return "";
  }

  function getStreamingChannelId(item, extras, profile) {
    return resolveStreamingChannelId(
      extras && extras.streamingChannelId,
      item && item.streamingChannelId,
      item && item.channelId,
      profile &&
        profile.streamingProperty &&
        profile.streamingProperty.streamingChannelId,
    );
  }

  // JSON 문자열 안전 파싱
  function parseJsonSafe(str) {
    if (!str) return null;
    try {
      if (typeof str === "object") return str;
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }

  (function () {
    // 페이지 이동 감지 (SPA 대응)
    // pushState, replaceState, popstate 이벤트를 훅하여 URL 변경 시 알림을 보냄
    const pushState = history.pushState;
    const replaceState = history.replaceState;

    function notifyUrlChange() {
      vodChannelHintsByVideoNo.clear();
      pruneVodPendingChatsForLocation();
      postArchiveMessage("CHZZK_URL_CHANGED");
      // SPA 이동 시 채팅 컨테이너가 교체되므로 옵저버를 재연결한다.
      if (restoreBlindedChat || showChatTimestamp) {
        setTimeout(() => ensureChatRowObserver(), 600);
      }
    }

    history.pushState = function () {
      pushState.apply(history, arguments);
      notifyUrlChange();
    };

    history.replaceState = function () {
      replaceState.apply(history, arguments);
      notifyUrlChange();
    };

    window.addEventListener("popstate", notifyUrlChange);
  })();
}
