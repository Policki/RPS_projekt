<?php
$streznik = "localhost";
$baza = "sola_is";
$uporabnikBaze = "root";
$gesloBaze = "";

$mapaShrambe = __DIR__ . "/../shramba/";

try {
    $pdo = new PDO(
        "mysql:host=$streznik;dbname=$baza;charset=utf8mb4",
        $uporabnikBaze,
        $gesloBaze,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $napaka) {
    http_response_code(500);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["napaka" => "Povezava z bazo ni uspela"]);
    exit;
}
