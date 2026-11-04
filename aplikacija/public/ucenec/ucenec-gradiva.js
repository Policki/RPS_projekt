async function pripraviGradiva() {
    const mreza = document.querySelector('#seznam-gradiv');
    const iskanje = document.querySelector('#iskanje-gradiv');
    const razvrsti = document.querySelector('#razvrsti-gradiva');
    const filtri = document.querySelector('.gradiva-filtri');
    const prazno = document.querySelector('#gradiva-prazno');
    const okno = document.querySelector('.gradivo-podrobnosti');
    if (!mreza) return;
    mreza.hidden = true;
    try {
        const uporabnik = await pridobiUporabnika();
        if (!uporabnik) return;
        const predmeti = await pridobiPredmete();
        if (!predmeti) return;
        const izbran = izbranaIzvedba(predmeti);
        const kartice = [...mreza.querySelectorAll('.gradivo')];
        const primerjava = new Intl.Collator('sl');
        let izbraniPredmet = izbran ? oznakaPredmeta(izbran) : 'vsa';
        const predmetKartice = kartica => predmeti.find(predmet => oznakaPredmeta(predmet) === kartica.dataset.predmet);
        function prikaziGradiva() {
            const besede = normaliziraj(iskanje?.value.trim()).split(/\s+/).filter(Boolean);
            const urejene = [...kartice].sort((prva, druga) => {
                if (razvrsti?.value === 'naslov') return primerjava.compare(prva.querySelector('h2')?.textContent || '', druga.querySelector('h2')?.textContent || '');
                if (razvrsti?.value === 'predmet') return primerjava.compare(prva.querySelector('.gradivo-predmet')?.textContent || '', druga.querySelector('.gradivo-predmet')?.textContent || '');
                const smer = razvrsti?.value === 'najstarejsa' ? 1 : -1;
                return smer * String(prva.dataset.datum || '').localeCompare(druga.dataset.datum || '');
            });
            let stevilo = 0;
            urejene.forEach(kartica => {
                const predmet = predmetKartice(kartica);
                const besedilo = normaliziraj((kartica.querySelector('h2')?.textContent || '') + ' '
                    + (kartica.querySelector('.gradivo-predmet')?.textContent || '') + ' '
                    + (kartica.querySelector('.gradivo-format')?.textContent || ''));
                const ustreza = izbraniPredmet === 'vsa' || kartica.dataset.predmet === izbraniPredmet;
                kartica.hidden = !predmet || !ustreza || !besede.every(beseda => besedilo.includes(beseda));
                if (!kartica.hidden) stevilo++;
                if (predmet) kartica.style.setProperty('--barva', barvaPredmeta(predmet));
                mreza.append(kartica);
            });
            mreza.hidden = stevilo === 0;
            if (prazno) prazno.hidden = stevilo !== 0;
            nastaviBesedilo('#rezultati-gradiv', 'Število prikazanih vzorčnih gradiv: ' + stevilo + '.');
        }
        function oznaciFilter() {
            if (!filtri) return;
            filtri.querySelectorAll('[data-filter]').forEach(gumb => {
                const aktiven = gumb.dataset.filter === izbraniPredmet;
                gumb.classList.toggle('active', aktiven);
                gumb.setAttribute('aria-pressed', String(aktiven));
            });
        }
        if (filtri) {
            const gumbVsa = filtri.querySelector('[data-filter="vsa"]') || ustvariElement('button', 'filter', 'Vsa gradiva');
            gumbVsa.type = 'button';
            gumbVsa.dataset.filter = 'vsa';
            filtri.replaceChildren(gumbVsa);
            const dodane = [];
            predmeti.forEach(predmet => {
                const oznaka = oznakaPredmeta(predmet);
                if (dodane.includes(oznaka)) return;
                dodane.push(oznaka);
                const gumb = ustvariElement('button', 'filter', '');
                gumb.type = 'button';
                gumb.dataset.filter = oznaka;
                gumb.style.setProperty('--barva', barvaPredmeta(predmet));
                const pika = ustvariElement('span', '', '');
                pika.setAttribute('aria-hidden', 'true');
                gumb.append(pika, document.createTextNode(predmet.naziv));
                filtri.append(gumb);
            });
            filtri.addEventListener('click', dogodek => {
                const gumb = dogodek.target.closest('[data-filter]');
                if (!gumb || !filtri.contains(gumb)) return;
                izbraniPredmet = gumb.dataset.filter;
                oznaciFilter();
                prikaziGradiva();
            });
        }
        nastaviBesedilo('#gradiva-povzetek', 'Vzorčni prikaz gradiv. Dejanska gradiva še niso povezana.');
        if (iskanje) iskanje.addEventListener('input', prikaziGradiva);
        if (razvrsti) razvrsti.addEventListener('change', prikaziGradiva);
        const ponastavi = document.querySelector('#ponastavi-gradiva');
        if (ponastavi) ponastavi.addEventListener('click', () => {
            if (iskanje) iskanje.value = '';
            izbraniPredmet = 'vsa';
            oznaciFilter();
            prikaziGradiva();
            if (iskanje) iskanje.focus();
        });
        pripraviOkna();
        mreza.addEventListener('click', dogodek => {
            const gumb = dogodek.target.closest('[data-podrobnosti]');
            const kartica = gumb?.closest('.gradivo');
            if (!kartica || !okno || kartica.hidden) return;
            const predmet = predmetKartice(kartica);
            if (!predmet) return;
            nastaviBesedilo('#podrobnosti-naslov', kartica.querySelector('h2')?.textContent || 'Gradivo');
            nastaviBesedilo('#podrobnosti-predmet', predmet.naziv);
            nastaviBesedilo('#podrobnosti-format', kartica.querySelector('.gradivo-format')?.textContent || '');
            const povezava = document.querySelector('#podrobnosti-povezava');
            if (povezava) povezava.href = povezavaPredmeta(predmet);
            okno.showModal();
        });
        oznaciFilter();
        prikaziGradiva();
    } catch (napaka) {
        prikaziNapako(napaka.message);
    }
}

pripraviGradiva();
