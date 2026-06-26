package com.mohsingdp.marifatulquran.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.mohsingdp.marifatulquran.R
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.playback.PlayerController

private val SPEEDS = listOf(0.75f, 1f, 1.25f, 1.5f, 2f)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerScreen(
    title: String,
    controller: PlayerController,
    rukus: List<Ruku>,
    onBack: () -> Unit,
) {
    val uiState by controller.state.collectAsState()
    var selectedSpeed by remember { mutableFloatStateOf(1f) }
    var isSeeking by remember { mutableStateOf(false) }
    var seekPosition by remember { mutableFloatStateOf(0f) }
    val context = LocalContext.current

    // Resolve the current ruku for sharing (follows auto-advance)
    val currentRuku = rukus.getOrNull(uiState.currentIndex)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, style = MaterialTheme.typography.titleMedium) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        // Simple back arrow using text as navigation icon fallback
                        Text(
                            text = "←",
                            color = MaterialTheme.colorScheme.onPrimary,
                            style = MaterialTheme.typography.titleLarge,
                        )
                    }
                },
                actions = {
                    if (currentRuku != null) {
                        IconButton(onClick = { shareRukuIntent(context, currentRuku) }) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_share),
                                contentDescription = "Share",
                                modifier = Modifier.size(24.dp),
                            )
                        }
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(32.dp))

            // Progress slider
            val durationMs = uiState.durationMs.coerceAtLeast(1)
            val sliderValue = if (isSeeking) seekPosition else uiState.positionMs.toFloat() / durationMs

            Slider(
                value = sliderValue.coerceIn(0f, 1f),
                onValueChange = { value ->
                    isSeeking = true
                    seekPosition = value
                },
                onValueChangeFinished = {
                    controller.seekTo((seekPosition * uiState.durationMs).toLong())
                    isSeeking = false
                },
                modifier = Modifier.fillMaxWidth(),
            )

            // Time labels
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = formatMs(if (isSeeking) (seekPosition * uiState.durationMs).toLong() else uiState.positionMs),
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    text = formatMs(uiState.durationMs),
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Play / Pause button
            IconButton(
                onClick = { if (uiState.isPlaying) controller.pause() else controller.play() },
                modifier = Modifier.size(72.dp),
            ) {
                Icon(
                    painter = painterResource(
                        id = if (uiState.isPlaying) R.drawable.ic_pause else R.drawable.ic_play,
                    ),
                    contentDescription = if (uiState.isPlaying) "Pause" else "Play",
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Speed chips
            Text(
                text = "Speed",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SPEEDS.forEach { speed ->
                    FilterChip(
                        selected = selectedSpeed == speed,
                        onClick = {
                            selectedSpeed = speed
                            controller.setSpeed(speed)
                        },
                        label = {
                            Text(
                                text = if (speed == 1f) "1×" else "${speed}×",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        },
                    )
                }
            }
        }
    }
}

private fun formatMs(ms: Long): String {
    val totalSec = (ms / 1000).coerceAtLeast(0)
    val min = totalSec / 60
    val sec = totalSec % 60
    return "%d:%02d".format(min, sec)
}
