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
    tbody.querySelectorAll("tr.playing").forEach(function (tr) {
      tr.classList.remove("playing");
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
    return !!audioPath;
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
      buildAudioPlayer(tr, audioCell, row, audioSrc, clearPlayingClass, resumeThis);
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
    return audioSrc && audioFileExists(audioSrc);
  }

  /** Snapshot active (or paused mid-track) audio before tbody is replaced. */
  function capturePlaybackResumeState() {
    var audios = tbody.querySelectorAll("audio");
    var chosen = null;
    var chosenTr = null;
    for (var i = 0; i < audios.length; i++) {
      var a = audios[i];
      if (a.paused && a.currentTime < 0.05) continue;
      var tr = a.closest("tr");
      if (!tr || tr.dataset.globalIndex == null) continue;
      if (!a.paused) {
        chosen = a;
        chosenTr = tr;
        break;
      }
      if (!chosen) {
        chosen = a;
        chosenTr = tr;
      }
    }
    if (!chosen || !chosenTr) return null;
    return {
      globalIndex: String(chosenTr.dataset.globalIndex),
      currentTime: chosen.currentTime,
      wasPlaying: !chosen.paused,
      playbackRate: chosen.playbackRate || 1
    };
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
    if (snap) stickyPlaybackResume = snap;
    var canUpload = hasGitHubToken();
    var filterRuku = getShowOnlyRecordedRuku();

    // Update para select first so any para jump happens before getFilteredData reads the value
    updateParaSelect();

    var filtered = getFilteredData();

    if (filterRuku) {
      filtered = filtered.filter(hasRecording);
    }

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
  }

  function positionPathTooltip(tr) {
    var rect = tr.getBoundingClientRect();
    pathTooltip.style.left = rect.left + "px";
    pathTooltip.style.top = (rect.top - 6) + "px";
    pathTooltip.style.transform = "translateY(-100%)";
  }

  function buildAudioPlayer(tr, audioCell, row, src, clearPlayingFn, playbackResume) {
    var audio = null;

    function ensureAudioElement() {
      if (audio) return audio;
      audio = document.createElement("audio");
      audio.preload = "none";
      audio.controls = false;
      audio.volume = getAudioVolume();
      audio._alternateUrls = getAudioUrlAlternates(src);
      audio._alternateIndex = 0;

      audio._ready = new Promise(function (resolve) {
        var allUrls = [src].concat(audio._alternateUrls);
        (function tryLoadFromCache(i) {
          if (i >= allUrls.length) {
            audio.src = src;
            audio.load();
            resolve();
            return;
          }
          getCachedAudioBlob(allUrls[i]).then(function (blobUrl) {
            if (blobUrl) {
              audio.src = blobUrl;
              audio.load();
              resolve();
            } else {
              tryLoadFromCache(i + 1);
            }
          });
        })(0);
      });

      audio.addEventListener("play", function () {
        playBtn.innerHTML = PAUSE_SVG;
        playBtn.setAttribute("aria-label", "Pause");
        if (currentPlayingAudio && currentPlayingAudio !== audio) {
          currentPlayingAudio.pause();
        }
        currentPlayingAudio = audio;
        clearPlayingFn();
        tr.classList.add("playing");
        setNowPlayingMetadata(row, audio);
        setMediaPlaybackState("playing");
      });
      audio.addEventListener("pause", function () {
        playBtn.innerHTML = PLAY_SVG;
        playBtn.setAttribute("aria-label", "Play");
        if (audio.currentTime < (audio.duration || 0) - 0.1) tr.classList.remove("playing");
        if (currentPlayingAudio === audio) currentPlayingAudio = null;
        setMediaPlaybackState("paused");
      });
      audio.addEventListener("ended", function () {
        var pbMode = getPlaybackMode();
        if (pbMode === "loop") {
          audio.currentTime = 0;
          audio.play();
          return;
        }
        playBtn.innerHTML = PLAY_SVG;
        playBtn.setAttribute("aria-label", "Play");
        tr.classList.remove("playing");
        progress.value = 0;
        timeCurrent.textContent = "0:00";
        if (currentPlayingAudio === audio) currentPlayingAudio = null;
        setMediaPlaybackState("none");
        if (pbMode === "next") {
          var playBtns = Array.from(tbody.querySelectorAll(".audio-play-btn"));
          var idx = playBtns.indexOf(playBtn);
          if (idx !== -1 && idx + 1 < playBtns.length) {
            playBtns[idx + 1].click();
            playBtns[idx + 1].closest("tr").scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      });
      audio.addEventListener("error", function () {
        var alternates = audio._alternateUrls || [];
        var idx = audio._alternateIndex || 0;
        if (alternates.length && idx < alternates.length) {
          audio._alternateIndex = idx + 1;
          audio.src = alternates[idx];
          audio.load();
          audio.addEventListener("canplay", function onAlternateReady() {
            audio.removeEventListener("canplay", onAlternateReady);
            audio.play();
          }, { once: true });
          return;
        }
        var msg = document.createElement("span");
        msg.className = "path-not-found";
        msg.textContent = "Path Not found";
        audioCell.innerHTML = "";
        audioCell.appendChild(msg);
      });
      audio.addEventListener("loadedmetadata", function () {
        timeDuration.textContent = formatTime(audio.duration);
      });
      audio.addEventListener("timeupdate", function () {
        if (audio.duration && isFinite(audio.duration)) {
          var pct = (audio.currentTime / audio.duration) * 100;
          progress.value = pct;
          progress.style.setProperty("--progress", pct + "%");
          timeCurrent.textContent = formatTime(audio.currentTime);
          if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
            try {
              navigator.mediaSession.setPositionState({
                duration: audio.duration,
                playbackRate: audio.playbackRate || 1,
                position: audio.currentTime
              });
            } catch (e) { /* ignore */ }
          }
        }
      });

      audioCell.appendChild(audio);
      return audio;
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
      if (audio) audio.playbackRate = speed;
    });

    var seekBackBtn = document.createElement("button");
    seekBackBtn.type = "button";
    seekBackBtn.className = "audio-seek-btn audio-seek-back-btn";
    seekBackBtn.innerHTML = SEEK_BACK_SVG;
    seekBackBtn.setAttribute("aria-label", "Seek back 5 seconds");

    seekBackBtn.addEventListener("click", function () {
      var a = ensureAudioElement();
      a._ready.then(function () {
        a.currentTime = Math.max(0, a.currentTime - 5);
      });
    });

    var seekFwdBtn = document.createElement("button");
    seekFwdBtn.type = "button";
    seekFwdBtn.className = "audio-seek-btn audio-seek-fwd-btn";
    seekFwdBtn.innerHTML = SEEK_FWD_SVG;
    seekFwdBtn.setAttribute("aria-label", "Seek forward 5 seconds");

    seekFwdBtn.addEventListener("click", function () {
      var a = ensureAudioElement();
      a._ready.then(function () {
        a.currentTime = Math.min(a.duration || a.currentTime, a.currentTime + 5);
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
      a._ready.then(function () {
        a.playbackRate = speeds[currentSpeedIndex];
        a.loop = false;
        if (a.paused) {
          if (currentPlayingAudio && currentPlayingAudio !== a) {
            currentPlayingAudio.pause();
          }
          a.play();
          clearPlayingFn();
          tr.classList.add("playing");
          currentPlayingAudio = a;
        } else {
          a.pause();
        }
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
      var a = ensureAudioElement();
      progress.value = pct;
      progress.style.setProperty("--progress", pct + "%");
      a._ready.then(function () {
        if (a.duration && isFinite(a.duration)) {
          a.currentTime = (pct / 100) * a.duration;
        }
      });
    }

    var seeking = false;
    progressOverlay.addEventListener("mousemove", function (e) {
      var pct = pctFromEvent(e);
      if (audio && audio.duration && isFinite(audio.duration)) {
        var sec = (pct / 100) * audio.duration;
        hoverTime.textContent = formatTime(sec) + " / " + formatTime(audio.duration);
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

    /* Touch support for progress bar (mobile) */
    progressOverlay.addEventListener("touchstart", function (e) {
      if (e.cancelable) e.preventDefault();
      seeking = true;
      var pct = pctFromEvent(e);
      seekToPct(pct);
      if (audio && audio.duration && isFinite(audio.duration)) {
        var sec = (pct / 100) * audio.duration;
        hoverTime.textContent = formatTime(sec) + " / " + formatTime(audio.duration);
        hoverTime.style.left = pct + "%";
        hoverTime.classList.add("is-visible");
      }
    }, { passive: false });
    progressOverlay.addEventListener("touchmove", function (e) {
      if (seeking && e.cancelable) e.preventDefault();
      var pct = pctFromEvent(e);
      seekToPct(pct);
      if (audio && audio.duration && isFinite(audio.duration)) {
        var sec = (pct / 100) * audio.duration;
        hoverTime.textContent = formatTime(sec) + " / " + formatTime(audio.duration);
        hoverTime.style.left = pct + "%";
      }
    }, { passive: false });
    progressOverlay.addEventListener("touchend", function () {
      seeking = false;
      hoverTime.classList.remove("is-visible");
    });
    progressOverlay.addEventListener("touchcancel", function () {
      seeking = false;
      hoverTime.classList.remove("is-visible");
    });

    var offlineBtn = buildOfflineBtn(src);
    wrap.appendChild(offlineBtn);
    wrap.appendChild(buildWhatsAppShareBtn(row, src));

    audioCell.appendChild(wrap);

    if (playbackResume) {
      (function () {
        var snap = playbackResume;
        var a = ensureAudioElement();
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
        a.playbackRate = speeds[currentSpeedIndex];
        a._ready.then(function () {
          var dur = a.duration && isFinite(a.duration) ? a.duration : 0;
          var t = snap.currentTime;
          if (dur > 0) t = Math.min(Math.max(0, t), Math.max(0, dur - 0.05));
          else t = Math.max(0, t);
          a.currentTime = t;
          if (dur > 0) {
            var pct = (t / dur) * 100;
            progress.value = pct;
            progress.style.setProperty("--progress", pct + "%");
            timeCurrent.textContent = formatTime(t);
            timeDuration.textContent = formatTime(dur);
          } else {
            timeCurrent.textContent = formatTime(t);
          }
          if (snap.wasPlaying) {
            a.play().catch(function () { /* autoplay policy */ });
            playBtn.innerHTML = PAUSE_SVG;
            playBtn.setAttribute("aria-label", "Pause");
            tr.classList.add("playing");
            currentPlayingAudio = a;
            setNowPlayingMetadata(row, a);
            setMediaPlaybackState("playing");
          } else {
            playBtn.innerHTML = PLAY_SVG;
            playBtn.setAttribute("aria-label", "Play");
            tr.classList.remove("playing");
            currentPlayingAudio = null;
            setNowPlayingMetadata(row, a);
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
          }
          stickyPlaybackResume = null;
        });
      })();
    }
  }

  var AUDIO_CACHE = "mq-audio";
  var DOWNLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m12 16l-5-5l1.4-1.45l2.6 2.6V4h2v8.15l2.6-2.6L17 11zm-6 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20z"/></svg>';
  var WHATSAPP_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.04 2.005c-5.52 0-10 4.48-10 10.002 0 1.76.46 3.47 1.34 4.98L2.05 22l5.08-1.34c1.46.8 3.12 1.23 4.91 1.23 5.52 0 10-4.48 10-10.002 0-2.67-1.04-5.18-2.93-7.07a9.95 9.95 0 0 0-7.07-2.893zm.03 17.92c-1.5 0-2.97-.4-4.25-1.15l-.3-.18-3.18.84.85-3.11-.2-.31a7.764 7.764 0 0 1-1.2-4.12c0-4.28 3.47-7.75 7.75-7.75 2.07 0 4.02.81 5.48 2.28a7.684 7.684 0 0 1 2.25 5.47c-.01 4.28-3.48 7.76-7.75 7.76zm4.26-4.51c-.24-.12-1.43-.7-1.66-.78-.22-.08-.39-.12-.56.12-.17.24-.64.78-.79.94-.15.16-.3.18-.54.06-.24-.12-1.02-.37-1.95-1.2-.72-.64-1.2-1.43-1.34-1.67-.15-.24-.02-.37.11-.49.12-.12.24-.27.37-.4.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.53-1.26-.73-1.73-.19-.46-.39-.39-.53-.41h-.45c-.15 0-.4.06-.61.3-.21.24-.81.79-.81 1.92s.83 2.23.94 2.39c.12.16 1.62 2.48 3.93 3.48.55.23.98.37 1.31.47.55.18 1.05.16 1.44.09.44-.07 1.42-.58 1.62-1.14.21-.56.21-1.03.15-1.13-.06-.1-.22-.16-.46-.28z"/></svg>';
  var PLAY_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14l11-7z"/></svg>';
  var PAUSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M14 19V5h4v14zm-8 0V5h4v14z"/></svg>';
  var SEEK_BACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="M11.99 5V1l-5 5l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6s-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8s-3.58-8-8-8"/><text x="12" y="16" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" font-family="sans-serif">5</text></svg>';
  var SEEK_FWD_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="M12.01 5V1l5 5l-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6s6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8s3.58-8 8-8"/><text x="12" y="16" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" font-family="sans-serif">5</text></svg>';

  function resolveUrl(url) {
    var a = document.createElement("a");
    a.href = url;
    return a.href;
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

  function buildWhatsAppShareBtn(row, src) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "audio-share-wa-btn";
    btn.innerHTML = WHATSAPP_SVG;
    btn.setAttribute("aria-label", "Share recording as file");
    btn.title = "Share recording with caption";

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (btn.disabled) return;

      var caption = [
        "Marifatul Quran — recording",
        "Para " + row.para + ", Ruku " + row.rukuInPara,
        row.surah + " — " + row.verses
      ].join("\n");

      function openWhatsAppText(msg) {
        var wa = "https://wa.me/?text=" + encodeURIComponent(msg);
        window.open(wa, "_blank", "noopener,noreferrer");
      }

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

      btn.disabled = true;
      var captionCopied = false;
      var captionCopyPromise = copyShareCaption(caption).then(function (copied) {
        captionCopied = copied;
        return copied;
      });

      fetchAudioBlobForShare(src).then(function (blob) {
        if (!blob || !blob.size) {
          btn.disabled = false;
          alert("Could not load the recording to share. Check your connection or save it offline first.");
          return;
        }

        var mime = blob.type && blob.type.indexOf("audio/") === 0 ? blob.type : audioMimeForShare(src);
        var file = new File([blob], recordingShareFilename(row, src), { type: mime });

        var canFileShare = typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });

        if (canFileShare) {
          return captionCopyPromise.then(function () {
            return navigator.share({
              text: caption,
              files: [file]
            });
          }).then(function () {
            if (captionCopied) {
              alert("Audio shared. If WhatsApp sends only the file, paste the copied caption in the chat.");
            }
          }).catch(function (err) {
            if (err && err.name === "AbortError") return;
            tryDownloadFileFallback(blob);
            alert(captionCopied
              ? "Could not open share. The recording was downloaded. Attach it in WhatsApp and paste the copied caption."
              : "Could not open share. The recording was downloaded—attach it in WhatsApp.");
          });
        }

        tryDownloadFileFallback(blob);
        return captionCopyPromise.then(function () {
          alert(captionCopied
            ? "The recording was downloaded. Send it in WhatsApp as an attachment, then paste the copied caption."
            : "The recording was downloaded. Open WhatsApp and send it as an attachment (Downloads / Files).");
        });
      }).catch(function () {
        captionCopyPromise.then(function () {
          alert(captionCopied
            ? "Could not share this file. Try Save offline, then share from your device and paste the copied caption."
            : "Could not share this file. Try Save offline, then share from your device.");
        });
      }).then(function () {
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

  togglePara.addEventListener("change", function () {
    setShowOnlyRecordedPara(this.checked);
    renderTable({ skipViewRestore: true });
  });

  toggleRuku.addEventListener("change", function () {
    setShowOnlyRecordedRuku(this.checked);
    renderTable({ skipViewRestore: true });
  });

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

  settingsBtn.addEventListener("click", openSettings);
  settingsCloseBtn.addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", closeSettings);

  document.getElementById("clear-cache-btn").addEventListener("click", function () {
    if (!confirm("This will reinstall the app with the latest version. All offline audio will need to be re-downloaded. Continue?")) return;
    var btn = this;
    btn.disabled = true;
    btn.textContent = "🔄 Reinstalling…";

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

    // 3. Clear localStorage and sessionStorage
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}

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
      // Redirect fresh; ?reinstall signals the install flow on next load
      var url = location.origin + location.pathname + "?reinstall=" + Date.now();
      location.replace(url);
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
      if (src && audioFileExists(src)) urls.push(src);
    });
    return urls;
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

  // Download current Para button
  var downloadParaBtn = document.getElementById("download-para-btn");
  downloadParaBtn.addEventListener("click", function () {
    if (!navigator.onLine) { alert("No internet connection."); return; }
    var para = parseInt(paraSelect.value, 10);
    var urls = getAudioUrlsForPara(para);
    if (!urls.length) { alert("No recordings in Para " + para + "."); return; }

    downloadParaBtn.disabled = true;
    downloadParaBtn.textContent = "⏳ 0/" + urls.length;

    downloadBatch(urls, function (done, total) {
      downloadParaBtn.textContent = "⏳ " + done + "/" + total;
    }).then(function () {
      downloadParaBtn.textContent = "✓ Para " + para + " saved";
      downloadParaBtn.disabled = false;
      renderTable();
      setTimeout(function () { downloadParaBtn.textContent = "📥 Download Para"; }, 3000);
    });
  });

  // Download All Paras button (in settings)
  var downloadAllBtn = document.getElementById("download-all-btn");
  var downloadAllStatus = document.getElementById("download-all-status");

  downloadAllBtn.addEventListener("click", function () {
    if (!navigator.onLine) { alert("No internet connection."); return; }

    var allUrls = [];
    for (var p = 1; p <= 30; p++) {
      allUrls = allUrls.concat(getAudioUrlsForPara(p));
    }
    if (!allUrls.length) { alert("No recordings found."); return; }
    if (!confirm("Download " + allUrls.length + " audio files for offline use?")) return;

    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = "⏳ Downloading…";
    downloadAllStatus.textContent = "0/" + allUrls.length;

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

  renderTable();
})();


