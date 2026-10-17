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
