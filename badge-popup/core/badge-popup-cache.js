(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  const constants = ns.constants;
  if (!constants || typeof constants !== "object") {
    console.error("[badge-moa] constants module not loaded");
    return;
  }
  if (ns.cache && typeof ns.cache === "object") return;

  const { STORAGE_CHANNEL_CACHE_PREFIX, MAX_KEEP_ENTRIES } = constants;

  function isSessionCacheEnabled(state) {
    return state.settings.enableSessionCache === true;
  }

  function getChannelCacheStorageKeys(state, channelIdCandidate, deps = {}) {
    if (!isSessionCacheEnabled(state) && !deps.ignoreEnabledCheck) return [];
    const normalizeChannelId =
      typeof deps.normalizeChannelId === "function"
        ? deps.normalizeChannelId
        : (value) => String(value || "").trim();
    const getChannelIdFromLocationPath =
      typeof deps.getChannelIdFromLocationPath === "function"
        ? deps.getChannelIdFromLocationPath
        : () => "";
    const getRawChannelIdFromLocationPath =
      typeof deps.getRawChannelIdFromLocationPath === "function"
        ? deps.getRawChannelIdFromLocationPath
        : () => "";

    const isStable = (value) => /^[a-f0-9]{32}$/i.test(value);
    const channelIds = [];
    const addChannelId = (value) => {
      const normalized = normalizeChannelId(value);
      if (!normalized || !isStable(normalized)) return;
      if (channelIds.includes(normalized)) return;
      channelIds.push(normalized);
    };

    const hasExplicitCandidate = channelIdCandidate != null;
    if (hasExplicitCandidate) {
      addChannelId(channelIdCandidate);
    } else {
      addChannelId(state.resolvedChannelId);
      addChannelId(getChannelIdFromLocationPath());
      addChannelId(getRawChannelIdFromLocationPath());
    }

    return channelIds.map(
      (channelId) => `${STORAGE_CHANNEL_CACHE_PREFIX}channel:${channelId}`,
    );
  }

  function getChannelCacheStorageKey(state, channelIdCandidate, deps = {}) {
    const keys = getChannelCacheStorageKeys(state, channelIdCandidate, deps);
    return keys[0] || "";
  }

  // 캐시 저장키(`...channel:{id}`)에서 채널 id 만 뽑는다.
  function channelIdFromCacheStorageKey(storageKey) {
    const raw = String(storageKey || "");
    const marker = "channel:";
    const idx = raw.lastIndexOf(marker);
    if (idx === -1) return "";
    const id = raw.slice(idx + marker.length).trim().toLowerCase();
    return /^[a-f0-9]{32}$/i.test(id) ? id : "";
  }

  // 대상 채널과 다른 채널 도장이 찍힌 엔트리를 제거한다(오염 방지/자가 정화).
  // 채널 도장이 없는 과거 엔트리(구버전 캐시)는 판단 불가라 통과시킨다.
  function filterEntriesByTargetChannel(entries, targetChannelId) {
    if (!Array.isArray(entries)) return [];
    const target = String(targetChannelId || "").trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/i.test(target)) return entries;
    return entries.filter((entry) => {
      const entryChannelId = String(entry && entry.channelId ? entry.channelId : "")
        .trim()
        .toLowerCase();
      if (!/^[a-f0-9]{32}$/i.test(entryChannelId)) return true;
      return entryChannelId === target;
    });
  }

  function clearPersistChannelCacheTimer(state) {
    if (state.cache.saveTimer) {
      clearTimeout(state.cache.saveTimer);
      state.cache.saveTimer = null;
    }
  }

  function schedulePersistChannelCache(state, deps = {}) {
    if (!isSessionCacheEnabled(state)) return;
    clearPersistChannelCacheTimer(state);
    state.cache.saveTimer = setTimeout(() => {
      state.cache.saveTimer = null;
      if (typeof deps.persistChannelCacheNow === "function") {
        deps.persistChannelCacheNow();
      }
    }, 220);
  }

  async function persistChannelCacheNow(state, deps = {}, channelIdCandidate) {
    if (!isSessionCacheEnabled(state)) return;
    const storageKeys = getChannelCacheStorageKeys(state, channelIdCandidate, deps);
    if (storageKeys.length === 0) return;

    const serializeEntryForCacheFn =
      typeof deps.serializeEntryForCache === "function"
        ? deps.serializeEntryForCache
        : () => null;
    const normalizeChannelId =
      typeof deps.normalizeChannelId === "function"
        ? deps.normalizeChannelId
        : (value) => String(value || "").trim();
    const serializeUnseenStateForCacheFn =
      typeof deps.serializeUnseenStateForCache === "function"
        ? deps.serializeUnseenStateForCache
        : () => ({ count: 0, actors: [] });
    const getStorageValueFn =
      typeof deps.getStorageValue === "function"
        ? deps.getStorageValue
        : async () => null;

    const localEntries = Array.isArray(state.entries)
      ? state.entries
          .map((entry) => serializeEntryForCacheFn(entry))
          .filter((entry) => !!entry)
      : [];
    const localUnseen = serializeUnseenStateForCacheFn();

    let existing = null;
    for (const storageKey of storageKeys) {
      const value = await getStorageValueFn(storageKey, "session");
      if (value && typeof value === "object") {
        existing = value;
        break;
      }
    }

    // 저장 대상 채널: 실제로 쓰는 키(storageKeys[0])의 채널.
    const targetChannelId =
      channelIdFromCacheStorageKey(storageKeys[0]) ||
      normalizeChannelId(
        channelIdCandidate == null ? state.resolvedChannelId : channelIdCandidate,
      )
        .trim()
        .toLowerCase();

    // 로컬/기존 캐시 양쪽에서 다른 채널 도장이 찍힌 엔트리를 걸러낸다(오염 차단 + 자가 정화).
    const mergedEntries = filterEntriesByTargetChannel(
      mergeCachedEntries(
        filterEntriesByTargetChannel(
          Array.isArray(existing && existing.entries) ? existing.entries : [],
          targetChannelId,
        ),
        filterEntriesByTargetChannel(localEntries, targetChannelId),
      ),
      targetChannelId,
    );
    const mergedUnseen = mergeCachedUnseen(
      existing && existing.unseen,
      localUnseen,
    );

    if (mergedEntries.length === 0) {
      if (typeof deps.removeStorageValue === "function") {
        storageKeys.forEach((storageKey) => {
          deps.removeStorageValue(storageKey, "session");
        });
      }
      return;
    }

    const payload = {
      channelId: normalizeChannelId(
        channelIdCandidate == null ? state.resolvedChannelId : channelIdCandidate,
      ),
      savedAt: Math.max(
        Number((existing && existing.savedAt) || 0) || 0,
        Date.now(),
      ),
      entries: mergedEntries,
      unseen: mergedUnseen,
    };
    if (typeof deps.setStorageValue === "function") {
      storageKeys.forEach((storageKey) => {
        deps.setStorageValue(storageKey, payload, "session");
      });
    }
  }

  function mergeCachedEntries(existingEntries, localEntries) {
    const byKey = new Map();
    const push = (entry) => {
      if (!entry || typeof entry !== "object") return;
      const key = String(entry.dedupeKey || "").trim();
      if (!key) return;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, entry);
        return;
      }
      const prevSeq = Number(prev.sequence || 0) || 0;
      const nextSeq = Number(entry.sequence || 0) || 0;
      const prevTs = Number(prev.timestamp || 0) || 0;
      const nextTs = Number(entry.timestamp || 0) || 0;
      if (nextTs > prevTs || (nextTs === prevTs && nextSeq >= prevSeq)) {
        byKey.set(key, entry);
      }
    };

    if (Array.isArray(existingEntries)) existingEntries.forEach(push);
    if (Array.isArray(localEntries)) localEntries.forEach(push);

    const merged = Array.from(byKey.values()).sort((a, b) => {
      const ta = Number(a.timestamp || 0) || 0;
      const tb = Number(b.timestamp || 0) || 0;
      if (ta !== tb) return ta - tb;
      const sa = Number(a.sequence || 0) || 0;
      const sb = Number(b.sequence || 0) || 0;
      return sa - sb;
    });
    if (merged.length > MAX_KEEP_ENTRIES) {
      merged.splice(0, merged.length - MAX_KEEP_ENTRIES);
    }
    return merged;
  }

  function mergeCachedUnseen(existingUnseen, localUnseen) {
    const localCount = Math.max(
      0,
      Number((localUnseen && localUnseen.count) || 0) || 0,
    );
    const localActorsRaw =
      localUnseen && Array.isArray(localUnseen.actors) ? localUnseen.actors : [];
    if (localCount === 0 && localActorsRaw.length === 0) {
      return { count: 0, actors: [] };
    }

    const byNickname = new Map();
    const push = (rawActor) => {
      if (!rawActor || typeof rawActor !== "object") return;
      const nickname = String(rawActor.nickname || "").trim();
      if (!nickname) return;
      const prev = byNickname.get(nickname);
      if (!prev) {
        byNickname.set(nickname, { ...rawActor, nickname });
        return;
      }
      const prevTs = Number(prev.lastTimestamp || 0) || 0;
      const nextTs = Number(rawActor.lastTimestamp || 0) || 0;
      const prevCount = Math.max(0, Number(prev.count || 0) || 0);
      const nextCount = Math.max(0, Number(rawActor.count || 0) || 0);
      const mergedCount = Math.max(prevCount, nextCount);
      const base = nextTs >= prevTs ? rawActor : prev;
      byNickname.set(nickname, {
        ...base,
        nickname,
        count: mergedCount,
        lastTimestamp: Math.max(prevTs, nextTs),
      });
    };

    const existingActors =
      existingUnseen && Array.isArray(existingUnseen.actors)
        ? existingUnseen.actors
        : [];
    const localActors =
      localUnseen && Array.isArray(localUnseen.actors) ? localUnseen.actors : [];
    existingActors.forEach(push);
    localActors.forEach(push);

    const actors = Array.from(byNickname.values());
    const totalCount = actors.reduce(
      (sum, actor) => sum + (Math.max(0, Number(actor.count || 0) || 0) || 0),
      0,
    );
    const existingCount = Math.max(
      0,
      Number((existingUnseen && existingUnseen.count) || 0) || 0,
    );
    const count = Math.max(totalCount, existingCount, localCount);
    return { count, actors };
  }

  async function restoreChannelCache(state, deps = {}, channelIdCandidate) {
    if (!isSessionCacheEnabled(state)) return;
    const token = (state.cache.restoreToken = state.cache.restoreToken + 1);
    const storageKeys = getChannelCacheStorageKeys(state, channelIdCandidate, deps);

    if (storageKeys.length === 0) {
      if (token !== state.cache.restoreToken) return;
      state.entries = [];
      state.dedupeKeys.clear();
      state.unseenCount = 0;
      state.unseenActors.clear();
      if (typeof deps.applyNicknameFilterStateFromSettings === "function") {
        deps.applyNicknameFilterStateFromSettings();
      }
      state.sequence = 0;
      if (typeof deps.resetPillCycle === "function") {
        deps.resetPillCycle(true);
      }
      if (typeof deps.render === "function") {
        deps.render();
      }
      return;
    }

    const getStorageValueFn =
      typeof deps.getStorageValue === "function"
        ? deps.getStorageValue
        : async () => null;
    let cached = null;
    let matchedStorageKey = "";
    for (const storageKey of storageKeys) {
      const value = await getStorageValueFn(storageKey, "session");
      if (!value || typeof value !== "object") continue;
      cached = value;
      matchedStorageKey = storageKey;
      break;
    }
    if (token !== state.cache.restoreToken) return;

    // 이 캐시가 소속된 채널: 저장키에서 뽑거나, 없으면 캐시에 기록된 channelId.
    const targetChannelId =
      channelIdFromCacheStorageKey(matchedStorageKey) ||
      String((cached && cached.channelId) || "").trim().toLowerCase();

    const normalizeCachedEntryFn =
      typeof deps.normalizeCachedEntry === "function"
        ? deps.normalizeCachedEntry
        : () => null;
    const rawEntries = Array.isArray(cached && cached.entries) ? cached.entries : [];
    const restoredEntries = filterEntriesByTargetChannel(
      rawEntries
        .map((entry, index) => normalizeCachedEntryFn(entry, index))
        .filter((entry) => !!entry),
      targetChannelId,
    ).sort((a, b) => a.timestamp - b.timestamp || a.sequence - b.sequence);

    if (restoredEntries.length > MAX_KEEP_ENTRIES) {
      restoredEntries.splice(0, restoredEntries.length - MAX_KEEP_ENTRIES);
    }

    state.entries = restoredEntries;
    if (typeof deps.syncRoleBadgeCacheFromEntries === "function") {
      deps.syncRoleBadgeCacheFromEntries(state.entries);
    }
    state.dedupeKeys = new Set(state.entries.map((entry) => entry.dedupeKey));
    const normalizeCachedUnseenStateFn =
      typeof deps.normalizeCachedUnseenState === "function"
        ? deps.normalizeCachedUnseenState
        : () => ({ count: 0, actors: new Map() });
    const restoredUnseen = normalizeCachedUnseenStateFn(cached && cached.unseen);
    state.unseenCount = restoredUnseen.count;
    state.unseenActors = restoredUnseen.actors;
    if (typeof deps.applyNicknameFilterStateFromSettings === "function") {
      deps.applyNicknameFilterStateFromSettings();
    }
    if (state.entries.length === 0) {
      state.sequence = 0;
    } else {
      state.sequence =
        state.entries.reduce(
          (max, entry) =>
            Math.max(max, Number.isFinite(entry.sequence) ? entry.sequence : 0),
          0,
        ) + 1;
    }
    if (typeof deps.resetPillCycle === "function") {
      deps.resetPillCycle(true);
    }
    if (typeof deps.render === "function") {
      deps.render();
    }
  }

  function serializeUnseenStateForCache(state, deps = {}) {
    const normalizeBadgeArrayFn =
      typeof deps.normalizeBadgeArray === "function"
        ? deps.normalizeBadgeArray
        : () => [];
    const normalizeBadgeValueFn =
      typeof deps.normalizeBadgeValue === "function"
        ? deps.normalizeBadgeValue
        : () => null;
    const actors =
      state.unseenActors instanceof Map
        ? Array.from(state.unseenActors.values())
            .map((actor) => {
              if (!actor || typeof actor !== "object") return null;
              const nickname = String(actor.nickname || "").trim();
              if (!nickname) return null;
              return {
                nickname,
                count: Math.max(0, Number(actor.count || 0) || 0),
                lastTimestamp: Number(actor.lastTimestamp || 0) || Date.now(),
                badgeType: String(actor.badgeType || ""),
                pillBadges: normalizeBadgeArrayFn(actor.pillBadges),
                partnerMark: normalizeBadgeValueFn(actor.partnerMark),
                titleColor: String(actor.titleColor || "").trim(),
                typeLabel: String(actor.typeLabel || "").trim(),
                typeTone:
                  String(actor.typeTone || "neutral").trim() || "neutral",
              };
            })
            .filter((actor) => !!actor)
        : [];

    const seenCount = Math.max(0, Number(state.unseenCount || 0) || 0);
    const actorCountTotal = actors.reduce(
      (sum, actor) => sum + (Number(actor && actor.count ? actor.count : 0) || 0),
      0,
    );

    return {
      count: Math.max(seenCount, actorCountTotal),
      actors,
    };
  }

  function normalizeCachedUnseenState(rawUnseen, deps = {}) {
    const empty = { count: 0, actors: new Map() };
    if (!rawUnseen || typeof rawUnseen !== "object") return empty;

    const normalizeBadgeArrayFn =
      typeof deps.normalizeBadgeArray === "function"
        ? deps.normalizeBadgeArray
        : () => [];
    const normalizeBadgeValueFn =
      typeof deps.normalizeBadgeValue === "function"
        ? deps.normalizeBadgeValue
        : () => null;

    const actors = new Map();
    const rawActors = Array.isArray(rawUnseen.actors) ? rawUnseen.actors : [];
    let actorCountTotal = 0;

    rawActors.forEach((rawActor) => {
      if (!rawActor || typeof rawActor !== "object") return;
      const nickname = String(rawActor.nickname || "").trim();
      if (!nickname) return;
      const count = Math.max(0, Number(rawActor.count || 0) || 0);
      actorCountTotal += count;
      actors.set(nickname, {
        nickname,
        count,
        lastTimestamp: Number(rawActor.lastTimestamp || 0) || Date.now(),
        badgeType: String(rawActor.badgeType || "").trim(),
        pillBadges: normalizeBadgeArrayFn(rawActor.pillBadges),
        partnerMark: normalizeBadgeValueFn(rawActor.partnerMark),
        titleColor: String(rawActor.titleColor || "").trim(),
        typeLabel: String(rawActor.typeLabel || "").trim(),
        typeTone: String(rawActor.typeTone || "neutral").trim() || "neutral",
      });
    });

    const rawCount = Math.max(0, Number(rawUnseen.count || 0) || 0);
    const count = Math.max(rawCount, actorCountTotal);
    if (count <= 0 || actors.size <= 0) return empty;

    return { count, actors };
  }

  function serializeEntryForCache(entry, deps = {}) {
    if (!entry || typeof entry !== "object") return null;
    const normalizeEmojiMapFn =
      typeof deps.normalizeEmojiMap === "function"
        ? deps.normalizeEmojiMap
        : (value) => value || {};
    const normalizeBadgeArrayFn =
      typeof deps.normalizeBadgeArray === "function"
        ? deps.normalizeBadgeArray
        : () => [];
    const normalizeBadgeValueFn =
      typeof deps.normalizeBadgeValue === "function"
        ? deps.normalizeBadgeValue
        : () => null;
    const normalizeTagArrayFn =
      typeof deps.normalizeTagArray === "function"
        ? deps.normalizeTagArray
        : () => [];

    const serialized = {
      dedupeKey: String(entry.dedupeKey || ""),
      timestamp: Number(entry.timestamp || 0) || Date.now(),
      nickname: String(entry.nickname || "알 수 없음"),
      message: String(entry.message || ""),
      emojis: normalizeEmojiMapFn(entry.emojis),
      titleColor: String(entry.titleColor || ""),
      badgeType: String(entry.badgeType || ""),
      pillBadges: normalizeBadgeArrayFn(entry.pillBadges),
      popupBadges: normalizeBadgeArrayFn(entry.popupBadges),
      partnerMark: normalizeBadgeValueFn(entry.partnerMark),
      achievementMark: normalizeBadgeValueFn(entry.achievementMark),
      tags: normalizeTagArrayFn(entry.tags),
      typeLabel: String(entry.typeLabel || ""),
      typeTone: String(entry.typeTone || "neutral"),
      sequence: Number(entry.sequence || 0) || 0,
    };

    // 세션 캐시에는 프로필 카드 조회용 userIdHash만 (유효한 32자 hex일 때) 포함
    const authorUserIdHash = String(entry.authorUserIdHash || "").trim();
    if (authorUserIdHash && /^[a-f0-9]{32}$/i.test(authorUserIdHash)) {
      serialized.authorUserIdHash = authorUserIdHash.toLowerCase();
    }
    // 엔트리 소속 채널 도장(유효한 32자 hex일 때만) — 복원/저장 시 채널 검증에 쓴다.
    const entryChannelId = String(entry.channelId || "").trim();
    if (entryChannelId && /^[a-f0-9]{32}$/i.test(entryChannelId)) {
      serialized.channelId = entryChannelId.toLowerCase();
    }
    return serialized;
  }

  function normalizeCachedEntry(rawEntry, index, deps = {}) {
    if (!rawEntry || typeof rawEntry !== "object") return null;
    const nickname = String(rawEntry.nickname || "").trim();
    if (!nickname) return null;

    const normalizeEmojiMapFn =
      typeof deps.normalizeEmojiMap === "function"
        ? deps.normalizeEmojiMap
        : (value) => value || {};
    const normalizeCachedBadgeTypeFn =
      typeof deps.normalizeCachedBadgeType === "function"
        ? deps.normalizeCachedBadgeType
        : normalizeCachedBadgeType;
    const normalizeBadgeArrayFn =
      typeof deps.normalizeBadgeArray === "function"
        ? deps.normalizeBadgeArray
        : normalizeBadgeArray;
    const normalizeBadgeValueFn =
      typeof deps.normalizeBadgeValue === "function"
        ? deps.normalizeBadgeValue
        : normalizeBadgeValue;
    const normalizeTagArrayFn =
      typeof deps.normalizeTagArray === "function"
        ? deps.normalizeTagArray
        : normalizeTagArray;

    const timestamp = Number(rawEntry.timestamp || 0) || Date.now();
    const badgeType = normalizeCachedBadgeTypeFn(rawEntry);
    const rawDedupeKey = String(rawEntry.dedupeKey || "").trim();
    const dedupeKey =
      rawDedupeKey ||
      `${nickname}_${timestamp}_${String(rawEntry.message || "").slice(0, 16)}:${badgeType || "partner"}`;

    const restored = {
      dedupeKey,
      timestamp,
      nickname,
      message: String(rawEntry.message || ""),
      emojis: normalizeEmojiMapFn(rawEntry.emojis),
      titleColor: String(rawEntry.titleColor || "").trim(),
      badgeType: badgeType || "partner",
      pillBadges: normalizeBadgeArrayFn(rawEntry.pillBadges),
      popupBadges: normalizeBadgeArrayFn(rawEntry.popupBadges),
      partnerMark: normalizeBadgeValueFn(rawEntry.partnerMark),
      achievementMark: normalizeBadgeValueFn(rawEntry.achievementMark),
      tags: normalizeTagArrayFn(rawEntry.tags),
      typeLabel: String(rawEntry.typeLabel || "").trim(),
      typeTone: String(rawEntry.typeTone || "neutral").trim() || "neutral",
      sequence: Number(rawEntry.sequence || 0) || index,
    };

    const rawHash = String(rawEntry.authorUserIdHash || "").trim();
    if (rawHash && /^[a-f0-9]{32}$/i.test(rawHash)) {
      restored.authorUserIdHash = rawHash.toLowerCase();
    } else {
      restored.authorUserIdHash = "";
    }
    const rawChannelId = String(rawEntry.channelId || "").trim();
    restored.channelId =
      rawChannelId && /^[a-f0-9]{32}$/i.test(rawChannelId)
        ? rawChannelId.toLowerCase()
        : "";
    return restored;
  }

  function normalizeCachedBadgeType(rawEntry) {
    const rawType = String(rawEntry && rawEntry.badgeType ? rawEntry.badgeType : "").trim();
    if (rawType === "owner") {
      const badges = [
        ...(Array.isArray(rawEntry && rawEntry.pillBadges) ? rawEntry.pillBadges : []),
        ...(Array.isArray(rawEntry && rawEntry.popupBadges) ? rawEntry.popupBadges : []),
      ];
      const hasOperatorBadge = badges.some((badge) =>
        String(badge && badge.iconUrl ? badge.iconUrl : "").includes("/icon/owner.png"),
      );
      return hasOperatorBadge ? "operator" : "channel_owner";
    }
    return rawType;
  }

  function normalizeBadgeArray(badges) {
    if (!Array.isArray(badges)) return [];
    const result = [];
    badges.forEach((badge) => {
      const normalized = normalizeBadgeValue(badge);
      if (normalized) result.push(normalized);
    });
    return result;
  }

  function normalizeBadgeValue(badge) {
    if (!badge || typeof badge !== "object") return null;
    const type = String(badge.type || "unknown").trim() || "unknown";
    const label = String(badge.label || "배지").trim() || "배지";
    const iconUrl = String(badge.iconUrl || "").trim();
    return { type, label, iconUrl };
  }

  function normalizeTagArray(tags) {
    if (!Array.isArray(tags)) return [];
    const result = [];
    tags.forEach((tag) => {
      if (!tag || typeof tag !== "object") return;
      const label = String(tag.label || "").trim();
      if (!label) return;
      result.push({
        label,
        tone: String(tag.tone || "neutral").trim() || "neutral",
      });
    });
    return result;
  }

  ns.cache = {
    isSessionCacheEnabled,
    getChannelCacheStorageKeys,
    getChannelCacheStorageKey,
    clearPersistChannelCacheTimer,
    schedulePersistChannelCache,
    persistChannelCacheNow,
    restoreChannelCache,
    serializeUnseenStateForCache,
    normalizeCachedUnseenState,
    serializeEntryForCache,
    normalizeCachedEntry,
    normalizeCachedBadgeType,
    normalizeBadgeArray,
    normalizeBadgeValue,
    normalizeTagArray,
  };
})();
