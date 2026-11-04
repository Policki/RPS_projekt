const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const assert=require('assert/strict');
const javno=path.resolve(__dirname,'../public');
let stevilo=0;
function preglej(mapa){
    for(const ime of fs.readdirSync(mapa)){
        if(['node_modules','podatki','backup'].includes(ime))continue;
        const pot=path.join(mapa,ime);
        if(fs.statSync(pot).isDirectory()){preglej(pot);continue;}
        if(ime.endsWith('.js') || ime.endsWith('.cjs')){execFileSync(process.execPath,['--check',pot],{stdio:'pipe',windowsHide:true});stevilo++;}
        if(!ime.endsWith('.html')||!pot.startsWith(javno))continue;
        const vsebina=fs.readFileSync(pot,'utf8');
        for(const zadetek of vsebina.matchAll(/(?:src|href)="([^"?#]+\.(?:css|js))"/g)){
            const vir=zadetek[1];
            if(vir.startsWith('http'))continue;
            assert.ok(vir.startsWith('/'),'Pot naj bo absolutna: '+pot+' '+vir);
            assert.ok(fs.existsSync(path.join(javno,vir)),'Datoteka manjka: '+pot+' '+vir);
        }
        assert.ok(!/<script\s*>\s*\S/.test(vsebina),'Inline JavaScript: '+pot);
        if(pot.includes(path.sep+'admin'+path.sep)||pot.includes(path.sep+'profesor'+path.sep)){
            assert.ok(vsebina.includes('/'+path.basename(path.dirname(pot))+'/'+ime.replace('.html','.js')),'Manjka pripadajoči JS: '+pot);
        }
    }
}
preglej(path.resolve(__dirname,'..'));
console.log('Sintaksa '+stevilo+' datotek JavaScript in poti do vseh CSS/JS so pravilne.');
