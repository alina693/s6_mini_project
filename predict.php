<?php
// ═══════════════════════════════════════════════════════════
//  predict.php — C:/xampp/htdocs/miniproject/predict.php
//  AI Regression Model for pollution prediction
//  Uses your sensor_daily data + seasonal patterns + news context
// ═══════════════════════════════════════════════════════════

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

$conn = new mysqli("localhost", "root", "", "aqi_sensor");
if ($conn->connect_error) {
    echo json_encode(["error" => $conn->connect_error]);
    exit;
}

// ── Step 1: Get all daily data ────────────────────────────
$result = $conn->query(
    "SELECT date, mq135_avg, sound_avg, local_aqi
     FROM sensor_daily
     ORDER BY date ASC"
);

$rows = [];
while ($r = $result->fetch_assoc()) $rows[] = $r;
$conn->close();

$dataCount = count($rows);

// ── Step 2: Seasonal & contextual knowledge ───────────────
// General pollution patterns (India context)
// Used when sensor data is insufficient (< 7 days)
function getSeasonalFactor($month) {
    // Higher pollution in winter (Oct-Feb), lower in monsoon (Jun-Sep)
    $factors = [
        1 => 1.35,  // January   — very high (winter smog)
        2 => 1.25,  // February  — high
        3 => 1.10,  // March     — moderate-high
        4 => 1.05,  // April     — moderate
        5 => 1.00,  // May       — baseline
        6 => 0.80,  // June      — monsoon begins (rain cleans air)
        7 => 0.75,  // July      — monsoon peak (lowest pollution)
        8 => 0.78,  // August    — monsoon
        9 => 0.85,  // September — monsoon ends
        10 => 1.15, // October   — post-monsoon, pollution rises
        11 => 1.30, // November  — high (winter starts)
        12 => 1.40, // December  — highest (winter smog peak)
    ];
    return $factors[$month] ?? 1.0;
}

function getDayOfWeekFactor($dayOfWeek) {
    // 0=Sunday, 1=Monday ... 6=Saturday
    // Weekdays have more traffic/industrial activity
    $factors = [
        0 => 0.85,  // Sunday   — low traffic
        1 => 1.10,  // Monday   — high traffic
        2 => 1.08,  // Tuesday
        3 => 1.05,  // Wednesday
        4 => 1.08,  // Thursday
        5 => 1.12,  // Friday   — highest (end of week traffic)
        6 => 0.90,  // Saturday — moderate
    ];
    return $factors[$dayOfWeek] ?? 1.0;
}

// General news context for Indian cities in different seasons
function getNewsContext($month) {
    $context = [
        1  => "Winter smog season. Delhi AQI often exceeds 300. Stubble burning effects still present in North India.",
        2  => "Winter pollution still high. Cold air traps pollutants close to ground.",
        3  => "Pollution gradually decreasing as temperatures rise.",
        4  => "Pre-summer. Dust storms possible. Moderate pollution.",
        5  => "Summer heat disperses pollutants. Moderate levels.",
        6  => "Monsoon season begins. Rain washes pollutants. Good air quality.",
        7  => "Peak monsoon. Lowest pollution of year. Good air quality.",
        8  => "Monsoon continues. Good air quality.",
        9  => "Monsoon retreating. Pollution begins rising.",
        10 => "Post-monsoon. Stubble burning begins in Punjab/Haryana. Pollution rising.",
        11 => "Stubble burning peak. Diwali firecrackers. Very high pollution in North India.",
        12 => "Winter smog. Temperature inversion traps pollutants. High AQI.",
    ];
    return $context[$month] ?? "General pollution patterns apply.";
}

// ── Step 3: Linear Regression ────────────────────────────
// Predicts next value based on trend in data
function linearRegression($yValues) {
    $n = count($yValues);
    if ($n < 2) return end($yValues); // not enough data

    $xValues = range(1, $n);
    $xMean   = array_sum($xValues) / $n;
    $yMean   = array_sum($yValues) / $n;

    $numerator   = 0;
    $denominator = 0;

    for ($i = 0; $i < $n; $i++) {
        $numerator   += ($xValues[$i] - $xMean) * ($yValues[$i] - $yMean);
        $denominator += ($xValues[$i] - $xMean) ** 2;
    }

    if ($denominator == 0) return $yMean;

    $slope     = $numerator / $denominator;
    $intercept = $yMean - $slope * $xMean;

    // Predict next point (x = n+1, n+2, n+3)
    return [
        'day1' => $intercept + $slope * ($n + 1),
        'day2' => $intercept + $slope * ($n + 2),
        'day3' => $intercept + $slope * ($n + 3),
        'slope' => $slope,
        'mean'  => $yMean,
    ];
}

// ── Step 4: Moving average smoothing ─────────────────────
function movingAverage($values, $window = 3) {
    $smoothed = [];
    $n = count($values);
    for ($i = 0; $i < $n; $i++) {
        $start  = max(0, $i - $window + 1);
        $slice  = array_slice($values, $start, $i - $start + 1);
        $smoothed[] = array_sum($slice) / count($slice);
    }
    return $smoothed;
}

// ── Step 5: Generate predictions ─────────────────────────
$today     = new DateTime();
$month     = intval($today->format('n'));
$tomorrow  = (new DateTime('+1 day'))->format('D, d M');
$day2      = (new DateTime('+2 days'))->format('D, d M');
$day3      = (new DateTime('+3 days'))->format('D, d M');

$day1DowFactor = getDayOfWeekFactor(intval((new DateTime('+1 day'))->format('w')));
$day2DowFactor = getDayOfWeekFactor(intval((new DateTime('+2 days'))->format('w')));
$day3DowFactor = getDayOfWeekFactor(intval((new DateTime('+3 days'))->format('w')));
$seasonFactor  = getSeasonalFactor($month);
$newsContext   = getNewsContext($month);

$usingRealData = $dataCount >= 7;

if ($usingRealData) {
    // ── Use sensor data for regression ───────────────────
    $mq135Values = array_map(fn($r) => floatval($r['mq135_avg']), $rows);
    $smoothed    = movingAverage($mq135Values, 3);
    $regression  = linearRegression($smoothed);

    // Apply seasonal and day-of-week factors
    $pred1mq135 = max(50, round($regression['day1'] * $seasonFactor * $day1DowFactor));
    $pred2mq135 = max(50, round($regression['day2'] * $seasonFactor * $day2DowFactor));
    $pred3mq135 = max(50, round($regression['day3'] * $seasonFactor * $day3DowFactor));

    // Clamp to reasonable range
    $pred1mq135 = min(700, $pred1mq135);
    $pred2mq135 = min(700, $pred2mq135);
    $pred3mq135 = min(700, $pred3mq135);

    $trend = $regression['slope'] > 2 ? 'rising' :
            ($regression['slope'] < -2 ? 'falling' : 'stable');

    $confidence = $dataCount >= 14 ? 'High' :
                 ($dataCount >= 7  ? 'Moderate' : 'Low');

} else {
    // ── Fallback: use seasonal baseline when data < 7 days ─
    // Kerala baseline MQ-135 ~280 ppm moderate urban area
    $baseline    = 280;
    $pred1mq135  = round($baseline * $seasonFactor * $day1DowFactor);
    $pred2mq135  = round($baseline * $seasonFactor * $day2DowFactor);
    $pred3mq135  = round($baseline * $seasonFactor * $day3DowFactor);
    $trend       = 'unknown';
    $confidence  = 'Low (insufficient data — using seasonal estimates)';
}

// ── Step 6: Convert MQ-135 ppm to estimated AQI ──────────
function mq135ToAqi($ppm) {
    if      ($ppm < 50)  return round($ppm * 1.0);
    else if ($ppm < 100) return round(50  + ($ppm - 50)  * 1.0);
    else if ($ppm < 200) return round(100 + ($ppm - 100) * 0.5);
    else if ($ppm < 400) return round(150 + ($ppm - 200) * 0.25);
    else if ($ppm < 600) return round(200 + ($ppm - 400) * 0.5);
    else                 return min(500, round(300 + ($ppm - 600) * 1.0));
}

$pred1aqi = mq135ToAqi($pred1mq135);
$pred2aqi = mq135ToAqi($pred2mq135);
$pred3aqi = mq135ToAqi($pred3mq135);

// ── Step 7: Generate warnings ─────────────────────────────
function getWarning($aqi, $mq135) {
    if ($aqi <= 50) return [
        "level"   => "Good",
        "color"   => "#00e400",
        "mask"    => false,
        "message" => "Air quality is expected to be good. Safe for all outdoor activities.",
        "advice"  => ["Enjoy outdoor activities freely", "Good day for exercise outdoors", "No special precautions needed"]
    ];
    if ($aqi <= 100) return [
        "level"   => "Moderate",
        "color"   => "#ffcc00",
        "mask"    => false,
        "message" => "Air quality will be acceptable. Unusually sensitive people should consider limiting prolonged outdoor exertion.",
        "advice"  => ["Generally safe for outdoor activities", "Sensitive individuals may want to limit prolonged outdoor exertion", "Keep windows closed during peak traffic hours"]
    ];
    if ($aqi <= 150) return [
        "level"   => "Unhealthy for Sensitive Groups",
        "color"   => "#f4872a",
        "mask"    => true,
        "message" => "People with respiratory or heart conditions should wear a mask outdoors tomorrow.",
        "advice"  => ["😷 Wear a mask if you have asthma or heart conditions", "Limit prolonged outdoor exertion", "Keep inhaler accessible", "Avoid outdoor exercise during rush hours (8-10am, 5-8pm)"]
    ];
    if ($aqi <= 200) return [
        "level"   => "Unhealthy",
        "color"   => "#ff0000",
        "mask"    => true,
        "message" => "Everyone should wear a mask outdoors tomorrow. Air quality will be unhealthy.",
        "advice"  => ["😷 Everyone should wear a mask outdoors", "Avoid strenuous outdoor activities", "Keep windows and doors closed", "Use air purifier indoors if available", "Vulnerable groups should stay indoors"]
    ];
    if ($aqi <= 300) return [
        "level"   => "Very Unhealthy",
        "color"   => "#8b008b",
        "mask"    => true,
        "message" => "⚠️ Very unhealthy air quality predicted. Minimize all outdoor activities and wear N95 mask.",
        "advice"  => ["⚠️ Wear N95 mask outdoors — regular masks insufficient", "Avoid all outdoor activities", "Keep all windows closed", "Stay indoors as much as possible", "Children and elderly should not go outside"]
    ];
    return [
        "level"   => "Hazardous",
        "color"   => "#7e0023",
        "mask"    => true,
        "message" => "🚨 HAZARDOUS air quality predicted. Avoid going outside entirely tomorrow.",
        "advice"  => ["🚨 Do NOT go outside unless absolutely necessary", "Wear N95/P100 respirator if you must go out", "Seal windows and doors with wet cloth if needed", "Emergency health precautions apply", "Contact local health authorities if symptoms develop"]
    ];
}

$warn1 = getWarning($pred1aqi, $pred1mq135);
$warn2 = getWarning($pred2aqi, $pred2mq135);
$warn3 = getWarning($pred3aqi, $pred3mq135);

// ── Step 8: Send response ─────────────────────────────────
echo json_encode([
    "data_points"   => $dataCount,
    "using_real_data" => $usingRealData,
    "confidence"    => $confidence,
    "trend"         => $trend,
    "news_context"  => $newsContext,
    "predictions"   => [
        [
            "label"    => "Tomorrow",
            "date"     => $tomorrow,
            "mq135"    => $pred1mq135,
            "aqi"      => $pred1aqi,
            "warning"  => $warn1,
        ],
        [
            "label"    => "Day After",
            "date"     => $day2,
            "mq135"    => $pred2mq135,
            "aqi"      => $pred2aqi,
            "warning"  => $warn2,
        ],
        [
            "label"    => "In 3 Days",
            "date"     => $day3,
            "mq135"    => $pred3mq135,
            "aqi"      => $pred3aqi,
            "warning"  => $warn3,
        ],
    ]
], JSON_PRETTY_PRINT);
?>