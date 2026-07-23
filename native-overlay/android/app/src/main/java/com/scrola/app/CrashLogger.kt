package com.scrola.app

import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * CrashLogger
 *
 * Menangkap uncaught exception di sisi native (Kotlin/Java) dan menuliskannya ke file lokal di
 * penyimpanan privat app. TIDAK mengirim apa pun ke server — ini keputusan sadar: Scrola sengaja
 * tanpa telemetri/crash reporting pihak ketiga (Sentry/Crashlytics dsb) demi menjaga privasi user
 * dan bobot app tetap ringan.
 *
 * Konsekuensinya jujur: kamu (developer) TIDAK akan otomatis tahu kalau app crash di HP orang lain
 * — mereka harus mengirim file log ini secara manual (mis. lewat fitur "bagikan log" yang bisa
 * ditambahkan nanti di Pengaturan). Ini trade-off yang disengaja antara privasi dan observability.
 *
 * Hanya menyimpan crash TERAKHIR (menimpa yang lama) supaya tidak menumpuk memori penyimpanan.
 */
object CrashLogger {

    private const val CRASH_FILE = "last_crash.txt"

    fun install(context: Context) {
        val appContext = context.applicationContext
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                writeCrash(appContext, thread, throwable)
            } catch (e: Exception) {
                // Jangan sampai proses logging itu sendiri melempar & menutupi crash aslinya.
            }
            // Teruskan ke handler default sistem supaya perilaku normal (app ditutup, dialog
            // "app has stopped") tetap terjadi — kita cuma menyisipkan pencatatan sebelum itu,
            // bukan menelan crash-nya diam-diam (yang justru bikin lebih sulit di-debug).
            if (previousHandler != null) {
                previousHandler.uncaughtException(thread, throwable)
            } else {
                // Kalau tidak ada handler sebelumnya (jarang, tapi mungkin di sebagian kondisi
                // runtime), hentikan proses secara eksplisit — tanpa ini, thread yang crash bisa
                // menggantung alih-alih ditutup bersih oleh sistem, meninggalkan app dalam
                // keadaan setengah-mati yang justru lebih buruk dari crash biasa.
                android.os.Process.killProcess(android.os.Process.myPid())
                kotlin.system.exitProcess(2)
            }
        }
    }

    private fun writeCrash(context: Context, thread: Thread, throwable: Throwable) {
        val sw = StringWriter()
        PrintWriter(sw).use { throwable.printStackTrace(it) }
        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())

        val content = buildString {
            appendLine("Scrola crash log")
            appendLine("Waktu: $timestamp")
            appendLine("Thread: ${thread.name}")
            appendLine("Versi Android: ${android.os.Build.VERSION.RELEASE} (API ${android.os.Build.VERSION.SDK_INT})")
            appendLine("Perangkat: ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}")
            appendLine("---")
            append(sw.toString())
        }

        File(context.filesDir, CRASH_FILE).writeText(content)
    }

    /** Baca log crash terakhir kalau ada (untuk ditampilkan/dibagikan dari UI nanti). */
    fun readLastCrash(context: Context): String? {
        val file = File(context.applicationContext.filesDir, CRASH_FILE)
        return if (file.exists()) file.readText() else null
    }

    fun clearLastCrash(context: Context) {
        File(context.applicationContext.filesDir, CRASH_FILE).delete()
    }
}
