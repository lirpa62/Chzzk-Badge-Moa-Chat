(() => {
  const STORAGE_SETTINGS_KEY = "chzzk_badge_moa_popup_settings";
  const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
  const STATUS_IDLE_CONNECTED = "현재 탭에 즉시 반영됩니다.";
  const STATUS_IDLE_DISCONNECTED =
    "설정은 저장되며 탭 반영은 페이지 새로고침 후 적용될 수 있습니다.";
  const CHZZK_API_BASE = "https://api.chzzk.naver.com";
  const SEARCH_CHANNEL_PAGE_SIZE = 33;
  const TRACKED_NICKNAME_ALLOWLIST = new Set(["익명의 후원자", "미션 결과"]);
  const OFFICIAL_MARK_URL =
    "https://ssl.pstatic.net/static/nng/glive/image/icon_official_mark.png";
  const TRACKED_SCOPE_CHANNEL = "channel";
  const MAX_TRACKED_NICKNAMES_PER_SCOPE = 200;
  const CHIP_COLLAPSE_THRESHOLD = 4;
  const DEFAULT_POPUP_FONT_SCALE = 1;
  const MIN_POPUP_FONT_SCALE = 0.8;
  const MAX_POPUP_FONT_SCALE = 1.2;
  const darkThemeMedia =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(THEME_MEDIA_QUERY)
      : null;

  const state = {
    tabId: null,
    tabUrl: "",
    scopeKey: "home",
    scopeLabel: "",
    connected: false,
    rawSettings: {},
    nicknameItems: [],
    hiddenChipMetaByNickname: new Map(),
    hiddenSet: new Set(),
    managedHiddenNicknameSet: new Set(),
    excludedCollectNicknameSet: new Set(),
    hiddenAdvancedSelectedSet: new Set(),
    trackedNicknameSet: new Set(),
    trackedScopedNicknameSet: new Set(),
    selectedTrackedNicknameSet: new Set(),
    showHiddenAdvancedOptions: false,
    hideChatBackground: false,
    hideChatBorder: false,
    hidePopupBackground: false,
    hidePopupBorder: false,
    hidePopupTime: false,
    popupFontScale: DEFAULT_POPUP_FONT_SCALE,
    deleteWithoutConfirm: false,
    hidePillButton: false,
    pillGlowEnabled: true,
    enableSessionCache: false,
    autoPruneManagedHiddenOnReconnect: false,
    popupTheme: "system",
    statusTimer: null,
    hiddenChipsCollapsed: true,
    trackedChipsCollapsed: true,
    lastHiddenAdvancedSelectedSize: 0,
    excludeConfirmDialog: {
      open: false,
      resolver: null,
      lastFocused: null,
      keyHandler: null,
    },
    genericConfirmDialog: {
      open: false,
      resolver: null,
      lastFocused: null,
      keyHandler: null,
    },
  };

  const el = {
    scopeInfo: document.getElementById("scope-info"),
    status: document.getElementById("status"),
    hiddenChips: document.getElementById("hidden-chips"),
    hiddenCountInfo: document.getElementById("hidden-count-info"),
    trackedChips: document.getElementById("tracked-chips"),
    trackedCountInfo: document.getElementById("tracked-count-info"),
    hiddenSection: document.getElementById("hidden-section"),
    hiddenAdvancedToggle: document.getElementById("hidden-advanced-toggle"),
    hiddenCollapseToggle: document.getElementById("hidden-collapse-toggle"),
    hiddenExcludeSelected: document.getElementById("hidden-exclude-selected"),
    hiddenSelectAll: document.getElementById("hidden-select-all"),
    hiddenClearAll: document.getElementById("hidden-clear-all"),
    hiddenPruneEmpty: document.getElementById("hidden-prune-empty"),
    hiddenAutoPruneToggle: document.getElementById("hidden-auto-prune-toggle"),
    trackedCollapseToggle: document.getElementById("tracked-collapse-toggle"),
    trackedDeleteSelected: document.getElementById("tracked-delete-selected"),
    trackedDeleteAll: document.getElementById("tracked-delete-all"),
    trackedInput: document.getElementById("tracked-input"),
    addNickname: document.getElementById("add-nickname"),
    hideChatBg: document.getElementById("hide-chat-bg"),
    hideChatBorder: document.getElementById("hide-chat-border"),
    hidePopupBg: document.getElementById("hide-popup-bg"),
    hidePopupBorder: document.getElementById("hide-popup-border"),
    hidePopupTime: document.getElementById("hide-popup-time"),
    popupFontScale: document.getElementById("popup-font-scale"),
    deleteWithoutConfirm: document.getElementById("delete-without-confirm"),
    hidePillButton: document.getElementById("hide-pill-button"),
    pillGlowEnabled: document.getElementById("pill-glow-enabled"),
    enableSessionCache: document.getElementById("enable-session-cache"),
    clearCurrentChannelSession: document.getElementById(
      "clear-current-channel-session",
    ),
    themeToggle: document.getElementById("theme-toggle"),
    themeToggleCurrent: document.getElementById("theme-toggle-current"),
    themeToggleOptions: Array.from(
      document.querySelectorAll(".theme-toggle-option"),
    ),
    excludeConfirmModal: document.getElementById("exclude-confirm-modal"),
    excludeConfirmDialog: document.getElementById("exclude-confirm-dialog"),
    excludeConfirmBackdrop: document.getElementById("exclude-confirm-backdrop"),
    excludeConfirmCancel: document.getElementById("exclude-confirm-cancel"),
    excludeConfirmKeep: document.getElementById("exclude-confirm-keep"),
    excludeConfirmPrune: document.getElementById("exclude-confirm-prune"),
    genericConfirmModal: document.getElementById("generic-confirm-modal"),
    genericConfirmDialog: document.getElementById("generic-confirm-dialog"),
    genericConfirmBackdrop: document.getElementById("generic-confirm-backdrop"),
    genericConfirmTitle: document.getElementById("generic-confirm-title"),
    genericConfirmMessage: document.getElementById("generic-confirm-message"),
    genericConfirmCancel: document.getElementById("generic-confirm-cancel"),
    genericConfirmOk: document.getElementById("generic-confirm-ok"),
  };

  init().catch(() => {
    setStatus("설정을 불러오지 못했습니다.");
  });

  async function init() {
    bindEvents();
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    state.tabId = Number(tab && tab.id);
    state.tabUrl = String((tab && tab.url) || "");
    state.scopeKey = getScopeKeyFromUrl(state.tabUrl);
    state.scopeLabel = formatScopeLabel(state.scopeKey);

    const raw = await getStorageLocal(STORAGE_SETTINGS_KEY);
    state.rawSettings = normalizeRawSettings(raw);
    applyStateFromRawForScope(state.scopeKey);
    applyPopupTheme();

    const managedSizeBefore = state.managedHiddenNicknameSet.size;
    const context = await getContextFromContentScript();
    if (context && context.ok) {
      state.connected = true;
      syncScopeFromContext(context);
      if (context.channelDisplayName) {
        const displayName = String(context.channelDisplayName || "").trim();
        if (displayName) {
          state.scopeLabel = displayName;
        }
      }
      state.nicknameItems = Array.isArray(context.nicknameItems)
        ? context.nicknameItems
        : [];
      mergeHiddenChipMetaFromNicknameItems(state.nicknameItems);
      if (context.settings && typeof context.settings === "object") {
        applyStateFromContextSettings(context.settings);
      }
    } else {
      state.connected = false;
      state.nicknameItems = [];
    }
    let persistNeeded =
      state.managedHiddenNicknameSet.size !== managedSizeBefore;
    if (state.connected && state.autoPruneManagedHiddenOnReconnect) {
      const prunedCount = pruneManagedHiddenSilently();
      if (prunedCount > 0) {
        persistNeeded = true;
      }
    }
    if (persistNeeded) {
      updateRawSettingsFromState();
      await setStorageLocal(STORAGE_SETTINGS_KEY, state.rawSettings);
    }
    render();
    setIdleStatus();
  }

  function isThemeToggleExpanded() {
    return (
      el.themeToggle instanceof HTMLElement &&
      el.themeToggle.dataset.expanded === "true"
    );
  }

  function setThemeToggleExpanded(expanded) {
    if (!(el.themeToggle instanceof HTMLElement)) return;
    const next = expanded === true;
    el.themeToggle.dataset.expanded = String(next);
    if (el.themeToggleCurrent) {
      el.themeToggleCurrent.setAttribute("aria-expanded", String(next));
    }
  }

  function syncThemeToggleUi() {
    const current = normalizePopupTheme(state.popupTheme);
    if (el.themeToggle instanceof HTMLElement) {
      el.themeToggle.dataset.current = current;
    }
    el.themeToggleOptions.forEach((button) => {
      const value = normalizePopupTheme(button.dataset.themeValue);
      button.setAttribute("aria-checked", String(value === current));
    });
  }

  function triggerHintPulse(element) {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove("is-pulse-hint");
    void element.offsetWidth;
    element.classList.add("is-pulse-hint");
    const handleEnd = () => {
      element.classList.remove("is-pulse-hint");
      element.removeEventListener("animationend", handleEnd);
    };
    element.addEventListener("animationend", handleEnd);
  }

  function clearHintPulse(element) {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove("is-pulse-hint");
  }

  function pruneManagedHiddenSilently() {
    const currentNicknames = getCurrentChannelNicknames();
    let removed = 0;
    Array.from(state.managedHiddenNicknameSet).forEach((nickname) => {
      if (currentNicknames.has(nickname)) return;
      if (state.hiddenSet.has(nickname)) return;
      if (state.excludedCollectNicknameSet.has(nickname)) return;
      if (state.trackedScopedNicknameSet.has(nickname)) return;
      state.managedHiddenNicknameSet.delete(nickname);
      state.hiddenChipMetaByNickname.delete(nickname);
      removed += 1;
    });
    return removed;
  }

  function bindEvents() {
    if (
      darkThemeMedia &&
      typeof darkThemeMedia.addEventListener === "function"
    ) {
      darkThemeMedia.addEventListener("change", onSystemThemeChanged);
    }

    if (el.themeToggleCurrent) {
      el.themeToggleCurrent.addEventListener("click", (event) => {
        event.stopPropagation();
        setThemeToggleExpanded(!isThemeToggleExpanded());
      });
    }
    el.themeToggleOptions.forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const next = normalizePopupTheme(button.dataset.themeValue);
        state.popupTheme = next;
        syncThemeToggleUi();
        applyPopupTheme();
        setThemeToggleExpanded(false);
        await persistAndApply();
      });
    });
    document.addEventListener("click", (event) => {
      if (!isThemeToggleExpanded()) return;
      if (
        el.themeToggle &&
        event.target instanceof Node &&
        el.themeToggle.contains(event.target)
      ) {
        return;
      }
      setThemeToggleExpanded(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!isThemeToggleExpanded()) return;
      setThemeToggleExpanded(false);
      if (el.themeToggleCurrent) el.themeToggleCurrent.focus();
    });

    el.hideChatBg.addEventListener("change", async () => {
      state.hideChatBackground = el.hideChatBg.checked;
      await persistAndApply();
    });

    el.hideChatBorder.addEventListener("change", async () => {
      state.hideChatBorder = el.hideChatBorder.checked;
      await persistAndApply();
    });

    el.hidePopupBg.addEventListener("change", async () => {
      state.hidePopupBackground = el.hidePopupBg.checked;
      await persistAndApply();
    });

    el.hidePopupBorder.addEventListener("change", async () => {
      state.hidePopupBorder = el.hidePopupBorder.checked;
      await persistAndApply();
    });

    el.hidePopupTime.addEventListener("change", async () => {
      state.hidePopupTime = el.hidePopupTime.checked;
      await persistAndApply();
    });

    el.popupFontScale.addEventListener("change", async () => {
      state.popupFontScale = normalizePopupFontScale(el.popupFontScale.value);
      await persistAndApply();
    });

    el.deleteWithoutConfirm.addEventListener("change", async () => {
      const nextChecked = el.deleteWithoutConfirm.checked;
      if (!nextChecked) {
        const confirmed = await askGenericConfirm(
          "팝업창 필터 확인없이 바로 삭제 해제",
          "해제하면 팝업창 필터 삭제 시 확인 모달창이 표시됩니다.\n계속 진행하시겠습니까?",
          { okLabel: "해제", cancelLabel: "취소", danger: false },
        );
        if (!confirmed) {
          el.deleteWithoutConfirm.checked = true;
          state.deleteWithoutConfirm = true;
          return;
        }
      }
      state.deleteWithoutConfirm = nextChecked;
      await persistAndApply();
    });

    el.pillGlowEnabled.addEventListener("change", async () => {
      state.pillGlowEnabled = el.pillGlowEnabled.checked;
      await persistAndApply();
    });

    el.hidePillButton.addEventListener("change", async () => {
      const nextChecked = el.hidePillButton.checked;
      if (nextChecked) {
        const confirmed = await askGenericConfirm(
          "채팅창 알림 버튼 숨김",
          "채팅창 알림 버튼을 숨기면 배지 채팅 모아보기 팝업창을 열 수 없습니다.\n계속 진행하시겠습니까?",
          { okLabel: "숨기기", cancelLabel: "취소", danger: true },
        );
        if (!confirmed) {
          el.hidePillButton.checked = false;
          state.hidePillButton = false;
          return;
        }
      }
      state.hidePillButton = nextChecked;
      await persistAndApply();
    });

    el.enableSessionCache.addEventListener("change", async () => {
      state.enableSessionCache = el.enableSessionCache.checked;
      await persistAndApply();
    });

    if (el.clearCurrentChannelSession) {
      el.clearCurrentChannelSession.addEventListener("click", async () => {
        if (el.clearCurrentChannelSession.disabled) return;

        let probe = null;
        let probeFailed = false;
        try {
          probe = await chrome.tabs.sendMessage(state.tabId, {
            type: "chzzk_badge_moa_has_current_channel_data",
          });
        } catch (_error) {
          setStatus("치지직 탭과 연결되지 않았습니다.", {
            autoResetMs: 2400,
          });
          return;
        }
        if (!probe || probe.ok !== true) {
          probeFailed = true;
        }
        if (!probeFailed) {
          const hasAny =
            probe.hasEntries === true || probe.hasCachedSession === true;
          if (!hasAny) {
            await askGenericConfirm(
              "비울 채팅이 없습니다",
              "현재 채널에 비울 모아보기 채팅과 세션 캐시가 없습니다.",
              { okLabel: "확인", cancelLabel: "", danger: false },
            );
            return;
          }
        }

        const confirmed = await askGenericConfirm(
          "현재 채널 채팅 비우기",
          "현재 채널의 모아보기 채팅과 세션 캐시를 모두 비웁니다.\n계속 진행하시겠습니까?",
          { okLabel: "비우기", cancelLabel: "취소", danger: true },
        );
        if (!confirmed) return;

        try {
          const response = await chrome.tabs.sendMessage(state.tabId, {
            type: "chzzk_badge_moa_clear_current_channel",
          });
          if (response && response.ok) {
            setStatus("현재 채널 채팅을 비웠습니다.", { autoResetMs: 1800 });
          } else {
            setStatus("비우기에 실패했습니다.", { autoResetMs: 2400 });
          }
        } catch (_error) {
          setStatus("치지직 탭과 연결되지 않았습니다.", { autoResetMs: 2400 });
        }
      });
    }

    el.addNickname.addEventListener("click", async () => {
      await addTracked();
    });

    el.trackedInput.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      const raw = String(el.trackedInput.value || "").trim();
      if (!raw) return;
      await addTracked(raw);
    });
    el.trackedInput.addEventListener("input", () => {
      clearTrackedInputInvalid();
    });

    el.hiddenSelectAll.addEventListener("click", async () => {
      await selectAllHiddenNicknames();
    });

    if (el.hiddenCollapseToggle) {
      el.hiddenCollapseToggle.addEventListener("click", () => {
        state.hiddenChipsCollapsed = !state.hiddenChipsCollapsed;
        renderHiddenChips();
        updateActionButtonsState();
      });
    }

    el.hiddenAdvancedToggle.addEventListener("change", async () => {
      state.showHiddenAdvancedOptions =
        el.hiddenAdvancedToggle.checked === true;
      if (!state.showHiddenAdvancedOptions) {
        state.hiddenAdvancedSelectedSet.clear();
        clearHintPulse(el.hiddenChips);
        clearHintPulse(el.hiddenExcludeSelected);
      } else {
        triggerHintPulse(el.hiddenChips);
      }
      renderHiddenChips();
      updateActionButtonsState();
      await persistAndApply();
    });

    el.hiddenExcludeSelected.addEventListener("click", async () => {
      await excludeSelectedFromTrackedTargets();
    });

    el.hiddenClearAll.addEventListener("click", async () => {
      await clearAllHiddenNicknames();
    });

    if (el.hiddenPruneEmpty) {
      el.hiddenPruneEmpty.addEventListener("click", async () => {
        await pruneEmptyHiddenNicknames();
      });
    }

    if (el.hiddenAutoPruneToggle) {
      el.hiddenAutoPruneToggle.addEventListener("change", async () => {
        state.autoPruneManagedHiddenOnReconnect =
          el.hiddenAutoPruneToggle.checked === true;
        await persistAndApply();
      });
    }

    el.trackedDeleteAll.addEventListener("click", async () => {
      await deleteAllTrackedTargets();
    });

    el.trackedDeleteSelected.addEventListener("click", async () => {
      await deleteSelectedTrackedTargets();
    });

    if (el.trackedCollapseToggle) {
      el.trackedCollapseToggle.addEventListener("click", () => {
        state.trackedChipsCollapsed = !state.trackedChipsCollapsed;
        renderTrackedChips();
        updateActionButtonsState();
      });
    }

    if (el.excludeConfirmDialog) {
      el.excludeConfirmDialog.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    }
    if (el.excludeConfirmBackdrop) {
      el.excludeConfirmBackdrop.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveExcludeConfirmModal("cancel");
      });
    }
    if (el.excludeConfirmCancel) {
      el.excludeConfirmCancel.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveExcludeConfirmModal("cancel");
      });
    }
    if (el.excludeConfirmKeep) {
      el.excludeConfirmKeep.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveExcludeConfirmModal("keep");
      });
    }
    if (el.excludeConfirmPrune) {
      el.excludeConfirmPrune.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveExcludeConfirmModal("prune");
      });
    }

    if (el.genericConfirmDialog) {
      el.genericConfirmDialog.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    }
    if (el.genericConfirmBackdrop) {
      el.genericConfirmBackdrop.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveGenericConfirmModal(false);
      });
    }
    if (el.genericConfirmCancel) {
      el.genericConfirmCancel.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveGenericConfirmModal(false);
      });
    }
    if (el.genericConfirmOk) {
      el.genericConfirmOk.addEventListener("click", (event) => {
        event.stopPropagation();
        resolveGenericConfirmModal(true);
      });
    }
  }

  function render() {
    el.scopeInfo.textContent = `채널: ${state.scopeLabel || formatScopeLabel(state.scopeKey)}`;

    syncThemeToggleUi();
    el.hideChatBg.checked = state.hideChatBackground;
    el.hideChatBorder.checked = state.hideChatBorder;
    el.hidePopupBg.checked = state.hidePopupBackground;
    el.hidePopupBorder.checked = state.hidePopupBorder;
    el.hidePopupTime.checked = state.hidePopupTime;
    el.popupFontScale.value = String(
      normalizePopupFontScale(state.popupFontScale),
    );
    el.deleteWithoutConfirm.checked = state.deleteWithoutConfirm === true;
    el.hidePillButton.checked = state.hidePillButton === true;
    el.pillGlowEnabled.checked = state.pillGlowEnabled === true;
    el.enableSessionCache.checked = state.enableSessionCache === true;
    if (el.clearCurrentChannelSession) {
      const isChzzkChannelTab =
        typeof state.scopeKey === "string" &&
        state.scopeKey.startsWith("channel:");
      el.clearCurrentChannelSession.disabled = !isChzzkChannelTab;
      el.clearCurrentChannelSession.title = isChzzkChannelTab
        ? "현재 채널의 모아보기 채팅과 세션 캐시를 비웁니다"
        : "치지직 채널 탭에서만 사용할 수 있습니다";
    }
    el.hiddenAdvancedToggle.checked = state.showHiddenAdvancedOptions === true;
    if (el.hiddenAutoPruneToggle) {
      el.hiddenAutoPruneToggle.checked =
        state.autoPruneManagedHiddenOnReconnect === true;
    }
    updateTrackedAddAvailability();

    renderHiddenChips();
    renderTrackedChips();
    updateActionButtonsState();
  }

  function renderHiddenChips() {
    el.hiddenChips.innerHTML = "";

    const nicknameMetaMap = new Map();
    state.nicknameItems.forEach((item) => {
      const nickname = normalizeNickname(item && item.nickname);
      if (!nickname) return;
      const nextCount = Number(item && item.count) || 0;
      const roleBadges = normalizeRoleBadgeList(item && item.roleBadges);
      const cachedMeta = state.hiddenChipMetaByNickname.get(nickname);
      const previous = nicknameMetaMap.get(nickname);
      const mergedRoleBadges =
        roleBadges.length > 0
          ? roleBadges
          : previous && Array.isArray(previous.roleBadges)
            ? previous.roleBadges
            : cachedMeta && Array.isArray(cachedMeta.roleBadges)
              ? cachedMeta.roleBadges
              : [];
      nicknameMetaMap.set(nickname, {
        count: Math.max(0, nextCount),
        roleBadges: mergedRoleBadges,
      });
      if (mergedRoleBadges.length > 0) {
        state.hiddenChipMetaByNickname.set(nickname, {
          roleBadges: mergedRoleBadges,
        });
      }
    });

    const trackedNamesForHidden = new Set([...state.trackedScopedNicknameSet]);
    const names = new Set([
      ...nicknameMetaMap.keys(),
      ...state.hiddenChipMetaByNickname.keys(),
      ...state.hiddenSet,
      ...state.excludedCollectNicknameSet,
      ...state.managedHiddenNicknameSet,
      ...trackedNamesForHidden,
    ]);
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, "ko"));
    const validNameSet = new Set(sorted);
    Array.from(state.hiddenAdvancedSelectedSet).forEach((nickname) => {
      if (!validNameSet.has(nickname)) {
        state.hiddenAdvancedSelectedSet.delete(nickname);
      }
    });
    const hiddenCount = Array.from(state.hiddenSet).reduce((acc, nickname) => {
      if (names.has(nickname)) return acc + 1;
      return acc;
    }, 0);
    updateHiddenCountInfo(hiddenCount, sorted.length);

    if (sorted.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = state.connected
        ? "현재 채널에서 배지 채팅 닉네임이 없습니다."
        : "치지직 라이브/다시보기 탭에서 열면 닉네임 목록을 볼 수 있습니다.";
      el.hiddenChips.appendChild(empty);
      updateHiddenChipCollapseUi(0);
      return;
    }

    const fragment = document.createDocumentFragment();
    sorted.forEach((nickname) => {
      const chip = document.createElement("div");
      chip.className = "chip toggle";
      if (state.hiddenSet.has(nickname)) {
        chip.classList.add("active");
      }
      if (state.excludedCollectNicknameSet.has(nickname)) {
        chip.classList.add("is-excluded");
      }
      if (
        state.showHiddenAdvancedOptions &&
        state.hiddenAdvancedSelectedSet.has(nickname)
      ) {
        chip.classList.add("is-selected");
      }
      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "chip-toggle-btn";
      const fallbackMeta = state.hiddenChipMetaByNickname.get(nickname);
      const meta = nicknameMetaMap.get(nickname) || {
        count: 0,
        roleBadges:
          fallbackMeta && Array.isArray(fallbackMeta.roleBadges)
            ? fallbackMeta.roleBadges
            : [],
      };
      const count = meta.count > 0 ? ` (${meta.count})` : "";
      const roleBadges = Array.isArray(meta.roleBadges) ? meta.roleBadges : [];
      const leftBadges = roleBadges.filter((badge) => badge.type !== "partner");
      const rightPartnerBadges = roleBadges.filter(
        (badge) => badge.type === "partner",
      );

      if (leftBadges.length > 0) {
        const badgeWrap = document.createElement("span");
        badgeWrap.className = "chip-badge-list";
        leftBadges.forEach((badge) => {
          const iconUrl = String(
            badge && badge.iconUrl ? badge.iconUrl : "",
          ).trim();
          if (!iconUrl) return;
          const img = document.createElement("img");
          img.className = "chip-badge-icon";
          img.src = iconUrl;
          img.alt = String(badge && badge.label ? badge.label : "배지");
          img.loading = "lazy";
          img.decoding = "async";
          badgeWrap.appendChild(img);
        });
        if (badgeWrap.childNodes.length > 0) {
          toggleButton.appendChild(badgeWrap);
        }
      }

      const text = document.createElement("span");
      text.className = "chip-label";
      const hasObservedActivity = meta.count > 0;
      const colorableBadges = hasObservedActivity
        ? roleBadges
        : roleBadges.filter((badge) => badge.type !== "partner");
      const nicknameColor = getHiddenChipNicknameColor(colorableBadges);
      if (nicknameColor) {
        text.style.color = nicknameColor;
      }
      const nameText = document.createElement("span");
      nameText.className = "chip-name";
      nameText.textContent = nickname;
      text.appendChild(nameText);
      toggleButton.appendChild(text);

      if (rightPartnerBadges.length > 0) {
        const badgeWrap = document.createElement("span");
        badgeWrap.className = "chip-badge-list is-partner-right";
        rightPartnerBadges.forEach((badge) => {
          const iconUrl = String(
            badge && badge.iconUrl ? badge.iconUrl : "",
          ).trim();
          if (!iconUrl) return;
          const img = document.createElement("img");
          img.className = "chip-badge-icon";
          img.src = iconUrl;
          img.alt = String(badge && badge.label ? badge.label : "배지");
          img.loading = "lazy";
          img.decoding = "async";
          badgeWrap.appendChild(img);
        });
        if (badgeWrap.childNodes.length > 0) {
          text.appendChild(badgeWrap);
        }
      }

      if (count) {
        const countText = document.createElement("span");
        countText.className = "chip-count";
        countText.textContent = count;
        toggleButton.appendChild(countText);
      }
      if (state.showHiddenAdvancedOptions) {
        if (state.hiddenAdvancedSelectedSet.has(nickname)) {
          toggleButton.title = "모아보기 제외 선택됨 - 클릭하여 선택 해제";
        } else if (state.excludedCollectNicknameSet.has(nickname)) {
          toggleButton.title =
            "이미 모아보기 제외됨 - 클릭하여 제외 해제 대상으로 선택";
        } else {
          toggleButton.title = "클릭하여 모아보기 제외 대상으로 선택";
        }
      } else if (state.excludedCollectNicknameSet.has(nickname)) {
        toggleButton.title = "모아보기 제외됨";
      } else {
        toggleButton.title = state.hiddenSet.has(nickname)
          ? "현재 숨김 상태 - 클릭하면 해제"
          : "클릭하면 숨김";
      }

      toggleButton.addEventListener("click", async () => {
        if (
          !state.showHiddenAdvancedOptions &&
          state.excludedCollectNicknameSet.has(nickname)
        ) {
          state.showHiddenAdvancedOptions = true;
          state.hiddenAdvancedSelectedSet.clear();
          state.hiddenAdvancedSelectedSet.add(nickname);
          if (el.hiddenAdvancedToggle) {
            el.hiddenAdvancedToggle.checked = true;
          }
          await persistAndApply();
          renderHiddenChips();
          updateActionButtonsState();
          return;
        }

        if (state.showHiddenAdvancedOptions) {
          if (state.hiddenAdvancedSelectedSet.has(nickname)) {
            state.hiddenAdvancedSelectedSet.delete(nickname);
          } else {
            state.hiddenAdvancedSelectedSet.add(nickname);
          }
          renderHiddenChips();
          updateActionButtonsState();
          return;
        }

        if (state.hiddenSet.has(nickname)) {
          state.hiddenSet.delete(nickname);
        } else {
          state.hiddenSet.add(nickname);
          state.managedHiddenNicknameSet.add(nickname);
        }
        await persistAndApply();
        renderHiddenChips();
        updateActionButtonsState();
      });
      chip.appendChild(toggleButton);

      fragment.appendChild(chip);
    });

    el.hiddenChips.appendChild(fragment);
    updateHiddenChipCollapseUi(sorted.length);
  }

  function normalizeRoleBadgeList(raw) {
    if (!Array.isArray(raw)) return [];
    const allowedTypes = new Set([
      "channel_owner",
      "manager",
      "operator",
      "partner",
    ]);
    const seen = new Set();
    const list = [];

    raw.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const type = String(item.type || "")
        .trim()
        .toLowerCase();
      if (!allowedTypes.has(type)) return;
      const iconUrl = String(item.iconUrl || "").trim();
      if (!iconUrl) return;
      const key = `${type}|${iconUrl}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        type,
        iconUrl,
        label: String(item.label || "배지"),
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

  function normalizeHiddenChipMetaByScope(rawMap) {
    const normalized = {};
    if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
      return normalized;
    }

    Object.entries(rawMap).forEach(([scopeKey, value]) => {
      const key = String(scopeKey || "").trim();
      if (!key) return;
      const source = value && typeof value === "object" ? value : {};
      const byNickname = {};
      Object.entries(source).forEach(([nickname, badges]) => {
        const normalizedNickname = normalizeNickname(nickname);
        if (!normalizedNickname) return;
        const normalizedBadges = normalizeRoleBadgeList(badges);
        if (normalizedBadges.length <= 0) return;
        byNickname[normalizedNickname] = normalizedBadges;
      });
      normalized[key] = byNickname;
    });

    return normalized;
  }

  function serializeHiddenChipMetaByNickname(map) {
    const serialized = {};
    if (!(map instanceof Map)) return serialized;
    map.forEach((meta, nickname) => {
      const normalizedNickname = normalizeNickname(nickname);
      if (!normalizedNickname) return;
      const normalizedBadges = normalizeRoleBadgeList(
        meta && Array.isArray(meta.roleBadges) ? meta.roleBadges : [],
      );
      if (normalizedBadges.length <= 0) return;
      serialized[normalizedNickname] = normalizedBadges;
    });
    return serialized;
  }

  function mergeHiddenChipMetaFromNicknameItems(items) {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const nickname = normalizeNickname(item && item.nickname);
      if (!nickname) return;
      state.managedHiddenNicknameSet.add(nickname);
      const roleBadges = normalizeRoleBadgeList(item && item.roleBadges);
      if (roleBadges.length <= 0) return;
      state.hiddenChipMetaByNickname.set(nickname, {
        roleBadges,
      });
    });
  }

  function getHiddenChipNicknameColor(roleBadges) {
    if (!Array.isArray(roleBadges) || roleBadges.length === 0) {
      return "";
    }

    const hasType = (targetType) =>
      roleBadges.some(
        (badge) =>
          badge &&
          typeof badge === "object" &&
          String(badge.type || "").toLowerCase() === targetType,
      );

    if (hasType("channel_owner")) return "#d9b04f";
    if (hasType("operator")) return "#00c79b";
    if (hasType("manager")) return "#749ffe";
    if (hasType("partner")) return "#5ea6ff";
    return "";
  }

  function renderTrackedChips() {
    el.trackedChips.innerHTML = "";

    const items = getVisibleTrackedNicknameItems();
    updateTrackedCountInfo(items.length, getTrackedNicknameMaxCount());
    const validNicknameSet = new Set(items.map((item) => item.value));
    Array.from(state.selectedTrackedNicknameSet).forEach((nickname) => {
      if (!validNicknameSet.has(nickname)) {
        state.selectedTrackedNicknameSet.delete(nickname);
      }
    });
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "추가 대상 없음";
      el.trackedChips.appendChild(empty);
      updateTrackedChipCollapseUi(0);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "chip remove";
      if (state.selectedTrackedNicknameSet.has(item.value)) {
        chip.classList.add("is-selected");
      }

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "chip-toggle-btn";
      toggleButton.setAttribute("aria-label", `${item.value} 선택/해제`);
      toggleButton.title = state.selectedTrackedNicknameSet.has(item.value)
        ? "선택됨 - 클릭하여 선택 해제"
        : "클릭하여 선택";
      toggleButton.addEventListener("click", () => {
        if (state.selectedTrackedNicknameSet.has(item.value)) {
          state.selectedTrackedNicknameSet.delete(item.value);
          chip.classList.remove("is-selected");
          toggleButton.title = "클릭하여 선택";
        } else {
          state.selectedTrackedNicknameSet.add(item.value);
          chip.classList.add("is-selected");
          toggleButton.title = "선택됨 - 클릭하여 선택 해제";
        }
        updateActionButtonsState();
      });

      const text = document.createElement("span");
      text.textContent = item.value;
      toggleButton.appendChild(text);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "chip-remove-btn";
      removeButton.textContent = "×";
      removeButton.setAttribute("aria-label", "삭제");
      removeButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nickname = normalizeNickname(item.value);
        removeTrackedNicknameByScope(nickname, item.scope);
        state.selectedTrackedNicknameSet.delete(nickname);
        rebuildEffectiveTrackedNicknames();
        pruneHiddenNicknameIfOrphaned(nickname);
        await persistAndApply();
        pruneHiddenNicknameIfOrphaned(nickname);
        renderHiddenChips();
        renderTrackedChips();
        updateActionButtonsState();
      });

      chip.append(toggleButton, removeButton);
      fragment.appendChild(chip);
    });

    el.trackedChips.appendChild(fragment);
    updateTrackedChipCollapseUi(items.length);
  }

  async function addTracked(rawValue = "") {
    if (!canUseTrackedAdd()) {
      markTrackedInputInvalid();
      setStatus("닉네임 추가는 치지직 라이브/다시보기 탭에서만 가능합니다.", {
        autoResetMs: 2600,
        variant: "error",
      });
      return;
    }

    const raw = String(rawValue || el.trackedInput.value || "").trim();
    if (!raw) return;

    const nickname = normalizeNickname(raw);
    if (!nickname) return;
    const targetSet = state.trackedScopedNicknameSet;
    if (targetSet.has(nickname)) {
      markTrackedInputInvalid();
      setStatus("이미 등록된 닉네임입니다.", {
        autoResetMs: 1800,
        variant: "error",
      });
      return;
    }
    if (
      state.trackedScopedNicknameSet.size >= MAX_TRACKED_NICKNAMES_PER_SCOPE
    ) {
      markTrackedInputInvalid();
      setStatus(
        `채널 대상은 최대 ${MAX_TRACKED_NICKNAMES_PER_SCOPE}개까지 등록할 수 있습니다.`,
        { autoResetMs: 2200, variant: "error" },
      );
      return;
    }

    if (TRACKED_NICKNAME_ALLOWLIST.has(nickname)) {
      clearTrackedInputInvalid();
      targetSet.add(nickname);
      rebuildEffectiveTrackedNicknames();
      el.trackedInput.value = "";
      await persistAndApply({
        forceTrackedNicknames: [nickname],
      });
      renderHiddenChips();
      renderTrackedChips();
      updateActionButtonsState();
      setStatus("예외 닉네임으로 추가되었습니다.", { autoResetMs: 1800 });
      return;
    }

    setStatus("스트리머인지 확인 중...");
    const verification = await verifyLiveStreamerByNickname(nickname);
    if (!verification.ok) {
      markTrackedInputInvalid();
      setStatus(verification.message, {
        autoResetMs: 2600,
        variant: "error",
      });
      return;
    }

    clearTrackedInputInvalid();
    targetSet.add(nickname);
    rebuildEffectiveTrackedNicknames();

    if (verification.verifiedMark === true && OFFICIAL_MARK_URL) {
      const existing = state.hiddenChipMetaByNickname.get(nickname);
      const existingBadges =
        existing && Array.isArray(existing.roleBadges)
          ? existing.roleBadges
          : [];
      const hasPartner = existingBadges.some(
        (badge) => badge.type === "partner",
      );
      if (!hasPartner) {
        const partnerBadge = {
          type: "partner",
          iconUrl: OFFICIAL_MARK_URL,
          label: "파트너",
        };
        state.hiddenChipMetaByNickname.set(nickname, {
          roleBadges: normalizeRoleBadgeList([...existingBadges, partnerBadge]),
        });
      }
    }

    el.trackedInput.value = "";
    const forceTrackedNicknames = [normalizeNickname(raw)];
    await persistAndApply({
      forceTrackedNicknames,
    });
    renderHiddenChips();
    renderTrackedChips();
    updateActionButtonsState();
  }

  function getCurrentChannelNicknames() {
    const names = new Set();
    state.nicknameItems.forEach((item) => {
      const nickname = normalizeNickname(item && item.nickname);
      if (!nickname) return;
      const count = Number(item && item.count) || 0;
      if (count <= 0) return;
      names.add(nickname);
    });
    return names;
  }

  async function selectAllHiddenNicknames() {
    const names = getCurrentChannelNicknames();
    if (names.size === 0) return;
    state.hiddenSet = new Set([...state.hiddenSet, ...names]);
    names.forEach((nickname) => state.managedHiddenNicknameSet.add(nickname));
    await persistAndApply();
    renderHiddenChips();
    updateActionButtonsState();
  }

  async function clearAllHiddenNicknames() {
    if (state.hiddenSet.size === 0) return;
    state.hiddenSet.clear();
    await persistAndApply();
    renderHiddenChips();
    updateActionButtonsState();
  }

  async function pruneEmptyHiddenNicknames() {
    const currentNicknames = getCurrentChannelNicknames();
    const removed = [];
    Array.from(state.managedHiddenNicknameSet).forEach((nickname) => {
      if (currentNicknames.has(nickname)) return;
      if (state.hiddenSet.has(nickname)) return;
      if (state.excludedCollectNicknameSet.has(nickname)) return;
      if (state.trackedScopedNicknameSet.has(nickname)) return;
      state.managedHiddenNicknameSet.delete(nickname);
      state.hiddenChipMetaByNickname.delete(nickname);
      removed.push(nickname);
    });
    if (removed.length === 0) {
      setStatus("정리할 미활동 닉네임이 없습니다.", { autoResetMs: 1800 });
      return;
    }
    await persistAndApply();
    renderHiddenChips();
    updateActionButtonsState();
    setStatus(`미활동 닉네임 ${removed.length}개 정리됨`, {
      autoResetMs: 1800,
    });
  }

  async function excludeSelectedFromTrackedTargets() {
    if (state.hiddenAdvancedSelectedSet.size === 0) return;
    const selectedNicknames = Array.from(state.hiddenAdvancedSelectedSet);
    const nextExcluded = new Set(state.excludedCollectNicknameSet);
    const nextHidden = new Set(state.hiddenSet);
    let changed = false;
    let addedCount = 0;
    let addedHiddenCount = 0;
    let removedCount = 0;
    let removedHiddenCount = 0;

    selectedNicknames.forEach((nickname) => {
      const normalized = normalizeNickname(nickname);
      if (!normalized) return;
      if (nextExcluded.has(normalized)) {
        nextExcluded.delete(normalized);
        if (nextHidden.has(normalized)) {
          nextHidden.delete(normalized);
          removedHiddenCount += 1;
        }
        removedCount += 1;
        changed = true;
        return;
      }
      nextExcluded.add(normalized);
      state.managedHiddenNicknameSet.add(normalized);
      if (!nextHidden.has(normalized)) {
        nextHidden.add(normalized);
        addedHiddenCount += 1;
      }
      addedCount += 1;
      changed = true;
    });

    if (!changed) {
      await persistAndApply();
      render();
      return;
    }

    let pruneExcludedEntries = false;
    if (addedCount > 0) {
      const action = await askExcludeConfirmAction();
      if (action === "cancel") {
        return;
      }
      pruneExcludedEntries = action === "prune";
    }

    state.excludedCollectNicknameSet = nextExcluded;
    state.hiddenSet = nextHidden;
    state.hiddenAdvancedSelectedSet.clear();
    state.showHiddenAdvancedOptions = false;

    await persistAndApply({ pruneExcludedEntries });
    render();
    if (addedCount > 0 && removedCount > 0) {
      setStatus(
        `모아보기 제외 ${addedCount}개(숨김 ${addedHiddenCount}개 포함), 제외 해제 ${removedCount}개(숨김 해제 ${removedHiddenCount}개 포함) 적용됨`,
        { autoResetMs: 1800 },
      );
      return;
    }
    if (addedCount > 0) {
      setStatus(
        `선택한 닉네임 ${addedCount}개를 모아보기 제외했고 숨김도 함께 적용했습니다.`,
        {
          autoResetMs: 1800,
        },
      );
      return;
    }
    setStatus(
      `선택한 닉네임 ${removedCount}개의 제외를 해제했고 숨김 ${removedHiddenCount}개도 함께 해제했습니다.`,
      {
        autoResetMs: 1800,
      },
    );
  }

  async function deleteAllTrackedTargets() {
    const visibleItems = getVisibleTrackedNicknameItems();
    if (visibleItems.length === 0) return;
    const removedNicknames = new Set();
    visibleItems.forEach((item) => {
      const nickname = normalizeNickname(item.value);
      if (!nickname) return;
      removeTrackedNicknameByScope(nickname, item.scope);
      removedNicknames.add(nickname);
    });
    state.selectedTrackedNicknameSet.clear();
    rebuildEffectiveTrackedNicknames();
    removedNicknames.forEach((nickname) => {
      pruneHiddenNicknameIfOrphaned(nickname);
    });
    await persistAndApply();
    removedNicknames.forEach((nickname) => {
      pruneHiddenNicknameIfOrphaned(nickname);
    });
    renderHiddenChips();
    renderTrackedChips();
    updateActionButtonsState();
  }

  async function deleteSelectedTrackedTargets() {
    if (state.selectedTrackedNicknameSet.size === 0) return;
    const visibleScopeMap = new Map();
    getVisibleTrackedNicknameItems().forEach((item) => {
      const nickname = normalizeNickname(item.value);
      if (!nickname) return;
      visibleScopeMap.set(nickname, item.scope);
    });
    const selectedNicknames = Array.from(state.selectedTrackedNicknameSet);
    let changed = false;
    selectedNicknames.forEach((nickname) => {
      const normalized = normalizeNickname(nickname);
      if (!normalized) return;
      const targetScope =
        visibleScopeMap.get(normalized) || TRACKED_SCOPE_CHANNEL;
      const beforeScoped = state.trackedScopedNicknameSet.has(normalized);
      removeTrackedNicknameByScope(normalized, targetScope);
      const afterScoped = state.trackedScopedNicknameSet.has(normalized);
      if (beforeScoped !== afterScoped) {
        changed = true;
      }
      if (!afterScoped) {
        pruneHiddenNicknameIfOrphaned(normalized);
      }
    });
    const prunedNicknames = selectedNicknames
      .map((nickname) => normalizeNickname(nickname))
      .filter(Boolean);
    state.selectedTrackedNicknameSet.clear();
    if (!changed) {
      renderTrackedChips();
      updateActionButtonsState();
      return;
    }
    rebuildEffectiveTrackedNicknames();
    await persistAndApply();
    prunedNicknames.forEach((nickname) => {
      pruneHiddenNicknameIfOrphaned(nickname);
    });
    renderHiddenChips();
    renderTrackedChips();
    updateActionButtonsState();
  }

  function pruneHiddenNicknameIfOrphaned(nickname) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return;
    const currentNicknames = getCurrentChannelNicknames();
    if (currentNicknames.has(normalized)) return;
    state.hiddenSet.delete(normalized);
    state.excludedCollectNicknameSet.delete(normalized);
    state.hiddenAdvancedSelectedSet.delete(normalized);
    state.managedHiddenNicknameSet.delete(normalized);
    state.hiddenChipMetaByNickname.delete(normalized);
  }

  function updateActionButtonsState() {
    const currentNicknames = getCurrentChannelNicknames();
    const hasNicknames = currentNicknames.size > 0;

    let hasUnhidden = false;
    let hasHidden = state.hiddenSet.size > 0;
    currentNicknames.forEach((nickname) => {
      if (!state.hiddenSet.has(nickname)) {
        hasUnhidden = true;
      }
    });

    if (el.hiddenSelectAll) {
      el.hiddenSelectAll.disabled = !hasNicknames || !hasUnhidden;
    }
    if (el.hiddenClearAll) {
      el.hiddenClearAll.disabled = !hasHidden;
    }
    if (el.hiddenPruneEmpty) {
      let hasPrunable = false;
      state.managedHiddenNicknameSet.forEach((nickname) => {
        if (hasPrunable) return;
        if (currentNicknames.has(nickname)) return;
        if (state.hiddenSet.has(nickname)) return;
        if (state.excludedCollectNicknameSet.has(nickname)) return;
        if (state.trackedScopedNicknameSet.has(nickname)) return;
        hasPrunable = true;
      });
      el.hiddenPruneEmpty.disabled = !hasPrunable;
    }
    if (el.hiddenAdvancedToggle) {
      el.hiddenAdvancedToggle.disabled = !hasNicknames;
    }
    if (el.hiddenExcludeSelected) {
      el.hiddenExcludeSelected.disabled =
        !hasNicknames ||
        state.showHiddenAdvancedOptions !== true ||
        state.hiddenAdvancedSelectedSet.size === 0;
    }
    const prevSize = state.lastHiddenAdvancedSelectedSize || 0;
    const currSize = state.hiddenAdvancedSelectedSet.size;
    if (state.showHiddenAdvancedOptions && prevSize === 0 && currSize > 0) {
      clearHintPulse(el.hiddenChips);
      triggerHintPulse(el.hiddenExcludeSelected);
    } else if (currSize === 0 && prevSize > 0) {
      clearHintPulse(el.hiddenExcludeSelected);
    }
    state.lastHiddenAdvancedSelectedSize = currSize;
    updateHiddenExcludeActionButtonLabel();
    const visibleTrackedCount = getVisibleTrackedNicknameItems().length;
    if (el.trackedDeleteAll) {
      el.trackedDeleteAll.disabled = visibleTrackedCount === 0;
    }
    if (el.trackedDeleteSelected) {
      el.trackedDeleteSelected.disabled =
        state.selectedTrackedNicknameSet.size === 0;
    }
  }

  function updateHiddenChipCollapseUi(itemCount) {
    if (!el.hiddenChips || !el.hiddenCollapseToggle) return;
    const total = Math.max(0, Number(itemCount) || 0);
    const collapsible = total > CHIP_COLLAPSE_THRESHOLD;
    if (!collapsible) {
      state.hiddenChipsCollapsed = true;
    }
    const collapsed = collapsible && state.hiddenChipsCollapsed;
    el.hiddenChips.classList.toggle("is-collapsible", collapsible);
    el.hiddenChips.classList.toggle("is-collapsed", collapsed);
    el.hiddenCollapseToggle.style.display = collapsible
      ? "inline-flex"
      : "none";
    el.hiddenCollapseToggle.disabled = !collapsible;
    el.hiddenCollapseToggle.setAttribute("aria-expanded", String(!collapsed));
    el.hiddenCollapseToggle.textContent = collapsed ? "펼치기" : "접기";
  }

  function updateTrackedChipCollapseUi(itemCount) {
    if (!el.trackedChips || !el.trackedCollapseToggle) return;
    const total = Math.max(0, Number(itemCount) || 0);
    const collapsible = total > CHIP_COLLAPSE_THRESHOLD;
    if (!collapsible) {
      state.trackedChipsCollapsed = true;
    }
    const collapsed = collapsible && state.trackedChipsCollapsed;
    el.trackedChips.classList.toggle("is-collapsible", collapsible);
    el.trackedChips.classList.toggle("is-collapsed", collapsed);
    el.trackedCollapseToggle.style.display = collapsible
      ? "inline-flex"
      : "none";
    el.trackedCollapseToggle.disabled = !collapsible;
    el.trackedCollapseToggle.setAttribute("aria-expanded", String(!collapsed));
    el.trackedCollapseToggle.textContent = collapsed ? "펼치기" : "접기";
  }

  function getVisibleTrackedNicknameItems() {
    const map = new Map();
    Array.from(state.trackedScopedNicknameSet)
      .map((value) => normalizeNickname(value))
      .filter(Boolean)
      .forEach((nickname) => {
        map.set(nickname, {
          value: nickname,
          scope: TRACKED_SCOPE_CHANNEL,
        });
      });

    return Array.from(map.values()).sort((a, b) =>
      a.value.localeCompare(b.value, "ko"),
    );
  }

  function removeTrackedNicknameByScope(nickname, scope) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return;
    state.trackedScopedNicknameSet.delete(normalized);
  }

  function updateHiddenExcludeActionButtonLabel() {
    if (!el.hiddenExcludeSelected) return;

    if (
      state.showHiddenAdvancedOptions !== true ||
      state.hiddenAdvancedSelectedSet.size === 0
    ) {
      el.hiddenExcludeSelected.textContent = "모아보기 제외";
      return;
    }

    let selectedExcludedCount = 0;
    let selectedNormalCount = 0;
    state.hiddenAdvancedSelectedSet.forEach((nickname) => {
      const normalized = normalizeNickname(nickname);
      if (!normalized) return;
      if (state.excludedCollectNicknameSet.has(normalized)) {
        selectedExcludedCount += 1;
      } else {
        selectedNormalCount += 1;
      }
    });

    if (selectedExcludedCount > 0 && selectedNormalCount === 0) {
      el.hiddenExcludeSelected.textContent = "다시 모아보기";
      return;
    }
    if (selectedNormalCount > 0 && selectedExcludedCount === 0) {
      el.hiddenExcludeSelected.textContent = "모아보기 제외";
      return;
    }
    el.hiddenExcludeSelected.textContent = "모아보기 제외/해제";
  }

  async function persistAndApply(options = {}) {
    updateRawSettingsFromState();
    await setStorageLocal(STORAGE_SETTINGS_KEY, state.rawSettings);

    const forceTrackedNicknames = Array.isArray(options.forceTrackedNicknames)
      ? options.forceTrackedNicknames
          .map((value) => normalizeNickname(value))
          .filter(Boolean)
      : [];
    const pruneExcludedEntries = options.pruneExcludedEntries === true;

    if (!Number.isInteger(state.tabId)) {
      setStatus("설정 저장됨", { autoResetMs: 1600 });
      return;
    }

    const payload = {
      hideChatBackground: state.hideChatBackground,
      hideChatBorder: state.hideChatBorder,
      hidePopupBackground: state.hidePopupBackground,
      hidePopupBorder: state.hidePopupBorder,
      hidePopupTime: state.hidePopupTime,
      popupFontScale: normalizePopupFontScale(state.popupFontScale),
      deleteWithoutConfirm: state.deleteWithoutConfirm === true,
      hidePillButton: state.hidePillButton === true,
      pillGlowEnabled: state.pillGlowEnabled,
      enableSessionCache: state.enableSessionCache,
      newTrackedNicknames: forceTrackedNicknames,
      hiddenPillNicknames: Array.from(state.hiddenSet),
      excludedCollectNicknames: Array.from(state.excludedCollectNicknameSet),
      trackedNicknames: Array.from(state.trackedScopedNicknameSet),
      trackedGlobalNicknames: [],
      pruneExcludedEntries,
    };

    try {
      const response = await chrome.tabs.sendMessage(state.tabId, {
        type: "chzzk_badge_moa_apply_settings",
        payload,
      });
      if (response && response.ok) {
        state.connected = true;
        const context = await getContextFromContentScript();
        if (context && context.ok) {
          syncScopeFromContext(context);
        }
        if (context && context.ok && Array.isArray(context.nicknameItems)) {
          state.nicknameItems = context.nicknameItems;
          mergeHiddenChipMetaFromNicknameItems(state.nicknameItems);
        }
        setStatus("설정 저장 및 즉시 반영됨", { autoResetMs: 1600 });
      } else {
        setStatus("설정 저장됨", { autoResetMs: 1600 });
      }
    } catch (_error) {
      const wasConnected = state.connected;
      state.connected = false;
      if (wasConnected) {
        setStatus("설정 저장됨 (탭 즉시 반영 실패)", { autoResetMs: 2400 });
      } else {
        setStatus("설정 저장됨", { autoResetMs: 1600 });
      }
    }
  }

  async function getContextFromContentScript() {
    if (!Number.isInteger(state.tabId)) return null;
    try {
      return await chrome.tabs.sendMessage(state.tabId, {
        type: "chzzk_badge_moa_get_settings_context",
      });
    } catch (_error) {
      return null;
    }
  }

  function syncScopeFromContext(context) {
    if (!context || typeof context !== "object") return;
    const nextScopeKey = String(context.scopeKey || "").trim();
    if (!nextScopeKey || nextScopeKey === state.scopeKey) return;
    state.scopeKey = nextScopeKey;
    state.scopeLabel = formatScopeLabel(state.scopeKey);
    applyStateFromRawForScope(state.scopeKey);
  }

  function applyStateFromContextSettings(settings) {
    state.hideChatBackground = settings.hideChatBackground === true;
    state.hideChatBorder = settings.hideChatBorder === true;
    state.hidePopupBackground = settings.hidePopupBackground === true;
    state.hidePopupBorder = settings.hidePopupBorder === true;
    state.hidePopupTime = settings.hidePopupTime === true;
    state.popupFontScale = normalizePopupFontScale(settings.popupFontScale);
    state.deleteWithoutConfirm = settings.deleteWithoutConfirm === true;
    state.hidePillButton = settings.hidePillButton === true;
    state.pillGlowEnabled = settings.pillGlowEnabled !== false;
    if (typeof settings.enableSessionCache === "boolean") {
      state.enableSessionCache = settings.enableSessionCache;
    }
    if (typeof settings.autoPruneManagedHiddenOnReconnect === "boolean") {
      state.autoPruneManagedHiddenOnReconnect =
        settings.autoPruneManagedHiddenOnReconnect;
    }
    state.showHiddenAdvancedOptions = false;
    // 확장 업데이트 직후에는 현재 탭의 구버전 content script 컨텍스트가 남아
    // hidden/tracked 설정을 잘못 덮어쓰는 경우가 있어, 저장값이 있을 때는 보존한다.
    const raw =
      state.rawSettings && typeof state.rawSettings === "object"
        ? state.rawSettings
        : {};
    const hiddenByScope =
      raw && typeof raw.hiddenPillNicknamesByChannel === "object"
        ? raw.hiddenPillNicknamesByChannel
        : {};
    const trackedByScope =
      raw && typeof raw.trackedTargetsByChannel === "object"
        ? raw.trackedTargetsByChannel
        : {};
    const excludedByScope =
      raw && typeof raw.excludedCollectNicknamesByChannel === "object"
        ? raw.excludedCollectNicknamesByChannel
        : {};
    const hasScopedHidden = Array.isArray(hiddenByScope[state.scopeKey]);
    const scopedTracked =
      trackedByScope[state.scopeKey] &&
      typeof trackedByScope[state.scopeKey] === "object"
        ? trackedByScope[state.scopeKey]
        : null;
    const hasScopedTracked =
      !!scopedTracked && Array.isArray(scopedTracked.nicknames);
    const hasScopedExcluded = Array.isArray(excludedByScope[state.scopeKey]);

    if (!hasScopedHidden) {
      const hidden = Array.isArray(settings.hiddenPillNicknames)
        ? settings.hiddenPillNicknames
        : [];
      state.hiddenSet = new Set(
        hidden.map((value) => normalizeNickname(value)).filter(Boolean),
      );
    }

    if (!hasScopedTracked) {
      const trackedScopedNicknames = Array.isArray(
        settings.trackedScopedNicknames,
      )
        ? settings.trackedScopedNicknames
        : Array.isArray(settings.trackedNicknames)
          ? settings.trackedNicknames
          : [];
      state.trackedScopedNicknameSet = new Set(
        trackedScopedNicknames
          .map((value) => normalizeNickname(value))
          .filter(Boolean),
      );
      rebuildEffectiveTrackedNicknames();
    }

    if (!hasScopedExcluded) {
      const excluded = Array.isArray(settings.excludedCollectNicknames)
        ? settings.excludedCollectNicknames
        : [];
      state.excludedCollectNicknameSet = new Set(
        excluded.map((value) => normalizeNickname(value)).filter(Boolean),
      );
    }
  }

  function applyStateFromRawForScope(scopeKey) {
    const raw = state.rawSettings;
    const hiddenByScope =
      raw && typeof raw.hiddenPillNicknamesByChannel === "object"
        ? raw.hiddenPillNicknamesByChannel
        : {};
    const trackedByScope =
      raw && typeof raw.trackedTargetsByChannel === "object"
        ? raw.trackedTargetsByChannel
        : {};
    const excludedByScope =
      raw && typeof raw.excludedCollectNicknamesByChannel === "object"
        ? raw.excludedCollectNicknamesByChannel
        : {};
    const hiddenChipMetaByScope = normalizeHiddenChipMetaByScope(
      raw && typeof raw.hiddenChipRoleBadgesByChannel === "object"
        ? raw.hiddenChipRoleBadgesByChannel
        : {},
    );
    const managedHiddenByScope =
      raw && typeof raw.managedHiddenNicknamesByChannel === "object"
        ? raw.managedHiddenNicknamesByChannel
        : {};

    const hidden = Array.isArray(hiddenByScope[scopeKey])
      ? hiddenByScope[scopeKey]
      : [];
    const tracked =
      trackedByScope[scopeKey] && typeof trackedByScope[scopeKey] === "object"
        ? trackedByScope[scopeKey]
        : {};
    const excluded = Array.isArray(excludedByScope[scopeKey])
      ? excludedByScope[scopeKey]
      : [];
    const hiddenChipMetaByNickname =
      hiddenChipMetaByScope[scopeKey] &&
      typeof hiddenChipMetaByScope[scopeKey] === "object"
        ? hiddenChipMetaByScope[scopeKey]
        : {};

    state.hideChatBackground = raw.hideChatBackground === true;
    state.hideChatBorder = raw.hideChatBorder === true;
    state.hidePopupBackground = raw.hidePopupBackground === true;
    state.hidePopupBorder = raw.hidePopupBorder === true;
    state.hidePopupTime = raw.hidePopupTime === true;
    state.popupFontScale = normalizePopupFontScale(raw.popupFontScale);
    if (typeof raw.deleteWithoutConfirm === "boolean") {
      state.deleteWithoutConfirm = raw.deleteWithoutConfirm === true;
    } else if (typeof raw.confirmDeleteDialog === "boolean") {
      state.deleteWithoutConfirm = raw.confirmDeleteDialog !== true;
    } else {
      state.deleteWithoutConfirm = false;
    }
    state.hidePillButton = raw.hidePillButton === true;
    state.pillGlowEnabled = raw.pillGlowEnabled !== false;
    state.enableSessionCache = raw.enableSessionCache === true;
    state.autoPruneManagedHiddenOnReconnect =
      raw.autoPruneManagedHiddenOnReconnect === true;
    state.showHiddenAdvancedOptions = false;
    state.popupTheme = normalizePopupTheme(raw.popupTheme);

    state.hiddenSet = new Set(
      hidden.map((value) => normalizeNickname(value)).filter(Boolean),
    );
    state.trackedScopedNicknameSet = new Set(
      (Array.isArray(tracked.nicknames) ? tracked.nicknames : [])
        .map((value) => normalizeNickname(value))
        .filter(Boolean),
    );
    state.excludedCollectNicknameSet = new Set(
      excluded.map((value) => normalizeNickname(value)).filter(Boolean),
    );
    const managedHidden = Array.isArray(managedHiddenByScope[scopeKey])
      ? managedHiddenByScope[scopeKey]
      : [];
    state.managedHiddenNicknameSet = new Set(
      managedHidden.map((value) => normalizeNickname(value)).filter(Boolean),
    );
    state.hiddenSet.forEach((nickname) =>
      state.managedHiddenNicknameSet.add(nickname),
    );
    state.excludedCollectNicknameSet.forEach((nickname) =>
      state.managedHiddenNicknameSet.add(nickname),
    );
    state.hiddenChipMetaByNickname = new Map(
      Object.entries(hiddenChipMetaByNickname).map(([nickname, roleBadges]) => [
        nickname,
        { roleBadges: normalizeRoleBadgeList(roleBadges) },
      ]),
    );
    rebuildEffectiveTrackedNicknames();
  }

  function updateRawSettingsFromState() {
    const raw = normalizeRawSettings(state.rawSettings);

    if (
      !raw.hiddenPillNicknamesByChannel ||
      typeof raw.hiddenPillNicknamesByChannel !== "object"
    ) {
      raw.hiddenPillNicknamesByChannel = {};
    }
    if (
      !raw.trackedTargetsByChannel ||
      typeof raw.trackedTargetsByChannel !== "object"
    ) {
      raw.trackedTargetsByChannel = {};
    }
    if (
      !raw.excludedCollectNicknamesByChannel ||
      typeof raw.excludedCollectNicknamesByChannel !== "object"
    ) {
      raw.excludedCollectNicknamesByChannel = {};
    }
    if (
      !raw.hiddenChipRoleBadgesByChannel ||
      typeof raw.hiddenChipRoleBadgesByChannel !== "object"
    ) {
      raw.hiddenChipRoleBadgesByChannel = {};
    }
    if (
      !raw.managedHiddenNicknamesByChannel ||
      typeof raw.managedHiddenNicknamesByChannel !== "object"
    ) {
      raw.managedHiddenNicknamesByChannel = {};
    }
    const existingHiddenChipMetaByScope = normalizeHiddenChipMetaByScope(
      raw.hiddenChipRoleBadgesByChannel,
    );

    raw.hideChatBackground = state.hideChatBackground === true;
    raw.hideChatBorder = state.hideChatBorder === true;
    raw.hidePopupBackground = state.hidePopupBackground === true;
    raw.hidePopupBorder = state.hidePopupBorder === true;
    raw.hidePopupTime = state.hidePopupTime === true;
    raw.popupFontScale = normalizePopupFontScale(state.popupFontScale);
    raw.deleteWithoutConfirm = state.deleteWithoutConfirm === true;
    delete raw.confirmDeleteDialog;
    raw.hidePillButton = state.hidePillButton === true;
    raw.pillGlowEnabled = state.pillGlowEnabled !== false;
    raw.enableSessionCache = state.enableSessionCache === true;
    raw.autoPruneManagedHiddenOnReconnect =
      state.autoPruneManagedHiddenOnReconnect === true;
    delete raw.showHiddenAdvancedOptions;
    raw.popupTheme = normalizePopupTheme(state.popupTheme);

    raw.hiddenPillNicknamesByChannel[state.scopeKey] = Array.from(
      state.hiddenSet,
    );
    raw.trackedTargetsByChannel[state.scopeKey] = {
      nicknames: Array.from(state.trackedScopedNicknameSet),
    };
    raw.excludedCollectNicknamesByChannel[state.scopeKey] = Array.from(
      state.excludedCollectNicknameSet,
    );
    raw.managedHiddenNicknamesByChannel[state.scopeKey] = Array.from(
      state.managedHiddenNicknameSet,
    );
    raw.hiddenChipRoleBadgesByChannel = {
      ...existingHiddenChipMetaByScope,
      [state.scopeKey]: serializeHiddenChipMetaByNickname(
        state.hiddenChipMetaByNickname,
      ),
    };
    raw.trackedGlobalNicknames = [];

    state.rawSettings = raw;
  }

  function normalizeRawSettings(raw) {
    if (!raw || typeof raw !== "object") {
      return {};
    }
    return { ...raw };
  }

  function normalizeNickname(value) {
    return String(value || "").trim();
  }

  function getTrackedNicknameMaxCount() {
    return MAX_TRACKED_NICKNAMES_PER_SCOPE;
  }

  function updateHiddenCountInfo(current, max) {
    if (!el.hiddenCountInfo) return;
    const safeCurrent = Math.max(0, Number(current) || 0);
    const safeMax = Math.max(0, Number(max) || 0);
    el.hiddenCountInfo.textContent = `(${safeCurrent}/${safeMax})`;
  }

  function updateTrackedCountInfo(current, max) {
    if (!el.trackedCountInfo) return;
    const safeCurrent = Math.max(0, Number(current) || 0);
    const safeMax = Math.max(0, Number(max) || 0);
    el.trackedCountInfo.textContent = `(${safeCurrent}/${safeMax})`;
  }

  function isLiveTabUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      if (parsed.hostname !== "chzzk.naver.com") return false;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return false;
      return parts[0] === "live" && String(parts[1] || "").trim().length > 0;
    } catch (_error) {
      return false;
    }
  }

  function isVodTabUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      if (parsed.hostname !== "chzzk.naver.com") return false;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return false;
      return parts[0] === "video" && String(parts[1] || "").trim().length > 0;
    } catch (_error) {
      return false;
    }
  }

  function isChannelHomeTabUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      if (parsed.hostname !== "chzzk.naver.com") return false;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return false;
      return /^[a-f0-9]{20,}$/.test(parts[0]);
    } catch (_error) {
      return false;
    }
  }

  function canUseTrackedAdd() {
    return (
      isLiveTabUrl(state.tabUrl) ||
      isVodTabUrl(state.tabUrl) ||
      isChannelHomeTabUrl(state.tabUrl)
    );
  }

  function updateTrackedAddAvailability() {
    if (!el.trackedInput || !el.addNickname) return;
    const enabled = canUseTrackedAdd();
    el.trackedInput.disabled = !enabled;
    el.addNickname.disabled = !enabled;
    if (enabled) {
      el.trackedInput.placeholder = "닉네임 입력 (스트리머만 추가 가능)";
      return;
    }
    el.trackedInput.placeholder =
      "치지직 채널/라이브/다시보기 탭에서만 추가 가능";
  }

  function rebuildEffectiveTrackedNicknames() {
    state.trackedNicknameSet = new Set([...state.trackedScopedNicknameSet]);
  }

  function normalizeChannelName(value) {
    return normalizeNickname(value);
  }

  async function verifyLiveStreamerByNickname(nickname) {
    const searchResult = await fetchExactChannelIdByNickname(nickname);
    if (!searchResult.ok) {
      if (searchResult.reason === "EMPTY_RESULT") {
        return {
          ok: false,
          message: "검색 결과가 없습니다. 닉네임을 다시 확인해 주세요.",
        };
      }
      if (searchResult.reason === "NO_EXACT_MATCH") {
        return {
          ok: false,
          message:
            "검색 결과에 정확히 일치하는 채널명이 없어 등록할 수 없습니다.",
        };
      }
      if (searchResult.reason === "API_ERROR") {
        return {
          ok: false,
          message: "채널 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      return {
        ok: false,
        message: "해당 닉네임과 일치하는 채널을 찾지 못했습니다.",
      };
    }

    const liveStatus = await fetchLiveStatusByChannelId(searchResult.channelId);
    if (!liveStatus.ok) {
      return {
        ok: false,
        message: "스트리머 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }

    const channelHistory =
      liveStatus.payload &&
      typeof liveStatus.payload === "object" &&
      liveStatus.payload.content &&
      typeof liveStatus.payload.content === "object" &&
      liveStatus.payload.content.channelHistory &&
      typeof liveStatus.payload.content.channelHistory === "object"
        ? liveStatus.payload.content.channelHistory
        : null;
    const firstLiveDate = channelHistory
      ? String(channelHistory.firstLiveDate || "").trim()
      : "";
    const totalLiveHours = channelHistory
      ? Number(channelHistory.totalLiveHours || 0)
      : 0;
    const hasStreamingHistory = Boolean(firstLiveDate) || totalLiveHours > 0;

    if (!hasStreamingHistory) {
      return {
        ok: false,
        message: "스트리머만 추가할 수 있습니다.",
      };
    }

    return { ok: true, verifiedMark: searchResult.verifiedMark === true };
  }

  async function fetchExactChannelIdByNickname(nickname) {
    const keyword = encodeURIComponent(String(nickname || "").trim());
    if (!keyword) return { ok: false, channelId: "", reason: "INVALID_INPUT" };

    const url =
      `${CHZZK_API_BASE}/service/v1/search/channels` +
      `?keyword=${keyword}&offset=0&size=${SEARCH_CHANNEL_PAGE_SIZE}&withFirstChannelContent=true`;

    try {
      const response = await fetch(url);
      if (!response.ok)
        return { ok: false, channelId: "", reason: "API_ERROR" };
      const json = await response.json();
      if (!json || Number(json.code) !== 200) {
        return { ok: false, channelId: "", reason: "API_ERROR" };
      }
      const data =
        json.content &&
        Array.isArray(json.content.data) &&
        json.content.data.length > 0
          ? json.content.data
          : [];
      if (data.length === 0) {
        return { ok: false, channelId: "", reason: "EMPTY_RESULT" };
      }
      const normalizedTarget = normalizeChannelName(nickname);
      const matched = data.find((item) => {
        const channel =
          item && item.channel && typeof item.channel === "object"
            ? item.channel
            : null;
        if (!channel) return false;
        return (
          normalizeChannelName(channel.channelName) === normalizedTarget &&
          String(channel.channelId || "").trim().length > 0
        );
      });
      const channelId =
        matched && matched.channel
          ? String(matched.channel.channelId || "").trim()
          : "";
      if (!channelId) {
        return { ok: false, channelId: "", reason: "NO_EXACT_MATCH" };
      }
      const verifiedMark =
        matched && matched.channel && matched.channel.verifiedMark === true;
      return { ok: true, channelId, reason: "", verifiedMark };
    } catch (_error) {
      return { ok: false, channelId: "", reason: "API_ERROR" };
    }
  }

  async function fetchLiveStatusByChannelId(channelId) {
    const normalizedChannelId = String(channelId || "").trim();
    if (!normalizedChannelId) return { ok: false, payload: null };

    const url =
      `${CHZZK_API_BASE}/service/v1/channels/` +
      `${encodeURIComponent(normalizedChannelId)}/data?fields=channelHistory`;
    try {
      const response = await fetch(url);
      if (!response.ok) return { ok: false, payload: null };
      const json = await response.json();
      if (!json || Number(json.code) !== 200)
        return { ok: false, payload: null };
      return { ok: true, payload: json };
    } catch (_error) {
      return { ok: false, payload: null };
    }
  }

  function normalizePopupTheme(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (normalized === "dark" || normalized === "light") {
      return normalized;
    }
    return "system";
  }

  function normalizePopupFontScale(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_POPUP_FONT_SCALE;
    const clamped = Math.min(
      MAX_POPUP_FONT_SCALE,
      Math.max(MIN_POPUP_FONT_SCALE, numeric),
    );
    return Math.round(clamped * 100) / 100;
  }

  function onSystemThemeChanged() {
    if (normalizePopupTheme(state.popupTheme) !== "system") return;
    applyPopupTheme();
  }

  function resolvePopupThemeMode() {
    const preferred = normalizePopupTheme(state.popupTheme);
    if (preferred !== "system") return preferred;
    return darkThemeMedia && darkThemeMedia.matches ? "dark" : "light";
  }

  function applyPopupTheme() {
    const mode = resolvePopupThemeMode();
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.setAttribute(
      "data-theme-preference",
      normalizePopupTheme(state.popupTheme),
    );
  }

  function getScopeKeyFromUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      if (parsed.hostname !== "chzzk.naver.com") return "home";
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return "home";
      if (parts[0] === "video") return "home";
      if (parts[0] === "live") {
        const id = String(parts[1] || "").trim();
        return id ? `channel:${id}` : "home";
      }
      return `channel:${String(parts[0] || "").trim()}`;
    } catch (_error) {
      return "home";
    }
  }

  function formatScopeLabel(scopeKey) {
    const key = String(scopeKey || "").trim();
    if (!key || key === "home") return "홈";
    if (key.startsWith("channel:")) {
      return key.slice("channel:".length) || key;
    }
    return key;
  }

  async function getStorageLocal(key) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result ? result[key] : null;
    } catch (_error) {
      return null;
    }
  }

  async function setStorageLocal(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (_error) {}
  }

  function setIdleStatus() {
    const message = state.connected
      ? STATUS_IDLE_CONNECTED
      : STATUS_IDLE_DISCONNECTED;
    setStatus(message, { variant: "normal" });
  }

  function setStatus(message, options = {}) {
    if (state.statusTimer) {
      clearTimeout(state.statusTimer);
      state.statusTimer = null;
    }

    el.status.textContent = String(message || "");
    el.status.classList.toggle("is-error", options.variant === "error");

    const autoResetMs = Number(options && options.autoResetMs);
    if (!Number.isFinite(autoResetMs) || autoResetMs <= 0) return;

    state.statusTimer = window.setTimeout(() => {
      state.statusTimer = null;
      setIdleStatus();
    }, autoResetMs);
  }

  async function askExcludeConfirmAction() {
    if (
      !el.excludeConfirmModal ||
      !el.excludeConfirmDialog ||
      !el.excludeConfirmCancel ||
      !el.excludeConfirmKeep ||
      !el.excludeConfirmPrune
    ) {
      return window.confirm(
        "모아보기 제외한 닉네임의 기존 모아둔 채팅도 함께 삭제할까요?",
      )
        ? "prune"
        : "keep";
    }

    if (state.excludeConfirmDialog.open) {
      resolveExcludeConfirmModal("cancel");
    }

    state.excludeConfirmDialog.open = true;
    state.excludeConfirmDialog.lastFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    el.excludeConfirmModal.classList.add("is-open");
    el.excludeConfirmModal.removeAttribute("inert");
    el.excludeConfirmModal.setAttribute("aria-hidden", "false");

    const keyHandler = (event) => {
      if (!state.excludeConfirmDialog.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        resolveExcludeConfirmModal("cancel");
        return;
      }
      if (event.key === "Tab") {
        trapExcludeConfirmFocus(event);
      }
    };
    state.excludeConfirmDialog.keyHandler = keyHandler;
    document.addEventListener("keydown", keyHandler, true);

    setTimeout(() => {
      if (!state.excludeConfirmDialog.open) return;
      try {
        el.excludeConfirmKeep.focus({ preventScroll: true });
      } catch (_error) {
        el.excludeConfirmKeep.focus();
      }
    }, 0);

    return new Promise((resolve) => {
      state.excludeConfirmDialog.resolver = resolve;
    });
  }

  function resolveExcludeConfirmModal(action) {
    const nextAction =
      action === "prune" || action === "keep" ? action : "cancel";
    if (!state.excludeConfirmDialog.open) return;

    const keyHandler = state.excludeConfirmDialog.keyHandler;
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler, true);
    }

    state.excludeConfirmDialog.open = false;
    state.excludeConfirmDialog.keyHandler = null;

    if (el.excludeConfirmModal) {
      el.excludeConfirmModal.classList.remove("is-open");
      el.excludeConfirmModal.setAttribute("inert", "");
      el.excludeConfirmModal.setAttribute("aria-hidden", "true");
    }

    const lastFocused = state.excludeConfirmDialog.lastFocused;
    state.excludeConfirmDialog.lastFocused = null;

    if (lastFocused && typeof lastFocused.focus === "function") {
      try {
        lastFocused.focus({ preventScroll: true });
      } catch (_error) {
        lastFocused.focus();
      }
    }

    const resolver = state.excludeConfirmDialog.resolver;
    state.excludeConfirmDialog.resolver = null;
    if (typeof resolver === "function") {
      resolver(nextAction);
    }
  }

  function trapExcludeConfirmFocus(event) {
    if (!el.excludeConfirmDialog) return;
    const focusables = Array.from(
      el.excludeConfirmDialog.querySelectorAll(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ).filter(
      (node) => node instanceof HTMLElement && node.offsetParent !== null,
    );
    if (focusables.length === 0) {
      event.preventDefault();
      el.excludeConfirmDialog.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !el.excludeConfirmDialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !el.excludeConfirmDialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  async function askGenericConfirm(title, message, options = {}) {
    const titleText = String(title || "확인");
    const messageText = String(message || "");
    const okLabel = String(options.okLabel || "확인");
    const cancelLabel =
      options.cancelLabel == null ? "취소" : String(options.cancelLabel);
    const isDanger = options.danger !== false;

    if (
      !el.genericConfirmModal ||
      !el.genericConfirmDialog ||
      !el.genericConfirmCancel ||
      !el.genericConfirmOk ||
      !el.genericConfirmTitle ||
      !el.genericConfirmMessage
    ) {
      return window.confirm(`${titleText}\n\n${messageText}`);
    }

    if (state.genericConfirmDialog.open) {
      resolveGenericConfirmModal(false);
    }

    el.genericConfirmTitle.textContent = titleText;
    el.genericConfirmMessage.textContent = messageText;
    el.genericConfirmOk.textContent = okLabel;
    el.genericConfirmCancel.textContent = cancelLabel;
    el.genericConfirmCancel.hidden = cancelLabel === "";
    el.genericConfirmOk.classList.toggle("is-danger", isDanger);

    state.genericConfirmDialog.open = true;
    state.genericConfirmDialog.lastFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    el.genericConfirmModal.classList.add("is-open");
    el.genericConfirmModal.removeAttribute("inert");
    el.genericConfirmModal.setAttribute("aria-hidden", "false");

    const keyHandler = (event) => {
      if (!state.genericConfirmDialog.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        resolveGenericConfirmModal(false);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        resolveGenericConfirmModal(true);
        return;
      }
      if (event.key === "Tab") {
        trapGenericConfirmFocus(event);
      }
    };
    state.genericConfirmDialog.keyHandler = keyHandler;
    document.addEventListener("keydown", keyHandler, true);

    setTimeout(() => {
      if (!state.genericConfirmDialog.open) return;
      try {
        el.genericConfirmOk.focus({ preventScroll: true });
      } catch (_error) {
        el.genericConfirmOk.focus();
      }
    }, 0);

    return new Promise((resolve) => {
      state.genericConfirmDialog.resolver = resolve;
    });
  }

  function resolveGenericConfirmModal(result) {
    if (!state.genericConfirmDialog.open) return;

    const keyHandler = state.genericConfirmDialog.keyHandler;
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler, true);
    }

    state.genericConfirmDialog.open = false;
    state.genericConfirmDialog.keyHandler = null;

    if (el.genericConfirmModal) {
      el.genericConfirmModal.classList.remove("is-open");
      el.genericConfirmModal.setAttribute("inert", "");
      el.genericConfirmModal.setAttribute("aria-hidden", "true");
    }

    const lastFocused = state.genericConfirmDialog.lastFocused;
    state.genericConfirmDialog.lastFocused = null;

    if (lastFocused && typeof lastFocused.focus === "function") {
      try {
        lastFocused.focus({ preventScroll: true });
      } catch (_error) {
        lastFocused.focus();
      }
    }

    const resolver = state.genericConfirmDialog.resolver;
    state.genericConfirmDialog.resolver = null;
    if (typeof resolver === "function") {
      resolver(result === true);
    }
  }

  function trapGenericConfirmFocus(event) {
    if (!el.genericConfirmDialog) return;
    const focusables = Array.from(
      el.genericConfirmDialog.querySelectorAll(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ).filter(
      (node) => node instanceof HTMLElement && node.offsetParent !== null,
    );
    if (focusables.length === 0) {
      event.preventDefault();
      el.genericConfirmDialog.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !el.genericConfirmDialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !el.genericConfirmDialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  function clearTrackedInputInvalid() {
    if (!el.trackedInput) return;
    el.trackedInput.classList.remove("is-invalid", "is-shake");
  }

  function markTrackedInputInvalid() {
    if (!el.trackedInput) return;
    el.trackedInput.classList.remove("is-invalid", "is-shake");
    void el.trackedInput.offsetWidth;
    el.trackedInput.classList.add("is-invalid", "is-shake");
    const handleShakeEnd = () => {
      el.trackedInput.classList.remove("is-shake");
      el.trackedInput.removeEventListener("animationend", handleShakeEnd);
    };
    el.trackedInput.addEventListener("animationend", handleShakeEnd);
  }
})();
