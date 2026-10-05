// ============================================================
// TSM_SE.JS — TSM Small Enterprise Module
// Data source: SharePoint list "TSM_SE_Accounts"
// Upload: Excel → parse → smart/full upload to SP list
// ============================================================
(function () {
    'use strict';

    const SP_URL          = 'http://sharedspaces:8086/sites/SM';
    const TSM_LIST        = 'TSM_SE_Accounts';
    const EXCEL_URL       = SP_URL + '/Shared%20Documents/ServiceManagement/TSM_SE/TSM_SE_Accounts.xlsx';
    const ADMIN_EMAILS    = ['ubaid.mir@du.ae', 'tehleel.lone@du.ae'];

    // Month column name mapping — three forms SharePoint uses:
    // displayName  : what you see in the list UI         e.g. 'Jan26'
    // internalName : hex-encoded internal name           e.g. '_x004a_an26'
    // oDataName    : EntityPropertyName used in POST/MERGE e.g. 'OData__x004a_an26'
    // readKey      : key returned in GET responses       e.g. 'OData__x004a_an26'
    const MONTH_MAP = [
        { display:'Jan26', internal:'_x004a_an26', odata:'OData__x004a_an26' },
        { display:'Feb26', internal:'_x0046_eb26', odata:'OData__x0046_eb26' },
        { display:'Mar26', internal:'_x004d_ar26', odata:'OData__x004d_ar26' },
        { display:'Apr26', internal:'_x0041_pr26', odata:'OData__x0041_pr26' },
        { display:'May26', internal:'_x004d_ay26', odata:'OData__x004d_ay26' },
        { display:'Jun26', internal:'_x004a_un26', odata:'OData__x004a_un26' },
        { display:'Jul26', internal:'_x004a_ul26', odata:'OData__x004a_ul26' },
        { display:'Aug26', internal:'_x0041_ug26', odata:'OData__x0041_ug26' },
        { display:'Sep26', internal:'_x0053_ep26', odata:'OData__x0053_ep26' },
        { display:'Oct26', internal:'_x004f_ct26', odata:'OData__x004f_ct26' },
        { display:'Nov26', internal:'_x004e_ov26', odata:'OData__x004e_ov26' },
        { display:'Dec26', internal:'_x0044_ec26', odata:'OData__x0044_ec26' },
    ];

    // Convenience lookups built from MONTH_MAP
    const MONTH_KEYS     = MONTH_MAP.map(function(m){ return m.display; });
    // odata key → our row key (lowercase display) — used when reading SP responses
    const ODATA_TO_ROW   = {};
    MONTH_MAP.forEach(function(m){ ODATA_TO_ROW[m.odata] = m.display.toLowerCase(); });
    // internal hex → our row key — fallback for reading
    const INTERNAL_TO_ROW = {};
    MONTH_MAP.forEach(function(m){ INTERNAL_TO_ROW[m.internal] = m.display.toLowerCase(); });
    // display → our row key
    const DISPLAY_TO_ROW = {};
    MONTH_MAP.forEach(function(m){ DISPLAY_TO_ROW[m.display] = m.display.toLowerCase(); });

    // Keep these for any remaining references
    const MONTH_SP_FIELDS    = {};
    MONTH_MAP.forEach(function(m){ MONTH_SP_FIELDS[m.display] = m.internal; });
    const MONTH_SP_INTERNAL  = MONTH_MAP.map(function(m){ return m.internal; });
    const SP_INTERNAL_TO_DISPLAY = {};
    MONTH_MAP.forEach(function(m){ SP_INTERNAL_TO_DISPLAY[m.internal] = m.display; });

    // Map SP field name → our row key (lowercase display name e.g. 'jan26')
    const SP_TO_INTERNAL = {
        Title          : 'code',
        ParentCode     : 'parent',
        CustomerName   : 'customer',
        AccountManager : 'am',
        AccountDirector: 'ad',
        ServiceManager : 'sm',
        LineManager    : 'lm',
        Team           : 'team',
        Segment        : 'segment',
    };
    // e.g. '_x004a_an26' → 'jan26'
    Object.entries(MONTH_SP_FIELDS).forEach(function(entry) {
        SP_TO_INTERNAL[entry[1]] = entry[0].toLowerCase();
    });

    // ── State ─────────────────────────────────────────────────
    window.TSM_SE_DATA           = [];
    window.TSM_SE_LOADED         = false;
    window.TSM_SE_LOADING        = false;
    window.TSM_SE_SEGMENT_FILTER = '';

    // ── Excel column map ──────────────────────────────────────
    const COL_MAP = {
        code    : ['title','account code','accountcode','account_code','code'],
        parent  : ['parentcode','parent code','parent_code','l-10','l10'],
        customer: ['customername','customer_name','customer name','customer','name'],
        am      : ['accountmanager','account manager','account_manager','am'],
        ad      : ['accountdirector','account director','account_director','ad'],
        sm      : ['servicemanager','service manager','service_manager','sm'],
        lm      : ['linemanager','line manager','line_manager','lm'],
        team    : ['team'],
        segment : ['segment'],
    };
    // ── FIX 1b: Only map 2026 months in COL_MAP ──
    ['26'].forEach(function(yr) {
        ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].forEach(function(mn) {
            var key = mn + yr;
            COL_MAP[key] = [mn+'_'+yr, mn+'-'+yr,
                mn.charAt(0).toUpperCase()+mn.slice(1)+'_'+yr,
                mn.charAt(0).toUpperCase()+mn.slice(1)+'-'+yr,
                mn.charAt(0).toUpperCase()+mn.slice(1)+' '+yr];
        });
    });

    function normaliseHeader(h) {
        return (h||'').toString().trim().toLowerCase().replace(/[_\-\s]+/g,'').replace(/x002d/g,'');
    }

    function buildHeaderMap(headers) {
        var map = {};
        headers.forEach(function(h, i) {
            var raw = (h || '').toString().trim();
            var norm = normaliseHeader(h), matched = false;
            if (SP_TO_INTERNAL[raw]) {
                map[i] = SP_TO_INTERNAL[raw];
                return;
            }
            for (var field in COL_MAP) {
                var aliases = COL_MAP[field];
                for (var a = 0; a < aliases.length; a++) {
                    if (normaliseHeader(aliases[a]) === norm) { map[i] = field; matched = true; break; }
                }
                if (matched) break;
            }
            if (!matched) map[i] = '__extra__' + raw;
        });
        return map;
    }

    function findExcelHeaderRow(raw) {
        for (var r = 0; r < Math.min(raw.length, 15); r++) {
            var row = raw[r];
            if (!row || !row.length) continue;
            var map = buildHeaderMap(row.map(function(h) { return (h || '').toString(); }));
            var hasCode = false;
            for (var k in map) {
                if (map[k] === 'code') { hasCode = true; break; }
            }
            if (hasCode) return r;
        }
        return 0;
    }

    // ── Parse Excel → array of row objects ───────────────────
    function parseExcelToRows(arrayBuffer) {
        var workbook = XLSX.read(arrayBuffer, { type: 'array' });
        var sheet    = workbook.Sheets[workbook.SheetNames[0]];
        var raw      = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!raw || raw.length < 2) return [];

        var headerRowIdx = findExcelHeaderRow(raw);
        var headers      = raw[headerRowIdx].map(function(h){ return (h||'').toString(); });
        var headerMap    = buildHeaderMap(headers);
        var monthCols    = {};
        headers.forEach(function(_, i) {
            var field = headerMap[i];
            if (field && /^[a-z]{3}26$/.test(field)) monthCols[field] = true;
        });
        var rows = [];

        for (var r = headerRowIdx + 1; r < raw.length; r++) {
            var row = raw[r];
            if (!row || row.every(function(c){ return c===''||c===null||c===undefined; })) continue;

            var obj = {};
            headers.forEach(function(_, i) {
                var field = headerMap[i];
                if (field && !field.startsWith('__extra__')) obj[field] = row[i] !== undefined ? row[i] : '';
            });

            obj.customer = (obj.customer||'').toString().trim();
            obj.code     = (obj.code    ||'').toString().trim();
            obj.parent   = (obj.parent  ||obj.code||'').toString().trim();
            obj.am       = (obj.am      ||'').toString().trim();
            obj.ad       = (obj.ad      ||'').toString().trim();
            obj.sm       = (obj.sm      ||'').toString().trim();
            obj.lm       = (obj.lm      ||'').toString().trim();
            obj.team     = (obj.team    ||'TSM_SE').toString().trim();
            obj.segment  = (obj.segment ||'').toString().trim();

            if (!obj.code) continue;

            obj._monthsInExcel = monthCols;
            ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].forEach(function(mn) {
                var k = mn + '26';
                if (obj[k] !== undefined && obj[k] !== '') {
                    var v = obj[k];
                    obj[k] = typeof v === 'number' ? v : (parseFloat((v+'').replace(/,/g,''))||0);
                } else {
                    delete obj[k];
                }
            });

            // avg from last 3 completed months
            try {
                if (typeof getLastThreeCompletedMonths === 'function') {
                    var last3 = getLastThreeCompletedMonths();
                    obj.avg = last3.map(function(m){ return obj[m.key]||0; }).reduce(function(s,v){ return s+v; },0)/3;
                } else { obj.avg = 0; }
            } catch(e) { obj.avg = 0; }

            rows.push(obj);
        }
        return rows;
    }

    // ── Convert internal row → SP list item ──────────────────
    function rowToSPItem(row) {
        var item = {
            __metadata    : { type: 'SP.Data.TSM_x005f_SE_x005f_AccountsListItem' },
            Title          : row.code,
            ParentCode     : row.parent     || '',
            CustomerName   : row.customer   || '',
            AccountManager : row.am         || '',
            AccountDirector: row.ad         || '',
            ServiceManager : row.sm         || '',
            LineManager    : row.lm         || '',
            Team           : row.team       || 'TSM_SE',
            Segment        : row.segment    || '',
        };
        // Write using OData__ names (EntityPropertyName) — only form SP accepts on POST/MERGE
        var monthKeys = row._monthsInExcel || {};
        MONTH_MAP.forEach(function(m) {
            var key = m.display.toLowerCase();
            if (Object.keys(monthKeys).length && !monthKeys[key]) return;
            if (row[key] !== undefined) item[m.odata] = row[key];
            else if (!Object.keys(monthKeys).length) item[m.odata] = 0;
        });
        return item;
    }

    // ── Convert SP list item → internal row ──────────────────
    function spItemToRow(item) {
        var row = { _source: 'tsm_se', _spId: item.ID };
        // Map known non-month fields
        var knownFields = ['Title','ParentCode','CustomerName','AccountManager',
            'AccountDirector','ServiceManager','LineManager','Team','Segment'];
        var knownMap = {
            Title:'code', ParentCode:'parent', CustomerName:'customer',
            AccountManager:'am', AccountDirector:'ad', ServiceManager:'sm',
            LineManager:'lm', Team:'team', Segment:'segment'
        };
        knownFields.forEach(function(f) {
            row[knownMap[f]] = item[f] !== undefined ? item[f] : '';
        });
        // Read month values — SP returns them as OData__x004a_an26 etc.
        Object.keys(item).forEach(function(spKey) {
            var rowKey = ODATA_TO_ROW[spKey] || INTERNAL_TO_ROW[spKey] || DISPLAY_TO_ROW[spKey];
            if (rowKey) row[rowKey] = item[spKey] || 0;
        });
        row.type          = 'Group';
        row.isApproved    = true;
        row.requestStatus = 'OnBoarded';
        row.requestType   = 'New Account';
        row.isRevDrop     = false;
        row.isRevUpgrade  = false;
        row.pocName       = '';
        row.pocEmail      = '';
        row.pocPhone      = '';
        try {
            if (typeof getLastThreeCompletedMonths === 'function') {
                var last3 = getLastThreeCompletedMonths();
                row.avg = last3.map(function(m){ return row[m.key]||0; }).reduce(function(s,v){ return s+v; },0)/3;
            } else { row.avg = 0; }
        } catch(e) { row.avg = 0; }
        return row;
    }

    // ── Get SP form digest ────────────────────────────────────
    async function getDigest() {
        var res = await fetch(SP_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to get digest');
        return (await res.json()).d.GetContextWebInformation.FormDigestValue;
    }

    // ── Load ALL records with progress spinner ───────────────
    var SLIM_SELECT = [
        'ID','Title','ParentCode','CustomerName',
        'AccountManager','AccountDirector','ServiceManager','LineManager','Team','Segment',
        'OData__x004a_an26','OData__x0046_eb26','OData__x004d_ar26',
        'OData__x0041_pr26','OData__x004d_ay26','OData__x004a_un26',
        'OData__x004a_ul26','OData__x0041_ug26','OData__x0053_ep26',
        'OData__x004f_ct26','OData__x004e_ov26','OData__x0044_ec26'
    ].join(',');

    async function loadFromSPList(onProgress) {
        var allItems = [];
        var url = SP_URL + "/_api/web/lists/getbytitle('" + TSM_LIST + "')/items?" +
            "$select=" + SLIM_SELECT + "&$top=5000&$orderby=ID";

        while (url) {
            var res = await fetch(url, {
                headers: { 'Accept': 'application/json;odata=verbose' },
                credentials: 'include'
            });
            if (!res.ok) {
                var errText = '';
                try {
                    var errData = await res.json();
                    errText = errData.error && errData.error.message ? errData.error.message.value : res.statusText;
                } catch(e) { errText = res.statusText; }
                throw new Error('Failed to load TSM_SE_Accounts: ' + errText);
            }
            var data = await res.json();
            var results = data.d.results || [];
            allItems = allItems.concat(results);

            // Update spinner with live count
            if (onProgress) onProgress(allItems.length);
            updateSpinner(
                'Loading accounts...',
                Math.min(10 + Math.round(allItems.length / 250), 90),
                allItems.length.toLocaleString() + ' accounts loaded...'
            );

            url = data.d.__next || null;
        }

        return allItems.map(spItemToRow);
    }

    // ── Spinner ───────────────────────────────────────────────
    function showSpinner(msg) {
        var el = document.getElementById('tsmSeSpinner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tsmSeSpinner';
            el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;';
            el.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:2rem 2.5rem;box-shadow:var(--ch);display:flex;flex-direction:column;align-items:center;gap:14px;min-width:320px;max-width:420px;width:90%;">'
                + '<div style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--acc);border-radius:50%;animation:spin 0.8s linear infinite;"></div>'
                + '<div style="font-size:.95rem;font-weight:700;color:var(--t1);text-align:center;" id="tsmSeSpinnerMsg">Loading...</div>'
                + '<div style="width:100%;">'
                +   '<div style="display:flex;justify-content:space-between;margin-bottom:5px;">'
                +     '<span style="font-size:.72rem;color:var(--t3);" id="tsmSeSpinnerLabel">Please wait...</span>'
                +     '<span style="font-size:.72rem;font-weight:700;color:var(--acc);" id="tsmSeSpinnerPct"></span>'
                +   '</div>'
                +   '<div style="width:100%;background:var(--bg-secondary);border-radius:20px;height:8px;overflow:hidden;">'
                +     '<div id="tsmSeSpinnerBar" style="height:100%;background:var(--grad);border-radius:20px;width:0%;transition:width .3s;"></div>'
                +   '</div>'
                + '</div>'
                + '<div style="font-size:.78rem;color:var(--t2);font-weight:600;text-align:center;" id="tsmSeSpinnerCount"></div>'
                + '</div>';
            document.body.appendChild(el);
        }
        document.getElementById('tsmSeSpinnerMsg').textContent   = msg || 'Loading TSM SE data...';
        document.getElementById('tsmSeSpinnerLabel').textContent = 'Please wait...';
        document.getElementById('tsmSeSpinnerPct').textContent   = '';
        document.getElementById('tsmSeSpinnerBar').style.width   = '0%';
        document.getElementById('tsmSeSpinnerCount').textContent = '';
        el.style.display = 'flex';
    }

    function updateSpinner(label, pct, count) {
        var lbl = document.getElementById('tsmSeSpinnerLabel');
        var bar = document.getElementById('tsmSeSpinnerBar');
        var pctEl = document.getElementById('tsmSeSpinnerPct');
        var cnt = document.getElementById('tsmSeSpinnerCount');
        if (lbl && label !== undefined) lbl.textContent = label;
        if (bar && pct !== undefined) bar.style.width = pct + '%';
        if (pctEl && pct !== undefined) pctEl.textContent = Math.round(pct) + '%';
        if (cnt && count !== undefined) cnt.textContent = count;
    }

    function hideSpinner() {
        var el = document.getElementById('tsmSeSpinner');
        if (el) el.style.display = 'none';
    }

    // ── Load TSM_SE data (from SP list only) ─────────────────
    async function loadTSMSEData(spinnerMsg, skipSpinner) {
        if (window.TSM_SE_LOADED) return true;
        if (window.TSM_SE_LOADING) {
            await new Promise(function(resolve) {
                var check = setInterval(function() {
                    if (!window.TSM_SE_LOADING) { clearInterval(check); resolve(); }
                }, 200);
            });
            return window.TSM_SE_LOADED;
        }

        window.TSM_SE_LOADING = true;
        if (!skipSpinner) showSpinner(spinnerMsg || 'Loading TSM SE accounts...');

        try {
            updateSpinner('Loading from SharePoint list...', 10, '');

            var rows = await loadFromSPList(function(loaded) {
                var pct = Math.min(10 + Math.round(loaded / 220), 90);
                updateSpinner('Loading accounts...', pct, loaded.toLocaleString() + ' accounts loaded...');
            });

            updateSpinner('Done!', 100, rows.length.toLocaleString() + ' accounts loaded');

            window.TSM_SE_DATA    = rows;
            window.TSM_SE_LOADED  = true;
            window.TSM_SE_LOADING = false;
            console.log('[TSM_SE] Loaded', rows.length, 'rows from SP list');
            return true;
        } catch(err) {
            window.TSM_SE_LOADING = false;
            if (!skipSpinner) hideSpinner();
            console.error('[TSM_SE] Load failed:', err.message);
            return false;
        }
    }

    // ============================================================
    // UPLOAD MODAL
    // ============================================================
    window.tsmSeShowUploadModal = function() {
        var existing = document.getElementById('tsmSeUploadModal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'tsmSeUploadModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;
            padding:1.75rem;width:100%;max-width:520px;box-shadow:var(--ch);position:relative;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad);border-radius:16px 16px 0 0;"></div>

            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;">
                <div style="width:40px;height:40px;border-radius:10px;background:var(--grad);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i data-lucide="upload-cloud" style="width:20px;height:20px;color:#fff;"></i>
                </div>
                <div>
                    <div style="font-size:1rem;font-weight:800;color:var(--t1);">Upload TSM SE Accounts</div>
                    <div style="font-size:.75rem;color:var(--t3);">Upload Excel to SharePoint List — TSM_SE_Accounts</div>
                </div>
                <button type="button" onclick="document.getElementById('tsmSeUploadModal').remove()"
                    style="margin-left:auto;width:28px;height:28px;border-radius:50%;background:var(--bg-input);
                    border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--t1);">
                    <i data-lucide="x" style="width:14px;height:14px;"></i>
                </button>
            </div>

            <!-- Drop zone -->
            <div id="tsmSeDropZone"
                ondragover="event.preventDefault();this.style.borderColor='var(--border-s)'"
                ondragleave="this.style.borderColor='var(--border)'"
                ondrop="tsmSeHandleDrop(event)"
                onclick="document.getElementById('tsmSeFileInput').click()"
                style="border:2px dashed var(--border);border-radius:12px;padding:1.5rem;
                text-align:center;cursor:pointer;transition:border-color .2s;margin-bottom:1rem;">
                <i data-lucide="file-spreadsheet" style="width:32px;height:32px;color:var(--acc);display:block;margin:0 auto .5rem;"></i>
                <div style="font-size:.85rem;font-weight:700;color:var(--t1);margin-bottom:.2rem;">Drop Excel file here or click to browse</div>
                <div style="font-size:.72rem;color:var(--t3);">.xlsx files only</div>
            </div>
            <input type="file" id="tsmSeFileInput" accept=".xlsx" style="display:none;" onchange="tsmSeHandleFileSelect(this)">

            <!-- Upload mode -->
            <div id="tsmSeUploadModeSection" style="display:none;margin-bottom:1rem;">
                <div style="font-size:.75rem;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.6rem;">Upload Mode</div>
                <div style="display:flex;gap:.65rem;">
                    <label style="flex:1;display:flex;align-items:flex-start;gap:.5rem;padding:.75rem;background:var(--bg-secondary);border:2px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color .2s;"
                        id="tsmSeModeSmartLabel">
                        <input type="radio" name="tsmUploadMode" value="smart" checked
                            onchange="tsmSeSelectMode('smart')"
                            style="margin-top:2px;accent-color:var(--acc);">
                        <div>
                            <div style="font-size:.82rem;font-weight:700;color:var(--t1);">Smart Upload</div>
                            <div style="font-size:.7rem;color:var(--t3);">Skip unchanged rows, only update/insert changed ones</div>
                        </div>
                    </label>
                    <label style="flex:1;display:flex;align-items:flex-start;gap:.5rem;padding:.75rem;background:var(--bg-secondary);border:2px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color .2s;"
                        id="tsmSeModeFullLabel">
                        <input type="radio" name="tsmUploadMode" value="full"
                            onchange="tsmSeSelectMode('full')"
                            style="margin-top:2px;accent-color:var(--acc);">
                        <div>
                            <div style="font-size:.82rem;font-weight:700;color:var(--t1);">Full Replace</div>
                            <div style="font-size:.7rem;color:var(--t3);">Delete all existing, insert all rows fresh</div>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Progress -->
            <div id="tsmSeUploadProgressSection" style="display:none;margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                    <span style="font-size:.75rem;font-weight:600;color:var(--t2);" id="tsmSeUploadLabel">Processing...</span>
                    <span style="font-size:.75rem;font-weight:700;color:var(--acc);" id="tsmSeUploadPct">0%</span>
                </div>
                <div style="background:var(--bg-secondary);border-radius:20px;height:8px;overflow:hidden;margin-bottom:.5rem;">
                    <div id="tsmSeUploadBar" style="height:100%;background:var(--grad);border-radius:20px;width:0%;transition:width .2s;"></div>
                </div>
                <div style="font-size:.78rem;color:var(--t2);font-weight:600;text-align:center;" id="tsmSeUploadCount"></div>
            </div>

            <div id="tsmSeUploadMsg" style="min-height:18px;font-size:.8rem;font-weight:600;text-align:center;margin-bottom:.75rem;"></div>

            <div style="display:flex;gap:.65rem;">
                <button type="button" id="tsmSeUploadSubmit" onclick="tsmSeStartUpload()" class="export-btn" style="flex:1;" disabled>
                    <i data-lucide="upload" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Upload
                </button>
                <button type="button" onclick="document.getElementById('tsmSeUploadModal').remove()" class="reset-btn">Cancel</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    window.tsmSeSelectMode = function(mode) {
        var smartLabel = document.getElementById('tsmSeModeSmartLabel');
        var fullLabel  = document.getElementById('tsmSeModeFullLabel');
        if (smartLabel) smartLabel.style.borderColor = mode === 'smart' ? 'var(--border-s)' : 'var(--border)';
        if (fullLabel)  fullLabel.style.borderColor  = mode === 'full'  ? 'var(--border-s)' : 'var(--border)';
    };

    window._tsmSeSelectedFile = null;
    window.tsmSeHandleDrop = function(e) { e.preventDefault(); var f=e.dataTransfer.files[0]; if(f) tsmSeSetFile(f); };
    window.tsmSeHandleFileSelect = function(input) { var f=input.files[0]; if(f) tsmSeSetFile(f); };

    function tsmSeSetFile(file) {
        if (!file.name.endsWith('.xlsx')) { tsmSeSetMsg('Only .xlsx files supported.','#ef4444'); return; }
        window._tsmSeSelectedFile = file;
        var dz  = document.getElementById('tsmSeDropZone');
        var btn = document.getElementById('tsmSeUploadSubmit');
        var ms  = document.getElementById('tsmSeUploadModeSection');
        if (dz) dz.innerHTML = '<i data-lucide="file-check" style="width:28px;height:28px;color:#10b981;display:block;margin:0 auto .4rem;"></i>'
            + '<div style="font-size:.85rem;font-weight:700;color:var(--t1);">'+file.name+'</div>'
            + '<div style="font-size:.72rem;color:var(--t3);">'+(file.size/1048576).toFixed(1)+' MB · Ready</div>';
        if (btn) btn.disabled = false;
        if (ms)  ms.style.display = 'block';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function tsmSeSetMsg(msg, color) {
        var el = document.getElementById('tsmSeUploadMsg');
        if (el) { el.textContent = msg; el.style.color = color || 'var(--t2)'; }
    }

    function tsmSeUpdateProgress(label, pct, count) {
        var sec = document.getElementById('tsmSeUploadProgressSection');
        if (sec) sec.style.display = 'block';
        var lbl = document.getElementById('tsmSeUploadLabel');
        var bar = document.getElementById('tsmSeUploadBar');
        var pctEl = document.getElementById('tsmSeUploadPct');
        var cnt = document.getElementById('tsmSeUploadCount');
        if (lbl) lbl.textContent = label;
        if (bar) bar.style.width = pct + '%';
        if (pctEl) pctEl.textContent = Math.round(pct) + '%';
        if (cnt && count !== undefined) cnt.textContent = count;
    }

    window.tsmSeStartUpload = async function() {
        var file = window._tsmSeSelectedFile;
        if (!file) return;

        var modeEl = document.querySelector('input[name="tsmUploadMode"]:checked');
        var mode   = modeEl ? modeEl.value : 'smart';
        var btn    = document.getElementById('tsmSeUploadSubmit');
        if (btn) btn.disabled = true;

        try {
            // Step 1: Parse Excel
            tsmSeUpdateProgress('Parsing Excel file...', 5, '');
            tsmSeSetMsg('');
            var buf  = await file.arrayBuffer();
            var rows = parseExcelToRows(buf);
            if (!rows.length) throw new Error('No valid rows found. Excel must have a Title (account code) column.');
            tsmSeUpdateProgress('Excel parsed', 10, rows.length.toLocaleString() + ' rows found in Excel');

            // Step 2: Get digest
            var digest = await getDigest();

            if (mode === 'full') {
                await tsmSeFullReplace(rows, digest);
            } else {
                await tsmSeSmartUpload(rows, digest);
            }

            // Reload data from list
            tsmSeSetMsg('✅ Upload complete! Reloading data...', '#10b981');
            window.TSM_SE_DATA    = [];
            window.TSM_SE_LOADED  = false;
            window.TSM_SE_LOADING = false;
            var ok = await loadTSMSEData('Reloading TSM SE data...', true);
            if (ok) {
                var tf = document.getElementById('filterTeam');
                if (tf && tf.value === 'TSM_SE') { tsmSeRenderTSMSEView(); hideSpinner(); }
            }

            tsmSeSetMsg('✅ Done! ' + rows.length.toLocaleString() + ' accounts updated.', '#10b981');
            setTimeout(function() {
                var m = document.getElementById('tsmSeUploadModal');
                if (m) m.remove();
            }, 2000);

        } catch(err) {
            tsmSeSetMsg('Error: ' + err.message, '#ef4444');
            console.error('[TSM_SE Upload]', err);
            if (btn) btn.disabled = false;
        }
    };

    // ── Full Replace ──────────────────────────────────────────
    async function tsmSeFullReplace(rows, digest) {
        tsmSeUpdateProgress('Loading existing items to delete...', 12, '');

        var existingItems = [];
        var delUrl = SP_URL + "/_api/web/lists/getbytitle('" + TSM_LIST + "')/items?$select=ID&$top=5000";
        while (delUrl) {
            var res = await fetch(delUrl, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch existing items');
            var data = await res.json();
            existingItems = existingItems.concat(data.d.results);
            delUrl = data.d.__next || null;
        }

        var total = existingItems.length + rows.length;
        var done  = 0;

        for (var i = 0; i < existingItems.length; i += 50) {
            var batch = existingItems.slice(i, i + 50);
            await Promise.all(batch.map(function(item) {
                return fetch(SP_URL + "/_api/web/lists/getbytitle('" + TSM_LIST + "')/items(" + item.ID + ")", {
                    method: 'POST',
                    headers: { 'Accept': 'application/json;odata=verbose', 'X-RequestDigest': digest, 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' },
                    credentials: 'include'
                });
            }));
            done += batch.length;
            var pct = 15 + Math.round(done / total * 35);
            tsmSeUpdateProgress('Deleting existing items...', pct, done.toLocaleString() + ' deleted of ' + existingItems.length.toLocaleString());
            if (done % 200 === 0) digest = await getDigest();
        }

        await tsmSeInsertRows(rows, digest, done, total, 50, 'Inserting');
    }

    // ── Smart Upload ──────────────────────────────────────────
    async function tsmSeSmartUpload(rows, digest) {
        tsmSeUpdateProgress('Fetching existing list data...', 12, '');

        var existingMap = {};
        // ── FIX: only select columns that exist in the list ──
        // No $select on month columns — let SP return all fields
        var fetchUrl = SP_URL + "/_api/web/lists/getbytitle('" + TSM_LIST + "')/items?" +
            "$top=5000";

        while (fetchUrl) {
            var res = await fetch(fetchUrl, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch existing items');
            var data = await res.json();
            data.d.results.forEach(function(item) { existingMap[item.Title] = item; });
            fetchUrl = data.d.__next || null;
        }

        tsmSeUpdateProgress('Comparing rows...', 20, Object.keys(existingMap).length.toLocaleString() + ' existing items loaded');

        var toInsert = [], toUpdate = [], skipped = 0;

        rows.forEach(function(row) {
            var existing = existingMap[row.code];
            if (!existing) {
                toInsert.push(row);
            } else {
                var changed = false;
                if ((existing.CustomerName||'') !== (row.customer||'')) changed = true;
                if ((existing.ParentCode||'') !== (row.parent||'')) changed = true;
                if ((existing.AccountManager||'') !== (row.am||'')) changed = true;
                if ((existing.AccountDirector||'') !== (row.ad||'')) changed = true;
                if ((existing.ServiceManager||'') !== (row.sm||'')) changed = true;
                if ((existing.LineManager||'') !== (row.lm||'')) changed = true;
                if ((existing.Segment||'') !== (row.segment||'')) changed = true;
                if (!changed) {
                    MONTH_MAP.forEach(function(m) {
                        // SP returns OData__ key in GET responses
                        var existingVal = existing[m.odata] || existing[m.internal] || 0;
                        var rowVal      = row[m.display.toLowerCase()] || 0;
                        if (!changed && existingVal !== rowVal) changed = true;
                    });
                }
                if (changed) { toUpdate.push({ row: row, id: existing.ID }); }
                else { skipped++; }
            }
        });

        tsmSeUpdateProgress('Comparison done', 25,
            toInsert.length + ' to insert · ' + toUpdate.length + ' to update · ' + skipped + ' unchanged (skipped)');
        await new Promise(function(r){ setTimeout(r, 500); });

        var total = toInsert.length + toUpdate.length;
        var done  = 0;

        for (var i = 0; i < toUpdate.length; i += 50) {
            var batch = toUpdate.slice(i, i + 50);
            await Promise.all(batch.map(function(entry) {
                var item = rowToSPItem(entry.row);
                delete item.__metadata;
                item.__metadata = { type: 'SP.Data.TSM_x005f_SE_x005f_AccountsListItem' };
                return fetch(SP_URL + "/_api/web/lists/getbytitle('" + TSM_LIST + "')/items(" + entry.id + ")", {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;odata=verbose',
                        'Content-Type': 'application/json;odata=verbose',
                        'X-RequestDigest': digest, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE'
                    },
                    credentials: 'include',
                    body: JSON.stringify(item)
                });
            }));
            done += batch.length;
            var pct = 25 + Math.round(done / Math.max(total, 1) * 35);
            tsmSeUpdateProgress('Updating changed items...', pct, done + ' of ' + toUpdate.length + ' updated');
            if (done % 200 === 0) digest = await getDigest();
        }

        if (toInsert.length > 0) {
            await tsmSeInsertRows(toInsert, digest, done, total, 60, 'Inserting new');
        } else {
            tsmSeUpdateProgress('Done!', 100, 'No new items to insert');
        }
    }

    // ── Insert rows in batches ────────────────────────────────
    async function tsmSeInsertRows(rows, digest, doneStart, total, startPct, label) {
        var done = doneStart || 0;
        for (var i = 0; i < rows.length; i += 50) {
            var batch = rows.slice(i, i + 50);
            await Promise.all(batch.map(async function(row) {
                var body = rowToSPItem(row);
                var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + TSM_LIST + "')/items", {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;odata=verbose',
                        'Content-Type': 'application/json;odata=verbose',
                        'X-RequestDigest': digest
                    },
                    credentials: 'include',
                    body: JSON.stringify(body)
                });
                if (!res.ok) {
                    var errText = await res.text();
                    throw new Error('Create failed for ' + (body.Title || '?') + ': ' + errText.slice(0, 220));
                }
            }));
            done += batch.length;
            var pct = startPct + Math.round((i + batch.length) / rows.length * (100 - startPct));
            tsmSeUpdateProgress(label + ' items...', Math.min(pct, 99),
                done.toLocaleString() + ' of ' + (total||rows.length).toLocaleString() + ' processed');
            if ((i + 50) % 200 === 0) digest = await getDigest();
        }
    }

    // ── Upload button (admin/owner only) ──────────────────────
    window.tsmSeInjectUploadBtn = function() {
        var email = (window.USER_CONTEXT && window.USER_CONTEXT.userEmail || '').toLowerCase();
        var isAdmin = window.USER_CONTEXT && window.USER_CONTEXT.isAdmin;
        if (!isAdmin && !ADMIN_EMAILS.includes(email)) return;
        if (document.getElementById('tsmSeUploadBtn')) return;

        var headerActions = document.querySelector('#dashboardContent .header .header-actions');
        if (!headerActions) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'tsmSeUploadBtn';
        btn.className = 'reset-btn';
        btn.title = 'Upload TSM SE Accounts';
        btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
        btn.innerHTML = '<i data-lucide="upload" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i><span style="font-size:.78rem;">TSM SE</span>';
        btn.onclick = window.tsmSeShowUploadModal;
        headerActions.insertBefore(btn, headerActions.firstChild);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    // ── Segment dropdown ──────────────────────────────────────
    function injectSegmentContainer() {
        var filtersGrid = document.querySelector('.filters-grid');
        if (!filtersGrid || document.getElementById('tsmSeSegmentChips')) return;
        var div = document.createElement('div');
        div.id = 'tsmSeSegmentChips';
        div.style.display = 'none';
        filtersGrid.appendChild(div);
    }

    window.tsmSeRenderSegmentChips = function() {
        var teamFilter = document.getElementById('filterTeam');
        var container  = document.getElementById('tsmSeSegmentChips');
        if (!container) return;

        var show = (teamFilter && teamFilter.value === 'TSM_SE') ||
                   (window.USER_CONTEXT && window.USER_CONTEXT.role === 'TSM_SE_Viewer');
        if (!show) { container.style.display = 'none'; window.TSM_SE_SEGMENT_FILTER = ''; return; }

        var segments = [];
        var seen = {};
        window.TSM_SE_DATA.forEach(function(r) {
            if (r.segment && !seen[r.segment]) { seen[r.segment] = true; segments.push(r.segment); }
        });
        segments.sort();
        if (!segments.length) { container.style.display = 'none'; return; }

        container.style.display = 'block';
        container.innerHTML = '<div class="filter-group"><label class="filter-label">Segment</label>'
            + '<select class="filter-select" id="tsmSeSegmentSelect" onchange="tsmSeSetSegment(this.value)">'
            + '<option value="">All Segments</option>'
            + segments.map(function(s) {
                return '<option value="'+s+'"'+(window.TSM_SE_SEGMENT_FILTER===s?' selected':'')+'>'+s+'</option>';
            }).join('')
            + '</select></div>';
    };

    window.tsmSeSetSegment = function(seg) {
        window.TSM_SE_SEGMENT_FILTER = seg;
        tsmSeRenderTSMSEView();
    };

    // ── Ensure TSM_SE in team dropdown ───────────────────────
    function ensureTeamDropdown() {
        var ts = document.getElementById('filterTeam');
        if (!ts) return;
        var exists = Array.from(ts.options).some(function(o){ return o.value === 'TSM_SE'; });
        if (!exists) {
            var opt = document.createElement('option');
            opt.value = 'TSM_SE'; opt.textContent = 'TSM_SE';
            ts.appendChild(opt);
        }
    }

    // ── TSM_SE specific AG Grid column definitions ───────────
    function tsmSeGetColumnDefs() {
        var lastThree = typeof getLastThreeCompletedMonths === 'function'
            ? getLastThreeCompletedMonths() : [];
        var cols = [
            { field:'code',     headerName:'Account Code',    filter:'agTextColumnFilter', pinned:'left', width:160, cellStyle:{fontWeight:'700'} },
            { field:'parent',   headerName:'Parent Code',     filter:'agTextColumnFilter', width:140 },
            { field:'customer', headerName:'Customer Name',   filter:'agTextColumnFilter', width:220 },
            { field:'segment',  headerName:'Segment',         filter:'agSetColumnFilter',  width:130 },
            { field:'team',     headerName:'Team',            filter:'agSetColumnFilter',  width:100 },
            { field:'lm',       headerName:'Line Manager',    filter:'agTextColumnFilter', width:160 },
            { field:'sm',       headerName:'Service Manager', filter:'agTextColumnFilter', width:160 },
            { field:'am',       headerName:'Account Manager', filter:'agTextColumnFilter', width:160 },
            { field:'ad',       headerName:'Account Director',filter:'agTextColumnFilter', width:160 },
        ];
        lastThree.forEach(function(m) {
            cols.push({
                field: m.key,
                headerName: m.label,
                filter: 'agNumberColumnFilter',
                width: 130,
                type: 'numericColumn',
                valueFormatter: function(p) {
                    return typeof formatCurrency === 'function' ? formatCurrency(p.value||0) : (p.value||0);
                }
            });
        });
        cols.push({
            field:'avg', headerName:'Avg Revenue',
            filter:'agNumberColumnFilter', width:130, type:'numericColumn',
            valueFormatter: function(p) {
                return typeof formatCurrency === 'function' ? formatCurrency(p.value||0) : (p.value||0);
            },
            cellStyle: { fontWeight:'700' }
        });
        return cols;
    }

    // ── Override renderTable for TSM_SE ──────────────────────
    function tsmSeRenderGrid(data) {
        var gridDiv = document.getElementById('myGrid');
        if (!gridDiv) return;

        if (window.agGridApi) {
            try { window.agGridApi.destroy(); } catch(e) {}
            window.agGridApi = null;
        }
        gridDiv.innerHTML = '';

        var gridOptions = {
            columnDefs: tsmSeGetColumnDefs(),
            rowData: data,
            defaultColDef: { sortable:true, filter:true, resizable:true, minWidth:100 },
            pagination: true,
            paginationPageSize: 100,
            paginationPageSizeSelector: [50,100,200,500],
            rowHeight: 48,
            headerHeight: 50,
            animateRows: true,
            enableCellTextSelection: true,
            onGridReady: function(params) { window.agGridApi = params.api; }
        };

        agGrid.createGrid(gridDiv, gridOptions);
    }

    // ── Render TSM_SE view from TSM_SE_DATA only ─────────────
    function tsmSeRenderTSMSEView() {
        if (!window.TSM_SE_DATA.length) return;

        // Hide RNPS/ETA analytics button — not relevant for TSM_SE
        var analyticsBtn = document.getElementById('loadAnalyticsBtn');
        if (analyticsBtn) analyticsBtn.style.display = 'none';

        var segFilter = window.TSM_SE_SEGMENT_FILTER;
        var lmFilter  = (document.getElementById('filterLM') ||{}).value||'';
        var smFilter  = (document.getElementById('filterSM') ||{}).value||'';

        var data = window.TSM_SE_DATA.filter(function(a) {
            if (segFilter && a.segment !== segFilter) return false;
            if (lmFilter  && a.lm !== lmFilter)       return false;
            if (smFilter  && a.sm !== smFilter)        return false;
            return true;
        });

        window.ALL_FILTERED = data;
        try { window.filtered = data; filtered = data; } catch(e) {}

        // Populate LM/SM dropdowns from TSM_SE_DATA only
        try {
            var lms = [], sms = [], lmSeen = {}, smSeen = {};
            window.TSM_SE_DATA.forEach(function(a) {
                if (a.lm && !lmSeen[a.lm]) { lmSeen[a.lm]=true; lms.push(a.lm); }
                if (a.sm && !smSeen[a.sm]) { smSeen[a.sm]=true; sms.push(a.sm); }
            });
            lms.sort(); sms.sort();
            var lmSel = document.getElementById('filterLM');
            var smSel = document.getElementById('filterSM');
            if (lmSel) {
                var curLM = lmSel.value;
                lmSel.innerHTML = '<option value="">All Line Managers</option>';
                lms.forEach(function(lm) {
                    var o = document.createElement('option');
                    o.value = lm; o.textContent = lm;
                    if (lm === curLM) o.selected = true;
                    lmSel.appendChild(o);
                });
                lmSel.disabled = false;
            }
            if (smSel) {
                var curSM = smSel.value;
                smSel.innerHTML = '<option value="">All Service Managers</option>';
                sms.forEach(function(sm) {
                    var o = document.createElement('option');
                    o.value = sm; o.textContent = sm;
                    if (sm === curSM) o.selected = true;
                    smSel.appendChild(o);
                });
                smSel.disabled = false;
            }
        } catch(e) {}

        // Flag suppresses RNPS/ETA blocks inside renderLineManagers/renderServiceManagers
        window.TSM_SE_ACTIVE = true;

        try { if (typeof updateStats           === 'function') updateStats(); }           catch(e) {}
        try { if (typeof renderLineManagers    === 'function') renderLineManagers(); }    catch(e) {}
        try { if (typeof renderServiceManagers === 'function') renderServiceManagers(); } catch(e) {}
        try { if (typeof renderCharts          === 'function') renderCharts(); }          catch(e) {}
        try { tsmSeRenderGrid(data); } catch(e) { console.warn('[TSM_SE] grid render error:', e); }

        window.TSM_SE_ACTIVE = false;
        tsmSeRenderSegmentChips();
    }

    // ── Team filter hook ──────────────────────────────────────
    function hookTeamFilter() {
        var teamFilter = document.getElementById('filterTeam');
        if (!teamFilter || teamFilter._tsmSeHooked) return;
        teamFilter._tsmSeHooked = true;

        teamFilter.addEventListener('change', async function() {
            tsmSeRenderSegmentChips();

            if (this.value !== 'TSM_SE') {
                // Switching away from TSM_SE — restore analytics button and ALL_DATA
                window.TSM_SE_SEGMENT_FILTER = '';
                var analyticsBtn = document.getElementById('loadAnalyticsBtn');
                if (analyticsBtn) analyticsBtn.style.display = '';
                try { if (typeof populateFilters === 'function') populateFilters(); } catch(e) {}
                try { if (typeof applyFilters    === 'function') applyFilters();    } catch(e) {}
                return;
            }

            if (!window.TSM_SE_LOADED) {
                showSpinner('Loading TSM SE accounts...');
                var ok = await loadTSMSEData(null, true);
                if (!ok) { hideSpinner(); return; }
                ensureTeamDropdown();
                var tf = document.getElementById('filterTeam');
                if (tf) tf.value = 'TSM_SE';
            } else {
                showSpinner('Rendering TSM SE accounts...');
                await new Promise(function(r){ setTimeout(r, 50); });
            }

            tsmSeRenderTSMSEView();
            hideSpinner();
        });
    }

    // ── Account search fallback ───────────────────────────────
    window.tsmSeEnhanceAccountSearch = function() {
        if (window._tsmSeSearchPatched) return;
        window._tsmSeSearchPatched = true;

        var origSearch = window.searchAccount;
        if (typeof origSearch !== 'function') return;

        window.searchAccount = async function() {
            var codeInput  = document.getElementById('searchAccountCode');
            var query      = (codeInput ? codeInput.value.trim() : '');
            var queryLower = query.toLowerCase();

            await origSearch.call(this);

            var detailsSection = document.getElementById('accountDetailsSection');
            if (detailsSection && detailsSection.style.display !== 'none') return;
            if (!query) return;

            if (!window.TSM_SE_LOADED) {
                var errEl = document.getElementById('searchErrorMessage');
                if (errEl) {
                    errEl.style.display = 'block';
                    errEl.style.background = 'rgba(168,85,247,0.08)';
                    errEl.style.borderLeftColor = 'var(--acc)';
                    errEl.innerHTML = '<div style="display:flex;align-items:center;gap:12px;">'
                        + '<div style="width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--acc);border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>'
                        + '<div><div style="font-weight:700;color:var(--acc);">Searching TSM SE accounts...</div>'
                        + '<div style="font-size:12px;color:var(--t3);">Loading from SharePoint list...</div></div>'
                        + '</div>';
                }
                var ok = await loadTSMSEData(null, true);
                if (!ok) return;
            }

            if (!window.TSM_SE_DATA.length) return;

            var match =
                window.TSM_SE_DATA.find(function(r){ return (r.code||'').toLowerCase() === queryLower; }) ||
                window.TSM_SE_DATA.find(function(r){ return (r.customer||'').toLowerCase().includes(queryLower); });

            if (!match) {
                var errEl2 = document.getElementById('searchErrorMessage');
                if (errEl2) {
                    errEl2.style.display = 'block';
                    errEl2.style.background = 'rgba(239,68,68,0.1)';
                    errEl2.style.borderLeftColor = '#ef4444';
                    errEl2.innerHTML = '<div style="display:flex;align-items:center;gap:12px;">'
                        + '<i data-lucide="alert-circle" style="width:20px;height:20px;color:#ef4444;"></i>'
                        + '<div><div style="font-weight:700;color:#ef4444;margin-bottom:4px;">Account Not Found</div>'
                        + '<div style="font-size:13px;color:var(--t3);">Not found in main list or TSM SE accounts.</div></div>'
                        + '</div>';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
                return;
            }

            var errEl3 = document.getElementById('searchErrorMessage');
            if (errEl3) errEl3.style.display = 'none';
            tsmSeDisplayAccountDetails(match);
        };
    };

    function tsmSeDisplayAccountDetails(account) {
        var last3 = typeof getLastThreeCompletedMonths === 'function' ? getLastThreeCompletedMonths() : [];
        var fields = [
            ['Account Code',     account.code],
            ['Parent Code',      account.parent   || 'N/A'],
            ['Customer Name',    account.customer],
            ['Team',             account.team],
            ['Segment',          account.segment  || 'N/A'],
            ['Line Manager',     account.lm       || 'N/A'],
            ['Service Manager',  account.sm       || 'N/A'],
            ['Account Manager',  account.am       || 'N/A'],
            ['Account Director', account.ad       || 'N/A'],
            ['Data Source',      '<span style="color:var(--acc);font-weight:700;">TSM SE List</span>'],
        ];
        last3.forEach(function(m) {
            if (account[m.key] !== undefined)
                fields.push([m.label + ' Revenue', typeof formatCurrency === 'function' ? formatCurrency(account[m.key]) : account[m.key]]);
        });
        var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">';
        fields.forEach(function(f) {
            html += '<div style="padding:12px;background:rgba(168,85,247,0.1);border-radius:8px;">'
                + '<div style="font-size:11px;color:var(--t3);margin-bottom:4px;font-weight:600;">'+f[0]+'</div>'
                + '<div style="font-size:14px;font-weight:600;">'+f[1]+'</div></div>';
        });
        html += '</div>';
        var contentEl = document.getElementById('accountDetailsContent');
        var sectionEl = document.getElementById('accountDetailsSection');
        if (contentEl) contentEl.innerHTML = html;
        if (sectionEl) sectionEl.style.display = 'block';
        var relatedEl = document.getElementById('relatedAccountsSection');
        if (relatedEl) relatedEl.style.display = 'none';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ── applyFilters patch for segment ────────────────────────
    window.tsmSePatchApplyFilters = function() {
        if (window._tsmSeFilterPatched) return;
        var orig = window.applyFilters;
        if (typeof orig !== 'function') return;
        window._tsmSeFilterPatched = true;
        window.applyFilters = function() {
            var teamFilter = document.getElementById('filterTeam');
            // ── FIX 3b: If TSM_SE is selected, don't let applyFilters touch ALL_DATA ──
            if (teamFilter && teamFilter.value === 'TSM_SE') {
                tsmSeRenderTSMSEView();
                tsmSeRenderSegmentChips();
                return;
            }
            orig.call(this);
            tsmSeRenderSegmentChips();
        };
    };

    // ── Viewer restrictions ───────────────────────────────────
    window.tsmSeApplyViewerRestrictions = function() {
        if (!window.USER_CONTEXT || window.USER_CONTEXT.role !== 'TSM_SE_Viewer') return;
        var allowedSections = ['dashboard-view','suggestionsView','processDocsView','contactUsView','eta-view','pm-view'];
        var allowedLabels   = ['Newsletter','Dashboard','Events / TT / Activity','Project Management','Suggestion Box','Process Documents','Contact Us'];
        document.querySelectorAll('.nav-item').forEach(function(item) {
            var section = item.getAttribute('data-section');
            var label   = ((item.querySelector('.nav-label')||{}).textContent||'').trim();
            if (!allowedSections.includes(section) && !allowedLabels.includes(label)) item.style.display = 'none';
        });
        document.querySelectorAll('.nav-section-label').forEach(function(lbl) {
            var next = lbl.nextElementSibling, hasVisible = false;
            while (next && !next.classList.contains('nav-section-label')) {
                if (next.classList.contains('nav-item') && next.style.display !== 'none') { hasVisible=true; break; }
                next = next.nextElementSibling;
            }
            if (!hasVisible) lbl.style.display = 'none';
        });
    };

    // ── Main Init ─────────────────────────────────────────────
    window.tsmSeInit = async function() {
        var role = window.USER_CONTEXT ? window.USER_CONTEXT.role : '';
        var needsSetup = ['Admin','TSM_SE_Viewer','TSM Manager','Line Manager','Service Manager'].includes(role);
        if (!needsSetup) return;

        injectSegmentContainer();
        hookTeamFilter();
        window.tsmSeInjectUploadBtn();
        window.tsmSePatchApplyFilters();
        window.tsmSeEnhanceAccountSearch();

        if (role === 'TSM_SE_Viewer') {
            var ok = await loadTSMSEData('Loading TSM SE Dashboard...');
            if (ok) {
                window.tsmSeApplyViewerRestrictions();
                ensureTeamDropdown();
                tsmSeRenderTSMSEView();
                hideSpinner();
            }
        }
    };

    window.tsmSeRenderTable = tsmSeRenderTSMSEView;

    console.log('[TSM_SE] Module loaded - SP List mode (2026 months only)');
})();
