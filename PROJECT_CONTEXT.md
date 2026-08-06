# 信用卡記帳 PWA — 專案交接文件

> 本文件為 v3.6 更新版。原始版本涵蓋到 v3.1；v3.2～v3.6 的內容由後續對話整理彙入。

## 基本資訊

| 項目 | 值 |
|------|-----|
| 專案名稱 | 信用卡記帳 PWA (credit-pwa-new) |
| GitHub Pages URL | https://xin-yu-1122.github.io/credit-pwa-new/ |
| GitHub Repo | xin-yu-1122/credit-pwa-new |
| 試算表 ID | 1yKdyDexfFZbH11bEr3S52EUnncNb3TWX7_ImSoscdxc |
| 試算表連結 | https://docs.google.com/spreadsheets/d/1yKdyDexfFZbH11bEr3S52EUnncNb3TWX7_ImSoscdxc |
| Google OAuth Client ID | 144262693536-poq7p69eo0aqr3r0onjafrd2f1rfrmg3.apps.googleusercontent.com |
| OAuth Client 類型 | 網頁應用程式(Web application) |
| OAuth Redirect URI | https://xin-yu-1122.github.io/credit-pwa-new/oauth-callback.html |
| Cloudflare Worker | https://credit-pwa-auth.tp6vupu04.workers.dev |
| **目前版本** | **v3.6** |
| 主要使用裝置 | Android 手機（同時也在電腦瀏覽器使用，兩者需保持資料同步） |

---

## ⚠️ 待處理事項（交接時優先看這裡）

### 1. 【進行中】手機版 PWA 更新卡住問題
**症狀**：上傳新版 `app.js` 且已同步更改 `sw.js` 版本號，網頁版正常更新，但**手機版持續沒有套用新版本**，此問題已發生一陣子（非單次）。

**已排查方向**（尚未確認根因，需要 `sw.js` 完整內容與 `index.html` 引用方式才能定案）：
- `skipWaiting()` + `clients.claim()` 是否有正確設置 → 若無，新 SW 會卡在 waiting，需所有分頁「真正關閉」才接管，PWA 從桌面圖示開啟常被系統視為背景而非關閉，可能永遠卡住
- `index.html` 引用 `app.js` 是否有版本參數（如 `app.js?v=3.6`）→ 沒有的話 GitHub Pages CDN 快取可能導致新 SW 接管後仍抓到舊 app.js
- fetch handler 是否對 app.js 用 cache-first 策略 → 若是，即使 SW 更新成功仍會送出舊檔案

**下一步**：需取得 `sw.js` 完整內容 + `index.html` 中 `<script src="app.js...">` 那行，以及在手機 Chrome `chrome://inspect/#service-workers` 或桌機 DevTools → Application → Service Workers 確認是否有 SW 卡在 "waiting to activate"。

### 2. 【已定位，未修復】「最近十筆」異常日期排序問題
**症狀**：試算表中若誤填了離分頁月份很遠的日期（例：`26_07` 分頁裡填了 `12/25`），該筆會被年份推算邏輯誤判為「今年 12 月」（`2026-12-25`），因日期最新而衝到清單第一名，即使它其實是打錯的資料。

**根因**：`normalizeDateCell()` 的跨年推算規則（`diff > 6 → 減一年`）在「日期本該落在分頁月份附近」的前提下才成立；面對真正離譜的誤填資料無法分辨。

**建議修法（尚未實作）**：對「與分頁月份相差超過 ~2 個月」的日期加註 ⚠️ 標記，並且不讓它在排序中壓過正常日期。列為 **v3.6.1**（小更動）候選。

**使用者應先做的事**：長按該筆記錄可開啟編輯視窗確認／修正試算表裡的原始日期。

---

## 檔案結構

```
credit-pwa-new/
├── index.html          # 主頁面（含所有 CSS）
├── app.js               # 主程式邏輯（~2900+ 行，含 v3.2~v3.6 新增內容）
├── sw.js                # Service Worker（快取策略；更新機制待排查，見上）
├── oauth-callback.html  # OAuth popup 接收頁
├── manifest.json        # PWA manifest
├── icon-192.png
└── icon-512.png
```

---

## 架構概覽

```
使用者手機 App (GitHub Pages PWA)
    │
    ├─ OAuth 登入 ──► oauth-callback.html (popup)
    │                    │ postMessage 回授權碼
    │                    ▼
    │               Cloudflare Worker /exchange
    │                    │ 用 client secret 換 token
    │                    ▼
    │               Google OAuth → access_token + refresh_token
    │
    ├─ Sheets API ──► Google Sheets (試算表；唯一跨裝置真實來源)
    │                    讀取月份資料、寫入記帳、已結帳/已繳費狀態
    │
    └─ localStorage ─► 快取（token、categories、months、月份資料 SWR、
                         已結帳狀態快取、最近十筆摺疊狀態）
```

**核心原則（歷次對話反覆確認）**：**永遠以試算表為單一真實來源**。任何需要跨裝置（電腦／手機）同步的狀態，一律寫回試算表，不能只存 localStorage（v3.2→v3.3 的已結帳功能，就是因為一開始存 localStorage 導致跨裝置不同步，後來改寫進試算表背景色才解決）。localStorage 僅用於「加速讀取的快取」或「單機 UI 偏好（如清單摺疊狀態）」。

---

## UI 結構

### 頁面流程
```
splash → (GAPI 載入完) → boot()
    ├─ 有 access token 且未過期 → enterApp()
    ├─ 有 refresh token → refreshAccessToken() → enterApp()
    └─ 都沒有 → showLogin()

enterApp()
    ├─ 有 SHEET_ID → showApp() → initApp()
    └─ 無 SHEET_ID → showSetup()
```

### App 畫面（三個 Tab）
```
[🏠 儀表板] [✏️ 記帳] [📊 消費分析]
     │           │            │
  lazy load   立刻顯示      lazy load
  （需月份資料）（不需等API）（需月份資料）
```

### 記帳 Tab（預設首頁）
- 欄位順序：月份分頁 / 銀行 / 卡別 / 日期 / 金額 / 備註 / 分類★(必填) / 底色 / 分期
- 儲存按鈕：大顆、100% 寬度
- 清除按鈕：次要，在儲存下方
- 送出前：fetchStructureOf(targetMonth) 讀真實結構確認欄位，防止寫錯位置
- **【v3.2 新增】已結帳自動換月**：選擇已標記「已結帳」的銀行時，月份下拉自動切到下個月，並顯示可關閉的橘色提示列；使用者手動改月份後不再被自動覆蓋（`MONTH_MANUALLY_SET` 旗標）
- **【v3.5 新增】最近十筆清單**：記帳 Tab 下方可摺疊清單，長按（550ms）任一筆開啟既有編輯視窗；資料涵蓋「目前月份 + 下個月」（因結帳後新帳務會寫進下個月分頁）

### 儀表板 Tab
- 每個非現金銀行卡片新增「已結帳」勾選框（橘色），位於「已繳費」上方
- 底色選項（新增記帳時的「底色」欄）已移除灰色（v3.2.1）

---

## 試算表結構（重要！）

### 月份分頁命名
格式：`YY_MM`（例：`26_05`）

### 每欄角色
```
第 1 行 = 銀行名稱（例：富邦(20結帳/05期限)）
第 2 行 = 卡片名稱（例：Open Possible聯名卡(2606)）
第 3 行 = 卡片回饋備註
第 4~54 行 = 記帳資料（51筆/卡）
    每張卡 4 欄：[日期][金額][備註][分類]
    ⚠️ 日期欄實際型別是 Google Sheets 的「日期格」，讀取時 effectiveValue
       回傳的是日期序號（如 46226 = 2026-07-23），不是純文字 "M/D"。
       解析務必用 sheetSerialToISO() / normalizeDateCell()，不可直接假設文字格式。
第 55 行 = 各卡小計（公式須算到 row54）
    【v3.3 新增用途】銀行起始欄的背景色也用來標記「已結帳」狀態（#FFF2CC）
第 56 行 = 各銀行消費總計（銀行起始欄背景色 #b7b7b7 = 已繳費）
第 57 行 = 各銀行已匯入金額
第 58 行 = 各銀行待繳款餘額（公式：帳戶餘額 - 消費總計）
    ≥ 0 → 待繳 = row58，帳戶餘額 = 0
    < 0 → 待繳 = 0，帳戶餘額 = |row58|
```

### 現金區塊（A欄，特殊處理）
```
A56 = 現金消費總計
A57 = 目前現金（帳戶餘額）
```

### 銀行起始欄（v3.1 動態偵測，以下為參考）
```
現金: A | 富邦: E | 玉山: M | 聯邦: AC
國泰: AS | 台新: AW | 永豐: BA | 彰銀: BE | 中信: BI
```

### 已繳費判斷
row56 總計格背景色 `#b7b7b7` → 已繳費（勾選框）

### 已結帳判斷【v3.3 新增】
row55 銀行起始欄背景色 `#FFF2CC`（淺黃）→ 已結帳（勾選框）
- 讀取：載入月份時與其他背景色一併批次讀取，無額外 API 成本
- 寫入：`toggleBilled()` 透過 `spreadsheets.batchUpdate` 的 `repeatCell` 改該格背景色

### 分期判斷
備註含 `[分期]` 或 金額格背景色 `#ff9900`

### 帳務類型分頁
```
A欄 = 分類名稱
B欄 = 必須（有值代表必須花費）
C欄 = 非必須（有值代表非必須）
```
特殊分類：`抵扣回饋`（B/C欄空白，程式寫死歸第3區塊，記帳時填負數）

---

## v3.1 核心引擎：動態結構偵測

### 原則
程式**不再寫死欄位字母**。每次載入月份時：
1. 讀第 1 行 → 找銀行名（用 BANK_NAME_KEYS 比對）→ 得銀行起始欄
2. 讀第 2 行 → 在各銀行範圍內找卡名 → 得各卡起始欄
3. 卡片資料 = 卡名欄起 4 欄（row4~54）
4. 銀行總計 = 銀行起欄 row56
5. 已匯入 = 銀行起欄 row57
6. 待繳/帳戶餘額 = 銀行起欄 row58

### 效果
你直接在 Google 試算表插入/新增卡片欄位，小工具下次開啟自動偵測，記帳下拉自動更新。完全不需要「卡片管理頁」。

### 關鍵函式（v3.1 基礎）
```js
detectStructure(rowsFull)       // 從完整 rowsFull 動態偵測結構
parseMonthDataDynamic(...)      // 用動態結構解析月份資料
fetchStructureOf(monthKey)      // 只讀標題列結構（記帳寫入前呼叫）
syncDynamicToGlobals(struct)    // 同步到全域 BANKS/BANKS_CARDS
getBanks()                      // DYNAMIC_BANKS || 寫死預設
getCards()                      // DYNAMIC_CARDS || 寫死預設
REBATE_CATEGORY = '抵扣回饋'   // 特殊分類常數
```

### 月份支援範圍
程式只支援 `25_12` 之後的月份（寫死在月份下拉過濾），更舊的月份不顯示也不載入。

---

## 快取系統（localStorage）

```js
cacheGet(key)              // 讀取，TTL 到期自動回傳 null
cacheSet(key, data, ttlMs) // 寫入，Infinity = 永久
cacheRemove(key)           // 刪除（資料變更後清除）
```

| 快取 key | 內容 | TTL |
|---------|------|-----|
| `cache-categories` | 消費分類清單 | 永久 |
| `cache-months` | 可用月份清單 | 24h |
| `cache-month-{YY_MM}` | 月份解析資料 | 7天（SWR） |
| `billed-state-cache`【v3.4 新增】 | 已結帳狀態（BILLED_STATE 的本機快取，試算表仍是真實來源） | 無明確 TTL，App 啟動時載入 |
| `recent-list-collapsed`【v3.5 新增】 | 最近十筆清單的摺疊狀態（單機 UI 偏好，不需同步） | 永久 |

SWR 流程：有快取 → 先顯示快取 → 背景靜默刷新 → 更新畫面

---

## 儀表板 KPI

```
消費總計 | 抵扣回饋 | 實際應付 | 已匯入現金 | 待匯入繳款 | 本月分期
```

### 預計餘額計算
```
= (現金目前餘額 + 各銀行帳戶餘額) - 各銀行待繳總和
```

---

## 消費分析

### 三區塊
1. **必須花費明細**（帳務類型 B欄有值）
2. **非必須花費明細**（帳務類型 C欄有值，或未知分類）
3. **抵扣回饋**（分類==`抵扣回饋`，獨立統計，不進圓餅圖）

### 圓餅圖
雙層甜甜圈：外圈各分類、內圈必須/非必須
只算必須+非必須，不含抵扣回饋

### 歷史趨勢
Lazy 載入，用 `TREND_CACHE` 避免重複 fetch，最多往回 6 個月

---

## 已結帳自動換月機制【v3.2～v3.4，多次迭代】

**使用情境**：信用卡結帳日後產生的帳務應計入下個月，但結帳日與銀行實際請款日存在時間差，使用者需先看銀行帳單確認最後一筆結帳到哪筆，才能判斷邊界 → **因此無法全自動判斷，需手動標記**。

### 運作方式
1. 使用者在儀表板勾選該銀行「已結帳」→ 寫入該月分頁 row55 銀行起始欄背景色
2. 記帳 Tab 選到已標記的銀行時，自動將月份切到下個月，並顯示提示列（可一鍵「改回」）
3. 若下個月分頁不存在，提示文字會明確告知「請先在試算表新增 XX 分頁」

### 重要教訓（v3.4 修正的 bug，交接時務必留意類似陷阱）
**判斷基準必須是「今天所屬月份」（`todayYYMM()`），不能用 `CURRENT_MONTH`。**
`CURRENT_MONTH` 會在存檔後被改成寫入的月份（例如記到八月後 `CURRENT_MONTH` 變 `26_08`），若自動換月邏輯以此為基準，會導致：
- 讀到錯誤月份的已結帳狀態
- 目標月份算錯（連續往後推）

修正後改用獨立的 `BILLED_STATE`（以月份為 key 的 store）+ `ensureBilledState()`（狀態未載入時只讀 row1/row2/row55，成本低），並以 `todayYYMM()` 為判斷基準，`CURRENT_MONTH` 的變動不再影響此邏輯。

### 相關函式
```js
BILLED_STATE                    // { 'YY_MM': ['fb','es',...] } 已結帳銀行清單
ensureBilledState(monthKey)     // 確保某月狀態已載入（未載入才打 API）
isBankBilledIn(monthKey, bankKey)
isBankBilled(bankKey)           // = isBankBilledIn(todayYYMM(), bankKey)
toggleBilled(bankKey, checked)  // 寫入 row55 背景色
MONTH_MANUALLY_SET              // 使用者手動改月份後 → true，自動換月不再覆蓋
applyBilledAutoMonth(bankKey)   // 記帳 Tab 選銀行時觸發的自動換月邏輯
```

---

## 最近十筆清單【v3.5～v3.6】

**位置**：記帳 Tab 下方，可摺疊（狀態存 localStorage，不需跨裝置同步）

**互動**：長按（550ms，touch/mouse 皆支援）開啟既有編輯視窗（含刪除）；點擊/放開/移動會取消長按計時；已擋掉 `contextmenu` 避免長按觸發選字選單

**涵蓋範圍**：目前檢視月份 + 下個月（因已結帳自動換月會讓新帳務寫進下個月分頁，只讀目前月份會看不到最新記錄）；跨月的列會標橘色月份標籤

**排序**：依 `dateISO`（YYYY-MM-DD）新到舊；同日以 `rowIdx` 大者優先（記帳往下附加，越晚寫入 rowIdx 越大）

### 重要教訓：日期欄型別（v3.6 修正的 bug）
試算表日期欄是**真正的日期格**，非文字。`effectiveValue` 回傳的是日期序號（如 `46226` = `2026-07-23`），必須用以下工具解析，**不可假設是 `"M/D"` 文字格式**：

```js
sheetSerialToISO(n)              // 日期序號 → 'YYYY-MM-DD'
normalizeDateCell(v, monthKey)   // 序號/YYYY-M-D/M-D 三種格式都能解析
                                  // 回傳 { md:'M/D'(顯示用), iso:'YYYY-MM-DD'(排序/比較用) }
```

年份推算規則（處理跨年週期分頁，如 `26_01` 分頁裡有 `12/22`）：
```js
diff = 該筆月份 - 分頁月份
diff > 6  → 年份 -1
diff < -6 → 年份 +1
```
⚠️ **已知限制**：此規則假設日期本該落在分頁月份附近，若試算表誤填了離譜的日期（見上方「待處理事項 2」），會被誤判年份，導致排序異常。

### 相關函式
```js
recentMonthScope()               // 回傳 [CURRENT_MONTH, 下個月]（下個月存在才含入）
fetchMonthEntries(monthKey)      // 非破壞式讀取指定月份全部記錄，不覆寫全域 MONTH_DATA
collectRecentEntries(limit)      // 合併目前月份(MONTH_DATA) + 跨月(RECENT_XTRA)，排序後取前 N 筆
renderRecentList()                // 只重繪清單區塊，不呼叫 renderTab()（避免清空使用者正在輸入的表單）
openRecentEdit(monthKey, cardKey, rowIdx)  // 若該筆屬於別的月份，先切換月份再開編輯視窗
RECENT_XTRA                       // { monthKey: {ts, entries} } 跨月資料快取，TTL 3分鐘
```

---

## 試算表尚待完成的事項（使用者自行操作）

- [ ] `25_12`~`26_04` 五個分頁改成新格式（row57=已匯入、row58=待繳、A56=現金總計、A57=現金餘額）
- [ ] 各分頁小計公式改算到 row54（原本只算到 row53）
- [ ] 8 筆空白刷退補分類（填回原消費分類）：
  - 26_03: T52(-353 淘寶退貨), T53(-279)
  - 26_01: K51(-2130 上個月退)
  - 25_12: E6(-3344 紅牛), E19(-4999 助聽器), T11(-83), T29(-3481), T30(-3017)
- [ ] 【新發現】檢查並修正 `26_07` 分頁中誤植的 `12/25` 日期（見上方待處理事項 2）

---

## 已確認不做的功能

- **卡片管理頁（App 內新增/刪除銀行卡片）**：v3.1 動態引擎讓直接在 Excel 操作即可自動生效，不需要 App 介面，且 App 自動寫回試算表結構風險過高
- 無限滾動、離線記帳等複雜功能
- **已結帳狀態自動判斷（不需手動勾選）**：曾評估過用結帳日期自動切月，但因結帳日與銀行實際請款日存在時間差，使用者需人工核對帳單才能確定邊界，故維持手動勾選 + 自動換月提示的設計

---

## 待辦功能（未來可做）

- **分類管理**：App 內新增/編輯/刪除消費分類，寫回「帳務類型」分頁（風險可控，是下一個建議做的功能）
- 歷史趨勢圖 UI 優化（若有需要）
- 【v3.6.1 候選】「最近十筆」對異常日期（與分頁月份差距過大）加註 ⚠️，避免排序被誤導
- 卡名結尾若含日期文字（如「Unicard (2649) 2026/6/30」），最近十筆清單顯示時可考慮去除以免擠壓版面

---

## 常見問題排查

### Cloudflare Worker CORS 錯誤
- 確認 Worker Domains & Routes 的 `workers.dev` Restricted 開關是**關閉**（Public）
- Restricted 開啟 = Cloudflare Access 攔截，CORS 永遠失敗

### 月份資料數字錯誤
- 確認試算表該月份是新格式（row57=已匯入、row58=待繳）
- 確認小計公式算到 row54
- 清除 localStorage 快取後重新載入

### 記帳無法儲存
- Console 看錯誤：`找不到該卡在此月份的欄位` → 目標月份分頁格式不對（第1/2行沒有銀行/卡名）
- 彈出「分頁不存在」→ 目標月份分頁還沒建立

### 抵扣回饋不顯示
- 記帳時分類必須**一字不差**填 `抵扣回饋`（不是「折抵回饋」）
- 金額記**負數**

### 【進行中】手機版 PWA 版本沒有更新
見文件最上方「待處理事項 1」。已知：改 `sw.js` 版本號**不足以保證更新**，需搭配 `skipWaiting()`/`clients.claim()`，且靜態資源引用建議加版本查詢字串。

### 「最近十筆」排序看起來不合理
先檢查該筆的原始日期是否為誤填（與所在分頁月份差距是否合理，例如七月分頁卻填了 12 月的日期）。長按該列可直接開啟編輯視窗確認/修正。

---

## 版本歷史

| 版本 | 類型 | 主要內容 |
|------|------|---------|
| v1.x | Major | PWA 基礎、OAuth implicit flow、基本試算表讀寫 |
| v2.0 | Major | 記帳優先（Tab 結構改造）、localStorage 快取、SWR |
| v3.0 | Major | 動態結構引擎（認標題列不認固定欄位）、移除新舊格式偵測 |
| v3.1 | Minor | 抵扣回饋分類化、row57/58 角色修正、消費分析三區塊、分類必填 |
| v3.2 | Minor | 修復 togglePaid bug（`bank.totalCol` 缺失）；新增「已結帳」勾選 + 自動換月提示（localStorage 版，v3.3 改寫） |
| v3.2.1 | Patch | 移除底色選項中的灰色 |
| v3.3 | Minor | 「已結帳」狀態改寫入試算表 row55 背景色（#FFF2CC），取代 localStorage，達成跨裝置同步 |
| v3.4 | Minor | 修正「已結帳卻沒自動帶下個月」：判斷基準由 `CURRENT_MONTH` 改為 `todayYYMM()`；已結帳狀態改用獨立 `BILLED_STATE` store；新增 `MONTH_MANUALLY_SET` |
| v3.5 | Minor | 新增「最近十筆」可摺疊清單（記帳 Tab 下方）；長按開啟既有編輯視窗；`renderRecentList()` 不觸發整個表單重繪 |
| v3.6 | Minor | 修正日期排序完全失效問題（日期欄實為日期格非文字，需用 `sheetSerialToISO`/`normalizeDateCell` 解析）；修正現金未顯示日期；清單改為跨月（含下個月，因結帳後新帳務寫在下個月） |

**版本號規則**（v3.2 起確立）：
- `x.x.1`（Patch）：小更動
- `x.3`（Minor）：中型更動（新增功能、重要修復）
- `4.0`（Major）：大改版

**修改日誌規範**（v3.2 起確立）：每次修改 `app.js` 須在檔案最上方維護版本歷史註解區塊（版本號、日期、修改事項條列），且 `sw.js` 版本號須同步更新（雖然目前發現光改版本號不足以讓手機確實更新，見待處理事項 1）。
