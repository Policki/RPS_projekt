const assert=require('node:assert/strict');
const {preveriIzvorPrijave}=require('../server/middleware/avtentikacija');
const primeri=[
    ['isti izvor',{origin:'http://localhost:3000'},'http','localhost:3000',true],
    ['skriti izvor iste strani',{origin:'null','sec-fetch-site':'same-origin'},'http','localhost:3000',true],
    ['zahteva brez glave Origin',{},'http','localhost:3000',true],
    ['127.0.0.1',{origin:'http://127.0.0.1:3000'},'http','127.0.0.1:3000',true],
    ['Nginx z drugimi vrati',{origin:'http://localhost:18082'},'http','localhost:18082',true],
    ['HTTPS proxy',{origin:'https://sola.example.org'},'https','sola.example.org',true],
    ['skriti izvor prek HTTPS',{origin:'null','sec-fetch-site':'same-origin'},'https','sola.example.org',true],
    ['tuj izvor',{origin:'https://tuja-stran.example'},'http','localhost:3000',false],
    ['skriti tuj izvor',{origin:'null','sec-fetch-site':'cross-site'},'http','localhost:3000',false],
    ['skriti izvor brez podatka o mestu',{origin:'null'},'http','localhost:3000',false],
    ['tuj izvor z napačno oznako',{origin:'https://tuja-stran.example','sec-fetch-site':'same-origin'},'http','localhost:3000',false],
    ['tuj izvor brez glave Origin',{'sec-fetch-site':'cross-site'},'http','localhost:3000',false],
    ['druga poddomena',{origin:'https://drugo.example.org','sec-fetch-site':'same-site'},'https','sola.example.org',false]
];
for(const [naziv,glave,protocol,host,dovoljeno]of primeri){
    let sprejeto=false;
    let status;
    const req={protocol,get:ime=>ime==='host' ? host : glave[ime]};
    const res={status:koda=>{status=koda;return res;},send:()=>res};
    preveriIzvorPrijave(req,res,()=>{sprejeto=true;});
    assert.equal(sprejeto,dovoljeno,naziv);
    if(!dovoljeno)assert.equal(status,403,naziv);
    console.log('OK '+naziv);
}
