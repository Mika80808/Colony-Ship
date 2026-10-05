"""重建 T3 候選角色：python tools/art/candidates_build.py。

只讀取 candidates/raw，所有輸出都在 candidates；不使用 tools/.venv。
保留原始比例補邊，偵測髮頂到腳底後，以設定身高生成比較圖。
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent / "candidates"
BACKGROUND = (217, 217, 217)
PROFILE_SIZE = (540, 960)
CANDIDATES = (
    ("C01", 178, "精瘦"),
    ("C02", 192, "力量"),
    ("C03", 176, "纖細"),
    ("C04", 187, "壯碩"),
    ("C05", 186, "泳將"),
    ("C06", 183, "成熟"),
    ("C07", 194, "高挑"),
    ("C08", 182, "拳擊"),
    ("C09", 181, "書卷"),
    ("C10", 188, "格鬥"),
)


def font(size: int) -> ImageFont.FreeTypeFont:
    """用系統繁中文字型；路徑隨平台解析，不記錄磁碟代號。"""
    windows_fonts = Path(os.environ.get("WINDIR", os.environ.get("SystemRoot", ""))) / "Fonts"
    choices = [
        windows_fonts / "msjh.ttc",
        windows_fonts / "mingliu.ttc",
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
        Path("/System/Library/Fonts/PingFang.ttc"),
    ]
    for candidate in choices:
        if candidate.is_file():
            return ImageFont.truetype(str(candidate), size)
    raise RuntimeError("找不到繁中文字型；請安裝微軟正黑體或 Noto Sans CJK。")


def detect_person(image: Image.Image) -> tuple[tuple[int, int, int, int], Image.Image]:
    """估計邊緣灰底；強色差定位身高，柔色差保留抗鋸齒輪廓。

    強色差排除中性淡灰地面陰影。上下邊界使用至少數個人物像素，
    排除單點雜訊；不以生成畫布尺寸推算身高。
    """
    pixels = np.asarray(image, dtype=np.int16)
    height, width = pixels.shape[:2]
    strip = max(1, width // 50)
    edges = np.concatenate((pixels[:, :strip].reshape(-1, 3), pixels[:, -strip:].reshape(-1, 3)))
    gray = np.median(edges, axis=0)
    distance = np.max(np.abs(pixels - gray), axis=2)
    chroma = np.max(pixels, axis=2) - np.min(pixels, axis=2)
    strong = (distance > 90) | ((chroma > 24) & (distance > 24))
    rows = np.flatnonzero(strong.sum(axis=1) >= max(3, width // 250))
    if not len(rows):
        raise ValueError("無法偵測人物；原圖必須是單人淺灰底立繪。")
    top, bottom = int(rows[0]), int(rows[-1]) + 1
    if bottom - top < height * 0.55:
        raise ValueError("偵測到的人物高度不足畫布的 55%，請檢查原圖。")
    # 用背景連通區保留人物內部近似灰色的頭髮、眼睛和布料。
    # 只在腳部區域移除中性陰影，避免把白髮的淺色髮尖當成背景。
    lower_region = np.arange(height)[:, None] > height * 0.8
    neutral_shadow = lower_region & (chroma <= 12) & (pixels.min(axis=2) >= 140) & (distance <= 90)
    possible_background = ((distance <= 18) | neutral_shadow).astype(np.uint8) * 255
    exterior = Image.fromarray(possible_background).copy()
    for point in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)):
        if exterior.getpixel(point) == 255:
            ImageDraw.floodfill(exterior, point, 128)
    outside = np.asarray(exterior) == 128
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    # 強色差先定位主體，再補回附近的淺色髮尖和足部輪廓。
    foreground_rows = np.flatnonzero((alpha > 127).sum(axis=1) >= max(3, width // 250))
    nearby = foreground_rows[(foreground_rows >= top - height * 0.04) & (foreground_rows < bottom + height * 0.02)]
    top, bottom = int(nearby[0]), int(nearby[-1]) + 1
    # 只在人物上下範圍內取前景，避免底部陰影改變共同腳底位置。
    alpha[:top] = 0
    alpha[bottom:] = 0
    columns = np.flatnonzero((alpha[top:bottom] > 127).sum(axis=0) >= 3)
    left, right = int(columns[0]), int(columns[-1]) + 1
    result = image.convert("RGBA")
    result.putalpha(Image.fromarray(alpha))
    return (left, top, right, bottom), result


def make_profile(person: Image.Image, bounds: tuple[int, int, int, int]) -> Image.Image:
    # 只修正模型的灰底色差與留白；不改人物像素或人體比例。
    image = person.crop(bounds)
    scale = min(PROFILE_SIZE[0] * 0.92 / image.width, PROFILE_SIZE[1] * 0.92 / image.height)
    size = (round(image.width * scale), round(image.height * scale))
    resized = image.resize(size, Image.Resampling.LANCZOS)
    result = Image.new("RGB", PROFILE_SIZE, BACKGROUND)
    result.paste(resized, ((PROFILE_SIZE[0] - size[0]) // 2, (PROFILE_SIZE[1] - size[1]) // 2), resized)
    return result


def main() -> None:
    missing = [code for code, _, _ in CANDIDATES if not (ROOT / "raw" / f"{code}.png").is_file()]
    if missing:
        raise SystemExit("缺少原圖：" + "、".join(missing))
    label_font, small_font = font(28), font(24)
    pixels_per_cm = 4
    left_margin, column_width, right_margin = 110, 320, 30
    baseline, canvas_height = 880, 1020
    lineup = Image.new("RGBA", (left_margin + column_width * 10 + right_margin, canvas_height), (*BACKGROUND, 255))
    draw = ImageDraw.Draw(lineup)
    for cm in (170, 180, 190, 200):
        y = baseline - cm * pixels_per_cm
        draw.line((left_margin, y, lineup.width - right_margin, y), fill=(185, 192, 197), width=2)
        draw.text((left_margin - 12, y), f"{cm} cm", fill=(94, 104, 111), font=small_font, anchor="rm")
    draw.line((left_margin, baseline, lineup.width - right_margin, baseline), fill=(114, 124, 131), width=2)
    for index, (code, cm, body) in enumerate(CANDIDATES):
        source = ROOT / "raw" / f"{code}.png"
        with Image.open(source) as opened:
            image = opened.convert("RGB")
        bounds, person = detect_person(image)
        profile = make_profile(person, bounds)
        output = ROOT / f"{code}.webp"
        profile.save(output, "WEBP", lossless=True, method=6, exact=True)
        with Image.open(output) as saved:
            if saved.size != PROFILE_SIZE or not np.array_equal(np.asarray(saved.convert("RGB")), np.asarray(profile)):
                raise RuntimeError(f"{code} WebP 尺寸或無損像素驗證失敗。")
        cropped = person.crop(bounds)
        target_height = cm * pixels_per_cm
        scale = target_height / cropped.height
        target_width = round(cropped.width * scale)
        if target_width > column_width - 12:
            raise ValueError(f"{code} 人物比欄位寬；不可另縮小身高來塞入。")
        person = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
        center = left_margin + index * column_width + column_width // 2
        lineup.alpha_composite(person, (center - target_width // 2, baseline - target_height))
        draw.text((center, baseline + 25), code, fill=(35, 41, 46), font=label_font, anchor="mt")
        draw.text((center, baseline + 65), f"{cm} cm", fill=(50, 59, 65), font=small_font, anchor="mt")
        draw.text((center, baseline + 101), body, fill=(50, 59, 65), font=small_font, anchor="mt")
        print(f"{code}: {image.width}x{image.height}, bounds={bounds}, person={cropped.height}px, {cm}cm -> {target_height}px, baseline={baseline}, WebP lossless OK")
    lineup.convert("RGB").save(ROOT / "lineup.png")
    print("完成：10 張 540x960 無損 WebP、lineup.png")


if __name__ == "__main__":
    main()
