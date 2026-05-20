(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.bootstrapApi && typeof ns.bootstrapApi === "object") return;

  function begin() {
    if (window.__chzzkBadgeMoaChatInitialized) return false;
    window.__chzzkBadgeMoaChatInitialized = true;
    return true;
  }

  function cleanupStaleRoots() {
    document
      .querySelectorAll(".chzzk-badge-moa-root")
      .forEach((node) => node.remove());
  }

  function ensurePingListener(deps = {}) {
    if (window.__chzzkBadgeMoaPingListenerAttached) return;

    const chromeObj = deps.chromeObj || (typeof chrome !== "undefined" ? chrome : null);
    const getSettingsContext =
      typeof deps.getSettingsContext === "function"
        ? deps.getSettingsContext
        : () => ({ ok: false });
    const applySettingsPayload =
      typeof deps.applySettingsPayload === "function"
        ? deps.applySettingsPayload
        : () => {};
    const clearCurrentChannelEntries =
      typeof deps.clearCurrentChannelEntries === "function"
        ? deps.clearCurrentChannelEntries
        : () => ({ ok: false });
    const hasCurrentChannelData =
      typeof deps.hasCurrentChannelData === "function"
        ? deps.hasCurrentChannelData
        : () => ({ ok: false, hasEntries: false, hasCachedSession: false });

    if (
      !chromeObj ||
      !chromeObj.runtime ||
      typeof chromeObj.runtime.onMessage !== "object" ||
      typeof chromeObj.runtime.onMessage.addListener !== "function"
    ) {
      return;
    }

    window.__chzzkBadgeMoaPingListenerAttached = true;
    chromeObj.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const type = message && message.type ? String(message.type) : "";
      if (!type) return false;

      if (type === "chzzk_badge_moa_content_ping") {
        sendResponse({ ok: true, ts: Date.now() });
        return false;
      }

      if (type === "chzzk_badge_moa_get_settings_context") {
        sendResponse(getSettingsContext());
        return false;
      }

      if (type === "chzzk_badge_moa_apply_settings") {
        const payload =
          message && typeof message.payload === "object" ? message.payload : {};
        applySettingsPayload(payload);
        sendResponse({ ok: true });
        return false;
      }

      if (type === "chzzk_badge_moa_has_current_channel_data") {
        Promise.resolve()
          .then(() => hasCurrentChannelData())
          .then((result) => {
            sendResponse(
              result && typeof result === "object"
                ? result
                : { ok: false, hasEntries: false, hasCachedSession: false },
            );
          })
          .catch(() => {
            sendResponse({
              ok: false,
              hasEntries: false,
              hasCachedSession: false,
            });
          });
        return true;
      }

      if (type === "chzzk_badge_moa_clear_current_channel") {
        Promise.resolve(clearCurrentChannelEntries())
          .then((result) => {
            sendResponse(
              result && typeof result === "object" ? result : { ok: true },
            );
          })
          .catch(() => {
            sendResponse({ ok: false });
          });
        return true;
      }

      return false;
    });
  }

  ns.bootstrapApi = {
    begin,
    cleanupStaleRoots,
    ensurePingListener,
  };
})();
