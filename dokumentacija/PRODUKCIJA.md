# Zagon in priprava na objavo

Projekt še ni objavljen na hosting. Razvojni podatki in obstoječi MariaDB volumen so ohranjeni. Backend ostaja Express z bcrypt in express-session; frontend je navaden JavaScript s slovenskimi imeni in brez novih ogrodij.

## Lokalni razvoj

Kopiraj `.env.example` v `.env` in nastavi `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `SESSION_SECRET`. Skrivnosti niso v Git. Za `SESSION_SECRET` uporabi vsaj 32 naključnih bajtov; izpiše jih `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Vrednost shrani samo v `.env` in je med ponovnimi zagoni ne spreminjaj po nepotrebnem.

```sh
docker compose up -d --build
docker compose ps
```

Aplikacija je na `http://localhost:3000`, health na `/api/health`. Razvojni računi iz `baza/SQL.sql` so `admin`, `profesor01`–`profesor20`, `dijak001`–`dijak100`; razvojno geslo je navedeno v obstoječem SQL. Ta podatek ne velja za novo produkcijsko bazo.

Za zagon Node neposredno na gostitelju nastavi poti `UPLOAD_DIR`, `BACKUP_DIR` na lokalni mapi in `DB_HOST=127.0.0.1`. `DB_DUMP_BIN` naj kaže na lokalni `mariadb-dump`, če želiš kopije tudi zunaj Dockerja. Nato v `aplikacija` izvedi `npm ci` in `npm start`. Node prebere korenski `.env`; razvojni Docker uporablja `env_file`, produkcijski Compose pa poda samo potrebne spremenljivke in aplikaciji ne preda gesla skrbnika baze. Ime baze naj ostane `sola_is`, ker ga uporabljata obstoječa inicializacijska SQL skripta in njena produkcijska različica.

## Baza in podatki

Razvojni Compose še vedno uporablja isti ključ `baza_podatki` in `/var/lib/mysql`. Navaden restart ali `docker compose down` podatkov ne izbriše. **`docker compose down -v` namenoma odstrani volumne in podatke; ne uporabljaj ga za običajen ponovni zagon.** Pri nadaljevanju iste namestitve ohrani ime Compose projekta, sicer Compose ustvari drug volumen in baza je videti prazna.

`baza/SQL.sql` ostaja razvojna inicializacija z obstoječimi 22 tabelami in vzorčno vsebino. `baza/struktura.sql` vsebuje iste tabele ter samo začetni program, šolsko leto in nastavitve šole, brez razvojnih oseb, gesel, nalog in datotek. Namenjena je novi prazni produkcijski bazi. Pri kasnejših spremembah tabel uskladi obe datoteki.

MariaDB izvede `/docker-entrypoint-initdb.d` samo ob prvi inicializaciji praznega podatkovnega direktorija. Zamenjava SQL datoteke ne spremeni že inicializirane baze. Obstoječega volumna ne briši, da bi ponovno izvedel SQL; za poznejše spremembe uporabi pregledano migracijo in predhodno kopijo.

Edina dodatna tabela ob zagonu aplikacije je `Http_seje`, ki jo ustvari `express-mysql-session`: `session_id VARCHAR(128)` primarni ključ, `expires INT UNSIGNED`, `data MEDIUMTEXT`. Obstoječa tabela `Seja` ostane ohranjena; knjižnica uporablja svojo obliko zapisa. Drugih sprememb obstoječe SQL strukture ni.

## Seje in dovoljenja

Seje so v MariaDB tudi pri razvoju in preživijo ponovni zagon Node. Piškotek `rps.sid` ima `HttpOnly`, `SameSite=Lax` in v produkciji `Secure`. Trajanje je 30, 60 ali 240 minut nedejavnosti, nastavljeno v sistemskih nastavitvah; nova nastavitev velja ob naslednji prijavi. Ob prijavi se ID seje zamenja, ob odjavi se seja uniči. Menjava gesla zahteva trenutno geslo in prekliče vse seje tega računa.

Vsak zaščiten zahtevek ponovno preveri aktivnost in vlogo v bazi. Spremembe zahtevajo CSRF žeton. Profesorjevi zahtevki preverjajo aktivno povezavo z izvedbo; arhivirano leto dovoljuje branje. Dijak lahko prenese gradivo svoje izvedbe in svojo oddajo. Zaščiten je tudi neposreden dostop do HTML strani. Stare PHP poti vrnejo 404. Poti do vseh CSS in JS so absolutne glede na `public`.

Uporabljeni so Helmet, omejeni JSON/obrazci, omejitev poskusov prijave, parametri v SQL, preverjanje podatkov ter enotna obravnava napak brez razkritja stack trace. Nastavitev proxyja sledi [navodilom express-session](https://expressjs.com/en/resources/middleware/session/).

## Produkcijski Compose in Nginx

Za novo namestitev uporabi ločeno ime projekta in produkcijsko datoteko:

```sh
docker compose -p rps-prod -f docker-compose.prod.yml config --quiet
docker compose -p rps-prod -f docker-compose.prod.yml up -d --build
```

To ustvari novo produkcijsko bazo; ne preseli samodejno razvojne. Če že obstaja produkcijska namestitev, uporabi njeno isto ime projekta in ohrani njene volumne. V `.env` nastavi močna različna gesla in `NODE_ENV=production`; Compose tudi sam določi produkcijski način za aplikacijo. Prva nastavitev šole in leta je začetni podatek, ki ga po prijavi popraviš v administratorskem delu.

Internet → Nginx → `aplikacija:3000` → `baza:3306`. Javni sta samo vrati 80 in 443 na Nginxu. Node in MariaDB v produkcijskem Compose nimata objavljenih gostiteljskih vrat. Express zaupa enemu proxyju. Nginx sam nastavi `X-Forwarded-Proto` in prepiše zunanjo posredovano glavo.

`nginx/default.conf` je začetna HTTP konfiguracija za preverjanje povezljivosti. **Produkcijska prijava potrebuje HTTPS, ker so sejni piškotki varni.** HTTP health check deluje že pred nastavitvijo domene. Zaradi tega konfiguracije še ne odpiraj kot javno končno aplikacijo.

Po izbiri gostovanja:

1. Pripravi strežnik z Dockerjem, varne dostope in požarni zid; baza in Node naj ostaneta interna.
2. Nastavi domeno in DNS A oziroma AAAA na strežnik.
3. Pridobi pravi certifikat s preverjanjem domene, npr. Let's Encrypt. V Git ne shranjuj zasebnih ključev ali certifikatov.
4. Prilagodi `nginx/https.conf.example`, priklopi certifikate samo za branje v `/etc/letsencrypt` in po potrebi mapo ACME preverjanja. V Compose zamenjaj priklop `default.conf` z dejansko HTTPS konfiguracijo. Certifikati še niso pridobljeni.
5. Izvedi `nginx -t`, ponovno naloži Nginx, preveri preusmeritev HTTP→HTTPS in varni piškotek. Uredi samodejno obnavljanje certifikata in ponovno nalaganje Nginxa.
6. Ustvari prvega skrbnika, nastavi šolski kontakt, trenutno leto in varnostne kopije. Ponovi prijavne in avtorizacijske preizkuse prek dejanske domene.

Prvi administrator v novi bazi se ustvari interaktivno brez gesla v ukazni vrstici:

```sh
docker compose -p rps-prod -f docker-compose.prod.yml exec aplikacija node skripte/dodaj-admin.js
```

Skripta zahteva uporabniško ime, e-naslov in skrito geslo z vsaj 12 znaki. Podvojeno ime ali e-naslov zavrne. Novo produkcijsko okolje nima znanih razvojnih računov. Za javni demo uporabi le nekaj jasno testnih oseb z naslovi `example.org` in novimi gesli; razvojnih 121 računov z znanim skupnim geslom ne izpostavljaj javnosti.

## Datoteke in varnostne kopije

Naložene datoteke so v volumnu `datoteke`, kopije iz aplikacije v volumnu `kopije`. Oba ohranita podatke po ponovnem zagonu in običajnem `down`. Aplikacija teče kot uporabnik `node`. Pri priklopu lastnih gostiteljskih map zagotovi pisanje za UID 1000 in omejene pravice.

Administratorjev gumb **Naredi kopijo zdaj** dejansko pokliče `mariadb-dump`. Samodejne kopije po vklopu delujejo v eni instanci aplikacije: preverjanje je vsako minuto, po 07:00 v časovnem pasu šole, dnevno ali vsakih sedem dni. Aplikacija mora teči; ne gre za neodvisno gostiteljsko opravilo. Napaka se zapiše v dnevnik, neuspešna delna datoteka se odstrani. Imena so `sola-<datum in čas>.sql`, pravice 0600, geslo je podano procesu prek okolja.

Za ročno kopijo na gostitelju uporabi iz korena projekta POSIX lupino (Linux ali Git Bash na Windows):

```sh
sh skripte/backup.sh
COMPOSE_PROJECT_NAME=rps-prod COMPOSE_FILE=docker-compose.prod.yml sh skripte/backup.sh
```

Skripta uporablja vrednosti `MARIADB_*` iz okolja vsebnika in shrani kopijo v gostiteljsko `backup/`. `.env` in vse kopije so ignorirane v Git. Kopije vsebujejo osebne podatke in hashe gesel, zato jih hrani zasebno in kopiraj tudi izven tega strežnika. Določi rok hrambe ter redno preverjaj obnovljivost; samodejnega brisanja starih kopij ni.

**SQL dump ne vsebuje naloženih dokumentov.** Za popolno obnovo ločeno varnostno kopiraj tudi volumen `datoteke` in zaščiten `.env`. Za usklajen posnetek med kopiranjem začasno ustavi aplikacijo. Kopijo iz volumna aplikacije preneseš z `docker compose cp aplikacija:/app/backup/ime.sql backup/ime.sql` (v produkciji dodaj isto ime projekta in `-f`).

Obnovitev je ročna in prepiše podatke. Najprej ustavi aplikacijo, naredi novo kopijo trenutne baze, preveri izvor izbrane kopije ter izrecno potrdi:

```sh
sh skripte/restore.sh backup/izbrana.sql --potrdi
COMPOSE_PROJECT_NAME=rps-prod COMPOSE_FILE=docker-compose.prod.yml sh skripte/restore.sh backup/izbrana.sql --potrdi
```

Obnova ni bila samodejno izvedena. Po njej obnovi pripadajoče dokumente, preveri `/api/health` in pravice uporabnikov ter zaženi aplikacijo. Spremljanje prostora, oddaljena hramba, nadzor opozoril in produkcijski razpored varnostnih preverjanj ostanejo naloge dejanske namestitve.

## Preverjanje

Iz `aplikacija`: `npm test` preveri sintakso ter vse lokalne CSS/JS poti in pripadajoče skripte. `npm run test:api` je **namenjen izključno ločeni razvojni testni bazi**, saj ustvarja in spreminja vzorčne podatke; privzeto uporablja `http://127.0.0.1:13000`. Ne usmeri ga na produkcijo.

Ločeni testni okolji zaženeš iz korena:

```sh
docker compose -p rps-preizkus -f aplikacija/test/compose.yml up -d --build
docker compose -p rps-produk-test -f aplikacija/test/compose.prod.yml up -d
node aplikacija/test/api.js
node aplikacija/test/brskalnik.cjs
node aplikacija/test/docker.cjs
```

Testni konfiguraciji uporabljata začasni bazi v pomnilniku in javni dostop omejita na `127.0.0.1:13000` oziroma `127.0.0.1:18081`. Gesla v teh konfiguracijah so izključno javne lokalne testne vrednosti. Za produkcijo vedno uporabi korenski `docker-compose.prod.yml` in svoja gesla. Testni okolji ustavi z istima ukazoma `docker compose ... down`, brez `-v`.

`node aplikacija/test/brskalnik.cjs` uporablja lokalni Chrome; po potrebi nastavi `BROWSER_PATH`. `node aplikacija/test/docker.cjs` preverja ločeni testni Compose okolji. Prijave, datoteke, ocene, obrazci in arhiviranje so bili preizkušeni na začasnih MariaDB bazah v pomnilniku, brez priklopa obstoječega podatkovnega volumna. Podrobnosti API-jev in omejitev so v [API.md](API.md).

Končni rezultat preverjanja: 48 datotek JavaScript in vse CSS/JS poti so pravilne, 118 preverjanj API-jev je uspešnih, 230 preverjanj v Chromu je uspešnih. Ti vključujejo dejansko oddajo datoteke, preverjanje rokov, prenos gradiva in primerjavo navigacije med profesorjevimi stranmi ter profilom pri različnih velikostih okna. Prej je uspelo tudi 14 preverjanj Dockerja/Nginxa/sej. `npm audit` ni poročal o ranljivostih. Gradnja Docker slike je uspela; lokalni Node vsebnik je bil posodobljen ob ohranjeni MariaDB in njenem volumnu. Obnovitev baze, javna domena in pravi certifikat niso bili izvedeni.

Prijavni obrazec dodatno preveri `node aplikacija/test/prijava.cjs`: Chrome dejansko odda obrazec za vse tri vloge, preveri preusmeritve in seje ter zavrnitev tujega izvora in napačnega gesla. Za druge lokalne naslove podaj URL, npr. `node aplikacija/test/prijava.cjs http://localhost:18082`. Preizkus je uspel neposredno na vratih 3000 in prek začasnega Nginxa na vratih 18082. Nastavitev `Referrer-Policy: strict-origin-when-cross-origin` omogoča pravilen `Origin` pri oddaji obrazca; Nginx v glavi `Host` ohrani tudi vrata. Po spremembi varnostnih glav osveži že odprto prijavno stran.
