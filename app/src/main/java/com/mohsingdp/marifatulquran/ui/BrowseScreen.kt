package com.mohsingdp.marifatulquran.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mohsingdp.marifatulquran.R
import com.mohsingdp.marifatulquran.core.DownloadStatus
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.shareCaption
import com.mohsingdp.marifatulquran.data.Prefs
import com.mohsingdp.marifatulquran.download.Downloader
import com.mohsingdp.marifatulquran.playback.PlayerController
import com.mohsingdp.marifatulquran.ui.theme.LocalMqColors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

private val SPEEDS = listOf(0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f)

/** Launch a WhatsApp share intent; fallback to system chooser if WhatsApp not installed. */
internal fun shareRukuIntent(context: Context, ruku: Ruku) {
    val text = shareCaption(ruku)
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
    downloadStatusMap: SnapshotStateMap<Ruku, DownloadStatus>,
    scope: CoroutineScope,
    selectedPara: Int,
    onSelectPara: (Int) -> Unit,
    playingPara: Int,
    onPlayingParaChange: (Int) -> Unit,
    onOpenSettings: () -> Unit,
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

    // Captured screen rects of the walkthrough targets (Para dropdown, first card's play button).
    var paraRect by remember { mutableStateOf<Rect?>(null) }
    var playRect by remember { mutableStateOf<Rect?>(null) }

    val rukus = vm.rukusFor(selectedPara)
    val activeRuku = if (playingPara != -1) {
        vm.rukusFor(playingPara).getOrNull(ui.currentIndex)
    } else null

    /** Load a ruku of the displayed para into the shared player (does not auto-play). */
    fun activate(index: Int) {
        controller.setQueue(selectedPara, rukus, index)
        controller.setSpeed(speed)
        onPlayingParaChange(selectedPara)
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(mq.pageBg),
    ) {
        Header()

        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                ToolbarCard(
                    selectedPara = selectedPara,
                    paras = vm.paras.map { it.para },
                    onSelectPara = onSelectPara,
                    paraDropdownModifier = Modifier.onGloballyPositioned { paraRect = it.boundsInRoot() },
                    onDownloadPara = {
                        rukus.forEach { ruku ->
                            val cur = downloadStatusMap[ruku]
                            if (cur != DownloadStatus.Downloaded && cur != DownloadStatus.Downloading) {
                                downloadStatusMap[ruku] = DownloadStatus.Downloading
                                scope.launch { downloadStatusMap[ruku] = downloader.download(ruku) }
                            }
                        }
                    },
                    onOpenSettings = onOpenSettings,
                    onShowGuide = onShowGuide,
                    nowPlaying = {
                        NowPlayingCard(
                            activeRuku = activeRuku,
                            isPlaying = ui.isPlaying,
                            progress = fraction(ui.positionMs, ui.durationMs),
                            onToggle = { if (ui.isPlaying) controller.pause() else controller.play() },
                            onLocate = {
                                if (playingPara != -1) {
                                    onSelectPara(playingPara)
                                    uiScope.launch { listState.animateScrollToItem(ui.currentIndex + 1) }
                                }
                            },
                        )
                    },
                )
            }

            itemsIndexed(rukus) { index, ruku ->
                val isActive = selectedPara == playingPara && index == ui.currentIndex
                RukuCard(
                    ruku = ruku,
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
                            downloadStatusMap[ruku] = DownloadStatus.Downloading
                            scope.launch { downloadStatusMap[ruku] = downloader.download(ruku) }
                        }
                    },
                    onShare = { shareRukuIntent(context, ruku) },
                    playButtonModifier = if (index == 0) {
                        Modifier.onGloballyPositioned { playRect = it.boundsInRoot() }
                    } else Modifier,
                )
            }
        }
    }

        // First-run / replayable guided walkthrough overlay.
        if (showGuide) {
            LaunchedEffect(Unit) { listState.animateScrollToItem(0) }
            GuideOverlay(
                steps = listOf(
                    GuideStep(
                        title = "Choose a Para (Juz)",
                        body = "Tap here to pick a Para from 1–30. Its rukus appear in the list below.",
                        target = paraRect,
                    ),
                    GuideStep(
                        title = "Play a recording",
                        body = "Tap the play button on any ruku card to listen. Use −5 / +5 to skip, or drag the bar to seek.",
                        target = playRect,
                    ),
                ),
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
                .padding(horizontal = 24.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "قرآن پاک",
                color = Color.White,
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "رکوع ریکارڈنگ",
                color = Color.White.copy(alpha = 0.8f),
                fontSize = 14.sp,
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
    nowPlaying: @Composable () -> Unit,
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
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            val paraIndex = paras.indexOf(selectedPara)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "Para (Juz)",
                    color = mq.textPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                )
                StepButton(
                    iconRes = R.drawable.ic_chevron_left,
                    contentDescription = "Previous Para",
                    enabled = paraIndex > 0,
                    onClick = { onSelectPara(paras[paraIndex - 1]) },
                )
                ParaDropdown(selectedPara, paras, onSelectPara, paraDropdownModifier)
                StepButton(
                    iconRes = R.drawable.ic_chevron_right,
                    contentDescription = "Next Para",
                    enabled = paraIndex >= 0 && paraIndex < paras.lastIndex,
                    onClick = { onSelectPara(paras[paraIndex + 1]) },
                )
            }
            OverflowMenu(
                onDownloadPara = onDownloadPara,
                onOpenSettings = onOpenSettings,
                onShowGuide = onShowGuide,
            )
        }
        HorizontalDivider(color = mq.border, thickness = 1.dp)
        // Now-playing
        Box(modifier = Modifier.padding(12.dp)) {
            nowPlaying()
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
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .border(1.dp, mq.border, RoundedCornerShape(6.dp))
                .background(mq.cardBg)
                .clickable { open = true }
                .padding(start = 12.dp, end = 6.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Para $selectedPara",
                color = mq.textPrimary,
                fontSize = 16.sp,
            )
            Spacer(Modifier.width(4.dp))
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
            modifier = Modifier.background(mq.cardBg),
        ) {
            paras.forEach { p ->
                DropdownMenuItem(
                    text = { Text("Para $p", color = mq.textPrimary) },
                    onClick = { onSelectPara(p); open = false },
                )
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
            DropdownMenuItem(
                text = { Text("Download para", color = mq.textPrimary) },
                onClick = { onDownloadPara(); open = false },
            )
            DropdownMenuItem(
                text = { Text("Settings", color = mq.textPrimary) },
                onClick = { onOpenSettings(); open = false },
            )
            DropdownMenuItem(
                text = { Text("Show guide", color = mq.textPrimary) },
                onClick = { onShowGuide(); open = false },
            )
        }
    }
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
            .background(if (hasTrack) mq.playingBg else mq.rowGray),
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
            // Locate button
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .border(1.dp, mq.border, RoundedCornerShape(10.dp))
                    .background(mq.cardBg)
                    .clickable(enabled = hasTrack, onClick = onLocate),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_locate),
                    contentDescription = "Go to current track",
                    tint = if (hasTrack) mq.tealAccent else mq.textMuted,
                    modifier = Modifier.size(18.dp),
                )
            }
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
    playButtonModifier: Modifier = Modifier,
) {
    val mq = LocalMqColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .border(
                1.dp,
                if (isActive) mq.tealAccent else mq.border,
                RoundedCornerShape(10.dp),
            )
            .background(if (isActive) mq.playingBg else mq.cardBg)
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        LabeledField("RUKU #", "${ruku.rukuInPara} (Para ${ruku.para})", mq.textPrimary)
        FieldDivider()
        LabeledField("SURAH", ruku.surah, mq.textPrimary)
        FieldDivider()
        LabeledField("VERSES", ruku.verses, mq.label, valueWeight = FontWeight.Medium)
        FieldDivider()
        ArabicField(ruku)
        FieldDivider()
        // AUDIO
        Text(
            text = "AUDIO",
            color = mq.label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 8.dp),
        )
        AudioControls(
            isActive = isActive,
            isPlaying = isPlaying,
            isBuffering = isBuffering,
            positionMs = positionMs,
            durationMs = durationMs,
            speed = speed,
            downloadStatus = downloadStatus,
            onPlayToggle = onPlayToggle,
            onSeekBack = onSeekBack,
            onSeekFwd = onSeekFwd,
            onSeekTo = onSeekTo,
            onCycleSpeed = onCycleSpeed,
            onDownload = onDownload,
            onShare = onShare,
            playButtonModifier = playButtonModifier,
        )
    }
}

@Composable
private fun LabeledField(
    label: String,
    value: String,
    valueColor: Color,
    valueWeight: FontWeight = FontWeight.Normal,
) {
    val mq = LocalMqColors.current
    Column(modifier = Modifier.padding(vertical = 6.dp)) {
        Text(
            text = label,
            color = mq.label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
        )
        Spacer(Modifier.height(3.dp))
        Text(text = value, color = valueColor, fontSize = 16.sp, fontWeight = valueWeight)
    }
}

@Composable
private fun ArabicField(ruku: Ruku) {
    val mq = LocalMqColors.current
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Text(
            text = "ARABIC",
            color = mq.label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.End,
        )
        Spacer(Modifier.height(3.dp))
        Text(
            text = "${ruku.surahNumber} ${ruku.surahArabic}",
            color = mq.gold,
            fontSize = 18.sp,
            fontFamily = FontFamily.Serif,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun FieldDivider() {
    HorizontalDivider(color = LocalMqColors.current.border, thickness = 1.dp)
}

// ---------------------------------------------------------------------------------------------
// Audio controls row + slider
// ---------------------------------------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AudioControls(
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
    playButtonModifier: Modifier = Modifier,
) {
    val mq = LocalMqColors.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SeekButton(R.drawable.ic_seek_back, "-5", "Back 5 seconds", onSeekBack)
            // Download affordance
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(34.dp)) {
                when (downloadStatus) {
                    DownloadStatus.Downloading -> CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = mq.tealAccent,
                    )
                    DownloadStatus.Downloaded -> OutlineCircleButton(
                        iconRes = R.drawable.ic_downloaded,
                        tint = mq.tealAccent,
                        contentDescription = "Downloaded",
                        onClick = {},
                    )
                    else -> OutlineCircleButton(
                        iconRes = R.drawable.ic_download,
                        tint = mq.textMuted,
                        contentDescription = "Download",
                        onClick = onDownload,
                    )
                }
            }
            OutlineCircleButton(
                iconRes = R.drawable.ic_whatsapp,
                tint = mq.wa,
                contentDescription = "Share on WhatsApp",
                onClick = onShare,
            )
            // Big play / pause
            Box(modifier = playButtonModifier.size(52.dp), contentAlignment = Alignment.Center) {
                GradientCircleButton(
                    size = 52.dp,
                    brush = if (isActive) mq.goldButtonBrush else mq.tealButtonBrush,
                    enabled = true,
                    iconRes = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play,
                    iconSize = 24.dp,
                    contentDescription = if (isPlaying) "Pause" else "Play",
                    onClick = onPlayToggle,
                )
                if (isBuffering) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(26.dp),
                        color = Color.White,
                        strokeWidth = 2.dp,
                    )
                }
            }
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
            .size(42.dp)
            .clip(CircleShape)
            .border(1.5.dp, mq.border, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(iconRes),
            contentDescription = contentDescription,
            tint = mq.textMuted,
            modifier = Modifier.size(26.dp),
        )
        Text(
            text = label,
            color = mq.textMuted,
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
        )
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
            .size(34.dp)
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
            modifier = Modifier.size(16.dp),
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
            .clip(RoundedCornerShape(20.dp))
            .border(1.5.dp, mq.border, RoundedCornerShape(20.dp))
            .background(mq.cardBg)
            .clickable(onClick = onClick)
            .widthIn(min = 36.dp)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = mq.textMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

private fun formatMs(ms: Long): String {
    val totalSec = (ms / 1000).coerceAtLeast(0)
    return "%d:%02d".format(totalSec / 60, totalSec % 60)
}
