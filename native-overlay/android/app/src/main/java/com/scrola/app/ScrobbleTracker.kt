package com.scrola.app

/**
 * ScrobbleTracker — port SETIA dari src/lib/playbackTimer.ts (yang sudah diuji 22 kasus di vitest).
 *
 * KENAPA DI NATIVE (Opsi 2): kelayakan scrobble dulu dihitung di JS (WebView), yang DIBEKUKAN
 * Android saat app ditutup/di-latar-kan — sehingga lagu yang diputar di latar tak pernah
 * memenuhi ambang. Dengan memindahkan tracker + kelayakan ke native (dijalankan di dalam
 * NotificationListener yang hidup di latar), scrobble tetap terkumpul walau app tertutup.
 *
 * Murni (tanpa dependensi Android) supaya bisa diunit-test sebagai Kotlin biasa. Logikanya
 * dijaga identik dengan versi TS agar kebenarannya terbawa; setiap perubahan harus diselaraskan
 * di kedua sisi.
 *
 * Sentinel: msUntilEligible() mengembalikan Long.MAX_VALUE untuk "tak akan pernah layak"
 * (padanan Infinity di TS).
 */
object ScrobbleTracker {
    const val UNKNOWN_DURATION_FALLBACK_SEC = 240
    const val NEVER = Long.MAX_VALUE

    /** Posisi (ms) yang dianggap "kembali ke awal" untuk mendeteksi lagu diulang. */
    const val REPEAT_START_MS = 3000L

    data class Tracker(
        val trackKey: String? = null,
        val playedMs: Long = 0L,
        val playingSince: Long? = null,
        val durationSec: Int = 0
    )

    fun create(): Tracker = Tracker()

    /** min(50% durasi, 240s) — dipertahankan sebagai Double agar identik dengan TS (mis. 141.5s). */
    fun scrobbleThresholdSec(durationSec: Int): Double = minOf(durationSec * 0.5, 240.0)

    /**
     * Ambang scrobble dalam MS untuk sebuah durasi:
     *  - durasi tak dilaporkan (<= 0): aturan 4 menit (UNKNOWN_DURATION_FALLBACK_SEC).
     *  - durasi valid tapi <= 30s: 0 (terlalu pendek — spek Last.fm melarang scrobble).
     *  - durasi > 30s: min(50% durasi, 240s).
     */
    fun thresholdMsForDuration(durationSec: Int): Long = when {
        durationSec <= 0 -> UNKNOWN_DURATION_FALLBACK_SEC * 1000L
        durationSec <= 30 -> 0L
        else -> (scrobbleThresholdSec(durationSec) * 1000).toLong()
    }

    fun thresholdMs(t: Tracker): Long = thresholdMsForDuration(t.durationSec)

    fun playedMsUntil(t: Tracker, now: Long): Long {
        val since = t.playingSince ?: return t.playedMs
        return t.playedMs + maxOf(0L, now - since)
    }

    fun msUntilEligible(t: Tracker, now: Long): Long {
        val th = thresholdMs(t)
        if (th <= 0L) return NEVER
        if (t.playingSince == null) return NEVER // sedang dijeda: tidak menghitung mundur
        val played = playedMsUntil(t, now)
        return maxOf(0L, th - played)
    }

    /**
     * Batasi seed posisi awal agar masuk akal: tak pernah melebihi durasi track (atau ambang
     * fallback 4 menit bila durasi tak diketahui), dan 0 bila posisi tak ada/negatif.
     */
    private fun clampSeedMs(positionMs: Long, durationSec: Int): Long {
        if (positionMs <= 0L) return 0L
        val maxMs = (if (durationSec > 0) durationSec else UNKNOWN_DURATION_FALLBACK_SEC) * 1000L
        return minOf(positionMs, maxMs)
    }

    /**
     * Apakah event ini menandakan lagu DIULANG (loop/replay): posisi kembali ke awal PADAHAL track
     * ini sudah sempat diputar cukup lama sampai LAYAK. Memakai waktu-berlalu (bukan jejak posisi)
     * agar andal walau event jarang. Konservatif: rewind sebelum layak TIDAK dihitung ulang.
     */
    fun isRepeatEvent(t: Tracker, positionMs: Long, isPlaying: Boolean, now: Long): Boolean {
        if (!isPlaying) return false
        if (positionMs > REPEAT_START_MS) return false
        val th = thresholdMs(t)
        if (th <= 0L) return false
        return playedMsUntil(t, now) >= th
    }

    /**
     * Terapkan sebuah event playback ke tracker. Track baru ATAU lagu diulang (posisi kembali ke
     * awal setelah sempat layak) -> mulai instance baru, seed dengan posisi (dibatasi). Track sama
     * -> perbarui akumulasi sesuai transisi play/pause.
     */
    fun applyEvent(
        t: Tracker,
        trackKey: String,
        isPlaying: Boolean,
        durationSec: Int,
        positionMs: Long,
        now: Long
    ): Tracker {
        if (trackKey != t.trackKey || isRepeatEvent(t, positionMs, isPlaying, now)) {
            return Tracker(
                trackKey = trackKey,
                playedMs = clampSeedMs(positionMs, durationSec),
                playingSince = if (isPlaying) now else null,
                durationSec = durationSec
            )
        }

        val wasPlaying = t.playingSince != null

        if (isPlaying && !wasPlaying) {
            // resume: buka sesi berjalan baru
            return t.copy(playingSince = now, durationSec = if (durationSec > 0) durationSec else t.durationSec)
        }
        if (!isPlaying && wasPlaying) {
            // pause: tutup sesi berjalan, akumulasikan
            return t.copy(
                playedMs = t.playedMs + maxOf(0L, now - (t.playingSince ?: now)),
                playingSince = null,
                durationSec = if (durationSec > 0) durationSec else t.durationSec
            )
        }
        // status main tidak berubah: mungkin hanya update durasi
        return t.copy(durationSec = if (durationSec > 0) durationSec else t.durationSec)
    }
}
