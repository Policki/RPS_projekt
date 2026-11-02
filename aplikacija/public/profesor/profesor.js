function preberiUporabnika() {
    const shranjeno = sessionStorage.getItem("prijavljenUporabnik") || localStorage.getItem("prijavljenUporabnik");
    if (!shranjeno) return null;
    try {
        return JSON.parse(shranjeno);
    } catch (napaka) {
        return null;
    }
}
 
function izracunajInicialke(polnoIme) {
    return polnoIme
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(beseda => beseda.charAt(0).toUpperCase())
        .join("");
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
        telefon: document.getElementById("polje-telefon").value.trim(),
        predmeti: document.getElementById("polje-predmeti").value.trim()
    };
 
    gumb.disabled = true;
    gumb.textContent = "Shranjujem...";
 
    try {
        await Profil.shrani(uporabnik.email, podatki);
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
 
function zberiNastavitve() {
    const vrednosti = {};
    document.querySelectorAll("input[data-nastavitev]").forEach(polje => {
        vrednosti[polje.dataset.nastavitev] = polje.checked;
    });
    return vrednosti;
}
 
async function naloziNastavitveIzBaze() {
    const uporabnik = preberiUporabnika();
    if (!uporabnik || !uporabnik.email) return;
 
    try {
        const vrstica = await Nastavitve.preberi(uporabnik.email);
        if (!vrstica) return;
 
        document.querySelectorAll("input[data-nastavitev]").forEach(polje => {
            const vrednost = vrstica[DB_CONFIG.stolpciNastavitve[polje.dataset.nastavitev]];
            if (typeof vrednost === "boolean") polje.checked = vrednost;
        });
    } catch (napaka) {
        console.error(napaka);
    }
}
 
async function shraniNastavitve(dogodek) {
    const polje = dogodek.target;
    const uporabnik = preberiUporabnika();
 
    if (!uporabnik || !uporabnik.email) {
        polje.checked = !polje.checked;
        return;
    }
 
    try {
        await Nastavitve.shrani(uporabnik.email, zberiNastavitve());
    } catch (napaka) {
        console.error(napaka);
        polje.checked = !polje.checked;
    }
}
 
function odjava() {
    sessionStorage.removeItem("prijavljenUporabnik");
    localStorage.removeItem("prijavljenUporabnik");
    window.location.href = DB_CONFIG.prijavnaStran;
}
 
document.addEventListener("DOMContentLoaded", () => {
    prikaziUporabnika();
 
    const obrazecProfil = document.getElementById("obrazec-profil");
    if (obrazecProfil) {
        naloziProfilIzBaze();
        obrazecProfil.addEventListener("submit", shraniProfil);
    }
 
    const poljaNastavitev = document.querySelectorAll("input[data-nastavitev]");
    if (poljaNastavitev.length) {
        naloziNastavitveIzBaze();
        poljaNastavitev.forEach(polje => polje.addEventListener("change", shraniNastavitve));
    }
 
    const gumbOdjava = document.getElementById("gumb-odjava");
    if (gumbOdjava) gumbOdjava.addEventListener("click", odjava);
});