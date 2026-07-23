package com.scrola.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class ScrolaApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Dipasang PALING AWAL supaya crash yang terjadi bahkan saat inisialisasi awal pun
        // sempat tercatat ke file lokal (lihat CrashLogger — tidak ada pengiriman ke server).
        CrashLogger.install(this)
        createNowPlayingChannel()
    }

    private fun createNowPlayingChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            ScrobbleForegroundService.CHANNEL_ID,
            getString(R.string.notification_channel_now_playing_name),
            NotificationManager.IMPORTANCE_LOW // low = tidak bersuara/vibrasi, cukup untuk status
        ).apply {
            description = getString(R.string.notification_channel_now_playing_desc)
            setShowBadge(false)
        }

        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
