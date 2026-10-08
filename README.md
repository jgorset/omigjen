# Omigjen

Et lite øverom for musikere som lærer låter og slåtter på øret. Hent lyd fra en YouTube-lenke eller åpne en lydfil, senk tempoet og spill et valgt parti om igjen.

## Starte lokalt

Bruk Node.js 22.12 eller nyere. I PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Åpne `http://127.0.0.1:5177/`. Utvikling og forhåndsvisning bruker samme faste adresse, slik at øvingsbiblioteket kan gjenåpnes. Hvis porten er opptatt, stopper serveren i stedet for å flytte biblioteket til en ny adresse. Appen trenger ingen innlogging, API-nøkkel eller ekstern database.

For å hente lyd fra YouTube, installer [FFmpeg](https://ffmpeg.org/download.html) i PATH og kjør én gang:

```powershell
npm.cmd run setup:downloads
```

Dette henter yt-dlp fra den offisielle GitHub-utgivelsen, kontrollerer SHA-256 og legger programmet i `.tools/`. Den samme kommandoen oppdaterer yt-dlp hvis YouTube endrer tjenesten. Node brukes av yt-dlp; ingen Python-installasjon kreves på Windows eller macOS. På Linux kreves Python 3.10 eller nyere, eller en egen yt-dlp-installasjon i PATH.

## Øve

- Trykk **Åpne en låt** for en YouTube-lenke eller en lokal lydfil. Den innebygde, syntetiske øvingsmelodien er klar ved oppstart.
- Lim inn en YouTube-lenke og velg **Hent lyd**. Første gang lastes opptaket ned som MP3; senere brukes den lagrede lyden.
- Flytt **A** og **B**, eller skriv inn start og slutt som `0:12.5`. Minste parti er 0,25 sekunder.
- **Sett A her** og **Sett B her** følger spilleposisjonen. Ligger den utenfor det gamle partiet, flyttes den andre grensen ved behov, slik at du kan velge en ny frase senere eller tidligere i opptaket.
- **Forstørr parti** gjør korte fraser enklere å markere. **Hele låten** viser hele opptaket. Opptak over 90 sekunder åpnes med partiet forstørret.
- **Zoom inn** og **Zoom ut** endrer lydbildet trinnvis med en myk overgang. **Flytt visning** navigerer i et forstørret opptak. Zoom og navigasjon endrer ikke A/B-grensene eller avspillingsposisjonen. Redusert bevegelse i systeminnstillingene gir øyeblikkelig zoom.
- Endre **Tempo**. All lyd spilles lokalt med nettleserens tonehøydebevaring, fra 25 til 200 prosent tempo.
- Velg et **pusterom** mellom rundene. Pause eller bytte av låt avbryter en ventende runde.
- **Lagre valgt parti** tar vare på navn, start, slutt og tempo. Velg et lagret parti for å spille det i løkke.
- **Lagre økt** lagrer lydfilen sammen med øvepartier, A/B-grenser, tempo, pusterom, volum, avspillingsposisjon og zoom. **Mine økter** åpner biblioteket; en økt gjenåpnes pauset og trenger ikke den opprinnelige lydfilen eller YouTube-lenken. Etter gjenåpning oppdaterer **Lagre økt** samme økt. **Last ned lydfil** gir en separat kopi av lyden.

Mellomrom spiller eller pauser, også etter et klikk på en tempoknapp. A og B setter markører ved spilleposisjonen. L slår løkka av eller på. Piltastene spoler to sekunder. En fokusert A/B-markør flyttes 0,1 sekund med piltastene, eller ett sekund med Shift. Slidere beholder vanlig piltaststyring, og mellomrom veksler en fokusert avkrysningsboks. Snarveiene overtar ikke tekstinntasting eller dialoger.

## Lydkilder og lagring

Lydfiler spilles direkte fra enheten og lastes ikke opp. Bølgeformen beregnes fra selve opptaket. For filer over 80 MiB brukes en enkel tidslinje for å unngå full dekoding i minnet. Formater avhenger av nettleserens støtte; MP3 og WAV er gode utgangspunkt.

Øvepartier lagres i nettleserens localStorage, separat for hver YouTube-video og hver lokale fil. For filer brukes navn, størrelse og endringstid som nøkkel. Åpne samme fil igjen for å hente fram partiene. Filen selv lagres ikke, og data synkroniseres ikke mellom enheter. Endret fil eller slettede nettleserdata kan gi et tomt partibibliotek.

Når du velger **Lagre økt**, lagres også selve lydfilen i nettleserens IndexedDB. Dette virker for lokal lyd, demoen og hentet YouTube-lyd. Økter tilhører nettleseren og nettadressen, inkludert porten, og synkroniseres ikke. Bruk samme adresse når du kommer tilbake; private nettleservinduer og sletting av nettleserdata kan fjerne biblioteket. Appen ber nettleseren beholde lagringen, men varig lagring avhenger av nettleseren. Last ned en separat lydkopi hvis du vil beholde den utenfor appen. En lagringsfeil beholder en tidligere lagret økt og lar deg prøve igjen.

**Hent lyd** bruker en lokal hjelpefunksjon i Vite-serveren og yt-dlp uten nettleserens innlogging eller informasjonskapsler. MP3 og tittel lagres i `.cache/youtube/`, som er utelatt fra Git. Åpne samme lenke igjen for å bruke den lagrede lyden, også uten nett. Tempo, tonehøydebevaring, bølgeform og løkker bruker den samme spilleren som lokale filer. Tidligere lagrede øvepartier for samme YouTube-ID beholdes. Slett `.cache/youtube/` manuelt hvis du vil frigjøre plass.

Hjelpefunksjonen er bare tilgjengelig på localhost gjennom `npm.cmd run dev` eller `npm.cmd run preview`. Den henter én låt om gangen og støtter offentlige opptak på opptil to timer og 200 MiB. Private videoer, innloggingskrav og direktesendinger støttes ikke. Ved **Avbryt**, lukking av dialogen eller kildebytte avbrytes innlasting i appen; serveren kan fullføre nedlastingen og beholde lyden til neste forsøk. En mislykket nedlasting publiseres ikke som en ferdig lydfil.

Spotify er ikke en avspillingskilde fordi den dokumenterte avspillingsintegrasjonen ikke tilbyr tempojustering.

Løkker styres ved å følge spilleposisjonen og søke tilbake. De er ikke garantert samplepresise eller uten opphold. Nettlesere kan begrense timere når en fane eller telefon er i bakgrunnen. Bruk øverommet i en aktiv fane. Mobiloppsettet er kontrollert i Chrome; avspilling på fysisk iPhone/Android er ikke verifisert.

## Bygge og kontrollere

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
npm.cmd run preview
```

Nettlesertestene bruker en installert Google Chrome og starter Vite automatisk. De kontrollerer faktisk lokal lydavspilling, tempo, tonehøydeinnstilling, løkker, pauser, kildebytte, økter med lagret lyd, inputvalidering, animert zoom og mobilbredde. Nedlastingsflyten testes med et simulert API og virkelig testlyd, inkludert feil, nytt forsøk og avbrytelse. API-testene kontrollerer validering, lokal tilgang, lagrede opptak og byte-ranges.

Manuelt kontrollert 8. oktober 2026: lyden fra YouTubes offisielle eksempelvideo ble hentet, åpnet med riktig tittel og varighet, spilt lokalt i 75 prosent tempo og gjentatt i løkke. En økt med den hentede lyden ble lagret og gjenåpnet etter ny sidelasting. Enkelte videoer kan fortsatt være utilgjengelige for yt-dlp.

`npm.cmd run build` lager `dist/`, som kan publiseres på vanlig statisk HTTPS-hosting med lokale filer og lagrede økter. YouTube-lydhenting trenger den lokale Vite-serveren og følger ikke med i statisk hosting. Appen er foreløpig bare kjørt lokalt. Start fra en webserver, ikke ved å dobbeltklikke `index.html`.

## Teknologi og kilder

TypeScript, Vite, Tailwind CSS og daisyUI. Native HTML-lyd, Canvas-bølgeform, IndexedDB og Phosphor-ikoner. Lokal Vite-hjelpefunksjon med yt-dlp og FFmpeg for lydhenting.

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) og [Node-oppsett](https://github.com/yt-dlp/yt-dlp/wiki/EJS)
- [HTMLMediaElement.preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/reference)

`public/ovingsmelodi.wav` er et originalt, syntetisk eksempel laget av `scripts/make-demo.mjs`. Ingen tredjepartsinnspilling er inkludert. Kjør `node scripts/make-demo.mjs` for å generere filen på nytt.
