# Povezava z bazo

Vsi spodnji API-ji razen `GET /api/health` zahtevajo aktivno sejo. Spremembe zahtevajo še glavo `x-csrf-token`, ki jo vrne `GET /api/uporabnik`. Frontend uporablja `public/skupno/api.js`. Prijava ostaja obrazec `POST /login`, odjava `/logout`.

## Skupni podatki

| Pot | Namen |
| --- | --- |
| `GET /api/uporabnik` | Trenutni uporabnik, vloga, razred, razrednik, kontakt šole, CSRF |
| `PATCH /api/profil` | Lastna telefonska številka |
| `POST /api/geslo` | Menjava z `staro` in `novo`; preklic vseh sej tega računa |
| `GET, PATCH /api/nastavitve` | Lastne izbire obvestil |
| `GET /api/predmeti` | Aktivni predmeti za prijavljenega uporabnika |
| `GET /api/moji-predmeti` | Obstoječi seznam izvedb za dijaka |
| `GET, POST /api/dogodki` | Lastni koledar; ustvarjanje z `naslov`, `datum`, neobveznim `opis` |
| `DELETE /api/dogodki/:id` | Odstranitev lastnega dogodka |
| `GET /api/datoteke/:id` | Zaščiten prenos glede na vlogo in članstvo pri izvedbi |
| `GET /api/health` | Delovanje strežnika in povezave z bazo |

Profil je samo `/profil` oziroma ista datoteka `/profil.html`. Prejšnji trije naslovi profilov se preusmerijo. Imena in šolski e-naslov ureja administrator. Telefon in geslo lahko spremeni vsak sam.

## Dijak

Predpona je `/api/ucenec`. Zahtevana vloga je `dijak`; strežnik preveri aktivni vpis v izvedbo predmeta.

| Metoda in pot | Namen |
| --- | --- |
| `GET /naloge` | Dejanske naloge lastnih izvedb, lastne oddaje in ocene trenutne različice |
| `GET /gradiva` | Objavljena gradiva lastnih izvedb z informacijo, ali je datoteka na voljo |
| `POST /naloge/:id/oddaja` | Multipart: `datoteka`, `verzija` (0 za prvo oddajo), neobvezni `komentar` |

Oddaja je omejena z rokom in stanjem šolskega leta. Pozne oddaje so dovoljene samo, če jih dovoli naloga. Največja velikost je manjša od omejitve naloge in 10 MB. Dovoljeni formati so PDF, DOC, DOCX, PPT, PPTX, XLSX, TXT, SQL, ZIP, PNG in JPG/JPEG; strežnik preveri tudi vsebino. Datoteka se shrani zunaj `public`, metapodatki in oddaja pa v isti SQL transakciji. Ob napaki se nova datoteka odstrani.

Ponovna oddaja zamenja trenutno datoteko in poveča različico. Ob napačni različici strežnik vrne 409, da se novejša oddaja ne prepiše. Stara ocena ostane vezana na prejšnjo različico in ni prikazana kot ocena nove oddaje. Lastno datoteko lahko dijak prenese prek `/api/datoteke/:id`; profesor mora imeti dostop do iste izvedbe. Vzorčne datoteke, ki imajo v SQL samo metapodatke, so v gradivih označene kot nedosegljive.

## Profesor

Predpona je `/api/profesor`. Zahtevana vloga je `profesor`. Članstvo `Profesor_izvedba` mora biti aktivno; izvedba in predmet prav tako. Pisanje v arhivirano leto je zavrnjeno.

| Metoda in pot | Namen |
| --- | --- |
| `GET /dashboard` | Predmeti, današnji lastni dogodki, naslednji rok, dejansko število oddaj |
| `GET /predmeti` | Dodeljene izvedbe z razredi in številom dijakov |
| `GET /izvedbe/:id/dijaki` | Dijaki izbrane izvedbe |
| `GET /gradiva` | Objavljena gradiva dodeljenih izvedb |
| `POST /izvedbe/:id/gradiva` | JSON `naslov`, `url` ali multipart polje `datoteka` in neobvezni `naslov` |
| `DELETE /gradiva/:id` | Umik objave; datoteka ostane zaradi zgodovine in kopij |
| `GET /naloge` | Naloge izvedb in število oddaj za pregled |
| `POST /izvedbe/:id/naloge` | `naslov`, `opis`, `rok_oddaje` v ISO obliki, neobvezni `max_tock`, `dovoljena_pozna_oddaja` |
| `GET /naloge/:id/oddaje` | Navodila naloge, dejanske oddaje in obstoječe ocene |
| `PUT /oddaje/:id/ocena` | `verzija`, neobvezni `tocke`, `ocena`, `komentar`; vsaj en podatek |

Pri oceni se preverijo različica oddaje, razpon 1–5 in največje dovoljene točke. Datoteke PDF/DOC/DOCX/PPT/PPTX so omejene na 10 MB; strežnik preveri tudi začetne bajte datoteke. Shranijo se pod naključnim imenom zunaj `public`. Vzorčna datoteka iz SQL brez dejanske vsebine vrne 404.

## Administrator

Predpona je `/api/admin`. Zahtevana vloga je `administrator`.

| Metoda in pot | Namen |
| --- | --- |
| `GET /dashboard` | Dejanska števila računov, razredov in stanje kopij |
| `GET, POST /uporabniki` | Seznam in ustvarjanje računa s profilom Dijak/Profesor v isti transakciji |
| `PUT, DELETE /uporabniki/:id` | Urejanje ali brisanje nepovezanega računa |
| `GET /sifranti` | Šifranti in povezave za izbirnike |
| `POST /sifranti/:vir` | Ustvari zapis |
| `PUT, DELETE /sifranti/:vir/:id` | Spremeni ali izbriši zapis |
| `GET, PUT /nastavitve` | Podatki šole, trenutno leto, trajanje sej, nastavitve kopij in vpisov |
| `POST /kopije` | Dejanski SQL dump |
| `POST /arhiv` | Arhiviranje leta z `id_solsko_leto`, brez brisanja vsebine |
| `GET /izvoz` | JSON izvoz šolskih podatkov brez gesel, sej in žetonov |

Viri šifrantov so `predmeti`, `programi`, `leta`, `razredi`, `izvedbe`, `profesorji`, `dijaki`, `vpisi`. Pri sestavljenih ključih je ID sestavljen z `~`, npr. `/sifranti/profesorji/1~21`. Imena tabel in stolpcev določa zaprt seznam na strežniku; vrednosti so SQL parametri. Frontend pošilja polja obstoječih SQL tabel.

Vlogo obstoječega računa in predmet/razred obstoječe izvedbe ohranimo zaradi zgodovine; za drug namen se ustvari nov račun oziroma nova izvedba. Ključev povezav ni mogoče spreminjati. Dijak mora biti vpisan v razred svoje izvedbe. Brisanje povezanih zapisov vrne 409; za ohranitev zgodovine uporabimo onemogočanje, izpis ali arhiviranje. Administrator ne more onemogočiti sebe ali izbrisati zadnjega aktivnega administratorja.

## Meje obstoječega projekta

Prisotnost, starševski računi in merjenje razpoložljivosti strežnika niso del obstoječe baze, zato strani teh podatkov ne izmišljajo. Administratorska stran statistike in njen API sta odstranjena. Izbire obvestil se shranjujejo, pošiljanje e-pošte pa še ni nastavljeno. Koledar profesorja in administratorja hrani osebne dogodke v bazi. Dijakov obstoječi koledar in izbire obvestil ostajajo lokalni; naloge, oddaje in gradiva so povezani z bazo. Ni dodan nov sistem registracije ali ponastavljanja pozabljenega gesla.
