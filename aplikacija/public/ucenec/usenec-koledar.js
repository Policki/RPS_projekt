const naslovMeseca = document.querySelector('#month-year');
const dneviKoledarja = document.querySelector('#calendar-days');
const prejsnjiMesec = document.querySelector('#prev-month');
const naslednjiMesec = document.querySelector('#next-month');
const obrazecDogodka = document.querySelector('#event-form');
const naslovDogodka = document.querySelector('#event-title');
const datumDogodka = document.querySelector('#event-date');
const predmetDogodka = document.querySelector('#event-category');
const naslovSeznama = document.querySelector('#selected-date-title');
const seznamDogodkov = document.querySelector('#event-list');
const meseci = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'];
let trenutniMesec = new Date();
let izbraniDatum = kljucDatuma(trenutniMesec);
let dogodki = [];
let predmeti = [];
let kljucShrambe = null;
let pripravljen = false;

function kljucDatuma(datum) {
    return datum.getFullYear() + '-' + String(datum.getMonth() + 1).padStart(2, '0') + '-' + String(datum.getDate()).padStart(2, '0');
}

function veljavenDatum(datum) {
    if (typeof datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return false;
    const deli = datum.split('-').map(Number);
    return kljucDatuma(new Date(deli[0], deli[1] - 1, deli[2])) === datum;
}

function prikaziSporocilo(besedilo) {
    nastaviBesedilo('#koledar-status', besedilo);
}

function shraniDogodke() {
    try {
        if (!kljucShrambe) throw new Error();
        localStorage.setItem(kljucShrambe, JSON.stringify(dogodki));
        prikaziSporocilo('Dogodki so shranjeni v tem brskalniku.');
    } catch {
        prikaziSporocilo('Dogodkov ni mogoče shraniti. Spremembe veljajo do osvežitve strani.');
    }
}

function dogodkiNaDan(datum) {
    return dogodki.filter(dogodek => dogodek.datum === datum);
}

function barvaDogodka(dogodek) {
    const predmet = predmeti.find(predmet => String(predmet.id_predmet) === dogodek.predmet);
    return predmet ? barvaPredmeta(predmet) : '#9d8d62';
}

function prikaziIzbraniDan() {
    if (!seznamDogodkov) return;
    const deli = izbraniDatum.split('-').map(Number);
    if (naslovSeznama) naslovSeznama.textContent = 'Dogodki · ' + deli[2] + '. ' + meseci[deli[1] - 1] + ' ' + deli[0];
    seznamDogodkov.replaceChildren();
    const dnevniDogodki = dogodkiNaDan(izbraniDatum);
    if (!dnevniDogodki.length) {
        seznamDogodkov.append(ustvariElement('li', 'empty-events', 'Za ta dan še ni dogodkov.'));
        return;
    }
    dnevniDogodki.forEach(dogodek => {
        const vrstica = ustvariElement('li', '', '');
        const pika = ustvariElement('span', 'event-color-dot', '');
        pika.style.backgroundColor = barvaDogodka(dogodek);
        const naslov = ustvariElement('span', 'event-list-title', dogodek.naslov);
        const odstrani = ustvariElement('button', 'remove-event', '×');
        odstrani.type = 'button';
        odstrani.setAttribute('aria-label', 'Odstrani dogodek ' + dogodek.naslov);
        odstrani.addEventListener('click', () => {
            dogodki = dogodki.filter(shranjeni => shranjeni.id !== dogodek.id);
            shraniDogodke();
            prikaziKoledar();
            prikaziIzbraniDan();
        });
        vrstica.append(pika, naslov, odstrani);
        seznamDogodkov.append(vrstica);
    });
}

function izberiDan(datum) {
    izbraniDatum = datum;
    if (datumDogodka) datumDogodka.value = datum;
    prikaziKoledar();
    prikaziIzbraniDan();
}

function prikaziKoledar() {
    if (!dneviKoledarja) return;
    const leto = trenutniMesec.getFullYear();
    const mesec = trenutniMesec.getMonth();
    if (naslovMeseca) naslovMeseca.textContent = meseci[mesec] + ' ' + leto;
    dneviKoledarja.replaceChildren();
    const zacetek = (new Date(leto, mesec, 1).getDay() + 6) % 7;
    const steviloDni = new Date(leto, mesec + 1, 0).getDate();
    const danes = kljucDatuma(new Date());
    for (let polje = 0; polje < 42; polje++) {
        const dan = polje - zacetek + 1;
        const gumb = ustvariElement('button', 'calendar-day', '');
        gumb.type = 'button';
        if (dan < 1 || dan > steviloDni) {
            gumb.classList.add('empty');
            gumb.disabled = true;
            gumb.setAttribute('aria-hidden', 'true');
        } else {
            const datum = kljucDatuma(new Date(leto, mesec, dan));
            const dnevniDogodki = dogodkiNaDan(datum);
            gumb.classList.toggle('today', datum === danes);
            gumb.classList.toggle('selected', datum === izbraniDatum);
            gumb.setAttribute('aria-pressed', String(datum === izbraniDatum));
            gumb.setAttribute('aria-label', dan + '. ' + meseci[mesec] + ' ' + leto + ', dogodkov: ' + dnevniDogodki.length);
            gumb.append(ustvariElement('span', 'day-number', dan));
            if (dnevniDogodki.length) {
                gumb.classList.add('has-events');
                gumb.style.setProperty('--event-color', barvaDogodka(dnevniDogodki[0]));
                const opisi = ustvariElement('span', 'day-events', '');
                dnevniDogodki.slice(0, 2).forEach(dogodek => opisi.append(ustvariElement('span', 'day-event-name', dogodek.naslov)));
                if (dnevniDogodki.length > 2) opisi.append(ustvariElement('span', 'day-event-more', '+' + (dnevniDogodki.length - 2) + ' več'));
                gumb.append(opisi);
            }
            gumb.addEventListener('click', () => izberiDan(datum));
        }
        dneviKoledarja.append(gumb);
    }
}

if (prejsnjiMesec) prejsnjiMesec.addEventListener('click', () => {
    trenutniMesec = new Date(trenutniMesec.getFullYear(), trenutniMesec.getMonth() - 1, 1);
    izberiDan(kljucDatuma(trenutniMesec));
});
if (naslednjiMesec) naslednjiMesec.addEventListener('click', () => {
    trenutniMesec = new Date(trenutniMesec.getFullYear(), trenutniMesec.getMonth() + 1, 1);
    izberiDan(kljucDatuma(trenutniMesec));
});
if (datumDogodka) datumDogodka.addEventListener('change', () => {
    if (!veljavenDatum(datumDogodka.value)) return;
    const deli = datumDogodka.value.split('-').map(Number);
    trenutniMesec = new Date(deli[0], deli[1] - 1, 1);
    izberiDan(datumDogodka.value);
});
if (obrazecDogodka) obrazecDogodka.addEventListener('submit', dogodek => {
    dogodek.preventDefault();
    if (!pripravljen || !naslovDogodka || !datumDogodka || !predmetDogodka) return;
    const naslov = naslovDogodka.value.trim();
    if (!naslov || naslov.length > 60 || !veljavenDatum(datumDogodka.value)) {
        prikaziSporocilo('Vnesi naslov dogodka in veljaven datum.');
        return;
    }
    const predmet = predmetDogodka.value;
    if (predmet && !predmeti.some(predmetIzbire => String(predmetIzbire.id_predmet) === predmet)) {
        prikaziSporocilo('Izberi predmet s seznama svojih predmetov.');
        return;
    }
    dogodki.push({ id: Date.now() + '-' + Math.random().toString(16).slice(2), naslov, datum: datumDogodka.value, predmet });
    shraniDogodke();
    izbraniDatum = datumDogodka.value;
    const deli = izbraniDatum.split('-').map(Number);
    trenutniMesec = new Date(deli[0], deli[1] - 1, 1);
    naslovDogodka.value = '';
    izberiDan(izbraniDatum);
    naslovDogodka.focus();
});

async function pripraviKoledar() {
    izberiDan(izbraniDatum);
    try {
        const uporabnik = await pridobiUporabnika();
        if (!uporabnik) return;
        const id = uporabnik.id ?? uporabnik.id_uporabnik;
        if (id != null) {
            kljucShrambe = 'ucenec-koledar-dogodki-' + id;
            try {
                const shranjeni = JSON.parse(localStorage.getItem(kljucShrambe) || '[]');
                if (Array.isArray(shranjeni)) dogodki = shranjeni.filter(dogodek => dogodek && typeof dogodek.id === 'string'
                    && typeof dogodek.naslov === 'string' && dogodek.naslov.trim() && dogodek.naslov.length <= 60
                    && typeof dogodek.predmet === 'string' && veljavenDatum(dogodek.datum));
            } catch {
                prikaziSporocilo('Lokalnih dogodkov ni mogoče prebrati.');
            }
        }
        pripravljen = true;
        prikaziKoledar();
        prikaziIzbraniDan();
        const pridobljeni = await pridobiPredmete();
        if (!pridobljeni) return;
        predmeti = pridobljeni;
        if (predmetDogodka) {
            const splosno = ustvariElement('option', '', 'Brez predmeta');
            splosno.value = '';
            predmetDogodka.replaceChildren(splosno);
            const dodani = [];
            predmeti.forEach(predmet => {
                const id = String(predmet.id_predmet);
                if (dodani.includes(id)) return;
                dodani.push(id);
                const moznost = ustvariElement('option', '', predmet.naziv);
                moznost.value = id;
                predmetDogodka.append(moznost);
            });
        }
        prikaziKoledar();
        prikaziIzbraniDan();
    } catch (napaka) {
        prikaziNapako(napaka.message);
    }
}

pripraviKoledar();
