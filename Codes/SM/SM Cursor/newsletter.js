// ============================================================
// newsletter.js — Newsletter Module
// ============================================================

var NL_LIST = 'Newsletter';
var nlCurrentTab = 'view';
var nlAllItems = [];

// ── Show / Hide ───────────────────────────────────────────────
window.showNewsletterView = function() {
    if (typeof analyticsTrackPage === 'function') analyticsTrackPage('Newsletter');
    nlCurrentTab = 'view';
    if (typeof switchDashboardSection === 'function') {
        switchDashboardSection('newsletterView');
    } else {
        var dash = document.getElementById('dashboard-view');
        if (dash) dash.style.display = 'none';
        document.querySelectorAll('.dashboard-section').forEach(function(s) { s.style.display = 'none'; });
        var view = document.getElementById('newsletterView');
        if (view) view.style.display = 'block';
        nlLoadNewsletter();
        nlMarkAsSeen();
        nlRemoveNewBadge();
    }
    window.scrollTo(0, 0);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.backFromNewsletter = function() {
    if (typeof switchDashboardSection === 'function') switchDashboardSection('dashboard-view');
    window.scrollTo(0, 0);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ── NEW Badge ─────────────────────────────────────────────────
function nlGetLastSeenId() {
    try { return localStorage.getItem('sm_nl_last_seen') || '0'; } catch(e) { return '0'; }
}

function nlMarkAsSeen() {
    if (nlAllItems.length > 0) {
        try { localStorage.setItem('sm_nl_last_seen', String(nlAllItems[0].ID)); } catch(e) {}
    }
}

function nlRemoveNewBadge() {
    var badge = document.getElementById('nlNewBadge');
    if (badge) badge.style.display = 'none';
}

function nlCheckNewBadge(items) {
    if (!items || items.length === 0) return;
    var lastSeen = nlGetLastSeenId();
    if (String(items[0].ID) !== lastSeen) {
        var badge = document.getElementById('nlNewBadge');
        if (badge) badge.style.display = 'inline-flex';
    }
}

// ── Load ──────────────────────────────────────────────────────
async function nlLoadNewsletter() {
    var loadingEl = document.getElementById('nlLoading');
    var contentEl = document.getElementById('nlContent');
    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    try {
    var url = SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items?" +
"$select=ID,Title,Content,Category,IsActive,PublishedDate,Source,Author/Title&" +    "$expand=Author&" +
    "$filter=IsActive eq 1&" +
    "$orderby=PublishedDate desc&$top=50";

        var res = await fetch(url, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to load newsletter');
        var data = await res.json();
        nlAllItems = data.d.results;

// Fetch attachments for each item
for (var i = 0; i < nlAllItems.length; i++) {
    try {
        var aRes = await fetch(
            SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items(" + nlAllItems[i].ID + ")/AttachmentFiles",
            { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' }
        );
        if (aRes.ok) {
            var aData = await aRes.json();
            var files = aData.d.results;
            var img = files.find(function(f) {
                return /\.(jpg|jpeg|png|gif|webp)$/i.test(f.FileName);
            });
            if (img) nlAllItems[i]._imageURL = img.ServerRelativeUrl;
        }
    } catch(e) {}
}

nlCheckNewBadge(nlAllItems);
nlRender();

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';

    } catch(e) {
        console.error('[Newsletter]', e);
        if (loadingEl) loadingEl.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">Error loading newsletter: ' + e.message + '</div>';
    }
}

// ── Tab Switch ────────────────────────────────────────────────
window.nlSetTab = function(tab) {
    nlCurrentTab = tab;

    var tabView = document.getElementById('nlTabView');
    var tabManage = document.getElementById('nlTabManage');

    if (tabView) {
        tabView.style.background = tab === 'view' ? 'var(--grad)' : 'var(--bg-input)';
        tabView.style.color = tab === 'view' ? '#fff' : 'var(--t1)';
        tabView.style.border = tab === 'view' ? 'none' : '1px solid var(--border)';
    }
    if (tabManage) {
        tabManage.style.background = tab === 'manage' ? 'var(--grad)' : 'var(--bg-input)';
        tabManage.style.color = tab === 'manage' ? '#fff' : 'var(--t1)';
        tabManage.style.border = tab === 'manage' ? 'none' : '1px solid var(--border)';
    }

    nlRender();
};

// ── Render ────────────────────────────────────────────────────
function nlRender() {
    var isAdmin = USER_CONTEXT && USER_CONTEXT.isAdmin;
    var manageTab = document.getElementById('nlTabManage');
    if (manageTab) manageTab.style.display = isAdmin ? 'inline-flex' : 'none';

    if (nlCurrentTab === 'manage' && isAdmin) {
        nlRenderManage();
    } else {
        nlRenderView();
    }
}

// ── Helpers ───────────────────────────────────────────────────
function nlCategoryColor(cat) {
    var map = { 'Announcement': '#f97316', 'Update': '#3b82f6', 'Holiday': '#10b981', 'General': '#8b5cf6' };
    return map[cat] || '#8b5cf6';
}

function nlFormatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nlGetImageURL(item) {
    return item._imageURL || null;
}

// ── View Tab ──────────────────────────────────────────────────
function nlRenderView() {
    var container = document.getElementById('nlViewContainer');
    if (!container) return;

    if (nlAllItems.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:80px;color:var(--t3);">' +
            '<div style="font-size:56px;margin-bottom:16px;">📰</div>' +
            '<div style="font-size:18px;font-weight:600;margin-bottom:8px;">No newsletters yet</div>' +
            '<div style="font-size:13px;">Check back soon for updates</div>' +
            '</div>';
        return;
    }

    var html = '';
    var latest = nlAllItems[0];
    var rest = nlAllItems.slice(1);

    // Hero card — latest newsletter
    html += nlBuildHeroCard(latest);

    // Older newsletters grid
    if (rest.length > 0) {
        html += '<h3 style="font-size:.95rem;font-weight:800;color:var(--t1);margin:2rem 0 1rem;display:flex;align-items:center;gap:8px;">' +
            '<i data-lucide="clock" style="width:16px;height:16px;"></i>Previous Newsletters</h3>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-bottom:2rem;">';
        rest.forEach(function(item) { html += nlBuildCard(item); });
        html += '</div>';
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function nlBuildHeroCard(item) {
    var color = nlCategoryColor(item.Category);
    var imageURL = nlGetImageURL(item);

    return '<div class="table-section" style="padding:0;overflow:hidden;border-radius:20px;margin-bottom:1.5rem;box-shadow:var(--ch);">' +
        (imageURL ?
            '<div style="width:100%;max-height:360px;overflow:hidden;">' +
            '<img src="http://sharedspaces:8086' + imageURL + '"style="width:100%;height:360px;object-fit:cover;display:block;" onerror="this.parentElement.style.display=\'none\'" /></div>' :
            '<div style="width:100%;height:160px;background:var(--grad);display:flex;align-items:center;justify-content:center;">' +
            '<i data-lucide="newspaper" style="width:64px;height:64px;color:rgba(255,255,255,0.5);"></i></div>'
        ) +
        '<div style="padding:2rem;">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;flex-wrap:wrap;">' +
      '<span style="background:' + color + ';color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">' + (item.Category || 'General') + ' Announcement</span>' +
        '<span style="font-size:12px;color:var(--t3);display:flex;align-items:center;gap:4px;"><i data-lucide="calendar" style="width:13px;height:13px;"></i>' + nlFormatDate(item.PublishedDate) + '</span>' +
       '<span style="font-size:12px;color:var(--t3);display:flex;align-items:center;gap:4px;"><i data-lucide="users" style="width:13px;height:13px;"></i>' + (item.Source || (item.Author ? item.Author.Title : 'Admin')) + '</span>' +
        '</div>' +
        '<h2 style="font-size:1.6rem;font-weight:800;color:var(--t1);margin:0 0 1rem!important;">' + item.Title + '</h2>' +
     '<p style="font-size:14px;color:var(--t2);line-height:1.9;margin:0;white-space:pre-wrap;">' + (item.Content || '').replace(/\n/g, '<br>') + '</p>' +
        '</div></div>';
}

function nlBuildCard(item) {
    var color = nlCategoryColor(item.Category);
    var imageURL = nlGetImageURL(item);

    return '<div class="table-section" style="padding:0;overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;" ' +
        'onclick="nlOpenCard(' + item.ID + ')" ' +
        'onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'var(--ch)\'" ' +
        'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">' +
        (imageURL ?
            '<div style="height:140px;overflow:hidden;"><img src="http://sharedspaces:8086' + imageURL + '" style="width:100%;height:140px;object-fit:cover;" onerror="this.parentElement.style.display=\'none\'" /></div>' :
            '<div style="height:80px;background:var(--grad);display:flex;align-items:center;justify-content:center;">' +
            '<i data-lucide="newspaper" style="width:28px;height:28px;color:rgba(255,255,255,0.6);"></i></div>'
        ) +
        '<div style="padding:1rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:.5rem;">' +
        '<span style="background:' + color + ';color:#fff;font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;text-transform:uppercase;">' + (item.Category || 'General') + ' Announcement</span>' +
        '<span style="font-size:11px;color:var(--t3);">' + nlFormatDate(item.PublishedDate) + '</span>' +
        '</div>' +
        '<div style="font-size:.9rem;font-weight:700;color:var(--t1);margin-bottom:.4rem;line-height:1.3;">' + item.Title + '</div>' +
        '<div style="font-size:12px;color:var(--t3);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + (item.Content || '') + '</div>' +
        '<div style="margin-top:.75rem;display:flex;align-items:center;gap:4px;font-size:.75rem;color:var(--acc);font-weight:700;">' +
        '<i data-lucide="eye" style="width:13px;height:13px;"></i>Read more</div>' +
        '</div></div>';
}
window.nlOpenCard = function(itemId) {
    var item = nlAllItems.find(function(i) { return i.ID === itemId; });
    if (!item) return;

    var color = nlCategoryColor(item.Category);
    var imageURL = nlGetImageURL(item);

    var overlay = document.createElement('div');
    overlay.id = 'nlOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';

    overlay.innerHTML =
        '<div style="background:var(--bg-card);border-radius:20px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);position:relative;">' +

        // Close button
        '<button type="button" onclick="document.getElementById(\'nlOverlay\').remove()" ' +
        'style="position:sticky;top:12px;float:right;margin:12px 12px 0 0;width:34px;height:34px;border-radius:50%;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;z-index:1;">✕</button>' +

        // Image
        (imageURL ?
            '<div style="width:100%;max-height:280px;overflow:hidden;border-radius:20px 20px 0 0;">' +
            '<img src="http://sharedspaces:8086' + imageURL + '" style="width:100%;height:280px;object-fit:cover;display:block;" /></div>' :
            '<div style="height:120px;background:var(--grad);border-radius:20px 20px 0 0;display:flex;align-items:center;justify-content:center;">' +
            '<i data-lucide="newspaper" style="width:48px;height:48px;color:rgba(255,255,255,0.5);"></i></div>'
        ) +

        '<div style="padding:2rem;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap;">' +
        '<span style="background:' + color + ';color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;text-transform:uppercase;">' + (item.Category || 'General') + ' Announcement</span>' +
        '<span style="font-size:12px;color:var(--t3);display:flex;align-items:center;gap:4px;"><i data-lucide="calendar" style="width:13px;height:13px;"></i>' + nlFormatDate(item.PublishedDate) + '</span>' +
        '<span style="font-size:12px;color:var(--t3);display:flex;align-items:center;gap:4px;"><i data-lucide="users" style="width:13px;height:13px;"></i>' + (item.Source || (item.Author ? item.Author.Title : 'Admin')) + '</span>' +
        '</div>' +
        '<h2 style="font-size:1.4rem;font-weight:800;color:var(--t1);margin:0 0 1.25rem!important;">' + item.Title + '</h2>' +
        '<p style="font-size:14px;color:var(--t2);line-height:1.9;margin:0;white-space:pre-wrap;">' + (item.Content || '').replace(/\n/g, '<br>') + '</p>' +
        '</div></div>';

    // Close on background click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });

    if (typeof smMountPopup === 'function') smMountPopup(overlay);
    else document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
// ── Manage Tab (Admin) ────────────────────────────────────────
function nlRenderManage() {
    var container = document.getElementById('nlViewContainer');
    if (!container) return;

    var html = '<div class="table-section" style="margin-bottom:1.5rem;">' +
        '<h3 class="table-title" style="margin-bottom:1.5rem;">' +
        '<i data-lucide="plus-circle" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Publish New Newsletter</h3>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +

        '<div class="filter-group" style="grid-column:1/-1;">' +
        '<label class="filter-label">Title *</label>' +
        '<input type="text" class="filter-select" id="nlTitle" placeholder="Newsletter headline" style="cursor:text;font-size:14px;padding:12px;"></div>' +
'<div class="filter-group" style="grid-column:1/-1;">' +
'<label class="filter-label">Source (e.g. People & Impact)</label>' +
'<input type="text" class="filter-select" id="nlSource" placeholder="e.g. People & Impact" style="cursor:text;font-size:14px;padding:12px;"></div>' +
        '<div class="filter-group">' +
        '<label class="filter-label">Category</label>' +
        '<select class="filter-select" id="nlCategory" style="font-size:14px;padding:12px;">' +
        '<option value="Announcement">Announcement</option>' +
        '<option value="Update">Update</option>' +
        '<option value="Holiday">Holiday</option>' +
        '<option value="General">General</option>' +
        '</select></div>' +

        '<div class="filter-group">' +
        '<label class="filter-label">Image (optional)</label>' +
        '<input type="file" class="filter-select" id="nlImageFile" accept="image/*" style="cursor:pointer;font-size:13px;padding:10px;"></div>' +

        '<div class="filter-group" style="grid-column:1/-1;">' +
        '<label class="filter-label">Content *</label>' +
        '<textarea class="filter-select" id="nlContentText" rows="7"placeholder="Write your newsletter content here..." style="cursor:text;resize:vertical;font-size:14px;padding:12px;line-height:1.7;"></textarea></div>' +

        '</div>' +
        '<div style="display:flex;gap:12px;margin-top:1.5rem;">' +
        '<button type="button" class="export-btn" onclick="nlPublish()" style="flex:1;padding:12px;">' +
        '<i data-lucide="send" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Publish Newsletter</button>' +
        '<button type="button" class="reset-btn" onclick="nlClearForm()" style="padding:12px 20px;">' +
        '<i data-lucide="rotate-ccw" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Clear</button>' +
        '</div>' +
        '<div id="nlPublishMsg" style="margin-top:12px;text-align:center;font-weight:600;"></div>' +
        '</div>';

    // All newsletters table
    html += '<div class="table-section">' +
        '<h3 class="table-title" style="margin-bottom:1rem;">' +
        '<i data-lucide="list" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>All Newsletters</h3>';

    if (nlAllItems.length === 0) {
        html += '<div style="text-align:center;padding:40px;color:var(--t3);">No newsletters published yet</div>';
    } else {
        html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>' +
            '<th style="background:var(--bg-secondary);padding:.65rem .9rem;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Title</th>' +
            '<th style="background:var(--bg-secondary);padding:.65rem .9rem;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Category</th>' +
            '<th style="background:var(--bg-secondary);padding:.65rem .9rem;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Published</th>' +
            '<th style="background:var(--bg-secondary);padding:.65rem .9rem;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Image</th>' +
            '<th style="background:var(--bg-secondary);padding:.65rem .9rem;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Status</th>' +
            '<th style="background:var(--bg-secondary);padding:.65rem .9rem;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Action</th>' +
            '</tr></thead><tbody>';

        nlAllItems.forEach(function(item) {
            var imageURL = nlGetImageURL(item);
            html += '<tr>' +
                '<td style="padding:.65rem .9rem;border-bottom:1px solid var(--border);color:var(--t1);font-weight:600;">' + item.Title + '</td>' +
                '<td style="padding:.65rem .9rem;border-bottom:1px solid var(--border);">' +
                '<span style="background:' + nlCategoryColor(item.Category) + ';color:#fff;font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;text-transform:uppercase;">' + (item.Category || 'General') + '</span></td>' +
                '<td style="padding:.65rem .9rem;border-bottom:1px solid var(--border);color:var(--t3);font-size:12px;">' + nlFormatDate(item.PublishedDate) + '</td>' +
                '<td style="padding:.65rem .9rem;border-bottom:1px solid var(--border);">' +
                (imageURL ?
                    '<img src="http://sharedspaces:8086' + imageURL + '" style="width:48px;height:36px;object-fit:cover;border-radius:6px;" />' :
                    '<span style="font-size:11px;color:var(--t3);">No image</span>'
                ) + '</td>' +
                '<td style="padding:.65rem .9rem;border-bottom:1px solid var(--border);">' +
                '<span class="status-badge ' + (item.IsActive ? 'badge-success' : 'badge-danger') + '">' + (item.IsActive ? 'Active' : 'Inactive') + '</span></td>' +
                '<td style="padding:.65rem .9rem;border-bottom:1px solid var(--border);">' +
                '<button type="button" class="export-btn" style="padding:4px 12px;font-size:11px;background:' +
                (item.IsActive ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#10b981,#059669)') + ';" ' +
                'onclick="nlToggleActive(' + item.ID + ',' + item.IsActive + ')">' +
                (item.IsActive ? 'Deactivate' : 'Activate') + '</button>' +
                '</td></tr>';
        });

        html += '</tbody></table></div>';
    }

    html += '</div>';
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Publish ───────────────────────────────────────────────────
window.nlPublish = async function() {
  var titleEl = document.getElementById('nlTitle');
var contentEl2 = document.getElementById('nlContentText');
var categoryEl = document.getElementById('nlCategory');
var imageFileEl = document.getElementById('nlImageFile');

if (!titleEl || !contentEl2) { 
    alert('Form elements not found. Please refresh and try again.'); 
    return; 
}

var title = (titleEl.value || '').trim();
var content = (contentEl2.value || '').trim();
var category = categoryEl ? categoryEl.value : 'General';
var imageFile = imageFileEl ? imageFileEl.files[0] : null;

if (!title || !content) { alert('Title and Content are required'); return; }

    var msgEl = document.getElementById('nlPublishMsg');
    msgEl.innerHTML = '<span style="color:var(--t3);">Publishing...</span>';

    try {
        // Get digest
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!digestRes.ok) throw new Error('Failed to get digest');
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        // Step 1 — Create list item
var sourceEl = document.getElementById('nlSource');
var source = sourceEl ? sourceEl.value.trim() : '';

var createRes = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items", {
    method: 'POST',
    headers: {
        'Accept': 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest
    },
    credentials: 'include',
    body: JSON.stringify({
        __metadata: { type: 'SP.Data.NewsletterListItem' },
        Title: title,
        Content: content,
        Category: category,
        Source: source,
        IsActive: true,
        PublishedDate: new Date().toISOString()
    })
});
        if (!createRes.ok) throw new Error('Failed to create item: ' + await createRes.text());
        var newItem = await createRes.json();
        var newItemId = newItem.d.ID;

        // Step 2 — Upload image as attachment if provided
        if (imageFile) {
            msgEl.innerHTML = '<span style="color:var(--t3);">Uploading image...</span>';
            var arrayBuffer = await imageFile.arrayBuffer();
            var attachRes = await fetch(
                SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items(" + newItemId + ")/AttachmentFiles/add(FileName='" + encodeURIComponent(imageFile.name) + "')",
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;odata=verbose',
                        'X-RequestDigest': digest
                    },
                    credentials: 'include',
                    body: arrayBuffer
                }
            );
            if (!attachRes.ok) console.warn('[Newsletter] Image upload failed:', await attachRes.text());
        }

        msgEl.innerHTML = '<span style="color:#10b981;">✅ Newsletter published successfully!</span>';
        nlClearForm();
        setTimeout(function() {
            msgEl.innerHTML = '';
            nlLoadNewsletter();
        }, 2000);

    } catch(e) {
        console.error('[Newsletter publish]', e);
        msgEl.innerHTML = '<span style="color:#ef4444;">Error: ' + e.message + '</span>';
    }
};

// ── Clear Form ────────────────────────────────────────────────
window.nlClearForm = function() {
['nlTitle', 'nlContentText', 'nlSource'].forEach(function(id) {        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    var cat = document.getElementById('nlCategory');
    if (cat) cat.selectedIndex = 0;
    var fileEl = document.getElementById('nlImageFile');
    if (fileEl) fileEl.value = '';
};

// ── Toggle Active ─────────────────────────────────────────────
window.nlToggleActive = async function(itemId, currentState) {
    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        await fetch(SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items(" + itemId + ")", {
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
                __metadata: { type: 'SP.Data.NewsletterListItem' },
                IsActive: !currentState
            })
        });

        nlLoadNewsletter();
    } catch(e) {
        alert('Error: ' + e.message);
    }
};

// ── Check on page load ────────────────────────────────────────
window.nlCheckOnLoad = async function() {
    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items?" +
            "$select=ID&$filter=IsActive eq 1&$orderby=PublishedDate desc&$top=1";
        var res = await fetch(url, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!res.ok) return;
        var data = await res.json();
        var items = data.d.results;
        if (items.length > 0) {
            nlCheckNewBadge(items);
        }
    } catch(e) {}
};
