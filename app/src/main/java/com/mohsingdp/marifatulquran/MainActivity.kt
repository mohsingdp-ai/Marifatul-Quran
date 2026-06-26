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
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.mohsingdp.marifatulquran.core.DownloadStatus
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.data.DefaultRukuRepository
import com.mohsingdp.marifatulquran.data.Prefs
import com.mohsingdp.marifatulquran.data.SavedPosition
import com.mohsingdp.marifatulquran.download.Downloader
import com.mohsingdp.marifatulquran.playback.PlayerController
import com.mohsingdp.marifatulquran.ui.BrowseScreen
import com.mohsingdp.marifatulquran.ui.BrowseViewModel
import com.mohsingdp.marifatulquran.ui.PlayerScreen
import com.mohsingdp.marifatulquran.ui.SettingsScreen
import com.mohsingdp.marifatulquran.ui.theme.MarifatulTheme

sealed interface Screen {
    data object Browse : Screen
    data class Player(val para: Int, val index: Int) : Screen
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

                // Read saved position once on first composition
                val savedPosition: SavedPosition? = remember { prefs.lastPosition() }

                // Download status map — hoisted here so it survives Browse↔Player navigation.
                // Initialized from disk so existing files are shown on launch.
                val downloadStatusMap = remember {
                    val map = androidx.compose.runtime.mutableStateMapOf<Ruku, DownloadStatus>()
                    vm.paras.forEach { pg ->
                        pg.rukus.forEach { ruku ->
                            map[ruku] = downloader.status(ruku)
                        }
                    }
                    map
                }

                when (val s = screen) {
                    is Screen.Browse -> {
                        BrowseScreen(
                            vm = vm,
                            resume = savedPosition,
                            onResume = {
                                if (savedPosition != null) {
                                    val rukus = vm.rukusFor(savedPosition.para)
                                    controller.setQueue(savedPosition.para, rukus, savedPosition.rukuIndex)
                                    controller.seekTo(savedPosition.positionMs)
                                    controller.play()
                                    screen = Screen.Player(savedPosition.para, savedPosition.rukuIndex)
                                }
                            },
                            onOpen = { para, index ->
                                val rukus = vm.rukusFor(para)
                                controller.setQueue(para, rukus, index)
                                controller.play()
                                screen = Screen.Player(para, index)
                            },
                            onOpenSettings = { screen = Screen.Settings },
                            downloader = downloader,
                            downloadStatusMap = downloadStatusMap,
                            scope = scope,
                        )
                    }

                    is Screen.Player -> {
                        val rukus = vm.rukusFor(s.para)
                        val title = rukus.getOrNull(s.index)?.let {
                            "${it.surah} — ${it.surahArabic}"
                        } ?: "Para ${s.para}"

                        BackHandler {
                            screen = Screen.Browse
                        }

                        PlayerScreen(
                            title = title,
                            controller = controller,
                            rukus = rukus,
                            onBack = { screen = Screen.Browse },
                        )
                    }

                    is Screen.Settings -> {
                        BackHandler {
                            screen = Screen.Browse
                        }

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
