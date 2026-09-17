'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.join(__dirname,'..'),pkg=require('../package.json'),guide=require('../public/data/mistra.json');
if(pkg.version!==guide.version||guide.app!=='Mistra Fiske')throw Error('Feil app/versjon.');
for(const file of ['public/index.html','public/app.js','public/model.js','public/style.css','public/sw.js','public/data/lures.json','server.js'])if(!fs.existsSync(path.join(root,file)))throw Error('Mangler '+file);
for(const l of require('../public/data/lures.json')){if(!l.image.startsWith('/lures/')||!fs.existsSync(path.join(root,'public',l.image)))throw Error('Mangler enkeltagn '+l.id);}
for(const file of ['server.js','public/app.js','public/model.js','public/sw.js'])cp.execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
console.log('Mistra Fiske '+pkg.version+' - layout, bilder og syntaks OK.');
