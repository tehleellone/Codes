// ============================================================
// accounthistory.js — Account History Module
// Depends on: SP_URL, USER_CONTEXT, ALL_DATA (from main)
// ============================================================

var AH_LIST = 'Account_History';

async function ahLoad() {
    var container = document.getElementById('ahContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:60px;font-size:18px;">' +
        '<i data-lucide="loader" style="width:24px;height:24px;display:inline-block;vertical-align:middle;margin-right:8px;animation:spin 1s linear infinite;"></i>Loading...</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + AH_LIST + "')/items?" +
            "$select=Title,Customer_Name,Event_Type,Event_Description,Done_By,Event_Date,Old_SM,New_SM,Old_Team,New_Team,Reason&" +
            "$orderby=Event_Date desc&$top=2000";

        var res = await fetch(url, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to load history: ' + res.statusText);
        var data = await res.json();
        var items = data.d.results;

        ahRender(items, container);
    } catch (e) {
        container.innerHTML = '<div style="color:#ef4444;padding:20px;">Error: ' + e.message + '</div>';
    }
}

function ahRender(items, container) {
    var html = '<div style="max-width:1200px;margin:0 auto;">';

    // Header + search
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:12px;">';
    html += '<h2 style="font-size:1rem;font-weight:800;color:var(--t1);margin:0!important;display:flex;align-items:center;gap:.4rem;">' +
        '<i data-lucide="history" style="width:22px;height:22px;"></i> Account History</h2>';
    html += '<div style="display:flex;gap:10px;align-items:center;">' +
        '<input type="text" id="ahSearchInput" class="search-box" placeholder="Search by account code or customer..." oninput="ahSearch(this.value)" style="width:280px;">' +
        '</div>';
    html += '</div>';

    if (items.length === 0) {
        html += '<div style="text-align:center;padding:80px;color:var(--t3);">' +
            '<i data-lucide="inbox" style="width:48px;height:48px;display:block;margin:0 auto 16px;"></i>' +
            '<div style="font-size:16px;font-weight:600;">No history available</div>' +
            '<div style="font-size:13px;margin-top:8px;">Account events will appear here once recorded.</div>' +
            '</div>';
    } else {
        // Group by account code
        var grouped = {};
        items.forEach(function(item) {
            var code = item.Title || 'Unknown';
            if (!grouped[code]) grouped[code] = { customer: item.Customer_Name || '', events: [] };
            grouped[code].events.push(item);
        });

        html += '<div id="ahGroupedList">';
        Object.keys(grouped).forEach(function(code) {
            var group = grouped[code];
            html += ahGroupHtml(code, group.customer, group.events);
        });
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    window._AH_ALL_ITEMS = items;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function ahGroupHtml(code, customer, events) {
    var groupId = 'ahGroup_' + code.replace(/\./g, '_');
    var html = '<div class="ah-account-group" data-code="' + code + '" data-customer="' + (customer||'').toLowerCase() + '" ' +
        'style="border:1px solid var(--border);border-radius:14px;margin-bottom:16px;overflow:hidden;">';

    // Group header
    html += '<div onclick="ahToggleGroup(\'' + groupId + '\')" ' +
        'style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--bg-secondary);cursor:pointer;">';
    html += '<div style="display:flex;align-items:center;gap:12px;">';
    html += '<div style="width:36px;height:36px;border-radius:10px;background:var(--grad);display:flex;align-items:center;justify-content:center;">' +
        '<i data-lucide="building-2" style="width:18px;height:18px;color:#fff;"></i></div>';
    html += '<div>';
    html += '<div style="font-size:14px;font-weight:800;color:var(--t1);">' + code + '</div>';
    html += '<div style="font-size:12px;color:var(--t3);">' + (customer || '') + '</div>';
    html += '</div></div>';
    html += '<div style="display:flex;align-items:center;gap:10px;">';
    html += '<span style="font-size:11px;background:var(--nab);border:1px solid var(--nab2);color:var(--t2);padding:3px 10px;border-radius:20px;font-weight:700;">' + events.length + ' event' + (events.length !== 1 ? 's' : '') + '</span>';
    html += '<i data-lucide="chevron-down" id="' + groupId + '_icon" style="width:16px;height:16px;color:var(--t3);transition:transform .2s;"></i>';
    html += '</div></div>';

    // Timeline
    html += '<div id="' + groupId + '" style="display:none;padding:20px 24px;">';
    html += '<div style="position:relative;padding-left:28px;">';
    html += '<div style="position:absolute;left:8px;top:0;bottom:0;width:2px;background:var(--border);"></div>';

    events.forEach(function(ev) {
        var evDate = ev.Event_Date ? new Date(ev.Event_Date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'N/A';
        var color = ahEventColor(ev.Event_Type);
        var icon = ahEventIcon(ev.Event_Type);

        html += '<div style="position:relative;margin-bottom:20px;">';
        html += '<div style="position:absolute;left:-24px;top:4px;width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid var(--bg-card);"></div>';
        html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 16px;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:10px;flex-wrap:wrap;">';
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<i data-lucide="' + icon + '" style="width:14px;height:14px;color:' + color + ';flex-shrink:0;"></i>';
        html += '<span style="font-size:13px;font-weight:700;color:' + color + ';">' + (ev.Event_Type || '') + '</span>';
        html += '</div>';
        html += '<span style="font-size:11px;color:var(--t3);">' + evDate + '</span>';
        html += '</div>';

        if (ev.Event_Description) {
            html += '<div style="font-size:12px;color:var(--t2);margin-bottom:6px;">' + ev.Event_Description + '</div>';
        }

        // Details row
        var details = [];
        if (ev.Done_By) details.push(['By', ev.Done_By]);
        if (ev.Old_SM && ev.New_SM) details.push(['SM Change', ev.Old_SM + ' → ' + ev.New_SM]);
        else if (ev.New_SM) details.push(['SM', ev.New_SM]);
        if (ev.Old_Team && ev.New_Team) details.push(['Team Change', ev.Old_Team + ' → ' + ev.New_Team]);
        if (ev.Reason) details.push(['Reason', ev.Reason]);

        if (details.length) {
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">';
            details.forEach(function(d) {
                html += '<div style="font-size:11px;background:rgba(168,85,247,0.08);border-radius:6px;padding:3px 8px;">' +
                    '<span style="color:var(--t3);font-weight:700;">' + d[0] + ':</span> ' +
                    '<span style="color:var(--t1);font-weight:600;">' + d[1] + '</span></div>';
            });
            html += '</div>';
        }
        html += '</div></div>';
    });

    html += '</div></div></div>';
    return html;
}

function ahEventColor(eventType) {
    var map = {
        'Request Raised': '#3b82f6',
        'Approved': '#10b981',
        'Rejected': '#ef4444',
        'Transfer Raised': '#f97316',
        'Transfer Approved by AM': '#8b5cf6',
        'Transfer Rejected by AM': '#ef4444',
        'Transfer Finalized': '#10b981'
    };
    return map[eventType] || '#a855f7';
}

function ahEventIcon(eventType) {
    var map = {
        'Request Raised': 'file-plus',
        'Approved': 'check-circle',
        'Rejected': 'x-circle',
        'Transfer Raised': 'repeat',
        'Transfer Approved by AM': 'thumbs-up',
        'Transfer Rejected by AM': 'thumbs-down',
        'Transfer Finalized': 'check-circle-2'
    };
    return map[eventType] || 'activity';
}

function ahToggleGroup(groupId) {
    var el = document.getElementById(groupId);
    var icon = document.getElementById(groupId + '_icon');
    if (!el) return;
    var isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function ahSearch(val) {
    val = val.toLowerCase().trim();
    var groups = document.querySelectorAll('.ah-account-group');
    groups.forEach(function(g) {
        var code = (g.getAttribute('data-code') || '').toLowerCase();
        var customer = (g.getAttribute('data-customer') || '').toLowerCase();
        g.style.display = (!val || code.includes(val) || customer.includes(val)) ? '' : 'none';
    });
}

window.ahLoad = ahLoad;
window.ahToggleGroup = ahToggleGroup;
window.ahSearch = ahSearch;
