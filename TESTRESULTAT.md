# Tester – Mistra Fiske 1.2.1

76/76 automatiske tester bestått.

Automatiske tester dekker blant annet:
- Docker/Render-layout og versjonskonsistens
- 10 beste elvepunkter, panorering, zoom og avstandsfilter
- at punkter ligger på NVE-elvelinja og ikke konstrueres på land
- automatisk VEPS/HYDRA-parsing for vannføring/vannstand
- HydAPI med hemmelig nøkkel uten eksponering
- MET-vær, sesongregler, GPS/GPX og statiske filer
- alle 18 enkeltbilder av brukerens agn
- punktspesifikk variasjon i egne wobbler-/slukanbefalinger
- minst tre kildebaserte historiske Mistra-agn, med kilde og bruksforklaring

Kjør: npm test
Kjør layout/syntakskontroll: npm run verify
