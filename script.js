const WAQI_TOKEN = '7b1c52a83caf5d33a7c857f682ca9bbd5f041ddc';
const OWM_KEY    = '389cdf2017187fb384e77ca4ea812b62';
let map, markers = [], userLocationMarker = null;

// ── Station aliases ───────────────────────────────────────────────────────────
const STATION_ALIASES = {
    'bahrain': '@9288', 'kingdom of bahrain': '@9288', 'manama': '@9288',
    'manamah': '@9288', 'riffa': '@9288', 'muharraq': '@9288',
    'hamad town': '@9288', 'isa town': '@9288', 'sitra': '@9288',
    'budaiya': '@9288', 'jidhafs': '@9288', 'zinj': '@9288',
    'tubli': '@9288', 'hidd': '@9288', 'arad': '@9288',
    'sanabis': '@9288', 'adliya': '@9288', 'bahrain city': '@9288', 'bh': '@9288',

    'maldives': 'A503515', 'republic of maldives': 'A503515', 'male': 'A503515',
    'malé': 'A503515', 'hulhumale': 'A503515', 'hulhumalé': 'A503515',
    'addu city': 'A503515', 'fuvahmulah': 'A503515', 'mv': 'A503515',

    'qatar': 'qatar/doha/us-embassy', 'state of qatar': 'qatar/doha/us-embassy',
    'doha': 'qatar/doha/us-embassy', 'ad dawhah': 'qatar/doha/us-embassy',
    'al rayyan': 'qatar/doha/us-embassy', 'al wakrah': 'qatar/doha/us-embassy',
    'al khor': 'qatar/doha/us-embassy', 'lusail': 'qatar/doha/us-embassy',
    'mesaieed': 'qatar/doha/us-embassy', 'dukhan': 'qatar/doha/us-embassy', 'qa': 'qatar/doha/us-embassy',

    'uae': 'dubai', 'united arab emirates': 'dubai', 'dubai': 'dubai',
    'abu dhabi': 'abu-dhabi', 'abudhabi': 'abu-dhabi', 'sharjah': 'sharjah',
    'ajman': 'ajman', 'fujairah': 'fujairah', 'ras al khaimah': 'ras-al-khaimah',
    'rak': 'ras-al-khaimah', 'umm al quwain': 'umm-al-quwain',
    'al ain': 'al-ain', 'alain': 'al-ain',

    'saudi arabia': 'riyadh', 'kingdom of saudi arabia': 'riyadh',
    'ksa': 'riyadh', 'saudi': 'riyadh', 'riyadh': 'riyadh',
    'jeddah': 'jeddah', 'jedda': 'jeddah', 'mecca': 'mecca', 'makkah': 'mecca',
    'medina': 'medina', 'madinah': 'medina', 'dammam': 'dammam',
    'khobar': 'khobar', 'al khobar': 'khobar', 'dhahran': 'dhahran',
    'jubail': 'jubail', 'tabuk': 'tabuk', 'abha': 'abha', 'taif': 'taif',

    'oman': 'muscat', 'sultanate of oman': 'muscat', 'muscat': 'muscat',
    'matrah': 'muscat', 'seeb': 'muscat', 'sohar': 'muscat',
    'salalah': 'salalah', 'nizwa': 'muscat', 'om': 'muscat',

    'myanmar': 'maynmar/rangoon/us-embassy', 'burma': 'maynmar/rangoon/us-embassy',
    'yangon': 'maynmar/rangoon/us-embassy', 'rangoon': 'maynmar/rangoon/us-embassy',
    'naypyidaw': 'maynmar/rangoon/us-embassy', 'mandalay': 'maynmar/rangoon/us-embassy',

    'cambodia': 'phnom penh', 'phnom penh': 'phnom penh',
    'siem reap': 'siem reap', 'kampong speu': 'kampong speu',

    'laos': 'laos/vientiane/us-embassy', 'lao pdr': 'laos/vientiane/us-embassy',
    'lao': 'laos/vientiane/us-embassy', 'vientiane': 'laos/vientiane/us-embassy',
    'luang prabang': 'laos/vientiane/us-embassy', 'pakse': 'laos/vientiane/us-embassy',
};

function resolveQuery(input) {
    const key = input.trim().toLowerCase();
    if (STATION_ALIASES[key]) return STATION_ALIASES[key];
    for (const [alias, station] of Object.entries(STATION_ALIASES)) {
        if (key.includes(alias) || alias.includes(key)) return station;
    }
    return input.trim();
}

// ── Precautions ───────────────────────────────────────────────────────────────
const PRECAUTIONS = {
    good: {
        label: 'Good', color: '#00e400', icon: '✅',
        items: [
            { icon: '🏃', text: 'Great day for outdoor exercise and activities' },
            { icon: '🪟', text: 'Open windows to enjoy fresh air indoors' },
            { icon: '🌿', text: 'Ideal for gardening or outdoor sports' },
            { icon: '😊', text: 'No precautions needed for most people' },
        ]
    },
    moderate: {
        label: 'Moderate', color: '#ffcc00', icon: '⚠️',
        items: [
            { icon: '😮‍💨', text: 'Sensitive individuals should limit prolonged outdoor exertion' },
            { icon: '🤧', text: 'People with allergies: consider wearing a mask outdoors' },
            { icon: '🪟', text: 'Reduce ventilation if you notice unusual smells' },
            { icon: '💊', text: 'Asthma or lung condition? Keep inhaler accessible' },
        ]
    },
    poor: {
        label: 'Poor', color: '#f4872a', icon: '🟠',
        items: [
            { icon: '😷', text: 'Wear a N95/KN95 mask when going outdoors' },
            { icon: '🏠', text: 'Keep windows and doors closed when possible' },
            { icon: '🚶', text: 'Avoid heavy outdoor exercise; opt for indoors' },
            { icon: '👴', text: 'Elderly, children, and pregnant women should stay indoors' },
            { icon: '🌬️', text: 'Use air purifiers with HEPA filters indoors' },
        ]
    },
    unhealthy: {
        label: 'Unhealthy', color: '#ff0000', icon: '🔴',
        items: [
            { icon: '🚫', text: 'Avoid all outdoor physical activity' },
            { icon: '😷', text: 'Always wear a N95 mask if you must go out' },
            { icon: '🏠', text: 'Stay indoors with windows tightly shut' },
            { icon: '💨', text: 'Run air purifiers continuously' },
            { icon: '🏥', text: 'Seek medical help if you experience breathing difficulty' },
            { icon: '🐾', text: 'Limit outdoor time for pets as well' },
        ]
    },
    severe: {
        label: 'Severe', color: '#8f3f97', icon: '🟣',
        items: [
            { icon: '🚨', text: 'Health emergency — stay indoors at all times' },
            { icon: '😷', text: 'Do not go outdoors without a respirator mask' },
            { icon: '🏥', text: 'Vulnerable groups should consult a doctor immediately' },
            { icon: '🚗', text: 'Avoid driving — use AC with recirculation mode' },
            { icon: '💧', text: 'Stay hydrated; pollution increases respiratory stress' },
            { icon: '📞', text: 'Check on elderly neighbors and family members' },
        ]
    },
    hazardous: {
        label: 'Hazardous', color: '#7e0023', icon: '☣️',
        items: [
            { icon: '🚨', text: 'Extreme health hazard — all outdoor activity banned' },
            { icon: '🏠', text: 'Seal gaps in windows and doors with tape if possible' },
            { icon: '😷', text: 'Wear respirator even indoors if air quality is compromised' },
            { icon: '🏥', text: 'Emergency services on alert — call for help if unwell' },
            { icon: '📺', text: 'Follow official government health advisories' },
            { icon: '🚫', text: 'Schools and offices may be advised to close' },
        ]
    }
};

function getPrecautionLevel(aqi) {
    if (aqi <= 50)  return 'good';
    if (aqi <= 100) return 'moderate';
    if (aqi <= 150) return 'poor';
    if (aqi <= 200) return 'unhealthy';
    if (aqi <= 300) return 'severe';
    return 'hazardous';
}

// ── AQI helpers ───────────────────────────────────────────────────────────────
function aqiColor(v) {
    v = parseInt(v);
    if (v <= 50)  return '#00e400';
    if (v <= 100) return '#ffcc00';
    if (v <= 150) return '#f4872a';
    if (v <= 200) return '#ff0000';
    if (v <= 300) return '#8f3f97';
    return '#7e0023';
}

function aqiLabel(v) {
    if (v <= 50)  return 'Good';
    if (v <= 100) return 'Moderate';
    if (v <= 150) return 'Poor';
    if (v <= 200) return 'Unhealthy';
    if (v <= 300) return 'Severe';
    return 'Hazardous';
}

function aqiBadgeClass(aqi) {
    if (aqi <= 50)  return 'green';
    if (aqi <= 100) return 'yellow';
    if (aqi <= 150) return 'orange';
    if (aqi <= 200) return 'red';
    if (aqi <= 300) return 'purple';
    return 'maroon';
}

function pinPct(v) {
    if (v <= 50)  return (v / 50) * 20;
    if (v <= 100) return 20 + ((v - 50)  / 50)  * 18;
    if (v <= 150) return 38 + ((v - 100) / 50)  * 15;
    if (v <= 200) return 53 + ((v - 150) / 50)  * 15;
    if (v <= 300) return 68 + ((v - 200) / 100) * 16;
    return 84 + Math.min(((v - 300) / 200) * 13, 13);
}

// ── Weather icon mapper ───────────────────────────────────────────────────────
function owmIcon(id) {
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 400) return '🌦️';
    if (id >= 500 && id < 600) return '🌧️';
    if (id >= 600 && id < 700) return '❄️';
    if (id >= 700 && id < 800) return '🌫️';
    if (id === 800)             return '☀️';
    if (id === 801)             return '🌤️';
    if (id === 802)             return '⛅';
    if (id >= 803)              return '☁️';
    return '🌡️';
}

// ── Map ───────────────────────────────────────────────────────────────────────
function initMap(lat, lon) {
    if (!map) {
        map = L.map('map', { zoomControl: false, scrollWheelZoom: true })
               .setView([lat, lon], 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap ©CartoDB',
            maxZoom: 19
        }).addTo(map);
        L.control.zoom({ position: 'bottomleft' }).addTo(map);
    } else {
        map.setView([lat, lon], 12);
    }
}

function clearMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
}

// ── "You are here" pulse marker ───────────────────────────────────────────────
function addUserLocationMarker(lat, lon, address) {
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
    const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:20px;height:20px;">
            <div style="
                position:absolute;inset:0;border-radius:50%;
                background:rgba(58,139,253,0.25);
                animation:ripple 1.8s ease-out infinite;
            "></div>
            <div style="
                position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:14px;height:14px;border-radius:50%;
                background:#3a8bfd;border:2.5px solid #fff;
                box-shadow:0 0 12px #3a8bfdaa;
            "></div>
        </div>
        <style>
            @keyframes ripple {
                0%   { transform: scale(1);   opacity: 0.7; }
                100% { transform: scale(3.5); opacity: 0; }
            }
        </style>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    userLocationMarker = L.marker([lat, lon], { icon, zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip(`📍 <b>You are here</b><br><span style="font-size:11px">${address}</span>`, {
            className: 'aqi-tooltip',
            direction: 'top',
            offset: [0, -16],
            permanent: false
        });
}

function addStationMarker(lat, lon, aqi, name) {
    const c = aqiColor(aqi);
    const icon = L.divIcon({
        className: '',
        html: `<div style="
            min-width:40px;height:40px;border-radius:50%;
            background:${c};color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;
            border:2.5px solid rgba(255,255,255,0.7);
            box-shadow:0 0 18px ${c}bb,0 0 6px rgba(0,0,0,0.6);
            padding:0 6px;white-space:nowrap;
        ">${aqi}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    const m = L.marker([lat, lon], { icon })
        .addTo(map)
        .bindTooltip(`<b>${name}</b><br>AQI: ${aqi} — ${aqiLabel(aqi)}`, {
            className: 'aqi-tooltip',
            direction: 'top',
            offset: [0, -24]
        });
    markers.push(m);
}

// ── Search ────────────────────────────────────────────────────────────────────
async function searchLocation() {
    const raw = document.getElementById('cityInput').value.trim();
    if (!raw) return;

    const query = resolveQuery(raw);
    console.log(`Query: "${raw}" → resolved: "${query}"`);

    const btn = document.querySelector('.search-box button');
    btn.textContent = '...';
    btn.disabled = true;

    try {
        let primary = null;

        // If alias resolved to a special path/ID, use feed directly
        const isAlias = query !== raw.trim();
        if (isAlias) {
            const aqiRes  = await fetch(`https://api.waqi.info/feed/${encodeURIComponent(query)}/?token=${WAQI_TOKEN}`);
            const aqiJson = await aqiRes.json();
            if (aqiJson.status !== 'ok') {
                alert('City not found. Try a major city or country name.');
                return;
            }
            primary = aqiJson.data;
        } else {
            // Use search API to find the correct city station by name
            const searchRes  = await fetch(`https://api.waqi.info/search/?token=${WAQI_TOKEN}&keyword=${encodeURIComponent(query)}`);
            const searchJson = await searchRes.json();

            if (searchJson.status !== 'ok' || searchJson.data.length === 0) {
                alert('City not found. Try a major city or country name.');
                return;
            }

            // Pick the best match — prefer exact city name match
            const lq = query.toLowerCase();
            const best = searchJson.data.find(s =>
                s.station.name.toLowerCase().includes(lq)
            ) || searchJson.data[0];

            // Fetch full data for that station
            const aqiRes  = await fetch(`https://api.waqi.info/feed/@${best.uid}/?token=${WAQI_TOKEN}`);
            const aqiJson = await aqiRes.json();
            if (aqiJson.status !== 'ok') {
                alert('Could not load station data.');
                return;
            }
            primary = aqiJson.data;
        }

        const lat = primary.city.geo[0];
        const lon = primary.city.geo[1];

        // 2. Map
        initMap(lat, lon);
        clearMarkers();
        addStationMarker(lat, lon, primary.aqi, primary.city.name);

        // 3. Nearby strip
        try {
            const bounds     = `${lat - 2},${lon - 2},${lat + 2},${lon + 2}`;
            const nearbyRes  = await fetch(`https://api.waqi.info/map/bounds/?latlng=${bounds}&token=${WAQI_TOKEN}`);
            const nearbyJson = await nearbyRes.json();
            updateLocationStrip(
                nearbyJson.status === 'ok' ? nearbyJson.data : [],
                primary.city.name
            );
        } catch (nearbyErr) {
            console.error('Nearby fetch failed:', nearbyErr);
            updateLocationStrip([], primary.city.name);
        }

        // 4. Main card
        updateAqi(primary);

        // 5. Weather
        try {
            const wxRes  = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
            const wxJson = await wxRes.json();
            if (wxJson.cod === 200) {
                updateWeather({
                    temp:      wxJson.main.temp.toFixed(1),
                    humidity:  wxJson.main.humidity,
                    wind:      (wxJson.wind.speed * 3.6).toFixed(1),
                    condition: wxJson.weather[0].main,
                    icon:      owmIcon(wxJson.weather[0].id)
                });
            }
        } catch (_) {}

        // 6. Precautions
        renderPrecautions(primary.aqi);

    } catch (err) {
        console.error('Search error:', err);
        alert('Network error. Make sure you\'re running via a local server (not file://).');
    } finally {
        btn.textContent = 'Search';
        btn.disabled = false;
    }
}

// ── Get Current Location ──────────────────────────────────────────────────────
function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    const btn = document.querySelector('.current-btn');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;vertical-align:middle"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Locating...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            try {
                // 1. Reverse geocode the exact GPS point (free, no key)
                let address = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                try {
                    const geoRes  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
                    const geoJson = await geoRes.json();
                    if (geoJson?.display_name) {
                        // Build a short readable address: neighbourhood/suburb, city, country
                        const a = geoJson.address || {};
                        const parts = [
                            a.neighbourhood || a.suburb || a.village || a.hamlet || a.road,
                            a.city || a.town || a.county || a.state_district,
                            a.state,
                            a.country
                        ].filter(Boolean);
                        address = parts.slice(0, 3).join(', ');
                    }
                } catch (_) {}

                // 2. Fetch AQI for the GPS point (nearest WAQI station)
                const aqiRes  = await fetch(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI_TOKEN}`);
                const aqiJson = await aqiRes.json();

                if (aqiJson.status !== 'ok') {
                    alert('No AQI station found near your location.');
                    return;
                }

                const primary = aqiJson.data;
                const sLat = primary.city.geo[0];
                const sLon = primary.city.geo[1];

                // 3. Centre map on the USER'S exact GPS, not the station
                initMap(lat, lon);
                clearMarkers();

                // 4. Blue pulse dot at exact user location
                addUserLocationMarker(lat, lon, address);

                // 5. AQI station marker (may be different spot)
                const stationLabel = `Nearest station: ${primary.city.name}`;
                addStationMarker(sLat, sLon, primary.aqi, stationLabel);

                // 6. Fit map to show both markers
                if (map) {
                    const bounds = L.latLngBounds([[lat, lon], [sLat, sLon]]);
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
                }

                // 7. Nearby strip
                try {
                    const b        = `${lat - 2},${lon - 2},${lat + 2},${lon + 2}`;
                    const nearbyRes  = await fetch(`https://api.waqi.info/map/bounds/?latlng=${b}&token=${WAQI_TOKEN}`);
                    const nearbyJson = await nearbyRes.json();
                    updateLocationStrip(
                        nearbyJson.status === 'ok' ? nearbyJson.data : [],
                        primary.city.name
                    );
                } catch (_) {
                    updateLocationStrip([], primary.city.name);
                }

                // 8. AQI card — show user's real address as the title
                updateAqi(primary, address);

                // 9. Weather at user's exact GPS
                try {
                    const wxRes  = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
                    const wxJson = await wxRes.json();
                    if (wxJson.cod === 200) {
                        updateWeather({
                            temp:      wxJson.main.temp.toFixed(1),
                            humidity:  wxJson.main.humidity,
                            wind:      (wxJson.wind.speed * 3.6).toFixed(1),
                            condition: wxJson.weather[0].main,
                            icon:      owmIcon(wxJson.weather[0].id)
                        });
                    }
                } catch (_) {}

                // 10. Precautions
                renderPrecautions(primary.aqi);

                // 11. Local sensor panel (only shows if near sensor location)
                if (typeof fetchAndShowSensor === "function") fetchAndShowSensor(address, lat, lon);

            } catch (err) {
                console.error('Geolocation AQI error:', err);
                alert('Failed to fetch AQI for your location.');
            } finally {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;vertical-align:middle"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Locate Me';
                btn.disabled = false;
            }
        },
        (err) => {
            console.error('Geolocation error:', err);
            alert('Could not get your location. Please allow location access and try again.');
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;vertical-align:middle"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Locate Me';
            btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ── Strip ─────────────────────────────────────────────────────────────────────
function updateLocationStrip(stations, primaryName) {
    const strip = document.getElementById('locationStrip');
    strip.innerHTML = '';

    const sorted = stations
        .filter(s => s.aqi !== '-' && s.aqi !== null && !isNaN(parseInt(s.aqi)))
        .sort((a, b) => parseInt(b.aqi) - parseInt(a.aqi))
        .slice(0, 12);

    if (sorted.length === 0) {
        strip.innerHTML = `<span class="strip-placeholder">No nearby stations found</span>`;
        return;
    }

    sorted.forEach(s => {
        const aqi       = parseInt(s.aqi);
        const badgeCls  = aqiBadgeClass(aqi);
        const shortName = s.station.name.split(',')[0].trim();
        const subName   = s.station.name.split(',').slice(1).join(',').trim().slice(0, 28) || 'Station';

        const item = document.createElement('div');
        item.className = 'strip-item';
        item.innerHTML = `
            <div>
                <div class="city-name">${shortName}</div>
                <div class="city-dist">${subName}</div>
            </div>
            <div class="strip-badge ${badgeCls}">${aqi} AQI</div>`;

        item.addEventListener('click', () => {
            map.setView([s.lat, s.lon], 13);
            clearMarkers();
            addStationMarker(s.lat, s.lon, aqi, s.station.name);
            updateAqi({
                aqi:  aqi,
                city: { name: s.station.name },
                time: { s: new Date().toLocaleString(), iso: new Date().toISOString() },
                iaqi: {}
            });
            renderPrecautions(aqi);
        });

        strip.appendChild(item);
    });

    const countTag = document.createElement('div');
    countTag.className = 'strip-item';
    countTag.style.cssText = 'color:var(--muted);font-size:11px;padding:10px 16px;cursor:default;border-right:none;';
    countTag.innerHTML = `<span>${sorted.length} stations nearby</span>`;
    strip.appendChild(countTag);
}

// ── Update main AQI card ──────────────────────────────────────────────────────
function updateAqi(d, overrideAddress) {
    const aqi = d.aqi;
    const c   = aqiColor(aqi);

    // Remove old stale banner
    const oldBanner = document.getElementById('staleBanner');
    if (oldBanner) oldBanner.remove();

    // Stale data check
    const dataTime = new Date(d.time.iso || d.time.s + (d.time.tz || '+00:00'));
    const hoursOld = (Date.now() - dataTime.getTime()) / (1000 * 60 * 60);
    const daysOld  = Math.floor(hoursOld / 24);
    const isStale  = hoursOld > 3;

    if (isStale) {
        const banner = document.createElement('div');
        banner.id = 'staleBanner';
        banner.className = 'stale-banner';
        banner.innerHTML = `
            <span style="font-size:16px;flex-shrink:0">⚠️</span>
            <span>
                <b>Station may be offline.</b>
                Last live reading was
                <b>${daysOld > 0
                    ? daysOld + ' day' + (daysOld !== 1 ? 's' : '') + ' ago'
                    : Math.floor(hoursOld) + ' hours ago'
                }</b>
                on <b>${dataTime.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</b>.
                Forecast data below is based on the last available readings.
            </span>`;
        const aqiDisplay = document.querySelector('.aqi-display');
        aqiDisplay.insertBefore(banner, aqiDisplay.firstChild);
    }

    // Update DOM
    document.getElementById('aqiNumber').textContent = aqi;
    document.getElementById('aqiNumber').style.color = c;

    const statusBox = document.getElementById('aqiStatus');
    statusBox.textContent = aqiLabel(aqi);
    statusBox.style.color = c;
    statusBox.style.borderColor = c;
    statusBox.style.background = c + '18';

    document.getElementById('scalePin').style.left = pinPct(aqi) + '%';

    const timeStr = d.time.iso
        ? new Date(d.time.iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
        : d.time.s || 'Unknown';

    const locationEl = document.getElementById('locationName');
    if (overrideAddress) {
        locationEl.textContent = `📍 ${overrideAddress}`;
        locationEl.title = `Nearest AQI station: ${d.city.name}`;
        document.getElementById('updateTime').textContent =
            `Nearest station: ${d.city.name} · Last updated: ${timeStr}`;
    } else {
        locationEl.textContent = d.city.name;
        document.getElementById('updateTime').textContent = `Last updated: ${timeStr}`;
    }

    // Pollutants
    const pm25 = d.iaqi?.pm25?.v ?? '--';
    const pm10 = d.iaqi?.pm10?.v ?? '--';
    document.getElementById('pm25').innerHTML = `${pm25} <sup>μg/m³</sup>`;
    document.getElementById('pm10').innerHTML = `${pm10} <sup>μg/m³</sup>`;

    // Forecast
    if (d.forecast?.daily) renderForecast(d.forecast.daily);
}

// ── Update weather widget ─────────────────────────────────────────────────────
function updateWeather(w) {
    document.getElementById('temp').textContent        = w.temp;
    document.getElementById('humidity').textContent    = w.humidity;
    document.getElementById('wind').textContent        = w.wind;
    document.getElementById('weatherCond').textContent = w.condition;
    document.querySelector('.weather-icon').textContent = w.icon;

    // UV Index via Open-Meteo (free, no key needed)
    const lat = map ? map.getCenter().lat.toFixed(4) : '0';
    const lon = map ? map.getCenter().lng.toFixed(4) : '0';
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=uv_index_max&timezone=auto&forecast_days=1`)
        .then(r => r.json())
        .then(data => {
            const uv = data?.daily?.uv_index_max?.[0];
            document.getElementById('uv').textContent = uv != null ? uv : '--';
        })
        .catch(() => {
            document.getElementById('uv').textContent = '--';
        });
}

// ── Render precautions ────────────────────────────────────────────────────────
function renderPrecautions(aqi) {
    // Remove existing precautions panel
    const old = document.getElementById('precautionsPanel');
    if (old) old.remove();

    const level = getPrecautionLevel(aqi);
    const data  = PRECAUTIONS[level];

    const panel = document.createElement('div');
    panel.id = 'precautionsPanel';
    panel.className = 'precautions';
    panel.innerHTML = `
        <h3 style="color:${data.color}">
            ${data.icon} Health Precautions
            <span class="p-sublabel">— ${data.label} air quality</span>
        </h3>
        <div class="precaution-grid">
            ${data.items.map(item => `
                <div class="precaution-item">
                    <span class="p-icon">${item.icon}</span>
                    <span>${item.text}</span>
                </div>
            `).join('')}
        </div>`;

    document.getElementById('resultCard').appendChild(panel);
}

// ── Render AQI forecast bars ──────────────────────────────────────────────────
function renderForecast(daily) {
    // Remove old forecast panel
    const old = document.getElementById('forecastPanel');
    if (old) old.remove();

    // Use pm25 forecast if available, else uvi, else o3
    const series = daily.pm25 || daily.uvi || daily.o3;
    if (!series || series.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const days  = series.slice(0, 7);
    const maxVal = Math.max(...days.map(d => d.avg || 0), 1);

    const panel = document.createElement('div');
    panel.id = 'forecastPanel';
    panel.className = 'forecast-panel';

    panel.innerHTML = `
        <h3>📅 7-Day AQI Forecast <span style="font-size:11px;color:var(--muted);font-weight:400">(PM2.5 avg)</span></h3>
        <div class="forecast-bars">
            ${days.map(d => {
                const val      = d.avg || 0;
                const pct      = Math.max((val / maxVal) * 100, 4);
                const color    = aqiColor(val);
                const dayLabel = d.day === today
                    ? 'Today'
                    : new Date(d.day + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
                const isToday  = d.day === today;

                return `
                    <div class="forecast-bar-wrap ${isToday ? 'forecast-bar-today' : ''}">
                        <div class="forecast-bar-val">${Math.round(val)}</div>
                        <div class="forecast-bar-track">
                            <div class="forecast-bar"
                                style="height:${pct}%;background:${color};"
                                title="${d.day}: ${val}">
                            </div>
                        </div>
                        <div class="forecast-bar-day">${dayLabel}</div>
                    </div>`;
            }).join('')}
        </div>`;

    document.getElementById('resultCard').appendChild(panel);
}

// ── Tab switcher ──────────────────────────────────────────────────────────────
function switchTab(btn, tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const aqiDisplay     = document.querySelector('.aqi-display');
    const weatherWidget  = document.querySelector('.weather-widget');

    if (tab === 'aqi') {
        aqiDisplay.style.display    = '';
        weatherWidget.style.display = 'none';
    } else {
        aqiDisplay.style.display    = 'none';
        weatherWidget.style.display = '';
    }
}