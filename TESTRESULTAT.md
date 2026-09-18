# Tester - Mistra Fiske 1.1.0

Dato: 18. september 2026.

## Kjørt med reell lokal Node HTTP-server
- npm test: **71 av 71 bestod**.
- npm run verify: layout, agnbilder, appidentitet og JavaScript-syntaks bestod.
- 45 eksisterende tester fra 1.0.1 er beholdt, med versjonsforventning 1.1.0.
- 26 nye regresjonstester dekker elvepunkter, linjeklipping, panorering,
  zoom, korte synlige linjer, radius, flytting av GPS-base, kildeavgrensning,
  MultiLineString, manglende/ugyldige data, cacheopplysninger, sesong og tilkomst.
- Geometritestene bruker uttrykkelig syntetiske testlinjer, ikke påståtte
  koordinater til Mistra-høler. Disse brukes aldri som fallback i appen.

## Kontrollert grensesnitt i Chromium
**29 kontroller bestod** med appens faktiske HTML/CSS/JavaScript.
Kartet var erstattet av en TEST-ONLY Leaflet-hendelses-/DOM-adapter fordi
nettilgang og nettlesernavigering var sperret i testmiljøet. Dette er ikke
full ende-til-ende-testing med det ekte Leaflet-biblioteket.
Elvegeometri, GPS og eksterne API-svar var kontrollerte testdata; bildene var
appens egne originale agnutklipp. Testadapteren følger IKKE med i programmet.

- Initial source line generates points even when all place lookups fail
- Status and right-side point list are updated
- Closed season retains planning markers
- Zoom into lower fixture still shows points
- Panning to upper fixture changes points
- No new river network request on pan/zoom
- All visible markers stay inside current bounds
- Hiding elvelinje and utgangspunkt leaves independent suggestions visible
- Point toggle clears pins
- Point toggle restores pins
- Unknown access is not mislabelled easy
- Marker click shows own lure advice and geometry caveat
- Selected point respects method filter
- Own complete photo opens in viewer
- Closing image preserves points
- Radius includes only points within base distance
- Moving off the river removes stale pins and explains empty view
- Whole-river button recovers suggestions
- Live follow moves the view and updates points
- Manual pan pauses GPS centering but updates points
- Follow-me recentres and restores correct area
- Stopping Live preserves point layer
- Resize at unchanged bounds does not replace every marker
- No JavaScript runtime errors
- Rate-limited refresh retains cached source geometry and points
- Mobile viewport still has visible points
- No horizontal page overflow on mobile
- No mobile runtime errors
- Fresh visit with unavailable river service explains missing data

## Ikke bekreftet i dette miljøet
- Ekstern NVE-/MET-/Kartverket-forbindelse og ekte bakgrunnskart.
- Render-deploy eller Docker-imagebygging. Dockerfile-oppsettet er uendret fra
  den 1.0.1-pakken som brukeren har fått startet.
- Fysisk mobil-GPS, virkelig spor under bevegelse eller bakgrunnskjøring.
- Den faktiske fiskekvaliteten ved modellpunktene.

Det nye punktmodulet har ingen ekstra npm-avhengigheter. Leaflet 1.9.4 er
fortsatt låst i package-lock.json og installeres av eksisterende Dockerfile.
