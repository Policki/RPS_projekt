async function pripraviProfil() {
    try {
        const uporabnik = await pridobiUporabnika();
        if (!uporabnik) return;
        const ime = [uporabnik.ime, uporabnik.priimek].filter(Boolean).join(' ') || uporabnik.uporabnisko_ime || 'Moj profil';
        nastaviBesedilo('#profil-ime', ime);
        nastaviBesedilo('#profil-polno-ime', ime);
        nastaviBesedilo('.profil-avatar', [uporabnik.ime, uporabnik.priimek].filter(Boolean).map(del => del[0]).join('') || 'D');
        const razred = typeof uporabnik.razred === 'string' ? uporabnik.razred : 'Ni podatka';
        const razrednik = typeof uporabnik.razrednik === 'string' ? uporabnik.razrednik : 'Ni podatka';
        nastaviBesedilo('#profil-razred', razred);
        nastaviBesedilo('.profil-razred', razred);
        nastaviBesedilo('#profil-razrednik', razrednik);
        nastaviBesedilo('#pomoc-razrednik', razrednik);
        const telefon = typeof uporabnik.telefon === 'string' ? uporabnik.telefon : '';
        nastaviBesedilo('#profil-telefon', telefon || 'Ni podatka');
        const email = document.querySelector('#profil-email');
        if (email) {
            email.textContent = uporabnik.email || 'Ni podatka';
            if (uporabnik.email) email.href = 'mailto:' + encodeURIComponent(uporabnik.email);
            else email.removeAttribute('href');
        }
        pripraviOkna();
        const obrazec = document.querySelector('#telefon-obrazec');
        const vnos = document.querySelector('#telefon-nov');
        const napaka = document.querySelector('#telefon-napaka');
        const gumb = document.querySelector('[data-odpri-dialog="telefon-dialog"]');
        if (gumb && vnos) gumb.addEventListener('click', () => {
            vnos.value = telefon;
            if (napaka) napaka.textContent = '';
            vnos.removeAttribute('aria-invalid');
            vnos.focus();
        });
        if (vnos) vnos.addEventListener('input', () => {
            if (napaka) napaka.textContent = '';
            vnos.removeAttribute('aria-invalid');
        });
        if (obrazec && vnos && napaka) obrazec.addEventListener('submit', dogodek => {
            dogodek.preventDefault();
            const vrednost = vnos.value.trim();
            const stevke = vrednost.replace(/\D/g, '');
            if (!/^\+?[\d\s()-]+$/.test(vrednost) || stevke.length < 7 || stevke.length > 15) {
                napaka.textContent = 'Vnesi veljavno telefonsko številko s 7–15 števkami.';
                vnos.setAttribute('aria-invalid', 'true');
                vnos.focus();
                return;
            }
            napaka.textContent = 'Shranjevanje telefonske številke trenutno še ni omogočeno.';
        });
    } catch (napaka) {
        nastaviBesedilo('#profil-polno-ime', 'Ni podatka');
        prikaziNapako(napaka.message);
    }
}

pripraviProfil();
