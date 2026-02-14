# Changelog

Tutte le modifiche degne di nota di questo progetto saranno documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e questo progetto aderisce semanticamente al [Versionamento Semantico](https://semver.org/lang/it/).

## [2.0.0] - 2026-02-14
### Aggiunto
- **PWA Support**: manifest.json e service worker per installazione e funzionamento offline
- **Eventi ricorrenti**: supporto per ripetizioni daily, weekly, biweekly, monthly, yearly con data di fine opzionale
- **Undo toasts**: sostituiti i dialog `confirm()` con toasts moderni con pulsante "Undo" per eventi e tag eliminati
- **Internazionalizzazione settimana**: inizio settimana automatico (Lunedì/Domenica) basato sulla locale del browser
- **ARIA grid pattern**: calendario ora implementa `role="grid"`, `role="gridcell"`, `aria-colindex`, `aria-current`
- ESLint e Prettier configurati per mantenere la qualità del codice

### Modificato
- Migliorata l'accessibilità del calendario con navigazione a griglia completa
- I toast ora supportano un parametro `onUndo` per azioni reversibili
- `getFilteredEvents` ora espande automaticamente gli eventi ricorrenti
- Calendario renderizzato con righe esplicite (`role="row"`) per pattern ARIA corretto

### Tecnico
- Aggiunto `SCHEMA_VERSION` e `SETTINGS_KEY` per future migrazioni e preferenze utente
- Aggiunto `recurrence`, `recurrenceEnd`, `recurrenceExclusions` al modello eventi
- Aggiunto `weekStartsOnMonday` allo state per preferenze localizzazione
- Nuove funzioni: `detectLocaleWeekStart()`, `loadSettings()`, `saveSettings()`, `expandRecurringEvents()`, `generateRecurrenceInstances()`, `handleDeleteRecurrenceInstance()`

## [1.0.0] - 2025-10-04
### Aggiunto
- README completo con sezione screenshot, guida ai contributi e licenza MIT.
- Guida `CONTRIBUTING.md` con workflow PR e linee guida tecniche.
- Licenza MIT in `LICENSE`.
- Screenshot segnaposto in `docs/screenshots/agenda-overview.png`.