// occ-search.js v6 — SM dashboard only; OCC data read through hidden bridge page
// Cross-origin REST/JSOM from 8086 to 8081 always 401s on the CORS preflight,
// so the actual SharePoint calls run inside a 0px iframe served from the OCC site.

(function () {
    'use strict';

    var OCC_SP_SITE = 'http://sharedspaces:8081/sites/OCC';
    var OCC_CCO_THRESHOLD = 250000;

    var OCC_ALL_ITEMS = null;
    var OCC_ALL_LOADING = null;

    var OCC_BRIDGE_ORIGIN = 'http://sharedspaces:8081';
    var OCC_BRIDGE_URL = OCC_SP_SITE + '/SitePages/occ-search-bridge.aspx';
    var OCC_BRIDGE_READY = null;

    var OCC_F = {
        ACC_CODE: 'Title',
        ACC_NAME: 'Account_x0020_Name',
        REQUESTOR: 'From',
        REF: 'OCC_x0020_Reference_x0020_No',
        STATUS: 'Status',
        PORTAL_STATUS: 'OCC_x0020_Status',
        VALUE: 'Total_x0020_OCC_x0020_Value',
        SUBJECT: 'Subject',
        VERTICAL: 'Vertical',
        REASON: 'TypeOfIssue',
        AM: 'SalesDirectorName',
        CREATED: 'Created',
        POSTED: 'Posted_Date',
        REJECTED: 'RejectedReason',
        TROUBLE: 'Trouble_x0020_Ticket',
        URL: 'Item_x0020_Url',
        HANDSET: 'Handset',
        HANDSETS: 'No_of_Handsets'
    };

    // Exact copy from occ.html APPROVAL_STEPS
    var OCC_APPROVAL_STEPS = [
        { key: 'sd', label: 'Sales Director', statusField: 'Sales_x0020_Director_x0020_Appro', tsField: 'Sales_x0020_Director_x0020_Appro0', personField: 'SalesDirectorName' },
        { key: 'hd', label: 'Head Director', statusField: 'Head_x0020_Director_x0020_Approv', tsField: 'Head_x0020_Dir_x0020_Approval_x0', textField: 'Head_x0020_Director_x0020_Text' },
        { key: 'cm', label: 'Channel Manager Validation', statusField: 'Channel_x0020_Manager_x0020_Vali', tsField: 'Channel_x0020_Manager_x0020_Vali0', textField: 'Channel_x0020_Manager_x0020_Text' },
        { key: 'cd', label: 'Channel Director', statusField: 'Channel_x0020_Director_x0020_App', tsField: 'Channel_x0020_Director_x0020_App1', textField: 'Channel_x0020_Director_x0020_Tex' },
        { key: 'pipeline', label: 'Director Enterprise Pipeline & Control', statusField: 'Channel_x0020_Director_x0020_App0', tsField: 'Head_x0020_of_x0020_Bid_x0020__x', textField: 'Bid_x0020_Director_x0020_Text' },
        { key: 'hm', label: 'Head Of Marketing', statusField: 'field11', tsField: 'field12' },
        { key: 'he', label: 'Head of Enterprise Approval', statusField: 'Head_x0020_of_x0020_Gov_x0020_LE', tsField: 'Head_x0020_of_x0020_Gov_x0020_LE0' },
        { key: 'le', label: 'Head of Enterprise', statusField: 'Head_x0020_of_x0020_LE_x002c__x0', autoOnHm: true },
        { key: 'cco', label: 'CCCO', statusField: 'CCO_x0020_Approval', tsField: 'CCOTimestamp', minValue: OCC_CCO_THRESHOLD }
    ];

    // Exact copy from occ.html SP_SELECT_FIELDS
    var OCC_CORE_SELECT = [
        'Id', 'Title', 'Account_x0020_Name', 'Vertical', 'TypeOfIssue', 'Total_x0020_OCC_x0020_Value',
        'OCC_x0020_Reference_x0020_No', 'Status', 'OCC_x0020_Status', 'Created', 'Posted_Date',
        'Handset', 'No_of_Handsets', 'SalesDirectorName', 'Subject', 'RejectedReason',
        'Business_x0020_Justification', 'Annual_x0020_Revenue', 'Source', 'Services', 'ProductFamily', 'ProductCategory',
        'Trouble_x0020_Ticket', 'Sales_x0020_Comments', 'Marketing_x0020_Comments',
        'Sales_x0020_Director_x0020_Appro', 'Sales_x0020_Director_x0020_Appro0',
        'Head_x0020_Director_x0020_Approv', 'Head_x0020_Dir_x0020_Approval_x0', 'Head_x0020_Director_x0020_Text',
        'Channel_x0020_Manager_x0020_Vali', 'Channel_x0020_Manager_x0020_Vali0', 'Channel_x0020_Manager_x0020_Text',
        'Channel_x0020_Director_x0020_App', 'Channel_x0020_Director_x0020_App1', 'Channel_x0020_Director_x0020_Tex',
        'Channel_x0020_Director_x0020_App0', 'Head_x0020_of_x0020_Bid_x0020__x', 'Bid_x0020_Director_x0020_Text',
        'field11', 'field12', 'Head_x0020_of_x0020_Gov_x0020_LE', 'Head_x0020_of_x0020_Gov_x0020_LE0',
        'Head_x0020_of_x0020_LE_x002c__x0', 'CCO_x0020_Approval', 'CCOTimestamp', 'CCOLabel'
    ];

    // Person/Group — expand only (occ.html SP_EXPAND)
    var OCC_EXPAND = ['From', 'Channel_x0020_Manager_x0020_Name'];
    var OCC_EXPAND_SELECT = ['From/Title', 'From/EMail', 'Channel_x0020_Manager_x0020_Name/Title'];

    // Extra columns for read-only detail panel (not in occ.html bulk load)
    var OCC_DETAIL_EXTRA = [
        'Mail_x0020_Status_x0020_SD', 'Mail_x0020_Status_x0020_HD', 'Mail_x0020_Status_x0020_CD',
        'Mail_x0020_Status_x0020_AM', 'Mail_x0020_Status_x0020_PD', 'Mail_x0020_Status',
        'Assigned_x0020_to_x0020_AM_x0020', 'other_x0020__x002d__x0020_Type_x', 'Item_x0020_Url',
        'CO_TL_Assigned_Date', 'GOv_x0020_LE_x0020_Head_x0020_Te'
    ];

    var OCC_DETAIL_GROUPS = [
        {
            title: 'Account & Request',
            fields: [
                ['OCC Reference No', 'OCC_x0020_Reference_x0020_No'],
                ['Account Code', 'Title'],
                ['Account Name', 'Account_x0020_Name'],
                ['Requestor', 'From'],
                ['Subject', 'Subject'],
                ['Trouble Ticket', 'Trouble_x0020_Ticket'],
                ['Type Of Issue', 'TypeOfIssue'],
                ['Other - Type of Issue', 'other_x0020__x002d__x0020_Type_x'],
                ['Vertical', 'Vertical'],
                ['Source', 'Source'],
                ['Posted Date', 'Posted_Date'],
                ['Created', 'Created'],
                ['CO TL Assigned Date', 'CO_TL_Assigned_Date']
            ]
        },
        {
            title: 'Financial',
            fields: [
                ['Total OCC Value', 'Total_x0020_OCC_x0020_Value'],
                ['Annual Revenue', 'Annual_x0020_Revenue'],
                ['Handset', 'Handset'],
                ['No of Handsets', 'No_of_Handsets']
            ]
        },
        {
            title: 'Product & Services',
            fields: [
                ['Product Family', 'ProductFamily'],
                ['Product Category', 'ProductCategory'],
                ['Services', 'Services']
            ]
        },
        {
            title: 'Status',
            fields: [
                ['Status', 'Status'],
                ['OCC Status', 'OCC_x0020_Status'],
                ['Rejected Reason', 'RejectedReason'],
                ['Assigned to AM by CM', 'Assigned_x0020_to_x0020_AM_x0020'],
                ['Sales Director Name', 'SalesDirectorName']
            ]
        },
        {
            title: 'Comments',
            fields: [
                ['Business Justification', 'Business_x0020_Justification'],
                ['Sales Comments', 'Sales_x0020_Comments'],
                ['Marketing Comments', 'Marketing_x0020_Comments']
            ]
        },
        {
            title: 'Mail Status',
            fields: [
                ['Mail Status SD', 'Mail_x0020_Status_x0020_SD'],
                ['Mail Status HD', 'Mail_x0020_Status_x0020_HD'],
                ['Mail Status CD', 'Mail_x0020_Status_x0020_CD'],
                ['Mail Status AM', 'Mail_x0020_Status_x0020_AM'],
                ['Mail Status PD', 'Mail_x0020_Status_x0020_PD'],
                ['Mail Status CM', 'Mail_x0020_Status']
            ]
        }
    ];

    var OCC_SEARCH = {
        results: [],
        gridApi: null,
        shellReady: false,
        activeItem: null
    };

    function occEsc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function occNum(v) {
        var n = parseFloat(String(v || '').replace(/,/g, ''));
        return isNaN(n) ? 0 : n;
    }

    function occFmtCurrency(v) {
        var n = occNum(v);
        return 'AED ' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function occFmtDate(val) {
        if (!val) return '—';
        var d = val instanceof Date ? val : new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function occFmtDateTime(val) {
        if (!val) return '—';
        var d = val instanceof Date ? val : new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function occPlain(val) {
        if (val == null || val === '') return '';
        if (typeof val === 'object') {
            if (val.results && val.results.length) return occPlain(val.results[0]);
            if (val.Title) return val.Title;
            return '';
        }
        return String(val).trim();
    }

    function occODataEscape(term) {
        return String(term || '').replace(/'/g, "''");
    }

    function occNormStatus(s) {
        var v = String(s || '').trim().toLowerCase();
        if (!v || v === 'pending' || v === '—') return 'pending';
        if (v.indexOf('reject') !== -1) return 'rejected';
        if (v.indexOf('approv') !== -1 || v.indexOf('valid') !== -1 || v.indexOf('not required') !== -1 || v === 'completed') return 'approved';
        return v;
    }

    function occRequiredSteps(raw) {
        var value = occNum(raw[OCC_F.VALUE]);
        return OCC_APPROVAL_STEPS.filter(function (s) {
            return !s.minValue || value >= s.minValue;
        });
    }

    function occStepStatus(raw, step, allSteps) {
        var status = occNormStatus(raw[step.statusField]);
        if (step.autoOnHm && allSteps) {
            var hm = allSteps.find(function (s) { return s.key === 'hm'; });
            if (hm && occNormStatus(raw[hm.statusField]) === 'approved') status = 'approved';
        }
        return status;
    }

    function occPortalStatus(raw) {
        var steps = occRequiredSteps(raw);
        var i;
        for (i = 0; i < steps.length; i++) {
            if (occNormStatus(raw[steps[i].statusField]) === 'rejected') return 'Closed Rejected';
        }
        if (raw[OCC_F.REJECTED]) return 'Closed Rejected';
        var allDone = steps.every(function (s) { return occStepStatus(raw, s, steps) === 'approved'; });
        return allDone ? 'Closed Approved' : 'Open';
    }

    function occStuckAt(raw) {
        if (occPortalStatus(raw) !== 'Open') return '—';
        var steps = occRequiredSteps(raw);
        for (var i = 0; i < steps.length; i++) {
            if (occStepStatus(raw, steps[i], steps) === 'pending') return steps[i].label;
        }
        return 'Pending';
    }

    function occMapItem(raw) {
        var item = {
            id: raw.Id || raw.ID,
            accountCode: occPlain(raw[OCC_F.ACC_CODE]) || '—',
            accountName: occPlain(raw[OCC_F.ACC_NAME]) || '—',
            requestor: (raw.From && raw.From.Title) || occPlain(raw.From) || '—',
            ref: occPlain(raw[OCC_F.REF]) || '—',
            subject: occPlain(raw[OCC_F.SUBJECT]) || '—',
            status: occPlain(raw[OCC_F.STATUS]) || '—',
            occStatus: occPlain(raw[OCC_F.PORTAL_STATUS]) || '—',
            value: occNum(raw[OCC_F.VALUE]),
            vertical: occPlain(raw[OCC_F.VERTICAL]) || '—',
            issueType: occPlain(raw[OCC_F.REASON]) || '—',
            am: occPlain(raw[OCC_F.AM]) || '—',
            created: raw[OCC_F.CREATED] || '',
            posted: raw[OCC_F.POSTED] || raw[OCC_F.CREATED] || '',
            portalStatus: occPortalStatus(raw),
            stuckAt: occStuckAt(raw),
            _raw: raw
        };
        var start = item.posted || item.created;
        item.daysOpen = start ? Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 86400000)) : null;
        return item;
    }

    function occBridgeInit() {
        if (OCC_BRIDGE_READY) return OCC_BRIDGE_READY;
        OCC_BRIDGE_READY = new Promise(function (resolve, reject) {
            var iframe = document.createElement('iframe');
            iframe.setAttribute('title', 'OCC data bridge');
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;border:0;';
            iframe.src = OCC_BRIDGE_URL + '?t=' + Date.now();

            var settled = false;
            var timer = setTimeout(function () {
                if (settled) return;
                settled = true;
                window.removeEventListener('message', onReady);
                OCC_BRIDGE_READY = null;
                reject(new Error('OCC data bridge did not respond — check that occ-search-bridge.aspx exists in the OCC site SitePages library'));
            }, 60000);

            function onReady(ev) {
                if (ev.origin !== OCC_BRIDGE_ORIGIN) return;
                if (!ev.data || ev.data.type !== 'occ-bridge' || ev.data.action !== 'ready') return;
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                window.removeEventListener('message', onReady);
                resolve(iframe);
            }

            window.addEventListener('message', onReady);
            document.body.appendChild(iframe);
        });
        return OCC_BRIDGE_READY;
    }

    function occBridgeRequest(action, payload) {
        return occBridgeInit().then(function (iframe) {
            return new Promise(function (resolve, reject) {
                var requestId = 'occ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
                var timer = setTimeout(function () {
                    window.removeEventListener('message', onResp);
                    reject(new Error('OCC data request timed out'));
                }, 180000);

                function onResp(ev) {
                    if (ev.origin !== OCC_BRIDGE_ORIGIN) return;
                    var d = ev.data;
                    if (!d || d.type !== 'occ-bridge' || d.requestId !== requestId) return;
                    clearTimeout(timer);
                    window.removeEventListener('message', onResp);
                    if (d.error) reject(new Error(d.error));
                    else resolve(d.result);
                }

                window.addEventListener('message', onResp);
                iframe.contentWindow.postMessage({
                    type: 'occ-bridge',
                    action: action,
                    requestId: requestId,
                    payload: payload || {}
                }, OCC_BRIDGE_ORIGIN);
            });
        });
    }

    function occEnsureAllItems() {
        if (OCC_ALL_ITEMS) return Promise.resolve(OCC_ALL_ITEMS);
        if (OCC_ALL_LOADING) return OCC_ALL_LOADING;
        OCC_ALL_LOADING = occBridgeRequest('loadAll').then(function (rows) {
            OCC_ALL_ITEMS = rows || [];
            OCC_ALL_LOADING = null;
            return OCC_ALL_ITEMS;
        }, function (e) {
            OCC_ALL_LOADING = null;
            throw e;
        });
        return OCC_ALL_LOADING;
    }

    async function occFetchItemById(itemId) {
        if (OCC_ALL_ITEMS) {
            var cached = OCC_ALL_ITEMS.find(function (r) { return r.Id === itemId || r.ID === itemId; });
            if (cached) {
                try {
                    var fresh = await occBridgeRequest('getItem', { itemId: itemId });
                    if (fresh) return fresh;
                } catch (e) {
                    console.warn('[OCC Search] detail refresh failed, using cached row', e);
                }
                return cached;
            }
        }
        return occBridgeRequest('getItem', { itemId: itemId });
    }

    function occSmUrl() {
        return (typeof SP_URL !== 'undefined' && SP_URL) ? SP_URL : 'http://sharedspaces:8086/sites/SM';
    }

    function occParseYesNo(val) {
        if (!val) return false;
        if (val === true || val === 'Yes' || val === 'yes') return true;
        if (val.results) return val.results.indexOf('Yes') !== -1;
        return false;
    }

    async function occRefreshAccessFlag() {
        var email = ((window.USER_CONTEXT && USER_CONTEXT.userEmail) || '').toLowerCase();
        var enabled = false;
        if (!email) {
            window.USER_CONTEXT = window.USER_CONTEXT || {};
            USER_CONTEXT.occSearchEnabled = false;
            occUpdateLandingButton(false);
            return false;
        }
        try {
            var accessList = (typeof SP_ACCESS_LIST !== 'undefined' && SP_ACCESS_LIST) ? SP_ACCESS_LIST : 'Access_Control';
            var url = occSmUrl() + "/_api/web/lists/getbytitle('" + accessList + "')/items?" +
                "$select=UserEmailID,OCC_SEARCH&$filter=UserEmailID eq '" + occODataEscape(email) + "'&$top=1";
            var res = await fetch(url, {
                headers: { Accept: 'application/json;odata=verbose' },
                credentials: 'include'
            });
            if (res.ok) {
                var data = await res.json();
                if (data.d.results.length) enabled = occParseYesNo(data.d.results[0].OCC_SEARCH);
            }
        } catch (e) {
            console.warn('[OCC Search] access flag failed', e);
        }
        window.USER_CONTEXT = window.USER_CONTEXT || {};
        USER_CONTEXT.occSearchEnabled = enabled;
        occUpdateLandingButton(enabled);
        return enabled;
    }

    function occUpdateLandingButton(enabled) {
        var btn = document.getElementById('goToOccSearch');
        if (!btn) return;
        btn.style.display = enabled ? 'flex' : 'none';
        btn.disabled = !enabled;
    }

    async function occSearchItems(searchType, term) {
        var q = term.trim();
        if (!q) return [];

        // occ.html loads all items once, then filters client-side — same here
        var all = await occEnsureAllItems();
        var qLower = q.toLowerCase();

        if (searchType === 'account') {
            return all.filter(function (r) {
                return String(r.Title || '').toLowerCase().indexOf(qLower) !== -1;
            });
        }

        if (searchType === 'customer') {
            return all.filter(function (r) {
                return String(r.Account_x0020_Name || '').toLowerCase().indexOf(qLower) !== -1;
            });
        }

        return all.filter(function (r) {
            return occPlain(r[OCC_F.REF]).toLowerCase().indexOf(qLower) !== -1;
        });
    }

    function occRenderShell() {
        var root = document.getElementById('occSearchRoot');
        if (!root) return;
        root.innerHTML =
            '<div class="table-section" style="margin-bottom:24px;">' +
                '<h3 class="table-title" style="margin-bottom:20px;"><i data-lucide="file-search" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Search OCC Records</h3>' +
                '<div style="display:grid;grid-template-columns:180px 1fr auto auto;gap:12px;align-items:end;max-width:980px;">' +
                    '<div class="filter-group"><label class="filter-label">Search By</label>' +
                        '<select class="filter-select" id="occSearchType" style="font-size:14px;padding:12px 16px;">' +
                            '<option value="account">Account Code</option>' +
                            '<option value="ref">OCC Reference No</option>' +
                            '<option value="customer">Customer / Account Name</option>' +
                        '</select></div>' +
                    '<div class="filter-group"><label class="filter-label">Search Term *</label>' +
                        '<input type="text" class="filter-select" id="occSearchTerm" placeholder="Enter account code, OCC ref, or customer name..." style="font-size:14px;padding:12px 16px;" onkeydown="if(event.key===\'Enter\')occRunSearch()"></div>' +
                    '<button type="button" class="export-btn" onclick="occRunSearch()" style="padding:12px 24px;font-size:14px;"><i data-lucide="search" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Search</button>' +
                    '<button type="button" class="reset-btn" onclick="occClearSearch()" style="padding:12px 24px;font-size:14px;"><i data-lucide="x" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Clear</button>' +
                '</div>' +
                '<div id="occSearchError" style="display:none;margin-top:16px;padding:16px;background:rgba(239,68,68,.1);border-left:4px solid #ef4444;border-radius:8px;font-weight:600;color:#ef4444;"></div>' +
            '</div>' +
            '<div class="table-section" id="occResultsSection" style="display:none;margin-bottom:24px;">' +
                '<div class="table-header"><h3 class="table-title"><i data-lucide="list" style="width:20px;height:20px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>OCC Results</h3>' +
                '<div class="table-actions"><span id="occResultCount" style="font-size:13px;color:var(--t3);font-weight:600;"></span></div></div>' +
                '<div id="occResultsGrid" class="ag-theme-alpine" style="height:520px;width:100%;"></div>' +
            '</div>' +
            '<div class="table-section" id="occDetailSection" style="display:none;">' +
                '<div class="table-header"><h3 class="table-title"><i data-lucide="eye" style="width:20px;height:20px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>OCC Form Details <span style="font-size:12px;color:var(--t3);font-weight:600;">(Read Only)</span></h3></div>' +
                '<div id="occDetailSummary" style="margin-bottom:20px;"></div>' +
                '<div id="occDetailTimeline" style="margin-bottom:20px;"></div>' +
                '<div id="occDetailFields"></div>' +
            '</div>';
        OCC_SEARCH.shellReady = true;
    }

    function occStatusColor(status) {
        if (status === 'Closed Approved') return '#10b981';
        if (status === 'Closed Rejected') return '#ef4444';
        if (status === 'Open') return '#f97316';
        return '#6366f1';
    }

    function occRenderGrid(rows) {
        var gridDiv = document.getElementById('occResultsGrid');
        if (!gridDiv || typeof agGrid === 'undefined') return;
        if (OCC_SEARCH.gridApi) {
            OCC_SEARCH.gridApi.destroy();
            OCC_SEARCH.gridApi = null;
        }
        gridDiv.innerHTML = '';

        var columnDefs = [
            { field: 'ref', headerName: 'OCC Ref', pinned: 'left', width: 140, cellStyle: { fontWeight: '700' } },
            { field: 'accountCode', headerName: 'Account Code', width: 140 },
            { field: 'accountName', headerName: 'Account Name', width: 200 },
            { field: 'subject', headerName: 'Subject', width: 240 },
            { field: 'value', headerName: 'OCC Value', width: 130, valueFormatter: function (p) { return occFmtCurrency(p.value); } },
            { field: 'vertical', headerName: 'Vertical', width: 110 },
            { field: 'issueType', headerName: 'Issue Type', width: 130 },
            { field: 'portalStatus', headerName: 'Workflow Status', width: 150,
                cellRenderer: function (p) {
                    var c = occStatusColor(p.value);
                    return '<span class="status-badge" style="background:' + c + '22;color:' + c + ';font-weight:700;">' + occEsc(p.value) + '</span>';
                } },
            { field: 'stuckAt', headerName: 'Stuck At', width: 220,
                cellRenderer: function (p) {
                    if (!p.value || p.value === '—') return '<span style="color:var(--t3);">—</span>';
                    return '<span style="color:#ef4444;font-weight:700;">' + occEsc(p.value) + '</span>';
                } },
            { field: 'daysOpen', headerName: 'Days Open', width: 110,
                cellRenderer: function (p) {
                    if (p.value == null) return '—';
                    var color = p.value > 14 ? '#ef4444' : p.value > 7 ? '#f97316' : '#10b981';
                    return '<span style="font-weight:700;color:' + color + ';">' + p.value + 'd</span>';
                } },
            { field: 'occStatus', headerName: 'OCC Status', width: 130 },
            { field: 'am', headerName: 'Sales Director', width: 150 },
            { field: 'posted', headerName: 'Posted', width: 120, valueFormatter: function (p) { return occFmtDate(p.value); } },
            { field: 'actions', headerName: 'Action', width: 100, pinned: 'right', sortable: false, filter: false,
                cellRenderer: function (p) {
                    return '<button type="button" class="export-btn" style="padding:5px 10px;font-size:12px;" onclick="occShowDetail(' + p.data.id + ')">View</button>';
                } }
        ];

        agGrid.createGrid(gridDiv, {
            columnDefs: columnDefs,
            rowData: rows,
            defaultColDef: { sortable: true, filter: true, resizable: true },
            pagination: true,
            paginationPageSize: 25,
            rowHeight: 48,
            onGridReady: function (params) { OCC_SEARCH.gridApi = params.api; },
            onRowClicked: function (e) { if (e.data && e.data.id) occShowDetail(e.data.id); }
        });
    }

    function occFieldValue(raw, field) {
        if (!field) return '—';
        var val = raw[field];
        if (field === 'From') {
            if (val && val.Title) return val.Title;
            return occPlain(val) || '—';
        }
        if (field.indexOf('Date') !== -1 || field.indexOf('Timestamp') !== -1 || field === 'Created' || field === 'CCOTimestamp') {
            return occFmtDateTime(val) || '—';
        }
        if (field === 'Total_x0020_OCC_x0020_Value' || field === 'Annual_x0020_Revenue') {
            return val != null && val !== '' ? occFmtCurrency(val) : '—';
        }
        if (field === 'Business_x0020_Justification' || field === 'Sales_x0020_Comments') {
            var text = occPlain(val);
            return text || '—';
        }
        return occPlain(val) || '—';
    }

    function occRenderTimeline(raw) {
        var steps = occRequiredSteps(raw);
        var html = '<div class="edit-revenue-card" style="padding:18px;"><div style="font-size:13px;font-weight:800;margin-bottom:14px;color:var(--t1);">Approval Pipeline</div><div style="display:flex;flex-direction:column;gap:10px;">';
        steps.forEach(function (step) {
            var status = occStepStatus(raw, step, steps);
            var person = (step.personField && occPlain(raw[step.personField])) || (step.textField && occPlain(raw[step.textField])) || '—';
            var ts = raw[step.tsField] ? occFmtDateTime(raw[step.tsField]) : '—';
            var color = status === 'approved' ? '#10b981' : status === 'rejected' ? '#ef4444' : '#f97316';
            var icon = status === 'approved' ? 'check-circle' : status === 'rejected' ? 'x-circle' : 'clock';
            html += '<div style="display:grid;grid-template-columns:220px 120px 1fr 170px;gap:12px;align-items:center;padding:12px;border-radius:10px;background:rgba(99,102,241,.06);border:1px solid var(--border);">' +
                '<div style="font-weight:700;font-size:13px;">' + occEsc(step.label) + '</div>' +
                '<div><span class="status-badge" style="background:' + color + '22;color:' + color + ';font-weight:700;text-transform:capitalize;"><i data-lucide="' + icon + '" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>' + occEsc(status) + '</span></div>' +
                '<div style="font-size:12px;color:var(--t2);">' + occEsc(person) + '</div>' +
                '<div style="font-size:12px;color:var(--t3);">' + occEsc(ts) + '</div></div>';
        });
        html += '</div></div>';
        return html;
    }

    async function occShowDetail(itemId) {
        var item = OCC_SEARCH.results.find(function (r) { return r.id === itemId; });
        try {
            var freshRaw = await occFetchItemById(itemId);
            if (freshRaw) {
                item = occMapItem(freshRaw);
                var idx = OCC_SEARCH.results.findIndex(function (r) { return r.id === itemId; });
                if (idx >= 0) OCC_SEARCH.results[idx] = item;
            }
        } catch (e) {
            console.warn('[OCC Search] detail refresh failed, using cached row', e);
        }
        if (!item) return;
        OCC_SEARCH.activeItem = item;
        var raw = item._raw;

        var summary = '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;">' +
            '<div style="padding:14px;border-radius:12px;background:rgba(168,85,247,.08);"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;">OCC Ref</div><div style="font-size:16px;font-weight:800;margin-top:4px;">' + occEsc(item.ref) + '</div></div>' +
            '<div style="padding:14px;border-radius:12px;background:rgba(168,85,247,.08);"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;">Workflow</div><div style="font-size:16px;font-weight:800;margin-top:4px;color:' + occStatusColor(item.portalStatus) + ';">' + occEsc(item.portalStatus) + '</div></div>' +
            '<div style="padding:14px;border-radius:12px;background:rgba(239,68,68,.08);"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;">Stuck At</div><div style="font-size:16px;font-weight:800;margin-top:4px;color:#ef4444;">' + occEsc(item.stuckAt) + '</div></div>' +
            '<div style="padding:14px;border-radius:12px;background:rgba(16,185,129,.08);"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;">Total OCC Value</div><div style="font-size:16px;font-weight:800;margin-top:4px;">' + occFmtCurrency(item.value) + '</div></div>' +
            '</div>';

        document.getElementById('occDetailSummary').innerHTML = summary;
        document.getElementById('occDetailTimeline').innerHTML = occRenderTimeline(raw);

        var fieldsHtml = '';
        OCC_DETAIL_GROUPS.forEach(function (group) {
            fieldsHtml += '<div style="margin-bottom:20px;"><div style="font-size:13px;font-weight:800;margin-bottom:10px;color:var(--t1);">' + occEsc(group.title) + '</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">';
            group.fields.forEach(function (pair) {
                fieldsHtml += '<div style="padding:12px;border-radius:10px;background:rgba(168,85,247,.06);"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px;">' + occEsc(pair[0]) + '</div><div style="font-size:13px;font-weight:600;word-break:break-word;">' + occEsc(occFieldValue(raw, pair[1])) + '</div></div>';
            });
            fieldsHtml += '</div></div>';
        });

        var approvalHtml = '<div style="margin-bottom:20px;"><div style="font-size:13px;font-weight:800;margin-bottom:10px;color:var(--t1);">Approval Fields</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">';
        OCC_APPROVAL_STEPS.forEach(function (step) {
            approvalHtml += '<div style="padding:12px;border-radius:10px;background:rgba(59,130,246,.06);"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px;">' + occEsc(step.label) + ' Status</div><div style="font-size:13px;font-weight:600;">' + occEsc(occPlain(raw[step.statusField]) || '—') + '</div></div>';
            if (step.tsField) {
                approvalHtml += '<div style="padding:12px;border-radius:10px;background:rgba(59,130,246,.06);"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px;">' + occEsc(step.label) + ' Timestamp</div><div style="font-size:13px;font-weight:600;">' + occEsc(occFieldValue(raw, step.tsField)) + '</div></div>';
            }
            if (step.textField) {
                approvalHtml += '<div style="padding:12px;border-radius:10px;background:rgba(59,130,246,.06);"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px;">' + occEsc(step.label) + ' Person</div><div style="font-size:13px;font-weight:600;">' + occEsc(occPlain(raw[step.textField]) || '—') + '</div></div>';
            }
        });
        approvalHtml += '</div></div>';

        document.getElementById('occDetailFields').innerHTML = fieldsHtml + approvalHtml;
        document.getElementById('occDetailSection').style.display = 'block';
        document.getElementById('occDetailSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    async function occRunSearch() {
        var searchType = (document.getElementById('occSearchType') || {}).value || 'account';
        var term = (document.getElementById('occSearchTerm') || {}).value || '';
        var errEl = document.getElementById('occSearchError');
        if (!term.trim()) {
            if (errEl) {
                errEl.style.display = 'block';
                errEl.textContent = 'Please enter a search term.';
            }
            return;
        }

        if (errEl) errEl.style.display = 'none';
        var btn = document.querySelector('#occSearchRoot .export-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;animation:spin 1s linear infinite;"></i>' +
                (OCC_ALL_ITEMS ? 'Searching...' : 'Loading OCC records...');
        }

        try {
            var rawItems = await occSearchItems(searchType, term);
            OCC_SEARCH.results = rawItems.map(occMapItem);
            document.getElementById('occResultsSection').style.display = 'block';
            document.getElementById('occDetailSection').style.display = 'none';
            document.getElementById('occResultCount').textContent = OCC_SEARCH.results.length + ' record(s) found';
            if (!OCC_SEARCH.results.length) {
                if (errEl) {
                    errEl.style.display = 'block';
                    errEl.textContent = 'No OCC records found for your search.';
                }
                document.getElementById('occResultsGrid').innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3);">No records found.</div>';
            } else {
                occRenderGrid(OCC_SEARCH.results);
            }
        } catch (e) {
            console.error('[OCC Search]', e);
            if (errEl) {
                errEl.style.display = 'block';
                var msg = e.message || String(e);
                if (/401|403|access denied|unauthorized/i.test(msg)) {
                    msg = 'Cannot read the OCC list — you need read access to GLK OCC Form on the OCC site';
                }
                errEl.textContent = 'Search failed: ' + msg;
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="search" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Search';
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    function occClearSearch() {
        var term = document.getElementById('occSearchTerm');
        if (term) term.value = '';
        var err = document.getElementById('occSearchError');
        if (err) err.style.display = 'none';
        document.getElementById('occResultsSection').style.display = 'none';
        document.getElementById('occDetailSection').style.display = 'none';
        OCC_SEARCH.results = [];
        OCC_SEARCH.activeItem = null;
        OCC_ALL_ITEMS = null;
        OCC_ALL_LOADING = null;
    }

    function occSearchReset() {
        occClearSearch();
    }

    function occInitShell() {
        if (!OCC_SEARCH.shellReady) occRenderShell();
    }

    window.showOccSearch = async function () {
        if (!USER_CONTEXT.occSearchEnabled) {
            var ok = await occRefreshAccessFlag();
            if (!ok) {
                alert('You do not have access to OCC Search.');
                return;
            }
        }

        var landing = document.getElementById('landingPage');
        if (landing) {
            landing.style.display = 'none';
            landing.style.visibility = 'hidden';
            landing.style.position = 'absolute';
            landing.style.zIndex = '-1';
        }
        var dc = document.getElementById('dashboardContent');
        if (dc) dc.style.display = 'none';
        var asv = document.getElementById('accountSearchView');
        if (asv) asv.style.display = 'none';

        document.getElementById('occSearchView').style.display = 'block';
        window.scrollTo(0, 0);
        occInitShell();
        occBridgeInit().catch(function (e) {
            console.warn('[OCC Search] bridge preload failed (will retry on search)', e);
        });

        var currentTheme = document.body.getAttribute('data-theme');
        var selector = document.getElementById('occSearchColorSchemeSelector');
        var icon = document.getElementById('occSearchThemeIcon');
        if (selector) selector.value = (currentTheme === 'duralux' || currentTheme === 'duralux-dark') ? 'duralux' : 'magenta';
        if (icon) icon.setAttribute('data-lucide', (currentTheme === 'dark' || currentTheme === 'duralux-dark') ? 'sun' : 'moon');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    window.backToLandingFromOcc = function () {
        document.getElementById('occSearchView').style.display = 'none';
        occSearchReset();
        var landing = document.getElementById('landingPage');
        if (landing) {
            landing.style.position = '';
            landing.style.visibility = '';
            landing.style.zIndex = '';
            landing.style.display = 'grid';
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    window.occRunSearch = occRunSearch;
    window.occClearSearch = occClearSearch;
    window.occShowDetail = occShowDetail;
    window.occSearchReset = occSearchReset;
    window.occRefreshAccessFlag = occRefreshAccessFlag;

    document.addEventListener('DOMContentLoaded', function () {
        occRefreshAccessFlag();
    });
    if (document.readyState !== 'loading') {
        setTimeout(occRefreshAccessFlag, 0);
    }
})();
