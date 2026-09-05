package com.scrola.app

import kotlin.math.pow

/**
 * ReplayGain — normalisasi loudness (logika murni, tanpa dependensi Android → bisa diunit-test).
 *
 * Fitur kualitas yang universal dikutip untuk pemutar file lokal (Poweramp, Auxio, Oto, dll.):
 * menyamakan tingkat kekerasan antar-lagu supaya tak ada lonjakan volume yang mengejutkan. Nilai
 * gain dibaca dari tag yang SUDAH di-parse ExoPlayer (ID3 TXXX untuk MP3, Vorbis comment untuk
 * FLAC/OGG — lihat PlaybackService.onMetadata), jadi format-agnostik tanpa library tag terpisah.
 *
 * CLIP-SAFE: volume dibatasi <= 1.0. Gain negatif (lagu lebih keras dari referensi) menurunkan
 * volume; gain positif (lagu lebih pelan) menaikkan TAPI tak pernah melewati unity — jadi tak
 * pernah menimbulkan clipping/distorsi. Konservatif & aman sebagai default.
 */
object ReplayGain {

    /** Deskripsi tag ReplayGain track-gain (dicocokkan case-insensitive). */
    fun isTrackGainKey(desc: String?): Boolean =
        desc?.trim()?.equals("REPLAYGAIN_TRACK_GAIN", ignoreCase = true) == true

    /**
     * Parse nilai gain seperti "-6.48 dB", "+2.3", " 3.0 dB " menjadi angka dB. Mengembalikan null
     * bila kosong/tak terbaca.
     */
    fun parseGainDb(raw: String?): Double? {
        if (raw == null) return null
        val cleaned = raw.trim()
            .removeSuffix("dB").removeSuffix("db").removeSuffix("DB").removeSuffix("Db")
            .trim()
            .removePrefix("+")
            .trim()
        if (cleaned.isEmpty()) return null
        val v = cleaned.toDoubleOrNull() ?: return null
        if (v.isNaN() || v.isInfinite()) return null
        return v
    }

    /**
     * Ubah gain dB (opsional + pre-amp) menjadi skalar volume linear 0..1 (clip-safe). preAmpDb
     * memungkinkan pengguna menaikkan seluruh basis nanti; default 0.
     */
    fun gainToVolume(gainDb: Double, preAmpDb: Double = 0.0): Float {
        val linear = 10.0.pow((gainDb + preAmpDb) / 20.0)
        return linear.coerceIn(0.0, 1.0).toFloat()
    }

    /** Gabungan: dari string tag mentah langsung ke volume clip-safe, atau null bila tak ada gain. */
    fun volumeFromTag(raw: String?, preAmpDb: Double = 0.0): Float? {
        val db = parseGainDb(raw) ?: return null
        return gainToVolume(db, preAmpDb)
    }
}
