// ============================================================
// EVENTS / TT / ACTIVITY MODULE — events-tt-activity.js
// ============================================================
//NEW CODE
// ── SET TO false WHEN SHAREPOINT LISTS ARE READY ─────────────
// ── REGISTER CHART DATALABELS PLUGIN ─────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }
});

const ETA_USE_DUMMY = false;

// ── SHAREPOINT CONFIG (only used when ETA_USE_DUMMY = false) ──
const ETA_SP_CONFIG = {
    siteUrl: 'http://sharedspaces:8086/sites/SM',
    mainList: 'Service Manager Request',
    lmColumn: 'Line_x0020_Manager',
    smColumn: 'Service_x0020_Manager',
    mappingList: 'Account Mapping',
    eventsExcelPath: '/sites/SM/Shared Documents/ServiceManagement/ExcelFiles/Events.xlsx',
    ttExcelPath: '/sites/SM/Shared Documents/ServiceManagement/ExcelFiles/TT.xlsx',
    actExcelPath: '/sites/SM/Shared Documents/ServiceManagement/ExcelFiles/Activities.xlsx'
};
const ETA_STATE = {
    initialized: false,
    activeTab: 'events',
    selectedLM: null,
    selectedSM: null,
    accountLoadMode: 'most',
   filters: {
        account: '',
        team: '',
        years: [],
        months: [],
        quarters: [],
        weeks: [],
        status: '',
        statuses: []
    },
    trendMode: 'weekly',
    charts: {},
    gridApi: null,
    allData: null,
    _accList: [],
    _ttDim: 'TYPE',
    _accCovMode: 'lm',
    _noTTMode: false,
    _unmatchedMode: false,
    _savedTTs: null,
    _evtAccCovMode: 'lm',
    _noEventMode: false,
    _unmatchedEventMode: false,
    _savedEvents: null,
    chartsVisible: false // charts hidden by default
};

const ETA_MOBILE_OPEN = ['Assigned', 'In Queue', 'Open', 'Pending', 'Resolved'];
const ETA_MOBILE_REJECTED = ['Canceled', 'Rejected', 'Rejected Completed'];
// Mobile Closed = anything not in OPEN or REJECTED

const ETA_FIXED_OPEN = ['Assigned', 'In Queue', 'Open', 'Pending', 'Resolved'];const ETA_FIXED_REJECTED = ['Canceled', 'Rejected', 'Rejected Completed'];
// Fixed Closed = anything not in OPEN or REJECTED

// Helper function
function etaGetTTOpenClosed(r) {
    var type = r.TYPE || r.TYPE1 || '';
    var status = r.TT_STATUS || '';
    if (type.startsWith('ENT_Mobile')) {
        if (ETA_MOBILE_OPEN.includes(status)) return 'open';
        if (ETA_MOBILE_REJECTED.includes(status)) return 'rejected';
        return 'closed';
    }
    if (type.startsWith('ENT_Fixed')) {
        if (ETA_FIXED_OPEN.includes(status)) return 'open';
        if (ETA_FIXED_REJECTED.includes(status)) return 'rejected';
        return 'closed';
    }
    return '';
}

// ── DUMMY DATA ────────────────────────────────────────────────
function etaGenerateDummyData() {
    const accounts = [{
            code: '10001',
            company: 'Emirates Airlines',
            lm: 'Sarah Johnson',
            sm: 'Ahmed Al-Mansouri',
            team: 'DSM'
        },
        {
            code: '10002',
            company: 'ADNOC Group',
            lm: 'Sarah Johnson',
            sm: 'Ahmed Al-Mansouri',
            team: 'DSM'
        },
        {
            code: '10003',
            company: 'Dubai Municipality',
            lm: 'Michael Chen',
            sm: 'Fatima Hassan',
            team: 'DSM'
        },
        {
            code: '10004',
            company: 'Etisalat Business',
            lm: 'Michael Chen',
            sm: 'Fatima Hassan',
            team: 'DSM'
        },
        {
            code: '10005',
            company: 'Abu Dhabi Police',
            lm: 'David Williams',
            sm: 'Omar Abdullah',
            team: 'DSM'
        },
        {
            code: '10006',
            company: 'Dubai Airports',
            lm: 'David Williams',
            sm: 'Omar Abdullah',
            team: 'DSM'
        },
        {
            code: '10007',
            company: 'Majid Al Futtaim',
            lm: 'Emma Thompson',
            sm: 'Layla Mohamed',
            team: 'DSM'
        },
        {
            code: '10008',
            company: 'Emaar Properties',
            lm: 'Emma Thompson',
            sm: 'Layla Mohamed',
            team: 'DSM'
        },
        {
            code: '20001',
            company: 'DP World',
            lm: 'Sarah Johnson',
            sm: 'Khalid Nasser',
            team: 'TSM-ME'
        },
        {
            code: '20002',
            company: 'Dubai Health Authority',
            lm: 'Sarah Johnson',
            sm: 'Khalid Nasser',
            team: 'TSM-ME'
        },
        {
            code: '20003',
            company: 'DEWA',
            lm: 'Michael Chen',
            sm: 'Mariam Said',
            team: 'TSM-ME'
        },
        {
            code: '20004',
            company: 'RTA Dubai',
            lm: 'Michael Chen',
            sm: 'Mariam Said',
            team: 'TSM-ME'
        },
        {
            code: '20005',
            company: 'Dubai Customs',
            lm: 'David Williams',
            sm: 'Hassan Rashid',
            team: 'TSM-ME'
        },
        {
            code: '30001',
            company: 'Abu Dhabi Tourism',
            lm: 'David Williams',
            sm: 'Noura Abdulla',
            team: 'TSM-SE'
        },
        {
            code: '30002',
            company: 'Emirates NBD',
            lm: 'Emma Thompson',
            sm: 'Noura Abdulla',
            team: 'TSM-SE'
        },
        {
            code: '30003',
            company: 'First Abu Dhabi Bank',
            lm: 'Emma Thompson',
            sm: 'Yusuf Al-Hajj',
            team: 'TSM-SE'
        },
        {
            code: '30004',
            company: 'Dubai Islamic Bank',
            lm: 'Sarah Johnson',
            sm: 'Yusuf Al-Hajj',
            team: 'TSM-SE'
        },
        {
            code: '30005',
            company: 'Mashreq Bank',
            lm: 'Sarah Johnson',
            sm: 'Reem Al-Zaabi',
            team: 'TSM-SE'
        }
    ];
    const areas = ['Billing', 'Technical', 'Service Request', 'Complaint', 'Information', 'Activation', 'Cancellation', 'Upgrade'];
    const subAreas = ['Invoice Query', 'Network Issue', 'Data Issue', 'Voice Issue', 'SIM Replacement', 'Plan Change', 'Roaming', 'Barring'];
    const statusesEv = ['Completed', 'Open', 'Pending', 'In Progress', 'Escalated', 'Closed'];
    const commModes = ['Inbound', 'Outbound', 'Email', 'Walk-in', 'Online Portal', 'Chat'];
    const custTypes = ['Corporate', 'SMB', 'Government', 'Enterprise'];
    const segments = ['Platinum', 'Gold', 'Silver', 'Bronze'];
    const nats = ['UAE', 'Saudi Arabia', 'India', 'Pakistan', 'Egypt', 'Jordan', 'UK', 'USA', 'Philippines'];
    const services = ['Fixed Broadband', 'Mobile', 'Cloud', 'Security', 'Managed Services', 'IoT', 'Voice'];
    const langs = ['Arabic', 'English', 'Urdu', 'Hindi'];
    const emtyaz = ['Elite', 'Premium', 'Standard'];
    const weeks = ['W1', 'W2', 'W3', 'W4', 'W5'];
    const months = ['Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26'];
    const actSt = ['Open', 'Closed', 'In Progress', 'Cancelled', 'Deferred', 'Completed'];
    const actTypes = ['Call', 'Meeting', 'Email', 'Demo', 'Proposal', 'Review', 'Site Visit', 'Follow-up'];
    const actPri = ['High', 'Medium', 'Low', 'Critical'];
    const optySt = ['Open', 'Won', 'Lost', 'In Progress', 'Qualified', 'Proposal Sent'];
    const optyAreas = ['Fixed BB', 'Mobile', 'Cloud', 'Security', 'Managed Services', 'IoT', 'Voice'];

    function rnd(a) {
        return a[Math.floor(Math.random() * a.length)];
    }

    function rndDate(s, e) {
        return new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime()));
    }

    function fmt(d) {
        return d.toISOString().split('T')[0];
    }

    function rndBool(p) {
        return Math.random() < (p || 0.5);
    }

    function rndInt(a, b) {
        return Math.floor(Math.random() * (b - a + 1)) + a;
    }
    const s = new Date('2025-10-01'),
        e = new Date('2026-02-28');

    // ── EVENTS dummy data (unchanged) ─────────────────────────
    const events = [];
    for (let i = 0; i < 150; i++) {
        const acc = rnd(accounts);
        const mo = rnd(months);
        const isRep = rndBool(0.25);
        const created = rndDate(s, e);
        events.push({
            TEAM: acc.team,
            ACCOUNT_NUMBER: acc.code,
            COMPANY_NAME: acc.company,
            LM: acc.lm,
            SM: acc.sm,
            CREATED: fmt(created),
            TYPE: rnd(['Inbound Call', 'Outbound Call', 'Email', 'Walk-in', 'Online', 'Escalation']),
            AREA: rnd(areas),
            SUB_AREA: rnd(subAreas),
            STATUS: rnd(statusesEv),
            SERVICE_NUMBER: '971' + rndInt(500000000, 599999999),
            COMMUNICATION_MODE: rnd(commModes),
            CUSTOMER_VALUE: rnd(['High', 'Medium', 'Low', 'VIP']),
            IF_CTI_USED: rndBool(0.6) ? 'Yes' : 'No',
            CUSTOMER_TYPE: rnd(custTypes),
            CUSTOMER_SEGMENT: rnd(segments),
            NATIONALITY: rnd(nats),
            EMARATI_NATIONAL: rndBool(0.35) ? 'Yes' : 'No',
            CREATED_BY: 'Agent_' + rndInt(1, 20),
            SERVICE: rnd(services),
            CALL_CENTER: rnd(['Dubai CC', 'Abu Dhabi CC', 'Sharjah CC', 'Online']),
            DESCRIPTION: rnd(['Customer complaint', 'Billing inquiry', 'Technical support', 'Upgrade request', 'Plan change', 'Connection issue']),
            REPEATED_AGEING: isRep ? rndInt(1, 30) : 0,
            REPEATED_DATE: isRep ? fmt(rndDate(s, created)) : '',
            SIGNATURE_ACCOUNT: rndBool(0.4) ? 'Yes' : 'No',
            IF_NEW_TRIPLET: rndBool(0.3) ? 'Yes' : 'No',
            LANGUAGE: rnd(langs),
            EMTYAZ_SEGMENT: rnd(emtyaz),
            Week: rnd(weeks),
            Month: mo,
            Year: mo.includes('25') ? '2025' : '2026',
            Quarter: ['Oct-25', 'Nov-25', 'Dec-25'].includes(mo) ? 'Q4-2025' : 'Q1-2026'
        });
    }

    // ── TT dummy data (PATCHED) ───────────────────────────────
    const ttTypes = ['ENT_Fixed_Products', 'ENT_Mobile_Postpaid_Serv_Req', 'ENT_Fixed_Billing',
        'ENT_Mobile_Postpaid_Complaint', 'ENT_Fixed_Fault', 'ENT_Cloud_Services',
        'ENT_Mobile_Broadband', 'ENT_Managed_Services'
    ];
    const ttStatuses = ['Closed', 'Pending For Closure', 'Resolved', 'Open', 'In Progress', 'Escalated'];
    const ttAreas = ['Broadband', 'IP Phone', 'Migration', 'Mobile Service', 'Billing',
        'Voice', 'Cloud', 'MPLS', 'Security', 'IoT'
    ];
    const ttSubAreas = ['Speed Issue', 'Connectivity', 'Invoice Error', 'Line Fault',
        'SIM Issue', 'Config', 'Roaming', 'Barring', 'Port Forwarding', 'DNS'
    ];
    const ttPriorities = ['P1', 'P2', 'P3', 'P4'];
    const ttTicketTypes = ['Standard', 'VIP', 'SLA', 'Critical', 'Normal'];
    const ttSubStatuses = ['In Progress', 'Pending L2', 'Pending L3', 'Waiting Customer',
        'Reassigned', 'Returned', 'Wrong Assignment', 'Reopened', 'Resolved Pending Conf'
    ];
    const ttAgeingBuckets = ['0-12 hrs', '12-24 hrs', '24-48 hrs', '48-72 hrs', '72+ hrs'];
    const ttResolutions = ['BREACHED', 'WITHIN', 'N/A'];
    const ttProducts = ['Fixed BB', 'Mobile', 'Cloud', 'MPLS', 'SIP Trunk', 'IoT', 'Security', 'Voice'];
    const ttCustSegments = ['Platinum', 'Gold', 'Silver', 'Bronze', 'VIP'];
    const ttBucketRaw = {
        '0-12 hrs': 6,
        '12-24 hrs': 18,
        '24-48 hrs': 36,
        '48-72 hrs': 60,
        '72+ hrs': 96
    };

    const tts = [];
    for (let i = 0; i < 150; i++) {
        const acc = rnd(accounts);
        const mo = rnd(months);
        const openTime = rndDate(s, e);
        const bucket = rnd(ttAgeingBuckets);
        const rawHrs = ttBucketRaw[bucket] + rndInt(-4, 4);
        const status = rnd(ttStatuses);
        const isClosed = status === 'Closed' || status === 'Resolved';
        const resolution = isClosed ? (rndBool(0.25) ? 'BREACHED' : 'WITHIN') : 'N/A';
        const subStatus = rnd(ttSubStatuses);
        const repeated = rndBool(0.3) ? 'Yes' : 'No';
        const firstContact = (isClosed && rndBool(0.45)) ? 'Yes' : 'No';
        tts.push({
            TEAM: acc.team,
            ACCOUNT_NUMBER: acc.code,
            COMPANY_NAME: acc.company,
            LM: acc.lm,
            SM: acc.sm,
            TICKET_NUMBER: 'TT' + rndInt(1000000, 9999999),
            TYPE: rnd(ttTypes),
            OPEN_TIME: fmt(openTime),
            TT_STATUS: status,
            AREA: rnd(ttAreas),
            CLOSE_DATE: isClosed ? fmt(rndDate(openTime, e)) : '',
            RESOLUTION: resolution,
            SLA: isClosed ? (rndBool(0.25) ? 'Breached' : 'Not Breached') : 'N/A',
            SUB_AREA: rnd(ttSubAreas),
              DRIVER: rnd(ttAreas) + '_' + rnd(ttSubAreas),
            TICKET_TYPE: rnd(ttTicketTypes),
            SUB_STATUS: subStatus,
            SPRIORITY: rnd(ttPriorities),
            REPEATED: repeated,
            AGEING_QUEUE: bucket,
            AGEING_QUEUE_RAW: rawHrs,
            CUSTOMER_SEGMENT: rnd(ttCustSegments),
            FIRST_CONTACT: firstContact,
            LAST_UPDATE: fmt(rndDate(openTime, e)),
            PRODUCT: rnd(ttProducts),
            AGENT: 'Agent_' + rndInt(1, 30),
            DESCRIPTION: rnd(['Network issue', 'Slow internet', 'Voice quality', 'Service outage',
                'Billing discrepancy', 'Config issue', 'SIM fault', 'Migration stuck'
            ]),
            RESOLVE_DATETIME_MIN: isClosed ? fmt(rndDate(openTime, e)) : '',
            RESOLVE_DATETIME: isClosed ? fmt(rndDate(openTime, e)) : '',
            Week: rnd(weeks),
            Month: mo,
            Year: mo.includes('25') ? '2025' : '2026',
            Quarter: ['Oct-25', 'Nov-25', 'Dec-25'].includes(mo) ? 'Q4-2025' : 'Q1-2026'
        });
    }

// ── ACTIVITIES dummy data ─────────────────────────────────
    const actStatuses = ['Done', 'Assigned', 'Unassigned', 'In Progress', 'Open', 'Cancelled', 'Rejected'];
    const actServiceCats = ['Mobile Services', 'Fixed IP Services', 'Managed Services', 'Fixed Access Services', 'Fixed Voice Services'];
    const actOptyAreas = ['Postpaid', 'VAS', 'Other', 'Fixed Broadband', 'Handsets', 'Managed Infrastructure', 'Mobile data', 'Managed IP Voice', 'Prepaid', 'Fixed CPE', 'Managed Applications'];
    const actDescriptions = ['Deactivate service', 'Data booster activation', 'IR Activation', 'VAS request', 'User limit update', 'Roaming pack activation', 'Contract renewal', 'Number cancellation', 'Plan change', 'SIM replacement'];
    const actAgeingBuckets = ['000-Days', '001-Days', '002-Days', '003-Days', '004-Days', '005-Days', '006-Days', '007-Days'];
    const agentIds = ['CNFXSKG4', 'CTKPUFUP', 'CTKP2MI7', 'CDGRCKCZ', 'CNFXIVBD', 'CTKPD2ZN', 'CTKPLO36', 'CTKPS5EO', 'CDGRUZQP', 'CNFXHQNX'];

    const activities = [];
    for (let i = 0; i < 150; i++) {
        const acc = rnd(accounts);
        const mo = rnd(months);
        const creation = rndDate(s, e);
        const status = rnd(actStatuses);
        const isClosed = status === 'Done' || status === 'Cancelled' || status === 'Rejected';
        const ageingDays = rndInt(0, 7);
        const ageing = String(ageingDays).padStart(3, '0') + '-Days';
        activities.push({
            TEAM: acc.team,
            ACCOUNT_CODE: acc.code,
            ACCOUNT: acc.company,
            COMPANY_NAME: acc.company,
            LM: acc.lm,
            SM: acc.sm,
            ACTIVITY_STATUS: status,
            ACTIVITY_ID: '1-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            DESCRIPTION: rnd(actDescriptions),
            ACTIVITY_CREATION: fmt(creation),
            ACTIVITY_CLOSE_DT: isClosed ? fmt(rndDate(creation, e)) : '',
            AGEING_ACTIVITY: ageing,
            ACTIVITY_TYPE: 'Activity',
            COMMENTS: rnd(['Good progress', 'Customer interested', 'Needs follow-up', 'Proposal sent', 'Waiting decision', 'Customer unresponsive']),
            ACTIVITY_CREATED_BY: rnd(agentIds),
            OPTY_CD: rnd(actServiceCats),
            OPTY_AREA: rnd(actOptyAreas),
            Week: rnd(weeks),
            Month: mo,
            Year: mo.includes('25') ? '2025' : '2026',
            Quarter: ['Oct-25', 'Nov-25', 'Dec-25'].includes(mo) ? 'Q4-2025' : 'Q1-2026'
        });
    }

// No-activity accounts (accounts with no activities)
    var actCodeSet = new Set(activities.map(a => a.ACCOUNT_CODE));
    var noActivityAccounts = accounts.filter(a => !actCodeSet.has(a.code)).map(a => ({
        ACCOUNT_CODE: a.code,
        COMPANY_NAME: a.company,
        LM: a.lm,
        SM: a.sm,
        TEAM: a.team,
        IS_PARENT: true
    }));

    return {
        events,
        tts,
        activities,
        noTTAccounts: accounts.filter(a => !new Set(tts.map(t => t.ACCOUNT_NUMBER)).has(a.code)).map(a => ({
            ACCOUNT_NUMBER: a.code, COMPANY_NAME: a.company, LM: a.lm, SM: a.sm, TEAM: a.team, IS_PARENT: true
        })),
        unmatchedTTs: [],
        noActivityAccounts,
        unmatchedActivities: []
    };
}
async function etaFetchEventsExcel() {
    try {
        var url = ETA_SP_CONFIG.siteUrl + "/_api/web/GetFileByServerRelativeUrl('" + 
            ETA_SP_CONFIG.eventsExcelPath + "')/$value";
        var res = await fetch(url, { headers: { Accept: 'application/octet-stream' } });
        if (!res.ok) {
            console.warn('ETA: Could not fetch Events.xlsx:', res.status);
            return [];
        }
        var buffer = await res.arrayBuffer();
        var data = new Uint8Array(buffer);
        var workbook = XLSX.read(data, { type: 'array', cellDates: true });
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        return rows.map(function(r) {
            // Normalize date
            var dateStr = '';
            if (r['Date'] instanceof Date) dateStr = r['Date'].toISOString().split('T')[0];
            else if (r['CREATED'] instanceof Date) dateStr = r['CREATED'].toISOString().split('T')[0];
            else dateStr = r['Date'] || r['CREATED'] || '';

            var dateFields = etaCalcDateFields(dateStr);

            return {
                CREATED: dateStr,
                TYPE: (r['TYPE'] || '').toString().trim(),
                AREA: (r['AREA'] || '').toString().trim(),
                ACCOUNT_NUMBER: (r['ACCOUNT_NUMBER'] || '').toString().trim(),
                SUB_AREA: (r['SUB_AREA'] || '').toString().trim(),
                STATUS: (r['STATUS'] || '').toString().trim(),
                SERVICE_NUMBER: (r['SERVICE_NUMBER'] || '').toString().trim(),
                COMMUNICATION_MODE: (r['COMMUNICATION_MODE'] || '').toString().trim(),
                CUSTOMER_VALUE: (r['CUSTOMER_VALUE'] || '').toString().trim(),
                IF_CTI_USED: (r['IF_CTI_USED'] || '').toString().trim(),
                CUSTOMER_TYPE: (r['CUSTOMER_TYPE'] || '').toString().trim(),
                CUSTOMER_SEGMENT: (r['CUSTOMER_SEGMENT'] || '').toString().trim(),
                NATIONALITY: (r['NATIONALITY'] || '').toString().trim(),
                EMARATI_NATIONAL: (r['EMARATI_NATIONAL'] || '').toString().trim(),
                CREATED_BY: (r['CREATED_BY'] || r['Created By'] || '').toString().trim(),
                SERVICE: (r['SERVICE'] || '').toString().trim(),
                CALL_CENTER: (r['CALL_CENTER'] || '').toString().trim(),
                DESCRIPTION: (r['DESCRIPTION'] || '').toString().trim().substring(0, 255),
                REPEATED_AGEING: parseFloat(r['REPEATED_AGEING']) || 0,
                REPEATED_DATE: r['REPEATED_DATE'] instanceof Date ? r['REPEATED_DATE'].toISOString().split('T')[0] : (r['REPEATED_DATE'] || ''),
                COMPANY_NAME: (r['COMPANY_NAME'] || '').toString().trim(),
                SIGNATURE_ACCOUNT: (r['SIGNATURE_ACCOUNT'] || '').toString().trim(),
                IF_NEW_TRIPLET: (r['IF_NEW_TRIPLET'] || '').toString().trim(),
                LANGUAGE: (r['LANGUAGE'] || '').toString().trim(),
                EMTYAZ_SEGMENT: (r['EMTYAZ_SEGMENT'] || '').toString().trim(),
                // LM/SM from account map
                LM: '',
                SM: '',
                TEAM: '',
                Week: r['Week'] || dateFields.Week,
                Month: dateFields.Month,
                Year: dateFields.Year,
                Quarter: dateFields.Quarter
            };
        });
    } catch(e) {
        console.warn('ETA: Failed to parse Events.xlsx:', e.message);
        return [];
    }
}

async function etaFetchTTExcel() {
    try {
var url = ETA_SP_CONFIG.siteUrl + "/_api/web/GetFileByServerRelativeUrl('" + ETA_SP_CONFIG.ttExcelPath + "')/$value";        var res = await fetch(url, { headers: { Accept: 'application/octet-stream' } });
        if (!res.ok) {
            console.warn('ETA: Could not fetch TT.xlsx:', res.status);
            return [];
        }
        var buffer = await res.arrayBuffer();
        var data = new Uint8Array(buffer);
        var workbook = XLSX.read(data, { type: 'array', cellDates: true });
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        return rows.map(function(r) {
            var openTime = r['OPEN_TIME'] instanceof Date ? r['OPEN_TIME'].toISOString().split('T')[0] : (r['OPEN_TIME'] || '');
            var closeDate = r['CLOSE_DATE'] instanceof Date ? r['CLOSE_DATE'].toISOString().split('T')[0] : (r['CLOSE_DATE'] || '');
            var lastUpdate = r['LAST_UPDATE'] instanceof Date ? r['LAST_UPDATE'].toISOString().split('T')[0] : (r['LAST_UPDATE'] || '');
            var resolveMin = r['RESOLVE_DATETIME_MIN'] instanceof Date ? r['RESOLVE_DATETIME_MIN'].toISOString().split('T')[0] : (r['RESOLVE_DATETIME_MIN'] || '');
            var resolveEnd = r['RESOLVE_DATETIME'] instanceof Date ? r['RESOLVE_DATETIME'].toISOString().split('T')[0] : (r['RESOLVE_DATETIME'] || '');

            var dateFields = etaCalcDateFields(openTime);

            return {
                TICKET_NUMBER:      (r['TICKET_NUMBER'] || '').toString().trim(),
                TYPE:               (r['TYPE1'] || r['TYPE'] || '').toString().trim(),
                TYPE1:              (r['TYPE1'] || r['TYPE'] || '').toString().trim(),
                OPEN_TIME:          openTime,
                TT_STATUS:          (r['TT_STATUS'] || '').toString().trim(),
                AREA:               (r['AREA'] || '').toString().trim(),
                CLOSE_DATE:         closeDate,
                RESOLUTION:         (r['RESOLUTION'] || '').toString().trim(),
                SUB_AREA:           (r['SUB_AREA'] || '').toString().trim(),
                DRIVER:             [(r['AREA'] || ''), (r['SUB_AREA'] || '')].filter(Boolean).join('_'),
                TICKET_TYPE:        (r['TICKET_TYPE'] || '').toString().trim(),
                SUB_STATUS:         (r['SUB_STATUS'] || '').toString().trim(),
                SPRIORITY:          (r['SPRIORITY'] || '').toString().trim(),
                REPEATED:           (r['REPEATED'] || '').toString().trim(),
                AGEING_QUEUE:       (r['AGEING_QUEUE'] || '').toString().trim(),
                AGEING_QUEUE_RAW:   parseFloat(r['AGEING_QUEUE_RAW']) || 0,
                CUSTOMER_SEGMENT:   (r['CUSTOMER_SEGMENT'] || '').toString().trim(),
                FIRST_CONTACT:      (r['FIRST_CONTACT'] || '').toString().trim(),
                LAST_UPDATE:        lastUpdate,
                COMPANY_NAME:       (r['COMPANY_NAME'] || '').toString().trim(),
                ACCOUNT_NUMBER:     (r['ACCOUNT_NUMBER'] || '').toString().trim().replace(/^"+|"+$/g, ''),
                PRODUCT:            (r['PRODUCT'] || '').toString().trim(),
                AGENT:              (r['AGENT'] || '').toString().trim(),
                DESCRIPTION:        (r['DESCRIPTION'] || '').toString().trim().substring(0, 255),
                RESOLVE_DATETIME_MIN: resolveMin,
                RESOLVE_DATETIME:   resolveEnd,
                MISHANDLED:         (r['MISHANDLED'] || '').toString().trim(),
                SLA:                (r['SLA'] || '').toString().trim(),
                // LM/SM filled later from agentMap/accMap
                LM:   '',
                SM:   '',
                TEAM: '',
                Week:    r['Week'] || dateFields.Week,
                Month:   dateFields.Month,
                Year:    dateFields.Year,
                Quarter: dateFields.Quarter
            };
        });
    } catch(e) {
        console.warn('ETA: Failed to parse TT.xlsx:', e.message);
        return [];
    }
}

async function etaFetchActivitiesExcel() {
    try {
var url = ETA_SP_CONFIG.siteUrl + "/_api/web/GetFileByServerRelativeUrl('" + ETA_SP_CONFIG.actExcelPath + "')/$value";        var res = await fetch(url, { headers: { Accept: 'application/octet-stream' } });
        if (!res.ok) {
            console.warn('ETA: Could not fetch Activities.xlsx:', res.status);
            return [];
        }
        var buffer = await res.arrayBuffer();
        var data = new Uint8Array(buffer);
        var workbook = XLSX.read(data, { type: 'array', cellDates: true });
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        return rows.map(function(r) {
            var creation = r['ACTIVITY_CREATION'] instanceof Date ? r['ACTIVITY_CREATION'].toISOString().split('T')[0] : (r['ACTIVITY_CREATION'] || '');
            var closeDt  = r['ACTIVITY_CLOSE_DT'] instanceof Date ? r['ACTIVITY_CLOSE_DT'].toISOString().split('T')[0] : (r['ACTIVITY_CLOSE_DT'] || '');

            var dateFields = etaCalcDateFields(creation);

            return {
                ACTIVITY_STATUS:    (r['ACTIVITY_STATUS'] || '').toString().trim(),
                ACTIVITY_ID:        (r['ACTIVITY_ID'] || '').toString().trim(),
                DESCRIPTION:        (r['DESCRIPTION'] || '').toString().trim().substring(0, 255),
                ACTIVITY_CREATION:  creation,
                ACTIVITY_CLOSE_DT:  closeDt,
                AGEING_ACTIVITY:    (r['AGEING_ACTIVITY'] || '').toString().trim(),
                ACTIVITY_TYPE:      (r['ACTIVITY_TYPE'] || '').toString().trim(),
                COMMENTS:           (r['COMMENTS'] || '').toString().trim(),
                ACTIVITY_CREATED_BY:(r['ACTIVITY_CREATED_BY'] || '').toString().trim(),
                ACCOUNT:            (r['ACCOUNT'] || '').toString().trim(),
                ACCOUNT_CODE:       (r['ACCOUNT_CODE'] || '').toString().trim().replace(/^"+|"+$/g, ''),
                COMPANY_NAME:       (r['ACCOUNT'] || r['ACCOUNT_CODE'] || '').toString().trim(),
                OPTY_CD:            (r['OPTY_CD'] || '').toString().trim(),
                OPTY_AREA:          (r['OPTY_AREA'] || '').toString().trim(),
                // LM/SM filled later from agentMap/accMap
                LM:   '',
                SM:   '',
                TEAM: '',
                Week:    r['Week'] || dateFields.Week,
                Month:   dateFields.Month,
                Year:    dateFields.Year,
                Quarter: dateFields.Quarter
            };
        });
    } catch(e) {
        console.warn('ETA: Failed to parse Activities.xlsx:', e.message);
        return [];
    }
}
// ── SHAREPOINT LIVE DATA LOADER ───────────────────────────────
async function etaSPFetch(site, list, select, filter) {
    var url = site + "/_api/web/lists/getbytitle('" + list + "')/items?$select=" + select + "&$top=5000";
    if (filter) url += '&$filter=' + filter;
    var all = [];
    try {
        while (url) {
            var res = await fetch(url, {
                headers: {
                    Accept: 'application/json;odata=verbose'
                }
            });
            var json = await res.json();
            // List doesn't exist or error returned
            if (!json.d || json.error) {
                console.warn('ETA: List not found or error for [' + list + ']:', json.error && json.error.message && json.error.message.value);
                return [];
            }
            all.push.apply(all, json.d.results || []);
            url = json.d.__next || null;
        }
    } catch (e) {
        console.warn('ETA: Failed to fetch list [' + list + ']:', e.message);
        return [];
    }
    return all;
}

function etaCalcDateFields(dateStr) {
    if (!dateStr) return {
        Week: '',
        Month: '',
        Year: '',
        Quarter: ''
    };
    var d = new Date(dateStr);
    var day = d.getDate();
    var mon = d.getMonth();
    var yr = d.getFullYear();
    var week = 'W' + Math.min(Math.ceil(day / 7), 5);
    var monName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mon];
    var month = monName + '-' + String(yr).slice(2);
    var qtr = (mon <= 2 ? 'Q1' : mon <= 5 ? 'Q2' : mon <= 8 ? 'Q3' : 'Q4') + '-' + yr;
    return {
        Week: week,
        Month: month,
        Year: String(yr),
        Quarter: qtr
    };
}
function etaStripTrailingZerosFromSegment(seg) {
    if (/^\d+$/.test(seg) && seg.length > 1) {
        return String(parseFloat(seg));
    }
    return seg;
}

function etaNormalizeAcc(acc) {
    if (!acc) return acc;
    return acc.split('.').map(etaStripTrailingZerosFromSegment).join('.');
}

function etaStripTrailingZeros(acc) {
    if (!acc) return acc;
    return acc.replace(/\.(\d*[1-9])0+$/, '.$1').replace(/\.(0+)$/, '');
}

function etaTrimToSecondDot(acc) {
    if (!acc) return acc;
    var parts = acc.split('.');
    if (parts.length < 2) return acc;
    return parts[0] + '.' + parts[1];
}
async function etaLoadSPData() {
    var site = ETA_SP_CONFIG.siteUrl;
    var cfg  = ETA_SP_CONFIG;

    var accSel    = 'Title,Line_x0020_Manager/Title,Service_x0020_Manager/Title,Team,Parent_x0020_Code';
    var accExpand = 'Line_x0020_Manager,Service_x0020_Manager';
    var mapSel    = 'Title,Service_Manager_Name,Email_ID,User_ID,Team';

    // All three data tabs now load from Excel
    var results = await Promise.all([
        etaFetchTTExcel(),
        etaSPFetchExpand(site, cfg.mainList, accSel, accExpand),
        etaSPFetch(site, cfg.mappingList, mapSel),
        etaFetchActivitiesExcel(),
        etaFetchEventsExcel()
    ]);

    var ttRaw      = results[0];
    var accRaw     = results[1];
    var mappingRaw = results[2];
    var actRaw     = results[3];
    var eventsRaw  = results[4];

    // Agent map: User_ID → { lm, sm, team }
    var agentMap = {};
    mappingRaw.forEach(function(a) {
        agentMap[a.User_ID] = {
            lm:   a.Title || '',
            sm:   a.Service_Manager_Name || '',
            team: a.Team || ''
        };
    });

    // Account master map: code → { lm, sm, team }
    var accMap = {};
    accRaw.forEach(function(a) {
        var title = (a.Title || '').toString().trim();
        accMap[title] = {
            lm:   (a.Line_x0020_Manager && a.Line_x0020_Manager.Title) || '',
            sm:   (a.Service_x0020_Manager && a.Service_x0020_Manager.Title) || '',
            team: a.Team || ''
        };
    });

    // Enrich TTs
    var tts = ttRaw.map(function(r) {
        var info    = agentMap[r.AGENT] || {};
        var acc     = (r.ACCOUNT_NUMBER || '').toString().trim().replace(/^"+|"+$/g, '');
        var accInfo = accMap[acc] || {};
        r.LM   = info.lm   || accInfo.lm   || '';
        r.SM   = info.sm   || accInfo.sm   || '';
        r.TEAM = info.team || accInfo.team || '';
        return r;
    });

    // No-TT accounts
    var ttAccountSet = new Set(tts.map(function(r) { return r.ACCOUNT_NUMBER; }).filter(Boolean));
    var noTTAccounts = accRaw.filter(function(a) {
        return !ttAccountSet.has(a.Title);
    }).map(function(a) {
        return {
            ACCOUNT_NUMBER: a.Title,
            COMPANY_NAME:   a.Title,
            LM:   (a.Line_x0020_Manager && a.Line_x0020_Manager.Title) || '',
            SM:   (a.Service_x0020_Manager && a.Service_x0020_Manager.Title) || '',
            TEAM: a.Team || '',
            IS_PARENT: (a.Parent_x0020_Code && a.Title === a.Parent_x0020_Code) ? true : false
        };
    });

    // Unmatched TTs
    var accSet = new Set(Object.keys(accMap).map(function(k) { return k.trim().replace(/^"+|"+$/g, ''); }));
    var unmatchedTTs = tts.filter(function(r) {
        var acc = (r.ACCOUNT_NUMBER || '').toString().trim().replace(/^"+|"+$/g, '');
        if (!acc) return true;
        if (accSet.has(acc)) return false;
        var dots = acc.split('.').length - 1;
        if (dots < 2) {
            if (accSet.has(etaStripTrailingZeros(acc))) return false;
        } else {
            var trimmed = etaTrimToSecondDot(acc);
            if (accSet.has(trimmed)) return false;
            if (accSet.has(etaStripTrailingZeros(trimmed))) return false;
        }
        return true;
    });

    // Enrich Activities
    var activities = actRaw.map(function(r) {
        var agent   = (r.ACTIVITY_CREATED_BY || '').toString().trim();
        var info    = agentMap[agent] || {};
        var acc     = (r.ACCOUNT_CODE || '').toString().trim().replace(/^"+|"+$/g, '');
        var accInfo = accMap[acc] || {};
        r.LM   = info.lm   || accInfo.lm   || '';
        r.SM   = info.sm   || accInfo.sm   || '';
        r.TEAM = info.team || accInfo.team || '';
        return r;
    });

    // No-Activity accounts
    var actAccountSet = new Set(actRaw.map(function(r) {
        return (r.ACCOUNT_CODE || '').toString().trim().replace(/^"+|"+$/g, '');
    }).filter(Boolean));
    var noActivityAccounts = accRaw.filter(function(a) {
        return !actAccountSet.has((a.Title || '').toString().trim());
    }).map(function(a) {
        return {
            ACCOUNT_CODE:  a.Title,
            COMPANY_NAME:  a.Title,
            LM:   (a.Line_x0020_Manager && a.Line_x0020_Manager.Title) || '',
            SM:   (a.Service_x0020_Manager && a.Service_x0020_Manager.Title) || '',
            TEAM: a.Team || '',
            IS_PARENT: (a.Parent_x0020_Code && a.Title === a.Parent_x0020_Code) ? true : false
        };
    });

    // Unmatched Activities
    var actAccSet = new Set(Object.keys(accMap).map(function(k) { return k.trim().replace(/^"+|"+$/g, ''); }));
    var unmatchedActivities = activities.filter(function(r) {
        var acc = (r.ACCOUNT_CODE || '').toString().trim().replace(/^"+|"+$/g, '');
        if (!acc) return true;
        if (actAccSet.has(acc)) return false;
        var dots = acc.split('.').length - 1;
        if (dots < 2) {
            if (actAccSet.has(etaStripTrailingZeros(acc))) return false;
        } else {
            var trimmed = etaTrimToSecondDot(acc);
            if (actAccSet.has(trimmed)) return false;
            if (actAccSet.has(etaStripTrailingZeros(trimmed))) return false;
        }
        return true;
    });

    // Enrich Events
    eventsRaw.forEach(function(ev) {
        var acc     = (ev.ACCOUNT_NUMBER || '').toString().trim().replace(/^"+|"+$/g, '');
        var accInfo = accMap[acc] || {};
        ev.LM   = accInfo.lm   || '';
        ev.SM   = accInfo.sm   || '';
        ev.TEAM = accInfo.team || '';
    });

    // No-Event accounts
    var evtAccountSet = new Set(eventsRaw.map(function(r) {
        return (r.ACCOUNT_NUMBER || '').toString().trim().replace(/^"+|"+$/g, '');
    }).filter(Boolean));
    var noEventsAccounts = accRaw.filter(function(a) {
        return !evtAccountSet.has((a.Title || '').toString().trim());
    }).map(function(a) {
        return {
            ACCOUNT_NUMBER: a.Title,
            COMPANY_NAME:   a.Title,
            LM:   (a.Line_x0020_Manager && a.Line_x0020_Manager.Title) || '',
            SM:   (a.Service_x0020_Manager && a.Service_x0020_Manager.Title) || '',
            TEAM: a.Team || '',
            IS_PARENT: (a.Parent_x0020_Code && a.Title === a.Parent_x0020_Code) ? true : false
        };
    });

    // Unmatched Events
    var evtAccSet = new Set(Object.keys(accMap).map(function(k) { return k.trim().replace(/^"+|"+$/g, ''); }));
    var unmatchedEvents = eventsRaw.filter(function(r) {
        var acc = (r.ACCOUNT_NUMBER || '').toString().trim().replace(/^"+|"+$/g, '');
        if (!acc) return true;
        if (evtAccSet.has(acc)) return false;
        var dots = acc.split('.').length - 1;
        if (dots < 2) {
            if (evtAccSet.has(etaStripTrailingZeros(acc))) return false;
        } else {
            var trimmed = etaTrimToSecondDot(acc);
            if (evtAccSet.has(trimmed)) return false;
            if (evtAccSet.has(etaStripTrailingZeros(trimmed))) return false;
        }
        return true;
    });

    // Store
    ETA_STATE._originalTTs        = tts;
    ETA_STATE._originalActivities = activities;
    ETA_STATE._originalEvents     = eventsRaw;

    ETA_STATE.allData = {
        events:             eventsRaw,
        tts:                tts,
        activities:         activities,
        noTTAccounts:       noTTAccounts,
        unmatchedTTs:       unmatchedTTs,
        noActivityAccounts: noActivityAccounts,
        unmatchedActivities:unmatchedActivities,
        noEventsAccounts:   noEventsAccounts,
        unmatchedEvents:    unmatchedEvents,
        _accMap:            accMap,
        _agentMap:          agentMap
    };
}
async function etaSPFetchExpand(site, list, select, expand) {
    var url = site + "/_api/web/lists/getbytitle('" + list + "')/items?$select=" + select + "&$expand=" + expand + "&$top=5000";
    var all = [];
    try {
        while (url) {
            var res = await fetch(url, {
                headers: {
                    Accept: 'application/json;odata=verbose'
                }
            });
            var json = await res.json();
            if (!json.d || json.error) {
                console.warn('SP fetch error:', json.error && json.error.message && json.error.message.value);
                return [];
            }
            all.push.apply(all, json.d.results || []);
            url = json.d.__next || null;
        }
    } catch (e) {
        console.warn('SP fetch failed:', e.message);
        return [];
    }
    return all;
}
// ── DATA HELPERS ──────────────────────────────────────────────
function etaGetCurrentRaw() {
    const d = ETA_STATE.allData;
    if (!d) return [];
    if (ETA_STATE.activeTab === 'events') return d.events || [];
    if (ETA_STATE.activeTab === 'tt') return d.tts || [];
    return d.activities || [];
}

function etaApplyBaseFilters(data) {
    const f = ETA_STATE.filters;
    return data.filter(r => {
        if (f.team && r.TEAM !== f.team) return false;
        const ac = r.ACCOUNT_NUMBER || r.ACCOUNT_CODE;
        if (f.account && ac !== f.account) return false;
        if (f.years.length && !f.years.includes(r.Year)) return false;
        if (f.months.length && !f.months.includes(r.Month)) return false;
        if (f.quarters.length && !f.quarters.includes(r.Quarter)) return false;
        if (f.weeks.length && !f.weeks.includes(r.Week)) return false;
      if (f.statuses && f.statuses.length) {
            const st = r.STATUS || r.TT_STATUS || r.ACTIVITY_STATUS || '';
            if (!f.statuses.includes(st)) return false;
        }
      
        if (f.productFamily) {
            var type = r.TYPE || r.TYPE1 || '';
            if (f.productFamily === 'Fixed' && !type.startsWith('ENT_Fixed')) return false;
            if (f.productFamily === 'Mobile' && !type.startsWith('ENT_Mobile')) return false;
        }
        return true;
    });
}

function etaGetFiltered() {
    let data = etaApplyBaseFilters(etaGetCurrentRaw());
    if (ETA_STATE.selectedLM) data = data.filter(r => r.LM === ETA_STATE.selectedLM);
    if (ETA_STATE.selectedSM) data = data.filter(r => r.SM === ETA_STATE.selectedSM);
    return data;
}

// ── TEMPLATE ─────────────────────────────────────────────────
function etaBuildTemplate() {
    return `
<h2 class="section-title">
  <i data-lucide="layers" style="width:20px;height:20px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>
  Events / TT / Activity
  <span id="etaRecordCount" style="font-size:.72rem;font-weight:500;color:var(--t3);margin-left:.75rem;"></span>
</h2>

<div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">
  <button type="button" id="etaTab_events" class="eta-tab eta-tab-active" onclick="etaSwitchTab('events')">
    <i data-lucide="radio" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Events
  </button>
  <button type="button" id="etaTab_tt" class="eta-tab" onclick="etaSwitchTab('tt')">
    <i data-lucide="ticket" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Trouble Tickets
  </button>
  <button type="button" id="etaTab_activities" class="eta-tab" onclick="etaSwitchTab('activities')">
    <i data-lucide="zap" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Activities
  </button>
</div>

<div id="etaKpiTiles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:.85rem;margin-bottom:1rem;"></div>

<div class="filters-section" style="margin-bottom:1rem;">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.65rem;margin-bottom:.65rem;">

    <div class="filter-group" style="grid-column:span 2;">
      <label class="filter-label">Account</label>
      <div style="position:relative;">
        <input type="text" id="etaAccSearch" class="filter-select" placeholder="Search account..." oninput="etaFilterAccDD()" onfocus="etaShowAccDD()" onblur="setTimeout(etaHideAccDD,200)" autocomplete="off">
        <i data-lucide="chevron-down" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--t3);pointer-events:none;"></i>
        <div id="etaAccDDBox" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:700;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);max-height:220px;overflow-y:auto;"></div>
      </div>
    </div>

   <div class="filter-group">
      <label class="filter-label">Team</label>
      <select class="filter-select" id="etaTeamFilter" onchange="etaOnFilterChange('team',this.value)">
        <option value="">All Teams</option>
      </select>
    </div>
    <div class="filter-group">
  <label class="filter-label">Product Family</label>
  <select class="filter-select" id="etaProductFamilyFilter" onchange="etaOnProductFamilyChange(this.value)">
    <option value="">All</option>
    <option value="Fixed">Fixed</option>
    <option value="Mobile">Mobile</option>
  </select>
</div>

    <div class="filter-group">
      <label class="filter-label">Year</label>
      <div style="position:relative;">
        <button type="button" class="filter-select" style="text-align:left;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between;" onclick="etaTogglePanel('etaYearPanel')">
          <span id="etaYearLabel">All Years</span><i data-lucide="chevron-down" style="width:14px;height:14px;flex-shrink:0;"></i>
        </button>
   <div id="etaYearPanel" class="eta-multi-panel" style="display:none;"></div>
      </div>
    </div>

    <div class="filter-group">
      <label class="filter-label">Quarter</label>
      <div style="position:relative;">
        <button type="button" class="filter-select" style="text-align:left;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between;" onclick="etaTogglePanel('etaQtrPanel')">
          <span id="etaQtrLabel">All Quarters</span><i data-lucide="chevron-down" style="width:14px;height:14px;flex-shrink:0;"></i>
        </button>
      <div id="etaQtrPanel" class="eta-multi-panel" style="display:none;"></div>
      </div>
    </div>

    <div class="filter-group">
      <label class="filter-label">Month</label>
      <div style="position:relative;">
        <button type="button" class="filter-select" style="text-align:left;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between;" onclick="etaTogglePanel('etaMonthPanel')">
          <span id="etaMonthLabel">All Months</span><i data-lucide="chevron-down" style="width:14px;height:14px;flex-shrink:0;"></i>
        </button>
     <div id="etaMonthPanel" class="eta-multi-panel" style="display:none;"></div>
      </div>
    </div>

    <div class="filter-group">
      <label class="filter-label">Week</label>
      <div style="position:relative;">
        <button type="button" class="filter-select" style="text-align:left;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between;" onclick="etaTogglePanel('etaWeekPanel')">
          <span id="etaWeekLabel">All Weeks</span><i data-lucide="chevron-down" style="width:14px;height:14px;flex-shrink:0;"></i>
        </button>
        <div id="etaWeekPanel" class="eta-multi-panel" style="display:none;">
          ${['W1','W2','W3','W4','W5'].map(w=>`<label class="eta-chk"><input type="checkbox" value="${w}" onchange="etaMultiChange('weeks',this)"> ${w}</label>`).join('')}
        </div>
      </div>
    </div>

<div class="filter-group">
  <label class="filter-label">Status</label>
  <div style="position:relative;">
    <button type="button" class="filter-select" style="text-align:left;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between;" onclick="etaTogglePanel('etaStatusPanel')">
      <span id="etaStatusLabel">All Statuses</span><i data-lucide="chevron-down" style="width:14px;height:14px;flex-shrink:0;"></i>
    </button>
    <div id="etaStatusPanel" class="eta-multi-panel" style="display:none;max-height:200px;overflow-y:auto;"></div>
  </div>
</div>

  </div>
  <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
    <div id="etaActiveCrumbs" style="display:flex;gap:.4rem;flex-wrap:wrap;flex:1;min-height:24px;"></div>
<button type="button" id="etaChartsToggleBtn" class="eta-tab" onclick="etaToggleCharts()" style="display:inline-flex;align-items:center;">      <i data-lucide="bar-chart-2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Show Charts
    </button>
    <button type="button" class="reset-btn" onclick="etaResetAll()">
      <i data-lucide="rotate-ccw" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Reset All
    </button>
  </div>
</div>

<div id="etaLMSection">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.65rem;gap:.5rem;flex-wrap:wrap;">
    <h2 class="section-title" style="margin:0;">
      <i data-lucide="users" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>
      <span id="etaLMTitle">Line Manager Performance</span>
    </h2>
    <span id="etaLMBack" style="display:none;cursor:pointer;font-size:.78rem;color:var(--acc);font-weight:600;align-items:center;gap:3px;" onclick="etaClearLM()">
      <i data-lucide="arrow-left" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>Back to LMs
    </span>
  </div>
  <div id="etaLMGrid" class="lm-performance-grid"></div>
</div>

<div id="etaSMSection" style="display:none;margin-top:1.25rem;">
  <div style="display:flex;align-items:center;margin-bottom:.65rem;">
    <h2 class="section-title" style="margin:0;">
      <i data-lucide="bar-chart-3" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Service Manager Performance
    </h2>
  </div>
  <div id="etaSMList"></div>
</div>

<div id="etaChartsSection" style="margin-top:1.25rem;margin-bottom:1rem;"></div>

<div class="table-section">
  <div class="table-header">
    <h3 class="table-title">
      <i data-lucide="table-2" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>
      <span id="etaGridTitle">Records</span>
    </h3>
    <div class="table-actions">
      <input type="text" class="search-box" id="etaGridSearch" placeholder="Search all columns..." oninput="etaSearchGrid(this.value)">
      <button type="button" class="export-btn" onclick="etaExportGrid()">
        <i data-lucide="file-spreadsheet" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Export
      </button>
    </div>
  </div>
  <div id="etaGrid" class="ag-theme-alpine" style="height:550px;width:100%;"></div>
</div>

<style>
.eta-tab{padding:.48rem 1rem;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--t2);transition:all .18s;display:inline-flex;align-items:center;}
.eta-tab-active{background:var(--grad)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 2px 10px var(--glow);}
.eta-tab:not(.eta-tab-active):hover{background:var(--bg-hover);color:var(--t1);}

.eta-kpi{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:.9rem 1rem;box-shadow:var(--cs);position:relative;overflow:hidden;}
.eta-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad);}
.eta-kpi-label{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:700;margin-bottom:.3rem;}
.eta-kpi-value{font-size:1.6rem;font-weight:900;color:var(--sc);line-height:1;}
.eta-kpi-sub{font-size:.68rem;color:var(--t3);margin-top:.2rem;}
.eta-s{color:#10b981!important;}.eta-w{color:#f59e0b!important;}.eta-d{color:#ef4444!important;}.eta-a{color:var(--acc)!important;}

.eta-multi-panel{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:700;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:.4rem 0;min-width:160px;}
.eta-chk{display:flex;align-items:center;gap:.5rem;padding:.4rem .75rem;font-size:.82rem;color:var(--t1);cursor:pointer;transition:background .15s;}
.eta-chk:hover{background:var(--bg-hover);}
.eta-chk input{accent-color:var(--acc);width:14px;height:14px;cursor:pointer;}

.lm-performance-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.85rem;}
.lm-tile{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:1rem;box-shadow:var(--cs);cursor:pointer;transition:all .2s;position:relative;overflow:hidden;}
.lm-tile::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad);}
.lm-tile:hover{transform:translateY(-2px);box-shadow:0 6px 24px var(--glow);}
.lm-tile.selected{border-color:var(--acc)!important;box-shadow:0 0 0 2px var(--acc),0 6px 24px var(--glow)!important;}
.lm-tile h3{font-size:.9rem;font-weight:700;color:var(--t1);margin:0 0 .35rem;}
.lm-meta{font-size:.72rem;color:var(--t3);margin-bottom:.12rem;}
.lm-stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin:.55rem 0;}
.lm-stat-box{background:var(--bg-secondary);border-radius:7px;padding:.4rem .5rem;}
.lm-stat-label{font-size:.6rem;text-transform:uppercase;color:var(--t3);font-weight:600;margin-bottom:.08rem;}
.lm-stat-value{font-size:.95rem;font-weight:800;color:var(--sc);}
.lm-revenue{background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:.55rem .65rem;margin:.45rem 0;}.lm-revenue-label{font-size:.6rem;text-transform:uppercase;color:var(--t3);font-weight:700;margin-bottom:.25rem;}
.lm-revenue-count{font-size:1.25rem;font-weight:900;color:var(--sc);}
.lm-revenue-breakdown{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.3rem;margin-top:.35rem;}
.lm-revenue-item-label{font-size:.6rem;color:var(--t3);font-weight:600;}
.lm-revenue-item-value{font-size:.78rem;font-weight:700;color:var(--t1);}
.lm-progress-section{margin-top:.5rem;}
.lm-progress-row{display:flex;justify-content:space-between;font-size:.68rem;color:var(--t3);margin-bottom:.18rem;margin-top:.32rem;}
.lm-progress-value{font-weight:700;color:var(--t2);}
.progress-bar{height:5px;background:var(--bg-secondary);border-radius:3px;overflow:hidden;}
.progress-fill{height:100%;background:var(--grad);border-radius:3px;transition:width .4s;}

.manager-row{display:flex;align-items:center;gap:.85rem;padding:.75rem 1rem;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;margin-bottom:.5rem;cursor:pointer;transition:all .2s;flex-wrap:wrap;}
.manager-row:hover{background:var(--bg-hover);transform:translateX(3px);}
.manager-row.selected{border-color:var(--acc)!important;box-shadow:0 0 0 2px var(--acc)!important;}
.rank-badge{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:800;flex-shrink:0;}
.rank-1{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#fff;}
.rank-2{background:linear-gradient(135deg,#9ca3af,#6b7280);color:#fff;}
.rank-3{background:linear-gradient(135deg,#cd7c2a,#a0522d);color:#fff;}
.rank-other{background:var(--bg-secondary);color:var(--t2);}
.manager-name-col{min-width:130px;flex:1;}
.manager-name{font-size:.88rem;font-weight:700;color:var(--t1);}
.manager-tag{font-size:.65rem;padding:.15rem .45rem;border-radius:10px;background:var(--acc);color:#fff;font-weight:600;display:inline-block;margin-top:.15rem;}
.stat-col{text-align:center;min-width:70px;}
.stat-label{font-size:.6rem;text-transform:uppercase;color:var(--t3);font-weight:600;}
.stat-value{font-size:.88rem;font-weight:700;color:var(--t1);}
.progress-bar-col{flex:1;min-width:130px;}
.progress-label{font-size:.7rem;color:var(--t3);margin-bottom:.22rem;}

.eta-chart-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.85rem;}
.eta-chart-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1rem;box-shadow:var(--cs);}
.eta-chart-title{font-size:.8rem;font-weight:700;color:var(--t2);margin-bottom:.65rem;display:flex;align-items:center;gap:.35rem;}
.eta-chart-box{position:relative;height:240px;}
@media(max-width:900px){.eta-chart-grid{grid-template-columns:1fr;}}

.eta-kpi-clickable{cursor:pointer;transition:all .18s;}
.eta-kpi-clickable:hover{transform:translateY(-2px);box-shadow:0 4px 18px var(--glow)!important;border-color:var(--acc)!important;}
.eta-crumb{display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .55rem;background:var(--acc);color:#fff;border-radius:20px;font-size:.72rem;font-weight:600;cursor:pointer;}
.eta-crumb:hover{opacity:.82;}
</style>`;
}
window.etaOnProductFamilyChange = function(val) {
    ETA_STATE.filters.productFamily = val;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    etaRender();
};

// ── INIT ──────────────────────────────────────────────────────
window.etaInit = async function() {
    var view = document.getElementById('eta-view');
    if (!view) return;
    if (!ETA_STATE.initialized) {
        ETA_STATE.initialized = true;
        view.innerHTML = etaBuildTemplate();
        document.addEventListener('click', function(ev) {
            if (!ev.target.closest('.eta-multi-panel') && !ev.target.closest('[onclick*="etaTogglePanel"]'))
                document.querySelectorAll('.eta-multi-panel').forEach(p => p.style.display = 'none');
        });
if (ETA_USE_DUMMY) {
    ETA_STATE.allData = etaGenerateDummyData();
    ETA_STATE._originalTTs = ETA_STATE.allData.tts;
    ETA_STATE._originalActivities = ETA_STATE.allData.activities;
    ETA_STATE._originalEvents = ETA_STATE.allData.events;
} 
else {
    // ✅ Skip reload if background load already completed
    if (ETA_STATE.allData && ETA_STATE.allData.tts && ETA_STATE.allData.tts.length > 0) {
        console.log('[ETA] Data already loaded from background — skipping fetch');
    } else {
        var kpiEl = document.getElementById('etaKpiTiles');
        if (kpiEl) kpiEl.innerHTML = '<div style="padding:2rem;color:var(--t3);font-size:.85rem;grid-column:1/-1;">Loading data from SharePoint...</div>';
        try {
            await etaLoadSPData();
        } catch (err) {
            console.error('ETA SP load failed:', err);
            var kpiEl2 = document.getElementById('etaKpiTiles');
            if (kpiEl2) kpiEl2.innerHTML = '<div style="padding:2rem;color:#ef4444;font-size:.85rem;grid-column:1/-1;">Failed to load SharePoint data. Check console for details.</div>';
            return;
        }
    }
}

// ── ROLE SCOPING ──────────────────────────────────────────────
function etaScopeByRole(arr) {
    if (!arr) return [];
    var role = window.USER_CONTEXT.role;
    var name = window.USER_CONTEXT.userName;
    if (role === 'Line Manager')    return arr.filter(function(r){ return r.LM === name; });
    if (role === 'Service Manager') return arr.filter(function(r){ return r.SM === name; });
    if (window.USER_CONTEXT.isTSMManager) return arr.filter(function(r){ return r.TEAM === 'TSM_ME' || r.TEAM === 'TSM_SE' || r.TEAM === 'TSM-ME' || r.TEAM === 'TSM-SE'; });
    return arr;
}
ETA_STATE.allData.events              = etaScopeByRole(ETA_STATE.allData.events);
ETA_STATE.allData.tts                 = etaScopeByRole(ETA_STATE.allData.tts);
ETA_STATE.allData.activities          = etaScopeByRole(ETA_STATE.allData.activities);
ETA_STATE._originalTTs                = etaScopeByRole(ETA_STATE._originalTTs);
ETA_STATE._originalActivities         = etaScopeByRole(ETA_STATE._originalActivities);
ETA_STATE._originalEvents             = etaScopeByRole(ETA_STATE._originalEvents);
ETA_STATE.allData.noTTAccounts        = etaScopeByRole(ETA_STATE.allData.noTTAccounts);
ETA_STATE.allData.noEventsAccounts    = etaScopeByRole(ETA_STATE.allData.noEventsAccounts);
ETA_STATE.allData.noActivityAccounts  = etaScopeByRole(ETA_STATE.allData.noActivityAccounts);
ETA_STATE.allData.unmatchedTTs        = etaScopeByRole(ETA_STATE.allData.unmatchedTTs);
ETA_STATE.allData.unmatchedEvents     = etaScopeByRole(ETA_STATE.allData.unmatchedEvents);
ETA_STATE.allData.unmatchedActivities = etaScopeByRole(ETA_STATE.allData.unmatchedActivities);

if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    etaPopulateStatus();

    etaRender();
};

window.showETAView = function() {
    if (typeof analyticsTrackPage === 'function') analyticsTrackPage('Events / TT / Activity');
    switchDashboardSection('eta-view');
    ETA_STATE.initialized = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    etaInit();
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ── SWITCH TAB ────────────────────────────────────────────────
window.etaSwitchTab = function(tab) {
    if (ETA_STATE._noEventMode || ETA_STATE._unmatchedEventMode) {
        if (ETA_STATE._savedEvents) { ETA_STATE.allData.events = ETA_STATE._savedEvents; ETA_STATE._savedEvents = null; }
        else if (ETA_STATE._originalEvents) { ETA_STATE.allData.events = ETA_STATE._originalEvents; }
        ETA_STATE._noEventMode = false; ETA_STATE._unmatchedEventMode = false;
        var banner = document.getElementById('etaNoTTBanner'); if (banner) banner.remove();
    }
    // Exit special mode cleanly before switching tab
    if (ETA_STATE._noTTMode || ETA_STATE._unmatchedMode) {
        if (ETA_STATE._savedTTs) {
            ETA_STATE.allData.tts = ETA_STATE._savedTTs;
            ETA_STATE._savedTTs = null;
        } else if (ETA_STATE._originalTTs) {
            ETA_STATE.allData.tts = ETA_STATE._originalTTs;
        }
        ETA_STATE._noTTMode = false;
        ETA_STATE._unmatchedMode = false;
        var banner = document.getElementById('etaNoTTBanner');
        if (banner) banner.remove();
    }
    ETA_STATE.activeTab = tab;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    ETA_STATE.filters.account = '';
    ETA_STATE.filters.status = '';
    var inp = document.getElementById('etaAccSearch');
    if (inp) inp.value = '';
    ['events', 'tt', 'activities'].forEach(t => {
        var b = document.getElementById('etaTab_' + t);
        if (b) b.classList.toggle('eta-tab-active', t === tab);
    });
    etaPopulateStatus();
    etaRender();
};
// ── LM / SM SELECTION ─────────────────────────────────────────
window.etaSelectLM = function(name) {
    ETA_STATE.selectedLM = name;
    ETA_STATE.selectedSM = null;
    etaRender();
};
window.etaClearLM = function() {
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    etaRender();
};
window.etaSelectSM = function(name) {
    ETA_STATE.selectedSM = ETA_STATE.selectedSM === name ? null : name;
    etaRender();
};

// ── FILTERS ───────────────────────────────────────────────────
window.etaOnFilterChange = function(key, val) {
    ETA_STATE.filters[key] = val;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    etaRender();
};
window.etaTogglePanel = function(id) {
    document.querySelectorAll('.eta-multi-panel').forEach(p => {
        if (p.id !== id) p.style.display = 'none';
    });
    var p = document.getElementById(id);
    if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
};
window.etaMultiChange = function(key, cb) {
    var v = cb.value;
    var arr = ETA_STATE.filters[key];
    if (cb.checked) {
        if (!arr.includes(v)) arr.push(v);
    } else ETA_STATE.filters[key] = arr.filter(x => x !== v);
    var map = {
        years: ['etaYearLabel', 'All Years'],
        months: ['etaMonthLabel', 'All Months'],
        quarters: ['etaQtrLabel', 'All Quarters'],
        weeks: ['etaWeekLabel', 'All Weeks']
    };
    var lbl = document.getElementById(map[key][0]);
    if (lbl) lbl.textContent = ETA_STATE.filters[key].length ? ETA_STATE.filters[key].join(', ') : map[key][1];
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    etaRender();
};
window.etaStatusMultiChange = function(cb) {
    var v = cb.value;
    if (!ETA_STATE.filters.statuses) ETA_STATE.filters.statuses = [];
    if (cb.checked) {
        if (!ETA_STATE.filters.statuses.includes(v)) ETA_STATE.filters.statuses.push(v);
    } else {
        ETA_STATE.filters.statuses = ETA_STATE.filters.statuses.filter(x => x !== v);
    }
    var lbl = document.getElementById('etaStatusLabel');
    if (lbl) lbl.textContent = ETA_STATE.filters.statuses.length ? ETA_STATE.filters.statuses.join(', ') : 'All Statuses';
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    etaRender();
};
window.etaResetAll = function() {
  ETA_STATE.filters = {
        account: '',
        team: '',
        years: [],
        months: [],
        quarters: [],
        weeks: [],
        status: '',
        statuses: [],
        productFamily: ''
    };
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    var inp = document.getElementById('etaAccSearch');
    if (inp) inp.value = '';
    var tm = document.getElementById('etaTeamFilter');
    if (tm) tm.value = '';
    var pf = document.getElementById('etaProductFamilyFilter');
    if (pf) pf.value = '';
    [
        ['etaYearLabel', 'All Years'],
        ['etaMonthLabel', 'All Months'],
        ['etaQtrLabel', 'All Quarters'],
        ['etaWeekLabel', 'All Weeks']
    ].forEach(([id, t]) => {
        var el = document.getElementById(id);
        if (el) el.textContent = t;
    });
    document.querySelectorAll('.eta-chk input').forEach(c => c.checked = false);
    document.querySelectorAll('.eta-multi-panel').forEach(p => p.style.display = 'none');
   ETA_STATE.filters.statuses = [];
    var lbl = document.getElementById('etaStatusLabel');
    if (lbl) lbl.textContent = 'All Statuses';
    var panel = document.getElementById('etaStatusPanel');
    if (panel) panel.querySelectorAll('input').forEach(c => c.checked = false);
    etaClearKpiFilter();
    etaPopulateStatus();
    etaRender();
};
// KPI tile click → apply quick filter to AG Grid (and optionally filter data)
window.etaKpiFilter = function(field, valStr) {
    var vals = valStr.split(',').map(v => v.trim());
    ETA_STATE._kpiField = field;
    ETA_STATE._kpiVals = vals;

    // Also update LM/SM section with filtered data
    var baseData = etaApplyBaseFilters(etaGetCurrentRaw());
    var filteredBase = baseData.filter(r => {
        var val = r[field] || '';
        return vals.some(v => val === v);
    });
    etaRenderLMSection(filteredBase);
    etaRenderSMSection(filteredBase);

    if (ETA_STATE.gridApi) {
        ETA_STATE.gridApi.onFilterChanged();
        var g = document.getElementById('etaGrid');
        if (g) g.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
    document.querySelectorAll('.eta-kpi-clickable').forEach(el => {
        el.style.boxShadow = '';
        el.style.borderColor = '';
    });
    event.currentTarget.style.boxShadow = '0 0 0 2px var(--acc),0 4px 18px var(--glow)';
    event.currentTarget.style.borderColor = 'var(--acc)';
};
// Clear KPI filter (called by Reset All)
function etaClearKpiFilter() {
    ETA_STATE._kpiField = null;
    ETA_STATE._kpiVals = null;
    if (ETA_STATE.gridApi) ETA_STATE.gridApi.onFilterChanged();
    document.querySelectorAll('.eta-kpi-clickable').forEach(el => {
        el.style.boxShadow = '';
        el.style.borderColor = '';
    });
}

function etaPopulateStatus() {
    var raw = etaGetCurrentRaw();
    var sf = ETA_STATE.activeTab === 'tt' ? 'TT_STATUS' : ETA_STATE.activeTab === 'activities' ? 'ACTIVITY_STATUS' : 'STATUS';
    var sts = [...new Set(raw.map(r => r[sf]).filter(Boolean))].sort();
    var panel = document.getElementById('etaStatusPanel');
    if (!panel) return;
    panel.innerHTML = sts.map(s => `<label class="eta-chk"><input type="checkbox" value="${s}" onchange="etaStatusMultiChange(this)"${(ETA_STATE.filters.statuses||[]).includes(s)?' checked':''}> ${s}</label>`).join('');
    etaPopulateDynamicFilters(raw);
}
function etaPopulateDynamicFilters(raw) {
    // Years
    var years = [...new Set(raw.map(r => r.Year).filter(Boolean))].sort();
    var yPanel = document.getElementById('etaYearPanel');
    if (yPanel) yPanel.innerHTML = years.map(y => `<label class="eta-chk"><input type="checkbox" value="${y}" onchange="etaMultiChange('years',this)"${ETA_STATE.filters.years.includes(y)?' checked':''}> ${y}</label>`).join('');

    // Quarters
    var qtrs = [...new Set(raw.map(r => r.Quarter).filter(Boolean))].sort();
    var qPanel = document.getElementById('etaQtrPanel');
    if (qPanel) qPanel.innerHTML = qtrs.map(q => `<label class="eta-chk"><input type="checkbox" value="${q}" onchange="etaMultiChange('quarters',this)"${ETA_STATE.filters.quarters.includes(q)?' checked':''}> ${q}</label>`).join('');

    // Months — keep order
    var monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var months = [...new Set(raw.map(r => r.Month).filter(Boolean))].sort((a, b) => {
        var [ma, ya] = a.split('-');
        var [mb, yb] = b.split('-');
        return (parseInt(ya) - parseInt(yb)) || monthOrder.indexOf(ma) - monthOrder.indexOf(mb);
    });
    var mPanel = document.getElementById('etaMonthPanel');
    if (mPanel) mPanel.innerHTML = months.map(m => `<label class="eta-chk"><input type="checkbox" value="${m}" onchange="etaMultiChange('months',this)"${ETA_STATE.filters.months.includes(m)?' checked':''}> ${m}</label>`).join('');

    // Weeks
    var weeks = [...new Set(raw.map(r => r.Week).filter(Boolean))].sort();
    var wPanel = document.getElementById('etaWeekPanel');
    if (wPanel) wPanel.innerHTML = weeks.map(w => `<label class="eta-chk"><input type="checkbox" value="${w}" onchange="etaMultiChange('weeks',this)"${ETA_STATE.filters.weeks.includes(w)?' checked':''}> ${w}</label>`).join('');

    // Teams
    var teams = [...new Set(raw.map(r => r.TEAM).filter(Boolean))].sort();
    var tSel = document.getElementById('etaTeamFilter');
    if (!tSel) return;
    var curT = tSel.value;
    tSel.innerHTML = '<option value="">All Teams</option>' + teams.map(t => `<option value="${t}">${t}</option>`).join('');
    if (teams.includes(curT)) tSel.value = curT;
}

// ── ACCOUNT DROPDOWN ──────────────────────────────────────────
window.etaShowAccDD = function() {
    etaBuildAccList();
    var d = document.getElementById('etaAccDDBox');
    if (d) d.style.display = 'block';
};
window.etaHideAccDD = function() {
    var d = document.getElementById('etaAccDDBox');
    if (d) d.style.display = 'none';
};
window.etaFilterAccDD = function() {
    var q = (document.getElementById('etaAccSearch').value || '').toLowerCase();
    var fl = (ETA_STATE._accList || []).filter(a => a.code.includes(q) || a.name.toLowerCase().includes(q));
    var d = document.getElementById('etaAccDDBox');
    if (!d) return;
    d.style.display = 'block';
    d.innerHTML = etaAccDDHtml(fl);
};

function etaBuildAccList() {
    var raw = etaApplyBaseFilters(etaGetCurrentRaw());
    var af = ETA_STATE.activeTab === 'activities' ? 'ACCOUNT_CODE' : 'ACCOUNT_NUMBER';
    var seen = new Set();
    var list = [];
    raw.forEach(r => {
        var c = r[af] || r.ACCOUNT_CODE;
        if (c && !seen.has(c)) {
            seen.add(c);
            list.push({
                code: c,
                name: r.COMPANY_NAME || ''
            });
        }
    });
    ETA_STATE._accList = list;
    var d = document.getElementById('etaAccDDBox');
    if (d) d.innerHTML = etaAccDDHtml(list);
}

function etaAccDDHtml(list) {
    return '<div style="padding:.35rem .75rem;cursor:pointer;font-size:.82rem;color:var(--t3);" onmousedown="etaSelectAcc(\'\',\'\')">All Accounts</div>' +
        list.slice(0, 60).map(a => `<div style="padding:.4rem .75rem;cursor:pointer;font-size:.82rem;color:var(--t1);border-top:1px solid var(--border);" onmousedown="etaSelectAcc('${a.code}','${a.name.replace(/'/g,'\\\'')}')">${a.code} — ${a.name}</div>`).join('');
}
window.etaSelectAcc = function(code, name) {
    ETA_STATE.filters.account = code;
    var inp = document.getElementById('etaAccSearch');
    if (inp) inp.value = code ? (code + ' — ' + name) : '';
    var d = document.getElementById('etaAccDDBox');
    if (d) d.style.display = 'none';
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    etaRender();
};

// ── MAIN RENDER ───────────────────────────────────────────────
function etaRender() {
    var baseData = etaApplyBaseFilters(etaGetCurrentRaw());
    var filtered = etaGetFiltered();
    var cnt = document.getElementById('etaRecordCount');
    if (cnt) cnt.textContent = filtered.length + ' records';
    etaUpdateCrumbs();
    etaRenderKPIs(filtered);
    etaRenderLMSection(baseData);
    etaRenderSMSection(baseData);
    // Charts section: only render when visible
    var chartSec = document.getElementById('etaChartsSection');
    if (chartSec) chartSec.style.display = ETA_STATE.chartsVisible ? 'block' : 'none';
    if (ETA_STATE.chartsVisible && !ETA_STATE._noTTMode && !ETA_STATE._unmatchedMode) etaRenderCharts(filtered);
    if ((ETA_STATE._noTTMode || ETA_STATE._unmatchedMode) && ETA_STATE.chartsVisible) {
        var chartSec = document.getElementById('etaChartsSection');
        if (chartSec) chartSec.innerHTML = '<div style="padding:2rem;color:var(--t3);font-size:.85rem;text-align:center;">Charts not available in this view. Exit to return to normal mode.</div>';
    } // Update toggle button label
    var toggleBtn = document.getElementById('etaChartsToggleBtn');
    if (toggleBtn) {
        toggleBtn.className = ETA_STATE.chartsVisible ? 'eta-tab eta-tab-active' : 'eta-tab';
        toggleBtn.innerHTML = `<i data-lucide="${ETA_STATE.chartsVisible?'eye-off':'bar-chart-2'}" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>${ETA_STATE.chartsVisible?'Hide Charts':'Show Charts'}`;
    }
    etaRenderGrid(filtered);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.etaToggleCharts = function() {
    ETA_STATE.chartsVisible = !ETA_STATE.chartsVisible;
    etaRender();
    if (ETA_STATE.chartsVisible) {
        setTimeout(function() {
            var el = document.getElementById('etaChartsSection');
            if (el) el.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }
};

function etaUpdateCrumbs() {
    var el = document.getElementById('etaActiveCrumbs');
    if (!el) return;
    var html = '';
    if (ETA_STATE.selectedLM) html += `<span class="eta-crumb" onclick="etaClearLM()"><i data-lucide="x" style="width:11px;height:11px;"></i> LM: ${ETA_STATE.selectedLM}</span>`;
    if (ETA_STATE.selectedSM) html += `<span class="eta-crumb" onclick="etaSelectSM('${ETA_STATE.selectedSM}')"><i data-lucide="x" style="width:11px;height:11px;"></i> SM: ${ETA_STATE.selectedSM}</span>`;
    el.innerHTML = html;
}

// ── KPI TILES ─────────────────────────────────────────────────
function etaRenderKPIs(data) {
    var el = document.getElementById('etaKpiTiles');
    if (!el) return;
    if (!ETA_STATE.allData) {
        el.innerHTML = '<div style="padding:2rem;color:var(--t3);font-size:.85rem;grid-column:1/-1;">Loading data...</div>';
        return;
    }
    var t = data.length;
    var html = '';

 if (ETA_STATE.activeTab === 'events') {
        var noEvt = (ETA_STATE.allData.noEventsAccounts || []).length;
        var unmEvt = (ETA_STATE.allData.unmatchedEvents || []).length;

        // Count each distinct status
        var statusMap = {};
        data.forEach(function(r) { var s = r.STATUS || 'Unknown'; statusMap[s] = (statusMap[s] || 0) + 1; });
        var statusEntries = Object.entries(statusMap).sort(function(a,b){ return b[1]-a[1]; });

        var rep = data.filter(r => r.REPEATED_AGEING > 0).length;
        var ntrip = data.filter(r => r.IF_NEW_TRIPLET === 'Yes').length;
        var sig = data.filter(r => r.SIGNATURE_ACCOUNT === 'Yes').length;

        html = `
<div class="eta-kpi eta-kpi-clickable" onclick="etaShowNoEventModal()" style="border-color:rgba(245,158,11,.4);">
  <div class="eta-kpi-label">Accounts — No Events</div>
  <div class="eta-kpi-value eta-w">${noEvt}</div>
  <div class="eta-kpi-sub">${(ETA_STATE.allData.noEventsAccounts||[]).filter(a=>a.IS_PARENT).length} parent · ${(ETA_STATE.allData.noEventsAccounts||[]).filter(a=>!a.IS_PARENT).length} child</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaShowUnmatchedEventModal()" style="border-color:rgba(239,68,68,.4);">
  <div class="eta-kpi-label">Unmatched Events</div>
  <div class="eta-kpi-value eta-d">${unmEvt}</div>
  <div class="eta-kpi-sub">not in master list</div>
</div>
<div class="eta-kpi"><div class="eta-kpi-label">Total Records</div><div class="eta-kpi-value">${t}</div><div class="eta-kpi-sub">all events</div></div>
${statusEntries.map(function(e){ return '<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter(\'STATUS\',\'' + e[0] + '\')"><div class="eta-kpi-label">' + e[0] + '</div><div class="eta-kpi-value">' + e[1] + '</div><div class="eta-kpi-sub">' + (t>0?((e[1]/t)*100).toFixed(1):0) + '%</div></div>'; }).join('')}
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('REPEATED_AGEING_FLAG','rep')">
  <div class="eta-kpi-label">Repeated Cases</div><div class="eta-kpi-value eta-d">${rep}</div><div class="eta-kpi-sub">${t>0?((rep/t)*100).toFixed(1):0}%</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('IF_NEW_TRIPLET','Yes')">
  <div class="eta-kpi-label">New Triplet</div><div class="eta-kpi-value">${ntrip}</div><div class="eta-kpi-sub">${t>0?((ntrip/t)*100).toFixed(1):0}%</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('SIGNATURE_ACCOUNT','Yes')">
  <div class="eta-kpi-label">Signature Accs</div><div class="eta-kpi-value eta-a">${sig}</div><div class="eta-kpi-sub">VIP accounts</div>
</div>`;
    }
    else if (ETA_STATE.activeTab === 'tt') {
        // ── PATCHED TT KPIs ───────────────────────────────────
        var open = data.filter(r => etaGetTTOpenClosed(r) === 'open').length;
        var closed = data.filter(r => etaGetTTOpenClosed(r) === 'closed').length;
        var rejected = data.filter(r => etaGetTTOpenClosed(r) === 'rejected').length;
        // SLA: RESOLUTION === 'BREACHED'
        var sla = data.filter(r => r.SLA === 'Breached').length; // Repeated
        var rep = data.filter(r => r.REPEATED === 'Yes').length;
        // FCR: FIRST_CONTACT=Yes AND closed/resolved
        var fcr = data.filter(r => r.FIRST_CONTACT === 'Within 12 Hour').length;
        var fcrAfter = data.filter(r => r.FIRST_CONTACT === 'After 12 Hour').length;
        var fcrP = (fcr + fcrAfter) > 0 ? ((fcr / (fcr + fcrAfter)) * 100).toFixed(1) : 0;
        // Mishandled: SUB_STATUS contains reassign/return/wrong
        var mis = data.filter(r => r.MISHANDLED === 'Yes').length;
        // Ever Reopened: SUB_STATUS === 'Reopened'
        var avgAge = t > 0 ? (data.reduce((s, r) => s + (parseFloat(r.AGEING_QUEUE_RAW) || 0), 0) / t).toFixed(1) : 0;

        var noTT = (ETA_STATE.allData.noTTAccounts || []).length;
        var unmatched = (ETA_STATE.allData.unmatchedTTs || []).length;

        html = `
<div class="eta-kpi eta-kpi-clickable" onclick="etaShowNoTTModal()" title="Accounts with no TTs raised" style="border-color:rgba(245,158,11,.4);">
  <div class="eta-kpi-label">Accounts — No TTs</div>
  <div class="eta-kpi-value eta-w">${noTT}</div>
  <div class="eta-kpi-sub">${(ETA_STATE.allData.noTTAccounts||[]).filter(a=>a.IS_PARENT).length} parent · ${(ETA_STATE.allData.noTTAccounts||[]).filter(a=>!a.IS_PARENT).length} child</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaShowUnmatchedModal()" title="TTs with no account in master list" style="border-color:rgba(239,68,68,.4);">
  <div class="eta-kpi-label">Unmatched TTs</div>
  <div class="eta-kpi-value eta-d">${unmatched}</div>
  <div class="eta-kpi-sub">not in master list</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('TT_STATUS','Assigned,In Queue,Pending For Closure,Pending,Canceled,Closed,Rejected,Rejected Completed,Resolved')" title="Filter: All">
  <div class="eta-kpi-label">Total TTs</div><div class="eta-kpi-value">${t}</div><div class="eta-kpi-sub">all tickets</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('TT_STATUS','Assigned,In Queue,Pending For Closure,Pending')" title="Filter: Open/Active">
<div class="eta-kpi-label">Open / Active</div><div class="eta-kpi-value eta-w">${open}</div><div class="eta-kpi-sub">Assigned · In Queue · Pending · Pending For Closure</div></div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('TT_STATUS','Rejected,Rejected Completed')" title="Filter: Rejected">
<div class="eta-kpi-label">Rejected</div><div class="eta-kpi-value eta-d">${rejected}</div><div class="eta-kpi-sub">Rejected · Rejected Completed</div></div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('TT_STATUS','Canceled,Closed,Resolved')" title="Filter: Closed/Resolved">
<div class="eta-kpi-label">Closed / Resolved</div><div class="eta-kpi-value eta-s">${closed}</div><div class="eta-kpi-sub">Closed · Resolved · Canceled</div></div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('RESOLUTION','BREACHED')" title="Filter: SLA Breached">
  <div class="eta-kpi-label">SLA Breached</div><div class="eta-kpi-value eta-d">${sla}</div><div class="eta-kpi-sub">${t>0?((sla/t)*100).toFixed(1):0}%</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('REPEATED','Yes')" title="Filter: Repeated">
  <div class="eta-kpi-label">Repeated TTs</div><div class="eta-kpi-value eta-w">${rep}</div><div class="eta-kpi-sub">${t>0?((rep/t)*100).toFixed(1):0}%</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('FIRST_CONTACT','Within 12 Hour')" title="Filter: FCR Within 12 Hour">
  <div class="eta-kpi-label">FCR Rate</div><div class="eta-kpi-value ${fcrP>=50?'eta-s':'eta-w'}">${fcrP}%</div><div class="eta-kpi-sub">${fcr} within 12h</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('MISHANDLED','Yes')" title="Filter: Mishandled">
  <div class="eta-kpi-label">Mishandled</div><div class="eta-kpi-value eta-d">${mis}</div><div class="eta-kpi-sub">${t>0?((mis/t)*100).toFixed(1):0}%</div>
</div>

<div class="eta-kpi" title="Average ageing in hours">
  <div class="eta-kpi-label">Avg Ageing (hrs)</div><div class="eta-kpi-value ${avgAge>72?'eta-d':avgAge>24?'eta-w':'eta-s'}">${avgAge}</div><div class="eta-kpi-sub">mean hours</div>
</div>`;

} else {
        var actOpenStatuses = ['Assigned', 'Unassigned', 'In Progress', 'Open'];
        var actClosedStatuses = ['Done', 'Cancelled', 'Rejected'];
        var open = data.filter(r => actOpenStatuses.includes(r.ACTIVITY_STATUS)).length;
        var closed = data.filter(r => actClosedStatuses.includes(r.ACTIVITY_STATUS)).length;
        var done = data.filter(r => r.ACTIVITY_STATUS === 'Done').length;
        var canc = data.filter(r => r.ACTIVITY_STATUS === 'Cancelled').length;
        var rej = data.filter(r => r.ACTIVITY_STATUS === 'Rejected').length;
        var assigned = data.filter(r => r.ACTIVITY_STATUS === 'Assigned').length;
        var unassigned = data.filter(r => r.ACTIVITY_STATUS === 'Unassigned').length;

        // Parse ageing: "003-Days" → 3
        function parseAgeing(v) { return parseInt((v || '0').toString().split('-')[0]) || 0; }
        var avgAge = t > 0 ? (data.reduce((s, r) => s + parseAgeing(r.AGEING_ACTIVITY), 0) / t).toFixed(1) : 0;

        var noAct = (ETA_STATE.allData.noActivityAccounts || []).length;
        var unmatchedAct = (ETA_STATE.allData.unmatchedActivities || []).length;

        html = `
<div class="eta-kpi eta-kpi-clickable" onclick="etaShowNoActivityModal()" style="border-color:rgba(245,158,11,.4);">
  <div class="eta-kpi-label">Accounts — No Activities</div>
  <div class="eta-kpi-value eta-w">${noAct}</div>
  <div class="eta-kpi-sub">${(ETA_STATE.allData.noActivityAccounts||[]).filter(a=>a.IS_PARENT).length} parent · ${(ETA_STATE.allData.noActivityAccounts||[]).filter(a=>!a.IS_PARENT).length} child</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaShowUnmatchedActivityModal()" style="border-color:rgba(239,68,68,.4);">
  <div class="eta-kpi-label">Unmatched Activities</div>
  <div class="eta-kpi-value eta-d">${unmatchedAct}</div>
  <div class="eta-kpi-sub">not in master list</div>
</div>
<div class="eta-kpi"><div class="eta-kpi-label">Total Activities</div><div class="eta-kpi-value">${t}</div><div class="eta-kpi-sub">all activities</div></div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('ACTIVITY_STATUS','Assigned,Unassigned,In Progress,Open')">
  <div class="eta-kpi-label">Open / Active</div><div class="eta-kpi-value eta-w">${open}</div>
  <div class="eta-kpi-sub">Assigned · Unassigned · In Progress · Open</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('ACTIVITY_STATUS','Done,Cancelled,Rejected')">
  <div class="eta-kpi-label">Closed</div><div class="eta-kpi-value eta-s">${closed}</div>
  <div class="eta-kpi-sub">Done · Cancelled · Rejected</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('ACTIVITY_STATUS','Done')">
  <div class="eta-kpi-label">Done</div><div class="eta-kpi-value eta-s">${done}</div>
  <div class="eta-kpi-sub">${t>0?((done/t)*100).toFixed(1):0}%</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('ACTIVITY_STATUS','Assigned')">
  <div class="eta-kpi-label">Assigned</div><div class="eta-kpi-value eta-a">${assigned}</div>
  <div class="eta-kpi-sub">pending action</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('ACTIVITY_STATUS','Unassigned')">
  <div class="eta-kpi-label">Unassigned</div><div class="eta-kpi-value eta-d">${unassigned}</div>
  <div class="eta-kpi-sub">no owner</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('ACTIVITY_STATUS','Cancelled')">
  <div class="eta-kpi-label">Cancelled</div><div class="eta-kpi-value eta-d">${canc}</div>
  <div class="eta-kpi-sub">${t>0?((canc/t)*100).toFixed(1):0}%</div>
</div>
<div class="eta-kpi eta-kpi-clickable" onclick="etaKpiFilter('ACTIVITY_STATUS','Rejected')">
  <div class="eta-kpi-label">Rejected</div><div class="eta-kpi-value eta-d">${rej}</div>
  <div class="eta-kpi-sub">${t>0?((rej/t)*100).toFixed(1):0}%</div>
</div>
<div class="eta-kpi">
  <div class="eta-kpi-label">Avg Ageing (days)</div>
  <div class="eta-kpi-value ${avgAge>5?'eta-d':avgAge>2?'eta-w':'eta-s'}">${avgAge}</div>
  <div class="eta-kpi-sub">mean days</div>
</div>`;
    }
    el.innerHTML = html;
}
window.etaShowNoTTModal = function() {
    // Always restore real data first before switching modes
    if (ETA_STATE._savedTTs) {
        ETA_STATE.allData.tts = ETA_STATE._savedTTs;
        ETA_STATE._savedTTs = null;
    }

    ETA_STATE._noTTMode = true;
    ETA_STATE._unmatchedMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;

    ETA_STATE._savedTTs = ETA_STATE.allData.tts;
    ETA_STATE.allData.tts = (ETA_STATE.allData.noTTAccounts || []).map(function(a) {
        return {
            ACCOUNT_NUMBER: a.ACCOUNT_NUMBER,
            COMPANY_NAME: a.COMPANY_NAME,
            LM: a.LM,
            SM: a.SM,
            TEAM: a.TEAM,
            TT_STATUS: 'No TT Raised',
            TYPE: '',
            TICKET_NUMBER: '',
            OPEN_TIME: '',
            SLA: '',
            REPEATED: 'No',
            FIRST_CONTACT: 'No',
            MISHANDLED: 'No',
            SUB_STATUS: '',
            AGEING_QUEUE_RAW: 0,
            Week: '',
            Month: '',
            Year: '',
            Quarter: ''
        };
    });

    // Remove old banner and create fresh one
    var old = document.getElementById('etaNoTTBanner');
    if (old) old.remove();

    var banner = document.createElement('div');
    banner.id = 'etaNoTTBanner';
    banner.style.cssText = 'background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:10px;padding:.65rem 1rem;margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;font-size:.82rem;font-weight:600;color:#f59e0b;';
    banner.innerHTML = `<span>⚠️ Showing accounts with NO TTs raised — drill into LM/SM tiles to see who owns them</span>
    <button onclick="etaExitSpecialMode()" style="background:rgba(245,158,11,.2);border:1px solid rgba(245,158,11,.4);border-radius:7px;padding:.25rem .75rem;cursor:pointer;color:#f59e0b;font-size:.78rem;font-weight:700;">✕ Exit</button>`;
    var kpi = document.getElementById('etaKpiTiles');
    if (kpi) kpi.parentNode.insertBefore(banner, kpi.nextSibling);

    etaRender();
};
window.etaShowUnmatchedModal = function() {
    // Always restore real data first before switching modes
    if (ETA_STATE._savedTTs) {
        ETA_STATE.allData.tts = ETA_STATE._savedTTs;
        ETA_STATE._savedTTs = null;
    }

    ETA_STATE._unmatchedMode = true;
    ETA_STATE._noTTMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;

    ETA_STATE._savedTTs = ETA_STATE.allData.tts;
    ETA_STATE.allData.tts = ETA_STATE.allData.unmatchedTTs || [];

    // Remove old banner and create fresh one
    var old = document.getElementById('etaNoTTBanner');
    if (old) old.remove();

    var banner = document.createElement('div');
    banner.id = 'etaNoTTBanner';
    banner.style.cssText = 'background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.4);border-radius:10px;padding:.65rem 1rem;margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;font-size:.82rem;font-weight:600;color:#ef4444;';
    banner.innerHTML = `<span>⚠️ Showing Unmatched TTs — tickets with no matching account in master list</span>
    <button onclick="etaExitSpecialMode()" style="background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.4);border-radius:7px;padding:.25rem .75rem;cursor:pointer;color:#ef4444;font-size:.78rem;font-weight:700;">✕ Exit</button>`;
    var kpi = document.getElementById('etaKpiTiles');
    if (kpi) kpi.parentNode.insertBefore(banner, kpi.nextSibling);

    etaRender();
};
window.etaExitSpecialMode = function() {
    // Use saved TTs if available, otherwise fall back to original backup
    if (ETA_STATE._savedTTs) {
        ETA_STATE.allData.tts = ETA_STATE._savedTTs;
        ETA_STATE._savedTTs = null;
    } else if (ETA_STATE._originalTTs) {
        ETA_STATE.allData.tts = ETA_STATE._originalTTs;
    }
    ETA_STATE._noTTMode = false;
    ETA_STATE._unmatchedMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    var banner = document.getElementById('etaNoTTBanner');
    if (banner) banner.remove();
    etaRender();
}; 
window.etaShowNoEventModal = function() {
    if (ETA_STATE._savedEvents) {
        ETA_STATE.allData.events = ETA_STATE._savedEvents;
        ETA_STATE._savedEvents = null;
    }
    ETA_STATE._noEventMode = true;
    ETA_STATE._unmatchedEventMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    ETA_STATE._savedEvents = ETA_STATE.allData.events;
    ETA_STATE.allData.events = (ETA_STATE.allData.noEventsAccounts || []).map(function(a) {
        return {
            ACCOUNT_NUMBER: a.ACCOUNT_NUMBER,
            COMPANY_NAME: a.COMPANY_NAME,
            LM: a.LM,
            SM: a.SM,
            TEAM: a.TEAM,
            STATUS: 'No Event Raised',
            TYPE: '', AREA: '', SUB_AREA: '', COMMUNICATION_MODE: '',
            REPEATED_AGEING: 0, SIGNATURE_ACCOUNT: '', IF_NEW_TRIPLET: '',
            Week: '', Month: '', Year: '', Quarter: ''
        };
    });
    var old = document.getElementById('etaNoTTBanner');
    if (old) old.remove();
    var banner = document.createElement('div');
    banner.id = 'etaNoTTBanner';
    banner.style.cssText = 'background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:10px;padding:.65rem 1rem;margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;font-size:.82rem;font-weight:600;color:#f59e0b;';
    banner.innerHTML = `<span>⚠️ Showing accounts with NO Events raised</span>
    <button onclick="etaExitEventSpecialMode()" style="background:rgba(245,158,11,.2);border:1px solid rgba(245,158,11,.4);border-radius:7px;padding:.25rem .75rem;cursor:pointer;color:#f59e0b;font-size:.78rem;font-weight:700;">✕ Exit</button>`;
    var kpi = document.getElementById('etaKpiTiles');
    if (kpi) kpi.parentNode.insertBefore(banner, kpi.nextSibling);
    etaRender();
};

window.etaShowUnmatchedEventModal = function() {
    if (ETA_STATE._savedEvents) {
        ETA_STATE.allData.events = ETA_STATE._savedEvents;
        ETA_STATE._savedEvents = null;
    }
    ETA_STATE._unmatchedEventMode = true;
    ETA_STATE._noEventMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    ETA_STATE._savedEvents = ETA_STATE.allData.events;
    ETA_STATE.allData.events = ETA_STATE.allData.unmatchedEvents || [];
    var old = document.getElementById('etaNoTTBanner');
    if (old) old.remove();
    var banner = document.createElement('div');
    banner.id = 'etaNoTTBanner';
    banner.style.cssText = 'background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.4);border-radius:10px;padding:.65rem 1rem;margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;font-size:.82rem;font-weight:600;color:#ef4444;';
    banner.innerHTML = `<span>⚠️ Showing Unmatched Events — no matching account in master list</span>
    <button onclick="etaExitEventSpecialMode()" style="background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.4);border-radius:7px;padding:.25rem .75rem;cursor:pointer;color:#ef4444;font-size:.78rem;font-weight:700;">✕ Exit</button>`;
    var kpi = document.getElementById('etaKpiTiles');
    if (kpi) kpi.parentNode.insertBefore(banner, kpi.nextSibling);
    etaRender();
};

window.etaExitEventSpecialMode = function() {
    if (ETA_STATE._savedEvents) {
        ETA_STATE.allData.events = ETA_STATE._savedEvents;
        ETA_STATE._savedEvents = null;
    } else if (ETA_STATE._originalEvents) {
        ETA_STATE.allData.events = ETA_STATE._originalEvents;
    }
    ETA_STATE._noEventMode = false;
    ETA_STATE._unmatchedEventMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    var banner = document.getElementById('etaNoTTBanner');
    if (banner) banner.remove();
    etaRender();
};
window.etaShowNoActivityModal = function() {
    if (ETA_STATE._savedActivities) {
        ETA_STATE.allData.activities = ETA_STATE._savedActivities;
        ETA_STATE._savedActivities = null;
    }
    ETA_STATE._noActivityMode = true;
    ETA_STATE._unmatchedActivityMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    ETA_STATE._savedActivities = ETA_STATE.allData.activities;
    ETA_STATE.allData.activities = (ETA_STATE.allData.noActivityAccounts || []).map(function(a) {
        return {
            ACCOUNT_CODE: a.ACCOUNT_CODE,
            COMPANY_NAME: a.COMPANY_NAME,
            LM: a.LM,
            SM: a.SM,
            TEAM: a.TEAM,
            ACTIVITY_STATUS: 'No Activity',
            ACTIVITY_ID: '',
            ACTIVITY_CREATION: '',
            ACTIVITY_CLOSE_DT: '',
            AGEING_ACTIVITY: '000-Days',
            ACTIVITY_TYPE: '',
            COMMENTS: '',
            ACTIVITY_CREATED_BY: '',
            OPTY_CD: '',
            OPTY_AREA: '',
            Week: '', Month: '', Year: '', Quarter: ''
        };
    });
    var old = document.getElementById('etaNoTTBanner');
    if (old) old.remove();
    var banner = document.createElement('div');
    banner.id = 'etaNoTTBanner';
    banner.style.cssText = 'background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:10px;padding:.65rem 1rem;margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;font-size:.82rem;font-weight:600;color:#f59e0b;';
    banner.innerHTML = `<span>⚠️ Showing accounts with NO Activities raised</span>
    <button onclick="etaExitActivitySpecialMode()" style="background:rgba(245,158,11,.2);border:1px solid rgba(245,158,11,.4);border-radius:7px;padding:.25rem .75rem;cursor:pointer;color:#f59e0b;font-size:.78rem;font-weight:700;">✕ Exit</button>`;
    var kpi = document.getElementById('etaKpiTiles');
    if (kpi) kpi.parentNode.insertBefore(banner, kpi.nextSibling);
    etaRender();
};

window.etaShowUnmatchedActivityModal = function() {
    if (ETA_STATE._savedActivities) {
        ETA_STATE.allData.activities = ETA_STATE._savedActivities;
        ETA_STATE._savedActivities = null;
    }
    ETA_STATE._unmatchedActivityMode = true;
    ETA_STATE._noActivityMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    ETA_STATE._savedActivities = ETA_STATE.allData.activities;
    ETA_STATE.allData.activities = ETA_STATE.allData.unmatchedActivities || [];
    var old = document.getElementById('etaNoTTBanner');
    if (old) old.remove();
    var banner = document.createElement('div');
    banner.id = 'etaNoTTBanner';
    banner.style.cssText = 'background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.4);border-radius:10px;padding:.65rem 1rem;margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;font-size:.82rem;font-weight:600;color:#ef4444;';
    banner.innerHTML = `<span>⚠️ Showing Unmatched Activities — no matching account in master list</span>
    <button onclick="etaExitActivitySpecialMode()" style="background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.4);border-radius:7px;padding:.25rem .75rem;cursor:pointer;color:#ef4444;font-size:.78rem;font-weight:700;">✕ Exit</button>`;
    var kpi = document.getElementById('etaKpiTiles');
    if (kpi) kpi.parentNode.insertBefore(banner, kpi.nextSibling);
    etaRender();
};

window.etaExitActivitySpecialMode = function() {
    if (ETA_STATE._savedActivities) {
        ETA_STATE.allData.activities = ETA_STATE._savedActivities;
        ETA_STATE._savedActivities = null;
    } else if (ETA_STATE._originalActivities) {
        ETA_STATE.allData.activities = ETA_STATE._originalActivities;
    }
    ETA_STATE._noActivityMode = false;
    ETA_STATE._unmatchedActivityMode = false;
    ETA_STATE.selectedLM = null;
    ETA_STATE.selectedSM = null;
    var banner = document.getElementById('etaNoTTBanner');
    if (banner) banner.remove();
    etaRender();
};
// ── LM SECTION ────────────────────────────────────────────────
function etaRenderLMSection(baseData) {
    var grid = document.getElementById('etaLMGrid');
    var titleEl = document.getElementById('etaLMTitle');
    var backEl = document.getElementById('etaLMBack');
    if (!grid) return;

    var role = window.USER_CONTEXT.role;
    var userName = window.USER_CONTEXT.userName;

    // SM — show only their own tile, no LM grid
    if (role === 'Service Manager') {
        if (titleEl) titleEl.textContent = 'My Performance';
        if (backEl) backEl.style.display = 'none';
        var d = baseData.filter(function(r){ return r.SM === userName; });
        var k = etaMgrKPIs(d);
        grid.innerHTML = etaLMTileHtml(userName, d.length, '100', k, true, '');
        return;
    }

    // LM — auto-select themselves so SM tiles show immediately
    if (role === 'Line Manager' && !ETA_STATE.selectedLM) {
        ETA_STATE.selectedLM = userName;
    }

    if (ETA_STATE.selectedLM) {
        // ── Show ONLY the selected LM tile (highlighted), then SM tiles below ──
        if (titleEl) titleEl.textContent = 'Line Manager Performance';
        if (backEl) backEl.style.display = 'inline-flex';

        var total = baseData.length;

        // Build all LM tiles but only render the selected one
        var lms = [...new Set(baseData.map(r => r.LM).filter(Boolean))];

        // Selected LM tile
        var selectedTileHtml = lms.filter(lm => lm === ETA_STATE.selectedLM).map(lm => {
            var d = baseData.filter(r => r.LM === lm);
            var cShare = total > 0 ? ((d.length / total) * 100).toFixed(1) : 0;
            return etaLMTileHtml(lm, d.length, cShare, etaMgrKPIs(d), true, `etaSelectLM('${lm}')`);
        }).join('');

        // SM tiles for this LM
        var lmData = baseData.filter(r => r.LM === ETA_STATE.selectedLM);
        var lmTotal = lmData.length;
        var sms = [...new Set(lmData.map(r => r.SM).filter(Boolean))];
        var smTilesHtml = sms.map(sm => {
            var d = lmData.filter(r => r.SM === sm);
            var cShare = lmTotal > 0 ? ((d.length / lmTotal) * 100).toFixed(1) : 0;
            return etaLMTileHtml(sm, d.length, cShare, etaMgrKPIs(d), ETA_STATE.selectedSM === sm, `etaSelectSM('${sm}')`);
        }).join('');

        grid.innerHTML = `
            <div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.85rem;">
                ${selectedTileHtml}
            </div>`;

    } else {
        // ── Show ALL LM tiles ──
        if (titleEl) titleEl.textContent = 'Line Manager Performance';
        if (backEl) backEl.style.display = 'none';
        var total = baseData.length;
        var lms = [...new Set(baseData.map(r => r.LM).filter(Boolean))];
        grid.innerHTML = lms.map(lm => {
            var d = baseData.filter(r => r.LM === lm);
            var cShare = total > 0 ? ((d.length / total) * 100).toFixed(1) : 0;
            return etaLMTileHtml(lm, d.length, cShare, etaMgrKPIs(d), ETA_STATE.selectedLM === lm, `etaSelectLM('${lm}')`);
        }).join('');
    }
}

function etaMgrKPIs(d) {
    var t = d.length;
   if (ETA_STATE.activeTab === 'events') {
        var statusMap = {};
        d.forEach(function(r) { var s = r.STATUS || 'Unknown'; statusMap[s] = (statusMap[s] || 0) + 1; });
        var topStatuses = Object.entries(statusMap).sort(function(a,b){ return b[1]-a[1]; }).slice(0,2);
        var rep = d.filter(r => r.REPEATED_AGEING > 0).length;
        var ntrip = d.filter(r => r.IF_NEW_TRIPLET === 'Yes').length;
        var sig = d.filter(r => r.SIGNATURE_ACCOUNT === 'Yes').length;
        return {
            s1l: topStatuses[0] ? topStatuses[0][0] : 'Status 1',
            s1v: topStatuses[0] ? topStatuses[0][1] : 0,
            s2l: topStatuses[1] ? topStatuses[1][0] : 'Status 2',
            s2v: topStatuses[1] ? topStatuses[1][1] : 0,
            m1l: 'Repeated',
            m1v: rep,
            m2l: 'New Triplet',
            m2v: ntrip,
            m3l: 'Signature',
            m3v: sig,
       sl: 'Done Rate',
sv: t > 0 ? (((statusMap['Done'] || 0) / t) * 100).toFixed(0) : 0,
            _evtStatusMap: statusMap
        };
}
    else if (ETA_STATE.activeTab === 'tt') {
        var sla = d.filter(r => r.SLA === 'Breached').length;
        var mis = d.filter(r => r.MISHANDLED === 'Yes').length; // (use 'd' not 'data' inside etaMgrKPIs)
        var fcr = d.filter(r => r.FIRST_CONTACT === 'Within 12 Hour').length;
        var avgAge = t > 0 ? (d.reduce((s, r) => s + (parseFloat(r.AGEING_QUEUE_RAW) || 0), 0) / t).toFixed(1) : 0;
        var cl = d.filter(r => etaGetTTOpenClosed(r) === 'closed').length;
        var op = d.filter(r => etaGetTTOpenClosed(r) === 'open').length;
        var rej = d.filter(r => etaGetTTOpenClosed(r) === 'rejected').length;
        var rep = d.filter(r => r.REPEATED === 'Yes').length;
        var rate = t > 0 ? ((cl / t) * 100).toFixed(0) : 0;
        return {
            s1l: 'Open',
            s1v: op,
            s2l: 'Closed',
            s2v: cl,
            m1l: 'SLA Breach',
            m1v: sla,
            m2l: 'Repeated',
            m2v: rep,
            m3l: 'Avg Age',
            m3v: avgAge + 'h',
            m4l: 'Mishandled',
            m4v: mis,
            m5l: 'Rejected',
            m5v: rej,
            sl: 'Closure Rate',
            sv: rate,
            _open: op,
            _closed: cl,
            _rej: rej,
            _rep: rep
        };
    } else {
        var actOpenSt = ['Assigned', 'Unassigned', 'In Progress', 'Open'];
        var open = d.filter(r => actOpenSt.includes(r.ACTIVITY_STATUS)).length;
        var cl = d.filter(r => r.ACTIVITY_STATUS === 'Done').length;
        var canc = d.filter(r => r.ACTIVITY_STATUS === 'Cancelled').length;
        var rej = d.filter(r => r.ACTIVITY_STATUS === 'Rejected').length;
        function parseAgeing(v) { return parseInt((v || '0').toString().split('-')[0]) || 0; }
        var avgAge = t > 0 ? (d.reduce((s, r) => s + parseAgeing(r.AGEING_ACTIVITY), 0) / t).toFixed(1) : 0;
        var rate = t > 0 ? ((cl / t) * 100).toFixed(0) : 0;
        return {
            s1l: 'Open',
            s1v: open,
            s2l: 'Done',
            s2v: cl,
            m1l: 'Cancelled',
            m1v: canc,
            m2l: 'Rejected',
            m2v: rej,
            m3l: 'Avg Age',
            m3v: avgAge + 'd',
            sl: 'Done Rate',
            sv: rate,
            _open: open,
            _closed: cl,
            _canc: canc,
            _rej: rej
        };
    }
}

function etaLMTileHtml(name, cnt, cShare, k, isSelected, fn) {
    return `<div class="lm-tile${isSelected?' selected':''}" onclick="${fn}">
<h3>${name}</h3>
<div class="lm-meta">Records: ${cnt}</div>
<div class="lm-stats-grid">
  <div class="lm-stat-box"><div class="lm-stat-label">${k.s1l}</div><div class="lm-stat-value">${k.s1v}</div></div>
  <div class="lm-stat-box"><div class="lm-stat-label">${k.s2l}</div><div class="lm-stat-value">${k.s2v}</div></div>
</div>
${ETA_STATE.activeTab === 'tt' ? `
<div class="lm-revenue">
  <div class="lm-revenue-label">TT Summary</div>
  <div class="lm-revenue-breakdown" style="grid-template-columns:1fr 1fr 1fr;gap:.35rem;margin-top:.3rem;">
    <div><div class="lm-revenue-item-label">Open</div><div class="lm-revenue-item-value" style="color:#f59e0b;">${k.s1v}</div></div>
    <div><div class="lm-revenue-item-label">Closed</div><div class="lm-revenue-item-value" style="color:#10b981;">${k.s2v}</div></div>
    <div><div class="lm-revenue-item-label">SLA Breach</div><div class="lm-revenue-item-value" style="color:#ef4444;">${k.m1v}</div></div>
<div><div class="lm-revenue-item-label">Rejected</div><div class="lm-revenue-item-value" style="color:#ef4444;">${k.m5v}</div></div>
    <div><div class="lm-revenue-item-label">Repeated</div><div class="lm-revenue-item-value" style="color:#f59e0b;">${k.m2v}</div></div>
    <div><div class="lm-revenue-item-label">Avg Aging</div><div class="lm-revenue-item-value">${k.m3v}</div></div>
    <div><div class="lm-revenue-item-label">Mishandled</div><div class="lm-revenue-item-value" style="color:#ef4444;">${k.m4v}</div></div>
  </div>
</div>
` : `
<div class="lm-revenue">
  <div class="lm-revenue-label">Performance</div>
  <div class="lm-revenue-count">${k.sv}%</div>
  <div class="lm-revenue-breakdown">
    <div><div class="lm-revenue-item-label">${k.m1l}</div><div class="lm-revenue-item-value">${k.m1v}</div></div>
    <div><div class="lm-revenue-item-label">${k.m2l}</div><div class="lm-revenue-item-value">${k.m2v}</div></div>
    <div><div class="lm-revenue-item-label">${k.m3l}</div><div class="lm-revenue-item-value">${k.m3v}</div></div>
  </div>
</div>
`}
<div class="lm-progress-section">
  <div class="lm-progress-row"><span class="lm-progress-label">Record Share</span><span class="lm-progress-value">${cShare}%</span></div>
  <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(cShare,100)}%"></div></div>
  <div class="lm-progress-row"><span class="lm-progress-label">${k.sl}</span><span class="lm-progress-value">${k.sv}%</span></div>
  <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(k.sv,100)}%"></div></div>
</div>
</div>`;
}
// ── SM SECTION ────────────────────────────────────────────────
function etaRenderSMSection(baseData) {
    var sec = document.getElementById('etaSMSection');
    var list = document.getElementById('etaSMList');
    if (!sec || !list) return;
    if (!ETA_STATE.selectedLM) {
        sec.style.display = 'none';
        return;
    }
    sec.style.display = 'block';
    var lmData = baseData.filter(r => r.LM === ETA_STATE.selectedLM);
    var total = lmData.length;
    var sms = [...new Set(lmData.map(r => r.SM).filter(Boolean))];
    var stats = sms.map(sm => {
        var d = lmData.filter(r => r.SM === sm);
        return {
            name: sm,
            cnt: d.length,
            cShare: total > 0 ? ((d.length / total) * 100).toFixed(1) : 0,
            k: etaMgrKPIs(d)
        };
    }).sort((a, b) => b.cnt - a.cnt);
    list.innerHTML = stats.map((m, i) => {
        var rc = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
        var isSel = ETA_STATE.selectedSM === m.name;
        var statCols = '';
        if (ETA_STATE.activeTab === 'tt') {
            statCols = `
<div class="stat-col"><div class="stat-label">Records</div><div class="stat-value">${m.cnt}</div></div>
<div class="stat-col"><div class="stat-label">Open</div><div class="stat-value eta-w">${m.k._open}</div></div>
<div class="stat-col"><div class="stat-label">Closed</div><div class="stat-value eta-s">${m.k._closed}</div></div>
<div class="stat-col"><div class="stat-label">SLA Breach</div><div class="stat-value eta-d">${m.k.m1v}</div></div>
<div class="stat-col"><div class="stat-label">Repeated</div><div class="stat-value eta-w">${m.k.m2v}</div></div>
<div class="stat-col"><div class="stat-label">Rejected</div><div class="stat-value eta-d">${m.k.m5v}</div></div>
<div class="stat-col"><div class="stat-label">Mishandled</div><div class="stat-value eta-d">${m.k.m4v}</div></div>
<div class="stat-col"><div class="stat-label">Avg Age</div><div class="stat-value">${m.k.m3v}</div></div>
`;
        } else {
            statCols = `
<div class="stat-col"><div class="stat-label">Records</div><div class="stat-value">${m.cnt}</div></div>
<div class="stat-col"><div class="stat-label">${m.k.s1l}</div><div class="stat-value">${m.k.s1v}</div></div>
<div class="stat-col"><div class="stat-label">${m.k.s2l}</div><div class="stat-value">${m.k.s2v}</div></div>
<div class="stat-col"><div class="stat-label">${m.k.m1l}</div><div class="stat-value">${m.k.m1v}</div></div>
<div class="stat-col"><div class="stat-label">${m.k.m2l}</div><div class="stat-value">${m.k.m2v}</div></div>`;
        }
        return `<div class="manager-row${isSel?' selected':''}" onclick="etaSelectSM('${m.name}')">
<div class="rank-badge ${rc}">${i+1}</div>
<div class="manager-name-col"><div class="manager-name">${m.name}</div></div>
${statCols}
</div>`;
    }).join('');
}

// ── CHARTS ────────────────────────────────────────────────────
const ETA_C = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#8b5cf6'];

function etaDestroyCharts() {
    Object.values(ETA_STATE.charts).forEach(c => {
        try {
            c.destroy();
        } catch (e) {}
    });
    ETA_STATE.charts = {};
}

function etaCount(data, f) {
    var m = {};
    data.forEach(r => {
        var v = r[f] || 'Unknown';
        m[v] = (m[v] || 0) + 1;
    });
    return m;
}

function etaTopN(obj, n) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function etaRenderCharts(data) {
    etaDestroyCharts();
    var el = document.getElementById('etaChartsSection');
    if (!el) return;

    var trendTgl = `<span style="margin-left:auto;display:flex;gap:.4rem;">
<button type="button" class="${ETA_STATE.trendMode==='weekly'?'export-btn':'reset-btn'}" style="padding:.25rem .6rem;font-size:.72rem;" onclick="etaSwitchTrend('weekly')">Weekly</button>
<button type="button" class="${ETA_STATE.trendMode==='monthly'?'export-btn':'reset-btn'}" style="padding:.25rem .6rem;font-size:.72rem;" onclick="etaSwitchTrend('monthly')">Monthly</button>
<button type="button" class="${ETA_STATE.trendMode==='yearly'?'export-btn':'reset-btn'}" style="padding:.25rem .6rem;font-size:.72rem;" onclick="etaSwitchTrend('yearly')">Yearly</button></span>`;

    var accTgl = `<span style="margin-left:auto;display:flex;gap:.4rem;">
<button type="button" class="${ETA_STATE.accountLoadMode==='most'?'export-btn':'reset-btn'}" style="padding:.25rem .6rem;font-size:.72rem;" onclick="etaSwitchAccLoad('most')">Most Loaded</button>
<button type="button" class="${ETA_STATE.accountLoadMode==='least'?'export-btn':'reset-btn'}" style="padding:.25rem .6rem;font-size:.72rem;" onclick="etaSwitchAccLoad('least')">Least Loaded</button></span>`;

 if (ETA_STATE.activeTab === 'events') {
        if (!ETA_STATE._evtAccCovMode) ETA_STATE._evtAccCovMode = 'lm';
       var evtAccTgl = `<span style="margin-left:auto;display:flex;gap:.3rem;">
            <button type="button" id="evtAccBtn_most" class="${ETA_STATE.accountLoadMode==='most'?'export-btn':'reset-btn'}" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchAccLoad('most')">Most</button>
            <button type="button" id="evtAccBtn_least" class="${ETA_STATE.accountLoadMode==='least'?'export-btn':'reset-btn'}" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchAccLoad('least')">Least</button>
            <button type="button" id="evtAccBtn_lm" class="${ETA_STATE._evtAccCovMode==='lm'?'export-btn':'reset-btn'}" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchEvtAccCov('lm')">By LM</button>
            <button type="button" id="evtAccBtn_sm" class="${ETA_STATE._evtAccCovMode==='sm'?'export-btn':'reset-btn'}" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchEvtAccCov('sm')">By SM</button>
        </span>`;
        el.innerHTML = `<div class="eta-chart-grid">



<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="activity" style="width:15px;height:15px;"></i> Status Distribution</div>
  <div id="eCStatus" style="height:240px;overflow-y:auto;padding:.5rem 0;"></div>
</div>

<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="phone" style="width:15px;height:15px;"></i> Communication Mode</div>
  <div class="eta-chart-box"><canvas id="eCCommMode"></canvas></div>
</div>

<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title"><i data-lucide="layers" style="width:15px;height:15px;"></i> Top Services</div>
  <div class="eta-chart-box" style="height:280px;"><canvas id="eCService"></canvas></div>
</div>

<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title"><i data-lucide="users" style="width:15px;height:15px;"></i> Customer Segment</div>
  <div class="eta-chart-box" style="height:320px;"><canvas id="eCSegment"></canvas></div>
</div>



<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title" style="flex-wrap:wrap;gap:.4rem;">
    <i data-lucide="building-2" style="width:15px;height:15px;"></i> Account Load / Coverage
    ${evtAccTgl}
  </div>
  <div id="eCAccLoad" style="height:320px;overflow-y:auto;padding:.25rem 0;"></div>
</div>

</div>`;

        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => {
           etaBuildTrend(data, 'eCTrend');
etaBuildTTStatusGauge(data.map(r => Object.assign({}, r, {TT_STATUS: r.STATUS})), 'eCStatus');
etaBuildDonut('eCCommMode', etaCount(data, 'COMMUNICATION_MODE'));
etaBuildBar('eCSegment', etaTopN(etaCount(data, 'CUSTOMER_SEGMENT'), 12));
etaBuildBar('eCService', etaTopN(etaCount(data, 'SERVICE'), 8));
etaBuildEvtAccChart(data, ETA_STATE._evtAccCovMode);
        }, 60);

    } else if (ETA_STATE.activeTab === 'tt') {
        // ── PATCHED TT CHARTS ─────────────────────────────────
        if (!ETA_STATE._ttDim) ETA_STATE._ttDim = 'TYPE';

        el.innerHTML = `<div class="eta-chart-grid">

<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title"><i data-lucide="trending-up" style="width:15px;height:15px;"></i> Volume Trend ${trendTgl}</div>
  <div class="eta-chart-box"><canvas id="eCTrend"></canvas></div>
</div>

<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="activity" style="width:15px;height:15px;"></i> TT Status Distribution</div>
  <div id="eCStatus" style="height:240px;overflow-y:auto;padding:.5rem 0;"></div>
</div>

<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="shield-alert" style="width:15px;height:15px;"></i> SLA: Breached vs OK</div>
  <div id="eCSLA" style="height:240px;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:1.5rem;padding:.5rem;overflow:hidden;"></div>
</div>
<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="repeat" style="width:15px;height:15px;"></i> Repeated Cases by Area</div>
  <div class="eta-chart-box" style="height:260px;"><canvas id="eCRepArea"></canvas></div>
</div>

<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="clock" style="width:15px;height:15px;"></i> Ageing Histogram</div>
  <div id="eCAgeing" style="height:240px;display:flex;align-items:flex-end;gap:6px;padding:.5rem .25rem .25rem;box-sizing:border-box;"></div>
</div>

<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title"><i data-lucide="building-2" style="width:15px;height:15px;"></i> Account Load (Top 10) ${accTgl}</div>
  <div id="eCAccLoad" style="height:300px;overflow-y:auto;padding:.25rem 0;"></div>
</div>
<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title" style="flex-wrap:wrap;gap:.4rem;">
    <i data-lucide="users" style="width:15px;height:15px;"></i> Account Coverage per Manager
    <span style="margin-left:auto;display:flex;gap:.3rem;">
     <button type="button" id="accCovBtn_lm" class="export-btn" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchAccCov('lm')">By LM</button>
      <button type="button" id="accCovBtn_sm" class="reset-btn" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchAccCov('sm')">By SM</button>
      <button type="button" id="accCovBtn_oc" class="reset-btn" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchAccCov('oc')">Open/Closed</button>
    </span>
  </div>
  <div class="eta-chart-box" style="height:320px;"><canvas id="eCAccCov"></canvas></div>
</div>
<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title" style="flex-wrap:wrap;gap:.4rem;">
    <i data-lucide="layout-grid" style="width:15px;height:15px;"></i> Dynamic Breakdown
    <span style="margin-left:auto;display:flex;gap:.3rem;flex-wrap:wrap;" id="etaTTDimBtns">
     ${['TYPE','DRIVER','CUSTOMER_SEGMENT','TICKET_TYPE'].map(d=>
        `<button type="button" id="ttDimBtn_${d}"
          class="${ETA_STATE._ttDim===d?'export-btn':'reset-btn'}"
          style="padding:.22rem .55rem;font-size:.7rem;"
          onclick="etaTTSwitchDim('${d}')">
          ${d === 'DRIVER' ? 'Top Drivers' : d.replace(/_/g,' ')}
        </button>`
      ).join('')}
    </span>
  </div>
<div class="eta-chart-box" style="height:260px;"><canvas id="eCDynDim"></canvas></div></div>

</div>`;

        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => {
            // 1. Volume Trend — stepped area with annotation dots
            etaBuildTTTrend(data, 'eCTrend');
            // 2. TT Status — horizontal gauge bars (not a chart lib)
            etaBuildTTStatusGauge(data, 'eCStatus');
            // 3. SLA — ring + text in center
            etaBuildTTSLARing(data, 'eCSLA');
            // Repeated by Area — polar area chart
            var repMap = {};
            data.filter(r => r.REPEATED === 'Yes').forEach(r => {
                var a = r.AREA || 'Unknown';
                repMap[a] = (repMap[a] || 0) + 1;
            });
            etaBuildTTPolarArea('eCRepArea', etaTopN(repMap, 6));
            // Ageing histogram — custom heat-column bars
            var bucketOrder = ['0-12 hrs', '12-24 hrs', '24-48 hrs', '48-72 hrs', '72+ hrs'];
            var ageEntries = bucketOrder.map(b => [b, data.filter(r => r.AGEING_QUEUE === b).length]).filter(e => e[1] > 0);
            etaBuildTTAgeingColumns('eCAgeing', ageEntries);
            // Account load — lollipop chart
            etaBuildTTLollipop(data, 'eCAccLoad');
            // Dynamic dimension — treemap-style tiles
            etaTTRenderDynDim(data);
            etaBuildAccCoverageChart(data, 'lm');
        }, 60);
    } else {
        el.innerHTML = `<div class="eta-chart-grid">
<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title"><i data-lucide="trending-up" style="width:15px;height:15px;"></i> Volume Trend ${trendTgl}</div>
  <div class="eta-chart-box"><canvas id="eCTrend"></canvas></div>
</div>
<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="activity" style="width:15px;height:15px;"></i> Activity Status</div>
  <div id="eCStatus" style="height:240px;overflow-y:auto;padding:.5rem 0;"></div>
</div>
<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="layers" style="width:15px;height:15px;"></i> Service Category</div>
  <div class="eta-chart-box"><canvas id="eCServiceCat"></canvas></div>
</div>
<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="tag" style="width:15px;height:15px;"></i> Opty Area Breakdown</div>
  <div class="eta-chart-box"><canvas id="eCOptyArea"></canvas></div>
</div>
<div class="eta-chart-card">
  <div class="eta-chart-title"><i data-lucide="clock" style="width:15px;height:15px;"></i> Ageing Distribution</div>
  <div id="eCAgeing" style="height:240px;display:flex;align-items:flex-end;gap:6px;padding:.5rem .25rem .25rem;box-sizing:border-box;"></div>
</div>
<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title"><i data-lucide="building-2" style="width:15px;height:15px;"></i> Account Load (Top 10) ${accTgl}</div>
  <div id="eCAccLoad" style="height:300px;overflow-y:auto;padding:.25rem 0;"></div>
</div>
<div class="eta-chart-card" style="grid-column:span 2;">
  <div class="eta-chart-title" style="flex-wrap:wrap;gap:.4rem;">
    <i data-lucide="users" style="width:15px;height:15px;"></i> Open / Closed per Manager
    <span style="margin-left:auto;display:flex;gap:.3rem;">
      <button type="button" id="actMgrBtn_lm" class="export-btn" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchActMgr('lm')">By LM</button>
      <button type="button" id="actMgrBtn_sm" class="reset-btn" style="padding:.22rem .55rem;font-size:.7rem;" onclick="etaSwitchActMgr('sm')">By SM</button>
    </span>
  </div>
  <div class="eta-chart-box" style="height:300px;"><canvas id="eCActMgr"></canvas></div>
</div>
</div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => {
            etaBuildTrend(data, 'eCTrend');
            // Status gauge bars
            etaBuildTTStatusGauge(data.map(r => Object.assign({}, r, {TT_STATUS: r.ACTIVITY_STATUS})), 'eCStatus');
            // Service category bar
            etaBuildBar('eCServiceCat', etaTopN(etaCount(data, 'OPTY_CD'), 6));
            // Opty area bar
            etaBuildBar('eCOptyArea', etaTopN(etaCount(data, 'OPTY_AREA'), 8));
            // Ageing histogram
            var ageingBuckets = ['000-Days','001-Days','002-Days','003-Days','004-Days','005-Days','006-Days','007-Days'];
            var ageEntries = ageingBuckets.map(b => [b, data.filter(r => r.AGEING_ACTIVITY === b).length]).filter(e => e[1] > 0);
            etaBuildTTAgeingColumns('eCAgeing', ageEntries);
            // Account lollipop
           etaBuildActLollipop(data, 'eCAccLoad');
            etaBuildActMgrChart(data, 'lm');
        }, 60);
    }
}

// ── TT Trend: stepped area with value labels ──────────────────
function etaBuildTTTrend(data, cid) {
    var ctx = document.getElementById(cid);
    if (!ctx) return;
    var labels, counts;
    if (ETA_STATE.trendMode === 'weekly') {
        var m = {};
        data.forEach(r => {
            var w = r.Week || 'Unknown';
            m[w] = (m[w] || 0) + 1;
        });
        labels = ['W1', 'W2', 'W3', 'W4', 'W5'].filter(w => m[w] !== undefined);
        counts = labels.map(w => m[w]);
    } else if (ETA_STATE.trendMode === 'monthly') {
        var m = {};
        data.forEach(r => {
            var mo = r.Month || 'Unknown';
            m[mo] = (m[mo] || 0) + 1;
        });
      var monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        labels = Object.keys(m).sort((a,b) => {
            var [ma,ya] = a.split('-'); var [mb,yb] = b.split('-');
            return (parseInt(ya)-parseInt(yb)) || monthOrder.indexOf(ma)-monthOrder.indexOf(mb);
        });
        counts = labels.map(mo => m[mo]);
    } else {
        var m = {};
        data.forEach(r => {
            var y = r.Year || 'Unknown';
            m[y] = (m[y] || 0) + 1;
        });
        labels = Object.keys(m).sort();
        counts = labels.map(y => m[y]);
    }
    ETA_STATE.charts['trend'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Volume',
                data: counts,
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168,85,247,.18)',
                borderWidth: 3,
                pointRadius: 7,
                pointBackgroundColor: '#a855f7',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                tension: 0,
                fill: true,
                stepped: false,
                segment: {
                    borderColor: (c) => counts[c.p1DataIndex] > counts[c.p0DataIndex] ? '#10b981' : '#ef4444'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
           plugins: {
                legend: { display: false },
                datalabels: { display: true, color: '#8b7aad', font: { weight: 'bold', size: 11 }, anchor: 'end', align: 'top' },
                tooltip: {
                    callbacks: {
                        label: (c) => 'Tickets: ' + c.raw
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        color: 'rgba(168,85,247,.1)'
                    }
                }
            }
        }
    });
}

// ── TT Status: horizontal gauge bars (HTML, not canvas) ───────
function etaBuildTTStatusGauge(data, cid) {
    var el = document.getElementById(cid);
    if (!el) return;
    var total = data.length;
    if (!total) {
        el.innerHTML = '<div style="color:var(--t3);padding:1rem;font-size:.82rem;">No data</div>';
        return;
    }
    var map = etaCount(data, 'TT_STATUS');
    var entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    var statusColors = {
        'Closed': '#10b981',
        'Resolved': '#10b981',
        'Open': '#f59e0b',
        'In Progress': '#3b82f6',
        'Pending': '#a855f7',
        'Pending For Closure': '#a855f7',
        'Escalated': '#ef4444',
        'default': '#8b5cf6'
    };
    el.innerHTML = entries.map(([st, cnt]) => {
        var pct = (cnt / total * 100).toFixed(1);
        var col = statusColors[st] || statusColors['default'];
        return `<div style="margin-bottom:.7rem;padding:0 .25rem;">
  <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:.28rem;">
    <span style="font-weight:700;color:var(--t1);">${st}</span>
    <span style="color:${col};font-weight:800;">${cnt} <span style="color:var(--t3);font-weight:400;">(${pct}%)</span></span>
  </div>
  <div style="height:10px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;position:relative;">
    <div style="height:100%;width:${pct}%;background:${col};border-radius:6px;box-shadow:0 0 8px ${col}88;transition:width .5s cubic-bezier(.4,0,.2,1);"></div>
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent,transparent 4px,rgba(0,0,0,.06) 4px,rgba(0,0,0,.06) 5px);border-radius:6px;"></div>
  </div>
</div>`;
    }).join('');
}

// ── TT SLA: big ring with number inside ───────────────────────
function etaBuildTTSLARing(data, cid) {
    var el = document.getElementById(cid);
    if (!el) return;
    var total = data.length;
    var breached = data.filter(r => r.SLA === 'Breached').length;
    var within = data.filter(r => r.SLA === 'Not Breached').length;
    var na = data.filter(r => !r.SLA || (r.SLA !== 'Breached' && r.SLA !== 'Not Breached')).length;
    var bPct = total > 0 ? ((breached / total) * 100).toFixed(1) : 0;
    var wPct = total > 0 ? ((within / total) * 100).toFixed(1) : 0;
    // SVG donut ring
    var r = 70,
        cx = 90,
        cy = 90,
        strokeW = 18;
    var circ = 2 * Math.PI * r;
    var bAngle = (breached / total) * circ;
    var wAngle = (within / total) * circ;
    var naAngle = circ - bAngle - wAngle;
    el.innerHTML = `
<svg width="160" height="160" viewBox="0 0 180 180" style="flex-shrink:0;"style="overflow:visible;filter:drop-shadow(0 4px 20px rgba(168,85,247,.2));">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-secondary)" stroke-width="${strokeW}"/>
  <!-- N/A -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#6b7280" stroke-width="${strokeW}"
    stroke-dasharray="${naAngle} ${circ}" stroke-dashoffset="${-(bAngle+wAngle)}" stroke-linecap="round"
    transform="rotate(-90 ${cx} ${cy})"/>
  <!-- WITHIN -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#10b981" stroke-width="${strokeW}"
    stroke-dasharray="${wAngle} ${circ}" stroke-dashoffset="${-bAngle}" stroke-linecap="round"
    transform="rotate(-90 ${cx} ${cy})"/>
  <!-- BREACHED -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ef4444" stroke-width="${strokeW}"
    stroke-dasharray="${bAngle} ${circ}" stroke-dashoffset="0" stroke-linecap="round"
    transform="rotate(-90 ${cx} ${cy})"/>
  <text x="${cx}" y="${cy-8}" text-anchor="middle" font-size="24" font-weight="900" fill="#ef4444">${bPct}%</text>
  <text x="${cx}" y="${cy+10}" text-anchor="middle" font-size="11" fill="var(--t3)">BREACHED</text>
  <text x="${cx}" y="${cy+26}" text-anchor="middle" font-size="10" fill="var(--t3)">${breached} of ${total}</text>
</svg>
<div style="display:flex;flex-direction:column;gap:.4rem;justify-content:center;">  <div style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;"><div style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;box-shadow:0 0 6px #ef4444;"></div><span style="color:var(--t1);font-weight:700;">Breached</span><span style="color:#ef4444;font-weight:800;margin-left:auto;">${breached}</span></div>
  <div style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;"><div style="width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0;box-shadow:0 0 6px #10b981;"></div><span style="color:var(--t1);font-weight:700;">Within SLA</span><span style="color:#10b981;font-weight:800;margin-left:auto;">${within}</span></div>
  <div style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;"><div style="width:10px;height:10px;border-radius:50%;background:#6b7280;flex-shrink:0;"></div><span style="color:var(--t1);font-weight:700;">N/A</span><span style="color:#6b7280;font-weight:800;margin-left:auto;">${na}</span></div>
  <div style="margin-top:.35rem;padding:.4rem .6rem;background:rgba(239,68,68,.1);border-radius:8px;border:1px solid rgba(239,68,68,.25);text-align:center;">
    <div style="font-size:.65rem;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Within Rate</div>
    <div style="font-size:1.2rem;font-weight:900;color:#10b981;">${wPct}%</div>
  </div>
</div>`;
}

// ── TT Dynamic Breakdown: treemap-style tiles ─────────────────
function etaTTRenderDynDim(data) {
    var ctx = document.getElementById('eCDynDim');
    if (!ctx) return;
    if (ETA_STATE.charts['dyndim']) {
        try {
            ETA_STATE.charts['dyndim'].destroy();
        } catch (e) {}
        delete ETA_STATE.charts['dyndim'];
    }
    var dim = ETA_STATE._ttDim || 'TYPE';
    var entries = etaTopN(etaCount(data, dim), 8);
    ETA_STATE.charts['dyndim'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: entries.map(e => e[0]),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: ETA_C.slice(0, entries.length),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
          plugins: {
    legend: { display: false },
   datalabels: { display: false },
},
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        color: 'rgba(168,85,247,.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}
// KPI tile filter via AG Grid quick search for dynamic dim
window.etaTTDimFilter = function(field, val) {
    if (ETA_STATE.gridApi) ETA_STATE.gridApi.setGridOption('quickFilterText', val);
    var g = document.getElementById('etaGrid');
    if (g) g.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
};

// ── TT Custom Charts ──────────────────────────────────────────
window.etaSwitchAccCov = function(mode) {
    ETA_STATE._accCovMode = mode;
    ['lm','sm','oc'].forEach(function(m) {
        var btn = document.getElementById('accCovBtn_' + m);
        if (btn) { btn.className = m === mode ? 'export-btn' : 'reset-btn'; btn.style.cssText = 'padding:.22rem .55rem;font-size:.7rem;'; }
    });
    etaBuildAccCoverageChart(etaGetFiltered(), mode);
};

function etaBuildAccCoverageChart(data, mode) {
    mode = mode || ETA_STATE._accCovMode || 'lm';
    var ctx = document.getElementById('eCAccCov');
    if (!ctx) return;
    if (ETA_STATE.charts['accCov']) {
        try { ETA_STATE.charts['accCov'].destroy(); } catch(e) {}
        delete ETA_STATE.charts['accCov'];
    }

    var labels, datasets;

    if (mode === 'oc') {
        var openMap = {}, closedMap = {};
        data.forEach(r => {
            var mgr = r.LM || 'Unknown';
            var oc = etaGetTTOpenClosed(r);
            if (oc === 'open') openMap[mgr] = (openMap[mgr] || 0) + 1;
            else if (oc === 'closed') closedMap[mgr] = (closedMap[mgr] || 0) + 1;
        });
        labels = [...new Set([...Object.keys(openMap), ...Object.keys(closedMap)])].filter(m => m && m !== 'Unknown');
        datasets = [
            { label: 'Open', data: labels.map(m => openMap[m] || 0), backgroundColor: '#f59e0b', borderRadius: 4 },
            { label: 'Closed', data: labels.map(m => closedMap[m] || 0), backgroundColor: '#10b981', borderRadius: 4 }
        ];
    } else {
        var noTTAccounts = ETA_STATE.allData.noTTAccounts || [];
        var field = mode === 'lm' ? 'LM' : 'SM';
        var withMap = {}, withoutMap = {}, seen = new Set();
        data.forEach(r => {
            var mgr = r[field] || 'Unknown';
            var acc = r.ACCOUNT_NUMBER;
            if (acc && !seen.has(mgr + '|' + acc)) {
                seen.add(mgr + '|' + acc);
                withMap[mgr] = (withMap[mgr] || 0) + 1;
            }
        });
        noTTAccounts.forEach(a => {
            var mgr = a[field] || 'Unknown';
            withoutMap[mgr] = (withoutMap[mgr] || 0) + 1;
        });
        labels = [...new Set([...Object.keys(withMap), ...Object.keys(withoutMap)])].filter(m => m && m !== 'Unknown');
        datasets = [
            { label: 'Accounts with TTs', data: labels.map(m => withMap[m] || 0), backgroundColor: '#10b981', borderRadius: 4 },
            { label: 'Accounts — No TTs', data: labels.map(m => withoutMap[m] || 0), backgroundColor: '#f59e0b', borderRadius: 4 }
        ];
    }

    ETA_STATE.charts['accCov'] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#8b7aad', font: { size: 11 }, padding: 12, boxWidth: 12 } },
                datalabels: { display: false },
                tooltip: { callbacks: { afterBody: function(items) {
                    if (mode === 'oc') return [];
                    var mgr = items[0].label;
                    var w = datasets[0].data[labels.indexOf(mgr)] || 0;
                    var wo = datasets[1].data[labels.indexOf(mgr)] || 0;
                    var total = w + wo;
                    var pct = total > 0 ? ((w / total) * 100).toFixed(0) : 0;
                    return ['Coverage: ' + pct + '%'];
                }}}
            },
            scales: {
                x: { ticks: { color: '#8b7aad' }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: '#8b7aad' }, grid: { color: 'rgba(168,85,247,.1)' } }
            }
        }
    });
}// 1. Polar Area — Repeated Cases by Area
function etaBuildTTPolarArea(cid, entries) {
    var ctx = document.getElementById(cid);
    if (!ctx || !entries.length) return;
    // use polarArea chart type from Chart.js
    var colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
    ETA_STATE.charts[cid] = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: entries.map(e => e[0]),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: colors.slice(0, entries.length).map(c => c + 'bb'),
                borderColor: colors.slice(0, entries.length),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
           plugins: {
    legend: {
        position: 'right',
        labels: {
            color: '#8b7aad',
            font: { size: 11 },
            padding: 10,
            boxWidth: 12
        }
    },
    datalabels: { display: false }
},
            scales: {
                r: {
                    ticks: {
                        display: false,
                        backdropColor: 'transparent'
                    },
                    grid: {
                        color: 'rgba(168,85,247,.12)'
                    },
                    pointLabels: {
                        display: false
                    }
                }
            }
        }
    });
}

// 2. Custom heat-column Ageing Histogram (pure HTML, no canvas)
function etaBuildTTAgeingColumns(containerId, entries) {
    var el = document.getElementById(containerId);
    if (!el || !entries.length) return;
    var max = Math.max(...entries.map(e => e[1]));
    // heat palette: green → yellow → orange → red → deep red
    var heatColors = ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];
    var heatGlows = ['rgba(16,185,129,.35)', 'rgba(132,204,22,.35)', 'rgba(245,158,11,.35)', 'rgba(249,115,22,.35)', 'rgba(239,68,68,.35)'];
    el.style.cssText = 'height:240px;display:flex;align-items:flex-end;gap:10px;padding:.75rem .5rem .5rem;box-sizing:border-box;background:transparent;';
    el.innerHTML = entries.map((e, i) => {
        var pct = max > 0 ? Math.round((e[1] / max) * 100) : 0;
        var col = heatColors[i] || heatColors[heatColors.length - 1];
        var glow = heatGlows[i] || heatGlows[heatGlows.length - 1];
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end;">
  <div style="font-size:.72rem;font-weight:800;color:${col};">${e[1]}</div>
  <div style="
    width:100%;height:${Math.max(pct,4)}%;
    background:linear-gradient(180deg,${col}ee 0%,${col}55 100%);
    border-radius:6px 6px 0 0;
    box-shadow:0 0 14px ${glow},0 2px 8px ${glow};
    border-top:2px solid ${col};
    position:relative;
    transition:height .4s cubic-bezier(.4,0,.2,1);
  ">
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(255,255,255,.04) 0px,rgba(255,255,255,.04) 1px,transparent 1px,transparent 4px);border-radius:6px 6px 0 0;"></div>
  </div>
<div style="font-size:.62rem;color:var(--t3);text-align:center;line-height:1.2;margin-top:2px;">${e[0].replace(' hrs','h')}</div></div>`;
    }).join('');
}

// 3. Lollipop chart — Account Load
function etaBuildTTLollipop(data, containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var af = 'ACCOUNT_NUMBER';
    var map = {};
    data.forEach(r => {
        var c = r.COMPANY_NAME || r[af] || 'Unknown';
        map[c] = (map[c] || 0) + 1;
    });
    var sorted = Object.entries(map).sort((a, b) => ETA_STATE.accountLoadMode === 'most' ? b[1] - a[1] : a[1] - b[1]).slice(0, 10);
    var max = sorted.length ? sorted[0][1] : 1;
    if (ETA_STATE.accountLoadMode === 'least') max = sorted[sorted.length - 1] ? sorted[sorted.length - 1][1] : 1;
    max = Math.max(...sorted.map(e => e[1]));
    var colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#8b5cf6'];
    el.style.cssText = 'padding:.35rem .5rem;';
    el.innerHTML = sorted.map((e, i) => {
        var pct = max > 0 ? ((e[1] / max) * 100) : 0;
        var col = colors[i % colors.length];
        var name = e[0].length > 22 ? e[0].slice(0, 21) + '…' : e[0];
        return `<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem;">
  <div style="width:130px;min-width:130px;font-size:.72rem;color:var(--t2);text-align:right;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${e[0]}">${name}</div>
  <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:3px;position:relative;">
    <div style="height:6px;width:${pct}%;background:${col};border-radius:3px;transition:width .5s cubic-bezier(.4,0,.2,1);box-shadow:0 0 8px ${col}88;"></div>
    <div style="position:absolute;left:calc(${pct}% - 7px);top:50%;transform:translateY(-50%);width:14px;height:14px;border-radius:50%;background:${col};border:2px solid var(--bg-card);box-shadow:0 0 10px ${col};"></div>
  </div>
  <div style="width:28px;font-size:.78rem;font-weight:800;color:${col};text-align:right;">${e[1]}</div>
</div>`;
    }).join('');
}
function etaBuildActLollipop(data, containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var map = {};
    data.forEach(r => {
        var c = r.COMPANY_NAME || r.ACCOUNT_CODE || 'Unknown';
        map[c] = (map[c] || 0) + 1;
    });
    var sorted = Object.entries(map).sort((a, b) => ETA_STATE.accountLoadMode === 'most' ? b[1] - a[1] : a[1] - b[1]).slice(0, 10);
    var max = Math.max(...sorted.map(e => e[1]));
    var colors = ['#a855f7','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#8b5cf6'];
    el.style.cssText = 'padding:.35rem .5rem;';
    el.innerHTML = sorted.map((e, i) => {
        var pct = max > 0 ? ((e[1] / max) * 100) : 0;
        var col = colors[i % colors.length];
        var name = e[0].length > 22 ? e[0].slice(0, 21) + '…' : e[0];
        return `<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem;">
  <div style="width:130px;min-width:130px;font-size:.72rem;color:var(--t2);text-align:right;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${e[0]}">${name}</div>
  <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:3px;position:relative;">
    <div style="height:6px;width:${pct}%;background:${col};border-radius:3px;transition:width .5s cubic-bezier(.4,0,.2,1);box-shadow:0 0 8px ${col}88;"></div>
    <div style="position:absolute;left:calc(${pct}% - 7px);top:50%;transform:translateY(-50%);width:14px;height:14px;border-radius:50%;background:${col};border:2px solid var(--bg-card);box-shadow:0 0 10px ${col};"></div>
  </div>
  <div style="width:28px;font-size:.78rem;font-weight:800;color:${col};text-align:right;">${e[1]}</div>
</div>`;
    }).join('');
}
window.etaSwitchEvtAccCov = function(mode) {
    ETA_STATE._evtAccCovMode = mode;
    ['oc','lm','sm'].forEach(function(m) {
        var btn = document.getElementById('evtAccBtn_' + m);
        if (btn) { btn.className = m === mode ? 'export-btn' : 'reset-btn'; btn.style.cssText = 'padding:.22rem .55rem;font-size:.7rem;'; }
    });
    etaBuildEvtAccChart(etaGetFiltered(), mode);
};

function etaBuildEvtAccChart(data, mode) {
    mode = mode || ETA_STATE._evtAccCovMode || 'lm';
    var el = document.getElementById('eCAccLoad');
    if (!el) return;

    if (mode === 'most' || mode === 'least') {
        // Standard lollipop by account
        var map = {};
        data.forEach(r => {
            var c = r.COMPANY_NAME || r.ACCOUNT_NUMBER || 'Unknown';
            map[c] = (map[c] || 0) + 1;
        });
        var sorted = Object.entries(map)
            .sort((a,b) => mode === 'most' ? b[1]-a[1] : a[1]-b[1])
            .slice(0, 10);
        var max = Math.max(...sorted.map(e => e[1]));
        var colors = ['#a855f7','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#8b5cf6'];
        el.style.cssText = 'padding:.35rem .5rem;height:320px;overflow-y:auto;';
        el.innerHTML = sorted.map((e,i) => {
            var pct = max > 0 ? ((e[1]/max)*100) : 0;
            var col = colors[i % colors.length];
            var name = e[0].length > 22 ? e[0].slice(0,21)+'…' : e[0];
            return `<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem;">
  <div style="width:130px;min-width:130px;font-size:.72rem;color:var(--t2);text-align:right;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${e[0]}">${name}</div>
  <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:3px;position:relative;">
    <div style="height:6px;width:${pct}%;background:${col};border-radius:3px;box-shadow:0 0 8px ${col}88;"></div>
    <div style="position:absolute;left:calc(${pct}% - 7px);top:50%;transform:translateY(-50%);width:14px;height:14px;border-radius:50%;background:${col};border:2px solid var(--bg-card);box-shadow:0 0 10px ${col};"></div>
  </div>
  <div style="width:28px;font-size:.78rem;font-weight:800;color:${col};text-align:right;">${e[1]}</div>
</div>`;
        }).join('');

    } else {
        // By LM or SM — accounts with events vs no events
        var field = mode === 'lm' ? 'LM' : 'SM';
        var noEventsAccounts = ETA_STATE.allData.noEventsAccounts || [];
        var withMap = {}, withoutMap = {}, seen = new Set();
        data.forEach(r => {
            var mgr = r[field] || 'Unknown';
            var acc = r.ACCOUNT_NUMBER;
            if (acc && !seen.has(mgr + '|' + acc)) {
                seen.add(mgr + '|' + acc);
                withMap[mgr] = (withMap[mgr] || 0) + 1;
            }
        });
        noEventsAccounts.forEach(a => {
            var mgr = a[field] || 'Unknown';
            withoutMap[mgr] = (withoutMap[mgr] || 0) + 1;
        });
        var labels = [...new Set([...Object.keys(withMap), ...Object.keys(withoutMap)])].filter(m => m && m !== 'Unknown');
        if (ETA_STATE.charts['evtAccOC']) { try { ETA_STATE.charts['evtAccOC'].destroy(); } catch(e){} delete ETA_STATE.charts['evtAccOC']; }
        el.style.cssText = 'height:320px;';
        el.innerHTML = '<canvas id="eCAccOC"></canvas>';
        var ctx = document.getElementById('eCAccOC');
        if (!ctx) return;
        ETA_STATE.charts['evtAccOC'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Accounts with Events', data: labels.map(m => withMap[m] || 0), backgroundColor: '#10b981', borderRadius: 4 },
                    { label: 'Accounts — No Events', data: labels.map(m => withoutMap[m] || 0), backgroundColor: '#f59e0b', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: '#8b7aad', font: { size: 11 }, padding: 12, boxWidth: 12 } },
                    datalabels: { display: false },
                    tooltip: { callbacks: { afterBody: function(items) {
                        var mgr = items[0].label;
                        var w = withMap[mgr] || 0;
                        var wo = withoutMap[mgr] || 0;
                        var total = w + wo;
                        var pct = total > 0 ? ((w / total) * 100).toFixed(0) : 0;
                        return ['Coverage: ' + pct + '%'];
                    }}}
                },
                scales: {
                    x: { ticks: { color: '#8b7aad' }, grid: { display: false } },
                    y: { beginAtZero: true, ticks: { color: '#8b7aad' }, grid: { color: 'rgba(168,85,247,.1)' } }
                }
            }
        });
    }
}
window.etaSwitchActMgr = function(mode) {
    ETA_STATE._actMgrMode = mode;
    ['lm','sm'].forEach(function(m) {
        var btn = document.getElementById('actMgrBtn_' + m);
        if (btn) { btn.className = m === mode ? 'export-btn' : 'reset-btn'; btn.style.cssText = 'padding:.22rem .55rem;font-size:.7rem;'; }
    });
    etaBuildActMgrChart(etaGetFiltered(), mode);
};

function etaBuildActMgrChart(data, mode) {
    mode = mode || ETA_STATE._actMgrMode || 'lm';
    var ctx = document.getElementById('eCActMgr');
    if (!ctx) return;
    if (ETA_STATE.charts['actMgr']) {
        try { ETA_STATE.charts['actMgr'].destroy(); } catch(e) {}
        delete ETA_STATE.charts['actMgr'];
    }

    var field = mode === 'lm' ? 'LM' : 'SM';
    var actOpenSt = ['Assigned', 'Unassigned', 'In Progress', 'Open'];
    var openMap = {}, closedMap = {};

    data.forEach(r => {
        var mgr = r[field] || 'Unknown';
        if (actOpenSt.includes(r.ACTIVITY_STATUS)) {
            openMap[mgr] = (openMap[mgr] || 0) + 1;
        } else {
            closedMap[mgr] = (closedMap[mgr] || 0) + 1;
        }
    });

    var labels = [...new Set([...Object.keys(openMap), ...Object.keys(closedMap)])].filter(m => m && m !== 'Unknown');

    ETA_STATE.charts['actMgr'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Open', data: labels.map(m => openMap[m] || 0), backgroundColor: '#f59e0b', borderRadius: 4 },
                { label: 'Closed', data: labels.map(m => closedMap[m] || 0), backgroundColor: '#10b981', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#8b7aad', font: { size: 11 }, padding: 12, boxWidth: 12 } },
                datalabels: { display: false },
                tooltip: { callbacks: { afterBody: function(items) {
                    var mgr = items[0].label;
                    var o = openMap[mgr] || 0;
                    var c = closedMap[mgr] || 0;
                    var total = o + c;
                    var pct = total > 0 ? ((c / total) * 100).toFixed(0) : 0;
                    return ['Closure Rate: ' + pct + '%'];
                }}}
            },
            scales: {
                x: { ticks: { color: '#8b7aad' }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: '#8b7aad' }, grid: { color: 'rgba(168,85,247,.1)' } }
            }
        }
    });
}
// ── Dynamic Dimension (TT) ────────────────────────────────────
window.etaTTSwitchDim = function(dim) {
    ETA_STATE._ttDim = dim;
['TYPE', 'DRIVER', 'CUSTOMER_SEGMENT', 'TICKET_TYPE'].forEach(d => {
    var btn = document.getElementById('ttDimBtn_' + d);
        if (!btn) return;
        btn.className = d === dim ? 'export-btn' : 'reset-btn';
        btn.style.padding = '.22rem .55rem';
        btn.style.fontSize = '.7rem';
    });
    if (ETA_STATE.charts['dyndim']) {
        try {
            ETA_STATE.charts['dyndim'].destroy();
        } catch (e) {}
        delete ETA_STATE.charts['dyndim'];
    }
    etaTTRenderDynDim(etaGetFiltered());
};


window.etaSwitchTrend = function(mode) {
    ETA_STATE.trendMode = mode;
    var data = etaGetFiltered();
    if (ETA_STATE.charts['trend']) {
        try {
            ETA_STATE.charts['trend'].destroy();
        } catch (e) {}
        delete ETA_STATE.charts['trend'];
    }
    var c = document.getElementById('eCTrend');
    if (!c) return;
    if (ETA_STATE.activeTab === 'tt') etaBuildTTTrend(data, 'eCTrend');
    else etaBuildTrend(data, 'eCTrend');
    document.querySelectorAll('[onclick*="etaSwitchTrend"]').forEach(btn => {
        var mode2 = btn.getAttribute('onclick').match(/'(\w+)'/)?.[1];
        if (mode2) btn.className = mode2 === ETA_STATE.trendMode ? 'export-btn' : 'reset-btn';
        btn.style.padding = '.25rem .6rem';
        btn.style.fontSize = '.72rem';
    });
};

window.etaSwitchAccLoad = function(mode) {
    ETA_STATE.accountLoadMode = mode;
    ETA_STATE._evtAccCovMode = mode;
    if (ETA_STATE.activeTab === 'events') {
        document.querySelectorAll('[id^="evtAccBtn_"]').forEach(btn => {
            var m = btn.id.replace('evtAccBtn_','');
            btn.className = m === mode ? 'export-btn' : 'reset-btn';
            btn.style.cssText = 'padding:.22rem .55rem;font-size:.7rem;';
        });
        etaBuildEvtAccChart(etaGetFiltered(), mode);
    } else if (ETA_STATE.activeTab === 'tt') {
        // for TT, just rebuild the lollipop without destroying all charts
        etaBuildTTLollipop(etaGetFiltered(), 'eCAccLoad');
        // update button styles
        document.querySelectorAll('[onclick*="etaSwitchAccLoad"]').forEach(btn => {
            var m = btn.getAttribute('onclick').match(/'(\w+)'/)?.[1];
            if (m) btn.className = m === mode ? 'export-btn' : 'reset-btn';
            btn.style.padding = '.25rem .6rem';
            btn.style.fontSize = '.72rem';
        });
    } else {
        etaRenderCharts(etaGetFiltered());
    }
};

function etaBuildTrend(data, cid) {
    var ctx = document.getElementById(cid);
    if (!ctx) return;
    var labels, counts;
    if (ETA_STATE.trendMode === 'weekly') {
        var m = {};
        data.forEach(r => {
            var w = r.Week || 'Unknown';
            m[w] = (m[w] || 0) + 1;
        });
        labels = ['W1', 'W2', 'W3', 'W4', 'W5'].filter(w => m[w] !== undefined);
        counts = labels.map(w => m[w]);
    } else if (ETA_STATE.trendMode === 'monthly') {
        var m = {};
        data.forEach(r => {
            var mo = r.Month || 'Unknown';
            m[mo] = (m[mo] || 0) + 1;
        });
      var monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        labels = Object.keys(m).sort((a,b) => {
            var [ma,ya] = a.split('-'); var [mb,yb] = b.split('-');
            return (parseInt(ya)-parseInt(yb)) || monthOrder.indexOf(ma)-monthOrder.indexOf(mb);
        });
        counts = labels.map(mo => m[mo]);
    } else {
        var m = {};
        data.forEach(r => {
            var y = r.Year || 'Unknown';
            m[y] = (m[y] || 0) + 1;
        });
        labels = Object.keys(m).sort();
        counts = labels.map(y => m[y]);
    }
    ETA_STATE.charts['trend'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Volume',
                data: counts,
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168,85,247,.15)',
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: '#a855f7',
                tension: .3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: { display: false },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        color: 'rgba(168,85,247,.1)'
                    }
                }
            }
        }
    });
}

function etaBuildDonut(cid, dataObj) {
    var ctx = document.getElementById(cid);
    if (!ctx) return;
    var entries = Object.entries(dataObj).filter(e => e[1] > 0);
    ETA_STATE.charts[cid] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: entries.map(e => e[0]),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: ETA_C.slice(0, entries.length),
                borderWidth: 2,
                borderColor: 'transparent'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#8b7aad',
                        font: {
                            size: 11
                        },
                        padding: 8,
                        boxWidth: 12
                    }
                },
                datalabels: { display: false }
            }
        }
    });
}

function etaBuildBar(cid, entries) {
    var ctx = document.getElementById(cid);
    if (!ctx || !entries.length) return;
    ETA_STATE.charts[cid] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: entries.map(e => e[0]),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: ETA_C.slice(0, entries.length),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                datalabels: { display: true, color: '#fff', font: { weight: 'bold', size: 10 }, anchor: 'center', align: 'center' },
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        color: 'rgba(168,85,247,.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function etaBuildAccLoad(data, cid) {
    var ctx = document.getElementById(cid);
    if (!ctx) return;
    var af = ETA_STATE.activeTab === 'activities' ? 'ACCOUNT_CODE' : 'ACCOUNT_NUMBER';
    var map = {};
    data.forEach(r => {
        var c = r.COMPANY_NAME || r[af] || 'Unknown';
        map[c] = (map[c] || 0) + 1;
    });
    var sorted = Object.entries(map).sort((a, b) => ETA_STATE.accountLoadMode === 'most' ? b[1] - a[1] : a[1] - b[1]);
    var top = sorted.slice(0, 10);
    ETA_STATE.charts[cid] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top.map(e => e[0]),
            datasets: [{
                label: 'Records',
                data: top.map(e => e[1]),
                backgroundColor: ETA_C.slice(0, 10),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
           plugins: {
    legend: {
        position: 'right',
        labels: {
            color: '#8b7aad',
            font: { size: 11 },
            padding: 10,
            boxWidth: 12
        }
    }
},
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#8b7aad'
                    },
                    grid: {
                        color: 'rgba(168,85,247,.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#8b7aad',
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ── AG GRID ───────────────────────────────────────────────────
function etaGetColumns() {
    const tab = ETA_STATE.activeTab;

    function col(f, h, w, o) {
        return Object.assign({
            field: f,
            headerName: h,
            filter: 'agTextColumnFilter',
            width: w || 130,
            resizable: true,
            sortable: true
        }, o || {});
    }

    if (tab === 'events') return [
        col('CREATED', 'Created', 115), col('COMPANY_NAME', 'Company', 165), col('ACCOUNT_NUMBER', 'Account', 100), col('TEAM', 'Team', 85),
        col('TYPE', 'Type', 120), col('AREA', 'Area', 110), col('SUB_AREA', 'Sub Area', 120),
        col('STATUS', 'Status', 110, {
            cellRenderer: p => etaStBadge(p.value)
        }),
        col('COMMUNICATION_MODE', 'Comm Mode', 120), col('CUSTOMER_VALUE', 'Cust Value', 100),
        col('IF_CTI_USED', 'CTI Used', 90), col('CUSTOMER_TYPE', 'Cust Type', 110),
        col('CUSTOMER_SEGMENT', 'Segment', 100), col('NATIONALITY', 'Nationality', 110),
        col('EMARATI_NATIONAL', 'Emirati', 85), col('SERVICE', 'Service', 130),
        col('CALL_CENTER', 'Call Center', 110), col('DESCRIPTION', 'Description', 185),
        col('REPEATED_AGEING', 'Rep Ageing', 95, {
            filter: 'agNumberColumnFilter'
        }),
        col('SIGNATURE_ACCOUNT', 'Signature', 90), col('IF_NEW_TRIPLET', 'New Triplet', 95),
        col('LANGUAGE', 'Language', 90), col('EMTYAZ_SEGMENT', 'Emtyaz Seg', 100),
        col('LM', 'Line Manager', 130), col('SM', 'Service Manager', 140), col('Week', 'Week', 72), col('Month', 'Month', 82)
    ];

    // ── PATCHED TT columns ────────────────────────────────────
    if (tab === 'tt') return [
        col('TICKET_NUMBER', 'Ticket #', 130),
        col('COMPANY_NAME', 'Company', 165),
        col('ACCOUNT_NUMBER', 'Account', 100),
        col('TEAM', 'Team', 85),
        col('TYPE', 'Type', 155),
        col('OPEN_TIME', 'Open Time', 112),
        col('CLOSE_DATE', 'Close Date', 112),
        col('TT_STATUS', 'Status', 115, {
            cellRenderer: p => etaStBadge(p.value)
        }),
        col('AREA', 'Area', 110),
        col('SUB_AREA', 'Sub Area', 120),
       col('SLA', 'SLA', 115, {
    cellRenderer: p => {
        if (!p.value) return '';
        var cls = p.value === 'Breached' ? 'badge-danger' : p.value === 'Not Breached' ? 'badge-success' : 'badge-info';
        return `<span class="status-badge ${cls}">${p.value}</span>`;
    }
}),
        col('TICKET_TYPE', 'TT Type', 100),
        col('SUB_STATUS', 'Sub Status', 140),
        col('SPRIORITY', 'Priority', 90, {
            cellRenderer: p => {
                if (!p.value) return '';
                var cls = p.value === 'P1' ? 'badge-danger' : p.value === 'P2' ? 'badge-warning' : p.value === 'P3' ? 'badge-info' : 'badge-success';
                return `<span class="status-badge ${cls}">${p.value}</span>`;
            }
        }),
        col('REPEATED', 'Repeated', 88, {
            cellRenderer: p => p.value === 'Yes' ? '<span class="status-badge badge-warning">Yes</span>' : 'No'
        }),
        col('AGEING_QUEUE', 'Ageing Bucket', 118),
        col('AGEING_QUEUE_RAW', 'Ageing (hrs)', 100, {
            filter: 'agNumberColumnFilter',
            type: 'numericColumn'
        }),
        col('CUSTOMER_SEGMENT', 'Segment', 100),
        col('FIRST_CONTACT', 'FCR', 75, {
            cellRenderer: p => p.value === 'Yes' ? '<span class="status-badge badge-success">Yes</span>' : 'No'
        }),
        col('LAST_UPDATE', 'Last Update', 112),
        col('PRODUCT', 'Product', 110),
        col('AGENT', 'Agent', 120),
        col('DESCRIPTION', 'Description', 200, {
            cellRenderer: p => p.value ? `<span title="${String(p.value).replace(/"/g,'&quot;')}">${p.value}</span>` : '',
            autoHeight: false,
            wrapText: false
        }), col('RESOLVE_DATETIME_MIN', 'Resolve Start', 112),
        col('RESOLVE_DATETIME', 'Resolve End', 112),
        col('LM', 'Line Manager', 130),
        col('SM', 'Service Manager', 140),
        col('Week', 'Week', 72),
        col('Month', 'Month', 82)
    ];

    return [
        col('ACTIVITY_ID', 'Activity ID', 140),
        col('COMPANY_NAME', 'Company', 175),
        col('ACCOUNT_CODE', 'Account', 110),
        col('TEAM', 'Team', 85),
        col('ACTIVITY_STATUS', 'Status', 110, { cellRenderer: p => etaStBadge(p.value) }),
        col('ACTIVITY_CREATION', 'Created', 112),
        col('ACTIVITY_CLOSE_DT', 'Closed', 112),
        col('AGEING_ACTIVITY', 'Ageing', 100),
        col('ACTIVITY_TYPE', 'Type', 100),
        col('ACTIVITY_CREATED_BY', 'Agent ID', 110),
        col('OPTY_CD', 'Service Category', 150),
        col('OPTY_AREA', 'Opty Area', 130),
        col('DESCRIPTION', 'Description', 200),
        col('COMMENTS', 'Comments', 165),
        col('LM', 'Line Manager', 130),
        col('SM', 'Service Manager', 140),
        col('Week', 'Week', 72),
        col('Month', 'Month', 82)
    ];
}

function etaStBadge(v) {
    if (!v) return '';
    var lv = v.toLowerCase();
    var cls = 'badge-info';
    if (lv.includes('closed') || lv.includes('completed') || lv.includes('resolved') || lv.includes('won')) cls = 'badge-success';
    else if (lv.includes('open') || lv.includes('progress')) cls = 'badge-warning';
    else if (lv.includes('escalat') || lv.includes('critical') || lv.includes('lost')) cls = 'badge-danger';
    return `<span class="status-badge ${cls}">${v}</span>`;
}

function etaPriBadge(v) {
    if (!v) return '';
    var lv = v.toLowerCase();
    var cls = lv === 'critical' ? 'badge-danger' : lv === 'high' ? 'badge-warning' : lv === 'medium' ? 'badge-info' : 'badge-success';
    return `<span class="status-badge ${cls}">${v}</span>`;
}

function etaRenderGrid(data) {
    var gridDiv = document.getElementById('etaGrid');
    if (!gridDiv) return;
    var t = document.getElementById('etaGridTitle');
    if (t) t.textContent = {
        events: 'Events Records',
        tt: 'Trouble Ticket Records',
        activities: 'Activity Records'
    } [ETA_STATE.activeTab];
    if (ETA_STATE.gridApi) {
        try {
            ETA_STATE.gridApi.destroy();
        } catch (e) {}
        ETA_STATE.gridApi = null;
    }
    gridDiv.innerHTML = '';
    agGrid.createGrid(gridDiv, {
        columnDefs: etaGetColumns(),
        rowData: data,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 70
        },
        pagination: true,
        paginationPageSize: 50,
        paginationPageSizeSelector: [25, 50, 100, 200],
        rowHeight: 44,
        headerHeight: 48,
        animateRows: true,
        enableCellTextSelection: true,
        isExternalFilterPresent: () => !!(ETA_STATE._kpiField && ETA_STATE._kpiVals && ETA_STATE._kpiVals.length),
        doesExternalFilterPass: (node) => {
            if (!ETA_STATE._kpiField || !ETA_STATE._kpiVals) return true;
            var r = node.data;
            var f = ETA_STATE._kpiField;
            // special: _MISHANDLED
            if (f === 'REPEATED_AGEING_FLAG') {
                return (r.REPEATED_AGEING || 0) > 0;
            }
            if (f === '_MISHANDLED') {
                if (!r.SUB_STATUS) return false;
                var sv = r.SUB_STATUS.toLowerCase();
                return sv.includes('reassign') || sv.includes('returned') || sv.includes('wrong assignment');
            }
            // TT_STATUS multi-value (e.g. Open,In Progress,Pending,Escalated)
            var val = r[f] || '';
            return ETA_STATE._kpiVals.some(v => val === v);
        },
        onGridReady: p => {
            ETA_STATE.gridApi = p.api;
        },
        getRowStyle: p => p.node.rowIndex % 2 === 1 ? {
            background: 'rgba(168,85,247,.04)'
        } : null
    });
}

window.etaSearchGrid = function(v) {
    if (ETA_STATE.gridApi) ETA_STATE.gridApi.setGridOption('quickFilterText', v);
};
window.etaExportGrid = function() {
    var data = etaGetFiltered();
    if (!data.length) return;

    var f = ETA_STATE.filters;
    var today = new Date().toLocaleDateString('en-GB');

    // Build filter summary rows
    var filterRows = [
        ['Export Date', today],
        ['Tab', ETA_STATE.activeTab.toUpperCase()],
        ['Team', f.team || 'All'],
        ['Account', f.account || 'All'],
        ['Year', f.years.length ? f.years.join(', ') : 'All'],
        ['Quarter', f.quarters.length ? f.quarters.join(', ') : 'All'],
        ['Month', f.months.length ? f.months.join(', ') : 'All'],
        ['Week', f.weeks.length ? f.weeks.join(', ') : 'All'],
        ['Status', f.status || 'All'],
        ['Open/Closed', f.openClosed || 'All'],
        ['Line Manager', ETA_STATE.selectedLM || 'All'],
        ['Service Manager', ETA_STATE.selectedSM || 'All'],
        ['Total Records', data.length],
        [], // blank row
        [] // blank row
    ];

    // Get column headers from AG Grid column defs
    var cols = etaGetColumns();
    var headers = cols.map(c => c.headerName);
    var fields = cols.map(c => c.field);

    // Build data rows
    var dataRows = data.map(r => fields.map(f => r[f] !== undefined ? r[f] : ''));

    // Combine all rows
    var allRows = filterRows.concat([headers]).concat(dataRows);

    // Create workbook
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(allRows);

    // Style the header row (row index = filterRows.length)
    var headerRowIdx = filterRows.length;
    headers.forEach((h, i) => {
        var cellRef = XLSX.utils.encode_cell({
            r: headerRowIdx,
            c: i
        });
        if (!ws[cellRef]) return;
        ws[cellRef].s = {
            font: {
                bold: true,
                color: {
                    rgb: 'FFFFFF'
                }
            },
            fill: {
                fgColor: {
                    rgb: '7C3AED'
                }
            },
            alignment: {
                horizontal: 'center'
            }
        };
    });

    // Set column widths
    ws['!cols'] = fields.map(() => ({
        wch: 18
    }));

    XLSX.utils.book_append_sheet(wb, ws, ETA_STATE.activeTab.toUpperCase());

    var fileName = 'ETA_' + ETA_STATE.activeTab + '_' + today.replace(/\//g, '-') + '.xlsx';
    XLSX.writeFile(wb, fileName);
};
