package com.mohsingdp.marifatulquran

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.mohsingdp.marifatulquran.data.DefaultRukuRepository
import com.mohsingdp.marifatulquran.data.HifzRegistry
import com.mohsingdp.marifatulquran.data.Prefs
import com.mohsingdp.marifatulquran.download.DownloadRegistry
import com.mohsingdp.marifatulquran.download.Downloader
import com.mohsingdp.marifatulquran.playback.PlayerController
import com.mohsingdp.marifatulquran.ui.BrowseScreen
import com.mohsingdp.marifatulquran.ui.BrowseViewModel
import com.mohsingdp.marifatulquran.ui.SettingsScreen
import com.mohsingdp.marifatulquran.ui.theme.MarifatulTheme

sealed interface Screen {
    data object Browse : Screen
    data object Settings : Screen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MarifatulTheme {
                val vm = remember { BrowseViewModel(DefaultRukuRepository()) }
                val scope = rememberCoroutineScope()
                val prefs = remember { Prefs(this@MainActivity) }
                val downloader = remember { Downloader(this@MainActivity) }
                val controller = remember { PlayerController(this@MainActivity, scope, prefs, downloader) }
                var screen by remember { mutableStateOf<Screen>(Screen.Browse) }

                // Request POST_NOTIFICATIONS (API 33+) so the media/lockscreen notification reliably shows.
                val context = LocalContext.current
                val notifLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { }
                LaunchedEffect(Unit) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED
                    ) {
                        notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                }

                // Last saved position seeds the initially-shown Para (web defaults to Para 1).
                val saved = remember { prefs.lastPosition() }
                var selectedPara by rememberSaveable { mutableIntStateOf(saved?.para ?: 1) }
                // -1 = nothing loaded into the player yet.
                var playingPara by rememberSaveable { mutableIntStateOf(-1) }

                // Show the guided walkthrough automatically the first time the app is opened.
                var showGuide by rememberSaveable { mutableStateOf(!prefs.isGuideSeen()) }

                // Per-ruku download status lives in a process-wide registry, so it survives Activity
                // teardown and is shared with the background download service. Seed it from disk
                // once, then observe it (existing files show as downloaded on launch).
                remember { DownloadRegistry.seedFromDiskOnce(vm.paras.flatMap { it.rukus }, downloader) }
                val downloadStatusMap by DownloadRegistry.statuses.collectAsState()

                // Hifz (memorization) progress: process-wide, seeded from prefs once, then observed.
                remember { HifzRegistry.seedFromPrefsOnce(vm.paras.flatMap { it.rukus }, prefs) }
                val hifzEntries by HifzRegistry.entries.collectAsState()

                when (screen) {
                    is Screen.Browse -> {
                        BrowseScreen(
                            vm = vm,
                            controller = controller,
                            prefs = prefs,
                            downloader = downloader,
                            downloadStatusMap = downloadStatusMap,
                            scope = scope,
                            selectedPara = selectedPara,
                            onSelectPara = { selectedPara = it },
                            playingPara = playingPara,
                            onPlayingParaChange = { playingPara = it },
                            onOpenSettings = { screen = Screen.Settings },
                            hifzEntries = hifzEntries,
                            onHifzTap = { HifzRegistry.tap(it, System.currentTimeMillis(), prefs) },
                            onHifzRevision = { HifzRegistry.toggleRevision(it, System.currentTimeMillis(), prefs) },
                            showGuide = showGuide,
                            onShowGuide = { showGuide = true },
                            onGuideFinished = {
                                showGuide = false
                                prefs.setGuideSeen()
                            },
                        )
                    }

                    is Screen.Settings -> {
                        BackHandler { screen = Screen.Browse }
                        SettingsScreen(
                            prefs = prefs,
                            controller = controller,
                            onBack = { screen = Screen.Browse },
                        )
                    }
                }
            }
        }
    }
}
