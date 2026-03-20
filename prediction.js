// ═══════════════════════════════════════════════════════════
//  prediction.js
//  Calls Python ML server (ml_server.py) for AI predictions
//  Falls back to PHP predict.php if Python server is down
// ═══════════════════════════════════════════════════════════

const ML_SERVER_URL = 'http://localhost:5000/predict';
const PHP_FALLBACK  = 'http://localhost/miniproject/predict.php';

let predLat = null;
let predLon = null;

// ── Inject prediction section ─────────────────────────────
function injectPredictionSection() {
    if (document.getElementById('predictionSection')) return;

    const section = document.createElement('div');
    section.id = 'predictionSection';
    section.className = 'prediction-section';
    section.innerHTML = `
        <div class="pred-header">
            <div class="pred-title-row">
                <span class="pred-title">🤖 AI Pollution Forecast</span>
                <span class="pred-subtitle" id="predConfidence"></span>
            </div>
            <div class="pred-trend-row" id="predTrendRow"></div>
        </div>
        <div class="pred-cards" id="predCards">
            <div class="pred-loading">Fetching station data and running model…</div>
        </div>
        <div class="pred-warning-banner" id="predWarningBanner" style="display:none"></div>
        <div class="pred-news" id="predNews"></div>
        <div class="pred-source" id="predSource"></div>
    `;

    const sensor = document.getElementById('sensorPanel');
    const card   = document.getElementById('resultCard');
    if (sensor) {
        sensor.parentNode.insertBefore(section, sensor.nextSibling);
    } else if (card) {
        card.parentNode.insertBefore(section, card.nextSibling);
    } else {
        document.body.appendChild(section);
    }
}

// ── Render predictions ────────────────────────────────────
function renderPredictions(data) {
    const container = document.getElementById('predCards');
    const banner    = document.getElementById('predWarningBanner');
    const newsEl    = document.getElementById('predNews');
    const confEl    = document.getElementById('predConfidence');
    const trendEl   = document.getElementById('predTrendRow');
    const sourceEl  = document.getElementById('predSource');

    // Model badge
    if (confEl) {
        const modelColors = {
            'random_forest':    { bg: 'rgba(0,228,64,0.15)',    color: '#00e400', border: 'rgba(0,228,64,0.3)',    label: '🌲 Random Forest' },
            'linear_regression':{ bg: 'rgba(255,204,0,0.15)',   color: '#ffcc00', border: 'rgba(255,204,0,0.3)',   label: '📈 Linear Regression' },
            'mean_fallback':    { bg: 'rgba(139,0,139,0.15)',   color: '#bf5fbf', border: 'rgba(139,0,139,0.3)',   label: '📊 Mean Estimate' },
            'seasonal':         { bg: 'rgba(255,204,0,0.15)',   color: '#ffcc00', border: 'rgba(255,204,0,0.3)',   label: '🌐 Seasonal Estimate' },
        };
        const mc = modelColors[data.model] || modelColors['seasonal'];
        confEl.innerHTML = `
            <span class="conf-badge" style="background:${mc.bg};color:${mc.color};border:1px solid ${mc.border}">
                ${mc.label}
            </span>
            <span class="conf-level">Confidence: ${data.confidence}</span>
        `;
    }

    // Trend
    if (trendEl && data.trend && data.trend !== 'unknown') {
        const trendIcon  = data.trend === 'rising'  ? '📈' : data.trend === 'falling' ? '📉' : '➡️';
        const trendColor = data.trend === 'rising'  ? '#ff6b6b' : data.trend === 'falling' ? '#00e400' : '#ffcc00';
        trendEl.innerHTML = `
            <span style="color:${trendColor}">
                ${trendIcon} Pollution trend: <strong>${data.trend}</strong>
            </span>
            <span style="opacity:0.6;font-size:0.8rem;margin-left:8px">(${data.data_points} days of data)</span>
        `;
    }

    // 3-day cards
    if (container && data.predictions) {
        container.innerHTML = data.predictions.map(p => `
            <div class="pred-card" style="border-top:3px solid ${p.warning.color}">
                <div class="pred-card-label">${p.label}</div>
                <div class="pred-card-date">${p.date}</div>
                <div class="pred-card-aqi" style="color:${p.warning.color}">${p.aqi}</div>
                <div class="pred-card-aqi-label">Est. AQI</div>
                <div class="pred-card-level" style="color:${p.warning.color}">${p.warning.level}</div>
                ${p.warning.mask
                    ? `<div class="pred-mask-badge">😷 Mask recommended</div>`
                    : `<div class="pred-no-mask">✅ No mask needed</div>`}
            </div>
        `).join('');
    }

    // Warning banner — worst day
    if (banner && data.predictions) {
        const worst = data.predictions.reduce((a, b) => a.aqi > b.aqi ? a : b);
        banner.style.display = 'block';
        if (worst.aqi > 100) {
            banner.style.borderLeft = `4px solid ${worst.warning.color}`;
            banner.innerHTML = `
                <div class="banner-title" style="color:${worst.warning.color}">
                    ⚠️ ${worst.warning.message}
                </div>
                <ul class="banner-advice">
                    ${worst.warning.advice.map(a => `<li>${a}</li>`).join('')}
                </ul>`;
        } else {
            banner.style.borderLeft = `4px solid #00e400`;
            banner.innerHTML = `
                <div class="banner-title" style="color:#00e400">
                    ✅ ${data.predictions[0].warning.message}
                </div>`;
        }
    }

    // News context
    if (newsEl && data.news_context) {
        newsEl.innerHTML = `<span class="news-icon">📰</span><span class="news-text">${data.news_context}</span>`;
    }

    // Data source
    if (sourceEl && data.source) {
        sourceEl.innerHTML = `<span style="font-size:0.72rem;color:#8b949e;opacity:0.7">Data: ${data.source}</span>`;
    }
}

// ── Fetch from Python ML server, fallback to PHP ──────────
async function fetchPredictions(lat, lon) {
    const container = document.getElementById('predCards');

    // Try Python ML server first
    try {
        const url = `${ML_SERVER_URL}?lat=${lat}&lon=${lon}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
            const data = await res.json();
            renderPredictions(data);
            return;
        }
    } catch (err) {
        console.log('Python ML server not available, using PHP fallback');
    }

    // Fallback to PHP predict.php
    try {
        const res  = await fetch(PHP_FALLBACK);
        const data = await res.json();
        if (data.error) {
            if (container) container.innerHTML = `<div class="pred-loading">⚠️ ${data.error}</div>`;
            return;
        }
        // Add model info for PHP fallback
        data.model  = data.model || 'linear_regression';
        data.source = 'Seasonal patterns + your sensor data';
        renderPredictions(data);
    } catch (err) {
        if (container) container.innerHTML =
            `<div class="pred-loading">⚠️ Cannot reach prediction server — is XAMPP running?</div>`;
    }
}

// ── Called by sensor.js ───────────────────────────────────
window.loadPredictions = function(lat, lon) {
    predLat = lat;
    predLon = lon;
    injectPredictionSection();
    fetchPredictions(lat || 10.0527, lon || 76.3488);
};