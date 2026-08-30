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
  const INJECT_ORIGINAL_CHAT_CAPTURE_TOGGLE_TYPE =
    "CHZZK_BADGE_MOA_SET_ORIGINAL_CHAT_CAPTURE";
  const INJECT_CHAT_FEATURES_REQUEST_TYPE =
    "CHZZK_BADGE_MOA_REQUEST_CHAT_FEATURES";
  // 가려진 채팅 표시 / 채팅 시간 표시 토글 상태(원문은 MAIN world 메모리에만).
  let restoreBlindedChat = false;
  let showChatTimestamp = false;
  let chatTimestampFormat = "24h";
  let chatTimestampColorMode = "default";
  let captureOriginalSpecialChats = false;
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

  function isBlindPlaceholderText(value) {
    return BLIND_PLACEHOLDER_TEXTS.includes(String(value || "").trim());
  }
  // 복원 쓰기 시도 상한: 리액트가 계속 가림 문구로 되돌리는 병리적 상황에서
  // 무한 재복원 루프를 막는다. 행별로 (원문키|닉네임|가림문구) 시그니처가 같은 동안
  // 이 횟수만큼만 다시 쓴다.
  const RESTORE_WRITE_MAX = 5;
  // 행 → { signature, attempts }
  const restoreWriteState = new WeakMap();
  // 채팅 행 셀렉터: 임베디드 라이브(live_chatting_list_item)/다시보기(vod_chatting_item)/
  // 채팅 팝업(_item_)에서 행 클래스가 서로 다르므로 셋 다 포함해야 한다.
  // closest()에 _item_ 만 쓰면 라이브/다시보기 임베디드 채팅에서 행을 못 찾아
  // 재복원/원복이 동작하지 않는다.
  const CHAT_ROW_SELECTOR =
    "[class*='live_chatting_list_item'], [class*='vod_chatting_item'], [class*='_item_']";
  const CHAT_DECORATION_NODE_SELECTOR =
    ".chzzk-badge-moa-chat-time, .cheese-chat-time, .cheese-chat-os";
  let chatRowObserver = null;
  let chatRowObserverRetryTimer = null;
  let chatObserverHealthTimer = null;
  const chatRowRetryState = new WeakMap();
  const CHAT_ROW_RETRY_DELAYS = [50, 150, 350, 700];
  // 현재 옵저버가 붙어 있는 컨테이너들. 치지직 React가 URL 변화 없이 채팅 리스트
  // 컨테이너를 교체(detach)하면 옵저버가 죽은 노드를 계속 보게 되어 이후 채팅이
  // 처리되지 않는다(가려진 채팅 복원이 조용히 멈추는 원인). 이 배열로 건강 상태를
  // 주기 점검해 새 컨테이너에 재부착한다.
  let observedChatContainers = [];
  let blindRestoreWriting = false;
  // 행 → { placeholder, nickname }: OFF 시 원래 가림 문구로 되돌리기 위함.
  const restoredRowInfo = new WeakMap();
  // 복원할 원문이 아예 없다고 판명된 행(진입 전 이미 가려짐, 쓰기 한도 소진 등)을
  // 표시해 무한 재시도를 멈춘다.
  let restoreUnavailableRows = new WeakSet();
  // 원문 캐시: 메시지가 가려지면 치지직 React가 props의 원문(content)을 비울 수 있어
  // 복원 시점엔 readChatOriginal 이 null 을 돌려주기도 한다. 가려지기 전 미리 원문을
  // (userId|time 키로) 캐시해 두고, 복원 시 props에 없으면 이 캐시에서 꺼낸다.
  const originalMsgCache = new Map();
  const ORIGINAL_CACHE_MAX = 800; // 오래된 항목부터 버려 메모리 상한 유지
  const ORIGINAL_CHAT_SNAPSHOT_MAX_LENGTH = 80000;
  const originalChatSnapshotKeys = new WeakMap();
  let originalChatSnapshotSequence = 0;

  function hasActiveChatDomFeatures() {
    return (
      restoreBlindedChat ||
      showChatTimestamp ||
      captureOriginalSpecialChats
    );
  }

  function getOriginalSpecialChatKind(row) {
    if (!(row instanceof HTMLElement)) return "";
    if (isCommercePurchaseChatRow(row)) return "purchase";
    if (row.querySelector("[class*='_is_mission_']")) return "mission";
    if (row.querySelector("[class*='_is_subscription_']")) {
      return "subscription";
    }
    if (row.querySelector("[class*='_is_donation_']")) return "donation";
    return "";
  }

  function isCommercePurchaseChatRow(row) {
    if (!(row instanceof HTMLElement)) return false;
    const content = row.querySelector("[class*='_content_']");
    if (!(content instanceof HTMLElement)) return false;
    const contentText = String(content.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!/\d[\d,]*\s*원\s*구매!?/.test(contentText)) return false;
    return !!row.querySelector("[class*='_thumbnail_'] img");
  }

  function shouldProcessChatRow(row) {
    if (!(row instanceof HTMLElement)) return false;
    if (
      (restoreBlindedChat || showChatTimestamp) &&
      row.querySelector("[class*='_chatting_message_']")
    ) {
      return true;
    }
    if (showChatTimestamp && getOriginalSpecialChatKind(row) !== "") {
      return true;
    }
    return (
      captureOriginalSpecialChats &&
      getOriginalSpecialChatKind(row) !== ""
    );
  }

  function adaptChatMessageForArchive(chatMessage) {
    if (!chatMessage || typeof chatMessage !== "object") return null;
    return {
      ...chatMessage,
      uid:
        chatMessage.uid ||
        chatMessage.userIdHash ||
        chatMessage.userId ||
        chatMessage.senderId ||
        "",
      msgTypeCode:
        chatMessage.msgTypeCode || chatMessage.messageTypeCode || 1,
      msg:
        chatMessage.msg != null
          ? chatMessage.msg
          : normalizeChatContent(chatMessage.content),
      msgTime:
        chatMessage.msgTime ||
        chatMessage.messageTime ||
        chatMessage.time ||
        Date.now(),
      messageKey:
        chatMessage.messageKey ||
        chatMessage.key ||
        chatMessage.msgTid ||
        chatMessage.messageId ||
        "",
      playerMessageTime:
        Number(chatMessage.playerMessageTime || 0) || 0,
    };
  }

  function sanitizeOriginalChatRow(row) {
    const clone = row.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return "";

    clone
      .querySelectorAll(
        "script, style, link, iframe, object, embed, form, input, textarea, select, option, meta, base, [role='alertdialog'], [role='dialog'], [role='menu']",
      )
      .forEach((node) => node.remove());
    clone
      .querySelectorAll(".chzzk-badge-moa-chat-time")
      .forEach((node) => node.remove());

    const idPrefix = `chzzk-badge-moa-snapshot-${Date.now()}-${
      originalChatSnapshotSequence++
    }-`;
    const idMap = new Map();
    const elements = [clone, ...clone.querySelectorAll("*")];
    elements.forEach((element) => {
      if (!(element instanceof Element)) return;
      const originalId = String(element.getAttribute("id") || "").trim();
      if (originalId) {
        const nextId = `${idPrefix}${idMap.size}`;
        idMap.set(originalId, nextId);
        element.setAttribute("id", nextId);
      }

      Array.from(element.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = String(attribute.value || "");
        if (
          name.startsWith("on") ||
          name === "srcdoc" ||
          name === "action" ||
          name === "formaction" ||
          ((name === "href" || name === "src") &&
            /^\s*javascript:/i.test(value))
        ) {
          element.removeAttribute(attribute.name);
        }
      });

      if (element instanceof HTMLAnchorElement) {
        element.removeAttribute("href");
        element.removeAttribute("target");
        element.removeAttribute("rel");
      }
      if (element instanceof HTMLButtonElement) {
        element.type = "button";
        element.tabIndex = -1;
        element.setAttribute("aria-disabled", "true");
      }

      const safeClasses = Array.from(element.classList).filter(
        (className) => !className.startsWith("chzzk-badge-moa-"),
      );
      if (safeClasses.length !== element.classList.length) {
        element.setAttribute("class", safeClasses.join(" "));
      }
    });

    if (idMap.size > 0) {
      elements.forEach((element) => {
        if (!(element instanceof Element)) return;
        Array.from(element.attributes).forEach((attribute) => {
          let value = String(attribute.value || "");
          idMap.forEach((nextId, originalId) => {
            value = value
              .replaceAll(`url(#${originalId})`, `url(#${nextId})`)
              .replaceAll(`#${originalId}`, `#${nextId}`)
              .split(/\s+/)
              .map((part) => (part === originalId ? nextId : part))
              .join(" ");
          });
          if (value !== attribute.value) {
            element.setAttribute(attribute.name, value);
          }
        });
      });
    }

    const html = clone.outerHTML;
    if (!html || html.length > ORIGINAL_CHAT_SNAPSHOT_MAX_LENGTH) return "";
    return html;
  }

  function captureOriginalSpecialChatRow(row, chatMessage) {
    if (!captureOriginalSpecialChats) return;
    const kind = getOriginalSpecialChatKind(row);
    if (!kind) return;

    const adapted = adaptChatMessageForArchive(chatMessage);
    if (!adapted) return;
    const extras = adapted ? parseJsonSafe(adapted.extras) || {} : {};
    const isInitialMission =
      kind === "mission" &&
      extras.missionDonationType === "ALONE" &&
      extras.donationType === "MISSION";
    const initialMissionId = String(extras.missionDonationId || "").trim();
    const initialMissionKey =
      isInitialMission && initialMissionId ? `MISSION_${initialMissionId}` : "";
    const messageKey = String(
      adapted.messageKey ||
        adapted.key ||
        adapted.msgTid ||
        adapted.messageId ||
        "",
    ).trim();
    const playerMessageTime = Number(adapted.playerMessageTime || 0) || 0;
    const timestamp = Number(readChatEpochMs(chatMessage) || 0) || 0;
    const nickname = String(getRowNickname(row) || "").trim();
    let receiverNickname = "";
    const relatedNicknames = [nickname];
    if (kind === "subscription") {
      receiverNickname = getGiftReceiverNicknameFromRow(row);
      if (receiverNickname && receiverNickname !== nickname) {
        relatedNicknames.push(receiverNickname);
      }
    }

    const baseUniqueKey = String(
      initialMissionKey ||
        (messageKey ? `CHAT_${messageKey}` : "") ||
        makeUniqueKey({
          prefix: "SNAPSHOT",
          timestamp: playerMessageTime || timestamp || Date.now(),
          nickname,
          message: kind,
        }),
    ).trim();
    const uniqueKey = receiverNickname
      ? `${baseUniqueKey}_RECEIVER_${sanitizeKeyPart(receiverNickname, 24)}`
      : baseUniqueKey;
    if (!uniqueKey || originalChatSnapshotKeys.get(row) === uniqueKey) return;
    const html = sanitizeOriginalChatRow(row);
    if (!html) return;

    originalChatSnapshotKeys.set(row, uniqueKey);
    postArchiveMessage("CHZZK_SPECIAL_CHAT_SNAPSHOT", {
      uniqueKey,
      kind,
      html,
      messageKey,
      playerMessageTime,
      timestamp,
      nickname,
      receiverNickname,
      relatedNicknames,
      message: "",
      capturedAt: Date.now(),
    });

    // 커머스 구매 알림은 WebSocket 분기에서 시스템 메시지로 분류될 수 있다.
    // DOM에 연결된 React 채팅 데이터로 한 번 더 일반 프로필 판별을 수행해,
    // 구매자가 배지/추가 모아보기 대상인 경우에만 원본 행과 함께 수집한다.
    if (kind === "purchase") {
      const purchasePayload = parseNormalMessage(adapted);
      if (purchasePayload && typeof purchasePayload === "object") {
        purchasePayload.isCommercePurchase = true;
        postArchiveMessageIfTarget(purchasePayload);
      }
    }
  }

  function chatCacheKey(chatMessage) {
    if (!chatMessage || typeof chatMessage !== "object") return "";
    const uid =
      chatMessage.userId ||
      chatMessage.uid ||
      chatMessage.userIdHash ||
      chatMessage.senderId ||
      "";
    const t = readChatEpochMs(chatMessage);
    if (!uid || !t) return "";
    return `${uid}|${t}`;
  }

  function cacheOriginalMessage(chatMessage) {
    const key = chatCacheKey(chatMessage);
    if (!key || originalMsgCache.has(key)) return;
    const original = readChatOriginal(chatMessage);
    if (!original || !original.text) return;
    originalMsgCache.set(key, original);
    if (originalMsgCache.size > ORIGINAL_CACHE_MAX) {
      // 가장 오래된 항목 하나 제거(Map 은 삽입 순서 유지).
      const firstKey = originalMsgCache.keys().next().value;
      if (firstKey !== undefined) originalMsgCache.delete(firstKey);
    }
  }

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
      chatMessage.timestamp,
    ];
    for (const value of candidates) {
      const n = Number(value);
      // 2001년 이후(ms)만 타당한 실제 시각으로 인정
      if (Number.isFinite(n) && n > 1e12) return n;
    }
    return null;
  }

  // 채팅 본문은 보통 문자열이지만 렌더링 전환 중 세그먼트 배열/객체로 전달되기도 한다.
  function normalizeChatContent(content) {
    if (content == null) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((segment) => {
          if (typeof segment === "string") return segment;
          if (segment && typeof segment === "object") {
            const text =
              segment.text ??
              segment.value ??
              segment.content ??
              segment.message ??
              segment.msg;
            return typeof text === "string" ? text : "";
          }
          return "";
        })
        .join("");
    }
    if (typeof content === "object") {
      const text =
        content.text ??
        content.value ??
        content.content ??
        content.message ??
        content.msg;
      return typeof text === "string" ? text : "";
    }
    return String(content);
  }

  // chatMessage에서 원문 텍스트와 이모티콘 맵을 읽는다(객체/JSON 문자열 모두).
  function readChatOriginal(chatMessage) {
    if (!chatMessage || typeof chatMessage !== "object") return null;
    const msgTypeCode =
      chatMessage.msgTypeCode || chatMessage.messageTypeCode || 1;
    if (msgTypeCode === 30 || msgTypeCode === 11 || msgTypeCode === 12) {
      return null; // 시스템/구독 합성 메시지 제외
    }
    const text =
      normalizeChatContent(chatMessage.content) ||
      normalizeChatContent(chatMessage.msg);
    // React props 자체가 이미 가림 문구로 교체된 경우엔 원문으로 취급하지 않는다.
    // 이 값을 다시 DOM에 쓰면 치지직 렌더와 확장이 같은 문구를 무한 교체할 수 있다.
    if (!text || isBlindPlaceholderText(text)) return null;
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

  function getGiftReceiverNicknameFromRow(row) {
    const paragraphs = row.querySelectorAll("p");
    for (const paragraph of paragraphs) {
      const text = String(paragraph.textContent || "").replace(/\s+/g, " ");
      if (!/(?:님에게|님께)/.test(text)) continue;
      const emphasis = paragraph.querySelector("em");
      if (!emphasis) continue;
      const nicknameNode =
        emphasis.querySelector("[class*='_text_']") || emphasis;
      const nickname = String(nicknameNode.textContent || "").trim();
      if (nickname) return nickname;
    }
    return "";
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

  // 이 행이 지금 '복원 가능한 가림 문구'를 보여주고 있으면 그 문구를 돌려준다.
  // _is_hidden_ 클래스만 보지 않고 메시지 텍스트가 실제 가림 문구(블라인드/클린봇)인지
  // 확인해, 클래스는 붙었지만 아직 문구로 바뀌지 않은 행에 섣불리 쓰지 않는다.
  // 이미 우리가 복원한 행은, 저장해 둔 원래 가림 문구가 유효하면 그 값을 돌려준다.
  function getRestorablePlaceholder(row) {
    if (!isHiddenRow(row)) return "";
    const span = getRowMessageSpan(row);
    if (!(span instanceof HTMLElement)) return "";
    const current = String(span.textContent || "").trim();
    if (isBlindPlaceholderText(current)) return current;
    const restored = restoredRowInfo.get(row);
    const originalPlaceholder = String(restored?.placeholder || "").trim();
    if (
      span.classList.contains("chzzk-badge-moa-blind-restored-text") &&
      isBlindPlaceholderText(originalPlaceholder)
    ) {
      return originalPlaceholder;
    }
    return "";
  }

  // {:emojiKey:} 토큰을 텍스트 노드 + <img>로 조립.
  function buildRestoredMessageFragment(text, emojiMap) {
    const fragment = document.createDocumentFragment();
    const messageText =
      typeof text === "string" ? text : normalizeChatContent(text);
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

  function getBlindRestoreLabel(placeholder) {
    const text = String(placeholder || "");
    if (text.includes("클린봇")) return "(클린봇)";
    if (text.includes("블라인드")) return "(블라인드)";
    return "";
  }

  function normalizeChatTimestampFormat(value) {
    return value === "12h-en" || value === "12h-ko" ? value : "24h";
  }

  function normalizeChatTimestampColorMode(value) {
    return value === "contrast" ? "contrast" : "default";
  }

  function formatChatTimestamp(epochMs) {
    const date = new Date(epochMs);
    const hour24 = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    if (chatTimestampFormat === "24h") {
      return `${String(hour24).padStart(2, "0")}:${minutes}`;
    }
    const hour12 = hour24 % 12 || 12;
    if (chatTimestampFormat === "12h-ko") {
      return `${hour24 < 12 ? "오전" : "오후"} ${hour12}:${minutes}`;
    }
    return `${hour24 < 12 ? "AM" : "PM"} ${hour12}:${minutes}`;
  }

  function findTimestampNickname(row) {
    if (!(row instanceof HTMLElement)) return null;
    return (
      row.querySelector("button[class*='_nickname_']") ||
      row.querySelector("[class*='_nickname_']")
    );
  }

  function placeTimestamp(row, span, specialKind) {
    if (!(span instanceof HTMLElement)) return false;
    const nickname = findTimestampNickname(row);
    if (!(nickname instanceof HTMLElement)) return false;

    if (specialKind) {
      const identity = nickname.closest(
        ":is([class*='_is_donation_'], [class*='_is_subscription_'], " +
          "[class*='_is_mission_'], [class*='_container_o04z9_'], " +
          "[class*='_container_zw6kq_'])",
      );
      if (identity instanceof HTMLElement) {
        const badgeWrapper = Array.from(identity.children).find((child) =>
          String(child.className || "").includes("_wrapper_"),
        );
        const anchor = badgeWrapper || identity.firstElementChild;
        if (
          anchor !== span &&
          (span.parentElement !== identity ||
            !(span.compareDocumentPosition(anchor) &
              Node.DOCUMENT_POSITION_FOLLOWING))
        ) {
          identity.insertBefore(span, anchor || null);
        }
        return true;
      }
    }

    if (nickname.parentNode) {
      if (
        span.parentNode !== nickname.parentNode ||
        !(span.compareDocumentPosition(nickname) &
          Node.DOCUMENT_POSITION_FOLLOWING)
      ) {
        nickname.parentNode.insertBefore(span, nickname);
      }
      return true;
    }
    return false;
  }

  // 닉네임 앞에 설정한 형식의 시간 span을 삽입.
  function applyTimestamp(row, epochMs) {
    const specialKind = getOriginalSpecialChatKind(row);
    const existing = row.querySelector(":scope .chzzk-badge-moa-chat-time");
    if (existing) {
      existing.classList.toggle(
        "chzzk-badge-moa-chat-time-special",
        specialKind !== "",
      );
      if (specialKind) {
        existing.dataset.chatKind = specialKind;
      } else {
        delete existing.dataset.chatKind;
      }
      placeTimestamp(row, existing, specialKind);
      return;
    }
    const span = document.createElement("span");
    span.className = "chzzk-badge-moa-chat-time";
    span.dataset.chatEpochMs = String(epochMs);
    span.textContent = formatChatTimestamp(epochMs);
    if (specialKind) {
      span.classList.add("chzzk-badge-moa-chat-time-special");
      span.dataset.chatKind = specialKind;
    }
    placeTimestamp(row, span, specialKind);
  }

  function refreshAllTimestamps() {
    let needsSweep = false;
    document.querySelectorAll(".chzzk-badge-moa-chat-time").forEach((span) => {
      const epochMs = Number(span.dataset.chatEpochMs);
      if (Number.isFinite(epochMs) && epochMs > 0) {
        span.textContent = formatChatTimestamp(epochMs);
        const row = span.closest(CHAT_ROW_SELECTOR);
        const specialKind = getOriginalSpecialChatKind(row);
        span.classList.toggle(
          "chzzk-badge-moa-chat-time-special",
          specialKind !== "",
        );
        if (specialKind) {
          span.dataset.chatKind = specialKind;
        } else {
          delete span.dataset.chatKind;
        }
        placeTimestamp(row, span, specialKind);
        return;
      }
      span.remove();
      needsSweep = true;
    });
    if (needsSweep && showChatTimestamp) sweepExistingRows();
  }

  function removeAllTimestamps() {
    document
      .querySelectorAll(".chzzk-badge-moa-chat-time")
      .forEach((el) => el.remove());
  }

  // 복원 쓰기 허용 여부: 같은 시그니처(원문키|닉네임|가림문구)로 RESTORE_WRITE_MAX 회를
  // 넘겨 쓰려 하면 거부한다(리액트 재렌더 ↔ 확장 복원 무한 루프 차단).
  function canWriteRestore(row, chatMessage, placeholder) {
    const signature = [
      chatCacheKey(chatMessage),
      getRowNickname(row),
      String(placeholder || ""),
    ].join("|");
    const previous = restoreWriteState.get(row);
    const writeState =
      previous && previous.signature === signature
        ? previous
        : { signature, attempts: 0 };
    if (writeState.attempts >= RESTORE_WRITE_MAX) return false;
    writeState.attempts += 1;
    restoreWriteState.set(row, writeState);
    return true;
  }

  // 가려진 행을 원문(텍스트+이모티콘)으로 복원. 쓰기 한도(canWriteRestore) 판단은
  // 호출부에서 처리한다(중복 증가 방지).
  function applyRestore(row, original) {
    const span = getRowMessageSpan(row);
    if (!(span instanceof HTMLElement)) return;
    const currentPlaceholder = String(span.textContent || "");
    // 원래 가림 문구 보관(OFF 시 되돌리기). 이미 복원된 경우 덮지 않음.
    if (!restoredRowInfo.has(row)) {
      restoredRowInfo.set(row, {
        placeholder: currentPlaceholder,
        nickname: getRowNickname(row),
      });
    }
    const info = restoredRowInfo.get(row);
    const label = getBlindRestoreLabel(info?.placeholder || span.textContent);
    const fragment = buildRestoredMessageFragment(original.text, original.emojis);
    if (label) {
      fragment.appendChild(document.createTextNode(` ${label}`));
    }
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
        const row = span.closest(CHAT_ROW_SELECTOR);
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
        if (row) {
          restoredRowInfo.delete(row);
          restoreWriteState.delete(row);
          restoreUnavailableRows.delete(row);
        }
      });
    restoreUnavailableRows = new WeakSet();
  }

  // 채팅 행 하나 처리: 시간 삽입 + 가림 복원 + 특수 채팅 원본 캡처.
  function processRow(row) {
    if (!(row instanceof HTMLElement)) return false;
    if (!shouldProcessChatRow(row)) {
      scheduleChatRowRetry(row);
      return false;
    }
    const chatMessage = getChatMessage(row);
    if (!chatMessage) {
      scheduleChatRowRetry(row);
      return false;
    }

    captureOriginalSpecialChatRow(row, chatMessage);

    if (showChatTimestamp) {
      const epoch = readChatEpochMs(chatMessage);
      if (epoch) applyTimestamp(row, epoch);
    }

    // 복원 기능이 켜져 있으면, 아직 안 가려진 행의 원문을 미리 캐시해 둔다(가려진 뒤엔
    // props의 원문이 비워질 수 있어 그때 읽으면 늦다).
    if (restoreBlindedChat && !isHiddenRow(row)) {
      restoreUnavailableRows.delete(row);
      cacheOriginalMessage(chatMessage);
    }

    const restorablePlaceholder =
      restoreBlindedChat && !restoreUnavailableRows.has(row)
        ? getRestorablePlaceholder(row)
        : "";
    if (restorablePlaceholder) {
      const span = getRowMessageSpan(row);
      // 이미 복원된 행이면 skip(클래스로 식별)
      if (span && !span.classList.contains("chzzk-badge-moa-blind-restored-text")) {
        // props에 원문이 있으면 그걸, 없으면(치지직이 비웠으면) 캐시에서 꺼낸다.
        const original =
          readChatOriginal(chatMessage) ||
          originalMsgCache.get(chatCacheKey(chatMessage)) ||
          null;
        if (!original) {
          // 진입 전에 이미 가려져 원문이 아예 없는 경우엔 다시 시도하지 않는다.
          restoreUnavailableRows.add(row);
        } else if (canWriteRestore(row, chatMessage, restorablePlaceholder)) {
          applyRestore(row, original);
        } else {
          // 쓰기 한도를 모두 쓴 행도 더 이상 재시도하지 않는다.
          restoreUnavailableRows.add(row);
        }
      }
    }
    clearChatRowRetry(row);
    return true;
  }

  function scheduleChatRowRetry(row) {
    if (
      !(row instanceof HTMLElement) ||
      !row.isConnected ||
      !hasActiveChatDomFeatures()
    ) {
      return;
    }
    const state = chatRowRetryState.get(row) || { attempt: 0, timer: 0 };
    if (state.timer || state.attempt >= CHAT_ROW_RETRY_DELAYS.length) return;
    const delay = CHAT_ROW_RETRY_DELAYS[state.attempt];
    state.attempt += 1;
    state.timer = window.setTimeout(() => {
      state.timer = 0;
      if (
        !row.isConnected ||
        !hasActiveChatDomFeatures()
      ) {
        chatRowRetryState.delete(row);
        return;
      }
      processRow(row);
    }, delay);
    chatRowRetryState.set(row, state);
  }

  function clearChatRowRetry(row) {
    const state = chatRowRetryState.get(row);
    if (state?.timer) clearTimeout(state.timer);
    chatRowRetryState.delete(row);
  }

  // React 재렌더와 최초 가림 전환을 모두 처리한다.
  function reapplyRestoreForTarget(target) {
    if (!restoreBlindedChat || blindRestoreWriting) return;
    if (!(target instanceof Element)) return;
    const row = target.closest(CHAT_ROW_SELECTOR);
    if (!(row instanceof HTMLElement)) return;
    if (restoreUnavailableRows.has(row)) return;
    if (!row.querySelector("[class*='_chatting_message_']")) return;
    const info = restoredRowInfo.get(row);
    // 복원 이력이 있는 행만 노드 재활용 여부를 확인한다. 최초 가림 행에는 info가 없다.
    if (info && getRowNickname(row) !== info.nickname) {
      restoredRowInfo.delete(row);
      return;
    }
    const span = getRowMessageSpan(row);
    if (!(span instanceof HTMLElement)) return;
    if (span.classList.contains("chzzk-badge-moa-blind-restored-text")) return;
    const current = String(span.textContent || "").trim();
    if (isBlindPlaceholderText(current)) {
      const chatMessage = getChatMessage(row);
      const original = chatMessage
        ? readChatOriginal(chatMessage) ||
          originalMsgCache.get(chatCacheKey(chatMessage)) ||
          null
        : null;
      if (original && canWriteRestore(row, chatMessage, current)) {
        applyRestore(row, original);
      }
    }
  }

  function findChatListContainers() {
    const containers = [];
    const live = document.querySelector(
      "aside#aside-chatting [class*='live_chatting_list_container'], aside#aside-chatting [role='log']",
    );
    if (live) containers.push(live);
    const vod = document.querySelector(
      "aside#vod-aside [class*='vod_chatting_list_container'], " +
        "aside#vod-aside [role='log'], aside#vod-aside [class*='_list_']",
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
      node.matches(CHAT_ROW_SELECTOR) && shouldProcessChatRow(node)
    );
  }

  function isChatDecorationNode(node) {
    const element =
      node instanceof Element ? node : node?.parentElement || null;
    return Boolean(
      element?.matches?.(CHAT_DECORATION_NODE_SELECTOR) ||
        element?.closest?.(CHAT_DECORATION_NODE_SELECTOR),
    );
  }

  function isChatDecorationOnlyMutation(mutation) {
    if (isChatDecorationNode(mutation.target)) return true;
    const changedNodes = [
      ...mutation.addedNodes,
      ...mutation.removedNodes,
    ];
    return (
      changedNodes.length > 0 &&
      changedNodes.every((node) => isChatDecorationNode(node))
    );
  }

  function sweepExistingRows() {
    findChatListContainers().forEach((container) => {
      container
        .querySelectorAll(CHAT_ROW_SELECTOR)
        .forEach((row) => {
          if (shouldProcessChatRow(row)) processRow(row);
        });
    });
  }

  function ensureChatRowObserver() {
    if (!hasActiveChatDomFeatures()) return;
    const containers = findChatListContainers();
    if (containers.length === 0) {
      scheduleChatRowObserverRetry();
      return;
    }
    clearChatRowObserverRetry();
    if (chatRowObserver) chatRowObserver.disconnect();
    chatRowObserver = new MutationObserver((mutations) => {
      // 우리가 DOM을 쓰는 중이면(복원/원복) 그 변화가 다시 콜백을 트리거하지 않도록 건너뛴다.
      if (blindRestoreWriting) return;
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;
        // 시간과 작성 기기 아이콘은 다른 확장도 같은 닉네임 영역에 삽입할 수 있다.
        // 장식 노드만 이동한 변이를 다시 처리하면 서로 닉네임 바로 앞을 차지하려 하며
        // DOM 재배치 루프가 생기므로 채팅 행 자체의 변경으로 취급하지 않는다.
        if (isChatDecorationOnlyMutation(mutation)) continue;
        if (mutation.target instanceof Element) {
          reapplyRestoreForTarget(mutation.target);
          const targetRow = mutation.target.closest(CHAT_ROW_SELECTOR);
          if (
            targetRow instanceof HTMLElement && shouldProcessChatRow(targetRow)
          ) {
            processRow(targetRow);
          }
        }
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (isChatRowNode(node)) {
            processRow(node);
          } else {
            node
              .querySelectorAll(CHAT_ROW_SELECTOR)
              .forEach((row) => {
                if (shouldProcessChatRow(row)) {
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
    observedChatContainers = containers;
    sweepExistingRows();
    ensureChatObserverHealthCheck();
  }

  // 감시 중인 컨테이너가 모두 아직 문서에 연결돼 있고, 현재 찾아지는 컨테이너 집합과
  // 동일한지 확인한다(개수/구성 변화 포함). 달라졌으면 컨테이너가 교체된 것.
  function isChatObserverHealthy() {
    if (!chatRowObserver || observedChatContainers.length === 0) return false;
    if (observedChatContainers.some((c) => !c.isConnected)) return false;
    const current = findChatListContainers();
    if (current.length !== observedChatContainers.length) return false;
    return current.every((c) => observedChatContainers.includes(c));
  }

  // URL 변화 없이 React가 채팅 컨테이너를 교체한 경우를 대비해 주기적으로 점검하고
  // 필요하면 새 컨테이너에 재부착한다.
  function ensureChatObserverHealthCheck() {
    if (chatObserverHealthTimer) return;
    chatObserverHealthTimer = setInterval(() => {
      if (!hasActiveChatDomFeatures()) {
        clearInterval(chatObserverHealthTimer);
        chatObserverHealthTimer = null;
        return;
      }
      if (!isChatObserverHealthy()) ensureChatRowObserver();
    }, 1000);
  }

  function scheduleChatRowObserverRetry() {
    if (!hasActiveChatDomFeatures()) return;
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
    if (!hasActiveChatDomFeatures() && chatRowObserver) {
      chatRowObserver.disconnect();
      chatRowObserver = null;
      observedChatContainers = [];
    }
    if (!hasActiveChatDomFeatures()) {
      clearChatRowObserverRetry();
      if (chatObserverHealthTimer) {
        clearInterval(chatObserverHealthTimer);
        chatObserverHealthTimer = null;
      }
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
    const receiver = parseJsonSafe(safeBody.receiver || null);
    const safeReceiver =
      receiver && typeof receiver === "object" ? receiver : {};

    const receiverProfile = parseJsonSafe(
      safeBody.receiverProfile ||
        safeReceiver.profile ||
        safeReceiver.userProfile ||
        safeBody.profile ||
        null,
    );
    const receiverNickname = normalizeNickname(
      safeBody.receiverNickname ||
        safeBody.receiverName ||
        safeReceiver.nickname ||
        safeReceiver.name ||
        receiverProfile?.nickname ||
        "",
    );
    const receiverRoleCode = String(
      safeBody.receiverUserRoleCode ||
        safeReceiver.userRoleCode ||
        receiverProfile?.userRoleCode ||
        "",
    ).trim();
    const receiverVerifiedMark =
      safeBody.receiverVerifiedMark === true ||
      safeBody.receiverVerifiedMark === "true" ||
      safeReceiver.verifiedMark === true ||
      safeReceiver.verifiedMark === "true" ||
      receiverProfile?.verifiedMark === true;
    const receiverBadgeImageUrl = String(
      safeBody?.receiverBadge?.imageUrl ||
        safeReceiver?.badge?.imageUrl ||
        safeBody.receiverBadgeImageUrl ||
        safeBody.badgeImageUrl ||
        receiverProfile?.badge?.imageUrl ||
        "",
    ).trim();
    if (receiverProfile && typeof receiverProfile === "object") {
      const lite = buildProfileLite(receiverProfile);
      if (lite) {
        if (!lite.nickname) lite.nickname = receiverNickname;
        if (!lite.userRoleCode) lite.userRoleCode = receiverRoleCode;
        if (receiverVerifiedMark) lite.verifiedMark = true;
        if (!lite.badge?.imageUrl && receiverBadgeImageUrl) {
          lite.badge = { imageUrl: receiverBadgeImageUrl };
        }
        rememberProfileLite(lite);
        return lite;
      }
    }

    const cached = getCachedProfileLiteForReceiver(receiverNickname);
    if (cached) {
      return cached;
    }

    const nickname = receiverNickname;
    const roleCode = receiverRoleCode;
    const verifiedMark = receiverVerifiedMark;
    const badgeImageUrl = receiverBadgeImageUrl;
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

  function makeGiftReceiverStableId(stableId, receiverNickname) {
    const safeStableId = sanitizeKeyPart(stableId, 36);
    if (!safeStableId) return "";
    const safeReceiver = sanitizeKeyPart(receiverNickname, 24) || "unknown";
    return `${safeStableId}_${safeReceiver}`;
  }

  function buildGiftReceiverPayloadFromChatItem(item, overrides = {}) {
    const safeItem = item && typeof item === "object" ? item : null;
    if (!safeItem) return null;

    const msgTypeCode = Number(
      safeItem.msgTypeCode || safeItem.messageTypeCode || 0,
    );
    if (msgTypeCode !== 12) return null;

    const extras = parseJsonSafe(safeItem.extras) || {};
    const receiver = parseJsonSafe(extras.receiver || null);
    const safeReceiver =
      receiver && typeof receiver === "object" ? receiver : {};
    const receiverProfile = parseJsonSafe(
      extras.receiverProfile ||
        safeReceiver.profile ||
        safeReceiver.userProfile ||
        null,
    );
    const receiverNickname = normalizeNickname(
      extras.receiverNickname ||
        extras.receiverName ||
        safeReceiver.nickname ||
        safeReceiver.name ||
        receiverProfile?.nickname ||
        "",
    );
    if (!receiverNickname) return null;

    const receiverProfileLite = buildProfileLiteFromGiftReceiverEvent({
      ...extras,
      receiverNickname,
      receiverProfile,
      receiver,
    });
    const senderProfile = parseJsonSafe(safeItem.profile) || null;
    const senderRawNickname = getGiftEventSenderRawNickname({
      senderNickname:
        senderProfile?.nickname ||
        safeItem.nickname ||
        safeItem.userNickname ||
        "",
    });
    const senderDisplayNickname = getGiftEventSenderDisplayNickname({
      senderNickname: senderRawNickname,
      isAnonymous:
        safeItem.uid === "anonymous" ||
        safeItem.userIdHash === "anonymous" ||
        extras.isAnonymous === true,
      senderUserRoleCode: senderProfile?.userRoleCode || "",
      senderVerifiedMark: senderProfile?.verifiedMark === true,
      senderBadge: senderProfile?.badge || null,
    });
    const timestamp =
      Number(
        safeItem.msgTime ||
          safeItem.messageTime ||
          overrides.timestamp ||
          0,
      ) || Date.now();
    const stableId = String(
      safeItem.msgTid ||
        safeItem.messageId ||
        safeItem.key ||
        safeItem.messageKey ||
        extras.giftNo ||
        extras.giftId ||
        extras.subscriptionGiftId ||
        "",
    ).trim();
    const streamingChannelId = resolveStreamingChannelId(
      overrides.streamingChannelId,
      overrides.channelId,
      getStreamingChannelId(safeItem, extras, senderProfile),
    );
    const giftData = {
      tierNo: extras.giftTierNo,
      tierName: extras.giftTierName,
      selectionType: extras.selectionType,
      quantity: extras.quantity || 1,
      receiverNickname,
      senderNickname: senderDisplayNickname,
    };

    return {
      uniqueKey: makeUniqueKey({
        prefix: "GIFT",
        stableId: makeGiftReceiverStableId(stableId, receiverNickname),
        timestamp,
        nickname: receiverNickname,
        message: `${giftData.tierName || "구독권"} 선물`,
      }),
      messageKey: stableId,
      sourceNickname: senderRawNickname,
      nickname: receiverNickname,
      message: "",
      profileLite: receiverProfileLite,
      timestamp,
      isAnonymous: false,
      isGift: true,
      giftSubscription: giftData,
      channelId: streamingChannelId,
      streamingChannelId,
      playerMessageTime:
        Number(
          overrides.playerMessageTime || safeItem.playerMessageTime || 0,
        ) || 0,
      videoNo: String(overrides.videoNo || ""),
      type: "INSERT",
    };
  }

  function getGiftEventSenderRawNickname(bdy) {
    const safeBody = bdy && typeof bdy === "object" ? bdy : {};
    return normalizeNickname(
      safeBody.senderNickname ||
        safeBody.giverNickname ||
        safeBody.giftSenderNickname ||
        safeBody.userNickname ||
        safeBody.nickname ||
        safeBody.senderName ||
        "",
    );
  }

  function getGiftEventSenderDisplayNickname(bdy) {
    const safeBody = bdy && typeof bdy === "object" ? bdy : {};
    const senderRawNickname = getGiftEventSenderRawNickname(safeBody);
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

  let blindCaptureSettingReceived = false;
  let chatTimestampSettingReceived = false;
  let originalChatCaptureSettingReceived = false;
  let chatFeaturesRequestTimer = null;
  let chatFeaturesRequestTries = 0;

  function stopChatFeaturesRequestRetry() {
    if (!chatFeaturesRequestTimer) return;
    clearInterval(chatFeaturesRequestTimer);
    chatFeaturesRequestTimer = null;
  }

  function markChatFeatureSettingReceived(type) {
    if (type === INJECT_BLIND_CAPTURE_TOGGLE_TYPE) {
      blindCaptureSettingReceived = true;
    } else if (type === INJECT_CHAT_TIMESTAMP_TOGGLE_TYPE) {
      chatTimestampSettingReceived = true;
    } else if (type === INJECT_ORIGINAL_CHAT_CAPTURE_TOGGLE_TYPE) {
      originalChatCaptureSettingReceived = true;
    }
    if (
      blindCaptureSettingReceived &&
      chatTimestampSettingReceived &&
      originalChatCaptureSettingReceived
    ) {
      stopChatFeaturesRequestRetry();
    }
  }

  function requestChatFeatureSettings() {
    postArchiveMessage(INJECT_CHAT_FEATURES_REQUEST_TYPE, {});
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
      markChatFeatureSettingReceived(messageType);
      const next = payload.enabled === true;
      if (next === restoreBlindedChat) return;
      restoreBlindedChat = next;
      // 다른 확장이 기능 ON 여부를 즉시 감지할 수 있도록 <html>에 표식을 둔다
      // (가려진 채팅이 올라오기 전에도 중복 동작을 피하게 함).
      document.documentElement.classList.toggle(
        "chzzk-badge-moa-restore-blind-enabled",
        restoreBlindedChat,
      );
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
      markChatFeatureSettingReceived(messageType);
      const next = payload.enabled === true;
      const nextFormat = normalizeChatTimestampFormat(payload.format);
      const nextColorMode = normalizeChatTimestampColorMode(payload.colorMode);
      const enabledChanged = next !== showChatTimestamp;
      const formatChanged = nextFormat !== chatTimestampFormat;
      showChatTimestamp = next;
      chatTimestampFormat = nextFormat;
      chatTimestampColorMode = nextColorMode;
      document.documentElement.classList.toggle(
        "chzzk-badge-moa-chat-timestamp-enabled",
        showChatTimestamp,
      );
      document.documentElement.classList.toggle(
        "chzzk-badge-moa-chat-time-contrast",
        chatTimestampColorMode === "contrast",
      );
      if (showChatTimestamp) {
        ensureChatRowObserver();
        if (formatChanged) refreshAllTimestamps();
        if (enabledChanged || formatChanged) sweepExistingRows();
      } else if (enabledChanged) {
        removeAllTimestamps();
        disconnectChatRowObserverIfIdle();
      }
      return;
    }

    // 모아보기 팝업에서 후원/구독/미션/구매 행을 치지직 원본 스타일로 표시하기 위한
    // 시각적 DOM 스냅샷 캡처 on/off.
    if (messageType === INJECT_ORIGINAL_CHAT_CAPTURE_TOGGLE_TYPE) {
      markChatFeatureSettingReceived(messageType);
      const next = payload.enabled === true;
      if (next === captureOriginalSpecialChats) return;
      captureOriginalSpecialChats = next;
      if (captureOriginalSpecialChats) {
        ensureChatRowObserver();
        sweepExistingRows();
      } else {
        disconnectChatRowObserverIfIdle();
      }
      return;
    }
  });

  // 격리 world의 설정 로드와 MAIN world 실행 순서는 보장되지 않는다. 첫 메시지가
  // 유실되어도 현재 값을 다시 받을 수 있도록 세 설정을 모두 받을 때까지 짧게 요청한다.
  requestChatFeatureSettings();
  chatFeaturesRequestTimer = window.setInterval(() => {
    chatFeaturesRequestTries += 1;
    if (
      (blindCaptureSettingReceived &&
        chatTimestampSettingReceived &&
        originalChatCaptureSettingReceived) ||
      chatFeaturesRequestTries > 20
    ) {
      stopChatFeaturesRequestRetry();
      return;
    }
    requestChatFeatureSettings();
  }, 300);

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

    // VOD에는 SUBSCRIPTION_GIFT_RECEIVER(93006)가 없으므로 채팅 패킷에서
    // 수신자 기준 entry를 별도로 생성한다. 발신자가 일반 시청자여도 수신자 배지로
    // 필터링할 수 있어야 하므로 parseNormalMessage 결과와 독립적으로 처리한다.
    const receiverPayload = buildGiftReceiverPayloadFromChatItem(adaptedItem, {
      channelId: payload?.streamingChannelId || payload?.channelId || "",
      playerMessageTime,
      videoNo: videoNoStr,
    });
    postArchiveMessageIfTarget(receiverPayload);
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

        // 구독권 선물은 행의 주체가 발신자이지만 모아보기 대상은 수신자일 수도 있다.
        // 일반 시청자 발신자가 조기 필터링되더라도 수신자 기준으로 별도 판별한다.
        const receiverPayload = buildGiftReceiverPayloadFromChatItem(item, {
          channelId: payload?.streamingChannelId || payload?.channelId || "",
        });
        postArchiveMessageIfTarget(receiverPayload);
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
      stableId:
        item.msgTid || item.messageId || item.key || item.messageKey || "",
      timestamp,
      nickname,
      message: messageContent,
    });

    return {
      uniqueKey,
      messageKey: String(
        item.messageKey || item.key || item.msgTid || item.messageId || "",
      ).trim(),
      playerMessageTime: Number(item.playerMessageTime || 0) || 0,
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
    const timestamp = Number(readChatEpochMs(bdy) || 0) || Date.now();
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
      const messageKey = String(
        bdy.msgTid ||
          bdy.messageId ||
          bdy.messageKey ||
          bdy.giftNo ||
          bdy.giftId ||
          bdy.subscriptionGiftId ||
          "",
      ).trim();

      if (receiverNickname) {
        const receiverProfileLite = buildProfileLiteFromGiftReceiverEvent(bdy);
        postArchiveMessageIfTarget({
          uniqueKey: makeUniqueKey({
            prefix: "GIFT",
            stableId: makeGiftReceiverStableId(
              messageKey,
              receiverNickname,
            ),
            timestamp,
            nickname: receiverNickname,
            message: `${giftData.tierName || "구독권"} 선물`,
          }),
          messageKey,
          sourceNickname: getGiftEventSenderRawNickname(bdy),
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
      // 3-1. 미션 참여(PARTICIPATION)는 93006에서 무시 (93102 채팅 패킷으로 처리).
      // 참여는 개인 채팅(93102)이라 프로필·역할이 있어 역할 기반 필터가 그쪽에서 동작한다.
      if (bdy.missionDonationType === "PARTICIPATION") {
        return;
      }

      // 미션 등록/진행/결과/거절은 채널 전체에 공개되는 이벤트(진행 중인 미션)이고
      // 익명이면 nickname 조차 null 이라 역할 기반 필터로는 식별할 신원 정보가 없다.
      // 따라서 이 계열은 개인 채팅이 아니라 이벤트로 보고, 대상 필터 없이 항상 수집한다.
      // (참여 미션만 위에서 93102 로 넘겨 역할 필터를 유지한다.)

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

        postArchiveMessage("CHZZK_CHAT_LOG", {
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
        postArchiveMessage("CHZZK_CHAT_LOG", {
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
        postArchiveMessage("CHZZK_CHAT_LOG", {
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
      if (hasActiveChatDomFeatures()) {
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
