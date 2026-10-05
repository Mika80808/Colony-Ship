# 開發進度

每次收工更新這份。格式：已完成、進行中、下一步、已定案。

## 溫室

已完成
- 地面圖 `public/assets/greenhouse/ground.webp`、地圖與碰撞 `map.json`（40 × 28 格，每格 96 px）。
- 自動植栽區：
  - 兩種空架 `rack_shelf.png`（三層層架）、`rack_trellis.png`（挑高藤架），細節手修過；層高、支柱位置記在 `racks.json`。產生腳本 `tools/art/greenhouse_racks.py`。
  - 依排位表擺 12 排（左右翼各 6 排），位置在 `map.json`。
  - 19 種作物三階段圖在 `public/assets/greenhouse/crops/`（`<作物>_1~3.png`，設定檔 `crops.json`），切圖腳本 `tools/art/greenhouse_crops.py`。
  - 生長系統 `src/game/growth.ts`：依遊戲時間算階段，各排相位錯開，週期結束自動採收補種，不需存檔。
- 自然區：草地蓋過地磚邊緣（`lawn_painter.py`）、20 種花叢、灌木、蘋果樹／松樹／柳樹，楓樹隨季節換四種顏色。
- 北側：半穹頂觀景窗＋外星植物、控制台桌、兩台植栽監測機（Photoshop 圖層原位匯入）。
- 觀景窗碰撞以 8 px 細條沿窗框弧形底緣（外推 2 px）加腳圈半徑，角色影子不壓到窗框；窗框與窗內植物一律畫在角色下方。
- 窗前工作站的碰撞改成貼合桌子下三分之二的矩形（左右各內縮 6 px），可以站到桌子正前方與兩側；點擊後的農業監控終端高度減半（42vh），表格可捲動、表頭固定。
- 觀景窗與沙發不顯示文字提示；互動的 `text` 為空字串時不冒泡泡。
- 溫室弧形沙發的三個座位以圖片寬高比例標示臀部定位點（左／右 21%／79% 寬、56% 高；中間 50% 寬、50% 高），中間座位較靠後；坐姿腿部縮短 40%（保留原長 60%），腳畫在沙發前緣上方。往後新增座位可用相同的物件比例座標，不必逐一寫死地圖格位置。
- 場景：種植架、樹、擺設與玩家依底部排前後；重疊的點擊範圍取最小。
- 水底魚影 `src/game/fish.ts`：灰色剪影在水面遮罩（`water.png`，由 `facility_ground.py` 產生）裡游動。
- Photoshop 擺設：重畫的樹、休憩沙發與火爐桌、石頭、石燈、菜圃用具、走廊照明燈；兩棵楓樹拆開，可各自換季。
- 窗前工作站（農業監控終端）：按 E 開報表，列出各排作物的生長階段、幾天後可採收或自動收成（`src/game/growthReport.ts`、`GrowthModal.tsx`）。

## 全遊戲系統

- 遊戲時間 `src/game/clock.ts`：步數制，走路每 16 格 1 分鐘；星圖傳送依距離分級 0／3／8／15／20 分鐘；主 GM 可用 `advance_time` 推進時間。
- 物資帳 `src/game/supplies.ts`：溫室依生長週期自動收成進出貨籃，玩家裝推車送到中央公園餐廳，餐廳每天消耗；充足／偏低／匱乏交給主 GM 參考，物資帳寫進存檔。數字都是暫定，待實測。

進行中
- 植栽監測機（左右翼各一台，`MonitorModal.tsx`、`src/game/monitor.ts`）：列出本翼每段作物的圖、生長階段、收成倒數與健康。健康（缺水、葉片發黃、蚜蟲）目前是每天隨機模擬，還沒有照顧的玩法。

下一步（待定）
- 生長週期天數（`CYCLE_DAYS`）、物資帳的產量與消耗量實際玩過後再調。

已定案
- 作物畫風：Classic cute pixel RPG crop art，24 × 24 px 可讀（藤架作物 24 × 72 px）；先生萵苣定畫風，其餘都以萵苣當參考圖。
- 作物生圖用本機 GPT CLI，可直接出透明背景；藤架作物照 `tools/art/crops/stake_template.png` 的青色支柱生成，再扣掉支柱。
- 作物原圖只留本機 `tools/art/crops/raw/`，不進 repo。
- 青江菜從正式清單移除，改成馬鈴薯；哈密瓜改成鳳梨；新增葡萄、百香果。
- 豌豆、小番茄、矮種檸檬、葡萄、百香果放挑高藤架，其餘放三層層架。
- 右翼兩種作物共用一排、各佔半排：草莓＋藍莓、葡萄＋百香果。
- 作物生長查詢只放在窗前工作站。GM 在溫室時會拿到報表內容，但規定角色要先走到工作站查看才說得出天數；NPC 想知道就讓他去查。
- 菜田小物與庭園燈不擺進溫室（素材與切圖腳本 `tools/art/greenhouse_garden_cut.py` 保留）。

## 工具

- 新增 `generate2dmap` skill（`.claude/skills/generate2dmap/`，來源 0x0funky/agent-sprite-forge 2026-07-13 版），之後做新場景地圖時使用。

## 其他場景

- A-1 房間：可遊玩，說明見 `docs/scenes/room-a1.md`。
- 居住區 A 走廊：可遊玩，說明見 `docs/scenes/corridor-a.md`。走廊 B–D 只有擺放設定，素材沿用 A 走廊。
- A 走廊右端步行接溫室；溫室招牌不再觸發傳送，從 A 走廊進溫室時角色面向右方。
- 艦橋：可遊玩，說明見 `docs/scenes/bridge.md`。
- 工程區：可遊玩，14 件機台已擺（RPG 斜俯視、乾淨的 2070 年風格，使用者手修過；電腦桌已刪；依工作流程分區：收件區、中央通道、維修區、製造區、研發角），說明見 `docs/scenes/engineering.md`。下方走廊沿用居住區走廊素材，左通 C、右通 D；厚重門要按 E（或點門）才開、走遠自己關，門沒開完會擋人。居住區走廊左右兩端都能直接走進有場景的設施（B 左端進溫室、C 右端與 D 左端進工程區）。定位是外環的維修與研發工坊，沒有引擎與重力裝置。
- 中央廣場（星圖 `park`）：規劃階段。配置圖與檢查腳本 `tools/art/plaza_plan.py`（32 × 28 格：北牆一排店面、中央塔＋環形步道、西側投影區、東側用餐座位、南側植栽帶、四個門洞）、營業時間模組 `src/game/shopHours.ts`，說明見 `docs/scenes/plaza.md`。下一步：底圖、擺設參考圖四批（Codex）。
  - 備用物件（2026-10-04，還沒擺進地圖，等使用者決定工廠流程；**batch17–19 跳過擺設參考圖直接生，多數高物件是正面圖，不合 RPG 規範，待照流程重畫**）：輸送帶橫、直各一（batch16），加上三批各 9 件：精密工作站（batch17：防靜電工作台、診斷推車、焊接排煙站、模組工具箱推車、品檢掃描門、協作手臂、3D 列印機、高腳椅、零件抽屜櫃）、倉儲物流（batch18：自動倉儲塔、搬運機器人、移動吊臂、工具箱台車、氣瓶架、回收分類桶、電池充電櫃、板材管材推車、備品棧板）、休息與安全角（batch19：咖啡吧台、移動白板、沙發、小邊桌、洗眼沖淋站、滅火器、小冰箱、登高梯、防護裝備架）。清單在 `tools/art/engineering_objects.py` 的 `SPARES`，圖在 `public/assets/engineering/props/`；造型參考 ToughBuilt StackTech（石墨灰框、黃色扣件、青藍燈條）。

## 角色素材

詳見 `docs/characters.md`。

- 路西恩、艾登、伊森、路卡：行走圖、頭像、各種表情齊全，都已接進遊戲（內建 NPC）。
- 艾登、伊森、路卡（2026-10-05 接入）：行走圖原圖正規化成 688×688；表情檔名統一成 neutral／sad（原 normal／troubled）。職位、房號、日程依造型暫定：艾登＝工程部技師 A-3、伊森＝艦橋行政官 A-4、路卡＝研究室研究員 A-5，人物設定待補。目前沒有舊存檔，新角色不另寫存檔遷移。
- 布雷茲：只有行走圖與頭像，六張表情圖已指派 Codex（`docs/tasks/codex-角色素材.md`，狀態待執行）。交件後由 Claude Code 驗收、轉檔、接線。
- 玩家：行走圖。外觀由玩家自填，不做頭像與立繪。
- 盤點與驗收腳本 `tools/check_character_assets.py`；表情原圖轉檔 `tools/prepare_expressions.py`。

## 專案整理（2026-10-03）

- 依賴精簡：移除樣板殘留的 express、dotenv、esbuild、autoprefixer 等未使用套件，建置工具歸入 devDependencies。
- 刪除誤入 repo 的 desktop.ini；艦橋生圖提示詞 `prompts-v1~3.json` 移到 `tools/art/bridge/`。
- 刪除 `src/utils/sound.ts` 轉出口，音效一律從 `src/utils/audio.ts` 匯入。
- 素材轉無損 WebP（`tools/to_webp.py` 逐像素驗證）：bridge-v3 全部、greenhouse/props 全部、Luca 行走圖，共省約 5.4MB；`bridgeArt.ts`、`FacilityScene.tsx` 引用已改副檔名。
- 修正 `initialGameData.ts` 裡艦橋背景指向不存在的 `/assets/bridge/central-tower-bridge.png`，改指 bridge-v3 背景（實際顯示時 App.tsx 本來就會覆蓋，屬保險修正）。
- 第二批：剩餘 PNG（作物、種植架、水面遮罩、玩家行走圖）也轉無損 WebP；所有寫進 public/assets 的產生腳本輸出副檔名同步改 .webp（lossless），讀取端（rebuild_greenhouse_collision、greenhouse_tree_layer）一併更新。
- 重複程式碼整併：共用圖片載入 `src/utils/loadImage.ts`（四處合一）；鍵盤輸入共用 hook `src/components/useSceneKeys.ts`（房間、走廊、設施三場景接上，暫只支援 WASD＋E，方向鍵之後再補；艦橋因接線方式不同暫不動）；合併 pack_player／pack_lucian 為 `tools/pack_walk_atlas.py`；溫室圖層切割抽出 `tools/art/greenhouse_common.py`；刪除過時的 prepare_furniture.py。
