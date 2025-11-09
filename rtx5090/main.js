// RTX 5090 Optimization Whitepaper - Interactive JavaScript

// Initialize all components when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initTypewriter();
    initCounters();
    initCharts();
    initModelConfigurator();
    initScrollAnimations();
    initNavigation();
});

// Typewriter effect for hero section
function initTypewriter() {
    const typewriterElement = document.getElementById('typewriter');
    if (typewriterElement) {
        const typed = new Typed('#typewriter', {
            strings: [
                '32GB GDDR7 VRAM Sweet Spot',
                '1.79 TB/s Memory Bandwidth',
                'Hybrid AI Architecture',
                'Professional Grade Performance'
            ],
            typeSpeed: 50,
            backSpeed: 30,
            backDelay: 2000,
            loop: true,
            showCursor: false
        });
    }
}

// Animated counters for metrics
function initCounters() {
    const counters = document.querySelectorAll('.metric-counter');
    
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const target = parseFloat(element.getAttribute('data-target'));
    const duration = 2000;
    const start = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = target * easeOut;
        
        if (target >= 10) {
            element.textContent = Math.floor(current);
        } else {
            element.textContent = current.toFixed(2);
        }
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target >= 10 ? target : target.toFixed(2);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// Initialize performance charts
function initCharts() {
    initPerformanceChart();
    initVRAMChart();
}

function initPerformanceChart() {
    const chartElement = document.getElementById('performanceChart');
    if (!chartElement) return;
    
    const chart = echarts.init(chartElement);
    
    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#1a1a1a',
            borderColor: '#b8860b',
            textStyle: { color: '#e0e0e0' }
        },
        legend: {
            data: ['RTX 5090', 'RTX 4090'],
            textStyle: { color: '#e0e0e0' },
            top: 10
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: ['8B Q4', '30B Q4', '70B IQ2', '70B Q4'],
            axisLine: { lineStyle: { color: '#444' } },
            axisLabel: { color: '#a0a0a0' }
        },
        yAxis: {
            type: 'value',
            name: 'Tokens/sec',
            nameTextStyle: { color: '#a0a0a0' },
            axisLine: { lineStyle: { color: '#444' } },
            axisLabel: { color: '#a0a0a0' },
            splitLine: { lineStyle: { color: '#333' } }
        },
        series: [
            {
                name: 'RTX 5090',
                type: 'line',
                data: [200, 85, 65, 45],
                lineStyle: { color: '#b8860b', width: 3 },
                itemStyle: { color: '#b8860b' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(184, 134, 11, 0.3)' },
                            { offset: 1, color: 'rgba(184, 134, 11, 0.1)' }
                        ]
                    }
                }
            },
            {
                name: 'RTX 4090',
                type: 'line',
                data: [150, 60, 40, 25],
                lineStyle: { color: '#00d4ff', width: 3 },
                itemStyle: { color: '#00d4ff' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
                            { offset: 1, color: 'rgba(0, 212, 255, 0.1)' }
                        ]
                    }
                }
            }
        ]
    };
    
    chart.setOption(option);
    
    // Animate chart on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                chart.resize();
                observer.unobserve(entry.target);
            }
        });
    });
    observer.observe(chartElement);
}

function initVRAMChart() {
    const chartElement = document.getElementById('vramChart');
    if (!chartElement) return;
    
    const chart = echarts.init(chartElement);
    
    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            backgroundColor: '#1a1a1a',
            borderColor: '#00d4ff',
            textStyle: { color: '#e0e0e0' }
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            textStyle: { color: '#e0e0e0' }
        },
        series: [
            {
                name: 'VRAM Usage',
                type: 'pie',
                radius: '50%',
                data: [
                    { value: 16, name: 'Qwen3-Coder-30B (Q4)', itemStyle: { color: '#b8860b' } },
                    { value: 21, name: 'Llama 3.1 70B (IQ2)', itemStyle: { color: '#00d4ff' } },
                    { value: 5, name: 'granite-8b-qiskit', itemStyle: { color: '#888' } },
                    { value: 10, name: 'Available VRAM', itemStyle: { color: '#444' } }
                ],
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ]
    };
    
    chart.setOption(option);
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                chart.resize();
                observer.unobserve(entry.target);
            }
        });
    });
    observer.observe(chartElement);
}

// Model configurator functionality
function initModelConfigurator() {
    const modelSize = document.getElementById('modelSize');
    const quantMethod = document.getElementById('quantMethod');
    const useCase = document.getElementById('useCase');
    
    if (!modelSize || !quantMethod || !useCase) return;
    
    // Configuration data
    const configData = {
        '30B': {
            'Q4_K_M': { vram: 16, speed: 85, efficiency: 92, cost: 0 },
            'IQ2_XS': { vram: 12, speed: 95, efficiency: 88, cost: 0 },
            'AWQ': { vram: 15, speed: 90, efficiency: 94, cost: 0 },
            'EXL2': { vram: 14, speed: 88, efficiency: 96, cost: 0 }
        },
        '70B': {
            'Q4_K_M': { vram: 42, speed: 25, efficiency: 45, cost: 0 },
            'IQ2_XS': { vram: 21, speed: 65, efficiency: 75, cost: 0 },
            'AWQ': { vram: 40, speed: 30, efficiency: 50, cost: 0 },
            'EXL2': { vram: 38, speed: 28, efficiency: 55, cost: 0 }
        },
        '8B': {
            'Q4_K_M': { vram: 5, speed: 200, efficiency: 98, cost: 0 },
            'IQ2_XS': { vram: 3, speed: 220, efficiency: 95, cost: 0 },
            'AWQ': { vram: 4.5, speed: 210, efficiency: 99, cost: 0 },
            'EXL2': { vram: 4, speed: 205, efficiency: 97, cost: 0 }
        }
    };
    
    // Use case multipliers
    const useCaseMultipliers = {
        'coding': { speed: 1.0, efficiency: 1.0, cost: 0 },
        'security': { speed: 0.8, efficiency: 1.2, cost: 15 },
        'quantum': { speed: 1.1, efficiency: 0.9, cost: 20 }
    };
    
    function updateConfiguration() {
        const model = modelSize.value;
        const quant = quantMethod.value;
        const useCaseValue = useCase.value;
        
        const baseConfig = configData[model][quant];
        const multipliers = useCaseMultipliers[useCaseValue];
        
        // Calculate adjusted values
        const vramUsage = baseConfig.vram;
        const tokenSpeed = Math.round(baseConfig.speed * multipliers.speed);
        const efficiency = Math.round(baseConfig.efficiency * multipliers.efficiency);
        const costPerHour = multipliers.cost;
        
        // Update display
        document.getElementById('vramUsage').textContent = vramUsage;
        document.getElementById('tokenSpeed').textContent = tokenSpeed;
        document.getElementById('memoryBandwidth').textContent = efficiency + '%';
        document.getElementById('costPerHour').textContent = costPerHour ? '$' + costPerHour : 'Free';
        
        // Add visual feedback
        const results = document.getElementById('configResults');
        results.style.transform = 'scale(1.05)';
        setTimeout(() => {
            results.style.transform = 'scale(1)';
        }, 200);
    }
    
    // Event listeners
    modelSize.addEventListener('change', updateConfiguration);
    quantMethod.addEventListener('change', updateConfiguration);
    useCase.addEventListener('change', updateConfiguration);
    
    // Initial update
    updateConfiguration();
}

// Scroll animations
function initScrollAnimations() {
    const elements = document.querySelectorAll('.scroll-reveal');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                anime({
                    targets: entry.target,
                    opacity: [0, 1],
                    translateY: [30, 0],
                    duration: 800,
                    easing: 'easeOutCubic',
                    delay: anime.stagger(100)
                });
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    elements.forEach(element => observer.observe(element));
}

// Navigation functionality
function initNavigation() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Navigation background on scroll
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('nav');
        if (window.scrollY > 100) {
            nav.classList.add('bg-opacity-95');
        } else {
            nav.classList.remove('bg-opacity-95');
        }
    });
}

// Performance optimization utilities
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Resize handler for charts
window.addEventListener('resize', debounce(() => {
    const charts = document.querySelectorAll('[id$="Chart"]');
    charts.forEach(chartElement => {
        const chart = echarts.getInstanceByDom(chartElement);
        if (chart) {
            chart.resize();
        }
    });
}, 250));

// Add loading states and error handling
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="flex items-center justify-center h-32"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-copper"></div></div>';
    }
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="text-red-400 text-center p-4">${message}</div>`;
    }
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        animateCounter,
        updateConfiguration: () => {} // Placeholder for testing
    };
}