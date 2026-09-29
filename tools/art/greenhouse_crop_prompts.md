# 溫室作物生圖提示詞

每種作物一張圖，一張裡由左到右畫三個生長階段：幼苗、生長中、可採收。
共用提示詞照抄，只替換 `Crop:` 那一段。

## 生成流程（本機 GPT CLI）

1. 先只生「1. 萵苣」，確認畫風。
2. 確認後，之後每一張都把萵苣成品當第一張參考圖帶入，維持同一套畫風。
3. 輸出 PNG，1536×1024 橫式，存到 `tools/art/crops/raw/`，檔名用作物英文名，例如 `lettuce.png`、`potato.png`。
4. 全部生完再進下一步：去背、切成三個階段、縮到層架尺寸（每層開口約 22 px 高），排進 `tools/art/greenhouse_rack_bokchoy.py` 那套左端／中段／右端三段拼接。

## 共用提示詞

```
Classic cute pixel RPG crop art, clean manually clustered square pixels,
simple readable silhouette at 24×24 px, 1 px dark outline at intended
small size, restrained 3–4 tone shading per material, minimal highlights.

A single crop plant shown in three growth stages, left to right:
seedling, growing, ready to harvest. All three stand on the same flat
baseline at the same scale, evenly spaced, with the plant base cut flat
so it can sit on a hydroponic shelf tray. No pot, no soil mound, no
container. Front view seen slightly from above, cohesive top-left lighting.
Softly rounded shapes built from crisp square pixels. Charming simplified
proportions with chunky, compact silhouettes; leaves grouped into a few
large clear shapes rather than many small ones.

Crop: <作物描述>

No photorealism, no high-resolution painterly texture, no leaf-vein
detail, no ground, no shadow on the ground, no text or labels.
Background: solid magenta #FF00FF.
Each stage must remain recognizable as a small sprite on a farm rack.
```

## 挑高藤架作物

小番茄、豌豆、矮種檸檬、葡萄、百香果改放挑高藤架（`farm_rack_trellis_*.png`），
開口約 104 × 75 px，比層架一層（約 22 px）高很多。這幾種把共用提示詞的
`simple readable silhouette at 24×24 px` 改成 `simple readable silhouette at 24×72 px, tall and narrow`，
並把 `stand on the same flat baseline` 那段的植物畫成沿一條垂直細吊線往上爬。

背景色注意：櫻桃蘿蔔、藍莓、紫蘇、葡萄、百香果帶紫紅色，容易和洋紅背景混在一起。這幾種把最後的背景改成 `solid neutral grey #808080`。

---

## 左翼：蔬菜

### 1. 萵苣 lettuce

```
Crop: butter lettuce. Seedling: two small round pale-green leaves.
Growing: a loose half-open rosette of 5–6 round leaves.
Ready: a full round head with wavy outer leaves curling outward,
light yellow-green center, darker green outer leaves.
```

### 2. 馬鈴薯 potato

```
Crop: potato plant grown in an aeroponic tray, tubers visible at the base.
Seedling: a short sprout with two small dark-green compound leaves.
Growing: a bushy clump of oval dark-green leaflets, taller than wide.
Ready: a full leafy bush topped with a few small white-and-yellow star
flowers, with three round tan-brown potatoes clustered at the base,
sitting on the baseline and partly tucked under the leaves.
```

### 3. 羽衣甘藍 kale

```
Crop: curly kale. Seedling: two small frilly blue-green leaves.
Growing: an upright tuft of curly blue-green leaves.
Ready: a tall dense clump of deeply ruffled blue-green leaves with
pale green stems, frilly edges shown as a few chunky zigzag outlines.
```

### 4. 櫻桃蘿蔔 radish

```
Crop: cherry radish. Seedling: two small heart-shaped green leaves.
Growing: a small tuft of green leaves with a tiny pink root top
just showing at the base.
Ready: a round bright red radish bulb sitting on the baseline with a
short white root tip, topped by a tuft of green leaves.
```

### 5. 甜椒 bell pepper

```
Crop: bell pepper plant. Seedling: a small sprout with two glossy
green leaves. Growing: a compact bush of glossy green leaves with a
few small white flowers and one small green pepper.
Ready: a compact bush with two large blocky peppers hanging under the
leaves, one red and one yellow.
```

### 6. 豌豆 pea（挑高藤架）

```
Crop: pea vine on a thin vertical support stake. Seedling: a short
sprout with two round leaves and one curly tendril.
Growing: a vine climbing halfway up the stake, round leaves, curly
tendrils and two small white flowers.
Ready: a vine covering the full stake with plump bright green pea pods
hanging from it.
```

---

## 右翼：水果

### 7. 草莓 strawberry

```
Crop: strawberry plant. Seedling: a small clump of three-part serrated
leaves. Growing: a fuller leaf clump with small white five-petal
flowers and a few small pale green berries.
Ready: a full leaf clump with plump red strawberries with green caps
hanging over the front edge.
```

### 8. 小番茄 cherry tomato（挑高藤架）

```
Crop: cherry tomato vine on a thin vertical support stake. Seedling:
a short fuzzy sprout with two jagged leaves.
Growing: a vine halfway up the stake with small yellow star flowers
and a cluster of small green tomatoes.
Ready: a full vine with two hanging clusters of glossy round red and
orange cherry tomatoes.
```

### 9. 藍莓 blueberry

```
Crop: dwarf blueberry bush. Seedling: a thin woody stem with a few
small oval leaves. Growing: a small rounded bush with clusters of tiny
white bell-shaped flowers.
Ready: a rounded bush with small oval leaves and clusters of round
dusty blue-purple berries.
```

### 10. 鳳梨 pineapple

```
Crop: pineapple plant. Seedling: a small rosette of short spiky
blue-green leaves. Growing: a wider rosette of long spiky leaves with a
small red-pink bud in the center.
Ready: a full rosette of long spiky blue-green leaves with one golden
yellow pineapple standing in the center, crosshatch pattern shown as a
few chunky diamonds, topped with a small spiky green crown.
```

### 11. 矮種檸檬 dwarf lemon（挑高藤架）

```
Crop: dwarf lemon tree. Seedling: a thin stem with a few glossy
dark-green oval leaves. Growing: a small rounded tree with glossy
leaves, white blossoms and two small green lemons.
Ready: a small rounded tree with glossy dark-green leaves and three
bright yellow oval lemons.
```

---

### 12. 葡萄 grape（挑高藤架）

```
Crop: grape vine climbing a thin vertical hanging string. Seedling: a
short woody sprout with two small lobed leaves.
Growing: a vine halfway up the string with broad lobed leaves, curly
tendrils and small green flower clusters.
Ready: a vine covering the full string with broad lobed leaves and two
hanging bunches of round purple grapes.
```

### 13. 百香果 passion fruit（挑高藤架）

```
Crop: passion fruit vine climbing a thin vertical hanging string.
Seedling: a short sprout with two glossy three-lobed leaves and a tendril.
Growing: a vine halfway up the string with glossy three-lobed leaves and
one showy white-and-purple passion flower with a fringed crown.
Ready: a vine covering the full string with glossy leaves, one passion
flower and two round deep purple passion fruits hanging down.
```

## 右翼：綜合香草排（每種一張）

### 14. 羅勒 basil

```
Crop: sweet basil. Seedling: two small cupped bright-green leaves.
Growing: a small bush of glossy cupped leaves in opposite pairs.
Ready: a bushy upright plant of large glossy bright-green cupped leaves
with a small white flower spike on top.
```

### 15. 薄荷 mint

```
Crop: mint. Seedling: two small serrated leaves.
Growing: a low spreading clump of textured serrated leaves.
Ready: a dense bushy clump of fresh green serrated leaves on square
upright stems, slightly spilling sideways.
```

### 16. 迷迭香 rosemary

```
Crop: rosemary. Seedling: a thin stem with short needle-like leaves.
Growing: a few upright woody stems with dark grey-green needles.
Ready: a dense upright bush of woody stems covered in dark grey-green
needle leaves, with a few tiny pale blue flowers.
```

### 17. 紫蘇 perilla

```
Crop: purple perilla (shiso). Seedling: two small serrated purple-green
leaves. Growing: a small bush of broad serrated leaves, green on top
and purple underneath.
Ready: a bushy plant of broad serrated deep purple leaves with green
edges.
```

### 18. 細香蔥 chives

```
Crop: chives. Seedling: a few thin short green hollow shoots.
Growing: a tuft of thin upright hollow green leaves.
Ready: a tall dense tuft of thin upright green leaves with two round
lavender pom-pom flowers on top.
```

### 19. 百里香 thyme

```
Crop: thyme. Seedling: a tiny sprig with very small round leaves.
Growing: a low mound of thin stems with tiny grey-green leaves.
Ready: a low rounded mound of tiny grey-green leaves dotted with small
pale pink flower clusters, the leaves grouped into a few soft blobs.
```
