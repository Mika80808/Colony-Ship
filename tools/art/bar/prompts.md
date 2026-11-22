# 酒吧生圖 prompt

L 型吧檯 v1–v7 是生圖規範改成精簡版的測試紀錄（2026-11-22～23）。只保留採用的 v7 原圖；v1–v6 與 v1 的尺寸框是試錯檔，不進專案，prompt 與結果描述留在這裡。

## L 型吧檯（2026-11-22，新規則段第一次試生）：`raw/props_bar_l_counter.png`

- 附圖：`frames/bar_l_counter_frame.png`（L 形尺寸框，長邊 5 格、短邊往後 3 格，一格 128 px）。沒有風格參考圖。
- Codex 試了 3 次留這張。結果：形狀、正面俯視、乾淨都對，但太平、像向量圖示，科技感和精緻度不夠（照描灰色剪影描得太死）。

```
Generate ONE image with your image generation tool and save it as ./tools/art/bar/raw/props_bar_l_counter.png. Use image generation, not code. Do not edit or create any other files.
The image contains EXACTLY ONE object: one L-shaped bar counter. Nothing else (no stools, no bottles, no people). After saving, look at the image and check: every edge is horizontal or vertical, no trapezoid, no side faces, nothing rotated; the counter follows the L silhouette in image 1; the surfaces are clean and NOT filled with panel lines, seams, screws or bolts; there is no glow or light spill; the background is flat pure magenta with no grey shape left; there is no text. If it fails, generate again (at most 3 tries).

STYLE — HD PIXEL ART (most important): refined, high-resolution pixel art for a top-down 2D RPG, drawn at double size (the detail density of a 96 x 96 pixel tile) so it still looks refined when the game shrinks it to half size. Clearly visible small square pixel clusters, stepped pixel edges on curves, shading done with three to four crisp pixel shade steps per material, selective single-pixel highlights. One consistent pixel scale across the whole image. Real pixel art, not a smooth vector illustration, not a painting, not a smooth painting with a pixel filter. No antialiasing, no blurry gradients, no airbrushed shadows, no photorealism, no 3D rendering. Clean, bright, friendly sci-fi of the year 2090, well maintained, no rust, no grime. Light from the upper left.
- HIGH-TECH FEEL (most important for the design): the object must clearly read as advanced technology of the year 2090 through its form: sleek one-piece shapes, large clean uninterrupted surfaces, screens, holographic displays and light strips integrated flush into the body, a few precise functional parts that show what the object does. Describe what each part does.
- NO FILLER DETAIL: do not fill surfaces with panel lines, seams, grooves, screws, bolts, rivets, vents, exposed pipes, cables or small random greebles just to add detail. Leave clean surfaces clean. Not retro, not old industrial, and not banal present-day furniture with neon strips pasted on.
- OUTLINES: one uniform outline of the same thickness around the object's silhouette and its few major parts only, continuous and unbroken, never blurry, never thicker in some places. Outline colour is the darkest shade of the part's own colour, never pure black. No extra lines drawn across surfaces.
- CORNERS: rounded corners are pixel staircases (steps of 1-2 pixels stepping inward), never smooth curves or antialiased arcs; rounded, not chamfered or 45-degree cut corners.
- STRAIGHT LINES ONLY: every line and edge of every object is either perfectly horizontal or perfectly vertical; no diagonal or slanted edges, no angled panels, no notches. Tables, counters and worktops are full rectangles with no cut-off or missing corners, only a SMALL rounded corner (1-2 pixel staircase) at each corner.
- CLEAN: no smudges, no noise, no grain, no dirt, no watercolour texture, no stains; no texture noise on large surfaces, use a few flat pixel shade areas instead. Clean, clear colours, no muddy or dirty tints.
- LIGHTS: NO glow, NO bloom, NO haze, NO light halo around anything, not even a 1-2 pixel soft rim. Light strips, screens, signs and holograms are solid bright pixel shapes with a hard crisp edge, plus at most one lighter inner line; the colour never bleeds outside the shape. Lights never light up anything else: no coloured light spill, reflection or bright patch on floors, walls, counters or furniture.
- GLASS: evenly tinted with two or three thin straight pixel reflection lines; things behind glass are drawn clearly, no fog.
- SPRITES: NO ground, floor tiles, pavement, plinth or ground shadow around a building or object (the floor comes from the game map); it ends at its base with a flat, perfectly horizontal bottom edge. Strictly orthographic: no perspective, no converging lines, no trapezoid shapes, vertical edges perfectly vertical. Each object faces the viewer head-on: front face parallel to the image with its top visible above it; no side faces, no rotation, no isometric placement.

CAMERA (game requirement, MOST IMPORTANT): strict orthographic straight front view as in a classic top-down RPG, like an architectural front elevation with the top surface shown as a straight band above it. The long front part of the counter has a flat rectangular front face parallel to the image, with its worktop as a straight horizontal band directly above it, exactly as wide as the front face. The short leg of the L runs AWAY from the viewer, toward the top of the image: it is drawn as an upright vertical strip of worktop seen from above, rising from the left end of the long part; only its top surface is visible, no side faces. No vanishing point, no foreshortening, no trapezoid, no rotation, no tilt. Every edge is horizontal or vertical.

Canvas 1536 x 1024. FIXED SCALE: one floor tile of one metre = 128 pixels on this canvas; outline about 4 canvas pixels thick.

INPUT ROLES:
IMAGE 1 = SIZE AND SHAPE GUIDE only (not a style reference): a flat grey L silhouette at exactly the size and position the counter must have. Light grey = worktop seen from above (the long horizontal band plus the vertical strip going up on the left); dark grey = the front face of the long part. Trace this outer shape exactly and render it as the finished pixel-art bar counter with full detail. Do not draw the grey shapes themselves.

OBJECT: an L-shaped cocktail bar counter for the lounge bar of a space station in the year 2090, about elbow high. The long part is 5 tiles wide and faces the guests; the short leg on the left runs 3 tiles back into the room. Guests sit in front of the long part and along the outside of the short leg; the bartender works inside the L.
Make the high-tech feel come from the form, not from added lines: a sleek, seamless one-piece counter body with large smooth front surfaces; a thick worktop that seems to float slightly above the body on a recessed shadow gap; a slim light strip integrated flush along the underside of the worktop edge; a recessed foot rail along the bottom of the front face. On the worktop: a few flush integrated elements only, such as a slim flush touch-control strip and two small circular wireless drink-pads set into the surface; otherwise the worktop is empty and clean. Mood: a stylish night-time lounge bar; choose the colours freely to fit that mood, but use no magenta or pink anywhere on the counter (the background is magenta).
Not retro, not industrial: no exposed bolts or rivets, no panel-line grid, no vents, no exposed pipes or cables, no chunky feet, no yellow-black stripes.

Background: solid flat pure magenta #FF00FF everywhere outside the object. No floor, no shadows, no people, no labels, readable writing, logos or numbers.
```

## L 型吧檯 v2（2026-11-23）：`raw/props_bar_l_counter_v2.png`

- 不附任何圖（使用者：不要給白膜），風格補「美式復古、賽博霓虹」，背景改中性灰 #808080（有亮粉霓虹）。
- Codex 試 3 次留這張。結果：主題有出來（酒紅軟包、鍍鉻腳踏桿、深木檯面、青粉霓虹、短邊全息酒單），L 形與正面俯視正確、沒光暈；木頭檯面有一點平滑漸層，整體仍偏簡單。

```
Generate ONE image with your image generation tool and save it as ./tools/art/bar/raw/props_bar_l_counter_v2.png. Use image generation, not code. No input images are attached on purpose. Do not edit or create any other files.
The image contains EXACTLY ONE object: one L-shaped bar counter. Nothing else (no stools, no bottles, no glasses, no people). After saving, look at the image and check: it is an L shape as described in CAMERA; every edge is horizontal or vertical, no trapezoid, no side faces, nothing rotated; it looks like American retro mixed with cyberpunk neon, with real volume and material richness, not a flat icon; surfaces are NOT filled with panel lines, seams, screws or bolts; neon has no glow or light spill; the background is flat neutral grey #808080; there is no text. If it fails, generate again (at most 3 tries).

STYLE — HD PIXEL ART (most important): refined, high-resolution pixel art for a top-down 2D RPG, drawn at double size (the detail density of a 96 x 96 pixel tile) so it still looks refined when the game shrinks it to half size. Clearly visible small square pixel clusters, stepped pixel edges on curves, shading done with three to four crisp pixel shade steps per material, selective single-pixel highlights. One consistent pixel scale across the whole image. Real pixel art, not a smooth vector illustration, not a painting, not a smooth painting with a pixel filter. No antialiasing, no blurry gradients, no airbrushed shadows, no photorealism, no 3D rendering. Clean, bright, friendly sci-fi of the year 2090, well maintained, no rust, no grime. Light from the upper left.
- HIGH-TECH FEEL (most important for the design): the object must clearly read as advanced technology of the year 2090 through its form: sleek one-piece shapes, large clean uninterrupted surfaces, screens, holographic displays and light strips integrated flush into the body, a few precise functional parts that show what the object does. Describe what each part does.
- NO FILLER DETAIL: do not fill surfaces with panel lines, seams, grooves, screws, bolts, rivets, vents, exposed pipes, cables or small random greebles just to add detail. Leave clean surfaces clean. Never worn-out, dated or old industrial machinery, and not banal present-day furniture with neon strips pasted on (a deliberate theme such as American retro, when the object description asks for it, is fine: it is a 2090 reinterpretation of that style).
- OUTLINES: one uniform outline of the same thickness around the object's silhouette and its few major parts only, continuous and unbroken, never blurry, never thicker in some places. Outline colour is the darkest shade of the part's own colour, never pure black. No extra lines drawn across surfaces.
- CORNERS: rounded corners are pixel staircases (steps of 1-2 pixels stepping inward), never smooth curves or antialiased arcs; rounded, not chamfered or 45-degree cut corners.
- STRAIGHT LINES ONLY: every line and edge of every object is either perfectly horizontal or perfectly vertical; no diagonal or slanted edges, no angled panels, no notches. Tables, counters and worktops are full rectangles with no cut-off or missing corners, only a SMALL rounded corner (1-2 pixel staircase) at each corner.
- CLEAN: no smudges, no noise, no grain, no dirt, no watercolour texture, no stains; no texture noise on large surfaces, use a few flat pixel shade areas instead. Clean, clear colours, no muddy or dirty tints.
- LIGHTS: NO glow, NO bloom, NO haze, NO light halo around anything, not even a 1-2 pixel soft rim. Light strips, screens, signs and holograms are solid bright pixel shapes with a hard crisp edge, plus at most one lighter inner line; the colour never bleeds outside the shape. Lights never light up anything else: no coloured light spill, reflection or bright patch on floors, walls, counters or furniture.
- GLASS: evenly tinted with two or three thin straight pixel reflection lines; things behind glass are drawn clearly, no fog.
- SPRITES: NO ground, floor tiles, pavement, plinth or ground shadow around a building or object (the floor comes from the game map); it ends at its base with a flat, perfectly horizontal bottom edge. Strictly orthographic: no perspective, no converging lines, no trapezoid shapes, vertical edges perfectly vertical. Each object faces the viewer head-on: front face parallel to the image with its top visible above it; no side faces, no rotation, no isometric placement.

CAMERA (game requirement, MOST IMPORTANT): strict orthographic straight front view as in a classic top-down RPG, like an architectural front elevation with the top surface shown as a straight band above it. The counter is an L shape. Its LONG PART runs left to right across the lower part of the image: a flat rectangular front face parallel to the image, with its worktop shown as a straight horizontal band directly above the front face, exactly as wide as it. Its SHORT LEG starts at the LEFT end of the long part and runs AWAY from the viewer, toward the top of the image: it is drawn as an upright vertical strip of worktop seen from above, the same width as the long worktop band is deep; only its top surface is visible, no side faces. No vanishing point, no foreshortening, no trapezoid, no rotation, no tilt. Every edge is horizontal or vertical.

Canvas 1536 x 1024. FIXED SCALE: one floor tile of one metre = 128 pixels on this canvas, so the long part is about 640 pixels wide and the short leg rises about 384 pixels above the long worktop; centre the counter on the canvas. Outline about 4 canvas pixels thick.

OBJECT: the L-shaped bar counter of the lounge bar on a space station in the year 2090, about elbow high. The long part faces the guests; the short leg on the left runs back into the room; the bartender works inside the L.
STYLE THEME: American retro bar mixed with cyberpunk neon, reimagined as 2090 high technology. Retro side: a classic American bar counter with a rounded, padded front made of tufted oxblood-red leather in a few big quilted cushions, a polished chrome edge band and a chrome foot rail along the bottom, a thick worktop of dark glossy wood with a rounded nosing. Cyberpunk side: crisp neon tubes integrated flush into the counter (one neon line under the worktop nosing and a neon line along the foot rail) in vivid cyan and hot pink, plus a slim flush holographic menu display set into the worktop of the short leg. Real volume: the worktop clearly overhangs the body with a dark shadow gap under the nosing, the padded front bulges out in soft rounded cushions, chrome catches small highlights. Richness comes from materials and forms (leather, chrome, glossy wood, neon), not from added lines.
The worktop is otherwise empty. Neon tubes are solid bright pixel shapes with a hard edge, no glow, no light on anything else.
Not worn-out or dirty: no exposed bolts or rivets, no panel-line grid, no vents, no exposed pipes or cables, no yellow-black stripes.

Background: solid flat neutral grey #808080 everywhere outside the object (NOT magenta). No floor, no shadows, no people, no labels, readable writing, logos or numbers.
```

## L 型吧檯 v3（2026-11-23，非像素風試生）：`raw/props_bar_l_counter_v3.png`

- 使用者：像素風精緻度一直很差，去掉像素風再試。共用規則段的 STYLE 換成「精緻 HD 2D 遊戲插畫、NOT pixel art」，像素相關字眼（階梯圓角、pixel shapes）改掉，其他規則照舊；不附圖、灰底。
- 結果：材質精緻很多（木紋、釘扣縫線皮革、鏡面鍍鉻），L 形與正面俯視正確；偏亮面半寫實，酒單螢幕外圈有一點淡淡的光暈。

```
Generate ONE image with your image generation tool and save it as ./tools/art/bar/raw/props_bar_l_counter_v3.png. Use image generation, not code. No input images are attached on purpose. Do not edit or create any other files.
The image contains EXACTLY ONE object: one L-shaped bar counter. Nothing else (no stools, no bottles, no glasses, no people). After saving, look at the image and check: it is NOT pixel art but a refined, high-detail HD illustration; it is an L shape as described in CAMERA; every edge is horizontal or vertical, no trapezoid, no side faces, nothing rotated; it looks like American retro mixed with cyberpunk neon, with real volume and rich materials; surfaces are NOT filled with panel lines, seams, screws or bolts; neon has no glow or light spill; the background is flat neutral grey #808080; there is no text. If it fails, generate again (at most 3 tries).

STYLE — REFINED HD 2D GAME ILLUSTRATION (most important): NOT pixel art. A polished, high-resolution hand-crafted 2D game asset for a top-down RPG, like premium hand-painted HD sprites: clean crisp edges, a crisp uniform dark outline, confident painted shading with clear light and shadow shapes, rich material rendering (glossy wood grain, soft quilted leather with stitching and buttons, mirror-like chrome with sharp highlights), refined small details where they belong. No pixelation, no visible pixel blocks, no stepped edges, no blur, no airbrushed haze, no photorealism, no 3D render look. Clean, friendly sci-fi of the year 2090, well maintained, no rust, no grime. Light from the upper left.
- HIGH-TECH FEEL (most important for the design): the object must clearly read as advanced technology of the year 2090 through its form: sleek shapes, large clean surfaces, screens, holographic displays and light strips integrated flush into the body, a few precise functional parts that show what the object does.
- NO FILLER DETAIL: do not fill surfaces with panel lines, seams, grooves, screws, bolts, rivets, vents, exposed pipes, cables or small random greebles just to add detail. Detail comes from materials and form. Never worn-out, dated or old industrial machinery (the deliberate American retro theme below is fine: it is a 2090 reinterpretation of that style).
- OUTLINES: one uniform outline of the same thickness around the object's silhouette and its few major parts only, continuous and unbroken. Outline colour is the darkest shade of the part's own colour, never pure black.
- CORNERS: small neat rounded corners, never chamfered or 45-degree cut corners.
- STRAIGHT LINES ONLY: every outer edge of the object is perfectly horizontal or perfectly vertical; no diagonal or slanted edges, no angled panels, no notches. The worktop is made of full rectangles with no cut-off corners, only small rounded corners.
- CLEAN: no smudges, no noise, no grain, no dirt, no stains. Clean, clear colours, no muddy or dirty tints.
- LIGHTS: NO glow, NO bloom, NO haze, NO light halo around anything. Neon tubes, screens and holograms are solid bright shapes with a hard crisp edge and at most one lighter inner line; the colour never bleeds outside the shape. Lights never light up anything else: no coloured light spill or reflection on the wood, leather, chrome or floor.
- SPRITES: NO ground, floor, plinth or ground shadow around the object (the floor comes from the game map); it ends at its base with a flat, perfectly horizontal bottom edge. Strictly orthographic: no perspective, no converging lines, no trapezoid shapes, vertical edges perfectly vertical. The object faces the viewer head-on: front face parallel to the image with its top visible above it; no side faces, no rotation, no isometric placement.

CAMERA (game requirement, MOST IMPORTANT): strict orthographic straight front view as in a classic top-down RPG, like an architectural front elevation with the top surface shown as a straight band above it. The counter is an L shape. Its LONG PART runs left to right across the lower part of the image: a flat rectangular front face parallel to the image, with its worktop shown as a straight horizontal band directly above the front face, exactly as wide as it. Its SHORT LEG starts at the LEFT end of the long part and runs AWAY from the viewer, toward the top of the image: it is drawn as an upright vertical strip of worktop seen from above, the same width as the long worktop band is deep; only its top surface is visible, no side faces. No vanishing point, no foreshortening, no trapezoid, no rotation, no tilt. Every edge is horizontal or vertical.

Canvas 1536 x 1024. FIXED SCALE: one floor tile of one metre = 128 pixels on this canvas, so the long part is about 640 pixels wide and the short leg rises about 384 pixels above the long worktop; centre the counter on the canvas. Crisp outline about 4 canvas pixels thick.

OBJECT: the L-shaped bar counter of the lounge bar on a space station in the year 2090, about elbow high. The long part faces the guests; the short leg on the left runs back into the room; the bartender works inside the L.
STYLE THEME: American retro bar mixed with cyberpunk neon, reimagined as 2090 high technology. Retro side: a classic American bar counter with a rounded, padded front made of tufted oxblood-red leather in a few big quilted cushions, a polished chrome edge band and a chrome foot rail along the bottom, a thick worktop of dark glossy wood with a rounded nosing. Cyberpunk side: crisp neon tubes integrated flush into the counter (one neon line under the worktop nosing and a neon line along the foot rail) in vivid cyan and hot pink, plus a slim flush holographic menu display set into the worktop of the short leg. Real volume: the worktop clearly overhangs the body with a dark shadow gap under the nosing, the padded front bulges out in soft rounded cushions, chrome catches small highlights. Richness comes from materials and forms (button-tufted leather with fine stitching, mirror chrome, glossy wood grain, neon), not from added panel lines.
The worktop is otherwise empty. Neon tubes are solid bright shapes with a hard crisp edge, no glow, no light on anything else.
Not worn-out or dirty: no exposed bolts or rivets, no panel-line grid, no vents, no exposed pipes or cables, no yellow-black stripes.

Background: solid flat neutral grey #808080 everywhere outside the object (NOT magenta). No floor, no shadows, no people, no labels, readable writing, logos or numbers.
```

## L 型吧檯 v4（2026-11-23，直線構圖＋像素圓角）：`raw/props_bar_l_counter_v4.png`

- 使用者：v3 太寫實；從「用直線橫線構圖、圓角用像素構成」下手。STYLE 改成介於精緻像素與平面遊戲插畫之間，連明暗、高光、木紋、縫線都限定水平垂直筆觸。
- 結果：寫實感沒了，但又退回簡單、低細節（木紋變成幾條橫線、軟包變小方塊）。把直線限制套到明暗與材質上，細節就被一起砍掉。

```
Generate ONE image with your image generation tool and save it as ./tools/art/bar/raw/props_bar_l_counter_v4.png. Use image generation, not code. No input images are attached on purpose. Do not edit or create any other files.
The image contains EXACTLY ONE object: one L-shaped bar counter. Nothing else (no stools, no bottles, no glasses, no people). After saving, look at the image and check: it is a stylised, graphic HD game sprite, NOT realistic, NOT glossy 3D; the whole design and all shading, highlights, wood grain and reflections are built from straight horizontal and vertical lines; every rounded corner is a crisp small pixel staircase, not a smooth curve; it is an L shape as described in CAMERA, no trapezoid, no side faces; it looks like American retro mixed with cyberpunk neon; no panel lines, screws or bolts added as filler; no glow anywhere, not even around the screen; the background is flat neutral grey #808080; there is no text. If it fails, generate again (at most 3 tries).

STYLE — STYLISED HD GAME SPRITE (most important): a crisp, stylised, high-resolution 2D game asset for a top-down RPG, halfway between refined pixel art and clean flat game illustration. NOT realistic, NOT photographic, NOT a glossy 3D render, no soft airbrushed gradients, no curved glossy reflections. Shading is done with a few flat colour steps per material (light, mid, shadow, one sharp highlight), separated by crisp edges.
- BUILT FROM STRAIGHT LINES (key to the look): compose the whole object out of perfectly horizontal and perfectly vertical lines and rectangles. Every edge, every shading step, every highlight, every reflection, the wood grain and the stitching are straight horizontal or vertical strokes. No diagonal lines, no slanted or curved highlights, no organic curves.
- PIXEL-BUILT CORNERS: every rounded corner is a small, crisp pixel staircase (steps of a few pixels stepping inward), sharp and aliased like pixel art, never a smooth antialiased arc and never a 45-degree chamfer. Even the round tufting buttons and the ends of the chrome rail are small pixel-stepped shapes.
- HIGH-TECH FEEL: the object clearly reads as 2090 technology through its form: sleek shapes, large clean surfaces, screens, holograms and light strips integrated flush into the body.
- NO FILLER DETAIL: no panel lines, seams, grooves, screws, bolts, rivets, vents, pipes, cables or random greebles added just to fill space. Never worn-out or dated machinery (the deliberate American retro theme below is fine: it is a 2090 reinterpretation of that style).
- OUTLINES: one uniform crisp outline of the same thickness around the silhouette and the few major parts only, continuous. Outline colour is the darkest shade of the part's own colour, never pure black.
- CLEAN: no smudges, noise, grain, dirt or stains. Clean, clear colours.
- LIGHTS: NO glow, NO bloom, NO haze, NO halo or soft rim around anything, including the screen. Neon tubes, screens and holograms are solid flat bright shapes with a hard edge and at most one lighter inner line; colour never bleeds outside the shape and never lights up anything else.
- SPRITES: NO ground, floor, plinth or ground shadow; the object ends with a flat, perfectly horizontal bottom edge. Strictly orthographic: no perspective, no converging lines, no trapezoid shapes, vertical edges perfectly vertical. Front face parallel to the image with its top visible above it; no side faces, no rotation, no isometric placement.

CAMERA (game requirement, MOST IMPORTANT): strict orthographic straight front view as in a classic top-down RPG, like an architectural front elevation with the top surface shown as a straight band above it. The counter is an L shape. Its LONG PART runs left to right across the lower part of the image: a flat rectangular front face parallel to the image, with its worktop shown as a straight horizontal band directly above the front face, exactly as wide as it. Its SHORT LEG starts at the LEFT end of the long part and runs AWAY from the viewer, toward the top of the image: it is drawn as an upright vertical strip of worktop seen from above, the same width as the long worktop band is deep; only its top surface is visible, no side faces. No vanishing point, no foreshortening, no trapezoid, no rotation, no tilt. Every edge is horizontal or vertical.

Canvas 1536 x 1024. FIXED SCALE: one floor tile of one metre = 128 pixels on this canvas, so the long part is about 640 pixels wide and the short leg rises about 384 pixels above the long worktop; centre the counter on the canvas. Crisp outline about 4 canvas pixels thick.

OBJECT: the L-shaped bar counter of the lounge bar on a space station in the year 2090, about elbow high. The long part faces the guests; the short leg on the left runs back into the room; the bartender works inside the L.
STYLE THEME: American retro bar mixed with cyberpunk neon, reimagined as 2090 high technology. Retro side: a classic American bar counter with a padded front made of button-tufted oxblood-red leather cushions, a polished chrome edge band and a chrome foot rail along the bottom, a thick worktop of dark polished wood. Cyberpunk side: crisp neon tubes integrated flush into the counter (one neon line under the worktop nosing and a neon line along the foot rail) in vivid cyan and hot pink, plus a slim flush holographic menu display set into the worktop of the short leg. Volume: the worktop clearly overhangs the body with a dark shadow band under the nosing; the padded front is a row of square button-tufted cushions. Show the materials in a graphic way, all with straight horizontal and vertical strokes: wood grain as a few long straight horizontal streaks, chrome as straight light and dark bands with one sharp highlight line, leather cushions as flat colour blocks with a darker straight inner rim, a small button and straight stitch lines.
The worktop is otherwise empty. Neon tubes are solid bright shapes with a hard crisp edge, no glow, no light on anything else.
Not worn-out or dirty: no exposed bolts or rivets, no panel-line grid, no vents, no exposed pipes or cables, no yellow-black stripes.

Background: solid flat neutral grey #808080 everywhere outside the object (NOT magenta). No floor, no shadows, no people, no labels, readable writing, logos or numbers.
```

## L 型吧檯 v5（2026-11-23，只給「賽博霓虹」、自由發揮；gpt-6.2-sol）：`raw/props_bar_l_counter_v5.png`

- 使用者：不指定材質，只給賽博霓虹。用 Codex 桌面版附的 CLI 0.171（`%LOCALAPPDATA%/OpenAI/Codex/bin/<hash>/codex.exe`）跑 `-m gpt-6.2-sol`；`codex update` 失敗、舊 CLI 0.163 不認得 6.2。
- 結果：最空的一版：深灰石板＋兩條霓虹線，霓虹線有斜折角（違反直線規則）。自由發揮時模型往極簡走。

```
Generate ONE image with your image generation tool and save it as ./tools/art/bar/raw/props_bar_l_counter_v5.png. Use image generation, not code. No input images are attached on purpose. Do not edit or create any other files.
The image contains EXACTLY ONE object: one L-shaped bar counter. Nothing else (no stools, no bottles, no glasses, no people). After saving, look at the image and check: it is a refined, detailed stylised game sprite, not realistic and not a glossy 3D render; it is an L shape as described in CAMERA; the outer edges are horizontal or vertical with small pixel-stepped corners, no trapezoid, no side faces; no panel lines, screws or bolts added as filler; no glow anywhere; the background is flat neutral grey #808080; there is no text. If it fails, generate again (at most 3 tries).

STYLE — REFINED STYLISED HD GAME SPRITE (most important): a crisp, detailed, high-resolution 2D game asset for a top-down RPG. Stylised, NOT realistic, NOT photographic, NOT a glossy 3D render: shading in three to four flat colour steps per material with crisp edges and a few sharp highlights; no soft airbrushed gradients, no curved glossy reflections. Rich, refined detail, but clean.
- SHAPE: the silhouette and the edges of the main parts are perfectly horizontal and vertical lines; every rounded corner is a small crisp pixel staircase, never a smooth arc, never a 45-degree chamfer. (Details inside the surfaces can be drawn freely.)
- HIGH-TECH FEEL: it must clearly read as technology of the year 2090 through its form, not through added lines.
- NO FILLER DETAIL: no panel lines, seams, screws, bolts, rivets, vents, pipes, cables or random greebles added just to fill space. Clean, never worn or dirty.
- OUTLINES: one uniform crisp outline around the silhouette and the main parts, never pure black.
- LIGHTS: NO glow, NO bloom, NO haze, NO halo or soft rim around anything. Neon, screens and holograms are solid bright shapes with a hard edge; colour never bleeds outside the shape and never lights up anything else.
- SPRITES: NO ground, floor, plinth or ground shadow; the object ends with a flat, perfectly horizontal bottom edge. Strictly orthographic, no perspective, no isometric placement.

CAMERA (game requirement, MOST IMPORTANT): strict orthographic straight front view as in a classic top-down RPG, like an architectural front elevation with the top surface shown as a straight band above it. The counter is an L shape. Its LONG PART runs left to right across the lower part of the image: a flat rectangular front face parallel to the image, with its worktop shown as a straight horizontal band directly above the front face, exactly as wide as it. Its SHORT LEG starts at the LEFT end of the long part and runs AWAY from the viewer, toward the top of the image: it is drawn as an upright vertical strip of worktop seen from above, the same width as the long worktop band is deep; only its top surface is visible, no side faces. No vanishing point, no foreshortening, no trapezoid, no rotation, no tilt. Every edge is horizontal or vertical.

Canvas 1536 x 1024. FIXED SCALE: one floor tile of one metre = 128 pixels on this canvas, so the long part is about 640 pixels wide and the short leg rises about 384 pixels above the long worktop; centre the counter on the canvas. Crisp outline about 4 canvas pixels thick.

OBJECT: the L-shaped bar counter of a lounge bar on a space station in the year 2090, about elbow high. The long part faces the guests; the short leg on the left runs back into the room. Theme: CYBERPUNK NEON. Everything else (materials, colours, details, what is integrated into the counter) is your free design choice; make it striking and refined.

Background: solid flat neutral grey #808080 everywhere outside the object. No floor, no shadows, no people, no labels, readable writing, logos or numbers.
```

## L 型吧檯 v6（2026-11-23，禁止項精簡；gpt-6.2-sol）：`raw/props_bar_l_counter_v6.png`

- 只留鏡頭、不准光暈、不帶地面三條，改成正面要求「細節豐富、層次多、做工精緻」，主題只給賽博霓虹。
- 結果：內容比 v5 多很多（檯面嵌入式控制面板、配料盒、前板大螢幕、上下霓虹條），沒要求也自己畫成像素風；細節多半是螢幕上的 UI 圖示，材質本身仍平；玻璃有斜反光、霓虹有波浪線（沒有直線規則的結果）。

```
Generate ONE image with your image generation tool and save it as ./tools/art/bar/raw/props_bar_l_counter_v6.png. Use image generation, not code. No input images are attached on purpose. Do not edit or create any other files. After saving, look at the image and check the CAMERA, LIGHTS and GROUND rules below; if one fails, generate again (at most 3 tries).

Draw ONE object only: an L-shaped bar counter for a cyberpunk neon lounge bar on a space station in the year 2090, as a game sprite for a top-down 2D RPG. Make it richly detailed, layered and finely crafted: a premium, high-quality stylised 2D game asset (not photorealistic, not a 3D render), with plenty of interesting design detail. Theme: CYBERPUNK NEON. Materials, colours and details are your free design choice.

CAMERA (game requirement, MOST IMPORTANT): strict orthographic straight front view as in a classic top-down RPG. The LONG PART of the L (about 5 m wide) runs left to right across the lower part of the image: its front face is parallel to the image, with its worktop shown as a horizontal band above it. The SHORT LEG (about 3 m long) starts at the LEFT end and runs away from the viewer toward the top of the image, seen from above as a vertical strip of worktop, the same width as the long worktop is deep. No perspective, no vanishing point, no trapezoid, no visible side faces, no rotation, no isometric view. Canvas 1536 x 1024, one metre = 128 pixels, counter centred.

LIGHTS: neon, screens and holograms are crisp bright shapes with hard edges; no glow, bloom or halo around them and no light cast onto anything.

GROUND: no floor, no ground shadow; the object ends at a flat horizontal bottom edge. Background: flat neutral grey #808080. No text, no people, no stools, no bottles.
```

## L 型吧檯 v7（2026-11-23，v6 原樣＋酒吧關鍵字；gpt-6.2-sol）：`raw/props_bar_l_counter_v7.png`

- 使用者：v6 的畫風是正常的（斜線用直線錯位的像素階梯畫可以）；只要依場景給物件風格關鍵字。v6 原樣，只加 Keywords: American retro bar, classic cocktail bar counter, beer taps, drink rail, foot rail。
- 結果：一看就是吧檯：鍍鉻四頭啤酒龍頭塔、紅＋青綠的美式餐館配色、前板粉色霓虹條與等化器螢幕、鍍鉻腳踏桿。

```
Generate ONE image with your image generation tool and save it as ./tools/art/bar/raw/props_bar_l_counter_v7.png. Use image generation, not code. No input images are attached on purpose. Do not edit or create any other files. After saving, look at the image and check the CAMERA, LIGHTS and GROUND rules below; if one fails, generate again (at most 3 tries).

Draw ONE object only: an L-shaped bar counter for a cyberpunk neon lounge bar on a space station in the year 2090, as a game sprite for a top-down 2D RPG. Make it richly detailed, layered and finely crafted: a premium, high-quality stylised 2D game asset (not photorealistic, not a 3D render), with plenty of interesting design detail. Theme: CYBERPUNK NEON. Keywords: American retro bar, classic cocktail bar counter, beer taps, drink rail, foot rail. It must clearly read as a bar counter where guests sit and drink. Materials, colours and details are your free design choice.

CAMERA (game requirement, MOST IMPORTANT): strict orthographic straight front view as in a classic top-down RPG. The LONG PART of the L (about 5 m wide) runs left to right across the lower part of the image: its front face is parallel to the image, with its worktop shown as a horizontal band above it. The SHORT LEG (about 3 m long) starts at the LEFT end and runs away from the viewer toward the top of the image, seen from above as a vertical strip of worktop, the same width as the long worktop is deep. No perspective, no vanishing point, no trapezoid, no visible side faces, no rotation, no isometric view. Canvas 1536 x 1024, one metre = 128 pixels, counter centred.

LIGHTS: neon, screens and holograms are crisp bright shapes with hard edges; no glow, bloom or halo around them and no light cast onto anything.

GROUND: no floor, no ground shadow; the object ends at a flat horizontal bottom edge. Background: flat neutral grey #808080. No text, no people, no stools, no bottles.
```
