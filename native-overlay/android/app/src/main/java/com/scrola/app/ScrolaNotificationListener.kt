package com.scrola.app

import android.content.ComponentName
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.util.Log
import org.json.JSONObject

/**
 * ScrolaNotificationListener
 *
 * Menggunakan MediaSessionManager (API resmi Android untuk membaca metadata pemutaran dari
 * aplikasi musik lain), BUKAN broadcast intent terbuka seperti com.android.music.metachanged
 * yang dipakai skema scrobbler lama. Keuntungan pendekatan ini:
 *  - Butuh izin eksplisit user (Settings > Notification access) — tidak bisa disuntik diam-diam
 *    oleh aplikasi lain di perangkat yang sama.
 *  - Tidak mengekspos exported BroadcastReceiver tanpa permission (lihat temuan F-04 di audit
 *    aplikasi Last.fm resmi — kita sengaja menghindari pola itu di Scrola).
 *
 * Alur data: service ini -> event ke JS lewat NowPlayingPlugin (notifyListeners) -> logika
 * eligibility & queue scrobble ditangani di lapisan JS/TS (lib/scrobbleEngine.ts).
 */
class ScrolaNotificationListener : NotificationListenerService() {

    /**
     * Status hidup listener, untuk diagnosis.
     *
     * KENAPA PERLU: memeriksa setelan "enabled_notification_listeners" saja TIDAK CUKUP. Setelan
     * bisa menyatakan izin diberikan sementara service-nya tidak pernah benar-benar tersambung —
     * dua penyebab nyata yang terdokumentasi:
     *  1. Android 13+ memblokir akses notifikasi untuk aplikasi yang dipasang di luar app store
     *     (sideload). Pengguna harus membuka App info > menu 3 titik > "Allow restricted settings"
     *     lebih dulu; tanpa itu izin tidak pernah benar-benar berlaku.
     *  2. Sebagian produsen (Samsung, Xiaomi, Huawei) mematikan proses aplikasi latar secara
     *     agresif, sehingga service dibunuh diam-diam setelah beberapa saat.
     *
     * Tanpa membedakan "izin tercentang" dari "service hidup" dan "data mengalir", kegagalan
     * scrobble tidak bisa didiagnosis sama sekali — persis kebuntuan yang kita alami.
     */
    companion object {
        @Volatile var isConnected: Boolean = false
            private set
        @Volatile var connectedAtMs: Long = 0L
            private set
        @Volatile var lastEventAtMs: Long = 0L
            private set
        @Volatile var lastEventPackage: String? = null
            private set
        @Volatile var totalEvents: Int = 0
            private set
        @Volatile var activeSessionCount: Int = 0
            private set

        /** Dipanggil setiap kali ada kabar dari aplikasi musik — penanda data BENAR-BENAR mengalir. */
        fun noteEvent(packageName: String?) {
            lastEventAtMs = System.currentTimeMillis()
            lastEventPackage = packageName
            totalEvents++
        }

        fun noteConnected(connected: Boolean) {
            isConnected = connected
            if (connected) connectedAtMs = System.currentTimeMillis()
        }

        fun noteSessions(count: Int) {
            activeSessionCount = count
        }
    }

    private var mediaSessionManager: MediaSessionManager? = null
    private val activeCallbacks = mutableMapOf<MediaController, MediaController.Callback>()

    private val sessionListener = MediaSessionManager.OnActiveSessionsChangedListener { controllers ->
        rebindControllers(controllers ?: emptyList())
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        noteConnected(true)
        mediaSessionManager = getSystemService(MediaSessionManager::class.java)
        val componentName = ComponentName(this, ScrolaNotificationListener::class.java)
        try {
            val controllers = mediaSessionManager?.getActiveSessions(componentName) ?: emptyList()
            rebindControllers(controllers)
            // removeOnActiveSessionsChangedListener dulu sebelum add — aman dipanggil walau belum
            // pernah terdaftar (no-op), tapi mencegah listener terdaftar dobel kalau
            // onListenerConnected() dipanggil ulang oleh sistem (bisa terjadi setelah rebind
            // paksa, bukan cuma sekali di awal seperti asumsi sebelumnya).
            mediaSessionManager?.removeOnActiveSessionsChangedListener(sessionListener)
            mediaSessionManager?.addOnActiveSessionsChangedListener(sessionListener, componentName)
        } catch (e: SecurityException) {
            Log.e("Scrola", "Notification access belum diberikan user", e)
        }
    }

    // Lifecycle simetris dari onListenerConnected — dipanggil sistem kalau akses notification
    // listener dicabut (mis. user menonaktifkan izin dari Settings) saat service masih berjalan.
    // Sebelumnya tidak ditangani sama sekali, jadi activeCallbacks & listener MediaSessionManager
    // tetap "menggantung" mereferensikan API yang aksesnya sudah dicabut sistem.
    override fun onListenerDisconnected() {
        noteConnected(false)
        cleanupAllCallbacks()
        super.onListenerDisconnected()
    }

    private fun cleanupAllCallbacks() {
        activeCallbacks.forEach { (controller, cb) -> controller.unregisterCallback(cb) }
        activeCallbacks.clear()
        mediaSessionManager?.removeOnActiveSessionsChangedListener(sessionListener)
        ScrobbleForegroundService.stop(applicationContext)
    }

    private fun rebindControllers(controllers: List<MediaController>) {
        noteSessions(controllers.size)
        // Lepas callback lama agar tidak leak
        activeCallbacks.forEach { (controller, cb) -> controller.unregisterCallback(cb) }
        activeCallbacks.clear()

        if (controllers.isEmpty()) {
            ScrobbleForegroundService.stop(applicationContext)
        }

        controllers.forEach { controller ->
            val callback = object : MediaController.Callback() {
                override fun onMetadataChanged(metadata: android.media.MediaMetadata?) {
                    emitNowPlaying(controller, metadata)
                }
                override fun onPlaybackStateChanged(state: PlaybackState?) {
                    emitPlaybackState(controller, state)
                }
            }
            controller.registerCallback(callback)
            activeCallbacks[controller] = callback
            // Kirim state awal segera setelah bind
            emitNowPlaying(controller, controller.metadata)
            emitPlaybackState(controller, controller.playbackState)
        }
    }

    private fun emitNowPlaying(controller: MediaController, metadata: android.media.MediaMetadata?) {
        if (metadata == null) return

        // Kalau ada lebih dari satu sesi media aktif sekaligus (mis. Spotify sedang diputar
        // sementara YouTube Music masih punya sesi ter-pause di background), controller yang
        // TIDAK sedang playing sebaiknya tidak menimpa state "current" di JS yang cuma
        // menyimpan satu track aktif. Tanpa filter ini, event dari sesi yang di-pause bisa
        // datang belakangan dan membuat UI menampilkan track yang salah / merusak pelacakan
        // eligibility scrobble milik track yang benar-benar sedang didengarkan.
        val isPlaying = controller.playbackState?.state == PlaybackState.STATE_PLAYING
        if (!isPlaying) return

        val artist = metadata.getString(android.media.MediaMetadata.METADATA_KEY_ARTIST) ?: ""
        val title = metadata.getString(android.media.MediaMetadata.METADATA_KEY_TITLE) ?: ""

        val payload = JSONObject().apply {
            put("packageName", controller.packageName)
            put("artist", artist)
            put("title", title)
            put("album", metadata.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM) ?: "")
            put("durationMs", metadata.getLong(android.media.MediaMetadata.METADATA_KEY_DURATION))
        }
        noteEvent(controller.packageName)
        NowPlayingPlugin.emit("nowPlayingChanged", payload)

        if (title.isNotEmpty()) {
            ScrobbleForegroundService.update(applicationContext, artist, title, isPlaying)
        }
    }

    private fun emitPlaybackState(controller: MediaController, state: PlaybackState?) {
        if (state == null) return

        // Filter yang sama seperti di emitNowPlaying: event dari sesi yang tidak playing
        // hanya boleh lewat kalau memang tidak ada sesi lain yang sedang playing (supaya
        // transisi ke "tidak ada yang diputar" tetap terkirim saat user pause satu-satunya
        // sesi aktif). Kalau ada sesi LAIN yang sedang playing, abaikan event dari sesi yang
        // di-pause ini supaya tidak menimpa state track yang sedang aktif.
        val anotherSessionPlaying = activeCallbacks.keys.any {
            it != controller && it.playbackState?.state == PlaybackState.STATE_PLAYING
        }
        if (state.state != PlaybackState.STATE_PLAYING && anotherSessionPlaying) return

        val payload = JSONObject().apply {
            put("packageName", controller.packageName)
            put("state", state.state) // PlaybackState.STATE_PLAYING dst.
            put("positionMs", state.position)
        }
        noteEvent(controller.packageName)
        NowPlayingPlugin.emit("playbackStateChanged", payload)

        val isPlaying = state.state == PlaybackState.STATE_PLAYING
        val metadata = controller.metadata
        val title = metadata?.getString(android.media.MediaMetadata.METADATA_KEY_TITLE) ?: ""
        if (title.isNotEmpty()) {
            val artist = metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ARTIST) ?: ""
            ScrobbleForegroundService.update(applicationContext, artist, title, isPlaying)
        }
    }

    override fun onDestroy() {
        cleanupAllCallbacks()
        super.onDestroy()
    }

    // NotificationListenerService mewajibkan override ini walau kita tidak butuh isi notifikasi.
    override fun onNotificationPosted(sbn: android.service.notification.StatusBarNotification?) {}
    override fun onNotificationRemoved(sbn: android.service.notification.StatusBarNotification?) {}
}
