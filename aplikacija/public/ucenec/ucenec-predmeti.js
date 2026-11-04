function prikaziPredmete(predmeti, izbran) {
    const seznam = document.querySelector('.predmeti');
    if (!seznam) return;
    const vzorci = [...seznam.querySelectorAll('.predmet')];
    seznam.replaceChildren();
    const prikazani = izbran ? [izbran] : predmeti;
    if (!prikazani.length) {
        seznam.append(ustvariElement('p', 'header-text', 'Trenutno še nimaš vpisanih predmetov.'));
        return;
    }
    prikazani.forEach(predmet => {
        const vzorec = vzorci.find(kartica => normaliziraj(kartica.querySelector('h3')?.textContent) === normaliziraj(predmet.naziv)) || vzorci[0];
        if (!vzorec) return;
        const kartica = vzorec.cloneNode(true);
        if (normaliziraj(vzorec.querySelector('h3')?.textContent) !== normaliziraj(predmet.naziv)) {
            const ikona = kartica.querySelector('.predmet-ikona');
            if (ikona) ikona.textContent = (predmet.sifra || '?').slice(0, 3);
        }
        kartica.style.setProperty('--barva', barvaPredmeta(predmet));
        kartica.querySelector('h3').textContent = predmet.naziv;
        kartica.querySelector('.predmet-glava p').textContent = predmet.sifra || '';
        kartica.querySelector('.predmet-status').textContent = 'Vpisan';
        kartica.querySelectorAll('.predmet-statistika strong').forEach(stevilo => { stevilo.textContent = '—'; });
        kartica.querySelector('.predmet-rok').textContent = predmet.opis || 'Podatki o nalogah in gradivih še niso na voljo.';
        const povezava = kartica.querySelector('.predmet-odpri');
        povezava.href = izbran ? '/ucenec/ucenec-predmeti.html' : povezavaPredmeta(predmet);
        if (izbran) povezava.textContent = 'Vsi predmeti →';
        seznam.append(kartica);
    });
}

async function pripraviPredmete() {
    const seznam = document.querySelector('.predmeti');
    if (seznam) seznam.hidden = true;
    try {
        const uporabnik = await pridobiUporabnika();
        if (!uporabnik) return;
        const predmeti = await pridobiPredmete();
        if (!predmeti) return;
        const izbran = izbranaIzvedba(predmeti);
        prikaziPredmete(predmeti, izbran);
        if (seznam) seznam.hidden = false;
        nastaviBesedilo('.header-title', izbran ? izbran.naziv : 'Moji predmeti');
        nastaviBesedilo('.header-text', izbran ? izbran.opis || 'Pregled izbranega predmeta.' : 'Predmeti, v katere si trenutno vpisan.');
    } catch (napaka) {
        if (seznam) seznam.replaceChildren();
        nastaviBesedilo('.header-text', 'Predmetov trenutno ni mogoče prikazati.');
        prikaziNapako(napaka.message);
    }
}

pripraviPredmete();
