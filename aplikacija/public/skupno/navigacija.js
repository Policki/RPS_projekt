const NAVIGACIJA = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    predmeti: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    naloge: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 2.5 2.5L16 9"/>',
    gradiva: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
    koledar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    nastavitve: '<circle cx="12" cy="12" r="3"/><path d="m9 3 1-1h4l1 3 3 1 3 1v4l-2 2v3l-2 3-3-1-3 2-3-2-3-1v-4l-2-2V7l3-1 1-3z"/>',
    uporabniki: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2c2.6.3 4.5 2.2 4.5 5.3"/>',
};
function poenotiNavigacijo() {
    for (const povezava of document.querySelectorAll('nav.sidebar a')) {
        let naslov = povezava.getAttribute('href') || '';
        const oznaka=(povezava.getAttribute('aria-label') || povezava.title || povezava.closest('.icon')?.title || '').toLocaleLowerCase('sl');
        const kljuc = Object.keys(NAVIGACIJA).find(ime => naslov.includes(ime)) || (naslov.includes('dasboard') || oznaka.includes('nadzorna') ? 'dashboard' : Object.keys(NAVIGACIJA).find(ime=>oznaka.includes(ime)));
        if (!kljuc) continue;
        if(naslov==='#' && location.pathname.startsWith('/admin/')){
            naslov='/admin/admin-'+kljuc+'.html';povezava.href=naslov;
        }
        if (kljuc === 'profil') povezava.href = '/profil';
        if(!povezava.querySelector('svg')){
            const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
            svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
            svg.innerHTML = NAVIGACIJA[kljuc];
            povezava.replaceChildren(svg);
        }
        const aktivna = kljuc === 'profil' ? /^\/profil(?:\.html)?$/.test(location.pathname) : location.pathname === new URL(povezava.href).pathname || (kljuc === 'dashboard' && /dashboard|dasboard/.test(location.pathname)) || (kljuc==='predmeti' && location.pathname.startsWith('/ucenec/predmeti/'));
        const ovitek = povezava.closest('.icon');
        if (ovitek) ovitek.classList.toggle('active',aktivna);
        if (aktivna) povezava.setAttribute('aria-current','page'); else povezava.removeAttribute('aria-current');
    }
}
document.addEventListener('DOMContentLoaded',poenotiNavigacijo);
