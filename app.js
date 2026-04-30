// ─────────────────────────────────────────────────────────────
// 信用卡記帳 PWA - 主邏輯
// ─────────────────────────────────────────────────────────────

const CLIENT_ID = '144262693536-poq7p69eo0aqr3r0onjafrd2f1rfrmg3.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const APP_VERSION = 'v1.0';

// 銀行/卡片定義（依試算表欄位順序）
const BANKS_CARDS = [
  {key:'cash', col:'A', bank:'現金', name:'現金', tag:'', isCash:true},
  {key:'fb_2606', col:'E', bank:'富邦', name:'Open Possible', tag:'2606'},
  {key:'fb_5389', col:'I', bank:'富邦', name:'好事多', tag:'5389'},
  {key:'es_3473', col:'M', bank:'玉山', name:'熊卡', tag:'3473'},
  {key:'es_2649', col:'Q', bank:'玉山', name:'Unicard', tag:'2649'},
  {key:'es_3327', col:'U', bank:'玉山', name:'數位 e 卡', tag:'3327'},
  {key:'es_3179', col:'Y', bank:'玉山', name:'南山', tag:'3179'},
  {key:'ub_9207', col:'AC', bank:'聯邦', name:'Line Bank', tag:'9207'},
  {key:'ub_6903', col:'AG', bank:'聯邦', name:'幸福 M', tag:'6903'},
  {key:'ub_7602', col:'AK', bank:'聯邦', name:'綠卡', tag:'7602'},
  {key:'ub_7207', col:'AO', bank:'聯邦', name:'吉鶴', tag:'7207'},
  {key:'cu_3568', col:'AS', bank:'國泰', name:'Cube', tag:'3568'},
  {key:'tx_0106', col:'AW', bank:'台新', name:'太陽', tag:'0106'},
  {key:'sf_2207', col:'BA', bank:'永豐', name:'Daway', tag:'2207'},
  {key:'cb_2108', col:'BE', bank:'彰銀', name:'My 購', tag:'2108'},
  {key:'cc_3568', col:'BI', bank:'中信', name:'英雄聯盟', tag:'3568'},
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
let MONTH_DATA = {}; // {bankKey:[{row,date,amount,note,category,color,installment}]}
let CARD_PAID = {}; // {bankKey: true/false}
let CARD_REBATE = {}; // {bankKey: number}
let CARD_BALANCE = {}; // {bankKey: number}  (accBal - row57 倒數第二欄)
let CARD_CASHIN = {}; // {bankKey: number}  (paid - row57 最右欄)
let EDIT_TARGET = null; // {bankKey, row} for editing
let HISTORY_DATA = null; // 6 個月歷史

// ─── 初始化 ──────────────────────────────────────────────────
let GIS_READY = false, GAPI_READY = false;

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
function showAbout() {
  alert(`信用卡記帳 ${APP_VERSION}\n\n直接讀寫 Google 試算表的 PWA 應用\n資料儲存在你自己的 Google Drive`);
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
  sel.innerHTML = CATEGORIES.map(c => `<option value="${c.name}">${c.name}${c.essential?' ✓':''}</option>`).join('');
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
    // 一次抓整個月份分頁的核心區域 A4:BL57
    const r = await sheetGet(SHEET_ID, `${CURRENT_MONTH}!A4:BL57`);
    const rows = r.result.values || [];
    parseMonthData(rows);
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

function parseMonthData(rows) {
  MONTH_DATA = {};
  CARD_REBATE = {};
  CARD_BALANCE = {};
  CARD_CASHIN = {};
  CARD_PAID = {};
  // rows[0] = row 4 (first data row)
  // rows[49] = row 53 (last data row)
  // rows[50] = row 54 (rebate)
  // rows[51] = row 55 (separator/blank)
  // rows[52] = row 56 (total/paid checkbox)
  // rows[53] = row 57 (paid + accBal)
  BANKS_CARDS.forEach(b => {
    const cIdx = colToIdx(b.col);
    const items = [];
    for (let i = 0; i < 50; i++) {
      const r = rows[i] || [];
      const date = r[cIdx] || '';
      const amount = r[cIdx+1] || '';
      const note = r[cIdx+2] || '';
      const category = r[cIdx+3] || '';
      if (!date && !amount && !note) continue;
      const amt = parseAmount(amount);
      if (amt === null && !date && !note) continue;
      items.push({
        rowIdx: i + 4, // 試算表的列號
        date,
        amount: amt || 0,
        note,
        category,
        installment: /\[分期\]/.test(note),
      });
    }
    MONTH_DATA[b.key] = items;
    // Row 54 = rebate
    const rebate = parseAmount((rows[50] || [])[cIdx+1]);
    CARD_REBATE[b.key] = rebate || 0;
    // Row 56 = total (we recalculate ourselves)
    // Row 57 = paid (col+3) + accBal (col+2)
    const r57 = rows[53] || [];
    CARD_BALANCE[b.key] = parseAmount(r57[cIdx+2]) || 0;
    CARD_CASHIN[b.key] = parseAmount(r57[cIdx+3]) || 0;
    // Paid checkbox: row 56, leftmost col
    const r56 = rows[52] || [];
    const paidVal = r56[cIdx];
    CARD_PAID[b.key] = (paidVal === true || paidVal === 'TRUE' || paidVal === 'V' || paidVal === '✓');
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
  else if (CURRENT_TAB === 'cards') renderCards();
  else if (CURRENT_TAB === 'analysis') renderAnalysis();
  else if (CURRENT_TAB === 'trends') renderTrends();
}

// ─── 計算函式 ────────────────────────────────────────────────
function getBankTotal(bankKey) {
  const items = MONTH_DATA[bankKey] || [];
  return items.reduce((s, it) => s + it.amount, 0);
}
function getBankInstallment(bankKey) {
  const items = MONTH_DATA[bankKey] || [];
  return items.filter(it => it.installment).reduce((s, it) => s + it.amount, 0);
}

// ─── 儀表板 ──────────────────────────────────────────────────
function renderDashboard() {
  let totalSpend = 0, totalRebate = 0, totalCashIn = 0, totalUnpaid = 0, totalBalance = 0, totalInstallment = 0;
  BANKS_CARDS.forEach(b => {
    const total = getBankTotal(b.key);
    const rebate = CARD_REBATE[b.key] || 0;
    const installment = getBankInstallment(b.key);
    totalSpend += total;
    totalRebate += rebate;
    totalInstallment += installment;
    if (b.isCash) {
      totalBalance += CARD_BALANCE[b.key] || 0;
    } else {
      totalCashIn += CARD_CASHIN[b.key] || 0;
      totalBalance += CARD_BALANCE[b.key] || 0;
      // 待匯入 = 該卡實付 - 已匯入
      const actualPay = total - rebate;
      const unpaid = Math.max(0, actualPay - (CARD_CASHIN[b.key] || 0));
      if (!CARD_PAID[b.key]) totalUnpaid += unpaid;
    }
  });
  const actualPayable = totalSpend - totalRebate;

  let h = '<div class="kpi-grid">';
  h += `<div class="kpi-card"><div class="kpi-label">消費總計</div><div class="kpi-value">${fmtMoney(totalSpend)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">回饋折抵</div><div class="kpi-value green">${fmtMoney(totalRebate)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">實際應付</div><div class="kpi-value">${fmtMoney(actualPayable)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">已匯入現金</div><div class="kpi-value blue">${fmtMoney(totalCashIn)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">待匯入繳款</div><div class="kpi-value red">${fmtMoney(totalUnpaid)}</div></div>`;
  h += `<div class="kpi-card"><div class="kpi-label">本月分期</div><div class="kpi-value orange">${fmtMoney(totalInstallment)}</div></div>`;
  h += `</div>`;
  h += `<div class="card"><div class="card-title">現金及帳戶餘額</div><div class="card-value ${totalBalance < 0 ? 'red' : ''}">${fmtMoney(totalBalance)}</div><div class="card-sub">${totalBalance < 0 ? '⚠ 透支' : '可用餘額'}</div></div>`;

  // 各銀行摘要（只有信用卡）
  h += `<div style="margin-top:14px;font-size:13px;font-weight:600;color:var(--fg2);margin-bottom:8px">各卡摘要</div>`;
  BANKS_CARDS.filter(b => !b.isCash).forEach(b => {
    const total = getBankTotal(b.key);
    if (total === 0 && (CARD_REBATE[b.key] || 0) === 0) return;
    const rebate = CARD_REBATE[b.key] || 0;
    const cashIn = CARD_CASHIN[b.key] || 0;
    const balance = CARD_BALANCE[b.key] || 0;
    const installment = getBankInstallment(b.key);
    const actualPay = total - rebate;
    const unpaid = Math.max(0, actualPay - cashIn);
    const paid = !!CARD_PAID[b.key];
    h += `<div class="card-row ${paid?'paid':''}">
      <div class="card-row-head">
        <div class="card-row-name">
          <span>${b.bank} · ${b.name}</span>
          <span class="card-row-tag">${b.tag}</span>
        </div>
        <div class="card-row-amt">${fmtMoney(total)}</div>
      </div>
      <div class="card-row-meta">
        ${rebate?`<span>折抵 <b class="green">${fmtMoney(rebate)}</b></span>`:''}
        <span>應付 <b>${fmtMoney(actualPay)}</b></span>
        ${cashIn?`<span>已匯 <b class="blue">${fmtMoney(cashIn)}</b></span>`:''}
        ${installment?`<span>分期 <b class="orange">${fmtMoney(installment)}</b></span>`:''}
        ${!paid && unpaid?`<span>待繳 <b class="red">${fmtMoney(unpaid)}</b></span>`:''}
        ${balance?`<span>餘額 <b>${fmtMoney(balance)}</b></span>`:''}
      </div>
      <div class="card-row-actions">
        <label class="chk-paid"><input type="checkbox" ${paid?'checked':''} onchange="togglePaid('${b.key}',this.checked)"/> 已繳費</label>
        <button class="btn-mini" onclick="viewBank('${b.key}')">查看明細</button>
      </div>
    </div>`;
  });
  document.getElementById('tab-content').innerHTML = h;
}

function viewBank(bankKey) {
  CURRENT_TAB = 'cards';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'cards'));
  renderCards(bankKey);
}

// ─── 各卡明細 ────────────────────────────────────────────────
function renderCards(focusBank = null) {
  let h = '';
  const cardsToShow = focusBank ? BANKS_CARDS.filter(b => b.key === focusBank) : BANKS_CARDS;
  if (focusBank) {
    h += `<div style="margin-bottom:10px"><button class="btn-mini" onclick="renderCards()">← 顯示全部</button></div>`;
  }
  cardsToShow.forEach(b => {
    const items = MONTH_DATA[b.key] || [];
    const total = getBankTotal(b.key);
    if (!items.length && !focusBank) return;
    const rebate = CARD_REBATE[b.key] || 0;
    const installment = getBankInstallment(b.key);
    const paid = !!CARD_PAID[b.key];
    const isCash = b.isCash;
    h += `<div class="card-row ${paid?'paid':''}">
      <div class="card-row-head">
        <div class="card-row-name">
          <span>${b.bank} · ${b.name}</span>
          ${b.tag?`<span class="card-row-tag">${b.tag}</span>`:''}
        </div>
        <div class="card-row-amt">${fmtMoney(total)}</div>
      </div>
      <div class="card-row-meta">
        <span>${items.length} 筆</span>
        ${rebate?`<span>折抵 <b class="green">${fmtMoney(rebate)}</b></span>`:''}
        ${installment?`<span>分期 <b class="orange">${fmtMoney(installment)}</b></span>`:''}
      </div>`;
    if (items.length) {
      h += `<div class="expense-list">`;
      items.sort((a,b) => {
        const da = parseDateMD(a.date), db = parseDateMD(b.date);
        return db - da;
      });
      items.forEach(it => {
        const colorClass = `color-${getColorByCategory(it.category)}`;
        h += `<div class="expense-row ${it.installment?'installment':colorClass}" onclick="editEntry('${b.key}',${it.rowIdx})">
          <div class="exp-date">${escapeHtml(it.date)}</div>
          <div class="exp-info">
            <div class="exp-note">${escapeHtml(it.note)}</div>
            <div class="exp-cat">${escapeHtml(it.category)}</div>
          </div>
          <div class="exp-amt ${it.amount < 0 ? 'neg' : ''}">${fmtMoney(it.amount)}</div>
        </div>`;
      });
      h += `</div>`;
    } else if (focusBank) {
      h += `<div class="empty" style="padding:20px"><p>本月還沒有記錄</p></div>`;
    }
    if (!isCash) {
      h += `<div class="card-row-actions" style="margin-top:8px">
        <label class="chk-paid"><input type="checkbox" ${paid?'checked':''} onchange="togglePaid('${b.key}',this.checked)"/> 已繳費</label>
      </div>`;
    }
    h += `</div>`;
  });
  if (!h.trim()) {
    h = `<div class="empty"><div class="empty-icon">📭</div><p>本月還沒有記錄<br>點右下角 + 開始記帳</p></div>`;
  }
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

// ─── 切換已繳費 ──────────────────────────────────────────────
async function togglePaid(bankKey, checked) {
  const bank = BANKS_CARDS.find(b => b.key === bankKey);
  if (!bank) return;
  CARD_PAID[bankKey] = checked;
  // Row 56, 該卡左欄寫入勾選
  const range = `${CURRENT_MONTH}!${bank.col}56`;
  try {
    await sheetUpdate(SHEET_ID, range, [[checked ? 'TRUE' : '']]);
    // 套用灰底
    await applyPaidStyle(bankKey, checked);
    notify(checked ? '✓ 已標記繳費' : '已取消繳費標記', 'ok');
    renderTab();
  } catch (e) {
    notify('更新失敗', 'err');
    console.error(e);
    CARD_PAID[bankKey] = !checked;
    renderTab();
  }
}

async function applyPaidStyle(bankKey, paid) {
  // Row 56 整個銀行的範圍變灰底
  try {
    const bank = BANKS_CARDS.find(b => b.key === bankKey);
    if (!bank) return;
    const startCol = colToIdx(bank.col);
    const endCol = startCol + 4;
    // 取得該分頁的 sheetId
    const meta = await gapi.client.sheets.spreadsheets.get({spreadsheetId: SHEET_ID});
    const sheet = meta.result.sheets.find(s => s.properties.title === CURRENT_MONTH);
    if (!sheet) return;
    const sheetId = sheet.properties.sheetId;
    const color = paid ? {red:0.72,green:0.72,blue:0.72} : null; // #b7b7b7 or reset
    await retryWithAuth(() => gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          repeatCell: {
            range: {sheetId, startRowIndex: 55, endRowIndex: 56, startColumnIndex: startCol, endColumnIndex: endCol},
            cell: paid ? {userEnteredFormat: {backgroundColor: color}} : {userEnteredFormat: {backgroundColor: {red:1,green:1,blue:1}}},
            fields: 'userEnteredFormat.backgroundColor',
          }
        }]
      }
    }));
  } catch (e) {
    console.warn('套用灰底失敗', e);
  }
}

// ─── 新增/編輯 ──────────────────────────────────────────────
function openAddForm() {
  EDIT_TARGET = null;
  document.getElementById('form-title').textContent = '新增記帳';
  document.getElementById('f-delete').classList.add('hidden');
  document.getElementById('f-bank').value = '';
  document.getElementById('f-bank').disabled = false;
  // 預填今天日期
  const now = new Date();
  document.getElementById('f-date').value = `${now.getMonth()+1}/${now.getDate()}`;
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
  document.getElementById('form-title').textContent = '編輯記錄';
  document.getElementById('f-delete').classList.remove('hidden');
  document.getElementById('f-bank').value = bankKey;
  document.getElementById('f-bank').disabled = true; // 不能換卡
  document.getElementById('f-date').value = it.date;
  document.getElementById('f-amt').value = it.amount;
  // 移除 [分期] 標籤顯示乾淨備註
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
  const date = document.getElementById('f-date').value.trim();
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
  const range = `${CURRENT_MONTH}!${startCol}${rowIdx}:${idxToCol(colToIdx(startCol)+3)}${rowIdx}`;
  const btn = document.getElementById('f-save');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> 儲存中…';
  try {
    await sheetUpdate(SHEET_ID, range, [[date, parseFloat(amt), note, category]]);
    // 套用底色
    await applyRowColor(bankKey, rowIdx, installment ? 2 : SELECTED_COLOR);
    // 同步「共同飲食」
    if (category === '共同飲食') {
      await syncCommonFood(rowIdx, date, parseFloat(amt), note);
    }
    notify('✓ 已儲存', 'ok');
    closeForm();
    await loadCurrentMonth();
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

async function applyRowColor(bankKey, rowIdx, colorId) {
  const color = COLORS.find(c => c.id === colorId);
  if (!color) return;
  try {
    const bank = BANKS_CARDS.find(b => b.key === bankKey);
    const meta = await gapi.client.sheets.spreadsheets.get({spreadsheetId: SHEET_ID});
    const sheet = meta.result.sheets.find(s => s.properties.title === CURRENT_MONTH);
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

async function syncCommonFood(srcRow, date, amount, note) {
  // 找 E59:G86 第一個空白列寫入
  try {
    const r = await sheetGet(SHEET_ID, `${CURRENT_MONTH}!E59:G86`);
    const rows = r.result.values || [];
    let targetRow = -1;
    for (let i = 0; i < 28; i++) {
      const rr = rows[i] || [];
      if (!rr[0] && !rr[1] && !rr[2]) {
        targetRow = 59 + i;
        break;
      }
    }
    if (targetRow < 0) return; // 沒空位就跳過
    await sheetUpdate(SHEET_ID, `${CURRENT_MONTH}!E${targetRow}:G${targetRow}`, [[date, amount, note]]);
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

  // 各分類詳細
  h += '<div class="chart-wrap">';
  h += '<div class="chart-title">分類明細</div>';
  h += '<table>';
  h += '<tr><th>分類</th><th class="r">金額</th><th class="r">佔比</th></tr>';
  Object.entries(catTotals).sort((a,b) => b[1]-a[1]).forEach(([cat, amt]) => {
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
  // 中心文字
  ctx.fillStyle = '#E8E9EC';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmtMoney(total), cx, cy-8);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#A8AEB6';
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
  // X axis labels
  ctx.fillStyle = '#A8AEB6';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  trends.forEach((t, i) => {
    const x = padL + (i / Math.max(trends.length-1,1)) * w;
    const [yy, mm] = t.month.split('_');
    ctx.fillText(`${yy}/${mm}`, x, H - padB + 14);
  });
  // Grid lines
  ctx.strokeStyle = '#262E36';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i/4) * h;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W-padR, y);
    ctx.stroke();
    ctx.fillStyle = '#6B7480';
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
  // 若有安裝 prompt 可用，在選單顯示安裝按鈕
  const installBtn = document.getElementById('menu-install-btn');
  if (installBtn) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    installBtn.style.display = (window._pwaPrompt && !isStandalone) ? '' : 'none';
  }
  document.getElementById('menu-modal').classList.remove('hidden');
}
function closeMenu() { document.getElementById('menu-modal').classList.add('hidden'); }

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
