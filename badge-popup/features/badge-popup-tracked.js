(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.trackedApi && typeof ns.trackedApi === "object") return;

  function getPillNicknameSettingItems(state, deps = {}) {
    const getNicknameStatsFn =
      typeof deps.getNicknameStats === "function" ? deps.getNicknameStats : () => [];
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const extractSettingsRoleBadgesFn =
      typeof deps.extractSettingsRoleBadges === "function"
        ? deps.extractSettingsRoleBadges
        : (entry) => extractSettingsRoleBadges(entry, deps);

    const stats = getNicknameStatsFn(state?.entries || []);
    const map = new Map();
    const roleBadgeMap = new Map(state?.nicknameRoleBadgesByNickname || []);

    for (let i = (state?.entries || []).length - 1; i >= 0; i -= 1) {
      const entry = state.entries[i];
      const nickname = normalizeNicknameFn(entry && entry.nickname);
      if (!nickname || roleBadgeMap.has(nickname)) continue;
      const badges = extractSettingsRoleBadgesFn(entry);
      roleBadgeMap.set(nickname, badges);
      if (badges.length > 0 && state?.nicknameRoleBadgesByNickname instanceof Map) {
        state.nicknameRoleBadgesByNickname.set(nickname, badges);
      }
    }

    stats.forEach((item) => {
      const nickname = normalizeNicknameFn(item.nickname);
      if (!nickname) return;
      map.set(nickname, {
        nickname,
        count: item.count || 0,
        lastTimestamp: item.lastTimestamp || 0,
        roleBadges: roleBadgeMap.get(nickname) || [],
      });
    });

    const hiddenSet = state?.settings?.hiddenPillNicknames;
    if (hiddenSet instanceof Set) {
      hiddenSet.forEach((nickname) => {
        const normalized = normalizeNicknameFn(nickname);
        if (!normalized || map.has(normalized)) return;
        map.set(normalized, {
          nickname: normalized,
          count: 0,
          lastTimestamp: 0,
          roleBadges: roleBadgeMap.get(normalized) || [],
        });
      });
    }

    const trackedSet = state?.settings?.trackedNicknames;
    if (trackedSet instanceof Set) {
      trackedSet.forEach((nickname) => {
        const normalized = normalizeNicknameFn(nickname);
        if (!normalized || map.has(normalized)) return;
        map.set(normalized, {
          nickname: normalized,
          count: 0,
          lastTimestamp: 0,
          roleBadges: roleBadgeMap.get(normalized) || [],
        });
      });
    }

    const excludedSet = state?.settings?.excludedCollectNicknames;
    if (excludedSet instanceof Set) {
      excludedSet.forEach((nickname) => {
        const normalized = normalizeNicknameFn(nickname);
        if (!normalized || map.has(normalized)) return;
        map.set(normalized, {
          nickname: normalized,
          count: 0,
          lastTimestamp: 0,
          roleBadges: roleBadgeMap.get(normalized) || [],
        });
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      const tsDiff = (b.lastTimestamp || 0) - (a.lastTimestamp || 0);
      if (tsDiff !== 0) return tsDiff;
      return a.nickname.localeCompare(b.nickname, "ko");
    });
  }

  function extractSettingsRoleBadges(entry, deps = {}) {
    if (!entry || typeof entry !== "object") return [];

    const roleTypes = deps.SETTINGS_ROLE_BADGE_TYPES;
    if (!(roleTypes instanceof Set) || roleTypes.size === 0) return [];

    const list = [];
    const seen = new Set();
    const sourceBadges = Array.isArray(entry.pillBadges) ? entry.pillBadges : [];
    sourceBadges.forEach((badge) => {
      if (!badge || typeof badge !== "object") return;
      const type = String(badge.type || "")
        .trim()
        .toLowerCase();
      if (!roleTypes.has(type)) return;
      const iconUrl = String(badge.iconUrl || "").trim();
      if (!iconUrl) return;
      const key = `${type}|${iconUrl}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        type,
        label: String(badge.label || "배지"),
        iconUrl,
      });
    });

    const priority = {
      channel_owner: 0,
      manager: 1,
      operator: 2,
      partner: 3,
    };
    list.sort((a, b) => {
      const pa = Number.isFinite(priority[a.type]) ? priority[a.type] : 99;
      const pb = Number.isFinite(priority[b.type]) ? priority[b.type] : 99;
      return pa - pb;
    });

    return list;
  }

  function rememberNicknameRoleBadgesFromEntry(state, entry, deps = {}) {
    if (!entry || typeof entry !== "object" || !state) return;
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const extractSettingsRoleBadgesFn =
      typeof deps.extractSettingsRoleBadges === "function"
        ? deps.extractSettingsRoleBadges
        : (nextEntry) => extractSettingsRoleBadges(nextEntry, deps);

    const nickname = normalizeNicknameFn(entry.nickname);
    if (!nickname) return;
    const nextBadges = extractSettingsRoleBadgesFn(entry);
    if (!Array.isArray(nextBadges) || nextBadges.length === 0) return;
    if (!(state.nicknameRoleBadgesByNickname instanceof Map)) {
      state.nicknameRoleBadgesByNickname = new Map();
    }
    state.nicknameRoleBadgesByNickname.set(nickname, nextBadges);
  }

  function syncRoleBadgeCacheFromEntries(state, entries, deps = {}) {
    if (!state) return;
    if (!(state.nicknameRoleBadgesByNickname instanceof Map)) {
      state.nicknameRoleBadgesByNickname = new Map();
    }
    if (!Array.isArray(entries) || entries.length === 0) return;
    const rememberFn =
      typeof deps.rememberNicknameRoleBadgesFromEntry === "function"
        ? deps.rememberNicknameRoleBadgesFromEntry
        : (entry) => rememberNicknameRoleBadgesFromEntry(state, entry, deps);
    entries.forEach((entry) => {
      rememberFn(entry);
    });
  }

  function addTrackedTarget(state, rawValue, deps = {}) {
    if (!state || !state.settings) return false;

    const normalizeTrackedNicknameFn =
      typeof deps.normalizeTrackedNickname === "function"
        ? deps.normalizeTrackedNickname
        : (value) => String(value || "").trim();
    const rebuildEffectiveTrackedNicknamesFn =
      typeof deps.rebuildEffectiveTrackedNicknames === "function"
        ? deps.rebuildEffectiveTrackedNicknames
        : () => {};
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const renderListFn =
      typeof deps.renderList === "function" ? deps.renderList : () => {};
    const scope = deps.scope === "global" ? "global" : "channel";
    const targetSet =
      scope === "global"
        ? state.settings.trackedGlobalNicknames
        : state.settings.trackedScopedNicknames;
    const maxTrackedNicknames =
      scope === "global"
        ? Number(deps.MAX_TRACKED_GLOBAL_NICKNAMES) || 0
        : Number(deps.MAX_TRACKED_NICKNAMES_PER_SCOPE) || 0;

    const nickname = normalizeTrackedNicknameFn(rawValue);
    if (!nickname) return false;
    if (!(targetSet instanceof Set)) return false;
    if (targetSet.has(nickname)) return false;
    if (maxTrackedNicknames > 0 && targetSet.size >= maxTrackedNicknames) {
      return false;
    }

    targetSet.add(nickname);
    rebuildEffectiveTrackedNicknamesFn();
    state.nicknameFilter.selected.add(nickname);
    state.nicknameFilter.pendingTrackedNicknames.add(nickname);
    saveSettingsFn();
    renderListFn(false);
    return true;
  }

  function removeTrackedTarget(state, item, deps = {}) {
    if (!state || !item || typeof item !== "object") return;
    const normalizeTrackedNicknameFn =
      typeof deps.normalizeTrackedNickname === "function"
        ? deps.normalizeTrackedNickname
        : (value) => String(value || "").trim();
    const rebuildEffectiveTrackedNicknamesFn =
      typeof deps.rebuildEffectiveTrackedNicknames === "function"
        ? deps.rebuildEffectiveTrackedNicknames
        : () => {};
    const pruneHiddenNicknameIfOrphanedInPopupFn =
      typeof deps.pruneHiddenNicknameIfOrphanedInPopup === "function"
        ? deps.pruneHiddenNicknameIfOrphanedInPopup
        : () => {};
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};

    const nickname = normalizeTrackedNicknameFn(item.value);
    const targetSet =
      item.scope === "global"
        ? state.settings.trackedGlobalNicknames
        : state.settings.trackedScopedNicknames;
    if (targetSet instanceof Set) {
      targetSet.delete(nickname);
    }
    rebuildEffectiveTrackedNicknamesFn();
    pruneHiddenNicknameIfOrphanedInPopupFn(nickname);
    saveSettingsFn();
  }

  function shouldKeepHiddenNickname(state, nickname, options = {}, deps = {}) {
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const normalized = normalizeNicknameFn(nickname);
    if (!normalized) return false;

    const trackedNicknames =
      options && options.trackedNicknames instanceof Set
        ? options.trackedNicknames
        : state?.settings?.trackedNicknames;
    if (trackedNicknames instanceof Set && trackedNicknames.has(normalized)) {
      return true;
    }

    return false;
  }

  function pruneHiddenNicknameIfOrphanedInPopup(
    state,
    nickname,
    options = {},
    deps = {},
  ) {
    if (!state || !state.settings) return;
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const shouldKeepHiddenNicknameFn =
      typeof deps.shouldKeepHiddenNickname === "function"
        ? deps.shouldKeepHiddenNickname
        : (value, nextOptions) =>
            shouldKeepHiddenNickname(state, value, nextOptions, deps);

    const normalized = normalizeNicknameFn(nickname);
    if (!normalized) return;
    if (shouldKeepHiddenNicknameFn(normalized, options)) return;
    const existsInEntries = (state.entries || []).some((entry) => {
      return normalizeNicknameFn(entry?.nickname) === normalized;
    });
    if (existsInEntries) return;
    state.settings.hiddenPillNicknames.delete(normalized);
  }

  function getTrackedTargetSettingItems(state, deps = {}) {
    const normalizeTrackedNicknameFn =
      typeof deps.normalizeTrackedNickname === "function"
        ? deps.normalizeTrackedNickname
        : (value) => String(value || "").trim();
    const map = new Map();
    const scope = deps.scope === "global" ? "global" : "channel";
    const source =
      scope === "global"
        ? state?.settings?.trackedGlobalNicknames
        : state?.settings?.trackedScopedNicknames;
    Array.from(source || []).forEach((nickname) => {
      const key = normalizeTrackedNicknameFn(nickname);
      if (!key) return;
      map.set(key, { type: "nickname", value: key, scope });
    });
    return Array.from(map.values());
  }

  function createTrackedTargetChip(item, deps = {}) {
    const doc = deps.document || document;
    const removeTrackedTargetFn =
      typeof deps.removeTrackedTarget === "function"
        ? deps.removeTrackedTarget
        : () => {};
    const renderSettingsPanelFn =
      typeof deps.renderSettingsPanel === "function"
        ? deps.renderSettingsPanel
        : () => {};

    const row = doc.createElement("div");
    row.className = "chzzk-badge-moa-tracked-chip";

    const text = doc.createElement("span");
    text.className = "chzzk-badge-moa-tracked-chip-text";
    text.textContent = `${item.scope === "global" ? "[모든 채널]" : "[현재 채널]"} ${item.value}`;

    const removeButton = doc.createElement("button");
    removeButton.type = "button";
    removeButton.className = "chzzk-badge-moa-tracked-chip-remove";
    removeButton.setAttribute("aria-label", "추적 대상 제거");
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      removeTrackedTargetFn(item);
      renderSettingsPanelFn();
    });

    row.append(text, removeButton);
    return row;
  }

  function createSettingToggleRow(
    labelText,
    checked,
    onChange,
    options = {},
    deps = {},
  ) {
    const doc = deps.document || document;
    const isChip = options && options.chip === true;
    const row = doc.createElement("label");
    row.className = "chzzk-badge-moa-setting-row";
    if (isChip) {
      row.classList.add("is-chip");
    }

    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "chzzk-badge-moa-setting-checkbox";
    checkbox.checked = checked === true;
    row.classList.toggle("is-checked", checkbox.checked);
    checkbox.addEventListener("change", () => {
      row.classList.toggle("is-checked", checkbox.checked);
      onChange(checkbox.checked === true);
    });

    const text = doc.createElement("span");
    text.className = "chzzk-badge-moa-setting-text";
    text.textContent = labelText;

    row.append(checkbox, text);
    return row;
  }

  function isExcludedCollectNickname(state, nickname, deps = {}) {
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const normalized = normalizeNicknameFn(nickname);
    if (!normalized) return false;
    return !!(
      state &&
      state.settings &&
      state.settings.excludedCollectNicknames instanceof Set &&
      state.settings.excludedCollectNicknames.has(normalized)
    );
  }

  // 특정 스코프(channel/global)의 모아보기 제외 목록에서 이 닉네임이 제외되어
  // 있는지.
  function isExcludedCollectNicknameInScope(state, nickname, scope, deps = {}) {
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const normalized = normalizeNicknameFn(nickname);
    if (!normalized) return false;
    const set =
      scope === "global"
        ? state?.settings?.excludedCollectGlobalNicknames
        : state?.settings?.excludedCollectScopedNicknames;
    return set instanceof Set && set.has(normalized);
  }

  // 모아보기 제외를 스코프별로 켜고/끈다(순수 상태 변경). 유효 목록
  // (excludedCollectNicknames = 현재 채널 ∪ 모든 채널)을 다시 만든다. 저장/렌더/삭제는
  // 호출부(main)가 담당한다. 실제 변경 시 true.
  function setExcludedCollect(state, nickname, scope, excluded, deps = {}) {
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();

    const normalized = normalizeNicknameFn(nickname);
    if (!normalized || !state || !state.settings) return false;

    // 스코프 세트가 아직 없으면 만들어 둔다(방어).
    if (!(state.settings.excludedCollectScopedNicknames instanceof Set)) {
      state.settings.excludedCollectScopedNicknames = new Set();
    }
    if (!(state.settings.excludedCollectGlobalNicknames instanceof Set)) {
      state.settings.excludedCollectGlobalNicknames = new Set();
    }
    const targetSet =
      scope === "global"
        ? state.settings.excludedCollectGlobalNicknames
        : state.settings.excludedCollectScopedNicknames;

    const alreadyExcluded = targetSet.has(normalized);
    if (excluded && alreadyExcluded) return false;
    if (!excluded && !alreadyExcluded) return false;
    if (excluded) targetSet.add(normalized);
    else targetSet.delete(normalized);

    // 유효 제외 목록(현재 채널 ∪ 모든 채널) 재구성.
    state.settings.excludedCollectNicknames = new Set([
      ...(state.settings.excludedCollectScopedNicknames || []),
      ...(state.settings.excludedCollectGlobalNicknames || []),
    ]);
    return true;
  }

  ns.trackedApi = {
    getPillNicknameSettingItems,
    extractSettingsRoleBadges,
    rememberNicknameRoleBadgesFromEntry,
    syncRoleBadgeCacheFromEntries,
    addTrackedTarget,
    removeTrackedTarget,
    shouldKeepHiddenNickname,
    pruneHiddenNicknameIfOrphanedInPopup,
    getTrackedTargetSettingItems,
    createTrackedTargetChip,
    createSettingToggleRow,
    isExcludedCollectNickname,
    isExcludedCollectNicknameInScope,
    setExcludedCollect,
  };
})();
