# -*- coding: utf-8 -*-
"""
Splash screen Scrola — mengikuti konvensi @capacitor/splash-screen: satu gambar landscape/portrait
netral yang di-center oleh plugin di berbagai ukuran layar, jadi kita buat kanvas persegi besar
dengan logo+wordmark di tengah dan banyak ruang kosong di sekeliling (aman untuk crop di layar
rasio apa pun, dari HP compact sampai tablet).
"""
from PIL import Image, ImageDraw, ImageFont
import os

INK = (18, 26, 21, 255)
AMBER = (214, 167, 86, 255)
CORAL = (255, 122, 107, 255)
PAPER = (239, 237, 224, 255)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RES = os.path.join(PROJECT_ROOT, "native-overlay", "android", "app", "src", "main", "res")
OUT = os.path.join(SCRIPT_DIR, "preview")
os.makedirs(OUT, exist_ok=True)
CANVAS = 2732  # cukup besar untuk tablet 12.9" (standar splash Capacitor)

def draw_ticket_mark(size):
    """Gambar ulang motif tiket (tanpa rotasi, versi tegak) untuk splash — konsisten dgn ikon."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ticket_w, ticket_h = int(size * 1.05), int(size * 0.58)
    ticket_img = Image.new("RGBA", (ticket_w, ticket_h), (0, 0, 0, 0))
    td = ImageDraw.Draw(ticket_img)
    corner_r = int(ticket_h * 0.16)
    td.rounded_rectangle([0, 0, ticket_w - 1, ticket_h - 1], radius=corner_r, fill=AMBER)

    perf_x = int(ticket_h * 0.30)
    hole_r = int(ticket_h * 0.075)
    n_holes = 5
    margin = ticket_h * 0.12
    usable_h = ticket_h - 2 * margin
    for i in range(n_holes):
        hy = int(margin + usable_h * i / (n_holes - 1))
        td.ellipse([perf_x - hole_r, hy - hole_r, perf_x + hole_r, hy + hole_r], fill=(0, 0, 0, 0))

    dash_h = int(ticket_h * 0.045)
    gap_h = int(ticket_h * 0.035)
    y = int(margin)
    while y < ticket_h - margin:
        td.line([(perf_x, y), (perf_x, min(y + dash_h, ticket_h - margin))],
                fill=INK, width=max(3, int(ticket_h * 0.012)))
        y += dash_h + gap_h

    play_size = ticket_h * 0.30
    play_cx = ticket_w * 0.72
    play_cy = ticket_h * 0.5
    td.polygon([
        (play_cx - play_size * 0.4, play_cy - play_size * 0.55),
        (play_cx - play_size * 0.4, play_cy + play_size * 0.55),
        (play_cx + play_size * 0.6, play_cy),
    ], fill=CORAL)

    px = (size - ticket_w) // 2
    py = (size - ticket_h) // 2
    img.alpha_composite(ticket_img, (px, py))
    return img


def find_font(candidates, size):
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


img = Image.new("RGBA", (CANVAS, CANVAS), INK)
cx, cy = CANVAS // 2, CANVAS // 2

mark_size = int(CANVAS * 0.30)
mark = draw_ticket_mark(mark_size)
img.alpha_composite(mark, (cx - mark_size // 2, cy - mark_size // 2 - int(CANVAS * 0.05)))

# Wordmark "Scrola" di bawah mark — pakai serif bold sebagai pendekatan Fraunces
serif_bold = find_font([
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
], int(CANVAS * 0.075))

draw = ImageDraw.Draw(img)
text = "Scrola"
bbox = draw.textbbox((0, 0), text, font=serif_bold)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
text_y = cy + mark_size // 2 - int(CANVAS * 0.02)
draw.text((cx - tw / 2, text_y), text, font=serif_bold, fill=PAPER)

# Tagline kecil, mono, tracked-out
mono_font = find_font([
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
], int(CANVAS * 0.018))
tagline = "E V E R Y   S O N G   L E A V E S   A   S T O R Y"
bbox2 = draw.textbbox((0, 0), tagline, font=mono_font)
tw2 = bbox2[2] - bbox2[0]
draw.text((cx - tw2 / 2, text_y + th + int(CANVAS * 0.035)), tagline, font=mono_font, fill=AMBER)

os.makedirs(os.path.join(RES, "drawable"), exist_ok=True)
img.convert("RGB").save(f"{OUT}/splash.png", quality=95)
img.convert("RGB").save(f"{RES}/drawable/splash.png", quality=95)
print("Splash screen dibuat di:", f"{OUT}/splash.png", "dan", f"{RES}/drawable/splash.png")
