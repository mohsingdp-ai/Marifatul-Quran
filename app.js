(function () {
  "use strict";

  const tbody = document.getElementById("ruku-tbody");
  const paraSelect = document.getElementById("para-select");
  const actionHeader = document.querySelector("#ruku-table thead th:last-child");

  if (!tbody || typeof QURAN_DATA === "undefined") return;

  // Data from QURAN_DATA (no persistence, no editing)
  var data = JSON.parse(JSON.stringify(QURAN_DATA));
  var sessionBlobUrls = {};
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

  function getAudioSrc(row, globalIndex) {
    return sessionBlobUrls[globalIndex] || normalizeAudioPath(row.audioUrl);
  }

  // Set of existing audio filenames — fetched once from GitHub API
  var audioFileSet = null;
  var audioFileSetPromise = null;
  var audioFetchFailed = false;
  var allParaOptions = null; // cached for iOS option.hidden fix

  // Local run: which paras have at least one local file (probed by loading first file per para)
  var localParaHasAudio = {};
  var localParaProbeDone = false;
  var localParaProbePromise = null;

  function fetchAudioFileList() {
    if (audioFileSetPromise) return audioFileSetPromise;
    var baseUrl = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO +
                  "/contents/audio?ref=" + GITHUB_BRANCH;
    audioFileSetPromise = fetch(baseUrl, { headers: authHeader() })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (items) {
        var set = {};
        // Support both flat (files in audio/) and para-wise (files in audio/1/, audio/2/, ...)
        var dirPromises = [];
        items.forEach(function (f) {
          if (f.type === "file") {
            set[f.name] = true;
          } else if (f.type === "dir") {
            var dirUrl = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO +
                         "/contents/audio/" + encodeURIComponent(f.name) + "?ref=" + GITHUB_BRANCH;
            dirPromises.push(
              fetch(dirUrl, { headers: authHeader() })
                .then(function (res) { return res.ok ? res.json() : []; })
                .then(function (subFiles) {
                  subFiles.forEach(function (sf) {
                    if (sf.type === "file") set[f.name + "/" + sf.name] = true;
                  });
                })
            );
          }
        });
        return Promise.all(dirPromises).then(function () {
          if (Object.keys(set).length === 0 && dirPromises.length > 0) {
            audioFetchFailed = true;
          }
          audioFileSet = set;
          return set;
        });
      })
      .catch(function () {
        audioFetchFailed = true;
        audioFileSet = {};
        return audioFileSet;
      });
    return audioFileSetPromise;
  }

  function isLocalRun() {
    return window.location.protocol === "file:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
  }

  function probeLocalParas() {
    if (localParaProbePromise) return localParaProbePromise;
    var paras = [];
    var p;
    for (p = 1; p <= 30; p++) {
      if (indexedData[p] && indexedData[p].length > 0) paras.push(p);
    }
    localParaProbePromise = Promise.all(paras.map(function (para) {
      var first = indexedData[para][0];
      var url = normalizeAudioPath(first.row.audioUrl);
      if (!url || (url.indexOf("audio/") !== 0 && url.indexOf("./audio/") !== 0)) {
        localParaHasAudio[para] = false;
        return Promise.resolve();
      }
      return new Promise(function (resolve) {
        var a = new Audio();
        var resolved = false;
        function finish() {
          if (resolved) return;
          resolved = true;
          a.removeEventListener("canplay", onOk);
          a.removeEventListener("error", onErr);
          resolve();
        }
        function onOk() {
          localParaHasAudio[para] = true;
          finish();
        }
        function onErr() {
          localParaHasAudio[para] = false;
          finish();
        }
        a.addEventListener("canplay", onOk);
        a.addEventListener("error", onErr);
        a.src = url;
        a.load();
        setTimeout(function () {
          if (localParaHasAudio[para] === undefined) localParaHasAudio[para] = false;
          finish();
        }, 3000);
      });
    })).then(function () {
      localParaProbeDone = true;
      return localParaHasAudio;
    });
    return localParaProbePromise;
  }

  function audioFileExists(audioPath) {
    if (!audioPath) return false;
    // When running locally (file:// or localhost), treat relative audio paths as present so the player is shown
    if (isLocalRun() && (audioPath.indexOf("audio/") === 0 || audioPath.indexOf("./audio/") === 0)) return true;
    var name = audioPath.replace(/^audio\//, "");
    return audioFileSet ? !!audioFileSet[name] : false;
  }

  function showNoRecording(audioCell) {
    var span = document.createElement("span");
    span.className = "no-recording";
    span.textContent = "No recording";
    audioCell.appendChild(span);
  }

  function buildRow(item, canUpload) {
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
      "<td class=\"col-surah-arabic\" data-label=\"Surah # & Arabic\">" + escapeHtml(surahArabicCell) + "</td>" +
      "<td class=\"col-audio audio-cell\" data-label=\"Audio\"></td>" +
      (canUpload ? "<td class=\"action-cell\" data-label=\"Action\"></td>" : "");

    var audioCell = tr.querySelector(".audio-cell");
    var actionCell = canUpload ? tr.querySelector(".action-cell") : null;

    if (audioSrc && (sessionBlobUrls[globalIndex] || audioFileExists(audioSrc))) {
      buildAudioPlayer(tr, audioCell, row, audioSrc, clearPlayingClass);
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
    if (isLocalRun() && localParaProbeDone) return localParaHasAudio[item.row.para] === true;
    var audioSrc = getAudioSrc(item.row, item.globalIndex);
    return audioSrc && audioFileExists(audioSrc);
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
        if (isLocalRun()) {
          show = localParaProbeDone && localParaHasAudio[para] === true;
        } else if (audioFileSet && !audioFetchFailed) {
          var items = indexedData[para] || [];
          show = items.some(hasRecording);
        }
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

  function renderTable() {
    var canUpload = hasGitHubToken();
    var filterRuku = getShowOnlyRecordedRuku();

    if (!audioFileSet && !isLocalRun()) {
      tbody.textContent = "";
      var loadingTr = document.createElement("tr");
      loadingTr.innerHTML = "<td colspan=\"6\" style=\"text-align:center;padding:1rem;\">Loading…</td>";
      tbody.appendChild(loadingTr);
      fetchAudioFileList().then(function () { renderTable(); });
      return;
    }

    if (isLocalRun() && !localParaProbeDone) {
      if (!localParaProbePromise) localParaProbePromise = probeLocalParas();
      tbody.textContent = "";
      var probeTr = document.createElement("tr");
      probeTr.innerHTML = "<td colspan=\"6\" style=\"text-align:center;padding:1rem;\">Checking local files…</td>";
      tbody.appendChild(probeTr);
      localParaProbePromise.then(function () {
        renderTable();
      });
      return;
    }

    // Update para select first so any para jump happens before getFilteredData reads the value
    updateParaSelect();

    var filtered = getFilteredData();

    if (filterRuku && (isLocalRun() ? localParaProbeDone : !audioFetchFailed)) {
      filtered = filtered.filter(hasRecording);
    }

    var fragment = document.createDocumentFragment();
    tbody.textContent = "";
    setActionColumnVisibility(canUpload);

    filtered.forEach(function (item) {
      fragment.appendChild(buildRow(item, canUpload));
    });

    if (filtered.length === 0) {
      var emptyTr = document.createElement("tr");
      emptyTr.innerHTML = "<td colspan=\"6\" style=\"text-align:center;padding:1rem;color:#555;\">No recordings in this Para</td>";
      fragment.appendChild(emptyTr);
    }

    tbody.appendChild(fragment);
  }

  function positionPathTooltip(tr) {
    var rect = tr.getBoundingClientRect();
    pathTooltip.style.left = rect.left + "px";
    pathTooltip.style.top = (rect.top - 6) + "px";
    pathTooltip.style.transform = "translateY(-100%)";
  }

  function buildAudioPlayer(tr, audioCell, row, src, clearPlayingFn) {
    var audio = null;

    function ensureAudioElement() {
      if (audio) return audio;
      audio = document.createElement("audio");
      audio.preload = "none";
      audio.controls = false;
      audio.src = src;
      audio.load();

      audio.addEventListener("play", function () {
        playBtn.textContent = "❚❚";
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
        playBtn.textContent = "▶";
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
        playBtn.textContent = "▶";
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
    playBtn.innerHTML = "▶";

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
    seekBackBtn.textContent = "-5";
    seekBackBtn.setAttribute("aria-label", "Seek back 5 seconds");

    seekBackBtn.addEventListener("click", function () {
      var a = ensureAudioElement();
      a.currentTime = Math.max(0, a.currentTime - 5);
    });

    var seekFwdBtn = document.createElement("button");
    seekFwdBtn.type = "button";
    seekFwdBtn.className = "audio-seek-btn audio-seek-fwd-btn";
    seekFwdBtn.textContent = "+5";
    seekFwdBtn.setAttribute("aria-label", "Seek forward 5 seconds");

    seekFwdBtn.addEventListener("click", function () {
      var a = ensureAudioElement();
      a.currentTime = Math.min(a.duration || a.currentTime, a.currentTime + 5);
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
      if (a.duration && isFinite(a.duration)) {
        a.currentTime = (pct / 100) * a.duration;
      }
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

    audioCell.appendChild(wrap);
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

  paraSelect.addEventListener("change", renderTable);

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

  // GitHub API config (also used by fetchAudioFileList above)

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
  }

  togglePara.addEventListener("change", function () {
    setShowOnlyRecordedPara(this.checked);
    renderTable();
  });

  toggleRuku.addEventListener("change", function () {
    setShowOnlyRecordedRuku(this.checked);
    renderTable();
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

  settingsBtn.addEventListener("click", openSettings);
  settingsCloseBtn.addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", closeSettings);

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

  function buildUploadButton(actionCell, row, globalIndex) {
    if (!getGitHubToken()) return;
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "audio/ogg,audio/opus,audio/*";
    fileInput.style.display = "none";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-primary";
    btn.textContent = "⬆ Upload";
    btn.addEventListener("click", function () { fileInput.click(); });

    fileInput.addEventListener("change", function () {
      if (!this.files || !this.files[0]) return;
      var file = this.files[0];
      var ext = (file.name && file.name.indexOf(".") >= 0)
        ? "." + file.name.split(".").pop().toLowerCase()
        : ".ogg";
      if (ext !== ".ogg" && ext !== ".opus") ext = ".ogg";
      var targetName = row.para + "__" + row.rukuInPara + "__" + row.surah + ext;
      var filePath = "audio/" + row.para + "/" + targetName;
      var setKey = row.para + "/" + targetName;

      // Immediate playback via blob
      if (sessionBlobUrls[globalIndex]) URL.revokeObjectURL(sessionBlobUrls[globalIndex]);
      var blobUrl = URL.createObjectURL(file);
      sessionBlobUrls[globalIndex] = blobUrl;
      row.audioUrl = filePath;

      btn.disabled = true;
      btn.textContent = "Uploading…";

      fileToBase64(file).then(function (b64) {
        return uploadToGitHub(filePath, b64, "Add " + targetName);
      }).then(function () {
        btn.textContent = "✓ Done";
        btn.className = "btn btn-sm btn-primary";
        // Add to file set so player shows without re-fetching
        if (audioFileSet) audioFileSet[setKey] = true;
        renderTable();
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = "⬆ Upload";
        alert("Upload failed: " + err.message);
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

  renderTable();
})();


