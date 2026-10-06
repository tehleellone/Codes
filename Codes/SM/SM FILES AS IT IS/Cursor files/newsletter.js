// ============================================================
// newsletter.js — Newsletter Module
// ============================================================

var NL_LIST = 'Newsletter';
var NL_MAPPING_LIST = 'Account Mapping';
var NL_BDAY_TZ = 'Asia/Dubai';
var NL_BDAY_SOURCE_PREFIX = 'BirthdayAuto|';
var NL_BDAY_IMAGE_TODAY = '/sites/SM/Shared Documents/birthday-happy.jpg';
var NL_BDAY_IMAGE_COUNTDOWN = '/sites/SM/Shared Documents/birthday-countdown.jpg';
var NL_BDAY_DISPLAY_SOURCE = 'People & Culture';
var NL_SP_HOST = 'http://sharedspaces:8086';
var nlCurrentTab = 'view';
var nlAllItems = [];
var nlBirthdayUpcoming = [];

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

function nlMarkAsSeen(latestId) {
    var id = latestId != null ? latestId : (nlAllItems.length > 0 ? nlAllItems[0].ID : null);
    if (id == null) return;
    try {
        localStorage.setItem('sm_nl_last_seen', String(id));
        sessionStorage.setItem('sm_nl_opened_' + id, '1');
        sessionStorage.removeItem('sm_nl_popup_later_' + id);
    } catch (e) {}
}

function nlWasOpenedThisSession(id) {
    try { return sessionStorage.getItem('sm_nl_opened_' + String(id)) === '1'; } catch (e) { return false; }
}

function nlPopupDismissedThisSession(id) {
    try { return sessionStorage.getItem('sm_nl_popup_later_' + String(id)) === '1'; } catch (e) { return false; }
}

function nlDismissPopupForSession(id) {
    try { sessionStorage.setItem('sm_nl_popup_later_' + String(id), '1'); } catch (e) {}
}

function nlRemoveNewBadge() {
    var badge = document.getElementById('nlNewBadge');
    if (badge) badge.style.display = 'none';
}

function nlCheckNewBadge(items) {
    if (!items || items.length === 0) return false;
    var latest = items[0];
    var isNew = String(latest.ID) !== nlGetLastSeenId() && !nlWasOpenedThisSession(latest.ID);
    var badge = document.getElementById('nlNewBadge');
    if (badge) badge.style.display = isNew ? 'inline-flex' : 'none';
    var nav = document.getElementById('newsletterNavItem');
    if (nav) {
        if (isNew) nav.classList.add('nl-has-new');
        else nav.classList.remove('nl-has-new');
    }
    return isNew;
}

function nlShowNewItemPopup(item) {
    if (!item || !item.ID) return;
    if (item.Category === 'Birthdays' || nlIsBirthdayAutoItem(item)) return;
    if (nlWasOpenedThisSession(item.ID) || nlPopupDismissedThisSession(item.ID)) return;
    if (String(item.ID) === nlGetLastSeenId()) return;

    var existing = document.getElementById('nlNewItemPopup');
    if (existing) existing.remove();

    var snippet = nlDisplayContent(item).slice(0, 220);
    if (nlDisplayContent(item).length > 220) snippet += '…';
    var banner = nlGetImageURL(item) ? NL_SP_HOST + nlGetImageURL(item) : '';
    var actionsHtml =
        '<div class="nl-modal-actions">' +
        '<button type="button" id="nlPopupViewBtn" class="export-btn" style="flex:1;">Read newsletter</button>' +
        '<button type="button" id="nlPopupLaterBtn" class="reset-btn" style="flex:1;">Later</button></div>';
    var overlay = nlOpenModalShell({
        id: 'nlNewItemPopup',
        bannerUrl: banner,
        fallbackEmoji: '📰',
        pill: 'New update',
        badge: 'Newsletter',
        badgeColor: '#ef4444',
        dateLabel: nlFormatDate(item.PublishedDate),
        sourceLabel: nlDisplaySource(item),
        title: item.Title || 'Newsletter update',
        body: snippet,
        actionsHtml: actionsHtml
    });

    document.getElementById('nlPopupViewBtn').addEventListener('click', function () {
        overlay.remove();
        nlMarkAsSeen(item.ID);
        nlRemoveNewBadge();
        if (typeof showNewsletterView === 'function') showNewsletterView();
        else if (typeof switchDashboardSection === 'function') switchDashboardSection('newsletterView');
    });
    document.getElementById('nlPopupLaterBtn').addEventListener('click', function () {
        nlDismissPopupForSession(item.ID);
        overlay.remove();
        nlCheckNewBadge([item]);
    });
}

// ── Load ──────────────────────────────────────────────────────
async function nlLoadNewsletter() {
    var loadingEl = document.getElementById('nlLoading');
    var contentEl = document.getElementById('nlContent');
    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    try {
        try {
            await nlBirthdayRefreshUpcoming(null, nlUaeYmd(new Date()));
        } catch (bErr) {
            console.warn('[Birthday] Upcoming refresh:', bErr.message);
        }

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
        if (nlAllItems.length > 0) nlMarkAsSeen(nlAllItems[0].ID);

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
    var tabBirthdays = document.getElementById('nlTabBirthdays');
    var tabManage = document.getElementById('nlTabManage');

    function styleTab(el, active) {
        if (!el) return;
        el.style.background = active ? 'var(--grad)' : 'var(--bg-input)';
        el.style.color = active ? '#fff' : 'var(--t1)';
        el.style.border = active ? 'none' : '1px solid var(--border)';
    }
    styleTab(tabView, tab === 'view');
    styleTab(tabBirthdays, tab === 'birthdays');
    styleTab(tabManage, tab === 'manage');

    if (tab === 'birthdays') {
        nlRenderBirthdaysTab();
        return;
    }
    nlRender();
};

// ── Render ────────────────────────────────────────────────────
function nlRender() {
    var isAdmin = USER_CONTEXT && USER_CONTEXT.isAdmin;
    var manageTab = document.getElementById('nlTabManage');
    if (manageTab) manageTab.style.display = isAdmin ? 'inline-flex' : 'none';

    if (nlCurrentTab === 'birthdays') {
        nlRenderBirthdaysTab();
    } else if (nlCurrentTab === 'manage' && isAdmin) {
        nlRenderManage();
    } else {
        nlRenderView();
    }
}

// ── Helpers ───────────────────────────────────────────────────
function nlCategoryColor(cat) {
    var map = { 'Announcement': '#f97316', 'Update': '#3b82f6', 'Holiday': '#10b981', 'General': '#8b5cf6', 'Birthdays': '#ec4899' };
    return map[cat] || '#8b5cf6';
}

function nlIsBirthdayAutoItem(item) {
    if (!item) return false;
    if (String(item.Source || '').indexOf(NL_BDAY_SOURCE_PREFIX) === 0) return true;
    if (String(item.Content || '').indexOf(NL_BDAY_SOURCE_PREFIX) >= 0) return true;
    return item.Category === 'Birthdays';
}

function nlItemsExcludingBirthdays(items) {
    return (items || []).filter(function (i) { return i.Category !== 'Birthdays' && !nlIsBirthdayAutoItem(i); });
}

function nlBirthdayItems(items) {
    return (items || []).filter(function (i) { return i.Category === 'Birthdays' || nlIsBirthdayAutoItem(i); });
}

function nlFormatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nlGetImageURL(item) {
    return item._imageURL || null;
}

function nlEscapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function nlDisplaySource(item) {
    if (!item) return 'Admin';
    if (nlIsBirthdayAutoItem(item)) return NL_BDAY_DISPLAY_SOURCE;
    var src = String(item.Source || '').trim();
    if (!src || src.indexOf(NL_BDAY_SOURCE_PREFIX) === 0) return NL_BDAY_DISPLAY_SOURCE;
    return src || (item.Author ? item.Author.Title : 'Admin');
}

function nlStripHtmlToPlain(html) {
    var s = String(html || '');
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    if (typeof document !== 'undefined') {
        var tmp = document.createElement('div');
        tmp.innerHTML = s;
        s = (tmp.textContent || tmp.innerText || '').trim();
    } else {
        s = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return s;
}

function nlDisplayContent(item) {
    var text = String((item && item.Content) || '');
    text = text.replace(/<!--\s*BirthdayAuto[^>]*-->/gi, '').trim();
    return nlStripHtmlToPlain(text);
}

function nlBirthdayMetaFromItem(item) {
    if (!item) return null;
    var fromSource = nlParseBirthdaySource(item.Source);
    if (fromSource) return fromSource;
    var m = String(item.Content || '').match(/<!--\s*(BirthdayAuto[^>]+)\s*-->/i);
    if (m) return nlParseBirthdaySource(m[1]);
    return null;
}

function nlBirthdayIsTodayItem(item) {
    var meta = nlBirthdayMetaFromItem(item);
    return meta && meta.daysUntil === 0;
}

function nlBirthdayBannerUrl(item) {
    var attached = nlGetImageURL(item);
    if (attached) return NL_SP_HOST + attached;
    if (nlBirthdayIsTodayItem(item)) {
        return NL_SP_HOST + NL_BDAY_IMAGE_TODAY.replace(/ /g, '%20');
    }
    return NL_SP_HOST + NL_BDAY_IMAGE_COUNTDOWN.replace(/ /g, '%20');
}

function nlInjectNewsletterStyles() {
    if (document.getElementById('nlStyles')) return;
    var style = document.createElement('style');
    style.id = 'nlStyles';
    style.textContent =
        '.nl-modal-backdrop{position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.62);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;}' +
        '.nl-modal-card{background:var(--bg-card);border:1px solid var(--border);border-radius:20px;width:100%;max-width:560px;max-height:90vh;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.35);position:relative;display:flex;flex-direction:column;}' +
        '.nl-modal-hero{position:relative;width:100%;height:220px;overflow:hidden;background:linear-gradient(135deg,#ec4899 0%,#f97316 50%,#8b5cf6 100%);flex-shrink:0;}' +
        '.nl-modal-hero img{width:100%;height:100%;object-fit:cover;display:block;}' +
        '.nl-modal-hero-fallback{display:flex;align-items:center;justify-content:center;height:100%;font-size:4rem;}' +
        '.nl-modal-close{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);color:#fff;cursor:pointer;font-size:18px;line-height:1;z-index:2;}' +
        '.nl-modal-body{padding:1.75rem 1.75rem 1.5rem;overflow-y:auto;}' +
        '.nl-modal-meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px;}' +
        '.nl-modal-badge{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:5px 12px;border-radius:999px;color:#fff;}' +
        '.nl-modal-date{font-size:12px;color:var(--t3);display:inline-flex;align-items:center;gap:4px;}' +
        '.nl-modal-title{font-size:1.35rem;font-weight:800;color:var(--t1);margin:0 0 12px;line-height:1.35;}' +
        '.nl-modal-text{font-size:14px;color:var(--t2);line-height:1.75;margin:0 0 1.25rem;white-space:pre-wrap;}' +
        '.nl-modal-actions{display:flex;gap:10px;flex-wrap:wrap;}' +
        '.nl-bday-countdown-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(236,72,153,.12);border:1px solid rgba(236,72,153,.25);color:#db2777;font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;margin-bottom:12px;}' +
        '.nl-bday-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem;}' +
        '.nl-bday-card{border-radius:16px;overflow:hidden;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;transition:transform .2s,box-shadow .2s;}' +
        '.nl-bday-card:hover{transform:translateY(-3px);box-shadow:var(--ch);}' +
        '.nl-bday-card-hero{height:140px;background:linear-gradient(135deg,#ec4899,#f97316);position:relative;}' +
        '.nl-bday-card-hero img{width:100%;height:100%;object-fit:cover;}' +
        '.nl-bday-card-body{padding:1rem 1.1rem 1.15rem;}' +
        '.nl-feed-hero{border-radius:20px;overflow:hidden;margin-bottom:1.5rem;box-shadow:var(--ch);cursor:pointer;transition:transform .2s,box-shadow .2s;background:var(--bg-card);border:1px solid var(--border);}' +
        '.nl-feed-hero:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(0,0,0,.12);}' +
        '.nl-feed-hero-img{width:100%;height:360px;object-fit:cover;display:block;}' +
        '.nl-feed-hero-img-sm{height:160px;}' +
        '.nl-feed-hero-body{padding:1.75rem 2rem 2rem;}' +
        '.nl-feed-meta{display:flex;align-items:center;gap:12px;margin-bottom:.85rem;flex-wrap:wrap;}' +
        '.nl-feed-badge{font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;letter-spacing:.04em;text-transform:uppercase;color:#fff;}' +
        '.nl-feed-meta-text{font-size:12px;color:var(--t3);display:inline-flex;align-items:center;gap:4px;}' +
        '.nl-feed-hero-title{font-size:1.55rem;font-weight:800;color:var(--t1);margin:0 0 .85rem;line-height:1.35;}' +
        '.nl-feed-hero-excerpt{font-size:15px;color:var(--t2);line-height:1.75;margin:0;}' +
        '.nl-feed-section-title{font-size:.95rem;font-weight:800;color:var(--t1);margin:2rem 0 1rem;display:flex;align-items:center;gap:8px;}' +
        '.nl-feed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-bottom:2rem;}' +
        '.nl-feed-card{border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;background:var(--bg-card);border:1px solid var(--border);}' +
        '.nl-feed-card:hover{transform:translateY(-3px);box-shadow:var(--ch);}' +
        '.nl-feed-card-img{width:100%;height:140px;object-fit:cover;display:block;}' +
        '.nl-feed-card-body{padding:1rem 1.05rem 1.1rem;}' +
        '.nl-feed-card-title{font-size:.92rem;font-weight:700;color:var(--t1);margin:0 0 .4rem;line-height:1.35;}' +
        '.nl-feed-card-excerpt{font-size:12px;color:var(--t3);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin:0;}' +
        '.nl-feed-readmore{margin-top:.75rem;display:flex;align-items:center;gap:4px;font-size:.75rem;color:var(--acc);font-weight:700;}';
    document.head.appendChild(style);
}

// ── View Tab ──────────────────────────────────────────────────
function nlRenderView() {
    var container = document.getElementById('nlViewContainer');
    if (!container) return;
    nlInjectNewsletterStyles();

    var general = nlItemsExcludingBirthdays(nlAllItems);
    if (general.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:80px;color:var(--t3);">' +
            '<div style="font-size:56px;margin-bottom:16px;">📰</div>' +
            '<div style="font-size:18px;font-weight:600;margin-bottom:8px;">No newsletters yet</div>' +
            '<div style="font-size:13px;">Birthday announcements are under the <strong>Birthdays</strong> tab.</div>' +
            '</div>';
        return;
    }

    var html = '';
    var latest = general[0];
    var rest = general.slice(1);

    html += nlBuildHeroCard(latest);

    if (rest.length > 0) {
        html += '<h3 class="nl-feed-section-title"><i data-lucide="clock" style="width:16px;height:16px;"></i>Previous Newsletters</h3>';
        html += '<div class="nl-feed-grid">';
        rest.forEach(function (item) { html += nlBuildCard(item); });
        html += '</div>';
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function nlBuildHeroCard(item) {
    var color = nlCategoryColor(item.Category);
    var imageURL = nlGetImageURL(item);
    var excerpt = nlDisplayContent(item);
    if (excerpt.length > 420) excerpt = excerpt.slice(0, 420) + '…';

    return '<article class="nl-feed-hero" data-nl-id="' + item.ID + '" onclick="nlOpenCard(' + item.ID + ')" role="button" tabindex="0">' +
        (imageURL ?
            '<img class="nl-feed-hero-img" src="' + NL_SP_HOST + imageURL + '" alt="" onerror="this.classList.add(\'nl-feed-hero-img-sm\');this.src=\'\';" />' :
            '<div class="nl-feed-hero-img nl-feed-hero-img-sm" style="background:var(--grad);display:flex;align-items:center;justify-content:center;">' +
            '<i data-lucide="newspaper" style="width:64px;height:64px;color:rgba(255,255,255,0.5);"></i></div>'
        ) +
        '<div class="nl-feed-hero-body">' +
        '<div class="nl-feed-meta">' +
        '<span class="nl-feed-badge" style="background:' + color + ';">' + nlEscapeHtml(item.Category || 'General') + '</span>' +
        '<span class="nl-feed-meta-text"><i data-lucide="calendar" style="width:13px;height:13px;"></i>' + nlFormatDate(item.PublishedDate) + '</span>' +
        '<span class="nl-feed-meta-text"><i data-lucide="users" style="width:13px;height:13px;"></i>' + nlEscapeHtml(nlDisplaySource(item)) + '</span>' +
        '</div>' +
        '<h2 class="nl-feed-hero-title">' + nlEscapeHtml(item.Title) + '</h2>' +
        '<p class="nl-feed-hero-excerpt">' + nlEscapeHtml(excerpt) + '</p>' +
        '<div class="nl-feed-readmore"><i data-lucide="maximize-2" style="width:13px;height:13px;"></i>Open full article</div>' +
        '</div></article>';
}

function nlBuildBirthdayCard(item) {
    var banner = nlBirthdayBannerUrl(item);
    var meta = nlBirthdayMetaFromItem(item);
    var pill = meta && meta.daysUntil === 0 ? 'Today 🎉' : (meta && meta.daysUntil === 1 ? 'Tomorrow' : (meta ? meta.daysUntil + ' days' : 'Birthday'));
    return '<div class="nl-bday-card" onclick="nlOpenCard(' + item.ID + ')">' +
        '<div class="nl-bday-card-hero">' +
        '<img src="' + banner + '" alt="" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<div class=nl-modal-hero-fallback>🎂</div>\';">' +
        '</div>' +
        '<div class="nl-bday-card-body">' +
        '<div class="nl-bday-countdown-pill">' + nlEscapeHtml(pill) + '</div>' +
        '<h3 class="nl-feed-card-title">' + nlEscapeHtml(item.Title || '') + '</h3>' +
        '<p class="nl-feed-card-excerpt">' + nlEscapeHtml(nlDisplayContent(item)) + '</p>' +
        '</div></div>';
}

function nlBuildCard(item) {
    if (item.Category === 'Birthdays' || nlIsBirthdayAutoItem(item)) {
        return nlBuildBirthdayCard(item);
    }
    var color = nlCategoryColor(item.Category);
    var imageURL = nlGetImageURL(item);

    return '<article class="nl-feed-card" onclick="nlOpenCard(' + item.ID + ')" role="button" tabindex="0">' +
        (imageURL ?
            '<img class="nl-feed-card-img" src="' + NL_SP_HOST + imageURL + '" alt="" onerror="this.style.display=\'none\'" />' :
            '<div class="nl-feed-card-img" style="height:80px;background:var(--grad);display:flex;align-items:center;justify-content:center;">' +
            '<i data-lucide="newspaper" style="width:28px;height:28px;color:rgba(255,255,255,0.6);"></i></div>'
        ) +
        '<div class="nl-feed-card-body">' +
        '<div class="nl-feed-meta" style="margin-bottom:.45rem;">' +
        '<span class="nl-feed-badge" style="background:' + color + ';font-size:10px;padding:2px 10px;">' + nlEscapeHtml(item.Category || 'General') + '</span>' +
        '<span class="nl-feed-meta-text" style="font-size:11px;">' + nlFormatDate(item.PublishedDate) + '</span>' +
        '</div>' +
        '<h3 class="nl-feed-card-title">' + nlEscapeHtml(item.Title) + '</h3>' +
        '<p class="nl-feed-card-excerpt">' + nlEscapeHtml(nlDisplayContent(item)) + '</p>' +
        '<div class="nl-feed-readmore"><i data-lucide="eye" style="width:13px;height:13px;"></i>Read more</div>' +
        '</div></article>';
}
function nlOpenModalShell(opts) {
    nlInjectNewsletterStyles();
    var overlay = document.createElement('div');
    overlay.id = opts.id || 'nlOverlay';
    overlay.className = 'nl-modal-backdrop';
    var banner = opts.bannerUrl || '';
    var heroInner = banner
        ? '<img src="' + banner + '" alt="" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<div class=nl-modal-hero-fallback>' + (opts.fallbackEmoji || '🎂') + '</div>\';">'
        : '<div class="nl-modal-hero-fallback">' + (opts.fallbackEmoji || '📰') + '</div>';
    overlay.innerHTML =
        '<div class="nl-modal-card" role="dialog" aria-modal="true">' +
        '<div class="nl-modal-hero">' + heroInner +
        '<button type="button" class="nl-modal-close" aria-label="Close">×</button></div>' +
        '<div class="nl-modal-body">' +
        (opts.pill ? '<div class="nl-bday-countdown-pill">' + nlEscapeHtml(opts.pill) + '</div>' : '') +
        '<div class="nl-modal-meta">' +
        '<span class="nl-modal-badge" style="background:' + (opts.badgeColor || '#8b5cf6') + ';">' + nlEscapeHtml(opts.badge || 'Newsletter') + '</span>' +
        '<span class="nl-modal-date"><i data-lucide="calendar" style="width:13px;height:13px;"></i> ' + nlEscapeHtml(opts.dateLabel || '') + '</span>' +
        (opts.sourceLabel ? '<span class="nl-modal-date"><i data-lucide="users" style="width:13px;height:13px;"></i> ' + nlEscapeHtml(opts.sourceLabel) + '</span>' : '') +
        '</div>' +
        '<h2 class="nl-modal-title">' + nlEscapeHtml(opts.title || '') + '</h2>' +
        '<p class="nl-modal-text">' + nlEscapeHtml(opts.body || '').replace(/\n/g, '<br>') + '</p>' +
        (opts.actionsHtml || '') +
        '</div></div>';
    overlay.querySelector('.nl-modal-close').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    if (typeof smMountPopup === 'function') smMountPopup(overlay);
    else document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return overlay;
}

window.nlOpenCard = function(itemId) {
    var item = nlAllItems.find(function(i) { return i.ID === itemId; });
    if (!item) return;
    nlMarkAsSeen(item.ID);
    nlRemoveNewBadge();

    var isBday = item.Category === 'Birthdays' || nlIsBirthdayAutoItem(item);
    var pill = '';
    if (isBday) {
        var todayYmd = nlUaeYmd(new Date());
        var meta = nlBirthdayMetaFromItem(item);
        var isTodayPost = meta && meta.eventYmd === todayYmd && meta.daysUntil === 0;
        if (isTodayPost) pill = 'Happy birthday today 🎉';
    }
    nlOpenModalShell({
        id: 'nlOverlay',
        bannerUrl: isBday ? nlBirthdayBannerUrl(item) : (nlGetImageURL(item) ? NL_SP_HOST + nlGetImageURL(item) : ''),
        fallbackEmoji: isBday ? '🎉' : '📰',
        pill: pill,
        badge: isBday ? 'Birthdays' : ((item.Category || 'General') + ' announcement'),
        badgeColor: nlCategoryColor(item.Category),
        dateLabel: nlFormatDate(item.PublishedDate),
        sourceLabel: nlDisplaySource(item),
        title: item.Title,
        body: nlDisplayContent(item),
        actionsHtml: '<div class="nl-modal-actions"><button type="button" class="reset-btn" id="nlOverlayCloseBtn" style="flex:1;">Close</button></div>'
    });
    var closeBtn = document.getElementById('nlOverlayCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            var ov = document.getElementById('nlOverlay');
            if (ov) ov.remove();
        });
    }
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
        '<option value="Birthdays">Birthdays</option>' +
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

// ── Birthdays (Account Mapping DOB → auto newsletter + daily popup) ──
function nlUaeYmd(dateObj) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: NL_BDAY_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(dateObj || new Date());
}

function nlParseYmd(ymd) {
    var p = String(ymd || '').split('-');
    return { y: parseInt(p[0], 10), m: parseInt(p[1], 10), d: parseInt(p[2], 10) };
}

function nlFormatYmdObj(o) {
    return o.y + '-' + String(o.m).padStart(2, '0') + '-' + String(o.d).padStart(2, '0');
}

function nlIsLeapYear(y) {
    return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

function nlDaysBetweenYmd(from, to) {
    var a = Date.UTC(from.y, from.m - 1, from.d);
    var b = Date.UTC(to.y, to.m - 1, to.d);
    return Math.round((b - a) / 86400000);
}

function nlParseDobField(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && isFinite(raw)) {
        if (raw > 20000 && raw < 80000) {
            var excel = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
            return nlDobFromDate(excel);
        }
        if (raw > 1e11) return nlDobFromDate(new Date(raw));
        return null;
    }
    if (typeof raw === 'object') {
        if (raw.getMonth && typeof raw.getMonth === 'function') return nlDobFromDate(raw);
        if (raw.Year && raw.Month && raw.Day) {
            return { y: raw.Year, m: raw.Month, d: raw.Day, mUtc: raw.Month, dUtc: raw.Day };
        }
        if (raw.EMail || raw.Title) return null;
        return nlParseDobField(String(raw));
    }
    var s = String(raw).trim();
    if (!s) return null;

    var spJson = s.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    if (spJson) {
        var dSp = new Date(parseInt(spJson[1], 10));
        if (!isNaN(dSp.getTime())) return nlDobFromDate(dSp);
    }

    var isoDateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnly) {
        return {
            y: parseInt(isoDateOnly[1], 10),
            m: parseInt(isoDateOnly[2], 10),
            d: parseInt(isoDateOnly[3], 10),
            mUtc: parseInt(isoDateOnly[2], 10),
            dUtc: parseInt(isoDateOnly[3], 10)
        };
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(s) || /Z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
        var dIso = new Date(s);
        if (!isNaN(dIso.getTime())) return nlDobFromDate(dIso);
    }

    var slash = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (slash) {
        var a = parseInt(slash[1], 10);
        var b = parseInt(slash[2], 10);
        var y = parseInt(slash[3], 10);
        if (y < 100) y += 1900;
        if (y < 1920) y += 100;
        var day = a > 12 ? a : a;
        var month = a > 12 ? b : (b > 12 ? a : b);
        if (a <= 12 && b <= 12) { day = a; month = b; }
        return { y: y, m: month, d: day, mUtc: month, dUtc: day };
    }

    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return nlDobFromDate(parsed);
    return null;
}

function nlDobFromDate(d) {
    if (!d || isNaN(d.getTime())) return null;
    var uae = nlParseYmd(nlUaeYmd(d));
    if (!uae.y || uae.y < 1920 || uae.y > 2100) return null;
    return {
        y: uae.y,
        m: uae.m,
        d: uae.d,
        mUtc: d.getUTCMonth() + 1,
        dUtc: d.getUTCDate()
    };
}

function nlRowDobRaw(row) {
    if (!row) return null;
    var preferred = ['DOB', 'Dob', 'DoB', 'Date_of_Birth', 'DateOfBirth', 'Date_x0020_of_x0020_Birth',
        'BirthDate', 'Birth_Date', 'Birthday', 'DateOfBirth0'];
    var i, k, kl, val;
    for (i = 0; i < preferred.length; i++) {
        val = row[preferred[i]];
        if (val != null && val !== '') return val;
    }
    for (k in row) {
        if (!Object.prototype.hasOwnProperty.call(row, k) || k === '__metadata') continue;
        kl = String(k).toLowerCase().replace(/_x0020_/g, '').replace(/_/g, '');
        if (kl === 'dob' || kl.indexOf('birth') >= 0 || kl.indexOf('dateofb') >= 0) {
            val = row[k];
            if (val != null && val !== '' && typeof val !== 'object') return val;
            if (val && (typeof val === 'string' || typeof val === 'number')) return val;
        }
    }
    return null;
}

function nlMappingRowEmail(row) {
    if (!row) return '';
    if (typeof row.Email_ID === 'object' && row.Email_ID) {
        return String(row.Email_ID.EMail || row.Email_ID.Email || '').trim();
    }
    return String(row.Email_ID || row.Email || '').trim();
}

function nlMappingRowName(row) {
    var sm = String((row && (row.Service_Manager_Name || row.Title)) || '').trim();
    if (sm) return sm;
    return nlNameFromEmail(nlMappingRowEmail(row));
}

function nlBirthdayPersonKey(p) {
    var em = String((p && p.email) || '').trim().toLowerCase();
    if (em && em.indexOf('@') > 0) return em;
    return String((p && p.name) || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function nlBirthdayDedupePeople(people) {
    var seen = {};
    var out = [];
    (people || []).forEach(function (p) {
        var key = nlBirthdayPersonKey(p);
        if (!key) return;
        if (seen[key]) return;
        seen[key] = true;
        out.push(p);
    });
    return out;
}

function nlBirthdayTitlePersonKey(title) {
    var t = String(title || '');
    var m = t.match(/Happy Birthday\s*[—–-]\s*(.+)$/i);
    if (!m) return t.trim().toLowerCase();
    return m[1].trim().toLowerCase();
}

function nlBirthdayDedupePostsForDisplay(posts) {
    var seen = {};
    var out = [];
    (posts || []).forEach(function (item) {
        var meta = nlBirthdayMetaFromItem(item);
        var key = (meta && meta.personKey) ? meta.personKey : nlBirthdayTitlePersonKey(item.Title);
        if (!key) {
            out.push(item);
            return;
        }
        if (seen[key]) return;
        seen[key] = true;
        out.push(item);
    });
    return out;
}

function nlNameFromEmail(email) {
    var em = String(email || '').trim().toLowerCase();
    if (em.indexOf('@') < 1) return '';
    return em.split('@')[0].split(/[._-]+/).filter(Boolean).map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
}

function nlNextBirthdayYmd(dob, todayYmd) {
    var t = nlParseYmd(todayYmd);
    var month = dob.m;
    var day = dob.d;
    var cand = { y: t.y, m: month, d: day };
    if (month === 2 && day === 29 && !nlIsLeapYear(cand.y)) cand.d = 28;
    if (nlDaysBetweenYmd(t, cand) < 0) {
        cand.y = t.y + 1;
        if (month === 2 && day === 29 && !nlIsLeapYear(cand.y)) cand.d = 28;
    }
    return nlFormatYmdObj(cand);
}

function nlFormatBirthdayLabel(ymd) {
    var o = nlParseYmd(ymd);
    var dt = new Date(Date.UTC(o.y, o.m - 1, o.d));
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function nlBirthdaySourceKey(eventYmd, daysUntil, personKey) {
    var base = NL_BDAY_SOURCE_PREFIX + 'event=' + eventYmd + '|days=' + daysUntil;
    if (personKey) base += '|key=' + personKey;
    return base;
}

function nlParseBirthdaySource(source) {
    var raw = String(source || '');
    if (raw.indexOf(NL_BDAY_SOURCE_PREFIX) < 0) {
        var inContent = raw.match(new RegExp(NL_BDAY_SOURCE_PREFIX.replace('|', '\\|') + '[^\\s>]+'));
        if (inContent) raw = inContent[0];
        else return null;
    }
    var ev = raw.match(/event=(\d{4}-\d{2}-\d{2})/);
    var dy = raw.match(/days=(\d+)/);
    var pk = raw.match(/key=([^|\s>]+)/);
    if (!ev) return null;
    return {
        eventYmd: ev[1],
        daysUntil: dy ? parseInt(dy[1], 10) : 0,
        personKey: pk ? decodeURIComponent(pk[1]) : ''
    };
}

async function nlGetDigest() {
    var digestRes = await fetch(SP_URL + '/_api/contextinfo', {
        method: 'POST',
        headers: { 'Accept': 'application/json;odata=verbose' },
        credentials: 'include'
    });
    if (!digestRes.ok) throw new Error('Failed to get digest');
    return (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;
}

function nlBirthdayDisplayName(row) {
    return nlMappingRowName(row);
}

async function nlBirthdayFetchMappingPeople() {
    var list = (typeof SP_MAPPING_LIST !== 'undefined' && SP_MAPPING_LIST) ? SP_MAPPING_LIST : NL_MAPPING_LIST;
    var people = [];
    var skippedNoDob = 0;
    var skippedStatus = 0;
    var parseFail = 0;
    var urls = [
        SP_URL + "/_api/web/lists/getbytitle('" + list.replace(/'/g, "''") + "')/items?" +
            "$select=Email_ID,Team,DOB,Status,Service_Manager_Name,Title&$top=5000",
        SP_URL + "/_api/web/lists/getbytitle('" + list.replace(/'/g, "''") + "')/items?$top=5000"
    ];
    var url = urls[0];
    var usedFallback = false;
    var sampleRaw = [];

    while (url) {
        var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
        if (!res.ok) {
            var errTxt = '';
            try { errTxt = (await res.text()).slice(0, 180); } catch (e) {}
            console.warn('[Birthday] Account Mapping fetch failed:', res.status, errTxt);
            if (!usedFallback && urls[1]) {
                usedFallback = true;
                url = urls[1];
                people = [];
                skippedNoDob = 0;
                skippedStatus = 0;
                parseFail = 0;
                continue;
            }
            break;
        }
        var data = await res.json();
        (data.d.results || []).forEach(function (row) {
            var status = String(row.Status || '').trim().toLowerCase();
            if (status === 'inactive' || status === 'disabled') {
                skippedStatus++;
                return;
            }

            var rawDob = nlRowDobRaw(row);
            if (rawDob == null || rawDob === '') {
                skippedNoDob++;
                return;
            }
            if (sampleRaw.length < 8) {
                sampleRaw.push({ name: nlMappingRowName(row), raw: String(rawDob).slice(0, 48) });
            }
            var dob = nlParseDobField(rawDob);
            if (!dob) {
                parseFail++;
                return;
            }

            var email = nlMappingRowEmail(row);
            var name = nlMappingRowName(row);
            if (!name && !email) return;
            if (!name) name = nlNameFromEmail(email) || email;

            people.push({
                name: name,
                email: email,
                team: row.Team || '',
                dob: dob
            });
        });
        url = data.d.__next || null;
    }

    people = nlBirthdayDedupePeople(people);
    window.nlBirthdayPeopleCache = people;
    var todayYmd = nlUaeYmd(new Date());
    var todayHits = nlBirthdayPeopleWithDobToday(people, todayYmd);
    console.log('[Birthday] Mapping loaded', people.length, 'with DOB | skipped empty', skippedNoDob,
        '| parse fail', parseFail, '| inactive skipped', skippedStatus,
        '| UAE today', todayYmd, '| matches today', todayHits.length,
        todayHits.map(function (p) { return p.name; }));
    if (!todayHits.length && sampleRaw.length) {
        console.log('[Birthday] Sample raw DOB values:', sampleRaw);
        console.log('[Birthday] Sample parsed:', people.slice(0, 8).map(function (p) {
            return p.name + ' → ' + p.dob.m + '/' + p.dob.d;
        }));
    }
    return people;
}

function nlBirthdayBuildSchedule(people, todayYmd) {
    var upcoming = [];
    people.forEach(function (p) {
        var eventYmd = nlNextBirthdayYmd(p.dob, todayYmd);
        var daysUntil = nlDaysBetweenYmd(nlParseYmd(todayYmd), nlParseYmd(eventYmd));
        if (daysUntil < 0 || daysUntil > 30) return;
        upcoming.push({
            name: p.name,
            team: p.team,
            eventYmd: eventYmd,
            daysUntil: daysUntil,
            label: nlFormatBirthdayLabel(eventYmd)
        });
    });
    upcoming.sort(function (a, b) { return a.daysUntil - b.daysUntil || a.name.localeCompare(b.name); });
    return { upcoming: upcoming };
}

function nlBirthdayNamesList(names) {
    var n = (names || []).slice();
    if (n.length === 0) return '';
    if (n.length === 1) return n[0];
    if (n.length === 2) return n[0] + ' & ' + n[1];
    return n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1];
}

function nlBirthdayPostCopy(bucket) {
    var names = nlBirthdayNamesList(bucket.names);
    var when = nlFormatBirthdayLabel(bucket.eventYmd);
    var personKey = bucket.personKey || (bucket.people && bucket.people[0] ? nlBirthdayPersonKey(bucket.people[0]) : '');
    var sourceKey = nlBirthdaySourceKey(bucket.eventYmd, bucket.daysUntil, personKey);
    if (bucket.daysUntil === 0) {
        return {
            title: 'Happy Birthday — ' + names,
            content: 'Happy Birthday to ' + names + '!\n\nWishing you a wonderful day filled with joy and success.\n\n— ' + NL_BDAY_DISPLAY_SOURCE + '\n\n<!-- ' + sourceKey + ' -->',
            imagePath: NL_BDAY_IMAGE_TODAY,
            sourceKey: sourceKey
        };
    }
    var dayWord = bucket.daysUntil === 1 ? '1 day' : bucket.daysUntil + ' days';
    return {
        title: 'Birthday in ' + dayWord + ' — ' + names,
        content: 'Upcoming birthday: ' + names + (bucket.names.length > 1 ? ' celebrate' : ' celebrates') + ' on ' + when + ' (' + dayWord + ' to go).\n\nJoin us in wishing them an early happy birthday!\n\n— ' + NL_BDAY_DISPLAY_SOURCE + '\n\n<!-- ' + sourceKey + ' -->',
        imagePath: NL_BDAY_IMAGE_COUNTDOWN,
        sourceKey: sourceKey
    };
}

async function nlBirthdayAttachImage(itemId, digest, serverRelativePath, fileName) {
    try {
        var fetchUrl = 'http://sharedspaces:8086' + serverRelativePath.replace(/ /g, '%20');
        var imgRes = await fetch(fetchUrl, { credentials: 'include' });
        if (!imgRes.ok) return;
        var buf = await imgRes.arrayBuffer();
        await fetch(
            SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items(" + itemId + ")/AttachmentFiles/add(FileName='" + fileName.replace(/'/g, "''") + "')",
            {
                method: 'POST',
                headers: { 'Accept': 'application/json;odata=verbose', 'X-RequestDigest': digest },
                credentials: 'include',
                body: buf
            }
        );
    } catch (e) {
        console.warn('[Newsletter] Birthday image attach skipped:', e.message);
    }
}

var _nlListItemType = '';
async function nlNewsletterEntityType() {
    if (_nlListItemType) return _nlListItemType;
    try {
        var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')?$select=ListItemEntityTypeFullName", {
            headers: { Accept: 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (res.ok) {
            var d = await res.json();
            _nlListItemType = d.d && d.d.ListItemEntityTypeFullName;
        }
    } catch (e) {}
    if (!_nlListItemType) _nlListItemType = 'SP.Data.NewsletterListItem';
    return _nlListItemType;
}

async function nlBirthdayFindAutoItem(sourceKey) {
    var safe = sourceKey.replace(/'/g, "''");
    var url = SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items?" +
        "$select=ID,Title,Source,Content,Category&$filter=Category eq 'Birthdays'&$top=200";
    var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) return null;
    var rows = (await res.json()).d.results || [];
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].Source === sourceKey) return rows[i];
        if (String(rows[i].Content || '').indexOf(sourceKey) >= 0) return rows[i];
    }
    var legacyUrl = SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items?" +
        "$select=ID,Title,Source,Content,Category&$filter=Source eq '" + safe + "'&$top=1";
    var legacyRes = await fetch(legacyUrl, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (legacyRes.ok) {
        var leg = (await legacyRes.json()).d.results;
        if (leg && leg[0]) return leg[0];
    }
    return null;
}

async function nlBirthdayUpsertPost(digest, bucket) {
    var personKey = bucket.personKey || (bucket.people && bucket.people[0] ? nlBirthdayPersonKey(bucket.people[0]) : '');
    var sourceKey = nlBirthdaySourceKey(bucket.eventYmd, bucket.daysUntil, personKey);
    var copy = nlBirthdayPostCopy(bucket);
    var existing = await nlBirthdayFindAutoItem(sourceKey);
    var body = {
        __metadata: { type: await nlNewsletterEntityType() },
        Title: copy.title,
        Content: copy.content,
        Category: 'Birthdays',
        Source: sourceKey,
        IsActive: true,
        PublishedDate: new Date().toISOString()
    };
    if (existing && existing.ID) {
        var mergeRes = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items(" + existing.ID + ")", {
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digest,
                'IF-MATCH': '*',
                'X-HTTP-Method': 'MERGE'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        if (!mergeRes.ok) console.warn('[Birthday] Update failed:', (await mergeRes.text()).slice(0, 200));
        return existing.ID;
    }
    var createRes = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items", {
        method: 'POST',
        headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest
        },
        credentials: 'include',
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        var failTxt = (await createRes.text()).slice(0, 300);
        console.warn('[Birthday] Post failed (Birthdays/Source). Retrying minimal fields:', failTxt);
        var minimal = {
            __metadata: body.__metadata,
            Title: copy.title,
            Content: copy.content,
            IsActive: true
        };
        createRes = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items", {
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digest
            },
            credentials: 'include',
            body: JSON.stringify(minimal)
        });
        if (!createRes.ok) {
            console.warn('[Birthday] Post failed:', (await createRes.text()).slice(0, 300));
            return null;
        }
    }
    var created = await createRes.json();
    var newId = created.d && created.d.ID;
    if (newId && copy.imagePath) {
        var fname = bucket.daysUntil === 0 ? 'birthday-happy.jpg' : 'birthday-countdown.jpg';
        await nlBirthdayAttachImage(newId, digest, copy.imagePath, fname);
    }
    return newId;
}

async function nlBirthdayDeleteItem(itemId, digest) {
    await fetch(SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items(" + itemId + ")", {
        method: 'POST',
        headers: {
            'Accept': 'application/json;odata=verbose',
            'X-RequestDigest': digest,
            'IF-MATCH': '*',
            'X-HTTP-Method': 'DELETE'
        },
        credentials: 'include'
    });
}

async function nlBirthdayCleanupExpired(digest, todayYmd) {
    var url = SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items?" +
        "$select=ID,Source,Content,Category,Title&$filter=Category eq 'Birthdays'&$top=500";
    var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) return;
    var rows = (await res.json()).d.results || [];
    var today = nlParseYmd(todayYmd);
    for (var i = 0; i < rows.length; i++) {
        var meta = nlBirthdayMetaFromItem(rows[i]);
        if (meta) {
            if (meta.daysUntil > 0) {
                try { await nlBirthdayDeleteItem(rows[i].ID, digest); } catch (e) {}
                continue;
            }
            var ev = nlParseYmd(meta.eventYmd);
            if (nlDaysBetweenYmd(ev, today) >= 1) {
                try { await nlBirthdayDeleteItem(rows[i].ID, digest); } catch (e) {}
            }
            continue;
        }
        var titleKey = nlBirthdayTitlePersonKey(rows[i].Title);
        if (titleKey && String(rows[i].Title || '').toLowerCase().indexOf('birthday in') >= 0) {
            try { await nlBirthdayDeleteItem(rows[i].ID, digest); } catch (e) {}
        }
    }
    await nlBirthdayDeduplicateTodayPosts(digest, todayYmd);
}

async function nlBirthdayDeduplicateTodayPosts(digest, todayYmd) {
    var url = SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items?" +
        "$select=ID,Title,Content,Source,PublishedDate&$filter=Category eq 'Birthdays'&$orderby=PublishedDate desc&$top=200";
    var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) return;
    var rows = (await res.json()).d.results || [];
    var keepByKey = {};
    for (var i = 0; i < rows.length; i++) {
        var meta = nlBirthdayMetaFromItem(rows[i]);
        var title = String(rows[i].Title || '');
        var isTodayPost = (meta && meta.eventYmd === todayYmd && meta.daysUntil === 0) ||
            (!meta && /^Happy Birthday\s*[—–-]/i.test(title));
        if (!isTodayPost) continue;
        var key = (meta && meta.personKey) ? meta.personKey : nlBirthdayTitlePersonKey(title);
        if (!key) continue;
        if (keepByKey[key]) {
            try { await nlBirthdayDeleteItem(rows[i].ID, digest); } catch (e) {}
        } else {
            keepByKey[key] = rows[i].ID;
        }
    }
}

function nlBirthdayPopupShownToday(todayYmd) {
    try { return localStorage.getItem('sm_nl_bday_popup_' + todayYmd) === '1'; } catch (e) { return false; }
}

function nlBirthdayMarkPopupShown(todayYmd) {
    try { localStorage.setItem('sm_nl_bday_popup_' + todayYmd, '1'); } catch (e) {}
}

function nlBirthdayClosePopupAndMark(overlay, todayYmd) {
    if (overlay) overlay.remove();
    if (todayYmd) nlBirthdayMarkPopupShown(todayYmd);
}

function nlShowBirthdayDailyPopup(payload) {
    if (!payload || payload.isToday !== true) return;
    var todayYmd = payload.todayYmd || nlUaeYmd(new Date());
    var existing = document.getElementById('nlBirthdayPopup');
    if (existing) existing.remove();
    var wishBtn = '';
    if (payload.isToday && payload.mailto) {
        wishBtn = '<a id="nlBdayPopupWishBtn" href="' + payload.mailto + '" class="export-btn" style="flex:1;min-width:140px;text-align:center;text-decoration:none;">Send wish</a>';
    }
    var actionsHtml =
        '<div class="nl-modal-actions">' +
        wishBtn +
        '<button type="button" id="nlBdayPopupViewBtn" class="export-btn" style="flex:1;min-width:140px;">View in Birthdays</button>' +
        '<button type="button" id="nlBdayPopupOkBtn" class="reset-btn" style="flex:1;min-width:100px;">Close</button>' +
        '</div>';
    var overlay = nlOpenModalShell({
        id: 'nlBirthdayPopup',
        bannerUrl: payload.bannerUrl,
        fallbackEmoji: payload.isToday ? '🎉' : '🎂',
        pill: payload.pill || '',
        badge: 'Birthdays',
        badgeColor: '#ec4899',
        dateLabel: payload.dateLabel || nlUaeYmd(new Date()),
        sourceLabel: NL_BDAY_DISPLAY_SOURCE,
        title: payload.title,
        body: payload.message,
        actionsHtml: actionsHtml
    });
    document.getElementById('nlBdayPopupViewBtn').addEventListener('click', function () {
        nlBirthdayClosePopupAndMark(overlay, todayYmd);
        nlCurrentTab = 'birthdays';
        if (typeof switchDashboardSection === 'function') switchDashboardSection('newsletterView');
        else if (typeof showNewsletterView === 'function') showNewsletterView();
        setTimeout(function () {
            if (typeof nlSetTab === 'function') nlSetTab('birthdays');
            else if (typeof nlLoadNewsletter === 'function') nlLoadNewsletter();
        }, 150);
    });
    document.getElementById('nlBdayPopupOkBtn').addEventListener('click', function () {
        nlBirthdayClosePopupAndMark(overlay, todayYmd);
    });
    var wishEl = document.getElementById('nlBdayPopupWishBtn');
    if (wishEl) {
        wishEl.addEventListener('click', function () {
            nlBirthdayMarkPopupShown(todayYmd);
        });
    }
    var xBtn = overlay.querySelector('.nl-modal-close');
    if (xBtn) {
        xBtn.addEventListener('click', function () {
            nlBirthdayMarkPopupShown(todayYmd);
        }, true);
    }
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) nlBirthdayMarkPopupShown(todayYmd);
    }, true);
}

function nlBirthdayBuildWishMailto(peopleToday) {
    if (!peopleToday || !peopleToday.length) return '';
    var p = peopleToday[0];
    var email = (p.email || '').trim();
    if (!email || email.indexOf('@') < 1) return '';
    var imgUrl = NL_SP_HOST + NL_BDAY_IMAGE_TODAY.replace(/ /g, '%20');
    var subj = encodeURIComponent('Happy Birthday, ' + (p.name || '') + '! 🎉');
    var body = encodeURIComponent(
        'Dear ' + (p.name || 'Colleague') + ',\n\n' +
        'Happy Birthday! 🎂\n\n' +
        'Wishing you a wonderful day filled with joy and success.\n\n' +
        'Warm regards,\n' + ((window.USER_CONTEXT && USER_CONTEXT.userName) || 'Your du family') + '\n\n' +
        '---\n' + imgUrl
    );
    return 'mailto:' + email + '?subject=' + subj + '&body=' + body;
}

/** True when DOB month/day matches today (UAE), also accepting UTC calendar day for SharePoint date-only off-by-one. */
function nlBirthdayPeopleWithDobToday(people, todayYmd) {
    var t = nlParseYmd(todayYmd);
    var list = [];
    (people || []).forEach(function (p) {
        if (!p.dob) return;
        var hit = (p.dob.m === t.m && p.dob.d === t.d) ||
            (p.dob.mUtc && p.dob.mUtc === t.m && p.dob.dUtc === t.d);
        if (hit) {
            list.push({ name: p.name, email: p.email || '', team: p.team || '' });
        }
    });
    return list;
}

/**
 * Dashboard birthday popup — ONLY when someone has a birthday today.
 * Wired from: SM.txt switchDashboardSection('dashboard-view') → nlCheckOnDashboard → nlBirthdayMaybeShowPopup
 */
function nlBirthdayMaybeShowPopupFromPeople(people, todayYmd) {
    todayYmd = todayYmd || nlUaeYmd(new Date());
    if (nlBirthdayPopupShownToday(todayYmd)) {
        console.log('[Birthday] Popup already dismissed for', todayYmd, '(clear localStorage sm_nl_bday_popup_' + todayYmd + ' to retest)');
        return;
    }

    var todayPeople = nlBirthdayDedupePeople(nlBirthdayPeopleWithDobToday(people, todayYmd));
    if (!todayPeople.length) {
        console.log('[Birthday] No birthdays today (UAE). People with DOB in mapping:', (people || []).length);
        return;
    }
    var popupPayload = nlBirthdayPopupPayloadForToday(todayPeople, todayYmd);
    if (!popupPayload) return;
    console.log('[Birthday] Showing dashboard popup for:', todayPeople.map(function (p) { return p.name; }).join(', '));
    nlShowBirthdayDailyPopup(popupPayload);
}

function nlBirthdayPopupPayloadForToday(todayPeople, todayYmd) {
    if (!todayPeople || !todayPeople.length) return null;
    var names = todayPeople.map(function (p) { return p.name; });
    return {
        isToday: true,
        todayYmd: todayYmd,
        bannerUrl: NL_SP_HOST + NL_BDAY_IMAGE_TODAY.replace(/ /g, '%20'),
        pill: 'Happy birthday today 🎉',
        dateLabel: nlFormatBirthdayLabel(todayYmd),
        title: 'Happy Birthday!',
        message: 'Today we celebrate ' + nlBirthdayNamesList(names) + '!\n\nUse Send wish to email them, or open Birthdays in the newsletter.',
        mailto: nlBirthdayBuildWishMailto(todayPeople)
    };
}

async function nlBirthdayRefreshUpcoming(people, todayYmd) {
    todayYmd = todayYmd || nlUaeYmd(new Date());
    if (!people) people = await nlBirthdayFetchMappingPeople();
    nlBirthdayUpcoming = nlBirthdayBuildSchedule(people, todayYmd).upcoming;
    return nlBirthdayUpcoming;
}

var _nlBirthdayDailyPromise = null;

async function nlBirthdayRunDaily(peopleOptional) {
    if (_nlBirthdayDailyPromise) return _nlBirthdayDailyPromise;
    _nlBirthdayDailyPromise = (async function () {
    var todayYmd = nlUaeYmd(new Date());
    var people = peopleOptional || await nlBirthdayFetchMappingPeople();
    people = nlBirthdayDedupePeople(people);
    await nlBirthdayRefreshUpcoming(people, todayYmd);
    var todayPeople = nlBirthdayDedupePeople(nlBirthdayPeopleWithDobToday(people, todayYmd));

    try {
        var digest = await nlGetDigest();
        await nlBirthdayCleanupExpired(digest, todayYmd);
        for (var i = 0; i < todayPeople.length; i++) {
            var bucket = {
                eventYmd: todayYmd,
                daysUntil: 0,
                names: [todayPeople[i].name],
                people: [todayPeople[i]],
                personKey: nlBirthdayPersonKey(todayPeople[i])
            };
            await nlBirthdayUpsertPost(digest, bucket);
        }
        if (todayPeople.length) {
            console.log('[Birthday] Newsletter post(s) synced for today:', todayPeople.map(function (p) { return p.name; }).join(', '));
        }
    } catch (e) {
        console.warn('[Newsletter] Birthday sync skipped:', e.message);
    }
    return { people: people, todayYmd: todayYmd, todayPeople: todayPeople };
    })();
    try {
        return await _nlBirthdayDailyPromise;
    } finally {
        _nlBirthdayDailyPromise = null;
    }
}

async function nlRefreshBirthdayPostsInCache() {
    var url = SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items?" +
        "$select=ID,Title,Content,Category,IsActive,PublishedDate,Source&$filter=IsActive eq 1 and Category eq 'Birthdays'&$orderby=PublishedDate desc&$top=30";
    var res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) return;
    var rows = (await res.json()).d.results || [];
    var rest = (nlAllItems || []).filter(function (i) { return i.Category !== 'Birthdays' && !nlIsBirthdayAutoItem(i); });
    nlAllItems = rows.concat(rest);
}

async function nlRenderBirthdaysTab() {
    var container = document.getElementById('nlViewContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t2);">Loading birthdays...</div>';
    var todayYmd = nlUaeYmd(new Date());
    var people = await nlBirthdayFetchMappingPeople();
    nlBirthdayUpcoming = nlBirthdayBuildSchedule(people, todayYmd).upcoming;
    try {
        await nlBirthdayRunDaily(people);
        await nlRefreshBirthdayPostsInCache();
    } catch (e) {
        console.warn('[Birthday] Tab sync:', e.message);
    }
    var posts = nlBirthdayDedupePostsForDisplay(nlBirthdayItems(nlAllItems));
    var html = '<div class="table-section" style="margin-bottom:1.5rem;">' +
        '<h3 class="table-title" style="margin-bottom:1rem;display:flex;align-items:center;gap:8px;">' +
        '<i data-lucide="cake" style="width:18px;height:18px;"></i>Upcoming birthdays <span style="font-size:12px;font-weight:600;color:var(--t3);">(UAE time)</span></h3>';
    var soon = nlBirthdayUpcoming.filter(function (u) { return u.daysUntil <= 14; });
    if (!soon.length) {
        html += '<p style="color:var(--t3);font-size:13px;margin:0;">No upcoming birthdays in the next 14 days (with DOB in Account Mapping).</p>';
    } else {
        html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>' +
            '<th style="text-align:left;padding:.5rem .75rem;font-size:.7rem;text-transform:uppercase;color:var(--t3);">Name</th>' +
            '<th style="text-align:left;padding:.5rem .75rem;font-size:.7rem;text-transform:uppercase;color:var(--t3);">Team</th>' +
            '<th style="text-align:left;padding:.5rem .75rem;font-size:.7rem;text-transform:uppercase;color:var(--t3);">Date</th>' +
            '<th style="text-align:left;padding:.5rem .75rem;font-size:.7rem;text-transform:uppercase;color:var(--t3);">In</th></tr></thead><tbody>';
        soon.forEach(function (u) {
            var inLabel = u.daysUntil === 0 ? 'Today 🎉' : (u.daysUntil === 1 ? '1 day' : u.daysUntil + ' days');
            html += '<tr><td style="padding:.55rem .75rem;border-bottom:1px solid var(--border);font-weight:600;color:var(--t1);">' + u.name + '</td>' +
                '<td style="padding:.55rem .75rem;border-bottom:1px solid var(--border);color:var(--t3);">' + (u.team || '—') + '</td>' +
                '<td style="padding:.55rem .75rem;border-bottom:1px solid var(--border);color:var(--t3);">' + u.label + '</td>' +
                '<td style="padding:.55rem .75rem;border-bottom:1px solid var(--border);color:var(--acc);font-weight:700;">' + inLabel + '</td></tr>';
        });
        html += '</tbody></table></div>';
    }
    html += '</div>';

    html += '<h3 style="font-size:.95rem;font-weight:800;color:var(--t1);margin:0 0 1rem;display:flex;align-items:center;gap:8px;">' +
        '<i data-lucide="party-popper" style="width:16px;height:16px;"></i>Birthday announcements</h3>';
    if (!posts.length) {
        html += '<p style="color:var(--t3);font-size:13px;">No active birthday posts yet. A post is created on each person\'s birthday (from Account Mapping DOB).</p>';
    } else {
        nlInjectNewsletterStyles();
        html += '<div class="nl-bday-card-grid">';
        posts.forEach(function (item) { html += nlBuildBirthdayCard(item); });
        html += '</div>';
    }
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Birthday on load + dashboard ───────────────────────────────
window.nlBirthdayCheckAndMaybePopup = async function () {
    try {
        var result = await nlBirthdayRunDaily();
        if (result && result.people) {
            nlBirthdayMaybeShowPopupFromPeople(result.people, result.todayYmd);
        }
        return result;
    } catch (e) {
        console.warn('[Newsletter] Birthday daily run:', e);
        return null;
    }
};

window.nlCheckOnDashboard = async function () {
    await window.nlBirthdayCheckAndMaybePopup();
    try {
        var url = SP_URL + "/_api/web/lists/getbytitle('" + NL_LIST + "')/items?" +
            "$select=ID,Title,Content,PublishedDate,Category,Source&$filter=IsActive eq 1&$orderby=PublishedDate desc&$top=20";
        var res = await fetch(url, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        if (!res.ok) return;
        var data = await res.json();
        var items = data.d.results || [];
        var general = nlItemsExcludingBirthdays(items);
        if (general.length > 0) {
            var isNew = nlCheckNewBadge(general);
            if (isNew) nlShowNewItemPopup(general[0]);
        }
    } catch (e) {}
};

window.nlCheckOnLoad = async function () {
    await window.nlBirthdayCheckAndMaybePopup();
};

window.nlBirthdayDebug = async function () {
    try {
        localStorage.removeItem('sm_nl_bday_popup_' + nlUaeYmd(new Date()));
    } catch (e) {}
    var people = await nlBirthdayFetchMappingPeople();
    var todayYmd = nlUaeYmd(new Date());
    var today = nlBirthdayPeopleWithDobToday(people, todayYmd);
    console.log('[Birthday] DEBUG today UAE', todayYmd, 'hits', today);
    return { people: people.length, todayYmd: todayYmd, today: today };
};
