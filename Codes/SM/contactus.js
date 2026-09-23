// ============================================================
// contactus.js — Contact Us / Directory Module
// ============================================================

var CU_LIST = 'Contact_Directory';
var cuAllItems = [];
var cuCurrentTab = 'view';

window.cuLoadContacts = async function() {
    var loadingEl = document.getElementById('cuLoading');
    var contentEl = document.getElementById('cuContent');
 if (loadingEl) loadingEl.style.display = 'block';
var container = document.getElementById('cuViewContainer');
if (container) container.innerHTML = '';
cuAllItems = [];

    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + CU_LIST + "')/items?" +
            "$select=ID,Title,Designation,Email,Telephone,DisplayOrder,IsActive&" +
            "$filter=IsActive eq 1&$orderby=DisplayOrder asc&$top=100";

        var res = await fetch(url, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to load contacts');
        var data = await res.json();
        cuAllItems = data.d.results;

        for (var i = 0; i < cuAllItems.length; i++) {
            try {
                var aRes = await fetch(
                    SP_URL + "/_api/web/lists/getbytitle('" + CU_LIST + "')/items(" + cuAllItems[i].ID + ")/AttachmentFiles",
                    { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' }
                );
                if (aRes.ok) {
                    var aData = await aRes.json();
                    var files = aData.d.results;
                    var img = files.find(function(f) {
                        return /\.(jpg|jpeg|png|gif|webp)$/i.test(f.FileName);
                    });
                    if (img) cuAllItems[i]._photoURL = img.ServerRelativeUrl;
                }
            } catch(e) {}
        }

      if (loadingEl) loadingEl.style.display = 'none';
cuRenderShell();
cuRenderView();

    } catch(e) {
        console.error('[ContactUs]', e);
        if (loadingEl) loadingEl.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">Error: ' + e.message + '</div>';
    }
};

// ── Render Shell ──────────────────────────────────────────────
function cuRenderShell() {
    var container = document.getElementById('cuViewContainer');
    if (!container) return;
    var isAdmin = USER_CONTEXT && USER_CONTEXT.isAdmin;

    container.innerHTML =
        '<div style="background:var(--grad);border-radius:16px;padding:1.75rem 2rem;margin-bottom:1.75rem;color:#fff;display:flex;align-items:center;gap:1.25rem;">' +
        '<div style="width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<i data-lucide="headphones" style="width:26px;height:26px;color:#fff;"></i></div>' +
        '<div><div style="font-size:1.25rem;font-weight:800;margin-bottom:.2rem;">Service Management Support</div>' +
        '<div style="font-size:.82rem;opacity:.85;">Reach out to our team for any service-related queries</div></div></div>' +

        '<div style="display:flex;gap:8px;margin-bottom:1.5rem;flex-wrap:wrap;">' +
        '<button type="button" id="cuTabView" onclick="cuSetTab(\'view\')" style="padding:10px 24px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:var(--grad);color:#fff;display:inline-flex;align-items:center;gap:6px;"><i data-lucide="users" style="width:14px;height:14px;"></i>Directory</button>' +
        (isAdmin ? '<button type="button" id="cuTabManage" onclick="cuSetTab(\'manage\')" style="padding:10px 24px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);display:inline-flex;align-items:center;gap:6px;"><i data-lucide="settings" style="width:14px;height:14px;"></i>Manage</button>' : '') +
        '</div>' +

        '<div id="cuDirectorySection"><div id="cuCardsContainer"></div></div>' +

        '<div id="cuManageSection" style="display:none;">' +
        '<div class="table-section" style="max-width:700px;">' +
        '<h3 class="table-title" style="margin-bottom:1.5rem;"><i data-lucide="user-plus" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Add New Contact</h3>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
        '<div class="filter-group"><label class="filter-label">Full Name *</label><input type="text" class="filter-select" id="cuName" placeholder="e.g. John Smith" style="cursor:text;font-size:14px;padding:12px;"></div>' +
        '<div class="filter-group"><label class="filter-label">Designation *</label><input type="text" class="filter-select" id="cuDesignation" placeholder="e.g. Service Manager" style="cursor:text;font-size:14px;padding:12px;"></div>' +
        '<div class="filter-group"><label class="filter-label">Email</label><input type="email" class="filter-select" id="cuEmail" placeholder="name@du.ae" style="cursor:text;font-size:14px;padding:12px;"></div>' +
        '<div class="filter-group"><label class="filter-label">Telephone</label><input type="text" class="filter-select" id="cuTelephone" placeholder="+971 4 XXX XXXX" style="cursor:text;font-size:14px;padding:12px;"></div>' +
        '<div class="filter-group"><label class="filter-label">Display Order</label><input type="number" class="filter-select" id="cuOrder" placeholder="1" value="1" style="cursor:text;font-size:14px;padding:12px;"></div>' +
        '<div class="filter-group"><label class="filter-label">Photo (optional)</label><input type="file" class="filter-select" id="cuPhotoFile" accept="image/*" style="cursor:pointer;font-size:13px;padding:10px;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:12px;margin-top:1.5rem;">' +
        '<button type="button" class="export-btn" onclick="cuAddContact()" style="flex:1;padding:12px;"><i data-lucide="user-plus" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Add Contact</button>' +
        '<button type="button" class="reset-btn" onclick="cuClearForm()" style="padding:12px 20px;"><i data-lucide="rotate-ccw" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Clear</button>' +
        '</div><div id="cuAddMsg" style="margin-top:12px;text-align:center;font-weight:600;"></div>' +
        '</div></div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Render View ───────────────────────────────────────────────
function cuRenderView() {
    var container = document.getElementById('cuCardsContainer');
    if (!container) return;

    if (cuAllItems.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:80px;color:var(--t3);"><div style="font-size:56px;margin-bottom:16px;">👥</div><div style="font-size:18px;font-weight:600;margin-bottom:8px;">No contacts yet</div></div>';
        return;
    }

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:1.5rem;">';

    cuAllItems.forEach(function(item) {
        var photoURL = item._photoURL;
        var initials = cuGetInitials(item.Title);
        var avatarColor = cuGetAvatarColor(item.Title);

        html += '<div class="table-section" style="padding:0;overflow:hidden;transition:transform .2s,box-shadow .2s;" onmouseover="this.style.transform=\'translateY(-4px)\';this.style.boxShadow=\'var(--ch)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">' +
            '<div style="height:6px;background:var(--grad);"></div>' +
            '<div style="padding:2rem 2.5rem;display:flex;gap:1.5rem;align-items:center;">' +
            '<div style="flex-shrink:0;width:90px;height:90px;border-radius:50%;overflow:hidden;border:3px solid var(--border);box-shadow:0 4px 16px var(--glow);">' +
            (photoURL ?
                '<img src="http://sharedspaces:8086' + photoURL + '" style="width:100%;height:100%;object-fit:cover;" />' :
                '<div style="width:100%;height:100%;background:' + avatarColor + ';display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:800;color:#fff;">' + initials + '</div>'
            ) + '</div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--t1);margin-bottom:.3rem;">' + (item.Title || '') + '</div>' +
            '<div style="display:inline-block;font-size:.75rem;color:var(--acc);font-weight:700;padding:.2rem .75rem;background:var(--nab);border:1px solid var(--nab2);border-radius:20px;margin-bottom:.85rem;">' + (item.Designation || '') + '</div>' +
            '<div style="display:flex;flex-direction:column;gap:.5rem;">' +
            (item.Email ? '<div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;background:var(--bg-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="mail" style="width:13px;height:13px;color:var(--acc);"></i></div><a href="mailto:' + item.Email + '" style="font-size:.8rem;color:var(--t2);text-decoration:none;word-break:break-all;" onmouseover="this.style.color=\'var(--acc)\'" onmouseout="this.style.color=\'var(--t2)\'">' + item.Email + '</a></div>' : '') +
            (item.Telephone ? '<div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;background:var(--bg-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="phone" style="width:13px;height:13px;color:var(--acc);"></i></div><a href="tel:' + item.Telephone + '" style="font-size:.8rem;color:var(--t2);text-decoration:none;">' + item.Telephone + '</a></div>' : '') +
            '</div></div></div>' +
            (USER_CONTEXT && USER_CONTEXT.isAdmin ? '<div style="padding:.75rem 2rem;border-top:1px solid var(--border);display:flex;justify-content:flex-end;"><button type="button" onclick="cuDeactivate(' + item.ID + ')" style="padding:4px 14px;border-radius:7px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#ef4444;font-size:11px;cursor:pointer;font-weight:600;">Remove</button></div>' : '') +
            '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Tab Switch ────────────────────────────────────────────────
window.cuSetTab = function(tab) {
    cuCurrentTab = tab;
    var tabView = document.getElementById('cuTabView');
    var tabManage = document.getElementById('cuTabManage');
    var dirSection = document.getElementById('cuDirectorySection');
    var manageSection = document.getElementById('cuManageSection');

    if (tabView) { tabView.style.background = tab === 'view' ? 'var(--grad)' : 'var(--bg-input)'; tabView.style.color = tab === 'view' ? '#fff' : 'var(--t1)'; tabView.style.border = tab === 'view' ? 'none' : '1px solid var(--border)'; }
    if (tabManage) { tabManage.style.background = tab === 'manage' ? 'var(--grad)' : 'var(--bg-input)'; tabManage.style.color = tab === 'manage' ? '#fff' : 'var(--t1)'; tabManage.style.border = tab === 'manage' ? 'none' : '1px solid var(--border)'; }
    if (dirSection) dirSection.style.display = tab === 'view' ? 'block' : 'none';
    if (manageSection) manageSection.style.display = tab === 'manage' ? 'block' : 'none';
};

// ── Helpers ───────────────────────────────────────────────────
function cuGetInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
}

function cuGetAvatarColor(name) {
    var colors = [
        'linear-gradient(135deg,#9248b9,#c724b1)',
        'linear-gradient(135deg,#3b82f6,#1d4ed8)',
        'linear-gradient(135deg,#10b981,#059669)',
        'linear-gradient(135deg,#f97316,#ea580c)',
        'linear-gradient(135deg,#8b5cf6,#6d28d9)',
        'linear-gradient(135deg,#ec4899,#be185d)'
    ];
    var index = 0;
    if (name) { for (var i = 0; i < name.length; i++) index += name.charCodeAt(i); }
    return colors[index % colors.length];
}

// ── Add Contact ───────────────────────────────────────────────
window.cuAddContact = async function() {
    var nameEl = document.getElementById('cuName');
    var desigEl = document.getElementById('cuDesignation');
    var emailEl = document.getElementById('cuEmail');
    var telEl = document.getElementById('cuTelephone');
    var orderEl = document.getElementById('cuOrder');
    var photoEl = document.getElementById('cuPhotoFile');
    if (!nameEl || !desigEl) { alert('Form not found'); return; }
    var name = (nameEl.value || '').trim();
    var designation = (desigEl.value || '').trim();
    var email = (emailEl ? emailEl.value : '').trim();
    var telephone = (telEl ? telEl.value : '').trim();
    var order = parseInt(orderEl ? orderEl.value : '1') || 1;
    var photoFile = photoEl ? photoEl.files[0] : null;
    if (!name || !designation) { alert('Name and Designation are required'); return; }
    var msgEl = document.getElementById('cuAddMsg');
    if (msgEl) msgEl.innerHTML = '<span style="color:var(--t3);">Adding contact...</span>';
    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', { method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!digestRes.ok) throw new Error('Failed to get digest');
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;
        var createRes = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + CU_LIST + "')/items", {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest },
            credentials: 'include',
            body: JSON.stringify({ __metadata: { type: 'SP.Data.Contact_x005f_DirectoryListItem' }, Title: name, Designation: designation, Email: email, Telephone: telephone, DisplayOrder: order, IsActive: true })
        });
        if (!createRes.ok) throw new Error('Failed to create: ' + await createRes.text());
        var newItem = await createRes.json();
        var newItemId = newItem.d.ID;
        if (photoFile) {
            if (msgEl) msgEl.innerHTML = '<span style="color:var(--t3);">Uploading photo...</span>';
            var arrayBuffer = await photoFile.arrayBuffer();
            await fetch(SP_URL + "/_api/web/lists/getbytitle('" + CU_LIST + "')/items(" + newItemId + ")/AttachmentFiles/add(FileName='" + encodeURIComponent(photoFile.name) + "')", {
                method: 'POST', headers: { 'Accept': 'application/json;odata=verbose', 'X-RequestDigest': digest }, credentials: 'include', body: arrayBuffer
            });
        }
        if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Contact added successfully!</span>';
        cuClearForm();
        setTimeout(function() { if (msgEl) msgEl.innerHTML = ''; cuLoadContacts(); }, 2000);
    } catch(e) {
        console.error('[ContactUs]', e);
        if (msgEl) msgEl.innerHTML = '<span style="color:#ef4444;">Error: ' + e.message + '</span>';
    }
};

// ── Deactivate ────────────────────────────────────────────────
window.cuDeactivate = async function(itemId) {
    if (!confirm('Remove this contact from the directory?')) return;
    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', { method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;
        await fetch(SP_URL + "/_api/web/lists/getbytitle('" + CU_LIST + "')/items(" + itemId + ")", {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
            credentials: 'include',
            body: JSON.stringify({ __metadata: { type: 'SP.Data.Contact_x005f_DirectoryListItem' }, IsActive: false })
        });
        cuLoadContacts();
    } catch(e) { alert('Error: ' + e.message); }
};

// ── Clear Form ────────────────────────────────────────────────
window.cuClearForm = function() {
    ['cuName', 'cuDesignation', 'cuEmail', 'cuTelephone', 'cuOrder'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = id === 'cuOrder' ? '1' : '';
    });
    var photoEl = document.getElementById('cuPhotoFile'); if (photoEl) photoEl.value = '';
};
