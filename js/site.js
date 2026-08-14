/* Shared site utilities — The Brick Luxury Properties */

function renderHeader(options = {}) {
  const { variant = 'light', active = '' } = options;
  const isDark = variant === 'dark';
  const prefix = options.basePath || '';

  return `
    <header class="site-header site-header--${isDark ? 'dark' : 'light'}">
      <a class="brand" href="${prefix}index.html">
        <img src="${prefix}assets/logo-transparent.png?v=eps1" width="1316" height="1813" alt="The Brick Luxury Properties">
      </a>
      <nav aria-label="Main">
        <ul class="nav">
          <li><a href="${prefix}properties/" class="${active === 'properties' ? 'is-active' : ''}">Properties</a></li>
          <li><a href="${prefix}about.html" class="${active === 'about' ? 'is-active' : ''}">About</a></li>
          <li><a href="${prefix}team.html" class="${active === 'team' ? 'is-active' : ''}">Team</a></li>
          <li><a href="${prefix}contact.html" class="nav-cta ${active === 'contact' ? 'is-active' : ''}">Contact</a></li>
        </ul>
      </nav>
      <button class="menu-toggle" type="button" aria-label="Open menu" data-menu-open>☰</button>
    </header>
    <div class="mobile-nav" data-mobile-nav hidden>
      <button class="mobile-nav-close" type="button" aria-label="Close menu" data-menu-close>×</button>
      <ul>
        <li><a href="${prefix}index.html">Home</a></li>
        <li><a href="${prefix}properties/">Properties</a></li>
        <li><a href="${prefix}about.html">About</a></li>
        <li><a href="${prefix}team.html">Team</a></li>
        <li><a href="${prefix}contact.html">Contact</a></li>
      </ul>
    </div>
  `;
}

function renderFooter(options = {}) {
  const prefix = options.basePath || '';
  const year = new Date().getFullYear();

  return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <img src="${prefix}assets/logo-transparent.png?v=eps1" alt="The Brick Luxury Properties">
            <p>Discreet luxury real estate in Ticino and beyond. Quality over volume — curated residences and off-market opportunities.</p>
          </div>
          <div class="footer-col">
            <h4>Explore</h4>
            <ul>
              <li><a href="${prefix}properties/">Properties</a></li>
              <li><a href="${prefix}off-market/">Off-Market</a></li>
              <li><a href="${prefix}about.html">About us</a></li>
              <li><a href="${prefix}team.html">Team</a></li>
              <li><a href="${prefix}contact.html">Contact</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Offices</h4>
            <ul>
              <li>Lugano · Switzerland</li>
              <li>Cannes · Milano · Dubai</li>
              <li><a href="mailto:info@thebrick.realestate">info@thebrick.realestate</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          © ${year} The Brick Luxury Properties · <a href="${prefix}index.html" style="color:inherit">www.thebrick.realestate</a>
        </div>
      </div>
    </footer>
  `;
}

function initMobileNav() {
  const openBtn = document.querySelector('[data-menu-open]');
  const closeBtn = document.querySelector('[data-menu-close]');
  const nav = document.querySelector('[data-mobile-nav]');
  if (!openBtn || !nav) return;

  openBtn.addEventListener('click', () => {
    nav.classList.add('is-open');
    nav.removeAttribute('hidden');
  });
  closeBtn?.addEventListener('click', () => {
    nav.classList.remove('is-open');
    nav.setAttribute('hidden', '');
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    nav.setAttribute('hidden', '');
  }));
}

function initHeroCarousel() {
  const slides = [...document.querySelectorAll('.hero-slide')];
  const dots = [...document.querySelectorAll('[data-hero-dot]')];
  if (!slides.length) return;

  let i = 0;
  function go(n) {
    slides[i]?.classList.remove('is-active');
    dots[i]?.classList.remove('is-active');
    i = (n + slides.length) % slides.length;
    slides[i]?.classList.add('is-active');
    dots[i]?.classList.add('is-active');
    updateCaption();
  }

  function updateCaption() {
    const cap = document.querySelector('[data-hero-caption]');
    if (!cap || !window.__featuredProperties) return;
    const p = window.__featuredProperties[i % window.__featuredProperties.length];
    if (!p) return;
    cap.innerHTML = `
      <a href="properties/detail.html?id=${p.id}">
        <h2>${p.title}</h2>
        <p>${p.description.split('.')[0]}.</p>
      </a>
    `;
  }

  document.querySelector('[data-hero-prev]')?.addEventListener('click', () => go(i - 1));
  document.querySelector('[data-hero-next]')?.addEventListener('click', () => go(i + 1));
  dots.forEach((d, idx) => d.addEventListener('click', () => go(idx)));
  setInterval(() => go(i + 1), 7000);
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initHeroCarousel();
});
