(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.confirmApi && typeof ns.confirmApi === "object") return;

  async function requestDeleteConfirm(state, message, options = {}, deps = {}) {
    if (!state || !state.settings || state.settings.deleteWithoutConfirm === true) {
      return true;
    }

    const result = await showConfirmDialog(
      state,
      {
        title: String(options.title || "삭제 확인"),
        message: String(message || ""),
        confirmText: String(options.confirmText || "삭제"),
        cancelText: String(options.cancelText || "취소"),
      },
      deps,
    );
    return result === true;
  }

  function showConfirmDialog(
    state,
    {
      title = "삭제 확인",
      message = "",
      confirmText = "삭제",
      secondaryText = "",
      cancelText = "취소",
    } = {},
    deps = {},
  ) {
    const doc = deps.document || document;
    const win = deps.window || window;
    const resolveConfirmDialogFn =
      typeof deps.resolveConfirmDialog === "function"
        ? deps.resolveConfirmDialog
        : (confirmed, options) => resolveConfirmDialog(state, confirmed, options, deps);
    const trapFocusInConfirmDialogFn =
      typeof deps.trapFocusInConfirmDialog === "function"
        ? deps.trapFocusInConfirmDialog
        : (event) => trapFocusInConfirmDialog(state, event, deps);

    const {
      confirmModal,
      confirmDialog,
      confirmTitle,
      confirmMessage,
      confirmCancelButton,
      confirmSecondaryButton,
      confirmDeleteButton,
    } = (state && state.ui) || {};
    const hasSecondaryAction = !!String(secondaryText || "").trim();

    if (
      !confirmModal ||
      !confirmDialog ||
      !confirmTitle ||
      !confirmMessage ||
      !confirmCancelButton ||
      (hasSecondaryAction && !confirmSecondaryButton) ||
      !confirmDeleteButton
    ) {
      const primaryConfirmed = win.confirm(String(message || ""));
      if (primaryConfirmed || !hasSecondaryAction) {
        return Promise.resolve(primaryConfirmed);
      }
      return Promise.resolve(
        win.confirm(`${String(secondaryText).trim()}만 진행할까요?`)
          ? "secondary"
          : false,
      );
    }

    if (state.confirmDialog.open) {
      resolveConfirmDialogFn(false, { restoreFocus: false });
    }

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmCancelButton.textContent = cancelText;
    if (confirmSecondaryButton) {
      const safeSecondaryText = String(secondaryText || "").trim();
      confirmSecondaryButton.textContent = safeSecondaryText;
      confirmSecondaryButton.hidden = !safeSecondaryText;
    }
    confirmDeleteButton.textContent = confirmText;

    state.confirmDialog.open = true;
    state.confirmDialog.lastFocused =
      doc.activeElement instanceof HTMLElement ? doc.activeElement : null;

    confirmModal.classList.add("is-open");
    confirmModal.removeAttribute("inert");
    confirmModal.setAttribute("aria-hidden", "false");

    state.confirmDialog.keyHandler = (event) => {
      if (!state.confirmDialog.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        resolveConfirmDialogFn(false);
        return;
      }
      if (event.key === "Tab") {
        trapFocusInConfirmDialogFn(event);
      }
    };
    doc.addEventListener("keydown", state.confirmDialog.keyHandler, true);

    setTimeout(() => {
      if (!state.confirmDialog.open) return;
      try {
        confirmCancelButton.focus({ preventScroll: true });
      } catch (_error) {
        confirmCancelButton.focus();
      }
    }, 0);

    return new Promise((resolve) => {
      state.confirmDialog.resolver = resolve;
    });
  }

  function resolveConfirmDialog(
    state,
    confirmed,
    options = { restoreFocus: true },
    deps = {},
  ) {
    const doc = deps.document || document;

    const {
      confirmModal,
      confirmDialog,
      confirmCancelButton,
      confirmDeleteButton,
      pill,
    } = (state && state.ui) || {};

    if (
      !confirmModal ||
      !confirmDialog ||
      !confirmCancelButton ||
      !confirmDeleteButton
    ) {
      return;
    }

    if (state.confirmDialog.keyHandler) {
      doc.removeEventListener("keydown", state.confirmDialog.keyHandler, true);
      state.confirmDialog.keyHandler = null;
    }

    const resolver = state.confirmDialog.resolver;
    const wasOpen = state.confirmDialog.open;
    state.confirmDialog.resolver = null;
    state.confirmDialog.open = false;

    confirmModal.classList.remove("is-open");
    confirmModal.setAttribute("inert", "");
    confirmModal.setAttribute("aria-hidden", "true");

    if (wasOpen && typeof resolver === "function") {
      resolver(confirmed);
    }

    if (options && options.restoreFocus === false) {
      state.confirmDialog.lastFocused = null;
      return;
    }

    const fallbackFocusTarget =
      state.confirmDialog.lastFocused instanceof HTMLElement &&
      state.confirmDialog.lastFocused.isConnected
        ? state.confirmDialog.lastFocused
        : pill;
    state.confirmDialog.lastFocused = null;

    if (
      fallbackFocusTarget &&
      typeof fallbackFocusTarget.focus === "function"
    ) {
      try {
        fallbackFocusTarget.focus({ preventScroll: true });
      } catch (_error) {
        fallbackFocusTarget.focus();
      }
    }
  }

  function trapFocusInConfirmDialog(state, event, deps = {}) {
    const getFocusableElementsFn =
      typeof deps.getFocusableElements === "function"
        ? deps.getFocusableElements
        : getFocusableElements;
    const doc = deps.document || document;
    const dialog = state && state.ui ? state.ui.confirmDialog : null;
    if (!dialog) return;

    const focusables = getFocusableElementsFn(dialog);
    if (focusables.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const active = doc.activeElement;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey) {
      if (active === first || !dialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  function getFocusableElements(container) {
    if (!(container instanceof HTMLElement)) return [];
    const selector =
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    return Array.from(container.querySelectorAll(selector)).filter(
      (element) => {
        if (!(element instanceof HTMLElement)) return false;
        return element.offsetParent !== null;
      },
    );
  }

  ns.confirmApi = {
    requestDeleteConfirm,
    showConfirmDialog,
    resolveConfirmDialog,
    trapFocusInConfirmDialog,
    getFocusableElements,
  };
})();
