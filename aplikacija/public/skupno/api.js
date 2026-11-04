const API = (() => {
    let seja;
    async function identiteta() {
        seja ||= fetch('/api/uporabnik', { credentials: 'same-origin' }).then(async odgovor => {
            if (odgovor.status === 401) { location.assign('/'); throw new Error('Prijavite se.'); }
            if (!odgovor.ok) throw new Error('Podatkov uporabnika ni mogoče prebrati.');
            return odgovor.json();
        }).catch(napaka => { seja = null; throw napaka; });
        return seja;
    }
    async function klic(pot, metoda = 'GET', podatki) {
        const moznosti = { method: metoda, credentials: 'same-origin', signal: AbortSignal.timeout(20000), headers: {} };
        if (metoda !== 'GET') {
            moznosti.headers['x-csrf-token'] = (await identiteta()).csrf;
            if (podatki instanceof FormData) moznosti.body = podatki;
            else if (podatki !== undefined) { moznosti.headers['Content-Type'] = 'application/json'; moznosti.body = JSON.stringify(podatki); }
        }
        const odgovor = await fetch(pot, moznosti);
        if (odgovor.status === 401) { location.assign('/'); throw new Error('Seja je potekla.'); }
        const rezultat = await odgovor.json();
        if (!odgovor.ok) throw new Error(rezultat.napaka || 'Zahteva ni uspela.');
        return rezultat;
    }
    function element(oznaka, besedilo, razred) {
        const nov = document.createElement(oznaka);
        if (besedilo !== undefined && besedilo !== null) nov.textContent = besedilo;
        if (razred) nov.className = razred;
        return nov;
    }
    function napaka(napaka) {
        const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);
        let polje = dialog ? dialog.querySelector('[data-api-napaka]') : document.getElementById('api-sporocilo');
        if (!polje) {
            polje = element('p', '', 'api-sporocilo');
            if(dialog)polje.dataset.apiNapaka='true';else polje.id = 'api-sporocilo';
            polje.setAttribute('role', 'alert'); (dialog || document.querySelector('main') || document.body).prepend(polje);
        }
        polje.textContent = napaka.message || String(napaka);
    }
    function gumb(naziv, dejanje, razred = 'btn gumb') {
        const nov = element('button', naziv, razred); nov.type = 'button';
        nov.addEventListener('click', async () => {
            nov.disabled = true;
            try { await dejanje(); } catch (n) { napaka(n); }
            finally { nov.disabled = false; }
        });
        return nov;
    }
    function okno(naslov) {
        const dialog = element('dialog', '', 'skupni-dialog');
        const glava = element('div', '', 'dialog-glava');
        glava.append(element('h2', naslov), gumb('Zapri', () => dialog.close()));
        dialog.append(glava);
        dialog.addEventListener('close', () => dialog.remove());
        document.body.append(dialog); dialog.showModal();
        return dialog;
    }
    function obrazec(naslov, polja, podatki, shrani) {
        const dialog = okno(naslov);
        const form = element('form');
        const napake = element('p'); napake.setAttribute('role', 'alert');
        for (const p of polja) {
            const label = element('label', p.naziv || p.ime.replaceAll('_', ' '));
            const vnos = element(p.moznosti ? 'select' : p.tip === 'textarea' ? 'textarea' : 'input');
            vnos.name = p.ime;
            if (p.moznosti) for (const [vrednost, naziv] of p.moznosti) { const moznost = element('option', naziv); moznost.value = vrednost; vnos.append(moznost); }
            else if (p.tip !== 'textarea') vnos.type = p.tip || 'text';
            vnos.required = Boolean(p.obvezno);
            vnos.disabled = Boolean(p.zaklenjeno);
            if (p.tip === 'checkbox') vnos.checked = Boolean(podatki[p.ime]);
            else vnos.value = podatki[p.ime] ?? p.privzeto ?? (p.moznosti ? p.moznosti[0]?.[0] ?? '' : '');
            if (p.max) vnos.maxLength = p.max;
            if (p.min !== undefined) vnos.min = p.min;
            if (p.najvec !== undefined) vnos.max = p.najvec;
            if (p.korak) vnos.step = p.korak;
            label.append(vnos); form.append(label);
        }
        const oddaj = element('button', 'Shrani', 'btn gumb btn-primary'); oddaj.type = 'submit';
        form.append(napake, oddaj);
        form.addEventListener('submit', async dogodek => {
            dogodek.preventDefault(); oddaj.disabled = true;
            const vrednosti = {};
            for (const vnos of form.querySelectorAll('[name]')) vrednosti[vnos.name] = vnos.type === 'checkbox' ? vnos.checked : vnos.value;
            try { await shrani(vrednosti); dialog.close(); }
            catch (n) { napake.textContent = n.message; }
            finally { oddaj.disabled = false; }
        });
        dialog.append(form); return dialog;
    }
    return { identiteta, klic, element, napaka, gumb, okno, obrazec };
})();
