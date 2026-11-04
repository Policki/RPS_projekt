async function pripraviNaloge() {
    const seznam = document.querySelector('#seznam-nalog');
    const razvrsti = document.querySelector('#razvrsti');
    const okno = document.querySelector('.naloga-podrobnosti');
    const skupine = [...document.querySelectorAll('.naloge-skupina')];
    const filtri = [...document.querySelectorAll('[data-filter]')];
    if (!seznam) return;
    seznam.hidden = true;
    try {
        const uporabnik = await pridobiUporabnika();
        if (!uporabnik) return;
        const predmeti = await pridobiPredmete();
        if (!predmeti) return;
        const izbran = izbranaIzvedba(predmeti);
        const naloge = [...seznam.querySelectorAll('.naloga')];
        let izbraniFilter = 'vse';
        const primerjava = new Intl.Collator('sl');
        const dovoljeni = izbran ? [izbran] : predmeti;
        const predmetNaloge = naloga => dovoljeni.find(predmet => normaliziraj(predmet.naziv) === normaliziraj(naloga.dataset.predmet));
        naloge.forEach(naloga => {
            const predmet = predmetNaloge(naloga);
            if (predmet) naloga.style.setProperty('--barva', barvaPredmeta(predmet));
        });
        nastaviBesedilo('.naloge-glava p', izbran ? 'Vzorčni prikaz nalog: ' + izbran.naziv : 'Vzorčni prikaz nalog. Dejanske naloge še niso povezane.');
        nastaviBesedilo('#stevilo-odprtih', naloge.filter(naloga => predmetNaloge(naloga) && naloga.dataset.status === 'odprte').length);
        nastaviBesedilo('#stevilo-oddanih', naloge.filter(naloga => predmetNaloge(naloga) && naloga.dataset.status === 'oddane').length);
        const prazno = document.querySelector('#naloge-prazno');
        function prikaziNaloge() {
            let stevilo = 0;
            skupine.forEach(skupina => {
                const vrstice = skupina.querySelector('.naloge-seznam');
                if (!vrstice) return;
                const urejene = [...vrstice.querySelectorAll('.naloga')];
                urejene.sort((prva, druga) => {
                    if (razvrsti?.value === 'naslov') return primerjava.compare(prva.querySelector('h3')?.textContent || '', druga.querySelector('h3')?.textContent || '');
                    if (razvrsti?.value === 'predmet') return primerjava.compare(prva.dataset.predmet, druga.dataset.predmet);
                    const smer = prva.dataset.status === 'oddane' ? -1 : 1;
                    return smer * String(prva.dataset.rok || '').localeCompare(druga.dataset.rok || '');
                });
                let steviloSkupine = 0;
                urejene.forEach(naloga => {
                    const ustreza = izbraniFilter === 'vse' || naloga.dataset.status === izbraniFilter
                        || (izbraniFilter === 'kmalu' && naloga.dataset.kmalu === 'true');
                    naloga.hidden = !predmetNaloge(naloga) || !ustreza;
                    if (!naloga.hidden) steviloSkupine++;
                    vrstice.append(naloga);
                });
                skupina.hidden = steviloSkupine === 0;
                const oznaka = skupina.querySelector('.stevilo');
                if (oznaka) oznaka.textContent = steviloSkupine;
                stevilo += steviloSkupine;
            });
            if (prazno) prazno.hidden = stevilo !== 0;
            nastaviBesedilo('#rezultati-filtra', 'Število prikazanih vzorčnih nalog: ' + stevilo + '.');
        }
        filtri.forEach(gumb => gumb.addEventListener('click', () => {
            izbraniFilter = gumb.dataset.filter;
            filtri.forEach(filter => {
                const aktiven = filter === gumb;
                filter.classList.toggle('active', aktiven);
                filter.setAttribute('aria-pressed', String(aktiven));
            });
            prikaziNaloge();
        }));
        if (razvrsti) razvrsti.addEventListener('change', prikaziNaloge);
        pripraviOkna();
        seznam.addEventListener('click', dogodek => {
            const gumb = dogodek.target.closest('[data-odpri]');
            const naloga = gumb?.closest('.naloga');
            if (!naloga || !okno || naloga.hidden) return;
            const predmet = predmetNaloge(naloga);
            if (!predmet) return;
            nastaviBesedilo('#podrobnosti-naslov', naloga.querySelector('h3')?.textContent || 'Naloga');
            nastaviBesedilo('#podrobnosti-predmet', predmet.naziv);
            nastaviBesedilo('#podrobnosti-opis', naloga.querySelector('.naloga-opis')?.textContent || '');
            const oddana = naloga.dataset.status === 'oddane';
            nastaviBesedilo('#podrobnosti-rok', (oddana ? 'Oddano: ' : 'Rok oddaje: ') + (naloga.querySelector('time')?.textContent || 'Ni podatka'));
            const povezava = document.querySelector('#podrobnosti-povezava');
            if (povezava) povezava.href = povezavaPredmeta(predmet);
            okno.showModal();
        });
        seznam.hidden = false;
        prikaziNaloge();
    } catch (napaka) {
        prikaziNapako(napaka.message);
    }
}

pripraviNaloge();
