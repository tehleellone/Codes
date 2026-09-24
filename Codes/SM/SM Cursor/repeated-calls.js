// ============================================================
// repeated-calls.js — Repeated Calls Module v1.9.20
// List: Repeated_Calls | Agents: Account Mapping (CTI match, all teams)
// SP fields: RC_Status, Upload_Date, Assignment_Date, Reassign_Date, Resolved_Date, Assigned_To
// ============================================================

var RC_DUMMY_MODE = false;

var RC_LIST       = 'Repeated_Calls';
var RC_AGENT_LIST = 'Account Mapping';

var rcAllItems      = [];
var rcAllAgents     = [];
var rcCtiMap        = {};
var rcEntityType    = null;
var rcActiveTab     = 'dashboard';
var rcCharts        = {};
var rcGrids         = { dash: null, assign: null, assigned: null, agentQueue: null, agentRecords: null };
var rcUploadRows    = []; 
var rcSelectedAgent = null;
window.RC_MODULE_VERSION = '1.9.20';

var RC_DELETE_ALL_EMAILS = ['tehleel.lone@du.ae', 'ubaid.mir@du.ae'];
var RC_MIN_REPEAT_CALLS = 3;
var RC_UPLOAD_SITE = 'CC-SGS-Emtyaz';
var RC_UPLOAD_CUSTOMER_TYPE = 'Enterprise';

var rcSpChoices = {};
var rcSpChoicesLoaded = false;

// Editable workflow fields (SharePoint list columns)
var RC_WORKFLOW_FIELDS = [
    { key: 'Account_Number', label: 'Account Number', type: 'text' },
    { key: 'Call_Driver', label: 'Call Driver', type: 'choice' },
    { key: 'Issue_In_Details', label: 'Issue In Details', type: 'multiline' },
    { key: 'LOB', label: 'LOB', type: 'choice' },
    { key: 'Call_Back_Status', label: 'Call Back Status', type: 'choice' },
    { key: 'Pending_With', label: 'Pending With', type: 'choice' },
    { key: 'Resolution_Status', label: 'Resolution Status', type: 'choice' }
];

var RC_SP_CONCURRENCY = 10;

// SharePoint internal names (match Repeated_Calls list)
var RC_SP = {
    STATUS: 'RC_Status',
    UPLOAD: 'Upload_Date',
    ASSIGN: 'Assignment_Date',
    REASSIGN: 'Reassign_Date',
    RESOLVED: 'Resolved_Date',
    ASSIGNED: 'Assigned_To',
    ASSIGNED_ID: 'Assigned_ToId'
};

function rcNormalizeItem(it) {
    if (!it) return it;
    it.RCStatus = it.RC_Status != null ? it.RC_Status : it.RCStatus;
    it.UploadDate = it.Upload_Date != null ? it.Upload_Date : it.UploadDate;
    it.AssignmentDate = it.Assignment_Date != null ? it.Assignment_Date : it.AssignmentDate;
    it.ReassignDate = it.Reassign_Date != null ? it.Reassign_Date : it.ReassignDate;
    it.CompletedDate = it.Resolved_Date != null ? it.Resolved_Date : it.CompletedDate;
    var at = it.Assigned_To || it.AssignedTo;
    it.AssignedToName = at ? at.Title : (it.AssignedToName || '');
    it.AssignedToEmail = at ? at.EMail : (it.AssignedToEmail || '');
    return it;
}

function rcSpFields(obj) {
    var map = {
        RCStatus: RC_SP.STATUS,
        UploadDate: RC_SP.UPLOAD,
        AssignmentDate: RC_SP.ASSIGN,
        ReassignDate: RC_SP.REASSIGN,
        CompletedDate: RC_SP.RESOLVED,
        AssignedToId: RC_SP.ASSIGNED_ID
    };
    var out = {};
    Object.keys(obj).forEach(function (k) {
        if (obj[k] === undefined) return;
        out[map[k] || k] = obj[k];
    });
    return out;
}

function rcExcelSerialToIso(serial) {
    if (serial == null || serial === '') return null;
    var n = parseFloat(String(serial).trim());
    if (isNaN(n)) return String(serial);
    var epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + n * 86400000).toISOString();
}

var rcDashFilters   = { status: [], language: [], lob: [], segment: [], agent: [], search: '' };
var rcDashTileFilter = 'all';
var rcTreeFilter = { node: '', value: '' };
var rcChartPluginsRegistered = false;
var rcMsisdnCounts  = {};
var rcRepeatVisible = false;
var rcDateFilters   = { dateField: 'UploadDate', dateMode: 'any', from: '', to: '', specific: '', years: [], quarters: [], months: [], weeks: [] };
var rcAssignDateFilters   = rcDateFilters;
var rcAssignedDateFilters = rcDateFilters;
var rcTodayOnly = true;
var rcCallerFlags = { itemsRef: null, map: {} };
var rcTrendGranularity = 'monthly';
var rcChartsBuilt   = false;
var rcLastChartItems = null;
var rcLastChartSummary = null;
var rcAgentsVisible = false;
var rcInitInFlight = null;

var RC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var RC_DATE_FIELD_OPTS = [
    { key: 'UploadDate', label: 'Upload Date' },
    { key: 'AssignmentDate', label: 'Assignment Date' },
    { key: 'ReassignDate', label: 'Reassign Date' },
    { key: 'CompletedDate', label: 'Resolved Date' },
    { key: 'Call_Date', label: 'Call Date' },
    { key: 'Call_DateTime', label: 'Call DateTime' }
];

var RC_WF_COLS = ['Account_Number', 'Call_Driver', 'Issue_In_Details', 'Call_Back_Status', 'Pending_With', 'Resolution_Status'];
var RC_EDIT_FIELD_ORDER = ['Account_Number', 'Call_Back_Status', 'Resolution_Status', 'LOB', 'Call_Driver', 'Pending_With', 'Issue_In_Details'];

var RC_COLS = [
    { key: 'Site', header: 'Site' },
    { key: 'Call_Date', header: 'Date' },
    { key: 'Call_DateTime', header: 'DateTime' },
    { key: 'MSISDN', header: 'MSISDN' },
    { key: 'skill_group_enterprisename', header: 'Skill Group' },
    { key: 'Language', header: 'Language' },
    { key: 'Customer_Type', header: 'Customer Type' },
    { key: 'Agent_Name', header: 'Agent Name' },
    { key: 'Talk_Time', header: 'Talk Time' },
    { key: 'Hold_Time', header: 'Hold Time' },
    { key: 'WrapUp_Time', header: 'Wrap Up Time' },
    { key: 'Customer_Value', header: 'Customer Value' },
    { key: 'Handling_Time', header: 'Handling Time' },
    { key: 'Market_For_Weekly_Score_Card', header: 'Market' },
    { key: 'SIEBEL_ID', header: 'SIEBEL ID' },
    { key: 'KB_ID', header: 'KB ID' },
    { key: 'Segment_Value', header: 'Segment' },
    { key: 'LOB', header: 'LOB' }
];

var RC_EXCEL_HEADERS = [
    'Site', 'Date', 'DateTime', 'MSISDN', 'skill_group_enterprisename', 'Language',
    'CustomerType', 'Agent_Name', 'TalkTime', 'HoldTime', 'WrapUpTime', 'CustomerValue',
    'HandlingTime', 'MarketForWeeklyScoreCard', 'SIEBELID', 'KBID', 'SegmentValue', 'LOB'
];

function rcCallKey(rec) {
    var msisdn = rec && rec.MSISDN != null ? String(rec.MSISDN).trim() : '';
    var dt = rec && rec.Call_DateTime != null ? String(rec.Call_DateTime).trim() : '';
    return msisdn && dt ? (msisdn + '_' + dt) : (msisdn || dt || '');
}

function rcBuildMsisdnCounts(items) {
    var map = {};
    (items || []).forEach(function (it) {
        var m = String(it.MSISDN || '').trim();
        if (m) map[m] = (map[m] || 0) + 1;
    });
    return map;
}

function rcRebuildMsisdnCounts(items) {
    rcMsisdnCounts = rcBuildMsisdnCounts(items || rcAllItems);
}

function rcMsisdnCallCount(msisdn) {
    var m = String(msisdn || '').trim();
    return m ? (rcMsisdnCounts[m] || 0) : 0;
}

function rcIsRepeatMsisdn(msisdn) {
    return rcMsisdnCallCount(msisdn) >= RC_MIN_REPEAT_CALLS;
}

function rcMsisdnKey(itOrMsisdn) {
    if (itOrMsisdn && typeof itOrMsisdn === 'object') return String(itOrMsisdn.MSISDN != null ? itOrMsisdn.MSISDN : '').trim();
    return String(itOrMsisdn != null ? itOrMsisdn : '').trim();
}

function rcIsNewerCall(it, cur) {
    var da = it && it.Call_DateTime ? new Date(it.Call_DateTime).getTime() : 0;
    var db = cur && cur.Call_DateTime ? new Date(cur.Call_DateTime).getTime() : 0;
    if (da !== db) return da > db;
    return (parseInt(it && it.ID, 10) || 0) > (parseInt(cur && cur.ID, 10) || 0);
}

function rcMsisdnHasInProgressAssignment(msisdn) {
    var m = rcMsisdnKey(msisdn);
    if (!m) return false;
    return rcAllItems.some(function (it) {
        return rcMsisdnKey(it) === m && rcDisplayStatus(it) === RC_STATUS.INPROGRESS;
    });
}

function rcItemsForMsisdnStatus(msisdn, status) {
    var m = rcMsisdnKey(msisdn);
    if (!m) return [];
    return rcAllItems.filter(function (it) {
        if (rcMsisdnKey(it) !== m) return false;
        if (status === RC_STATUS.PENDING) return !rcIsAssigned(it);
        if (status === RC_STATUS.INPROGRESS) return rcIsAssigned(it) && rcRowWorkflowStatus(it) === RC_STATUS.INPROGRESS;
        if (status === RC_STATUS.RESOLVED) return rcIsAssigned(it) && rcRowWorkflowStatus(it) === RC_STATUS.RESOLVED;
        return rcDisplayStatus(it) === status;
    });
}

function rcPickLatestItem(items) {
    if (!items || !items.length) return null;
    return items.reduce(function (best, it) { return !best || rcIsNewerCall(it, best) ? it : best; }, null);
}

function rcDedupeUniqueCallers(items) {
    var byMsisdn = {};
    (items || []).forEach(function (it) {
        var m = rcMsisdnKey(it);
        if (!m) return;
        if (!byMsisdn[m] || rcIsNewerCall(it, byMsisdn[m])) byMsisdn[m] = it;
    });
    return Object.keys(byMsisdn).map(function (m) { return byMsisdn[m]; });
}

function rcPickRepresentativeCallerRow(pool) {
    if (!pool || !pool.length) return null;
    var withCb = pool.filter(function (it) { return String(it.Call_Back_Status || '').trim(); });
    if (withCb.length) return rcPickLatestItem(withCb);
    var assigned = pool.filter(function (it) { return rcIsAssigned(it); });
    if (assigned.length) return rcPickLatestItem(assigned);
    return rcPickLatestItem(pool);
}

function rcDedupeUniqueCallersByWorkflow(items) {
    var byMsisdn = {};
    (items || []).forEach(function (it) {
        var m = rcMsisdnKey(it);
        if (!m) return;
        if (!byMsisdn[m]) byMsisdn[m] = [];
        byMsisdn[m].push(it);
    });
    return Object.keys(byMsisdn).map(function (m) {
        return rcPickRepresentativeCallerRow(byMsisdn[m]);
    }).filter(Boolean);
}

function rcRepeatCallerItems(items) {
    return (items || []).filter(function (it) { return rcIsRepeatMsisdn(it.MSISDN); });
}

function rcUniqueRepeatCallers(items) {
    return rcDedupeUniqueCallersByWorkflow(rcRepeatCallerItems(items));
}

function rcCallerDisplayStatus(it, items) {
    items = items || rcAllItems;
    if (!it) return RC_STATUS.PENDING;
    if (rcIsRepeatMsisdn(it.MSISDN)) return rcCanonicalUniqueCallerStatus(it.MSISDN, items);
    return rcDisplayStatus(it);
}

function rcInProgressSiblingIds(msisdn) {
    return rcItemsForMsisdnStatus(msisdn, RC_STATUS.INPROGRESS).map(function (it) { return it.ID; });
}

function rcRebuildCallerFlags(items) {
    var map = {};
    (items || []).forEach(function (it) {
        var m = rcMsisdnKey(it);
        if (!m) return;
        if (!map[m]) map[m] = { unassigned: false, assigned: false };
        if (rcIsAssigned(it)) map[m].assigned = true;
        else map[m].unassigned = true;
    });
    rcCallerFlags = { itemsRef: items, map: map };
    return map;
}

function rcCallerFlagsFor(items) {
    items = items || rcAllItems;
    if (rcCallerFlags.itemsRef === items) return rcCallerFlags.map;
    return rcRebuildCallerFlags(items);
}

function rcMsisdnHasAssignment(msisdn, items) {
    var m = rcMsisdnKey(msisdn);
    if (!m) return false;
    var f = rcCallerFlagsFor(items)[m];
    return !!(f && f.assigned);
}

function rcMsisdnHasUnassigned(msisdn, items) {
    var m = rcMsisdnKey(msisdn);
    if (!m) return false;
    var f = rcCallerFlagsFor(items)[m];
    return !!(f && f.unassigned);
}

/** KPI + grid status: unassigned rows in this set = Pending, even if an older row was assigned. */
function rcWorkflowStatusForCaller(msisdn, items) {
    items = items || rcAllItems;
    var m = rcMsisdnKey(msisdn);
    if (!m) return RC_STATUS.PENDING;
    if (rcMsisdnHasUnassigned(m, items)) return RC_STATUS.PENDING;
    if (!rcMsisdnHasAssignment(m, items)) return RC_STATUS.PENDING;

    var rec = rcGetCallerWorkflowRecord(m, items);
    if (!rec) return RC_STATUS.INPROGRESS;

    var cb = String(rec.Call_Back_Status || '').trim();
    if (!cb) return RC_STATUS.INPROGRESS;

    if (rcIsCallbackNotReachable(cb)) return RC_STATUS.RESOLVED;

    if (rcIsCallbackReachable(cb)) {
        var res = String(rec.Resolution_Status || '').trim();
        if (rcIsIssueResolved(res)) return RC_STATUS.RESOLVED;
        return RC_STATUS.INPROGRESS;
    }

    return RC_STATUS.INPROGRESS;
}

function rcCanonicalUniqueCallerStatus(msisdn, items) {
    return rcWorkflowStatusForCaller(msisdn, items);
}

function rcCallerTreeKind(it, items) {
    var rec = rcGetCallerWorkflowRecord(it.MSISDN, items) || it;
    var cb = String(rec.Call_Back_Status || '').trim();
    if (!cb) return { kind: 'awaiting', driver: '', pending: '' };
    if (rcIsCallbackNotReachable(cb)) return { kind: 'nr', driver: '', pending: '' };
    if (rcIsCallbackReachable(cb)) {
        var res = String(rec.Resolution_Status || '').trim();
        if (rcIsIssueResolved(res)) {
            return { kind: 'resolved', driver: String(rec.Call_Driver || '').trim() || 'Not set', pending: '' };
        }
        if (rcIsIssueNotResolved(res)) {
            return { kind: 'nres', driver: '', pending: String(rec.Pending_With || '').trim() || 'Not set' };
        }
        return { kind: 'reach', driver: '', pending: '' };
    }
    return { kind: 'ip', driver: '', pending: '' };
}

function rcMatchesTreeFilter(it, items) {
    var f = rcTreeFilter || {};
    if (!f.node || f.node === 'root') return true;
    var b = rcCallerTreeKind(it, items);
    if (f.node === 'nr') return b.kind === 'nr';
    if (f.node === 'awaiting' || f.node === 'ip') return b.kind === 'awaiting';
    if (f.node === 'reach') return b.kind === 'reach' || b.kind === 'resolved' || b.kind === 'nres';
    if (f.node === 'resolved') return b.kind === 'resolved';
    if (f.node === 'nres') return b.kind === 'nres';
    if (f.node === 'driver') {
        if (b.kind !== 'resolved') return false;
        if (f.value === 'Others') {
            var data = rcBuildContactTreeData(items);
            var top = rcTopNPairs(data.drivers, 5).filter(function (p) { return p.label !== 'Others'; }).map(function (p) { return p.label; });
            return top.indexOf(b.driver) < 0;
        }
        return b.driver === f.value;
    }
    if (f.node === 'pending') {
        if (b.kind !== 'nres') return false;
        if (f.value === 'Others') {
            var pdata = rcBuildContactTreeData(items);
            var ptop = rcTopNPairs(pdata.pendingWith, 5).filter(function (p) { return p.label !== 'Others'; }).map(function (p) { return p.label; });
            return ptop.indexOf(b.pending) < 0;
        }
        return b.pending === f.value;
    }
    return true;
}

function rcTreeFilterTitle() {
    var f = rcTreeFilter || {};
    if (!f.node || f.node === 'root') return 'Repeat Callers';
    var names = {
        nr: 'Not Reachable',
        reach: 'Reachable',
        awaiting: 'Awaiting callback capture',
        ip: 'Awaiting callback capture',
        resolved: 'Resolved',
        nres: 'Issue Not Resolved',
        driver: 'Driver · ' + (f.value || ''),
        pending: 'Pending With · ' + (f.value || '')
    };
    return 'Repeat Callers · ' + (names[f.node] || f.node);
}

function rcDashboardGridItems(items) {
    var unique = rcUniqueRepeatCallers(items);
    var f = rcDashTileFilter || 'all';
    if (f === 'pending' || f === 'inprogress' || f === 'resolved') {
        unique = unique.filter(function (it) {
            var st = rcCanonicalUniqueCallerStatus(it.MSISDN, items);
            if (f === 'pending') return st === RC_STATUS.PENDING;
            if (f === 'inprogress') return st === RC_STATUS.INPROGRESS;
            if (f === 'resolved') return st === RC_STATUS.RESOLVED;
            return true;
        });
    }
    return unique.filter(function (it) { return rcMatchesTreeFilter(it, items); });
}

function rcDateScopedItems(dateF) {
    var source = rcApplyDateFilters(rcAllItems, dateF || rcDateFilters);
    rcRebuildMsisdnCounts(source);
    rcRebuildCallerFlags(source);
    return source;
}

function rcRepeatCallersWithStatus(items, status) {
    rcRebuildMsisdnCounts(items);
    rcRebuildCallerFlags(items);
    return rcUniqueRepeatCallers(items).filter(function (it) {
        return rcWorkflowStatusForCaller(it.MSISDN, items) === status;
    });
}

function rcAssignQueueItems(dateF) {
    var source = rcDateScopedItems(dateF);
    return rcDedupeUniqueCallers(source.filter(function (it) {
        return rcIsRepeatMsisdn(it.MSISDN) && !rcIsAssigned(it);
    }));
}

function rcAssignedQueueItems(dateF) {
    return rcRepeatCallersWithStatus(rcDateScopedItems(dateF), RC_STATUS.INPROGRESS);
}

function rcExpandAssignPairs(pairs, isReassign) {
    var status = isReassign ? RC_STATUS.INPROGRESS : RC_STATUS.PENDING;
    var expanded = [];
    var seenIds = {};
    (pairs || []).forEach(function (p) {
        var item = rcAllItems.find(function (it) { return it.ID === p.id; });
        var siblings = item ? rcItemsForMsisdnStatus(item.MSISDN, status) : [];
        if (!siblings.length && item) siblings = [item];
        siblings.forEach(function (it) {
            if (seenIds[it.ID]) return;
            seenIds[it.ID] = true;
            expanded.push({ id: it.ID, agentName: p.agentName });
        });
    });
    return expanded;
}

function rcExpandResolveIds(id) {
    var item = rcAllItems.find(function (it) { return it.ID === id; });
    if (!item) return [id];
    return rcItemsForMsisdnStatus(item.MSISDN, RC_STATUS.INPROGRESS).map(function (it) { return it.ID; });
}

function rcIsAssigned(it) {
    if (!it) return false;
    return !!(it.AssignedToName || it.AssignedToId || (it.Assigned_To && it.Assigned_To.Title));
}

function rcDisplayStatus(it, items) {
    items = items || rcAllItems;
    if (!it) return RC_STATUS.PENDING;
    if (rcIsRepeatMsisdn(it.MSISDN)) {
        return rcWorkflowStatusForCaller(it.MSISDN, items);
    }
    if (!rcIsAssigned(it)) return RC_STATUS.PENDING;
    var cb = String(it.Call_Back_Status || '').trim();
    if (!cb) return RC_STATUS.INPROGRESS;
    if (rcIsCallbackNotReachable(cb)) return RC_STATUS.RESOLVED;
    if (rcIsCallbackReachable(cb)) {
        if (rcIsIssueResolved(String(it.Resolution_Status || ''))) return RC_STATUS.RESOLVED;
        return RC_STATUS.INPROGRESS;
    }
    return RC_STATUS.INPROGRESS;
}

function rcRepeatCallersList(items) {
    var map = rcBuildMsisdnCounts(items);
    var rows = [];
    Object.keys(map).forEach(function (m) {
        if (map[m] < RC_MIN_REPEAT_CALLS) return;
        var calls = items.filter(function (it) { return String(it.MSISDN || '').trim() === m; });
        var latest = calls[0] || {};
        rows.push({
            msisdn: m,
            count: map[m],
            customerValue: latest.Customer_Value || '—',
            lob: latest.LOB || '—',
            language: latest.Language || '—'
        });
    });
    return rows.sort(function (a, b) { return b.count - a.count; });
}

function rcTop10RepeatCallers(items) {
    return rcRepeatCallersList(items).slice(0, 10);
}

function rcTop10CallerTileHTML(items) {
    var top10 = rcTop10RepeatCallers(items);
    if (!top10.length) {
        return rcTile('Top 10 Who Called', '—', 'No customer called 2+ times yet', '#94a3b8');
    }
    var top = top10[0];
    return rcClickTile(
        'Top 10 Who Called',
        top.msisdn,
        '#1 · ' + top.count + ' calls' + (top10.length > 1 ? ' · click for top 10 chart' : ''),
        '#ef4444',
        'rcShowTop10Callers()'
    );
}

function rcTop10CallersPanelHTML(items) {
    var top10 = rcTop10RepeatCallers(items);
    if (!top10.length) return '';
    return '<div class="rc-panel" style="margin-top:0;margin-bottom:1rem;border-color:rgba(239,68,68,.25);">' +
        '<div class="rc-panel-title"><i data-lucide="trophy" style="width:18px;height:18px;color:#ef4444;"></i>Top 10 Who Called Most</div>' +
        '<p style="font-size:.76rem;color:var(--t3);margin:-.35rem 0 .75rem;">Customers (MSISDN) ranked by number of calls. Same person, different call times = repeat caller.</p>' +
        '<div class="rc-repeat-table-wrap"><table class="rc-repeat-table"><thead><tr>' +
        '<th>#</th><th>MSISDN</th><th>Times Called</th><th>LOB</th><th>Language</th><th></th>' +
        '</tr></thead><tbody>' +
        top10.map(function (r, i) {
            var safe = rcEsc(r.msisdn).replace(/'/g, "\\'");
            return '<tr class="rc-repeat-row"><td style="font-weight:800;color:var(--t3);">' + (i + 1) + '</td>' +
                '<td style="font-weight:800;">' + rcEsc(r.msisdn) + '</td>' +
                '<td>' + rcCallCountCell(r.count) + '</td>' +
                '<td>' + rcEsc(r.lob) + '</td>' +
                '<td>' + rcEsc(r.language) + '</td>' +
                '<td><button type="button" class="export-btn" style="padding:4px 10px;font-size:.68rem;" onclick="rcFilterByMsisdn(\'' + safe + '\')">View calls</button></td></tr>';
        }).join('') +
        '</tbody></table></div></div>';
}

function rcCallCountCell(val) {
    var n = parseInt(val, 10) || 0;
    if (n >= 5) return '<span class="rc-call-count rc-call-count-high">' + n + '</span>';
    if (n >= RC_MIN_REPEAT_CALLS) return '<span class="rc-call-count rc-call-count-repeat">' + n + '</span>';
    return '<span class="rc-call-count">' + n + '</span>';
}

var RC_STATUS = { PENDING: 'Pending', INPROGRESS: 'Inprogress', RESOLVED: 'Resolved' };

function rcNormStatusRaw(s) {
    if (s == null || s === undefined) return '';
    return String(s).trim();
}
function rcIsPendingStatus(s) {
    var v = rcNormStatusRaw(s);
    if (!v) return true;
    return v === RC_STATUS.PENDING || v.toLowerCase() === 'pending';
}
function rcIsInProgressStatus(s) {
    var v = rcNormStatusRaw(s);
    return v === RC_STATUS.INPROGRESS || v === 'In Progress' || v.toLowerCase() === 'in progress' || v.toLowerCase() === 'inprogress';
}
function rcIsResolvedStatus(s) {
    var v = rcNormStatusRaw(s).toLowerCase();
    return v === 'resolved' || v === 'completed';
}

function rcIsTrulyResolved(it) {
    if (!it) return false;
    return rcDisplayStatus(it) === RC_STATUS.RESOLVED;
}
function rcCanonicalStatus(s) {
    if (rcIsPendingStatus(s)) return RC_STATUS.PENDING;
    if (rcIsInProgressStatus(s)) return RC_STATUS.INPROGRESS;
    if (rcIsResolvedStatus(s)) return RC_STATUS.RESOLVED;
    var v = rcNormStatusRaw(s);
    return v || '—';
}

function rcDateFiltersRef(prefix) {
    return rcDateFilters;
}
function rcFreshDateFilters() {
    return { dateField: 'UploadDate', dateMode: 'any', from: '', to: '', specific: '', years: [], quarters: [], months: [], weeks: [] };
}

// ── Roles ─────────────────────────────────────────────────────
function rcRole() {
    var r = (window.USER_CONTEXT && window.USER_CONTEXT.role) || 'none';
    if (r === 'RC Admin') return 'RC_Admin';
    if (r === 'RC Agent') return 'RC_Agent';
    return r;
}
function rcUserName()    { return (window.USER_CONTEXT && window.USER_CONTEXT.userName) || ''; }
function rcUserEmail()   { return (window.USER_CONTEXT && window.USER_CONTEXT.userEmail) || ''; }
function rcIsSMAdmin()   { return rcRole() === 'Admin'; }
function rcIsRcAdmin()  { return rcRole() === 'RC_Admin'; }
function rcIsAdminLike() { return rcIsSMAdmin() || rcIsRcAdmin(); }
function rcIsAgent()     { return rcRole() === 'RC_Agent'; }
function rcHasAccess()   { return rcIsAdminLike() || rcIsAgent(); }

function rcCanDeleteAll() {
    var em = (rcUserEmail() || '').toLowerCase().trim();
    return RC_DELETE_ALL_EMAILS.indexOf(em) >= 0;
}

function rcStripHtml(html) {
    if (html == null || html === '') return '';
    var s = String(html).trim();
    if (!/[<>]/.test(s)) return s;
    var el = document.createElement('div');
    el.innerHTML = s;
    return (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ').trim();
}

async function rcFetchSpChoices() {
    if (RC_DUMMY_MODE) { rcSpChoicesLoaded = true; return; }
    var choiceFields = RC_WORKFLOW_FIELDS.filter(function (f) { return f.type === 'choice' && f.key !== 'LOB'; }).map(function (f) { return f.key; });
    if (!choiceFields.length) { rcSpChoicesLoaded = true; return; }
    var filter = choiceFields.map(function (n) { return "InternalName eq '" + rcOdata(n) + "'"; }).join(' or ');
    var url = SP_URL + "/_api/web/lists/getbytitle('" + RC_LIST + "')/fields?$select=InternalName,Choices,TypeAsString&$filter=" + filter;
    var r = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!r.ok) throw new Error('Failed to load SharePoint field choices (' + r.status + ')');
    var data = await r.json();
    rcSpChoices = {};
    (data.d.results || []).forEach(function (f) {
        var choices = (f.Choices && f.Choices.results) ? f.Choices.results.slice() : [];
        if (choices.length) rcSpChoices[f.InternalName] = choices;
    });
    rcSpChoicesLoaded = true;
}

function rcEditChoiceOptions(field, currentVal) {
    // LOB values come from the Excel upload — dropdown shows what's already in the list, not SP choice config
    if (field.key === 'LOB') {
        var lobs = rcUniqueValues(rcAllItems, 'LOB');
        if (currentVal && lobs.indexOf(currentVal) < 0) lobs.unshift(currentVal);
        return lobs;
    }
    var fromSp = rcSpChoices[field.key];
    var opts = fromSp && fromSp.length ? fromSp.slice() : [];
    if (currentVal && opts.indexOf(currentVal) < 0) opts.unshift(currentVal);
    return opts;
}

function rcNormUploadVal(s) {
    return String(s || '').trim().toLowerCase();
}

function rcMatchesUploadSite(site) {
    return rcNormUploadVal(site) === rcNormUploadVal(RC_UPLOAD_SITE);
}

function rcMatchesUploadCustomerType(customerType) {
    return rcNormUploadVal(customerType) === rcNormUploadVal(RC_UPLOAD_CUSTOMER_TYPE);
}

function rcWorkflowEditValue(item, field) {
    var raw = item[field.key];
    if (raw == null || raw === undefined || String(raw).trim() === '') return '';
    var val = field.type === 'multiline' ? rcStripHtml(raw) : String(raw).trim();
    if (rcDisplayStatus(item) === RC_STATUS.PENDING && field.key === 'Resolution_Status' && val.toLowerCase() === 'pending') {
        return '';
    }
    return val;
}

function rcProcessUploadRows(rawRows) {
    var existing = {};
    rcAllItems.forEach(function (it) {
        var k = rcCallKey({ MSISDN: it.MSISDN, Call_DateTime: it.Call_DateTime });
        if (k) existing[k] = true;
    });
    var ignored = [], seen = {}, candidates = [];
    (rawRows || []).forEach(function (rec) {
        var k = rcCallKey(rec);
        if (!k) return;
        if (!rcMatchesUploadCustomerType(rec.Customer_Type)) {
            ignored.push({ msisdn: rec.MSISDN, callDateTime: rec.Call_DateTime, site: rec.Site, customerType: rec.Customer_Type, reason: 'Customer Type is not Enterprise' });
            return;
        }
        if (!rcMatchesUploadSite(rec.Site)) {
            ignored.push({ msisdn: rec.MSISDN, callDateTime: rec.Call_DateTime, site: rec.Site, customerType: rec.Customer_Type, reason: 'Site is not CC-SGS-Emtyaz' });
            return;
        }
        if (existing[k] || seen[k]) {
            ignored.push({ msisdn: rec.MSISDN, callDateTime: rec.Call_DateTime, site: rec.Site, customerType: rec.Customer_Type, reason: 'Exact duplicate (same MSISDN + DateTime)' });
            return;
        }
        seen[k] = true;
        candidates.push(rec);
    });
    var mergedCounts = rcBuildMsisdnCounts(
        candidates.map(function (r) { return { MSISDN: r.MSISDN }; }).concat(rcAllItems)
    );
    var toAdd = [];
    candidates.forEach(function (rec) {
        var m = String(rec.MSISDN || '').trim();
        if ((mergedCounts[m] || 0) >= RC_MIN_REPEAT_CALLS) toAdd.push(rec);
        else ignored.push({ msisdn: rec.MSISDN, callDateTime: rec.Call_DateTime, site: rec.Site, customerType: rec.Customer_Type, reason: 'MSISDN has fewer than 3 calls (3 or more required)' });
    });
    return { toAdd: toAdd, ignored: ignored };
}

function rcUploadIgnoredTableHTML(ignored) {
    if (!ignored || !ignored.length) return '';
    var show = ignored.slice(0, 100);
    return '<div class="rc-panel" style="margin-top:.85rem;border-color:rgba(239,68,68,.2);">' +
        '<div class="rc-panel-title" style="font-size:.88rem;">Ignored rows · ' + ignored.length + '</div>' +
        '<p style="font-size:.74rem;color:var(--t3);margin:-.35rem 0 .65rem;">Only Enterprise + CC-SGS-Emtyaz + MSISDNs with 3 or more calls are uploaded.</p>' +
        '<div class="rc-repeat-table-wrap"><table class="rc-repeat-table"><thead><tr>' +
        '<th>MSISDN</th><th>DateTime</th><th>Site</th><th>Customer Type</th><th>Reason</th>' +
        '</tr></thead><tbody>' +
        show.map(function (r) {
            return '<tr><td>' + rcEsc(r.msisdn || '—') + '</td><td>' + rcEsc(r.callDateTime || '—') + '</td><td>' + rcEsc(r.site || '—') + '</td><td>' + rcEsc(r.customerType || '—') + '</td><td style="color:#dc2626;font-weight:600;">' + rcEsc(r.reason) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        (ignored.length > show.length ? '<p style="font-size:.72rem;color:var(--t3);margin:.65rem 0 0;">…and ' + (ignored.length - show.length) + ' more ignored rows.</p>' : '') +
        '</div>';
}

function rcEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function rcOdata(s) { return String(s == null ? '' : s).replace(/'/g, "''"); }

function rcNormAgentName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
}

function rcAgentNameKey(name) {
    return rcNormAgentName(name).toLowerCase();
}

function rcCanonicalAgentName(name) {
    var key = rcAgentNameKey(name);
    if (!key) return '';
    for (var i = 0; i < rcAllAgents.length; i++) {
        if (rcAgentNameKey(rcAllAgents[i].name) === key) return rcAllAgents[i].name;
    }
    return rcNormAgentName(name);
}

function rcNormCti(v) {
    return String(v == null ? '' : v).trim();
}

function rcLookupCti(cti) {
    var key = rcNormCti(cti);
    if (!key) return null;
    if (rcCtiMap[key]) return rcCtiMap[key];
    var num = parseInt(key, 10);
    if (!isNaN(num) && rcCtiMap[String(num)]) return rcCtiMap[String(num)];
    return null;
}

function rcAgentDisplayName(cti) {
    var mapped = rcLookupCti(cti);
    if (mapped && mapped.name) return mapped.name;
    var raw = rcNormCti(cti);
    return raw || '—';
}

function rcBuildCtiMap() {
    rcCtiMap = {};
    rcAllAgents.forEach(function (a) {
        var cti = rcNormCti(a.cti);
        if (!cti) return;
        var entry = { name: a.name, email: a.email || '', team: a.team || '', cti: cti };
        rcCtiMap[cti] = entry;
        var num = parseInt(cti, 10);
        if (!isNaN(num)) rcCtiMap[String(num)] = entry;
    });
}

function rcGetSelectVal(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
}

function rcWeekOfMonth(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return Math.ceil(d.getDate() / 7);
}

function rcPad2(n) {
    return (n < 10 ? '0' : '') + n;
}

function rcTodayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + rcPad2(d.getMonth() + 1) + '-' + rcPad2(d.getDate());
}

function rcParseFilterDate(val, endOfDay) {
    if (!val) return null;
    var s = String(val).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    var d;
    if (m) d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    else d = new Date(s);
    if (isNaN(d.getTime())) return null;
    if (endOfDay) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function rcDateMeta(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var y = d.getFullYear(), mi = d.getMonth();
    return {
        year: y,
        quarter: Math.floor(mi / 3) + 1,
        monthIndex: mi,
        week: rcWeekOfMonth(d),
        dayStart: new Date(y, mi, d.getDate()).getTime()
    };
}

function rcItemDateValue(item, field) {
    if (!item || !field) return null;
    return item[field] || null;
}

function rcApplyDateFilters(items, f) {
    f = f || rcDateFilters;
    var field = f.dateField || 'UploadDate';
    if (rcTodayOnly) {
        var todayTs = rcParseFilterDate(rcTodayIso(), false);
        return items.filter(function (it) {
            var meta = rcDateMeta(rcItemDateValue(it, field));
            return !!(meta && todayTs != null && meta.dayStart === todayTs);
        });
    }
    var mode = f.dateMode || 'any';
    if (mode === 'any') return items;
    return items.filter(function (it) {
        var meta = rcDateMeta(rcItemDateValue(it, field));
        if (!meta) return false;
        if (mode === 'range') {
            var fromTs = rcParseFilterDate(f.from, false);
            if (fromTs != null && meta.dayStart < fromTs) return false;
            var toTs = rcParseFilterDate(f.to, true);
            if (toTs != null && meta.dayStart > toTs) return false;
            return true;
        }
        if (mode === 'single') {
            if (!f.specific) return true;
            var specTs = rcParseFilterDate(f.specific, false);
            if (specTs == null) return true;
            return meta.dayStart === specTs;
        }
        if (mode === 'period') {
            if (f.years && f.years.length && f.years.indexOf(String(meta.year)) < 0) return false;
            if (f.quarters && f.quarters.length && f.quarters.indexOf(String(meta.quarter)) < 0) return false;
            if (f.months && f.months.length && f.months.indexOf(String(meta.monthIndex)) < 0) return false;
            if (f.weeks && f.weeks.length && f.weeks.indexOf(String(meta.week)) < 0) return false;
            return true;
        }
        return true;
    });
}

function rcReadDateFiltersFromDom(prefix) {
    prefix = prefix || 'rcFilter';
    var todayEl = document.getElementById(prefix + 'TodayOnly');
    if (todayEl) rcTodayOnly = !!todayEl.checked;
    var f = rcDateFiltersRef(prefix);
    f.dateField = rcGetSelectVal(prefix + 'DateField') || 'UploadDate';
    f.dateMode = rcGetSelectVal(prefix + 'DateMode') || 'any';
    f.from = rcGetSelectVal(prefix + 'DateFrom');
    f.to = rcGetSelectVal(prefix + 'DateTo');
    f.specific = rcGetSelectVal(prefix + 'DateSpecific');
    f.years = rcGetMsValues(prefix + 'DateYearDropdown');
    f.quarters = rcGetMsValues(prefix + 'DateQuarterDropdown');
    f.months = rcGetMsValues(prefix + 'DateMonthDropdown');
    f.weeks = rcGetMsValues(prefix + 'DateWeekDropdown');
}

function rcResetDateFiltersState() {
    rcTodayOnly = true;
    rcDateFilters = rcFreshDateFilters();
    rcAssignDateFilters = rcDateFilters;
    rcAssignedDateFilters = rcDateFilters;
}

function rcDateModeHint(mode) {
    if (mode === 'range') return 'Pick a start date and end date — both days are included.';
    if (mode === 'single') return 'Shows records on exactly one day (uses the date field above).';
    if (mode === 'period') return 'Pick year, quarter, month, and/or week — combine as needed.';
    return 'All dates shown — change “How to filter” below to narrow by date.';
}

function rcReportDateLabel(f) {
    f = f || rcDateFilters;
    var fieldLabel = 'Upload Date';
    RC_DATE_FIELD_OPTS.forEach(function (o) {
        if (o.key === f.dateField) fieldLabel = o.label;
    });
    if (rcTodayOnly) return fieldLabel + ': Today';
    var mode = f.dateMode || 'any';
    if (mode === 'range') {
        if (f.from && f.to) return fieldLabel + ': ' + rcFmtDate(f.from) + ' – ' + rcFmtDate(f.to);
        if (f.from) return fieldLabel + ': from ' + rcFmtDate(f.from);
        if (f.to) return fieldLabel + ': until ' + rcFmtDate(f.to);
    }
    if (mode === 'single' && f.specific) return fieldLabel + ': ' + rcFmtDate(f.specific);
    if (mode === 'period') {
        var parts = [];
        if (f.years && f.years.length) parts.push('Years ' + f.years.join(', '));
        if (f.quarters && f.quarters.length) parts.push('Q' + f.quarters.join(', Q'));
        if (f.months && f.months.length) {
            parts.push(f.months.map(function (m) { return RC_MONTHS[parseInt(m, 10)] || m; }).join(', '));
        }
        if (f.weeks && f.weeks.length) parts.push('Weeks ' + f.weeks.join(', '));
        if (parts.length) return fieldLabel + ' · ' + parts.join(' · ');
    }
    return fieldLabel + ': All dates';
}

function rcGetReportData() {
    rcReadDateFiltersFromDom('rcFilter');
    var base = rcAllItems;
    var dateFiltered = rcApplyDateFilters(base, rcDateFilters);
    rcRebuildMsisdnCounts(dateFiltered);
    rcRebuildCallerFlags(dateFiltered);
    var items = rcApplyDashFilters(dateFiltered);
    return {
        items: items,
        summary: rcSummary(items, dateFiltered),
        dateLabel: rcReportDateLabel(rcDateFilters)
    };
}

function rcBuildTrendChartData(items) {
    var granularity = rcTrendGranularity || 'monthly';
    var field = rcDateFilters.dateField || 'UploadDate';
    var counts = {};
    rcRepeatCallerItems(items).forEach(function (it) {
        var key = rcTrendBucketKey(rcItemDateValue(it, field), granularity);
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
    });
    var keys = Object.keys(counts).sort();
    return {
        labels: keys.length ? keys.map(function (k) { return rcTrendLabel(k, granularity); }) : ['No data'],
        values: keys.length ? keys.map(function (k) { return counts[k]; }) : [0]
    };
}

function rcBuildCallDriverChartData(items) {
    var counts = {};
    rcUniqueRepeatCallers(items).forEach(function (it) {
        var rec = rcGetCallerWorkflowRecord(it.MSISDN, items) || it;
        var d = rec.Call_Driver != null ? String(rec.Call_Driver).trim() : '';
        if (!d) d = 'Not set';
        counts[d] = (counts[d] || 0) + 1;
    });
    var pairs = rcTopNPairs(counts, 5);
    if (!pairs.length) return { labels: ['No data'], values: [0] };
    return {
        labels: pairs.map(function (p) { return p.label; }),
        values: pairs.map(function (p) { return p.count; })
    };
}

function rcBuildSlaChartData(items) {
    var slaKeys = ['0-1d', '1-2d', '2-3d', '3-5d', '5d+'];
    var slaBuckets = {};
    slaKeys.forEach(function (k) { slaBuckets[k] = 0; });
    rcUniqueRepeatCallers(items).forEach(function (it) {
        if (rcCanonicalUniqueCallerStatus(it.MSISDN, items) === RC_STATUS.PENDING) return;
        var bk = rcSlaBucketKey(rcSlaDays(it));
        if (bk && slaBuckets[bk] != null) slaBuckets[bk]++;
    });
    return {
        labels: slaKeys,
        values: slaKeys.map(function (k) { return slaBuckets[k]; })
    };
}

window.rcOnTodayOnlyChange = function (prefix, onChangeFn) {
    prefix = prefix || 'rcFilter';
    var el = document.getElementById(prefix + 'TodayOnly');
    rcTodayOnly = !!(el && el.checked);
    rcSyncTodayOnlyUI(prefix);
    if (onChangeFn && typeof window[onChangeFn] === 'function') window[onChangeFn]();
};

function rcSyncTodayOnlyUI(prefix) {
    prefix = prefix || 'rcFilter';
    var cb = document.getElementById(prefix + 'TodayOnly');
    if (cb) cb.checked = !!rcTodayOnly;
    var wrap = document.getElementById(prefix + 'DateCustomWrap');
    if (wrap) wrap.style.opacity = rcTodayOnly ? '0.45' : '1';
    ['DateMode', 'DateFrom', 'DateTo', 'DateSpecific'].forEach(function (suffix) {
        var el = document.getElementById(prefix + suffix);
        if (el) el.disabled = !!rcTodayOnly;
    });
}

window.rcOnDateModeChange = function (prefix, onChangeFn) {
    var f = rcDateFiltersRef(prefix);
    rcTodayOnly = false;
    var cb = document.getElementById(prefix + 'TodayOnly');
    if (cb) cb.checked = false;
    f.dateMode = rcGetSelectVal(prefix + 'DateMode') || 'any';
    rcSyncDateModeUI(prefix);
};

function rcSyncDateModeUI(prefix) {
    prefix = prefix || 'rcFilter';
    var f = rcDateFiltersRef(prefix);
    var mode = rcGetSelectVal(prefix + 'DateMode') || f.dateMode || 'any';
    var rangeG = document.getElementById(prefix + 'DateRangeGroup');
    var singleG = document.getElementById(prefix + 'DateSingleGroup');
    var periodG = document.getElementById(prefix + 'DatePeriodGroup');
    var hint = document.getElementById(prefix + 'DateHint');
    if (rangeG) rangeG.style.display = mode === 'range' ? 'grid' : 'none';
    if (singleG) singleG.style.display = mode === 'single' ? 'grid' : 'none';
    if (periodG) periodG.style.display = mode === 'period' ? 'grid' : 'none';
    if (hint) hint.textContent = rcTodayOnly
        ? 'Showing today’s records only. Uncheck the box to use a custom date range.'
        : rcDateModeHint(mode);
    rcSyncTodayOnlyUI(prefix);
}

function rcCollectDateMetas(items, field) {
    var metas = [];
    (items || []).forEach(function (it) {
        var meta = rcDateMeta(rcItemDateValue(it, field));
        if (meta) metas.push(meta);
    });
    return metas;
}

function rcGetMsValues(dropdownId) {
    var el = document.getElementById(dropdownId);
    if (!el) return [];
    return Array.prototype.slice.call(el.querySelectorAll('input[type="checkbox"]:checked')).map(function (cb) { return cb.value; });
}

window.rcToggleMsDropdown = function (dropdownId) {
    document.querySelectorAll('.rc-ms .multiselect-dropdown').forEach(function (d) {
        if (d.id !== dropdownId) d.style.display = 'none';
    });
    var dd = document.getElementById(dropdownId);
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};

window.rcUpdateMsText = function (textId, label, dropdownId) {
    var selected = rcGetMsValues(dropdownId);
    var el = document.getElementById(textId);
    if (!el) return;
    if (selected.length === 0) {
        el.textContent = 'All ' + label;
        return;
    }
    if (selected.length === 1) {
        var v = selected[0];
        if (dropdownId.indexOf('DateQuarter') >= 0) el.textContent = 'Q' + v;
        else if (dropdownId.indexOf('DateMonth') >= 0) el.textContent = RC_MONTHS[parseInt(v, 10)] || v;
        else if (dropdownId.indexOf('DateWeek') >= 0) el.textContent = 'W' + v;
        else el.textContent = v;
        return;
    }
    el.textContent = selected.length + ' selected';
};

function rcBuildMsDropdown(dropdownId, textId, label, values, selected, onChangeFn, labelFn) {
    var dd = document.getElementById(dropdownId);
    if (!dd) return;
    var selSet = {};
    (selected || []).forEach(function (v) { selSet[String(v)] = true; });
    dd.innerHTML = values.map(function (val) {
        var disp = labelFn ? labelFn(val) : val;
        var safeId = dropdownId + '_' + String(val).replace(/\W/g, '_');
        var checked = selSet[String(val)] ? ' checked' : '';
        return '<div class="multiselect-option" onclick="event.stopPropagation()">' +
            '<input type="checkbox" id="' + safeId + '" value="' + rcEsc(val) + '"' + checked +
            ' onchange="' + onChangeFn + '();rcUpdateMsText(\'' + textId + '\',\'' + label + '\',\'' + dropdownId + '\')">' +
            '<label for="' + safeId + '">' + rcEsc(disp) + '</label></div>';
    }).join('');
    rcUpdateMsText(textId, label, dropdownId);
}

function rcMsFilterHTML(prefix, key, label) {
    return '<div class="fb-group"><div class="fb-group-label">' + rcEsc(label) + '</div>' +
        '<div class="custom-multiselect rc-ms">' +
            '<div class="multiselect-selected" onclick="event.stopPropagation();rcToggleMsDropdown(\'' + prefix + key + 'Dropdown\')">' +
                '<span id="' + prefix + key + 'Text">All ' + rcEsc(label) + '</span>' +
                '<span style="opacity:.75;">▾</span></div>' +
            '<div class="multiselect-dropdown" id="' + prefix + key + 'Dropdown" style="display:none;"></div>' +
        '</div></div>';
}

function rcBindMsOutsideClick() {
    if (window._rcMsClickBound) return;
    window._rcMsClickBound = true;
    document.addEventListener('click', function () {
        document.querySelectorAll('.rc-ms .multiselect-dropdown').forEach(function (d) { d.style.display = 'none'; });
    }, true);
}

function rcPopulateDateMsDropdowns(prefix, items, onChangeFn) {
    prefix = prefix || 'rcFilter';
    onChangeFn = onChangeFn || 'rcApplyDashboardFilters';
    var f = rcDateFiltersRef(prefix);
    var field = f.dateField || 'UploadDate';
    var metas = rcCollectDateMetas(items, field);
    var ySel = f.years || [];
    var qSel = f.quarters || [];
    var mSel = f.months || [];

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

    rcBuildMsDropdown(prefix + 'DateYearDropdown', prefix + 'DateYearText', 'Years', years, f.years, onChangeFn);
    rcBuildMsDropdown(prefix + 'DateQuarterDropdown', prefix + 'DateQuarterText', 'Quarters', quarters, f.quarters, onChangeFn, function (v) { return 'Q' + v; });
    rcBuildMsDropdown(prefix + 'DateMonthDropdown', prefix + 'DateMonthText', 'Months', months, f.months, onChangeFn, function (v) { return RC_MONTHS[parseInt(v, 10)] || v; });
    rcBuildMsDropdown(prefix + 'DateWeekDropdown', prefix + 'DateWeekText', 'Weeks', weeks, f.weeks, onChangeFn, function (v) { return 'W' + v; });
}

function rcSafeUpdateDateFilterOptions(prefix, items, onChangeFn) {
    try { rcPopulateDateMsDropdowns(prefix, items, onChangeFn); } catch (e) { console.warn('[RC] date filter options', e); }
}

function rcMatchMulti(val, arr) {
    if (!arr || !arr.length) return true;
    var s = val == null ? '' : String(val);
    return arr.some(function (a) { return String(a) === s; });
}

function rcPopulateMainMsDropdowns(prefix, items, filters, onChangeFn) {
    prefix = prefix || 'rcFilter';
    onChangeFn = onChangeFn || 'rcApplyDashboardFilters';
    filters = filters || rcDashFilters;
    var langs = rcUniqueValues(items, 'Language');
    var lobs = rcUniqueValues(items, 'LOB');
    var segs = rcUniqueValues(items, 'Segment_Value');
    if (prefix === 'rcFilter') {
        var statuses = [RC_STATUS.PENDING, RC_STATUS.INPROGRESS, RC_STATUS.RESOLVED];
        var agents = rcAllAgents.map(function (a) { return a.name; });
        rcBuildMsDropdown(prefix + 'StatusDropdown', prefix + 'StatusText', 'Statuses', statuses, filters.status, onChangeFn);
        rcBuildMsDropdown(prefix + 'LanguageDropdown', prefix + 'LanguageText', 'Languages', langs, filters.language, onChangeFn);
        rcBuildMsDropdown(prefix + 'LobDropdown', prefix + 'LobText', 'LOB', lobs, filters.lob, onChangeFn);
        rcBuildMsDropdown(prefix + 'SegmentDropdown', prefix + 'SegmentText', 'Segments', segs, filters.segment, onChangeFn);
        rcBuildMsDropdown(prefix + 'AgentDropdown', prefix + 'AgentText', 'Agents', agents, filters.agent, onChangeFn);
        return;
    }
    if (prefix === 'rcAssignF') {
        rcBuildMsDropdown(prefix + 'LanguageDropdown', prefix + 'LanguageText', 'Languages', langs, filters.language, onChangeFn);
        rcBuildMsDropdown(prefix + 'LobDropdown', prefix + 'LobText', 'LOB', lobs, filters.lob, onChangeFn);
        rcBuildMsDropdown(prefix + 'SegmentDropdown', prefix + 'SegmentText', 'Segments', segs, filters.segment, onChangeFn);
        return;
    }
    if (prefix === 'rcAssignedF') {
        var agentSet = {};
        rcUniqueValues(items, 'AssignedToName').forEach(function (n) {
            var canon = rcCanonicalAgentName(n);
            if (canon) agentSet[canon] = true;
        });
        var agents = Object.keys(agentSet).sort();
        rcBuildMsDropdown(prefix + 'LanguageDropdown', prefix + 'LanguageText', 'Languages', langs, filters.language, onChangeFn);
        rcBuildMsDropdown(prefix + 'LobDropdown', prefix + 'LobText', 'LOB', lobs, filters.lob, onChangeFn);
        rcBuildMsDropdown(prefix + 'SegmentDropdown', prefix + 'SegmentText', 'Segments', segs, filters.segment, onChangeFn);
        rcBuildMsDropdown(prefix + 'AgentDropdown', prefix + 'AgentText', 'Agents', agents, filters.agent, onChangeFn);
    }
}

function rcShowInitError(loadingEl, contentEl, message) {
    if (contentEl) contentEl.style.display = 'none';
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-weight:700;color:var(--t1);">Could not load Repeated Calls</div>' +
            '<div style="font-size:.82rem;color:var(--t3);margin:8px 0;">' + rcEsc(message || 'Unknown error') + '</div>' +
            '<button type="button" class="export-btn" onclick="rcInit()">Retry</button></div>';
    }
}

function rcDateFilterRowHTML(prefix, onChangeFn) {
    prefix = prefix || 'rcFilter';
    onChangeFn = onChangeFn || 'rcApplyDashboardFilters';
    var f = rcDateFilters;
    var mode = f.dateMode || 'any';
    var fieldOpts = RC_DATE_FIELD_OPTS.map(function (o) {
        return '<option value="' + o.key + '"' + (f.dateField === o.key ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');
    var modeOpts = [
        { v: 'any', l: 'Show all dates' },
        { v: 'range', l: 'Between two dates' },
        { v: 'single', l: 'One specific day' },
        { v: 'period', l: 'Year / quarter / month / week' }
    ].map(function (o) {
        return '<option value="' + o.v + '"' + (mode === o.v ? ' selected' : '') + '>' + o.l + '</option>';
    }).join('');
    return '<div style="grid-column:1/-1;margin-top:.55rem;padding-top:.55rem;border-top:1px dashed var(--border);">' +
        '<label style="display:inline-flex;align-items:center;gap:8px;margin:0 0 .55rem;cursor:pointer;font-weight:700;font-size:.86rem;color:var(--t1);">' +
            '<input type="checkbox" id="' + prefix + 'TodayOnly" ' + (rcTodayOnly ? 'checked' : '') +
            ' onchange="rcOnTodayOnlyChange(\'' + prefix + '\',\'' + onChangeFn + '\')" style="width:16px;height:16px;cursor:pointer;">' +
            'View today’s data only</label>' +
        '<div id="' + prefix + 'DateCustomWrap">' +
        '<div class="filter-bar-grid">' +
            '<div class="fb-group"><div class="fb-group-label">Which date field?</div>' +
                '<select class="fb-select" id="' + prefix + 'DateField" onchange="' + onChangeFn + '()">' + fieldOpts + '</select></div>' +
            '<div class="fb-group"><div class="fb-group-label">How to filter</div>' +
                '<select class="fb-select" id="' + prefix + 'DateMode" onchange="rcOnDateModeChange(\'' + prefix + '\',\'' + onChangeFn + '\');' + onChangeFn + '()">' + modeOpts + '</select></div>' +
        '</div>' +
        '<div id="' + prefix + 'DateHint" class="rc-date-hint">' + rcEsc(rcDateModeHint(mode)) + '</div>' +
        '<div id="' + prefix + 'DateRangeGroup" class="filter-bar-grid" style="display:' + (mode === 'range' ? 'grid' : 'none') + ';margin-top:.45rem;">' +
            '<div class="fb-group"><div class="fb-group-label">Start date</div>' +
                '<input type="date" class="fb-select" id="' + prefix + 'DateFrom" value="' + rcEsc(f.from) + '" onchange="' + onChangeFn + '()" style="cursor:text;"></div>' +
            '<div class="fb-group"><div class="fb-group-label">End date</div>' +
                '<input type="date" class="fb-select" id="' + prefix + 'DateTo" value="' + rcEsc(f.to) + '" onchange="' + onChangeFn + '()" style="cursor:text;"></div>' +
        '</div>' +
        '<div id="' + prefix + 'DateSingleGroup" class="filter-bar-grid" style="display:' + (mode === 'single' ? 'grid' : 'none') + ';margin-top:.45rem;">' +
            '<div class="fb-group"><div class="fb-group-label">Pick a day</div>' +
                '<input type="date" class="fb-select" id="' + prefix + 'DateSpecific" value="' + rcEsc(f.specific) + '" onchange="' + onChangeFn + '()" style="cursor:text;"></div>' +
        '</div>' +
        '<div id="' + prefix + 'DatePeriodGroup" class="filter-bar-grid" style="display:' + (mode === 'period' ? 'grid' : 'none') + ';margin-top:.45rem;">' +
            rcMsFilterHTML(prefix, 'DateYear', 'Years') +
            rcMsFilterHTML(prefix, 'DateQuarter', 'Quarters') +
            rcMsFilterHTML(prefix, 'DateMonth', 'Months') +
            rcMsFilterHTML(prefix, 'DateWeek', 'Weeks') +
        '</div>' +
        '</div>' +
    '</div>';
}

function rcDateFilterBarOnlyHTML(prefix) {
    prefix = prefix || 'rcAgentF';
    return '<div class="filter-bar" style="margin-bottom:.85rem;">' +
        '<div class="filter-bar-header">' +
            '<span class="filter-bar-label">Date Filters</span>' +
            '<button type="button" class="reset-btn" onclick="rcResetAgentDateFilters()">Reset</button>' +
        '</div>' +
        rcDateFilterRowHTML(prefix, 'rcApplyAgentDateFilters') +
    '</div>';
}

window.rcApplyAgentDateFilters = function () {
    rcReadDateFiltersFromDom('rcAgentF');
    rcRefreshMyQueueContent();
};

window.rcResetAgentDateFilters = function () {
    rcResetDateFiltersState();
    rcRenderTabBody();
};

function rcDaysBetween(a, b) {
    if (!a || !b) return null;
    var d1 = new Date(a), d2 = new Date(b);
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function rcSlaStartDate(item) {
    if (!item) return null;
    if (item.ReassignDate) return item.ReassignDate;
    if (item.AssignmentDate) return item.AssignmentDate;
    return item.UploadDate;
}

function rcSlaDays(item) {
    if (!item) return null;
    var start = rcSlaStartDate(item);
    if (!start) return null;
    var end = rcDisplayStatus(item) === RC_STATUS.RESOLVED ? item.CompletedDate : new Date().toISOString();
    return rcDaysBetween(start, end);
}

function rcAging(item) {
    var end = rcDisplayStatus(item) === RC_STATUS.RESOLVED ? item.CompletedDate : new Date().toISOString();
    return rcDaysBetween(item.UploadDate, end);
}

function rcTimeToComplete(item) {
    if (rcDisplayStatus(item) !== RC_STATUS.RESOLVED) return null;
    return rcDaysBetween(rcSlaStartDate(item), item.CompletedDate);
}

function rcFmtDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d)) return rcEsc(v);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function rcStatusColor(s) {
    if (rcIsResolvedStatus(s))  return '#22c55e';
    if (s === RC_STATUS.INPROGRESS) return '#f59e0b';
    return '#94a3b8';
}

function rcToast(msg, type) {
    var bg = type === 'error' ? '#ef4444' : (type === 'warn' ? '#f59e0b' : '#22c55e');
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99999;background:' + bg +
        ';color:#fff;padding:14px 20px;border-radius:12px;font-weight:700;font-size:.85rem;box-shadow:0 8px 28px rgba(0,0,0,.25);max-width:380px;';
    t.textContent = msg;
    if (typeof smMountPopup === 'function') smMountPopup(t);
    else document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 3200);
    setTimeout(function () { t.remove(); }, 3700);
}

function rcSpinnerBlock(msg, sub, pct) {
    var pctNum = pct == null ? null : Math.max(0, Math.min(100, Math.round(pct)));
    return '<div class="rc-spinner-box">' +
        '<div class="rc-spinner-ring"></div>' +
        '<div class="rc-spinner-msg">' + rcEsc(msg || 'Working…') + '</div>' +
        (sub ? '<div class="rc-spinner-sub">' + rcEsc(sub) + '</div>' : '') +
        (pctNum != null ?
            '<div class="rc-progress-bar"><div class="rc-progress-fill" style="width:' + pctNum + '%;"></div></div>' +
            '<div class="rc-spinner-sub">' + pctNum + '%</div>' : '') +
        '</div>';
}

function rcEnsureBusyOverlay() {
    var root = document.getElementById('rcContainer') || document.getElementById('rcView');
    if (!root) return null;
    var el = document.getElementById('rcBusyOverlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rcBusyOverlay';
        el.className = 'rc-busy-overlay';
        if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
        root.appendChild(el);
    }
    return el;
}

function rcShowBusy(msg, sub, pct) {
    var el = rcEnsureBusyOverlay();
    if (!el) return;
    el.style.display = 'flex';
    el.innerHTML = rcSpinnerBlock(msg, sub, pct);
}

function rcHideBusy() {
    var el = document.getElementById('rcBusyOverlay');
    if (el) {
        el.style.display = 'none';
        el.innerHTML = '';
    }
}

function rcSetInlineProgress(elId, msg, pct) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = rcSpinnerBlock(msg, null, pct);
}

async function rcRunPool(items, worker, options) {
    options = options || {};
    var concurrency = options.concurrency || RC_SP_CONCURRENCY;
    var onProgress = options.onProgress;
    var digestRefreshEvery = options.digestRefreshEvery || 100;
    var getDigest = options.getDigest;
    var setDigest = options.setDigest;
    var total = items.length;
    var idx = 0, ok = 0, fail = 0;
    if (!total) return { ok: 0, fail: 0 };

    async function runWorker() {
        while (true) {
            var i = idx++;
            if (i >= total) return;
            if (getDigest && setDigest && digestRefreshEvery > 0 && i > 0 && i % digestRefreshEvery === 0) {
                try { setDigest(await rcGetDigest()); } catch (e) { /* keep prior digest */ }
            }
            try {
                await worker(items[i], i);
                ok++;
            } catch (e) {
                fail++;
                console.error('[RC pool]', e);
            }
            if (onProgress) onProgress(i + 1, total, ok, fail);
        }
    }

    var workers = [];
    for (var w = 0; w < Math.min(concurrency, total); w++) workers.push(runWorker());
    await Promise.all(workers);
    return { ok: ok, fail: fail };
}

// ── Chart theme (always pulled from SM CSS tokens) ───────────
function rcThemePalette() {
    var acc = (typeof rcCssVar === 'function' ? rcCssVar('--acc') : '') || '#a855f7';
    var acc2 = (typeof rcCssVar === 'function' ? rcCssVar('--acc2') : '') || '#c724b1';
    var t3 = (typeof rcCssVar === 'function' ? rcCssVar('--t3') : '') || '#8b7aad';
    return {
        pending:    { from: t3, to: acc },
        inprogress: { from: acc, to: acc2 },
        completed:  { from: acc2, to: acc },
        agents:     [acc, acc2, t3, '#6366f1', '#0891b2', '#059669'],
        categories: [acc, acc2, t3, '#6366f1', '#0891b2', '#d97706'],
        aging:      [acc, acc2, t3, '#f59e0b', '#ef4444']
    };
}
var RC_CHART_PALETTE = rcThemePalette();

function rcInjectStyles() {
    var existing = document.getElementById('rc-module-styles');
    if (existing) existing.parentNode.removeChild(existing);
    var s = document.createElement('style');
    s.id = 'rc-module-styles';
    s.textContent =
        '.rc-root{width:100%!important;max-width:none!important;box-sizing:border-box}' +
        '.rc-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-top:1rem;width:100%}' +
        '@media(max-width:1100px){.rc-chart-grid{grid-template-columns:1fr}.rc-chart-card.rc-chart-wide{grid-column:span 1}}' +
        '.rc-chart-card.rc-chart-wide{grid-column:span 2}' +
        '.rc-trend-toggles{display:flex;gap:6px;flex-wrap:wrap}' +
        '.rc-trend-toggle{padding:5px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t2);font-size:.72rem;font-weight:700;cursor:pointer}' +
        '.rc-trend-toggle.active{background:var(--grad);color:#fff;border-color:transparent}' +
        '.rc-date-hint{font-size:.72rem;color:var(--t3);margin-top:.45rem;line-height:1.4}' +
        '.rc-chart-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1rem 1.1rem;box-shadow:var(--cs);position:relative;overflow:hidden}' +
        '.rc-chart-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad);opacity:.85}' +
        '.rc-chart-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.5rem;margin-bottom:.85rem}' +
        '.rc-chart-head h3{font-size:.92rem!important;font-weight:800!important;color:var(--t1)!important;margin:0!important}' +
        '.rc-chart-head span{font-size:.68rem;color:var(--t3);font-weight:600}' +
        '.rc-chart-body{position:relative;width:100%}' +
        '.rc-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1rem 1.15rem;margin-top:1rem;box-shadow:var(--cs);width:100%;box-sizing:border-box}' +
        '.rc-panel-title{font-size:.95rem;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:.45rem;margin-bottom:.85rem}' +
        '.rc-upload-zone{display:block;width:100%;padding:16px;border:2px dashed var(--border-s);border-radius:12px;background:var(--bg-input);color:var(--t2);cursor:pointer;font-size:.85rem}' +
        '.filter-bar{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.85rem 1rem;margin-bottom:1rem;box-shadow:var(--cs)}' +
        '.filter-bar-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.7rem}' +
        '.filter-bar-label{font-size:.68rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em}' +
        '.filter-bar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.55rem .65rem;align-items:end}' +
        '.fb-group{display:flex;flex-direction:column;gap:.2rem;min-width:0}' +
        '.fb-group-label{font-size:.63rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}' +
        '.fb-select{padding:.38rem .65rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:.8rem;cursor:pointer;width:100%}' +
        '.rc-bulk-bar{display:flex;align-items:center;flex-wrap:wrap;gap:.55rem;padding:.65rem .85rem;margin-bottom:.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:10px}' +
        '.rc-bulk-label{font-size:.68rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}' +
        '.rc-bulk-count{font-size:.72rem;color:var(--t3);font-weight:600;margin-left:auto}' +
        '.rc-bulk-hint{font-size:.72rem;color:var(--t3);font-weight:600;flex:1 1 100%}' +
        '.rc-ag-set-filter{padding:.5rem;min-width:200px;max-width:260px}' +
        '.rc-ag-set-search{width:100%;box-sizing:border-box;margin-bottom:.45rem;padding:.35rem .5rem;border:1px solid var(--border);border-radius:8px;font-size:.75rem;background:var(--bg-card);color:var(--t1)}' +
        '.rc-ag-set-list{max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:.2rem}' +
        '.rc-ag-set-option{display:flex;align-items:center;gap:.35rem;font-size:.75rem;cursor:pointer;padding:.15rem 0}' +
        '.rc-ag-set-actions{display:flex;gap:.35rem;margin-top:.45rem}' +
        '.rc-ag-set-actions button{flex:1;padding:.25rem .4rem;font-size:.68rem;font-weight:700;border:1px solid var(--border);border-radius:6px;background:var(--nab);color:var(--acc);cursor:pointer}' +
        '.rc-status-badge{display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:700}' +
        '.rc-badge-pending{background:rgba(148,163,184,.15);color:#64748b}' +
        '.rc-badge-inprogress{background:rgba(245,158,11,.15);color:#d97706}' +
        '.rc-badge-completed{background:rgba(34,197,94,.15);color:#16a34a}' +
        '[id^="rcGrid"] .ag-checkbox-input-wrapper,[id^="rcAssign"] .ag-checkbox-input-wrapper,[id^="rcAssigned"] .ag-checkbox-input-wrapper,[id^="rcAgent"] .ag-checkbox-input-wrapper{opacity:1!important;width:16px;height:16px}' +
        '[id^="rcGrid"] .ag-cell,[id^="rcAssign"] .ag-cell,[id^="rcAssigned"] .ag-cell,[id^="rcAgent"] .ag-cell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:46px;padding-left:11px;padding-right:11px}' +
        '[id^="rcGrid"] .ag-header-cell,[id^="rcAssign"] .ag-header-cell,[id^="rcAssigned"] .ag-header-cell,[id^="rcAgent"] .ag-header-cell{overflow:hidden}' +
        '[id^="rcGrid"] .ag-header-cell-text,[id^="rcAssign"] .ag-header-cell-text,[id^="rcAssigned"] .ag-header-cell-text,[id^="rcAgent"] .ag-header-cell-text{overflow:hidden;text-overflow:ellipsis}' +
        '.rc-grid-action{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;width:100%;min-width:0}' +
        '.rc-grid-action .fb-select{font-size:.72rem;padding:4px 6px;flex:1;min-width:90px;max-width:140px}' +
        '.rc-grid-action .rc-action-btn{padding:4px 10px;font-size:.68rem;border:none;border-radius:6px;background:var(--grad);color:#fff;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0}' +
        '.rc-grid-action .rc-complete-btn{padding:4px 10px;font-size:.68rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--t1);font-weight:700;cursor:pointer;white-space:nowrap}' +
        '.rc-grid-action .rc-reopen-btn{padding:4px 10px;font-size:.68rem;border:1px solid rgba(245,158,11,.45);border-radius:6px;background:rgba(245,158,11,.12);color:#d97706;font-weight:700;cursor:pointer;white-space:nowrap}' +
        '.rc-grid-action .rc-delete-btn{padding:4px 10px;font-size:.68rem;border:1px solid rgba(239,68,68,.45);border-radius:6px;background:rgba(239,68,68,.12);color:#dc2626;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0}' +
        '.rc-delete-all-bar{display:flex;align-items:center;flex-wrap:wrap;gap:.65rem;margin-top:1rem;padding:.65rem .85rem;border:1px solid rgba(239,68,68,.25);border-radius:10px;background:rgba(239,68,68,.06)}' +
        '.rc-busy-overlay{display:none;position:absolute;inset:0;z-index:500;background:rgba(15,23,42,.42);backdrop-filter:blur(2px);align-items:center;justify-content:center;flex-direction:column;border-radius:12px}' +
        '.rc-spinner-box{display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 28px;background:var(--bg-card);border:1px solid var(--border);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.22);min-width:280px;max-width:92vw}' +
        '.rc-spinner-ring{width:44px;height:44px;border:4px solid rgba(148,163,184,.25);border-top-color:var(--acc);border-radius:50%;animation:rcSpin .75s linear infinite;flex-shrink:0}' +
        '.rc-spinner-msg{font-size:.88rem;font-weight:800;color:var(--t1);text-align:center}' +
        '.rc-spinner-sub{font-size:.75rem;color:var(--t3);text-align:center;line-height:1.35}' +
        '.rc-progress-bar{height:8px;width:100%;background:var(--bg-input);border-radius:999px;overflow:hidden}' +
        '.rc-progress-fill{height:100%;background:var(--grad);transition:width .15s ease;border-radius:999px}' +
        '@keyframes rcSpin{to{transform:rotate(360deg)}}' +
        '.rc-agent-tile{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.85rem 1rem;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;box-shadow:var(--cs)}' +
        '.rc-agent-tile:hover{transform:translateY(-2px);box-shadow:var(--ch)}' +
        '.rc-agent-tile.selected{border-color:var(--acc);box-shadow:0 0 0 2px var(--glow)}' +
        '.rc-agent-tile-head{display:flex;align-items:center;gap:.55rem;margin-bottom:.55rem}' +
        '.rc-agent-avatar{width:36px;height:36px;border-radius:50%;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.78rem;flex-shrink:0}' +
        '.rc-agent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.85rem;margin:1rem 0}' +
        '.rc-call-count{display:inline-flex;align-items:center;justify-content:center;min-width:26px;padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:800;background:rgba(148,163,184,.15);color:#64748b}' +
        '.rc-call-count-repeat{background:rgba(245,158,11,.18);color:#d97706}' +
        '.rc-call-count-high{background:rgba(239,68,68,.15);color:#dc2626}' +
        '.rc-repeat-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:10px}' +
        '.rc-repeat-table{width:100%;border-collapse:collapse;font-size:.78rem}' +
        '.rc-repeat-table th,.rc-repeat-table td{padding:.55rem .65rem;text-align:left;border-bottom:1px solid var(--border)}' +
        '.rc-repeat-table th{font-size:.65rem;text-transform:uppercase;letter-spacing:.05em;color:var(--t3);background:var(--bg-input)}' +
        '.rc-repeat-table tr:last-child td{border-bottom:none}' +
        '.rc-repeat-row:hover td{background:rgba(2,132,199,.06)}' +
        '.ag-theme-alpine .rc-row-repeat{background:rgba(245,158,11,.07)!important}' +
        '.stat-card.rc-stat-clickable{cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}' +
        '.stat-card.rc-stat-clickable:hover{transform:translateY(-2px);box-shadow:var(--ch)}' +
        '.stat-card.rc-stat-active{border:2px solid var(--acc)!important;box-shadow:0 0 0 3px var(--glow,rgba(99,102,241,.18))!important}' +
        '.rc-ms.custom-multiselect{position:relative;z-index:120;width:100%}' +
        '.rc-ms .multiselect-selected{padding:.38rem .65rem;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;color:var(--t1);font-size:.8rem;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;box-sizing:border-box}' +
        '.rc-ms .multiselect-selected:hover{border-color:var(--acc);box-shadow:0 0 0 2px var(--glow)}' +
        '.rc-edit-field textarea{min-height:80px;resize:vertical}' +
        '.rc-modal-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:1rem}' +
        '.rc-modal-box{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;max-width:520px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)}' +
        '.rc-modal-head{padding:1rem 1.15rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}' +
        '.rc-modal-head h3{margin:0;font-size:.95rem;font-weight:800;color:var(--t1)}' +
        '.rc-modal-close{border:none;background:transparent;color:var(--t3);font-size:1.25rem;cursor:pointer;line-height:1}' +
        '.rc-modal-body{padding:1rem 1.15rem;display:flex;flex-direction:column;gap:.75rem}' +
        '.rc-modal-foot{padding:.85rem 1.15rem;border-top:1px solid var(--border);display:flex;gap:.5rem;justify-content:flex-end}' +
        '.rc-edit-field label{display:block;font-size:.68rem;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:.25rem}' +
        '.rc-edit-field input,.rc-edit-field select,.rc-edit-field textarea{width:100%;box-sizing:border-box;padding:.45rem .65rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--t1);font-size:.82rem}' +
        '.rc-ms .multiselect-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--ch);max-height:240px;overflow-y:auto;z-index:9999}' +
        '.rc-ms .multiselect-option{padding:8px 12px;display:flex;align-items:center;cursor:pointer;border-bottom:1px solid var(--border)}' +
        '.rc-ms .multiselect-option:last-child{border-bottom:none}' +
        '.rc-ms .multiselect-option:hover{background:var(--bg-hover,rgba(148,163,184,.12))}' +
        '.rc-ms .multiselect-option input[type=checkbox]{margin-right:10px;width:15px;height:15px;cursor:pointer;accent-color:var(--acc)}' +
        '.rc-ms .multiselect-option label{cursor:pointer;flex:1;font-size:.8rem;color:var(--t1);margin:0}' +
        '.rc-cbr-host{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;margin:0 0 1.25rem;overflow:visible}' +
        '.rc-cbr{font-family:"Segoe UI",Calibri,"Helvetica Neue",Arial,sans-serif;color:#1c2740;background:#fff;border:1px solid #e2e8f0;padding:40px 44px 36px;box-sizing:border-box}' +
        '.rc-cbr-head{text-align:left;margin:0 0 32px}' +
        '.rc-cbr-head h3{margin:0;font-size:26px;line-height:1.2;font-weight:700;color:#152033;letter-spacing:-.02em}' +
        '.rc-cbr-head p{margin:8px 0 0;font-size:14px;line-height:1.4;color:#7b8694;font-weight:400}' +
        '.rc-cbr-flow{display:flex;align-items:stretch;gap:36px}' +
        '.rc-cbr-right{display:flex;flex-direction:column;gap:16px;flex:1;min-width:0}' +
        '.rc-cbr-reach-row{display:flex;align-items:stretch;gap:10px;min-width:0}' +
        '.rc-cbr-stack{width:186px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}' +
        '.rc-cbr-chart{flex:1;min-width:240px;display:flex;flex-direction:column;justify-content:center;padding:4px 0 0 6px}' +
        '.rc-cbr-tile{position:relative;background:#fff;border:1px solid #d5dbe3;padding:22px 18px 20px;text-align:center;cursor:pointer;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;overflow:hidden}' +
        '.rc-cbr-tile:hover{border-color:#b7c0cc}' +
        '.rc-cbr-tile.rc-cbr-active{box-shadow:inset 0 0 0 2px #2f95d8}' +
        '.rc-cbr-accent{position:absolute;top:0;left:0;right:0;height:6px}' +
        '.rc-cbr-total{width:236px;flex-shrink:0}' +
        '.rc-cbr-total .rc-cbr-accent{background:#1c2740}' +
        '.rc-cbr-nr{width:236px}' +
        '.rc-cbr-nr .rc-cbr-accent{background:#8c3a55}' +
        '.rc-cbr-nr .rc-cbr-label{color:#8c3a55}' +
        '.rc-cbr-reach{width:236px;flex-shrink:0}' +
        '.rc-cbr-reach .rc-cbr-accent{background:#2f95d8}' +
        '.rc-cbr-reach .rc-cbr-count,.rc-cbr-reach .rc-cbr-label{color:#2f95d8}' +
        '.rc-cbr-nres .rc-cbr-accent{background:#2f95d8}' +
        '.rc-cbr-res .rc-cbr-accent{background:#1c2740}' +
        '.rc-cbr-count{font-size:34px;font-weight:700;line-height:1;color:#1c2740;margin:4px 0 0;font-variant-numeric:tabular-nums}' +
        '.rc-cbr-total .rc-cbr-count{font-size:48px;margin-top:8px}' +
        '.rc-cbr-label{font-size:14px;font-weight:600;color:#1c2740;margin-top:10px;line-height:1.3}' +
        '.rc-cbr-desc{font-size:12px;color:#7b8694;margin-top:8px;line-height:1.5;font-weight:400}' +
        '.rc-cbr-sm{padding:16px 14px 14px}' +
        '.rc-cbr-sm .rc-cbr-count{font-size:28px}' +
        '.rc-cbr-sm .rc-cbr-label{font-size:13px;margin-top:8px}' +
        '.rc-cbr-sm .rc-cbr-desc{font-size:11px;margin-top:6px}' +
        '.rc-cbr-brace{width:28px;flex-shrink:0;display:flex;align-items:stretch;padding:6px 4px;box-sizing:border-box;pointer-events:none}' +
        '.rc-cbr-brace svg{width:100%;height:100%;display:block;overflow:visible}' +
        '.rc-cbr-brace-sm{align-self:flex-start;height:46%;min-height:72px}' +
        '.rc-cbr-chart-title{font-size:16px;font-weight:700;color:#1c2740;margin:0 0 10px;text-align:left}' +
        '.rc-cbr-chart-body{height:210px;position:relative}' +
        '.rc-cbr-await{margin-top:18px;padding:10px 14px;background:#fffbeb;border:1px solid #f5e6a8;font-size:13px;color:#5b5340;line-height:1.45}' +
        '.rc-cbr-link{color:#2f95d8;font-weight:600;cursor:pointer;text-decoration:underline}' +
        '.rc-cbr-findings{display:flex;align-items:flex-start;gap:16px;margin-top:36px}' +
        '.rc-cbr-findings-label{font-size:13px;font-weight:600;color:#1c2740;writing-mode:vertical-rl;transform:rotate(180deg);flex-shrink:0;letter-spacing:.01em;white-space:nowrap}' +
        '.rc-cbr-findings-list{margin:0;padding-left:22px;font-size:14px;color:#3d4754;line-height:1.85;list-style:decimal}' +
        '.rc-cbr-findings-list li{margin:0 0 4px}' +
        '@media(max-width:1100px){.rc-cbr{padding:24px}.rc-cbr-flow,.rc-cbr-reach-row{flex-wrap:wrap}.rc-cbr-total,.rc-cbr-nr,.rc-cbr-reach{width:100%}.rc-cbr-brace{display:none}.rc-cbr-stack{width:100%}.rc-cbr-chart{flex:1 1 100%;padding-left:0}}';
    document.head.appendChild(s);
}

function rcSetFullLayout(on) {
    var content = document.querySelector('#dashboardContent .content') || document.querySelector('.content');
    var shell = document.getElementById('dashboardContent') || document.querySelector('.portal-shell');
    if (content) content.classList.toggle('rc-full-mode', !!on);
    if (shell) shell.classList.toggle('rc-full-shell', !!on);
}

function rcCssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim() || '#a855f7'; }

function rcSafeColor(c, fallback) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
    return fallback || '#a855f7';
}

function rcLinearGradient(chart, c1, c2) {
    var from = rcSafeColor(c1, '#64748b');
    var to = rcSafeColor(c2, '#a855f7');
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

function rcHorizontalGradient(chart, c1, c2) {
    var from = rcSafeColor(c1, '#0284c7');
    var to = rcSafeColor(c2, '#a855f7');
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

function rcCenterTextPlugin(total, subtitle) {
    return {
        id: 'rcCenterText',
        afterDraw: function (chart) {
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data.length) return;
            var pt = meta.data[0], ctx = chart.ctx;
            ctx.save();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = rcCssVar('--t1'); ctx.font = '800 28px Inter,sans-serif';
            ctx.fillText(String(total), pt.x, pt.y - 6);
            ctx.fillStyle = rcCssVar('--t3'); ctx.font = '600 11px Inter,sans-serif';
            ctx.fillText(subtitle || 'Total', pt.x, pt.y + 16);
            ctx.restore();
        }
    };
}

function rcChartTooltip() {
    return {
        backgroundColor: 'rgba(15,23,42,0.94)', titleColor: '#f8fafc', bodyColor: '#e2e8f0',
        borderColor: 'rgba(148,163,184,0.25)', borderWidth: 1, padding: 12, cornerRadius: 10,
        titleFont: { size: 13, weight: '700' }, bodyFont: { size: 12, weight: '500' }
    };
}

function rcEnsureChartPlugins() {
    if (rcChartPluginsRegistered || typeof Chart === 'undefined') return;
    rcChartPluginsRegistered = true;
    Chart.register({
        id: 'rcValueLabels',
        afterDatasetsDraw: function (chart) {
            var ctx = chart.ctx;
            var type = chart.config.type;
            var labelColor = rcCssVar('--t1') || '#0f172a';
            chart.data.datasets.forEach(function (dataset, dsi) {
                var meta = chart.getDatasetMeta(dsi);
                if (!meta || meta.hidden) return;
                meta.data.forEach(function (elem, i) {
                    var val = dataset.data[i];
                    if (val == null || val === 0) return;
                    ctx.save();
                    ctx.font = 'bold 11px Inter,sans-serif';
                    ctx.fillStyle = labelColor;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    var text = String(val);
                    if (type === 'bar') {
                        var isHoriz = chart.options.indexAxis === 'y';
                        if (isHoriz) {
                            ctx.fillText(text, elem.x + Math.max(12, (elem.base - elem.x) / 2), elem.y);
                        } else {
                            ctx.fillText(text, elem.x, elem.y - 10);
                        }
                    } else if (type === 'line') {
                        ctx.fillText(text, elem.x, elem.y - 12);
                    } else if (type === 'doughnut' || type === 'pie') {
                        var pos = elem.tooltipPosition();
                        ctx.fillStyle = '#ffffff';
                        ctx.strokeStyle = 'rgba(15,23,42,.35)';
                        ctx.lineWidth = 3;
                        ctx.strokeText(text, pos.x, pos.y);
                        ctx.fillText(text, pos.x, pos.y);
                    }
                    ctx.restore();
                });
            });
        }
    });
}

function rcChartLayoutPadding() {
    return { padding: { top: 22, right: 8, left: 8, bottom: 4 } };
}

// ============================================================
// SHAREPOINT
// ============================================================
async function rcGetDigest() {
    var r = await fetch(SP_URL + '/_api/contextinfo', { method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    return (await r.json()).d.GetContextWebInformation.FormDigestValue;
}

async function rcGetEntityType() {
    if (rcEntityType) return rcEntityType;
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + RC_LIST + "')?$select=ListItemEntityTypeFullName",
        { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    rcEntityType = (await r.json()).d.ListItemEntityTypeFullName;
    return rcEntityType;
}

async function rcFetchAgents() {
    if (RC_DUMMY_MODE) {
        rcAllAgents = rcDummyAgents();
        rcBuildCtiMap();
        return;
    }
    var url = SP_URL + "/_api/web/lists/getbytitle('" + RC_AGENT_LIST + "')/items?" +
        "$select=Service_Manager_Name,Email_ID,Team,User_ID,CTI&$top=50000&$orderby=Service_Manager_Name asc";
    var r = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!r.ok) { rcAllAgents = []; rcCtiMap = {}; return; }
    var seen = {}, data = await r.json();
    rcAllAgents = [];
    (data.d.results || []).forEach(function (it) {
        var cti = rcNormCti(it.CTI);
        if (!cti) return;
        var name = rcNormAgentName(it.Service_Manager_Name || '');
        if (!name) return;
        var key = rcAgentNameKey(name);
        if (seen[key]) return;
        seen[key] = true;
        rcAllAgents.push({ name: name, email: it.Email_ID || '', team: it.Team || '', cti: cti });
    });
    rcBuildCtiMap();
}

async function rcFetchItems(showBusy) {
    if (RC_DUMMY_MODE) { rcAllItems = rcDummyItems(); rcClearPerfCache(); return; }
    if (showBusy) rcShowBusy('Loading records…', 'Fetching from SharePoint');
    try {
        var cols = RC_COLS.map(function (c) { return c.key; }).join(',');
        var wf = RC_WF_COLS.join(',');
        var url = SP_URL + "/_api/web/lists/getbytitle('" + RC_LIST + "')/items?" +
            "$select=ID," + cols + "," + wf + "," + RC_SP.STATUS + "," + RC_SP.UPLOAD + "," + RC_SP.ASSIGN + "," + RC_SP.REASSIGN + "," + RC_SP.RESOLVED + "," +
            RC_SP.ASSIGNED + "/Title," + RC_SP.ASSIGNED + "/EMail&$expand=" + RC_SP.ASSIGNED + "&$orderby=ID desc&$top=50000";
        var r = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!r.ok) throw new Error('Failed to load Repeated Calls (' + r.status + ')');
        var data = await r.json();
        rcAllItems = (data.d.results || []).map(function (it) { return rcNormalizeItem(it); });
        rcClearPerfCache();
        rcRebuildMsisdnCounts(rcAllItems);
    } finally {
        if (showBusy) rcHideBusy();
    }
}

async function rcResolveUserId(email, name) {
    if (email) {
        var r = await fetch(SP_URL + "/_api/web/siteusers?$filter=Email eq '" + rcOdata(email) + "'&$select=Id&$top=1",
            { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (r.ok) { var d = await r.json(); if (d.d.results.length) return d.d.results[0].Id; }
    }
    if (name) {
        var r2 = await fetch(SP_URL + "/_api/web/siteusers?$filter=Title eq '" + rcOdata(name) + "'&$select=Id&$top=1",
            { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (r2.ok) { var d2 = await r2.json(); if (d2.d.results.length) return d2.d.results[0].Id; }
    }
    return null;
}

async function rcCreateItem(fields, digest, entityType) {
    var body = Object.assign({ __metadata: { type: entityType || await rcGetEntityType() } }, fields);
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + RC_LIST + "')/items", {
        method: 'POST', credentials: 'include',
        headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest },
        body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('Create failed: ' + r.status);
    return r.json();
}

async function rcUpdateItem(id, fields, digest) {
    var body = Object.assign({ __metadata: { type: await rcGetEntityType() } }, fields);
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + RC_LIST + "')/items(" + id + ")", {
        method: 'POST', credentials: 'include',
        headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
        body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('Update failed: ' + r.status);
}

async function rcDeleteItem(id, digest) {
    var r = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + RC_LIST + "')/items(" + id + ")", {
        method: 'POST', credentials: 'include',
        headers: { 'Accept': 'application/json;odata=verbose', 'X-RequestDigest': digest, 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!r.ok) throw new Error('Delete failed: ' + r.status);
}

function rcSetDeleteProgress(msg) {
    var el = document.getElementById('rcDeleteProgress');
    if (el) el.innerHTML = msg;
}

// ============================================================
// ENTRY + SHELL
// ============================================================
window.rcInit = async function () {
    if (rcInitInFlight) {
        try { await rcInitInFlight; return; } catch (e) { /* allow retry below */ }
    }

    var loadingEl = document.getElementById('rcLoading');
    var contentEl = document.getElementById('rcContent');

    var runInit = async function () {
        try {
            rcInjectStyles();
            if (typeof injectAGGridThemeStyles === 'function') injectAGGridThemeStyles();
            if (typeof smClearModuleLayoutModes === 'function') smClearModuleLayoutModes();
            if (loadingEl) {
                loadingEl.style.display = 'block';
                loadingEl.innerHTML = rcSpinnerBlock('Loading Repeated Calls…', 'Fetching records and agents');
            }
            if (contentEl) contentEl.style.display = 'none';

            if (!rcHasAccess()) {
                if (loadingEl) loadingEl.innerHTML = '<div style="text-align:center;padding:50px;"><div style="font-size:2rem;">🔒</div><div style="font-weight:800;color:var(--t1);">Access Restricted</div></div>';
                return;
            }

            await Promise.race([
                Promise.all([rcFetchItems(false), rcFetchAgents(), rcFetchSpChoices()]),
                new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Request timed out after 60s — list may be very large')); }, 60000); })
            ]);

            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            rcActiveTab = rcIsAgent() ? 'myqueue' : 'dashboard';
            rcRenderShell();
        } catch (e) {
            console.error('[RC] init failed', e);
            rcShowInitError(loadingEl, contentEl, e && e.message ? e.message : String(e));
        }
    };

    rcInitInFlight = runInit();
    try {
        await rcInitInFlight;
    } finally {
        rcInitInFlight = null;
    }
};

function rcScopedItems() {
    if (rcIsAdminLike()) return rcAllItems;
    var me = rcUserName(), em = (rcUserEmail() || '').toLowerCase();
    return rcAllItems.filter(function (it) {
        return it.AssignedToName === me || (it.AssignedToEmail && it.AssignedToEmail.toLowerCase() === em);
    });
}

function rcTabsForRole() {
    if (rcIsAgent()) return [{ id: 'myqueue', label: 'My Queue', icon: 'inbox' }];
    return [
        { id: 'dashboard', label: 'RC Dashboard', icon: 'layout-dashboard' },
        { id: 'assign',    label: 'Assign Queue', icon: 'user-plus' },
        { id: 'assigned',  label: 'Assigned Queue', icon: 'users' }
    ];
}

function rcRenderShell() {
    var c = document.getElementById('rcContainer');
    if (!c) return;
    var tabs = rcTabsForRole();
    c.innerHTML =
        '<div class="rc-root">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:1rem;">' +
            '<div><h2 style="font-size:1.15rem;font-weight:900;color:var(--t1);display:flex;align-items:center;gap:.5rem;">' +
            '<i data-lucide="clipboard-list" style="width:24px;height:24px;color:var(--acc);"></i>Repeated Calls</h2>' +
            '<div style="font-size:.76rem;color:var(--t3);margin-top:3px;">' + rcEsc(rcRoleLabel()) + ' · ' + rcEsc(rcUserName()) + ' · v' + window.RC_MODULE_VERSION + '</div></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.1rem;">' +
        tabs.map(function (t) {
            var active = t.id === rcActiveTab;
            return '<button type="button" onclick="rcSwitchTab(\'' + t.id + '\')" style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700;border:1px solid ' +
                (active ? 'transparent' : 'var(--border)') + ';background:' + (active ? 'var(--grad)' : 'var(--bg-card)') + ';color:' + (active ? '#fff' : 'var(--t2)') + ';">' +
                '<i data-lucide="' + t.icon + '" style="width:15px;height:15px;"></i>' + t.label + '</button>';
        }).join('') +
        '</div><div id="rcTabBody"></div></div>';
    rcRenderTabBody();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function rcRoleLabel() {
    if (rcIsSMAdmin()) return 'SM Admin';
    if (rcIsRcAdmin()) return 'RC Admin';
    if (rcIsAgent()) return 'RC Agent';
    return rcRole();
}

window.rcSwitchTab = function (id) {
    rcActiveTab = id;
    rcPerfCache = { itemsRef: null, records: {}, status: {}, treeData: null };
    rcRenderShell();
};

function rcRenderTabBody() {
    var body = document.getElementById('rcTabBody');
    if (!body) return;
    try {
        rcDestroyCharts();
        rcDestroyAllGrids();
        if (rcActiveTab === 'dashboard') return rcRenderDashboard(body);
        if (rcActiveTab === 'assign')    return rcRenderAssignQueue(body);
        if (rcActiveTab === 'assigned')  return rcRenderAssignedQueue(body);
        if (rcActiveTab === 'myqueue')   return rcRenderMyQueue(body);
    } catch (e) {
        console.error('[RC] tab render failed', e);
        body.innerHTML = rcErrBox('Could not render Repeated Calls view: ' + rcEsc(e && e.message ? e.message : String(e)));
    }
}

function rcDestroyCharts() {
    Object.keys(rcCharts).forEach(function (k) { try { rcCharts[k].destroy(); } catch (e) {} });
    rcCharts = {};
}

function rcDestroyAllGrids() {
    Object.keys(rcGrids).forEach(function (k) {
        if (rcGrids[k] && rcGrids[k].destroy) { try { rcGrids[k].destroy(); } catch (e) {} }
        rcGrids[k] = null;
    });
}

function rcDestroyGrid(key) {
    if (rcGrids[key] && rcGrids[key].destroy) { try { rcGrids[key].destroy(); } catch (e) {} }
    rcGrids[key] = null;
}

function rcGetSelectedRows(key) {
    var api = rcGrids[key];
    if (!api) return [];
    if (typeof api.getSelectedRows === 'function') return api.getSelectedRows() || [];
    var rows = [];
    api.forEachNode && api.forEachNode(function (n) { if (n.isSelected && n.isSelected() && n.data) rows.push(n.data); });
    return rows;
}

// ── Filters ───────────────────────────────────────────────────
function rcUniqueValues(items, field) {
    return [...new Set(items.map(function (it) { return it[field]; }).filter(Boolean))].sort();
}

function rcApplyDashFilters(items) {
    var f = rcDashFilters;
    var needStatus = f.status && f.status.length;
    if (needStatus) rcCallerFlagsFor(items);
    return items.filter(function (it) {
        if (needStatus) {
            var st = rcIsRepeatMsisdn(it.MSISDN) ? rcWorkflowStatusForCaller(it.MSISDN, items) : rcDisplayStatus(it, items);
            if (!rcMatchMulti(st, f.status)) return false;
        }
        if (!rcMatchMulti(it.Language, f.language)) return false;
        if (!rcMatchMulti(it.LOB, f.lob)) return false;
        if (!rcMatchMulti(it.Segment_Value, f.segment)) return false;
        if (f.agent && f.agent.length && !rcMatchMulti(rcCanonicalAgentName(it.AssignedToName), f.agent)) return false;
        if (f.search) {
            var q = f.search.toLowerCase();
            var blob = [it.MSISDN, it.Agent_Name, it.Site, it.LOB, it.Language, it.Segment_Value, it.AssignedToName, it.skill_group_enterprisename].join(' ').toLowerCase();
            if (blob.indexOf(q) < 0) return false;
        }
        return true;
    });
}

function rcFilterItems(items) {
    return rcApplyDashFilters(rcApplyDateFilters(items, rcDateFilters));
}

function rcReadDashFiltersFromDom() {
    rcDashFilters.status   = rcGetMsValues('rcFilterStatusDropdown');
    rcDashFilters.language = rcGetMsValues('rcFilterLanguageDropdown');
    rcDashFilters.lob      = rcGetMsValues('rcFilterLobDropdown');
    rcDashFilters.segment  = rcGetMsValues('rcFilterSegmentDropdown');
    rcDashFilters.agent    = rcGetMsValues('rcFilterAgentDropdown');
    rcDashFilters.search   = (document.getElementById('rcFilterSearch') || {}).value || '';
    rcReadDateFiltersFromDom('rcFilter');
    rcSelectedAgent = rcDashFilters.agent.length === 1 ? rcDashFilters.agent[0] : null;
}

window.rcApplyDashboardFilters = function () {
    rcReadDashFiltersFromDom();
    rcRefreshDashboardContent();
};

window.rcResetDashboardFilters = function () {
    rcDashFilters = { status: [], language: [], lob: [], segment: [], agent: [], search: '' };
    rcDashTileFilter = 'all';
    rcTreeFilter = { node: '', value: '' };
    rcResetDateFiltersState();
    rcSelectedAgent = null;
    rcRenderTabBody();
};

window.rcKpiTileClick = function (key) {
    rcTreeFilter = { node: '', value: '' };
    rcDashTileFilter = (rcDashTileFilter === key) ? 'all' : key;
    rcRefreshDashboardContent();
    setTimeout(function () {
        var grid = document.getElementById('rcGrid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
};

window.rcTreeNodeClick = function (node, value) {
    node = String(node || '');
    value = value == null ? '' : String(value);
    var same = rcTreeFilter.node === node && (rcTreeFilter.value || '') === value;
    if (same || node === 'root') {
        rcTreeFilter = { node: '', value: '' };
    } else {
        rcTreeFilter = { node: node, value: value };
        rcDashTileFilter = 'all';
    }
    rcRefreshDashboardContent();
    setTimeout(function () {
        var grid = document.getElementById('rcGrid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
};

if (!window._rcTreeClickBound) {
    window._rcTreeClickBound = true;
    document.addEventListener('click', function (e) {
        var n = e.target && e.target.closest ? e.target.closest('.rc-cbr-tile, .rc-cbr-link, .rc-flow-node') : null;
        if (!n) return;
        e.preventDefault();
        e.stopPropagation();
        window.rcTreeNodeClick(n.getAttribute('data-rc-filter-node') || n.getAttribute('data-rc-node'), n.getAttribute('data-rc-filter-value') || '');
    }, true);
}

window.rcShowTop10Callers = function () {
    rcRepeatVisible = true;
    rcChartsBuilt = true;
    rcRefreshDashboardContent();
    setTimeout(function () {
        var target = document.getElementById('rcRepeatSection');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
};

window.rcFilterByMsisdn = function (msisdn) {
    rcDashFilters.search = String(msisdn || '');
    var searchEl = document.getElementById('rcFilterSearch');
    if (searchEl) searchEl.value = rcDashFilters.search;
    rcRefreshDashboardContent();
};

window.rcSelectAgentTile = function (name) {
    if (rcDashFilters.agent.length === 1 && rcDashFilters.agent[0] === name) {
        rcDashFilters.agent = [];
        rcSelectedAgent = null;
    } else {
        rcDashFilters.agent = [name];
        rcSelectedAgent = name;
    }
    rcBuildMsDropdown('rcFilterAgentDropdown', 'rcFilterAgentText', 'Agents',
        rcAllAgents.map(function (a) { return a.name; }), rcDashFilters.agent, 'rcApplyDashboardFilters');
    rcRefreshDashboardContent();
};

function rcFilterBarHTML(items, prefix) {
    prefix = prefix || 'rcFilter';
    return '<div class="filter-bar" style="margin-bottom:.85rem;">' +
        '<div class="filter-bar-header">' +
            '<span class="filter-bar-label">Filters</span>' +
            '<div style="display:flex;gap:.45rem;flex-wrap:wrap;align-items:center;">' +
                '<button type="button" id="rcExportPptBtn" class="export-btn" onclick="rcExportPpt()" style="padding:.4rem .85rem;font-size:.78rem;">' +
                    '<i data-lucide="presentation" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Download PPT</button>' +
                '<button type="button" id="rcExportPdfBtn" class="export-btn" onclick="rcExportPdf()" style="padding:.4rem .85rem;font-size:.78rem;">' +
                    '<i data-lucide="file-down" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Download PDF</button>' +
                '<button type="button" class="reset-btn" onclick="rcResetDashboardFilters()">Reset</button>' +
            '</div>' +
        '</div>' +
        '<div class="filter-bar-grid">' +
            rcMsFilterHTML(prefix, 'Status', 'Statuses') +
            rcMsFilterHTML(prefix, 'Language', 'Languages') +
            rcMsFilterHTML(prefix, 'Lob', 'LOB') +
            rcMsFilterHTML(prefix, 'Segment', 'Segments') +
            rcMsFilterHTML(prefix, 'Agent', 'Agents') +
            '<div class="fb-group"><div class="fb-group-label">Search</div>' +
            '<input type="text" class="fb-select" id="' + prefix + 'Search" placeholder="MSISDN, Agent, Site, LOB…" value="' + rcEsc(rcDashFilters.search) + '" oninput="rcApplyDashboardFilters()" style="cursor:text;"></div>' +
        '</div>' +
        rcDateFilterRowHTML(prefix, 'rcApplyDashboardFilters') +
        '</div>';
}

var rcAssignFilters = { language: [], lob: [], segment: [] };
var rcAssignedFilters = { language: [], lob: [], segment: [], agent: [] };

function rcQueueFilterBarHTML(type) {
    var prefix = type === 'assign' ? 'rcAssignF' : 'rcAssignedF';
    var fn = type === 'assign' ? 'rcApplyAssignFilters' : 'rcApplyAssignedFilters';
    var resetFn = type === 'assign' ? 'rcResetAssignFilters' : 'rcResetAssignedFilters';
    var agentCol = type === 'assigned' ? rcMsFilterHTML(prefix, 'Agent', 'Agents') : '';
    return '<div class="filter-bar" style="margin-bottom:.85rem;">' +
        '<div class="filter-bar-header"><span class="filter-bar-label">Filters</span>' +
        '<button type="button" class="reset-btn" onclick="' + resetFn + '()">Reset</button></div>' +
        '<div class="filter-bar-grid">' +
            rcMsFilterHTML(prefix, 'Language', 'Languages') +
            rcMsFilterHTML(prefix, 'Lob', 'LOB') +
            rcMsFilterHTML(prefix, 'Segment', 'Segments') +
            agentCol +
        '</div>' +
        rcDateFilterRowHTML(prefix, fn) +
        '</div>';
}

window.rcApplyAssignFilters = function () {
    rcAssignFilters.language = rcGetMsValues('rcAssignFLanguageDropdown');
    rcAssignFilters.lob = rcGetMsValues('rcAssignFLobDropdown');
    rcAssignFilters.segment = rcGetMsValues('rcAssignFSegmentDropdown');
    rcReadDateFiltersFromDom('rcAssignF');
    rcRefreshAssignContent();
};
window.rcResetAssignFilters = function () {
    rcAssignFilters = { language: [], lob: [], segment: [] };
    rcResetDateFiltersState();
    rcRenderTabBody();
};
window.rcApplyAssignedFilters = function () {
    rcAssignedFilters.language = rcGetMsValues('rcAssignedFLanguageDropdown');
    rcAssignedFilters.lob = rcGetMsValues('rcAssignedFLobDropdown');
    rcAssignedFilters.segment = rcGetMsValues('rcAssignedFSegmentDropdown');
    rcAssignedFilters.agent = rcGetMsValues('rcAssignedFAgentDropdown');
    rcReadDateFiltersFromDom('rcAssignedF');
    rcRefreshAssignedContent();
};
window.rcResetAssignedFilters = function () {
    rcAssignedFilters = { language: [], lob: [], segment: [], agent: [] };
    rcResetDateFiltersState();
    rcRenderTabBody();
};

function rcApplyQueueFilters(items, f, includeAgent, dateF) {
    return rcApplyDateFilters(items, dateF).filter(function (it) {
        if (!rcMatchMulti(it.Language, f.language)) return false;
        if (!rcMatchMulti(it.LOB, f.lob)) return false;
        if (!rcMatchMulti(it.Segment_Value, f.segment)) return false;
        if (includeAgent && f.agent && f.agent.length && !rcMatchMulti(rcCanonicalAgentName(it.AssignedToName), f.agent)) return false;
        return true;
    });
}

function rcCountUniquePendingCallers(items) {
    var flags = rcCallerFlagsFor(items);
    var n = 0;
    Object.keys(flags).forEach(function (m) {
        if (!m || !rcIsRepeatMsisdn(m)) return;
        if (flags[m] && flags[m].unassigned) n++;
    });
    return n;
}

function rcUniqueRepeatStatusCounts(items) {
    rcWarmPerfCache(items);
    var unique = rcUniqueRepeatCallers(items);
    var pending = 0, inprogress = 0, completed = 0;
    unique.forEach(function (it) {
        var st = rcStatusForItem(it, items);
        if (st === RC_STATUS.PENDING) pending++;
        else if (st === RC_STATUS.INPROGRESS) inprogress++;
        else if (st === RC_STATUS.RESOLVED) completed++;
    });
    return { pending: pending, inprogress: inprogress, completed: completed };
}

function rcSummary(items, countSource) {
    countSource = countSource || items;
    var s = { total: items.length, pending: 0, inprogress: 0, completed: 0, agingSum: 0, agingN: 0, ttcSum: 0, ttcN: 0, repeatCallers: 0, repeatCalls: 0 };
    var counts = rcBuildMsisdnCounts(countSource);
    Object.keys(counts).forEach(function (m) {
        if (counts[m] >= RC_MIN_REPEAT_CALLS) {
            s.repeatCallers++;
            s.repeatCalls += counts[m];
        }
    });
    var statusItems = countSource || items;
    s.pending = rcRepeatCallersWithStatus(statusItems, RC_STATUS.PENDING).length;
    s.inprogress = rcRepeatCallersWithStatus(statusItems, RC_STATUS.INPROGRESS).length;
    s.completed = rcRepeatCallersWithStatus(statusItems, RC_STATUS.RESOLVED).length;
    items.forEach(function (it) {
        var ag = rcAging(it); if (ag != null) { s.agingSum += ag; s.agingN++; }
        var ttc = rcTimeToComplete(it); if (ttc != null) { s.ttcSum += ttc; s.ttcN++; }
    });
    s.avgAging = s.agingN ? Math.round(s.agingSum / s.agingN) : 0;
    s.avgTtc   = s.ttcN ? Math.round(s.ttcSum / s.ttcN) : 0;
    return s;
}

function rcTile(label, value, subtitle, color) {
    return '<div class="stat-card"><div class="stat-label">' + rcEsc(label) + '</div>' +
        '<div class="stat-value"' + (color ? ' style="color:' + color + ';"' : '') + '>' + rcEsc(String(value)) + '</div>' +
        (subtitle ? '<div class="stat-subtitle">' + rcEsc(subtitle) + '</div>' : '') + '</div>';
}

function rcKpiTile(label, value, subtitle, color, key) {
    var active = rcDashTileFilter === key ? ' rc-stat-active' : '';
    return '<div class="stat-card rc-stat-clickable' + active + '" onclick="rcKpiTileClick(\'' + key + '\')" title="Click to filter the grid below">' +
        '<div class="stat-label">' + rcEsc(label) + '</div>' +
        '<div class="stat-value"' + (color ? ' style="color:' + color + ';"' : '') + '>' + rcEsc(String(value)) + '</div>' +
        (subtitle ? '<div class="stat-subtitle">' + rcEsc(subtitle) + '</div>' : '') + '</div>';
}

function rcClickTile(label, value, subtitle, color, onclick) {
    return '<div class="stat-card rc-stat-clickable" onclick="' + onclick + '" title="Click to filter">' +
        '<div class="stat-label">' + rcEsc(label) + '</div>' +
        '<div class="stat-value"' + (color ? ' style="color:' + color + ';"' : '') + '>' + rcEsc(String(value)) + '</div>' +
        (subtitle ? '<div class="stat-subtitle">' + rcEsc(subtitle) + '</div>' : '') + '</div>';
}

function rcRepeatCallersPanelHTML(items) {
    var rows = rcRepeatCallersList(items);
    if (!rows.length) {
        return '<div class="rc-panel"><div class="rc-panel-title"><i data-lucide="phone-missed" style="width:18px;height:18px;color:var(--acc);"></i>Repeat Callers</div>' +
            '<p style="color:var(--t3);font-size:.82rem;margin:0;">No MSISDN with 3+ calls in the current date/filter view.</p></div>';
    }
    var shown = rows.slice(0, 25);
    return '<div class="rc-panel"><div class="rc-panel-title"><i data-lucide="phone-missed" style="width:18px;height:18px;color:#f59e0b;"></i>Repeat Callers · top ' + shown.length + (rows.length > shown.length ? ' of ' + rows.length : '') + '</div>' +
        '<p style="font-size:.76rem;color:var(--t3);margin:-.35rem 0 .75rem;">MSISDNs with 3+ calls. Full detail is in the table below.</p>' +
        '<div class="rc-repeat-table-wrap"><table class="rc-repeat-table"><thead><tr>' +
        '<th>MSISDN</th><th>Times Called</th><th>Customer Value</th><th>LOB</th><th>Language</th>' +
        '</tr></thead><tbody>' +
        shown.map(function (r) {
            return '<tr class="rc-repeat-row"><td style="font-weight:800;">' + rcEsc(r.msisdn) + '</td>' +
                '<td>' + rcCallCountCell(r.count) + '</td>' +
                '<td>' + rcEsc(r.customerValue) + '</td>' +
                '<td>' + rcEsc(r.lob) + '</td>' +
                '<td>' + rcEsc(r.language) + '</td></tr>';
        }).join('') +
        '</tbody></table></div></div>';
}

function rcInitials(name) {
    if (!name) return '?';
    var p = name.trim().split(/\s+/);
    return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function rcAgentStats(items) {
    var stats = {};
    rcAllAgents.forEach(function (a) {
        stats[rcAgentNameKey(a.name)] = { name: a.name, email: a.email, assigned: 0, inprogress: 0, completed: 0, slaSum: 0, slaN: 0 };
    });
    items.forEach(function (it) {
        if (!it.AssignedToName) return;
        var canon = rcCanonicalAgentName(it.AssignedToName);
        var key = rcAgentNameKey(canon);
        if (!key) return;
        if (!stats[key]) stats[key] = { name: canon, email: it.AssignedToEmail || '', assigned: 0, inprogress: 0, completed: 0, slaSum: 0, slaN: 0 };
        var st = stats[key];
        st.assigned++;
        if (rcRowWorkflowStatus(it) === RC_STATUS.INPROGRESS) st.inprogress++;
        if (rcRowWorkflowStatus(it) === RC_STATUS.RESOLVED) {
            st.completed++;
            var sla = rcSlaDays(it);
            if (sla != null) { st.slaSum += sla; st.slaN++; }
        }
    });
    return Object.keys(stats).map(function (k) { return stats[k]; }).sort(function (a, b) { return b.completed - a.completed; });
}

function rcAgentTilesHTML(items) {
    var rows = rcAgentStats(items);
    if (!rows.length) return '';
    return '<div class="rc-panel" style="margin-top:0;"><div class="rc-panel-title"><i data-lucide="users" style="width:18px;height:18px;color:var(--acc);"></i>RC Agents</div>' +
        '<div class="rc-agent-grid">' +
        rows.map(function (st) {
            var avgSla = st.slaN ? Math.round(st.slaSum / st.slaN) : 0;
            var rate = st.assigned ? Math.round((st.completed / st.assigned) * 100) : 0;
            var sel = (rcDashFilters.agent.indexOf(st.name) >= 0 || rcSelectedAgent === st.name) ? ' selected' : '';
            return '<div class="rc-agent-tile' + sel + '" onclick="rcSelectAgentTile(\'' + rcEsc(st.name).replace(/'/g, "\\'") + '\')">' +
                '<div class="rc-agent-tile-head"><div class="rc-agent-avatar">' + rcEsc(rcInitials(st.name)) + '</div>' +
                '<div><div style="font-weight:800;font-size:.88rem;color:var(--t1);">' + rcEsc(st.name) + '</div></div></div>' +
                '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.4rem;font-size:.72rem;">' +
                    '<div><span style="color:var(--t3);">Assigned</span><div style="font-weight:800;color:var(--acc);">' + st.assigned + '</div></div>' +
                    '<div><span style="color:var(--t3);">In Progress</span><div style="font-weight:800;color:' + rcStatusColor(RC_STATUS.INPROGRESS) + ';">' + st.inprogress + '</div></div>' +
                    '<div><span style="color:var(--t3);">Resolved</span><div style="font-weight:800;color:' + rcStatusColor(RC_STATUS.RESOLVED) + ';">' + st.completed + '</div></div>' +
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
function rcMapRow(it) {
    if (!it) return null;
    function v(x) { return (x === null || x === undefined || x === '') ? '—' : String(x); }
    function vBlank(x) { return (x === null || x === undefined || x === '') ? '' : String(x); }
    return {
        id: it.ID,
        site: v(it.Site),
        callDate: v(it.Call_Date),
        callDateTime: v(it.Call_DateTime),
        msisdn: v(it.MSISDN),
        callCount: rcMsisdnCallCount(it.MSISDN),
        isRepeat: rcIsRepeatMsisdn(it.MSISDN),
        skillGroup: v(it.skill_group_enterprisename),
        language: v(it.Language),
        customerType: v(it.Customer_Type),
        agentCti: v(it.Agent_Name),
        agentName: rcAgentDisplayName(it.Agent_Name),
        talkTime: v(it.Talk_Time),
        holdTime: v(it.Hold_Time),
        wrapUpTime: v(it.WrapUp_Time),
        customerValue: v(it.Customer_Value),
        handlingTime: v(it.Handling_Time),
        market: v(it.Market_For_Weekly_Score_Card),
        siebelId: v(it.SIEBEL_ID),
        kbId: v(it.KB_ID),
        segmentValue: v(it.Segment_Value),
        lob: v(it.LOB),
        accountNumber: vBlank(it.Account_Number),
        callDriver: vBlank(it.Call_Driver),
        issueInDetails: vBlank(rcStripHtml(it.Issue_In_Details)),
        callBackStatus: vBlank(it.Call_Back_Status),
        pendingWith: vBlank(it.Pending_With),
        resolutionStatus: vBlank(it.Resolution_Status),
        rcStatus: rcRowWorkflowStatus(it),
        assignedTo: v(it.AssignedToName),
        uploadDate: it.UploadDate || null,
        assignmentDate: it.AssignmentDate || null,
        reassignDate: it.ReassignDate || null,
        completedDate: it.CompletedDate || null,
        slaDays: rcSlaDays(it),
        agingDays: rcAging(it)
    };
}

function RcSetColumnFilter() {}
RcSetColumnFilter.prototype.init = function (params) {
    this.params = params;
    this.selected = new Set();
    this.gui = document.createElement('div');
    this.gui.className = 'rc-ag-set-filter';
    this._buildGui();
};
RcSetColumnFilter.prototype._cellValue = function (data) {
    var v = data[this.params.colDef.field];
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
};
RcSetColumnFilter.prototype._allValues = function () {
    var values = new Set(), self = this;
    this.params.api.forEachNode(function (node) {
        if (node.data) values.add(self._cellValue(node.data));
    });
    return Array.from(values).sort(function (a, b) { return a.localeCompare(b); });
};
RcSetColumnFilter.prototype._buildGui = function () {
    var self = this, all = this._allValues();
    this.gui.innerHTML = '';
    var search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search...';
    search.className = 'rc-ag-set-search';
    this.gui.appendChild(search);
    var list = document.createElement('div');
    list.className = 'rc-ag-set-list';
    this.gui.appendChild(list);
    var render = function (term) {
        list.innerHTML = '';
        all.filter(function (v) { return !term || v.toLowerCase().indexOf(term.toLowerCase()) >= 0; }).forEach(function (v) {
            var row = document.createElement('label');
            row.className = 'rc-ag-set-option';
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
    actions.className = 'rc-ag-set-actions';
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
RcSetColumnFilter.prototype.getGui = function () { return this.gui; };
RcSetColumnFilter.prototype.isFilterActive = function () { return this.selected.size > 0; };
RcSetColumnFilter.prototype.doesFilterPass = function (params) {
    if (!this.selected.size) return true;
    return this.selected.has(this._cellValue(params.data));
};
RcSetColumnFilter.prototype.getModel = function () { return this.selected.size ? { values: Array.from(this.selected) } : null; };
RcSetColumnFilter.prototype.setModel = function (model) {
    this.selected = new Set(model && model.values ? model.values : []);
    this._buildGui();
};
RcSetColumnFilter.prototype.destroy = function () {};

var RC_MS_FILTER_FIELDS = new Set([
    'msisdn', 'callCount', 'site', 'callDate', 'callDateTime', 'skillGroup', 'language', 'customerType', 'agentName', 'agentCti',
    'customerValue', 'market', 'siebelId', 'kbId', 'segmentValue', 'lob', 'rcStatus', 'assignedTo'
]);
var RC_DATE_FILTER_FIELDS = new Set([
    'uploadDate', 'assignmentDate', 'reassignDate', 'completedDate'
]);

function rcEnhanceColDef(col) {
    if (RC_MS_FILTER_FIELDS.has(col.field)) col.filter = RcSetColumnFilter;
    else if (col.type === 'numericColumn') col.filter = 'agNumberColumnFilter';
    else if (RC_DATE_FILTER_FIELDS.has(col.field)) col.filter = 'agDateColumnFilter';
    return col;
}

function rcStatusBadge(val) {
    var map = {};
    map[RC_STATUS.PENDING] = 'rc-badge-pending';
    map[RC_STATUS.INPROGRESS] = 'rc-badge-inprogress';
    map[RC_STATUS.RESOLVED] = 'rc-badge-completed';
    var cls = map[val] || 'rc-badge-pending';
    return '<span class="rc-status-badge ' + cls + '">' + rcEsc(val || '—') + '</span>';
}

function rcFmtGridDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
}

function rcAgentSelectEl(selected) {
    var sel = document.createElement('select');
    sel.className = 'fb-select';
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Select…';
    sel.appendChild(empty);
    rcAllAgents.forEach(function (a) {
        var opt = document.createElement('option');
        opt.value = a.name;
        opt.textContent = a.name;
        if (selected === a.name) opt.selected = true;
        sel.appendChild(opt);
    });
    return sel;
}

var rcEditModalId = null;

function rcEnsureEditModal() {
    if (document.getElementById('rcEditModal')) return;
    var overlay = document.createElement('div');
    overlay.id = 'rcEditModal';
    overlay.className = 'rc-modal-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML =
        '<div class="rc-modal-box" role="dialog" aria-modal="true" aria-labelledby="rcEditModalTitle">' +
            '<div class="rc-modal-head">' +
                '<h3 id="rcEditModalTitle">Edit Record</h3>' +
                '<button type="button" class="rc-modal-close" onclick="rcCloseEditModal()" aria-label="Close">&times;</button>' +
            '</div>' +
            '<div class="rc-modal-body" id="rcEditForm"></div>' +
            '<div class="rc-modal-foot">' +
                '<button type="button" class="rc-complete-btn" onclick="rcCloseEditModal()">Cancel</button>' +
                '<button type="button" class="rc-action-btn" id="rcEditSaveBtn" onclick="rcSaveEditModal()">Save</button>' +
            '</div>' +
        '</div>';
    (typeof smPopupParent === 'function' ? smPopupParent() : document.body).appendChild(overlay);
    if (typeof smBoostPopupZ === 'function') smBoostPopupZ(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) rcCloseEditModal(); });
}

function rcIsCallbackReachable(v) {
    var s = String(v || '').trim().toLowerCase();
    if (!s) return false;
    if (/not\s*reach|unreach/i.test(s)) return false;
    return /reach/i.test(s);
}

function rcIsCallbackNotReachable(v) {
    return /not\s*reach/i.test(String(v || ''));
}

function rcIsIssueResolved(resVal) {
    var raw = String(resVal || '').trim();
    if (!raw) return false;
    var s = raw.toLowerCase();
    if (/not/.test(s) && /resolved/.test(s)) return false;
    return s === 'issue resolved';
}

function rcIsIssueNotResolved(resVal) {
    var raw = String(resVal || '').trim();
    if (!raw) return false;
    return /issue\s*not\s*resolved/i.test(raw);
}

function rcResolutionChoicesReachable(currentVal) {
    var all = (rcSpChoices.Resolution_Status || []).slice();
    var opts = all.filter(function (o) { return /issue\s*resolved|issue\s*not\s*resolved/i.test(String(o)); });
    if (currentVal && opts.indexOf(currentVal) < 0) opts.unshift(currentVal);
    return opts;
}

function rcShouldShowResolution(callbackVal) {
    return rcIsCallbackReachable(callbackVal);
}

function rcShouldShowLobDriver(callbackVal, resolutionVal) {
    return rcIsCallbackReachable(callbackVal) && rcIsIssueResolved(resolutionVal);
}

function rcShouldShowPendingWith(callbackVal, resolutionVal) {
    return rcIsCallbackReachable(callbackVal) && rcIsIssueNotResolved(resolutionVal);
}

function rcShouldShowIssueDetails(callbackVal) {
    return !!String(callbackVal || '').trim();
}

function rcSetEditWrapDisplay(wrapId, show) {
    var el = document.getElementById(wrapId);
    if (el) el.style.display = show ? 'block' : 'none';
}

var rcPerfCache = { itemsRef: null, records: {}, status: {}, treeData: null };

function rcClearPerfCache() {
    rcPerfCache = { itemsRef: null, records: {}, status: {}, treeData: null };
}

function rcBuildMsisdnPoolMap(items) {
    var map = {};
    rcRepeatCallerItems(items).forEach(function (it) {
        var m = rcMsisdnKey(it);
        if (!m) return;
        if (!map[m]) map[m] = [];
        map[m].push(it);
    });
    return map;
}

function rcWorkflowRecordFromPool(pool) {
    if (!pool || !pool.length) return null;
    var withCb = pool.filter(function (it) { return String(it.Call_Back_Status || '').trim(); });
    if (withCb.length) return rcPickLatestItem(withCb);
    return rcPickRepresentativeCallerRow(pool);
}

function rcWarmPerfCache(items) {
    if (rcPerfCache.itemsRef === items && rcPerfCache.treeData) return;
    rcPerfCache = { itemsRef: items, records: {}, status: {}, treeData: null };
    var poolMap = rcBuildMsisdnPoolMap(items);
    Object.keys(poolMap).forEach(function (m) {
        rcPerfCache.records[m] = rcWorkflowRecordFromPool(poolMap[m]);
    });
    rcPerfCache.treeData = rcBuildContactTreeDataFromMaps(poolMap, rcPerfCache.records);
}

function rcGetCallerWorkflowRecord(msisdn, items) {
    var m = rcMsisdnKey(msisdn);
    if (!m) return null;
    if (rcPerfCache.records[m]) return rcPerfCache.records[m];
    var pool = rcRepeatCallerItems(items).filter(function (it) { return rcMsisdnKey(it) === m; });
    if (!pool.length) return null;
    var rec = rcWorkflowRecordFromPool(pool);
    rcPerfCache.records[m] = rec;
    return rec;
}

function rcRowWorkflowStatus(it) {
    if (!it) return RC_STATUS.PENDING;
    var st = rcDisplayStatus(it, rcAllItems);
    if (rcIsAssigned(it) && st === RC_STATUS.PENDING) return RC_STATUS.INPROGRESS;
    return st || '—';
}

function rcStatusForItem(it, items) {
    items = items || rcAllItems;
    if (!it) return RC_STATUS.PENDING;
    if (items === rcAllItems && rcIsAssigned(it) && rcDisplayStatus(it, rcAllItems) === RC_STATUS.PENDING) {
        return RC_STATUS.INPROGRESS;
    }
    if (!rcIsRepeatMsisdn(it.MSISDN)) return rcDisplayStatus(it, items);
    var m = rcMsisdnKey(it.MSISDN);
    if (rcPerfCache.itemsRef === items && rcPerfCache.status[m]) return rcPerfCache.status[m];
    var st = rcWorkflowStatusForCaller(m, items);
    if (rcPerfCache.itemsRef === items) rcPerfCache.status[m] = st;
    return st;
}

function rcCallerHasWorkflowDetails(msisdn, items) {
    var rec = rcGetCallerWorkflowRecord(msisdn, items);
    return !!(rec && String(rec.Call_Back_Status || '').trim());
}

function rcPct(part, whole, digits) {
    digits = digits == null ? 1 : digits;
    if (!whole) return '0';
    return (part / whole * 100).toFixed(digits);
}

function rcBuildContactTreeDataFromMaps(poolMap, recordMap) {
    var data = {
        total: 0,
        awaitingCallback: 0,
        notReachable: 0,
        reachable: 0,
        resolved: 0,
        notResolved: 0,
        reachableOpen: 0,
        drivers: {},
        pendingWith: {},
        unresolvedByDept: {}
    };
    Object.keys(poolMap).forEach(function (m) {
        if (!rcIsRepeatMsisdn(m)) return;
        data.total++;
        var rec = recordMap[m] || poolMap[m][0];
        var cb = String(rec.Call_Back_Status || '').trim();
        if (!cb) { data.awaitingCallback++; return; }
        if (rcIsCallbackNotReachable(cb)) { data.notReachable++; return; }
        if (rcIsCallbackReachable(cb)) {
            data.reachable++;
            var res = String(rec.Resolution_Status || '').trim();
            if (rcIsIssueResolved(res)) {
                data.resolved++;
                var driver = String(rec.Call_Driver || '').trim() || 'Not set';
                data.drivers[driver] = (data.drivers[driver] || 0) + 1;
            } else if (rcIsIssueNotResolved(res)) {
                data.notResolved++;
                var pw = String(rec.Pending_With || '').trim() || 'Not set';
                data.pendingWith[pw] = (data.pendingWith[pw] || 0) + 1;
                data.unresolvedByDept[pw] = (data.unresolvedByDept[pw] || 0) + 1;
            } else {
                data.reachableOpen++;
            }
        }
    });
    return data;
}

function rcBuildContactTreeData(items) {
    rcWarmPerfCache(items);
    return rcPerfCache.treeData || rcBuildContactTreeDataFromMaps({}, {});
}

function rcCallbackKeyFindings(d) {
    var findings = [];
    if (d.total) {
        findings.push(Math.round(parseFloat(rcPct(d.notReachable, d.total))) + '% of customers were not reachable.');
    }
    if (d.reachable) {
        findings.push(Math.round(parseFloat(rcPct(d.resolved, d.reachable))) + '% of reached customers were calling for TT updates or had already been resolved.');
    }
    var topDepts = rcTopNPairs(d.unresolvedByDept, 2);
    if (topDepts.length >= 2) {
        findings.push(topDepts[0].label + ' and ' + topDepts[1].label + ' are the largest unresolved contributors.');
    } else if (topDepts.length === 1) {
        findings.push(topDepts[0].label + ' is the largest unresolved contributor.');
    }
    if (!findings.length) findings.push('No repeat caller data in the current filter view.');
    return findings;
}

function rcTopNPairs(map, n) {
    n = n || 5;
    var keys = Object.keys(map || {}).sort(function (a, b) {
        return (map[b] - map[a]) || a.localeCompare(b);
    });
    return keys.slice(0, n).map(function (k) { return { label: k, count: map[k] }; });
}

function rcCbrBrace(size) {
    return '<div class="rc-cbr-brace rc-cbr-brace-' + (size || 'md') + '" aria-hidden="true">' +
        '<svg viewBox="0 0 22 100" preserveAspectRatio="none">' +
            '<path d="M16 4 C8 4 7 12 7 22 L7 42 C7 47 5 49 2 50 C5 51 7 53 7 58 L7 78 C7 88 8 96 16 96" fill="none" stroke="#9aa3b0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg></div>';
}

function rcCbrTile(id, cls, label, count, desc, filterNode, filterValue, small) {
    filterNode = filterNode || id;
    filterValue = filterValue != null ? filterValue : '';
    var active = (rcTreeFilter.node === filterNode && (rcTreeFilter.value || '') === filterValue) ? ' rc-cbr-active' : '';
    var sm = small ? ' rc-cbr-sm' : '';
    return '<div class="rc-cbr-tile ' + cls + sm + active + '" data-rc-node="' + rcEsc(id) + '" data-rc-filter-node="' + rcEsc(filterNode) + '" data-rc-filter-value="' + rcEsc(filterValue) + '" role="button" title="Click to filter the grid · click again to clear">' +
        '<div class="rc-cbr-accent"></div>' +
        '<div class="rc-cbr-count">' + rcEsc(String(count)) + '</div>' +
        '<div class="rc-cbr-label">' + rcEsc(label) + '</div>' +
        (desc ? '<div class="rc-cbr-desc">' + rcEsc(desc) + '</div>' : '') +
        '</div>';
}

function rcContactTreeHTML(items) {
    var d = rcBuildContactTreeData(items);
    var total = d.total || 0;
    var findings = rcCallbackKeyFindings(d);
    var nresNote = d.reachable ? rcPct(d.notResolved, d.reachable) + '% of reachable customers.' : '';
    return '<div class="rc-cbr" id="rcTreeBoard">' +
        '<div class="rc-cbr-head">' +
            '<h3>Repeated Calls - Callback Report</h3>' +
            '<p>Customers who contacted us more than twice</p>' +
        '</div>' +
        '<div class="rc-cbr-flow">' +
            rcCbrTile('root', 'rc-cbr-total', 'Repeat callers', total, '100% Contacted us more than twice') +
            '<div class="rc-cbr-right">' +
                rcCbrTile('nr', 'rc-cbr-nr', 'Not Reachable', d.notReachable, rcPct(d.notReachable, total) + '% of repeat customers were not reachable.') +
                '<div class="rc-cbr-reach-row">' +
                    rcCbrTile('reach', 'rc-cbr-reach', 'Reachable', d.reachable, rcPct(d.reachable, total) + '% of repeat customers were reachable.') +
                    rcCbrBrace('md') +
                    '<div class="rc-cbr-stack">' +
                        rcCbrTile('nres', 'rc-cbr-nres', 'Not Resolved', d.notResolved, nresNote, 'nres', '', true) +
                        rcCbrTile('resolved', 'rc-cbr-res', 'Resolved', d.resolved, rcPct(d.resolved, d.reachable) + '% Cases Resolved', 'resolved', '', true) +
                    '</div>' +
                    rcCbrBrace('sm') +
                    '<div class="rc-cbr-chart">' +
                        '<div class="rc-cbr-chart-title">Unresolved Cases Breakdown</div>' +
                        '<div class="rc-cbr-chart-body"><canvas id="rcChartCallbackBreakdown"></canvas></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        (d.awaitingCallback ? '<div class="rc-cbr-await">' + d.awaitingCallback + ' repeat caller(s) awaiting callback capture · ' +
            '<span class="rc-cbr-link" data-rc-node="awaiting" data-rc-filter-node="awaiting" role="button">Show in grid</span></div>' : '') +
        (d.reachableOpen ? '<div class="rc-cbr-await">' + d.reachableOpen + ' reachable caller(s) awaiting resolution status · ' +
            '<span class="rc-cbr-link" data-rc-node="reach" data-rc-filter-node="reach" role="button">Show in grid</span></div>' : '') +
        '<div class="rc-cbr-findings">' +
            '<div class="rc-cbr-findings-label">Key Findings</div>' +
            '<ol class="rc-cbr-findings-list">' + findings.map(function (f) { return '<li>' + rcEsc(f) + '</li>'; }).join('') + '</ol>' +
        '</div>' +
    '</div>';
}

function rcBuildCallbackBreakdownChart(items, treeData) {
    if (typeof Chart === 'undefined') return;
    var canvas = document.getElementById('rcChartCallbackBreakdown');
    if (!canvas) return;
    var d = treeData || rcBuildContactTreeData(items);
    var pairs = rcTopNPairs(d.unresolvedByDept, 6);
    if (rcCharts.callbackBreakdown) {
        try { rcCharts.callbackBreakdown.destroy(); } catch (e) {}
        rcCharts.callbackBreakdown = null;
    }
    var totalNres = d.notResolved || 0;
    rcCharts.callbackBreakdown = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: pairs.length ? pairs.map(function (p) { return p.label; }) : ['No unresolved cases'],
            datasets: [{
                data: pairs.length ? pairs.map(function (p) { return p.count; }) : [0],
                backgroundColor: '#3b7cc4',
                borderRadius: 0,
                maxBarThickness: 18,
                barPercentage: 0.7,
                categoryPercentage: 0.78
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 72 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            var n = ctx.raw || 0;
                            return n + ' (' + rcPct(n, totalNres || 1) + '%)';
                        }
                    }
                },
                rcBarValueLabels: { total: totalNres }
            },
            scales: {
                x: { display: false, beginAtZero: true },
                y: { grid: { display: false }, ticks: { font: { family: '"Segoe UI", Calibri, sans-serif', size: 12, weight: '400' }, color: '#3d4754' } }
            }
        },
        plugins: [{
            id: 'rcBarValueLabels',
            afterDatasetsDraw: function (chart) {
                var ctx = chart.ctx;
                var tot = (chart.options.plugins.rcBarValueLabels && chart.options.plugins.rcBarValueLabels.total) || 1;
                var meta = chart.getDatasetMeta(0);
                meta.data.forEach(function (bar, idx) {
                    var val = chart.data.datasets[0].data[idx] || 0;
                    ctx.save();
                    ctx.fillStyle = '#3d4754';
                    ctx.font = '12px "Segoe UI", Calibri, sans-serif';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(val + ' (' + rcPct(val, tot) + '%)', bar.x + 8, bar.y);
                    ctx.restore();
                });
            }
        }]
    });
}

function rcTreeAnchor(board, el, side) {
    var br = board.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var x = r.left - br.left + board.scrollLeft;
    var y = r.top - br.top + board.scrollTop;
    if (side === 'right') return { x: x + r.width, y: y + r.height / 2 };
    return { x: x, y: y + r.height / 2 };
}

window.rcPaintContactTree = function () {
    /* Braces are CSS-only — no SVG repaint (faster). */
    return;
    var board = document.getElementById('rcTreeBoard');
    var svg = document.getElementById('rcTreeSvg');
    if (!board || !svg) return;
    var w = Math.max(board.scrollWidth, board.clientWidth, 1);
    var h = Math.max(board.scrollHeight, board.clientHeight, 1);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var acc = rcCssVar('--acc') || '#a855f7';
    var acc2 = rcCssVar('--acc2') || '#c724b1';
    var slate = '#64748b';
    var amber = '#f59e0b';
    svg.innerHTML = '<defs>' +
        '<marker id="rcArrowHead" markerWidth="14" markerHeight="14" refX="12" refY="5" orient="auto"><polygon points="0 0, 14 5, 0 10" fill="' + acc + '"></polygon></marker>' +
        '<marker id="rcArrowHead2" markerWidth="14" markerHeight="14" refX="12" refY="5" orient="auto"><polygon points="0 0, 14 5, 0 10" fill="' + acc2 + '"></polygon></marker>' +
        '<marker id="rcArrowHeadSlate" markerWidth="14" markerHeight="14" refX="12" refY="5" orient="auto"><polygon points="0 0, 14 5, 0 10" fill="' + slate + '"></polygon></marker>' +
        '<marker id="rcArrowHeadAmber" markerWidth="14" markerHeight="14" refX="12" refY="5" orient="auto"><polygon points="0 0, 14 5, 0 10" fill="' + amber + '"></polygon></marker>' +
        '</defs>';

    function node(id) { return board.querySelector('[data-rc-node="' + id + '"]'); }
    function markerFor(color) {
        if (color === acc2) return 'url(#rcArrowHead2)';
        if (color === slate) return 'url(#rcArrowHeadSlate)';
        if (color === amber) return 'url(#rcArrowHeadAmber)';
        return 'url(#rcArrowHead)';
    }
    function connect(fromId, toId, color, strokeW) {
        var a = node(fromId), b = node(toId);
        if (!a || !b) return;
        color = color || acc;
        strokeW = strokeW || 4;
        var p1 = rcTreeAnchor(board, a, 'right');
        var p2 = rcTreeAnchor(board, b, 'left');
        var mx = p1.x + (p2.x - p1.x) * 0.55;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M ' + p1.x + ' ' + p1.y + ' C ' + mx + ' ' + p1.y + ', ' + mx + ' ' + p2.y + ', ' + p2.x + ' ' + p2.y);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', String(strokeW));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('marker-end', markerFor(color));
        svg.appendChild(path);
    }

    connect('root', 'nr', slate, 4.5);
    connect('root', 'reach', acc, 4.5);
    connect('reach', 'nres', slate, 4);
    connect('reach', 'resolved', acc2, 4);
    var chartWrap = board.querySelector('.rc-cbr-chart-wrap');
    if (chartWrap && node('nres')) {
        var br = board.getBoundingClientRect();
        var a = rcTreeAnchor(board, node('nres'), 'right');
        var cr = chartWrap.getBoundingClientRect();
        var p2 = { x: cr.left - br.left + board.scrollLeft, y: cr.top - br.top + board.scrollTop + cr.height / 2 };
        var mx = (a.x + p2.x) / 2;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M ' + a.x + ' ' + a.y + ' C ' + mx + ' ' + a.y + ', ' + mx + ' ' + p2.y + ', ' + p2.x + ' ' + p2.y);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', slate);
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('marker-end', 'url(#rcArrowHeadSlate)');
        svg.appendChild(path);
    }
};

function rcSchedulePaintContactTree() {
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { window.rcPaintContactTree(); });
    });
}

if (!window._rcTreeResizeBound) {
    window._rcTreeResizeBound = true;
    window.addEventListener('resize', function () {
        clearTimeout(window._rcTreeResizeT);
        window._rcTreeResizeT = setTimeout(function () { window.rcPaintContactTree(); }, 120);
    });
}

function rcBuildEditFieldHTML(field, value, extraAttrs) {
    extraAttrs = extraAttrs || {};
    var val = (value === '—' || value == null) ? '' : String(value).trim();
    var id = 'rcEdit_' + field.key;
    var req = extraAttrs.optional ? '' : ' <span style="color:#ef4444;">*</span>';
    var reqAttr = extraAttrs.optional ? '' : ' required';
    var wrapId = extraAttrs.wrapId ? (' id="' + extraAttrs.wrapId + '"') : '';
    var wrapStyle = extraAttrs.hidden ? ' style="display:none;"' : '';
    if (field.type === 'multiline') {
        var plain = rcStripHtml(val);
        return '<div class="rc-edit-field"' + wrapId + wrapStyle + '><label for="' + id + '">' + rcEsc(field.label) + req + '</label>' +
            '<textarea id="' + id + '" rows="4"' + reqAttr + '>' + rcEsc(plain) + '</textarea></div>';
    }
    if (field.type === 'choice') {
        var opts = extraAttrs.options || rcEditChoiceOptions(field, val);
        var onchange = extraAttrs.onchange ? (' onchange="' + extraAttrs.onchange + '"') : '';
        var html = '<div class="rc-edit-field"' + wrapId + wrapStyle + '><label for="' + id + '">' + rcEsc(field.label) + req + '</label>' +
            '<select id="' + id + '"' + reqAttr + onchange + '><option value="">— Select —</option>';
        opts.forEach(function (o) {
            html += '<option value="' + rcEsc(o) + '"' + (val && String(o) === String(val) ? ' selected' : '') + '>' + rcEsc(o) + '</option>';
        });
        html += '</select></div>';
        return html;
    }
    return '<div class="rc-edit-field"' + wrapId + wrapStyle + '><label for="' + id + '">' + rcEsc(field.label) + req + '</label>' +
        '<input type="text" id="' + id + '" value="' + rcEsc(val) + '"' + reqAttr + '></div>';
}

function rcRenderEditForm(item) {
    var form = document.getElementById('rcEditForm');
    if (!form || !item) return;
    var callbackVal = rcWorkflowEditValue(item, { key: 'Call_Back_Status' });
    var resolutionVal = rcWorkflowEditValue(item, { key: 'Resolution_Status' });
    var html = '';
    html += rcBuildEditFieldHTML(
        RC_WORKFLOW_FIELDS.find(function (f) { return f.key === 'Account_Number'; }),
        rcWorkflowEditValue(item, { key: 'Account_Number' })
    );
    html += rcBuildEditFieldHTML(
        RC_WORKFLOW_FIELDS.find(function (f) { return f.key === 'Call_Back_Status'; }),
        callbackVal,
        { onchange: 'rcEditCallbackChanged()' }
    );
    html += rcBuildEditFieldHTML(
        RC_WORKFLOW_FIELDS.find(function (f) { return f.key === 'Resolution_Status'; }),
        resolutionVal,
        {
            wrapId: 'rcEditResolutionWrap',
            hidden: !rcShouldShowResolution(callbackVal),
            options: rcResolutionChoicesReachable(resolutionVal),
            onchange: 'rcEditResolutionChanged()'
        }
    );
    html += rcBuildEditFieldHTML(
        RC_WORKFLOW_FIELDS.find(function (f) { return f.key === 'LOB'; }),
        rcWorkflowEditValue(item, { key: 'LOB' }),
        { wrapId: 'rcEditLobWrap', hidden: !rcShouldShowLobDriver(callbackVal, resolutionVal) }
    );
    html += rcBuildEditFieldHTML(
        RC_WORKFLOW_FIELDS.find(function (f) { return f.key === 'Call_Driver'; }),
        rcWorkflowEditValue(item, { key: 'Call_Driver' }),
        { wrapId: 'rcEditDriverWrap', hidden: !rcShouldShowLobDriver(callbackVal, resolutionVal) }
    );
    html += rcBuildEditFieldHTML(
        RC_WORKFLOW_FIELDS.find(function (f) { return f.key === 'Pending_With'; }),
        rcWorkflowEditValue(item, { key: 'Pending_With' }),
        { wrapId: 'rcEditPendingWrap', hidden: !rcShouldShowPendingWith(callbackVal, resolutionVal) }
    );
    html += rcBuildEditFieldHTML(
        RC_WORKFLOW_FIELDS.find(function (f) { return f.key === 'Issue_In_Details'; }),
        rcWorkflowEditValue(item, { key: 'Issue_In_Details' }),
        { wrapId: 'rcEditDetailsWrap', hidden: !rcShouldShowIssueDetails(callbackVal) }
    );
    form.innerHTML = html;
    rcSyncEditFormFields();
}

window.rcSyncEditFormFields = function () {
    var cb = document.getElementById('rcEdit_Call_Back_Status');
    var callbackVal = cb ? cb.value : '';
    var resSel = document.getElementById('rcEdit_Resolution_Status');
    var resolutionVal = resSel ? resSel.value : '';
    var reachable = rcIsCallbackReachable(callbackVal);
    var notReach = rcIsCallbackNotReachable(callbackVal);

    rcSetEditWrapDisplay('rcEditResolutionWrap', reachable);
    rcSetEditWrapDisplay('rcEditLobWrap', rcShouldShowLobDriver(callbackVal, resolutionVal));
    rcSetEditWrapDisplay('rcEditDriverWrap', rcShouldShowLobDriver(callbackVal, resolutionVal));
    rcSetEditWrapDisplay('rcEditPendingWrap', rcShouldShowPendingWith(callbackVal, resolutionVal));
    rcSetEditWrapDisplay('rcEditDetailsWrap', rcShouldShowIssueDetails(callbackVal));

    if (resSel && reachable) {
        var cur = resSel.value;
        var opts = rcResolutionChoicesReachable(cur);
        resSel.innerHTML = '<option value="">— Select —</option>' + opts.map(function (o) {
            return '<option value="' + rcEsc(o) + '"' + (cur === o ? ' selected' : '') + '>' + rcEsc(o) + '</option>';
        }).join('');
    }

    ['rcEdit_Resolution_Status', 'rcEdit_LOB', 'rcEdit_Call_Driver', 'rcEdit_Pending_With', 'rcEdit_Issue_In_Details'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var wrap = el.closest('.rc-edit-field');
        el.required = !!(wrap && wrap.style.display !== 'none');
    });

    if (notReach) {
        ['rcEdit_Resolution_Status', 'rcEdit_LOB', 'rcEdit_Call_Driver', 'rcEdit_Pending_With'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
};

window.rcEditCallbackChanged = function () {
    rcSyncEditFormFields();
};

window.rcEditResolutionChanged = function () {
    rcSyncEditFormFields();
};

function rcCollectEditFields(callbackVal, resolutionVal) {
    var fields = {}, missing = [];
    function read(key, label, required) {
        var el = document.getElementById('rcEdit_' + key);
        if (!el) return;
        var wrap = el.closest('.rc-edit-field');
        if (wrap && wrap.style.display === 'none') return;
        var v = String(el.value || '').trim();
        if (required && !v) missing.push(label);
        else if (v) fields[key] = v;
    }

    read('Account_Number', 'Account Number', true);
    read('Call_Back_Status', 'Call Back Status', true);

    if (rcIsCallbackNotReachable(callbackVal)) {
        read('Issue_In_Details', 'Issue In Details', true);
        fields.Resolution_Status = '';
        fields.Pending_With = '';
        fields.LOB = '';
        fields.Call_Driver = '';
    } else if (rcIsCallbackReachable(callbackVal)) {
        read('Resolution_Status', 'Resolution Status', true);
        if (rcIsIssueResolved(resolutionVal)) {
            read('LOB', 'LOB', true);
            read('Call_Driver', 'Call Driver', true);
            read('Issue_In_Details', 'Issue In Details', true);
            fields.Pending_With = '';
        } else if (rcIsIssueNotResolved(resolutionVal)) {
            read('Pending_With', 'Pending With', true);
            read('Issue_In_Details', 'Issue In Details', true);
            fields.LOB = '';
            fields.Call_Driver = '';
        } else if (!resolutionVal) {
            missing.push('Resolution Status');
        }
    }

    return { fields: fields, missing: missing };
}

var RC_WF_ROW_MAP = {
    Account_Number: 'accountNumber',
    Call_Driver: 'callDriver',
    Issue_In_Details: 'issueInDetails',
    LOB: 'lob',
    Call_Back_Status: 'callBackStatus',
    Pending_With: 'pendingWith',
    Resolution_Status: 'resolutionStatus'
};

window.rcOpenEditModal = async function (id) {
    var item = rcAllItems.find(function (it) { return it.ID === id; });
    if (!item) { rcToast('Record not found', 'warn'); return; }
    if (!rcSpChoicesLoaded) {
        try { await rcFetchSpChoices(); } catch (e) {
            rcToast('Could not load SharePoint choices', 'warn');
        }
    }
    rcEnsureEditModal();
    rcEditModalId = id;
    rcRenderEditForm(item);
    document.getElementById('rcEditModalTitle').textContent = 'Edit · ' + (item.MSISDN || ('ID ' + id));
    document.getElementById('rcEditModal').style.display = 'flex';
};

window.rcCloseEditModal = function () {
    rcEditModalId = null;
    var m = document.getElementById('rcEditModal');
    if (m) m.style.display = 'none';
};

window.rcSaveEditModal = async function () {
    if (!rcEditModalId) return;
    var item = rcAllItems.find(function (it) { return it.ID === rcEditModalId; });
    if (!item) { rcToast('Record not found', 'warn'); return; }
    var btn = document.getElementById('rcEditSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var callbackVal = (document.getElementById('rcEdit_Call_Back_Status') || {}).value || '';
    var resolutionVal = (document.getElementById('rcEdit_Resolution_Status') || {}).value || '';
    var collected = rcCollectEditFields(callbackVal, resolutionVal);
    var fields = collected.fields;
    var missing = collected.missing;
    if (missing.length) {
        rcToast('Required fields missing: ' + missing.join(', '), 'warn');
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        return;
    }
    var digest;
    try { digest = await rcGetDigest(); } catch (e) {
        rcToast('Digest error', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
        return;
    }
    rcShowBusy('Saving…', 'Updating record');
    try {
        var updateIds = rcAllItems.filter(function (it) {
            return rcMsisdnKey(it) === rcMsisdnKey(item.MSISDN) && rcIsRepeatMsisdn(it.MSISDN);
        }).map(function (it) { return it.ID; });
        if (!updateIds.length) updateIds = [rcEditModalId];
        var activeIds = rcInProgressSiblingIds(item.MSISDN);
        for (var u = 0; u < updateIds.length; u++) {
            await rcUpdateItem(updateIds[u], fields, digest);
        }
        if (rcIsCallbackReachable(callbackVal) && rcIsIssueResolved(resolutionVal) && activeIds.length) {
            var now = new Date().toISOString();
            for (var i = 0; i < activeIds.length; i++) {
                await rcUpdateItem(activeIds[i], rcSpFields({ RCStatus: RC_STATUS.RESOLVED, CompletedDate: now }), digest);
            }
        }
        rcToast('Record updated', 'success');
        rcCloseEditModal();
        await rcFetchItems(true);
        rcRenderTabBody();
    } catch (e) { rcToast('Could not save record', 'error'); }
    finally {
        rcHideBusy();
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
};

function rcEditActionRenderer(params) {
    if (!params.data) return document.createTextNode('');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rc-action-btn';
    btn.textContent = 'Edit';
    btn.onclick = function () { rcOpenEditModal(params.data.id); };
    return btn;
}

function rcAgentQueueActionRenderer(params) {
    if (!params.data) return document.createTextNode('');
    var wrap = document.createElement('div');
    wrap.className = 'rc-grid-action';
    wrap.appendChild(rcEditActionRenderer(params));
    var resolve = rcResolveActionRenderer(params);
    if (resolve && resolve.nodeType) wrap.appendChild(resolve);
    return wrap;
}

function rcAssignActionRenderer(params) {
    if (!params.data) return null;
    var wrap = document.createElement('div');
    wrap.className = 'rc-grid-action';
    var suggested = params.data.agentCti ? rcAgentDisplayName(params.data.agentCti) : '';
    var sel = rcAgentSelectEl(suggested && suggested !== '—' ? suggested : '');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Assign';
    btn.onclick = function () {
        if (!sel.value) { rcToast('Pick an agent', 'warn'); return; }
        rcDoAssign([{ id: params.data.id, agentName: sel.value }], false);
    };
    wrap.appendChild(sel);
    wrap.appendChild(btn);
    return wrap;
}

function rcReassignActionRenderer(params) {
    if (!params.data) return null;
    var wrap = document.createElement('div');
    wrap.className = 'rc-grid-action';
    var sel = rcAgentSelectEl(params.data.assignedTo === '—' ? '' : params.data.assignedTo);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rc-action-btn';
    btn.textContent = 'Reassign';
    btn.onclick = function () {
        if (!sel.value) { rcToast('Pick an agent to reassign', 'warn'); return; }
        rcDoAssign([{ id: params.data.id, agentName: sel.value }], true);
    };
    wrap.appendChild(sel);
    wrap.appendChild(btn);
    return wrap;
}

function rcResolveActionRenderer(params) {
    if (!params.data || params.data.rcStatus !== RC_STATUS.INPROGRESS) return document.createTextNode('');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rc-complete-btn';
    btn.textContent = 'Resolve';
    btn.onclick = function () { rcResolve(params.data.id); };
    return btn;
}

function rcReopenActionRenderer(params) {
    if (!params.data || params.data.rcStatus !== RC_STATUS.RESOLVED) return document.createTextNode('');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rc-reopen-btn';
    btn.textContent = 'Reopen';
    btn.onclick = function () { rcReopen(params.data.id); };
    return btn;
}

function rcAdminRecordsActionRenderer(params) {
    if (!params.data) return document.createTextNode('');
    var wrap = document.createElement('div');
    wrap.className = 'rc-grid-action';
    wrap.appendChild(rcEditActionRenderer(params));
    if (params.data.rcStatus === RC_STATUS.INPROGRESS) {
        wrap.appendChild(rcResolveActionRenderer(params));
    } else if (params.data.rcStatus === RC_STATUS.RESOLVED) {
        wrap.appendChild(rcReopenActionRenderer(params));
    }
    if (rcCanDeleteAll()) {
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'rc-delete-btn';
        delBtn.textContent = 'Delete';
        delBtn.onclick = function () { rcDeleteRecord(params.data.id); };
        wrap.appendChild(delBtn);
    }
    return wrap;
}

function rcDataColumnDefs() {
    var fmtD = function (p) { return rcFmtGridDate(p.value); };
    return [
        { field: 'msisdn', headerName: 'MSISDN', width: 130, minWidth: 120, pinned: 'left', suppressSizeToFit: true },
        { field: 'callCount', headerName: 'Times Called', width: 110, minWidth: 100, type: 'numericColumn',
            cellRenderer: function (p) { return rcCallCountCell(p.value); },
            comparator: function (a, b) { return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0); } },
        { field: 'callDate', headerName: 'Date', width: 100, minWidth: 90 },
        { field: 'agentName', headerName: 'Call Agent', width: 140, minWidth: 120 },
        { field: 'agentCti', headerName: 'CTI', width: 90, minWidth: 80 },
        { field: 'talkTime', headerName: 'Talk Time', width: 100, minWidth: 90, type: 'numericColumn' },
        { field: 'holdTime', headerName: 'Hold Time', width: 100, minWidth: 90, type: 'numericColumn' },
        { field: 'wrapUpTime', headerName: 'Wrap Up', width: 90, minWidth: 80, type: 'numericColumn' },
        { field: 'customerValue', headerName: 'Customer Value', width: 120, minWidth: 100 },
        { field: 'handlingTime', headerName: 'Handling Time', width: 120, minWidth: 100, type: 'numericColumn' },
        { field: 'segmentValue', headerName: 'Segment', width: 90, minWidth: 80 },
        { field: 'lob', headerName: 'LOB', width: 140, minWidth: 110 },
        { field: 'accountNumber', headerName: 'Account #', width: 120, minWidth: 100 },
        { field: 'callDriver', headerName: 'Call Driver', width: 130, minWidth: 110 },
        { field: 'issueInDetails', headerName: 'Issue Details', width: 200, minWidth: 160, tooltipField: 'issueInDetails',
            cellRenderer: function (p) {
                var s = rcStripHtml(p.value);
                if (!s) return '';
                return s.length > 50 ? s.slice(0, 50) + '…' : s;
            } },
        { field: 'callBackStatus', headerName: 'Callback Status', width: 140, minWidth: 120 },
        { field: 'pendingWith', headerName: 'Pending With', width: 130, minWidth: 110 },
        { field: 'resolutionStatus', headerName: 'Resolution Status', width: 150, minWidth: 130 },
        { field: 'rcStatus', headerName: 'RC Status', width: 125, minWidth: 110, cellRenderer: function (p) { return rcStatusBadge(p.value); } },
        { field: 'assignedTo', headerName: 'Assigned To', width: 140, minWidth: 120 },
        { field: 'uploadDate', headerName: 'Upload Date', width: 120, minWidth: 110, valueFormatter: fmtD },
        { field: 'assignmentDate', headerName: 'Assigned Date', width: 125, minWidth: 110, valueFormatter: fmtD },
        { field: 'reassignDate', headerName: 'Reassign Date', width: 125, minWidth: 110, valueFormatter: fmtD },
        { field: 'completedDate', headerName: 'Resolved Date', width: 130, minWidth: 110, valueFormatter: fmtD },
        { field: 'slaDays', headerName: 'SLA (d)', width: 90, minWidth: 80, type: 'numericColumn' },
        { field: 'agingDays', headerName: 'Aging (d)', width: 90, minWidth: 80, type: 'numericColumn' }
    ];
}

function rcBuildColDefs(mode) {
    var selectable = mode === 'assign' || mode === 'assigned';
    var cols = [];
    if (selectable) {
        cols.push({
            colId: 'rc_select',
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
    cols = cols.concat(rcDataColumnDefs());
    if (mode === 'assign') {
        cols.push({ headerName: 'Edit', width: 72, minWidth: 68, pinned: 'right', sortable: false, filter: false, cellRenderer: rcEditActionRenderer });
        cols.push({ headerName: 'Action', width: 210, minWidth: 190, pinned: 'right', sortable: false, filter: false, cellRenderer: rcAssignActionRenderer });
    } else if (mode === 'assigned') {
        cols.push({ headerName: 'Edit', width: 72, minWidth: 68, pinned: 'right', sortable: false, filter: false, cellRenderer: rcEditActionRenderer });
        cols.push({ headerName: 'Reassign', width: 240, minWidth: 220, pinned: 'right', sortable: false, filter: false, cellRenderer: rcReassignActionRenderer });
        cols.push({ headerName: 'Resolve', width: 110, minWidth: 100, pinned: 'right', sortable: false, filter: false, cellRenderer: rcResolveActionRenderer });
    } else if (mode === 'agentqueue') {
        cols.push({ headerName: 'Action', width: 160, minWidth: 140, pinned: 'right', sortable: false, filter: false, cellRenderer: rcAgentQueueActionRenderer });
    } else if (mode === 'records' && rcIsAdminLike()) {
        cols.push({ headerName: 'Action', width: rcCanDeleteAll() ? 220 : 180, minWidth: rcCanDeleteAll() ? 200 : 160, pinned: 'right', sortable: false, filter: false, cellRenderer: rcAdminRecordsActionRenderer });
    }
    return cols.map(function (col) { return col.colId === 'rc_select' ? col : rcEnhanceColDef(col); });
}

function rcGridSectionHTML(title, gridId, countId, searchId, exportFn, count) {
    return '<div class="table-section">' +
        '<div class="table-header">' +
            '<h3 class="table-title">' + rcEsc(title) + ' · <span id="' + countId + '">' + count + ' record' + (count !== 1 ? 's' : '') + '</span></h3>' +
            '<div class="table-actions">' +
                '<button type="button" class="export-btn" onclick="' + exportFn + '">' +
                    '<i data-lucide="file-spreadsheet" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export CSV</button>' +
                '<input type="text" class="search-box" id="' + searchId + '" placeholder="Search all columns…" oninput="rcGridQuickFilter(\'' + gridId + '\',this.value)">' +
            '</div></div>' +
        '<div id="' + gridId + '" class="ag-theme-alpine" style="height:640px;width:100%;"></div></div>';
}

function rcUpdateBulkSelCount(gridKey) {
    var map = { assign: 'rcAssignBulkCount', assigned: 'rcAssignedBulkCount' };
    var el = document.getElementById(map[gridKey]);
    if (!el) return;
    el.textContent = rcGetSelectedRows(gridKey).length + ' selected';
}

function rcRenderGrid(gridKey, gridId, countId, items, mode) {
    var el = document.getElementById(gridId);
    if (!el) return;
    if (typeof agGrid === 'undefined') {
        el.innerHTML = rcErrBox('ag-Grid not loaded.');
        return;
    }
    var data = (items || []).map(rcMapRow).filter(Boolean);
    var countEl = document.getElementById(countId);
    if (countEl) countEl.textContent = data.length + ' record' + (data.length !== 1 ? 's' : '');

    rcDestroyGrid(gridKey);
    el.innerHTML = '';
    var selectable = mode === 'assign' || mode === 'assigned';
    var opts = {
        columnDefs: rcBuildColDefs(mode),
        rowData: data,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 90,
            suppressSizeToFit: true,
            tooltipValueGetter: function (p) {
                if (p.value == null || p.value === '') return null;
                return String(p.value);
            }
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
        getRowClass: function (params) {
            if (params.data && params.data.isRepeat) return 'rc-row-repeat';
            return '';
        },
        onGridReady: function (p) {
            rcGrids[gridKey] = p.api;
            rcUpdateBulkSelCount(gridKey);
        },
        onSelectionChanged: function () { rcUpdateBulkSelCount(gridKey); }
    };
    if (agGrid.createGrid) rcGrids[gridKey] = agGrid.createGrid(el, opts);
    else { new agGrid.Grid(el, opts); rcGrids[gridKey] = opts.api; }
}

window.rcGridQuickFilter = function (gridId, val) {
    var map = { rcGrid: 'dash', rcAssignGrid: 'assign', rcAssignedGrid: 'assigned', rcAgentQueueGrid: 'agentQueue', rcAgentGrid: 'agentRecords' };
    var api = rcGrids[map[gridId]];
    if (!api) return;
    if (api.setGridOption) api.setGridOption('quickFilterText', val);
    else if (api.setQuickFilter) api.setQuickFilter(val);
};

window.rcExportDashCsv = function () { rcExportGrid('dash', 'RC_All_Records'); };
window.rcExportAssignCsv = function () { rcExportGrid('assign', 'RC_Assign_Queue'); };
window.rcExportAssignedCsv = function () { rcExportGrid('assigned', 'RC_Assigned_Queue'); };
window.rcExportAgentQueueCsv = function () { rcExportGrid('agentQueue', 'RC_My_Queue'); };
window.rcExportAgentRecordsCsv = function () { rcExportGrid('agentRecords', 'RC_My_Records'); };

function rcExportGrid(key, prefix) {
    var api = rcGrids[key];
    if (!api || !api.exportDataAsCsv) return;
    rcShowBusy('Preparing export…', 'Building CSV file');
    setTimeout(function () {
        try {
            api.exportDataAsCsv({
                fileName: prefix + '_' + new Date().toISOString().slice(0, 10) + '.csv',
                allColumns: true
            });
        } finally {
            rcHideBusy();
        }
    }, 30);
}

function rcBulkBarHTML(type) {
    var isAssign = type === 'assign';
    var countId = isAssign ? 'rcAssignBulkCount' : 'rcAssignedBulkCount';
    return '<div class="rc-bulk-bar">' +
        '<span class="rc-bulk-label">' + (isAssign ? 'Bulk Assign' : 'Bulk Reassign') + '</span>' +
        '<select id="rcBulkAgent" class="fb-select" style="max-width:200px;">' + rcAgentOptionsHTML('') + '</select>' +
        '<button type="button" class="export-btn" onclick="rcBulk' + (isAssign ? 'Assign' : 'Reassign') + '()" style="padding:8px 18px;">' +
            (isAssign ? 'Assign Selected' : 'Reassign Selected') + '</button>' +
        '<span class="rc-bulk-hint">' + (isAssign
            ? 'One row = one unique caller. Assigning updates all pending calls for that MSISDN.'
            : 'One row = one unique caller. Reassigning updates all in-progress calls for that MSISDN.') + '</span>' +
        '<span id="' + countId + '" class="rc-bulk-count">0 selected</span></div>';
}

function rcAgentOptionsHTML(selected) {
    return '<option value="">Select…</option>' + rcAllAgents.map(function (a) {
        return '<option value="' + rcEsc(a.name) + '"' + (selected === a.name ? ' selected' : '') + '>' + rcEsc(a.name) + '</option>';
    }).join('');
}

// ============================================================
// RC DASHBOARD
// ============================================================
function rcUploadSectionHTML() {
    var adminBar = rcCanDeleteAll() ?
        '<div class="rc-delete-all-bar">' +
            '<button type="button" class="export-btn" onclick="rcDeleteAll()" style="padding:.5rem 1rem;font-size:.82rem;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;color:#fff;">' +
                '<i data-lucide="trash-2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Delete All Records</button>' +
            '<span style="font-size:.72rem;color:var(--t3);">Permanently removes every row in the Repeated_Calls list. Tehleel &amp; Ubaid only.</span>' +
            '<div id="rcDeleteProgress" style="flex:1 1 100%;font-size:.75rem;color:var(--t2);"></div>' +
        '</div>' : '';
    return '<div style="margin:1.25rem 0;padding:1rem;border:1px solid var(--border);border-radius:12px;background:var(--bg-card);">' +
        '<h3 style="font-size:.92rem;font-weight:800;color:var(--t1);margin:0 0 .5rem;">Daily Upload</h3>' +
        '<p style="font-size:.78rem;color:var(--t3);margin-bottom:1rem;">Upload the daily Repeated Calls Excel. Imports only <b>Enterprise</b> customers from site <b>CC-SGS-Emtyaz</b> with <b>3+ calls</b> per MSISDN. New rows save as <b>Pending</b>; status becomes <b>In Progress</b> when assigned.</p>' +
        '<label class="rc-upload-zone"><input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="rcParseFile(event)">Click or drop Excel file here</label>' +
        adminBar +
        '<div id="rcUploadPreview" style="margin-top:1rem;"></div></div>';
}

function rcDashboardMainHTML(dateFiltered, items, s, gridItems) {
    gridItems = gridItems || rcDashboardGridItems(items);
    var statusSum = s.pending + s.inprogress + s.completed;
    return '<div class="top-stats">' +
            rcKpiTile('Repeat Call Volume', s.repeatCalls, 'Total calls from 3+ repeaters', '#ef4444', 'volume') +
            rcKpiTile('Repeat Callers', s.repeatCallers, 'Pending + In Progress + Resolved = ' + statusSum, '#f59e0b', 'callers') +
            rcKpiTile('Pending', s.pending, 'Assign Queue — not assigned yet', rcStatusColor(RC_STATUS.PENDING), 'pending') +
            rcKpiTile('In Progress', s.inprogress, 'Assigned Queue — assigned and still open', rcStatusColor(RC_STATUS.INPROGRESS), 'inprogress') +
            rcKpiTile('Resolved', s.completed, 'Not reachable OR reachable + issue resolved', rcStatusColor(RC_STATUS.RESOLVED), 'resolved') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:1rem 0;">' +
            '<button type="button" id="rcToggleRepeatBtn" class="export-btn" onclick="rcToggleRepeatCallers()" style="padding:12px 20px;font-size:14px;">' +
                '<i data-lucide="phone-missed" id="rcRepeatIcon" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
                '<span id="rcRepeatText">' + (rcRepeatVisible ? 'Hide Repeat Callers' : 'Show Repeat Callers') + '</span></button>' +
            '<button type="button" id="rcToggleChartsBtn" class="export-btn" onclick="rcToggleCharts()" style="padding:12px 20px;font-size:14px;">' +
                '<i data-lucide="eye" id="rcChartsIcon" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
                '<span id="rcChartsText">' + (rcChartsBuilt ? 'Hide Analytics Charts' : 'Show Analytics Charts') + '</span></button>' +
        '</div>' +
        '<div id="rcRepeatSection" style="display:' + (rcRepeatVisible ? 'block' : 'none') + ';">' +
            rcRepeatCallersPanelHTML(dateFiltered) +
        '</div>' +
        '<div id="rcChartsSection" style="display:' + (rcChartsBuilt ? 'block' : 'none') + ';margin-top:1rem;">' +
            '<div class="rc-cbr-host" id="rcContactTreeBody">' + rcContactTreeHTML(items) + '</div>' +
            '<div class="rc-chart-grid">' +
            rcTrendChartCardHTML() +
            rcChartCard('Status Breakdown', 'rcChartStatus', 'Pending / in progress / resolved', true) +
            rcChartCard('Agent Workload', 'rcChartAgent', 'Resolved vs in progress', true) +
            rcChartCard('Call Drivers', 'rcChartDrivers', 'Count per driver', true) +
            rcChartCard('SLA Distribution', 'rcChartAging', 'Days assign → done/now', false) +
            '</div></div>' +
        rcUploadSectionHTML() +
        rcGridSectionHTML(rcTreeFilterTitle(), 'rcGrid', 'rcDashCount', 'rcDashSearch', 'rcExportDashCsv()', gridItems.length);
}

function rcRefreshDashboardContent() {
    var body = document.getElementById('rcTabBody');
    var base = rcAllItems;
    var dateFiltered = rcApplyDateFilters(base, rcDateFilters);
    rcRebuildMsisdnCounts(dateFiltered);
    rcRebuildCallerFlags(dateFiltered);
    var items = rcApplyDashFilters(dateFiltered);
    rcWarmPerfCache(items);
    var s = rcSummary(items, dateFiltered);
    var gridItems = rcDashboardGridItems(items);
    rcLastChartItems = items;
    rcLastChartSummary = s;

    var main = document.getElementById('rcDashMain');
    if (!main) {
        if (body) rcRenderDashboard(body);
        return;
    }

    main.innerHTML = rcDashboardMainHTML(dateFiltered, items, s, gridItems);
    rcRenderGrid('dash', 'rcGrid', 'rcDashCount', gridItems, 'records');
    rcSafeUpdateDateFilterOptions('rcFilter', dateFiltered, 'rcApplyDashboardFilters');
    rcSyncDateModeUI('rcFilter');

    if (rcChartsBuilt) {
        rcDestroyCharts();
        rcBuildDashboardCharts(items, s);
        rcSchedulePaintContactTree();
    } else if (document.getElementById('rcChartCallbackBreakdown')) {
        requestAnimationFrame(function () { rcBuildCallbackBreakdownChart(items, rcPerfCache.treeData); });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (rcRepeatVisible) {
        var rpIcon = document.getElementById('rcRepeatIcon');
        if (rpIcon) rpIcon.setAttribute('data-lucide', 'eye-off');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function rcRefreshAssignContent() {
    var pendingAll = rcAssignQueueItems();
    var pending = rcApplyQueueFilters(pendingAll, rcAssignFilters, false, rcAssignDateFilters);
    var main = document.getElementById('rcAssignMain');
    if (!main) {
        var body = document.getElementById('rcTabBody');
        if (body) rcRenderAssignQueue(body);
        return;
    }
    main.innerHTML = rcBulkBarHTML('assign') +
        rcGridSectionHTML('Assign Queue — Unique callers', 'rcAssignGrid', 'rcAssignCount', 'rcAssignSearch', 'rcExportAssignCsv()', pending.length);
    rcRenderGrid('assign', 'rcAssignGrid', 'rcAssignCount', pending, 'assign');
    rcSafeUpdateDateFilterOptions('rcAssignF', pendingAll, 'rcApplyAssignFilters');
    rcSyncDateModeUI('rcAssignF');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function rcRefreshAssignedContent() {
    var assignedAll = rcAssignedQueueItems();
    var assigned = rcApplyQueueFilters(assignedAll, rcAssignedFilters, true, rcAssignedDateFilters);
    var main = document.getElementById('rcAssignedMain');
    if (!main) {
        var body = document.getElementById('rcTabBody');
        if (body) rcRenderAssignedQueue(body);
        return;
    }
    main.innerHTML = rcBulkBarHTML('reassign') +
        rcGridSectionHTML('Assigned Queue — In Progress callers', 'rcAssignedGrid', 'rcAssignedCount', 'rcAssignedSearch', 'rcExportAssignedCsv()', assigned.length);
    rcRenderGrid('assigned', 'rcAssignedGrid', 'rcAssignedCount', assigned, 'assigned');
    rcSafeUpdateDateFilterOptions('rcAssignedF', assignedAll, 'rcApplyAssignedFilters');
    rcSyncDateModeUI('rcAssignedF');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function rcRefreshMyQueueContent() {
    var mine = rcApplyDateFilters(rcScopedItems(), rcDateFilters);
    var s = rcSummary(mine);
    var inq = rcDedupeUniqueCallers(mine.filter(function (it) {
        return rcIsRepeatMsisdn(it.MSISDN) && rcIsAssigned(it) && rcRowWorkflowStatus(it) === RC_STATUS.INPROGRESS;
    }));
    var resolvedUnique = rcDedupeUniqueCallers(mine.filter(function (it) {
        return rcIsRepeatMsisdn(it.MSISDN) && rcIsAssigned(it) && rcRowWorkflowStatus(it) === RC_STATUS.RESOLVED;
    }));
    var main = document.getElementById('rcMyQueueMain');
    if (!main) {
        var body = document.getElementById('rcTabBody');
        if (body) rcRenderMyQueue(body);
        return;
    }
    main.innerHTML =
        '<div class="top-stats">' +
            rcTile('In Queue', inq.length, 'Unique repeat callers', rcStatusColor(RC_STATUS.INPROGRESS)) +
            rcTile('Resolved', resolvedUnique.length, 'Unique repeat callers', rcStatusColor(RC_STATUS.RESOLVED)) +
            rcTile('Total Assigned', inq.length + resolvedUnique.length, 'Unique callers', 'var(--acc)') +
            rcTile('Avg SLA', s.avgTtc + ' d', 'Assign/Reassign → done', 'var(--acc2)') +
        '</div>' +
        rcGridSectionHTML('My Queue — Unique callers', 'rcAgentQueueGrid', 'rcAgentQueueCount', 'rcAgentSearch', 'rcExportAgentQueueCsv()', inq.length) +
        rcGridSectionHTML('My Records', 'rcAgentGrid', 'rcAgentRecCount', 'rcAgentRecSearch', 'rcExportAgentRecordsCsv()', mine.length);
    rcRenderGrid('agentQueue', 'rcAgentQueueGrid', 'rcAgentQueueCount', inq, 'agentqueue');
    rcRenderGrid('agentRecords', 'rcAgentGrid', 'rcAgentRecCount', mine, 'records');
    rcSafeUpdateDateFilterOptions('rcAgentF', rcScopedItems(), 'rcApplyAgentDateFilters');
    rcSyncDateModeUI('rcAgentF');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function rcRenderDashboard(body) {
    var base = rcAllItems;
    var dateFiltered = rcApplyDateFilters(base, rcDateFilters);
    rcRebuildMsisdnCounts(dateFiltered);
    rcRebuildCallerFlags(dateFiltered);
    var items = rcApplyDashFilters(dateFiltered);
    rcWarmPerfCache(items);
    var s = rcSummary(items, dateFiltered);
    var gridItems = rcDashboardGridItems(items);
    rcChartsBuilt = false;
    rcLastChartItems = items;
    rcLastChartSummary = s;

    body.innerHTML =
        rcFilterBarHTML(dateFiltered) +
        '<div id="rcDashMain">' + rcDashboardMainHTML(dateFiltered, items, s, gridItems) + '</div>';

    rcRenderGrid('dash', 'rcGrid', 'rcDashCount', gridItems, 'records');
    rcBindMsOutsideClick();
    rcPopulateMainMsDropdowns('rcFilter', dateFiltered, rcDashFilters, 'rcApplyDashboardFilters');
    rcSafeUpdateDateFilterOptions('rcFilter', dateFiltered, 'rcApplyDashboardFilters');
    rcSyncDateModeUI('rcFilter');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (rcRepeatVisible) {
        var rpIcon = document.getElementById('rcRepeatIcon');
        if (rpIcon) rpIcon.setAttribute('data-lucide', 'eye-off');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

window.rcToggleRepeatCallers = function () {
    var section = document.getElementById('rcRepeatSection');
    var icon = document.getElementById('rcRepeatIcon');
    var text = document.getElementById('rcRepeatText');
    if (!section) return;
    if (section.style.display === 'none') {
        section.style.display = 'block';
        rcRepeatVisible = true;
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
        if (text) text.textContent = 'Hide Repeat Callers';
    } else {
        section.style.display = 'none';
        rcRepeatVisible = false;
        if (icon) icon.setAttribute('data-lucide', 'phone-missed');
        if (text) text.textContent = 'Show Repeat Callers';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.rcToggleAgents = function () {
    var section = document.getElementById('rcAgentsSection');
    var icon = document.getElementById('rcAgentsIcon');
    var text = document.getElementById('rcAgentsText');
    if (!section) return;
    if (section.style.display === 'none') {
        section.style.display = 'block';
        rcAgentsVisible = true;
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
        if (text) text.textContent = 'Hide RC Agents';
    } else {
        section.style.display = 'none';
        rcAgentsVisible = false;
        if (icon) icon.setAttribute('data-lucide', 'eye');
        if (text) text.textContent = 'Show RC Agents';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.rcToggleCharts = function () {
    var section = document.getElementById('rcChartsSection');
    var icon = document.getElementById('rcChartsIcon');
    var text = document.getElementById('rcChartsText');
    if (!section) return;
    if (section.style.display === 'none') {
        section.style.display = 'block';
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
        if (text) text.textContent = 'Hide Analytics Charts';
        if (!rcChartsBuilt && rcLastChartItems) {
            rcBuildDashboardCharts(rcLastChartItems, rcLastChartSummary || rcSummary(rcLastChartItems));
            rcChartsBuilt = true;
        } else {
            rcSchedulePaintContactTree();
        }
    } else {
        section.style.display = 'none';
        if (icon) icon.setAttribute('data-lucide', 'eye');
        if (text) text.textContent = 'Show Analytics Charts';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

function rcChartCard(title, canvasId, subtitle, tall) {
    return '<div class="rc-chart-card"><div class="rc-chart-head"><h3>' + rcEsc(title) + '</h3><span>' + rcEsc(subtitle) + '</span></div>' +
        '<div class="rc-chart-body" style="height:' + (tall ? '300px' : '280px') + ';"><canvas id="' + canvasId + '"></canvas></div></div>';
}

function rcTrendChartCardHTML() {
    var g = rcTrendGranularity || 'monthly';
    function tb(id, label) {
        return '<button type="button" class="rc-trend-toggle' + (g === id ? ' active' : '') + '" data-gran="' + id + '" onclick="rcSetTrendGranularity(\'' + id + '\')">' + label + '</button>';
    }
    return '<div class="rc-chart-card rc-chart-wide"><div class="rc-chart-head">' +
        '<div><h3>Activity Trend</h3><span>Records over time · uses “Which date field?” from filters</span></div>' +
        '<div class="rc-trend-toggles">' + tb('daily', 'Daily') + tb('weekly', 'Weekly') + tb('monthly', 'Monthly') + '</div>' +
        '</div><div class="rc-chart-body" style="height:280px;"><canvas id="rcChartTrend"></canvas></div></div>';
}

function rcTrendBucketKey(iso, granularity) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    if (granularity === 'daily') {
        return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }
    if (granularity === 'weekly') {
        var start = new Date(y, 0, 1);
        var week = Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7);
        return y + '-W' + String(Math.min(week, 53)).padStart(2, '0');
    }
    return y + '-' + String(m + 1).padStart(2, '0');
}

function rcTrendLabel(key, granularity) {
    if (!key) return '';
    if (granularity === 'daily') {
        var p = key.split('-');
        return p[2] + ' ' + RC_MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
    }
    if (granularity === 'weekly') return key.replace('-W', ' W');
    var mp = key.split('-');
    return RC_MONTHS[parseInt(mp[1], 10) - 1] + ' ' + mp[0];
}

function rcSlaBucketKey(sla) {
    if (sla == null || sla < 0) return null;
    if (sla < 1) return '0-1d';
    if (sla < 2) return '1-2d';
    if (sla < 3) return '2-3d';
    if (sla < 5) return '3-5d';
    return '5d+';
}

window.rcSetTrendGranularity = function (granularity) {
    rcTrendGranularity = granularity || 'monthly';
    document.querySelectorAll('.rc-trend-toggle').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-gran') === rcTrendGranularity);
    });
    if (rcChartsBuilt && rcLastChartItems) {
        if (rcCharts.trend) { try { rcCharts.trend.destroy(); } catch (e) {} rcCharts.trend = null; }
        rcBuildTrendChart(rcLastChartItems);
    }
};

function rcBuildTrendChart(items) {
    if (typeof Chart === 'undefined') return;
    rcEnsureChartPlugins();
    var canvas = document.getElementById('rcChartTrend');
    if (!canvas) return;
    var granularity = rcTrendGranularity || 'monthly';
    var field = rcDateFilters.dateField || 'UploadDate';
    var counts = {};
    rcRepeatCallerItems(items).forEach(function (it) {
        var key = rcTrendBucketKey(rcItemDateValue(it, field), granularity);
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
    });
    var keys = Object.keys(counts).sort();
    var labels = keys.map(function (k) { return rcTrendLabel(k, granularity); });
    var data = keys.map(function (k) { return counts[k]; });
    if (!keys.length) { labels = ['No data']; data = [0]; }
    var grid = 'rgba(148,163,184,0.12)';
    rcCharts.trend = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Activities',
                data: data,
                borderColor: rcCssVar('--acc'),
                backgroundColor: 'rgba(99,102,241,0.12)',
                fill: true,
                tension: 0.35,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: rcCssVar('--acc2'),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: rcChartLayoutPadding(),
            plugins: { legend: { display: false }, tooltip: rcChartTooltip() },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } } },
                y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } }
            }
        }
    });
}

function rcBuildDashboardCharts(items, s) {
    if (typeof Chart === 'undefined') return;
    RC_CHART_PALETTE = rcThemePalette();
    rcEnsureChartPlugins();
    Chart.defaults.color = rcCssVar('--t2');
    Chart.defaults.font.family = 'Inter,sans-serif';
    var grid = 'rgba(148,163,184,0.12)';
    var legend = { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 11, weight: '600' } } };

    rcBuildTrendChart(items);
    rcBuildCallbackBreakdownChart(items, rcPerfCache.treeData);

    var sc = document.getElementById('rcChartStatus');
    if (sc) {
        var p = RC_CHART_PALETTE;
        rcCharts.status = new Chart(sc, {
            type: 'doughnut',
            data: { labels: ['Pending', 'In Progress', 'Resolved'], datasets: [{ data: [s.pending, s.inprogress, s.completed],
                backgroundColor: function (ctx) {
                    if (ctx.dataIndex == null || ctx.dataIndex < 0) return '#94a3b8';
                    var pal = [p.pending, p.inprogress, p.completed][ctx.dataIndex];
                    if (!pal) return '#94a3b8';
                    return rcLinearGradient(ctx.chart, pal.from, pal.to);
                },
                borderWidth: 3, borderColor: rcCssVar('--bg-card'), hoverOffset: 10, spacing: 3 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', layout: rcChartLayoutPadding(), plugins: { legend: legend, tooltip: rcChartTooltip() } },
            plugins: [rcCenterTextPlugin(s.repeatCallers, 'Callers')]
        });
    }

    var agentMap = {};
    rcAllAgents.forEach(function (a) { agentMap[a.name] = { completed: 0, inprogress: 0 }; });
    items.forEach(function (it) {
        if (!it.AssignedToName) return;
        var agent = rcCanonicalAgentName(it.AssignedToName);
        if (!agent) return;
        if (!agentMap[agent]) agentMap[agent] = { completed: 0, inprogress: 0 };
        if (rcRowWorkflowStatus(it) === RC_STATUS.RESOLVED) agentMap[agent].completed++;
        else if (rcRowWorkflowStatus(it) === RC_STATUS.INPROGRESS) agentMap[agent].inprogress++;
    });
    var names = Object.keys(agentMap).filter(function (n) {
        return agentMap[n].completed + agentMap[n].inprogress > 0;
    }).sort(function (a, b) {
        var ta = agentMap[a].completed + agentMap[a].inprogress;
        var tb = agentMap[b].completed + agentMap[b].inprogress;
        return tb - ta;
    });
    var ac = document.getElementById('rcChartAgent');
    if (ac) rcCharts.agent = new Chart(ac, {
        type: 'bar',
        data: {
            labels: names.length ? names : ['No data'],
            datasets: [
                {
                    label: 'Resolved',
                    data: names.length ? names.map(function (n) { return agentMap[n].completed; }) : [0],
                    backgroundColor: rcCssVar('--acc2') || '#22c55e',
                    borderRadius: 6, maxBarThickness: 40
                },
                {
                    label: 'In Progress',
                    data: names.length ? names.map(function (n) { return agentMap[n].inprogress; }) : [0],
                    backgroundColor: rcCssVar('--acc') || '#f59e0b',
                    borderRadius: 6, maxBarThickness: 40
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: rcChartLayoutPadding(),
            plugins: { legend: legend, tooltip: rcChartTooltip() },
            scales: {
                x: { stacked: false, grid: { display: false } },
                y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } }
            }
        }
    });

    var driverData = rcBuildCallDriverChartData(items);
    var dc = document.getElementById('rcChartDrivers');
    if (dc) rcCharts.drivers = new Chart(dc, {
        type: 'bar',
        data: {
            labels: driverData.labels,
            datasets: [{
                label: 'Count',
                data: driverData.values,
                backgroundColor: function (ctx) {
                    var pal = RC_CHART_PALETTE.categories;
                    var col = pal[ctx.dataIndex % pal.length] || rcCssVar('--acc');
                    return rcLinearGradient(ctx.chart, col, rcCssVar('--acc2') || '#22c55e');
                },
                borderRadius: 8,
                maxBarThickness: 48
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: rcChartLayoutPadding(),
            plugins: { legend: { display: false }, tooltip: rcChartTooltip() },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } } },
                y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } }
            }
        }
    });

    var slaData = rcBuildSlaChartData(items);
    var slaKeys = slaData.labels;
    var agc = document.getElementById('rcChartAging');
    if (agc) rcCharts.aging = new Chart(agc, {
        type: 'bar',
        data: {
            labels: slaKeys,
            datasets: [{
                label: 'Activities',
                data: slaData.values,
                backgroundColor: function (ctx) {
                    if (ctx.dataIndex == null || ctx.dataIndex < 0) return '#22c55e';
                    var col = RC_CHART_PALETTE.aging[ctx.dataIndex] || '#22c55e';
                    return rcLinearGradient(ctx.chart, col, rcCssVar('--acc'));
                },
                borderRadius: 10, maxBarThickness: 56
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, layout: rcChartLayoutPadding(), plugins: { legend: { display: false }, tooltip: rcChartTooltip() },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } } } }
    });
    rcSchedulePaintContactTree();
}

// ── Report export (PPT / PDF) ─────────────────────────────────
function rcLoadPptLib() {
    return new Promise(function (resolve, reject) {
        if (typeof PptxGenJS !== 'undefined') { resolve(); return; }
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error('Failed to load PptxGenJS')); };
        document.head.appendChild(s);
    });
}

function rcLoadPdfLib() {
    return new Promise(function (resolve, reject) {
        if (window.jspdf) { resolve(); return; }
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error('Failed to load jsPDF')); };
        document.head.appendChild(s);
    });
}

function rcPdfEnsureSpace(pdf, y, need, margin) {
    var pageH = pdf.internal.pageSize.getHeight();
    if (y + need > pageH - margin) {
        pdf.addPage();
        return margin;
    }
    return y;
}

function rcPdfHeading(pdf, text, y, margin, size) {
    y = rcPdfEnsureSpace(pdf, y, size * 0.6 + 6, margin);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(size);
    pdf.setTextColor(30, 30, 30);
    pdf.text(text, margin, y);
    return y + size * 0.45 + 4;
}

function rcPdfLine(pdf, text, y, margin, contentW, size) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size || 10);
    pdf.setTextColor(60, 60, 60);
    pdf.splitTextToSize(String(text), contentW).forEach(function (line) {
        y = rcPdfEnsureSpace(pdf, y, 5, margin);
        pdf.text(line, margin, y);
        y += 4.5;
    });
    return y + 2;
}

function rcPdfTable(pdf, headers, rows, y, margin, contentW) {
    var colW = contentW / headers.length;
    y = rcPdfEnsureSpace(pdf, y, 8, margin);
    pdf.setFillColor(99, 102, 241);
    pdf.rect(margin, y - 4, contentW, 6, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    headers.forEach(function (h, i) { pdf.text(h, margin + i * colW + 1, y); });
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(50, 50, 50);
    rows.forEach(function (row, ri) {
        y = rcPdfEnsureSpace(pdf, y, 5, margin);
        if (ri % 2 === 0) { pdf.setFillColor(245, 245, 250); pdf.rect(margin, y - 3.5, contentW, 5, 'F'); }
        row.forEach(function (cell, i) {
            pdf.text(String(cell == null ? '—' : cell).substring(0, 36), margin + i * colW + 1, y);
        });
        y += 5;
    });
    return y + 4;
}

function rcPdfAddChart(pdf, chartKey, title, y, margin, contentW, imgH) {
    var chart = rcCharts[chartKey];
    if (!chart || !chart.canvas) return y;
    imgH = imgH || 58;
    try {
        var img = chart.canvas.toDataURL('image/png', 1.0);
        y = rcPdfHeading(pdf, title, y, margin, 11);
        y = rcPdfEnsureSpace(pdf, y, imgH + 4, margin);
        pdf.addImage(img, 'PNG', margin, y, contentW, imgH);
        return y + imgH + 6;
    } catch (e) { return y; }
}

function rcEnsureReportCharts(items, summary) {
    var section = document.getElementById('rcChartsSection');
    var wasHidden = section && section.style.display === 'none';
    if (section && wasHidden) section.style.display = 'block';
    if (!rcChartsBuilt || wasHidden) {
        rcDestroyCharts();
        rcBuildDashboardCharts(items, summary);
        rcChartsBuilt = true;
    }
    return { wasHidden: wasHidden };
}

function rcRestoreChartsVisibility(wasHidden) {
    if (!wasHidden) return;
    var section = document.getElementById('rcChartsSection');
    if (section) section.style.display = 'none';
    rcChartsBuilt = false;
    rcDestroyCharts();
}

function rcPptSlideHeader(slide, title, sub, colors) {
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.07, fill: { color: colors.blue } });
    slide.addText(title, { x: 0.45, y: 0.22, w: 9.1, h: 0.52, fontSize: 20, bold: true, color: colors.deep, fontFace: 'Arial' });
    if (sub) slide.addText(sub, { x: 0.45, y: 0.72, w: 9.1, h: 0.55, fontSize: 9.5, color: colors.muted, fontFace: 'Arial', valign: 'top' });
}

function rcPptChartBase(showValues) {
    return {
        showLegend: true,
        legendPos: 'b',
        showValue: showValues !== false,
        showLabel: true,
        dataLabelPosition: 'outEnd',
        dataLabelColor: '0F172A',
        dataLabelFontSize: 10,
        dataLabelFontBold: true,
        valGridLine: { style: 'none' },
        catGridLine: { style: 'none' }
    };
}

window.rcExportPpt = async function () {
    if (!rcAllItems.length) { rcToast('No data to export', 'warn'); return; }
    var btn = document.getElementById('rcExportPptBtn');
    var origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Building PPT…'; }
    try {
        await rcLoadPptLib();
        var report = rcGetReportData();
        var items = report.items;
        var s = report.summary;
        var trend = rcBuildTrendChartData(items);
        var drivers = rcBuildCallDriverChartData(items);
        var sla = rcBuildSlaChartData(items);
        var pptx = new PptxGenJS();
        var C = { blue: '6366F1', green: '22C55E', amber: 'F59E0B', slate: '64748B', deep: '0F172A', muted: '64748B', white: 'FFFFFF' };
        var stamp = new Date().toISOString().slice(0, 10);
        var fileName = 'Repeated_Calls_Report_' + stamp + '.pptx';

        pptx.layout = 'LAYOUT_16x9';
        pptx.title = 'Repeated Calls Report';
        pptx.author = 'Repeated Calls Module';

        var s1 = pptx.addSlide();
        s1.background = { color: C.deep };
        s1.addText('Repeated Calls Report', { x: 0.65, y: 2.05, w: 8.7, h: 0.85, fontSize: 30, bold: true, color: C.white, fontFace: 'Arial' });
        s1.addText(report.dateLabel, { x: 0.65, y: 2.95, w: 8.7, h: 0.45, fontSize: 14, color: C.amber, fontFace: 'Arial' });
        s1.addText('Generated ' + new Date().toLocaleString('en-GB') + ' · ' + s.repeatCallers + ' unique repeat callers', { x: 0.65, y: 4.65, w: 8.7, h: 0.3, fontSize: 10, color: '94A3B8', fontFace: 'Arial' });

        var s2 = pptx.addSlide();
        rcPptSlideHeader(s2, 'Summary', report.dateLabel, C);
        s2.addText('Repeat Callers = Pending + In Progress + Resolved', { x: 0.55, y: 1.05, w: 9, h: 0.25, fontSize: 9.5, bold: true, color: C.blue, fontFace: 'Arial' });
        [
            ['Repeat Call Volume', String(s.repeatCalls), 'Total calls from 3+ repeaters'],
            ['Repeat Callers', String(s.repeatCallers), 'Unique MSISDN · 3+ calls'],
            ['Pending', String(s.pending), 'Unique repeat callers · not assigned'],
            ['In Progress', String(s.inprogress), 'Unique repeat callers · assigned'],
            ['Resolved', String(s.completed), 'Unique repeat callers · done'],
            ['Avg SLA', String(s.avgTtc) + ' d', 'Assign/Reassign → done']
        ].forEach(function (row, i) {
            s2.addShape('roundRect', { x: 0.45, y: 1.35 + i * 0.62, w: 9.1, h: 0.52, rectRadius: 0.06, fill: { color: i % 2 ? 'F8FAFC' : 'FFFFFF' }, line: { color: 'E2E8F0', width: 1 } });
            s2.addText(row[0], { x: 0.65, y: 1.42 + i * 0.62, w: 2.4, h: 0.28, fontSize: 11, bold: true, color: C.deep, fontFace: 'Arial' });
            s2.addText(row[1], { x: 3.2, y: 1.42 + i * 0.62, w: 1.2, h: 0.28, fontSize: 14, bold: true, color: C.blue, fontFace: 'Arial' });
            s2.addText(row[2], { x: 4.5, y: 1.42 + i * 0.62, w: 5.1, h: 0.28, fontSize: 9.5, color: C.muted, fontFace: 'Arial' });
        });

        var pptChart = rcPptChartBase(true);
        var s3 = pptx.addSlide();
        rcPptSlideHeader(s3, 'Activity Trend', 'Repeat call records over time · ' + report.dateLabel, C);
        s3.addChart(pptx.ChartType.line, [
            { name: 'Activities', labels: trend.labels, values: trend.values }
        ], Object.assign({}, pptChart, { x: 0.35, y: 1.35, w: 9.3, h: 4.0, showLegend: false, lineSize: 3, chartColors: [C.blue], dataLabelPosition: 't' }));

        var s4 = pptx.addSlide();
        rcPptSlideHeader(s4, 'Status Breakdown', 'Unique repeat callers · Pending / In Progress / Resolved', C);
        s4.addChart(pptx.ChartType.doughnut, [
            { name: 'Status', labels: ['Pending', 'In Progress', 'Resolved'], values: [s.pending, s.inprogress, s.completed] }
        ], Object.assign({}, pptChart, { x: 2.0, y: 1.35, w: 6.0, h: 4.0, chartColors: [C.slate, C.amber, C.green], dataLabelPosition: 'ctr' }));

        var s5 = pptx.addSlide();
        rcPptSlideHeader(s5, 'SLA Distribution', 'Days assign → done/now · unique repeat callers', C);
        s5.addChart(pptx.ChartType.bar, [
            { name: 'Callers', labels: sla.labels, values: sla.values }
        ], Object.assign({}, pptChart, { x: 0.35, y: 1.35, w: 9.3, h: 4.0, showLegend: false, barDir: 'col', chartColors: [C.green] }));

        var s6 = pptx.addSlide();
        rcPptSlideHeader(s6, 'Call Drivers', 'Count per driver · unique repeat callers', C);
        s6.addChart(pptx.ChartType.bar, [
            { name: 'Count', labels: drivers.labels, values: drivers.values }
        ], Object.assign({}, pptChart, { x: 0.35, y: 1.35, w: 9.3, h: 4.0, showLegend: false, barDir: 'col', chartColors: [C.blue], catAxisLabelRotate: drivers.labels.length > 6 ? 35 : 0 }));

        var tree = rcBuildContactTreeData(items);
        var s7 = pptx.addSlide();
        rcPptSlideHeader(s7, 'Repeated Contacts Breakdown', 'Callback → resolution → driver / pending with', C);
        [
            ['Repeated Contacts', tree.total],
            ['Not Reachable', tree.notReachable],
            ['Reachable', tree.reachable],
            ['Awaiting callback capture', tree.awaitingCallback],
            ['Resolved', tree.resolved],
            ['Issue Not Resolved', tree.notResolved]
        ].forEach(function (row, i) {
            s7.addText(row[0], { x: 0.55, y: 1.35 + i * 0.52, w: 3.2, h: 0.28, fontSize: 11, bold: true, color: C.deep, fontFace: 'Arial' });
            s7.addText(String(row[1]), { x: 3.9, y: 1.35 + i * 0.52, w: 1, h: 0.28, fontSize: 14, bold: true, color: C.blue, fontFace: 'Arial' });
        });
        var yLeaf = 1.35;
        s7.addText('Call Drivers · Top 5 (Resolved)', { x: 5.2, y: yLeaf, w: 4.2, h: 0.25, fontSize: 10, bold: true, color: C.amber, fontFace: 'Arial' });
        rcTopNPairs(tree.drivers, 5).forEach(function (p, i) {
            s7.addText(p.label + ' · ' + p.count, { x: 5.2, y: yLeaf + 0.32 + i * 0.34, w: 4.2, h: 0.25, fontSize: 9.5, color: C.deep, fontFace: 'Arial' });
        });
        s7.addText('Pending With · Top 5 (Not Resolved)', { x: 5.2, y: 3.55, w: 4.2, h: 0.25, fontSize: 10, bold: true, color: C.amber, fontFace: 'Arial' });
        rcTopNPairs(tree.pendingWith, 5).forEach(function (p, i) {
            s7.addText(p.label + ' · ' + p.count, { x: 5.2, y: 3.87 + i * 0.34, w: 4.2, h: 0.25, fontSize: 9.5, color: C.deep, fontFace: 'Arial' });
        });

        await pptx.writeFile({ fileName: fileName });
        rcToast('PPT report downloaded', 'success');
    } catch (e) {
        console.error('[RC] PPT export failed:', e);
        rcToast('PPT export failed — check console', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<i data-lucide="presentation" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Download PPT';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
};

window.rcExportPdf = async function () {
    if (!rcAllItems.length) { rcToast('No data to export', 'warn'); return; }
    var btn = document.getElementById('rcExportPdfBtn');
    var origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Building PDF…'; }
    var chartState = null;
    try {
        await rcLoadPdfLib();
        var report = rcGetReportData();
        var items = report.items;
        var s = report.summary;
        chartState = rcEnsureReportCharts(items, s);
        await new Promise(function (r) { setTimeout(r, 700); });

        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF('p', 'mm', 'a4');
        var margin = 14;
        var pageW = pdf.internal.pageSize.getWidth();
        var contentW = pageW - margin * 2;
        var y = margin;

        pdf.setFillColor(99, 102, 241);
        pdf.rect(0, 0, pageW, 18, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text('Repeated Calls Report', margin, 12);
        y = 26;

        pdf.setTextColor(60, 60, 60);
        y = rcPdfLine(pdf, report.dateLabel, y, margin, contentW, 10);
        y = rcPdfLine(pdf, 'Generated: ' + new Date().toLocaleString('en-GB') + ' · Unique repeat callers: ' + s.repeatCallers, y, margin, contentW, 10);
        y = rcPdfLine(pdf, 'Repeat Callers = Pending (' + s.pending + ') + In Progress (' + s.inprogress + ') + Resolved (' + s.completed + ')', y, margin, contentW, 9);

        y = rcPdfHeading(pdf, 'Summary', y, margin, 12);
        y = rcPdfTable(pdf,
            ['Metric', 'Value', 'Detail'],
            [
                ['Repeat Call Volume', s.repeatCalls, 'Total calls from 3+ repeaters'],
                ['Repeat Callers', s.repeatCallers, 'Unique MSISDN · 3+ calls'],
                ['Pending', s.pending, 'Not assigned'],
                ['In Progress', s.inprogress, 'Assigned'],
                ['Resolved', s.completed, 'Done'],
                ['Avg SLA', s.avgTtc + ' d', 'Assign/Reassign → done']
            ],
            y, margin, contentW);

        var tree = rcBuildContactTreeData(items);
        y = rcPdfHeading(pdf, 'Repeated Contacts Breakdown', y, margin, 12);
        y = rcPdfTable(pdf,
            ['Bucket', 'Count', 'Notes'],
            [
                ['Not Reachable', tree.notReachable, 'Callback = Not Reachable'],
                ['Reachable', tree.reachable, 'Callback = Reachable'],
                ['Awaiting callback capture', tree.awaitingCallback, 'No Call Back Status saved yet'],
                ['Resolved', tree.resolved, 'Reachable + Issue Resolved'],
                ['Issue Not Resolved', tree.notResolved, 'Reachable + Pending With']
            ],
            y, margin, contentW);

        pdf.addPage();
        y = margin;
        y = rcPdfHeading(pdf, 'Analytics Charts', y, margin, 14);
        y = rcPdfLine(pdf, 'All charts include visible counts. Agent Workload is dashboard-only and excluded.', y, margin, contentW, 9);
        y = rcPdfAddChart(pdf, 'trend', 'Activity Trend', y, margin, contentW, 58);
        y = rcPdfAddChart(pdf, 'status', 'Status Breakdown', y, margin, contentW, 58);
        if (y > pdf.internal.pageSize.getHeight() - 80) { pdf.addPage(); y = margin; }
        y = rcPdfAddChart(pdf, 'drivers', 'Call Drivers', y, margin, contentW, 58);
        if (y > pdf.internal.pageSize.getHeight() - 80) { pdf.addPage(); y = margin; }
        y = rcPdfAddChart(pdf, 'aging', 'SLA Distribution', y, margin, contentW, 58);

        pdf.save('Repeated_Calls_Report_' + new Date().toISOString().slice(0, 10) + '.pdf');
        rcToast('PDF report downloaded', 'success');
    } catch (e) {
        console.error('[RC] PDF export failed:', e);
        rcToast('PDF export failed — check console', 'error');
    } finally {
        if (chartState) rcRestoreChartsVisibility(chartState.wasHidden);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<i data-lucide="file-down" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Download PDF';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
};

// ============================================================
// ASSIGN QUEUE + ASSIGNED QUEUE (ag-Grid)
// ============================================================
function rcRenderAssignQueue(body) {
    if (!rcAllAgents.length) { body.innerHTML = rcErrBox('No agents with CTI found in Account Mapping.'); return; }
    var pendingAll = rcAssignQueueItems();
    var pending = rcApplyQueueFilters(pendingAll, rcAssignFilters, false, rcAssignDateFilters);
    body.innerHTML = rcQueueFilterBarHTML('assign', pendingAll) +
        '<div id="rcAssignMain">' +
        rcBulkBarHTML('assign') +
        rcGridSectionHTML('Assign Queue — Unique callers', 'rcAssignGrid', 'rcAssignCount', 'rcAssignSearch', 'rcExportAssignCsv()', pending.length) +
        '</div>';
    rcRenderGrid('assign', 'rcAssignGrid', 'rcAssignCount', pending, 'assign');
    rcBindMsOutsideClick();
    rcPopulateMainMsDropdowns('rcAssignF', pendingAll, rcAssignFilters, 'rcApplyAssignFilters');
    rcSafeUpdateDateFilterOptions('rcAssignF', pendingAll, 'rcApplyAssignFilters');
    rcSyncDateModeUI('rcAssignF');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function rcRenderAssignedQueue(body) {
    if (!rcAllAgents.length) { body.innerHTML = rcErrBox('No agents with CTI found in Account Mapping.'); return; }
    var assignedAll = rcAssignedQueueItems();
    var assigned = rcApplyQueueFilters(assignedAll, rcAssignedFilters, true, rcAssignedDateFilters);
    body.innerHTML = rcQueueFilterBarHTML('assigned', assignedAll) +
        '<div id="rcAssignedMain">' +
        rcBulkBarHTML('reassign') +
        rcGridSectionHTML('Assigned Queue — In Progress callers', 'rcAssignedGrid', 'rcAssignedCount', 'rcAssignedSearch', 'rcExportAssignedCsv()', assigned.length) +
        '</div>';
    rcRenderGrid('assigned', 'rcAssignedGrid', 'rcAssignedCount', assigned, 'assigned');
    rcBindMsOutsideClick();
    rcPopulateMainMsDropdowns('rcAssignedF', assignedAll, rcAssignedFilters, 'rcApplyAssignedFilters');
    rcSafeUpdateDateFilterOptions('rcAssignedF', assignedAll, 'rcApplyAssignedFilters');
    rcSyncDateModeUI('rcAssignedF');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function rcDoAssign(pairs, isReassign) {
    pairs = rcExpandAssignPairs(pairs, isReassign);
    if (!pairs.length) { rcToast('Select rows and an agent', 'warn'); return; }
    var digest;
    try { digest = await rcGetDigest(); } catch (e) { rcToast('Digest error', 'error'); return; }

    rcShowBusy(isReassign ? 'Reassigning…' : 'Assigning…', '0 / ' + pairs.length);
    var agentUidCache = {};
    var result = await rcRunPool(pairs, async function (p) {
        var agent = rcAllAgents.find(function (a) { return a.name === p.agentName; });
        if (!agent) throw new Error('Agent not found');
        if (!agentUidCache[p.agentName]) {
            var uid = await rcResolveUserId(agent.email, agent.name);
            if (!uid) throw new Error('User id not found');
            agentUidCache[p.agentName] = uid;
        }
        var now = new Date().toISOString();
        var fields = rcSpFields({ AssignedToId: agentUidCache[p.agentName], RCStatus: RC_STATUS.INPROGRESS });
        if (isReassign) fields[RC_SP.REASSIGN] = now;
        else fields[RC_SP.ASSIGN] = now;
        await rcUpdateItem(p.id, fields, digest);
    }, {
        concurrency: RC_SP_CONCURRENCY,
        getDigest: function () { return digest; },
        setDigest: function (d) { digest = d; },
        onProgress: function (done, total) {
            rcShowBusy(isReassign ? 'Reassigning…' : 'Assigning…', done + ' / ' + total, (done / total) * 100);
        }
    });
    rcHideBusy();

    rcToast((isReassign ? 'Reassigned ' : 'Assigned ') + result.ok + (result.fail ? ', ' + result.fail + ' failed' : ''), result.fail ? 'warn' : 'success');
    await rcFetchItems(true);
    rcRenderTabBody();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.rcBulkAssign = function () {
    var name = (document.getElementById('rcBulkAgent') || {}).value;
    if (!name) { rcToast('Pick an agent', 'warn'); return; }
    var rows = rcGetSelectedRows('assign');
    if (!rows.length) { rcToast('Select at least one row', 'warn'); return; }
    rcDoAssign(rows.map(function (r) { return { id: r.id, agentName: name }; }), false);
};

window.rcBulkReassign = function () {
    var name = (document.getElementById('rcBulkAgent') || {}).value;
    if (!name) { rcToast('Pick an agent', 'warn'); return; }
    var rows = rcGetSelectedRows('assigned');
    if (!rows.length) { rcToast('Select at least one row', 'warn'); return; }
    rcDoAssign(rows.map(function (r) { return { id: r.id, agentName: name }; }), true);
};

// ============================================================
// UPLOAD
// ============================================================
window.rcParseFile = function (ev) {
    var file = ev.target.files && ev.target.files[0], prev = document.getElementById('rcUploadPreview');
    if (!file || typeof XLSX === 'undefined') return;
    if (prev) prev.innerHTML = rcSpinnerBlock('Reading file…', file.name);
    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            if (prev) prev.innerHTML = rcSpinnerBlock('Parsing Excel…', 'Processing rows');
            var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            rcUploadRows = [];
            var sheet = wb.Sheets[wb.SheetNames[0]];
            var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false });
            if (!aoa.length) throw new Error('Empty workbook');
            var headers = aoa[0].map(function (h) { return String(h || '').trim(); });
            var colMap = RC_EXCEL_HEADERS.map(function (excelH, i) {
                var idx = headers.indexOf(excelH);
                return { idx: idx, spKey: RC_COLS[i].key };
            });
            for (var r = 1; r < aoa.length; r++) {
                var row = aoa[r]; if (!row || !row.length) continue;
                var rec = {};
                colMap.forEach(function (m) {
                    if (m.idx >= 0) rec[m.spKey] = row[m.idx] != null ? String(row[m.idx]).trim() : '';
                });
                if (rec.Call_Date && rec.Call_DateTime === '' && rec.Call_Date) rec.Call_DateTime = rec.Call_Date;
                if (rec.MSISDN && rec.Call_DateTime) rcUploadRows.push(rec);
            }
            rcRenderUploadPreview();
        } catch (err) {
            if (prev) prev.innerHTML = rcErrBox(rcEsc(err.message));
        }
    };
    reader.onerror = function () {
        if (prev) prev.innerHTML = rcErrBox('Could not read the selected file.');
    };
    reader.readAsArrayBuffer(file);
    ev.target.value = '';
};

function rcRenderUploadPreview() {
    var prev = document.getElementById('rcUploadPreview');
    var result = rcProcessUploadRows(rcUploadRows);
    var toAdd = result.toAdd;
    var ignored = result.ignored;
    rcUploadRows._toAdd = toAdd;
    rcUploadRows._ignored = ignored;
    var unmapped = 0;
    toAdd.forEach(function (rec) { if (rec.Agent_Name && !rcLookupCti(rec.Agent_Name)) unmapped++; });
    var reasonCounts = {};
    ignored.forEach(function (r) { reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1; });
    var reasonSummary = Object.keys(reasonCounts).map(function (k) {
        return '<b>' + reasonCounts[k] + '</b> · ' + rcEsc(k);
    }).join('<br>');
    prev.innerHTML = '<div style="font-size:.82rem;color:var(--t2);margin-bottom:.75rem;line-height:1.5;">' +
        '<b>' + toAdd.length + '</b> rows ready to upload (Enterprise · CC-SGS-Emtyaz · 3+ calls)' +
        (ignored.length ? '<br><span style="color:#dc2626;font-weight:700;">' + ignored.length + ' rows ignored</span>' : '') +
        (unmapped ? '<br><b style="color:#f59e0b;">' + unmapped + '</b> CTI not mapped in upload batch' : '') +
        (reasonSummary ? '<div style="margin-top:.5rem;font-size:.76rem;color:var(--t3);">' + reasonSummary + '</div>' : '') +
        '</div>' +
        (toAdd.length ? '<button type="button" class="export-btn" id="rcConfirmUploadBtn" onclick="rcConfirmUpload()">Confirm Upload (' + toAdd.length + ')</button>' : '<div style="color:var(--t3);">Nothing qualifies for upload. Check ignored rows below.</div>') +
        rcUploadIgnoredTableHTML(ignored) +
        '<div id="rcUploadProgress" style="margin-top:.75rem;"></div>';
}

window.rcConfirmUpload = async function () {
    var toAdd = rcUploadRows._toAdd || [];
    if (!toAdd.length) return;

    var btn = document.getElementById('rcConfirmUploadBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

    var digest, entityType, now = new Date().toISOString();
    try {
        digest = await rcGetDigest();
        entityType = await rcGetEntityType();
    } catch (e) {
        rcToast('Digest error', 'error');
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        return;
    }

    var payloads = toAdd.map(function (rec) {
        var key = rcCallKey(rec);
        var fields = rcSpFields({ Title: key, RCStatus: RC_STATUS.PENDING, UploadDate: now });
        RC_COLS.forEach(function (col) {
            if (col.key === 'Call_DateTime') {
                fields[col.key] = rcExcelSerialToIso(rec[col.key]) || rec[col.key] || '';
            } else {
                fields[col.key] = rec[col.key] || '';
            }
        });
        return fields;
    });

    rcShowBusy('Uploading to SharePoint…', '0 / ' + payloads.length, 0);
    var result = await rcRunPool(payloads, function (fields) {
        return rcCreateItem(fields, digest, entityType);
    }, {
        concurrency: RC_SP_CONCURRENCY,
        getDigest: function () { return digest; },
        setDigest: function (d) { digest = d; },
        onProgress: function (done, total) {
            rcShowBusy('Uploading to SharePoint…', done + ' / ' + total + ' calls', (done / total) * 100);
        }
    });
    rcHideBusy();

    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    rcToast('Uploaded ' + result.ok + ' calls' + (result.fail ? ' (' + result.fail + ' failed)' : ''), result.fail ? 'warn' : 'success');
    await rcFetchItems(true);
    rcRenderTabBody();
};

function rcErrBox(msg) {
    return '<div style="background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:12px;font-size:.8rem;font-weight:600;">' + msg + '</div>';
}

// ============================================================
// MY QUEUE (Agent)
// ============================================================
function rcRenderMyQueue(body) {
    var mine = rcApplyDateFilters(rcScopedItems(), rcDateFilters);
    var s = rcSummary(mine);
    var inq = rcDedupeUniqueCallers(mine.filter(function (it) {
        return rcIsRepeatMsisdn(it.MSISDN) && rcIsAssigned(it) && rcRowWorkflowStatus(it) === RC_STATUS.INPROGRESS;
    }));
    var resolvedUnique = rcDedupeUniqueCallers(mine.filter(function (it) {
        return rcIsRepeatMsisdn(it.MSISDN) && rcIsAssigned(it) && rcRowWorkflowStatus(it) === RC_STATUS.RESOLVED;
    }));

    body.innerHTML =
        rcDateFilterBarOnlyHTML('rcAgentF') +
        '<div id="rcMyQueueMain">' +
        '<div class="top-stats">' +
            rcTile('In Queue', inq.length, 'Unique repeat callers', rcStatusColor(RC_STATUS.INPROGRESS)) +
            rcTile('Resolved', resolvedUnique.length, 'Unique repeat callers', rcStatusColor(RC_STATUS.RESOLVED)) +
            rcTile('Total Assigned', inq.length + resolvedUnique.length, 'Unique callers', 'var(--acc)') +
            rcTile('Avg SLA', s.avgTtc + ' d', 'Assign/Reassign → done', 'var(--acc2)') +
        '</div>' +
        rcGridSectionHTML('My Queue — Unique callers', 'rcAgentQueueGrid', 'rcAgentQueueCount', 'rcAgentSearch', 'rcExportAgentQueueCsv()', inq.length) +
        rcGridSectionHTML('My Records', 'rcAgentGrid', 'rcAgentRecCount', 'rcAgentRecSearch', 'rcExportAgentRecordsCsv()', mine.length) +
        '</div>';

    rcRenderGrid('agentQueue', 'rcAgentQueueGrid', 'rcAgentQueueCount', inq, 'agentqueue');
    rcRenderGrid('agentRecords', 'rcAgentGrid', 'rcAgentRecCount', mine, 'records');
    rcBindMsOutsideClick();
    rcSafeUpdateDateFilterOptions('rcAgentF', rcScopedItems(), 'rcApplyAgentDateFilters');
    rcSyncDateModeUI('rcAgentF');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.rcResolve = async function (id) {
    var ids = rcExpandResolveIds(id);
    rcShowBusy('Updating…', 'Marking resolved');
    var digest;
    try { digest = await rcGetDigest(); } catch (e) { rcHideBusy(); rcToast('Digest error', 'error'); return; }
    try {
        var now = new Date().toISOString();
        for (var i = 0; i < ids.length; i++) {
            await rcUpdateItem(ids[i], rcSpFields({ RCStatus: RC_STATUS.RESOLVED, CompletedDate: now }), digest);
        }
        rcToast('Marked resolved' + (ids.length > 1 ? ' (' + ids.length + ' calls for this caller)' : ''), 'success');
        await rcFetchItems(true);
        rcRenderTabBody();
    } catch (e) { rcToast('Could not resolve', 'error'); }
    finally { rcHideBusy(); }
};
window.rcComplete = window.rcResolve;

window.rcReopen = async function (id) {
    if (!rcIsAdminLike()) { rcToast('Only admins can reopen activities', 'warn'); return; }
    var item = rcAllItems.find(function (it) { return it.ID === id; });
    if (!item || !rcIsResolvedStatus(item.RCStatus)) {
        rcToast('Only resolved activities can be reopened', 'warn');
        return;
    }
    var label = rcCallKey(item) || ('ID ' + id);
    if (!confirm('Reopen activity ' + label + '?\n\nIt will return to In Progress for the assigned agent.')) return;

    var digest;
    try { digest = await rcGetDigest(); } catch (e) { rcToast('Digest error', 'error'); return; }
    rcShowBusy('Reopening…', label);
    try {
        await rcUpdateItem(id, rcSpFields({ RCStatus: RC_STATUS.INPROGRESS, CompletedDate: null }), digest);
        rcToast('Activity reopened', 'success');
        await rcFetchItems(true);
        rcRenderTabBody();
    } catch (e) { rcToast('Could not reopen', 'error'); }
    finally { rcHideBusy(); }
};

window.rcDeleteRecord = async function (id) {
    if (!rcCanDeleteAll()) { rcToast('Only Tehleel and Ubaid can delete records', 'warn'); return; }
    var item = rcAllItems.find(function (it) { return it.ID === id; });
    var label = item ? (rcCallKey(item) || ('ID ' + id)) : ('ID ' + id);
    if (!confirm('Delete record ' + label + '?\n\nThis cannot be undone.')) return;

    var digest;
    try { digest = await rcGetDigest(); } catch (e) { rcToast('Digest error', 'error'); return; }
    rcShowBusy('Deleting…', label);
    try {
        await rcDeleteItem(id, digest);
        rcToast('Record deleted', 'success');
        await rcFetchItems(true);
        rcRenderTabBody();
    } catch (e) { rcToast('Could not delete record', 'error'); }
    finally { rcHideBusy(); }
};

window.rcDeleteAll = async function () {
    if (!rcCanDeleteAll()) { rcToast('Only Tehleel and Ubaid can delete all records', 'warn'); return; }
    var ids = rcAllItems.map(function (it) { return it.ID; }).filter(Boolean);
    if (!ids.length) { rcToast('No records to delete', 'warn'); return; }
    if (!confirm('Delete ALL ' + ids.length + ' records from Repeated Calls?\n\nThis permanently removes every row in the list.')) return;
    if (!confirm('Final confirmation: delete ' + ids.length + ' records? This cannot be undone.')) return;

    var digest;
    try { digest = await rcGetDigest(); } catch (e) { rcToast('Digest error', 'error'); return; }

    rcShowBusy('Deleting all records…', '0 / ' + ids.length, 0);
    var result = await rcRunPool(ids, function (id) {
        return rcDeleteItem(id, digest);
    }, {
        concurrency: RC_SP_CONCURRENCY,
        getDigest: function () { return digest; },
        setDigest: function (d) { digest = d; },
        onProgress: function (done, total) {
            rcShowBusy('Deleting all records…', done + ' / ' + total, (done / total) * 100);
        }
    });
    rcHideBusy();

    rcToast('Deleted ' + result.ok + ' record' + (result.ok !== 1 ? 's' : '') + (result.fail ? ' (' + result.fail + ' failed)' : ''), result.fail ? 'warn' : 'success');
    await rcFetchItems(true);
    rcRenderTabBody();
};

// ============================================================
// DUMMY DATA
// ============================================================
function rcDummyAgents() {
    return [
        { name: 'Sanskar', email: 'sanskar@du.ae', team: 'DSM', cti: '14215' },
        { name: 'Hussain', email: 'hussain@du.ae', team: 'TSM_ME', cti: '15310' },
        { name: 'Ameena', email: 'ameena@du.ae', team: 'TSM_SE', cti: '14193' }
    ];
}

function rcDummyItems() {
    var lobs = ['188-SGS-Fix-Prem', '188-SGS-Mob-Prem', '188-SGS-Mob-Mass'];
    var langs = ['English', 'Arabic'];
    var agents = ['Sanskar', 'Hussain', 'Ameena'];
    var out = [];
    for (var i = 0; i < 40; i++) {
        var st = i % 3 === 0 ? RC_STATUS.PENDING : (i % 3 === 1 ? RC_STATUS.INPROGRESS : RC_STATUS.RESOLVED);
        var up = new Date(Date.now() - (i + 2) * 86400000).toISOString();
        var asg = st !== RC_STATUS.PENDING ? new Date(Date.now() - (i + 1) * 86400000).toISOString() : null;
        var rea = (st === RC_STATUS.INPROGRESS && i % 5 === 0) ? new Date(Date.now() - i * 86400000).toISOString() : null;
        var cmp = rcIsResolvedStatus(st) ? new Date(Date.now() - i * 86400000).toISOString() : null;
        var msisdn = '9715' + (1000000 + i);
        var dt = String(46259 + (i * 0.001));
        out.push(rcNormalizeItem({
            ID: i + 1,
            MSISDN: msisdn,
            Call_Date: '46259',
            Call_DateTime: dt,
            Site: 'CC-SGS-Emtyaz',
            skill_group_enterprisename: 'CF188_Fix_SGS_Prem_En',
            Language: langs[i % 2],
            Customer_Type: 'Enterprise',
            Agent_Name: '14215',
            Talk_Time: String(100 + i),
            Hold_Time: '0',
            WrapUp_Time: '0',
            Customer_Value: 'Gold',
            Handling_Time: String(100 + i),
            Market_For_Weekly_Score_Card: '188 Enterprise Fixed Prem',
            SIEBEL_ID: '',
            KB_ID: '',
            Segment_Value: 'Prem',
            LOB: lobs[i % 3],
            RC_Status: st,
            Upload_Date: up,
            Assignment_Date: asg,
            Reassign_Date: rea,
            Resolved_Date: cmp,
            AssignedToName: st === RC_STATUS.PENDING ? '' : agents[i % 3],
            AssignedToEmail: ''
        }));
    }
    return out;
}
