package com.scrola.app

import android.app.PendingIntent
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * PlaybackService
 *
 * Player internal Scrola dibungkus sebagai MediaSessionService (Media3) — BUKAN sekadar
 * ExoPlayer biasa. Alasannya penting secara arsitektur: ScrolaNotificationListener membaca
 * now-playing lewat MediaSessionManager.getActiveSessions(), yang mencakup SEMUA sesi media
 * aktif di sistem (termasuk milik app sendiri) begitu izin Notification Access diberikan.
 *
 * Konsekuensinya: lagu yang diputar dari player internal Scrola otomatis mengalir lewat
 * pipeline scrobble yang SAMA PERSIS dengan lagu dari Spotify/YouTube Music — tidak perlu
 * jalur kode terpisah untuk "sumber sendiri" vs "sumber lain". packageName yang muncul di
 * event NowPlayingPlugin akan bernilai "com.scrola.app" saat memutar dari sini.
 *
 * CATATAN JEJAK MEMORI: service ini memutar FILE LOKAL, bukan streaming dari jaringan, jadi
 * buffer ExoPlayer sengaja dibuat jauh lebih kecil dari default (yang dirancang untuk streaming
 * adaptif). Service juga otomatis stop sendiri beberapa saat setelah playback selesai supaya
 * ExoPlayer + MediaSession tidak terus menghuni RAM padahal tidak ada yang diputar.
 */
class PlaybackService : MediaSessionService() {

    private var exoPlayer: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var idleStopRunnable: Runnable? = null

    /**
     * Durasi track internal yang sedang dimuat, di-cache agar bisa dibaca LINTAS-THREAD dengan aman.
     * ExoPlayer hanya boleh diakses dari main thread, sedangkan ScrolaNotificationListener (yang
     * perlu durasi ini untuk backfill) berjalan di thread callback MediaController. `@Volatile`
     * membuat pembacaan aman tanpa menyentuh objek ExoPlayer. Di-update HANYA di main thread saat
     * player READY. Alasan keberadaannya: MediaMetadata Media3 tidak punya field durasi, jadi
     * sesi internal muncul di MediaSessionManager tanpa METADATA_KEY_DURATION → tanpa backfill ini
     * lagu yang diputar Scrola sendiri tak pernah memenuhi ambang scrobble berbasis durasi.
     */
    @Volatile
    var lastKnownDurationMs: Long = 0L
        private set

    override fun onCreate() {
        super.onCreate()

        // Buffer default ExoPlayer (DefaultLoadControl) dirancang untuk streaming adaptif dari
        // jaringan (bisa menahan puluhan MB di buffer). Untuk file lokal yang dibaca langsung
        // dari penyimpanan device, buffer sekecil ini sudah lebih dari cukup dan menghemat RAM
        // signifikan dibanding nilai default.
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                /* minBufferMs = */ 15_000,
                /* maxBufferMs = */ 30_000,
                /* bufferForPlaybackMs = */ 1_000,
                /* bufferForPlaybackAfterRebufferMs = */ 2_000
            )
            .build()

        val player = ExoPlayer.Builder(this)
            .setLoadControl(loadControl)
            // AudioAttributes: memberi tahu Android bahwa ini pemutaran MUSIK. Ini BUKAN
            // "peningkatan kualitas" (Scrola tidak memproses audio — file diteruskan apa adanya ke
            // sistem audio, kualitasnya ditentukan file sumber + DAC perangkat). Ini soal PERILAKU
            // yang benar sebagai pemutar musik:
            // - handleAudioFocus=true: otomatis meredup/berhenti saat ada telepon/notifikasi lalu
            //   melanjutkan setelahnya, alih-alih menabrak audio aplikasi lain.
            // - USAGE_MEDIA + CONTENT_TYPE_MUSIC: Android merutekan ke jalur & kurva volume musik
            //   (mis. mengikuti volume media, bukan volume dering).
            .setAudioAttributes(
                androidx.media3.common.AudioAttributes.Builder()
                    .setUsage(androidx.media3.common.C.USAGE_MEDIA)
                    .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true
            )
            // Auto-pause saat headphone/Bluetooth dicabut — perilaku yang diharapkan setiap
            // pemutar musik (tanpa ini, lagu tiba-tiba menggelegar dari speaker HP saat earphone
            // tercabut, mengganggu & memalukan di tempat umum).
            .setHandleAudioBecomingNoisy(true)
            // WAKE_MODE_LOCAL: tahan partial wake lock (CPU) selama memutar file LOKAL, supaya
            // pemutaran tidak tersendat/berhenti saat layar mati atau perangkat masuk mode idle
            // (Doze). Ini penyebab utama "musik stuttering & berhenti sebelum selesai". Butuh izin
            // WAKE_LOCK di manifest. Wake lock otomatis dilepas ExoPlayer saat pause/stop/selesai.
            .setWakeMode(androidx.media3.common.C.WAKE_MODE_LOCAL)
            .build().apply {
                addListener(object : Player.Listener {
                    override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                        // Kalau pemutaran berhenti karena error (decode/IO), catat SEBABNYA ke Log
                        // Peristiwa supaya bisa didiagnosis di perangkat alih-alih berhenti diam-diam.
                        NativeEventLog.append(
                            applicationContext,
                            "PEMUTAR: error — ${error.errorCodeName}: ${error.message ?: "?"}"
                        )
                    }

                    override fun onMediaItemTransition(
                        item: MediaItem?,
                        reason: Int
                    ) {
                        // Saat pindah track dalam antrean (auto-advance gapless atau next/prev),
                        // beri tahu JS indeks baru supaya QueueState.position tetap sinkron.
                        val idx = exoPlayer?.currentMediaItemIndex ?: 0
                        val payload = org.json.JSONObject().apply { put("index", idx) }
                        PlayerPlugin.emit("queueIndexChanged", payload)
                    }

                    override fun onMetadata(metadata: androidx.media3.common.Metadata) {
                        // ReplayGain: samakan loudness antar-lagu. Gain dibaca dari tag yang sudah
                        // di-parse ExoPlayer (ID3 TXXX / Vorbis comment). Volume clip-safe (<=1.0).
                        val raw = extractTrackGain(metadata) ?: return
                        val vol = ReplayGain.volumeFromTag(raw) ?: return
                        exoPlayer?.volume = vol
                        NativeEventLog.append(
                            applicationContext,
                            "PEMUTAR: ReplayGain $raw -> volume ${"%.2f".format(vol)}"
                        )
                    }

                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == Player.STATE_READY) {
                            // Durasi baru diketahui setelah READY. Simpan ke cache lintas-thread
                            // supaya listener bisa mem-backfill METADATA_KEY_DURATION yang kosong.
                            val d = exoPlayer?.duration ?: 0L
                            if (d > 0L) lastKnownDurationMs = d
                        }
                        if (state == Player.STATE_ENDED) {
                            lastKnownDurationMs = 0L
                            PlayerPlugin.emit("playbackEnded", null)
                            scheduleIdleStop()
                        } else {
                            cancelIdleStop()
                        }
                    }
                })
            }
        exoPlayer = player

        // getLaunchIntentForPackage BISA mengembalikan null di kondisi tertentu (mis. tepat
        // setelah install sebelum launcher selesai resolve activity) — sebelumnya nilai null ini
        // langsung dilempar ke PendingIntent.getActivity() dan menyebabkan NullPointerException
        // yang meng-crash seluruh service. Sekarang fallback ke Intent eksplisit ke MainActivity.
        val sessionActivityIntent = packageManager.getLaunchIntentForPackage(packageName)
            ?: Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, sessionActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        mediaSession = MediaSession.Builder(this, player)
            .setSessionActivity(pendingIntent)
            .build()

        PlaybackService.instance = this
    }

    /**
     * Beberapa detik setelah track selesai TANPA ada track baru dimuat, matikan service supaya
     * ExoPlayer + MediaSession dilepas dari memori — daripada terus idle menghuni RAM menunggu
     * user kembali (yang mungkin tidak akan segera terjadi).
     */
    private fun scheduleIdleStop() {
        cancelIdleStop()
        idleStopRunnable = Runnable {
            if (exoPlayer?.playbackState == Player.STATE_ENDED) {
                stopSelf()
            }
        }
        mainHandler.postDelayed(idleStopRunnable!!, 10_000)
    }

    private fun cancelIdleStop() {
        idleStopRunnable?.let { mainHandler.removeCallbacks(it) }
        idleStopRunnable = null
    }

    /**
     * Ambil nilai REPLAYGAIN_TRACK_GAIN dari metadata yang di-parse ExoPlayer. Memakai REFLEKSI
     * field publik (description/text untuk ID3 TXXX, key/value untuk Vorbis comment) supaya TIDAK
     * bergantung pada nama kelas Media3 yang bisa berbeda antar-versi — kalau field tak ada, fitur
     * ini cukup nonaktif diam-diam (tak crash, tak gagal build). null bila tak ada tag gain.
     */
    private fun extractTrackGain(metadata: androidx.media3.common.Metadata): String? {
        for (i in 0 until metadata.length()) {
            val e: Any = metadata.get(i) ?: continue
            val keyName = readStringField(e, "description") ?: readStringField(e, "key") ?: continue
            if (!ReplayGain.isTrackGainKey(keyName)) continue
            val value = readStringField(e, "text") ?: readStringField(e, "value") ?: continue
            return value
        }
        return null
    }

    private fun readStringField(obj: Any, field: String): String? = try {
        (obj.javaClass.getField(field).get(obj) as? String)
    } catch (e: Exception) {
        null
    }

    fun playUri(uri: String, title: String, artist: String, albumArtBytes: ByteArray? = null) {
        cancelIdleStop()
        lastKnownDurationMs = 0L // track baru: durasi lama tidak berlaku sampai READY lagi
        val player = exoPlayer ?: return
        // Reset volume ke unity untuk track baru: kalau track sebelumnya diredam ReplayGain, track
        // ini harus mulai penuh dulu; onMetadata akan menyesuaikan lagi bila ada tag gain.
        player.volume = 1.0f
        val metadataBuilder = androidx.media3.common.MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist)
        if (albumArtBytes != null) {
            metadataBuilder.setArtworkData(albumArtBytes, androidx.media3.common.MediaMetadata.PICTURE_TYPE_FRONT_COVER)
        }
        val mediaItem = MediaItem.Builder()
            .setUri(uri)
            .setMediaMetadata(metadataBuilder.build())
            .build()
        player.setMediaItem(mediaItem)
        player.prepare()
        player.play()
    }

    /** Satu entri antrean dari sisi JS (metadata dasar; art di-skip untuk antrean demi hemat). */
    data class QueueItem(val uri: String, val title: String, val artist: String)

    /**
     * Putar SEBUAH ANTREAN via setMediaItems -> GAPLESS otomatis di Media3 untuk format kompatibel.
     * `items` sudah dalam urutan main final dari JS (playbackQueue.orderedUris; shuffle ditangani JS).
     * Repeat ditangani ExoPlayer via setRepeatMode agar loop-nya juga gapless. Volume di-reset;
     * onMetadata akan menyesuaikan ReplayGain per track.
     */
    fun playQueue(items: List<QueueItem>, startIndex: Int) {
        cancelIdleStop()
        lastKnownDurationMs = 0L
        val player = exoPlayer ?: return
        if (items.isEmpty()) return
        player.volume = 1.0f
        val mediaItems = items.map {
            MediaItem.Builder()
                .setUri(it.uri)
                .setMediaMetadata(
                    androidx.media3.common.MediaMetadata.Builder()
                        .setTitle(it.title)
                        .setArtist(it.artist)
                        .build()
                )
                .build()
        }
        val start = startIndex.coerceIn(0, mediaItems.size - 1)
        player.setMediaItems(mediaItems, start, 0L)
        player.playWhenReady = true
        player.prepare()
    }

    /** Repeat ditangani native (loop gapless). JS tetap sumber kebenaran urutan (shuffle). */
    fun setRepeatMode(mode: String) {
        exoPlayer?.repeatMode = when (mode) {
            "all" -> Player.REPEAT_MODE_ALL
            "one" -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
    }

    fun skipNext() = exoPlayer?.seekToNextMediaItem() ?: Unit
    fun skipPrev() = exoPlayer?.seekToPreviousMediaItem() ?: Unit
    fun skipToIndex(index: Int) = exoPlayer?.seekToDefaultPosition(index) ?: Unit
    fun currentQueueIndex(): Int = exoPlayer?.currentMediaItemIndex ?: 0

    // PERINGATAN THREAD: SEMUA method di bawah ini menyentuh ExoPlayer, yang MENOLAK diakses dari
    // thread selain main dan melempar IllegalStateException ("Player is accessed on the wrong
    // thread"). Ini berlaku untuk PEMBACAAN juga (currentPositionMs/durationMs/isPlaying), bukan
    // cuma perintah. Pemanggil dari PlayerPlugin WAJIB membungkusnya dengan mainHandler.post {},
    // karena method @PluginMethod Capacitor berjalan di thread 'CapacitorPlugins'.
    // Pernah menyebabkan crash nyata saat menekan pause di perangkat.
    fun pause() = exoPlayer?.pause()
    fun resume() = exoPlayer?.play()
    fun seekTo(positionMs: Long) = exoPlayer?.seekTo(positionMs)
    fun currentPositionMs(): Long = exoPlayer?.currentPosition ?: 0L
    fun durationMs(): Long = exoPlayer?.duration?.coerceAtLeast(0) ?: 0L
    fun isPlaying(): Boolean = exoPlayer?.isPlaying ?: false

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onDestroy() {
        cancelIdleStop()
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        instance = null
        super.onDestroy()
    }

    // Media3 versi terbaru mewajibkan override ini untuk menangani task-removed saat tidak playing.
    override fun onTaskRemoved(rootIntent: Intent?) {
        val player = exoPlayer
        if (player == null || !player.playWhenReady || player.mediaItemCount == 0) {
            stopSelf()
        }
        super.onTaskRemoved(rootIntent)
    }

    companion object {
        var instance: PlaybackService? = null
    }
}
