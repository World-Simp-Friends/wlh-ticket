/* Native scrolling; one-shot scene observers and a compositor-driven desktop folio. */
(() => {
  'use strict';

  const boot = () => {
    const root = document.getElementById('reveal');
    const programme = root?.querySelector('.programme-section');
    if (!root || !programme || root.dataset.postludeInitialized === 'true') return;
    root.dataset.postludeInitialized = 'true';

    const desktop = matchMedia('(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    const foldViewport = matchMedia('(min-height: 700px)');
    const nativeTimeline = CSS.supports('animation-timeline', 'view()')
      && CSS.supports('animation-range', 'contain 8% contain 82%');
    const wings = [...programme.querySelectorAll('.destination-leaf')];
    const faces = [...programme.querySelectorAll('.destination-face')];
    const cue = programme.querySelector('.programme-scroll-cue');
    const clamp = value => Math.max(0, Math.min(1, value));
    const smooth = value => value * value * (3 - 2 * value);
    const entryObservers = [];
    let ready = root.classList.contains('is-ready');
    let foldEnabled = false;
    let frame = 0;
    let geometryDirty = true;
    let start = 0;
    let distance = 1;
    let previous = -1;

    const renderFold = () => {
      frame = 0;
      if (!ready || !foldEnabled || document.hidden) return;
      const y = window.scrollY;
      // Geometry is stable during scroll. Re-read only after layout/viewport changes.
      if (geometryDirty) {
        const rect = programme.getBoundingClientRect();
        start = rect.top + y;
        distance = Math.max(1, rect.height - window.innerHeight);
        geometryDirty = false;
      }
      const progress = clamp((clamp((y - start) / distance) - .08) / .74);
      if (progress === previous) return;
      previous = progress;
      const left = smooth(clamp(progress * 2));
      const right = smooth(clamp((progress - .5) * 2));
      // The browser owns transforms on the native path; JS only updates focus gates.
      faces.forEach((face, index) => {
        const inert = (index ? right : left) < .98;
        if (face.inert !== inert) face.inert = inert;
      });
      if (!nativeTimeline) {
        wings[0].style.transform = `translateZ(2px) rotateY(${((1 - left) * 180).toFixed(3)}deg)`;
        wings[1].style.transform = `translateZ(1px) rotateY(${((right - 1) * 180).toFixed(3)}deg)`;
        if (cue) cue.style.opacity = String(1 - progress);
        programme.classList.toggle('is-unfolding', progress > 0 && progress < 1);
      }
    };

    const requestFold = () => {
      if (!ready || !foldEnabled || frame || document.hidden) return;
      const y = window.scrollY;
      // No RAF work after the folio has fully left either end of its scroll range.
      if (!geometryDirty && ((y <= start && previous === 0)
        || (y >= start + distance && previous === 1))) return;
      frame = requestAnimationFrame(renderFold);
    };
    const invalidateGeometry = () => {
      geometryDirty = true;
      previous = -1;
      requestFold();
    };

    const observeEntrances = () => {
      entryObservers.forEach(observer => observer.disconnect());
      entryObservers.length = 0;
      [
        { scene: root.querySelector('.souvenir-room'), target: root.querySelector('.keepsake-desk'), line: .65 },
        { scene: root.querySelector('.closing-stage'), target: root.querySelector('.closing-stage'), line: .68 },
      ].forEach(({ scene, target, line }) => {
        if (!scene || !target || scene.classList.contains('is-in-view')) return;
        if (!desktop.matches || !('IntersectionObserver' in window)) {
          scene.classList.add('is-in-view');
          return;
        }
        const observer = new IntersectionObserver(entries => {
          if (!ready) return;
          if (entries.some(entry => entry.isIntersecting)) {
            scene.classList.add('is-in-view');
            observer.disconnect();
          }
        }, { rootMargin: `0px 0px -${Math.round(innerHeight * (1 - line))}px 0px`, threshold: 0 });
        observer.observe(target);
        entryObservers.push(observer);
      });
    };

    const setMode = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('scroll', requestFold);
      foldEnabled = desktop.matches && foldViewport.matches;
      if (desktop.matches) root.dataset.desktopMotion = 'true';
      else delete root.dataset.desktopMotion;
      if (foldEnabled) {
        root.dataset.foldDriver = nativeTimeline ? 'native' : 'js';
        window.addEventListener('scroll', requestFold, { passive: true });
      } else {
        delete root.dataset.foldDriver;
        programme.classList.remove('is-unfolding');
        wings.forEach(wing => wing.style.removeProperty('transform'));
        cue?.style.removeProperty('opacity');
      }
      faces.forEach(face => { face.inert = foldEnabled; });
      if (ready) observeEntrances();
      invalidateGeometry();
    };

    // Release temporary promotion and offscreen shutter layers after their entrance.
    root.addEventListener('transitionend', event => {
      if (event.propertyName === 'transform' && event.target.matches('.keepsake-object')) {
        event.target.classList.add('has-arrived');
      }
    });
    root.addEventListener('animationend', event => {
      if (event.animationName === 'closing-paper-right') {
        event.target.closest('.closing-stage')?.classList.add('is-revealed');
      }
    });
    window.addEventListener('invitation:ready', () => {
      ready = true;
      observeEntrances();
      invalidateGeometry();
    });
    window.addEventListener('invitation:layout', invalidateGeometry);
    window.addEventListener('resize', () => {
      if (ready) observeEntrances();
      invalidateGeometry();
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
      else invalidateGeometry();
    });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(invalidateGeometry);
      [root.querySelector('.invitation-hero'), programme].filter(Boolean).forEach(target => observer.observe(target));
    }
    document.fonts?.ready.then(invalidateGeometry);
    [desktop, foldViewport].forEach(query => {
      if (query.addEventListener) query.addEventListener('change', setMode);
      else query.addListener(setMode);
    });
    setMode();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
