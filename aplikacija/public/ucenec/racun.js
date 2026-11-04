async function preberiApi(pot, sporocilo) {
    const krmilnik = new AbortController();
    const casovnik = setTimeout(() => krmilnik.abort(), 10000);
    try {
        const odgovor = await fetch(pot, { credentials: 'same-origin', signal: krmilnik.signal });
        if (odgovor.status === 401) {
            window.location.href = '/';
            return null;
        }
        if (odgovor.status === 403) {
            prikaziZavrnitev();
            return null;
        }
        if (!odgovor.ok) throw new Error(sporocilo);
        return await odgovor.json();
    } catch {
        throw new Error(sporocilo);
    } finally {
        clearTimeout(casovnik);
    }
}

async function pridobiUporabnika() {
    const podatki = await preberiApi('/api/uporabnik', 'Podatkov uporabnika ni mogoče pridobiti. Poskusi znova pozneje.');
    if (!podatki) return null;
    const uporabnik = podatki.uporabnik;
    if (!uporabnik || typeof uporabnik !== 'object' || Array.isArray(uporabnik)) {
        throw new Error('Podatki uporabnika niso v pravilni obliki.');
    }
    if (uporabnik.vloga !== 'dijak') {
        prikaziZavrnitev();
        return null;
    }
    return uporabnik;
}

async function pridobiPredmete() {
    const predmeti = await preberiApi('/api/moji-predmeti', 'Predmetov ni mogoče pridobiti. Poskusi znova pozneje.');
    if (!predmeti) return null;
    if (!Array.isArray(predmeti) || !predmeti.every(predmet => predmet && typeof predmet.naziv === 'string'
        && predmet.naziv.trim() && predmet.id_predmet != null && predmet.id_izvedba != null)) {
        throw new Error('Podatki predmetov niso v pravilni obliki.');
    }
    return predmeti;
}

function ustvariElement(oznaka, razred, besedilo) {
    const element = document.createElement(oznaka);
    if (razred) element.className = razred;
    if (besedilo != null) element.textContent = besedilo;
    return element;
}

function nastaviBesedilo(izbirnik, besedilo) {
    const element = document.querySelector(izbirnik);
    if (element) element.textContent = besedilo;
}

function prikaziNapako(sporocilo) {
    const vsebina = document.querySelector('main');
    if (!vsebina) return;
    let obvestilo = document.querySelector('#napaka-strani');
    if (!obvestilo) {
        obvestilo = ustvariElement('p', 'header-text', '');
        obvestilo.id = 'napaka-strani';
        obvestilo.setAttribute('role', 'alert');
        vsebina.prepend(obvestilo);
    }
    obvestilo.textContent = sporocilo;
}

function prikaziZavrnitev() {
    document.querySelectorAll('dialog[open]').forEach(okno => okno.close());
    document.querySelectorAll('button, input, select, textarea').forEach(element => { element.disabled = true; });
    const vsebina = document.querySelector('main');
    if (vsebina) vsebina.replaceChildren();
    prikaziNapako('Za ogled te strani nimaš dovoljenja. Prijavi se z računom dijaka.');
}

function normaliziraj(besedilo) {
    return String(besedilo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sl');
}

function oznakaPredmeta(predmet) {
    return normaliziraj(predmet.naziv).replace(/[^a-z0-9]/g, '');
}

function barvaPredmeta(predmet) {
    return /^#[0-9a-f]{6}$/i.test(predmet.barva || '') ? predmet.barva : '#7b9058';
}

function povezavaPredmeta(predmet) {
    const oznaka = oznakaPredmeta(predmet);
    const strani = ['matematika', 'informatika', 'fizika', 'slovenscina', 'anglescina', 'zgodovina'];
    const pot = strani.includes(oznaka) ? '/ucenec/predmeti/' + oznaka + '.html' : '/ucenec/ucenec-predmeti.html';
    return pot + '?id_izvedba=' + encodeURIComponent(predmet.id_izvedba);
}

function izbranaIzvedba(predmeti) {
    const oznaka = new URLSearchParams(window.location.search).get('id_izvedba');
    if (!oznaka) return null;
    const predmet = predmeti.find(predmet => String(predmet.id_izvedba) === oznaka);
    if (!predmet) throw new Error('Izbrani predmet ni med tvojimi predmeti.');
    return predmet;
}

function pripraviOkna() {
    document.querySelectorAll('[data-odpri-dialog]').forEach(gumb => {
        gumb.addEventListener('click', () => {
            const okno = document.getElementById(gumb.dataset.odpriDialog);
            if (okno && !okno.open) okno.showModal();
        });
    });
    document.querySelectorAll('[data-zapri-dialog]').forEach(gumb => {
        gumb.addEventListener('click', () => {
            const okno = gumb.closest('dialog');
            if (okno) okno.close();
        });
    });
    document.querySelectorAll('dialog').forEach(okno => {
        okno.addEventListener('click', dogodek => {
            const rob = okno.getBoundingClientRect();
            if (dogodek.target === okno && (dogodek.clientX < rob.left || dogodek.clientX > rob.right
                || dogodek.clientY < rob.top || dogodek.clientY > rob.bottom)) okno.close();
        });
    });
}

function poveziKartico(kartica, povezava) {
    kartica.tabIndex = 0;
    kartica.setAttribute('role', 'link');
    kartica.addEventListener('click', () => { window.location.href = povezava; });
    kartica.addEventListener('keydown', dogodek => {
        if (dogodek.key === 'Enter') window.location.href = povezava;
    });
}

async function pripraviPredmet(naziv) {
    try {
        const uporabnik = await pridobiUporabnika();
        if (!uporabnik) return;
        const predmeti = await pridobiPredmete();
        if (!predmeti) return;
        const izbran = izbranaIzvedba(predmeti);
        const predmet = izbran || predmeti.find(predmet => normaliziraj(predmet.naziv) === normaliziraj(naziv));
        if (!predmet || normaliziraj(predmet.naziv) !== normaliziraj(naziv)) {
            throw new Error('Ta predmet ni med tvojimi predmeti.');
        }
        nastaviBesedilo('#naslov-predmeta', predmet.naziv);
        nastaviBesedilo('#opis-predmeta', predmet.opis || 'Opis predmeta še ni na voljo.');
        nastaviBesedilo('#sifra-predmeta', predmet.sifra || '');
        document.title = predmet.naziv + ' | Moji predmeti';
        for (const vrsta of ['naloge', 'gradiva']) {
            const povezava = document.querySelector('#predmet-' + vrsta);
            if (povezava) povezava.href = '/ucenec/ucenec-' + vrsta + '.html?id_izvedba=' + encodeURIComponent(predmet.id_izvedba);
        }
        const povezave = document.querySelector('#povezave-predmeta');
        if (povezave) povezave.hidden = false;
    } catch (napaka) {
        nastaviBesedilo('#opis-predmeta', 'Podatki predmeta trenutno niso na voljo.');
        prikaziNapako(napaka.message);
    }
}
