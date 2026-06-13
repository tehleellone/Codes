// ============================================================
// psd-assignment.js — PSD Assignment Module v1
// List: PSD_Assignments | Agents: Account Mapping (Team = PSD)
// Roles: Admin (SM Admin) / PSD_Admin / PSD_Agent
// Mirrors the SM portal module pattern (window.USER_CONTEXT, SP REST).
// ============================================================

var PSD_DUMMY_MODE = false;            // set true to preview UI with fake data (no SharePoint)

var PSD_LIST       = 'PSD_Assignments';
var PSD_AGENT_LIST = 'Account Mapping';
var PSD_TEAM       = 'PSD';

// ── State ─────────────────────────────────────────────────────
var psdAllItems   = [];
var psdAllAgents  = [];
var psdEntityType = null;              // resolved ListItemEntityTypeFullName (cached)
var psdActiveTab  = 'dashboard';
var psdCharts     = {};
var psdGridApi    = null;
var psdUploadRows = [];                // parsed rows pending confirmation

// ── Excel template column map (by POSITION — headers repeat) ──
// The uploaded sheet must keep this exact column order.
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

// ── Role helpers ──────────────────────────────────────────────
function psdRole()        { return (window.USER_CONTEXT && window.USER_CONTEXT.role) || 'none'; }
function psdUserName()    { return (window.USER_CONTEXT && window.USER_CONTEXT.userName) || ''; }
function psdUserEmail()   { return (window.USER_CONTEXT && window.USER_CONTEXT.userEmail) || ''; }
function psdIsSMAdmin()   { return psdRole() === 'Admin'; }
function psdIsPsdAdmin()  { return psdRole() === 'PSD_Admin'; }
function psdIsAdminLike() { return psdIsSMAdmin() || psdIsPsdAdmin(); }
function psdIsAgent()     { return psdRole() === 'PSD_Agent'; }
function psdHasAccess()   { return psdIsAdminLike() || psdIsAgent(); }

// ── Small utilities ───────────────────────────────────────────
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

// Aging = days from upload until completion (or until now if not completed)
function psdAging(item) {
    var end = item.PSDStatus === PSD_STATUS.COMPLETED ? item.CompletedDate : new Date().toISOString();
    return psdDaysBetween(item.UploadDate, end);
}
// Time to complete = assignment -> completion (only meaningful when completed)
function psdTimeToComplete(item) {
    if (item.PSDStatus !== PSD_STATUS.COMPLETED) return null;
    return psdDaysBetween(item.AssignmentDate || item.UploadDate, item.CompletedDate);
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
    return '#94a3b8'; // Pending
}

function psdToast(msg, type) {
    var bg = type === 'error' ? '#ef4444' : (type === 'warn' ? '#f59e0b' : '#22c55e');
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99999;background:' + bg +
        ';color:#fff;padding:14px 20px;border-radius:12px;font-weight:700;font-size:.85rem;' +
        'box-shadow:0 8px 28px rgba(0,0,0,.25);max-width:380px;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 3200);
    setTimeout(function () { t.remove(); }, 3700);
}

// ============================================================
// SHAREPOINT DATA LAYER
// ============================================================
async function psdGetDigest() {
    var r = await fetch(SP_URL + '/_api/contextinfo', {
        method: 'POST',
        headers: { 'Accept': 'application/json;odata=verbose' },
        credentials: 'include'
    });
    var j = await r.json();
    return j.d.GetContextWebInformation.FormDigestValue;
}

async function psdGetEntityType() {
    if (psdEntityType) return psdEntityType;
    var url = SP_URL + "/_api/web/lists/getbytitle('" + PSD_LIST + "')?$select=ListItemEntityTypeFullName";
    var r = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    var j = await r.json();
    psdEntityType = j.d.ListItemEntityTypeFullName; // e.g. SP.Data.PSD_x005f_AssignmentsListItem
    return psdEntityType;
}

// PSD AGENTS = Account Mapping rows where Team = PSD
async function psdFetchAgents() {
    if (PSD_DUMMY_MODE) { psdAllAgents = psdDummyAgents(); return; }
    var url = SP_URL + "/_api/web/lists/getbytitle('" + PSD_AGENT_LIST + "')/items?" +
        "$select=Service_Manager_Name,Email_ID,Team,User_ID" +
        "&$filter=Team eq '" + psdOdata(PSD_TEAM) + "'&$top=5000&$orderby=Service_Manager_Name asc";
    var r = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!r.ok) { console.warn('[PSD] fetchAgents', r.status); psdAllAgents = []; return; }
    var data = await r.json();
    var seen = {};
    psdAllAgents = [];
    (data.d.results || []).forEach(function (it) {
        var name = (it.Service_Manager_Name || '').trim();
        if (!name || seen[name]) return;
        seen[name] = true;
        psdAllAgents.push({ name: name, email: it.Email_ID || '', userId: it.User_ID || '' });
    });
}

// PSD ASSIGNMENTS
async function psdFetchItems() {
    if (PSD_DUMMY_MODE) { psdAllItems = psdDummyItems(); return; }
    var cols = PSD_COLS.map(function (c) { return c.key; }).join(',');
    var url = SP_URL + "/_api/web/lists/getbytitle('" + PSD_LIST + "')/items?" +
        "$select=ID," + cols + ",Category,PSDStatus,UploadDate,AssignmentDate,CompletedDate," +
        "AssignedTo/Title,AssignedTo/EMail" +
        "&$expand=AssignedTo&$orderby=ID desc&$top=5000";
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
        var u = SP_URL + "/_api/web/siteusers?$filter=Email eq '" + psdOdata(email) + "'&$select=Id&$top=1";
        var r = await fetch(u, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (r.ok) { var d = await r.json(); if (d.d.results && d.d.results.length) return d.d.results[0].Id; }
    }
    if (name) {
        var u2 = SP_URL + "/_api/web/siteusers?$filter=Title eq '" + psdOdata(name) + "'&$select=Id&$top=1";
        var r2 = await fetch(u2, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (r2.ok) { var d2 = await r2.json(); if (d2.d.results && d2.d.results.length) return d2.d.results[0].Id; }
    }
    return null;
}

async function psdCreateItem(fields, digest) {
    var type = await psdGetEntityType();
    var body = Object.assign({ __metadata: { type: type } }, fields);
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PSD_LIST + "')/items", {
        method: 'POST',
        headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest
        },
        credentials: 'include',
        body: JSON.stringify(body)
    });
    if (!r.ok) { var t = await r.text(); throw new Error('Create failed: ' + r.status + ' ' + t.slice(0, 200)); }
    return r.json();
}

async function psdUpdateItem(id, fields, digest) {
    var type = await psdGetEntityType();
    var body = Object.assign({ __metadata: { type: type } }, fields);
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PSD_LIST + "')/items(" + id + ")", {
        method: 'POST',
        headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest,
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE'
        },
        credentials: 'include',
        body: JSON.stringify(body)
    });
    if (!r.ok) { var t = await r.text(); throw new Error('Update failed: ' + r.status + ' ' + t.slice(0, 200)); }
    return true;
}

// ============================================================
// ENTRY POINT
// ============================================================
window.psdInit = async function () {
    var loadingEl = document.getElementById('psdLoading');
    var contentEl = document.getElementById('psdContent');
    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    if (!psdHasAccess()) {
        if (loadingEl) loadingEl.innerHTML =
            '<div style="text-align:center;padding:50px;">' +
            '<div style="font-size:2rem;margin-bottom:10px;">🔒</div>' +
            '<div style="font-weight:800;color:var(--t1);">Access Restricted</div>' +
            '<div style="font-size:.82rem;color:var(--t3);margin-top:6px;">PSD Assignment is available to SM Admin, PSD Admin and PSD Agents only.</div>' +
            '</div>';
        return;
    }

    var timeout = new Promise(function (_, rej) {
        setTimeout(function () { rej(new Error('Request timed out — SharePoint may be unreachable')); }, 15000);
    });

    try {
        await Promise.race([Promise.all([psdFetchItems(), psdFetchAgents()]), timeout]);
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        // Default tab per role
        psdActiveTab = psdIsAgent() ? 'myqueue' : 'dashboard';
        psdRenderShell();
    } catch (e) {
        console.error('[PSD]', e);
        if (loadingEl) loadingEl.innerHTML =
            '<div style="text-align:center;padding:40px;">' +
            '<div style="font-size:2rem;margin-bottom:12px;">⚠️</div>' +
            '<div style="font-weight:700;color:var(--t1);margin-bottom:8px;">Could not load PSD data</div>' +
            '<div style="font-size:.82rem;color:var(--t3);margin-bottom:20px;">' + psdEsc(e.message) + '</div>' +
            '<button type="button" class="export-btn" onclick="psdInit()" style="padding:10px 24px;">Retry</button>' +
            '</div>';
    }
};

// ── Scoping: agent sees only their own items ──────────────────
function psdScopedItems() {
    if (psdIsAdminLike()) return psdAllItems;
    var me = psdUserName(), myEmail = (psdUserEmail() || '').toLowerCase();
    return psdAllItems.filter(function (it) {
        return it.AssignedToName === me ||
               (it.AssignedToEmail && it.AssignedToEmail.toLowerCase() === myEmail);
    });
}

// ============================================================
// SHELL + TABS
// ============================================================
function psdTabsForRole() {
    if (psdIsAgent()) {
        return [
            { id: 'myqueue', label: 'My Queue',   icon: 'inbox' },
            { id: 'records', label: 'My Records', icon: 'list' }
        ];
    }
    return [
        { id: 'dashboard', label: 'Dashboard',         icon: 'layout-dashboard' },
        { id: 'upload',    label: 'Upload',            icon: 'upload' },
        { id: 'assign',    label: 'Assign Queue',      icon: 'user-plus' },
        { id: 'agents',    label: 'Agent Performance', icon: 'users' },
        { id: 'records',   label: 'All Records',       icon: 'list' }
    ];
}

function psdRenderShell() {
    var c = document.getElementById('psdContainer');
    if (!c) return;
    var tabs = psdTabsForRole();
    var tabBtns = tabs.map(function (t) {
        var active = t.id === psdActiveTab;
        return '<button type="button" onclick="psdSwitchTab(\'' + t.id + '\')" ' +
            'style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700;border:1px solid ' +
            (active ? 'transparent' : 'var(--border)') + ';background:' +
            (active ? 'var(--grad)' : 'var(--bg-card)') + ';color:' + (active ? '#fff' : 'var(--t2)') + ';">' +
            '<i data-lucide="' + t.icon + '" style="width:15px;height:15px;"></i>' + t.label + '</button>';
    }).join('');

    c.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:1rem;">' +
            '<div>' +
                '<h2 style="font-size:1.15rem;font-weight:900;color:var(--t1);display:flex;align-items:center;gap:.5rem;">' +
                '<i data-lucide="clipboard-list" style="width:24px;height:24px;color:var(--acc);"></i>PSD Assignment</h2>' +
                '<div style="font-size:.76rem;color:var(--t3);margin-top:3px;">' + psdEsc(psdRoleLabel()) + ' · ' + psdEsc(psdUserName()) + '</div>' +
            '</div>' +
            '<button type="button" class="export-btn" onclick="psdInit()" style="padding:9px 18px;">' +
            '<i data-lucide="refresh-cw" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Refresh</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.1rem;">' + tabBtns + '</div>' +
        '<div id="psdTabBody"></div>';

    psdRenderTabBody();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdRoleLabel() {
    if (psdIsSMAdmin())  return 'SM Admin';
    if (psdIsPsdAdmin()) return 'PSD Admin';
    if (psdIsAgent())    return 'PSD Agent';
    return psdRole();
}

window.psdSwitchTab = function (id) {
    psdActiveTab = id;
    psdRenderShell();
};

function psdRenderTabBody() {
    var body = document.getElementById('psdTabBody');
    if (!body) return;
    psdDestroyCharts();
    if (psdActiveTab === 'dashboard') return psdRenderDashboard(body);
    if (psdActiveTab === 'upload')    return psdRenderUpload(body);
    if (psdActiveTab === 'assign')    return psdRenderAssign(body);
    if (psdActiveTab === 'agents')    return psdRenderAgents(body);
    if (psdActiveTab === 'myqueue')   return psdRenderMyQueue(body);
    if (psdActiveTab === 'records')   return psdRenderRecords(body);
}

function psdDestroyCharts() {
    Object.keys(psdCharts).forEach(function (k) {
        try { psdCharts[k].destroy(); } catch (e) {}
    });
    psdCharts = {};
}

// ── Tile builder ──────────────────────────────────────────────
function psdTile(label, value, subtitle, color) {
    return '<div class="stat-card">' +
        '<div class="stat-label">' + psdEsc(label) + '</div>' +
        '<div class="stat-value"' + (color ? ' style="color:' + color + ';"' : '') + '>' + psdEsc(String(value)) + '</div>' +
        (subtitle ? '<div class="stat-subtitle">' + psdEsc(subtitle) + '</div>' : '') +
        '</div>';
}

function psdSummary(items) {
    var s = { total: items.length, pending: 0, inprogress: 0, completed: 0, agingSum: 0, agingN: 0, ttcSum: 0, ttcN: 0 };
    items.forEach(function (it) {
        if (it.PSDStatus === PSD_STATUS.PENDING) s.pending++;
        else if (it.PSDStatus === PSD_STATUS.INPROGRESS) s.inprogress++;
        else if (it.PSDStatus === PSD_STATUS.COMPLETED) s.completed++;
        var ag = psdAging(it);
        if (ag != null) { s.agingSum += ag; s.agingN++; }
        var ttc = psdTimeToComplete(it);
        if (ttc != null) { s.ttcSum += ttc; s.ttcN++; }
    });
    s.avgAging = s.agingN ? Math.round(s.agingSum / s.agingN) : 0;
    s.avgTtc   = s.ttcN ? Math.round(s.ttcSum / s.ttcN) : 0;
    return s;
}

// ============================================================
// DASHBOARD (Admin / PSD Admin)
// ============================================================
function psdRenderDashboard(body) {
    var items = psdAllItems;
    var s = psdSummary(items);

    var tiles =
        psdTile('Total Activities', s.total, 'All uploaded', 'var(--acc)') +
        psdTile('Pending', s.pending, 'Awaiting assignment', psdStatusColor(PSD_STATUS.PENDING)) +
        psdTile('In Progress', s.inprogress, 'Assigned to agents', psdStatusColor(PSD_STATUS.INPROGRESS)) +
        psdTile('Completed', s.completed, 'Done', psdStatusColor(PSD_STATUS.COMPLETED)) +
        psdTile('Avg Aging', s.avgAging + ' d', 'Upload → done/now', 'var(--acc2)') +
        psdTile('Avg Time to Complete', s.avgTtc + ' d', 'Assign → completed', 'var(--acc2)');

    body.innerHTML =
        '<div class="top-stats">' + tiles + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem;margin-top:1rem;">' +
            psdChartCard('Status Breakdown', 'psdChartStatus') +
            psdChartCard('Completed by Agent', 'psdChartAgent') +
            psdChartCard('Activities by Category', 'psdChartCategory') +
            psdChartCard('Aging Distribution', 'psdChartAging') +
        '</div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();
    psdBuildDashboardCharts(items, s);
}

function psdChartCard(title, canvasId) {
    return '<div class="chart-card">' +
        '<h3 class="chart-title" style="font-size:.95rem;font-weight:800;color:var(--t1);margin-bottom:.7rem;">' + psdEsc(title) + '</h3>' +
        '<div style="position:relative;height:260px;"><canvas id="' + canvasId + '"></canvas></div>' +
        '</div>';
}

function psdCssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || '#a855f7';
}

function psdBuildDashboardCharts(items, s) {
    if (typeof Chart === 'undefined') return;
    var acc = psdCssVar('--acc'), t2 = psdCssVar('--t2'), grid = 'rgba(140,140,160,0.15)';
    Chart.defaults.color = t2;
    Chart.defaults.font.family = 'Inter, sans-serif';

    // Status doughnut
    var sc = document.getElementById('psdChartStatus');
    if (sc) psdCharts.status = new Chart(sc, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'In Progress', 'Completed'],
            datasets: [{
                data: [s.pending, s.inprogress, s.completed],
                backgroundColor: [psdStatusColor(PSD_STATUS.PENDING), psdStatusColor(PSD_STATUS.INPROGRESS), psdStatusColor(PSD_STATUS.COMPLETED)],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } }
    });

    // Completed by agent
    var byAgent = {};
    items.forEach(function (it) {
        if (it.PSDStatus === PSD_STATUS.COMPLETED && it.AssignedToName) {
            byAgent[it.AssignedToName] = (byAgent[it.AssignedToName] || 0) + 1;
        }
    });
    var agentNames = Object.keys(byAgent).sort(function (a, b) { return byAgent[b] - byAgent[a]; });
    var ac = document.getElementById('psdChartAgent');
    if (ac) psdCharts.agent = new Chart(ac, {
        type: 'bar',
        data: { labels: agentNames, datasets: [{ label: 'Completed', data: agentNames.map(function (n) { return byAgent[n]; }), backgroundColor: acc, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } } } }
    });

    // By category
    var byCat = {};
    items.forEach(function (it) { var k = it.Category || 'Uncategorised'; byCat[k] = (byCat[k] || 0) + 1; });
    var catNames = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var cc = document.getElementById('psdChartCategory');
    if (cc) psdCharts.category = new Chart(cc, {
        type: 'bar',
        data: { labels: catNames, datasets: [{ label: 'Activities', data: catNames.map(function (n) { return byCat[n]; }), backgroundColor: psdCssVar('--acc2'), borderRadius: 6 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } }, y: { grid: { display: false } } } }
    });

    // Aging buckets
    var buckets = { '0-2d': 0, '3-5d': 0, '6-10d': 0, '11-20d': 0, '20d+': 0 };
    items.forEach(function (it) {
        var ag = psdAging(it); if (ag == null) return;
        if (ag <= 2) buckets['0-2d']++; else if (ag <= 5) buckets['3-5d']++;
        else if (ag <= 10) buckets['6-10d']++; else if (ag <= 20) buckets['11-20d']++; else buckets['20d+']++;
    });
    var agc = document.getElementById('psdChartAging');
    if (agc) psdCharts.aging = new Chart(agc, {
        type: 'bar',
        data: { labels: Object.keys(buckets), datasets: [{ label: 'Activities', data: Object.values(buckets), backgroundColor: '#f59e0b', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } } } }
    });
}

// ============================================================
// AGENT PERFORMANCE (Admin / PSD Admin)
// ============================================================
function psdRenderAgents(body) {
    var stats = {};
    psdAllAgents.forEach(function (a) { stats[a.name] = { name: a.name, email: a.email, assigned: 0, pending: 0, inprogress: 0, completed: 0, agingSum: 0, agingN: 0 }; });
    psdAllItems.forEach(function (it) {
        if (!it.AssignedToName) return;
        if (!stats[it.AssignedToName]) stats[it.AssignedToName] = { name: it.AssignedToName, email: it.AssignedToEmail || '', assigned: 0, pending: 0, inprogress: 0, completed: 0, agingSum: 0, agingN: 0 };
        var st = stats[it.AssignedToName];
        st.assigned++;
        if (it.PSDStatus === PSD_STATUS.INPROGRESS) st.inprogress++;
        else if (it.PSDStatus === PSD_STATUS.COMPLETED) {
            st.completed++;
            var ttc = psdTimeToComplete(it);
            if (ttc != null) { st.agingSum += ttc; st.agingN++; }
        }
    });
    var rows = Object.keys(stats).map(function (k) { return stats[k]; })
        .sort(function (a, b) { return b.completed - a.completed; });

    var tiles = rows.map(function (st) {
        var avg = st.agingN ? Math.round(st.agingSum / st.agingN) : 0;
        var rate = st.assigned ? Math.round((st.completed / st.assigned) * 100) : 0;
        return '<div class="stat-card">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:.6rem;">' +
                '<div style="width:38px;height:38px;border-radius:50%;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;">' + psdEsc(psdInitials(st.name)) + '</div>' +
                '<div><div style="font-weight:800;color:var(--t1);font-size:.9rem;">' + psdEsc(st.name) + '</div>' +
                '<div style="font-size:.7rem;color:var(--t3);">' + psdEsc(st.email || '') + '</div></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;">' +
                psdMiniStat('Assigned', st.assigned, 'var(--acc)') +
                psdMiniStat('In Progress', st.inprogress, psdStatusColor(PSD_STATUS.INPROGRESS)) +
                psdMiniStat('Completed', st.completed, psdStatusColor(PSD_STATUS.COMPLETED)) +
                psdMiniStat('Avg TTC', avg + 'd', 'var(--acc2)') +
            '</div>' +
            '<div style="margin-top:.7rem;height:7px;border-radius:6px;background:var(--bg-secondary);overflow:hidden;">' +
                '<div style="height:100%;width:' + rate + '%;background:var(--grad);"></div></div>' +
            '<div style="font-size:.68rem;color:var(--t3);margin-top:4px;text-align:right;">' + rate + '% completion rate</div>' +
            '</div>';
    }).join('');

    body.innerHTML = rows.length
        ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem;">' + tiles + '</div>'
        : '<div style="text-align:center;padding:50px;color:var(--t3);">No PSD agents found in the Account Mapping list (Team = PSD).</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdMiniStat(label, value, color) {
    return '<div style="background:var(--bg-secondary);border-radius:8px;padding:.5rem .6rem;">' +
        '<div style="font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;color:var(--t3);font-weight:700;">' + psdEsc(label) + '</div>' +
        '<div style="font-size:1.05rem;font-weight:900;color:' + (color || 'var(--t1)') + ';">' + psdEsc(String(value)) + '</div>' +
        '</div>';
}

function psdInitials(name) {
    if (!name) return '?';
    var p = name.trim().split(/\s+/);
    return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

// ============================================================
// UPLOAD (Admin / PSD Admin) — parse Excel, dedup, bulk insert
// ============================================================
function psdRenderUpload(body) {
    body.innerHTML =
        '<div class="filters-section" style="max-width:760px;">' +
            '<h3 style="font-size:1rem;font-weight:800;color:var(--t1);margin-bottom:.4rem;display:flex;align-items:center;gap:.4rem;">' +
            '<i data-lucide="upload" style="width:18px;height:18px;color:var(--acc);"></i>Upload Activities</h3>' +
            '<p style="font-size:.78rem;color:var(--t3);margin-bottom:1rem;">' +
            'Each worksheet (tab) becomes a <b>Category</b>. Keep the column order from the template. ' +
            'Existing <b>Activity #</b> values are skipped. New rows are added as <b>Pending</b> with today as the Upload Date.</p>' +
            '<input type="file" id="psdFile" accept=".xlsx,.xls,.csv" onchange="psdParseFile(event)" ' +
            'style="display:block;width:100%;padding:14px;border:2px dashed var(--border-s);border-radius:12px;background:var(--bg-input);color:var(--t2);cursor:pointer;font-size:.85rem;" />' +
            '<div id="psdUploadPreview" style="margin-top:1rem;"></div>' +
        '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.psdParseFile = function (ev) {
    var file = ev.target.files && ev.target.files[0];
    var prev = document.getElementById('psdUploadPreview');
    if (!file) return;
    if (typeof XLSX === 'undefined') { prev.innerHTML = psdErrBox('XLSX library not loaded on the page.'); return; }

    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            psdUploadRows = [];
            wb.SheetNames.forEach(function (sheetName) {
                var ws = wb.Sheets[sheetName];
                var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false });
                if (!aoa.length) return;
                // skip header row (row 0)
                for (var r = 1; r < aoa.length; r++) {
                    var row = aoa[r];
                    if (!row || !row.length) continue;
                    var rec = { Category: sheetName };
                    PSD_COLS.forEach(function (col, idx) { rec[col.key] = (row[idx] != null ? String(row[idx]).trim() : ''); });
                    if (!rec.ActivityNumber) continue; // must have an Activity #
                    psdUploadRows.push(rec);
                }
            });
            psdRenderUploadPreview();
        } catch (err) {
            prev.innerHTML = psdErrBox('Failed to read file: ' + psdEsc(err.message));
        }
    };
    reader.readAsArrayBuffer(file);
};

function psdRenderUploadPreview() {
    var prev = document.getElementById('psdUploadPreview');
    var existing = {};
    psdAllItems.forEach(function (it) { if (it.ActivityNumber) existing[it.ActivityNumber] = true; });

    var seen = {}, toAdd = [], dupInFile = 0, dupExisting = 0;
    psdUploadRows.forEach(function (rec) {
        if (existing[rec.ActivityNumber]) { dupExisting++; return; }
        if (seen[rec.ActivityNumber]) { dupInFile++; return; }
        seen[rec.ActivityNumber] = true;
        toAdd.push(rec);
    });

    var byCat = {};
    toAdd.forEach(function (r) { byCat[r.Category] = (byCat[r.Category] || 0) + 1; });
    var catSummary = Object.keys(byCat).map(function (k) {
        return '<span style="display:inline-block;background:var(--chip);color:var(--t2);border-radius:20px;padding:3px 12px;font-size:.72rem;font-weight:700;margin:2px;">' +
            psdEsc(k) + ': ' + byCat[k] + '</span>';
    }).join('');

    var sample = toAdd.slice(0, 5).map(function (r) {
        return '<tr><td style="padding:5px 8px;font-weight:700;">' + psdEsc(r.ActivityNumber) + '</td>' +
            '<td style="padding:5px 8px;">' + psdEsc(r.Category) + '</td>' +
            '<td style="padding:5px 8px;">' + psdEsc(r.CustomerAccount) + '</td>' +
            '<td style="padding:5px 8px;">' + psdEsc((r.Description || '').slice(0, 50)) + '</td></tr>';
    }).join('');

    prev.innerHTML =
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:.8rem;">' +
            psdMiniStat('New to add', toAdd.length, 'var(--acc)') +
            psdMiniStat('Already exists (skip)', dupExisting, '#94a3b8') +
            psdMiniStat('Duplicate in file', dupInFile, '#f59e0b') +
            psdMiniStat('Rows read', psdUploadRows.length, 'var(--t2)') +
        '</div>' +
        (catSummary ? '<div style="margin-bottom:.8rem;">' + catSummary + '</div>' : '') +
        (toAdd.length
            ? '<table style="width:100%;border-collapse:collapse;font-size:.74rem;color:var(--t2);margin-bottom:1rem;">' +
              '<thead><tr style="border-bottom:2px solid var(--border-s);text-align:left;">' +
              '<th style="padding:5px 8px;">Activity #</th><th style="padding:5px 8px;">Category</th>' +
              '<th style="padding:5px 8px;">Customer</th><th style="padding:5px 8px;">Description</th></tr></thead>' +
              '<tbody>' + sample + '</tbody></table>' +
              (toAdd.length > 5 ? '<div style="font-size:.72rem;color:var(--t3);margin-bottom:1rem;">…and ' + (toAdd.length - 5) + ' more.</div>' : '') +
              '<button type="button" class="export-btn" id="psdConfirmUploadBtn" onclick="psdConfirmUpload()" style="padding:11px 26px;">' +
              '<i data-lucide="check" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Confirm &amp; Upload ' + toAdd.length + ' Activities</button>'
            : '<div style="color:var(--t3);font-size:.82rem;padding:8px 0;">Nothing new to upload — all activities already exist.</div>') +
        '<div id="psdUploadProgress" style="margin-top:1rem;"></div>';

    // stash for confirm
    psdUploadRows._toAdd = toAdd;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.psdConfirmUpload = async function () {
    var toAdd = psdUploadRows._toAdd || [];
    if (!toAdd.length) return;
    var btn = document.getElementById('psdConfirmUploadBtn');
    var prog = document.getElementById('psdUploadProgress');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

    var nowIso = new Date().toISOString();
    var ok = 0, fail = 0, digest;
    try { digest = await psdGetDigest(); }
    catch (e) { prog.innerHTML = psdErrBox('Could not get form digest: ' + psdEsc(e.message)); if (btn) { btn.disabled = false; btn.style.opacity = '1'; } return; }

    for (var i = 0; i < toAdd.length; i++) {
        var rec = toAdd[i];
        var fields = { Title: rec.ActivityNumber, Category: rec.Category, PSDStatus: PSD_STATUS.PENDING, UploadDate: nowIso };
        PSD_COLS.forEach(function (col) { fields[col.key] = rec[col.key] || ''; });
        try { await psdCreateItem(fields, digest); ok++; }
        catch (e) { console.error('[PSD] create', rec.ActivityNumber, e); fail++; }
        if (i % 5 === 0 || i === toAdd.length - 1) {
            prog.innerHTML = '<div style="font-size:.8rem;color:var(--t2);">Uploading… ' + (i + 1) + ' / ' + toAdd.length +
                ' <span style="color:#22c55e;">(' + ok + ' ok' + (fail ? ', ' + fail + ' failed' : '') + ')</span></div>';
        }
    }

    prog.innerHTML = '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;font-size:.82rem;color:var(--t2);">' +
        '<b style="color:#22c55e;">Done.</b> Added ' + ok + ' activities' + (fail ? ', ' + fail + ' failed (see console)' : '') + '.</div>';
    psdToast('Uploaded ' + ok + ' activities', fail ? 'warn' : 'success');
    await psdFetchItems();
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
};

function psdErrBox(msg) {
    return '<div style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:12px 14px;font-size:.8rem;font-weight:600;">' + msg + '</div>';
}

// ============================================================
// ASSIGN QUEUE (Admin / PSD Admin) — Pending -> assign agent -> In Progress
// ============================================================
function psdRenderAssign(body) {
    var pending = psdAllItems.filter(function (it) { return it.PSDStatus === PSD_STATUS.PENDING; });
    if (!psdAllAgents.length) {
        body.innerHTML = psdErrBox('No PSD agents found. Add rows to the Account Mapping list with Team = "PSD".');
        return;
    }

    var agentOpts = '<option value="">— Select agent —</option>' +
        psdAllAgents.map(function (a) { return '<option value="' + psdEsc(a.name) + '">' + psdEsc(a.name) + '</option>'; }).join('');

    var rows = pending.map(function (it) {
        return '<tr data-id="' + it.ID + '" style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:8px;"><input type="checkbox" class="psdAssignChk" value="' + it.ID + '" style="width:15px;height:15px;accent-color:var(--acc);"></td>' +
            '<td style="padding:8px;font-weight:700;color:var(--t1);">' + psdEsc(it.ActivityNumber) + '</td>' +
            '<td style="padding:8px;">' + psdEsc(it.Category || '') + '</td>' +
            '<td style="padding:8px;">' + psdEsc(it.CustomerAccount || '') + '</td>' +
            '<td style="padding:8px;max-width:280px;">' + psdEsc((it.Description || '').slice(0, 70)) + '</td>' +
            '<td style="padding:8px;color:var(--t3);">' + psdFmtDate(it.UploadDate) + '</td>' +
            '<td style="padding:8px;"><select class="psdRowAgent filter-select" data-id="' + it.ID + '" style="font-size:.78rem;padding:6px;min-width:150px;">' + agentOpts + '</select></td>' +
            '<td style="padding:8px;"><button type="button" class="export-btn" style="padding:6px 12px;font-size:.72rem;" onclick="psdAssignRow(' + it.ID + ')">Assign</button></td>' +
            '</tr>';
    }).join('');

    body.innerHTML =
        '<div class="filters-section" style="display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;">' +
            '<div class="filter-group"><label class="filter-label">Bulk assign selected to</label>' +
            '<select id="psdBulkAgent" class="filter-select" style="font-size:.82rem;padding:9px;min-width:200px;">' + agentOpts + '</select></div>' +
            '<button type="button" class="export-btn" onclick="psdBulkAssign()" style="padding:10px 20px;">' +
            '<i data-lucide="user-plus" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Assign Selected</button>' +
            '<div style="margin-left:auto;font-size:.8rem;color:var(--t3);font-weight:700;">' + pending.length + ' pending</div>' +
        '</div>' +
        (pending.length
            ? '<div class="table-section" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.78rem;color:var(--t2);">' +
              '<thead><tr style="border-bottom:2px solid var(--border-s);text-align:left;color:var(--t1);">' +
              '<th style="padding:8px;"><input type="checkbox" onclick="psdToggleAll(this)" style="width:15px;height:15px;accent-color:var(--acc);"></th>' +
              '<th style="padding:8px;">Activity #</th><th style="padding:8px;">Category</th><th style="padding:8px;">Customer</th>' +
              '<th style="padding:8px;">Description</th><th style="padding:8px;">Uploaded</th><th style="padding:8px;">Assign To</th><th style="padding:8px;"></th></tr></thead>' +
              '<tbody>' + rows + '</tbody></table></div>'
            : '<div style="text-align:center;padding:50px;color:var(--t3);">🎉 No pending activities — everything is assigned.</div>');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.psdToggleAll = function (cb) {
    document.querySelectorAll('.psdAssignChk').forEach(function (c) { c.checked = cb.checked; });
};

async function psdDoAssign(pairs) {
    // pairs: [{id, agentName}]
    if (!pairs.length) { psdToast('Select activities and an agent first', 'warn'); return; }
    var digest;
    try { digest = await psdGetDigest(); } catch (e) { psdToast('Digest error: ' + e.message, 'error'); return; }
    var nowIso = new Date().toISOString();
    var ok = 0, fail = 0;
    for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        var agent = psdAllAgents.find(function (a) { return a.name === p.agentName; });
        if (!agent) { fail++; continue; }
        try {
            var uid = await psdResolveUserId(agent.email, agent.name);
            if (!uid) { console.warn('[PSD] no user id for', agent.name); fail++; continue; }
            await psdUpdateItem(p.id, { AssignedToId: uid, AssignmentDate: nowIso, PSDStatus: PSD_STATUS.INPROGRESS }, digest);
            ok++;
        } catch (e) { console.error('[PSD] assign', p.id, e); fail++; }
    }
    psdToast('Assigned ' + ok + (fail ? ', ' + fail + ' failed' : ''), fail ? 'warn' : 'success');
    await psdFetchItems();
    psdRenderTabBody();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.psdAssignRow = function (id) {
    var sel = document.querySelector('.psdRowAgent[data-id="' + id + '"]');
    var name = sel ? sel.value : '';
    if (!name) { psdToast('Pick an agent for this row', 'warn'); return; }
    psdDoAssign([{ id: id, agentName: name }]);
};

window.psdBulkAssign = function () {
    var name = (document.getElementById('psdBulkAgent') || {}).value || '';
    if (!name) { psdToast('Pick an agent to bulk-assign', 'warn'); return; }
    var ids = Array.prototype.map.call(document.querySelectorAll('.psdAssignChk:checked'), function (c) { return parseInt(c.value, 10); });
    if (!ids.length) { psdToast('Select at least one activity', 'warn'); return; }
    psdDoAssign(ids.map(function (id) { return { id: id, agentName: name }; }));
};

// ============================================================
// MY QUEUE (PSD Agent) — see in-queue, mark completed
// ============================================================
function psdRenderMyQueue(body) {
    var mine = psdScopedItems();
    var s = psdSummary(mine);
    var inq = mine.filter(function (it) { return it.PSDStatus === PSD_STATUS.INPROGRESS; });

    var tiles =
        psdTile('In Queue', s.inprogress, 'Assigned & open', psdStatusColor(PSD_STATUS.INPROGRESS)) +
        psdTile('Completed', s.completed, 'By you', psdStatusColor(PSD_STATUS.COMPLETED)) +
        psdTile('Total Assigned', mine.length, 'All time', 'var(--acc)') +
        psdTile('Avg Time to Complete', s.avgTtc + ' d', 'Assign → done', 'var(--acc2)');

    var rows = inq.map(function (it) {
        var ag = psdAging(it);
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:8px;font-weight:700;color:var(--t1);">' + psdEsc(it.ActivityNumber) + '</td>' +
            '<td style="padding:8px;">' + psdEsc(it.Category || '') + '</td>' +
            '<td style="padding:8px;">' + psdEsc(it.CustomerAccount || '') + '</td>' +
            '<td style="padding:8px;max-width:300px;">' + psdEsc((it.Description || '').slice(0, 80)) + '</td>' +
            '<td style="padding:8px;color:var(--t3);">' + psdFmtDate(it.AssignmentDate) + '</td>' +
            '<td style="padding:8px;"><span style="font-weight:800;color:' + (ag > 5 ? '#ef4444' : 'var(--t2)') + ';">' + (ag == null ? '—' : ag + 'd') + '</span></td>' +
            '<td style="padding:8px;"><button type="button" class="export-btn" style="padding:6px 14px;font-size:.72rem;" onclick="psdComplete(' + it.ID + ')">' +
            '<i data-lucide="check" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Complete</button></td>' +
            '</tr>';
    }).join('');

    body.innerHTML =
        '<div class="top-stats">' + tiles + '</div>' +
        '<div class="table-section" style="margin-top:1rem;overflow-x:auto;">' +
            '<h3 style="font-size:.95rem;font-weight:800;color:var(--t1);margin-bottom:.7rem;">In Queue (' + inq.length + ')</h3>' +
            (inq.length
                ? '<table style="width:100%;border-collapse:collapse;font-size:.78rem;color:var(--t2);">' +
                  '<thead><tr style="border-bottom:2px solid var(--border-s);text-align:left;color:var(--t1);">' +
                  '<th style="padding:8px;">Activity #</th><th style="padding:8px;">Category</th><th style="padding:8px;">Customer</th>' +
                  '<th style="padding:8px;">Description</th><th style="padding:8px;">Assigned</th><th style="padding:8px;">Aging</th><th style="padding:8px;"></th></tr></thead>' +
                  '<tbody>' + rows + '</tbody></table>'
                : '<div style="text-align:center;padding:40px;color:var(--t3);">🎉 Nothing in your queue. Great work!</div>') +
        '</div>';
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
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { console.error(e); psdToast('Could not complete: ' + e.message, 'error'); }
};

// ============================================================
// RECORDS GRID (all roles — agents see only their own)
// ============================================================
function psdRenderRecords(body) {
    var items = psdScopedItems();
    body.innerHTML =
        '<div class="table-section">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:.8rem;">' +
                '<input type="text" class="search-box" id="psdSearch" placeholder="Search…" oninput="psdSearchGrid()" style="padding:9px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-input);color:var(--t1);min-width:220px;">' +
                '<button type="button" class="export-btn" onclick="psdExportCsv()" style="padding:9px 18px;">' +
                '<i data-lucide="file-spreadsheet" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export CSV</button>' +
            '</div>' +
            '<div id="psdGrid" class="ag-theme-alpine" style="height:600px;width:100%;"></div>' +
        '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (typeof agGrid === 'undefined') {
        document.getElementById('psdGrid').innerHTML = psdErrBox('ag-Grid not loaded on the page.');
        return;
    }

    var statusRenderer = function (p) {
        if (!p.value) return '';
        var c = psdStatusColor(p.value);
        return '<span style="background:' + c + '22;color:' + c + ';padding:2px 10px;border-radius:20px;font-weight:700;font-size:.72rem;">' + p.value + '</span>';
    };

    var cols = [
        { headerName: 'Activity #', field: 'ActivityNumber', pinned: 'left', width: 130 },
        { headerName: 'Category', field: 'Category', width: 130 },
        { headerName: 'Status', field: 'PSDStatus', width: 130, cellRenderer: statusRenderer },
        { headerName: 'Assigned To', field: 'AssignedToName', width: 150 },
        { headerName: 'Customer/Account', field: 'CustomerAccount', width: 220 },
        { headerName: 'Description', field: 'Description', width: 280 },
        { headerName: 'Order #', field: 'OrderNumber', width: 150 },
        { headerName: 'Product', field: 'Product', width: 110 },
        { headerName: 'Prov. Owner', field: 'ProvisioningOwner', width: 130 },
        { headerName: 'Upload Date', field: 'UploadDate', width: 130, valueFormatter: function (p) { return psdFmtDate(p.value); } },
        { headerName: 'Assigned Date', field: 'AssignmentDate', width: 130, valueFormatter: function (p) { return psdFmtDate(p.value); } },
        { headerName: 'Completed Date', field: 'CompletedDate', width: 140, valueFormatter: function (p) { return psdFmtDate(p.value); } },
        { headerName: 'Aging (d)', width: 110, valueGetter: function (p) { return psdAging(p.data); } }
    ];

    var gridOptions = {
        columnDefs: cols,
        rowData: items,
        defaultColDef: { sortable: true, filter: true, resizable: true },
        pagination: true,
        paginationPageSize: 50,
        animateRows: true
    };
    var el = document.getElementById('psdGrid');
    el.innerHTML = '';
    if (agGrid.createGrid) psdGridApi = agGrid.createGrid(el, gridOptions);
    else { new agGrid.Grid(el, gridOptions); psdGridApi = gridOptions.api; }
}

window.psdSearchGrid = function () {
    var v = (document.getElementById('psdSearch') || {}).value || '';
    if (psdGridApi) {
        if (psdGridApi.setGridOption) psdGridApi.setGridOption('quickFilterText', v);
        else if (psdGridApi.setQuickFilter) psdGridApi.setQuickFilter(v);
    }
};

window.psdExportCsv = function () {
    if (psdGridApi && psdGridApi.exportDataAsCsv) {
        psdGridApi.exportDataAsCsv({ fileName: 'PSD_Assignments_' + new Date().toISOString().slice(0, 10) + '.csv' });
    }
};

// ============================================================
// DUMMY DATA (PSD_DUMMY_MODE = true)
// ============================================================
function psdDummyAgents() {
    return [
        { name: 'Sanskar', email: 'sanskar@du.ae', userId: '' },
        { name: 'Hussain', email: 'hussain@du.ae', userId: '' },
        { name: 'Ameena', email: 'ameena@du.ae', userId: '' }
    ];
}
function psdDummyItems() {
    var cats = ['O365 Provisioning', 'DNS', 'Migration'];
    var agents = ['Sanskar', 'Hussain', 'Ameena', ''];
    var out = [];
    for (var i = 0; i < 40; i++) {
        var st = i % 3 === 0 ? PSD_STATUS.PENDING : (i % 3 === 1 ? PSD_STATUS.INPROGRESS : PSD_STATUS.COMPLETED);
        var up = new Date(Date.now() - (i + 2) * 86400000).toISOString();
        var asg = st !== PSD_STATUS.PENDING ? new Date(Date.now() - (i + 1) * 86400000).toISOString() : null;
        var cmp = st === PSD_STATUS.COMPLETED ? new Date(Date.now() - i * 86400000).toISOString() : null;
        out.push({
            ID: i + 1, ActivityNumber: '1-DUMMY' + (1000 + i), OrderNumber: '1-' + (600000000 + i),
            Category: cats[i % cats.length], CustomerAccount: 'Customer ' + (i + 1) + ' LLC',
            Description: 'O365 Provisioning Request : DomainName:demo' + i, Product: i % 2 ? 'BU' : 'BS Pro',
            ProvisioningOwner: agents[i % 3], PSDStatus: st, UploadDate: up, AssignmentDate: asg, CompletedDate: cmp,
            AssignedToName: st === PSD_STATUS.PENDING ? '' : agents[i % 3], AssignedToEmail: ''
        });
    }
    return out;
}
