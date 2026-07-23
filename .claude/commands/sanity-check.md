# /sanity-check

Pemeriksaan ringan yang cepat dijalankan tanpa toolchain penuh (tanpa Android SDK/emulator).
Bukan pengganti build CI — hanya jaring pengaman awal.

## Perintah

```bash
# 1. Keseimbangan kurung semua file TS/TSX & Kotlin
find src -name "*.ts" -o -name "*.tsx" | xargs -I{} node -e "const fs=require('fs');const c=fs.readFileSync('{}','utf8');let d=0,p=0;for(const ch of c){if(ch==='{')d++;if(ch==='}')d--;if(ch==='(')p++;if(ch===')')p--;}if(d||p)console.log('MISMATCH {}');"
find native-overlay -name "*.kt" | xargs -I{} node -e "const fs=require('fs');const c=fs.readFileSync('{}','utf8');let d=0,p=0;for(const ch of c){if(ch==='{')d++;if(ch==='}')d--;if(ch==='(')p++;if(ch===')')p--;}if(d||p)console.log('MISMATCH {}');"

# 2. Validasi JSON & YAML
python3 -c "import json; json.load(open('package.json'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))"

# 3. Referensi kelas manifest cocok dengan file Kotlin
grep -o 'android:name="\.[A-Za-z]*"' native-overlay/android/app/src/main/AndroidManifest.xml | sort -u

# 4. Cari folder sampah dari brace-expansion yang gagal
find . -name "*{*" -o -name "*}*"

# 5. Test logic murni (kalau vitest terinstall)
npm test 2>/dev/null || echo "(vitest belum terinstall — jalankan npm install dulu)"
```

Kalau ada MISMATCH, itu tanda kode kemungkinan rusak — perbaiki sebelum lanjut.
