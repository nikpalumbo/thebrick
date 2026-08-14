/* Modulo 3 — Off-Market: procedura di accesso controllata */

const OFFMARKET_DATA_URL = '../data/off-market.json';
const OFFMARKET_CONFIG_URL = '../data/off-market-config.json';
const SESSION_KEY = 'tb-offmarket-access';
const LEAD_KEY = 'tb-offmarket-lead';

const STEPS = [
  { id: 1, label: 'Riservatezza' },
  { id: 2, label: 'Profilo' },
  { id: 3, label: 'Conferma' },
  { id: 4, label: 'Accesso' },
];

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRequestId() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TB-OM-${date}-${rand}`;
}

async function loadOffMarketConfig() {
  const res = await fetch(OFFMARKET_CONFIG_URL);
  if (!res.ok) throw new Error('Config unavailable');
  return res.json();
}

function getStoredAccess() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() > data.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function getStoredLead() {
  try {
    return JSON.parse(sessionStorage.getItem(LEAD_KEY) || 'null');
  } catch {
    return null;
  }
}

function grantAccess(hours = 24, requestId = '') {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    grantedAt: Date.now(),
    expiresAt: Date.now() + hours * 60 * 60 * 1000,
    requestId,
  }));
}

function renderStepIndicator(currentStep) {
  return `
    <ol class="offmarket-progress" aria-label="Procedura di accesso">
      ${STEPS.map(s => `
        <li class="offmarket-progress-item ${s.id === currentStep ? 'is-active' : ''} ${s.id < currentStep ? 'is-done' : ''}">
          <span class="offmarket-progress-num">${s.id}</span>
          <span class="offmarket-progress-label">${s.label}</span>
        </li>
      `).join('')}
    </ol>
  `;
}

async function notifyTeam(lead, config) {
  const payload = {
    source: 'thebrick-off-market',
    requestId: lead.requestId,
    status: 'pending_review',
    ...lead,
    submittedAt: new Date().toISOString(),
  };

  const tasks = [];

  if (config.leadWebhookUrl) {
    tasks.push(
      fetch(config.leadWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null)
    );
  }

  if (config.formspreeFormId) {
    tasks.push(
      fetch(`https://formspree.io/f/${config.formspreeFormId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `[Off-Market] Nuova richiesta ${lead.requestId}`,
          ...payload,
        }),
      }).catch(() => null)
    );
  }

  if (config.notifyEmail && !config.leadWebhookUrl && !config.formspreeFormId) {
    const body = [
      `Richiesta Off-Market — ${lead.requestId}`,
      '',
      `Nome: ${lead.name}`,
      `Email: ${lead.email}`,
      `Telefono: ${lead.phone}`,
      `Ruolo: ${lead.role}`,
      `Paese: ${lead.country}`,
      `Budget: ${lead.budget}`,
      `Timeline: ${lead.timeline}`,
      `Interesse: ${lead.interest}`,
      `Finanziamento: ${lead.financing}`,
      `Note: ${lead.message || '—'}`,
      '',
      `Inviato: ${payload.submittedAt}`,
    ].join('\n');
    const mailto = `mailto:${encodeURIComponent(config.notifyEmail)}?subject=${encodeURIComponent(`[Off-Market] ${lead.requestId} — ${lead.name}`)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
  }

  await Promise.all(tasks);
}

function renderGate(root, config, onUnlocked) {
  const existingLead = getStoredLead();
  const startStep = existingLead?.status === 'submitted' ? 3 : 1;
  let currentStep = startStep;

  function showStep(step) {
    currentStep = step;
    root.querySelectorAll('[data-panel]').forEach(el => {
      el.hidden = Number(el.dataset.panel) !== step;
    });
    const progress = root.querySelector('.offmarket-progress');
    if (progress) {
      progress.outerHTML = renderStepIndicator(step);
    }
    root.querySelector('.offmarket-gate-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  root.innerHTML = `
    <div class="offmarket-gate">
      <div class="offmarket-gate-card">
        <span class="eyebrow">Confidenziale · Non indicizzato</span>
        <h1>Area Off-Market</h1>
        <p class="offmarket-intro">Catalogo riservato a clienti qualificati. Ogni richiesta viene esaminata personalmente dal team The Brick prima dell'accesso.</p>

        ${renderStepIndicator(currentStep)}

        <!-- STEP 1 — Riservatezza -->
        <div class="offmarket-step" data-panel="1" ${currentStep !== 1 ? 'hidden' : ''}>
          <h2>Accordo di riservatezza</h2>
          <div class="offmarket-terms">
            <p>Accedendo a quest'area, l'utente si impegna a:</p>
            <ul>
              <li>Non divulgare indirizzi, immagini o prezzi delle proprietà off-market a terzi</li>
              <li>Non utilizzare i contenuti per scopi commerciali o di intermediazione non autorizzata</li>
              <li>Contattare The Brick esclusivamente per acquisto o vendita personale qualificata</li>
              <li>Rispettare la riservatezza richiesta dai proprietari e dai mandati in corso</li>
            </ul>
            <p class="offmarket-terms-note">The Brick si riserva il diritto di revocare l'accesso in qualsiasi momento.</p>
          </div>
          <label class="offmarket-checkbox">
            <input type="checkbox" id="om-nda" required>
            <span>Ho letto e accetto l'accordo di riservatezza</span>
          </label>
          <button type="button" class="btn" id="om-to-step2" style="width:100%;margin-top:1.25rem">Continua — Compila il profilo</button>
        </div>

        <!-- STEP 2 — Profilo lead -->
        <div class="offmarket-step" data-panel="2" ${currentStep !== 2 ? 'hidden' : ''}>
          <h2>Profilo acquirente</h2>
          <p class="offmarket-step-note">Informazioni necessarie per valutare la richiesta. Tutti i campi contrassegnati sono obbligatori.</p>
          <form class="contact-form" id="offmarket-lead-form">
            <label for="om-name">Nome e cognome *</label>
            <input id="om-name" name="name" type="text" required placeholder="Nome completo" autocomplete="name">

            <label for="om-email">Email *</label>
            <input id="om-email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">

            <label for="om-phone">Telefono *</label>
            <input id="om-phone" name="phone" type="tel" required placeholder="+41 79 000 00 00" autocomplete="tel">

            <label for="om-role">Sono *</label>
            <select id="om-role" name="role" required>
              <option value="">Seleziona…</option>
              <option value="buyer">Acquirente privato</option>
              <option value="seller">Venditore privato</option>
              <option value="advisor">Consulente / family office</option>
              <option value="agent">Agente immobiliare (con mandato)</option>
            </select>

            <label for="om-country">Paese di residenza *</label>
            <input id="om-country" name="country" type="text" required placeholder="Svizzera, Italia, …">

            <label for="om-budget">Budget indicativo *</label>
            <select id="om-budget" name="budget" required>
              <option value="">Seleziona…</option>
              <option value="CHF 2–5M">CHF 2–5M</option>
              <option value="CHF 5–10M">CHF 5–10M</option>
              <option value="CHF 10M+">CHF 10M+</option>
              <option value="Undisclosed">Riservato</option>
            </select>

            <label for="om-timeline">Timeline *</label>
            <select id="om-timeline" name="timeline" required>
              <option value="">Seleziona…</option>
              <option value="Within 3 months">Entro 3 mesi</option>
              <option value="3–6 months">3–6 mesi</option>
              <option value="6–12 months">6–12 mesi</option>
              <option value="Exploring only">In esplorazione</option>
            </select>

            <label for="om-interest">Tipo di immobile *</label>
            <select id="om-interest" name="interest" required>
              <option value="">Seleziona…</option>
              <option value="Lakefront villa">Villa fronte lago</option>
              <option value="Penthouse / apartment">Attico / appartamento</option>
              <option value="Investment property">Immobile d'investimento</option>
              <option value="Other prestige residence">Altra residenza di prestigio</option>
            </select>

            <label for="om-financing">Finanziamento *</label>
            <select id="om-financing" name="financing" required>
              <option value="">Seleziona…</option>
              <option value="Cash">Liquidità disponibile</option>
              <option value="Pre-approved mortgage">Mutuo pre-approvato</option>
              <option value="To be arranged">Da definire</option>
            </select>

            <label for="om-message">Requisiti aggiuntivi</label>
            <textarea id="om-message" name="message" placeholder="Località preferite, caratteristiche essenziali…"></textarea>

            <label class="offmarket-checkbox">
              <input type="checkbox" id="om-privacy" required>
              <span>Acconsento al trattamento dei dati per la valutazione di questa richiesta *</span>
            </label>

            <button class="btn" type="submit" style="width:100%">Invia richiesta di accesso</button>
          </form>
        </div>

        <!-- STEP 3 — Conferma -->
        <div class="offmarket-step" data-panel="3" ${currentStep !== 3 ? 'hidden' : ''}>
          <div class="offmarket-confirm">
            <div class="offmarket-confirm-icon" aria-hidden="true">✓</div>
            <h2>Richiesta inviata</h2>
            <p class="offmarket-request-id">ID richiesta: <strong id="om-request-id">${existingLead?.requestId || '—'}</strong></p>
            <p>Il team The Brick valuterà il profilo entro <strong>${config.reviewHours || 48} ore lavorative</strong>.</p>
            <p>Se approvata, riceverà un <strong>codice di accesso personale</strong> via email.</p>
            <div class="offmarket-confirm-box">
              <p><strong>Prossimi passi</strong></p>
              <ol>
                <li>Revisione profilo da parte di The Brick</li>
                <li>Email con codice di accesso (solo se approvato)</li>
                <li>Inserimento codice → catalogo riservato</li>
              </ol>
            </div>
            <button type="button" class="btn" id="om-to-step4" style="width:100%">Ho già ricevuto il codice</button>
            <p class="offmarket-alt"><a href="../contact.html">Contattaci direttamente →</a></p>
          </div>
        </div>

        <!-- STEP 4 — Codice accesso -->
        <div class="offmarket-step" data-panel="4" ${currentStep !== 4 ? 'hidden' : ''}>
          <h2>Inserisci codice di accesso</h2>
          <p class="offmarket-step-note">${config.accessCodeHint || 'Inserisca il codice ricevuto via email dopo l\'approvazione.'}</p>
          <form class="contact-form" id="offmarket-access-form">
            <label for="om-code">Codice di accesso</label>
            <input id="om-code" name="code" type="password" required placeholder="Codice personale" autocomplete="off">
            <p class="form-error" id="om-error" hidden>Codice non valido. Verifichi l'email ricevuta o contatti <a href="mailto:info@thebrick.realestate">info@thebrick.realestate</a>.</p>
            <button class="btn" type="submit" style="width:100%">Accedi al catalogo riservato</button>
          </form>
          <p class="offmarket-alt"><button type="button" class="offmarket-link-btn" id="om-back-step3">← Torna alla conferma richiesta</button></p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('om-to-step2')?.addEventListener('click', () => {
    const nda = document.getElementById('om-nda');
    if (!nda?.checked) {
      nda?.focus();
      return;
    }
    showStep(2);
  });

  document.getElementById('offmarket-lead-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Invio in corso…';

    const fd = new FormData(e.target);
    const lead = {
      requestId: generateRequestId(),
      status: 'submitted',
      ...Object.fromEntries(fd.entries()),
      ndaAccepted: true,
      submittedAt: Date.now(),
    };

    sessionStorage.setItem(LEAD_KEY, JSON.stringify(lead));

    try {
      await notifyTeam(lead, config);
    } catch {
      /* procedura continua anche se notifica fallisce */
    }

    document.getElementById('om-request-id').textContent = lead.requestId;
    showStep(3);
  });

  document.getElementById('om-to-step4')?.addEventListener('click', () => showStep(4));
  document.getElementById('om-back-step3')?.addEventListener('click', () => showStep(3));

  document.getElementById('offmarket-access-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const code = new FormData(e.target).get('code');
    const hash = await sha256(String(code));
    const err = document.getElementById('om-error');
    if (hash !== config.accessHash) {
      err.hidden = false;
      return;
    }
    err.hidden = true;
    const lead = getStoredLead();
    grantAccess(config.sessionHours || 24, lead?.requestId || '');
    onUnlocked();
  });
}

async function loadOffMarketProperties() {
  const res = await fetch(OFFMARKET_DATA_URL);
  if (!res.ok) throw new Error('Failed to load off-market properties');
  return res.json();
}

function renderOffMarketCard(p) {
  const img = p.image.startsWith('http') ? p.image : `../${p.image}`;
  return `
    <a class="property-card" href="detail.html?id=${p.id}">
      <div class="property-card-image">
        <span class="property-badge">Off-Market</span>
        <img src="${img}" alt="${p.title}" loading="lazy">
      </div>
      <div class="property-card-body">
        <h3>${p.title}</h3>
        <p class="property-meta">${p.location} · ${p.rooms} rooms · ${p.area}</p>
        <p class="property-price">${p.priceLabel}</p>
      </div>
    </a>`;
}

function renderOffMarketCatalog(root, config) {
  const access = getStoredAccess();
  const expires = access ? new Date(access.expiresAt).toLocaleString('it-CH') : '';

  root.innerHTML = `
    <div class="offmarket-catalog">
      <div class="offmarket-confidential-banner">
        ⚠ Contenuto confidenziale — divieto di divulgazione. Sessione valida fino al ${expires}.
      </div>
      <div class="offmarket-catalog-head">
        <div>
          <span class="eyebrow">Catalogo riservato</span>
          <h1>Proprietà Off-Market</h1>
          <p>Elenco non pubblico. Per visite o proposte contatti direttamente The Brick.</p>
        </div>
        <button type="button" class="btn btn-outline btn-sm" data-offmarket-logout>Termina sessione</button>
      </div>
      <div id="offmarket-grid" class="properties-grid view-grid"></div>
    </div>
  `;

  document.querySelector('[data-offmarket-logout]')?.addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    initOffMarketArea();
  });

  loadOffMarketProperties().then(items => {
    const grid = document.getElementById('offmarket-grid');
    if (!items.length) {
      grid.innerHTML = '<p class="no-results">Nessun immobile off-market al momento. Contattaci per opportunità in arrivo.</p>';
      return;
    }
    grid.innerHTML = items.map(renderOffMarketCard).join('');
  }).catch(() => {
    document.getElementById('offmarket-grid').innerHTML =
      '<p class="no-results">Impossibile caricare il catalogo.</p>';
  });
}

async function initOffMarketArea() {
  const root = document.getElementById('offmarket-root');
  if (!root) return;

  try {
    const config = await loadOffMarketConfig();

    if (getStoredAccess()) {
      renderOffMarketCatalog(root, config);
      return;
    }

    renderGate(root, config, () => renderOffMarketCatalog(root, config));
  } catch {
    root.innerHTML = '<p class="no-results">Area Off-Market non disponibile.</p>';
  }
}

async function initOffMarketDetail() {
  const root = document.getElementById('offmarket-detail-root');
  if (!root) return;

  if (!getStoredAccess()) {
    window.location.replace('index.html');
    return;
  }

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    root.innerHTML = '<p class="no-results">Immobile non trovato. <a href="index.html">Torna al catalogo</a></p>';
    return;
  }

  loadOffMarketProperties().then(all => {
    const p = all.find(x => x.id === id);
    if (!p) {
      root.innerHTML = '<p class="no-results">Immobile non trovato. <a href="index.html">Torna al catalogo</a></p>';
      return;
    }

    document.title = `${p.title} — Off-Market · The Brick`;
    const imgs = (p.images || [p.image]).map(src => src.startsWith('http') ? src : `../${src}`);
    const features = Object.entries(p.features || {})
      .map(([k, v]) => `<div class="feature"><strong>${k}</strong>${v}</div>`).join('');
    const thumbs = imgs.slice(1, 3).map((src, i) =>
      `<div class="property-gallery-thumb"><img src="${src}" alt="Photo ${i + 2}"></div>`).join('');

    root.innerHTML = `
      <div class="offmarket-confidential-banner">⚠ Confidenziale — vietata la divulgazione di indirizzo, prezzo e immagini</div>
      <nav class="breadcrumb"><a href="../index.html">Home</a> · <a href="index.html">Off-Market</a> · ${p.title}</nav>
      <div class="property-gallery">
        <div class="property-gallery-main"><img src="${imgs[0]}" alt="${p.title}"></div>
        ${thumbs}
      </div>
      <div class="property-detail-grid">
        <div>
          <span class="property-badge" style="position:static;display:inline-block;margin-bottom:1rem">Off-Market</span>
          <h1>${p.title}</h1>
          <p class="location">${p.location}</p>
          <p class="price">${p.priceLabel}</p>
          <p>${p.description}</p>
          <div class="features">${features}</div>
        </div>
        <aside class="sidebar-box">
          <h3>Richiesta confidenziale</h3>
          <p style="font-size:0.9rem;color:var(--muted);margin-bottom:1rem">Per una visita privata contatti The Brick direttamente.</p>
          <a class="btn" href="mailto:Helen@thebrick.realestate?subject=${encodeURIComponent(`Off-Market: ${p.title}`)}" style="width:100%">Contatta The Brick</a>
          <p style="margin-top:1rem;font-size:0.85rem"><a href="index.html">← Torna al catalogo riservato</a></p>
        </aside>
      </div>
    `;
  });
}
