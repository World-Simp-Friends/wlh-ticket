/* Post-hero scenes: native scrolling, enhanced only on a desktop pointer. */
(() => {
  'use strict';

  const boot = () => {
    const root = document.getElementById('reveal');
    if (!root || root.dataset.postludeInitialized === 'true') return;
    const scenes = [...root.querySelectorAll(
      '.programme-section, .ticket-salon, .souvenir-room, .closing-stage'
    )];
    if (!scenes.length) return;
    root.dataset.postludeInitialized = 'true';

    const desktop = window.matchMedia(
      '(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
    );
    const foldViewport = window.matchMedia('(min-height: 700px)');
    const visibleScenes = new Set();
    const programme = root.querySelector('.programme-section');
    const foldFaces = [...root.querySelectorAll('.destination-face')];
    const smooth = (value) => value * value * (3 - 2 * value);
    const previousValues = new WeakMap();
    const clamp = (value) => Math.max(0, Math.min(1, value));
    let ready = root.classList.contains('is-ready');
    let enabled = false;
    let frame = 0;
    let observer;

    const measureVisible = () => {
      if (!ready) return;
      const viewportHeight = window.innerHeight;
      scenes.forEach((scene) => {
        const rect = scene.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < viewportHeight) {
          visibleScenes.add(scene);
          const revealTarget = scene.matches('.souvenir-room') ? scene.querySelector('.keepsake-desk') || scene : scene;
          const revealRect = revealTarget.getBoundingClientRect();
          const entryLine = scene.matches('.souvenir-room') ? .65 : scene.matches('.closing-stage') ? .68 : 1;
          if (revealRect.top < viewportHeight * entryLine && revealRect.bottom > 0) scene.classList.add('is-in-view');
        } else {
          visibleScenes.delete(scene);
        }
      });
    };

    const render = () => {
      frame = 0;
      if (!enabled || !ready) return;
      measureVisible();
      const viewportHeight = window.innerHeight;
      // Always measure the folio, including outside the viewport: reversing must reach zero.
      const activeScenes = new Set([...visibleScenes, programme].filter(Boolean));
      const measurements = [...activeScenes].map((scene) => ({
        scene,
        rect: scene.getBoundingClientRect(),
      }));
      measurements.forEach(({ scene, rect }) => {
        const progress = clamp((viewportHeight - rect.top) / (rect.height + viewportHeight));
        const pinnedProgress = rect.height > viewportHeight
          ? clamp(-rect.top / (rect.height - viewportHeight))
          : (rect.top <= 0 ? 1 : 0);
        // Hold closed until the whole stage is in view; leave time to read after opening.
        const unfold = clamp((pinnedProgress - .08) / .74);
        const values = progress.toFixed(4) + ':' + unfold.toFixed(4);
        if (previousValues.get(scene) === values) return;
        previousValues.set(scene, values);
        scene.style.setProperty('--scene-progress', progress.toFixed(4));
        if (scene === programme && foldViewport.matches) {
          scene.style.setProperty('--unfold-progress', unfold.toFixed(4));
          // Open the outer flap completely before moving the inner flap.
          // Simultaneous swings make the two paper surfaces intersect above the calendar.
          const left = smooth(clamp(unfold * 2));
          const right = smooth(clamp((unfold - .5) * 2));
          scene.style.setProperty('--left-fold', ((1 - left) * 180).toFixed(3) + 'deg');
          scene.style.setProperty('--right-fold', ((right - 1) * 180).toFixed(3) + 'deg');
          // Folded faces cannot be reached through keyboard navigation.
          foldFaces.forEach((face, index) => { face.inert = (index === 0 ? left : right) < .98; });
        }
      });
    };

    const requestRender = () => {
      if (!enabled || !ready || frame) return;
      if (!observer) measureVisible();
      frame = window.requestAnimationFrame(render);
    };

    const onResize = () => {
      measureVisible();
      requestRender();
    };

    const setMode = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('scroll', requestRender);
      window.removeEventListener('resize', onResize);
      enabled = desktop.matches;
      if (enabled) {
        root.dataset.desktopMotion = 'true';
        foldFaces.forEach((face) => { face.inert = foldViewport.matches; });
        if (!foldViewport.matches) {
          ['--unfold-progress', '--left-fold', '--right-fold'].forEach((name) => programme?.style.removeProperty(name));
        }
        previousValues.delete(programme);
        window.addEventListener('scroll', requestRender, { passive: true });
        window.addEventListener('resize', onResize, { passive: true });
        measureVisible();
        requestRender();
      } else {
        delete root.dataset.desktopMotion;
        scenes.forEach((scene) => {
          scene.style.removeProperty('--scene-progress');
          scene.style.removeProperty('--unfold-progress');
          scene.style.removeProperty('--left-fold');
          scene.style.removeProperty('--right-fold');
          previousValues.delete(scene);
        });
        foldFaces.forEach((face) => { face.inert = false; });
      }
    };

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && ready) {
            visibleScenes.add(entry.target);
          } else {
            visibleScenes.delete(entry.target);
          }
        });
        requestRender();
      }, { threshold: [0, 0.01], rootMargin: '0px' });
      scenes.forEach((scene) => observer.observe(scene));
    } else {
      // Older browsers retain all content and only measure the four scene roots.
      scenes.forEach((scene) => {
        visibleScenes.add(scene);
        scene.classList.add('is-in-view');
      });
    }

    window.addEventListener('invitation:ready', () => {
      ready = true;
      measureVisible();
      requestRender();
    });
    if (typeof desktop.addEventListener === 'function') {
      desktop.addEventListener('change', setMode);
      foldViewport.addEventListener('change', setMode);
    } else if (typeof desktop.addListener === 'function') {
      desktop.addListener(setMode);
      foldViewport.addListener(setMode);
    }
    setMode();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
