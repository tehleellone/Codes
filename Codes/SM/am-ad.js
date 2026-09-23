// ============================================================
// am-ad.js — Account Manager / Account Director Module
// Depends on: SP_URL, SP_LIST, USER_CONTEXT, ALL_DATA (from main)
// ============================================================

// AM/AD globals
var AM_DATA = [];
var amCharts = {};
var amGridApi = null;
var amRequestsGridApi = null;
var AM_MY_REQUESTS = [];

(function() {
    function inject() {
        var body = document.body;
        var d = document.createElement('div');
        d.innerHTML = `<div class="dashboard" style="display:none;" id="amAdDashboard">
        <!-- Header same as admin but with Create Request button -->
        <div class="header">
            <div class="header-left">
                <h1><img src="http://sharedspaces:8086/sites/SM/Shared%20Documents/DUlogo%202026.png" alt="du Logo" style="width: 28px; height: 28px; object-fit: contain; vertical-align: middle; margin-right: 10px;">
                    My Accounts</h1>
                <p>Personal Revenue Analytics & Account Management</p>
            </div>
            <div class="header-actions">
                <button type="button" class="export-btn" onclick="showCreateRequestForm()">
                    <i data-lucide="plus" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Create New Request
                </button>
                <button type="button" class="export-btn" onclick="showAMMyRequests()" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
                    <i data-lucide="file-clock" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>My Requests
                    <span id="amPendingBadge" style="display:none;margin-left:8px;background:#ef4444;color:#fff;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;">0</span>
                </button>
                <button type="button" class="export-btn" onclick="showAMTransferRequests()" style="background: linear-gradient(135deg, #f97316, #ea580c);">
                    <i data-lucide="repeat" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Pending Transfer Requests
                </button>

                <div class="date-badge">
                    <i data-lucide="calendar" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i><span id="amCurrentDate">Loading...</span>
                </div>
                <select class="color-scheme-selector" id="amColorSchemeSelector" onchange="changeTheme(event)">
                    <option value="magenta">Magenta Theme</option>
                    <option value="duralux">Duralux Theme</option>
                </select>
                <div class="theme-toggle" onclick="toggleTheme()">
                    <i data-lucide="moon" id="amThemeIcon"></i>
                </div>

            </div>
        </div>
        <div id="amLoading" style="text-align:center; padding:60px; font-size:18px;">
            <i data-lucide="loader" style="width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px; animation: spin 1s linear infinite;"></i> Loading your accounts...
        </div>

        <div id="amContent" style="display:none;">
            <!-- 4 Stats Tiles -->
            <div class="top-stats" style="grid-template-columns: repeat(5, 1fr);">
                <div class="stat-card">
                    <div class="stat-label">Last Month Revenue</div>
                    <div class="stat-value" id="amLastMonthRev">0</div>
                    <div class="stat-subtitle">December 2025</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Average Revenue</div>
                    <div class="stat-value" id="amAvgRev">0</div>
                    <div class="stat-subtitle">3-Month Average</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Group Accounts</div>
                    <div class="stat-value" id="amGroupCount">0</div>
                    <div class="stat-subtitle">Parent Accounts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Child Accounts</div>
                    <div class="stat-value" id="amChildCount">0</div>
                    <div class="stat-subtitle">Sub Accounts</div>
                </div>
                <div class="stat-card" style="cursor:pointer;" onclick="showAMMyRequests()" title="View pending account requests">
                    <div class="stat-label">Pending Requests</div>
                    <div class="stat-value" id="amPendingCount">0</div>
                    <div class="stat-subtitle">Awaiting Approval</div>
                </div>
            </div>

            <!-- Performance Chart -->
            <div class="charts-section" style="grid-template-columns: 1fr 1fr;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="trending-up" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>3-Month Revenue Trend</h3>
                    <div class="chart-container">
                        <canvas id="amRevenueChart"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="pie-chart" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Account Type Distribution</h3>
                    <div class="chart-container">
                        <canvas id="amTypeChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Accounts Table -->
            <div class="table-section">
                <div class="table-header">
                    <h3 class="table-title"><i data-lucide="clipboard-list" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;"></i>My Accounts</h3>
                    <div class="table-actions">
                        <button type="button" class="export-btn" onclick="exportAMData()"><i data-lucide="file-spreadsheet" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Extract to Excel</button>
                        <input type="text" class="search-box" id="amSearchBox" placeholder="Search all columns..." oninput="searchAMGrid(this.value)">
                    </div>
                </div>
                <div id="amGrid" class="ag-theme-alpine" style="height: 600px; width: 100%;"></div>
            </div>
        </div>
    </div>
<div class="dashboard" style="display:none;" id="amTransferRequestsView">
        <div class="header">
            <div class="header-left">
                <h1><i data-lucide="repeat" style="width: 28px; height: 28px; display: inline-block; vertical-align: middle; margin-right: 10px;"></i>Account Transfer Requests</h1>
                <p>Review and approve transfer requests</p>
            </div>
            <div class="header-actions">
                <button type="button" class="theme-btn" onclick="backToAMDashboard2()" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 10px 20px; border-radius: 12px; border: none; cursor: pointer; font-weight: 600;">
                    <i data-lucide="arrow-left" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Back to Dashboard
                </button>
            </div>
        </div>

        <div id="amTransferLoading" style="text-align:center; padding:60px; font-size:18px;">
            <i data-lucide="loader" style="width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px; animation: spin 1s linear infinite;"></i> Loading transfer requests...
        </div>

        <div id="amTransferContent" style="display:none;">
            <div class="table-section">
                <div class="table-header">
                    <h3 class="table-title">Pending Transfer Requests</h3>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Account Code</th>
                                <th>Customer</th>
                                <th>Current Team</th>
                                <th>Proposed Team</th>
                                <th>Dec Revenue</th>
                                <th>Requested By</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="amTransferTbody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
<div class="dashboard" style="display:none;" id="amMyRequestsView">
        <div class="header">
            <div class="header-left">
                <h1><i data-lucide="file-clock" style="width: 28px; height: 28px; display: inline-block; vertical-align: middle; margin-right: 10px;"></i>My Account Requests</h1>
                <p>Track your submitted requests and approval status</p>
            </div>
            <div class="header-actions">
                <button type="button" class="export-btn" onclick="loadAMMyRequests()" style="padding:10px 16px;">
                    <i data-lucide="refresh-cw" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Refresh
                </button>
                <button type="button" class="theme-btn" onclick="backToAMDashboardFromRequests()" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 10px 20px; border-radius: 12px; border: none; cursor: pointer; font-weight: 600;">
                    <i data-lucide="arrow-left" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Back to Dashboard
                </button>
            </div>
        </div>

        <div id="amRequestsLoading" style="text-align:center; padding:60px; font-size:18px;">
            <i data-lucide="loader" style="width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px; animation: spin 1s linear infinite;"></i> Loading your requests...
        </div>

        <div id="amRequestsContent" style="display:none;">
            <div class="table-section">
                <div class="table-header">
                    <h3 class="table-title">Request Tracker</h3>
                    <div class="table-actions">
                        <input type="text" class="search-box" id="amRequestSearchBox" placeholder="Search requests..." oninput="searchAMRequests()">
                    </div>
                </div>
                <div id="amRequestsGrid" class="ag-theme-alpine" style="height: 600px; width: 100%;"></div>
            </div>
        </div>
    </div>
<div class="dashboard" style="display:none;" id="amRequestDetailView">
        <div class="header">
            <div class="header-left">
                <h1><i data-lucide="eye" style="width: 28px; height: 28px; display: inline-block; vertical-align: middle; margin-right: 10px;"></i>Request Details</h1>
                <p>Read-only view of your submitted request</p>
            </div>
            <div class="header-actions">
                <button type="button" class="theme-btn" onclick="showAMMyRequests()" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 10px 20px; border-radius: 12px; border: none; cursor: pointer; font-weight: 600;">
                    <i data-lucide="arrow-left" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Back to Tracker
                </button>
            </div>
        </div>
        <div style="max-width: 900px; margin: 0 auto;">
            <div class="table-section">
                <div id="amRequestDetailContent"></div>
                <div id="amRequestDetailActions" style="display:flex;gap:16px;margin-top:24px;"></div>
            </div>
        </div>
    </div>
<div class="dashboard" style="display:none;" id="createRequestView">
        <div class="header">
            <div class="header-left">
                <h1><i data-lucide="plus-circle" style="width: 28px; height: 28px; display: inline-block; vertical-align: middle; margin-right: 10px;"></i>Create New Account Request</h1>
                <p>Submit new account information to SharePoint</p>
            </div>
            <div class="header-actions">
                <button type="button" class="theme-btn" onclick="backToAMDashboard()" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 10px 20px; border-radius: 12px; border: none; cursor: pointer; font-weight: 600;">
                    <i data-lucide="arrow-left" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Back to Dashboard
                </button>
            </div>
        </div>

        <div style="max-width: 900px; margin: 0 auto;">
            <!-- Form Section -->
            <div class="table-section" id="requestFormSection">
                <h3 class="table-title" style="margin-bottom: 24px;"><i data-lucide="file-text" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Account Information</h3>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                    <div class="filter-group">
                        <label class="filter-label">Account Code *</label>
                        <input type="text" class="filter-select" id="reqAccountCode" placeholder="e.g., 1.0129012" style="cursor: text; font-size: 14px; padding: 12px 16px;" oninput="updateL10OnAccountCodeChange()">
                    </div>

                    <div class="filter-group">
                        <label class="filter-label">Group Account *</label>
                        <select class="filter-select" id="reqGroupAccount" onchange="toggleL10Field()" style="font-size: 14px; padding: 12px 16px;">
                            <option value="No" selected>No</option>
                            <option value="Yes">Yes</option>
                        </select>
                    </div>

                    <div class="filter-group" id="l10Field" style="display: block; grid-column: 1 / -1;">
                        <label class="filter-label">L-10 (Payment Responsible Account) *</label>
                        <input type="text" class="filter-select" id="reqParentCode" placeholder="e.g., 1.0129012" style="cursor: text; font-size: 14px; padding: 12px 16px;">
                    </div>

                    <div class="filter-group">
                        <label class="filter-label">Customer Name *</label>
                        <input type="text" class="filter-select" id="reqCustomerName" placeholder="Enter customer name" style="cursor: text; font-size: 14px; padding: 12px 16px;">
                    </div>

                    <div class="filter-group">
                        <label class="filter-label">POC Name *</label>
                        <input type="text" class="filter-select" id="reqPOCName" placeholder="Enter POC name" style="cursor: text; font-size: 14px; padding: 12px 16px;">
                    </div>

                    <div class="filter-group">
                        <label class="filter-label">POC Email *</label>
                        <input type="email" class="filter-select" id="reqPOCEmail" placeholder="Enter POC email" style="cursor: text; font-size: 14px; padding: 12px 16px;">
                    </div>

                    <div class="filter-group">
                        <label class="filter-label">POC Contact *</label>
                        <input type="text" class="filter-select" id="reqPOCContact" placeholder="+971501234567" value="+971" maxlength="13" oninput="formatPhoneNumber(this)" style="cursor: text; font-size: 14px; padding: 12px 16px;">
                    </div>

                    <div class="filter-group">
                        <label class="filter-label">Account Director *</label>
                        <div id="reqADWrap">
                            <input type="text" class="filter-select" id="reqAD" readonly style="background: rgba(168, 85, 247, 0.1); cursor: not-allowed; font-size: 14px; padding: 12px 16px;">
                        </div>
                    </div>

                    <div class="filter-group">
                        <label class="filter-label">Account Manager *</label>
                        <select class="filter-select" id="reqAM" style="font-size: 14px; padding: 12px 16px;"></select>
                    </div>
                </div>

                <h3 class="table-title" style="margin: 32px 0 24px;"><i data-lucide="dollar-sign" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Revenue Last 3 Months</h3>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;" id="revenueMonthsContainer">
                    <!-- Auto-generated month fields -->
                </div>

                <div style="display: flex; gap: 16px; margin-top: 32px;">
                    <button type="button" class="export-btn" onclick="reviewCreateRequest()" style="flex: 1; font-size: 14px; padding: 12px;"><i data-lucide="eye" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Review & Submit</button>
                    <button type="button" class="reset-btn" onclick="clearRequestForm()" style="font-size: 14px; padding: 12px;"><i data-lucide="rotate-ccw" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Clear Form</button>
                </div>
            </div>

            <!-- Review Section (Hidden Initially) -->
            <div class="table-section" id="reviewSection" style="display: none; margin-top: 24px;">
                <h3 class="table-title" style="margin-bottom: 24px;"><i data-lucide="check-circle" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Review Your Request</h3>
                <div id="reviewContent"></div>
                <div style="display: flex; gap: 16px; margin-top: 24px;">
                    <button type="button" class="export-btn" onclick="submitRequest()" style="flex: 1; font-size: 14px; padding: 12px;"><i data-lucide="check" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Confirm & Submit</button>
                    <button type="button" class="reset-btn" onclick="editRequestForm()" style="font-size: 14px; padding: 12px;"><i data-lucide="pencil" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Edit</button>
                </div>
                <div id="submitMessage" style="margin-top: 16px; text-align: center; font-weight: 600;"></div>
            </div>
        </div>
    </div>`;
        body.appendChild(d);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else { inject(); }
})();

        function showAMDashboard() {
            const landing = document.getElementById('landingPage');
            if (landing) {
                landing.style.display = 'none';
                landing.remove(); // Completely remove it for AM/AD
            }

            // Hide all other dashboards
            document.getElementById('dashboardContent').style.display = 'none';
            document.getElementById('reviewRequestView').style.display = 'none';
            document.getElementById('transferRequestView').style.display = 'none';
            document.getElementById('amMyRequestsView').style.display = 'none';
            document.getElementById('amRequestDetailView').style.display = 'none';
            document.getElementById('createRequestView').style.display = 'none';
            document.getElementById('amTransferRequestsView').style.display = 'none';

            // Show AM dashboard
            document.getElementById('amAdDashboard').style.display = 'block';

            incrementVisitCount();
            saveLastVisit();
        }

        async function initAMView() {
            try {
                console.log('Loading AM/AD data...');
                ALL_DATA = await fetchData();
                recalculateRevFlags();
                // Filter data for current user
                const userRole = USER_CONTEXT.role;
                const userName = USER_CONTEXT.userName;

                if (userRole === 'Account Manager') {
                    window.AM_ALL_DATA = ALL_DATA.filter(a => a.am === userName);
                    AM_DATA = window.AM_ALL_DATA.filter(a => a.type === 'Group' || !a.parent || a.code === a.parent);
                } else if (userRole === 'Account Director') {
                    window.AM_ALL_DATA = ALL_DATA.filter(a => a.ad === userName);
                    AM_DATA = window.AM_ALL_DATA.filter(a => a.type === 'Group' || !a.parent || a.code === a.parent);
                }

                setCurrentDate();
                document.getElementById('amCurrentDate').textContent = document.getElementById('currentDate').textContent;

                updateAMStats();
                renderAMCharts();
                renderAMTable();
                updateAMPendingBadge();

                document.getElementById('amLoading').style.display = 'none';
                document.getElementById('amContent').style.display = 'block';
                // Initialize Lucide icons
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
                // Sync theme selector with current theme
                const currentTheme = document.body.getAttribute('data-theme');
                const amSelector = document.getElementById('amColorSchemeSelector');
                const amIcon = document.getElementById('amThemeIcon');
                if (amSelector) {
                    if (currentTheme === 'duralux' || currentTheme === 'duralux-dark') {
                        amSelector.value = 'duralux';
                    } else {
                        amSelector.value = 'magenta';
                    }
                }
                if (amIcon) {
                    if (currentTheme === 'dark' || currentTheme === 'duralux-dark') {
                        amIcon.setAttribute('data-lucide', 'sun');
                    } else {
                        amIcon.setAttribute('data-lucide', 'moon');
                    }
                }
            } catch (err) {
                console.error('Error:', err);
                document.getElementById('amLoading').innerHTML = '<div style="color:#ef4444;">Error: ' + err.message + '</div>';
            }
        }

        function isAMPendingStatus(status) {
            return status === 'Not Onboarded' || status === 'Pending_SD_Approval';
        }

        function updateAMPendingBadge() {
            const allAMAccounts = window.AM_ALL_DATA || [];
            const pendingCount = allAMAccounts.filter(function(a) {
                return a.requestType !== 'Transfer' && isAMPendingStatus(a.requestStatus);
            }).length;

            const badge = document.getElementById('amPendingBadge');
            const countEl = document.getElementById('amPendingCount');
            if (countEl) countEl.textContent = pendingCount;
            if (badge) {
                badge.textContent = pendingCount;
                badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
            }
        }

        function updateAMStats() {
            // ✅ GROUPS ONLY for revenue calculations
            const approvedGroups = AM_DATA.filter(a => a.isApproved && a.type === 'Group');

            // ✅ Get ALL accounts for counting children
            const allAMAccounts = window.AM_ALL_DATA || AM_DATA;

            // [NEW] Get dynamic last 3 months
            const lastThree = getLastThreeCompletedMonths();
            const latestMonthKey = lastThree[2].key; // Most recent month (e.g., 'jan26')
            const latestMonthLabel = lastThree[2].label; // e.g., 'Jan-26'

            // ✅ Revenue from GROUPS ONLY
            const lastMonth = approvedGroups.reduce((sum, a) => sum + (a[latestMonthKey] || 0), 0);
            const avgRev = approvedGroups.reduce((sum, a) => sum + a.avg, 0);

            // ✅ Count from ALL accounts (Groups + Children)
            const groupCount = allAMAccounts.filter(a => a.type === 'Group').length;
            const childCount = allAMAccounts.filter(a => a.type === 'Child').length;

            // Update display
            document.getElementById('amLastMonthRev').textContent = formatCurrency(lastMonth);
            document.getElementById('amAvgRev').textContent = formatCurrency(avgRev);
            document.getElementById('amGroupCount').textContent = groupCount;
            document.getElementById('amChildCount').textContent = childCount;

            // [NEW] Update the label to show correct month
            const statLabel = document.querySelector('#amContent .stat-card .stat-label');
            if (statLabel && statLabel.textContent === 'Last Month Revenue') {
                statLabel.textContent = 'Last Month Revenue';
            }
            const statSubtitle = document.querySelector('#amContent .stat-card .stat-subtitle');
            if (statSubtitle && statSubtitle.textContent === 'December 2025') {
                statSubtitle.textContent = latestMonthLabel;
            }
        }

        function renderAMCharts() {
            const colors = getColors();

            // ✅ Use GROUPS ONLY for revenue calculations
            const approvedGroups = AM_DATA.filter(a => a.type === 'Group');

            // [NEW] Get dynamic last 3 months
            const lastThree = getLastThreeCompletedMonths();

            // ✅ Revenue from GROUPS ONLY (in thousands)
            const month1 = approvedGroups.reduce((sum, a) => sum + (a[lastThree[0].key] || 0), 0) / 1000;
            const month2 = approvedGroups.reduce((sum, a) => sum + (a[lastThree[1].key] || 0), 0) / 1000;
            const month3 = approvedGroups.reduce((sum, a) => sum + (a[lastThree[2].key] || 0), 0) / 1000;


            // Revenue Trend Chart
            if (amCharts.revenue) amCharts.revenue.destroy();

            amCharts.revenue = new Chart(document.getElementById('amRevenueChart'), {
                type: 'line',
                data: {
                    labels: [lastThree[0].label, lastThree[1].label, lastThree[2].label],
                    datasets: [{
                        label: 'Revenue (K)', // ✅ Change label
                        data: [month1, month2, month3],
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + '20',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => formatCurrency(context.parsed.y * 1000) // ✅ Convert back
                            }
                        }
                    },
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(0) + 'K'; // ✅ Show as "88K"
                                }
                            }
                        }
                    }
                }
            });
            // Type Distribution Chart
            if (amCharts.type) amCharts.type.destroy();

            // ✅ Count from ALL accounts (for display purposes)
            const allAMAccounts = window.AM_ALL_DATA || AM_DATA;
            const groupCount = allAMAccounts.filter(a => a.type === 'Group').length;
            const childCount = allAMAccounts.filter(a => a.type === 'Child').length;

            amCharts.type = new Chart(document.getElementById('amTypeChart'), {
                type: 'doughnut',
                data: {
                    labels: ['Group Accounts', 'Child Accounts'],
                    datasets: [{
                        data: [groupCount, childCount],
                        backgroundColor: [colors.teamBlue, colors.teamPurple],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: colors.text,
                                font: {
                                    size: 13,
                                    weight: '600'
                                },
                                padding: 15
                            }
                        }
                    }
                }
            });
        }





        function renderAMTable() {
            const gridDiv = document.getElementById('amGrid');
            const lastThree = getLastThreeCompletedMonths();

            // Build parent rows with children nested
            const parentRows = AM_DATA.map(parent => {
                const children = (window.AM_ALL_DATA || []).filter(a =>
                    a.type === 'Child' && a.parent === parent.code && a.code !== parent.code
                );
                return {
                    ...parent,
                    _children: children,
                    _hasChildren: children.length > 0,
                    _isParent: true
                };
            });

            // Orphan child requests (parent not in AM portfolio) still need visibility
            const orphanChildren = (window.AM_ALL_DATA || []).filter(function(a) {
                return a.type === 'Child' &&
                    !AM_DATA.some(function(p) { return p.code === a.parent; });
            }).map(function(child) {
                return {
                    ...child,
                    _children: [],
                    _hasChildren: false,
                    _isParent: true,
                    _isOrphanChild: true
                };
            });

            const combinedParentRows = parentRows.concat(orphanChildren);

            window.AM_PARENT_ROWS = combinedParentRows;

            const columnDefs = [{
                    field: 'code',
                    headerName: 'Account Code',
                    filter: 'agTextColumnFilter',
                    pinned: 'left',
                    width: 180,
                    cellRenderer: params => {
                        const data = params.data;
                        if (data._isParent && data._hasChildren) {
                            const expanded = data._expanded ? true : false;
                            const icon = expanded ? '▼' : '▶';
                            const count = data._children ? data._children.length : 0;
                            return `<span style="cursor:pointer; font-weight:700;" onclick="toggleAMChildren('${data.code}')">
                        <span style="display:inline-block; width:20px; color:var(--accent); font-size:12px;">${icon}</span>
                        ${data.code} <span style="font-size:10px; color:var(--text-secondary); font-weight:500;">(${count})</span>
                    </span>`;
                        } else if (data._isChild) {
                            return `<span style="padding-left:28px; color:var(--text-secondary); font-weight:500;">↳ ${data.code}</span>`;
                        }
                        return `<span style="font-weight:700;">${data.code}</span>`;
                    }
                },
                {
                    field: 'parent',
                    headerName: 'L-10 Account',
                    filter: 'agTextColumnFilter',
                    width: 140
                },
                {
                    field: 'customer',
                    headerName: 'Customer Name',
                    filter: 'agTextColumnFilter',
                    width: 200
                },
                {
                    field: 'type',
                    headerName: 'Type',
                    filter: 'agSetColumnFilter',
                    width: 100,
                    cellRenderer: params => {
                        if (params.data._isChild) {
                            return `<span class="status-badge badge-warning" style="opacity:0.7;">Child</span>`;
                        }
                        const badge = params.value === 'Group' ? 'badge-success' : 'badge-warning';
                        return `<span class="status-badge ${badge}">${params.value}</span>`;
                    }
                },
                {
                    field: 'team',
                    headerName: 'Team',
                    filter: 'agSetColumnFilter',
                    width: 110
                },
                {
                    field: 'lm',
                    headerName: 'Line Manager',
                    filter: 'agTextColumnFilter',
                    width: 150
                },
                {
                    field: 'sm',
                    headerName: 'Service Manager',
                    filter: 'agTextColumnFilter',
                    width: 150
                },
                {
                    field: 'am',
                    headerName: 'Account Manager',
                    filter: 'agTextColumnFilter',
                    width: 150
                },
                {
                    field: 'ad',
                    headerName: 'Account Director',
                    filter: 'agTextColumnFilter',
                    width: 150
                },
                {
                    field: 'pocName',
                    headerName: 'POC Name',
                    filter: 'agTextColumnFilter',
                    width: 150
                },
                {
                    field: 'pocEmail',
                    headerName: 'POC Email',
                    filter: 'agTextColumnFilter',
                    width: 180
                },
                {
                    field: 'pocPhone',
                    headerName: 'POC Phone',
                    filter: 'agTextColumnFilter',
                    width: 140
                },
                ...lastThree.map((month, index) => ({
                    field: month.key,
                    headerName: month.label,
                    filter: 'agNumberColumnFilter',
                    width: 120,
                    valueFormatter: params => formatCurrency(params.value),
                    type: 'numericColumn',
                    cellStyle: params => {
                        if (params.data._isChild) return {
                            opacity: '0.6'
                        };
                        return null;
                    }
                })),
                {
                    field: 'avg',
                    headerName: 'Avg Revenue',
                    filter: 'agNumberColumnFilter',
                    width: 130,
                    valueFormatter: params => formatCurrency(params.value),
                    type: 'numericColumn',
                    cellStyle: params => {
                        if (params.data._isChild) return {
                            opacity: '0.6'
                        };
                        return {
                            fontWeight: '700'
                        };
                    }
                },
             {
                    field: 'rejectReason',
                    headerName: 'Reject Reason',
                    filter: 'agTextColumnFilter',
                    width: 220,
                    cellRenderer: function(params) {
                        if (!params.value) return '<span style="color:var(--t3);font-size:12px;">—</span>';
                        return '<span style="color:#ef4444;font-size:12px;font-weight:600;" title="' + params.value + '">' + params.value + '</span>';
                    }
                },
                {
                    field: 'requestStatus',
                    headerName: 'Request Status',
                    filter: 'agSetColumnFilter',
                    width: 150,
                    cellRenderer: params => {
                        const status = params.value || 'Not Onboarded';
                        let badge = 'badge-warning';
                        if (status === 'OnBoarded' || status === 'AM_Approved') badge = 'badge-success';
                        else if (status === 'Rejected') badge = 'badge-danger';
                        return `<span class="status-badge ${badge}">${status}</span>`;
                    }
                }
            ];

            const gridOptions = {
                columnDefs: columnDefs,
                rowData: combinedParentRows.sort((a, b) => {
                    if (a.requestStatus !== 'OnBoarded' && b.requestStatus === 'OnBoarded') return -1;
                    if (a.requestStatus === 'OnBoarded' && b.requestStatus !== 'OnBoarded') return 1;
                    return b.code.localeCompare(a.code);
                }),
                defaultColDef: {
                    sortable: true,
                    filter: true,
                    resizable: true,
                    minWidth: 100
                },
                pagination: true,
                paginationPageSize: 50,
                paginationPageSizeSelector: [25, 50, 100, 200],
                rowHeight: 48,
                headerHeight: 50,
                animateRows: true,
                enableCellTextSelection: true,
                onGridReady: params => {
                    amGridApi = params.api;
                },
                getRowStyle: params => {
                    if (params.data._isChild) {
                        return {
                            background: 'rgba(168, 85, 247, 0.06)',
                            borderLeft: '3px solid var(--accent)'
                        };
                    }
                    return null;
                },
                getRowId: params => params.data._isChild ? 'am_child_' + params.data.code : 'am_parent_' + params.data.code
            };

            if (amGridApi) {
                amGridApi.destroy();
            }

            gridDiv.innerHTML = '';
            agGrid.createGrid(gridDiv, gridOptions);
        }

        function toggleAMChildren(parentCode) {
            if (!amGridApi) return;

            const parentRow = window.AM_PARENT_ROWS.find(p => p.code === parentCode);
            if (!parentRow || !parentRow._hasChildren) return;

            parentRow._expanded = !parentRow._expanded;

            const newRowData = [];
            window.AM_PARENT_ROWS.forEach(parent => {
                newRowData.push(parent);
                if (parent._expanded && parent._children) {
                    parent._children.forEach(child => {
                        newRowData.push({
                            ...child,
                            _isChild: true,
                            _isParent: false,
                            _hasChildren: false
                        });
                    });
                }
            });

            amGridApi.setGridOption('rowData', newRowData);

            setTimeout(() => {
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 100);
        }

        function searchAMGrid(searchText) {
            if (!amGridApi) return;
            amGridApi.setGridOption('quickFilterText', searchText);
        }

        function exportAMData() {
            const today = new Date();
            const dateStr = today.toLocaleDateString('en-GB') + " " + today.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const lastThree = getLastThreeCompletedMonths();

            // Build export data: parents with their children
            const exportData = [];
            const allAMAccounts = window.AM_ALL_DATA || [];

            AM_DATA.forEach(parent => {
                exportData.push({
                    ...parent,
                    _isExportParent: true
                });
                const children = allAMAccounts.filter(a =>
                    a.type === 'Child' && a.parent === parent.code && a.code !== parent.code
                );
                children.forEach(child => {
                    exportData.push({
                        ...child,
                        _isExportChild: true
                    });
                });
            });

            let html = '<html><head><meta charset="utf-8"></head><body>';
            html += '<table border="1" cellspacing="0" cellpadding="4">';

            html += '<tr><td colspan="16" style="background-color:#a855f7;color:white;font-size:16px;font-weight:bold;text-align:center;padding:12px;">';
            html += 'My Account Performance - Export</td></tr>';

            html += '<tr><td colspan="16" style="background-color:#e9d5ff;font-size:12px;padding:8px;text-align:center;">';
            html += '<b>User:</b> ' + USER_CONTEXT.userName + ' | <b>Generated:</b> ' + dateStr + ' | <b>Parents:</b> ' + AM_DATA.length + ' | <b>Total:</b> ' + exportData.length + '</td></tr>';

            html += '<tr><td colspan="16" style="height:10px;"></td></tr>';

            html += '<tr>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Account Code</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Parent Code</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Customer Name</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Type</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Team</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Line Manager</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Service Manager</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Account Manager</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Account Director</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">POC Name</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">POC Email</th>';
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">POC Phone</th>';
            lastThree.forEach(month => {
                html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">' + month.label + '</th>';
            });
            html += '<th style="background-color:#a855f7;color:white;font-weight:bold;padding:10px;">Avg Revenue</th>';
            html += '</tr>';

            exportData.forEach((a, i) => {
                let rowColor;
                if (a._isExportChild) {
                    rowColor = '#fef3c7';
                } else {
                    rowColor = (i % 2 === 0) ? '#f3e8ff' : '#ffffff';
                }

                const codeDisplay = a._isExportChild ? '  ↳ ' + a.code : a.code;
                const typeDisplay = a._isExportChild ? 'Child' : 'Group';

                html += '<tr>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;font-weight:' + (a._isExportChild ? '400' : '700') + ';">' + codeDisplay + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + (a.parent || '-') + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.customer + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + typeDisplay + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.team + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.lm + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.sm + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.am + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.ad + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.pocName + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.pocEmail + '</td>';
                html += '<td style="background-color:' + rowColor + ';padding:8px;">' + a.pocPhone + '</td>';
                lastThree.forEach(month => {
                    html += '<td style="background-color:' + rowColor + ';padding:8px;text-align:right;">' + formatCurrency(a[month.key] || 0) + '</td>';
                });
                html += '<td style="background-color:' + rowColor + ';padding:8px;text-align:right;">' + formatCurrency(a.avg) + '</td>';
                html += '</tr>';
            });

            html += '<tr><td colspan="16" style="background-color:#e9d5ff;font-weight:bold;padding:10px;text-align:center;">';
            html += 'Parent Accounts: ' + AM_DATA.length + ' | Total Records: ' + exportData.length + '</td></tr>';
            html += '</table></body></html>';

            const blob = new Blob([html], {
                type: "application/vnd.ms-excel"
            });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            const filename = "My_Accounts_" + today.toISOString().split("T")[0] + ".xls";
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        // ========================================
        // CREATE REQUEST FORM FUNCTIONS
        // ========================================

        function showCreateRequestForm() {
            // ✅ RESET BUTTON STATE IMMEDIATELY
            const submitBtn = document.querySelector('#reviewSection button[onclick="submitRequest()"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Confirm & Submit';
            }

            // ✅ HIDE REVIEW SECTION AND CLEAR MESSAGES
            document.getElementById('reviewSection').style.display = 'none';
            document.getElementById('reviewContent').innerHTML = '';
            document.getElementById('submitMessage').innerHTML = '';

            // ✅ CLEAR FORM
            clearRequestForm();

            document.getElementById('amAdDashboard').style.display = 'none';
            document.getElementById('amMyRequestsView').style.display = 'none';
            document.getElementById('amRequestDetailView').style.display = 'none';
            document.getElementById('createRequestView').style.display = 'block';
            populateRequestDropdowns();
        }

        function backToAMDashboard() {
            document.getElementById('createRequestView').style.display = 'none';
            document.getElementById('amMyRequestsView').style.display = 'none';
            document.getElementById('amRequestDetailView').style.display = 'none';
            document.getElementById('amAdDashboard').style.display = 'block';
        }

        function getAllAccountDirectors() {
            const source = window.ALL_DATA || [];
            return [...new Set(source.map(function (a) { return (a.ad || '').trim(); }).filter(Boolean))].sort();
        }

        function getReqAdValue() {
            const el = document.getElementById('reqAD');
            return el ? String(el.value || '').trim() : '';
        }

        function setReqAdReadonly(value) {
            const wrap = document.getElementById('reqADWrap');
            if (!wrap) return;
            wrap.innerHTML = '<input type="text" class="filter-select" id="reqAD" readonly style="background: rgba(168, 85, 247, 0.1); cursor: not-allowed; font-size: 14px; padding: 12px 16px;">';
            const input = document.getElementById('reqAD');
            if (input) input.value = value || '';
        }

        function setReqAdSelect(selectedValue) {
            const wrap = document.getElementById('reqADWrap');
            if (!wrap) return;
            const directors = getAllAccountDirectors();
            let html = '<select class="filter-select" id="reqAD" style="font-size: 14px; padding: 12px 16px;">';
            html += '<option value="">Select Account Director</option>';
            directors.forEach(function (ad) {
                html += '<option value="' + ad.replace(/"/g, '&quot;') + '"' + (selectedValue === ad ? ' selected' : '') + '>' + ad + '</option>';
            });
            html += '</select>';
            wrap.innerHTML = html;
        }

        function resolveAmAccountDirector(amName) {
            const myAccount = (AM_DATA || []).find(function (a) { return a.am === amName && a.ad; });
            if (myAccount) return myAccount.ad;
            const anyAccount = (window.ALL_DATA || []).find(function (a) { return a.am === amName && a.ad; });
            return anyAccount ? anyAccount.ad : '';
        }

        function populateRequestDropdowns() {
            const currentUserRole = USER_CONTEXT.role;
            const currentUserName = USER_CONTEXT.userName;

            console.log('[DEBUG] Populating dropdowns for:', currentUserName, '| Role:', currentUserRole);

            if (currentUserRole === 'Account Director') {
                setReqAdReadonly(currentUserName);
                console.log('[✓] AD set to:', currentUserName);
            } else if (currentUserRole === 'Account Manager') {
                const resolvedAd = resolveAmAccountDirector(currentUserName);
                if (resolvedAd) {
                    setReqAdReadonly(resolvedAd);
                    console.log('[✓] AD found for AM:', resolvedAd);
                } else {
                    setReqAdSelect('');
                    console.warn('[!] No AD mapped for AM — showing director dropdown:', currentUserName);
                }
            } else {
                setReqAdSelect('');
            }

            // Populate Account Managers
            const amSelect = document.getElementById('reqAM');
            amSelect.innerHTML = '<option value="">Select Account Manager</option>';

            if (currentUserRole === 'Account Director') {
                // AD sees only their AMs from ALL_DATA (not just AM_DATA)

                const myAMs = [...new Set(ALL_DATA
                    .filter(a => a.ad === currentUserName && a.am && a.isApproved)
                    .map(a => a.am)
                )].sort();


                if (myAMs.length === 0) {
                    console.warn('[!] No AMs found for this AD');
                }

                myAMs.forEach(am => {
                    const opt = document.createElement('option');
                    opt.value = am;
                    opt.textContent = am;
                    amSelect.appendChild(opt);
                });
            } else if (currentUserRole === 'Account Manager') {
                // AM sees only themselves
                const opt = document.createElement('option');
                opt.value = currentUserName;
                opt.textContent = currentUserName;
                opt.selected = true;
                amSelect.appendChild(opt);
            }

            // Generate revenue fields
            generateRevenueFields();
        }

        function clearRequestForm() {
            // Clear all input fields
            document.getElementById('reqAccountCode').value = '';
            document.getElementById('reqParentCode').value = '';
            document.getElementById('reqGroupAccount').value = 'No'; // Reset to default
            document.getElementById('reqCustomerName').value = '';
            document.getElementById('reqPOCName').value = '';
            document.getElementById('reqPOCEmail').value = '';
            document.getElementById('reqPOCContact').value = '+971';

            // Clear dropdowns
            const adSelect = document.getElementById('reqAD');
            const amSelect = document.getElementById('reqAM');
            if (adSelect) adSelect.value = '';
            if (amSelect) amSelect.value = '';

            // Clear all revenue fields
            const revInputs = document.querySelectorAll('[id^="reqRev"]');
            revInputs.forEach(input => input.value = '');

            // Reset L-10 field visibility (show by default since default is "No")
            document.getElementById('l10Field').style.display = 'block';

            // Hide review section
            document.getElementById('reviewSection').style.display = 'none';
            document.getElementById('submitMessage').innerHTML = '';

            // Show form section
            document.getElementById('requestFormSection').style.display = 'block';
        }

        function toggleL10Field() {
            const groupAccount = document.getElementById('reqGroupAccount').value;
            const l10Field = document.getElementById('l10Field');
            const accountCode = document.getElementById('reqAccountCode').value.trim();

            if (groupAccount === 'No') {
                // Child account - show L-10 field, clear auto-fill
                l10Field.style.display = 'block';
                document.getElementById('reqParentCode').value = '';
            } else {
                // Group account - hide L-10 field, auto-fill with Account Code
                l10Field.style.display = 'none';
                document.getElementById('reqParentCode').value = accountCode;
            }
        }

        function updateL10OnAccountCodeChange() {
            const groupAccount = document.getElementById('reqGroupAccount').value;
            if (groupAccount === 'Yes') {
                const accountCode = document.getElementById('reqAccountCode').value.trim();
                document.getElementById('reqParentCode').value = accountCode;
            }
        }

        function formatPhoneNumber(input) {
            let value = input.value;

            // Always keep +971 prefix
            if (!value.startsWith('+971')) {
                input.value = '+971';
                return;
            }

            // Remove any non-digit characters after +971
            const prefix = '+971';
            const numbers = value.slice(4).replace(/\D/g, '');

            // Limit to 9 digits after +971
            input.value = prefix + numbers.slice(0, 9);
        }
        window.formatPhoneNumber = formatPhoneNumber;

        function getLastThreeMonths() {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const today = new Date();
            const result = [];

            // [OK] Get last 3 COMPLETED months (excluding current month)
            for (let i = 3; i >= 1; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthName = months[d.getMonth()];
                const year = d.getFullYear().toString().slice(-2);

                result.push({
                    label: `${monthName}-${year}`,
                    field: `${monthName}_x002d_${year}`,
                    displayField: `${monthName}-${year}`
                });
            }

            return result;
        }

        function generateRevenueFields() {
            const lastThreeMonths = getLastThreeMonths();
            const container = document.getElementById('revenueMonthsContainer');

            container.innerHTML = lastThreeMonths.map((month, index) => `
        <div class="filter-group">
            <label class="filter-label">${month.label} Revenue *</label>
            <input type="number" step="0.01" class="filter-select" id="reqRev${index + 1}" 
                   data-month="${month.field}" placeholder="Enter revenue amount" 
                   style="cursor: text; font-size: 14px; padding: 12px 16px;">
        </div>
    `).join('');
        }

        function reviewCreateRequest() {
            // Validate required fields
            const accountCode = document.getElementById('reqAccountCode').value.trim();
            const groupAccount = document.getElementById('reqGroupAccount').value;
            const customerName = document.getElementById('reqCustomerName').value.trim();
            const pocName = document.getElementById('reqPOCName').value.trim();
            const pocEmail = document.getElementById('reqPOCEmail').value.trim();
            const pocContact = document.getElementById('reqPOCContact').value.trim();
            const ad = getReqAdValue();
            const am = document.getElementById('reqAM').value.trim();

            if (!accountCode || !customerName || !pocName || !pocEmail || !pocContact || !ad || !am) {
                alert('Please fill in all required fields');
                return;
            }

            // [OK] Validate Account Code format (multiple decimals allowed)
            const accountCodePattern = /^\d+(\.\d+)+$/;
            if (!accountCodePattern.test(accountCode)) {
                alert('Account Code must be in format: 1.0129012 or 1.0129012.01 (with decimals)');
                return;
            }

            let parentCode = '';
            if (groupAccount === 'Yes') {
                // Group Account = Yes means L-10 is required
                parentCode = document.getElementById('reqParentCode').value.trim();
                if (!parentCode) {
                    alert('Please fill in L-10 Account (Payment Responsible Account)');
                    return;
                }
                // [OK] Validate L-10 format (multiple decimals allowed)
                const parentPattern = /^\d+(\.\d+)+$/;
                if (!parentPattern.test(parentCode)) {
                    alert('L-10 Account must be in format: 1.0129012 or 1.0129012.01 (with decimals)');
                    return;
                }
            }

            // [OK] Strict email validation - must have @ and .
            if (!pocEmail.includes('@')) {
                alert('Email must contain @ symbol');
                return;
            }
            if (!pocEmail.includes('.')) {
                alert('Email must contain a domain (e.g., @gmail.com)');
                return;
            }
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            if (!emailPattern.test(pocEmail)) {
                alert('Please enter a valid email address (e.g., user@example.com)');
                return;
            }
            // [OK] Phone validation (+971 and exactly 9 digits)
            const phonePattern = /^\+971\d{9}$/;
            if (!phonePattern.test(pocContact)) {
                alert('POC Contact must be +971 followed by exactly 9 digits (e.g., +971501234567)');
                return;
            }

            // Validate revenue fields
            const revInputs = document.querySelectorAll('[id^="reqRev"]');
            for (let input of revInputs) {
                if (!input.value.trim()) {
                    alert('Please fill in all revenue fields');
                    return;
                }
            }

            // [OK] Hide form, show review
            document.getElementById('requestFormSection').style.display = 'none';

            // Build review content with 2-3 columns layout
            let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">';

            const fields = [
                ['Account Code', accountCode],
                ['Group Account', groupAccount],
                ['L-10 Account', parentCode || 'N/A'],
                ['Customer Name', customerName],
                ['POC Name', pocName],
                ['POC Email', pocEmail],
                ['POC Contact', pocContact],
                ['Account Director', ad],
                ['Account Manager', am]
            ];

            fields.forEach(([label, value]) => {
                html += `
            <div style="padding: 12px; background: rgba(168, 85, 247, 0.1); border-radius: 8px;">
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">${label}</div>
                <div style="font-size: 14px; font-weight: 600;">${value}</div>
            </div>
        `;
            });

            html += '</div>';

            html += '<h4 style="margin: 24px 0 16px; font-size: 16px;">Revenue Last 3 Months</h4>';
            html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">';

            revInputs.forEach(input => {
                const monthLabel = input.previousElementSibling.textContent.replace(' Revenue *', '');
                const revValue = parseFloat(input.value);
                html += `
            <div style="padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">${monthLabel}</div>
                <div style="font-size: 16px; font-weight: 700; color: var(--success);">AED ${revValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
        `;
            });

            html += '</div>';

            document.getElementById('reviewContent').innerHTML = html;
            document.getElementById('reviewSection').style.display = 'block';
            document.getElementById('submitMessage').innerHTML = '';
        }

        function editRequestForm() {
            document.getElementById('reviewSection').style.display = 'none';
            document.getElementById('requestFormSection').style.display = 'block';
        }
        async function submitRequest() {
            const submitBtn = event.target;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px; animation: spin 1s linear infinite;"></i>Submitting...';

            try {
                const groupAccount = document.getElementById('reqGroupAccount').value;

                // [OK] Build data object carefully
                const data = {
                    Title: document.getElementById('reqAccountCode').value.trim(),
                    Customer_x0020_Name: document.getElementById('reqCustomerName').value.trim(),
                    POC_x0020_Name: document.getElementById('reqPOCName').value.trim(),
                    POC_x0020_Email_x0020_ID: document.getElementById('reqPOCEmail').value.trim(),
                    POC_x0020_Contact_x0020_No: document.getElementById('reqPOCContact').value.trim(),
                    Request_x0020_Status: 'Not Onboarded',
                    Request_x0020_Type: 'New Account',
                    New_Account_Request_Date: new Date().toISOString(),
                };

                // Add Parent Code based on Group Account selection
                if (groupAccount === 'Yes') {
                    // GROUP account - Parent Code = Account Code (same)
                    data.Parent_x0020_Code = data.Title;
                } else {
                    // CHILD account - Parent Code = L-10 value (user entered)
                    const l10Value = document.getElementById('reqParentCode').value.trim();
                    if (l10Value) {
                        data.Parent_x0020_Code = l10Value;
                    } else {
                        throw new Error('L-10 (Parent Account) is required for child accounts');
                    }
                }

                // Get people IDs
                const adName = getReqAdValue();
                const amName = document.getElementById('reqAM').value.trim();

                const adId = await getUserId(adName);
                const amId = await getUserId(amName);

                if (adId) data.Account_x0020_DirectorId = adId;
                if (amId) data.Account_x0020_ManagerId = amId;

                // [OK] Add revenue fields dynamically based on generated months
                const revInputs = document.querySelectorAll('[id^="reqRev"]');
                revInputs.forEach((input, index) => {
                    const monthField = input.getAttribute('data-month');
                    const revValue = parseFloat(input.value);
                    if (monthField && !isNaN(revValue)) {
                        data[monthField] = revValue;
                    }
                });


                await submitToSharePoint(data);

                document.getElementById('submitMessage').innerHTML = '<span style="color: var(--success);">Request submitted successfully!</span>';

                if (typeof logAccountHistory === 'function') {
                    logAccountHistory(
                        data.Title,
                        data.Customer_x0020_Name,
                        'Request Raised',
                        'New account request submitted by ' + USER_CONTEXT.userName,
                        USER_CONTEXT.userName,
                        '', '', '', '', ''
                    );
                }

                setTimeout(() => {
                    // RESET form
                    clearRequestForm();

                    // RESET review section
                    document.getElementById('reviewSection').style.display = 'none';
                    document.getElementById('reviewContent').innerHTML = '';
                    document.getElementById('submitMessage').innerHTML = '';

                    // RESET form section visibility
                    document.getElementById('requestFormSection').style.display = 'block';

                    initAMView().then(function() {
                        showAMMyRequests();
                    });
                }, 2000);

            } catch (err) {
                console.error('Submit error:', err);
                document.getElementById('submitMessage').innerHTML = '<span style="color: var(--danger);">Error: ' + err.message + '</span>';
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Confirm & Submit';
                lucide.createIcons();
            }
        }
        async function getUserId(displayName) {
            try {
                const url = SP_URL + "/_api/web/siteusers?$filter=Title eq '" + displayName + "'&$select=Id";
                const res = await fetch(url, {
                    headers: {
                        'Accept': 'application/json;odata=verbose'
                    },
                    credentials: 'include'
                });
                if (!res.ok) return null;
                const data = await res.json();
                return data.d.results.length > 0 ? data.d.results[0].Id : null;
            } catch (err) {
                console.error('Error getting user ID:', err);
                return null;
            }
        }
        async function submitToSharePoint(data) {
            const url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items";

            // Get form digest
            const digestRes = await fetch(SP_URL + "/_api/contextinfo", {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose'
                },
                credentials: 'include'
            });

            if (!digestRes.ok) throw new Error('Failed to get form digest');

            const digestData = await digestRes.json();
            const digest = digestData.d.GetContextWebInformation.FormDigestValue;

            // Submit item
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': digest
                },
                credentials: 'include',
                body: JSON.stringify({
                    __metadata: {
                        type: 'SP.Data.Service_x0020_Manager_x0020_RequestListItem'
                    },
                    ...data
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error('SharePoint error: ' + errorText);
            }

            const result = await res.json();
            return result.d; // Return the created item with ID
        }

        async function sendEmailToServiceDirector(createdItem, requestData) {
            try {
                console.log('Email notification: Service Director email feature pending implementation');
                // Note: Service Director email will be sent when SD lookup is properly configured in SharePoint
                return;

                /* ORIGINAL CODE - DISABLED FOR NOW
        const itemUrl = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items(" + createdItem.Id + ")?" +
            "$select=Service_x0020_Director/Title,Service_x0020_Director/EMail&" +
            "$expand=Service_x0020_Director";
        
        const res = await fetch(itemUrl, {
            headers: { 'Accept': 'application/json;odata=verbose' },
            credentials: 'include'
        });
        
        if (!res.ok) {
            console.log('Could not fetch Service Director');
            return;
        }
        
        const data = await res.json();
        const item = data.d;
        
        const sdEmail = item.Service_x0020_Director?.EMail;
        const sdName = item.Service_x0020_Director?.Title;
        
        if (!sdEmail) {
            console.log('Service Director email not found');
            return;
        }
        
        const subject = encodeURIComponent(`New Account Request Pending Approval - ${requestData.Title}`);
        const body = encodeURIComponent(`Dear ${sdName},

A new account request has been submitted and requires your approval:

Account Code: ${requestData.Title}
Parent Code: ${requestData.Parent_x0020_Code || 'N/A (Group Account)'}
Customer Name: ${requestData.Customer_x0020_Name}
Team: ${requestData.Team}
Account Director: ${getReqAdValue()}
Account Manager: ${document.getElementById('reqAM').value}

Request Status: Pending

Please review and approve/reject this request in the Admin Dashboard.

Best regards,
Service Management System`);
        
        window.open(`mailto:${sdEmail}?subject=${subject}&body=${body}`);
        */

            } catch (err) {
                console.error('Email notification error:', err);
                // Don't throw error - just log it
            }
        }

        // ========================================
        // MY REQUESTS TRACKER (AM / AD)
        // ========================================

        function hideAllAMViews() {
            ['amAdDashboard', 'createRequestView', 'amTransferRequestsView', 'amMyRequestsView', 'amRequestDetailView'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }

        function showAMMyRequests() {
            hideAllAMViews();
            document.getElementById('amMyRequestsView').style.display = 'block';
            loadAMMyRequests();
        }

        function backToAMDashboardFromRequests() {
            hideAllAMViews();
            document.getElementById('amAdDashboard').style.display = 'block';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function amEsc(value) {
            return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        }

        async function amGetAdminEmails() {
            try {
                var res = await fetch(SP_URL + "/_api/web/lists/getbytitle('" + SP_ACCESS_LIST + "')/items?$select=UserEmailID,Role&$filter=(Role eq 'Admin' or Role eq 'Service Director')", {
                    headers: { 'Accept': 'application/json;odata=verbose' },
                    credentials: 'include'
                });
                if (!res.ok) return [];
                var data = await res.json();
                var emails = data.d.results.map(function(r) { return r.UserEmailID; }).filter(Boolean);
                return emails.filter(function(v, i, a) { return a.indexOf(v) === i; });
            } catch (e) {
                return [];
            }
        }

        function amBelongsToCurrentUser(row) {
            var userName = USER_CONTEXT.userName;
            var userRole = USER_CONTEXT.role;
            if (userRole === 'Account Manager') {
                return row.am === userName;
            }
            if (userRole === 'Account Director') {
                return row.ad === userName;
            }
            return false;
        }

        async function loadAMMyRequests() {
            var loadingEl = document.getElementById('amRequestsLoading');
            var contentEl = document.getElementById('amRequestsContent');
            var gridEl = document.getElementById('amRequestsGrid');

            if (!loadingEl || !contentEl || !gridEl) return;

            loadingEl.style.display = 'block';
            contentEl.style.display = 'none';

            try {
                var lastThree = getLastThreeCompletedMonths();
                var monthFields = lastThree.map(function(m) { return m.field; }).join(',');

                var url = SP_URL + "/_api/web/lists/getbytitle('" + SP_LIST + "')/items?" +
                    "$select=ID,Title,Parent_x0020_Code,Customer_x0020_Name,Team," +
                    "Account_x0020_Manager/Title,Account_x0020_Manager/EMail," +
                    "Account_x0020_Director/Title,Account_x0020_Director/EMail," +
                    "POC_x0020_Name,POC_x0020_Email_x0020_ID,POC_x0020_Contact_x0020_No," +
                    monthFields + ",Request_x0020_Status,Request_x0020_Type,New_Account_Request_Date,Reject_New_Account_Reason&" +
                    "$expand=Account_x0020_Manager,Account_x0020_Director&" +
                    "$filter=(Request_x0020_Type eq 'New Account')&$top=5000";

                var res = await fetch(url, {
                    headers: { 'Accept': 'application/json;odata=verbose' },
                    credentials: 'include'
                });

                if (!res.ok) throw new Error('Failed to load requests: ' + res.statusText);

                var data = await res.json();
                var requests = data.d.results.filter(function(r) {
                    var row = {
                        am: r.Account_x0020_Manager ? r.Account_x0020_Manager.Title : '',
                        ad: r.Account_x0020_Director ? r.Account_x0020_Director.Title : ''
                    };
                    return amBelongsToCurrentUser(row);
                });

                AM_MY_REQUESTS = requests.map(function(r) {
                    var requestDate = r.New_Account_Request_Date ? new Date(r.New_Account_Request_Date) : null;
                    var daysSince = requestDate ? Math.floor((new Date() - requestDate) / 86400000) : null;
                    var row = {
                        id: r.ID,
                        code: r.Title || '',
                        parent: r.Parent_x0020_Code || '',
                        customer: r.Customer_x0020_Name || '',
                        team: r.Team || '',
                        ad: r.Account_x0020_Director ? r.Account_x0020_Director.Title : '',
                        adEmail: r.Account_x0020_Director ? (r.Account_x0020_Director.EMail || '') : '',
                        am: r.Account_x0020_Manager ? r.Account_x0020_Manager.Title : '',
                        amEmail: r.Account_x0020_Manager ? (r.Account_x0020_Manager.EMail || '') : '',
                        status: r.Request_x0020_Status || 'Not Onboarded',
                        rejectReason: r.Reject_New_Account_Reason || '',
                        requestDate: requestDate,
                        daysSince: daysSince,
                        pocName: r.POC_x0020_Name || '',
                        pocEmail: r.POC_x0020_Email_x0020_ID || '',
                        pocPhone: r.POC_x0020_Contact_x0020_No || ''
                    };
                    lastThree.forEach(function(m) {
                        row[m.field] = parseFloat(r[m.field]) || 0;
                    });
                    return row;
                });

                loadingEl.style.display = 'none';
                contentEl.style.display = 'block';

                if (AM_MY_REQUESTS.length === 0) {
                    gridEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3);">No account requests found. Use <b>Create New Request</b> to submit one.</div>';
                    if (amRequestsGridApi) {
                        amRequestsGridApi.destroy();
                        amRequestsGridApi = null;
                    }
                } else {
                    renderAMRequestsGrid(AM_MY_REQUESTS, lastThree);
                }

                updateAMPendingBadge();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                console.error('[AM Requests]', err);
                loadingEl.innerHTML = '<div style="color:#ef4444;padding:20px;">Error: ' + err.message + '</div>';
            }
        }

        function renderAMRequestsGrid(rowData, lastThree) {
            var gridDiv = document.getElementById('amRequestsGrid');
            if (!gridDiv) return;

            var monthCols = lastThree.map(function(m) {
                return {
                    field: m.field,
                    headerName: m.label,
                    width: 120,
                    type: 'numericColumn',
                    valueFormatter: function(p) { return formatCurrency(p.value || 0); }
                };
            });

            var columnDefs = [{
                field: 'code',
                headerName: 'Account Code',
                pinned: 'left',
                width: 150,
                filter: 'agTextColumnFilter',
                cellStyle: { fontWeight: '700' }
            }, {
                field: 'customer',
                headerName: 'Customer',
                width: 220,
                filter: 'agTextColumnFilter'
            }, {
                field: 'parent',
                headerName: 'L-10 / Parent',
                width: 140,
                filter: 'agTextColumnFilter'
            }, {
                field: 'team',
                headerName: 'Team',
                width: 100,
                filter: 'agSetColumnFilter'
            }].concat(monthCols).concat([{
                field: 'requestDate',
                headerName: 'Request Date',
                width: 130,
                sort: 'desc',
                valueFormatter: function(p) {
                    if (!p.value) return '—';
                    return p.value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                }
            }, {
                field: 'daysSince',
                headerName: 'Days Pending',
                width: 130,
                cellRenderer: function(p) {
                    if (p.value === null || p.value === undefined) return '—';
                    if (p.data.status === 'OnBoarded' || p.data.status === 'Rejected') return '—';
                    var color = p.value > 14 ? '#ef4444' : p.value > 7 ? '#f97316' : '#10b981';
                    return '<span style="font-weight:700;color:' + color + ';">' + p.value + 'd</span>';
                }
            }, {
                field: 'status',
                headerName: 'Status',
                width: 170,
                cellRenderer: function(p) {
                    var status = p.value || 'Not Onboarded';
                    var badge = 'badge-warning';
                    if (status === 'OnBoarded' || status === 'AM_Approved') badge = 'badge-success';
                    else if (status === 'Rejected') badge = 'badge-danger';
                    return '<span class="status-badge ' + badge + '">' + status + '</span>';
                }
            }, {
                field: 'actions',
                headerName: 'Actions',
                width: 220,
                pinned: 'right',
                sortable: false,
                filter: false,
                cellRenderer: function(p) {
                    var d = p.data;
                    var viewBtn = '<button type="button" class="export-btn" style="padding:5px 10px;font-size:11px;margin-right:6px;" onclick="viewAMRequest(' + d.id + ')">' +
                        '<i data-lucide="eye" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>View</button>';
                    var reminderBtn = '';
                    if (isAMPendingStatus(d.status)) {
                        reminderBtn = '<button type="button" class="reset-btn" style="padding:5px 10px;font-size:11px;" onclick="sendAMRequestReminder(' + d.id + ')">' +
                            '<i data-lucide="mail" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>Send Reminder</button>';
                    }
                    return viewBtn + reminderBtn;
                }
            }]);

            if (amRequestsGridApi) {
                amRequestsGridApi.destroy();
                amRequestsGridApi = null;
            }
            gridDiv.innerHTML = '';

            agGrid.createGrid(gridDiv, {
                columnDefs: columnDefs,
                rowData: rowData,
                defaultColDef: { sortable: true, filter: true, resizable: true },
                pagination: true,
                paginationPageSize: 25,
                rowHeight: 48,
                headerHeight: 48,
                animateRows: true,
                enableCellTextSelection: true,
                onGridReady: function(params) {
                    amRequestsGridApi = params.api;
                    setTimeout(function() { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 100);
                },
                onCellClicked: function() {
                    setTimeout(function() { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 80);
                }
            });
        }

        function searchAMRequests() {
            if (!amRequestsGridApi) return;
            var val = document.getElementById('amRequestSearchBox').value;
            amRequestsGridApi.setGridOption('quickFilterText', val);
        }

        async function viewAMRequest(itemId) {
            try {
                var row = AM_MY_REQUESTS.find(function(r) { return r.id === itemId; });
                if (!row) {
                    await loadAMMyRequests();
                    row = AM_MY_REQUESTS.find(function(r) { return r.id === itemId; });
                }
                if (!row) throw new Error('Request not found');

                var lastThree = getLastThreeCompletedMonths();
                var statusBadge = row.status;
                if (row.status === 'Rejected') statusBadge = 'Rejected';
                else if (row.status === 'OnBoarded') statusBadge = 'OnBoarded';
                else statusBadge = row.status;

                var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">';
                var fields = [
                    ['Account Code', row.code],
                    ['L-10 / Parent', row.parent || 'N/A'],
                    ['Customer Name', row.customer],
                    ['Account Manager', row.am],
                    ['Account Director', row.ad],
                    ['Team', row.team || 'Pending assignment'],
                    ['POC Name', row.pocName],
                    ['POC Email', row.pocEmail],
                    ['POC Contact', row.pocPhone],
                    ['Request Status', statusBadge],
                    ['Request Date', row.requestDate ? row.requestDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'],
                    ['Days Pending', (isAMPendingStatus(row.status) && row.daysSince !== null) ? row.daysSince + ' days' : '—']
                ];
                fields.forEach(function(f) {
                    html += '<div style="padding:12px;background:rgba(168,85,247,0.08);border-radius:8px;">' +
                        '<div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;margin-bottom:4px;">' + f[0] + '</div>' +
                        '<div style="font-size:13px;font-weight:600;">' + (f[1] || 'N/A') + '</div></div>';
                });
                html += '</div>';

                if (row.rejectReason) {
                    html += '<div style="margin-top:16px;padding:14px;background:rgba(239,68,68,0.08);border-radius:8px;border:1px solid rgba(239,68,68,0.25);">' +
                        '<div style="font-size:10px;color:#ef4444;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Rejection Reason</div>' +
                        '<div style="font-size:13px;font-weight:600;color:#ef4444;">' + row.rejectReason + '</div></div>';
                }

                html += '<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--t2);">Revenue Details</h4>';
                html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">';
                lastThree.forEach(function(month) {
                    html += '<div style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;">' +
                        '<div style="font-size:11px;color:var(--t3);margin-bottom:4px;font-weight:600;">' + month.label + '</div>' +
                        '<div style="font-size:18px;font-weight:700;color:var(--sc);">' + formatCurrency(row[month.field] || 0) + '</div></div>';
                });
                html += '</div>';

                document.getElementById('amRequestDetailContent').innerHTML = html;

                var actionsHtml = '';
                if (isAMPendingStatus(row.status)) {
                    actionsHtml = '<button type="button" class="export-btn" onclick="sendAMRequestReminder(' + row.id + ')" style="flex:1;">' +
                        '<i data-lucide="mail" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Send Reminder</button>';
                }
                document.getElementById('amRequestDetailActions').innerHTML = actionsHtml;

                hideAllAMViews();
                document.getElementById('amRequestDetailView').style.display = 'block';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                alert('Error loading request: ' + err.message);
            }
        }

        async function sendAMRequestReminder(itemId) {
            try {
                var row = AM_MY_REQUESTS.find(function(r) { return r.id === itemId; });
                if (!row) {
                    await loadAMMyRequests();
                    row = AM_MY_REQUESTS.find(function(r) { return r.id === itemId; });
                }
                if (!row) throw new Error('Request not found');
                if (!isAMPendingStatus(row.status)) {
                    alert('Reminders are only available for pending requests.');
                    return;
                }

                var adminEmails = await amGetAdminEmails();
                var to = adminEmails.join(';');
                if (!to) {
                    alert('No Admin / Service Director email found to send reminder.');
                    return;
                }

                var daysText = (row.daysSince === null || row.daysSince === undefined) ? 'several' : String(row.daysSince);
                var subject = encodeURIComponent('[REMINDER] New Account Request Pending Approval - ACC# ' + row.code + ' | ' + row.customer);
                var body = encodeURIComponent(
                    'Dear Admin / Service Director,\n\n' +
                    'This is a reminder that the following new account request is still pending approval (' + daysText + ' day(s)).\n\n' +
                    'Account Code: ' + row.code + '\n' +
                    'Customer: ' + row.customer + '\n' +
                    'Account Manager: ' + row.am + '\n' +
                    'Account Director: ' + row.ad + '\n' +
                    'Current Status: ' + row.status + '\n' +
                    'Request Date: ' + (row.requestDate ? row.requestDate.toLocaleDateString('en-GB') : 'N/A') + '\n\n' +
                    'Please review and process this request in the Service Management Dashboard.\n\n' +
                    'Sent by: ' + USER_CONTEXT.userName
                );

                var cc = [row.adEmail].filter(Boolean).join(';');
                var mailto = 'mailto:' + encodeURIComponent(to) + '?subject=' + subject + '&body=' + body;
                if (cc) mailto += '&cc=' + encodeURIComponent(cc);
                window.location.href = mailto;
            } catch (err) {
                alert('Could not send reminder: ' + err.message);
            }
        }

        window.showAMMyRequests = showAMMyRequests;
        window.backToAMDashboardFromRequests = backToAMDashboardFromRequests;
        window.loadAMMyRequests = loadAMMyRequests;
        window.searchAMRequests = searchAMRequests;
        window.viewAMRequest = viewAMRequest;
        window.sendAMRequestReminder = sendAMRequestReminder;
