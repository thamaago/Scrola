package com.scrola.app

import android.content.Intent
import android.util.Base64
import androidx.core.content.FileProvider
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

/**
 * SharePlugin — membagikan gambar tiket ke aplikasi lain (WhatsApp Status, Instagram Story, dll)
 * lewat share sheet bawaan Android.
 *
 * Kenapa plugin sendiri, bukan @capacitor/share:
 * - Nol dependensi npm baru (prinsip ringan), dan kita butuh kontrol penuh atas FileProvider.
 * - Alurnya sederhana: base64 dari canvas -> file PNG di cacheDir -> content:// URI lewat
 *   FileProvider -> Intent.ACTION_SEND dengan tipe image/png -> chooser.
 *
 * Kenapa share sheet, BUKAN posting langsung ke Status/Story:
 * - Posting langsung ke Instagram Story butuh SDK Meta + App ID terdaftar (menambah dependensi
 *   berat dan jalur pelacakan pihak ketiga — bertentangan dengan prinsip tanpa-telemetri Scrola).
 *   WhatsApp bahkan tidak menyediakan API publik untuk menulis Status.
 * - Share sheet bekerja untuk SEMUA aplikasi sekaligus tanpa integrasi khusus per-app, dan
 *   pengguna tetap memegang kendali penuh ke mana gambarnya pergi.
 * - Konsekuensi jujur: kita hanya bisa MEMBUKA chooser; pengguna sendiri yang memilih
 *   "WhatsApp -> Status" atau "Instagram -> Story". Tidak bisa langsung mendarat di sana.
 *
 * File yang dibagikan ditulis ke cacheDir (bukan penyimpanan permanen) dan dibersihkan saat
 * plugin dimuat — pola yang sama dengan Mp3MetadataPlugin, supaya file sisa dari crash tidak
 * menumpuk memakan ruang pengguna.
 */
@CapacitorPlugin(name = "Share")
class SharePlugin : Plugin() {

    private val shareDirName = "shared_images"

    override fun load() {
        super.load()
        // Bersihkan sisa gambar dari sesi sebelumnya (mis. app ditutup paksa setelah share).
        try {
            val dir = File(context.cacheDir, shareDirName)
            if (dir.isDirectory) dir.listFiles()?.forEach { it.delete() }
        } catch (e: Exception) {
            android.util.Log.w("SharePlugin", "Gagal membersihkan cache gambar share", e)
        }
    }

    /**
     * shareImage({ base64: String, filename?: String, title?: String })
     * base64 = PNG TANPA prefiks "data:image/png;base64,".
     */
    @PluginMethod
    fun shareImage(call: PluginCall) {
        val base64 = call.getString("base64")
        if (base64.isNullOrBlank()) {
            call.reject("Parameter 'base64' wajib diisi")
            return
        }
        val filename = call.getString("filename") ?: "scrola-tiket.png"
        val title = call.getString("title") ?: "Bagikan tiket"

        var file: File? = null
        try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)

            val dir = File(context.cacheDir, shareDirName)
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("Gagal menyiapkan folder sementara untuk gambar")
                return
            }
            file = File(dir, filename)
            file.writeBytes(bytes)

            // FileProvider: memberi izin baca SEMENTARA ke app tujuan untuk SATU file ini saja —
            // jauh lebih aman daripada file:// URI (yang sejak Android 7 memicu
            // FileUriExposedException) atau memberi izin storage lebar.
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(sendIntent, title).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                // Teruskan izin baca ke SEMUA kandidat di chooser — tanpa ini, sebagian app
                // (terutama di Android lama) menerima URI yang tidak bisa mereka baca dan
                // menampilkan gambar kosong.
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            if (sendIntent.resolveActivity(context.packageManager) == null) {
                call.reject("Tidak ada aplikasi yang bisa menerima gambar di perangkat ini")
                file.delete()
                return
            }
            context.startActivity(chooser)

            // CATATAN soal pembersihan: file TIDAK boleh dihapus sekarang — app tujuan (WhatsApp/IG)
            // membacanya SETELAH chooser ditutup, jadi menghapusnya di sini akan membuat mereka
            // menerima gambar kosong. File selalu ditulis dengan nama yang SAMA ("scrola-tiket.png"),
            // jadi share berikutnya menimpanya alih-alih menumpuk, dan load() membersihkan folder
            // saat app dibuka lagi. Hasilnya: paling banyak satu file sisa di cache, yang toh
            // otomatis dibersihkan sistem saat ruang menipis (itulah gunanya cacheDir).
            call.resolve()
        } catch (e: OutOfMemoryError) {
            // Base64 gambar 1080x1920 bisa beberapa MB; di perangkat low-end dekat batas memori,
            // decode-nya bisa memicu OOM. Ingat: OutOfMemoryError adalah Error, BUKAN Exception,
            // jadi ia TIDAK tertangkap catch(Exception) di bawah — harus ditangkap eksplisit.
            file?.delete()
            call.reject("Memori tidak cukup untuk menyiapkan gambar. Coba tutup aplikasi lain.")
        } catch (e: Exception) {
            file?.delete()
            call.reject("Gagal membagikan gambar: ${e.message}", e)
        }
    }

    /**
     * shareFile({ content: String, filename?: String, mimeType?: String, title?: String })
     * content = teks mentah (mis. JSON backup) yang ditulis ke file di cacheDir lalu dibagikan lewat
     * share sheet. Pola & alasan (FileProvider, cacheDir, pembersihan di load()) sama dengan shareImage.
     * Dipakai untuk export backup data — TIDAK menambah dependensi npm/SDK baru (prinsip ringan).
     */
    @PluginMethod
    fun shareFile(call: PluginCall) {
        val content = call.getString("content")
        if (content == null) {
            call.reject("Parameter 'content' wajib diisi")
            return
        }
        val filename = call.getString("filename") ?: "scrola-backup.json"
        val mimeType = call.getString("mimeType") ?: "application/json"
        val title = call.getString("title") ?: "Bagikan file"

        var file: File? = null
        try {
            val dir = File(context.cacheDir, shareDirName)
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("Gagal menyiapkan folder sementara untuk file")
                return
            }
            file = File(dir, filename)
            file.writeBytes(content.toByteArray(Charsets.UTF_8))

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(sendIntent, title).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            if (sendIntent.resolveActivity(context.packageManager) == null) {
                call.reject("Tidak ada aplikasi yang bisa menerima file di perangkat ini")
                file.delete()
                return
            }
            context.startActivity(chooser)
            call.resolve()
        } catch (e: Exception) {
            file?.delete()
            call.reject("Gagal membagikan file: ${e.message}", e)
        }
    }
}
