// ============================================================
// rnps.js — Relationship NPS Dashboard v6
// Trend charts (like revenue chart), QoQ, YoY toggle,
// DSM/TSM separate, enriched leaderboard with history
// ============================================================

var RNPS_SCORES_LIST = 'RNPSScores';
var RNPS_SM_LIST     = 'Service Manager Request';

var rnpsScores     = [];
var rnpsAllSP      = [];
var rnpsCharts     = {};
var rnpsCurrentTab = 'dashboard';

// Chart state
var rnpsChartTeam    = 'DSM';   // DSM | TSM
var rnpsChartMetric  = 'RNPS';  // RNPS | ResponseRate
var rnpsChartView    = 'trend'; // trend | qoq | yoy

// Leaderboard state
var rnpsLBTeam   = '';
var rnpsLBStatus = '';
var rnpsLBSearch = '';

// ── Role helpers (access matrix — same as main dashboard / QA) ─
function rnpsNorm(n)     { return (n || '').toLowerCase().replace(/\s+/g,' ').trim(); }
function rnpsGetRole()   { return (window.USER_CONTEXT && USER_CONTEXT.role) || ''; }
function rnpsGetUser()   { return (window.USER_CONTEXT && USER_CONTEXT.userName) || ''; }

// Full org view: Admin, Service Director, Auditor, Read Only
function rnpsCanSeeAllData() {
    var role = rnpsGetRole();
    return !!(window.USER_CONTEXT && USER_CONTEXT.isAdmin) ||
        role === 'Service Director' || role === 'Auditor' || role === 'Read Only';
}

// Upload tab: Admin + Service Director only
function rnpsCanUpload() {
    return !!(window.USER_CONTEXT && USER_CONTEXT.isAdmin) || rnpsGetRole() === 'Service Director';
}

// Scope RNPS rows to what the current user is allowed to see
function rnpsApplyScope(rows) {
    if (!rows || !rows.length) return [];
    if (rnpsCanSeeAllData()) return rows.slice();
    var role = rnpsGetRole();
    var user = rnpsNorm(rnpsGetUser());
    if (role === 'Service Manager') {
        return rows.filter(function(r) { return rnpsNorm(r.ServiceManager) === user; });
    }
    if (role === 'Line Manager') {
        return rows.filter(function(r) { return rnpsNorm(r.LineManager) === user; });
    }
    if ((window.USER_CONTEXT && USER_CONTEXT.isTSMManager) || role === 'TSM Manager' || role === 'TSM_SE_Viewer') {
        return rows.filter(function(r) { return r.Team === 'TSM'; });
    }
    return [];
}

function rnpsGetVisibleScores() { return rnpsApplyScope(rnpsScores); }

function rnpsScopeLabel() {
    var role = rnpsGetRole();
    if (rnpsCanSeeAllData()) return '';
    if (role === 'Service Manager') return 'Your RNPS report';
    if (role === 'Line Manager') return 'Your team\u2019s RNPS reports';
    if ((window.USER_CONTEXT && USER_CONTEXT.isTSMManager) || role === 'TSM Manager' || role === 'TSM_SE_Viewer') return 'TSM team RNPS reports';
    return 'No RNPS access for your role';
}

// ── Entry Point ───────────────────────────────────────────────
window.rnpsInit = async function() {
    var wrap = document.getElementById('rnpsContainer');
    if (!wrap) return;
    wrap.innerHTML = '<div style="text-align:center;padding:60px;"><i data-lucide="loader-2" style="width:40px;height:40px;animation:spin 1s linear infinite;color:var(--acc);display:inline-block;"></i><div style="margin-top:12px;font-weight:600;color:var(--t2);">Loading RNPS...</div></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    await rnpsFetchScores();
    await rnpsFetchSPNames();
    rnpsRenderShell();
};

// ── Fetch ─────────────────────────────────────────────────────
async function rnpsFetchScores() {
    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + RNPS_SCORES_LIST + "')/items?" +
            "$select=ID,Title,Period,Team,LineManager,ServiceManager,RowType," +
            "TotalContacts,Responded,ResponseRate,RNPS,RNPSTarget,ResponseTarget,UploadedBy,UploadedOn" +
            "&$orderby=Created desc&$top=5000";
        var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!res.ok) { rnpsScores = []; return; }
        rnpsScores = (await res.json()).d.results || [];
    } catch(e) { rnpsScores = []; }
}

async function rnpsFetchSPNames() {
    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + RNPS_SM_LIST + "')/items?" +
            "$select=Line_x0020_Manager/Title,Service_x0020_Manager/Title,Team" +
            "&$expand=Line_x0020_Manager,Service_x0020_Manager" +
            "&$filter=Request_x0020_Status eq 'OnBoarded'&$top=5000";
        var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!res.ok) { rnpsAllSP = []; return; }
        var rows = (await res.json()).d.results || [];
        var seen = {}; rnpsAllSP = [];
        var smToLM = {};
        rows.forEach(function(r) {
            var sm = r.Service_x0020_Manager ? r.Service_x0020_Manager.Title : '';
            var lm = r.Line_x0020_Manager    ? r.Line_x0020_Manager.Title    : '';
            if (sm && lm) smToLM[rnpsNorm(sm)] = lm;
        });
        rows.forEach(function(r) {
            var lm = r.Line_x0020_Manager    ? r.Line_x0020_Manager.Title    : '';
            var sm = r.Service_x0020_Manager ? r.Service_x0020_Manager.Title : '';
            var t  = r.Team || '';
            if (lm && !seen['LM|'+lm]) { seen['LM|'+lm]=true; rnpsAllSP.push({name:lm, role:'LM', lm:'', team:t}); }
            if (sm && !seen['SM|'+sm]) { seen['SM|'+sm]=true; rnpsAllSP.push({name:sm, role:'SM', lm:smToLM[rnpsNorm(sm)]||'', team:t}); }
        });
        try {
            var acUrl = SP_URL + "/_api/web/lists/getbytitle('Access_Control')/items?$select=Title,Role&$filter=Role eq 'Service Director'&$top=100";
            var acRes = await fetch(acUrl, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
            if (acRes.ok) {
                ((await acRes.json()).d.results || []).forEach(function(r) {
                    var name = r.Title || '';
                    if (name && !seen['SD|'+name]) { seen['SD|'+name]=true; rnpsAllSP.push({name:name, role:'SD', lm:'', team:''}); }
                });
            }
        } catch(e2) {}
    } catch(e) { rnpsAllSP = []; }
}

// ── Period helpers ────────────────────────────────────────────
function rnpsParsePeriod(p) {
    var m = (p || '').match(/Q(\d)-(\d{4})/);
    return m ? { q: parseInt(m[1]), year: parseInt(m[2]) } : { q:0, year:0 };
}
function rnpsGetPeriods() {
    return [...new Set(rnpsGetVisibleScores().map(function(r){ return r.Period; }))].filter(Boolean).sort(function(a,b){
        var pa=rnpsParsePeriod(a), pb=rnpsParsePeriod(b);
        return pb.year!==pa.year ? pb.year-pa.year : pb.q-pa.q;
    });
}
function rnpsGeneratePeriodOptions() {
    var y = new Date().getFullYear(); var opts = [];
    for (var yr=y+1; yr>=y-1; yr--) for (var q=4; q>=1; q--) opts.push('Q'+q+'-'+yr);
    return opts;
}
function rnpsGetSMScores(f) {
    f = f || {};
    var d = rnpsGetVisibleScores().filter(function(r){ return r.RowType === 'SM'; });
    if (f.period) d = d.filter(function(r){ return r.Period === f.period; });
    if (f.team)   d = d.filter(function(r){ return r.Team   === f.team;   });
    return d;
}
function rnpsAvg(period, team, key) {
    var rows = rnpsGetVisibleScores().filter(function(r){ return r.RowType==='SM' && r.Period===period && (!team || r.Team===team); });
    if (!rows.length) return null;
    return Math.round(rows.reduce(function(s,r){ return s+(r[key]||0); },0) / rows.length);
}

// ── Chart helpers ─────────────────────────────────────────────
function rnpsDC(id) { if (rnpsCharts[id]) { try { rnpsCharts[id].destroy(); } catch(e){} delete rnpsCharts[id]; } }
function rnpsCC() {
    var t = document.body.getAttribute('data-theme') || '';
    var d = t==='dark'||t==='duralux-dark';
    return { text: d?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.5)', grid: d?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)' };
}

// ── Shell ─────────────────────────────────────────────────────
function rnpsRenderShell() {
    var wrap = document.getElementById('rnpsContainer'); if (!wrap) return;
    var periods = rnpsGetPeriods();
    var canUpload = rnpsCanUpload();
    var scopeLbl = rnpsScopeLabel();
    var visibleSmCount = rnpsGetVisibleScores().filter(function(r){ return r.RowType==='SM'; }).length;

    wrap.innerHTML =
        '<div style="background:var(--grad);border-radius:16px;padding:1.5rem 2rem;margin-bottom:1.5rem;color:#fff;display:flex;align-items:center;gap:1rem;">' +
        '<div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="star" style="width:24px;height:24px;color:#fff;"></i></div>' +
        '<div style="flex:1;"><div style="font-size:1.15rem;font-weight:800;">Relationship NPS Dashboard</div>' +
        '<div style="font-size:.8rem;opacity:.8;">'+(scopeLbl || 'Service Manager Performance · Quarter Tracking')+'</div></div>' +
        '<div style="text-align:right;flex-shrink:0;"><div style="font-size:.68rem;opacity:.7;">Latest Period</div>' +
        '<div style="font-size:1rem;font-weight:800;">'+(periods[0]||'No data yet')+'</div>' +
        '<div style="font-size:.68rem;opacity:.65;">'+visibleSmCount+' SM record'+(visibleSmCount===1?'':'s')+'</div></div></div>' +

        '<div style="display:flex;gap:8px;margin-bottom:1.25rem;">' +
        '<button type="button" id="rnpsTab_dashboard" onclick="rnpsSetTab(\'dashboard\')" style="padding:9px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:none;background:var(--grad);color:#fff;box-shadow:0 2px 10px var(--glow);"><i data-lucide="layout-dashboard" style="width:14px;height:14px;"></i>Dashboard</button>' +
        (canUpload ? '<button type="button" id="rnpsTab_upload" onclick="rnpsSetTab(\'upload\')" style="padding:9px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);"><i data-lucide="upload-cloud" style="width:14px;height:14px;"></i>Upload</button>' : '') +
        '</div>' +

        '<div id="rnpsFilterBar" style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.8rem 1rem;margin-bottom:1.25rem;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">' +
        '<div class="filter-group" style="min-width:140px;"><label class="filter-label">Period</label><select class="filter-select" id="rnpsFP" onchange="rnpsApplyFilters()" style="font-size:13px;padding:8px;"><option value="">All Periods</option>' +
        periods.map(function(p){return '<option value="'+p+'">'+p+'</option>';}).join('') + '</select></div>' +
        '<div class="filter-group" style="min-width:110px;"><label class="filter-label">Team</label><select class="filter-select" id="rnpsFT" onchange="rnpsApplyFilters()" style="font-size:13px;padding:8px;"><option value="">All Teams</option><option value="DSM">DSM</option><option value="TSM">TSM</option></select></div>' +
        '<button type="button" class="reset-btn" onclick="rnpsResetFilters()" style="padding:8px 14px;font-size:12px;align-self:flex-end;"><i data-lucide="rotate-ccw" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Reset</button>' +
        '</div>' +

        '<div id="rnpsTab_dashboard_sec"></div>' +
        (canUpload ? '<div id="rnpsTab_upload_sec" style="display:none;"></div>' : '');

    if (typeof lucide !== 'undefined') lucide.createIcons();
    rnpsRenderDashboard();
    if (canUpload) {
        var us = document.getElementById('rnpsTab_upload_sec');
        if (us) { us.innerHTML = rnpsUploadHTML(); rnpsRenderUploadHistory(); }
    }
}

window.rnpsSetTab = function(tab) {
    rnpsCurrentTab = tab;
    ['dashboard','upload'].forEach(function(t) {
        var btn = document.getElementById('rnpsTab_' + t);
        var sec = document.getElementById('rnpsTab_' + t + '_sec');
        if (btn) { btn.style.background=t===tab?'var(--grad)':'var(--bg-input)'; btn.style.color=t===tab?'#fff':'var(--t1)'; btn.style.border=t===tab?'none':'1px solid var(--border)'; btn.style.boxShadow=t===tab?'0 2px 10px var(--glow)':'none'; }
        if (sec) sec.style.display = t===tab?'block':'none';
    });
    var fb = document.getElementById('rnpsFilterBar');
    if (fb) fb.style.display = tab==='upload' ? 'none' : 'flex';
    if (tab==='dashboard') rnpsRenderDashboard();
    if (tab==='upload') rnpsRenderUploadHistory();
};

window.rnpsApplyFilters = function() { rnpsRenderDashboard(); };
window.rnpsResetFilters = function() {
    ['rnpsFP','rnpsFT'].forEach(function(id){var el=document.getElementById(id);if(el)el.selectedIndex=0;});
    rnpsRenderDashboard();
};
function rnpsGetF() {
    return { period:(document.getElementById('rnpsFP')||{}).value||'', team:(document.getElementById('rnpsFT')||{}).value||'' };
}

// ── Dashboard ─────────────────────────────────────────────────
function rnpsRenderDashboard() {
    var sec = document.getElementById('rnpsTab_dashboard_sec'); if (!sec) return;
    var f = rnpsGetF();
    var smRows = rnpsGetSMScores(f);
    var periods = rnpsGetPeriods();

    if (!rnpsGetVisibleScores().length) {
        var emptyMsg = rnpsScores.length
            ? (rnpsScopeLabel() || 'No RNPS data matches your access.')
            : 'Upload your first quarter using the Upload tab.';
        sec.innerHTML = '<div style="text-align:center;padding:80px;">' +
            '<div style="font-size:3rem;margin-bottom:1rem;">📊</div>' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--t1);margin-bottom:.5rem;">'+(rnpsScores.length ? 'No RNPS Data For You' : 'No RNPS Data Yet')+'</div>' +
            '<div style="font-size:.85rem;color:var(--t3);margin-bottom:1.5rem;">'+emptyMsg+'</div>' +
            (rnpsCanUpload()?'<button class="export-btn" onclick="rnpsSetTab(\'upload\')" style="padding:10px 24px;"><i data-lucide="upload-cloud" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Go to Upload</button>':'') +
            '</div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    if (f.team) rnpsChartTeam = f.team;

    sec.innerHTML =
        '<div id="rnpsKPIs" style="margin-bottom:1.25rem;"></div>' +
        '<div id="rnpsTeamCards" style="display:grid;grid-template-columns:1fr 1fr;gap:.85rem;margin-bottom:1.25rem;"></div>' +
        '<div id="rnpsTrendSection" style="margin-bottom:1.25rem;"></div>' +
        '<div id="rnpsLeaderboard" style="margin-bottom:1.25rem;"></div>';

    rnpsRenderKPIs(smRows);
    rnpsRenderTeamCards(f);
    rnpsRenderTrendSection(f, periods);
    rnpsRenderLeaderboard(smRows, f, periods);
}

// ── KPI Tiles ─────────────────────────────────────────────────
function rnpsRenderKPIs(smRows) {
    var el = document.getElementById('rnpsKPIs'); if (!el) return;
    var tc      = smRows.reduce(function(s,r){return s+(r.TotalContacts||0);},0);
    var re      = smRows.reduce(function(s,r){return s+(r.Responded||0);},0);
    var avgRNPS = smRows.length ? Math.round(smRows.reduce(function(s,r){return s+(r.RNPS||0);},0)/smRows.length) : 0;
    var avgRR   = tc > 0 ? Math.round((re/tc)*100) : 0;
    var rTgt    = smRows.length ? (smRows[0].RNPSTarget||0)    : 0;
    var rrTgt   = smRows.length ? (smRows[0].ResponseTarget||0) : 0;
    var rAch    = rTgt  ? Math.round((avgRNPS/rTgt)*100)  : null;
    var rrAch   = rrTgt ? Math.round((avgRR/rrTgt)*100)   : null;
    var kpis = [
        {l:'Total Contacts',   v:tc.toLocaleString(),        icon:'users',          c:'#4c6fff'},
        {l:'Responded',        v:re.toLocaleString(),        icon:'message-circle', c:'#8b5cf6'},
        {l:'Response Rate',    v:avgRR+'%',                  icon:'percent',        c:avgRR>=(rrTgt||30)?'#10b981':'#ef4444', sub:rrTgt?'Target: '+rrTgt+'%':''},
        {l:'Avg RNPS',         v:avgRNPS+'%',                icon:'star',           c:avgRNPS>=(rTgt||75)?'#10b981':'#ef4444', sub:rTgt?'Target: '+rTgt+'%':''},
        {l:'RNPS Achievement', v:rAch!==null?rAch+'%':'—',  icon:'target',         c:rAch!==null&&rAch>=100?'#10b981':'#f59e0b'},
        {l:'RR Achievement',   v:rrAch!==null?rrAch+'%':'—',icon:'check-circle',   c:rrAch!==null&&rrAch>=100?'#10b981':'#ef4444'},
    ];
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:.7rem;">' +
        kpis.map(function(k){
            return '<div class="stat-card" style="padding:.85rem 1rem;">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:.45rem;">' +
                '<div style="width:28px;height:28px;border-radius:7px;background:'+k.c+'22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                '<i data-lucide="'+k.icon+'" style="width:14px;height:14px;color:'+k.c+';"></i></div>' +
                '<div class="stat-label" style="margin:0;font-size:.6rem;">'+k.l+'</div></div>' +
                '<div style="font-size:1.35rem;font-weight:900;color:'+k.c+';">'+k.v+'</div>' +
                (k.sub?'<div style="font-size:.65rem;color:var(--t3);">'+k.sub+'</div>':'') + '</div>';
        }).join('') + '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Team Cards ────────────────────────────────────────────────
function rnpsRenderTeamCards(f) {
    var el = document.getElementById('rnpsTeamCards'); if (!el) return;
    var teams = f.team ? [f.team] : ['DSM','TSM'];
    var tC = { DSM:'#4c6fff', TSM:'#8b5cf6' };
    el.innerHTML = teams.map(function(team) {
        var rows  = rnpsGetSMScores({ period: f.period, team: team });
        var tc    = rows.reduce(function(s,r){return s+(r.TotalContacts||0);},0);
        var re    = rows.reduce(function(s,r){return s+(r.Responded||0);},0);
        var avgR  = rows.length ? Math.round(rows.reduce(function(s,r){return s+(r.RNPS||0);},0)/rows.length) : 0;
        var avgRR = tc>0 ? Math.round((re/tc)*100) : 0;
        var rTgt  = rows.length ? (rows[0].RNPSTarget||0)    : 0;
        var rrTgt = rows.length ? (rows[0].ResponseTarget||0) : 0;
        var col   = tC[team]||'#4c6fff';
        return '<div class="stat-card" style="padding:1rem 1.1rem;position:relative;overflow:hidden;">' +
            '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'+col+';"></div>' +
            '<div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.85rem;">' +
            '<div style="width:36px;height:36px;border-radius:9px;background:'+col+'22;display:flex;align-items:center;justify-content:center;"><i data-lucide="layers" style="width:16px;height:16px;color:'+col+';"></i></div>' +
            '<div><div style="font-size:.95rem;font-weight:800;color:var(--t1);">'+team+'</div>' +
            '<div style="font-size:.7rem;color:var(--t3);">'+rows.length+' service managers</div></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.55rem;">' +
            '<div style="background:var(--bg-secondary);border-radius:7px;padding:.5rem .6rem;border:1px solid var(--border);">' +
            '<div style="font-size:.6rem;color:var(--t3);font-weight:600;text-transform:uppercase;">RNPS</div>' +
            '<div style="font-size:1.1rem;font-weight:900;color:'+(avgR>=(rTgt||75)?'#10b981':'#ef4444')+';">'+avgR+'%</div>' +
            (rTgt?'<div style="font-size:.6rem;color:var(--t3);">Target: '+rTgt+'%</div>':'')+'</div>' +
            '<div style="background:var(--bg-secondary);border-radius:7px;padding:.5rem .6rem;border:1px solid var(--border);">' +
            '<div style="font-size:.6rem;color:var(--t3);font-weight:600;text-transform:uppercase;">Resp Rate</div>' +
            '<div style="font-size:1.1rem;font-weight:900;color:'+(avgRR>=(rrTgt||30)?'#10b981':'#ef4444')+';">'+avgRR+'%</div>' +
            (rrTgt?'<div style="font-size:.6rem;color:var(--t3);">Target: '+rrTgt+'%</div>':'')+'</div></div>' +
            '<div style="padding:.4rem .65rem;background:'+col+'18;border-radius:7px;display:flex;justify-content:space-between;">' +
            '<span style="font-size:.7rem;color:var(--t3);">Total Contacts</span>' +
            '<span style="font-size:.8rem;font-weight:700;color:var(--t1);">'+tc.toLocaleString()+'</span></div></div>';
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ══════════════════════════════════════════════════════════════
// TREND SECTION — Trend / QoQ / YoY with metric + team toggles
// ══════════════════════════════════════════════════════════════
function rnpsRenderTrendSection(f, periods) {
    var el = document.getElementById('rnpsTrendSection'); if (!el) return;
    var tColors = {
        DSM: { line:'#4c6fff', fill:'rgba(76,111,255,0.12)'  },
        TSM: { line:'#8b5cf6', fill:'rgba(139,92,246,0.12)' }
    };
    var activeTeam   = f.team || rnpsChartTeam;
    var activeMetric = rnpsChartMetric;
    var activeView   = rnpsChartView;

    var metricBtns = ['RNPS','ResponseRate'].map(function(m) {
        var label  = m === 'RNPS' ? 'RNPS %' : 'Response Rate %';
        var active = m === activeMetric;
        return '<button type="button" onclick="rnpsSetTrendMetric(\''+m+'\')" style="padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:'+(active?'var(--acc)':'var(--bg-input)')+';color:'+(active?'#fff':'var(--t1)')+';transition:all .15s;">'+label+'</button>';
    }).join('');

    var viewBtns = [['trend','Trend'],['qoq','QoQ'],['yoy','YoY']].map(function(v) {
        var active = v[0] === activeView;
        return '<button type="button" onclick="rnpsSetTrendView(\''+v[0]+'\')" style="padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:'+(active?'var(--grad)':'var(--bg-input)')+';color:'+(active?'#fff':'var(--t1)')+';box-shadow:'+(active?'0 2px 8px var(--glow)':'none')+';transition:all .15s;">'+v[1]+'</button>';
    }).join('');

    var teamBtns = '';
    if (!f.team) {
        teamBtns = '<div style="display:flex;gap:4px;">' + ['DSM','TSM'].map(function(t) {
            var active = t === activeTeam;
            var col = tColors[t].line;
            return '<button type="button" onclick="rnpsSetChartTeam(\''+t+'\')" style="padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid '+col+';background:'+(active?col:'transparent')+';color:'+(active?'#fff':col)+';transition:all .15s;">'+t+'</button>';
        }).join('') + '</div><div style="width:1px;height:20px;background:var(--border);margin:0 4px;"></div>';
    }

    // View label
    var viewLabel = activeView==='trend'
        ? 'All quarters — DSM vs TSM avg'
        : activeView==='qoq'
        ? activeTeam+' · Last 4 quarters compared per SM'
        : activeTeam+' · Same quarter across years';

    el.innerHTML = '<div class="chart-card" style="padding:1.25rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.65rem;flex-wrap:wrap;gap:.75rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<i data-lucide="trending-up" style="width:16px;height:16px;color:var(--acc);"></i>' +
        '<span style="font-size:.9rem;font-weight:800;color:var(--t1);">Performance Analysis</span>' +
        '<span style="font-size:.72rem;color:var(--t3);font-style:italic;">'+viewLabel+'</span>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
        teamBtns +
        '<div style="display:flex;gap:4px;">'+metricBtns+'</div>' +
        '<div style="width:1px;height:20px;background:var(--border);margin:0 4px;"></div>' +
        '<div style="display:flex;gap:4px;">'+viewBtns+'</div>' +
        '</div></div>' +
        '<div id="rnpsTrendChartArea"></div>' +
        '</div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();
    rnpsDrawTrendChart(f, periods, activeTeam, activeMetric, activeView, tColors);
}

function rnpsDrawTrendChart(f, periods, team, metric, view, tColors) {
    var area = document.getElementById('rnpsTrendChartArea'); if (!area) return;
    var c = rnpsCC();
    var tgtKey = metric === 'RNPS' ? 'RNPSTarget' : 'ResponseTarget';

    // ── TREND: line chart, both teams, all quarters ────────────
    if (view === 'trend') {
        var sortedP = periods.slice().reverse();
        var teams   = f.team ? [f.team] : ['DSM','TSM'];
        area.innerHTML = '<div style="height:280px;"><canvas id="rnpsTrendCanvas"></canvas></div>';

        var datasets = teams.map(function(t) {
            var col = tColors[t] || tColors['DSM'];
            return {
                label: t,
                data: sortedP.map(function(p){ return rnpsAvg(p, t, metric); }),
                borderColor: col.line, backgroundColor: col.fill,
                borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8,
                pointBackgroundColor: col.line, pointBorderColor:'#fff', pointBorderWidth:2,
                fill: true, tension: 0.4, spanGaps: true
            };
        });

        // Target line
        var tgtRow = rnpsGetVisibleScores().find(function(r){ return r.RowType==='SM' && r[tgtKey]; });
        var tgtVal = tgtRow ? (tgtRow[tgtKey]||0) : 0;
        if (tgtVal) datasets.push({
            label: 'Target '+tgtVal+'%',
            data: sortedP.map(function(){ return tgtVal; }),
            borderColor: '#f59e0b', borderDash:[8,4], borderWidth:1.5,
            pointRadius:0, fill:false, tension:0
        });

        rnpsDC('rnpsTrend');
        var cv = document.getElementById('rnpsTrendCanvas');
        if (cv) rnpsCharts['rnpsTrend'] = new Chart(cv, {
            type:'line', data:{ labels:sortedP, datasets:datasets },
            options:{ responsive:true, maintainAspectRatio:false,
                interaction:{ mode:'index', intersect:false },
                plugins:{ datalabels:{display:false},
                    legend:{ position:'top', labels:{color:c.text,font:{size:11,weight:'600'},usePointStyle:true,padding:16}},
                    tooltip:{ callbacks:{ label:function(ctx){ return ctx.dataset.label+': '+(ctx.parsed.y!==null?ctx.parsed.y+'%':'—'); }}}
                },
                scales:{ x:{grid:{color:c.grid},ticks:{color:c.text,font:{size:11}}},
                    y:{min:0,max:100,grid:{color:c.grid},ticks:{color:c.text,callback:function(v){return v+'%';}}}}
            }
        });

    // ── QoQ: grouped bar per SM, last 4 quarters ──────────────
    } else if (view === 'qoq') {
        var sortedP2 = periods.slice().reverse();
        var recent = sortedP2.slice(-4);
        if (recent.length < 2) {
            area.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--t3);font-size:.85rem;">Need at least 2 quarters of data for QoQ comparison.</div>';
            return;
        }
        var smList = [...new Set(rnpsGetVisibleScores().filter(function(r){ return r.RowType==='SM' && r.Team===team; }).map(function(r){ return r.ServiceManager; }))].filter(Boolean).sort();
        var palette = ['rgba(76,111,255,0.85)','rgba(139,92,246,0.75)','rgba(16,185,129,0.75)','rgba(245,158,11,0.75)'];
        var h = Math.max(300, smList.length * 34 + 80);
        area.innerHTML = '<div style="height:'+h+'px;"><canvas id="rnpsTrendCanvas"></canvas></div>';

        rnpsDC('rnpsTrend');
        var cv2 = document.getElementById('rnpsTrendCanvas');
        if (cv2) rnpsCharts['rnpsTrend'] = new Chart(cv2, {
            type:'bar',
            data:{ labels:smList, datasets: recent.map(function(p,idx){
                return { label:p,
                    data:smList.map(function(name){
                        var row = rnpsGetVisibleScores().find(function(r){ return r.RowType==='SM'&&r.ServiceManager===name&&r.Period===p; });
                        return row ? (row[metric]||0) : null;
                    }),
                    backgroundColor: palette[idx%palette.length], borderRadius:4, maxBarThickness:18
                };
            })},
            options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
                interaction:{ mode:'index', intersect:false },
                plugins:{ datalabels:{display:false},
                    legend:{position:'top',labels:{color:c.text,font:{size:11,weight:'600'},usePointStyle:true,padding:14}}
                },
                scales:{ x:{min:0,max:100,grid:{color:c.grid},ticks:{color:c.text,callback:function(v){return v+'%';}}},
                    y:{grid:{display:false},ticks:{color:c.text,font:{size:10}}}}
            }
        });

    // ── YoY: line per year, Q1-Q4 as x-axis ──────────────────
    } else if (view === 'yoy') {
        var yearGroups = {};
        periods.forEach(function(p) {
            var parsed = rnpsParsePeriod(p);
            if (!parsed.year) return;
            if (!yearGroups[parsed.year]) yearGroups[parsed.year] = {};
            yearGroups[parsed.year]['Q'+parsed.q] = p;
        });
        var yearKeys = Object.keys(yearGroups).sort();
        if (!yearKeys.length) {
            area.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--t3);font-size:.85rem;">No yearly data available yet.</div>';
            return;
        }
        var qLabels = ['Q1','Q2','Q3','Q4'];
        var yearColors = ['#4c6fff','#8b5cf6','#10b981','#f59e0b','#ef4444'];
        area.innerHTML = '<div style="height:280px;"><canvas id="rnpsTrendCanvas"></canvas></div>';

        rnpsDC('rnpsTrend');
        var cv3 = document.getElementById('rnpsTrendCanvas');
        if (cv3) rnpsCharts['rnpsTrend'] = new Chart(cv3, {
            type:'line',
            data:{ labels:qLabels, datasets: yearKeys.map(function(yr,idx){
                var col = yearColors[idx%yearColors.length];
                return { label:yr,
                    data: qLabels.map(function(q){
                        var p = yearGroups[yr][q];
                        return p ? rnpsAvg(p, team, metric) : null;
                    }),
                    borderColor:col, backgroundColor:'transparent',
                    borderWidth:2.5, pointRadius:5, pointHoverRadius:8,
                    pointBackgroundColor:col, pointBorderColor:'#fff', pointBorderWidth:2,
                    fill:false, tension:0.4, spanGaps:true
                };
            })},
            options:{ responsive:true, maintainAspectRatio:false,
                interaction:{ mode:'index', intersect:false },
                plugins:{ datalabels:{display:false},
                    legend:{position:'top',labels:{color:c.text,font:{size:11,weight:'600'},usePointStyle:true,padding:16}},
                    tooltip:{ callbacks:{ label:function(ctx){ return ctx.dataset.label+': '+(ctx.parsed.y!==null?ctx.parsed.y+'%':'—'); }}}
                },
                scales:{ x:{grid:{color:c.grid},ticks:{color:c.text,font:{size:11}}},
                    y:{min:0,max:100,grid:{color:c.grid},ticks:{color:c.text,callback:function(v){return v+'%';}}}}
            }
        });
    }
}

window.rnpsSetChartTeam = function(team) {
    rnpsChartTeam = team;
    var f = rnpsGetF();
    rnpsRenderTrendSection(f, rnpsGetPeriods());
};
window.rnpsSetTrendMetric = function(metric) {
    rnpsChartMetric = metric;
    var f = rnpsGetF();
    rnpsRenderTrendSection(f, rnpsGetPeriods());
};
window.rnpsSetTrendView = function(view) {
    rnpsChartView = view;
    var f = rnpsGetF();
    rnpsRenderTrendSection(f, rnpsGetPeriods());
};

// ══════════════════════════════════════════════════════════════
// LEADERBOARD — with filters, current period + all year quarters
// ══════════════════════════════════════════════════════════════
function rnpsRenderLeaderboard(smRows, f, periods) {
    var el = document.getElementById('rnpsLeaderboard'); if (!el) return;
    if (!smRows.length) { el.innerHTML = ''; return; }

    var filtered = smRows.slice();
    if (rnpsLBTeam)   filtered = filtered.filter(function(r){ return r.Team === rnpsLBTeam; });
    if (rnpsLBStatus === 'met')    filtered = filtered.filter(function(r){ return r.RNPSTarget && r.RNPS >= r.RNPSTarget; });
    if (rnpsLBStatus === 'missed') filtered = filtered.filter(function(r){ return r.RNPSTarget && r.RNPS <  r.RNPSTarget; });
    if (rnpsLBSearch) filtered = filtered.filter(function(r){ return (r.ServiceManager||'').toLowerCase().includes(rnpsLBSearch.toLowerCase()); });
    var sorted = filtered.slice().sort(function(a,b){ return (b.RNPS||0)-(a.RNPS||0); });

    var currentPeriod = f.period || periods[0] || '';
    var currentYear   = rnpsParsePeriod(currentPeriod).year;
    var yearPeriods   = periods
        .filter(function(p){ return rnpsParsePeriod(p).year === currentYear; })
        .sort(function(a,b){ return rnpsParsePeriod(a).q - rnpsParsePeriod(b).q; });

    var colCount = 9 + yearPeriods.length + 1;

    el.innerHTML = '<div class="table-section">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem;">' +
        '<h3 class="table-title"><i data-lucide="trophy" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
        (rnpsGetRole()==='Service Manager' ? 'Your Performance' : 'SM Leaderboard') +
        (currentYear ? ' <span style="font-size:.72rem;color:var(--t3);font-weight:600;">'+currentYear+' quarters</span>' : '') + '</h3>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
        (!f.team ? '<div style="display:flex;gap:4px;">' +
            ['','DSM','TSM'].map(function(t){
                var active = rnpsLBTeam === t;
                return '<button type="button" onclick="rnpsLBFilter(\'team\',\''+t+'\')" style="padding:5px 12px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:'+(active?'var(--acc)':'var(--bg-input)')+';color:'+(active?'#fff':'var(--t1)')+';transition:all .15s;">'+(t||'All')+'</button>';
            }).join('') + '</div>' : '') +
        '<div style="display:flex;gap:4px;">' +
            [['','All'],['met','✓ Met'],['missed','✗ Missed']].map(function(s){
                var active = rnpsLBStatus === s[0];
                var col    = s[0]==='met'?'#10b981':s[0]==='missed'?'#ef4444':'var(--acc)';
                return '<button type="button" onclick="rnpsLBFilter(\'status\',\''+s[0]+'\')" style="padding:5px 12px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid '+(active?col:'var(--border)')+';background:'+(active?col+'18':'var(--bg-input)')+';color:'+(active?col:'var(--t1)')+';transition:all .15s;">'+s[1]+'</button>';
            }).join('') +
        '</div>' +
        '<input type="text" placeholder="Search SM..." value="'+rnpsLBSearch+'" oninput="rnpsLBFilter(\'search\',this.value)" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:12px;width:150px;">' +
        '</div></div>' +

        '<div style="overflow-x:auto;">' +
        '<div style="max-height:520px;overflow-y:auto;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:.8rem;min-width:860px;">' +
        '<thead><tr style="position:sticky;top:0;z-index:2;">' +
        '<th style="background:var(--bg-secondary);padding:.5rem .6rem;text-align:left;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">#</th>' +
        '<th style="background:var(--bg-secondary);padding:.5rem .7rem;text-align:left;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);min-width:150px;">Service Manager</th>' +
        '<th style="background:var(--bg-secondary);padding:.5rem .6rem;text-align:center;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Team</th>' +
        '<th style="background:var(--bg-secondary);padding:.5rem .6rem;text-align:right;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Contacts</th>' +
        '<th style="background:var(--bg-secondary);padding:.5rem .6rem;text-align:right;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Resp</th>' +
        '<th style="background:var(--bg-secondary);padding:.5rem .6rem;text-align:right;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">RR%</th>' +
        '<th style="background:var(--bg-secondary);padding:.5rem .6rem;text-align:right;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">RNPS%</th>' +
        '<th style="background:var(--bg-secondary);padding:.5rem .6rem;text-align:center;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);">Target</th>' +
        yearPeriods.map(function(p){
            var isCur = p === currentPeriod;
            return '<th style="background:'+(isCur?'rgba(76,111,255,0.1)':'var(--bg-secondary)')+';padding:.5rem .6rem;text-align:center;font-size:.58rem;font-weight:700;color:'+(isCur?'var(--acc)':'var(--t3)')+';border-bottom:2px solid var(--border-s);border-left:1px solid var(--border-s);white-space:nowrap;">'+p+'</th>';
        }).join('') +
        '<th style="background:var(--bg-secondary);padding:.5rem .6rem;text-align:center;font-size:.58rem;font-weight:700;text-transform:uppercase;color:var(--t3);border-bottom:2px solid var(--border-s);border-left:1px solid var(--border-s);">Trend</th>' +
        '</tr></thead><tbody>' +

        (sorted.length ? sorted.map(function(r, i) {
            var name  = r.ServiceManager || '—';
            var rnps  = r.RNPS || 0;
            var rr    = r.ResponseRate || 0;
            var tc    = r.TotalContacts || 0;
            var re    = r.Responded || 0;
            var tgt   = r.RNPSTarget || 0;
            var hit   = tgt && rnps >= tgt;
            var col   = rnps >= 80 ? '#10b981' : rnps >= 60 ? '#f59e0b' : '#ef4444';
            var rnkC  = i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#cd7c3f':'var(--t3)';
            var bg    = i%2===0?'var(--bg-card)':'var(--bg-secondary)';

            var histVals = yearPeriods.map(function(p) {
                var row = rnpsGetVisibleScores().find(function(s){ return s.RowType==='SM' && s.ServiceManager===name && s.Period===p; });
                return row ? (row.RNPS||0) : null;
            });
            var known = histVals.filter(function(v){ return v !== null; });
            var trendArrow = '';
            if (known.length >= 2) {
                var diff = known[known.length-1] - known[known.length-2];
                trendArrow = diff > 2  ? '<span style="color:#10b981;font-weight:900;font-size:.8rem;">↑ +'+diff+'%</span>'
                           : diff < -2 ? '<span style="color:#ef4444;font-weight:900;font-size:.8rem;">↓ '+diff+'%</span>'
                           :             '<span style="color:#f59e0b;font-weight:700;font-size:.8rem;">→</span>';
            } else { trendArrow = '<span style="color:var(--t3);font-size:.75rem;">—</span>'; }

            return '<tr style="background:'+bg+';transition:background .12s;" onmouseenter="this.style.background=\'var(--bg-hover)\'" onmouseleave="this.style.background=\''+bg+'\'">' +
                '<td style="padding:.5rem .6rem;"><span style="font-size:.75rem;font-weight:900;color:'+rnkC+';">'+(i+1)+'</span></td>' +
                '<td style="padding:.5rem .7rem;">' +
                '<div style="font-weight:700;font-size:.85rem;color:var(--t1);">'+name+'</div>' +
                '<div style="font-size:.62rem;color:var(--t3);">'+(r.LineManager||'')+'</div></td>' +
                '<td style="padding:.5rem .6rem;text-align:center;"><span style="background:var(--chip);color:var(--acc);padding:2px 7px;border-radius:8px;font-size:.63rem;font-weight:700;">'+(r.Team||'')+'</span></td>' +
                '<td style="padding:.5rem .6rem;text-align:right;color:var(--t2);font-weight:600;">'+tc.toLocaleString()+'</td>' +
                '<td style="padding:.5rem .6rem;text-align:right;color:var(--t2);">'+re.toLocaleString()+'</td>' +
                '<td style="padding:.5rem .6rem;text-align:right;font-weight:700;color:var(--t2);">'+rr+'%</td>' +
                '<td style="padding:.5rem .6rem;text-align:right;"><span style="font-size:1.05rem;font-weight:900;color:'+col+';">'+rnps+'%</span></td>' +
                '<td style="padding:.5rem .6rem;text-align:center;">' +
                (tgt ? '<span style="padding:2px 8px;border-radius:20px;font-size:.65rem;font-weight:700;background:'+(hit?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.1)')+';color:'+(hit?'#10b981':'#ef4444')+';">'+(hit?'✓ Met':'✗ Miss')+'</span>' : '<span style="color:var(--t3);font-size:.7rem;">—</span>') + '</td>' +
                yearPeriods.map(function(p, pi) {
                    var v   = histVals[pi];
                    var isCur = p === currentPeriod;
                    var vc  = v===null?'var(--t3)': v>=80?'#10b981': v>=60?'#f59e0b':'#ef4444';
                    return '<td style="padding:.5rem .6rem;text-align:center;border-left:1px solid var(--border-s);background:'+(isCur?'rgba(76,111,255,0.04)':'transparent')+';">' +
                        (v!==null ? '<span style="font-size:.82rem;font-weight:'+(isCur?'900':'600')+';color:'+vc+';">'+v+'%</span>' : '<span style="color:var(--t3);font-size:.7rem;">—</span>') + '</td>';
                }).join('') +
                '<td style="padding:.5rem .6rem;text-align:center;border-left:1px solid var(--border-s);">'+trendArrow+'</td>' +
                '</tr>';
        }).join('') : '<tr><td colspan="'+colCount+'" style="text-align:center;padding:2rem;color:var(--t3);font-size:.85rem;">No results match current filters.</td></tr>') +

        '</tbody></table></div></div>' +
        '<div style="margin-top:.6rem;font-size:.72rem;color:var(--t3);text-align:right;">Showing '+sorted.length+' of '+smRows.length+' managers</div>' +
        '</div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.rnpsLBFilter = function(type, val) {
    if (type === 'team')   rnpsLBTeam   = val;
    if (type === 'status') rnpsLBStatus = val;
    if (type === 'search') rnpsLBSearch = val;
    var f = rnpsGetF();
    rnpsRenderLeaderboard(rnpsGetSMScores(f), f, rnpsGetPeriods());
};

// ── Upload HTML ───────────────────────────────────────────────
function rnpsUploadHTML() {
    var periodOptions = rnpsGeneratePeriodOptions();
    return '<div class="table-section" style="max-width:900px;">' +
        '<h3 class="table-title" style="margin-bottom:1.5rem;"><i data-lucide="upload-cloud" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Upload RNPS Score File</h3>' +
        '<div style="background:var(--bg-secondary);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;">' +
        '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--t3);letter-spacing:.06em;margin-bottom:1rem;">Settings</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;">' +
        '<div class="filter-group"><label class="filter-label">Team *</label>' +
        '<select class="filter-select" id="rnpsUpTeam" style="font-size:13px;padding:9px;">' +
        '<option value="">Select</option><option value="DSM">DSM</option><option value="TSM">TSM</option></select></div>' +
        '<div class="filter-group"><label class="filter-label">Period *</label>' +
        '<select class="filter-select" id="rnpsUpPeriod" style="font-size:13px;padding:9px;">' +
        '<option value="">Select Period</option>' +
        periodOptions.map(function(p){return '<option value="'+p+'">'+p+'</option>';}).join('') + '</select></div>' +
        '<div class="filter-group"><label class="filter-label">RNPS Target %</label>' +
        '<input type="number" class="filter-select" id="rnpsUpRNPSTgt" placeholder="e.g. 75" style="font-size:13px;padding:9px;cursor:text;"></div>' +
        '<div class="filter-group"><label class="filter-label">RR Target %</label>' +
        '<input type="number" class="filter-select" id="rnpsUpRRTgt" placeholder="e.g. 30" style="font-size:13px;padding:9px;cursor:text;"></div>' +
        '</div>' +
        '<div style="margin-top:.85rem;padding:.6rem .85rem;background:rgba(76,111,255,0.08);border-radius:8px;border:1px solid rgba(76,111,255,0.2);font-size:.78rem;color:var(--t3);">' +
        '💡 Excel columns: <strong>Manager | Total Contacts | Responded | Response Rate | RNPS</strong></div></div>' +
        '<div style="border:2px dashed var(--border-s);border-radius:12px;padding:2rem;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:1.25rem;" ' +
        'onclick="document.getElementById(\'rnpsFileInput\').click()" ' +
        'ondragover="event.preventDefault();this.style.borderColor=\'var(--acc)\';this.style.background=\'var(--bg-hover)\'" ' +
        'ondragleave="this.style.borderColor=\'var(--border-s)\';this.style.background=\'\'" ' +
        'ondrop="rnpsHandleDrop(event)">' +
        '<i data-lucide="file-spreadsheet" style="width:36px;height:36px;color:var(--acc);display:block;margin:0 auto .75rem;"></i>' +
        '<div style="font-size:.9rem;font-weight:700;color:var(--t1);margin-bottom:.25rem;" id="rnpsDropLabel">Drop Excel file here or click to browse</div>' +
        '<div style="font-size:.72rem;color:var(--t3);">.xlsx · Manager | Total Contacts | Responded | Response Rate | RNPS</div></div>' +
        '<input type="file" id="rnpsFileInput" accept=".xlsx,.xls" style="display:none;" onchange="rnpsHandleFile(this.files[0])">' +
        '<div id="rnpsPreviewSection"></div>' +
        '<div id="rnpsUploadMsg" style="margin-top:12px;text-align:center;font-weight:600;font-size:.9rem;"></div></div>' +
        '<div class="table-section" style="max-width:900px;margin-top:1.5rem;">' +
        '<h3 class="table-title" style="margin-bottom:1rem;"><i data-lucide="history" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Upload History</h3>' +
        '<div id="rnpsUploadHistory"><div style="color:var(--t3);padding:.5rem;font-size:.85rem;">Loading...</div></div></div>';
}

window.rnpsHandleDrop = function(e) {
    e.preventDefault();
    e.target.closest('[ondrop]').style.borderColor='var(--border-s)';
    e.target.closest('[ondrop]').style.background='';
    var f=e.dataTransfer.files[0]; if(f) rnpsHandleFile(f);
};

window.rnpsHandleFile = async function(file) {
    if (!file) return;
    if (!window.XLSX) { alert('XLSX library not loaded.'); return; }
    var team   = document.getElementById('rnpsUpTeam').value;
    var period = document.getElementById('rnpsUpPeriod').value;
    if (!team || !period) { alert('Select Team and Period first.'); return; }
    var lbl = document.getElementById('rnpsDropLabel');
    if (lbl) lbl.textContent = '📂 ' + file.name + ' — parsing...';
    var reader = new FileReader();
    reader.onload = async function(e2) {
        try {
            var wb  = XLSX.read(e2.target.result, { type:'binary' });
            var ws  = wb.Sheets[wb.SheetNames[0]];
            var rawArr = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
            var hRow = -1;
            for (var i = 0; i < Math.min(rawArr.length, 10); i++) {
                var rowStr = rawArr[i].join('|').toLowerCase();
                if (rowStr.includes('manager') && (rowStr.includes('contact') || rowStr.includes('rnps'))) { hRow = i; break; }
            }
            var raw;
            if (hRow < 0) {
                raw = XLSX.utils.sheet_to_json(ws, { defval:'' });
            } else {
                var headers = rawArr[hRow];
                raw = rawArr.slice(hRow + 1).map(function(row) {
                    var obj = {};
                    headers.forEach(function(h, idx) { obj[String(h).trim()] = row[idx] !== undefined ? row[idx] : ''; });
                    return obj;
                }).filter(function(r) { return Object.values(r).some(function(v){ return String(v).trim() !== ''; }); });
            }
            if (lbl) lbl.textContent = '📂 ' + file.name + ' (' + raw.length + ' rows found)';
            await rnpsParseAndPreview(raw, team, period);
        } catch(err) { alert('Error reading file: ' + err.message); }
    };
    reader.readAsBinaryString(file);
};

async function rnpsParseAndPreview(raw, team, period) {
    var rTgt  = parseFloat(document.getElementById('rnpsUpRNPSTgt').value) || 0;
    var rrTgt = parseFloat(document.getElementById('rnpsUpRRTgt').value)   || 0;
    if (!raw.length) { alert('No data found in file.'); return; }
    var sampleKeys = Object.keys(raw[0]);
    function findCol(kws) { return sampleKeys.find(function(k){ return kws.some(function(kw){ return k.toLowerCase().includes(kw); }); })||''; }
    var cMgr = findCol(['manager']);
    var cTC  = findCol(['total contacts','contacts','total']);
    var cRe  = findCol(['responded','respond']);
    var cRR  = findCol(['response rate','rate']);
    var cRN  = findCol(['rnps','nps']);
    if (!cMgr) { alert('Cannot find Manager column.'); return; }
    if (!rnpsAllSP.length) await rnpsFetchSPNames();
    var toAdd = [], skipped = [], unmatched = [];
    raw.forEach(function(row) {
        var rawName = String(row[cMgr] || '').trim();
        if (!rawName || rawName.toLowerCase() === 'overall' || rawName.toLowerCase() === 'manager') return;
        var tc = parseFloat(String(row[cTC]||'0').replace(/[^0-9.]/g,''))||0;
        var re = parseFloat(String(row[cRe]||'0').replace(/[^0-9.]/g,''))||0;
        var rr = parseFloat(String(row[cRR]||'0').replace(/%/g,''))||0;
        var rn = parseFloat(String(row[cRN]||'0').replace(/%/g,''))||0;
        if (rr > 0 && rr <= 1) rr = Math.round(rr * 100);
        if (rn > 0 && rn <= 1) rn = Math.round(rn * 100);
        var spMatch = rnpsAllSP.find(function(p){ return rnpsNorm(p.name) === rnpsNorm(rawName); });
        if (spMatch) {
            if (spMatch.role === 'SM') {
                toAdd.push({ rawName:rawName, matchedName:spMatch.name, ServiceManager:spMatch.name, LineManager:spMatch.lm,
                    Team:team, Period:period, TotalContacts:tc, Responded:re, ResponseRate:rr, RNPS:rn,
                    RNPSTarget:rTgt, ResponseTarget:rrTgt, RowType:'SM', _status:'matched' });
            } else { skipped.push({ name:rawName, role:spMatch.role, tc:tc, re:re, rr:rr, rn:rn }); }
        } else { unmatched.push({ rawName:rawName, tc:tc, re:re, rr:rr, rn:rn, mappedTo:'', _id:rawName }); }
    });
    window.RNPS_PENDING = { toAdd:toAdd, unmatched:unmatched, skipped:skipped, team:team, period:period, rTgt:rTgt, rrTgt:rrTgt };
    rnpsRenderPreview();
}

function rnpsRenderPreview() {
    var el = document.getElementById('rnpsPreviewSection'); if (!el) return;
    var pd = window.RNPS_PENDING; if (!pd) return;
    var allSMs = rnpsAllSP.filter(function(p){return p.role==='SM';}).map(function(p){return p.name;}).sort();
    var html = '';
    var needMap = pd.unmatched.filter(function(r){ return !r._ignored && !r._mapped; });

    html += '<div style="margin-bottom:1.25rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.65rem;flex-wrap:wrap;gap:.5rem;">' +
        '<div style="font-size:.88rem;font-weight:700;color:var(--t1);">✅ Will be uploaded — ' + pd.toAdd.length + ' SM records' +
        (needMap.length ? ' <span style="color:#f59e0b;">+ '+needMap.length+' need mapping</span>' : ' <span style="color:#10b981;">· All matched</span>') + '</div>' +
        '<button type="button" class="export-btn" onclick="rnpsConfirmUpload()" style="padding:9px 18px;font-size:13px;" id="rnpsConfirmBtn">' +
        '<i data-lucide="check" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Confirm & Upload</button></div>' +
        '<div style="overflow-x:auto;max-height:300px;overflow-y:auto;border-radius:10px;border:1px solid var(--border);">' +
        '<table style="width:100%;border-collapse:collapse;font-size:.8rem;">' +
        '<thead><tr>' +
        ['Manager (Excel)','Matched SP Name','LM','Team','Contacts','Resp','RR%','RNPS%'].map(function(h){
            return '<th style="background:var(--bg-secondary);padding:.45rem .7rem;text-align:left;font-size:.63rem;font-weight:700;text-transform:uppercase;color:var(--t1);border-bottom:2px solid var(--border-s);position:sticky;top:0;white-space:nowrap;">'+h+'</th>';
        }).join('') + '</tr></thead><tbody>' +
        pd.toAdd.map(function(r,i){
            var bg = i%2===0?'var(--bg-card)':'var(--bg-secondary)';
            return '<tr style="background:'+bg+';">' +
                '<td style="padding:.4rem .7rem;color:var(--t3);">'+r.rawName+'</td>' +
                '<td style="padding:.4rem .7rem;font-weight:700;color:#10b981;">'+r.matchedName+'</td>' +
                '<td style="padding:.4rem .7rem;color:var(--t2);font-size:.78rem;">'+r.LineManager+'</td>' +
                '<td style="padding:.4rem .7rem;"><span style="background:var(--chip);color:var(--acc);padding:2px 7px;border-radius:8px;font-size:.68rem;font-weight:700;">'+r.Team+'</span></td>' +
                '<td style="padding:.4rem .7rem;text-align:right;font-weight:600;">'+r.TotalContacts.toLocaleString()+'</td>' +
                '<td style="padding:.4rem .7rem;text-align:right;">'+r.Responded.toLocaleString()+'</td>' +
                '<td style="padding:.4rem .7rem;text-align:right;font-weight:700;">'+r.ResponseRate+'%</td>' +
                '<td style="padding:.4rem .7rem;text-align:right;font-weight:900;color:'+(r.RNPS>=(r.RNPSTarget||75)?'#10b981':'#ef4444')+';">'+r.RNPS+'%</td></tr>';
        }).join('') + '</tbody></table></div></div>';

    if (pd.unmatched.length) {
        var ignoredCount = pd.unmatched.filter(function(r){return r._ignored;}).length;
        html += '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;">' +
            '<div style="font-size:.85rem;font-weight:700;color:#d97706;margin-bottom:.85rem;">⚠️ ' + pd.unmatched.length + ' names not found in SP list' +
            (ignoredCount ? ' · <span style="color:var(--t3);font-weight:600;">'+ignoredCount+' ignored</span>' : '') + '</div>' +
            '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.8rem;">' +
            '<thead><tr>' +
            ['Name in Excel','Contacts','Resp','RR%','RNPS%','Map to SM','Action'].map(function(h){
                return '<th style="background:rgba(245,158,11,0.1);padding:.45rem .7rem;text-align:left;font-size:.63rem;font-weight:700;text-transform:uppercase;color:#d97706;border-bottom:2px solid rgba(245,158,11,0.3);white-space:nowrap;">'+h+'</th>';
            }).join('') + '</tr></thead><tbody>' +
            pd.unmatched.map(function(r, i) {
                var ignored = !!r._ignored;
                var bg = ignored ? 'rgba(0,0,0,0.03)' : (i%2===0?'var(--bg-card)':'rgba(245,158,11,0.04)');
                return '<tr style="background:'+bg+';opacity:'+(ignored?'0.45':'1')+';transition:opacity .2s;">' +
                    '<td style="padding:.4rem .7rem;font-weight:700;color:var(--t1);">'+(ignored?'<s>':'')+r.rawName+(ignored?'</s>':'')+'</td>' +
                    '<td style="padding:.4rem .7rem;text-align:right;">'+r.tc.toLocaleString()+'</td>' +
                    '<td style="padding:.4rem .7rem;text-align:right;">'+r.re.toLocaleString()+'</td>' +
                    '<td style="padding:.4rem .7rem;text-align:right;font-weight:700;">'+r.rr+'%</td>' +
                    '<td style="padding:.4rem .7rem;text-align:right;font-weight:900;color:#f59e0b;">'+r.rn+'%</td>' +
                    '<td style="padding:.4rem .7rem;">' +
                    (ignored ? '<span style="font-size:.75rem;color:var(--t3);font-style:italic;">Will be skipped</span>'
                    : r._mapped ? '<span style="font-size:.75rem;color:#10b981;font-weight:700;">✓ '+r._mappedName+'</span>'
                    : '<div style="position:relative;">' +
                      '<input type="text" id="rnpsMapSrch_'+i+'" placeholder="🔍 Search..." ' +
                      'oninput="rnpsFilterMapOpts(\'rnpsMapSel_'+i+'\',this.value)" ' +
                      'style="width:100%;font-size:.78rem;padding:4px 7px;border-radius:6px 6px 0 0;border:1px solid var(--border);border-bottom:none;background:var(--bg-input);color:var(--t1);box-sizing:border-box;display:none;" />' +
                      '<select id="rnpsMapSel_'+i+'" ' +
                      'onfocus="document.getElementById(\'rnpsMapSrch_'+i+'\').style.display=\'block\';this.style.borderRadius=\'0 0 6px 6px\';" ' +
                      'onblur="setTimeout(function(){var s=document.getElementById(\'rnpsMapSrch_'+i+'\');if(s)s.style.display=\'none\';var sel=document.getElementById(\'rnpsMapSel_'+i+'\');if(sel)sel.style.borderRadius=\'6px\';},200);" ' +
                      'onchange="rnpsApplyManualMap('+i+',this.value)" ' +
                      'style="width:100%;font-size:.78rem;padding:4px 7px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);min-width:190px;">' +
                      '<option value="">— Select SM —</option>' +
                      allSMs.map(function(n){return '<option value="'+n+'">'+n+'</option>';}).join('') +
                      '</select></div>') + '</td>' +
                    '<td style="padding:.4rem .7rem;">' +
                    (ignored ? '<button type="button" onclick="rnpsSetIgnore('+i+',false)" style="padding:4px 10px;border-radius:6px;background:rgba(76,111,255,0.1);color:var(--acc);border:1px solid rgba(76,111,255,0.3);cursor:pointer;font-size:.75rem;font-weight:700;">↩ Undo</button>'
                    : r._mapped ? '<button type="button" onclick="rnpsUnmapRow('+i+')" style="padding:4px 10px;border-radius:6px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);cursor:pointer;font-size:.75rem;font-weight:700;">✕ Unmap</button>'
                    : '<button type="button" onclick="rnpsSetIgnore('+i+',true)" style="padding:4px 10px;border-radius:6px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);cursor:pointer;font-size:.75rem;font-weight:700;">✕ Ignore</button>'
                    ) + '</td></tr>';
            }).join('') + '</tbody></table></div></div>';
    }

    if (pd.skipped.length) {
        html += '<div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:1.25rem;">' +
            '<div style="font-size:.85rem;font-weight:700;color:#ef4444;margin-bottom:.85rem;">❌ ' + pd.skipped.length + ' rows skipped (LM or SD — not stored)</div>' +
            '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.8rem;">' +
            '<thead><tr>' + ['Name','Role','Contacts','Resp','RR%','RNPS%','Reason'].map(function(h){
                return '<th style="background:rgba(239,68,68,0.08);padding:.4rem .7rem;text-align:left;font-size:.63rem;font-weight:700;text-transform:uppercase;color:#ef4444;border-bottom:2px solid rgba(239,68,68,0.2);white-space:nowrap;">'+h+'</th>';
            }).join('') + '</tr></thead><tbody>' +
            pd.skipped.map(function(r,i){
                var bg = i%2===0?'var(--bg-card)':'rgba(239,68,68,0.03)';
                return '<tr style="background:'+bg+';">' +
                    '<td style="padding:.4rem .7rem;font-weight:700;color:var(--t1);">'+r.name+'</td>' +
                    '<td style="padding:.4rem .7rem;"><span style="background:rgba(239,68,68,0.1);color:#ef4444;padding:2px 8px;border-radius:8px;font-size:.68rem;font-weight:700;">'+r.role+'</span></td>' +
                    '<td style="padding:.4rem .7rem;text-align:right;">'+r.tc.toLocaleString()+'</td>' +
                    '<td style="padding:.4rem .7rem;text-align:right;">'+r.re.toLocaleString()+'</td>' +
                    '<td style="padding:.4rem .7rem;text-align:right;">'+r.rr+'%</td>' +
                    '<td style="padding:.4rem .7rem;text-align:right;">'+r.rn+'%</td>' +
                    '<td style="padding:.4rem .7rem;font-size:.75rem;color:var(--t3);">'+(r.role==='SD'?'Service Director — aggregate row':'Line Manager — aggregate row')+'</td></tr>';
            }).join('') + '</tbody></table></div></div>';
    }

    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.rnpsSetIgnore = function(idx, ignore) {
    var pd = window.RNPS_PENDING; if (!pd || !pd.unmatched[idx]) return;
    pd.unmatched[idx]._ignored = ignore; rnpsRenderPreview();
};
window.rnpsUnmapRow = function(idx) {
    var pd = window.RNPS_PENDING; if (!pd || !pd.unmatched[idx]) return;
    pd.toAdd = pd.toAdd.filter(function(r){ return !(r._status==='manual' && r.rawName===pd.unmatched[idx].rawName); });
    pd.unmatched[idx]._mapped = false; pd.unmatched[idx]._mappedName = ''; rnpsRenderPreview();
};
window.rnpsFilterMapOpts = function(selId, val) {
    var sel = document.getElementById(selId); if (!sel) return;
    sel.querySelectorAll('option').forEach(function(o){
        if (!o.value) { o.style.display=''; return; }
        o.style.display = !val || o.text.toLowerCase().includes(val.toLowerCase()) ? '' : 'none';
    });
};
window.rnpsApplyManualMap = function(idx, spName) {
    var pd = window.RNPS_PENDING; if (!pd || !pd.unmatched[idx]) return;
    var um = pd.unmatched[idx]; if (!spName) { um.mappedTo=''; return; }
    var sp = rnpsAllSP.find(function(p){ return p.name===spName && p.role==='SM'; }); if (!sp) return;
    pd.toAdd.push({ rawName:um.rawName, matchedName:sp.name, ServiceManager:sp.name, LineManager:sp.lm,
        Team:pd.team, Period:pd.period, TotalContacts:um.tc, Responded:um.re, ResponseRate:um.rr, RNPS:um.rn,
        RNPSTarget:pd.rTgt, ResponseTarget:pd.rrTgt, RowType:'SM', _status:'manual' });
    pd.unmatched[idx]._mapped = true; pd.unmatched[idx]._mappedName = sp.name; rnpsRenderPreview();
};

window.rnpsConfirmUpload = async function() {
    var pd = window.RNPS_PENDING;
    if (!pd || !pd.toAdd.length) { alert('Nothing to upload.'); return; }
    var stillUnmapped = pd.unmatched.filter(function(r){ return !r._ignored && !r._mapped; });
    if (stillUnmapped.length && !confirm(stillUnmapped.length + ' rows still unmatched will be skipped. Continue?')) return;
    var msgEl = document.getElementById('rnpsUploadMsg');
    var btn   = document.getElementById('rnpsConfirmBtn');
    if (btn) { btn.disabled=true; btn.textContent='Uploading...'; }
    try {
        var dR  = await fetch(SP_URL+'/_api/contextinfo',{method:'POST',headers:{'Accept':'application/json;odata=verbose'},credentials:'include'});
        var dig = (await dR.json()).d.GetContextWebInformation.FormDigestValue;
        var uploaded = 0;
        for (var i=0; i<pd.toAdd.length; i++) {
            var r = pd.toAdd[i];
            if (msgEl) msgEl.innerHTML='<span style="color:var(--t3);">Uploading '+(i+1)+' / '+pd.toAdd.length+'...</span>';
            var body = { __metadata:{type:'SP.Data.RNPSScoresListItem'},
                Title:r.Period+'_'+r.Team+'_'+r.ServiceManager, Period:r.Period, Team:r.Team,
                LineManager:r.LineManager||'', ServiceManager:r.ServiceManager, RowType:'SM',
                TotalContacts:r.TotalContacts, Responded:r.Responded, ResponseRate:r.ResponseRate, RNPS:r.RNPS,
                RNPSTarget:r.RNPSTarget||0, ResponseTarget:r.ResponseTarget||0,
                UploadedBy:USER_CONTEXT.userName||'', UploadedOn:new Date().toISOString() };
            var res = await fetch(SP_URL+"/_api/web/lists/getbytitle('"+RNPS_SCORES_LIST+"')/items",
                { method:'POST', credentials:'include',
                  headers:{'Accept':'application/json;odata=verbose','Content-Type':'application/json;odata=verbose','X-RequestDigest':dig},
                  body:JSON.stringify(body) });
            if (res.ok) uploaded++;
        }
        if (msgEl) msgEl.innerHTML='<span style="color:#10b981;">✅ Uploaded '+uploaded+' SM records for '+pd.period+' · '+pd.team+'!</span>';
        window.RNPS_PENDING=null;
        document.getElementById('rnpsPreviewSection').innerHTML='';
        await rnpsFetchScores();
        rnpsRenderUploadHistory();
        if (btn){btn.disabled=false;btn.innerHTML='<i data-lucide="check" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Confirm & Upload';}
        if (typeof lucide!=='undefined') lucide.createIcons();
    } catch(e) {
        if (msgEl) msgEl.innerHTML='<span style="color:#ef4444;">Error: '+e.message+'</span>';
        if (btn){btn.disabled=false;btn.textContent='Confirm & Upload';}
    }
};

function rnpsRenderUploadHistory() {
    var el = document.getElementById('rnpsUploadHistory'); if (!el) return;
    var tC = { DSM:'#4c6fff', TSM:'#8b5cf6' };
    var batches = {};
    rnpsScores.forEach(function(r){
        var key = r.Period+'|'+r.Team;
        if (!batches[key]) batches[key]={ period:r.Period, team:r.Team, count:0, by:r.UploadedBy, on:r.UploadedOn };
        batches[key].count++;
    });
    var keys = Object.keys(batches).sort(function(a,b){
        var pa=rnpsParsePeriod(a.split('|')[0]), pb=rnpsParsePeriod(b.split('|')[0]);
        return pb.year!==pa.year?pb.year-pa.year:pb.q-pa.q;
    });
    if (!keys.length){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--t3);font-size:.85rem;">No uploads yet.</div>';return;}
    el.innerHTML='<div style="display:flex;flex-direction:column;gap:8px;">' +
        keys.map(function(key){
            var b=batches[key]; var col=tC[b.team]||'#4c6fff';
            return '<div style="display:flex;align-items:center;gap:10px;padding:.75rem 1rem;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;flex-wrap:wrap;">' +
                '<span style="padding:3px 12px;border-radius:20px;font-size:.75rem;font-weight:700;background:'+col+'22;color:'+col+';">'+b.team+'</span>' +
                '<span style="font-weight:700;color:var(--t1);">'+b.period+'</span>' +
                '<span style="font-size:.75rem;color:var(--t3);background:var(--bg-secondary);padding:2px 8px;border-radius:6px;">📊 '+b.count+' SM records</span>' +
                (b.by?'<span style="font-size:.72rem;color:var(--t3);">by '+b.by+'</span>':'') +
                (b.on?'<span style="font-size:.72rem;color:var(--t3);">'+new Date(b.on).toLocaleDateString('en-GB')+'</span>':'') +
                '<div style="margin-left:auto;">' +
                '<button type="button" onclick="rnpsDeleteBatch(\''+b.period+'\',\''+b.team+'\')" style="padding:4px 12px;border-radius:6px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.25);cursor:pointer;font-size:.75rem;font-weight:700;display:inline-flex;align-items:center;gap:4px;">' +
                '<i data-lucide="trash-2" style="width:11px;height:11px;"></i>Delete</button></div></div>';
        }).join('')+'</div>';
    if (typeof lucide!=='undefined') lucide.createIcons();
}

window.rnpsDeleteBatch = async function(period, team) {
    var toDel = rnpsScores.filter(function(r){ return r.Period===period && r.Team===team; });
    if (!toDel.length){alert('No records found.');return;}
    if (!confirm('Delete '+toDel.length+' records for '+team+' '+period+'?')) return;
    try {
        var dR=await fetch(SP_URL+'/_api/contextinfo',{method:'POST',headers:{'Accept':'application/json;odata=verbose'},credentials:'include'});
        var dig=(await dR.json()).d.GetContextWebInformation.FormDigestValue;
        for(var i=0;i<toDel.length;i++){
            await fetch(SP_URL+"/_api/web/lists/getbytitle('"+RNPS_SCORES_LIST+"')/items("+toDel[i].ID+")",
                {method:'POST',headers:{'Accept':'application/json;odata=verbose','X-RequestDigest':dig,'IF-MATCH':'*','X-HTTP-Method':'DELETE'},credentials:'include'});
        }
        rnpsScores=rnpsScores.filter(function(r){return !(r.Period===period&&r.Team===team);});
        rnpsRenderUploadHistory();
        alert('Deleted '+toDel.length+' records.');
    } catch(e){alert('Error: '+e.message);}
};

window.rnpsDelScore = async function(id) {
    if (!confirm('Delete this record?')) return;
    try {
        var dR=await fetch(SP_URL+'/_api/contextinfo',{method:'POST',headers:{'Accept':'application/json;odata=verbose'},credentials:'include'});
        var dig=(await dR.json()).d.GetContextWebInformation.FormDigestValue;
        await fetch(SP_URL+"/_api/web/lists/getbytitle('"+RNPS_SCORES_LIST+"')/items("+id+")",
            {method:'POST',headers:{'Accept':'application/json;odata=verbose','X-RequestDigest':dig,'IF-MATCH':'*','X-HTTP-Method':'DELETE'},credentials:'include'});
        rnpsScores=rnpsScores.filter(function(r){return r.ID!==id;});
        rnpsRenderDashboard();
    } catch(e){alert('Error: '+e.message);}
};

window.rnpsGetSMScore = function(smName) {
    var visible = rnpsGetVisibleScores();
    if (!visible.length) return null;
    var periods=rnpsGetPeriods(); var result={};
    var r1=visible.find(function(s){return s.ServiceManager===smName&&s.Period===periods[0]&&s.RowType==='SM';});
    var r2=visible.find(function(s){return s.ServiceManager===smName&&s.Period===periods[1]&&s.RowType==='SM';});
    if(r1) result.latest={period:periods[0],rnps:r1.RNPS||0,rr:r1.ResponseRate||0,target:r1.RNPSTarget||0};
    if(r2) result.prev={period:periods[1],rnps:r2.RNPS||0,rr:r2.ResponseRate||0};
    return (result.latest||result.prev)?result:null;
};
window.rnpsScoreBadgeHTML = function(smName) {
    var data=window.rnpsGetSMScore(smName); if(!data) return '';
    var html='<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">';
    if(data.latest){var col=data.latest.rnps>=(data.latest.target||75)?'#10b981':'#ef4444';html+='<div style="background:'+col+'18;border:1px solid '+col+'44;border-radius:8px;padding:5px 10px;min-width:90px;"><div style="font-size:.6rem;color:'+col+';font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">'+data.latest.period+'</div><div style="font-size:.95rem;font-weight:900;color:'+col+';">'+data.latest.rnps+'%</div><div style="font-size:.62rem;color:var(--t3);">RNPS · RR: '+data.latest.rr+'%</div></div>';}
    if(data.prev){var col2=data.prev.rnps>=75?'#10b981':'#ef4444';html+='<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:5px 10px;min-width:90px;"><div style="font-size:.6rem;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">'+data.prev.period+'</div><div style="font-size:.95rem;font-weight:900;color:'+col2+';">'+data.prev.rnps+'%</div><div style="font-size:.62rem;color:var(--t3);">RNPS · RR: '+data.prev.rr+'%</div></div>';}
    html+='</div>'; return html;
};
