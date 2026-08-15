import math
from PIL import Image, ImageDraw, ImageFont
W, H = 1080, 1920
INK=(18,26,21); SURFACE=(26,37,30); SURFACE_RAISED=(34,48,38)
AMBER=(214,167,86); CORAL=(255,122,107); PAPER=(239,237,224); MUTED=(143,163,148)
SERIF="/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SERIF_I="/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"
MONO="/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
def f(p,s): return ImageFont.truetype(p,s)
def fnv(s):
    h=0x811c9dc5
    for c in s:
        h^=ord(c); h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))&0xFFFFFFFF
    return h
def mul(seed):
    a=[seed&0xFFFFFFFF]
    def nxt():
        a[0]=(a[0]+0x6D2B79F5)&0xFFFFFFFF
        t=((a[0]^(a[0]>>15))*(1|a[0]))&0xFFFFFFFF
        t=(t+(((t^(t>>7))*(61|t))&0xFFFFFFFF))&0xFFFFFFFF
        t=(t^(t>>14))&0xFFFFFFFF
        return t/4294967296
    return nxt
def center(d,cx,y,t,fo,fi):
    w=d.textbbox((0,0),t,font=fo)[2]; d.text((cx-w/2,y),t,font=fo,fill=fi)
def frame(d,cx,cy,r):
    d.ellipse([cx-r,cy-r,cx+r,cy+r],outline=(214,167,86,128),width=2)
    d.ellipse([cx-r*0.9,cy-r*0.9,cx+r*0.9,cy+r*0.9],outline=(214,167,86,56),width=2)
    for i in range(48):
        a=i/48*math.tau; px,py=cx+math.cos(a)*r*0.95,cy+math.sin(a)*r*0.95
        d.ellipse([px-1.7,py-1.7,px+1.7,py+1.7],fill=(214,167,86,90))
def spectrum(d,cx,cy,r,seed,acc):
    rnd=mul(seed); baseR=r*0.30; maxBar=r*0.46
    for i in range(56):
        h=baseR+(0.22+0.78*rnd())*maxBar; a=i/56*math.tau-math.pi/2; c,s=math.cos(a),math.sin(a)
        paper=(i%7==0); col=(PAPER if paper else acc)+(179 if paper else 235,)
        d.line([(cx+c*baseR,cy+s*baseR),(cx+c*h,cy+s*h)],fill=col,width=3)
    d.ellipse([cx-baseR*0.58,cy-baseR*0.58,cx+baseR*0.58,cy+baseR*0.58],fill=SURFACE_RAISED+(255,),outline=acc+(255,),width=2)
    d.ellipse([cx-r*0.05,cy-r*0.05,cx+r*0.05,cy+r*0.05],fill=acc+(255,))
def constellation(d,cx,cy,r,seed,acc):
    rnd=mul(seed); n=8+int(rnd()*5); stars=[]
    for i in range(n):
        ang=rnd()*math.tau; rad=(0.18+rnd()*0.6)*r
        stars.append((cx+math.cos(ang)*rad,cy+math.sin(ang)*rad,2+rnd()*3.5))
    d.line([(x,y) for x,y,_ in stars],fill=acc+(90,),width=1)
    for i,(x,y,sr) in enumerate(stars):
        d.ellipse([x-sr,y-sr,x+sr,y+sr],fill=(PAPER if i%3==0 else acc)+(255,))
        if sr>3.6:
            d.line([(x-sr*2.2,y),(x+sr*2.2,y)],fill=PAPER+(128,),width=1)
            d.line([(x,y-sr*2.2),(x,y+sr*2.2)],fill=PAPER+(128,),width=1)
def ripple(d,cx,cy,r,seed,acc):
    rnd=mul(seed)
    for ring in range(1,7):
        rr=ring/6.5*r; segs=3+int(rnd()*5); off=rnd()*math.tau; al=int((0.3+0.5*ring/6)*255)
        for s in range(segs):
            a0=off+s/segs*math.tau; a1=a0+(math.tau/segs)*0.62
            d.arc([cx-rr,cy-rr,cx+rr,cy+rr],math.degrees(a0),math.degrees(a1),fill=acc+(al,),width=3)
    d.ellipse([cx-r*0.05,cy-r*0.05,cx+r*0.05,cy+r*0.05],fill=acc+(255,))
def waveform(d,cx,cy,r,seed,acc):
    rnd=mul(seed); pts=40; amp=r*0.5; vals=[rnd()*2-1 for _ in range(pts+1)]
    def wave(al,dy):
        p=[]
        for i in range(pts+1):
            x=cx-r*0.88+i/pts*r*1.76
            y=cy+dy+vals[i]*amp*(0.35+0.65*math.sin(i/pts*math.pi))
            p.append((x,y))
        d.line(p,fill=acc+(al,),width=3,joint="curve")
    wave(230,0); wave(77,r*0.12)
def emblem(img,cx,cy,r,seed,kind):
    ov=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(ov)
    acc=CORAL if (seed&1) else AMBER
    frame(d,cx,cy,r)
    if kind=="penemuan": constellation(d,cx,cy,r*0.82,seed,acc)
    elif kind=="setia": ripple(d,cx,cy,r*0.82,seed,acc)
    elif kind=="beruntun": waveform(d,cx,cy,r,seed,acc)
    else: spectrum(d,cx,cy,r,seed,acc)
    img.alpha_composite(ov)
def render(kind_lbl,kind,title,subject,earned,date_str,serial,basis,out):
    img=Image.new("RGBA",(W,H),INK); d=ImageDraw.Draw(img)
    glow=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow)
    for r in range(900,0,-6): gd.ellipse([W/2-r,140-r,W/2+r,140+r],fill=(214,167,86,int(10*(1-r/900))))
    img.alpha_composite(glow)
    cardX,cardY,cardW,cardH=70,300,W-140,1180
    d.rounded_rectangle([cardX,cardY,cardX+cardW,cardY+cardH],radius=28,fill=SURFACE,outline=(214,167,86,90),width=2)
    cx=W/2
    center(d,cx,cardY+60,"K O L E K S I  ·  S C R O L A",f(MONO,26),AMBER)
    center(d,cx,cardY+128,kind_lbl,f(MONO,30),AMBER)
    y=cardY+228; center(d,cx,y,title,f(SERIF,78),PAPER); y+=110
    emblem(img,cx,int(y+178),178,fnv(basis),kind); y+=178*2+46
    d=ImageDraw.Draw(img)
    if subject: center(d,cx,y,subject,f(SERIF,44),PAPER); y+=62
    if earned: center(d,cx,y,earned,f(SERIF_I,34),MUTED); y+=54
    center(d,cx,y+6,date_str,f(MONO,28),MUTED)
    stubY=cardY+cardH-250; xx=cardX+30
    while xx<=cardX+cardW-30: d.ellipse([xx-4,stubY-4,xx+4,stubY+4],fill=INK); xx+=26
    sf=f(MONO,46); stamp=f"No {serial}"; sw=d.textbbox((0,0),stamp,font=sf)[2]
    si=Image.new("RGBA",(sw+90,110),(0,0,0,0)); sd=ImageDraw.Draw(si)
    sd.rounded_rectangle([6,6,si.width-6,104],radius=12,outline=AMBER,width=3)
    center(sd,si.width/2,30,stamp,sf,AMBER); si=si.rotate(2,expand=True,resample=Image.BICUBIC)
    img.alpha_composite(si,(int(cx-si.width/2),int(stubY+66)))
    center(d,cx,cardY+cardH+58,"Scrola",f(SERIF,60),PAPER)
    center(d,cx,cardY+cardH+138,"Every song leaves a story.",f(SERIF_I,34),MUTED)
    center(d,cx,cardY+cardH+198,"scrola.app  ·  scrobbler Last.fm",f(MONO,26),AMBER)
    img.convert("RGB").save(out); print("saved",out)
render("JEJAK","jejak","Scrobble ke-100",None,"Daniel Powter — Bad Day","5 Agu 2026","SCR-J-000100","Daniel Powter|Bad Day","/tmp/k1.png")
render("PENEMUAN","penemuan","Artis ke-50","Michael Bublé","lewat \u201cHaven't Met You Yet\u201d","5 Agu 2026","SCR-P-000050","Michael Bublé|Haven't Met You Yet","/tmp/k2.png")
render("SETIA","setia","Setia ke-25","Kirana Seo","lewat \u201cGaris Batas\u201d","9 Agu 2026","SCR-S-000025","Kirana Seo|Garis Batas","/tmp/k3.png")
render("BERUNTUN","beruntun","Beruntun 7 hari",None,"Muse — Starlight","9 Agu 2026","SCR-B-000007","Muse|Starlight","/tmp/k4.png")
imgs=[Image.open(p) for p in ["/tmp/k1.png","/tmp/k2.png","/tmp/k3.png","/tmp/k4.png"]]
combo=Image.new("RGB",(W*4+120,H),(0,0,0))
for i,im in enumerate(imgs): combo.paste(im,(i*(W+40),0))
combo.save("/tmp/ticket_preview.png"); print("saved combo")
