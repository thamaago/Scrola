package com.scrola.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream

/**
 * ImageUtils
 *
 * Dipakai bersama oleh PlayerPlugin (artwork dari file yang diputar) dan Mp3MetadataPlugin
 * (artwork saat edit metadata). Awalnya logic ini terduplikasi di kedua file dengan 2 bug yang
 * sama: (1) mime type di data URI selalu di-hardcode "image/jpeg" walau gambar aslinya PNG dan
 * tidak sempat dikompres ulang, (2) BitmapFactory.decodeByteArray() men-decode gambar SEPENUHNYA
 * ke memori dulu sebelum tahu ukurannya — artwork ID3 beresolusi besar (mis. 3000x3000px, ~36MB
 * dalam ARGB_8888) bisa membebani RAM signifikan atau memicu OutOfMemoryError di perangkat
 * low-end, bertentangan dengan prinsip "ringan" yang sudah ditetapkan untuk app ini.
 */
object ImageUtils {

    /** Deteksi mime type dari magic bytes, bukan asumsi/hardcode. */
    fun sniffMimeType(bytes: ByteArray): String {
        if (bytes.size >= 8 &&
            bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() &&
            bytes[2] == 0x4E.toByte() && bytes[3] == 0x47.toByte()
        ) return "image/png"
        if (bytes.size >= 3 &&
            bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()
        ) return "image/jpeg"
        if (bytes.size >= 6 &&
            bytes[0] == 'G'.code.toByte() && bytes[1] == 'I'.code.toByte() && bytes[2] == 'F'.code.toByte()
        ) return "image/gif"
        if (bytes.size >= 12 &&
            bytes[8] == 'W'.code.toByte() && bytes[9] == 'E'.code.toByte() &&
            bytes[10] == 'B'.code.toByte() && bytes[11] == 'P'.code.toByte()
        ) return "image/webp"
        return "image/jpeg" // fallback wajar untuk artwork ID3, mayoritas memang JPEG
    }

    /**
     * Downscale gambar dengan aman untuk RAM: cek dimensi dulu (inJustDecodeBounds) TANPA
     * mengalokasikan bitmap penuh, hitung inSampleSize supaya sisi terpanjang tidak lebih dari
     * [maxDimensionPx], baru decode dengan sample size itu. Setelah itu baru dikompres ke JPEG
     * kualitas menurun bertahap sampai di bawah [maxBytes].
     *
     * Mengembalikan Pair(bytes, mimeType) — mimeType selalu "image/jpeg" kalau sempat
     * dikompres ulang di sini, atau hasil sniffing asli kalau tidak perlu diproses sama sekali.
     */
    fun downscaleIfNeeded(bytes: ByteArray, maxBytes: Int = 500_000, maxDimensionPx: Int = 800): Pair<ByteArray, String> {
        val originalMime = sniffMimeType(bytes)
        if (bytes.size <= maxBytes) return bytes to originalMime

        return try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            val longestSide = maxOf(bounds.outWidth, bounds.outHeight)
            var sampleSize = 1
            while (longestSide / (sampleSize * 2) >= maxDimensionPx) {
                sampleSize *= 2
            }

            val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val bitmap: Bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOptions)
                ?: return bytes to originalMime

            var quality = 85
            var out: ByteArrayOutputStream
            do {
                out = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
                quality -= 15
            } while (out.size() > maxBytes && quality > 20)

            bitmap.recycle()
            out.toByteArray() to "image/jpeg"
        } catch (e: Exception) {
            bytes to originalMime
        }
    }
}
