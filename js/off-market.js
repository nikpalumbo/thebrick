/* Modulo 3 — Off-Market reserved area */

const OFFMARKET_DATA_URL = '../data/off-market.json';
const OFFMARKET_CONFIG_URL = '../data/off-market-config.json';
const SESSION_KEY = 'tb-offmarket-access';
const LEAD_KEY = 'tb-offmarket-lead';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
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

function grantAccess(hours = 24) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    grantedAt: Date.now(),
    expiresAt: Date.now() + hours * 60 * 60 * 1000,
  }));
}

function saveLead(lead) {
  sessionStorage.setItem(LEAD_KEY, JSON.stringify({ ...lead, submittedAt: Date.now() }));
}

async function submitLead(lead, webhookUrl) {
  saveLead(lead);

  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'thebrick-off-market',
        ...lead,
        submittedAt: new Date().toISOString(),
      }),
    });
  }
}

function renderGate(root, config, onUnlocked) {
  const lead = (() => {
    try { return JSON.parse(sessionStorage.getItem(LEAD_KEY) || 'null'); } catch { return null; }
  })();

  root.innerHTML = `
    <div class="offmarket-gate">
      <div class="offmarket-gate-card">
        <span class="eyebrow">Confidential</span>
        <h1>Off-Market properties</h1>
        <p class="offmarket-intro">This catalogue is not public. Complete the profile below to request access — our team reviews every enquiry before sharing confidential listings.</p>

        <div class="offmarket-steps" data-step="${lead ? '2' : '1'}">
          <div class="offmarket-step" data-panel="1" ${lead ? 'hidden' : ''}>
            <h2>Step 1 — Your profile</h2>
            <form class="contact-form" id="offmarket-lead-form">
              <label for="om-name">Full name</label>
              <input id="om-name" name="name" type="text" required placeholder="Your name">
              <label for="om-email">Email</label>
              <input id="om-email" name="email" type="email" required placeholder="you@example.com">
              <label for="om-phone">Phone</label>
              <input id="om-phone" name="phone" type="tel" placeholder="+41 …">
              <label for="om-budget">Budget range</label>
              <select id="om-budget" name="budget" required>
                <option value="">Select…</option>
                <option>CHF 2–5M</option>
                <option>CHF 5–10M</option>
                <option>CHF 10M+</option>
                <option>Undisclosed</option>
              </select>
              <label for="om-timeline">Timeline</label>
              <select id="om-timeline" name="timeline" required>
                <option value="">Select…</option>
                <option>Within 3 months</option>
                <option>3–6 months</option>
                <option>6–12 months</option>
                <option>Exploring only</option>
              </select>
              <label for="om-interest">I am looking for</label>
              <select id="om-interest" name="interest" required>
                <option value="">Select…</option>
                <option>Lakefront villa</option>
                <option>Penthouse / apartment</option>
                <option>Investment property</option>
                <option>Other prestige residence</option>
              </select>
              <label for="om-message">Additional notes</label>
              <textarea id="om-message" name="message" placeholder="Tell us about your requirements…"></textarea>
              <button class="btn" type="submit" style="width:100%">Continue to access request</button>
            </form>
          </div>

          <div class="offmarket-step" data-panel="2" ${lead ? '' : 'hidden'}>
            <h2>Step 2 — Access code</h2>
            <p class="offmarket-step-note">Enter the access code provided by The Brick after your profile is reviewed.</p>
            <form class="contact-form" id="offmarket-access-form">
              <label for="om-code">Access code</label>
              <input id="om-code" name="code" type="password" required placeholder="Enter your code" autocomplete="off">
              <p class="form-error" id="om-error" hidden>Invalid access code. Please contact <a href="mailto:info@thebrick.realestate">info@thebrick.realestate</a>.</p>
              <button class="btn" type="submit" style="width:100%">Unlock catalogue</button>
            </form>
            <p class="offmarket-alt"><a href="../contact.html">Or request access via contact form →</a></p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('offmarket-lead-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const lead = Object.fromEntries(fd.entries());
    try {
      await submitLead(lead, config.leadWebhookUrl || '');
    } catch {
      /* still allow access flow if webhook fails */
    }
    root.querySelector('[data-panel="1"]').hidden = true;
    root.querySelector('[data-panel="2"]').hidden = false;
    root.querySelector('.offmarket-steps').dataset.step = '2';
  });

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
    grantAccess(config.sessionHours || 24);
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
  root.innerHTML = `
    <div class="offmarket-catalog">
      <div class="offmarket-catalog-head">
        <div>
          <span class="eyebrow">Confidential catalogue</span>
          <h1>Off-Market properties</h1>
          <p>Private listings — not indexed and not visible on the public site.</p>
        </div>
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
      grid.innerHTML = '<p class="no-results">No off-market listings at this time. Contact us for upcoming opportunities.</p>';
      return;
    }
    grid.innerHTML = items.map(renderOffMarketCard).join('');
  }).catch(() => {
    document.getElementById('offmarket-grid').innerHTML =
      '<p class="no-results">Unable to load catalogue. Please try again later.</p>';
  });
}

async function initOffMarketArea() {
  const root = document.getElementById('offmarket-root');
  if (!root) return;

  if (getStoredAccess()) {
    renderOffMarketCatalog(root);
    return;
  }

  try {
    const config = await loadOffMarketConfig();
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
    root.innerHTML = '<p class="no-results">Property not found. <a href="index.html">Back</a></p>';
    return;
  }

  loadOffMarketProperties().then(all => {
    const p = all.find(x => x.id === id);
    if (!p) {
      root.innerHTML = '<p class="no-results">Property not found. <a href="index.html">Back</a></p>';
      return;
    }

    document.title = `${p.title} — Off-Market · The Brick`;
    const imgs = (p.images || [p.image]).map(src => src.startsWith('http') ? src : `../${src}`);
    const features = Object.entries(p.features || {})
      .map(([k, v]) => `<div class="feature"><strong>${k}</strong>${v}</div>`).join('');
    const thumbs = imgs.slice(1, 3).map((src, i) =>
      `<div class="property-gallery-thumb"><img src="${src}" alt="Photo ${i + 2}"></div>`).join('');

    root.innerHTML = `
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
          <h3>Confidential enquiry</h3>
          <p style="font-size:0.9rem;color:var(--muted);margin-bottom:1rem">This listing is private. Contact The Brick directly for a viewing.</p>
          <form class="contact-form" onsubmit="event.preventDefault(); alert('Thank you. We will contact you confidentially about this property.');">
            <label for="d-name">Name</label>
            <input id="d-name" type="text" required>
            <label for="d-email">Email</label>
            <input id="d-email" type="email" required>
            <label for="d-message">Message</label>
            <textarea id="d-message"></textarea>
            <button class="btn" type="submit" style="width:100%">Send confidential enquiry</button>
          </form>
        </aside>
      </div>
    `;
  });
}
