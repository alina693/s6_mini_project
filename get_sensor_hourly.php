<?php
// ═══════════════════════════════════════════════════════════
//  get_sensor_hourly.php
//  Returns hourly averages from sensor_live for last 24 hours
//  Used by comparison chart
// ═══════════════════════════════════════════════════════════

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

$conn = new mysqli("localhost", "root", "", "aqi_sensor");
if ($conn->connect_error) {
    echo json_encode(["error" => $conn->connect_error]);
    exit;
}

// Get hourly averages for last 24 hours
$result = $conn->query("
    SELECT
        HOUR(recorded_at)    AS hour,
        AVG(mq135)           AS avg_mq135,
        AVG(sound)           AS avg_sound,
        AVG(local_aqi)       AS avg_aqi,
        COUNT(*)             AS reading_count
    FROM sensor_live
    WHERE recorded_at >= NOW() - INTERVAL 24 HOUR
      AND mq135 > 0
    GROUP BY HOUR(recorded_at)
    ORDER BY HOUR(recorded_at) ASC
");

$hourly = [];
while ($row = $result->fetch_assoc()) {
    $hourly[] = [
        'hour'      => intval($row['hour']),
        'avg_mq135' => round(floatval($row['avg_mq135']), 1),
        'avg_sound' => round(floatval($row['avg_sound']), 1),
        'avg_aqi'   => round(floatval($row['avg_aqi'])),
        'count'     => intval($row['reading_count']),
    ];
}

echo json_encode(["hourly" => $hourly]);
$conn->close();
?>