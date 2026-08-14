# Procedura Off-Market — The Brick Luxury Properties

Documento operativo interno · Modulo 3

---

## Panoramica

L'area `/off-market/` **non è indicizzata** e **non compare nella navigazione pubblica**.
L'accesso al catalogo riservato segue sempre questa sequenza:

```
Visitatore → Accordo riservatezza → Profilo lead → Revisione team → Codice accesso → Catalogo
```

---

## Flusso visitatore (4 step)

| Step | Azione visitatore | Sistema | Team The Brick |
|------|-------------------|---------|----------------|
| **1** | Legge termini di riservatezza e accetta | Blocco accesso fino ad accettazione | — |
| **2** | Compila profilo completo (nome, email, telefono, budget, timeline, ruolo, paese) | Genera ID richiesta `TB-OM-YYYYMMDD-XXXX` | — |
| **3** | Invia richiesta → schermata di conferma | Notifica via webhook / Formspree / email | Riceve lead con ID richiesta |
| **4** | Inserisce codice ricevuto via email | Verifica SHA-256 → sessione 24h | Invia codice solo se lead qualificato |

**Regola fondamentale:** il codice di accesso **non** viene mostrato automaticamente dopo il form.  
Viene comunicato **solo dopo approvazione manuale** del team.

---

## Procedura team — approvazione lead

1. **Ricezione** — Controllare notifica lead (email / webhook) con ID richiesta
2. **Qualificazione** (entro 48h lavorative):
   - Budget coerente con portfolio off-market
   - Profilo acquirente/venditore verificabile
   - Nessun conflitto di riservatezza con mandato esistente
3. **Approvazione** — Inviare email personalizzata al richiedente:
   ```
   Oggetto: The Brick — Accesso Off-Market [TB-OM-XXXXXXXX]

   Gentile [Nome],
   abbiamo approvato la sua richiesta di accesso al catalogo riservato.
   Codice di accesso: [CODICE]

   Il codice è valido per 24 ore dalla prima autenticazione.
   Area riservata: https://www.thebrick.realestate/off-market/

   Cordiali saluti,
   The Brick Luxury Properties
   ```
4. **Rifiuto** (opzionale) — Rispondere con cortesia senza codice; proporre consulenza pubblica

---

## Codice di accesso

- Codice attuale configurato in `data/off-market-config.json` (`accessHash` = SHA-256)
- In produzione: impostare GitHub Secret `OFF_MARKET_ACCESS_HASH`
- Generare nuovo codice:
  ```bash
  python3 -c "import hashlib; print(hashlib.sha256(b'NUOVO-CODICE').hexdigest())"
  ```
- Ruotare il codice periodicamente o per ogni cliente (fase futura: codici monouso)

---

## Configurazione notifiche lead

Impostare **almeno uno** dei seguenti (GitHub Secrets → deploy):

| Secret | Funzione |
|--------|----------|
| `LEAD_WEBHOOK_URL` | POST JSON a Zapier / Make / n8n / CRM |
| `LEAD_FORMSPREE_ID` | Formspree form ID (email automatica) |
| `OFF_MARKET_ACCESS_HASH` | Hash SHA-256 del codice di accesso |

Payload webhook inviato:
```json
{
  "source": "thebrick-off-market",
  "requestId": "TB-OM-20260814-A3F2",
  "status": "pending_review",
  "name": "...",
  "email": "...",
  "phone": "...",
  "role": "buyer",
  "budget": "CHF 5–10M",
  "timeline": "3–6 months",
  "submittedAt": "2026-08-14T09:00:00.000Z"
}
```

---

## Aggiornamento catalogo off-market

1. Modificare `data/crm-source.json` → `"visibility": "off_market"`
2. Eseguire `./scripts/import-fake.sh`
3. Push su `main` → deploy automatico

---

## Sicurezza — limiti sito statico

- Il codice è verificato lato client (adeguato per riservatezza commerciale, non per dati sensibili)
- Per massima protezione: aggiungere Cloudflare Access o autenticazione server-side (fase 2)
- I lead non devono mai contenere indirizzi completi degli immobili off-market nelle email automatiche

---

## Checklist attivazione

- [ ] Impostato `OFF_MARKET_ACCESS_HASH` in GitHub Secrets
- [ ] Configurato webhook o Formspree per notifiche lead
- [ ] Team formato su tempi di risposta (48h)
- [ ] Codice di accesso comunicato solo manualmente post-approvazione
- [ ] Catalogo off-market popolato via CRM / crm-source.json
