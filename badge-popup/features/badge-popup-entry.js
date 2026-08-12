(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.entryApi && typeof ns.entryApi === "object") return;

  const ORIGINAL_CHAT_SNAPSHOT_MAX_LENGTH = 80000;
  const ORIGINAL_CHAT_SNAPSHOT_MAX_COUNT = 200;
  const ORIGINAL_CHAT_SNAPSHOT_KINDS = new Set([
    "donation",
    "subscription",
    "mission",
    "purchase",
  ]);

  function normalizeOriginalChatMatchText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeOriginalChatNicknames(values) {
    const result = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : [values]) {
      const nickname = normalizeOriginalChatMatchText(value);
      if (!nickname || seen.has(nickname)) continue;
      seen.add(nickname);
      result.push(nickname);
    }
    return result;
  }

  function getOriginalChatKindFromPayload(payload) {
    if (!payload || typeof payload !== "object") return "";
    if (payload.isCommercePurchase === true) return "purchase";
    if (payload.isMissionDonation === true) return "mission";
    if (
      payload.subscription ||
      payload.isSubscription === true ||
      payload.giftSubscription ||
      payload.isGift === true
    ) {
      return "subscription";
    }
    if (payload.isDonation === true) return "donation";
    return "";
  }

  function isOriginalChatSnapshotMatch(entry, snapshot) {
    if (!entry || !snapshot) return false;

    const sourceKind = String(entry.sourceChatKind || "").trim();
    if (!sourceKind || sourceKind !== snapshot.kind) return false;

    const sourceReceiverNickname = normalizeOriginalChatMatchText(
      entry.sourceReceiverNickname,
    );
    const snapshotReceiverNickname = normalizeOriginalChatMatchText(
      snapshot.receiverNickname,
    );
    if (sourceReceiverNickname || snapshotReceiverNickname) {
      if (
        !sourceReceiverNickname ||
        !snapshotReceiverNickname ||
        sourceReceiverNickname !== snapshotReceiverNickname
      ) {
        return false;
      }
    }

    const sourceKey = String(entry.sourceKey || "").trim();
    if (sourceKey && sourceKey === snapshot.uniqueKey) return true;

    const sourceMessageKey = String(entry.sourceMessageKey || "").trim();
    if (
      sourceMessageKey &&
      snapshot.messageKey &&
      sourceMessageKey === snapshot.messageKey
    ) {
      return true;
    }

    const sourceNicknames = normalizeOriginalChatNicknames([
      entry.sourceNickname,
      entry.nickname,
    ]);
    const snapshotNicknames = normalizeOriginalChatNicknames([
      snapshot.nickname,
      ...(Array.isArray(snapshot.relatedNicknames)
        ? snapshot.relatedNicknames
        : []),
    ]);
    if (
      sourceNicknames.length === 0 ||
      snapshotNicknames.length === 0 ||
      !sourceNicknames.some((nickname) => snapshotNicknames.includes(nickname))
    ) {
      return false;
    }

    const sourcePlayerTime = Number(entry.sourcePlayerMessageTime || 0) || 0;
    const snapshotPlayerTime = Number(snapshot.playerMessageTime || 0) || 0;
    if (
      sourcePlayerTime > 0 &&
      snapshotPlayerTime > 0 &&
      Math.abs(sourcePlayerTime - snapshotPlayerTime) <= 50
    ) {
      return true;
    }

    const sourceMessage = normalizeOriginalChatMatchText(entry.sourceMessage);
    const snapshotMessage = normalizeOriginalChatMatchText(snapshot.message);
    if (
      sourceMessage &&
      snapshotMessage &&
      sourceMessage !== snapshotMessage
    ) {
      return false;
    }

    const sourceTimestamp =
      Number(entry.sourceTimestamp || entry.timestamp || 0) || 0;
    const snapshotTimestamp = Number(snapshot.timestamp || 0) || 0;
    return (
      sourceTimestamp > 1e12 &&
      snapshotTimestamp > 1e12 &&
      Math.abs(sourceTimestamp - snapshotTimestamp) <= 1000
    );
  }

  function takePendingOriginalChatSnapshot(state, entryMeta) {
    if (!(state?.originalChatSnapshots instanceof Map)) return null;
    for (const [key, snapshot] of state.originalChatSnapshots) {
      if (!isOriginalChatSnapshotMatch(entryMeta, snapshot)) continue;
      state.originalChatSnapshots.delete(key);
      return snapshot;
    }
    return null;
  }

  function appendBadgeChat(state, payload, options = {}, deps = {}) {
    if (!payload || typeof payload !== "object") return null;
    const normalizeNickname =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const isExcludedCollectNickname =
      typeof deps.isExcludedCollectNickname === "function"
        ? deps.isExcludedCollectNickname
        : () => false;
    const isBadgeTargetProfile =
      typeof deps.isBadgeTargetProfile === "function"
        ? deps.isBadgeTargetProfile
        : () => false;
    const normalizeEntry =
      typeof deps.normalizeEntry === "function" ? deps.normalizeEntry : () => null;
    const insertEntrySorted =
      typeof deps.insertEntrySorted === "function"
        ? deps.insertEntrySorted
        : () => {};
    const rememberNicknameRoleBadgesFromEntry =
      typeof deps.rememberNicknameRoleBadgesFromEntry === "function"
        ? deps.rememberNicknameRoleBadgesFromEntry
        : () => {};
    const updateUnseenActor =
      typeof deps.updateUnseenActor === "function" ? deps.updateUnseenActor : () => {};
    const triggerAttention =
      typeof deps.triggerAttention === "function" ? deps.triggerAttention : () => {};
    const schedulePersistChannelCache =
      typeof deps.schedulePersistChannelCache === "function"
        ? deps.schedulePersistChannelCache
        : () => {};
    const render = typeof deps.render === "function" ? deps.render : () => {};
    const maxKeepEntries = Number(deps.MAX_KEEP_ENTRIES) || 500;

    const deferRender = options.deferRender === true;
    const skipAttention = options.skipAttention === true;

    const messageType = String(payload.type || "INSERT").toUpperCase();
    if (
      messageType !== "INSERT" &&
      messageType !== "INSERT_OR_APPEND_TO_LATEST"
    ) {
      return null;
    }

    const profile = payload.profileLite || payload.profile;
    const payloadNickname = normalizeNickname(
      payload.nickname || profile?.nickname || "",
    );
    if (isExcludedCollectNickname(payloadNickname)) return null;
    if (!isBadgeTargetProfile(profile, payload)) return null;

    const entry = normalizeEntry(payload);
    if (!entry) return null;

    if (state.dedupeKeys.has(entry.dedupeKey)) return null;

    state.dedupeKeys.add(entry.dedupeKey);
    insertEntrySorted(entry);
    rememberNicknameRoleBadgesFromEntry(entry);

    if (state.entries.length > maxKeepEntries) {
      const overflow = state.entries.splice(0, state.entries.length - maxKeepEntries);
      overflow.forEach((item) => state.dedupeKeys.delete(item.dedupeKey));
      state.unseenCount = Math.min(state.unseenCount, state.entries.length);
    }

    if (!state.isOpen) {
      state.unseenCount += 1;
      updateUnseenActor(entry);
      if (!skipAttention) {
        triggerAttention(entry);
      }
    }

    schedulePersistChannelCache();
    if (!deferRender) {
      render();
    }
    return entry;
  }

  function insertEntrySorted(state, entry) {
    const list = state.entries;
    if (list.length === 0) {
      list.push(entry);
      return;
    }

    const last = list[list.length - 1];
    const lastTimestamp = Number(last?.timestamp || 0);
    const lastSequence = Number(last?.sequence || 0);
    if (
      entry.timestamp > lastTimestamp ||
      (entry.timestamp === lastTimestamp && entry.sequence >= lastSequence)
    ) {
      list.push(entry);
      return;
    }

    for (let i = list.length - 1; i >= 0; i -= 1) {
      const current = list[i];
      const currentTimestamp = Number(current?.timestamp || 0);
      const currentSequence = Number(current?.sequence || 0);
      if (
        entry.timestamp > currentTimestamp ||
        (entry.timestamp === currentTimestamp &&
          entry.sequence >= currentSequence)
      ) {
        list.splice(i + 1, 0, entry);
        return;
      }
    }

    list.unshift(entry);
  }

  function isBadgeTargetProfile(profile, payload, deps = {}) {
    const extractRoleInfo =
      typeof deps.extractRoleInfo === "function" ? deps.extractRoleInfo : () => ({});
    const isTrackedTarget =
      typeof deps.isTrackedTarget === "function" ? deps.isTrackedTarget : () => false;

    const safeProfile = profile && typeof profile === "object" ? profile : {};
    const roleInfo = extractRoleInfo(safeProfile);
    const isPartner = safeProfile.verifiedMark === true;
    const isTracked = isTrackedTarget(safeProfile, payload);

    return (
      roleInfo.isManager ||
      roleInfo.isOperator ||
      roleInfo.isChannelOwner ||
      isPartner ||
      isTracked
    );
  }

  function normalizeEntry(state, payload, deps = {}) {
    const extractRoleInfo =
      typeof deps.extractRoleInfo === "function" ? deps.extractRoleInfo : () => ({});
    const isTrackedTarget =
      typeof deps.isTrackedTarget === "function" ? deps.isTrackedTarget : () => false;
    const normalizeEmojiMap =
      typeof deps.normalizeEmojiMap === "function" ? deps.normalizeEmojiMap : () => ({});
    const extractTitleColor =
      typeof deps.extractTitleColor === "function" ? deps.extractTitleColor : () => "";
    const buildEntryTypeMeta =
      typeof deps.buildEntryTypeMeta === "function" ? deps.buildEntryTypeMeta : () => ({
        message: "",
        tags: [],
        pillLabel: "",
        pillTone: "neutral",
      });
    const buildPillBadges =
      typeof deps.buildPillBadges === "function" ? deps.buildPillBadges : () => [];
    const buildPopupBadges =
      typeof deps.buildPopupBadges === "function" ? deps.buildPopupBadges : () => [];
    const makeBadge = typeof deps.makeBadge === "function" ? deps.makeBadge : () => null;
    const buildAchievementMark =
      typeof deps.buildAchievementMark === "function"
        ? deps.buildAchievementMark
        : () => null;
    const officialMarkUrl = String(deps.OFFICIAL_MARK_URL || "");

    const profile = payload.profileLite || payload.profile || {};
    const roleInfo = extractRoleInfo(profile);
    const trackedTarget = isTrackedTarget(profile, payload);
    const badgeType = roleInfo.isChannelOwner
      ? "channel_owner"
      : roleInfo.isOperator
        ? "operator"
        : roleInfo.isManager
          ? "manager"
          : roleInfo.isPartner
            ? "partner"
            : trackedTarget
              ? "custom"
              : "partner";

    const timestamp = Number(payload.timestamp || Date.now()) || Date.now();
    const nickname =
      String(payload.nickname || profile.nickname || "알 수 없음").trim() ||
      "알 수 없음";
    const message = String(payload.message || "").trim();
    const emojis = normalizeEmojiMap(payload.emojis);
    const titleColor = extractTitleColor(profile);
    const entryTypeMeta = buildEntryTypeMeta({
      nickname,
      isAnonymous: payload.isAnonymous === true,
      message,
      isDonation: payload.isDonation === true,
      donationAmount: Number(payload.donationAmount || 0) || 0,
      isPartyDonation: payload.isPartyDonation === true,
      partyDonation: payload.partyDonation,
      isVideoDonation: payload.isVideoDonation === true,
      isMissionDonation: payload.isMissionDonation === true,
      missionDonationType: payload.missionDonationType,
      missionStatus: payload.missionStatus,
      missionResult: payload.missionResult,
      subscription: payload.subscription,
      isGift: payload.isGift === true,
      giftSubscription: payload.giftSubscription,
    });

    const uniqueBase =
      payload.uniqueKey || `${nickname}_${timestamp}_${message.slice(0, 16)}`;
    const sourceMeta = {
      sourceKey: String(uniqueBase),
      sourceMessageKey: String(
        payload.messageKey ||
          payload.key ||
          payload.msgTid ||
          payload.messageId ||
          "",
      ).trim(),
      sourcePlayerMessageTime: Number(payload.playerMessageTime || 0) || 0,
      sourceTimestamp:
        Number(payload.sourceTimestamp || payload.timestamp || timestamp) ||
        timestamp,
      sourceNickname: normalizeOriginalChatMatchText(
        payload.sourceNickname || nickname,
      ),
      sourceReceiverNickname: normalizeOriginalChatMatchText(
        payload.giftSubscription?.receiverNickname,
      ),
      sourceMessage: message,
      sourceChatKind: getOriginalChatKindFromPayload(payload),
    };
    const pendingSnapshot = takePendingOriginalChatSnapshot(state, sourceMeta);

    const dedupeKey = `${uniqueBase}:${badgeType}`;
    const pillBadges = buildPillBadges(profile, roleInfo);
    const popupBadges = buildPopupBadges(profile, roleInfo);
    const partnerMark = roleInfo.isPartner
      ? makeBadge("partner", "파트너", officialMarkUrl)
      : null;
    const achievementMark = buildAchievementMark(profile);

    const authorUserIdHash = normalizeAuthorUserIdHash(payload.authorUserIdHash);

    // 엔트리에 소속 채널 도장을 박는다. payload 에 채널이 있으면 그걸, 없으면(미션 등
    // 채널 없는 이벤트) 이 탭이 확정한 채널로 귀속시킨다. 이 값으로 캐시 복원/저장 시
    // 다른 채널 엔트리가 섞이는 것을 걸러낸다.
    const entryChannelId = normalizeEntryChannelId(
      payload.streamingChannelId ||
        payload.channelId ||
        state.resolvedChannelId ||
        "",
    );

    return {
      dedupeKey,
      ...sourceMeta,
      timestamp,
      nickname,
      message: entryTypeMeta.message,
      emojis,
      titleColor,
      badgeType,
      pillBadges,
      popupBadges,
      partnerMark,
      achievementMark,
      tags: entryTypeMeta.tags,
      typeLabel: entryTypeMeta.pillLabel,
      typeTone: entryTypeMeta.pillTone,
      authorUserIdHash,
      channelId: entryChannelId,
      originalChatHtml: pendingSnapshot?.html || "",
      originalChatKind: pendingSnapshot?.kind || "",
      sequence: state.sequence++,
    };
  }

  function applyOriginalChatSnapshot(state, rawSnapshot, deps = {}) {
    const snapshot = normalizeOriginalChatSnapshot(rawSnapshot);
    if (!snapshot) return false;

    const entries = Array.isArray(state?.entries) ? state.entries : [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (!isOriginalChatSnapshotMatch(entry, snapshot)) continue;
      const originalChanged =
        entry.originalChatHtml !== snapshot.html ||
        entry.originalChatKind !== snapshot.kind;
      entry.originalChatHtml = snapshot.html;
      entry.originalChatKind = snapshot.kind;
      if (originalChanged) entry.originalChatPersisted = false;
      if (
        originalChanged &&
        typeof deps.schedulePersistChannelCache === "function"
      ) {
        deps.schedulePersistChannelCache();
      }
      if (
        originalChanged &&
        state?.isOpen === true &&
        state?.settings?.useOriginalSpecialChatStyle === true &&
        typeof deps.renderList === "function"
      ) {
        deps.renderList("preserve-bottom");
      }
      return true;
    }

    if (!(state.originalChatSnapshots instanceof Map)) {
      state.originalChatSnapshots = new Map();
    }
    state.originalChatSnapshots.set(snapshot.uniqueKey, snapshot);
    while (state.originalChatSnapshots.size > ORIGINAL_CHAT_SNAPSHOT_MAX_COUNT) {
      const oldestKey = state.originalChatSnapshots.keys().next().value;
      if (oldestKey === undefined) break;
      state.originalChatSnapshots.delete(oldestKey);
    }
    return false;
  }

  function normalizeOriginalChatSnapshot(rawSnapshot) {
    if (!rawSnapshot || typeof rawSnapshot !== "object") return null;
    const uniqueKey = String(rawSnapshot.uniqueKey || "").trim();
    const kind = String(rawSnapshot.kind || "").trim().toLowerCase();
    const html = String(rawSnapshot.html || "").trim();
    if (!uniqueKey || !ORIGINAL_CHAT_SNAPSHOT_KINDS.has(kind)) return null;
    if (!html || html.length > ORIGINAL_CHAT_SNAPSHOT_MAX_LENGTH) return null;
    return {
      uniqueKey,
      kind,
      html,
      messageKey: String(rawSnapshot.messageKey || "").trim(),
      playerMessageTime:
        Number(rawSnapshot.playerMessageTime || 0) || 0,
      timestamp: Number(rawSnapshot.timestamp || 0) || 0,
      nickname: normalizeOriginalChatMatchText(rawSnapshot.nickname),
      receiverNickname: normalizeOriginalChatMatchText(
        rawSnapshot.receiverNickname,
      ),
      relatedNicknames: normalizeOriginalChatNicknames(
        rawSnapshot.relatedNicknames,
      ),
      message: normalizeOriginalChatMatchText(rawSnapshot.message),
      capturedAt: Number(rawSnapshot.capturedAt || Date.now()) || Date.now(),
    };
  }

  function normalizeEntryChannelId(value) {
    const trimmed = String(value || "").trim();
    if (!/^[a-f0-9]{32}$/i.test(trimmed)) return "";
    return trimmed.toLowerCase();
  }

  function normalizeAuthorUserIdHash(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (!/^[a-f0-9]{32}$/i.test(trimmed)) return "";
    return trimmed.toLowerCase();
  }

  function buildEntryTypeMeta(source, deps = {}) {
    const getDonationTone =
      typeof deps.getDonationTone === "function" ? deps.getDonationTone : () => "donation-neutral";
    const buildGiftMessage =
      typeof deps.buildGiftMessage === "function" ? deps.buildGiftMessage : () => "";
    const getPillTypeLabel =
      typeof deps.getPillTypeLabel === "function" ? deps.getPillTypeLabel : () => "";
    const getPillTypeTone =
      typeof deps.getPillTypeTone === "function"
        ? deps.getPillTypeTone
        : () => "neutral";

    const tags = [];
    let message = String(source?.message || "");

    const donationAmount = Number(source?.donationAmount || 0) || 0;
    const donationTone = getDonationTone(donationAmount);

    if (source?.missionResult && typeof source.missionResult === "object") {
      const isSuccess = source.missionResult.isSuccess === true;
      tags.push({
        label: `미션 ${isSuccess ? "성공" : "실패"}`,
        tone: isSuccess ? "mission-success" : "mission-failed",
      });
      const missionAmount = Number(source.missionResult.totalPayAmount || 0) || 0;
      if (missionAmount > 0) {
        tags.push({
          label: `${missionAmount.toLocaleString()}치즈`,
          tone: getDonationTone(missionAmount),
        });
      }
      return {
        tags,
        message,
        pillLabel: isSuccess ? "미션 성공" : "미션 실패",
        pillTone: isSuccess ? "mission-success" : "mission-failed",
      };
    }

    if (source?.isMissionDonation) {
      if (
        String(source.missionDonationType || "").toUpperCase() === "PARTICIPATION"
      ) {
        tags.push({ label: "미션 상금 추가", tone: "mission" });
      } else if (String(source.missionStatus || "").toUpperCase() === "REJECTED") {
        tags.push({ label: "미션 거절", tone: "mission-failed" });
      } else {
        tags.push({ label: "미션", tone: "mission" });
      }
    }

    if (source?.isVideoDonation) {
      tags.push({ label: "영상후원", tone: "video" });
    }

    if (source?.isPartyDonation && source.partyDonation) {
      const partyName = String(source.partyDonation.partyName || "").trim();
      if (partyName) {
        tags.push({ label: partyName, tone: "party" });
      }
      tags.push({ label: "파티 후원금 추가", tone: "party" });
    }

    if (source?.isDonation && donationAmount > 0) {
      tags.push({
        label: `${donationAmount.toLocaleString()}치즈`,
        tone: donationTone,
      });
    }

    if (source?.subscription) {
      const month = Number(source.subscription.month || 0) || 0;
      const tierName =
        String(source.subscription.tierName || "구독").trim() || "구독";
      const subLabel = month > 0 ? `${month}개월/${tierName}` : tierName;
      tags.push({ label: subLabel, tone: "subscription" });
    } else if (source?.giftSubscription || source?.isGift) {
      tags.push({ label: "구독권 선물", tone: "subscription" });
    }

    if (source?.giftSubscription) {
      message = buildGiftMessage(source.giftSubscription, {
        nickname: source.nickname,
        isAnonymous: source.isAnonymous === true,
      });
    }

    return {
      tags,
      message,
      pillLabel: getPillTypeLabel(source),
      pillTone: getPillTypeTone(source, donationTone),
    };
  }

  function getDonationTone(amount) {
    const value = Number(amount || 0) || 0;
    if (value >= 1000000) return "donation-brick";
    if (value >= 500000) return "donation-camel";
    if (value >= 100000) return "donation-green";
    if (value >= 10000) return "donation-cyan";
    if (value > 0) return "donation-violet";
    return "donation-neutral";
  }

  function getPillTypeLabel(source) {
    if (source?.missionResult && typeof source.missionResult === "object") {
      return source.missionResult.isSuccess === true ? "미션 성공" : "미션 실패";
    }
    if (source?.giftSubscription || source?.isGift) return "구독 선물";
    if (source?.subscription) return "구독";
    if (source?.isPartyDonation) return "파티 후원";
    if (source?.isVideoDonation) return "영상후원";
    if (source?.isMissionDonation) {
      if (
        String(source.missionDonationType || "").toUpperCase() === "PARTICIPATION"
      ) {
        return "미션 상금";
      }
      if (String(source.missionStatus || "").toUpperCase() === "REJECTED") {
        return "미션 거절";
      }
      return "미션";
    }
    if (source?.isDonation) return "후원";
    return "";
  }

  function getPillTypeTone(source, donationTone) {
    if (source?.missionResult && typeof source.missionResult === "object") {
      return source.missionResult.isSuccess === true
        ? "mission-success"
        : "mission-failed";
    }
    if (source?.giftSubscription || source?.isGift || source?.subscription) {
      return "subscription";
    }
    if (source?.isPartyDonation) return "party";
    if (source?.isVideoDonation) return "video";
    if (source?.isMissionDonation) {
      return String(source.missionStatus || "").toUpperCase() === "REJECTED"
        ? "mission-failed"
        : "mission";
    }
    if (source?.isDonation) return donationTone || "donation-neutral";
    return "neutral";
  }

  function buildGiftMessage(gift, identity) {
    const giftInfo = gift && typeof gift === "object" ? gift : {};
    const tierName = String(giftInfo.tierName || "").trim();
    const receiverNickname = String(giftInfo.receiverNickname || "").trim();
    const quantity = Number(giftInfo.quantity || 0) || 0;
    const identityNickname = String(identity?.nickname || "").trim();
    const isReceiverPerspective =
      !!receiverNickname &&
      !!identityNickname &&
      receiverNickname === identityNickname;
    const giftLabel = tierName ? `${tierName} 구독권` : "구독권";

    if (isReceiverPerspective) {
      return `${giftLabel}을 선물받았습니다.`;
    }
    if (quantity > 1) {
      return `${giftLabel}을 ${quantity}장 선물했습니다.`;
    }
    return `${giftLabel}을 선물했습니다.`;
  }

  function extractTitleColor(profile) {
    const color = profile?.title?.color;
    if (typeof color !== "string") return "";
    return color.trim();
  }

  function normalizeEmojiMap(emojis) {
    if (!emojis || typeof emojis !== "object" || Array.isArray(emojis)) {
      return {};
    }

    const normalized = {};
    Object.entries(emojis).forEach(([key, value]) => {
      const emojiKey = String(key || "").trim();
      const emojiUrl = String(value || "").trim();
      if (!emojiKey || !emojiUrl) return;
      normalized[emojiKey] = emojiUrl;
    });

    return normalized;
  }

  function extractRoleInfo(profile) {
    const roleCode = String(profile.userRoleCode || "").toLowerCase();
    const roleBadgeUrl = String(profile?.badge?.imageUrl || "").trim();
    const isOperator =
      roleCode.includes("operator") ||
      roleCode.includes("admin") ||
      roleCode.includes("staff") ||
      roleBadgeUrl.includes("/icon/owner.png");
    const isChannelOwner =
      roleCode.includes("streamer") ||
      (roleCode.includes("owner") && !isOperator) ||
      roleCode.includes("broadcaster");
    const isManager = roleCode.includes("manager") && !isOperator;
    const isPartner = profile.verifiedMark === true;
    return { isManager, isOperator, isChannelOwner, isPartner };
  }

  function buildPillBadges(profile, roleInfo, deps = {}) {
    const makeBadge = typeof deps.makeBadge === "function" ? deps.makeBadge : () => null;
    const pushBadgeUnique =
      typeof deps.pushBadgeUnique === "function" ? deps.pushBadgeUnique : () => {};
    const managerBadge = String(deps.MANAGER_BADGE_FALLBACK_URL || "");
    const channelOwnerBadge = String(deps.CHANNEL_OWNER_BADGE_FALLBACK_URL || "");
    const ownerBadge = String(deps.OWNER_BADGE_FALLBACK_URL || "");
    const officialMark = String(deps.OFFICIAL_MARK_URL || "");

    const badges = [];
    const seen = new Set();

    if (roleInfo.isChannelOwner) {
      pushBadgeUnique(
        badges,
        seen,
        makeBadge("channel_owner", "방장", profile?.badge?.imageUrl || channelOwnerBadge),
      );
    }

    if (roleInfo.isOperator) {
      pushBadgeUnique(
        badges,
        seen,
        makeBadge("operator", "치지직 운영자", profile?.badge?.imageUrl || ownerBadge),
      );
    }

    if (roleInfo.isManager) {
      pushBadgeUnique(
        badges,
        seen,
        makeBadge("manager", "매니저", profile?.badge?.imageUrl || managerBadge),
      );
    }

    if (roleInfo.isPartner) {
      pushBadgeUnique(badges, seen, makeBadge("partner", "파트너", officialMark));
    }

    return badges;
  }

  function buildPopupBadges(profile, roleInfo, deps = {}) {
    const makeBadge = typeof deps.makeBadge === "function" ? deps.makeBadge : () => null;
    const pushBadgeUnique =
      typeof deps.pushBadgeUnique === "function" ? deps.pushBadgeUnique : () => {};
    const managerBadge = String(deps.MANAGER_BADGE_FALLBACK_URL || "");
    const channelOwnerBadge = String(deps.CHANNEL_OWNER_BADGE_FALLBACK_URL || "");
    const ownerBadge = String(deps.OWNER_BADGE_FALLBACK_URL || "");

    const badges = [];
    const seen = new Set();

    if (roleInfo.isChannelOwner) {
      pushBadgeUnique(
        badges,
        seen,
        makeBadge("channel_owner", "방장", profile?.badge?.imageUrl || channelOwnerBadge),
      );
    } else if (roleInfo.isOperator) {
      pushBadgeUnique(
        badges,
        seen,
        makeBadge("operator", "치지직 운영자", profile?.badge?.imageUrl || ownerBadge),
      );
    } else if (roleInfo.isManager) {
      pushBadgeUnique(
        badges,
        seen,
        makeBadge("manager", "매니저", profile?.badge?.imageUrl || managerBadge),
      );
    } else if (profile?.badge?.imageUrl) {
      pushBadgeUnique(badges, seen, makeBadge("role", "역할 배지", profile.badge.imageUrl));
    }

    const subscriptionBadgeUrl =
      profile?.streamingProperty?.subscription?.badge?.imageUrl || "";
    if (subscriptionBadgeUrl) {
      pushBadgeUnique(
        badges,
        seen,
        makeBadge("subscription", "구독 배지", subscriptionBadgeUrl),
      );
    }

    const viewerBadges = Array.isArray(profile?.viewerBadges)
      ? profile.viewerBadges
      : [];
    viewerBadges.forEach((viewerBadge) => {
      const imageUrl = viewerBadge?.badge?.imageUrl || "";
      const label = viewerBadge?.badge?.badgeId || "시청자 배지";
      if (!imageUrl) return;
      pushBadgeUnique(badges, seen, makeBadge("viewer", label, imageUrl));
    });

    return badges;
  }

  function getFirstActivatedAchievementBadgeId(profile) {
    const ids = Array.isArray(profile?.streamingProperty?.activatedAchievementBadgeIds)
      ? profile.streamingProperty.activatedAchievementBadgeIds
      : [];
    return String(ids[0] || "").trim();
  }

  function buildAchievementMark(profile, deps = {}) {
    const makeBadge = typeof deps.makeBadge === "function" ? deps.makeBadge : () => null;
    const getFirstActivatedAchievementBadgeId =
      typeof deps.getFirstActivatedAchievementBadgeId === "function"
        ? deps.getFirstActivatedAchievementBadgeId
        : () => "";
    const achievementMap =
      deps.ACHIEVEMENT_BADGE_URL_MAP && typeof deps.ACHIEVEMENT_BADGE_URL_MAP === "object"
        ? deps.ACHIEVEMENT_BADGE_URL_MAP
        : {};

    const badgeId = getFirstActivatedAchievementBadgeId(profile);
    if (!badgeId) return null;
    const iconUrl = String(
      achievementMap[badgeId] || achievementMap[badgeId.toLowerCase()] || "",
    ).trim();
    if (!iconUrl) return null;
    return makeBadge("achievement", badgeId, iconUrl);
  }

  function makeBadge(type, label, iconUrl) {
    return {
      type: type || "unknown",
      label: String(label || "배지"),
      iconUrl: String(iconUrl || ""),
    };
  }

  function pushBadgeUnique(list, seen, badge) {
    if (!badge) return;
    const key = `${badge.type}|${badge.iconUrl}|${badge.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push(badge);
  }

  ns.entryApi = {
    appendBadgeChat,
    insertEntrySorted,
    isBadgeTargetProfile,
    normalizeEntry,
    applyOriginalChatSnapshot,
    normalizeAuthorUserIdHash,
    buildEntryTypeMeta,
    getDonationTone,
    getPillTypeLabel,
    getPillTypeTone,
    buildGiftMessage,
    extractTitleColor,
    normalizeEmojiMap,
    extractRoleInfo,
    buildPillBadges,
    buildPopupBadges,
    getFirstActivatedAchievementBadgeId,
    buildAchievementMark,
    makeBadge,
    pushBadgeUnique,
  };
})();
