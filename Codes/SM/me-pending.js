// ============================================================
// me-pending.js — ME Pending Tracking v1
// SharePoint list: ME_Pending_Tracking
// ============================================================

(function () {
    'use strict';

    var MEPT_LIST = 'ME_Pending_Tracking';
    var MEPT_ENTITY = 'SP.Data.ME_x005f_Pending_x005f_TrackingListItem';

    var MEPT_SENDER_TYPES = ['Customer', 'Internal', 'Vendor', 'AM', 'LM', 'Other'];
    var MEPT_PENDING_WITH = ['Agent', 'SM', 'LM', 'AM', 'AD', 'Customer', 'PSD', 'Other'];
    var MEPT_STATUSES = ['In Progress', 'Resolved'];
    var MEPT_ISSUE_TYPES = ['Billing', 'Technical', 'Service', 'Escalation', 'Documentation', 'Other'];
    var MEPT_TEAMS = ['DSM', 'TSM_ME', 'TSM_SE', 'PSD'];
    var MEPT_PRIORITIES = ['Low', 'Medium', 'High'];

    var MEPT = {
        allItems: [],
        filtered: [],
        gridApi: null,
        charts: {},
        filters: {
            team: '',
            agent: '',
            status: '',
            issueType: '',
            pendingWith: '',
            senderType: '',
            priority: '',
            search: '',
            dateFrom: '',
            dateTo: ''
        },
        activeKpi: null,
        activeAgent: null,
        editingId: null,
        loaded: false
    };

    function meptSpUrl() {
        return (typeof SP_URL !== 'undefined' && SP_URL) ? SP_URL : '';
    }

    function meptUserName() {
        return (window.USER_CONTEXT && USER_CONTEXT.userName) || '';
    }

    function meptEsc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function meptParseDate(val) {
        if (!val) return null;
        var d = val instanceof Date ? val : new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    function meptFmtDate(val) {
        var d = meptParseDate(val);
        if (!d) return '—';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function meptFmtDateInput(val) {
        var d = meptParseDate(val);
        if (!d) return '';
        return d.toISOString().slice(0, 10);
    }

    function meptChoice(val) {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (val.results && val.results.length) return val.results[0];
        return String(val);
    }

    function meptPlain(val) {
        if (val == null || val === '') return '';
        if (typeof val === 'object') {
            if (val.results && val.results.length) return meptPlain(val.results[0]);
            return '';
        }
        return String(val).trim();
    }

    function meptCalcAgeing(row) {
        var received = meptParseDate(row.emailReceivedDate);
        if (!received) return null;
        var end = new Date();
        if (row.caseStatus === 'Resolved') {
            var resolved = meptParseDate(row.resolvedDate);
            if (resolved) end = resolved;
        }
        return Math.max(0, Math.floor((end.getTime() - received.getTime()) / 86400000));
    }

    function meptAgeColor(days) {
        if (days == null) return 'var(--t3)';
        if (days > 14) return '#ef4444';
        if (days > 7) return '#f97316';
        return '#10b981';
    }

    function meptLookupCustomer(accountCode) {
        if (!accountCode || !window.ALL_DATA) return '';
        var code = String(accountCode).trim().toUpperCase();
        var match = window.ALL_DATA.find(function (a) {
            return String(a.code || '').trim().toUpperCase() === code;
        });
        return match ? (match.customer || '') : '';
    }

    function meptMapItem(item) {
        var row = {
            id: item.ID,
            refId: item.Title || '',
            emailReceivedDate: meptParseDate(item.Email_Received_Date),
            senderType: meptChoice(item.Sender_Type),
            subjectLine: meptPlain(item.Subject_Line),
            accountCode: meptPlain(item.Account_Code),
            customerName: meptPlain(item.Customer_Name),
            pendingWith: meptChoice(item.Pending_With),
            caseStatus: meptChoice(item.Case_Status) || 'In Progress',
            issueType: meptChoice(item.Issue_Type),
            agentName: meptPlain(item.Agent_Name),
            teamName: meptChoice(item.Team_Name),
            resolvedDate: meptParseDate(item.Resolved_Date),
            priority: meptChoice(item.Priority) || 'Medium',
            remarks: meptPlain(item.Remarks),
            loggedBy: meptPlain(item.Logged_By)
        };
        if (!row.customerName && row.accountCode) {
            row.customerName = meptLookupCustomer(row.accountCode);
        }
        row.ageingDays = meptCalcAgeing(row);
        return row;
    }

    async function meptGetDigest() {
        var res = await fetch(meptSpUrl() + '/_api/contextinfo', {
            method: 'POST',
            headers: { Accept: 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to get form digest');
        var data = await res.json();
        return data.d.GetContextWebInformation.FormDigestValue;
    }

    async function meptFetchItems() {
        var url = meptSpUrl() + "/_api/web/lists/getbytitle('" + MEPT_LIST + "')/items?" +
            '$select=ID,Title,Email_Received_Date,Sender_Type,Subject_Line,Account_Code,Customer_Name,' +
            'Pending_With,Case_Status,Issue_Type,Agent_Name,Team_Name,Resolved_Date,Priority,Remarks,Logged_By' +
            '&$orderby=Email_Received_Date desc&$top=5000';

        var res = await fetch(url, {
            headers: { Accept: 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!res.ok) {
            var errText = await res.text();
            throw new Error('Could not load ME Pending Tracking list. Create list "' + MEPT_LIST + '" in SharePoint. ' + res.status + ': ' + errText.slice(0, 200));
        }
        var data = await res.json();
        return (data.d.results || []).map(meptMapItem);
    }

    function meptApplyFilters() {
        var f = MEPT.filters;
        MEPT.filtered = MEPT.allItems.filter(function (row) {
            if (MEPT.activeKpi === 'open' && row.caseStatus !== 'In Progress') return false;
            if (MEPT.activeKpi === 'resolved' && row.caseStatus !== 'Resolved') return false;
            if (MEPT.activeAgent && row.agentName !== MEPT.activeAgent) return false;
            if (f.team && row.teamName !== f.team) return false;
            if (f.agent && row.agentName !== f.agent) return false;
            if (f.status && row.caseStatus !== f.status) return false;
            if (f.issueType && row.issueType !== f.issueType) return false;
            if (f.pendingWith && row.pendingWith !== f.pendingWith) return false;
            if (f.senderType && row.senderType !== f.senderType) return false;
            if (f.priority && row.priority !== f.priority) return false;
            if (f.dateFrom && row.emailReceivedDate) {
                if (meptFmtDateInput(row.emailReceivedDate) < f.dateFrom) return false;
            }
            if (f.dateTo && row.emailReceivedDate) {
                if (meptFmtDateInput(row.emailReceivedDate) > f.dateTo) return false;
            }
            if (f.search) {
                var q = f.search.toLowerCase();
                var blob = [
                    row.refId, row.subjectLine, row.accountCode, row.customerName,
                    row.agentName, row.remarks, row.loggedBy
                ].join(' ').toLowerCase();
                if (blob.indexOf(q) === -1) return false;
            }
            return true;
        });
    }

    function meptSummary() {
        var open = MEPT.allItems.filter(function (r) { return r.caseStatus === 'In Progress'; });
        var resolved = MEPT.allItems.filter(function (r) { return r.caseStatus === 'Resolved'; });
        var ages = open.map(function (r) { return r.ageingDays; }).filter(function (v) { return v != null; });
        var avgAge = ages.length ? Math.round(ages.reduce(function (s, v) { return s + v; }, 0) / ages.length) : 0;
        return {
            total: MEPT.allItems.length,
            open: open.length,
            resolved: resolved.length,
            avgAge: avgAge
        };
    }

    function meptAgentCounts() {
        var map = {};
        MEPT.allItems.forEach(function (row) {
            if (row.caseStatus !== 'In Progress' || !row.agentName) return;
            map[row.agentName] = (map[row.agentName] || 0) + 1;
        });
        return Object.keys(map).map(function (name) {
            return { name: name, count: map[name] };
        }).sort(function (a, b) { return b.count - a.count; });
    }

    function meptUnique(field) {
        var set = {};
        MEPT.allItems.forEach(function (r) {
            var v = r[field];
            if (v) set[v] = true;
        });
        return Object.keys(set).sort();
    }

    function meptRenderShell() {
        var root = document.getElementById('mePendingRoot');
        if (!root) return;
        root.innerHTML =
            '<div class="table-section" style="margin-bottom:1rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">' +
                    '<div><h3 class="table-title" style="margin:0;"><i data-lucide="clipboard-list" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>ME Pending Tracking</h3>' +
                    '<p style="margin:6px 0 0;font-size:13px;color:var(--t3);">Log and track pending email cases</p></div>' +
                    '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
                        '<button type="button" class="export-btn" onclick="meptOpenForm()"><i data-lucide="plus" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Log Case</button>' +
                        '<button type="button" class="export-btn" onclick="meptExportExcel()"><i data-lucide="file-spreadsheet" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export Excel</button>' +
                        '<button type="button" class="reset-btn" onclick="meptExportPdf()"><i data-lucide="file-text" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export PDF</button>' +
                    '</div>' +
                '</div>' +
                '<div id="meptKpiTiles" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;"></div>' +
                '<div id="meptFilters" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px;"></div>' +
                '<div id="meptAgentTiles" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;"></div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">' +
                    '<div class="edit-revenue-card" style="padding:16px;"><div style="font-size:12px;font-weight:700;color:var(--t3);margin-bottom:8px;">Case Status</div><canvas id="meptChartStatus" height="180"></canvas></div>' +
                    '<div class="edit-revenue-card" style="padding:16px;"><div style="font-size:12px;font-weight:700;color:var(--t3);margin-bottom:8px;">Open Cases by Team</div><canvas id="meptChartTeam" height="180"></canvas></div>' +
                '</div>' +
                '<div id="meptGrid" class="ag-theme-alpine" style="height:560px;width:100%;"></div>' +
            '</div>' +
            '<div id="meptModal" style="display:none;position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:24px;">' +
                '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:18px;max-width:920px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,.35);">' +
                    '<div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
                        '<div style="font-size:18px;font-weight:800;" id="meptModalTitle">Log Case</div>' +
                        '<button type="button" class="reset-btn" onclick="meptCloseForm()" style="padding:8px 12px;">Close</button>' +
                    '</div>' +
                    '<div id="meptFormBody" style="padding:22px;"></div>' +
                    '<div style="padding:16px 22px;border-top:1px solid var(--border);display:flex;gap:12px;">' +
                        '<button type="button" class="export-btn" onclick="meptSaveForm()" style="flex:1;">Save</button>' +
                        '<button type="button" class="reset-btn" onclick="meptCloseForm()">Cancel</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function meptRenderKpis() {
        var el = document.getElementById('meptKpiTiles');
        if (!el) return;
        var s = meptSummary();
        var tiles = [
            { key: null, label: 'Total Cases', value: s.total, color: 'var(--accent)' },
            { key: 'open', label: 'Open (In Progress)', value: s.open, color: '#f97316' },
            { key: 'resolved', label: 'Resolved', value: s.resolved, color: '#10b981' },
            { key: 'avg', label: 'Avg Ageing (Open)', value: s.avgAge + 'd', color: '#4c6fff' }
        ];
        el.innerHTML = tiles.map(function (t) {
            var active = MEPT.activeKpi === t.key || (t.key === null && !MEPT.activeKpi);
            return '<div onclick="meptKpiClick(' + (t.key ? "'" + t.key + "'" : 'null') + ')" style="cursor:pointer;padding:16px;border-radius:14px;border:2px solid ' + (active ? t.color : 'var(--border)') + ';background:rgba(168,85,247,.06);">' +
                '<div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;">' + t.label + '</div>' +
                '<div style="font-size:28px;font-weight:800;color:' + t.color + ';margin-top:6px;">' + t.value + '</div></div>';
        }).join('');
    }

    function meptSelectHtml(id, label, options, value, allLabel) {
        var html = '<div class="filter-group"><label class="filter-label">' + label + '</label><select class="filter-select" id="' + id + '" onchange="meptFilterChanged()" style="font-size:13px;padding:10px;">';
        html += '<option value="">' + (allLabel || 'All') + '</option>';
        options.forEach(function (opt) {
            html += '<option value="' + meptEsc(opt) + '"' + (value === opt ? ' selected' : '') + '>' + meptEsc(opt) + '</option>';
        });
        html += '</select></div>';
        return html;
    }

    function meptRenderFilters() {
        var el = document.getElementById('meptFilters');
        if (!el) return;
        var f = MEPT.filters;
        el.innerHTML =
            meptSelectHtml('meptFTeam', 'Team', MEPT_TEAMS, f.team) +
            meptSelectHtml('meptFAgent', 'Agent', meptUnique('agentName'), f.agent) +
            meptSelectHtml('meptFStatus', 'Case Status', MEPT_STATUSES, f.status) +
            meptSelectHtml('meptFIssue', 'Issue Type', MEPT_ISSUE_TYPES, f.issueType) +
            meptSelectHtml('meptFPending', 'Pending With', MEPT_PENDING_WITH, f.pendingWith) +
            meptSelectHtml('meptFSender', 'Sender Type', MEPT_SENDER_TYPES, f.senderType) +
            meptSelectHtml('meptFPriority', 'Priority', MEPT_PRIORITIES, f.priority) +
            '<div class="filter-group"><label class="filter-label">From Date</label><input type="date" class="filter-select" id="meptFDateFrom" value="' + meptEsc(f.dateFrom) + '" onchange="meptFilterChanged()" style="font-size:13px;padding:10px;"></div>' +
            '<div class="filter-group"><label class="filter-label">To Date</label><input type="date" class="filter-select" id="meptFDateTo" value="' + meptEsc(f.dateTo) + '" onchange="meptFilterChanged()" style="font-size:13px;padding:10px;"></div>' +
            '<div class="filter-group"><label class="filter-label">Search</label><input type="text" class="filter-select" id="meptFSearch" value="' + meptEsc(f.search) + '" oninput="meptFilterChanged()" placeholder="Subject, account, agent..." style="font-size:13px;padding:10px;"></div>' +
            '<div class="filter-group" style="display:flex;align-items:flex-end;"><button type="button" class="reset-btn" onclick="meptResetFilters()" style="width:100%;padding:10px;">Reset</button></div>';
    }

    function meptRenderAgentTiles() {
        var el = document.getElementById('meptAgentTiles');
        if (!el) return;
        var agents = meptAgentCounts();
        if (!agents.length) {
            el.innerHTML = '<div style="font-size:12px;color:var(--t3);">No open cases by agent.</div>';
            return;
        }
        el.innerHTML = agents.slice(0, 12).map(function (a) {
            var active = MEPT.activeAgent === a.name;
            return '<button type="button" onclick="meptAgentClick(\'' + meptEsc(a.name).replace(/'/g, "\\'") + '\')" style="cursor:pointer;padding:10px 14px;border-radius:12px;border:2px solid ' + (active ? 'var(--accent)' : 'var(--border)') + ';background:var(--bg-card);font-weight:700;font-size:13px;">' +
                meptEsc(a.name) + ' <span style="color:var(--accent);">(' + a.count + ')</span></button>';
        }).join('');
    }

    function meptDestroyCharts() {
        Object.keys(MEPT.charts).forEach(function (key) {
            if (MEPT.charts[key]) {
                MEPT.charts[key].destroy();
                MEPT.charts[key] = null;
            }
        });
    }

    function meptRenderCharts() {
        if (typeof Chart === 'undefined') return;
        meptDestroyCharts();
        var open = MEPT.allItems.filter(function (r) { return r.caseStatus === 'In Progress'; });
        var resolved = MEPT.allItems.filter(function (r) { return r.caseStatus === 'Resolved'; });
        var statusCanvas = document.getElementById('meptChartStatus');
        if (statusCanvas) {
            MEPT.charts.status = new Chart(statusCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['In Progress', 'Resolved'],
                    datasets: [{ data: [open.length, resolved.length], backgroundColor: ['#f97316', '#10b981'] }]
                },
                options: { plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }
            });
        }
        var teamMap = {};
        open.forEach(function (r) {
            var t = r.teamName || 'Unknown';
            teamMap[t] = (teamMap[t] || 0) + 1;
        });
        var teamLabels = Object.keys(teamMap);
        var teamCanvas = document.getElementById('meptChartTeam');
        if (teamCanvas) {
            MEPT.charts.team = new Chart(teamCanvas, {
                type: 'bar',
                data: {
                    labels: teamLabels,
                    datasets: [{ label: 'Open Cases', data: teamLabels.map(function (l) { return teamMap[l]; }), backgroundColor: '#a855f7' }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                    maintainAspectRatio: false
                }
            });
        }
    }

    function meptRenderGrid() {
        var gridDiv = document.getElementById('meptGrid');
        if (!gridDiv || typeof agGrid === 'undefined') return;
        if (MEPT.gridApi) {
            MEPT.gridApi.destroy();
            MEPT.gridApi = null;
        }
        gridDiv.innerHTML = '';

        var columnDefs = [
            { field: 'emailReceivedDate', headerName: 'Email Received Date', width: 150,
                valueFormatter: function (p) { return meptFmtDate(p.value); } },
            { field: 'ageingDays', headerName: 'Ageing Days', width: 120, type: 'numericColumn',
                cellRenderer: function (p) {
                    if (p.value == null) return '—';
                    return '<span style="font-weight:700;color:' + meptAgeColor(p.value) + ';">' + p.value + 'd</span>';
                } },
            { field: 'caseStatus', headerName: 'Case Status', width: 130,
                cellRenderer: function (p) {
                    var c = p.value === 'Resolved' ? '#10b981' : '#f97316';
                    return '<span class="status-badge" style="background:' + c + '22;color:' + c + ';font-weight:700;">' + meptEsc(p.value || '') + '</span>';
                } },
            { field: 'subjectLine', headerName: 'Subject Line', width: 240 },
            { field: 'accountCode', headerName: 'Account Code', width: 130 },
            { field: 'customerName', headerName: 'Customer Name', width: 180 },
            { field: 'senderType', headerName: 'Sender Type', width: 120 },
            { field: 'pendingWith', headerName: 'Pending With', width: 120 },
            { field: 'issueType', headerName: 'Issue Type', width: 130 },
            { field: 'agentName', headerName: 'Agent Name', width: 150 },
            { field: 'teamName', headerName: 'Team Name', width: 110 },
            { field: 'priority', headerName: 'Priority', width: 100 },
            { field: 'resolvedDate', headerName: 'Resolved Date', width: 130,
                valueFormatter: function (p) { return meptFmtDate(p.value); } },
            { field: 'remarks', headerName: 'Remarks', width: 200 },
            { field: 'loggedBy', headerName: 'Logged By', width: 130 },
            { field: 'actions', headerName: 'Action', width: 100, pinned: 'right', sortable: false, filter: false,
                cellRenderer: function (p) {
                    return '<button type="button" class="export-btn" style="padding:5px 10px;font-size:12px;" onclick="meptOpenForm(' + p.data.id + ')">Edit</button>';
                } }
        ];

        agGrid.createGrid(gridDiv, {
            columnDefs: columnDefs,
            rowData: MEPT.filtered.slice(),
            defaultColDef: { sortable: true, filter: true, resizable: true },
            pagination: true,
            paginationPageSize: 50,
            rowHeight: 48,
            onGridReady: function (params) { MEPT.gridApi = params.api; }
        });
    }

    function meptRefreshUi() {
        meptApplyFilters();
        meptRenderKpis();
        meptRenderFilters();
        meptRenderAgentTiles();
        meptRenderCharts();
        meptRenderGrid();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function meptReadFiltersFromDom() {
        MEPT.filters.team = (document.getElementById('meptFTeam') || {}).value || '';
        MEPT.filters.agent = (document.getElementById('meptFAgent') || {}).value || '';
        MEPT.filters.status = (document.getElementById('meptFStatus') || {}).value || '';
        MEPT.filters.issueType = (document.getElementById('meptFIssue') || {}).value || '';
        MEPT.filters.pendingWith = (document.getElementById('meptFPending') || {}).value || '';
        MEPT.filters.senderType = (document.getElementById('meptFSender') || {}).value || '';
        MEPT.filters.priority = (document.getElementById('meptFPriority') || {}).value || '';
        MEPT.filters.dateFrom = (document.getElementById('meptFDateFrom') || {}).value || '';
        MEPT.filters.dateTo = (document.getElementById('meptFDateTo') || {}).value || '';
        MEPT.filters.search = (document.getElementById('meptFSearch') || {}).value || '';
    }

    function meptFormSelect(name, label, options, value, required) {
        var html = '<div class="filter-group"><label class="filter-label">' + label + (required ? ' *' : '') + '</label>';
        html += '<select class="filter-select" id="' + name + '" style="font-size:13px;padding:10px;"' + (required ? ' required' : '') + '>';
        html += '<option value="">Select...</option>';
        options.forEach(function (opt) {
            html += '<option value="' + meptEsc(opt) + '"' + (value === opt ? ' selected' : '') + '>' + meptEsc(opt) + '</option>';
        });
        html += '</select></div>';
        return html;
    }

    function meptOpenForm(itemId) {
        var row = null;
        if (itemId) {
            row = MEPT.allItems.find(function (r) { return r.id === itemId; });
        }
        MEPT.editingId = row ? row.id : null;
        document.getElementById('meptModalTitle').textContent = row ? 'Edit Case' : 'Log Case';
        var today = new Date().toISOString().slice(0, 10);
        var body = document.getElementById('meptFormBody');
        body.innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;">' +
                '<div class="filter-group"><label class="filter-label">Email Received Date *</label><input type="date" class="filter-select" id="meptFormReceived" value="' + meptEsc(meptFmtDateInput(row ? row.emailReceivedDate : new Date())) + '" required style="font-size:13px;padding:10px;"></div>' +
                meptFormSelect('meptFormSender', 'Sender Type', MEPT_SENDER_TYPES, row ? row.senderType : '', true) +
                meptFormSelect('meptFormPending', 'Pending With', MEPT_PENDING_WITH, row ? row.pendingWith : '', true) +
                '<div class="filter-group" style="grid-column:1/-1;"><label class="filter-label">Subject Line *</label><input type="text" class="filter-select" id="meptFormSubject" value="' + meptEsc(row ? row.subjectLine : '') + '" required style="font-size:13px;padding:10px;"></div>' +
                '<div class="filter-group"><label class="filter-label">Account Code</label><input type="text" class="filter-select" id="meptFormAccount" value="' + meptEsc(row ? row.accountCode : '') + '" onblur="meptFormAccountBlur()" style="font-size:13px;padding:10px;"></div>' +
                '<div class="filter-group"><label class="filter-label">Customer Name</label><input type="text" class="filter-select" id="meptFormCustomer" value="' + meptEsc(row ? row.customerName : '') + '" style="font-size:13px;padding:10px;"></div>' +
                meptFormSelect('meptFormStatus', 'Case Status', MEPT_STATUSES, row ? row.caseStatus : 'In Progress', true) +
                meptFormSelect('meptFormIssue', 'Issue Type', MEPT_ISSUE_TYPES, row ? row.issueType : '', true) +
                '<div class="filter-group"><label class="filter-label">Agent Name *</label><input type="text" class="filter-select" id="meptFormAgent" value="' + meptEsc(row ? row.agentName : meptUserName()) + '" required style="font-size:13px;padding:10px;"></div>' +
                meptFormSelect('meptFormTeam', 'Team Name', MEPT_TEAMS, row ? row.teamName : '', true) +
                meptFormSelect('meptFormPriority', 'Priority', MEPT_PRIORITIES, row ? row.priority : 'Medium', true) +
                '<div class="filter-group"><label class="filter-label">Resolved Date</label><input type="date" class="filter-select" id="meptFormResolved" value="' + meptEsc(meptFmtDateInput(row ? row.resolvedDate : '')) + '" style="font-size:13px;padding:10px;"></div>' +
                '<div class="filter-group" style="grid-column:1/-1;"><label class="filter-label">Remarks</label><textarea class="filter-select" id="meptFormRemarks" rows="3" style="resize:vertical;font-size:13px;padding:10px;">' + meptEsc(row ? row.remarks : '') + '</textarea></div>' +
            '</div>';
        document.getElementById('meptModal').style.display = 'flex';
        var statusEl = document.getElementById('meptFormStatus');
        if (statusEl) statusEl.onchange = meptFormStatusChanged;
        meptFormStatusChanged();
    }

    function meptFormStatusChanged() {
        var status = (document.getElementById('meptFormStatus') || {}).value;
        var resolvedEl = document.getElementById('meptFormResolved');
        if (!resolvedEl) return;
        if (status === 'Resolved') {
            if (!resolvedEl.value) resolvedEl.value = new Date().toISOString().slice(0, 10);
            resolvedEl.required = true;
        } else {
            resolvedEl.required = false;
            resolvedEl.value = '';
        }
    }

    function meptCloseForm() {
        document.getElementById('meptModal').style.display = 'none';
        MEPT.editingId = null;
    }

    function meptFormAccountBlur() {
        var code = (document.getElementById('meptFormAccount') || {}).value;
        var cust = meptLookupCustomer(code);
        if (cust) document.getElementById('meptFormCustomer').value = cust;
    }

    function meptBuildPayload() {
        var received = (document.getElementById('meptFormReceived') || {}).value;
        var status = (document.getElementById('meptFormStatus') || {}).value;
        var resolved = (document.getElementById('meptFormResolved') || {}).value;
        if (!received) throw new Error('Email Received Date is required');
        if (!(document.getElementById('meptFormSubject') || {}).value.trim()) throw new Error('Subject Line is required');
        if (!(document.getElementById('meptFormAgent') || {}).value.trim()) throw new Error('Agent Name is required');
        if (status === 'Resolved' && !resolved) throw new Error('Resolved Date is required when status is Resolved');

        var refId = 'ME-' + received.replace(/-/g, '') + '-' + String(Date.now()).slice(-4);
        return {
            Title: MEPT.editingId ? undefined : refId,
            Email_Received_Date: received + 'T00:00:00Z',
            Sender_Type: (document.getElementById('meptFormSender') || {}).value,
            Subject_Line: (document.getElementById('meptFormSubject') || {}).value.trim(),
            Account_Code: (document.getElementById('meptFormAccount') || {}).value.trim(),
            Customer_Name: (document.getElementById('meptFormCustomer') || {}).value.trim(),
            Pending_With: (document.getElementById('meptFormPending') || {}).value,
            Case_Status: status,
            Issue_Type: (document.getElementById('meptFormIssue') || {}).value,
            Agent_Name: (document.getElementById('meptFormAgent') || {}).value.trim(),
            Team_Name: (document.getElementById('meptFormTeam') || {}).value,
            Priority: (document.getElementById('meptFormPriority') || {}).value,
            Resolved_Date: status === 'Resolved' ? (resolved + 'T00:00:00Z') : null,
            Remarks: (document.getElementById('meptFormRemarks') || {}).value.trim(),
            Logged_By: meptUserName()
        };
    }

    async function meptSaveForm() {
        try {
            var payload = meptBuildPayload();
            var digest = await meptGetDigest();
            if (MEPT.editingId) {
                delete payload.Title;
                delete payload.Logged_By;
                var updateUrl = meptSpUrl() + "/_api/web/lists/getbytitle('" + MEPT_LIST + "')/items(" + MEPT.editingId + ")";
                var updateRes = await fetch(updateUrl, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json;odata=verbose',
                        'Content-Type': 'application/json;odata=verbose',
                        'X-RequestDigest': digest,
                        'IF-MATCH': '*',
                        'X-HTTP-Method': 'MERGE'
                    },
                    credentials: 'include',
                    body: JSON.stringify(Object.assign({ __metadata: { type: MEPT_ENTITY } }, payload))
                });
                if (!updateRes.ok) throw new Error(await updateRes.text());
            } else {
                payload.Title = payload.Title || ('ME-' + Date.now());
                var createUrl = meptSpUrl() + "/_api/web/lists/getbytitle('" + MEPT_LIST + "')/items";
                var createRes = await fetch(createUrl, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json;odata=verbose',
                        'Content-Type': 'application/json;odata=verbose',
                        'X-RequestDigest': digest
                    },
                    credentials: 'include',
                    body: JSON.stringify(Object.assign({ __metadata: { type: MEPT_ENTITY } }, payload))
                });
                if (!createRes.ok) throw new Error(await createRes.text());
            }
            meptCloseForm();
            await meptInit(true);
            alert('Case saved successfully.');
        } catch (err) {
            console.error('[MEPT]', err);
            alert('Save failed: ' + err.message);
        }
    }

    function meptExportRows() {
        return MEPT.filtered.slice();
    }

    function meptExportExcel() {
        var rows = meptExportRows();
        var headers = ['Email Received Date', 'Ageing Days', 'Case Status', 'Subject Line', 'Account Code', 'Customer Name', 'Sender Type', 'Pending With', 'Issue Type', 'Agent Name', 'Team Name', 'Priority', 'Resolved Date', 'Remarks', 'Logged By'];
        var today = new Date();
        var html = '<html><head><meta charset="utf-8"></head><body><table border="1" cellspacing="0" cellpadding="4">';
        html += '<tr><td colspan="' + headers.length + '" style="background:#a855f7;color:white;font-weight:bold;text-align:center;padding:12px;">ME Pending Tracking Export</td></tr>';
        html += '<tr>' + headers.map(function (h) { return '<th style="background:#a855f7;color:white;padding:8px;">' + h + '</th>'; }).join('') + '</tr>';
        rows.forEach(function (r, i) {
            var bg = i % 2 ? '#ffffff' : '#f3e8ff';
            var vals = [
                meptFmtDate(r.emailReceivedDate), r.ageingDays != null ? r.ageingDays : '',
                r.caseStatus, r.subjectLine, r.accountCode, r.customerName, r.senderType,
                r.pendingWith, r.issueType, r.agentName, r.teamName, r.priority,
                meptFmtDate(r.resolvedDate), r.remarks, r.loggedBy
            ];
            html += '<tr>' + vals.map(function (v) { return '<td style="background:' + bg + ';padding:8px;">' + meptEsc(v) + '</td>'; }).join('') + '</tr>';
        });
        html += '</table></body></html>';
        var link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }));
        link.download = 'ME_Pending_Tracking_' + today.toISOString().slice(0, 10) + '.xls';
        link.click();
    }

    function meptExportPdf() {
        var rows = meptExportRows();
        var win = window.open('', '_blank');
        if (!win) { alert('Please allow pop-ups to export PDF.'); return; }
        var html = '<html><head><title>ME Pending Tracking</title><style>body{font-family:Arial,sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;font-size:11px;}th,td{border:1px solid #ccc;padding:6px;text-align:left;}th{background:#a855f7;color:white;}</style></head><body>';
        html += '<h2>ME Pending Tracking</h2><p>Generated: ' + new Date().toLocaleString('en-GB') + ' | Records: ' + rows.length + '</p>';
        html += '<table><tr><th>Received</th><th>Ageing</th><th>Status</th><th>Subject</th><th>Account</th><th>Agent</th><th>Team</th><th>Pending With</th></tr>';
        rows.forEach(function (r) {
            html += '<tr><td>' + meptFmtDate(r.emailReceivedDate) + '</td><td>' + (r.ageingDays != null ? r.ageingDays + 'd' : '') + '</td><td>' + meptEsc(r.caseStatus) + '</td><td>' + meptEsc(r.subjectLine) + '</td><td>' + meptEsc(r.accountCode) + '</td><td>' + meptEsc(r.agentName) + '</td><td>' + meptEsc(r.teamName) + '</td><td>' + meptEsc(r.pendingWith) + '</td></tr>';
        });
        html += '</table></body></html>';
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(function () { win.print(); }, 400);
    }

    async function meptInit(forceReload) {
        var loading = document.getElementById('mePendingLoading');
        var content = document.getElementById('mePendingContent');
        if (loading) loading.style.display = 'block';
        if (content) content.style.display = 'none';
        try {
            if (!MEPT.loaded || forceReload) {
                meptRenderShell();
                MEPT.allItems = await meptFetchItems();
                MEPT.loaded = true;
            }
            if (loading) loading.style.display = 'none';
            if (content) content.style.display = 'block';
            meptRefreshUi();
        } catch (err) {
            console.error('[MEPT]', err);
            if (loading) {
                loading.innerHTML = '<div style="color:#ef4444;padding:20px;font-weight:600;">' + meptEsc(err.message) + '</div>';
            }
        }
    }

    window.meptInit = meptInit;
    window.meptOpenForm = meptOpenForm;
    window.meptCloseForm = meptCloseForm;
    window.meptSaveForm = meptSaveForm;
    window.meptFilterChanged = function () {
        meptReadFiltersFromDom();
        meptRefreshUi();
    };
    window.meptResetFilters = function () {
        MEPT.filters = { team: '', agent: '', status: '', issueType: '', pendingWith: '', senderType: '', priority: '', search: '', dateFrom: '', dateTo: '' };
        MEPT.activeKpi = null;
        MEPT.activeAgent = null;
        meptRefreshUi();
    };
    window.meptKpiClick = function (key) {
        MEPT.activeKpi = MEPT.activeKpi === key ? null : key;
        meptRefreshUi();
    };
    window.meptAgentClick = function (name) {
        MEPT.activeAgent = MEPT.activeAgent === name ? null : name;
        if (MEPT.activeAgent) MEPT.filters.agent = MEPT.activeAgent;
        else MEPT.filters.agent = '';
        meptRefreshUi();
    };
    window.meptFormAccountBlur = meptFormAccountBlur;
    window.meptFormStatusChanged = meptFormStatusChanged;
    window.meptExportExcel = meptExportExcel;
    window.meptExportPdf = meptExportPdf;

    window.initMEPending = function () {
        return meptInit(false);
    };
})();
