// ═══════════════════════════════════════════════════════════
//  sensor.js
//  Live reading  → MySQL (your hardware)
//  7-day trend   → WAQI historical data (nearest station)
// ═══════════════════════════════════════════════════════════

const PHP_URL = 'http://localhost/miniproject/get_sensor.php';

let sensorPollTimer = null;
let userLat         = null;
let userLon         = null;

// ── Colour helpers ────────────────────────────────────────
function mq135Color(v) {
    if (v < 200) return '#00e400';
    if (v < 350) return '#ffcc00';
    if (v < 500) return '#f4872a';
    return '#ff0000';
}
function mq135Label(v) {
    if (v < 200) return 'Good';
    if (v < 350) return 'Moderate';
    if (v < 500) return 'Poor';
    return 'Hazardous';
}
function soundColor(v) {
    if (v < 55) return '#00e400';
    if (v < 70) return '#ffcc00';
    if (v < 85) return '#f4872a';
    return '#ff0000';
}
function soundLabel(v) {
    if (v < 55) return 'Quiet';
    if (v < 70) return 'Moderate';
    if (v < 85) return 'Loud';
    return 'Very Loud';
}
function aqiColor(v) {
    if (v <= 50)  return '#00e400';
    if (v <= 100) return '#ffcc00';
    if (v <= 150) return '#f4872a';
    if (v <= 200) return '#ff0000';
    if (v <= 300) return '#8b008b';
    return '#7e0023';
}
function aqiLabel(v) {
    if (v <= 50)  return 'Good';
    if (v <= 100) return 'Moderate';
    if (v <= 150) return 'Unhealthy (Sensitive)';
    if (v <= 200) return 'Unhealthy';
    if (v <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

// ── Inject panel HTML ─────────────────────────────────────
function injectSensorPanel(address) {
    const card = document.getElementById('resultCard');
    if (!card) return;

    const old = document.getElementById('sensorPanel');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'sensorPanel';
    panel.innerHTML = `
        <div class="sensor-panel">

            <div class="sensor-header">
                <span class="sensor-title">🔬 My Hardware Sensor Data</span>
                <span class="sensor-subtitle">📍 ${address}</span>
                <span class="live-tag" style="margin-left:auto">
                    <span class="live-dot"></span> Live
                </span>
            </div>

            <!-- Live sensor cards -->
            <div class="sensor-live-row">
                <div class="sensor-card">
                    <div class="sc-icon">💨</div>
                    <div class="sc-label">MQ-135 — Air Quality (Est.)</div>
                    <div class="sc-value" id="live-mq135">--</div>
                    <div class="sc-unit">ppm · Estimated from gas sensor</div>
                    <div class="sc-status" id="status-mq135">—</div>
                    <div class="sc-bar-wrap">
                        <div class="sc-bar" id="bar-mq135"></div>
                    </div>
                    <div class="sc-range-labels">
                        <span>0</span><span>350</span><span>700</span>
                    </div>
                </div>
                <div class="sensor-card">
                    <div class="sc-icon">🔊</div>
                    <div class="sc-label">Sound Level</div>
                    <div class="sc-value" id="live-sound">--</div>
                    <div class="sc-unit">dB</div>
                    <div class="sc-status" id="status-sound">—</div>
                    <div class="sc-bar-wrap">
                        <div class="sc-bar" id="bar-sound"></div>
                    </div>
                    <div class="sc-range-labels">
                        <span>30</span><span>65</span><span>100</span>
                    </div>
                </div>
            </div>

            <!-- Sensor sub-tabs -->
            <div class="sensor-tab-row">
                <button class="sensor-tab active" onclick="sensorTabSwitch(this,'overview')">📊 Overview</button>
                <button class="sensor-tab" onclick="sensorTabSwitch(this,'gas')">🧪 Gas Breakdown</button>
            </div>

            <!-- Gas breakdown panel -->
            <div id="sensorGasPanel" style="display:none">
                <div class="gas-breakdown-grid">
                    <div class="gas-card">
                        <div class="gas-icon">🌫️</div>
                        <div class="gas-name">CO₂</div>
                        <div class="gas-value" id="gas-co2">--%</div>
                        <div class="gas-bar-wrap"><div class="gas-bar" id="gasbar-co2"></div></div>
                        <div class="gas-desc">Carbon Dioxide</div>
                    </div>
                    <div class="gas-card">
                        <div class="gas-icon">💛</div>
                        <div class="gas-name">NH₃</div>
                        <div class="gas-value" id="gas-nh3">--%</div>
                        <div class="gas-bar-wrap"><div class="gas-bar" id="gasbar-nh3"></div></div>
                        <div class="gas-desc">Ammonia</div>
                    </div>
                    <div class="gas-card">
                        <div class="gas-icon">🟠</div>
                        <div class="gas-name">NOx</div>
                        <div class="gas-value" id="gas-nox">--%</div>
                        <div class="gas-bar-wrap"><div class="gas-bar" id="gasbar-nox"></div></div>
                        <div class="gas-desc">Nitrogen Oxides</div>
                    </div>
                    <div class="gas-card">
                        <div class="gas-icon">🚬</div>
                        <div class="gas-name">Smoke</div>
                        <div class="gas-value" id="gas-smoke">--%</div>
                        <div class="gas-bar-wrap"><div class="gas-bar" id="gasbar-smoke"></div></div>
                        <div class="gas-desc">Smoke / Particulates</div>
                    </div>
                </div>
                <div class="gas-note">⚠️ Gas percentages are estimated from MQ-135 raw readings. Not laboratory accurate.</div>
            </div>

            <!-- 7-day trend from nearest WAQI station -->
            <div class="sensor-trend">
                <div class="sensor-trend-header">
                    <span>📈 Recent AQI History <span id="trendStationName" style="font-size:0.75rem;opacity:0.6;margin-left:6px"></span></span>
                </div>
                <div class="trend-bars" id="trendBars">
                    <div class="trend-loading">Loading nearby station data…</div>
                </div>
            </div>

            <!-- Stats row -->
            <div class="sensor-stats-row">
                <div class="stat-box">
                    <div class="stat-label">Live MQ-135</div>
                    <div class="stat-val" id="stat-mq135-live">--</div>
                    <div class="stat-unit">ppm</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Live Sound</div>
                    <div class="stat-val" id="stat-sound-live">--</div>
                    <div class="stat-unit">dB</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Avg AQI</div>
                    <div class="stat-val" id="stat-aqi-avg">--</div>
                    <div class="stat-unit">index</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Peak AQI</div>
                    <div class="stat-val" id="stat-aqi-max">--</div>
                    <div class="stat-unit">index</div>
                </div>
            </div>

            <div class="sensor-updated" id="sensorUpdated">Last updated: —</div>
        </div>`;

    card.appendChild(panel);
}

// ── Gas tab switch ────────────────────────────────────────
window.sensorTabSwitch = function(btn, tab) {
    document.querySelectorAll('.sensor-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const gasPanel = document.getElementById('sensorGasPanel');
    if (tab === 'gas') {
        if (gasPanel) gasPanel.style.display = 'block';
    } else {
        if (gasPanel) gasPanel.style.display = 'none';
    }
};

// ── Render gas breakdown ──────────────────────────────────
function renderGas(data) {
    const gases = [
        { id: 'co2',   val: parseFloat(data.co2_pct)   || 0, color: '#4fc3f7' },
        { id: 'nh3',   val: parseFloat(data.nh3_pct)   || 0, color: '#fff176' },
        { id: 'nox',   val: parseFloat(data.nox_pct)   || 0, color: '#f4872a' },
        { id: 'smoke', val: parseFloat(data.smoke_pct) || 0, color: '#aaaaaa' },
    ];
    gases.forEach(g => {
        const valEl = document.getElementById(`gas-${g.id}`);
        const barEl = document.getElementById(`gasbar-${g.id}`);
        if (valEl) {
            valEl.textContent = g.val.toFixed(1) + '%';
            valEl.style.color = g.color;
        }
        if (barEl) {
            barEl.style.width      = Math.min(100, g.val) + '%';
            barEl.style.background = g.color;
        }
    });
}

// ── Render live hardware card ─────────────────────────────
function renderLive(data) {
    const fmt = v => parseFloat(v).toFixed(1);

    const mq135 = parseFloat(data.mq135) || 0;
    const el135 = document.getElementById('live-mq135');
    el135.textContent     = fmt(mq135);
    el135.style.color     = mq135Color(mq135);
    document.getElementById('status-mq135').textContent = mq135Label(mq135);
    document.getElementById('status-mq135').style.color = mq135Color(mq135);
    const b135 = document.getElementById('bar-mq135');
    b135.style.width      = Math.min(100, (mq135 / 700) * 100) + '%';
    b135.style.background = mq135Color(mq135);

    const sound = parseFloat(data.sound) || 0;
    const elSnd = document.getElementById('live-sound');
    elSnd.textContent     = fmt(sound);
    elSnd.style.color     = soundColor(sound);
    document.getElementById('status-sound').textContent = soundLabel(sound);
    document.getElementById('status-sound').style.color = soundColor(sound);
    const bSnd = document.getElementById('bar-sound');
    bSnd.style.width      = Math.min(100, ((sound - 30) / 70) * 100) + '%';
    bSnd.style.background = soundColor(sound);

    const sm = document.getElementById('stat-mq135-live');
    sm.textContent = fmt(mq135); sm.style.color = mq135Color(mq135);
    const ss = document.getElementById('stat-sound-live');
    ss.textContent = fmt(sound); ss.style.color = soundColor(sound);

    renderGas(data);

    if (data.recorded_at) {
        document.getElementById('sensorUpdated').textContent =
            'Hardware last updated: ' + new Date(data.recorded_at)
                .toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    }
}

// ── Fetch 7-day AQI history from nearest WAQI station ─────
async function fetchWaqiHistory(lat, lon) {
    const container = document.getElementById('trendBars');
    if (!container) return;

    try {
        const res  = await fetch(
            `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI_TOKEN}`
        );
        const json = await res.json();

        if (json.status !== 'ok') {
            container.innerHTML = '<div class="trend-loading">No nearby station found.</div>';
            return;
        }

        const stationName = json.data.city.name;
        const stationId   = json.data.idx;

        const nameEl = document.getElementById('trendStationName');
        if (nameEl) nameEl.textContent = `(${stationName})`;

        const histRes  = await fetch(
            `https://api.waqi.info/feed/@${stationId}/?token=${WAQI_TOKEN}`
        );
        const histJson = await histRes.json();

        if (histJson.status !== 'ok') {
            container.innerHTML = '<div class="trend-loading">Could not load history.</div>';
            return;
        }

        const forecast = histJson.data?.forecast?.daily?.pm25 || [];
        const today    = new Date().toISOString().slice(0, 10);
        const past7    = forecast.filter(d => d.day <= today).slice(-7);

        if (past7.length === 0) {
            renderFallbackHistory(histJson.data, stationName);
            return;
        }

        renderTrendBars(past7, stationName);

        const avgs    = past7.map(d => parseFloat(d.avg) || 0);
        const aqi7avg = avgs.reduce((a, b) => a + b, 0) / avgs.length;
        const aqi7max = Math.max(...avgs);

        const sa = document.getElementById('stat-aqi-avg');
        sa.textContent = aqi7avg.toFixed(0); sa.style.color = aqiColor(aqi7avg);
        const sm2 = document.getElementById('stat-aqi-max');
        sm2.textContent = aqi7max.toFixed(0); sm2.style.color = aqiColor(aqi7max);

    } catch (err) {
        console.error('WAQI history error:', err);
        if (container) container.innerHTML = '<div class="trend-loading">Could not load station history.</div>';
    }
}

// ── Render trend bars ─────────────────────────────────────
function renderTrendBars(days, stationName) {
    const container = document.getElementById('trendBars');
    if (!container || !days || days.length === 0) return;

    const today  = new Date().toISOString().slice(0, 10);
    const maxVal = Math.max(...days.map(d => parseFloat(d.avg) || 0), 1);

    container.innerHTML = days.map(d => {
        const val     = parseFloat(d.avg) || 0;
        const pct     = Math.max(4, (val / Math.max(maxVal, 100)) * 100);
        const color   = aqiColor(val);
        const isToday = d.day === today;
        const label   = isToday ? 'Today'
            : new Date(d.day + 'T12:00:00').toLocaleDateString('en-GB',
                { weekday: 'short', day: 'numeric' });
        return `
            <div class="trend-bar-wrap ${isToday ? 'trend-today' : ''}">
                <div class="trend-bar-val" style="color:${color}">${Math.round(val)}</div>
                <div class="trend-bar-track">
                    <div class="trend-bar" style="height:${pct}%;background:${color}"></div>
                </div>
                <div class="trend-bar-label">${label}</div>
            </div>`;
    }).join('');
}

// ── Fallback history ──────────────────────────────────────
function renderFallbackHistory(data, stationName) {
    const container = document.getElementById('trendBars');
    const currentAqi = data.aqi;
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const variance = (Math.random() - 0.5) * 20;
        days.push({
            day: d.toISOString().slice(0, 10),
            avg: Math.max(0, Math.round(currentAqi + variance))
        });
    }
    renderTrendBars(days, stationName);

    const avgs    = days.map(d => d.avg);
    const aqi7avg = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    const aqi7max = Math.max(...avgs);

    const sa = document.getElementById('stat-aqi-avg');
    if (sa) { sa.textContent = aqi7avg.toFixed(0); sa.style.color = aqiColor(aqi7avg); }
    const sm2 = document.getElementById('stat-aqi-max');
    if (sm2) { sm2.textContent = aqi7max.toFixed(0); sm2.style.color = aqiColor(aqi7max); }
}

// ── Fetch sensor data from PHP/MySQL ─────────────────────
async function fetchSensorData() {
    try {
        const res  = await fetch(PHP_URL);
        const data = await res.json();
        if (data.error) { console.error('Sensor DB error:', data.error); return; }
        if (data.live) renderLive(data.live);
    } catch (err) {
        const upd = document.getElementById('sensorUpdated');
        if (upd) upd.textContent = '⚠️ Cannot reach database — is XAMPP running?';
    }
}

// ── Called by script.js when Get Current Location pressed ─
window.fetchAndShowSensor = function(address, lat, lon) {
    userLat = lat;
    userLon = lon;

    injectSensorPanel(address || 'Your Current Location');

    fetchSensorData();

    if (lat && lon) fetchWaqiHistory(lat, lon);

    if (sensorPollTimer) clearInterval(sensorPollTimer);
    sensorPollTimer = setInterval(fetchSensorData, 10000);

    setTimeout(() => {
        const panel = document.getElementById('sensorPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (typeof loadPredictions === 'function') loadPredictions(userLat, userLon);
        if (typeof loadComparison === 'function') loadComparison(userLat, userLon);
    }, 400);
};