# 溫室作物生圖提示詞

每種作物一張圖，一張裡由左到右畫三個生長階段：幼苗、生長中、可採收。
共用提示詞照抄，只替換 `Crop:` 那一段。

## 溫室排位

作物分兩種擺法：**層架**（長條形，圖檔裡的三層架）和**藤架**（攀爬在直立支柱上）。
共用一排的兩種作物各佔半排。右翼的層架和藤架交錯排，高低起伏會比左翼明顯。

| 排 | 左翼 | 右翼 |
|---|---|---|
| 1 | 萵苣（層架） | 草莓＋藍莓（層架） |
| 2 | 馬鈴薯（層架） | 小番茄（藤架） |
| 3 | 羽衣甘藍（層架） | 鳳梨（層架） |
| 4 | 櫻桃蘿蔔（層架） | 矮種檸檬（藤架） |
| 5 | 甜椒（層架） | 葡萄＋百香果（藤架） |
| 6 | 豌豆（藤架） | 綜合香草（層架） |

## 生成流程（本機 GPT CLI）

1. 先只生「1. 萵苣」，確認畫風。
2. 確認後，之後每一張都把萵苣成品當第一張參考圖帶入，維持同一套畫風。
3. 輸出 PNG，1536×1024 橫式，存到 `tools/art/crops/raw/`，檔名用作物英文名，例如 `lettuce.png`、`potato.png`。
4. 全部生完再進下一步：去背、切成三個階段、縮到層架尺寸（每層開口約 22 px 高），再排進種植架做左端／中段／右端三段拼接（原青江菜版腳本已刪，可從 git 紀錄 `fb6590e` 取回參考）。

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
Background: fully transparent (PNG with alpha channel), no background color at all.
Each stage must remain recognizable as a small sprite on a farm rack.
```

背景：GPT 可以直接生成透明背景，不用洋紅底再去背。以萵苣當參考圖時，萵苣原圖是洋紅底，要在提示詞補一句 `Ignore the magenta background of Image1.`

## 藤架作物（豌豆、小番茄、矮種檸檬、葡萄、百香果）

支柱屬於種植架貼圖，一開始就架好、高度固定；作物圖只負責替換植株的生長階段。

1. 帶兩張參考圖：Image1 = 萵苣成品（畫風），Image2 = `tools/art/crops/stake_template.png`（三根等高的純青色 #00FFFF 支柱，x 中心 256／768／1280，y 176–815，寬 32 px）。
2. GPT 照模板位置畫植株攀在支柱上，支柱維持純青色。
3. 生完用程式把 #00FFFF 支柱像素扣成透明，只留植株；遊戲裡由種植架貼圖的支柱補上。纏在支柱前面的莖和卷鬚會留下。

藤架作物用下面這段取代共用提示詞，同樣只替換 `Crop:`；開頭另外說明 Image2 是支柱模板、支柱位置與形狀不可更動。

```
Classic cute pixel RPG crop art, clean manually clustered square pixels,
simple readable silhouette at 24×24 px, 1 px dark outline at intended
small size, restrained 3–4 tone shading per material, minimal highlights.

A single climbing crop shown in three growth stages, left to right:
seedling, growing, ready to harvest, each climbing the stake at that
position in Image2. The plant base is cut flat at the bottom of the
stake. No pot, no soil mound, no container. Front view seen slightly
from above, cohesive top-left lighting. Softly rounded shapes built from
crisp square pixels. Charming simplified proportions with chunky,
compact silhouettes; leaves grouped into a few large clear shapes rather
than many small ones. Stems and tendrils may wrap in front of the stake
in a few places; everywhere else the stake stays visible as flat cyan.

Seedling stage: the plant only covers the bottom quarter of the stake.
Growing stage: the plant climbs to about the middle of the stake.
Ready stage: the plant covers the stake almost to the top.

Crop: <作物描述>

No photorealism, no high-resolution painterly texture, no leaf-vein
detail, no ground, no shadow on the ground, no text or labels.
Background: fully transparent (PNG with alpha channel), no background
color at all. Ignore the background colors of Image1 and Image2.
Each stage must remain recognizable as a small sprite on a farm rack.
```

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

### 6. 豌豆 pea（藤架）

```
Crop: pea vine. Seedling: a short sprout with two round leaves and one
curly tendril. Growing: round leaves, curly tendrils and two small white
flowers. Ready: round leaves and tendrils with plump bright green pea
pods hanging from the vine.

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

### 8. 小番茄 cherry tomato（藤架）

```
Crop: cherry tomato vine. Seedling: a short fuzzy sprout with two
jagged leaves. Growing: jagged leaves, small yellow star flowers and a
cluster of small green tomatoes. Ready: jagged leaves with two hanging
clusters of glossy round red and orange cherry tomatoes.

```

### 9. 藍莓 blueberry

```
Crop: dwarf blueberry bush. Seedling: a thin woody stem with a few
small oval leaves. Growing: a small rounded bush with clusters of tiny
white bell-shaped flowers.
Ready: a rounded bush with small oval leaves and clusters of round
dusty blue-purple berries.
```

### 11. 矮種檸檬 dwarf lemon（藤架）

```
Crop: dwarf lemon trained up the stake, slender woody stems tied to the
stake with small green ties. Seedling: a short woody stem with a few
glossy dark-green oval leaves. Growing: glossy dark-green leaves, white
blossoms and two small green lemons. Ready: glossy dark-green leaves and
three bright yellow oval lemons hanging from the stems.

```

---

## 右翼：綜合香草排（每種一張）

### 12. 羅勒 basil

```
Crop: sweet basil. Seedling: two small cupped bright-green leaves.
Growing: a small bush of glossy cupped leaves in opposite pairs.
Ready: a bushy upright plant of large glossy bright-green cupped leaves
with a small white flower spike on top.
```

### 13. 薄荷 mint

```
Crop: mint. Seedling: two small serrated leaves.
Growing: a low spreading clump of textured serrated leaves.
Ready: a dense bushy clump of fresh green serrated leaves on square
upright stems, slightly spilling sideways.
```

### 14. 迷迭香 rosemary

```
Crop: rosemary. Seedling: a short sprig with one chunky spiky clump of
needle leaves. Growing: three upright sprigs, each a thick spiky clump
of dark grey-green needles.
Ready: a dense upright bush made of 4–5 large chunky spiky clumps of
dark grey-green needles, with a few small pale blue flowers.
Needles are merged into large clear clump shapes, not scattered
individual needles.
```

### 15. 紫蘇 perilla

```
Crop: purple perilla (shiso). Seedling: two small serrated purple-green
leaves. Growing: a small bush of broad serrated leaves, green on top
and purple underneath.
Ready: a bushy plant of broad serrated deep purple leaves with green
edges.
```

### 16. 細香蔥 chives

```
Crop: chives. Seedling: a few thin short green hollow shoots.
Growing: a tuft of thin upright hollow green leaves.
Ready: a tall dense tuft of thin upright green leaves with two round
lavender pom-pom flowers on top.
```

### 17. 百里香 thyme

```
Crop: thyme. Seedling: a small sprig ending in one soft round clump of
grey-green leaves. Growing: a low mound of 3 large soft rounded
grey-green leaf clumps.
Ready: a low rounded mound of 4–5 large soft grey-green leaf clumps
dotted with a few pale pink flower clusters.
Leaves are merged into large clear rounded blobs, not scattered tiny
individual leaves.
```

---

## 新增：右翼水果（排位表）

### 18. 鳳梨 pineapple（層架）

```
Crop: pineapple plant. Seedling: a small rosette of stiff pointed
blue-green leaves. Growing: a larger spiky rosette of long pointed
blue-green leaves with a small pink-red flower head in the center.
Ready: a spiky rosette of long pointed leaves with one golden-yellow
pineapple with a diamond-pattern skin and a green leafy crown standing
upright in the center.
```

### 19. 葡萄 grape（藤架）

```
Crop: grapevine. Seedling: a short woody sprout with two small lobed
leaves and one curly tendril. Growing: broad lobed leaves, curly
tendrils and two small clusters of tiny green grapes. Ready: broad lobed
leaves and two hanging bunches of round purple grapes.

```

### 20. 百香果 passion fruit（藤架）

```
Crop: passion fruit vine. Seedling: a short sprout with two glossy
oval leaves and one curly tendril. Growing: glossy three-lobed leaves,
curly tendrils and one white-and-purple passion flower. Ready: glossy
three-lobed leaves and two round dark purple passion fruits hanging
from the vine.

```
