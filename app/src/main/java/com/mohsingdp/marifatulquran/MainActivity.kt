package com.mohsingdp.marifatulquran

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.mohsingdp.marifatulquran.data.DefaultRukuRepository
import com.mohsingdp.marifatulquran.data.Prefs
import com.mohsingdp.marifatulquran.data.SavedPosition
import com.mohsingdp.marifatulquran.playback.PlayerController
import com.mohsingdp.marifatulquran.ui.BrowseScreen
import com.mohsingdp.marifatulquran.ui.BrowseViewModel
import com.mohsingdp.marifatulquran.ui.PlayerScreen
import com.mohsingdp.marifatulquran.ui.theme.MarifatulTheme

sealed interface Screen {
    data object Browse : Screen
    data class Player(val para: Int, val index: Int) : Screen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MarifatulTheme {
                val vm = remember { BrowseViewModel(DefaultRukuRepository()) }
                val scope = rememberCoroutineScope()
                val prefs = remember { Prefs(this@MainActivity) }
                val controller = remember { PlayerController(this@MainActivity, scope, prefs) }
                var screen by remember { mutableStateOf<Screen>(Screen.Browse) }

                // Read saved position once on first composition
                val savedPosition: SavedPosition? = remember { prefs.lastPosition() }

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
                                // Set the queue to all rukus of the tapped para, starting at tapped index
                                val rukus = vm.rukusFor(para)
                                controller.setQueue(para, rukus, index)
                                controller.play()
                                screen = Screen.Player(para, index)
                            },
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
                            onBack = { screen = Screen.Browse },
                        )
                    }
                }
            }
        }
    }
}
