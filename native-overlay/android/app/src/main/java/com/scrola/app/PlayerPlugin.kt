package com.scrola.app

import android.Manifest
import android.content.ContentUris
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject

/**
 * PlayerPlugin
 *
 * Jembatan JS <-> PlaybackService (ExoPlayer + MediaSession). Pemilihan file memakai
 * Storage Access Framework (ACTION_OPEN_DOCUMENT) — TIDAK meminta permission
 * READ_MEDIA_AUDIO/READ_EXTERNAL_STORAGE, karena kita hanya butuh akses ke file yang
 * dipilih user secara eksplisit lewat picker sistem, bukan memindai seluruh library.
 */
@CapacitorPlugin(
    name = "Player",
    permissions = [
        Permission(strings = [Manifest.permission.READ_MEDIA_AUDIO], alias = "audio")
    ]
)
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
    fun playQueue(call: PluginCall) {
        val arr = call.getArray("items")
        val startIndex = call.getInt("startIndex") ?: 0
        val items = ArrayList<PlaybackService.QueueItem>()
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                items.add(
                    PlaybackService.QueueItem(
                        uri = o.optString("uri"),
                        title = o.optString("title"),
                        artist = o.optString("artist")
                    )
                )
            }
        }
        mainHandler.post {
            PlaybackService.instance?.playQueue(items, startIndex)
            call.resolve()
        }
    }

    @PluginMethod
    fun skipNext(call: PluginCall) {
        mainHandler.post { PlaybackService.instance?.skipNext(); call.resolve() }
    }

    @PluginMethod
    fun skipPrev(call: PluginCall) {
        mainHandler.post { PlaybackService.instance?.skipPrev(); call.resolve() }
    }

    @PluginMethod
    fun skipToIndex(call: PluginCall) {
        val index = call.getInt("index") ?: 0
        mainHandler.post { PlaybackService.instance?.skipToIndex(index); call.resolve() }
    }

    @PluginMethod
    fun setRepeatMode(call: PluginCall) {
        val mode = call.getString("mode") ?: "off"
        mainHandler.post { PlaybackService.instance?.setRepeatMode(mode); call.resolve() }
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

    /**
     * Pindai pustaka musik lokal perangkat lewat MediaStore (pola Gramophone). Mengembalikan
     * { granted: Boolean, tracks: [LibraryTrack…] } — field cocok dengan src/lib/musicLibrary.ts,
     * lalu logika JS mengelompokkan/mengurutkannya. Izin READ_MEDIA_AUDIO hanya diminta di API 33+.
     * Query berjalan di thread latar plugin Capacitor (bukan main), jadi aman untuk cursor besar.
     */
    /**
     * Ambil album art SATU lagu (on-demand) sebagai data URI ter-downscale. Dipakai pemutar antrean
     * untuk menampilkan sampul lagu yang sedang diputar — TANPA mem-base64 art seluruh pustaka saat
     * scan (boros). Mengembalikan { art } ("" bila tak ada). Reuse extractMetadataFromUri.
     */
    @PluginMethod
    fun getAlbumArt(call: PluginCall) {
        val uri = call.getString("uri")
        if (uri == null) {
            call.reject("uri wajib diisi")
            return
        }
        val res = JSObject()
        try {
            res.put("art", extractMetadataFromUri(uri).albumArtDataUri ?: "")
        } catch (e: Exception) {
            res.put("art", "")
        }
        call.resolve(res)
    }

    @PluginMethod
    fun scanLibrary(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("audio") != PermissionState.GRANTED) {
            requestPermissionForAlias("audio", call, "audioPermCallback")
            return
        }
        doScanLibrary(call)
    }

    @PermissionCallback
    private fun audioPermCallback(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("audio") != PermissionState.GRANTED) {
            val res = JSObject()
            res.put("granted", false)
            res.put("tracks", JSArray())
            call.resolve(res)
            return
        }
        doScanLibrary(call)
    }

    private fun doScanLibrary(call: PluginCall) {
        val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.TRACK,
            MediaStore.Audio.Media.YEAR,
            MediaStore.Audio.Media.DATE_ADDED
        )
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        val sortOrder = "${MediaStore.Audio.Media.ARTIST} ASC"
        val tracks = JSArray()
        try {
            context.contentResolver
                .query(collection, projection, selection, null, sortOrder)
                ?.use { c ->
                    val idCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                    val titleCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                    val artistCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                    val albumCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                    val albumIdCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
                    val durCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                    val trackCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
                    val yearCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
                    val addedCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
                    while (c.moveToNext()) {
                        val durMs = c.getLong(durCol)
                        if (durMs < 5000) continue // lewati klip <5s (nada dering/notif yg lolos IS_MUSIC)
                        val id = c.getLong(idCol)
                        val uri = ContentUris.withAppendedId(collection, id)
                        val rawTrack = c.getInt(trackCol)
                        val trackNo = if (rawTrack > 0) rawTrack % 1000 else 0 // TRACK kadang disc*1000+track
                        val o = JSObject()
                        o.put("id", id.toString())
                        o.put("uri", uri.toString())
                        o.put("title", c.getString(titleCol) ?: "")
                        o.put("artist", c.getString(artistCol) ?: "")
                        o.put("album", c.getString(albumCol) ?: "")
                        o.put("albumId", c.getLong(albumIdCol).toString())
                        o.put("durationSec", (durMs / 1000L).toInt())
                        if (trackNo > 0) o.put("trackNo", trackNo)
                        val year = c.getInt(yearCol)
                        if (year > 0) o.put("year", year)
                        o.put("addedAt", c.getLong(addedCol)) // DATE_ADDED sudah dalam detik
                        tracks.put(o)
                    }
                }
            val res = JSObject()
            res.put("granted", true)
            res.put("tracks", tracks)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Gagal memindai pustaka: ${e.message}")
        }
    }
}
