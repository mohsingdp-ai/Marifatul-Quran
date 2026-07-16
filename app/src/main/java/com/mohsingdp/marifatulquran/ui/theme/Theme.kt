package com.mohsingdp.marifatulquran.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Semantic palette mirroring the web app's CSS custom properties (dark theme).
 * Components read these via [LocalMqColors] so colours stay in lock-step with style.css.
 */
data class MqColors(
    val pageBg: Color = PageBg,
    val cardBg: Color = CardBg,
    val rowGray: Color = RowGray,
    val tealDark: Color = TealDark,
    val tealHeader: Color = TealHeader,
    val tealAccent: Color = TealAccent,
    val tealLight: Color = TealLight,
    val label: Color = VerseLink,
    val textPrimary: Color = TextPrimary,
    val textMuted: Color = TextMuted,
    val gold: Color = ArabicGold,
    val goldDarkEnd: Color = GoldDarkEnd,
    val playingBg: Color = PlayingBg,
    val border: Color = Border,
    val wa: Color = WaColor,
    val mutedChipBg: Color = MutedChipBg,
    val learningBg: Color = WarnChipBg,
    val learningFg: Color = WarnChipFg,
    val memorizedBg: Color = SuccessBg,
    val memorizedFg: Color = SuccessFg,
) {
    /** Teal play-button gradient (audio-play-btn, not-playing state). */
    val tealButtonBrush: Brush
        get() = Brush.linearGradient(listOf(tealAccent, tealDark))

    /** Gold play-button gradient (tr.playing .audio-play-btn). */
    val goldButtonBrush: Brush
        get() = Brush.linearGradient(listOf(gold, goldDarkEnd))

    /** Header bar gradient: linear-gradient(135deg, #0a3d3d, #062c2c 40%, #0f6060). */
    val headerBrush: Brush
        get() = Brush.linearGradient(
            colorStops = arrayOf(0f to tealHeader, 0.4f to tealDark, 1f to HeaderGoldEnd),
            start = Offset(0f, 0f),
            end = Offset.Infinite,
        )
}

val LocalMqColors = staticCompositionLocalOf { MqColors() }

private val MqDarkScheme = darkColorScheme(
    primary = TealAccent,
    onPrimary = Color.White,
    secondary = ArabicGold,
    onSecondary = Color.White,
    background = PageBg,
    onBackground = TextPrimary,
    surface = CardBg,
    onSurface = TextPrimary,
    surfaceVariant = RowGray,
    onSurfaceVariant = TextMuted,
    outline = Border,
)

@Composable
fun MarifatulTheme(content: @Composable () -> Unit) {
    // The app is always dark, so force the system status & navigation bars to dark
    // appearance (light icons) regardless of the device's light/dark setting —
    // otherwise on a light-mode phone the back/home/recents icons render dark and
    // are invisible against the dark UI.
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Paint the bars to match the app (teal status, dark nav) on devices that
            // are NOT edge-to-edge (e.g. Android 14); ignored/transparent on 15+.
            @Suppress("DEPRECATION")
            window.statusBarColor = TealHeader.toArgb()
            @Suppress("DEPRECATION")
            window.navigationBarColor = PageBg.toArgb()
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = false
            controller.isAppearanceLightNavigationBars = false
        }
    }
    // The web app defaults to (and the screenshots show) the dark theme — force it
    // so the native UI is identical regardless of the device's system setting.
    androidx.compose.runtime.CompositionLocalProvider(LocalMqColors provides MqColors()) {
        MaterialTheme(colorScheme = MqDarkScheme, content = content)
    }
}
