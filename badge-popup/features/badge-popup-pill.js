(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.pillApi && typeof ns.pillApi === "object") return;

  function getPillSignature(items) {
    return items
      .map((item) => `${item.nickname}:${item.count}:${item.lastTimestamp || 0}`)
      .join("|");
  }

  function ensurePillCycleForActors(state, actors, deps = {}) {
    if (!state || !state.pillCycle) return;

    const resetPillCycleFn =
      typeof deps.resetPillCycle === "function"
        ? deps.resetPillCycle
        : (resetIndex) => resetPillCycle(state, resetIndex);
    const getUnseenActorsForPillFn =
      typeof deps.getUnseenActorsForPill === "function"
        ? deps.getUnseenActorsForPill
        : () => [];
    const renderPillFn =
      typeof deps.renderPill === "function" ? deps.renderPill : () => {};
    const intervalMs = Number(deps.PILL_CYCLE_INTERVAL_MS) || 2000;

    if (!Array.isArray(actors) || actors.length <= 1) {
      resetPillCycleFn(true);
      return;
    }

    const signature = getPillSignature(actors);
    if (state.pillCycle.signature !== signature) {
      state.pillCycle.signature = signature;
      state.pillCycle.index = 0;
    }

    if (state.pillCycle.timer) return;

    state.pillCycle.timer = setInterval(() => {
      const visibleActors = getUnseenActorsForPillFn();
      if (state.unseenCount <= 0 || visibleActors.length <= 1 || state.isOpen) {
        resetPillCycleFn(true);
        renderPillFn();
        return;
      }
      if (Date.now() < (state.pillCycle.lockUntil || 0)) {
        return;
      }
      const actorLength = Math.max(visibleActors.length, 1);
      state.pillCycle.index = (state.pillCycle.index + 1) % actorLength;
      renderPillFn();
    }, intervalMs);
  }

  function resetPillCycle(state, resetIndex = false) {
    if (!state || !state.pillCycle) return;
    if (state.pillCycle.timer) {
      clearInterval(state.pillCycle.timer);
      state.pillCycle.timer = null;
    }
    if (resetIndex) {
      state.pillCycle.index = 0;
      state.pillCycle.signature = "";
      state.pillCycle.lockUntil = 0;
    }
  }

  function normalizePillRoleForGlow(badgeType) {
    const type = String(badgeType || "")
      .trim()
      .toLowerCase();
    if (type === "owner") return "channel_owner";
    if (
      type === "manager" ||
      type === "partner" ||
      type === "channel_owner" ||
      type === "operator"
    ) {
      return type;
    }
    return "";
  }

  function resolvePillRoleFromIdentity(identity, deps = {}) {
    const normalizeFn =
      typeof deps.normalizePillRoleForGlow === "function"
        ? deps.normalizePillRoleForGlow
        : normalizePillRoleForGlow;

    const badgeTypeRole = normalizeFn(identity?.badgeType || "");
    if (badgeTypeRole) return badgeTypeRole;

    const badgeTypes = Array.isArray(identity?.pillBadges)
      ? identity.pillBadges
          .map((badge) => normalizeFn(badge?.type || ""))
          .filter(Boolean)
      : [];

    if (badgeTypes.includes("channel_owner")) return "channel_owner";
    if (badgeTypes.includes("operator")) return "operator";
    if (badgeTypes.includes("manager")) return "manager";
    if (badgeTypes.includes("partner")) return "partner";
    if (identity?.partnerMark) return "partner";
    return "";
  }

  function applyPillRoleClass(state, badgeType, deps = {}) {
    if (!state || !state.ui) return;
    const pill = state.ui.pill;
    if (!pill) return;

    const roleClasses = Array.isArray(deps.PILL_ROLE_CLASSES)
      ? deps.PILL_ROLE_CLASSES
      : [];
    const roleClassPrefix = String(deps.PILL_ROLE_CLASS_PREFIX || "");
    const normalizeFn =
      typeof deps.normalizePillRoleForGlow === "function"
        ? deps.normalizePillRoleForGlow
        : normalizePillRoleForGlow;

    if (roleClasses.length > 0) {
      pill.classList.remove(...roleClasses);
    }
    const normalizedRole = normalizeFn(badgeType);
    if (!normalizedRole || !roleClassPrefix) return;
    pill.classList.add(`${roleClassPrefix}${normalizedRole}`);
  }

  ns.pillApi = {
    getPillSignature,
    ensurePillCycleForActors,
    resetPillCycle,
    normalizePillRoleForGlow,
    resolvePillRoleFromIdentity,
    applyPillRoleClass,
  };
})();
