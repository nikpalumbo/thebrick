/* Modulo 3 — Off-Market: procedura di accesso controllata */

const OFFMARKET_DATA_URL = '../data/off-market.json';
const OFFMARKET_CONFIG_URL = '../data/off-market-config.json';
const SESSION_KEY = 'tb-offmarket-access';
const LEAD_KEY = 'tb-offmarket-lead';

const STEPS = [
  { id: 1, label: 'Agreement' },
  { id: 2, label: 'Profile' },
  { id: 3, label: 'Review' },
  { id: 4, label: 'Access' },
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
  const urlParams = new URLSearchParams(window.location.search);
  let startStep = existingLead?.status === 'submitted' ? 3 : 1;
  if (urlParams.get('step') === '4' || window.location.hash === '#access') startStep = 4;
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
    root.querySelector('.offmarket-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  root.innerHTML = `
    <div class="offmarket-layout">
      <aside class="offmarket-aside">
        <h2>Access by qualification</h2>
        <p>Every request is reviewed personally by The Brick. Approved clients receive a private access code within ${config.reviewHours || 48} hours.</p>
        <ul class="offmarket-aside-list">
          <li><strong>40+</strong> off-market opportunities</li>
          <li><strong>100%</strong> confidential listings</li>
          <li><strong>Not indexed</strong> on search engines</li>
          <li><strong>Direct</strong> advisor contact</li>
        </ul>
        <p class="offmarket-aside-note">Already approved? Use the access code step to unlock the catalogue.</p>
      </aside>

      <div class="offmarket-panel">
        ${renderStepIndicator(currentStep)}

        <div class="offmarket-step" data-panel="1" ${currentStep !== 1 ? 'hidden' : ''}>
          <h3 class="offmarket-panel-title">Confidentiality agreement</h3>
          <div class="offmarket-terms">
            <p>By proceeding, you agree to:</p>
            <ul>
              <li>Keep all property details, addresses, and pricing strictly confidential</li>
              <li>Not share content with third parties or use it for unauthorised brokerage</li>
              <li>Contact The Brick only for qualified personal purchase or sale</li>
              <li>Respect owner privacy and active mandates at all times</li>
            </ul>
          </div>
          <label class="offmarket-checkbox">
            <input type="checkbox" id="om-nda" required>
            <span>I have read and accept the confidentiality agreement</span>
          </label>
          <button type="button" class="btn" id="om-to-step2">Continue — Complete profile</button>
        </div>

        <div class="offmarket-step" data-panel="2" ${currentStep !== 2 ? 'hidden' : ''}>
          <h3 class="offmarket-panel-title">Buyer profile</h3>
          <p class="offmarket-step-note">Required for qualification. Fields marked * are mandatory.</p>
          <form class="contact-form offmarket-form" id="offmarket-lead-form">
            <div class="offmarket-form-row">
              <div>
                <label for="om-name">Full name *</label>
                <input id="om-name" name="name" type="text" required autocomplete="name">
              </div>
              <div>
                <label for="om-email">Email *</label>
                <input id="om-email" name="email" type="email" required autocomplete="email">
              </div>
            </div>
            <div class="offmarket-form-row">
              <div>
                <label for="om-phone">Phone *</label>
                <input id="om-phone" name="phone" type="tel" required autocomplete="tel">
              </div>
              <div>
                <label for="om-country">Country of residence *</label>
                <input id="om-country" name="country" type="text" required>
              </div>
            </div>
            <label for="om-role">I am *</label>
            <select id="om-role" name="role" required>
              <option value="">Select…</option>
              <option value="buyer">Private buyer</option>
              <option value="seller">Private seller</option>
              <option value="advisor">Advisor / family office</option>
              <option value="agent">Licensed agent</option>
            </select>
            <div class="offmarket-form-row">
              <div>
                <label for="om-budget">Budget *</label>
                <select id="om-budget" name="budget" required>
                  <option value="">Select…</option>
                  <option value="CHF 2–5M">CHF 2–5M</option>
                  <option value="CHF 5–10M">CHF 5–10M</option>
                  <option value="CHF 10M+">CHF 10M+</option>
                  <option value="Undisclosed">Undisclosed</option>
                </select>
              </div>
              <div>
                <label for="om-timeline">Timeline *</label>
                <select id="om-timeline" name="timeline" required>
                  <option value="">Select…</option>
                  <option value="Within 3 months">Within 3 months</option>
                  <option value="3–6 months">3–6 months</option>
                  <option value="6–12 months">6–12 months</option>
                  <option value="Exploring only">Exploring</option>
                </select>
              </div>
            </div>
            <div class="offmarket-form-row">
              <div>
                <label for="om-interest">Property type *</label>
                <select id="om-interest" name="interest" required>
                  <option value="">Select…</option>
                  <option value="Lakefront villa">Lakefront villa</option>
                  <option value="Penthouse / apartment">Penthouse / apartment</option>
                  <option value="Investment property">Investment</option>
                  <option value="Other prestige residence">Other prestige</option>
                </select>
              </div>
              <div>
                <label for="om-financing">Financing *</label>
                <select id="om-financing" name="financing" required>
                  <option value="">Select…</option>
                  <option value="Cash">Cash ready</option>
                  <option value="Pre-approved mortgage">Pre-approved mortgage</option>
                  <option value="To be arranged">To be arranged</option>
                </select>
              </div>
            </div>
            <label for="om-message">Additional requirements</label>
            <textarea id="om-message" name="message" rows="3" placeholder="Preferred locations, must-have features…"></textarea>
            <label class="offmarket-checkbox">
              <input type="checkbox" id="om-privacy" required>
              <span>I consent to data processing for this access request *</span>
            </label>
            <button class="btn" type="submit">Submit access request</button>
          </form>
        </div>

        <div class="offmarket-step" data-panel="3" ${currentStep !== 3 ? 'hidden' : ''}>
          <div class="offmarket-confirm">
            <div class="offmarket-confirm-icon" aria-hidden="true"></div>
            <h3 class="offmarket-panel-title">Request received</h3>
            <p class="offmarket-request-id">Reference <strong id="om-request-id">${existingLead?.requestId || '—'}</strong></p>
            <p>The Brick team will review your profile within <strong>${config.reviewHours || 48} business hours</strong>.</p>
            <p>If approved, you will receive a <strong>personal access code</strong> by email.</p>
            <div class="offmarket-confirm-box">
              <p class="offmarket-confirm-label">What happens next</p>
              <ol>
                <li>Profile review by The Brick</li>
                <li>Access code sent by email (if approved)</li>
                <li>Enter code to view the reserved catalogue</li>
              </ol>
            </div>
            <button type="button" class="btn" id="om-to-step4">I have received my code</button>
            <p class="offmarket-alt"><a href="../contact.html">Contact us directly</a></p>
          </div>
        </div>

        <div class="offmarket-step" data-panel="4" ${currentStep !== 4 ? 'hidden' : ''}>
          <h3 class="offmarket-panel-title">Enter access code</h3>
          <p class="offmarket-step-note">${config.accessCodeHint || 'Use the code sent to you after approval.'}</p>
          <form class="contact-form offmarket-form" id="offmarket-access-form">
            <label for="om-code">Access code</label>
            <input id="om-code" name="code" type="password" required placeholder="Personal code" autocomplete="off">
            <p class="form-error" id="om-error" hidden>Invalid code. Check your email or contact <a href="mailto:info@thebrick.realestate">info@thebrick.realestate</a>.</p>
            <button class="btn" type="submit">Unlock catalogue</button>
          </form>
          <p class="offmarket-alt"><button type="button" class="offmarket-link-btn" id="om-back-step3">← Back to confirmation</button></p>
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
    btn.textContent = 'Submitting…';

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

function renderOffMarketCatalog(root) {
  const access = getStoredAccess();
  const expires = access ? new Date(access.expiresAt).toLocaleString('en-CH', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const heroText = document.getElementById('offmarket-hero-text');
  const heroTitle = document.querySelector('#offmarket-hero h1');
  if (heroTitle) heroTitle.innerHTML = 'Reserved <span class="gold">Catalogue</span>';
  if (heroText) heroText.textContent = `Confidential session — active until ${expires}`;

  root.innerHTML = `
    <div class="offmarket-catalog">
      <div class="offmarket-catalog-bar">
        <span class="offmarket-catalog-badge">Confidential session</span>
        <button type="button" class="btn btn-outline btn-sm" data-offmarket-logout>End session</button>
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
      grid.innerHTML = '<p class="no-results">No off-market listings at this time.</p>';
      return;
    }
    grid.innerHTML = items.map(renderOffMarketCard).join('');
  }).catch(() => {
    document.getElementById('offmarket-grid').innerHTML =
      '<p class="no-results">Unable to load catalogue.</p>';
  });
}

async function initOffMarketArea() {
  const root = document.getElementById('offmarket-root');
  if (!root) return;

  const heroText = document.getElementById('offmarket-hero-text');
  const heroTitle = document.querySelector('#offmarket-hero h1');
  if (heroText && !getStoredAccess()) {
    heroText.textContent = 'Exclusive residences by invitation — reviewed personally by The Brick.';
    if (heroTitle) heroTitle.innerHTML = 'Off-Market <span class="gold">Properties</span>';
  }

  try {
    const config = await loadOffMarketConfig();

    if (getStoredAccess()) {
      renderOffMarketCatalog(root);
      return;
    }

    renderGate(root, config, () => renderOffMarketCatalog(root));
  } catch {
    root.innerHTML = '<p class="no-results">Off-Market area unavailable.</p>';
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
      <p class="offmarket-confidential-strip">Confidential — do not share address, pricing, or images</p>
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
