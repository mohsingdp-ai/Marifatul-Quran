package com.mohsingdp.marifatulquran.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = TealAccent, onPrimary = Color(0xFFFFFFFF),
    secondary = GoldLight, background = Color(0xFFEEF4F4), onBackground = TextLight,
)
private val DarkColors = darkColorScheme(
    primary = TealAccent, secondary = GoldDark,
    background = DarkSurface, onBackground = TextDark, surface = DarkHeader,
)

@Composable
fun MarifatulTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, content = content)
}
