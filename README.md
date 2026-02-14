# Agenda App

Applicazione web single-page per pianificare eventi quotidiani, visualizzarli in un'agenda filtrabile e mantenere il controllo del calendario settimanale e mensile. Tutto è salvato in locale, senza dipendenze da backend, così da poter usare il tool offline o integrarlo in un progetto esistente.

## Screenshot
![Schermata iniziale dell'agenda](screenshots/home1.png "Vista generale con agenda, calendario e drawer tag")
![Gestione dettagli evento](screenshots/home2.png "Modifica di un evento con tag e note personalizzate")

## Funzionalità principali
- Creazione e modifica di eventi con data, fascia oraria, luogo, note e tag colorati
- **Eventi ricorrenti**: supporto per ripetizioni giornaliere, settimanali, bisettimanali, mensili e annuali
- Vista agenda ordinata e filtro testuale per trovare rapidamente un'attività
- Widget "This Week" per avere sempre sotto controllo gli impegni a breve termine
- Calendario mensile interattivo con badge numerici e modale di dettaglio per ciascun giorno
- Gestione avanzata dei tag (creazione, assegnazione, cancellazione) con colori personalizzati
- Persistenza automatica su `localStorage` per eventi, filtri e tag
- Notifiche toast contestuali con supporto **Undo** per azioni distruttive
- Supporto da tastiera (ESC per chiudere modali, navigazione a griglia con frecce)
- **PWA**: installabile come app standalone, funziona offline
- **Internazionalizzazione**: inizio settimana automatico in base alla locale (Lunedì/Domenica)
- **Accessibilità**: ARIA grid pattern completo per il calendario

## Stack e dipendenze
- HTML5 semantico per struttura e accessibilità
- CSS3 moderno (layout responsive a griglia, color-scheme light/dark)
- JavaScript vanilla per logica, gestione stato e interazione con `localStorage`

## Avvio rapido
1. Clona o scarica questo repository sul tuo computer.
2. Apri `index.html` direttamente nel browser **oppure** avvia un semplice server statico:
   - `python -m http.server 8000`
   - `npx serve .`
3. Visita l'indirizzo locale indicato (ad es. `http://localhost:8000`) per utilizzare l'app.

## Struttura del progetto
- `index.html` – layout principale con form agenda, calendario, drawer tag e modale giornaliera
- `styles.css` – stile responsive con grid layout, badge, toast e drawer animato
- `app.js` – state management, rendering dinamico, filtri, gestione tag, salvataggio dati
- `manifest.json` – PWA manifest per installazione
- `sw.js` – service worker per funzionalità offline
- `package.json` – configurazione npm con script per lint e format

## Dettagli implementativi
- Gli eventi sono memorizzati con chiavi `agenda-events`, `agenda-tags`, `agenda-filters` e `agenda-settings` su `localStorage`
- Le funzioni di rendering aggiornano agenda, calendario e vista settimanale in modo coerente
- Il drawer per i tag utilizza overlay e controlli ARIA (`aria-hidden`, `aria-live`) per migliorare accessibilità
- I badge numerici nel calendario aprono un modale con focus gestito e ritorno al giorno di origine
- Il calendario implementa il pattern ARIA grid con `role="grid"`, `role="gridcell"` e `aria-colindex`
- Gli eventi ricorrenti vengono espansi dinamicamente con supporto per esclusioni di singole istanze

## Personalizzazione
- Modifica `DEFAULT_TAG_COLOR` in `app.js` per cambiare il colore predefinito dei tag
- Aggiorna le variabili CSS in `styles.css` per adattare palette e tipografia
- Estendi `renderAgenda` o `renderUpcomingWeek` per integrare nuove viste (es. esportazione, stampa)

## Script di sviluppo
```bash
npm run lint        # Controlla errori di linting
npm run lint:fix    # Corregge automaticamente errori di linting
npm run format      # Formatta il codice con Prettier
npm run format:check # Verifica formattazione
```

## Roadmap suggerita
- Sincronizzazione opzionale con backend o servizi di calendario esterni
- Supporto drag & drop per spostare eventi
- Esportazione in CSV/ICS e condivisione
- Tema scuro/chiaro gestibile dall'interfaccia utente

## Changelog
Consulta [`CHANGELOG.md`](CHANGELOG.md) per lo storico dettagliato delle versioni.

## Contributi
Le linee guida per bug report, proposte e pull request sono descritte in [`CONTRIBUTING.md`](CONTRIBUTING.md). Se stai iniziando, controlla prima la sezione *Come posso aiutare?* e apri una issue per coordinare il lavoro.

## Licenza
Questo progetto è distribuito nel rispetto della licenza [MIT](LICENSE).