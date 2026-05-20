(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.filterApi && typeof ns.filterApi === "object") return;

  function normalizeNickname(value) {
    return String(value || "").trim();
  }

  function normalizeTrackedNickname(value, deps = {}) {
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : normalizeNickname;
    return normalizeNicknameFn(value);
  }

  function isTrackedTarget(state, profile, payload, deps = {}) {
    const normalizeTrackedNicknameFn =
      typeof deps.normalizeTrackedNickname === "function"
        ? deps.normalizeTrackedNickname
        : (value) => normalizeTrackedNickname(value, deps);

    const trackedNicknames = state?.settings?.trackedNicknames;
    if (!(trackedNicknames instanceof Set) || trackedNicknames.size === 0) {
      return false;
    }

    const nicknameCandidates = [payload?.nickname, profile?.nickname];
    for (const candidate of nicknameCandidates) {
      const nickname = normalizeTrackedNicknameFn(candidate || "");
      if (nickname && trackedNicknames.has(nickname)) return true;
    }

    return false;
  }

  function isPillNicknameHidden(state, nickname, deps = {}) {
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : normalizeNickname;
    const normalized = normalizeNicknameFn(nickname);
    if (!normalized) return false;
    return !!(
      state &&
      state.settings &&
      state.settings.hiddenPillNicknames instanceof Set &&
      state.settings.hiddenPillNicknames.has(normalized)
    );
  }

  async function deleteEntriesByNickname(state, nickname, deps = {}) {
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : normalizeNickname;
    const requestDeleteConfirmFn =
      typeof deps.requestDeleteConfirm === "function"
        ? deps.requestDeleteConfirm
        : async () => true;
    const resetPillCycleFn =
      typeof deps.resetPillCycle === "function" ? deps.resetPillCycle : () => {};
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const schedulePersistChannelCacheFn =
      typeof deps.schedulePersistChannelCache === "function"
        ? deps.schedulePersistChannelCache
        : () => {};
    const renderFn = typeof deps.render === "function" ? deps.render : () => {};

    const normalizedNickname = normalizeNicknameFn(nickname);
    if (!normalizedNickname || !state) return;

    const deleteCount = (state.entries || []).reduce((count, entry) => {
      return count + (normalizeNicknameFn(entry?.nickname) === normalizedNickname ? 1 : 0);
    }, 0);
    if (deleteCount <= 0) return;

    const confirmMessage = `'${normalizedNickname}' 닉네임의 배지 채팅 ${deleteCount}개를 삭제할까요?`;
    if (!(await requestDeleteConfirmFn(confirmMessage))) {
      return;
    }

    state.entries = (state.entries || []).filter(
      (entry) => normalizeNicknameFn(entry?.nickname) !== normalizedNickname,
    );
    state.dedupeKeys = new Set(state.entries.map((entry) => entry.dedupeKey));
    state.unseenCount = 0;
    state.unseenActors.clear();
    resetPillCycleFn(true);

    state.nicknameFilter.selected.delete(normalizedNickname);
    if (state.entries.length <= 0) {
      state.nicknameFilter.selected.clear();
      state.nicknameFilter.autoSelectNew = true;
      state.nicknameFilter.pendingTrackedNicknames.clear();
    }
    saveSettingsFn();

    schedulePersistChannelCacheFn();
    renderFn();
  }

  function selectAllNicknameFilters(state, stats, deps = {}) {
    if (!state || !Array.isArray(stats) || stats.length === 0) return;
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : normalizeNickname;
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const renderListFn =
      typeof deps.renderList === "function" ? deps.renderList : () => {};

    state.nicknameFilter.autoSelectNew = true;
    stats.forEach((item) => {
      const nickname = normalizeNicknameFn(item?.nickname);
      if (!nickname) return;
      state.nicknameFilter.selected.add(nickname);
    });
    saveSettingsFn();
    renderListFn(false);
  }

  function clearAllNicknameFilters(state, deps = {}) {
    if (!state) return;
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const renderListFn =
      typeof deps.renderList === "function" ? deps.renderList : () => {};

    state.nicknameFilter.autoSelectNew = false;
    state.nicknameFilter.selected.clear();
    saveSettingsFn();
    renderListFn(false);
  }

  async function deleteAllEntriesFromFilters(state, deps = {}) {
    if (!state) return;
    const requestDeleteConfirmFn =
      typeof deps.requestDeleteConfirm === "function"
        ? deps.requestDeleteConfirm
        : async () => true;
    const resetPillCycleFn =
      typeof deps.resetPillCycle === "function" ? deps.resetPillCycle : () => {};
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const schedulePersistChannelCacheFn =
      typeof deps.schedulePersistChannelCache === "function"
        ? deps.schedulePersistChannelCache
        : () => {};
    const renderFn = typeof deps.render === "function" ? deps.render : () => {};

    const deleteCount = Array.isArray(state.entries) ? state.entries.length : 0;
    if (deleteCount <= 0) return;

    const confirmMessage = `배지 채팅 ${deleteCount}개를 모두 삭제할까요?`;
    if (!(await requestDeleteConfirmFn(confirmMessage))) {
      return;
    }

    state.entries = [];
    state.dedupeKeys.clear();
    state.unseenCount = 0;
    state.unseenActors.clear();
    state.nicknameFilter.selected.clear();
    state.nicknameFilter.autoSelectNew = true;
    state.nicknameFilter.pendingTrackedNicknames.clear();
    resetPillCycleFn(true);
    saveSettingsFn();
    schedulePersistChannelCacheFn();
    renderFn();
  }

  function getNicknameStats(entries) {
    const statsMap = new Map();
    for (const entry of entries || []) {
      const nickname = String(entry?.nickname || "").trim();
      if (!nickname) continue;

      const prev = statsMap.get(nickname);
      if (prev) {
        prev.count += 1;
        prev.lastTimestamp = Math.max(prev.lastTimestamp, entry.timestamp || 0);
        if (!prev.titleColor && entry.titleColor) {
          prev.titleColor = entry.titleColor;
        }
        continue;
      }

      statsMap.set(nickname, {
        nickname,
        count: 1,
        lastTimestamp: entry.timestamp || 0,
        titleColor: entry.titleColor || "",
      });
    }

    return Array.from(statsMap.values()).sort(
      (a, b) => b.lastTimestamp - a.lastTimestamp || b.count - a.count,
    );
  }

  function syncNicknameFilterSelection(state, stats, deps = {}) {
    if (!state || !Array.isArray(stats)) return;

    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const applyPendingTrackedFilterSelectionFn =
      typeof deps.applyPendingTrackedFilterSelection === "function"
        ? deps.applyPendingTrackedFilterSelection
        : (available, selected) =>
            applyPendingTrackedFilterSelection(state, available, selected, deps);

    const available = new Set(stats.map((item) => item.nickname));
    const selected = state.nicknameFilter.selected;
    const known =
      state.nicknameFilter.knownNicknames instanceof Set
        ? state.nicknameFilter.knownNicknames
        : (state.nicknameFilter.knownNicknames = new Set());
    let changed = false;
    let knownChanged = false;

    available.forEach((nickname) => {
      if (known.has(nickname)) return;
      known.add(nickname);
      knownChanged = true;
      if (!selected.has(nickname)) {
        selected.add(nickname);
        changed = true;
      }
    });

    if (state.nicknameFilter.autoSelectNew) {
      available.forEach((nickname) => {
        if (selected.has(nickname)) return;
        selected.add(nickname);
        changed = true;
      });
      if (changed || knownChanged) {
        saveSettingsFn();
      }
      return;
    }

    changed = applyPendingTrackedFilterSelectionFn(available, selected) || changed;
    if (
      selected.size === 0 &&
      available.size === 1 &&
      Array.isArray(state.entries) &&
      state.entries.length === 1
    ) {
      const firstNickname = available.values().next().value;
      if (firstNickname) {
        selected.add(firstNickname);
        changed = true;
      }
    }
    if (changed || knownChanged) {
      saveSettingsFn();
    }
  }

  function applyPendingTrackedFilterSelection(state, available, selected, deps = {}) {
    let changed = false;

    if (!(available instanceof Set) || !(selected instanceof Set) || !state) {
      return false;
    }

    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : normalizeNickname;

    const pendingNicknames = state.nicknameFilter.pendingTrackedNicknames;
    if (pendingNicknames instanceof Set && pendingNicknames.size > 0) {
      Array.from(pendingNicknames).forEach((nickname) => {
        const normalized = normalizeNicknameFn(nickname);
        if (!normalized || !available.has(normalized)) return;
        if (!selected.has(normalized)) {
          selected.add(normalized);
          changed = true;
        }
        pendingNicknames.delete(normalized);
      });
    }

    return changed;
  }

  function getVisibleEntriesByNickname(state) {
    const selected = state?.nicknameFilter?.selected;
    if (!(selected instanceof Set) || selected.size === 0) return [];
    return (state.entries || []).filter((entry) => selected.has(entry.nickname));
  }

  function applyNicknameFilterStateFromSettings(state) {
    if (!state) return;
    const selectedFromSettings =
      state.settings && state.settings.nicknameFilterSelected instanceof Set
        ? state.settings.nicknameFilterSelected
        : new Set();
    const knownFromSettings =
      state.settings && state.settings.nicknameFilterKnownNicknames instanceof Set
        ? state.settings.nicknameFilterKnownNicknames
        : new Set();
    state.nicknameFilter.selected = new Set(selectedFromSettings);
    state.nicknameFilter.autoSelectNew =
      state.settings && state.settings.nicknameFilterAutoSelectNew === false
        ? false
        : true;
    state.nicknameFilter.knownNicknames = new Set(knownFromSettings);
    state.nicknameFilter.selected.forEach((nickname) => {
      state.nicknameFilter.knownNicknames.add(nickname);
    });
    state.nicknameFilter.pendingTrackedNicknames = new Set();
  }

  ns.filterApi = {
    deleteEntriesByNickname,
    deleteAllEntriesFromFilters,
    selectAllNicknameFilters,
    clearAllNicknameFilters,
    getNicknameStats,
    syncNicknameFilterSelection,
    applyPendingTrackedFilterSelection,
    getVisibleEntriesByNickname,
    applyNicknameFilterStateFromSettings,
    normalizeNickname,
    normalizeTrackedNickname,
    isTrackedTarget,
    isPillNicknameHidden,
  };
})();
