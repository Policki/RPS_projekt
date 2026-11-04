// Skupne funkcije za vse strani profesorja

function preberiUporabnika() {
    const shranjeno = sessionStorage.getItem("prijavljenUporabnik") || localStorage.getItem("prijavljenUporabnik");
    if (!shranjeno) return null;
    try {
        return JSON.parse(shranjeno);
    } catch (napaka) {
        return null;
    }
}

const MESECI = [
    "januar", "februar", "marec", "april", "maj", "junij",
    "julij", "avgust", "september", "oktober", "november", "december"
];

function izracunajInicialke(polnoIme) {
    return polnoIme.split(" ").filter(Boolean).slice(0, 2).map(beseda => beseda[0].toUpperCase()).join("");
}

function sklanjaj(stevilo, oblike) {
    const ostanek = stevilo % 100;
    if (ostanek === 1) return oblike[0];
    if (ostanek === 2) return oblike[1];
    if (ostanek === 3 || ostanek === 4) return oblike[2];
    return oblike[3];
}

function oblikujDatum(datum) {
    if (!datum) return "/";
    const [leto, mesec, dan] = datum.split(" ")[0].split("-").map(Number);
    return `${dan}. ${MESECI[mesec - 1]} ${leto}`;
}

function oblikujUro(cas) {
    return cas.slice(0, 5).replace(/^0/, "");
}

// iz barve predmeta (#rrggbb) naredi svetlo ozadje vrstice
function svetlaBarva(hex) {
    const barva = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#cf704c";
    const kanali = [1, 3, 5].map(i => parseInt(barva.slice(i, i + 2), 16));
    return "rgb(" + kanali.map(k => Math.round(k + (255 - k) * 0.82)).join(",") + ")";
}

function ustvariVrstico(barva, naslov, podnaslov, oznaka) {
    const vrstica = document.createElement("div");
    const besedilo = document.createElement("div");
    const h3 = document.createElement("h3");
    const p = document.createElement("p");
    const pill = document.createElement("span");

    vrstica.className = "vrstica";
    vrstica.style.setProperty("--p", svetlaBarva(barva));
    h3.textContent = naslov;
    p.textContent = podnaslov;
    pill.className = "pill";
    pill.textContent = oznaka;

    besedilo.append(h3, p);
    vrstica.append(besedilo, pill);
    return vrstica;
}

function prikaziPrazno(kontejner, sporocilo) {
    kontejner.innerHTML = "";
    const p = document.createElement("p");
    p.className = "opomba";
    p.textContent = sporocilo;
    kontejner.appendChild(p);
}

function nastaviObroc(oddano, pregledano) {
    const krog = document.getElementById("obroc-krog");
    const deleznik = oddano > 0 ? pregledano / oddano : 0;
    if (krog) krog.setAttribute("stroke-dasharray", `${Math.round(deleznik * 176)} 176`);
    nastaviBesedilo("obroc-besedilo", `${pregledano}/${oddano} nalog pregledanih`);
}

function prikaziPredmete(predmeti) {
    const kontejner = document.getElementById("predmeti-seznam");
    if (!kontejner) return;

    const najvec = Number(kontejner.dataset.najvec) || predmeti.length;
    kontejner.innerHTML = "";

    predmeti.slice(0, najvec).forEach((predmet, i) => {
        const kartica = document.createElement("div");
        const odstotek = predmet.oddano > 0 ? Math.round(predmet.pregledano / predmet.oddano * 100) : 0;
        const stevilo = predmet.stevilo === null ? "/" : predmet.stevilo;

        kartica.className = "predmet" + ((i % 5) + 1);
        kartica.innerHTML = `
            <div class="top-line"></div>
            <div class="predmet-header">
                <div class="predmet-icon"></div>
                <div><h3></h3><p></p></div>
            </div>
            <div class="podatki"><p></p><strong></strong></div>
            <div class="progress"><div></div></div>`;

        kartica.querySelector("h3").textContent = predmet.razred;
        kartica.querySelector(".predmet-header p").textContent = predmet.oznaka;
        kartica.title = predmet.naziv;
        [".top-line", ".predmet-icon", ".progress div"].forEach(izbira => {
            if (predmet.barva) kartica.querySelector(izbira).style.backgroundColor = predmet.barva;
        });
        kartica.querySelector(".podatki p").textContent = `${stevilo} ${predmet.enota}`;
        kartica.querySelector(".podatki strong").textContent = "Rok oddaje: " + oblikujDatum(predmet.rok);
        kartica.querySelector(".progress div").style.width = odstotek + "%";
        kontejner.appendChild(kartica);
    });
}

function nastaviVrednost(id, vrednost) {
    const element = document.getElementById(id);
    if (element) element.value = vrednost;
}

function nastaviBesedilo(id, besedilo) {
    const element = document.getElementById(id);
    if (element) element.textContent = besedilo;
}

function nastaviIme(polnoIme) {
    if (!polnoIme) return;
    nastaviBesedilo("profil-ime", polnoIme);
    nastaviBesedilo("profil-avatar", izracunajInicialke(polnoIme));
    nastaviVrednost("polje-ime", polnoIme);
}

function prikaziUporabnika() {
    const uporabnik = preberiUporabnika();
    if (!uporabnik) return;

    const polnoIme = [uporabnik.ime, uporabnik.priimek].filter(Boolean).join(" ") || uporabnik.polnoIme || "";
    nastaviIme(polnoIme);

    if (uporabnik.email) nastaviVrednost("polje-eposta", uporabnik.email);
    if (uporabnik.telefon) nastaviVrednost("polje-telefon", uporabnik.telefon);
}

async function odjava() {
    try {
        await Odjava.izvedi();
    } catch (napaka) {
        console.error(napaka);
    }
    sessionStorage.removeItem("prijavljenUporabnik");
    localStorage.removeItem("prijavljenUporabnik");
    window.location.href = DB_CONFIG.prijava;
}

document.addEventListener("DOMContentLoaded", () => {
    // brez prijave stran ni dostopna
    if (!preberiUporabnika()) {
        window.location.href = DB_CONFIG.prijava;
        return;
    }
    prikaziUporabnika();

    const gumbOdjava = document.getElementById("btnOdjava");
    if (gumbOdjava) gumbOdjava.addEventListener("click", odjava);
});
