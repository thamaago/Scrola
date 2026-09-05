/**
 * apply-native-overlay.js
 *
 * Menggabungkan file custom di native-overlay/android/ ke dalam folder android/ yang
 * digenerate oleh `npx cap add android`. Dijalankan sekali setiap habis `cap add android`
 * (atau setelah menghapus & regenerate ulang folder android/).
 *
 * Kenapa perlu script, bukan copy manual: strings.xml harus DIGABUNG (bukan ditimpa) karena
 * template Capacitor sudah mengisi entri lain di sana (app_name, custom_url_scheme, dst).
 * Script ini idempotent — aman dijalankan berkali-kali, tidak akan menduplikasi entri string.
 *
 * Jalankan: node scripts/apply-native-overlay.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OVERLAY_SRC = path.join(ROOT, 'native-overlay', 'android', 'app', 'src', 'main');
const DEST = path.join(ROOT, 'android', 'app', 'src', 'main');

function assertExists(p, hint) {
  if (!fs.existsSync(p)) {
    console.error(`\n[apply-native-overlay] Tidak ditemukan: ${p}`);
    console.error(hint);
    process.exit(1);
  }
}

assertExists(
  path.join(ROOT, 'android'),
  'Jalankan "npx cap add android" dulu sebelum script ini — folder android/ belum ada.'
);
assertExists(OVERLAY_SRC, 'Folder native-overlay/ tidak ditemukan atau strukturnya berubah.');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`  timpa  ${path.relative(ROOT, dest)}`);
  }
}

console.log('[apply-native-overlay] Menyalin AndroidManifest.xml, kelas Kotlin, dan resource...\n');

// 0) Hapus file .java bawaan template Capacitor yang punya PADANAN .kt di overlay.
//
// KENAPA: `npx cap add android` membuat MainActivity.java dari template. Overlay kita menyediakan
// MainActivity.kt (versi Kotlin dengan registrasi plugin). Kalau .java template dibiarkan, setelah
// .kt disalin ada DUA definisi kelas com.scrola.app.MainActivity — satu dari javac, satu dari
// kotlinc — dan tahap dexing GAGAL: "Type com.scrola.app.MainActivity is defined multiple times".
// Build meng-compile keduanya tanpa protes; baru dexer yang menolak. Dilakukan secara UMUM (semua
// .kt overlay, bukan hanya MainActivity) supaya tahan kalau template Capacitor menambah .java lain
// di masa depan.
const overlayJavaRoot = path.join(OVERLAY_SRC, 'java');
const destJavaRoot = path.join(DEST, 'java');
if (fs.existsSync(overlayJavaRoot)) {
  // Kumpulkan nama kelas (relatif dari java/) yang disediakan overlay sebagai .kt
  const ktClasses = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir)) {
      const full = path.join(dir, e);
      const r = path.join(rel, e);
      if (fs.statSync(full).isDirectory()) walk(full, r);
      else if (e.endsWith('.kt')) ktClasses.push(r.replace(/\.kt$/, ''));
    }
  };
  walk(overlayJavaRoot, '');
  let removed = 0;
  for (const cls of ktClasses) {
    const javaTwin = path.join(destJavaRoot, cls + '.java');
    if (fs.existsSync(javaTwin)) {
      fs.unlinkSync(javaTwin);
      removed++;
      console.log(`  Menghapus ${cls}.java bawaan template (digantikan versi Kotlin).`);
    }
  }
  if (removed === 0) console.log('  Tidak ada file .java template yang bentrok dengan .kt overlay.');
}

// 1) Salin semua isi overlay KECUALI res/values/strings.xml (butuh penggabungan khusus)
const STRINGS_REL = path.join('res', 'values', 'strings.xml');
for (const entry of fs.readdirSync(OVERLAY_SRC)) {
  if (entry === 'res') continue; // res ditangani khusus di bawah supaya strings.xml tidak ketimpa
  copyRecursive(path.join(OVERLAY_SRC, entry), path.join(DEST, entry));
}

const overlayResDir = path.join(OVERLAY_SRC, 'res');
if (fs.existsSync(overlayResDir)) {
  for (const sub of fs.readdirSync(overlayResDir)) {
    if (sub === 'values') continue; // ditangani terpisah untuk merge strings.xml
    copyRecursive(path.join(overlayResDir, sub), path.join(DEST, 'res', sub));
  }
}

// 2) Gabung res/values/strings.xml alih-alih menimpa
console.log('\n[apply-native-overlay] Menggabungkan strings.xml...');
const overlayStringsPath = path.join(OVERLAY_SRC, STRINGS_REL);
const destStringsPath = path.join(DEST, STRINGS_REL);

const overlayXml = fs.readFileSync(overlayStringsPath, 'utf8');
// Regex menangkap <string name="..."> DENGAN kemungkinan atribut tambahan (mis. formatted="false"
// atau translatable="false") — versi sebelumnya hanya cocok kalau name adalah SATU-SATUNYA
// atribut, sehingga string dengan atribut ekstra diam-diam terlewat saat merge.
const overlayEntries = [...overlayXml.matchAll(/<string\s+name="([^"]+)"[^>]*>[\s\S]*?<\/string>/g)];

let destXml = fs.existsSync(destStringsPath)
  ? fs.readFileSync(destStringsPath, 'utf8')
  : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';

// Escape karakter regex khusus di nama string sebelum dipakai membangun RegExp pengecek duplikat —
// tanpa ini, nama yang kebetulan mengandung karakter seperti '.' atau '$' bisa salah cocok.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let added = 0;
for (const [fullTag, name] of overlayEntries) {
  const alreadyThere = new RegExp(`<string\\s+name="${escapeRegex(name)}"`).test(destXml);
  if (alreadyThere) continue;
  destXml = destXml.replace('</resources>', `    ${fullTag}\n</resources>`);
  added++;
}
fs.writeFileSync(destStringsPath, destXml, 'utf8');
console.log(`  ${added} string baru digabungkan ke ${path.relative(ROOT, destStringsPath)} (${overlayEntries.length - added} sudah ada sebelumnya)`);

// 3) Naikkan minSdkVersion ke 23 — dibutuhkan oleh KeyGenParameterSpec (Android Keystore) yang
// dipakai SecureStorePlugin untuk enkripsi session key. Default Capacitor (22) akan menyebabkan
// crash saat login di perangkat Android 5.1 (API 22) ke bawah karena kelas ini belum ada.
// Android 6.0 (API 23) dirilis 2015 — tetap mencakup mayoritas mutlak perangkat aktif saat ini.
console.log('\n[apply-native-overlay] Memastikan minSdkVersion >= 23 (dibutuhkan Android Keystore)...');
const variablesGradlePath = path.join(ROOT, 'android', 'variables.gradle');
if (fs.existsSync(variablesGradlePath)) {
  let variablesGradle = fs.readFileSync(variablesGradlePath, 'utf8');
  const minSdkMatch = variablesGradle.match(/minSdkVersion\s*=\s*(\d+)/);
  if (minSdkMatch && parseInt(minSdkMatch[1], 10) < 23) {
    variablesGradle = variablesGradle.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 23');
    fs.writeFileSync(variablesGradlePath, variablesGradle, 'utf8');
    console.log(`  minSdkVersion dinaikkan dari ${minSdkMatch[1]} ke 23 di android/variables.gradle`);
  } else if (minSdkMatch) {
    console.log(`  minSdkVersion sudah ${minSdkMatch[1]} (>= 23), tidak diubah`);
  } else {
    console.log('  Tidak menemukan baris minSdkVersion — cek manual android/variables.gradle');
  }
} else {
  console.log('  android/variables.gradle tidak ditemukan — cek manual setelah cap add android');
}

// 4) Suntikkan dependensi native yang dibutuhkan kode Kotlin Scrola ke android/app/build.gradle.
//
// KENAPA OTOMATIS: sebelumnya script ini hanya MENCETAK pengingat "tambahkan Media3 secara
// manual". Itu langkah yang mustahil dijalankan di CI (GitHub Actions membuat folder android/
// baru dari template setiap kali), dan build Gradle pasti gagal dengan "Unresolved reference:
// media3". Kegagalan build pertama di CI persis karena kelas masalah ini. Menyuntikkannya di
// sini membuat alur "tanpa tooling lokal" benar-benar bisa ditempuh.
//
// Idempoten: kalau blok ini sudah ada (mis. script dijalankan dua kali), tidak diduplikasi.
console.log('\n[apply-native-overlay] Menyuntikkan dependensi native ke android/app/build.gradle...');

const MARKER = '// === SCROLA NATIVE DEPS (disuntik apply-native-overlay.js) ===';
const SCROLA_DEPS = `
${MARKER}
    // Media3/ExoPlayer — player internal (PlaybackService sebagai MediaSessionService, supaya
    // sesinya ikut terbaca pipeline scrobble yang sama dengan Spotify/YT Music).
    implementation "androidx.media3:media3-exoplayer:1.10.0"
    implementation "androidx.media3:media3-session:1.10.0"
    implementation "androidx.media3:media3-common:1.10.0"

    // mp3agic — baca/tulis tag ID3 untuk editor metadata MP3.
    implementation "com.mpatric:mp3agic:0.9.1"

    // androidx.core — NotificationCompat, FileProvider (berbagi tiket sebagai gambar).
    implementation "androidx.core:core-ktx:1.17.0"
    // === AKHIR SCROLA NATIVE DEPS ===
`;

const appGradlePath = path.join(ROOT, 'android', 'app', 'build.gradle');
if (fs.existsSync(appGradlePath)) {
  let appGradle = fs.readFileSync(appGradlePath, 'utf8');

  if (appGradle.includes(MARKER)) {
    console.log('  Dependensi Scrola sudah ada di build.gradle, dilewati.');
  } else {
    // Sisipkan tepat setelah baris pembuka blok dependencies { yang berada di TOP-LEVEL.
    // Dicari dengan regex ^dependencies\s*\{ (awal baris) supaya tidak salah menyisipkan ke
    // blok dependencies bersarang di dalam buildscript/allprojects kalau template berubah.
    const depsBlockRegex = /^dependencies\s*\{/m;
    if (!depsBlockRegex.test(appGradle)) {
      console.error('  GAGAL: tidak menemukan blok dependencies { di android/app/build.gradle.');
      console.error('  Template Capacitor mungkin berubah — tambahkan dependensi berikut manual:');
      console.error(SCROLA_DEPS);
      process.exit(1);
    }
    appGradle = appGradle.replace(depsBlockRegex, (match) => match + SCROLA_DEPS);
    fs.writeFileSync(appGradlePath, appGradle, 'utf8');
    console.log('  Media3 (exoplayer/session/common), mp3agic, dan core-ktx disuntikkan.');
  }
} else {
  console.error('  GAGAL: android/app/build.gradle tidak ditemukan.');
  console.error('  Jalankan "npx cap add android" lebih dulu.');
  process.exit(1);
}

// 5) AKTIFKAN PLUGIN KOTLIN — ini KRUSIAL dan pernah menyebabkan crash fatal:
//
// Seluruh kode native Scrola ditulis dalam Kotlin (.kt), tapi template Android Capacitor 6 murni
// JAVA — plugin Kotlin tidak aktif secara default. Tanpa mengaktifkannya, Gradle build tetap
// SUKSES (ia hanya mengabaikan file .kt yang tidak dikenalnya), APK terbentuk & terinstall, TAPI
// tidak ada satu pun kelas Kotlin yang masuk APK. Akibatnya app crash instan saat dibuka dengan
// "ClassNotFoundException: Didn't find class com.scrola.app.ScrolaApplication" — persis sebelum
// kode kita sempat jalan. Ini bug yang lolos SEMUA pemeriksaan build (karena build memang tidak
// error) dan hanya ketahuan dari log crash di perangkat nyata.
//
// Perbaikannya: (a) daftarkan classpath kotlin-gradle-plugin di root build.gradle, dan
// (b) apply plugin 'kotlin-android' di app build.gradle.
console.log('\n[apply-native-overlay] Mengaktifkan plugin Kotlin (WAJIB — kode native Scrola berbahasa Kotlin)...');

const KOTLIN_VERSION = '1.9.25';
const rootGradlePath = path.join(ROOT, 'android', 'build.gradle');
const KOTLIN_CLASSPATH_MARKER = 'kotlin-gradle-plugin';

if (fs.existsSync(rootGradlePath)) {
  let rootGradle = fs.readFileSync(rootGradlePath, 'utf8');
  if (rootGradle.includes(KOTLIN_CLASSPATH_MARKER)) {
    console.log('  classpath Kotlin sudah ada di android/build.gradle, dilewati.');
  } else {
    // Sisipkan classpath tepat setelah baris classpath Android Gradle Plugin yang sudah ada.
    const agpClasspathRegex = /(classpath\s+['"]com\.android\.tools\.build:gradle[^\n]*\n)/;
    if (agpClasspathRegex.test(rootGradle)) {
      rootGradle = rootGradle.replace(
        agpClasspathRegex,
        (m) => m + `        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}"\n`
      );
      fs.writeFileSync(rootGradlePath, rootGradle, 'utf8');
      console.log(`  classpath Kotlin ${KOTLIN_VERSION} ditambahkan ke android/build.gradle.`);
    } else {
      console.error('  GAGAL: tidak menemukan classpath Android Gradle Plugin di android/build.gradle.');
      console.error(`  Tambahkan manual di blok buildscript.dependencies:`);
      console.error(`    classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}"`);
      process.exit(1);
    }
  }
} else {
  console.error('  GAGAL: android/build.gradle (root) tidak ditemukan.');
  process.exit(1);
}

// apply plugin 'kotlin-android' di app/build.gradle (setelah plugin com.android.application)
let appGradle2 = fs.readFileSync(appGradlePath, 'utf8');
const KOTLIN_APPLY_MARKER = "apply plugin: 'kotlin-android'";
if (appGradle2.includes(KOTLIN_APPLY_MARKER) || appGradle2.includes('org.jetbrains.kotlin.android')) {
  console.log('  plugin kotlin-android sudah aktif di app/build.gradle, dilewati.');
} else {
  const appPluginRegex = /(apply plugin:\s*['"]com\.android\.application['"]\s*\n)/;
  if (appPluginRegex.test(appGradle2)) {
    appGradle2 = appGradle2.replace(appPluginRegex, (m) => m + KOTLIN_APPLY_MARKER + '\n');
    fs.writeFileSync(appGradlePath, appGradle2, 'utf8');
    console.log('  plugin kotlin-android diaktifkan di app/build.gradle.');
  } else {
    console.error('  GAGAL: tidak menemukan "apply plugin: com.android.application" di app/build.gradle.');
    console.error(`  Tambahkan manual di baris paling atas: ${KOTLIN_APPLY_MARKER}`);
    process.exit(1);
  }
}

// 6) Set jvmTarget Kotlin ke 17 — WAJIB, dan tersangka kegagalan build berikutnya kalau lupa:
//
// Capacitor 6 menyetel Java (sourceCompatibility/targetCompatibility) ke 17, tapi kompiler Kotlin
// TIDAK mewarisi itu — ia default ke JVM 1.8. Kalau Kotlin meng-compile ke bytecode 1.8 sementara
// Java ke 17, Gradle gagal dengan "Inconsistent JVM-target compatibility ... (Java 17 vs Kotlin
// JVM 1.8)". Media3 1.4.x juga butuh target modern. Jadi kita tambahkan blok kotlinOptions.jvmTarget
// = '17' ke dalam blok android { } di app/build.gradle. Idempoten.
console.log('\n[apply-native-overlay] Menyetel kotlinOptions.jvmTarget = 17...');
let appGradle3 = fs.readFileSync(appGradlePath, 'utf8');
if (appGradle3.includes('jvmTarget')) {
  console.log('  kotlinOptions.jvmTarget sudah ada, dilewati.');
} else {
  // Sisipkan tepat setelah baris pembuka "android {" (top-level).
  const androidBlockRegex = /^android\s*\{/m;
  if (androidBlockRegex.test(appGradle3)) {
    // Set compileOptions (Java) DAN kotlinOptions (Kotlin) ke 17 sekaligus. KRUSIAL keduanya
    // SAMA: kalau template Capacitor menyetel Java ke versi lain (mis. 21) sementara Kotlin ke 17,
    // ExoPlayer/kode meng-compile ke dua versi bytecode berbeda, dan tahap dexBuilder GAGAL
    // menggabungkannya ("Failed to process ... kotlin-classes/debug, javac/debug/classes").
    // Menyuntik compileOptions eksplisit memaksa konsistensi apa pun default template.
    const JVM_OPTS = `
    // Disuntik apply-native-overlay: samakan target Java & Kotlin ke 17 agar output bytecode
    // konsisten dan tahap dexing tidak gagal menggabungkan kelas Java + Kotlin.
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = '17'
    }`;
    appGradle3 = appGradle3.replace(androidBlockRegex, (m) => m + JVM_OPTS);
    fs.writeFileSync(appGradlePath, appGradle3, 'utf8');
    console.log('  compileOptions Java 17 + kotlinOptions jvmTarget 17 ditambahkan ke blok android {}.');
  } else {
    console.error('  GAGAL: tidak menemukan blok "android {" di app/build.gradle.');
    console.error('  Tambahkan manual di dalam android {}: kotlinOptions { jvmTarget = "17" }');
    process.exit(1);
  }
}

console.log('\n[apply-native-overlay] Selesai. Langkah berikutnya:');
console.log('  1. npx cap sync android');
console.log('  2. ./gradlew assembleDebug (atau biarkan CI yang membangun)');
