// ─────────────────────────────────────────────────────────────
// 信用卡記帳 PWA - 主邏輯
// ─────────────────────────────────────────────────────────────

const CLIENT_ID = '144262693536-poq7p69eo0aqr3r0onjafrd2f1rfrmg3.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const APP_VERSION = 'v1.6';

// 9 個銀行（用於儀表板顯示與計算）
// totalCol = 該銀行總計欄(row 56)；paidCol/accBalCol = 在 row 57 該銀行的「已匯入」「帳戶餘額」位置
const BANKS = [
  { key:'cash', name:'現金', isCash:true, totalCol:'A',  paidCol:'D',  accBalCol:'C',  dateInfo:'' },
  { key:'fb',   name:'富邦', totalCol:'E',  paidCol:'L',  accBalCol:'K',  dateInfo:'結帳20/期限05' },
  { key:'es',   name:'玉山', totalCol:'M',  paidCol:'AB', accBalCol:'AA', dateInfo:'結帳21/期限07' },
  { key:'ub',   name:'聯邦', totalCol:'AC', paidCol:'AR', accBalCol:'AQ', dateInfo:'結帳22/期限07' },
  { key:'cu',   name:'國泰', totalCol:'AS', paidCol:'AV', accBalCol:'AU', dateInfo:'結帳22/期限08' },
  { key:'tx',   name:'台新', totalCol:'AW', paidCol:'AZ', accBalCol:'AY', dateInfo:'結帳22/期限09' },
  { key:'sf',   name:'永豐', totalCol:'BA', paidCol:'BD', accBalCol:'BC', dateInfo:'結帳23/期限07' },
  { key:'cb',   name:'彰銀', totalCol:'BE', paidCol:'BH', accBalCol:'BG', dateInfo:'月底結帳/期限18' },
  { key:'cc',   name:'中信', totalCol:'BI', paidCol:'BL', accBalCol:'BK', dateInfo:'結帳20/期限08' },
];

// 16 個記帳項目（13 張卡 + 現金，依試算表欄位順序）
// col = 日期欄；col+1=金額；col+2=備註；col+3=分類
const BANKS_CARDS = [
  {key:'cash',    col:'A',  bankKey:'cash', bank:'現金', name:'現金',         tag:'',     isCash:true},
  {key:'fb_2606', col:'E',  bankKey:'fb',   bank:'富邦', name:'Open Possible',tag:'2606'},
  {key:'fb_5389', col:'I',  bankKey:'fb',   bank:'富邦', name:'好事多',       tag:'5389'},
  {key:'es_3473', col:'M',  bankKey:'es',   bank:'玉山', name:'熊卡',         tag:'3473'},
  {key:'es_2649', col:'Q',  bankKey:'es',   bank:'玉山', name:'Unicard',      tag:'2649'},
  {key:'es_3327', col:'U',  bankKey:'es',   bank:'玉山', name:'數位 e 卡',     tag:'3327'},
  {key:'es_3179', col:'Y',  bankKey:'es',   bank:'玉山', name:'南山',         tag:'3179'},
  {key:'ub_9207', col:'AC', bankKey:'ub',   bank:'聯邦', name:'Line Bank',    tag:'9207'},
  {key:'ub_6903', col:'AG', bankKey:'ub',   bank:'聯邦', name:'幸福 M',       tag:'6903'},
  {key:'ub_7602', col:'AK', bankKey:'ub',   bank:'聯邦', name:'綠卡',         tag:'7602'},
  {key:'ub_7207', col:'AO', bankKey:'ub',   bank:'聯邦', name:'吉鶴',         tag:'7207'},
  {key:'cu_3568', col:'AS', bankKey:'cu',   bank:'國泰', name:'Cube',         tag:'3568'},
  {key:'tx_0106', col:'AW', bankKey:'tx',   bank:'台新', name:'太陽',         tag:'0106'},
  {key:'sf_2207', col:'BA', bankKey:'sf',   bank:'永豐', name:'Daway',        tag:'2207'},
  {key:'cb_2108', col:'BE', bankKey:'cb',   bank:'彰銀', name:'My 購',        tag:'2108'},
  {key:'cc_3568', col:'BI', bankKey:'cc',   bank:'中信', name:'英雄聯盟',     tag:'3568'},
];

// 9 種底色（位置 0=無 1-8=色）
const COLORS = [
  {id:0, name:'無', hex:''},
  {id:1, name:'紅', hex:'#E57373'},
  {id:2, name:'橘', hex:'#FF9900'},
  {id:3, name:'黃', hex:'#FFD54F'},
  {id:4, name:'綠', hex:'#81C784'},
  {id:5, name:'藍', hex:'#64B5F6'},
  {id:6, name:'紫', hex:'#BA68C8'},
  {id:7, name:'粉', hex:'#F48FB1'},
  {id:8, name:'灰', hex:'#B0BEC5'},
];

// 預設分類（從試算表「帳務類型」分頁讀取後會覆蓋）
let CATEGORIES = [
  {name:'飲食', essential:true},
  {name:'共同飲食', essential:true},
  {name:'交通', essential:true},
  {name:'保險', essential:true},
  {name:'房屋', essential:true},
  {name:'水電瓦斯', essential:true},
  {name:'通訊', essential:true},
  {name:'醫療', essential:true},
  {name:'服飾', essential:false},
  {name:'化妝品', essential:false},
  {name:'3C', essential:false},
  {name:'娛樂', essential:false},
  {name:'學習', essential:true},
  {name:'旅遊', essential:false},
  {name:'禮物', essential:false},
  {name:'家用', essential:true},
  {name:'日用品', essential:true},
  {name:'寵物', essential:true},
  {name:'手續費', essential:true},
  {name:'稅費', essential:true},
  {name:'開心購物', essential:false},
  {name:'其他代墊', essential:false},
  {name:'其他', essential:false},
];

// 全域狀態
let SHEET_ID = '';
let TOKEN = null;
let TOKEN_CLIENT = null;
let CURRENT_USER = null;
let CURRENT_MONTH = ''; // 'YY_MM'
let CURRENT_TAB = 'dashboard';
let MONTH_DATA = {}; // {cardKey: [{rowIdx, date, amount, note, category, installment}]}
let BANK_DATA = {};  // {bankKey: {total, rebate, install, paid, accBalRaw, accBal, net, pending, isPaidCheck}}
let EDIT_TARGET = null; // {bankKey(=cardKey), rowIdx} for editing
let HISTORY_DATA = null; // 6 個月歷史

// ─── 初始化 ──────────────────────────────────────────────────
let GIS_READY = false, GAPI_READY = false;

// Splash 超時保護：12 秒沒載完就顯示錯誤訊息與重試按鈕
setTimeout(() => {
  if (!GIS_READY || !GAPI_READY) {
    const msg = document.getElementById('splash-msg');
    const retry = document.getElementById('splash-retry');
    if (msg) msg.innerHTML = `Google API 載入失敗<br><span style="font-size:11px;opacity:.7">GIS:${GIS_READY?'✓':'✗'} GAPI:${GAPI_READY?'✓':'✗'}</span>`;
    if (retry) retry.classList.remove('hidden');
  }
}, 12000);

function checkReady() {
  if (GIS_READY && GAPI_READY) {
    document.getElementById('splash').classList.add('hidden');
    boot();
  }
}

// 等 Google APIs 載入
window.addEventListener('load', () => {
  // 註冊 Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(r => console.log('SW registered:', r.scope))
      .catch(e => console.warn('SW failed:', e));
  }

  // GIS (Google Identity Services)
  const tryGIS = () => {
    if (window.google && window.google.accounts) {
      TOKEN_CLIENT = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: tokenCallback,
      });
      GIS_READY = true;
      checkReady();
    } else setTimeout(tryGIS, 200);
  };
  tryGIS();

  // GAPI (for Sheets API)
  const tryGAPI = () => {
    if (window.gapi) {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
          });
          GAPI_READY = true;
          checkReady();
        } catch (e) {
          console.error('GAPI init failed:', e);
        }
      });
    } else setTimeout(tryGAPI, 200);
  };
  tryGAPI();
});

function boot() {
  // 載入儲存的設定
  SHEET_ID = localStorage.getItem('credit-sheet-id') || '';
  const savedToken = localStorage.getItem('credit-token');
  const tokenExpiry = parseInt(localStorage.getItem('credit-token-expiry') || '0');

  if (savedToken && Date.now() < tokenExpiry) {
    TOKEN = savedToken;
    gapi.client.setToken({access_token: TOKEN});
    if (SHEET_ID) {
      showApp();
      initApp();
    } else {
      showSetup();
    }
  } else {
    showLogin();
  }
}

// ─── OAuth ──────────────────────────────────────────────────
function signIn() {
  document.getElementById('login-error').classList.add('hidden');
  if (!TOKEN_CLIENT) {
    showLoginError('Google 登入元件未準備好，請重新整理頁面');
    return;
  }
  TOKEN_CLIENT.requestAccessToken({prompt: 'consent'});
}

function tokenCallback(resp) {
  if (resp.error) {
    showLoginError(`登入失敗：${resp.error}`);
    return;
  }
  TOKEN = resp.access_token;
  // Token 通常 1 小時，存起來
  const expiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000; // 提前 1 分鐘失效
  localStorage.setItem('credit-token', TOKEN);
  localStorage.setItem('credit-token-expiry', expiry.toString());
  gapi.client.setToken({access_token: TOKEN});

  if (SHEET_ID) {
    showApp();
    initApp();
  } else {
    showSetup();
  }
}

function signOut() {
  if (TOKEN && google.accounts.oauth2) {
    google.accounts.oauth2.revoke(TOKEN);
  }
  TOKEN = null;
  localStorage.removeItem('credit-token');
  localStorage.removeItem('credit-token-expiry');
  showLogin();
}

function refreshToken() {
  return new Promise((resolve, reject) => {
    if (!TOKEN_CLIENT) return reject('No token client');
    TOKEN_CLIENT.callback = (resp) => {
      if (resp.error) return reject(resp.error);
      TOKEN = resp.access_token;
      const expiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
      localStorage.setItem('credit-token', TOKEN);
      localStorage.setItem('credit-token-expiry', expiry.toString());
      gapi.client.setToken({access_token: TOKEN});
      resolve();
    };
    TOKEN_CLIENT.requestAccessToken({prompt: ''});
  });
}

// ─── 畫面切換 ────────────────────────────────────────────────
function showLogin() {
  hideAll();
  document.getElementById('login-screen').classList.remove('hidden');
}
function showSetup() {
  hideAll();
  document.getElementById('setup-screen').classList.remove('hidden');
  const saved = localStorage.getItem('credit-sheet-id') || '';
  document.getElementById('setup-sheet-id').value = saved;
}
function showApp() {
  hideAll();
  document.getElementById('app').classList.remove('hidden');
}
function hideAll() {
  ['login-screen','setup-screen','app'].forEach(id => document.getElementById(id).classList.add('hidden'));
}
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── 設定 ───────────────────────────────────────────────────
function saveSetup() {
  const v = document.getElementById('setup-sheet-id').value.trim();
  if (!v) return notify('請輸入試算表 ID 或網址', 'err');
  // 從網址抽取 ID
  let id = v;
  const m = v.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) id = m[1];
  SHEET_ID = id;
  localStorage.setItem('credit-sheet-id', id);
  showApp();
  initApp();
}
function openSetupAgain() {
  showSetup();
}
function openSheet() {
  if (!SHEET_ID) return;
  window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, '_blank');
}
async function showAbout() {
  const modal = document.getElementById('install-guide-modal');
  const content = document.getElementById('install-guide-content');

  // 立即顯示彈窗，內容稍後填入
  content.innerHTML = '<div style="text-align:center;padding:20px"><span class="loader"></span> 執行診斷中…</div>';
  modal.classList.remove('hidden');

  // 收集診斷資料
  const ua = navigator.userAgent;
  let device = '其他';
  if (/iphone|ipad|ipod/i.test(ua)) device = 'iOS';
  else if (/android/i.test(ua)) device = 'Android';
  else if (/win|mac|linux/i.test(ua)) device = '桌面';

  let browser = '其他';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung';

  const chromeVer = (ua.match(/Chrome\/(\d+)/) || [])[1] || '?';

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const hasPrompt = !!window._pwaPrompt;
  const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';

  // 測試 manifest
  let manifestStatus = '⏳';
  let manifestDetails = '';
  try {
    const mr = await fetch('manifest.json?t=' + Date.now(), {cache: 'no-store'});
    if (mr.ok) {
      const mj = await mr.json();
      const has192 = mj.icons?.some(i => i.sizes === '192x192');
      const has512 = mj.icons?.some(i => i.sizes === '512x512');
      const hasName = !!(mj.name || mj.short_name);
      const hasDisplay = ['standalone','fullscreen','minimal-ui'].includes(mj.display);
      const okStartUrl = !!mj.start_url;
      if (has192 && has512 && hasName && hasDisplay && okStartUrl) {
        manifestStatus = '✓ 正常';
      } else {
        manifestStatus = '⚠ 欄位不齊';
        manifestDetails = `name:${hasName?'✓':'✗'} 192:${has192?'✓':'✗'} 512:${has512?'✓':'✗'} display:${hasDisplay?'✓':'✗'} start_url:${okStartUrl?'✓':'✗'}`;
      }
    } else {
      manifestStatus = `✗ HTTP ${mr.status}`;
    }
  } catch (e) {
    manifestStatus = '✗ ' + (e.message || e);
  }

  // 測試圖示實際尺寸（Chrome 安裝必檢項）
  const checkIconDim = (path, expectedSize) => new Promise(resolve => {
    const img = new Image();
    const t = setTimeout(() => resolve({label: '✗ 逾時', match: false}), 5000);
    img.onload = () => {
      clearTimeout(t);
      const w = img.naturalWidth, h = img.naturalHeight;
      const match = w === expectedSize && h === expectedSize;
      resolve({
        label: `${match?'✓':'⚠'} ${w}×${h}${match?'':` (應 ${expectedSize}×${expectedSize})`}`,
        match
      });
    };
    img.onerror = () => { clearTimeout(t); resolve({label: '✗ 載入失敗', match: false}); };
    img.src = path + '?t=' + Date.now();
  });
  const dim192 = await checkIconDim('icon-192.png', 192);
  const dim512 = await checkIconDim('icon-512.png', 512);

  // SW 深度狀態
  let swState = '✗ 未註冊';
  let swScope = '-';
  let swController = '✗';
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swScope = reg.scope.replace(location.origin, '');
        if (reg.active) swState = '✓ Active';
        else if (reg.installing) swState = '⏳ Installing';
        else if (reg.waiting) swState = '⏳ Waiting';
        else swState = '⚠ Registered (no worker)';
      }
      swController = navigator.serviceWorker.controller ? '✓' : '✗';
    } catch {}
  }

  // 是否所有條件都符合
  const allOK = manifestStatus.startsWith('✓') && dim192.match && dim512.match && swState.startsWith('✓');

  // 建議區塊
  let suggestion;
  if (isStandalone) {
    suggestion = `<div style="background:#1a3a25;border:1px solid #1f4a30;color:#4CAF50;padding:12px;border-radius:8px;margin-top:12px;text-align:center">✅ 已成功以 App 模式運行！</div>`;
  } else if (hasPrompt) {
    suggestion = `<div style="background:#534AB7;color:#fff;padding:12px;border-radius:8px;margin-top:12px;text-align:center">🟢 可立即安裝<br><button class="btn-mini" style="margin-top:8px;background:#fff;color:#534AB7;font-weight:700;padding:6px 16px" onclick="closeInstallGuide();triggerInstall()">點此安裝</button></div>`;
  } else if (device === 'iOS') {
    suggestion = `<div style="background:var(--bg3);padding:12px;border-radius:8px;margin-top:12px;font-size:12px;line-height:1.7">
      <b>iOS 安裝</b><br>
      Safari 工具列分享 ⬆ → 加入主畫面 → 新增
    </div>`;
  } else if (allOK && device === 'Android') {
    suggestion = `<div style="background:#1a3a25;border:1px solid #4CAF50;padding:12px;border-radius:8px;margin-top:12px;font-size:12px;line-height:1.8">
      <b style="color:#4CAF50">✅ 所有 PWA 條件都符合！</b><br>
      請在 Chrome 三點選單 ⋮ 點 <b style="color:#6B5FE0">「加到主畫面」</b><br>
      會跳出系統安裝對話框（不是只做書籤）<br>
      <span style="color:var(--fg3);font-size:11px">※ 即使選單沒有「安裝應用程式」字樣，這個按鈕在條件符合時就會直接安裝成 PWA</span>
    </div>`;
  } else if (device === 'Android') {
    suggestion = `<div style="background:var(--bg3);padding:12px;border-radius:8px;margin-top:12px;font-size:12px;line-height:1.7">
      ⚠ 上方檢查還有不通過的項目，安裝會失敗。<br>
      請按下方「完全重置 PWA」清除舊狀態後再試。
    </div>`;
  }

  content.innerHTML = `
    <div style="font-size:13px;line-height:1.8">
      <div style="background:var(--bg3);padding:10px 12px;border-radius:8px;margin-bottom:10px">
        <div style="font-weight:700;font-size:14px">信用卡記帳 ${APP_VERSION}</div>
        <div style="font-size:11px;color:var(--fg3);margin-top:2px">PWA 診斷工具</div>
      </div>

      <div style="font-weight:600;color:var(--fg2);margin:8px 0 4px;font-size:12px">執行環境</div>
      <table style="font-size:12px">
        <tr><td>裝置</td><td class="r">${device}</td></tr>
        <tr><td>瀏覽器</td><td class="r">${browser}${chromeVer!=='?'?` ${chromeVer}`:''}</td></tr>
        <tr><td>HTTPS</td><td class="r">${isHTTPS?'✓':'✗'}</td></tr>
        <tr><td>顯示模式</td><td class="r">${isStandalone?'✓ Standalone':'瀏覽器內'}</td></tr>
      </table>

      <div style="font-weight:600;color:var(--fg2);margin:10px 0 4px;font-size:12px">PWA 安裝必要條件</div>
      <table style="font-size:12px">
        <tr><td>manifest.json</td><td class="r">${manifestStatus}</td></tr>
        ${manifestDetails ? `<tr><td colspan="2" class="dim" style="font-size:10px">${manifestDetails}</td></tr>` : ''}
        <tr><td>icon-192.png 實際尺寸</td><td class="r">${dim192.label}</td></tr>
        <tr><td>icon-512.png 實際尺寸</td><td class="r">${dim512.label}</td></tr>
        <tr><td>SW 狀態</td><td class="r">${swState}</td></tr>
        <tr><td>SW Scope</td><td class="r dim" style="font-size:10px">${escapeHtml(swScope)}</td></tr>
        <tr><td>SW 控制中</td><td class="r">${swController}</td></tr>
        <tr><td>beforeinstallprompt</td><td class="r">${hasPrompt?'✓ 已捕捉':'✗ 未觸發'}</td></tr>
      </table>

      ${suggestion || ''}

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--bg3)">
        <button class="btn btn-danger btn-full" onclick="resetPWA()" style="font-size:13px">🔄 完全重置 PWA（解除 SW + 清快取）</button>
        <p style="font-size:10px;color:var(--fg3);margin-top:6px;text-align:center">當 Chrome 把網站誤判為「不可安裝」時，用此按鈕清空狀態後重新試</p>
      </div>
    </div>
  `;
}

async function resetPWA() {
  if (!confirm('將解除所有 Service Worker 並清除快取，然後重新載入頁面。確定？')) return;
  try {
    // 1. 解除所有 SW 註冊
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
    }
    // 2. 清除所有 Cache Storage
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
    // 3. 清除這個 app 的 localStorage
    localStorage.removeItem('pwa-banner-dismissed');
    localStorage.removeItem('ios-guide-dismissed');
    notify('✓ 已重置，正在重新載入…', 'ok');
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    notify('重置失敗：' + (e.message || e), 'err');
  }
}

// ─── 主程式啟動 ─────────────────────────────────────────────
async function initApp() {
  await loadCategories();
  await detectAvailableMonths();
  populateMonthSelector();
  populateBankSelector();
  populateCategorySelector();
  populateColorPicker();
  await loadCurrentMonth();
}

async function loadCategories() {
  try {
    const r = await sheetGet(SHEET_ID, '帳務類型!A2:C100');
    const rows = r.result.values || [];
    if (!rows.length) return;
    const cats = [];
    rows.forEach(row => {
      const name = (row[0] || '').trim();
      if (!name) return;
      const must = !!(row[1] && row[1].trim());
      const notMust = !!(row[2] && row[2].trim());
      cats.push({name, essential: must});
    });
    if (cats.length) CATEGORIES = cats;
  } catch (e) {
    console.warn('讀取分類失敗，使用預設值', e);
  }
}

async function detectAvailableMonths() {
  try {
    const r = await gapi.client.sheets.spreadsheets.get({spreadsheetId: SHEET_ID});
    const sheets = r.result.sheets || [];
    const months = [];
    sheets.forEach(s => {
      const t = s.properties.title;
      if (/^\d{2}_\d{2}$/.test(t)) months.push(t);
    });
    months.sort().reverse();
    window.AVAILABLE_MONTHS = months;
    // 預設：今天的月份；若沒有則用最新
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const today = `${yy}_${mm}`;
    CURRENT_MONTH = months.includes(today) ? today : (months[0] || today);
  } catch (e) {
    console.error('讀取月份分頁失敗', e);
    notify('無法讀取試算表，請檢查試算表 ID', 'err');
  }
}

function populateMonthSelector() {
  const sel = document.getElementById('month-sel');
  sel.innerHTML = (window.AVAILABLE_MONTHS || []).map(m => {
    const [yy, mm] = m.split('_');
    return `<option value="${m}">20${yy}/${mm}</option>`;
  }).join('');
  sel.value = CURRENT_MONTH;
}

function populateBankSelector() {
  const sel = document.getElementById('f-bank');
  sel.innerHTML = '<option value="">— 請選擇 —</option>' +
    BANKS_CARDS.map(b => `<option value="${b.key}">${b.bank}：${b.name}${b.tag?` (${b.tag})`:''}</option>`).join('');
}

function populateCategorySelector() {
  const sel = document.getElementById('f-cat');
  sel.innerHTML = CATEGORIES.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function populateColorPicker() {
  const wrap = document.getElementById('f-colors');
  wrap.innerHTML = COLORS.map(c => {
    const bg = c.hex || 'transparent';
    const border = c.hex ? c.hex : 'var(--bg4)';
    const inner = c.hex ? '' : `<span style="font-size:10px;color:var(--fg3)">無</span>`;
    return `<div class="color-opt" data-color="${c.id}" onclick="selectColor(${c.id})" style="background:${bg};border-color:${border};display:flex;align-items:center;justify-content:center" title="${c.name}">${inner}</div>`;
  }).join('');
  selectColor(0);
}

let SELECTED_COLOR = 0;
function selectColor(id) {
  SELECTED_COLOR = id;
  document.querySelectorAll('.color-opt').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.color) === id);
  });
}

function onInstallmentChange() {
  const checked = document.getElementById('f-installment').checked;
  if (checked) selectColor(2); // 自動套橘色
}

async function onMonthChange() {
  CURRENT_MONTH = document.getElementById('month-sel').value;
  await loadCurrentMonth();
}

async function loadCurrentMonth() {
  document.getElementById('tab-content').innerHTML = `<div style="text-align:center;padding:40px;color:var(--fg3)"><span class="loader"></span> 載入 ${CURRENT_MONTH}…</div>`;
  try {
    // 用 spreadsheets.get with grid data，一次抓「值」+「背景色」
    const r = await retryWithAuth(() => gapi.client.sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      ranges: [`${CURRENT_MONTH}!A4:BL57`],
      fields: 'sheets.data.rowData.values(formattedValue,effectiveValue,effectiveFormat.backgroundColor)',
    }));
    const sheetData = r.result.sheets?.[0]?.data?.[0];
    const rowDataArr = sheetData?.rowData || [];

    // 解析成 [54 列][64 欄] 的 values 與 backgrounds
    const rows = []; // 值
    const bgs = [];  // 背景色 {red,green,blue}
    for (let i = 0; i < 54; i++) {
      const cells = rowDataArr[i]?.values || [];
      const rv = [], rb = [];
      for (let j = 0; j < 64; j++) {
        const cell = cells[j] || {};
        const ev = cell.effectiveValue;
        let v = '';
        if (ev) {
          if ('numberValue' in ev) v = ev.numberValue;
          else if ('stringValue' in ev) v = ev.stringValue;
          else if ('boolValue' in ev) v = ev.boolValue;
        } else if (cell.formattedValue !== undefined) {
          v = cell.formattedValue;
        }
        rv.push(v);
        rb.push(cell.effectiveFormat?.backgroundColor || null);
      }
      rows.push(rv);
      bgs.push(rb);
    }

    parseMonthData(rows, bgs);
    renderTab();
  } catch (e) {
    console.error('載入月份失敗', e);
    if (e?.status === 404 || (e?.result?.error?.code === 400)) {
      document.getElementById('tab-content').innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>找不到 ${CURRENT_MONTH} 月份分頁<br><br>請先在試算表建立此月份分頁</p></div>`;
    } else {
      document.getElementById('tab-content').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><p>載入失敗<br><span class="dim">${e?.result?.error?.message || e?.message || e}</span></p></div>`;
    }
  }
}

// 顏色判斷工具：判斷儲存格背景色
function colorClose(bg, r, g, b, tol) {
  if (!bg) return false;
  tol = tol || 0.08;
  return Math.abs((bg.red||0) - r) < tol &&
         Math.abs((bg.green||0) - g) < tol &&
         Math.abs((bg.blue||0) - b) < tol;
}
function isOrange(bg) { return colorClose(bg, 1, 0.6, 0); }       // #ff9900
function isPaidGray(bg) { return colorClose(bg, 0.7176, 0.7176, 0.7176); } // #b7b7b7

function parseMonthData(rows, bgs) {
  MONTH_DATA = {};
  BANK_DATA = {};
  bgs = bgs || [];
  // rows[0] = row 4（第一筆資料）
  // rows[49] = row 53（最後一筆資料）
  // rows[50] = row 54（折抵）
  // rows[51] = row 55（空白行）
  // rows[52] = row 56（總計／已繳費勾選格 — 灰底=已繳費）
  // rows[53] = row 57（已匯入 + 帳戶餘額）

  // 1) 先以「卡」為單位讀條目，存入 MONTH_DATA[cardKey]
  BANKS_CARDS.forEach(card => {
    const cIdx = colToIdx(card.col);
    const aIdx = cIdx + 1, nIdx = cIdx + 2, ccIdx = cIdx + 3;
    const items = [];
    for (let i = 0; i < 50; i++) {
      const r = rows[i] || [];
      const date = r[cIdx] === '' || r[cIdx] == null ? '' : r[cIdx];
      const amountRaw = r[aIdx];
      const note = r[nIdx] || '';
      const category = r[ccIdx] || '';
      const amt = parseAmount(amountRaw);
      if ((amt === null || amt === 0) && !date && !note) continue;
      // 分期判斷：[分期] 標記 OR 金額儲存格背景色 #ff9900
      const cellBg = (bgs[i] || [])[aIdx];
      const isInstByNote = /\[分期\]/.test(String(note));
      const isInstByBg = isOrange(cellBg);
      items.push({
        rowIdx: i + 4,
        date,
        amount: amt || 0,
        note,
        category,
        installment: isInstByNote || isInstByBg,
      });
    }
    MONTH_DATA[card.key] = items;
  });

  // 2) 以「銀行」為單位計算彙總
  BANKS.forEach(bank => {
    const bankCards = BANKS_CARDS.filter(c => c.bankKey === bank.key);
    let total = 0, rebate = 0, install = 0;

    bankCards.forEach(card => {
      const cIdx = colToIdx(card.col);
      const aIdx = cIdx + 1;
      // 加總所有條目（含負數刷退）
      for (let i = 0; i < 50; i++) {
        const r = rows[i] || [];
        const n = parseAmount(r[aIdx]);
        if (n === null || n === 0) continue;
        total += n;
        // 分期：[分期] 標記 OR 背景色 #ff9900；只算正數
        const note = String(r[cIdx + 2] || '');
        const cellBg = (bgs[i] || [])[aIdx];
        if (n > 0 && (/\[分期\]/.test(note) || isOrange(cellBg))) {
          install += n;
        }
      }
      // Row 54 = 折抵
      const rb = parseAmount((rows[50] || [])[aIdx]);
      rebate += (rb || 0);
    });

    // 銀行的 paid 與 accBal 都在 row 57 的「銀行專屬欄位」
    const paidIdx = colToIdx(bank.paidCol);
    const accBalIdx = colToIdx(bank.accBalCol);
    const r57 = rows[53] || [];
    const paid = parseAmount(r57[paidIdx]) || 0;
    const accBalRaw = parseAmount(r57[accBalIdx]) || 0;
    const accBal = accBalRaw < 0 ? Math.abs(accBalRaw) : 0;
    const net = total - rebate;
    const pending = Math.max(0, net - paid);

    // 已繳費判斷：totalCol+'56' 的背景色為 #b7b7b7
    const totalIdx = colToIdx(bank.totalCol);
    const r56bg = (bgs[52] || [])[totalIdx];
    const isPaidCheck = isPaidGray(r56bg);

    BANK_DATA[bank.key] = {
      total, rebate, install, paid, accBalRaw, accBal,
      net, pending, isPaidCheck
    };
  });
}

function colToIdx(col) {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n - 1;
}

function idxToCol(idx) {
  let col = '';
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    col = String.fromCharCode(65 + r) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function parseAmount(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,\s$]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Sheets API 包裝 ────────────────────────────────────────
async function sheetGet(sheetId, range) {
  return await retryWithAuth(() => gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  }));
}
async function sheetUpdate(sheetId, range, values) {
  return await retryWithAuth(() => gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: {values},
  }));
}
async function retryWithAuth(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e?.status === 401 || e?.status === 403) {
      // Token 過期，重新取得
      try {
        await refreshToken();
        return await fn();
      } catch (e2) {
        showLogin();
        throw e2;
      }
    }
    throw e;
  }
}

// ─── 標籤切換 ────────────────────────────────────────────────
function switchTab(tab) {
  CURRENT_TAB = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderTab();
}

function renderTab() {
  if (CURRENT_TAB === 'dashboard') renderDashboard();
  else if (CURRENT_TAB === 'analysis') renderAnalysis();
  else if (CURRENT_TAB === 'trends') renderTrends();
}

// ─── 計算函式 ────────────────────────────────────────────────
function getCardTotal(cardKey) {
  const items = MONTH_DATA[cardKey] || [];
  return items.reduce((s, it) => s + it.amount, 0);
}

// ─── 儀表板 ──────────────────────────────────────────────────
function renderDashboard() {
  // 全域加總（嚴格對應舊版 GAS 邏輯）
  let gTotal = 0, gRebate = 0, gPaid = 0, gPending = 0, gInstall = 0, gAccBalAccum = 0;

  BANKS.forEach(b => {
    const bd = BANK_DATA[b.key];
    if (!bd) return;
    gTotal += bd.total;
    gRebate += bd.rebate;
    gInstall += bd.install;
    if (b.isCash) {
      // 現金的 paid (D57) 是現金餘額本身
      gAccBalAccum += bd.paid;
    } else {
      gPaid += bd.paid;
      gPending += bd.pending;
      gAccBalAccum += bd.accBal; // 各卡的「透支金額」(rawAcc<0 時的絕對值)
    }
  });
  const gNet = gTotal - gRebate;
  // 最終：(現金 + 各卡透支) - 待匯入繳款
  const gAccBalTotal = gAccBalAccum - gPending;

  // KPI
  let h = '<div class="kpi-grid">';
  h += `<div class="kpi-card"><div class="kpi-label">消費總計</div><div class="kpi-value">${fmtMoney(gTotal)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">回饋折抵</div><div class="kpi-value green">-${fmtMoney(gRebate)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">實際應付</div><div class="kpi-value">${fmtMoney(gNet)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">已匯入現金</div><div class="kpi-value blue">${fmtMoney(gPaid)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">待匯入繳款</div><div class="kpi-value red">${fmtMoney(gPending)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">本月分期</div><div class="kpi-value orange">${fmtMoney(gInstall)}</div></div>`;
  h += `</div>`;
  h += `<div class="card"><div class="card-title">現金及帳戶餘額</div><div class="card-value ${gAccBalTotal < 0 ? 'red' : ''}">${fmtMoney(gAccBalTotal)}</div><div class="card-sub">${gAccBalTotal < 0 ? '⚠ 透支' : '可用餘額'}</div></div>`;

  // 各銀行摘要
  h += `<div style="margin-top:14px;font-size:13px;font-weight:600;color:var(--fg2);margin-bottom:8px">各銀行摘要</div>`;

  BANKS.forEach(b => {
    const bd = BANK_DATA[b.key];
    if (!bd) return;
    if (bd.total === 0 && bd.paid === 0 && bd.install === 0) return;

    if (b.isCash) {
      h += `<div class="card-row">
        <div class="card-row-head">
          <div class="card-row-name"><span>${b.name}</span></div>
          <div class="card-row-amt">${fmtMoney(bd.total)}</div>
        </div>
        <div class="card-row-meta">
          <span>消費總計 <b>${fmtMoney(bd.total)}</b></span>
          <span>目前現金 <b class="green">${fmtMoney(bd.paid)}</b></span>
        </div>
      </div>`;
    } else {
      h += `<div class="card-row ${bd.isPaidCheck?'paid':''}">
        <div class="card-row-head">
          <div class="card-row-name">
            <span>${b.name}</span>
            ${b.dateInfo?`<span class="card-row-tag">${b.dateInfo}</span>`:''}
          </div>
          <div class="card-row-amt">${fmtMoney(bd.total)}</div>
        </div>
        <div class="card-row-meta">
          ${bd.install ? `<span>分期 <b class="orange">${fmtMoney(bd.install)}</b></span>` : ''}
          ${bd.rebate ? `<span>折抵 <b class="green">-${fmtMoney(bd.rebate)}</b></span>` : ''}
          ${bd.rebate ? `<span>繳款 <b>${fmtMoney(bd.net)}</b></span>` : ''}
          <span>已匯 <b class="blue">${fmtMoney(bd.paid)}</b></span>
          <span>待繳 <b class="${bd.pending>0?'red':'green'}">${fmtMoney(bd.pending)}</b></span>
          <span>餘額 <b>${fmtMoney(bd.accBal)}</b></span>
        </div>
        <div class="card-row-actions">
          <label class="chk-paid"><input type="checkbox" ${bd.isPaidCheck?'checked':''} onchange="togglePaid('${b.key}',this.checked)"/> 已繳費</label>
        </div>
      </div>`;
    }
  });
  document.getElementById('tab-content').innerHTML = h;
}

function getColorByCategory(cat) {
  // 根據分類給對應顏色（簡單對應）
  const map = {'飲食':4,'共同飲食':4,'交通':5,'保險':6,'醫療':1,'娛樂':7,'旅遊':3,'開心購物':2};
  return map[cat] || 0;
}

function parseDateMD(s) {
  if (!s) return 0;
  const m = String(s).match(/(\d+)\/(\d+)/);
  if (!m) return 0;
  return parseInt(m[1]) * 100 + parseInt(m[2]);
}

// ─── 切換已繳費（以「銀行」為單位，寫入 totalCol+'56' 的背景色）──
async function togglePaid(bankKey, checked) {
  const bank = BANKS.find(b => b.key === bankKey);
  if (!bank) return;
  if (BANK_DATA[bankKey]) BANK_DATA[bankKey].isPaidCheck = checked;
  try {
    // 取得該分頁的 sheetId
    const meta = await gapi.client.sheets.spreadsheets.get({spreadsheetId: SHEET_ID});
    const sheet = meta.result.sheets.find(s => s.properties.title === CURRENT_MONTH);
    if (!sheet) throw new Error('找不到月份分頁');
    const sheetId = sheet.properties.sheetId;
    const totalIdx = colToIdx(bank.totalCol);
    const bgColor = checked ? {red:0.7176, green:0.7176, blue:0.7176} : {red:1, green:1, blue:1}; // #b7b7b7 or white

    await retryWithAuth(() => gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          repeatCell: {
            range: {sheetId, startRowIndex: 55, endRowIndex: 56, startColumnIndex: totalIdx, endColumnIndex: totalIdx + 1},
            cell: {userEnteredFormat: {backgroundColor: bgColor}},
            fields: 'userEnteredFormat.backgroundColor',
          }
        }]
      }
    }));
    notify(checked ? '✓ 已標記繳費' : '已取消繳費標記', 'ok');
    renderTab();
  } catch (e) {
    notify('更新失敗', 'err');
    console.error(e);
    if (BANK_DATA[bankKey]) BANK_DATA[bankKey].isPaidCheck = !checked;
    renderTab();
  }
}

// ─── 新增/編輯 ──────────────────────────────────────────────
// 日期轉換工具
function dateToMD(yyyymmdd) {
  // YYYY-MM-DD → M/D
  if (!yyyymmdd) return '';
  const parts = yyyymmdd.split('-');
  if (parts.length !== 3) return '';
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}
function mdToDate(md, refMonth) {
  // M/D → YYYY-MM-DD（年份從 refMonth 推算）
  if (!md) return '';
  const m = String(md).match(/(\d+)\/(\d+)/);
  if (!m) return '';
  let year = new Date().getFullYear();
  if (refMonth) {
    const [yy] = refMonth.split('_');
    year = 2000 + parseInt(yy);
  }
  return `${year}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
}

function populateFormMonthSelector(disabled) {
  const sel = document.getElementById('f-month');
  sel.innerHTML = (window.AVAILABLE_MONTHS || []).map(m => {
    const [yy, mm] = m.split('_');
    return `<option value="${m}">20${yy}/${mm}</option>`;
  }).join('');
  sel.disabled = !!disabled;
}

function openAddForm() {
  EDIT_TARGET = null;
  populateFormMonthSelector(false); // 新增時可選月份
  document.getElementById('form-title').textContent = '新增記帳';
  document.getElementById('f-delete').classList.add('hidden');
  document.getElementById('f-bank').value = '';
  document.getElementById('f-bank').disabled = false;
  document.getElementById('f-month').value = CURRENT_MONTH;
  // 日期預設今天
  const now = new Date();
  document.getElementById('f-date').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  document.getElementById('f-amt').value = '';
  document.getElementById('f-note').value = '';
  document.getElementById('f-cat').value = CATEGORIES[0]?.name || '';
  document.getElementById('f-installment').checked = false;
  selectColor(0);
  document.getElementById('form-modal').classList.remove('hidden');
}

function editEntry(bankKey, rowIdx) {
  const items = MONTH_DATA[bankKey] || [];
  const it = items.find(x => x.rowIdx === rowIdx);
  if (!it) return;
  EDIT_TARGET = {bankKey, rowIdx};
  populateFormMonthSelector(true); // 編輯時鎖住月份（因為列號是該月份的）
  document.getElementById('form-title').textContent = '編輯記錄';
  document.getElementById('f-delete').classList.remove('hidden');
  document.getElementById('f-bank').value = bankKey;
  document.getElementById('f-bank').disabled = true;
  document.getElementById('f-month').value = CURRENT_MONTH;
  document.getElementById('f-date').value = mdToDate(it.date, CURRENT_MONTH);
  document.getElementById('f-amt').value = it.amount;
  document.getElementById('f-note').value = (it.note || '').replace(/\s*\[分期\]\s*/g, '').trim();
  document.getElementById('f-cat').value = it.category || '';
  document.getElementById('f-installment').checked = it.installment;
  selectColor(it.installment ? 2 : 0);
  document.getElementById('form-modal').classList.remove('hidden');
}

function closeForm() {
  document.getElementById('form-modal').classList.add('hidden');
}

async function saveEntry() {
  const bankKey = document.getElementById('f-bank').value;
  if (!bankKey) return notify('請選擇記帳項目', 'err');
  const targetMonth = document.getElementById('f-month').value || CURRENT_MONTH;
  const dateRaw = document.getElementById('f-date').value;
  if (!dateRaw) return notify('請選擇日期', 'err');
  const date = dateToMD(dateRaw);
  const amt = document.getElementById('f-amt').value;
  if (!amt) return notify('請輸入金額', 'err');
  let note = document.getElementById('f-note').value.trim();
  const category = document.getElementById('f-cat').value;
  const installment = document.getElementById('f-installment').checked;
  if (installment && !/\[分期\]/.test(note)) note = note ? `${note} [分期]` : '[分期]';
  if (!installment) note = note.replace(/\s*\[分期\]\s*/g, '').trim();

  const bank = BANKS_CARDS.find(b => b.key === bankKey);
  let rowIdx = EDIT_TARGET ? EDIT_TARGET.rowIdx : findEmptyRow(bankKey);
  if (!rowIdx) return notify('該卡 50 筆已滿，請刪除舊記錄', 'err');

  const startCol = bank.col;
  const range = `${targetMonth}!${startCol}${rowIdx}:${idxToCol(colToIdx(startCol)+3)}${rowIdx}`;
  const btn = document.getElementById('f-save');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> 儲存中…';
  try {
    await sheetUpdate(SHEET_ID, range, [[date, parseFloat(amt), note, category]]);
    // 套用底色（用 targetMonth 不是 CURRENT_MONTH）
    await applyRowColor(bankKey, rowIdx, installment ? 2 : SELECTED_COLOR, targetMonth);
    // 同步「共同飲食」（也用 targetMonth）
    if (category === '共同飲食') {
      await syncCommonFood(rowIdx, date, parseFloat(amt), note, targetMonth);
    }
    notify('✓ 已儲存', 'ok');
    closeForm();
    // 若寫入的月份就是當前顯示的月份，重新載入；否則切換過去
    if (targetMonth === CURRENT_MONTH) {
      await loadCurrentMonth();
    } else {
      CURRENT_MONTH = targetMonth;
      document.getElementById('month-sel').value = targetMonth;
      await loadCurrentMonth();
    }
  } catch (e) {
    console.error(e);
    notify('儲存失敗：' + (e?.result?.error?.message || e?.message || '未知錯誤'), 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '儲存';
  }
}

function findEmptyRow(bankKey) {
  const items = MONTH_DATA[bankKey] || [];
  const usedRows = new Set(items.map(it => it.rowIdx));
  for (let r = 4; r <= 53; r++) if (!usedRows.has(r)) return r;
  return null;
}

async function applyRowColor(bankKey, rowIdx, colorId, monthOverride) {
  const color = COLORS.find(c => c.id === colorId);
  if (!color) return;
  const month = monthOverride || CURRENT_MONTH;
  try {
    const bank = BANKS_CARDS.find(b => b.key === bankKey);
    const meta = await gapi.client.sheets.spreadsheets.get({spreadsheetId: SHEET_ID});
    const sheet = meta.result.sheets.find(s => s.properties.title === month);
    if (!sheet) return;
    const sheetId = sheet.properties.sheetId;
    const startCol = colToIdx(bank.col);
    const endCol = startCol + 4;
    const bgColor = color.hex ? hexToRgb(color.hex) : {red:1,green:1,blue:1};
    await retryWithAuth(() => gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          repeatCell: {
            range: {sheetId, startRowIndex: rowIdx-1, endRowIndex: rowIdx, startColumnIndex: startCol, endColumnIndex: endCol},
            cell: {userEnteredFormat: {backgroundColor: bgColor}},
            fields: 'userEnteredFormat.backgroundColor',
          }
        }]
      }
    }));
  } catch (e) {
    console.warn('套用底色失敗', e);
  }
}

function hexToRgb(hex) {
  const m = hex.replace('#','').match(/.{2}/g);
  if (!m) return {red:1,green:1,blue:1};
  return {red:parseInt(m[0],16)/255, green:parseInt(m[1],16)/255, blue:parseInt(m[2],16)/255};
}

async function deleteEntry() {
  if (!EDIT_TARGET) return;
  if (!confirm('確定刪除這筆記錄？')) return;
  const {bankKey, rowIdx} = EDIT_TARGET;
  const bank = BANKS_CARDS.find(b => b.key === bankKey);
  const range = `${CURRENT_MONTH}!${bank.col}${rowIdx}:${idxToCol(colToIdx(bank.col)+3)}${rowIdx}`;
  try {
    await sheetUpdate(SHEET_ID, range, [['', '', '', '']]);
    await applyRowColor(bankKey, rowIdx, 0);
    notify('已刪除', 'ok');
    closeForm();
    await loadCurrentMonth();
  } catch (e) {
    notify('刪除失敗', 'err');
    console.error(e);
  }
}

async function syncCommonFood(srcRow, date, amount, note, monthOverride) {
  const month = monthOverride || CURRENT_MONTH;
  try {
    const r = await sheetGet(SHEET_ID, `${month}!E59:G86`);
    const rows = r.result.values || [];
    let targetRow = -1;
    for (let i = 0; i < 28; i++) {
      const rr = rows[i] || [];
      if (!rr[0] && !rr[1] && !rr[2]) {
        targetRow = 59 + i;
        break;
      }
    }
    if (targetRow < 0) return;
    await sheetUpdate(SHEET_ID, `${month}!E${targetRow}:G${targetRow}`, [[date, amount, note]]);
  } catch (e) {
    console.warn('同步共同飲食失敗', e);
  }
}

// ─── 消費分析 ────────────────────────────────────────────────
function renderAnalysis() {
  // 收集所有消費（排除「其他代墊」）
  const allItems = [];
  Object.keys(MONTH_DATA).forEach(bankKey => {
    (MONTH_DATA[bankKey] || []).forEach(it => {
      if (it.category === '其他代墊') return;
      allItems.push({...it, bankKey});
    });
  });

  if (!allItems.length) {
    document.getElementById('tab-content').innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>本月還沒有資料可分析</p></div>`;
    return;
  }

  // 必須 vs 非必須
  let mustTotal = 0, notMustTotal = 0;
  const catTotals = {};
  allItems.forEach(it => {
    if (!catTotals[it.category]) catTotals[it.category] = 0;
    catTotals[it.category] += it.amount;
    const c = CATEGORIES.find(x => x.name === it.category);
    if (c?.essential) mustTotal += it.amount;
    else notMustTotal += it.amount;
  });
  const grandTotal = mustTotal + notMustTotal;

  let h = '<div class="chart-wrap">';
  h += '<div class="chart-title">必須 vs 非必須</div>';
  h += '<div class="donut-wrap"><canvas id="donut1" width="200" height="200"></canvas></div>';
  h += `<div class="legend">
    <div class="legend-item"><span class="legend-dot" style="background:#5B9BD5"></span>必須 ${fmtMoney(mustTotal)} (${pct(mustTotal,grandTotal)}%)</div>
    <div class="legend-item"><span class="legend-dot" style="background:#FF9900"></span>非必須 ${fmtMoney(notMustTotal)} (${pct(notMustTotal,grandTotal)}%)</div>
  </div>`;
  h += '</div>';

  // 各分類詳細（依舊版邏輯：淨額<=0 的分類不顯示）
  const catEntries = Object.entries(catTotals).filter(([cat,amt]) => amt > 0).sort((a,b) => b[1]-a[1]);
  h += '<div class="chart-wrap">';
  h += '<div class="chart-title">分類明細</div>';
  h += '<table>';
  h += '<tr><th>分類</th><th class="r">金額</th><th class="r">佔比</th></tr>';
  catEntries.forEach(([cat, amt]) => {
    const isEss = CATEGORIES.find(x => x.name === cat)?.essential;
    h += `<tr>
      <td>${escapeHtml(cat)} ${isEss?'<span style="color:var(--blue);font-size:10px">必須</span>':''}</td>
      <td class="r">${fmtMoney(amt)}</td>
      <td class="r dim">${pct(amt,grandTotal)}%</td>
    </tr>`;
  });
  h += `<tr><td class="bold">合計</td><td class="r bold">${fmtMoney(grandTotal)}</td><td></td></tr>`;
  h += '</table>';
  h += '<p class="dim" style="font-size:11px;margin-top:10px">※ 已排除「其他代墊」分類</p>';
  h += '</div>';

  document.getElementById('tab-content').innerHTML = h;

  // 繪製圓餅圖
  setTimeout(() => drawDonut('donut1', [
    {label:'必須', value:mustTotal, color:'#5B9BD5'},
    {label:'非必須', value:notMustTotal, color:'#FF9900'},
  ]), 50);
}

function drawDonut(id, data) {
  const c = document.getElementById(id);
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const cx = W/2, cy = H/2, r = 80, ir = 50;
  const total = data.reduce((s,d) => s+d.value, 0);
  if (total === 0) return;
  ctx.clearRect(0,0,W,H);
  let start = -Math.PI/2;
  data.forEach(d => {
    const slice = d.value/total * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start+slice);
    ctx.arc(cx, cy, ir, start+slice, start, true);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    start += slice;
  });
  // 中心文字（讀取 CSS 變數以適配主題）
  const styles = getComputedStyle(document.documentElement);
  const fgColor = styles.getPropertyValue('--fg').trim() || '#E8E9EC';
  const fg2Color = styles.getPropertyValue('--fg2').trim() || '#A8AEB6';
  ctx.fillStyle = fgColor;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmtMoney(total), cx, cy-8);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = fg2Color;
  ctx.fillText('總計', cx, cy+12);
}

// ─── 歷史趨勢 ────────────────────────────────────────────────
async function renderTrends() {
  const wrap = document.getElementById('tab-content');
  wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--fg3)"><span class="loader"></span> 計算 6 個月歷史…</div>`;
  // 取近 6 個月
  const months = (window.AVAILABLE_MONTHS || []).slice(0, 6).reverse();
  const trends = [];
  for (const m of months) {
    try {
      const r = await sheetGet(SHEET_ID, `${m}!A4:BL53`);
      const rows = r.result.values || [];
      let total = 0, must = 0, notMust = 0;
      BANKS_CARDS.forEach(b => {
        const cIdx = colToIdx(b.col);
        for (let i = 0; i < 50; i++) {
          const rr = rows[i] || [];
          const amt = parseAmount(rr[cIdx+1]);
          const cat = rr[cIdx+3];
          if (amt == null) continue;
          if (cat === '其他代墊') continue;
          total += amt;
          const c = CATEGORIES.find(x => x.name === cat);
          if (c?.essential) must += amt;
          else notMust += amt;
        }
      });
      trends.push({month: m, total, must, notMust});
    } catch (e) {
      trends.push({month: m, total: 0, must: 0, notMust: 0});
    }
  }
  let h = '<div class="chart-wrap">';
  h += '<div class="chart-title">過去 6 個月消費走勢</div>';
  h += '<canvas id="trend-chart" width="320" height="180" style="width:100%;max-width:100%"></canvas>';
  h += `<div class="legend" style="margin-top:10px">
    <div class="legend-item"><span class="legend-dot" style="background:#E57373"></span>總計</div>
    <div class="legend-item"><span class="legend-dot" style="background:#5B9BD5"></span>必須</div>
    <div class="legend-item"><span class="legend-dot" style="background:#FF9900"></span>非必須</div>
  </div>`;
  h += '</div>';

  h += '<div class="chart-wrap"><div class="chart-title">月份明細</div><table>';
  h += '<tr><th>月份</th><th class="r">總計</th><th class="r">必須</th><th class="r">非必須</th></tr>';
  trends.slice().reverse().forEach(t => {
    const [yy, mm] = t.month.split('_');
    h += `<tr>
      <td>20${yy}/${mm}</td>
      <td class="r">${fmtMoney(t.total)}</td>
      <td class="r blue">${fmtMoney(t.must)}</td>
      <td class="r orange">${fmtMoney(t.notMust)}</td>
    </tr>`;
  });
  h += '</table></div>';
  wrap.innerHTML = h;
  setTimeout(() => drawTrendLine(trends), 50);
}

function drawTrendLine(trends) {
  const c = document.getElementById('trend-chart');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const padL=40, padR=10, padT=20, padB=30;
  const w = W - padL - padR, h = H - padT - padB;
  ctx.clearRect(0,0,W,H);
  if (!trends.length) return;
  const maxV = Math.max(...trends.map(t => t.total), 1);
  const series = [
    {key:'total', color:'#E57373'},
    {key:'must', color:'#5B9BD5'},
    {key:'notMust', color:'#FF9900'},
  ];
  // 主題色
  const styles = getComputedStyle(document.documentElement);
  const fg2Color = styles.getPropertyValue('--fg2').trim() || '#A8AEB6';
  const fg3Color = styles.getPropertyValue('--fg3').trim() || '#6B7480';
  const bg3Color = styles.getPropertyValue('--bg3').trim() || '#262E36';

  // X axis labels
  ctx.fillStyle = fg2Color;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  trends.forEach((t, i) => {
    const x = padL + (i / Math.max(trends.length-1,1)) * w;
    const [yy, mm] = t.month.split('_');
    ctx.fillText(`${yy}/${mm}`, x, H - padB + 14);
  });
  // Grid lines
  ctx.strokeStyle = bg3Color;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i/4) * h;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W-padR, y);
    ctx.stroke();
    ctx.fillStyle = fg3Color;
    ctx.textAlign = 'right';
    ctx.fillText(fmtMoneyShort(maxV * (1 - i/4)), padL-4, y+3);
  }
  // Lines
  series.forEach(s => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    trends.forEach((t, i) => {
      const x = padL + (i / Math.max(trends.length-1,1)) * w;
      const y = padT + h - (t[s.key] / maxV) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Dots
    trends.forEach((t, i) => {
      const x = padL + (i / Math.max(trends.length-1,1)) * w;
      const y = padT + h - (t[s.key] / maxV) * h;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI*2);
      ctx.fill();
    });
  });
}

function fmtMoneyShort(v) {
  if (Math.abs(v) >= 10000) return Math.round(v/1000) + 'k';
  return Math.round(v).toString();
}

// ─── 工具函式 ────────────────────────────────────────────────
function fmtMoney(v) {
  v = v || 0;
  return (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString();
}
function pct(part, total) {
  if (!total) return 0;
  return Math.round(part/total*100);
}
function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function notify(msg, type='') {
  const n = document.getElementById('notify');
  n.textContent = msg;
  n.className = 'notify ' + type;
  n.classList.remove('hidden');
  clearTimeout(window._notifyT);
  window._notifyT = setTimeout(() => n.classList.add('hidden'), 2500);
}

// 選單
function openMenu() {
  // 安裝按鈕：只要不在 standalone 模式都顯示（不論是否有 _pwaPrompt）
  const installBtn = document.getElementById('menu-install-btn');
  if (installBtn) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    installBtn.style.display = isStandalone ? 'none' : '';
  }
  // 主題按鈕標籤
  const themeBtn = document.getElementById('menu-theme-btn');
  if (themeBtn) {
    const isLight = document.documentElement.classList.contains('light');
    themeBtn.innerHTML = isLight ? '🌙 切換為深色模式' : '☀ 切換為淺色模式';
  }
  document.getElementById('menu-modal').classList.remove('hidden');
}
function closeMenu() { document.getElementById('menu-modal').classList.add('hidden'); }

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  // 更新 status bar 主題色
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isLight ? '#FFFFFF' : '#534AB7');
  // 更新選單按鈕標籤
  const themeBtn = document.getElementById('menu-theme-btn');
  if (themeBtn) themeBtn.innerHTML = isLight ? '🌙 切換為深色模式' : '☀ 切換為淺色模式';
  // 重新繪圖表（圖表用 canvas，需重畫才會吃到新色）
  if (CURRENT_TAB === 'analysis' || CURRENT_TAB === 'trends') {
    setTimeout(() => renderTab(), 100);
  }
}

async function reloadAll() {
  await loadCategories();
  await detectAvailableMonths();
  populateMonthSelector();
  populateCategorySelector();
  await loadCurrentMonth();
  notify('✓ 已重新載入', 'ok');
}

// ─── PWA 安裝提示 ────────────────────────────────────────────
// beforeinstallprompt 已在 index.html <head> 最早捕捉，存在 window._pwaPrompt

// App 載入完成後，定義 _showPwaBanner 並觸發（如果事件已捕捉到）
window._showPwaBanner = function() {
  if (localStorage.getItem('pwa-banner-dismissed')) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  setTimeout(() => {
    const banner = document.getElementById('pwa-banner');
    if (banner) banner.classList.remove('hidden');
  }, 1500);
};

// 標記 app 已就緒，若事件已提前捕捉就立刻顯示
window._pwaReady = true;
if (window._pwaPrompt) {
  window._showPwaBanner();
}

function triggerInstall() {
  const prompt = window._pwaPrompt;
  if (!prompt) return;
  prompt.prompt();
  prompt.userChoice.then(r => {
    window._pwaPrompt = null;
    document.getElementById('pwa-banner')?.classList.add('hidden');
    if (r.outcome === 'accepted') notify('✓ App 已安裝！', 'ok');
  });
}

// 點選單裡的安裝按鈕：能用 prompt 就用，不能就顯示手動步驟
function handleInstallClick() {
  if (window._pwaPrompt) {
    triggerInstall();
    return;
  }
  // 沒有 prompt 可用 → 顯示手動安裝指引
  showManualInstallGuide();
}

function showManualInstallGuide() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isSamsung = /samsungbrowser/i.test(ua);
  const isFirefox = /firefox/i.test(ua);

  let html = '';
  if (isIOS) {
    html = `
      <div class="setup-info" style="margin-top:0">
        <p style="margin-bottom:10px">📱 <b>iPhone / iPad（Safari）</b></p>
        <div class="ios-steps">
          <div class="ios-step"><div class="ios-step-num">1</div><span>點下方 <b style="color:#6B5FE0">分享</b> 按鈕（方塊+箭頭）</span></div>
          <div class="ios-step" style="margin-top:8px"><div class="ios-step-num">2</div><span>選 <b style="color:#6B5FE0">「加入主畫面」</b></span></div>
          <div class="ios-step" style="margin-top:8px"><div class="ios-step-num">3</div><span>點右上角 <b style="color:#6B5FE0">「新增」</b></span></div>
        </div>
      </div>`;
  } else if (isFirefox) {
    html = `
      <div class="setup-info" style="margin-top:0">
        <p style="margin-bottom:10px">🦊 <b>Firefox</b></p>
        <div class="ios-steps">
          <div class="ios-step"><div class="ios-step-num">1</div><span>點右上角 <b style="color:#6B5FE0">⋮</b> 選單</span></div>
          <div class="ios-step" style="margin-top:8px"><div class="ios-step-num">2</div><span>選 <b style="color:#6B5FE0">「安裝」</b> 或 <b style="color:#6B5FE0">「加到主畫面」</b></span></div>
        </div>
      </div>`;
  } else if (isSamsung) {
    html = `
      <div class="setup-info" style="margin-top:0">
        <p style="margin-bottom:10px">📱 <b>Samsung Internet</b></p>
        <div class="ios-steps">
          <div class="ios-step"><div class="ios-step-num">1</div><span>點下方 <b style="color:#6B5FE0">≡</b> 選單</span></div>
          <div class="ios-step" style="margin-top:8px"><div class="ios-step-num">2</div><span>選 <b style="color:#6B5FE0">「將頁面新增至」</b> → <b style="color:#6B5FE0">「主畫面」</b></span></div>
        </div>
      </div>`;
  } else if (isAndroid) {
    html = `
      <div class="setup-info" style="margin-top:0">
        <p style="margin-bottom:10px">🤖 <b>Android Chrome</b></p>
        <div class="ios-steps">
          <div class="ios-step"><div class="ios-step-num">1</div><span>點 Chrome 右上角 <b style="color:#6B5FE0">⋮</b> 三點選單</span></div>
          <div class="ios-step" style="margin-top:8px"><div class="ios-step-num">2</div><span>找 <b style="color:#6B5FE0">「安裝應用程式」</b> 或 <b style="color:#6B5FE0">「新增至主畫面」</b></span></div>
          <div class="ios-step" style="margin-top:8px"><div class="ios-step-num">3</div><span>點 <b style="color:#6B5FE0">「安裝」</b> 完成</span></div>
        </div>
        <p style="margin-top:12px;font-size:11px;color:var(--fg3)">💡 找不到選項時：在頁面停留 30 秒以上、捲動互動後再試一次</p>
      </div>`;
  } else {
    html = `
      <div class="setup-info" style="margin-top:0">
        <p style="margin-bottom:10px">💻 <b>桌面瀏覽器</b></p>
        <div class="ios-steps">
          <div class="ios-step"><div class="ios-step-num">1</div><span>網址列右側應有 <b style="color:#6B5FE0">⊕</b> 安裝圖示</span></div>
          <div class="ios-step" style="margin-top:8px"><div class="ios-step-num">2</div><span>或從瀏覽器選單找「安裝」選項</span></div>
        </div>
      </div>`;
  }

  document.getElementById('install-guide-content').innerHTML = html;
  document.getElementById('install-guide-modal').classList.remove('hidden');
}

function closeInstallGuide() {
  document.getElementById('install-guide-modal').classList.add('hidden');
}

function dismissBanner() {
  document.getElementById('pwa-banner')?.classList.add('hidden');
  localStorage.setItem('pwa-banner-dismissed', '1');
}

function dismissIosGuide() {
  document.getElementById('ios-guide')?.classList.add('hidden');
  localStorage.setItem('ios-guide-dismissed', '1');
}

// 偵測 iOS 且非 standalone 模式 → 顯示安裝引導
(function checkIOSInstall() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const isStandaloneMQ = window.matchMedia('(display-mode: standalone)').matches;
  const dismissed = localStorage.getItem('ios-guide-dismissed');
  if (isIOS && !isStandalone && !isStandaloneMQ && !dismissed) {
    setTimeout(() => {
      document.getElementById('ios-guide')?.classList.remove('hidden');
    }, 3000);
  }
})();
