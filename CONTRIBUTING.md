# Guida ai contributi

Grazie per il tuo interesse nel contribuire all'Agenda App! Questo documento descrive come proporre modifiche, segnalare bug e collaborare al progetto.

## Codice di condotta
Mantieni sempre un comportamento professionale e rispettoso. Usa un linguaggio inclusivo e ricorda che dietro ogni contributo c'è una persona. Se noti comportamenti inappropriati, segnala il problema aprendo una issue.

## Come posso aiutare?
1. **Segnala un bug** – Apri una issue descrivendo contesto, passi per riprodurre e comportamento atteso.
2. **Proponi una funzionalità** – Condividi la tua idea tramite issue; indica il problema che risolve e l'impatto sull'utente.
3. **Invia una pull request** – Prima di iniziare lavori più corposi, apri una issue o commenta quella esistente per evitare duplicazioni.

## Preparazione ambiente
- Clona il repository e apri `index.html` nel browser oppure avvia un server statico locale.
- Assicurati di testare le modifiche sia su desktop sia su mobile (responsive design).
- Mantieni il codice JavaScript e CSS in stile con quello esistente (niente framework aggiuntivi salvo accordi).

## Workflow pull request
1. Crea un branch descrittivo (es. `feature/tag-filter-ui` o `fix/calendar-offset`).
2. Effettua commit chiari e concisi; usa l'imperativo nel messaggio breve (es. `Add week overview empty state`).
3. Allega screenshot o GIF se la modifica è visibile all'utente.
4. Aggiorna la documentazione (README, commenti, changelog) quando necessario.
5. Compila la checklist PR (se fornita) e richiedi una revisione.

## Linee guida coding
- Preferisci funzioni pure e riutilizzabili; evita duplicazioni.
- Aggiungi commenti brevi solo dove la logica non è immediata.
- Mantieni l'accessibilità: usa `aria-*`, gestisci focus e supporto da tastiera dove rilevante.
- Non includere file generati o asset voluminosi senza discuterne prima.

## Test
- Verifica che aggiunta/modifica/cancellazione eventi funzioni in agenda, calendario e lista settimanale.
- Controlla che il salvataggio `localStorage` persista dati dopo refresh.
- Testa i filtri di ricerca e tag per assicurarti che gli eventi siano coerenti.

Grazie ancora per il tuo contributo! Ogni miglioria rende l'app più utile per tutti.
