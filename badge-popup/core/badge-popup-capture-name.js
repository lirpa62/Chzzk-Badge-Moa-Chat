// 캡처 이미지 파일 이름 형식.
//
// 사용자가 정한 형식(예: "{채널}_{제목}_{날짜}_{시각}")의 항목을 값으로 바꾼다.
// 설정 팝업(미리보기)과 치지직 페이지의 캡처(실제 저장)가 같은 규칙을 쓴다.
(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.captureName && typeof ns.captureName === "object") return;

  const DEFAULT_FORMAT = "badge-moa-chat-{날짜}-{시각}";
  const FALLBACK_NAME = "badge-moa-chat";
  const TOKENS = ["채널", "제목", "카테고리", "날짜", "시각"];
  const MAX_LENGTH = 200;
  const TOKEN_PATTERN = `\\{(${TOKENS.join("|")})\\}`;
  const SEPARATORS = "_\\-\\s.·";

  // 저장할 형식. 비었거나 항목이 하나도 없으면 기본 형식.
  function normalizeFormat(value) {
    const text = String(value ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, MAX_LENGTH);
    return text && new RegExp(TOKEN_PATTERN).test(text) ? text : DEFAULT_FORMAT;
  }

  function usesToken(formatText, token) {
    return normalizeFormat(formatText).includes(`{${token}}`);
  }

  const pad = (value) => String(value).padStart(2, "0");
  const dateText = (date) =>
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timeText = (date) =>
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

  // values: { channel, title, category, at(캡처 시각 ms) }
  // 빈 항목은 바로 앞의 구분자(_ - 공백 . ·)와 함께 빠진다.
  function format(formatText, values = {}) {
    const at = new Date(Number.isFinite(values.at) ? values.at : Date.now());
    const map = {
      채널: values.channel,
      제목: values.title,
      카테고리: values.category,
      날짜: dateText(at),
      시각: timeText(at),
    };
    const EMPTY = "\u0000";
    return normalizeFormat(formatText)
      .replace(
        new RegExp(TOKEN_PATTERN, "g"),
        (_, key) =>
          String(map[key] ?? "")
            .replace(/\u0000/g, "")
            .trim() || EMPTY,
      )
      .replace(new RegExp(`[${SEPARATORS}]*${EMPTY}`, "g"), "")
      .replace(new RegExp(`^[${SEPARATORS}]+|[${SEPARATORS}]+$`, "g"), "");
  }

  // 이름(번호·확장자 제외) 최대 길이(UTF-8 바이트). 흔한 파일 시스템 한도가
  // 255바이트라, 뒤에 붙는 "-12.png" 등을 넉넉히 남긴다.
  const MAX_NAME_BYTES = 200;
  // 이름이 길면 이 순서로 값의 끝을 줄인다. 날짜·시각은 줄이지 않는다.
  const SHRINK_ORDER = ["title", "category", "channel"];
  const ELLIPSIS = "…";

  const encoder = typeof TextEncoder === "function" ? new TextEncoder() : null;
  const byteLength = (text) =>
    encoder ? encoder.encode(text).length : unescape(encodeURIComponent(text)).length;

  // 글자 단위로 나눈다. 🐈‍⬛ 같은 이모지 묶음을 반으로 가르지 않는다.
  let segmenter = null;
  function splitGraphemes(text) {
    if (!segmenter && typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    }
    return segmenter
      ? Array.from(segmenter.segment(text), (part) => part.segment)
      : Array.from(text);
  }

  function truncateBytes(text, maxBytes) {
    if (byteLength(text) <= maxBytes) return text;
    let out = "";
    let bytes = 0;
    for (const char of splitGraphemes(text)) {
      const size = byteLength(char);
      if (bytes + size > maxBytes) break;
      out += char;
      bytes += size;
    }
    return out;
  }

  // 파일 이름에 못 쓰는 글자를 정리한다. 보이지 않는 서식문자(ZWJ 등)와
  // 경로 구분자, 앞뒤 점은 브라우저가 파일 이름으로 거부한다.
  function cleanFilename(name) {
    return String(name || "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\p{Cf}/gu, "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.{2,}/g, ".")
      .replace(/^\.+/, "")
      .replace(/\.+$/, "")
      .trim();
  }

  // 정리 + 길이 제한(마지막 안전장치: 직접 쓴 문구가 아주 긴 경우 끝을 자른다).
  function sanitizeFilename(name) {
    const fitted = truncateBytes(cleanFilename(name), MAX_NAME_BYTES)
      .trim()
      .replace(/\.+$/, "");
    return fitted || FALLBACK_NAME;
  }

  // 이름이 길면 날짜·시각은 남기고 제목 → 카테고리 → 채널 순으로 값의 끝을 줄인다.
  function buildBaseName(formatText, values = {}) {
    const current = { ...values };
    const make = () => cleanFilename(format(formatText, current));
    if (byteLength(make()) <= MAX_NAME_BYTES) return sanitizeFilename(make());
    for (const key of SHRINK_ORDER) {
      const chars = splitGraphemes(String(values[key] ?? "").trim());
      if (chars.length === 0) continue;
      const shorten = (count) =>
        count > 0 ? `${chars.slice(0, count).join("").trimEnd()}${ELLIPSIS}` : "";
      // 들어가는 가장 긴 길이를 찾는다(0 이면 그 항목은 구분자와 함께 빠진다).
      let low = 0;
      let high = chars.length - 1;
      let best = 0;
      while (low <= high) {
        const mid = (low + high) >> 1;
        current[key] = shorten(mid);
        if (byteLength(make()) <= MAX_NAME_BYTES) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      current[key] = shorten(best);
      if (byteLength(make()) <= MAX_NAME_BYTES) break;
    }
    return sanitizeFilename(make());
  }

  // 여러 장으로 나뉘면 이름 뒤에 -1, -2 … 를 붙인다.
  function buildFilename(formatText, values, index = 0, total = 1) {
    const base = buildBaseName(formatText, values);
    const suffix = total > 1 ? `-${index + 1}` : "";
    return `${base}${suffix}.png`;
  }

  ns.captureName = {
    DEFAULT_FORMAT,
    TOKENS,
    MAX_LENGTH,
    normalizeFormat,
    usesToken,
    format,
    sanitizeFilename,
    buildFilename,
  };
})();
