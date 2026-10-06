// ============================================================
// transfer.js — Transfer Request Module
// Depends on: SP_URL, SP_LIST, USER_CONTEXT, ALL_DATA (from main)
// ============================================================
if (typeof window.TRANSFER_ACCOUNT_DATA === 'undefined') window.TRANSFER_ACCOUNT_DATA = null;
if (typeof window.CURRENT_TRANSFER_ITEM === 'undefined') window.CURRENT_TRANSFER_ITEM = null;

(function() {
function inject() {
    var content = document.querySelector('.content') || document.body;
    
    function smAppendSection(html) {
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        var sec = wrap.firstElementChild;
        if (!sec) return;
        if (sec.id && document.getElementById(sec.id)) return;
        content.appendChild(sec);
    }

    // d1 — transfer-requests list section
    smAppendSection(`<div id="transfer-requests" class="dashboard-section" style="display: none;">
        <div>
            <h2 style="font-size:1rem;font-weight:800;color:var(--t1);margin:0 0 .85rem!important;padding:0!important;display:flex;align-items:center;gap:.4rem;">
                <i data-lucide="arrow-right-left" style="width: 24px; height: 24px;"></i> Transfer Requests
            </h2>
            <div id="adminTransferLoading" style="text-align:center; padding:60px; font-size:18px;">
                <i data-lucide="loader" style="width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px; animation: spin 1s linear infinite;"></i> Loading...
            </div>
            <div id="adminTransferContent" style="display:none;">
                <div class="table-section">
                   <div class="table-header">
                        <h3 class="table-title">Transfer Requests</h3>
                        <div class="table-actions">
                            <select class="filter-select" id="transferStatusFilter" onchange="renderTransferGridFiltered()" style="width:auto;">
                                <option value="">All Statuses</option>
                                <option value="Transfer_Pending">Pending AM Approval</option>
                                <option value="AM_Approved" selected>AM Approved</option>
                                <option value="OnBoarded">Completed</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                            <input type="text" class="search-box" id="transferSearchBox" placeholder="Search transfers..." oninput="searchTransfers(this.value)">
                            <button type="button" class="export-btn" onclick="exportTransferToExcel()"><i data-lucide="file-spreadsheet" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export to Excel</button>
                        </div>
                    </div>
                    <div id="adminTransferGrid" class="ag-theme-alpine" style="width:100%;min-height:300px;height:500px;"></div>
                </div>
            </div>
        </div>
    </div>`);

    // d2 — sdReviewTransferView ALSO goes into .content as a dashboard-section
    smAppendSection(`<div id="sdReviewTransferView" class="dashboard-section" style="display:none;">
    <div style="max-width:1200px;margin:0 auto;">
        <div class="table-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
                <h3 class="table-title">
                    <i data-lucide="check-circle" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Finalize Transfer
                </h3>
                <button type="button" class="theme-btn" onclick="backToTransfersList()" style="background:rgba(239,68,68,0.15);color:#ef4444;padding:8px 16px;border-radius:10px;border:none;cursor:pointer;font-weight:600;">
                    <i data-lucide="arrow-left" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Back
                </button>
            </div>
            <h4 class="table-title" style="margin-bottom:16px;">
                <i data-lucide="clipboard-list" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Transfer Details
            </h4>
            <div id="sdTransferDetails"></div>
            <h4 class="table-title" style="margin:28px 0 16px;">
                <i data-lucide="user-check" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Assign New Managers
            </h4>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
                <div class="filter-group">
                    <label class="filter-label">Final Team *</label>
                    <select class="filter-select" id="sdFinalTeam" onchange="sdFinalTeamChanged()">
                        <option value="">Select Team</option>
                        <option value="DSM">DSM</option>
                        <option value="TSM_ME">TSM_ME</option>
                        <option value="TSM_SE">TSM_SE</option>
                        <option value="PSD">PSD</option>
                        <option value="Call Centre">Call Centre</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">New Line Manager *</label>
                    <select class="filter-select" id="sdTransferLM" onchange="sdTransferLMChanged()">
                        <option value="">Select Line Manager</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">New Service Manager *</label>
                    <select class="filter-select" id="sdTransferSM" disabled>
                        <option value="">Select Service Manager</option>
                    </select>
                </div>
            </div>
            <div style="display:flex;gap:16px;margin-top:28px;flex-wrap:wrap;">
                <button type="button" class="export-btn" onclick="finalizeTransfer()" style="flex:1;min-width:180px;">
                    <i data-lucide="check" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Finalize Transfer
                </button>
                <button type="button" class="reset-btn" onclick="showDeclineTransferPanel()" style="min-width:160px;background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.3);">
                    <i data-lucide="x-circle" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Decline Transfer
                </button>
                <button type="button" class="reset-btn" onclick="backToTransfersList()">
                    <i data-lucide="x" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Cancel
                </button>
            </div>
            <div id="sdDeclinePanel" style="display:none;margin-top:20px;padding:16px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.3);border-radius:12px;">
                <div class="filter-group">
                    <label class="filter-label">Decline Reason *</label>
                    <textarea class="filter-select" id="sdDeclineReason" rows="3" placeholder="Enter reason for declining this transfer..." style="resize:vertical;cursor:text;"></textarea>
                </div>
                <div style="display:flex;gap:12px;margin-top:12px;">
                    <button type="button" class="export-btn" onclick="submitDeclineTransfer()" style="background:linear-gradient(135deg,#ef4444,#dc2626);">
                        <i data-lucide="x-circle" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Confirm Decline
                    </button>
                    <button type="button" class="reset-btn" onclick="document.getElementById('sdDeclinePanel').style.display='none'">Cancel</button>
                </div>
            </div>
            <div id="sdTransferMessage" style="margin-top:16px;text-align:center;font-weight:600;"></div>
        </div>
    </div>
</div>`);

    // Full-page transferRequestView + adminTransferView are defined in SM.html — do not inject
    // duplicates (duplicate IDs break getElementById and DOM validity).
}    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else { inject(); }
})();

        var TRANSFER_MAPPING_CACHE = null;

        function transferNormalizePersonName(name) {
            return (name || '').trim().replace(/\s+/g, ' ');
        }

        async function transferEnsureMappingData() {
            if (typeof fetchAccountMapping === 'function') {
                await fetchAccountMapping();
            }
            if (typeof window.SM_MAPPING_DATA !== 'undefined' && window.SM_MAPPING_DATA && window.SM_MAPPING_DATA.length) {
                TRANSFER_MAPPING_CACHE = window.SM_MAPPING_DATA;
            } else if (typeof SM_MAPPING_DATA !== 'undefined' && SM_MAPPING_DATA && SM_MAPPING_DATA.length) {
                TRANSFER_MAPPING_CACHE = SM_MAPPING_DATA;
            } else {
                TRANSFER_MAPPING_CACHE = TRANSFER_MAPPING_CACHE || [];
            }
            return TRANSFER_MAPPING_CACHE;
        }

        function transferMappingPool() {
            var seen = {};
            var pool = [];
            (window.ALL_DATA || []).forEach(function (a) {
                [{ n: a.am, team: a.team }, { n: a.ad, team: a.team }].forEach(function (x) {
                    var name = transferNormalizePersonName(x.n);
                    if (!name || seen[name]) return;
                    seen[name] = true;
                    pool.push({
                        name: name,
                        team: x.team || '',
                        email: '',
                        userId: ''
                    });
                });
            });
            return pool.sort(function (a, b) { return a.name.localeCompare(b.name); });
        }

        function transferMappingFieldIds(field) {
            if (field === 'am') {
                return { input: 'transferAMInput', dd: 'transferAMDD', hidden: 'transferAMSelected' };
            }
            return { input: 'transferADInput', dd: 'transferADDD', hidden: 'transferADSelected' };
        }

        function transferGetSelectedMapping(field) {
            var ids = transferMappingFieldIds(field);
            var el = document.getElementById(ids.hidden);
            if (!el || !el.value) return null;
            try {
                var parsed = JSON.parse(el.value);
                if (parsed && parsed.confirmed && parsed.name) return parsed;
            } catch (e) {}
            return null;
        }

        window.transferMappingInput = function (field) {
            var ids = transferMappingFieldIds(field);
            var hidden = document.getElementById(ids.hidden);
            if (hidden) hidden.value = '';
        };

        window.transferMappingSearch = function (field, q) {
            var ids = transferMappingFieldIds(field);
            var dd = document.getElementById(ids.dd);
            if (!dd) return;
            var lower = (q || '').toLowerCase();
            var pool = transferMappingPool().slice();
            var results = lower
                ? pool.filter(function (a) {
                    return a.name.toLowerCase().indexOf(lower) >= 0 ||
                        (a.team || '').toLowerCase().indexOf(lower) >= 0 ||
                        (a.email || '').toLowerCase().indexOf(lower) >= 0;
                })
                : pool.slice(0, 40);

            dd.innerHTML = '';
            if (!results.length) {
                dd.innerHTML = '<div class="sm-person-item" style="color:var(--t3);font-size:.82rem;">No matches in Service Manager Request accounts</div>';
                dd.style.display = 'block';
                return;
            }
            results.forEach(function (a) {
                var item = document.createElement('div');
                item.className = 'sm-person-item';
                item.innerHTML = '<div style="font-size:.83rem;font-weight:600;color:var(--t1);">' + a.name + '</div>' +
                    '<div style="font-size:.72rem;color:var(--t3);">' + (a.team || '') + (a.email ? ' · ' + a.email : '') + '</div>';
                item.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    transferSelectMappingPerson(field, a.name, a.userId, a.team, a.email);
                });
                dd.appendChild(item);
            });
            dd.style.display = 'block';
        };

        window.transferSelectMappingPerson = function (field, name, userId, team, email) {
            var ids = transferMappingFieldIds(field);
            var hidden = document.getElementById(ids.hidden);
            var inp = document.getElementById(ids.input);
            var dd = document.getElementById(ids.dd);
            var normalized = transferNormalizePersonName(name);
            if (hidden) {
                hidden.value = JSON.stringify({
                    confirmed: true,
                    name: normalized,
                    userId: userId != null ? String(userId).trim() : '',
                    email: email != null ? String(email).trim() : '',
                    team: team || ''
                });
            }
            if (inp) inp.value = normalized;
            if (dd) dd.style.display = 'none';
        };

        function transferResetSeAmAdPickers() {
            ['am', 'ad'].forEach(function (field) {
                var ids = transferMappingFieldIds(field);
                var inp = document.getElementById(ids.input);
                var hidden = document.getElementById(ids.hidden);
                var dd = document.getElementById(ids.dd);
                if (inp) inp.value = '';
                if (hidden) hidden.value = '';
                if (dd) { dd.innerHTML = ''; dd.style.display = 'none'; }
            });
            var section = document.getElementById('transferSeAmAdSection');
            if (section) section.style.display = 'none';
        }

        function transferResetTransferSubmitButton() {
            var view = document.getElementById('transferRequestView');
            if (!view) return;
            var btn = view.querySelector('.export-btn');
            if (!btn) return;
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="send" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Submit Transfer Request';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        async function transferPrepareSeTransferForm(amPrefill, adPrefill) {
            await transferEnsureMappingData();
            var section = document.getElementById('transferSeAmAdSection');
            if (section) section.style.display = 'block';
            var amInp = document.getElementById('transferAMInput');
            var adInp = document.getElementById('transferADInput');
            var amH = document.getElementById('transferAMSelected');
            var adH = document.getElementById('transferADSelected');
            if (amInp) amInp.value = transferNormalizePersonName(amPrefill);
            if (adInp) adInp.value = transferNormalizePersonName(adPrefill);
            if (amH) amH.value = '';
            if (adH) adH.value = '';
        }

        function openTransferRequest(code, customer, team, lm, sm, am, ad, opts) {
            opts = opts || {};
            const lastThree = getLastThreeCompletedMonths();
            const fromTsmSe = !!opts.fromTsmSe;
            const parentAcc = fromTsmSe ? (opts.seRow || null) : ALL_DATA.find(a => a.code === code);
            const childAccounts = fromTsmSe ? [] : ALL_DATA.filter(a => a.type === 'Child' && a.parent === code && a.code !== code);

            const combined0 = (parentAcc?.[lastThree[0].key] || 0) + childAccounts.reduce((s, c) => s + (c[lastThree[0].key] || 0), 0);
            const combined1 = (parentAcc?.[lastThree[1].key] || 0) + childAccounts.reduce((s, c) => s + (c[lastThree[1].key] || 0), 0);
            const combined2 = (parentAcc?.[lastThree[2].key] || 0) + childAccounts.reduce((s, c) => s + (c[lastThree[2].key] || 0), 0);
            const combinedAvg = (combined0 + combined1 + combined2) / 3;

            TRANSFER_ACCOUNT_DATA = {
                code,
                customer,
                team,
                lm,
                sm,
                am,
                ad,
                combinedRev: combined2,
                combinedAvgRev: combinedAvg,
                fromTsmSe: fromTsmSe,
                tsmSeItemId: opts.tsmSeItemId || (parentAcc && parentAcc._spId) || null,
                seRow: fromTsmSe ? parentAcc : null,
                transferDirection: opts.transferDirection || ''
            };

            let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">';
            const fields = [
                ['Account Code', code],
                ['Customer Name', customer],
                ['Current Team', team],
                ['Line Manager', lm],
                ['Service Manager', sm]
            ];
            if (!fromTsmSe) {
                fields.push(['Account Manager', am], ['Account Director', ad]);
            }
            fields.push(
                [lastThree[0].label + ' Revenue (Group+Children)', formatCurrency(combined0)],
                [lastThree[1].label + ' Revenue (Group+Children)', formatCurrency(combined1)],
                [lastThree[2].label + ' Revenue (Group+Children)', formatCurrency(combined2)],
                ['Avg Revenue (Last 3 Completed Months)', formatCurrency(combinedAvg)]
            );

            fields.forEach(([label, value]) => {
                html += `
            <div style="padding: 12px; background: rgba(168, 85, 247, 0.1); border-radius: 8px;">
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">${label}</div>
                <div style="font-size: 14px; font-weight: 600;">${value}</div>
            </div>`;
            });
            html += '</div>';

            document.getElementById('transferAccountInfo').innerHTML = html;
            document.getElementById('transferNewTeam').value = '';
            document.getElementById('transferReason').value = '';
            document.getElementById('transferSubmitMessage').innerHTML = '';

            if (fromTsmSe) {
                transferPrepareSeTransferForm(am, ad);
            } else {
                transferResetSeAmAdPickers();
            }

            document.getElementById('dashboardContent').style.display = 'none';
            document.getElementById('transferRequestView').style.display = 'block';
        }

        function backToDashboard() {
            transferResetSeAmAdPickers();
            document.getElementById('transferRequestView').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';
        }

        function submitTransferRequest() {
            const newTeam = document.getElementById('transferNewTeam').value;
            const reason = document.getElementById('transferReason').value;
            const tDataEarly = TRANSFER_ACCOUNT_DATA || {};

            if (!newTeam) {
                alert('Please select proposed new team');
                return;
            }

            if (tDataEarly.fromTsmSe) {
                if (!transferGetSelectedMapping('am')) {
                    alert('Please select Account Manager from the Service Manager Request list.');
                    return;
                }
                if (!transferGetSelectedMapping('ad')) {
                    alert('Please select Account Director from the Service Manager Request list.');
                    return;
                }
            }

            const submitBtn = event.target;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px; animation: spin 1s linear infinite;"></i>Submitting...';

            const tData = TRANSFER_ACCOUNT_DATA || {};
            if (tData.fromTsmSe) {
                transferCheckOpenTransfer(tData.code).then(function (open) {
                    if (open) throw new Error('A transfer is already open for this account.');
                    return fetch(SP_URL + "/_api/web/currentuser?$select=Id", {
                        headers: { Accept: 'application/json;odata=verbose' },
                        credentials: 'include'
                    }).then(function (r) { return r.json(); });
                }).then(function (userData) {
                    var seRow = tData.seRow || {};
                    if (!seRow.code) seRow = Object.assign({}, seRow, {
                        code: tData.code,
                        customer: tData.customer,
                        team: tData.team,
                        lm: tData.lm,
                        sm: tData.sm,
                        am: tData.am,
                        ad: tData.ad,
                        _spId: tData.tsmSeItemId
                    });
                    var amPick = transferGetSelectedMapping('am');
                    var adPick = transferGetSelectedMapping('ad');
                    if (amPick) {
                        seRow.am = amPick.name;
                        seRow.amPick = amPick;
                    }
                    if (adPick) {
                        seRow.ad = adPick.name;
                        seRow.adPick = adPick;
                    }
                    return transferResolveFromMappingPick(amPick).then(function (amId) {
                        if (!amId) {
                            throw new Error('Could not resolve Account Manager "' + (amPick.name || '') + '" to a SharePoint user. Check Email_ID / User_ID in Account Mapping.');
                        }
                        seRow.amUserId = amId;
                        return transferResolveFromMappingPick(adPick);
                    }).then(function (adId) {
                        if (!adId) {
                            throw new Error('Could not resolve Account Director "' + (adPick.name || '') + '" to a SharePoint user. Check Email_ID / User_ID in Account Mapping.');
                        }
                        seRow.adUserId = adId;
                        return transferCreateSmRequestFromTsmSe(seRow, newTeam, reason, userData.d.Id);
                    });
                }).then(function () {
                    document.getElementById('transferSubmitMessage').innerHTML = '<span style="color: var(--success);">Transfer request submitted successfully!</span>';
                    if (typeof logAccountHistory === 'function') {
                        logAccountHistory(
                            tData.code,
                            tData.customer,
                            'Transfer Raised',
                            'Transfer request raised from TSM SE. Proposed Team: ' + newTeam + ' | Reason: ' + (reason || 'Revenue threshold'),
                            USER_CONTEXT.userName,
                            tData.sm || '',
                            '',
                            tData.team || 'TSM_SE',
                            newTeam,
                            ''
                        );
                    }
                    setTimeout(function () {
                        document.getElementById('transferNewTeam').value = '';
                        document.getElementById('transferReason').value = '';
                        document.getElementById('transferSubmitMessage').innerHTML = '';
                        transferResetSeAmAdPickers();
                        TRANSFER_ACCOUNT_DATA = null;
                        document.getElementById('transferAccountInfo').innerHTML = '';
                        transferResetTransferSubmitButton();
                        backToDashboard();
                        var refreshChain = Promise.resolve();
                        if (typeof window.tsmSeRefreshAfterTransfer === 'function') {
                            refreshChain = window.tsmSeRefreshAfterTransfer();
                        } else if (typeof loadTSMSEData === 'function') {
                            window.TSM_SE_LOADED = false;
                            refreshChain = loadTSMSEData(null, true).then(function () {
                                if (document.getElementById('filterTeam') && document.getElementById('filterTeam').value === 'TSM_SE' && typeof tsmSeRenderTable === 'function') {
                                    tsmSeRenderTable();
                                }
                                if (typeof window.tsmSeHideSpinner === 'function') window.tsmSeHideSpinner();
                            });
                        }
                        refreshChain.then(function () {
                            if (typeof window.smRefreshDashboardData === 'function') {
                                return window.smRefreshDashboardData();
                            }
                        }).catch(function (e) {
                            console.warn('[Transfer] Post-submit refresh:', e);
                        });
                    }, 1200);
                }).catch(function (err) {
                    console.error('[✗] TSM SE transfer error:', err);
                    document.getElementById('transferSubmitMessage').innerHTML = '<span style="color: var(--danger);">Error: ' + err.message + '</span>';
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i data-lucide="send" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Submit Transfer Request';
                    lucide.createIcons();
                });
                return;
            }

            const _parentAccount = ALL_DATA.find(a => a.code === TRANSFER_ACCOUNT_DATA.code);
            if (_parentAccount) {
                const subj = encodeURIComponent(`[Transfer Request] ACC# ${_parentAccount.code} - ${_parentAccount.customer}`);
                const bdy = encodeURIComponent(
                    `Dear ${_parentAccount.am} / ${_parentAccount.ad},

A transfer request has been submitted and requires your approval.

Account: ${_parentAccount.code} - ${_parentAccount.customer}
Current Team: ${_parentAccount.team}
Proposed Team: ${newTeam}
Line Manager: ${_parentAccount.lm}
Service Manager: ${_parentAccount.sm}
Reason: ${reason || 'Revenue threshold breached'}
Requested By: ${USER_CONTEXT.userName}

Please log in to the Service Management Dashboard and go to "Pending Transfer Requests" to Approve or Reject.

Best regards,
${USER_CONTEXT.userName}`);
                const to = encodeURIComponent(`${_parentAccount.am}; ${_parentAccount.ad}`);
                const cc = encodeURIComponent(`${_parentAccount.lm}; ${_parentAccount.sm}; ${USER_CONTEXT.userName}`);
                window.location.href = `mailto:${to}?subject=${subj}&body=${bdy}&cc=${cc}`;
            }

            transferCheckOpenTransfer(TRANSFER_ACCOUNT_DATA.code).then(function (open) {
                if (open) throw new Error('A transfer is already open for this account.');
                return fetch(SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items?$select=ID,Title,Dashboard_Active,Account_Source&$filter=Title eq '" + transferSafeCode(TRANSFER_ACCOUNT_DATA.code) + "'&$top=20", {
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });
            })
                .then(r => r.json())
                .then(searchData => {
                    var hits = searchData.d.results || [];
                    var active = hits.find(function (h) { return transferIsDashboardActive(h) && !transferIsTsmSeSourceItem(h); }) ||
                        hits.find(function (h) { return transferIsDashboardActive(h); }) ||
                        hits[0];
                    if (!active) throw new Error('Account not found');
                    const itemId = active.ID;
                    return fetch(SP_URL + "/_api/web/currentuser?$select=Id", {
                            headers: {
                                'Accept': 'application/json;odata=verbose'
                            },
                            credentials: 'include'
                        })
                        .then(r => r.json())
                        .then(userData => ({
                            itemId,
                            currentUserId: userData.d.Id
                        }));
                })
                .then(({
                    itemId,
                    currentUserId
                }) => {
                    return fetch(SP_URL + "/_api/contextinfo", {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json;odata=verbose'
                            },
                            credentials: 'include'
                        })
                        .then(r => r.json())
                        .then(digestData => ({
                            itemId,
                            currentUserId,
                            digest: digestData.d.GetContextWebInformation.FormDigestValue
                        }));
                })
                .then(({
                    itemId,
                    currentUserId,
                    digest
                }) => {
                    return fetch(SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")", {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json;odata=verbose',
                            'Content-Type': 'application/json;odata=verbose',
                            'X-RequestDigest': digest,
                            'IF-MATCH': '*',
                            'X-HTTP-Method': 'MERGE'
                        },
                        credentials: 'include',
                     body: JSON.stringify({
    __metadata: { type: 'SP.Data.Service_x0020_Manager_x0020_RequestListItem' },
 Request_x0020_Type: 'Transfer',
    Request_x0020_Status: 'Transfer_Pending',
    Proposed_x0020_Team: newTeam,
    Transfer_x0020_Reason: reason || 'Revenue drop - transfer requested',
    Requested_x0020_ById: currentUserId,
    Transfer_Request_Date: new Date().toISOString()
})
                    });
                })
                .then(() => {
document.getElementById('transferSubmitMessage').innerHTML = '<span style="color: var(--success);">Transfer request submitted successfully!</span>';
                    if (typeof logAccountHistory === 'function') {
                        logAccountHistory(
                            TRANSFER_ACCOUNT_DATA.code,
                            TRANSFER_ACCOUNT_DATA.customer,
                            'Transfer Raised',
                            'Transfer request raised. Proposed Team: ' + newTeam + ' | Reason: ' + (reason || 'Revenue threshold'),
                            USER_CONTEXT.userName,
                            TRANSFER_ACCOUNT_DATA.sm || '',
                            '',
                            TRANSFER_ACCOUNT_DATA.team || '',
                            newTeam,
                            ''
                        );
                    }
                    setTimeout(() => {
                        document.getElementById('transferNewTeam').value = '';
                        document.getElementById('transferReason').value = '';
                        document.getElementById('transferSubmitMessage').innerHTML = '';
                        TRANSFER_ACCOUNT_DATA = null;
                        document.getElementById('transferAccountInfo').innerHTML = '';
                        backToDashboard();
                        if (USER_CONTEXT.isAdmin || USER_CONTEXT.isLM || USER_CONTEXT.isSM) {
                            init();
                        }
                    }, 2000);
                })
                .catch(err => {
                    console.error('[✗] Transfer request error:', err);
                    document.getElementById('transferSubmitMessage').innerHTML = '<span style="color: var(--danger);">Error: ' + err.message + '</span>';
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i data-lucide="send" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Submit Transfer Request';
                    lucide.createIcons();
                });
        }
        async function getCurrentUserId() {
            try {
                const url = SP_URL + "/_api/web/currentuser?$select=Id";
                const res = await fetch(url, {
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });
                if (!res.ok) return null;
                const data = await res.json();
                return data.d.Id;
            } catch (err) {
                return null;
            }
        }

        async function sendTransferEmailToAM(account, newTeam, reason) {
            try {
                const subject = encodeURIComponent(`Account Transfer Request - ${account.code}`);
                const body = encodeURIComponent(`Dear ${account.am},

A transfer request has been submitted for the following account:

Account Code: ${account.code}
Customer Name: ${account.customer}
Current Team: ${account.team}
Proposed New Team: ${newTeam}
Current Dec Revenue: ${formatCurrency(account.decRev)}

Reason: ${reason || 'Revenue drop - transfer requested'}

Please review and approve this transfer request in your dashboard.

Best regards,
${USER_CONTEXT.userName}`);

                console.log('Transfer email notification ready for:', account.am);
                // window.open(`mailto:${account.am}?subject=${subject}&body=${body}`);
            } catch (err) {
                console.error('Email error:', err);
            }
        }

        // ========================================
        // AM TRANSFER REQUEST FUNCTIONS
        // ========================================

        function showAMTransferRequests() {
            document.getElementById('amAdDashboard').style.display = 'none';
            document.getElementById('amTransferRequestsView').style.display = 'block';
            loadAMTransferRequests();
        }

        function backToAMDashboard2() {
            document.getElementById('amTransferRequestsView').style.display = 'none';
            document.getElementById('amAdDashboard').style.display = 'block';
        }

        async function loadAMTransferRequests() {
            try {
                document.getElementById('amTransferLoading').style.display = 'block';
                document.getElementById('amTransferContent').style.display = 'none';

                const userName = USER_CONTEXT.userName;
                const userRole = USER_CONTEXT.role;

                let filterClause = "";
                if (userRole === 'Account Manager') {
                    filterClause = "Account_x0020_Manager/Title eq '" + userName + "'";
                } else if (userRole === 'Account Director') {
                    filterClause = "Account_x0020_Director/Title eq '" + userName + "'";
                }

                const url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items?" +
"$select=ID,Title,Customer_x0020_Name,Team,Proposed_x0020_Team," + getLastThreeCompletedMonths()[2].field + "," +    
"Request_x0020_Type,Request_x0020_Status," +
                    "Account_x0020_Manager/Title,Account_x0020_Director/Title,Requested_x0020_By/Title&" +
                    "$expand=Account_x0020_Manager,Account_x0020_Director,Requested_x0020_By&" +
"$filter=Request_x0020_Type eq 'Transfer' and (Request_x0020_Status eq 'Transfer_Pending' or Request_x0020_Status eq 'Not Onboarded') and " + filterClause + "&" +
                    "$top=500";

                const res = await fetch(url, {
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });

                if (!res.ok) throw new Error('Failed to load transfer requests');

                const data = await res.json();
                const requests = data.d.results;

                document.getElementById('amTransferTbody').innerHTML = requests.map(r => `
            <tr>
                <td><strong>${r.Title}</strong></td>
                <td>${r.Customer_x0020_Name}</td>
                <td><span class="status-badge badge-warning">${r.Team}</span></td>
                <td><span class="status-badge badge-success">${r.Proposed_x0020_Team}</span></td>
<td style="color: #ef4444; font-weight: 700;">${formatCurrency(parseFloat(r[getLastThreeCompletedMonths()[2].field]) || 0)}</td>                <td>${r.Requested_x0020_By ? r.Requested_x0020_By.Title : 'Unknown'}</td>
                <td>
<button type="button" class="export-btn" style="padding: 8px 16px; font-size: 12px;" onclick="reviewTransferRequest(${r.ID})">
    <i data-lucide="eye" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i>Review & Approve
</button>
                </td>
            </tr>
        `).join('');

                document.getElementById('amTransferLoading').style.display = 'none';
                document.getElementById('amTransferContent').style.display = 'block';

            } catch (err) {
                console.error('Error:', err);
                document.getElementById('amTransferLoading').innerHTML = '<div style="color:#ef4444;">Error: ' + err.message + '</div>';
            }
        }

        async function approveTransferByAM(itemId) {
            if (!confirm('Approve this transfer request and forward to Service Director?')) return;

            try {
                // Get item details before updating
                const itemUrl = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")?" +
                    "$select=Title,Customer_x0020_Name,Team,Proposed_x0020_Team,Transfer_x0020_Reason," +
                    "Line_x0020_Manager/Title,Line_x0020_Manager/EMail," +
                    "Service_x0020_Manager/Title,Service_x0020_Manager/EMail," +
                    "Account_x0020_Manager/Title,Account_x0020_Manager/EMail," +
                    "Account_x0020_Director/Title,Account_x0020_Director/EMail," +
                    "Service_x0020_Director/Title,Service_x0020_Director/EMail&" +
                    "$expand=Line_x0020_Manager,Service_x0020_Manager,Account_x0020_Manager,Account_x0020_Director,Service_x0020_Director";

                const itemRes = await fetch(itemUrl, {
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });

                if (!itemRes.ok) throw new Error('Failed to load item');
                const itemData = await itemRes.json();
                const item = itemData.d;

                const updateData = {
                    Request_x0020_Status: 'AM_Approved'
                };

             await updateSharePointItem(itemId, updateData);

                if (typeof logAccountHistory === 'function') {
                    await logAccountHistory(
                        item.Title,
                        item.Customer_x0020_Name,
                        'Transfer Approved by AM',
                        'Transfer approved by ' + USER_CONTEXT.userName + '. Proposed Team: ' + item.Proposed_x0020_Team,
                        USER_CONTEXT.userName,
                        item.Service_x0020_Manager ? item.Service_x0020_Manager.Title : '',
                        '',
                        item.Team || '',
                        item.Proposed_x0020_Team || '',
                        ''
                    );
                }

                // Send email to Service Director
                await sendTransferApprovalEmailToSD(item);

                closeTransferReview();
                loadAMTransferRequests();

            } catch (err) {
                alert('Error: ' + err.message);
            }
        }

        async function sendTransferApprovalEmailToSD(item) {
            const amName = item.Account_x0020_Manager?.Title || 'AM';
            const adName = item.Account_x0020_Director?.Title || 'AD';
            const lmName = item.Line_x0020_Manager?.Title || 'N/A';
            const smName = item.Service_x0020_Manager?.Title || 'N/A';

            // Strip HTML from reason field
            const rawReason = item.Transfer_x0020_Reason || '';
            const cleanReason = rawReason.replace(/<[^>]*>/g, '').trim() || 'Revenue threshold breached';

            // Use the SD directly linked to this account
            const sdName = item.Service_x0020_Director?.Title || 'Service Director';
            const sdEmail = item.Service_x0020_Director?.EMail || '';
            const toRecipients = sdEmail;
            const sdGreeting = sdName;

            const subj = encodeURIComponent(`[AM Approved] Transfer Request - ACC# ${item.Title} | ${item.Customer_x0020_Name}`);
            const _bdy = encodeURIComponent(
                `Dear ${sdGreeting},

A transfer request has been approved by ${USER_CONTEXT.userName} and requires your action.

Account: ${item.Title} - ${item.Customer_x0020_Name}
Current Team: ${item.Team}
Proposed Team: ${item.Proposed_x0020_Team}
Line Manager: ${lmName}
Service Manager: ${smName}
Account Manager: ${amName}
Account Director: ${adName}
Reason: ${cleanReason}

Please log in to the Service Management Dashboard and go to "Transfer Requests" to assign the new Line Manager and Service Manager.

Best regards,
${USER_CONTEXT.userName}`);

            const _cc = encodeURIComponent(`${amName}; ${adName}; ${USER_CONTEXT.userName}`);
            window.location.href = `mailto:${toRecipients}?subject=${subj}&body=${_bdy}&cc=${_cc}`;
        }

        async function reviewTransferRequest(itemId) {
            try {
                // Fetch full item details
                const url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")?" +
                    "$select=ID,Title,Parent_x0020_Code,Customer_x0020_Name,Team,Proposed_x0020_Team," +
                    "Transfer_x0020_Reason,Oct_x002d_25,Nov_x002d_25,Dec_x002d_25," +
                    "Line_x0020_Manager/Title,Service_x0020_Manager/Title," +
                    "Account_x0020_Manager/Title,Account_x0020_Director/Title," +
                    "POC_x0020_Name,POC_x0020_Email_x0020_ID,POC_x0020_Contact_x0020_No,Requested_x0020_By/Title&" +
                    "$expand=Line_x0020_Manager,Service_x0020_Manager,Account_x0020_Manager,Account_x0020_Director,Requested_x0020_By";
                const res = await fetch(url, {
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });

                if (!res.ok) throw new Error('Cannot load request details');

                const data = await res.json();
                const item = data.d;

                // Build detailed view
                let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">';

                const accountDetails = [
                    ['Account Code', item.Title],
                    ['L-10 Account', item.Parent_x0020_Code || 'N/A'],
                    ['Customer Name', item.Customer_x0020_Name],
                    ['Current Team', item.Team],
                    ['Proposed New Team', item.Proposed_x0020_Team],
                    ['Line Manager', item.Line_x0020_Manager?.Title || ''],
                    ['Service Manager', item.Service_x0020_Manager?.Title || ''],
                    ['Account Manager', item.Account_x0020_Manager?.Title || ''],
                    ['Account Director', item.Account_x0020_Director?.Title || ''],
                    ['POC Name', item.POC_x0020_Name],
                    ['POC Email', item.POC_x0020_Email_x0020_ID],
                    ['POC Contact', item.POC_x0020_Contact_x0020_No],
                    ['Requested By', item.Requested_x0020_By?.Title || 'Unknown'],
                    ['Transfer Reason', (item.Transfer_x0020_Reason || 'Revenue drop').replace(/<[^>]*>/g, '').trim()]
                ];

                accountDetails.forEach(([label, value]) => {
                    const isHighlight = label === 'Proposed New Team';
                    html += `
                <div style="padding: 12px; background: ${isHighlight ? 'rgba(16, 185, 129, 0.15)' : 'rgba(168, 85, 247, 0.1)'}; border-radius: 8px; border: ${isHighlight ? '2px solid var(--success)' : 'none'};">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">${label}</div>
                    <div style="font-size: 14px; font-weight: 600;">${value || 'N/A'}</div>
                </div>
            `;
                });

                html += '</div>';

                html += '<h4 style="margin: 24px 0 16px; font-size: 16px; font-weight: 700;"><i data-lucide="bar-chart-3" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Past Revenue Performance</h4>';
                html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px;">';

                // 🔧 FIX: Dynamic months for transfer review
                const lastThree = getLastThreeCompletedMonths();

                const revenueData = [
                    [lastThree[0].label, item[lastThree[0].field]],
                    [lastThree[1].label, item[lastThree[1].field]],
                    [lastThree[2].label, item[lastThree[2].field]]
                ];

                revenueData.forEach(([month, value]) => {
                    if (value !== null && value !== undefined) {
                        html += `
            <div style="padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; text-align: center;">
                <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">${month}</div>
                <div style="font-size: 14px; font-weight: 700;">${formatCurrency(parseFloat(value))}</div>
            </div>
        `;
                    }
                });

                html += '</div>';
                html += '<div style="margin-top: 32px;">';
                html += '<label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 8px;">Rejection Reason (if rejecting):</label>';
                html += '<textarea id="rejectionReason_' + itemId + '" rows="3" style="width: 100%; padding: 12px; border: 1.5px solid var(--border-color); border-radius: 12px; font-family: inherit; font-size: 14px; resize: vertical;" placeholder="Optional"></textarea>';
                html += '</div>';
                html += '<div style="display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap;">';
                html += `<button type="button" class="export-btn" onclick="approveTransferByAM(${itemId})" style="flex: 0 0 auto; font-size: 14px; padding: 14px; min-width: 200px;">
    <i data-lucide="check-circle" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Approve Transfer
</button>`;
                html += `<button type="button" class="reset-btn" onclick="rejectTransferByAM(${itemId})" style="flex: 0 0 auto; font-size: 14px; padding: 14px; min-width: 150px;">
    <i data-lucide="x-circle" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Reject
</button>`;
                html += '</div>';

                // Show in a modal/overlay
                const overlay = document.createElement('div');
                overlay.id = 'transferReviewOverlay';
                overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;';

                overlay.innerHTML = `
            <div style="background: var(--bg-card); border-radius: 20px; padding: 32px; max-width: 1000px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="font-size: 24px; font-weight: 700; margin: 0;"><i data-lucide="repeat" style="width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px;"></i>Transfer Request Review</h2>
                    <button onclick="closeTransferReview()" style="background: none; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary);">×</button>
                </div>
                ${html}
            </div>
        `;

                if (typeof smMountPopup === 'function') smMountPopup(overlay);
                else document.body.appendChild(overlay);

            } catch (err) {
                console.error('Error:', err);
                alert('Error loading transfer details: ' + err.message);
            }
        }

        function closeTransferReview() {
            const overlay = document.getElementById('transferReviewOverlay');
            if (overlay) overlay.remove();
        }

        async function rejectTransferByAM(itemId) {
            const rejectionReason = document.getElementById('rejectionReason_' + itemId)?.value.trim();

            if (!rejectionReason) {
                alert('Please enter a reason for rejection');
                return;
            }

            if (!confirm('Are you sure you want to REJECT this transfer request?')) return;

            try {
                // Get item details
                const itemUrl = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")?" +
                    "$select=Title,Customer_x0020_Name,Team,Proposed_x0020_Team,Account_Source,Dashboard_Active,TSM_SE_ITEM_ID," +
                    "Line_x0020_Manager/Title,Line_x0020_Manager/EMail," +
                    "Service_x0020_Manager/Title,Service_x0020_Manager/EMail," +
                    "Account_x0020_Manager/Title,Account_x0020_Manager/EMail," +
                    "Account_x0020_Director/Title,Account_x0020_Director/EMail&" +
                    "$expand=Line_x0020_Manager,Service_x0020_Manager,Account_x0020_Manager,Account_x0020_Director";

                const itemRes = await fetch(itemUrl, {
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });

                if (!itemRes.ok) throw new Error('Failed to load item');
                const itemData = await itemRes.json();
                const item = itemData.d;

                if (transferIsTsmSeSourceItem(item) && !transferIsDashboardActive(item)) {
                    await transferDeleteMainAccount(itemId);
                    if (typeof logAccountHistory === 'function') {
                        await logAccountHistory(
                            item.Title,
                            item.Customer_x0020_Name,
                            'Transfer Rejected by AM',
                            'Transfer rejected by ' + USER_CONTEXT.userName + '. Reason: ' + rejectionReason,
                            USER_CONTEXT.userName,
                            item.Service_x0020_Manager ? item.Service_x0020_Manager.Title : '',
                            '',
                            'TSM_SE',
                            '',
                            rejectionReason
                        );
                    }
                    await sendRejectionEmail(item, rejectionReason);
                    alert('Transfer rejected. TSM SE account unchanged.');
                    if (typeof init === 'function') init();
                    return;
                }

                // [OK] FIX: Get form digest first
                const digestRes = await fetch(SP_URL + "/_api/contextinfo", {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });

                if (!digestRes.ok) throw new Error('Failed to get form digest');
                const digestData = await digestRes.json();
                const digest = digestData.d.GetContextWebInformation.FormDigestValue;

                // [OK] Step 1: Clear the lookup/choice fields that need to be null
                const clearFieldsUrl = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")";

                const clearFieldsData = {
                    __metadata: {
                        type: 'SP.Data.Service_x0020_Manager_x0020_RequestListItem'
                    },
                    Proposed_x0020_Team: null,
                    Transfer_x0020_Reason: null,
                    Requested_x0020_ById: null
                };

                const clearRes = await fetch(clearFieldsUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;odata=verbose',
                        'Content-Type': 'application/json;odata=verbose',
                        'X-RequestDigest': digest,
                        'IF-MATCH': '*',
                        'X-HTTP-Method': 'MERGE'
                    },
                    credentials: 'include',
                    body: JSON.stringify(clearFieldsData)
                });

                if (!clearRes.ok) {
                    const errorText = await clearRes.text();
                    console.error('Failed to clear fields:', errorText);
                }

                // [OK] Step 2: Update status and set rejection reason
                const updateData = {
                    __metadata: {
                        type: 'SP.Data.Service_x0020_Manager_x0020_RequestListItem'
                    },
                    Request_x0020_Status: 'OnBoarded',
                    Request_x0020_Type: 'New Account',
                    Rejection_x0020_Reason: rejectionReason,
                    Team: item.Team // KEEP ORIGINAL TEAM (don't use Proposed_Team)
                };

                const updateRes = await fetch(clearFieldsUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;odata=verbose',
                        'Content-Type': 'application/json;odata=verbose',
                        'X-RequestDigest': digest,
                        'IF-MATCH': '*',
                        'X-HTTP-Method': 'MERGE'
                    },
                    credentials: 'include',
                    body: JSON.stringify(updateData)
                });

                if (!updateRes.ok) {
                    const errorText = await updateRes.text();
                    throw new Error('SharePoint update failed: ' + errorText);
                }

                console.log('[✓] Transfer request rejected successfully');

             if (typeof logAccountHistory === 'function') {
                    await logAccountHistory(
                        item.Title,
                        item.Customer_x0020_Name,
                        'Transfer Rejected by AM',
                        'Transfer rejected by ' + USER_CONTEXT.userName + '. Reason: ' + rejectionReason,
                        USER_CONTEXT.userName,
                        item.Service_x0020_Manager ? item.Service_x0020_Manager.Title : '',
                        '',
                        item.Team || '',
                        '',
                        rejectionReason
                    );
                }

                // Send rejection email
                await sendRejectionEmail(item, rejectionReason);

                closeTransferReview();
                loadAMTransferRequests();

            } catch (err) {
                console.error('[✗] Rejection error:', err);
                alert('Error: ' + err.message);
            }
        }

        function sendRejectionEmail(item, rejectionReason) {
            const amName = item.Account_x0020_Manager?.Title || 'AM';
            const adName = item.Account_x0020_Director?.Title || 'AD';
            const lmName = item.Line_x0020_Manager?.Title || 'N/A';
            const smName = item.Service_x0020_Manager?.Title || 'N/A';

            const subj = encodeURIComponent(`[Transfer Rejected] ACC# ${item.Title} | ${item.Customer_x0020_Name}`);
            const bdy = encodeURIComponent(
                `Dear ${amName} / ${adName},

A transfer request for the below account has been rejected by ${USER_CONTEXT.userName}.

Account: ${item.Title} - ${item.Customer_x0020_Name}
Current Team: ${item.Team} (unchanged)
Line Manager: ${lmName}
Service Manager: ${smName}
Rejection Reason: ${rejectionReason}

The account remains with its current team. No further action is required.

Best regards,
${USER_CONTEXT.userName}`);

            const to = encodeURIComponent(`${amName}; ${adName}`);
            const cc = encodeURIComponent(`${lmName}; ${smName}; ${USER_CONTEXT.userName}`);
            window.location.href = `mailto:${to}?subject=${subj}&body=${bdy}&cc=${cc}`;
        } // ADMIN TRANSFER FUNCTIONS
        // ========================================

        let CURRENT_TRANSFER_ITEM = null;

        function showTransferRequests() {
            switchDashboardSection('transfer-requests');
        }

    function backToTransfersList() {
    CURRENT_TRANSFER_ITEM = null;
    document.getElementById('sdTransferMessage').innerHTML = '';
    document.getElementById('sdTransferLM').selectedIndex = 0;
    document.getElementById('sdTransferSM').selectedIndex = 0;
    document.getElementById('sdTransferSM').disabled = true;
    var ftEl = document.getElementById('sdFinalTeam');
    if (ftEl) ftEl.selectedIndex = 0;
    var dpEl = document.getElementById('sdDeclinePanel');
    if (dpEl) dpEl.style.display = 'none';
    switchDashboardSection('transfer-requests');
}
async function loadAdminTransferRequests() {
    try {
        document.getElementById('adminTransferLoading').style.display = 'block';
        document.getElementById('adminTransferContent').style.display = 'none';

        const url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items?" +
            "$select=ID,Title,Customer_x0020_Name,Team,Proposed_x0020_Team," +
            "Request_x0020_Type,Request_x0020_Status,Transfer_Request_Date," +
            "Account_x0020_Manager/Title,Account_x0020_Director/Title," +
            "Service_x0020_Manager/Title,Line_x0020_Manager/Title&" +
            "$expand=Account_x0020_Manager,Account_x0020_Director,Service_x0020_Manager,Line_x0020_Manager&" +
            "$filter=Request_x0020_Type eq 'Transfer'&" +
            "$top=500";

        const res = await fetch(url, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to load');

        const data = await res.json();
        const requests = data.d.results;

        window._ALL_TRANSFER_REQUESTS = requests;

        document.getElementById('adminTransferLoading').style.display = 'none';
        document.getElementById('adminTransferContent').style.display = 'block';

        var filterEl = document.getElementById('transferStatusFilter');
        if (filterEl && !filterEl._initialized) {
            filterEl.value = 'AM_Approved';
            filterEl._initialized = true;
        }

        renderTransferGridFiltered();
        checkTransferAutoApproval();

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error('Error:', err);
        document.getElementById('adminTransferLoading').innerHTML = '<div style="color:#ef4444;">Error: ' + err.message + '</div>';
    }
}

function transferNormalizeRequestStatus(status) {
    var s = String(status || '').trim();
    if (!s) return '';
    var u = s.replace(/\s+/g, '_');
    if (/^transfer[_-]?pending$/i.test(u) || u.toUpperCase() === 'TRANSFER_PENDING') return 'Transfer_Pending';
    if (/^not[_-]?onboarded$/i.test(u)) return 'Not Onboarded';
    if (/^am[_-]?approved$/i.test(u)) return 'AM_Approved';
    if (/^onboarded$/i.test(u)) return 'OnBoarded';
    return s;
}

function transferStatusDisplayLabel(status) {
    var n = transferNormalizeRequestStatus(status);
    if (n === 'Transfer_Pending' || n === 'Not Onboarded') return 'Pending AM Approval';
    if (n === 'AM_Approved') return 'AM Approved';
    if (n === 'OnBoarded') return 'OnBoarded';
    if (n === 'Rejected') return 'Rejected';
    return status || '—';
}

function renderTransferGridFiltered() {
    var all = window._ALL_TRANSFER_REQUESTS || [];
    var filterVal = document.getElementById('transferStatusFilter') ? document.getElementById('transferStatusFilter').value : 'AM_Approved';
    var filtered = filterVal
        ? all.filter(function (r) {
            var st = transferNormalizeRequestStatus(r.Request_x0020_Status);
            if (filterVal === 'Transfer_Pending') {
                return st === 'Transfer_Pending' || st === 'Not Onboarded';
            }
            return st === filterVal;
        })
        : all;

    var rowData = filtered.map(function(r) {
        var reqDate = r.Transfer_Request_Date ? new Date(r.Transfer_Request_Date) : null;
        var daysPassed = reqDate ? Math.floor((new Date() - reqDate) / 86400000) : null;
        return {
            id:          r.ID,
            code:        r.Title || '',
            customer:    r.Customer_x0020_Name || '',
            currentTeam: r.Team || '',
            proposedTeam:r.Proposed_x0020_Team || '',
            status:      transferNormalizeRequestStatus(r.Request_x0020_Status || ''),
            statusLabel: transferStatusDisplayLabel(r.Request_x0020_Status || ''),
            requestDate: reqDate,
            daysPassed:  daysPassed,
            am:          transferDisplayAm(r),
            ad:          transferDisplayAd(r),
            lm:          r.Line_x0020_Manager ? r.Line_x0020_Manager.Title : '',
            sm:          r.Service_x0020_Manager ? r.Service_x0020_Manager.Title : ''
        };
    });

    renderTransferGrid(rowData);
}

var transferGridApi = null;

function renderTransferGrid(rowData) {
    var gridDiv = document.getElementById('adminTransferGrid');
    if (!gridDiv) return;
    gridDiv.style.width = '100%';

    var columnDefs = [
        {
            field: 'code',
            headerName: 'Account Code',
            pinned: 'left',
            width: 150,
            cellStyle: { fontWeight: '700' },
            filter: 'agTextColumnFilter'
        },
        { field: 'customer',     headerName: 'Customer',       width: 220, filter: 'agTextColumnFilter' },
        {
            field: 'currentTeam',
            headerName: 'Current Team',
            width: 130,
            filter: 'agSetColumnFilter',
            cellRenderer: function(p) {
                return '<span class="status-badge badge-warning">' + (p.value || '') + '</span>';
            }
        },
        {
            field: 'proposedTeam',
            headerName: 'Proposed Team',
            width: 130,
            filter: 'agSetColumnFilter',
            cellRenderer: function(p) {
                return '<span class="status-badge badge-success">' + (p.value || '') + '</span>';
            }
        },
        {
            field: 'requestDate',
            headerName: 'Transfer Request Date',
            width: 180,
            sort: 'desc',
            valueFormatter: function(p) {
                if (!p.value) return '—';
                return p.value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            },
            filter: 'agDateColumnFilter'
        },
        {
            field: 'daysPassed',
            headerName: 'Days Passed',
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
                var s = p.data.status || p.value || '';
                var label = p.data.statusLabel || transferStatusDisplayLabel(s);
                var cls = 'badge-warning';
                if (s === 'AM_Approved') cls = 'badge-success';
                else if (s === 'OnBoarded') cls = 'badge-info';
                else if (s === 'Rejected') cls = 'badge-danger';
                else if (s === 'Transfer_Pending' || s === 'Not Onboarded') cls = 'badge-warning';
                return '<span class="status-badge ' + cls + '">' + label + '</span>';
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
                var s = p.data.status;
                if (s === 'AM_Approved') {
                    return '<button type="button" class="export-btn" style="padding:5px 12px;font-size:12px;" onclick="reviewTransferBySD(' + p.data.id + ')"><i data-lucide="check-circle" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Finalize</button>';
                }
                return '<span style="font-size:11px;color:var(--t3);">—</span>';
            },
            onCellClicked: function() {
                setTimeout(function() { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 80);
            }
        }
    ];

    if (transferGridApi) {
        try { transferGridApi.destroy(); } catch(e) {}
        transferGridApi = null;
    }
    gridDiv.innerHTML = '';

    agGrid.createGrid(gridDiv, {
    columnDefs: columnDefs,
    rowData: rowData,
    defaultColDef: { sortable: true, filter: true, resizable: true },
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [25, 50, 100],
    rowHeight: 48,
    headerHeight: 48,
    animateRows: true,
    enableCellTextSelection: true,
    suppressHorizontalScroll: false,
    onGridReady: function(params) {
        transferGridApi = params.api;
        params.api.sizeColumnsToFit();
        setTimeout(function() { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 100);
    },
    onFirstDataRendered: function(params) {
        params.api.sizeColumnsToFit();
    },
    onGridSizeChanged: function(params) {
        params.api.sizeColumnsToFit();
    },
    onCellClicked: function() {
        setTimeout(function() { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 80);
    }
});
}
async function reviewTransferBySD(itemId) {
    try {
        const url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")?" +
            "$select=ID,Title,Customer_x0020_Name,Team,Proposed_x0020_Team,Transfer_x0020_Reason," +
            "Account_Source,TSM_SE_ITEM_ID,Dashboard_Active," +
            "Line_x0020_Manager/Title,Line_x0020_Manager/EMail," +
            "Service_x0020_Manager/Title,Service_x0020_Manager/EMail," +
            "Account_x0020_Manager/Title,Account_x0020_Manager/EMail," +
            "Account_x0020_Director/Title,Account_x0020_Director/EMail&" +
            "$expand=Line_x0020_Manager,Service_x0020_Manager,Account_x0020_Manager,Account_x0020_Director";

        const res = await fetch(url, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to load');

        const data = await res.json();
    CURRENT_TRANSFER_ITEM = data.d;

        // Pre-fill final team with proposed team
        var finalTeamEl = document.getElementById('sdFinalTeam');
        if (finalTeamEl) {
            finalTeamEl.value = transferCanonicalTeam(CURRENT_TRANSFER_ITEM.Proposed_x0020_Team || '');
            if (typeof sdFinalTeamChanged === 'function') sdFinalTeamChanged();
        }

        // Build details HTML
        var fields = [
            ['Account Code',  CURRENT_TRANSFER_ITEM.Title],
            ['Customer',      CURRENT_TRANSFER_ITEM.Customer_x0020_Name],
            ['Current Team',  CURRENT_TRANSFER_ITEM.Team],
            ['Proposed Team', CURRENT_TRANSFER_ITEM.Proposed_x0020_Team],
            ['Line Manager',  CURRENT_TRANSFER_ITEM.Line_x0020_Manager  ? CURRENT_TRANSFER_ITEM.Line_x0020_Manager.Title  : ''],
            ['Service Manager', CURRENT_TRANSFER_ITEM.Service_x0020_Manager ? CURRENT_TRANSFER_ITEM.Service_x0020_Manager.Title : ''],
            ['Account Manager', transferDisplayAm(CURRENT_TRANSFER_ITEM)],
            ['Account Director', transferDisplayAd(CURRENT_TRANSFER_ITEM)],
            ['Reason', (CURRENT_TRANSFER_ITEM.Transfer_x0020_Reason || 'Revenue drop').replace(/<[^>]*>/g, '').trim()]
        ];

        var detailsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
        fields.forEach(function(f) {
            detailsHtml += '<div style="padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
                '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">' + f[0] + '</div>' +
                '<div style="font-size:13px;font-weight:600;">' + (f[1] || 'N/A') + '</div>' +
                '</div>';
        });
        detailsHtml += '</div>';

        document.getElementById('sdTransferDetails').innerHTML = detailsHtml;

        if (typeof sdFinalTeamChanged === 'function') sdFinalTeamChanged();

        // Reset message
        document.getElementById('sdTransferMessage').innerHTML = '';

        // Show inline view same as reviewRequestView
       switchDashboardSection('sdReviewTransferView');

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        alert('Error: ' + err.message);
    }
}
var TRANSFER_TSM_SE_POOL_SM = 'du service manager (pool)';
var TRANSFER_TSM_SE_POOL_EMAIL = 'du.serviceManagement@du.ae';
var TRANSFER_TSM_SE_LIST = 'TSM_SE_Accounts';
var TRANSFER_TSM_SE_ENTITY = 'SP.Data.TSM_x005f_SE_x005f_AccountsListItem';
var TRANSFER_TSM_SE_MONTH_FIELDS = [
    { row: 'jan26', display: 'Jan26', odata: 'OData__x004a_an26' },
    { row: 'feb26', display: 'Feb26', odata: 'OData__x0046_eb26' },
    { row: 'mar26', display: 'Mar26', odata: 'OData__x004d_ar26' },
    { row: 'apr26', display: 'Apr26', odata: 'OData__x0041_pr26' },
    { row: 'may26', display: 'May26', odata: 'OData__x004d_ay26' },
    { row: 'jun26', display: 'Jun26', odata: 'OData__x004a_un26' },
    { row: 'jul26', display: 'Jul26', odata: 'OData__x004a_ul26' },
    { row: 'aug26', display: 'Aug26', odata: 'OData__x0041_ug26' },
    { row: 'sep26', display: 'Sep26', odata: 'OData__x0053_ep26' },
    { row: 'oct26', display: 'Oct26', odata: 'OData__x004f_ct26' },
    { row: 'nov26', display: 'Nov26', odata: 'OData__x004e_ov26' },
    { row: 'dec26', display: 'Dec26', odata: 'OData__x0044_ec26' },
    { row: 'jan27', display: 'Jan27', odata: 'OData__x004a_an27' },
    { row: 'feb27', display: 'Feb27', odata: 'OData__x0046_eb27' },
    { row: 'mar27', display: 'Mar27', odata: 'OData__x004d_ar27' },
    { row: 'apr27', display: 'Apr27', odata: 'OData__x0041_pr27' },
    { row: 'may27', display: 'May27', odata: 'OData__x004d_ay27' },
    { row: 'jun27', display: 'Jun27', odata: 'OData__x004a_un27' },
    { row: 'jul27', display: 'Jul27', odata: 'OData__x004a_ul27' },
    { row: 'aug27', display: 'Aug27', odata: 'OData__x0041_ug27' },
    { row: 'sep27', display: 'Sep27', odata: 'OData__x0053_ep27' },
    { row: 'oct27', display: 'Oct27', odata: 'OData__x004f_ct27' },
    { row: 'nov27', display: 'Nov27', odata: 'OData__x004e_ov27' },
    { row: 'dec27', display: 'Dec27', odata: 'OData__x0044_ec27' }
];

function transferIsDashboardActive(item) {
    if (!item) return true;
    var v = item.Dashboard_Active;
    if (v === false || v === 0 || v === '0') return false;
    if (String(v || '').toLowerCase() === 'no' || String(v || '').toLowerCase() === 'false') return false;
    return true;
}

function transferIsTsmSeSourceItem(item) {
    var src = (item && (item.Account_Source || item.accountSource)) || '';
    return String(src).trim().toUpperCase() === 'TSM_SE';
}

function transferRowKeyToMainMonthField(key) {
    var m = String(key || '').match(/^([a-z]{3})(\d{2})$/i);
    if (!m) return null;
    var mon = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    return mon + '_x002d_' + m[2];
}

function transferBuildMainMonthPayloadFromSeRow(seRow) {
    var payload = {};
    if (!seRow) return payload;
    Object.keys(seRow).forEach(function (k) {
        var field = transferRowKeyToMainMonthField(k);
        if (!field) return;
        var val = seRow[k];
        if (val === undefined || val === null || val === '') return;
        payload[field] = typeof val === 'number' ? val : (parseFloat(String(val).replace(/,/g, '')) || 0);
    });
    return payload;
}

function transferSafeCode(code) {
    return String(code || '').trim().replace(/'/g, "''");
}

async function transferCheckOpenTransfer(accountCode) {
    var safe = transferSafeCode(accountCode);
    var url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items?" +
        "$select=ID,Title,Request_x0020_Status,Request_x0020_Type,Account_Source,Dashboard_Active&" +
        "$filter=Title eq '" + safe + "' and Request_x0020_Type eq 'Transfer'&$top=50";
    var res = await fetch(url, { headers: { Accept: 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) return false;
    var data = await res.json();
    var rows = data.d.results || [];
    return rows.some(function (r) {
        var st = r.Request_x0020_Status || '';
        return st === 'Transfer_Pending' || st === 'AM_Approved';
    });
}

async function transferDeleteTsmSeAccountById(itemId) {
    if (!itemId) return;
    var digest = await transferGetDigest();
    var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + TRANSFER_TSM_SE_LIST + "')/items(" + itemId + ")", {
        method: 'POST',
        headers: {
            Accept: 'application/json;odata=verbose',
            'X-RequestDigest': digest,
            'IF-MATCH': '*',
            'X-HTTP-Method': 'DELETE'
        },
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Could not remove account from TSM_SE_Accounts: ' + (await res.text()).slice(0, 180));
}

function transferDisplayAm(item) {
    if (!item) return '';
    return (item.Account_x0020_Manager && item.Account_x0020_Manager.Title) || '';
}
function transferDisplayAd(item) {
    if (!item) return '';
    return (item.Account_x0020_Director && item.Account_x0020_Director.Title) || '';
}

function transferParseEnsureUserId(json) {
    if (!json || !json.d) return null;
    var d = json.d;
    if (d.EnsureUser && d.EnsureUser.Id != null) return d.EnsureUser.Id;
    if (d.Id != null) return d.Id;
    return null;
}

async function transferVerifySiteUserId(id) {
    var n = parseInt(String(id || '').trim(), 10);
    if (isNaN(n) || n <= 0) return null;
    try {
        var res = await fetch(SP_URL + '/_api/web/getuserbyid(' + n + ')', {
            headers: { Accept: 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (res.ok) return n;
    } catch (e) {}
    return null;
}

/** Resolve a mapping dropdown pick to SharePoint site user Id (Person field). */
async function transferResolveFromMappingPick(pick) {
    if (!pick || !pick.name) return null;
    var email = String(pick.email || '').trim();
    if (email.indexOf('@') >= 1) {
        try {
            var byEmail = await transferGetUserIdByEmail(email.toLowerCase());
            if (byEmail) return byEmail;
        } catch (eEmail) {}
    }
    if (pick.userId) {
        var verified = await transferVerifySiteUserId(pick.userId);
        if (verified) return verified;
    }
    if (typeof window.smResolvePersonId === 'function') {
        try {
            var mapped = await window.smResolvePersonId(pick.name);
            if (mapped) return mapped;
        } catch (eMap) {}
    }
    return transferResolvePersonId(pick.name);
}

async function transferGetUserIdByEmail(email) {
    var em = String(email || '').trim().toLowerCase();
    if (!em || em.indexOf('@') < 1) return null;
    try {
        var safe = em.replace(/'/g, "''");
        var lookups = [
            SP_URL + "/_api/web/siteusers?$filter=Email eq '" + safe + "'&$select=Id,Email,Title&$top=1",
            SP_URL + "/_api/web/siteusers?$filter=EMail eq '" + safe + "'&$select=Id,Email,Title&$top=1"
        ];
        for (var i = 0; i < lookups.length; i++) {
            var res = await fetch(lookups[i], { headers: { Accept: 'application/json;odata=verbose' }, credentials: 'include' });
            if (res.ok) {
                var data = await res.json();
                if (data.d.results && data.d.results.length) return data.d.results[0].Id;
            }
        }
        var digest = await transferGetDigest();
        var logonAttempts = [em, 'i:0#.f|membership|' + em];
        for (var j = 0; j < logonAttempts.length; j++) {
            var ensure = await fetch(SP_URL + "/_api/web/ensureuser", {
                method: 'POST',
                headers: {
                    Accept: 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': digest
                },
                credentials: 'include',
                body: JSON.stringify({ logonName: logonAttempts[j] })
            });
            if (ensure.ok) {
                var ensData = await ensure.json();
                var uid = transferParseEnsureUserId(ensData);
                if (uid) return uid;
            }
        }
    } catch (e) {
        console.warn('[Transfer] Could not resolve user by email', em, e);
    }
    return null;
}

async function transferApplySePeopleToSmItem(itemId, seRow, digest, knownAmId, knownAdId) {
    if (!itemId || !seRow) return { amId: null, adId: null };
    var amId = knownAmId || null;
    var adId = knownAdId || null;
    if (!amId && seRow.amUserId) {
        amId = await transferVerifySiteUserId(seRow.amUserId);
    }
    if (!adId && seRow.adUserId) {
        adId = await transferVerifySiteUserId(seRow.adUserId);
    }
    if (!amId && seRow.amPick) amId = await transferResolveFromMappingPick(seRow.amPick);
    if (!adId && seRow.adPick) adId = await transferResolveFromMappingPick(seRow.adPick);
    var amRaw = String(seRow.am || '').trim();
    var adRaw = String(seRow.ad || '').trim();
    if (!amId && amRaw) amId = await transferResolvePersonId(amRaw);
    if (!adId && adRaw) adId = await transferResolvePersonId(adRaw);
    var personPatch = {
        __metadata: { type: 'SP.Data.Service_x0020_Manager_x0020_RequestListItem' }
    };
    if (amId) personPatch.Account_x0020_ManagerId = amId;
    if (adId) personPatch.Account_x0020_DirectorId = adId;
    if (amId || adId) {
        var patchRes = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")", {
            method: 'POST',
            headers: {
                Accept: 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digest,
                'IF-MATCH': '*',
                'X-HTTP-Method': 'MERGE'
            },
            credentials: 'include',
            body: JSON.stringify(personPatch)
        });
        if (!patchRes.ok) {
            var patchErr = await patchRes.text();
            console.error('[Transfer] AM/AD patch failed:', patchErr.slice(0, 400));
            throw new Error('Transfer row created but Account Manager/Director could not be saved. ' + patchErr.slice(0, 180));
        }
    }
    return { amId: amId, adId: adId };
}

async function transferResolvePersonId(displayName) {
    var name = String(displayName || '').trim();
    if (!name) return null;
    if (name.indexOf('@') >= 1) {
        try {
            var byEmail = await transferGetUserIdByEmail(name.toLowerCase());
            if (byEmail) return byEmail;
        } catch (eEmail) {}
    }
    if (typeof fetchAccountMapping === 'function' && (!window.SM_MAPPING_DATA || !window.SM_MAPPING_DATA.length)) {
        try { await fetchAccountMapping(); } catch (e) {}
    }
    if (typeof window.smResolvePersonId === 'function') {
        try {
            var mapped = await window.smResolvePersonId(name);
            if (mapped) return mapped;
        } catch (e) {}
    }
    if (typeof getUserId === 'function') {
        try {
            var exact = await getUserId(name);
            if (exact) return exact;
        } catch (e) {}
    }
    try {
        var token = name.replace(/'/g, "''");
        var url = SP_URL + "/_api/web/siteusers?$filter=substringof('" + token + "',Title)&$select=Id,Title&$top=25";
        var res = await fetch(url, { headers: { Accept: 'application/json;odata=verbose' }, credentials: 'include' });
        if (res.ok) {
            var data = await res.json();
            var rows = data.d.results || [];
            var norm = name.toLowerCase();
            var hit = rows.find(function (u) { return String(u.Title || '').toLowerCase() === norm; }) ||
                rows.find(function (u) { return String(u.Title || '').toLowerCase().indexOf(norm) >= 0; }) ||
                rows[0];
            if (hit) return hit.Id;
        }
    } catch (e2) {}
    return null;
}

async function transferCreateSmRequestFromTsmSe(seRow, newTeam, reason, currentUserId) {
    if (!seRow || !seRow.code) throw new Error('Missing TSM SE account data.');
    var digest = await transferGetDigest();
    var amId = null, adId = null, lmId = null, smId = null;
    if (seRow.amUserId) {
        amId = await transferVerifySiteUserId(seRow.amUserId);
    }
    if (seRow.adUserId) {
        adId = await transferVerifySiteUserId(seRow.adUserId);
    }
    if (!amId && seRow.amPick) amId = await transferResolveFromMappingPick(seRow.amPick);
    if (!adId && seRow.adPick) adId = await transferResolveFromMappingPick(seRow.adPick);
    try { if (!amId && seRow.am) amId = await transferResolvePersonId(seRow.am); } catch (e) {}
    try { if (!adId && seRow.ad) adId = await transferResolvePersonId(seRow.ad); } catch (e) {}
    try { lmId = seRow.lm ? await transferResolvePersonId(seRow.lm) : null; } catch (e) {}
    try { smId = seRow.sm ? await transferResolveSmId(seRow.sm) : null; } catch (e) {}
    if (!smId && seRow.sm) {
        try { smId = await transferResolvePersonId(seRow.sm); } catch (e) {}
    }
    var parentCode = seRow.parent || seRow.code;
    var payload = Object.assign({
        __metadata: { type: 'SP.Data.Service_x0020_Manager_x0020_RequestListItem' },
        Title: seRow.code,
        Parent_x0020_Code: parentCode,
        Customer_x0020_Name: seRow.customer || '',
        Team: 'TSM_SE',
        Segment: seRow.segment || '',
        Account_Source: 'TSM_SE',
        TSM_SE_ITEM_ID: parseInt(seRow._spId || seRow.tsmSeItemId, 10) || null,
        Dashboard_Active: false,
        Request_x0020_Type: 'Transfer',
        Request_x0020_Status: 'Transfer_Pending',
        Proposed_x0020_Team: newTeam,
        Transfer_x0020_Reason: reason || 'Revenue threshold - transfer from TSM SE',
        Requested_x0020_ById: currentUserId,
        Transfer_Request_Date: new Date().toISOString()
    }, transferBuildMainMonthPayloadFromSeRow(seRow));
    if (amId) payload.Account_x0020_ManagerId = amId;
    if (adId) payload.Account_x0020_DirectorId = adId;
    if (lmId) payload.Line_x0020_ManagerId = lmId;
    if (smId) payload.Service_x0020_ManagerId = smId;

    var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items", {
        method: 'POST',
        headers: {
            Accept: 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        throw new Error('Could not create transfer request on main list: ' + (await res.text()).slice(0, 220));
    }
    var created = await res.json();
    var newId = created.d && created.d.ID ? created.d.ID : null;
    if (newId) {
        await transferApplySePeopleToSmItem(newId, seRow, digest, amId, adId);
    }
    return newId;
}

async function transferDeleteTsmSeByAccountCode(accountCode) {
    var existing = await transferFindTsmSeItem(accountCode);
    if (existing && existing.ID) return transferDeleteTsmSeAccountById(existing.ID);
}

async function transferCleanupSeTransferCopy(itemId) {
    if (!itemId) return;
    await transferDeleteMainAccount(itemId);
}

function transferNormTeam(team) {
    return String(team || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function transferCanonicalTeam(team) {
    var norm = transferNormTeam(team);
    if (norm === 'tsm se') return 'TSM_SE';
    if (norm === 'tsm me') return 'TSM_ME';
    if (norm === 'call centre' || norm === 'call center') return 'Call Centre';
    if (norm === 'dsm') return 'DSM';
    if (norm === 'psd') return 'PSD';
    return String(team || '').trim();
}

function transferTeamRows(team) {
    var want = transferNormTeam(transferCanonicalTeam(team));
    return (window.ALL_DATA || []).filter(function (a) {
        return transferNormTeam(a.team) === want;
    });
}

function transferPickName(names, needle) {
    var list = (names || []).filter(Boolean);
    if (!list.length) return '';
    var q = String(needle || '').toLowerCase();
    var hit = list.find(function (n) { return String(n).toLowerCase().indexOf(q) !== -1; });
    return hit || list[0];
}

function transferFillSelect(select, values, selected) {
    select.innerHTML = '<option value="">Select...</option>';
    var seen = {};
    (values || []).filter(Boolean).forEach(function (v) {
        if (seen[v]) return;
        seen[v] = true;
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === selected) opt.selected = true;
        select.appendChild(opt);
    });
    if (selected && !seen[selected]) {
        var extra = document.createElement('option');
        extra.value = selected;
        extra.textContent = selected;
        extra.selected = true;
        select.appendChild(extra);
    }
}

function sdFinalTeamChanged() {
    var team = transferCanonicalTeam((document.getElementById('sdFinalTeam') || {}).value || '');
    var lmSelect = document.getElementById('sdTransferLM');
    var smSelect = document.getElementById('sdTransferSM');
    if (!lmSelect || !smSelect) return;

    var rows = transferTeamRows(team);
    var lms = [...new Set(rows.map(function (a) { return a.lm; }))].filter(Boolean).sort();
    if (!lms.length) {
        lms = [...new Set((window.ALL_DATA || []).map(function (a) { return a.lm; }))].filter(Boolean).sort();
    }

    if (team === 'TSM_SE') {
        var lmName = transferPickName(lms, 'ubaid');
        transferFillSelect(lmSelect, lms, lmName);
        transferFillSelect(smSelect, [TRANSFER_TSM_SE_POOL_SM], TRANSFER_TSM_SE_POOL_SM);
        smSelect.disabled = false;
        return;
    }

    if (transferNormTeam(team) === 'call centre' || transferNormTeam(team) === 'call center') {
        var ccLm = transferPickName(lms, 'hussain');
        var sms = [...new Set(rows.map(function (a) { return a.sm; }))].filter(Boolean).sort();
        var ccSm = transferPickName(sms, 'call');
        transferFillSelect(lmSelect, lms, ccLm);
        transferFillSelect(smSelect, sms.length ? sms : [ccSm || 'Call Center'], ccSm || 'Call Center');
        smSelect.disabled = false;
        return;
    }

    transferFillSelect(lmSelect, lms, '');
    smSelect.innerHTML = '<option value="">Select Service Manager</option>';
    smSelect.disabled = true;
}

function sdTransferLMChanged() {
    var team = transferCanonicalTeam((document.getElementById('sdFinalTeam') || {}).value || '');
    if (team === 'TSM_SE') {
        var smSelect = document.getElementById('sdTransferSM');
        if (smSelect) {
            transferFillSelect(smSelect, [TRANSFER_TSM_SE_POOL_SM], TRANSFER_TSM_SE_POOL_SM);
            smSelect.disabled = false;
        }
        return;
    }
    var lm = document.getElementById('sdTransferLM').value;
    var smSelect = document.getElementById('sdTransferSM');

    smSelect.innerHTML = '<option value="">Select Service Manager</option>';

    if (!lm) {
        smSelect.disabled = true;
        return;
    }

    var sms = [...new Set(ALL_DATA.filter(function(a) { return a.lm === lm; }).map(function(a) { return a.sm; }))].filter(Boolean).sort();
    if (transferNormTeam(team) === 'call centre' || transferNormTeam(team) === 'call center') {
        var ccSm = transferPickName(sms, 'call');
        transferFillSelect(smSelect, sms.length ? sms : [ccSm || 'Call Center'], ccSm || 'Call Center');
        smSelect.disabled = false;
        return;
    }
    sms.forEach(function(sm) {
        var opt = document.createElement('option');
        opt.value = sm; opt.textContent = sm;
        smSelect.appendChild(opt);
    });
    smSelect.disabled = false;
}

async function transferGetDigest() {
    var res = await fetch(SP_URL + '/_api/contextinfo', {
        method: 'POST',
        headers: { Accept: 'application/json;odata=verbose' },
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to get form digest');
    var data = await res.json();
    return data.d.GetContextWebInformation.FormDigestValue;
}

async function transferResolveSmId(smName) {
    if (smName === TRANSFER_TSM_SE_POOL_SM || String(smName || '').toLowerCase().indexOf('du service') !== -1) {
        var byEmail = await transferGetUserIdByEmail(TRANSFER_TSM_SE_POOL_EMAIL);
        if (byEmail) return byEmail;
    }
    if (typeof getUserId === 'function') return getUserId(smName);
    return null;
}

async function transferFindTsmSeItem(accountCode) {
    var safeCode = String(accountCode || '').trim().replace(/'/g, "''");
    var url = SP_URL + "/_api/web/lists/getbytitle('" + TRANSFER_TSM_SE_LIST + "')/items?" +
        "$select=ID,Title&$filter=Title eq '" + safeCode + "'&$top=1";
    var res = await fetch(url, {
        headers: { Accept: 'application/json;odata=verbose' },
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Could not verify TSM_SE_Accounts: ' + (await res.text()).slice(0, 180));
    var data = await res.json();
    return data.d.results && data.d.results.length ? data.d.results[0] : null;
}

async function transferGetTsmSeById(itemId) {
    var id = parseInt(itemId, 10);
    if (!id) return null;
    var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + TRANSFER_TSM_SE_LIST + "')/items(" + id + ")?$select=ID,Title", {
        headers: { Accept: 'application/json;odata=verbose' },
        credentials: 'include'
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    var data = await res.json();
    return data && data.d ? data.d : null;
}

function transferTsmSeCorePayload(item, src, lmName, smName) {
    return {
        __metadata: { type: TRANSFER_TSM_SE_ENTITY },
        Title: String(item.Title || '').trim(),
        ParentCode: src.parent || '',
        CustomerName: item.Customer_x0020_Name || src.customer || '',
        AccountManager: (item.Account_x0020_Manager && item.Account_x0020_Manager.Title) || src.am || '',
        AccountDirector: (item.Account_x0020_Director && item.Account_x0020_Director.Title) || src.ad || '',
        ServiceManager: smName || '',
        LineManager: lmName || '',
        Team: 'TSM_SE',
        Segment: src.segment || ''
    };
}

function transferTsmSeMonthPayload(item, src) {
    var extra = {};
    TRANSFER_TSM_SE_MONTH_FIELDS.forEach(function (m) {
        var raw = src[m.row];
        if (raw === undefined) raw = src[m.display];
        if ((raw === undefined || raw === null || raw === '') && src.allMonths) {
            var mainField = transferRowKeyToMainMonthField(m.row);
            if (mainField && src.allMonths[mainField] !== undefined) raw = src.allMonths[mainField];
        }
        if ((raw === undefined || raw === null || raw === '') && item) {
            var spField = transferRowKeyToMainMonthField(m.row);
            if (spField && item[spField] !== undefined) raw = item[spField];
        }
        if (raw === undefined || raw === null || raw === '') return;
        extra[m.odata] = typeof raw === 'number' ? raw : (parseFloat(String(raw).replace(/,/g, '')) || 0);
    });
    return extra;
}

async function transferPostTsmSePayload(url, headers, payload) {
    return fetch(url, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(payload)
    });
}

function transferRememberTsmSeLocal(item, src, lmName, smName, seId) {
    window.TSM_SE_DATA = window.TSM_SE_DATA || [];
    var code = String(item.Title || '').trim();
    var row = {
        _source: 'tsm_se',
        _spId: seId,
        code: code,
        parent: src.parent || '',
        customer: item.Customer_x0020_Name || src.customer || '',
        am: (item.Account_x0020_Manager && item.Account_x0020_Manager.Title) || src.am || '',
        ad: (item.Account_x0020_Director && item.Account_x0020_Director.Title) || src.ad || '',
        sm: smName || '',
        lm: lmName || '',
        team: 'TSM_SE',
        segment: src.segment || '',
        type: 'Group',
        isApproved: true,
        requestStatus: 'OnBoarded',
        requestType: 'New Account'
    };
    Object.keys(src).forEach(function (k) {
        if (/^[a-z]{3}\d{2}$/i.test(k) && src[k] != null) row[k] = src[k];
    });
    if (typeof tsmSeApplyRevFlags !== 'function') {
        row.avg = 0;
        row.isRevDrop = true;
        row.isRevUpgrade = false;
    }
    var idx = window.TSM_SE_DATA.findIndex(function (r) { return String(r.code || '').trim() === code; });
    if (idx >= 0) {
        window.TSM_SE_DATA[idx] = Object.assign({}, window.TSM_SE_DATA[idx], row);
    } else {
        window.TSM_SE_DATA.push(row);
    }
}

async function transferPatchTsmSeFields(itemId, fields, digest) {
    var payload = Object.assign({ __metadata: { type: TRANSFER_TSM_SE_ENTITY } }, fields);
    var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + TRANSFER_TSM_SE_LIST + "')/items(" + itemId + ")", {
        method: 'POST',
        headers: {
            Accept: 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest,
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    return res.ok;
}

function transferBuildTsmSeTransferNotes(item, src, lmName, smName) {
    var lines = [];
    var stamp = new Date().toISOString();
    lines.push('=== Transfer snapshot from Service Manager Request ===');
    lines.push('Captured: ' + stamp);
    lines.push('');
    lines.push('Account Information');
    lines.push('Account Code: ' + (item.Title || src.code || ''));
    lines.push('Customer Name: ' + (item.Customer_x0020_Name || src.customer || ''));
    lines.push('Team (previous): ' + (item.Team || src.team || ''));
    lines.push('Segment: ' + (src.segment || ''));
    lines.push('Account Type: ' + (src.accountType || ''));
    lines.push('Line Manager: ' + (src.lm || (item.Line_x0020_Manager && item.Line_x0020_Manager.Title) || ''));
    lines.push('Service Manager: ' + (src.sm || (item.Service_x0020_Manager && item.Service_x0020_Manager.Title) || ''));
    lines.push('Account Manager: ' + ((item.Account_x0020_Manager && item.Account_x0020_Manager.Title) || src.am || ''));
    lines.push('Account Director: ' + ((item.Account_x0020_Director && item.Account_x0020_Director.Title) || src.ad || ''));
    lines.push('New Line Manager (TSM SE): ' + (lmName || ''));
    lines.push('New Service Manager (TSM SE): ' + (smName || ''));
    lines.push('');
    lines.push('RNPS');
    lines.push('RNPS Eligibility: ' + (src.rnpsEligibility || ''));
    lines.push('RNPS POC: ' + (src.rnpsPoc || ''));
    if (src.rnpsNotEligibleReason) lines.push('RNPS Not Eligible Reason: ' + src.rnpsNotEligibleReason);
    lines.push('');
    lines.push('Primary POC Details');
    lines.push('Primary POC Name: ' + (src.pocName || ''));
    lines.push('Primary POC email: ' + (src.pocEmail || ''));
    lines.push('Primary POC Contact: ' + (src.pocPhone || ''));
    lines.push('');
    lines.push('Secondary POC Details');
    lines.push('Secondary POC Name: ' + (src.secondaryPocName || ''));
    lines.push('Secondary POC email: ' + (src.secondaryPocEmail || ''));
    lines.push('Secondary POC Contact: ' + (src.secondaryPocPhone || ''));
    lines.push('');
    lines.push('Technical POC Details');
    lines.push('Technical POC Name: ' + (src.technicalPocName || ''));
    lines.push('Technical POC email: ' + (src.technicalPocEmail || ''));
    lines.push('Technical POC Contact: ' + (src.technicalPocPhone || ''));
    lines.push('');
    lines.push('Transfer');
    lines.push('Proposed Team: ' + (item.Proposed_x0020_Team || src.proposedTeam || 'TSM_SE'));
    var reason = item.Transfer_x0020_Reason || '';
    if (reason) {
        reason = String(reason).replace(/<[^>]*>/g, '').trim();
        lines.push('Transfer Reason: ' + reason);
    }
    return lines.join('\n');
}

async function transferResolvePersonEmail(displayName) {
    var name = transferNormalizePersonName(displayName);
    if (!name) return '';
    if (name === TRANSFER_TSM_SE_POOL_SM && TRANSFER_TSM_SE_POOL_EMAIL) return TRANSFER_TSM_SE_POOL_EMAIL;
    var i, row, data = window.ALL_DATA || [];
    for (i = 0; i < data.length; i++) {
        row = data[i];
        if (row.lm === name && row.lmEmail) return row.lmEmail;
        if (row.sm === name && row.smEmail) return row.smEmail;
        if (row.am === name && row.amEmail) return row.amEmail;
        if (row.ad === name && row.adEmail) return row.adEmail;
    }
    if (typeof getUserEmail === 'function') {
        try {
            var safe = name.replace(/'/g, "''");
            var res = await fetch(SP_URL + "/_api/web/siteusers?$filter=Title eq '" + safe + "'&$select=EMail,Email&$top=1", {
                headers: { Accept: 'application/json;odata=verbose' },
                credentials: 'include'
            });
            if (res.ok) {
                var d = await res.json();
                if (d.d.results && d.d.results[0]) {
                    return d.d.results[0].EMail || d.d.results[0].Email || '';
                }
            }
            var fallback = await getUserEmail(name);
            if (fallback) return fallback;
        } catch (e) {}
    }
    return '';
}

async function transferCopyToTsmSeList(item, lmName, smName) {
    var accountCode = String(item.Title || '').trim();
    if (!accountCode) throw new Error('Cannot move to TSM_SE_Accounts: missing account code.');
    var src = (window.ALL_DATA || []).find(function (a) {
        return String(a.code || '').trim() === accountCode;
    }) || {};
    var digest = await transferGetDigest();
    var existing = await transferFindTsmSeItem(accountCode);
    var url = existing
        ? SP_URL + "/_api/web/lists/getbytitle('" + TRANSFER_TSM_SE_LIST + "')/items(" + existing.ID + ")"
        : SP_URL + "/_api/web/lists/getbytitle('" + TRANSFER_TSM_SE_LIST + "')/items";
    var headers = {
        Accept: 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest
    };
    if (existing) {
        headers['IF-MATCH'] = '*';
        headers['X-HTTP-Method'] = 'MERGE';
    }

    var core = transferTsmSeCorePayload(item, src, lmName, smName);
    var months = transferTsmSeMonthPayload(item, src);
    var withMonths = Object.assign({}, core, months);
    var res = await transferPostTsmSePayload(url, headers, withMonths);
    if (!res.ok) {
        console.warn('[Transfer] TSM_SE save with months failed, retrying core fields only:', (await res.text()).slice(0, 180));
        digest = await transferGetDigest();
        headers['X-RequestDigest'] = digest;
        res = await transferPostTsmSePayload(url, headers, core);
    }
    if (!res.ok) throw new Error('Could not add account to TSM_SE_Accounts: ' + (await res.text()).slice(0, 180));

    var verified = await transferFindTsmSeItem(accountCode);
    if (!verified) throw new Error('TSM_SE_Accounts save could not be verified. Main account was not deleted.');

    try {
        var historyNotes = transferBuildTsmSeTransferNotes(item, src, lmName, smName);
        await transferPatchTsmSeFields(verified.ID, { Notes: historyNotes }, digest);
    } catch (noteErr) {
        console.warn('[Transfer] TSM_SE Notes snapshot skipped:', noteErr && noteErr.message);
    }

    transferRememberTsmSeLocal(item, src, lmName, smName, verified.ID);
    if (window.TSM_SE_INSIGHT_FILTER) {
        window.TSM_SE_INSIGHT_FILTER = null;
        window.TSM_SE_INSIGHT_LABEL = '';
    }
    console.log('[Transfer] Account copied to TSM_SE_Accounts:', accountCode, 'ID', verified.ID);
    return verified.ID;
}

async function transferDeleteMainAccount(itemId) {
    var digest = await transferGetDigest();
    var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")", {
        method: 'POST',
        headers: {
            Accept: 'application/json;odata=verbose',
            'X-RequestDigest': digest,
            'IF-MATCH': '*',
            'X-HTTP-Method': 'DELETE'
        },
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Could not remove account from main list: ' + (await res.text()).slice(0, 180));
}
async function finalizeTransfer() {
   const finalTeam = transferCanonicalTeam(document.getElementById('sdFinalTeam') ? document.getElementById('sdFinalTeam').value : (CURRENT_TRANSFER_ITEM.Proposed_x0020_Team || ''));
    const lmName = document.getElementById('sdTransferLM').value;
    const smName = document.getElementById('sdTransferSM').value;

    if (!finalTeam || !lmName || !smName) {
        alert('Please select Final Team, Line Manager and Service Manager');
        return;
    }

    const submitBtn = event.target;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px; animation: spin 1s linear infinite;"></i>Processing...';

    const _amName = CURRENT_TRANSFER_ITEM.Account_x0020_Manager?.Title || '';
    const _adName = CURRENT_TRANSFER_ITEM.Account_x0020_Director?.Title || '';
    const _oldLm = CURRENT_TRANSFER_ITEM.Line_x0020_Manager?.Title || 'N/A';
    const _oldSm = CURRENT_TRANSFER_ITEM.Service_x0020_Manager?.Title || 'N/A';
    const rawReason = CURRENT_TRANSFER_ITEM.Transfer_x0020_Reason || '';
    const cleanReason = rawReason.replace(/<[^>]*>/g, '').trim() || 'Revenue threshold';

    console.log('📧 Finalize email debug:', {
        _amName,
        _adName,
        _oldLm,
        _oldSm,
        lmName,
        smName
    });

    const _amEmail = CURRENT_TRANSFER_ITEM.Account_x0020_Manager?.EMail || '';
    const _adEmail = CURRENT_TRANSFER_ITEM.Account_x0020_Director?.EMail || '';
    const _oldSmEmail = CURRENT_TRANSFER_ITEM.Service_x0020_Manager?.EMail || '';
    const _oldLmEmail = CURRENT_TRANSFER_ITEM.Line_x0020_Manager?.EMail || '';
    const _newLmEmail = await transferResolvePersonEmail(lmName);
    const _newSmEmail = await transferResolvePersonEmail(smName);

    const _to = [_amEmail, _adEmail].filter(Boolean).join(';');
    const _subj = encodeURIComponent(`[Transfer Completed] ACC# ${CURRENT_TRANSFER_ITEM.Title} - ${CURRENT_TRANSFER_ITEM.Customer_x0020_Name}`);
    const _bdy = encodeURIComponent(
        `Dear ${_amName} / ${_adName},

The following account transfer has been completed successfully.

Account: ${CURRENT_TRANSFER_ITEM.Title} - ${CURRENT_TRANSFER_ITEM.Customer_x0020_Name}
Previous Team: ${CURRENT_TRANSFER_ITEM.Team}
New Team: ${finalTeam}
Previous Line Manager: ${_oldLm}
Previous Service Manager: ${_oldSm}
New Line Manager: ${lmName}
New Service Manager: ${smName}
Reason: ${cleanReason}
Finalized By: ${USER_CONTEXT.userName}

Note to ${_oldSm}: Please begin the handover process to ${smName} at your earliest convenience.

Best regards,
${USER_CONTEXT.userName}`);

    const _cc = [_newLmEmail, _newSmEmail, _oldLmEmail, _oldSmEmail, USER_CONTEXT.userEmail]
        .filter(Boolean)
        .filter(function (v, idx, arr) { return arr.indexOf(v) === idx; })
        .join(';');
    const transferMailHref = `mailto:${_to}?subject=${_subj}&body=${_bdy}&cc=${_cc}`;
    let completedTsmSeItemId = null;

    // SharePoint calls using .then() - no async/await
    getUserId(lmName)
        .then(lmId => {
            return transferResolveSmId(smName).then(smId => ({
                lmId,
                smId
            }));
        })
        .then(({
            lmId,
            smId
        }) => {
            const fromTeam = CURRENT_TRANSFER_ITEM.Team || '';
            const accountCode = CURRENT_TRANSFER_ITEM.Title;
            const seOrigin = transferIsTsmSeSourceItem(CURRENT_TRANSFER_ITEM);
            const tsmSeItemId = CURRENT_TRANSFER_ITEM.TSM_SE_ITEM_ID;

            if (seOrigin) {
                if (finalTeam === 'TSM_SE') {
                    var seId = parseInt(tsmSeItemId, 10);
                    var seLookup = seId ? transferGetTsmSeById(seId) : transferFindTsmSeItem(accountCode);
                    return Promise.resolve(seLookup).then(function (existingSe) {
                        var inFlightCopy = existingSe && !transferIsDashboardActive(CURRENT_TRANSFER_ITEM);
                        if (inFlightCopy) {
                            return transferDeleteMainAccount(CURRENT_TRANSFER_ITEM.ID).then(function () {
                                if (typeof csCloseReviewsOnTransfer === 'function') {
                                    return csCloseReviewsOnTransfer(accountCode, fromTeam, finalTeam);
                                }
                            });
                        }
                        return transferCopyToTsmSeList(CURRENT_TRANSFER_ITEM, lmName, TRANSFER_TSM_SE_POOL_SM)
                            .then(function (newSeId) {
                                completedTsmSeItemId = newSeId;
                                return transferDeleteMainAccount(CURRENT_TRANSFER_ITEM.ID);
                            })
                            .then(function () {
                                return updateChildrenTeam(CURRENT_TRANSFER_ITEM.Title, finalTeam, lmId, smId, true);
                            })
                            .then(function () {
                                if (typeof csCloseReviewsOnTransfer === 'function') {
                                    return csCloseReviewsOnTransfer(accountCode, fromTeam, finalTeam);
                                }
                            });
                    });
                }
                return updateSharePointItem(CURRENT_TRANSFER_ITEM.ID, {
                    Team: finalTeam,
                    Line_x0020_ManagerId: lmId,
                    Service_x0020_ManagerId: smId,
                    Request_x0020_Status: 'OnBoarded',
                    Request_x0020_Type: 'Transfer',
                    Dashboard_Active: true,
                    Account_Source: 'Main',
                    Proposed_x0020_Team: null,
                    Transfer_x0020_Reason: null
                }).then(function () {
                    var seId = parseInt(tsmSeItemId, 10);
                    if (seId) return transferDeleteTsmSeAccountById(seId);
                    return transferDeleteTsmSeByAccountCode(accountCode);
                }).then(function () {
                    window.TSM_SE_LOADED = false;
                    if (typeof csCloseReviewsOnTransfer === 'function') {
                        return csCloseReviewsOnTransfer(accountCode, 'TSM_SE', finalTeam);
                    }
                }).then(function () {
                    return { lmId: lmId, smId: smId };
                });
            }

            if (finalTeam === 'TSM_SE') {
                return transferCopyToTsmSeList(CURRENT_TRANSFER_ITEM, lmName, TRANSFER_TSM_SE_POOL_SM)
                    .then(function (tsmSeItemId) {
                        completedTsmSeItemId = tsmSeItemId;
                        return transferDeleteMainAccount(CURRENT_TRANSFER_ITEM.ID);
                    })
                    .then(function () {
                        return updateChildrenTeam(CURRENT_TRANSFER_ITEM.Title, finalTeam, lmId, smId, true);
                    })
                    .then(function () {
                        if (typeof csCloseReviewsOnTransfer === 'function') {
                            return csCloseReviewsOnTransfer(accountCode, fromTeam, finalTeam);
                        }
                    });
            }
            return updateSharePointItem(CURRENT_TRANSFER_ITEM.ID, {
                Team: finalTeam,
                Line_x0020_ManagerId: lmId,
                Service_x0020_ManagerId: smId,
                Request_x0020_Status: 'OnBoarded',
                Request_x0020_Type: 'Transfer'
            }).then(function () {
                if (typeof csCloseReviewsOnTransfer === 'function') {
                    return csCloseReviewsOnTransfer(accountCode, fromTeam, finalTeam);
                }
            }).then(function () {
                return { lmId: lmId, smId: smId };
            });
        })
        .then((ids) => {
          if (finalTeam === 'TSM_SE') return;
          return updateChildrenTeam(CURRENT_TRANSFER_ITEM.Title, finalTeam, ids && ids.lmId, ids && ids.smId);
        })
        
            .then(() => {
            document.getElementById('sdTransferMessage').innerHTML = '<span style="color: var(--success);">Transfer completed successfully' +
                (completedTsmSeItemId ? ' — TSM_SE_Accounts item ID: ' + completedTsmSeItemId : '') + '.</span>';
            window.location.href = transferMailHref;
            if (typeof logAccountHistory === 'function') {
                logAccountHistory(
                    CURRENT_TRANSFER_ITEM.Title,
                    CURRENT_TRANSFER_ITEM.Customer_x0020_Name,
                    'Transfer Finalized',
               'Transfer finalized by ' + USER_CONTEXT.userName + '. Team: ' + CURRENT_TRANSFER_ITEM.Team + ' → ' + finalTeam + ' | New LM: ' + lmName + ' | New SM: ' + smName,
                    USER_CONTEXT.userName,
                    _oldSm,
                    smName,
                    CURRENT_TRANSFER_ITEM.Team || '',
                    CURRENT_TRANSFER_ITEM.Proposed_x0020_Team || '',
                    ''
                );
            }
            setTimeout(function () {
                CURRENT_TRANSFER_ITEM = null;
                switchDashboardSection('dashboard-view');
                var chain = Promise.resolve();
                if (typeof window.tsmSeRefreshAfterTransfer === 'function') {
                    chain = window.tsmSeRefreshAfterTransfer();
                }
                chain.then(function () {
                    if (typeof window.smRefreshDashboardData === 'function') {
                        return window.smRefreshDashboardData();
                    }
                    if (typeof init === 'function') return init();
                }).catch(function (e) { console.warn('[Transfer] Finalize refresh:', e); });
            }, 2000);
        })
        .catch(err => {
            console.error('Error:', err);
            document.getElementById('sdTransferMessage').innerHTML = '<span style="color: var(--danger);">Error: ' + err.message + '</span>';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Finalize Transfer';
            lucide.createIcons();
        });
}      
async function updateChildrenTeam(parentCode, newTeam, lmId, smId, deleteFromMain) {
            try {
                // Find all children of this parent
                const url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items?" +
                    "$select=ID,Title,Parent_x0020_Code&" +
                    "$filter=Parent_x0020_Code eq '" + parentCode + "' and Title ne '" + parentCode + "'&" +
                    "$top=500";

                const res = await fetch(url, {
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });

                if (!res.ok) {
                    console.error('Failed to find children for parent:', parentCode);
                    return;
                }

                const data = await res.json();
                const children = data.d.results;


                // Update each child — or move TSM_SE children off the main list
                for (const child of children) {
                    if (deleteFromMain && newTeam === 'TSM_SE') {
                        await transferCopyToTsmSeList({
                            Title: child.Title,
                            Customer_x0020_Name: child.Customer_x0020_Name || '',
                            Account_x0020_Manager: CURRENT_TRANSFER_ITEM.Account_x0020_Manager,
                            Account_x0020_Director: CURRENT_TRANSFER_ITEM.Account_x0020_Director
                        }, document.getElementById('sdTransferLM').value, TRANSFER_TSM_SE_POOL_SM);
                        await transferDeleteMainAccount(child.ID);
                        console.log('[Transfer] Moved child to TSM_SE_Accounts:', child.Title);
                        continue;
                    }
                    const childUpdate = {
                        Team: newTeam
                    };
                    if (lmId) childUpdate.Line_x0020_ManagerId = lmId;
                    if (smId) childUpdate.Service_x0020_ManagerId = smId;

                    await updateSharePointItem(child.ID, childUpdate);
                    console.log('[Transfer] Updated child:', child.Title);
                }

                console.log('[Transfer] All children updated successfully');
            } catch (err) {
                console.error('[Transfer] Error updating children:', err);
            }
        }

        // ========================================
        // EDIT REQUEST FUNCTIONS (LINE MANAGER)
        // ========================================

        let EDIT_ACCOUNT_DATA = null;
function searchTransfers(val) {
    if (transferGridApi) transferGridApi.setGridOption('quickFilterText', val);
}

function exportTransferToExcel() {
    var today = new Date();
    var dateStr = today.toLocaleDateString('en-GB') + ' ' + today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (!transferGridApi) return;
    var rows = [];
    transferGridApi.forEachNodeAfterFilter(function(node) { rows.push(node.data); });
    var html = '<html><head><meta charset="utf-8"></head><body><table border="1" cellspacing="0" cellpadding="4">';
    html += '<tr><td colspan="7" style="background:#a855f7;color:white;font-size:16px;font-weight:bold;text-align:center;padding:12px;">Transfer Requests Export</td></tr>';
    html += '<tr><td colspan="7" style="background:#e9d5ff;font-size:12px;padding:8px;text-align:center;"><b>Generated:</b> ' + dateStr + ' | <b>Records:</b> ' + rows.length + '</td></tr>';
    html += '<tr>';
    ['Account Code','Customer','Current Team','Proposed Team','Request Date','Days Passed','Status'].forEach(function(h) {
        html += '<th style="background:#a855f7;color:white;font-weight:bold;padding:10px;">' + h + '</th>';
    });
    html += '</tr>';
    rows.forEach(function(r, i) {
        var bg = i % 2 === 0 ? '#f3e8ff' : '#ffffff';
        var reqDate = r.requestDate ? r.requestDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
        html += '<tr>';
        html += '<td style="background:' + bg + ';padding:8px;font-weight:700;">' + (r.code||'') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + (r.customer||'') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + (r.currentTeam||'') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + (r.proposedTeam||'') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + reqDate + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;text-align:center;">' + (r.daysPassed !== null ? r.daysPassed + 'd' : '—') + '</td>';
        html += '<td style="background:' + bg + ';padding:8px;">' + (r.status||'') + '</td>';
        html += '</tr>';
    });
    html += '</table></body></html>';
    var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Transfer_Requests_' + today.toISOString().split('T')[0] + '.xls';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function checkTransferAutoApproval() {
    if (!USER_CONTEXT.isAdmin) return;
    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items?" +
            "$select=ID,Title,Customer_x0020_Name,Team,Proposed_x0020_Team,Transfer_Request_Date," +
            "Transfer_x0020_Reason,Account_x0020_Manager/Title,Account_x0020_Director/Title," +
            "Service_x0020_Director/Title,Service_x0020_Director/EMail&" +
            "$expand=Account_x0020_Manager,Account_x0020_Director,Service_x0020_Director&" +
            "$filter=Request_x0020_Type eq 'Transfer' and (Request_x0020_Status eq 'Transfer_Pending' or Request_x0020_Status eq 'Not Onboarded')&" +
            "$top=500";
        var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!res.ok) return;
        var data = await res.json();
        var items = data.d.results;
        var now = new Date();
        var overdue = items.filter(function(r) {
            if (!r.Transfer_Request_Date) return false;
            return Math.floor((now - new Date(r.Transfer_Request_Date)) / 86400000) >= 3;
        });
        if (overdue.length === 0) return;
        window._OVERDUE_TRANSFERS = overdue;

        // Show inside transfer section
        var existing = document.getElementById('transferOverdueAlert');
        if (existing) existing.remove();

        var alertDiv = document.createElement('div');
        alertDiv.id = 'transferOverdueAlert';
        alertDiv.style.cssText = 'margin-bottom:16px;padding:14px 18px;background:rgba(249,115,22,0.1);border:2px solid #f97316;border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;';
        alertDiv.innerHTML = '<div style="display:flex;align-items:center;gap:10px;">' +
            '<i data-lucide="alert-triangle" style="width:20px;height:20px;color:#f97316;flex-shrink:0;"></i>' +
            '<span style="font-size:13px;font-weight:700;color:var(--t1);">' + overdue.length + ' transfer request(s) pending for 3+ days without AM action</span>' +
            '</div>' +
            '<button type="button" class="export-btn" style="font-size:12px;padding:8px 14px;white-space:nowrap;" onclick="showOverdueTransfers()">' +
            '<i data-lucide="eye" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>View & Action</button>';

        var content = document.getElementById('adminTransferContent');
        if (content) content.insertBefore(alertDiv, content.firstChild);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch(e) {
        console.error('[AutoCheck]', e);
    }
}

async function showOverdueTransfers() {
    var overdue = window._OVERDUE_TRANSFERS || [];
    if (!overdue.length) return;
    var existing = document.getElementById('overdueTransferOverlay');
    if (existing) existing.remove();

    var html = '<div style="background:var(--bg-card);border-radius:20px;padding:32px;max-width:900px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5);">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">';
    html += '<h2 style="font-size:18px;font-weight:800;color:var(--t1);margin:0!important;">Overdue Transfer Requests (3+ days)</h2>';
    html += '<button onclick="document.getElementById(\'overdueTransferOverlay\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--t3);">×</button>';
    html += '</div>';

    overdue.forEach(function(item) {
        var reqDate = item.Transfer_Request_Date ? new Date(item.Transfer_Request_Date) : null;
        var days = reqDate ? Math.floor((new Date() - reqDate) / 86400000) : '?';
        var cleanReason = (item.Transfer_x0020_Reason || 'Revenue threshold').replace(/<[^>]*>/g, '').trim();
        var amName = item.Account_x0020_Manager ? item.Account_x0020_Manager.Title : '';
        var adName = item.Account_x0020_Director ? item.Account_x0020_Director.Title : '';
        // keep names only; reminder email uses display names

        html += '<div style="border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
        [['Account', item.Title], ['Customer', item.Customer_x0020_Name],
         ['Current Team', item.Team], ['Proposed Team', item.Proposed_x0020_Team],
         ['AM', amName], ['AD', adName], ['Days Overdue', days + ' days'], ['Reason', cleanReason]
        ].forEach(function(f) {
            html += '<div style="padding:8px;background:rgba(168,85,247,0.08);border-radius:8px;">';
            html += '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:2px;">' + f[0] + '</div>';
            html += '<div style="font-size:13px;font-weight:600;">' + (f[1]||'N/A') + '</div></div>';
        });
        html += '</div>';
        html += '<div style="display:flex;gap:10px;">';
        html += '<button type="button" class="export-btn" style="font-size:12px;padding:8px 14px;" onclick="autoApproveTransfer(' + item.ID + ',\'' + item.Title + '\',\'' + (item.Customer_x0020_Name||'') + '\',\'' + (item.Team||'') + '\',\'' + (item.Proposed_x0020_Team||'') + '\',\'' + amName + '\',\'' + adName + '\')">' +
            '<i data-lucide="check-circle" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Auto-Approve</button>';
        html += '<button type="button" class="reset-btn" style="font-size:12px;padding:8px 14px;" onclick="sendReminderEmailTransfer(\'' + amName + '\',\'' + adName + '\',\'' + item.Title + '\',\'' + (item.Customer_x0020_Name||'') + '\',\'' + (item.Team||'') + '\',\'' + (item.Proposed_x0020_Team||'') + '\')">' +
            '<i data-lucide="mail" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Send Reminder</button>';
        html += '</div></div>';
    });
    html += '</div>';

    var overlay = document.createElement('div');
    overlay.id = 'overdueTransferOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
    overlay.innerHTML = html;
    if (typeof smMountPopup === 'function') smMountPopup(overlay);
    else document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function autoApproveTransfer(itemId, code, customer, oldTeam, newTeam, amName, adName) {
    if (!confirm('Auto-approve transfer for account ' + code + '? This will forward to Service Director.')) return;
    try {
        var itemUrl = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + itemId + ")?" +
            "$select=Title,Customer_x0020_Name,Team,Proposed_x0020_Team,Transfer_x0020_Reason," +
            "Line_x0020_Manager/Title,Service_x0020_Manager/Title," +
            "Account_x0020_Manager/Title,Account_x0020_Manager/EMail," +
            "Account_x0020_Director/Title,Account_x0020_Director/EMail," +
            "Service_x0020_Director/Title,Service_x0020_Director/EMail&" +
            "$expand=Line_x0020_Manager,Service_x0020_Manager,Account_x0020_Manager,Account_x0020_Director,Service_x0020_Director";
        var itemRes = await fetch(itemUrl, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!itemRes.ok) throw new Error('Failed to load item');
        var item = (await itemRes.json()).d;
        await updateSharePointItem(itemId, { Request_x0020_Status: 'AM_Approved' });
        await sendTransferApprovalEmailToSD(item);
        var overlay = document.getElementById('overdueTransferOverlay');
        if (overlay) overlay.remove();
        var alert = document.getElementById('transferOverdueAlert');
        if (alert) alert.remove();
        loadAdminTransferRequests();
        alert('Transfer auto-approved and forwarded to Service Director.');
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

function sendReminderEmailTransfer(amName, adName, code, customer, oldTeam, newTeam) {
    var subj = encodeURIComponent('[REMINDER] Transfer Request Pending Approval - ACC# ' + code + ' | ' + customer);
    var bdy = encodeURIComponent('Dear ' + amName + ' / ' + adName + ',\n\nThis is a reminder that a transfer request for the following account has been pending your approval for 3+ days and requires immediate action.\n\nAccount: ' + code + ' - ' + customer + '\nCurrent Team: ' + oldTeam + '\nProposed Team: ' + newTeam + '\n\nPlease log in to approve or reject:\nhttp://sharedspaces:8086/sites/SM/SitesPages/Dashboard.aspx\n\nNote: If no action is taken, the request may be auto-approved.\n\nBest regards,\n' + USER_CONTEXT.userName);
    var to = encodeURIComponent(amName + '; ' + adName);
    window.location.href = 'mailto:' + to + '?subject=' + subj + '&body=' + bdy;
}

window.renderTransferGridFiltered = renderTransferGridFiltered;
window.searchTransfers = searchTransfers;
window.exportTransferToExcel = exportTransferToExcel;
window.showOverdueTransfers = showOverdueTransfers;
window.autoApproveTransfer = autoApproveTransfer;
window.sendReminderEmailTransfer = sendReminderEmailTransfer;
window.showDeclineTransferPanel = showDeclineTransferPanel;
window.submitDeclineTransfer = submitDeclineTransfer;
window.openTransferRequest = openTransferRequest;

function showDeclineTransferPanel() {
    var panel = document.getElementById('sdDeclinePanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        document.getElementById('sdDeclineReason').value = '';
    }
}

async function submitDeclineTransfer() {
    var reason = document.getElementById('sdDeclineReason').value.trim();
    if (!reason) { alert('Please enter a decline reason'); return; }
    if (!confirm('Decline this transfer? The account will revert to its current team.')) return;

    try {
        var item = CURRENT_TRANSFER_ITEM;
        var amName = item.Account_x0020_Manager ? item.Account_x0020_Manager.Title : '';
        var adName = item.Account_x0020_Director ? item.Account_x0020_Director.Title : '';
        var lmName = item.Line_x0020_Manager ? item.Line_x0020_Manager.Title : '';
        var smName = item.Service_x0020_Manager ? item.Service_x0020_Manager.Title : '';

        var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!digestRes.ok) throw new Error('Failed to get digest');
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        var updateUrl = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + item.ID + ")";
        if (transferIsTsmSeSourceItem(item) && !transferIsDashboardActive(item)) {
            await transferDeleteMainAccount(item.ID);
        } else {
            var updateRes = await fetch(updateUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': digest,
                    'IF-MATCH': '*',
                    'X-HTTP-Method': 'MERGE'
                },
                credentials: 'include',
                body: JSON.stringify({
                    __metadata: { type: 'SP.Data.Service_x0020_Manager_x0020_RequestListItem' },
                    Request_x0020_Status: 'OnBoarded',
                    Request_x0020_Type: 'New Account',
                    Rejection_x0020_Reason: reason,
                    Proposed_x0020_Team: null,
                    Transfer_x0020_Reason: null,
                    Requested_x0020_ById: null
                })
            });
            if (!updateRes.ok) throw new Error('Update failed: ' + await updateRes.text());
        }

        if (typeof logAccountHistory === 'function') {
            logAccountHistory(
                item.Title, item.Customer_x0020_Name,
                'Transfer Declined by SD/Admin',
                'Declined by ' + USER_CONTEXT.userName + '. Reason: ' + reason,
                USER_CONTEXT.userName, smName, '', item.Team || '', '', reason
            );
        }

        var subj = encodeURIComponent('[Transfer Declined] ACC# ' + item.Title + ' - ' + item.Customer_x0020_Name);
        var bdy = encodeURIComponent('Dear ' + amName + ' / ' + adName + ',\n\nThe transfer request for account ' + item.Title + ' - ' + item.Customer_x0020_Name + ' has been declined by ' + USER_CONTEXT.userName + '.\n\nCurrent Team: ' + item.Team + ' (unchanged)\nDecline Reason: ' + reason + '\n\nThe account remains with its current team.\n\nBest regards,\n' + USER_CONTEXT.userName);
        var to = encodeURIComponent(amName + '; ' + adName);
        var cc = encodeURIComponent(lmName + '; ' + smName + '; ' + USER_CONTEXT.userName);
        window.location.href = 'mailto:' + to + '?subject=' + subj + '&body=' + bdy + '&cc=' + cc;

        document.getElementById('sdTransferMessage').innerHTML = '<span style="color:var(--success);">Transfer declined successfully.</span>';
        setTimeout(function() {
            CURRENT_TRANSFER_ITEM = null;
            backToTransfersList();
            loadAdminTransferRequests();
        }, 2000);

    } catch(e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}
