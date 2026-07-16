package com.mohsingdp.marifatulquran.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mohsingdp.marifatulquran.R
import com.mohsingdp.marifatulquran.core.PlaybackMode
import com.mohsingdp.marifatulquran.core.parseHifz
import com.mohsingdp.marifatulquran.core.serializeHifz
import com.mohsingdp.marifatulquran.data.HifzRegistry
import com.mohsingdp.marifatulquran.data.Prefs
import com.mohsingdp.marifatulquran.playback.PlayerController
import com.mohsingdp.marifatulquran.ui.theme.LocalMqColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Settings screen, styled to match the main Browse screen: the same teal gradient header with the
 * gold underline accent, the dark [pageBg] background, and each group wrapped in a bordered
 * [cardBg] card — so it reads as one app, not a stock Material settings page.
 */
@Composable
fun SettingsScreen(
    prefs: Prefs,
    controller: PlayerController,
    onBack: () -> Unit,
) {
    val mq = LocalMqColors.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var currentMode by remember { mutableStateOf(prefs.getPlaybackMode()) }
    var defaultSpeed by remember { mutableFloatStateOf(prefs.getDefaultSpeed()) }
    var whatsAppShare by remember { mutableStateOf(prefs.isWhatsAppShareEnabled()) }
    var hifzEnabled by remember { mutableStateOf(prefs.isHifzEnabled()) }
    var hifzStatus by remember { mutableStateOf("") }
    var showResetConfirm by remember { mutableStateOf(false) }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("text/plain")
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val body = serializeHifz(HifzRegistry.exportMap())
            val ok = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openOutputStream(uri)?.use { it.write(body.toByteArray()) }
                }.isSuccess
            }
            hifzStatus = if (ok) "Exported ${HifzRegistry.exportMap().size} rukus." else "Export failed."
        }
    }
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val text = withContext(Dispatchers.IO) {
                runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes().decodeToString() } }.getOrNull()
            }
            if (text == null) { hifzStatus = "Import failed: couldn't read the file."; return@launch }
            val parsed = parseHifz(text)
            val applied = HifzRegistry.import(parsed, prefs)
            hifzStatus = "Imported $applied, skipped ${parsed.size - applied} unknown."
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(mq.pageBg),
    ) {
        SettingsHeader(onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(horizontal = 10.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // After ruku ends — Stop / Loop / Next.
            SettingsCard {
                SectionTitle("After ruku ends")
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    PlaybackModeButton(
                        label = "Stop",
                        selected = currentMode == PlaybackMode.NONE,
                        onClick = {
                            currentMode = PlaybackMode.NONE
                            prefs.setPlaybackMode(PlaybackMode.NONE)
                            controller.applyPlaybackMode(PlaybackMode.NONE)
                        },
                        modifier = Modifier.weight(1f),
                    )
                    PlaybackModeButton(
                        label = "Loop",
                        selected = currentMode == PlaybackMode.LOOP,
                        onClick = {
                            currentMode = PlaybackMode.LOOP
                            prefs.setPlaybackMode(PlaybackMode.LOOP)
                            controller.applyPlaybackMode(PlaybackMode.LOOP)
                        },
                        modifier = Modifier.weight(1f),
                    )
                    PlaybackModeButton(
                        label = "Next",
                        selected = currentMode == PlaybackMode.NEXT,
                        onClick = {
                            currentMode = PlaybackMode.NEXT
                            prefs.setPlaybackMode(PlaybackMode.NEXT)
                            controller.applyPlaybackMode(PlaybackMode.NEXT)
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            // Default speed.
            SettingsCard {
                SectionTitle("Default speed")
                DefaultSpeedDropdown(
                    selected = defaultSpeed,
                    onSelect = {
                        defaultSpeed = it
                        prefs.setDefaultSpeed(it)
                    },
                )
            }

            // WhatsApp share toggle.
            SettingsCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        SectionTitle("WhatsApp share", bottomPadding = 2.dp)
                        Text(
                            text = "Show the WhatsApp share button on each ruku",
                            color = mq.textMuted,
                            fontSize = 13.sp,
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Switch(
                        checked = whatsAppShare,
                        onCheckedChange = {
                            whatsAppShare = it
                            prefs.setWhatsAppShareEnabled(it)
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = mq.tealAccent,
                            checkedBorderColor = mq.tealAccent,
                            uncheckedThumbColor = mq.textMuted,
                            uncheckedTrackColor = mq.cardBg,
                            uncheckedBorderColor = mq.border,
                        ),
                    )
                }
            }

            // Hifz tracking — enable/disable the memorization tracker + back up / restore it.
            SettingsCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        SectionTitle("Hifz tracking", bottomPadding = 2.dp)
                        Text(
                            text = "Show memorization progress and the pill on each ruku",
                            color = mq.textMuted,
                            fontSize = 13.sp,
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Switch(
                        checked = hifzEnabled,
                        onCheckedChange = {
                            hifzEnabled = it
                            prefs.setHifzEnabled(it)
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = mq.tealAccent,
                            checkedBorderColor = mq.tealAccent,
                            uncheckedThumbColor = mq.textMuted,
                            uncheckedTrackColor = mq.cardBg,
                            uncheckedBorderColor = mq.border,
                        ),
                    )
                }
                if (hifzEnabled) {
                    Spacer(Modifier.height(14.dp))
                    Text(
                        text = "Back up your memorization progress or move it to another device.",
                        color = mq.textMuted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(bottom = 12.dp),
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        HifzActionButton("Export", Modifier.weight(1f)) {
                            exportLauncher.launch("hifz-progress.txt")
                        }
                        HifzActionButton("Import", Modifier.weight(1f)) {
                            importLauncher.launch(arrayOf("text/plain", "*/*"))
                        }
                        HifzActionButton("Reset", Modifier.weight(1f), danger = true) {
                            showResetConfirm = true
                        }
                    }
                    // Inline confirm (lighter than a Material dialog; keeps the APK under budget).
                    if (showResetConfirm) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "Reset all memorization progress? This cannot be undone.",
                            color = mq.textMuted,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            HifzActionButton("Cancel", Modifier.weight(1f)) { showResetConfirm = false }
                            HifzActionButton("Reset", Modifier.weight(1f), danger = true) {
                                HifzRegistry.clear(prefs)
                                hifzStatus = "Progress reset."
                                showResetConfirm = false
                            }
                        }
                    }
                    if (hifzStatus.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Text(hifzStatus, color = mq.textMuted, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

/** Small bordered action button used in the Hifz-progress card. */
@Composable
private fun HifzActionButton(
    label: String,
    modifier: Modifier = Modifier,
    danger: Boolean = false,
    onClick: () -> Unit,
) {
    val mq = LocalMqColors.current
    Box(
        modifier = modifier
            .height(42.dp)
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, if (danger) mq.gold else mq.border, RoundedCornerShape(8.dp))
            .background(mq.cardBg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (danger) mq.gold else mq.textPrimary,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// ---------------------------------------------------------------------------------------------
// Header — mirrors BrowseScreen's gradient band + gold underline, with a back arrow + title.
// ---------------------------------------------------------------------------------------------

@Composable
private fun SettingsHeader(onBack: () -> Unit) {
    val mq = LocalMqColors.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(mq.headerBrush)
                .padding(horizontal = 8.dp, vertical = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .size(48.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_arrow_back),
                    contentDescription = "Back",
                    tint = Color.White,
                    modifier = Modifier.size(24.dp),
                )
            }
            Text(
                text = "Settings",
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        // Gold underline accent (matches the main header::after).
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
// Building blocks
// ---------------------------------------------------------------------------------------------

/** A bordered, rounded card on the dark page — same treatment as the toolbar / ruku cards. */
@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    val mq = LocalMqColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .border(1.dp, mq.border, RoundedCornerShape(10.dp))
            .background(mq.cardBg)
            .padding(14.dp),
        content = content,
    )
}

@Composable
private fun SectionTitle(text: String, bottomPadding: androidx.compose.ui.unit.Dp = 12.dp) {
    val mq = LocalMqColors.current
    Text(
        text = text,
        color = mq.textPrimary,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(bottom = bottomPadding),
    )
}

private val SPEED_OPTIONS = listOf(0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f)

private fun formatSpeed(v: Float): String =
    if (v == v.toInt().toFloat()) "${v.toInt()}x" else "${v}x"

@Composable
private fun DefaultSpeedDropdown(selected: Float, onSelect: (Float) -> Unit) {
    val mq = LocalMqColors.current
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .border(1.dp, mq.border, RoundedCornerShape(6.dp))
                .background(mq.cardBg)
                .clickable { open = true }
                .padding(start = 14.dp, end = 8.dp, top = 10.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = formatSpeed(selected), color = mq.textPrimary, fontSize = 16.sp)
            Spacer(Modifier.width(8.dp))
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
            SPEED_OPTIONS.forEach { s ->
                val isSelected = s == selected
                DropdownMenuItem(
                    modifier = Modifier.background(
                        if (isSelected) mq.tealAccent.copy(alpha = 0.15f) else Color.Transparent
                    ),
                    text = {
                        Text(
                            formatSpeed(s),
                            color = if (isSelected) mq.tealAccent else mq.textPrimary,
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    },
                    onClick = { onSelect(s); open = false },
                )
            }
        }
    }
}

/** Segmented option button — teal fill when selected, bordered card otherwise (app aesthetic). */
@Composable
private fun PlaybackModeButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val mq = LocalMqColors.current
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) mq.tealAccent else mq.cardBg)
            .border(
                1.dp,
                if (selected) mq.tealAccent else mq.border,
                RoundedCornerShape(8.dp),
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) Color.White else mq.textMuted,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
