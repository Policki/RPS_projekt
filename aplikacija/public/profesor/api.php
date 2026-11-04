<?php
header("Content-Type: application/json; charset=utf-8");
require "povezava.php";


ini_set("session.gc_maxlifetime", 14400);
session_set_cookie_params(["lifetime" => 0, "path" => "/", "httponly" => true, "samesite" => "Lax"]);
session_start();


const TRENUTNO_LETO = "(SELECT id_trenutno_leto FROM Nastavitve_sistema WHERE id_nastavitve = 1)";



function odgovori($podatki, $koda = 200) {
    http_response_code($koda);
    echo json_encode($podatki, JSON_UNESCAPED_UNICODE);
    exit;
}

function preberiVhod() {
    $vsebina = json_decode(file_get_contents("php://input"), true);
    return is_array($vsebina) ? $vsebina : $_POST;
}

function samoPost() {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        odgovori(["napaka" => "Dovoljena je samo metoda POST"], 405);
    }
}

function zahtevajProfesorja($pdo) {
    if (empty($_SESSION["id_uporabnik"]) || time() > ($_SESSION["potece"] ?? 0)) {
        $_SESSION = [];
        odgovori(["napaka" => "Niste prijavljeni"], 401);
    }
   
    $_SESSION["potece"] = time() + $_SESSION["trajanje"];

    $poizvedba = $pdo->prepare(
        "SELECT u.id_uporabnik, u.ime, u.priimek, u.email, u.telefon, u.vloga, u.status, p.id_profesor
         FROM Uporabnik u
         LEFT JOIN Profesor p ON p.id_uporabnik = u.id_uporabnik
         WHERE u.id_uporabnik = ?"
    );
    $poizvedba->execute([$_SESSION["id_uporabnik"]]);
    $uporabnik = $poizvedba->fetch();

    if (!$uporabnik || $uporabnik["status"] !== "aktiven") {
        $_SESSION = [];
        odgovori(["napaka" => "Niste prijavljeni"], 401);
    }
    if ($uporabnik["vloga"] !== "profesor" || !$uporabnik["id_profesor"]) {
        odgovori(["napaka" => "Dostop imajo samo profesorji"], 403);
    }
    return $uporabnik;
}



function prijava($pdo) {
    samoPost();
    $vhod = preberiVhod();
    $uporabniskoIme = trim($vhod["username"] ?? "");
    $geslo = (string)($vhod["password"] ?? "");
    $ip = $_SERVER["REMOTE_ADDR"] ?? null;
    $agent = mb_substr($_SERVER["HTTP_USER_AGENT"] ?? "", 0, 255);

   
    $poizvedba = $pdo->prepare("SELECT COUNT(*) FROM Dnevnik_prijav WHERE uspesna = 0 AND ip_naslov = ? AND cas > (NOW() - INTERVAL 15 MINUTE)");
    $poizvedba->execute([$ip]);
    if ($poizvedba->fetchColumn() >= 10) odgovori(["napaka" => "Preveč poskusov, poskusite čez nekaj minut"], 429);

    $poizvedba = $pdo->prepare("SELECT id_uporabnik, ime, priimek, email, geslo_hash, vloga, status FROM Uporabnik WHERE uporabnisko_ime = ?");
    $poizvedba->execute([$uporabniskoIme]);
    $uporabnik = $poizvedba->fetch();

    $uspeh = $uporabnik && password_verify($geslo, $uporabnik["geslo_hash"]);

    $poizvedba = $pdo->prepare("INSERT INTO Dnevnik_prijav (id_uporabnik, uspesna, ip_naslov, uporabniski_agent) VALUES (?, ?, ?, ?)");
    $poizvedba->execute([$uporabnik ? $uporabnik["id_uporabnik"] : null, $uspeh ? 1 : 0, $ip, $agent]);

    if (!$uspeh) odgovori(["napaka" => "Napačno uporabniško ime ali geslo"], 401);
    if ($uporabnik["status"] !== "aktiven") odgovori(["napaka" => "Račun ni aktiven"], 403);
    if ($uporabnik["vloga"] !== "profesor") odgovori(["napaka" => "Ta stran je namenjena profesorjem"], 403);

    $minut = (int)$pdo->query("SELECT potek_seje_minut FROM Nastavitve_sistema WHERE id_nastavitve = 1")->fetchColumn();
    if ($minut <= 0) $minut = 30;

    session_regenerate_id(true);
    $_SESSION["id_uporabnik"] = (int)$uporabnik["id_uporabnik"];
    $_SESSION["trajanje"] = $minut * 60;
    $_SESSION["potece"] = time() + $minut * 60;

    $poizvedba = $pdo->prepare("UPDATE Uporabnik SET zadnja_prijava = NOW() WHERE id_uporabnik = ?");
    $poizvedba->execute([$uporabnik["id_uporabnik"]]);

    odgovori(["ime" => $uporabnik["ime"], "priimek" => $uporabnik["priimek"], "email" => $uporabnik["email"]]);
}

function odjava() {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $p = session_get_cookie_params();
        setcookie(session_name(), "", time() - 3600, $p["path"], $p["domain"], $p["secure"], $p["httponly"]);
    }
    session_destroy();
    odgovori(["uspeh" => true]);
}

function imeRazreda($letnik, $oznaka) {
    return $letnik . ". " . $oznaka;
}

function seznamIzvedb($pdo, $idProfesor) {
    $poizvedba = $pdo->prepare(
        "SELECT i.id_izvedba, r.id_razred, r.letnik, r.oznaka AS razred_oznaka,
                p.sifra, p.naziv, p.barva,
                (SELECT COUNT(*) FROM Dijak_izvedba di
                  WHERE di.id_izvedba = i.id_izvedba AND di.status = 'aktiven') AS stevilo,
                (SELECT MIN(n.rok_oddaje) FROM Naloga n
                  WHERE n.id_izvedba = i.id_izvedba AND n.aktivna = 1 AND n.rok_oddaje >= NOW()) AS rok,
                (SELECT COUNT(*) FROM Oddaja o
                  JOIN Naloga n ON n.id_naloga = o.id_naloga
                  WHERE n.id_izvedba = i.id_izvedba AND n.aktivna = 1) AS oddano,
                (SELECT COUNT(*) FROM Oddaja o
                  JOIN Naloga n ON n.id_naloga = o.id_naloga
                  JOIN Ocena_oddaje oc ON oc.id_oddaja = o.id_oddaja AND oc.ocenjena_verzija = o.verzija
                  WHERE n.id_izvedba = i.id_izvedba AND n.aktivna = 1) AS pregledano
         FROM Profesor_izvedba pi
         JOIN Izvedba_predmeta i ON i.id_izvedba = pi.id_izvedba
         JOIN Predmet p ON p.id_predmet = i.id_predmet
         JOIN Razred r ON r.id_razred = i.id_razred
         WHERE pi.id_profesor = ? AND pi.aktivna = 1 AND i.aktivna = 1 AND p.aktiven = 1
           AND r.id_solsko_leto = " . TRENUTNO_LETO . "
         ORDER BY r.letnik, r.oznaka, p.naziv"
    );
    $poizvedba->execute([$idProfesor]);

    $izvedbe = [];
    foreach ($poizvedba->fetchAll() as $vrstica) {
        $izvedbe[] = [
            "id" => (int)$vrstica["id_izvedba"],
            "id_razred" => (int)$vrstica["id_razred"],
            "razred" => imeRazreda($vrstica["letnik"], $vrstica["razred_oznaka"]),
            "oznaka" => $vrstica["sifra"],
            "naziv" => $vrstica["naziv"],
            "barva" => $vrstica["barva"],
            "stevilo" => (int)$vrstica["stevilo"],
            "enota" => "dijakov",
            "rok" => $vrstica["rok"],
            "oddano" => (int)$vrstica["oddano"],
            "pregledano" => (int)$vrstica["pregledano"]
        ];
    }
    return $izvedbe;
}

function steviloRazredov($izvedbe) {
    return count(array_unique(array_column($izvedbe, "id_razred")));
}

function povzetekNalog($pdo, $idProfesor) {
    $poizvedba = $pdo->prepare(
        "SELECT COUNT(o.id_oddaja) AS oddano,
                COALESCE(SUM(CASE WHEN oc.id_oddaja IS NOT NULL THEN 1 ELSE 0 END), 0) AS pregledano,
                COALESCE(SUM(CASE WHEN YEARWEEK(o.oddano_zadnjic, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END), 0) AS teden_oddano,
                COALESCE(SUM(CASE WHEN YEARWEEK(o.oddano_zadnjic, 1) = YEARWEEK(CURDATE(), 1) AND oc.id_oddaja IS NOT NULL THEN 1 ELSE 0 END), 0) AS teden_pregledano
         FROM Oddaja o
         JOIN Naloga n ON n.id_naloga = o.id_naloga AND n.aktivna = 1
         JOIN Profesor_izvedba pi ON pi.id_izvedba = n.id_izvedba AND pi.id_profesor = ? AND pi.aktivna = 1
         LEFT JOIN Ocena_oddaje oc ON oc.id_oddaja = o.id_oddaja AND oc.ocenjena_verzija = o.verzija"
    );
    $poizvedba->execute([$idProfesor]);
    $vrstica = $poizvedba->fetch();
    return [
        "za_pregled" => (int)$vrstica["oddano"] - (int)$vrstica["pregledano"],
        "teden_oddano" => (int)$vrstica["teden_oddano"],
        "teden_pregledano" => (int)$vrstica["teden_pregledano"]
    ];
}


function profil($pdo) {
    $profesor = zahtevajProfesorja($pdo);

    $poizvedba = $pdo->prepare(
        "SELECT GROUP_CONCAT(DISTINCT p.sifra ORDER BY p.sifra SEPARATOR ', ')
         FROM Profesor_izvedba pi
         JOIN Izvedba_predmeta i ON i.id_izvedba = pi.id_izvedba
         JOIN Predmet p ON p.id_predmet = i.id_predmet
         WHERE pi.id_profesor = ? AND pi.aktivna = 1"
    );
    $poizvedba->execute([$profesor["id_profesor"]]);

    odgovori([
        "ime" => $profesor["ime"] . " " . $profesor["priimek"],
        "eposta" => $profesor["email"],
        "telefon" => $profesor["telefon"],
        "predmeti" => $poizvedba->fetchColumn() ?: ""
    ]);
}

function profilShrani($pdo) {
    samoPost();
    $profesor = zahtevajProfesorja($pdo);
    $vhod = preberiVhod();


    $deli = preg_split("/\s+/", trim($vhod["ime"] ?? ""), 2);
    $ime = $deli[0];
    $priimek = $deli[1] ?? "";
    $eposta = trim($vhod["eposta"] ?? "");
    $telefon = trim($vhod["telefon"] ?? "");

    if ($ime === "" || $priimek === "") odgovori(["napaka" => "Vnesite ime in priimek"], 400);
    if (!filter_var($eposta, FILTER_VALIDATE_EMAIL) || mb_strlen($eposta) > 254) odgovori(["napaka" => "Vnesite veljavno e-pošto"], 400);
    if (mb_strlen($ime) > 50 || mb_strlen($priimek) > 100 || mb_strlen($telefon) > 32) odgovori(["napaka" => "Vnos je predolg"], 400);

    try {
        $poizvedba = $pdo->prepare("UPDATE Uporabnik SET ime = ?, priimek = ?, email = ?, telefon = ? WHERE id_uporabnik = ?");
        $poizvedba->execute([$ime, $priimek, $eposta, $telefon === "" ? null : $telefon, $profesor["id_uporabnik"]]);
    } catch (PDOException $napaka) {
        if ($napaka->getCode() == 23000) odgovori(["napaka" => "E-pošta je že v uporabi"], 409);
        throw $napaka;
    }
    odgovori(["uspeh" => true]);
}


const STOLPCI_NASTAVITEV = ["tedenski_povzetek", "opomnik_rok", "novi_vpisi"];

function nastavitve($pdo) {
    $profesor = zahtevajProfesorja($pdo);

    $poizvedba = $pdo->prepare("SELECT tedenski_povzetek, opomnik_rok, novi_vpisi FROM Nastavitve_uporabnika WHERE id_uporabnik = ?");
    $poizvedba->execute([$profesor["id_uporabnik"]]);
    $vrstica = $poizvedba->fetch();
    if (!$vrstica) odgovori(null);

    $rezultat = [];
    foreach (STOLPCI_NASTAVITEV as $stolpec) {
        $rezultat[$stolpec] = (bool)$vrstica[$stolpec];
    }
    odgovori($rezultat);
}

function nastavitveShrani($pdo) {
    samoPost();
    $profesor = zahtevajProfesorja($pdo);
    $vhod = preberiVhod();

    $vrednosti = [];
    foreach (STOLPCI_NASTAVITEV as $stolpec) {
        $vrednosti[] = !empty($vhod[$stolpec]) ? 1 : 0;
    }

    $poizvedba = $pdo->prepare(
        "INSERT INTO Nastavitve_uporabnika (id_uporabnik, tedenski_povzetek, opomnik_rok, novi_vpisi)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            tedenski_povzetek = VALUES(tedenski_povzetek),
            opomnik_rok = VALUES(opomnik_rok),
            novi_vpisi = VALUES(novi_vpisi)"
    );
    $poizvedba->execute(array_merge([$profesor["id_uporabnik"]], $vrednosti));
    odgovori(["uspeh" => true]);
}


function dashboard($pdo) {
    $profesor = zahtevajProfesorja($pdo);

    $poizvedba = $pdo->prepare(
        "SELECT d.id_dogodek AS id, d.naslov, p.sifra, p.naziv, p.barva
         FROM Dogodek d
         LEFT JOIN Predmet p ON p.id_predmet = d.id_predmet
         WHERE d.id_uporabnik = ? AND d.datum = CURDATE()
         ORDER BY d.id_dogodek"
    );
    $poizvedba->execute([$profesor["id_uporabnik"]]);
    $dogodkiDanes = $poizvedba->fetchAll();

    $poizvedba = $pdo->prepare(
        "SELECT n.naslov, n.rok_oddaje, p.sifra, r.letnik, r.oznaka AS razred_oznaka,
                DATEDIFF(n.rok_oddaje, CURDATE()) AS dni
         FROM Naloga n
         JOIN Profesor_izvedba pi ON pi.id_izvedba = n.id_izvedba AND pi.id_profesor = ? AND pi.aktivna = 1
         JOIN Izvedba_predmeta i ON i.id_izvedba = n.id_izvedba
         JOIN Predmet p ON p.id_predmet = i.id_predmet
         JOIN Razred r ON r.id_razred = i.id_razred
         WHERE n.aktivna = 1 AND n.rok_oddaje >= NOW()
         ORDER BY n.rok_oddaje
         LIMIT 1"
    );
    $poizvedba->execute([$profesor["id_profesor"]]);
    $rok = $poizvedba->fetch() ?: null;
    if ($rok) {
        $rok = [
            "naslov" => $rok["naslov"],
            "rok" => $rok["rok_oddaje"],
            "oznaka" => $rok["sifra"],
            "razred" => imeRazreda($rok["letnik"], $rok["razred_oznaka"]),
            "dni" => (int)$rok["dni"]
        ];
    }

    $povzetek = povzetekNalog($pdo, $profesor["id_profesor"]);
    $predmeti = seznamIzvedb($pdo, $profesor["id_profesor"]);

    odgovori([
        "dogodki_danes" => $dogodkiDanes,
        "rok" => $rok,
        "za_pregled" => $povzetek["za_pregled"],
        "teden_oddano" => $povzetek["teden_oddano"],
        "teden_pregledano" => $povzetek["teden_pregledano"],
        "st_razredov" => steviloRazredov($predmeti),
        "predmeti" => $predmeti
    ]);
}

function predmeti($pdo) {
    $profesor = zahtevajProfesorja($pdo);
    $predmeti = seznamIzvedb($pdo, $profesor["id_profesor"]);
    odgovori(["predmeti" => $predmeti, "st_razredov" => steviloRazredov($predmeti)]);
}

function naloge($pdo) {
    $profesor = zahtevajProfesorja($pdo);

  
    $poizvedba = $pdo->prepare(
        "SELECT n.id_naloga, n.naslov, n.rok_oddaje, p.sifra, p.barva, r.letnik, r.oznaka AS razred_oznaka,
                COUNT(o.id_oddaja) AS oddano,
                COALESCE(SUM(CASE WHEN oc.id_oddaja IS NOT NULL THEN 1 ELSE 0 END), 0) AS pregledano
         FROM Naloga n
         JOIN Profesor_izvedba pi ON pi.id_izvedba = n.id_izvedba AND pi.id_profesor = ? AND pi.aktivna = 1
         JOIN Izvedba_predmeta i ON i.id_izvedba = n.id_izvedba
         JOIN Predmet p ON p.id_predmet = i.id_predmet
         JOIN Razred r ON r.id_razred = i.id_razred
         JOIN Oddaja o ON o.id_naloga = n.id_naloga
         LEFT JOIN Ocena_oddaje oc ON oc.id_oddaja = o.id_oddaja AND oc.ocenjena_verzija = o.verzija
         WHERE n.aktivna = 1
         GROUP BY n.id_naloga, n.naslov, n.rok_oddaje, p.sifra, p.barva, r.letnik, r.oznaka
         HAVING oddano > pregledano
         ORDER BY n.rok_oddaje
         LIMIT 20"
    );
    $poizvedba->execute([$profesor["id_profesor"]]);

    $seznam = [];
    foreach ($poizvedba->fetchAll() as $vrstica) {
        $seznam[] = [
            "id" => (int)$vrstica["id_naloga"],
            "naziv" => $vrstica["naslov"],
            "rok" => $vrstica["rok_oddaje"],
            "oznaka" => $vrstica["sifra"],
            "barva" => $vrstica["barva"],
            "razred" => imeRazreda($vrstica["letnik"], $vrstica["razred_oznaka"]),
            "za_pregled" => (int)$vrstica["oddano"] - (int)$vrstica["pregledano"]
        ];
    }

    $povzetek = povzetekNalog($pdo, $profesor["id_profesor"]);
    $povzetek["naloge"] = $seznam;
    odgovori($povzetek);
}


function tipGradiva($vrsta, $izvornoIme) {
    if ($vrsta === "video") return "VIDEO";
    if ($vrsta === "povezava") return "URL";
    $koncnica = strtolower(pathinfo($izvornoIme ?? "", PATHINFO_EXTENSION));
    if ($koncnica === "pdf") return "PDF";
    if ($vrsta === "predstavitev" || in_array($koncnica, ["ppt", "pptx"])) return "PPT";
    return "DOC";
}

function gradiva($pdo) {
    $profesor = zahtevajProfesorja($pdo);

    $poizvedba = $pdo->prepare(
        "SELECT g.id_gradivo, g.naslov, g.vrsta, g.url, d.izvorno_ime,
                p.sifra, p.barva, r.letnik, r.oznaka AS razred_oznaka
         FROM Gradivo g
         JOIN Profesor_izvedba pi ON pi.id_izvedba = g.id_izvedba AND pi.id_profesor = ? AND pi.aktivna = 1
         JOIN Izvedba_predmeta i ON i.id_izvedba = g.id_izvedba
         JOIN Predmet p ON p.id_predmet = i.id_predmet
         JOIN Razred r ON r.id_razred = i.id_razred
         LEFT JOIN Datoteka d ON d.id_datoteka = g.id_datoteka
         WHERE g.aktivno = 1
         ORDER BY g.objavljeno DESC, g.id_gradivo DESC
         LIMIT 10"
    );
    $poizvedba->execute([$profesor["id_profesor"]]);

    $seznam = [];
    foreach ($poizvedba->fetchAll() as $vrstica) {
        $seznam[] = [
            "id" => (int)$vrstica["id_gradivo"],
            "naziv" => $vrstica["naslov"],
            "tip" => tipGradiva($vrstica["vrsta"], $vrstica["izvorno_ime"]),
            "url" => $vrstica["url"],
            "oznaka" => $vrstica["sifra"],
            "barva" => $vrstica["barva"],
            "razred" => imeRazreda($vrstica["letnik"], $vrstica["razred_oznaka"])
        ];
    }
    odgovori($seznam);
}

function gradivoOdpri($pdo) {
    global $mapaShrambe;
    $profesor = zahtevajProfesorja($pdo);

    $poizvedba = $pdo->prepare(
        "SELECT d.storage_kljuc, d.izvorno_ime, d.mime_tip
         FROM Gradivo g
         JOIN Datoteka d ON d.id_datoteka = g.id_datoteka
         JOIN Profesor_izvedba pi ON pi.id_izvedba = g.id_izvedba AND pi.id_profesor = ? AND pi.aktivna = 1
         WHERE g.id_gradivo = ?"
    );
    $poizvedba->execute([$profesor["id_profesor"], (int)($_GET["id"] ?? 0)]);
    $datoteka = $poizvedba->fetch();
    if (!$datoteka) odgovori(["napaka" => "Gradivo ne obstaja"], 404);

    $koren = realpath($mapaShrambe);
    $pot = $koren ? realpath($koren . "/" . $datoteka["storage_kljuc"]) : false;
    if (!$pot || strpos($pot, $koren . DIRECTORY_SEPARATOR) !== 0 || !is_file($pot)) {
        odgovori(["napaka" => "Datoteke ni na strežniku"], 404);
    }

    header("Content-Type: " . $datoteka["mime_tip"]);
    header("X-Content-Type-Options: nosniff");
    header("Content-Disposition: inline; filename*=UTF-8''" . rawurlencode($datoteka["izvorno_ime"]));
    header("Content-Length: " . filesize($pot));
    readfile($pot);
    exit;
}

function gradivoDodaj($pdo) {
    global $mapaShrambe;
    samoPost();
    $profesor = zahtevajProfesorja($pdo);
    $vhod = preberiVhod();
    $idIzvedba = (int)($vhod["izvedba_id"] ?? 0);

    $poizvedba = $pdo->prepare("SELECT 1 FROM Profesor_izvedba WHERE id_profesor = ? AND id_izvedba = ? AND aktivna = 1");
    $poizvedba->execute([$profesor["id_profesor"], $idIzvedba]);
    if (!$poizvedba->fetch()) odgovori(["napaka" => "Izberite predmet"], 400);

    if (isset($_FILES["datoteka"])) {
        $datoteka = $_FILES["datoteka"];
        $dovoljene = [
            "pdf" => ["dokument", "application/pdf"],
            "doc" => ["dokument", "application/msword"],
            "docx" => ["dokument", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
            "ppt" => ["predstavitev", "application/vnd.ms-powerpoint"],
            "pptx" => ["predstavitev", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
        ];
        $koncnica = strtolower(pathinfo($datoteka["name"], PATHINFO_EXTENSION));

        if ($datoteka["error"] !== UPLOAD_ERR_OK) odgovori(["napaka" => "Nalaganje ni uspelo"], 400);
        if (!isset($dovoljene[$koncnica])) odgovori(["napaka" => "Dovoljeni so PDF, PPT in DOC"], 400);
        if ($datoteka["size"] <= 0 || $datoteka["size"] > 10 * 1024 * 1024) odgovori(["napaka" => "Datoteka je prazna ali prevelika (največ 10 MB)"], 400);

        $mapa = rtrim($mapaShrambe, "/") . "/gradiva/";
        if (!is_dir($mapa)) mkdir($mapa, 0755, true);

        $novoIme = bin2hex(random_bytes(8)) . "." . $koncnica;
        if (!move_uploaded_file($datoteka["tmp_name"], $mapa . $novoIme)) odgovori(["napaka" => "Shranjevanje ni uspelo"], 500);

        $izvornoIme = mb_substr(basename($datoteka["name"]), 0, 255);
        $naziv = mb_substr(pathinfo($izvornoIme, PATHINFO_FILENAME), 0, 200);
        if (trim($naziv) === "") $naziv = "Gradivo";

        try {
            $pdo->beginTransaction();
            $poizvedba = $pdo->prepare(
                "INSERT INTO Datoteka (id_lastnik, izvorno_ime, shranjeno_ime, storage_kljuc, mime_tip, velikost_bajtov)
                 VALUES (?, ?, ?, ?, ?, ?)"
            );
            $poizvedba->execute([$profesor["id_uporabnik"], $izvornoIme, $novoIme, "gradiva/" . $novoIme, $dovoljene[$koncnica][1], $datoteka["size"]]);
            $idDatoteka = (int)$pdo->lastInsertId();

            $poizvedba = $pdo->prepare(
                "INSERT INTO Gradivo (id_izvedba, id_profesor, naslov, vrsta, id_datoteka) VALUES (?, ?, ?, ?, ?)"
            );
            $poizvedba->execute([$idIzvedba, $profesor["id_profesor"], $naziv, $dovoljene[$koncnica][0], $idDatoteka]);
            $idGradivo = (int)$pdo->lastInsertId();
            $pdo->commit();
        } catch (Throwable $napaka) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            @unlink($mapa . $novoIme);
            throw $napaka;
        }
    } else {
        $url = trim($vhod["url"] ?? "");
        $shema = parse_url($url, PHP_URL_SCHEME);
        if (!filter_var($url, FILTER_VALIDATE_URL) || !in_array($shema, ["http", "https"]) || mb_strlen($url) > 2048) {
            odgovori(["napaka" => "Vnesite veljavno povezavo"], 400);
        }
        $naziv = mb_substr(trim($vhod["naziv"] ?? "") ?: parse_url($url, PHP_URL_HOST), 0, 200);

        $poizvedba = $pdo->prepare(
            "INSERT INTO Gradivo (id_izvedba, id_profesor, naslov, vrsta, url) VALUES (?, ?, ?, 'povezava', ?)"
        );
        $poizvedba->execute([$idIzvedba, $profesor["id_profesor"], $naziv, $url]);
        $idGradivo = (int)$pdo->lastInsertId();
    }
    odgovori(["uspeh" => true, "id" => $idGradivo]);
}


function dogodki($pdo) {
    $profesor = zahtevajProfesorja($pdo);

    $poizvedba = $pdo->prepare(
        "SELECT id_dogodek AS id, naslov, datum, id_predmet
         FROM Dogodek WHERE id_uporabnik = ? ORDER BY datum, id_dogodek"
    );
    $poizvedba->execute([$profesor["id_uporabnik"]]);
    $dogodki = $poizvedba->fetchAll();

    foreach ($dogodki as &$dogodek) {
        $dogodek["id"] = (int)$dogodek["id"];
        $dogodek["id_predmet"] = $dogodek["id_predmet"] === null ? null : (int)$dogodek["id_predmet"];
    }

    $poizvedba = $pdo->query("SELECT id_predmet AS id, sifra, naziv, barva FROM Predmet WHERE aktiven = 1 ORDER BY naziv");
    $predmeti = $poizvedba->fetchAll();
    foreach ($predmeti as &$predmet) $predmet["id"] = (int)$predmet["id"];

    odgovori(["dogodki" => $dogodki, "predmeti" => $predmeti]);
}

function dogodekDodaj($pdo) {
    samoPost();
    $profesor = zahtevajProfesorja($pdo);
    $vhod = preberiVhod();

    $naslov = mb_substr(trim($vhod["naslov"] ?? ""), 0, 200);
    $datum = $vhod["datum"] ?? "";
    $idPredmet = ($vhod["id_predmet"] ?? "") === "" || $vhod["id_predmet"] === null ? null : (int)$vhod["id_predmet"];

    $veljavenDatum = DateTime::createFromFormat("Y-m-d", $datum);
    if ($naslov === "" || !$veljavenDatum || $veljavenDatum->format("Y-m-d") !== $datum) {
        odgovori(["napaka" => "Neveljavni podatki"], 400);
    }

    if ($idPredmet !== null) {
        $poizvedba = $pdo->prepare("SELECT 1 FROM Predmet WHERE id_predmet = ? AND aktiven = 1");
        $poizvedba->execute([$idPredmet]);
        if (!$poizvedba->fetch()) odgovori(["napaka" => "Predmet ne obstaja"], 400);
    }

    $poizvedba = $pdo->prepare("INSERT INTO Dogodek (id_uporabnik, id_predmet, naslov, datum) VALUES (?, ?, ?, ?)");
    $poizvedba->execute([$profesor["id_uporabnik"], $idPredmet, $naslov, $datum]);
    odgovori(["uspeh" => true, "id" => (int)$pdo->lastInsertId()]);
}

function dogodekOdstrani($pdo) {
    samoPost();
    $profesor = zahtevajProfesorja($pdo);
    $vhod = preberiVhod();

    $poizvedba = $pdo->prepare("DELETE FROM Dogodek WHERE id_dogodek = ? AND id_uporabnik = ?");
    $poizvedba->execute([(int)($vhod["id"] ?? 0), $profesor["id_uporabnik"]]);
    odgovori(["uspeh" => true]);
}


$akcija = $_GET["akcija"] ?? "";

try {
    switch ($akcija) {
        case "prijava":           prijava($pdo); break;
        case "odjava":            odjava(); break;
        case "profil":            profil($pdo); break;
        case "profil_shrani":     profilShrani($pdo); break;
        case "nastavitve":        nastavitve($pdo); break;
        case "nastavitve_shrani": nastavitveShrani($pdo); break;
        case "dashboard":         dashboard($pdo); break;
        case "predmeti":          predmeti($pdo); break;
        case "naloge":            naloge($pdo); break;
        case "gradiva":           gradiva($pdo); break;
        case "gradivo_odpri":     gradivoOdpri($pdo); break;
        case "gradivo_dodaj":     gradivoDodaj($pdo); break;
        case "dogodki":           dogodki($pdo); break;
        case "dogodek_dodaj":     dogodekDodaj($pdo); break;
        case "dogodek_odstrani":  dogodekOdstrani($pdo); break;
        default:                  odgovori(["napaka" => "Neznana akcija"], 400);
    }
} catch (Throwable $napaka) {
    odgovori(["napaka" => "Napaka na strežniku"], 500);
}
