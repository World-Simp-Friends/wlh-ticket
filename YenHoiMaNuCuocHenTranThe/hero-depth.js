/* A camera move through the existing artwork, with counter-moving depth planes. */
(() => {
  'use strict';
  const hero = document.getElementById('invitation-hero');
  const root = document.getElementById('reveal');
  if (!hero || !root) return;
  const media = matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const layers = [
    [hero.querySelector('.hero-architecture'), -12, -8, 30],
    [hero.querySelector('.hero-scene'), 17, 10, -18],
    [hero.querySelector('.feather-one'), 17, 10, -32],
    [hero.querySelector('.feather-two'), 10, 6, -20],
    [hero.querySelector('.feather-near'), 27, 16, -52],
  ].filter(([element]) => element);
  let visible = false, ready = root.classList.contains('is-ready');
  let frame = 0, lastTime = 0, bounds = null, heroTop = 0;
  let x = 0, y = 0, targetX = 0, targetY = 0;
  let depth = 0, targetDepth = 0;
  const active = () => media.matches && visible && ready && !document.hidden;
  const paint = () => layers.forEach(([element, dx, dy, travel]) => {
    element.style.translate = `${(x * dx).toFixed(3)}px ${(y * dy + depth * travel).toFixed(3)}px`;
  });
  const stop = () => {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    x = y = targetX = targetY = 0;
    depth = targetDepth = 0;
    layers.forEach(([element]) => element.style.removeProperty('translate'));
  };
  const draw = time => {
    frame = 0;
    if (!active()) return;
    const dt = lastTime ? Math.min(50, time - lastTime) : 16.7;
    lastTime = time;
    const amount = 1 - Math.exp(-dt / 110);
    x += (targetX - x) * amount; y += (targetY - y) * amount;
    depth += (targetDepth - depth) * amount;
    const settled = Math.abs(targetX - x) + Math.abs(targetY - y) + Math.abs(targetDepth - depth) < .001;
    if (settled) { x = targetX; y = targetY; depth = targetDepth; }
    paint();
    if (!settled) frame = requestAnimationFrame(draw);
    else lastTime = 0;
  };
  const request = () => { if (active() && !frame) frame = requestAnimationFrame(draw); };
  const sync = () => {
    hero.classList.toggle('depth-enabled', media.matches);
    hero.classList.toggle('depth-active', active());
    if (!active()) { bounds = null; stop(); }
    else {
      bounds = hero.getBoundingClientRect();
      heroTop = bounds.top + scrollY;
      targetDepth = Math.max(0, Math.min(1, (scrollY - heroTop) / bounds.height));
      depth = targetDepth;
      paint();
    }
  };
  hero.addEventListener('pointermove', event => {
    if (!active() || event.pointerType === 'touch') return;
    if (!bounds) return;
    targetX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    targetY = Math.max(-1, Math.min(1, (event.clientY - (heroTop - scrollY)) / bounds.height * 2 - 1));
    request();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { targetX = targetY = 0; request(); });
  addEventListener('scroll', () => {
    if (!active() || !bounds) return;
    targetDepth = Math.max(0, Math.min(1, (scrollY - heroTop) / bounds.height));
    request();
  }, { passive: true });
  addEventListener('resize', sync, { passive: true });
  document.addEventListener('visibilitychange', sync);
  addEventListener('invitation:ready', () => { ready = true; sync(); });
  media.addEventListener('change', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(hero);
  }
  sync();
})();
