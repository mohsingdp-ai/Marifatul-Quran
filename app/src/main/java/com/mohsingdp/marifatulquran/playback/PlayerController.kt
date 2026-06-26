package com.mohsingdp.marifatulquran.playback

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.audioUrl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class PlayerUiState(
    val isPlaying: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val currentIndex: Int = 0,
)

class PlayerController(
    context: Context,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow(PlayerUiState())
    val state: StateFlow<PlayerUiState> = _state
    private var controller: MediaController? = null

    init {
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            controller = future.get().also { c ->
                c.addListener(object : Player.Listener {
                    override fun onEvents(player: Player, events: Player.Events) = pushState()
                })
            }
            startPolling()
        }, MoreExecutors.directExecutor())
    }

    // TODO(Phase 6): prefer downloaded local file when available
    private fun mediaItemFor(r: Ruku): MediaItem {
        return MediaItem.fromUri(audioUrl(r))
    }

    fun setQueue(rukus: List<Ruku>, startIndex: Int) {
        val c = controller ?: return
        c.setMediaItems(rukus.map { mediaItemFor(it) }, startIndex, 0L)
        c.prepare()
    }

    fun play() { controller?.play() }
    fun pause() { controller?.pause() }
    fun seekTo(ms: Long) { controller?.seekTo(ms) }
    fun setSpeed(speed: Float) { controller?.setPlaybackSpeed(speed) }

    private fun startPolling() = scope.launch(Dispatchers.Main) {
        while (true) { pushState(); delay(500) }
    }

    private fun pushState() {
        val c = controller ?: return
        _state.value = PlayerUiState(
            isPlaying = c.isPlaying,
            positionMs = c.currentPosition.coerceAtLeast(0),
            durationMs = c.duration.coerceAtLeast(0),
            currentIndex = c.currentMediaItemIndex,
        )
    }

    fun release() { controller?.release(); controller = null }
}
