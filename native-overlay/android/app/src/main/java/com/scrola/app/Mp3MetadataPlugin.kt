package com.scrola.app

import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.mpatric.mp3agic.ID3v23Tag
import com.mpatric.mp3agic.ID3v24Tag
import com.mpatric.mp3agic.Mp3File
import java.io.File
import java.io.FileOutputStream

/**
 * Mp3MetadataPlugin
 *
 * Baca & tulis ID3 tag (judul, artist, album, tahun, genre, album art) pada file MP3 lokal.
 *
 * KENAPA COPY KE FILE SEMENTARA DULU: file dipilih lewat Storage Access Framework
 * (content:// URI), sedangkan library ID3 (mp3agic) butuh akses RandomAccessFile ke path
 * filesystem asli — tidak semua content:// URI bisa dibuka seperti itu langsung. Alurnya:
 * 1. Salin isi content:// URI ke file sementara di cache app
 * 2. Baca/tulis tag ID3 pada file sementara itu pakai mp3agic
 * 3. Salin hasilnya balik ke content:// URI asli lewat OutputStream (mode "rwt" = truncate+write)
 * 4. Hapus file sementara
 *
 * Ini artinya file ASLI di penyimpanan device benar-benar diubah (bukan cuma salinan app) —
 * makanya butuh permission WRITE eksplisit (FLAG_GRANT_WRITE_URI_PERMISSION) saat memilih file,
 * berbeda dari pemilihan file untuk playback biasa di PlayerPlugin yang cukup READ saja.
 */
@CapacitorPlugin(name = "Mp3Metadata")
class Mp3MetadataPlugin : Plugin() {

    override fun load() {
        super.load()
        cleanupStaleTempFiles()
    }

    /**
     * File sementara (read_*, write_in_*, write_out_*) seharusnya selalu dihapus sendiri lewat
     * blok finally di setiap fungsi — tapi kalau app di-kill paksa oleh sistem atau crash tepat
     * di tengah proses baca/tulis, file itu bisa tertinggal selamanya di cache dan menumpuk
     * seiring waktu (masing-masing bisa berukuran sama dengan file MP3 yang diedit, beberapa MB).
     * Dibersihkan sekali tiap plugin dimuat (= tiap app start) sebagai jaring pengaman.
     */
    private fun cleanupStaleTempFiles() {
        try {
            context.cacheDir.listFiles { file ->
                file.name.startsWith("read_") || file.name.startsWith("write_in_") || file.name.startsWith("write_out_")
            }?.forEach { it.delete() }
        } catch (e: Exception) {
            // Bukan operasi kritis — kalau gagal, paling buruk cache sedikit lebih besar dari
            // seharusnya, bukan alasan untuk mengganggu startup plugin.
        }
    }

    @PluginMethod
    fun pickMp3ToEdit(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "audio/mpeg"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        startActivityForResult(call, intent, "pickMp3Result")
    }

    @PluginMethod
    fun pickAlbumArtImage(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "image/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        startActivityForResult(call, intent, "pickImageResult")
    }

    @ActivityCallback
    private fun pickImageResult(call: PluginCall?, result: androidx.activity.result.ActivityResult) {
        if (call == null) return
        try {
            val uri = result.data?.data
            if (uri == null) {
                call.reject("Tidak ada gambar dipilih")
                return
            }

            // Cek ukuran file DULU sebelum baca penuh ke memori — readBytes() memuat seluruh isi
            // file sekaligus, dan kalau user (tanpa sengaja) memilih file sangat besar (puluhan
            // MB, mis. foto RAW), itu bisa memicu OutOfMemoryError. OutOfMemoryError adalah
            // subclass Error bukan Exception, jadi TIDAK tertangkap oleh catch(e: Exception) di
            // bawah — makanya validasi ukuran di sini penting, bukan sekadar optimisasi.
            val sizeBytes = querySize(uri)
            val maxInputBytes = 20 * 1024 * 1024 // 20MB mentah sebelum dikompres, batas wajar
            if (sizeBytes != null && sizeBytes > maxInputBytes) {
                call.reject("Ukuran gambar terlalu besar (maks 20MB). Pilih gambar lain.")
                return
            }

            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: throw java.io.IOException("Tidak bisa membaca gambar")

            // Batasi ukuran & dimensi lewat util bersama (lihat ImageUtils.kt) — foto galeri
            // modern bisa beresolusi sangat besar (>10MB), tidak realistis disematkan mentah
            // ke tag ID3, dan mime type-nya dideteksi dari isi file yang sebenarnya.
            val (safeBytes, mime) = ImageUtils.downscaleIfNeeded(bytes)
            val res = JSObject()
            res.put(
                "albumArt",
                "data:$mime;base64," + android.util.Base64.encodeToString(safeBytes, android.util.Base64.NO_WRAP)
            )
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Gagal memproses gambar: ${e.message}", e)
        }
    }

    private fun querySize(uri: Uri): Long? {
        return try {
            context.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                    if (idx >= 0 && !cursor.isNull(idx)) cursor.getLong(idx) else null
                } else null
            }
        } catch (e: Exception) {
            null // kalau query gagal, lanjutkan tanpa validasi ukuran alih-alih memblokir user
        }
    }

    @ActivityCallback
    private fun pickMp3Result(call: PluginCall?, result: androidx.activity.result.ActivityResult) {
        if (call == null) return
        try {
            val uri = result.data?.data
            if (uri == null) {
                call.reject("Tidak ada file dipilih")
                return
            }
            // Minta izin READ + WRITE jangka panjang — beda dari PlayerPlugin yang cuma READ,
            // karena fitur ini benar-benar menulis ulang isi file di penyimpanan device.
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )

            val tempFile = copyUriToTemp(uri, "read_")
            try {
                val mp3 = Mp3File(tempFile.absolutePath)

                // PENTING: ID3v1Tag dan interface ID3v2 (dasar ID3v23Tag/ID3v24Tag) BUKAN tipe
                // yang kompatibel satu sama lain di mp3agic — sebelumnya kode ini mencoba
                // menggabungkannya lewat satu ekspresi elvis (`v2Tag ?: v1Tag`) yang berisiko
                // tidak valid secara tipe. Sekarang keduanya dibaca terpisah, lalu HASIL STRING-nya
                // (bukan objek tag-nya) yang digabung — ini valid untuk tipe apa pun karena
                // String? selalu bisa di-elvis dengan String? lain.
                val tagV2 = mp3.id3v2Tag
                val tagV1 = mp3.id3v1Tag

                val title = tagV2?.title ?: tagV1?.title ?: ""
                val artist = tagV2?.artist ?: tagV1?.artist ?: ""
                val album = tagV2?.album ?: tagV1?.album ?: ""
                val year = tagV2?.year ?: tagV1?.year ?: ""
                val genre = tagV2?.genreDescription ?: tagV1?.genreDescription ?: ""
                // Album artist (frame TPE2) cuma didukung tag ID3v2 versi tertentu di mp3agic,
                // tidak ada padanannya di ID3v1 sama sekali.
                val albumArtist = when (tagV2) {
                    is ID3v24Tag -> tagV2.albumArtist
                    is ID3v23Tag -> tagV2.albumArtist
                    else -> null
                } ?: ""

                val res = JSObject()
                res.put("uri", uri.toString())
                res.put("title", title)
                res.put("artist", artist)
                res.put("album", album)
                res.put("albumArtist", albumArtist)
                res.put("year", year)
                res.put("genre", genre)

                // Album art hanya mungkin ada di tag v2 (ID3v1 tidak mendukung artwork sama sekali).
                val albumImage = tagV2?.albumImage
                if (tagV2 != null && albumImage != null) {
                    val mime = tagV2.albumImageMimeType ?: "image/jpeg"
                    res.put(
                        "albumArt",
                        "data:$mime;base64," + android.util.Base64.encodeToString(albumImage, android.util.Base64.NO_WRAP)
                    )
                } else {
                    res.put("albumArt", null)
                }
                call.resolve(res)
            } finally {
                tempFile.delete()
            }
        } catch (e: Exception) {
            call.reject("Gagal membaca metadata MP3: ${e.message}", e)
        }
    }

    @PluginMethod
    fun saveMetadata(call: PluginCall) {
        val uriString = call.getString("uri") ?: return call.reject("uri wajib diisi")
        val uri = Uri.parse(uriString)

        val title = call.getString("title") ?: ""
        val artist = call.getString("artist") ?: ""
        val album = call.getString("album") ?: ""
        val albumArtist = call.getString("albumArtist") ?: ""
        val year = call.getString("year") ?: ""
        val genre = call.getString("genre") ?: ""
        // albumArtBase64 null = tidak diubah; string kosong "" = hapus artwork; string lain = ganti
        val albumArtBase64 = call.getString("albumArtBase64")

        var tempIn: File? = null
        var tempOut: File? = null
        try {
            tempIn = copyUriToTemp(uri, "write_in_")
            val mp3 = Mp3File(tempIn.absolutePath)

            // PENTING (diperbaiki dari versi awal): kalau file SUDAH punya tag v2 — versi
            // apa pun (v2.2/v2.3/v2.4) — tag yang ada dipakai ulang apa adanya, TIDAK dibuang
            // dan diganti ID3v24Tag baru. Versi sebelumnya cuma mengenali tag sebagai "ada"
            // kalau persis ID3v24Tag, sehingga file dengan tag v2.3 (sangat umum — banyak
            // tagger seperti iTunes/foobar2000 memakai v2.3 sebagai default historis) akan
            // kehilangan semua field lain yang tidak ada di form ini (track number, comment,
            // disc number, dst) karena tag lamanya dibuang total. Sekarang tidak lagi begitu.
            val existingTag = mp3.id3v2Tag
            val tag = existingTag ?: ID3v24Tag()

            tag.title = title
            tag.artist = artist
            tag.album = album
            if (year.isNotBlank()) tag.year = year
            if (genre.isNotBlank()) tag.genreDescription = genre

            when (tag) {
                is ID3v24Tag -> tag.albumArtist = albumArtist
                is ID3v23Tag -> tag.albumArtist = albumArtist
                // Tag v2.2 (jarang ditemui di file modern) tidak didukung untuk field ini —
                // field lain tetap tersimpan seperti biasa, cuma albumArtist yang diabaikan.
            }

            when {
                albumArtBase64 == null -> { /* tidak diubah, biarkan artwork lama (kalau ada) */ }
                albumArtBase64.isEmpty() -> {
                    // Tidak semua versi mp3agic punya method "hapus artwork" khusus yang bersih;
                    // dibungkus try/catch supaya kalau gagal, sisa field lain (judul/artist/dst)
                    // tetap tersimpan alih-alih seluruh proses save gagal cuma karena ini.
                    try {
                        tag.setAlbumImage(ByteArray(0), "")
                    } catch (e: Exception) {
                        android.util.Log.w("Scrola", "Gagal menghapus album art, dibiarkan seperti semula", e)
                    }
                }
                else -> {
                    // Isolasi kegagalan decode/parse artwork dalam try/catch sendiri: kalau data
                    // URI rusak (Base64.decode melempar IllegalArgumentException), JANGAN sampai
                    // menjatuhkan seluruh operasi save — field teks (judul/artist/album/dst) yang
                    // sudah di-set di atas tetap layak disimpan. Sebelumnya exception di sini
                    // merambat ke catch besar dan membatalkan semua editan, bukan cuma artwork-nya.
                    try {
                        val commaIdx = albumArtBase64.indexOf(',')
                        val header = if (commaIdx >= 0) albumArtBase64.substring(0, commaIdx) else "image/jpeg"
                        val data = if (commaIdx >= 0) albumArtBase64.substring(commaIdx + 1) else albumArtBase64
                        val mime = Regex("data:(.*?);base64").find(header)?.groupValues?.get(1) ?: "image/jpeg"
                        val bytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT)
                        if (bytes.isNotEmpty()) {
                            tag.setAlbumImage(bytes, mime)
                        }
                    } catch (e: IllegalArgumentException) {
                        android.util.Log.w("Scrola", "Data gambar sampul tidak valid, artwork tidak diubah", e)
                    }
                }
            }

            if (existingTag == null) mp3.id3v2Tag = tag

            tempOut = File(context.cacheDir, "write_out_${System.currentTimeMillis()}.mp3")
            mp3.save(tempOut.absolutePath)

            // Salin hasil balik ke content:// URI asli — mode "rwt" = truncate lalu tulis dari awal,
            // memastikan tidak ada sisa byte lama kalau file baru lebih pendek dari yang asli.
            context.contentResolver.openOutputStream(uri, "rwt")?.use { out ->
                tempOut.inputStream().use { input -> input.copyTo(out) }
            } ?: throw java.io.IOException("Tidak bisa membuka output stream untuk menulis")

            call.resolve()
        } catch (e: Exception) {
            call.reject("Gagal menyimpan metadata MP3: ${e.message}", e)
        } finally {
            tempIn?.delete()
            tempOut?.delete()
        }
    }

    private fun copyUriToTemp(uri: Uri, prefix: String): File {
        val tempFile = File(context.cacheDir, "$prefix${System.currentTimeMillis()}.mp3")
        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(tempFile).use { output -> input.copyTo(output) }
        } ?: throw java.io.IOException("Tidak bisa membuka file yang dipilih")
        return tempFile
    }
}
