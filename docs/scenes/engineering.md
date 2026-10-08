# 工程區

外環的維修與研發工坊：修設備、做零件、管這一段的電力與管線。NPC 是工程員，材料與工具放在這裡，艦上壞掉或要改良的設備會送回來。**沒有引擎、沒有重力裝置**（環體靠旋轉產生重力，引擎不在外環）。

機台依工作流程分區（v5，2026-10-04）：大門內側右邊收件區（待修品架、剛送來的待修品、貨箱）、左邊休息角；中央 4 格寬通道從大門直通維修區（維修中機台在通道盡頭，四周警示條紋，兩旁工作台與工具推車）；右上製造區（大型製造機、操作台，東牆材料架供料、零件架靠近維修區）；左上研發角（研發桌、組裝手臂、設計終端，離門最遠）；西牆公用設備（閥門組接北牆管線、配電盤、工具牆）。

- 機台照 `.claude/skills/starport-scene-props/` 的流程做（2026-10-04 v6）：先在底圖上生兩張擺設參考圖（`tools/art/engineering/raw/batch4_dressed_top.png`、`batch5_dressed_bottom.png`），再依參考圖分 6 批生最終物件（`batch6`–`batch11`），prompt 在 `場景/工程區/`。第一版（batch2、batch3）是正面圖，已淘汰。
- 2026-10-04 使用者手修原圖：去掉鏽斑油污，改成乾淨的星艦科技風（之後定為 2090 年 sci-fi workshop concept，見 PROGRESS）；刪掉四張電腦桌（研發桌、設計終端、製造機操作台、檢修工作台），配桌的椅凳也先不擺（圖保留在 props/chair、stool）。原圖改成透明背景。
- 機台清單 `tools/art/engineering_objects.py`：位置與大小是量自參考圖的遊戲 px（底部中心、圖寬、碰撞深度），加上在哪張生圖第幾件。椅子、凳子在 `SEATS`，不擋路。
- **要修改時**：
  - 改圖：修 `tools/art/engineering/raw/<批次>.png`，再跑 `uv run --with pillow --with numpy --with scipy python tools/art/engineering_props.py <批次>`（或 `all`）。直接改 `public/assets/engineering/props/<名稱>.webp` 也可以，但重切會被蓋掉。
  - 改位置、大小、碰撞、互動文字：改 `engineering_objects.py`。
  - 改完都要重跑 `engineering_build.py`，再跑 `engineering_door.py cut tools/art/engineering/raw/batch1_door.png`。
- 切圖：自動找出每件（相距 40 px 內的併成一件，散落零件併給 80 px 內的大塊），依閱讀順序對到清單，縮到參考圖量出的寬度；比例差太多的（機械手臂）改照高度（`HEIGHT_FIT`）。
- 碰撞是每件從底邊往上 depth 格的精細矩形（collisionRects）；互動站位由 `engineering_build.py` 自動挑：從入口走得到、在互動範圍內（離圖 ≤ 48 px）、最靠近正前方、不站在椅子上。
- GM 會拿到工程區的物件清單與玩家附近的物件（facilityContext.ts）。

- 地圖 16 × 30 格（每格 96 px）。室內第 0–18 列，其中 0–2 列是北牆立面；第 19 列以下是走廊。
- 下方走廊沿用居住區 A 走廊的素材（柱子、素面牆板、地板、欄杆、星空）；居住區素材的門燈光（地板光圈、牆板暖光）畫死在 PSD 的 BG_Wall／BG_Floor 裡，工程區這段沒有住宅門燈，產生腳本用 `delight()` 把光洗掉，只留大門正下方的光圈。左通居住區 C、右通 D。沿 C 走廊右端、D 走廊左端走出去都會直接進來（走廊兩端只要那一側的設施有場景，就能直接走進去）。
- 厚重隔音門在走廊中間，門洞 4 格寬（第 6–9 欄），大型物件推得進去。走到門前按 E（或點門）才會開，1.4 秒開完；開著時再按 E 關上，角色離門洞超過 150 px 也會自己關。門關著時尋路不穿過門洞（點門後面會顯示無法通行）；門開不到九成時角色停在門前等。門扇只畫在門洞框裡往兩側滑開，角色走在門洞裡時門框蓋在角色上面。門在動的時候門楣的警示燈閃。
- 走廊欄杆（foreground.webp）與走廊牆頂（wall_cap.webp：牆簷＋門楣，牆頂往下 66 px）蓋在角色上面。室內角色可以走到牆後，腳點最深到牆頂下 58 px（同 A-1 房間南牆），下半身被牆擋住、只露出胸口以上（collisionRects 決定深度；門關著時 closedFrom 讓門前也能站一樣深）。
- 室內的牆與地板是程式畫的（左上 45 度光源；油污深灰、外露螺栓、警示黃）：防滑鋼板、管線溝蓋板、警示條紋、油污。使用者決定牆與地板維持這樣。
- 大門是生圖素材（2026-10-04，Codex batch1）：白模 `場景/工程區/door_whitebox.png` 當 image1 定形狀、居住區走廊的門當 image2 定畫風；風格參考使用者給的 sci-fi 貨運門（上灰下黑的厚框、橘燈條、黑色箭頭），只用文字描述、沒有把參考圖交給模型。原圖 `tools/art/engineering/raw/batch1_door.png`，用 `engineering_door.py cut` 切成門框與兩片門扇；門洞四周的邊框與門檻留在門框上（KEEP），只有門扇滑開。

檔案
- 產生腳本：`tools/art/engineering_build.py`（地面、前景、map.json；也會畫一份程式版的門，重跑後要再跑一次 `engineering_door.py cut` 換回生圖的門）。
- 大門：`tools/art/engineering_door.py`（`whitebox` 產生白模、`cut` 切原圖），幾何從 engineering_build.py 讀。
- 規劃圖腳本：`tools/art/engineering_plan.py`（機台配置 v3，北牆立面還是一列；擺機台時往下移一列對齊）。
- 素材：`public/assets/engineering/`。門的資料格式與判斷：`src/game/facility.ts` 的 `DoorSpec`、`doorBlocks`、`stepDoor`。

檢查：npm run lint；node --import tsx src/game/facility.test.ts；npm run build。
