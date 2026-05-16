// ─────────────────────────────────────────────────────────────
// 信用卡記帳 PWA - 主邏輯
// ─────────────────────────────────────────────────────────────

const CLIENT_ID = '144262693536-poq7p69eo0aqr3r0onjafrd2f1rfrmg3.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const APP_VERSION = 'v2.0';

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

// 銀行群組設定：bankKey → 預設卡 cardKey（給記帳表單用）
const BANK_DEFAULT_CARD = {
  cash: 'cash',
  fb:   'fb_5389',  // 預設好市多
  es:   'es_2649',  // 預設 Unicard
  ub:   'ub_9207',  // 預設 Line Bank
  cu:   'cu_3568',
  tx:   'tx_0106',
  sf:   'sf_2207',
  cb:   'cb_2108',
  cc:   'cc_3568',
};

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

// 消費分析分類顏色
const ESS_COLORS  = ['#534AB7','#7F77DD','#AFA9EC','#185FA5','#378ADD','#85B7EB','#B5D4F4','#3C3489'];
const NESS_COLORS = ['#D85A30','#EF9F27','#BA7517','#993556','#D4537E','#F09595','#FAC775','#F5C4B3'];

// 全域狀態
let SHEET_ID = '';
let TOKEN = null;
let CURRENT_USER = null;
let CURRENT_MONTH = ''; // 'YY_MM'
let CURRENT_TAB = 'add'; // 預設進記帳 tab
let MONTH_DATA = {}; // {cardKey: [{rowIdx, date, amount, note, category, installment}]}
let BANK_DATA = {};  // {bankKey: {total, rebate, install, paid, accBalRaw, accBal, net, pending, isPaidCheck}}
let EDIT_TARGET = null; // {bankKey(=cardKey), rowIdx} for editing
let HISTORY_DATA = null; // 6 個月歷史

// 載入狀態追蹤
let MONTH_LOADED_FOR = ''; // 已載入完成的月份 key（避免重複載）
let LOADING_MONTH = false; // 正在載入中
let MONTH_DATA_IS_STALE = false; // 當前 MONTH_DATA 來自快取（背景刷新中）

// 圖表實例（切換主題前先 destroy）
let pieChartInstance = null;
let trendChartInstance = null;
let TREND_CACHE = null;        // 趨勢資料快取（避免切月份重複抓）
let currentAnalysisTab = 0;    // 0=消費分析, 1=歷史趨勢

// ─── 快取系統 ────────────────────────────────────────────────
// 統一的 localStorage 快取，支援 TTL（-1 = 永久）
function cacheGet(key) {
  try {
    const raw = localStorage.getItem('cache-' + key);
    if (!raw) return null;
    const { ts, ttl, data } = JSON.parse(raw);
    if (ttl !== -1 && Date.now() - ts > ttl) return null;
    return data;
  } catch { return null; }
}
function cacheSet(key, data, ttlMs) {
  try {
    localStorage.setItem('cache-' + key, JSON.stringify({
      ts: Date.now(),
      ttl: ttlMs === Infinity ? -1 : (ttlMs || -1),
      data,
    }));
  } catch (e) { console.warn('快取寫入失敗', e); }
}
function cacheRemove(key) {
  try { localStorage.removeItem('cache-' + key); } catch {}
}

const CACHE_TTL = {
  categories: Infinity,        // 分類永久
  months: 24 * 60 * 60 * 1000, // 月份清單 24h
  monthData: 7 * 24 * 60 * 60 * 1000, // 月份資料 7 天（SWR：用過期的先顯示，背景再更新）
};

function todayYYMM() {
  const d = new Date();
  return `${String(d.getFullYear()).slice(2)}_${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── 初始化 ──────────────────────────────────────────────────
// OAuth 設定（Authorization Code flow + Cloudflare Worker）
const AUTH_WORKER = 'https://credit-pwa-auth.tp6vupu04.workers.dev';
const OAUTH_REDIRECT = 'https://xin-yu-1122.github.io/credit-pwa-new/oauth-callback.html';

let GAPI_READY = false;
let _authPopup = null;

// Splash 超時保護：12 秒沒載完就顯示錯誤訊息與重試按鈕
setTimeout(() => {
  if (!GAPI_READY) {
    const msg = document.getElementById('splash-msg');
    const retry = document.getElementById('splash-retry');
    if (msg) msg.innerHTML = `Google API 載入失敗<br><span style="font-size:11px;opacity:.7">GAPI:${GAPI_READY?'✓':'✗'}</span>`;
    if (retry) retry.classList.remove('hidden');
  }
}, 12000);

function checkReady() {
  if (GAPI_READY) {
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

  // 接收 OAuth popup 傳回的訊息
  window.addEventListener('message', handleOAuthMessage);
});

function boot() {
  // 載入儲存的設定
  SHEET_ID = localStorage.getItem('credit-sheet-id') || '';
  const accessToken = localStorage.getItem('credit-access-token');
  const accessExpiry = parseInt(localStorage.getItem('credit-access-expiry') || '0');
  const refreshTok = localStorage.getItem('credit-refresh-token');

  if (accessToken && Date.now() < accessExpiry) {
    // access token 還有效，直接用
    TOKEN = accessToken;
    gapi.client.setToken({access_token: TOKEN});
    enterApp();
  } else if (refreshTok) {
    // access token 過期，但有 refresh token → 自動續期（永久免登入的關鍵）
    refreshAccessToken().then(() => {
      enterApp();
    }).catch((e) => {
      console.warn('自動續期失敗，需重新登入', e);
      // refresh token 失效（極少發生）才需要重新登入
      clearTokens();
      showLogin();
    });
  } else {
    // 完全沒有憑證 → 首次登入
    showLogin();
  }
}

function enterApp() {
  if (SHEET_ID) {
    showApp();
    initApp();
  } else {
    showSetup();
  }
}

// ─── OAuth：Authorization Code flow ─────────────────────────
// 第一步：開 popup 讓使用者選帳號授權
function signIn() {
  document.getElementById('login-error').classList.add('hidden');
  const state = Math.random().toString(36).slice(2);
  sessionStorage.setItem('oauth-state', state);

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',     // 要 refresh token 必須
    prompt: 'consent',          // 確保每次都拿得到 refresh token
    state: state,
  }).toString();

  // 開 popup
  const w = 480, h = 640;
  const left = (screen.width - w) / 2;
  const top = (screen.height - h) / 2;
  _authPopup = window.open(authUrl, 'google-oauth', `width=${w},height=${h},left=${left},top=${top}`);

  if (!_authPopup) {
    showLoginError('彈出視窗被阻擋，請允許此網站開啟彈出視窗後重試');
  }
}

// 第二步：popup 透過 postMessage 把授權碼傳回來
async function handleOAuthMessage(event) {
  // 安全檢查：只接受來自自己網域的訊息
  if (event.origin !== 'https://xin-yu-1122.github.io') return;
  const data = event.data;
  if (!data || data.source !== 'credit-pwa-oauth') return;

  if (_authPopup) { try { _authPopup.close(); } catch(e){} _authPopup = null; }

  if (!data.ok) {
    showLoginError(`登入失敗：${data.error || '未知錯誤'}`);
    return;
  }

  // 驗證 state 防 CSRF
  const savedState = sessionStorage.getItem('oauth-state');
  if (data.state && savedState && data.state !== savedState) {
    showLoginError('登入驗證失敗（state 不符），請重試');
    return;
  }
  sessionStorage.removeItem('oauth-state');

  // 第三步：把授權碼送去 Worker 換 token
  try {
    showLoginLoading('登入中，正在取得授權…');
    const resp = await fetch(`${AUTH_WORKER}/exchange`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({code: data.code, redirect_uri: OAUTH_REDIRECT}),
    });
    const tok = await resp.json();
    if (tok.error || !tok.access_token) {
      throw new Error(tok.error_description || tok.error || '換取 token 失敗');
    }
    saveTokens(tok);
    gapi.client.setToken({access_token: TOKEN});
    enterApp();
  } catch (e) {
    console.error('OAuth exchange 失敗', e);
    showLoginError('登入失敗：' + (e.message || e));
  }
}

// 儲存 token：access token + refresh token
function saveTokens(tok) {
  TOKEN = tok.access_token;
  const expiry = Date.now() + (tok.expires_in || 3600) * 1000 - 300000; // 提前 5 分鐘
  localStorage.setItem('credit-access-token', TOKEN);
  localStorage.setItem('credit-access-expiry', expiry.toString());
  // refresh token 只有初次授權會給，續期時不會再給 → 有才存
  if (tok.refresh_token) {
    localStorage.setItem('credit-refresh-token', tok.refresh_token);
  }
}

function clearTokens() {
  TOKEN = null;
  localStorage.removeItem('credit-access-token');
  localStorage.removeItem('credit-access-expiry');
  localStorage.removeItem('credit-refresh-token');
}

// 用 refresh token 換新的 access token（透過 Worker）
async function refreshAccessToken() {
  const refreshTok = localStorage.getItem('credit-refresh-token');
  if (!refreshTok) throw new Error('無 refresh token');
  const resp = await fetch(`${AUTH_WORKER}/refresh`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({refresh_token: refreshTok}),
  });
  const tok = await resp.json();
  if (tok.error || !tok.access_token) {
    throw new Error(tok.error_description || tok.error || 'refresh 失敗');
  }
  saveTokens(tok);
  gapi.client.setToken({access_token: TOKEN});
}

function signOut() {
  clearTokens();
  showLogin();
}

// ─── 畫面切換 ────────────────────────────────────────────────
function showLogin() {
  hideAll();
  document.getElementById('login-screen').classList.remove('hidden');
  // 還原登入按鈕狀態
  const btn = document.getElementById('login-btn');
  if (btn) { btn.disabled = false; btn.textContent = '使用 Google 帳號登入'; }
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
  const btn = document.getElementById('login-btn');
  if (btn) { btn.disabled = false; btn.textContent = '使用 Google 帳號登入'; }
}
function showLoginLoading(msg) {
  const btn = document.getElementById('login-btn');
  if (btn) { btn.disabled = true; btn.textContent = msg; }
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
// 登入後第一時間進入 App：不等任何 API，直接顯示記帳 tab
async function initApp() {
  // 1) 預設月份 = 今天
  CURRENT_MONTH = todayYYMM();
  CURRENT_TAB = 'add';

  // 2) 從快取讀分類；沒快取就用程式內預設（CATEGORIES 已有預設值）
  const cachedCats = cacheGet('categories');
  if (cachedCats && cachedCats.length) CATEGORIES = cachedCats;

  // 3) 月份清單：從快取讀；沒快取就用最近 6 個月當 fallback
  const cachedMonths = cacheGet('months');
  window.AVAILABLE_MONTHS = (cachedMonths && cachedMonths.length) ? cachedMonths : defaultMonthsList();

  // 4) 立刻渲染上方月份下拉、記帳 tab
  populateMonthSelector();
  switchTab('add');

  // 5) 背景刷新（不阻塞）：去抓真實的分類 + 月份清單
  refreshCategoriesBg();
  refreshMonthsBg();

  // 6) 背景預抓當月資料（不阻塞），方便切到儀表板時瞬間顯示
  prefetchCurrentMonth();
}

// 預設月份清單：最近 6 個月（用於還沒拿到試算表清單時的 fallback）
function defaultMonthsList() {
  const list = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    list.push(`${yy}_${mm}`);
  }
  return list;
}

// 背景刷新分類（不阻塞 UI）
async function refreshCategoriesBg() {
  try {
    const r = await sheetGet(SHEET_ID, '帳務類型!A2:C100');
    const rows = r.result.values || [];
    if (!rows.length) return;
    const cats = [];
    rows.forEach(row => {
      const name = (row[0] || '').trim();
      if (!name) return;
      const must = !!(row[1] && row[1].trim());
      cats.push({ name, essential: must });
    });
    if (cats.length) {
      CATEGORIES = cats;
      cacheSet('categories', cats, CACHE_TTL.categories);
      // 若記帳 tab 在前景，更新分類下拉
      if (CURRENT_TAB === 'add') updateAddCategoryOptions();
    }
  } catch (e) {
    console.warn('刷新分類失敗（用快取/預設）', e);
  }
}

// 背景刷新月份清單
async function refreshMonthsBg() {
  try {
    const r = await retryWithAuth(() => gapi.client.sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets.properties.title',
    }));
    const sheets = r.result.sheets || [];
    const months = [];
    sheets.forEach(s => {
      const t = s.properties.title;
      if (/^\d{2}_\d{2}$/.test(t)) months.push(t);
    });
    months.sort().reverse();
    window.AVAILABLE_MONTHS = months;
    cacheSet('months', months, CACHE_TTL.months);
    // 若上方月份下拉/記帳 tab 在用，更新它
    populateMonthSelector();
    if (CURRENT_TAB === 'add') updateAddMonthOptions();
  } catch (e) {
    console.warn('刷新月份清單失敗（用快取/預設）', e);
  }
}

// 背景預抓當月資料：寫進快取，使用者切到儀表板時可瞬間顯示
async function prefetchCurrentMonth() {
  const monthKey = CURRENT_MONTH;
  // 已有快取就跳過（除非太舊，但 SWR 流程自己會處理）
  const cached = cacheGet(`month-${monthKey}`);
  if (cached) return;
  try {
    await fetchAndParseMonth(monthKey);
  } catch (e) {
    // 預抓失敗無所謂（使用者切過去時再試）
    console.warn('預抓當月失敗', e);
  }
}

// 取得分類（給記帳表單下拉用）— 一律從 CATEGORIES（已含快取/預設 fallback）
function getCategoriesForForm() {
  return CATEGORIES || [];
}

function populateMonthSelector() {
  const months = window.AVAILABLE_MONTHS || defaultMonthsList();
  const items = months.map(m => {
    const [yy, mm] = m.split('_');
    return {value: m, label: `20${yy}/${mm}`};
  });
  csInit('cs-month-wrap', items, CURRENT_MONTH, async (newVal) => {
    if (newVal === CURRENT_MONTH) return;
    CURRENT_MONTH = newVal;
    MONTH_LOADED_FOR = ''; // 強制下次切到儀表板/分析時重抓
    // 只有目前在儀表板/分析才立刻載入；在記帳 tab 則延後
    if (CURRENT_TAB === 'dashboard' || CURRENT_TAB === 'analysis') {
      await loadCurrentMonth();
    }
    // 同步更新記帳表單的月份預設（如果在記帳 tab）
    if (CURRENT_TAB === 'add') {
      const sel = document.getElementById('f2-month');
      if (sel) sel.value = newVal;
    }
  });
}

// ─── Custom Select 工具 ──────────────────────────────────────
function csInit(wrapId, items, currentValue, onChange) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap._items = items;
  wrap._onChange = onChange;
  csSetValue(wrapId, currentValue);
  // 渲染選項列表
  const panel = wrap.querySelector('.cs-panel');
  panel.innerHTML = items.map(it =>
    `<div class="cs-opt ${it.value===currentValue?'selected':''}" data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}</div>`
  ).join('');
  panel.querySelectorAll('.cs-opt').forEach(opt => {
    opt.onclick = () => {
      const v = opt.dataset.value;
      csSetValue(wrapId, v);
      panel.querySelectorAll('.cs-opt').forEach(o => o.classList.toggle('selected', o.dataset.value === v));
      wrap.classList.remove('open');
      if (wrap._onChange) wrap._onChange(v);
    };
  });
}

function csSetValue(wrapId, value) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap._value = value;
  const items = wrap._items || [];
  const found = items.find(i => i.value === value);
  // 找到對應的 label 元素
  const labelEl = wrap.querySelector('.cs-trigger span') || wrap.querySelector('.cs-trigger');
  if (labelEl && found) labelEl.textContent = found.label;
}

function csGetValue(wrapId) {
  return document.getElementById(wrapId)?._value;
}

function csToggle(wrapId) {
  // 先關掉所有其他下拉
  document.querySelectorAll('.cs-wrap.open').forEach(w => {
    if (w.id !== wrapId) w.classList.remove('open');
  });
  document.getElementById(wrapId)?.classList.toggle('open');
}

// 點擊外部關閉所有 cs-wrap
document.addEventListener('click', (e) => {
  if (!e.target.closest('.cs-wrap')) {
    document.querySelectorAll('.cs-wrap.open').forEach(w => w.classList.remove('open'));
  }
});

function populateBankSelector() {
  // 銀行群組（9 個）
  const sel = document.getElementById('f-bankgroup');
  sel.innerHTML = '<option value="">— 請選擇 —</option>' +
    BANKS.map(b => `<option value="${b.key}">${b.name}</option>`).join('');
}

// 切換銀行 → 自動帶卡別下拉（單卡銀行直接隱藏）
function onBankGroupChange() {
  const bankKey = document.getElementById('f-bankgroup').value;
  const cardField = document.getElementById('f-card-field');
  const cardSel = document.getElementById('f-card');
  if (!bankKey) {
    cardField.classList.add('hidden');
    cardSel.innerHTML = '';
    return;
  }
  const cards = BANKS_CARDS.filter(c => c.bankKey === bankKey);
  if (cards.length <= 1) {
    // 單卡銀行：隱藏卡別下拉，內部維持唯一一張
    cardField.classList.add('hidden');
    cardSel.innerHTML = `<option value="${cards[0]?.key || ''}">${cards[0]?.name || ''}</option>`;
    cardSel.value = cards[0]?.key || '';
  } else {
    // 多卡銀行：顯示卡別下拉，套用預設
    cardField.classList.remove('hidden');
    cardSel.innerHTML = cards.map(c =>
      `<option value="${c.key}">${c.name}${c.tag?` (${c.tag})`:''}</option>`
    ).join('');
    const def = BANK_DEFAULT_CARD[bankKey] || cards[0]?.key;
    cardSel.value = def;
  }
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

// 載入當月資料：SWR 策略（先用快取顯示，背景刷新）
async function loadCurrentMonth() {
  const monthKey = CURRENT_MONTH;
  // 先看快取
  const cached = cacheGet(`month-${monthKey}`);
  if (cached && cached.MONTH_DATA && cached.BANK_DATA) {
    MONTH_DATA = cached.MONTH_DATA;
    BANK_DATA = cached.BANK_DATA;
    MONTH_LOADED_FOR = monthKey;
    MONTH_DATA_IS_STALE = true;
    renderTab(); // 立刻渲染快取資料
    // 背景靜默刷新
    fetchAndParseMonth(monthKey).then(() => {
      // 若使用者還在這個月份，重新渲染
      if (CURRENT_MONTH === monthKey) {
        MONTH_DATA_IS_STALE = false;
        if (CURRENT_TAB === 'dashboard' || CURRENT_TAB === 'analysis') renderTab();
      }
    }).catch(e => console.warn('背景刷新月份失敗', e));
    return;
  }

  // 沒快取 → 顯示 skeleton 載入
  showSkeleton();
  try {
    await fetchAndParseMonth(monthKey);
    MONTH_LOADED_FOR = monthKey;
    MONTH_DATA_IS_STALE = false;
    renderTab();
  } catch (e) {
    handleMonthLoadError(e, monthKey);
  }
}

// 實際打 API 並 parse 資料 + 寫入快取
async function fetchAndParseMonth(monthKey) {
  if (LOADING_MONTH) return; // 避免並發
  LOADING_MONTH = true;
  try {
    // 用 spreadsheets.get with grid data，一次抓「值」+「背景色」
    const r = await retryWithAuth(() => gapi.client.sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      ranges: [`${monthKey}!A4:BL57`],
      fields: 'sheets.data.rowData.values(formattedValue,effectiveValue,effectiveFormat.backgroundColor)',
    }));
    const sheetData = r.result.sheets?.[0]?.data?.[0];
    const rowDataArr = sheetData?.rowData || [];

    // 解析成 [54 列][64 欄] 的 values 與 backgrounds
    const rows = [];
    const bgs = [];
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
    // 寫入快取
    if (CURRENT_MONTH === monthKey) {
      cacheSet(`month-${monthKey}`, {
        MONTH_DATA,
        BANK_DATA,
      }, CACHE_TTL.monthData);
    } else {
      // 預抓的情況：把資料 parse 後直接存進快取，不影響當前 state
      const tmpMD = JSON.parse(JSON.stringify(MONTH_DATA));
      const tmpBD = JSON.parse(JSON.stringify(BANK_DATA));
      cacheSet(`month-${monthKey}`, { MONTH_DATA: tmpMD, BANK_DATA: tmpBD }, CACHE_TTL.monthData);
    }
  } finally {
    LOADING_MONTH = false;
  }
}

function handleMonthLoadError(e, monthKey) {
  console.error('載入月份失敗', e);
  const el = document.getElementById('tab-content');
  if (!el) return;
  if (e?.status === 404 || (e?.result?.error?.code === 400)) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>找不到 ${monthKey} 月份分頁<br><br>請先在試算表建立此月份分頁</p><button class="btn btn-primary" style="margin-top:14px" onclick="openSheet()">前往試算表</button></div>`;
  } else {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><p>載入失敗<br><span class="dim">${e?.result?.error?.message || e?.message || e}</span></p></div>`;
  }
}

// Skeleton 載入畫面（含已等待秒數）
let _skeletonTimer = null;
function showSkeleton() {
  const el = document.getElementById('tab-content');
  if (!el) return;
  const startTs = Date.now();
  el.innerHTML = `
    <div class="sk-kpi-grid">
      <div class="skeleton sk-kpi"></div>
      <div class="skeleton sk-kpi"></div>
      <div class="skeleton sk-kpi"></div>
      <div class="skeleton sk-kpi"></div>
      <div class="skeleton sk-kpi"></div>
      <div class="skeleton sk-kpi"></div>
    </div>
    <div class="skeleton sk-bank"></div>
    <div class="skeleton sk-bank"></div>
    <div class="loading-elapsed" id="loading-elapsed">載入中… 0.0s</div>
  `;
  if (_skeletonTimer) clearInterval(_skeletonTimer);
  _skeletonTimer = setInterval(() => {
    const lbl = document.getElementById('loading-elapsed');
    if (!lbl) { clearInterval(_skeletonTimer); _skeletonTimer = null; return; }
    const s = ((Date.now() - startTs) / 1000).toFixed(1);
    lbl.textContent = `載入中… ${s}s`;
  }, 100);
}
function hideSkeleton() {
  if (_skeletonTimer) { clearInterval(_skeletonTimer); _skeletonTimer = null; }
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
      // access token 過期 → 用 refresh token 自動續期
      try {
        await refreshAccessToken();
        return await fn();
      } catch (e2) {
        // refresh token 也失效（極少）→ 才需要重新登入
        clearTokens();
        showLogin();
        throw e2;
      }
    }
    throw e;
  }
}

// ─── 標籤切換 ────────────────────────────────────────────────
async function switchTab(tab) {
  CURRENT_TAB = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  // 記帳 tab → 直接渲染表單（不需要試算表資料）
  if (tab === 'add') {
    hideSkeleton();
    renderAddTab();
    return;
  }

  // 儀表板 / 消費分析 → 需要月份資料
  if (tab === 'dashboard' || tab === 'analysis') {
    // 已載入過當月 → 直接渲染
    if (MONTH_LOADED_FOR === CURRENT_MONTH && Object.keys(MONTH_DATA).length) {
      renderTab();
      return;
    }
    // 否則啟動 SWR 載入流程
    await loadCurrentMonth();
  }
}

function renderTab() {
  hideSkeleton();
  if (CURRENT_TAB === 'add') renderAddTab();
  else if (CURRENT_TAB === 'dashboard') renderDashboard();
  else if (CURRENT_TAB === 'analysis') renderAnalysis();
}

// ─── 記帳 Tab（inline 表單）──────────────────────────────────
// 這個表單獨立於 modal 編輯表單，使用 f2-* 前綴的元素 id
function renderAddTab() {
  const el = document.getElementById('tab-content');
  if (!el) return;
  const cats = getCategoriesForForm();
  const months = window.AVAILABLE_MONTHS || defaultMonthsList();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const monthDefault = todayYYMM();

  el.innerHTML = `
    <div class="card" style="padding:18px 16px;margin-bottom:12px">
      <div style="font-size:15px;font-weight:600;color:var(--fg1);margin-bottom:14px">✏️ 新增記帳</div>

      <div class="field">
        <label>月份分頁</label>
        <select class="inp" id="f2-month"></select>
      </div>

      <div class="field">
        <label>記帳項目（銀行）</label>
        <select class="inp" id="f2-bankgroup" onchange="onBankGroupChange2()">
          <option value="">— 請選擇 —</option>
          ${BANKS.map(b => `<option value="${b.key}">${b.name}</option>`).join('')}
        </select>
      </div>

      <div class="field hidden" id="f2-card-field">
        <label>卡別</label>
        <select class="inp" id="f2-card"></select>
      </div>

      <div class="field">
        <label>日期</label>
        <input class="inp" id="f2-date" type="date" value="${todayStr}"/>
      </div>

      <div class="field">
        <label>金額（負數=刷退）</label>
        <input class="inp" id="f2-amt" type="number" step="1" placeholder="例：350 或 -100" inputmode="numeric"/>
      </div>

      <div class="field">
        <label>備註 / 帳務資訊</label>
        <textarea class="inp" id="f2-note" placeholder="例：全家便利商店、午餐"></textarea>
      </div>

      <div class="field">
        <label>分類</label>
        <select class="inp" id="f2-cat">
          ${cats.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label>底色</label>
        <div class="color-grid" id="f2-colors"></div>
      </div>

      <div class="field">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="f2-installment" onchange="onInstallmentChange2()" style="accent-color:var(--orange)"/>
          <span>分期付款（自動加 [分期] + 橘色底）</span>
        </label>
      </div>

      <div class="btn-row" style="margin-top:18px">
        <button class="btn btn-ghost" onclick="resetAddForm()">清除</button>
        <button class="btn btn-primary" id="f2-save" onclick="saveAddEntry()">儲存</button>
      </div>
    </div>
  `;

  // 填入月份下拉、預設今天
  updateAddMonthOptions();
  document.getElementById('f2-month').value = monthDefault;

  // 渲染色卡
  renderAddColorPicker();
  selectColor2(0);
}

function updateAddMonthOptions() {
  const sel = document.getElementById('f2-month');
  if (!sel) return;
  const months = window.AVAILABLE_MONTHS || defaultMonthsList();
  const current = sel.value || todayYYMM();
  sel.innerHTML = months.map(m => {
    const [yy, mm] = m.split('_');
    return `<option value="${m}">20${yy}/${mm}</option>`;
  }).join('');
  // 確保預設值在清單裡（不在就硬加進去）
  if (current && !months.includes(current)) {
    const [yy, mm] = current.split('_');
    sel.innerHTML = `<option value="${current}">20${yy}/${mm}（待建立）</option>` + sel.innerHTML;
  }
  sel.value = current;
}

function updateAddCategoryOptions() {
  const sel = document.getElementById('f2-cat');
  if (!sel) return;
  const current = sel.value;
  const cats = getCategoriesForForm();
  sel.innerHTML = cats.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  if (current) sel.value = current;
}

function renderAddColorPicker() {
  const wrap = document.getElementById('f2-colors');
  if (!wrap) return;
  wrap.innerHTML = COLORS.map(c => {
    const bg = c.hex || 'transparent';
    const border = c.hex ? c.hex : 'var(--bg4)';
    const inner = c.hex ? '' : `<span style="font-size:10px;color:var(--fg3)">無</span>`;
    return `<div class="color-opt" data-color="${c.id}" onclick="selectColor2(${c.id})" style="background:${bg};border-color:${border};display:flex;align-items:center;justify-content:center" title="${c.name}">${inner}</div>`;
  }).join('');
}

let SELECTED_COLOR_2 = 0;
function selectColor2(id) {
  SELECTED_COLOR_2 = id;
  document.querySelectorAll('#f2-colors .color-opt').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.color) === id);
  });
}

function onBankGroupChange2() {
  const bankKey = document.getElementById('f2-bankgroup').value;
  const cardField = document.getElementById('f2-card-field');
  const cardSel = document.getElementById('f2-card');
  if (!bankKey) {
    cardField.classList.add('hidden');
    cardSel.innerHTML = '';
    return;
  }
  const cards = BANKS_CARDS.filter(c => c.bankKey === bankKey);
  if (cards.length <= 1) {
    cardField.classList.add('hidden');
    cardSel.innerHTML = `<option value="${cards[0]?.key || ''}">${cards[0]?.name || ''}</option>`;
    cardSel.value = cards[0]?.key || '';
  } else {
    cardField.classList.remove('hidden');
    cardSel.innerHTML = cards.map(c =>
      `<option value="${c.key}">${c.name}${c.tag?` (${c.tag})`:''}</option>`
    ).join('');
    const def = BANK_DEFAULT_CARD[bankKey] || cards[0]?.key;
    cardSel.value = def;
  }
}

function onInstallmentChange2() {
  const chk = document.getElementById('f2-installment').checked;
  if (chk) selectColor2(2); // 橘色
  else selectColor2(0);
}

function resetAddForm() {
  // 清空欄位、回到預設
  renderAddTab();
}

// 月份分頁不存在 modal
function openSheetNE(monthKey) {
  document.getElementById('sne-month-label').textContent = monthKey;
  document.getElementById('sheet-ne-modal').classList.remove('hidden');
}
function closeSheetNE() {
  document.getElementById('sheet-ne-modal').classList.add('hidden');
}

// 檢查目標月份是否存在試算表中（用快取的 AVAILABLE_MONTHS 做快速檢查；如果沒在快取就實際打 API 確認）
async function ensureMonthSheetExists(monthKey) {
  const months = window.AVAILABLE_MONTHS || [];
  if (months.includes(monthKey)) return true;
  // 快取沒有 → 再去抓最新清單確認
  try {
    const r = await retryWithAuth(() => gapi.client.sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets.properties.title',
    }));
    const sheets = r.result.sheets || [];
    const real = [];
    sheets.forEach(s => {
      const t = s.properties.title;
      if (/^\d{2}_\d{2}$/.test(t)) real.push(t);
    });
    real.sort().reverse();
    window.AVAILABLE_MONTHS = real;
    cacheSet('months', real, CACHE_TTL.months);
    return real.includes(monthKey);
  } catch (e) {
    console.warn('檢查月份分頁失敗', e);
    return false;
  }
}

// 從 inline 表單存記帳
async function saveAddEntry() {
  const bankKey = document.getElementById('f2-card').value;
  if (!bankKey) return notify('請選擇記帳項目', 'err');
  const targetMonth = document.getElementById('f2-month').value || todayYYMM();
  const dateRaw = document.getElementById('f2-date').value;
  if (!dateRaw) return notify('請選擇日期', 'err');
  const amt = document.getElementById('f2-amt').value;
  if (!amt) return notify('請輸入金額', 'err');
  let note = document.getElementById('f2-note').value.trim();
  const category = document.getElementById('f2-cat').value;
  const installment = document.getElementById('f2-installment').checked;

  const btn = document.getElementById('f2-save');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> 儲存中…';

  try {
    // 1) 先確認月份分頁存在
    const exists = await ensureMonthSheetExists(targetMonth);
    if (!exists) {
      openSheetNE(targetMonth);
      return;
    }

    // 2) 找空 row → 需要當月資料；若快取沒有則先抓
    let rowIdx = null;
    const cached = cacheGet(`month-${targetMonth}`);
    if (cached && cached.MONTH_DATA && cached.MONTH_DATA[bankKey]) {
      const usedRows = new Set(cached.MONTH_DATA[bankKey].map(it => it.rowIdx));
      for (let r = 4; r <= 53; r++) if (!usedRows.has(r)) { rowIdx = r; break; }
    }
    if (!rowIdx) {
      // 沒有快取 → 直接打 API 抓目標月份該卡的欄位看是否有空
      rowIdx = await findEmptyRowRemote(targetMonth, bankKey);
    }
    if (!rowIdx) return notify('該卡 50 筆已滿，請刪除舊記錄', 'err');

    // 3) 組備註的分期標記
    if (installment && !/\[分期\]/.test(note)) note = note ? `${note} [分期]` : '[分期]';
    if (!installment) note = note.replace(/\s*\[分期\]\s*/g, '').trim();

    // 4) 寫入
    const bank = BANKS_CARDS.find(b => b.key === bankKey);
    const startCol = bank.col;
    const date = dateToMD(dateRaw);
    const range = `${targetMonth}!${startCol}${rowIdx}:${idxToCol(colToIdx(startCol)+3)}${rowIdx}`;
    await sheetUpdate(SHEET_ID, range, [[date, parseFloat(amt), note, category]]);

    // 5) 套底色（分期 → 橘；否則照選色）
    await applyRowColor(bankKey, rowIdx, installment ? 2 : SELECTED_COLOR_2, targetMonth);

    // 6) 共同飲食同步
    if (category === '共同飲食') {
      await syncCommonFood(rowIdx, date, parseFloat(amt), note, targetMonth);
    }

    notify('✓ 已儲存', 'ok');

    // 7) 清除該月份快取（因為資料變了）、若使用者切到儀表板/分析會重新抓
    cacheRemove(`month-${targetMonth}`);
    if (targetMonth === CURRENT_MONTH) {
      MONTH_LOADED_FOR = ''; // 強制下次切過去時重抓
    }

    // 8) 重置表單（保留月份、銀行/卡別）讓快速連續記帳
    document.getElementById('f2-amt').value = '';
    document.getElementById('f2-note').value = '';
    document.getElementById('f2-installment').checked = false;
    selectColor2(0);
    document.getElementById('f2-amt').focus();
  } catch (e) {
    console.error(e);
    notify('儲存失敗：' + (e?.result?.error?.message || e?.message || '未知錯誤'), 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '儲存';
  }
}

// 直接打 API 找指定月份+卡的空 row（沒快取時用）
async function findEmptyRowRemote(monthKey, bankKey) {
  const bank = BANKS_CARDS.find(b => b.key === bankKey);
  if (!bank) return null;
  const range = `${monthKey}!${bank.col}4:${bank.col}53`;
  try {
    const r = await sheetGet(SHEET_ID, range);
    const vals = r.result.values || [];
    for (let i = 0; i < 50; i++) {
      const v = vals[i]?.[0];
      if (v === '' || v == null) return i + 4;
    }
    return null;
  } catch (e) {
    // 月份分頁不存在會走到這（前面 ensureMonthSheetExists 應該已經擋掉）
    return 4; // fallback
  }
}

// ─── 儀表板 ──────────────────────────────────────────────────
function renderDashboard() {
  // 全域加總
  let gTotal = 0, gRebate = 0, gPaid = 0, gPending = 0, gInstall = 0, gAccBalAccum = 0;

  BANKS.forEach(b => {
    const bd = BANK_DATA[b.key];
    if (!bd) return;
    gTotal += bd.total;
    gRebate += bd.rebate;
    gInstall += bd.install;
    if (b.isCash) {
      gAccBalAccum += bd.paid;
    } else {
      gPaid += bd.paid;
      gPending += bd.pending;
      gAccBalAccum += bd.accBal;
    }
  });
  const gNet = gTotal - gRebate;
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
  h += `<div class="card"><div class="card-title">預計餘額</div><div class="card-value ${gAccBalTotal < 0 ? 'red' : ''}">${fmtMoney(gAccBalTotal)}</div><div class="card-sub">${gAccBalTotal < 0 ? '⚠ 透支' : '可用餘額'}</div></div>`;

  // 各銀行摘要 - 標題列 + 重新整理按鈕
  h += `<div class="section-head">
    <div class="section-head-title">各銀行摘要</div>
    <button class="refresh-mini" id="dashRefreshBtn" onclick="refreshDashboard()"><span class="ricon">⟳</span> 重新整理</button>
  </div>`;
  h += `<div class="bank-grid">`;

  BANKS.forEach(b => {
    const bd = BANK_DATA[b.key];
    if (!bd) return;
    if (bd.total === 0 && bd.paid === 0 && bd.install === 0 && bd.rebate === 0) return;

    if (b.isCash) {
      h += `<div class="card-row">
        <div class="bank-head">
          <div class="bank-name">${b.name}</div>
        </div>
        <div class="bank-line"><span>消費總計</span><span class="v">${fmtMoney(bd.total)}</span></div>
        <div class="bank-line divider"></div>
        <div class="bank-line"><span>目前現金</span><span class="v green">${fmtMoney(bd.paid)}</span></div>
      </div>`;
    } else {
      const isPaid = bd.isPaidCheck;
      h += `<div class="card-row ${isPaid?'paid':''}">
        <div class="paid-badge">✓ 已繳</div>
        <div class="bank-head">
          <div class="bank-name">${b.name}</div>
          ${b.dateInfo?`<div class="bank-info">${b.dateInfo}</div>`:''}
        </div>
        <div class="bank-line"><span>分期</span><span class="v ${bd.install?'orange':''}">${fmtMoney(bd.install)}</span></div>
        <div class="bank-line"><span>消費總計</span><span class="v">${fmtMoney(bd.total)}</span></div>
        <div class="bank-line"><span>折抵</span><span class="v ${bd.rebate?'teal':''}">${bd.rebate?'-'+fmtMoney(bd.rebate):fmtMoney(0)}</span></div>
        <div class="bank-line"><span>繳費金額</span><span class="v">${fmtMoney(bd.net)}</span></div>
        <div class="bank-line"><span>已匯入</span><span class="v blue">${fmtMoney(bd.paid)}</span></div>
        <div class="bank-line highlight"><span>待繳</span><span class="v ${bd.pending>0?'red':'green'}">${fmtMoney(bd.pending)}</span></div>
        <div class="bank-line sub"><span>帳戶餘額</span><span class="v">${fmtMoney(bd.accBal)}</span></div>
        <label class="chk-paid"><input type="checkbox" ${isPaid?'checked':''} onchange="togglePaid('${b.key}',this.checked)"/> 已繳費</label>
      </div>`;
    }
  });
  h += `</div>`;
  document.getElementById('tab-content').innerHTML = h;
}

async function refreshDashboard() {
  const btn = document.getElementById('dashRefreshBtn');
  if (btn) btn.classList.add('spinning');
  try {
    await loadCurrentMonth();
    notify('✓ 已更新', 'ok');
  } catch (e) {
    notify('重新整理失敗', 'err');
  }
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
  sel.innerHTML = (window.AVAILABLE_MONTHS || defaultMonthsList()).map(m => {
    const [yy, mm] = m.split('_');
    return `<option value="${m}">20${yy}/${mm}</option>`;
  }).join('');
  sel.disabled = !!disabled;
}

// Modal 表單共用：填入銀行/分類/底色（懶載入，editEntry 之前呼叫）
function ensureModalFormReady() {
  const bankSel = document.getElementById('f-bankgroup');
  if (bankSel && bankSel.options.length <= 1) {
    populateBankSelector();
  }
  const catSel = document.getElementById('f-cat');
  if (catSel && !catSel.options.length) {
    populateCategorySelector();
  }
  const colorWrap = document.getElementById('f-colors');
  if (colorWrap && !colorWrap.children.length) {
    populateColorPicker();
  }
}

function openAddForm() {
  EDIT_TARGET = null;
  populateFormMonthSelector(false);
  document.getElementById('form-title').textContent = '新增記帳';
  document.getElementById('f-delete').classList.add('hidden');
  document.getElementById('f-bankgroup').value = '';
  document.getElementById('f-bankgroup').disabled = false;
  document.getElementById('f-card-field').classList.add('hidden');
  document.getElementById('f-card').innerHTML = '';
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

function editEntry(cardKey, rowIdx) {
  const items = MONTH_DATA[cardKey] || [];
  const it = items.find(x => x.rowIdx === rowIdx);
  if (!it) return;
  const card = BANKS_CARDS.find(c => c.key === cardKey);
  if (!card) return;
  ensureModalFormReady();
  EDIT_TARGET = {bankKey: cardKey, rowIdx};
  populateFormMonthSelector(true);
  document.getElementById('form-title').textContent = '編輯記錄';
  document.getElementById('f-delete').classList.remove('hidden');
  document.getElementById('f-bankgroup').value = card.bankKey;
  document.getElementById('f-bankgroup').disabled = true;
  // 觸發卡別下拉填充
  onBankGroupChange();
  document.getElementById('f-card').value = cardKey;
  document.getElementById('f-card').disabled = true;
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
  const bankKey = document.getElementById('f-card').value;
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
    // 清除快取（資料變了）
    cacheRemove(`month-${targetMonth}`);
    if (targetMonth !== CURRENT_MONTH) cacheRemove(`month-${CURRENT_MONTH}`);
    MONTH_LOADED_FOR = '';
    // 若寫入的月份就是當前顯示的月份，重新載入；否則切換過去
    if (targetMonth === CURRENT_MONTH) {
      await loadCurrentMonth();
    } else {
      CURRENT_MONTH = targetMonth;
      csSetValue('cs-month-wrap', targetMonth);
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
    cacheRemove(`month-${CURRENT_MONTH}`);
    MONTH_LOADED_FOR = '';
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

// ─── 消費分析（含子頁籤：消費分析 / 歷史趨勢）──────────────
function renderAnalysis() {
  const isLight = document.documentElement.classList.contains('light');
  const wrap = document.getElementById('tab-content');
  // 渲染子頁籤框架 + 兩個面板
  wrap.innerHTML = `
    <div class="sub-tab-bar">
      <button class="sub-tab-btn ${currentAnalysisTab===0?'active':''}" onclick="switchAnalysisTab(0)">消費分析</button>
      <button class="sub-tab-btn ${currentAnalysisTab===1?'active':''}" onclick="switchAnalysisTab(1)">歷史趨勢</button>
    </div>
    <div id="analysis-pie-panel" ${currentAnalysisTab===1?'style="display:none"':''}></div>
    <div id="analysis-trend-panel" ${currentAnalysisTab===0?'style="display:none"':''}></div>
  `;
  if (currentAnalysisTab === 0) {
    renderPieContent();
  } else {
    renderTrends();
  }
}

function switchAnalysisTab(idx) {
  currentAnalysisTab = idx;
  document.querySelectorAll('.sub-tab-btn').forEach((b,i) => b.classList.toggle('active', i===idx));
  const pie = document.getElementById('analysis-pie-panel');
  const trend = document.getElementById('analysis-trend-panel');
  if (pie) pie.style.display = idx===0 ? '' : 'none';
  if (trend) trend.style.display = idx===1 ? '' : 'none';
  if (idx === 1) renderTrends();
  else renderPieContent();
}

// ─── 消費分析圖表（Chart.js 雙層甜甜圈）────────────────────
function renderPieContent() {
  const panel = document.getElementById('analysis-pie-panel');
  if (!panel) return;

  // 收集所有消費（排除「其他代墊」，負數也計入）
  const catMap = {};
  Object.values(MONTH_DATA).forEach(items => {
    (items || []).forEach(it => {
      if (it.category === '其他代墊' || it.amount === 0) return;
      const cat = it.category || '其他';
      catMap[cat] = (catMap[cat] || 0) + it.amount;
    });
  });

  // 過濾淨額 <= 0 的分類（退款後淨負數不顯示）
  const essSet = new Set(CATEGORIES.filter(c => c.essential).map(c => c.name));
  let essItems = [], nessItems = [];
  let essTotal = 0, nessTotal = 0;

  Object.entries(catMap).forEach(([cat, amt]) => {
    if (amt <= 0) return;
    if (essSet.has(cat)) {
      essItems.push({name: cat, amount: amt});
      essTotal += amt;
    } else {
      // 未知分類歸入非必須
      nessItems.push({name: cat, amount: amt});
      nessTotal += amt;
    }
  });

  if (!essItems.length && !nessItems.length) {
    panel.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>本月還沒有資料可分析</p></div>`;
    return;
  }

  // 金額由大到小排序
  essItems.sort((a, b) => b.amount - a.amount);
  nessItems.sort((a, b) => b.amount - a.amount);

  const grandTotal = essTotal + nessTotal;
  const essPct  = grandTotal > 0 ? Math.round(essTotal  / grandTotal * 1000) / 10 : 0;
  const nessPct = grandTotal > 0 ? Math.round(nessTotal / grandTotal * 1000) / 10 : 0;

  // Chart.js 外圈：所有分類（非必須在前，必須在後）
  const sortedItems = [...nessItems, ...essItems];
  const outerColors = sortedItems.map((item) => {
    if (essSet.has(item.name)) {
      return ESS_COLORS[essItems.indexOf(item) % ESS_COLORS.length];
    } else {
      return NESS_COLORS[nessItems.indexOf(item) % NESS_COLORS.length];
    }
  });

  // 取主題色
  const cs = getComputedStyle(document.documentElement);
  const tooltipBg  = cs.getPropertyValue('--bg2').trim() || '#1A2026';
  const tooltipFg  = cs.getPropertyValue('--fg').trim()  || '#E8E9EC';
  const borderCol  = cs.getPropertyValue('--bg').trim()  || '#0F1418';

  // 建構 HTML
  let h = `<div class="analysis-pie-grid">
    <div class="analysis-left">
      <div class="analysis-total-lbl">總消費金額（不含代墊）</div>
      <div class="analysis-total-val">${fmtMoney(grandTotal)}</div>
      <div class="ess-summary">
        <div class="ess-card e">
          <div class="ec-label">必須花費</div>
          <div class="ec-val">${fmtMoney(essTotal)}</div>
          <div class="ec-pct">${essPct}%</div>
        </div>
        <div class="ess-card n">
          <div class="ec-label">非必須花費</div>
          <div class="ec-val">${fmtMoney(nessTotal)}</div>
          <div class="ec-pct">${nessPct}%</div>
        </div>
      </div>
      <div style="max-width:260px;margin:0 auto"><canvas id="pie-canvas"></canvas></div>
    </div>
    <div class="analysis-right">`;

  if (essItems.length)  h += buildCatSection('必須花費明細',  'e', essItems,  essTotal,  grandTotal, ESS_COLORS);
  if (nessItems.length) h += buildCatSection('非必須花費明細', 'n', nessItems, nessTotal, grandTotal, NESS_COLORS);

  h += `</div></div>`;

  panel.innerHTML = h;

  // 建立 Chart.js 雙層甜甜圈
  setTimeout(() => {
    const canvas = document.getElementById('pie-canvas');
    if (!canvas) return;
    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
    pieChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: sortedItems.map(x => x.name),
        datasets: [
          {
            // 外圈：各分類
            data: sortedItems.map(x => x.amount),
            backgroundColor: outerColors,
            borderWidth: 1.5,
            borderColor: borderCol,
          },
          {
            // 內圈：非必須 vs 必須（兩色）
            data: [nessTotal, essTotal],
            backgroundColor: ['#D85A30', '#534AB7'],
            borderWidth: 3,
            borderColor: borderCol,
          }
        ]
      },
      options: {
        responsive: true,
        cutout: '52%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(c) {
                if (c.datasetIndex === 1) {
                  const lbl = c.dataIndex === 0 ? '非必須花費' : '必須花費';
                  const p = grandTotal > 0 ? Math.round(c.parsed / grandTotal * 1000) / 10 : 0;
                  return `${lbl}: ${fmtMoney(c.parsed)} (${p}%)`;
                }
                const p = grandTotal > 0 ? Math.round(c.parsed / grandTotal * 1000) / 10 : 0;
                return `${c.label}: ${fmtMoney(c.parsed)} (${p}%)`;
              }
            },
            backgroundColor: tooltipBg,
            titleColor: tooltipFg,
            bodyColor: tooltipFg,
            padding: 10,
          }
        }
      }
    });
  }, 50);
}

// 建立分類表格區塊
function buildCatSection(title, type, items, sectionTotal, grandTotal, colors) {
  const totalPct = grandTotal > 0 ? Math.round(sectionTotal / grandTotal * 1000) / 10 : 0;

  const rows = items.map((item, i) => {
    const col = colors[i % colors.length];
    const p = grandTotal > 0 ? Math.round(item.amount / grandTotal * 1000) / 10 : 0;
    return `<tr>
      <td><span class="cat-dot" style="background:${col}"></span>${escapeHtml(item.name)}</td>
      <td class="r">${fmtMoney(item.amount)}</td>
      <td class="r dim">${p}%</td>
      <td style="width:56px"><div class="pct-bar-wrap"><div class="pct-bar" style="width:${Math.min(p*3,100)}%;background:${col}"></div></div></td>
    </tr>`;
  }).join('');

  const subtotal = `<tr class="cat-subtotal">
    <td>小計</td>
    <td class="r">${fmtMoney(sectionTotal)}</td>
    <td class="r">${totalPct}%</td>
    <td></td>
  </tr>`;

  return `<div class="cat-section">
    <span class="cat-section-title ${type}">${title}</span>
    <table class="cat-table">
      <tr><th>分類</th><th class="r">金額</th><th class="r">佔比</th><th></th></tr>
      ${rows}${subtotal}
    </table>
  </div>`;
}

// ─── 歷史趨勢（Lazy 載入，以 TREND_CACHE 避免重複 fetch）──
async function renderTrends() {
  const panel = document.getElementById('analysis-trend-panel');
  if (!panel) return;

  // 若已有快取，直接渲染不重新 fetch
  if (TREND_CACHE) {
    renderTrendContent(TREND_CACHE);
    return;
  }

  // 初次載入
  panel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--fg3)"><span class="loader"></span> 計算 6 個月歷史…</div>`;

  const months = (window.AVAILABLE_MONTHS || []).slice(0, 6).reverse();
  const trends = [];
  const essSet = new Set(CATEGORIES.filter(c => c.essential).map(c => c.name));

  for (const m of months) {
    try {
      const r = await retryWithAuth(() => gapi.client.sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
        ranges: [`${m}!A4:BL53`],
        fields: 'sheets.data.rowData.values(effectiveValue)',
      }));
      const rowDataArr = r.result.sheets?.[0]?.data?.[0]?.rowData || [];
      let total = 0, ess = 0, non = 0;

      BANKS_CARDS.forEach(card => {
        const aIdx = colToIdx(card.col) + 1;
        const ccIdx = colToIdx(card.col) + 3;
        for (let i = 0; i < 50; i++) {
          const cells = rowDataArr[i]?.values || [];
          const n = cells[aIdx]?.effectiveValue?.numberValue;
          if (n == null || n === 0) continue;
          const cat = cells[ccIdx]?.effectiveValue?.stringValue || '';
          if (cat === '其他代墊') continue;
          total += n;
          if (essSet.has(cat)) ess += n; else non += n;
        }
      });
      trends.push({month: m, total, ess, non});
    } catch (e) {
      trends.push({month: m, total: 0, ess: 0, non: 0});
    }
  }

  TREND_CACHE = trends;
  renderTrendContent(trends);
}

function renderTrendContent(trends) {
  const panel = document.getElementById('analysis-trend-panel');
  if (!panel) return;

  const cs = getComputedStyle(document.documentElement);
  const tooltipBg = cs.getPropertyValue('--bg2').trim();
  const tooltipFg = cs.getPropertyValue('--fg').trim();
  const gridColor = cs.getPropertyValue('--bg3').trim();
  const tickColor = cs.getPropertyValue('--fg3').trim();

  let h = `<div class="trend-legend">
    <div class="tl-item"><div class="tl-dot" style="background:#534AB7"></div>消費總計</div>
    <div class="tl-item"><div class="tl-dot" style="background:#1D9E75"></div>必須花費</div>
    <div class="tl-item"><div class="tl-dot" style="background:#D85A30"></div>非必須花費</div>
  </div>`;
  h += `<div style="margin-bottom:14px"><canvas id="trend-canvas"></canvas></div>`;
  h += `<table class="cat-table">
    <tr><th>月份</th><th class="r">消費總計</th><th class="r" style="color:#1D9E75">必須</th><th class="r" style="color:#D85A30">非必須</th></tr>`;
  trends.slice().reverse().forEach(t => {
    const [yy, mm] = t.month.split('_');
    h += `<tr>
      <td>20${yy}/${mm}</td>
      <td class="r">${fmtMoney(t.total)}</td>
      <td class="r" style="color:#1D9E75">${fmtMoney(t.ess)}</td>
      <td class="r" style="color:#D85A30">${fmtMoney(t.non)}</td>
    </tr>`;
  });
  h += '</table>';
  panel.innerHTML = h;

  setTimeout(() => {
    const canvas = document.getElementById('trend-canvas');
    if (!canvas) return;
    if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }

    trendChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: trends.map(t => { const [yy,mm] = t.month.split('_'); return `${yy}/${mm}`; }),
        datasets: [
          {
            label: '消費總計',
            data: trends.map(t => t.total),
            borderColor: '#534AB7',
            backgroundColor: 'rgba(83,74,183,.12)',
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#534AB7',
            pointRadius: 4,
          },
          {
            label: '必須花費',
            data: trends.map(t => t.ess),
            borderColor: '#1D9E75',
            backgroundColor: 'transparent',
            tension: 0.3,
            fill: false,
            pointBackgroundColor: '#1D9E75',
            pointRadius: 4,
          },
          {
            label: '非必須花費',
            data: trends.map(t => t.non),
            borderColor: '#D85A30',
            backgroundColor: 'transparent',
            tension: 0.3,
            fill: false,
            pointBackgroundColor: '#D85A30',
            pointRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => `${c.dataset.label}: ${fmtMoney(c.parsed.y)}`
            },
            backgroundColor: tooltipBg,
            titleColor: tooltipFg,
            bodyColor: tooltipFg,
            padding: 10,
          }
        },
        scales: {
          y: {
            ticks: {
              callback: v => Math.abs(v) >= 10000 ? '$' + Math.round(v/1000) + 'k' : '$' + Math.round(v).toLocaleString(),
              color: tickColor,
            },
            grid: { color: gridColor }
          },
          x: {
            ticks: { color: tickColor },
            grid: { display: false }
          }
        }
      }
    });
  }, 50);
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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isLight ? '#FFFFFF' : '#534AB7');
  const themeBtn = document.getElementById('menu-theme-btn');
  if (themeBtn) themeBtn.innerHTML = isLight ? '🌙 切換為深色模式' : '☀ 切換為淺色模式';
  // 圖表需要重建才能吃到新的配色
  if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  if (CURRENT_TAB === 'analysis') {
    setTimeout(() => renderAnalysis(), 50);
  }
}

async function reloadAll() {
  // 清除圖表快取與實例
  TREND_CACHE = null;
  if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  // 清除月份資料快取（強制重抓）
  if (CURRENT_MONTH) cacheRemove(`month-${CURRENT_MONTH}`);
  MONTH_LOADED_FOR = '';
  // 刷新分類與月份清單
  await refreshCategoriesBg();
  await refreshMonthsBg();
  populateMonthSelector();
  // 若在記帳 tab，更新表單下拉
  if (CURRENT_TAB === 'add') {
    updateAddCategoryOptions();
    updateAddMonthOptions();
  }
  // 若在儀表板/分析，重新載入當月資料
  if (CURRENT_TAB === 'dashboard' || CURRENT_TAB === 'analysis') {
    await loadCurrentMonth();
  }
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
