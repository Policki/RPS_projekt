function prikaziPredmete(predmeti) {
    const seznam = document.querySelector('.predmeti-mreza');
    if (!seznam) return;
    const vzorci = [...seznam.querySelectorAll('.predmet-kartica')];
    seznam.replaceChildren();
    if (!predmeti.length) {
        seznam.append(ustvariElement('p', 'header-text', 'Trenutno še nimaš vpisanih predmetov.'));
        return;
    }
    predmeti.slice(0, 4).forEach(predmet => {
        const vzorec = vzorci.find(kartica => normaliziraj(kartica.querySelector('h3')?.textContent) === normaliziraj(predmet.naziv)) || vzorci[0];
        if (!vzorec) return;
        const kartica = vzorec.cloneNode(true);
        if (normaliziraj(vzorec.querySelector('h3')?.textContent) !== normaliziraj(predmet.naziv)) {
            const ikona = kartica.querySelector('.predmet-ikona');
            if (ikona) ikona.textContent = (predmet.sifra || '?').slice(0, 3);
        }
        kartica.style.setProperty('--predmet-barva', barvaPredmeta(predmet));
        kartica.querySelector('h3').textContent = predmet.naziv;
        kartica.querySelector('.predmet-vrh p').textContent = predmet.sifra || '';
        kartica.querySelector('.predmet-podatki').textContent = 'Gradiva in naloge';
        kartica.querySelector('.predmet-naslednje').textContent = predmet.opis || 'Odpri pregled predmeta.';
        poveziKartico(kartica, povezavaPredmeta(predmet));
        seznam.append(kartica);
    });
}

async function pripraviNadzornoPlosco() {
    const seznam = document.querySelector('.predmeti-mreza');
    if (seznam) seznam.hidden = true;
    try {
        const uporabnik = await pridobiUporabnika();
        if (!uporabnik) return;
        const ura = new Date().getHours();
        nastaviBesedilo('.header-title', ura < 10 ? 'Dobro jutro,' : ura < 18 ? 'Dober dan,' : 'Dober večer,');
        nastaviBesedilo('.header-name', (uporabnik.ime || uporabnik.uporabnisko_ime || 'Dijak') + '!');
        const predmeti = await pridobiPredmete();
        if (!predmeti) return;
        prikaziPredmete(predmeti);
        if (seznam) seznam.hidden = false;
        nastaviBesedilo('.header-text', 'Dobrodošel v pregledu svojega šolskega dela.');
    } catch (napaka) {
        if (seznam) seznam.replaceChildren();
        nastaviBesedilo('.header-text', 'Pregled trenutno ni na voljo.');
        prikaziNapako(napaka.message);
    }
}

for (const [izbirnik, pot] of [['.oddaja', 'naloge'], ['.nova-gradiva', 'gradiva'], ['.prihajajoci-roki', 'koledar']]) {
    const kartica = document.querySelector(izbirnik);
    if (kartica) poveziKartico(kartica, pot === 'koledar' ? '/ucenec/usenec-koledar.html' : '/ucenec/ucenec-' + pot + '.html');
}

pripraviNadzornoPlosco();
