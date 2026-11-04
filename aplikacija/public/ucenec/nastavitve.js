async function pripraviNastavitve() {
    try {
        const uporabnik = await pridobiUporabnika();
        if (!uporabnik) return;
        nastaviBesedilo('#solski-email', uporabnik.email || 'Ni podatka');
        pripraviOkna();
        const stikala = [...document.querySelectorAll('[data-obvestilo]')];
        const sporocilo = document.querySelector('#racun-status');
        const id = uporabnik.id ?? uporabnik.id_uporabnik;
        const kljuc = id != null ? 'ucenec-obvestila-' + id : null;
        if (kljuc) {
            try {
                const izbire = JSON.parse(localStorage.getItem(kljuc) || '{}');
                if (izbire && typeof izbire === 'object' && !Array.isArray(izbire)) {
                    stikala.forEach(stikalo => {
                        if (typeof izbire[stikalo.dataset.obvestilo] === 'boolean') stikalo.checked = izbire[stikalo.dataset.obvestilo];
                    });
                }
            } catch {
                if (sporocilo) sporocilo.textContent = 'Lokalnih izbir obvestil ni mogoče prebrati.';
            }
        }
        stikala.forEach(stikalo => stikalo.addEventListener('change', () => {
            const izbire = {};
            stikala.forEach(stikalo => { izbire[stikalo.dataset.obvestilo] = stikalo.checked; });
            try {
                if (!kljuc) throw new Error();
                localStorage.setItem(kljuc, JSON.stringify(izbire));
                if (sporocilo) sporocilo.textContent = 'Izbire so shranjene v tem brskalniku. Pošiljanje obvestil še ni povezano.';
            } catch {
                if (sporocilo) sporocilo.textContent = 'Izbir ni mogoče shraniti. Veljajo samo do osvežitve strani.';
            }
        }));
    } catch (napaka) {
        prikaziNapako(napaka.message);
    }
}

pripraviNastavitve();
