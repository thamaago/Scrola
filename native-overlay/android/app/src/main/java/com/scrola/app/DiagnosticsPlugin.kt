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
        NativeEventLog.append(context, line)
        call.resolve()
    }

    @PluginMethod
    fun readEventLog(call: PluginCall) {
        val res = JSObject()
        res.put("log", NativeEventLog.read(context))
        call.resolve(res)
    }

    @PluginMethod
    fun clearEventLog(call: PluginCall) {
        NativeEventLog.clear(context)
        call.resolve()
    }
}
