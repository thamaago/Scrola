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
}
