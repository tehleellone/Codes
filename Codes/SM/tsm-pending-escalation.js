// ============================================================
// tsm-pending-escalation.js — TSM Pending + Escalation (separate SM menus)
// SharePoint list: ME_Pending_Tracking (DO NOT rename list)
// Teams: TSM_ME + TSM_SE
//
// Add these SharePoint columns if missing (internal name → type):
//   Record_Type            Choice: Pending | Escalation
//   Line_Manager           Single line text (auto-filled from account mapping)
//   Escalation_Level       Choice: L1 | L2 | L3 | Executive
//   Escalation_Date        Date and Time
//   Escalation_Reason      Choice: SLA Breach | Customer Complaint | Technical | Billing | Management Request | Other
//   Escalation_Status      Choice: Open | Under Review | Closed
//   Resolution_Notes       Multiple lines of text
//   Escalation_Logged_By   Single line text (auto from current user)
//   Escalation_Log_Date    Date and Time (auto today, read-only)
// ============================================================

(function () {
    'use strict';

    var TSPE_LIST = 'ME_Pending_Tracking';
    var TSPE_ENTITY = 'SP.Data.ME_x005f_Pending_x005f_TrackingListItem';

    var TSPE_RECORD_TYPES = ['Pending', 'Escalation'];
    var TSPE_TSM_TEAMS = ['TSM_ME', 'TSM_SE'];
    var TSPE_SENDER_TYPES = ['Customer', 'Internal', 'Vendor', 'AM', 'LM', 'Other'];
    var TSPE_PENDING_WITH = ['Agent', 'SM', 'LM', 'AM', 'AD', 'Customer', 'PSD', 'Other'];
    var TSPE_STATUSES = ['In Progress', 'Resolved'];
    var TSPE_ISSUE_TYPES = ['Billing', 'Technical', 'Service', 'Escalation', 'Documentation', 'Other'];
    var TSPE_PRIORITIES = ['Low', 'Medium', 'High'];
    var TSPE_ESC_LEVELS = ['L1', 'L2', 'L3', 'Executive'];
    var TSPE_ESC_REASONS = ['SLA Breach', 'Customer Complaint', 'Technical', 'Billing', 'Management Request', 'Other'];
    var TSPE_ESC_STATUSES = ['Open', 'Under Review', 'Closed'];

    var TSPE = {
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
            escLevel: '',
            search: '',
            dateFrom: '',
            dateTo: ''
        },
        activeKpi: null,
        activeAgent: null,
        activeTab: 'pending',
        chartGranularity: 'weekly',
        formRecordType: 'Pending',
        editingId: null,
        loaded: false
    };

    function tspeSpUrl() {
        return (typeof SP_URL !== 'undefined' && SP_URL) ? SP_URL : '';
    }

    function tspeUserName() {
        return (window.USER_CONTEXT && USER_CONTEXT.userName) || '';
    }

    function tspeUserRole() {
        return (window.USER_CONTEXT && USER_CONTEXT.role) || '';
    }

    function tspeNorm(s) {
        return String(s || '').trim().toLowerCase();
    }

    function tspeEsc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function tspeParseDate(val) {
        if (!val) return null;
        var d = val instanceof Date ? val : new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    function tspeFmtDate(val) {
        var d = tspeParseDate(val);
        if (!d) return '—';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function tspeFmtDateInput(val) {
        var d = tspeParseDate(val);
        if (!d) return '';
        return d.toISOString().slice(0, 10);
    }

    function tspeChoice(val) {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (val.results && val.results.length) return val.results[0];
        return String(val);
    }

    function tspeStripHtml(val) {
        if (val == null || val === '') return '';
        return String(val)
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function tspePlain(val) {
        if (val == null || val === '') return '';
        if (typeof val === 'object') {
            if (val.results && val.results.length) return tspePlain(val.results[0]);
            return '';
        }
        return tspeStripHtml(val);
    }

    function tspeTextDiv(val) {
        var text = tspeStripHtml(val);
        if (!text) return '<span style="color:var(--t3);">—</span>';
        return '<div style="white-space:pre-wrap;line-height:1.35;">' + tspeEsc(text) + '</div>';
    }

    function tspeTsmAgents() {
        var names = {};
        if (window.ALL_DATA) {
            window.ALL_DATA.forEach(function (a) {
                if (tspeIsTsmTeam(a.team) && a.sm) names[a.sm] = true;
            });
        }
        TSPE.allItems.forEach(function (r) {
            if (r.agentName) names[r.agentName] = true;
        });
        return Object.keys(names).sort();
    }

    function tspeTsmLineManagers() {
        var names = {};
        if (window.ALL_DATA) {
            window.ALL_DATA.forEach(function (a) {
                if (tspeIsTsmTeam(a.team) && a.lm) names[a.lm] = true;
            });
        }
        TSPE.allItems.forEach(function (r) {
            if (r.lineManager) names[r.lineManager] = true;
        });
        return Object.keys(names).sort();
    }

    function tspeActiveRootId() {
        return TSPE.activeTab === 'escalation' ? 'tsmEscRoot' : 'tsmPeRoot';
    }

    function tspeActiveLoadingId() {
        return TSPE.activeTab === 'escalation' ? 'tsmEscLoading' : 'tsmPeLoading';
    }

    function tspeActiveContentId() {
        return TSPE.activeTab === 'escalation' ? 'tsmEscContent' : 'tsmPeContent';
    }

    function tspeCalcAgeing(row, dateField) {
        var start = tspeParseDate(row[dateField || 'emailReceivedDate']);
        if (!start) return null;
        var end = new Date();
        if (row.caseStatus === 'Resolved') {
            var resolved = tspeParseDate(row.resolvedDate);
            if (resolved) end = resolved;
        }
        return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
    }

    function tspeAgeColor(days) {
        if (days == null) return 'var(--t3)';
        if (days > 14) return '#ef4444';
        if (days > 7) return '#f97316';
        return '#10b981';
    }

    function tspeLookupAccount(accountCode) {
        if (!accountCode || !window.ALL_DATA) return null;
        var code = String(accountCode).trim().toUpperCase();
        return window.ALL_DATA.find(function (a) {
            return String(a.code || '').trim().toUpperCase() === code;
        }) || null;
    }

    function tspeLookupCustomer(accountCode) {
        var match = tspeLookupAccount(accountCode);
        return match ? (match.customer || '') : '';
    }

    function tspeLookupLm(accountCode, agentName) {
        var acct = tspeLookupAccount(accountCode);
        if (acct && acct.lm) return acct.lm;
        if (window.ALL_DATA && agentName) {
            var smRow = window.ALL_DATA.find(function (a) {
                return a.sm === agentName && (a.team === 'TSM_ME' || a.team === 'TSM_SE');
            });
            if (smRow && smRow.lm) return smRow.lm;
        }
        return '';
    }

    function tspeInferTeam(accountCode, agentName) {
        var acct = tspeLookupAccount(accountCode);
        if (acct && tspeIsTsmTeam(acct.team)) return acct.team;
        if (window.ALL_DATA && agentName) {
            var smRow = window.ALL_DATA.find(function (a) {
                return tspeNorm(a.sm) === tspeNorm(agentName) && tspeIsTsmTeam(a.team);
            });
            if (smRow) return smRow.team;
        }
        if (window.ALL_DATA && tspeUserName()) {
            var selfRow = window.ALL_DATA.find(function (a) {
                return tspeNorm(a.sm) === tspeNorm(tspeUserName()) && tspeIsTsmTeam(a.team);
            });
            if (selfRow) return selfRow.team;
        }
        return '';
    }

    function tspeTeamLabel(teamName) {
        if (teamName === 'TSM_SE') return 'TSM SE · Undedicated';
        if (teamName === 'TSM_ME') return 'TSM ME · Dedicated';
        return '';
    }

    function tspeCanPickTeam() {
        var role = tspeUserRole();
        return role === 'Admin' || role === 'Service Director' ||
            (window.USER_CONTEXT && window.USER_CONTEXT.isTSMManager) ||
            role === 'Line Manager';
    }

    function tspeGetFormTeamValue() {
        var hidden = document.getElementById('tspeFormTeamHidden');
        if (hidden) return hidden.value;
        var sel = document.getElementById('tspeFormTeam');
        return sel ? sel.value : '';
    }

    function tspeSetFormTeamValue(team, force) {
        var sel = document.getElementById('tspeFormTeam');
        var hidden = document.getElementById('tspeFormTeamHidden');
        if (hidden) {
            hidden.value = team;
            if (sel) sel.value = team;
            return;
        }
        if (!sel || sel.disabled) return;
        if (force || !sel.value) sel.value = team;
        tspeFormTeamChanged();
    }

    function tspeFormTeamField(value, locked, hint) {
        var team = value || '';
        if (locked || !tspeCanPickTeam()) {
            if (!team) team = tspeInferTeam('', tspeUserName()) || 'TSM_ME';
            return '<div class="filter-group"><label class="filter-label">TSM Team *</label>' +
                '<select class="filter-select" id="tspeFormTeam" disabled style="font-size:13px;padding:10px;background:var(--bg-hover);">' +
                '<option value="TSM_ME"' + (team === 'TSM_ME' ? ' selected' : '') + '>TSM ME · Dedicated</option>' +
                '<option value="TSM_SE"' + (team === 'TSM_SE' ? ' selected' : '') + '>TSM SE · Undedicated</option>' +
                '</select>' +
                '<input type="hidden" id="tspeFormTeamHidden" value="' + tspeEsc(team) + '">' +
                '<div style="font-size:11px;color:var(--t3);margin-top:4px;">' + tspeEsc(hint || 'Your assigned TSM team') + '</div></div>';
        }
        var defaultFromFilter = value || TSPE.filters.team || '';
        return '<div class="filter-group"><label class="filter-label">TSM Team *</label>' +
            '<select class="filter-select" id="tspeFormTeam" onchange="tspeFormTeamChanged()" required style="font-size:13px;padding:10px;">' +
            '<option value="">— Select TSM ME or TSM SE —</option>' +
            '<option value="TSM_ME"' + (defaultFromFilter === 'TSM_ME' ? ' selected' : '') + '>TSM ME · Dedicated</option>' +
            '<option value="TSM_SE"' + (defaultFromFilter === 'TSM_SE' ? ' selected' : '') + '>TSM SE · Undedicated</option>' +
            '</select>' +
            '<div style="font-size:11px;color:var(--t3);margin-top:4px;">Required for Admin / LM — auto-fills when account code entered</div></div>';
    }

    function tspeFormTeamChanged() {
        tspeRefreshEscalatedToOptions();
        var banner = document.getElementById('tspeFormTeamBanner');
        var team = tspeGetFormTeamValue();
        if (banner && team) {
            banner.style.display = 'block';
            banner.style.background = team === 'TSM_SE' ? 'rgba(16,185,129,.12)' : 'rgba(59,130,246,.12)';
            banner.style.borderColor = team === 'TSM_SE' ? 'rgba(16,185,129,.35)' : 'rgba(59,130,246,.35)';
            banner.style.color = team === 'TSM_SE' ? '#059669' : '#2563eb';
            banner.innerHTML = '<strong>Logging under:</strong> ' + tspeTeamLabel(team);
        } else if (banner) {
            banner.style.display = 'none';
        }
    }

    function tspeUpdateFormTeamDisplay() {
        var code = (document.getElementById('tspeFormAccount') || {}).value;
        var agent = (document.getElementById('tspeFormAgent') || {}).value;
        var inferred = tspeInferTeam(code, agent);
        if (inferred) tspeSetFormTeamValue(inferred, false);
        else tspeFormTeamChanged();
        tspeRefreshEscalatedToOptions();
    }

    function tspeFindPendingByRef(refId) {
        if (!refId) return null;
        var q = String(refId).trim().toUpperCase();
        return TSPE.allItems.find(function (r) {
            return r.recordType !== 'Escalation' &&
                String(r.refId || '').trim().toUpperCase() === q;
        }) || null;
    }

    function tspeGetEscalationTargets(accountCode, agentName) {
        var seen = {};
        var targets = [];
        function add(role, name) {
            if (!name || seen[name]) return;
            seen[name] = true;
            targets.push({ role: role, name: name, label: role + ': ' + name });
        }
        var acct = tspeLookupAccount(accountCode);
        if (acct) {
            add('Line Manager', acct.lm);
            add('Service Manager', acct.sm);
            add('Account Manager', acct.am);
            add('Account Director', acct.ad);
        }
        if (window.ALL_DATA && agentName) {
            var smRows = window.ALL_DATA.filter(function (a) {
                return tspeNorm(a.sm) === tspeNorm(agentName) && tspeIsTsmTeam(a.team);
            });
            smRows.forEach(function (a) {
                add('Line Manager', a.lm);
                add('Service Manager', a.sm);
            });
        }
        add('TSM Manager', 'TSM Manager');
        return targets;
    }

    function tspeRefreshEscalatedToOptions() {
        var sel = document.getElementById('tspeFormEscalatedTo');
        if (!sel) return;
        var current = sel.value;
        var code = (document.getElementById('tspeFormAccount') || {}).value;
        var agent = (document.getElementById('tspeFormAgent') || {}).value;
        var targets = tspeGetEscalationTargets(code, agent);
        sel.innerHTML = '<option value="">Select who to escalate to...</option>';
        targets.forEach(function (t) {
            sel.innerHTML += '<option value="' + tspeEsc(t.name) + '">' + tspeEsc(t.label) + '</option>';
        });
        sel.innerHTML += '<option value="__other__">Other (type name below)</option>';
        if (current && current !== '__other__') sel.value = current;
    }

    function tspeApplyPendingToForm(pending) {
        if (!pending) return;
        var setVal = function (id, val) {
            var el = document.getElementById(id);
            if (el && val != null && val !== '') el.value = val;
        };
        setVal('tspeFormLinkedRef', pending.refId);
        setVal('tspeFormSubject', pending.subjectLine);
        setVal('tspeFormAccount', pending.accountCode);
        setVal('tspeFormCustomer', pending.customerName);
        setVal('tspeFormAgent', pending.agentName);
        setVal('tspeFormLM', pending.lineManager || tspeLookupLm(pending.accountCode, pending.agentName));
        setVal('tspeFormSender', pending.senderType);
        setVal('tspeFormPending', pending.pendingWith);
        setVal('tspeFormPriority', pending.priority);
        tspeSetFormTeamValue(pending.teamName, true);
        tspeFormTeamChanged();
        var hint = document.getElementById('tspeLinkedPendingHint');
        if (hint) {
            hint.style.display = 'block';
            hint.innerHTML = 'Linked to pending <strong>' + tspeEsc(pending.refId) + '</strong> · ' +
                tspeEsc(pending.teamName) + ' · ' + tspeEsc(pending.agentName) +
                (pending.accountCode ? ' · ' + tspeEsc(pending.accountCode) : '');
        }
    }

    function tspeFormLinkedRefBlur() {
        var ref = (document.getElementById('tspeFormLinkedRef') || {}).value;
        var pending = tspeFindPendingByRef(ref);
        if (!pending) {
            var hint = document.getElementById('tspeLinkedPendingHint');
            if (hint && ref) {
                hint.style.display = 'block';
                hint.style.color = '#ef4444';
                hint.textContent = 'Pending ref not found — check TSM-P-ME- or TSM-P-SE- ref ID';
            }
            tspeUpdateFormTeamDisplay();
            return;
        }
        tspeApplyPendingToForm(pending);
    }

    function tspeInferRecordType(item) {
        var explicit = tspeChoice(item.Record_Type);
        if (explicit && TSPE_RECORD_TYPES.indexOf(explicit) !== -1) return explicit;
        return 'Pending';
    }

    function tspeIsTsmTeam(teamName) {
        return TSPE_TSM_TEAMS.indexOf(teamName) !== -1;
    }

    function tspeIsFullAccess() {
        var role = tspeUserRole();
        return role === 'Admin' || role === 'Service Director' ||
            (window.USER_CONTEXT && window.USER_CONTEXT.isTSMManager) ||
            role === 'Auditor' || role === 'Read Only' || role === 'TSM_SE_Viewer';
    }

    function tspeGetScopedAgentNames() {
        if (tspeIsFullAccess()) return null;
        var userName = tspeUserName();
        var role = tspeUserRole();
        if (role === 'Service Manager') return [userName];
        if (role === 'Line Manager' && window.ALL_DATA) {
            return [...new Set(window.ALL_DATA.filter(function (a) {
                return a.lm === userName && (a.team === 'TSM_ME' || a.team === 'TSM_SE');
            }).map(function (a) { return a.sm; }).filter(Boolean))];
        }
        return [];
    }

    function tspeRowInAccessScope(row) {
        var scoped = tspeGetScopedAgentNames();
        if (scoped === null) return true;
        if (!scoped.length) return tspeNorm(row.agentName) === tspeNorm(tspeUserName());
        return scoped.some(function (name) { return tspeNorm(name) === tspeNorm(row.agentName); });
    }

    function tspeIsReadOnlyUser() {
        return tspeUserRole() === 'Read Only' || tspeUserRole() === 'Auditor' || tspeUserRole() === 'TSM_SE_Viewer';
    }

    function tspeCanEditRow(row) {
        if (tspeIsReadOnlyUser()) return false;
        if (!tspeRowInAccessScope(row)) return false;
        if (tspeUserRole() === 'Service Manager' && row.recordType === 'Escalation') return false;
        return true;
    }

    function tspeCanLogNew() {
        if (tspeIsReadOnlyUser()) return false;
        if (TSPE.activeTab === 'escalation' && tspeUserRole() === 'Service Manager') return false;
        return true;
    }

    function tspeMapItem(item) {
        var row = {
            id: item.ID,
            refId: item.Title || '',
            emailReceivedDate: tspeParseDate(item.Email_Received_Date),
            senderType: tspeChoice(item.Sender_Type),
            subjectLine: tspePlain(item.Subject_Line),
            accountCode: tspePlain(item.Account_Code),
            customerName: tspePlain(item.Customer_Name),
            pendingWith: tspeChoice(item.Pending_With),
            caseStatus: tspeChoice(item.Case_Status) || 'In Progress',
            issueType: tspeChoice(item.Issue_Type),
            recordType: tspeInferRecordType(item),
            agentName: tspePlain(item.Agent_Name),
            teamName: tspeChoice(item.Team_Name),
            resolvedDate: tspeParseDate(item.Resolved_Date),
            priority: tspeChoice(item.Priority) || 'Medium',
            remarks: tspePlain(item.Remarks),
            loggedBy: tspePlain(item.Logged_By) || tspePlain(item.Escalation_Logged_By),
            escalationLoggedBy: tspePlain(item.Escalation_Logged_By) || tspePlain(item.Logged_By),
            escalationLogDate: tspeParseDate(item.Escalation_Log_Date) || tspeParseDate(item.Escalation_Date),
            linkedRefId: tspePlain(item.Linked_Ref_ID),
            escalatedTo: tspePlain(item.Escalated_To),
            escalationLevel: tspePlain(item.Escalation_Level),
            escalationDate: tspeParseDate(item.Escalation_Date),
            escalationReason: tspePlain(item.Escalation_Reason),
            lineManager: tspePlain(item.Line_Manager),
            escalationStatus: tspePlain(item.Escalation_Status) || 'Open',
            resolutionNotes: tspePlain(item.Resolution_Notes)
        };
        if (!row.customerName && row.accountCode) {
            row.customerName = tspeLookupCustomer(row.accountCode);
        }
        if (!row.lineManager) {
            row.lineManager = tspeLookupLm(row.accountCode, row.agentName);
        }
        row.ageingDays = tspeCalcAgeing(row, 'emailReceivedDate');
        row.escAgeingDays = row.recordType === 'Escalation'
            ? tspeCalcAgeing({ emailReceivedDate: row.escalationDate || row.emailReceivedDate, caseStatus: row.caseStatus, resolvedDate: row.resolvedDate }, 'emailReceivedDate')
            : null;
        return row;
    }

    async function tspeGetDigest() {
        var res = await fetch(tspeSpUrl() + '/_api/contextinfo', {
            method: 'POST',
            headers: { Accept: 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to get form digest');
        var data = await res.json();
        return data.d.GetContextWebInformation.FormDigestValue;
    }

    async function tspeFetchItems() {
        var extendedSelect = 'ID,Title,Email_Received_Date,Sender_Type,Subject_Line,Account_Code,Customer_Name,' +
            'Pending_With,Case_Status,Issue_Type,Record_Type,Agent_Name,Team_Name,Resolved_Date,Priority,Remarks,Logged_By,' +
            'Linked_Ref_ID,Escalated_To,Escalation_Level,Escalation_Date,Escalation_Reason,Line_Manager,Escalation_Status,Resolution_Notes,' +
            'Escalation_Logged_By,Escalation_Log_Date';
        var midSelect = 'ID,Title,Email_Received_Date,Sender_Type,Subject_Line,Account_Code,Customer_Name,' +
            'Pending_With,Case_Status,Issue_Type,Record_Type,Agent_Name,Team_Name,Resolved_Date,Priority,Remarks,Logged_By,' +
            'Linked_Ref_ID,Escalated_To,Escalation_Level';
        var baseSelect = 'ID,Title,Email_Received_Date,Sender_Type,Subject_Line,Account_Code,Customer_Name,' +
            'Pending_With,Case_Status,Issue_Type,Agent_Name,Team_Name,Resolved_Date,Priority,Remarks,Logged_By';
        var queries = [extendedSelect, midSelect, baseSelect];

        for (var i = 0; i < queries.length; i++) {
            var url = tspeSpUrl() + "/_api/web/lists/getbytitle('" + TSPE_LIST + "')/items?" +
                '$select=' + queries[i] + '&$orderby=Email_Received_Date desc&$top=5000';
            var res = await fetch(url, {
                headers: { Accept: 'application/json;odata=verbose' },
                credentials: 'include'
            });
            if (res.ok) {
                var data = await res.json();
                return (data.d.results || []).map(tspeMapItem).filter(tspeRowInAccessScope);
            }
            if (i === queries.length - 1) {
                var errText = await res.text();
                throw new Error('Could not load ME_Pending_Tracking list. ' + res.status + ': ' + errText.slice(0, 200));
            }
        }
        return [];
    }

    function tspeScopedItems(items) {
        return (items || TSPE.allItems).filter(function (row) {
            if (!tspeIsTsmTeam(row.teamName)) return false;
            if (TSPE.activeTab === 'escalation') return row.recordType === 'Escalation';
            return row.recordType !== 'Escalation';
        });
    }

    function tspeApplyFilters() {
        var f = TSPE.filters;
        var scoped = tspeScopedItems();
        TSPE.filtered = scoped.filter(function (row) {
            if (TSPE.activeKpi === 'open' && row.caseStatus !== 'In Progress') return false;
            if (TSPE.activeKpi === 'resolved' && row.caseStatus !== 'Resolved') return false;
            if (TSPE.activeKpi === 'high' && row.priority !== 'High') return false;
            if (TSPE.activeKpi === 'l2plus' && TSPE.activeTab === 'escalation') {
                if (['L2', 'L3', 'Executive'].indexOf(row.escalationLevel) === -1) return false;
            }
            if (TSPE.activeAgent && row.agentName !== TSPE.activeAgent) return false;
            if (f.team && row.teamName !== f.team) return false;
            if (f.agent && row.agentName !== f.agent) return false;
            if (f.status && row.caseStatus !== f.status) return false;
            if (f.issueType && row.issueType !== f.issueType) return false;
            if (f.pendingWith && row.pendingWith !== f.pendingWith) return false;
            if (f.senderType && row.senderType !== f.senderType) return false;
            if (f.priority && row.priority !== f.priority) return false;
            if (f.escLevel && row.escalationLevel !== f.escLevel) return false;
            if (f.dateFrom && row.emailReceivedDate) {
                if (tspeFmtDateInput(row.emailReceivedDate) < f.dateFrom) return false;
            }
            if (f.dateTo && row.emailReceivedDate) {
                if (tspeFmtDateInput(row.emailReceivedDate) > f.dateTo) return false;
            }
            if (f.search) {
                var q = f.search.toLowerCase();
                var blob = [
                    row.refId, row.subjectLine, row.accountCode, row.customerName,
                    row.agentName, row.remarks, row.loggedBy, row.linkedRefId,
                    row.escalatedTo, row.escalationReason, row.lineManager
                ].join(' ').toLowerCase();
                if (blob.indexOf(q) === -1) return false;
            }
            return true;
        });
    }

    function tspeTeamSplit(items) {
        var me = 0, se = 0;
        (items || []).forEach(function (r) {
            if (r.teamName === 'TSM_ME') me++;
            else if (r.teamName === 'TSM_SE') se++;
        });
        return { me: me, se: se };
    }

    function tspeSummary() {
        var scoped = tspeScopedItems();
        var open = scoped.filter(function (r) { return r.caseStatus === 'In Progress'; });
        var resolved = scoped.filter(function (r) { return r.caseStatus === 'Resolved'; });
        var ages = open.map(function (r) {
            return TSPE.activeTab === 'escalation' ? (r.escAgeingDays != null ? r.escAgeingDays : r.ageingDays) : r.ageingDays;
        }).filter(function (v) { return v != null; });
        var avgAge = ages.length ? Math.round(ages.reduce(function (s, v) { return s + v; }, 0) / ages.length) : 0;
        var split = tspeTeamSplit(open);
        var l2plus = open.filter(function (r) {
            return ['L2', 'L3', 'Executive'].indexOf(r.escalationLevel) >= 0;
        }).length;
        return {
            total: scoped.length,
            open: open.length,
            resolved: resolved.length,
            avgAge: avgAge,
            meOpen: split.me,
            seOpen: split.se,
            l2plus: l2plus,
            highPriority: open.filter(function (r) { return r.priority === 'High'; }).length
        };
    }

    function tspeAgentCounts() {
        var map = {};
        tspeScopedItems().forEach(function (row) {
            if (row.caseStatus !== 'In Progress' || !row.agentName) return;
            map[row.agentName] = (map[row.agentName] || 0) + 1;
        });
        return Object.keys(map).map(function (name) {
            return { name: name, count: map[name] };
        }).sort(function (a, b) { return b.count - a.count; });
    }

    function tspeUnique(field) {
        var set = {};
        tspeScopedItems().forEach(function (r) {
            var v = r[field];
            if (v) set[v] = true;
        });
        return Object.keys(set).sort();
    }

    function tspeTabLabel() {
        return TSPE.activeTab === 'escalation' ? 'Escalation Tracker' : 'TSM Pending Tracker';
    }

    function tspeCountOpen(recordType) {
        return TSPE.allItems.filter(function (r) {
            if (!tspeIsTsmTeam(r.teamName)) return false;
            if (r.caseStatus !== 'In Progress') return false;
            if (recordType === 'Escalation') return r.recordType === 'Escalation';
            return r.recordType !== 'Escalation';
        }).length;
    }

    function tspeAccessBanner() {
        var role = tspeUserRole();
        if (role === 'Service Manager') {
            return '<div style="margin-bottom:12px;padding:10px 14px;border-radius:10px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);font-size:12px;color:#2563eb;font-weight:600;">Showing your cases only · Escalations are view-only for Service Managers</div>';
        }
        if (role === 'Line Manager') {
            return '<div style="margin-bottom:12px;padding:10px 14px;border-radius:10px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.2);font-size:12px;color:#7c3aed;font-weight:600;">Showing TSM cases for your Service Managers</div>';
        }
        return '';
    }

    function tspeRenderTabs() {
        return '';
    }

    function tspeRenderShell() {
        var other = document.getElementById(TSPE.activeTab === 'escalation' ? 'tsmPeRoot' : 'tsmEscRoot');
        if (other) other.innerHTML = '';
        var root = document.getElementById(tspeActiveRootId());
        if (!root) return;
        var isEsc = TSPE.activeTab === 'escalation';
        var title = isEsc ? 'Escalation Tracker' : 'TSM Pending';
        var subtitle = isEsc ? 'Track TSM escalations by trend and agent' : 'Track pending TSM email cases by trend and agent';
        var gran = TSPE.chartGranularity || 'weekly';
        function granBtn(key, label) {
            var on = gran === key;
            return '<button type="button" class="' + (on ? 'export-btn' : 'reset-btn') + '" onclick="tspeSetChartGranularity(\'' + key + '\')" style="padding:7px 12px;font-size:12px;">' + label + '</button>';
        }
        root.innerHTML =
            '<div class="table-section" style="margin-bottom:1rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">' +
                    '<div><h3 class="table-title" style="margin:0;"><i data-lucide="' + (isEsc ? 'alert-triangle' : 'inbox') + '" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' + title + '</h3>' +
                    '<p style="margin:6px 0 0;font-size:13px;color:var(--t3);">' + subtitle + '</p></div>' +
                    '<div id="tspeActionBtns" style="display:flex;gap:10px;flex-wrap:wrap;">' +
                        '<button type="button" class="export-btn" id="tspeLogBtn" onclick="tspeOpenForm()"><i data-lucide="plus" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Log ' + (isEsc ? 'Escalation' : 'Case') + '</button>' +
                        '<button type="button" class="export-btn" onclick="tspeExportExcel()"><i data-lucide="file-spreadsheet" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export Excel</button>' +
                        '<button type="button" class="reset-btn" onclick="tspeExportPdf()"><i data-lucide="file-text" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Export PDF</button>' +
                    '</div>' +
                '</div>' +
                '<div id="tspeAccessBanner"></div>' +
                '<div id="tspeTabs"></div>' +
                '<div id="tspeKpiTiles" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;"></div>' +
                '<div id="tspeFilters" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px;"></div>' +
                '<div id="tspeAgentTiles" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;"></div>' +
                '<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px;">' +
                    granBtn('daily', 'Daily') + granBtn('weekly', 'Weekly') + granBtn('monthly', 'Monthly') +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">' +
                    '<div class="edit-revenue-card" style="padding:16px;"><div style="font-size:12px;font-weight:700;color:var(--t3);margin-bottom:8px;">' + (isEsc ? 'Escalation Trend' : 'Pending Trend') + '</div><div style="position:relative;height:240px;"><canvas id="tspeChartTrend"></canvas></div></div>' +
                    '<div class="edit-revenue-card" style="padding:16px;"><div style="font-size:12px;font-weight:700;color:var(--t3);margin-bottom:8px;">Per Agent</div><div style="position:relative;height:240px;"><canvas id="tspeChartAgent"></canvas></div></div>' +
                '</div>' +
                '<div id="tspeGrid" class="ag-theme-alpine" style="height:560px;width:100%;"></div>' +
            '</div>' +
            '<div id="tspeModal" style="display:none;position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:24px;">' +
                '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:18px;max-width:920px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,.35);">' +
                    '<div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
                        '<div style="font-size:18px;font-weight:800;" id="tspeModalTitle">Log Case</div>' +
                        '<button type="button" class="reset-btn" onclick="tspeCloseForm()" style="padding:8px 12px;">Close</button>' +
                    '</div>' +
                    '<div id="tspeFormBody" style="padding:22px;"></div>' +
                    '<div style="padding:16px 22px;border-top:1px solid var(--border);display:flex;gap:12px;">' +
                        '<button type="button" class="export-btn" id="tspeSaveBtn" onclick="tspeSaveForm()" style="flex:1;">Save</button>' +
                        '<button type="button" class="reset-btn" onclick="tspeCloseForm()">Cancel</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function tspeRenderKpis() {
        var el = document.getElementById('tspeKpiTiles');
        if (!el) return;
        var s = tspeSummary();
        var tiles;
        if (TSPE.activeTab === 'escalation') {
            tiles = [
                { key: null, label: 'Total Escalations', value: s.total, color: 'var(--accent)' },
                { key: 'open', label: 'Open Escalations', value: s.open, color: '#ef4444' },
                { key: 'l2plus', label: 'L2+ Open', value: s.l2plus, color: '#dc2626' },
                { key: 'avg', label: 'Avg Esc Age (Open)', value: s.avgAge + 'd', color: '#4c6fff' }
            ];
        } else {
            tiles = [
                { key: null, label: 'Total Cases', value: s.total, color: 'var(--accent)' },
                { key: 'open', label: 'Open (In Progress)', value: s.open, color: '#f97316' },
                { key: 'resolved', label: 'Resolved', value: s.resolved, color: '#10b981' },
                { key: 'avg', label: 'Avg Ageing (Open)', value: s.avgAge + 'd', color: '#4c6fff' },
                { key: null, label: 'ME / SE Open', value: s.meOpen + ' / ' + s.seOpen, color: '#2563eb' }
            ];
        }
        el.innerHTML = tiles.map(function (t) {
            var active = tspeIsKpiActive(t.key);
            return '<div onclick="tspeKpiClick(' + (t.key ? "'" + t.key + "'" : 'null') + ')" style="cursor:' + (t.key ? 'pointer' : 'default') + ';padding:16px;border-radius:14px;border:2px solid ' + (active ? t.color : 'var(--border)') + ';background:rgba(168,85,247,.06);">' +
                '<div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;">' + t.label + '</div>' +
                '<div style="font-size:24px;font-weight:800;color:' + t.color + ';margin-top:6px;">' + t.value + '</div></div>';
        }).join('');
    }

    function tspeIsKpiActive(key) {
        return TSPE.activeKpi === key || (key === null && !TSPE.activeKpi);
    }

    function tspeSelectHtml(id, label, options, value, allLabel) {
        var html = '<div class="filter-group"><label class="filter-label">' + label + '</label><select class="filter-select" id="' + id + '" onchange="tspeFilterChanged()" style="font-size:13px;padding:10px;">';
        html += '<option value="">' + (allLabel || 'All') + '</option>';
        options.forEach(function (opt) {
            html += '<option value="' + tspeEsc(opt) + '"' + (value === opt ? ' selected' : '') + '>' + tspeEsc(opt) + '</option>';
        });
        html += '</select></div>';
        return html;
    }

    function tspeRenderFilters() {
        var el = document.getElementById('tspeFilters');
        if (!el) return;
        var f = TSPE.filters;
        var escFilter = TSPE.activeTab === 'escalation'
            ? tspeSelectHtml('tspeFEscLevel', 'Escalation Level', TSPE_ESC_LEVELS, f.escLevel)
            : (tspeSelectHtml('tspeFIssue', 'Issue Type', TSPE_ISSUE_TYPES, f.issueType) +
               tspeSelectHtml('tspeFPending', 'Pending With', TSPE_PENDING_WITH, f.pendingWith) +
               tspeSelectHtml('tspeFPriority', 'Priority', TSPE_PRIORITIES, f.priority));
        el.innerHTML =
            tspeSelectHtml('tspeFTeam', 'TSM Team', TSPE_TSM_TEAMS, f.team, 'All Teams') +
            tspeSelectHtml('tspeFAgent', 'Agent', tspeUnique('agentName'), f.agent) +
            tspeSelectHtml('tspeFStatus', 'Case Status', TSPE_STATUSES, f.status) +
            tspeSelectHtml('tspeFSender', 'Sender Type', TSPE_SENDER_TYPES, f.senderType) +
            escFilter +
            '<div class="filter-group"><label class="filter-label">From Date</label><input type="date" class="filter-select" id="tspeFDateFrom" value="' + tspeEsc(f.dateFrom) + '" onchange="tspeFilterChanged()" style="font-size:13px;padding:10px;"></div>' +
            '<div class="filter-group"><label class="filter-label">To Date</label><input type="date" class="filter-select" id="tspeFDateTo" value="' + tspeEsc(f.dateTo) + '" onchange="tspeFilterChanged()" style="font-size:13px;padding:10px;"></div>' +
            '<div class="filter-group"><label class="filter-label">Search</label><input type="text" class="filter-select" id="tspeFSearch" value="' + tspeEsc(f.search) + '" oninput="tspeFilterChanged()" placeholder="Subject, account, agent..." style="font-size:13px;padding:10px;"></div>' +
            '<div class="filter-group" style="display:flex;align-items:flex-end;"><button type="button" class="reset-btn" onclick="tspeResetFilters()" style="width:100%;padding:10px;">Reset</button></div>';
    }

    function tspeRenderAgentTiles() {
        var el = document.getElementById('tspeAgentTiles');
        if (!el) return;
        var agents = tspeAgentCounts();
        if (!agents.length) {
            el.innerHTML = '<div style="font-size:12px;color:var(--t3);">No open cases by agent.</div>';
            return;
        }
        el.innerHTML = agents.slice(0, 12).map(function (a) {
            var active = TSPE.activeAgent === a.name;
            return '<button type="button" onclick="tspeAgentClick(\'' + tspeEsc(a.name).replace(/'/g, "\\'") + '\')" style="cursor:pointer;padding:10px 14px;border-radius:12px;border:2px solid ' + (active ? 'var(--accent)' : 'var(--border)') + ';background:var(--bg-card);font-weight:700;font-size:13px;">' +
                tspeEsc(a.name) + ' <span style="color:var(--accent);">(' + a.count + ')</span></button>';
        }).join('');
    }

    function tspeDestroyCharts() {
        Object.keys(TSPE.charts).forEach(function (key) {
            if (TSPE.charts[key]) {
                TSPE.charts[key].destroy();
                TSPE.charts[key] = null;
            }
        });
    }

    function tspeChartOptions(type) {
        var base = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { position: type === 'doughnut' ? 'bottom' : 'top' } }
        };
        if (type === 'bar') {
            base.plugins.legend = { display: false };
            base.scales = { y: { beginAtZero: true, ticks: { precision: 0 } } };
        }
        return base;
    }

    function tspeWeekKey(d) {
        var date = tspeParseDate(d);
        if (!date) return '';
        var tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        var day = tmp.getUTCDay() || 7;
        tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
        var yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
        var week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
        return tmp.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
    }

    function tspeBucketKey(d, gran) {
        var date = tspeParseDate(d);
        if (!date) return '';
        if (gran === 'daily') return tspeFmtDateInput(date);
        if (gran === 'monthly') return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        return tspeWeekKey(date);
    }

    function tspeRenderCharts() {
        if (typeof Chart === 'undefined') return;
        tspeDestroyCharts();
        var scoped = tspeScopedItems();
        var gran = TSPE.chartGranularity || 'weekly';
        var trendMap = {};
        scoped.forEach(function (r) {
            var src = TSPE.activeTab === 'escalation'
                ? (r.escalationLogDate || r.escalationDate || r.emailReceivedDate)
                : r.emailReceivedDate;
            var key = tspeBucketKey(src, gran);
            if (!key) return;
            trendMap[key] = (trendMap[key] || 0) + 1;
        });
        var trendLabels = Object.keys(trendMap).sort();
        var trendCanvas = document.getElementById('tspeChartTrend');
        if (trendCanvas) {
            TSPE.charts.trend = new Chart(trendCanvas, {
                type: 'line',
                data: {
                    labels: trendLabels.length ? trendLabels : ['No data'],
                    datasets: [{
                        label: TSPE.activeTab === 'escalation' ? 'Escalations' : 'Pending cases',
                        data: trendLabels.length ? trendLabels.map(function (k) { return trendMap[k]; }) : [0],
                        borderColor: TSPE.activeTab === 'escalation' ? '#ef4444' : '#4c6fff',
                        backgroundColor: TSPE.activeTab === 'escalation' ? 'rgba(239,68,68,.12)' : 'rgba(76,111,255,.12)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4
                    }]
                },
                options: tspeChartOptions('bar')
            });
        }
        var agentMap = {};
        scoped.forEach(function (r) {
            var name = r.agentName || 'Unassigned';
            agentMap[name] = (agentMap[name] || 0) + 1;
        });
        var agents = Object.keys(agentMap).map(function (name) {
            return { name: name, count: agentMap[name] };
        }).sort(function (a, b) { return b.count - a.count; }).slice(0, 12);
        var agentCanvas = document.getElementById('tspeChartAgent');
        if (agentCanvas) {
            TSPE.charts.agent = new Chart(agentCanvas, {
                type: 'bar',
                data: {
                    labels: agents.length ? agents.map(function (a) { return a.name; }) : ['None'],
                    datasets: [{
                        label: TSPE.activeTab === 'escalation' ? 'Escalations' : 'Cases',
                        data: agents.length ? agents.map(function (a) { return a.count; }) : [0],
                        backgroundColor: TSPE.activeTab === 'escalation' ? '#ef4444' : '#4c6fff'
                    }]
                },
                options: tspeChartOptions('bar')
            });
        }
    }

    function tspeRenderGrid() {
        var gridDiv = document.getElementById('tspeGrid');
        if (!gridDiv || typeof agGrid === 'undefined') return;
        if (TSPE.gridApi) {
            TSPE.gridApi.destroy();
            TSPE.gridApi = null;
        }
        gridDiv.innerHTML = '';

        var columnDefs = [
            { field: 'refId', headerName: 'Ref ID', width: 130, filter: 'agTextColumnFilter' },
            { field: 'emailReceivedDate', headerName: 'Email Received Date', width: 150,
                valueFormatter: function (p) { return tspeFmtDate(p.value); } },
            { field: 'ageingDays', headerName: 'Ageing Days', width: 120, type: 'numericColumn',
                cellRenderer: function (p) {
                    if (p.value == null) return '—';
                    return '<span style="font-weight:700;color:' + tspeAgeColor(p.value) + ';">' + p.value + 'd</span>';
                } },
            { field: 'caseStatus', headerName: 'Case Status', width: 130,
                cellRenderer: function (p) {
                    var c = p.value === 'Resolved' ? '#10b981' : '#f97316';
                    return '<span class="status-badge" style="background:' + c + '22;color:' + c + ';font-weight:700;">' + tspeEsc(p.value || '') + '</span>';
                } },
            { field: 'subjectLine', headerName: 'Subject Line', width: 240 },
            { field: 'accountCode', headerName: 'Account Code', width: 130 },
            { field: 'customerName', headerName: 'Customer Name', width: 180 },
            { field: 'teamName', headerName: 'Team', width: 100,
                cellRenderer: function (p) {
                    var c = p.value === 'TSM_SE' ? '#059669' : '#2563eb';
                    return '<span style="font-weight:700;color:' + c + ';">' + tspeEsc(p.value || '') + '</span>';
                } },
            { field: 'agentName', headerName: 'Agent / SM', width: 150 },
            { field: 'lineManager', headerName: 'Line Manager', width: 140 }
        ];

        if (TSPE.activeTab === 'escalation') {
            columnDefs = columnDefs.concat([
                { field: 'escalationDate', headerName: 'Escalation Date', width: 130,
                    valueFormatter: function (p) { return tspeFmtDate(p.value); } },
                { field: 'escAgeingDays', headerName: 'Esc Age', width: 100 },
                { field: 'escalationLevel', headerName: 'Level', width: 90 },
                { field: 'escalationReason', headerName: 'Reason', width: 160 },
                { field: 'escalationStatus', headerName: 'Esc Status', width: 120 },
                { field: 'escalationLoggedBy', headerName: 'Escalation Logged By', width: 160 },
                { field: 'escalationLogDate', headerName: 'Escalation Log Date', width: 150,
                    valueFormatter: function (p) { return tspeFmtDate(p.value); } }
            ]);
        } else {
            columnDefs = columnDefs.concat([
                { field: 'pendingWith', headerName: 'Pending With', width: 120 },
                { field: 'priority', headerName: 'Priority', width: 100 },
                { field: 'senderType', headerName: 'Sender Type', width: 120 },
                { field: 'issueType', headerName: 'Issue Type', width: 130 },
                { field: 'resolvedDate', headerName: 'Resolved Date', width: 130,
                    valueFormatter: function (p) { return tspeFmtDate(p.value); } },
                { field: 'remarks', headerName: 'Remarks', width: 220,
                    cellRenderer: function (p) { return tspeTextDiv(p.value); } }
            ]);
        }

        columnDefs = columnDefs.concat([
            { field: 'resolutionNotes', headerName: 'Resolution Notes', width: 220,
                cellRenderer: function (p) { return tspeTextDiv(p.value); } },
            { field: 'loggedBy', headerName: 'Logged By', width: 130 },
            { field: 'actions', headerName: 'Action', width: 160, pinned: 'right', sortable: false, filter: false,
                cellRenderer: function (p) {
                    var html = '';
                    if (tspeCanEditRow(p.data)) {
                        html += '<button type="button" class="export-btn" style="padding:5px 8px;font-size:11px;margin-right:4px;" onclick="tspeOpenForm(' + p.data.id + ')">Edit</button>';
                    }
                    if (TSPE.activeTab === 'pending' && p.data.recordType !== 'Escalation' && tspeCanLogNew()) {
                        html += '<button type="button" class="reset-btn" style="padding:5px 8px;font-size:11px;background:#ef4444;color:#fff;border:none;" onclick="tspeOpenEscalationFromPending(' + p.data.id + ')">Escalate</button>';
                    }
                    if (!html) html = '<span style="color:var(--t3);font-size:11px;">View</span>';
                    return html;
                } }
        ]);

        agGrid.createGrid(gridDiv, {
            columnDefs: columnDefs,
            rowData: TSPE.filtered.slice(),
            defaultColDef: { sortable: true, filter: true, resizable: true },
            pagination: true,
            paginationPageSize: 50,
            rowHeight: 48,
            onGridReady: function (params) { TSPE.gridApi = params.api; }
        });
    }

    function tspeUpdateActionButtons() {
        var logBtn = document.getElementById('tspeLogBtn');
        if (logBtn) logBtn.style.display = tspeCanLogNew() ? '' : 'none';
        var banner = document.getElementById('tspeAccessBanner');
        if (banner) banner.innerHTML = tspeAccessBanner();
    }

    function tspeRefreshUi() {
        tspeApplyFilters();
        tspeUpdateActionButtons();
        var tabsEl = document.getElementById('tspeTabs');
        if (tabsEl) tabsEl.innerHTML = tspeRenderTabs();
        tspeRenderKpis();
        tspeRenderFilters();
        tspeRenderAgentTiles();
        tspeRenderCharts();
        tspeRenderGrid();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function tspeReadFiltersFromDom() {
        TSPE.filters.team = (document.getElementById('tspeFTeam') || {}).value || '';
        TSPE.filters.agent = (document.getElementById('tspeFAgent') || {}).value || '';
        TSPE.filters.status = (document.getElementById('tspeFStatus') || {}).value || '';
        TSPE.filters.issueType = (document.getElementById('tspeFIssue') || {}).value || '';
        TSPE.filters.pendingWith = (document.getElementById('tspeFPending') || {}).value || '';
        TSPE.filters.senderType = (document.getElementById('tspeFSender') || {}).value || '';
        TSPE.filters.priority = (document.getElementById('tspeFPriority') || {}).value || '';
        TSPE.filters.escLevel = (document.getElementById('tspeFEscLevel') || {}).value || '';
        TSPE.filters.dateFrom = (document.getElementById('tspeFDateFrom') || {}).value || '';
        TSPE.filters.dateTo = (document.getElementById('tspeFDateTo') || {}).value || '';
        TSPE.filters.search = (document.getElementById('tspeFSearch') || {}).value || '';
    }

    function tspeFormSelect(name, label, options, value, required) {
        var html = '<div class="filter-group"><label class="filter-label">' + label + (required ? ' *' : '') + '</label>';
        html += '<select class="filter-select" id="' + name + '" style="font-size:13px;padding:10px;"' + (required ? ' required' : '') + '>';
        html += '<option value="">Select...</option>';
        options.forEach(function (opt) {
            html += '<option value="' + tspeEsc(opt) + '"' + (value === opt ? ' selected' : '') + '>' + tspeEsc(opt) + '</option>';
        });
        html += '</select></div>';
        return html;
    }

    function tspeOpenForm(itemId, escalateFromPendingId) {
        if (!itemId && !escalateFromPendingId && !tspeCanLogNew()) {
            alert('You do not have permission to log new records in this tab.');
            return;
        }
        var row = null;
        var sourcePending = null;
        if (escalateFromPendingId) {
            sourcePending = TSPE.allItems.find(function (r) { return r.id === escalateFromPendingId; });
            if (!sourcePending) return;
            TSPE.formRecordType = 'Escalation';
        }
        if (itemId) {
            row = TSPE.allItems.find(function (r) { return r.id === itemId; });
            if (row && !tspeCanEditRow(row)) {
                alert('You have view-only access to this record.');
                return;
            }
        }
        TSPE.editingId = row ? row.id : null;
        var isEsc = escalateFromPendingId || (row && row.recordType === 'Escalation') || (!row && TSPE.activeTab === 'escalation');
        TSPE.formRecordType = isEsc ? 'Escalation' : 'Pending';
        document.getElementById('tspeModalTitle').textContent = row ? 'Edit ' + (isEsc ? 'Escalation' : 'Case') : ('Log ' + (isEsc ? 'Escalation' : 'Case'));
        var body = document.getElementById('tspeFormBody');
        var agentDefault = row ? row.agentName : (sourcePending ? sourcePending.agentName : '');
        var accountDefault = row ? row.accountCode : (sourcePending ? sourcePending.accountCode : '');
        var inferredTeam = row ? row.teamName : (sourcePending ? sourcePending.teamName : (TSPE.filters.team || tspeInferTeam(accountDefault, agentDefault)));
        var teamLocked = !!(sourcePending || escalateFromPendingId);
        var teamHint = teamLocked ? 'Locked from linked pending case' : (tspeCanPickTeam() ? '' : 'Your assigned TSM team');
        var loggedByVal = row ? (row.escalationLoggedBy || row.loggedBy || tspeUserName()) : tspeUserName();
        var logDateVal = row ? (row.escalationLogDate || row.escalationDate || new Date()) : new Date();
        var escalationFields = '';
        if (isEsc) {
            escalationFields =
                '<div class="filter-group"><label class="filter-label">Escalation Date</label><input type="date" class="filter-select" id="tspeFormEscDate" value="' + tspeEsc(tspeFmtDateInput(row ? (row.escalationDate || row.emailReceivedDate) : new Date())) + '" style="font-size:13px;padding:10px;"></div>' +
                tspeFormSelect('tspeFormEscLevel', 'Escalation Level', TSPE_ESC_LEVELS, row ? row.escalationLevel : 'L1', true) +
                tspeFormSelect('tspeFormEscReason', 'Escalation Reason', TSPE_ESC_REASONS, row ? row.escalationReason : '', true) +
                tspeFormSelect('tspeFormEscStatus', 'Escalation Status', TSPE_ESC_STATUSES, row ? row.escalationStatus : 'Open', true) +
                '<div class="filter-group"><label class="filter-label">Escalation Logged By</label><input type="text" class="filter-select" id="tspeFormEscLoggedBy" value="' + tspeEsc(loggedByVal) + '" readonly style="font-size:13px;padding:10px;background:var(--bg-hover);"></div>' +
                '<div class="filter-group"><label class="filter-label">Escalation Log Date</label><input type="date" class="filter-select" id="tspeFormEscLogDate" value="' + tspeEsc(tspeFmtDateInput(logDateVal)) + '" readonly disabled style="font-size:13px;padding:10px;background:var(--bg-hover);"></div>';
        }
        var lmVal = row ? row.lineManager : (sourcePending ? (sourcePending.lineManager || tspeLookupLm(sourcePending.accountCode, sourcePending.agentName)) : tspeLookupLm(accountDefault, agentDefault));
        var pendingOnlyFields = isEsc ? '' : (
            tspeFormSelect('tspeFormPending', 'Pending With', TSPE_PENDING_WITH, row ? row.pendingWith : '', true) +
            tspeFormSelect('tspeFormIssue', 'Issue Type', TSPE_ISSUE_TYPES, row ? row.issueType : '', true) +
            tspeFormSelect('tspeFormPriority', 'Priority', TSPE_PRIORITIES, row ? row.priority : 'Medium', true) +
            '<div class="filter-group"><label class="filter-label">Resolved Date</label><input type="date" class="filter-select" id="tspeFormResolved" value="' + tspeEsc(tspeFmtDateInput(row ? row.resolvedDate : '')) + '" style="font-size:13px;padding:10px;"></div>' +
            '<div class="filter-group" style="grid-column:1/-1;"><label class="filter-label">Remarks</label><textarea class="filter-select" id="tspeFormRemarks" rows="2" style="resize:vertical;font-size:13px;padding:10px;">' + tspeEsc(tspeStripHtml(row ? row.remarks : '')) + '</textarea></div>'
        );
        body.innerHTML =
            '<div id="tspeFormTeamBanner" style="display:none;grid-column:1/-1;padding:12px 14px;border-radius:12px;border:1px solid rgba(59,130,246,.35);font-size:13px;margin-bottom:4px;"></div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;">' +
                tspeFormTeamField(inferredTeam, teamLocked || !tspeCanPickTeam(), teamHint) +
                '<div class="filter-group"><label class="filter-label">Email Received Date *</label><input type="date" class="filter-select" id="tspeFormReceived" value="' + tspeEsc(tspeFmtDateInput(row ? row.emailReceivedDate : new Date())) + '" required style="font-size:13px;padding:10px;"></div>' +
                tspeFormSelect('tspeFormSender', 'Sender Type', TSPE_SENDER_TYPES, row ? row.senderType : '', true) +
                pendingOnlyFields +
                '<div class="filter-group" style="grid-column:1/-1;"><label class="filter-label">Subject Line *</label><input type="text" class="filter-select" id="tspeFormSubject" value="' + tspeEsc(row ? row.subjectLine : '') + '" required style="font-size:13px;padding:10px;"></div>' +
                '<div class="filter-group"><label class="filter-label">Account Code *</label><input type="text" class="filter-select" id="tspeFormAccount" value="' + tspeEsc(accountDefault) + '" onblur="tspeFormAccountBlur()" required style="font-size:13px;padding:10px;"></div>' +
                '<div class="filter-group"><label class="filter-label">Customer Name</label><input type="text" class="filter-select" id="tspeFormCustomer" value="' + tspeEsc(row ? row.customerName : '') + '" style="font-size:13px;padding:10px;"></div>' +
                tspeFormSelect('tspeFormStatus', 'Case Status', TSPE_STATUSES, row ? row.caseStatus : 'In Progress', true) +
                '<div class="filter-group"><label class="filter-label">Agent Name *</label>' +
                    '<input type="text" class="filter-select" id="tspeFormAgentSearch" placeholder="Search agent from account mapping..." oninput="tspeFilterAgentOptions(this.value)" style="font-size:12px;padding:8px;margin-bottom:6px;">' +
                    '<select class="filter-select" id="tspeFormAgent" onchange="tspeFormAgentChanged()" required style="font-size:13px;padding:10px;"></select>' +
                    '<div id="tspeFormAgentCount" style="font-size:11px;color:var(--t3);margin-top:4px;"></div>' +
                '</div>' +
                tspeFormSelect('tspeFormLM', 'Line Manager', tspeTsmLineManagers(), lmVal, false) +
                escalationFields +
                (isEsc ? '<div class="filter-group" style="grid-column:1/-1;"><label class="filter-label">Resolution Notes</label><textarea class="filter-select" id="tspeFormResolutionNotes" rows="2" style="resize:vertical;font-size:13px;padding:10px;">' + tspeEsc(tspeStripHtml(row ? row.resolutionNotes : '')) + '</textarea></div>' : '') +
            '</div>';
        document.getElementById('tspeModal').style.display = 'flex';
        window._tspeAgentAll = tspeTsmAgents();
        tspeFilterAgentOptions('');
        var agentSel = document.getElementById('tspeFormAgent');
        if (agentSel && agentDefault) {
            if (!window._tspeAgentAll.some(function (n) { return n === agentDefault; })) {
                agentSel.innerHTML += '<option value="' + tspeEsc(agentDefault) + '">' + tspeEsc(agentDefault) + '</option>';
            }
            agentSel.value = agentDefault;
            tspeFormAgentChanged();
        }
        var statusEl = document.getElementById('tspeFormStatus');
        if (statusEl) statusEl.onchange = tspeFormStatusChanged;
        tspeFormStatusChanged();
        tspeFormTeamChanged();
        if (!teamLocked) tspeUpdateFormTeamDisplay();
        if (sourcePending) tspeApplyPendingToForm(sourcePending);
    }

    function tspeFilterAgentOptions(query) {
        var select = document.getElementById('tspeFormAgent');
        var countEl = document.getElementById('tspeFormAgentCount');
        if (!select || !window._tspeAgentAll) return;
        var q = String(query || '').toLowerCase().trim();
        var filtered = q
            ? window._tspeAgentAll.filter(function (n) { return n.toLowerCase().indexOf(q) !== -1; })
            : window._tspeAgentAll.slice();
        var current = select.value;
        select.innerHTML = '<option value="">— select agent —</option>' +
            filtered.map(function (n) {
                return '<option value="' + tspeEsc(n) + '"' + (n === current ? ' selected' : '') + '>' + tspeEsc(n) + '</option>';
            }).join('');
        if (countEl) countEl.textContent = filtered.length + ' agents' + (q ? ' (filtered)' : '');
    }

    function tspeFormAgentChanged() {
        var agent = (document.getElementById('tspeFormAgent') || {}).value;
        var code = (document.getElementById('tspeFormAccount') || {}).value;
        var lm = tspeLookupLm(code, agent);
        var lmEl = document.getElementById('tspeFormLM');
        if (lmEl && lm) {
            var exists = false;
            for (var i = 0; i < lmEl.options.length; i++) {
                if (lmEl.options[i].value === lm) { exists = true; break; }
            }
            if (!exists) {
                var opt = document.createElement('option');
                opt.value = lm;
                opt.textContent = lm;
                lmEl.appendChild(opt);
            }
            lmEl.value = lm;
        }
        tspeUpdateFormTeamDisplay();
    }

    function tspeEscalatedToChanged() {
        var sel = document.getElementById('tspeFormEscalatedTo');
        var wrap = document.getElementById('tspeEscOtherWrap');
        if (!sel || !wrap) return;
        wrap.style.display = sel.value === '__other__' ? 'block' : 'none';
    }

    function tspeOpenEscalationFromPending(pendingId) {
        if (!tspeCanLogNew() && tspeUserRole() === 'Service Manager') {
            alert('Service Managers can view escalations but cannot log new ones.');
            return;
        }
        tspeOpenForm(null, pendingId);
    }

    function tspeFormStatusChanged() {
        var status = (document.getElementById('tspeFormStatus') || {}).value;
        var resolvedEl = document.getElementById('tspeFormResolved');
        if (!resolvedEl) return;
        if (status === 'Resolved') {
            if (!resolvedEl.value) resolvedEl.value = new Date().toISOString().slice(0, 10);
            resolvedEl.required = true;
        } else {
            resolvedEl.required = false;
            resolvedEl.value = '';
        }
    }

    function tspeCloseForm() {
        document.getElementById('tspeModal').style.display = 'none';
        TSPE.editingId = null;
    }

    function tspeFormAccountBlur() {
        var code = (document.getElementById('tspeFormAccount') || {}).value;
        var cust = tspeLookupCustomer(code);
        if (cust) document.getElementById('tspeFormCustomer').value = cust;
        var lm = tspeLookupLm(code, (document.getElementById('tspeFormAgent') || {}).value);
        var lmEl = document.getElementById('tspeFormLM');
        if (lmEl && lm) lmEl.value = lm;
        tspeUpdateFormTeamDisplay();
    }

    function tspeFormAgentBlur() {
        tspeFormAccountBlur();
    }

    function tspeBuildPayload() {
        var received = (document.getElementById('tspeFormReceived') || {}).value;
        var status = (document.getElementById('tspeFormStatus') || {}).value;
        var resolvedEl = document.getElementById('tspeFormResolved');
        var resolved = resolvedEl ? resolvedEl.value : '';
        if (!received) throw new Error('Email Received Date is required');
        if (!(document.getElementById('tspeFormSubject') || {}).value.trim()) throw new Error('Subject Line is required');
        if (!(document.getElementById('tspeFormAgent') || {}).value.trim()) throw new Error('Agent Name is required');

        var teamName = tspeGetFormTeamValue();
        if (!teamName || TSPE_TSM_TEAMS.indexOf(teamName) === -1) {
            throw new Error('Please select TSM Team — TSM ME (Dedicated) or TSM SE (Undedicated).');
        }

        var recordType = TSPE.editingId
            ? ((TSPE.allItems.find(function (r) { return r.id === TSPE.editingId; }) || {}).recordType || TSPE.formRecordType || 'Pending')
            : (TSPE.formRecordType || (TSPE.activeTab === 'escalation' ? 'Escalation' : 'Pending'));
        if (recordType !== 'Escalation' && status === 'Resolved' && !resolved) {
            throw new Error('Resolved Date is required when status is Resolved');
        }
        var teamShort = teamName === 'TSM_SE' ? 'SE' : 'ME';
        var refPrefix = (recordType === 'Escalation' ? 'TSM-E-' : 'TSM-P-') + teamShort + '-';
        var refId = refPrefix + received.replace(/-/g, '') + '-' + String(Date.now()).slice(-4);

        var agentName = (document.getElementById('tspeFormAgent') || {}).value.trim();
        var accountCode = (document.getElementById('tspeFormAccount') || {}).value.trim();
        var lmEl = document.getElementById('tspeFormLM');

        var payload = {
            Title: TSPE.editingId ? undefined : refId,
            Email_Received_Date: received + 'T00:00:00Z',
            Sender_Type: (document.getElementById('tspeFormSender') || {}).value,
            Subject_Line: (document.getElementById('tspeFormSubject') || {}).value.trim(),
            Account_Code: accountCode,
            Customer_Name: (document.getElementById('tspeFormCustomer') || {}).value.trim(),
            Case_Status: status,
            Record_Type: recordType,
            Agent_Name: agentName,
            Team_Name: teamName,
            Logged_By: tspeUserName(),
            Line_Manager: lmEl ? lmEl.value.trim() : tspeLookupLm(accountCode, agentName)
        };

        if (recordType !== 'Escalation') {
            payload.Pending_With = (document.getElementById('tspeFormPending') || {}).value;
            payload.Issue_Type = (document.getElementById('tspeFormIssue') || {}).value;
            payload.Priority = (document.getElementById('tspeFormPriority') || {}).value;
            payload.Resolved_Date = status === 'Resolved' ? (resolved + 'T00:00:00Z') : null;
            payload.Remarks = ((document.getElementById('tspeFormRemarks') || {}).value || '').trim();
        }

        if (recordType === 'Escalation') {
            var escDate = (document.getElementById('tspeFormEscDate') || {}).value;
            payload.Escalation_Date = escDate ? escDate + 'T00:00:00Z' : received + 'T00:00:00Z';
            payload.Escalation_Level = (document.getElementById('tspeFormEscLevel') || {}).value;
            payload.Escalation_Reason = (document.getElementById('tspeFormEscReason') || {}).value;
            payload.Escalation_Status = (document.getElementById('tspeFormEscStatus') || {}).value || 'Open';
            payload.Escalation_Logged_By = tspeUserName();
            payload.Escalation_Log_Date = ((document.getElementById('tspeFormEscLogDate') || {}).value || tspeFmtDateInput(new Date())) + 'T00:00:00Z';
            var resNotesEl = document.getElementById('tspeFormResolutionNotes');
            if (resNotesEl) payload.Resolution_Notes = tspeStripHtml(resNotesEl.value);
        }

        return payload;
    }

    function tspeStripExtendedFields(payload) {
        var copy = Object.assign({}, payload);
        ['Record_Type', 'Linked_Ref_ID', 'Escalated_To', 'Escalation_Level',
            'Escalation_Date', 'Escalation_Reason', 'Line_Manager', 'Escalation_Status', 'Resolution_Notes',
            'Escalation_Logged_By', 'Escalation_Log_Date'
        ].forEach(function (k) { delete copy[k]; });
        return copy;
    }

    async function tspeSaveToSharePoint(payload, isUpdate) {
        var digest = await tspeGetDigest();
        var attempts = [payload, tspeStripExtendedFields(payload)];

        for (var i = 0; i < attempts.length; i++) {
            var bodyPayload = Object.assign({ __metadata: { type: TSPE_ENTITY } }, attempts[i]);
            if (isUpdate) {
                delete bodyPayload.Title;
                delete bodyPayload.Logged_By;
                var updateUrl = tspeSpUrl() + "/_api/web/lists/getbytitle('" + TSPE_LIST + "')/items(" + TSPE.editingId + ")";
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
                    body: JSON.stringify(bodyPayload)
                });
                if (updateRes.ok) return;
                if (i === attempts.length - 1) throw new Error(await updateRes.text());
            } else {
                bodyPayload.Title = bodyPayload.Title || ('TSM-' + Date.now());
                var createUrl = tspeSpUrl() + "/_api/web/lists/getbytitle('" + TSPE_LIST + "')/items";
                var createRes = await fetch(createUrl, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json;odata=verbose',
                        'Content-Type': 'application/json;odata=verbose',
                        'X-RequestDigest': digest
                    },
                    credentials: 'include',
                    body: JSON.stringify(bodyPayload)
                });
                if (createRes.ok) return;
                if (i === attempts.length - 1) throw new Error(await createRes.text());
            }
        }
    }

    async function tspeSaveForm() {
        try {
            var payload = tspeBuildPayload();
            await tspeSaveToSharePoint(payload, !!TSPE.editingId);
            tspeCloseForm();
            await tspeInit(true);
            alert((TSPE.activeTab === 'escalation' ? 'Escalation' : 'Case') + ' saved successfully.');
        } catch (err) {
            console.error('[TSPE]', err);
            alert('Save failed: ' + err.message);
        }
    }

    function tspeExportRows() {
        return TSPE.filtered.slice();
    }

    function tspeExportExcel() {
        var rows = tspeExportRows();
        var headers = ['Ref ID', 'Email Received Date', 'Ageing Days', 'Case Status', 'Subject Line', 'Account Code', 'Customer Name', 'Team', 'Agent Name', 'Line Manager', 'Sender Type', 'Pending With', 'Issue Type', 'Priority', 'Resolved Date', 'Remarks', 'Logged By'];
        if (TSPE.activeTab === 'escalation') {
            headers = headers.concat(['Linked Pending Ref', 'Escalation Date', 'Esc Age', 'Escalation Level', 'Escalated To', 'Escalation Reason', 'Escalation Status', 'Resolution Notes']);
        }
        var today = new Date();
        var html = '<html><head><meta charset="utf-8"></head><body><table border="1" cellspacing="0" cellpadding="4">';
        html += '<tr><td colspan="' + headers.length + '" style="background:#a855f7;color:white;font-weight:bold;text-align:center;padding:12px;">TSM Pending / Escalations Export · ' + tspeTabLabel() + '</td></tr>';
        html += '<tr>' + headers.map(function (h) { return '<th style="background:#a855f7;color:white;padding:8px;">' + h + '</th>'; }).join('') + '</tr>';
        rows.forEach(function (r, i) {
            var bg = i % 2 ? '#ffffff' : '#f3e8ff';
            var vals = [
                r.refId, tspeFmtDate(r.emailReceivedDate), r.ageingDays != null ? r.ageingDays : '',
                r.caseStatus, r.subjectLine, r.accountCode, r.customerName, r.teamName, r.agentName, r.lineManager,
                r.senderType, r.pendingWith, r.issueType, r.priority,
                tspeFmtDate(r.resolvedDate), r.remarks, r.loggedBy
            ];
            if (TSPE.activeTab === 'escalation') {
                vals = vals.concat([
                    r.linkedRefId, tspeFmtDate(r.escalationDate), r.escAgeingDays != null ? r.escAgeingDays : '',
                    r.escalationLevel, r.escalatedTo, r.escalationReason, r.escalationStatus, r.resolutionNotes
                ]);
            }
            html += '<tr>' + vals.map(function (v) { return '<td style="background:' + bg + ';padding:8px;">' + tspeEsc(v) + '</td>'; }).join('') + '</tr>';
        });
        html += '</table></body></html>';
        var link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }));
        link.download = 'TSM_Pending_Escalations_' + today.toISOString().slice(0, 10) + '.xls';
        link.click();
    }

    function tspeExportPdf() {
        var rows = tspeExportRows();
        var win = window.open('', '_blank');
        if (!win) { alert('Please allow pop-ups to export PDF.'); return; }
        var html = '<html><head><title>TSM Pending / Escalations</title><style>body{font-family:Arial,sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;font-size:11px;}th,td{border:1px solid #ccc;padding:6px;text-align:left;}th{background:#a855f7;color:white;}</style></head><body>';
        html += '<h2>TSM Pending / Escalations</h2><p>' + tspeTabLabel() + ' · Generated: ' + new Date().toLocaleString('en-GB') + ' | Records: ' + rows.length + '</p>';
        html += '<table><tr><th>Ref</th><th>Received</th><th>Team</th><th>Status</th><th>Subject</th><th>Account</th><th>Agent</th><th>LM</th></tr>';
        rows.forEach(function (r) {
            html += '<tr><td>' + tspeEsc(r.refId) + '</td><td>' + tspeFmtDate(r.emailReceivedDate) + '</td><td>' + tspeEsc(r.teamName) + '</td><td>' + tspeEsc(r.caseStatus) + '</td><td>' + tspeEsc(r.subjectLine) + '</td><td>' + tspeEsc(r.accountCode) + '</td><td>' + tspeEsc(r.agentName) + '</td><td>' + tspeEsc(r.lineManager) + '</td></tr>';
        });
        html += '</table></body></html>';
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(function () { win.print(); }, 400);
    }

    async function tspeInit(forceReload) {
        var loading = document.getElementById(tspeActiveLoadingId());
        var content = document.getElementById(tspeActiveContentId());
        if (loading) loading.style.display = 'block';
        if (content) content.style.display = 'none';
        try {
            tspeRenderShell();
            if (!TSPE.loaded || forceReload) {
                TSPE.allItems = await tspeFetchItems();
                TSPE.loaded = true;
            }
            if (loading) loading.style.display = 'none';
            if (content) content.style.display = 'block';
            tspeRefreshUi();
        } catch (err) {
            console.error('[TSPE]', err);
            if (loading) {
                loading.innerHTML = '<div style="color:#ef4444;padding:20px;font-weight:600;">' + tspeEsc(err.message) + '</div>';
            }
        }
    }

    window.tspeInit = tspeInit;
    window.tspeOpenForm = tspeOpenForm;
    window.tspeOpenEscalationFromPending = tspeOpenEscalationFromPending;
    window.tspeFormTeamChanged = tspeFormTeamChanged;
    window.tspeFormLinkedRefBlur = tspeFormLinkedRefBlur;
    window.tspeEscalatedToChanged = tspeEscalatedToChanged;
    window.tspeFilterAgentOptions = tspeFilterAgentOptions;
    window.tspeFormAgentChanged = tspeFormAgentChanged;
    window.tspeCloseForm = tspeCloseForm;
    window.tspeSaveForm = tspeSaveForm;
    window.tspeFilterChanged = function () {
        tspeReadFiltersFromDom();
        tspeRefreshUi();
    };
    window.tspeResetFilters = function () {
        TSPE.filters = { team: '', agent: '', status: '', issueType: '', pendingWith: '', senderType: '', priority: '', escLevel: '', search: '', dateFrom: '', dateTo: '' };
        TSPE.activeKpi = null;
        TSPE.activeAgent = null;
        tspeRefreshUi();
    };
    window.tspeKpiClick = function (key) {
        TSPE.activeKpi = TSPE.activeKpi === key ? null : key;
        tspeRefreshUi();
    };
    window.tspeAgentClick = function (name) {
        TSPE.activeAgent = TSPE.activeAgent === name ? null : name;
        TSPE.filters.agent = TSPE.activeAgent || '';
        tspeRefreshUi();
    };
    window.tspeFormAccountBlur = tspeFormAccountBlur;
    window.tspeFormAgentBlur = tspeFormAgentBlur;
    window.tspeFormStatusChanged = tspeFormStatusChanged;
    window.tspeExportExcel = tspeExportExcel;
    window.tspeExportPdf = tspeExportPdf;
    window.tspeSetChartGranularity = function (gran) {
        TSPE.chartGranularity = gran === 'daily' || gran === 'monthly' ? gran : 'weekly';
        tspeReadFiltersFromDom();
        tspeRenderShell();
        tspeRefreshUi();
    };
    window.tspeSwitchTab = function (tab) {
        TSPE.activeTab = tab === 'escalation' ? 'escalation' : 'pending';
        TSPE.activeKpi = null;
        TSPE.activeAgent = null;
        tspeInit(false);
    };

    window.initTSMPendingEscalation = function (forceReload) {
        TSPE.activeTab = 'pending';
        TSPE.formRecordType = 'Pending';
        return tspeInit(!!forceReload);
    };
    window.initTSMEscalation = function (forceReload) {
        TSPE.activeTab = 'escalation';
        TSPE.formRecordType = 'Escalation';
        return tspeInit(!!forceReload);
    };
    window.initMEPending = window.initTSMPendingEscalation;
})();
