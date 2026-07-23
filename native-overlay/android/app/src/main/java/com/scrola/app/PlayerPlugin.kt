package com.scrola.app

import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * PlayerPlugin
 *
 * Jembatan JS <-> PlaybackService (ExoPlayer + MediaSession). Pemilihan file memakai
 * Storage Access Framework (ACTION_OPEN_DOCUMENT) — TIDAK meminta permission
 * READ_MEDIA_AUDIO/READ_EXTERNAL_STORAGE, karena kita hanya butuh akses ke file yang
 * dipilih user secara eksplisit lewat picker sistem, bukan memindai seluruh library.
 */
@CapacitorPlugin(name = "Player")
class PlayerPlugin : Plugin() {

    companion object {
        private var instance: PlayerPlugin? = null
        private val mainHandler = Handler(Looper.getMainLooper())
        private var positionPollRunnable: Runnable? = null

        fun emit(eventName: String, data: JSONObject?) {
            instance?.notifyListeners(eventName, data?.let { JSObject.fromJSONObject(it) } ?: JSObject())
        }
    }

    override fun load() {
        super.load()
        instance = this
        startPositionPolling()
    }

    /**
     * Poll posisi playback tiap 1 detik untuk dikirim ke JS (dipakai progress bar & eligibility
     * check). Dihentikan di handleOnDestroy() — sebelumnya loop ini tidak pernah berhenti sama
     * sekali selama proses app hidup, terus memakai CPU/baterai walau plugin/WebView sudah
     * tidak dipakai lagi.
     */
    private fun startPositionPolling() {
        positionPollRunnable = object : Runnable {
            override fun run() {
                val service = PlaybackService.instance
                if (service != null) {
                    val payload = JSONObject().apply {
                        put("positionMs", service.currentPositionMs())
                        put("durationMs", service.durationMs())
                        put("isPlaying", service.isPlaying())
                    }
                    emit("playerPositionChanged", payload)
                }
                mainHandler.postDelayed(this, 1000)
            }
        }
        mainHandler.post(positionPollRunnable!!)
    }

    override fun handleOnDestroy() {
        positionPollRunnable?.let { mainHandler.removeCallbacks(it) }
        if (instance === this) instance = null
        super.handleOnDestroy()
    }

    private fun ensureServiceStarted() {
        if (PlaybackService.instance == null) {
            val intent = Intent(context, PlaybackService::class.java)
            context.startService(intent)
        }
    }

    /**
     * Tunggu sampai PlaybackService selesai onCreate() sebelum memanggil playUri(), dengan
     * polling singkat alih-alih delay tetap 300ms. Delay tetap sebelumnya adalah tebakan yang
     * rapuh — di perangkat lambat, ExoPlayer.Builder(...).build() bisa memakan waktu lebih dari
     * 300ms sehingga playUri() diam-diam tidak pernah terpanggil tanpa ada error apa pun.
     */
    private fun waitForServiceAndRun(maxWaitMs: Long = 2000, intervalMs: Long = 50, onReady: (PlaybackService) -> Unit, onTimeout: () -> Unit) {
        val deadline = System.currentTimeMillis() + maxWaitMs
        val poll = object : Runnable {
            override fun run() {
                val service = PlaybackService.instance
                when {
                    service != null -> onReady(service)
                    System.currentTimeMillis() >= deadline -> onTimeout()
                    else -> mainHandler.postDelayed(this, intervalMs)
                }
            }
        }
        mainHandler.post(poll)
    }

    @PluginMethod
    fun pickAndPlay(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "audio/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        startActivityForResult(call, intent, "pickAudioResult")
    }

    // call bertipe nullable: Capacitor bisa memanggil ActivityCallback dengan call == null kalau
    // Activity sempat di-recreate (mis. karena rotasi layar atau proses dimatikan sistem) dan
    // referensi PluginCall yang tersimpan hilang. Sebelumnya parameter ini bertipe non-null
    // (PluginCall) padahal kondisi ini nyata bisa terjadi lewat jalur reflection Capacitor.
    @ActivityCallback
    private fun pickAudioResult(call: PluginCall?, result: androidx.activity.result.ActivityResult) {
        if (call == null) return
        try {
            val uri = result.data?.data
            if (uri == null) {
                call.reject("Tidak ada file dipilih")
                return
            }
            // Simpan izin akses jangka panjang agar tidak perlu pilih ulang tiap buka app.
            // Bisa throw SecurityException di beberapa document provider non-standar — dibungkus
            // try/catch di luar supaya tidak meng-crash app / membuat Promise JS menggantung.
            context.contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            )

            val metadata = extractMetadataFromUri(uri.toString())

            ensureServiceStarted()
            waitForServiceAndRun(
                onReady = { service ->
                    service.playUri(uri.toString(), metadata.title, metadata.artist, metadata.albumArtBytes)
                    val res = JSObject()
                    res.put("uri", uri.toString())
                    res.put("title", metadata.title)
                    res.put("artist", metadata.artist)
                    res.put("albumArt", metadata.albumArtDataUri)
                    call.resolve(res)
                },
                onTimeout = {
                    call.reject("Player tidak siap tepat waktu, coba lagi")
                }
            )
        } catch (e: Exception) {
            call.reject("Gagal memutar file yang dipilih: ${e.message}", e)
        }
    }

    private data class TrackMetadata(
        val title: String,
        val artist: String,
        val albumArtBytes: ByteArray?,
        val albumArtDataUri: String?,
    )

    private fun extractMetadataFromUri(uriString: String): TrackMetadata {
        val retriever = android.media.MediaMetadataRetriever()
        return try {
            retriever.setDataSource(context, android.net.Uri.parse(uriString))
            val title = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_TITLE)
                ?: uriString.substringAfterLast('/').substringBeforeLast('.')
            val artist = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_ARTIST)
                ?: "Tidak dikenal"

            // getEmbeddedPicture() mengembalikan byte JPEG/PNG mentah kalau file punya artwork
            // ter-embed (tag ID3 APIC dsb) — banyak file lokal TIDAK punya ini, jadi selalu null-safe.
            val artBytes = try {
                retriever.embeddedPicture
            } catch (e: Exception) {
                null
            }
            // Batasi ukuran DAN dimensi artwork sebelum dipakai di DUA tempat: dikirim ke JS
            // lewat base64 (data URI) MAUPUN dipasang sebagai artwork MediaSession (lock screen
            // dsb). Sengaja pakai byte yang SAMA-SAMA sudah di-downscale untuk keduanya — kalau
            // hanya versi JS yang dikecilkan sementara MediaSession tetap pakai artBytes asli,
            // sisi native/sistem (lock screen widget dll) tetap menanggung beban decode gambar
            // besar yang sama, bertentangan dengan prinsip "ringan" yang sudah ditetapkan untuk
            // app ini secara keseluruhan.
            val downscaled = artBytes?.let { ImageUtils.downscaleIfNeeded(it) }
            val safeBytes = downscaled?.first
            val dataUri = downscaled?.let { (bytes, mime) ->
                "data:$mime;base64," + android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
            }

            TrackMetadata(title, artist, safeBytes, dataUri)
        } catch (e: Exception) {
            TrackMetadata(uriString.substringAfterLast('/'), "Tidak dikenal", null, null)
        } finally {
            retriever.release()
        }
    }

    // CATATAN THREAD — WAJIB dibaca sebelum menambah method yang menyentuh player:
    //
    // ExoPlayer MENOLAK diakses dari thread selain thread tempat ia dibuat (main/UI thread), dan
    // melempar IllegalStateException "Player is accessed on the wrong thread". Sementara itu,
    // method @PluginMethod Capacitor dijalankan di thread latar bernama 'CapacitorPlugins',
    // BUKAN main. Jadi setiap pemanggilan player dari sini HARUS di-post ke mainHandler dulu.
    //
    // Ini berlaku untuk pembacaan juga (posisi/durasi/isPlaying), bukan hanya perintah — karena
    // itu getState() pun ikut dibungkus dan call.resolve() dipindah ke DALAM blok main thread.
    // Capacitor mengizinkan call diselesaikan secara asinkron, jadi ini aman.

    @PluginMethod
    fun pause(call: PluginCall) {
        mainHandler.post {
            PlaybackService.instance?.pause()
            call.resolve()
        }
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        mainHandler.post {
            PlaybackService.instance?.resume()
            call.resolve()
        }
    }

    @PluginMethod
    fun seekTo(call: PluginCall) {
        val positionMs = call.getInt("positionMs") ?: return call.reject("positionMs wajib diisi")
        mainHandler.post {
            PlaybackService.instance?.seekTo(positionMs.toLong())
            call.resolve()
        }
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        mainHandler.post {
            val service = PlaybackService.instance
            val result = JSObject()
            result.put("positionMs", service?.currentPositionMs() ?: 0)
            result.put("durationMs", service?.durationMs() ?: 0)
            result.put("isPlaying", service?.isPlaying() ?: false)
            call.resolve(result)
        }
    }
}
