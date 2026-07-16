package com.mohsingdp.marifatulquran.ui

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventTimeoutCancellationException
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.mohsingdp.marifatulquran.R
import com.mohsingdp.marifatulquran.core.DownloadStatus
import com.mohsingdp.marifatulquran.core.HifzEntry
import com.mohsingdp.marifatulquran.core.HifzState
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.data.Prefs
import com.mohsingdp.marifatulquran.download.DownloadForegroundService
import com.mohsingdp.marifatulquran.download.DownloadRegistry
import com.mohsingdp.marifatulquran.download.Downloader
import com.mohsingdp.marifatulquran.playback.PlayerController
import com.mohsingdp.marifatulquran.ui.theme.LocalMqColors
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val SPEEDS = listOf(0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f)

/**
 * Build the WhatsApp audio-share intent for these rukus, staging each file in the cache under a
 * human-readable name (e.g. "An-Nisa Ruku 1 (24–25).opus"). Returns null if no audio is available
 * locally (caller should fall back to a text share). The caller adds setPackage / chooser.
 */
private fun buildAudioShareIntent(context: Context, downloader: Downloader, rukus: List<Ruku>): Intent? {
    val authority = "${context.packageName}.fileprovider"
    val shareDir = File(context.cacheDir, "shared").apply { mkdirs() }
    val uris = ArrayList<Uri>()
    for (r in rukus) {
        val src = downloader.localFile(r)
        if (!src.exists() || src.length() == 0L) continue
        val dst = File(shareDir, shareFileName(r))
        try {
            src.copyTo(dst, overwrite = true)
            uris.add(FileProvider.getUriForFile(context, authority, dst))
        } catch (e: Exception) {
            // Skip files we can't stage.
        }
    }
    if (uris.isEmpty()) return null
    return (if (uris.size == 1) {
        Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
    } else {
        Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
    }).apply {
        type = "audio/*"
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
}

/** Share caption WITHOUT the deep link — just the human-readable reference. */
private fun shareText(ruku: Ruku): String =
    "P${ruku.para}: ${ruku.rukuInPara} — ${ruku.surah} (${ruku.verses})"

/** Filesystem-safe, human-readable share name: "{surah} Ruku {n} ({verses}).{ext}". */
private fun shareFileName(ruku: Ruku): String {
    val ext = ruku.audioUrl.substringAfterLast('.', "ogg")
    val rukuNo = ruku.rukuInPara.replace("R", "Ruku ")
    val raw = "${ruku.surah} $rukuNo (${ruku.verses})"
    val safe = raw.replace(Regex("[\\\\/:*?\"<>|]"), "-")
    return "$safe.$ext"
}

/** Copy the share caption to the clipboard so the user can paste it alongside the shared audio. */
private fun copyShareText(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("Ruku reference", text))
    Toast.makeText(context, "Reference copied — paste it in the chat", Toast.LENGTH_SHORT).show()
}

private fun shareTextToWhatsApp(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    try {
        context.startActivity(send.setPackage("com.whatsapp"))
    } catch (e: ActivityNotFoundException) {
        context.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text),
                "Share",
            )
        )
    }
}

/**
 * Single-screen Ruku Recordings UI, matching the web PWA: gradient header, a toolbar card
 * (Para dropdown + overflow menu + now-playing mini-player), and a list of ruku cards that each
 * carry inline audio controls bound to the single shared [PlayerController].
 */
@Composable
fun BrowseScreen(
    vm: BrowseViewModel,
    controller: PlayerController,
    prefs: Prefs,
    downloader: Downloader,
    downloadStatusMap: Map<Ruku, DownloadStatus>,
    scope: CoroutineScope,
    selectedPara: Int,
    onSelectPara: (Int) -> Unit,
    playingPara: Int,
    onPlayingParaChange: (Int) -> Unit,
    onOpenSettings: () -> Unit,
    hifzEntries: Map<Ruku, HifzEntry>,
    onHifzTap: (Ruku) -> Unit,
    onHifzRevision: (Ruku) -> Unit,
    showGuide: Boolean = false,
    onShowGuide: () -> Unit = {},
    onGuideFinished: () -> Unit = {},
) {
    val mq = LocalMqColors.current
    val context = LocalContext.current
    val ui by controller.state.collectAsState()
    val listState = rememberLazyListState()
    val uiScope = rememberCoroutineScope()
    // Seed the speed control from the saved default (mirrors the web's getDefaultSpeed()).
    var speed by remember { mutableFloatStateOf(prefs.getDefaultSpeed()) }
    // WhatsApp share affordances are hidden when the user turns the setting off. Re-read on each
    // composition so returning from Settings reflects a change immediately.
    val whatsAppShareEnabled = prefs.isWhatsAppShareEnabled()
    // Re-read on each composition so returning from Settings reflects the change immediately.
    val hifzEnabled = prefs.isHifzEnabled()

    // Captured screen rects of the walkthrough targets (Para dropdown, first card's
    // play / WhatsApp-share / download buttons).
    var paraRect by remember { mutableStateOf<Rect?>(null) }
    var playRect by remember { mutableStateOf<Rect?>(null) }
    var shareRect by remember { mutableStateOf<Rect?>(null) }
    var downloadRect by remember { mutableStateOf<Rect?>(null) }

    val rukus = vm.rukusFor(selectedPara)
    val activeRuku = if (playingPara != -1) {
        vm.rukusFor(playingPara).getOrNull(ui.currentIndex)
    } else null

    // True when the currently-playing card is itself visible in the list (same Para on screen
    // and its row is within the viewport). Used to suppress the redundant sticky now-playing bar.
    val onPlayingPara = selectedPara == playingPara
    val activeIndex = ui.currentIndex
    val activeCardInView by remember(onPlayingPara, activeIndex) {
        derivedStateOf {
            onPlayingPara && listState.layoutInfo.visibleItemsInfo.any { it.index == activeIndex }
        }
    }
    // Set when "locate" is tapped while viewing a different Para; the scroll runs once that Para
    // is on screen (the list contents have swapped).
    var pendingLocate by remember { mutableStateOf(false) }

    /** Load a ruku of the displayed player (does not auto-play). */
    fun activate(index: Int) {
        controller.setQueue(selectedPara, rukus, index)
        controller.setSpeed(speed)
        onPlayingParaChange(selectedPara)
    }

    // --- Bulk-selection share: ONE share action; each selected ruku is a separate block. ---
    var selectionMode by remember { mutableStateOf(false) }
    val selected = remember { mutableStateListOf<Ruku>() }
    // Rukus currently being prepared for share (fetching audio); their WhatsApp button shows a spinner.
    val sharingRukus = remember { mutableStateListOf<Ruku>() }
    // Selection is scoped to the current Para; reset it when the Para changes.
    LaunchedEffect(selectedPara) { selected.clear() }
    // Deferred "locate": once the Para switch from a sticky-bar tap has taken effect, scroll the
    // now-on-screen playing card to the top.
    LaunchedEffect(selectedPara) {
        if (pendingLocate && selectedPara == playingPara) {
            pendingLocate = false
            listState.animateScrollToItem(ui.currentIndex)
        }
    }
    /**
     * Share one or more rukus as audio file(s). The reference caption is copied to the clipboard so
     * the user can paste it alongside the audio. Any not-yet-downloaded ruku is fetched first (its
     * WhatsApp button shows a spinner) so there's always a file to attach.
     */
    fun shareRukus(items: List<Ruku>) {
        if (items.isEmpty()) return
        scope.launch {
            items.forEach { if (it !in sharingRukus) sharingRukus.add(it) }
            try {
                for (r in items) {
                    if (DownloadRegistry.statusOf(r) != DownloadStatus.Downloaded) {
                        DownloadForegroundService.enqueue(context, r)
                        // Wait for the background download to finish (or fail) before staging the file,
                        // but never hang the share spinner indefinitely if it stalls (fall through to
                        // the text-only share when buildAudioShareIntent finds no local file).
                        withTimeoutOrNull(120_000) {
                            DownloadRegistry.statuses.first {
                                val s = it[r]
                                s == DownloadStatus.Downloaded || s is DownloadStatus.Failed
                            }
                        }
                    }
                }
                val caption = items.joinToString("\n\n") { shareText(it) }
                val audioIntent = withContext(Dispatchers.IO) {
                    buildAudioShareIntent(context, downloader, items)
                }
                if (audioIntent == null) {
                    // Nothing downloaded — just share the text.
                    shareTextToWhatsApp(context, caption)
                    return@launch
                }
                // Copy the caption so the user can paste it with the audio, then share the audio once.
                copyShareText(context, caption)
                try {
                    context.startActivity(Intent(audioIntent).setPackage("com.whatsapp"))
                } catch (e: ActivityNotFoundException) {
                    // WhatsApp absent: fall back to the system chooser for the audio.
                    context.startActivity(Intent.createChooser(audioIntent, "Share"))
                }
            } finally {
                sharingRukus.removeAll(items)
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(mq.pageBg),
    ) {
        Header()

        // Sticky Para toolbar — stays put while the ruku list scrolls.
        Box(modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp)) {
            ToolbarCard(
                selectedPara = selectedPara,
                paras = vm.paras.map { it.para },
                onSelectPara = onSelectPara,
                paraDropdownModifier = Modifier.onGloballyPositioned { paraRect = it.boundsInRoot() },
                onDownloadPara = {
                    rukus.forEach { ruku ->
                        if (isDownloadable(downloadStatusMap[ruku])) {
                            DownloadForegroundService.enqueue(context, ruku)
                        }
                    }
                },
                onOpenSettings = onOpenSettings,
                onShowGuide = onShowGuide,
                onSelect = { selectionMode = true },
                showShare = whatsAppShareEnabled,
            )
        }

        // Per-Para memorization meter (hidden while bulk-selecting or when hifz is disabled).
        if (!selectionMode && hifzEnabled) {
            HifzMeter(
                para = selectedPara,
                paraRukus = rukus,
                entries = hifzEntries,
                overallTotal = vm.paras.sumOf { it.rukus.size },
            )
        }

        // Selection action bar (bulk share) — shown only in selection mode.
        if (selectionMode) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .border(1.dp, mq.border, RoundedCornerShape(8.dp))
                        .clickable { selectionMode = false; selected.clear() }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                ) { Text("Cancel", color = mq.textMuted, fontSize = 14.sp) }
                Text(
                    "${selected.size} selected",
                    color = mq.textPrimary,
                    fontSize = 14.sp,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                val canShare = selected.isNotEmpty()
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (canShare) mq.wa else mq.border)
                        .clickable(enabled = canShare) {
                            val toShare = selected.toList()
                            selectionMode = false
                            selected.clear()
                            shareRukus(toShare)
                        }
                        .padding(horizontal = 18.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Share (${selected.size})",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = 10.dp, end = 10.dp, top = 0.dp,
                // Clear the system navigation bar, plus extra room for the sticky now-playing bar
                // when a track is loaded — so the last card is never hidden behind either.
                bottom = (if (activeRuku != null) 96.dp else 10.dp) +
                    WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(),
            ),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            itemsIndexed(rukus) { index, ruku ->
                val isActive = selectedPara == playingPara && index == ui.currentIndex
                RukuCard(
                    ruku = ruku,
                    showHifz = hifzEnabled,
                    hifzEntry = hifzEntries[ruku],
                    onHifzTap = { onHifzTap(ruku) },
                    onHifzRevision = { onHifzRevision(ruku) },
                    isActive = isActive,
                    isPlaying = isActive && ui.isPlaying,
                    isBuffering = isActive && ui.isBuffering,
                    positionMs = if (isActive) ui.positionMs else 0L,
                    durationMs = if (isActive) ui.durationMs else 0L,
                    speed = speed,
                    downloadStatus = downloadStatusMap[ruku] ?: DownloadStatus.NotDownloaded,
                    onPlayToggle = {
                        if (isActive) {
                            if (ui.isPlaying) controller.pause() else controller.play()
                        } else {
                            activate(index)
                            controller.play()
                        }
                    },
                    onSeekBack = {
                        if (isActive) controller.seekTo((ui.positionMs - 5000).coerceAtLeast(0))
                        else activate(index)
                    },
                    onSeekFwd = {
                        if (isActive) controller.seekTo(ui.positionMs + 5000)
                        else activate(index)
                    },
                    onSeekTo = { f -> if (isActive) controller.seekTo((f * ui.durationMs).toLong()) },
                    onCycleSpeed = {
                        val next = SPEEDS[(SPEEDS.indexOf(speed).coerceAtLeast(0) + 1) % SPEEDS.size]
                        speed = next
                        if (isActive) controller.setSpeed(next)
                    },
                    onDownload = {
                        if (isDownloadable(downloadStatusMap[ruku])) {
                            DownloadForegroundService.enqueue(context, ruku)
                        }
                    },
                    onShare = { shareRukus(listOf(ruku)) },
                    isSharing = ruku in sharingRukus,
                    showShare = whatsAppShareEnabled,
                    selectionMode = selectionMode,
                    isSelected = selected.contains(ruku),
                    onToggleSelect = {
                        if (selected.contains(ruku)) selected.remove(ruku) else selected.add(ruku)
                    },
                    playButtonModifier = if (index == 0) {
                        Modifier.onGloballyPositioned { playRect = it.boundsInRoot() }
                    } else Modifier,
                    shareButtonModifier = if (index == 0) {
                        Modifier.onGloballyPositioned { shareRect = it.boundsInRoot() }
                    } else Modifier,
                    downloadButtonModifier = if (index == 0) {
                        Modifier.onGloballyPositioned { downloadRect = it.boundsInRoot() }
                    } else Modifier,
                )
            }
        }
    }

        // Sticky now-playing bar pinned to the bottom — shown only while a track is loaded AND
        // the playing card isn't already visible in the list (no point duplicating it on screen).
        if (activeRuku != null && !activeCardInView) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(horizontal = 10.dp),
            ) {
                NowPlayingCard(
                    activeRuku = activeRuku,
                    isPlaying = ui.isPlaying,
                    progress = fraction(ui.positionMs, ui.durationMs),
                    onToggle = { if (ui.isPlaying) controller.pause() else controller.play() },
                    onLocate = {
                        if (playingPara != -1) {
                            if (selectedPara == playingPara) {
                                // Already on the right Para — just scroll to the card.
                                uiScope.launch { listState.animateScrollToItem(ui.currentIndex) }
                            } else {
                                // Switch Para first; the scroll is deferred until the new list is
                                // on screen (see LaunchedEffect(selectedPara) below).
                                pendingLocate = true
                                onSelectPara(playingPara)
                            }
                        }
                    },
                )
            }
        }

        // First-run / replayable guided walkthrough overlay.
        if (showGuide) {
            LaunchedEffect(Unit) { listState.animateScrollToItem(0) }
            GuideOverlay(
                steps = buildList {
                    add(
                        GuideStep(
                            title = "Choose a Para (Juz)",
                            body = "Tap here to pick a Para from 1–30. Its rukus appear in the list below.",
                            target = paraRect,
                        )
                    )
                    add(
                        GuideStep(
                            title = "Play a recording",
                            body = "Tap the play button on any ruku card to listen. Use −5 / +5 to skip, or drag the bar to seek.",
                            target = playRect,
                        )
                    )
                    add(
                        GuideStep(
                            title = "Download for offline",
                            body = "Tap the download icon to save a ruku on your device. A ✓ means it's saved — play it anytime, even without internet.",
                            target = downloadRect,
                        )
                    )
                    if (whatsAppShareEnabled) {
                        add(
                            GuideStep(
                                title = "Share on WhatsApp",
                                body = "Tap the WhatsApp icon to send a ruku to family or friends. Use the ⋮ menu's “Select to share” to send several at once.",
                                target = shareRect,
                            )
                        )
                    }
                },
                onFinish = onGuideFinished,
            )
        }
    }
}

private fun isDownloadable(s: DownloadStatus?): Boolean =
    s != DownloadStatus.Downloaded && s != DownloadStatus.Downloading

private fun fraction(pos: Long, dur: Long): Float =
    if (dur > 0) (pos.toFloat() / dur).coerceIn(0f, 1f) else 0f

// ---------------------------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------------------------

@Composable
private fun Header() {
    val mq = LocalMqColors.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(mq.headerBrush)
                .padding(start = 24.dp, end = 24.dp, top = 14.dp, bottom = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "قرآن پاک",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = "رکوع ریکارڈنگ",
                color = Color.White.copy(alpha = 0.8f),
                fontSize = 13.sp,
            )
        }
        // Gold underline accent (header::after)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(3.dp)
                .background(
                    Brush.horizontalGradient(
                        listOf(Color.Transparent, mq.gold, Color.Transparent)
                    )
                )
        )
    }
}

// ---------------------------------------------------------------------------------------------
// Toolbar card: Para dropdown + overflow menu, with the now-playing mini-player below.
// ---------------------------------------------------------------------------------------------

@Composable
private fun ToolbarCard(
    selectedPara: Int,
    paras: List<Int>,
    onSelectPara: (Int) -> Unit,
    paraDropdownModifier: Modifier = Modifier,
    onDownloadPara: () -> Unit,
    onOpenSettings: () -> Unit,
    onShowGuide: () -> Unit,
    onSelect: () -> Unit,
    showShare: Boolean,
) {
    val mq = LocalMqColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, mq.border, RoundedCornerShape(8.dp))
            .background(mq.cardBg),
    ) {
        // Top row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(mq.rowGray)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val paraIndex = paras.indexOf(selectedPara)
            StepButton(
                iconRes = R.drawable.ic_chevron_left,
                contentDescription = "Previous Para",
                enabled = paraIndex > 0,
                onClick = { onSelectPara(paras[paraIndex - 1]) },
            )
            ParaDropdown(selectedPara, paras, onSelectPara, paraDropdownModifier.weight(1f))
            StepButton(
                iconRes = R.drawable.ic_chevron_right,
                contentDescription = "Next Para",
                enabled = paraIndex >= 0 && paraIndex < paras.lastIndex,
                onClick = { onSelectPara(paras[paraIndex + 1]) },
            )
            OverflowMenu(
                onDownloadPara = onDownloadPara,
                onOpenSettings = onOpenSettings,
                onShowGuide = onShowGuide,
                onSelect = onSelect,
                showShare = showShare,
            )
        }
    }
}

@Composable
private fun ParaDropdown(
    selectedPara: Int,
    paras: List<Int>,
    onSelectPara: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val mq = LocalMqColors.current
    val density = LocalDensity.current
    var open by remember { mutableStateOf(false) }
    // Width of the select field, so the dropdown can match it exactly.
    var fieldWidthPx by remember { mutableStateOf(0) }
    Box(modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .onGloballyPositioned { fieldWidthPx = it.size.width }
                .clip(RoundedCornerShape(6.dp))
                .border(1.dp, mq.border, RoundedCornerShape(6.dp))
                .background(mq.cardBg)
                .clickable { open = true }
                .padding(start = 12.dp, end = 10.dp, top = 10.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = "Para $selectedPara",
                color = mq.textPrimary,
                fontSize = 16.sp,
            )
            Icon(
                painter = painterResource(R.drawable.ic_chevron_down),
                contentDescription = null,
                tint = mq.textMuted,
                modifier = Modifier.size(20.dp),
            )
        }
        DropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            // Match the select's width + light border, and reset the menu's own vertical padding
            // so the border hugs the items.
            modifier = Modifier
                .width(with(density) { fieldWidthPx.toDp() })
                .clip(RoundedCornerShape(6.dp))
                .background(mq.cardBg)
                .border(1.dp, mq.border, RoundedCornerShape(6.dp))
                .heightIn(max = 360.dp),
        ) {
            paras.forEachIndexed { index, p ->
                val selected = p == selectedPara
                DropdownMenuItem(
                    modifier = Modifier.background(
                        if (selected) mq.tealAccent.copy(alpha = 0.15f) else Color.Transparent
                    ),
                    text = {
                        Text(
                            "Para $p",
                            color = if (selected) mq.tealAccent else mq.textPrimary,
                            fontSize = 15.sp,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    },
                    onClick = { onSelectPara(p); open = false },
                )
                if (index < paras.lastIndex) {
                    HorizontalDivider(thickness = 1.dp, color = mq.border.copy(alpha = 0.6f))
                }
            }
        }
    }
}

/** Small bordered chevron button to step the selected Para by one (disabled at the ends). */
@Composable
private fun StepButton(
    iconRes: Int,
    contentDescription: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val mq = LocalMqColors.current
    Box(
        modifier = Modifier
            .size(38.dp)
            .clip(RoundedCornerShape(6.dp))
            .border(1.dp, if (enabled) mq.border else mq.border.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
            .background(mq.cardBg)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(iconRes),
            contentDescription = contentDescription,
            tint = if (enabled) mq.tealAccent else mq.textMuted.copy(alpha = 0.4f),
            modifier = Modifier.size(22.dp),
        )
    }
}

@Composable
private fun OverflowMenu(
    onDownloadPara: () -> Unit,
    onOpenSettings: () -> Unit,
    onShowGuide: () -> Unit,
    onSelect: () -> Unit,
    showShare: Boolean,
) {
    val mq = LocalMqColors.current
    var open by remember { mutableStateOf(false) }
    Box {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(8.dp))
                .border(1.dp, mq.border, RoundedCornerShape(8.dp))
                .background(mq.cardBg)
                .clickable { open = true },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_menu_dots),
                contentDescription = "Menu",
                tint = mq.textPrimary,
                modifier = Modifier.size(20.dp),
            )
        }
        DropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            modifier = Modifier.background(mq.cardBg),
        ) {
            if (showShare) {
                MenuItem(R.drawable.ic_share, "Select to share") { onSelect(); open = false }
            }
            MenuItem(R.drawable.ic_download, "Download Para") { onDownloadPara(); open = false }
            MenuItem(R.drawable.ic_settings, "Settings") { onOpenSettings(); open = false }
            MenuItem(R.drawable.ic_locate, "Show Guide") { onShowGuide(); open = false }
        }
    }
}

/** A dropdown menu row with a leading teal icon. */
@Composable
private fun MenuItem(iconRes: Int, label: String, onClick: () -> Unit) {
    val mq = LocalMqColors.current
    DropdownMenuItem(
        text = { Text(label, color = mq.textPrimary, fontSize = 15.sp) },
        leadingIcon = {
            Icon(
                painter = painterResource(iconRes),
                contentDescription = null,
                tint = mq.tealAccent,
                modifier = Modifier.size(20.dp),
            )
        },
        onClick = onClick,
    )
}

// ---------------------------------------------------------------------------------------------
// Now-playing mini-player
// ---------------------------------------------------------------------------------------------

@Composable
private fun NowPlayingCard(
    activeRuku: Ruku?,
    isPlaying: Boolean,
    progress: Float,
    onToggle: () -> Unit,
    onLocate: () -> Unit,
) {
    val mq = LocalMqColors.current
    val hasTrack = activeRuku != null
    val title = activeRuku?.let { "Para ${it.para} · Ruku ${it.rukuInPara}" } ?: "No track selected"
    val meta = activeRuku?.let { "${it.surah} · ${it.verses}" } ?: "Play a recording from the list below."

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .border(
                1.dp,
                if (hasTrack) mq.tealAccent.copy(alpha = 0.45f) else mq.border,
                RoundedCornerShape(10.dp),
            )
            .background(if (hasTrack) mq.playingBg else mq.rowGray)
            // Tap anywhere on the bar to jump to the currently playing ruku.
            .clickable(enabled = hasTrack, onClick = onLocate),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Gold transport button when a track is loaded; teal otherwise.
            GradientCircleButton(
                size = 44.dp,
                brush = if (hasTrack) mq.goldButtonBrush else mq.tealButtonBrush,
                enabled = hasTrack,
                iconRes = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play,
                iconSize = 20.dp,
                contentDescription = "Play or pause",
                onClick = onToggle,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = mq.textPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = meta,
                    color = mq.textMuted,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            // Locate hint (whole bar is tappable to jump to the playing ruku).
            Icon(
                painter = painterResource(R.drawable.ic_locate),
                contentDescription = "Go to current track",
                tint = if (hasTrack) mq.tealAccent else mq.textMuted,
                modifier = Modifier.size(20.dp),
            )
        }
        // Progress bar pinned to the bottom edge.
        if (hasTrack) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(progress)
                    .height(3.dp)
                    .align(Alignment.BottomStart)
                    .background(mq.tealAccent)
            )
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Ruku card
// ---------------------------------------------------------------------------------------------

@Composable
private fun RukuCard(
    ruku: Ruku,
    showHifz: Boolean,
    hifzEntry: HifzEntry?,
    onHifzTap: () -> Unit,
    onHifzRevision: () -> Unit,
    isActive: Boolean,
    isPlaying: Boolean,
    isBuffering: Boolean,
    positionMs: Long,
    durationMs: Long,
    speed: Float,
    downloadStatus: DownloadStatus,
    onPlayToggle: () -> Unit,
    onSeekBack: () -> Unit,
    onSeekFwd: () -> Unit,
    onSeekTo: (Float) -> Unit,
    onCycleSpeed: () -> Unit,
    onDownload: () -> Unit,
    onShare: () -> Unit,
    isSharing: Boolean,
    showShare: Boolean,
    selectionMode: Boolean,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    playButtonModifier: Modifier = Modifier,
    shareButtonModifier: Modifier = Modifier,
    downloadButtonModifier: Modifier = Modifier,
) {
    val mq = LocalMqColors.current
    // "R1" -> "Ruku 1", "R16+" -> "Ruku 16+", "R1-R2" -> "Ruku 1-2"
    val rukuLabel = "Ruku " + ruku.rukuInPara.replace("R", "")
    val highlighted = isActive || (selectionMode && isSelected)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .border(
                1.dp,
                if (highlighted) mq.tealAccent else mq.border,
                RoundedCornerShape(10.dp),
            )
            .background(if (highlighted) mq.playingBg else mq.cardBg)
            .then(if (selectionMode) Modifier.clickable { onToggleSelect() } else Modifier)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        // Header (always shown): play/pause (or checkbox) • 2-line title + Arabic • actions.
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (selectionMode) {
                SelectionCheck(selected = isSelected)
            } else {
                Box(modifier = playButtonModifier.size(44.dp), contentAlignment = Alignment.Center) {
                    GradientCircleButton(
                        size = 44.dp,
                        brush = if (isActive) mq.goldButtonBrush else mq.tealButtonBrush,
                        enabled = true,
                        iconRes = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play,
                        iconSize = 20.dp,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        onClick = onPlayToggle,
                    )
                    if (isBuffering) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp,
                        )
                    }
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = rukuLabel,
                    color = mq.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    lineHeight = 20.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "${ruku.surahArabic} (${ruku.surahNumber})",
                    color = mq.tealAccent,
                    fontWeight = FontWeight.Medium,
                    fontSize = 16.sp,
                    lineHeight = 20.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "Ayat ${ruku.verses}",
                    color = mq.textMuted,
                    fontSize = 13.sp,
                    lineHeight = 17.sp,
                )
                if (!selectionMode && showHifz) {
                    Spacer(Modifier.height(6.dp))
                    HifzPill(entry = hifzEntry, onTap = onHifzTap, onLongPress = onHifzRevision)
                }
            }
            if (!selectionMode) {
                if (showShare) {
                    Box(modifier = shareButtonModifier) {
                        if (isSharing) {
                            Box(
                                modifier = Modifier.size(46.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(22.dp),
                                    strokeWidth = 2.dp,
                                    color = mq.wa,
                                )
                            }
                        } else {
                            OutlineCircleButton(
                                iconRes = R.drawable.ic_whatsapp,
                                tint = mq.wa,
                                contentDescription = "Share on WhatsApp",
                                onClick = onShare,
                            )
                        }
                    }
                }
                Box(modifier = downloadButtonModifier) {
                    DownloadStatusButton(downloadStatus = downloadStatus, onDownload = onDownload)
                }
            }
        }
        // Expanded controls only for the active track (hidden during selection).
        if (isActive && !selectionMode) {
            Spacer(Modifier.height(10.dp))
            AudioControls(
                isActive = isActive,
                positionMs = positionMs,
                durationMs = durationMs,
                speed = speed,
                onSeekBack = onSeekBack,
                onSeekFwd = onSeekFwd,
                onSeekTo = onSeekTo,
                onCycleSpeed = onCycleSpeed,
            )
        }
    }
}

/**
 * Tap + long-press detector built from the same low-level pointer primitives `clickable` already
 * pulls in — so long-press costs ~no extra APK size (unlike `combinedClickable`, which drags in a
 * separate ~16 KB gesture/haptics path that busts the 2 MB budget).
 */
private fun Modifier.tapAndLongPress(onTap: () -> Unit, onLongPress: () -> Unit): Modifier =
    pointerInput(Unit) {
        awaitEachGesture {
            awaitFirstDown()
            var longPressed = false
            val up = try {
                withTimeout(viewConfiguration.longPressTimeoutMillis) { waitForUpOrCancellation() }
            } catch (e: PointerEventTimeoutCancellationException) {
                longPressed = true
                null
            }
            when {
                longPressed -> {
                    onLongPress()
                    waitForUpOrCancellation() // swallow the eventual release
                }
                up != null -> onTap()
                // up == null && !longPressed => gesture cancelled (e.g. a scroll); ignore.
            }
        }
    }

/** Status pill on a ruku card. Tap cycles progress; long-press toggles needs-revision. */
@Composable
private fun HifzPill(entry: HifzEntry?, onTap: () -> Unit, onLongPress: () -> Unit) {
    val mq = LocalMqColors.current
    val state = entry?.state
    val revise = entry?.revise == true
    val bg: Color
    val fg: Color
    val label: String
    when (state) {
        HifzState.MEMORIZED -> {
            bg = mq.memorizedBg; fg = mq.memorizedFg; label = if (revise) "Revise" else "Memorized"
        }
        HifzState.LEARNING -> {
            bg = mq.learningBg; fg = mq.learningFg; label = "Learning"
        }
        null -> {
            bg = mq.mutedChipBg; fg = mq.textMuted; label = "Not started"
        }
    }
    val dotColor = if (revise) mq.gold else fg
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .then(if (revise) Modifier.border(1.dp, mq.gold, RoundedCornerShape(999.dp)) else Modifier)
            .tapAndLongPress(onTap = onTap, onLongPress = onLongPress)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(dotColor))
        Text(label, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Per-Para memorization meter: green fill = memorized fraction, plus counts and overall total. */
@Composable
private fun HifzMeter(
    para: Int,
    paraRukus: List<Ruku>,
    entries: Map<Ruku, HifzEntry>,
    overallTotal: Int,
) {
    val mq = LocalMqColors.current
    val memorized = paraRukus.count { entries[it]?.state == HifzState.MEMORIZED }
    val learning = paraRukus.count { entries[it]?.state == HifzState.LEARNING }
    val revise = paraRukus.count { val e = entries[it]; e != null && e.state == HifzState.MEMORIZED && e.revise }
    val total = paraRukus.size
    val overallMem = entries.values.count { it.state == HifzState.MEMORIZED }
    val fraction = if (total > 0) memorized.toFloat() / total else 0f

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 2.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Para $para", color = mq.textPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text("$overallMem / $overallTotal memorized", color = mq.textMuted, fontSize = 12.sp)
        }
        Spacer(Modifier.height(6.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(mq.border),
        ) {
            if (fraction > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(fraction)
                        .height(8.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Brush.horizontalGradient(listOf(mq.tealAccent, mq.memorizedFg))),
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (memorized > 0) HifzCount(mq.memorizedFg, "$memorized/$total memorized")
            if (learning > 0) HifzCount(mq.learningFg, "$learning learning")
            if (revise > 0) HifzCount(mq.gold, "$revise to revise")
            if (memorized == 0 && learning == 0) {
                Text("No progress in this Para yet", color = mq.textMuted, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun HifzCount(color: Color, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(color))
        Text(text, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Circular checkbox shown on each card while in bulk-selection mode. */
@Composable
private fun SelectionCheck(selected: Boolean) {
    val mq = LocalMqColors.current
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(if (selected) mq.tealAccent else Color.Transparent)
            .border(2.dp, if (selected) mq.tealAccent else mq.border, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) {
            Icon(
                painter = painterResource(R.drawable.ic_downloaded),
                contentDescription = "Selected",
                tint = Color.White,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Audio controls row + slider
// ---------------------------------------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AudioControls(
    isActive: Boolean,
    positionMs: Long,
    durationMs: Long,
    speed: Float,
    onSeekBack: () -> Unit,
    onSeekFwd: () -> Unit,
    onSeekTo: (Float) -> Unit,
    onCycleSpeed: () -> Unit,
) {
    val mq = LocalMqColors.current
    Column(modifier = Modifier.fillMaxWidth()) {
        // Secondary controls (play/pause, share and download live in the card header row).
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SeekButton(R.drawable.ic_seek_back, "-5", "Back 5 seconds", onSeekBack)
            SeekButton(R.drawable.ic_seek_fwd, "+5", "Forward 5 seconds", onSeekFwd)
            SpeedPill(speed, onCycleSpeed)
        }
        Spacer(Modifier.height(6.dp))
        // Timeline row: current time · slider · duration (times flank the bar).
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = formatMs(positionMs),
                color = mq.textMuted,
                fontSize = 13.sp,
            )
            Slider(
                value = fraction(positionMs, durationMs),
                onValueChange = onSeekTo,
                enabled = isActive,
                colors = SliderDefaults.colors(
                    activeTrackColor = mq.tealAccent,
                    inactiveTrackColor = mq.border,
                    disabledActiveTrackColor = mq.tealAccent,
                    disabledInactiveTrackColor = mq.border,
                ),
                // White circular thumb with a teal ring (matches .audio-progress thumb).
                thumb = {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(mq.textPrimary)
                            .border(3.dp, mq.tealAccent, CircleShape)
                    )
                },
                track = { sliderState ->
                    SliderDefaults.Track(
                        sliderState = sliderState,
                        colors = SliderDefaults.colors(
                            activeTrackColor = mq.tealAccent,
                            inactiveTrackColor = mq.border,
                            disabledActiveTrackColor = mq.tealAccent,
                            disabledInactiveTrackColor = mq.border,
                        ),
                        thumbTrackGapSize = 0.dp,
                        drawStopIndicator = null,
                        modifier = Modifier.height(8.dp),
                    )
                },
                modifier = Modifier.weight(1f),
            )
            Text(
                text = formatMs(durationMs),
                color = mq.textMuted,
                fontSize = 13.sp,
            )
        }
    }
}

@Composable
private fun SeekButton(iconRes: Int, label: String, contentDescription: String, onClick: () -> Unit) {
    val mq = LocalMqColors.current
    Box(
        modifier = Modifier
            .size(46.dp)
            .clip(CircleShape)
            .border(1.5.dp, mq.border, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(iconRes),
            contentDescription = contentDescription,
            tint = mq.textMuted,
            modifier = Modifier.size(28.dp),
        )
        Text(
            text = label,
            color = mq.textMuted,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** Download affordance shown on every card: tappable download → spinner → green tick. */
@Composable
private fun DownloadStatusButton(downloadStatus: DownloadStatus, onDownload: () -> Unit) {
    val mq = LocalMqColors.current
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(46.dp)) {
        when (downloadStatus) {
            DownloadStatus.Downloading -> CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                strokeWidth = 2.dp,
                color = mq.tealAccent,
            )
            DownloadStatus.Downloaded -> Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .border(1.5.dp, mq.border, CircleShape)
                    .background(mq.cardBg),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_downloaded),
                    contentDescription = "Downloaded",
                    tint = mq.wa,
                    modifier = Modifier.size(19.dp),
                )
            }
            else -> OutlineCircleButton(
                iconRes = R.drawable.ic_download,
                tint = mq.textMuted,
                contentDescription = "Download",
                onClick = onDownload,
            )
        }
    }
}

@Composable
private fun OutlineCircleButton(
    iconRes: Int,
    tint: Color,
    contentDescription: String,
    onClick: () -> Unit,
) {
    val mq = LocalMqColors.current
    Box(
        modifier = Modifier
            .size(46.dp)
            .clip(CircleShape)
            .border(1.5.dp, mq.border, CircleShape)
            .background(mq.cardBg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(iconRes),
            contentDescription = contentDescription,
            tint = tint,
            modifier = Modifier.size(19.dp),
        )
    }
}

@Composable
private fun GradientCircleButton(
    size: androidx.compose.ui.unit.Dp,
    brush: Brush,
    enabled: Boolean,
    iconRes: Int,
    iconSize: androidx.compose.ui.unit.Dp,
    contentDescription: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(brush)
            .clickable(enabled = enabled, onClick = onClick)
            .then(if (enabled) Modifier else Modifier.background(Color.Black.copy(alpha = 0.35f), CircleShape)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(iconRes),
            contentDescription = contentDescription,
            tint = Color.White,
            modifier = Modifier.size(iconSize),
        )
    }
}

@Composable
private fun SpeedPill(speed: Float, onClick: () -> Unit) {
    val mq = LocalMqColors.current
    val label = if (speed == speed.toInt().toFloat()) "${speed.toInt()}x" else "${speed}x"
    Box(
        modifier = Modifier
            .size(46.dp)
            .clip(CircleShape)
            .border(1.5.dp, mq.border, CircleShape)
            .background(mq.cardBg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = mq.textMuted,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

private fun formatMs(ms: Long): String {
    val totalSec = (ms / 1000).coerceAtLeast(0)
    return "%d:%02d".format(totalSec / 60, totalSec % 60)
}
