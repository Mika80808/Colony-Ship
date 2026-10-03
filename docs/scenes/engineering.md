# 工程區

外環的維修與研發工坊：修設備、做零件、管這一段的電力與管線。NPC 是工程員，材料與工具放在這裡，艦上壞掉或要改良的設備會送回來。**沒有引擎、沒有重力裝置**（環體靠旋轉產生重力，引擎不在外環）。

目前只有結構：牆、地板、厚重門、下方走廊。機台還沒擺。

- 地圖 16 × 30 格（每格 96 px）。室內第 0–18 列，其中 0–2 列是北牆立面；第 19 列以下是走廊。
- 下方走廊沿用居住區 A 走廊的素材（柱子、素面牆板、地板、欄杆、星空），左通居住區 C、右通 D。沿 C 走廊右端、D 走廊左端走出去都會直接進來（走廊兩端只要那一側的設施有場景，就能直接走進去）。
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
