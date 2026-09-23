// tsm-se-account-search.js — TSM SE account lookup for Account_Search_Viewer
// Load AFTER tsm-se.js and sm24aug.html inline helpers (smFindAccountInTsmSeRows, smMapTsmSeRowToSearchAccount, SP_URL)
(function () {
    'use strict';

    var SM_TSM_SE_MIN_ROWS = 15000;
    var SM_TSM_SE_CANDIDATE_LISTS = [
        'Service Manager Request SE',
        'TSM SE Request',
        'TSM_SE_Request',
        'TSM SE Accounts',
        'TSM_SE_Accounts',
        'TSM SE MailBox',
        'Undedicated Accounts'
    ];

    function normCode(code) {
        return String(code == null ? '' : code).trim();
    }

    function countGridRows() {
        var count = 0;
        var api = window.tsmSeGridApi;
        if (api && typeof api.forEachNode === 'function') {
            try { api.forEachNode(function () { count++; }); } catch (e) {}
        }
        return count;
    }

    function extractGridRows() {
        var rows = [];
        var api = window.tsmSeGridApi;
        if (api && typeof api.forEachNode === 'function') {
            try {
                api.forEachNode(function (node) {
                    if (node && node.data) rows.push(node.data);
                });
            } catch (e) {}
        }
        return rows;
    }

    function scanWindowArrays() {
        var best = [];
        try {
            Object.keys(window).forEach(function (k) {
                if (!/tsm|TSM|SE/i.test(k)) return;
                var v = window[k];
                if (Array.isArray(v) && v.length > best.length) best = v;
            });
        } catch (e) {}
        return best;
    }

    function collectModuleRows() {
        var rows = [];
        var seen = {};
        function add(arr) {
            if (!Array.isArray(arr) || !arr.length) return;
            arr.forEach(function (row) {
                if (!row) return;
                var key = normCode(row.code || row.accountCode || row.Title || row.account || row.Account_Code || row['Account Code']);
                if (!key || seen[key]) return;
                seen[key] = true;
                rows.push(row);
            });
        }
        ['tsmSeAllData', 'tsmSeRows', 'TSM_SE_ROWS', 'tsmSeData', 'tsmSeAccounts', 'tsmSeAllRows', 'tsmSeFilteredData'].forEach(function (k) {
            add(window[k]);
        });
        ['tsmSeGetAllRows', 'tsmSeGetRows', 'tsmSeGetData', 'tsmSeGetAccounts'].forEach(function (fnName) {
            if (typeof window[fnName] !== 'function') return;
            try { add(window[fnName]()); } catch (e) {}
        });
        add(extractGridRows());
        add(scanWindowArrays());
        try {
            ['tsm_se_data', 'sm_tsm_se_data', 'TSM_SE_DATA', 'tsmSeExcelData', 'tsm_se_excel_v1', 'tsmSe_cache'].forEach(function (key) {
                var raw = localStorage.getItem(key);
                if (!raw) return;
                var parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) add(parsed);
                else if (parsed && Array.isArray(parsed.rows)) add(parsed.rows);
                else if (parsed && Array.isArray(parsed.data)) add(parsed.data);
                else if (parsed && Array.isArray(parsed.accounts)) add(parsed.accounts);
            });
        } catch (e) {}
        return rows;
    }

    function moduleRowCount() {
        return Math.max(collectModuleRows().length, countGridRows());
    }

    async function getListItemCount(listName) {
        if (!listName || !window.SP_URL) return 0;
        try {
            var url = window.SP_URL + "/_api/web/lists/getbytitle('" + String(listName).replace(/'/g, "''") + "')?$select=ItemCount";
            var res = await fetch(url, {
                headers: { 'Accept': 'application/json;odata=verbose' },
                credentials: 'include'
            });
            if (!res.ok) return 0;
            var data = await res.json();
            return (data.d && data.d.ItemCount) ? data.d.ItemCount : 0;
        } catch (e) {
            return 0;
        }
    }

    async function discoverTsmSeListName() {
        if (window._smTsmSeListName) return window._smTsmSeListName;
        var candidates = [];
        [window.TSM_SE_LIST, window.TSM_SE_SP_LIST, window.TSMSE_LIST, window.TSM_SE_SP_LIST_NAME].forEach(function (n) {
            if (n && candidates.indexOf(n) < 0) candidates.push(n);
        });
        SM_TSM_SE_CANDIDATE_LISTS.forEach(function (n) {
            if (candidates.indexOf(n) < 0) candidates.push(n);
        });

        var bestName = null;
        var bestCount = 0;
        for (var i = 0; i < candidates.length; i++) {
            var count = await getListItemCount(candidates[i]);
            if (count > bestCount) {
                bestCount = count;
                bestName = candidates[i];
            }
        }
        if (bestName && bestCount >= 5000) {
            window._smTsmSeListName = bestName;
            console.log('[TSM SE Search] SharePoint list discovered:', bestName, '(' + bestCount + ' items)');
        }
        return window._smTsmSeListName || null;
    }

    function findInRows(rows, accountCode) {
        if (typeof window.smFindAccountInTsmSeRows === 'function') {
            return window.smFindAccountInTsmSeRows(rows, accountCode);
        }
        var want = normCode(accountCode);
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            if (!r) continue;
            var codes = [r.code, r.accountCode, r.Title, r.account, r.Account_Code, r['Account Code'], r.parent, r.parentCode, r.Parent_x0020_Code];
            for (var j = 0; j < codes.length; j++) {
                if (normCode(codes[j]) === want) return r;
            }
        }
        return null;
    }

    function mapRow(row, accountCode) {
        if (typeof window.smMapTsmSeRowToSearchAccount === 'function') {
            return window.smMapTsmSeRowToSearchAccount(row, accountCode);
        }
        return row;
    }

    async function fetchFromSharePoint(accountCode) {
        if (!window.SP_URL) return null;
        await discoverTsmSeListName();

        var escape = window.smODataEscapeLiteral || function (v) {
            return String(v == null ? '' : v).replace(/'/g, "''");
        };
        var safeCode = escape(accountCode);
        var canPoc = typeof window.smCanViewAccountSearchPocDetails === 'function' && window.smCanViewAccountSearchPocDetails();
        var pocFields = canPoc
            ? ',POC_x0020_Name,POC_x0020_Email_x0020_ID,POC_x0020_Contact_x0020_No,' +
              'Secondary_x0020_POC_x0020_Name,Secondary_x0020_POC_x0020_Email,Secondary_x0020_POC_x0020_Contac,' +
              'Technical_x0020_POC_x0020_Name,Technical_x0020_POC_x0020_Email,Technical_x0020_POC_x0020_Contac'
            : '';
        var selectFields = 'Title,Parent_x0020_Code,Customer_x0020_Name,Team,' +
            'Line_x0020_Manager/Title,Service_x0020_Manager/Title,' +
            'Secondary_x0020_Service_x0020_Ma/Title,' +
            'Account_x0020_Manager/Title,Account_x0020_Director/Title,' +
            'Service_x0020_Director/Title,Jan_x002d_26' + pocFields;
        var expandFields = 'Line_x0020_Manager,Service_x0020_Manager,' +
            'Secondary_x0020_Service_x0020_Ma,Account_x0020_Manager,' +
            'Account_x0020_Director,Service_x0020_Director';

        var listNames = [];
        if (window._smTsmSeListName) listNames.push(window._smTsmSeListName);
        [window.TSM_SE_LIST, window.TSM_SE_SP_LIST, window.TSMSE_LIST].forEach(function (n) {
            if (n && listNames.indexOf(n) < 0) listNames.push(n);
        });
        SM_TSM_SE_CANDIDATE_LISTS.forEach(function (n) {
            if (listNames.indexOf(n) < 0) listNames.push(n);
        });

        var filters = ["Title eq '" + safeCode + "'", "Parent_x0020_Code eq '" + safeCode + "'"];

        for (var li = 0; li < listNames.length; li++) {
            var listName = listNames[li];
            for (var fi = 0; fi < filters.length; fi++) {
                try {
                    var url = window.SP_URL + "/_api/web/lists/getbytitle('" + listName.replace(/'/g, "''") + "')/items?" +
                        '$select=' + selectFields + '&' +
                        '$expand=' + expandFields + '&' +
                        '$filter=' + filters[fi] + '&' +
                        '$top=1';
                    var res = await fetch(url, {
                        headers: { 'Accept': 'application/json;odata=verbose' },
                        credentials: 'include'
                    });
                    if (!res.ok) continue;
                    var data = await res.json();
                    if (data.d.results && data.d.results.length) {
                        var hit = data.d.results[0];
                        hit.Team = hit.Team || 'TSM_SE';
                        hit._tsmSeSource = true;
                        console.log('[TSM SE Search] Found via list', listName, ':', accountCode);
                        return hit;
                    }
                } catch (e) {
                    console.warn('[TSM SE Search] List query failed:', listName, e);
                }
            }
        }
        return null;
    }

    var warmPromise = null;

    async function warmFullDataset() {
        if (window._smTsmSeSearchCache && window._smTsmSeSearchCache.length >= SM_TSM_SE_MIN_ROWS) {
            return window._smTsmSeSearchCache;
        }
        if (warmPromise) return warmPromise;

        warmPromise = (async function () {
            console.log('[TSM SE Search] Warming full dataset (target ~22k rows, not SM Request ~2k)...');

            if (typeof window.tsmSeInit === 'function') {
                try {
                    var initR = window.tsmSeInit();
                    if (initR && typeof initR.then === 'function') await initR;
                } catch (e) {}
            }

            ['tsmSeLoadData', 'tsmSeFetchData', 'tsmSeLoad', 'tsmSeEnsureData'].forEach(function (name) {
                if (typeof window[name] !== 'function') return;
                try {
                    var r = window[name]();
                    if (r && typeof r.then === 'function') return r;
                } catch (e) {}
            });

            if ((!window.ALL_DATA || !window.ALL_DATA.length) && typeof window.fetchData === 'function' && !window.LOCAL_DEV_MODE) {
                try {
                    window.ALL_DATA = await window.fetchData();
                } catch (e) {}
            }

            var teamEl = document.getElementById('filterTeam');
            if (teamEl) {
                window.TSM_SE_ACTIVE = true;
                teamEl.value = 'TSM_SE';
                try {
                    teamEl.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (e) {
                    if (typeof window.onTeamFilterChanged === 'function') window.onTeamFilterChanged();
                }
            } else {
                window.TSM_SE_ACTIVE = true;
                if (typeof window.applyFilters === 'function') window.applyFilters();
            }

            var lastCount = 0;
            var stable = 0;
            for (var attempt = 0; attempt < 120; attempt++) {
                if (typeof window.tsmSeRenderTable === 'function' && (attempt === 2 || attempt % 15 === 0)) {
                    try { window.tsmSeRenderTable(); } catch (e) {}
                }
                var rowCount = moduleRowCount();
                if (rowCount >= SM_TSM_SE_MIN_ROWS) {
                    var rows = collectModuleRows();
                    window._smTsmSeSearchCache = rows;
                    console.log('[TSM SE Search] Full dataset ready:', rows.length, 'accounts');
                    await discoverTsmSeListName();
                    return rows;
                }
                if (rowCount > 0 && rowCount === lastCount) stable++;
                else { stable = 0; lastCount = rowCount; }
                if (stable >= 8 && rowCount > 0 && rowCount < SM_TSM_SE_MIN_ROWS) {
                    console.warn('[TSM SE Search] Module stopped at', rowCount, 'rows — using SharePoint lookup per search');
                    await discoverTsmSeListName();
                    break;
                }
                if (attempt % 8 === 0 && rowCount > 0) {
                    console.log('[TSM SE Search] Loading...', rowCount, 'rows');
                }
                await new Promise(function (r) { setTimeout(r, 500); });
            }
            await discoverTsmSeListName();
            return collectModuleRows();
        })();

        try {
            return await warmPromise;
        } catch (e) {
            warmPromise = null;
            throw e;
        }
    }

    async function lookupAccount(accountCode) {
        var spHit = await fetchFromSharePoint(accountCode);
        if (spHit) return spHit;

        await warmFullDataset();

        var rows = collectModuleRows();
        var hit = findInRows(rows, accountCode);
        if (hit) return mapRow(hit, accountCode);

        return fetchFromSharePoint(accountCode);
    }

    window.tsmSeFindAccountForSearch = function (accountCode) {
        return lookupAccount(accountCode);
    };
    window.smTsmSeSearchAccount = lookupAccount;
    window.smTsmSeWarmFullDataset = warmFullDataset;
    window.smTsmSeDiscoverListName = discoverTsmSeListName;
    window.smTsmSeCollectModuleRows = collectModuleRows;

    console.log('[TSM SE Search] Bridge loaded — SP lookup + full module warm (~22k rows)');

    function hookTsmSeRenderTable() {
        if (window._smTsmSeRenderHooked || typeof window.tsmSeRenderTable !== 'function') return;
        window._smTsmSeRenderHooked = true;
        var origRender = window.tsmSeRenderTable;
        window.tsmSeRenderTable = function () {
            var result = origRender.apply(this, arguments);
            setTimeout(function () {
                var rows = collectModuleRows();
                if (rows.length >= SM_TSM_SE_MIN_ROWS) {
                    window._smTsmSeSearchCache = rows;
                    console.log('[TSM SE Search] Grid hook captured', rows.length, 'accounts');
                }
            }, 1500);
            return result;
        };
    }

    if (typeof window.tsmSeRenderTable === 'function') hookTsmSeRenderTable();
    else {
        var hookAttempts = 0;
        var hookTimer = setInterval(function () {
            hookAttempts++;
            if (typeof window.tsmSeRenderTable === 'function') {
                clearInterval(hookTimer);
                hookTsmSeRenderTable();
            } else if (hookAttempts > 40) clearInterval(hookTimer);
        }, 250);
    }
})();
