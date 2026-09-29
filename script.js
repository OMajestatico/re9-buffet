(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const initIcons = () => {
    if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.7 } });
  };
  initIcons();
  window.addEventListener('load', initIcons, { once: true });

  const topbar = $('#topbar');
  const backTop = $('.back-top');
  const heroBg = $('.hero-bg');
  const onScroll = () => {
    const y = window.scrollY;
    topbar?.classList.toggle('scrolled', y > 24);
    backTop?.classList.toggle('show', y > 700);
    if (heroBg && y < innerHeight && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      heroBg.style.transform = `scale(1.035) translate3d(0, ${Math.min(y * .045, 30)}px, 0)`;
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menu móvel. Sem position:fixed no body, pq isso causava o “teleporte + scroll cinematográfico” ao fechar.
  const menu = $('#mobile-menu');
  const openBtn = $('.menu-button');
  const closeBtn = $('.menu-close');
  let lockedY = 0;

  const forceScroll = y => {
    const root = document.documentElement;
    const old = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    requestAnimationFrame(() => { root.style.scrollBehavior = old; });
  };

  const openMenu = () => {
    lockedY = window.scrollY;
    document.documentElement.classList.add('menu-open');
    document.body.classList.add('menu-open');
    menu?.classList.add('open');
    menu?.setAttribute('aria-hidden', 'false');
    openBtn?.setAttribute('aria-expanded', 'true');
  };

  const closeMenu = ({ restore = true } = {}) => {
    menu?.classList.remove('open');
    menu?.setAttribute('aria-hidden', 'true');
    openBtn?.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('menu-open');
    document.body.classList.remove('menu-open');

    // Normalmente a posição nem muda. Só corrige se o navegador resolveu inventar moda.
    if (restore && Math.abs(window.scrollY - lockedY) > 2) forceScroll(lockedY);
  };

  openBtn?.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', () => closeMenu());
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu?.classList.contains('open')) closeMenu();
  });

  $$('.mobile-nav a').forEach(a => a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href?.startsWith('#')) return;
    e.preventDefault();
    closeMenu({ restore: false });
    requestAnimationFrame(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }));

  // Reveals
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.style.transitionDelay = `${Math.min(i * 45, 180)}ms`;
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in-view'));
  }

  // Carrosséis. Touch usa rolagem NATIVA. Nada de sequestrar o dedo do usuário, conceito revolucionário.
  $$('[data-carousel]').forEach(carousel => {
    const track = $('.carousel-track', carousel);
    if (!track) return;
    const slides = [...track.children];
    const dotsWrap = $('.dots', carousel);
    if (!slides.length || !dotsWrap) return;

    const targetLeft = slide => slide.offsetLeft - track.offsetLeft;
    const goTo = i => {
      const slide = slides[Math.max(0, Math.min(slides.length - 1, i))];
      if (!slide) return;
      track.scrollTo({ left: targetLeft(slide), behavior: 'smooth' });
    };

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Ir para item ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });

    const dots = $$('.dot', dotsWrap);
    let active = 0;
    let raf = 0;

    const nearest = () => {
      const left = track.scrollLeft;
      let best = 0;
      let dist = Infinity;
      slides.forEach((slide, i) => {
        const d = Math.abs(targetLeft(slide) - left);
        if (d < dist) { dist = d; best = i; }
      });
      if (best !== active) {
        dots[active]?.classList.remove('active');
        active = best;
        dots[active]?.classList.add('active');
      }
    };

    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(nearest);
    }, { passive: true });

    $('[data-prev]', carousel)?.addEventListener('click', () => goTo(active - 1));
    $('[data-next]', carousel)?.addEventListener('click', () => goTo(active + 1));

    // Arrastar com mouse no desktop. Em touch não há listeners de pointermove: o navegador faz o trabalho direito.
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let pointerId = null;

    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.classList.add('dragging');
      track.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    track.addEventListener('pointermove', e => {
      if (!dragging || e.pointerId !== pointerId) return;
      track.scrollLeft = startScroll - (e.clientX - startX);
    });

    const stopDrag = e => {
      if (!dragging) return;
      if (e?.pointerId != null && pointerId != null && e.pointerId !== pointerId) return;
      dragging = false;
      track.classList.remove('dragging');
      if (pointerId != null && track.hasPointerCapture?.(pointerId)) track.releasePointerCapture(pointerId);
      pointerId = null;
      nearest();
      goTo(active);
    };

    track.addEventListener('pointerup', stopDrag);
    track.addEventListener('pointercancel', stopDrag);
    track.addEventListener('dragstart', e => e.preventDefault());
  });

  // Efeito 3D apenas onde existe mouse de verdade.
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $$('.tilt').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `perspective(950px) rotateX(${-y * 4.5}deg) rotateY(${x * 6.5}deg) translateZ(2px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  backTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
