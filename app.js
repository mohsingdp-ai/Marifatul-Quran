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
      meta.setAttribute("content", t === "dark" ? "#0a1111" : "#0d4f4f");
    }
  }

  applyUiTheme(getUiTheme());

  const tbody = document.getElementById("ruku-tbody");
  const paraSelect = document.getElementById("para-select");
  const actionHeader = document.querySelector("#ruku-table thead th:last-child");
  /** Para that `tbody` currently reflects (fixes scroll restore when the dropdown changes). */
  var tableRenderedPara = paraSelect ? String(paraSelect.value) : "1";
  /** When opening `?para=&ruku=`, scroll to that ruku after the first table render. */
  var pendingRukuHighlightFromUrl = null;

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
  var PLAYBACK_STORAGE_KEY = "mq_playback_v1";
  /** globalIndex -> { t: seconds } last heard position per recording */
  var POSITIONS_STORAGE_KEY = "mq_audio_positions_v1";
  var mqPlayback = {
    el: null,
    _listenersBound: false,
    activeGlobalIndex: null,
    alternateUrls: [],
    alternateIndex: 0
  };
  var persistPlaybackTimer = null;
  var mediaSessionKeepaliveTimer = null;

  // GitHub API config
  var GITHUB_OWNER = "mohsingdp-ai";
  var GITHUB_REPO = "Marifatul-Quran";
  var GITHUB_BRANCH = "v4";

  // Hover tooltip: show audio path
  var pathTooltip = document.createElement("div");
  pathTooltip.className = "ruku-path-tooltip";
  pathTooltip.setAttribute("aria-hidden", "true");
  document.body.appendChild(pathTooltip);
  var activeTooltipRow = null;

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
  function isRukuValidated(globalIndex) {
    return !!getValidatedRukus()[globalIndex];
  }
  function setRukuValidated(globalIndex, val) {
    var v = getValidatedRukus();
    if (val) v[globalIndex] = true; else delete v[globalIndex];
    localStorage.setItem("validated_rukus", JSON.stringify(v));
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

  function audioFileExists(audioPath) {
    if (!audioPath) return false;
    var abs = resolveUrl(audioPath);
    return caches.open(AUDIO_CACHE).then(function (cache) {
      return cache.match(abs).then(function (cached) { return !!cached; });
    }).catch(function () { return false; });
  }

  function showNoRecording(audioCell) {
    var span = document.createElement("span");
    span.className = "no-recording";
    span.textContent = "No recording";
    audioCell.appendChild(span);
  }

  function buildRow(item, canUpload, playbackResume) {
    var row = item.row;
    var globalIndex = item.globalIndex;
    var tr = document.createElement("tr");
    tr.dataset.globalIndex = globalIndex;

    var rukuLabel = row.rukuInPara + " (Para " + row.para + ")";
    var surahArabicCell = row.surahNumber + " " + row.surahArabic;
    var audioSrc = getAudioSrc(row, globalIndex);
    var savedPath = normalizeAudioPath(row.audioUrl);

    tr.innerHTML =
      "<td data-label=\"Ruku #\">" + escapeHtml(rukuLabel) + "</td>" +
      "<td data-label=\"Surah\">" + escapeHtml(row.surah) + "</td>" +
      "<td class=\"col-verses\" data-label=\"Verses\">" + escapeHtml(row.verses) + "</td>" +
      "<td class=\"col-surah-arabic\" data-label=\"Arabic\">" + escapeHtml(surahArabicCell) + "</td>" +
      "<td class=\"col-audio audio-cell\" data-label=\"Audio\"></td>" +
      (canUpload ? "<td class=\"action-cell\" data-label=\"Action\"></td>" : "");

    var audioCell = tr.querySelector(".audio-cell");
    var actionCell = canUpload ? tr.querySelector(".action-cell") : null;

    if (audioSrc && (sessionBlobUrls[globalIndex] || audioFileExists(audioSrc))) {
      var resumeThis = playbackResume && String(playbackResume.globalIndex) === String(globalIndex) ? playbackResume : null;
      buildAudioPlayer(tr, audioCell, row, globalIndex, audioSrc, clearPlayingClass, resumeThis);
    } else {
      showNoRecording(audioCell);
    }

    if (canUpload && actionCell) {
      buildUploadButton(actionCell, row, globalIndex);
      buildValidateControl(actionCell, globalIndex);
    }

    tr.dataset.pathText = savedPath || "(No recording)";
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
    setActionColumnVisibility(canUpload);

    filtered.forEach(function (item) {
      var rowResume = stickyPlaybackResume && String(stickyPlaybackResume.globalIndex) === String(item.globalIndex)
        ? stickyPlaybackResume
        : null;
      fragment.appendChild(buildRow(item, canUpload, rowResume));
    });

    if (filtered.length === 0) {
      var emptyTr = document.createElement("tr");
      emptyTr.innerHTML = "<td colspan=\"6\" style=\"text-align:center;padding:1rem;color:#555;\">No recordings in this Para</td>";
      fragment.appendChild(emptyTr);
    }

    tbody.appendChild(fragment);
    restoreTableViewState(viewState);
    tableRenderedPara = String(paraSelect.value);
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
  }

  function positionPathTooltip(tr) {
    var rect = tr.getBoundingClientRect();
    pathTooltip.style.left = rect.left + "px";
    pathTooltip.style.top = (rect.top - 6) + "px";
    pathTooltip.style.transform = "translateY(-100%)";
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

    wrap.appendChild(seekBackBtn);
    wrap.appendChild(playBtn);
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
    wrap.appendChild(offlineBtn);
    wrap.appendChild(buildWhatsAppShareBtn(row, src));

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
  var PLAY_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14l11-7z"/></svg>';
  var PAUSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M14 19V5h4v14zm-8 0V5h4v14z"/></svg>';
  var SEEK_BACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6"/><path d="M2.5 8A10 10 0 1 1 4.4 17.5"/><text x="12" y="16" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">-5</text></svg>';
  var SEEK_FWD_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.5 8A10 10 0 1 0 19.6 17.5"/><text x="12" y="16" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">+5</text></svg>';

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
      "P" + paraNum + ": " + row.rukuInPara + " — " + row.surah + " (" + row.verses + ")";
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
        "P" + row.para + ": " + row.rukuInPara + " — " + row.surah + " (" + row.verses + ")";
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

  function getCachedAudioBlob(url) {
    var abs = resolveUrl(url);
    return caches.open(AUDIO_CACHE).then(function (cache) {
      return cache.match(abs);
    }).then(function (resp) {
      if (!resp) return null;
      return resp.blob().then(function (blob) {
        return URL.createObjectURL(blob);
      });
    }).catch(function () { return null; });
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
          it.row.rukuInPara +
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
                it.row.rukuInPara +
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
      var caption = "P" + row.para + ": " + row.rukuInPara + " — " + row.surah + " (" + row.verses + ")";
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
      return;
    }

    titleEl.textContent = "Para " + row.para + " · Ruku " + row.rukuInPara;
    metaEl.textContent = row.surah + " · " + row.verses;
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

  function bindMqAudioLifecycle() {
    if (mqPlayback._listenersBound) return;
    mqPlayback._listenersBound = true;
    var a = mqPlayback.el;

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
      if (pbMode === "loop") {
        a.currentTime = 0;
        a.play();
        return;
      }
      stopMediaSessionKeepalive();
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
          mqPlayback._preloadedAudio = { gi: nextGi, audio: preloadAudio, src: blobUrl };
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
    });
    clearPlayingClass();
    mqPlayback.activeGlobalIndex = globalIndex;
    mqPlayback.alternateUrls = getAudioUrlAlternates(src);
    mqPlayback.alternateIndex = 0;

    if (mqPlayback._preloadedAudio && mqPlayback._preloadedAudio.gi === String(globalIndex)) {
      var preloaded = mqPlayback._preloadedAudio;
      mqPlayback._preloadedAudio = null;
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

    var title = "Para " + row.para + " - " + row.rukuInPara;
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
    var title = "Para " + row.para + " · Ruku " + row.rukuInPara;
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
  });

  tbody.addEventListener("mouseover", function (e) {
    var tr = e.target.closest("tr");
    if (!tr || !tbody.contains(tr) || tr === activeTooltipRow) return;
    activeTooltipRow = tr;
    pathTooltip.textContent = tr.dataset.pathText || "(No recording)";
    pathTooltip.classList.add("is-visible");
    positionPathTooltip(tr);
  });

  tbody.addEventListener("mouseout", function (e) {
    var tr = e.target.closest("tr");
    if (!tr || tr !== activeTooltipRow) return;
    var related = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest("tr") : null;
    if (related === tr) return;
    activeTooltipRow = null;
    pathTooltip.classList.remove("is-visible");
  });

  tbody.addEventListener("mousemove", function () {
    if (activeTooltipRow) positionPathTooltip(activeTooltipRow);
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
      if (!src || !audioFileExists(src)) return;
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

  /* Toolbar three-dot menu */
  var toolbarMenuBtn = document.getElementById("toolbar-menu-btn");
  var toolbarMenuDropdown = document.getElementById("toolbar-menu-dropdown");
  function closeToolbarMenu() {
    if (toolbarMenuDropdown) {
      toolbarMenuDropdown.classList.remove("is-open");
      if (toolbarMenuBtn) toolbarMenuBtn.setAttribute("aria-expanded", "false");
    }
  }
  if (toolbarMenuBtn && toolbarMenuDropdown) {
    toolbarMenuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = toolbarMenuDropdown.classList.toggle("is-open");
      toolbarMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    toolbarMenuDropdown.addEventListener("click", function () {
      closeToolbarMenu();
    });
    document.addEventListener("click", function () {
      closeToolbarMenu();
    });
  }

  document.getElementById("clear-cache-btn").addEventListener("click", function () {
    if (!confirm("Clear all cached data? Your current track position will be preserved. Offline audio will need to be re-downloaded.")) return;
    var btn = this;
    btn.disabled = true;
    btn.textContent = "Clearing…";

    // Preserve current track and essential settings
    var preserve = {};
    var keepKeys = [PLAYBACK_STORAGE_KEY, POSITIONS_STORAGE_KEY, "ui_theme"];
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
      var summary = "Para " + row.para + " · Ruku " + row.rukuInPara + " (" + row.surah + ")";

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

  function buildValidateControl(actionCell, globalIndex) {
    var label = document.createElement("label");
    label.className = "validate-label" + (isRukuValidated(globalIndex) ? " validated" : "");
    label.title = "Mark recording as validated";

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "validate-check";
    cb.checked = isRukuValidated(globalIndex);

    var span = document.createElement("span");
    span.textContent = cb.checked ? "✓ Validated" : "✓ Validate";

    cb.addEventListener("change", function () {
      setRukuValidated(globalIndex, this.checked);
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
        "P" + paraNum + ": " + row.rukuInPara + " — " + row.surah + " (" + row.verses + ")"
      );

      var keyEl = document.createElement("span");
      keyEl.className = "share-bulk-links-tile-key";
      keyEl.textContent = row.rukuInPara;

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
    var ti = document.getElementById("toolbar-transport-icon");
    if (ti) ti.innerHTML = PLAY_SVG;
  })();
  renderTable();
  if (pendingRukuHighlightFromUrl) {
    scrollTableToRukuRow(parseInt(paraSelect.value, 10), pendingRukuHighlightFromUrl);
    pendingRukuHighlightFromUrl = null;
  }
})();


