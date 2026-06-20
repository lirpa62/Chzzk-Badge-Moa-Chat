(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.constants && typeof ns.constants === "object") return;

  const MESSAGE_MARK = "__CHZZK_BADGE_MOA__";
  const INJECT_TRACKED_SYNC_TYPE = "CHZZK_BADGE_MOA_SET_TRACKED_NICKNAMES";
  const STORAGE_HEIGHT_KEY = "chzzk_badge_moa_popup_height";
  const STORAGE_HEIGHT_KEY_LIVE = "chzzk_badge_moa_popup_height_live";
  const STORAGE_HEIGHT_KEY_VOD = "chzzk_badge_moa_popup_height_vod";
  const STORAGE_HEIGHT_KEY_LIVE_WIDE = "chzzk_badge_moa_popup_height_live_wide";
  const STORAGE_HEIGHT_KEY_VOD_WIDE = "chzzk_badge_moa_popup_height_vod_wide";
  const STORAGE_HEIGHT_KEY_CHAT_POPUP = "chzzk_badge_moa_popup_height_chat_popup";
  const STORAGE_DISPLAY_STYLE_KEY = "chzzk_badge_moa_popup_display_style";
  const STORAGE_SETTINGS_KEY = "chzzk_badge_moa_popup_settings";
  const STORAGE_CHANNEL_CACHE_PREFIX = "chzzk_badge_moa_tab_channel_cache_v1:";
  const STORAGE_SESSION_FALLBACK_PREFIX = "chzzk_badge_moa_session_fallback:";
  const OFFICIAL_MARK_URL =
    "https://ssl.pstatic.net/static/nng/glive/image/icon_official_mark.png";
  const MANAGER_BADGE_FALLBACK_URL =
    "https://ssl.pstatic.net/static/nng/glive/icon/manager.png";
  const CHANNEL_OWNER_BADGE_FALLBACK_URL =
    "https://ssl.pstatic.net/static/nng/glive/icon/streamer.png";
  const OWNER_BADGE_FALLBACK_URL =
    "https://ssl.pstatic.net/static/nng/glive/icon/owner.png";
  const ACHIEVEMENT_BADGE_URL_MAP = {
    "2025chzzkcup_1":
      "https://nng-phinf.pstatic.net/MjAyNTEyMzBfMjU4/MDAxNzY3MDgxODczNjA2.WSIGn-NlCjbGAKomslHWdyPOADmnaX5cvBfCskSwEsQg.dZDFrMbTTVAPZBBOE6sUOGAk6D_DYvL-dsQK9wKdZbQg.PNG/%EC%9A%B0%EC%8A%B9%ED%8C%80.png",
    "2025chzzkcup_2":
      "https://nng-phinf.pstatic.net/MjAyNTEyMzBfMTc2/MDAxNzY3MDgyMDEyNDAw.DmMhs-TROPuxmXoT-fur1EUdbl74UsFGaG4D_0TN9NMg.gaAhW1wR3LsotwdAIn3K8Bx5-7pwZ_-UO39gWYO4NLEg.PNG/2%EC%9C%84.png",
    "2025chzzkcup_3":
      "https://nng-phinf.pstatic.net/MjAyNTEyMzBfMjg0/MDAxNzY3MDgyMTQxMjkw.yqUbAh_oHqq4ERj59MXoLakFSNSOL9ov7oN5HG0O9N4g.vDSQBKar0DZ0uxDtQ-4JM_U_xD9t1iaEy6JVxxUHizQg.PNG/3%EC%9C%84.png",
    chistival_overcooked:
      "https://nng-phinf.pstatic.net/MjAyNTA4MjVfMjkx/MDAxNzU2MDk4MDg5MTYz.OB6AzJj3XW235D3_RoL-RCc0RIQyMl5HbZmRWJTBwdwg.p2TicS08K052ZCv_VosAn4seKuMu7cNLInBpZJU9jlAg.PNG/%EC%B9%98%EC%8A%A4%ED%8B%B0%EB%B2%8C_5%ED%9A%8C%EC%B0%A8_%EC%98%A4%EB%B2%84%EC%BF%A1%EB%93%9C2_128px.png",
    chstival_pubg_1:
      "https://nng-phinf.pstatic.net/MjAyNDEyMjBfMTA1/MDAxNzM0NjY1NTgzOTY4.I-aSeAhhOOvI0dK73_lOpxHr3jVGU2gJvBLO62q89kUg.kEwySFgJnPpyMpT27jNvh0ScEkTI-7l7OkMsEI0L_VAg.PNG/%EC%B9%98%EC%8A%A4%ED%8B%B0%EB%B2%8C_3%ED%9A%8C%EC%B0%A8.png",
    chstival_head_1:
      "https://nng-phinf.pstatic.net/MjAyNTA0MDFfMTEw/MDAxNzQzNDk5MzA4Njk4.i5A4Yl4pBKtezupKxWw4sWXKs-IJAi23zE_di9D8lfEg.SGOtQXxQH6LQ78pQlsDEVJOMPSDvrzz9vOvSXuyvvUAg.PNG/%EC%B9%98%EC%8A%A4%ED%8B%B0%EB%B2%8C_4%ED%9A%8C%EC%B0%A8.png",
    chstival_party_1:
      "https://nng-phinf.pstatic.net/MjAyNDEyMjBfMTg0/MDAxNzM0NjY1NTI2Mzk4.1--5ZJYhgS5dD6DRZn5RaIIYJ4oNFhNmO8lB5dEDyy0g.SDZuY8dP9egGD0-kiZiLzuZ8wKhUAoOPoxErvvOBh60g.PNG/%EC%B9%98%EC%8A%A4%ED%8B%B0%EB%B2%8C_2%ED%9A%8C%EC%B0%A8.png",
    chstival_fall_1:
      "https://nng-phinf.pstatic.net/MjAyNDEyMjBfMTEx/MDAxNzM0NjY1NDc3Njg1.YaC7hHZb0CzgcMgNpLjpRJgqjMHHAWV16_V8plcXf7sg.sEWIiMWzrNV6C2kBUSCPJwBlFjjqs-Ue7npiN27GG5Eg.PNG/%EC%B9%98%EC%8A%A4%ED%8B%B0%EB%B2%8C_1%ED%9A%8C%EC%B0%A8.png",
    chistival_sonicracingcrossworld:
      "https://nng-phinf.pstatic.net/MjAyNjAyMDNfMTMw/MDAxNzcwMDkxMTM1NTQ2.9l3zJeubb3WfOm2a243pWy304a1TN4I0Ss6iPOWM5wIg.GaSsvEn7BqwLkc7C-tVumzF_ImRuLNsApz26y_xxaiEg.PNG/%EC%B9%98%EC%8A%A4%ED%8B%B0%EB%B2%8C_%EC%9A%B0%EC%8A%B9_%EB%B0%B0%EC%A7%80_6%ED%9A%8C%EC%B0%A8_128px.png",
    fco_teammaster:
      "https://nng-phinf.pstatic.net/MjAyNTA2MjhfMTYy/MDAxNzUxMDkyNDQ2NDUz.2AyKLN4E3LGHikzPJ1NSP40ZOqAE67wQvDR9WaaPb8sg.gS3TfMGN2ReP3wwbhYb9T75G3Ikwq0zX5Vpdx7rT1jQg.PNG/FCO_%EC%9A%B0%EB%8B%B9%ED%83%95_%EC%B6%95%EA%B5%AC%EB%8B%A8_%EB%B0%B0%EC%A7%80_128px.png",
    chraksil_dd_1_128:
      "https://nng-phinf.pstatic.net/MjAyNDEwMzBfNDAg/MDAxNzMwMjc3OTY4NTQw.sjD5L1OayJsWNmL6s903rqcqHWTDeNHWCbgZsElP6Ckg.Va3FHdP1-ZH4DMKf3TyHPJo71HgXr5KLJIHsZOYzazgg.PNG/DD_1%EB%93%B1_h128.png",
    chraksil_dd_2_128:
      "https://nng-phinf.pstatic.net/MjAyNDEwMzBfMTM4/MDAxNzMwMjc3OTgzNzYy.RLDp2VQdZ87PHPZL4GkfeL_LCO63LWuBm8Z7z-jUA_0g.031CDAFmE-JaVlyh362zhEkPQXfwwtYDl8mIVuZvWPgg.PNG/DD_2%EB%93%B1_h128.png",
    chraksil_dd_3_128:
      "https://nng-phinf.pstatic.net/MjAyNDEwMzBfNDYg/MDAxNzMwMjc4MzEwNDIx.s9sEEWQwOBQoi6UQHzy3arqUjLIXUbZ8I7goGidrLuog.Jh2Ws30-ibxDQYe49K8Euuc-qvYX4X-uEVKLRG4Mve0g.PNG/DD_3%EB%93%B1_h128.png",
    chraksil_dd_4_128:
      "https://nng-phinf.pstatic.net/MjAyNDEwMzBfMjIg/MDAxNzMwMjc4Mzk1OTM0.6XPdGEI-VStDumkzDZoo62Dm31wE7jFDf64J4LQmWGgg.pkJnwxoxvjJLk89MQ3eRsbx81y7kYfgSwnQlbsLFTeMg.PNG/DD_4%EB%93%B1-10%EB%93%B1_h128.png",
    chraksil_dd_5_128:
      "https://nng-phinf.pstatic.net/MjAyNDEwMzBfMjA4/MDAxNzMwMjc4NDI4MzE3.R3ZswKy5mvqZb5OUmEGFEt2lSxCAXzDWfEjhsmslU7Qg.T88VDfi-M6JKqcwVI-hWyaQMpczIZcWrgCl2vMFygNgg.PNG/DD_%EC%B0%B8%EA%B0%80%EC%83%81_h128.png",
    chraksil_snowbros_1:
      "https://nng-phinf.pstatic.net/MjAyNTExMDdfMzAw/MDAxNzYyNTA5MDcyMDQy.T-YnO75xMoS3EFMN2xP2N5oBVayBjzUVhibX8nKl8UAg.dq0jBmfqB_2pMj4A-ZdmDOc0Y05AVcwyt6_yeJoyJVEg.PNG/1%EB%93%B1.png",
    chraksil_snowbros_2:
      "https://nng-phinf.pstatic.net/MjAyNTExMDdfMTgg/MDAxNzYyNTA5MDk2Nzcw.ShEg68UNdcykxIEakEocMWTd96rqcIg4j2yyBiILPOgg.H5ZXJzQj-z7rDN-nJcz-zLIi0F4qW38IAxhwKnVwaLwg.PNG/2%EB%93%B1.png",
    chraksil_snowbros_3:
      "https://nng-phinf.pstatic.net/MjAyNTExMDdfNDMg/MDAxNzYyNTA5MTE2NzM5.R_vXQmdOQi7y9EhwzpcDOqAUvPAxN_QW4i0GeuVyc_cg.KNvJEnrCaUnb6EFERedTu42wbZEUQoQnvmy-0_Sq-pAg.PNG/3%EB%93%B1.png",
    chraksil_snowbros_4:
      "https://nng-phinf.pstatic.net/MjAyNTExMDdfMTU1/MDAxNzYyNTA5MTQyNDI2.4RF6Z72g7l3QAEvI1T7DR_qFhuSDbjE3GAjdD_4OSM4g.s97HxPGhxDoKIYyhYt6zu_Kidct79-Y0mRY8hNXLvuMg.PNG/4%EB%93%B1-10%EB%93%B1.png",
    chraksil_snowbros_5:
      "https://nng-phinf.pstatic.net/MjAyNTExMDdfODMg/MDAxNzYyNTA5MTg0NDM0.kGhGOxxutQBbG686OlWm4PouUj14U9e8TwmbkiiSiuYg.FkLaSf7uWY9siO1MxJ098sPGH725VOpFfEpqf2agijog.PNG/%EC%B0%B8%EA%B0%80%EC%83%81.png",
    chraksil_pacman_1_128:
      "https://nng-phinf.pstatic.net/MjAyNTAyMTNfMTM0/MDAxNzM5NDU4NjQxMzIw.i6wn8EZPCETxBA8BZJ1trQoCkFYcsUFSNsoz5ixOH1cg.TD3kefULabiF92ii7r2NdqZr2AbCuAEIHMbcgRoNCa8g.PNG/chraksil_pacman_1_128.png",
    chraksil_pacman_2_128:
      "https://nng-phinf.pstatic.net/MjAyNTAyMTNfMjk1/MDAxNzM5NDU4NzU1ODIw.VQ3Bv3KKu7sRIwskRJstz5ibpNAgDKrY0Ex6hn7j7N8g.w3SXOkyJt6VDz9PK7ln2Qg8JnBh-r79lSd817wBBruMg.PNG/chraksil_pacman_2_128.png",
    chraksil_pacman_3_128:
      "https://nng-phinf.pstatic.net/MjAyNTAyMTRfODUg/MDAxNzM5NDU4ODMyNzIz.YIIBQ5WfjLW6MQRgFwKnBd_mRiuLdSL7LprSEhfk5awg.T8ViM2p0EGgp3WHDAMLegPf66etjLUqm4-QNJUh70R0g.PNG/chraksil_pacman_3_128.png",
    chraksil_pacman_4_128:
      "https://nng-phinf.pstatic.net/MjAyNTAyMTRfMTM5/MDAxNzM5NDU4ODc5NDcx.SLyfXq52ne1bQWC3Q_sOT3Iy8wMswkeRvBPsEOlY5z8g.Tlj3EAxaKXGbYoMw-EBq6XgczMTgN5UceH_vNNVe_9og.PNG/chraksil_pacman_4_128.png",
    chraksil_pacman_5_128:
      "https://nng-phinf.pstatic.net/MjAyNTAyMTRfMTI5/MDAxNzM5NDU4OTc0OTY1.0C_uz2pQWiXXY-KYhrb8BMA5dx6sV5W1PIvma7mDyiYg.65ed25-goXCeZCi06wUlSENrC9QmKeM-Rabi2neWuv8g.PNG/chraksil_pacman_5_128.png",
    chraksil_tengai_1_128:
      "https://nng-phinf.pstatic.net/MjAyNTA3MDRfNTMg/MDAxNzUxNjIxNjMyOTk0.MrNhd7e6Gqnbh5bWL5t7Gma3q8blc0q31Df7bdZ7Ra0g.rN5VoZPCg-xdMi0PZV6B_Q_RF_UhsLWkt2w83rgvl5Ig.PNG/%ED%85%90%EA%B0%80%EC%9D%B4_1%EB%93%B1_128px.png",
    chraksil_tengai_2_128:
      "https://nng-phinf.pstatic.net/MjAyNTA3MDRfMTUg/MDAxNzUxNjIxNjgxNjc4.uQyCT3BJwSYOl2rf-9j88OAyiyJwXX8Gd3e15oLU-x8g.JjAesrBJVkWlvsGtUrcTTh4-XniEY6VocCdIR6q4nn4g.PNG/%ED%85%90%EA%B0%80%EC%9D%B4_2%EB%93%B1_128px.png",
    chraksil_tengai_3_128:
      "https://nng-phinf.pstatic.net/MjAyNTA3MDRfMzIg/MDAxNzUxNjIxNzEwODA0.EVqMa4g8ekgTMId_aCtf3GBbZ13z8q27Ku1qKw351sYg._vjZqxkCAi97oFs0_M7AvSD2JztPU8enhMlyGYcsWEcg.PNG/%ED%85%90%EA%B0%80%EC%9D%B4_3%EB%93%B1_128px.png",
    chraksil_tengai_4_128:
      "https://nng-phinf.pstatic.net/MjAyNTA3MDRfNyAg/MDAxNzUxNjIxNzY1MTU0.W6IT_o0OMLZ8qgf1xE7u_QZWdiho3ti3VJkapgaHw30g.Oq8UpqNYE1et7IVgIjsoBtCvyHkQ30IOTCj70oNOXH0g.PNG/%ED%85%90%EA%B0%80%EC%9D%B4_410%EB%93%B1_128px.png",
    chraksil_tengai_5_128:
      "https://nng-phinf.pstatic.net/MjAyNTA3MDRfMjc4/MDAxNzUxNjIxNzk1NjUz.3qqlqb86KvS1bIletC1eMjZ67teJjse-AiVFleZvvWIg.zoiwYobtKUygxwxSewrt4Nn3W-R29uu7LAyM0mBNcaog.PNG/%ED%85%90%EA%B0%80%EC%9D%B4_%EC%B0%B8%EA%B0%80%EC%83%81_128px.png",
  };

  const DEFAULT_POPUP_HEIGHT = 300;
  const MIN_POPUP_HEIGHT = 120;
  const MAX_KEEP_ENTRIES = 500;
  const MAX_TRACKED_NICKNAMES_PER_SCOPE = 200;
  const OPEN_ANIMATION_MS = 320;
  const CLOSE_ANIMATION_MS = 280;
  const PILL_CYCLE_INTERVAL_MS = 2400;
  const PILL_ATTENTION_DURATION_MS = 1400;
  const PILL_ROLE_CLASS_PREFIX = "is-role-";
  const PILL_ROLE_CLASSES = [
    `${PILL_ROLE_CLASS_PREFIX}manager`,
    `${PILL_ROLE_CLASS_PREFIX}partner`,
    `${PILL_ROLE_CLASS_PREFIX}channel_owner`,
    `${PILL_ROLE_CLASS_PREFIX}operator`,
  ];
  const SETTINGS_ROLE_BADGE_TYPES = new Set([
    "channel_owner",
    "manager",
    "operator",
    "partner",
  ]);
  const DEFAULT_POPUP_FONT_SCALE = 1;
  const MIN_POPUP_FONT_SCALE = 0.8;
  const MAX_POPUP_FONT_SCALE = 1.2;
  const DEFAULT_CHAT_FONT_SCALE = 1;
  const MIN_CHAT_FONT_SCALE = 0.8;
  const MAX_CHAT_FONT_SCALE = 1.2;
  // 새 치지직 채팅 항목 후보 셀렉터: 클래스명이 빌드마다 바뀌므로 넓게
  // [class*='_item_']로 후보를 모으고, 정밀 판별은 matchesChatItem(JS)에서
  // 한다(:has 의존을 피해 호환성/안정성 확보).
  const NEW_CHAT_ITEM_SELECTOR = "[class*='_item_']";
  const LIVE_CHAT_LIST_CONTAINER_SELECTORS = [
    "aside#aside-chatting [class*='live_chatting_list_container']",
    "[class*='live_chatting_list_container']",
    "aside#aside-chatting [role='log']",
    "aside#aside-chatting [class*='_list_']",
    "aside#aside-chatting",
  ];
  const VOD_CHAT_LIST_CONTAINER_SELECTORS = [
    "aside#aside-chatting [class*='vod_chatting_list_container']",
    "aside#aside-chatting [class*='vod_chatting_list']",
    "[class*='vod_chatting_list_container']",
    "[class*='vod_chatting_list']",
    "aside#vod-aside [role='log']",
    "aside#vod-aside [class*='_list_']",
    "aside#vod-aside",
  ];
  const LIVE_CHAT_ITEM_SELECTOR = `[class*='live_chatting_list_item'], ${NEW_CHAT_ITEM_SELECTOR}`;
  const VOD_CHAT_ITEM_SELECTOR = `[class*='vod_chatting_item'], ${NEW_CHAT_ITEM_SELECTOR}`;
  const CHAT_ITEM_SELECTOR = `[class*='live_chatting_list_item'], [class*='vod_chatting_item'], ${NEW_CHAT_ITEM_SELECTOR}`;

  ns.constants = {
    MESSAGE_MARK,
    INJECT_TRACKED_SYNC_TYPE,
    STORAGE_HEIGHT_KEY,
    STORAGE_HEIGHT_KEY_LIVE,
    STORAGE_HEIGHT_KEY_LIVE_WIDE,
    STORAGE_HEIGHT_KEY_VOD,
    STORAGE_HEIGHT_KEY_VOD_WIDE,
    STORAGE_HEIGHT_KEY_CHAT_POPUP,
    STORAGE_DISPLAY_STYLE_KEY,
    STORAGE_SETTINGS_KEY,
    STORAGE_CHANNEL_CACHE_PREFIX,
    STORAGE_SESSION_FALLBACK_PREFIX,
    OFFICIAL_MARK_URL,
    MANAGER_BADGE_FALLBACK_URL,
    CHANNEL_OWNER_BADGE_FALLBACK_URL,
    OWNER_BADGE_FALLBACK_URL,
    ACHIEVEMENT_BADGE_URL_MAP,
    DEFAULT_POPUP_HEIGHT,
    MIN_POPUP_HEIGHT,
    MAX_KEEP_ENTRIES,
    MAX_TRACKED_NICKNAMES_PER_SCOPE,
    OPEN_ANIMATION_MS,
    CLOSE_ANIMATION_MS,
    PILL_CYCLE_INTERVAL_MS,
    PILL_ATTENTION_DURATION_MS,
    PILL_ROLE_CLASS_PREFIX,
    PILL_ROLE_CLASSES,
    SETTINGS_ROLE_BADGE_TYPES,
    DEFAULT_POPUP_FONT_SCALE,
    MIN_POPUP_FONT_SCALE,
    MAX_POPUP_FONT_SCALE,
    DEFAULT_CHAT_FONT_SCALE,
    MIN_CHAT_FONT_SCALE,
    MAX_CHAT_FONT_SCALE,
    LIVE_CHAT_LIST_CONTAINER_SELECTORS,
    VOD_CHAT_LIST_CONTAINER_SELECTORS,
    LIVE_CHAT_ITEM_SELECTOR,
    VOD_CHAT_ITEM_SELECTOR,
    CHAT_ITEM_SELECTOR,
  };
})();
