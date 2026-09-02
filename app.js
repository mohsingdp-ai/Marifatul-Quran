(function () {
  "use strict";

  function getUiTheme() {
    var t = localStorage.getItem("ui_theme");
    return t === "light" ? "light" : "dark";
  }

  function setUiTheme(theme) {
    localStorage.setItem("ui_theme", theme === "light" ? "light" : "dark");
  }

  function applyUiTheme(theme) {
    var t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", t === "dark" ? "#062a2a" : "#0a3d3d");
    }
  }

  applyUiTheme(getUiTheme());

  const tbody = document.getElementById("ruku-tbody");
  const paraSelect = document.getElementById("para-select");

  /** The 30 paras by the words they open with, as they are known across South Asia. The
      Arabic is the mushaf's own spelling, lifted from the Uthmani text in verses.js. */
  var PARA_NAMES = [
    ["الٓمٓ", "Alif Lam Mim"], ["سَيَقُولُ", "Sayaqul"], ["تِلْكَ ٱلرُّسُلُ", "Tilka r-Rusul"],
    ["لَن تَنَالُوا۟", "Lan Tanalu"], ["وَٱلْمُحْصَنَٰتُ", "Wal Muhsanat"], ["لَّا يُحِبُّ ٱللَّهُ", "La Yuhibbullah"],
    ["وَإِذَا سَمِعُوا۟", "Wa Idha Sami'u"], ["وَلَوْ أَنَّنَا", "Wa Law Annana"], ["قَالَ ٱلْمَلَأُ", "Qalal Mala'"],
    ["وَٱعْلَمُوٓا۟", "Wa'lamu"], ["يَعْتَذِرُونَ", "Ya'tadhirun"], ["وَمَا مِن دَآبَّةٍۢ", "Wa Ma Min Dabbah"],
    ["وَمَآ أُبَرِّئُ", "Wa Ma Ubarri'u"], ["رُّبَمَا", "Rubama"], ["سُبْحَٰنَ ٱلَّذِىٓ", "Subhanalladhi"],
    ["قَالَ أَلَمْ", "Qala Alam"], ["ٱقْتَرَبَ لِلنَّاسِ", "Iqtaraba"], ["قَدْ أَفْلَحَ", "Qad Aflaha"],
    ["وَقَالَ ٱلَّذِينَ", "Wa Qalalladhina"], ["أَمَّنْ خَلَقَ", "Amman Khalaq"], ["ٱتْلُ مَآ أُوحِىَ", "Utlu Ma Uhiya"],
    ["وَمَن يَقْنُتْ", "Wa Man Yaqnut"], ["وَمَا لِىَ", "Wa Ma Liya"], ["فَمَنْ أَظْلَمُ", "Fa Man Azlam"],
    ["إِلَيْهِ يُرَدُّ", "Ilayhi Yuraddu"], ["حمٓ", "Ha Mim"], ["قَالَ فَمَا خَطْبُكُمْ", "Qala Fama Khatbukum"],
    ["قَدْ سَمِعَ ٱللَّهُ", "Qad Sami'allah"], ["تَبَٰرَكَ ٱلَّذِى", "Tabarakalladhi"], ["عَمَّ", "Amma"]
  ];

  /** Surah names as the mushaf index writes them, with their harakat; data.js carries the
      bare letters. Keyed by surah number. */
  var SURAH_NAMES_AR = {
    1: "ٱلْفَاتِحَة", 2: "ٱلْبَقَرَة", 3: "آلِ عِمْرَان", 4: "ٱلنِّسَاء", 5: "ٱلْمَائِدَة", 6: "ٱلْأَنْعَام",
    7: "ٱلْأَعْرَاف", 8: "ٱلْأَنْفَال", 9: "ٱلتَّوْبَة", 10: "يُونُس", 11: "هُود", 12: "يُوسُف",
    13: "ٱلرَّعْد", 14: "إِبْرَاهِيم", 15: "ٱلْحِجْر", 16: "ٱلنَّحْل", 17: "ٱلْإِسْرَاء", 18: "ٱلْكَهْف",
    19: "مَرْيَم", 20: "طه", 21: "ٱلْأَنْبِيَاء", 22: "ٱلْحَجّ", 23: "ٱلْمُؤْمِنُون", 24: "ٱلنُّور",
    25: "ٱلْفُرْقَان", 26: "ٱلشُّعَرَاء", 27: "ٱلنَّمْل", 28: "ٱلْقَصَص", 29: "ٱلْعَنكَبُوت", 30: "ٱلرُّوم",
    31: "لُقْمَان", 32: "ٱلسَّجْدَة", 33: "ٱلْأَحْزَاب", 34: "سَبَإ", 35: "فَاطِر", 36: "يس",
    37: "ٱلصَّافَّات", 38: "ص", 39: "ٱلزُّمَر", 40: "غَافِر", 41: "فُصِّلَت", 42: "ٱلشُّورَىٰ",
    43: "ٱلزُّخْرُف", 44: "ٱلدُّخَان", 45: "ٱلْجَاثِيَة", 46: "ٱلْأَحْقَاف", 47: "مُحَمَّد", 48: "ٱلْفَتْح",
    49: "ٱلْحُجُرَات", 50: "ق", 51: "ٱلذَّارِيَات", 52: "ٱلطُّور", 53: "ٱلنَّجْم", 54: "ٱلْقَمَر",
    55: "ٱلرَّحْمَٰن", 56: "ٱلْوَاقِعَة", 57: "ٱلْحَدِيد", 58: "ٱلْمُجَادَلَة", 59: "ٱلْحَشْر", 60: "ٱلْمُمْتَحَنَة",
    61: "ٱلصَّفّ", 62: "ٱلْجُمُعَة", 63: "ٱلْمُنَافِقُون", 64: "ٱلتَّغَابُن", 65: "ٱلطَّلَاق", 66: "ٱلتَّحْرِيم",
    67: "ٱلْمُلْك", 68: "ٱلْقَلَم", 69: "ٱلْحَاقَّة", 70: "ٱلْمَعَارِج", 71: "نُوح", 72: "ٱلْجِنّ",
    73: "ٱلْمُزَّمِّل", 74: "ٱلْمُدَّثِّر", 75: "ٱلْقِيَامَة", 76: "ٱلْإِنسَان", 77: "ٱلْمُرْسَلَات", 78: "ٱلنَّبَإ",
    79: "ٱلنَّازِعَات", 80: "عَبَسَ", 81: "ٱلتَّكْوِير", 82: "ٱلْإِنفِطَار", 83: "ٱلْمُطَفِّفِين", 84: "ٱلْإِنشِقَاق",
    85: "ٱلْبُرُوج", 86: "ٱلطَّارِق", 87: "ٱلْأَعْلَىٰ", 88: "ٱلْغَاشِيَة", 89: "ٱلْفَجْر", 90: "ٱلْبَلَد",
    91: "ٱلشَّمْس", 92: "ٱللَّيْل", 93: "ٱلضُّحَىٰ", 94: "ٱلشَّرْح", 95: "ٱلتِّين", 96: "ٱلْعَلَق",
    97: "ٱلْقَدْر", 98: "ٱلْبَيِّنَة", 99: "ٱلزَّلْزَلَة", 100: "ٱلْعَادِيَات", 101: "ٱلْقَارِعَة", 102: "ٱلتَّكَاثُر",
    103: "ٱلْعَصْر", 104: "ٱلْهُمَزَة", 105: "ٱلْفِيل", 106: "قُرَيْش", 107: "ٱلْمَاعُون", 108: "ٱلْكَوْثَر",
    109: "ٱلْكَافِرُون", 110: "ٱلنَّصْر", 111: "ٱلْمَسَد", 112: "ٱلْإِخْلَاص", 113: "ٱلْفَلَق", 114: "ٱلنَّاس"
  };

  function surahArabic(row) {
    return SURAH_NAMES_AR[row.surahNumber] || row.surahArabic;
  }

  function paraName(n) {
    return PARA_NAMES[Number(n) - 1] || ["", ""];
  }

  /** The stepper's face: "Para N" over the para's name. */
  function syncParaFace() {
    var num = document.getElementById("para-picker-num");
    var name = document.getElementById("para-picker-name");
    if (!num || !name) return;
    var n = paraSelect.value;
    num.textContent = "Para " + n;
    name.textContent = paraName(n)[0];
    name.title = paraName(n)[1];
  }

  // The native list shows the names too.
  Array.prototype.forEach.call(paraSelect.options, function (opt) {
    var nm = paraName(opt.value)[0];
    if (nm) opt.textContent = "Para " + opt.value + " \u00b7 " + nm;
  });
  const actionHeader = document.querySelector("#ruku-table thead th:last-child");
  /** Para that `tbody` currently reflects (fixes scroll restore when the dropdown changes). */
  var tableRenderedPara = paraSelect ? String(paraSelect.value) : "1";
  /** When opening `?para=&ruku=`, scroll to that ruku after the first table render. */
  var pendingRukuHighlightFromUrl = null;
  /** Para last written to the address bar, so the URL is only rewritten when it changes. */
  var paraInUrl = null;

  /**
   * Keep `?para=` in step with the dropdown, so a reload or a copied address lands on the
   * para being read. replaceState rather than push: changing para is not a navigation step,
   * and Back should still leave the app rather than walk the paras in reverse.
   *
   * `dropRuku` clears an inbound deep link's `ruku`, which named a row in the para just
   * left. The first sync passes false so a shared ?para=&ruku= link survives being opened.
   */
  function syncParaInUrl(dropRuku) {
    paraInUrl = String(paraSelect.value);
    if (!window.history || !history.replaceState) return;
    try {
      var u = new URL(window.location.href);
      u.searchParams.set("para", paraInUrl);
      if (dropRuku) u.searchParams.delete("ruku");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    } catch (err) {
      /* No history API: the app still works, the address bar just does not follow. */
    }
  }

  if (!tbody || typeof QURAN_DATA === "undefined") return;

  // Data from QURAN_DATA (no persistence, no editing)
  var data = JSON.parse(JSON.stringify(QURAN_DATA));
  var sessionBlobUrls = {};
  /** `globalIndex` -> true while a GitHub upload is in flight (survives table re-renders). */
  var pendingUploadByIndex = {};
  /** Playback snapshot kept when that ruku row is not in the table (e.g. after switching Para). */
  var stickyPlaybackResume = null;
  var escapeNode = document.createElement("div");
  var indexedData = buildParaIndex(data);
  var currentPlayingAudio = null;
  /** Ayat panels currently expanded, keyed "<para>|<rukuInPara>". Survives table re-renders. */
  var expandedAyat = {};
  /** Panel opened automatically by playback, so starting another track can close it again. */
  var autoOpenedAyatKey = null;
  var PLAYBACK_STORAGE_KEY = "mq_playback_v1";
  /** globalIndex -> { t: seconds } last heard position per recording */
  var POSITIONS_STORAGE_KEY = "mq_audio_positions_v1";
  var mqPlayback = {
    el: null,
    _listenersBound: false,
    activeGlobalIndex: null,
    alternateUrls: [],
    alternateIndex: 0,
    /** Plain URL of the active track, so a bad offline copy can fall back to the network. */
    networkUrl: null,
    /** URL whose offline-cache entry produced the current blob src, else null. */
    cachedFrom: null,
    /** Whether `networkUrl` has already been given its second chance for this track. */
    networkRetried: false
  };
  var persistPlaybackTimer = null;
  var mediaSessionKeepaliveTimer = null;

  // GitHub API config
  var GITHUB_OWNER = "mohsingdp-ai";
  var GITHUB_REPO = "Marifatul-Quran";
  var GITHUB_BRANCH = "v4";

  // Hover tooltip: show audio path

  function buildParaIndex(rows) {
    var index = {};
    rows.forEach(function (row, globalIndex) {
      if (!index[row.para]) index[row.para] = [];
      index[row.para].push({ row: row, globalIndex: globalIndex });
    });
    return index;
  }

  function getFilteredData() {
    var para = parseInt(paraSelect.value, 10);
    return indexedData[para] || [];
  }

  var ADMIN_PASSWORD = "484215";

  function getRole() {
    return localStorage.getItem("app_role") || "user";
  }

  function setRole(role) {
    localStorage.setItem("app_role", role);
  }

  function isAdmin() {
    return getRole() === "admin";
  }

  function getPlaybackMode() {
    var v = localStorage.getItem("playback_mode");
    return (v === "loop" || v === "next") ? v : "none";
  }
  function setPlaybackMode(val) {
    localStorage.setItem("playback_mode", val);
  }
  function getDefaultSpeed() {
    var v = parseFloat(localStorage.getItem("default_speed"));
    return isNaN(v) ? 1 : v;
  }
  function setDefaultSpeed(val) {
    localStorage.setItem("default_speed", String(val));
  }

  function getAudioVolume() {
    var v = parseFloat(localStorage.getItem("audio_volume"));
    if (isNaN(v) || v < 0) return 1;
    return Math.min(1, v);
  }

  function setAudioVolume(val) {
    var n = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(n)) n = 1;
    n = Math.max(0, Math.min(1, n));
    localStorage.setItem("audio_volume", String(n));
  }

  function applyVolumeToAllAudioElements() {
    var vol = getAudioVolume();
    tbody.querySelectorAll("audio").forEach(function (a) {
      a.volume = vol;
    });
    if (mqPlayback.el) mqPlayback.el.volume = vol;
  }

  function getPositionsMap() {
    try {
      return JSON.parse(localStorage.getItem(POSITIONS_STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function getSavedPositionForIndex(globalIndex) {
    var x = getPositionsMap()[String(globalIndex)];
    return x && typeof x.t === "number" && isFinite(x.t) ? x.t : null;
  }

  /** Mid-track positions only; near start/end removes the entry. */
  function savePositionForIndex(globalIndex, currentTime, duration) {
    if (globalIndex == null || !isFinite(currentTime)) return;
    var key = String(globalIndex);
    var map = getPositionsMap();
    var durOk = duration && isFinite(duration) && duration > 1;
    var nearEnd = durOk && currentTime >= duration - 0.85;
    if (nearEnd) {
      delete map[key];
    } else if (currentTime < 0.35) {
      if (durOk) delete map[key];
    } else {
      map[key] = { t: currentTime };
    }
    try {
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(map));
    } catch (e) { /* quota */ }
  }

  function clearSavedPositionForIndex(globalIndex) {
    if (globalIndex == null) return;
    var map = getPositionsMap();
    delete map[String(globalIndex)];
    try {
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(map));
    } catch (e) { /* ignore */ }
  }

  function applyStoredMapPosition(globalIndex, a) {
    var t = getSavedPositionForIndex(globalIndex);
    if (t == null || !a.duration || !isFinite(a.duration) || a.duration <= 0) return;
    var end = Math.max(0, a.duration - 0.4);
    var clamped = Math.min(Math.max(0, t), end);
    if (clamped < 0.35) return;
    a.currentTime = clamped;
  }

  function readPlaybackPersist() {
    try {
      var raw = localStorage.getItem(PLAYBACK_STORAGE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o.globalIndex == null) return null;
      var gi = parseInt(o.globalIndex, 10);
      if (isNaN(gi) || gi < 0 || gi >= data.length) return null;
      return {
        globalIndex: String(gi),
        currentTime: typeof o.currentTime === "number" ? o.currentTime : 0,
        wasPlaying: !!o.wasPlaying,
        playbackRate: typeof o.playbackRate === "number" ? o.playbackRate : 1
      };
    } catch (e) {
      return null;
    }
  }

  function clearPlaybackPersist() {
    try {
      localStorage.removeItem(PLAYBACK_STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  function savePlaybackPersist() {
    if (!mqPlayback.el || mqPlayback.activeGlobalIndex == null) return;
    var a = mqPlayback.el;
    var gi = mqPlayback.activeGlobalIndex;
    try {
      localStorage.setItem(PLAYBACK_STORAGE_KEY, JSON.stringify({
        globalIndex: gi,
        currentTime: a.currentTime,
        wasPlaying: !a.paused,
        playbackRate: a.playbackRate || 1
      }));
    } catch (e) { /* ignore */ }
    var dur = a.duration && isFinite(a.duration) ? a.duration : 0;
    savePositionForIndex(gi, a.currentTime, dur);
  }

  function schedulePersistPlayback() {
    if (persistPlaybackTimer) clearTimeout(persistPlaybackTimer);
    persistPlaybackTimer = setTimeout(savePlaybackPersist, 500);
  }

  function getShowOnlyRecordedPara() {
    var v = localStorage.getItem("show_only_recorded_para");
    return v === null ? true : v === "true";
  }

  function setShowOnlyRecordedPara(val) {
    localStorage.setItem("show_only_recorded_para", val ? "true" : "false");
  }

  function getShowOnlyRecordedRuku() {
    var v = localStorage.getItem("show_only_recorded_ruku");
    return v === null ? true : v === "true";
  }

  function setShowOnlyRecordedRuku(val) {
    localStorage.setItem("show_only_recorded_ruku", val ? "true" : "false");
  }

  function getValidatedRukus() {
    try { return JSON.parse(localStorage.getItem("validated_rukus") || "{}"); }
    catch (e) { return {}; }
  }
  /**
  * Keyed "<para>:<rukuInPara>", not by position in QURAN_DATA. A positional key silently
  * re-points every tick at a different ruku the next time a row is merged or inserted, and
  * a verification pass you cannot trust is worse than none. Numeric keys left by the old
  * scheme are ignored rather than converted: after the data reshaped they no longer say
  * what they used to, so carrying them over would assert checks nobody made.
  */
  function validationKey(row) {
    return String(row.para) + ":" + String(row.rukuInPara);
  }
  function isRukuValidated(row) {
    return !!getValidatedRukus()[validationKey(row)];
  }
  function setRukuValidated(row, val) {
    var v = getValidatedRukus();
    if (val) v[validationKey(row)] = true; else delete v[validationKey(row)];
    localStorage.setItem("validated_rukus", JSON.stringify(v));
  }

  /* ===================== Hifz (memorization) tracking ===================== */
  var HIFZ_STORAGE_KEY = "hifz_status";
  var hifzAllKeysCache = null;
  var hifzValidKeysCache = null;

  function getHifzEnabled() {
    return localStorage.getItem("hifz_enabled") !== "false";
  }
  function setHifzEnabled(on) {
    localStorage.setItem("hifz_enabled", on ? "true" : "false");
  }

  /** Whether the first-run guided walkthrough has already been shown. */
  function isGuideSeen() {
    return localStorage.getItem("guide_seen") === "true";
  }
  function setGuideSeen() {
    localStorage.setItem("guide_seen", "true");
  }
  function applyHifzEnabled(on) {
    document.documentElement.setAttribute("data-hifz", on ? "on" : "off");
    var io = document.getElementById("hifz-io-section");
    if (io) io.style.display = on ? "" : "none";
    var toggle = document.getElementById("hifz-enabled-toggle");
    if (toggle) toggle.checked = on;
    if (on) renderHifzMeter();
  }

  function getHifzMap() {
    try { return JSON.parse(localStorage.getItem(HIFZ_STORAGE_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveHifzMap(map) {
    localStorage.setItem(HIFZ_STORAGE_KEY, JSON.stringify(map));
  }
  function hifzAllKeys() {
    if (!hifzAllKeysCache) {
      hifzAllKeysCache = data.map(function (row) { return Hifz.keyFor(row.para, row.rukuInPara); });
    }
    return hifzAllKeysCache;
  }
  function hifzValidKeySet() {
    if (!hifzValidKeysCache) hifzValidKeysCache = new Set(hifzAllKeys());
    return hifzValidKeysCache;
  }
  function rukusForPara(para) {
    return (indexedData[para] || []).map(function (item) { return item.row.rukuInPara; });
  }

  /**
   * The ruku number to SHOW. Two numbers exist and they differ on most rows:
   * `rukuInPara` is a sequential position within the para and the key hifz progress,
   * verses.js and deep links are stored under, so it can never move. `bookRuku` is the
   * number the Marifatul Quran bookmark itself uses, restarting at R1 at each new surah —
   * that is the one a reader following the book recognises, so it is what we display.
   */
  function rukuDisplay(row) {
    return (row && (row.bookRuku || row.rukuInPara)) || "";
  }

  /**
   * A merged row states both rukus it covers, e.g. "(243–248)(249–252)". Left as one
   * unbreakable string that single value sets the Verses column width for every row in the
   * para, which pushed the table wider than the page and produced a horizontal scrollbar.
   * Offer a break between the groups while keeping each range intact, so the column is only
   * as wide as it needs to be.
   */
  function versesHtml(text, trailingHtml) {
    var parts = versesParts(text);
    return parts.map(function (g, i) {
      var last = i === parts.length - 1;
      return "<span class=\"verses-part\">" + escapeHtml(g) + (last ? (trailingHtml || "") : "") + "</span>";
    }).join("<span class=\"verses-sep\">\u00b7</span>");
  }

  /** "(1-30)(31-40)" -> ["1-30", "31-40"]; a plain range stays as one part. */
  function versesParts(text) {
    var groups = String(text).match(/\([^)]*\)/g);
    if (!groups) return [String(text)];
    return groups.map(function (g) { return g.replace(/^\(|\)$/g, ""); });
  }

  /** Verse ranges as prose: "1-30 · 31-40". */
  function versesText(text) {
    return versesParts(text).join(" \u00b7 ");
  }

  /**
   * Rukus that share one recording are merged in data.js (e.g. "R5" + "R6" -> "R5-R6"),
   * which renames their progress keys. Fold pre-merge keys onto their new home, otherwise a
   * user who had memorized them sees the progress vanish. Idempotent, so running every load
   * is fine; it only writes when something actually moved.
   */
  function migrateHifzKeys() {
    var map = getHifzMap();
    if (!Object.keys(map).length) return;
    var res = Hifz.migrateKeys(map, hifzValidKeySet());
    var norm = Hifz.normalizeMap(res.merged);
    if (res.migrated || norm.changed) saveHifzMap(norm.map);
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  /** Star on or off for a ruku. Persists and returns the new entry (or null). */
  function hifzSetMemorized(para, ruku, on) {
    var map = getHifzMap();
    var key = Hifz.keyFor(para, ruku);
    var next = Hifz.setMemorized(map[key], on, todayISO());
    if (next) map[key] = next; else delete map[key];
    saveHifzMap(map);
    return next;
  }

  /** One more full listen of a ruku. Persists and returns the new entry. */
  function hifzRecordPlay(para, ruku) {
    var map = getHifzMap();
    var key = Hifz.keyFor(para, ruku);
    map[key] = Hifz.recordPlay(map[key], todayISO());
    saveHifzMap(map);
    return map[key];
  }

  /* A check in a circle: hollow until the ruku is memorized, then filled. */
  var MEMORIZED_OFF_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.59 7.58L10 14.17l-3.59-3.58L5 12l5 5 8-8zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';
  var MEMORIZED_ON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
  var LISTENS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg>';

  /** Push an entry onto a card's memorized mark and listen count. */
  function paintHifzControls(wrap, entry) {
    var mark = wrap.querySelector(".hifz-mark");
    var playsEl = wrap.querySelector(".hifz-plays");
    var on = Hifz.isMemorized(entry);
    var n = Hifz.plays(entry);
    var label = Hifz.playsLabel(n);
    mark.innerHTML = on ? MEMORIZED_ON_SVG : MEMORIZED_OFF_SVG;
    mark.setAttribute("aria-pressed", on ? "true" : "false");
    mark.setAttribute("aria-label", on ? "Memorized. Tap to unmark." : "Not memorized. Tap to mark as memorized.");
    mark.title = on ? "Memorized" : "Mark as memorized";
    playsEl.hidden = !n;
    playsEl.querySelector(".hifz-plays-count").textContent = label;
    var listened = "Listened " + label + (n === 1 ? " time" : " times") + " in full";
    playsEl.setAttribute("aria-label", listened);
    playsEl.title = listened;
  }

  /** A check to mark a ruku memorized, and how many times its recording has been heard through. */
  function buildHifzControls(row) {
    var para = row.para, ruku = row.rukuInPara;
    var wrap = document.createElement("div");
    wrap.className = "hifz-controls";

    var mark = document.createElement("button");
    mark.type = "button";
    mark.className = "hifz-mark";

    var playsEl = document.createElement("span");
    playsEl.className = "hifz-plays";
    playsEl.innerHTML = LISTENS_SVG + '<span class="hifz-plays-count"></span>';

    wrap.appendChild(mark);
    wrap.appendChild(playsEl);
    paintHifzControls(wrap, getHifzMap()[Hifz.keyFor(para, ruku)]);

    mark.addEventListener("click", function () {
      var on = mark.getAttribute("aria-pressed") !== "true";
      paintHifzControls(wrap, hifzSetMemorized(para, ruku, on));
      renderHifzMeter();
    });

    return wrap;
  }

  /** A recording reached its end: one more listen for its ruku, on the card and the meter. */
  function countListen(gi) {
    if (gi == null || !data[gi] || !getHifzEnabled()) return;
    var row = data[gi];
    var entry = hifzRecordPlay(row.para, row.rukuInPara);
    var tr = tbody.querySelector('tr[data-global-index="' + gi + '"]');
    var wrap = tr && tr.querySelector(".hifz-controls");
    if (wrap) paintHifzControls(wrap, entry);
    renderHifzMeter();
  }

  function renderHifzMeter() {
    var meter = document.getElementById("hifz-meter");
    if (!meter) return;
    var para = parseInt(paraSelect.value, 10);
    var map = getHifzMap();
    var p = Hifz.computeParaProgress(map, para, rukusForPara(para));
    var overall = Hifz.computeOverall(map, hifzAllKeys());

    document.getElementById("hifz-meter-para").textContent =
      p.memorized + " of " + p.total + " rukus memorized";
    document.getElementById("hifz-meter-total").textContent =
      overall.memorized + " / " + overall.total + " overall";

    var pct = p.total ? Math.round((p.memorized / p.total) * 100) : 0;
    var fill = document.getElementById("hifz-meter-fill");
    fill.style.width = pct + "%";
    var bar = meter.querySelector(".hifz-meter-bar");
    if (bar) bar.setAttribute("aria-valuenow", String(pct));

    var counts = document.getElementById("hifz-meter-counts");
    counts.textContent = "";
    function addCount(kind, n, text) {
      if (!n) return;
      var span = document.createElement("span");
      span.className = "hifz-count";
      span.dataset.kind = kind;
      span.textContent = text;
      counts.appendChild(span);
    }
    addCount("listened", p.listened, p.listened + " of " + p.total + " listened in full");
  }

  function exportHifz() {
    var payload = Hifz.serialize(getHifzMap(), todayISO());
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "hifz-progress-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setHifzIoStatus("Exported " + Object.keys(getHifzMap()).length + " rukus.");
  }

  function importHifzFromFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (e) { setHifzIoStatus("Import failed: that file isn't valid JSON."); return; }
      var res = Hifz.parseAndMerge(getHifzMap(), parsed, hifzValidKeySet());
      saveHifzMap(res.merged);
      renderTable({ skipViewRestore: true });
      setHifzIoStatus("Imported " + res.imported + ", skipped " + res.skipped + " unknown.");
    };
    reader.onerror = function () { setHifzIoStatus("Import failed: couldn't read the file."); };
    reader.readAsText(file);
  }

  function resetHifz() {
    if (!window.confirm("Reset all memorization progress? This cannot be undone.")) return;
    localStorage.removeItem(HIFZ_STORAGE_KEY);
    renderTable({ skipViewRestore: true });
    setHifzIoStatus("Progress reset.");
  }

  function setHifzIoStatus(msg) {
    var el = document.getElementById("hifz-io-status");
    if (el) el.textContent = msg;
  }

  function hasGitHubToken() {
    return isAdmin() && !!getGitHubToken().trim();
  }

  function setActionColumnVisibility(show) {
    if (!actionHeader) return;
    actionHeader.style.display = show ? "" : "none";
  }

  function clearPlayingClass() {
    tbody.querySelectorAll("tr.playing, tr.audio-paused").forEach(function (tr) {
      tr.classList.remove("playing", "audio-paused");
    });
  }

  function normalizeAudioPath(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  /** Return alternate audio URLs (same path, .wav then .ogg) to try when the primary URL fails. */
  function getAudioUrlAlternates(src) {
    if (typeof src !== "string" || !src.trim()) return [];
    var base = src.replace(/\.(opus|ogg|wav)$/i, "");
    var ext = (src.match(/\.(opus|ogg|wav)$/i) || [])[1] || "";
    var others = ["wav", "ogg", "opus"].filter(function (e) { return e.toLowerCase() !== ext.toLowerCase(); });
    return others.map(function (e) { return base + "." + e; });
  }

  function getAudioSrc(row, globalIndex) {
    return sessionBlobUrls[globalIndex] || normalizeAudioPath(row.audioUrl);
  }

  var allParaOptions = null; // cached for iOS option.hidden fix

  /**
   * Resolves true when a saved offline copy of this URL is in the audio cache. Async — it
   * answers with a Promise, so it must be awaited, never dropped into a plain condition
   * where every call reads as truthy.
   */
  function audioFileExists(audioPath) {
    if (!audioPath) return false;
    var abs = resolveUrl(audioPath);
    return caches.open(AUDIO_CACHE).then(function (cache) {
      return cache.match(abs).then(function (cached) { return !!cached; });
    }).catch(function () { return false; });
  }

  /**
   * A failed load is usually transient (dropped request) or a stale offline copy, not a
   * genuinely missing file — so leave the user a way back instead of a dead-end label.
   */
  function buildAudioRetryBtn(globalIndex) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "audio-retry-btn";
    btn.textContent = "Retry";
    btn.title = "Clear the saved copy and load this recording again";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      btn.disabled = true;
      var row = data[globalIndex];
      var src = row ? getAudioSrc(row, globalIndex) : null;
      var urls = src ? [src].concat(getAudioUrlAlternates(src)) : [];
      Promise.all(urls.map(evictCachedAudio)).then(function () {
        renderTable({ skipViewRestore: false });
      });
    });
    return btn;
  }

  function showNoRecording(audioCell) {
    var span = document.createElement("span");
    span.className = "no-recording";
    span.textContent = "No recording";
    audioCell.appendChild(span);
  }

  /* ----------------------------------------------------------------- */
  /* Ayat panel — Arabic text of a ruku, revealed under its table row.  */
  /* Text lives in verses.js; rukus missing from it keep a plain cell.   */
  /* ----------------------------------------------------------------- */

  /** verses.js key for a ruku, e.g. "10|R1". */
  function ayatKeyFor(row) {
    return String(row.para) + "|" + String(row.rukuInPara);
  }

  function getRukuAyat(row) {
    if (typeof QURAN_VERSES === "undefined" || !row) return null;
    return QURAN_VERSES[ayatKeyFor(row)] || null;
  }

  function isAyatOpen(row) {
    return !!row && expandedAyat[ayatKeyFor(row)] === true;
  }

  function ayatPanelId(globalIndex) {
    return "ayat-panel-" + globalIndex;
  }

  function toArabicDigits(n) {
    var digits = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
    return String(n).replace(/\d/g, function (d) { return digits.charAt(Number(d)); });
  }

  function buildAyatRow(item) {
    var row = item.row;
    var entry = getRukuAyat(row);
    if (!entry) return null;

    var tr = document.createElement("tr");
    tr.className = "ayat-row";
    tr.dataset.ayatFor = item.globalIndex;
    tr.hidden = !isAyatOpen(row);

    var td = document.createElement("td");
    td.className = "ayat-cell";
    // Widest the table ever gets (7 columns, admin Action column included).
    td.colSpan = 7;

    var count = entry.ayahs.length;
    var html = "<div class=\"ayat-panel\" id=\"" + ayatPanelId(item.globalIndex) + "\">" +
      "<div class=\"ayat-head\">" +
        "<span class=\"ayat-head-surah\">" + escapeHtml(row.surah) + " \u00b7 " +
          row.surahNumber + ":" + escapeHtml(versesText(row.verses)) + "</span>" +
        "<span class=\"ayat-head-count\">" + count + (count === 1 ? " ayah" : " ayat") + "</span>" +
      "</div>";

    if (entry.showBasmala) {
      html += "<div class=\"ayat-basmala\" lang=\"ar\">\ufdfd</div>";
    }

    html += "<div class=\"ayat-body\" dir=\"rtl\" lang=\"ar\">";
    entry.ayahs.forEach(function (a) {
      html += "<p class=\"ayat-item\" data-ayah=\"" + a.n + "\">" + escapeHtml(a.text) +
        "<span class=\"ayat-num\">" + toArabicDigits(a.n) + "</span></p>";
    });
    html += "</div>";

    html += "</div>";

    td.innerHTML = html;
    tr.appendChild(td);
    return tr;
  }

  /** Push `expandedAyat` onto the rendered rows (visibility, aria, joined-card styling). */
  function syncAyatRows() {
    var ayatRows = tbody.querySelectorAll("tr.ayat-row[data-ayat-for]");
    for (var i = 0; i < ayatRows.length; i++) {
      var gi = ayatRows[i].dataset.ayatFor;
      var open = isAyatOpen(data[gi]);
      ayatRows[i].hidden = !open;
      var mainTr = tbody.querySelector('tr[data-global-index="' + gi + '"]');
      if (!mainTr) continue;
      mainTr.classList.toggle("has-ayat-open", open);
      var btn = mainTr.querySelector(".verses-toggle");
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  function toggleAyat(globalIndex) {
    var row = data[globalIndex];
    if (!getRukuAyat(row)) return;
    var key = ayatKeyFor(row);
    if (expandedAyat[key]) {
      delete expandedAyat[key];
      if (autoOpenedAyatKey === key) autoOpenedAyatKey = null;
    } else {
      expandedAyat[key] = true;
    }
    syncAyatRows();
  }

  /* ------------------------------------------------------------------ */
  /* Following the recitation: which ayah is being said right now.       */
  /* Times live in timings.js; a ruku missing from it behaves as before.  */
  /* ------------------------------------------------------------------ */

  /** timings.js entry for a ruku, or null while it has not been aligned. */
  function getRukuTimings(row) {
    if (typeof QURAN_TIMINGS === "undefined" || !row) return null;
    return QURAN_TIMINGS[ayatKeyFor(row)] || null;
  }

  /**
   * The ayah being recited at `t` seconds, or null before the first one arrives.
   *
   * An ayah holds until the next one starts rather than for some measured length, which is
   * also what covers the ayat the aligner could not place: the one before it stays lit while
   * the shaykh works through them, which is what he is doing. Before the first placed ayah
   * nothing is lit. The recording opens on course branding, and playback of that is left
   * exactly as it was, so there is nothing to point at until the recitation begins.
   */
  function recitingAyahAt(timings, t) {
    if (!timings || !timings.ayahs || !timings.ayahs.length) return null;
    var found = null;
    for (var i = 0; i < timings.ayahs.length; i++) {
      if (timings.ayahs[i][1] > t) break;
      found = timings.ayahs[i][0];
    }
    return found;
  }

  /** "<globalIndex>|<ayah>" currently lit, so the DOM is only touched when it changes. */
  var recitingKey = null;

  function clearReciting() {
    var lit = tbody.querySelectorAll(".ayat-item.is-reciting");
    for (var i = 0; i < lit.length; i++) lit[i].classList.remove("is-reciting");
    recitingKey = null;
  }

  /** Follow the recitation down the panel, but only while the reader is looking at it. */
  function keepRecitingInView(el) {
    var panel = el.closest ? el.closest(".ayat-panel") : null;
    if (!panel) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var box = panel.getBoundingClientRect();
    if (box.bottom < 0 || box.top > vh) return;   // panel is off screen: leave the page alone
    var r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= vh) return;     // already readable
    // The highlight itself honours prefers-reduced-motion in style.css; the scroll that
    // follows it has to agree, or the setting buys nothing.
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }

  function syncReciting(globalIndex, t) {
    var n = recitingAyahAt(getRukuTimings(data[globalIndex]), t);
    var key = n == null ? null : globalIndex + "|" + n;
    var panel = n == null ? null : document.getElementById(ayatPanelId(globalIndex));
    var el = panel && panel.querySelector(".ayat-item[data-ayah=\"" + n + "\"]");
    // Not merely "has the ayah changed?". renderTable() rebuilds the panel from scratch on
    // search, para navigation and the recorded-only toggle, and the new rows come back without
    // the class while `recitingKey` still matches -- so the ayah would go dark until the next
    // one began, which in these lectures can be a minute away. Re-apply whenever the element
    // that ought to be lit is not.
    if (key === recitingKey && (el == null || el.classList.contains("is-reciting"))) return;
    clearReciting();
    if (n == null) return;
    // Panel not rendered yet: leave the key unset so the next tick tries again rather than
    // recording a highlight that was never applied.
    if (!el) return;
    recitingKey = key;
    el.classList.add("is-reciting");
    keepRecitingInView(el);
  }

  /** Reveal the ayat of the track that just started, closing the one playback opened before it. */
  function revealAyatForTrack(globalIndex) {
    var row = data[globalIndex];
    var key = row ? ayatKeyFor(row) : null;
    // Close the previous auto-opened panel even when the new track has no ayat text yet.
    if (autoOpenedAyatKey && autoOpenedAyatKey !== key) {
      delete expandedAyat[autoOpenedAyatKey];
      autoOpenedAyatKey = null;
    }
    if (getRukuAyat(row)) {
      expandedAyat[key] = true;
      autoOpenedAyatKey = key;
    }
    syncAyatRows();
  }

  function buildRow(item, showActions, canUpload, playbackResume) {
    var row = item.row;
    var globalIndex = item.globalIndex;
    var tr = document.createElement("tr");
    tr.dataset.globalIndex = globalIndex;

    // Three lines: the surah in both scripts with its number, then para and ruku, then ayat.
    var surahLine =
      "<span class=\"card-arabic\" lang=\"ar\" dir=\"rtl\">" + escapeHtml(row.surahArabic) + "</span>" +
      "<span class=\"card-sep\">\u00b7</span>" +
      "<span class=\"card-surah\">" + escapeHtml(row.surah) + "</span>" +
      "<span class=\"card-sep\">\u00b7</span>" +
      "<span class=\"card-num\">" + escapeHtml(String(row.surahNumber)) + "</span>";
    // Two titles, one shown per width: the surah on a wide screen, "Para N · R1–R2" on a phone.
    var rukuTag = escapeHtml(String(rukuDisplay(row)).replace(/-/g, "\u2013"));
    var rukuLine =
      "<span class=\"ruku-title-wide\">" + escapeHtml(row.surah) + " <span class=\"col-ruku-tag\">" + rukuTag + "</span></span>" +
      "<span class=\"ruku-title-narrow\">Para " + row.para + " \u00b7 " + rukuTag + "</span>";
    // Number and name as two spans, so the phone can put the name first: "النبأ · 78".
    var surahArabicCell =
      "<span class=\"surah-num\">" + escapeHtml(String(row.surahNumber)) + "</span>" +
      "<span class=\"surah-ar\" lang=\"ar\">" + escapeHtml(surahArabic(row)) + "</span>";
    var audioSrc = getAudioSrc(row, globalIndex);
    var hasAyat = !!getRukuAyat(row);
    var ayahLabel = "<span class=\"verses-label\">Ayah</span>";
    var versesCell = hasAyat
      ? "<button type=\"button\" class=\"verses-toggle\" aria-expanded=\"" + (isAyatOpen(row) ? "true" : "false") +
        "\" aria-controls=\"" + ayatPanelId(globalIndex) + "\" title=\"Show the ayat of this ruku\">" +
        AYAT_BOOK_SVG + ayahLabel + versesHtml(row.verses, AYAT_CHEVRON_SVG) + "</button>"
      : "<span class=\"verses-plain\">" + ayahLabel + versesHtml(row.verses) + "</span>";

    if (hasAyat && isAyatOpen(row)) tr.classList.add("has-ayat-open");

    tr.innerHTML =
      "<td class=\"col-hifz hifz-cell\" data-label=\"Hifz\"></td>" +
      "<td class=\"col-ruku\" data-label=\"Ruku #\">" + rukuLine + "</td>" +
      "<td class=\"col-surah\" data-label=\"Surah\">" + surahLine + "</td>" +
      "<td class=\"col-verses\" data-label=\"Verses\">" + versesCell + "</td>" +
      "<td class=\"col-surah-arabic\" data-label=\"Arabic\">" + surahArabicCell + "</td>" +
      "<td class=\"col-audio audio-cell\" data-label=\"Audio\"></td>" +
      (showActions ? "<td class=\"action-cell\" data-label=\"Action\"></td>" : "");

    var hifzCell = tr.querySelector(".hifz-cell");
    if (hifzCell) hifzCell.appendChild(buildHifzControls(row));

    var audioCell = tr.querySelector(".audio-cell");
    var actionCell = showActions ? tr.querySelector(".action-cell") : null;

    // Any row with a source gets a player; an offline copy is not a precondition for one,
    // and getAudioSrc already prefers this session's blob when there is one.
    if (audioSrc) {
      var resumeThis = playbackResume && String(playbackResume.globalIndex) === String(globalIndex) ? playbackResume : null;
      buildAudioPlayer(tr, audioCell, row, globalIndex, audioSrc, clearPlayingClass, resumeThis);
    } else {
      showNoRecording(audioCell);
    }

    if (actionCell) {
      if (canUpload) buildUploadButton(actionCell, row, globalIndex);
      buildValidateControl(actionCell, row);
    }

    return tr;
  }

  function hasRecording(item) {
    if (sessionBlobUrls[item.globalIndex]) return true;
    var audioSrc = getAudioSrc(item.row, item.globalIndex);
    return !!audioSrc;
  }

  /** Snapshot active (or paused mid-track) audio before tbody is replaced. */
  function capturePlaybackResumeState() {
    var a = mqPlayback.el;
    var gi = mqPlayback.activeGlobalIndex;
    if (a && gi != null) {
      if (a.paused && a.currentTime < 0.05) return null;
      return {
        globalIndex: String(gi),
        currentTime: a.currentTime,
        wasPlaying: !a.paused,
        playbackRate: a.playbackRate || 1
      };
    }
    return null;
  }

  /** @param {string|undefined} scrollBasePara If set, `tbody` still shows this para (e.g. before a select change). */
  function saveTableViewState(scrollBasePara) {
    var wrap = document.querySelector(".table-wrapper");
    if (!wrap) return null;
    var state = {
      para: scrollBasePara != null ? String(scrollBasePara) : String(paraSelect.value),
      filterPara: getShowOnlyRecordedPara(),
      filterRuku: getShowOnlyRecordedRuku(),
      scrollTop: wrap.scrollTop
    };
    var rows = tbody.querySelectorAll("tr[data-global-index]");
    if (!rows.length) return state;
    var wrapRect = wrap.getBoundingClientRect();
    for (var i = 0; i < rows.length; i++) {
      var rect = rows[i].getBoundingClientRect();
      if (rect.bottom > wrapRect.top + 1) {
        state.anchorGlobalIndex = rows[i].dataset.globalIndex;
        state.anchorOffset = rect.top - wrapRect.top;
        break;
      }
    }
    return state;
  }

  function restoreTableViewState(state) {
    if (!state) return;
    if (state.para !== paraSelect.value) return;
    if (state.filterPara !== getShowOnlyRecordedPara()) return;
    if (state.filterRuku !== getShowOnlyRecordedRuku()) return;
    var wrap = document.querySelector(".table-wrapper");
    if (!wrap) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (state.anchorGlobalIndex != null) {
          var tr = tbody.querySelector('tr[data-global-index="' + state.anchorGlobalIndex + '"]');
          if (tr) {
            var wrapRect = wrap.getBoundingClientRect();
            var rect = tr.getBoundingClientRect();
            wrap.scrollTop += rect.top - wrapRect.top - state.anchorOffset;
            return;
          }
        }
        var maxScroll = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
        wrap.scrollTop = Math.max(0, Math.min(state.scrollTop, maxScroll));
      });
    });
  }

  function scrollTableToRukuRow(paraNum, rukuLabel) {
    if (rukuLabel == null || String(rukuLabel).trim() === "") return;
    var items = indexedData[paraNum] || [];
    var foundGi = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].row.rukuInPara === rukuLabel) {
        foundGi = items[i].globalIndex;
        break;
      }
    }
    if (foundGi == null) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var tr = tbody.querySelector('tr[data-global-index="' + foundGi + '"]');
        if (!tr) return;
        tr.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
  }

  function updateParaSelect() {
    var filterPara = getShowOnlyRecordedPara();

    // Cache all options once (iOS Safari doesn't support option.hidden, so we remove/re-add from DOM)
    if (!allParaOptions) {
      allParaOptions = Array.from(paraSelect.options);
    }

    var currentValue = paraSelect.value;

    // Remove all options from select
    while (paraSelect.options.length > 0) paraSelect.remove(0);

    // Re-add only the ones that should be visible
    allParaOptions.forEach(function (opt) {
      var show = true;
      var para = parseInt(opt.value, 10);
      if (filterPara) {
        var items = indexedData[para] || [];
        show = items.some(hasRecording);
      }
      if (show) paraSelect.appendChild(opt);
    });

    // When fetch failed or filter removed every option (e.g. on mobile), show all paras so the app is usable
    if (paraSelect.options.length === 0 && allParaOptions.length) {
      allParaOptions.forEach(function (opt) { paraSelect.appendChild(opt); });
    }

    // Restore previous selection if still present, else pick first
    if (paraSelect.querySelector('option[value="' + currentValue + '"]')) {
      paraSelect.value = currentValue;
    } else if (paraSelect.options.length > 0) {
      paraSelect.value = paraSelect.options[0].value;
    }
  }

  /**
   * @param {{ skipViewRestore?: boolean, scrollBasePara?: string }} [options]
   *   skipViewRestore — filters/list changed in a way that invalidates scroll (e.g. para/ruku toggles).
   *   scrollBasePara — para the old `tbody` was built for when `para-select` has already changed.
   */
  function renderTable(options) {
    options = options || {};
    var viewState = options.skipViewRestore ? null : saveTableViewState(options.scrollBasePara);
    var snap = capturePlaybackResumeState();
    if (!snap) snap = readPlaybackPersist();
    if (snap) stickyPlaybackResume = snap;
    else stickyPlaybackResume = null;
    var canUpload = hasGitHubToken();
    var showActions = isAdmin();
    var filterRuku = getShowOnlyRecordedRuku();

    // Update para select first so any para jump happens before getFilteredData reads the value
    updateParaSelect();

    var filtered = getFilteredData();

    if (filterRuku) {
      filtered = filtered.filter(hasRecording);
    }

    var resumeIndex = stickyPlaybackResume ? stickyPlaybackResume.globalIndex : null;
    var willResume = resumeIndex != null && filtered.some(function (item) {
      return String(item.globalIndex) === String(resumeIndex);
    });

    var fragment = document.createDocumentFragment();
    tbody.textContent = "";
    setActionColumnVisibility(showActions);

    filtered.forEach(function (item, i) {
      var rowResume = stickyPlaybackResume && String(stickyPlaybackResume.globalIndex) === String(item.globalIndex)
        ? stickyPlaybackResume
        : null;
      var tr = buildRow(item, showActions, canUpload, rowResume);
      // Ayat rows sit between track rows, so zebra striping is by class rather than :nth-child.
      tr.classList.add(i % 2 === 0 ? "row-odd" : "row-even");
      fragment.appendChild(tr);
      var ayatTr = buildAyatRow(item);
      if (ayatTr) fragment.appendChild(ayatTr);
    });

    if (filtered.length === 0) {
      var emptyTr = document.createElement("tr");
      emptyTr.innerHTML = "<td colspan=\"7\" class=\"table-empty\">No recordings in this Para</td>";
      fragment.appendChild(emptyTr);
    }

    tbody.appendChild(fragment);
    restoreTableViewState(viewState);
    tableRenderedPara = String(paraSelect.value);
    syncParaFace();
    if (paraInUrl !== null && paraInUrl !== tableRenderedPara) syncParaInUrl(true);
    syncParaStepButtons();
    if (!willResume) {
      var a = mqPlayback.el;
      var gi = mqPlayback.activeGlobalIndex;
      var keepsContext = a && gi != null && (!a.paused || (a.currentTime > 0.05 && isFinite(a.currentTime)));
      if (keepsContext && data[gi]) {
        syncToolbarNowPlaying(data[gi], a.paused ? "paused" : "playing");
        syncToolbarTransport();
        updatePersistentMediaNotification();
      } else {
        syncToolbarNowPlaying(null, "idle");
        syncToolbarTransport();
      }
    } else {
      syncToolbarTransport();
    }
    renderHifzMeter();
  }

  function buildAudioPlayer(tr, audioCell, row, globalIndex, src, clearPlayingFn, playbackResume) {
    function ensureAudioElement() {
      return getMqAudioEl();
    }

    var wrap = document.createElement("div");
    wrap.className = "audio-controls";

    var playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "audio-play-btn";
    playBtn.setAttribute("aria-label", "Play");
    playBtn.innerHTML = PLAY_SVG;

    var timeCurrent = document.createElement("span");
    timeCurrent.className = "audio-time audio-time-current";
    timeCurrent.textContent = "0:00";

    var progressWrap = document.createElement("div");
    progressWrap.className = "audio-progress-wrap";
    var progress = document.createElement("input");
    progress.type = "range";
    progress.className = "audio-progress";
    progress.min = 0;
    progress.max = 100;
    progress.value = 0;
    progress.setAttribute("aria-label", "Seek");
    progress.style.pointerEvents = "none";

    var progressOverlay = document.createElement("div");
    progressOverlay.className = "audio-progress-overlay";

    var hoverTime = document.createElement("span");
    hoverTime.className = "audio-hover-time";
    hoverTime.setAttribute("aria-hidden", "true");

    var timeDuration = document.createElement("span");
    timeDuration.className = "audio-time audio-time-duration";
    timeDuration.textContent = "0:00";

    var speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];
    var defaultSpeed = getDefaultSpeed();
    var currentSpeedIndex = speeds.indexOf(defaultSpeed);
    if (currentSpeedIndex === -1) currentSpeedIndex = 1;

    var speedBtn = document.createElement("button");
    speedBtn.type = "button";
    speedBtn.className = "audio-speed-btn";
    speedBtn.textContent = speeds[currentSpeedIndex] + "x";
    speedBtn.setAttribute("aria-label", "Playback speed");

    speedBtn.addEventListener("click", function () {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      var speed = speeds[currentSpeedIndex];
      speedBtn.textContent = speed + "x";
      if (mqPlayback.activeGlobalIndex === globalIndex && mqPlayback.el) {
        mqPlayback.el.playbackRate = speed;
      }
    });

    var seekBackBtn = document.createElement("button");
    seekBackBtn.type = "button";
    seekBackBtn.className = "audio-seek-btn audio-seek-back-btn";
    seekBackBtn.innerHTML = SEEK_BACK_SVG;
    seekBackBtn.setAttribute("aria-label", "Seek back 5 seconds");

    seekBackBtn.addEventListener("click", function () {
      prepareMqTrack(globalIndex, row, src).then(function () {
        var a = mqPlayback.el;
        if (a) a.currentTime = Math.max(0, a.currentTime - 5);
      });
    });

    var seekFwdBtn = document.createElement("button");
    seekFwdBtn.type = "button";
    seekFwdBtn.className = "audio-seek-btn audio-seek-fwd-btn";
    seekFwdBtn.innerHTML = SEEK_FWD_SVG;
    seekFwdBtn.setAttribute("aria-label", "Seek forward 5 seconds");

    seekFwdBtn.addEventListener("click", function () {
      prepareMqTrack(globalIndex, row, src).then(function () {
        var a = mqPlayback.el;
        if (a) a.currentTime = Math.min(a.duration || a.currentTime, a.currentTime + 5);
      });
    });

    // The card puts play, share and download on the header line and keeps `wrap` for the
    // transport, which only the playing row shows. They are siblings in the cell so the
    // row's grid can place each one; see "Ruku card" in style.css.
    audioCell.appendChild(playBtn);
    wrap.appendChild(seekBackBtn);
    wrap.appendChild(seekFwdBtn);
    wrap.appendChild(timeCurrent);
    progressWrap.appendChild(progress);
    progressWrap.appendChild(progressOverlay);
    progressWrap.appendChild(hoverTime);
    wrap.appendChild(progressWrap);
    wrap.appendChild(timeDuration);
    wrap.appendChild(speedBtn);

    playBtn.addEventListener("click", function () {
      var a = ensureAudioElement();
      if (mqPlayback.activeGlobalIndex === globalIndex && a && !a.paused) {
        a.pause();
        return;
      }
      prepareMqTrack(globalIndex, row, src).then(function () {
        var mqA = mqPlayback.el;
        mqA.playbackRate = speeds[currentSpeedIndex];
        mqA.loop = false;
        mqA.play();
      });
    });

    function getClientX(e) {
      if (e.touches && e.touches.length) return e.touches[0].clientX;
      if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
      return e.clientX;
    }
    function pctFromEvent(e) {
      var rect = progressOverlay.getBoundingClientRect();
      var x = getClientX(e);
      return Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
    }
    function seekToPct(pct) {
      progress.value = pct;
      progress.style.setProperty("--progress", pct + "%");
      prepareMqTrack(globalIndex, row, src).then(function () {
        var a = mqPlayback.el;
        if (a && a.duration && isFinite(a.duration)) {
          a.currentTime = (pct / 100) * a.duration;
        }
      });
    }

    var seeking = false;
    progressOverlay.addEventListener("mousemove", function (e) {
      var pct = pctFromEvent(e);
      var a = mqPlayback.el;
      if (mqPlayback.activeGlobalIndex === globalIndex && a && a.duration && isFinite(a.duration)) {
        var sec = (pct / 100) * a.duration;
        hoverTime.textContent = formatTime(sec) + " / " + formatTime(a.duration);
        hoverTime.style.left = pct + "%";
        hoverTime.classList.add("is-visible");
        if (seeking) seekToPct(pct);
      }
    });
    progressOverlay.addEventListener("mouseleave", function () {
      hoverTime.classList.remove("is-visible");
      seeking = false;
    });
    progressOverlay.addEventListener("mousedown", function (e) {
      e.preventDefault();
      seeking = true;
      seekToPct(pctFromEvent(e));
      window.addEventListener("mouseup", stopSeeking, { once: true });
    });
    progressOverlay.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      seekToPct(pctFromEvent(e));
    });
    function stopSeeking() {
      seeking = false;
    }

    /* Touch support for progress bar (mobile) —
       Wait for horizontal movement before seeking so vertical scrolls aren't hijacked. */
    var touchStartX = null;
    var touchStartY = null;
    var touchLocked = false; // true once we decide seek vs scroll
    progressOverlay.addEventListener("touchstart", function (e) {
      touchStartX = getClientX(e);
      touchStartY = e.touches[0].clientY;
      touchLocked = false;
      seeking = false;
    }, { passive: true });
    progressOverlay.addEventListener("touchmove", function (e) {
      if (touchStartX === null) return;
      if (!touchLocked) {
        var dx = Math.abs(getClientX(e) - touchStartX);
        var dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dy > 8 && dy > dx) {
          // vertical scroll — bail out entirely
          touchStartX = null;
          return;
        }
        if (dx > 8) {
          touchLocked = true;
          seeking = true;
        } else {
          return; // not enough movement yet
        }
      }
      if (seeking && e.cancelable) e.preventDefault();
      var pct = pctFromEvent(e);
      seekToPct(pct);
      var a = mqPlayback.el;
      if (mqPlayback.activeGlobalIndex === globalIndex && a && a.duration && isFinite(a.duration)) {
        var sec = (pct / 100) * a.duration;
        hoverTime.textContent = formatTime(sec) + " / " + formatTime(a.duration);
        hoverTime.style.left = pct + "%";
        hoverTime.classList.add("is-visible");
      }
    }, { passive: false });
    progressOverlay.addEventListener("touchend", function (e) {
      // If locked to seek but barely moved, treat as a tap-to-seek
      if (touchStartX !== null && !touchLocked) {
        var dx = Math.abs(getClientX(e) - touchStartX);
        if (dx < 8) {
          seekToPct(pctFromEvent(e));
        }
      }
      seeking = false;
      touchStartX = null;
      touchLocked = false;
      hoverTime.classList.remove("is-visible");
    });
    progressOverlay.addEventListener("touchcancel", function () {
      seeking = false;
      touchStartX = null;
      touchLocked = false;
      hoverTime.classList.remove("is-visible");
    });

    var offlineBtn = buildOfflineBtn(src);
    audioCell.appendChild(buildWhatsAppShareBtn(row, src));
    audioCell.appendChild(offlineBtn);

    audioCell.appendChild(wrap);

    if (playbackResume) {
      (function () {
        var snap = playbackResume;
        var pr = snap.playbackRate || 1;
        var si = speeds.indexOf(pr);
        if (si === -1) {
          si = 0;
          var best = Infinity;
          for (var j = 0; j < speeds.length; j++) {
            var d = Math.abs(speeds[j] - pr);
            if (d < best) {
              best = d;
              si = j;
            }
          }
        }
        currentSpeedIndex = si;
        speedBtn.textContent = speeds[currentSpeedIndex] + "x";
        prepareMqTrack(globalIndex, row, src, { skipStoredPosition: true }).then(function () {
          var a = mqPlayback.el;
          a.playbackRate = speeds[currentSpeedIndex];
          var dur = a.duration && isFinite(a.duration) ? a.duration : 0;
          var t = snap.currentTime;
          if (dur > 0) t = Math.min(Math.max(0, t), Math.max(0, dur - 0.05));
          else t = Math.max(0, t);
          a.currentTime = t;
          savePositionForIndex(globalIndex, t, dur);
          if (dur > 0) {
            var pct = (t / dur) * 100;
            progress.value = pct;
            progress.style.setProperty("--progress", pct + "%");
            timeCurrent.textContent = formatTime(t);
            timeDuration.textContent = formatTime(dur);
            var toolbarFill = document.getElementById("toolbar-progress-fill");
            if (toolbarFill) toolbarFill.style.width = pct + "%";
          } else {
            timeCurrent.textContent = formatTime(t);
          }
          if (snap.wasPlaying) {
            a.play().catch(function () { /* autoplay policy */ });
            playBtn.innerHTML = PAUSE_SVG;
            playBtn.setAttribute("aria-label", "Pause");
            tr.classList.remove("audio-paused");
            tr.classList.add("playing");
            currentPlayingAudio = a;
            setNowPlayingMetadata(row, a);
            syncToolbarNowPlaying(row, "playing");
            setMediaPlaybackState("playing");
          } else {
            playBtn.innerHTML = PLAY_SVG;
            playBtn.setAttribute("aria-label", "Play");
            tr.classList.add("playing", "audio-paused");
            currentPlayingAudio = a;
            revealAyatForTrack(globalIndex);
            setNowPlayingMetadata(row, a);
            syncToolbarNowPlaying(row, "paused");
            setMediaPlaybackState("paused");
            if (dur > 0 && "mediaSession" in navigator && navigator.mediaSession.setPositionState) {
              try {
                navigator.mediaSession.setPositionState({
                  duration: dur,
                  playbackRate: a.playbackRate || 1,
                  position: t
                });
              } catch (e) { /* ignore */ }
            }
            startPausedMediaSessionKeepalive();
          }
          stickyPlaybackResume = null;
          syncToolbarTransport();
        });
      })();
    }
  }

  var AUDIO_CACHE = "mq-audio";
  var DOWNLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m12 16l-5-5l1.4-1.45l2.6 2.6V4h2v8.15l2.6-2.6L17 11zm-6 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20z"/></svg>';
  var WHATSAPP_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.04 2.005c-5.52 0-10 4.48-10 10.002 0 1.76.46 3.47 1.34 4.98L2.05 22l5.08-1.34c1.46.8 3.12 1.23 4.91 1.23 5.52 0 10-4.48 10-10.002 0-2.67-1.04-5.18-2.93-7.07a9.95 9.95 0 0 0-7.07-2.893zm.03 17.92c-1.5 0-2.97-.4-4.25-1.15l-.3-.18-3.18.84.85-3.11-.2-.31a7.764 7.764 0 0 1-1.2-4.12c0-4.28 3.47-7.75 7.75-7.75 2.07 0 4.02.81 5.48 2.28a7.684 7.684 0 0 1 2.25 5.47c-.01 4.28-3.48 7.76-7.75 7.76zm4.26-4.51c-.24-.12-1.43-.7-1.66-.78-.22-.08-.39-.12-.56.12-.17.24-.64.78-.79.94-.15.16-.3.18-.54.06-.24-.12-1.02-.37-1.95-1.2-.72-.64-1.2-1.43-1.34-1.67-.15-.24-.02-.37.11-.49.12-.12.24-.27.37-.4.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.53-1.26-.73-1.73-.19-.46-.39-.39-.53-.41h-.45c-.15 0-.4.06-.61.3-.21.24-.81.79-.81 1.92s.83 2.23.94 2.39c.12.16 1.62 2.48 3.93 3.48.55.23.98.37 1.31.47.55.18 1.05.16 1.44.09.44-.07 1.42-.58 1.62-1.14.21-.56.21-1.03.15-1.13-.06-.1-.22-.16-.46-.28z"/></svg>';
  var AYAT_BOOK_SVG = '<svg class="verses-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>';
  var AYAT_CHEVRON_SVG = '<svg class="verses-toggle-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  var PLAY_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14l11-7z"/></svg>';
  var PAUSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M14 19V5h4v14zm-8 0V5h4v14z"/></svg>';
  var SEEK_BACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6"/><path d="M2.5 8A10 10 0 1 1 4.4 17.5"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">-5</text></svg>';
  var SEEK_FWD_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.5 8A10 10 0 1 0 19.6 17.5"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">+5</text></svg>';

  function resolveUrl(url) {
    var a = document.createElement("a");
    a.href = url;
    return a.href;
  }

  /** Same folder as the main app; base URL for player.html deep links. */
  function getPlayerPageUrl() {
    var u = new URL("player.html", window.location.href);
    u.hash = "";
    return u.href.replace(/#$/, "");
  }

  /**
   * Stable share link: player.html?para=&ruku= — maps directly to the ruku row
   * (and its audioUrl). No tokens, so links never expire across data rebuilds.
   */
  function buildPlayerDeepLink(paraNum, row) {
    var u = new URL(getPlayerPageUrl());
    u.searchParams.set("para", String(paraNum));
    u.searchParams.set("ruku", row.rukuInPara);
    return u.href.replace(/#$/, "");
  }

  /** One ruku block: title line + stable ?para=&ruku= player URL. */
  function formatBulkRukuLinkBlock(paraNum, row) {
    var title =
      "P" + paraNum + ": " + rukuDisplay(row) + " — " + row.surah + " (" + row.verses + ")";
    return title + "\n" + buildPlayerDeepLink(paraNum, row);
  }

  /** Rows in this Para that have audio, for file+caption share (one ruku per share action). */
  function getParaRukuFileShareItems(paraNum) {
    var items = indexedData[paraNum] || [];
    var list = [];
    items.forEach(function (item) {
      var row = item.row;
      var src = getAudioSrc(row, item.globalIndex);
      if (!src) return;
      var title =
        "P" + row.para + ": " + rukuDisplay(row) + " — " + row.surah + " (" + row.verses + ")";
      var caption = title + "\n" + buildPlayerDeepLink(row.para, row);
      list.push({ row: row, src: src, caption: caption });
    });
    return list;
  }

  function isAudioCached(url) {
    var abs = resolveUrl(url);
    return caches.open(AUDIO_CACHE).then(function (cache) {
      return cache.match(abs).then(function (resp) { return !!resp; });
    }).catch(function () { return false; });
  }

  /** Smallest plausible recording; anything shorter is a truncated or error-page cache write. */
  var MIN_CACHED_AUDIO_BYTES = 1024;

  function getCachedAudioBlob(url) {
    var abs = resolveUrl(url);
    return caches.open(AUDIO_CACHE).then(function (cache) {
      return cache.match(abs).then(function (resp) {
        // A partial (206) or error response cached here would fail to decode forever,
        // leaving the row stuck on "Path Not found". Drop it and fall back to the network.
        if (!resp || resp.status !== 200) {
          return (resp ? cache.delete(abs) : Promise.resolve()).then(function () { return null; });
        }
        return resp.blob().then(function (blob) {
          if (!blob || blob.size < MIN_CACHED_AUDIO_BYTES) {
            return cache.delete(abs).then(function () { return null; });
          }
          return URL.createObjectURL(blob);
        });
      });
    }).catch(function () { return null; });
  }

  function evictCachedAudio(url) {
    if (!url) return Promise.resolve(false);
    var abs = resolveUrl(url);
    return caches.open(AUDIO_CACHE).then(function (cache) {
      return cache.delete(abs);
    }).catch(function () { return false; });
  }

  function cacheAudioFile(url) {
    var abs = resolveUrl(url);
    return caches.open(AUDIO_CACHE).then(function (cache) {
      return cache.match(abs).then(function (existing) {
        if (existing) return; // already cached, skip download
        return fetch(abs).then(function (resp) {
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          return cache.put(abs, resp);
        });
      });
    });
  }

  /** Load raw audio bytes for sharing (offline cache first, then network). */
  function fetchAudioBlobForShare(src) {
    if (!src || typeof src !== "string") return Promise.resolve(null);

    function getBlob(url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      });
    }

    if (src.indexOf("blob:") === 0) {
      return getBlob(src).catch(function () { return null; });
    }

    var urls = [src].concat(getAudioUrlAlternates(src)).map(resolveUrl);

    function tryIndex(i) {
      if (i >= urls.length) return Promise.resolve(null);
      var abs = urls[i];
      return caches.open(AUDIO_CACHE)
        .then(function (cache) { return cache.match(abs); })
        .then(function (resp) {
          if (resp) return resp.blob();
          return getBlob(abs);
        })
        .then(function (blob) {
          if (blob && blob.size) return blob;
          return tryIndex(i + 1);
        })
        .catch(function () { return tryIndex(i + 1); });
    }

    return tryIndex(0);
  }

  function recordingShareFilename(row, src) {
    var m = typeof src === "string" ? src.match(/\.(opus|ogg|wav)$/i) : null;
    var ext = m ? "." + m[1].toLowerCase() : ".ogg";
    return row.para + "__" + row.rukuInPara + "__" + row.surah + ext;
  }

  function audioMimeForShare(src) {
    var lower = (src || "").toLowerCase();
    if (lower.indexOf(".wav") >= 0) return "audio/wav";
    if (lower.indexOf(".opus") >= 0) return "audio/opus";
    return "audio/ogg";
  }

  function legacyCopyText(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    var copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (err) {
      copied = false;
    }

    document.body.removeChild(textarea);
    return copied;
  }

  function copyShareCaption(text) {
    if (!text) return Promise.resolve(false);

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function" && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return legacyCopyText(text);
      });
    }

    return Promise.resolve(legacyCopyText(text));
  }

  function markSaved(btn) {
    btn.classList.remove("is-saving");
    btn.classList.add("is-saved");
    btn.innerHTML = DOWNLOAD_SVG;
    btn.title = "Saved offline (tap to refresh)";
    btn.setAttribute("aria-label", "Saved offline (tap to refresh)");
  }

  function markUnsaved(btn) {
    btn.classList.remove("is-saving", "is-saved");
    btn.innerHTML = DOWNLOAD_SVG;
    btn.title = "Save for offline";
    btn.setAttribute("aria-label", "Save offline");
  }

  function buildOfflineBtn(src) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "audio-offline-btn";
    btn.innerHTML = DOWNLOAD_SVG;
    btn.setAttribute("aria-label", "Save offline");
    btn.title = "Save for offline";

    isAudioCached(src).then(function (cached) {
      if (cached) markSaved(btn);
    });

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (btn.classList.contains("is-saving")) return;

      if (!navigator.onLine) {
        if (btn.classList.contains("is-saved")) return;
        alert("No internet connection. Cannot save for offline.");
        return;
      }

      if (btn.classList.contains("is-saved")) {
        if (!confirm("Already saved offline. Re-download fresh copy?")) return;
      }

      btn.classList.add("is-saving");
      btn.innerHTML = DOWNLOAD_SVG;
      btn.title = "Saving…";

      var urls = [src].concat(getAudioUrlAlternates(src));
      var saved = false;

      (function tryNext(i) {
        if (i >= urls.length) {
          if (!saved) {
            markUnsaved(btn);
            alert("Could not save audio for offline use.");
          }
          return;
        }
        cacheAudioFile(urls[i]).then(function () {
          saved = true;
          markSaved(btn);
        }).catch(function () {
          tryNext(i + 1);
        });
      })(0);
    });

    return btn;
  }

  /**
   * Share one recording via Web Share API (audio file + text) or download fallback.
   * @returns {Promise<void>}
   */
  function shareAudioFileWithCaption(src, row, caption) {
    function tryDownloadFileFallback(blob) {
      var mime = blob.type && blob.type.indexOf("audio/") === 0 ? blob.type : audioMimeForShare(src);
      var name = recordingShareFilename(row, src);
      var objectUrl = URL.createObjectURL(new Blob([blob], { type: mime }));
      var a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 60000);
    }

    var captionCopied = false;

    return copyShareCaption(caption)
      .then(function (copied) {
        captionCopied = !!copied;
        return fetchAudioBlobForShare(src);
      })
      .then(function (blob) {
        if (!blob || !blob.size) {
          alert("Could not load the recording to share. Check your connection or save it offline first.");
          return;
        }

        var mime = blob.type && blob.type.indexOf("audio/") === 0 ? blob.type : audioMimeForShare(src);
        var file = new File([blob], recordingShareFilename(row, src), { type: mime });

        var canFileShare =
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });

        if (canFileShare) {
          return navigator
            .share({
              text: caption,
              files: [file]
            })
            .then(function () {
              if (captionCopied) {
                alert(
                  "Audio shared. If WhatsApp sends only the file, paste the copied caption in the chat."
                );
              }
            })
            .catch(function (err) {
              if (err && err.name === "AbortError") return;
              tryDownloadFileFallback(blob);
              alert(
                captionCopied
                  ? "Could not open share. The recording was downloaded. Attach it in WhatsApp and paste the copied caption."
                  : "Could not open share. The recording was downloaded—attach it in WhatsApp."
              );
            });
        }

        tryDownloadFileFallback(blob);
        alert(
          captionCopied
            ? "The recording was downloaded. Send it in WhatsApp as an attachment, then paste the copied caption."
            : "The recording was downloaded. Open WhatsApp and send it as an attachment (Downloads / Files)."
        );
      })
      .catch(function () {
        alert(
          captionCopied
            ? "Could not share this file. Try Save offline, then share from your device and paste the copied caption."
            : "Could not share this file. Try Save offline, then share from your device."
        );
      });
  }

  /** Combined caption for sharing every ruku in a Para in one share sheet. */
  function buildParaBatchShareCaption(paraNum, items) {
    var lines = [
      "Marifatul Quran — Para " + paraNum + " (" + items.length + " recordings)",
      ""
    ];
    items.forEach(function (it) {
      lines.push(
        "P" +
          it.row.para +
          ": " +
          rukuDisplay(it.row) +
          " — " +
          it.row.surah +
          " (" +
          it.row.verses +
          ")"
      );
    });
    return lines.join("\n");
  }

  /**
   * Share all Para recordings in one native share (multiple files + caption) when supported.
   * @returns {Promise<void>}
   */
  function shareAllParaRecordingsAsFiles(items, paraNum) {
    if (!items || !items.length) return Promise.resolve();

    var caption = buildParaBatchShareCaption(paraNum, items);

    return Promise.all(
      items.map(function (it) {
        return fetchAudioBlobForShare(it.src).then(function (blob) {
          if (!blob || !blob.size) {
            throw new Error(
              "Could not load " +
                rukuDisplay(it.row) +
                ". Save offline first or check your connection."
            );
          }
          var mime =
            blob.type && blob.type.indexOf("audio/") === 0 ? blob.type : audioMimeForShare(it.src);
          return new File([blob], recordingShareFilename(it.row, it.src), { type: mime });
        });
      })
    )
      .then(function (files) {
        var canMulti =
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: files });

        if (!canMulti) {
          alert(
            'This browser or app cannot share multiple files in one step. Use "Share this ruku" and "Next ruku" for each recording.'
          );
          return;
        }

        var captionCopied = false;
        return copyShareCaption(caption)
          .then(function (copied) {
            captionCopied = !!copied;
            return navigator.share({ text: caption, files: files });
          })
          .then(function () {
            if (captionCopied) {
              alert(
                "Shared " +
                  files.length +
                  " files. If the app only received attachments, paste the copied caption into the chat."
              );
            }
          })
          .catch(function (err) {
            if (err && err.name === "AbortError") return;
            alert(
              'Could not share all files at once. Try "Share this ruku" one at a time, or pick another app from the share sheet.'
            );
          });
      })
      .catch(function (e) {
        alert(e && e.message ? e.message : "Could not load all recordings for sharing.");
      });
  }

  function buildWhatsAppShareBtn(row, src) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "audio-share-wa-btn";
    btn.innerHTML = WHATSAPP_SVG;
    btn.setAttribute("aria-label", "Share audio file on WhatsApp");
    btn.title = "Share audio file on WhatsApp";

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (btn.disabled) return;

      btn.disabled = true;
      var caption = "P" + row.para + ": " + rukuDisplay(row) + " — " + row.surah + " (" + row.verses + ")";
      shareAudioFileWithCaption(src, row, caption).finally(function () {
        btn.disabled = false;
      });
    });

    return btn;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function escapeHtml(text) {
    escapeNode.textContent = text;
    return escapeNode.innerHTML;
  }

  /* ----------------------------------------------------------------- */
  /* Docked mini-player -- while a track is loaded and the card that owns  */
  /* it is out of view, the now-playing strip pins to the bottom of the   */
  /* viewport so playback stays controllable. While the card itself is on */
  /* screen the strip stays hidden: the card already shows everything the */
  /* strip would. Same element, same ids throughout, so every sync path   */
  /* keeps working.                                                       */
  /* ----------------------------------------------------------------- */
  var toolbarBottom = document.querySelector(".toolbar-bottom");
  /** The active track's card, as far as the observer is concerned. */
  var dockedRow = null;
  var dockedRowOffscreen = false;
  var dockObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(function (entries) {
        var entry = entries[entries.length - 1];
        if (entry.target !== dockedRow) return;
        dockedRowOffscreen = entry.intersectionRatio < 0.5;
        applyToolbarDock();
      }, { threshold: [0, 0.5, 1] })
    : null;

  function toolbarHasTrack() {
    var shell = document.getElementById("toolbar-now-playing");
    return !!shell && (shell.classList.contains("is-playing") || shell.classList.contains("is-paused"));
  }

  function applyToolbarDock() {
    if (!toolbarBottom) return;
    // No card to watch (the track belongs to another para): the bar is the only control left.
    var wantDocked = toolbarHasTrack() && (!dockedRow || dockedRowOffscreen);
    if (wantDocked === toolbarBottom.classList.contains("is-docked")) return;
    toolbarBottom.classList.toggle("is-docked", wantDocked);
    document.body.classList.toggle("has-docked-player", wantDocked);
  }

  /** Point the observer at the active track's card (rows are rebuilt on every render). */
  function syncToolbarDock() {
    var row = toolbarHasTrack() ? tbody.querySelector("tr.playing") : null;
    if (row !== dockedRow) {
      if (dockObserver) {
        if (dockedRow) dockObserver.unobserve(dockedRow);
        if (row) dockObserver.observe(row);
      }
      dockedRow = row;
      if (row) {
        var r = row.getBoundingClientRect();
        var visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        dockedRowOffscreen = visible < r.height * 0.5;
      } else {
        dockedRowOffscreen = true;
      }
    }
    applyToolbarDock();
  }

  /** Toolbar strip: shows which ruku is active (playing or paused). */
  function syncToolbarNowPlaying(row, state) {
    state = state || "idle";
    var shell = document.getElementById("toolbar-now-playing");
    var badge = document.getElementById("toolbar-now-playing-badge");
    var titleEl = document.getElementById("toolbar-now-playing-title");
    var metaEl = document.getElementById("toolbar-now-playing-meta");
    var gotoBtn = document.getElementById("goto-playing-btn");
    if (!titleEl || !metaEl || !gotoBtn) return;

    if (state === "idle" || !row) {
      clearPlaybackPersist();
      closePersistentMediaNotification();
      if (badge) {
        badge.hidden = true;
        badge.textContent = "";
        badge.className = "toolbar-now-playing-badge";
      }
      titleEl.textContent = "No track selected";
      metaEl.textContent = "Play a recording from the list below.";
      var toolbarFill = document.getElementById("toolbar-progress-fill");
      if (toolbarFill) toolbarFill.style.width = "0%";
      gotoBtn.disabled = true;
      if (shell) shell.classList.remove("is-playing", "is-paused");
      syncToolbarTransport();
      syncToolbarDock();
      return;
    }

    titleEl.textContent = "Para " + row.para + " · Ruku " + rukuDisplay(row);
    metaEl.textContent = row.surah + " · " + versesText(row.verses);
    if (parseInt(paraSelect.value, 10) !== row.para) {
      metaEl.textContent += " · Para " + row.para;
    }
    gotoBtn.disabled = false;

    if (badge) {
      badge.hidden = true;
    }
    if (shell) {
      shell.classList.toggle("is-playing", state === "playing");
      shell.classList.toggle("is-paused", state === "paused");
    }
    syncToolbarTransport();
    syncToolbarDock();
  }

  function getRowControlsByGlobalIndex(gi) {
    var tr = tbody.querySelector('tr[data-global-index="' + gi + '"]');
    if (!tr) return null;
    var playBtn = tr.querySelector(".audio-play-btn");
    var progress = tr.querySelector(".audio-progress");
    var timeCurrent = tr.querySelector(".audio-time-current");
    var timeDuration = tr.querySelector(".audio-time-duration");
    if (!playBtn || !progress) return null;
    return { tr: tr, playBtn: playBtn, progress: progress, timeCurrent: timeCurrent, timeDuration: timeDuration };
  }

  function triggerPlayNextForGlobalIndex(gi) {
    var playBtns = Array.from(tbody.querySelectorAll(".audio-play-btn"));
    var tr = tbody.querySelector('tr[data-global-index="' + gi + '"]');
    if (!tr) return false;
    var btn = tr.querySelector(".audio-play-btn");
    if (!btn) return false;
    var idx = playBtns.indexOf(btn);
    if (idx === -1 || idx + 1 >= playBtns.length) return false;
    var nextBtn = playBtns[idx + 1];
    var ntr = nextBtn.closest("tr");
    if (!ntr) return false;
    var nextGi = ntr.getAttribute("data-global-index");
    var nextRow = data[nextGi];
    if (!nextRow) {
      nextBtn.click();
      if (ntr) ntr.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    var nextSrc = getAudioSrc(nextRow, nextGi);
    if (!nextSrc) {
      nextBtn.click();
      if (ntr) ntr.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    prepareMqTrack(nextGi, nextRow, nextSrc).then(function () {
      var mqA = mqPlayback.el;
      mqA.loop = false;
      mqA.play();
    });
    if (ntr) ntr.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  /** Toggle the spinner on the active track's play button (and toolbar) while it buffers. */
  function setTrackLoading(isLoading) {
    var gi = mqPlayback.activeGlobalIndex;
    var els = gi != null ? getRowControlsByGlobalIndex(gi) : null;
    if (els && els.playBtn) {
      els.playBtn.classList.toggle("is-loading", isLoading);
      els.playBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
    }
    var toolbarBtn = document.getElementById("toolbar-play-pause-btn");
    if (toolbarBtn) toolbarBtn.classList.toggle("is-loading", isLoading);
  }

  function bindMqAudioLifecycle() {
    if (mqPlayback._listenersBound) return;
    mqPlayback._listenersBound = true;
    var a = mqPlayback.el;

    // Loading/buffering indicator: on when fetching or stalled, off once playable.
    a.addEventListener("loadstart", function () {
      if (a.networkState === 2 /* NETWORK_LOADING */) setTrackLoading(true);
    });
    a.addEventListener("waiting", function () { setTrackLoading(true); });
    a.addEventListener("stalled", function () { setTrackLoading(true); });
    a.addEventListener("canplay", function () { setTrackLoading(false); });
    a.addEventListener("playing", function () { setTrackLoading(false); });

    a.addEventListener("play", function () {
      stopMediaSessionKeepalive();
      currentPlayingAudio = a;
      clearPlayingClass();
      var gi = mqPlayback.activeGlobalIndex;
      if (gi == null) return;
      if (typeof preloadNextTrack === "function") preloadNextTrack(gi);
      var els = getRowControlsByGlobalIndex(gi);
      if (els) {
        els.tr.classList.add("playing");
        els.tr.classList.remove("audio-paused");
        els.playBtn.innerHTML = PAUSE_SVG;
        els.playBtn.setAttribute("aria-label", "Pause");
      }
      var r = data[gi];
      if (r) {
        setNowPlayingMetadata(r, a);
        syncToolbarNowPlaying(r, "playing");
        revealAyatForTrack(gi);
      }
      setMediaPlaybackState("playing");
      savePlaybackPersist();
      updatePersistentMediaNotification();
    });

    a.addEventListener("pause", function () {
      var gi = mqPlayback.activeGlobalIndex;
      var els = gi != null ? getRowControlsByGlobalIndex(gi) : null;
      if (els) {
        els.playBtn.innerHTML = PLAY_SVG;
        els.playBtn.setAttribute("aria-label", "Play");
        els.tr.classList.add("audio-paused");
        if (!els.tr.classList.contains("playing")) els.tr.classList.add("playing");
      }
      if (gi != null && data[gi]) {
        setNowPlayingMetadata(data[gi], a);
        syncToolbarNowPlaying(data[gi], "paused");
      }
      setMediaPlaybackState("paused");
      savePlaybackPersist();
      startPausedMediaSessionKeepalive();
      updatePersistentMediaNotification();
    });

    a.addEventListener("ended", function () {
      var pbMode = getPlaybackMode();
      countListen(mqPlayback.activeGlobalIndex);
      if (pbMode === "loop") {
        a.currentTime = 0;
        a.play();
        return;
      }
      stopMediaSessionKeepalive();
      clearReciting();
      var gi = mqPlayback.activeGlobalIndex;
      var els = gi != null ? getRowControlsByGlobalIndex(gi) : null;
      if (els) {
        els.playBtn.innerHTML = PLAY_SVG;
        els.playBtn.setAttribute("aria-label", "Play");
        els.tr.classList.remove("playing", "audio-paused");
        els.progress.value = 0;
        els.progress.style.setProperty("--progress", "0%");
        els.timeCurrent.textContent = "0:00";
      }
      if (gi != null) clearSavedPositionForIndex(gi);
      currentPlayingAudio = null;
      mqPlayback.activeGlobalIndex = null;
      setMediaPlaybackState("none");
      if (pbMode === "next" && gi != null && triggerPlayNextForGlobalIndex(gi)) return;
      clearPlaybackPersist();
      syncToolbarNowPlaying(null, "idle");
    });

    a.addEventListener("timeupdate", function () {
      schedulePersistPlayback();
      var gi = mqPlayback.activeGlobalIndex;
      if (gi == null) return;
      syncReciting(gi, a.currentTime);
      var els = getRowControlsByGlobalIndex(gi);
      if (!els || !a.duration || !isFinite(a.duration)) return;
      var pct = (a.currentTime / a.duration) * 100;
      els.progress.value = pct;
      els.progress.style.setProperty("--progress", pct + "%");
      els.timeCurrent.textContent = formatTime(a.currentTime);
      var toolbarFill = document.getElementById("toolbar-progress-fill");
      if (toolbarFill) toolbarFill.style.width = pct + "%";
      if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
        try {
          navigator.mediaSession.setPositionState({
            duration: a.duration,
            playbackRate: a.playbackRate || 1,
            position: a.currentTime
          });
        } catch (e) { /* ignore */ }
      }
    });

    a.addEventListener("loadedmetadata", function () {
      var gi = mqPlayback.activeGlobalIndex;
      var els = gi != null ? getRowControlsByGlobalIndex(gi) : null;
      if (els && a.duration && isFinite(a.duration)) {
        els.timeDuration.textContent = formatTime(a.duration);
      }
      if (gi != null && a.paused) pulseMediaSessionIfActive();
    });

    a.addEventListener("error", function () {
      setTrackLoading(false);

      // Playing from a saved offline copy that will not decode (truncated download, a
      // partial response an older service worker stored). Drop it and retry the network
      // URL — otherwise the row stays on "Path Not found" for good, even though the file
      // is fine on the server.
      if (mqPlayback.cachedFrom && mqPlayback.networkUrl) {
        var stale = mqPlayback.cachedFrom;
        var networkUrl = mqPlayback.networkUrl;
        mqPlayback.cachedFrom = null;
        mqPlayback.networkRetried = true;
        evictCachedAudio(stale).then(function () {
          a.src = networkUrl;
          a.load();
          a.addEventListener("canplay", function onNetwork() {
            a.removeEventListener("canplay", onNetwork);
            a.play();
          }, { once: true });
        });
        return;
      }

      /**
       * A dropped request is the usual cause of a failed load, and the alternates below are
       * extensions 485 of the 527 recorded rows simply do not have — so falling straight to
       * them turns one blip into two guaranteed 404s and a "Path Not found" on a file that
       * is fine. Give the canonical URL one more go first. The flag caps it at one, so a
       * genuinely missing file still reaches the alternates and the label.
       */
      if (mqPlayback.networkUrl && !mqPlayback.networkRetried) {
        mqPlayback.networkRetried = true;
        a.src = mqPlayback.networkUrl;
        a.load();
        a.addEventListener("canplay", function onNetworkRetry() {
          a.removeEventListener("canplay", onNetworkRetry);
          a.play();
        }, { once: true });
        return;
      }

      var alts = mqPlayback.alternateUrls || [];
      var idx = mqPlayback.alternateIndex || 0;
      if (alts.length && idx < alts.length) {
        mqPlayback.alternateIndex = idx + 1;
        a.src = alts[idx];
        a.load();
        a.addEventListener("canplay", function onAlt() {
          a.removeEventListener("canplay", onAlt);
          a.play();
        }, { once: true });
        return;
      }
      var gi = mqPlayback.activeGlobalIndex;
      stopMediaSessionKeepalive();
      currentPlayingAudio = null;
      mqPlayback.activeGlobalIndex = null;
      mqPlayback.cachedFrom = null;
      mqPlayback.networkUrl = null;
      clearPlaybackPersist();
      syncToolbarNowPlaying(null, "idle");
      if (gi == null) return;
      var tr = tbody.querySelector('tr[data-global-index="' + gi + '"]');
      if (tr) {
        var cell = tr.querySelector(".audio-cell");
        if (cell) {
          cell.innerHTML = "";
          var msg = document.createElement("span");
          msg.className = "path-not-found";
          msg.textContent = "Path Not found";
          cell.appendChild(msg);
          cell.appendChild(buildAudioRetryBtn(gi));
        }
      }
    });
  }

  function getMqAudioEl() {
    if (!mqPlayback.el) {
      mqPlayback.el = document.createElement("audio");
      mqPlayback.el.preload = "auto";
      mqPlayback.el.volume = getAudioVolume();
      var host = document.getElementById("mq-audio-host");
      (host || document.body).appendChild(mqPlayback.el);
    }
    if (!mqPlayback._listenersBound) bindMqAudioLifecycle();
    return mqPlayback.el;
  }

  function preloadNextTrack(gi) {
    var playBtns = Array.from(tbody.querySelectorAll(".audio-play-btn"));
    var currentTr = tbody.querySelector('tr[data-global-index="' + gi + '"]');
    if (!currentTr) return;
    var currentBtn = currentTr.querySelector(".audio-play-btn");
    if (!currentBtn) return;
    var idx = playBtns.indexOf(currentBtn);
    if (idx === -1 || idx + 1 >= playBtns.length) return;
    var nextBtn = playBtns[idx + 1];
    var ntr = nextBtn.closest("tr");
    if (!ntr) return;
    var nextGi = ntr.getAttribute("data-global-index");
    if (nextGi == null) return;
    if (mqPlayback._preloadedAudio && mqPlayback._preloadedAudio.gi === nextGi) return;
    var nextRow = data[nextGi];
    if (!nextRow) return;
    var nextSrc = getAudioSrc(nextRow, nextGi);
    if (!nextSrc) return;

    var allUrls = [nextSrc].concat(getAudioUrlAlternates(nextSrc));

    function tryPreload(i) {
      if (i >= allUrls.length) {
        var preloadAudio = new Audio();
        preloadAudio.preload = "auto";
        preloadAudio.src = nextSrc;
        preloadAudio.load();
        mqPlayback._preloadedAudio = { gi: nextGi, audio: preloadAudio, src: nextSrc };
        return;
      }
      getCachedAudioBlob(allUrls[i]).then(function(blobUrl) {
        if (blobUrl) {
          var preloadAudio = new Audio();
          preloadAudio.preload = "auto";
          preloadAudio.src = blobUrl;
          preloadAudio.load();
          mqPlayback._preloadedAudio = { gi: nextGi, audio: preloadAudio, src: blobUrl, cachedFrom: allUrls[i] };
        } else {
          tryPreload(i + 1);
        }
      });
    }
    tryPreload(0);
  }

  function prepareMqTrack(globalIndex, row, src, options) {
    options = options || {};
    getMqAudioEl();
    var a = mqPlayback.el;
    if (mqPlayback.activeGlobalIndex === globalIndex) {
      updatePersistentMediaNotification();
      return Promise.resolve(a);
    }
    tbody.querySelectorAll(".audio-play-btn").forEach(function (btn) {
      btn.innerHTML = PLAY_SVG;
      btn.setAttribute("aria-label", "Play");
      // Clear any spinner orphaned by a superseded load on another row's button
      // (is-loading sets pointer-events:none, so a stuck spinner makes the row unclickable).
      btn.classList.remove("is-loading");
      btn.setAttribute("aria-busy", "false");
    });
    clearPlayingClass();
    mqPlayback.activeGlobalIndex = globalIndex;
    mqPlayback.alternateUrls = getAudioUrlAlternates(src);
    mqPlayback.alternateIndex = 0;
    mqPlayback.networkUrl = src;
    mqPlayback.cachedFrom = null;
    mqPlayback.networkRetried = false;

    if (mqPlayback._preloadedAudio && mqPlayback._preloadedAudio.gi === String(globalIndex)) {
      var preloaded = mqPlayback._preloadedAudio;
      mqPlayback._preloadedAudio = null;
      mqPlayback.cachedFrom = preloaded.cachedFrom || null;
      a.src = preloaded.src;
      a.load();
      if (!options.skipStoredPosition) {
        applyStoredMapPosition(globalIndex, a);
      }
      updatePersistentMediaNotification();
      return Promise.resolve(a);
    }

    var allUrls = [src].concat(mqPlayback.alternateUrls);

    function whenReadyThenResolve(resolve) {
      function runSeekAndResolve() {
        if (!options.skipStoredPosition) {
          applyStoredMapPosition(globalIndex, a);
        }
        updatePersistentMediaNotification();
        resolve(a);
      }
      if (a.readyState >= 2) {
        runSeekAndResolve();
        return;
      }
      function onCanPlay() {
        a.removeEventListener("canplay", onCanPlay);
        a.removeEventListener("loadedmetadata", onMeta);
        a.removeEventListener("error", onErr);
        runSeekAndResolve();
      }
      function onMeta() {
        a.removeEventListener("loadedmetadata", onMeta);
        a.removeEventListener("error", onErr);
        runSeekAndResolve();
      }
      function onErr() {
        a.removeEventListener("canplay", onCanPlay);
        a.removeEventListener("loadedmetadata", onMeta);
        a.removeEventListener("error", onErr);
        resolve(a);
      }
      a.addEventListener("canplay", onCanPlay, { once: true });
      a.addEventListener("loadedmetadata", onMeta, { once: true });
      a.addEventListener("error", onErr, { once: true });
    }

    return new Promise(function (resolve) {
      (function tryLoad(i) {
        if (i >= allUrls.length) {
          a.src = src;
          a.load();
          whenReadyThenResolve(resolve);
          return;
        }
        getCachedAudioBlob(allUrls[i]).then(function (blobUrl) {
          if (blobUrl) {
            mqPlayback.cachedFrom = allUrls[i];
            a.src = blobUrl;
            a.load();
            whenReadyThenResolve(resolve);
          } else tryLoad(i + 1);
        });
      })(0);
    });
  }

  function syncToolbarTransport() {
    var btn = document.getElementById("toolbar-play-pause-btn");
    var icon = document.getElementById("toolbar-transport-icon");
    if (!btn || !icon) return;
    var gi = mqPlayback.activeGlobalIndex;
    var has = gi != null && data[gi];
    btn.disabled = !has;
    if (!has) {
      icon.innerHTML = PLAY_SVG;
      btn.setAttribute("aria-label", "Play or pause");
      return;
    }
    var a = mqPlayback.el;
    var paused = !a || a.paused;
    icon.innerHTML = paused ? PLAY_SVG : PAUSE_SVG;
    btn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }

  function setMediaPlaybackState(state) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch (e) {
      // Ignore unsupported playback state assignment.
    }
  }

  function setNowPlayingMetadata(row, audio) {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;

    var title = "Para " + row.para + " - " + rukuDisplay(row);
    var artist = row.surah + " | " + row.verses;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        album: "Marifatul Quran",
        artwork: [
          { src: "./icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "./icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      });

      navigator.mediaSession.setActionHandler("play", function () { audio.play(); });
      navigator.mediaSession.setActionHandler("pause", function () { audio.pause(); });
      navigator.mediaSession.setActionHandler("stop", function () {
        audio.pause();
        audio.currentTime = 0;
      });
      navigator.mediaSession.setActionHandler("seekbackward", function (details) {
        var offset = (details && details.seekOffset) ? details.seekOffset : 10;
        audio.currentTime = Math.max(0, audio.currentTime - offset);
      });
      navigator.mediaSession.setActionHandler("seekforward", function (details) {
        var offset = (details && details.seekOffset) ? details.seekOffset : 10;
        audio.currentTime = Math.min(audio.duration || audio.currentTime, audio.currentTime + offset);
      });
      navigator.mediaSession.setActionHandler("seekto", function (details) {
        if (!details || typeof details.seekTime !== "number") return;
        audio.currentTime = details.seekTime;
      });
      if (audio.duration && isFinite(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate || 1,
            position: audio.currentTime
          });
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      // Ignore unsupported Media Session handlers on some browsers.
    }
  }

  function stopMediaSessionKeepalive() {
    if (mediaSessionKeepaliveTimer != null) {
      clearInterval(mediaSessionKeepaliveTimer);
      mediaSessionKeepaliveTimer = null;
    }
  }

  /**
   * Mobile OS often drops lock-screen / notification media controls while paused.
   * Re-apply metadata, handlers, position, and playbackState so controls stay available.
   */
  function pulseMediaSessionIfActive() {
    if (!("mediaSession" in navigator)) return;
    var a = mqPlayback.el;
    var gi = mqPlayback.activeGlobalIndex;
    if (!a || gi == null || !data[gi]) return;
    setMediaPlaybackState(a.paused ? "paused" : "playing");
    setNowPlayingMetadata(data[gi], a);
  }

  function startPausedMediaSessionKeepalive() {
    stopMediaSessionKeepalive();
    mediaSessionKeepaliveTimer = setInterval(function () {
      if (!mqPlayback.el || mqPlayback.activeGlobalIndex == null || !mqPlayback.el.paused) {
        stopMediaSessionKeepalive();
        return;
      }
      pulseMediaSessionIfActive();
    }, 22000);
  }

  var MEDIA_NOTIF_PREF_KEY = "mq_pref_media_notif";

  function getPersistentMediaNotifPref() {
    return localStorage.getItem(MEDIA_NOTIF_PREF_KEY) === "true";
  }

  function setPersistentMediaNotifPref(on) {
    if (on) localStorage.setItem(MEDIA_NOTIF_PREF_KEY, "true");
    else {
      localStorage.setItem(MEDIA_NOTIF_PREF_KEY, "false");
      closePersistentMediaNotification();
    }
  }

  function postMediaNotificationToSw(payload) {
    if (!("serviceWorker" in navigator)) return;
    var c = navigator.serviceWorker.controller;
    if (c) {
      c.postMessage(payload);
      return;
    }
    navigator.serviceWorker.ready.then(function (reg) {
      if (reg.active) reg.active.postMessage(payload);
    });
  }

  function closePersistentMediaNotification() {
    postMediaNotificationToSw({ type: "MQ_MEDIA_NOTIF_CLOSE" });
  }

  function updatePersistentMediaNotification() {
    if (!getPersistentMediaNotifPref()) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    var gi = mqPlayback.activeGlobalIndex;
    var a = mqPlayback.el;
    if (gi == null || !data[gi] || !a) {
      closePersistentMediaNotification();
      return;
    }
    var row = data[gi];
    var title = "Para " + row.para + " · Ruku " + rukuDisplay(row);
    var line = (a.paused ? "Paused" : "Playing") + " · " + row.surah + " — " + row.verses;
    postMediaNotificationToSw({
      type: "MQ_MEDIA_NOTIF_SHOW",
      title: title,
      body: line,
      playing: !a.paused
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (e) {
      var d = e.data;
      if (!d || d.type !== "MQ_MEDIA_CONTROL") return;
      var a = mqPlayback.el;
      if (!a || mqPlayback.activeGlobalIndex == null) return;
      if (d.action === "play") {
        a.play().catch(function () {});
      } else if (d.action === "pause") {
        a.pause();
      }
    });
  }

  window.addEventListener("pagehide", function () {
    if (mqPlayback.el && mqPlayback.activeGlobalIndex != null) savePlaybackPersist();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (mqPlayback.el && mqPlayback.activeGlobalIndex != null && mqPlayback.el.paused) {
      pulseMediaSessionIfActive();
    }
  });

  window.addEventListener("focus", function () {
    if (mqPlayback.el && mqPlayback.activeGlobalIndex != null && mqPlayback.el.paused) {
      pulseMediaSessionIfActive();
    }
  });

  paraSelect.addEventListener("change", function () {
    renderTable({ scrollBasePara: tableRenderedPara });
    syncParaStepButtons();
  });

  /**
   * Step one para at a time. `paraSelect` only lists paras that survive the current filter,
   * so stepping walks the visible options rather than 1..30 -- otherwise "next" could land
   * on a para the dropdown will not show.
   */
  var paraPrevBtn = document.getElementById("para-prev");
  var paraNextBtn = document.getElementById("para-next");

  function syncParaStepButtons() {
    if (!paraPrevBtn || !paraNextBtn) return;
    var opts = Array.prototype.slice.call(paraSelect.options);
    var at = opts.findIndex(function (o) { return o.value === paraSelect.value; });
    paraPrevBtn.disabled = at <= 0;
    paraNextBtn.disabled = at < 0 || at >= opts.length - 1;
  }

  function stepPara(delta) {
    var opts = Array.prototype.slice.call(paraSelect.options);
    var at = opts.findIndex(function (o) { return o.value === paraSelect.value; });
    var next = opts[at + delta];
    if (!next) return;
    var basePara = tableRenderedPara;
    paraSelect.value = next.value;
    renderTable({ scrollBasePara: basePara });
    syncParaStepButtons();
  }

  if (paraPrevBtn) paraPrevBtn.addEventListener("click", function () { stepPara(-1); });
  if (paraNextBtn) paraNextBtn.addEventListener("click", function () { stepPara(1); });

  tbody.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".verses-toggle") : null;
    if (!btn) return;
    var tr = btn.closest("tr[data-global-index]");
    if (tr) toggleAyat(tr.dataset.globalIndex);
  });

  // GitHub API config (used for file upload)

  function getGitHubToken() {
    return localStorage.getItem("gh_token") || "";
  }

  function setGitHubToken(token) {
    if (token) localStorage.setItem("gh_token", token);
    else localStorage.removeItem("gh_token");
  }

  // Settings modal
  var settingsModal = document.getElementById("settings-modal");
  var settingsBtn = document.getElementById("settings-btn");
  var settingsCloseBtn = document.getElementById("settings-close-btn");
  var settingsBackdrop = document.getElementById("settings-modal-backdrop");
  var roleUserBtn = document.getElementById("role-user-btn");
  var roleAdminBtn = document.getElementById("role-admin-btn");
  var roleBadge = document.getElementById("role-badge");
  var adminSection = document.getElementById("admin-section");
  var ghTokenInput = document.getElementById("gh-token-input");
  var togglePara = document.getElementById("show-only-recorded-para");
  var toggleRuku = document.getElementById("show-only-recorded-ruku");
  var prefMediaNotif = document.getElementById("pref-media-notification");
  var mediaNotifHint = document.getElementById("media-notif-hint");
  var playbackModeGroup = document.getElementById("playback-mode-group");
  var speedSelect = document.getElementById("default-speed-select");
  var toolbarVolume = document.getElementById("toolbar-volume");
  var settingsVolumeRange = document.getElementById("settings-volume-range");
  var settingsVolumeValue = document.getElementById("settings-volume-value");
  var themeModeGroup = document.getElementById("theme-mode-group");

  function syncVolumeUI() {
    var pct = Math.round(getAudioVolume() * 100);
    if (toolbarVolume) toolbarVolume.value = String(pct);
    if (settingsVolumeRange) {
      settingsVolumeRange.value = String(pct);
      settingsVolumeRange.setAttribute("aria-valuenow", String(pct));
    }
    if (settingsVolumeValue) settingsVolumeValue.textContent = pct + "%";
  }

  function onGlobalVolumeInput(pct) {
    var n = parseInt(pct, 10);
    if (isNaN(n)) n = 100;
    n = Math.max(0, Math.min(100, n));
    setAudioVolume(n / 100);
    applyVolumeToAllAudioElements();
    syncVolumeUI();
  }

  function syncMediaNotifHint() {
    if (!mediaNotifHint) return;
    if (typeof Notification === "undefined") {
      mediaNotifHint.textContent = "Notifications are not supported in this browser.";
      return;
    }
    if (Notification.permission === "denied") {
      mediaNotifHint.textContent = "Permission denied. Enable notifications for this site in your browser settings.";
    } else if (Notification.permission === "default") {
      mediaNotifHint.textContent = "Turn the option on and allow the prompt for best results on Android Chrome.";
    } else {
      mediaNotifHint.textContent = "Optional. Keeps a system notification while a track is open (playing or paused). Works best on Android Chrome; iOS is limited.";
    }
  }

  function openSettings() {
    syncSettingsUI();
    settingsModal.classList.add("is-open");
  }

  function closeSettings() {
    settingsModal.classList.remove("is-open");
    // Save token if admin
    if (isAdmin() && ghTokenInput) {
      var val = ghTokenInput.value.trim();
      setGitHubToken(val);
    }
    renderTable();
  }

  function syncSettingsUI() {
    var admin = isAdmin();
    roleUserBtn.classList.toggle("active", !admin);
    roleAdminBtn.classList.toggle("active", admin);
    roleBadge.textContent = admin ? "Admin" : "User";
    roleBadge.className = "settings-role-badge" + (admin ? " admin" : "");
    adminSection.style.display = admin ? "" : "none";
    if (admin && ghTokenInput) {
      ghTokenInput.value = getGitHubToken();
    }
    togglePara.checked = getShowOnlyRecordedPara();
    toggleRuku.checked = getShowOnlyRecordedRuku();
    var mode = getPlaybackMode();
    playbackModeGroup.querySelectorAll("[data-mode]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    speedSelect.value = String(getDefaultSpeed());
    syncVolumeUI();
    var th = getUiTheme();
    if (themeModeGroup) {
      themeModeGroup.querySelectorAll("[data-ui-theme]").forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.uiTheme === th);
      });
    }
    if (prefMediaNotif) {
      if (typeof Notification !== "undefined") {
        if (getPersistentMediaNotifPref() && Notification.permission !== "granted") {
          setPersistentMediaNotifPref(false);
        }
        prefMediaNotif.checked = getPersistentMediaNotifPref() && Notification.permission === "granted";
      } else {
        prefMediaNotif.checked = false;
      }
      syncMediaNotifHint();
    }
  }

  if (toolbarVolume) {
    toolbarVolume.addEventListener("input", function () {
      onGlobalVolumeInput(this.value);
    });
  }
  if (settingsVolumeRange) {
    settingsVolumeRange.addEventListener("input", function () {
      onGlobalVolumeInput(this.value);
    });
  }

  syncVolumeUI();

  var gotoPlayingBtn = document.getElementById("goto-playing-btn");
  var toolbarPlayPauseBtn = document.getElementById("toolbar-play-pause-btn");
  function scrollToPlayingRow() {
    var gi = mqPlayback.activeGlobalIndex;
    if (gi == null || !data[gi]) return;
    var r = data[gi];
    if (parseInt(paraSelect.value, 10) !== r.para) {
      paraSelect.value = String(r.para);
      renderTable({ scrollBasePara: tableRenderedPara });
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var row = tbody.querySelector('tr[data-global-index="' + gi + '"]');
        if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }
  if (gotoPlayingBtn) {
    gotoPlayingBtn.addEventListener("click", function () {
      scrollToPlayingRow();
    });
  }
  if (toolbarPlayPauseBtn) {
    toolbarPlayPauseBtn.addEventListener("click", function () {
      var gi = mqPlayback.activeGlobalIndex;
      if (gi == null || !data[gi]) return;
      var row = data[gi];
      var src = getAudioSrc(row, gi);
      if (!src) return;
      var a = getMqAudioEl();
      if (!a.paused) {
        a.pause();
        return;
      }
      prepareMqTrack(gi, row, src).then(function () {
        a.play();
      });
    });
  }

  togglePara.addEventListener("change", function () {
    setShowOnlyRecordedPara(this.checked);
    renderTable({ skipViewRestore: true });
  });

  toggleRuku.addEventListener("change", function () {
    setShowOnlyRecordedRuku(this.checked);
    renderTable({ skipViewRestore: true });
  });

  if (prefMediaNotif) {
    prefMediaNotif.addEventListener("change", function () {
      var want = this.checked;
      if (!want) {
        setPersistentMediaNotifPref(false);
        syncMediaNotifHint();
        return;
      }
      if (typeof Notification === "undefined") {
        this.checked = false;
        syncMediaNotifHint();
        return;
      }
      if (Notification.permission === "granted") {
        setPersistentMediaNotifPref(true);
        updatePersistentMediaNotification();
        syncMediaNotifHint();
        return;
      }
      if (Notification.permission === "denied") {
        this.checked = false;
        syncMediaNotifHint();
        alert("Notifications are blocked for this site. Enable them in your browser settings.");
        return;
      }
      Notification.requestPermission().then(function (perm) {
        if (perm === "granted") {
          setPersistentMediaNotifPref(true);
          updatePersistentMediaNotification();
        } else {
          prefMediaNotif.checked = false;
          setPersistentMediaNotifPref(false);
        }
        syncMediaNotifHint();
      });
    });
  }

  playbackModeGroup.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-mode]");
    if (!btn) return;
    setPlaybackMode(btn.dataset.mode);
    playbackModeGroup.querySelectorAll("[data-mode]").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
  });

  speedSelect.addEventListener("change", function () {
    setDefaultSpeed(parseFloat(this.value));
  });

  if (themeModeGroup) {
    themeModeGroup.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-ui-theme]");
      if (!btn) return;
      var next = btn.dataset.uiTheme;
      setUiTheme(next);
      applyUiTheme(next);
      themeModeGroup.querySelectorAll("[data-ui-theme]").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
    });
  }

  settingsBtn.addEventListener("click", function () { closeToolbarMenu(); openSettings(); });
  settingsCloseBtn.addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", closeSettings);

  /* Three-dot menu: one dropdown, opened from the app bar or from the docked bar. The
     dropdown moves under whichever button opened it, so it drops from the app bar and
     rises from the docked bar. */
  var toolbarMenuBtns = [document.getElementById("toolbar-menu-btn"), document.getElementById("dock-menu-btn")]
    .filter(Boolean);
  var toolbarMenuDropdown = document.getElementById("toolbar-menu-dropdown");
  function closeToolbarMenu() {
    if (!toolbarMenuDropdown) return;
    toolbarMenuDropdown.classList.remove("is-open");
    toolbarMenuBtns.forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }
  if (toolbarMenuDropdown) {
    toolbarMenuBtns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var wrap = btn.parentNode;
        var wasOpen = toolbarMenuDropdown.classList.contains("is-open") && toolbarMenuDropdown.parentNode === wrap;
        closeToolbarMenu();
        if (wasOpen) return;
        if (toolbarMenuDropdown.parentNode !== wrap) wrap.appendChild(toolbarMenuDropdown);
        toolbarMenuDropdown.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      });
    });
    toolbarMenuDropdown.addEventListener("click", function () {
      closeToolbarMenu();
    });
    document.addEventListener("click", function () {
      closeToolbarMenu();
    });
  }

  (function wireHifzIo() {
    var enabledToggle = document.getElementById("hifz-enabled-toggle");
    if (enabledToggle) {
      enabledToggle.addEventListener("change", function () {
        setHifzEnabled(enabledToggle.checked);
        applyHifzEnabled(enabledToggle.checked);
      });
    }
    migrateHifzKeys();
    applyHifzEnabled(getHifzEnabled());

    var exportBtn = document.getElementById("hifz-export-btn");
    var importBtn = document.getElementById("hifz-import-btn");
    var importFile = document.getElementById("hifz-import-file");
    var resetBtn = document.getElementById("hifz-reset-btn");
    if (exportBtn) exportBtn.addEventListener("click", exportHifz);
    if (importBtn && importFile) {
      importBtn.addEventListener("click", function () { importFile.click(); });
      importFile.addEventListener("change", function () {
        if (importFile.files && importFile.files[0]) importHifzFromFile(importFile.files[0]);
        importFile.value = "";
      });
    }
    if (resetBtn) resetBtn.addEventListener("click", resetHifz);
  })();

  document.getElementById("clear-cache-btn").addEventListener("click", function () {
    if (!confirm("Clear all cached data? Your current track position will be preserved. Offline audio will need to be re-downloaded.")) return;
    var btn = this;
    btn.disabled = true;
    btn.textContent = "Clearing…";

    // Preserve current track and essential settings
    var preserve = {};
    var keepKeys = [PLAYBACK_STORAGE_KEY, POSITIONS_STORAGE_KEY, "ui_theme", HIFZ_STORAGE_KEY, "guide_seen"];
    keepKeys.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v !== null) preserve[k] = v;
    });

    // 1. Clear all SW caches
    var clearCaches = caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    });

    // 2. Unregister all service workers
    var clearSW = ("serviceWorker" in navigator)
      ? navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        })
      : Promise.resolve();

    // 3. Clear localStorage and sessionStorage, then restore preserved keys
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    Object.keys(preserve).forEach(function (k) {
      localStorage.setItem(k, preserve[k]);
    });

    // 4. Clear IndexedDB databases
    var clearIDB = ("indexedDB" in window && indexedDB.databases)
      ? indexedDB.databases().then(function (dbs) {
          return Promise.all(dbs.map(function (db) {
            return new Promise(function (resolve) {
              var req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = req.onerror = req.onblocked = resolve;
            });
          }));
        })
      : Promise.resolve();

    Promise.all([clearCaches, clearSW, clearIDB]).then(function () {
      location.reload();
    });
  });

  roleUserBtn.addEventListener("click", function () {
    setRole("user");
    syncSettingsUI();
    renderTable();
  });

  roleAdminBtn.addEventListener("click", function () {
    if (!isAdmin()) {
      var pw = prompt("Enter admin password:");
      if (pw === null) return;
      if (pw !== ADMIN_PASSWORD) {
        alert("Incorrect password.");
        return;
      }
    }
    setRole("admin");
    syncSettingsUI();
    renderTable();
  });

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function authHeader() {
    var token = getGitHubToken();
    if (!token) return {};
    // Fine-grained tokens start with github_pat_, classic with ghp_
    var prefix = token.startsWith("github_pat_") ? "Bearer" : "token";
    return { Authorization: prefix + " " + token };
  }

  function apiUrl(filePath) {
    var encoded = filePath.split("/").map(encodeURIComponent).join("/");
    return "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + encoded;
  }

  function getExistingFileSha(path) {
    return fetch(apiUrl(path) + "?ref=" + GITHUB_BRANCH, {
      headers: authHeader()
    }).then(function (res) {
      if (res.status === 200) return res.json().then(function (d) { return d.sha; });
      return null;
    }).catch(function () { return null; });
  }

  function uploadToGitHub(filePath, base64Content, commitMessage) {
    var token = getGitHubToken();
    if (!token) return Promise.reject(new Error("No GitHub token set. Click ⚙ GitHub Token to configure."));

    return getExistingFileSha(filePath).then(function (sha) {
      var body = {
        message: commitMessage,
        content: base64Content,
        branch: GITHUB_BRANCH
      };
      if (sha) body.sha = sha;

      var headers = authHeader();
      headers["Content-Type"] = "application/json";

      return fetch(apiUrl(filePath), {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(body)
      });
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error((d.message || "Upload failed") + " (HTTP " + res.status + ")"); });
      return res.json();
    });
  }

  var uploadStatusBannerEl = null;

  function ensureUploadStatusBanner() {
    if (uploadStatusBannerEl) return uploadStatusBannerEl;
    var bar = document.createElement("div");
    bar.id = "upload-status-banner";
    bar.className = "upload-status-banner";
    bar.setAttribute("role", "status");
    bar.innerHTML =
      "<span class=\"upload-status-banner-text\"></span>" +
      "<button type=\"button\" class=\"upload-status-banner-dismiss btn btn-sm btn-secondary\" aria-label=\"Dismiss notification\">Dismiss</button>";
    bar.style.display = "none";
    document.body.appendChild(bar);
    bar.querySelector(".upload-status-banner-dismiss").addEventListener("click", function () {
      bar.style.display = "none";
      bar.classList.remove("upload-status-banner--progress", "upload-status-banner--success", "upload-status-banner--error");
    });
    uploadStatusBannerEl = bar;
    return bar;
  }

  /**
   * Shows upload/recording status until the user clicks Dismiss (no auto-hide).
   * @param {"progress"|"success"|"error"} kind
   */
  function showUploadStatus(message, kind) {
    var el = ensureUploadStatusBanner();
    el.querySelector(".upload-status-banner-text").textContent = message;
    el.classList.remove("upload-status-banner--progress", "upload-status-banner--success", "upload-status-banner--error");
    if (kind === "success") el.classList.add("upload-status-banner--success");
    else if (kind === "error") el.classList.add("upload-status-banner--error");
    else el.classList.add("upload-status-banner--progress");
    el.style.display = "flex";
  }

  function buildUploadButton(actionCell, row, globalIndex) {
    if (!getGitHubToken()) return;
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "audio/ogg,audio/opus,audio/wav,audio/wave,audio/*";
    fileInput.style.display = "none";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-primary";
    btn.textContent = "⬆ Upload";
    btn.addEventListener("click", function () { fileInput.click(); });

    if (pendingUploadByIndex[globalIndex]) {
      btn.disabled = true;
      btn.textContent = "Uploading…";
    }

    fileInput.addEventListener("change", function () {
      if (!this.files || !this.files[0]) return;
      var file = this.files[0];
      var ext = (file.name && file.name.indexOf(".") >= 0)
        ? "." + file.name.split(".").pop().toLowerCase()
        : ".ogg";
      if (ext !== ".ogg" && ext !== ".opus" && ext !== ".wav") ext = ".ogg";
      var targetName = row.para + "__" + row.rukuInPara + "__" + row.surah + ext;
      var filePath = "audio/" + row.para + "/" + targetName;
      var summary = "Para " + row.para + " · Ruku " + rukuDisplay(row) + " (" + row.surah + ")";

      // Immediate playback via blob
      if (sessionBlobUrls[globalIndex]) URL.revokeObjectURL(sessionBlobUrls[globalIndex]);
      var blobUrl = URL.createObjectURL(file);
      sessionBlobUrls[globalIndex] = blobUrl;
      row.audioUrl = filePath;

      pendingUploadByIndex[globalIndex] = true;
      btn.disabled = true;
      btn.textContent = "Uploading…";
      showUploadStatus("Recording upload in progress — " + summary, "progress");

      fileToBase64(file).then(function (b64) {
        return uploadToGitHub(filePath, b64, "Add " + targetName);
      }).then(function () {
        delete pendingUploadByIndex[globalIndex];
        showUploadStatus("Recording uploaded successfully — " + summary, "success");
        renderTable();
      }).catch(function (err) {
        delete pendingUploadByIndex[globalIndex];
        btn.disabled = false;
        btn.textContent = "⬆ Upload";
        showUploadStatus("Upload failed — " + summary + ": " + err.message, "error");
      });
    });

    actionCell.appendChild(fileInput);
    actionCell.appendChild(btn);
  }

  function buildValidateControl(actionCell, row) {
    var label = document.createElement("label");
    label.className = "validate-label" + (isRukuValidated(row) ? " validated" : "");
    label.title = "Mark recording as validated";

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "validate-check";
    cb.checked = isRukuValidated(row);

    var span = document.createElement("span");
    span.textContent = cb.checked ? "✓ Validated" : "✓ Validate";

    cb.addEventListener("change", function () {
      setRukuValidated(row, this.checked);
      label.classList.toggle("validated", this.checked);
      span.textContent = this.checked ? "✓ Validated" : "✓ Validate";
    });

    label.appendChild(cb);
    label.appendChild(span);
    actionCell.appendChild(label);
  }

  document.addEventListener("keydown", function (e) {
    // Don't intercept when typing in inputs
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (!currentPlayingAudio) return;
      e.preventDefault();
      var offset = 5;
      if (e.key === "ArrowLeft") {
        currentPlayingAudio.currentTime = Math.max(0, currentPlayingAudio.currentTime - offset);
      } else {
        currentPlayingAudio.currentTime = Math.min(
          currentPlayingAudio.duration || currentPlayingAudio.currentTime,
          currentPlayingAudio.currentTime + offset
        );
      }
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      var playBtns = Array.from(tbody.querySelectorAll(".audio-play-btn"));
      if (!playBtns.length) return;
      var playingTr = tbody.querySelector("tr.playing");
      if (!playingTr && mqPlayback.activeGlobalIndex != null) {
        playingTr = tbody.querySelector('tr[data-global-index="' + mqPlayback.activeGlobalIndex + '"]');
      }
      var currentBtn = playingTr ? playingTr.querySelector(".audio-play-btn") : null;
      var idx = currentBtn ? playBtns.indexOf(currentBtn) : -1;
      var nextIdx = e.key === "ArrowDown"
        ? Math.min(playBtns.length - 1, idx + 1)
        : Math.max(0, idx - 1);
      if (nextIdx !== idx) {
        playBtns[nextIdx].click();
        playBtns[nextIdx].closest("tr").scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });

  // Bulk download helpers
  function getAudioUrlsForPara(para) {
    var items = indexedData[para] || [];
    var urls = [];
    items.forEach(function (item) {
      var src = getAudioSrc(item.row, item.globalIndex);
      if (src) urls.push(src);
    });
    return urls;
  }

  function getAudioUrlsForParaAsync(para) {
    var items = indexedData[para] || [];
    var promises = items.map(function (item) {
      var src = getAudioSrc(item.row, item.globalIndex);
      if (!src) return Promise.resolve(false);
      return audioFileExists(src);
    });
    return Promise.all(promises).then(function (results) {
      var urls = [];
      items.forEach(function (item, i) {
        var src = getAudioSrc(item.row, item.globalIndex);
        if (src && results[i]) urls.push(src);
      });
      return urls;
    });
  }

  function downloadBatch(urls, onProgress) {
    var done = 0;
    var total = urls.length;
    if (!total) return Promise.resolve();

    var CONCURRENCY = 10;
    var index = 0;

    function downloadOne(url) {
      return cacheAudioFile(url).catch(function () {
        var alts = getAudioUrlAlternates(url);
        function tryAlt(i) {
          if (i >= alts.length) return Promise.resolve();
          return cacheAudioFile(alts[i]).catch(function () { return tryAlt(i + 1); });
        }
        return tryAlt(0);
      }).then(function () {
        done++;
        if (onProgress) onProgress(done, total);
      });
    }

    function worker() {
      if (index >= urls.length) return Promise.resolve();
      var url = urls[index++];
      return downloadOne(url).then(worker);
    }

    var workers = [];
    for (var i = 0; i < Math.min(CONCURRENCY, urls.length); i++) {
      workers.push(worker());
    }
    return Promise.all(workers);
  }

  var shareBulkLinksBtn = document.getElementById("share-bulk-links-btn");
  var shareBulkModal = document.getElementById("share-bulk-links-modal");
  var shareBulkBackdrop = document.getElementById("share-bulk-links-modal-backdrop");
  var shareBulkCloseBtn = document.getElementById("share-bulk-links-close-btn");
  var shareBulkTitleEl = document.getElementById("share-bulk-links-modal-title");
  var shareBulkListEl = document.getElementById("share-bulk-links-list");
  var shareBulkCountEl = document.getElementById("share-bulk-links-count");
  var shareBulkSelectAllBtn = document.getElementById("share-bulk-links-select-all-btn");
  var shareBulkClearBtn = document.getElementById("share-bulk-links-clear-btn");
  var shareBulkCopyBtn = document.getElementById("share-bulk-links-copy-btn");
  var shareBulkShareBtn = document.getElementById("share-bulk-links-share-btn");

  function getShareBulkLinksCombinedText() {
    if (!shareBulkListEl) return "";
    var tiles = shareBulkListEl.querySelectorAll(".share-bulk-links-tile.is-selected");
    var parts = [];
    tiles.forEach(function (tile) {
      var gi = parseInt(tile.getAttribute("data-global-index"), 10);
      if (isNaN(gi) || !data[gi]) return;
      var row = data[gi];
      parts.push(formatBulkRukuLinkBlock(row.para, row));
    });
    return parts.join("\n\n");
  }

  function updateShareBulkLinksUi() {
    var n = shareBulkListEl ? shareBulkListEl.querySelectorAll(".share-bulk-links-tile.is-selected").length : 0;
    var total = shareBulkListEl ? shareBulkListEl.querySelectorAll(".share-bulk-links-tile").length : 0;
    if (shareBulkCountEl) shareBulkCountEl.textContent = n + " of " + total + " selected";
    if (shareBulkCopyBtn) shareBulkCopyBtn.disabled = !n;
    if (shareBulkShareBtn) shareBulkShareBtn.disabled = !n;
  }

  function populateShareBulkLinksModal(paraNum) {
    if (shareBulkTitleEl) shareBulkTitleEl.textContent = "Share ruku links · Para " + paraNum;
    if (!shareBulkListEl) return;
    shareBulkListEl.textContent = "";
    var items = indexedData[paraNum] || [];
    items.forEach(function (item) {
      var row = item.row;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "share-bulk-links-tile is-selected";
      btn.setAttribute("aria-pressed", "true");
      btn.setAttribute("data-global-index", String(item.globalIndex));
      btn.setAttribute(
        "title",
        "P" + paraNum + ": " + rukuDisplay(row) + " — " + row.surah + " (" + row.verses + ")"
      );

      var keyEl = document.createElement("span");
      keyEl.className = "share-bulk-links-tile-key";
      keyEl.textContent = rukuDisplay(row);

      var surahEl = document.createElement("span");
      surahEl.className = "share-bulk-links-tile-surah";
      surahEl.textContent = row.surah;

      var versesEl = document.createElement("span");
      versesEl.className = "share-bulk-links-tile-verses";
      versesEl.textContent = row.verses;

      btn.appendChild(keyEl);
      btn.appendChild(surahEl);
      btn.appendChild(versesEl);
      shareBulkListEl.appendChild(btn);
    });
    updateShareBulkLinksUi();
  }

  function openShareBulkLinksModal(paraNum) {
    if (!shareBulkModal) return;
    var items = indexedData[paraNum] || [];
    if (!items.length) {
      alert("No ruku rows for Para " + paraNum + ".");
      return;
    }
    populateShareBulkLinksModal(paraNum);
    shareBulkModal.classList.add("is-open");
    shareBulkModal.setAttribute("aria-hidden", "false");
  }

  function closeShareBulkLinksModal() {
    if (!shareBulkModal) return;
    shareBulkModal.classList.remove("is-open");
    shareBulkModal.setAttribute("aria-hidden", "true");
    if (shareBulkListEl) shareBulkListEl.textContent = "";
  }

  if (shareBulkLinksBtn && shareBulkModal) {
    shareBulkLinksBtn.addEventListener("click", function () {
      closeToolbarMenu();
      var paraNum = parseInt(paraSelect.value, 10);
      if (isNaN(paraNum)) return;
      openShareBulkLinksModal(paraNum);
    });
  }

  if (shareBulkCloseBtn) shareBulkCloseBtn.addEventListener("click", closeShareBulkLinksModal);
  if (shareBulkBackdrop) shareBulkBackdrop.addEventListener("click", closeShareBulkLinksModal);

  if (shareBulkListEl) {
    shareBulkListEl.addEventListener("click", function (e) {
      var tile = e.target.closest(".share-bulk-links-tile");
      if (!tile || !shareBulkListEl.contains(tile)) return;
      var on = tile.classList.toggle("is-selected");
      tile.setAttribute("aria-pressed", on ? "true" : "false");
      updateShareBulkLinksUi();
    });
  }

  if (shareBulkSelectAllBtn && shareBulkListEl) {
    shareBulkSelectAllBtn.addEventListener("click", function () {
      shareBulkListEl.querySelectorAll(".share-bulk-links-tile").forEach(function (t) {
        t.classList.add("is-selected");
        t.setAttribute("aria-pressed", "true");
      });
      updateShareBulkLinksUi();
    });
  }

  if (shareBulkClearBtn && shareBulkListEl) {
    shareBulkClearBtn.addEventListener("click", function () {
      shareBulkListEl.querySelectorAll(".share-bulk-links-tile").forEach(function (t) {
        t.classList.remove("is-selected");
        t.setAttribute("aria-pressed", "false");
      });
      updateShareBulkLinksUi();
    });
  }

  if (shareBulkCopyBtn) {
    shareBulkCopyBtn.addEventListener("click", function () {
      var t = getShareBulkLinksCombinedText();
      if (!t) {
        alert("Select at least one ruku.");
        return;
      }
      copyShareCaption(t).then(function (ok) {
        alert(ok ? "Copied to clipboard." : "Could not copy. Try Share again.");
      });
    });
  }

  if (shareBulkShareBtn) {
    shareBulkShareBtn.addEventListener("click", function () {
      var t = getShareBulkLinksCombinedText();
      if (!t) {
        alert("Select at least one ruku.");
        return;
      }
      if (typeof navigator.share === "function") {
        navigator
          .share({ text: t })
          .then(function () {})
          .catch(function (err) {
            if (err && err.name === "AbortError") return;
            copyShareCaption(t).then(function (ok) {
              alert(
                ok
                  ? "Share sheet failed — text was copied instead."
                  : "Could not share or copy."
              );
            });
          });
      } else {
        copyShareCaption(t).then(function (ok) {
          alert(ok ? "Copied (Share not supported on this browser)." : "Could not copy.");
        });
      }
    });
  }

  var shareParaFileBtn = document.getElementById("share-para-file-btn");
  var shareFileModal = document.getElementById("share-para-file-modal");
  var shareFileBackdrop = document.getElementById("share-para-file-modal-backdrop");
  var shareFileCloseBtn = document.getElementById("share-para-file-close-btn");
  var shareFileTitleEl = document.getElementById("share-para-file-modal-title");
  var shareFileProgressEl = document.getElementById("share-para-file-progress");
  var shareFilePreviewEl = document.getElementById("share-para-file-preview");
  var shareFileShareBtn = document.getElementById("share-para-file-share-btn");
  var shareFileAllBtn = document.getElementById("share-para-file-share-all-btn");
  var shareFileNextBtn = document.getElementById("share-para-file-next-btn");
  var shareFileItems = [];
  var shareFileIndex = 0;
  var shareFileParaNum = 1;

  function updateShareFileModal() {
    if (!shareFilePreviewEl || !shareFileProgressEl || !shareFileNextBtn) return;
    var total = shareFileItems.length;
    if (!total) return;
    var cur = shareFileItems[shareFileIndex];
    var n = shareFileIndex + 1;
    shareFileProgressEl.textContent = "P" + shareFileParaNum + " · ruku " + n + " of " + total;
    shareFilePreviewEl.textContent = cur.caption;
    var last = shareFileIndex >= total - 1;
    shareFileNextBtn.disabled = last;
    shareFileNextBtn.textContent = last ? "Last ruku" : "Next ruku";
    if (shareFileAllBtn) {
      shareFileAllBtn.style.display = total > 1 ? "" : "none";
    }
  }

  function openShareFileModal(paraNum) {
    if (!shareFileModal) return;
    shareFileItems = getParaRukuFileShareItems(paraNum);
    if (!shareFileItems.length) {
      alert("No recordings to share for Para " + paraNum + ". Save offline or check audio paths.");
      return;
    }
    shareFileParaNum = paraNum;
    shareFileIndex = 0;
    if (shareFileTitleEl) {
      shareFileTitleEl.textContent = "Share Para " + paraNum + " as files";
    }
    updateShareFileModal();
    shareFileModal.classList.add("is-open");
    shareFileModal.setAttribute("aria-hidden", "false");
  }

  function closeShareFileModal() {
    if (!shareFileModal) return;
    shareFileModal.classList.remove("is-open");
    shareFileModal.setAttribute("aria-hidden", "true");
    shareFileItems = [];
  }

  if (shareParaFileBtn && shareFileModal) {
    shareParaFileBtn.addEventListener("click", function () {
      closeToolbarMenu();
      var paraNum = parseInt(paraSelect.value, 10);
      if (isNaN(paraNum)) return;
      openShareFileModal(paraNum);
    });
  }

  if (shareFileCloseBtn) shareFileCloseBtn.addEventListener("click", closeShareFileModal);
  if (shareFileBackdrop) shareFileBackdrop.addEventListener("click", closeShareFileModal);

  if (shareFileShareBtn) {
    shareFileShareBtn.addEventListener("click", function () {
      if (!shareFileItems.length || shareFileShareBtn.disabled) return;
      var cur = shareFileItems[shareFileIndex];
      shareFileShareBtn.disabled = true;
      shareAudioFileWithCaption(cur.src, cur.row, cur.caption).then(
        function () {},
        function () {}
      ).then(function () {
        shareFileShareBtn.disabled = false;
      });
    });
  }

  if (shareFileAllBtn) {
    shareFileAllBtn.addEventListener("click", function () {
      if (!shareFileItems.length || shareFileAllBtn.disabled) return;
      var items = shareFileItems;
      var paraNum = shareFileParaNum;
      shareFileAllBtn.disabled = true;
      if (shareFileShareBtn) shareFileShareBtn.disabled = true;
      if (shareFileNextBtn) shareFileNextBtn.disabled = true;
      shareAllParaRecordingsAsFiles(items, paraNum)
        .then(function () {}, function () {})
        .then(function () {
          shareFileAllBtn.disabled = false;
          if (shareFileShareBtn) shareFileShareBtn.disabled = false;
          updateShareFileModal();
        });
    });
  }

  if (shareFileNextBtn) {
    shareFileNextBtn.addEventListener("click", function () {
      if (shareFileNextBtn.disabled) return;
      if (shareFileIndex < shareFileItems.length - 1) {
        shareFileIndex += 1;
        updateShareFileModal();
      }
    });
  }

  // Download current Para button
  var downloadParaBtn = document.getElementById("download-para-btn");
  downloadParaBtn.addEventListener("click", function () {
    if (!navigator.onLine) { alert("No internet connection."); return; }
    var para = parseInt(paraSelect.value, 10);
    var urls = getAudioUrlsForPara(para);
    if (!urls.length) { alert("No recordings in Para " + para + "."); return; }

    downloadParaBtn.disabled = true;
    downloadParaBtn.textContent = "Downloading 0/" + urls.length + "…";

    downloadBatch(urls, function (done, total) {
      downloadParaBtn.textContent = "Downloading " + done + "/" + total + "…";
    }).then(function () {
      downloadParaBtn.textContent = "Saved · Para " + para;
      downloadParaBtn.disabled = false;
      renderTable();
      setTimeout(function () { downloadParaBtn.textContent = "Download para"; }, 3000);
    });
  });

  // Download All Paras button (in settings)
  var downloadAllBtn = document.getElementById("download-all-btn");
  var downloadAllStatus = document.getElementById("download-all-status");

  downloadAllBtn.addEventListener("click", function () {
    if (!navigator.onLine) { alert("No internet connection."); return; }

    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = "⏳ Checking...";
    downloadAllStatus.textContent = "Preparing...";

    var allPromises = [];
    for (var p = 1; p <= 30; p++) {
      allPromises.push(getAudioUrlsForParaAsync(p));
    }

    Promise.all(allPromises).then(function (results) {
      var allUrls = [];
      var cachedCount = 0;
      results.forEach(function (urls) {
        cachedCount += urls.length;
        allUrls = allUrls.concat(urls);
      });

      var totalToDownload = allUrls.length;
      if (!totalToDownload) { alert("No recordings found."); return; }
      if (!confirm("Download " + totalToDownload + " audio files for offline use? (" + cachedCount + " already cached)")) {
        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = "📥 Download All Paras";
        downloadAllStatus.textContent = "";
        return;
      }

      downloadAllBtn.textContent = "⏳ Downloading…";
      downloadAllStatus.textContent = "0/" + totalToDownload;

      downloadBatch(allUrls, function (done, total) {
        downloadAllStatus.textContent = done + "/" + total;
      }).then(function () {
        downloadAllBtn.textContent = "✓ All saved";
        downloadAllStatus.textContent = "";
        downloadAllBtn.disabled = false;
        renderTable();
        setTimeout(function () { downloadAllBtn.textContent = "📥 Download All Paras"; }, 3000);
      });
    });
  });

  (function bootstrapPlaybackFromStorage() {
    pendingRukuHighlightFromUrl = null;
    var qp = new URLSearchParams(window.location.search);
    var urlPara = parseInt(qp.get("para"), 10);
    var urlParaOk = !isNaN(urlPara) && urlPara >= 1 && urlPara <= 30 &&
      paraSelect.querySelector('option[value="' + urlPara + '"]');
    if (urlParaOk) {
      paraSelect.value = String(urlPara);
      var rk = qp.get("ruku");
      if (rk != null && String(rk).trim() !== "") {
        try {
          pendingRukuHighlightFromUrl = decodeURIComponent(String(rk)).trim();
        } catch (err) {
          pendingRukuHighlightFromUrl = String(rk).trim();
        }
      }
    } else {
      var p = readPlaybackPersist();
      if (p) {
        var gi = parseInt(p.globalIndex, 10);
        if (!isNaN(gi) && data[gi]) {
          paraSelect.value = String(data[gi].para);
        }
      }
    }
    syncParaInUrl(false);
    var ti = document.getElementById("toolbar-transport-icon");
    if (ti) ti.innerHTML = PLAY_SVG;
  })();

  /* ----------------------------------------------------------------- */
  /* First-run guided walkthrough (mirrors native GuideOverlay).        */
  /* ----------------------------------------------------------------- */
  // Each step: a caption anchored to a target element's rect. Selectors are
  // queried live on each render so the guide stays correct if the table
  // re-renders. A null target centers the caption with no spotlight/arrow.
  var GUIDE_STEPS = [
    {
      title: "Choose a Para (Juz)",
      body: "Tap here to pick a Para from 1–30. Its rukus appear in the list below.",
      selector: "#para-select",
    },
    {
      title: "Play a recording",
      body: "Tap the play button on any ruku to listen. Use −5 / +5 to skip, or drag the bar to seek.",
      selector: "#ruku-tbody .audio-play-btn",
    },
    {
      title: "Download for offline",
      body: "Tap the download icon to save a ruku on your device. Once it's saved you can play it anytime, even without internet.",
      selector: "#ruku-tbody .audio-offline-btn",
    },
    {
      title: "Share on WhatsApp",
      body: "Tap the WhatsApp icon to send a ruku to family or friends. Use the menu's “Share rukus” to send several at once.",
      selector: "#ruku-tbody .audio-share-wa-btn",
    },
    {
      title: "Track memorization (Hifz)",
      body: "Tap the check on a ruku once you have it by heart; tap again to unmark it. The count beside it is how many times you have heard the recording through. The bar above the list shows your progress for this Para.",
      selector: "#ruku-tbody .hifz-mark",
    },
  ];

  function guideTargetRect(step) {
    if (!step.selector) return null;
    var el = document.querySelector(step.selector);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    // Skip elements that have no box (display:none / zero size).
    if (r.width === 0 && r.height === 0) return null;
    return r;
  }

  function drawGuideArrow(svg, from, to) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.setAttribute("class", "mq-guide-arrow-line");
    svg.appendChild(line);
    // Arrowhead: a "V" at the target end, pointing along the shaft.
    var head = 11;
    var angle = Math.atan2(dy, dx);
    var a1 = angle + Math.PI - Math.PI / 6;
    var a2 = angle + Math.PI + Math.PI / 6;
    var poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points",
      to.x + "," + to.y + " " +
      (to.x + head * Math.cos(a1)) + "," + (to.y + head * Math.sin(a1)) + " " +
      (to.x + head * Math.cos(a2)) + "," + (to.y + head * Math.sin(a2)));
    poly.setAttribute("class", "mq-guide-arrow-head");
    svg.appendChild(poly);
  }

  function showGuide() {
    if (document.querySelector(".mq-guide-overlay")) return;

    var root = document.createElement("div");
    root.className = "mq-guide-overlay";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Guided walkthrough");

    var spotlight = document.createElement("div");
    spotlight.className = "mq-guide-spotlight";
    spotlight.style.display = "none";

    var arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrowSvg.setAttribute("class", "mq-guide-arrow");

    var caption = document.createElement("div");
    caption.className = "mq-guide-caption";
    caption.innerHTML =
      '<div class="mq-guide-step-label"></div>' +
      '<div class="mq-guide-title"></div>' +
      '<p class="mq-guide-body"></p>' +
      '<div class="mq-guide-actions">' +
      '  <button type="button" class="mq-guide-skip">Skip</button>' +
      '  <button type="button" class="mq-guide-next"></button>' +
      '</div>';

    root.appendChild(spotlight);
    root.appendChild(arrowSvg);
    root.appendChild(caption);
    document.body.appendChild(root);

    var labelEl = caption.querySelector(".mq-guide-step-label");
    var titleEl = caption.querySelector(".mq-guide-title");
    var bodyEl = caption.querySelector(".mq-guide-body");
    var skipBtn = caption.querySelector(".mq-guide-skip");
    var nextBtn = caption.querySelector(".mq-guide-next");

    var index = 0;
    var rafId = 0;

    function renderStep() {
      cancelAnimationFrame(rafId);
      var step = GUIDE_STEPS[index];
      var target = guideTargetRect(step);
      var vh = window.innerHeight;

      labelEl.textContent = "Step " + (index + 1) + " of " + GUIDE_STEPS.length;
      titleEl.textContent = step.title;
      bodyEl.textContent = step.body;
      nextBtn.textContent = (index === GUIDE_STEPS.length - 1) ? "Got it" : "Next";

      // Spotlight around the target (8px padding, like the native ring pad).
      if (target) {
        var pad = 8;
        spotlight.style.display = "block";
        spotlight.style.left = (target.left - pad) + "px";
        spotlight.style.top = (target.top - pad) + "px";
        spotlight.style.width = (target.width + pad * 2) + "px";
        spotlight.style.height = (target.height + pad * 2) + "px";
      } else {
        spotlight.style.display = "none";
      }

      // Provisional caption placement; finalized after measuring its height.
      var captionBelow = !target || target.top + target.height / 2 < vh * 0.5;
      var provisionalTop;
      if (!target) {
        provisionalTop = vh * 0.4;
      } else if (captionBelow) {
        provisionalTop = target.bottom + 16;
      } else {
        provisionalTop = Math.max(16, target.top - 16 - 150);
      }
      caption.style.top = provisionalTop + "px";

      rafId = requestAnimationFrame(function () {
        var ch = caption.offsetHeight;
        var finalTop;
        if (!target) {
          finalTop = vh * 0.4;
        } else if (captionBelow) {
          finalTop = Math.min(target.bottom + 16, vh - ch - 16);
        } else {
          finalTop = Math.max(16, target.top - 16 - ch);
        }
        caption.style.top = finalTop + "px";

        // Arrow from the caption edge to the target.
        if (target) {
          var capRect = caption.getBoundingClientRect();
          var ax = Math.max(capRect.left + 24, Math.min(target.left + target.width / 2, capRect.right - 24));
          var from, to;
          if (captionBelow) {
            from = { x: ax, y: capRect.top - 4 };
            to = { x: target.left + target.width / 2, y: target.bottom + 6 };
          } else {
            from = { x: ax, y: capRect.bottom + 4 };
            to = { x: target.left + target.width / 2, y: target.top - 6 };
          }
          drawGuideArrow(arrowSvg, from, to);
          arrowSvg.style.display = "";
        } else {
          arrowSvg.style.display = "none";
        }
      });
    }

    function finish() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", renderStep);
      window.removeEventListener("scroll", renderStep, true);
      if (root.parentNode) root.parentNode.removeChild(root);
      setGuideSeen();
    }
    function advance() {
      if (index >= GUIDE_STEPS.length - 1) {
        finish();
      } else {
        index++;
        renderStep();
      }
    }

    root.addEventListener("click", advance);
    skipBtn.addEventListener("click", function (e) { e.stopPropagation(); finish(); });
    nextBtn.addEventListener("click", function (e) { e.stopPropagation(); advance(); });
    window.addEventListener("resize", renderStep);
    // Reposition on any scroll (table is inside a scroll container) — capture phase.
    window.addEventListener("scroll", renderStep, true);

    renderStep();
  }

  renderTable();
  if (pendingRukuHighlightFromUrl) {
    scrollTableToRukuRow(parseInt(paraSelect.value, 10), pendingRukuHighlightFromUrl);
    pendingRukuHighlightFromUrl = null;
  }

  // Replayable walkthrough via the toolbar menu.
  var showGuideBtn = document.getElementById("show-guide-btn");
  if (showGuideBtn) showGuideBtn.addEventListener("click", showGuide);

  // Show the guided walkthrough automatically the first time the app is opened
  // (after the first table render so the first row's controls exist).
  if (!isGuideSeen()) {
    requestAnimationFrame(function () { requestAnimationFrame(showGuide); });
  }
})();


