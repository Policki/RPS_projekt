const DB_CONFIG = {
    api: "api/api.php",
    prijava: "prijava/index.html",
    stolpci: {
        ime: "ime",
        eposta: "eposta",
        telefon: "telefon",
        predmeti: "predmeti"
    },
    stolpciNastavitve: {
        tedenski_povzetek: "tedenski_povzetek",
        opomnik_rok: "opomnik_rok",
        novi_vpisi: "novi_vpisi"
    }
};

function naslovApi(akcija, eposta, dodatno = "") {
    return DB_CONFIG.api + "?akcija=" + encodeURIComponent(akcija) + "&email=" + encodeURIComponent(eposta || "") + dodatno;
}

async function klicApi(akcija, eposta, podatki = null) {
    const naslov = naslovApi(akcija, eposta);
    let moznosti = {};

    if (podatki instanceof FormData) {
        moznosti = { method: "POST", body: podatki };
    } else if (podatki) {
        moznosti = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(podatki)
        };
    }

    const odgovor = await fetch(naslov, moznosti);
    const rezultat = await odgovor.json();

    // seja je potekla ali uporabnik ni prijavljen
    if (odgovor.status === 401 && akcija !== "prijava") {
        sessionStorage.removeItem("prijavljenUporabnik");
        localStorage.removeItem("prijavljenUporabnik");
        window.location.href = DB_CONFIG.prijava;
    }

    if (!odgovor.ok || (rezultat && rezultat.napaka)) {
        throw new Error((rezultat && rezultat.napaka) || "Napaka strežnika");
    }
    return rezultat;
}

const Odjava = {
    izvedi: () => klicApi("odjava", "", {})
};

const Profil = {
    preberi: eposta => klicApi("profil", eposta),
    shrani: (eposta, podatki) => klicApi("profil_shrani", eposta, podatki)
};

const Nastavitve = {
    preberi: eposta => klicApi("nastavitve", eposta),
    shrani: (eposta, podatki) => klicApi("nastavitve_shrani", eposta, podatki)
};

const Dashboard = {
    preberi: eposta => klicApi("dashboard", eposta)
};

const Predmeti = {
    preberi: eposta => klicApi("predmeti", eposta)
};

const Naloge = {
    preberi: eposta => klicApi("naloge", eposta)
};

const Gradiva = {
    preberi: eposta => klicApi("gradiva", eposta),
    naslovDatoteke: (eposta, id) => naslovApi("gradivo_odpri", eposta, "&id=" + encodeURIComponent(id)),
    dodajDatoteko: (eposta, izvedbaId, datoteka) => {
        const podatki = new FormData();
        podatki.append("izvedba_id", izvedbaId);
        podatki.append("datoteka", datoteka);
        return klicApi("gradivo_dodaj", eposta, podatki);
    },
    dodajPovezavo: (eposta, izvedbaId, naziv, url) => {
        return klicApi("gradivo_dodaj", eposta, { izvedba_id: izvedbaId, naziv: naziv, url: url });
    }
};

const Dogodki = {
    preberi: eposta => klicApi("dogodki", eposta),
    dodaj: (eposta, podatki) => klicApi("dogodek_dodaj", eposta, podatki),
    odstrani: (eposta, id) => klicApi("dogodek_odstrani", eposta, { id: id })
};
