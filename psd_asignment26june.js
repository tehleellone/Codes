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
window.PSD_MODULE_VERSION = '2.2.0';

var psdDashFilters   = { status: [], category: [], agent: [], product: [], search: '' };
var psdDateFilters   = { dateField: 'UploadDate', from: '', to: '', specific: '', years: [], quarters: [], months: [], weeks: [] };
var psdChartsBuilt   = false;
var psdLastChartItems = null;
var psdLastChartSummary = null;
var psdAgentsVisible = false;
var psdAdminEmailsCache = null;
var psdInitInFlight = null;

var PSD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var PSD_DATE_FIELD_OPTS = [
    { key: 'UploadDate', label: 'Upload Date' },
    { key: 'AssignmentDate', label: 'Assignment Date' },
    { key: 'ReassignDate', label: 'Reassign Date' },
    { key: 'CompletedDate', label: 'Completed Date' },
    { key: 'CreatedOn', label: 'Created' },
    { key: 'OrderCreatedDate', label: 'Order Created' }
];

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
function psdRole() {
    var r = (window.USER_CONTEXT && window.USER_CONTEXT.role) || 'none';
    if (r === 'PSD Admin') return 'PSD_Admin';
    if (r === 'PSD Agent') return 'PSD_Agent';
    return r;
}
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

function psdNormAgentName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
}

function psdAgentNameKey(name) {
    return psdNormAgentName(name).toLowerCase();
}

function psdCanonicalAgentName(name) {
    var key = psdAgentNameKey(name);
    if (!key) return '';
    for (var i = 0; i < psdAllAgents.length; i++) {
        if (psdAgentNameKey(psdAllAgents[i].name) === key) return psdAllAgents[i].name;
    }
    return psdNormAgentName(name);
}

function psdGetSelectVal(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
}

function psdWeekOfMonth(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return Math.ceil(d.getDate() / 7);
}

function psdDateMeta(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var y = d.getFullYear(), mi = d.getMonth();
    return {
        year: y,
        quarter: Math.floor(mi / 3) + 1,
        monthIndex: mi,
        week: psdWeekOfMonth(d),
        dayStart: new Date(y, mi, d.getDate()).getTime()
    };
}

function psdItemDateValue(item, field) {
    if (!item || !field) return null;
    return item[field] || null;
}

function psdApplyDateFilters(items, f) {
    f = f || psdDateFilters;
    var field = f.dateField || 'UploadDate';
    var hasDate = f.from || f.to || f.specific ||
        (f.years && f.years.length) || (f.quarters && f.quarters.length) ||
        (f.months && f.months.length) || (f.weeks && f.weeks.length);
    if (!hasDate) return items;
    return items.filter(function (it) {
        var meta = psdDateMeta(psdItemDateValue(it, field));
        if (!meta) return false;
        if (f.from) {
            var fromD = new Date(f.from);
            if (!isNaN(fromD.getTime())) {
                fromD.setHours(0, 0, 0, 0);
                if (meta.dayStart < fromD.getTime()) return false;
            }
        }
        if (f.to) {
            var toD = new Date(f.to);
            if (!isNaN(toD.getTime())) {
                toD.setHours(23, 59, 59, 999);
                if (meta.dayStart > toD.getTime()) return false;
            }
        }
        if (f.specific) {
            var spec = new Date(f.specific);
            if (!isNaN(spec.getTime())) {
                spec.setHours(0, 0, 0, 0);
                if (meta.dayStart !== spec.getTime()) return false;
            }
        }
        if (f.years && f.years.length && f.years.indexOf(String(meta.year)) < 0) return false;
        if (f.quarters && f.quarters.length && f.quarters.indexOf(String(meta.quarter)) < 0) return false;
        if (f.months && f.months.length && f.months.indexOf(String(meta.monthIndex)) < 0) return false;
        if (f.weeks && f.weeks.length && f.weeks.indexOf(String(meta.week)) < 0) return false;
        return true;
    });
}

function psdReadDateFiltersFromDom(prefix) {
    prefix = prefix || 'psdFilter';
    psdDateFilters.dateField = psdGetSelectVal(prefix + 'DateField') || 'UploadDate';
    psdDateFilters.from = psdGetSelectVal(prefix + 'DateFrom');
    psdDateFilters.to = psdGetSelectVal(prefix + 'DateTo');
    psdDateFilters.specific = psdGetSelectVal(prefix + 'DateSpecific');
    psdDateFilters.years = psdGetMsValues(prefix + 'DateYearDropdown');
    psdDateFilters.quarters = psdGetMsValues(prefix + 'DateQuarterDropdown');
    psdDateFilters.months = psdGetMsValues(prefix + 'DateMonthDropdown');
    psdDateFilters.weeks = psdGetMsValues(prefix + 'DateWeekDropdown');
}

function psdResetDateFiltersState() {
    psdDateFilters = { dateField: 'UploadDate', from: '', to: '', specific: '', years: [], quarters: [], months: [], weeks: [] };
}

function psdCollectDateMetas(items, field) {
    var metas = [];
    (items || []).forEach(function (it) {
        var meta = psdDateMeta(psdItemDateValue(it, field));
        if (meta) metas.push(meta);
    });
    return metas;
}

function psdGetMsValues(dropdownId) {
    var el = document.getElementById(dropdownId);
    if (!el) return [];
    return Array.prototype.slice.call(el.querySelectorAll('input[type="checkbox"]:checked')).map(function (cb) { return cb.value; });
}

window.psdToggleMsDropdown = function (dropdownId) {
    document.querySelectorAll('.psd-ms .multiselect-dropdown').forEach(function (d) {
        if (d.id !== dropdownId) d.style.display = 'none';
    });
    var dd = document.getElementById(dropdownId);
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};

window.psdUpdateMsText = function (textId, label, dropdownId) {
    var selected = psdGetMsValues(dropdownId);
    var el = document.getElementById(textId);
    if (!el) return;
    if (selected.length === 0) {
        el.textContent = 'All ' + label;
        return;
    }
    if (selected.length === 1) {
        var v = selected[0];
        if (dropdownId.indexOf('DateQuarter') >= 0) el.textContent = 'Q' + v;
        else if (dropdownId.indexOf('DateMonth') >= 0) el.textContent = PSD_MONTHS[parseInt(v, 10)] || v;
        else if (dropdownId.indexOf('DateWeek') >= 0) el.textContent = 'W' + v;
        else el.textContent = v;
        return;
    }
    el.textContent = selected.length + ' selected';
};

function psdBuildMsDropdown(dropdownId, textId, label, values, selected, onChangeFn, labelFn) {
    var dd = document.getElementById(dropdownId);
    if (!dd) return;
    var selSet = {};
    (selected || []).forEach(function (v) { selSet[String(v)] = true; });
    dd.innerHTML = values.map(function (val) {
        var disp = labelFn ? labelFn(val) : val;
        var safeId = dropdownId + '_' + String(val).replace(/\W/g, '_');
        var checked = selSet[String(val)] ? ' checked' : '';
        return '<div class="multiselect-option" onclick="event.stopPropagation()">' +
            '<input type="checkbox" id="' + safeId + '" value="' + psdEsc(val) + '"' + checked +
            ' onchange="' + onChangeFn + '();psdUpdateMsText(\'' + textId + '\',\'' + label + '\',\'' + dropdownId + '\')">' +
            '<label for="' + safeId + '">' + psdEsc(disp) + '</label></div>';
    }).join('');
    psdUpdateMsText(textId, label, dropdownId);
}

function psdMsFilterHTML(prefix, key, label) {
    return '<div class="fb-group"><div class="fb-group-label">' + psdEsc(label) + '</div>' +
        '<div class="custom-multiselect psd-ms">' +
            '<div class="multiselect-selected" onclick="event.stopPropagation();psdToggleMsDropdown(\'' + prefix + key + 'Dropdown\')">' +
                '<span id="' + prefix + key + 'Text">All ' + psdEsc(label) + '</span>' +
                '<span style="opacity:.75;">▾</span></div>' +
            '<div class="multiselect-dropdown" id="' + prefix + key + 'Dropdown" style="display:none;"></div>' +
        '</div></div>';
}

function psdBindMsOutsideClick() {
    if (window._psdMsClickBound) return;
    window._psdMsClickBound = true;
    document.addEventListener('click', function () {
        document.querySelectorAll('.psd-ms .multiselect-dropdown').forEach(function (d) { d.style.display = 'none'; });
    }, true);
}

function psdPopulateDateMsDropdowns(prefix, items, onChangeFn) {
    prefix = prefix || 'psdFilter';
    onChangeFn = onChangeFn || 'psdApplyDashboardFilters';
    var field = psdDateFilters.dateField || 'UploadDate';
    var metas = psdCollectDateMetas(items, field);
    var ySel = psdDateFilters.years || [];
    var qSel = psdDateFilters.quarters || [];
    var mSel = psdDateFilters.months || [];

    var years = [], quarters = [], months = [], weeks = [];
    metas.forEach(function (m) {
        var ys = String(m.year);
        if (years.indexOf(ys) < 0) years.push(ys);
    });
    years.sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); });

    metas.forEach(function (m) {
        if (ySel.length && ySel.indexOf(String(m.year)) < 0) return;
        var qs = String(m.quarter);
        if (quarters.indexOf(qs) < 0) quarters.push(qs);
    });
    quarters.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });

    metas.forEach(function (m) {
        if (ySel.length && ySel.indexOf(String(m.year)) < 0) return;
        if (qSel.length && qSel.indexOf(String(m.quarter)) < 0) return;
        var ms = String(m.monthIndex);
        if (months.indexOf(ms) < 0) months.push(ms);
    });
    months.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });

    metas.forEach(function (m) {
        if (ySel.length && ySel.indexOf(String(m.year)) < 0) return;
        if (qSel.length && qSel.indexOf(String(m.quarter)) < 0) return;
        if (mSel.length && mSel.indexOf(String(m.monthIndex)) < 0) return;
        if (m.week != null) {
            var ws = String(m.week);
            if (weeks.indexOf(ws) < 0) weeks.push(ws);
        }
    });
    weeks.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });

    psdBuildMsDropdown(prefix + 'DateYearDropdown', prefix + 'DateYearText', 'Years', years, psdDateFilters.years, onChangeFn);
    psdBuildMsDropdown(prefix + 'DateQuarterDropdown', prefix + 'DateQuarterText', 'Quarters', quarters, psdDateFilters.quarters, onChangeFn, function (v) { return 'Q' + v; });
    psdBuildMsDropdown(prefix + 'DateMonthDropdown', prefix + 'DateMonthText', 'Months', months, psdDateFilters.months, onChangeFn, function (v) { return PSD_MONTHS[parseInt(v, 10)] || v; });
    psdBuildMsDropdown(prefix + 'DateWeekDropdown', prefix + 'DateWeekText', 'Weeks', weeks, psdDateFilters.weeks, onChangeFn, function (v) { return 'W' + v; });
}

function psdSafeUpdateDateFilterOptions(prefix, items, onChangeFn) {
    try { psdPopulateDateMsDropdowns(prefix, items, onChangeFn); } catch (e) { console.warn('[PSD] date filter options', e); }
}

function psdMatchMulti(val, arr) {
    if (!arr || !arr.length) return true;
    var s = val == null ? '' : String(val);
    return arr.some(function (a) { return String(a) === s; });
}

function psdPopulateMainMsDropdowns(prefix, items, filters, onChangeFn) {
    prefix = prefix || 'psdFilter';
    onChangeFn = onChangeFn || 'psdApplyDashboardFilters';
    filters = filters || psdDashFilters;
    var cats = psdUniqueValues(items, 'Category');
    var products = psdUniqueValues(items, 'Product');
    if (prefix === 'psdFilter') {
        var statuses = [PSD_STATUS.PENDING, PSD_STATUS.INPROGRESS, PSD_STATUS.COMPLETED];
        var agents = psdAllAgents.map(function (a) { return a.name; });
        psdBuildMsDropdown(prefix + 'StatusDropdown', prefix + 'StatusText', 'Statuses', statuses, filters.status, onChangeFn);
        psdBuildMsDropdown(prefix + 'CategoryDropdown', prefix + 'CategoryText', 'Categories', cats, filters.category, onChangeFn);
        psdBuildMsDropdown(prefix + 'AgentDropdown', prefix + 'AgentText', 'Agents', agents, filters.agent, onChangeFn);
        psdBuildMsDropdown(prefix + 'ProductDropdown', prefix + 'ProductText', 'Products', products, filters.product, onChangeFn);
        return;
    }
    if (prefix === 'psdAssignF') {
        psdBuildMsDropdown(prefix + 'CategoryDropdown', prefix + 'CategoryText', 'Categories', cats, filters.category, onChangeFn);
        psdBuildMsDropdown(prefix + 'ProductDropdown', prefix + 'ProductText', 'Products', products, filters.product, onChangeFn);
        return;
    }
    if (prefix === 'psdAssignedF') {
        var agentSet = {};
        psdUniqueValues(items, 'AssignedToName').forEach(function (n) {
            var canon = psdCanonicalAgentName(n);
            if (canon) agentSet[canon] = true;
        });
        var agents = Object.keys(agentSet).sort();
        psdBuildMsDropdown(prefix + 'CategoryDropdown', prefix + 'CategoryText', 'Categories', cats, filters.category, onChangeFn);
        psdBuildMsDropdown(prefix + 'ProductDropdown', prefix + 'ProductText', 'Products', products, filters.product, onChangeFn);
        psdBuildMsDropdown(prefix + 'AgentDropdown', prefix + 'AgentText', 'Agents', agents, filters.agent, onChangeFn);
    }
}

function psdShowInitError(loadingEl, contentEl, message) {
    if (contentEl) contentEl.style.display = 'none';
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-weight:700;color:var(--t1);">Could not load PSD Assignment</div>' +
            '<div style="font-size:.82rem;color:var(--t3);margin:8px 0;">' + psdEsc(message || 'Unknown error') + '</div>' +
            '<button type="button" class="export-btn" onclick="psdInit()">Retry</button></div>';
    }
}

function psdDateFilterRowHTML(prefix, onChangeFn) {
    prefix = prefix || 'psdFilter';
    onChangeFn = onChangeFn || 'psdApplyDashboardFilters';
    var f = psdDateFilters;
    var fieldOpts = PSD_DATE_FIELD_OPTS.map(function (o) {
        return '<option value="' + o.key + '"' + (f.dateField === o.key ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');
    return '<div class="filter-bar-grid" style="margin-top:.55rem;padding-top:.55rem;border-top:1px dashed var(--border);">' +
        '<div class="fb-group"><div class="fb-group-label">Date Basis</div>' +
            '<select class="fb-select" id="' + prefix + 'DateField" onchange="' + onChangeFn + '()">' + fieldOpts + '</select></div>' +
        '<div class="fb-group"><div class="fb-group-label">From</div>' +
            '<input type="date" class="fb-select" id="' + prefix + 'DateFrom" value="' + psdEsc(f.from) + '" onchange="' + onChangeFn + '()" style="cursor:text;"></div>' +
        '<div class="fb-group"><div class="fb-group-label">To</div>' +
            '<input type="date" class="fb-select" id="' + prefix + 'DateTo" value="' + psdEsc(f.to) + '" onchange="' + onChangeFn + '()" style="cursor:text;"></div>' +
        '<div class="fb-group"><div class="fb-group-label">Specific Date</div>' +
            '<input type="date" class="fb-select" id="' + prefix + 'DateSpecific" value="' + psdEsc(f.specific) + '" onchange="' + onChangeFn + '()" style="cursor:text;"></div>' +
        psdMsFilterHTML(prefix, 'DateYear', 'Years') +
        psdMsFilterHTML(prefix, 'DateQuarter', 'Quarters') +
        psdMsFilterHTML(prefix, 'DateMonth', 'Months') +
        psdMsFilterHTML(prefix, 'DateWeek', 'Weeks') +
    '</div>';
}

function psdDateFilterBarOnlyHTML(prefix) {
    prefix = prefix || 'psdAgentF';
    return '<div class="filter-bar" style="margin-bottom:.85rem;">' +
        '<div class="filter-bar-header">' +
            '<span class="filter-bar-label">Date Filters</span>' +
            '<button type="button" class="reset-btn" onclick="psdResetAgentDateFilters()">Reset</button>' +
        '</div>' +
        psdDateFilterRowHTML(prefix, 'psdApplyAgentDateFilters') +
    '</div>';
}

window.psdApplyAgentDateFilters = function () {
    psdReadDateFiltersFromDom('psdAgentF');
    psdRefreshMyQueueContent();
};

window.psdResetAgentDateFilters = function () {
    psdResetDateFiltersState();
    psdRenderTabBody();
};

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
        '.filter-bar{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.85rem 1rem;margin-bottom:1rem;box-shadow:var(--cs)}' +
        '.filter-bar-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.7rem}' +
        '.filter-bar-label{font-size:.68rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em}' +
        '.filter-bar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.55rem .65rem;align-items:end}' +
        '.fb-group{display:flex;flex-direction:column;gap:.2rem;min-width:0}' +
        '.fb-group-label{font-size:.63rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}' +
        '.fb-select{padding:.38rem .65rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:.8rem;cursor:pointer;width:100%}' +
        '.psd-bulk-bar{display:flex;align-items:center;flex-wrap:wrap;gap:.55rem;padding:.65rem .85rem;margin-bottom:.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:10px}' +
        '.psd-bulk-label{font-size:.68rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}' +
        '.psd-bulk-count{font-size:.72rem;color:var(--t3);font-weight:600;margin-left:auto}' +
        '.psd-bulk-hint{font-size:.72rem;color:var(--t3);font-weight:600;flex:1 1 100%}' +
        '.psd-ag-set-filter{padding:.5rem;min-width:200px;max-width:260px}' +
        '.psd-ag-set-search{width:100%;box-sizing:border-box;margin-bottom:.45rem;padding:.35rem .5rem;border:1px solid var(--border);border-radius:8px;font-size:.75rem;background:var(--bg-card);color:var(--t1)}' +
        '.psd-ag-set-list{max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:.2rem}' +
        '.psd-ag-set-option{display:flex;align-items:center;gap:.35rem;font-size:.75rem;cursor:pointer;padding:.15rem 0}' +
        '.psd-ag-set-actions{display:flex;gap:.35rem;margin-top:.45rem}' +
        '.psd-ag-set-actions button{flex:1;padding:.25rem .4rem;font-size:.68rem;font-weight:700;border:1px solid var(--border);border-radius:6px;background:var(--nab);color:var(--acc);cursor:pointer}' +
        '.psd-status-badge{display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:700}' +
        '.psd-badge-pending{background:rgba(148,163,184,.15);color:#64748b}' +
        '.psd-badge-inprogress{background:rgba(245,158,11,.15);color:#d97706}' +
        '.psd-badge-completed{background:rgba(34,197,94,.15);color:#16a34a}' +
        '[id^="psdGrid"] .ag-checkbox-input-wrapper,[id^="psdAssign"] .ag-checkbox-input-wrapper,[id^="psdAssigned"] .ag-checkbox-input-wrapper,[id^="psdAgent"] .ag-checkbox-input-wrapper{opacity:1!important;width:16px;height:16px}' +
        '.psd-grid-action{display:flex;align-items:center;gap:6px}' +
        '.psd-grid-action .fb-select{font-size:.72rem;padding:4px 6px;max-width:130px}' +
        '.psd-grid-action button{padding:4px 10px;font-size:.68rem;border:none;border-radius:6px;background:var(--grad);color:#fff;font-weight:700;cursor:pointer}' +
        '.psd-agent-tile{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.85rem 1rem;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;box-shadow:var(--cs)}' +
        '.psd-agent-tile:hover{transform:translateY(-2px);box-shadow:var(--ch)}' +
        '.psd-agent-tile.selected{border-color:var(--acc);box-shadow:0 0 0 2px var(--glow)}' +
        '.psd-agent-tile-head{display:flex;align-items:center;gap:.55rem;margin-bottom:.55rem}' +
        '.psd-agent-avatar{width:36px;height:36px;border-radius:50%;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.78rem;flex-shrink:0}' +
        '.psd-agent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.85rem;margin:1rem 0}' +
        '.psd-ms.custom-multiselect{position:relative;z-index:120;width:100%}' +
        '.psd-ms .multiselect-selected{padding:.38rem .65rem;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;color:var(--t1);font-size:.8rem;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;box-sizing:border-box}' +
        '.psd-ms .multiselect-selected:hover{border-color:var(--acc);box-shadow:0 0 0 2px var(--glow)}' +
        '.psd-ms .multiselect-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--ch);max-height:240px;overflow-y:auto;z-index:9999}' +
        '.psd-ms .multiselect-option{padding:8px 12px;display:flex;align-items:center;cursor:pointer;border-bottom:1px solid var(--border)}' +
        '.psd-ms .multiselect-option:last-child{border-bottom:none}' +
        '.psd-ms .multiselect-option:hover{background:var(--bg-hover,rgba(148,163,184,.12))}' +
        '.psd-ms .multiselect-option input[type=checkbox]{margin-right:10px;width:15px;height:15px;cursor:pointer;accent-color:var(--acc)}' +
        '.psd-ms .multiselect-option label{cursor:pointer;flex:1;font-size:.8rem;color:var(--t1);margin:0}';
    document.head.appendChild(s);
}

function psdSetFullLayout(on) {
    var content = document.querySelector('.content');
    var shell = document.querySelector('.portal-shell');
    if (content) content.classList.toggle('psd-full-mode', !!on);
    if (shell) shell.classList.toggle('psd-full-shell', !!on);
}

function psdCssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim() || '#a855f7'; }

function psdSafeColor(c, fallback) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
    return fallback || '#a855f7';
}

function psdLinearGradient(chart, c1, c2) {
    var from = psdSafeColor(c1, '#64748b');
    var to = psdSafeColor(c2, '#a855f7');
    if (!chart || !chart.ctx) return from;
    var area = chart.chartArea;
    if (!area || area.bottom == null || area.top == null) return from;
    try {
        var g = chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
        g.addColorStop(0, from);
        g.addColorStop(1, to);
        return g;
    } catch (e) { return from; }
}

function psdHorizontalGradient(chart, c1, c2) {
    var from = psdSafeColor(c1, '#0284c7');
    var to = psdSafeColor(c2, '#a855f7');
    if (!chart || !chart.ctx) return from;
    var area = chart.chartArea;
    if (!area || area.left == null || area.right == null) return from;
    try {
        var g = chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
        g.addColorStop(0, from);
        g.addColorStop(1, to);
        return g;
    } catch (e) { return from; }
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
        var name = psdNormAgentName(it.Service_Manager_Name || '');
        if (!name) return;
        var key = psdAgentNameKey(name);
        if (seen[key]) return;
        seen[key] = true;
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

async function psdFetchAdminEmails() {
    if (psdAdminEmailsCache) return psdAdminEmailsCache.slice();
    var emails = [];
    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('Access_Control')/items?" +
            "$select=Role,UserEmailID&$filter=(Role eq 'PSD Admin' or Role eq 'Admin')&$top=500";
        var r = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (r.ok) {
            var data = await r.json();
            (data.d.results || []).forEach(function (it) {
                var em = String(it.UserEmailID || '').trim();
                if (em && emails.indexOf(em) < 0) emails.push(em);
            });
        }
    } catch (e) { console.warn('[PSD] Admin email fetch failed', e); }
    psdAdminEmailsCache = emails;
    return emails.slice();
}

function psdOpenMail(to, subject, body) {
    var href = 'mailto:';
    if (to) href += encodeURIComponent(to);
    href += '?subject=' + encodeURIComponent(subject);
    href += '&body=' + encodeURIComponent(body);
    var link = document.createElement('a');
    link.href = href;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function psdSendCompletionEmail(item) {
    if (!item) return;
    var admins = await psdFetchAdminEmails();
    if (!admins.length) {
        console.warn('[PSD] No PSD Admin emails found in Access_Control');
        return;
    }
    var agentName = psdCanonicalAgentName(item.AssignedToName) || psdUserName() || 'PSD Agent';
    var subject = '[PSD] Activity Completed — ' + (item.ActivityNumber || ('ID ' + item.ID));
    var body =
        'Dear PSD Admin,\n\n' +
        'A PSD activity has been marked completed by an agent.\n\n' +
        'Activity #: ' + (item.ActivityNumber || '—') + '\n' +
        'Order #: ' + (item.OrderNumber || '—') + '\n' +
        'Customer/Account: ' + (item.CustomerAccount || '—') + '\n' +
        'Category: ' + (item.Category || '—') + '\n' +
        'Product: ' + (item.Product || '—') + '\n' +
        'Completed By: ' + agentName + '\n' +
        'Completed On: ' + psdFmtDate(new Date().toISOString()) + '\n' +
        'Upload Date: ' + psdFmtDate(item.UploadDate) + '\n\n' +
        'Please review in the PSD Assignment dashboard.\n\n' +
        'This is an automated notification from the Service Management Portal.';
    try {
        var digest = await psdGetDigest();
        var payload = {
            properties: {
                To: { results: admins },
                Subject: subject,
                Body: body.replace(/\n/g, '<br/>')
            }
        };
        var r = await fetch(SP_URL + '/_api/SP.Utilities.Utility.SendEmail', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digest
            },
            body: JSON.stringify(payload)
        });
        if (r.ok) return;
    } catch (e) { console.warn('[PSD] SendEmail failed, opening mail client', e); }
    psdOpenMail(admins.join(';'), subject, body);
}

// ============================================================
// ENTRY + SHELL
// ============================================================
window.psdInit = async function () {
    if (psdInitInFlight) {
        try { await psdInitInFlight; return; } catch (e) { /* allow retry below */ }
    }

    var loadingEl = document.getElementById('psdLoading');
    var contentEl = document.getElementById('psdContent');

    var runInit = async function () {
        try {
            psdInjectStyles();
            if (typeof injectAGGridThemeStyles === 'function') injectAGGridThemeStyles();
            psdSetFullLayout(true);
            if (loadingEl) loadingEl.style.display = 'block';
            if (contentEl) contentEl.style.display = 'none';

            if (!psdHasAccess()) {
                if (loadingEl) loadingEl.innerHTML = '<div style="text-align:center;padding:50px;"><div style="font-size:2rem;">🔒</div><div style="font-weight:800;color:var(--t1);">Access Restricted</div></div>';
                return;
            }

            await Promise.race([
                Promise.all([psdFetchItems(), psdFetchAgents()]),
                new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Request timed out after 15s')); }, 15000); })
            ]);

            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            psdActiveTab = psdIsAgent() ? 'myqueue' : 'dashboard';
            psdRenderShell();
        } catch (e) {
            console.error('[PSD] init failed', e);
            psdShowInitError(loadingEl, contentEl, e && e.message ? e.message : String(e));
        }
    };

    psdInitInFlight = runInit();
    try {
        await psdInitInFlight;
    } finally {
        psdInitInFlight = null;
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
    try {
        psdDestroyCharts();
        psdDestroyAllGrids();
        if (psdActiveTab === 'dashboard') return psdRenderDashboard(body);
        if (psdActiveTab === 'assign')    return psdRenderAssignQueue(body);
        if (psdActiveTab === 'assigned')  return psdRenderAssignedQueue(body);
        if (psdActiveTab === 'myqueue')   return psdRenderMyQueue(body);
    } catch (e) {
        console.error('[PSD] tab render failed', e);
        body.innerHTML = psdErrBox('Could not render PSD view: ' + psdEsc(e && e.message ? e.message : String(e)));
    }
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
        if (!psdMatchMulti(it.PSDStatus, f.status)) return false;
        if (!psdMatchMulti(it.Category, f.category)) return false;
        if (f.agent && f.agent.length && !psdMatchMulti(psdCanonicalAgentName(it.AssignedToName), f.agent)) return false;
        if (!psdMatchMulti(it.Product, f.product)) return false;
        if (f.search) {
            var q = f.search.toLowerCase();
            var blob = [it.ActivityNumber, it.OrderNumber, it.CustomerAccount, it.Description, it.Category, it.AssignedToName].join(' ').toLowerCase();
            if (blob.indexOf(q) < 0) return false;
        }
        return true;
    });
}

function psdFilterItems(items) {
    return psdApplyDashFilters(psdApplyDateFilters(items, psdDateFilters));
}

function psdReadDashFiltersFromDom() {
    psdDashFilters.status   = psdGetMsValues('psdFilterStatusDropdown');
    psdDashFilters.category = psdGetMsValues('psdFilterCategoryDropdown');
    psdDashFilters.agent    = psdGetMsValues('psdFilterAgentDropdown');
    psdDashFilters.product  = psdGetMsValues('psdFilterProductDropdown');
    psdDashFilters.search   = (document.getElementById('psdFilterSearch') || {}).value || '';
    psdReadDateFiltersFromDom('psdFilter');
    psdSelectedAgent = psdDashFilters.agent.length === 1 ? psdDashFilters.agent[0] : null;
}

window.psdApplyDashboardFilters = function () {
    psdReadDashFiltersFromDom();
    psdRefreshDashboardContent();
};

window.psdResetDashboardFilters = function () {
    psdDashFilters = { status: [], category: [], agent: [], product: [], search: '' };
    psdResetDateFiltersState();
    psdSelectedAgent = null;
    psdRenderTabBody();
};

window.psdSelectAgentTile = function (name) {
    if (psdDashFilters.agent.length === 1 && psdDashFilters.agent[0] === name) {
        psdDashFilters.agent = [];
        psdSelectedAgent = null;
    } else {
        psdDashFilters.agent = [name];
        psdSelectedAgent = name;
    }
    psdBuildMsDropdown('psdFilterAgentDropdown', 'psdFilterAgentText', 'Agents',
        psdAllAgents.map(function (a) { return a.name; }), psdDashFilters.agent, 'psdApplyDashboardFilters');
    psdRefreshDashboardContent();
};

function psdFilterBarHTML(items, prefix) {
    prefix = prefix || 'psdFilter';
    return '<div class="filter-bar" style="margin-bottom:.85rem;">' +
        '<div class="filter-bar-header">' +
            '<span class="filter-bar-label">Filters</span>' +
            '<button type="button" class="reset-btn" onclick="psdResetDashboardFilters()">Reset</button>' +
        '</div>' +
        '<div class="filter-bar-grid">' +
            psdMsFilterHTML(prefix, 'Status', 'Statuses') +
            psdMsFilterHTML(prefix, 'Category', 'Categories') +
            psdMsFilterHTML(prefix, 'Agent', 'Agents') +
            psdMsFilterHTML(prefix, 'Product', 'Products') +
            '<div class="fb-group"><div class="fb-group-label">Search</div>' +
            '<input type="text" class="fb-select" id="' + prefix + 'Search" placeholder="Activity, Order, Customer…" value="' + psdEsc(psdDashFilters.search) + '" oninput="psdApplyDashboardFilters()" style="cursor:text;"></div>' +
        '</div>' +
        psdDateFilterRowHTML(prefix, 'psdApplyDashboardFilters') +
        '</div>';
}

var psdAssignFilters = { category: [], product: [] };
var psdAssignedFilters = { category: [], product: [], agent: [] };

function psdQueueFilterBarHTML(type, items) {
    var prefix = type === 'assign' ? 'psdAssignF' : 'psdAssignedF';
    var f = type === 'assign' ? psdAssignFilters : psdAssignedFilters;
    var fn = type === 'assign' ? 'psdApplyAssignFilters' : 'psdApplyAssignedFilters';
    var resetFn = type === 'assign' ? 'psdResetAssignFilters' : 'psdResetAssignedFilters';
    var agentCol = type === 'assigned' ? psdMsFilterHTML(prefix, 'Agent', 'Agents') : '';
    return '<div class="filter-bar" style="margin-bottom:.85rem;">' +
        '<div class="filter-bar-header"><span class="filter-bar-label">Filters</span>' +
        '<button type="button" class="reset-btn" onclick="' + resetFn + '()">Reset</button></div>' +
        '<div class="filter-bar-grid">' +
            psdMsFilterHTML(prefix, 'Category', 'Categories') +
            psdMsFilterHTML(prefix, 'Product', 'Products') +
            agentCol +
        '</div>' +
        psdDateFilterRowHTML(prefix, fn) +
        '</div>';
}

window.psdApplyAssignFilters = function () {
    psdAssignFilters.category = psdGetMsValues('psdAssignFCategoryDropdown');
    psdAssignFilters.product = psdGetMsValues('psdAssignFProductDropdown');
    psdReadDateFiltersFromDom('psdAssignF');
    psdRefreshAssignContent();
};
window.psdResetAssignFilters = function () {
    psdAssignFilters = { category: [], product: [] };
    psdResetDateFiltersState();
    psdRenderTabBody();
};
window.psdApplyAssignedFilters = function () {
    psdAssignedFilters.category = psdGetMsValues('psdAssignedFCategoryDropdown');
    psdAssignedFilters.product = psdGetMsValues('psdAssignedFProductDropdown');
    psdAssignedFilters.agent = psdGetMsValues('psdAssignedFAgentDropdown');
    psdReadDateFiltersFromDom('psdAssignedF');
    psdRefreshAssignedContent();
};
window.psdResetAssignedFilters = function () {
    psdAssignedFilters = { category: [], product: [], agent: [] };
    psdResetDateFiltersState();
    psdRenderTabBody();
};

function psdApplyQueueFilters(items, f, includeAgent) {
    items = psdApplyDateFilters(items, psdDateFilters);
    return items.filter(function (it) {
        if (!psdMatchMulti(it.Category, f.category)) return false;
        if (!psdMatchMulti(it.Product, f.product)) return false;
        if (includeAgent && f.agent && f.agent.length && !psdMatchMulti(psdCanonicalAgentName(it.AssignedToName), f.agent)) return false;
        return true;
    });
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
    psdAllAgents.forEach(function (a) {
        stats[psdAgentNameKey(a.name)] = { name: a.name, email: a.email, assigned: 0, inprogress: 0, completed: 0, slaSum: 0, slaN: 0 };
    });
    items.forEach(function (it) {
        if (!it.AssignedToName) return;
        var canon = psdCanonicalAgentName(it.AssignedToName);
        var key = psdAgentNameKey(canon);
        if (!key) return;
        if (!stats[key]) stats[key] = { name: canon, email: it.AssignedToEmail || '', assigned: 0, inprogress: 0, completed: 0, slaSum: 0, slaN: 0 };
        var st = stats[key];
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
            var sel = (psdDashFilters.agent.indexOf(st.name) >= 0 || psdSelectedAgent === st.name) ? ' selected' : '';
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
// AG-GRID (FNE-style — set filters, checkbox col, DOM actions)
// ============================================================
function psdMapRow(it) {
    if (!it) return null;
    function v(x) { return (x === null || x === undefined || x === '') ? '—' : String(x); }
    return {
        id: it.ID,
        activityNumber: v(it.ActivityNumber),
        orderNumber: v(it.OrderNumber),
        orderStatus: v(it.OrderStatus),
        activityType: v(it.ActivityTypeText),
        description: v(it.Description),
        owner: v(it.Owner),
        customer: v(it.CustomerAccount),
        createdOn: it.CreatedOn || null,
        orderCreatedDate: it.OrderCreatedDate || null,
        product: v(it.Product),
        buStatus: v(it.BUStatus),
        dnsStatus: v(it.DNSStatus),
        provOwner: v(it.ProvisioningOwner),
        provType: v(it.ProvisioningType),
        provStatus: v(it.ProvisioningStatus),
        dnsActivityRef: v(it.DNSActivityRef),
        buActivityRef: v(it.BUActivityRef),
        category: v(it.Category),
        psdStatus: it.PSDStatus || '—',
        assignedTo: v(it.AssignedToName),
        uploadDate: it.UploadDate || null,
        assignmentDate: it.AssignmentDate || null,
        reassignDate: it.ReassignDate || null,
        completedDate: it.CompletedDate || null,
        slaDays: psdSlaDays(it),
        agingDays: psdAging(it)
    };
}

function PsdSetColumnFilter() {}
PsdSetColumnFilter.prototype.init = function (params) {
    this.params = params;
    this.selected = new Set();
    this.gui = document.createElement('div');
    this.gui.className = 'psd-ag-set-filter';
    this._buildGui();
};
PsdSetColumnFilter.prototype._cellValue = function (data) {
    var v = data[this.params.colDef.field];
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
};
PsdSetColumnFilter.prototype._allValues = function () {
    var values = new Set(), self = this;
    this.params.api.forEachNode(function (node) {
        if (node.data) values.add(self._cellValue(node.data));
    });
    return Array.from(values).sort(function (a, b) { return a.localeCompare(b); });
};
PsdSetColumnFilter.prototype._buildGui = function () {
    var self = this, all = this._allValues();
    this.gui.innerHTML = '';
    var search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search...';
    search.className = 'psd-ag-set-search';
    this.gui.appendChild(search);
    var list = document.createElement('div');
    list.className = 'psd-ag-set-list';
    this.gui.appendChild(list);
    var render = function (term) {
        list.innerHTML = '';
        all.filter(function (v) { return !term || v.toLowerCase().indexOf(term.toLowerCase()) >= 0; }).forEach(function (v) {
            var row = document.createElement('label');
            row.className = 'psd-ag-set-option';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = self.selected.has(v);
            cb.onchange = function () {
                if (cb.checked) self.selected.add(v); else self.selected.delete(v);
                self.params.filterChangedCallback();
            };
            row.appendChild(cb);
            row.appendChild(document.createTextNode(' ' + v));
            list.appendChild(row);
        });
    };
    render('');
    search.oninput = function () { render(search.value); };
    var actions = document.createElement('div');
    actions.className = 'psd-ag-set-actions';
    var btnAll = document.createElement('button');
    btnAll.type = 'button';
    btnAll.textContent = 'Select all';
    btnAll.onclick = function () { all.forEach(function (v) { self.selected.add(v); }); render(search.value); self.params.filterChangedCallback(); };
    var btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.textContent = 'Clear';
    btnClear.onclick = function () { self.selected.clear(); render(search.value); self.params.filterChangedCallback(); };
    actions.appendChild(btnAll);
    actions.appendChild(btnClear);
    this.gui.appendChild(actions);
};
PsdSetColumnFilter.prototype.getGui = function () { return this.gui; };
PsdSetColumnFilter.prototype.isFilterActive = function () { return this.selected.size > 0; };
PsdSetColumnFilter.prototype.doesFilterPass = function (params) {
    if (!this.selected.size) return true;
    return this.selected.has(this._cellValue(params.data));
};
PsdSetColumnFilter.prototype.getModel = function () { return this.selected.size ? { values: Array.from(this.selected) } : null; };
PsdSetColumnFilter.prototype.setModel = function (model) {
    this.selected = new Set(model && model.values ? model.values : []);
    this._buildGui();
};
PsdSetColumnFilter.prototype.destroy = function () {};

var PSD_MS_FILTER_FIELDS = new Set([
    'activityNumber', 'orderNumber', 'orderStatus', 'activityType', 'description', 'owner', 'customer',
    'product', 'buStatus', 'dnsStatus', 'provOwner', 'provType', 'provStatus', 'dnsActivityRef', 'buActivityRef',
    'category', 'psdStatus', 'assignedTo'
]);
var PSD_DATE_FILTER_FIELDS = new Set([
    'createdOn', 'orderCreatedDate', 'uploadDate', 'assignmentDate', 'reassignDate', 'completedDate'
]);

function psdEnhanceColDef(col) {
    if (PSD_MS_FILTER_FIELDS.has(col.field)) col.filter = PsdSetColumnFilter;
    else if (col.type === 'numericColumn') col.filter = 'agNumberColumnFilter';
    else if (PSD_DATE_FILTER_FIELDS.has(col.field)) col.filter = 'agDateColumnFilter';
    return col;
}

function psdStatusBadge(val) {
    var map = {};
    map[PSD_STATUS.PENDING] = 'psd-badge-pending';
    map[PSD_STATUS.INPROGRESS] = 'psd-badge-inprogress';
    map[PSD_STATUS.COMPLETED] = 'psd-badge-completed';
    var cls = map[val] || 'psd-badge-pending';
    return '<span class="psd-status-badge ' + cls + '">' + psdEsc(val || '—') + '</span>';
}

function psdFmtGridDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
}

function psdAgentSelectEl(selected) {
    var sel = document.createElement('select');
    sel.className = 'fb-select';
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Select…';
    sel.appendChild(empty);
    psdAllAgents.forEach(function (a) {
        var opt = document.createElement('option');
        opt.value = a.name;
        opt.textContent = a.name;
        if (selected === a.name) opt.selected = true;
        sel.appendChild(opt);
    });
    return sel;
}

function psdAssignActionRenderer(params) {
    if (!params.data) return null;
    var wrap = document.createElement('div');
    wrap.className = 'psd-grid-action';
    var sel = psdAgentSelectEl('');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Assign';
    btn.onclick = function () {
        if (!sel.value) { psdToast('Pick an agent', 'warn'); return; }
        psdDoAssign([{ id: params.data.id, agentName: sel.value }], false);
    };
    wrap.appendChild(sel);
    wrap.appendChild(btn);
    return wrap;
}

function psdReassignActionRenderer(params) {
    if (!params.data) return null;
    var wrap = document.createElement('div');
    wrap.className = 'psd-grid-action';
    var sel = psdAgentSelectEl(params.data.assignedTo === '—' ? '' : params.data.assignedTo);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Reassign';
    btn.onclick = function () {
        if (!sel.value) { psdToast('Pick an agent to reassign', 'warn'); return; }
        psdDoAssign([{ id: params.data.id, agentName: sel.value }], true);
    };
    wrap.appendChild(sel);
    wrap.appendChild(btn);
    return wrap;
}

function psdCompleteActionRenderer(params) {
    if (!params.data || params.data.psdStatus !== PSD_STATUS.INPROGRESS) return null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'export-btn';
    btn.style.cssText = 'padding:4px 12px;font-size:.68rem;';
    btn.textContent = 'Complete';
    btn.onclick = function () { psdComplete(params.data.id); };
    return btn;
}

function psdDataColumnDefs() {
    var fmtD = function (p) { return psdFmtGridDate(p.value); };
    return [
        { field: 'activityNumber', headerName: 'Activity #', width: 130, minWidth: 120, pinned: 'left', suppressSizeToFit: true },
        { field: 'orderNumber', headerName: 'Order #', width: 150, minWidth: 130 },
        { field: 'orderStatus', headerName: 'Status', width: 110, minWidth: 90 },
        { field: 'activityType', headerName: 'Type', width: 120, minWidth: 100 },
        { field: 'description', headerName: 'Description', width: 220, minWidth: 160 },
        { field: 'owner', headerName: 'Owner', width: 130, minWidth: 110 },
        { field: 'customer', headerName: 'Customer/Account', width: 200, minWidth: 160 },
        { field: 'createdOn', headerName: 'Created', width: 120, minWidth: 110, valueFormatter: fmtD },
        { field: 'orderCreatedDate', headerName: 'Order Created Date', width: 140, minWidth: 120, valueFormatter: fmtD },
        { field: 'product', headerName: 'Product', width: 100, minWidth: 90 },
        { field: 'buStatus', headerName: 'BU', width: 90, minWidth: 80 },
        { field: 'dnsStatus', headerName: 'DNS', width: 90, minWidth: 80 },
        { field: 'provOwner', headerName: 'Owner (Prov.)', width: 130, minWidth: 110 },
        { field: 'provType', headerName: 'Type (Prov.)', width: 120, minWidth: 100 },
        { field: 'provStatus', headerName: 'Status (Prov.)', width: 120, minWidth: 100 },
        { field: 'dnsActivityRef', headerName: 'DNS Activity Ref', width: 150, minWidth: 120 },
        { field: 'buActivityRef', headerName: 'BU Activity Ref', width: 150, minWidth: 120 },
        { field: 'category', headerName: 'Category', width: 130, minWidth: 110 },
        { field: 'psdStatus', headerName: 'PSD Status', width: 125, minWidth: 110, cellRenderer: function (p) { return psdStatusBadge(p.value); } },
        { field: 'assignedTo', headerName: 'Assigned To', width: 140, minWidth: 120 },
        { field: 'uploadDate', headerName: 'Upload Date', width: 120, minWidth: 110, valueFormatter: fmtD },
        { field: 'assignmentDate', headerName: 'Assigned Date', width: 125, minWidth: 110, valueFormatter: fmtD },
        { field: 'reassignDate', headerName: 'Reassign Date', width: 125, minWidth: 110, valueFormatter: fmtD },
        { field: 'completedDate', headerName: 'Completed Date', width: 130, minWidth: 110, valueFormatter: fmtD },
        { field: 'slaDays', headerName: 'SLA (d)', width: 90, minWidth: 80, type: 'numericColumn' },
        { field: 'agingDays', headerName: 'Aging (d)', width: 90, minWidth: 80, type: 'numericColumn' }
    ];
}

function psdBuildColDefs(mode) {
    var selectable = mode === 'assign' || mode === 'assigned';
    var cols = [];
    if (selectable) {
        cols.push({
            colId: 'psd_select',
            headerName: '',
            width: 48, minWidth: 48, maxWidth: 48,
            pinned: 'left', lockPosition: 'left', suppressMovable: true,
            sortable: false, filter: false, resizable: false,
            checkboxSelection: true,
            headerCheckboxSelection: true,
            headerCheckboxSelectionFilteredOnly: true,
            suppressHeaderMenuButton: true,
            showDisabledCheckboxes: true,
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
        });
    }
    cols = cols.concat(psdDataColumnDefs());
    if (mode === 'assign') {
        cols.push({ headerName: 'Action', width: 210, minWidth: 190, pinned: 'right', sortable: false, filter: false, cellRenderer: psdAssignActionRenderer });
    } else if (mode === 'assigned') {
        cols.push({ headerName: 'Reassign', width: 220, minWidth: 200, pinned: 'right', sortable: false, filter: false, cellRenderer: psdReassignActionRenderer });
    } else if (mode === 'agentqueue') {
        cols.push({ headerName: 'Action', width: 120, minWidth: 100, pinned: 'right', sortable: false, filter: false, cellRenderer: psdCompleteActionRenderer });
    }
    return cols.map(function (col) { return col.colId === 'psd_select' ? col : psdEnhanceColDef(col); });
}

function psdGridSectionHTML(title, gridId, countId, searchId, exportFn, count) {
    return '<div class="table-section">' +
        '<div class="table-header">' +
            '<h3 class="table-title">' + psdEsc(title) + ' · <span id="' + countId + '">' + count + ' record' + (count !== 1 ? 's' : '') + '</span></h3>' +
            '<div class="table-actions">' +
                '<button type="button" class="export-btn" onclick="' + exportFn + '">' +
                    '<i data-lucide="file-spreadsheet" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export CSV</button>' +
                '<input type="text" class="search-box" id="' + searchId + '" placeholder="Search all columns…" oninput="psdGridQuickFilter(\'' + gridId + '\',this.value)">' +
            '</div></div>' +
        '<div id="' + gridId + '" class="ag-theme-alpine" style="height:640px;width:100%;"></div></div>';
}

function psdUpdateBulkSelCount(gridKey) {
    var map = { assign: 'psdAssignBulkCount', assigned: 'psdAssignedBulkCount' };
    var el = document.getElementById(map[gridKey]);
    if (!el) return;
    el.textContent = psdGetSelectedRows(gridKey).length + ' selected';
}

function psdRenderGrid(gridKey, gridId, countId, items, mode) {
    var el = document.getElementById(gridId);
    if (!el) return;
    if (typeof agGrid === 'undefined') {
        el.innerHTML = psdErrBox('ag-Grid not loaded.');
        return;
    }
    var data = (items || []).map(psdMapRow).filter(Boolean);
    var countEl = document.getElementById(countId);
    if (countEl) countEl.textContent = data.length + ' record' + (data.length !== 1 ? 's' : '');

    psdDestroyGrid(gridKey);
    el.innerHTML = '';
    var selectable = mode === 'assign' || mode === 'assigned';
    var opts = {
        columnDefs: psdBuildColDefs(mode),
        rowData: data,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true,
            suppressSizeToFit: false,
            cellStyle: { display: 'flex', alignItems: 'center' }
        },
        rowSelection: selectable ? 'multiple' : undefined,
        suppressRowClickSelection: true,
        isRowSelectable: selectable ? function () { return true; } : undefined,
        pagination: true,
        paginationPageSize: 50,
        paginationPageSizeSelector: [25, 50, 100, 250],
        rowHeight: 46,
        headerHeight: 50,
        animateRows: true,
        enableCellTextSelection: true,
        onGridReady: function (p) {
            psdGrids[gridKey] = p.api;
            psdUpdateBulkSelCount(gridKey);
            setTimeout(function () {
                p.api.autoSizeColumns(['activityNumber', 'customer', 'description', 'assignedTo'], false);
            }, 150);
        },
        onSelectionChanged: function () { psdUpdateBulkSelCount(gridKey); }
    };
    if (agGrid.createGrid) psdGrids[gridKey] = agGrid.createGrid(el, opts);
    else { new agGrid.Grid(el, opts); psdGrids[gridKey] = opts.api; }
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
    if (api && api.exportDataAsCsv) {
        api.exportDataAsCsv({
            fileName: prefix + '_' + new Date().toISOString().slice(0, 10) + '.csv',
            allColumns: true
        });
    }
}

function psdBulkBarHTML(type) {
    var isAssign = type === 'assign';
    var countId = isAssign ? 'psdAssignBulkCount' : 'psdAssignedBulkCount';
    return '<div class="psd-bulk-bar">' +
        '<span class="psd-bulk-label">' + (isAssign ? 'Bulk Assign' : 'Bulk Reassign') + '</span>' +
        '<select id="psdBulkAgent" class="fb-select" style="max-width:200px;">' + psdAgentOptionsHTML('') + '</select>' +
        '<button type="button" class="export-btn" onclick="psdBulk' + (isAssign ? 'Assign' : 'Reassign') + '()" style="padding:8px 18px;">' +
            (isAssign ? 'Assign Selected' : 'Reassign Selected') + '</button>' +
        '<span class="psd-bulk-hint">Tick checkboxes on the left, pick an agent, then run bulk action.</span>' +
        '<span id="' + countId + '" class="psd-bulk-count">0 selected</span></div>';
}

function psdAgentOptionsHTML(selected) {
    return '<option value="">Select…</option>' + psdAllAgents.map(function (a) {
        return '<option value="' + psdEsc(a.name) + '"' + (selected === a.name ? ' selected' : '') + '>' + psdEsc(a.name) + '</option>';
    }).join('');
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

function psdDashboardMainHTML(dateFiltered, items, s) {
    return '<div class="top-stats">' +
            psdTile('Total', s.total, 'Filtered view', 'var(--acc)') +
            psdTile('Pending', s.pending, 'Awaiting assign', psdStatusColor(PSD_STATUS.PENDING)) +
            psdTile('In Progress', s.inprogress, 'With agents', psdStatusColor(PSD_STATUS.INPROGRESS)) +
            psdTile('Completed', s.completed, 'Done', psdStatusColor(PSD_STATUS.COMPLETED)) +
            psdTile('Avg Aging', s.avgAging + ' d', 'Upload → now/done', 'var(--acc2)') +
            psdTile('Avg SLA', s.avgTtc + ' d', 'Assign/Reassign → done', 'var(--acc2)') +
        '</div>' +
        '<div style="text-align:center;margin:1rem 0;">' +
            '<button type="button" id="psdToggleAgentsBtn" class="export-btn" onclick="psdToggleAgents()" style="padding:12px 24px;font-size:14px;">' +
                '<i data-lucide="eye" id="psdAgentsIcon" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
                '<span id="psdAgentsText">' + (psdAgentsVisible ? 'Hide PSD Agents' : 'Show PSD Agents') + '</span>' +
            '</button>' +
        '</div>' +
        '<div id="psdAgentsSection" style="display:' + (psdAgentsVisible ? 'block' : 'none') + ';">' +
            psdAgentTilesHTML(dateFiltered) +
        '</div>' +
        '<div style="text-align:center;margin:1rem 0;">' +
            '<button type="button" id="psdToggleChartsBtn" class="export-btn" onclick="psdToggleCharts()" style="padding:12px 24px;font-size:14px;">' +
                '<i data-lucide="eye" id="psdChartsIcon" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
                '<span id="psdChartsText">' + (psdChartsBuilt ? 'Hide Analytics Charts' : 'Show Analytics Charts') + '</span>' +
            '</button>' +
        '</div>' +
        '<div id="psdChartsSection" class="psd-chart-grid" style="display:' + (psdChartsBuilt ? 'grid' : 'none') + ';">' +
            psdChartCard('Status Breakdown', 'psdChartStatus', 'Pipeline mix', true) +
            psdChartCard('Completed by Agent', 'psdChartAgent', 'Throughput', true) +
            psdChartCard('By Category', 'psdChartCategory', 'Excel tabs', false) +
            psdChartCard('Aging Distribution', 'psdChartAging', 'Days since upload', false) +
        '</div>' +
        psdUploadSectionHTML() +
        psdGridSectionHTML('All Records', 'psdGrid', 'psdDashCount', 'psdDashSearch', 'psdExportDashCsv()', items.length);
}

function psdRefreshDashboardContent() {
    var body = document.getElementById('psdTabBody');
    var base = psdAllItems;
    var dateFiltered = psdApplyDateFilters(base, psdDateFilters);
    var items = psdApplyDashFilters(dateFiltered);
    var s = psdSummary(items);
    psdLastChartItems = items;
    psdLastChartSummary = s;

    var main = document.getElementById('psdDashMain');
    if (!main) {
        if (body) psdRenderDashboard(body);
        return;
    }

    main.innerHTML = psdDashboardMainHTML(dateFiltered, items, s);
    psdRenderGrid('dash', 'psdGrid', 'psdDashCount', items, 'records');
    psdSafeUpdateDateFilterOptions('psdFilter', dateFiltered, 'psdApplyDashboardFilters');

    if (psdChartsBuilt) {
        psdDestroyCharts();
        psdBuildDashboardCharts(items, s);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (psdAgentsVisible) {
        var agIcon = document.getElementById('psdAgentsIcon');
        if (agIcon) agIcon.setAttribute('data-lucide', 'eye-off');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function psdRefreshAssignContent() {
    var pendingAll = psdAllItems.filter(function (it) { return it.PSDStatus === PSD_STATUS.PENDING; });
    var pending = psdApplyQueueFilters(pendingAll, psdAssignFilters, false);
    var main = document.getElementById('psdAssignMain');
    if (!main) {
        var body = document.getElementById('psdTabBody');
        if (body) psdRenderAssignQueue(body);
        return;
    }
    main.innerHTML = psdBulkBarHTML('assign') +
        psdGridSectionHTML('Assign Queue — Pending', 'psdAssignGrid', 'psdAssignCount', 'psdAssignSearch', 'psdExportAssignCsv()', pending.length);
    psdRenderGrid('assign', 'psdAssignGrid', 'psdAssignCount', pending, 'assign');
    psdSafeUpdateDateFilterOptions('psdAssignF', pendingAll, 'psdApplyAssignFilters');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdRefreshAssignedContent() {
    var assignedAll = psdAllItems.filter(function (it) { return it.PSDStatus === PSD_STATUS.INPROGRESS; });
    var assigned = psdApplyQueueFilters(assignedAll, psdAssignedFilters, true);
    var main = document.getElementById('psdAssignedMain');
    if (!main) {
        var body = document.getElementById('psdTabBody');
        if (body) psdRenderAssignedQueue(body);
        return;
    }
    main.innerHTML = psdBulkBarHTML('reassign') +
        psdGridSectionHTML('Assigned Queue — In Progress', 'psdAssignedGrid', 'psdAssignedCount', 'psdAssignedSearch', 'psdExportAssignedCsv()', assigned.length);
    psdRenderGrid('assigned', 'psdAssignedGrid', 'psdAssignedCount', assigned, 'assigned');
    psdSafeUpdateDateFilterOptions('psdAssignedF', assignedAll, 'psdApplyAssignedFilters');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdRefreshMyQueueContent() {
    var mine = psdApplyDateFilters(psdScopedItems(), psdDateFilters);
    var s = psdSummary(mine);
    var inq = mine.filter(function (it) { return it.PSDStatus === PSD_STATUS.INPROGRESS; });
    var main = document.getElementById('psdMyQueueMain');
    if (!main) {
        var body = document.getElementById('psdTabBody');
        if (body) psdRenderMyQueue(body);
        return;
    }
    main.innerHTML =
        '<div class="top-stats">' +
            psdTile('In Queue', s.inprogress, 'Open', psdStatusColor(PSD_STATUS.INPROGRESS)) +
            psdTile('Completed', s.completed, 'By you', psdStatusColor(PSD_STATUS.COMPLETED)) +
            psdTile('Total Assigned', mine.length, 'All time', 'var(--acc)') +
            psdTile('Avg SLA', s.avgTtc + ' d', 'Assign/Reassign → done', 'var(--acc2)') +
        '</div>' +
        psdGridSectionHTML('My Queue — In Progress', 'psdAgentQueueGrid', 'psdAgentQueueCount', 'psdAgentSearch', 'psdExportAgentQueueCsv()', inq.length) +
        psdGridSectionHTML('My Records', 'psdAgentGrid', 'psdAgentRecCount', 'psdAgentRecSearch', 'psdExportAgentRecordsCsv()', mine.length);
    psdRenderGrid('agentQueue', 'psdAgentQueueGrid', 'psdAgentQueueCount', inq, 'agentqueue');
    psdRenderGrid('agentRecords', 'psdAgentGrid', 'psdAgentRecCount', mine, 'records');
    psdSafeUpdateDateFilterOptions('psdAgentF', psdScopedItems(), 'psdApplyAgentDateFilters');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdRenderDashboard(body) {
    var base = psdAllItems;
    var dateFiltered = psdApplyDateFilters(base, psdDateFilters);
    var items = psdApplyDashFilters(dateFiltered);
    var s = psdSummary(items);
    psdChartsBuilt = false;
    psdLastChartItems = items;
    psdLastChartSummary = s;

    body.innerHTML =
        psdFilterBarHTML(dateFiltered) +
        '<div id="psdDashMain">' + psdDashboardMainHTML(dateFiltered, items, s) + '</div>';

    psdRenderGrid('dash', 'psdGrid', 'psdDashCount', items, 'records');
    psdBindMsOutsideClick();
    psdPopulateMainMsDropdowns('psdFilter', dateFiltered, psdDashFilters, 'psdApplyDashboardFilters');
    psdSafeUpdateDateFilterOptions('psdFilter', dateFiltered, 'psdApplyDashboardFilters');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (psdAgentsVisible) {
        var agIcon = document.getElementById('psdAgentsIcon');
        if (agIcon) agIcon.setAttribute('data-lucide', 'eye-off');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

window.psdToggleAgents = function () {
    var section = document.getElementById('psdAgentsSection');
    var icon = document.getElementById('psdAgentsIcon');
    var text = document.getElementById('psdAgentsText');
    if (!section) return;
    if (section.style.display === 'none') {
        section.style.display = 'block';
        psdAgentsVisible = true;
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
        if (text) text.textContent = 'Hide PSD Agents';
    } else {
        section.style.display = 'none';
        psdAgentsVisible = false;
        if (icon) icon.setAttribute('data-lucide', 'eye');
        if (text) text.textContent = 'Show PSD Agents';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.psdToggleCharts = function () {
    var section = document.getElementById('psdChartsSection');
    var icon = document.getElementById('psdChartsIcon');
    var text = document.getElementById('psdChartsText');
    if (!section) return;
    if (section.style.display === 'none') {
        section.style.display = 'grid';
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
        if (text) text.textContent = 'Hide Analytics Charts';
        if (!psdChartsBuilt && psdLastChartItems) {
            psdBuildDashboardCharts(psdLastChartItems, psdLastChartSummary || psdSummary(psdLastChartItems));
            psdChartsBuilt = true;
        }
    } else {
        section.style.display = 'none';
        if (icon) icon.setAttribute('data-lucide', 'eye');
        if (text) text.textContent = 'Show Analytics Charts';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

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
                backgroundColor: function (ctx) {
                    if (ctx.dataIndex == null || ctx.dataIndex < 0) return '#94a3b8';
                    var pal = [p.pending, p.inprogress, p.completed][ctx.dataIndex];
                    if (!pal) return '#94a3b8';
                    return psdLinearGradient(ctx.chart, pal.from, pal.to);
                },
                borderWidth: 3, borderColor: psdCssVar('--bg-card'), hoverOffset: 10, spacing: 3 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: legend, tooltip: psdChartTooltip() } },
            plugins: [psdCenterTextPlugin(s.total, 'Activities')]
        });
    }

    var byAgent = {};
    items.forEach(function (it) {
        if (it.PSDStatus !== PSD_STATUS.COMPLETED || !it.AssignedToName) return;
        var agent = psdCanonicalAgentName(it.AssignedToName);
        if (!agent) return;
        byAgent[agent] = (byAgent[agent] || 0) + 1;
    });
    var names = Object.keys(byAgent).sort(function (a, b) { return byAgent[b] - byAgent[a]; });
    var ac = document.getElementById('psdChartAgent');
    if (ac) psdCharts.agent = new Chart(ac, {
        type: 'bar',
        data: {
            labels: names.length ? names : ['No data'],
            datasets: [{
                label: 'Completed',
                data: names.length ? names.map(function (n) { return byAgent[n]; }) : [0],
                backgroundColor: function (ctx) {
                    if (ctx.dataIndex == null || ctx.dataIndex < 0) return psdCssVar('--acc');
                    return psdLinearGradient(ctx.chart, PSD_CHART_PALETTE.agents[ctx.dataIndex % 6], psdCssVar('--acc2'));
                },
                borderRadius: 8, maxBarThickness: 48
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: psdChartTooltip() },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } } } }
    });

    var byCat = {};
    items.forEach(function (it) { var k = it.Category || 'Uncategorised'; byCat[k] = (byCat[k] || 0) + 1; });
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var cc = document.getElementById('psdChartCategory');
    if (cc) psdCharts.category = new Chart(cc, {
        type: 'bar',
        data: {
            labels: cats.length ? cats : ['No data'],
            datasets: [{
                data: cats.length ? cats.map(function (c) { return byCat[c]; }) : [0],
                borderRadius: 8, barThickness: 18,
                backgroundColor: function (ctx) {
                    if (ctx.dataIndex == null || ctx.dataIndex < 0) return '#0284c7';
                    var col = PSD_CHART_PALETTE.categories[ctx.dataIndex % PSD_CHART_PALETTE.categories.length];
                    return psdHorizontalGradient(ctx.chart, col, psdCssVar('--acc2'));
                }
            }]
        },
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
        type: 'bar',
        data: {
            labels: keys,
            datasets: [{
                data: keys.map(function (k) { return buckets[k]; }),
                backgroundColor: function (ctx) {
                    if (ctx.dataIndex == null || ctx.dataIndex < 0) return '#eab308';
                    var col = PSD_CHART_PALETTE.aging[ctx.dataIndex] || '#eab308';
                    return psdLinearGradient(ctx.chart, col, psdCssVar('--acc'));
                },
                borderRadius: 10, maxBarThickness: 56
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: psdChartTooltip() },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } } } }
    });
}

// ============================================================
// ASSIGN QUEUE + ASSIGNED QUEUE (ag-Grid)
// ============================================================
function psdRenderAssignQueue(body) {
    if (!psdAllAgents.length) { body.innerHTML = psdErrBox('No PSD agents in Account Mapping (Team = PSD).'); return; }
    var pendingAll = psdAllItems.filter(function (it) { return it.PSDStatus === PSD_STATUS.PENDING; });
    var pending = psdApplyQueueFilters(pendingAll, psdAssignFilters, false);
    body.innerHTML = psdQueueFilterBarHTML('assign', pendingAll) +
        '<div id="psdAssignMain">' +
        psdBulkBarHTML('assign') +
        psdGridSectionHTML('Assign Queue — Pending', 'psdAssignGrid', 'psdAssignCount', 'psdAssignSearch', 'psdExportAssignCsv()', pending.length) +
        '</div>';
    psdRenderGrid('assign', 'psdAssignGrid', 'psdAssignCount', pending, 'assign');
    psdBindMsOutsideClick();
    psdPopulateMainMsDropdowns('psdAssignF', pendingAll, psdAssignFilters, 'psdApplyAssignFilters');
    psdSafeUpdateDateFilterOptions('psdAssignF', pendingAll, 'psdApplyAssignFilters');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function psdRenderAssignedQueue(body) {
    if (!psdAllAgents.length) { body.innerHTML = psdErrBox('No PSD agents in Account Mapping (Team = PSD).'); return; }
    var assignedAll = psdAllItems.filter(function (it) { return it.PSDStatus === PSD_STATUS.INPROGRESS; });
    var assigned = psdApplyQueueFilters(assignedAll, psdAssignedFilters, true);
    body.innerHTML = psdQueueFilterBarHTML('assigned', assignedAll) +
        '<div id="psdAssignedMain">' +
        psdBulkBarHTML('reassign') +
        psdGridSectionHTML('Assigned Queue — In Progress', 'psdAssignedGrid', 'psdAssignedCount', 'psdAssignedSearch', 'psdExportAssignedCsv()', assigned.length) +
        '</div>';
    psdRenderGrid('assigned', 'psdAssignedGrid', 'psdAssignedCount', assigned, 'assigned');
    psdBindMsOutsideClick();
    psdPopulateMainMsDropdowns('psdAssignedF', assignedAll, psdAssignedFilters, 'psdApplyAssignedFilters');
    psdSafeUpdateDateFilterOptions('psdAssignedF', assignedAll, 'psdApplyAssignedFilters');
    if (typeof lucide !== 'undefined') lucide.createIcons();
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

window.psdBulkAssign = function () {
    var name = (document.getElementById('psdBulkAgent') || {}).value;
    if (!name) { psdToast('Pick an agent', 'warn'); return; }
    var rows = psdGetSelectedRows('assign');
    if (!rows.length) { psdToast('Select at least one row', 'warn'); return; }
    psdDoAssign(rows.map(function (r) { return { id: r.id, agentName: name }; }), false);
};

window.psdBulkReassign = function () {
    var name = (document.getElementById('psdBulkAgent') || {}).value;
    if (!name) { psdToast('Pick an agent', 'warn'); return; }
    var rows = psdGetSelectedRows('assigned');
    if (!rows.length) { psdToast('Select at least one row', 'warn'); return; }
    psdDoAssign(rows.map(function (r) { return { id: r.id, agentName: name }; }), true);
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
    var mine = psdApplyDateFilters(psdScopedItems(), psdDateFilters);
    var s = psdSummary(mine);
    var inq = mine.filter(function (it) { return it.PSDStatus === PSD_STATUS.INPROGRESS; });

    body.innerHTML =
        psdDateFilterBarOnlyHTML('psdAgentF') +
        '<div id="psdMyQueueMain">' +
        '<div class="top-stats">' +
            psdTile('In Queue', s.inprogress, 'Open', psdStatusColor(PSD_STATUS.INPROGRESS)) +
            psdTile('Completed', s.completed, 'By you', psdStatusColor(PSD_STATUS.COMPLETED)) +
            psdTile('Total Assigned', mine.length, 'All time', 'var(--acc)') +
            psdTile('Avg SLA', s.avgTtc + ' d', 'Assign/Reassign → done', 'var(--acc2)') +
        '</div>' +
        psdGridSectionHTML('My Queue — In Progress', 'psdAgentQueueGrid', 'psdAgentQueueCount', 'psdAgentSearch', 'psdExportAgentQueueCsv()', inq.length) +
        psdGridSectionHTML('My Records', 'psdAgentGrid', 'psdAgentRecCount', 'psdAgentRecSearch', 'psdExportAgentRecordsCsv()', mine.length) +
        '</div>';

    psdRenderGrid('agentQueue', 'psdAgentQueueGrid', 'psdAgentQueueCount', inq, 'agentqueue');
    psdRenderGrid('agentRecords', 'psdAgentGrid', 'psdAgentRecCount', mine, 'records');
    psdBindMsOutsideClick();
    psdSafeUpdateDateFilterOptions('psdAgentF', psdScopedItems(), 'psdApplyAgentDateFilters');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.psdComplete = async function (id) {
    var item = psdAllItems.find(function (it) { return it.ID === id; });
    var digest;
    try { digest = await psdGetDigest(); } catch (e) { psdToast('Digest error', 'error'); return; }
    try {
        await psdUpdateItem(id, { PSDStatus: PSD_STATUS.COMPLETED, CompletedDate: new Date().toISOString() }, digest);
        if (item) {
            var notifyItem = Object.assign({}, item, { PSDStatus: PSD_STATUS.COMPLETED, CompletedDate: new Date().toISOString() });
            try { await psdSendCompletionEmail(notifyItem); } catch (mailErr) { console.warn('[PSD] completion email', mailErr); }
        }
        psdToast('Marked completed — admin notified', 'success');
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
            OrderStatus: 'Open', ActivityTypeText: 'Provisioning', Owner: 'Owner ' + (i + 1),
            Category: cats[i % 3], CustomerAccount: 'Customer ' + (i + 1) + ' LLC',
            CreatedOn: up, OrderCreatedDate: up,
            Description: 'O365 Provisioning : demo' + i, Product: i % 2 ? 'BU' : 'BS Pro',
            BUStatus: 'Active', DNSStatus: 'Pending', ProvisioningOwner: 'Prov Owner',
            ProvisioningType: 'Standard', ProvisioningStatus: 'In Progress',
            DNSActivityRef: 'DNS-' + i, BUActivityRef: 'BU-' + i,
            PSDStatus: st, UploadDate: up, AssignmentDate: asg, ReassignDate: rea, CompletedDate: cmp,
            AssignedToName: st === PSD_STATUS.PENDING ? '' : agents[i % 3], AssignedToEmail: ''
        });
    }
    return out;
}
