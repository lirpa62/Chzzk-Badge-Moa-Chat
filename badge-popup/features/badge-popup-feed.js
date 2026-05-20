(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.feedApi && typeof ns.feedApi === "object") return;

  function pruneExcludedEntriesFromState(state, deps = {}) {
    const excludedSet = state?.settings?.excludedCollectNicknames;
    if (!(excludedSet instanceof Set) || excludedSet.size === 0) return false;

    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const resetPillCycleFn =
      typeof deps.resetPillCycle === "function" ? deps.resetPillCycle : () => {};
    const syncNicknameFilterSelectionFn =
      typeof deps.syncNicknameFilterSelection === "function"
        ? deps.syncNicknameFilterSelection
        : () => {};
    const getNicknameStatsFn =
      typeof deps.getNicknameStats === "function" ? deps.getNicknameStats : () => [];

    const nextEntries = (state.entries || []).filter((entry) => {
      const nickname = normalizeNicknameFn(entry?.nickname);
      if (!nickname) return true;
      return !excludedSet.has(nickname);
    });
    if (nextEntries.length === (state.entries || []).length) return false;

    state.entries = nextEntries;
    state.dedupeKeys = new Set(state.entries.map((entry) => entry.dedupeKey));

    // 제외된 닉네임의 unseen 항목만 정리 — 나머지 닉의 unseen은 유지
    if (state.unseenActors instanceof Map && state.unseenActors.size > 0) {
      let removedCount = 0;
      for (const [actorNickname, actor] of state.unseenActors) {
        const normalized = normalizeNicknameFn(actorNickname);
        if (!normalized) continue;
        if (excludedSet.has(normalized)) {
          removedCount += Math.max(0, Number(actor?.count || 0) || 0);
          state.unseenActors.delete(actorNickname);
        }
      }
      if (removedCount > 0) {
        state.unseenCount = Math.max(
          0,
          (Number(state.unseenCount || 0) || 0) - removedCount,
        );
      }
      // 안전망: actors가 모두 비었다면 카운트도 0으로
      if (state.unseenActors.size === 0) {
        state.unseenCount = 0;
      }
    }

    resetPillCycleFn(true);
    syncNicknameFilterSelectionFn(getNicknameStatsFn(state.entries));
    return true;
  }

  function getLatestVisiblePillEntry(state, deps = {}) {
    const isPillNicknameHiddenFn =
      typeof deps.isPillNicknameHidden === "function"
        ? deps.isPillNicknameHidden
        : () => false;

    const entries = Array.isArray(state?.entries) ? state.entries : [];
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (!entry) continue;
      if (isPillNicknameHiddenFn(entry.nickname)) continue;
      return entry;
    }
    return null;
  }

  function updateUnseenActor(state, entry) {
    if (!entry || !entry.nickname) return;
    const key = entry.nickname;
    const prev = state.unseenActors.get(key);

    if (prev) {
      state.unseenActors.set(key, {
        ...prev,
        count: prev.count + 1,
        lastTimestamp: Math.max(prev.lastTimestamp || 0, entry.timestamp || 0),
        badgeType: entry.badgeType || prev.badgeType || "",
        pillBadges: Array.isArray(entry.pillBadges)
          ? entry.pillBadges
          : prev.pillBadges,
        partnerMark: entry.partnerMark || prev.partnerMark || null,
        titleColor: entry.titleColor || prev.titleColor || "",
        typeLabel: entry.typeLabel || prev.typeLabel || "",
        typeTone: entry.typeTone || prev.typeTone || "neutral",
      });
      return;
    }

    state.unseenActors.set(key, {
      nickname: entry.nickname,
      count: 1,
      lastTimestamp: entry.timestamp || Date.now(),
      badgeType: entry.badgeType || "",
      pillBadges: Array.isArray(entry.pillBadges) ? entry.pillBadges : [],
      partnerMark: entry.partnerMark || null,
      titleColor: entry.titleColor || "",
      typeLabel: entry.typeLabel || "",
      typeTone: entry.typeTone || "neutral",
    });
  }

  function getUnseenActorsForPill(state, deps = {}) {
    const isPillNicknameHiddenFn =
      typeof deps.isPillNicknameHidden === "function"
        ? deps.isPillNicknameHidden
        : () => false;

    return Array.from(state?.unseenActors?.values?.() || [])
      .filter((actor) => !isPillNicknameHiddenFn(actor?.nickname))
      .sort((a, b) => {
        const tsDiff = (b.lastTimestamp || 0) - (a.lastTimestamp || 0);
        if (tsDiff !== 0) return tsDiff;
        return (b.count || 0) - (a.count || 0);
      });
  }

  ns.feedApi = {
    pruneExcludedEntriesFromState,
    getLatestVisiblePillEntry,
    updateUnseenActor,
    getUnseenActorsForPill,
  };
})();
