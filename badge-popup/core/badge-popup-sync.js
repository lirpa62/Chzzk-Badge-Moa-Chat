(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.sync && typeof ns.sync === "object") return;

  const CHANNEL_NAME = "chzzk-badge-moa-sync";
  const MESSAGE_TYPE_READ = "read";
  // 모아보기 전용 창의 생존 신호. 전용 창이 열려 있는 동안 주기적으로 alive 를,
  // 닫힐 때 closed 를 방송해, 같은 채널의 원래 탭이 인라인 UI 를 감추거나 복원한다.
  const MESSAGE_TYPE_MOA_WINDOW = "moa-window";

  const senderId =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  let channel = null;
  let readHandler = null;
  let moaWindowHandler = null;

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

  function handleChannelMessage(event) {
    const data = event && event.data;
    if (!data || typeof data !== "object") return;
    if (data.senderId === senderId) return;
    if (data.type === MESSAGE_TYPE_READ) {
      if (typeof readHandler === "function") {
        readHandler({ channelId: String(data.channelId || "") });
      }
      return;
    }
    if (data.type === MESSAGE_TYPE_MOA_WINDOW) {
      if (typeof moaWindowHandler === "function") {
        moaWindowHandler({
          channelId: String(data.channelId || ""),
          alive: data.alive === true,
        });
      }
    }
  }

  function ensureChannelListener() {
    const ch = getChannel();
    if (ch) ch.onmessage = handleChannelMessage;
  }

  function setReadHandler(handler) {
    readHandler = typeof handler === "function" ? handler : null;
    ensureChannelListener();
  }

  function setMoaWindowHandler(handler) {
    moaWindowHandler = typeof handler === "function" ? handler : null;
    ensureChannelListener();
  }

  // 전용 창 생존 신호 방송. alive=true(살아있음)/false(닫힘).
  function broadcastMoaWindow(channelId, alive) {
    const ch = getChannel();
    if (!ch) return;
    const id = String(channelId || "").trim();
    if (!id) return;
    try {
      ch.postMessage({
        type: MESSAGE_TYPE_MOA_WINDOW,
        channelId: id,
        alive: alive === true,
        senderId,
        ts: Date.now(),
      });
    } catch (_error) {}
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
    broadcastMoaWindow,
    setMoaWindowHandler,
  };
})();
