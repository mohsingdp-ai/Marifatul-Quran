package com.mohsingdp.marifatulquran.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mohsingdp.marifatulquran.R
import com.mohsingdp.marifatulquran.core.PlaybackMode
import com.mohsingdp.marifatulquran.data.Prefs
import com.mohsingdp.marifatulquran.playback.PlayerController
import com.mohsingdp.marifatulquran.ui.theme.LocalMqColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    prefs: Prefs,
    controller: PlayerController,
    onBack: () -> Unit,
) {
    var currentMode by remember { mutableStateOf(prefs.getPlaybackMode()) }
    var defaultSpeed by remember { mutableFloatStateOf(prefs.getDefaultSpeed()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings", style = MaterialTheme.typography.titleLarge) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Text(
                            text = "←",
                            color = MaterialTheme.colorScheme.onPrimary,
                            style = MaterialTheme.typography.titleLarge,
                        )
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
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "After ruku ends",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = 12.dp),
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
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
                Spacer(modifier = Modifier.width(8.dp))
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
                Spacer(modifier = Modifier.width(8.dp))
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

            Spacer(modifier = Modifier.height(28.dp))

            Text(
                text = "Default speed",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            DefaultSpeedDropdown(
                selected = defaultSpeed,
                onSelect = {
                    defaultSpeed = it
                    prefs.setDefaultSpeed(it)
                },
            )
        }
    }
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
                DropdownMenuItem(
                    text = { Text(formatSpeed(s), color = mq.textPrimary) },
                    onClick = { onSelect(s); open = false },
                )
            }
        }
    }
}

@Composable
private fun PlaybackModeButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (selected) {
        Button(
            onClick = onClick,
            modifier = modifier,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
        ) {
            Text(label)
        }
    } else {
        OutlinedButton(
            onClick = onClick,
            modifier = modifier,
        ) {
            Text(label)
        }
    }
}
