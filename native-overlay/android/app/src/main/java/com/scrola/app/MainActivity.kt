package com.scrola.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // registerPlugin() WAJIB dipanggil SEBELUM super.onCreate(), sesuai dokumentasi resmi
        // Capacitor. Alasannya: registerPlugin() hanya menambahkan kelas plugin ke daftar
        // `initialPlugins` milik BridgeActivity; yang MEMBANGUN bridge dengan daftar itu adalah
        // super.onCreate(). Kalau registerPlugin() dipanggil SESUDAHNYA, bridge sudah terlanjur
        // dibuat tanpa plugin-plugin ini, dan setiap pemanggilan dari JS gagal dengan
        // "\"X\" plugin is not implemented on android".
        //
        // CATATAN SEJARAH: urutan ini pernah dibalik (super.onCreate() dulu) sebagai tebakan
        // penyebab crash startup. Tebakan itu KELIRU — crash sebenarnya karena kode Kotlin tidak
        // ter-compile sama sekali (plugin Kotlin tak aktif di Gradle), dan pembalikan urutan
        // justru menciptakan bug baru: SecureStore tidak terdaftar. Jangan diubah lagi.
        registerPlugin(SecureStorePlugin::class.java)
        registerPlugin(NowPlayingPlugin::class.java)
        registerPlugin(PlayerPlugin::class.java)
        registerPlugin(Mp3MetadataPlugin::class.java)
        registerPlugin(DiagnosticsPlugin::class.java)
        registerPlugin(SharePlugin::class.java)
        super.onCreate(savedInstanceState)
        // Fit the entire WebView viewport, including CSS fixed controls, inside system UI.
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        val content = findViewById<android.view.View>(android.R.id.content)
        content.setBackgroundColor(android.graphics.Color.rgb(18, 26, 21))
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val safe = insets.getInsets(
                androidx.core.view.WindowInsetsCompat.Type.systemBars() or
                    androidx.core.view.WindowInsetsCompat.Type.displayCutout() or
                    androidx.core.view.WindowInsetsCompat.Type.ime()
            )
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            androidx.core.view.WindowInsetsCompat.CONSUMED
        }
        androidx.core.view.WindowCompat.getInsetsController(window, content).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        androidx.core.view.ViewCompat.requestApplyInsets(content)
    }
}
