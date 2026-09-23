// ============================================================
// suggestions.js — Suggestion Box Module
// ============================================================

var SG_LIST = 'Suggestions';
var sgAllItems = [];
var sgCurrentFilter = 'all';

// ── Show / Hide ───────────────────────────────────────────────
window.showSuggestions = function() {
    if (typeof analyticsTrackPage === 'function') analyticsTrackPage('Suggestion Box');
    if (typeof switchDashboardSection === 'function') switchDashboardSection('suggestionsView');
};

// ── Load ──────────────────────────────────────────────────────
window.sgLoadSuggestions = async function() {
    var loadingEl = document.getElementById('sgLoading');
    var contentEl = document.getElementById('sgContent');
    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + SG_LIST + "')/items?" +
            "$select=ID,Title,SuggestionText,Category,IsAnonymous,Status,AdminResponse,Likes,Created,Author/Title&" +
            "$expand=Author&" +
            "$orderby=Created desc&$top=200";

        var res = await fetch(url, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to load suggestions');
        var data = await res.json();
        sgAllItems = data.d.results;

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        sgRenderShell();
        sgRender();

    } catch(e) {
        console.error('[Suggestions]', e);
        if (loadingEl) loadingEl.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">Error: ' + e.message + '</div>';
    }
};

function sgRenderShell() {
    var container = document.getElementById('sgContainer');
    if (!container) return;
 
    container.innerHTML =
        // Header
        '<div style="background:var(--grad);border-radius:16px;padding:1.75rem 2rem;margin-bottom:1.75rem;color:#fff;display:flex;align-items:center;gap:1.25rem;">' +
        '<div style="width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<i data-lucide="lightbulb" style="width:26px;height:26px;color:#fff;"></i></div>' +
        '<div>' +
        '<div style="font-size:1.25rem;font-weight:800;margin-bottom:.2rem;">Suggestion Box</div>' +
        '<div style="font-size:.82rem;opacity:.85;">Share your ideas and help us improve — every suggestion matters</div>' +
        '</div></div>' +
 
        // Main layout
        '<div style="display:grid;grid-template-columns:300px 1fr;gap:1.5rem;align-items:start;">' +
 
        // LEFT — Submit Form
        '<div style="position:sticky;top:20px;">' +
        '<div class="table-section" style="padding:1.5rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:1.25rem;">' +
        '<div style="width:32px;height:32px;background:var(--nab);border:1px solid var(--nab2);border-radius:8px;display:flex;align-items:center;justify-content:center;">' +
        '<i data-lucide="plus" style="width:16px;height:16px;color:var(--acc);"></i></div>' +
        '<span style="font-size:.95rem;font-weight:800;color:var(--t1);">Share Your Idea</span>' +
        '</div>' +
 
        '<div class="filter-group" style="margin-bottom:12px;">' +
        '<label class="filter-label">Category</label>' +
        '<select class="filter-select" id="sgNewCategory" style="font-size:13px;">' +
        '<option value="Process">💡 Process</option>' +
        '<option value="Tool">🔧 Tool</option>' +
        '<option value="Team">👥 Team</option>' +
        '<option value="General">📌 General</option>' +
        '</select></div>' +
 
        '<div class="filter-group" style="margin-bottom:12px;">' +
        '<label class="filter-label">Your Suggestion *</label>' +
        '<textarea class="filter-select" id="sgNewText" rows="5" placeholder="Describe your idea clearly and concisely..." style="cursor:text;resize:vertical;font-size:13px;padding:10px;line-height:1.6;"></textarea></div>' +
 
        '<label style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;padding:10px 12px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border);cursor:pointer;">' +
        '<input type="checkbox" id="sgNewAnonymous" style="width:15px;height:15px;accent-color:var(--acc);">' +
        '<div><div style="font-size:.82rem;font-weight:600;color:var(--t1);">Submit anonymously</div>' +
        '<div style="font-size:.72rem;color:var(--t3);">Your name will be hidden</div></div>' +
        '</label>' +
 
        '<div id="sgSuccessMsg" style="display:none;background:rgba(16,185,129,0.1);border:1px solid #10b981;border-radius:10px;padding:10px 14px;font-size:.82rem;color:#10b981;font-weight:600;margin-bottom:12px;text-align:center;">✅ Suggestion submitted!</div>' +
 
        '<button type="button" id="sgSubmitBtn" onclick="sgSubmitSuggestion()" class="export-btn" style="width:100%;padding:11px;font-size:.85rem;">' +
        '<i data-lucide="send" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Submit Suggestion</button>' +
        '</div></div>' +
 
        // RIGHT — Feed
        '<div>' +
        // Filter pills
        '<div style="display:flex;gap:6px;margin-bottom:1.25rem;flex-wrap:wrap;">' +
        '<button type="button" id="sgFilter_all" onclick="sgSetFilter(\'all\')" style="padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:none;background:var(--grad);color:#fff;">All</button>' +
        '<button type="button" id="sgFilter_Process" onclick="sgSetFilter(\'Process\')" style="padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);">💡 Process</button>' +
        '<button type="button" id="sgFilter_Tool" onclick="sgSetFilter(\'Tool\')" style="padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);">🔧 Tool</button>' +
        '<button type="button" id="sgFilter_Team" onclick="sgSetFilter(\'Team\')" style="padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);">👥 Team</button>' +
        '<button type="button" id="sgFilter_General" onclick="sgSetFilter(\'General\')" style="padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);">📌 General</button>' +
        '</div>' +
        '<div id="sgFeed"></div>' +
        '</div>' +
 
        '</div>';
 
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
 
// Replace sgRenderFeed() in suggestions.js with this:
function sgRenderFeed() {
    var feedEl = document.getElementById('sgFeed');
    if (!feedEl) return;
 
    var isAdmin = USER_CONTEXT && USER_CONTEXT.isAdmin;
 
    var filtered = sgAllItems;
    if (sgCurrentFilter !== 'all') {
        filtered = sgAllItems.filter(function(item) { return item.Category === sgCurrentFilter; });
    }
 
    if (filtered.length === 0) {
        feedEl.innerHTML = '<div style="text-align:center;padding:80px;color:var(--t3);">' +
            '<div style="font-size:52px;margin-bottom:16px;">💡</div>' +
            '<div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--t2);">No suggestions yet</div>' +
            '<div style="font-size:13px;">Be the first to share an idea!</div>' +
            '</div>';
        return;
    }
 
    var catEmoji = { 'Process': '💡', 'Tool': '🔧', 'Team': '👥', 'General': '📌' };
 
    var html = '';
    filtered.forEach(function(item) {
        var isAnon = item.IsAnonymous;
        var authorName = isAnon ? 'Anonymous' : (item.Author ? item.Author.Title : 'Unknown');
        var initials = isAnon ? '?' : sgGetInitials(authorName);
        var catColor = sgCategoryColor(item.Category);
        var statusColor = sgStatusColor(item.Status);
        var isLiked = sgIsLiked(item.ID);
        var emoji = catEmoji[item.Category] || '📌';
 
        // Avatar gradient based on name
        var avatarColors = ['linear-gradient(135deg,#9248b9,#c724b1)', 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
            'linear-gradient(135deg,#10b981,#059669)', 'linear-gradient(135deg,#f97316,#ea580c)',
            'linear-gradient(135deg,#8b5cf6,#6d28d9)', 'linear-gradient(135deg,#ec4899,#be185d)'];
        var colorIndex = 0;
        for (var ci = 0; ci < authorName.length; ci++) colorIndex += authorName.charCodeAt(ci);
        var avatarGrad = isAnon ? 'linear-gradient(135deg,#6b7280,#4b5563)' : avatarColors[colorIndex % avatarColors.length];
 
        html += '<div class="table-section" style="margin-bottom:1rem;padding:0;overflow:hidden;transition:box-shadow .2s;" ' +
            'onmouseover="this.style.boxShadow=\'var(--ch)\'" onmouseout="this.style.boxShadow=\'\'">' +
 
            // Top accent bar with category color
            '<div style="height:3px;background:' + catColor + ';"></div>' +
 
            '<div style="padding:1.25rem;">' +
 
            // Header
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:1rem;">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:40px;height:40px;border-radius:50%;background:' + avatarGrad + ';display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;color:#fff;flex-shrink:0;">' +
            (isAnon ? '<i data-lucide="user-x" style="width:16px;height:16px;"></i>' : initials) +
            '</div>' +
            '<div>' +
            '<div style="font-size:.88rem;font-weight:700;color:var(--t1);">' + authorName + '</div>' +
            '<div style="font-size:.72rem;color:var(--t3);">' + sgFormatDate(item.Created) + '</div>' +
            '</div></div>' +
 
            '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">' +
            '<span style="background:' + catColor + '22;color:' + catColor + ';border:1px solid ' + catColor + '44;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">' + emoji + ' ' + (item.Category || 'General') + '</span>' +
            '<span style="background:' + statusColor + '22;color:' + statusColor + ';border:1px solid ' + statusColor + '44;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">' + (item.Status || 'New') + '</span>' +
            '</div></div>' +
 
            // Suggestion text
            '<p style="font-size:.88rem;color:var(--t1);line-height:1.75;margin:0 0 1rem;white-space:pre-wrap;padding:.75rem 1rem;background:var(--bg-secondary);border-radius:10px;border-left:3px solid ' + catColor + ';">' + (item.SuggestionText || '') + '</p>' +
 
            // Admin response
            (item.AdminResponse ?
                '<div style="background:rgba(168,85,247,0.07);border-left:3px solid var(--acc);border-radius:0 10px 10px 0;padding:.85rem 1rem;margin-bottom:1rem;">' +
                '<div style="font-size:.7rem;font-weight:800;color:var(--acc);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:5px;">' +
                '<i data-lucide="message-circle" style="width:12px;height:12px;"></i>Admin Response</div>' +
                '<div style="font-size:.83rem;color:var(--t2);line-height:1.6;">' + item.AdminResponse + '</div>' +
                '</div>' : ''
            ) +
 
            // Footer
            '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-top:.75rem;border-top:1px solid var(--border);">' +
 
            '<button type="button" onclick="sgToggleLike(' + item.ID + ',' + (item.Likes || 0) + ')" ' +
            'style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;border:1px solid ' + (isLiked ? 'var(--acc)' : 'var(--border)') + ';' +
            'background:' + (isLiked ? 'var(--nab)' : 'transparent') + ';color:' + (isLiked ? 'var(--acc)' : 'var(--t3)') + ';cursor:pointer;font-size:.8rem;font-weight:700;transition:all .2s;">' +
            '<i data-lucide="thumbs-up" style="width:13px;height:13px;"></i>' +
            '<span>' + (item.Likes || 0) + ' ' + ((item.Likes || 0) === 1 ? 'like' : 'likes') + '</span>' +
            '</button>' +
 
            (isAdmin ?
                '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                '<select onchange="sgUpdateStatus(' + item.ID + ',this.value)" ' +
                'style="padding:5px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:11px;cursor:pointer;font-weight:600;">' +
                '<option value="New"' + (item.Status === 'New' ? ' selected' : '') + '>🆕 New</option>' +
                '<option value="Under Review"' + (item.Status === 'Under Review' ? ' selected' : '') + '>🔍 Under Review</option>' +
                '<option value="Implemented"' + (item.Status === 'Implemented' ? ' selected' : '') + '>✅ Implemented</option>' +
                '<option value="Closed"' + (item.Status === 'Closed' ? ' selected' : '') + '>🔒 Closed</option>' +
                '</select>' +
                '<button type="button" onclick="sgShowResponseForm(' + item.ID + ')" ' +
                'style="padding:5px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-weight:600;">' +
                '<i data-lucide="message-square" style="width:12px;height:12px;"></i>Respond</button>' +
                '</div>' : ''
            ) +
            '</div>' +
 
            // Admin response form
            '<div id="sgResponseForm_' + item.ID + '" style="display:none;margin-top:.85rem;">' +
            '<textarea id="sgResponseText_' + item.ID + '" rows="3" class="filter-select" ' +
            'placeholder="Write your response..." style="resize:vertical;font-size:13px;margin-bottom:8px;">' + (item.AdminResponse || '') + '</textarea>' +
            '<div style="display:flex;gap:8px;">' +
            '<button type="button" onclick="sgSubmitResponse(' + item.ID + ')" class="export-btn" style="padding:6px 16px;font-size:12px;">Save Response</button>' +
            '<button type="button" onclick="document.getElementById(\'sgResponseForm_' + item.ID + '\').style.display=\'none\'" class="reset-btn" style="padding:6px 12px;font-size:12px;">Cancel</button>' +
            '</div></div>' +
 
            '</div></div>';
    });
 
    feedEl.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
 // ── Render ────────────────────────────────────────────────────
function sgRender() {
    sgRenderFeed();
}

// ── Helpers ──────────────────────────────────────────────────
function sgCategoryColor(cat) {
    var map = { 'Process': '#3b82f6', 'Tool': '#8b5cf6', 'Team': '#10b981', 'General': '#f97316' };
    return map[cat] || '#8b5cf6';
}

function sgStatusColor(status) {
    var map = {
        'New': '#3b82f6',
        'Under Review': '#f97316',
        'Implemented': '#10b981',
        'Closed': '#6b7280'
    };
    return map[status] || '#3b82f6';
}

function sgFormatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var diffMs = now - d;
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return diffMins + ' min ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function sgGetInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
}

// ── Render Feed ───────────────────────────────────────────────
function sgRenderFeed() {
    var feedEl = document.getElementById('sgFeed');
    if (!feedEl) return;

    var isAdmin = USER_CONTEXT && USER_CONTEXT.isAdmin;

    // Filter
    var filtered = sgAllItems;
    if (sgCurrentFilter !== 'all') {
        filtered = sgAllItems.filter(function(item) {
            return item.Category === sgCurrentFilter;
        });
    }

    if (filtered.length === 0) {
        feedEl.innerHTML = '<div style="text-align:center;padding:60px;color:var(--t3);">' +
            '<div style="font-size:48px;margin-bottom:16px;">💡</div>' +
            '<div style="font-size:16px;font-weight:600;">No suggestions yet</div>' +
            '<div style="font-size:13px;margin-top:8px;">Be the first to share an idea!</div>' +
            '</div>';
        return;
    }

    var html = '';
    filtered.forEach(function(item) {
        var isAnon = item.IsAnonymous;
        var authorName = isAnon ? 'Anonymous' : (item.Author ? item.Author.Title : 'Unknown');
        var initials = isAnon ? '?' : sgGetInitials(authorName);
        var catColor = sgCategoryColor(item.Category);
        var statusColor = sgStatusColor(item.Status);
        var isLiked = sgIsLiked(item.ID);

        html += '<div class="table-section" style="margin-bottom:1rem;padding:1.25rem;transition:box-shadow .2s;" ' +
            'onmouseover="this.style.boxShadow=\'var(--ch)\'" onmouseout="this.style.boxShadow=\'\'">' +

            // Header row
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:.85rem;">' +

            '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
            // Avatar
            '<div style="width:36px;height:36px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;color:#fff;flex-shrink:0;">' +
            (isAnon ? '<i data-lucide="user-x" style="width:16px;height:16px;"></i>' : initials) +
            '</div>' +
            '<div>' +
            '<div style="font-size:.85rem;font-weight:700;color:var(--t1);">' + authorName + '</div>' +
            '<div style="font-size:.72rem;color:var(--t3);">' + sgFormatDate(item.Created) + '</div>' +
            '</div>' +
            '</div>' +

            // Badges
            '<div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">' +
            '<span style="background:' + catColor + ';color:#fff;font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;">' + (item.Category || 'General') + '</span>' +
            '<span style="background:' + statusColor + ';color:#fff;font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;">' + (item.Status || 'New') + '</span>' +
            '</div>' +
            '</div>' +

            // Suggestion text
            '<p style="font-size:.88rem;color:var(--t1);line-height:1.7;margin:0 0 .85rem;white-space:pre-wrap;">' + (item.SuggestionText || '') + '</p>' +

            // Admin response
            (item.AdminResponse ?
                '<div style="background:var(--nab);border-left:3px solid var(--acc);border-radius:0 8px 8px 0;padding:.75rem 1rem;margin-bottom:.85rem;">' +
                '<div style="font-size:.72rem;font-weight:700;color:var(--acc);margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.05em;">Admin Response</div>' +
                '<div style="font-size:.83rem;color:var(--t2);line-height:1.6;">' + item.AdminResponse + '</div>' +
                '</div>' : ''
            ) +

            // Footer — likes + admin actions
            '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +

            // Like button
            '<button type="button" onclick="sgToggleLike(' + item.ID + ',' + (item.Likes || 0) + ')" ' +
            'style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;border:1px solid ' + (isLiked ? 'var(--acc)' : 'var(--border)') + ';' +
            'background:' + (isLiked ? 'var(--nab)' : 'transparent') + ';color:' + (isLiked ? 'var(--acc)' : 'var(--t3)') + ';cursor:pointer;font-size:.8rem;font-weight:600;transition:all .2s;">' +
            '<i data-lucide="thumbs-up" style="width:14px;height:14px;"></i>' +
            '<span>' + (item.Likes || 0) + '</span>' +
            '</button>' +

            // Admin controls
            (isAdmin ?
                '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                '<select onchange="sgUpdateStatus(' + item.ID + ',this.value)" ' +
                'style="padding:4px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:11px;cursor:pointer;">' +
                '<option value="New"' + (item.Status === 'New' ? ' selected' : '') + '>New</option>' +
                '<option value="Under Review"' + (item.Status === 'Under Review' ? ' selected' : '') + '>Under Review</option>' +
                '<option value="Implemented"' + (item.Status === 'Implemented' ? ' selected' : '') + '>Implemented</option>' +
                '<option value="Closed"' + (item.Status === 'Closed' ? ' selected' : '') + '>Closed</option>' +
                '</select>' +
                '<button type="button" onclick="sgShowResponseForm(' + item.ID + ')" ' +
                'style="padding:4px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">' +
                '<i data-lucide="message-square" style="width:12px;height:12px;"></i>Respond</button>' +
                '</div>' : ''
            ) +

            '</div>' +

            // Admin response form (hidden by default)
            '<div id="sgResponseForm_' + item.ID + '" style="display:none;margin-top:.85rem;">' +
            '<textarea id="sgResponseText_' + item.ID + '" rows="3" class="filter-select" ' +
            'placeholder="Write your response..." style="resize:vertical;font-size:13px;margin-bottom:8px;">' + (item.AdminResponse || '') + '</textarea>' +
            '<div style="display:flex;gap:8px;">' +
            '<button type="button" onclick="sgSubmitResponse(' + item.ID + ')" class="export-btn" style="padding:6px 16px;font-size:12px;">Save Response</button>' +
            '<button type="button" onclick="document.getElementById(\'sgResponseForm_' + item.ID + '\').style.display=\'none\'" class="reset-btn" style="padding:6px 12px;font-size:12px;">Cancel</button>' +
            '</div></div>' +

            '</div>';
    });

    feedEl.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Like Logic ────────────────────────────────────────────────
function sgIsLiked(itemId) {
    try {
        var liked = JSON.parse(localStorage.getItem('sm_sg_liked') || '[]');
        return liked.indexOf(itemId) !== -1;
    } catch(e) { return false; }
}

function sgSetLiked(itemId, liked) {
    try {
        var likedList = JSON.parse(localStorage.getItem('sm_sg_liked') || '[]');
        if (liked && likedList.indexOf(itemId) === -1) likedList.push(itemId);
        if (!liked) likedList = likedList.filter(function(id) { return id !== itemId; });
        localStorage.setItem('sm_sg_liked', JSON.stringify(likedList));
    } catch(e) {}
}

window.sgToggleLike = async function(itemId, currentLikes) {
    var isLiked = sgIsLiked(itemId);
    var newLikes = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    sgSetLiked(itemId, !isLiked);

    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SG_LIST + "')/items(" + itemId + ")", {
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
                __metadata: { type: 'SP.Data.SuggestionsListItem' },
                Likes: newLikes
            })
        });

        // Update local data
        var item = sgAllItems.find(function(i) { return i.ID === itemId; });
        if (item) item.Likes = newLikes;
        sgRenderFeed();

    } catch(e) {
        console.error('[Suggestions like]', e);
    }
};

// ── Submit Suggestion ─────────────────────────────────────────
window.sgSubmitSuggestion = async function() {
    var textEl = document.getElementById('sgNewText');
    var catEl = document.getElementById('sgNewCategory');
    var anonEl = document.getElementById('sgNewAnonymous');

    if (!textEl) return;
    var text = (textEl.value || '').trim();
    var category = catEl ? catEl.value : 'General';
    var isAnon = anonEl ? anonEl.checked : false;

    if (!text) { alert('Please write your suggestion'); return; }

    var btn = document.getElementById('sgSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SG_LIST + "')/items", {
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digest
            },
            credentials: 'include',
            body: JSON.stringify({
                __metadata: { type: 'SP.Data.SuggestionsListItem' },
                Title: category + ' - ' + new Date().toLocaleDateString('en-GB'),
                SuggestionText: text,
                Category: category,
                IsAnonymous: isAnon,
                Status: 'New',
                Likes: 0
            })
        });

        textEl.value = '';
        if (anonEl) anonEl.checked = false;

        var successMsg = document.getElementById('sgSuccessMsg');
        if (successMsg) {
            successMsg.style.display = 'block';
            setTimeout(function() { successMsg.style.display = 'none'; }, 3000);
        }

        sgLoadSuggestions();

    } catch(e) {
        alert('Error: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Submit Suggestion'; }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// ── Admin: Update Status ──────────────────────────────────────
window.sgUpdateStatus = async function(itemId, newStatus) {
    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SG_LIST + "')/items(" + itemId + ")", {
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
                __metadata: { type: 'SP.Data.SuggestionsListItem' },
                Status: newStatus
            })
        });

        var item = sgAllItems.find(function(i) { return i.ID === itemId; });
        if (item) item.Status = newStatus;
        sgRenderFeed();

    } catch(e) { alert('Error: ' + e.message); }
};

// ── Admin: Show Response Form ─────────────────────────────────
window.sgShowResponseForm = function(itemId) {
    var form = document.getElementById('sgResponseForm_' + itemId);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

// ── Admin: Submit Response ────────────────────────────────────
window.sgSubmitResponse = async function(itemId) {
    var textEl = document.getElementById('sgResponseText_' + itemId);
    if (!textEl) return;
    var response = textEl.value.trim();

    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SG_LIST + "')/items(" + itemId + ")", {
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
                __metadata: { type: 'SP.Data.SuggestionsListItem' },
                AdminResponse: response
            })
        });

        var item = sgAllItems.find(function(i) { return i.ID === itemId; });
        if (item) item.AdminResponse = response;
        sgRenderFeed();

    } catch(e) { alert('Error: ' + e.message); }
};

// ── Filter ────────────────────────────────────────────────────
window.sgSetFilter = function(filter) {
    sgCurrentFilter = filter;

    // Update filter buttons
    ['all', 'Process', 'Tool', 'Team', 'General'].forEach(function(f) {
        var btn = document.getElementById('sgFilter_' + f);
        if (btn) {
            btn.style.background = f === filter ? 'var(--grad)' : 'var(--bg-input)';
            btn.style.color = f === filter ? '#fff' : 'var(--t1)';
            btn.style.border = f === filter ? 'none' : '1px solid var(--border)';
        }
    });

    sgRenderFeed();
};
