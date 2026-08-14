/* Property catalog & detail — client-side filtering */

const DATA_URL = '../data/properties.json';

function getQueryParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

function setQueryParams(params) {
  const url = new URL(window.location.href);
  ['contract', 'type', 'maxPrice', 'q'].forEach(key => {
    if (params[key]) url.searchParams.set(key, params[key]);
    else url.searchParams.delete(key);
  });
  window.history.replaceState({}, '', url);
}

function priceInBand(price, maxPrice) {
  if (!maxPrice) return true;
  const max = Number(maxPrice);
  if (max === 999999999) return price >= 10000000;
  if (max === 10000000) return price >= 5000000 && price <= 10000000;
  if (max === 5000000) return price >= 2000000 && price <= 5000000;
  if (max === 2000000) return price > 0 && price <= 2000000;
  return price <= max;
}

function filterProperties(properties, params) {
  const q = (params.q || '').toLowerCase().trim();
  return properties.filter(p => {
    if (p.status && p.status !== 'active') return false;
    if (p.offMarket || p.visibility === 'off_market') return false;
    if (params.contract && p.contract !== params.contract) return false;
    if (params.type && p.type !== params.type) return false;
    if (params.maxPrice && !priceInBand(p.price, params.maxPrice)) return false;
    if (q) {
      const hay = `${p.title} ${p.location} ${p.type} ${p.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderPropertyCard(p, basePath = '') {
  const badge = p.offMarket
    ? '<span class="property-badge">Off-Market</span>'
    : (p.featured ? '<span class="property-badge">Featured</span>' : '');
  const img = p.image.startsWith('http') ? p.image : `${basePath}${p.image}`;
  return `
    <a class="property-card" href="detail.html?id=${p.id}">
      <div class="property-card-image">
        ${badge}
        <img src="${img}" alt="${p.title}" loading="lazy">
      </div>
      <div class="property-card-body">
        <h3>${p.title}</h3>
        <p class="property-meta">${p.location} · ${p.rooms} rooms · ${p.area}</p>
        <p class="property-price">${p.priceLabel}</p>
      </div>
    </a>`;
}

async function loadProperties() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Failed to load properties');
  return res.json();
}

function initCatalog() {
  const grid = document.getElementById('properties-grid');
  const noResults = document.getElementById('no-results');
  const countEl = document.getElementById('results-count');
  const form = document.getElementById('filters-form');
  if (!grid) return;

  let view = localStorage.getItem('tb-view') || 'grid';

  function setView(mode) {
    view = mode;
    localStorage.setItem('tb-view', mode);
    grid.classList.toggle('view-grid', mode === 'grid');
    grid.classList.toggle('view-list', mode === 'list');
    document.querySelectorAll('[data-view]').forEach(btn => {
      const active = btn.dataset.view === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  setView(view);

  const params = getQueryParams();
  if (params.contract) document.getElementById('filter-contract').value = params.contract;
  if (params.type) document.getElementById('filter-type').value = params.type;
  if (params.maxPrice) document.getElementById('filter-price').value = params.maxPrice;
  if (params.q) document.getElementById('filter-q').value = params.q;

  loadProperties().then(all => {
    function render() {
      const current = getQueryParams();
      const filtered = filterProperties(all, current);
      grid.innerHTML = filtered.map(p => renderPropertyCard(p, '../')).join('');
      if (countEl) {
        countEl.textContent = filtered.length === 1
          ? '1 property found'
          : `${filtered.length} properties found`;
      }
      noResults.hidden = filtered.length > 0;
      grid.hidden = filtered.length === 0;
    }

    render();

    form?.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      setQueryParams({
        contract: fd.get('contract') || '',
        type: fd.get('type') || '',
        maxPrice: fd.get('maxPrice') || '',
        q: fd.get('q') || '',
      });
      render();
    });
  }).catch(() => {
    grid.innerHTML = '<p class="no-results">Unable to load properties. Please try again later.</p>';
  });
}

function initPropertyDetail() {
  const root = document.getElementById('property-root');
  if (!root) return;

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    root.innerHTML = '<p class="no-results">Property not found. <a href="index.html">Back to catalogue</a></p>';
    return;
  }

  loadProperties().then(all => {
    const p = all.find(x => x.id === id);
    if (!p) {
      root.innerHTML = '<p class="no-results">Property not found. <a href="index.html">Back to catalogue</a></p>';
      return;
    }

    document.title = `${p.title} — The Brick Luxury Properties`;

    const imgs = (p.images || [p.image]).map(src =>
      src.startsWith('http') ? src : `../${src}`
    );
    const mainImg = imgs[0];
    const thumbs = imgs.slice(1, 3);

    const features = Object.entries(p.features || {})
      .map(([k, v]) => `<div class="feature"><strong>${k}</strong>${v}</div>`)
      .join('');

    const galleryThumbs = thumbs.map((src, i) =>
      `<div class="property-gallery-thumb"><img src="${src}" alt="${p.title} — photo ${i + 2}"></div>`
    ).join('');

    root.innerHTML = `
      <nav class="breadcrumb"><a href="../index.html">Home</a> · <a href="index.html">Properties</a> · ${p.title}</nav>

      <div class="property-gallery">
        <div class="property-gallery-main"><img src="${mainImg}" alt="${p.title}"></div>
        ${galleryThumbs}
      </div>

      <div class="property-detail-grid">
        <div>
          ${p.offMarket ? '<span class="property-badge" style="position:static;display:inline-block;margin-bottom:1rem">Off-Market</span>' : ''}
          <h1>${p.title}</h1>
          <p class="location">${p.location}</p>
          <p class="price">${p.priceLabel}</p>
          <p>${p.description}</p>
          <div class="features">${features}</div>
          <div class="map-placeholder" aria-label="Map location">
            Map — ${p.location}
          </div>
        </div>
        <aside class="sidebar-box">
          <h3>Request information</h3>
          <p style="font-size:0.9rem;color:var(--muted);margin-bottom:1rem">Interested in this property? Contact The Brick for a private viewing.</p>
          <form class="contact-form" onsubmit="event.preventDefault(); alert('Thank you. We will contact you about ${p.title.replace(/'/g, "\\'")}.');">
            <label for="d-name">Name</label>
            <input id="d-name" type="text" required placeholder="Your name">
            <label for="d-email">Email</label>
            <input id="d-email" type="email" required placeholder="you@example.com">
            <label for="d-message">Message</label>
            <textarea id="d-message" placeholder="I would like to schedule a viewing…"></textarea>
            <button class="btn" type="submit" style="width:100%">Send enquiry</button>
          </form>
          <p style="margin-top:1rem;font-size:0.85rem"><a href="../contact.html">Or contact us directly →</a></p>
        </aside>
      </div>
    `;
  }).catch(() => {
    root.innerHTML = '<p class="no-results">Unable to load property. <a href="index.html">Back to catalogue</a></p>';
  });
}
