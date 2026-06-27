(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  const constants = ns.constants;
  if (!constants || typeof constants !== "object") {
    console.error("[badge-moa] constants module not loaded");
    return;
  }
  if (ns.settingsApi && typeof ns.settingsApi === "object") return;

  const {
    STORAGE_SETTINGS_KEY,
    MESSAGE_MARK,
    INJECT_TRACKED_SYNC_TYPE,
    INJECT_BLIND_CAPTURE_TOGGLE_TYPE,
    INJECT_CHAT_TIMESTAMP_TOGGLE_TYPE,
  } = constants;

  function normalizeHiddenByScope(rawMap, deps = {}) {
    const normalized = {};
    if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
      return normalized;
    }
    const normalizeNickname =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();

    Object.entries(rawMap).forEach(([scopeKey, nicknames]) => {
      const key = String(scopeKey || "").trim();
      if (!key) return;

      const set = new Set();
      if (Array.isArray(nicknames)) {
        nicknames.forEach((nickname) => {
          const normalizedNickname = normalizeNickname(nickname);
          if (!normalizedNickname) return;
          set.add(normalizedNickname);
        });
      }
      normalized[key] = Array.from(set);
    });

    return normalized;
  }

  function normalizeExcludedCollectByScope(rawMap, deps = {}) {
    const normalized = {};
    if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
      return normalized;
    }
    const normalizeNickname =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();

    Object.entries(rawMap).forEach(([scopeKey, nicknames]) => {
      const key = String(scopeKey || "").trim();
      if (!key) return;

      const set = new Set();
      if (Array.isArray(nicknames)) {
        nicknames.forEach((nickname) => {
          const normalizedNickname = normalizeNickname(nickname);
          if (!normalizedNickname) return;
          set.add(normalizedNickname);
        });
      }
      normalized[key] = Array.from(set);
    });

    return normalized;
  }

  function normalizeTrackedTargetsByScope(rawMap, deps = {}) {
    const normalized = {};
    if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
      return normalized;
    }
    const normalizeTrackedNickname =
      typeof deps.normalizeTrackedNickname === "function"
        ? deps.normalizeTrackedNickname
        : (value) => String(value || "").trim();

    Object.entries(rawMap).forEach(([scopeKey, value]) => {
      const key = String(scopeKey || "").trim();
      if (!key) return;

      const nicknameSet = new Set();
      const source = value && typeof value === "object" ? value : {};
      const nicknames = Array.isArray(source.nicknames) ? source.nicknames : [];

      nicknames.forEach((nickname) => {
        const normalizedNickname = normalizeTrackedNickname(nickname);
        if (!normalizedNickname) return;
        nicknameSet.add(normalizedNickname);
      });

      normalized[key] = {
        nicknames: Array.from(nicknameSet),
      };
    });

    return normalized;
  }

  function normalizeNicknameFiltersByScope(rawMap, deps = {}) {
    const normalized = {};
    if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
      return normalized;
    }
    const normalizeNickname =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();

    Object.entries(rawMap).forEach(([scopeKey, value]) => {
      const key = String(scopeKey || "").trim();
      if (!key) return;

      const source = value && typeof value === "object" ? value : {};
      const selected = Array.isArray(source.selectedNicknames)
        ? source.selectedNicknames
        : [];
      const known = Array.isArray(source.knownNicknames)
        ? source.knownNicknames
        : [];
      const selectedSet = new Set();
      selected.forEach((nickname) => {
        const normalizedNickname = normalizeNickname(nickname);
        if (!normalizedNickname) return;
        selectedSet.add(normalizedNickname);
      });
      const knownSet = new Set();
      known.forEach((nickname) => {
        const normalizedNickname = normalizeNickname(nickname);
        if (!normalizedNickname) return;
        knownSet.add(normalizedNickname);
      });
      selectedSet.forEach((nickname) => knownSet.add(nickname));

      normalized[key] = {
        selectedNicknames: Array.from(selectedSet),
        knownNicknames: Array.from(knownSet),
        autoSelectNew: source.autoSelectNew !== false,
      };
    });

    return normalized;
  }

  function normalizeSettings(raw, scopeKey, deps = {}) {
    const createDefaultSettingsState =
      typeof deps.createDefaultSettingsState === "function"
        ? deps.createDefaultSettingsState
        : () => ({});
    const defaults = createDefaultSettingsState();
    if (!raw || typeof raw !== "object") return defaults;

    const normalizeNickname =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const normalizeTrackedNickname =
      typeof deps.normalizeTrackedNickname === "function"
        ? deps.normalizeTrackedNickname
        : (value) => String(value || "").trim();
    const getSettingsScopeKey =
      typeof deps.getSettingsScopeKey === "function"
        ? deps.getSettingsScopeKey
        : () => "home";
    const normalizePopupFontScale =
      typeof deps.normalizePopupFontScale === "function"
        ? deps.normalizePopupFontScale
        : (value) => Number(value) || 1;
    const normalizeChatFontScale =
      typeof deps.normalizeChatFontScale === "function"
        ? deps.normalizeChatFontScale
        : normalizePopupFontScale;
    const normalizeChatWidth =
      typeof deps.normalizeChatWidth === "function"
        ? deps.normalizeChatWidth
        : (value) => Number(value) || 220;

    const hiddenByScope = normalizeHiddenByScope(raw.hiddenPillNicknamesByChannel, {
      normalizeNickname,
    });
    defaults.hiddenPillNicknamesByScope = hiddenByScope;
    const excludedCollectByScope = normalizeExcludedCollectByScope(
      raw.excludedCollectNicknamesByChannel,
      { normalizeNickname },
    );
    defaults.excludedCollectNicknamesByScope = excludedCollectByScope;
    const trackedByScope = normalizeTrackedTargetsByScope(raw.trackedTargetsByChannel, {
      normalizeTrackedNickname,
    });
    defaults.trackedTargetsByScope = trackedByScope;
    const nicknameFiltersByScope = normalizeNicknameFiltersByScope(
      raw.nicknameFiltersByChannel,
      { normalizeNickname },
    );
    defaults.nicknameFiltersByScope = nicknameFiltersByScope;

    const scope = String(scopeKey || "").trim() || getSettingsScopeKey();
    const scopedHidden = hiddenByScope[scope];
    if (Array.isArray(scopedHidden)) {
      scopedHidden.forEach((nickname) => {
        const normalized = normalizeNickname(nickname);
        if (!normalized) return;
        defaults.hiddenPillNicknames.add(normalized);
      });
    }
    const scopedExcluded = excludedCollectByScope[scope];
    if (Array.isArray(scopedExcluded)) {
      scopedExcluded.forEach((nickname) => {
        const normalized = normalizeNickname(nickname);
        if (!normalized) return;
        defaults.excludedCollectNicknames.add(normalized);
      });
    }
    const scopedTracked = trackedByScope[scope];
    if (scopedTracked && typeof scopedTracked === "object") {
      const nicknames = Array.isArray(scopedTracked.nicknames)
        ? scopedTracked.nicknames
        : [];
      nicknames.forEach((nickname) => {
        const normalized = normalizeTrackedNickname(nickname);
        if (!normalized) return;
        defaults.trackedScopedNicknames.add(normalized);
      });
    }
    defaults.trackedNicknames = new Set([...defaults.trackedScopedNicknames]);

    const scopedNicknameFilter = nicknameFiltersByScope[scope];
    if (scopedNicknameFilter && typeof scopedNicknameFilter === "object") {
      defaults.nicknameFilterAutoSelectNew =
        scopedNicknameFilter.autoSelectNew !== false;
      const selected = Array.isArray(scopedNicknameFilter.selectedNicknames)
        ? scopedNicknameFilter.selectedNicknames
        : [];
      const known = Array.isArray(scopedNicknameFilter.knownNicknames)
        ? scopedNicknameFilter.knownNicknames
        : [];
      selected.forEach((nickname) => {
        const normalized = normalizeNickname(nickname);
        if (!normalized) return;
        defaults.nicknameFilterSelected.add(normalized);
      });
      known.forEach((nickname) => {
        const normalized = normalizeNickname(nickname);
        if (!normalized) return;
        defaults.nicknameFilterKnownNicknames.add(normalized);
      });
      defaults.nicknameFilterSelected.forEach((nickname) => {
        defaults.nicknameFilterKnownNicknames.add(nickname);
      });
    }

    defaults.hideChatBackground = raw.hideChatBackground === true;
    defaults.hideChatBorder = raw.hideChatBorder === true;
    defaults.hidePopupBackground = raw.hidePopupBackground === true;
    defaults.hidePopupBorder = raw.hidePopupBorder === true;
    defaults.hidePopupTime = raw.hidePopupTime === true;
    defaults.hideChatRanking = raw.hideChatRanking === true;
    defaults.hideChatMission = raw.hideChatMission === true;
    defaults.hideChatMissionMessage = raw.hideChatMissionMessage === true;
    defaults.hideChatPrediction = raw.hideChatPrediction === true;
    defaults.hideChatSubscription = raw.hideChatSubscription === true;
    defaults.hideChatDonation = raw.hideChatDonation === true;
    defaults.restoreBlindedChat = raw.restoreBlindedChat === true;
    defaults.showChatTimestamp = raw.showChatTimestamp === true;
    defaults.showPopupRoleBadgesOnly = raw.showPopupRoleBadgesOnly === true;
    defaults.popupFontScale = normalizePopupFontScale(raw.popupFontScale);
    defaults.chatFontScale = normalizeChatFontScale(raw.chatFontScale);
    defaults.placeChatOnLeft = raw.placeChatOnLeft === true;
    defaults.enableChatWidthResize = raw.enableChatWidthResize === true;
    defaults.chatWidth = normalizeChatWidth(raw.chatWidth);
    if (typeof raw.deleteWithoutConfirm === "boolean") {
      defaults.deleteWithoutConfirm = raw.deleteWithoutConfirm === true;
    } else if (typeof raw.confirmDeleteDialog === "boolean") {
      defaults.deleteWithoutConfirm = raw.confirmDeleteDialog !== true;
    } else {
      defaults.deleteWithoutConfirm = false;
    }
    defaults.hidePillButton = raw.hidePillButton === true;
    defaults.keepPopupOpen =
      raw.hidePillButton === true
        ? false
        : raw.keepPopupOpen === true || raw.keepPillExpanded === true;
    defaults.pillGlowEnabled = raw.pillGlowEnabled !== false;
    defaults.enableSessionCache = raw.enableSessionCache === true;
    return defaults;
  }

  async function loadSettings(scopeKey, deps = {}) {
    const getStorageValue =
      typeof deps.getStorageValue === "function"
        ? deps.getStorageValue
        : async () => null;
    const stored = await getStorageValue(STORAGE_SETTINGS_KEY);
    return normalizeSettings(stored, scopeKey, deps);
  }

  function syncTrackedTargetsToInject(state, deps = {}) {
    const normalizeTrackedNickname =
      typeof deps.normalizeTrackedNickname === "function"
        ? deps.normalizeTrackedNickname
        : (value) => String(value || "").trim();
    try {
      const nicknames = Array.from(state.settings.trackedNicknames || [])
        .map((value) => normalizeTrackedNickname(value))
        .filter((value) => !!value);
      window.postMessage(
        {
          [MESSAGE_MARK]: true,
          type: INJECT_TRACKED_SYNC_TYPE,
          payload: { nicknames },
        },
        window.location.origin,
      );
    } catch (_error) {}
  }

  // 가려진 채팅 표시 on/off를 inject(MAIN world)에 통지한다.
  function syncBlindCaptureToInject(state) {
    try {
      window.postMessage(
        {
          [MESSAGE_MARK]: true,
          type: INJECT_BLIND_CAPTURE_TOGGLE_TYPE,
          payload: { enabled: state.settings.restoreBlindedChat === true },
        },
        window.location.origin,
      );
    } catch (_error) {}
  }

  // 채팅 시간 표시 on/off를 inject(MAIN world)에 통지한다.
  function syncChatTimestampToInject(state) {
    try {
      window.postMessage(
        {
          [MESSAGE_MARK]: true,
          type: INJECT_CHAT_TIMESTAMP_TOGGLE_TYPE,
          payload: { enabled: state.settings.showChatTimestamp === true },
        },
        window.location.origin,
      );
    } catch (_error) {}
  }

  function saveSettings(state, deps = {}) {
    const getSettingsScopeKey =
      typeof deps.getSettingsScopeKey === "function"
        ? deps.getSettingsScopeKey
        : () => "home";
    const normalizePopupFontScale =
      typeof deps.normalizePopupFontScale === "function"
        ? deps.normalizePopupFontScale
        : (value) => Number(value) || 1;
    const normalizeChatFontScale =
      typeof deps.normalizeChatFontScale === "function"
        ? deps.normalizeChatFontScale
        : normalizePopupFontScale;
    const normalizeChatWidth =
      typeof deps.normalizeChatWidth === "function"
        ? deps.normalizeChatWidth
        : (value) => Number(value) || 220;
    const setStorageValue =
      typeof deps.setStorageValue === "function"
        ? deps.setStorageValue
        : () => {};
    const getStorageValue =
      typeof deps.getStorageValue === "function"
        ? deps.getStorageValue
        : null;

    const scopeKey = state.settingsScopeKey || getSettingsScopeKey();
    const hiddenByScope = {
      ...(state.settings.hiddenPillNicknamesByScope || {}),
      [scopeKey]: Array.from(state.settings.hiddenPillNicknames),
    };
    state.settings.hiddenPillNicknamesByScope = hiddenByScope;
    const excludedCollectByScope = {
      ...(state.settings.excludedCollectNicknamesByScope || {}),
      [scopeKey]: Array.from(state.settings.excludedCollectNicknames || []),
    };
    state.settings.excludedCollectNicknamesByScope = excludedCollectByScope;
    const trackedByScope = {
      ...(state.settings.trackedTargetsByScope || {}),
      [scopeKey]: {
        nicknames: Array.from(state.settings.trackedScopedNicknames || []),
      },
    };
    state.settings.trackedTargetsByScope = trackedByScope;
    const nicknameFiltersByScope = {
      ...(state.settings.nicknameFiltersByScope || {}),
      [scopeKey]: {
        selectedNicknames: Array.from(state.nicknameFilter.selected || []),
        knownNicknames: Array.from(state.nicknameFilter.knownNicknames || []),
        autoSelectNew: state.nicknameFilter.autoSelectNew !== false,
      },
    };
    state.settings.nicknameFiltersByScope = nicknameFiltersByScope;

    const payload = {
      hiddenPillNicknamesByChannel: hiddenByScope,
      excludedCollectNicknamesByChannel: excludedCollectByScope,
      trackedTargetsByChannel: trackedByScope,
      trackedGlobalNicknames: [],
      nicknameFiltersByChannel: nicknameFiltersByScope,
      hideChatBackground: state.settings.hideChatBackground === true,
      hideChatBorder: state.settings.hideChatBorder === true,
      hidePopupBackground: state.settings.hidePopupBackground === true,
      hidePopupBorder: state.settings.hidePopupBorder === true,
      hidePopupTime: state.settings.hidePopupTime === true,
      hideChatRanking: state.settings.hideChatRanking === true,
      hideChatMission: state.settings.hideChatMission === true,
      hideChatMissionMessage:
        state.settings.hideChatMissionMessage === true,
      hideChatPrediction: state.settings.hideChatPrediction === true,
      hideChatSubscription: state.settings.hideChatSubscription === true,
      hideChatDonation: state.settings.hideChatDonation === true,
      restoreBlindedChat: state.settings.restoreBlindedChat === true,
      showChatTimestamp: state.settings.showChatTimestamp === true,
      showPopupRoleBadgesOnly:
        state.settings.showPopupRoleBadgesOnly === true,
      popupFontScale: normalizePopupFontScale(state.settings.popupFontScale),
      chatFontScale: normalizeChatFontScale(state.settings.chatFontScale),
      placeChatOnLeft: state.settings.placeChatOnLeft === true,
      enableChatWidthResize: state.settings.enableChatWidthResize === true,
      chatWidth: normalizeChatWidth(state.settings.chatWidth),
      deleteWithoutConfirm: state.settings.deleteWithoutConfirm === true,
      hidePillButton: state.settings.hidePillButton === true,
      keepPopupOpen:
        state.settings.hidePillButton === true
          ? false
          : state.settings.keepPopupOpen === true,
      pillGlowEnabled: state.settings.pillGlowEnabled !== false,
      enableSessionCache: state.settings.enableSessionCache === true,
    };

    const preservedKeys = [
      "autoPruneManagedHiddenOnReconnect",
      "showHiddenAdvancedOptions",
      "popupTheme",
      "managedHiddenNicknamesByChannel",
      "hiddenChipRoleBadgesByChannel",
    ];

    const commit = (existing) => {
      if (existing && typeof existing === "object") {
        preservedKeys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(existing, key)) {
            payload[key] = existing[key];
          }
        });
      }
      setStorageValue(STORAGE_SETTINGS_KEY, payload);
      if (typeof deps.syncTrackedTargetsToInject === "function") {
        deps.syncTrackedTargetsToInject();
      }
    };

    if (getStorageValue) {
      const result = getStorageValue(STORAGE_SETTINGS_KEY);
      if (result && typeof result.then === "function") {
        result.then(commit, () => commit(null));
        return;
      }
      commit(result);
      return;
    }
    commit(null);
  }

  function buildSettingsContextResponse(state, deps = {}) {
    const getSettingsScopeKey =
      typeof deps.getSettingsScopeKey === "function"
        ? deps.getSettingsScopeKey
        : () => "home";
    const resolveChannelDisplayName =
      typeof deps.resolveChannelDisplayName === "function"
        ? deps.resolveChannelDisplayName
        : () => "";
    const getPillNicknameSettingItems =
      typeof deps.getPillNicknameSettingItems === "function"
        ? deps.getPillNicknameSettingItems
        : () => [];
    const normalizePopupFontScale =
      typeof deps.normalizePopupFontScale === "function"
        ? deps.normalizePopupFontScale
        : (value) => Number(value) || 1;
    const normalizeChatFontScale =
      typeof deps.normalizeChatFontScale === "function"
        ? deps.normalizeChatFontScale
        : normalizePopupFontScale;
    const normalizeChatWidth =
      typeof deps.normalizeChatWidth === "function"
        ? deps.normalizeChatWidth
        : (value) => Number(value) || 220;

    return {
      ok: true,
      scopeKey:
        state.settingsScopeKey || getSettingsScopeKey(state.resolvedChannelId),
      resolvedChannelId: state.resolvedChannelId || "",
      channelDisplayName: resolveChannelDisplayName(),
      nicknameItems: getPillNicknameSettingItems(),
      settings: {
        hideChatBackground: state.settings.hideChatBackground === true,
        hideChatBorder: state.settings.hideChatBorder === true,
        hidePopupBackground: state.settings.hidePopupBackground === true,
        hidePopupBorder: state.settings.hidePopupBorder === true,
        hidePopupTime: state.settings.hidePopupTime === true,
        hideChatRanking: state.settings.hideChatRanking === true,
        hideChatMission: state.settings.hideChatMission === true,
        hideChatMissionMessage:
          state.settings.hideChatMissionMessage === true,
        hideChatPrediction: state.settings.hideChatPrediction === true,
        hideChatSubscription: state.settings.hideChatSubscription === true,
        hideChatDonation: state.settings.hideChatDonation === true,
        restoreBlindedChat: state.settings.restoreBlindedChat === true,
        showChatTimestamp: state.settings.showChatTimestamp === true,
        showPopupRoleBadgesOnly:
          state.settings.showPopupRoleBadgesOnly === true,
        popupFontScale: normalizePopupFontScale(state.settings.popupFontScale),
        chatFontScale: normalizeChatFontScale(state.settings.chatFontScale),
        placeChatOnLeft: state.settings.placeChatOnLeft === true,
        enableChatWidthResize: state.settings.enableChatWidthResize === true,
        chatWidth: normalizeChatWidth(state.settings.chatWidth),
        deleteWithoutConfirm: state.settings.deleteWithoutConfirm === true,
        hidePillButton: state.settings.hidePillButton === true,
        keepPopupOpen:
          state.settings.hidePillButton === true
            ? false
            : state.settings.keepPopupOpen === true,
        pillGlowEnabled: state.settings.pillGlowEnabled !== false,
        enableSessionCache: state.settings.enableSessionCache === true,
        hiddenPillNicknames: Array.from(state.settings.hiddenPillNicknames || []),
        excludedCollectNicknames: Array.from(
          state.settings.excludedCollectNicknames || [],
        ),
        trackedNicknames: Array.from(state.settings.trackedNicknames || []),
        trackedScopedNicknames: Array.from(
          state.settings.trackedScopedNicknames || [],
        ),
      },
    };
  }

  function applySettingsFromPopupPayload(state, payload, deps = {}) {
    const source = payload && typeof payload === "object" ? payload : {};
    const normalizeTrackedNickname =
      typeof deps.normalizeTrackedNickname === "function"
        ? deps.normalizeTrackedNickname
        : (value) => String(value || "").trim();
    const normalizeNickname =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const normalizePopupFontScale =
      typeof deps.normalizePopupFontScale === "function"
        ? deps.normalizePopupFontScale
        : (value) => Number(value) || 1;
    const normalizeChatFontScale =
      typeof deps.normalizeChatFontScale === "function"
        ? deps.normalizeChatFontScale
        : normalizePopupFontScale;
    const normalizeChatWidth =
      typeof deps.normalizeChatWidth === "function"
        ? deps.normalizeChatWidth
        : (value) => Number(value) || 220;
    const previousTrackedNicknames = new Set(state.settings.trackedNicknames || []);
    const forcedTrackedNicknames = new Set(
      Array.isArray(source.newTrackedNicknames)
        ? source.newTrackedNicknames
            .map((value) => normalizeTrackedNickname(value))
            .filter((value) => !!value)
        : [],
    );
    let shouldPruneExcludedEntries = false;

    if (typeof source.hideChatBackground === "boolean") {
      state.settings.hideChatBackground = source.hideChatBackground;
    }
    if (typeof source.hideChatBorder === "boolean") {
      state.settings.hideChatBorder = source.hideChatBorder;
    }
    if (typeof source.hidePopupBackground === "boolean") {
      state.settings.hidePopupBackground = source.hidePopupBackground;
    }
    if (typeof source.hidePopupBorder === "boolean") {
      state.settings.hidePopupBorder = source.hidePopupBorder;
    }
    if (typeof source.hidePopupTime === "boolean") {
      state.settings.hidePopupTime = source.hidePopupTime;
    }
    if (typeof source.hideChatRanking === "boolean") {
      state.settings.hideChatRanking = source.hideChatRanking;
    }
    if (typeof source.hideChatMission === "boolean") {
      state.settings.hideChatMission = source.hideChatMission;
    }
    if (typeof source.hideChatMissionMessage === "boolean") {
      state.settings.hideChatMissionMessage = source.hideChatMissionMessage;
    }
    if (typeof source.hideChatPrediction === "boolean") {
      state.settings.hideChatPrediction = source.hideChatPrediction;
    }
    if (typeof source.hideChatSubscription === "boolean") {
      state.settings.hideChatSubscription = source.hideChatSubscription;
    }
    if (typeof source.hideChatDonation === "boolean") {
      state.settings.hideChatDonation = source.hideChatDonation;
    }
    if (typeof source.restoreBlindedChat === "boolean") {
      state.settings.restoreBlindedChat = source.restoreBlindedChat;
    }
    if (typeof source.showChatTimestamp === "boolean") {
      state.settings.showChatTimestamp = source.showChatTimestamp;
    }
    if (typeof source.showPopupRoleBadgesOnly === "boolean") {
      state.settings.showPopupRoleBadgesOnly = source.showPopupRoleBadgesOnly;
    }
    if (typeof source.placeChatOnLeft === "boolean") {
      state.settings.placeChatOnLeft = source.placeChatOnLeft;
    }
    if (typeof source.enableChatWidthResize === "boolean") {
      state.settings.enableChatWidthResize = source.enableChatWidthResize;
    }
    if (
      typeof source.popupFontScale === "number" ||
      typeof source.popupFontScale === "string"
    ) {
      state.settings.popupFontScale = normalizePopupFontScale(
        source.popupFontScale,
      );
    }
    if (
      typeof source.chatFontScale === "number" ||
      typeof source.chatFontScale === "string"
    ) {
      state.settings.chatFontScale = normalizeChatFontScale(source.chatFontScale);
    }
    if (
      typeof source.chatWidth === "number" ||
      typeof source.chatWidth === "string"
    ) {
      state.settings.chatWidth = normalizeChatWidth(source.chatWidth);
    }
    if (typeof source.deleteWithoutConfirm === "boolean") {
      state.settings.deleteWithoutConfirm = source.deleteWithoutConfirm;
    }
    if (typeof source.hidePillButton === "boolean") {
      state.settings.hidePillButton = source.hidePillButton;
      if (state.settings.hidePillButton) {
        state.settings.keepPopupOpen = false;
      }
    }
    if (
      typeof source.keepPopupOpen === "boolean" ||
      typeof source.keepPillExpanded === "boolean"
    ) {
      const sourceKeepPopupOpen =
        typeof source.keepPopupOpen === "boolean"
          ? source.keepPopupOpen
          : source.keepPillExpanded;
      state.settings.keepPopupOpen =
        sourceKeepPopupOpen === true &&
        state.settings.hidePillButton !== true;
    }
    if (typeof source.pillGlowEnabled === "boolean") {
      state.settings.pillGlowEnabled = source.pillGlowEnabled;
      if (!state.settings.pillGlowEnabled) {
        clearTimeout(state.attentionTimer);
        state.pillCycle.lockUntil = 0;
        if (state.ui.pill) {
          state.ui.pill.classList.remove("is-attention");
        }
      }
    }
    if (typeof source.enableSessionCache === "boolean") {
      const previousEnabled =
        typeof deps.isSessionCacheEnabled === "function"
          ? deps.isSessionCacheEnabled()
          : false;
      state.settings.enableSessionCache = source.enableSessionCache;
      const nextEnabled =
        typeof deps.isSessionCacheEnabled === "function"
          ? deps.isSessionCacheEnabled()
          : false;
      if (!nextEnabled) {
        if (typeof deps.clearPersistChannelCacheTimer === "function") {
          deps.clearPersistChannelCacheTimer();
        }
        if (typeof deps.clearSessionCachesForCurrentTab === "function") {
          void deps.clearSessionCachesForCurrentTab();
        }
      } else if (!previousEnabled && nextEnabled) {
        if (Array.isArray(state.entries) && state.entries.length > 0) {
          if (typeof deps.persistChannelCacheNow === "function") {
            deps.persistChannelCacheNow(state.resolvedChannelId);
          }
        } else if (typeof deps.restoreChannelCache === "function") {
          void deps.restoreChannelCache(state.resolvedChannelId);
        }
      }
    }
    if (Array.isArray(source.hiddenPillNicknames)) {
      state.settings.hiddenPillNicknames = new Set(
        source.hiddenPillNicknames
          .map((value) => normalizeNickname(value))
          .filter((value) => !!value),
      );
    }
    if (Array.isArray(source.excludedCollectNicknames)) {
      state.settings.excludedCollectNicknames = new Set(
        source.excludedCollectNicknames
          .map((value) => normalizeNickname(value))
          .filter((value) => !!value),
      );
      shouldPruneExcludedEntries = source.pruneExcludedEntries === true;
    }

    if (Array.isArray(source.trackedNicknames)) {
      state.settings.trackedScopedNicknames = new Set(
        source.trackedNicknames
          .map((value) => normalizeTrackedNickname(value))
          .filter((value) => !!value),
      );
    }
    if (Array.isArray(source.trackedNicknames)) {
      if (typeof deps.rebuildEffectiveTrackedNicknames === "function") {
        deps.rebuildEffectiveTrackedNicknames();
      }

      state.settings.trackedNicknames.forEach((nickname) => {
        const shouldActivate =
          forcedTrackedNicknames.has(nickname) ||
          !previousTrackedNicknames.has(nickname);
        if (!shouldActivate) return;
        state.nicknameFilter.selected.add(nickname);
        state.nicknameFilter.pendingTrackedNicknames.add(nickname);
      });

      Array.from(state.nicknameFilter.pendingTrackedNicknames).forEach(
        (nickname) => {
          if (!state.settings.trackedNicknames.has(nickname)) {
            state.nicknameFilter.pendingTrackedNicknames.delete(nickname);
          }
        },
      );
    }

    const excludedPruned =
      shouldPruneExcludedEntries &&
      typeof deps.pruneExcludedEntriesFromState === "function"
        ? deps.pruneExcludedEntriesFromState()
        : false;
    if (excludedPruned && typeof deps.schedulePersistChannelCache === "function") {
      deps.schedulePersistChannelCache();
    }

    if (typeof deps.saveSettings === "function") {
      deps.saveSettings();
    }
    // 가려진 채팅 표시 / 채팅 시간 표시 토글을 inject에 통지(ON-sweep/OFF-revert는 inject가 처리).
    if (typeof deps.syncBlindCaptureToInject === "function") {
      deps.syncBlindCaptureToInject();
    }
    if (typeof deps.syncChatTimestampToInject === "function") {
      deps.syncChatTimestampToInject();
    }
    if (typeof deps.render === "function") {
      deps.render();
    }
  }

  ns.settingsApi = {
    normalizeHiddenByScope,
    normalizeExcludedCollectByScope,
    normalizeTrackedTargetsByScope,
    normalizeNicknameFiltersByScope,
    normalizeSettings,
    loadSettings,
    saveSettings,
    syncTrackedTargetsToInject,
    syncBlindCaptureToInject,
    syncChatTimestampToInject,
    buildSettingsContextResponse,
    applySettingsFromPopupPayload,
  };
})();
