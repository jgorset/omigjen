# Omigjen

Et lite øverom for musikere som lærer låter og slåtter på øret. Åpne en YouTube-video eller en lydfil, senk tempoet og spill et valgt parti om igjen.

## Starte lokalt

Bruk Node.js 22.12 eller nyere. I PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Åpne adressen som Vite skriver ut. Appen er en statisk nettside og trenger ingen database, innlogging eller API-nøkkel.

## Øve

- Trykk **Åpne en låt** for en YouTube-lenke eller en lokal lydfil. Den innebygde, syntetiske øvingsmelodien er klar ved oppstart.
- Flytt **A** og **B**, eller skriv inn start og slutt som `0:12.5`. Minste parti er 0,25 sekunder.
- **Forstørr parti** gjør korte fraser enklere å markere. **Hele låten** viser hele opptaket. Opptak over 90 sekunder åpnes med partiet forstørret.
- Endre **Tempo**. Lokale filer bruker nettleserens tonehøydebevaring. YouTube viser bare hastigheter videoen støtter, og oppdaterer tempoet når tjenesten bekrefter endringen.
- Velg et **pusterom** mellom rundene. Pause eller bytte av låt avbryter en ventende runde.
- **Lagre valgt parti** tar vare på navn, start, slutt og tempo. Velg et lagret parti for å spille det i løkke.

Mellomrom spiller eller pauser. A og B setter markører ved spilleposisjonen. L slår løkka av eller på. Piltastene spoler to sekunder. En fokusert A/B-markør flyttes 0,1 sekund med piltastene, eller ett sekund med Shift. Snarveiene overtar ikke inntasting i skjemaer eller dialoger.

## Lydkilder og lagring

Lydfiler spilles direkte fra enheten og lastes ikke opp. Bølgeformen beregnes fra selve opptaket. For filer over 80 MiB brukes en enkel tidslinje for å unngå full dekoding i minnet. Formater avhenger av nettleserens støtte; MP3 og WAV er gode utgangspunkt.

Øvepartier lagres i nettleserens localStorage, separat for hver YouTube-video og hver lokale fil. For filer brukes navn, størrelse og endringstid som nøkkel. Åpne samme fil igjen for å hente fram partiene. Filen selv lagres ikke, og data synkroniseres ikke mellom enheter. Endret fil eller slettede nettleserdata kan gi et tomt partibibliotek.

YouTube lastes først når brukeren åpner en lenke. Den synlige, offisielle spilleren håndterer videoen. Nettverk, annonser, videoeierens begrensninger og innloggingskrav kan påvirke tilgjengelighet og gjentakelser. Spotify er ikke en avspillingskilde i denne versjonen fordi den dokumenterte avspillingsintegrasjonen ikke tilbyr tempojustering.

Løkker styres ved å følge spilleposisjonen og søke tilbake. De er ikke garantert samplepresise eller uten opphold. Nettlesere kan begrense timere når en fane eller telefon er i bakgrunnen. Bruk øverommet i en aktiv fane. Mobiloppsettet er kontrollert i Chrome; avspilling på fysisk iPhone/Android er ikke verifisert.

## Bygge og kontrollere

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
npm.cmd run preview
```

Nettlesertestene bruker en installert Google Chrome og starter Vite automatisk. De kontrollerer faktisk lokal lydavspilling, tempo, tonehøydeinnstilling, løkker, pauser, kildebytte, lagring, inputvalidering, zoom og mobilbredde. YouTube-kontrakten testes med en isolert simulert spiller; dette er separat fra den manuelle kontrollen mot den virkelige tjenesten.

Manuelt kontrollert 5. oktober 2026: YouTubes offisielle eksempelvideo åpnet med riktig tittel og varighet. Appens kontroller startet og pauset videoen, bekreftet 75 prosent tempo og viste gjentatte gjennomspillinger av intervallet 0 til 8 sekunder. Dette garanterer ikke at alle videoer kan bygges inn.

`npm.cmd run build` lager `dist/`, som kan publiseres på vanlig statisk HTTPS-hosting. Appen er foreløpig bare kjørt lokalt. Start fra en webserver, ikke ved å dobbeltklikke `index.html`.

## Teknologi og kilder

TypeScript, Vite, Tailwind CSS og daisyUI. Native HTML-lyd, Canvas-bølgeform, YouTube IFrame API og Phosphor-ikoner. Ingen applikasjonsserver.

- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [HTMLMediaElement.preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/reference)

`public/ovingsmelodi.wav` er et originalt, syntetisk eksempel laget av `scripts/make-demo.mjs`. Ingen tredjepartsinnspilling er inkludert. Kjør `node scripts/make-demo.mjs` for å generere filen på nytt.
