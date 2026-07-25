package com.scrola.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * DiagnosticsPlugin
 *
 * Jembatan JS untuk CrashLogger. Tanpa plugin ini, fungsi readLastCrash/clearLastCrash di
 * CrashLogger tidak akan pernah bisa dipanggil dari UI sama sekali (dead code) — log crash
 * yang tercatat hanya bisa diambil lewat adb, yang tidak realistis untuk user biasa.
 * Dipakai SettingsScreen untuk menampilkan & menghapus log crash terakhir.
 */
@CapacitorPlugin(name = "Diagnostics")
class DiagnosticsPlugin : Plugin() {

    @PluginMethod
    fun getLastCrashLog(call: PluginCall) {
        val res = JSObject()
        res.put("log", CrashLogger.readLastCrash(context))
        call.resolve(res)
    }

    @PluginMethod
    fun clearLastCrashLog(call: PluginCall) {
        CrashLogger.clearLastCrash(context)
        call.resolve()
    }

    /**
     * Tambah satu baris ke log peristiwa (bukan crash). Dipakai jalur scrobble JS untuk merekam
     * jejak nyata: kapan lagu memenuhi syarat, apakah enqueue berhasil, apakah pengiriman ke
     * Last.fm sukses/ditolak. Tanpa ini, kita hanya bisa MENEBAK di titik mana rantai putus,
     * karena UI menampilkan status optimistis yang belum tentu benar.
     *
     * Ring buffer sederhana: simpan maksimal ~100 baris terakhir supaya file tidak membengkak.
     */
    @PluginMethod
    fun appendLog(call: PluginCall) {
        val line = call.getString("line") ?: return call.reject("line wajib diisi")
        try {
            val file = java.io.File(context.applicationContext.filesDir, "event_log.txt")
            val ts = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US)
                .format(java.util.Date())
            val existing = if (file.exists()) file.readText().lines() else emptyList()
            val kept = (existing + "[$ts] $line").takeLast(100)
            file.writeText(kept.joinToString("\n"))
            call.resolve()
        } catch (e: Exception) {
            call.reject("Gagal menulis log: ${e.message}")
        }
    }

    @PluginMethod
    fun readEventLog(call: PluginCall) {
        val res = JSObject()
        try {
            val file = java.io.File(context.applicationContext.filesDir, "event_log.txt")
            res.put("log", if (file.exists()) file.readText() else "")
        } catch (e: Exception) {
            res.put("log", "Gagal membaca log: ${e.message}")
        }
        call.resolve(res)
    }

    @PluginMethod
    fun clearEventLog(call: PluginCall) {
        try {
            java.io.File(context.applicationContext.filesDir, "event_log.txt").delete()
        } catch (_: Exception) {}
        call.resolve()
    }
}
