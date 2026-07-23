package com.scrola.app

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * SecureStorePlugin
 *
 * Menyimpan nilai sensitif (session key Last.fm) terenkripsi AES-256-GCM dengan kunci yang
 * dibangkitkan & disimpan di Android Keystore (tidak pernah keluar dari secure hardware bila
 * perangkat mendukung StrongBox/TEE). Nilai terenkripsi + IV disimpan di SharedPreferences biasa
 * (aman karena tanpa kunci Keystore, ciphertext tidak berguna).
 *
 * Pola ini sama dengan pendekatan Strongbox untuk master key wrapping.
 */
@CapacitorPlugin(name = "SecureStore")
class SecureStorePlugin : Plugin() {

    private val keyAlias = "scrola_secure_store_key"
    private val androidKeyStore = "AndroidKeyStore"
    private val prefsName = "scrola_secure_prefs"

    private fun getOrCreateKey(): SecretKey {
        val ks = KeyStore.getInstance(androidKeyStore)
        ks.load(null)
        try {
            (ks.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        } catch (e: java.security.KeyStoreException) {
            // Bisa terjadi kalau entry Keystore korup/tidak terbaca — anggap seperti tidak ada
            // kunci, akan dibuat ulang di bawah.
        }
        return generateNewKey(ks)
    }

    private fun generateNewKey(ks: KeyStore): SecretKey {
        // Kalau alias lama ada tapi rusak/invalidated, hapus dulu supaya generateKey tidak
        // bentrok dengan entry lama.
        try {
            if (ks.containsAlias(keyAlias)) ks.deleteEntry(keyAlias)
        } catch (e: Exception) {
            // Abaikan — kalau gagal dihapus, keyGen.init di bawah akan menimpanya juga.
        }

        val keyGen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, androidKeyStore)
        val spec = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        keyGen.init(spec)
        return keyGen.generateKey()
    }

    @PluginMethod
    fun set(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("key wajib diisi")
        val value = call.getString("value") ?: return call.reject("value wajib diisi")

        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val iv = cipher.iv
            val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))

            val prefs = context.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
            prefs.edit()
                .putString("$key.iv", Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString("$key.data", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .apply()

            call.resolve()
        } catch (e: Exception) {
            call.reject("Gagal menyimpan nilai terenkripsi: ${e.message}", e)
        }
    }

    @PluginMethod
    fun get(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("key wajib diisi")
        try {
            val prefs = context.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
            val ivB64 = prefs.getString("$key.iv", null)
            val dataB64 = prefs.getString("$key.data", null)
            val result = JSObject()
            if (ivB64 == null || dataB64 == null) {
                result.put("value", null)
                return call.resolve(result)
            }
            val iv = Base64.decode(ivB64, Base64.NO_WRAP)
            val ciphertext = Base64.decode(dataB64, Base64.NO_WRAP)

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
            val plaintext = cipher.doFinal(ciphertext)

            result.put("value", String(plaintext, Charsets.UTF_8))
            call.resolve(result)
        } catch (e: android.security.keystore.KeyPermanentlyInvalidatedException) {
            // Bisa terjadi kalau kredensial layar kunci perangkat direset/dihapus (perilaku
            // Android, bukan bug kita). Kunci lama tidak bisa dipakai lagi — hapus data yang
            // tidak bisa didekripsi supaya user tinggal login ulang, bukan terjebak error
            // permanen setiap kali app dibuka.
            clearCorruptedEntry(key)
            val result = JSObject()
            result.put("value", null)
            call.resolve(result)
        } catch (e: javax.crypto.AEADBadTagException) {
            // Verifikasi tag GCM gagal — artinya ciphertext/IV korup atau sudah diutak-atik.
            // Diperlakukan sama seperti key invalid: data ini tidak akan pernah bisa didekripsi
            // lagi, jadi lebih baik dibersihkan dan user login ulang daripada reject terus-menerus
            // setiap app dibuka. Sebelumnya kasus ini jatuh ke catch(Exception) di bawah dan
            // menghasilkan error permanen yang mengunci alur login.
            clearCorruptedEntry(key)
            val result = JSObject()
            result.put("value", null)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Gagal membaca nilai terenkripsi: ${e.message}", e)
        }
    }

    private fun clearCorruptedEntry(key: String) {
        val prefs = context.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
        prefs.edit().remove("$key.iv").remove("$key.data").apply()
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("key wajib diisi")
        val prefs = context.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
        prefs.edit().remove("$key.iv").remove("$key.data").apply()
        call.resolve()
    }
}
