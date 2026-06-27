package com.mohsingdp.marifatulquran.playback

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import com.mohsingdp.marifatulquran.core.PlaybackMode
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.audioUrl
import com.mohsingdp.marifatulquran.data.Prefs
import com.mohsingdp.marifatulquran.download.Downloader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class PlayerUiState(
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val currentIndex: Int = 0,
)

class PlayerController(
    context: Context,
    private val scope: CoroutineScope,
    private val prefs: Prefs,
    private val downloader: Downloader,
) {
    private val _state = MutableStateFlow(PlayerUiState())
    val state: StateFlow<PlayerUiState> = _state
    private var controller: MediaController? = null

    /** The para currently loaded in the queue; updated on every setQueue call. */
    private var currentPara: Int = -1

    /** Current playback mode — persisted to prefs on change. Default NONE. */
    private var currentMode: PlaybackMode = PlaybackMode.NONE

    init {
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            controller = future.get().also { c ->
                c.addListener(object : Player.Listener {
                    override fun onEvents(player: Player, events: Player.Events) = pushState()
                    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                        // When ExoPlayer auto-advances (reason=AUTO) and mode is NONE, stop playback
                        if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && currentMode == PlaybackMode.NONE) {
                            controller?.pause()
                        }
                    }
                })
                // Apply the persisted playback mode right after connecting
                val savedMode = prefs.getPlaybackMode()
                currentMode = savedMode
                applyRepeatMode(c, savedMode)
            }
            startPolling()
        }, MoreExecutors.directExecutor())
    }

    /** Apply playback mode: update repeat mode on the controller and remember it. */
    fun applyPlaybackMode(m: PlaybackMode) {
        currentMode = m
        controller?.let { applyRepeatMode(it, m) }
    }

    private fun applyRepeatMode(c: MediaController, m: PlaybackMode) {
        c.repeatMode = if (m == PlaybackMode.LOOP) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
    }

    /** Offline-first: use local file if it exists, else stream from network. */
    private fun mediaItemFor(r: Ruku): MediaItem {
        val localFile = downloader.localFile(r)
        return if (localFile.exists()) {
            MediaItem.fromUri(Uri.fromFile(localFile))
        } else {
            MediaItem.fromUri(audioUrl(r))
        }
    }

    fun setQueue(para: Int, rukus: List<Ruku>, startIndex: Int) {
        currentPara = para
        val c = controller ?: return
        c.setMediaItems(rukus.map { mediaItemFor(it) }, startIndex, 0L)
        c.prepare()
        // Re-apply mode so repeat/stop behaviour is correct for this queue
        applyRepeatMode(c, currentMode)
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
        val state = PlayerUiState(
            isPlaying = c.isPlaying,
            // Loading = user has requested playback but audio hasn't started yet
            // (e.g. streaming/buffering the file). Drives the play-button spinner.
            isBuffering = c.playWhenReady && c.playbackState == Player.STATE_BUFFERING,
            positionMs = c.currentPosition.coerceAtLeast(0),
            durationMs = c.duration.coerceAtLeast(0),
            currentIndex = c.currentMediaItemIndex,
        )
        _state.value = state
        // Save position whenever playing so on resume we can pick up where we left off.
        if (state.isPlaying && currentPara != -1) {
            prefs.savePosition(currentPara, state.currentIndex, state.positionMs)
        }
    }

    fun release() { controller?.release(); controller = null }
}
