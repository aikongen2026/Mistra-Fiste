# Mistra Fiske 1.1.0 - elvepunkter som følger kartet

Videreutvikling av Mistra Fiske 1.0.1. Docker-oppsettet er beholdt.

## Rettet
Den forrige Mistra-utgaven viste NVEs elvelinje og et lite antall kildeomtalte
utgangspunkt. Den genererte ikke søkepunkter når kartet ble flyttet.
Vestfjella har en separat punktberegning ved kartbevegelse; samme prinsipp er
nå lagt inn i Mistra, men basert på elvelinjer i stedet for innsjoeflater.

* Opptil 28 nummererte elvepunkter i det synlige kartutsnittet.
* Panorering, zoom og Live-følging oppdaterer punktene automatisk.
* Punktene beregnes lokalt fra hentet/mellomlagret NVE-geometri; ingen nye
  eksterne kartoppslag ved hver kartbevegelse.
* Fungerer også når kartutsnittet bare skjærer en linje mellom to
  kildekoordinater, eller viser en svært kort del av elva.
* Klikk punktet for kildebaserte fiskeråd, ett konkret agn fra din eske og
  relevante alternativer. De 18 originalutklippene er uendret.
* Egen Elvepunkter-knapp. Elvelinje og Utgangspunkt kan skjules uavhengig.
* Sesongstengt fiske fjerner ikke planleggingspunkter. Regelvarselet beholdes.
* Maks avstand gjelder fremdeles; tilkomst for kartberegnede punkter er uavklart.
  Tilkomst Alle/Uavklart viser dem. Enklere utgangspunkt gjelder kun kjente
  adkomstopplysninger og brukes ikke som bevis på en lett elvebredd.
* Mistra må være synlig i utsnittet. Det lages ikke punkter på land eller
  på oppdiktede koordinater hvis elvedata mangler. Tidligere elvedata beholdes
  dersom ny henting feiler eller blir begrenset.

## Hva punktene betyr
Gule/lilla nummererte punkter er modellens forslag til steder å undersøke
langs NVEs digitale elvelinje. De er IKKE dokumenterte fiskehøler, fangster,
dybder, trygge vadeplasser, parkeringsplasser eller juridiske kortgrenser.
En sving beskrives som en kartlagt sving, ikke automatisk som en dyp kulp.
Nummereringen er beste modellprioritet først, ikke fangstsannsynlighet.
Nærmeste kildeomtalte utgangspunkt vises som områdereferanse når det
finnes en slik referanse i nærheten. Det bestemmer ikke tillatelsen ved punktet.

## Oppdater eksisterende GitHub/Render
1. Pakk ut ZIP-en.
2. GitHub: aikongen2026/Mistra-Fiste > Add file > Upload files.
3. Dra inn INNHOLDET av prosjektmappen, med Dockerfile og public-mappen intakt.
   Dockerfile, package.json og server.js skal ligge i repo-roten.
4. Commit changes. Render kan beholde Docker, ./Dockerfile og byggkontekst .
5. Etter deploy skal overskriften og /api/health vise 1.1.0.

Ingen nye API-nøkler kreves for punktene. NVE_API_KEY brukes fortsatt bare til
automatiske vannmålinger. Live GPS, turlogg, slukboks, dato/regelvisning, vær
og hydrologi fra den forrige pakken er beholdt.

## Lokal kjøring og kontroll
Node >=20. Kjør npm ci, npm test og npm start. Eller bruk START-HER.bat.
71 automatiske enhets-/HTTP-/pakkeprøver er kjørt. Se TESTRESULTAT.md for
testomfang og begrensninger. Ingen felt-/GPS- eller Render-deploy er utført her.
