# 醫療室生圖 prompt

這個場景實際送出、而且成品有採用的 prompt，一張圖一節；原圖都在 `raw/`。試錯的版本不留。
生圖用 Codex（`codex exec -m gpt-6-astra -s workspace-write -i <輸入圖> -`，prompt 從 stdin 送；命令列版 Codex 太舊時不認得新模型，先 `codex update`）。

## 大門：`raw/medical_entrance_door_v2.png`

輸入圖：門框白模（形狀樣板）。切圖：`python tools/art/cut.py door medical`。

```
Generate ONE medical-center entrance door sprite using the attached shape template as the exact geometry reference.
The outer light-gray rectangle and small top-center mounting block define the complete outer silhouette. The darker inner rectangle defines the two CLOSED sliding door leaves meeting at the vertical center seam. Preserve this exact silhouette, frame width, lintel height, doorway location and front-facing proportions. Draw no extra construction outside this silhouette. The white arrow in the upper-left is a lighting instruction ONLY: remove the arrow from the output, illuminate from upper left.
Design: main entrance of a 2090 space-station medical bay, automatic double sliding door. White composite frame, graphite inner trim, restrained soft sage-green accent panels. A single slim mint-green light strip integrated horizontally into the lintel, crisp luminous pixels without a blurred halo. Each of the two white composite sliding panels has ONE narrow VERTICAL FROSTED WINDOW, symmetrical across the center seam, plus a thin horizontal green stripe at hand height. Small flush card reader on the RIGHT jamb with simple abstract indicator pixels, no letters or numbers. Small top-center block is a plain clean white light/mount enclosure with sage inset, no lettering. Clean, welcoming, friendly futuristic medical design. Rounded corners conveyed by stepped pixels; concealed fastenings. No warning stripes, no exposed pipes, no exposed screws or bolts, no industrial clutter.
Camera: front-facing wall-mounted doorway exactly like the template, orthographic, parallel edges, no perspective convergence, no tilted sides, no diagonal rotation.
Style: high-resolution pixel art for a top-down 2D RPG, designed at the detail density of a 48 x 48 pixel tile. Crisp visible square pixel clusters, stepped silhouette edges, dark one-to-two-pixel outlines, a tightly controlled palette with two or three shade levels per material and selective pixel highlights. One consistent pixel scale across the whole image. Real pixel art, not a smooth painting with a pixel filter. No antialiasing, no blurry gradients, no airbrushed shadows, no photorealism, no 3D rendering. Clean, friendly sci-fi. Light from the upper left.
Background: solid pure magenta #FF00FF outside the complete door-frame silhouette, including around the top-center mount; opaque background, not transparent. Centered complete object with all edges within canvas and matching template margin. No floor, no ground shadows, no background scene, no text, no labels, no arrows, no watermark, no logo, no characters. Square canvas matching template.
```

## 地板材質：`raw/medical_floor_resin.png`（2026-10-17）

四色霧面樹脂大方板，取代原本的小方格磁磚（太像浴室）。輸入圖：重畫好的一塊底圖（只當風格參考）。
`medical_base_v9.py` 切每色中間四片（接縫中線到接縫中線），一片 2 × 2 格，顏色調回原本四個房間的色調。

```
A flat texture sheet of floor materials for a 2D RPG game map of a sci-fi space station medical bay, seen straight from above (orthographic, no perspective, parallel edges, no camera tilt). The canvas is split into four equal square quadrants with a thin pure magenta #FF00FF gap between them. Each quadrant is filled edge to edge with the same floor material in one colour:
- top left: pale mint green
- top right: pale blue
- bottom left: soft blue-grey
- bottom right: warm off-white

The material is seamless medical-grade matte resin flooring laid as large square panels: exactly 4 x 4 panels per quadrant, all the same size, separated by very thin, slightly darker recessed seams. The panel surface is matte with an extremely subtle fine fleck and very gentle tonal variation between panels; no gloss, no shiny highlights, no reflections, no grout, no small bathroom tiles, no bevelled tile edges, no patterns, no logos, no text, no light strips, no objects, no shadows from objects. Low contrast and low noise so furniture placed on top stays readable. Modern, calm, high-tech hospital floor, not a bathroom.

Match the colour palette, softness and rendering style of the attached reference image (a finished section of the same game map): clean, friendly sci-fi, bright and soft, light from the upper left.
```

## 底圖重畫：`raw/repaint_nw.png`、`repaint_ne.png`、`repaint_sw.png`、`repaint_se.png`（2026-10-17）

腳本拼的底圖細節少，交給 GPT 照原圖重畫質感（牆頂倒角、牆面嵌板、邊緣陰影）。整張太大畫不下，切四塊：

| 塊 | 從 `base_v9.png` 切的範圍（px，左、上、右、下） |
|---|---|
| nw | 0, 0, 864, 1296 |
| ne | 816, 0, 1680, 1296 |
| sw | 0, 1008, 864, 2304 |
| se | 816, 1008, 1680, 2304 |

- 每塊 18 欄 × 27 列，2:3，放大到 1024 × 1536 當輸入圖；走廊不重畫。
- 先畫 nw；其他三塊多附 nw 的成品當第二張圖（風格參考），四塊才會一致。
- 給 Codex 的指示（prompt 前面）：照第一張附圖的構圖重畫、存成 `raw/repaint_<塊>.png`；生完用看圖工具跟輸入比對牆面上下緣、牆頂、門洞、地板接縫（差 4 px 內），牆面變矮、多出踢腳台階、多了物件就重生，最多 3 次。
- 要點：只叫它「照描＋加質感」時牆線最準；放手讓它畫，牆面會縮短（第 1 輪縮了 29 px，碰撞就對不上）。
- `medical_base_v9.py` 看到四張都在，就縮回原尺寸、沿主通道中線（x 840）與診間南牆的地板接縫（y 1152）接起來，當遊戲底圖。改了格局或地板，四塊要重畫。

```
Repaint the attached image. It is one section of a game map floor plan for a sci-fi space station medical bay, seen in a three-quarter top-down RPG view (orthographic, no perspective convergence, parallel edges). Keep the exact composition: every wall, wall top, wall face, doorway, room boundary and floor tile grid line stays at exactly the same position, size and thickness as in the input. Do not move, add or remove any wall or opening. Output the same framing, portrait 2:3, filling the whole canvas edge to edge.

Wall heights are critical: each white wall face band must keep exactly its input height. Its top edge and its bottom edge (where it meets the floor) stay on exactly the same pixel rows as in the input. Do not shorten the wall faces, do not add a skirting board or ledge below the existing bottom edge, and do not let the floor start higher or lower than in the input. The floor tile grid lines also stay exactly where they are in the input.

Only improve the material quality, like a finished game map:
- Floor: large matte medical resin floor panels, each panel two tiles wide, with very thin recessed seams. Keep every panel seam exactly where it is in the input and keep each room's floor colour. Matte surface with an extremely subtle fine fleck; no gloss, no shiny reflections, no small square tiles, no bathroom tiles, no grout. Low contrast and low noise so furniture placed later stays readable.
- Wall tops: the navy-blue bands are the wall top caps, one tile thick. Give them a rounded composite-panel look with a lighter bevel on the upper and left edges, a darker bevel on the lower and right edges, and hidden panel seams.
- Wall faces: the white bands below the wall tops are the vertical wall faces facing the camera. Make them white composite hull panels with soft vertical panel seams, a thin mint-green trim line near the top and a slim grey skirting band drawn inside the bottom of the face (the face bottom edge does not move).
- The view is flat, so depth must come from edge shading. Put a soft ambient-occlusion shadow on the floor along the foot of every wall face and along both long sides of every wall top that borders the floor. Give every wall top a bright bevel on its upper and left edges and a dark bevel on its lower and right edges. Shade the inside edges of every doorway opening slightly. Let the wall faces darken gently toward the bottom. Light from the upper left.

Strictly no furniture, no beds, no plants, no machines, no people, no doors, no signs, no text, no numbers, no labels, no light strips on the floor, no red cross. Empty rooms only.

Style: high-resolution pixel art for a top-down 2D RPG, designed at the detail density of a 48 x 48 pixel tile. Crisp visible square pixel clusters, stepped silhouette edges, dark one-to-two-pixel outlines, a tightly controlled palette with two or three shade levels per material and selective pixel highlights. One consistent pixel scale across the whole image. Real pixel art, not a smooth painting with a pixel filter. No antialiasing, no blurry gradients, no airbrushed shadows, no photorealism, no 3D rendering. Clean, friendly sci-fi. Light from the upper left.
Medical bay palette: white and mint green, rounded corners with no sharp edges, a clean disinfected feel, bright and soft with a touch of warm white light.
```


## 物件表（2026-10-23，第一版）：`raw/props_<區>.png`

五區各一張，1536 × 1024，洋紅背景。附圖：`raw/draft_lounge_sofa.png`（畫風）＋`raw/props_ref_v9.png`（鏡頭）。共同段落接在每區物件清單前面：

```
Camera: three-quarter top-down RPG view exactly like the attached floor-plan sketch (image 2): orthographic, no perspective convergence, parallel edges. Tall objects show their front face plus their top; low objects show mostly their top. No isometric rotation.
Design language: a 2090 space-station medical bay. Seamless white composite shells with soft rounded corners, matte graphite trim, hidden seams and no visible screws, slim embedded mint-green and soft cyan light strips, small holographic projections in pale cyan, integrated touch panels with abstract icons only. Clean, calm, friendly, high-tech; like a premium future hospital, not an old hospital. No paper, no books, no text, no letters, no numbers, no logos, no red cross, no exposed cables, no bolts, no rust.
Match the rendering style, outline weight, colours and softness of the attached sofa (image 1) exactly, so these objects sit in the same game.
Style: high-resolution pixel art for a top-down 2D RPG, designed at the detail density of a 96 x 96 pixel tile. Crisp visible square pixel clusters, stepped silhouette edges, dark outlines, a tightly controlled palette with two or three shade levels per material and selective pixel highlights. No blurry gradients, no airbrushed shadows, no photorealism, no 3D rendering. Light from the upper left.
Layout: the objects listed below, each one complete and separate, arranged in a single row from left to right with very wide empty gaps between them; nothing touches another object or the canvas edge. Background: solid flat pure magenta #FF00FF everywhere else. No floor, no ground shadows, no walls, no labels, no text.
```

### 病區：`raw/props_ward.png`

```
Objects (footprint in floor tiles of 1 m, for proportion):
1. Hospital pod bed, 3 tiles wide and 6 tiles long, head end at the top: sleek white shell frame, integrated headboard with a slim vital-signs light panel, soft pale-blue mattress and blanket, white pillow, side rails with embedded cyan light strips, hovering look with a recessed dark base.
2. Bedside med module, 1 tile wide: compact white rounded cabinet with a small holographic display above it and an automatic medicine dispenser slot, replaces a drip stand and bedside table.
```

### 手術室：`raw/props_surgery.png`

```
Objects (footprint in floor tiles of 1 m, for proportion):
1. Diagnostic treatment pod, 3 x 5 tiles, head at the top: a sealable surgery and isolation pod on a white pedestal, mint-green padded bed inside, transparent curved canopy slid half open, cyan scan rings.
2. Robotic surgical arm cluster, 2 x 2 tile base: a slim white floor column with three articulated white arms with fine instruments, folded neatly, small cyan joints.
3. Holographic vital-signs cart, 1 x 1 tile: a slim white mobile console projecting a floating pale-cyan holographic heart-rate and body scan above it.
```

### 診間：`raw/props_clinic.png`

```
Objects (footprint in floor tiles of 1 m, for proportion):
1. Holographic consultation desk, 3 x 2 tiles: white rounded desk with a glowing glass top projecting a small rotating translucent human body hologram, no monitors, no keyboard.
2. Doctor's chair, 1 x 1 tile: white and graphite ergonomic chair with mint-green cushion.
3. Patient scan chair, 2 x 2 tiles: a reclining white chair with mint-green cushion and a thin cyan scanning ring arch over it.
4. Examination couch, 2 x 4 tiles, head at the top: slim white couch with mint-green padding and an integrated side panel.
```

### 藥局：`raw/props_pharmacy.png`

```
Objects (footprint in floor tiles of 1 m, for proportion):
1. Automated dispensing wall, 6 tiles wide and against the back wall: a tall white wall unit made of many small rounded drawer cells with glowing mint-green status lights, a slim robotic picker arm on a rail across the front.
2. Pharmacy counter straight section, 4 tiles long, 1 tile deep, waist high: white composite counter with a pale glass top edge and a mint-green light strip along the front, plus a small touch call panel on top.
3. Pharmacy counter corner piece, 1 x 1 tile, same design, rounded L corner.
4. Self-service medicine kiosk, 1 tile wide, tall: white vending kiosk with a glowing touch screen of abstract pill icons and a pickup slot.
```

### 研究室：`raw/props_research.png`

```
Objects (footprint in floor tiles of 1 m, for proportion):
1. Holographic research table, 4 x 2 tiles: long white lab table with a glowing glass centre projecting a floating translucent molecule model, two small sample trays.
2. Lab chair, 1 x 1 tile: white and graphite stool-chair with mint-green seat.
3. Molecular synthesis chamber, 1 x 1 tile, tall: a transparent glass cylinder in a white frame with softly glowing pale-green liquid and floating capsules inside.
4. Sample cryo storage pod, 2 x 1 tiles, tall: white rounded cabinet with frosted glass door and cyan frost glow.
5. Scan analyzer, 1 x 1 tile: compact white benchtop analysis machine with a sample port and small holographic readout.
```


## 藥局整區（2026-10-24）：`raw/props_pharmacy_area.png` → `_v2` → `_v3`（採用 v3）

不再一件一件拼，把底圖的藥局那塊（第 17–34 欄、第 14–25 列，放大到 1536 × 1024，約一格 85 px）交給 GPT 直接畫整套。附圖：底圖切塊（或上一版）＋`raw/draft_lounge_sofa.png`（畫風）。
v2 依大醫院門診藥局的功能分區加物件；v3 修掉地上的輸送管、矮凳換高腳凳。v3 只當設計範本；遊戲用的物件照下一節在洋紅底上重畫成單件再切（從整區圖直接拆會沾到 GPT 重畫的地板，已作廢）。

### v1
```
Draw furniture into the attached image 1 and keep everything else identical: same camera, same framing, same floor tiles, same walls, same size. Image 1 is part of a game map of a 2090 space-station medical bay, three-quarter top-down RPG view, orthographic, parallel edges. The light-grey brick floor on the left is the main aisle. The room on the right, below the long white wall face, is the pharmacy. Each floor tile is one metre; the map is 18 tiles wide and 12 tiles tall.

Furnish the pharmacy as ONE coherent, built-in design, like a premium future pharmacy:
- Against the white back wall (top of the pharmacy, spanning its full width): a tall automated dispensing wall made of many small rounded drawer cells with soft mint-green status lights, a slim robotic picker arm on a rail across it, and a pharmacist workstation in front of it with a floating pale-cyan holographic prescription display.
- An L-shaped, waist-high service counter enclosing the pharmacy: one arm runs down the LEFT edge of the pharmacy floor (along the boundary with the grey aisle), with a 2-tile-wide gap near its lower end as a staff entrance; the other arm runs along the BOTTOM edge of the pharmacy floor from that corner all the way to the right wall. White composite counter body, pale glass top edge, a mint-green light strip along the outer front. A small touch call panel on the counter facing the aisle, and one facing the bottom.
- Below the counter, outside the pharmacy (the floor strip at the bottom), leave the floor empty: it is the waiting area for collecting medicine.
- Leave the grey aisle on the left completely empty.

Design language: seamless white composite shells with soft rounded corners, matte graphite trim, hidden seams, no visible screws, slim embedded mint-green and soft cyan light strips, small holographic projections in pale cyan, abstract icons only. Calm, clean, friendly, high-tech. No paper, no boxes with labels, no text, no letters, no numbers, no logos, no red cross, no people, no plants.
Match the rendering style, outline weight, colours and softness of the attached sofa (image 2).
Style: high-resolution pixel art for a top-down 2D RPG, designed at the detail density of a 96 x 96 pixel tile. Crisp pixel clusters, dark outlines, a controlled palette with two or three shade levels per material, selective highlights. No blurry gradients, no photorealism, no 3D rendering. Light from the upper left.
```

### v2（在 v1 上加物件）
```
Image 1 is a finished pharmacy area in a game map of a 2090 space-station medical bay (three-quarter top-down RPG view, orthographic, parallel edges; each floor tile is one metre). Keep EVERYTHING in image 1 exactly as it is: camera, framing, size, floor, walls, the dispensing wall with its picker arm, the pharmacist workstation with its holographic screen and chair, and the L-shaped counter in the same positions. Only ADD the following built-in items inside the pharmacy, in the same design and rendering style, so it looks like a complete busy hospital outpatient pharmacy:
- On the counter facing the bottom waiting strip: a pickup window unit with a small delivery chute fed by a slim conveyor tube coming from the dispensing wall, and above the counter a thin floating queue light-bar with abstract glowing dots (no numbers).
- On the workstation: a small holographic verification scanner.
- A sterile compounding station: a white cabinet with a transparent hood and a tiny built-in robotic arm, against the right wall below the dispensing wall.
- A refrigerated medicine cabinet with a frosted glass door and cool blue glow, and next to it a dark graphite secure locker for controlled medicines with a small lock light.
- Near the staff entrance gap in the left counter arm, inside the pharmacy: two or three sealed white supply crates with mint stripes, stacked neatly (delivered by the supply ship).
- A pneumatic tube system along the top of the back wall ending in a small receiving port near the workstation.
- At the right end of the bottom counter: a small medication counselling spot with two white high stools on the waiting side.
Keep walkable space inside the pharmacy between the items. Keep the grey aisle on the left and the floor strip below the counter empty.
Design language: seamless white composite shells, soft rounded corners, matte graphite trim, hidden seams, slim mint-green and soft cyan light strips, pale cyan holograms, abstract icons only. No paper, no text, no letters, no numbers, no logos, no red cross, no people, no plants.
Match the rendering style, outline weight and softness of image 1 (and of the sofa in image 2).
Style: high-resolution pixel art for a top-down 2D RPG, designed at the detail density of a 96 x 96 pixel tile, dark outlines, controlled palette, light from the upper left.
```

### v3（在 v2 上修兩處）
```
Image 1 is a finished pharmacy area in a game map of a 2090 space-station medical bay (three-quarter top-down RPG view, orthographic, parallel edges; each floor tile is one metre). Keep EVERYTHING in image 1 exactly as it is (camera, framing, size, floor, walls, dispensing wall, picker arm, pneumatic tube on the back wall, workstation with hologram, scanner, the three cabinets on the right wall, supply crates, L-shaped counter, pickup window, queue light-bar, counselling screen), with only these two fixes:
1. Remove the conveyor tube that lies across the pharmacy floor between the dispensing wall and the pickup window, and repaint that floor as clean empty floor matching the surrounding tiles. Instead, the pickup window is fed from above: a slim white overhead delivery tube hangs from the ceiling and drops straight down into the pickup window unit (only a short vertical section is visible above the window, nothing on the floor).
2. Replace the two low stools at the counselling spot on the right end of the bottom counter with two tall white bar stools (high seat, slim graphite stem, footrest ring, mint-green seat cushion), standing on the waiting side below the counter, the right height for sitting and leaning on the counter.
The pharmacy floor between the furniture must stay clear and walkable. Keep the grey aisle on the left and the floor strip below the counter empty except the two bar stools.
Same design language and rendering as image 1: seamless white composite shells, soft rounded corners, graphite trim, mint-green and cyan light strips, pale cyan holograms. No paper, no text, no letters, no numbers, no logos, no people, no plants. Match the sofa in image 2 for style. High-resolution pixel art at the detail density of a 96 x 96 pixel tile, dark outlines, light from the upper left.
```


## 藥局單件（2026-10-24）：`raw/props_pharmacy_long.png`、`raw/props_pharmacy_small.png`

照 `raw/props_pharmacy_area_v3.png` 的設計在洋紅底上重畫成單件。附圖：v3（設計）＋`raw/draft_lounge_sofa.png`（畫風）。
切圖：`python tools/art/cut.py props medical all`（清單與寬度在 `tools/art/medical_objects.py`）→ `public/assets/medical/props/pharmacy-*.webp`。

```
Image 1 is the approved design of a 2090 space-station hospital pharmacy drawn inside a game map. Redraw the SAME objects with the SAME design, colours and details as standalone game sprites on a plain background, so they can be cut out and placed on the map one by one. Do not redesign them.
Camera: three-quarter top-down RPG view exactly like image 1: orthographic, no perspective convergence, parallel edges; tall objects show their front face plus top, low objects mostly their top.
Rendering: match image 1 and the sofa in image 2: dark outlines, soft cel shading, white composite shells with rounded corners, graphite trim, mint-green and cyan light strips, pale cyan holograms. High-resolution pixel art at the detail density of a 96 x 96 pixel tile, light from the upper left. No text, letters, numbers, logos, people or plants.
Layout: each object complete and separate, with very wide empty gaps; nothing touches another object or the canvas edge. Background: solid flat pure magenta #FF00FF everywhere else. No floor, no wall behind the objects, no ground shadows, no labels.
Sizes are given in floor tiles of one metre, for proportion.
```

### 長件
```
Objects, stacked from top to bottom (one per row):
1. The automated dispensing wall: 12 tiles wide, 1 tile deep, about 2.5 tiles tall, many small rounded drawer cells with mint status lights, the rail with the robotic picker claw, the small tube receiver at its lower front. Front-facing like in image 1.
2. The long service counter: 13 tiles long, 1 tile deep, waist high, seen from the front-top like in image 1, its LEFT end turning up (away from the viewer) by one tile as a rounded L corner. On its top: the pickup window unit with the short overhead feed tube and the floating queue light-bar above it (about one third from the left), the small call panel on the front, and the clear glass counselling screen near the right end. No stools.
```

### 其他
```
Objects, in one or two rows from left to right:
1. The short counter section: 1 tile wide, 4 tiles long running away from the viewer (vertical on screen), waist high, rounded ends, mint strip, a small call panel on its left side, exactly like the left counter arm in image 1.
2. The pharmacist workstation: 3 tiles wide, 1.5 tiles deep, with the curved holographic prescription screen, the white chair behind it and the small holographic verification scanner on its right.
3. The sterile compounding station: 1.3 tiles wide, tall, transparent hood with the tiny robotic arm inside.
4. The refrigerated medicine cabinet: 1 tile wide, tall, frosted glass door, cool blue glow, bottles inside.
5. The dark graphite secure locker: 1 tile wide, tall, small lock light.
6. Two stacked sealed white supply crates with mint stripes: 1.3 tiles wide.
7. One tall white bar stool: high seat with mint cushion, slim graphite stem, footrest ring, round base.
```

### 乾淨畫法規則（2026-10-24 重生兩張時加在最前面）

第一版有光暈、霧氣、髒污、描邊粗細不一；加上這段重生後乾淨。共同段落裡拿掉了 soft cel shading。
**舊版，只留紀錄**：現行規則已整合進 `.claude/skills/starport-asset-gen/SKILL.md` 第一節「共用規則段」，新 prompt 照那裡貼，不要照這段（第一條「平塗」會畫成扁平向量風）。

```
CLEAN RENDERING RULES (most important):
- Flat clean colour fills with two or three crisp shade steps per material. No gradients inside surfaces, no smudges, no noise, no grain, no dirt, no watercolour texture, no stains.
- NO glow, NO bloom, NO haze, NO light halo around anything, not even a 1-2 pixel soft rim. Light strips, screens, signs and holograms are drawn as solid flat bright colour shapes with a hard crisp edge, plus at most one lighter inner line; the colour never bleeds outside the shape.
- Lights never light up anything else: no coloured light spill, reflection or bright patch on floors, walls, counters or furniture next to a lamp or light strip. Surfaces keep their own normal colours.
- Glass is a flat, evenly tinted pale blue-grey area with two or three thin straight white reflection lines; objects behind glass are drawn clearly with flat colours, no fog.
- One uniform outline of the same thickness (about 3 px at this canvas size) around every object and every major part, continuous and unbroken, never blurry, never thicker in some places.
- Outline colour is the darkest shade of the part's own colour, never pure black: warm white shell -> dark warm grey, blue fabric -> dark navy, mint -> dark teal, wood -> dark brown.
- Rounded corners are pixel staircases (steps of 1-2 pixels stepping inward), never smooth curves or antialiased arcs. Rounded, not chamfered or 45-degree cut corners.
- PIXEL GRID: the image is a 384 x 256 pixel-art picture shown at 4x zoom. Every art pixel is exactly one 4 x 4 block aligned to one shared grid. No detail, line, star or highlight smaller than one art pixel (4 x 4). No antialiasing between blocks.
- No texture noise on planets or large surfaces; use a few flat shade areas instead.
- For a building or object sprite: NO ground, floor tiles, pavement or plinth around it (the floor comes from the game map). It ends at its base with a flat, perfectly horizontal bottom edge. Strictly orthographic: no perspective, no converging lines, no trapezoid shapes, vertical edges perfectly vertical.
- Pure clean colours: white shells are clean neutral white with light grey shading, graphite is clean dark grey, accents are clean mint green and clean cyan. No muddy, greyish-purple or dirty tints.
```


## 藥局單件第三版（2026-10-25，已被第四版取代）：像素風＋科幻設計語言

第二版（乾淨規則）顏色乾淨但變成扁平向量風，像素感不見。這版把 HD 像素風放第一優先、保留乾淨規則，並參考 `style_ref/` 的三張科幻範例（只取造型語言）。白色統一米白。
附圖：1 `raw/props_pharmacy_area_v3.png`、2 `raw/draft_lounge_sofa.png`、3–5 `style_ref/scifi_lab_interior.png`、`scifi_desk.png`、`scifi_console_relic_colony.png`。物件清單同上一節。切成 2 倍尺寸（`medical_objects.py`），遊戲裡 scale 0.5。

```
Redraw the pharmacy objects from image 1 (the approved layout and object list of a 2090 space-station hospital pharmacy) as standalone game sprites, each separate, on a plain background, so they can be cut out and placed on a map.

STYLE — HD PIXEL ART (most important): high-resolution pixel art for a top-down 2D RPG, designed at the detail density of a 96 x 96 pixel tile. Clearly visible square pixel clusters, stepped pixel edges on curves and diagonals, shading done with two or three crisp pixel shade steps per material (hard pixel clusters, a little ordered dithering allowed), selective single-pixel highlights. Real pixel art, not a smooth vector illustration and not a painting. Match the pixel feel of the sofa in image 2.
CLEAN: one uniform dark outline around every object and major part, continuous and unbroken. No glow, no bloom, no haze, no light halos: light strips, screens and holograms are crisp bright pixel shapes whose colour never bleeds outside them. No smudges, no noise, no dirt, no watercolour texture. Glass is an evenly tinted pale blue-grey with a few straight pixel reflection lines. Clean colours: warm off-white (cream-white like the sofa) shells, light warm-grey shading, graphite trim, accent stripes in mint green and soft blue.

DESIGN LANGUAGE (take only the design language from images 3, 4 and 5, not their camera or realistic rendering): built from several distinct shell panels with clear panel lines and seams; two-tone bodies, cream-white with graphite or soft-blue accent bands; chunky sculpted forms with bevelled or angled cuts and big rounded corners; functional details that read clearly at game size: recessed handles, small vents, clips and latches, drawer fronts, touch panels with abstract icons, sturdy angled feet or plinths. Precise, engineered, premium hospital equipment of 2090, not toy-like blobs.

Camera: three-quarter top-down RPG view like image 1: orthographic, no perspective convergence, parallel edges; tall objects show their front face plus top, low objects mostly their top.
Layout: each object complete and separate with very wide gaps; nothing touches another object or the canvas edge. Background: solid flat pure magenta #FF00FF. No floor, no walls, no ground shadows, no labels, no text, no letters, no numbers, no logos, no people, no plants, no paper.
Sizes are in floor tiles of one metre, for proportion.
```


## 藥局單件第四版（2026-10-25，採用）：重新設計科幻造型＋正面俯視

第三版還是照 v3 的圓潤造型描，沒有科幻年代感。這版不附 v3，只附 `raw/draft_lounge_sofa.png`（像素畫風與鏡頭）＋`style_ref/` 三張科幻範例（造型），重新設計每件。
小件表第一次畫出斜放、看得到側面的物件（不能用），加上鏡頭規則重生。長件表用 p5 版（本來就是正面）。

### 共同（小件表用；長件表同內容但鏡頭段是舊寫法）
```
Design NEW furniture for a hospital pharmacy aboard a 2090 space station, as standalone game sprites, each separate, on a plain background.

DESIGN (most important): the shapes must clearly read as advanced sci-fi equipment of the year 2090, in the design language of images 2, 3 and 4 (use only their design language, not their camera or realistic rendering): angular faceted forms with bevelled and chamfered cuts, cantilevered and floating tops, sculpted asymmetric bodies, large tilted transparent display panels, bodies assembled from several distinct shell panels with crisp panel lines and seams, two-tone colour blocking (warm off-white shells with graphite plinths and soft-blue accent bands), functional details such as recessed handles, latches, vents, clamps and touch panels with abstract icons. NOT rounded capsule shapes, NOT bubbly toy-like furniture, NOT ordinary present-day hospital furniture.

STYLE: HD pixel art for a top-down 2D RPG at the detail density of a 96 x 96 pixel tile: clearly visible square pixel clusters, stepped pixel edges on curves and diagonals, two or three crisp pixel shade steps per material, selective single-pixel highlights. Real pixel art like the sofa in image 1, not a smooth vector illustration, not a painting.
CLEAN: one uniform dark outline around every object and major part, continuous and unbroken. No glow, no bloom, no haze, no halos: lights, screens and holograms are crisp bright pixel shapes whose colour never bleeds outside them. No smudges, noise or dirt. Glass is evenly tinted pale blue-grey with a few straight pixel reflection lines.

CAMERA — STRAIGHT FRONT VIEW FROM ABOVE (most important, objects drawn any other way are unusable):
- Every object faces the viewer head-on. Its front face is a flat rectangle exactly parallel to the image, and its top surface is visible as a strip directly above the front face, as in a classic top-down RPG (like the sofa in image 1).
- NO side faces visible on the left or right, NO rotation, NO diagonal or isometric placement, NO three-quarter turn. All vertical edges are perfectly vertical and all horizontal edges perfectly horizontal on screen.
- Left-right symmetric silhouettes wherever the design allows.
Layout: each object complete and separate with very wide gaps; nothing touches another object or the canvas edge. Background: solid flat pure magenta #FF00FF. No floor, no walls, no ground shadows, no labels, no text, letters, numbers, logos, people, plants or paper.
Sizes are in floor tiles of one metre, for proportion.
```

### 長件
```
Objects, stacked from top to bottom (one per row):
1. Automated medicine storage wall, 12 tiles wide, 1 tile deep, about 2.5 tiles tall, seen from the front: a floor-to-ceiling modular wall of angular framed bays; behind smoked glass panels, a dense grid of small lit medicine cells; an overhead gantry rail across the top with a compact robotic picker head; graphite plinth at the bottom; soft-blue accent bands dividing the modules.
2. Service counter, 13 tiles long and 1 tile deep, waist high, seen from the front-top, its LEFT end turning up (away from the viewer) by one tile as an angular L corner: a cantilevered off-white top floating over a faceted, chamfered graphite-and-white base, a thin inset light line under the top edge, one integrated pickup hatch with a slim overhead delivery tube and a small flat queue light-bar, a flush touch call panel on the front, and a tilted clear glass privacy screen near the right end. No stools.
```

### 其他
```
Objects, in one or two rows from left to right:
1. Short counter section, 1 tile wide and 4 tiles long, placed with its long axis pointing straight up the screen (a tall narrow vertical shape on screen): we look down onto its long top surface as a vertical strip and see only its short front end face at the bottom; waist high; same design as a cantilevered faceted service counter (off-white floating top, chamfered graphite-and-white base, inset light line), a flush touch call panel on its left side.
2. Pharmacist workstation, 3 tiles wide: a sculpted desk facing the viewer head-on (front panel parallel to the image) with a floating top and angled side panels, a large tilted transparent display panel showing abstract pale-cyan data, a compact verification scanner pad, and a sleek white egg-shaped swivel chair behind the desk, seen from the front.
3. Sterile compounding cabinet, 1.3 tiles wide, tall: a white angular-framed glass enclosure on a graphite base with a small articulated robotic arm and vials inside, a side control panel.
4. Cryogenic medicine storage unit, 1 tile wide, tall: segmented off-white body with a frosted glass door, soft-blue bands, a small row of abstract indicator pixels.
5. Controlled-drug safe, 1 tile wide, tall: armoured graphite panels with off-white trim, a biometric palm-scanner panel.
6. Two stacked hard-shell supply cases with carry handles, latches and soft-blue stripes, 1.3 tiles wide.
7. One tall bar stool: sculpted saddle seat in off-white with a mint cushion insert, slim graphite pedestal, footrest ring.
```
