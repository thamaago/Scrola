package com.scrola.app

import android.content.Context
import java.io.File
import java.util.Base64

/**
 * PendingScrobbleStore — antrean scrobble yang ditangkap di LATAR oleh native (Opsi 2).
 *
 * Native (NotificationListener) menangkap lagu yang memenuhi ambang ke sini walau app tertutup;
 * JS menyerapnya (drain) saat app aktif, memfilter preferensi, lalu mengirim ke Last.fm. Sengaja
 * TERPISAH dari DB @capacitor-community/sqlite (path non-standar + risiko lock lintas-proses).
 *
 * FORMAT baris: field di-encode base64 (URL-safe, tanpa padding) dipisah TAB. base64 dipilih agar
 * kutipan/tab/newline/unicode di judul/artis tak pernah merusak parsing — dan karena hanya
 * bergantung pada java.util.Base64 (JDK), logika encode/decode bisa diunit-test tanpa Android.
 *   b64(artist) \t b64(track) \t b64(album) \t durationSec \t timestamp \t b64(sourcePackage)
 */
object PendingScrobbleStore {
    private const val FILE_NAME = "pending_scrobbles.tsv"
    private val lock = Any()
    private val enc = Base64.getUrlEncoder().withoutPadding()
    private val dec = Base64.getUrlDecoder()

    data class Record(
        val artist: String,
        val track: String,
        val album: String,
        val durationSec: Int,
        val timestamp: Long,
        val sourcePackage: String
    )

    private fun b64(s: String): String = enc.encodeToString(s.toByteArray(Charsets.UTF_8))
    private fun unb64(s: String): String = String(dec.decode(s), Charsets.UTF_8)

    /** Serialisasi satu record menjadi satu baris. Murni & teruji. */
    fun encodeRecord(r: Record): String =
        listOf(
            b64(r.artist),
            b64(r.track),
            b64(r.album),
            r.durationSec.toString(),
            r.timestamp.toString(),
            b64(r.sourcePackage)
        ).joinToString("\t")

    /** Parse satu baris. Mengembalikan null kalau baris rusak/kosong. Murni & teruji. */
    fun decodeRecord(line: String): Record? {
        if (line.isBlank()) return null
        val p = line.split("\t")
        if (p.size != 6) return null
        return try {
            Record(
                artist = unb64(p[0]),
                track = unb64(p[1]),
                album = unb64(p[2]),
                durationSec = p[3].toInt(),
                timestamp = p[4].toLong(),
                sourcePackage = unb64(p[5])
            )
        } catch (e: Exception) {
            null
        }
    }

    /** Parse seluruh isi file menjadi daftar record (baris rusak dilewati). Murni & teruji. */
    fun parseAll(text: String): List<Record> =
        text.lineSequence().mapNotNull { decodeRecord(it) }.toList()

    private fun file(context: Context) = File(context.applicationContext.filesDir, FILE_NAME)

    /** Tambah satu scrobble tertangkap (append, thread-safe). */
    fun append(context: Context, r: Record) {
        synchronized(lock) {
            try {
                file(context).appendText(encodeRecord(r) + "\n")
            } catch (e: Exception) {
                // Kegagalan tulis tidak boleh meng-crash listener; scrobble ini hilang, sisanya jalan.
            }
        }
    }

    /** Ambil SEMUA yang tertunda lalu kosongkan store (thread-safe). Dipanggil saat app menyerap. */
    fun drainAll(context: Context): List<Record> {
        synchronized(lock) {
            val f = file(context)
            if (!f.exists()) return emptyList()
            return try {
                val records = parseAll(f.readText())
                f.delete()
                records
            } catch (e: Exception) {
                emptyList()
            }
        }
    }
}
