// 529 Savings Calculator with Yahoo Finance API and Local Storage
class SavingsCalculator {
    constructor() {
        this.charts = {};
        this.etfPrice = null;
        this.priceFetchAttempted = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSavedData();
        this.setDefaultDate();
    }

    setupEventListeners() {
        document.getElementById('calculator-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.calculate();
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetCalculator();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportToCSV();
        });

        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveData();
        });

        // Auto-save when inputs change
        ['child-dob', 'goal-amount', 'etf-shares', 'etf-ticker', 'return-rate'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.saveData();
            });
        });

        // Fetch price when ticker changes or on first load
        document.getElementById('etf-ticker').addEventListener('change', () => {
            this.fetchETFPrice();
        });
    }

    setDefaultDate() {
        // Only set default if no saved data
        if (!localStorage.getItem('529-portfolio')) {
            document.getElementById('child-dob').value = '2024-08-13';
        }
    }
    async fetchETFPrice() {
        if (this.priceFetchAttempted) return;
        
        const ticker = document.getElementById('etf-ticker').value;
        const display = document.getElementById('current-value-display');
        
        display.classList.remove('hidden');
        display.classList.add('updating');
        this.priceFetchAttempted = true;

        // Show immediate fallback while trying to fetch
        this.etfPrice = this.getFallbackPrice(ticker);
        this.updateCurrentValueDisplay();
        this.displayPriceSource('Trying to fetch live price...');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                const livePrice = data.chart?.result?.[0]?.meta?.regularMarketPrice;
                if (livePrice) {
                    this.etfPrice = livePrice;
                    this.updateCurrentValueDisplay();
                    this.displayPriceSource(`Live price: ${new Date().toLocaleTimeString()}`);
                }
            }
        } catch (error) {
            console.log('Price fetch failed, using fallback:', error);
            this.displayPriceSource('Using approximate price (check connection)');
        }
        
        display.classList.remove('updating');
        this.saveData();
    }

    getFallbackPrice(ticker) {
        // Fallback prices (update these periodically)
        const fallbackPrices = {
            'SPY': 450,
            'VOO': 420,
            'IVV': 480
        };
        return fallbackPrices[ticker] || 450;
    }

    updateCurrentValueDisplay() {
        const shares = parseFloat(document.getElementById('etf-shares').value) || 0;
        
        if (this.etfPrice && shares > 0) {
            const currentValue = shares * this.etfPrice;
            const ticker = document.getElementById('etf-ticker').value;
            
            document.getElementById('current-portfolio-value').innerHTML = 
                `Current Value: <strong>${this.formatCurrency(currentValue)}</strong>`;
            
            this.displayPriceSource(
                `${shares} shares of ${ticker} @ ${this.formatCurrency(this.etfPrice)}`
            );
            
            document.getElementById('current-value-display').classList.remove('hidden');
        }
    }

    displayPriceSource(message) {
        document.getElementById('price-source').textContent = message;
    }

    getCurrentPortfolioValue() {
        const shares = parseFloat(document.getElementById('etf-shares').value) || 0;
        return shares * (this.etfPrice || this.getFallbackPrice(document.getElementById('etf-ticker').value));
    }

    calculate() {
        // Get input values
        const childDOB = document.getElementById('child-dob').value;
        const goalAmount = parseFloat(document.getElementById('goal-amount').value);
        const currentValue = this.getCurrentPortfolioValue();
        const annualReturn = parseFloat(document.getElementById('return-rate').value);

        // Validate inputs
        if (!this.validateInputs(childDOB, goalAmount)) {
            return;
        }

        // Calculate time remaining
        const { yearsRemaining, monthsRemaining, totalMonths } = this.calculateTimeRemaining(childDOB);
        
        if (totalMonths <= 0) {
            alert('Child is already 18 years or older. Please adjust the date of birth.');
            return;
        }

        // Calculate monthly contribution
        const monthlyContribution = this.calculateMonthlyContribution(
            goalAmount, currentValue, annualReturn, totalMonths
        );

        // Generate projection
        const projection = this.generateProjection(
            monthlyContribution, currentValue, annualReturn, totalMonths
        );

        // Display results
        this.displayResults(monthlyContribution, yearsRemaining, monthsRemaining, totalMonths, goalAmount);
        
        // Create charts
        this.createCharts(projection, goalAmount);

        // Show results section
        document.getElementById('results-section').classList.remove('hidden');

        // Auto-save after calculation
        this.saveData();
    }

    validateInputs(childDOB, goalAmount) {
        if (!childDOB) {
            alert('Please enter child\'s date of birth');
            return false;
        }

        if (!goalAmount || goalAmount <= 0) {
            alert('Please enter a valid goal amount');
            return false;
        }

        return true;
    }

    calculateTimeRemaining(dob) {
        const birthDate = new Date(dob);
        const targetDate = new Date(birthDate);
        targetDate.setFullYear(targetDate.getFullYear() + 18);
        
        const now = new Date();
        const diffTime = targetDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const yearsRemaining = Math.floor(diffDays / 365);
        const monthsRemaining = Math.floor((diffDays % 365) / 30);
        const totalMonths = yearsRemaining * 12 + monthsRemaining;

        return { yearsRemaining, monthsRemaining, totalMonths };
    }

    calculateMonthlyContribution(futureValue, currentValue, annualReturn, months) {
        if (months <= 0) return 0;
        
        const monthlyRate = annualReturn / 12;
        const futureCurrentValue = currentValue * Math.pow(1 + monthlyRate, months);
        const neededFromContributions = futureValue - futureCurrentValue;
        
        if (neededFromContributions <= 0) return 0;
        
        const annuityFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
        return neededFromContributions / annuityFactor;
    }

    generateProjection(monthlyContribution, currentValue, annualReturn, totalMonths) {
        const projection = [];
        const monthlyRate = annualReturn / 12;
        let balance = currentValue;
        let totalContributions = 0;
        let totalGrowth = 0;

        for (let month = 0; month <= totalMonths; month++) {
            if (month === 0) {
                projection.push({
                    month,
                    balance,
                    contributions: 0,
                    growth: 0,
                    totalContributions: 0,
                    totalGrowth: 0
                });
            } else {
                const monthlyGrowth = balance * monthlyRate;
                totalGrowth += monthlyGrowth;
                totalContributions += monthlyContribution;
                balance += monthlyContribution + monthlyGrowth;

                projection.push({
                    month,
                    balance,
                    contributions: monthlyContribution,
                    growth: monthlyGrowth,
                    totalContributions,
                    totalGrowth
                });
            }
        }

        return projection;
    }

    displayResults(monthlyContribution, years, months, totalMonths, goalAmount) {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        document.getElementById('monthly-contribution').textContent = formatter.format(monthlyContribution);
        document.getElementById('time-remaining').textContent = `${years} years, ${months} months`;
        document.getElementById('total-contributions').textContent = formatter.format(monthlyContribution * totalMonths);
        document.getElementById('investment-growth').textContent = formatter.format(goalAmount - (monthlyContribution * totalMonths));
    }

    createCharts(projection, goalAmount) {
        this.destroyCharts();

        // Growth Over Time Chart
        const growthCtx = document.getElementById('growth-chart').getContext('2d');
        this.charts.growth = new Chart(growthCtx, {
            type: 'line',
            data: {
                labels: projection.map(p => `Year ${Math.floor(p.month / 12)}`).filter((v, i, a) => a.indexOf(v) === i),
                datasets: [{
                    label: 'Portfolio Value',
                    data: projection.filter(p => p.month % 12 === 0).map(p => p.balance),
                    borderColor: '#2E86AB',
                    backgroundColor: 'rgba(46, 134, 171, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Projected Growth'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });

        // Contributions vs Growth Chart
        const breakdownCtx = document.getElementById('breakdown-chart').getContext('2d');
        const lastProjection = projection[projection.length - 1];
        
        this.charts.breakdown = new Chart(breakdownCtx, {
            type: 'doughnut',
            data: {
                labels: ['Your Contributions', 'Investment Growth'],
                datasets: [{
                    data: [lastProjection.totalContributions, lastProjection.totalGrowth],
                    backgroundColor: ['#A23B72', '#F18F01'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }

    saveData() {
        const data = {
            // User inputs
            childDOB: document.getElementById('child-dob').value,
            goalAmount: document.getElementById('goal-amount').value,
            returnRate: document.getElementById('return-rate').value,
            
            // ETF data
            etfShares: document.getElementById('etf-shares').value,
            etfTicker: document.getElementById('etf-ticker').value,
            etfPrice: this.etfPrice,
            
            // Metadata
            lastUpdated: new Date().toISOString(),
            priceFetchAttempted: this.priceFetchAttempted
        };
        
        localStorage.setItem('529-portfolio', JSON.stringify(data));
        console.log('Portfolio data saved');
    }

    loadSavedData() {
        const saved = localStorage.getItem('529-portfolio');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                
                // Load user inputs
                if (data.childDOB) document.getElementById('child-dob').value = data.childDOB;
                if (data.goalAmount) document.getElementById('goal-amount').value = data.goalAmount;
                if (data.returnRate) document.getElementById('return-rate').value = data.returnRate;
                
                // Load ETF data
                if (data.etfShares) document.getElementById('etf-shares').value = data.etfShares;
                if (data.etfTicker) document.getElementById('etf-ticker').value = data.etfTicker;
                if (data.etfPrice) this.etfPrice = data.etfPrice;
                
                // Load session state
                this.priceFetchAttempted = data.priceFetchAttempted || false;
                
                console.log('Loaded saved portfolio data from:', data.lastUpdated);
                
                // Update display with loaded data
                this.updateCurrentValueDisplay();
                
                // Fetch price if we haven't attempted it this session
                if (!this.priceFetchAttempted) {
                    setTimeout(() => this.fetchETFPrice(), 1000);
                }
                
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        } else {
            // No saved data - fetch price for default ticker
            setTimeout(() => this.fetchETFPrice(), 1000);
        }
    }

    resetCalculator() {
        if (confirm('Reset all data? This will clear your saved inputs.')) {
            localStorage.removeItem('529-portfolio');
            document.getElementById('calculator-form').reset();
            this.setDefaultDate();
            document.getElementById('results-section').classList.add('hidden');
            this.destroyCharts();
            this.priceFetchAttempted = false;
            this.etfPrice = null;
            document.getElementById('current-value-display').classList.add('hidden');
        }
    }

    exportToCSV() {
        alert('CSV export feature would be implemented here');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.calculator = new SavingsCalculator();
});