async function naloziGradiva() {
    const uporabnik = preberiUporabnika();
    if (!uporabnik || !uporabnik.email) return;

    try {
        const gradiva = await Gradiva.preberi(uporabnik.email);
        const seznam = document.getElementById("gradiva-seznam");
        seznam.innerHTML = "";
        if (gradiva.length === 0) prikaziPrazno(seznam, "Gradiv še ni.");

        gradiva.forEach(gradivo => {
            const vrstica = ustvariVrstico(gradivo.barva, gradivo.naziv, `${gradivo.oznaka} · ${gradivo.razred}`, gradivo.tip);
            vrstica.style.cursor = "pointer";
            vrstica.addEventListener("click", () => {
                if (!gradivo.url) {
                    window.open(Gradiva.naslovDatoteke(uporabnik.email, gradivo.id), "_blank", "noopener");
                } else if (/^https?:\/\//i.test(gradivo.url)) {
                    window.open(gradivo.url, "_blank", "noopener");
                }
            });
            seznam.appendChild(vrstica);
        });

        const izbira = document.getElementById("gradivo-predmet");
        if (izbira && izbira.options.length === 0) {
            const d = await Predmeti.preberi(uporabnik.email);
            d.predmeti.forEach(predmet => {
                const moznost = document.createElement("option");
                moznost.value = predmet.id;
                moznost.textContent = `${predmet.oznaka} · ${predmet.razred}`;
                izbira.appendChild(moznost);
            });
        }
    } catch (napaka) {
        console.error(napaka);
    }
}

function prikaziSporocilo(besedilo) {
    nastaviBesedilo("gradivo-sporocilo", besedilo);
    setTimeout(() => nastaviBesedilo("gradivo-sporocilo", ""), 3000);
}

async function dodajDatoteko(dogodek) {
    const uporabnik = preberiUporabnika();
    const datoteka = dogodek.target.files[0];
    const izvedbaId = document.getElementById("gradivo-predmet").value;
    if (!uporabnik || !datoteka) return;

    try {
        await Gradiva.dodajDatoteko(uporabnik.email, izvedbaId, datoteka);
        prikaziSporocilo("Gradivo dodano");
        naloziGradiva();
    } catch (napaka) {
        console.error(napaka);
        prikaziSporocilo(napaka.message);
    }
    dogodek.target.value = "";
}

async function dodajPovezavo() {
    const uporabnik = preberiUporabnika();
    const izvedbaId = document.getElementById("gradivo-predmet").value;
    if (!uporabnik) return;

    const url = prompt("Vnesite povezavo (https://...)");
    if (!url) return;
    const naziv = prompt("Naziv gradiva (neobvezno)") || "";

    try {
        await Gradiva.dodajPovezavo(uporabnik.email, izvedbaId, naziv, url);
        prikaziSporocilo("Povezava dodana");
        naloziGradiva();
    } catch (napaka) {
        console.error(napaka);
        prikaziSporocilo(napaka.message);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    naloziGradiva();

    const vnosDatoteke = document.getElementById("gradivo-datoteka");
    document.getElementById("btnNaloziDatoteko").addEventListener("click", () => vnosDatoteke.click());
    vnosDatoteke.addEventListener("change", dodajDatoteko);
    document.getElementById("btnDodajPovezavo").addEventListener("click", dodajPovezavo);
});