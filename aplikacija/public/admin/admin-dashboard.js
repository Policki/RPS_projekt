document.addEventListener('DOMContentLoaded',()=>ADMIN.zagon(async uporabnik=>{
    const p=await API.klic('/api/admin/dashboard');
    ADMIN.besedilo('greeting','Dober dan, '+uporabnik.ime+'.');
    ADMIN.besedilo('subtitle',p.caka ? 'Na potrditev čaka '+p.caka+' računov.' : 'Ni računov, ki čakajo na potrditev.');
    for(const [id,vrednost] of Object.entries({pendingBadge:p.caka+' čaka',studentsBadge:p.dijaki,teachersBadge:p.profesorji,usersMain:p.aktivni+' aktivnih računov',usersNew:p.novi,classesMain:p.razredi+' razredov',noTeacher:p.brez_razrednika,backupText:'Zadnja kopija: '+(p.kopije.zadnja || 'Še ni izdelana'),diskText:'Poraba prostora se ne meri.',uptimeText:'Merjenje razpoložljivosti ni nastavljeno.'})) ADMIN.besedilo(id,vrednost);
    document.getElementById('diskBar').style.width='0%';
    document.getElementById('uptimeArc').setAttribute('stroke-dasharray','0 252');
    document.getElementById('uptimeRing').setAttribute('aria-label','Merjenje razpoložljivosti ni nastavljeno');
    document.querySelectorAll('.track > div').forEach(polje=>polje.style.width='0%');
}));
