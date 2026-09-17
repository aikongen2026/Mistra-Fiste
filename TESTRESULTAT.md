# Testresultat - Mistra Fiske 1.0

## Kontroller som er kjørt

39 automatiske Node-tester bestått. De dekker norsk dato/sesong, hovedkort og nordre kort, augustgrense, ugyldige år, sortering, agnfiltrering, manglende målinger, NVE-stasjonsvalg, API-nøkkel i header, koordinatvalidering, kartpaging, tvetydige navn, GPS-støy/gap og GPX. HTTP-serveren og lokale bildefiler er testet i prosessen.

29 kontroller av den faktiske HTML/JavaScript-visningen i Chromium bestått, i både desktop- og mobilstørrelse. Filter, stedsvalg, helt agnbilde, modal, lokal logg, Live start/stopp, manuell panoreringspause og gjenopptatt følging er kontrollert. Her var Leaflet, eksterne API-svar, lagring/historikk og GPS erstattet av kontrollerte testdobler. Dette er ikke en feltprøve eller en bekreftelse på eksterne kartfliser.

18 enkeltutklipp er visuelt gjennomgått mot brukerens originale foto. Ingen samlefoto brukes som anbefalt enkeltagn. Layout- og syntakskontroll kjøres også ved oppstart med npm run verify.

## Ikke sluttprøvd

Byggemiljøet kunne ikke hente npm-pakken Leaflet eller kontakte de virkelige MET-, NVE- og Kartverket-endepunktene. Full oppkobling med installert Leaflet, NVE_API_KEY og fysisk mobil-GPS må derfor kontrolleres etter deploy. npm install på Render installerer den låste Leaflet-versjonen 1.9.4.

De nye geodataoppslagene er skrevet mot offisiell dokumentasjon. Ekte elvelinje og entydige adresser hentes på nettet før de kan vises. To kildeoppgitte områdereferanser følger med; ingen fiskehøler er konstruert. Ved feil blir fraværet synlig, mens kildeguiden fortsetter å fungere.

Ingen navigasjon, fiskesannsynlighet, adkomst, mobildekning, privat kjørerett eller vadesikkerhet er garantert. Bakgrunns-/låst-skjerm-GPS i en nettleser kan stoppe.

## Gjenta lokalt

npm test
npm run verify

Testene under test/ krever Node 20+ og bruker ikke ekte nøkler. De kontrollerte browser-testene ble kjørt separat i byggemiljøet; testdobler og falske GPS/kart/måleverdier inngår ikke i public-dataene.
