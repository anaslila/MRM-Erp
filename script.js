// Global Variables and Configuration
const CURRENCY_CONFIG = {
    INR: { symbol: '₹', code: 'INR', locale: 'en-IN' },
    USD: { symbol: '$', code: 'USD', locale: 'en-US' },
    EUR: { symbol: '€', code: 'EUR', locale: 'de-DE' },
    GBP: { symbol: '£', code: 'GBP', locale: 'en-GB' },
    JPY: { symbol: '¥', code: 'JPY', locale: 'ja-JP' },
    CAD: { symbol: 'C$', code: 'CAD', locale: 'en-CA' },
    AUD: { symbol: 'A$', code: 'AUD', locale: 'en-AU' }
};

// PWA Install Variables
let deferredPrompt;
let isIOS = false;
let isStandalone = false;

// Main Application Class
class MRMApp {
    constructor() {
        this.currentCurrency = localStorage.getItem('mrm_currency') || 'INR';
        this.transactions = JSON.parse(localStorage.getItem('mrm_transactions')) || [];
        this.categories = JSON.parse(localStorage.getItem('mrm_categories')) || this.getDefaultCategories();
        this.budgets = JSON.parse(localStorage.getItem('mrm_budgets')) || [];
        this.goals = JSON.parse(localStorage.getItem('mrm_goals')) || [];
        this.recurringTransactions = JSON.parse(localStorage.getItem('mrm_recurring')) || [];
        this.currentEditId = null;
        this.charts = {};
        this.isOnline = navigator.onLine;
        this.isMobile = window.innerWidth <= 768;
        this.fabMenuOpen = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializePWA();
        this.setupMobileNavigation();
        this.setupCurrencySystem();
        this.updateDashboard();
        this.populateCategorySelects();
        this.processRecurringTransactions();
        this.setDefaultDates();
        this.setupConnectionMonitoring();
        this.setupMobileFilters();
        
        // Set active tab
        const activeTab = localStorage.getItem('mrm_active_tab') || 'dashboard';
        this.switchTab(activeTab);
    }

    // PWA and Installation Setup
    initializePWA() {
        // Detect iOS
        isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // Detect standalone mode
        isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone === true;

        // Hide install banners if already installed
        if (isStandalone) {
            document.getElementById('installBanner').style.display = 'none';
            document.getElementById('iosInstallPrompt').style.display = 'none';
            return;
        }

        // Setup PWA install prompt for Android/Desktop
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            if (!isIOS) {
                this.showInstallBanner();
            }
        });

        // Show iOS install prompt
        if (isIOS && !isStandalone) {
            setTimeout(() => {
                this.showIOSInstallPrompt();
            }, 3000);
        }

        // Setup install button handlers
        document.getElementById('installBtn').addEventListener('click', this.installApp.bind(this));
        document.getElementById('dismissInstall').addEventListener('click', this.hideInstallBanner.bind(this));
        document.getElementById('closeIosPrompt').addEventListener('click', this.hideIOSInstallPrompt.bind(this));
    }

    showInstallBanner() {
        const banner = document.getElementById('installBanner');
        banner.classList.remove('hidden');
        banner.style.animation = 'slideInFromTop 0.5s ease-out';
    }

    hideInstallBanner() {
        const banner = document.getElementById('installBanner');
        banner.classList.add('hidden');
        localStorage.setItem('mrm_install_dismissed', 'true');
    }

    showIOSInstallPrompt() {
        if (localStorage.getItem('mrm_ios_install_dismissed') === 'true') return;
        
        const prompt = document.getElementById('iosInstallPrompt');
        prompt.classList.remove('hidden');
        prompt.style.animation = 'slideInFromBottom 0.5s ease-out';
    }

    hideIOSInstallPrompt() {
        const prompt = document.getElementById('iosInstallPrompt');
        prompt.classList.add('hidden');
        localStorage.setItem('mrm_ios_install_dismissed', 'true');
    }

    async installApp() {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            this.hideInstallBanner();
        }
        
        deferredPrompt = null;
    }

    // Mobile Navigation Setup
    setupMobileNavigation() {
        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileNavContainer = document.getElementById('mobileNavContainer');
        
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileNavContainer.classList.toggle('active');
            });
        }

        // Mobile navigation buttons
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.mobile-nav-btn').dataset.tab;
                this.switchTab(tab);
                mobileNavContainer.classList.remove('active');
            });
        });

        // FAB functionality
        this.setupFloatingActionButton();
    }

    setupFloatingActionButton() {
        const fabContainer = document.getElementById('fabContainer');
        
        // Show/hide FAB based on scroll
        let lastScrollTop = 0;
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling down
                fabContainer.classList.add('hidden');
            } else {
                // Scrolling up
                fabContainer.classList.remove('hidden');
            }
            
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        });
    }

    // Currency System
    setupCurrencySystem() {
        const currencySelect = document.getElementById('currencySelect');
        currencySelect.value = this.currentCurrency;
        
        currencySelect.addEventListener('change', (e) => {
            this.currentCurrency = e.target.value;
            localStorage.setItem('mrm_currency', this.currentCurrency);
            this.updateCurrencySymbols();
            this.updateDashboard();
            this.refreshCurrentTab();
        });
        
        this.updateCurrencySymbols();
    }

    updateCurrencySymbols() {
        const currency = CURRENCY_CONFIG[this.currentCurrency];
        
        // Update all currency symbols
        document.querySelectorAll('.currency-symbol').forEach(element => {
            element.textContent = currency.symbol;
        });
        
        // Update currency icons in headers
        document.querySelectorAll('.fa-dollar-sign, .fa-rupee-sign').forEach(element => {
            element.className = element.className.replace(/fa-\w+-sign/, 'fa-rupee-sign');
            if (this.currentCurrency === 'USD') {
                element.className = element.className.replace('fa-rupee-sign', 'fa-dollar-sign');
            }
        });
    }

    formatCurrency(amount) {
        const currency = CURRENCY_CONFIG[this.currentCurrency];
        
        if (this.currentCurrency === 'INR') {
            // Indian numbering system (Lakhs and Crores)
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        } else {
            return new Intl.NumberFormat(currency.locale, {
                style: 'currency',
                currency: currency.code,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
    }

    // Mobile Filters Setup
    setupMobileFilters() {
        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                const filter = e.target.dataset.filter;
                this.applyQuickFilter(filter);
            });
        });
    }

    applyQuickFilter(filter) {
        const typeFilter = document.getElementById('typeFilter');
        if (typeFilter) {
            typeFilter.value = filter;
            this.applyFilters();
        }
    }

    // Connection Monitoring
    setupConnectionMonitoring() {
        const connectionStatus = document.getElementById('connectionStatus');
        
        const updateConnectionStatus = () => {
            this.isOnline = navigator.onLine;
            
            if (this.isOnline) {
                connectionStatus.classList.add('hidden');
            } else {
                connectionStatus.classList.remove('hidden');
            }
        };

        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
        updateConnectionStatus();
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Navigation (Desktop)
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.nav-btn').dataset.tab;
                this.switchTab(tab);
            });
        });

        // Forms
        document.getElementById('transactionForm').addEventListener('submit', this.handleTransactionSubmit.bind(this));
        document.getElementById('budgetForm').addEventListener('submit', this.handleBudgetSubmit.bind(this));
        document.getElementById('categoryForm').addEventListener('submit', this.handleCategorySubmit.bind(this));
        document.getElementById('goalForm').addEventListener('submit', this.handleGoalSubmit.bind(this));
        document.getElementById('recurringForm').addEventListener('submit', this.handleRecurringSubmit.bind(this));

        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Transaction type change
        document.getElementById('transactionType').addEventListener('change', this.updateCategoryOptions.bind(this));
        document.getElementById('recurringType').addEventListener('change', this.updateRecurringCategoryOptions.bind(this));

        // Filter events
        const typeFilter = document.getElementById('typeFilter');
        const categoryFilter = document.getElementById('categoryFilter');
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');

        if (typeFilter) typeFilter.addEventListener('change', this.applyFilters.bind(this));
        if (categoryFilter) categoryFilter.addEventListener('change', this.applyFilters.bind(this));
        if (startDate) startDate.addEventListener('change', this.applyFilters.bind(this));
        if (endDate) endDate.addEventListener('change', this.applyFilters.bind(this));

        // Responsive listeners
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;
        
        if (wasMobile !== this.isMobile) {
            this.refreshCurrentTab();
            this.updateCharts();
        }
    }

    handleOrientationChange() {
        setTimeout(() => {
            this.updateCharts();
        }, 300);
    }

    // Default Categories (Updated for Indian context)
    getDefaultCategories() {
        return {
            income: [
                { id: 1, name: 'Salary', icon: 'fas fa-briefcase', color: '#4CAF50' },
                { id: 2, name: 'Business Income', icon: 'fas fa-store', color: '#2196F3' },
                { id: 3, name: 'Freelancing', icon: 'fas fa-laptop-code', color: '#FF9800' },
                { id: 4, name: 'Investment Returns', icon: 'fas fa-chart-line', color: '#9C27B0' },
                { id: 5, name: 'Rental Income', icon: 'fas fa-home', color: '#607D8B' },
                { id: 6, name: 'Other Income', icon: 'fas fa-plus-circle', color: '#795548' }
            ],
            expense: [
                { id: 7, name: 'Food & Dining', icon: 'fas fa-utensils', color: '#F44336' },
                { id: 8, name: 'Transportation', icon: 'fas fa-car', color: '#E91E63' },
                { id: 9, name: 'Groceries', icon: 'fas fa-shopping-basket', color: '#9C27B0' },
                { id: 10, name: 'Entertainment', icon: 'fas fa-gamepad', color: '#673AB7' },
                { id: 11, name: 'Bills & Utilities', icon: 'fas fa-file-invoice', color: '#3F51B5' },
                { id: 12, name: 'Healthcare', icon: 'fas fa-medkit', color: '#009688' },
                { id: 13, name: 'Travel', icon: 'fas fa-plane', color: '#00BCD4' },
                { id: 14, name: 'Education', icon: 'fas fa-graduation-cap', color: '#FF5722' },
                { id: 15, name: 'Shopping', icon: 'fas fa-shopping-cart', color: '#607D8B' },
                { id: 16, name: 'EMI/Loans', icon: 'fas fa-credit-card', color: '#795548' }
            ]
        };
    }

    // Tab Management (Enhanced for mobile)
    switchTab(tabName) {
        // Update desktop navigation
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const desktopBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (desktopBtn) desktopBtn.classList.add('active');

        // Update mobile navigation
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
        const mobileBtn = document.querySelector(`.mobile-nav-btn[data-tab="${tabName}"]`);
        if (mobileBtn) mobileBtn.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');

        // Load tab-specific data
        switch(tabName) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'transactions':
                this.loadTransactions();
                break;
            case 'budgets':
                this.loadBudgets();
                break;
            case 'categories':
                this.loadCategories();
                break;
            case 'reports':
                this.loadReports();
                break;
            case 'goals':
                this.loadGoals();
                break;
            case 'recurring':
                this.loadRecurring();
                break;
        }

        localStorage.setItem('mrm_active_tab', tabName);
        
        // Close mobile menu if open
        const mobileNavContainer = document.getElementById('mobileNavContainer');
        if (mobileNavContainer) {
            mobileNavContainer.classList.remove('active');
        }
    }

    refreshCurrentTab() {
        const activeTab = document.querySelector('.tab-content.active').id;
        this.switchTab(activeTab);
    }

    // Dashboard Functions
    updateDashboard() {
        const stats = this.calculateStats();
        
        // Update summary cards with currency formatting
        document.getElementById('totalIncome').textContent = this.formatCurrency(stats.totalIncome);
        document.getElementById('totalExpenses').textContent = this.formatCurrency(stats.totalExpenses);
        document.getElementById('netBalance').textContent = this.formatCurrency(stats.netBalance);
        document.getElementById('savingsRate').textContent = stats.savingsRate + '%';

        // Update changes
        this.updateChangeIndicators(stats);

        // Update recent transactions
        this.updateRecentTransactions();

        // Update charts (with delay for mobile)
        if (this.isMobile) {
            setTimeout(() => this.updateCharts(), 300);
        } else {
            this.updateCharts();
        }
    }

    calculateStats() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const currentMonthTransactions = this.transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const lastMonthTransactions = this.transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
        });

        const currentIncome = currentMonthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const currentExpenses = currentMonthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const lastIncome = lastMonthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const lastExpenses = lastMonthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const netBalance = currentIncome - currentExpenses;
        const lastNetBalance = lastIncome - lastExpenses;
        const savingsRate = currentIncome > 0 ? Math.round((netBalance / currentIncome) * 100) : 0;
        const lastSavingsRate = lastIncome > 0 ? Math.round((lastNetBalance / lastIncome) * 100) : 0;

        return {
            totalIncome: currentIncome,
            totalExpenses: currentExpenses,
            netBalance: netBalance,
            savingsRate: savingsRate,
            changes: {
                income: this.calculatePercentageChange(currentIncome, lastIncome),
                expenses: this.calculatePercentageChange(currentExpenses, lastExpenses),
                balance: this.calculatePercentageChange(netBalance, lastNetBalance),
                savings: savingsRate - lastSavingsRate
            }
        };
    }

    calculatePercentageChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }

    updateChangeIndicators(stats) {
        const indicators = [
            { element: 'incomeChange', value: stats.changes.income },
            { element: 'expenseChange', value: stats.changes.expenses },
            { element: 'balanceChange', value: stats.changes.balance },
            { element: 'savingsChange', value: stats.changes.savings }
        ];

        indicators.forEach(indicator => {
            const element = document.getElementById(indicator.element);
            if (element) {
                const value = indicator.value;
                const sign = value >= 0 ? '+' : '';
                
                element.textContent = `${sign}${value}%`;
                element.className = `change-indicator ${value >= 0 ? 'positive' : 'negative'}`;
            }
        });
    }

    updateRecentTransactions() {
        const recentTransactions = this.transactions
            .slice()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, this.isMobile ? 3 : 5);

        const container = document.getElementById('recentTransactionsList');
        container.innerHTML = '';

        if (recentTransactions.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No transactions yet. Add your first transaction!</p>';
            return;
        }

        recentTransactions.forEach(transaction => {
            const category = this.getCategoryById(transaction.categoryId);
            const transactionEl = document.createElement('div');
            transactionEl.className = 'transaction-item';
            
            if (this.isMobile) {
                transactionEl.innerHTML = `
                    <div class="mobile-transaction-card">
                        <div class="transaction-header">
                            <div class="transaction-icon ${transaction.type}">
                                <i class="${category ? category.icon : 'fas fa-circle'}"></i>
                            </div>
                            <div class="transaction-info">
                                <h4>${transaction.description}</h4>
                                <p>${category ? category.name : 'Unknown'} • ${this.formatDate(transaction.date)}</p>
                            </div>
                            <div class="transaction-amount ${transaction.type}">
                                ${transaction.type === 'income' ? '+' : '-'}${this.formatCurrency(transaction.amount)}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                transactionEl.innerHTML = `
                    <div class="transaction-icon ${transaction.type}">
                        <i class="${category ? category.icon : 'fas fa-circle'}"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>${transaction.description}</h4>
                        <p>${category ? category.name : 'Unknown'}</p>
                    </div>
                    <div class="transaction-amount ${transaction.type}">
                        ${transaction.type === 'income' ? '+' : '-'}${this.formatCurrency(transaction.amount)}
                    </div>
                    <div class="transaction-date">
                        ${this.formatDate(transaction.date)}
                    </div>
                `;
            }
            
            container.appendChild(transactionEl);
        });
    }

    updateCharts() {
        if (this.isMobile) {
            this.updateMobileCharts();
        } else {
            this.updateDesktopCharts();
        }
    }

    updateMobileCharts() {
        // Simplified charts for mobile
        this.updateMonthlyTrendChart(true);
        this.updateCategoryChart(true);
    }

    updateDesktopCharts() {
        this.updateMonthlyTrendChart(false);
        this.updateCategoryChart(false);
    }

    updateMonthlyTrendChart(isMobile = false) {
        const canvas = document.getElementById('monthlyTrendChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');

        if (this.charts.monthlyTrend) {
            this.charts.monthlyTrend.destroy();
        }

        const monthlyData = this.getMonthlyTrendData();
        const currency = CURRENCY_CONFIG[this.currentCurrency];

        this.charts.monthlyTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.labels,
                datasets: [{
                    label: 'Income',
                    data: monthlyData.income,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: isMobile ? 3 : 4,
                    pointHoverRadius: isMobile ? 5 : 6
                }, {
                    label: 'Expenses',
                    data: monthlyData.expenses,
                    borderColor: '#ff4444',
                    backgroundColor: 'rgba(255, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: isMobile ? 3 : 4,
                    pointHoverRadius: isMobile ? 5 : 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { 
                            color: '#ffffff',
                            font: { size: isMobile ? 10 : 12 }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#cccccc',
                            font: { size: isMobile ? 8 : 10 }
                        },
                        grid: { color: '#444444' }
                    },
                    y: {
                        ticks: { 
                            color: '#cccccc',
                            font: { size: isMobile ? 8 : 10 },
                            callback: function(value) {
                                return currency.symbol + value.toLocaleString();
                            }
                        },
                        grid: { color: '#444444' }
                    }
                }
            }
        });
    }

    updateCategoryChart(isMobile = false) {
        const canvas = document.getElementById('categoryChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');

        if (this.charts.category) {
            this.charts.category.destroy();
        }

        const categoryData = this.getCategoryExpenseData();

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoryData.labels,
                datasets: [{
                    data: categoryData.data,
                    backgroundColor: categoryData.colors,
                    borderColor: '#2a2a2a',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'right',
                        labels: { 
                            color: '#ffffff',
                            padding: isMobile ? 10 : 15,
                            font: { size: isMobile ? 9 : 11 },
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    getMonthlyTrendData() {
        const months = [];
        const income = [];
        const expenses = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            
            const monthName = date.toLocaleDateString('en-US', { month: 'short' });
            months.push(monthName);

            const monthTransactions = this.transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear();
            });

            const monthIncome = monthTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            const monthExpenses = monthTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            income.push(monthIncome);
            expenses.push(monthExpenses);
        }

        return { labels: months, income, expenses };
    }

    getCategoryExpenseData() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const monthExpenses = this.transactions.filter(t => {
            const date = new Date(t.date);
            return t.type === 'expense' && 
                   date.getMonth() === currentMonth && 
                   date.getFullYear() === currentYear;
        });

        const categoryTotals = {};
        monthExpenses.forEach(transaction => {
            const category = this.getCategoryById(transaction.categoryId);
            const categoryName = category ? category.name : 'Other';
            const categoryColor = category ? category.color : '#666666';
            
            if (!categoryTotals[categoryName]) {
                categoryTotals[categoryName] = { total: 0, color: categoryColor };
            }
            categoryTotals[categoryName].total += transaction.amount;
        });

        const labels = Object.keys(categoryTotals);
        const data = labels.map(label => categoryTotals[label].total);
        const colors = labels.map(label => categoryTotals[label].color);

        return { labels, data, colors };
    }

    // Transaction Management (Enhanced for mobile)
    loadTransactions() {
        this.populateTransactionTable();
        this.populateFilterSelects();
        this.loadMobileTransactionList();
    }

    loadMobileTransactionList() {
        if (!this.isMobile) return;
        
        const container = document.getElementById('mobileTransactionList');
        if (!container) return;
        
        const transactions = this.transactions
            .slice()
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = '';

        if (transactions.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No transactions found</p>';
            return;
        }

        transactions.forEach(transaction => {
            const category = this.getCategoryById(transaction.categoryId);
            const transactionEl = document.createElement('div');
            transactionEl.className = 'mobile-transaction-item';
            transactionEl.innerHTML = `
                <div class="mobile-transaction-card">
                    <div class="transaction-header">
                        <div class="transaction-icon ${transaction.type}">
                            <i class="${category ? category.icon : 'fas fa-circle'}"></i>
                        </div>
                        <div class="transaction-info">
                            <h4>${transaction.description}</h4>
                            <p>${category ? category.name : 'Unknown'} • ${this.formatDate(transaction.date)}</p>
                        </div>
                        <div class="transaction-amount ${transaction.type}">
                            ${transaction.type === 'income' ? '+' : '-'}${this.formatCurrency(transaction.amount)}
                        </div>
                    </div>
                    <div class="transaction-actions">
                        <button class="action-btn-small edit" onclick="app.editTransaction(${transaction.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="action-btn-small delete" onclick="app.deleteTransaction(${transaction.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(transactionEl);
        });
    }

    populateTransactionTable(transactions = null) {
        if (this.isMobile) {
            this.loadMobileTransactionList();
            return;
        }

        const transactionsToShow = transactions || this.transactions;
        const tbody = document.getElementById('transactionTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (transactionsToShow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No transactions found</td></tr>';
            return;
        }

        const sortedTransactions = transactionsToShow
            .slice()
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedTransactions.forEach(transaction => {
            const category = this.getCategoryById(transaction.categoryId);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatDate(transaction.date)}</td>
                <td>${transaction.description}</td>
                <td>
                    <i class="${category ? category.icon : 'fas fa-circle'}" style="color: ${category ? category.color : '#666'}"></i>
                    ${category ? category.name : 'Unknown'}
                </td>
                <td class="amount-cell ${transaction.type}">
                    ${transaction.type === 'income' ? '+' : '-'}${this.formatCurrency(transaction.amount)}
                </td>
                <td>
                    <span class="type-badge ${transaction.type}">${transaction.type}</span>
                </td>
                <td>
                    <div class="action-buttons-table">
                        <button class="action-btn-small edit" onclick="app.editTransaction(${transaction.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn-small delete" onclick="app.deleteTransaction(${transaction.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    populateFilterSelects() {
        const categoryFilter = document.getElementById('categoryFilter');
        const mobileCategoryFilter = document.getElementById('mobileCategoryFilter');
        
        const populateSelect = (select) => {
            if (!select) return;
            
            select.innerHTML = '<option value="all">All Categories</option>';
            [...this.categories.income, ...this.categories.expense].forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                select.appendChild(option);
            });
        };

        populateSelect(categoryFilter);
        populateSelect(mobileCategoryFilter);
    }

    applyFilters() {
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        const typeFilter = document.getElementById('typeFilter')?.value;
        const categoryFilter = document.getElementById('categoryFilter')?.value;

        let filteredTransactions = this.transactions;

        // Date filter
        if (startDate) {
            filteredTransactions = filteredTransactions.filter(t => t.date >= startDate);
        }
        if (endDate) {
            filteredTransactions = filteredTransactions.filter(t => t.date <= endDate);
        }

        // Type filter
        if (typeFilter && typeFilter !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.type === typeFilter);
        }

        // Category filter
        if (categoryFilter && categoryFilter !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.categoryId == categoryFilter);
        }

        this.populateTransactionTable(filteredTransactions);
    }

    applyMobileFilters() {
        const startDate = document.getElementById('mobileStartDate')?.value;
        const endDate = document.getElementById('mobileEndDate')?.value;
        const categoryFilter = document.getElementById('mobileCategoryFilter')?.value;

        let filteredTransactions = this.transactions;

        if (startDate) {
            filteredTransactions = filteredTransactions.filter(t => t.date >= startDate);
        }
        if (endDate) {
            filteredTransactions = filteredTransactions.filter(t => t.date <= endDate);
        }
        if (categoryFilter && categoryFilter !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.categoryId == categoryFilter);
        }

        this.populateTransactionTable(filteredTransactions);
        this.toggleAdvancedFilters(); // Close filters
    }

    clearMobileFilters() {
        document.getElementById('mobileStartDate').value = '';
        document.getElementById('mobileEndDate').value = '';
        document.getElementById('mobileCategoryFilter').value = 'all';
        this.populateTransactionTable();
        this.toggleAdvancedFilters();
    }

    resetFilters() {
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        const typeFilter = document.getElementById('typeFilter');
        const categoryFilter = document.getElementById('categoryFilter');

        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';
        if (typeFilter) typeFilter.value = 'all';
        if (categoryFilter) categoryFilter.value = 'all';
        
        this.populateTransactionTable();
    }

    handleTransactionSubmit(e) {
        e.preventDefault();
        
        const transaction = {
            id: this.currentEditId || Date.now(),
            type: document.getElementById('transactionType').value,
            amount: parseFloat(document.getElementById('transactionAmount').value),
            description: document.getElementById('transactionDescription').value,
            categoryId: parseInt(document.getElementById('transactionCategory').value),
            date: document.getElementById('transactionDate').value,
            notes: document.getElementById('transactionNotes').value,
            createdAt: this.currentEditId ? this.getTransactionById(this.currentEditId).createdAt : new Date().toISOString()
        };

        if (this.currentEditId) {
            const index = this.transactions.findIndex(t => t.id === this.currentEditId);
            this.transactions[index] = transaction;
        } else {
            this.transactions.push(transaction);
        }

        this.saveData();
        this.closeModal('transactionModal');
        this.updateDashboard();
        
        if (document.getElementById('transactions').classList.contains('active')) {
            this.loadTransactions();
        }

        this.currentEditId = null;
        
        // Show success message
        this.showToast('Transaction saved successfully!', 'success');
    }

    editTransaction(id) {
        const transaction = this.getTransactionById(id);
        if (!transaction) return;

        this.currentEditId = id;
        
        document.getElementById('transactionModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Transaction';
        document.getElementById('transactionType').value = transaction.type;
        document.getElementById('transactionAmount').value = transaction.amount;
        document.getElementById('transactionDescription').value = transaction.description;
        document.getElementById('transactionCategory').value = transaction.categoryId;
        document.getElementById('transactionDate').value = transaction.date;
        document.getElementById('transactionNotes').value = transaction.notes || '';

        this.updateCategoryOptions();
        this.openModal('transactionModal');
    }

    deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveData();
            this.updateDashboard();
            
            if (document.getElementById('transactions').classList.contains('active')) {
                this.loadTransactions();
            }
            
            this.showToast('Transaction deleted successfully!', 'success');
        }
    }

    // Budget Management (same as before but with currency formatting)
    loadBudgets() {
        const container = document.getElementById('budgetsGrid');
        if (!container) return;

        container.innerHTML = '';

        if (this.budgets.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No budgets created yet. Create your first budget!</p>';
            return;
        }

        this.budgets.forEach(budget => {
            const category = this.getCategoryById(budget.categoryId);
            const spent = this.calculateBudgetSpent(budget);
            const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const remaining = budget.amount - spent;

            const budgetCard = document.createElement('div');
            budgetCard.className = 'budget-card';
            budgetCard.innerHTML = `
                <div class="budget-header">
                    <div class="budget-title">
                        <i class="${category ? category.icon : 'fas fa-circle'}" style="color: ${category ? category.color : '#666'}"></i>
                        <h3>${category ? category.name : 'Unknown'}</h3>
                    </div>
                    <div class="budget-amount">
                        <div class="budget-spent">${this.formatCurrency(spent)}</div>
                        <div class="budget-total">of ${this.formatCurrency(budget.amount)}</div>
                    </div>
                </div>
                <div class="budget-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${percentage.toFixed(1)}% used</span>
                        <span>${remaining >= 0 ? 'Remaining: ' + this.formatCurrency(remaining) : 'Over by: ' + this.formatCurrency(Math.abs(remaining))}</span>
                    </div>
                </div>
                <div class="budget-actions">
                    <button class="action-btn-small edit" onclick="app.editBudget(${budget.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn-small delete" onclick="app.deleteBudget(${budget.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            container.appendChild(budgetCard);
        });
    }

    calculateBudgetSpent(budget) {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        return this.transactions
            .filter(t => {
                const date = new Date(t.date);
                return t.type === 'expense' && 
                       t.categoryId === budget.categoryId &&
                       date.getMonth() === currentMonth && 
                       date.getFullYear() === currentYear;
            })
            .reduce((sum, t) => sum + t.amount, 0);
    }

    handleBudgetSubmit(e) {
        e.preventDefault();
        
        const budget = {
            id: Date.now(),
            categoryId: parseInt(document.getElementById('budgetCategory').value),
            amount: parseFloat(document.getElementById('budgetAmount').value),
            period: document.getElementById('budgetPeriodType').value,
            createdAt: new Date().toISOString()
        };

        // Check if budget already exists for this category
        const existingIndex = this.budgets.findIndex(b => b.categoryId === budget.categoryId);
        if (existingIndex >= 0) {
            this.budgets[existingIndex] = budget;
        } else {
            this.budgets.push(budget);
        }

        this.saveData();
        this.closeModal('budgetModal');
        this.loadBudgets();
        this.showToast('Budget created successfully!', 'success');
    }

    deleteBudget(id) {
        if (confirm('Are you sure you want to delete this budget?')) {
            this.budgets = this.budgets.filter(b => b.id !== id);
            this.saveData();
            this.loadBudgets();
            this.showToast('Budget deleted successfully!', 'success');
        }
    }

    // Category Management
    loadCategories() {
        this.populateIncomeCategoriesList();
        this.populateExpenseCategoriesList();
    }

    populateIncomeCategoriesList() {
        const container = document.getElementById('incomeCategoriesList');
        if (!container) return;

        container.innerHTML = '';

        this.categories.income.forEach(category => {
            const categoryItem = this.createCategoryItem(category);
            container.appendChild(categoryItem);
        });
    }

    populateExpenseCategoriesList() {
        const container = document.getElementById('expenseCategoriesList');
        if (!container) return;

        container.innerHTML = '';

        this.categories.expense.forEach(category => {
            const categoryItem = this.createCategoryItem(category);
            container.appendChild(categoryItem);
        });
    }

    createCategoryItem(category) {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            <div class="category-info">
                <div class="category-icon" style="background: ${category.color}20; color: ${category.color}">
                    <i class="${category.icon}"></i>
                </div>
                <span>${category.name}</span>
            </div>
            <div class="category-actions">
                <button class="action-btn-small edit" onclick="app.editCategory(${category.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn-small delete" onclick="app.deleteCategory(${category.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        return item;
    }

    handleCategorySubmit(e) {
        e.preventDefault();
        
        const category = {
            id: Date.now(),
            name: document.getElementById('categoryName').value,
            icon: document.getElementById('categoryIcon').value,
            color: document.getElementById('categoryColor').value
        };

        const type = document.getElementById('categoryType').value;
        this.categories[type].push(category);

        this.saveData();
        this.closeModal('categoryModal');
        this.loadCategories();
        this.populateCategorySelects();
        this.showToast('Category added successfully!', 'success');
    }

    deleteCategory(id) {
        if (confirm('Are you sure you want to delete this category? This will affect existing transactions.')) {
            this.categories.income = this.categories.income.filter(c => c.id !== id);
            this.categories.expense = this.categories.expense.filter(c => c.id !== id);
            this.saveData();
            this.loadCategories();
            this.populateCategorySelects();
            this.showToast('Category deleted successfully!', 'success');
        }
    }

    // Goal Management
    loadGoals() {
        const container = document.getElementById('goalsGrid');
        if (!container) return;

        container.innerHTML = '';

        if (this.goals.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No goals set yet. Set your first financial goal!</p>';
            return;
        }

        this.goals.forEach(goal => {
            const progress = this.calculateGoalProgress(goal);
            const goalCard = document.createElement('div');
            goalCard.className = 'goal-card';
            goalCard.innerHTML = `
                <div class="goal-header">
                    <div>
                        <h3>${goal.name}</h3>
                        <span class="goal-type-badge">${goal.type.replace('_', ' ')}</span>
                    </div>
                </div>
                <div class="goal-progress">
                    <div class="goal-amounts">
                        <span class="goal-current">${this.formatCurrency(progress.current)}</span>
                        <span class="goal-target">/ ${this.formatCurrency(goal.target)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(progress.percentage, 100)}%"></div>
                    </div>
                    <div class="goal-deadline">
                        Target: ${this.formatDate(goal.deadline)}
                    </div>
                </div>
                <div class="goal-actions">
                    <button class="action-btn-small delete" onclick="app.deleteGoal(${goal.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            container.appendChild(goalCard);
        });
    }

    calculateGoalProgress(goal) {
        let current = 0;
        const goalDate = new Date(goal.deadline);
        const currentDate = new Date();

        switch (goal.type) {
            case 'savings':
                current = this.transactions
                    .filter(t => t.type === 'income' && new Date(t.date) <= currentDate)
                    .reduce((sum, t) => sum + t.amount, 0) -
                    this.transactions
                    .filter(t => t.type === 'expense' && new Date(t.date) <= currentDate)
                    .reduce((sum, t) => sum + t.amount, 0);
                break;
            case 'income_increase':
                const currentMonthIncome = this.transactions
                    .filter(t => {
                        const date = new Date(t.date);
                        return t.type === 'income' && 
                               date.getMonth() === currentDate.getMonth() &&
                               date.getFullYear() === currentDate.getFullYear();
                    })
                    .reduce((sum, t) => sum + t.amount, 0);
                current = currentMonthIncome;
                break;
            case 'expense_reduction':
                const currentMonthExpenses = this.transactions
                    .filter(t => {
                        const date = new Date(t.date);
                        return t.type === 'expense' && 
                               date.getMonth() === currentDate.getMonth() &&
                               date.getFullYear() === currentDate.getFullYear();
                    })
                    .reduce((sum, t) => sum + t.amount, 0);
                current = goal.target - currentMonthExpenses;
                break;
        }

        const percentage = goal.target > 0 ? (current / goal.target) * 100 : 0;
        return { current: Math.max(0, current), percentage };
    }

    handleGoalSubmit(e) {
        e.preventDefault();
        
        const goal = {
            id: Date.now(),
            name: document.getElementById('goalName').value,
            type: document.getElementById('goalType').value,
            target: parseFloat(document.getElementById('goalTarget').value),
            deadline: document.getElementById('goalDeadline').value,
            createdAt: new Date().toISOString()
        };

        this.goals.push(goal);
        this.saveData();
        this.closeModal('goalModal');
        this.loadGoals();
        this.showToast('Goal set successfully!', 'success');
    }

    deleteGoal(id) {
        if (confirm('Are you sure you want to delete this goal?')) {
            this.goals = this.goals.filter(g => g.id !== id);
            this.saveData();
            this.loadGoals();
            this.showToast('Goal deleted successfully!', 'success');
        }
    }

    // Recurring Transactions
    loadRecurring() {
        const container = document.getElementById('recurringList');
        if (!container) return;

        container.innerHTML = '';

        if (this.recurringTransactions.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No recurring transactions set up yet.</p>';
            return;
        }

        this.recurringTransactions.forEach(recurring => {
            const category = this.getCategoryById(recurring.categoryId);
            const recurringItem = document.createElement('div');
            recurringItem.className = 'recurring-item';
            recurringItem.innerHTML = `
                <div class="transaction-icon ${recurring.type}">
                    <i class="${category ? category.icon : 'fas fa-circle'}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${recurring.description}</h4>
                    <p>${category ? category.name : 'Unknown'}</p>
                </div>
                <div class="recurring-frequency">${recurring.frequency}</div>
                <div class="transaction-amount ${recurring.type}">
                    ${recurring.type === 'income' ? '+' : '-'}${this.formatCurrency(recurring.amount)}
                </div>
                <div class="recurring-actions">
                    <button class="action-btn-small delete" onclick="app.deleteRecurring(${recurring.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(recurringItem);
        });
    }

    handleRecurringSubmit(e) {
        e.preventDefault();
        
        const recurring = {
            id: Date.now(),
            type: document.getElementById('recurringType').value,
            amount: parseFloat(document.getElementById('recurringAmount').value),
            description: document.getElementById('recurringDescription').value,
            categoryId: parseInt(document.getElementById('recurringCategory').value),
            frequency: document.getElementById('recurringFrequency').value,
            startDate: document.getElementById('recurringStartDate').value,
            lastProcessed: null,
            createdAt: new Date().toISOString()
        };

        this.recurringTransactions.push(recurring);
        this.saveData();
        this.closeModal('recurringModal');
        this.loadRecurring();
        this.showToast('Recurring transaction added successfully!', 'success');
    }

    deleteRecurring(id) {
        if (confirm('Are you sure you want to delete this recurring transaction?')) {
            this.recurringTransactions = this.recurringTransactions.filter(r => r.id !== id);
            this.saveData();
            this.loadRecurring();
            this.showToast('Recurring transaction deleted successfully!', 'success');
        }
    }

    processRecurringTransactions() {
        const today = new Date().toISOString().split('T')[0];
        let processed = 0;
        
        this.recurringTransactions.forEach(recurring => {
            if (this.shouldProcessRecurring(recurring, today)) {
                const transaction = {
                    id: Date.now() + Math.random(),
                    type: recurring.type,
                    amount: recurring.amount,
                    description: `${recurring.description} (Auto)`,
                    categoryId: recurring.categoryId,
                    date: today,
                    notes: 'Automatically generated from recurring transaction',
                    createdAt: new Date().toISOString()
                };

                this.transactions.push(transaction);
                recurring.lastProcessed = today;
                processed++;
            }
        });

        if (processed > 0) {
            this.saveData();
            this.showToast(`${processed} recurring transaction(s) processed!`, 'info');
        }
    }

    shouldProcessRecurring(recurring, today) {
        const startDate = new Date(recurring.startDate);
        const todayDate = new Date(today);
        const lastProcessed = recurring.lastProcessed ? new Date(recurring.lastProcessed) : null;

        if (todayDate < startDate) return false;

        if (!lastProcessed) {
            return todayDate >= startDate;
        }

        const daysDiff = Math.floor((todayDate - lastProcessed) / (1000 * 60 * 60 * 24));

        switch (recurring.frequency) {
            case 'daily':
                return daysDiff >= 1;
            case 'weekly':
                return daysDiff >= 7;
            case 'monthly':
                return daysDiff >= 30;
            case 'yearly':
                return daysDiff >= 365;
            default:
                return false;
        }
    }

    // Reports
    loadReports() {
        this.generateReport();
    }

    generateReport() {
        const reportType = document.getElementById('reportType')?.value || 'summary';
        const reportPeriod = document.getElementById('reportPeriod')?.value || 'month';
        const container = document.getElementById('reportContent');

        if (!container) return;

        container.innerHTML = '<div class="loading">Generating report...</div>';

        setTimeout(() => {
            switch (reportType) {
                case 'summary':
                    container.innerHTML = this.generateSummaryReport(reportPeriod);
                    break;
                case 'income':
                    container.innerHTML = this.generateIncomeReport(reportPeriod);
                    break;
                case 'expense':
                    container.innerHTML = this.generateExpenseReport(reportPeriod);
                    break;
                case 'cashflow':
                    container.innerHTML = this.generateCashflowReport(reportPeriod);
                    break;
                case 'category':
                    container.innerHTML = this.generateCategoryReport(reportPeriod);
                    break;
                default:
                    container.innerHTML = this.generateSummaryReport(reportPeriod);
            }
        }, 500);
    }

    generateSummaryReport(period) {
        const stats = this.getReportStats(period);
        return `
            <div class="report-summary">
                <h3>Financial Summary Report</h3>
                <div class="summary-cards">
                    <div class="card">
                        <h4>Total Income</h4>
                        <div class="card-value income">${this.formatCurrency(stats.totalIncome)}</div>
                    </div>
                    <div class="card">
                        <h4>Total Expenses</h4>
                        <div class="card-value expense">${this.formatCurrency(stats.totalExpenses)}</div>
                    </div>
                    <div class="card">
                        <h4>Net Profit/Loss</h4>
                        <div class="card-value ${stats.netBalance >= 0 ? 'income' : 'expense'}">${this.formatCurrency(stats.netBalance)}</div>
                    </div>
                    <div class="card">
                        <h4>Savings Rate</h4>
                        <div class="card-value">${stats.savingsRate}%</div>
                    </div>
                </div>
                <div class="report-details">
                    <p><strong>Report Period:</strong> ${this.getPeriodLabel(period)}</p>
                    <p><strong>Total Transactions:</strong> ${stats.totalTransactions}</p>
                    <p><strong>Average Income:</strong> ${this.formatCurrency(stats.avgIncome)}</p>
                    <p><strong>Average Expense:</strong> ${this.formatCurrency(stats.avgExpense)}</p>
                </div>
            </div>
        `;
    }

    generateIncomeReport(period) {
        const transactions = this.getTransactionsForPeriod(period).filter(t => t.type === 'income');
        const total = transactions.reduce((sum, t) => sum + t.amount, 0);
        
        return `
            <div class="report-income">
                <h3>Income Analysis Report</h3>
                <div class="report-total">
                    <h4>Total Income: <span class="income">${this.formatCurrency(total)}</span></h4>
                </div>
                <div class="transaction-list">
                    ${transactions.map(t => {
                        const category = this.getCategoryById(t.categoryId);
                        return `
                            <div class="transaction-item">
                                <span>${this.formatDate(t.date)}</span>
                                <span>${t.description}</span>
                                <span>${category ? category.name : 'Unknown'}</span>
                                <span class="income">${this.formatCurrency(t.amount)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    generateExpenseReport(period) {
        const transactions = this.getTransactionsForPeriod(period).filter(t => t.type === 'expense');
        const total = transactions.reduce((sum, t) => sum + t.amount, 0);
        
        return `
            <div class="report-expense">
                <h3>Expense Analysis Report</h3>
                <div class="report-total">
                    <h4>Total Expenses: <span class="expense">${this.formatCurrency(total)}</span></h4>
                </div>
                <div class="transaction-list">
                    ${transactions.map(t => {
                        const category = this.getCategoryById(t.categoryId);
                        return `
                            <div class="transaction-item">
                                <span>${this.formatDate(t.date)}</span>
                                <span>${t.description}</span>
                                <span>${category ? category.name : 'Unknown'}</span>
                                <span class="expense">${this.formatCurrency(t.amount)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    generateCashflowReport(period) {
        return `
            <div class="report-cashflow">
                <h3>Cash Flow Report</h3>
                <div class="cashflow-summary">
                    <p>This report shows your cash flow trends over time for ${this.getPeriodLabel(period)}.</p>
                </div>
            </div>
        `;
    }

    generateCategoryReport(period) {
        const transactions = this.getTransactionsForPeriod(period);
        const categoryData = {};
        
        transactions.forEach(transaction => {
            const category = this.getCategoryById(transaction.categoryId);
            const categoryName = category ? category.name : 'Unknown';
            
            if (!categoryData[categoryName]) {
                categoryData[categoryName] = { income: 0, expense: 0 };
            }
            
            categoryData[categoryName][transaction.type] += transaction.amount;
        });

        const categoryItems = Object.entries(categoryData).map(([name, data]) =>
            `<div class="category-report-item">
                <h4>${name}</h4>
                <div class="category-amounts">
                    <span class="income">Income: ${this.formatCurrency(data.income)}</span>
                    <span class="expense">Expenses: ${this.formatCurrency(data.expense)}</span>
                    <span class="net ${data.income - data.expense >= 0 ? 'income' : 'expense'}">
                        Net: ${this.formatCurrency(data.income - data.expense)}
                    </span>
                </div>
            </div>`
        ).join('');

        return `
            <div class="report-category">
                <h3>Category Breakdown Report</h3>
                <div class="category-report-list">
                    ${categoryItems}
                </div>
            </div>
        `;
    }

    getReportStats(period) {
        const transactions = this.getTransactionsForPeriod(period);
        const income = transactions.filter(t => t.type === 'income');
        const expenses = transactions.filter(t => t.type === 'expense');
        
        const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
        const netBalance = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;

        return {
            totalIncome,
            totalExpenses,
            netBalance,
            savingsRate,
            totalTransactions: transactions.length,
            avgIncome: income.length > 0 ? totalIncome / income.length : 0,
            avgExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0
        };
    }

    getTransactionsForPeriod(period) {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        return this.transactions.filter(t => new Date(t.date) >= startDate);
    }

    getPeriodLabel(period) {
        const now = new Date();
        switch (period) {
            case 'month':
                return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3) + 1;
                return `Q${quarter} ${now.getFullYear()}`;
            case 'year':
                return now.getFullYear().toString();
            default:
                return 'Current Period';
        }
    }

    // Modal Management
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Reset form if it's a new entry
        if (!this.currentEditId && modalId === 'transactionModal') {
            document.getElementById('transactionModalTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Add Transaction';
            document.getElementById('transactionForm').reset();
            document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
            this.updateCategoryOptions();
        }

        // Update currency symbols in modal
        this.updateCurrencySymbols();
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Reset form and edit state
        const form = modal.querySelector('form');
        if (form) form.reset();
        this.currentEditId = null;
    }

    // Utility Functions
    formatDate(dateString) {
        const date = new Date(dateString);
        const locale = CURRENCY_CONFIG[this.currentCurrency].locale;
        
        return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    getCategoryById(id) {
        const allCategories = [...this.categories.income, ...this.categories.expense];
        return allCategories.find(category => category.id === id);
    }

    getTransactionById(id) {
        return this.transactions.find(transaction => transaction.id === id);
    }

    populateCategorySelects() {
        const selects = ['transactionCategory', 'budgetCategory', 'recurringCategory'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '';
                
                // Add income categories
                const incomeGroup = document.createElement('optgroup');
                incomeGroup.label = 'Income Categories';
                this.categories.income.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    incomeGroup.appendChild(option);
                });
                select.appendChild(incomeGroup);

                // Add expense categories
                const expenseGroup = document.createElement('optgroup');
                expenseGroup.label = 'Expense Categories';
                this.categories.expense.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    expenseGroup.appendChild(option);
                });
                select.appendChild(expenseGroup);

                // Restore previous value
                if (currentValue) {
                    select.value = currentValue;
                }
            }
        });
    }

    updateCategoryOptions() {
        const type = document.getElementById('transactionType').value;
        const categorySelect = document.getElementById('transactionCategory');
        
        if (!categorySelect) return;

        categorySelect.innerHTML = '';
        
        const categories = type === 'income' ? this.categories.income : this.categories.expense;
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
    }

    updateRecurringCategoryOptions() {
        const type = document.getElementById('recurringType').value;
        const categorySelect = document.getElementById('recurringCategory');
        
        if (!categorySelect) return;

        categorySelect.innerHTML = '';
        
        const categories = type === 'income' ? this.categories.income : this.categories.expense;
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        
        const transactionDate = document.getElementById('transactionDate');
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        const recurringStartDate = document.getElementById('recurringStartDate');
        const goalDeadline = document.getElementById('goalDeadline');

        if (transactionDate) transactionDate.value = today;
        if (startDate) startDate.value = firstDayOfMonth;
        if (endDate) endDate.value = today;
        if (recurringStartDate) recurringStartDate.value = today;
        if (goalDeadline) goalDeadline.value = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
    }

    // Data Persistence
    saveData() {
        localStorage.setItem('mrm_transactions', JSON.stringify(this.transactions));
        localStorage.setItem('mrm_categories', JSON.stringify(this.categories));
        localStorage.setItem('mrm_budgets', JSON.stringify(this.budgets));
        localStorage.setItem('mrm_goals', JSON.stringify(this.goals));
        localStorage.setItem('mrm_recurring', JSON.stringify(this.recurringTransactions));
        localStorage.setItem('mrm_currency', this.currentCurrency);
    }

    // Import/Export Functions
    exportTransactions() {
        const data = {
            transactions: this.transactions,
            categories: this.categories,
            budgets: this.budgets,
            goals: this.goals,
            recurring: this.recurringTransactions,
            currency: this.currentCurrency,
            exportDate: new Date().toISOString(),
            version: '19.3'
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `mrm-export-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        this.showToast('Data exported successfully!', 'success');
    }

    importTransactions() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (confirm('This will replace all your current data. Are you sure?')) {
                        if (data.transactions) this.transactions = data.transactions;
                        if (data.categories) this.categories = data.categories;
                        if (data.budgets) this.budgets = data.budgets;
                        if (data.goals) this.goals = data.goals;
                        if (data.recurring) this.recurringTransactions = data.recurring;
                        if (data.currency) this.currentCurrency = data.currency;

                        this.saveData();
                        this.updateDashboard();
                        this.populateCategorySelects();
                        this.updateCurrencySymbols();
                        
                        this.showToast('Data imported successfully!', 'success');
                        
                        // Refresh current tab
                        const activeTab = document.querySelector('.tab-content.active').id;
                        this.switchTab(activeTab);
                    }
                } catch (error) {
                    this.showToast('Error importing data. Please check the file format.', 'error');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Hide toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    getToastIcon(type) {
        switch(type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    // Backup and Restore
    createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            data: {
                transactions: this.transactions,
                categories: this.categories,
                budgets: this.budgets,
                goals: this.goals,
                recurring: this.recurringTransactions,
                currency: this.currentCurrency
            }
        };
        
        localStorage.setItem('mrm_backup', JSON.stringify(backup));
        return backup;
    }

    restoreBackup() {
        const backup = localStorage.getItem('mrm_backup');
        if (!backup) {
            this.showToast('No backup found!', 'warning');
            return false;
        }

        try {
            const backupData = JSON.parse(backup);
            
            if (confirm(`Restore backup from ${new Date(backupData.timestamp).toLocaleString()}? This will replace all current data.`)) {
                this.transactions = backupData.data.transactions || [];
                this.categories = backupData.data.categories || this.getDefaultCategories();
                this.budgets = backupData.data.budgets || [];
                this.goals = backupData.data.goals || [];
                this.recurringTransactions = backupData.data.recurring || [];
                this.currentCurrency = backupData.data.currency || 'INR';

                this.saveData();
                this.updateDashboard();
                this.populateCategorySelects();
                this.updateCurrencySymbols();
                
                this.showToast('Backup restored successfully!', 'success');
                
                // Refresh current tab
                const activeTab = document.querySelector('.tab-content.active').id;
                this.switchTab(activeTab);
                
                return true;
            }
        } catch (error) {
            this.showToast('Error restoring backup!', 'error');
            console.error('Restore error:', error);
            return false;
        }
        
        return false;
    }
}

// Global Functions for HTML onclick events
function openTransactionModal(type) {
    if (type) {
        document.getElementById('transactionType').value = type;
        app.updateCategoryOptions();
    }
    app.openModal('transactionModal');
}

function openBudgetModal() {
    // Populate with expense categories only
    const budgetCategorySelect = document.getElementById('budgetCategory');
    if (budgetCategorySelect) {
        budgetCategorySelect.innerHTML = '';
        
        app.categories.expense.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            budgetCategorySelect.appendChild(option);
        });
    }
    
    app.openModal('budgetModal');
}

function openCategoryModal() {
    app.openModal('categoryModal');
}

function openGoalModal() {
    app.openModal('goalModal');
}

function openRecurringModal() {
    app.openModal('recurringModal');
}

function closeModal(modalId) {
    app.closeModal(modalId);
}

function applyFilters() {
    app.applyFilters();
}

function resetFilters() {
    app.resetFilters();
}

function exportTransactions() {
    app.exportTransactions();
}

function importTransactions() {
    app.importTransactions();
}

function generateReport() {
    app.generateReport();
}

function toggleAdvancedFilters() {
    const filters = document.getElementById('advancedFilters');
    if (filters) {
        filters.classList.toggle('hidden');
    }
}

function toggleFabMenu() {
    const fabMenu = document.getElementById('fabMenu');
    const fabIcon = document.getElementById('fabIcon');
    
    if (app.fabMenuOpen) {
        fabMenu.classList.remove('open');
        fabIcon.className = 'fas fa-plus';
        app.fabMenuOpen = false;
    } else {
        fabMenu.classList.add('open');
        fabIcon.className = 'fas fa-times';
        app.fabMenuOpen = true;
    }
}

function closeFabMenu() {
    const fabMenu = document.getElementById('fabMenu');
    const fabIcon = document.getElementById('fabIcon');
    
    fabMenu.classList.remove('open');
    fabIcon.className = 'fas fa-plus';
    app.fabMenuOpen = false;
}

function openQuickAddMenu() {
    toggleFabMenu();
}

function toggleChart(chartType) {
    // Future implementation for chart expand/collapse
    console.log('Toggle chart:', chartType);
}

// Initialize the application
let app;

document.addEventListener('DOMContentLoaded', function() {
    app = new MRMApp();
    
    // Auto-create backup every hour
    setInterval(() => {
        app.createBackup();
    }, 3600000);

    // Process recurring transactions daily
    setInterval(() => {
        app.processRecurringTransactions();
    }, 86400000);

    console.log('🇮🇳 MRM ERP v19.3 - World\'s Most Powerful Expense & Income Management Tool');
    console.log('💰 Now with Indian Rupee (₹) Support!');
    console.log('📱 PWA Ready - Install on Android & iOS');
    console.log('🔧 Developed by Anas Lila - ANAS LILA SOFTWARE');
    console.log('📅 Last Updated: August 14, 2025');
});

// Handle page visibility change to process recurring transactions when user returns
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && app) {
        app.processRecurringTransactions();
        app.updateDashboard();
    }
});

// Handle beforeunload to save data
window.addEventListener('beforeunload', function() {
    if (app) {
        app.saveData();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (!app) return;

    // Alt + I for Add Income
    if (e.altKey && e.key === 'i') {
        e.preventDefault();
        openTransactionModal('income');
    }
    
    // Alt + E for Add Expense  
    if (e.altKey && e.key === 'e') {
        e.preventDefault();
        openTransactionModal('expense');
    }
    
    // Alt + B for Create Budget
    if (e.altKey && e.key === 'b') {
        e.preventDefault();
        openBudgetModal();
    }
    
    // Alt + G for Set Goal
    if (e.altKey && e.key === 'g') {
        e.preventDefault();
        openGoalModal();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            closeModal(activeModal.id);
        }
        
        // Close FAB menu
        if (app.fabMenuOpen) {
            closeFabMenu();
        }
    }
});

// Service Worker Registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js').then(function(registration) {
            console.log('✅ ServiceWorker registration successful');
        }, function(err) {
            console.log('❌ ServiceWorker registration failed: ', err);
        });
    });
}

// Handle app installed event
window.addEventListener('appinstalled', function(e) {
    console.log('🎉 MRM ERP has been installed!');
    app.showToast('MRM ERP installed successfully! 🎉', 'success');
});
