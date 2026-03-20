<?php
// ═══════════════════════════════════════════════════════════
//  get_sensor.php — returns latest sensor data including gas breakdown
// ═══════════════════════════════════════════════════════════

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

$conn = new mysqli("localhost", "root", "", "aqi_sensor");
if ($conn->connect_error) {
    echo json_encode(["error" => $conn->connect_error]);
    exit;
}

// Latest live reading including gas breakdown
$live = $conn->query(
    "SELECT mq135, sound, local_aqi, co2_pct, nh3_pct, nox_pct, smoke_pct, recorded_at
     FROM sensor_live
     ORDER BY recorded_at DESC LIMIT 1"
)->fetch_assoc();

// Last 7 daily summaries
$rows = $conn->query(
    "SELECT date, mq135_avg, mq135_min, mq135_max,
            sound_avg, sound_min, sound_max, local_aqi
     FROM sensor_daily ORDER BY date DESC LIMIT 7"
);
$daily = [];
while ($r = $rows->fetch_assoc()) $daily[] = $r;
$daily = array_reverse($daily);

echo json_encode(["live" => $live, "daily" => $daily]);
$conn->close();
?>
