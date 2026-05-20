(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.sync && typeof ns.sync === "object") return;

  const CHANNEL_NAME = "chzzk-badge-moa-sync";
  const MESSAGE_TYPE_READ = "read";

  const senderId =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  let channel = null;
  let readHandler = null;

  function getChannel() {
    if (channel) return channel;
    if (typeof BroadcastChannel !== "function") return null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (_error) {
      channel = null;
    }
    return channel;
  }

  function setReadHandler(handler) {
    readHandler = typeof handler === "function" ? handler : null;
    const ch = getChannel();
    if (!ch) return;
    ch.onmessage = (event) => {
      const data = event && event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== MESSAGE_TYPE_READ) return;
      if (data.senderId === senderId) return;
      if (typeof readHandler === "function") {
        readHandler({ channelId: String(data.channelId || "") });
      }
    };
  }

  function broadcastRead(channelId) {
    const ch = getChannel();
    if (!ch) return;
    const id = String(channelId || "").trim();
    if (!id) return;
    try {
      ch.postMessage({
        type: MESSAGE_TYPE_READ,
        channelId: id,
        senderId,
        ts: Date.now(),
      });
    } catch (_error) {}
  }

  ns.sync = {
    broadcastRead,
    setReadHandler,
  };
})();
