(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.renderApi && typeof ns.renderApi === "object") return;

  function render(state, deps = {}) {
    const applySettingsClassesFn =
      typeof deps.applySettingsClasses === "function"
        ? deps.applySettingsClasses
        : () => {};
    const updatePopupPinStateUiFn =
      typeof deps.updatePopupPinStateUi === "function"
        ? deps.updatePopupPinStateUi
        : () => {};
    const syncPillPositionForHeaderFn =
      typeof deps.syncPillPositionForHeader === "function"
        ? deps.syncPillPositionForHeader
        : () => {};
    const renderPillFn =
      typeof deps.renderPill === "function" ? deps.renderPill : () => {};
    const renderListFn =
      typeof deps.renderList === "function" ? deps.renderList : () => {};

    applySettingsClassesFn();
    updatePopupPinStateUiFn();
    syncPillPositionForHeaderFn();
    renderPillFn();
    if (state && state.isOpen) {
      renderListFn(false);
    }
  }

  function renderPill(state, deps = {}) {
    const root = state?.ui?.root;
    const pill = state?.ui?.pill;
    const iconWrap = state?.ui?.iconWrap;
    const text = state?.ui?.text;
    const count = state?.ui?.count;
    if (!root || !pill || !iconWrap || !text || !count) return;

    if (
      state.settings?.pillGlowEnabled !== true &&
      pill.classList.contains("is-attention")
    ) {
      clearTimeout(state.attentionTimer);
      state.pillCycle.lockUntil = 0;
      pill.classList.remove("is-attention");
    }

    const clearAttentionIfNeededFn =
      typeof deps.clearAttentionIfNeeded === "function"
        ? deps.clearAttentionIfNeeded
        : () => {};
    const applyPillRoleClassFn =
      typeof deps.applyPillRoleClass === "function"
        ? deps.applyPillRoleClass
        : () => {};
    const resetPillCycleFn =
      typeof deps.resetPillCycle === "function"
        ? deps.resetPillCycle
        : () => {};
    const getUnseenActorsForPillFn =
      typeof deps.getUnseenActorsForPill === "function"
        ? deps.getUnseenActorsForPill
        : () => [];
    const ensurePillCycleForActorsFn =
      typeof deps.ensurePillCycleForActors === "function"
        ? deps.ensurePillCycleForActors
        : () => {};
    const resolvePillRoleFromIdentityFn =
      typeof deps.resolvePillRoleFromIdentity === "function"
        ? deps.resolvePillRoleFromIdentity
        : () => "";
    const renderPillIdentityFn =
      typeof deps.renderPillIdentity === "function"
        ? deps.renderPillIdentity
        : () => {};

    clearAttentionIfNeededFn();
    iconWrap.innerHTML = "";
    text.innerHTML = "";

    if (!Array.isArray(state.entries) || state.entries.length === 0) {
      root.classList.remove("has-chat", "has-unseen");
      pill.classList.remove("is-rotating");
      pill.classList.add("is-empty");
      applyPillRoleClassFn("");
      resetPillCycleFn(true);
      text.textContent = "새 채팅 없음";
      count.textContent = "";
      count.style.display = "none";
      return;
    }

    root.classList.add("has-chat");

    if (state.unseenCount > 0) {
      root.classList.add("has-unseen");
    } else {
      root.classList.remove("has-unseen");
    }

    if (state.unseenCount <= 0) {
      resetPillCycleFn(true);
      pill.classList.remove("is-rotating");
      pill.classList.add("is-empty");
      applyPillRoleClassFn("");
      iconWrap.innerHTML = "";
      text.textContent = "새 채팅 없음";
      count.textContent = "";
      count.style.display = "none";
      return;
    }

    const actors = getUnseenActorsForPillFn();
    if (!Array.isArray(actors) || actors.length <= 0) {
      resetPillCycleFn(true);
      pill.classList.remove("is-rotating");
      pill.classList.add("is-empty");
      applyPillRoleClassFn("");
      iconWrap.innerHTML = "";
      text.textContent = "새 채팅 없음";
      count.textContent = "";
      count.style.display = "none";
      return;
    }

    pill.classList.remove("is-empty");
    ensurePillCycleForActorsFn(actors);
    const lockActive = Date.now() < (state.pillCycle.lockUntil || 0);
    const index = lockActive ? 0 : state.pillCycle.index % actors.length;
    const actor = actors[index];
    applyPillRoleClassFn(resolvePillRoleFromIdentityFn(actor));
    renderPillIdentityFn(actor, actor.count, true);
    pill.classList.toggle("is-rotating", actors.length > 1 && !lockActive);
  }

  function renderPillIdentity(
    state,
    identity,
    countValue,
    showCount,
    deps = {},
  ) {
    const iconWrap = state?.ui?.iconWrap;
    const text = state?.ui?.text;
    const count = state?.ui?.count;
    if (!iconWrap || !text || !count) return;

    const createBadgeListFn =
      typeof deps.createBadgeList === "function"
        ? deps.createBadgeList
        : () => {
            const fallback = document.createElement("span");
            return fallback;
          };
    const createBadgeVisualFn =
      typeof deps.createBadgeVisual === "function"
        ? deps.createBadgeVisual
        : () => null;

    const pillBadges = Array.isArray(identity?.pillBadges)
      ? identity.pillBadges
      : [];
    const partnerMark =
      identity?.partnerMark ||
      pillBadges.find((badge) => badge && badge.type === "partner") ||
      null;
    const leftBadges = pillBadges.filter(
      (badge) => badge && badge.type !== "partner",
    );

    iconWrap.innerHTML = "";
    iconWrap.appendChild(createBadgeListFn(leftBadges, "pill"));

    text.innerHTML = "";
    const nickname = document.createElement("span");
    nickname.className = "chzzk-badge-moa-pill-name";
    nickname.textContent = identity?.nickname || "알 수 없음";
    if (identity?.titleColor) {
      nickname.style.color = identity.titleColor;
    }
    text.appendChild(nickname);

    if (partnerMark) {
      const mark = createBadgeVisualFn(partnerMark, "pillpartnermark");
      if (mark) text.appendChild(mark);
    }

    if (!showCount) {
      count.textContent = "";
      count.style.display = "none";
      return;
    }

    const numericCount = Number(countValue) || 0;
    const cappedCount = Math.min(999, Math.max(0, Math.floor(numericCount)));
    count.textContent = `${cappedCount}`;
    count.style.display = "inline-flex";
  }

  function scrollListToBottom(list) {
    if (!list) return;
    list.scrollTop = list.scrollHeight;

    const requestFrame =
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => setTimeout(callback, 0);

    const pin = () => {
      if (!list.isConnected) return;
      list.scrollTop = list.scrollHeight;
    };
    // 사용자가 이미 위로 스크롤한 경우엔 강제 고정하지 않는다(바닥 근처일 때만).
    const pinIfNearBottom = () => {
      if (!list.isConnected) return;
      const distanceFromBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight;
      if (distanceFromBottom <= 80) list.scrollTop = list.scrollHeight;
    };

    // 레이아웃이 안정될 때까지 여러 프레임에 걸쳐 바닥 고정.
    requestFrame(() => {
      pin();
      requestFrame(pin);
    });
    // 배지 이미지(lazy)가 로드되며 높이가 늘어나 스크롤이 위로 밀리는 것을
    // 막기 위해, 아직 로드 안 된 이미지의 load 시점에 다시 바닥으로 고정한다.
    const images = list.querySelectorAll("img");
    let pendingImages = 0;
    images.forEach((img) => {
      if (img.complete) return;
      pendingImages += 1;
      const onSettle = () => {
        img.removeEventListener("load", onSettle);
        img.removeEventListener("error", onSettle);
        pinIfNearBottom();
      };
      img.addEventListener("load", onSettle);
      img.addEventListener("error", onSettle);
    });
    // 이미지 로드 누락 대비 한 번 더 지연 고정.
    if (pendingImages > 0 && typeof setTimeout === "function") {
      setTimeout(pinIfNearBottom, 120);
    }
  }

  // 특정 항목(다시보기 최신 시퀀스)을 중앙에 맞추되, 배지 이미지 로드로 인한
  // 레이아웃 변화에 대비해 여러 프레임/이미지 로드 시점에 다시 맞춘다.
  function scrollTargetIntoView(list, target) {
    if (!list || !target) return;
    const requestFrame =
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => setTimeout(callback, 0);

    const align = () => {
      if (!list.isConnected || !target.isConnected) return;
      target.scrollIntoView({ block: "center" });
    };

    align();
    requestFrame(() => {
      align();
      requestFrame(align);
    });

    const images = list.querySelectorAll("img");
    let pendingImages = 0;
    images.forEach((img) => {
      if (img.complete) return;
      pendingImages += 1;
      const onSettle = () => {
        img.removeEventListener("load", onSettle);
        img.removeEventListener("error", onSettle);
        align();
      };
      img.addEventListener("load", onSettle);
      img.addEventListener("error", onSettle);
    });
    if (pendingImages > 0 && typeof setTimeout === "function") {
      setTimeout(align, 120);
    }
  }

  function renderList(state, scrollToBottom, deps = {}) {
    const list = state?.ui?.list;
    const empty = state?.ui?.empty;
    const filterBar = state?.ui?.filterBar;
    if (!list || !empty || !filterBar) return;

    const updateViewModeButtonsFn =
      typeof deps.updateViewModeButtons === "function"
        ? deps.updateViewModeButtons
        : () => {};
    const isNearBottomFn =
      typeof deps.isNearBottom === "function" ? deps.isNearBottom : () => false;
    const renderNicknameFiltersFn =
      typeof deps.renderNicknameFilters === "function"
        ? deps.renderNicknameFilters
        : () => {};
    const getNicknameStatsFn =
      typeof deps.getNicknameStats === "function"
        ? deps.getNicknameStats
        : () => [];
    const syncNicknameFilterSelectionFn =
      typeof deps.syncNicknameFilterSelection === "function"
        ? deps.syncNicknameFilterSelection
        : () => {};
    const getVisibleEntriesByNicknameFn =
      typeof deps.getVisibleEntriesByNickname === "function"
        ? deps.getVisibleEntriesByNickname
        : () => [];
    const getDateKeyFn =
      typeof deps.getDateKey === "function" ? deps.getDateKey : () => "";
    const createDateDividerFn =
      typeof deps.createDateDivider === "function"
        ? deps.createDateDivider
        : () => document.createElement("span");
    const getItemTypeToneClassFn =
      typeof deps.getItemTypeToneClass === "function"
        ? deps.getItemTypeToneClass
        : () => "";
    const createBadgeListFn =
      typeof deps.createBadgeList === "function"
        ? deps.createBadgeList
        : () => document.createElement("span");
    const createBadgeVisualFn =
      typeof deps.createBadgeVisual === "function"
        ? deps.createBadgeVisual
        : () => null;
    const formatTimeFn =
      typeof deps.formatTime === "function" ? deps.formatTime : () => "--:--";
    const createMessageTagRowFn =
      typeof deps.createMessageTagRow === "function"
        ? deps.createMessageTagRow
        : () => null;
    const buildMessageContentFn =
      typeof deps.buildMessageContent === "function"
        ? deps.buildMessageContent
        : () => document.createDocumentFragment();
    const syncPopupContentHeightFn =
      typeof deps.syncPopupContentHeight === "function"
        ? deps.syncPopupContentHeight
        : () => {};

    updateViewModeButtonsFn();
    const showPopupTime = state.settings?.hidePopupTime !== true;

    const preserveBottom = scrollToBottom === "preserve-bottom";
    const stickToBottom = preserveBottom || isNearBottomFn(list);
    const previousScrollTop = Number(list.scrollTop || 0);
    list.innerHTML = "";

    if (!Array.isArray(state.entries) || state.entries.length === 0) {
      renderNicknameFiltersFn([]);
      list.style.display = "none";
      empty.style.display = "flex";
      empty.textContent = "배지 채팅 없음";
      syncPopupContentHeightFn();
      return;
    }

    const nicknameStats = getNicknameStatsFn(state.entries);
    syncNicknameFilterSelectionFn(nicknameStats);
    renderNicknameFiltersFn(nicknameStats);

    const visibleEntries = getVisibleEntriesByNicknameFn();
    if (!Array.isArray(visibleEntries) || visibleEntries.length === 0) {
      list.style.display = "none";
      empty.style.display = "flex";
      empty.textContent = "선택한 닉네임의 배지 채팅 없음";
      syncPopupContentHeightFn();
      return;
    }

    list.style.display = "flex";
    empty.style.display = "none";
    empty.textContent = "배지 채팅 없음";

    // 닉네임 → authorUserIdHash 맵 한 번만 사전계산
    // 정확히 1개로 수렴되는 닉만 fallback에 사용. 충돌하면 무효(빈 문자열) 마킹.
    const nicknameHashMap = (() => {
      const map = new Map();
      const profileCardApi =
        window.__chzzkBadgeMoa && window.__chzzkBadgeMoa.profileCardApi;
      const isValid =
        profileCardApi && typeof profileCardApi.isValidUserIdHash === "function"
          ? profileCardApi.isValidUserIdHash
          : () => false;
      const sourceEntries = Array.isArray(state.entries) ? state.entries : [];
      for (const candidate of sourceEntries) {
        if (!candidate) continue;
        const hash = String(candidate.authorUserIdHash || "").trim();
        if (!hash || !isValid(hash)) continue;
        const key = String(candidate.nickname || "").trim();
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, hash);
        } else if (map.get(key) !== hash) {
          map.set(key, ""); // 충돌 → 무효 마킹
        }
      }
      return map;
    })();

    const fragment = document.createDocumentFragment();
    let lastDateKey = "";

    for (const entry of visibleEntries) {
      const dateKey = getDateKeyFn(entry.timestamp);
      if (dateKey && dateKey !== lastDateKey) {
        fragment.appendChild(createDateDividerFn(entry.timestamp));
        lastDateKey = dateKey;
      }

      const item = document.createElement("article");
      item.className = "chzzk-badge-moa-item";
      if (Number.isFinite(entry.sequence)) {
        item.dataset.seq = String(entry.sequence);
      }
      if (entry.badgeType) {
        item.classList.add(`chzzk-badge-moa-item-highlight-${entry.badgeType}`);
      }
      const typeToneClass = getItemTypeToneClassFn(entry);
      if (typeToneClass) {
        item.classList.add(typeToneClass);
      }
      const useTypeToneItem = !!typeToneClass;

      const head = document.createElement("div");
      head.className = "chzzk-badge-moa-item-head";
      const headMain = document.createElement("div");
      headMain.className = "chzzk-badge-moa-item-head-main";

      const user = document.createElement("div");
      user.className = "chzzk-badge-moa-item-user";

      const popupBadges = Array.isArray(entry.popupBadges)
        ? entry.popupBadges
        : [];
      user.appendChild(
        createBadgeListFn(
          filterPopupBadgesForSettings(popupBadges, state),
          "popup",
        ),
      );

      const nickname = document.createElement("span");
      nickname.className = "chzzk-badge-moa-item-nickname";
      nickname.textContent = entry.nickname;
      if (entry.titleColor && !useTypeToneItem) {
        nickname.style.color = entry.titleColor;
      }
      const profileCardApi =
        window.__chzzkBadgeMoa && window.__chzzkBadgeMoa.profileCardApi;
      const ownHash = String(entry.authorUserIdHash || "").trim();
      const fallbackHash = ownHash
        ? ""
        : String(nicknameHashMap.get(String(entry.nickname || "").trim()) || "").trim();
      const effectiveHash = ownHash || fallbackHash;
      const canOpenProfileCard =
        !!profileCardApi &&
        typeof profileCardApi.openProfileCardForEntry === "function" &&
        !!effectiveHash &&
        profileCardApi.isValidUserIdHash(effectiveHash);
      if (canOpenProfileCard) {
        nickname.classList.add("chzzk-badge-moa-item-nickname-clickable");
        nickname.setAttribute("role", "button");
        nickname.setAttribute("tabindex", "0");
        nickname.title = "프로필 보기";
        const entryForClick = ownHash
          ? entry
          : { ...entry, authorUserIdHash: effectiveHash };
        nickname.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          profileCardApi.openProfileCardForEntry(state, entryForClick, nickname);
        });
        nickname.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            profileCardApi.openProfileCardForEntry(
              state,
              entryForClick,
              nickname,
            );
          }
        });
      }
      user.appendChild(nickname);

      const markBadges = [];
      if (entry.partnerMark) {
        const mark = createBadgeVisualFn(entry.partnerMark, "partnermark");
        if (mark) markBadges.push(mark);
      }
      if (
        entry.achievementMark &&
        state.settings?.showPopupRoleBadgesOnly !== true
      ) {
        const mark = createBadgeVisualFn(entry.achievementMark, "nameicon");
        if (mark) markBadges.push(mark);
      }
      if (markBadges.length > 0) {
        const markList = document.createElement("span");
        markList.className =
          "chzzk-badge-moa-badge-list chzzk-badge-moa-badge-list-popup chzzk-badge-moa-mark-list";
        markBadges.forEach((m) => markList.appendChild(m));
        user.appendChild(markList);
      }

      if (showPopupTime) {
        const time = document.createElement("time");
        time.className = "chzzk-badge-moa-item-time";
        time.textContent = formatTimeFn(entry.timestamp);

        if (state.displayStyle === "inline") {
          headMain.append(time, user);
        } else {
          headMain.append(user, time);
        }
      } else {
        headMain.append(user);
      }
      const allTags = Array.isArray(entry.tags) ? entry.tags : [];
      const typeTags = allTags.filter(
        (t) => t && !String(t.tone || "").startsWith("donation-"),
      );
      const cheeseTags = allTags.filter(
        (t) => t && String(t.tone || "").startsWith("donation-"),
      );

      const typeTagRow = createMessageTagRowFn(typeTags);
      if (typeTagRow) {
        user.appendChild(typeTagRow);
      }

      head.append(headMain);

      const message = document.createElement("div");
      message.className = "chzzk-badge-moa-item-message";
      if (entry.titleColor && !useTypeToneItem) {
        message.style.color = entry.titleColor;
      }
      const messageBody = document.createElement("span");
      messageBody.className = "chzzk-badge-moa-item-message-body";
      const messageContent = buildMessageContentFn(entry.message, entry.emojis);
      if (messageContent.childNodes.length > 0) {
        messageBody.appendChild(messageContent);
      } else {
        messageBody.textContent = "(내용 없음)";
      }
      message.appendChild(messageBody);

      if (cheeseTags.length > 0) {
        const cheeseRow = document.createElement("div");
        cheeseRow.className = "chzzk-badge-moa-item-cheese";
        cheeseTags.forEach((tag) => {
          const cheese = document.createElement("em");
          cheese.className = `chzzk-badge-moa-item-cheese-amount is-${String(tag.tone || "donation-neutral")}`;
          cheese.textContent = String(tag.label || "").replace(/치즈$/, "");
          const blind = document.createElement("span");
          blind.className = "blind";
          blind.textContent = "치즈";
          cheese.appendChild(blind);
          cheeseRow.appendChild(cheese);
        });
        message.appendChild(cheeseRow);
      }

      item.append(head, message);
      fragment.appendChild(item);
    }

    list.appendChild(fragment);
    syncPopupContentHeightFn();

    if (scrollToBottom === "latest-sequence") {
      const maxSeq = state.entries.reduce(
        (max, e) => Math.max(max, Number.isFinite(e.sequence) ? e.sequence : 0),
        -1,
      );
      const target =
        maxSeq >= 0 ? list.querySelector(`[data-seq="${maxSeq}"]`) : null;
      if (target) {
        scrollTargetIntoView(list, target);
      } else {
        scrollListToBottom(list);
      }
    } else if (scrollToBottom || (state.isOpen && stickToBottom)) {
      scrollListToBottom(list);
    } else if (previousScrollTop > 0) {
      const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight);
      list.scrollTop = Math.min(previousScrollTop, maxScrollTop);
    }

    syncPopupContentHeightFn();
    if (scrollToBottom === true || scrollToBottom === "preserve-bottom") {
      scrollListToBottom(list);
    } else if (scrollToBottom === "latest-sequence") {
      const maxSeq = state.entries.reduce(
        (max, e) => Math.max(max, Number.isFinite(e.sequence) ? e.sequence : 0),
        -1,
      );
      const target =
        maxSeq >= 0 ? list.querySelector(`[data-seq="${maxSeq}"]`) : null;
      if (target) {
        scrollTargetIntoView(list, target);
      } else {
        scrollListToBottom(list);
      }
    }
  }

  function getItemTypeToneClass(entry) {
    if (!entry || typeof entry !== "object") return "";
    const typeLabel = String(entry.typeLabel || "").trim();
    const tone = String(entry.typeTone || "").trim();
    if (!typeLabel || !tone || tone === "neutral") return "";

    switch (tone) {
      case "video":
        return "chzzk-badge-moa-item-type-video";
      case "mission":
        return "chzzk-badge-moa-item-type-mission";
      case "mission-success":
        return "chzzk-badge-moa-item-type-mission-success";
      case "mission-failed":
        return "chzzk-badge-moa-item-type-mission-failed";
      case "party":
        return "chzzk-badge-moa-item-type-party";
      case "subscription":
        return "chzzk-badge-moa-item-type-subscription";
      case "donation-brick":
        return "chzzk-badge-moa-item-type-donation-brick";
      case "donation-camel":
        return "chzzk-badge-moa-item-type-donation-camel";
      case "donation-green":
        return "chzzk-badge-moa-item-type-donation-green";
      case "donation-cyan":
        return "chzzk-badge-moa-item-type-donation-cyan";
      case "donation-violet":
        return "chzzk-badge-moa-item-type-donation-violet";
      case "donation-neutral":
        return "chzzk-badge-moa-item-type-donation-neutral";
      default:
        return "";
    }
  }

  function renderNicknameFilters(state, stats, deps = {}) {
    const filterBar = state?.ui?.filterBar;
    if (!filterBar) return;

    const updateFilterToggleButtonFn =
      typeof deps.updateFilterToggleButton === "function"
        ? deps.updateFilterToggleButton
        : () => {};
    const applyFilterBarMaxHeightFn =
      typeof deps.applyFilterBarMaxHeight === "function"
        ? deps.applyFilterBarMaxHeight
        : () => {};
    const selectAllNicknameFiltersFn =
      typeof deps.selectAllNicknameFilters === "function"
        ? deps.selectAllNicknameFilters
        : () => {};
    const clearAllNicknameFiltersFn =
      typeof deps.clearAllNicknameFilters === "function"
        ? deps.clearAllNicknameFilters
        : () => {};
    const deleteAllEntriesFromFiltersFn =
      typeof deps.deleteAllEntriesFromFilters === "function"
        ? deps.deleteAllEntriesFromFilters
        : () => {};
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const renderListFn =
      typeof deps.renderList === "function" ? deps.renderList : () => {};
    const deleteEntriesByNicknameFn =
      typeof deps.deleteEntriesByNickname === "function"
        ? deps.deleteEntriesByNickname
        : () => {};

    filterBar.innerHTML = "";

    if (!Array.isArray(stats) || stats.length === 0) {
      filterBar.classList.remove("is-collapsed");
      filterBar.style.display = "none";
      filterBar.style.maxHeight = "";
      updateFilterToggleButtonFn(0);
      return;
    }

    updateFilterToggleButtonFn(stats.length);
    applyFilterBarMaxHeightFn();
    filterBar.style.display = "flex";

    const fragment = document.createDocumentFragment();

    const controls = document.createElement("div");
    controls.className = "chzzk-badge-moa-filter-controls";

    const selectAllButton = document.createElement("button");
    selectAllButton.type = "button";
    selectAllButton.className = "chzzk-badge-moa-filter-action-btn";
    selectAllButton.textContent = "전체 선택";
    selectAllButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectAllNicknameFiltersFn(stats);
    });

    const clearAllButton = document.createElement("button");
    clearAllButton.type = "button";
    clearAllButton.className = "chzzk-badge-moa-filter-action-btn";
    clearAllButton.textContent = "전체 해제";
    clearAllButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearAllNicknameFiltersFn();
    });

    const deleteAllButton = document.createElement("button");
    deleteAllButton.type = "button";
    deleteAllButton.className =
      "chzzk-badge-moa-filter-action-btn is-danger is-end";
    deleteAllButton.textContent = "채팅 모두 삭제";
    deleteAllButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void deleteAllEntriesFromFiltersFn();
    });

    controls.append(selectAllButton, clearAllButton, deleteAllButton);
    fragment.appendChild(controls);

    stats.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "chzzk-badge-moa-filter-chip";

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "chzzk-badge-moa-filter-toggle";
      const isChecked = state.nicknameFilter.selected.has(item.nickname);
      toggleButton.setAttribute("aria-pressed", String(isChecked));

      if (isChecked) {
        chip.classList.add("is-checked");
      }

      toggleButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.nicknameFilter.autoSelectNew = false;
        const nextChecked = !state.nicknameFilter.selected.has(item.nickname);
        if (nextChecked) {
          state.nicknameFilter.selected.add(item.nickname);
        } else {
          state.nicknameFilter.selected.delete(item.nickname);
        }
        toggleButton.setAttribute("aria-pressed", String(nextChecked));
        chip.classList.toggle("is-checked", nextChecked);
        saveSettingsFn();
        renderListFn(false);
      });

      const text = document.createElement("span");
      text.className = "chzzk-badge-moa-filter-text";
      text.textContent = `${item.nickname} (${item.count})`;
      if (item.titleColor) {
        text.style.color = item.titleColor;
      }

      toggleButton.append(text);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "chzzk-badge-moa-filter-delete";
      removeButton.innerHTML =
        '<svg class="chzzk-badge-moa-filter-delete-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 2h4a1 1 0 0 1 1 1v1h3a.75.75 0 0 1 0 1.5h-.6l-.7 8.1A2 2 0 0 1 10.7 15H5.3a2 2 0 0 1-1.99-1.4L2.6 5.5H2a.75.75 0 0 1 0-1.5h3V3a1 1 0 0 1 1-1Zm.5 2h3V3.5h-3V4ZM4.1 5.5l.7 8a.5.5 0 0 0 .5.45h5.4a.5.5 0 0 0 .5-.45l.7-8H4.1Zm2.4 1.75a.6.6 0 0 1 .6.6v4.3a.6.6 0 1 1-1.2 0v-4.3a.6.6 0 0 1 .6-.6Zm3 0a.6.6 0 0 1 .6.6v4.3a.6.6 0 1 1-1.2 0v-4.3a.6.6 0 0 1 .6-.6Z"/></svg>';
      removeButton.setAttribute(
        "aria-label",
        `'${item.nickname}' 배지 채팅 전체 삭제`,
      );
      removeButton.title = `'${item.nickname}' 배지 채팅 전체 삭제`;
      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void deleteEntriesByNicknameFn(item.nickname);
      });

      chip.append(toggleButton, removeButton);
      fragment.appendChild(chip);
    });

    filterBar.appendChild(fragment);
    filterBar.classList.toggle("is-collapsed", state.filterBarCollapsed);
  }

  function applyFilterBarMaxHeight(state) {
    const popup = state?.ui?.popup;
    const filterBar = state?.ui?.filterBar;
    if (!popup || !filterBar) return;

    const popupHeight =
      Number(state.popupHeight || 0) || Number(popup.clientHeight || 0);
    if (!popupHeight) {
      filterBar.style.maxHeight = "";
      return;
    }

    const maxHeight = Math.max(44, Math.floor(popupHeight - 20));
    filterBar.style.setProperty("--chzzk-filter-max-height", `${maxHeight}px`);
  }

  function updateFilterToggleButton(state, filterCount) {
    const button = state?.ui?.filterToggleButton;
    if (!button) return;

    const count = Number(filterCount || 0);
    const hasFilters = count > 0;

    button.style.display = hasFilters ? "inline-flex" : "none";
    button.disabled = !hasFilters;

    if (!hasFilters) {
      button.setAttribute("aria-expanded", "false");
      button.textContent = "필터 펴기";
      return;
    }

    const isExpanded = state.filterBarCollapsed !== true;
    button.setAttribute("aria-expanded", String(isExpanded));
    button.textContent = isExpanded
      ? `필터 접기 (${count})`
      : `필터 펴기 (${count})`;
  }

  function renderSettingsPanel(state, deps = {}) {
    const settingsPanel = state?.ui?.settingsPanel;
    const settingsButton = state?.ui?.settingsButton;
    if (!settingsPanel || !settingsButton) return;

    const createSettingToggleRowFn =
      typeof deps.createSettingToggleRow === "function"
        ? deps.createSettingToggleRow
        : () => document.createElement("div");
    const saveSettingsFn =
      typeof deps.saveSettings === "function" ? deps.saveSettings : () => {};
    const applySettingsClassesFn =
      typeof deps.applySettingsClasses === "function"
        ? deps.applySettingsClasses
        : () => {};
    const renderListFn =
      typeof deps.renderList === "function" ? deps.renderList : () => {};
    const getPillNicknameSettingItemsFn =
      typeof deps.getPillNicknameSettingItems === "function"
        ? deps.getPillNicknameSettingItems
        : () => [];
    const normalizeNicknameFn =
      typeof deps.normalizeNickname === "function"
        ? deps.normalizeNickname
        : (value) => String(value || "").trim();
    const renderPillFn =
      typeof deps.renderPill === "function" ? deps.renderPill : () => {};
    const renderSettingsPanelFn =
      typeof deps.renderSettingsPanel === "function"
        ? deps.renderSettingsPanel
        : () => {};
    const addTrackedTargetFn =
      typeof deps.addTrackedTarget === "function"
        ? deps.addTrackedTarget
        : () => false;
    const getTrackedTargetSettingItemsFn =
      typeof deps.getTrackedTargetSettingItems === "function"
        ? deps.getTrackedTargetSettingItems
        : () => [];
    const createTrackedTargetChipFn =
      typeof deps.createTrackedTargetChip === "function"
        ? deps.createTrackedTargetChip
        : () => document.createElement("div");

    settingsButton.setAttribute("aria-expanded", String(state.isSettingsOpen));
    settingsButton.setAttribute(
      "aria-label",
      state.isSettingsOpen ? "배지 채팅 설정 닫기" : "배지 채팅 설정 열기",
    );
    settingsPanel.classList.toggle("is-open", state.isSettingsOpen);
    if (!state.isSettingsOpen) return;

    settingsPanel.innerHTML = "";

    const visualSection = document.createElement("section");
    visualSection.className = "chzzk-badge-moa-settings-section";

    const visualTitle = document.createElement("strong");
    visualTitle.className = "chzzk-badge-moa-settings-title";
    visualTitle.textContent = "표시 설정";
    visualSection.appendChild(visualTitle);

    const visualList = document.createElement("div");
    visualList.className = "chzzk-badge-moa-settings-list";
    visualList.appendChild(
      createSettingToggleRowFn(
        "채팅창 배경색 제거",
        state.settings.hideChatBackground,
        (checked) => {
          state.settings.hideChatBackground = checked;
          saveSettingsFn();
          applySettingsClassesFn();
        },
      ),
    );
    visualList.appendChild(
      createSettingToggleRowFn(
        "채팅창 테두리 선 제거",
        state.settings.hideChatBorder,
        (checked) => {
          state.settings.hideChatBorder = checked;
          saveSettingsFn();
          applySettingsClassesFn();
        },
      ),
    );
    visualList.appendChild(
      createSettingToggleRowFn(
        "팝업창 배경색 제거",
        state.settings.hidePopupBackground,
        (checked) => {
          state.settings.hidePopupBackground = checked;
          saveSettingsFn();
          applySettingsClassesFn();
        },
      ),
    );
    visualList.appendChild(
      createSettingToggleRowFn(
        "팝업창 테두리 선 제거",
        state.settings.hidePopupBorder,
        (checked) => {
          state.settings.hidePopupBorder = checked;
          saveSettingsFn();
          applySettingsClassesFn();
        },
      ),
    );
    visualList.appendChild(
      createSettingToggleRowFn(
        "팝업창 시간 숨김",
        state.settings.hidePopupTime,
        (checked) => {
          state.settings.hidePopupTime = checked;
          saveSettingsFn();
          renderListFn(false);
        },
      ),
    );
    visualList.appendChild(
      createSettingToggleRowFn(
        "채팅창 랭킹 숨김",
        state.settings.hideChatRanking,
        (checked) => {
          state.settings.hideChatRanking = checked;
          saveSettingsFn();
          applySettingsClassesFn();
        },
      ),
    );
    visualList.appendChild(
      createSettingToggleRowFn(
        "채팅창 진행 중인 미션 숨김",
        state.settings.hideChatMission,
        (checked) => {
          state.settings.hideChatMission = checked;
          saveSettingsFn();
          applySettingsClassesFn();
        },
      ),
    );
    visualList.appendChild(
      createSettingToggleRowFn(
        "채팅창 후원 메시지 숨김",
        state.settings.hideChatDonation,
        (checked) => {
          state.settings.hideChatDonation = checked;
          saveSettingsFn();
          applySettingsClassesFn();
        },
      ),
    );
    visualList.appendChild(
      createSettingToggleRowFn(
        "팝업창 역할 배지만 표시",
        state.settings.showPopupRoleBadgesOnly,
        (checked) => {
          state.settings.showPopupRoleBadgesOnly = checked;
          saveSettingsFn();
          renderListFn(false);
        },
      ),
    );
    visualSection.appendChild(visualList);

    const nicknameSection = document.createElement("section");
    nicknameSection.className = "chzzk-badge-moa-settings-section";

    const nicknameTitle = document.createElement("strong");
    nicknameTitle.className = "chzzk-badge-moa-settings-title";
    nicknameTitle.textContent = "채팅창 배지 알림에 숨김 닉네임";
    nicknameSection.appendChild(nicknameTitle);

    const nicknameRows = document.createElement("div");
    nicknameRows.className =
      "chzzk-badge-moa-settings-list chzzk-badge-moa-settings-list-chip";

    const nicknameItems = getPillNicknameSettingItemsFn();
    if (nicknameItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "chzzk-badge-moa-settings-empty";
      empty.textContent = "배지 채팅 닉네임 없음";
      nicknameRows.appendChild(empty);
    } else {
      nicknameItems.forEach((item) => {
        const normalizedNickname = normalizeNicknameFn(item.nickname);
        const checked =
          state.settings.hiddenPillNicknames.has(normalizedNickname);
        nicknameRows.appendChild(
          createSettingToggleRowFn(
            `${item.nickname} (${item.count})`,
            checked,
            (nextChecked) => {
              if (nextChecked) {
                state.settings.hiddenPillNicknames.add(normalizedNickname);
              } else {
                state.settings.hiddenPillNicknames.delete(normalizedNickname);
              }
              saveSettingsFn();
              renderPillFn();
              renderSettingsPanelFn();
            },
            { chip: true },
          ),
        );
      });
    }
    nicknameSection.appendChild(nicknameRows);

    const trackedSection = document.createElement("section");
    trackedSection.className = "chzzk-badge-moa-settings-section";

    const trackedTitle = document.createElement("strong");
    trackedTitle.className = "chzzk-badge-moa-settings-title";
    trackedTitle.textContent = "추가 모아보기 대상 (닉네임)";
    trackedSection.appendChild(trackedTitle);

    const trackedAdd = document.createElement("div");
    trackedAdd.className = "chzzk-badge-moa-tracked-add";

    const trackedInput = document.createElement("input");
    trackedInput.type = "text";
    trackedInput.className = "chzzk-badge-moa-tracked-input";
    trackedInput.placeholder = "닉네임 입력";

    const addNicknameButton = document.createElement("button");
    addNicknameButton.type = "button";
    addNicknameButton.className = "chzzk-badge-moa-tracked-add-btn";
    addNicknameButton.textContent = "닉네임 추가";
    addNicknameButton.addEventListener("click", () => {
      if (addTrackedTargetFn(trackedInput.value)) {
        trackedInput.value = "";
        renderSettingsPanelFn();
      }
    });

    trackedInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      const raw = String(trackedInput.value || "").trim();
      if (!raw) return;
      if (addTrackedTargetFn(raw)) {
        trackedInput.value = "";
        renderSettingsPanelFn();
      }
    });

    trackedAdd.append(trackedInput, addNicknameButton);
    trackedSection.appendChild(trackedAdd);

    const trackedList = document.createElement("div");
    trackedList.className =
      "chzzk-badge-moa-settings-list chzzk-badge-moa-settings-list-chip";

    const trackedItems = getTrackedTargetSettingItemsFn();
    if (trackedItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "chzzk-badge-moa-settings-empty";
      empty.textContent = "추가 대상 없음";
      trackedList.appendChild(empty);
    } else {
      trackedItems.forEach((item) => {
        trackedList.appendChild(createTrackedTargetChipFn(item));
      });
    }
    trackedSection.appendChild(trackedList);

    settingsPanel.append(visualSection, nicknameSection, trackedSection);
  }

  function updateViewModeButtons(state) {
    const list = state?.ui?.list;
    const inlineButton = state?.ui?.inlineButton;
    const blockButton = state?.ui?.blockButton;
    const isInline = state?.displayStyle === "inline";

    if (list) {
      list.classList.toggle("is-inline", isInline);
    }

    if (inlineButton) {
      inlineButton.classList.toggle("is-active", isInline);
      inlineButton.setAttribute("aria-pressed", String(isInline));
      inlineButton.setAttribute("title", "한줄 보기");
    }

    if (blockButton) {
      blockButton.classList.toggle("is-active", !isInline);
      blockButton.setAttribute("aria-pressed", String(!isInline));
      blockButton.setAttribute("title", "블록 보기");
    }
  }

  function buildMessageContent(message, emojiMap, deps = {}) {
    const appendTextWithLinksFn =
      typeof deps.appendTextWithLinks === "function"
        ? deps.appendTextWithLinks
        : () => {};

    const fragment = document.createDocumentFragment();
    const messageText = String(message || "");
    if (!messageText) return fragment;

    if (!emojiMap || Object.keys(emojiMap).length === 0) {
      appendTextWithLinksFn(fragment, messageText);
      return fragment;
    }

    const tokenPattern = /\{:([^:}]+):\}/g;
    let lastIndex = 0;
    let match = null;

    while ((match = tokenPattern.exec(messageText)) !== null) {
      const fullMatch = match[0];
      const emojiKey = String(match[1] || "").trim();
      const emojiUrl = emojiMap[emojiKey];

      if (match.index > lastIndex) {
        appendTextWithLinksFn(
          fragment,
          messageText.slice(lastIndex, match.index),
        );
      }

      if (typeof emojiUrl === "string" && emojiUrl) {
        const emoji = document.createElement("img");
        emoji.src = emojiUrl;
        emoji.alt = "";
        emoji.width = 24;
        emoji.height = 24;
        emoji.loading = "lazy";
        emoji.decoding = "async";
        fragment.appendChild(emoji);
      } else {
        fragment.appendChild(document.createTextNode(fullMatch));
      }

      lastIndex = tokenPattern.lastIndex;
    }

    if (lastIndex < messageText.length) {
      appendTextWithLinksFn(fragment, messageText.slice(lastIndex));
    }

    return fragment;
  }

  function appendTextWithLinks(fragment, text) {
    if (!fragment || !text) return;
    const source = String(text || "");
    if (!source) return;

    const urlPattern = /https:\/\/[^\s<>"']+/g;
    let lastIndex = 0;
    let match = null;

    while ((match = urlPattern.exec(source)) !== null) {
      const rawUrl = String(match[0] || "");
      const cleanUrl = rawUrl.replace(/[),.!?]+$/g, "");
      const trailing = rawUrl.slice(cleanUrl.length);

      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(source.slice(lastIndex, match.index)),
        );
      }

      if (cleanUrl) {
        const anchor = document.createElement("a");
        anchor.className = "chzzk-badge-moa-message-link";
        anchor.href = cleanUrl;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = cleanUrl;
        fragment.appendChild(anchor);
      }

      if (trailing) {
        fragment.appendChild(document.createTextNode(trailing));
      }

      lastIndex = match.index + rawUrl.length;
    }

    if (lastIndex < source.length) {
      fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
    }
  }

  function createMessageTagRow(tags) {
    if (!Array.isArray(tags) || tags.length === 0) return null;

    const row = document.createElement("div");
    row.className = "chzzk-badge-moa-item-tags";

    tags.forEach((tag) => {
      if (!tag || typeof tag !== "object") return;
      const label = String(tag.label || "").trim();
      if (!label) return;

      const chip = document.createElement("span");
      chip.className = `chzzk-badge-moa-item-tag is-${String(tag.tone || "neutral")}`;
      chip.textContent = label;
      row.appendChild(chip);
    });

    return row.childNodes.length > 0 ? row : null;
  }

  function createBadgeList(badges, variant = "popup", deps = {}) {
    const createBadgeVisualFn =
      typeof deps.createBadgeVisual === "function"
        ? deps.createBadgeVisual
        : createBadgeVisual;

    const list = document.createElement("span");
    list.className = `chzzk-badge-moa-badge-list chzzk-badge-moa-badge-list-${variant}`;

    if (!Array.isArray(badges) || badges.length === 0) {
      list.style.display = "none";
      return list;
    }

    badges.forEach((badge) => {
      const visual = createBadgeVisualFn(badge, variant);
      if (visual) list.appendChild(visual);
    });

    return list;
  }

  function filterPopupBadgesForSettings(badges, state) {
    if (!Array.isArray(badges)) return [];
    if (state?.settings?.showPopupRoleBadgesOnly !== true) return badges;
    const roleTypes = new Set([
      "channel_owner",
      "manager",
      "operator",
      "partner",
    ]);
    return badges.filter((badge) => {
      const type = String(badge?.type || "")
        .trim()
        .toLowerCase();
      return roleTypes.has(type);
    });
  }

  function createBadgeVisual(badge, variant = "popup") {
    const wrap = document.createElement("span");
    wrap.className = `chzzk-badge-moa-badge is-${variant}`;
    const badgeType = String(badge?.type || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (badgeType) {
      wrap.classList.add(`is-badge-type-${badgeType}`);
    }

    if (badge?.iconUrl) {
      const img = document.createElement("img");
      img.src = badge.iconUrl;
      img.alt = `${badge.label} 배지`;
      img.loading = "lazy";
      img.decoding = "async";
      wrap.appendChild(img);
      return wrap;
    }

    const fallback = document.createElement("span");
    fallback.className = "chzzk-badge-moa-badge-fallback";
    fallback.textContent = String(badge?.label || "").charAt(0);
    wrap.appendChild(fallback);
    return wrap;
  }

  function formatTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleTimeString("ko-KR", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_error) {
      return "--:--";
    }
  }

  function getDateKey(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${month}-${day}`;
  }

  function formatDateLabel(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}.${month}.${day}.`;
  }

  function createDateDivider(timestamp, deps = {}) {
    const formatDateLabelFn =
      typeof deps.formatDateLabel === "function"
        ? deps.formatDateLabel
        : formatDateLabel;

    const divider = document.createElement("div");
    divider.className = "chzzk-badge-moa-date-divider";

    const text = document.createElement("span");
    text.className = "chzzk-badge-moa-date-divider-text";
    text.textContent = formatDateLabelFn(timestamp);

    divider.appendChild(text);
    return divider;
  }

  ns.renderApi = {
    render,
    renderPill,
    renderPillIdentity,
    renderList,
    getItemTypeToneClass,
    renderNicknameFilters,
    applyFilterBarMaxHeight,
    updateFilterToggleButton,
    renderSettingsPanel,
    updateViewModeButtons,
    buildMessageContent,
    appendTextWithLinks,
    createMessageTagRow,
    createBadgeList,
    createBadgeVisual,
    formatTime,
    getDateKey,
    formatDateLabel,
    createDateDivider,
  };
})();
