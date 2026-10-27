# 앱 아이콘 생성 (도형으로 그린 닥스훈트 + 도장 마루). 실행: python3 tools/icons.py
from PIL import Image, ImageDraw
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')

def dog(d, s, ox, oy):
    base = (43, 36, 32); tan = (184, 116, 58); dark = (30, 25, 22)
    E = lambda x, y, rx, ry, c: d.ellipse([ox + (x - rx) * s, oy + (y - ry) * s, ox + (x + rx) * s, oy + (y + ry) * s], fill=c)
    R = lambda x, y, w, h, r, c: d.rounded_rectangle([ox + x * s, oy + y * s, ox + (x + w) * s, oy + (y + h) * s], radius=r * s, fill=c)
    d.line([ox - 52 * s, oy - 6 * s, ox - 70 * s, oy - 22 * s, ox - 82 * s, oy - 34 * s], fill=base, width=int(9 * s), joint='curve')
    for lx in (-40, -28, 34, 46):
        R(lx - 5, 12, 10, 24, 4, dark); R(lx - 5, 30, 10, 6, 3, tan)
    R(-60, -18, 120, 40, 20, base)
    E(50, 8, 12, 9, tan)
    E(64, -26, 22, 18, base)
    R(78, -28, 30, 15, 7, (64, 54, 48))
    E(102, -23, 5, 4, (15, 12, 12))
    E(73, -31, 3.4, 3.8, (10, 8, 8))
    E(72, -38, 3, 2, tan)
    E(56, -20, 9, 17, dark)

def icon(size, pad=0.0, name='icon.png', rounded=True):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.22) if rounded else 0
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=(38, 52, 80))
    inner = size * (1 - 2 * pad)
    off = size * pad
    # 마루
    d.rectangle([off, off + inner * 0.68, off + inner, off + inner], fill=(169, 119, 74))
    for i in range(1, 4):
        y = off + inner * (0.68 + 0.08 * i)
        d.line([off, y, off + inner, y], fill=(140, 96, 56), width=max(1, size // 160))
    # 창
    d.rectangle([off + inner * 0.1, off + inner * 0.14, off + inner * 0.42, off + inner * 0.44], fill=(184, 199, 220))
    d.line([off + inner * 0.26, off + inner * 0.14, off + inner * 0.26, off + inner * 0.44], fill=(138, 98, 54), width=max(2, size // 90))
    dog(d, inner / 230, off + inner * 0.5, off + inner * 0.62)
    img.save(os.path.join(OUT, name))

icon(192, 0.04, 'icon-192.png')
icon(512, 0.04, 'icon-512.png')
icon(512, 0.14, 'maskable-512.png', rounded=False)
icon(180, 0.04, 'apple-touch-icon.png', rounded=False)
icon(64, 0.02, 'favicon-64.png')
print('ok')
