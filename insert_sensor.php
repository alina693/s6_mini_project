<?php
// ═══════════════════════════════════════════════════════════
//  insert_sensor.php
//  ESP32 posts: mq135, sound, co2_pct, nh3_pct, nox_pct, smoke_pct
// ═══════════════════════════════════════════════════════════

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

$conn = new mysqli("localhost", "root", "", "aqi_sensor");
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => $conn->connect_error]);
    exit;
}

$mq135     = floatval($_POST['mq135']     ?? 0);
$sound     = floatval($_POST['sound']     ?? 0);
$co2_pct   = floatval($_POST['co2_pct']   ?? 0);
$nh3_pct   = floatval($_POST['nh3_pct']   ?? 0);
$nox_pct   = floatval($_POST['nox_pct']   ?? 0);
$smoke_pct = floatval($_POST['smoke_pct'] ?? 0);

// Estimated AQI from MQ-135
if      ($mq135 < 50)  $local_aqi = round($mq135 * 1.0);
else if ($mq135 < 100) $local_aqi = round(50  + ($mq135 - 50)  * 1.0);
else if ($mq135 < 200) $local_aqi = round(100 + ($mq135 - 100) * 0.5);
else if ($mq135 < 400) $local_aqi = round(150 + ($mq135 - 200) * 0.25);
else if ($mq135 < 600) $local_aqi = round(200 + ($mq135 - 400) * 0.5);
else                   $local_aqi = min(500, round(300 + ($mq135 - 600) * 1.0));

// Insert live reading with gas breakdown
$stmt = $conn->prepare(
    "INSERT INTO sensor_live (mq135, sound, local_aqi, co2_pct, nh3_pct, nox_pct, smoke_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?)"
);
$stmt->bind_param("ddidddd", $mq135, $sound, $local_aqi, $co2_pct, $nh3_pct, $nox_pct, $smoke_pct);
$stmt->execute();
$newId = $conn->insert_id;

// Update sensor_daily every 20 readings
$today  = date('Y-m-d');
$exists = $conn->query("SELECT id FROM sensor_daily WHERE date='$today'")->num_rows > 0;

if (!$exists) {
    $conn->query("
        INSERT INTO sensor_daily
            (date,mq135_avg,mq135_min,mq135_max,sound_avg,sound_min,sound_max,local_aqi)
        VALUES
            ('$today',$mq135,$mq135,$mq135,$sound,$sound,$sound,$local_aqi)
    ");
} else if ($newId % 20 === 0) {
    $conn->query("
        UPDATE sensor_daily SET
            mq135_avg = (SELECT AVG(mq135) FROM sensor_live WHERE DATE(recorded_at)='$today'),
            mq135_min = (SELECT MIN(mq135) FROM sensor_live WHERE DATE(recorded_at)='$today' AND mq135>0),
            mq135_max = (SELECT MAX(mq135) FROM sensor_live WHERE DATE(recorded_at)='$today'),
            sound_avg = (SELECT AVG(sound)  FROM sensor_live WHERE DATE(recorded_at)='$today'),
            sound_min = (SELECT MIN(sound)  FROM sensor_live WHERE DATE(recorded_at)='$today' AND sound>0),
            sound_max = (SELECT MAX(sound)  FROM sensor_live WHERE DATE(recorded_at)='$today'),
            local_aqi = $local_aqi
        WHERE date='$today'
    ");
}

// Auto cleanup — delete rows older than 24 hours
$conn->query("DELETE FROM sensor_live WHERE recorded_at < NOW() - INTERVAL 24 HOUR");

echo json_encode([
    "status"       => "ok",
    "local_aqi"    => $local_aqi,
    "insert_id"    => $newId,
    "daily_updated"=> ($newId % 20 === 0) ? "yes" : "no"
]);

$conn->close();
?>
