async function naloziNaloge() {
    const uporabnik = preberiUporabnika();
    if (!uporabnik || !uporabnik.email) return;

    try {
        const d = await Naloge.preberi(uporabnik.email);

        nastaviBesedilo("opis-naloge", `Nalog za pregled: ${d.za_pregled}.`);
        nastaviBesedilo("naloge-stevilo", d.za_pregled);
        nastaviObroc(d.teden_oddano, d.teden_pregledano);

        const seznam = document.getElementById("naloge-seznam");
        seznam.innerHTML = "";
        if (d.naloge.length === 0) prikaziPrazno(seznam, "Ni nalog za pregled.");
        d.naloge.forEach(naloga => {
            seznam.appendChild(ustvariVrstico(
                naloga.barva,
                naloga.naziv,
                `${naloga.oznaka} · ${naloga.razred} · ${naloga.za_pregled} za pregled`,
                "Rok: " + oblikujDatum(naloga.rok)
            ));
        });
    } catch (napaka) {
        console.error(napaka);
    }
}

document.addEventListener("DOMContentLoaded", naloziNaloge);