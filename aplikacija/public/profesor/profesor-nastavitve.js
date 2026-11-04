function zberiNastavitve() {
    const vrednosti = {};
    document.querySelectorAll("input[data-nastavitev]").forEach(polje => {
        vrednosti[polje.dataset.nastavitev] = polje.checked;
    });
    return vrednosti;
}

async function naloziNastavitveIzBaze() {
    const uporabnik = await preberiUporabnika();
    if (!uporabnik || !uporabnik.email) return;

    try {
        const vrstica = await Nastavitve.preberi(uporabnik.email);
        if (!vrstica) return;

        document.querySelectorAll("input[data-nastavitev]").forEach(polje => {
        const vrednost = vrstica[polje.dataset.nastavitev];
            if (typeof vrednost === "boolean") polje.checked = vrednost;
        });
    } catch (napaka) {
        API.napaka(napaka);
    }
}

async function shraniNastavitve(dogodek) {
    const polje = dogodek.target;
    const uporabnik = await preberiUporabnika();

    if (!uporabnik || !uporabnik.email) {
        polje.checked = !polje.checked;
        return;
    }

    try {
        await Nastavitve.shrani(uporabnik.email, zberiNastavitve());
    } catch (napaka) {
        API.napaka(napaka);
        polje.checked = !polje.checked;
    }
}

async function naloziLokalnaStikala() {
    const uporabnik=await preberiUporabnika();
    document.querySelectorAll("input[data-lokalno]").forEach(polje => {
        if(polje.dataset.lokalno==='zacni_dashboard') { polje.checked=true;polje.disabled=true;return; }
        const kljuc='profesor-'+uporabnik.id+'-'+polje.dataset.lokalno;
        try {
            polje.checked = localStorage.getItem(kljuc) === "1";
        } catch (napaka) {
            API.napaka(napaka);
        }
        polje.addEventListener("change", () => {
            try {
                localStorage.setItem(kljuc, polje.checked ? "1" : "0");
                document.body.classList.toggle('zgosceni-prikaz',polje.checked);
            } catch (napaka) {
                API.napaka(napaka);
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    naloziLokalnaStikala().catch(API.napaka);
    const poljaNastavitev = document.querySelectorAll("input[data-nastavitev]");
    naloziNastavitveIzBaze().catch(API.napaka);
    poljaNastavitev.forEach(polje => polje.addEventListener("change", shraniNastavitve));
});
