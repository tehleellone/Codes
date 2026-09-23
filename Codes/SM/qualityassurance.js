// ============================================================
// qualityassurance.js — QA Audit Module v4
// List: QA_Audit | Agents: Account Mapping
// ============================================================

var QA_DUMMY_MODE = false;

var QA_LIST        = 'QA_Audit';
var QA_AGENT_LIST  = 'Account Mapping';

var qaAllAudits     = [];
var qaAllAgents     = [];
var qaCurrentTab    = 'submit';
var qaGridApi       = null;
var qaChartsVisible = false;
var qaChartPeriod   = 'M';
var qaChartMetric   = 'score';
var qaOutcomeMetric = 'count';
var qaPackFiles     = [];
var qaAnalyticsTab  = 'Call'; // active analytics audit type tab

// ── Call Criteria (13 — clubbed) ──────────────────────────────
var QA_CALL_CRITERIA = [
    { id:'C01_Welcoming',          label:'Welcoming & Farewell',                     desc:'Did the agent greet the customer warmly, introduce themselves, and close the call professionally?' },
    { id:'C03_FormOfAppeal',       label:'Form of Appeal',                           desc:'Did the agent address the customer appropriately by name, sir, or ma\'am throughout the call?' },
    { id:'C04_OfficialSpeech',     label:'Professional Language & Manner of Speech', desc:'Was language formal, professional, free of slang, and was the agent\'s tone calm, clear, and appropriately paced?' },
    { id:'C05_ExternalNoises',     label:'Environment & Background Noise',           desc:'Was the call environment quiet with no background noise or side conversations audible?' },
    { id:'C06_HoldTechniques',     label:'Hold Techniques',                          desc:'Was the customer informed before being placed on hold and was hold time reasonable?' },
    { id:'C07_ActiveListening',    label:'Active Listening & Letting Customer Express', desc:'Did the agent listen without interrupting, acknowledge the customer\'s points, and give space for the customer to fully explain?' },
    { id:'C10_HandlingTime',       label:'Handling Time',                            desc:'Was the call handled efficiently without unnecessary delays or dead air?' },
    { id:'C11_LeadingDialogue',    label:'Leading the Dialogue',                     desc:'Did the agent guide the conversation toward resolution without losing control of the call?' },
    { id:'C12_CustomerID',         label:'Customer Identification',                  desc:'Was the customer properly verified before any account actions were taken?' },
    { id:'C14_Transaction',        label:'Transaction & Incident Registration',       desc:'Was the requested transaction completed correctly and the issue logged accurately in the system?' },
    { id:'C16_CorrectInfo',        label:'Correct & Full Information',               desc:'Was all information provided accurate and complete with no gaps or errors?' },
    { id:'C17_AdditionalSupport',  label:'Contact Reason, Additional Support',       desc:'Was the reason for the customer\'s call correctly captured, and did the agent offer further assistance before closing?' },
    { id:'C20_ClarifyingQuestions',label:'Clarifying Questions',                     desc:'Did the agent ask relevant questions to fully understand the customer\'s issue?' },
];

// ── Email Criteria (13) ───────────────────────────────────────
var QA_EMAIL_CRITERIA = [
    { id:'E01_FormOfAppeal',        label:'Form of Appeal',                           desc:'Did the agent address the customer appropriately in the email by name or proper salutation?' },
    { id:'E02_OfficialText',        label:'Official Text & Proper Grammar & Language', desc:'Was the email written formally, professionally, with correct grammar and no spelling errors?' },
    { id:'E03_ReadingAttentively',  label:'Reading Attentively',                      desc:'Did the response show the agent fully read and understood the customer\'s email?' },
    { id:'E04_MannerOfTexting',     label:'Manner of Texting',                        desc:'Was the tone of the email warm, professional, and appropriate throughout?' },
    { id:'E05_HandlingTime',        label:'Handling Time',                            desc:'Was the email responded to within the agreed SLA window?' },
    { id:'E06_LeadingDialogue',     label:'Leading the Dialogue Properly',            desc:'Did the agent guide the email conversation toward resolution clearly?' },
    { id:'E07_CustomerID',          label:'Customer Identification',                  desc:'Was the customer properly identified before any account actions were referenced?' },
    { id:'E08_Positives',           label:'Highlighting Positives',                   desc:'Did the agent mention relevant product or service benefits where appropriate?' },
    { id:'E09_Transaction',         label:'Transaction Fulfillment',                  desc:'Was the requested transaction addressed correctly and completely in the email?' },
    { id:'E10_IncidentReg',         label:'Incident Registration',                    desc:'Was the issue logged in the system accurately and with the correct details?' },
    { id:'E11_CorrectInfo',         label:'Correct & Full Information',               desc:'Was all information in the email accurate and complete with no gaps or errors?' },
    { id:'E12_ContactReason',       label:'Contact Reason Registration',              desc:'Was the reason for the customer\'s email correctly captured in the system?' },
    { id:'E13_ClarifyingQuestions', label:'Clarifying Questions',                     desc:'Did the agent ask relevant questions to fully understand the customer\'s issue?' },
];

// ── Service Review Criteria (10) ──────────────────────────────
var QA_SR_CRITERIA = [
    { id:'SR01_Preparation',    label:'Review Preparation & Agenda',       desc:'Was the review well-prepared with a clear agenda shared with the customer in advance?' },
    { id:'SR02_CRM',            label:'Customer Relationship Management',   desc:'Did the agent demonstrate strong understanding of the customer\'s history, preferences, and ongoing issues?' },
    { id:'SR03_IssueResolution',label:'Issue Resolution Follow-up',         desc:'Were all previously raised issues followed up and resolved or escalated appropriately?' },
    { id:'SR04_SLA',            label:'SLA & Performance Discussion',       desc:'Were SLA metrics reviewed clearly and performance gaps discussed constructively?' },
    { id:'SR05_Upsell',         label:'Upsell / Service Opportunities',     desc:'Did the agent identify and present relevant upsell or service enhancement opportunities?' },
    { id:'SR06_ActionItems',    label:'Action Items & Next Steps',          desc:'Were clear action items defined with owners and timelines agreed upon by both parties?' },
    { id:'SR07_Satisfaction',   label:'Customer Satisfaction Check',        desc:'Was the customer\'s overall satisfaction assessed and documented?' },
    { id:'SR08_Documentation',  label:'Documentation & Notes',              desc:'Was the review outcome accurately documented in the system with all relevant details?' },
    { id:'SR09_Alignment',      label:'LM / Stakeholder Alignment',         desc:'Was the line manager or key stakeholder aligned and kept informed of the review outcome?' },
    { id:'SR10_Professionalism',label:'Professionalism & Communication',    desc:'Was the agent professional, punctual, and clear in communication throughout the review?' },
];

// ── Certification Criteria (10) ───────────────────────────────
var QA_CT_CRITERIA = [
    { id:'CT01_ProductKnowledge', label:'Product & Service Knowledge',      desc:'Does the agent demonstrate sufficient knowledge of du\'s products and services?' },
    { id:'CT02_SystemNav',        label:'System Navigation (CRM/Tools)',     desc:'Can the agent navigate CRM and internal tools confidently and accurately?' },
    { id:'CT03_CallHandling',     label:'Call Handling Basics',              desc:'Does the agent demonstrate proper call opening, hold techniques, and closing procedures?' },
    { id:'CT04_Communication',    label:'Communication & Tone',              desc:'Is the agent\'s communication clear, professional, and customer-friendly in tone?' },
    { id:'CT05_CustomerID',       label:'Customer Identification Process',   desc:'Does the agent follow the correct customer verification steps before taking any action?' },
    { id:'CT06_ProblemSolving',   label:'Problem Solving Approach',          desc:'Does the agent demonstrate structured thinking when handling customer issues?' },
    { id:'CT07_Escalation',       label:'Escalation Awareness',              desc:'Does the agent know when and how to escalate issues correctly?' },
    { id:'CT08_Compliance',       label:'Compliance & Data Security',        desc:'Does the agent follow data protection and compliance guidelines correctly?' },
    { id:'CT09_EmailEtiquette',   label:'Email Etiquette',                   desc:'Does the agent demonstrate proper email writing standards including tone, grammar, and structure?' },
    { id:'CT10_Readiness',        label:'Overall Readiness Assessment',      desc:'Is the agent overall ready to handle live customer interactions independently?' },
];

var QA_MAX_PER_CRITERION = 2;

function qaIsFullAdmin() {
    var role = window.USER_CONTEXT && window.USER_CONTEXT.role;
    return role === 'Admin' || role === 'Service Director';
}

function qaIsLineManager() {
    return !!(window.USER_CONTEXT && window.USER_CONTEXT.role === 'Line Manager');
}

function qaIsServiceManager() {
    return !!(window.USER_CONTEXT && window.USER_CONTEXT.role === 'Service Manager');
}

function qaCanSubmitAudit() {
    var role = window.USER_CONTEXT && window.USER_CONTEXT.role;
    return role === 'Admin' || role === 'Service Director' || role === 'Auditor' || role === 'Line Manager';
}

function qaGetLmTeams() {
    if (!window.ALL_DATA || !window.USER_CONTEXT) return [];
    var userName = window.USER_CONTEXT.userName;
    return [...new Set(window.ALL_DATA.filter(function(a) {
        return a.lm === userName;
    }).map(function(a) { return a.team; }).filter(Boolean))].sort();
}

function qaGetScopedAgents() {
    var role = window.USER_CONTEXT && window.USER_CONTEXT.role;
    var userName = window.USER_CONTEXT && window.USER_CONTEXT.userName;
    if (role === 'Service Manager') {
        return qaAllAgents.filter(function(a) { return a.name === userName; });
    }
    if (role === 'Line Manager' && window.ALL_DATA) {
        var myTeams = qaGetLmTeams();
        var mySms = [...new Set(window.ALL_DATA.filter(function(a) {
            return a.lm === userName;
        }).map(function(a) { return a.sm; }).filter(Boolean))];
        return qaAllAgents.filter(function(a) {
            return myTeams.indexOf(a.team) >= 0 || mySms.indexOf(a.name) >= 0;
        });
    }
    return qaAllAgents;
}

function qaAuditBelongsToScope(audit) {
    var role = window.USER_CONTEXT && window.USER_CONTEXT.role;
    var userName = window.USER_CONTEXT && window.USER_CONTEXT.userName;
    var agentName = audit.Agentt || audit.Agent || '';
    if (role === 'Service Manager') {
        return agentName === userName;
    }
    if (role === 'Line Manager') {
        var scopedAgents = qaGetScopedAgents().map(function(a) { return a.name; });
        var myTeams = qaGetLmTeams();
        return scopedAgents.indexOf(agentName) >= 0 || myTeams.indexOf(audit.Team) >= 0;
    }
    if (role === 'Auditor') {
        return audit.Evaluator === userName;
    }
    return true;
}

function qaGetCriteria(auditType) {
    if (auditType === 'Call')           return QA_CALL_CRITERIA;
    if (auditType === 'Email')          return QA_EMAIL_CRITERIA;
    if (auditType === 'Service Review') return QA_SR_CRITERIA;
    if (auditType === 'Certification')  return QA_CT_CRITERIA;
    return [];
}

// All SP columns across all types
function qaAllCriteriaCols() {
    return QA_CALL_CRITERIA.concat(QA_EMAIL_CRITERIA).concat(QA_SR_CRITERIA).concat(QA_CT_CRITERIA);
}

// ── Score Calculation ─────────────────────────────────────────
function qaCalcScore(scores, auditType) {
    var criteria = qaGetCriteria(auditType || 'Call');
    var sum = 0, count = 0;
    criteria.forEach(function(cat) {
        var val = scores[cat.id];
        if (val === null || val === undefined || val === '') return;
        var n = parseFloat(val);
        if (isNaN(n)) return;
        sum += Math.min(QA_MAX_PER_CRITERION, Math.max(0, n));
        count++;
    });
    if (!count) return 0;
    return Math.round((sum / (count * QA_MAX_PER_CRITERION)) * 100);
}

function qaOutcomeFromScore(score) {
    if (score >= 70) return 'Pass';
    if (score >= 50) return 'Needs Improvement';
    return 'Fail';
}

// ── Error Banner ──────────────────────────────────────────────
function qaShowError(msg) {
    var el = document.getElementById('qaErrorBanner');
    if (!el) return;
    el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:10px;">' +
        '<i data-lucide="alert-circle" style="width:16px;height:16px;flex-shrink:0;margin-top:1px;"></i>' +
        '<div>' + msg + '</div>' +
        '<button type="button" onclick="qaHideError()" style="background:none;border:none;cursor:pointer;color:inherit;font-size:1.1rem;margin-left:auto;line-height:1;">×</button>' +
        '</div>';
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function qaHideError() {
    var el = document.getElementById('qaErrorBanner');
    if (el) el.style.display = 'none';
}

// ── Entry Point ───────────────────────────────────────────────
window.qaInit = async function() {
    var loadingEl = document.getElementById('qaLoading');
    var contentEl = document.getElementById('qaContent');
    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    var timeout = new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('Request timed out — SharePoint may be unreachable')); }, 12000);
    });

    try {
        await Promise.race([
            Promise.all([qaFetchAudits(), qaFetchAgents()]),
            timeout
        ]);
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        qaRenderShell();
    } catch(e) {
        console.error('[QA]', e);
        if (loadingEl) loadingEl.innerHTML =
            '<div style="text-align:center;padding:40px;">' +
            '<div style="font-size:2rem;margin-bottom:12px;">⚠️</div>' +
            '<div style="font-weight:700;color:var(--t1);margin-bottom:8px;">Could not load QA data</div>' +
            '<div style="font-size:.82rem;color:var(--t3);margin-bottom:20px;">' + e.message + '</div>' +
            '<button type="button" class="export-btn" onclick="qaInit()" style="padding:10px 24px;">' +
            '<i data-lucide="refresh-cw" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Retry</button>' +
            '</div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// ── Fetch Agents from Account Mapping ─────────────────────────
async function qaFetchAgents() {
    if (QA_DUMMY_MODE) { qaAllAgents = qaGenDummyAgents(); return; }
    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + QA_AGENT_LIST + "')/items?" +
            "$select=Service_Manager_Name,Email_ID,Team,User_ID&$top=5000&$orderby=Service_Manager_Name asc";
        var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!res.ok) { console.warn('[QA] fetchAgents status', res.status); return; }
        var data = await res.json();
        var seen = {};
        qaAllAgents = [];
        (data.d.results || []).forEach(function(item) {
            var name = (item.Service_Manager_Name || '').trim();
            if (!name) return;
            var team  = item.Team || '';
            var email = item.Email_ID || '';
            var key   = name + '|' + team;
            if (!seen[key]) {
                seen[key] = true;
                qaAllAgents.push({ name: name, team: team, email: email });
            }
        });
        qaAllAgents.sort(function(a, b) { return a.name.localeCompare(b.name); });
    } catch(e) { console.warn('[QA] fetchAgents failed:', e); }
}

// ── Fetch Audits ──────────────────────────────────────────────
async function qaFetchAudits() {
    if (QA_DUMMY_MODE) { qaAllAudits = qaGenDummyAudits(); return; }

    var role     = window.USER_CONTEXT && window.USER_CONTEXT.role;
    var userName = window.USER_CONTEXT && window.USER_CONTEXT.userName;
    var filter   = '';
    if (role === 'Auditor') {
        filter = "&$filter=Evaluator/Title eq '" + (userName || '').replace(/'/g, "''") + "'";
    }

    var callCols = QA_CALL_CRITERIA.map(function(c) { return c.id; }).join(',');
    var emailCols = QA_EMAIL_CRITERIA.map(function(c) { return c.id; }).join(',');
    var srCols    = QA_SR_CRITERIA.map(function(c) { return c.id; }).join(',');
    var ctCols    = QA_CT_CRITERIA.map(function(c) { return c.id; }).join(',');

    var url = SP_URL + "/_api/web/lists/getbytitle('" + QA_LIST + "')/items?" +
        "$select=ID,Title,ReferenceID,AuditType,Team,Agent/Title,Evaluator/Title,Agentt,DateOfEval," +
        "DateOfCall,Call_x0020_Duration,CallDurationType,MSISDN,CallReason," +
        "DateOfEmail,EmailReason,EmailSubject," +
        "DateOfReview,DateOfCertification," +
        "AvgScore,Outcome,Comments,NAFileds," +
        callCols + "," + emailCols + "," + srCols + "," + ctCols +
        "&$expand=Agent,Evaluator" +
        filter + "&$orderby=Created desc&$top=1000";

    var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch audits: ' + res.statusText);
    var data = await res.json();

    qaAllAudits = (data.d.results || []).map(function(a) {
        a.Agent        = a.Agent     ? a.Agent.Title     : '';
        a.Evaluator    = a.Evaluator ? a.Evaluator.Title : '';
        a.CallDuration = a['Call_x0020_Duration'] || null;
        a.NAFields     = a['NAFileds'] || '';
        return a;
    });
}

// ── Get User ID ───────────────────────────────────────────────
async function qaGetUserId(name) {
    if (!name) return null;
    var url = SP_URL + "/_api/web/siteusers?$filter=Title eq '" + name.replace(/'/g, "''") + "'&$select=Id&$top=1";
    var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) throw new Error('User lookup failed');
    var data = await res.json();
    if (data.d.results && data.d.results.length > 0) return data.d.results[0].Id;
    // fallback: try email lookup from agent list
    var agent = qaAllAgents.find(function(a) { return a.name === name; });
    if (agent && agent.email) {
        var eUrl = SP_URL + "/_api/web/siteusers?$filter=Email eq '" + agent.email.replace(/'/g, "''") + "'&$select=Id&$top=1";
        var eRes = await fetch(eUrl, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (eRes.ok) {
            var eData = await eRes.json();
            if (eData.d.results && eData.d.results.length > 0) return eData.d.results[0].Id;
        }
    }
    return null;
}

// ── Attachment Helpers ────────────────────────────────────────
async function qaGetAttachments(itemId) {
    try {
        var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + QA_LIST + "')/items(" + itemId + ")/AttachmentFiles", {
            headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include'
        });
        if (!res.ok) return [];
        var data = await res.json();
        return data.d.results.map(function(a) { return { name: a.FileName, url: a.ServerRelativeUrl }; });
    } catch(e) { return []; }
}

async function qaUploadAttachment(itemId, file) {
    try {
        var digestRes = await fetch(SP_URL + '/_api/contextinfo', { method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;
        var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + QA_LIST + "')/items(" + itemId + ")/AttachmentFiles/add(FileName='" + encodeURIComponent(file.name) + "')", {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose', 'X-RequestDigest': digest },
            credentials: 'include', body: file
        });
        return res.ok;
    } catch(e) { return false; }
}

// ── Dummy Data ────────────────────────────────────────────────
function qaGenDummyAgents() {
    return [
        { name: 'Youssef Mohammed',   team: 'TSM_ME', email: '' },
        { name: 'Sara Al Hashimi',    team: 'TSM_ME', email: '' },
        { name: 'Khalid Al Mansoori', team: 'TSM_ME', email: '' },
        { name: 'Fatima Nasser',      team: 'TSM_SE', email: '' },
        { name: 'Ahmed Siddiqui',     team: 'TSM_SE', email: '' },
        { name: 'Layla Ibrahim',      team: 'TSM_SE', email: '' },
        { name: 'Omar Hassan',        team: 'Call Center', email: '' },
        { name: 'Mariam Al Zaabi',    team: 'Call Center', email: '' },
    ];
}

function qaGenDummyAudits() {
    var agents     = qaGenDummyAgents();
    var evaluators = ['Tehleel Lone', 'Ubaid Mir', 'Rania Saleh'];
    var auditTypes = ['Call','Call','Email','Service Review','Certification'];
    var reasons    = ['Billing Query','Technical Issue','Plan Change','Roaming','Complaint'];
    var audits     = [];

    for (var i = 0; i < 80; i++) {
        var agent     = agents[i % agents.length];
        var evaluator = evaluators[i % evaluators.length];
        var atype     = auditTypes[i % auditTypes.length];
        var daysAgo   = Math.floor(Math.random() * 180);
        var d         = new Date(); d.setDate(d.getDate() - daysAgo);
        var fmt       = function(dt) { return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0'); };
        var durSec    = atype === 'Call' ? Math.floor(Math.random() * 600 + 30) : null;

        var audit = {
            ID: i + 1,
            Title: 'QA-' + (10000 + i),
            ReferenceID: 'REF-' + (10000 + i),
            AuditType: atype,
            Team: agent.team,
            Agent: agent.name,
            Evaluator: evaluator,
            DateOfEval: fmt(new Date()),
            DateOfCall:          atype === 'Call'           ? fmt(d) : null,
            CallDuration:        durSec,
            CallDurationType:    atype === 'Call'           ? (durSec <= 120 ? 'Short' : durSec <= 300 ? 'Standard' : 'Long') : null,
            MSISDN:              atype === 'Call'           ? '971' + String(Math.floor(Math.random()*9e8+1e8)) : null,
            CallReason:          atype === 'Call'           ? reasons[i % reasons.length] : null,
            DateOfEmail:         atype === 'Email'          ? fmt(d) : null,
            EmailReason:         atype === 'Email'          ? reasons[i % reasons.length] : null,
            EmailSubject:        atype === 'Email'          ? 'RE: ' + reasons[i % reasons.length] : null,
            DateOfReview:        atype === 'Service Review' ? fmt(d) : null,
            DateOfCertification: atype === 'Certification'  ? fmt(d) : null,
            Comments: '', NAFields: '',
        };

        var criteria = qaGetCriteria(atype);
        qaAllCriteriaCols().forEach(function(cat) {
            var inScope = criteria.find(function(c) { return c.id === cat.id; });
            audit[cat.id] = inScope ? Math.floor(Math.random() * 3) : null;
        });
        audit.AvgScore = qaCalcScore(audit, atype);
        audit.Outcome  = qaOutcomeFromScore(audit.AvgScore);
        audits.push(audit);
    }
    return audits.sort(function(a, b) { return new Date(b.DateOfEval) - new Date(a.DateOfEval); });
}

// ── Styles ────────────────────────────────────────────────────
(function() {
    if (document.getElementById('qaTooltipStyle')) return;
    var s = document.createElement('style');
    s.id = 'qaTooltipStyle';
    s.innerHTML = [
        '.qa-info-btn{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;',
        'background:var(--bg-secondary);border:1px solid var(--border);color:var(--t3);font-size:9px;font-weight:700;',
        'cursor:pointer;margin-left:5px;flex-shrink:0;position:relative;}',
        '.qa-info-btn:hover .qa-tooltip{display:block;}',
        '.qa-tooltip{display:none;position:absolute;left:20px;top:50%;transform:translateY(-50%);',
        'background:#1e1b2e;color:#e2e8f0;font-size:11px;line-height:1.5;padding:8px 12px;border-radius:8px;',
        'width:240px;z-index:9999;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.4);font-weight:400;}',
        /* Score select — larger, more visible */
        '.qa-score-select{padding:6px 4px;border-radius:7px;border:2px solid var(--border);',
        'background:var(--bg-input);color:var(--t1);font-size:.9rem;font-weight:800;cursor:pointer;width:70px;text-align:center;}',
        '.qa-score-select:disabled{opacity:.25;cursor:not-allowed;}',
        '.qa-score-select.qa-required-err{border-color:#ef4444 !important;background:rgba(239,68,68,0.07);}',
        /* Criterion row */
        '.qa-criterion-row{display:flex;align-items:center;',
        'padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card);',
        'transition:opacity .2s,background .15s;min-height:44px;gap:6px;}',
        '.qa-criterion-row.qa-na-active{opacity:.45;background:var(--bg-secondary);}',
        '.qa-criterion-row.qa-row-err{border-color:#ef4444 !important;background:rgba(239,68,68,0.05);}',
        '.qa-criterion-row:hover{background:var(--bg-secondary);}',
        '.qa-crit-label{flex:1;display:flex;align-items:center;font-size:.84rem;font-weight:600;color:var(--t1);min-width:0;}',
        '.qa-crit-score{width:80px;display:flex;justify-content:center;flex-shrink:0;}',
        /* NA badge button */
        '.qa-na-btn{width:52px;display:flex;justify-content:center;flex-shrink:0;}',
        '.qa-na-toggle{padding:4px 8px;border-radius:6px;font-size:.72rem;font-weight:800;cursor:pointer;border:1px solid;transition:all .15s;white-space:nowrap;}',
        '.qa-na-toggle.na-on{background:rgba(16,185,129,0.15);border-color:#10b981;color:#10b981;}',
        '.qa-na-toggle.na-off{background:var(--bg-secondary);border-color:var(--border);color:var(--t3);}',
        '.qa-crit-comment{width:88px;display:flex;justify-content:center;flex-shrink:0;}',
        '.qa-check{width:14px;height:14px;accent-color:var(--acc);cursor:pointer;}',
        '.qa-section-header{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;',
        'color:var(--t3);padding:6px 12px;background:var(--bg-secondary);border-radius:7px;margin-bottom:4px;margin-top:8px;}',
        /* Agent search */
        '.qa-person-wrap{position:relative;}',
        '.qa-person-dd{position:absolute;top:100%;left:0;right:0;z-index:800;background:var(--bg-card);',
        'border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.2);',
        'max-height:220px;overflow-y:auto;display:none;}',
        '.qa-person-item{padding:.42rem .72rem;cursor:pointer;border-bottom:1px solid var(--border);',
        'transition:background .15s;user-select:none;}',
        '.qa-person-item:last-child{border-bottom:none;}',
        '.qa-person-item:hover{background:var(--bg-hover);}',
        /* Attachments */
        '.qa-attach-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;',
        'background:var(--bg-secondary);border:1px solid var(--border);font-size:.75rem;font-weight:600;color:var(--t2);margin:3px;}',
        '.qa-attach-del{cursor:pointer;color:var(--t3);font-size:.9rem;line-height:1;}',
        '.qa-attach-del:hover{color:#ef4444;}',
        /* Error banner */
        '.qa-error-banner{display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);',
        'color:#dc2626;padding:12px 16px;border-radius:10px;margin-bottom:1rem;font-size:.84rem;font-weight:600;}',
        /* Score legend pills */
        '.qa-score-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;}',
        /* Analytics tabs */
        '.qa-atab-btn{padding:8px 18px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--border);transition:all .15s;}',
        '.qa-atab-btn.active{background:var(--grad);color:#fff;border-color:transparent;}',
        '.qa-atab-btn:not(.active){background:var(--bg-input);color:var(--t1);}',
    ].join('\n');
    document.head.appendChild(s);
})();

// ── Render Shell ──────────────────────────────────────────────
function qaRenderShell() {
    var container = document.getElementById('qaContainer');
    if (!container) return;
    var role        = window.USER_CONTEXT && window.USER_CONTEXT.role;
    var isFullAdmin = qaIsFullAdmin();
    var isLM          = qaIsLineManager();
    var isSM          = qaIsServiceManager();
    var canSubmit     = qaCanSubmitAudit();
    var showFilters   = isFullAdmin || isLM;
    qaCurrentTab      = isSM ? 'analytics' : 'submit';

    var tabButtons = '';
    if (canSubmit) {
        tabButtons +=
        '<button type="button" id="qaTabSubmit" onclick="qaSetTab(\'submit\')" style="padding:10px 24px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:var(--grad);color:#fff;display:inline-flex;align-items:center;gap:6px;">' +
        '<i data-lucide="plus-circle" style="width:14px;height:14px;"></i>Submit Audit</button>';
    }
    tabButtons +=
        '<button type="button" id="qaTabAnalytics" onclick="qaSetTab(\'analytics\')" style="padding:10px 24px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);display:inline-flex;align-items:center;gap:6px;">' +
        '<i data-lucide="bar-chart-3" style="width:14px;height:14px;"></i>' + (showFilters ? 'Analytics' : 'My Activity') + '</button>';

    container.innerHTML =
        '<div style="background:var(--grad);border-radius:16px;padding:1.75rem 2rem;margin-bottom:1.75rem;color:#fff;display:flex;align-items:center;gap:1.25rem;">' +
        '<div style="width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<i data-lucide="shield-check" style="width:26px;height:26px;color:#fff;"></i></div>' +
        '<div><div style="font-size:1.25rem;font-weight:800;margin-bottom:.2rem;">Quality Assurance</div>' +
        '<div style="font-size:.82rem;opacity:.85;">Call, Email, Service Review & Certification audit management</div></div></div>' +

        '<div style="display:flex;gap:8px;margin-bottom:1.5rem;flex-wrap:wrap;">' +
        tabButtons +
        '</div>' +

        '<div id="qaTabSubmitSection" style="display:' + (canSubmit && qaCurrentTab === 'submit' ? 'block' : 'none') + ';">' + qaFormHTML() + '</div>' +
        '<div id="qaTabAnalyticsSection" style="display:' + (qaCurrentTab === 'analytics' ? 'block' : 'none') + ';">' + qaAnalyticsHTML(showFilters) + '</div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (isLM) {
        var teamSel = document.getElementById('qaTeam');
        var myTeams = qaGetLmTeams();
        if (teamSel) {
            teamSel.innerHTML = '<option value="">All Teams</option>';
            myTeams.forEach(function(t) {
                var opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                teamSel.appendChild(opt);
            });
        }
    }

    var typeSel = document.getElementById('qaAuditType');
    if (typeSel) typeSel.addEventListener('change', function() { qaHandleAuditTypeChange(this.value); });
    var teamSelBind = document.getElementById('qaTeam');
    if (teamSelBind) teamSelBind.addEventListener('change', function() { qaClearAgent(); qaAgentSearch(''); });

    qaSetTab(qaCurrentTab);
}

// ── Agent Search Widget (Account Mapping only, no manual) ─────
function qaAgentSearchHtml() {
    return '<label class="filter-label">Agent *</label>' +
        '<div class="qa-person-wrap">' +
            '<input type="text" id="qaAgentInput" class="filter-select" placeholder="Search agent name..." ' +
            'style="font-size:13px;padding:10px;" autocomplete="off" ' +
            'oninput="qaAgentSearch(this.value)" ' +
            'onfocus="qaAgentSearch(this.value)" ' +
            'onblur="setTimeout(function(){var d=document.getElementById(\'qaAgentDD\');if(d)d.style.display=\'none\';},250)">' +
            '<div id="qaAgentDD" class="qa-person-dd"></div>' +
        '</div>' +
        '<div id="qaAgentTag" style="display:none;margin-top:.3rem;"></div>' +
        '<input type="hidden" id="qaAgent" value="">';
}

window.qaAgentSearch = function(q) {
    var dd    = document.getElementById('qaAgentDD'); if (!dd) return;
    var team  = (document.getElementById('qaTeam') || {}).value || '';
    var lower = (q || '').toLowerCase();
    var pool  = qaGetScopedAgents();
    if (team) pool = pool.filter(function(a) { return a.team === team; });
    var results = lower ? pool.filter(function(a) { return a.name.toLowerCase().indexOf(lower) >= 0; }) : pool.slice(0, 30);

    dd.innerHTML = '';
    if (!results.length) {
        dd.innerHTML = '<div class="qa-person-item" style="color:var(--t3);font-size:.82rem;">No agents found</div>';
        dd.style.display = 'block';
        return;
    }
    results.forEach(function(a) {
        var item = document.createElement('div');
        item.className = 'qa-person-item';
        item.innerHTML = '<div style="font-size:.83rem;font-weight:600;color:var(--t1);">' + a.name + '</div>' +
            '<div style="font-size:.72rem;color:var(--t3);">' + (a.team || '') + (a.email ? ' · ' + a.email : '') + '</div>';
        item.addEventListener('mousedown', function(e) { e.preventDefault(); qaSelectAgent(a.name, a.team); });
        dd.appendChild(item);
    });
    dd.style.display = 'block';
};

window.qaSelectAgent = function(name, team) {
    document.getElementById('qaAgent').value = name;
    var inp = document.getElementById('qaAgentInput');
    var dd  = document.getElementById('qaAgentDD');
    var tag = document.getElementById('qaAgentTag');
    if (inp)    inp.value = '';
    if (dd)     dd.style.display = 'none';
    if (tag) {
        tag.innerHTML = '<span style="display:inline-flex;align-items:center;gap:.35rem;background:var(--nab);border:1px solid var(--nab2);border-radius:20px;padding:.22rem .65rem;font-size:.78rem;font-weight:600;color:var(--acc);">' +
            name + (team ? ' <span style="font-size:.65rem;opacity:.7;">(' + team + ')</span>' : '') +
            '<span style="cursor:pointer;margin-left:.2rem;font-size:.95rem;" onclick="qaClearAgent()">×</span></span>';
        tag.style.display = 'block';
    }
};

window.qaClearAgent = function() {
    document.getElementById('qaAgent').value = '';
    var inp = document.getElementById('qaAgentInput');
    var tag = document.getElementById('qaAgentTag');
    if (inp)    inp.value = '';
    if (tag)    { tag.innerHTML = ''; tag.style.display = 'none'; }
};

window.qaHandlePackFiles = function(input) {
    var newFiles = Array.from(input.files);
    newFiles.forEach(function(f) {
        if (!qaPackFiles.find(function(x) { return x.name === f.name; })) {
            qaPackFiles.push(f);
        }
    });
    input.value = '';
    qaRenderPackFiles();
};

function qaRenderPackFiles() {
    var list = document.getElementById('qaPackFilesList');
    if (!list) return;
    if (!qaPackFiles.length) {
        list.innerHTML = '<div style="font-size:12px;color:var(--t3);">No files selected</div>';
        return;
    }
    list.innerHTML = qaPackFiles.map(function(f, i) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:7px;margin-bottom:5px;">' +
            '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);">' +
            '<i data-lucide="paperclip" style="width:13px;height:13px;color:var(--acc);"></i>' +
            f.name + '<span style="color:var(--t3);font-size:11px;">(' + (f.size/1024).toFixed(1) + ' KB)</span></div>' +
            '<button type="button" onclick="qaRemovePackFile(' + i + ')" ' +
            'style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">Remove</button>' +
            '</div>';
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.qaRemovePackFile = function(i) { qaPackFiles.splice(i, 1); qaRenderPackFiles(); };

// ── Form HTML ─────────────────────────────────────────────────
function qaFormHTML() {
    return '<div class="table-section">' +
        '<h3 class="table-title" style="margin-bottom:1.5rem;"><i data-lucide="clipboard-pen" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>New Audit Entry</h3>' +
        '<div id="qaErrorBanner" class="qa-error-banner"></div>' +

        '<div style="background:var(--bg-secondary);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;">' +
        '<div style="font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--t3);letter-spacing:.06em;margin-bottom:1rem;">Audit Information</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">' +

        '<div class="filter-group"><label class="filter-label">Team</label><select class="filter-select" id="qaTeam" style="font-size:14px;padding:10px;"><option value="">All Teams</option><option value="DSM">DSM</option><option value="TSM_ME">TSM_ME</option><option value="TSM_SE">TSM_SE</option><option value="Call Center">Call Center</option></select></div>' +
        '<div class="filter-group">' + qaAgentSearchHtml() + '</div>' +
        '<div class="filter-group"><label class="filter-label">Audit Type *</label><select class="filter-select" id="qaAuditType" style="font-size:14px;padding:10px;"><option value="">Select type...</option><option value="Call">Call</option><option value="Email">Email</option><option value="Service Review">Service Review</option><option value="Certification">Certification</option></select></div>' +

        '<div class="filter-group"><label class="filter-label">Reference ID</label><input type="text" class="filter-select" id="qaReferenceID" placeholder="Reference number (optional)" style="cursor:text;font-size:14px;padding:10px;"></div>' +
        '<div class="filter-group"><label class="filter-label">Date of Evaluation</label><input type="date" class="filter-select" id="qaDateOfEval" readonly style="font-size:14px;padding:10px;background:var(--bg-secondary);cursor:not-allowed;opacity:.7;" value="' + new Date().toISOString().split('T')[0] + '"></div>' +
        '<div class="filter-group" id="qaDateFieldWrap" style="display:none;"><label class="filter-label" id="qaDateFieldLabel">Date</label><input type="date" class="filter-select" id="qaDateField" style="font-size:14px;padding:10px;"></div>' +

        '<div class="filter-group" id="qaMSISDNWrap" style="display:none;"><label class="filter-label">MSISDN</label><input type="text" class="filter-select" id="qaMSISDN" placeholder="e.g. 971501234567" style="cursor:text;font-size:14px;padding:10px;"></div>' +
        '<div class="filter-group" id="qaDurationWrap" style="display:none;"><label class="filter-label">Call Duration</label><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><input type="number" id="qaDurMin" min="0" max="999" value="0" oninput="qaUpdateDurBadge()" style="width:65px;text-align:center;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:.9rem;font-weight:700;"><span style="font-size:.78rem;color:var(--t3);font-weight:600;">min</span><input type="number" id="qaDurSec" min="0" max="59" value="0" oninput="qaUpdateDurBadge()" style="width:65px;text-align:center;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:.9rem;font-weight:700;"><span style="font-size:.78rem;color:var(--t3);font-weight:600;">sec</span><div id="qaDurBadge" style="padding:4px 10px;border-radius:20px;font-size:.72rem;font-weight:700;background:var(--chip);color:var(--t3);border:1px solid var(--border);">—</div></div></div>' +
        '<div class="filter-group" id="qaCallReasonWrap" style="display:none;"><label class="filter-label">Call Reason</label><input type="text" class="filter-select" id="qaCallReason" placeholder="Reason for call" style="cursor:text;font-size:14px;padding:10px;"></div>' +

        '<div class="filter-group" id="qaEmailReasonWrap" style="display:none;"><label class="filter-label">Email Reason</label><input type="text" class="filter-select" id="qaEmailReason" placeholder="Reason for email" style="cursor:text;font-size:14px;padding:10px;"></div>' +
        '<div class="filter-group" id="qaEmailSubjectWrap" style="display:none;"><label class="filter-label">Email Subject *</label><input type="text" class="filter-select" id="qaEmailSubject" placeholder="Email subject line" style="cursor:text;font-size:14px;padding:10px;"></div>' +
        '</div>' +

        // Email attachments
        '<div id="qaAttachWrap" style="display:none;margin-top:14px;">' +
        '<div style="background:rgba(239,68,68,0.06);border:1.5px dashed #ef9f27;border-radius:10px;padding:14px;">' +
        '<div style="font-size:.75rem;font-weight:700;color:#854f0b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">⚠️ Email Attachments — Required</div>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--grad);color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">' +
        '<i data-lucide="plus" style="width:13px;height:13px;"></i> Add Files' +
        '<input type="file" id="qaPackFilesInput" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.msg,.eml" style="display:none;" onchange="qaHandlePackFiles(this)">' +
        '</label>' +
        '<span style="font-size:11px;color:#854f0b;">Attach email evidence files (PDF, images, etc.)</span>' +
        '</div>' +
        '<div id="qaPackFilesList"><div style="font-size:12px;color:var(--t3);">No files selected</div></div>' +
        '</div></div>' +
        '</div>' +

        // Scoring
        '<div style="background:var(--bg-secondary);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">' +
        '<div style="font-size:.85rem;font-weight:800;text-transform:uppercase;color:var(--t1);letter-spacing:.06em;">Scoring Criteria</div>' +
        '</div>' +
        // Score legend — prominent
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:1rem;padding:.65rem 1rem;background:var(--bg-card);border-radius:9px;border:1px solid var(--border);">' +
        '<span style="font-size:.75rem;font-weight:700;color:var(--t2);margin-right:4px;">Score Guide:</span>' +
        '<span class="qa-score-pill" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);">0 — Not done / Poor</span>' +
        '<span class="qa-score-pill" style="background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);">1 — Partially done</span>' +
        '<span class="qa-score-pill" style="background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.3);">2 — Done well</span>' +
        '<span class="qa-score-pill" style="background:rgba(99,102,241,0.12);color:#6366f1;border:1px solid rgba(99,102,241,0.3);">N/A — Excluded from score</span>' +
        '<span style="font-size:.72rem;color:#ef4444;font-weight:700;margin-left:auto;">★ All criteria default to N/A — uncheck N/A to score</span>' +
        '</div>' +

        '<div id="qaScoringPlaceholder" style="text-align:center;padding:2rem;color:var(--t3);font-size:.85rem;">Select an Audit Type above to load scoring criteria</div>' +
        '<div id="qaScoringGrid" style="display:none;">' +
        // Column headers
        '<div style="display:flex;align-items:center;padding:6px 12px;margin-bottom:6px;border-radius:7px;background:var(--bg-card);border:1px solid var(--border);">' +
        '<div style="flex:1;font-size:.7rem;font-weight:800;text-transform:uppercase;color:var(--t2);">Criterion</div>' +
        '<div style="width:80px;text-align:center;font-size:.7rem;font-weight:800;text-transform:uppercase;color:var(--t2);flex-shrink:0;">Score (0–2)</div>' +
        '<div style="width:52px;text-align:center;font-size:.7rem;font-weight:800;text-transform:uppercase;color:#6366f1;flex-shrink:0;">N/A</div>' +
        '<div style="width:88px;text-align:center;font-size:.7rem;font-weight:800;text-transform:uppercase;color:var(--t2);flex-shrink:0;">Comment</div>' +
        '</div>' +
        '<div id="qaCriteriaRows" style="display:flex;flex-direction:column;gap:5px;max-height:500px;overflow-y:auto;padding-right:4px;"></div>' +
        '</div>' +

        '<div id="qaScoreSummary" style="display:none;margin-top:.85rem;padding:.85rem 1rem;background:var(--bg-card);border-radius:10px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">' +
        '<div><div style="font-size:.88rem;font-weight:700;color:var(--t2);">Total Score</div><div id="qaScoreBreakdown" style="font-size:.7rem;color:var(--t3);margin-top:2px;">No scores entered yet</div></div>' +
        '<div id="qaTotalScoreDisplay" style="font-size:1.7rem;font-weight:900;color:var(--t3);">— / 100</div></div>' +
        '</div>' +

        '<div id="qaCommentBlock" style="display:none;background:var(--bg-secondary);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;"><div style="font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--t3);letter-spacing:.06em;margin-bottom:1rem;">Comments</div><div id="qaCommentInputs" style="display:flex;flex-direction:column;gap:8px;"></div></div>' +

        '<div id="qaOutcomeSection" style="display:none;background:var(--bg-secondary);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;"><div style="font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--t3);letter-spacing:.06em;margin-bottom:1rem;">Outcome</div><div style="display:flex;gap:12px;"><label id="qaOutcomePass" style="flex:1;padding:14px;border-radius:10px;border:2px solid var(--border);cursor:pointer;text-align:center;transition:all .2s;" onclick="qaSelectOutcome(\'Pass\')"><div style="font-size:1.2rem;">✅</div><div style="font-weight:700;color:#10b981;font-size:.9rem;">Pass</div><div style="font-size:.75rem;color:var(--t3);">Score 70+</div></label><label id="qaOutcomeNeeds" style="flex:1;padding:14px;border-radius:10px;border:2px solid var(--border);cursor:pointer;text-align:center;transition:all .2s;" onclick="qaSelectOutcome(\'Needs Improvement\')"><div style="font-size:1.2rem;">⚠️</div><div style="font-weight:700;color:#f59e0b;font-size:.9rem;">Needs Improvement</div><div style="font-size:.75rem;color:var(--t3);">Score 50–69</div></label><label id="qaOutcomeFail" style="flex:1;padding:14px;border-radius:10px;border:2px solid var(--border);cursor:pointer;text-align:center;transition:all .2s;" onclick="qaSelectOutcome(\'Fail\')"><div style="font-size:1.2rem;">❌</div><div style="font-weight:700;color:#ef4444;font-size:.9rem;">Fail</div><div style="font-size:.75rem;color:var(--t3);">Score below 50</div></label></div></div>' +

        '<div style="display:flex;gap:12px;"><button type="button" class="export-btn" onclick="qaSubmitAudit()" style="flex:1;padding:14px;font-size:14px;"><i data-lucide="send" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Submit Audit</button><button type="button" class="reset-btn" onclick="qaClearForm()" style="padding:14px 20px;"><i data-lucide="rotate-ccw" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Clear</button></div>' +
        '<div id="qaSubmitMsg" style="margin-top:12px;text-align:center;font-weight:600;"></div>' +
        '</div>';
}

// ── Audit Type Change ─────────────────────────────────────────
window.qaHandleAuditTypeChange = function(type) {
    ['qaMSISDNWrap','qaDurationWrap','qaCallReasonWrap','qaEmailReasonWrap','qaEmailSubjectWrap','qaAttachWrap','qaDateFieldWrap'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    if (type === 'Call') {
        ['qaMSISDNWrap','qaDurationWrap','qaCallReasonWrap','qaDateFieldWrap'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='block';});
        var l = document.getElementById('qaDateFieldLabel'); if (l) l.textContent = 'Date of Call *';
    } else if (type === 'Email') {
        ['qaEmailReasonWrap','qaEmailSubjectWrap','qaAttachWrap','qaDateFieldWrap'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='block';});
        var l2 = document.getElementById('qaDateFieldLabel'); if (l2) l2.textContent = 'Date of Email *';
    } else if (type === 'Service Review') {
        var dw = document.getElementById('qaDateFieldWrap'); if (dw) dw.style.display = 'block';
        var l3 = document.getElementById('qaDateFieldLabel'); if (l3) l3.textContent = 'Date of Review';
    } else if (type === 'Certification') {
        var dw2 = document.getElementById('qaDateFieldWrap'); if (dw2) dw2.style.display = 'block';
        var l4  = document.getElementById('qaDateFieldLabel'); if (l4) l4.textContent = 'Date of Certification';
    }

    if (type) {
        qaRenderCriteriaRows(type);
        var g = document.getElementById('qaScoringGrid'); if (g) g.style.display = 'block';
        var p = document.getElementById('qaScoringPlaceholder'); if (p) p.style.display = 'none';
        var sm = document.getElementById('qaScoreSummary'); if (sm) sm.style.display = 'flex';
        var os = document.getElementById('qaOutcomeSection'); if (os) os.style.display = 'block';
    } else {
        var g2 = document.getElementById('qaScoringGrid'); if (g2) g2.style.display = 'none';
        var p2 = document.getElementById('qaScoringPlaceholder'); if (p2) p2.style.display = 'block';
        var sm2 = document.getElementById('qaScoreSummary'); if (sm2) sm2.style.display = 'none';
        var os2 = document.getElementById('qaOutcomeSection'); if (os2) os2.style.display = 'none';
    }
    qaHideError();
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ── Render Criteria Rows (N/A default ON) ─────────────────────
function qaRenderCriteriaRows(type) {
    var container = document.getElementById('qaCriteriaRows'); if (!container) return;
    container.innerHTML = '';
    function buildRows(criteria) {
        criteria.forEach(function(cat) {
            var row = document.createElement('div');
            row.id = 'qaRow_' + cat.id;
            row.className = 'qa-criterion-row qa-na-active'; // N/A on by default
            row.innerHTML =
                '<div class="qa-crit-label">' +
                    '<span style="font-size:.85rem;font-weight:600;color:var(--t1);">' + cat.label + '</span>' +
                    '<span class="qa-info-btn">i<span class="qa-tooltip">' + cat.desc + '</span></span>' +
                '</div>' +
                // Score — hidden when NA is on
                '<div class="qa-crit-score">' +
                    '<select id="qaScore_' + cat.id + '" class="qa-score-select" disabled ' +
                    'onchange="qaLiveScore();qaHideError()" ' +
                    'style="display:none;">' +  // hidden until NA unchecked
                    '<option value="">—</option>' +
                    '<option value="0" style="color:#ef4444;font-weight:800;">0</option>' +
                    '<option value="1" style="color:#f59e0b;font-weight:800;">1</option>' +
                    '<option value="2" style="color:#10b981;font-weight:800;">2</option>' +
                    '</select>' +
                    // Score badge shown when NA is on
                    '<span id="qaScoreBadge_' + cat.id + '" style="font-size:.72rem;font-weight:700;color:#6366f1;">N/A</span>' +
                '</div>' +
                '<div class="qa-na-btn">' +
                    '<button type="button" id="qaNaBtn_' + cat.id + '" class="qa-na-toggle na-on" ' +
                    'onclick="qaToggleNA(\'' + cat.id + '\')" title="Click to score this criterion">N/A</button>' +
                '</div>' +
                '<div class="qa-crit-comment">' +
                    '<input type="checkbox" class="qa-check" id="qaAddComment_' + cat.id + '" onchange="qaUpdateCommentBlock(true)">' +
                '</div>';
            // Store NA state on the row
            row.dataset.naOn = 'true';
            container.appendChild(row);
        });
    }
    buildRows(qaGetCriteria(type));
    qaLiveScore();
}

// ── N/A Toggle (button-based) ─────────────────────────────────
window.qaToggleNA = function(catId) {
    var row    = document.getElementById('qaRow_' + catId);
    var sc     = document.getElementById('qaScore_' + catId);
    var badge  = document.getElementById('qaScoreBadge_' + catId);
    var btn    = document.getElementById('qaNaBtn_' + catId);
    var co     = document.getElementById('qaAddComment_' + catId);
    if (!row || !sc || !btn) return;

    var naOn = row.dataset.naOn === 'true';

    if (naOn) {
        // Turn N/A OFF → show score select
        row.dataset.naOn = 'false';
        row.classList.remove('qa-na-active');
        row.classList.remove('qa-row-err');
        sc.style.display = 'block';
        sc.disabled = false;
        if (badge) badge.style.display = 'none';
        btn.classList.remove('na-on');
        btn.classList.add('na-off');
        btn.textContent = 'N/A';
    } else {
        // Turn N/A ON → hide score select
        row.dataset.naOn = 'true';
        row.classList.add('qa-na-active');
        sc.style.display = 'none';
        sc.disabled = true;
        sc.value = '';
        sc.classList.remove('qa-required-err');
        if (badge) badge.style.display = 'inline';
        if (co) co.checked = false;
        btn.classList.add('na-on');
        btn.classList.remove('na-off');
        btn.textContent = 'N/A';
    }
    qaLiveScore();
    qaUpdateCommentBlock(false);
    qaHideError();
};

// ── Duration Badge ────────────────────────────────────────────
window.qaUpdateDurBadge = function() {
    var min = parseInt((document.getElementById('qaDurMin') || {}).value) || 0;
    var sec = parseInt((document.getElementById('qaDurSec') || {}).value) || 0;
    var total = min * 60 + sec;
    var badge = document.getElementById('qaDurBadge'); if (!badge) return;
    if (!total) { badge.textContent = '—'; badge.style.color = 'var(--t3)'; badge.style.background = 'var(--chip)'; badge.style.borderColor = 'var(--border)'; return; }
    var cfg = total <= 120 ? {label:'Short (0–2 min)',color:'#185fa5',bg:'rgba(56,139,229,0.12)'} : total <= 300 ? {label:'Standard (2–5 min)',color:'#854f0b',bg:'rgba(245,158,11,0.12)'} : {label:'Long (5+ min)',color:'#085041',bg:'rgba(16,185,129,0.12)'};
    badge.textContent = cfg.label; badge.style.color = cfg.color; badge.style.background = cfg.bg; badge.style.borderColor = cfg.color + '55';
};

// ── Live Score ────────────────────────────────────────────────
window.qaLiveScore = function() {
    var type = (document.getElementById('qaAuditType') || {}).value || '';
    var criteria = qaGetCriteria(type);
    var scores = {};
    criteria.forEach(function(cat) {
        var row = document.getElementById('qaRow_' + cat.id);
        var sc  = document.getElementById('qaScore_' + cat.id);
        if (!sc) return;
        var naOn = row && row.dataset.naOn === 'true';
        if (naOn) { scores[cat.id] = null; return; }
        var v = sc.value;
        scores[cat.id] = (v === '' || v === undefined) ? null : parseFloat(v);
    });
    var filled = criteria.filter(function(c) { var s = scores[c.id]; return s !== null && s !== undefined && !isNaN(s); });
    var disp = document.getElementById('qaTotalScoreDisplay');
    var bd   = document.getElementById('qaScoreBreakdown');
    if (!filled.length) {
        if (disp) { disp.textContent = '— / 100'; disp.style.color = 'var(--t3)'; }
        if (bd) bd.textContent = 'No scores entered yet';
        return 0;
    }
    var pct = qaCalcScore(scores, type);
    var color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
    if (disp) { disp.textContent = pct + ' / 100'; disp.style.color = color; }
    if (bd) bd.textContent = 'Based on ' + filled.length + ' of ' + criteria.length + ' criteria scored';
    qaSelectOutcome(qaOutcomeFromScore(pct));
    return pct;
};

// ── Comment Block ─────────────────────────────────────────────
window.qaUpdateCommentBlock = function(scrollToIt) {
    var block  = document.getElementById('qaCommentBlock');
    var inputs = document.getElementById('qaCommentInputs');
    if (!block || !inputs) return;
    var type     = (document.getElementById('qaAuditType') || {}).value || '';
    var criteria = qaGetCriteria(type);
    var selected = criteria.filter(function(cat) {
        var cb = document.getElementById('qaAddComment_' + cat.id);
        return cb && cb.checked;
    });
    if (!selected.length) { block.style.display = 'none'; inputs.innerHTML = ''; return; }
    block.style.display = 'block';
    var existing = {};
    inputs.querySelectorAll('input[data-cid]').forEach(function(el) { existing[el.getAttribute('data-cid')] = el.value; });
    inputs.innerHTML = selected.map(function(cat) {
        var prev = existing[cat.id] || '';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border);">' +
            '<span style="font-size:.82rem;font-weight:700;color:var(--t2);white-space:nowrap;min-width:200px;">' + cat.label + ':</span>' +
            '<input type="text" data-cid="' + cat.id + '" value="' + prev.replace(/"/g, '&quot;') + '" placeholder="Enter comment..." style="flex:1;padding:7px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg-input);color:var(--t1);font-size:.85rem;">' +
            '</div>';
    }).join('');
    if (scrollToIt) {
        setTimeout(function() {
            block.scrollIntoView({ behavior: 'smooth', block: 'start' });
            var all = inputs.querySelectorAll('input[data-cid]');
            var last = all[all.length - 1]; if (last) last.focus();
        }, 80);
    }
};

function qaGetMergedComments() {
    var parts = [];
    document.querySelectorAll('#qaCommentInputs input[data-cid]').forEach(function(el) {
        var val = (el.value || '').trim(); if (!val) return;
        var cid = el.getAttribute('data-cid');
        var all = qaAllCriteriaCols();
        var cat = all.find(function(c) { return c.id === cid; });
        parts.push((cat ? cat.label : cid) + ': ' + val);
    });
    return parts.join('\n');
}

// ── Outcome Selector ──────────────────────────────────────────
var qaSelectedOutcome = '';
window.qaSelectOutcome = function(outcome) {
    qaSelectedOutcome = outcome;
    var map = {
        'Pass':             { id: 'qaOutcomePass',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        'Needs Improvement':{ id: 'qaOutcomeNeeds', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        'Fail':             { id: 'qaOutcomeFail',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
    };
    Object.keys(map).forEach(function(o) {
        var el = document.getElementById(map[o].id);
        if (!el) return;
        if (o === outcome) { el.style.border = '2px solid ' + map[o].color; el.style.background = map[o].bg; }
        else               { el.style.border = '2px solid var(--border)';   el.style.background = 'transparent'; }
    });
};

// ── Tab Switch ────────────────────────────────────────────────
window.qaSetTab = function(tab) {
    if (tab === 'submit' && !qaCanSubmitAudit()) tab = 'analytics';
    qaCurrentTab = tab;
    var canSubmit = qaCanSubmitAudit();
    if (canSubmit) {
        ['submit', 'analytics'].forEach(function(t) {
            var btn = document.getElementById('qaTab' + t.charAt(0).toUpperCase() + t.slice(1));
            if (btn) { btn.style.background = t === tab ? 'var(--grad)' : 'var(--bg-input)'; btn.style.color = t === tab ? '#fff' : 'var(--t1)'; btn.style.border = t === tab ? 'none' : '1px solid var(--border)'; }
            var sec = document.getElementById('qaTab' + t.charAt(0).toUpperCase() + t.slice(1) + 'Section');
            if (sec) sec.style.display = t === tab ? 'block' : 'none';
        });
    } else {
        var submitSec = document.getElementById('qaTabSubmitSection');
        var analyticsSec = document.getElementById('qaTabAnalyticsSection');
        var analyticsBtn = document.getElementById('qaTabAnalytics');
        if (submitSec) submitSec.style.display = 'none';
        if (analyticsSec) analyticsSec.style.display = 'block';
        if (analyticsBtn) {
            analyticsBtn.style.background = 'var(--grad)';
            analyticsBtn.style.color = '#fff';
            analyticsBtn.style.border = 'none';
        }
    }
    if (tab === 'analytics') qaRenderAnalytics();
};

// ── Validate & Submit ─────────────────────────────────────────
window.qaSubmitAudit = async function() {
    qaHideError();

    var auditType  = (document.getElementById('qaAuditType')   || {}).value || '';
    var refID      = ((document.getElementById('qaReferenceID') || {}).value || '').trim();
    var dateField  = (document.getElementById('qaDateField')    || {}).value || '';
    var dateOfEval = (document.getElementById('qaDateOfEval')   || {}).value || '';
    var agentName  = (document.getElementById('qaAgent')        || {}).value || '';

    var errors = [];
    if (!agentName)  errors.push('Agent is required — search and select from the list.');
    if (!auditType)  errors.push('Audit Type is required.');
    if ((auditType === 'Call' || auditType === 'Email') && !dateField) errors.push('Date is required for ' + auditType + ' audits.');

    // Email subject mandatory
    if (auditType === 'Email') {
        var emailSubj = ((document.getElementById('qaEmailSubject') || {}).value || '').trim();
        if (!emailSubj) errors.push('Email Subject is required for Email audits.');
    }

    // Scoring: every criterion must be scored OR N/A
    if (auditType) {
        var criteria = qaGetCriteria(auditType);
        var unscoredLabels = [];
        criteria.forEach(function(cat) {
            var row  = document.getElementById('qaRow_' + cat.id);
            var sc   = document.getElementById('qaScore_' + cat.id);
            if (!sc) return;
            var naOn = row && row.dataset.naOn === 'true';
            if (naOn) return; // N/A is fine
            if (sc.value === '' || sc.value === undefined) {
                unscoredLabels.push(cat.label);
                sc.classList.add('qa-required-err');
                if (row) row.classList.add('qa-row-err');
            } else {
                sc.classList.remove('qa-required-err');
                if (row) row.classList.remove('qa-row-err');
            }
        });
        if (unscoredLabels.length) {
            errors.push('All active criteria must be scored. Missing: ' + unscoredLabels.slice(0,3).join(', ') + (unscoredLabels.length > 3 ? ' and ' + (unscoredLabels.length-3) + ' more.' : '.'));
        }
    }

    if (!qaSelectedOutcome) errors.push('Outcome is required — select Pass, Needs Improvement, or Fail.');

    if (auditType === 'Email' && qaPackFiles.length === 0) {
        errors.push('Email audit requires at least one attachment (email evidence file).');
    }

    if (errors.length) {
        qaShowError(errors.map(function(e,i){ return (i+1) + '. ' + e; }).join('<br>'));
        return;
    }

    // ── Build score data ──────────────────────────────────────
    var criteriaAll = qaGetCriteria(auditType);
    var scoreData = {}, naFields = [];
    qaAllCriteriaCols().forEach(function(cat) {
        var inScope = criteriaAll.find(function(c) { return c.id === cat.id; });
        if (!inScope) { scoreData[cat.id] = null; return; }
        var row  = document.getElementById('qaRow_' + cat.id);
        var sc   = document.getElementById('qaScore_' + cat.id);
        var naOn = row && row.dataset.naOn === 'true';
        if (naOn) { scoreData[cat.id] = null; naFields.push(cat.id); return; }
        var v = sc ? sc.value : '';
        scoreData[cat.id] = (v === '' || v === undefined) ? null : parseFloat(v);
    });

    var totalScore    = qaCalcScore(scoreData, auditType);
    var comments      = qaGetMergedComments();
    var evaluatorName = window.USER_CONTEXT ? window.USER_CONTEXT.userName : '';
    var durSec = null, durType = null;
    if (auditType === 'Call') {
        var min = parseInt((document.getElementById('qaDurMin') || {}).value) || 0;
        var sec = parseInt((document.getElementById('qaDurSec') || {}).value) || 0;
        durSec  = (min * 60 + sec) || null;
        durType = durSec ? (durSec <= 120 ? 'Short' : durSec <= 300 ? 'Standard' : 'Long') : null;
    }

    var msgEl = document.getElementById('qaSubmitMsg');
    if (msgEl) msgEl.innerHTML = '<span style="color:var(--t3);">Submitting...</span>';

    try {
        var agentId     = await qaGetUserId(agentName);
        var evaluatorId = await qaGetUserId(evaluatorName);

        var digestRes = await fetch(SP_URL + '/_api/contextinfo', { method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!digestRes.ok) throw new Error('Failed to get form digest');
        var digest = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;

        var body = {
            __metadata: { type: 'SP.Data.QA_x005f_AuditListItem' },
            Title:       refID || (auditType + '-' + new Date().toISOString().split('T')[0]),
            ReferenceID: refID || '',
            AuditType:   auditType,
            EvaluatorId: evaluatorId,
            DateOfEval:  dateOfEval,
            AvgScore:    totalScore,
            Outcome:     qaSelectedOutcome,
        };

        var team = (document.getElementById('qaTeam') || {}).value || '';
        if (team) body.Team = team;
       if (agentId) body.AgentId = agentId;
body.Agentt = agentName;
        if (naFields.length) {
            var naCompact = naFields.map(function(f) { return f.split('_')[0]; }).join('|');
            body.NAFileds = naCompact.substring(0, 255);
        }

        if (comments.trim()) body.Comments = comments;

        if (auditType === 'Call' && dateField) {
            body.DateOfCall = new Date(dateField).toISOString();
            if (durType) body.CallDurationType = durType;
            if (durSec)  body['Call_x0020_Duration'] = durSec;
            var msisdn     = ((document.getElementById('qaMSISDN')     || {}).value || '').trim();
            var callReason = ((document.getElementById('qaCallReason')  || {}).value || '').trim();
            if (msisdn)      body.MSISDN     = msisdn;
            if (callReason)  body.CallReason = callReason;
        }
        if (auditType === 'Email' && dateField) {
            body.DateOfEmail = new Date(dateField).toISOString();
            var emailReason  = ((document.getElementById('qaEmailReason')  || {}).value || '').trim();
            var emailSubject = ((document.getElementById('qaEmailSubject') || {}).value || '').trim();
            if (emailReason)  body.EmailReason  = emailReason;
            if (emailSubject) body.EmailSubject = emailSubject;
        }
        if (auditType === 'Service Review' && dateField) body.DateOfReview        = new Date(dateField).toISOString();
        if (auditType === 'Certification'  && dateField) body.DateOfCertification = new Date(dateField).toISOString();

        // Score columns — only non-null
        qaAllCriteriaCols().forEach(function(cat) {
            var v = scoreData[cat.id];
            if (v !== null && v !== undefined && !isNaN(v)) body[cat.id] = v;
        });

        console.log('[QA] Submitting body:', JSON.stringify(body, null, 2));
        var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + QA_LIST + "')/items", {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest },
            credentials: 'include', body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Submit failed: ' + await res.text());

        var newItem   = await res.json();
        var newItemId = newItem && newItem.d && newItem.d.ID;

        var attFailed = 0;
        if (newItemId && qaPackFiles.length) {
            for (var fi = 0; fi < qaPackFiles.length; fi++) {
                var ok = await qaUploadAttachment(newItemId, qaPackFiles[fi]);
                if (!ok) attFailed++;
            }
        }

        if (attFailed > 0) {
            if (msgEl) msgEl.innerHTML = '<span style="color:#f59e0b;">⚠️ Audit saved but ' + attFailed + ' attachment(s) failed to upload.</span>';
        } else {
            if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Audit submitted successfully!</span>';
        }

        qaPackFiles = [];
        qaClearForm();
        await qaFetchAudits();
        setTimeout(function() { if (msgEl) msgEl.innerHTML = ''; }, 4000);

    } catch(e) {
        console.error('[QA]', e);
        qaShowError('Submit failed: ' + e.message);
        if (msgEl) msgEl.innerHTML = '';
    }
};

// ── Clear Form ────────────────────────────────────────────────
window.qaClearForm = function() {
    qaClearAgent();
    qaPackFiles = [];
    qaRenderPackFiles();
    qaHideError();
    ['qaReferenceID','qaMSISDN','qaCallReason','qaEmailReason','qaEmailSubject','qaDateField'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
    var ts = document.getElementById('qaTeam'); if (ts) ts.selectedIndex = 0;
    var at = document.getElementById('qaAuditType'); if (at) { at.selectedIndex = 0; qaHandleAuditTypeChange(''); }
    var de = document.getElementById('qaDateOfEval'); if (de) de.value = new Date().toISOString().split('T')[0];
    ['qaDurMin','qaDurSec'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = '0'; }); qaUpdateDurBadge();
    var cb = document.getElementById('qaCommentBlock'); if (cb) cb.style.display = 'none';
    var ci = document.getElementById('qaCommentInputs'); if (ci) ci.innerHTML = '';
    qaSelectedOutcome = '';
    ['qaOutcomePass','qaOutcomeNeeds','qaOutcomeFail'].forEach(function(id){ var el = document.getElementById(id); if (el) { el.style.border = '2px solid var(--border)'; el.style.background = 'transparent'; } });
    var d = document.getElementById('qaTotalScoreDisplay'); if (d) { d.textContent = '— / 100'; d.style.color = 'var(--t3)'; }
    var b = document.getElementById('qaScoreBreakdown'); if (b) b.textContent = 'No scores entered yet';
};

// ── Analytics HTML ────────────────────────────────────────────
function qaAnalyticsHTML(showFilters) {
    var filterRow = showFilters ?
        '<div style="display:flex;gap:10px;margin-bottom:1rem;flex-wrap:wrap;align-items:flex-end;">' +
        '<div class="filter-group" style="min-width:140px;"><label class="filter-label">Team</label><select class="filter-select" id="qaFilterTeam" onchange="qaCascadeAnalyticsTeam()" style="font-size:13px;padding:8px;"><option value="">All Teams</option></select></div>' +
        '<div class="filter-group" style="min-width:150px;"><label class="filter-label">Agent</label><select class="filter-select" id="qaFilterAgent" onchange="qaRenderAnalytics()" style="font-size:13px;padding:8px;"><option value="">All Agents</option></select></div>' +
        '<div class="filter-group" style="min-width:150px;"><label class="filter-label">Evaluator</label><select class="filter-select" id="qaFilterEvaluator" onchange="qaRenderAnalytics()" style="font-size:13px;padding:8px;"><option value="">All Evaluators</option></select></div>' +
        '<div class="filter-group" style="min-width:130px;"><label class="filter-label">From</label><input type="date" class="filter-select" id="qaFilterFrom" onchange="qaRenderAnalytics()" style="font-size:13px;padding:8px;"></div>' +
        '<div class="filter-group" style="min-width:130px;"><label class="filter-label">To</label><input type="date" class="filter-select" id="qaFilterTo" onchange="qaRenderAnalytics()" style="font-size:13px;padding:8px;"></div>' +
        // Agent/Evaluator name search
        '<div class="filter-group" style="min-width:180px;"><label class="filter-label">Quick Search</label>' +
        '<input type="text" class="filter-select" id="qaAnalyticsSearch" placeholder="Search agent or evaluator..." style="font-size:13px;padding:8px;" oninput="qaRenderAnalytics()"></div>' +
        '<button type="button" class="reset-btn" onclick="qaResetFilters()" style="padding:8px 16px;font-size:12px;align-self:flex-end;"><i data-lucide="rotate-ccw" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Reset</button>' +
        '</div>' : '';

    // 4 audit type tabs
    var typeTabs = '<div style="display:flex;gap:8px;margin-bottom:1.25rem;flex-wrap:wrap;">' +
        ['Call','Email','Service Review','Certification'].map(function(t) {
            var icons = {Call:'phone-call', Email:'mail', 'Service Review':'clipboard-list', Certification:'award'};
            return '<button type="button" class="qa-atab-btn' + (t === qaAnalyticsTab ? ' active' : '') + '" ' +
                'onclick="qaSetAnalyticsTab(\'' + t + '\')">' +
                '<i data-lucide="' + icons[t] + '" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>' + t + '</button>';
        }).join('') +
        '</div>';

    return filterRow + typeTabs +
        '<div id="qaSelectionTiles" style="margin-bottom:1.5rem;display:none;"></div>' +
        '<div id="qaKPITiles" style="margin-bottom:1.5rem;"></div>' +
        '<div style="text-align:center;margin-bottom:1.25rem;">' +
        '<button type="button" class="export-btn" onclick="qaToggleCharts()" style="padding:10px 24px;font-size:13px;">' +
        '<i data-lucide="eye" id="qaChartsIcon" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
        '<span id="qaChartsBtnText">Show Analytics Charts</span></button></div>' +
        '<div id="qaChartsSection" style="display:none;"></div>' +
        '<div id="qaAuditGrid" style="margin-top:1rem;"></div>';
}

window.qaSetAnalyticsTab = function(tab) {
    qaAnalyticsTab = tab;
    // Update tab button styles
    document.querySelectorAll('.qa-atab-btn').forEach(function(btn) {
        if (btn.textContent.trim().indexOf(tab) >= 0) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    if (qaChartsVisible) {
        // Re-render charts for new tab
        var data = qaGetFiltered();
        document.getElementById('qaChartsSection').innerHTML = qaChartsHTML();
        qaRenderCharts(data);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    qaRenderAnalytics();
};

window.qaGetFiltered = function() {
    var isFullAdmin = qaIsFullAdmin();
    var data        = qaAllAudits.filter(function(a) { return a.AuditType === qaAnalyticsTab; });

    if (!isFullAdmin) {
        data = data.filter(qaAuditBelongsToScope);
    }

    if (isFullAdmin || qaIsLineManager()) {
        var team      = (document.getElementById('qaFilterTeam')      || {}).value || '';
        var agent     = (document.getElementById('qaFilterAgent')     || {}).value || '';
        var evaluator = (document.getElementById('qaFilterEvaluator') || {}).value || '';
        var from      = (document.getElementById('qaFilterFrom')      || {}).value || '';
        var to        = (document.getElementById('qaFilterTo')        || {}).value || '';
        var search    = ((document.getElementById('qaAnalyticsSearch') || {}).value || '').toLowerCase().trim();

        return data.filter(function(a) {
            if (team      && a.Team      !== team)      return false;
            if (agent     && a.Agentt    !== agent)     return false;
            if (evaluator && a.Evaluator !== evaluator) return false;
            if (search && !(a.Agent || '').toLowerCase().includes(search) && !(a.Evaluator || '').toLowerCase().includes(search)) return false;
            var d = a.DateOfCall || a.DateOfEmail || a.DateOfReview || a.DateOfCertification || a.DateOfEval;
            if (from && d && new Date(d) < new Date(from)) return false;
            if (to   && d && new Date(d) > new Date(to))   return false;
            return true;
        });
    }

    return data;
};

window.qaResetFilters = function() {
    ['qaFilterTeam','qaFilterAgent','qaFilterEvaluator'].forEach(function(id) { var el = document.getElementById(id); if (el) el.selectedIndex = 0; });
    ['qaFilterFrom','qaFilterTo'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    var qs = document.getElementById('qaAnalyticsSearch'); if (qs) qs.value = '';
    qaRenderAnalytics();
};

window.qaCascadeAnalyticsTeam = function() {
    var team = (document.getElementById('qaFilterTeam') || {}).value || '';
    var sel  = document.getElementById('qaFilterAgent');
    if (sel) {
        sel.innerHTML = '<option value="">All Agents</option>';
        var pool = qaIsFullAdmin() ? qaAllAudits : qaAllAudits.filter(qaAuditBelongsToScope);
        if (team) pool = pool.filter(function(a) { return a.Team === team; });
        [...new Set(pool.map(function(a){ return a.Agentt || a.Agent; }))].filter(Boolean).sort().forEach(function(n) { var o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
    }
    qaRenderAnalytics();
};

window.qaRenderAnalytics = function() {
    var isFullAdmin = qaIsFullAdmin();
    var isLM        = qaIsLineManager();
    var showFilters = isFullAdmin || isLM;

    if (showFilters) {
        var teamSel = document.getElementById('qaFilterTeam');
        if (teamSel && teamSel.options.length <= 1) {
            var teams = isLM ? qaGetLmTeams() : [...new Set(qaAllAudits.map(function(a) { return a.Team; }))].filter(Boolean).sort();
            teams.forEach(function(t) {
                var o = document.createElement('option');
                o.value = t;
                o.textContent = t;
                teamSel.appendChild(o);
            });
        }

        function populateOnce(id, values) {
            var sel = document.getElementById(id);
            if (!sel || sel.options.length > 1) return;
            [...new Set(values)].filter(Boolean).sort().forEach(function(v) { var o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
        }
        var scopedAudits = isFullAdmin ? qaAllAudits : qaAllAudits.filter(qaAuditBelongsToScope);
        populateOnce('qaFilterAgent',     scopedAudits.map(function(a) { return a.Agentt || a.Agent; }));
        populateOnce('qaFilterEvaluator', scopedAudits.map(function(a) { return a.Evaluator; }));
    }

    var data = qaGetFiltered();
    qaRenderSelectionTiles(data, showFilters);
    qaRenderKPIs(data, showFilters);
    qaRenderAuditGrid(data, isFullAdmin);
    if (qaChartsVisible) {
        var sec = document.getElementById('qaChartsSection');
        if (sec && !sec.innerHTML.trim()) sec.innerHTML = qaChartsHTML();
        qaRenderCharts(data);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ── Charts HTML (per tab) ─────────────────────────────────────
function qaChartsHTML() {
    function card(id, icon, title, height) {
        return '<div class="chart-card">' +
            '<div class="chart-title"><i data-lucide="' + icon + '" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>' + title + '</div>' +
            '<div style="height:' + (height||260) + 'px;"><canvas id="' + id + '"></canvas></div>' +
            '</div>';
    }
    var isCall  = qaAnalyticsTab === 'Call';
    var isEmail = qaAnalyticsTab === 'Email';
    var isSR    = qaAnalyticsTab === 'Service Review';
    var isCT    = qaAnalyticsTab === 'Certification';

    var html =
        // Score trend
        '<div style="margin-bottom:1rem;"><div class="chart-card">' +
        '<div class="chart-title" style="justify-content:space-between;">' +
        '<span><i data-lucide="trending-up" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Score Trend</span>' +
        '<div style="display:flex;gap:6px;" id="qaScoreTrendPeriodWrap"></div></div>' +
        '<div style="height:260px;"><canvas id="qaScoreTrendChart"></canvas></div>' +
        '</div></div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">' +
        card('qaAgentScoreChart', 'bar-chart-3', 'Agent Performance', 300) +
        card('qaOutcomeChart', 'pie-chart', 'Outcome Distribution', 300) +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">' +
        card('qaMonthlyTrendChart', 'bar-chart-2', 'Pass / Fail Trend', 260) +
        card('qaEvaluatorChart', 'users', 'Evaluator Productivity', 260) +
        '</div>' +

        card('qaScoreDistChart', 'activity', 'Score Distribution', 220);

    // Heatmap only for Call/Email/SR/CT
    if (isCall)  html += '<div class="chart-card" style="margin-bottom:1rem;"><h3 class="chart-title">📞 Call Criteria Heatmap</h3><div id="qaCallHeatmap"></div></div>';
    if (isEmail) html += '<div class="chart-card" style="margin-bottom:1rem;"><h3 class="chart-title">✉️ Email Criteria Heatmap</h3><div id="qaEmailHeatmap"></div></div>';
    if (isSR)    html += '<div class="chart-card" style="margin-bottom:1rem;"><h3 class="chart-title">📋 Service Review Criteria Heatmap</h3><div id="qaSRHeatmap"></div></div>';
    if (isCT)    html += '<div class="chart-card" style="margin-bottom:1rem;"><h3 class="chart-title">🏅 Certification Criteria Heatmap</h3><div id="qaCTHeatmap"></div></div>';

    html += '<div class="chart-card" style="margin-bottom:1rem;"><h3 class="chart-title" style="color:#ef4444;"><i data-lucide="alert-circle" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;color:#ef4444;"></i>Bottom 5 Agents — Needs Immediate Attention</h3><div id="qaBottom5"></div></div>';

    return html;
}

window.qaToggleCharts = function() {
    qaChartsVisible = !qaChartsVisible;
    var section = document.getElementById('qaChartsSection');
    var icon    = document.getElementById('qaChartsIcon');
    var btnText = document.getElementById('qaChartsBtnText');
    if (section) {
        section.style.display = qaChartsVisible ? 'block' : 'none';
        if (qaChartsVisible && !section.innerHTML.trim()) section.innerHTML = qaChartsHTML();
    }
    if (icon)    icon.setAttribute('data-lucide', qaChartsVisible ? 'eye-off' : 'eye');
    if (btnText) btnText.textContent = qaChartsVisible ? 'Hide Analytics Charts' : 'Show Analytics Charts';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (qaChartsVisible) qaRenderCharts(qaGetFiltered());
};

// ── Chart Helpers ─────────────────────────────────────────────
function qaDestroyChart(id) { var c = document.getElementById(id); if (c && c._chart) { c._chart.destroy(); c._chart = null; } }

function qaGetChartColors() {
    var t = document.body.getAttribute('data-theme') || '';
    var isDark = t === 'dark' || t === 'duralux-dark';
    return {
        text: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
        grid: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
    };
}

function qaToggleBtn(label, active, onclick) {
    return '<button type="button" onclick="' + onclick + '" style="padding:.22rem .65rem;border-radius:6px;font-size:.7rem;font-weight:700;border:1px solid ' + (active ? 'transparent' : 'var(--border)') + ';cursor:pointer;background:' + (active ? 'var(--grad)' : 'var(--bg-secondary)') + ';color:' + (active ? '#fff' : 'var(--t3)') + ';transition:all .15s;">' + label + '</button>';
}

function qaGetBucket(dateStr) {
    var d = new Date(dateStr);
    if (qaChartPeriod === 'W') return d.getFullYear() + '-W' + String(Math.ceil((d - new Date(d.getFullYear(),0,1)) / 6048e5)).padStart(2,'0');
    if (qaChartPeriod === 'M') return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    if (qaChartPeriod === 'Q') return d.getFullYear() + '-Q' + Math.ceil((d.getMonth()+1)/3);
    return String(d.getFullYear());
}

function qaRenderCharts(data) {
    var c    = qaGetChartColors();
    var du   = { p1:'#4c6fff', p2:'#8b5cf6', p3:'#c724b1' };
   var agents     = [...new Set(data.map(function(a){ return a.Agentt || a.Agent; }))].filter(Boolean).sort();
    var evaluators = [...new Set(data.map(function(a){ return a.Evaluator; }))].filter(Boolean).sort();
    var now        = new Date();
    var periods    = qaChartPeriod==='W'?12:qaChartPeriod==='M'?12:qaChartPeriod==='Q'?8:5;

    var periodBtns = ['W','M','Q','Y'].map(function(p) {
        var label = p==='W'?'Week':p==='M'?'Month':p==='Q'?'Quarter':'Year';
        return qaToggleBtn(label, qaChartPeriod===p, "qaChartPeriod='"+p+"';qaRenderCharts(qaGetFiltered())");
    }).join('');

    var stpWrap = document.getElementById('qaScoreTrendPeriodWrap');
    if (stpWrap) stpWrap.innerHTML = periodBtns;

    // Score trend
    qaDestroyChart('qaScoreTrendChart');
    var trendLabels = [], trendBuckets = [];
    for (var i = periods-1; i >= 0; i--) {
        var label, bucket;
        if (qaChartPeriod==='W') {
            var dw = new Date(now); dw.setDate(dw.getDate()-i*7);
            bucket = qaGetBucket(dw.toISOString());
            label  = 'W' + Math.ceil((dw - new Date(dw.getFullYear(),0,1)) / 6048e5);
        } else if (qaChartPeriod==='M') {
            var dm = new Date(now.getFullYear(), now.getMonth()-i, 1);
            bucket = qaGetBucket(dm.toISOString());
            label  = dm.toLocaleDateString('en-US', { month:'short', year:'2-digit' });
        } else if (qaChartPeriod==='Q') {
            var totalQ = now.getFullYear()*4+Math.ceil((now.getMonth()+1)/3)-1-i;
            var yr = Math.floor(totalQ/4), q = (totalQ%4)+1;
            bucket = yr+'-Q'+q; label = 'Q'+q+' '+String(yr).slice(2);
        } else {
            var y = now.getFullYear()-i; bucket = String(y); label = String(y);
        }
        trendLabels.push(label); trendBuckets.push(bucket);
    }

    function getDate(a){ return a.DateOfCall||a.DateOfEmail||a.DateOfReview||a.DateOfCertification||a.DateOfEval||''; }
    var passD=[], needsD=[], failD=[];
    trendBuckets.forEach(function(bkt) {
        var mb = data.filter(function(a){ var d=getDate(a); return d && qaGetBucket(d)===bkt; });
        passD.push(mb.filter(function(a){return a.Outcome==='Pass';}).length);
        needsD.push(mb.filter(function(a){return a.Outcome==='Needs Improvement';}).length);
        failD.push(mb.filter(function(a){return a.Outcome==='Fail';}).length);
    });
    var stCtx = document.getElementById('qaScoreTrendChart');
    if (stCtx) {
        var stGrad = stCtx.getContext('2d').createLinearGradient(0,0,0,260);
        stGrad.addColorStop(0,'rgba(76,111,255,0.2)'); stGrad.addColorStop(1,'rgba(76,111,255,0.01)');
        stCtx._chart = new Chart(stCtx, { type:'line', data:{ labels:trendLabels, datasets:[
            {label:'Pass',  data:passD,  borderColor:'#10b981',backgroundColor:stGrad,fill:true,tension:.35,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:'#10b981',pointBorderColor:'#fff',pointBorderWidth:2,borderWidth:2.5},
            {label:'Needs', data:needsD, borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.05)',fill:false,tension:.35,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:'#f59e0b',pointBorderColor:'#fff',pointBorderWidth:2,borderWidth:2.5},
            {label:'Fail',  data:failD,  borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,0.05)',fill:false,tension:.35,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:'#ef4444',pointBorderColor:'#fff',pointBorderWidth:2,borderWidth:2.5},
        ]}, options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{datalabels:{display:false},legend:{position:'top',labels:{color:c.text,font:{size:12,weight:'600'},usePointStyle:true,padding:20}}},scales:{x:{ticks:{color:c.text,font:{size:11,weight:'600'}},grid:{color:c.grid}},y:{ticks:{color:c.text},grid:{color:c.grid},beginAtZero:true}}}});
    }

    // Agent performance
    qaDestroyChart('qaAgentScoreChart');
    var agentAvgs = agents.map(function(ag) {
        var d = data.filter(function(a){return a.Agent===ag;});
        return d.length ? +(d.reduce(function(s,a){return s+(a.AvgScore||0);},0)/d.length).toFixed(1) : 0;
    });
    var c1 = document.getElementById('qaAgentScoreChart');
    if (c1) c1._chart = new Chart(c1, { type:'bar', data:{ labels:agents, datasets:[{ label:'Avg Score %', data:agentAvgs, backgroundColor:agentAvgs.map(function(v){return v>=70?du.p1:v>=50?du.p2:du.p3;}), borderRadius:8, maxBarThickness:32 }]}, options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{datalabels:{display:false},legend:{display:false}},scales:{x:{ticks:{color:c.text,callback:function(v){return v+'%'}},grid:{color:c.grid},beginAtZero:true},y:{ticks:{color:c.text,font:{size:11,weight:'600'}},grid:{display:false}}}}});

    // Outcome donut
    qaDestroyChart('qaOutcomeChart');
    var passC  = data.filter(function(a){return a.Outcome==='Pass';}).length;
    var needsC = data.filter(function(a){return a.Outcome==='Needs Improvement';}).length;
    var failC  = data.filter(function(a){return a.Outcome==='Fail';}).length;
    var c2 = document.getElementById('qaOutcomeChart');
    if (c2) c2._chart = new Chart(c2, { type:'doughnut', data:{ labels:['Pass','Needs Improvement','Fail'], datasets:[{ data:[passC,needsC,failC], backgroundColor:['#10b981','#f59e0b','#ef4444'], borderWidth:4, borderColor:'var(--bg-card)', hoverOffset:12 }]}, options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{datalabels:{display:false},legend:{position:'bottom',labels:{color:c.text,font:{size:11,weight:'600'},padding:14,usePointStyle:true}}}}});

    // Pass/Fail monthly trend
    qaDestroyChart('qaMonthlyTrendChart');
    var monthMap = {};
    data.forEach(function(a) {
        var d = getDate(a); if(!d) return;
        var key = qaGetBucket(d);
        if (!monthMap[key]) monthMap[key] = { pass:0, needs:0, fail:0 };
        if (a.Outcome==='Pass') monthMap[key].pass++;
        else if (a.Outcome==='Needs Improvement') monthMap[key].needs++;
        else monthMap[key].fail++;
    });
    var mk = Object.keys(monthMap).sort();
    var c5 = document.getElementById('qaMonthlyTrendChart');
    if (c5) c5._chart = new Chart(c5, { type:'bar', data:{ labels:mk, datasets:[
        { label:'Pass', data:mk.map(function(k){return monthMap[k].pass;}), backgroundColor:'#10b981', borderRadius:4 },
        { label:'Needs', data:mk.map(function(k){return monthMap[k].needs;}), backgroundColor:'#f59e0b', borderRadius:4 },
        { label:'Fail', data:mk.map(function(k){return monthMap[k].fail;}), backgroundColor:'#ef4444', borderRadius:4 },
    ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{datalabels:{display:false},legend:{position:'top',labels:{color:c.text,font:{size:11,weight:'600'},usePointStyle:true,padding:16}}},scales:{x:{stacked:true,grid:{display:false},ticks:{color:c.text}},y:{stacked:true,grid:{color:c.grid},ticks:{color:c.text}}}}});

    // Evaluator productivity
    qaDestroyChart('qaEvaluatorChart');
    var evalCounts = evaluators.map(function(ev){ return data.filter(function(a){return a.Evaluator===ev;}).length; });
    var c6 = document.getElementById('qaEvaluatorChart');
    if (c6) c6._chart = new Chart(c6, { type:'bar', data:{ labels:evaluators, datasets:[{ label:'Audits Done', data:evalCounts, backgroundColor:'#10b981', borderRadius:8, maxBarThickness:40 }]}, options:{responsive:true,maintainAspectRatio:false,plugins:{datalabels:{display:false},legend:{display:false}},scales:{y:{grid:{color:c.grid},ticks:{color:c.text}},x:{grid:{display:false},ticks:{color:c.text}}}}});

    // Score distribution
    qaDestroyChart('qaScoreDistChart');
    var bins = ['0–10','10–20','20–30','30–40','40–50','50–60','60–70','70–80','80–90','90–100'];
    var binCounts = bins.map(function(_,i){ return data.filter(function(a){ var s=a.AvgScore||0; return s>=i*10&&s<(i+1)*10; }).length; });
    var c12 = document.getElementById('qaScoreDistChart');
    if (c12) c12._chart = new Chart(c12, { type:'bar', data:{ labels:bins, datasets:[{ label:'Audits', data:binCounts, backgroundColor:bins.map(function(_,i){return i>=7?du.p1:i>=5?du.p2:du.p3;}), borderRadius:6, maxBarThickness:40 }]}, options:{responsive:true,maintainAspectRatio:false,plugins:{datalabels:{display:false},legend:{display:false}},scales:{y:{grid:{color:c.grid},ticks:{color:c.text}},x:{grid:{display:false},ticks:{color:c.text,font:{size:10,weight:'600'}}}}}});

    // Heatmaps per tab
    if (qaAnalyticsTab === 'Call')           qaRenderHeatmap('qaCallHeatmap',  QA_CALL_CRITERIA,  data);
    if (qaAnalyticsTab === 'Email')          qaRenderHeatmap('qaEmailHeatmap', QA_EMAIL_CRITERIA, data);
    if (qaAnalyticsTab === 'Service Review') qaRenderHeatmap('qaSRHeatmap',    QA_SR_CRITERIA,    data);
    if (qaAnalyticsTab === 'Certification')  qaRenderHeatmap('qaCTHeatmap',    QA_CT_CRITERIA,    data);

    qaRenderBottom5(data);
}

// ── Selection Tiles ───────────────────────────────────────────
function qaRenderSelectionTiles(data, isAdmin) {
    var container = document.getElementById('qaSelectionTiles');
    if (!container || !isAdmin) return;
    var selectedAgent     = (document.getElementById('qaFilterAgent')     || {}).value || '';
    var selectedEvaluator = (document.getElementById('qaFilterEvaluator') || {}).value || '';
    if (!selectedAgent && !selectedEvaluator) { container.style.display = 'none'; container.innerHTML = ''; return; }
    container.style.display = 'block';
    var tiles = '';

    if (selectedEvaluator) {
        var aData = data.filter(function(a) { return a.Evaluator === selectedEvaluator; });
        var aTotal = aData.length;
        var aAvg   = aTotal ? (aData.reduce(function(s,a){return s+(a.AvgScore||0);},0)/aTotal).toFixed(1) : 0;
        var aPassed = aData.filter(function(a){return a.Outcome==='Pass';}).length;
        var aFailed = aData.filter(function(a){return a.Outcome==='Fail';}).length;
        var aPassRate = aTotal ? ((aPassed/aTotal)*100).toFixed(0) : 0;
        var aColor = aAvg >= 70 ? '#10b981' : aAvg >= 50 ? '#f59e0b' : '#ef4444';
        tiles += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:13px;padding:1rem 1.1rem;box-shadow:var(--cs);position:relative;overflow:hidden;flex:1;min-width:280px;">' +
            '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad);"></div>' +
            '<div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.85rem;">' +
            '<div style="width:38px;height:38px;border-radius:10px;background:var(--grad);display:flex;align-items:center;justify-content:center;"><i data-lucide="user-check" style="width:18px;height:18px;color:#fff;"></i></div>' +
            '<div><div style="font-size:.88rem;font-weight:800;color:var(--t1);">' + selectedEvaluator + '</div><div style="font-size:.68rem;color:var(--t3);">Evaluator · ' + qaAnalyticsTab + '</div></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem;">' +
            '<div style="background:var(--bg-secondary);border-radius:7px;padding:.5rem .6rem;border:1px solid var(--border);"><div style="font-size:.63rem;text-transform:uppercase;color:var(--t3);margin-bottom:.1rem;font-weight:600;">Total Audits</div><div style="font-size:1.05rem;font-weight:800;color:var(--sc);">' + aTotal + '</div></div>' +
            '<div style="background:var(--bg-secondary);border-radius:7px;padding:.5rem .6rem;border:1px solid var(--border);"><div style="font-size:.63rem;text-transform:uppercase;color:var(--t3);margin-bottom:.1rem;font-weight:600;">Avg Score Given</div><div style="font-size:1.05rem;font-weight:800;color:' + aColor + ';">' + aAvg + '</div></div>' +
            '</div>' +
            '<div style="border-radius:8px;padding:.55rem .7rem;background:var(--grad);color:#fff;">' +
            '<div style="font-size:.63rem;text-transform:uppercase;opacity:.82;font-weight:700;margin-bottom:.25rem;">Outcomes</div>' +
            '<div style="display:flex;justify-content:space-between;"><div style="font-size:.72rem;opacity:.85;">Pass Rate</div><div style="font-size:.85rem;font-weight:800;">' + aPassRate + '%</div></div>' +
            '<div style="display:flex;justify-content:space-between;"><div style="font-size:.72rem;opacity:.85;">Passes / Fails</div><div style="font-size:.8rem;font-weight:700;">' + aPassed + ' / ' + aFailed + '</div></div>' +
            '</div></div>';
    }

    if (selectedAgent) {
        var smData   = data.filter(function(a) { return a.Agent === selectedAgent; });
        var smTotal  = smData.length;
        var smAvg    = smTotal ? (smData.reduce(function(s,a){return s+(a.AvgScore||0);},0)/smTotal).toFixed(1) : 0;
        var smPassed = smData.filter(function(a){return a.Outcome==='Pass';}).length;
        var smFailed = smData.filter(function(a){return a.Outcome==='Fail';}).length;
        var smNeeds  = smData.filter(function(a){return a.Outcome==='Needs Improvement';}).length;
        var smPassRate = smTotal ? ((smPassed/smTotal)*100).toFixed(0) : 0;
        var smColor  = smAvg >= 70 ? '#10b981' : smAvg >= 50 ? '#f59e0b' : '#ef4444';
        var criteria = qaGetCriteria(qaAnalyticsTab);
        var catAvgs  = criteria.map(function(cat) {
            var rel = smData.filter(function(a) { return a[cat.id] !== null && a[cat.id] !== undefined; });
            var avg = rel.length ? rel.reduce(function(s,a){return s+(a[cat.id]||0);},0)/rel.length : null;
            return { label: cat.label, avg: avg };
        }).filter(function(c){ return c.avg !== null; }).sort(function(a,b){ return b.avg - a.avg; });
        var bestCat  = catAvgs.length ? catAvgs[0] : null;
        var worstCat = catAvgs.length ? catAvgs[catAvgs.length-1] : null;
        var recentScores = smData.slice(0,5).reverse().map(function(a){ return a.AvgScore||0; });
        var trendHTML = recentScores.length > 1
            ? '<div style="display:flex;align-items:flex-end;gap:3px;height:28px;">' +
              recentScores.map(function(s){ var h=Math.max(4,Math.round(s/100*28)); var col=s>=70?'#10b981':s>=50?'#f59e0b':'#ef4444'; return '<div style="flex:1;height:'+h+'px;background:'+col+';border-radius:3px 3px 0 0;" title="'+s+'"></div>'; }).join('') + '</div>' : '';

        tiles += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:13px;padding:1rem 1.1rem;box-shadow:var(--cs);position:relative;overflow:hidden;flex:1;min-width:280px;">' +
            '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(135deg,#10b981,#059669);"></div>' +
            '<div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.85rem;">' +
            '<div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;"><i data-lucide="user" style="width:18px;height:18px;color:#fff;"></i></div>' +
            '<div><div style="font-size:.88rem;font-weight:800;color:var(--t1);">' + selectedAgent + '</div><div style="font-size:.68rem;color:var(--t3);">Agent · ' + qaAnalyticsTab + '</div></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem;">' +
            '<div style="background:var(--bg-secondary);border-radius:7px;padding:.5rem .6rem;border:1px solid var(--border);"><div style="font-size:.63rem;text-transform:uppercase;color:var(--t3);margin-bottom:.1rem;font-weight:600;">Audits Received</div><div style="font-size:1.05rem;font-weight:800;color:var(--sc);">' + smTotal + '</div></div>' +
            '<div style="background:var(--bg-secondary);border-radius:7px;padding:.5rem .6rem;border:1px solid var(--border);"><div style="font-size:.63rem;text-transform:uppercase;color:var(--t3);margin-bottom:.1rem;font-weight:600;">Avg Score</div><div style="font-size:1.05rem;font-weight:800;color:' + smColor + ';">' + smAvg + '</div></div>' +
            '</div>' +
            '<div style="border-radius:8px;padding:.55rem .7rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;margin-bottom:.55rem;">' +
            '<div style="font-size:.63rem;text-transform:uppercase;opacity:.82;font-weight:700;margin-bottom:.3rem;">Outcomes</div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="font-size:.72rem;opacity:.85;">Pass Rate</span><span style="font-size:.85rem;font-weight:800;">' + smPassRate + '%</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="font-size:.72rem;opacity:.85;">Pass / Needs / Fail</span><span style="font-size:.78rem;font-weight:700;">' + smPassed + ' / ' + smNeeds + ' / ' + smFailed + '</span></div>' +
            '</div>' +
            (bestCat && worstCat ?
                '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:.55rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(16,185,129,0.1);border-radius:6px;border:1px solid rgba(16,185,129,0.25);">' +
                '<span style="font-size:.68rem;color:#10b981;font-weight:700;">⬆ Best: ' + bestCat.label + '</span>' +
                '<span style="font-size:.75rem;font-weight:800;color:#10b981;">' + bestCat.avg.toFixed(1) + ' / 2</span></div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(239,68,68,0.08);border-radius:6px;border:1px solid rgba(239,68,68,0.2);">' +
                '<span style="font-size:.68rem;color:#ef4444;font-weight:700;">⬇ Needs Work: ' + worstCat.label + '</span>' +
                '<span style="font-size:.75rem;font-weight:800;color:#ef4444;">' + worstCat.avg.toFixed(1) + ' / 2</span></div>' +
                '</div>' : '') +
            (trendHTML ? '<div style="background:var(--bg-secondary);border-radius:8px;padding:.5rem .65rem;"><div style="font-size:.63rem;text-transform:uppercase;color:var(--t3);font-weight:700;margin-bottom:.35rem;">Recent Score Trend</div>' + trendHTML + '</div>' : '') +
            '</div>';
    }

    container.innerHTML = '<div style="display:flex;gap:.85rem;margin-bottom:1rem;flex-wrap:wrap;">' + tiles + '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── KPI Tiles ─────────────────────────────────────────────────
function qaRenderKPIs(data, isAdmin) {
    var el = document.getElementById('qaKPITiles'); if (!el) return;
    var total    = data.length;
    var avgScore = total ? (data.reduce(function(s,a){return s+(a.AvgScore||0);},0)/total).toFixed(1) : 0;
    var passed   = data.filter(function(a){return a.Outcome==='Pass';}).length;
    var failed   = data.filter(function(a){return a.Outcome==='Fail';}).length;
    var passRate = total ? ((passed/total)*100).toFixed(0) : 0;
    var tm = new Date().getMonth(), ty = new Date().getFullYear();
    var monthCount = data.filter(function(a){
        var d = new Date(a.DateOfCall||a.DateOfEmail||a.DateOfReview||a.DateOfCertification||a.DateOfEval||'');
        return d.getMonth()===tm && d.getFullYear()===ty;
    }).length;

    var kpis = [
        { label: 'Total Audits',  val: total,           icon:'clipboard-list', color:'#4c6fff' },
        { label: 'Avg Score',     val: avgScore + '%',  icon:'star',           color:'#f59e0b' },
        { label: 'Pass Rate',     val: passRate + '%',  icon:'check-circle',   color:'#10b981' },
        { label: 'Fails',         val: failed,          icon:'x-circle',       color:'#ef4444' },
        { label: 'This Month',    val: monthCount,      icon:'calendar',       color:'#8b5cf6' },
        { label: 'Passed',        val: passed,          icon:'award',          color:'#10b981' },
        { label: qaAnalyticsTab + ' Audits', val: total, icon:'layers',        color:'#06b6d4' },
    ];

    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:.65rem;">' +
        kpis.map(function(k) {
            return '<div class="stat-card" style="padding:.85rem .9rem;">' +
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:.45rem;">' +
                '<div style="width:28px;height:28px;border-radius:7px;background:' + k.color + '22;display:flex;align-items:center;justify-content:center;">' +
                '<i data-lucide="' + k.icon + '" style="width:14px;height:14px;color:' + k.color + ';"></i></div>' +
                '<div class="stat-label" style="margin:0;font-size:.65rem;">' + k.label + '</div></div>' +
                '<div style="font-size:1.35rem;font-weight:900;color:' + k.color + ';">' + k.val + '</div></div>';
        }).join('') + '</div>';
}

// ── Bottom 5 ──────────────────────────────────────────────────
function qaRenderBottom5(data) {
    var el = document.getElementById('qaBottom5'); if (!el) return;
var agents = [...new Set(data.map(function(a){return a.Agentt||a.Agent;}))].filter(Boolean);
    var agentStats = agents.map(function(ag) {
        var agData = data.filter(function(a){return (a.Agentt||a.Agent)===ag;});
        var avg    = agData.length ? agData.reduce(function(s,a){return s+(a.AvgScore||0);},0)/agData.length : 0;
        return { name:ag, avg:avg, count:agData.length, fails:agData.filter(function(a){return a.Outcome==='Fail';}).length };
    }).sort(function(a,b){return a.avg-b.avg;}).slice(0,5);
    if (!agentStats.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3);">No data yet</div>'; return; }
    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;padding:8px 0;">' +
        agentStats.map(function(s, i) {
            var color = s.avg>=70?'#10b981':s.avg>=50?'#f59e0b':'#ef4444';
            return '<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:rgba(239,68,68,0.06);border-radius:10px;border:1px solid rgba(239,68,68,0.15);">' +
                '<div style="width:28px;height:28px;border-radius:50%;background:#ef444422;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;color:#ef4444;flex-shrink:0;">' + (i+1) + '</div>' +
                '<div style="flex:1;font-size:.9rem;font-weight:700;color:var(--t1);">' + s.name + '</div>' +
                '<div style="font-size:.78rem;color:var(--t3);">' + s.count + ' audits · ' + s.fails + ' fails</div>' +
                '<div style="font-size:1.1rem;font-weight:900;color:' + color + ';">' + s.avg.toFixed(1) + '%</div></div>';
        }).join('') + '</div>';
}

// ── Heatmap ───────────────────────────────────────────────────
function qaRenderHeatmap(elId, criteria, data) {
    var el = document.getElementById(elId); if (!el) return;
    var rows = criteria.map(function(cat) {
        var rel = data.filter(function(a){ return a[cat.id] !== null && a[cat.id] !== undefined; });
        if (!rel.length) return null;
        var avg = rel.reduce(function(s,a){return s+(a[cat.id]||0);},0) / rel.length;
        return { cat:cat, avg:avg, count:rel.length };
    }).filter(Boolean).sort(function(a,b){ return a.avg - b.avg; });
    if (!rows.length) { el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3);">No data yet</div>'; return; }
    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:5px;padding:8px 0;">' +
        rows.map(function(r) {
            var pct   = (r.avg / QA_MAX_PER_CRITERION * 100).toFixed(0);
            var color = r.avg>=1.4?'#10b981':r.avg>=0.8?'#f59e0b':'#ef4444';
            var bg    = r.avg>=1.4?'rgba(16,185,129,0.06)':r.avg>=0.8?'rgba(245,158,11,0.06)':'rgba(239,68,68,0.06)';
            return '<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:'+bg+';border-radius:8px;">' +
                '<div style="width:240px;font-size:.82rem;font-weight:600;color:var(--t1);flex-shrink:0;">'+r.cat.label+'</div>' +
                '<div style="flex:1;background:var(--bg-secondary);border-radius:20px;height:9px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:20px;"></div></div>' +
                '<div style="width:65px;text-align:right;font-size:.75rem;color:var(--t3);">'+r.count+' audits</div>' +
                '<div style="width:52px;text-align:right;font-size:.82rem;font-weight:700;color:'+color+';">'+r.avg.toFixed(2)+'/2</div>' +
                '</div>';
        }).join('') + '</div>';
}

// ── Audit Grid ────────────────────────────────────────────────
function qaRenderAuditGrid(data, isAdmin) {
    var container = document.getElementById('qaAuditGrid'); if (!container) return;

    var cols = [
        { field:'AuditType',   headerName:'Type',    width:130, cellRenderer:function(p){
            var cfg={Call:{c:'#4c6fff',bg:'rgba(76,111,255,0.1)'},Email:{c:'#8b5cf6',bg:'rgba(139,92,246,0.1)'},'Service Review':{c:'#f59e0b',bg:'rgba(245,158,11,0.1)'},Certification:{c:'#10b981',bg:'rgba(16,185,129,0.1)'}};
            var s=cfg[p.value]||{c:'var(--t3)',bg:'var(--bg-secondary)'};
            return '<span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;color:'+s.c+';background:'+s.bg+';">'+(p.value||'')+'</span>';
        }},
        { field:'Team',        headerName:'Team',    width:110 },
   { field:'Agentt',      headerName:'Agent',   width:160 },
        { field:'Evaluator',   headerName:'Evaluator', width:150 },
        { field:'ReferenceID', headerName:'Ref ID',  width:130 },
        { field:'DateOfEval',  headerName:'Eval Date', width:115, valueFormatter:function(p){ var v=p.value||''; return v?new Date(v).toLocaleDateString('en-GB'):'—'; }},
        { field:'DateOfCall',  headerName:'Audit Date', width:115, valueFormatter:function(p){
            var v=p.data.DateOfCall||p.data.DateOfEmail||p.data.DateOfReview||p.data.DateOfCertification||'';
            return v?new Date(v).toLocaleDateString('en-GB'):'—';
        }},
        { field:'MSISDN',      headerName:'MSISDN',  width:130 },
        { field:'CallReason',  headerName:'Reason',  width:160, valueFormatter:function(p){ return p.data.CallReason||p.data.EmailReason||'—'; }},
        { field:'CallDurationType', headerName:'Duration', width:100 },
        { field:'AvgScore',    headerName:'Score',   width:100, cellRenderer:function(p){ var s=p.value||0; var color=s>=70?'#10b981':s>=50?'#f59e0b':'#ef4444'; return '<span style="font-size:1rem;font-weight:800;color:'+color+';">'+s+'</span><span style="font-size:.75rem;color:var(--t3);"> %</span>'; }},
        { field:'Outcome',     headerName:'Outcome', width:155, cellRenderer:function(p){ var color=p.value==='Pass'?'#10b981':p.value==='Fail'?'#ef4444':'#f59e0b'; return '<span style="background:'+color+'22;color:'+color+';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">'+(p.value||'')+'</span>'; }},
        { field:'NAFields',    headerName:'N/A Fields', width:120, valueFormatter:function(p){ return p.value ? p.value.split('|').length + ' fields' : '—'; }},
        { field:'view',        headerName:'', width:80, pinned:'right', sortable:false, filter:false,
          cellRenderer:function(p){ return '<button type="button" class="export-btn" onclick="qaViewAudit('+p.data.ID+')" style="padding:4px 12px;font-size:11px;">View</button>'; }
        },
    ];

    if (qaGridApi) { try { qaGridApi.destroy(); } catch(e){} qaGridApi = null; }

    container.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem;">' +
        '<h3 class="table-title"><i data-lucide="table" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
        qaAnalyticsTab + ' Audits</h3>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input type="text" class="search-box" placeholder="Search..." oninput="if(qaGridApi)qaGridApi.setGridOption(\'quickFilterText\',this.value)" style="width:200px;">' +
        (isAdmin ? '<button type="button" class="export-btn" onclick="qaExportCSV()" style="padding:8px 16px;font-size:12px;"><i data-lucide="file-spreadsheet" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Export</button>' : '') +
        '</div></div>' +
        '<div id="qaGridDiv" class="ag-theme-alpine" style="height:500px;width:100%;"></div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();

    agGrid.createGrid(document.getElementById('qaGridDiv'), {
        columnDefs: cols,
        rowData: data,
        defaultColDef: { sortable:true, filter:true, resizable:true },
        pagination: true,
        paginationPageSize: 25,
        rowHeight: 48,
        onGridReady: function(p) { qaGridApi = p.api; }
    });
}

window.qaExportCSV = function() {
    if (qaGridApi) qaGridApi.exportDataAsCsv({ fileName: 'QA_' + qaAnalyticsTab.replace(/ /g,'_') + '_' + new Date().toISOString().split('T')[0] + '.csv' });
};

// ── View Audit Modal ──────────────────────────────────────────
window.qaViewAudit = async function(itemId) {
    var audit = qaAllAudits.find(function(a){ return a.ID === itemId; });
    if (!audit) return;

    var criteria = qaGetCriteria(audit.AuditType);

    function scoreColor(s) { return s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444'; }

    var naArr = (audit.NAFields || audit.NAFileds || '').split('|').filter(Boolean);
    function isNA(catId) {
        return naArr.some(function(n) { return n === catId || catId.startsWith(n + '_') || n.startsWith(catId.split('_')[0]); });
    }

    var criteriaHTML = criteria.map(function(cat) {
        var isNAFlag = isNA(cat.id);
        var val    = audit[cat.id];
        var color  = val === 2 ? '#10b981' : val === 1 ? '#f59e0b' : val === 0 ? '#ef4444' : 'var(--t3)';
        return '<div style="display:flex;align-items:center;padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);' + (isNAFlag?'opacity:.4;':'') + '">' +
            '<div style="flex:1;font-size:.83rem;font-weight:600;color:var(--t1);">' + cat.label + '</div>' +
            '<div style="width:70px;text-align:center;font-size:.85rem;font-weight:800;color:' + color + ';">' + (isNAFlag ? 'N/A' : (val !== null && val !== undefined ? val + ' / 2' : '—')) + '</div>' +
            '</div>';
    }).join('');

    var metaRows = [
        ['Audit Type', audit.AuditType],
        ['Team', audit.Team || '—'],
        ['Agent', audit.Agent || '—'],
        ['Evaluator', audit.Evaluator || '—'],
        ['Reference ID', audit.ReferenceID || '—'],
        ['Date of Eval', audit.DateOfEval ? new Date(audit.DateOfEval).toLocaleDateString('en-GB') : '—'],
    ];
    if (audit.AuditType === 'Call') {
        metaRows.push(['Date of Call', audit.DateOfCall ? new Date(audit.DateOfCall).toLocaleDateString('en-GB') : '—']);
        metaRows.push(['MSISDN', audit.MSISDN || '—']);
        metaRows.push(['Call Reason', audit.CallReason || '—']);
        metaRows.push(['Duration', audit.CallDurationType || '—']);
    }
    if (audit.AuditType === 'Email') {
        metaRows.push(['Date of Email', audit.DateOfEmail ? new Date(audit.DateOfEmail).toLocaleDateString('en-GB') : '—']);
        metaRows.push(['Email Reason', audit.EmailReason || '—']);
        metaRows.push(['Email Subject', audit.EmailSubject || '—']);
    }
    if (audit.AuditType === 'Service Review') metaRows.push(['Date of Review', audit.DateOfReview ? new Date(audit.DateOfReview).toLocaleDateString('en-GB') : '—']);
    if (audit.AuditType === 'Certification')  metaRows.push(['Date of Cert',   audit.DateOfCertification ? new Date(audit.DateOfCertification).toLocaleDateString('en-GB') : '—']);

    var commentsHTML = audit.Comments
        ? '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;margin-bottom:1rem;">' +
          '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Comments</div>' +
          '<div style="font-size:.85rem;color:var(--t1);white-space:pre-wrap;">' + audit.Comments.replace(/<[^>]*>/g,'') + '</div>' +
          '</div>' : '';

    var modal = document.getElementById('qaViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'qaViewModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:10000;padding:20px;overflow-y:auto;';
        document.body.appendChild(modal);
    }

    var outcomeColor = audit.Outcome==='Pass'?'#10b981':audit.Outcome==='Fail'?'#ef4444':'#f59e0b';

    modal.innerHTML =
        '<div style="background:var(--bg-card);border-radius:16px;padding:28px;max-width:780px;margin:40px auto;box-shadow:var(--ch);border:1px solid var(--border);">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);">' +
        '<div>' +
        '<div style="font-size:18px;font-weight:800;color:var(--t1);margin-bottom:4px;">Audit Details</div>' +
        '<div style="font-size:12px;color:var(--t3);">' + (audit.ReferenceID||'') + ' &nbsp;·&nbsp; ' + (audit.AuditType||'') + ' &nbsp;·&nbsp; ' + (audit.Agent||'') + '</div>' +
        '</div>' +
        '<button type="button" onclick="document.getElementById(\'qaViewModal\').style.display=\'none\'" style="background:none;border:none;font-size:26px;cursor:pointer;color:var(--t3);line-height:1;">×</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">' +
        '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;text-align:center;">' +
        '<div style="font-size:.7rem;text-transform:uppercase;color:var(--t3);font-weight:700;margin-bottom:6px;">Score</div>' +
        '<div style="font-size:2rem;font-weight:900;color:' + scoreColor(audit.AvgScore||0) + ';">' + (audit.AvgScore||0) + '%</div>' +
        '</div>' +
        '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;text-align:center;">' +
        '<div style="font-size:.7rem;text-transform:uppercase;color:var(--t3);font-weight:700;margin-bottom:6px;">Outcome</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:' + outcomeColor + ';">' + (audit.Outcome||'—') + '</div>' +
        '</div>' +
        '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;text-align:center;">' +
        '<div style="font-size:.7rem;text-transform:uppercase;color:var(--t3);font-weight:700;margin-bottom:6px;">Criteria</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--t1);">' + criteria.length + ' items</div>' +
        '</div>' +
        '</div>' +
        '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;margin-bottom:1rem;">' +
        '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Audit Information</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        metaRows.map(function(r) {
            return '<div style="display:flex;flex-direction:column;"><span style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--t3);">' + r[0] + '</span><span style="font-size:.88rem;font-weight:600;color:var(--t1);">' + r[1] + '</span></div>';
        }).join('') +
        '</div></div>' +
        commentsHTML +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Scoring Criteria</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;max-height:400px;overflow-y:auto;">' + criteriaHTML + '</div>' +
        '</div>' +
        '<div style="margin-bottom:1rem;" id="qaViewAttachSection">' +
        '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Attachments</div>' +
        '<div id="qaViewAttachList" style="font-size:13px;color:var(--t3);">Loading...</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border);">' +
        '<button type="button" onclick="document.getElementById(\'qaViewModal\').style.display=\'none\'" class="reset-btn">Close</button>' +
        '</div>' +
        '</div>';

    modal.style.display = 'block';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    qaGetAttachments(itemId).then(function(atts) {
        var el = document.getElementById('qaViewAttachList');
        if (!el) return;
        if (!atts || !atts.length) {
            el.innerHTML = '<span style="color:var(--t3);font-size:12px;">No attachments</span>';
        } else {
            el.innerHTML = atts.map(function(a) {
                return '<a href="' + SP_URL + a.url + '" target="_blank" ' +
                    'style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--acc);text-decoration:none;margin:3px;">' +
                    '📎 ' + a.name + '</a>';
            }).join('');
        }
    });
};
