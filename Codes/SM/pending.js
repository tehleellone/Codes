// ============================================================
// pending.js — Pending Requests & Review Module (v2)
// Fixes: AG Grid, date column, layout, revenue, back button
// ============================================================



// ── globals ──────────────────────────────────────────────────
if (typeof CURRENT_REQUEST_ITEM === 'undefined') window.CURRENT_REQUEST_ITEM = null;
var pendingGridApi = null;

// ── navigation ───────────────────────────────────────────────
function backToRequestsList() {
    document.getElementById('reviewRequestView').style.display = 'none';
    switchDashboardSection('pending-requests');
}

function backToAdminDashboard() {
    document.getElementById('reviewRequestView').style.display = 'none';
    switchDashboardSection('dashboard-view');
}
function exportPendingToExcel() {
    if (!pendingGridApi) return;
    var today = new Date();
    var dateStr = today.toLocaleDateString('en-GB') + ' ' + today.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
    var rows = [];
    pendingGridApi.forEachNodeAfterFilter(function(node) { rows.push(node.data); });
    var lastThree = getLastThreeCompletedMonths();
    var html = '<html><head><meta charset="utf-8"></head><body><table border="1" cellspacing="0" cellpadding="4">';
    html += '<tr><td colspan="10" style="background:#a855f7;color:white;font-size:16px;font-weight:bold;text-align:center;padding:12px;">Pending Requests Export</td></tr>';
    html += '<tr><td colspan="10" style="background:#e9d5ff;font-size:12px;padding:8px;text-align:center;"><b>Generated:</b> ' + dateStr + ' | <b>Records:</b> ' + rows.length + '</td></tr>';
    html += '<tr>';
    ['Account Code','Customer','Team','Account Director','Account Manager',
     lastThree[0].label, lastThree[1].label, lastThree[2].label,
     'Request Date','Days Pending'].forEach(function(h) {
        html += '<th style="background:#a855f7;color:white;font-weight:bold;padding:10px;">' + h + '</th>';
    });
    html += '</tr>';
    rows.forEach(function(r, i) {
        var bg = i % 2 === 0 ? '#f3e8ff' : '#ffffff';
        var reqDate = r.requestDate ? r.requestDate.toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
        html += '<tr>';
        html += '<td style="background:' + bg + ';padding:8px;font-weight:700;">' + (r.code||'') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + (r.customer||'') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + (r.team||'') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + (r.ad||'') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + (r.am||'') + '</td>';
        lastThree.forEach(function(m) {
            html += '<td style="background:' + bg + ';padding:8px;text-align:right;">' + formatCurrency(r[m.field]||0) + '</td>';
        });
        html += '<td style="background:' + bg + ';padding:8px;">' + reqDate + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;text-align:center;">' + (r.daysSince !== null ? r.daysSince + 'd' : '—') + '</td>';
        html += '</tr>';
    });
    html += '</table></body></html>';
    var blob = new Blob([html], {type:'application/vnd.ms-excel'});
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Pending_Requests_' + today.toISOString().split('T')[0] + '.xls';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
window.exportPendingToExcel = exportPendingToExcel;
// ── load pending requests into AG Grid ───────────────────────
async function loadAccountRequests() {
    try {
        CURRENT_REQUEST_ITEM = null;

        var loadingEl = document.getElementById('requestsLoading');
        var contentEl = document.getElementById('requestsContent');
        var gridEl = document.getElementById('pendingRequestsGrid');

        // ── DOM check ──
        if (!loadingEl) {
            console.error('[pending] #requestsLoading not found');
            return;
        }
        if (!contentEl) {
            console.error('[pending] #requestsContent not found');
            return;
        }
        if (!gridEl) {
            console.error('[pending] #pendingRequestsGrid not found');
            return;
        }

        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';

        // ── dependency check ──
        if (typeof getLastThreeCompletedMonths !== 'function') {
            loadingEl.innerHTML = '<div style="color:#ef4444;">Error: getLastThreeCompletedMonths() not available yet. Check script load order.</div>';
            console.error('[pending] getLastThreeCompletedMonths not defined');
            return;
        }
        if (typeof agGrid === 'undefined') {
            loadingEl.innerHTML = '<div style="color:#ef4444;">Error: AG Grid not loaded. Check CDN.</div>';
            console.error('[pending] agGrid not defined');
            return;
        }

        var lastThree = getLastThreeCompletedMonths();
        var monthFields = lastThree.map(function(m) {
            return m.field;
        }).join(',');

        console.log('[pending] Fetching with month fields:', monthFields);

       var url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items?" +
            "$select=ID,Title,Parent_x0020_Code,Customer_x0020_Name,Team," +
            "Account_x0020_Manager/Title,Account_x0020_Director/Title," +
            "POC_x0020_Name,POC_x0020_Email_x0020_ID,POC_x0020_Contact_x0020_No," +
            monthFields + ",Request_x0020_Status,Request_x0020_Type,New_Account_Request_Date&" +
            "$expand=Account_x0020_Manager,Account_x0020_Director&" +
"$filter=(Request_x0020_Status eq 'Not Onboarded' or Request_x0020_Status eq 'Pending_SD_Approval')&" + "$top=5000";

        console.log('[pending] URL:', url);

        var res = await fetch(url, {
            headers: {
                'Accept': 'application/json;odata=verbose'
            },
            credentials: 'include'
        });

        console.log('[pending] Response status:', res.status);

        if (!res.ok) {
            var errText = await res.text();
            console.error('[pending] Fetch error:', errText);
            loadingEl.innerHTML = '<div style="color:#ef4444;">HTTP ' + res.status + ': ' + res.statusText + '</div>';
            return;
        }

        var data = await res.json();
       var requests = data.d.results.filter(function(r) {
            return r.Request_x0020_Type !== 'Transfer';
        });

        console.log('[pending] Records returned:', requests.length);

        if (requests.length === 0) {
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
            gridEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3);">No pending requests found.</div>';
            return;
        }

        var rowData = requests.map(function(r) {
            var requestDate = r.New_Account_Request_Date ? new Date(r.New_Account_Request_Date) : null;
            var daysSince = requestDate ? Math.floor((new Date() - requestDate) / 86400000) : null;

            var row = {
                id: r.ID,
                code: r.Title || '',
                customer: r.Customer_x0020_Name || '',
                team: r.Team || '',
                ad: r.Account_x0020_Director ? r.Account_x0020_Director.Title : '',
                am: r.Account_x0020_Manager ? r.Account_x0020_Manager.Title : '',
                status: r.Request_x0020_Status || 'Not Onboarded',
                requestDate: requestDate,
                daysSince: daysSince
            };

            lastThree.forEach(function(m) {
                row[m.field] = parseFloat(r[m.field]) || 0;
            });

            return row;
        });

        console.log('[pending] Row data built:', rowData.length, 'rows');

        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

        renderPendingGrid(rowData, lastThree);

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error('[pending] Caught error:', err);
        var loadingEl2 = document.getElementById('requestsLoading');
        if (loadingEl2) {
            loadingEl2.innerHTML = '<div style="color:#ef4444;padding:20px;">Error: ' + err.message + '</div>';
        }
    }
}
// ── render AG Grid ────────────────────────────────────────────
function renderPendingGrid(rowData, lastThree) {
    var gridDiv = document.getElementById('pendingRequestsGrid');
    if (!gridDiv) return;

    // Build month columns dynamically
    var monthCols = lastThree.map(function(m) {
        return {
            field: m.field,
            headerName: m.label,
            width: 120,
            type: 'numericColumn',
            valueFormatter: function(p) {
                return formatCurrency(p.value || 0);
            }
        };
    });

    var columnDefs = [{
            field: 'code',
            headerName: 'Account Code',
            pinned: 'left',
            width: 150,
            cellStyle: {
                fontWeight: '700'
            },
            filter: 'agTextColumnFilter'
        },
        {
            field: 'customer',
            headerName: 'Customer Name',
            width: 230,
            filter: 'agTextColumnFilter'
        },
        {
            field: 'team',
            headerName: 'Team',
            width: 90,
            filter: 'agSetColumnFilter'
        },
        {
            field: 'ad',
            headerName: 'Account Director',
            width: 180,
            filter: 'agTextColumnFilter'
        },
        {
            field: 'am',
            headerName: 'Account Manager',
            width: 180,
            filter: 'agTextColumnFilter'
        },
    ].concat(monthCols).concat([{
            field: 'requestDate',
            headerName: 'Request Date',
            width: 140,
            sort: 'desc',
            valueFormatter: function(p) {
                if (!p.value) return '—';
                return p.value.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            },
            filter: 'agDateColumnFilter'
        },
        {
            field: 'daysSince',
            headerName: 'Days Pending',
            width: 130,
            type: 'numericColumn',
            cellRenderer: function(p) {
                if (p.value === null || p.value === undefined) return '—';
                var color = p.value > 14 ? '#ef4444' : p.value > 7 ? '#f97316' : '#10b981';
                return '<span style="font-weight:700;color:' + color + ';">' + p.value + 'd</span>';
            }
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 160,
            cellRenderer: function(p) {
                return '<span class="status-badge badge-warning">' + (p.value || '') + '</span>';
            }
        },
        {
            field: 'actions',
            headerName: 'Action',
            width: 110,
            pinned: 'right',
            sortable: false,
            filter: false,
            cellRenderer: function(p) {
                return '<button type="button" class="export-btn" style="padding:5px 12px;font-size:12px;" ' +
                    'onclick="reviewRequest(' + p.data.id + ')">' +
                    '<i data-lucide="eye" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Review</button>';
            },
            onCellClicked: function() {
                setTimeout(function() {
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }, 80);
            }
        }
    ]);

    if (pendingGridApi) {
        pendingGridApi.destroy();
        pendingGridApi = null;
    }
    gridDiv.innerHTML = '';

    agGrid.createGrid(gridDiv, {
        columnDefs: columnDefs,
        rowData: rowData,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true
        },
        pagination: true,
        paginationPageSize: 50,
        paginationPageSizeSelector: [25, 50, 100],
        rowHeight: 48,
        headerHeight: 48,
        animateRows: true,
        enableCellTextSelection: true,
        onGridReady: function(params) {
            pendingGridApi = params.api;
            setTimeout(function() {
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 100);
        },
        onCellClicked: function() {
            setTimeout(function() {
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 80);
        }
    });
}

function searchRequests() {
    if (!pendingGridApi) return;
    var val = document.getElementById('requestSearchBox').value;
    pendingGridApi.setGridOption('quickFilterText', val);
}

// ── review a single request ───────────────────────────────────
async function reviewRequest(itemId) {
    try {
        var lastThree = getLastThreeCompletedMonths();
        var monthFields = lastThree.map(function(m) {
            return m.field;
        }).join(',');

        var url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")?" +
            "$select=ID,Title,Parent_x0020_Code,Customer_x0020_Name,Team," +
            "Account_x0020_Manager/Title,Account_x0020_Manager/EMail," +
            "Account_x0020_Director/Title,Account_x0020_Director/EMail," +
            "Line_x0020_Manager/Title,Line_x0020_Manager/EMail," +
            "Service_x0020_Manager/Title,Service_x0020_Manager/EMail," +
            "POC_x0020_Name,POC_x0020_Email_x0020_ID,POC_x0020_Contact_x0020_No," +
            monthFields + ",New_Account_Request_Date,Request_x0020_Status," +
            "Service_x0020_Director/Title,Service_x0020_Director/EMail&" +
            "$expand=Account_x0020_Manager,Account_x0020_Director,Line_x0020_Manager,Service_x0020_Manager,Service_x0020_Director";
        var res = await fetch(url, {
            headers: {
                'Accept': 'application/json;odata=verbose'
            },
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to load request: ' + (await res.text()));

        var data = await res.json();
        CURRENT_REQUEST_ITEM = data.d;

        document.querySelectorAll('.dashboard-section').forEach(function(s) {
            s.style.display = 'none';
        });
        document.getElementById('reviewRequestView').style.display = 'block';

        populateReviewForm(CURRENT_REQUEST_ITEM);

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error('Error:', err);
        alert('Error loading request: ' + err.message);
    }
}
// ── populate review form ──────────────────────────────────────
function populateReviewForm(item) {
    var lastThree = getLastThreeCompletedMonths();

    // Request details grid
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    var fields = [
        ['Account Code', item.Title],
        ['Parent Code', item.Parent_x0020_Code || 'N/A (Group Account)'],
        ['Customer Name', item.Customer_x0020_Name],
        ['POC Name', item.POC_x0020_Name],
        ['POC Email', item.POC_x0020_Email_x0020_ID],
        ['POC Contact', item.POC_x0020_Contact_x0020_No],
        ['Account Director', item.Account_x0020_Director ? item.Account_x0020_Director.Title : ''],
        ['Account Manager', item.Account_x0020_Manager ? item.Account_x0020_Manager.Title : '']
    ];
    fields.forEach(function(f) {
        html += '<div style="padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
            '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">' + f[0] + '</div>' +
            '<div style="font-size:13px;font-weight:600;">' + (f[1] || 'N/A') + '</div>' +
            '</div>';
    });

    var requestDate = item.New_Account_Request_Date ? new Date(item.New_Account_Request_Date) : null;
    var daysSince = requestDate ? Math.floor((new Date() - requestDate) / 86400000) : null;
    var dateDisplay = requestDate ?
        requestDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) :
        'N/A';
    var daysColor = daysSince > 14 ? '#ef4444' : daysSince > 7 ? '#f97316' : '#10b981';
    var daysDisplay = daysSince !== null ?
        '<span style="color:' + daysColor + ';font-weight:700;">' + daysSince + ' days pending</span>' :
        'N/A';

    html += '<div style="padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
        '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Request Date</div>' +
        '<div style="font-size:13px;font-weight:600;">' + dateDisplay + '</div>' +
        '</div>';
    html += '<div style="padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
        '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Days Pending</div>' +
        '<div style="font-size:13px;">' + daysDisplay + '</div>' +
        '</div>';

    html += '</div>';

    // Revenue
    html += '<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--t2);">Revenue Details</h4>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">';
    lastThree.forEach(function(month) {
        var raw = item[month.field];
        var value = parseFloat(raw) || 0;
        html += '<div style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;">' +
            '<div style="font-size:11px;color:var(--t3);margin-bottom:4px;font-weight:600;">' + month.label + '</div>' +
            '<div style="font-size:18px;font-weight:700;color:var(--sc);">' + formatCurrency(value) + '</div>' +
            '</div>';
    });
    html += '</div>';

    document.getElementById('reviewRequestDetails').innerHTML = html;

    // Populate LM / SM dropdowns - start empty, will be populated on team/LM change
    var lmSelect = document.getElementById('adminReqLM');
    lmSelect.innerHTML = '<option value="">Select Line Manager</option>';
    lmSelect.disabled = true;

    var smSelect = document.getElementById('adminReqSM');
    smSelect.innerHTML = '<option value="">Select Service Manager</option>';
    smSelect.disabled = true;

    // Populate Team dropdown
    var teams = [...new Set(ALL_DATA.map(function(a) {
        return a.team;
    }))].filter(Boolean).sort();
    var teamSelect = document.getElementById('adminReqTeam');
    teamSelect.innerHTML = '<option value="">Select Team</option>';
    teams.forEach(function(t) {
        var opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        teamSelect.appendChild(opt);
    });

    // Reset form state
    document.getElementById('adminReqStatus').value = '';
    document.getElementById('adminReqTeam').value = '';
    document.getElementById('adminReviewSection').style.display = 'none';
    document.getElementById('adminSubmitMessage').innerHTML = '';

    // Hide all conditional sections initially
    document.getElementById('adminApproveFields').style.display = 'none';
    document.getElementById('adminRejectFields').style.display = 'none';
    document.getElementById('adminIntroductionDone').value = '';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
// ── approval logic ────────────────────────────────────────────
function toggleApprovalFields() {
    var status = document.getElementById('adminReqStatus').value;

    if (status === 'OnBoarded') {
        document.getElementById('adminApproveFields').style.display = 'block';
        document.getElementById('adminRejectFields').style.display = 'none';
        document.getElementById('adminReqTeam').value = '';
        var lmSelect = document.getElementById('adminReqLM');
        lmSelect.innerHTML = '<option value="">Select Line Manager</option>';
        lmSelect.disabled = true;
        var smSelect = document.getElementById('adminReqSM');
        smSelect.innerHTML = '<option value="">Select Service Manager</option>';
        smSelect.disabled = true;
    } else if (status === 'Rejected') {
        document.getElementById('adminApproveFields').style.display = 'none';
        document.getElementById('adminRejectFields').style.display = 'block';
        document.getElementById('adminRejectReason').value = '';
    } else {
        document.getElementById('adminApproveFields').style.display = 'none';
        document.getElementById('adminRejectFields').style.display = 'none';
    }
}

function adminTeamChanged() {
    var team = document.getElementById('adminReqTeam').value;
    var lmSelect = document.getElementById('adminReqLM');
    var smSelect = document.getElementById('adminReqSM');

    lmSelect.innerHTML = '<option value="">Select Line Manager</option>';
    smSelect.innerHTML = '<option value="">Select Service Manager</option>';
    smSelect.disabled = true;

    if (!team) {
        lmSelect.disabled = true;
        return;
    }

    var lms = [...new Set(ALL_DATA.filter(function(a) {
        return a.team === team;
    }).map(function(a) {
        return a.lm;
    }))].filter(Boolean).sort();
    lms.forEach(function(lm) {
        var opt = document.createElement('option');
        opt.value = lm;
        opt.textContent = lm;
        lmSelect.appendChild(opt);
    });
    lmSelect.disabled = false;
}

function adminLMChanged() {
    var team = document.getElementById('adminReqTeam').value;
    var lm = document.getElementById('adminReqLM').value;
    var smSelect = document.getElementById('adminReqSM');

    smSelect.innerHTML = '<option value="">Select Service Manager</option>';

    if (!lm) {
        smSelect.disabled = true;
        return;
    }

    var sms = [...new Set(ALL_DATA.filter(function(a) {
        return a.team === team && a.lm === lm;
    }).map(function(a) {
        return a.sm;
    }))].filter(Boolean).sort();
    sms.forEach(function(sm) {
        var opt = document.createElement('option');
        opt.value = sm;
        opt.textContent = sm;
        smSelect.appendChild(opt);
    });
    smSelect.disabled = false;
}

function verifyAndSubmitApproval() {
    var status = document.getElementById('adminReqStatus').value;
    if (!status) {
        alert('Please select Request Status');
        return;
    }

    if (status === 'OnBoarded') {
        var team = document.getElementById('adminReqTeam').value;
        var lm = document.getElementById('adminReqLM').value;
        var sm = document.getElementById('adminReqSM').value;
        if (!team || !lm || !sm) {
            alert('Please select Team, Line Manager and Service Manager');
            return;
        }
    }

    if (status === 'Rejected') {
        var reason = document.getElementById('adminRejectReason').value.trim();
        if (!reason) {
            alert('Please enter a rejection reason');
            return;
        }
    }

    // Build review summary
    var status = document.getElementById('adminReqStatus').value;
    var summaryHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
    summaryHtml += '<div style="padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
        '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Status</div>' +
        '<div style="font-size:13px;font-weight:600;">' + (status === 'OnBoarded' ? 'Approve & Onboard' : 'Reject') + '</div>' +
        '</div>';

    if (status === 'OnBoarded') {
        summaryHtml += '<div style="padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
            '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Team</div>' +
            '<div style="font-size:13px;font-weight:600;">' + document.getElementById('adminReqTeam').value + '</div>' +
            '</div>';
        summaryHtml += '<div style="padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
            '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Line Manager</div>' +
            '<div style="font-size:13px;font-weight:600;">' + document.getElementById('adminReqLM').value + '</div>' +
            '</div>';
        summaryHtml += '<div style="padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
            '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Service Manager</div>' +
            '<div style="font-size:13px;font-weight:600;">' + document.getElementById('adminReqSM').value + '</div>' +
            '</div>';
    }

    if (status === 'Rejected') {
        summaryHtml += '<div style="padding:10px;background:rgba(255,68,68,0.08);border-radius:8px;grid-column:span 2;">' +
            '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Rejection Reason</div>' +
            '<div style="font-size:13px;font-weight:600;color:#ef4444;">' + document.getElementById('adminRejectReason').value.trim() + '</div>' +
            '</div>';
    }

    summaryHtml += '</div>';
    document.getElementById('adminReviewContent').innerHTML = summaryHtml;
    document.getElementById('adminReviewSection').style.display = 'block';
}

async function submitApproval() {
    var submitBtn = event.target;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;animation:spin 1s linear infinite;"></i>Submitting...';

    try {
        var status = document.getElementById('adminReqStatus').value;
        var lmName = document.getElementById('adminReqLM').value;
        var smName = document.getElementById('adminReqSM').value;

        var lmId = lmName ? await getUserId(lmName) : null;
        var smId = smName ? await getUserId(smName) : null;

       var updateData = {
            Request_x0020_Status: status
        };
        if (status === 'OnBoarded') {
            updateData.Team = document.getElementById('adminReqTeam').value;
            if (lmId) updateData.Line_x0020_ManagerId = lmId;
            if (smId) updateData.Service_x0020_ManagerId = smId;
            updateData.Assignment_Date = new Date().toISOString();
            updateData.Introduction_Done = document.getElementById('adminIntroductionDone').value;
        }
        if (status === 'Rejected') {
            updateData.Reject_New_Account_Reason = document.getElementById('adminRejectReason').value.trim();
        }

        await updateSharePointItem(CURRENT_REQUEST_ITEM.ID, updateData);

       document.getElementById('adminSubmitMessage').innerHTML =
            '<span style="color:#10b981;">✅ Request updated successfully!</span>';

        // Log to Account History
        var historyEvent = status === 'OnBoarded' ? 'Approved' : 'Rejected';
        var historyDesc = status === 'OnBoarded'
            ? 'Account approved and onboarded. Team: ' + updateData.Team + ' | LM: ' + lmName + ' | SM: ' + smName
            : 'Account request rejected. Reason: ' + document.getElementById('adminRejectReason').value.trim();
        await logAccountHistory(
            CURRENT_REQUEST_ITEM.Title,
            CURRENT_REQUEST_ITEM.Customer_x0020_Name,
            historyEvent,
            historyDesc,
            USER_CONTEXT.userName,
            '', smName, '', updateData.Team || '',
            status === 'Rejected' ? document.getElementById('adminRejectReason').value.trim() : ''
        );

        if (status === 'OnBoarded') {
            await sendApprovalEmail(CURRENT_REQUEST_ITEM, lmName, smName);
        } else if (status === 'Rejected') {
            await sendRejectionEmailToAMAD(CURRENT_REQUEST_ITEM);
        }

        setTimeout(function() {
            CURRENT_REQUEST_ITEM = null;
            document.getElementById('adminReqStatus').value = '';
            document.getElementById('adminReqTeam').value = '';
            document.getElementById('adminReqLM').value = '';
            document.getElementById('adminReqSM').value = '';
            document.getElementById('adminReviewSection').style.display = 'none';
            document.getElementById('adminSubmitMessage').innerHTML = '';
            document.getElementById('adminReviewContent').innerHTML = '';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Confirm &amp; Submit';
            backToRequestsList();
            loadAccountRequests();
        }, 2000);

    } catch (err) {
        console.error('Submit error:', err);
        document.getElementById('adminSubmitMessage').innerHTML =
            '<span style="color:#ef4444;">Error: ' + err.message + '</span>';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="check" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Confirm &amp; Submit';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ── SharePoint helpers ────────────────────────────────────────
async function updateSharePointItem(itemId, data) {
    var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
        method: 'POST',
        headers: {
            'Accept': 'application/json;odata=verbose'
        },
        credentials: 'include'
    });
    if (!digestRes.ok) throw new Error('Failed to get form digest');
    var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

    var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")", {
        method: 'POST',
        headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest,
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE'
        },
        credentials: 'include',
        body: JSON.stringify(Object.assign({
            __metadata: {
                type: 'SP.Data.Service_x0020_Manager_x0020_RequestListItem'
            }
        }, data))
    });
    if (!res.ok) throw new Error('SharePoint error: ' + (await res.text()));
}

async function getUserEmail(displayName) {
    try {
        var res = await fetch(SP_URL + "/_api/web/siteusers?$filter=Title eq '" + displayName + "'&$select=EMail", {
            headers: {
                'Accept': 'application/json;odata=verbose'
            },
            credentials: 'include'
        });
        if (!res.ok) return null;
        var data = await res.json();
        return data.d.results.length > 0 ? data.d.results[0].EMail : null;
    } catch (e) {
        return null;
    }
}

async function getSDEmails() {
    try {
        var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SP_ACCESS_LIST + "')/items?$select=UserEmailID&$filter=Role eq 'Admin'", {
            headers: {
                'Accept': 'application/json;odata=verbose'
            },
            credentials: 'include'
        });
        if (!res.ok) return [];
        var data = await res.json();
        return data.d.results.map(function(r) {
            return r.UserEmailID;
        }).filter(Boolean);
    } catch (e) {
        return [];
    }
}

async function sendApprovalEmail(item, lmName, smName) {
    try {
        var amEmail = item.Account_x0020_Manager ? item.Account_x0020_Manager.EMail : null;
        var adEmail = item.Account_x0020_Director ? item.Account_x0020_Director.EMail : null;
        var lmEmail = item.Line_x0020_Manager ? item.Line_x0020_Manager.EMail : null;
        var smEmail = item.Service_x0020_Manager ? item.Service_x0020_Manager.EMail : null;
        var sdEmail = item.Service_x0020_Director ? item.Service_x0020_Director.EMail : null;

        var to = [amEmail, adEmail, lmEmail, smEmail].filter(Boolean).join(';');
        var cc = [sdEmail].filter(Boolean).join(';');
        if (!to) return;

        var subject = encodeURIComponent('Account Request Approved - ' + item.Title);
        var body = encodeURIComponent(
            'Dear Team,\n\n' +
            'The following account request has been approved.\n\n' +
            'Account: ' + item.Title + ' - ' + item.Customer_x0020_Name + '\n' +
            'Line Manager: ' + lmName + '\n' +
            'Service Manager: ' + smName + '\n' +
            'Approved By: ' + USER_CONTEXT.userName + '\n\nBest regards,\n' + USER_CONTEXT.userName
        );

        var mailto = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
        if (cc) mailto += '&cc=' + encodeURIComponent(cc);
        window.open(mailto);
    } catch (e) {
        console.error('Email error:', e);
    }
}

async function sendRejectionEmailToAMAD(item) {
    try {
        var amEmail = item.Account_x0020_Manager ? item.Account_x0020_Manager.EMail : null;
        var adEmail = item.Account_x0020_Director ? item.Account_x0020_Director.EMail : null;
        var sdEmail = item.Service_x0020_Director ? item.Service_x0020_Director.EMail : null;
        var reason = document.getElementById('adminRejectReason') ? document.getElementById('adminRejectReason').value.trim() : '';

        var to = [amEmail, adEmail].filter(Boolean).join(';');
        var cc = [sdEmail].filter(Boolean).join(';');
        if (!to) return;

        var subject = encodeURIComponent('Account Request Rejected - ' + item.Title);
        var body = encodeURIComponent(
            'Dear Team,\n\n' +
            'The account request for ' + item.Title + ' - ' + item.Customer_x0020_Name + ' has been rejected.\n\n' +
            'Reason: ' + (reason || 'N/A') + '\n' +
            'Rejected By: ' + USER_CONTEXT.userName + '\n\nBest regards,\n' + USER_CONTEXT.userName
        );

        var mailto = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
        if (cc) mailto += '&cc=' + encodeURIComponent(cc);
        window.open(mailto);
    } catch (e) {
        console.error('Email error:', e);
    }
}
async function logAccountHistory(accountCode, customerName, eventType, description, doneBy, oldSM, newSM, oldTeam, newTeam, reason) {
    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!digestRes.ok) return;
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        await fetch(SP_URL + "/_api/web/lists/getbytitle('Account_History')/items", {
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digest
            },
            credentials: 'include',
            body: JSON.stringify({
               __metadata: { type: 'SP.Data.Account_x005f_HistoryListItem' },
                Title: accountCode,
                Customer_Name: customerName || '',
                Event_Type: eventType,
                Event_Description: description || '',
                Done_By: doneBy || '',
                Event_Date: new Date().toISOString(),
                Old_SM: oldSM || '',
                New_SM: newSM || '',
                Old_Team: oldTeam || '',
                New_Team: newTeam || '',
                Reason: reason || ''
            })
        });
        console.log('[History] Logged:', eventType, 'for', accountCode);
    } catch (e) {
        console.error('[History] Failed to log:', e);
    }
}
window.logAccountHistory = logAccountHistory;
// ── TRANSFER stub ─────────────────────────────────────────────
var TRANSFER_ACCOUNT_DATA = null;
window.loadAccountRequests = loadAccountRequests;
window.reviewRequest = reviewRequest;
window.backToRequestsList = backToRequestsList;
window.searchRequests = searchRequests;
window.verifyAndSubmitApproval = verifyAndSubmitApproval;
window.submitApproval = submitApproval;
window.toggleApprovalFields = toggleApprovalFields;
