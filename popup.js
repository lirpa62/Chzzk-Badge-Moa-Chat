(() => {
  const STORAGE_SETTINGS_KEY = "chzzk_badge_moa_popup_settings";
  const UPDATE_BANNER_ENABLED_KEY = "chzzk_badge_moa_update_banner_enabled";
  const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
  const SETTINGS_TAB_STORAGE_KEY = "chzzkBadgeMoaSettingsTab";
  const SETTINGS_EXPORT_FORMAT = "chzzk-badge-moa-chat-settings";
  const FULL_BACKUP_FORMAT = "chzzk-badge-moa-chat-backup";
  const DATA_EXPORT_FORMAT_VERSION = 1;
  const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
  const SETTINGS_STORAGE_KEYS = [
    STORAGE_SETTINGS_KEY,
    UPDATE_BANNER_ENABLED_KEY,
    "chzzk_badge_moa_popup_height",
    "chzzk_badge_moa_popup_height_live",
    "chzzk_badge_moa_popup_height_vod",
    "chzzk_badge_moa_popup_height_live_wide",
    "chzzk_badge_moa_popup_height_vod_wide",
    "chzzk_badge_moa_popup_height_chat_popup",
    "chzzk_badge_moa_popup_display_style",
    "chzzk_badge_moa_toast_list_height",
  ];
  const STATUS_IDLE_CONNECTED = "현재 탭에 즉시 반영됩니다.";
  const STATUS_IDLE_DISCONNECTED =
    "설정은 저장되며 탭 반영은 페이지 새로고침 후 적용될 수 있습니다.";
  const CHZZK_API_BASE = "https://api.chzzk.naver.com";
  const SEARCH_CHANNEL_PAGE_SIZE = 33;
  const TRACKED_NICKNAME_ALLOWLIST = new Set(["익명의 후원자", "미션 결과"]);
  // 모아보기 대상 칩에 쓰는 채널 정보(프로필 이미지·인증 마크) 캐시.
  // 설정 내보내기/콘텐츠 스크립트와 무관한 표시용이라 설정과 따로 둔다.
  const TRACKED_CHANNEL_META_KEY = "chzzk_badge_moa_tracked_channel_meta";
  // 프로필 이미지가 바뀌어도 따라가도록, 설정창을 열 때 이 시간보다 오래된
  // 항목만 다시 확인한다. 한 번에 확인하는 수도 제한한다.
  const TRACKED_META_REFRESH_MS = 6 * 60 * 60 * 1000;
  const TRACKED_META_REFRESH_LIMIT = 30;
  const TRACKED_META_REFRESH_CONCURRENCY = 3;
  const TRACKED_SUGGEST_LIMIT = 6;
  const TRACKED_SUGGEST_FETCH_SIZE = 20;
  const TRACKED_SUGGEST_DEBOUNCE_MS = 250;
  const TRACKED_SUGGEST_CACHE_LIMIT = 30;
  const DEFAULT_PROFILE_URLS = {
    light:
      "https://ssl.pstatic.net/static/nng/glive/image/default_profile_light.png",
    dark: "https://ssl.pstatic.net/static/nng/glive/image/default_profile_dark.png",
  };
  const PARTNER_MARK_URL =
    "https://ssl.pstatic.net/static/nng/glive/image/icon_partner_mark.png";
  const CHALLENGER_MARK_URL =
    "https://ssl.pstatic.net/static/nng/glive/image/icon_challenger_mark.png";
  const OFFICIAL_MARK_URL =
    "https://ssl.pstatic.net/static/nng/glive/image/icon_official_mark.png";
  // 인증 마크 종류(verifiedMarkType)별 라벨/이미지
  const VERIFIED_MARK_INFO = {
    PARTNER: { label: "파트너", iconUrl: PARTNER_MARK_URL },
    CHALLENGER: { label: "챌린저", iconUrl: CHALLENGER_MARK_URL },
    OFFICIAL: { label: "오피셜", iconUrl: OFFICIAL_MARK_URL },
  };
  // 토스트 알림 빈도별 모으는 시간/쉬는 시간(ms).
  // badge-popup-toast.js 의 FREQUENCY_TIMING 과 같은 값이어야 한다.
  // 표시 시간은 빈도와 관계없이 5초(커스텀에서만 바꿀 수 있다).
  const CHAT_TOAST_PRESET_TIMING = {
    high: { gatherMs: 600, visibleMs: 5000, cooldownMs: 0 },
    normal: { gatherMs: 1500, visibleMs: 5000, cooldownMs: 5000 },
    low: { gatherMs: 3000, visibleMs: 5000, cooldownMs: 10000 },
  };
  const CHAT_TOAST_GATHER_MAX_MS = 10000;
  const CHAT_TOAST_COOLDOWN_MAX_MS = 60000;
  const CHAT_TOAST_VISIBLE_MIN_MS = 2000;
  const CHAT_TOAST_VISIBLE_MAX_MS = 30000;
  // 새 채팅 토스트 알림 대상 배지 종류(설정 기본값: 전부)
  const CHAT_TOAST_BADGE_TYPES = [
    "channel_owner",
    "manager",
    "operator",
    "partner",
    "custom",
  ];
  const TRACKED_SCOPE_CHANNEL = "channel";
  const TRACKED_SCOPE_GLOBAL = "global";
  const NICKNAME_EXCLUDE_NONE = "none";
  const NICKNAME_EXCLUDE_CHANNEL = "channel";
  const NICKNAME_EXCLUDE_GLOBAL = "global";
  const HIDE_HINT_DEFAULT =
    "이 채널의 알림 버튼·토스트에서만 빠지고, 모아보기에는 계속 모입니다.";
  const HIDE_HINT_EXCLUDED =
    "모아보기에서 제외되어 알림이 뜨지 않습니다. 다시 모아보면 이 설정이 적용됩니다.";
  const MAX_TRACKED_NICKNAMES_PER_SCOPE = 200;
  const MAX_TRACKED_GLOBAL_NICKNAMES = 20;
  const CHIP_COLLAPSE_THRESHOLD = 4;
  const DEFAULT_POPUP_FONT_SCALE = 1;
  const MIN_POPUP_FONT_SCALE = 0.8;
  const MAX_POPUP_FONT_SCALE = 1.2;
  const DEFAULT_CHAT_FONT_SCALE = 1;
  const MIN_CHAT_FONT_SCALE = 0.8;
  const MAX_CHAT_FONT_SCALE = 2;
  const MIN_CHAT_WIDTH = 220;
  const DEFAULT_CHAT_TIMESTAMP_FORMAT = "24h";
  const DEFAULT_CHAT_TIMESTAMP_COLOR_MODE = "default";
  const DEFAULT_POPUP_TIMESTAMP_FORMAT = "24h";
  const DEFAULT_POPUP_TIMESTAMP_COLOR_MODE = "default";
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
    excludedCollectScopedNicknameSet: new Set(),
    excludedCollectGlobalNicknameSet: new Set(),
    trackedNicknameSet: new Set(),
    trackedScopedNicknameSet: new Set(),
    trackedGlobalNicknameSet: new Set(),
    selectedTrackedNicknameSet: new Set(),
    trackedEditScope: TRACKED_SCOPE_CHANNEL,
    hideChatBackground: false,
    hideChatBorder: false,
    hideExcludedHiddenChatBackground: false,
    hideExcludedHiddenChatBorder: false,
    hidePopupBackground: false,
    hidePopupBorder: false,
    hidePopupTime: false,
    popupTimestampFormat: DEFAULT_POPUP_TIMESTAMP_FORMAT,
    popupTimestampColorMode: DEFAULT_POPUP_TIMESTAMP_COLOR_MODE,
    hideChatRanking: false,
    hideChatMission: false,
    hideChatMissionMessage: false,
    hideChatPrediction: false,
    hideChatSubscription: false,
    hideChatDonation: false,
    restoreBlindedChat: false,
    showChatTimestamp: false,
    chatTimestampFormat: DEFAULT_CHAT_TIMESTAMP_FORMAT,
    chatTimestampColorMode: DEFAULT_CHAT_TIMESTAMP_COLOR_MODE,
    useOriginalSpecialChatStyle: false,
    showPopupRoleBadgesOnly: false,
    showPopupFontScaleControl: false,
    showCaptureButton: false,
    enableCaptureDragSelection: false,
    showCapturePreview: false,
    captureAction: "save",
    captureFilenameFormat: "",
    popupFontScale: DEFAULT_POPUP_FONT_SCALE,
    chatFontScale: DEFAULT_CHAT_FONT_SCALE,
    placeChatOnLeft: false,
    enableChatWidthResize: false,
    chatWidth: 0,
    deleteWithoutConfirm: false,
    hidePillButton: false,
    hideEmptyPill: false,
    keepPopupOpen: false,
    pillGlowEnabled: true,
    chatToastEnabled: false,
    chatToastFrequency: "normal",
    chatToastGatherMs: CHAT_TOAST_PRESET_TIMING.normal.gatherMs,
    chatToastCooldownMs: CHAT_TOAST_PRESET_TIMING.normal.cooldownMs,
    chatToastVisibleMs: CHAT_TOAST_PRESET_TIMING.normal.visibleMs,
    chatToastKeepVisible: false,
    chatToastClickAction: "popup",
    chatToastListOrder: "newest",
    chatToastBackdropBlur: true,
    chatToastBadgeTypes: CHAT_TOAST_BADGE_TYPES.slice(),
    compactPill: false,
    enableSessionCache: false,
    detachedOriginView: "hide",
    autoPruneManagedHiddenOnReconnect: false,
    popupTheme: "system",
    updateBannerEnabled: true,
    // 설정창 상위 탭(표시 설정/대상·제외). 순수 UI 상태이므로 localStorage 에 기억.
    settingsTab: "display",
    statusTimer: null,
    pendingImportMode: "",
    trackedChipsCollapsed: true,
    // 닉네임 칩을 눌러 연 설정 메뉴. { nickname }
    nicknameMenu: null,
    // 닉네임별 표시 관리 필터(all/hidden/channel/global). 저장하지 않는다.
    hiddenFilter: "all",
    // 지금 필터로 목록에 보이는 닉네임. 일괄 버튼이 이 목록에만 적용된다.
    visibleHiddenChipNames: [],
    // nickname -> { channelId, channelName, imageUrl, verifiedMarkType, checkedAt }
    trackedChannelMeta: new Map(),
    trackedMetaRefreshing: new Set(),
    trackedMetaCheckedThisSession: new Set(),
    trackedSuggest: {
      open: false,
      keyword: "",
      status: "idle",
      items: [],
      activeIndex: -1,
      timer: null,
      controller: null,
      seq: 0,
      cache: new Map(),
    },
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
    hiddenSelectAll: document.getElementById("hidden-select-all"),
    hiddenClearAll: document.getElementById("hidden-clear-all"),
    hiddenIncludeAll: document.getElementById("hidden-include-all"),
    hiddenFilterButtons: Array.from(
      document.querySelectorAll("#hidden-filter [data-filter]"),
    ),
    hiddenPruneEmpty: document.getElementById("hidden-prune-empty"),
    hiddenAutoPruneToggle: document.getElementById("hidden-auto-prune-toggle"),
    trackedCollapseToggle: document.getElementById("tracked-collapse-toggle"),
    trackedDeleteSelected: document.getElementById("tracked-delete-selected"),
    trackedDeleteAll: document.getElementById("tracked-delete-all"),
    trackedInput: document.getElementById("tracked-input"),
    addNickname: document.getElementById("add-nickname"),
    trackedScopeButtons: Array.from(
      document.querySelectorAll("#tracked-scope-tabs [data-scope]"),
    ),
    settingsTabButtons: Array.from(
      document.querySelectorAll("#settings-tabs [data-tab]"),
    ),
    settingsTabPanels: Array.from(
      document.querySelectorAll(".settings-tab-panel"),
    ),
    hideChatBg: document.getElementById("hide-chat-bg"),
    hideChatBorder: document.getElementById("hide-chat-border"),
    hideExcludedHiddenChatBg: document.getElementById(
      "hide-excluded-hidden-chat-bg",
    ),
    hideExcludedHiddenChatBorder: document.getElementById(
      "hide-excluded-hidden-chat-border",
    ),
    hidePopupBg: document.getElementById("hide-popup-bg"),
    hidePopupBorder: document.getElementById("hide-popup-border"),
    hidePopupTime: document.getElementById("hide-popup-time"),
    popupTimestampFormat: document.getElementById("popup-timestamp-format"),
    popupTimestampColorMode: document.getElementById(
      "popup-timestamp-color-mode",
    ),
    hideChatRanking: document.getElementById("hide-chat-ranking"),
    hideChatMission: document.getElementById("hide-chat-mission"),
    hideChatMissionMessage: document.getElementById(
      "hide-chat-mission-message",
    ),
    hideChatPrediction: document.getElementById("hide-chat-prediction"),
    hideChatSubscription: document.getElementById("hide-chat-subscription"),
    hideChatDonation: document.getElementById("hide-chat-donation"),
    restoreBlindedChat: document.getElementById("restore-blinded-chat"),
    showChatTimestamp: document.getElementById("show-chat-timestamp"),
    chatTimestampFormat: document.getElementById("chat-timestamp-format"),
    chatTimestampColorMode: document.getElementById(
      "chat-timestamp-color-mode",
    ),
    useOriginalSpecialChatStyle: document.getElementById(
      "use-original-special-chat-style",
    ),
    placeChatOnLeft: document.getElementById("place-chat-on-left"),
    enableChatWidthResize: document.getElementById("enable-chat-width-resize"),
    showPopupRoleBadgesOnly: document.getElementById(
      "show-popup-role-badges-only",
    ),
    showPopupFontScaleControl: document.getElementById(
      "show-popup-font-scale-control",
    ),
    showCaptureButton: document.getElementById("show-capture-button"),
    enableCaptureDragSelection: document.getElementById(
      "enable-capture-drag-selection",
    ),
    showCapturePreview: document.getElementById("show-capture-preview"),
    captureAction: document.getElementById("capture-action"),
    captureFilename: document.querySelector(".capture-filename"),
    captureFilenameFormat: document.getElementById("capture-filename-format"),
    captureFilenameReset: document.getElementById("capture-filename-reset"),
    captureFilenameTokens: Array.from(
      document.querySelectorAll("[data-capture-filename-token]"),
    ),
    captureFilenamePreview: document.getElementById("capture-filename-preview"),
    popupFontScale: document.getElementById("popup-font-scale"),
    chatFontScale: document.getElementById("chat-font-scale"),
    deleteWithoutConfirm: document.getElementById("delete-without-confirm"),
    hidePillButton: document.getElementById("hide-pill-button"),
    hideEmptyPill: document.getElementById("hide-empty-pill"),
    keepPopupOpen: document.getElementById("keep-popup-open"),
    detachedOriginView: document.getElementById("detached-origin-view"),
    pillGlowEnabled: document.getElementById("pill-glow-enabled"),
    chatToastEnabled: document.getElementById("chat-toast-enabled"),
    chatToastFrequency: document.getElementById("chat-toast-frequency"),
    chatToastFrequencyButtons: Array.from(
      document.querySelectorAll("#chat-toast-frequency [data-value]"),
    ),
    chatToastClickAction: document.getElementById("chat-toast-click-action"),
    chatToastListOrder: document.getElementById("chat-toast-list-order"),
    chatToastListOrderButtons: Array.from(
      document.querySelectorAll("#chat-toast-list-order [data-value]"),
    ),
    chatToastBackdropBlur: document.getElementById("chat-toast-backdrop-blur"),
    chatToastClickActionButtons: Array.from(
      document.querySelectorAll("#chat-toast-click-action [data-value]"),
    ),
    chatToastTiming: document.querySelector(".chat-toast-timing"),
    chatToastGather: document.getElementById("chat-toast-gather"),
    chatToastCooldown: document.getElementById("chat-toast-cooldown"),
    chatToastVisible: document.getElementById("chat-toast-visible"),
    chatToastKeepVisible: document.getElementById("chat-toast-keep-visible"),
    chatToastTargets: document.querySelector(".chat-toast-targets"),
    chatToastBadgeTypeInputs: Array.from(
      document.querySelectorAll("[data-chat-toast-badge-type]"),
    ),
    compactPill: document.getElementById("compact-pill"),
    enableSessionCache: document.getElementById("enable-session-cache"),
    clearCurrentChannelSession: document.getElementById(
      "clear-current-channel-session",
    ),
    exportSettings: document.getElementById("export-settings"),
    importSettings: document.getElementById("import-settings"),
    exportFullBackup: document.getElementById("export-full-backup"),
    importFullBackup: document.getElementById("import-full-backup"),
    dataImportFile: document.getElementById("data-import-file"),
    updateBannerToggle: document.getElementById("update-banner-toggle"),
    themeToggle: document.getElementById("theme-toggle"),
    themeToggleCurrent: document.getElementById("theme-toggle-current"),
    themeToggleOptions: Array.from(
      document.querySelectorAll(".theme-toggle-option"),
    ),
    customSelects: [],
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
    settingsTooltip: document.getElementById("settings-tooltip"),
  };
  let suppressCustomTooltips = () => {};
  let dismissCustomTooltipFor = () => {};

  init().catch(() => {
    setStatus("설정을 불러오지 못했습니다.");
  });

  async function init() {
    initializeCustomTooltips();
    bindEvents();
    applySettingsTab(loadSettingsTab());
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    state.tabId = Number(tab && tab.id);
    state.tabUrl = String((tab && tab.url) || "");
    state.scopeKey = getScopeKeyFromUrl(state.tabUrl);
    state.scopeLabel = formatScopeLabel(state.scopeKey);

    const [raw, updateBannerEnabled, trackedMetaRaw] = await Promise.all([
      getStorageLocal(STORAGE_SETTINGS_KEY),
      getStorageLocal(UPDATE_BANNER_ENABLED_KEY),
      getStorageLocal(TRACKED_CHANNEL_META_KEY),
    ]);
    state.updateBannerEnabled = updateBannerEnabled !== false;
    state.trackedChannelMeta = parseTrackedChannelMeta(trackedMetaRaw);
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
    refreshVisibleTrackedChannelMeta();
  }

  function initializeCustomTooltips() {
    if (!(el.settingsTooltip instanceof HTMLElement)) return;

    let hoverTarget = null;
    let focusTarget = null;
    let activeTarget = null;
    let describedElement = null;
    let previousDescribedBy = null;
    let suppressedUntil = 0;
    // 선택 상자를 열면 그 항목의 툴팁을 닫고, 마우스가 항목을 벗어날 때까지 다시 띄우지 않는다.
    let dismissedTarget = null;

    const migrateNativeTooltip = (element) => {
      if (!(element instanceof HTMLElement) || !element.hasAttribute("title")) {
        return;
      }
      const message = String(element.getAttribute("title") || "").trim();
      element.removeAttribute("title");
      if (message) element.dataset.tooltip = message;
    };

    document.querySelectorAll("[title]").forEach(migrateNativeTooltip);

    const getTooltipTarget = (target) =>
      target instanceof Element ? target.closest("[data-tooltip]") : null;

    const restoreDescription = () => {
      if (!(describedElement instanceof HTMLElement)) return;
      if (previousDescribedBy) {
        describedElement.setAttribute("aria-describedby", previousDescribedBy);
      } else {
        describedElement.removeAttribute("aria-describedby");
      }
      describedElement = null;
      previousDescribedBy = null;
    };

    const hideTooltip = () => {
      restoreDescription();
      activeTarget = null;
      el.settingsTooltip.hidden = true;
      el.settingsTooltip.textContent = "";
      el.settingsTooltip.classList.remove("is-nowrap");
    };

    const positionTooltip = () => {
      if (!(activeTarget instanceof HTMLElement) || !activeTarget.isConnected) {
        hideTooltip();
        return;
      }
      const targetRect = activeTarget.getBoundingClientRect();
      const tooltipRect = el.settingsTooltip.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 6;
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - tooltipRect.width - viewportPadding,
      );
      const preferredLeft =
        activeTarget.dataset.tooltipAlign === "end"
          ? targetRect.right - tooltipRect.width - 20
          : targetRect.left + (targetRect.width - tooltipRect.width) / 2;
      const left = Math.min(maxLeft, Math.max(viewportPadding, preferredLeft));
      const below = targetRect.bottom + gap;
      const above = targetRect.top - tooltipRect.height - gap;
      const fitsBelow =
        below + tooltipRect.height <= window.innerHeight - viewportPadding;
      const fitsAbove = above >= viewportPadding;
      // data-tooltip-placement="top": 아래로 펼쳐지는 선택 상자를 가리지 않도록 위쪽 우선.
      const preferAbove = activeTarget.dataset.tooltipPlacement === "top";
      const top = preferAbove
        ? fitsAbove || !fitsBelow
          ? above
          : below
        : fitsBelow || !fitsAbove
          ? below
          : above;
      el.settingsTooltip.style.left = `${Math.round(left)}px`;
      el.settingsTooltip.style.top = `${Math.round(
        Math.max(viewportPadding, top),
      )}px`;
    };

    const showTooltip = (target) => {
      if (!(target instanceof HTMLElement)) return;
      if (target === dismissedTarget) {
        hideTooltip();
        return;
      }
      if (
        target.classList.contains("theme-toggle-option") &&
        Date.now() < suppressedUntil
      ) {
        hideTooltip();
        return;
      }
      const message = String(target.dataset.tooltip || "").trim();
      if (!message) {
        hideTooltip();
        return;
      }

      restoreDescription();
      activeTarget = target;
      renderTooltipContent(el.settingsTooltip, message);
      el.settingsTooltip.classList.toggle(
        "is-nowrap",
        target.dataset.tooltipNowrap === "true",
      );
      el.settingsTooltip.hidden = false;

      const focusable = target.matches("button, input, select, textarea")
        ? target
        : target.querySelector(
            "button:not(:disabled), input:not(:disabled), select:not(.native-select-hidden):not(:disabled), textarea:not(:disabled)",
          );
      if (focusable instanceof HTMLElement) {
        describedElement = focusable;
        previousDescribedBy = focusable.getAttribute("aria-describedby");
        const describedBy = [previousDescribedBy, el.settingsTooltip.id]
          .filter(Boolean)
          .join(" ");
        focusable.setAttribute("aria-describedby", describedBy);
      }
      positionTooltip();
    };

    suppressCustomTooltips = (durationMs = 0) => {
      suppressedUntil = Math.max(
        suppressedUntil,
        Date.now() + Math.max(0, Number(durationMs) || 0),
      );
      hoverTarget = null;
      focusTarget = null;
      hideTooltip();
    };

    document.addEventListener("pointerover", (event) => {
      const target = getTooltipTarget(event.target);
      if (!(target instanceof HTMLElement)) return;
      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) return;
      hoverTarget = target;
      showTooltip(target);
    });
    dismissCustomTooltipFor = (element) => {
      const target = getTooltipTarget(element);
      if (!(target instanceof HTMLElement)) return;
      dismissedTarget = target;
      if (hoverTarget === target) hoverTarget = null;
      if (focusTarget === target) focusTarget = null;
      if (activeTarget === target) hideTooltip();
    };

    document.addEventListener("pointerout", (event) => {
      const target = getTooltipTarget(event.target);
      if (
        target instanceof HTMLElement &&
        target === dismissedTarget &&
        !(event.relatedTarget instanceof Node && target.contains(event.relatedTarget))
      ) {
        dismissedTarget = null;
        return;
      }
      if (!(target instanceof HTMLElement) || hoverTarget !== target) return;
      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) return;
      hoverTarget = null;
      if (focusTarget instanceof HTMLElement) {
        showTooltip(focusTarget);
      } else {
        hideTooltip();
      }
    });
    document.addEventListener("focusin", (event) => {
      const target = getTooltipTarget(event.target);
      if (!(target instanceof HTMLElement)) return;
      // 마우스 클릭으로 생긴 포커스(체크박스 등)는 툴팁을 붙잡지 않는다.
      // 그렇지 않으면 마우스가 떠난 뒤에도 포커스 때문에 툴팁이 남는다.
      if (
        event.target instanceof Element &&
        !event.target.matches(":focus-visible")
      ) {
        return;
      }
      focusTarget = target;
      showTooltip(target);
    });
    document.addEventListener("focusout", (event) => {
      const target = getTooltipTarget(event.target);
      if (
        target instanceof HTMLElement &&
        target === dismissedTarget &&
        event.relatedTarget instanceof Node &&
        !target.contains(event.relatedTarget) &&
        !target.matches(":hover")
      ) {
        dismissedTarget = null;
      }
      if (!(target instanceof HTMLElement) || focusTarget !== target) return;
      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) return;
      focusTarget = null;
      if (hoverTarget instanceof HTMLElement) {
        showTooltip(hoverTarget);
      } else {
        hideTooltip();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideTooltip();
    });
    document.addEventListener("scroll", positionTooltip, true);
    window.addEventListener("resize", positionTooltip);

    const tooltipObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "childList" &&
          activeTarget instanceof HTMLElement &&
          !activeTarget.isConnected
        ) {
          hoverTarget = null;
          focusTarget = null;
          hideTooltip();
          return;
        }
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "title"
        ) {
          migrateNativeTooltip(mutation.target);
          return;
        }
        // 누른 버튼이 바로 비활성화되면(예: 미활동 닉네임 정리) 브라우저가
        // pointerout/focusout 을 보내지 않아 툴팁이 남는다. 여기서 직접 닫는다.
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "disabled" &&
          activeTarget instanceof HTMLElement &&
          mutation.target instanceof HTMLElement &&
          activeTarget.contains(mutation.target) &&
          mutation.target.matches(":disabled")
        ) {
          if (hoverTarget === activeTarget) hoverTarget = null;
          if (focusTarget === activeTarget) focusTarget = null;
          hideTooltip();
          return;
        }
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-tooltip" &&
          mutation.target === activeTarget
        ) {
          showTooltip(activeTarget);
        }
      });
    });
    tooltipObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["title", "data-tooltip", "disabled"],
      childList: true,
      subtree: true,
    });
  }

  // 툴팁 문구의 간단한 서식: 줄바꿈(\n), "- " 로 시작하는 줄은 글머리 기호,
  // **굵게**. HTML 로 해석하지 않고 DOM 으로 만든다.
  function appendTooltipInline(parent, text) {
    String(text)
      .split(/(\*\*[^*]+\*\*)/)
      .forEach((part) => {
        if (!part) return;
        const bold = /^\*\*([^*]+)\*\*$/.exec(part);
        if (bold) {
          const strong = document.createElement("strong");
          strong.textContent = bold[1];
          parent.appendChild(strong);
        } else {
          parent.appendChild(document.createTextNode(part));
        }
      });
  }

  function renderTooltipContent(container, message) {
    container.textContent = "";
    const text = String(message || "");
    if (!text.includes("\n") && !text.includes("**")) {
      container.textContent = text;
      return;
    }
    let list = null;
    text.split("\n").forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        list = null;
        return;
      }
      const bullet = /^[-•]\s+(.*)$/.exec(line);
      if (bullet) {
        if (!list) {
          list = document.createElement("ul");
          list.className = "settings-tooltip-list";
          container.appendChild(list);
        }
        const item = document.createElement("li");
        appendTooltipInline(item, bullet[1]);
        list.appendChild(item);
        return;
      }
      list = null;
      const paragraph = document.createElement("p");
      paragraph.className = "settings-tooltip-line";
      appendTooltipInline(paragraph, line);
      container.appendChild(paragraph);
    });
  }

  function setCustomTooltip(element, message) {
    if (!(element instanceof HTMLElement)) return;
    element.removeAttribute("title");
    const text = String(message || "").trim();
    if (text) {
      element.dataset.tooltip = text;
    } else {
      delete element.dataset.tooltip;
    }
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
    const changed = isThemeToggleExpanded() !== next;
    if (changed) suppressCustomTooltips(540);
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

  function syncUpdateBannerToggleUi() {
    if (!(el.updateBannerToggle instanceof HTMLButtonElement)) return;
    const enabled = state.updateBannerEnabled !== false;
    const actionLabel = enabled ? "업데이트 배너 끄기" : "업데이트 배너 켜기";
    el.updateBannerToggle.setAttribute("aria-pressed", String(enabled));
    el.updateBannerToggle.setAttribute("aria-label", actionLabel);
    setCustomTooltip(el.updateBannerToggle, actionLabel);
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

  function initializeCustomSelects(selects) {
    selects.forEach((select) => {
      if (!(select instanceof HTMLSelectElement)) return;
      if (select.__badgeMoaCustomSelect) return;

      const root = document.createElement("div");
      root.className = "custom-select";
      root.dataset.expanded = "false";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "custom-select-trigger";
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");

      const value = document.createElement("span");
      value.className = "custom-select-value";
      trigger.appendChild(value);

      const chevron = document.createElement("span");
      chevron.className = "custom-select-chevron";
      chevron.setAttribute("aria-hidden", "true");
      trigger.appendChild(chevron);

      const menu = document.createElement("div");
      menu.className = "custom-select-menu";
      menu.id = `${select.id || "custom-select"}-menu`;
      menu.setAttribute("role", "listbox");
      menu.setAttribute("aria-label", getCustomSelectLabel(select));
      trigger.setAttribute("aria-controls", menu.id);

      Array.from(select.options).forEach((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "custom-select-option";
        item.setAttribute("role", "option");
        item.dataset.value = option.value;
        item.textContent = option.textContent || option.value;
        item.disabled = option.disabled;
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          setCustomSelectValue(select, option.value);
          closeCustomSelect(root, { restoreFocus: true });
        });
        item.addEventListener("keydown", (event) => {
          handleCustomSelectOptionKeydown(event, select, item);
        });
        menu.appendChild(item);
      });

      root.appendChild(trigger);
      root.appendChild(menu);
      select.insertAdjacentElement("afterend", root);
      select.classList.add("native-select-hidden");
      select.tabIndex = -1;
      select.inert = true;

      const stateItem = { select, root, trigger, value, menu };
      select.__badgeMoaCustomSelect = stateItem;
      el.customSelects.push(stateItem);

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleCustomSelect(root, { focusSelected: false });
      });
      trigger.addEventListener("keydown", (event) => {
        handleCustomSelectTriggerKeydown(event, select);
      });
      menu.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      select.addEventListener("change", () => {
        syncCustomSelect(select);
      });
      select.addEventListener("focus", () => {
        try {
          trigger.focus({ preventScroll: true });
        } catch (_error) {
          trigger.focus();
        }
      });

      syncCustomSelect(select);
    });
  }

  function getCustomSelectLabel(select) {
    const fieldRow = select.closest(".field-row");
    const label = fieldRow ? fieldRow.querySelector("span") : null;
    return String(label ? label.textContent : select.id || "옵션 선택").trim();
  }

  function syncCustomSelect(select) {
    const custom = select && select.__badgeMoaCustomSelect;
    if (!custom) return;
    const selected = select.selectedOptions && select.selectedOptions[0];
    custom.value.textContent =
      (selected && selected.textContent) || select.value || "선택";
    Array.from(custom.menu.querySelectorAll(".custom-select-option")).forEach(
      (item) => {
        const isSelected = item.dataset.value === select.value;
        item.setAttribute("aria-selected", String(isSelected));
      },
    );
    const disabled = select.disabled === true;
    custom.root.classList.toggle("is-disabled", disabled);
    custom.root.setAttribute("aria-disabled", String(disabled));
    custom.trigger.disabled = disabled;
    if (disabled) closeCustomSelect(custom.root, { restoreFocus: false });
  }

  function setCustomSelectValue(select, value) {
    if (!(select instanceof HTMLSelectElement)) return;
    if (select.disabled) return;
    if (select.value === value) {
      syncCustomSelect(select);
      return;
    }
    select.value = value;
    syncCustomSelect(select);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function toggleCustomSelect(root, options = {}) {
    if (!(root instanceof HTMLElement)) return;
    const expanded = root.dataset.expanded === "true";
    if (expanded) {
      closeCustomSelect(root, { restoreFocus: false });
      return;
    }
    openCustomSelect(root, options);
  }

  function openCustomSelect(root, options = {}) {
    if (!(root instanceof HTMLElement)) return;
    if (root.classList.contains("is-disabled")) return;
    closeCustomSelects(root);
    dismissCustomTooltipFor(root);
    root.dataset.expanded = "true";
    const trigger = root.querySelector(".custom-select-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    if (options.focusSelected) {
      focusSelectedCustomOption(root);
    }
  }

  function closeCustomSelect(root, options = {}) {
    if (!(root instanceof HTMLElement)) return;
    const wasExpanded = root.dataset.expanded === "true";
    root.dataset.expanded = "false";
    const trigger = root.querySelector(".custom-select-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (wasExpanded && options.restoreFocus && trigger instanceof HTMLElement) {
      try {
        trigger.focus({ preventScroll: true });
      } catch (_error) {
        trigger.focus();
      }
    }
  }

  function closeCustomSelects(exceptTarget, options = {}) {
    el.customSelects.forEach(({ root }) => {
      if (!(root instanceof HTMLElement)) return;
      if (exceptTarget instanceof Node && root.contains(exceptTarget)) return;
      closeCustomSelect(root, options);
    });
  }

  function getCustomOptionButtons(root) {
    if (!(root instanceof HTMLElement)) return [];
    return Array.from(root.querySelectorAll(".custom-select-option")).filter(
      (button) => button instanceof HTMLButtonElement && !button.disabled,
    );
  }

  function focusSelectedCustomOption(root) {
    const options = getCustomOptionButtons(root);
    if (options.length === 0) return;
    const selected = options.find(
      (button) => button.getAttribute("aria-selected") === "true",
    );
    const target = selected || options[0];
    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }
  }

  function focusCustomOptionByDelta(root, current, delta) {
    const options = getCustomOptionButtons(root);
    if (options.length === 0) return;
    const currentIndex = Math.max(0, options.indexOf(current));
    const nextIndex = (currentIndex + delta + options.length) % options.length;
    options[nextIndex].focus();
  }

  function focusCustomOptionEdge(root, edge) {
    const options = getCustomOptionButtons(root);
    if (options.length === 0) return;
    const target = edge === "last" ? options[options.length - 1] : options[0];
    target.focus();
  }

  function handleCustomSelectTriggerKeydown(event, select) {
    const custom = select && select.__badgeMoaCustomSelect;
    if (!custom) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCustomSelect(custom.root, { focusSelected: true });
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openCustomSelect(custom.root, { focusSelected: true });
      return;
    }
    if (event.key === "Escape") {
      closeCustomSelect(custom.root, { restoreFocus: false });
    }
  }

  function handleCustomSelectOptionKeydown(event, select, item) {
    const custom = select && select.__badgeMoaCustomSelect;
    if (!custom) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCustomOptionByDelta(custom.root, item, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCustomOptionByDelta(custom.root, item, -1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusCustomOptionEdge(custom.root, "first");
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusCustomOptionEdge(custom.root, "last");
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setCustomSelectValue(select, item.dataset.value || "");
      closeCustomSelect(custom.root, { restoreFocus: true });
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeCustomSelect(custom.root, { restoreFocus: true });
    }
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
    initializeCustomSelects([
      el.popupFontScale,
      el.chatFontScale,
      el.detachedOriginView,
      el.popupTimestampFormat,
      el.popupTimestampColorMode,
      el.chatTimestampFormat,
      el.chatTimestampColorMode,
      el.captureAction,
    ]);

    (el.settingsTabButtons || []).forEach((button) => {
      button.addEventListener("click", () => {
        applySettingsTab(button.dataset.tab);
      });
      button.addEventListener("keydown", handleSettingsTabKeydown);
    });

    if (el.updateBannerToggle) {
      el.updateBannerToggle.addEventListener("click", async () => {
        state.updateBannerEnabled = state.updateBannerEnabled === false;
        syncUpdateBannerToggleUi();
        await setStorageLocal(
          UPDATE_BANNER_ENABLED_KEY,
          state.updateBannerEnabled,
        );
        setStatus(
          state.updateBannerEnabled
            ? "업데이트 배너를 표시합니다."
            : "업데이트 배너를 표시하지 않습니다.",
          { autoResetMs: 1800 },
        );
      });
    }

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
      closeCustomSelects(event.target instanceof Node ? event.target : null);
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
      if (event.key === "Escape") {
        closeCustomSelects(null, { restoreFocus: true });
      }
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

    el.hideExcludedHiddenChatBg.addEventListener("change", async () => {
      state.hideExcludedHiddenChatBackground =
        el.hideExcludedHiddenChatBg.checked;
      await persistAndApply();
    });

    el.hideExcludedHiddenChatBorder.addEventListener("change", async () => {
      state.hideExcludedHiddenChatBorder =
        el.hideExcludedHiddenChatBorder.checked;
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
      syncPopupTimestampOptionControls();
      await persistAndApply();
    });

    el.popupTimestampFormat.addEventListener("change", async () => {
      state.popupTimestampFormat = normalizePopupTimestampFormat(
        el.popupTimestampFormat.value,
      );
      await persistAndApply();
    });

    el.popupTimestampColorMode.addEventListener("change", async () => {
      state.popupTimestampColorMode = normalizePopupTimestampColorMode(
        el.popupTimestampColorMode.value,
      );
      await persistAndApply();
    });

    el.hideChatRanking.addEventListener("change", async () => {
      state.hideChatRanking = el.hideChatRanking.checked;
      await persistAndApply();
    });

    el.hideChatMission.addEventListener("change", async () => {
      state.hideChatMission = el.hideChatMission.checked;
      await persistAndApply();
    });

    el.hideChatMissionMessage.addEventListener("change", async () => {
      state.hideChatMissionMessage = el.hideChatMissionMessage.checked;
      await persistAndApply();
    });

    el.hideChatPrediction.addEventListener("change", async () => {
      state.hideChatPrediction = el.hideChatPrediction.checked;
      await persistAndApply();
    });

    el.hideChatSubscription.addEventListener("change", async () => {
      state.hideChatSubscription = el.hideChatSubscription.checked;
      await persistAndApply();
    });

    el.hideChatDonation.addEventListener("change", async () => {
      state.hideChatDonation = el.hideChatDonation.checked;
      await persistAndApply();
    });

    el.restoreBlindedChat.addEventListener("change", async () => {
      state.restoreBlindedChat = el.restoreBlindedChat.checked;
      await persistAndApply();
    });

    el.showChatTimestamp.addEventListener("change", async () => {
      state.showChatTimestamp = el.showChatTimestamp.checked;
      syncChatTimestampOptionControls();
      await persistAndApply();
    });

    el.chatTimestampFormat.addEventListener("change", async () => {
      state.chatTimestampFormat = normalizeChatTimestampFormat(
        el.chatTimestampFormat.value,
      );
      await persistAndApply();
    });

    el.chatTimestampColorMode.addEventListener("change", async () => {
      state.chatTimestampColorMode = normalizeChatTimestampColorMode(
        el.chatTimestampColorMode.value,
      );
      await persistAndApply();
    });

    el.useOriginalSpecialChatStyle.addEventListener("change", async () => {
      state.useOriginalSpecialChatStyle =
        el.useOriginalSpecialChatStyle.checked;
      await persistAndApply();
    });

    el.enableChatWidthResize.addEventListener("change", async () => {
      state.enableChatWidthResize = el.enableChatWidthResize.checked;
      await persistAndApply();
    });

    el.placeChatOnLeft.addEventListener("change", async () => {
      state.placeChatOnLeft = el.placeChatOnLeft.checked;
      await persistAndApply();
    });

    el.showPopupRoleBadgesOnly.addEventListener("change", async () => {
      state.showPopupRoleBadgesOnly = el.showPopupRoleBadgesOnly.checked;
      await persistAndApply();
    });

    el.showPopupFontScaleControl.addEventListener("change", async () => {
      state.showPopupFontScaleControl = el.showPopupFontScaleControl.checked;
      await persistAndApply();
    });

    el.showCaptureButton.addEventListener("change", async () => {
      state.showCaptureButton = el.showCaptureButton.checked;
      syncCaptureOptionControls();
      await persistAndApply();
    });

    el.captureAction.addEventListener("change", async () => {
      state.captureAction = normalizeCaptureAction(el.captureAction.value);
      syncCustomSelect(el.captureAction);
      await persistAndApply();
    });

    // 파일 이름 형식은 입력이 멈추면 저장한다.
    let captureFilenameSaveTimer = 0;
    const saveCaptureFilenameFormat = async () => {
      clearTimeout(captureFilenameSaveTimer);
      captureFilenameSaveTimer = 0;
      const value = normalizeCaptureFilenameFormat(
        el.captureFilenameFormat.value,
      );
      if (value === state.captureFilenameFormat) return;
      state.captureFilenameFormat = value;
      await persistAndApply();
    };
    el.captureFilenameFormat.addEventListener("input", () => {
      renderCaptureFilenamePreview();
      clearTimeout(captureFilenameSaveTimer);
      captureFilenameSaveTimer = setTimeout(() => {
        void saveCaptureFilenameFormat();
      }, 400);
    });
    el.captureFilenameFormat.addEventListener("change", () => {
      void saveCaptureFilenameFormat();
    });
    el.captureFilenameTokens.forEach((button) => {
      button.addEventListener("click", () => {
        const input = el.captureFilenameFormat;
        const token = `{${button.dataset.captureFilenameToken}}`;
        const value = input.value;
        const start = input.selectionStart ?? value.length;
        const end = input.selectionEnd ?? start;
        if (value.length - (end - start) + token.length > input.maxLength) {
          return;
        }
        input.value = value.slice(0, start) + token + value.slice(end);
        input.focus();
        input.setSelectionRange(start + token.length, start + token.length);
        renderCaptureFilenamePreview();
        void saveCaptureFilenameFormat();
      });
    });
    el.captureFilenameReset.addEventListener("click", () => {
      el.captureFilenameFormat.value = getCaptureFilenameDefault();
      renderCaptureFilenamePreview();
      void saveCaptureFilenameFormat();
    });

    el.enableCaptureDragSelection.addEventListener("change", async () => {
      state.enableCaptureDragSelection = el.enableCaptureDragSelection.checked;
      await persistAndApply();
    });

    el.showCapturePreview.addEventListener("change", async () => {
      state.showCapturePreview = el.showCapturePreview.checked;
      await persistAndApply();
    });

    el.popupFontScale.addEventListener("change", async () => {
      state.popupFontScale = normalizePopupFontScale(el.popupFontScale.value);
      syncCustomSelect(el.popupFontScale);
      await persistAndApply();
    });

    el.chatFontScale.addEventListener("change", async () => {
      state.chatFontScale = normalizeChatFontScale(el.chatFontScale.value);
      syncCustomSelect(el.chatFontScale);
      await persistAndApply();
    });

    el.detachedOriginView.addEventListener("change", async () => {
      state.detachedOriginView = normalizeDetachedOriginView(
        el.detachedOriginView.value,
      );
      syncCustomSelect(el.detachedOriginView);
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

    el.chatToastEnabled.addEventListener("change", async () => {
      state.chatToastEnabled = el.chatToastEnabled.checked;
      syncChatToastOptionControls();
      syncCaptureOptionControls();
      await persistAndApply();
    });

    const selectChatToastFrequency = async (value) => {
      const next = normalizeChatToastFrequency(value);
      if (next === state.chatToastFrequency) return;
      state.chatToastFrequency = next;
      syncChatToastOptionControls();
      await persistAndApply();
    };
    const selectChatToastClickAction = async (value) => {
      const next = normalizeChatToastClickAction(value);
      if (next === state.chatToastClickAction) return;
      state.chatToastClickAction = next;
      syncChatToastOptionControls();
      syncCaptureOptionControls();
      await persistAndApply();
    };
    bindSegmentedRadioGroup(
      el.chatToastClickActionButtons,
      selectChatToastClickAction,
    );
    bindSegmentedRadioGroup(el.chatToastListOrderButtons, async (value) => {
      const next = normalizeChatToastListOrder(value);
      if (next === state.chatToastListOrder) return;
      state.chatToastListOrder = next;
      syncChatToastOptionControls();
      await persistAndApply();
    });
    if (el.chatToastBackdropBlur) {
      el.chatToastBackdropBlur.addEventListener("change", async () => {
        state.chatToastBackdropBlur = el.chatToastBackdropBlur.checked;
        await persistAndApply();
      });
    }
    el.chatToastFrequencyButtons.forEach((button, index, buttons) => {
      button.addEventListener("click", () => {
        selectChatToastFrequency(button.dataset.value);
      });
      // 라디오 그룹 키보드 조작: 방향키로 옆 항목을 바로 고른다.
      button.addEventListener("keydown", (event) => {
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (!step) return;
        event.preventDefault();
        const next = buttons[(index + step + buttons.length) % buttons.length];
        next.focus();
        selectChatToastFrequency(next.dataset.value);
      });
    });

    bindNumberSteppers();

    if (el.chatToastKeepVisible) {
      el.chatToastKeepVisible.addEventListener("change", async () => {
        state.chatToastKeepVisible = el.chatToastKeepVisible.checked;
        syncChatToastTimingInputs();
        await persistAndApply();
      });
    }

    [
      [el.chatToastGather, "chatToastGatherMs", CHAT_TOAST_GATHER_MAX_MS],
      [el.chatToastCooldown, "chatToastCooldownMs", CHAT_TOAST_COOLDOWN_MAX_MS],
      [el.chatToastVisible, "chatToastVisibleMs", CHAT_TOAST_VISIBLE_MAX_MS],
    ].forEach(([input, key, maxMs]) => {
      if (!input) return;
      input.addEventListener("change", async () => {
        const raw = String(input.value || "").trim();
        const minMs =
          key === "chatToastVisibleMs" ? CHAT_TOAST_VISIBLE_MIN_MS : 0;
        state[key] =
          raw === ""
            ? state[key]
            : Math.max(
                minMs,
                normalizeChatToastDurationMs(Number(raw) * 1000, state[key], maxMs),
              );
        syncChatToastTimingInputs();
        await persistAndApply();
      });
    });

    el.chatToastBadgeTypeInputs.forEach((input) => {
      input.addEventListener("change", async () => {
        state.chatToastBadgeTypes = el.chatToastBadgeTypeInputs
          .filter((item) => item.checked)
          .map((item) => item.dataset.chatToastBadgeType);
        await persistAndApply();
      });
    });

    el.compactPill.addEventListener("change", async () => {
      state.compactPill = el.compactPill.checked;
      await persistAndApply();
    });

    el.keepPopupOpen.addEventListener("change", async () => {
      state.keepPopupOpen = el.keepPopupOpen.checked;
      if (state.keepPopupOpen) {
        state.hidePillButton = false;
        el.hidePillButton.checked = false;
      }
      await persistAndApply();
    });

    el.hidePillButton.addEventListener("change", async () => {
      const nextChecked = el.hidePillButton.checked;
      if (nextChecked) {
        const confirmed = await askGenericConfirm(
          "채팅창 알림 버튼 숨김",
          "채팅창 알림 버튼을 숨기면 배지 채팅 모아보기 팝업창을 열 수 없습니다.\n(새 채팅 토스트 알림을 켜 두면 알림을 눌러 열 수 있습니다.)\n계속 진행하시겠습니까?",
          { okLabel: "숨기기", cancelLabel: "취소", danger: true },
        );
        if (!confirmed) {
          el.hidePillButton.checked = false;
          state.hidePillButton = false;
          return;
        }
      }
      state.hidePillButton = nextChecked;
      if (state.hidePillButton) {
        state.keepPopupOpen = false;
        el.keepPopupOpen.checked = false;
      }
      await persistAndApply();
    });

    el.hideEmptyPill.addEventListener("change", async () => {
      state.hideEmptyPill = el.hideEmptyPill.checked;
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

    if (el.exportSettings) {
      el.exportSettings.addEventListener("click", async () => {
        await exportSettingsJson();
      });
    }
    if (el.importSettings) {
      el.importSettings.addEventListener("click", () => {
        openDataImportPicker("settings");
      });
    }
    if (el.exportFullBackup) {
      el.exportFullBackup.addEventListener("click", async () => {
        await exportFullBackupJson();
      });
    }
    if (el.importFullBackup) {
      el.importFullBackup.addEventListener("click", () => {
        openDataImportPicker("backup");
      });
    }
    if (el.dataImportFile) {
      el.dataImportFile.addEventListener("change", async () => {
        const file = el.dataImportFile.files && el.dataImportFile.files[0];
        const importMode = state.pendingImportMode;
        state.pendingImportMode = "";
        el.dataImportFile.value = "";
        if (!file) return;
        if (importMode === "settings") {
          await importSettingsJson(file);
          return;
        }
        if (importMode === "backup") {
          await importFullBackupJson(file);
        }
      });
    }

    el.addNickname.addEventListener("click", async () => {
      await addTracked();
    });

    el.trackedInput.addEventListener("keydown", async (event) => {
      if (handleTrackedSuggestKeydown(event)) return;
      if (event.key !== "Enter") return;
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      const raw = String(el.trackedInput.value || "").trim();
      if (!raw) return;
      closeTrackedSuggest();
      await addTracked(raw);
    });
    el.trackedInput.addEventListener("input", () => {
      clearTrackedInputInvalid();
      scheduleTrackedSuggest();
    });
    el.trackedInput.addEventListener("focus", () => {
      if (String(el.trackedInput.value || "").trim()) scheduleTrackedSuggest();
    });
    el.trackedInput.addEventListener("blur", () => {
      closeTrackedSuggest();
    });

    el.trackedScopeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextScope = normalizeTrackedScope(button.dataset.scope);
        if (nextScope === state.trackedEditScope) return;
        state.trackedEditScope = nextScope;
        state.selectedTrackedNicknameSet.clear();
        state.trackedChipsCollapsed = true;
        clearTrackedInputInvalid();
        closeTrackedSuggest();
        syncScopeSegmentedControls();
        updateTrackedAddAvailability();
        renderTrackedChips();
        updateActionButtonsState();
        refreshVisibleTrackedChannelMeta();
      });
    });

    el.hiddenSelectAll.addEventListener("click", async () => {
      await selectAllHiddenNicknames();
    });

    el.hiddenClearAll.addEventListener("click", async () => {
      await clearAllHiddenNicknames();
    });

    if (el.hiddenIncludeAll) {
      el.hiddenIncludeAll.addEventListener("click", async () => {
        await includeAllVisibleNicknames();
      });
    }

    el.hiddenFilterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const next = normalizeHiddenFilter(button.dataset.filter);
        if (next === state.hiddenFilter) return;
        state.hiddenFilter = next;
        closeNicknameMenu();
        renderHiddenChips();
        updateActionButtonsState();
      });
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
    syncUpdateBannerToggleUi();
    el.hideChatBg.checked = state.hideChatBackground;
    el.hideChatBorder.checked = state.hideChatBorder;
    el.hideExcludedHiddenChatBg.checked =
      state.hideExcludedHiddenChatBackground;
    el.hideExcludedHiddenChatBorder.checked =
      state.hideExcludedHiddenChatBorder;
    el.hidePopupBg.checked = state.hidePopupBackground;
    el.hidePopupBorder.checked = state.hidePopupBorder;
    el.hidePopupTime.checked = state.hidePopupTime;
    el.popupTimestampFormat.value = normalizePopupTimestampFormat(
      state.popupTimestampFormat,
    );
    el.popupTimestampColorMode.value = normalizePopupTimestampColorMode(
      state.popupTimestampColorMode,
    );
    syncPopupTimestampOptionControls();
    el.hideChatRanking.checked = state.hideChatRanking === true;
    el.hideChatMission.checked = state.hideChatMission === true;
    el.hideChatMissionMessage.checked = state.hideChatMissionMessage === true;
    el.hideChatPrediction.checked = state.hideChatPrediction === true;
    el.hideChatSubscription.checked = state.hideChatSubscription === true;
    el.hideChatDonation.checked = state.hideChatDonation === true;
    el.restoreBlindedChat.checked = state.restoreBlindedChat === true;
    el.showChatTimestamp.checked = state.showChatTimestamp === true;
    el.chatTimestampFormat.value = normalizeChatTimestampFormat(
      state.chatTimestampFormat,
    );
    el.chatTimestampColorMode.value = normalizeChatTimestampColorMode(
      state.chatTimestampColorMode,
    );
    syncChatTimestampOptionControls();
    el.useOriginalSpecialChatStyle.checked =
      state.useOriginalSpecialChatStyle === true;
    el.placeChatOnLeft.checked = state.placeChatOnLeft === true;
    el.enableChatWidthResize.checked = state.enableChatWidthResize === true;
    el.showPopupRoleBadgesOnly.checked = state.showPopupRoleBadgesOnly === true;
    el.showPopupFontScaleControl.checked =
      state.showPopupFontScaleControl === true;
    el.showCaptureButton.checked = state.showCaptureButton === true;
    el.enableCaptureDragSelection.checked =
      state.enableCaptureDragSelection === true;
    el.showCapturePreview.checked = state.showCapturePreview === true;
    el.captureAction.value = normalizeCaptureAction(state.captureAction);
    syncCustomSelect(el.captureAction);
    if (document.activeElement !== el.captureFilenameFormat) {
      el.captureFilenameFormat.value =
        state.captureFilenameFormat || getCaptureFilenameDefault();
    }
    renderCaptureFilenamePreview();
    syncCaptureOptionControls();
    el.popupFontScale.value = String(
      normalizePopupFontScale(state.popupFontScale),
    );
    el.chatFontScale.value = String(
      normalizeChatFontScale(state.chatFontScale),
    );
    el.detachedOriginView.value = normalizeDetachedOriginView(
      state.detachedOriginView,
    );
    syncCustomSelect(el.popupFontScale);
    syncCustomSelect(el.chatFontScale);
    syncCustomSelect(el.detachedOriginView);
    syncCustomSelect(el.popupTimestampFormat);
    syncCustomSelect(el.popupTimestampColorMode);
    syncCustomSelect(el.chatTimestampFormat);
    syncCustomSelect(el.chatTimestampColorMode);
    el.deleteWithoutConfirm.checked = state.deleteWithoutConfirm === true;
    el.hidePillButton.checked = state.hidePillButton === true;
    el.hideEmptyPill.checked = state.hideEmptyPill === true;
    el.keepPopupOpen.checked =
      state.hidePillButton !== true && state.keepPopupOpen === true;
    el.pillGlowEnabled.checked = state.pillGlowEnabled === true;
    el.chatToastEnabled.checked = state.chatToastEnabled === true;
    const chatToastBadgeTypes = new Set(
      normalizeChatToastBadgeTypes(state.chatToastBadgeTypes),
    );
    el.chatToastBadgeTypeInputs.forEach((input) => {
      input.checked = chatToastBadgeTypes.has(input.dataset.chatToastBadgeType);
    });
    syncChatToastOptionControls();
    el.compactPill.checked = state.compactPill === true;
    el.enableSessionCache.checked = state.enableSessionCache === true;
    if (el.clearCurrentChannelSession) {
      const isChzzkChannelTab =
        typeof state.scopeKey === "string" &&
        state.scopeKey.startsWith("channel:");
      el.clearCurrentChannelSession.disabled = !isChzzkChannelTab;
      setCustomTooltip(
        el.clearCurrentChannelSession,
        isChzzkChannelTab
          ? "현재 채널의 모아보기 채팅과 세션 캐시를 비웁니다"
          : "치지직 채널 탭에서만 사용할 수 있습니다",
      );
    }
    if (el.hiddenAutoPruneToggle) {
      el.hiddenAutoPruneToggle.checked =
        state.autoPruneManagedHiddenOnReconnect === true;
    }
    syncScopeSegmentedControls();
    updateTrackedAddAvailability();

    renderHiddenChips();
    renderTrackedChips();
    updateActionButtonsState();
  }

  function getCaptureFilenameDefault() {
    return window.__chzzkBadgeMoa?.captureName?.DEFAULT_FORMAT || "";
  }

  function renderCaptureFilenamePreview() {
    const names = window.__chzzkBadgeMoa?.captureName;
    if (!names || !el.captureFilenamePreview) return;
    const sample = names.buildFilename(el.captureFilenameFormat.value, {
      channel: "치지직",
      title: "오늘의 방송",
      category: "종합 게임",
      at: Date.now(),
    });
    el.captureFilenamePreview.textContent = `예: ${sample}`;
  }

  // 숫자 칸 오른쪽의 증감 버튼. 누르고 있으면 반복해서 바뀌고, 손을 떼면
  // change 를 한 번만 보내 저장한다.
  function syncNumberStepper(input) {
    const stepper = input && input.closest(".number-stepper");
    if (!stepper) return;
    const value = Number(input.value);
    const min = input.min === "" ? -Infinity : Number(input.min);
    const max = input.max === "" ? Infinity : Number(input.max);
    stepper.classList.toggle("is-disabled", input.disabled);
    stepper.querySelectorAll("[data-step]").forEach((button) => {
      const atLimit =
        button.dataset.step === "up" ? value >= max : value <= min;
      button.disabled = input.disabled || atLimit;
    });
  }

  function bindNumberSteppers() {
    document.querySelectorAll(".number-stepper").forEach((stepper) => {
      const input = stepper.querySelector('input[type="number"]');
      if (!input) return;
      let repeatTimer = 0;
      let changed = false;
      const stepOnce = (direction) => {
        const before = input.value;
        try {
          if (direction === "up") input.stepUp();
          else input.stepDown();
        } catch (_error) {
          return false;
        }
        // 부동소수 오차(0.30000000000000004 등)를 정리한다.
        input.value = String(Math.round(Number(input.value) * 10) / 10);
        syncNumberStepper(input);
        return input.value !== before;
      };
      const stop = () => {
        if (repeatTimer) clearTimeout(repeatTimer);
        repeatTimer = 0;
        if (changed) {
          changed = false;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      stepper.querySelectorAll("[data-step]").forEach((button) => {
        button.addEventListener("pointerdown", (event) => {
          if (button.disabled || event.button !== 0) return;
          event.preventDefault();
          const direction = button.dataset.step;
          changed = stepOnce(direction) || changed;
          const repeat = (delay) => {
            repeatTimer = setTimeout(() => {
              if (button.disabled) return;
              changed = stepOnce(direction) || changed;
              repeat(70);
            }, delay);
          };
          repeat(400);
        });
        ["pointerup", "pointerleave", "pointercancel"].forEach((type) => {
          button.addEventListener(type, stop);
        });
      });
      input.addEventListener("input", () => syncNumberStepper(input));
    });
  }

  // 초 단위로 보여 준다(0.1초 단위, 끝의 0 은 생략).
  function formatChatToastSeconds(ms) {
    return String(Math.round((Number(ms) || 0) / 100) / 10);
  }

  // 커스텀이 아니면 고른 빈도의 시간을 보여 주기만 하고 바꿀 수 없게 한다.
  function syncChatToastTimingInputs() {
    if (!el.chatToastGather || !el.chatToastCooldown || !el.chatToastVisible) {
      return;
    }
    const frequency = normalizeChatToastFrequency(state.chatToastFrequency);
    const isCustom = frequency === "custom";
    const timing = isCustom
      ? {
          gatherMs: state.chatToastGatherMs,
          visibleMs: state.chatToastVisibleMs,
          cooldownMs: state.chatToastCooldownMs,
          keepVisible: state.chatToastKeepVisible === true,
        }
      : { ...CHAT_TOAST_PRESET_TIMING[frequency], keepVisible: false };
    el.chatToastGather.value = formatChatToastSeconds(timing.gatherMs);
    el.chatToastVisible.value = formatChatToastSeconds(timing.visibleMs);
    el.chatToastCooldown.value = formatChatToastSeconds(timing.cooldownMs);
    const disabled = state.chatToastEnabled !== true || !isCustom;
    el.chatToastGather.disabled = disabled;
    el.chatToastCooldown.disabled = disabled;
    // 계속 표시면 표시 시간은 쓰이지 않는다.
    el.chatToastVisible.disabled = disabled || timing.keepVisible;
    el.chatToastKeepVisible.checked = timing.keepVisible;
    el.chatToastKeepVisible.disabled = disabled;
    [el.chatToastGather, el.chatToastVisible, el.chatToastCooldown].forEach(
      (input) => {
        syncNumberStepper(input);
        input
          .closest(".timing-field-main")
          ?.classList.toggle("is-disabled", input.disabled);
      },
    );
    el.chatToastTiming?.classList.toggle("is-disabled", disabled);
  }

  function syncChatToastOptionControls() {
    const disabled = state.chatToastEnabled !== true;
    const clickAction = normalizeChatToastClickAction(
      state.chatToastClickAction,
    );
    el.chatToastClickActionButtons.forEach((button) => {
      const checked = button.dataset.value === clickAction;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
      button.disabled = disabled;
    });
    el.chatToastClickAction?.classList.toggle("is-disabled", disabled);
    // 목록 순서는 알림 목록 펼치기에서만 쓰인다.
    const listOrder = normalizeChatToastListOrder(state.chatToastListOrder);
    const listOrderDisabled = disabled || clickAction !== "list";
    el.chatToastListOrderButtons.forEach((button) => {
      const checked = button.dataset.value === listOrder;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
      button.disabled = listOrderDisabled;
    });
    el.chatToastListOrder?.classList.toggle("is-disabled", listOrderDisabled);
    if (el.chatToastBackdropBlur) {
      el.chatToastBackdropBlur.checked = state.chatToastBackdropBlur !== false;
      // 알림 목록 펼치기에서만 쓰이는 옵션
      const blurDisabled = disabled || clickAction !== "list";
      el.chatToastBackdropBlur.disabled = blurDisabled;
      el.chatToastBackdropBlur
        .closest(".toggle-row")
        ?.classList.toggle("is-disabled", blurDisabled);
    }
    const frequency = normalizeChatToastFrequency(state.chatToastFrequency);
    el.chatToastFrequencyButtons.forEach((button) => {
      const checked = button.dataset.value === frequency;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
      button.disabled = disabled;
    });
    el.chatToastFrequency.classList.toggle("is-disabled", disabled);
    syncChatToastTimingInputs();
    el.chatToastBadgeTypeInputs.forEach((input) => {
      input.disabled = disabled;
    });
    el.chatToastTargets?.classList.toggle("is-disabled", disabled);
  }

  // 버튼 동작·파일 이름 형식은 모아보기 캡처와 토스트 알림 목록의 카드 캡처가
  // 함께 쓴다. 둘 중 하나라도 쓰고 있으면 고를 수 있게 한다.
  function isToastCardCaptureAvailable() {
    return (
      state.chatToastEnabled === true &&
      normalizeChatToastClickAction(state.chatToastClickAction) === "list"
    );
  }

  function syncCaptureOptionControls() {
    const disabled =
      state.showCaptureButton !== true && !isToastCardCaptureAvailable();
    el.captureAction.disabled = disabled;
    syncCustomSelect(el.captureAction);
    el.captureFilenameFormat.disabled = disabled;
    el.captureFilenameReset.disabled = disabled;
    el.captureFilenameTokens.forEach((button) => {
      button.disabled = disabled;
    });
    el.captureFilename?.classList.toggle("is-disabled", disabled);
  }

  function syncChatTimestampOptionControls() {
    const disabled = state.showChatTimestamp !== true;
    el.chatTimestampFormat.disabled = disabled;
    el.chatTimestampColorMode.disabled = disabled;
    syncCustomSelect(el.chatTimestampFormat);
    syncCustomSelect(el.chatTimestampColorMode);
  }

  function syncPopupTimestampOptionControls() {
    const disabled = state.hidePopupTime === true;
    el.popupTimestampFormat.disabled = disabled;
    el.popupTimestampColorMode.disabled = disabled;
    syncCustomSelect(el.popupTimestampFormat);
    syncCustomSelect(el.popupTimestampColorMode);
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
    const hiddenCount = Array.from(state.hiddenSet).reduce((acc, nickname) => {
      if (names.has(nickname)) return acc + 1;
      return acc;
    }, 0);
    updateHiddenCountInfo(hiddenCount, sorted.length);

    const filterCounts = { all: sorted.length, hidden: 0, channel: 0, global: 0 };
    sorted.forEach((nickname) => {
      if (state.hiddenSet.has(nickname)) filterCounts.hidden += 1;
      const mode = getNicknameExcludeMode(nickname);
      if (mode === NICKNAME_EXCLUDE_CHANNEL) filterCounts.channel += 1;
      if (mode === NICKNAME_EXCLUDE_GLOBAL) filterCounts.global += 1;
    });
    syncHiddenFilterControls(filterCounts);
    // 메뉴를 연 칩은 상태가 바뀌어 필터에서 벗어나도 메뉴를 닫을 때까지 남긴다.
    const menuNickname = state.nicknameMenu ? state.nicknameMenu.nickname : "";
    const visible = sorted.filter(
      (nickname) =>
        nickname === menuNickname || matchesHiddenFilter(nickname),
    );
    state.visibleHiddenChipNames = visible;

    if (visible.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent =
        sorted.length > 0
          ? "이 필터에 해당하는 닉네임이 없습니다."
          : state.connected
            ? "현재 채널에서 배지 채팅 닉네임이 없습니다."
            : "치지직 라이브/다시보기 탭에서 열면 닉네임 목록을 볼 수 있습니다.";
      el.hiddenChips.appendChild(empty);
      syncNicknameMenu();
      return;
    }

    const fragment = document.createDocumentFragment();
    visible.forEach((nickname) => {
      const chip = document.createElement("div");
      chip.className = "chip toggle";
      chip.dataset.nickname = nickname;
      const isHidden = state.hiddenSet.has(nickname);
      const excludeMode = getNicknameExcludeMode(nickname);
      if (isHidden) {
        chip.classList.add("active");
      }
      if (excludeMode !== NICKNAME_EXCLUDE_NONE) {
        chip.classList.add("is-excluded");
      }
      if (state.nicknameMenu && state.nicknameMenu.nickname === nickname) {
        chip.classList.add("is-menu-open");
      }
      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "chip-toggle-btn";
      toggleButton.setAttribute("aria-haspopup", "dialog");
      toggleButton.setAttribute(
        "aria-expanded",
        String(!!state.nicknameMenu && state.nicknameMenu.nickname === nickname),
      );
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
      if (excludeMode !== NICKNAME_EXCLUDE_NONE) {
        const tag = document.createElement("span");
        tag.className = "chip-state-tag";
        if (excludeMode === NICKNAME_EXCLUDE_GLOBAL) {
          tag.classList.add("is-global");
        }
        tag.textContent =
          excludeMode === NICKNAME_EXCLUDE_GLOBAL ? "전체 제외" : "제외";
        toggleButton.appendChild(tag);
      }
      const stateTexts = [];
      if (isHidden) stateTexts.push("채팅창 알림 숨김");
      if (excludeMode === NICKNAME_EXCLUDE_CHANNEL) {
        stateTexts.push("이 채널 모아보기 제외");
      } else if (excludeMode === NICKNAME_EXCLUDE_GLOBAL) {
        stateTexts.push("모든 채널 모아보기 제외");
      }
      const stateSummary = stateTexts.length
        ? stateTexts.join(" · ")
        : "알림 표시 · 모아보기 포함";
      toggleButton.setAttribute(
        "aria-label",
        `${nickname} - ${stateSummary}. 눌러서 설정`,
      );
      setCustomTooltip(toggleButton, `${stateSummary} - 클릭하여 설정 변경`);

      toggleButton.addEventListener("click", () => {
        if (state.nicknameMenu && state.nicknameMenu.nickname === nickname) {
          closeNicknameMenu();
          return;
        }
        openNicknameMenu(nickname, toggleButton);
      });
      chip.append(toggleButton);

      fragment.appendChild(chip);
    });

    el.hiddenChips.appendChild(fragment);
    syncNicknameMenu();
  }

  function resolveVerifiedMarkInfo(source) {
    const safe = source && typeof source === "object" ? source : {};
    const type = String(safe.verifiedMarkType || "")
      .trim()
      .toUpperCase();
    if (VERIFIED_MARK_INFO[type]) return VERIFIED_MARK_INFO[type];
    if (safe.verifiedMark === true) return VERIFIED_MARK_INFO.PARTNER;
    return null;
  }

  function getVerifiedMarkVariant(badge) {
    const iconUrl = String(badge?.iconUrl || "");
    const label = String(badge?.label || "").trim();
    if (iconUrl.includes("icon_challenger_mark") || label === "챌린저") {
      return "challenger";
    }
    if (
      (iconUrl.includes("icon_official_mark") && label !== "파트너") ||
      label === "오피셜"
    ) {
      return "official";
    }
    return "partner";
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
      let iconUrl = String(item.iconUrl || "").trim();
      if (!iconUrl) return;
      let label = String(item.label || "배지");
      // 예전 파트너 마크(icon_official_mark)로 저장된 배지는 파트너 이미지로 교체
      if (
        type === "partner" &&
        getVerifiedMarkVariant({ iconUrl, label }) === "partner" &&
        iconUrl !== PARTNER_MARK_URL
      ) {
        iconUrl = PARTNER_MARK_URL;
        label = VERIFIED_MARK_INFO.PARTNER.label;
      }
      const key = `${type}|${iconUrl}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        type,
        iconUrl,
        label,
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
    const partnerBadge = roleBadges.find(
      (badge) =>
        badge &&
        typeof badge === "object" &&
        String(badge.type || "").toLowerCase() === "partner",
    );
    if (partnerBadge) {
      const variant = getVerifiedMarkVariant(partnerBadge);
      if (variant === "challenger") return "#f0a830";
      return "#5ea6ff";
    }
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
      setCustomTooltip(
        toggleButton,
        state.selectedTrackedNicknameSet.has(item.value)
          ? "선택됨 - 클릭하여 선택 해제"
          : "클릭하여 선택",
      );
      toggleButton.addEventListener("click", () => {
        if (state.selectedTrackedNicknameSet.has(item.value)) {
          state.selectedTrackedNicknameSet.delete(item.value);
          chip.classList.remove("is-selected");
          setCustomTooltip(toggleButton, "클릭하여 선택");
        } else {
          state.selectedTrackedNicknameSet.add(item.value);
          chip.classList.add("is-selected");
          setCustomTooltip(toggleButton, "선택됨 - 클릭하여 선택 해제");
        }
        updateActionButtonsState();
      });

      const meta = state.trackedChannelMeta.get(item.value);
      if (!TRACKED_NICKNAME_ALLOWLIST.has(item.value)) {
        toggleButton.appendChild(createTrackedAvatar(item.value, meta));
      }
      const text = document.createElement("span");
      text.className = "chip-name";
      text.textContent = item.value;
      toggleButton.appendChild(text);
      const markInfo = meta ? VERIFIED_MARK_INFO[meta.verifiedMarkType] : null;
      if (markInfo) {
        const mark = document.createElement("img");
        mark.className = "chip-badge-icon tracked-chip-mark";
        mark.src = markInfo.iconUrl;
        mark.alt = markInfo.label;
        mark.decoding = "async";
        toggleButton.appendChild(mark);
      }
      if (
        meta &&
        meta.channelName &&
        normalizeNickname(meta.channelName) !== item.value
      ) {
        chip.classList.add("is-renamed");
        setCustomTooltip(
          toggleButton,
          `채널명이 '${meta.channelName}'(으)로 바뀌었습니다. 채팅 닉네임이 다르면 모이지 않습니다.`,
        );
      }

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
        if (item.scope === TRACKED_SCOPE_CHANNEL) {
          pruneHiddenNicknameIfOrphaned(nickname);
        }
        await persistAndApply();
        if (item.scope === TRACKED_SCOPE_CHANNEL) {
          pruneHiddenNicknameIfOrphaned(nickname);
        }
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

  async function addTracked(rawValue = "", options = {}) {
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
    const targetSet = getTrackedEditSet();
    const isGlobal = state.trackedEditScope === TRACKED_SCOPE_GLOBAL;
    const maxCount = getTrackedNicknameMaxCount();
    if (targetSet.has(nickname)) {
      markTrackedInputInvalid();
      setStatus("이미 등록된 닉네임입니다.", {
        autoResetMs: 1800,
        variant: "error",
      });
      return;
    }
    if (targetSet.size >= maxCount) {
      markTrackedInputInvalid();
      setStatus(
        `${isGlobal ? "글로벌 대상" : "채널 대상"}은 최대 ${maxCount}명까지 등록할 수 있습니다.`,
        { autoResetMs: 2200, variant: "error" },
      );
      return;
    }

    if (!isGlobal && TRACKED_NICKNAME_ALLOWLIST.has(nickname)) {
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

    // 검색 목록에서 고른 채널은 이미 받은 정보(첫 방송일)로 확인한다.
    const pickedChannel =
      options.channel &&
      normalizeNickname(options.channel.channelName) === nickname &&
      options.channel.isStreamer
        ? options.channel
        : null;
    if (!pickedChannel) setStatus("스트리머인지 확인 중...");
    const verification = pickedChannel
      ? {
          ok: true,
          channelId: pickedChannel.channelId,
          channelName: pickedChannel.channelName,
          imageUrl: pickedChannel.imageUrl,
          verifiedMark: pickedChannel.verifiedMarkType !== "",
          verifiedMarkType: pickedChannel.verifiedMarkType,
        }
      : await verifyLiveStreamerByNickname(nickname);
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
    if (verification.channelId) {
      setTrackedChannelMeta(nickname, {
        channelId: verification.channelId,
        channelName: verification.channelName || nickname,
        imageUrl: verification.imageUrl,
        verifiedMarkType: verification.verifiedMarkType,
      });
    }

    const verifiedMarkInfo = resolveVerifiedMarkInfo(verification);
    if (!isGlobal && verifiedMarkInfo) {
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
          iconUrl: verifiedMarkInfo.iconUrl,
          label: verifiedMarkInfo.label,
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
    await saveTrackedChannelMeta();
    renderHiddenChips();
    renderTrackedChips();
    updateActionButtonsState();
    setStatus(`${nickname} 님을 모아보기 대상에 추가했습니다.`, {
      autoResetMs: 1800,
    });
  }

  // ── 모아보기 대상: 채널 검색 목록 / 칩용 채널 정보 ─────────────────────

  function getDefaultProfileUrl() {
    return document.documentElement.dataset.theme === "light"
      ? DEFAULT_PROFILE_URLS.light
      : DEFAULT_PROFILE_URLS.dark;
  }

  // 작은 썸네일 크기로 받아 트래픽을 줄인다.
  function getProfileThumbUrl(imageUrl) {
    const raw = String(imageUrl || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") return "";
      url.searchParams.set("type", "f60_60_na");
      return url.toString();
    } catch (_error) {
      return "";
    }
  }

  function normalizeVerifiedMarkType(channel) {
    const type = String(channel?.verifiedMarkType || "")
      .trim()
      .toUpperCase();
    if (VERIFIED_MARK_INFO[type]) return type;
    return channel?.verifiedMark === true ? "PARTNER" : "";
  }

  function parseTrackedChannelMeta(raw) {
    const map = new Map();
    if (!raw || typeof raw !== "object") return map;
    Object.entries(raw).forEach(([key, value]) => {
      const nickname = normalizeNickname(key);
      if (!nickname || !value || typeof value !== "object") return;
      map.set(nickname, {
        channelId: String(value.channelId || ""),
        channelName: String(value.channelName || ""),
        imageUrl: String(value.imageUrl || ""),
        verifiedMarkType: VERIFIED_MARK_INFO[value.verifiedMarkType]
          ? value.verifiedMarkType
          : "",
        checkedAt: Number(value.checkedAt) || 0,
      });
    });
    return map;
  }

  function setTrackedChannelMeta(nickname, info) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return false;
    const previous = state.trackedChannelMeta.get(normalized);
    const next = {
      channelId: String(info.channelId || previous?.channelId || ""),
      channelName: String(info.channelName || previous?.channelName || ""),
      imageUrl: String(info.imageUrl || ""),
      verifiedMarkType: VERIFIED_MARK_INFO[info.verifiedMarkType]
        ? info.verifiedMarkType
        : "",
      checkedAt: Date.now(),
    };
    state.trackedChannelMeta.set(normalized, next);
    return (
      !previous ||
      previous.channelId !== next.channelId ||
      previous.channelName !== next.channelName ||
      previous.imageUrl !== next.imageUrl ||
      previous.verifiedMarkType !== next.verifiedMarkType
    );
  }

  // 어느 범위에도 등록되어 있지 않은 닉네임의 정보는 지운다.
  function collectAllTrackedNicknames() {
    const names = new Set();
    const raw = state.rawSettings || {};
    const byChannel =
      raw.trackedTargetsByChannel &&
      typeof raw.trackedTargetsByChannel === "object"
        ? raw.trackedTargetsByChannel
        : {};
    Object.values(byChannel).forEach((entry) => {
      const list = Array.isArray(entry?.nicknames) ? entry.nicknames : [];
      list.forEach((value) => {
        const nickname = normalizeNickname(value);
        if (nickname) names.add(nickname);
      });
    });
    (Array.isArray(raw.trackedGlobalNicknames)
      ? raw.trackedGlobalNicknames
      : []
    ).forEach((value) => {
      const nickname = normalizeNickname(value);
      if (nickname) names.add(nickname);
    });
    state.trackedScopedNicknameSet.forEach((nickname) => names.add(nickname));
    state.trackedGlobalNicknameSet.forEach((nickname) => names.add(nickname));
    return names;
  }

  async function saveTrackedChannelMeta() {
    const tracked = collectAllTrackedNicknames();
    const data = {};
    state.trackedChannelMeta.forEach((meta, nickname) => {
      if (!tracked.has(nickname)) {
        state.trackedChannelMeta.delete(nickname);
        return;
      }
      data[nickname] = meta;
    });
    await setStorageLocal(TRACKED_CHANNEL_META_KEY, data);
  }

  function createTrackedAvatar(nickname, meta) {
    const img = document.createElement("img");
    img.className = "tracked-chip-avatar";
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    const thumb = getProfileThumbUrl(meta && meta.imageUrl);
    img.src = thumb || getDefaultProfileUrl();
    if (thumb) {
      img.addEventListener(
        "error",
        () => {
          img.src = getDefaultProfileUrl();
          // 이미지 주소가 더 이상 유효하지 않으면 채널 정보를 다시 받는다.
          refreshTrackedChannelMeta([nickname], { force: true });
        },
        { once: true },
      );
    }
    return img;
  }

  async function fetchChzzkContent(url, signal) {
    const response = await fetch(url, signal ? { signal } : undefined);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (!json || Number(json.code) !== 200) throw new Error("API_ERROR");
    return json.content;
  }

  async function fetchTrackedChannelInfo(nickname, meta) {
    if (meta && meta.channelId) {
      const content = await fetchChzzkContent(
        `${CHZZK_API_BASE}/service/v1/channels/${encodeURIComponent(meta.channelId)}`,
      );
      if (!content || !content.channelId) return null;
      return {
        channelId: String(content.channelId),
        channelName: String(content.channelName || ""),
        imageUrl: String(content.channelImageUrl || ""),
        verifiedMarkType: normalizeVerifiedMarkType(content),
      };
    }
    // 예전에 추가해 채널 ID 를 모르는 항목은 이름으로 한 번 찾는다.
    const result = await fetchExactChannelIdByNickname(nickname);
    if (!result.ok) {
      if (result.reason === "API_ERROR") throw new Error("API_ERROR");
      return null;
    }
    return {
      channelId: result.channelId,
      channelName: result.channelName,
      imageUrl: result.imageUrl,
      verifiedMarkType: normalizeVerifiedMarkType(result),
    };
  }

  async function refreshTrackedChannelMeta(nicknames, options = {}) {
    const force = options.force === true;
    const now = Date.now();
    const queue = [];
    nicknames.forEach((value) => {
      const nickname = normalizeNickname(value);
      if (!nickname || TRACKED_NICKNAME_ALLOWLIST.has(nickname)) return;
      if (state.trackedMetaRefreshing.has(nickname)) return;
      if (state.trackedMetaCheckedThisSession.has(nickname)) return;
      const meta = state.trackedChannelMeta.get(nickname);
      if (!force && meta && now - meta.checkedAt < TRACKED_META_REFRESH_MS) {
        return;
      }
      queue.push(nickname);
    });
    const targets = queue.slice(0, TRACKED_META_REFRESH_LIMIT);
    if (targets.length === 0) return;
    targets.forEach((nickname) => {
      state.trackedMetaRefreshing.add(nickname);
      state.trackedMetaCheckedThisSession.add(nickname);
    });

    let changed = false;
    let cursor = 0;
    const worker = async () => {
      while (cursor < targets.length) {
        const nickname = targets[cursor];
        cursor += 1;
        const meta = state.trackedChannelMeta.get(nickname);
        try {
          const info = await fetchTrackedChannelInfo(nickname, meta);
          if (info) {
            if (setTrackedChannelMeta(nickname, info)) changed = true;
          } else if (meta) {
            // 채널을 못 찾으면 이전 정보를 두고 확인 시각만 갱신한다.
            meta.checkedAt = Date.now();
          } else {
            state.trackedChannelMeta.set(nickname, {
              channelId: "",
              channelName: "",
              imageUrl: "",
              verifiedMarkType: "",
              checkedAt: Date.now(),
            });
          }
        } catch (_error) {
          // 네트워크 오류는 다음에 설정창을 열 때 다시 시도한다.
        } finally {
          state.trackedMetaRefreshing.delete(nickname);
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(TRACKED_META_REFRESH_CONCURRENCY, targets.length) },
        worker,
      ),
    );
    await saveTrackedChannelMeta();
    if (changed) renderTrackedChips();
  }

  function refreshVisibleTrackedChannelMeta() {
    const nicknames = getVisibleTrackedNicknameItems().map((item) => item.value);
    refreshTrackedChannelMeta(nicknames);
  }

  function formatFollowerCount(value) {
    const count = Number(value) || 0;
    if (count >= 10000) {
      const man = count / 10000;
      return `${man >= 100 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, "")}만`;
    }
    return count.toLocaleString("ko-KR");
  }

  async function searchChannelsForSuggest(keyword, signal) {
    const url =
      `${CHZZK_API_BASE}/service/v1/search/channels` +
      `?keyword=${encodeURIComponent(keyword)}&offset=0&size=${TRACKED_SUGGEST_FETCH_SIZE}`;
    const content = await fetchChzzkContent(url, signal);
    const data = Array.isArray(content?.data) ? content.data : [];
    const target = normalizeChannelName(keyword);
    const items = data
      .map((entry) => entry?.channel || entry)
      .filter((channel) => channel && channel.channelId && channel.channelName)
      .map((channel) => ({
        channelId: String(channel.channelId),
        channelName: String(channel.channelName).trim(),
        imageUrl: String(channel.channelImageUrl || ""),
        verifiedMarkType: normalizeVerifiedMarkType(channel),
        followerCount: Number(channel.followerCount) || 0,
        openLive: channel.openLive === true,
        // 첫 방송일이 없으면 방송 기록이 없는 채널(시청자)이다.
        isStreamer: Boolean(channel.firstBroadcastDate),
      }))
      .filter((item) => item.isStreamer);
    // 입력과 이름이 같은 채널을 맨 위로.
    items.sort((a, b) => {
      const aExact = normalizeChannelName(a.channelName) === target ? 1 : 0;
      const bExact = normalizeChannelName(b.channelName) === target ? 1 : 0;
      return bExact - aExact;
    });
    return items.slice(0, TRACKED_SUGGEST_LIMIT);
  }

  function scheduleTrackedSuggest() {
    const suggest = state.trackedSuggest;
    if (suggest.timer) {
      clearTimeout(suggest.timer);
      suggest.timer = null;
    }
    const keyword = String(el.trackedInput.value || "").trim();
    if (
      !keyword ||
      !canUseTrackedAdd() ||
      TRACKED_NICKNAME_ALLOWLIST.has(normalizeNickname(keyword))
    ) {
      closeTrackedSuggest();
      return;
    }
    const cached = suggest.cache.get(keyword);
    if (cached) {
      showTrackedSuggest(keyword, "done", cached);
      return;
    }
    if (!suggest.open || suggest.status !== "done") {
      showTrackedSuggest(keyword, "loading", []);
    }
    suggest.timer = setTimeout(() => {
      suggest.timer = null;
      runTrackedSuggest(keyword);
    }, TRACKED_SUGGEST_DEBOUNCE_MS);
  }

  async function runTrackedSuggest(keyword) {
    const suggest = state.trackedSuggest;
    if (suggest.controller) suggest.controller.abort();
    const controller = new AbortController();
    suggest.controller = controller;
    const seq = (suggest.seq += 1);
    let items = null;
    let failed = false;
    try {
      items = await searchChannelsForSuggest(keyword, controller.signal);
    } catch (error) {
      if (error && error.name === "AbortError") return;
      failed = true;
    }
    if (seq !== suggest.seq) return;
    suggest.controller = null;
    if (String(el.trackedInput.value || "").trim() !== keyword) return;
    if (document.activeElement !== el.trackedInput) return;
    if (failed) {
      showTrackedSuggest(keyword, "error", []);
      return;
    }
    suggest.cache.set(keyword, items);
    if (suggest.cache.size > TRACKED_SUGGEST_CACHE_LIMIT) {
      suggest.cache.delete(suggest.cache.keys().next().value);
    }
    showTrackedSuggest(keyword, "done", items);
  }

  function ensureTrackedSuggest() {
    if (el.trackedSuggest instanceof HTMLElement) return el.trackedSuggest;
    const list = document.createElement("div");
    list.id = "tracked-suggest";
    list.className = "tracked-suggest";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "채널 검색 결과");
    list.hidden = true;
    // 목록을 눌러도 입력창 포커스를 잃지 않게 한다(blur 로 닫히는 것 방지).
    list.addEventListener("mousedown", (event) => event.preventDefault());
    document.body.appendChild(list);
    window.addEventListener("resize", positionTrackedSuggest);
    document.addEventListener(
      "scroll",
      (event) => {
        if (event.target instanceof Node && list.contains(event.target)) return;
        positionTrackedSuggest();
      },
      true,
    );
    el.trackedSuggest = list;
    return list;
  }

  function isTrackedSuggestItemAdded(item) {
    return getTrackedEditSet().has(normalizeNickname(item.channelName));
  }

  function showTrackedSuggest(keyword, status, items) {
    const suggest = state.trackedSuggest;
    const list = ensureTrackedSuggest();
    const keepActive =
      suggest.keyword === keyword && suggest.items === items
        ? suggest.activeIndex
        : -1;
    suggest.open = true;
    suggest.keyword = keyword;
    suggest.status = status;
    suggest.items = items;
    suggest.activeIndex =
      keepActive >= 0
        ? keepActive
        : items.findIndex((item) => !isTrackedSuggestItemAdded(item));
    dismissCustomTooltipFor(el.trackedInput);
    renderTrackedSuggest();
    list.hidden = false;
    el.trackedInput.setAttribute("aria-expanded", "true");
    positionTrackedSuggest();
  }

  function closeTrackedSuggest() {
    const suggest = state.trackedSuggest;
    if (suggest.timer) {
      clearTimeout(suggest.timer);
      suggest.timer = null;
    }
    if (suggest.controller) {
      suggest.controller.abort();
      suggest.controller = null;
    }
    suggest.seq += 1;
    suggest.open = false;
    suggest.activeIndex = -1;
    if (el.trackedSuggest) el.trackedSuggest.hidden = true;
    if (el.trackedInput) {
      el.trackedInput.setAttribute("aria-expanded", "false");
      el.trackedInput.removeAttribute("aria-activedescendant");
    }
  }

  function renderTrackedSuggest() {
    const suggest = state.trackedSuggest;
    const list = ensureTrackedSuggest();
    list.innerHTML = "";
    if (suggest.status !== "done" || suggest.items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tracked-suggest-empty";
      empty.textContent =
        suggest.status === "loading"
          ? "채널 검색 중..."
          : suggest.status === "error"
            ? "채널 검색에 실패했습니다. Enter 로 직접 추가할 수 있습니다."
            : "일치하는 스트리머가 없습니다.";
      list.appendChild(empty);
      el.trackedInput.removeAttribute("aria-activedescendant");
      return;
    }
    suggest.items.forEach((item, index) => {
      const added = isTrackedSuggestItemAdded(item);
      const option = document.createElement("div");
      option.className = "tracked-suggest-option";
      option.id = `tracked-suggest-option-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === suggest.activeIndex));
      if (added) option.setAttribute("aria-disabled", "true");

      const avatar = document.createElement("img");
      avatar.className = "tracked-suggest-avatar";
      avatar.alt = "";
      avatar.decoding = "async";
      avatar.src = getProfileThumbUrl(item.imageUrl) || getDefaultProfileUrl();
      avatar.addEventListener(
        "error",
        () => {
          avatar.src = getDefaultProfileUrl();
        },
        { once: true },
      );

      const main = document.createElement("span");
      main.className = "tracked-suggest-main";
      const nameRow = document.createElement("span");
      nameRow.className = "tracked-suggest-name";
      const nameText = document.createElement("span");
      nameText.className = "tracked-suggest-name-text";
      nameText.textContent = item.channelName;
      nameRow.appendChild(nameText);
      const markInfo = VERIFIED_MARK_INFO[item.verifiedMarkType];
      if (markInfo) {
        const mark = document.createElement("img");
        mark.className = "tracked-suggest-mark";
        mark.src = markInfo.iconUrl;
        mark.alt = markInfo.label;
        mark.title = "";
        nameRow.appendChild(mark);
      }
      const sub = document.createElement("span");
      sub.className = "tracked-suggest-sub";
      sub.textContent = `팔로워 ${formatFollowerCount(item.followerCount)}`;
      if (item.openLive) {
        const live = document.createElement("span");
        live.className = "tracked-suggest-live";
        live.textContent = "LIVE";
        sub.appendChild(live);
      }
      main.append(nameRow, sub);
      option.append(avatar, main);

      if (added) {
        const stateText = document.createElement("span");
        stateText.className = "tracked-suggest-state";
        stateText.textContent = "추가됨";
        option.appendChild(stateText);
      }

      option.addEventListener("pointermove", () => {
        if (added || suggest.activeIndex === index) return;
        suggest.activeIndex = index;
        syncTrackedSuggestActive();
      });
      option.addEventListener("click", () => {
        if (added) return;
        selectTrackedSuggestItem(item);
      });
      list.appendChild(option);
    });
    syncTrackedSuggestActive();
  }

  function syncTrackedSuggestActive() {
    const suggest = state.trackedSuggest;
    if (!el.trackedSuggest) return;
    let activeId = "";
    el.trackedSuggest
      .querySelectorAll(".tracked-suggest-option")
      .forEach((option, index) => {
        const active = index === suggest.activeIndex;
        option.setAttribute("aria-selected", String(active));
        if (active) {
          activeId = option.id;
          option.scrollIntoView({ block: "nearest" });
        }
      });
    if (activeId) {
      el.trackedInput.setAttribute("aria-activedescendant", activeId);
    } else {
      el.trackedInput.removeAttribute("aria-activedescendant");
    }
  }

  // 처리했으면 true. Enter 는 고른 항목이 있을 때만 가로챈다.
  function handleTrackedSuggestKeydown(event) {
    const suggest = state.trackedSuggest;
    if (!suggest.open) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeTrackedSuggest();
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = suggest.items;
      if (suggest.status !== "done" || items.length === 0) return true;
      const step = event.key === "ArrowDown" ? 1 : -1;
      let index = suggest.activeIndex;
      for (let i = 0; i < items.length; i += 1) {
        index = (index + step + items.length) % items.length;
        if (!isTrackedSuggestItemAdded(items[index])) break;
      }
      if (!isTrackedSuggestItemAdded(items[index])) {
        suggest.activeIndex = index;
        syncTrackedSuggestActive();
      }
      return true;
    }
    if (event.key === "Enter") {
      if (event.isComposing || event.keyCode === 229) return true;
      const item =
        suggest.status === "done" ? suggest.items[suggest.activeIndex] : null;
      if (!item || isTrackedSuggestItemAdded(item)) return false;
      event.preventDefault();
      selectTrackedSuggestItem(item);
      return true;
    }
    return false;
  }

  async function selectTrackedSuggestItem(item) {
    closeTrackedSuggest();
    el.trackedInput.value = item.channelName;
    await addTracked(item.channelName, { channel: item });
  }

  function positionTrackedSuggest() {
    const list = el.trackedSuggest;
    if (!list || list.hidden || !el.trackedInput) return;
    const rect = el.trackedInput.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      closeTrackedSuggest();
      return;
    }
    const margin = 8;
    const gap = 4;
    const viewportHeight = window.innerHeight;
    list.style.left = `${Math.round(rect.left)}px`;
    list.style.width = `${Math.round(rect.width)}px`;
    const spaceBelow = viewportHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const placeAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(80, placeAbove ? spaceAbove : spaceBelow);
    list.style.maxHeight = `${Math.round(maxHeight)}px`;
    list.classList.toggle("is-above", placeAbove);
    const height = Math.min(list.scrollHeight, maxHeight);
    list.style.top = `${Math.round(
      placeAbove ? rect.top - gap - height : rect.bottom + gap,
    )}px`;
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

  function normalizeHiddenFilter(value) {
    return ["hidden", "channel", "global"].includes(value) ? value : "all";
  }

  function matchesHiddenFilter(nickname) {
    switch (state.hiddenFilter) {
      case "hidden":
        return state.hiddenSet.has(nickname);
      case "channel":
        return getNicknameExcludeMode(nickname) === NICKNAME_EXCLUDE_CHANNEL;
      case "global":
        return getNicknameExcludeMode(nickname) === NICKNAME_EXCLUDE_GLOBAL;
      default:
        return true;
    }
  }

  function syncHiddenFilterControls(counts) {
    el.hiddenFilterButtons.forEach((button) => {
      const filter = normalizeHiddenFilter(button.dataset.filter);
      button.setAttribute("aria-pressed", String(filter === state.hiddenFilter));
      const countEl = button.querySelector(".nickname-filter-count");
      if (countEl) countEl.textContent = String(counts[filter] || 0);
    });
  }

  // 일괄 버튼 대상: 지금 목록에 보이는 닉네임
  function getBulkHiddenTargets() {
    const visible = state.visibleHiddenChipNames || [];
    return {
      // 제외된 닉네임은 채팅이 모이지 않아 알림도 없으므로 숨길 필요가 없다.
      toHide: visible.filter(
        (nickname) =>
          !state.hiddenSet.has(nickname) &&
          getNicknameExcludeMode(nickname) === NICKNAME_EXCLUDE_NONE,
      ),
      toUnhide: visible.filter((nickname) => state.hiddenSet.has(nickname)),
      toInclude: visible.filter(
        (nickname) =>
          getNicknameExcludeMode(nickname) !== NICKNAME_EXCLUDE_NONE,
      ),
    };
  }

  async function selectAllHiddenNicknames() {
    const names = getBulkHiddenTargets().toHide;
    if (names.length === 0) return;
    closeNicknameMenu();
    names.forEach((nickname) => {
      state.hiddenSet.add(nickname);
      state.managedHiddenNicknameSet.add(nickname);
    });
    await persistAndApply();
    renderHiddenChips();
    updateActionButtonsState();
    setStatus(`닉네임 ${names.length}개의 채팅창 알림을 숨겼습니다.`, {
      autoResetMs: 1800,
    });
  }

  async function clearAllHiddenNicknames() {
    const names = getBulkHiddenTargets().toUnhide;
    if (names.length === 0) return;
    closeNicknameMenu();
    names.forEach((nickname) => state.hiddenSet.delete(nickname));
    await persistAndApply();
    renderHiddenChips();
    updateActionButtonsState();
    setStatus(`닉네임 ${names.length}개의 채팅창 알림 숨김을 해제했습니다.`, {
      autoResetMs: 1800,
    });
  }

  async function includeAllVisibleNicknames() {
    const names = getBulkHiddenTargets().toInclude;
    if (names.length === 0) return;
    closeNicknameMenu();
    names.forEach((nickname) => {
      state.excludedCollectScopedNicknameSet.delete(nickname);
      state.excludedCollectGlobalNicknameSet.delete(nickname);
    });
    rebuildEffectiveExcludedCollectNicknames();
    await persistAndApply();
    render();
    setStatus(`닉네임 ${names.length}개의 채팅을 다시 모아봅니다.`, {
      autoResetMs: 1800,
    });
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

  function getNicknameExcludeMode(nickname) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return NICKNAME_EXCLUDE_NONE;
    if (state.excludedCollectGlobalNicknameSet.has(normalized)) {
      return NICKNAME_EXCLUDE_GLOBAL;
    }
    if (state.excludedCollectScopedNicknameSet.has(normalized)) {
      return NICKNAME_EXCLUDE_CHANNEL;
    }
    return NICKNAME_EXCLUDE_NONE;
  }

  async function setNicknameHidden(nickname, hidden) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return;
    if (state.hiddenSet.has(normalized) === hidden) return;
    if (hidden) {
      state.hiddenSet.add(normalized);
      state.managedHiddenNicknameSet.add(normalized);
    } else {
      state.hiddenSet.delete(normalized);
    }
    await persistAndApply();
    renderHiddenChips();
    updateActionButtonsState();
  }

  // 모아보기 제외 범위를 바꾼다. 한 닉네임은 "포함 / 이 채널 제외 / 모든 채널 제외"
  // 중 하나의 상태만 가진다.
  async function setNicknameExcludeMode(nickname, nextMode) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return;
    const currentMode = getNicknameExcludeMode(normalized);
    if (currentMode === nextMode) return;

    let pruneExcludedEntries = false;
    if (currentMode === NICKNAME_EXCLUDE_NONE) {
      const action = await askExcludeConfirmAction();
      if (action === "cancel") {
        syncNicknameMenu();
        return;
      }
      pruneExcludedEntries = action === "prune";
    }

    state.excludedCollectScopedNicknameSet.delete(normalized);
    state.excludedCollectGlobalNicknameSet.delete(normalized);
    if (nextMode === NICKNAME_EXCLUDE_CHANNEL) {
      state.excludedCollectScopedNicknameSet.add(normalized);
    } else if (nextMode === NICKNAME_EXCLUDE_GLOBAL) {
      state.excludedCollectGlobalNicknameSet.add(normalized);
    }
    rebuildEffectiveExcludedCollectNicknames();

    await persistAndApply({ pruneExcludedEntries });
    render();
    const message =
      nextMode === NICKNAME_EXCLUDE_GLOBAL
        ? `${normalized} 님을 모든 채널의 모아보기에서 제외했습니다.`
        : nextMode === NICKNAME_EXCLUDE_CHANNEL
          ? `${normalized} 님을 이 채널의 모아보기에서 제외했습니다.`
          : `${normalized} 님의 채팅을 다시 모아봅니다.`;
    setStatus(message, { autoResetMs: 1800 });
  }

  function ensureNicknameMenu() {
    if (el.nicknameMenu instanceof HTMLElement) return el.nicknameMenu;
    const menu = document.createElement("div");
    menu.className = "nickname-menu";
    menu.setAttribute("role", "dialog");
    menu.tabIndex = -1;
    menu.hidden = true;

    const title = document.createElement("div");
    title.className = "nickname-menu-title";
    menu.appendChild(title);

    const hideRow = document.createElement("label");
    hideRow.className = "toggle-row nickname-menu-hide";
    const hideInput = document.createElement("input");
    hideInput.type = "checkbox";
    const hideText = document.createElement("span");
    hideText.textContent = "채팅창 알림 숨김";
    hideRow.append(hideInput, hideText);
    menu.appendChild(hideRow);

    const hideHint = document.createElement("p");
    hideHint.className = "nickname-menu-hint";
    hideHint.id = "nickname-menu-hide-hint";
    hideHint.textContent = HIDE_HINT_DEFAULT;
    hideInput.setAttribute("aria-describedby", hideHint.id);
    menu.appendChild(hideHint);

    const groupLabel = document.createElement("div");
    groupLabel.className = "nickname-menu-group-label";
    groupLabel.id = "nickname-menu-collect-label";
    groupLabel.textContent = "모아보기";
    menu.appendChild(groupLabel);

    const group = document.createElement("div");
    group.className = "nickname-menu-options";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", groupLabel.id);
    const options = [
      [NICKNAME_EXCLUDE_NONE, "모아보기에 포함"],
      [NICKNAME_EXCLUDE_CHANNEL, "이 채널에서만 제외"],
      [NICKNAME_EXCLUDE_GLOBAL, "모든 채널에서 제외"],
    ];
    const optionButtons = options.map(([mode, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nickname-menu-option";
      button.dataset.mode = mode;
      button.setAttribute("role", "radio");
      const mark = document.createElement("span");
      mark.className = "nickname-menu-radio";
      mark.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = label;
      button.append(mark, text);
      button.addEventListener("click", async () => {
        const target = state.nicknameMenu && state.nicknameMenu.nickname;
        if (!target) return;
        await setNicknameExcludeMode(target, mode);
      });
      group.appendChild(button);
      return button;
    });
    group.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const index = optionButtons.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const next =
        optionButtons[(Math.max(0, index) + step + optionButtons.length) % optionButtons.length];
      next.focus();
    });
    menu.appendChild(group);

    hideInput.addEventListener("change", async () => {
      const target = state.nicknameMenu && state.nicknameMenu.nickname;
      if (!target) return;
      await setNicknameHidden(target, hideInput.checked);
    });

    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeNicknameMenu({ restoreFocus: true });
    });

    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!state.nicknameMenu) return;
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (menu.contains(target)) return;
        if (el.excludeConfirmModal && el.excludeConfirmModal.contains(target)) {
          return;
        }
        const chip =
          target instanceof Element ? target.closest(".chip[data-nickname]") : null;
        if (chip && chip.dataset.nickname === state.nicknameMenu.nickname) {
          return;
        }
        closeNicknameMenu();
      },
      true,
    );
    // 확장 팝업 창은 내용에 맞춰 크기가 바뀌므로 닫지 않고 위치만 다시 잡는다.
    window.addEventListener("resize", () => positionNicknameMenu());
    document.addEventListener(
      "scroll",
      (event) => {
        if (!state.nicknameMenu) return;
        if (event.target instanceof Node && menu.contains(event.target)) return;
        positionNicknameMenu();
      },
      true,
    );

    document.body.appendChild(menu);
    el.nicknameMenu = menu;
    el.nicknameMenuTitle = title;
    el.nicknameMenuHideInput = hideInput;
    el.nicknameMenuHideRow = hideRow;
    el.nicknameMenuHideHint = hideHint;
    el.nicknameMenuOptions = optionButtons;
    return menu;
  }

  function findNicknameChipButton(nickname) {
    if (!el.hiddenChips) return null;
    const chip = Array.from(
      el.hiddenChips.querySelectorAll(".chip[data-nickname]"),
    ).find((node) => node.dataset.nickname === nickname);
    return chip ? chip.querySelector(".chip-toggle-btn") : null;
  }

  function openNicknameMenu(nickname, anchor) {
    const menu = ensureNicknameMenu();
    state.nicknameMenu = { nickname };
    dismissCustomTooltipFor(anchor);
    menu.hidden = false;
    menu.setAttribute("aria-label", `${nickname} 설정`);
    renderHiddenChips();
    try {
      menu.focus({ preventScroll: true });
    } catch (_error) {
      menu.focus();
    }
  }

  function closeNicknameMenu(options = {}) {
    if (!state.nicknameMenu) return;
    const nickname = state.nicknameMenu.nickname;
    state.nicknameMenu = null;
    const hadFocus =
      el.nicknameMenu instanceof HTMLElement &&
      el.nicknameMenu.contains(document.activeElement);
    if (el.nicknameMenu) el.nicknameMenu.hidden = true;
    // 필터에서 벗어난 칩을 메뉴가 열린 동안 남겨 두었으면 이제 정리한다.
    if (
      state.hiddenFilter !== "all" &&
      el.hiddenChips &&
      !matchesHiddenFilter(nickname)
    ) {
      renderHiddenChips();
      updateActionButtonsState();
      return;
    }
    if (el.hiddenChips) {
      el.hiddenChips.querySelectorAll(".chip.is-menu-open").forEach((chip) => {
        chip.classList.remove("is-menu-open");
        const button = chip.querySelector(".chip-toggle-btn");
        if (button) button.setAttribute("aria-expanded", "false");
      });
    }
    if (options.restoreFocus || hadFocus) {
      const button = findNicknameChipButton(nickname);
      if (button) {
        try {
          button.focus({ preventScroll: true });
        } catch (_error) {
          button.focus();
        }
      }
    }
  }

  // 메뉴 내용을 현재 상태에 맞추고 칩 아래(공간이 없으면 위)에 붙인다.
  function syncNicknameMenu() {
    if (!state.nicknameMenu || !(el.nicknameMenu instanceof HTMLElement)) {
      return;
    }
    const nickname = state.nicknameMenu.nickname;
    if (!findNicknameChipButton(nickname)) {
      closeNicknameMenu();
      return;
    }
    el.nicknameMenuTitle.textContent = nickname;
    el.nicknameMenuHideInput.checked = state.hiddenSet.has(nickname);
    const mode = getNicknameExcludeMode(nickname);
    // 제외 중에는 채팅이 모이지 않아 알림도 뜨지 않는다. 숨김 상태는 다시
    // 모아볼 때를 위해 그대로 두고 바꾸지만 못하게 한다.
    const excluded = mode !== NICKNAME_EXCLUDE_NONE;
    el.nicknameMenuHideInput.disabled = excluded;
    el.nicknameMenuHideRow.classList.toggle("is-disabled", excluded);
    el.nicknameMenuHideHint.textContent = excluded
      ? HIDE_HINT_EXCLUDED
      : HIDE_HINT_DEFAULT;
    el.nicknameMenuOptions.forEach((button) => {
      const checked = button.dataset.mode === mode;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
    });
    positionNicknameMenu();
  }

  function positionNicknameMenu() {
    if (!state.nicknameMenu || !(el.nicknameMenu instanceof HTMLElement)) {
      return;
    }
    const anchor = findNicknameChipButton(state.nicknameMenu.nickname);
    const chip = anchor ? anchor.closest(".chip") : null;
    if (!chip) return;
    const menu = el.nicknameMenu;
    const rect = chip.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      closeNicknameMenu();
      return;
    }
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      closeNicknameMenu();
      return;
    }
    const gap = 4;
    const margin = 8;
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, viewportWidth - menuWidth - margin),
    );
    const spaceBelow = viewportHeight - rect.bottom - gap - margin;
    const placeAbove = spaceBelow < menuHeight && rect.top - gap - margin > spaceBelow;
    const top = placeAbove
      ? Math.max(margin, rect.top - gap - menuHeight)
      : Math.min(rect.bottom + gap, Math.max(margin, viewportHeight - menuHeight - margin));
    menu.classList.toggle("is-above", placeAbove);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }

  async function deleteAllTrackedTargets() {
    const visibleItems = getVisibleTrackedNicknameItems();
    if (visibleItems.length === 0) return;
    const removedChannelNicknames = new Set();
    visibleItems.forEach((item) => {
      const nickname = normalizeNickname(item.value);
      if (!nickname) return;
      removeTrackedNicknameByScope(nickname, item.scope);
      if (item.scope === TRACKED_SCOPE_CHANNEL) {
        removedChannelNicknames.add(nickname);
      }
    });
    state.selectedTrackedNicknameSet.clear();
    rebuildEffectiveTrackedNicknames();
    removedChannelNicknames.forEach((nickname) => {
      pruneHiddenNicknameIfOrphaned(nickname);
    });
    await persistAndApply();
    removedChannelNicknames.forEach((nickname) => {
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
      const targetSet =
        targetScope === TRACKED_SCOPE_GLOBAL
          ? state.trackedGlobalNicknameSet
          : state.trackedScopedNicknameSet;
      const beforeScoped = targetSet.has(normalized);
      removeTrackedNicknameByScope(normalized, targetScope);
      const afterScoped = targetSet.has(normalized);
      if (beforeScoped !== afterScoped) {
        changed = true;
      }
    });
    const prunedNicknames = selectedNicknames
      .map((nickname) => normalizeNickname(nickname))
      .filter(
        (nickname) =>
          !!nickname && visibleScopeMap.get(nickname) === TRACKED_SCOPE_CHANNEL,
      );
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
    if (state.trackedNicknameSet.has(normalized)) return;
    const currentNicknames = getCurrentChannelNicknames();
    if (currentNicknames.has(normalized)) return;
    state.hiddenSet.delete(normalized);
    state.excludedCollectScopedNicknameSet.delete(normalized);
    rebuildEffectiveExcludedCollectNicknames();
    state.managedHiddenNicknameSet.delete(normalized);
    state.hiddenChipMetaByNickname.delete(normalized);
  }

  function updateActionButtonsState() {
    const currentNicknames = getCurrentChannelNicknames();
    const bulk = getBulkHiddenTargets();
    const isExcludeFilter =
      state.hiddenFilter === "channel" || state.hiddenFilter === "global";
    // 제외 필터에서는 알림 숨김이 의미가 없으므로 다시 모아보기만 보인다.
    if (el.hiddenSelectAll) el.hiddenSelectAll.hidden = isExcludeFilter;
    if (el.hiddenClearAll) el.hiddenClearAll.hidden = isExcludeFilter;
    if (el.hiddenSelectAll) {
      el.hiddenSelectAll.disabled = bulk.toHide.length === 0;
      el.hiddenSelectAll.textContent = bulk.toHide.length
        ? `모두 숨김 (${bulk.toHide.length})`
        : "모두 숨김";
    }
    if (el.hiddenClearAll) {
      el.hiddenClearAll.disabled = bulk.toUnhide.length === 0;
      el.hiddenClearAll.textContent = bulk.toUnhide.length
        ? `모두 해제 (${bulk.toUnhide.length})`
        : "모두 해제";
    }
    if (el.hiddenIncludeAll) {
      el.hiddenIncludeAll.hidden = !isExcludeFilter;
      el.hiddenIncludeAll.disabled = bulk.toInclude.length === 0;
      el.hiddenIncludeAll.textContent = bulk.toInclude.length
        ? `모두 다시 모아보기 (${bulk.toInclude.length})`
        : "모두 다시 모아보기";
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
    const visibleTrackedCount = getVisibleTrackedNicknameItems().length;
    if (el.trackedDeleteAll) {
      el.trackedDeleteAll.disabled = visibleTrackedCount === 0;
    }
    if (el.trackedDeleteSelected) {
      el.trackedDeleteSelected.disabled =
        state.selectedTrackedNicknameSet.size === 0;
    }
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
    const scope = state.trackedEditScope;
    const source = getTrackedEditSet();
    Array.from(source)
      .map((value) => normalizeNickname(value))
      .filter(Boolean)
      .forEach((nickname) => {
        map.set(nickname, {
          value: nickname,
          scope,
        });
      });

    return Array.from(map.values()).sort((a, b) =>
      a.value.localeCompare(b.value, "ko"),
    );
  }

  function removeTrackedNicknameByScope(nickname, scope) {
    const normalized = normalizeNickname(nickname);
    if (!normalized) return;
    if (scope === TRACKED_SCOPE_GLOBAL) {
      state.trackedGlobalNicknameSet.delete(normalized);
      return;
    }
    state.trackedScopedNicknameSet.delete(normalized);
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
      hideExcludedHiddenChatBackground:
        state.hideExcludedHiddenChatBackground,
      hideExcludedHiddenChatBorder: state.hideExcludedHiddenChatBorder,
      hidePopupBackground: state.hidePopupBackground,
      hidePopupBorder: state.hidePopupBorder,
      hidePopupTime: state.hidePopupTime,
      popupTimestampFormat: normalizePopupTimestampFormat(
        state.popupTimestampFormat,
      ),
      popupTimestampColorMode: normalizePopupTimestampColorMode(
        state.popupTimestampColorMode,
      ),
      hideChatRanking: state.hideChatRanking === true,
      hideChatMission: state.hideChatMission === true,
      hideChatMissionMessage: state.hideChatMissionMessage === true,
      hideChatPrediction: state.hideChatPrediction === true,
      hideChatSubscription: state.hideChatSubscription === true,
      hideChatDonation: state.hideChatDonation === true,
      restoreBlindedChat: state.restoreBlindedChat === true,
      showChatTimestamp: state.showChatTimestamp === true,
      chatTimestampFormat: normalizeChatTimestampFormat(
        state.chatTimestampFormat,
      ),
      chatTimestampColorMode: normalizeChatTimestampColorMode(
        state.chatTimestampColorMode,
      ),
      useOriginalSpecialChatStyle: state.useOriginalSpecialChatStyle === true,
      placeChatOnLeft: state.placeChatOnLeft === true,
      enableChatWidthResize: state.enableChatWidthResize === true,
      chatWidth: normalizeChatWidth(state.chatWidth),
      showPopupRoleBadgesOnly: state.showPopupRoleBadgesOnly === true,
      showPopupFontScaleControl: state.showPopupFontScaleControl === true,
      showCaptureButton: state.showCaptureButton === true,
      enableCaptureDragSelection: state.enableCaptureDragSelection === true,
      showCapturePreview: state.showCapturePreview === true,
      captureAction: normalizeCaptureAction(state.captureAction),
      captureFilenameFormat: normalizeCaptureFilenameFormat(
        state.captureFilenameFormat,
      ),
      popupFontScale: normalizePopupFontScale(state.popupFontScale),
      chatFontScale: normalizeChatFontScale(state.chatFontScale),
      deleteWithoutConfirm: state.deleteWithoutConfirm === true,
      hidePillButton: state.hidePillButton === true,
      hideEmptyPill: state.hideEmptyPill === true,
      keepPopupOpen:
        state.hidePillButton === true ? false : state.keepPopupOpen === true,
      pillGlowEnabled: state.pillGlowEnabled,
      chatToastEnabled: state.chatToastEnabled === true,
      chatToastFrequency: normalizeChatToastFrequency(state.chatToastFrequency),
      chatToastGatherMs: normalizeChatToastGatherMs(state.chatToastGatherMs),
      chatToastCooldownMs: normalizeChatToastCooldownMs(
        state.chatToastCooldownMs,
      ),
      chatToastVisibleMs: normalizeChatToastVisibleMs(state.chatToastVisibleMs),
      chatToastKeepVisible: state.chatToastKeepVisible === true,
      chatToastClickAction: normalizeChatToastClickAction(
        state.chatToastClickAction,
      ),
      chatToastListOrder: normalizeChatToastListOrder(state.chatToastListOrder),
      chatToastBackdropBlur: state.chatToastBackdropBlur !== false,
      chatToastBadgeTypes: normalizeChatToastBadgeTypes(
        state.chatToastBadgeTypes,
      ),
      compactPill: state.compactPill === true,
      enableSessionCache: state.enableSessionCache,
      detachedOriginView: normalizeDetachedOriginView(state.detachedOriginView),
      newTrackedNicknames: forceTrackedNicknames,
      hiddenPillNicknames: Array.from(state.hiddenSet),
      excludedCollectNicknames: Array.from(
        state.excludedCollectScopedNicknameSet,
      ),
      excludedCollectScopedNicknames: Array.from(
        state.excludedCollectScopedNicknameSet,
      ),
      excludedCollectGlobalNicknames: Array.from(
        state.excludedCollectGlobalNicknameSet,
      ),
      trackedNicknames: Array.from(state.trackedScopedNicknameSet),
      trackedScopedNicknames: Array.from(state.trackedScopedNicknameSet),
      trackedGlobalNicknames: Array.from(state.trackedGlobalNicknameSet),
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
    state.hideExcludedHiddenChatBackground =
      settings.hideExcludedHiddenChatBackground === true;
    state.hideExcludedHiddenChatBorder =
      settings.hideExcludedHiddenChatBorder === true;
    state.hidePopupBackground = settings.hidePopupBackground === true;
    state.hidePopupBorder = settings.hidePopupBorder === true;
    state.hidePopupTime = settings.hidePopupTime === true;
    if (
      Object.prototype.hasOwnProperty.call(settings, "popupTimestampFormat")
    ) {
      state.popupTimestampFormat = normalizePopupTimestampFormat(
        settings.popupTimestampFormat,
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(settings, "popupTimestampColorMode")
    ) {
      state.popupTimestampColorMode = normalizePopupTimestampColorMode(
        settings.popupTimestampColorMode,
      );
    }
    state.hideChatRanking = settings.hideChatRanking === true;
    state.hideChatMission = settings.hideChatMission === true;
    state.hideChatMissionMessage = settings.hideChatMissionMessage === true;
    state.hideChatPrediction = settings.hideChatPrediction === true;
    state.hideChatSubscription = settings.hideChatSubscription === true;
    state.hideChatDonation = settings.hideChatDonation === true;
    state.restoreBlindedChat = settings.restoreBlindedChat === true;
    state.showChatTimestamp = settings.showChatTimestamp === true;
    if (Object.prototype.hasOwnProperty.call(settings, "chatTimestampFormat")) {
      state.chatTimestampFormat = normalizeChatTimestampFormat(
        settings.chatTimestampFormat,
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(settings, "chatTimestampColorMode")
    ) {
      state.chatTimestampColorMode = normalizeChatTimestampColorMode(
        settings.chatTimestampColorMode,
      );
    }
    state.useOriginalSpecialChatStyle =
      settings.useOriginalSpecialChatStyle === true;
    state.placeChatOnLeft = settings.placeChatOnLeft === true;
    state.enableChatWidthResize = settings.enableChatWidthResize === true;
    state.chatWidth = normalizeChatWidth(settings.chatWidth);
    state.showPopupRoleBadgesOnly = settings.showPopupRoleBadgesOnly === true;
    state.showPopupFontScaleControl =
      settings.showPopupFontScaleControl === true;
    state.showCaptureButton = settings.showCaptureButton === true;
    state.enableCaptureDragSelection =
      settings.enableCaptureDragSelection === true;
    state.showCapturePreview = settings.showCapturePreview === true;
    state.captureAction = normalizeCaptureAction(settings.captureAction);
    state.captureFilenameFormat = normalizeCaptureFilenameFormat(
      settings.captureFilenameFormat,
    );
    state.popupFontScale = normalizePopupFontScale(settings.popupFontScale);
    state.chatFontScale = normalizeChatFontScale(settings.chatFontScale);
    state.deleteWithoutConfirm = settings.deleteWithoutConfirm === true;
    state.hidePillButton = settings.hidePillButton === true;
    if (Object.prototype.hasOwnProperty.call(settings, "hideEmptyPill")) {
      state.hideEmptyPill = settings.hideEmptyPill === true;
    }
    state.keepPopupOpen =
      state.hidePillButton !== true && settings.keepPopupOpen === true;
    state.pillGlowEnabled = settings.pillGlowEnabled !== false;
    state.chatToastEnabled = settings.chatToastEnabled === true;
    state.chatToastFrequency = normalizeChatToastFrequency(
      settings.chatToastFrequency,
    );
    state.chatToastGatherMs = normalizeChatToastGatherMs(
      settings.chatToastGatherMs,
    );
    state.chatToastCooldownMs = normalizeChatToastCooldownMs(
      settings.chatToastCooldownMs,
    );
    state.chatToastVisibleMs = normalizeChatToastVisibleMs(
      settings.chatToastVisibleMs,
    );
    state.chatToastKeepVisible = settings.chatToastKeepVisible === true;
    state.chatToastClickAction = normalizeChatToastClickAction(
      settings.chatToastClickAction,
    );
    state.chatToastListOrder = normalizeChatToastListOrder(
      settings.chatToastListOrder,
    );
    state.chatToastBackdropBlur = settings.chatToastBackdropBlur !== false;
    state.chatToastBadgeTypes = normalizeChatToastBadgeTypes(
      settings.chatToastBadgeTypes,
    );
    if (Object.prototype.hasOwnProperty.call(settings, "compactPill")) {
      state.compactPill = settings.compactPill === true;
    }
    state.detachedOriginView = normalizeDetachedOriginView(
      settings.detachedOriginView,
    );
    if (typeof settings.enableSessionCache === "boolean") {
      state.enableSessionCache = settings.enableSessionCache;
    }
    if (typeof settings.autoPruneManagedHiddenOnReconnect === "boolean") {
      state.autoPruneManagedHiddenOnReconnect =
        settings.autoPruneManagedHiddenOnReconnect;
    }
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
    const hasGlobalTracked = Array.isArray(raw.trackedGlobalNicknames);
    const hasGlobalExcluded = Array.isArray(raw.excludedCollectGlobalNicknames);

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
    }
    if (!hasGlobalTracked) {
      const trackedGlobalNicknames = Array.isArray(
        settings.trackedGlobalNicknames,
      )
        ? settings.trackedGlobalNicknames
        : [];
      state.trackedGlobalNicknameSet = new Set(
        trackedGlobalNicknames
          .map((value) => normalizeNickname(value))
          .filter(Boolean)
          .slice(0, MAX_TRACKED_GLOBAL_NICKNAMES),
      );
    }
    rebuildEffectiveTrackedNicknames();

    if (!hasScopedExcluded) {
      const excluded = Array.isArray(settings.excludedCollectScopedNicknames)
        ? settings.excludedCollectScopedNicknames
        : Array.isArray(settings.excludedCollectNicknames)
          ? settings.excludedCollectNicknames
          : [];
      state.excludedCollectScopedNicknameSet = new Set(
        excluded.map((value) => normalizeNickname(value)).filter(Boolean),
      );
    }
    if (!hasGlobalExcluded) {
      const excludedGlobal = Array.isArray(
        settings.excludedCollectGlobalNicknames,
      )
        ? settings.excludedCollectGlobalNicknames
        : [];
      state.excludedCollectGlobalNicknameSet = new Set(
        excludedGlobal.map((value) => normalizeNickname(value)).filter(Boolean),
      );
    }
    rebuildEffectiveExcludedCollectNicknames();
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
    const trackedGlobal = Array.isArray(raw.trackedGlobalNicknames)
      ? raw.trackedGlobalNicknames
      : [];
    const excludedGlobal = Array.isArray(raw.excludedCollectGlobalNicknames)
      ? raw.excludedCollectGlobalNicknames
      : [];
    const hiddenChipMetaByNickname =
      hiddenChipMetaByScope[scopeKey] &&
      typeof hiddenChipMetaByScope[scopeKey] === "object"
        ? hiddenChipMetaByScope[scopeKey]
        : {};

    state.hideChatBackground = raw.hideChatBackground === true;
    state.hideChatBorder = raw.hideChatBorder === true;
    state.hideExcludedHiddenChatBackground =
      raw.hideExcludedHiddenChatBackground === true;
    state.hideExcludedHiddenChatBorder =
      raw.hideExcludedHiddenChatBorder === true;
    state.hidePopupBackground = raw.hidePopupBackground === true;
    state.hidePopupBorder = raw.hidePopupBorder === true;
    state.hidePopupTime = raw.hidePopupTime === true;
    state.popupTimestampFormat = normalizePopupTimestampFormat(
      raw.popupTimestampFormat,
    );
    state.popupTimestampColorMode = normalizePopupTimestampColorMode(
      raw.popupTimestampColorMode,
    );
    state.hideChatRanking = raw.hideChatRanking === true;
    state.hideChatMission = raw.hideChatMission === true;
    state.hideChatMissionMessage = raw.hideChatMissionMessage === true;
    state.hideChatPrediction = raw.hideChatPrediction === true;
    state.hideChatSubscription = raw.hideChatSubscription === true;
    state.hideChatDonation = raw.hideChatDonation === true;
    state.restoreBlindedChat = raw.restoreBlindedChat === true;
    state.showChatTimestamp = raw.showChatTimestamp === true;
    state.chatTimestampFormat = normalizeChatTimestampFormat(
      raw.chatTimestampFormat,
    );
    state.chatTimestampColorMode = normalizeChatTimestampColorMode(
      raw.chatTimestampColorMode,
    );
    state.useOriginalSpecialChatStyle =
      raw.useOriginalSpecialChatStyle === true;
    state.placeChatOnLeft = raw.placeChatOnLeft === true;
    state.enableChatWidthResize = raw.enableChatWidthResize === true;
    state.chatWidth = normalizeChatWidth(raw.chatWidth);
    state.showPopupRoleBadgesOnly = raw.showPopupRoleBadgesOnly === true;
    state.showPopupFontScaleControl = raw.showPopupFontScaleControl === true;
    state.showCaptureButton = raw.showCaptureButton === true;
    state.enableCaptureDragSelection = raw.enableCaptureDragSelection === true;
    state.showCapturePreview = raw.showCapturePreview === true;
    state.captureAction = normalizeCaptureAction(raw.captureAction);
    state.captureFilenameFormat = normalizeCaptureFilenameFormat(
      raw.captureFilenameFormat,
    );
    state.popupFontScale = normalizePopupFontScale(raw.popupFontScale);
    state.chatFontScale = normalizeChatFontScale(raw.chatFontScale);
    if (typeof raw.deleteWithoutConfirm === "boolean") {
      state.deleteWithoutConfirm = raw.deleteWithoutConfirm === true;
    } else if (typeof raw.confirmDeleteDialog === "boolean") {
      state.deleteWithoutConfirm = raw.confirmDeleteDialog !== true;
    } else {
      state.deleteWithoutConfirm = false;
    }
    state.hidePillButton = raw.hidePillButton === true;
    state.hideEmptyPill = raw.hideEmptyPill === true;
    state.keepPopupOpen =
      state.hidePillButton !== true &&
      (raw.keepPopupOpen === true || raw.keepPillExpanded === true);
    state.pillGlowEnabled = raw.pillGlowEnabled !== false;
    state.chatToastEnabled = raw.chatToastEnabled === true;
    state.chatToastFrequency = normalizeChatToastFrequency(
      raw.chatToastFrequency,
    );
    state.chatToastGatherMs = normalizeChatToastGatherMs(raw.chatToastGatherMs);
    state.chatToastCooldownMs = normalizeChatToastCooldownMs(
      raw.chatToastCooldownMs,
    );
    state.chatToastVisibleMs = normalizeChatToastVisibleMs(
      raw.chatToastVisibleMs,
    );
    state.chatToastKeepVisible = raw.chatToastKeepVisible === true;
    state.chatToastClickAction = normalizeChatToastClickAction(
      raw.chatToastClickAction,
    );
    state.chatToastListOrder = normalizeChatToastListOrder(
      raw.chatToastListOrder,
    );
    state.chatToastBackdropBlur = raw.chatToastBackdropBlur !== false;
    state.chatToastBadgeTypes = normalizeChatToastBadgeTypes(
      raw.chatToastBadgeTypes,
    );
    state.compactPill = raw.compactPill === true;
    state.enableSessionCache = raw.enableSessionCache === true;
    state.detachedOriginView = normalizeDetachedOriginView(
      raw.detachedOriginView,
    );
    state.autoPruneManagedHiddenOnReconnect =
      raw.autoPruneManagedHiddenOnReconnect === true;
    state.popupTheme = normalizePopupTheme(raw.popupTheme);

    state.hiddenSet = new Set(
      hidden.map((value) => normalizeNickname(value)).filter(Boolean),
    );
    state.trackedScopedNicknameSet = new Set(
      (Array.isArray(tracked.nicknames) ? tracked.nicknames : [])
        .map((value) => normalizeNickname(value))
        .filter(Boolean),
    );
    state.trackedGlobalNicknameSet = new Set(
      trackedGlobal
        .map((value) => normalizeNickname(value))
        .filter(Boolean)
        .slice(0, MAX_TRACKED_GLOBAL_NICKNAMES),
    );
    state.excludedCollectScopedNicknameSet = new Set(
      excluded.map((value) => normalizeNickname(value)).filter(Boolean),
    );
    state.excludedCollectGlobalNicknameSet = new Set(
      excludedGlobal.map((value) => normalizeNickname(value)).filter(Boolean),
    );
    rebuildEffectiveExcludedCollectNicknames();
    const managedHidden = Array.isArray(managedHiddenByScope[scopeKey])
      ? managedHiddenByScope[scopeKey]
      : [];
    state.managedHiddenNicknameSet = new Set(
      managedHidden.map((value) => normalizeNickname(value)).filter(Boolean),
    );
    state.hiddenSet.forEach((nickname) =>
      state.managedHiddenNicknameSet.add(nickname),
    );
    state.excludedCollectScopedNicknameSet.forEach((nickname) =>
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
    raw.hideExcludedHiddenChatBackground =
      state.hideExcludedHiddenChatBackground === true;
    raw.hideExcludedHiddenChatBorder =
      state.hideExcludedHiddenChatBorder === true;
    raw.hidePopupBackground = state.hidePopupBackground === true;
    raw.hidePopupBorder = state.hidePopupBorder === true;
    raw.hidePopupTime = state.hidePopupTime === true;
    raw.popupTimestampFormat = normalizePopupTimestampFormat(
      state.popupTimestampFormat,
    );
    raw.popupTimestampColorMode = normalizePopupTimestampColorMode(
      state.popupTimestampColorMode,
    );
    raw.hideChatRanking = state.hideChatRanking === true;
    raw.hideChatMission = state.hideChatMission === true;
    raw.hideChatMissionMessage = state.hideChatMissionMessage === true;
    raw.hideChatPrediction = state.hideChatPrediction === true;
    raw.hideChatSubscription = state.hideChatSubscription === true;
    raw.hideChatDonation = state.hideChatDonation === true;
    raw.restoreBlindedChat = state.restoreBlindedChat === true;
    raw.showChatTimestamp = state.showChatTimestamp === true;
    raw.chatTimestampFormat = normalizeChatTimestampFormat(
      state.chatTimestampFormat,
    );
    raw.chatTimestampColorMode = normalizeChatTimestampColorMode(
      state.chatTimestampColorMode,
    );
    raw.useOriginalSpecialChatStyle =
      state.useOriginalSpecialChatStyle === true;
    raw.placeChatOnLeft = state.placeChatOnLeft === true;
    raw.enableChatWidthResize = state.enableChatWidthResize === true;
    raw.chatWidth = normalizeChatWidth(state.chatWidth);
    raw.showPopupRoleBadgesOnly = state.showPopupRoleBadgesOnly === true;
    raw.showPopupFontScaleControl = state.showPopupFontScaleControl === true;
    raw.showCaptureButton = state.showCaptureButton === true;
    raw.enableCaptureDragSelection = state.enableCaptureDragSelection === true;
    raw.showCapturePreview = state.showCapturePreview === true;
    raw.captureAction = normalizeCaptureAction(state.captureAction);
    raw.captureFilenameFormat = normalizeCaptureFilenameFormat(
      state.captureFilenameFormat,
    );
    raw.popupFontScale = normalizePopupFontScale(state.popupFontScale);
    raw.chatFontScale = normalizeChatFontScale(state.chatFontScale);
    raw.deleteWithoutConfirm = state.deleteWithoutConfirm === true;
    delete raw.confirmDeleteDialog;
    raw.hidePillButton = state.hidePillButton === true;
    raw.hideEmptyPill = state.hideEmptyPill === true;
    raw.keepPopupOpen =
      state.hidePillButton === true ? false : state.keepPopupOpen === true;
    delete raw.keepPillExpanded;
    raw.pillGlowEnabled = state.pillGlowEnabled !== false;
    raw.chatToastEnabled = state.chatToastEnabled === true;
    raw.chatToastFrequency = normalizeChatToastFrequency(
      state.chatToastFrequency,
    );
    raw.chatToastGatherMs = normalizeChatToastGatherMs(state.chatToastGatherMs);
    raw.chatToastCooldownMs = normalizeChatToastCooldownMs(
      state.chatToastCooldownMs,
    );
    raw.chatToastVisibleMs = normalizeChatToastVisibleMs(
      state.chatToastVisibleMs,
    );
    raw.chatToastKeepVisible = state.chatToastKeepVisible === true;
    raw.chatToastClickAction = normalizeChatToastClickAction(
      state.chatToastClickAction,
    );
    raw.chatToastListOrder = normalizeChatToastListOrder(
      state.chatToastListOrder,
    );
    raw.chatToastBackdropBlur = state.chatToastBackdropBlur !== false;
    raw.chatToastBadgeTypes = normalizeChatToastBadgeTypes(
      state.chatToastBadgeTypes,
    );
    raw.compactPill = state.compactPill === true;
    raw.enableSessionCache = state.enableSessionCache === true;
    raw.detachedOriginView = normalizeDetachedOriginView(
      state.detachedOriginView,
    );
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
      state.excludedCollectScopedNicknameSet,
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
    raw.trackedGlobalNicknames = Array.from(
      state.trackedGlobalNicknameSet,
    ).slice(0, MAX_TRACKED_GLOBAL_NICKNAMES);
    raw.excludedCollectGlobalNicknames = Array.from(
      state.excludedCollectGlobalNicknameSet,
    );

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

  function normalizeTrackedScope(value) {
    return value === TRACKED_SCOPE_GLOBAL
      ? TRACKED_SCOPE_GLOBAL
      : TRACKED_SCOPE_CHANNEL;
  }

  function getTrackedEditSet() {
    return state.trackedEditScope === TRACKED_SCOPE_GLOBAL
      ? state.trackedGlobalNicknameSet
      : state.trackedScopedNicknameSet;
  }

  function rebuildEffectiveExcludedCollectNicknames() {
    state.excludedCollectNicknameSet = new Set([
      ...state.excludedCollectScopedNicknameSet,
      ...state.excludedCollectGlobalNicknameSet,
    ]);
  }

  function syncScopeSegmentedControls() {
    el.trackedScopeButtons.forEach((button) => {
      const active =
        normalizeTrackedScope(button.dataset.scope) === state.trackedEditScope;
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function getTrackedNicknameMaxCount() {
    return state.trackedEditScope === TRACKED_SCOPE_GLOBAL
      ? MAX_TRACKED_GLOBAL_NICKNAMES
      : MAX_TRACKED_NICKNAMES_PER_SCOPE;
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
    if (state.trackedEditScope === TRACKED_SCOPE_GLOBAL) return true;
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
      el.trackedInput.placeholder =
        state.trackedEditScope === TRACKED_SCOPE_GLOBAL
          ? `글로벌 닉네임 입력 (최대 ${MAX_TRACKED_GLOBAL_NICKNAMES}명)`
          : "닉네임 입력 (스트리머만 추가 가능)";
      return;
    }
    el.trackedInput.placeholder =
      "치지직 채널/라이브/다시보기 탭에서만 추가 가능";
  }

  function rebuildEffectiveTrackedNicknames() {
    state.trackedNicknameSet = new Set([
      ...state.trackedScopedNicknameSet,
      ...state.trackedGlobalNicknameSet,
    ]);
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

    const channelInfo = {
      channelId: searchResult.channelId,
      channelName: searchResult.channelName,
      imageUrl: searchResult.imageUrl,
      verifiedMark: searchResult.verifiedMark === true,
      verifiedMarkType: String(searchResult.verifiedMarkType || ""),
    };
    // 검색 결과의 첫 방송일이 있으면 방송 기록 조회를 건너뛴다.
    if (searchResult.firstBroadcastDate) {
      return { ok: true, ...channelInfo };
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

    return { ok: true, ...channelInfo };
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
      const verifiedMarkType =
        matched && matched.channel
          ? String(matched.channel.verifiedMarkType || "").trim()
          : "";
      return {
        ok: true,
        channelId,
        reason: "",
        verifiedMark,
        verifiedMarkType,
        channelName: String(matched.channel.channelName || "").trim(),
        imageUrl: String(matched.channel.channelImageUrl || "").trim(),
        firstBroadcastDate: String(
          matched.channel.firstBroadcastDate || "",
        ).trim(),
      };
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

  function normalizeSettingsTab(value) {
    const normalized = String(value || "").trim();
    if (
      normalized === "targets" ||
      normalized === "capture" ||
      normalized === "data"
    ) {
      return normalized;
    }
    return "display";
  }

  function loadSettingsTab() {
    try {
      return normalizeSettingsTab(
        window.localStorage.getItem(SETTINGS_TAB_STORAGE_KEY),
      );
    } catch (_error) {
      return "display";
    }
  }

  function applySettingsTab(tab) {
    const next = normalizeSettingsTab(tab);
    if (next !== state.settingsTab) closeNicknameMenu();
    state.settingsTab = next;
    (el.settingsTabButtons || []).forEach((button) => {
      const active = button.dataset.tab === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    (el.settingsTabPanels || []).forEach((panel) => {
      const active = panel.id === `tab-panel-${next}`;
      panel.classList.toggle("is-active", active);
      if (active) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
    try {
      window.localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, next);
    } catch (_error) {}
  }

  function handleSettingsTabKeydown(event) {
    const buttons = el.settingsTabButtons || [];
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0 || buttons.length === 0) return;

    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % buttons.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = buttons.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextButton = buttons[nextIndex];
    applySettingsTab(nextButton.dataset.tab);
    nextButton.focus();
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

  function normalizeChatFontScale(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_CHAT_FONT_SCALE;
    const clamped = Math.min(
      MAX_CHAT_FONT_SCALE,
      Math.max(MIN_CHAT_FONT_SCALE, numeric),
    );
    return Math.round(clamped * 100) / 100;
  }

  function normalizeChatTimestampFormat(value) {
    return value === "12h-en" || value === "12h-ko" ? value : "24h";
  }

  // 새 채팅 토스트 알림 빈도: 자주(high) | 보통(normal, 기본) | 낮음(low) | 커스텀(custom)
  function normalizeChatToastFrequency(value) {
    return value === "high" || value === "low" || value === "custom"
      ? value
      : "normal";
  }

  // 커스텀 빈도 시간(ms). 0.1초 단위로 맞추고 범위를 벗어나면 끝값으로.
  function normalizeChatToastDurationMs(value, fallback, maxMs) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(maxMs, Math.max(0, Math.round(num / 100) * 100));
  }

  function normalizeChatToastGatherMs(value) {
    return normalizeChatToastDurationMs(
      value,
      CHAT_TOAST_PRESET_TIMING.normal.gatherMs,
      CHAT_TOAST_GATHER_MAX_MS,
    );
  }

  function normalizeChatToastCooldownMs(value) {
    return normalizeChatToastDurationMs(
      value,
      CHAT_TOAST_PRESET_TIMING.normal.cooldownMs,
      CHAT_TOAST_COOLDOWN_MAX_MS,
    );
  }

  function normalizeChatToastClickAction(value) {
    return value === "list" ? "list" : "popup";
  }

  function normalizeChatToastListOrder(value) {
    return value === "oldest" ? "oldest" : "newest";
  }

  // 분할 버튼(라디오 그룹): 클릭하거나 방향키로 옆 항목을 바로 고른다.
  function bindSegmentedRadioGroup(buttons, onSelect) {
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => onSelect(button.dataset.value));
      button.addEventListener("keydown", (event) => {
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (!step) return;
        event.preventDefault();
        const next = buttons[(index + step + buttons.length) % buttons.length];
        next.focus();
        onSelect(next.dataset.value);
      });
    });
  }

  function normalizeChatToastVisibleMs(value) {
    return Math.max(
      CHAT_TOAST_VISIBLE_MIN_MS,
      normalizeChatToastDurationMs(
        value,
        CHAT_TOAST_PRESET_TIMING.normal.visibleMs,
        CHAT_TOAST_VISIBLE_MAX_MS,
      ),
    );
  }

  function normalizeChatToastBadgeTypes(value) {
    if (!Array.isArray(value)) return CHAT_TOAST_BADGE_TYPES.slice();
    return CHAT_TOAST_BADGE_TYPES.filter((type) => value.includes(type));
  }

  // 캡처 버튼 동작: 파일 저장(기본) | 클립보드 복사
  function normalizeCaptureAction(value) {
    return value === "copy" ? "copy" : "save";
  }

  // 캡처 파일 이름 형식. 기본 형식과 같거나 비어 있으면 ""(기본 형식)으로 저장한다.
  function normalizeCaptureFilenameFormat(value) {
    const text =
      typeof value === "string"
        ? value.replace(/[\r\n]+/g, " ").trim().slice(0, 200)
        : "";
    return text === getCaptureFilenameDefault() ? "" : text;
  }

  function normalizeChatTimestampColorMode(value) {
    return value === "contrast" ? "contrast" : "default";
  }

  function normalizePopupTimestampFormat(value) {
    return normalizeChatTimestampFormat(value);
  }

  function normalizePopupTimestampColorMode(value) {
    return normalizeChatTimestampColorMode(value);
  }

  function normalizeDetachedOriginView(value) {
    const v = String(value || "").trim();
    return v === "pill" || v === "keep" ? v : "hide";
  }

  function normalizeChatWidth(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.max(MIN_CHAT_WIDTH, Math.round(numeric));
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

  function openDataImportPicker(mode) {
    if (!el.dataImportFile) return;
    state.pendingImportMode = mode === "backup" ? "backup" : "settings";
    el.dataImportFile.value = "";
    el.dataImportFile.click();
  }

  function getExtensionVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      return String((manifest && manifest.version) || "");
    } catch (_error) {
      return "";
    }
  }

  function getExportTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "-",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("");
  }

  function downloadJsonFile(value, filename) {
    const json = `${JSON.stringify(value, null, 2)}\n`;
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function readJsonFile(file) {
    if (!file || typeof file.text !== "function") {
      throw new Error("JSON 파일을 읽을 수 없습니다.");
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new Error("가져올 파일은 25MB 이하여야 합니다.");
    }
    let parsed = null;
    try {
      parsed = JSON.parse(await file.text());
    } catch (_error) {
      throw new Error("올바른 JSON 파일이 아닙니다.");
    }
    if (!isPlainObject(parsed)) {
      throw new Error("백업 데이터 형식이 올바르지 않습니다.");
    }
    return parsed;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function validateExportHeader(data, expectedFormat) {
    if (
      data.format !== expectedFormat ||
      data.formatVersion !== DATA_EXPORT_FORMAT_VERSION
    ) {
      throw new Error("이 확장 프로그램에서 만든 호환 JSON 파일이 아닙니다.");
    }
  }

  function getPopupLocalStorageSnapshot() {
    const snapshot = {};
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        snapshot[key] = window.localStorage.getItem(key);
      }
    } catch (_error) {}
    return snapshot;
  }

  function restorePopupLocalStorage(snapshot, options = {}) {
    if (!isPlainObject(snapshot)) return;
    try {
      if (options.replace === true) window.localStorage.clear();
      Object.entries(snapshot).forEach(([key, value]) => {
        if (typeof value !== "string") return;
        window.localStorage.setItem(key, value);
      });
    } catch (_error) {}
  }

  async function getStorageAreaSnapshot(areaName) {
    const area = chrome.storage && chrome.storage[areaName];
    if (!area || typeof area.get !== "function") return {};
    try {
      const result = await area.get(null);
      return isPlainObject(result) ? result : {};
    } catch (_error) {
      return {};
    }
  }

  async function replaceStorageArea(areaName, snapshot) {
    const area = chrome.storage && chrome.storage[areaName];
    if (!area || typeof area.clear !== "function") return false;
    await area.clear();
    if (isPlainObject(snapshot) && Object.keys(snapshot).length > 0) {
      await area.set(snapshot);
    }
    return true;
  }

  async function flushCurrentSettings() {
    updateRawSettingsFromState();
    await setStorageLocal(STORAGE_SETTINGS_KEY, state.rawSettings);
  }

  async function exportSettingsJson() {
    try {
      await flushCurrentSettings();
      const localSnapshot = await getStorageAreaSnapshot("local");
      const settingsLocal = {};
      SETTINGS_STORAGE_KEYS.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(localSnapshot, key)) return;
        settingsLocal[key] = localSnapshot[key];
      });
      settingsLocal[UPDATE_BANNER_ENABLED_KEY] =
        state.updateBannerEnabled !== false;
      const settingsTab = window.localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
      const data = {
        format: SETTINGS_EXPORT_FORMAT,
        formatVersion: DATA_EXPORT_FORMAT_VERSION,
        extensionVersion: getExtensionVersion(),
        exportedAt: new Date().toISOString(),
        storageLocal: settingsLocal,
        popupLocalStorage: settingsTab
          ? { [SETTINGS_TAB_STORAGE_KEY]: settingsTab }
          : {},
      };
      downloadJsonFile(
        data,
        `badge-moa-chat-settings-${getExportTimestamp()}.json`,
      );
      setStatus("현재 설정을 JSON으로 내보냈습니다.", {
        autoResetMs: 2200,
      });
    } catch (_error) {
      setStatus("설정을 내보내지 못했습니다.", {
        variant: "error",
        autoResetMs: 2600,
      });
    }
  }

  async function importSettingsJson(file) {
    try {
      const data = await readJsonFile(file);
      validateExportHeader(data, SETTINGS_EXPORT_FORMAT);
      if (!isPlainObject(data.storageLocal)) {
        throw new Error("설정 데이터가 없습니다.");
      }
      const importedSettings = {};
      SETTINGS_STORAGE_KEYS.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(data.storageLocal, key)) {
          return;
        }
        importedSettings[key] = data.storageLocal[key];
      });
      if (!isPlainObject(importedSettings[STORAGE_SETTINGS_KEY])) {
        throw new Error("모아보기 설정 데이터가 없습니다.");
      }
      const confirmed = await askGenericConfirm(
        "설정 가져오기",
        "현재 설정을 선택한 JSON 파일의 설정으로 교체합니다.",
        { okLabel: "가져오기", cancelLabel: "취소", danger: false },
      );
      if (!confirmed) return;

      const missingSettingKeys = SETTINGS_STORAGE_KEYS.filter(
        (key) => !Object.prototype.hasOwnProperty.call(importedSettings, key),
      );
      await chrome.storage.local.set(importedSettings);
      if (missingSettingKeys.length > 0) {
        await chrome.storage.local.remove(missingSettingKeys);
      }
      restorePopupLocalStorage(data.popupLocalStorage);
      applySettingsTab(loadSettingsTab());
      state.rawSettings = normalizeRawSettings(
        importedSettings[STORAGE_SETTINGS_KEY],
      );
      if (
        Object.prototype.hasOwnProperty.call(
          importedSettings,
          UPDATE_BANNER_ENABLED_KEY,
        )
      ) {
        state.updateBannerEnabled =
          importedSettings[UPDATE_BANNER_ENABLED_KEY] !== false;
      }
      applyStateFromRawForScope(state.scopeKey);
      render();
      await persistAndApply();
      setStatus("설정을 가져와 현재 탭에 적용했습니다.", {
        autoResetMs: 2400,
      });
    } catch (error) {
      setStatus(
        String((error && error.message) || "설정을 가져오지 못했습니다."),
        {
          variant: "error",
          autoResetMs: 3200,
        },
      );
    }
  }

  async function exportFullBackupJson() {
    try {
      await flushCurrentSettings();
      const [localSnapshot, sessionSnapshot] = await Promise.all([
        getStorageAreaSnapshot("local"),
        getStorageAreaSnapshot("session"),
      ]);
      const data = {
        format: FULL_BACKUP_FORMAT,
        formatVersion: DATA_EXPORT_FORMAT_VERSION,
        extensionVersion: getExtensionVersion(),
        exportedAt: new Date().toISOString(),
        storage: {
          local: localSnapshot,
          session: sessionSnapshot,
        },
        popupLocalStorage: getPopupLocalStorageSnapshot(),
      };
      downloadJsonFile(
        data,
        `badge-moa-chat-backup-${getExportTimestamp()}.json`,
      );
      setStatus("설정과 사용자 데이터를 모두 백업했습니다.", {
        autoResetMs: 2200,
      });
    } catch (_error) {
      setStatus("전체 백업 파일을 만들지 못했습니다.", {
        variant: "error",
        autoResetMs: 2600,
      });
    }
  }

  async function importFullBackupJson(file) {
    try {
      const data = await readJsonFile(file);
      validateExportHeader(data, FULL_BACKUP_FORMAT);
      if (
        !isPlainObject(data.storage) ||
        !isPlainObject(data.storage.local) ||
        !isPlainObject(data.storage.session)
      ) {
        throw new Error("전체 백업 데이터가 올바르지 않습니다.");
      }
      const confirmed = await askGenericConfirm(
        "전체 사용자 데이터 복원",
        "현재 설정, 모아보기 대상, 제외 목록, 세션 캐시를 백업 파일의 데이터로 모두 교체합니다.\n계속 진행하시겠습니까?",
        { okLabel: "전체 복원", cancelLabel: "취소", danger: true },
      );
      if (!confirmed) return;

      const [previousLocal, previousSession] = await Promise.all([
        getStorageAreaSnapshot("local"),
        getStorageAreaSnapshot("session"),
      ]);
      try {
        await replaceStorageArea("session", data.storage.session);
        await replaceStorageArea("local", data.storage.local);
      } catch (_restoreError) {
        try {
          await replaceStorageArea("session", previousSession);
          await replaceStorageArea("local", previousLocal);
        } catch (_rollbackError) {}
        throw new Error("복원에 실패하여 기존 데이터를 유지했습니다.");
      }
      restorePopupLocalStorage(data.popupLocalStorage, { replace: true });
      setStatus("전체 사용자 데이터를 복원했습니다.");
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      setStatus(
        String(
          (error && error.message) || "전체 데이터를 복원하지 못했습니다.",
        ),
        { variant: "error", autoResetMs: 3200 },
      );
    }
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
