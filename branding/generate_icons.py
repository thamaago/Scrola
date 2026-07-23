# -*- coding: utf-8 -*-
"""
Generate ikon app Scrola + splash screen, konsisten dengan brand tokens yang sudah dikunci:
- Background: hutan-malam ink #121A15
- Accent utama: amber #D6A756 (vinyl label)
- Accent kedua: coral #FF7A6B (loved track)
- Motif signature: "story ticket" — tiket dengan tepi perforasi

Menghasilkan:
1. Adaptive icon (foreground + background terpisah, API 26+) — mengikuti safe-zone 66%
2. Legacy flattened icon per densitas (mdpi..xxxhdpi) untuk API < 26
3. Ikon bulat (round) untuk launcher yang pakai mask lingkaran
4. Monochrome layer (API 13+ themed icon)
5. Play Store icon 512x512
6. Splash screen (drawable, dipakai @capacitor/splash-screen)
"""
from PIL import Image, ImageDraw
import math
import os

INK = (18, 26, 21, 255)        # #121A15
INK_DEEP = (13, 20, 15, 255)   # sedikit lebih gelap untuk vignette
AMBER = (214, 167, 86, 255)     # #D6A756
CORAL = (255, 122, 107, 255)    # #FF7A6B
PAPER = (239, 237, 224, 255)    # #EFEDE0

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RES = os.path.join(PROJECT_ROOT, "native-overlay", "android", "app", "src", "main", "res")
OUT = os.path.join(SCRIPT_DIR, "preview")  # salinan flat untuk preview cepat, di luar struktur res/
os.makedirs(OUT, exist_ok=True)

CANVAS = 1024  # canvas kerja resolusi tinggi, di-downscale belakangan


def new_canvas(color=(0, 0, 0, 0)):
    return Image.new("RGBA", (CANVAS, CANVAS), color)


def draw_background(vignette=True):
    """Layer background adaptive icon: hutan-malam ink solid + vignette radial halus."""
    img = new_canvas(INK)
    if vignette:
        draw = ImageDraw.Draw(img)
        # Vignette lembut: beberapa lingkaran konsentris dari tengah, makin gelap ke tepi
        cx, cy = CANVAS // 2, CANVAS // 2
        max_r = int(CANVAS * 0.75)
        steps = 40
        for i in range(steps, 0, -1):
            r = int(max_r * i / steps)
            t = i / steps  # 1 di tengah -> 0 di tepi
            # interpolasi dari INK (tepi) ke sedikit lebih gelap (tengah bawah, biar ada depth)
            blend = tuple(int(INK[c] + (INK_DEEP[c] - INK[c]) * (1 - t) * 0.5) for c in range(3))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=blend + (255,))
    return img


def rounded_rect_points(x0, y0, x1, y1, radius):
    return [x0 + radius, y0, x1 - radius, y0, x1, y0, x1, y0 + radius,
            x1, y1 - radius, x1, y1, x1 - radius, y1, x0 + radius, y1,
            x0, y1, x0, y1 - radius, x0, y0 + radius, x0, y0]


def draw_foreground():
    """
    Layer foreground: motif 'story ticket' — tiket amber dengan tepi perforasi di kiri,
    sedikit dimiringkan, dengan aksen coral (mewakili 'loved track'). Digambar dalam
    safe-zone 66% (lingkaran tengah) supaya tidak terpotong mask launcher apa pun
    (lingkaran, squircle, rounded-square, dsb — beda-beda per OEM Android).
    """
    img = new_canvas((0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = CANVAS // 2, CANVAS // 2

    # Safe zone adaptive icon: konten utama sebaiknya di dalam lingkaran radius ~33% canvas
    safe_r = CANVAS * 0.30

    # --- Gambar tiket sebagai layer terpisah lalu rotate, supaya rounded-corner tetap presisi ---
    ticket_w, ticket_h = int(safe_r * 2.05), int(safe_r * 1.15)
    ticket_img = Image.new("RGBA", (ticket_w, ticket_h), (0, 0, 0, 0))
    td = ImageDraw.Draw(ticket_img)

    corner_r = int(ticket_h * 0.16)
    td.rounded_rectangle([0, 0, ticket_w - 1, ticket_h - 1], radius=corner_r, fill=AMBER)

    # Tepi perforasi: baris lingkaran kecil "melubangi" tiket di dekat tepi kiri (dipotong pakai
    # warna transparan sehingga background adaptive icon tembus di titik-titik ini)
    perf_x = int(ticket_h * 0.30)
    hole_r = int(ticket_h * 0.075)
    n_holes = 5
    margin = ticket_h * 0.12
    usable_h = ticket_h - 2 * margin
    for i in range(n_holes):
        hy = int(margin + usable_h * i / (n_holes - 1))
        td.ellipse(
            [perf_x - hole_r, hy - hole_r, perf_x + hole_r, hy + hole_r],
            fill=(0, 0, 0, 0)
        )

    # Garis putus-putus vertikal (jahitan sobekan tiket) tepat di jalur perforasi
    dash_h = int(ticket_h * 0.045)
    gap_h = int(ticket_h * 0.035)
    y = int(margin)
    while y < ticket_h - margin:
        td.line([(perf_x, y), (perf_x, min(y + dash_h, ticket_h - margin))],
                fill=INK, width=max(3, int(ticket_h * 0.012)))
        y += dash_h + gap_h

    # Aksen coral: segitiga play kecil di sisi kanan tiket (mewakili musik/playback)
    play_size = ticket_h * 0.30
    play_cx = ticket_w * 0.72
    play_cy = ticket_h * 0.5
    td.polygon([
        (play_cx - play_size * 0.4, play_cy - play_size * 0.55),
        (play_cx - play_size * 0.4, play_cy + play_size * 0.55),
        (play_cx + play_size * 0.6, play_cy),
    ], fill=CORAL)

    # Rotasi sedikit supaya terlihat seperti "tiket yang diselipkan", lalu tempel ke tengah
    ticket_img = ticket_img.rotate(-8, expand=True, resample=Image.BICUBIC)
    paste_x = cx - ticket_img.width // 2
    paste_y = cy - ticket_img.height // 2
    img.alpha_composite(ticket_img, (paste_x, paste_y))

    return img


def draw_monochrome():
    """Layer monokrom untuk themed icon Android 13+ — cuma alpha channel dari foreground, putih solid."""
    fg = draw_foreground()
    alpha = fg.split()[3]
    mono = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    white_layer = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 255))
    mono = Image.composite(white_layer, mono, alpha)
    return mono


def flatten(bg, fg):
    out = bg.copy()
    out.alpha_composite(fg)
    return out


def circle_mask_crop(img, size):
    """Untuk ikon 'round' legacy: crop ke lingkaran penuh."""
    img = img.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def squircle_mask_crop(img, size, radius_ratio=0.225):
    """Legacy icon non-round: rounded-square, mendekati bentuk adaptive icon standar Android."""
    img = img.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size, size], radius=int(size * radius_ratio), fill=255
    )
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


# ---------- Generate semua aset ----------

bg = draw_background()
fg = draw_foreground()
mono = draw_monochrome()
flattened = flatten(bg, fg)

bg.save(f"{OUT}/ic_launcher_background_1024.png")
fg.save(f"{OUT}/ic_launcher_foreground_1024.png")
mono.save(f"{OUT}/ic_launcher_monochrome_1024.png")
flattened.save(f"{OUT}/ic_launcher_flattened_1024.png")

# Mipmap densities standar Android (legacy launcher icon, ukuran total termasuk padding)
DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

for folder, size in DENSITIES.items():
    d = f"{OUT}/{folder}"
    os.makedirs(d, exist_ok=True)
    res_d = os.path.join(RES, folder)
    os.makedirs(res_d, exist_ok=True)

    legacy = squircle_mask_crop(flattened, size)
    legacy_round = circle_mask_crop(flattened, size)
    fg_size = int(size * 1.5)
    bg_resized = bg.resize((fg_size, fg_size), Image.LANCZOS)
    fg_resized = fg.resize((fg_size, fg_size), Image.LANCZOS)

    for name, im in [
        ("ic_launcher.png", legacy),
        ("ic_launcher_round.png", legacy_round),
        ("ic_launcher_background.png", bg_resized),
        ("ic_launcher_foreground.png", fg_resized),
    ]:
        im.save(f"{d}/{name}")       # salinan preview
        im.save(f"{res_d}/{name}")   # langsung ke native-overlay, siap di-merge npm run native:overlay

# Monochrome layer — satu resolusi tinggi di xxxhdpi sudah cukup untuk themed icon
mono_dest = os.path.join(RES, "mipmap-xxxhdpi")
os.makedirs(mono_dest, exist_ok=True)
mono.save(f"{mono_dest}/ic_launcher_monochrome.png")

# XML adaptive icon (mipmap-anydpi-v26) — hanya dibuat kalau belum ada, supaya edit manual
# (kalau pernah ada) tidak tertimpa diam-diam
anydpi_dir = os.path.join(RES, "mipmap-anydpi-v26")
os.makedirs(anydpi_dir, exist_ok=True)
adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
'''
for fname in ["ic_launcher.xml", "ic_launcher_round.xml"]:
    fpath = os.path.join(anydpi_dir, fname)
    if not os.path.exists(fpath):
        with open(fpath, "w") as f:
            f.write(adaptive_xml)

# Play Store icon (512x512, tanpa alpha/transparansi di luar bentuk, full square dengan bg solid)
play_store = flatten(bg, fg).resize((512, 512), Image.LANCZOS)
play_store.save(f"{OUT}/play_store_icon_512.png")

print("Ikon selesai dibuat di", OUT)
