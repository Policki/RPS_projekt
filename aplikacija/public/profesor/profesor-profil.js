function posodobiShranjenegaUporabnika(novaEposta) {
    [sessionStorage, localStorage].forEach(shramba => {
        const shranjeno = shramba.getItem("prijavljenUporabnik");
        if (!shranjeno) return;
        try {
            const uporabnik = JSON.parse(shranjeno);
            uporabnik.email = novaEposta;
            shramba.setItem("prijavljenUporabnik", JSON.stringify(uporabnik));
        } catch (napaka) {
            console.error(napaka);
        }
    });
}



async function naloziProfilIzBaze() {
    const uporabnik = preberiUporabnika();
    if (!uporabnik || !uporabnik.email) return;

    try {
        const vrstica = await Profil.preberi(uporabnik.email);
        if (!vrstica) return;

        const s = DB_CONFIG.stolpci;
        nastaviIme(vrstica[s.ime]);
        nastaviVrednost("polje-eposta", vrstica[s.eposta] || uporabnik.email);
        nastaviVrednost("polje-telefon", vrstica[s.telefon] || "");
        nastaviVrednost("polje-predmeti", vrstica[s.predmeti] || "");
    } catch (napaka) {
        console.error(napaka);
    }
}

async function shraniProfil(dogodek) {
    dogodek.preventDefault();

    const uporabnik = preberiUporabnika();
    const gumb = dogodek.target.querySelector("button[type='submit']");
    const izvirnoBesedilo = gumb.textContent;

    if (!uporabnik || !uporabnik.email) {
        gumb.textContent = "Niste prijavljeni";
        setTimeout(() => { gumb.textContent = izvirnoBesedilo; }, 2500);
        return;
    }

    const podatki = {
        ime: document.getElementById("polje-ime").value.trim(),
        eposta: document.getElementById("polje-eposta").value.trim(),
        telefon: document.getElementById("polje-telefon").value.trim()
    };

    gumb.disabled = true;
    gumb.textContent = "Shranjujem...";

    try {
        await Profil.shrani(uporabnik.email, podatki);
        posodobiShranjenegaUporabnika(podatki.eposta);
        nastaviIme(podatki.ime);
        gumb.textContent = "Shranjeno";
    } catch (napaka) {
        console.error(napaka);
        gumb.textContent = "Napaka pri shranjevanju";
    }

    setTimeout(() => {
        gumb.textContent = izvirnoBesedilo;
        gumb.disabled = false;
    }, 2500);
}

async function naloziPovzetek() {
    const uporabnik = preberiUporabnika();
    if (!uporabnik || !uporabnik.email) return;

    try {
        const d = await Dashboard.preberi(uporabnik.email);
        nastaviBesedilo("povzetek-razredi", d.st_razredov);
        nastaviBesedilo("povzetek-naloge", d.za_pregled);
        nastaviBesedilo("povzetek-dogodki", d.dogodki_danes.length);
    } catch (napaka) {
        console.error(napaka);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    naloziProfilIzBaze();
    naloziPovzetek();
    document.getElementById("obrazec-profil").addEventListener("submit", shraniProfil);
});