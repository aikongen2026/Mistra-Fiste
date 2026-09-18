# Mistra Fiske 1.0.1 - Docker-retting

Egen app for Mistra fra Åkrestrømmen og oppover. Bygger på Fiste REV27s Leaflet-/høyrepaneloppsett, lokale fangstlogg og watchPosition/Live-mønster. Kystmodellen er erstattet med en egen, kildebasert elveguide. Tidligere apper overskrives ikke.

## Det som er med

8 kildeomtalte strekninger; klikk for utgangspunkt og råd. 18 nye enkeltutklipp fra brukerens opprinnelige slukbilder. Hele agnet vises med object-fit: contain. Registrering av lengde og flyteevne i egen slukboks. Metodevalg, tilkomstfilter, egen base og radius. Dato/tid i Europe/Oslo. Sortering etter en tydelig merket modellprioritet, med sesongstatus først. Kildeknapper skiller historiske fangsthistorier, dagens publiserte regler og våre teknikkforslag.

Live GPS viser fart, nøyaktighet, kurs når enheten leverer det og et segmentert spor som kan eksporteres til GPX. Manuell kartflytting pauser bare sentreringen; knappen Følg meg starter sentreringen igjen. Stopp-knappen avslutter GPS-overvåkningen. Ingen automatisk GPS-start eller sending av sporet til en server.

## Kart og nøyaktighet

Standardkart, satellitt og Kartverkets topo-turkart. NVE ELVIS elvelinje hentes via dokumentert API, ikke tegnet fra gjetning. Utgangspunkt hentes fra Kartverkets adresse-/stedsnavnoppslag og blir lagret. To områdereferanser finnes i pakken fra offentlig kartreferanse; de er **ikke** bekreftede fiskehøler. Et trykk på et sted zoomer til et entydig utgangspunkt når det finnes. Ukjente eller tvetydige steder får forklaring, ikke en falsk posisjon.

Holsbuhølen er bare navngitt i Hooked 2012 og har ingen verifisert koordinat i det tilgjengelige materialet. Den har derfor et informasjonskort, ikke en oppdiktet markør. Det lokale kartet på mistra.no er lenket, ikke kopiert; selve bildefilen kunne ikke lastes i arbeidsmiljøet.

Kartgeometrien må lastes første gang på nettet. Manglende tjenestesvar gir ikke tilfeldige erstatningslinjer. Guide og siste elvedata kan brukes fra cache. Bakgrunnskart er **ikke** et komplett nedlastet offlinekart. Det er ikke vedlagt et oppfunnet kart, fiskekortgrensepolygon eller dybdemodell.

## NVE vannføring og vær

Sett NVE_API_KEY i servermiljøet. Dette er nøkkelen fra NVEs gratis HydAPI, ikke et abonnement som appen selger. Stasjonen for vannføring og vannstand er fast satt til **Mistra bru 2.267.0**, parametere 1001 og 1000. Temperatur forsøkes fra **2.695.0**, parameter 1003; stasjonen kan mangle aktuelle observasjoner. Egne tidsstempler, stasjonsnavn, 3-/24-timers trend og graf skiller målt og manglende data. Vannstandens referansenivå er ikke vadedybde. Ingen eksempelverdier brukes som live.

MET gir timeprognose ved valgt utgangspunkt, mellomlagret 10 minutter. En valgt dato utenfor tilgjengelig varsel bruker ikke nærmeste tilfeldige værtime. Sikt og lav/normal/høy vannføring er brukerens egne observasjoner, ikke antatt fra nedbør. Appens varsel om >30 prosent vannføringsstigning på 3 timer er en forsiktig egen heuristikk, ikke et offisielt flomvarsel.

## Regler og beslutningsstøtte

Kilder er kontrollert 18.09.2026. Regler gjelder 2026-tilbudet; andre år krever ny kontroll. Nedre/midtre Mistra og Nordre Mistra har separate kort. Forskjellen mellom nordre produktdato 31. august og regeltekst 1. september synliggjøres. Ikke overfør kildenes opplysninger om innsjøer, andre elver eller sidebekker til en tilfeldig Mistra-posisjon. Full regeltekst og rapporteringslenke er tilgjengelig i appen.

Prioritetspoengene er en egen, transparent hjelpeberegning, ikke validerte fangstsannsynligheter eller en rangering av beviste bestander. Det er ikke funnet en kilde som angir ett optimalt m3/s-nivå for alle Mistra-høler. Eksakt arbeidsdybde og flyteevne til et agn kan ikke avleses fra bilde alene.

## GitHub / Render

Denne pakken er tilpasset den eksisterende **Docker-tjenesten Mistra-Fiste**.
Last opp innholdet i samme GitHub-repo. `Dockerfile`, `package.json` og
`server.js` skal ligge direkte i repo-roten. Behold `public/`, `scripts/` og
`test/` som undermapper. Ikke opprett en ny tjeneste, og ikke last opp ZIP-en
uten å pakke den ut. Se `00-START-HER.txt`.

`Dockerfile` bruker offisielt Node 22 bookworm-slim, installerer den låste
Leaflet 1.9.4-pakken via `npm ci`, verifiserer appfilene og kartbiblioteket,
og starter `node server.js`. Appen lytter på `0.0.0.0` og miljøvariabelen
`PORT`; standarden i Docker er 10000. Den kjører uten root-rettigheter og
har en skrivbar `/app/.cache`. `.dockerignore` utelater lokale avhengigheter,
mellomlagrede data og hemmelige miljøfiler. NVE-nøkkelen leses ved kjøring,
ikke under byggingen.

`render.yaml` beskriver Docker og `/api/health` for Blueprint-bruk. En vanlig
GitHub-opplasting endrer ikke automatisk innstillingene til en eksisterende
tjeneste som ble opprettet via kontrollpanelet. Innstillingene du viste
(`./Dockerfile`, rotmappe tom, byggekontekst `.`) passer allerede med pakken.

Lokal kjøring uten Docker fungerer fortsatt med `npm ci --omit=dev` og
`npm start`. `START-HER.bat` er beholdt. Ikke last opp `node_modules`.

Miljøvariabler: `NVE_API_KEY` (målinger), `MET_USER_AGENT` (egen
kontaktidentifikasjon), `PORT` og eventuelt `CACHE_DIR`. Kildedata,
fiskeregler, Live GPS, kartoppsett og bilder fra 1.0 er beholdt.

## Personvern og Live

Live aktiveres bare med knapp og posisjonstillatelse. GPS-spor og logg lagres lokalt. API-kall for vær kan inneholde et avrundet områdepunkt; sporet og fangstloggen sendes ikke. Eksterne karttjenester mottar kartutsnittforespørsler. Google-ruting åpnes bare ved brukerens trykk og får destinasjonen.

GPS og skjerm-våken-funksjonen kan pauses når nettleseren er i bakgrunnen eller skjermen låses. Hold appen synlig; bruk aldri programmet som eneste navigasjons-/sikkerhetsverktøy ved elva. Live er ikke en anbefaling om å dørge eller føre båt i Mistras stryk.

## Test og kildeproveniens

Kjør `npm test` og `npm run verify`. 45 automatiske tester og lokal ikke-root-serveroppstart er kontrollert i 1.0.1. Selve Docker-bygget, nettbasert Leaflet-installasjon og fysisk GPS er ikke gjennomført her. Se TESTRESULTAT.md for fullstendig avgrensning. Eksterne API-er i testene bruker kontrollerte svar.

`public/data/mistra.json` inneholder hele kildekatalogen, kontrolltid, kildeoppsummeringer og skillet mellom kildefunn og arbeidsforslag. `public/data/lures.json` inneholder utsnittets koordinater i originalfotoet og bevisst ukjente agnegenskaper. Brukerens foto er ikke hentet fra nettet.

Kartverkets topo: CC BY 4.0. NVE ELVIS/HydAPI: kreditering etter NLOD og kildevilkår. OpenStreetMap: bidragsytere/ODbL; fliser brukes interaktivt, ikke til massenedlasting. Esri-bakgrunn brukes med synlig kreditering. Leaflet 1.9.4: BSD-2-Clause; lisens følger npm-pakken. Kildenes artikler og lokale kommersielle kart er ikke gjengitt i fulltekst.

## Kilder for Docker-oppsettet

- Render Docker: https://render.com/docs/docker
- Render portbinding: https://render.com/docs/web-services#port-binding
- Offisielt Node-image: https://github.com/nodejs/docker-node
- Låst Leaflet-metadata: https://registry.npmjs.org/leaflet/1.9.4
