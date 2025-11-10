// 529 Savings Calculator Main Application
class SavingsCalculator {
    constructor() {
        this.charts = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDate();
        this.loadSavedScenarios();
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
            this.saveScenario();
        });
    }

    setDefaultDate() {
        // Set default date to August 13, 2024
        document.getElementById('child-dob').value = '2024-08-13';
    }

    calculate() {
        // Get input values
        const childDOB = document.getElementById('child-dob').value;
        const goalAmount = parseFloat(document.getElementById('goal-amount').value);
        const currentValue = parseFloat(document.getElementById('current-value').value) || 0;
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
        // Smart currency formatting - show cents for smaller amounts, whole dollars for larger
        const formatCurrency = (amount) => {
            if (amount >= 1000) {
                // For larger amounts, round to whole dollars
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(Math.round(amount));
            } else {
                // For smaller amounts, show cents
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(amount);
            }
        };

        document.getElementById('monthly-contribution').textContent = formatCurrency(monthlyContribution);
        document.getElementById('time-remaining').textContent = `${years} years, ${months} months`;
        document.getElementById('total-contributions').textContent = formatCurrency(monthlyContribution * totalMonths);
        document.getElementById('investment-growth').textContent = formatCurrency(goalAmount - (monthlyContribution * totalMonths));
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

    resetCalculator() {
        document.getElementById('calculator-form').reset();
        this.setDefaultDate();
        document.getElementById('results-section').classList.add('hidden');
        this.destroyCharts();
    }

    exportToCSV() {
        alert('CSV export feature would be implemented here');
        // Implementation for CSV export
    }

    saveScenario() {
        alert('Scenario save feature would be implemented here');
        // Implementation for saving scenarios to localStorage
    }

    loadSavedScenarios() {
        // Implementation for loading saved scenarios
    }
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
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
    new SavingsCalculator();
});