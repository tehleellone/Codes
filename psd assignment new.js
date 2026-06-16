// ============================================================
// psd-assignment.js — PSD Assignment Module v2
// List: PSD_Assignments | Agents: Account Mapping (Team = PSD)
// ============================================================

var PSD_DUMMY_MODE = false;

var PSD_LIST       = 'PSD_Assignments';
var PSD_AGENT_LIST = 'Account Mapping';
var PSD_TEAM       = 'PSD';

var psdAllItems      = [];
var psdAllAgents     = [];
var psdEntityType    = null;
var psdActiveTab     = 'dashboard';
var psdCharts        = {};
var psdGrids         = { dash: null, assign: null, assigned: null, agentQueue: null, agentRecords: null };
var psdUploadRows    = [];
var psdSelectedAgent = null;
var psdDashFilters   = { status: '', category: '', agent: '', product: '', search: '' };

var PSD_COLS = [
    { key: 'ActivityNumber',     header: 'Activity #' },
    { key: 'OrderNumber',        header: 'Order #' },
    { key: 'OrderStatus',        header: 'Status' },
    { key: 'ActivityTypeText',   header: 'Type' },
    { key: 'Description',        header: 'Description' },
    { key: 'Owner',              header: 'Owner' },
    { key: 'CustomerAccount',    header: 'Customer/Account' },
    { key: 'CreatedOn',          header: 'Created' },
    { key: 'OrderCreatedDate',   header: 'Order Created Date' },
    { key: 'Product',            header: 'Product' },
    { key: 'BUStatus',           header: 'BU' },
    { key: 'DNSStatus',          header: 'DNS' },
    { key: 'ProvisioningOwner',  header: 'Owner (Prov.)' },
    { key: 'ProvisioningType',   header: 'Type (Prov.)' },
    { key: 'ProvisioningStatus', header: 'Status (Prov.)' },
    { key: 'DNSActivityRef',     header: 'DNS Activity Ref' },
    { key: 'BUActivityRef',      header: 'BU Activity Ref' }
];

var PSD_STATUS = { PENDING: 'Pending', INPROGRESS: 'Inprogress', COMPLETED: 'Completed' };

// ── Roles ─────────────────────────────────────────────────────
function psdRole()        { return (window.USER_CONTEXT && window.USER_CONTEXT.role) || 'none'; }
function psdUserName()    { return (window.USER_CONTEXT && window.USER_CONTEXT.userName) || ''; }
function psdUserEmail()   { return (window.USER_CONTEXT && window.USER_CONTEXT.userEmail) || ''; }
function psdIsSMAdmin()   { return psdRole() === 'Admin'; }
function psdIsPsdAdmin()  { return psdRole() === 'PSD_Admin'; }
function psdIsAdminLike() { return psdIsSMAdmin() || psdIsPsdAdmin(); }
function psdIsAgent()     { return psdRole() === 'PSD_Agent'; }
function psdHasAccess()   { return psdIsAdminLike() || psdIsAgent(); }

function psdEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function psdOdata(s) { return String(s == null ? '' : s).replace(/'/g, "''"); }

function psdDaysBetween(a, b) {
    if (!a || !b) return null;
    var d1 = new Date(a), d2 = new Date(b);
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function psdSlaStartDate(item) {
    if (!item) return null;
    if (item.ReassignDate) return item.ReassignDate;
    if (item.AssignmentDate) return item.AssignmentDate;
    return item.UploadDate;
}

function psdSlaDays(item) {
    if (!item) return null;
    var start = psdSlaStartDate(item);
    if (!start) return null;
    var end = item.PSDStatus === PSD_STATUS.COMPLETED ? item.CompletedDate : new Date().toISOString();
    return psdDaysBetween(start, end);
}

function psdAging(item) {
    var end = item.PSDStatus === PSD_STATUS.COMPLETED ? item.CompletedDate : new Date().toISOString();
    return psdDaysBetween(item.UploadDate, end);
}

function psdTimeToComplete(item) {
    if (item.PSDStatus !== PSD_STATUS.COMPLETED) return null;
    return psdDaysBetween(psdSlaStartDate(item), item.CompletedDate);
}

function psdFmtDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d)) return psdEsc(v);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function psdStatusColor(s) {
    if (s === PSD_STATUS.COMPLETED)  return '#22c55e';
    if (s === PSD_STATUS.INPROGRESS) return '#f59e0b';
    return '#94a3b8';
}

function psdToast(msg, type) {
    var bg = type === 'error' ? '#ef4444' : (type === 'warn' ? '#f59e0b' : '#22c55e');
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99999;background:' + bg +
        ';color:#fff;padding:14px 20px;border-radius:12px;font-weight:700;font-size:.85rem;box-shadow:0 8px 28px rgba(0,0,0,.25);max-width:380px;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 3200);
    setTimeout(function () { t.remove(); }, 3700);
}

// ── Chart theme ───────────────────────────────────────────────
var PSD_CHART_PALETTE = {
    pending:    { from: '#64748b', to: '#94a3b8' },
    inprogress: { from: '#c2410c', to: '#fb923c' },
    completed:  { from: '#047857', to: '#34d399' },
    agents:     ['#7c3aed', '#6366f1', '#0891b2', '#db2777', '#059669', '#d97706'],
    categories: ['#0284c7', '#0d9488', '#7c3aed', '#db2777', '#ca8a04', '#dc2626'],
    aging:      ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']
};

function psdInjectStyles() {
    if (document.getElementById('psd-module-styles')) return;
    var s = document.createElement('style');
    s.id = 'psd-module-styles';
    s.textContent =
        '.psd-root{width:100%;max-width:none;box-sizing:border-box}' +
        '.psd-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-top:1rem;width:100%}' +
        '@media(max-width:1100px){.psd-chart-grid{grid-template-columns:1fr}}' +
        '.psd-chart-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1rem 1.1rem;box-shadow:var(--cs);position:relative;overflow:hidden}' +
        '.psd-chart-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad);opacity:.85}' +
        '.psd-chart-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.5rem;margin-bottom:.85rem}' +
        '.psd-chart-head h3{font-size:.92rem!important;font-weight:800!important;color:var(--t1)!important;margin:0!important}' +
        '.psd-chart-head span{font-size:.68rem;color:var(--t3);font-weight:600}' +
        '.psd-chart-body{position:relative;width:100%}' +
        '.psd-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1rem 1.15rem;margin-top:1rem;box-shadow:var(--cs);width:100%;box-sizing:border-box}' +
        '.psd-panel-title{font-size:.95rem;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:.45rem;margin-bottom:.85rem}' +
        '.psd-upload-zone{display:block;width:100%;padding:16px;border:2px dashed var(--border-s);border-radius:12px;background:var(--bg-input);color:var(--t2);cursor:pointer;font-size:.85rem}' +
        '.psd-filter-bar{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.9rem 1rem;margin-bottom:1rem;box-shadow:var(--cs)}' +
        '.psd-filter-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.65rem}' +
        '.psd-filter-head span{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)}' +
        '.psd-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem}' +
        '.psd-agent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.85rem;margin:1rem 0}' +
        '.psd-agent-tile{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.85rem 1rem;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;box-shadow:var(--cs)}' +
        '.psd-agent-tile:hover{transform:translateY(-2px);box-shadow:var(--ch)}' +
        '.psd-agent-tile.selected{border-color:var(--acc);box-shadow:0 0 0 2px var(--glow)}' +
        '.psd-agent-tile-head{display:flex;align-items:center;gap:.55rem;margin-bottom:.55rem}' +
        '.psd-agent-avatar{width:36px;height:36px;border-radius:50%;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.78rem;flex-shrink:0}' +
        '.psd-bulk-bar{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;padding:.75rem 1rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;margin-bottom:.75rem}' +
        '.psd-bulk-hint{font-size:.72rem;color:var(--t3);flex:1;min-width:180px}' +
        '.psd-grid-action{display:flex;align-items:center;gap:6px}' +
        '.psd-grid-action select{font-size:.72rem;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--t1);max-width:120px}' +
        '.psd-grid-action button{font-size:.68rem;padding:4px 10px;border:none;border-radius:6px;background:var(--grad);color:#fff;font-weight:700;cursor:pointer}';
    document.head.appendChild(s);
}

function psdSetFullLayout(on) {
    var content = document.querySelector('.content');
    var shell = document.querySelector('.portal-shell');
    if (content) content.classList.toggle('psd-full-mode', !!on);
    if (shell) shell.classList.toggle('psd-full-shell', !!on);
}

function psdCssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim() || '#a855f7'; }

function psdLinearGradient(chart, c1, c2) {
    var ctx = chart.ctx, area = chart.chartArea;
    if (!area) return c1;
    var g = ctx.createLinearGradient(0, area.bottom, 0, area.top);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
}

function psdCenterTextPlugin(total, subtitle) {
    return {
        id: 'psdCenterText',
        afterDraw: function (chart) {
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data.length) return;
            var pt = meta.data[0], ctx = chart.ctx;
            ctx.save();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = psdCssVar('--t1'); ctx.font = '800 28px Inter,sans-serif';
            ctx.fillText(String(total), pt.x, pt.y - 6);
            ctx.fillStyle = psdCssVar('--t3'); ctx.font = '600 11px Inter,sans-serif';
            ctx.fillText(subtitle || 'Total', pt.x, pt.y + 16);
            ctx.restore();
        }
    };
}

function psdChartTooltip() {
    return {
        backgroundColor: 'rgba(15,23,42,0.94)', titleColor: '#f8fafc', bodyColor: '#e2e8f0',
        borderColor: 'rgba(148,163,184,0.25)', borderWidth: 1, padding: 12, cornerRadius: 10,
        titleFont: { size: 13, weight: '700' }, bodyFont: { size: 12, weight: '500' }
    };
}

// ============================================================
// SHAREPOINT
// ============================================================
async function psdGetDigest() {
    var r = await fetch(SP_URL + '/_api/contextinfo', { method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    return (await r.json()).d.GetContextWebInformation.FormDigestValue;
}

async function psdGetEntityType() {
    if (psdEntityType) return psdEntityType;
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PSD_LIST + "')?$select=ListItemEntityTypeFullName",
        { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    psdEntityType = (await r.json()).d.ListItemEntityTypeFullName;
    return psdEntityType;
}

async function psdFetchAgents() {
    if (PSD_DUMMY_MODE) { psdAllAgents = psdDummyAgents(); return; }
    var url = SP_URL + "/_api/web/lists/getbytitle('" + PSD_AGENT_LIST + "')/items?" +
        "$select=Service_Manager_Name,Email_ID,Team,User_ID&$filter=Team eq '" + psdOdata(PSD_TEAM) +
        "'&$top=5000&$orderby=Service_Manager_Name asc";
    var r = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!r.ok) { psdAllAgents = []; return; }
    var seen = {}, data = await r.json();
    psdAllAgents = [];
    (data.d.results || []).forEach(function (it) {
        var name = (it.Service_Manager_Name || '').trim();
        if (!name || seen[name]) return;
        seen[name] = true;
        psdAllAgents.push({ name: name, email: it.Email_ID || '' });
    });
}

async function psdFetchItems() {
    if (PSD_DUMMY_MODE) { psdAllItems = psdDummyItems(); return; }
    var cols = PSD_COLS.map(function (c) { return c.key; }).join(',');
    var url = SP_URL + "/_api/web/lists/getbytitle('" + PSD_LIST + "')/items?" +
        "$select=ID," + cols + ",Category,PSDStatus,UploadDate,AssignmentDate,ReassignDate,CompletedDate," +
        "AssignedTo/Title,AssignedTo/EMail&$expand=AssignedTo&$orderby=ID desc&$top=5000";
    var r = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!r.ok) throw new Error('Failed to load PSD assignments (' + r.status + ')');
    var data = await r.json();
    psdAllItems = (data.d.results || []).map(function (it) {
        it.AssignedToName  = it.AssignedTo ? it.AssignedTo.Title : '';
        it.AssignedToEmail = it.AssignedTo ? it.AssignedTo.EMail : '';
        return it;
    });
}

async function psdResolveUserId(email, name) {
    if (email) {
        var r = await fetch(SP_URL + "/_api/web/siteusers?$filter=Email eq '" + psdOdata(email) + "'&$select=Id&$top=1",
            { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (r.ok) { var d = await r.json(); if (d.d.results.length) return d.d.results[0].Id; }
    }
    if (name) {
        var r2 = await fetch(SP_URL + "/_api/web/siteusers?$filter=Title eq '" + psdOdata(name) + "'&$select=Id&$top=1",
            { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (r2.ok) { var d2 = await r2.json(); if (d2.d.results.length) return d2.d.results[0].Id; }
    }
    return null;
}

async function psdCreateItem(fields, digest) {
    var body = Object.assign({ __metadata: { type: await psdGetEntityType() } }, fields);
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PSD_LIST + "')/items", {
        method: 'POST', credentials: 'include',
        headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest },
        body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('Create failed: ' + r.status);
    return r.json();
}

async function psdUpdateItem(id, fields, digest) {
    var body = Object.assign({ __metadata: { type: await psdGetEntityType() } }, fields);
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PSD_LIST + "')/items(" + id + ")", {
        method: 'POST', credentials: 'include',
        headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
        body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('Update failed: ' + r.status);
}

// ============================================================
// ENTRY + SHELL
// ============================================================
window.psdInit = async function () {
    psdInjectStyles();
    psdSetFullLayout(true);
    var loadingEl = document.getElementById('psdLoading');
    var contentEl = document.getElementById('psdContent');
    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    if (!psdHasAccess()) {
        if (loadingEl) loadingEl.innerHTML = '<div style="text-align:center;padding:50px;"><div style="font-size:2rem;">🔒</div><div style="font-weight:800;color:var(--t1);">Access Restricted</div></div>';
        return;
    }

    try {
        await Promise.race([
            Promise.all([psdFetchItems(), psdFetchAgents()]),
            new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Request timed out')); }, 15000); })
        ]);
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        psdActiveTab = psdIsAgent() ? 'myqueue' : 'dashboard';
        psdRenderShell();
    } catch (e) {
        console.error('[PSD]', e);
        if (loadingEl) loadingEl.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-weight:700;color:var(--t1);">Could not load PSD data</div><div style="font-size:.82rem;color:var(--t3);margin:8px 0;">' + psdEsc(e.message) + '</div><button type="button" class="export-btn" onclick="psdInit()">Retry</button></div>';
    }
};

function psdScopedItems() {
    if (psdIsAdminLike()) return psdAllItems;
    var me = psdUserName(), em = (psdUserEmail() || '').toLowerCase();
    return psdAllItems.filter(function (it) {
        return it.AssignedToName === me || (it.AssignedToEmail && it.AssignedToEmail.toLowerCase() === em);
    });
}

function psdTabsForRole() {
    if (psdIsAgent()) return [{ id: 'myqueue', label: 'My Queue', icon: 'inbox' }];
    return [
        { id: 'dashboard', label: 'PSD Dashboard', icon: 'layout-dashboard' },
        { id: 'assign',    label: 'Assign Queue', icon: 'user-plus' },
        { id: 'assigned',  label: 'Assigned Queue', icon: 'users' }
    ];
}

function psdRenderShell() {
    var c = document.getElementById('psdContainer');
    if (!c) return;
    var tabs = psdTabsForRole();
    c.innerHTML =
        '<div class="psd-root">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:1rem;">' +
            '<div><h2 style="font-size:1.15rem;font-weight:900;color:var(--t1);display:flex;align-items:center;gap:.5rem;">' +
            '<i data-lucide="clipboard-list" style="width:24px;height:24px;color:var(--acc);"></i>PSD Assignment</h2>' +
            '<div style="font-size:.76rem;color:var(--t3);margin-top:3px;">' + psdEsc(psdRoleLabel()) + ' · ' + psdEsc(psdUserName()) + '</div></div>' +
            '<button type="button" class="export-btn" onclick="psdInit()" style="padding:9px 18px;"><i data-lucide="refresh-cw" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Refresh</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.1rem;">' +
        tabs.map(function (t) {
            var active = t.id === psdActiveTab;
            return '<button type="button" onclick="psdSwitchTab(\'' + t.id + '\')" style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700;border:1px solid ' +
                (active ? 'transparent' : 'var(--border)') + ';background:' + (active ? 'var(--grad)' : 'var(--bg-card)') + ';color:' + (active ? '#fff' : 'var(--t2)') + ';">' +
                '<i data-lucide="' + t.icon + '" style="width:15px;height:15px;"></i>' + t.label + '</button>';
        }).join('') +
        '</div><div id="psdTabBody"></div></div>';
    psdRenderTabBody();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdRoleLabel() {
    if (psdIsSMAdmin()) return 'SM Admin';
    if (psdIsPsdAdmin()) return 'PSD Admin';
    if (psdIsAgent()) return 'PSD Agent';
    return psdRole();
}

window.psdSwitchTab = function (id) { psdActiveTab = id; psdRenderShell(); };

function psdRenderTabBody() {
    var body = document.getElementById('psdTabBody');
    if (!body) return;
    psdDestroyCharts();
    psdDestroyAllGrids();
    if (psdActiveTab === 'dashboard') return psdRenderDashboard(body);
    if (psdActiveTab === 'assign')    return psdRenderAssignQueue(body);
    if (psdActiveTab === 'assigned')  return psdRenderAssignedQueue(body);
    if (psdActiveTab === 'myqueue')   return psdRenderMyQueue(body);
}

function psdDestroyCharts() {
    Object.keys(psdCharts).forEach(function (k) { try { psdCharts[k].destroy(); } catch (e) {} });
    psdCharts = {};
}

function psdDestroyAllGrids() {
    Object.keys(psdGrids).forEach(function (k) {
        if (psdGrids[k] && psdGrids[k].destroy) { try { psdGrids[k].destroy(); } catch (e) {} }
        psdGrids[k] = null;
    });
}

function psdDestroyGrid(key) {
    if (psdGrids[key] && psdGrids[key].destroy) { try { psdGrids[key].destroy(); } catch (e) {} }
    psdGrids[key] = null;
}

function psdGetSelectedRows(key) {
    var api = psdGrids[key];
    if (!api) return [];
    if (typeof api.getSelectedRows === 'function') return api.getSelectedRows() || [];
    var rows = [];
    api.forEachNode && api.forEachNode(function (n) { if (n.isSelected && n.isSelected() && n.data) rows.push(n.data); });
    return rows;
}

// ── Filters ───────────────────────────────────────────────────
function psdUniqueValues(items, field) {
    return [...new Set(items.map(function (it) { return it[field]; }).filter(Boolean))].sort();
}

function psdApplyDashFilters(items) {
    var f = psdDashFilters;
    return items.filter(function (it) {
        if (f.status && it.PSDStatus !== f.status) return false;
        if (f.category && it.Category !== f.category) return false;
        if (f.agent && it.AssignedToName !== f.agent) return false;
        if (f.product && it.Product !== f.product) return false;
        if (f.search) {
            var q = f.search.toLowerCase();
            var blob = [it.ActivityNumber, it.OrderNumber, it.CustomerAccount, it.Description, it.Category, it.AssignedToName].join(' ').toLowerCase();
            if (blob.indexOf(q) < 0) return false;
        }
        return true;
    });
}

function psdReadDashFiltersFromDom() {
    psdDashFilters.status   = (document.getElementById('psdFilterStatus')   || {}).value || '';
    psdDashFilters.category = (document.getElementById('psdFilterCategory') || {}).value || '';
    psdDashFilters.agent    = (document.getElementById('psdFilterAgent')    || {}).value || '';
    psdDashFilters.product  = (document.getElementById('psdFilterProduct')  || {}).value || '';
    psdDashFilters.search   = (document.getElementById('psdFilterSearch')   || {}).value || '';
    psdSelectedAgent = psdDashFilters.agent || null;
}

window.psdApplyDashboardFilters = function () {
    psdReadDashFiltersFromDom();
    psdRenderTabBody();
};

window.psdResetDashboardFilters = function () {
    psdDashFilters = { status: '', category: '', agent: '', product: '', search: '' };
    psdSelectedAgent = null;
    psdRenderTabBody();
};

window.psdSelectAgentTile = function (name) {
    psdSelectedAgent = psdSelectedAgent === name ? null : name;
    psdDashFilters.agent = psdSelectedAgent || '';
    psdRenderTabBody();
};

function psdFilterBarHTML(items, prefix) {
    prefix = prefix || 'psdFilter';
    var statuses = [PSD_STATUS.PENDING, PSD_STATUS.INPROGRESS, PSD_STATUS.COMPLETED];
    var cats = psdUniqueValues(items, 'Category');
    var agents = psdAllAgents.map(function (a) { return a.name; });
    var products = psdUniqueValues(items, 'Product');
    function sel(id, label, opts, val) {
        return '<div class="filter-group"><label class="filter-label">' + label + '</label><select class="filter-select" id="' + prefix + id + '" onchange="psdApplyDashboardFilters()" style="font-size:.82rem;padding:8px;">' +
            '<option value="">All</option>' + opts.map(function (o) {
                return '<option value="' + psdEsc(o) + '"' + (val === o ? ' selected' : '') + '>' + psdEsc(o) + '</option>';
            }).join('') + '</select></div>';
    }
    return '<div class="psd-filter-bar">' +
        '<div class="psd-filter-head"><span>Filters</span><button type="button" class="reset-btn" onclick="psdResetDashboardFilters()" style="padding:6px 12px;font-size:.72rem;">Reset</button></div>' +
        '<div class="psd-filter-grid">' +
            sel('Status', 'Status', statuses, psdDashFilters.status) +
            sel('Category', 'Category', cats, psdDashFilters.category) +
            sel('Agent', 'Assigned To', agents, psdDashFilters.agent) +
            sel('Product', 'Product', products, psdDashFilters.product) +
            '<div class="filter-group"><label class="filter-label">Search</label><input type="text" class="filter-select" id="' + prefix + 'Search" placeholder="Activity, Order, Customer…" value="' + psdEsc(psdDashFilters.search) + '" oninput="psdApplyDashboardFilters()" style="font-size:.82rem;padding:8px;cursor:text;"></div>' +
        '</div></div>';
}

function psdSummary(items) {
    var s = { total: items.length, pending: 0, inprogress: 0, completed: 0, agingSum: 0, agingN: 0, ttcSum: 0, ttcN: 0 };
    items.forEach(function (it) {
        if (it.PSDStatus === PSD_STATUS.PENDING) s.pending++;
        else if (it.PSDStatus === PSD_STATUS.INPROGRESS) s.inprogress++;
        else if (it.PSDStatus === PSD_STATUS.COMPLETED) s.completed++;
        var ag = psdAging(it); if (ag != null) { s.agingSum += ag; s.agingN++; }
        var ttc = psdTimeToComplete(it); if (ttc != null) { s.ttcSum += ttc; s.ttcN++; }
    });
    s.avgAging = s.agingN ? Math.round(s.agingSum / s.agingN) : 0;
    s.avgTtc   = s.ttcN ? Math.round(s.ttcSum / s.ttcN) : 0;
    return s;
}

function psdTile(label, value, subtitle, color) {
    return '<div class="stat-card"><div class="stat-label">' + psdEsc(label) + '</div>' +
        '<div class="stat-value"' + (color ? ' style="color:' + color + ';"' : '') + '>' + psdEsc(String(value)) + '</div>' +
        (subtitle ? '<div class="stat-subtitle">' + psdEsc(subtitle) + '</div>' : '') + '</div>';
}

function psdInitials(name) {
    if (!name) return '?';
    var p = name.trim().split(/\s+/);
    return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function psdAgentStats(items) {
    var stats = {};
    psdAllAgents.forEach(function (a) { stats[a.name] = { name: a.name, email: a.email, assigned: 0, inprogress: 0, completed: 0, slaSum: 0, slaN: 0 }; });
    items.forEach(function (it) {
        if (!it.AssignedToName) return;
        if (!stats[it.AssignedToName]) stats[it.AssignedToName] = { name: it.AssignedToName, email: it.AssignedToEmail || '', assigned: 0, inprogress: 0, completed: 0, slaSum: 0, slaN: 0 };
        var st = stats[it.AssignedToName];
        st.assigned++;
        if (it.PSDStatus === PSD_STATUS.INPROGRESS) st.inprogress++;
        if (it.PSDStatus === PSD_STATUS.COMPLETED) {
            st.completed++;
            var sla = psdSlaDays(it);
            if (sla != null) { st.slaSum += sla; st.slaN++; }
        }
    });
    return Object.keys(stats).map(function (k) { return stats[k]; }).sort(function (a, b) { return b.completed - a.completed; });
}

function psdAgentTilesHTML(items) {
    var rows = psdAgentStats(items);
    if (!rows.length) return '';
    return '<div class="psd-panel" style="margin-top:0;"><div class="psd-panel-title"><i data-lucide="users" style="width:18px;height:18px;color:var(--acc);"></i>PSD Agents</div>' +
        '<div class="psd-agent-grid">' +
        rows.map(function (st) {
            var avgSla = st.slaN ? Math.round(st.slaSum / st.slaN) : 0;
            var rate = st.assigned ? Math.round((st.completed / st.assigned) * 100) : 0;
            var sel = psdSelectedAgent === st.name ? ' selected' : '';
            return '<div class="psd-agent-tile' + sel + '" onclick="psdSelectAgentTile(\'' + psdEsc(st.name).replace(/'/g, "\\'") + '\')">' +
                '<div class="psd-agent-tile-head"><div class="psd-agent-avatar">' + psdEsc(psdInitials(st.name)) + '</div>' +
                '<div><div style="font-weight:800;font-size:.88rem;color:var(--t1);">' + psdEsc(st.name) + '</div>' +
                '<div style="font-size:.68rem;color:var(--t3);">' + psdEsc(st.email || '') + '</div></div></div>' +
                '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.4rem;font-size:.72rem;">' +
                    '<div><span style="color:var(--t3);">Assigned</span><div style="font-weight:800;color:var(--acc);">' + st.assigned + '</div></div>' +
                    '<div><span style="color:var(--t3);">In Progress</span><div style="font-weight:800;color:' + psdStatusColor(PSD_STATUS.INPROGRESS) + ';">' + st.inprogress + '</div></div>' +
                    '<div><span style="color:var(--t3);">Completed</span><div style="font-weight:800;color:' + psdStatusColor(PSD_STATUS.COMPLETED) + ';">' + st.completed + '</div></div>' +
                    '<div><span style="color:var(--t3);">Avg SLA</span><div style="font-weight:800;color:var(--acc2);">' + avgSla + 'd</div></div>' +
                '</div>' +
                '<div style="margin-top:.55rem;height:6px;border-radius:4px;background:var(--bg-secondary);overflow:hidden;"><div style="height:100%;width:' + rate + '%;background:var(--grad);"></div></div>' +
                '<div style="font-size:.65rem;color:var(--t3);text-align:right;margin-top:3px;">' + rate + '% done</div></div>';
        }).join('') +
        '</div></div>';
}

// ============================================================
// AG-GRID (FNE-style)
// ============================================================
function psdStatusRenderer() {
    return function (p) {
        if (!p.value) return '';
        var c = psdStatusColor(p.value);
        return '<span style="background:' + c + '22;color:' + c + ';padding:2px 10px;border-radius:20px;font-weight:700;font-size:.72rem;">' + p.value + '</span>';
    };
}

function psdAgentOptionsHTML(selected) {
    return '<option value="">Select…</option>' + psdAllAgents.map(function (a) {
        return '<option value="' + psdEsc(a.name) + '"' + (selected === a.name ? ' selected' : '') + '>' + psdEsc(a.name) + '</option>';
    }).join('');
}

function psdBaseColDefs(mode) {
    var cols = [
        { headerName: 'Activity #', field: 'ActivityNumber', pinned: 'left', width: 130, filter: 'agTextColumnFilter' },
        { headerName: 'Order #', field: 'OrderNumber', width: 150, filter: 'agTextColumnFilter' },
        { headerName: 'Category', field: 'Category', width: 130, filter: 'agTextColumnFilter' },
        { headerName: 'Status', field: 'PSDStatus', width: 120, cellRenderer: psdStatusRenderer(), filter: 'agTextColumnFilter' },
        { headerName: 'Assigned To', field: 'AssignedToName', width: 140, filter: 'agTextColumnFilter' },
        { headerName: 'Customer/Account', field: 'CustomerAccount', width: 200, filter: 'agTextColumnFilter' },
        { headerName: 'Description', field: 'Description', width: 240, filter: 'agTextColumnFilter' },
        { headerName: 'Product', field: 'Product', width: 100, filter: 'agTextColumnFilter' },
        { headerName: 'Upload Date', field: 'UploadDate', width: 120, valueFormatter: function (p) { return psdFmtDate(p.value); }, filter: 'agDateColumnFilter' },
        { headerName: 'Assigned Date', field: 'AssignmentDate', width: 125, valueFormatter: function (p) { return psdFmtDate(p.value); }, filter: 'agDateColumnFilter' },
        { headerName: 'Reassign Date', field: 'ReassignDate', width: 125, valueFormatter: function (p) { return psdFmtDate(p.value); }, filter: 'agDateColumnFilter' },
        { headerName: 'Completed Date', field: 'CompletedDate', width: 130, valueFormatter: function (p) { return psdFmtDate(p.value); }, filter: 'agDateColumnFilter' },
        { headerName: 'SLA (d)', width: 90, valueGetter: function (p) { return psdSlaDays(p.data); }, filter: 'agNumberColumnFilter' },
        { headerName: 'Aging (d)', width: 90, valueGetter: function (p) { return psdAging(p.data); }, filter: 'agNumberColumnFilter' }
    ];
    if (mode === 'assign') {
        cols.unshift({ headerCheckboxSelection: true, checkboxSelection: true, headerCheckboxSelectionFilteredOnly: true, width: 48, pinned: 'left', filter: false, sortable: false });
        cols.push({
            headerName: 'Action', width: 200, pinned: 'right', filter: false, sortable: false,
            cellRenderer: function (p) {
                if (!p.data) return '';
                return '<div class="psd-grid-action"><select class="psd-row-agent" data-id="' + p.data.ID + '">' + psdAgentOptionsHTML('') +
                    '</select><button type="button" data-assign="' + p.data.ID + '">Assign</button></div>';
            }
        });
    }
    if (mode === 'assigned') {
        cols.unshift({ headerCheckboxSelection: true, checkboxSelection: true, headerCheckboxSelectionFilteredOnly: true, width: 48, pinned: 'left', filter: false, sortable: false });
        cols.push({
            headerName: 'Reassign', width: 210, pinned: 'right', filter: false, sortable: false,
            cellRenderer: function (p) {
                if (!p.data) return '';
                return '<div class="psd-grid-action"><select class="psd-row-reassign" data-id="' + p.data.ID + '">' + psdAgentOptionsHTML(p.data.AssignedToName) +
                    '</select><button type="button" data-reassign="' + p.data.ID + '">Reassign</button></div>';
            }
        });
    }
    if (mode === 'agentqueue') {
        cols.push({
            headerName: 'Action', width: 120, pinned: 'right', filter: false, sortable: false,
            cellRenderer: function (p) {
                if (!p.data || p.data.PSDStatus !== PSD_STATUS.INPROGRESS) return '';
                return '<button type="button" class="export-btn" style="padding:4px 12px;font-size:.68rem;" data-complete="' + p.data.ID + '">Complete</button>';
            }
        });
    }
    return cols;
}

function psdGridSectionHTML(title, gridId, searchId, exportFn, count) {
    return '<div class="table-section">' +
        '<div class="table-header"><h3 class="table-title">' + psdEsc(title) + ' <span style="font-weight:600;color:var(--t3);font-size:.78rem;">(' + count + ')</span></h3>' +
        '<div class="table-actions">' +
            '<input type="text" class="search-box" id="' + searchId + '" placeholder="Search all columns…" oninput="psdGridQuickFilter(\'' + gridId + '\',this.value)">' +
            '<button type="button" class="export-btn" onclick="' + exportFn + '"><i data-lucide="file-spreadsheet" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export CSV</button>' +
        '</div></div>' +
        '<div id="' + gridId + '" class="ag-theme-alpine" style="height:580px;width:100%;"></div></div>';
}

function psdMountGrid(gridId, gridKey, items, mode) {
    var el = document.getElementById(gridId);
    if (!el || typeof agGrid === 'undefined') {
        if (el) el.innerHTML = psdErrBox('ag-Grid not loaded.');
        return;
    }
    psdDestroyGrid(gridKey);
    el.innerHTML = '';
    var opts = {
        columnDefs: psdBaseColDefs(mode),
        rowData: items || [],
        defaultColDef: { sortable: true, filter: true, resizable: true, floatingFilter: true, minWidth: 90 },
        pagination: true,
        paginationPageSize: 50,
        paginationPageSizeSelector: [25, 50, 100, 250],
        rowSelection: (mode === 'assign' || mode === 'assigned') ? 'multiple' : undefined,
        suppressRowClickSelection: true,
        animateRows: true,
        rowHeight: 44,
        headerHeight: 48,
        enableCellTextSelection: true,
        onGridReady: function (p) { psdGrids[gridKey] = p.api; }
    };
    if (agGrid.createGrid) psdGrids[gridKey] = agGrid.createGrid(el, opts);
    else { new agGrid.Grid(el, opts); psdGrids[gridKey] = opts.api; }

    el.addEventListener('click', function (ev) {
        var t = ev.target;
        if (t.dataset && t.dataset.assign) psdAssignRow(parseInt(t.dataset.assign, 10));
        if (t.dataset && t.dataset.reassign) psdReassignRow(parseInt(t.dataset.reassign, 10));
        if (t.dataset && t.dataset.complete) psdComplete(parseInt(t.dataset.complete, 10));
    });
}

window.psdGridQuickFilter = function (gridId, val) {
    var map = { psdGrid: 'dash', psdAssignGrid: 'assign', psdAssignedGrid: 'assigned', psdAgentQueueGrid: 'agentQueue', psdAgentGrid: 'agentRecords' };
    var api = psdGrids[map[gridId]];
    if (!api) return;
    if (api.setGridOption) api.setGridOption('quickFilterText', val);
    else if (api.setQuickFilter) api.setQuickFilter(val);
};

window.psdExportDashCsv = function () { psdExportGrid('dash', 'PSD_All_Records'); };
window.psdExportAssignCsv = function () { psdExportGrid('assign', 'PSD_Assign_Queue'); };
window.psdExportAssignedCsv = function () { psdExportGrid('assigned', 'PSD_Assigned_Queue'); };
window.psdExportAgentQueueCsv = function () { psdExportGrid('agentQueue', 'PSD_My_Queue'); };
window.psdExportAgentRecordsCsv = function () { psdExportGrid('agentRecords', 'PSD_My_Records'); };

function psdExportGrid(key, prefix) {
    var api = psdGrids[key];
    if (api && api.exportDataAsCsv) api.exportDataAsCsv({ fileName: prefix + '_' + new Date().toISOString().slice(0, 10) + '.csv' });
}

function psdBulkBarHTML(type) {
    var isAssign = type === 'assign';
    return '<div class="psd-bulk-bar">' +
        '<span style="font-size:.78rem;font-weight:800;color:var(--t1);">' + (isAssign ? 'Bulk Assign' : 'Bulk Reassign') + '</span>' +
        '<select id="psdBulkAgent" class="filter-select" style="font-size:.82rem;padding:8px;min-width:180px;">' + psdAgentOptionsHTML('') + '</select>' +
        '<button type="button" class="export-btn" onclick="psdBulk' + (isAssign ? 'Assign' : 'Reassign') + '()" style="padding:8px 18px;">' +
        (isAssign ? 'Assign Selected' : 'Reassign Selected') + '</button>' +
        '<span class="psd-bulk-hint">Select rows using checkboxes, pick an agent, then click bulk action.</span></div>';
}

// ============================================================
// PSD DASHBOARD
// ============================================================
function psdUploadSectionHTML() {
    return '<div class="psd-panel"><div class="psd-panel-title"><i data-lucide="upload" style="width:18px;height:18px;color:var(--acc);"></i>Upload Activities</div>' +
        '<p style="font-size:.78rem;color:var(--t3);margin-bottom:1rem;">Each worksheet tab = <b>Category</b>. Duplicate Activity # skipped. New rows saved as <b>Pending</b>.</p>' +
        '<input type="file" id="psdFile" accept=".xlsx,.xls,.csv" onchange="psdParseFile(event)" class="psd-upload-zone" />' +
        '<div id="psdUploadPreview" style="margin-top:1rem;"></div></div>';
}

function psdRenderDashboard(body) {
    var base = psdAllItems;
    var items = psdApplyDashFilters(base);
    var s = psdSummary(items);

    body.innerHTML =
        psdFilterBarHTML(base) +
        '<div class="top-stats">' +
            psdTile('Total', s.total, 'Filtered view', 'var(--acc)') +
            psdTile('Pending', s.pending, 'Awaiting assign', psdStatusColor(PSD_STATUS.PENDING)) +
            psdTile('In Progress', s.inprogress, 'With agents', psdStatusColor(PSD_STATUS.INPROGRESS)) +
            psdTile('Completed', s.completed, 'Done', psdStatusColor(PSD_STATUS.COMPLETED)) +
            psdTile('Avg Aging', s.avgAging + ' d', 'Upload → now/done', 'var(--acc2)') +
            psdTile('Avg SLA', s.avgTtc + ' d', 'Assign/Reassign → done', 'var(--acc2)') +
        '</div>' +
        psdAgentTilesHTML(base) +
        '<div class="psd-chart-grid">' +
            psdChartCard('Status Breakdown', 'psdChartStatus', 'Pipeline mix', true) +
            psdChartCard('Completed by Agent', 'psdChartAgent', 'Throughput', true) +
            psdChartCard('By Category', 'psdChartCategory', 'Excel tabs', false) +
            psdChartCard('Aging Distribution', 'psdChartAging', 'Days since upload', false) +
        '</div>' +
        psdUploadSectionHTML() +
        psdGridSectionHTML('All Records', 'psdGrid', 'psdDashSearch', 'psdExportDashCsv()', items.length);

    psdBuildDashboardCharts(items, s);
    psdMountGrid('psdGrid', 'dash', items, 'records');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdChartCard(title, canvasId, subtitle, tall) {
    return '<div class="psd-chart-card"><div class="psd-chart-head"><h3>' + psdEsc(title) + '</h3><span>' + psdEsc(subtitle) + '</span></div>' +
        '<div class="psd-chart-body" style="height:' + (tall ? '300px' : '280px') + ';"><canvas id="' + canvasId + '"></canvas></div></div>';
}

function psdBuildDashboardCharts(items, s) {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = psdCssVar('--t2');
    Chart.defaults.font.family = 'Inter,sans-serif';
    var grid = 'rgba(148,163,184,0.12)';
    var legend = { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 11, weight: '600' } } };

    var sc = document.getElementById('psdChartStatus');
    if (sc) {
        var p = PSD_CHART_PALETTE;
        psdCharts.status = new Chart(sc, {
            type: 'doughnut',
            data: { labels: ['Pending', 'In Progress', 'Completed'], datasets: [{ data: [s.pending, s.inprogress, s.completed],
                backgroundColor: function (ctx) { var pal = [p.pending, p.inprogress, p.completed][ctx.dataIndex]; return psdLinearGradient(ctx.chart, pal.from, pal.to); },
                borderWidth: 3, borderColor: psdCssVar('--bg-card'), hoverOffset: 10, spacing: 3 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: legend, tooltip: psdChartTooltip() } },
            plugins: [psdCenterTextPlugin(s.total, 'Activities')]
        });
    }

    var byAgent = {};
    items.forEach(function (it) { if (it.PSDStatus === PSD_STATUS.COMPLETED && it.AssignedToName) byAgent[it.AssignedToName] = (byAgent[it.AssignedToName] || 0) + 1; });
    var names = Object.keys(byAgent).sort(function (a, b) { return byAgent[b] - byAgent[a]; });
    var ac = document.getElementById('psdChartAgent');
    if (ac) psdCharts.agent = new Chart(ac, {
        type: 'bar',
        data: { labels: names.length ? names : ['—'], datasets: [{ label: 'Completed', data: names.map(function (n) { return byAgent[n]; }),
            backgroundColor: function (ctx) { return psdLinearGradient(ctx.chart, PSD_CHART_PALETTE.agents[ctx.dataIndex % 6], psdCssVar('--acc2')); },
            borderRadius: 8, maxBarThickness: 48 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: psdChartTooltip() },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } } } }
    });

    var byCat = {};
    items.forEach(function (it) { var k = it.Category || 'Uncategorised'; byCat[k] = (byCat[k] || 0) + 1; });
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var cc = document.getElementById('psdChartCategory');
    if (cc) psdCharts.category = new Chart(cc, {
        type: 'bar', data: { labels: cats, datasets: [{ data: cats.map(function (c) { return byCat[c]; }), borderRadius: 8, barThickness: 18,
            backgroundColor: function (ctx) { var c = PSD_CHART_PALETTE.categories[ctx.dataIndex % 6]; var g = ctx.chart.ctx.createLinearGradient(ctx.chart.chartArea.left, 0, ctx.chart.chartArea.right, 0); g.addColorStop(0, c); g.addColorStop(1, psdCssVar('--acc2')); return g; } }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: psdChartTooltip() },
            scales: { x: { beginAtZero: true, grid: { color: grid } }, y: { grid: { display: false } } } }
    });

    var keys = ['0-2d', '3-5d', '6-10d', '11-20d', '20d+'], buckets = {};
    keys.forEach(function (k) { buckets[k] = 0; });
    items.forEach(function (it) {
        var ag = psdAging(it); if (ag == null) return;
        if (ag <= 2) buckets['0-2d']++; else if (ag <= 5) buckets['3-5d']++; else if (ag <= 10) buckets['6-10d']++;
        else if (ag <= 20) buckets['11-20d']++; else buckets['20d+']++;
    });
    var agc = document.getElementById('psdChartAging');
    if (agc) psdCharts.aging = new Chart(agc, {
        type: 'bar', data: { labels: keys, datasets: [{ data: keys.map(function (k) { return buckets[k]; }),
            backgroundColor: function (ctx) { return psdLinearGradient(ctx.chart, PSD_CHART_PALETTE.aging[ctx.dataIndex], psdCssVar('--acc')); }, borderRadius: 10, maxBarThickness: 56 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: psdChartTooltip() },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } } } }
    });
}

// ============================================================
// ASSIGN QUEUE + ASSIGNED QUEUE (ag-Grid)
// ============================================================
function psdRenderAssignQueue(body) {
    if (!psdAllAgents.length) { body.innerHTML = psdErrBox('No PSD agents in Account Mapping (Team = PSD).'); return; }
    var pending = psdAllItems.filter(function (it) { return it.PSDStatus === PSD_STATUS.PENDING; });
    body.innerHTML = psdBulkBarHTML('assign') + psdGridSectionHTML('Assign Queue — Pending', 'psdAssignGrid', 'psdAssignSearch', 'psdExportAssignCsv()', pending.length);
    psdMountGrid('psdAssignGrid', 'assign', pending, 'assign');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdRenderAssignedQueue(body) {
    if (!psdAllAgents.length) { body.innerHTML = psdErrBox('No PSD agents in Account Mapping (Team = PSD).'); return; }
    var assigned = psdAllItems.filter(function (it) { return it.PSDStatus === PSD_STATUS.INPROGRESS; });
    body.innerHTML = psdBulkBarHTML('reassign') + psdGridSectionHTML('Assigned Queue — In Progress', 'psdAssignedGrid', 'psdAssignedSearch', 'psdExportAssignedCsv()', assigned.length);
    psdMountGrid('psdAssignedGrid', 'assigned', assigned, 'assigned');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdGetRowAgentSelect(id, cls) {
    var sel = document.querySelector('.' + cls + '[data-id="' + id + '"]');
    return sel ? sel.value : (document.getElementById('psdBulkAgent') || {}).value || '';
}

async function psdDoAssign(pairs, isReassign) {
    if (!pairs.length) { psdToast('Select rows and an agent', 'warn'); return; }
    var digest;
    try { digest = await psdGetDigest(); } catch (e) { psdToast('Digest error', 'error'); return; }
    var now = new Date().toISOString(), ok = 0, fail = 0;
    for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        var agent = psdAllAgents.find(function (a) { return a.name === p.agentName; });
        if (!agent) { fail++; continue; }
        try {
            var uid = await psdResolveUserId(agent.email, agent.name);
            if (!uid) { fail++; continue; }
            var fields = { AssignedToId: uid, PSDStatus: PSD_STATUS.INPROGRESS };
            if (isReassign) fields.ReassignDate = now;
            else fields.AssignmentDate = now;
            await psdUpdateItem(p.id, fields, digest);
            ok++;
        } catch (e) { console.error('[PSD]', e); fail++; }
    }
    psdToast((isReassign ? 'Reassigned ' : 'Assigned ') + ok + (fail ? ', ' + fail + ' failed' : ''), fail ? 'warn' : 'success');
    await psdFetchItems();
    psdRenderTabBody();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.psdAssignRow = function (id) {
    var name = psdGetRowAgentSelect(id, 'psd-row-agent');
    if (!name) { psdToast('Pick an agent', 'warn'); return; }
    psdDoAssign([{ id: id, agentName: name }], false);
};

window.psdReassignRow = function (id) {
    var name = psdGetRowAgentSelect(id, 'psd-row-reassign');
    if (!name) { psdToast('Pick an agent to reassign', 'warn'); return; }
    psdDoAssign([{ id: id, agentName: name }], true);
};

window.psdBulkAssign = function () {
    var name = (document.getElementById('psdBulkAgent') || {}).value;
    if (!name) { psdToast('Pick an agent', 'warn'); return; }
    var rows = psdGetSelectedRows('assign');
    if (!rows.length) { psdToast('Select at least one row', 'warn'); return; }
    psdDoAssign(rows.map(function (r) { return { id: r.ID, agentName: name }; }), false);
};

window.psdBulkReassign = function () {
    var name = (document.getElementById('psdBulkAgent') || {}).value;
    if (!name) { psdToast('Pick an agent', 'warn'); return; }
    var rows = psdGetSelectedRows('assigned');
    if (!rows.length) { psdToast('Select at least one row', 'warn'); return; }
    psdDoAssign(rows.map(function (r) { return { id: r.ID, agentName: name }; }), true);
};

// ============================================================
// UPLOAD
// ============================================================
window.psdParseFile = function (ev) {
    var file = ev.target.files && ev.target.files[0], prev = document.getElementById('psdUploadPreview');
    if (!file || typeof XLSX === 'undefined') return;
    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            psdUploadRows = [];
            wb.SheetNames.forEach(function (sheet) {
                var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', blankrows: false, raw: false });
                for (var r = 1; r < aoa.length; r++) {
                    var row = aoa[r]; if (!row || !row.length) continue;
                    var rec = { Category: sheet };
                    PSD_COLS.forEach(function (col, idx) { rec[col.key] = (row[idx] != null ? String(row[idx]).trim() : ''); });
                    if (rec.ActivityNumber) psdUploadRows.push(rec);
                }
            });
            psdRenderUploadPreview();
        } catch (err) { prev.innerHTML = psdErrBox(psdEsc(err.message)); }
    };
    reader.readAsArrayBuffer(file);
};

function psdRenderUploadPreview() {
    var prev = document.getElementById('psdUploadPreview');
    var existing = {}; psdAllItems.forEach(function (it) { if (it.ActivityNumber) existing[it.ActivityNumber] = true; });
    var seen = {}, toAdd = [], dupE = 0;
    psdUploadRows.forEach(function (rec) {
        if (existing[rec.ActivityNumber] || seen[rec.ActivityNumber]) { dupE++; return; }
        seen[rec.ActivityNumber] = true; toAdd.push(rec);
    });
    psdUploadRows._toAdd = toAdd;
    prev.innerHTML = '<div style="font-size:.82rem;color:var(--t2);margin-bottom:.75rem;"><b>' + toAdd.length + '</b> new · <b>' + dupE + '</b> skipped (duplicate)</div>' +
        (toAdd.length ? '<button type="button" class="export-btn" id="psdConfirmUploadBtn" onclick="psdConfirmUpload()">Confirm Upload (' + toAdd.length + ')</button>' : '<div style="color:var(--t3);">Nothing new to upload.</div>') +
        '<div id="psdUploadProgress" style="margin-top:.75rem;"></div>';
}

window.psdConfirmUpload = async function () {
    var toAdd = psdUploadRows._toAdd || [];
    if (!toAdd.length) return;
    var digest, now = new Date().toISOString(), ok = 0;
    try { digest = await psdGetDigest(); } catch (e) { psdToast('Digest error', 'error'); return; }
    for (var i = 0; i < toAdd.length; i++) {
        var rec = toAdd[i], fields = { Title: rec.ActivityNumber, Category: rec.Category, PSDStatus: PSD_STATUS.PENDING, UploadDate: now };
        PSD_COLS.forEach(function (col) { fields[col.key] = rec[col.key] || ''; });
        try { await psdCreateItem(fields, digest); ok++; } catch (e) { console.error(e); }
    }
    psdToast('Uploaded ' + ok + ' activities', 'success');
    await psdFetchItems();
    psdRenderTabBody();
};

function psdErrBox(msg) {
    return '<div style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:12px;font-size:.8rem;font-weight:600;">' + msg + '</div>';
}

// ============================================================
// MY QUEUE (Agent)
// ============================================================
function psdRenderMyQueue(body) {
    var mine = psdScopedItems();
    var s = psdSummary(mine);
    var inq = mine.filter(function (it) { return it.PSDStatus === PSD_STATUS.INPROGRESS; });

    body.innerHTML =
        '<div class="top-stats">' +
            psdTile('In Queue', s.inprogress, 'Open', psdStatusColor(PSD_STATUS.INPROGRESS)) +
            psdTile('Completed', s.completed, 'By you', psdStatusColor(PSD_STATUS.COMPLETED)) +
            psdTile('Total Assigned', mine.length, 'All time', 'var(--acc)') +
            psdTile('Avg SLA', s.avgTtc + ' d', 'Assign/Reassign → done', 'var(--acc2)') +
        '</div>' +
        psdGridSectionHTML('My Queue — In Progress', 'psdAgentQueueGrid', 'psdAgentSearch', 'psdExportAgentQueueCsv()', inq.length) +
        psdGridSectionHTML('My Records', 'psdAgentGrid', 'psdAgentRecSearch', 'psdExportAgentRecordsCsv()', mine.length);

    psdMountGrid('psdAgentQueueGrid', 'agentQueue', inq, 'agentqueue');
    psdMountGrid('psdAgentGrid', 'agentRecords', mine, 'records');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.psdComplete = async function (id) {
    var digest;
    try { digest = await psdGetDigest(); } catch (e) { psdToast('Digest error', 'error'); return; }
    try {
        await psdUpdateItem(id, { PSDStatus: PSD_STATUS.COMPLETED, CompletedDate: new Date().toISOString() }, digest);
        psdToast('Marked completed', 'success');
        await psdFetchItems();
        psdRenderTabBody();
    } catch (e) { psdToast('Could not complete', 'error'); }
};

// ============================================================
// DUMMY DATA
// ============================================================
function psdDummyAgents() {
    return [{ name: 'Sanskar', email: 'sanskar@du.ae' }, { name: 'Hussain', email: 'hussain@du.ae' }, { name: 'Ameena', email: 'ameena@du.ae' }];
}

function psdDummyItems() {
    var cats = ['O365 Provisioning', 'DNS', 'Migration'], agents = ['Sanskar', 'Hussain', 'Ameena'], out = [];
    for (var i = 0; i < 40; i++) {
        var st = i % 3 === 0 ? PSD_STATUS.PENDING : (i % 3 === 1 ? PSD_STATUS.INPROGRESS : PSD_STATUS.COMPLETED);
        var up = new Date(Date.now() - (i + 2) * 86400000).toISOString();
        var asg = st !== PSD_STATUS.PENDING ? new Date(Date.now() - (i + 1) * 86400000).toISOString() : null;
        var rea = (st === PSD_STATUS.INPROGRESS && i % 5 === 0) ? new Date(Date.now() - i * 86400000).toISOString() : null;
        var cmp = st === PSD_STATUS.COMPLETED ? new Date(Date.now() - i * 86400000).toISOString() : null;
        out.push({
            ID: i + 1, ActivityNumber: '1-DUMMY' + (1000 + i), OrderNumber: '1-' + (600000000 + i),
            Category: cats[i % 3], CustomerAccount: 'Customer ' + (i + 1) + ' LLC',
            Description: 'O365 Provisioning : demo' + i, Product: i % 2 ? 'BU' : 'BS Pro',
            PSDStatus: st, UploadDate: up, AssignmentDate: asg, ReassignDate: rea, CompletedDate: cmp,
            AssignedToName: st === PSD_STATUS.PENDING ? '' : agents[i % 3], AssignedToEmail: ''
        });
    }
    return out;
}
