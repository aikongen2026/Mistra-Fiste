# Mistra Fiske 1.2.1 – sømløs kartmodus

Mistra-spisset fiskeapp bygget videre på kart/Live-mønsteret fra Fiste REV27.

## Nytt i 1.2.1
- De 10 beste kartberegnede elvepunktene vises automatisk i det synlige kartutsnittet.
- Punktene oppdateres automatisk ved panorering og zoom. Ingen Elvepunkter-knapp.
- Klikk et punkt: anbefalt sluk og fiskeråd vises umiddelbart øverst i høyrekolonnen.
- Utgangspunkt-funksjonen og landbaserte prioriteringsmarkører er fjernet fra synlig UI.
- Klikk hvor som helst på kartet for å flytte avstandsreferansen. Live GPS brukes som referanse mens Live kjører.
- Høyrekolonnen er ryddet i nedtrekkbare seksjoner. Kunnskapsgrunnlag/kildeliste er ikke lenger en egen synlig seksjon.
- Vannføring og vannstand fra NVE-stasjon 2.267.0 Mistra bru hentes automatisk én gang ved oppstart.
- Uten NVE_API_KEY forsøker serveren offisiell NVE VEPS/HYDRA. Har du HydAPI-nøkkel, brukes den først med VEPS som fallback.
- Førstevalg og alternativer fra brukerens slukboks rangeres med Mistra-reglene i modellen.

## Render / Docker
Dockerfile ligger i repo-roten og er kompatibel med eksisterende Docker Web Service på Render.
Last opp innholdet i denne mappen til samme GitHub-repo og la Render deploye siste commit.

## Viktig
Elvepunktene ligger på NVEs digitale elvelinje. De er modellforslag til steder å undersøke, ikke dokumenterte fiskehøler, trygg vadedybde eller fiskekortgrenser.
