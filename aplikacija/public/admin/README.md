# Skrbniška plošča – povezava s PHP in MySQL

## Zahteve
- PHP 7.4 ali novejši (deluje tudi z 8.x), razširitvi `pdo_mysql` in `mbstring`
- MySQL 5.7+ ali MariaDB 10.3+
- Apache (za zaščito map z `.htaccess`). XAMPP/WAMP vse to že vsebuje.

## Namestitev (XAMPP)
1. Mapo `admin` kopiraj v `C:\xampp\htdocs\` (ali v `/var/www/html/`).
2. Odpri **phpMyAdmin** → *Uvozi* → izberi `db/schema.sql` → *Izvedi*.
   Ustvari se baza `sola_admin` s tabelami in primeri podatkov.
3. Preveri `api/config.php` (uporabnik in geslo baze; v XAMPP-u sta privzeto `root` in prazno geslo).
4. V brskalniku odpri `http://localhost/admin/setup.php` in ustvari skrbnika.
5. Prijava: `http://localhost/admin/admin-prijava.html`.
6. **Po namestitvi izbriši `setup.php`.**

## Struktura
```
admin/
├─ *.html, *.css          tvoje strani (oblika ni spremenjena)
├─ admin-prijava.*        nova stran za prijavo
├─ setup.php              enkratna namestitev skrbnika
├─ js/admin.js            skupna koda: fetch na API, pogovorna okna, obvestila
├─ css/admin-ui.css       slog za pogovorna okna in obvestila
├─ api/                   PHP (vse vrne JSON)
│   config.php            podatki za bazo
│   bootstrap.php         PDO, seja, CSRF, pomožne funkcije
│   login / logout / me   prijava in seja
│   dashboard             nadzorna plošča
│   users                 uporabniki (seznam, dodaj, uredi, potrdi, odstrani, CSV)
│   subjects              predmeti in razredi
│   calendar              koledar
│   settings / backup / export / archive   nastavitve sistema
│   profile / password    profil in zamenjava gesla
│   cron_backup.php       samodejne kopije (iz ukazne vrstice)
├─ db/schema.sql          shema in začetni podatki
└─ backups/               varnostne kopije (.sql), dostop zaprt
```

## Kaj je povezano
| Stran | Povezava z bazo |
|---|---|
| Nadzorna plošča | števila uporabnikov, razredov, predmetov brez učitelja, disk, zadnja kopija |
| Uporabniki | seznam s filtrom po vlogi, iskanje, strani po 10, dodaj / uredi / potrdi vpis / odstrani, izvoz v CSV |
| Predmeti | seznam, dodaj, uredi, dodeli učitelja, odstrani; razredi po letnikih |
| Koledar | dogodki so v bazi (prej `localStorage`), vsak skrbnik vidi svoje |
| Nastavitve | branje in shranjevanje, kopija zdaj, izvoz podatkov (JSON), arhiviranje leta |
| Profil | osebni podatki, stikala, zamenjava gesla, odjava |

## Kaj ni (ali je samo shranjeno)
- **Strani Statistika ni več** v tvoji zadnji različici, zato kartica *Poročila* na nadzorni plošči nima cilja (povezava je `#`). Podatki zanjo so v tabeli `reports`.
- **Učni načrti** in **Zamenjaj sliko**: gumba za zdaj samo pokažeta obvestilo.
- **Dvostopenjsko preverjanje**, *Obvestilo o novi prijavi*, *Ročna potrditev vpisov*, *Starševski računi*, *Jezik vmesnika*: vrednosti se shranijo v bazo, a v tej plošči še ne spreminjajo delovanja (uporabi jih lahko aplikacija za dijake in učitelje).
- **Razpoložljivost (99,9 %)** se bere iz nastavitve `uptimePct` v tabeli `settings`; PHP je sam ne more izmeriti.
- **Arhiviraj šolsko leto** zapre razrede tega leta. V plošči ni obrazca za ustvarjanje novih razredov – dodaj jih v tabelo `classes` ali naroči razširitev.
- **Samodejne kopije** delujejo šele, ko `api/cron_backup.php` zaženeš po urniku:
  - Linux: `0 7 * * * php /pot/do/admin/api/cron_backup.php`
  - Windows: *Task Scheduler* → `php.exe C:\xampp\htdocs\admin\api\cron_backup.php`
- Dijaki, učitelji in starši se v to ploščo ne morejo prijaviti; prijava deluje samo za vlogo `admin`.

## Varnost
- Geslo je shranjeno z `password_hash` (bcrypt), vse poizvedbe so pripravljene (PDO), seja je `HttpOnly` + `SameSite=Lax`.
- Vsako spreminjanje podatkov zahteva CSRF žeton (`X-CSRF-Token`), ki ga doda `js/admin.js`.
- Prijava: po 5 napačnih poskusih v 15 minutah zaklep.
- Seja poteče po času iz *Nastavitve → Potek seje*.
- Na pravem strežniku: nastavi geslo za uporabnika baze (ne `root` brez gesla), vklopi HTTPS in `APP_DEBUG = false`.
