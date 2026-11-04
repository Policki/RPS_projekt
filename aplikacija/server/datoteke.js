const multer=require('multer');
const fs=require('fs/promises');
const path=require('path');
const {randomUUID}=require('crypto');
const {napaka}=require('./pomoc');
const mapa=path.resolve(process.env.UPLOAD_DIR || path.join(__dirname,'../podatki/datoteke'));
const vrste={
    '.pdf':'application/pdf','.doc':'application/msword',
    '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt':'text/plain','.sql':'text/plain','.zip':'application/zip',
    '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'
};
function nalaganje(koncnice){
    return multer({
        storage:multer.diskStorage({
            destination:(req,datoteka,koncano)=>fs.mkdir(mapa,{recursive:true}).then(()=>koncano(null,mapa),koncano),
            filename:(req,datoteka,koncano)=>koncano(null,randomUUID()+path.extname(datoteka.originalname).toLowerCase())
        }),
        limits:{fileSize:10*1024*1024,files:1,fields:2,parts:3},
        fileFilter:(req,datoteka,koncano)=>koncano(koncnice.includes(path.extname(datoteka.originalname).toLowerCase()) ? null : napaka(400,'Ta vrsta datoteke ni dovoljena.'),true)
    }).single('datoteka');
}
async function preveriDatoteko(datoteka,najvec=10*1024*1024){
    if(!datoteka)throw napaka(400,'Izberite datoteko.');
    if(!datoteka.size || datoteka.size>najvec)throw napaka(400,'Datoteka je prazna ali presega dovoljeno velikost.');
    const koncnica=path.extname(datoteka.originalname).toLowerCase();
    const rocica=await fs.open(datoteka.path,'r');
    const glava=Buffer.alloc(Math.min(4096,datoteka.size));
    try{await rocica.read(glava,0,glava.length,0);}finally{await rocica.close();}
    let veljavna=false;
    if(koncnica==='.pdf')veljavna=glava.subarray(0,5).toString()==='%PDF-';
    if(['.docx','.pptx','.xlsx','.zip'].includes(koncnica))veljavna=[Buffer.from([80,75,3,4]),Buffer.from([80,75,5,6])].some(p=>glava.subarray(0,4).equals(p));
    if(['.doc','.ppt'].includes(koncnica))veljavna=glava.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225]));
    if(koncnica==='.png')veljavna=glava.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if(['.jpg','.jpeg'].includes(koncnica))veljavna=glava.subarray(0,3).equals(Buffer.from([255,216,255]));
    if(['.txt','.sql'].includes(koncnica))veljavna=!glava.includes(0);
    if(!veljavna || !vrste[koncnica])throw napaka(400,'Vsebina datoteke ne ustreza izbrani vrsti.');
    return vrste[koncnica];
}
async function shraniZapis(povezava,uporabnik,datoteka,mime){
    const [rezultat]=await povezava.execute('INSERT INTO Datoteka (id_lastnik,izvorno_ime,shranjeno_ime,storage_kljuc,mime_tip,velikost_bajtov) VALUES (?,?,?,?,?,?)',[
        uporabnik,path.basename(datoteka.originalname).slice(0,255),datoteka.filename,datoteka.filename,mime,datoteka.size
    ]);
    return rezultat.insertId;
}
async function odstraniZacasno(datoteka){if(datoteka)await fs.unlink(datoteka.path).catch(()=>{});}
async function obstaja(kljuc){
    if(!kljuc)return false;
    const pot=path.resolve(mapa,kljuc);
    if(!pot.startsWith(mapa+path.sep))return false;
    try{return (await fs.stat(pot)).isFile();}catch{return false;}
}
module.exports={nalaganje,preveriDatoteko,shraniZapis,odstraniZacasno,obstaja};
