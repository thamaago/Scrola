#!/usr/bin/env python3
"""Mockup PIL untuk zine Sisi B (validasi LAYOUT, bukan typografi final).
Nilai label/normalisasi mencerminkan sisiBZineLayout.ts. Warna & motif cetak dari shareImage.ts.
Font DejaVu dipakai sebagai proxy: serif->Fraunces, mono->IBM Plex Mono, sans->Manrope."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
INK = (18, 26, 21)
SURFACE = (26, 37, 30)
SURFACE_RAISED = (34, 48, 38)
AMBER = (214, 167, 86)
PAPER = (239, 237, 224)
MUTED = (143, 163, 148)

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
def f(path, sz): return ImageFont.truetype(path, sz)

# ---- data contoh (mirror sisiBZineLayout.ts) ----
week_label = "11–17 Agu 2025"        # weekRangeLabel(wk(2025,7,11))
top_track, top_artist = "Garis Batas", "Kirana Seo"
day_labels = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"]
day_counts = [8, 15, 10, 6, 12, 20, 13]
peak_idx = day_counts.index(max(day_counts))
def day_bar_heights(counts, maxpx):
    peak = max(counts) or 0
    return [0 if peak <= 0 else round(c/peak*maxpx) for c in counts]
peak_hour_label = "21.00–22.00"
total_tracks, total_artists, new_artists = 84, 22, 3
dur_h, dur_m = 5, 52
serial = "SB-2025-W33-8F2A"  # suffix = subjectHash (djb2), stabil per minggu

img = Image.new("RGB", (W, H), INK)
d = ImageDraw.Draw(img)

# grain + glow atas (amber lembut)
for y in range(0, H, 18):
    for x in range(0, W, 18):
        d.rectangle([x, y, x+1, y+1], fill=(24, 33, 27))
glow = Image.new("RGB", (W, H), INK); gd = ImageDraw.Draw(glow)
for r in range(900, 0, -6):
    a = r/900
    col = (int(INK[0]+(AMBER[0]-INK[0])*0.16*(1-a)),
           int(INK[1]+(AMBER[1]-INK[1])*0.10*(1-a)),
           int(INK[2]+(AMBER[2]-INK[2])*0.06*(1-a)))
    gd.ellipse([W/2-r, 120-r, W/2+r, 120+r], fill=col)
img = Image.blend(img, glow, 0.5); d = ImageDraw.Draw(img)

# ---- kartu tiket ----
cardX, cardW, cardY, cardH, perfW = 90, W-180, 250, 1440, 34
d.rounded_rectangle([cardX, cardY, cardX+cardW, cardY+cardH], radius=28, fill=SURFACE,
                    outline=(int(AMBER[0]*0.5+INK[0]*0.5),)*1 and (120, 100, 62), width=2)
# perforasi kiri
gap = 40
y = cardY + gap//2
while y < cardY + cardH - 8:
    d.ellipse([cardX+perfW/2-9, y-9, cardX+perfW/2+9, y+9], fill=INK)
    y += gap
cx0 = cardX + perfW + 46
cxR = cardX + cardW - 56
cW = cxR - cx0

def center(text, font, y, fill, box_l=cx0, box_r=cxR):
    w = d.textlength(text, font=font)
    d.text(((box_l+box_r)/2 - w/2, y), text, font=font, fill=fill)

# header
d.text((cx0, cardY+54), "S C R O L A", font=f(MONO, 26), fill=AMBER)
t = "SISI B"; d.text((cxR - d.textlength(t, font=f(MONO,26)), cardY+54), t, font=f(MONO,26), fill=MUTED)

# masthead: rentang minggu
d.text((cx0, cardY+120), "RECAP MINGGUAN", font=f(MONO, 24), fill=MUTED)
center(week_label, f(SERIF_B, 76), cardY+160, PAPER)

# dashed divider
def dashed(y):
    x = cx0
    while x < cxR:
        d.line([x, y, min(x+10, cxR), y], fill=(70, 84, 74), width=2); x += 20
dashed(cardY+290)

# lagu minggu ini
d.text((cx0, cardY+320), "LAGU MINGGU INI", font=f(MONO, 24), fill=AMBER)
center(top_track, f(SERIF_B, 60), cardY+360, PAPER)
center(top_artist, f(SANS, 34), cardY+440, MUTED)

# ---- bar chart mingguan ----
chart_top, chart_h = cardY+540, 200
heights = day_bar_heights(day_counts, chart_h-40)
n = 7
slot = cW/n
for i in range(n):
    bx = cx0 + slot*i + slot/2
    bh = heights[i]
    col = AMBER if i == peak_idx else SURFACE_RAISED
    bw = 46
    d.rounded_rectangle([bx-bw/2, chart_top+chart_h-bh, bx+bw/2, chart_top+chart_h], radius=8, fill=col)
    d.text((bx - d.textlength(day_labels[i], font=f(MONO,22))/2, chart_top+chart_h+12),
           day_labels[i], font=f(MONO, 22), fill=MUTED if i != peak_idx else AMBER)
    cnt = str(day_counts[i])
    d.text((bx - d.textlength(cnt, font=f(MONO,20))/2, chart_top+chart_h-bh-30),
           cnt, font=f(MONO, 20), fill=MUTED)

# ---- grid statistik ----
grid_top = chart_top + chart_h + 90
def stat(x, y, big, small, big_color=PAPER):
    d.text((x, y), big, font=f(SERIF_B, 52), fill=big_color)
    d.text((x, y+64), small, font=f(SANS, 28), fill=MUTED)
colL, colR = cx0, cx0 + cW/2 + 10
stat(colL, grid_top, str(total_tracks), "lagu")
stat(colR, grid_top, str(total_artists), "artis")
stat(colL, grid_top+150, f"{dur_h}j {dur_m}m", "total didengar")
stat(colR, grid_top+150, str(new_artists), "penemuan baru", AMBER)

# jam puncak (full width strip)
strip_y = grid_top + 320
d.rounded_rectangle([cx0, strip_y, cxR, strip_y+90], radius=14, fill=SURFACE_RAISED)
d.text((cx0+30, strip_y+30), "JAM PUNCAK", font=f(MONO, 26), fill=MUTED)
d.text((cxR-30-d.textlength(peak_hour_label, font=f(MONO,34)), strip_y+26), peak_hour_label,
       font=f(MONO, 34), fill=AMBER)

# footer di kartu
dashed(cardY+cardH-150)
d.text((cx0, cardY+cardH-120), "SERIAL", font=f(MONO, 22), fill=MUTED)
d.text((cxR - d.textlength(serial, font=f(MONO,26)), cardY+cardH-122), serial, font=f(MONO,26), fill=MUTED)

# tagline luar kartu
center("Every song leaves a story.", f(SERIF_B, 42), cardY+cardH+40, PAPER, cardX, cardX+cardW)
center("SCROLA · SISI B · SCROBBLER LAST.FM", f(MONO, 24), cardY+cardH+110, MUTED, cardX, cardX+cardW)

out = "/mnt/user-data/outputs/sisib-zine-mockup.png"
img.save(out)
print("saved", out)
