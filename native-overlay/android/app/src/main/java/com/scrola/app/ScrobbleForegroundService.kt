package com.scrola.app

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

/**
 * ScrobbleForegroundService
 *
 * Menampilkan notifikasi persisten "sedang diputar" selagi Scrola aktif mendeteksi musik —
 * pola yang sama dengan TimerForegroundService di Simmer. Dikontrol lewat companion object
 * (start/update/stop) yang dipanggil dari ScrolaNotificationListener setiap kali metadata atau
 * status playback berubah, BUKAN dipanggil langsung dari JS (biar tetap hidup walau Activity
 * di-destroy, sama seperti alasan Simmer memisahkan timer dari lifecycle UI).
 *
 * CATATAN foregroundServiceType — KEPUTUSAN SUDAH DIAMBIL: "dataSync".
 * Service ini MENDETEKSI musik & MENGIRIM scrobble ke Last.fm — tidak memutar media apa pun
 * (yang memutar adalah PlaybackService, yang memang bertipe mediaPlayback). Sejak Android 14
 * (API 34) Google memverifikasi tipe FGS sesuai fungsi sebenarnya; "mediaPlayback" untuk service
 * yang tidak memutar media berisiko ditolak review Play Store. "dataSync" (transfer data ke
 * server) adalah kategori resmi yang paling jujur untuk pengiriman scrobble, dan tidak butuh
 * justifikasi manual seperti "specialUse". Manifest & kedua panggilan startForeground() di bawah
 * sudah disesuaikan (bentuk 3-argumen dengan FOREGROUND_SERVICE_TYPE_DATA_SYNC di API 29+).
 */
class ScrobbleForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "now_playing_channel"
        private const val NOTIFICATION_ID = 1001

        private const val ACTION_UPDATE = "com.scrola.app.action.UPDATE_NOW_PLAYING"
        private const val ACTION_STOP = "com.scrola.app.action.STOP"
        private const val EXTRA_ARTIST = "extra_artist"
        private const val EXTRA_TITLE = "extra_title"
        private const val EXTRA_PLAYING = "extra_playing"

        /**
         * Setelah playback dijeda/diam selama ini, notifikasi Scrola dihapus otomatis (service
         * di-stop) supaya tidak terus menampilkan lagu terakhir padahal tak ada yang diputar. Muncul
         * lagi otomatis saat listener mendeteksi playback baru (memanggil update()).
         */
        private const val IDLE_DISMISS_MS = 120_000L

        fun update(context: Context, artist: String, title: String, isPlaying: Boolean) {
            val intent = Intent(context, ScrobbleForegroundService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_ARTIST, artist)
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_PLAYING, isPlaying)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ScrobbleForegroundService::class.java))
        }
    }

    private val idleHandler = Handler(Looper.getMainLooper())
    private var dismissRunnable: Runnable? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                // PENTING: kalau service ini di-start lewat startForegroundService() (yang terjadi
                // di update() pada Android O+), sistem MEWAJIBKAN startForeground() dipanggil dalam
                // ~5 detik — kalau tidak, app di-crash dengan ForegroundServiceDidNotStartInTimeException.
                // Karena ACTION_STOP secara teori bisa tiba lewat jalur start-foreground itu, kita
                // tetap panggil startForeground() sekejap dulu baru langsung stop, alih-alih
                // langsung stopForeground tanpa pernah masuk state foreground (yang memicu crash).
                cancelIdleDismiss()
                startForegroundCompat(buildNotification("", "", false))
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            else -> {
                val artist = intent?.getStringExtra(EXTRA_ARTIST) ?: ""
                val title = intent?.getStringExtra(EXTRA_TITLE) ?: ""
                val isPlaying = intent?.getBooleanExtra(EXTRA_PLAYING, false) ?: false
                startForegroundCompat(buildNotification(artist, title, isPlaying))
                // Saat benar-benar diputar, jangan hapus. Saat dijeda/diam, jadwalkan hapus otomatis
                // supaya notifikasi tak menggantung dengan lagu terakhir. Playback baru → update()
                // dipanggil lagi → notifikasi muncul kembali.
                if (isPlaying) cancelIdleDismiss() else scheduleIdleDismiss()
            }
        }
        return START_STICKY
    }

    private fun scheduleIdleDismiss() {
        cancelIdleDismiss()
        val r = Runnable {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        dismissRunnable = r
        idleHandler.postDelayed(r, IDLE_DISMISS_MS)
    }

    private fun cancelIdleDismiss() {
        dismissRunnable?.let { idleHandler.removeCallbacks(it) }
        dismissRunnable = null
    }

    override fun onDestroy() {
        cancelIdleDismiss()
        super.onDestroy()
    }

    /**
     * startForeground dengan tipe FGS eksplisit di API 29+ (bentuk 3-argumen baru ada sejak Q).
     * Menyebut FOREGROUND_SERVICE_TYPE_DATA_SYNC secara eksplisit membuat niat service ini jelas
     * bagi sistem & reviewer Play Store — konsisten dengan foregroundServiceType="dataSync" di
     * manifest. Di bawah API 29 cukup bentuk 2-argumen (tipe diambil dari manifest).
     */
    private fun startForegroundCompat(notification: android.app.Notification) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(artist: String, title: String, isPlaying: Boolean): Notification {
        // Sama seperti di PlaybackService: getLaunchIntentForPackage bisa null dan sebelumnya
        // langsung menyebabkan NPE di PendingIntent.getActivity(), meng-crash notifikasi ini.
        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
            ?: Intent(this, MainActivity::class.java)
        val contentIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(if (title.isNotEmpty()) title else getString(R.string.notification_now_playing_idle))
            .setContentText(artist)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
