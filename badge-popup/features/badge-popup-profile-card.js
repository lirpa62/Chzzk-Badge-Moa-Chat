(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.profileCardApi && typeof ns.profileCardApi === "object") return;

  const PROFILE_CARD_API_BASE =
    "https://comm-api.game.naver.com/nng_main/v1/chats";
  const POPUP_CLASS = "chzzk-badge-moa-profile-card";
  const BACKDROP_CLASS = "chzzk-badge-moa-profile-card-backdrop";
  const OFFICIAL_MARK_URL =
    "https://ssl.pstatic.net/static/nng/glive/image/icon_official_mark.png";

  let activePopupRoot = null;
  let activeFetchToken = 0;
  let outsideClickHandler = null;
  let activeMoaPopupEl = null;
  let activeRelativeOffset = null; // { relLeft, relTop } — 모아보기 팝업 기준 상대 좌표
  let activeResizeObserver = null;
  let activeWindowResizeHandler = null;
  let activeScrollHandler = null;

  function isValidUserIdHash(value) {
    return /^[a-f0-9]{32}$/i.test(String(value || "").trim());
  }

  function isValidChatChannelId(value) {
    return /^[A-Za-z0-9_-]{2,32}$/.test(String(value || "").trim());
  }

  async function fetchProfileCard(chatChannelId, userIdHash) {
    if (
      !isValidChatChannelId(chatChannelId) ||
      !isValidUserIdHash(userIdHash)
    ) {
      return null;
    }
    const url =
      `${PROFILE_CARD_API_BASE}/${encodeURIComponent(chatChannelId)}` +
      `/users/${encodeURIComponent(userIdHash)}/profile-card?chatType=STREAMING`;
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      const json = await response.json();
      if (!json || typeof json !== "object") return null;
      if (
        json.code !== 200 ||
        !json.content ||
        typeof json.content !== "object"
      ) {
        return null;
      }
      return json.content;
    } catch (_error) {
      return null;
    }
  }

  function closeProfileCardPopup() {
    if (activePopupRoot && activePopupRoot.parentNode) {
      activePopupRoot.parentNode.removeChild(activePopupRoot);
    }
    activePopupRoot = null;
    if (outsideClickHandler) {
      document.removeEventListener("mousedown", outsideClickHandler, true);
      outsideClickHandler = null;
    }
    if (activeResizeObserver) {
      activeResizeObserver.disconnect();
      activeResizeObserver = null;
    }
    if (activeWindowResizeHandler) {
      window.removeEventListener("resize", activeWindowResizeHandler);
      activeWindowResizeHandler = null;
    }
    if (activeScrollHandler) {
      window.removeEventListener("scroll", activeScrollHandler, true);
      activeScrollHandler = null;
    }
    activeMoaPopupEl = null;
    activeRelativeOffset = null;
  }

  function createBadgeNode(
    imageUrl,
    tooltipTitle = "",
    tooltipDescription = "",
  ) {
    const url = String(imageUrl || "").trim();
    if (!url) return null;
    const wrap = document.createElement("span");
    wrap.className = `${POPUP_CLASS}-badge`;

    const img = document.createElement("img");
    img.src = url;
    img.width = 18;
    img.height = 18;
    img.alt = String(tooltipTitle || "");
    img.draggable = false;
    img.loading = "lazy";
    wrap.appendChild(img);

    const safeTitle = String(tooltipTitle || "").trim();
    const safeDescription = String(tooltipDescription || "").trim();
    if (safeTitle || safeDescription) {
      const tooltip = document.createElement("span");
      tooltip.className = `${POPUP_CLASS}-tooltip`;
      tooltip.setAttribute("role", "tooltip");
      if (safeTitle) {
        const titleLine = document.createElement("span");
        titleLine.className = `${POPUP_CLASS}-tooltip-title`;
        titleLine.textContent = safeTitle;
        tooltip.appendChild(titleLine);
      }
      if (safeDescription) {
        const descLine = document.createElement("span");
        descLine.className = `${POPUP_CLASS}-tooltip-desc`;
        descLine.textContent = safeDescription;
        tooltip.appendChild(descLine);
      }
      wrap.appendChild(tooltip);
    }
    return wrap;
  }

  function getMonthDescriptionText(months) {
    const value = Math.max(0, Number(months || 0) || 0);
    if (value <= 0) return "";
    const years = Math.floor(value / 12);
    const remain = value % 12;
    if (years > 0 && remain > 0) return `${years}년 ${remain}개월`;
    if (years > 0) return `${years}년`;
    return `${remain}개월`;
  }

  function buildProfileCardDom(content) {
    const popup = document.createElement("div");
    popup.className = POPUP_CLASS;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");

    const inner = document.createElement("div");
    inner.className = `${POPUP_CLASS}-inner`;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = `${POPUP_CLASS}-close`;
    closeButton.setAttribute("aria-label", "닫기");
    closeButton.textContent = "✕";
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeProfileCardPopup();
    });

    const header = document.createElement("div");
    header.className = `${POPUP_CLASS}-header`;

    const thumb = document.createElement("span");
    thumb.className = `${POPUP_CLASS}-thumb`;
    const thumbImg = document.createElement("img");
    const profileImageUrl = String(content.profileImageUrl || "").trim();
    thumbImg.src =
      profileImageUrl ||
      "https://ssl.pstatic.net/static/nng/glive/image/default_profile_light.png?type=f120_120_na";
    thumbImg.width = 54;
    thumbImg.height = 54;
    thumbImg.alt = "";
    thumbImg.draggable = false;
    thumbImg.loading = "lazy";
    thumb.appendChild(thumbImg);

    const userBlock = document.createElement("span");
    userBlock.className = `${POPUP_CLASS}-user`;

    const nameWrap = document.createElement("span");
    nameWrap.className = `${POPUP_CLASS}-name-wrap`;
    const nameStrong = document.createElement("strong");
    nameStrong.className = `${POPUP_CLASS}-name`;
    nameStrong.textContent = String(content.nickname || "").trim() || "사용자";

    const nicknameColor = String(
      (content.streamingProperty &&
        content.streamingProperty.nicknameColor &&
        content.streamingProperty.nicknameColor.colorCode) ||
        "",
    ).trim();
    if (nicknameColor && nicknameColor.toUpperCase() !== "CC000") {
      nameStrong.style.color = nicknameColor.startsWith("#")
        ? nicknameColor
        : `#${nicknameColor}`;
    }
    nameWrap.appendChild(nameStrong);

    // 닉네임 오른쪽에 붙는 마크 (파트너 verifiedMark, 활성화된 achievement 1개)
    // 이 두 마크는 툴팁을 표시하지 않음
    const isPartner = content.verifiedMark === true;
    if (isPartner) {
      const partnerNode = createBadgeNode(OFFICIAL_MARK_URL, "", "");
      if (partnerNode) nameWrap.appendChild(partnerNode);
    }

    const achievementBadgeId = (() => {
      const ids =
        content.streamingProperty &&
        Array.isArray(content.streamingProperty.activatedAchievementBadgeIds)
          ? content.streamingProperty.activatedAchievementBadgeIds
          : [];
      return String(ids[0] || "").trim();
    })();
    if (achievementBadgeId) {
      const achievementMap =
        (window.__chzzkBadgeMoa &&
          window.__chzzkBadgeMoa.constants &&
          window.__chzzkBadgeMoa.constants.ACHIEVEMENT_BADGE_URL_MAP) ||
        {};
      const iconUrl = String(
        achievementMap[achievementBadgeId] ||
          achievementMap[achievementBadgeId.toLowerCase()] ||
          "",
      ).trim();
      if (iconUrl) {
        const achievementNode = createBadgeNode(iconUrl, "", "");
        if (achievementNode) nameWrap.appendChild(achievementNode);
      }
    }

    // 닉네임 아래에 [역할 배지(채팅 운영자/스트리머 등) → viewerBadges] 순서
    const badgeRow = document.createElement("span");
    badgeRow.className = `${POPUP_CLASS}-badges`;

    // 역할 배지: content.badge가 있으면 title.name을 툴팁으로 함께 표시
    const roleBadge = content.badge;
    const roleTitleName = String(
      (content.title && content.title.name) || "",
    ).trim();
    if (roleBadge && roleBadge.imageUrl) {
      const roleNode = createBadgeNode(roleBadge.imageUrl, roleTitleName, "");
      if (roleNode) badgeRow.appendChild(roleNode);
    }

    const viewerBadges = Array.isArray(content.viewerBadges)
      ? content.viewerBadges
      : [];
    viewerBadges.forEach((entry) => {
      const badge = entry && entry.badge ? entry.badge : null;
      if (!badge || !badge.imageUrl) return;
      const node = createBadgeNode(
        badge.imageUrl,
        String(badge.title || ""),
        String(badge.description || ""),
      );
      if (node) badgeRow.appendChild(node);
    });

    userBlock.append(nameWrap);
    if (badgeRow.childNodes.length > 0) {
      userBlock.append(badgeRow);
    }
    header.append(thumb, userBlock);

    // history 섹션의 구독 항목에서 사용하기 위해 접근
    const subscription =
      content.streamingProperty && content.streamingProperty.subscription
        ? content.streamingProperty.subscription
        : null;

    const history = document.createElement("div");
    history.className = `${POPUP_CLASS}-history`;

    if (subscription && Number(subscription.accumulativeMonth) > 0) {
      const row = document.createElement("div");
      row.className = `${POPUP_CLASS}-row`;
      if (subscription.badge && subscription.badge.imageUrl) {
        const img = document.createElement("img");
        img.src = subscription.badge.imageUrl;
        img.width = 18;
        img.height = 18;
        img.alt = "";
        img.draggable = false;
        img.loading = "lazy";
        row.appendChild(img);
      }
      const label = document.createElement("span");
      const monthText =
        getMonthDescriptionText(subscription.accumulativeMonth) || "구독";
      label.textContent = `${monthText} 구독중`;
      row.appendChild(label);
      history.appendChild(row);
    }

    const following =
      content.streamingProperty && content.streamingProperty.following
        ? content.streamingProperty.following
        : null;
    if (following && following.followDate) {
      const row = document.createElement("div");
      row.className = `${POPUP_CLASS}-row`;
      const heart = document.createElement("span");
      heart.className = `${POPUP_CLASS}-icon-heart`;
      heart.setAttribute("aria-hidden", "true");
      heart.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.01981 5.20912C7.94243 2.41313 2.5 2.82846 2.5 7.05688C2.5 9.04372 3.97427 11.6501 8.20416 14.3365C8.30036 14.3976 8.6265 14.5714 9 14.5729C9.3735 14.5744 9.67935 14.4103 9.76222 14.3578C14.0179 11.6639 15.5 9.04898 15.5 7.05688C15.5 2.8528 10.1031 2.39656 9.01981 5.20912Z" fill="currentColor"></path></svg>';
      row.appendChild(heart);
      const label = document.createElement("span");
      const dateText = String(following.followDate || "").slice(0, 10);
      const formattedDate = dateText
        ? `${dateText.slice(0, 4)}년 ${dateText.slice(5, 7)}월 ${dateText.slice(8, 10)}일`
        : "";
      label.textContent = formattedDate
        ? `${formattedDate}부터 팔로우`
        : "팔로우 중";
      row.appendChild(label);
      history.appendChild(row);
    }

    inner.append(closeButton, header);
    if (history.childNodes.length > 0) {
      inner.appendChild(history);
    }
    popup.appendChild(inner);
    return popup;
  }

  function buildLoadingDom(nickname) {
    const popup = document.createElement("div");
    popup.className = `${POPUP_CLASS} ${POPUP_CLASS}-loading`;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    const inner = document.createElement("div");
    inner.className = `${POPUP_CLASS}-inner`;
    const text = document.createElement("div");
    text.className = `${POPUP_CLASS}-message`;
    text.textContent = `${nickname || "사용자"} 정보를 불러오는 중...`;
    inner.appendChild(text);
    popup.appendChild(inner);
    return popup;
  }

  function buildErrorDom(message) {
    const popup = document.createElement("div");
    popup.className = `${POPUP_CLASS} ${POPUP_CLASS}-error`;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    const inner = document.createElement("div");
    inner.className = `${POPUP_CLASS}-inner`;
    const text = document.createElement("div");
    text.className = `${POPUP_CLASS}-message`;
    text.textContent = String(message || "프로필을 불러올 수 없습니다.");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = `${POPUP_CLASS}-close`;
    closeButton.setAttribute("aria-label", "닫기");
    closeButton.textContent = "✕";
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeProfileCardPopup();
    });
    inner.append(closeButton, text);
    popup.appendChild(inner);
    return popup;
  }

  function getMoaPopupRect(state) {
    const moaPopup = state && state.ui && state.ui.popup;
    if (!moaPopup || typeof moaPopup.getBoundingClientRect !== "function") {
      return null;
    }
    const rect = moaPopup.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return rect;
  }

  const PROFILE_CARD_WIDTH = 340;
  const PROFILE_CARD_EDGE_GAP = 7;

  function positionPopup(popup, anchorElement, state) {
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const moaRect = getMoaPopupRect(state);

    popup.style.width = `${PROFILE_CARD_WIDTH}px`;
    const popupWidth = popup.offsetWidth || PROFILE_CARD_WIDTH;
    const popupHeight = popup.offsetHeight || 220;

    let anchorRect = null;
    if (
      anchorElement &&
      typeof anchorElement.getBoundingClientRect === "function"
    ) {
      anchorRect = anchorElement.getBoundingClientRect();
    }

    // 가로: 앵커(닉네임)를 기준으로 popup 중앙 정렬을 시도하되,
    // 모아보기 영역(가능하면) 또는 viewport 안에 머무르도록 클램프.
    let left;
    if (anchorRect) {
      const anchorCenter = anchorRect.left + anchorRect.width / 2;
      left = anchorCenter - popupWidth / 2;
    } else if (moaRect) {
      left = moaRect.right - popupWidth - PROFILE_CARD_EDGE_GAP;
    } else {
      left = (viewportWidth - popupWidth) / 2;
    }

    // 클램프 우선순위: 모아보기 영역 → viewport
    if (moaRect && moaRect.width >= popupWidth + PROFILE_CARD_EDGE_GAP * 2) {
      // 모아보기 영역이 popup을 충분히 담을 수 있을 때: 그 영역 안에 가둠
      const minLeft = moaRect.left + PROFILE_CARD_EDGE_GAP;
      const maxLeft = moaRect.right - popupWidth - PROFILE_CARD_EDGE_GAP;
      if (left < minLeft) left = minLeft;
      if (left > maxLeft) left = maxLeft;
    } else if (moaRect) {
      // 모아보기 영역이 popup보다 좁으면: 영역 우측에 붙임 (기존 동작)
      left = moaRect.right - popupWidth - PROFILE_CARD_EDGE_GAP;
    }

    if (left + popupWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - popupWidth - 8);
    }
    if (left < 8) left = 8;

    // 세로: 클릭 닉네임 기준으로 위/아래 결정. 위쪽 공간이 충분하면 위로.
    let top;
    if (anchorRect) {
      const spaceAbove = anchorRect.top;
      const spaceBelow = viewportHeight - anchorRect.bottom;
      const fitsAbove = popupHeight + 12 <= spaceAbove;
      const fitsBelow = popupHeight + 12 <= spaceBelow;
      const placeAbove = fitsAbove && (!fitsBelow || spaceAbove >= spaceBelow);
      if (placeAbove) {
        top = anchorRect.top - popupHeight - 6;
      } else {
        top = anchorRect.bottom + 6;
      }
    } else if (moaRect) {
      top = moaRect.bottom + 6;
    } else {
      top = (viewportHeight - popupHeight) / 2;
    }

    if (top < 8) top = 8;
    if (top + popupHeight > viewportHeight - 8) {
      top = Math.max(8, viewportHeight - popupHeight - 8);
    }

    popup.style.position = "fixed";
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;

    // 모아보기 팝업 기준 상대 오프셋 저장 — 리사이즈 시 재배치에 사용
    if (moaRect) {
      activeRelativeOffset = {
        relLeft: left - moaRect.left,
        relTop: top - moaRect.top,
      };
    } else {
      activeRelativeOffset = null;
    }
  }

  function repositionFromRelativeOffset() {
    if (!activePopupRoot || !activeRelativeOffset || !activeMoaPopupEl) return;
    if (!activeMoaPopupEl.isConnected) return;

    const moaRect = activeMoaPopupEl.getBoundingClientRect();
    if (!moaRect || (moaRect.width === 0 && moaRect.height === 0)) return;

    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const popupWidth = activePopupRoot.offsetWidth || PROFILE_CARD_WIDTH;
    const popupHeight = activePopupRoot.offsetHeight || 220;

    let left = moaRect.left + activeRelativeOffset.relLeft;
    let top = moaRect.top + activeRelativeOffset.relTop;

    // 모아보기 영역이 popup을 담을 수 있으면 그 안에 가둠
    if (moaRect.width >= popupWidth + PROFILE_CARD_EDGE_GAP * 2) {
      const minLeft = moaRect.left + PROFILE_CARD_EDGE_GAP;
      const maxLeft = moaRect.right - popupWidth - PROFILE_CARD_EDGE_GAP;
      if (left < minLeft) left = minLeft;
      if (left > maxLeft) left = maxLeft;
    } else {
      left = moaRect.right - popupWidth - PROFILE_CARD_EDGE_GAP;
    }

    if (left + popupWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - popupWidth - 8);
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    if (top + popupHeight > viewportHeight - 8) {
      top = Math.max(8, viewportHeight - popupHeight - 8);
    }

    activePopupRoot.style.left = `${Math.round(left)}px`;
    activePopupRoot.style.top = `${Math.round(top)}px`;
  }

  function attachOutsideClose(popup) {
    outsideClickHandler = (event) => {
      if (!popup.contains(event.target)) {
        closeProfileCardPopup();
      }
    };
    document.addEventListener("mousedown", outsideClickHandler, true);
  }

  function mountPopup(popup, anchorElement, state) {
    document.body.appendChild(popup);
    activePopupRoot = popup;
    activeMoaPopupEl = (state && state.ui && state.ui.popup) || null;
    positionPopup(popup, anchorElement, state);
    attachOutsideClose(popup);
    attachReposition();
  }

  function attachReposition() {
    if (!activeMoaPopupEl) return;

    // 모아보기 팝업 자체의 크기/위치 변경 추적 (사용자 드래그 리사이즈 등)
    if (typeof ResizeObserver === "function") {
      activeResizeObserver = new ResizeObserver(() => {
        repositionFromRelativeOffset();
      });
      try {
        activeResizeObserver.observe(activeMoaPopupEl);
        if (activeMoaPopupEl.parentElement) {
          activeResizeObserver.observe(activeMoaPopupEl.parentElement);
        }
      } catch (_error) {}
    }

    // 브라우저 창 리사이즈
    activeWindowResizeHandler = () => {
      repositionFromRelativeOffset();
    };
    window.addEventListener("resize", activeWindowResizeHandler);

    // 페이지 스크롤 (모아보기 팝업이 absolute라 부모 영역이 스크롤되면 같이 이동)
    activeScrollHandler = () => {
      repositionFromRelativeOffset();
    };
    window.addEventListener("scroll", activeScrollHandler, true);
  }

  function swapPopup(nextPopup, anchorElement, state) {
    if (activePopupRoot && activePopupRoot.parentNode) {
      activePopupRoot.parentNode.removeChild(activePopupRoot);
    }
    activePopupRoot = nextPopup;
    document.body.appendChild(nextPopup);
    positionPopup(nextPopup, anchorElement, state);
  }

  async function openProfileCardForEntry(state, entry, anchorElement) {
    if (!entry || !entry.authorUserIdHash) return;
    const userIdHash = String(entry.authorUserIdHash || "").trim();
    if (!isValidUserIdHash(userIdHash)) return;
    const chatChannelId = String((state && state.chatChannelId) || "").trim();
    if (!isValidChatChannelId(chatChannelId)) {
      closeProfileCardPopup();
      mountPopup(
        buildErrorDom(
          "현재 채널을 확인할 수 없어 프로필을 표시할 수 없습니다.",
        ),
        anchorElement,
        state,
      );
      return;
    }

    closeProfileCardPopup();
    const loadingDom = buildLoadingDom(entry.nickname);
    mountPopup(loadingDom, anchorElement, state);

    const token = ++activeFetchToken;
    const content = await fetchProfileCard(chatChannelId, userIdHash);
    if (token !== activeFetchToken) return;
    if (!activePopupRoot) return;

    if (!content) {
      swapPopup(
        buildErrorDom("프로필 정보를 불러올 수 없습니다."),
        anchorElement,
        state,
      );
      return;
    }

    swapPopup(buildProfileCardDom(content), anchorElement, state);
  }

  ns.profileCardApi = {
    openProfileCardForEntry,
    closeProfileCardPopup,
    isValidUserIdHash,
    isValidChatChannelId,
  };
})();
