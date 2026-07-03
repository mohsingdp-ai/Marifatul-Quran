package com.mohsingdp.marifatulquran.download

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.mohsingdp.marifatulquran.R
import com.mohsingdp.marifatulquran.core.DownloadQueue
import com.mohsingdp.marifatulquran.core.DownloadStatus
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.rukuFor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Foreground service that downloads ruku audio off the UI/composition lifecycle, so downloads keep
 * running while the app is backgrounded or the screen is off. Work is drained from a bounded,
 * deduped FIFO queue one item at a time (avoiding the link saturation of the old parallel fan-out).
 * The service promotes itself to the foreground with an ongoing notification and stops itself once
 * the queue drains. Per-item status is published to [DownloadRegistry] for the UI to observe.
 */
class DownloadForegroundService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queue = DownloadQueue<Ruku>()
    private val draining = AtomicBoolean(false)
    private lateinit var downloader: Downloader
    // Guards enqueue vs. the drainer's stop decision so a concurrent start can't be stranded.
    private val stopLock = Any()
    private var lastStartId = 0

    override fun onCreate() {
        super.onCreate()
        downloader = Downloader(applicationContext)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundNow()
        val ruku = intent?.let(::rukuFromIntent)
        synchronized(stopLock) {
            lastStartId = startId
            if (ruku != null && DownloadRegistry.statusOf(ruku) != DownloadStatus.Downloaded) {
                if (queue.enqueue(ruku)) DownloadRegistry.set(ruku, DownloadStatus.Downloading)
            }
        }
        kick()
        return START_NOT_STICKY
    }

    /** Ensures a single drain coroutine runs, processing the queue sequentially until idle. */
    private fun kick() {
        if (!draining.compareAndSet(false, true)) return
        scope.launch {
            try {
                while (true) {
                    val next = queue.poll() ?: break
                    val result = downloader.download(next)
                    DownloadRegistry.set(next, result)
                    queue.complete(next)
                }
            } finally {
                draining.set(false)
            }
            // Decide to stop atomically with enqueue: holding stopLock, a concurrent onStartCommand
            // cannot slip an item past the isIdle() check, and lastStartId is the id in effect here
            // (so a newer start invalidates our stopSelf and keeps the service alive to drain it).
            val stopped = synchronized(stopLock) {
                if (queue.isIdle()) {
                    ServiceCompat.stopForeground(this@DownloadForegroundService, ServiceCompat.STOP_FOREGROUND_REMOVE)
                    stopSelf(lastStartId)
                    true
                } else {
                    false
                }
            }
            if (!stopped) kick()
        }
    }

    private fun startForegroundNow() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Downloading Quran audio")
            .setSmallIcon(R.drawable.ic_download)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Downloads",
                NotificationManager.IMPORTANCE_LOW,
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    /**
     * API 35+ enforces a daily time budget on dataSync foreground services; when it is exhausted
     * the system calls this and expects a prompt stop. (Never invoked on API ≤ 34.)
     */
    override fun onTimeout(startId: Int, fgsType: Int) {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        // Any item still Downloading is now orphaned (scope is about to be cancelled) — reset it so
        // the UI shows a retryable button instead of a stuck spinner. No-op after a normal drain.
        DownloadRegistry.markInterrupted()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun rukuFromIntent(intent: Intent): Ruku? {
        val para = intent.getIntExtra(EXTRA_PARA, -1)
        val rukuInPara = intent.getStringExtra(EXTRA_RUKU) ?: return null
        if (para == -1) return null
        return rukuFor(para, rukuInPara)
    }

    companion object {
        private const val CHANNEL_ID = "downloads"
        private const val NOTIFICATION_ID = 4201
        private const val EXTRA_PARA = "para"
        private const val EXTRA_RUKU = "ruku"

        /** Enqueue a ruku for background download, starting the service if needed. */
        fun enqueue(context: Context, ruku: Ruku) {
            val intent = Intent(context, DownloadForegroundService::class.java)
                .putExtra(EXTRA_PARA, ruku.para)
                .putExtra(EXTRA_RUKU, ruku.rukuInPara)
            ContextCompat.startForegroundService(context, intent)
        }
    }
}
