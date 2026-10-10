/**
 * The app's words, in English and Urdu, and the one helper that picks them.
 *
 *   I18N.t("card.play")                       -> "Play" / "سنیں"
 *   I18N.t("hifz.memorizedOf", { n: 2, total: 17 })
 *
 * app.js calls it as i18n(key, vars); `t` is too common a local name there to shadow.
 *
 * Markup carries keys instead of words: data-i18n (text), data-i18n-aria (aria-label),
 * data-i18n-title (title), data-i18n-placeholder (placeholder). apply() fills them, so a
 * language switch needs no reload. Urdu turns the page right-to-left; the Quran text and its
 * fonts are not this file's business.
 *
 * Loaded before app.js (and by player.html). Works in node too, for the tests.
 */
(function (root) {
  "use strict";

  var STRINGS = {
    en: {
      "admin.noToken": "No GitHub token set. Click ⚙ GitHub Token to configure.",
      "admin.uploadHttp": "{msg} (HTTP {status})",
      "admin.uploadFailedShort": "Upload failed",
      "admin.dismissAria": "Dismiss notification",
      "admin.dismiss": "Dismiss",
      "admin.upload": "⬆ Upload",
      "admin.uploading": "Uploading…",
      "admin.uploadSummary": "Para {para} · Ruku {ruku} ({surah})",
      "admin.uploadProgress": "Recording upload in progress — {summary}",
      "admin.uploadDone": "Recording uploaded successfully — {summary}",
      "admin.uploadError": "Upload failed — {summary}: {error}",
      "admin.validateTitle": "Mark recording as validated",
      "admin.validated": "✓ Validated",
      "admin.validate": "✓ Validate",

      "ayat.numAria": "Ayah {n}",
      "ayat.headSurah": "{surah} · {ref}",
      "ayat.countOne": "{n} ayah",
      "ayat.countMany": "{n} ayat",
      "ayat.promptRukuTitle": "Copy an AI grammar prompt for this ruku",
      "ayat.prompt": "AI prompt",
      "ayat.playFromTitle": "Play from this ayah",
      "ayat.playFromAria": "Play from ayah {n}",
      "ayat.glossToggleTitle": "Show or hide the meaning under each word",
      "ayat.glossToggleAria": "Word meanings for ayah {n}",
      "ayat.promptAyahTitle": "Copy an AI grammar prompt for this ayah",
      "ayat.promptAyahAria": "Copy AI prompt for ayah {n}",
      "ayat.copyFailed": "Could not copy. Try again.",

      "card.retry": "Retry",
      "card.retryTitle": "Clear the saved copy and load this recording again",
      "card.noRecording": "No recording",
      "card.ruku": "Ruku {n}",
      "card.ayah": "Ayah",
      "card.showAyatTitle": "Show the ayat of this ruku",
      "card.emptyPara": "No recordings in this Para",
      "card.play": "Play",
      "card.pause": "Pause",
      "card.seek": "Seek",
      "card.speed": "Playback speed",
      "card.back5": "Seek back 5 seconds",
      "card.fwd5": "Seek forward 5 seconds",
      "card.loadFailed": "Path Not found",
      "card.titleNarrow": "Para {para} · {ruku}",

      "dock.volume": "Volume",
      "dock.playPause": "Play or pause",
      "dock.locateTitle": "Scroll to current track in the list",
      "dock.locate": "Scroll to current track in list",
      "dock.idleTitle": "No track selected",
      "dock.idleMeta": "Play a recording from the list below.",
      "dock.title": "Para {para} · Ruku {ruku}",
      "dock.meta": "{surah} · {verses}",
      "dock.metaOtherPara": "{surah} · {verses} · Para {para}",

      "download.savedTitle": "Saved offline (tap to refresh)",
      "download.saveTitle": "Save for offline",
      "download.saveAria": "Save offline",
      "download.noInternet": "No internet connection. Cannot save for offline.",
      "download.redownloadConfirm": "Already saved offline. Re-download fresh copy?",
      "download.saving": "Saving…",
      "download.failed": "Could not save audio for offline use.",
      "download.offline": "No internet connection.",
      "download.noneInPara": "No recordings in Para {para}.",
      "download.progress": "Downloading {progress}…",
      "download.savedPara": "Saved · Para {para}",
      "download.checking": "⏳ Checking...",
      "download.preparing": "Preparing...",
      "download.noneFound": "No recordings found.",
      "download.allConfirm": "Download {n} audio files for offline use? ({cached} already cached)",
      "download.downloading": "⏳ Downloading…",
      "download.allSaved": "✓ All saved",
      "download.someFailed": "Saved {progress}. {failed} could not download — check your connection and tap download again.",
      "download.storageFull": "Storage is full. Free some space, then tap download again.",

      "guide.aria": "Guided walkthrough",
      "guide.stepOf": "Step {i} of {n}",
      "guide.skip": "Skip",
      "guide.next": "Next",
      "guide.done": "Got it",
      "guide.paraTitle": "Choose a Para (Juz)",
      "guide.paraBody": "Tap here to pick a Para from 1–30. Its rukus appear in the list below.",
      "guide.playTitle": "Play a recording",
      "guide.playBody": "Tap the play button on any ruku to listen. Use −5 / +5 to skip, or drag the bar to seek.",
      "guide.offlineTitle": "Download for offline",
      "guide.offlineBody": "Tap the download icon to save a ruku on your device. Once it's saved you can play it anytime, even without internet.",
      "guide.whatsappTitle": "Share on WhatsApp",
      "guide.whatsappBody": "Tap the WhatsApp icon to send a ruku to family or friends. Use the menu's “Share rukus” to send several at once.",
      "guide.hifzTitle": "Track memorization (Hifz)",
      "guide.hifzBody": "Tap the check on a ruku once you have it by heart; tap again to unmark it. The count beside it is how many times you have heard the recording through. The bar above the list shows your progress for this Para.",

      "header.pageTitle": "Marifatul Quran - Ruku Recordings",
      "header.title": "Marifatul Quran",
      "header.subtitle": "Ruku Recordings",

      "hifz.progressAria": "Para memorization progress",
      "hifz.markOnAria": "Memorized. Tap to unmark.",
      "hifz.markOffAria": "Not memorized. Tap to mark as memorized.",
      "hifz.markOnTitle": "Memorized",
      "hifz.markOffTitle": "Mark as memorized",
      "hifz.listenedOnce": "Listened {n} time in full",
      "hifz.listenedTimes": "Listened {n} times in full",
      "hifz.memorizedOf": "{n} of {total} rukus memorized",
      "hifz.overall": "{n} / {total} overall",
      "hifz.listenedOf": "{n} of {total} listened in full",
      "hifz.exported": "Exported {n} rukus.",
      "hifz.importBadJson": "Import failed: that file isn't valid JSON.",
      "hifz.imported": "Imported {n}, skipped {skipped} unknown.",
      "hifz.importUnreadable": "Import failed: couldn't read the file.",
      "hifz.resetConfirm": "Reset all memorization progress? This cannot be undone.",
      "hifz.resetDone": "Progress reset.",

      "install.app": "Install app",
      "install.headerTitle": "Install this app on your phone",
      "install.new": "New",
      "install.alreadyInstalled": "The app is already installed. Open it from your home screen or app drawer.\n\nTo reinstall, remove it first, then tap Install app again in the browser.",
      "install.ios": "To install on iOS:\n\n1. Tap the Share button 📤 at the bottom of Safari\n2. Tap “Add to Home Screen”\n3. Tap “Add”",
      "install.generic": "To install:\n\nIn Chrome: tap the menu (⋮) then “Add to Home Screen” or “Install app”\nIn Edge: tap the menu then “Apps → Install this site as an app”",
      "install.clearedIos": "App data cleared! To complete reinstallation:\n\n1. Go to your Home Screen and delete this app\n2. Open Safari and visit this page again\n3. Tap Share 📤 → “Add to Home Screen”",
      "install.clearedOther": "App data cleared! To complete reinstallation:\n\n1. Remove this app from your Home Screen / App drawer\n2. Open Chrome and visit this page again\n3. Tap Install App",

      "menu.menu": "Menu",
      "menu.downloadPara": "Download para",
      "menu.shareRukus": "Share rukus",
      "menu.shareRukusTitle": "Select rukus as tiles, then copy or share title + player link text (opaque link when available)",
      "menu.showGuide": "Show walkthrough",
      "menu.showGuideTitle": "Replay the first-run guided walkthrough",
      "menu.settings": "Settings",

      "notify.title": "Para {para} - {ruku}",
      "notify.artist": "{surah} | {verses}",
      "notify.swTitle": "Para {para} · Ruku {ruku}",
      "notify.pausedLine": "Paused · {surah} — {verses}",
      "notify.playingLine": "Playing · {surah} — {verses}",

      "para.selectLabel": "Para (Juz)",
      "para.prev": "Previous Para",
      "para.next": "Next Para",
      "para.select": "Select Para",
      "para.choose": "Choose a para",
      "para.colHifz": "Hifz",
      "para.colRuku": "Ruku #",
      "para.colSurah": "Surah",
      "para.colVerses": "Verses",
      "para.colArabic": "Arabic",
      "para.colAudio": "Audio",
      "para.colAction": "Action",
      "para.option": "Para {n} · {name}",
      "para.menuNum": "Para {n}",
      "para.pickerNum": "Para {n}",

      "player.pageTitle": "Quran Audio Player",
      "player.noTrack": "No track loaded",
      "player.seekBack": "Seek back {n} seconds",
      "player.seekBackShort": "-{n} seconds",
      "player.seekFwd": "Seek forward {n} seconds",
      "player.seekFwdShort": "+{n} seconds",
      "player.prev": "Previous",
      "player.next": "Next",
      "player.split": "✂ split",
      "player.noAudioPath": "No audio path is set for this ruku in data.",
      "player.loading": "Loading recording…",
      "player.loadError": "Could not load audio (offline or missing file). Open the main app and save offline, or try again online.",
      "player.trackLabel": "Para {para} · {ruku} — {surah} ({verses})",
      "player.docTitle": "MQ · {surah} ({ruku})",
      "player.loadedFromLink": "Loaded from link — drop more files to replace playlist",

      "settings.language": "Language",
      "settings.languageHint": "Buttons, titles and messages. The Quran text and its translation stay as they are.",
      "settings.title": "Settings",
      "settings.close": "Close",
      "settings.general": "General",
      "settings.role": "Role",
      "settings.user": "User",
      "settings.admin": "Admin",
      "settings.appearance": "Appearance",
      "settings.dark": "Dark",
      "settings.light": "Light",
      "settings.mushafSize": "Mushaf text size",
      "settings.smallerText": "Smaller mushaf text",
      "settings.largerText": "Larger mushaf text",
      "settings.reset": "Reset",
      "settings.mushafScript": "Mushaf script",
      "settings.uthmani": "Uthmani",
      "settings.indopak": "Indo-Pak",
      "settings.indopakNaskh": "Indo-Pak Naskh",
      "settings.mushafScriptNote": "Indo-Pak couldn't load — showing Uthmani. It will try again when you pick it.",
      "settings.ayat": "Ayat",
      "settings.wordMeanings": "Word meanings",
      "settings.experimental": "Experimental",
      "settings.wordTap": "When you tap a word",
      "settings.ayahWords": "Always, under each ayah",
      "settings.off": "Off",
      "settings.meaning": "Meaning",
      "settings.grammar": "+ Grammar",
      "settings.wordMeaningsHint": "Meaning: the Urdu. + Grammar: its parts and grammar too.",
      "settings.wordSound": "Play word sound on tap",
      "settings.wordSoundHint": "Says the word as quran.com recites it. Needs internet the first time.",
      "settings.glossSwitch": "Meaning switch on each ayah",
      "settings.glossSwitchHint": "A button by each ayah to hide or show its meanings, to test yourself.",
      "settings.translation": "Urdu translation (Maulana Maududi)",
      "settings.translationHint": "The whole ayah's meaning, under it.",
      "settings.playback": "Playback",
      "settings.afterRuku": "After ruku ends",
      "settings.stop": "Stop",
      "settings.loop": "Loop",
      "settings.nextRuku": "Next",
      "settings.defaultSpeed": "Default speed",
      "settings.volume": "Volume",
      "settings.lockScreen": "Lock screen notification",
      "settings.hifzProgress": "Hifz progress",
      "settings.hifzTracking": "Hifz tracking",
      "settings.hifzBackupHint": "Back up your memorization progress or move it to another device.",
      "settings.export": "Export",
      "settings.import": "Import",
      "settings.hifzReset": "Reset",
      "settings.storage": "Storage",
      "settings.downloadAll": "Download All Paras",
      "settings.clearCache": "Clear Cache",
      "settings.ghToken": "GitHub Token",
      "settings.ghTokenPlaceholder": "Paste token here…",
      "settings.notifUnsupported": "Notifications are not supported in this browser.",
      "settings.notifDenied": "Permission denied. Enable notifications for this site in your browser settings.",
      "settings.notifDefault": "Turn the option on and allow the prompt for best results on Android Chrome.",
      "settings.notifGranted": "Optional. Keeps a system notification while a track is open (playing or paused). Works best on Android Chrome; iOS is limited.",
      "settings.roleAdmin": "Admin",
      "settings.roleUser": "User",
      "settings.notifBlocked": "Notifications are blocked for this site. Enable them in your browser settings.",
      "settings.clearCacheConfirm": "Clear all cached data? Your current track position will be preserved. Offline audio will need to be re-downloaded.",
      "settings.clearing": "Clearing…",
      "settings.adminPassword": "Enter admin password:",
      "settings.wrongPassword": "Incorrect password.",

      "share.fileTitle": "Share as file",
      "share.close": "Close",
      "share.shareAll": "Share all recordings",
      "share.shareThis": "Share this ruku",
      "share.nextRuku": "Next ruku",
      "share.linksTitle": "Share ruku links",
      "share.selectAll": "Select all",
      "share.clear": "Clear",
      "share.listAria": "Rukus in this Para",
      "share.copyText": "Copy text",
      "share.share": "Share…",
      "share.rukuTitle": "P{para}: {ruku} — {surah} ({verses})",
      "share.loadFailed": "Could not load the recording to share. Check your connection or save it offline first.",
      "share.sharedPasteCaption": "Audio shared. If WhatsApp sends only the file, paste the copied caption in the chat.",
      "share.noSheetDownloadedCaption": "Could not open share. The recording was downloaded. Attach it in WhatsApp and paste the copied caption.",
      "share.noSheetDownloaded": "Could not open share. The recording was downloaded—attach it in WhatsApp.",
      "share.downloadedCaption": "The recording was downloaded. Send it in WhatsApp as an attachment, then paste the copied caption.",
      "share.downloaded": "The recording was downloaded. Open WhatsApp and send it as an attachment (Downloads / Files).",
      "share.fileFailedCaption": "Could not share this file. Try Save offline, then share from your device and paste the copied caption.",
      "share.fileFailed": "Could not share this file. Try Save offline, then share from your device.",
      "share.batchHeader": "Marifatul Quran — Para {para} ({n} recordings)",
      "share.loadRukuFailed": "Could not load {ruku}. Save offline first or check your connection.",
      "share.noMulti": "This browser or app cannot share multiple files in one step. Use \"Share this ruku\" and \"Next ruku\" for each recording.",
      "share.sharedFiles": "Shared {n} files. If the app only received attachments, paste the copied caption into the chat.",
      "share.allFailed": "Could not share all files at once. Try \"Share this ruku\" one at a time, or pick another app from the share sheet.",
      "share.loadAllFailed": "Could not load all recordings for sharing.",
      "share.waFile": "Share audio file on WhatsApp",
      "share.selectedOf": "{n} of {total} selected",
      "share.linksTitlePara": "Share ruku links · Para {para}",
      "share.noRukus": "No ruku rows for Para {para}.",
      "share.selectOne": "Select at least one ruku.",
      "share.copied": "Copied to clipboard.",
      "share.copyFailed": "Could not copy. Try Share again.",
      "share.sheetFailedCopied": "Share sheet failed — text was copied instead.",
      "share.shareCopyFailed": "Could not share or copy.",
      "share.copiedNoShare": "Copied (Share not supported on this browser).",
      "share.copyFailedShort": "Could not copy.",
      "share.fileProgress": "P{para} · ruku {n} of {total}",
      "share.lastRuku": "Last ruku",
      "share.nextRukuBtn": "Next ruku",
      "share.noRecordings": "No recordings to share for Para {para}. Save offline or check audio paths.",
      "share.fileTitlePara": "Share Para {para} as files",

      "timing.save": "Save to timings.js",
      "timing.start": "start",
      "timing.nowTitle": "Use the current playback position",
      "timing.hearTitle": "Play this ayah",
      "timing.hear": "hear",
      "timing.resetTitle": "Back to the generated time",
      "timing.reset": "reset",
      "timing.toCheck": "{n} to check",
      "timing.wasNow": "was {from}, now {to}",
      "timing.suggested": "suggested {time}",
      "timing.okTitle": "Heard it; the start is right",
      "timing.ok": "ok",
      "timing.toHearOne": "{n} ayah start to hear",
      "timing.toHearMany": "{n} ayah starts to hear",
      "timing.devServerDown": "Could not reach the dev server. Is scripts/serve.js running?",
      "timing.unsavedOne": "{n} start unsaved",
      "timing.unsavedMany": "{n} starts unsaved",
      "timing.saving": "Saving…",
      "timing.couldNotSave": "Could not save: {error}",
      "timing.serverError": "server error",
      "timing.moved": "{n} moved",
      "timing.placed": "{n} placed",
      "timing.noChanges": "no changes",
      "timing.savedOne": "Saved {what} in {n} ruku",
      "timing.savedMany": "Saved {what} in {n} rukus",
      "timing.skipped": "{note} (skipped {list})",
      "timing.reloading": "{note} — reloading…",

      "word.soundNeedsInternet": "Sound needs internet",
      "word.playSound": "Play word sound",
      "word.loading": "Loading…",
      "word.unavailable": "Meaning unavailable"
    },
    ur: {
      "admin.noToken": "GitHub ٹوکن نہیں ہے۔ ترتیبات میں ⚙ GitHub ٹوکن لگائیں۔",
      "admin.uploadHttp": "{msg} (HTTP {status})",
      "admin.uploadFailedShort": "اپ لوڈ نہیں ہو سکا",
      "admin.dismissAria": "پیغام بند کریں",
      "admin.dismiss": "بند کریں",
      "admin.upload": "⬆ اپ لوڈ",
      "admin.uploading": "اپ لوڈ ہو رہا ہے…",
      "admin.uploadSummary": "پارہ {para} · رکوع {ruku} ({surah})",
      "admin.uploadProgress": "ریکارڈنگ اپ لوڈ ہو رہی ہے — {summary}",
      "admin.uploadDone": "ریکارڈنگ اپ لوڈ ہو گئی — {summary}",
      "admin.uploadError": "اپ لوڈ نہیں ہو سکا — {summary}: {error}",
      "admin.validateTitle": "ریکارڈنگ کو جانچا ہوا نشان لگائیں",
      "admin.validated": "✓ جانچ لیا",
      "admin.validate": "✓ جانچیں",

      "ayat.numAria": "آیت {n}",
      "ayat.headSurah": "{surah} · {ref}",
      "ayat.countOne": "{n} آیت",
      "ayat.countMany": "{n} آیات",
      "ayat.promptRukuTitle": "اس رکوع کے قواعد کا AI پرامپٹ کاپی کریں",
      "ayat.prompt": "AI پرامپٹ",
      "ayat.playFromTitle": "اس آیت سے سنیں",
      "ayat.playFromAria": "آیت {n} سے سنیں",
      "ayat.glossToggleTitle": "ہر لفظ کے نیچے معنی دکھائیں یا چھپائیں",
      "ayat.glossToggleAria": "آیت {n} کے لفظی معنی",
      "ayat.promptAyahTitle": "اس آیت کے قواعد کا AI پرامپٹ کاپی کریں",
      "ayat.promptAyahAria": "آیت {n} کا AI پرامپٹ کاپی کریں",
      "ayat.copyFailed": "کاپی نہیں ہو سکا۔ دوبارہ کوشش کریں۔",

      "card.retry": "دوبارہ کوشش کریں",
      "card.retryTitle": "محفوظ کاپی ہٹا کر یہ ریکارڈنگ دوبارہ لوڈ کریں",
      "card.noRecording": "ریکارڈنگ نہیں",
      "card.ruku": "رکوع {n}",
      "card.ayah": "آیت",
      "card.showAyatTitle": "اس رکوع کی آیات دکھائیں",
      "card.emptyPara": "اس پارے میں کوئی ریکارڈنگ نہیں",
      "card.play": "سنیں",
      "card.pause": "روکیں",
      "card.seek": "آگے پیچھے کریں",
      "card.speed": "سننے کی رفتار",
      "card.back5": "5 سیکنڈ پیچھے",
      "card.fwd5": "5 سیکنڈ آگے",
      "card.loadFailed": "آڈیو نہیں ملی",
      "card.titleNarrow": "پارہ {para} · رکوع {ruku}",

      "dock.volume": "آواز",
      "dock.playPause": "سنیں یا روکیں",
      "dock.locateTitle": "فہرست میں چلتی ریکارڈنگ تک جائیں",
      "dock.locate": "فہرست میں چلتی ریکارڈنگ تک جائیں",
      "dock.idleTitle": "کوئی ریکارڈنگ منتخب نہیں",
      "dock.idleMeta": "نیچے کی فہرست سے کوئی ریکارڈنگ سنیں۔",
      "dock.title": "پارہ {para} · رکوع {ruku}",
      "dock.meta": "{surah} · آیات {verses}",
      "dock.metaOtherPara": "{surah} · آیات {verses} · پارہ {para}",

      "download.savedTitle": "آف لائن محفوظ (تازہ کرنے کے لیے ٹیپ کریں)",
      "download.saveTitle": "آف لائن کے لیے محفوظ کریں",
      "download.saveAria": "آف لائن محفوظ کریں",
      "download.noInternet": "انٹرنیٹ نہیں ہے۔ آف لائن کے لیے محفوظ نہیں ہو سکتا۔",
      "download.redownloadConfirm": "پہلے سے آف لائن محفوظ ہے۔ نئی کاپی دوبارہ ڈاؤن لوڈ کریں؟",
      "download.saving": "محفوظ ہو رہا ہے…",
      "download.failed": "آڈیو آف لائن کے لیے محفوظ نہیں ہو سکی۔",
      "download.offline": "انٹرنیٹ نہیں ہے۔",
      "download.noneInPara": "پارہ {para} میں کوئی ریکارڈنگ نہیں۔",
      "download.progress": "ڈاؤن لوڈ ہو رہا ہے {progress}…",
      "download.savedPara": "محفوظ · پارہ {para}",
      "download.checking": "⏳ جانچ ہو رہی ہے...",
      "download.preparing": "تیاری ہو رہی ہے...",
      "download.noneFound": "کوئی ریکارڈنگ نہیں ملی۔",
      "download.allConfirm": "آف لائن کے لیے {n} آڈیو فائلیں ڈاؤن لوڈ کریں؟ ({cached} پہلے سے محفوظ ہیں)",
      "download.downloading": "⏳ ڈاؤن لوڈ ہو رہا ہے…",
      "download.allSaved": "✓ سب محفوظ",
      "download.someFailed": "{progress} محفوظ ہوئیں۔ {failed} ڈاؤن لوڈ نہیں ہو سکیں — انٹرنیٹ دیکھیں اور دوبارہ ڈاؤن لوڈ دبائیں۔",
      "download.storageFull": "فون میں جگہ نہیں رہی۔ کچھ جگہ خالی کریں، پھر دوبارہ ڈاؤن لوڈ دبائیں۔",

      "guide.aria": "ایپ کا تعارف",
      "guide.stepOf": "{n} میں سے {i}",
      "guide.skip": "چھوڑیں",
      "guide.next": "اگلا",
      "guide.done": "ٹھیک ہے",
      "guide.paraTitle": "پارہ منتخب کریں",
      "guide.paraBody": "یہاں ٹیپ کر کے 1 سے 30 تک کوئی پارہ چنیں۔ اس کے رکوع نیچے فہرست میں آ جائیں گے۔",
      "guide.playTitle": "ریکارڈنگ سنیں",
      "guide.playBody": "کسی بھی رکوع کا پلے بٹن دبا کر سنیں۔ آگے پیچھے جانے کے لیے ⁦−5 / +5⁩ استعمال کریں، یا پٹی کو کھینچیں۔",
      "guide.offlineTitle": "آف لائن کے لیے ڈاؤن لوڈ کریں",
      "guide.offlineBody": "ڈاؤن لوڈ کا نشان دبا کر رکوع اپنے فون میں محفوظ کریں۔ محفوظ ہونے کے بعد آپ اسے کبھی بھی سن سکتے ہیں، انٹرنیٹ کے بغیر بھی۔",
      "guide.whatsappTitle": "واٹس ایپ پر شیئر کریں",
      "guide.whatsappBody": "واٹس ایپ کا نشان دبا کر رکوع گھر والوں یا دوستوں کو بھیجیں۔ ایک ساتھ کئی بھیجنے کے لیے مینو میں “رکوع شیئر کریں” استعمال کریں۔",
      "guide.hifzTitle": "حفظ کا حساب رکھیں",
      "guide.hifzBody": "رکوع یاد ہو جائے تو اس کا نشان دبائیں؛ ہٹانے کے لیے دوبارہ دبائیں۔ ساتھ والی گنتی بتاتی ہے کہ آپ نے ریکارڈنگ کتنی بار پوری سنی۔ فہرست کے اوپر کی پٹی اس پارے میں آپ کی پیش رفت دکھاتی ہے۔",

      "header.pageTitle": "معرفۃ القرآن - رکوع کی ریکارڈنگز",
      "header.title": "معرفۃ القرآن",
      "header.subtitle": "رکوع کی ریکارڈنگز",

      "hifz.progressAria": "پارے کے حفظ کی پیش رفت",
      "hifz.markOnAria": "حفظ ہو گیا۔ ہٹانے کے لیے ٹیپ کریں۔",
      "hifz.markOffAria": "حفظ نہیں ہوا۔ حفظ کا نشان لگانے کے لیے ٹیپ کریں۔",
      "hifz.markOnTitle": "حفظ",
      "hifz.markOffTitle": "حفظ کا نشان لگائیں",
      "hifz.listenedOnce": "{n} بار مکمل سنا",
      "hifz.listenedTimes": "{n} بار مکمل سنا",
      "hifz.memorizedOf": "{total} میں سے {n} رکوع حفظ",
      "hifz.overall": "تمام پاروں میں {total} میں سے {n}",
      "hifz.listenedOf": "{total} میں سے {n} مکمل سنے",
      "hifz.exported": "{n} رکوع ایکسپورٹ ہو گئے۔",
      "hifz.importBadJson": "امپورٹ نہیں ہو سکا: یہ فائل درست JSON نہیں ہے۔",
      "hifz.imported": "{n} امپورٹ ہوئے، {skipped} نامعلوم چھوڑ دیے۔",
      "hifz.importUnreadable": "امپورٹ نہیں ہو سکا: فائل پڑھی نہیں جا سکی۔",
      "hifz.resetConfirm": "حفظ کی ساری پیش رفت صاف کریں؟ اسے واپس نہیں لایا جا سکے گا۔",
      "hifz.resetDone": "پیش رفت صاف ہو گئی۔",

      "install.app": "ایپ انسٹال کریں",
      "install.headerTitle": "یہ ایپ اپنے فون پر انسٹال کریں",
      "install.new": "نیا",
      "install.alreadyInstalled": "ایپ پہلے سے انسٹال ہے۔ اسے ہوم اسکرین یا ایپس کی فہرست سے کھولیں۔\n\nدوبارہ انسٹال کرنے کے لیے پہلے اسے ہٹائیں، پھر براؤزر میں دوبارہ «ایپ انسٹال کریں» پر ٹیپ کریں۔",
      "install.ios": "آئی فون پر انسٹال کرنے کے لیے:\n\n1. سفاری میں نیچے شیئر بٹن 📤 پر ٹیپ کریں\n2. «Add to Home Screen» پر ٹیپ کریں\n3. «Add» پر ٹیپ کریں",
      "install.generic": "انسٹال کرنے کے لیے:\n\nکروم میں: مینو (⋮) پر ٹیپ کریں، پھر «Add to Home Screen» یا «Install app»\nایج میں: مینو پر ٹیپ کریں، پھر «Apps → Install this site as an app»",
      "install.clearedIos": "ایپ کا ڈیٹا صاف ہو گیا۔ دوبارہ انسٹال کرنے کے لیے:\n\n1. ہوم اسکرین سے یہ ایپ ہٹا دیں\n2. سفاری میں یہ صفحہ دوبارہ کھولیں\n3. شیئر 📤 ← «Add to Home Screen» پر ٹیپ کریں",
      "install.clearedOther": "ایپ کا ڈیٹا صاف ہو گیا۔ دوبارہ انسٹال کرنے کے لیے:\n\n1. ہوم اسکرین یا ایپس کی فہرست سے یہ ایپ ہٹا دیں\n2. کروم میں یہ صفحہ دوبارہ کھولیں\n3. «ایپ انسٹال کریں» پر ٹیپ کریں",

      "menu.menu": "مینو",
      "menu.downloadPara": "پارہ ڈاؤن لوڈ کریں",
      "menu.shareRukus": "رکوع شیئر کریں",
      "menu.shareRukusTitle": "رکوع منتخب کریں، پھر ان کا عنوان اور پلیئر لنک کاپی یا شیئر کریں",
      "menu.showGuide": "رہنمائی دوبارہ دیکھیں",
      "menu.showGuideTitle": "شروع والی رہنمائی دوبارہ دیکھیں",
      "menu.settings": "ترتیبات",

      "notify.title": "پارہ {para} - رکوع {ruku}",
      "notify.artist": "{surah} | {verses}",
      "notify.swTitle": "پارہ {para} · رکوع {ruku}",
      "notify.pausedLine": "رکا ہوا · {surah} — {verses}",
      "notify.playingLine": "چل رہا ہے · {surah} — {verses}",

      "para.selectLabel": "پارہ",
      "para.prev": "پچھلا پارہ",
      "para.next": "اگلا پارہ",
      "para.select": "پارہ منتخب کریں",
      "para.choose": "پارہ منتخب کریں",
      "para.colHifz": "حفظ",
      "para.colRuku": "رکوع نمبر",
      "para.colSurah": "سورت",
      "para.colVerses": "آیات",
      "para.colArabic": "عربی",
      "para.colAudio": "آڈیو",
      "para.colAction": "عمل",
      "para.option": "پارہ {n} · {name}",
      "para.menuNum": "پارہ {n}",
      "para.pickerNum": "پارہ {n}",

      "player.pageTitle": "قرآن آڈیو پلیئر",
      "player.noTrack": "کوئی ریکارڈنگ لوڈ نہیں",
      "player.seekBack": "{n} سیکنڈ پیچھے",
      "player.seekBackShort": "{n} سیکنڈ پیچھے",
      "player.seekFwd": "{n} سیکنڈ آگے",
      "player.seekFwdShort": "{n} سیکنڈ آگے",
      "player.prev": "پچھلا",
      "player.next": "اگلا",
      "player.split": "✂ تقسیم",
      "player.noAudioPath": "اس رکوع کی ریکارڈنگ ابھی شامل نہیں۔",
      "player.loading": "ریکارڈنگ لوڈ ہو رہی ہے…",
      "player.loadError": "ریکارڈنگ لوڈ نہیں ہو سکی (آف لائن ہیں یا فائل نہیں ملی)۔ اصل ایپ کھول کر آف لائن محفوظ کریں، یا انٹرنیٹ کے ساتھ دوبارہ کوشش کریں۔",
      "player.trackLabel": "پارہ {para} · رکوع {ruku} — {surah} (آیات {verses})",
      "player.docTitle": "MQ · {surah} (رکوع {ruku})",
      "player.loadedFromLink": "لنک سے لوڈ ہو گئی — فہرست بدلنے کے لیے اور فائلیں یہاں چھوڑیں",

      "settings.language": "زبان",
      "settings.languageHint": "بٹن، عنوان اور پیغامات۔ قرآن کا متن اور اس کا ترجمہ ویسے ہی رہیں گے۔",
      "settings.title": "ترتیبات",
      "settings.close": "بند کریں",
      "settings.general": "عام",
      "settings.role": "کردار",
      "settings.user": "صارف",
      "settings.admin": "ایڈمن",
      "settings.appearance": "ظاہری انداز",
      "settings.dark": "گہرا",
      "settings.light": "ہلکا",
      "settings.mushafSize": "مصحف کے حروف کا سائز",
      "settings.smallerText": "مصحف کا متن چھوٹا کریں",
      "settings.largerText": "مصحف کا متن بڑا کریں",
      "settings.reset": "اصل سائز",
      "settings.mushafScript": "مصحف کا خط",
      "settings.uthmani": "عثمانی",
      "settings.indopak": "انڈو پاک",
      "settings.indopakNaskh": "انڈو پاک نسخ",
      "settings.mushafScriptNote": "انڈو پاک لوڈ نہیں ہو سکا، اس لیے عثمانی دکھایا جا رہا ہے۔ دوبارہ چنیں گے تو پھر کوشش ہو گی۔",
      "settings.ayat": "آیات",
      "settings.wordMeanings": "لفظی معنی",
      "settings.experimental": "تجرباتی",
      "settings.wordTap": "لفظ پر ٹیپ کرنے پر",
      "settings.ayahWords": "ہمیشہ، ہر آیت کے نیچے",
      "settings.off": "بند",
      "settings.meaning": "معنی",
      "settings.grammar": "+ قواعد",
      "settings.wordMeaningsHint": "معنی: صرف اردو مطلب۔ + قواعد: ساتھ میں لفظ کے حصے اور ان کے قواعد بھی۔",
      "settings.wordSound": "ٹیپ کرنے پر لفظ کی آواز سنائیں",
      "settings.wordSoundHint": "لفظ ویسے سناتا ہے جیسے quran.com پر پڑھا گیا ہے۔ پہلی بار انٹرنیٹ چاہیے۔",
      "settings.glossSwitch": "ہر آیت پر معنی کا بٹن",
      "settings.glossSwitchHint": "ہر آیت کے ساتھ ایک بٹن، معنی چھپا کر یا دکھا کر خود کو جانچنے کے لیے۔",
      "settings.translation": "اردو ترجمہ (مولانا مودودی)",
      "settings.translationHint": "پوری آیت کا ترجمہ، اس کے نیچے۔",
      "settings.playback": "سننا",
      "settings.afterRuku": "رکوع ختم ہونے پر",
      "settings.stop": "رک جائے",
      "settings.loop": "دہرائے",
      "settings.nextRuku": "اگلا رکوع",
      "settings.defaultSpeed": "معمول کی رفتار",
      "settings.volume": "آواز",
      "settings.lockScreen": "لاک اسکرین پر نوٹیفکیشن",
      "settings.hifzProgress": "حفظ کی پیش رفت",
      "settings.hifzTracking": "حفظ کا ریکارڈ رکھیں",
      "settings.hifzBackupHint": "اپنے حفظ کی پیش رفت محفوظ کریں یا کسی دوسرے آلے پر لے جائیں۔",
      "settings.export": "ایکسپورٹ",
      "settings.import": "امپورٹ",
      "settings.hifzReset": "صاف کریں",
      "settings.storage": "اسٹوریج",
      "settings.downloadAll": "تمام پارے ڈاؤن لوڈ کریں",
      "settings.clearCache": "کیش صاف کریں",
      "settings.ghToken": "GitHub ٹوکن",
      "settings.ghTokenPlaceholder": "ٹوکن یہاں پیسٹ کریں…",
      "settings.notifUnsupported": "یہ براؤزر نوٹیفکیشن نہیں دکھا سکتا۔",
      "settings.notifDenied": "اجازت نہیں ملی۔ براؤزر کی ترتیبات میں اس سائٹ کے نوٹیفکیشن آن کریں۔",
      "settings.notifDefault": "اینڈرائیڈ کروم پر بہتر نتیجے کے لیے یہ آپشن آن کریں اور اجازت دیں۔",
      "settings.notifGranted": "اختیاری۔ ریکارڈنگ کھلی ہو (چل رہی ہو یا رکی ہو) تو فون پر نوٹیفکیشن رہتا ہے۔ اینڈرائیڈ کروم پر بہتر چلتا ہے؛ آئی او ایس پر محدود ہے۔",
      "settings.roleAdmin": "ایڈمن",
      "settings.roleUser": "صارف",
      "settings.notifBlocked": "اس سائٹ کے نوٹیفکیشن بند ہیں۔ براؤزر کی ترتیبات میں انہیں آن کریں۔",
      "settings.clearCacheConfirm": "سارا محفوظ ڈیٹا صاف کریں؟ موجودہ ریکارڈنگ کی جگہ محفوظ رہے گی۔ آف لائن آڈیو دوبارہ ڈاؤن لوڈ کرنی ہو گی۔",
      "settings.clearing": "صاف ہو رہا ہے…",
      "settings.adminPassword": "ایڈمن پاس ورڈ لکھیں:",
      "settings.wrongPassword": "پاس ورڈ غلط ہے۔",

      "share.fileTitle": "فائل کے طور پر شیئر کریں",
      "share.close": "بند کریں",
      "share.shareAll": "تمام ریکارڈنگز شیئر کریں",
      "share.shareThis": "یہ رکوع شیئر کریں",
      "share.nextRuku": "اگلا رکوع",
      "share.linksTitle": "رکوع کے لنک شیئر کریں",
      "share.selectAll": "سب منتخب کریں",
      "share.clear": "صاف کریں",
      "share.listAria": "اس پارے کے رکوع",
      "share.copyText": "متن کاپی کریں",
      "share.share": "شیئر کریں…",
      "share.rukuTitle": "پارہ {para}، رکوع {ruku} — {surah} ({verses})",
      "share.loadFailed": "شیئر کے لیے ریکارڈنگ لوڈ نہیں ہو سکی۔ انٹرنیٹ چیک کریں یا پہلے اسے آف لائن محفوظ کریں۔",
      "share.sharedPasteCaption": "آڈیو شیئر ہو گئی۔ اگر واٹس ایپ صرف فائل بھیجے تو کاپی کیا ہوا کیپشن چیٹ میں پیسٹ کریں۔",
      "share.noSheetDownloadedCaption": "شیئر نہیں کھل سکا۔ ریکارڈنگ ڈاؤن لوڈ ہو گئی ہے۔ اسے واٹس ایپ میں لگائیں اور کاپی کیا ہوا کیپشن پیسٹ کریں۔",
      "share.noSheetDownloaded": "شیئر نہیں کھل سکا۔ ریکارڈنگ ڈاؤن لوڈ ہو گئی ہے، اسے واٹس ایپ میں لگائیں۔",
      "share.downloadedCaption": "ریکارڈنگ ڈاؤن لوڈ ہو گئی ہے۔ اسے واٹس ایپ میں فائل کے طور پر بھیجیں، پھر کاپی کیا ہوا کیپشن پیسٹ کریں۔",
      "share.downloaded": "ریکارڈنگ ڈاؤن لوڈ ہو گئی ہے۔ واٹس ایپ کھولیں اور اسے فائل کے طور پر بھیجیں (ڈاؤن لوڈز / فائلز)۔",
      "share.fileFailedCaption": "یہ فائل شیئر نہیں ہو سکی۔ پہلے آف لائن محفوظ کریں، پھر اپنے فون سے شیئر کریں اور کاپی کیا ہوا کیپشن پیسٹ کریں۔",
      "share.fileFailed": "یہ فائل شیئر نہیں ہو سکی۔ پہلے آف لائن محفوظ کریں، پھر اپنے فون سے شیئر کریں۔",
      "share.batchHeader": "معرفۃ القرآن — پارہ {para} ({n} ریکارڈنگز)",
      "share.loadRukuFailed": "رکوع {ruku} لوڈ نہیں ہو سکا۔ پہلے آف لائن محفوظ کریں یا انٹرنیٹ چیک کریں۔",
      "share.noMulti": "یہ براؤزر یا ایپ ایک ساتھ کئی فائلیں شیئر نہیں کر سکتی۔ ہر ریکارڈنگ کے لیے \"یہ رکوع شیئر کریں\" اور \"اگلا رکوع\" استعمال کریں۔",
      "share.sharedFiles": "{n} فائلیں شیئر ہو گئیں۔ اگر ایپ کو صرف فائلیں ملیں تو کاپی کیا ہوا کیپشن چیٹ میں پیسٹ کریں۔",
      "share.allFailed": "ساری فائلیں ایک ساتھ شیئر نہیں ہو سکیں۔ \"یہ رکوع شیئر کریں\" سے ایک ایک کر کے بھیجیں، یا شیئر کی فہرست سے کوئی اور ایپ چنیں۔",
      "share.loadAllFailed": "شیئر کے لیے ساری ریکارڈنگز لوڈ نہیں ہو سکیں۔",
      "share.waFile": "آڈیو فائل واٹس ایپ پر شیئر کریں",
      "share.selectedOf": "{total} میں سے {n} منتخب",
      "share.linksTitlePara": "رکوع کے لنک شیئر کریں · پارہ {para}",
      "share.noRukus": "پارہ {para} میں کوئی رکوع نہیں۔",
      "share.selectOne": "کم از کم ایک رکوع منتخب کریں۔",
      "share.copied": "کاپی ہو گیا۔",
      "share.copyFailed": "کاپی نہیں ہو سکا۔ دوبارہ شیئر کریں۔",
      "share.sheetFailedCopied": "شیئر نہیں کھل سکا — اس کی جگہ متن کاپی ہو گیا۔",
      "share.shareCopyFailed": "نہ شیئر ہو سکا نہ کاپی۔",
      "share.copiedNoShare": "کاپی ہو گیا (اس براؤزر میں شیئر نہیں ہو سکتا)۔",
      "share.copyFailedShort": "کاپی نہیں ہو سکا۔",
      "share.fileProgress": "پارہ {para} · {total} میں سے رکوع {n}",
      "share.lastRuku": "آخری رکوع",
      "share.nextRukuBtn": "اگلا رکوع",
      "share.noRecordings": "پارہ {para} میں شیئر کے لیے کوئی ریکارڈنگ نہیں۔ آف لائن محفوظ کریں یا آڈیو فائلیں چیک کریں۔",
      "share.fileTitlePara": "پارہ {para} فائلوں کے طور پر شیئر کریں",

      "timing.save": "timings.js میں محفوظ کریں",
      "timing.start": "آغاز",
      "timing.nowTitle": "ابھی چلنے والی جگہ لیں",
      "timing.hearTitle": "یہ آیت سنیں",
      "timing.hear": "سنیں",
      "timing.resetTitle": "بنایا گیا وقت واپس لائیں",
      "timing.reset": "واپس",
      "timing.toCheck": "{n} جانچنے ہیں",
      "timing.wasNow": "پہلے {from}، اب {to}",
      "timing.suggested": "تجویز {time}",
      "timing.okTitle": "سن لیا؛ آغاز درست ہے",
      "timing.ok": "ٹھیک ہے",
      "timing.toHearOne": "{n} آیت کا آغاز سننا ہے",
      "timing.toHearMany": "{n} آیات کے آغاز سننے ہیں",
      "timing.devServerDown": "ڈیو سرور سے رابطہ نہیں ہو سکا۔ کیا scripts/serve.js چل رہا ہے؟",
      "timing.unsavedOne": "{n} آغاز محفوظ نہیں",
      "timing.unsavedMany": "{n} آغاز محفوظ نہیں",
      "timing.saving": "محفوظ ہو رہا ہے…",
      "timing.couldNotSave": "محفوظ نہیں ہو سکا: {error}",
      "timing.serverError": "سرور کی خرابی",
      "timing.moved": "{n} بدلے",
      "timing.placed": "{n} نئے لگائے",
      "timing.noChanges": "کوئی تبدیلی نہیں",
      "timing.savedOne": "{n} رکوع میں محفوظ: {what}",
      "timing.savedMany": "{n} رکوع میں محفوظ: {what}",
      "timing.skipped": "{note} ({list} چھوڑ دیے)",
      "timing.reloading": "{note} — دوبارہ لوڈ ہو رہا ہے…",

      "word.soundNeedsInternet": "آواز کے لیے انٹرنیٹ چاہیے",
      "word.playSound": "لفظ کی آواز سنیں",
      "word.loading": "لوڈ ہو رہا ہے…",
      "word.unavailable": "معنی دستیاب نہیں"
    }
  };

  var LANG_KEY = "ui_lang";
  var LANGS = ["en", "ur"];

  function readLang() {
    if (!root.document) return "en";
    try {
      return root.localStorage && root.localStorage.getItem(LANG_KEY) === "ur" ? "ur" : "en";
    } catch (e) {
      return "en";
    }
  }

  var lang = readLang();

  /** Warn about a missing word only where someone can act on it: a local run. */
  function devWarn(msg) {
    var loc = root.location;
    if (!loc || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(loc.hostname)) return;
    if (root.console) root.console.warn(msg);
  }

  /**
   * In right-to-left text a number range turns round: "1–7" shows as "7–1". A value made of
   * digits and their punctuation ("1–7", "2:3", "0:42 / 2:33", "1.5x") is wrapped in a
   * left-to-right isolate when the page is Urdu.
   */
  var NUMERIC = /^[0-9][0-9\s\u2013\-:/.,x\u00d7%+]*$/;

  function isolate(v) {
    return lang === "ur" && NUMERIC.test(v) ? "\u2066" + v + "\u2069" : v;
  }

  function t(key, vars) {
    var s = STRINGS[lang][key];
    if (s == null) {
      s = STRINGS.en[key];
      devWarn(s == null ? "i18n: unknown key " + key : "i18n: no " + lang + " text for " + key);
      if (s == null) return key;
    }
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? isolate(String(vars[k])) : m; });
    }
    return s;
  }

  var ATTRS = [
    ["data-i18n-aria", "aria-label"],
    ["data-i18n-title", "title"],
    ["data-i18n-placeholder", "placeholder"]
  ];

  /** Fill every keyed element under `scope` (the whole document by default). */
  function apply(scope) {
    var doc = root.document;
    if (!doc) return;
    scope = scope || doc;
    Array.prototype.forEach.call(scope.querySelectorAll("[data-i18n]"), function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    ATTRS.forEach(function (pair) {
      Array.prototype.forEach.call(scope.querySelectorAll("[" + pair[0] + "]"), function (el) {
        el.setAttribute(pair[1], t(el.getAttribute(pair[0])));
      });
    });
    if (scope === doc) {
      var title = doc.querySelector("title[data-i18n]");
      if (title) doc.title = title.textContent;
    }
  }

  /** <html lang dir>: Urdu reads right to left, and the layout mirrors with it. */
  function applyDocumentLang() {
    var html = root.document && root.document.documentElement;
    if (!html) return;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", lang === "ur" ? "rtl" : "ltr");
  }

  function setLang(next) {
    if (LANGS.indexOf(next) < 0 || next === lang) return;
    lang = next;
    try { root.localStorage.setItem(LANG_KEY, next); } catch (e) { /* private mode: this visit only */ }
    applyDocumentLang();
    apply();
    if (root.document && typeof root.CustomEvent === "function") {
      root.document.dispatchEvent(new root.CustomEvent("mq:langchange", { detail: { lang: next } }));
    }
  }

  var api = {
    t: t,
    apply: apply,
    setLang: setLang,
    lang: function () { return lang; },
    strings: STRINGS
  };
  root.I18N = api;

  // In a page: fill the markup now (this script sits after it) and show the page, which the
  // inline head script hid for Urdu readers so English never flashes first.
  if (root.document) {
    try {
      applyDocumentLang();
      apply();
    } finally {
      root.document.documentElement.classList.remove("i18n-pending");
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
