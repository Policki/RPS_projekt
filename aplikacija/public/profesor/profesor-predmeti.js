async function naloziPredmete() {
    const uporabnik = preberiUporabnika();
    if (!uporabnik || !uporabnik.email) return;

    try {
        const d = await Predmeti.preberi(uporabnik.email);
        const n = d.predmeti.length;
        const m = d.st_razredov;

        nastaviBesedilo("opis-predmeti",
            `Poučujete ${n} ${sklanjaj(n, ["predmet", "predmeta", "predmete", "predmetov"])} (${m} ${sklanjaj(m, ["razred", "razreda", "razrede", "razredov"])}).`);
        prikaziPredmete(d.predmeti);
    } catch (napaka) {
        console.error(napaka);
    }
}

document.addEventListener("DOMContentLoaded", naloziPredmete);
