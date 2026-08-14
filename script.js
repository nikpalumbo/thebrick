/* Coming soon — scroll reveal & parallax */

(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero slideshow
  const slides = document.querySelectorAll('.cs-hero-slide');
  if (slides.length > 1) {
    let i = 0;
    setInterval(() => {
      slides[i]?.classList.remove('is-active');
      i = (i + 1) % slides.length;
      slides[i]?.classList.add('is-active');
    }, 7000);
  }

  // Scroll reveal
  const revealEls = document.querySelectorAll('.anim-on-scroll');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
    );
    revealEls.forEach(el => observer.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  // Subtle parallax on scroll
  if (!prefersReduced) {
    const parallaxEls = document.querySelectorAll('[data-parallax]');
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        parallaxEls.forEach(el => {
          const rate = parseFloat(el.dataset.parallax) || 0.08;
          const rect = el.getBoundingClientRect();
          const offset = (rect.top + scrollY - window.innerHeight * 0.5) * rate;
          el.style.transform = `translateY(${offset * 0.15}px)`;
        });
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
