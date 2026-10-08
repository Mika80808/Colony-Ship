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

- 2026-10-07 世界觀定案寫進 `docs/world.md`：2090 年、月球—火星航線的中繼港、貨幣星幣、補給船每 7 日一班、常駐 NPC 20 名。
  - 程式已跟上：遊戲起始日 `GAME_START_DATE` 改成 2090-10-24，作物生長的 EPOCH 改成 2090 年初（起始日仍是年初後第 296 天，開局作物狀態不變；季節只看月份，不受影響），測試日期一併改；GM 局勢、日記草稿、農業監控終端不再寫「星曆」。GM 系統提示寫入世界觀精簡版與 GM 邊界（站外地點只在敘事提及、大事件上限是設備故障／船期延誤／訪客到站、科技點到為止、不放紙本）。
  - 還沒接：第八節設定集條目（故事書沒有設定類條目與關鍵字觸發欄位）、地點的內建描述仍是舊設定，見 world.md 最後一節。

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
- 工程區：可遊玩，14 件機台已擺（RPG 斜俯視、乾淨的舊版風格，使用者手修過；電腦桌已刪；依工作流程分區：收件區、中央通道、維修區、製造區、研發角），說明見 `docs/scenes/engineering.md`。下方走廊沿用居住區走廊素材，左通 C、右通 D；厚重門要按 E（或點門）才開、走遠自己關，門沒開完會擋人。居住區走廊左右兩端都能直接走進有場景的設施（B 左端進溫室、C 右端與 D 左端進工程區）。定位是外環的維修與研發工坊，沒有引擎與重力裝置。
  - **設計語言改定（2026-10-04）：世界觀是 2090 年高科技星艦，物件要 sci-fi workshop concept**（霧面石墨＋白色複合外殼、圓角、隱藏螺絲、嵌入燈條；不要外露螺栓、粗保險桿腳、波紋軟管、舊螢幕）。規範寫進兩個 skill；風格參考圖 `場景/工程區/style_ref_*.png`。舊風格的生圖紀錄搬到 `場景/_舊風格封存/工程區_2026-10-04/`（使用者確認後可刪）。地圖上已擺的 14 件還是舊風格，流程定了再換。
  - 新風格備用物件（還沒擺進地圖）：
    - 精密工作站 9 件：參考圖 batch20b → 最終 batch21（工作台、掃描門、3D 列印機、抽屜櫃）、batch22（診斷推車、焊接站、協作手臂、工具箱推車、高腳椅），取代舊的 batch17 正面圖（同檔名）。
    - 大型機台 4 件：參考圖 batch27（不限尺寸）→ 最終 batch28（大型製造機 `mega-fabricator`、自動診修艙 `diag-repair`：斷層掃描＋內建手臂，診斷／測試／維修合一）、batch29（全息設計桌 `holo-desk`、材料回收機 `recycler`）。
    - 倉儲物流有新風格參考圖 batch23，使用者決定不做最終物件；休息與安全角不重做。
    - 目錄圖：`場景/工程區/catalog_workbench.png`、`catalog_machines.png`。
  - 舊風格備用物件（batch16、18、19，跳過擺設參考圖，多數是正面圖）：輸送帶橫、直各一（batch16）、倉儲物流（batch18：自動倉儲塔、搬運機器人、移動吊臂、工具箱台車、氣瓶架、回收分類桶、電池充電櫃、板材管材推車、備品棧板）、休息與安全角（batch19：咖啡吧台、移動白板、沙發、小邊桌、洗眼沖淋站、滅火器、小冰箱、登高梯、防護裝備架）。清單在 `tools/art/engineering_objects.py` 的 `SPARES`，圖在 `public/assets/engineering/props/`。

## 中央廣場（規劃中）

- 2026-10-05 v2 分區（使用者給全艦配置圖 `tools/art/plaza/station_layout_ref.png` 後改版）：RPG 構圖、圓形廣場＋十字通道（上研究室、右農業區、下醫療室、左工程區），圓外是星空底圖。中央塔是直筒，塔身畫到地圖頂、玩家在後面時半透明；電梯門朝南。北半圈兩間有 NPC 的大店面（西北酒吧、東北餐廳＋進貨口），東西兩側無人小店（物資店、服飾店），店面一律正面朝鏡頭；美食街座位環繞中央塔。電子投影已刪除。說明見 `docs/scenes/plaza.md`，規劃圖 `tools/art/plaza/plaza_plan_v2.png`（`tools/art/plaza_plan.py`）。
- 營業時間模組 `src/game/shopHours.ts`（餐廳 08–20、酒吧 20–02，含測試）。
- 下一步：使用者確認 v2 配置與待決定事項後做底圖。

## 醫療室（建置中）

- 2026-10-07 v2 規劃（依使用者意見改）：24 × 26 格（室內 0–19 列、南牆與自動滑門 20–21 列、下方走廊左通 B 右通 C）。後排醫療研究／居家休息區／藥物研究（研究區有長桌、資料投影在北牆，兩間都從休息區進）；中排診間（含診斷治療艙兼隔離艙）／三間薄牆單人病房；前排候診區／藥局（櫃台＋呼叫鈴）；中間 4 格寬主走道。沒人看診就關門（只在 09–12、14–17 開），門外有緊急警鈴與 24 小時自助藥櫃；隔間一律薄牆。NPC 兩位：醫師、藥劑師，沒人看診時在研究室，有人來才到診桌／櫃台；只規劃、還沒登錄。不放紙本，資料一律投影或螢幕。說明見 `docs/scenes/medical.md`，規劃圖 `tools/art/medical/medical_plan.png`（`tools/art/medical_plan.py`）。
- 2026-10-08 v4 格局與底圖（使用者改）：投影牆改一般淺色牆、拿掉地上燈條；只有病房之間是薄牆，其他內牆跟走廊牆一樣高（346 px，橫牆在圖上佔 4 列，牆面用走廊牆的素面牆板）；候診縮小、隔出手術室（診間直通）；治療艙與診療床換位；病房前走道兩格。地圖 25 × 43 格。牆一律「牆頂在線上、牆面往下垂」，每道牆一張 decor 依牆腳排前後。已在瀏覽器走過：牆後只露上半身、穿過病房門正常。
- 下一步：物件清單（`medical_objects.py`）→ 白色方塊預覽給使用者看 → 擺設參考圖。
- 延後的事：兩位 NPC 外型與名字（地圖建完再說）、看診費與藥價（跟其他物價一起定）、北牆接中央廣場（廣場建完再改）。

## 角色素材

詳見 `docs/characters.md`。

- 五位 NPC（路西恩、布雷茲、艾登、伊森、路卡）素材統一規格：角色卡、立繪、六表情（neutral／happy／sad／angry／surprised／shy）、688×688 行走圖，全部在 `public/assets/<小寫 id>/`。整理腳本 `tools/art/characters_build.py`（可重跑、結果一致），驗收總覽 `tools/art/characters/review_sheet.png`。
- 2026-10-05（T1，Codex 實作、Claude Code 驗收）：Aiden／Ethan／Luca 目錄改小寫、`normal`→`neutral`、`troubled`→`sad`、行走圖從 1254 原圖縮成 688；布雷茲六表情由 Codex 生成的表情表切出；艾登、伊森、路卡登錄成內建 NPC（中文名暫用音譯，人物設定待補，不指定房號、日程、部門）。故事書可編輯沒有日程的既有角色。
- `tools/pack_walk_sheet.py`：走路影格比站姿高、會超出腳底線時，整張改用剛好放得下的比例（盧卡需要）。
- 玩家：只有行走圖，造型由玩家自訂，不做頭像、立繪、表情。
- 2026-10-05（T3，Codex 實作、Claude Code 驗收）：10 位候選男角體型立繪（黑色無袖背心＋黑短褲、赤腳），供挑選角色外型；女性向，身高 176–194 cm，體型涵蓋精瘦、力量、纖細、壯碩、泳將、成熟、高挑、拳擊、書卷、格鬥。成品 `tools/art/candidates/C01~C10.webp`、身高比例並排圖 `tools/art/candidates/lineup.png`、提示詞 `prompts.md`，腳本 `tools/art/candidates_build.py`。不進遊戲。
- 下一步（T4，已開派工單 `docs/tasks/T4-npc-routine.md`，尚未完成）：NPC 一日作息模板——02–09 房間、09–12／14–17 上班、12–14 與 17–20 有 70% 在餐廳其餘去個人遊蕩清單、20–02 有 30% 去酒吧其餘回房；機率每人每天每時段固定。各 NPC 的部門、遊蕩清單、日程等全部 NPC 建好再排。

## 專案整理（2026-10-03）

- 依賴精簡：移除樣板殘留的 express、dotenv、esbuild、autoprefixer 等未使用套件，建置工具歸入 devDependencies。
- 刪除誤入 repo 的 desktop.ini；艦橋生圖提示詞 `prompts-v1~3.json` 移到 `tools/art/bridge/`。
- 刪除 `src/utils/sound.ts` 轉出口，音效一律從 `src/utils/audio.ts` 匯入。
- 素材轉無損 WebP（`tools/to_webp.py` 逐像素驗證）：bridge-v3 全部、greenhouse/props 全部、Luca 行走圖，共省約 5.4MB；`bridgeArt.ts`、`FacilityScene.tsx` 引用已改副檔名。
- 修正 `initialGameData.ts` 裡艦橋背景指向不存在的 `/assets/bridge/central-tower-bridge.png`，改指 bridge-v3 背景（實際顯示時 App.tsx 本來就會覆蓋，屬保險修正）。
- 第二批：剩餘 PNG（作物、種植架、水面遮罩、玩家行走圖）也轉無損 WebP；所有寫進 public/assets 的產生腳本輸出副檔名同步改 .webp（lossless），讀取端（rebuild_greenhouse_collision、greenhouse_tree_layer）一併更新。
- 重複程式碼整併：共用圖片載入 `src/utils/loadImage.ts`（四處合一）；鍵盤輸入共用 hook `src/components/useSceneKeys.ts`（房間、走廊、設施三場景接上，暫只支援 WASD＋E，方向鍵之後再補；艦橋因接線方式不同暫不動）；合併 pack_player／pack_lucian 為 `tools/pack_walk_atlas.py`；溫室圖層切割抽出 `tools/art/greenhouse_common.py`；刪除過時的 prepare_furniture.py。
