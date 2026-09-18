# Testresultat - Mistra Fiske 1.0.1 (Docker-retting)

Kontrollert 18.09.2026. Denne endringen gjelder deploy-oppsettet, ikke fiskerådene.

## Faktisk kjørt i denne revisjonen

- 45 av 45 automatiske Node-tester bestod: de 39 opprinnelige testene og
  seks nye kontroller for Docker-fil, kildefiler, pakkeversjon,
  avhengighetslås, Render-konfigurasjon, portvalg og utelating av hemmeligheter.
- `npm run verify` bestod: appidentitet, versjon, bildefiler og JS-syntaks.
- `npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund`
  bestod. Dette kontrollerer låsefilen; det installerer ikke Leaflet.
- Direkte prosessoppstart med `node server.js`, `NODE_ENV=production` og
  port 10000 bestod. Koden lyttet som konfigurert på 0.0.0.0.
- En ny oppstart med `PORT=19876` bestod: appen bruker miljøvariabelen,
  ikke en hardkodet port. Begge oppstarter ble kjørt som ikke-root (uid 65534).
- `/api/health` svarte `ok: true`, `app: Mistra Fiske`, `version: 1.0.1`
  i begge prosessene, uten NVE-nøkkel.
- HTML, JavaScript, CSS, service worker, kildeguide og alle 18 agnbilder
  svarte HTTP 200 fra den første testserveren (25 fil-/guideendepunkter).
- Uten NVE-nøkkel returnerte hydrologiendepunktet tydelig konfigurasjonsstatus,
  ikke oppdiktede måleverdier. Serveroppstart avhenger ikke av NVE-tilgang.
- GPS-/kartkoden i `public/app.js`, modellkoden, CSS, agnkatalog og alle
  18 agnbilder er identiske byte for byte med 1.0-pakken.
- ZIP-en er integritetssjekket og inneholder 48 filer.

## Ikke kjørt / begrensninger

Docker, Podman og BuildKit er ikke installert i arbeidsmiljøet. Et faktisk
`docker build` og oppstart av Docker-imaget er derfor IKKE gjennomført her.
Siste kontroll av dette skjer når Render bygger pakken.

Direkte npm-nedlasting i arbeidsmiljøet feilet med DNS-feilen EAI_AGAIN.
Leaflet ble dermed ikke installert lokalt, og `/vendor/leaflet/*` ble ikke
gjennomprøvd i denne revisjonen. Docker-bygget laster den offisielle
Leaflet 1.9.4-pakken fra npm, sjekker integritet med package-lock.json og
kjører `scripts/verify-vendor.js` før imaget kan bli ferdig.

Lockfilens versjon, URL og SHA-512-integritet kommer fra offentlig metadata:
https://registry.npmjs.org/leaflet/1.9.4

Eksterne MET/NVE/Kartverket-svar i unit-testene er kontrollerte testsvar,
ikke målinger fra testtidspunktet. Ekte mobil-GPS og ende-til-ende nettleserbruk
med karttjenestene ble ikke testet på nytt. Tidligere rapporterte 29
nettleserkontroller fra 1.0 er ikke gjentatt og inngår ikke i testtallet over.

## Gjenta

Lokalt: `npm ci --omit=dev`, `npm test`, `npm run verify`,
`node scripts/verify-vendor.js`, `npm start`.

Med Docker: `docker build -t mistra-fiske .` og
`docker run --rm -p 10000:10000 mistra-fiske`.

De nye Docker-testene validerer fil-/konfigurasjonsinnholdet. De erstatter
ikke en faktisk Docker-bygging. API-nøkkel skal bare settes som en
miljøvariabel ved kjøring, aldri legges i image eller GitHub.
