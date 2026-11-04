async function naloziDashboard() {
    const uporabnik = preberiUporabnika();
    if (!uporabnik || !uporabnik.email) return;

    try {
        const d = await Dashboard.preberi(uporabnik.email);
        const stDogodkov = d.dogodki_danes.length;

        nastaviBesedilo("opis-dashboard",
            `Danes imate ${stDogodkov} ${sklanjaj(stDogodkov, ["dogodek", "dogodka", "dogodke", "dogodkov"])} in ${d.za_pregled} ${sklanjaj(d.za_pregled, ["nalogo", "nalogi", "naloge", "nalog"])} za pregled.`);

        const seznam = document.getElementById("dogodki-danes");
        if (seznam) {
            seznam.innerHTML = "";
            if (stDogodkov === 0) prikaziPrazno(seznam, "Danes nimate dogodkov v koledarju.");
            d.dogodki_danes.forEach(dogodek => {
                seznam.appendChild(ustvariVrstico(
                    dogodek.barva,
                    dogodek.naslov,
                    dogodek.naziv || "Brez predmeta",
                    dogodek.sifra || "Dogodek"
                ));
            });
        }

        if (d.rok) {
            nastaviBesedilo("rok-predmet", `${d.rok.oznaka} · ${d.rok.razred}`);
            nastaviBesedilo("rok-datum", `${d.rok.naslov} · ${oblikujDatum(d.rok.rok)} · še ${d.rok.dni} ${sklanjaj(d.rok.dni, ["dan", "dneva", "dni", "dni"])}`);
            const crta = document.getElementById("rok-crta");
            if (crta) crta.style.width = Math.min(100, Math.max(5, 100 - d.rok.dni * 100 / 30)) + "%";
        } else {
            nastaviBesedilo("rok-predmet", "Ni rokov");
            nastaviBesedilo("rok-datum", "/");
        }

        nastaviObroc(d.teden_oddano, d.teden_pregledano);
        prikaziPredmete(d.predmeti);
    } catch (napaka) {
        console.error(napaka);
    }
}

document.addEventListener("DOMContentLoaded", naloziDashboard);
