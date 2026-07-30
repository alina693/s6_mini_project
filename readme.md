# 🌫️ Live AQI Dashboard — IoT Air Quality Monitor & Predictor

> Real-time air quality monitoring powered by a custom ESP32 hardware sensor, with an AI model that predicts pollution 3 days ahead. Includes a live comparison between official government AQI stations and hands-on hardware readings.


## 🧠 What This Project Does

Official AQI stations are often kilometers from where you actually are, and only update once an hour. This project fixes that with a custom **ESP32 + MQ-135 gas sensor + sound sensor** that reports pollution readings every 10 seconds from your exact location, combined with an **AI model that learns from days of recorded pollution + noise data to forecast the next 3 days**.

The dashboard shows:
- 📍 Live AQI for any city/country worldwide (via WAQI + OpenStreetMap)
- 🔬 Your own hardware's live readings — gas concentration, sound level, gas breakdown (CO₂, NH₃, NOx, smoke)
- 📊 A side-by-side chart comparing your hardware vs the nearest official station — with distance, update-rate, and coverage-area comparisons
- 🤖 A 3-day AI pollution forecast with health advisories (mask recommendations, outdoor activity guidance)
- ☀️ Live weather (temperature, humidity, wind, UV index)

---

## ⚙️ How It Works — Architecture

```
ESP32 (MQ-135 + sound sensor)
        │  POST readings every ~10s
        ▼
insert_sensor.php ──► MySQL (aqi_sensor DB)
        │
        ├── sensor_live   (raw readings, last 24h, auto-cleaned)
        └── sensor_daily  (rolling daily averages, updated every 20 readings)
                │
                ▼
   get_sensor.php / get_sensor_hourly.php  (REST endpoints)
                │
                ▼
        Frontend Dashboard (vanilla JS + Leaflet)
                │
                ├── comparison.js   → hardware vs WAQI station chart
                └── prediction.js   → calls the AI forecast layer
                        │
                        ▼
        ┌───────────────────────────────┐
        │   ml_server.py (Python/Flask) │  ← tried first
        │   Random Forest Regressor     │
        │        ↓ if it fails          │
        │   Logistic Regression         │
        └───────────────────────────────┘
                        │  if server is down
                        ▼
        ┌───────────────────────────────┐
        │   predict.php (PHP fallback)  │
        │   Linear Regression +         │
        │   seasonal/day-of-week model  │
        └───────────────────────────────┘
```

**The key engineering decision here:** the prediction layer never fails silently. If there isn't enough hardware data yet, it falls back to a seasonal baseline model tuned for Indian pollution patterns (monsoon vs winter smog season, weekday traffic factors). If the Python ML server isn't running, the frontend automatically falls back to the PHP regression endpoint. Nothing breaks — the forecast degrades gracefully and tells the user exactly how confident it is (`High` / `Moderate` / `Low`) and which model produced it.

---

## 🚀 Features

- **Global city search** with alias resolution (handles country names, informal city names, and known WAQI station paths for the Gulf/Southeast Asia region)
- **"Locate Me"** — pinpoints your exact GPS location, reverse-geocodes it, and shows both your position and the nearest official station on the map
- **Live hardware panel** — gas concentration, sound level, gas-type breakdown, all polling every 10 seconds
- **Station vs Hardware comparison chart** — custom-drawn Canvas line chart (no charting library) showing 24-hour AQI trends from both sources, plus distance/update-rate/coverage stat cards
- **3-day AI forecast** — model badge shows which algorithm produced the prediction, trend arrow (rising/falling/stable), and a news-style seasonal context blurb
- **Health advisory system** — 6-tier AQI scale (Good → Hazardous) each with tailored, actionable precautions (mask type, outdoor activity limits, vulnerable-group guidance)
- **Stale data detection** — flags when a station's last reading is more than 3 hours old instead of silently showing outdated numbers
- **7-day AQI history** and weather (temp, humidity, wind, UV index)

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Hardware | ESP32, MQ-135 gas sensor, sound sensor |
| Backend | PHP, MySQL |
| AI / ML | Python, Flask, scikit-learn (Random Forest, Logistic Regression) |
| Frontend | Vanilla JavaScript, HTML5, CSS3, Leaflet.js (maps), Canvas API (custom charts) |
| External APIs | [WAQI](https://waqi.info/) (station AQI), [OpenWeatherMap](https://openweathermap.org/) (weather + pollution history), [Open-Meteo](https://open-meteo.com/) (UV index), Nominatim/OpenStreetMap (reverse geocoding) |
| Local dev environment | XAMPP (Apache + MySQL) |

---

## 📦 Setup

> **Requires:** XAMPP (or any Apache+MySQL+PHP stack), Python 3.9+, and an ESP32 if you want live hardware data (the dashboard works without it using search-based lookup).

1. **Clone the repo**
   ```bash
   git clone https://github.com/<your-username>/<repo-name>.git
   ```

2. **Database**
   - Import the schema into MySQL as `aqi_sensor` (tables: `sensor_live`, `sensor_daily`)
   - Start Apache + MySQL via XAMPP

3. **API keys**
   - Copy `.env.example` → `.env` and add your own [WAQI token](https://aqicn.org/data-platform/token/) and [OpenWeatherMap key](https://openweathermap.org/api)
   - *(See "Security Note" below — do this before deploying anywhere public.)*

4. **Run the AI server**
   ```bash
   pip install -r requirements.txt
   python ml_server.py
   ```
   Runs at `http://localhost:5000/predict`. If it's not running, the frontend automatically falls back to `predict.php`.

5. **Open the dashboard**
   Place the frontend files in your XAMPP `htdocs/miniproject/` folder and open `index.html` via `http://localhost/miniproject/` (not `file://` — the geolocation and fetch calls need a real server origin).

6. **(Optional) ESP32**
   Flash your ESP32 to POST `mq135`, `sound`, `co2_pct`, `nh3_pct`, `nox_pct`, `smoke_pct` to `insert_sensor.php` on your local network.

---

## 🔒 Security Note

This project currently has API keys hardcoded directly in the JS/PHP/Python source for local development. **Before deploying publicly, move these to environment variables the values are for local testing only and should be rotated if this repo goes public with the original keys still in the commit history.
