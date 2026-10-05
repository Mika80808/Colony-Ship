"""T1 角色素材整理（不生圖、不處理玩家、不改路西恩）。

用法：python tools/art/characters_build.py
需要 Pillow、numpy；首次執行以 git mv 兩段式將三個角色目錄改成小寫。
原始 WebP 留在 raw/<id>/originals/，之後都由同一來源重建，避免反覆縮放。
"""

from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "public/assets"
RAW = ROOT / "tools/art/characters/raw"
EXPRESSIONS = ("neutral", "happy", "sad", "angry", "surprised", "shy")
ALIASES = {"normal": "neutral", "troubled": "sad"}
NPCS = ("aiden", "ethan", "luca", "lucian", "blaze")


def lowercase_directory(name):
    """Windows 必須經中間名稱；已整理過時不動 Git index。"""
    existing = next(p for p in ASSETS.iterdir() if p.name.lower() == name)
    if existing.name == name:
        return existing
    temporary = ASSETS / f"{name}_t1_rename"
    if temporary.exists():
        raise RuntimeError(f"中間目錄已存在：{temporary.relative_to(ROOT)}")
    for source, target in ((existing, temporary), (temporary, ASSETS / name)):
        subprocess.run(
            ["git", "mv", source.relative_to(ROOT).as_posix(), target.relative_to(ROOT).as_posix()],
            cwd=ROOT, check=True,
        )
    return ASSETS / name


def preserve_originals(directory, names):
    archive = RAW / directory.name / "originals"
    archive.mkdir(parents=True, exist_ok=True)
    # 使用實際檔名，避免 Windows 把已縮小的 walk.webp 誤當成原始 Walk.webp。
    for source in directory.iterdir():
        if source.name in names and not (archive / source.name).exists():
            shutil.copyfile(source, archive / source.name)
    for name in names:
        if not (archive / name).is_file():
            raise FileNotFoundError(f"缺少重建來源：{(archive / name).relative_to(ROOT)}")
    return archive


def save_webp(image, target, size):
    # 同尺寸不重新取樣；不同長寬比保留全圖，用留白補到指定畫布。
    image = image.convert("RGBA")
    if image.size != size:
        art = ImageOps.contain(image, size, Image.Resampling.LANCZOS)
        image = Image.new("RGBA", size, "white")
        image.alpha_composite(art, ((size[0] - art.width) // 2, (size[1] - art.height) // 2))
    image.save(target, "WEBP", lossless=True, method=6, exact=True)


def build_from_original(source, target, size):
    with Image.open(source) as image:
        if image.size == size and is_lossless(source):
            shutil.copyfile(source, target)
        else:
            save_webp(image, target, size)


def build_existing(name):
    directory = lowercase_directory(name)
    archive = preserve_originals(directory, (
        "portrait.webp", "profile.webp", "normal.webp", "happy.webp", "troubled.webp",
        "angry.webp", "surprised.webp", "shy.webp", "Walk.webp",
    ))
    for filename, size in (("portrait.webp", (512, 512)), ("profile.webp", (540, 960))):
        build_from_original(archive / filename, directory / filename, size)
    for source_name in ("normal", "happy", "troubled", "angry", "surprised", "shy"):
        target_name = ALIASES.get(source_name, source_name)
        build_from_original(archive / f"{source_name}.webp", directory / f"{target_name}.webp", (514, 514))
        if source_name in ALIASES:
            (directory / f"{source_name}.webp").unlink(missing_ok=True)

    temporary = directory / "walk.build.webp"
    subprocess.run([
        sys.executable, str(ROOT / "tools/pack_walk_sheet.py"),
        str(archive / "Walk.webp"), str(temporary),
    ], cwd=ROOT, check=True)
    # 在新圖完成後才刪舊檔；Windows 的 Walk.webp 與 walk.webp 是同一個路徑。
    (directory / "Walk.webp").unlink(missing_ok=True)
    temporary.replace(directory / "walk.webp")


def build_blaze():
    directory = ASSETS / "blaze"
    archive = preserve_originals(directory, ("portrait.webp", "profile.webp"))
    for filename, size in (("portrait.webp", (512, 512)), ("profile.webp", (540, 960))):
        build_from_original(archive / filename, directory / filename, size)
    with Image.open(RAW / "blaze/expressions_sheet.png") as sheet:
        if sheet.size != (1024, 1536):
            raise ValueError(f"Blaze 表情表應為 1024×1536，實際 {sheet.size}")
        # 目視確認：左→右、上→下；全表等距切，不各自裁人物，保留頭部位置。
        for index, expression in enumerate(EXPRESSIONS):
            x, y = index % 2 * 512, index // 2 * 512
            cell = sheet.crop((x, y, x + 512, y + 512))
            save_webp(cell, directory / f"{expression}.webp", (514, 514))


def is_lossless(path):
    data = path.read_bytes()
    offset = 12
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        if kind == b"VP8L":
            return True
        length = int.from_bytes(data[offset + 4:offset + 8], "little")
        offset += 8 + length + length % 2
    return False


def validate_outputs():
    # lucian 是已驗收素材，依派工單保持位元組不變。
    for name in ("aiden", "ethan", "luca", "blaze"):
        expected = {"portrait": (512, 512), "profile": (540, 960), "walk": (688, 688)}
        expected.update({expression: (514, 514) for expression in EXPRESSIONS})
        for stem, size in expected.items():
            path = ASSETS / name / f"{stem}.webp"
            with Image.open(path) as image:
                if image.size != size or not is_lossless(path):
                    raise ValueError(f"素材尺寸或無損格式錯誤：{path.relative_to(ROOT)}")
                if stem == "walk" and (image.mode != "RGBA" or image.getextrema()[3][0] != 0):
                    raise ValueError(f"行走圖缺少透明背景：{path.relative_to(ROOT)}")


def review_sheet():
    width, row_height, label_width, thumb = 1890, 286, 90, 150
    canvas = Image.new("RGB", (width, 46 + row_height * len(NPCS)), "#edf0f4")
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.load_default(size=16)
    except TypeError:  # 相容 Pillow 10.0 之前的系統安裝。
        font = ImageFont.load_default()
    labels = ("portrait", "profile", *EXPRESSIONS, "walk down", "walk up", "walk left", "walk right")
    for column, label in enumerate(labels):
        draw.text((label_width + column * thumb + 4, 16), label, fill="#263040", font=font)
    for row, name in enumerate(NPCS):
        top = 46 + row * row_height
        draw.text((8, top + 16), name, fill="#263040", font=font)
        directory = ASSETS / name
        frames = []
        for stem in ("portrait", "profile", *EXPRESSIONS):
            with Image.open(directory / f"{stem}.webp") as image:
                frames.append(image.convert("RGBA"))
        with Image.open(directory / "walk.webp") as image:
            frames.extend(image.convert("RGBA").crop((c * 172, 0, (c + 1) * 172, 172)) for c in range(4))
        for column, frame in enumerate(frames):
            x = label_width + column * thumb
            height = 267 if column == 1 else thumb
            art = ImageOps.contain(frame, (thumb - 8, height - 8), Image.Resampling.LANCZOS)
            draw.rectangle((x + 2, top + 2, x + thumb - 3, top + height - 3), fill="white", outline="#c7ccd4")
            canvas.paste(art, (x + (thumb - art.width) // 2, top + (height - art.height) // 2), art)
        draw.line((0, top + row_height - 1, width, top + row_height - 1), fill="#c7ccd4")
    target = ROOT / "tools/art/characters/review_sheet.png"
    canvas.save(target)
    print(f"總覽圖：{target.relative_to(ROOT).as_posix()}")


def main():
    for name in ("aiden", "ethan", "luca"):
        build_existing(name)
    build_blaze()
    validate_outputs()
    review_sheet()
    print("T1 素材整理完成；玩家與路西恩素材未修改。")


if __name__ == "__main__":
    main()
