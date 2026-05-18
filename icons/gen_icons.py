"""Generate Debt Crusher app icons programmatically."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.dirname(__file__)

BG = (14, 15, 17, 255)      # near-black charcoal
ACCENT = (50, 209, 196, 255)  # teal
INK = (236, 240, 241, 255)


def draw_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    # Maskable: keep critical content in inner 80% safe zone
    pad = int(size * 0.16) if maskable else int(size * 0.10)

    # Rounded square wordmark plate
    r = int(size * 0.18)
    # subtle inner panel
    panel = (pad, pad, size - pad, size - pad)
    d.rounded_rectangle(panel, radius=r, fill=(20, 22, 25, 255))

    # Big bold "D" mark made from two stacked teal bars + serif-less right edge
    cx, cy = size / 2, size / 2
    bar_h = size * 0.10
    bar_w = size * 0.46
    # left vertical stroke
    left = (cx - bar_w / 2, cy - bar_w * 0.62)
    right = (cx - bar_w / 2 + bar_h, cy + bar_w * 0.62)
    d.rounded_rectangle([left[0], left[1], right[0], right[1]],
                        radius=int(bar_h / 2.4), fill=ACCENT)

    # top horizontal
    d.rounded_rectangle([cx - bar_w / 2, cy - bar_w * 0.62,
                         cx + bar_w / 2 - bar_h * 0.2, cy - bar_w * 0.62 + bar_h],
                        radius=int(bar_h / 2.4), fill=ACCENT)

    # bottom horizontal
    d.rounded_rectangle([cx - bar_w / 2, cy + bar_w * 0.62 - bar_h,
                         cx + bar_w / 2 - bar_h * 0.2, cy + bar_w * 0.62],
                        radius=int(bar_h / 2.4), fill=ACCENT)

    # right curve approximated by two short verticals + a bowed segment
    # We'll draw an arc using ellipse outline thickness
    bbox = [cx + bar_w / 2 - bar_w * 0.85, cy - bar_w * 0.62,
            cx + bar_w / 2 + bar_w * 0.15, cy + bar_w * 0.62]
    d.arc(bbox, start=-70, end=70, fill=ACCENT, width=int(bar_h))

    return img


def export(size, name, maskable=False):
    img = draw_icon(size, maskable=maskable)
    img.save(os.path.join(OUT, name), "PNG")
    print("wrote", name)


export(192, "icon-192.png")
export(512, "icon-512.png")
export(512, "icon-512-maskable.png", maskable=True)
export(180, "apple-touch-icon.png")
export(32, "favicon-32.png")
export(16, "favicon-16.png")
