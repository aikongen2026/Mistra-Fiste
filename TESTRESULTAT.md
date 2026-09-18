# Tester – Mistra Fiske 1.2.0

Automatiske tester dekker blant annet:
- Docker/Render-layout og versjonskonsistens
- 10 beste elvepunkter, panorering, zoom og avstandsfilter
- at punkter ligger på NVE-elvelinja og ikke konstrueres på land
- automatisk VEPS/HYDRA-parsing for vannføring/vannstand
- HydAPI med hemmelig nøkkel uten eksponering
- MET-vær, sesongregler, lure-ranking og GPS/GPX
- statiske filer og alle enkeltbilder av agn

Kjør: npm test
Kjør layout/syntakskontroll: npm run verify
