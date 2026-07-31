"""生成 PWA 图标：田字格里一个「識」。

和 app 里的视觉一致 —— 靛青底、纸色的字、虚线十字。
用法： python scripts/make_icons.py
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")

OUT = Path(__file__).parent.parent / "public" / "icons"
FONT = Path("C:/Windows/Fonts/simkai.ttf")  # 楷体，和界面同一款

ACCENT = (23, 96, 122)
PAPER = (241, 242, 238)
GRID = (255, 255, 255, 70)


def draw_icon(size: int, pad_ratio: float = 0.0) -> Image.Image:
    """pad_ratio > 0 时四周留白，给 maskable 图标的安全区用。"""
    img = Image.new("RGB", (size, size), ACCENT)
    d = ImageDraw.Draw(img, "RGBA")

    pad = int(size * pad_ratio)
    box = (pad, pad, size - pad, size - pad)
    inner = box[2] - box[0]

    # 田字格：外框 + 虚线十字
    line = max(1, size // 96)
    d.rectangle(box, outline=GRID, width=line)
    mid_x = box[0] + inner // 2
    mid_y = box[1] + inner // 2
    dash = inner // 22
    for x in range(box[0], box[2], dash * 2):
        d.line([(x, mid_y), (min(x + dash, box[2]), mid_y)], fill=GRID, width=line)
    for y in range(box[1], box[3], dash * 2):
        d.line([(mid_x, y), (mid_x, min(y + dash, box[3]))], fill=GRID, width=line)

    # 「字」笔画比原来的「識」少得多，同样的字号在小尺寸下显得空，放大一些
    font = ImageFont.truetype(str(FONT), int(inner * 0.82))
    l, t, r, b = d.textbbox((0, 0), "字", font=font)
    d.text(
        (mid_x - (r + l) / 2, mid_y - (b + t) / 2),
        "字",
        font=font,
        fill=PAPER,
    )
    return img


def main() -> None:
    if not FONT.exists():
        raise SystemExit(f"找不到字体 {FONT}，换一个楷体或宋体的路径")

    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, 0.08),
        ("icon-512.png", 512, 0.08),
        # maskable 会被裁成圆角/圆形，内容要收进中间 80% 的安全区
        ("icon-maskable-512.png", 512, 0.18),
        ("apple-touch-icon.png", 180, 0.06),
    ]
    for name, size, pad in jobs:
        draw_icon(size, pad).save(OUT / name, "PNG", optimize=True)
        print(f"{name}  {size}×{size}  {(OUT / name).stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
