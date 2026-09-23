// ============================================================
// processdocs.js — Process Documents Module
// ============================================================

var PD_LIST = 'Process_Documents';
var pdAllItems = [];
var pdCurrentFilter = 'all';
var pdCurrentTab = 'docs';

window.pdLoadDocs = async function() {
    var loadingEl = document.getElementById('pdLoading');
    var contentEl = document.getElementById('pdContent');
    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';
    pdAllItems = [];

    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + PD_LIST + "')/items?" +
            "$select=ID,Title,Category,Description,DocVersion,IsActive,Created,Author/Title&" +
            "$expand=Author&$filter=IsActive eq 1&$orderby=Category asc,Title asc&$top=500";

        var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load documents');
        var data = await res.json();
        pdAllItems = data.d.results;

        for (var i = 0; i < pdAllItems.length; i++) {
            try {
                var aRes = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PD_LIST + "')/items(" + pdAllItems[i].ID + ")/AttachmentFiles",
                    { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
                if (aRes.ok) { var aData = await aRes.json(); pdAllItems[i]._files = aData.d.results; }
            } catch(e) {}
        }

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        pdRenderShell();
        pdRenderDocs();
    } catch(e) {
        console.error('[ProcessDocs]', e);
        if (loadingEl) loadingEl.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">Error: ' + e.message + '</div>';
    }
};

function pdRenderShell() {
    var container = document.getElementById('pdContainer');
    if (!container) return;
    var isAdmin = USER_CONTEXT && USER_CONTEXT.isAdmin;

    container.innerHTML =
        '<div style="background:var(--grad);border-radius:16px;padding:1.75rem 2rem;margin-bottom:1.75rem;color:#fff;display:flex;align-items:center;gap:1.25rem;">' +
        '<div style="width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<i data-lucide="folder-open" style="width:26px;height:26px;color:#fff;"></i></div>' +
        '<div><div style="font-size:1.25rem;font-weight:800;margin-bottom:.2rem;">Process Documents</div>' +
        '<div style="font-size:.82rem;opacity:.85;">Internal and external process documentation library</div></div></div>' +

        '<div style="display:flex;gap:8px;margin-bottom:1.5rem;flex-wrap:wrap;">' +
        '<button type="button" id="pdTabDocs" onclick="pdSetTab(\'docs\')" style="padding:10px 24px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:var(--grad);color:#fff;display:inline-flex;align-items:center;gap:6px;"><i data-lucide="files" style="width:14px;height:14px;"></i>Documents</button>' +
        (isAdmin ? '<button type="button" id="pdTabManage" onclick="pdSetTab(\'manage\')" style="padding:10px 24px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);display:inline-flex;align-items:center;gap:6px;"><i data-lucide="upload" style="width:14px;height:14px;"></i>Upload</button>' : '') +
        '</div>' +

        '<div id="pdDocsSection">' +
        '<div style="display:flex;gap:8px;margin-bottom:1.25rem;flex-wrap:wrap;">' +
        '<button type="button" id="pdFilter_all" onclick="pdSetFilter(\'all\')" style="padding:7px 18px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:none;background:var(--grad);color:#fff;">All</button>' +
        '<button type="button" id="pdFilter_Internal" onclick="pdSetFilter(\'Internal\')" style="padding:7px 18px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);">Internal</button>' +
        '<button type="button" id="pdFilter_External" onclick="pdSetFilter(\'External\')" style="padding:7px 18px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);">External</button>' +
        '</div>' +
        '<div id="pdDocsContainer"></div></div>' +

        '<div id="pdManageSection" style="display:none;">' +
        '<div class="table-section" style="max-width:700px;">' +
        '<h3 class="table-title" style="margin-bottom:1.5rem;"><i data-lucide="upload" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Upload New Document</h3>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
        '<div class="filter-group" style="grid-column:1/-1;"><label class="filter-label">Title *</label><input type="text" class="filter-select" id="pdTitle" placeholder="Document title" style="cursor:text;font-size:14px;padding:12px;"></div>' +
        '<div class="filter-group"><label class="filter-label">Category</label><select class="filter-select" id="pdCategory" style="font-size:14px;padding:12px;"><option value="Internal">Internal</option><option value="External">External</option></select></div>' +
        '<div class="filter-group"><label class="filter-label">Version</label><input type="text" class="filter-select" id="pdVersion" placeholder="e.g. 1.0" style="cursor:text;font-size:14px;padding:12px;"></div>' +
        '<div class="filter-group" style="grid-column:1/-1;"><label class="filter-label">Description</label><textarea class="filter-select" id="pdDescription" rows="3" placeholder="Brief description..." style="cursor:text;resize:vertical;font-size:14px;padding:12px;"></textarea></div>' +
        '<div class="filter-group" style="grid-column:1/-1;"><label class="filter-label">Document File *</label><input type="file" class="filter-select" id="pdFile" style="cursor:pointer;font-size:13px;padding:10px;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:12px;margin-top:1.5rem;">' +
        '<button type="button" class="export-btn" onclick="pdAddDoc()" style="flex:1;padding:12px;"><i data-lucide="upload" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Upload Document</button>' +
        '<button type="button" class="reset-btn" onclick="pdClearForm()" style="padding:12px 20px;"><i data-lucide="rotate-ccw" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Clear</button>' +
        '</div><div id="pdAddMsg" style="margin-top:12px;text-align:center;font-weight:600;"></div>' +
        '</div></div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function pdRenderDocs() {
    var container = document.getElementById('pdDocsContainer');
    if (!container) return;

    ['all', 'Internal', 'External'].forEach(function(f) {
        var btn = document.getElementById('pdFilter_' + f);
        if (!btn) return;
        btn.style.background = f === pdCurrentFilter ? 'var(--grad)' : 'var(--bg-input)';
        btn.style.color = f === pdCurrentFilter ? '#fff' : 'var(--t1)';
        btn.style.border = f === pdCurrentFilter ? 'none' : '1px solid var(--border)';
    });

    var filtered = pdAllItems;
    if (pdCurrentFilter !== 'all') {
        filtered = pdAllItems.filter(function(item) { return item.Category === pdCurrentFilter; });
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:80px;color:var(--t3);"><div style="font-size:56px;margin-bottom:16px;">📄</div><div style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--t2);">No documents found</div><div style="font-size:13px;">Upload your first document to get started</div></div>';
        return;
    }

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.25rem;">';

    filtered.forEach(function(item) {
        var files = item._files || [];
        var isInternal = item.Category === 'Internal';
        var catColor = isInternal ? '#3b82f6' : '#10b981';
        var catBg = isInternal ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)';

        html += '<div class="table-section" style="padding:0;overflow:hidden;transition:transform .2s,box-shadow .2s;cursor:default;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'var(--ch)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">' +
            '<div style="height:4px;background:' + (isInternal ? 'linear-gradient(90deg,#3b82f6,#1d4ed8)' : 'linear-gradient(90deg,#10b981,#059669)') + ';"></div>' +
            '<div style="padding:1.25rem;">' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:.85rem;">' +
            '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
            '<div style="width:44px;height:44px;background:' + catBg + ';border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid ' + catColor + '33;">' +
            '<i data-lucide="file-text" style="width:22px;height:22px;color:' + catColor + ';"></i></div>' +
            '<div style="min-width:0;"><div style="font-size:.92rem;font-weight:800;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.Title + '</div>' +
          (item.DocVersion ? '<div style="font-size:.72rem;color:var(--t3);margin-top:.1rem;">Version ' + item.DocVersion + '</div>' : '') +
            '</div></div>' +
            '<span style="background:' + catBg + ';color:' + catColor + ';border:1px solid ' + catColor + '33;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;flex-shrink:0;">' + (isInternal ? '🔒 Internal' : '🌐 External') + '</span>' +
            '</div>' +
            (item.Description ? '<p style="font-size:.78rem;color:var(--t3);line-height:1.6;margin:0 0 .85rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + item.Description + '</p>' : '') +
            (files.length > 0 ?
                '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:.85rem;">' +
                files.map(function(f) {
                    var ext = (f.FileName || '').split('.').pop().toLowerCase();
                    var fc = { pdf:'#ef4444', doc:'#3b82f6', docx:'#3b82f6', xls:'#10b981', xlsx:'#10b981', ppt:'#f97316', pptx:'#f97316' }[ext] || '#8b5cf6';
                    return '<a href="http://sharedspaces:8086' + f.ServerRelativeUrl + '" target="_blank" style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--bg-secondary);border-radius:9px;text-decoration:none;border:1px solid var(--border);transition:all .2s;" onmouseover="this.style.borderColor=\'' + fc + '\';this.style.background=\'' + fc + '11\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--bg-secondary)\'">' +
                        '<div style="width:30px;height:30px;background:' + fc + '22;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="file" style="width:14px;height:14px;color:' + fc + ';"></i></div>' +
                        '<span style="font-size:.78rem;color:var(--t1);font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + f.FileName + '</span>' +
                        '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;"><span style="font-size:.68rem;color:var(--t3);text-transform:uppercase;font-weight:700;">' + ext + '</span><i data-lucide="download" style="width:13px;height:13px;color:var(--t3);"></i></div></a>';
                }).join('') + '</div>' :
                '<div style="padding:9px 12px;background:var(--bg-secondary);border-radius:9px;font-size:.78rem;color:var(--t3);margin-bottom:.85rem;border:1px dashed var(--border);">No files attached</div>'
            ) +
            '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:.65rem;border-top:1px solid var(--border);">' +
            '<div style="display:flex;align-items:center;gap:5px;font-size:.72rem;color:var(--t3);"><i data-lucide="calendar" style="width:12px;height:12px;"></i>' + pdFormatDate(item.Created) + '</div>' +
            (USER_CONTEXT && USER_CONTEXT.isAdmin ? '<button type="button" onclick="pdDeactivate(' + item.ID + ')" style="padding:3px 10px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#ef4444;font-size:11px;cursor:pointer;font-weight:600;">Remove</button>' : '') +
            '</div></div></div>';
    });

    html += '</div>';
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.pdSetTab = function(tab) {
    pdCurrentTab = tab;
    var tabDocs = document.getElementById('pdTabDocs');
    var tabManage = document.getElementById('pdTabManage');
    var docsSection = document.getElementById('pdDocsSection');
    var manageSection = document.getElementById('pdManageSection');
    if (tabDocs) { tabDocs.style.background = tab === 'docs' ? 'var(--grad)' : 'var(--bg-input)'; tabDocs.style.color = tab === 'docs' ? '#fff' : 'var(--t1)'; tabDocs.style.border = tab === 'docs' ? 'none' : '1px solid var(--border)'; }
    if (tabManage) { tabManage.style.background = tab === 'manage' ? 'var(--grad)' : 'var(--bg-input)'; tabManage.style.color = tab === 'manage' ? '#fff' : 'var(--t1)'; tabManage.style.border = tab === 'manage' ? 'none' : '1px solid var(--border)'; }
    if (docsSection) docsSection.style.display = tab === 'docs' ? 'block' : 'none';
    if (manageSection) manageSection.style.display = tab === 'manage' ? 'block' : 'none';
};

window.pdSetFilter = function(filter) {
    pdCurrentFilter = filter;
    pdRenderDocs();
};

window.pdAddDoc = async function() {
    var titleEl = document.getElementById('pdTitle');
    var catEl = document.getElementById('pdCategory');
    var descEl = document.getElementById('pdDescription');
    var verEl = document.getElementById('pdVersion');
    var fileEl = document.getElementById('pdFile');
    var msgEl = document.getElementById('pdAddMsg');
    if (!titleEl) return;
    var title = (titleEl.value || '').trim();
    var category = catEl ? catEl.value : 'Internal';
    var description = descEl ? descEl.value.trim() : '';
    var version = verEl ? verEl.value.trim() : '';
    var file = fileEl ? fileEl.files[0] : null;
    if (!title) { alert('Title is required'); return; }
    if (!file) { alert('Please attach a document file'); return; }
    if (msgEl) msgEl.innerHTML = '<span style="color:var(--t3);">Uploading...</span>';
    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', { method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!digestRes.ok) throw new Error('Failed to get digest');
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;
        var createRes = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PD_LIST + "')/items", {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest },
            credentials: 'include',
            body: JSON.stringify({ __metadata: { type: 'SP.Data.Process_x005f_DocumentsListItem' }, Title: title, Category: category, Description: description, DocVersion: version, IsActive: true })
        });
        if (!createRes.ok) throw new Error('Failed to create: ' + await createRes.text());
        var newItem = await createRes.json();
        var newItemId = newItem.d.ID;
        if (msgEl) msgEl.innerHTML = '<span style="color:var(--t3);">Uploading file...</span>';
        var arrayBuffer = await file.arrayBuffer();
        await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PD_LIST + "')/items(" + newItemId + ")/AttachmentFiles/add(FileName='" + encodeURIComponent(file.name) + "')", {
            method: 'POST', headers: { 'Accept': 'application/json;odata=verbose', 'X-RequestDigest': digest }, credentials: 'include', body: arrayBuffer
        });
        if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Document uploaded successfully!</span>';
        pdClearForm();
        setTimeout(function() { if (msgEl) msgEl.innerHTML = ''; pdLoadDocs(); }, 2000);
    } catch(e) {
        console.error('[ProcessDocs]', e);
        if (msgEl) msgEl.innerHTML = '<span style="color:#ef4444;">Error: ' + e.message + '</span>';
    }
};

window.pdDeactivate = async function(itemId) {
    if (!confirm('Remove this document?')) return;
    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', { method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;
        await fetch(SP_URL + "/_api/web/lists/getbytitle('" + PD_LIST + "')/items(" + itemId + ")", {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
            credentials: 'include',
            body: JSON.stringify({ __metadata: { type: 'SP.Data.Process_x005f_DocumentsListItem' }, IsActive: false })
        });
        pdLoadDocs();
    } catch(e) { alert('Error: ' + e.message); }
};

window.pdClearForm = function() {
    ['pdTitle', 'pdDescription', 'pdVersion'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    var fileEl = document.getElementById('pdFile'); if (fileEl) fileEl.value = '';
    var catEl = document.getElementById('pdCategory'); if (catEl) catEl.selectedIndex = 0;
};

function pdFormatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
