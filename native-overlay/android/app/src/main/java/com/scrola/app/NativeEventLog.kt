package com.scrola.app

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * NativeEventLog — penulis "Log Peristiwa" (event_log.txt) yang dipakai bersama oleh JS (lewat
 * DiagnosticsPlugin.appendLog) dan jalur scrobble LATAR native. Disatukan + di-synchronized supaya
 * penulisan read-modify-write dari dua thread (WebView vs listener) tidak saling menimpa. Format &
 * batas 100 baris dipertahankan identik dengan implementasi lama.
 */
object NativeEventLog {
    private const val FILE_NAME = "event_log.txt"
    private const val MAX_LINES = 100
    private val lock = Any()

    fun append(context: Context, line: String) {
        synchronized(lock) {
            try {
                val file = File(context.applicationContext.filesDir, FILE_NAME)
                val ts = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())
                val existing = if (file.exists()) file.readText().lines() else emptyList()
                val kept = (existing + "[$ts] $line").takeLast(MAX_LINES)
                file.writeText(kept.joinToString("\n"))
            } catch (e: Exception) {
                // Log gagal ditulis tidak boleh meng-crash apa pun.
            }
        }
    }

    fun read(context: Context): String {
        synchronized(lock) {
            return try {
                val file = File(context.applicationContext.filesDir, FILE_NAME)
                if (file.exists()) file.readText() else ""
            } catch (e: Exception) {
                ""
            }
        }
    }

    fun clear(context: Context) {
        synchronized(lock) {
            try {
                File(context.applicationContext.filesDir, FILE_NAME).delete()
            } catch (e: Exception) {
            }
        }
    }
}
