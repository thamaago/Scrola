package com.scrola.app

import android.app.Notification
import android.content.ComponentName
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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

        /**
         * Himpunan paket pemutar yang PERNAH benar-benar terbaca (mengirim event) — mis.
         * com.spotify.music, com.google.android.apps.youtube.music, pemutar lokal, dst. Dipakai
         * Pengaturan untuk menampilkan daftar "sumber terdeteksi" agar cakupan lintas-pemutar bisa
         * diverifikasi langsung oleh pengguna. LinkedHashSet menjaga urutan pertama-terlihat;
         * dibungkus synchronized karena diakses dari thread callback maupun thread plugin.
         */
        val detectedPackages: MutableSet<String> =
            java.util.Collections.synchronizedSet(LinkedHashSet<String>())

        /** Dipanggil setiap kali ada kabar dari aplikasi musik — penanda data BENAR-BENAR mengalir. */
        fun noteEvent(packageName: String?) {
            lastEventAtMs = System.currentTimeMillis()
            lastEventPackage = packageName
            totalEvents++
            if (!packageName.isNullOrEmpty()) detectedPackages.add(packageName)
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

    /** Waktu pindai-ulang terakhir, untuk throttle onNotificationPosted (hindari pindai berlebihan). */
    private var lastRescanMs: Long = 0L

    // ---- Jalur scrobble LATAR (native) — Opsi 2 ----
    // Kelayakan + penangkapan scrobble berjalan di sini (di dalam listener yang hidup di latar),
    // BUKAN di JS/WebView yang dibekukan saat app ditutup. Lagu yang layak disimpan ke
    // PendingScrobbleStore; JS menyerapnya dan mengirim ke Last.fm saat app aktif.
    private val mainHandler = Handler(Looper.getMainLooper())
    private var tracker = ScrobbleTracker.create()
    private var trackStartedAtSec = 0L
    private var scrobbledTrackKey: String? = null
    private var eligibilityRunnable: Runnable? = null
    private var curArtist = ""
    private var curTitle = ""
    private var curAlbum = ""
    private var curDurationSec = 0
    private var curSourcePackage = ""

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
        // Lepas timer kelayakan yang mungkin masih tertunda supaya tidak ada Runnable menggantung
        // di main looper (menahan referensi) setelah listener terputus.
        eligibilityRunnable?.let { mainHandler.removeCallbacks(it) }
        eligibilityRunnable = null
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
                    // Saat play/resume, metadata sering TIDAK berubah sehingga onMetadataChanged
                    // tak menyala — padahal kartu "Sedang Diamati" & tracker butuh nowPlayingChanged.
                    // Jadi pancarkan KEDUANYA di sini (nowPlaying dulu agar metadata ter-set di sisi
                    // JS, baru playbackState untuk update tracker). Tanpa ini, sesi yang DIMULAI
                    // dalam keadaan pause lalu di-play (umum pada pemutar lokal) tak terdeteksi
                    // sampai metadatanya kebetulan berubah. emitNowPlaying punya gerbang isPlaying
                    // sendiri, jadi aman dipanggil walau sedang pause.
                    emitNowPlaying(controller, controller.metadata)
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

        // Artist/Title: sebagian pemutar terkenal tidak mengisi ARTIST/TITLE standar dan hanya
        // menaruh info di field "display" (mis. beberapa app menaruh judul di DISPLAY_TITLE dan
        // "Artist — Album" di DISPLAY_SUBTITLE). Kita jatuh ke field itu bila yang standar kosong,
        // supaya deteksi tetap dapat nama track alih-alih string kosong.
        var artist = metadata.getString(android.media.MediaMetadata.METADATA_KEY_ARTIST) ?: ""
        if (artist.isEmpty()) {
            artist = metadata.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM_ARTIST)
                ?: metadata.getString(android.media.MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)
                ?: ""
        }
        var title = metadata.getString(android.media.MediaMetadata.METADATA_KEY_TITLE) ?: ""
        if (title.isEmpty()) {
            title = metadata.getString(android.media.MediaMetadata.METADATA_KEY_DISPLAY_TITLE) ?: ""
        }

        // Durasi: sesi internal Scrola adalah MediaSession Media3, yang MediaMetadata-nya tidak
        // membawa durasi (Media3 menaruh durasi di timeline player, bukan metadata). Jadi
        // METADATA_KEY_DURATION untuk sesi kita sendiri = 0. Backfill dari cache durasi player
        // (thread-safe) supaya track internal memenuhi ambang scrobble berbasis durasi seperti
        // sumber lain. Untuk sumber eksternal yang juga melaporkan 0, jalur JS punya fallback
        // 4 menit (lihat playbackTimer.thresholdMsForDuration).
        var durationMs = metadata.getLong(android.media.MediaMetadata.METADATA_KEY_DURATION)
        if (durationMs <= 0L && controller.packageName == packageName) {
            durationMs = PlaybackService.instance?.lastKnownDurationMs ?: 0L
        }

        val album = metadata.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM) ?: ""

        // Simpan metadata terakhir untuk jalur scrobble LATAR native (dipakai processNativeTracker
        // yang dipanggil dari emitPlaybackState). Durasi memakai hasil backfill di atas.
        curArtist = artist
        curTitle = title
        curAlbum = album
        curDurationSec = if (durationMs > 0L) (durationMs / 1000L).toInt() else 0
        curSourcePackage = controller.packageName ?: ""

        val payload = JSONObject().apply {
            put("packageName", controller.packageName)
            put("artist", artist)
            put("title", title)
            put("album", album)
            put("durationMs", durationMs)
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
        // Jalankan tracker kelayakan NATIVE (jalur scrobble latar). Berjalan walau WebView tidur.
        processNativeTracker(isPlaying, state.position)

        val metadata = controller.metadata
        val title = metadata?.getString(android.media.MediaMetadata.METADATA_KEY_TITLE) ?: ""
        if (title.isNotEmpty()) {
            val artist = metadata?.getString(android.media.MediaMetadata.METADATA_KEY_ARTIST) ?: ""
            ScrobbleForegroundService.update(applicationContext, artist, title, isPlaying)
        }
    }

    /**
     * Memperbarui tracker kelayakan native dari sebuah event playback dan menjadwalkan ulang
     * pengecekan kelayakan. Dipanggil dari emitPlaybackState (thread callback MediaController).
     */
    private fun processNativeTracker(isPlaying: Boolean, positionMs: Long) {
        val artist = curArtist
        val title = curTitle
        if (artist.isEmpty() && title.isEmpty()) return
        val trackKey = "$artist::$title"
        val now = System.currentTimeMillis()

        val prevKey = tracker.trackKey
        // Deteksi lagu diulang SEBELUM applyEvent (memakai tracker lama). Kalau track sama tapi
        // diulang, guard scrobble harus dilepas supaya putaran baru bisa discrobble lagi.
        val repeat = trackKey == prevKey &&
            ScrobbleTracker.isRepeatEvent(tracker, positionMs, isPlaying, now)
        tracker = ScrobbleTracker.applyEvent(tracker, trackKey, isPlaying, curDurationSec, positionMs, now)

        if (trackKey != prevKey || repeat) {
            // Track baru / diulang: reset penanda + catat waktu mulai (timestamp scrobble, spek Last.fm).
            scrobbledTrackKey = null
            trackStartedAtSec = now / 1000L
        }
        rescheduleEligibility(trackKey)
    }

    /**
     * Pasang (atau ganti) timer yang berbunyi tepat saat track memenuhi ambang. Memakai mainHandler
     * (main looper) yang tetap hidup selama proses hidup — jadi berbunyi WALAU app tertutup. Saat
     * berbunyi, verifikasi ulang lalu simpan ke PendingScrobbleStore (tanpa filter preferensi;
     * filter "scrobble dari app lain" diterapkan JS saat menyerap).
     */
    private fun rescheduleEligibility(trackKey: String) {
        eligibilityRunnable?.let { mainHandler.removeCallbacks(it) }
        eligibilityRunnable = null
        if (scrobbledTrackKey == trackKey) return

        val wait = ScrobbleTracker.msUntilEligible(tracker, System.currentTimeMillis())
        if (wait == ScrobbleTracker.NEVER) return

        // Snapshot data track SEKARANG (closure) supaya benar walau cur* berubah saat timer menunggu.
        val artist = curArtist
        val title = curTitle
        val album = curAlbum
        val durationSec = curDurationSec
        val sourcePackage = curSourcePackage
        val startedAt = trackStartedAtSec

        val r = Runnable {
            eligibilityRunnable = null
            val tr = tracker
            if (tr.trackKey != trackKey) return@Runnable
            if (ScrobbleTracker.msUntilEligible(tr, System.currentTimeMillis()) > 0L) return@Runnable
            if (scrobbledTrackKey == trackKey) return@Runnable
            scrobbledTrackKey = trackKey
            PendingScrobbleStore.append(
                applicationContext,
                PendingScrobbleStore.Record(artist, title, album, durationSec, startedAt, sourcePackage)
            )
            NativeEventLog.append(
                applicationContext,
                "LATAR: layak & disimpan (pending) — $artist - $title (src=$sourcePackage)"
            )
        }
        eligibilityRunnable = r
        mainHandler.postDelayed(r, wait)
    }

    override fun onDestroy() {
        cleanupAllCallbacks()
        super.onDestroy()
    }

    // NotificationListenerService mewajibkan override ini walau kita tidak butuh isi notifikasi.
    override fun onNotificationPosted(sbn: android.service.notification.StatusBarNotification?) {
        // KENAPA: sebagian pemutar (khususnya YouTube Music) mendaftarkan MediaSession-nya ke
        // MediaSessionManager beberapa saat SETELAH notifikasi media-nya muncul, sehingga
        // onActiveSessionsChanged menyala terlambat dan deteksi terasa lambat dibanding Spotify
        // (yang sesinya muncul cepat). Notifikasi media biasanya tampil lebih dulu — jadi begitu
        // ada notifikasi kategori TRANSPORT (kontrol media), kita pindai ulang sesi aktif SEGERA.
        // Hanya bereaksi ke notifikasi media (bukan tiap notifikasi biasa) + di-throttle, dan
        // hanya rebind kalau kumpulan paket sesi benar-benar berubah — supaya tidak mengganggu
        // callback yang sudah berjalan untuk sesi yang sama.
        if (sbn?.notification?.category != Notification.CATEGORY_TRANSPORT) return
        rescanActiveSessions()
    }

    override fun onNotificationRemoved(sbn: android.service.notification.StatusBarNotification?) {}

    private fun rescanActiveSessions() {
        val now = System.currentTimeMillis()
        if (now - lastRescanMs < 1200) return // throttle: cukup sekali per ~1.2 detik
        val mgr = mediaSessionManager ?: return
        val component = ComponentName(this, ScrolaNotificationListener::class.java)
        try {
            val controllers = mgr.getActiveSessions(component)
            // Rebind hanya kalau kumpulan PAKET sesi berubah (sesi baru muncul / sesi hilang).
            // getActiveSessions mengembalikan instance controller baru tiap panggil, jadi kita
            // bandingkan lewat packageName, bukan identitas objek.
            val knownPkgs = activeCallbacks.keys.map { it.packageName }.toSet()
            val newPkgs = controllers.map { it.packageName }.toSet()
            if (newPkgs != knownPkgs) {
                lastRescanMs = now
                rebindControllers(controllers)
            }
        } catch (e: SecurityException) {
            // Izin akses notifikasi dicabut sistem — abaikan; onListenerDisconnected yang menangani.
        }
    }
}
