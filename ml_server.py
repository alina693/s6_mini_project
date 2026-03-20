"""
ml_server.py
============
Run this: python ml_server.py
Starts AI server at http://localhost:5000/predict

Logic:
    1. Fetch 30 days of AQI history from OpenWeatherMap
    2. Try Random Forest first
    3. If Random Forest fails → use Logistic Regression
    4. Website falls back to PHP if this server is down
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import numpy as np
from datetime import datetime, timedelta
import math
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
app = Flask(__name__)
CORS(app)

OWM_KEY = '389cdf2017187fb384e77ca4ea812b62'

# ── Seasonal factors (India) ──────────────────────────────
SEASONAL = {1:1.35,2:1.25,3:1.10,4:1.05,5:1.00,
            6:0.80,7:0.75,8:0.78,9:0.85,
            10:1.15,11:1.30,12:1.40}
DOW      = {0:0.85,1:1.10,2:1.08,3:1.05,4:1.08,5:1.12,6:0.90}

NEWS_CONTEXT = {
    1:"Winter smog season. Cold air traps pollutants close to ground.",
    2:"Winter pollution still high.",
    3:"Pollution gradually decreasing as temperatures rise.",
    4:"Pre-summer. Dust storms possible.",
    5:"Summer heat disperses pollutants.",
    6:"Monsoon season begins. Rain washes pollutants.",
    7:"Peak monsoon. Lowest pollution of year.",
    8:"Monsoon continues. Good air quality.",
    9:"Monsoon retreating. Pollution begins rising.",
    10:"Post-monsoon. Stubble burning begins. Pollution rising.",
    11:"Stubble burning peak. Very high pollution in North India.",
    12:"Winter smog. Temperature inversion traps pollutants.",
}

def get_warning(aqi):
    if aqi <= 50:
        return {"level":"Good","color":"#00e400","mask":False,
                "message":"Air quality expected to be good. Safe for all outdoor activities.",
                "advice":["Enjoy outdoor activities freely","Good day for exercise","No special precautions needed"]}
    if aqi <= 100:
        return {"level":"Moderate","color":"#ffcc00","mask":False,
                "message":"Air quality will be acceptable. Sensitive people should limit outdoor exertion.",
                "advice":["Generally safe for outdoor activities","Sensitive individuals limit prolonged outdoor exertion","Keep windows closed during peak traffic hours"]}
    if aqi <= 150:
        return {"level":"Unhealthy for Sensitive Groups","color":"#f4872a","mask":True,
                "message":"People with respiratory conditions should wear a mask outdoors.",
                "advice":["😷 Wear mask if you have asthma or heart conditions","Limit prolonged outdoor exertion","Keep inhaler accessible","Avoid outdoor exercise during rush hours"]}
    if aqi <= 200:
        return {"level":"Unhealthy","color":"#ff0000","mask":True,
                "message":"Everyone should wear a mask outdoors. Air quality will be unhealthy.",
                "advice":["😷 Everyone should wear a mask outdoors","Avoid strenuous outdoor activities","Keep windows and doors closed","Use air purifier indoors if available"]}
    if aqi <= 300:
        return {"level":"Very Unhealthy","color":"#8b008b","mask":True,
                "message":"⚠️ Very unhealthy air quality. Wear N95 mask.",
                "advice":["⚠️ Wear N95 mask — regular masks insufficient","Avoid all outdoor activities","Keep all windows closed","Children and elderly should not go outside"]}
    return {"level":"Hazardous","color":"#7e0023","mask":True,
            "message":"🚨 HAZARDOUS air quality. Avoid going outside entirely.",
            "advice":["🚨 Do NOT go outside unless absolutely necessary","Wear N95/P100 respirator","Contact local health authorities if symptoms develop"]}

def fetch_owm_history(lat, lon):
    """Fetch last 30 days of hourly AQI from OpenWeatherMap"""
    end   = int(datetime.now().timestamp())
    start = int((datetime.now() - timedelta(days=30)).timestamp())
    url   = (f"http://api.openweathermap.org/data/2.5/air_pollution/history"
             f"?lat={lat}&lon={lon}&start={start}&end={end}&appid={OWM_KEY}")
    try:
        r = requests.get(url, timeout=10)
        return r.json().get('list', [])
    except Exception as e:
        print(f"OWM error: {e}")
        return []

def process_owm_data(raw):
    """Convert hourly OWM data to daily averages"""
    daily = {}
    for item in raw:
        dt  = datetime.fromtimestamp(item['dt'])
        day = dt.strftime('%Y-%m-%d')
        # OWM AQI: 1=Good,2=Fair,3=Moderate,4=Poor,5=Very Poor
        # Convert to US AQI approximate
        aqi_us = [0, 25, 75, 125, 175, 250][item['main']['aqi']]
        if day not in daily:
            daily[day] = {'values': [], 'dt': dt}
        daily[day]['values'].append(aqi_us)

    rows = []
    for day, v in sorted(daily.items()):
        dt = v['dt']
        rows.append({
            'aqi':        np.mean(v['values']),
            'month':      dt.month,
            'dow':        dt.weekday(),
            'doy':        dt.timetuple().tm_yday,
            'seasonal':   SEASONAL.get(dt.month, 1.0),
            'dow_factor': DOW.get(dt.weekday(), 1.0),
        })
    return rows

def build_features(row):
    return [
        row['month'],
        row['dow'],
        row['doy'],
        row['seasonal'],
        row['dow_factor'],
        math.sin(2 * math.pi * row['doy'] / 365),
        math.cos(2 * math.pi * row['doy'] / 365),
    ]

def get_future_row(days_ahead):
    dt = datetime.now() + timedelta(days=days_ahead)
    return {
        'month':      dt.month,
        'dow':        dt.weekday(),
        'doy':        dt.timetuple().tm_yday,
        'seasonal':   SEASONAL.get(dt.month, 1.0),
        'dow_factor': DOW.get(dt.weekday(), 1.0),
    }

@app.route('/predict')
def predict():
    lat = float(request.args.get('lat', 10.0527))
    lon = float(request.args.get('lon', 76.3488))

    # Fetch and process OWM data
    raw  = fetch_owm_history(lat, lon)
    rows = process_owm_data(raw)
    n    = len(rows)

    month = datetime.now().month

    # Calculate trend
    if n >= 3:
        recent = [r['aqi'] for r in rows[-5:]]
        slope  = (recent[-1] - recent[0]) / max(len(recent)-1, 1)
        trend  = 'rising' if slope > 2 else ('falling' if slope < -2 else 'stable')
    else:
        trend = 'unknown'

    model_used = None
    preds      = None

    if n >= 3:
        X = np.array([build_features(r) for r in rows])
        y = np.array([r['aqi'] for r in rows])

        scaler   = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # ── Try Random Forest first ───────────────────────
        try:
            rf = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
            rf.fit(X_scaled, y)

            preds = []
            for i in range(1, 4):
                fr   = get_future_row(i)
                feat = scaler.transform([build_features(fr)])
                pred = rf.predict(feat)[0]
                pred = pred * fr['seasonal'] * fr['dow_factor']
                preds.append(int(max(0, min(500, round(pred)))))

            model_used = 'random_forest'
            confidence = f'High — Random Forest ({n} days OWM data)'
            print(f"✅ Random Forest predictions: {preds}")

        except Exception as e:
            print(f"❌ Random Forest failed: {e} → trying Logistic Regression")

            # ── Logistic Regression fallback ──────────────
            try:
                # Convert AQI to categories for logistic regression
                # then map back to AQI values
                def aqi_to_cat(v):
                    if v <= 50:  return 0
                    if v <= 100: return 1
                    if v <= 150: return 2
                    if v <= 200: return 3
                    if v <= 300: return 4
                    return 5

                cat_center = [25, 75, 125, 175, 250, 350]
                y_cat = np.array([aqi_to_cat(v) for v in y])

                lr = LogisticRegression(max_iter=500, random_state=42)
                lr.fit(X_scaled, y_cat)

                preds = []
                for i in range(1, 4):
                    fr   = get_future_row(i)
                    feat = scaler.transform([build_features(fr)])
                    cat  = lr.predict(feat)[0]
                    pred = cat_center[cat] * fr['seasonal'] * fr['dow_factor']
                    preds.append(int(max(0, min(500, round(pred)))))

                model_used = 'logistic_regression'
                confidence = f'Moderate — Logistic Regression ({n} days OWM data)'
                print(f"✅ Logistic Regression predictions: {preds}")

            except Exception as e2:
                print(f"❌ Logistic Regression also failed: {e2}")

    # ── Seasonal fallback if both models failed ───────────
    if preds is None:
        base  = 80
        preds = [
            int(round(base * SEASONAL.get(month,1.0) * DOW.get(get_future_row(1)['dow'],1.0))),
            int(round(base * SEASONAL.get(month,1.0) * DOW.get(get_future_row(2)['dow'],1.0))),
            int(round(base * SEASONAL.get(month,1.0) * DOW.get(get_future_row(3)['dow'],1.0))),
        ]
        model_used = 'seasonal'
        confidence = 'Low — Seasonal estimate (not enough OWM data)'
        print(f"⚠️ Using seasonal fallback: {preds}")

    # Build response
    labels      = ['Tomorrow', 'Day After', 'In 3 Days']
    predictions = []
    for i, aqi in enumerate(preds):
        dt = datetime.now() + timedelta(days=i+1)
        predictions.append({
            'label':   labels[i],
            'date':    dt.strftime('%a, %d %b'),
            'aqi':     aqi,
            'warning': get_warning(aqi),
        })

    return jsonify({
        'model':        model_used,
        'confidence':   confidence,
        'data_points':  n,
        'trend':        trend,
        'news_context': NEWS_CONTEXT.get(month, ''),
        'predictions':  predictions,
        'source':       'OpenWeatherMap Air Pollution API',
    })

if __name__ == '__main__':
    print("=" * 50)
    print("  AI Pollution Forecast Server")
    print("  http://localhost:5000/predict")
    print("  Ctrl+C to stop")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=False)