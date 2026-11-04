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

function naloziLokalnaStikala() {
    document.querySelectorAll("input[data-lokalno]").forEach(polje => {
        try {
            polje.checked = localStorage.getItem("profesor-" + polje.dataset.lokalno) === "1";
        } catch (napaka) {
            console.error(napaka);
        }
        polje.addEventListener("change", () => {
            try {
                localStorage.setItem("profesor-" + polje.dataset.lokalno, polje.checked ? "1" : "0");
            } catch (napaka) {
                console.error(napaka);
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    naloziLokalnaStikala();
    const poljaNastavitev = document.querySelectorAll("input[data-nastavitev]");
    naloziNastavitveIzBaze();
    poljaNastavitev.forEach(polje => polje.addEventListener("change", shraniNastavitve));
});