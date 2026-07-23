package com.scrola.app

import android.Manifest
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject

@CapacitorPlugin(
    name = "NowPlaying",
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")
    ]
)
class NowPlayingPlugin : Plugin() {

    companion object {
        // Instance aktif plugin, diisi saat load() dipanggil Capacitor.
        // Dipakai ScrolaNotificationListener untuk mengirim event walau service
        // berjalan lepas dari siklus hidup Activity.
        private var instance: NowPlayingPlugin? = null

        fun emit(eventName: String, data: JSONObject) {
            instance?.notifyListeners(eventName, JSObject.fromJSONObject(data))
        }
    }

    override fun load() {
        super.load()
        instance = this
    }

    /** Buka halaman Settings > Notification access agar user bisa mengaktifkan izin untuk Scrola. */
    @PluginMethod
    fun openNotificationAccessSettings(call: PluginCall) {
        try {
            val intent = android.content.Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            // FLAG_ACTIVITY_NEW_TASK agar tetap bisa dibuka walau dipanggil dari konteks non-Activity,
            // dan resolveActivity dulu supaya tidak ActivityNotFoundException di device tanpa halaman
            // settings ini (jarang, tapi mungkin di ROM custom).
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                call.resolve()
            } else {
                call.reject("Halaman pengaturan akses notifikasi tidak tersedia di perangkat ini")
            }
        } catch (e: Exception) {
            call.reject("Gagal membuka pengaturan: ${e.message}", e)
        }
    }

    @PluginMethod
    fun isNotificationAccessGranted(call: PluginCall) {
        val enabledListeners = android.provider.Settings.Secure.getString(
            context.contentResolver, "enabled_notification_listeners"
        ) ?: ""
        // Sebelumnya pakai .contains(packageName) — bisa false-positive kalau ada listener app
        // lain yang nama komponennya kebetulan mengandung packageName kita sebagai substring.
        // Sekarang bandingkan tiap entri (dipisah ':') secara exact terhadap ComponentName kita.
        val ourComponent = android.content.ComponentName(context, ScrolaNotificationListener::class.java)
        val granted = enabledListeners.split(':').any { entry ->
            entry == ourComponent.flattenToString() || entry == ourComponent.flattenToShortString()
        }
        val result = JSObject()
        result.put("granted", granted)
        call.resolve(result)
    }

    /**
     * Minta izin POST_NOTIFICATIONS (wajib diminta runtime di Android 13+/API 33+ — deklarasi
     * di manifest saja tidak cukup). Di bawah API 33, izin ini otomatis granted saat install,
     * jadi langsung resolve true.
     */
    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            val result = JSObject()
            result.put("granted", true)
            call.resolve(result)
            return
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            val result = JSObject()
            result.put("granted", true)
            call.resolve(result)
            return
        }
        requestPermissionForAlias("notifications", call, "notificationPermsCallback")
    }

    @PermissionCallback
    private fun notificationPermsCallback(call: PluginCall) {
        val granted = getPermissionState("notifications") == PermissionState.GRANTED
        val result = JSObject()
        result.put("granted", granted)
        call.resolve(result)
    }
}
