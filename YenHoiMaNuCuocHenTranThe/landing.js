/* Invitation landing: progressively enhanced, with native document scrolling. */
(() => {
  'use strict';

  const boot = () => {
    const root = document.getElementById('reveal');
    if (!root || root.dataset.invitationInitialized === 'true') return;
    root.dataset.invitationInitialized = 'true';

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dockMedia = window.matchMedia('(max-width: 760px)');
    const cityStorageKey = 'yen-hoi-selected-city';
    const venues = {
      hcm: {
        label: 'TP.HCM',
        name: 'Lotte Cinema Gò Vấp',
        address: '242 Đ. Nguyễn Văn Lượng, Gò Vấp, TP. Hồ Chí Minh',
      },
      hn: {
        label: 'Hà Nội',
        name: 'BHD Phạm Ngọc Thạch',
        address: 'TTTM Vincom 2, Phạm Ngọc Thạch, Kim Liên, TP. Hà Nội',
      },
    };
    const tiers = {
      standard: { label: 'STANDARD', price: '209.000đ', count: '1', method: 'ngẫu nhiên' },
      vip: { label: 'VIP', price: '309.000đ', count: '2', method: 'tự chọn trên web' },
    };
    let city = 'hcm';
    let tier = 'standard';
    let opened = false;
    let openingTimer;
    let openingFrame;
    let sceneObserver;
    const dockObservers = [];
    let dockFrame = 0;
    let dockVisible = false;
    const dockState = { heroPassed: false, ticketsVisible: true, footerVisible: false };
    let lastDialogTrigger;
    let dialogPointerDownOutside = false;
    const scenes = [...root.querySelectorAll('.scene-reveal')];
    const dialog = document.getElementById('reservation-dialog');
    const dock = root.querySelector('.booking-dock');
    const hero = document.getElementById('invitation-hero');
    const ticketSection = document.getElementById('tickets') || document.getElementById('invitation-tickets')
      || document.getElementById('ticket-package');
    const footer = root.querySelector('.closing-stage') || document.getElementById('invitation-footer') || root.querySelector('footer');

    try {
      const storedCity = window.sessionStorage.getItem(cityStorageKey);
      if (Object.prototype.hasOwnProperty.call(venues, storedCity)) city = storedCity;
    } catch (_) { /* The experience also works with storage disabled. */ }

    const setText = (selector, value) => {
      root.querySelectorAll(selector).forEach((element) => {
        if (element.textContent !== value) element.textContent = value;
      });
      if (dialog && !root.contains(dialog)) {
        dialog.querySelectorAll(selector).forEach((element) => {
          if (element.textContent !== value) element.textContent = value;
        });
      }
    };

    const selectCity = (value) => {
      if (!Object.prototype.hasOwnProperty.call(venues, value)) return;
      const changed = city !== value;
      city = value;
      const venue = venues[city];
      root.dataset.city = city;
      root.querySelectorAll('[data-city]').forEach((button) => {
        if (button === root || !button.matches('button, [role="button"], [role="tab"]')) return;
        const selected = button.dataset.city === city;
        button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('is-active', selected);
        if (button.getAttribute('role') === 'tab') button.setAttribute('aria-selected', String(selected));
      });
      setText('[data-venue-name]', venue.name);
      setText('[data-venue-address]', venue.address);
      setText('[data-city-label], [data-selected-city]', venue.label);
      if (changed && opened && !motionPreference.matches) {
        root.querySelector('.venue-info')?.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}], {duration:250,easing:'cubic-bezier(.22,1,.36,1)'});
      }
      root.querySelectorAll('a[data-venue-map]').forEach((link) => {
        link.href = 'https://www.google.com/maps/search/?api=1&query='
          + encodeURIComponent(venue.name + ', ' + venue.address);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'Mở bản đồ đến ' + venue.name);
      });
      try { window.sessionStorage.setItem(cityStorageKey, city); } catch (_) { /* Optional persistence. */ }
    };

    const vipKeepsakes = [...root.querySelectorAll('.souvenir-room .keepsake-vip')];
    const commonKeepsakes = [...root.querySelectorAll('.souvenir-room .keepsake-object:not(.keepsake-vip)')];
    const keepsakeDesk = root.querySelector('.keepsake-desk');
    const giftAnimations = new Map();
    let giftUpdate = 0;
    let giftsInitialized = false;

    const updateTierGifts = (value, animate = true) => {
      const update = ++giftUpdate;
      const showVip = value === 'vip';
      const currentOpacity = new Map(vipKeepsakes.map((gift) => [gift, gift.hidden ? 0 : Number.parseFloat(getComputedStyle(gift).opacity)]));
      giftAnimations.forEach((animation) => animation.cancel());
      giftAnimations.clear();
      const rect = keepsakeDesk?.getBoundingClientRect();
      const shouldAnimate = animate && giftsInitialized && !motionPreference.matches
        && typeof Element.prototype.animate === 'function'
        && rect && rect.top < window.innerHeight && rect.bottom > 0
        && (!commonKeepsakes.length || Number.parseFloat(getComputedStyle(commonKeepsakes[0]).opacity) > .9);
      const before = shouldAnimate ? new Map(commonKeepsakes.map((gift) => [gift, gift.getBoundingClientRect()])) : null;
      giftsInitialized = true;

      const recomposeDesk = () => {
        root.dataset.giftTier = value;
        if (!before) return;
        // Finish every layout read before starting any FLIP animation.
        const positions = commonKeepsakes.map(gift => ({ gift, next: gift.getBoundingClientRect() }));
        positions.forEach(({ gift, next }) => {
          const previous = before.get(gift);
          const x = previous.left - next.left;
          const y = previous.top - next.top;
          if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
          const animation = gift.animate([
            { transform: 'translate(' + x + 'px,' + y + 'px)' },
            { transform: 'translate(0,0)' },
          ], { duration: 180, easing: 'cubic-bezier(.22,1,.36,1)' });
          giftAnimations.set(gift, animation);
          animation.finished.then(() => {
            if (giftAnimations.get(gift) === animation) giftAnimations.delete(gift);
          }).catch(() => {});
        });
      };

      if (showVip || !shouldAnimate) {
        vipKeepsakes.forEach((gift) => {
          gift.hidden = !showVip;
          gift.inert = !showVip;
          if (showVip) gift.removeAttribute('aria-hidden');
          else gift.setAttribute('aria-hidden', 'true');
        });
        recomposeDesk();
      }
      if (!shouldAnimate) return;

      const completions = vipKeepsakes.map((gift) => {
        gift.inert = !showVip;
        if (!showVip) gift.setAttribute('aria-hidden', 'true');
        const opacity = currentOpacity.get(gift);
        const animation = gift.animate(showVip ? [
          { opacity, transform: 'translateY(6px) scale(.97)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ] : [
          { opacity, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(3px) scale(.97)' },
        ], { duration: showVip ? 180 : 110, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
        giftAnimations.set(gift, animation);
        return animation.finished.then(() => {
          if (update !== giftUpdate) return;
          gift.hidden = !showVip;
          animation.cancel();
          giftAnimations.delete(gift);
        }).catch(() => {});
      });
      Promise.all(completions).then(() => {
        if (update === giftUpdate && !showVip) recomposeDesk();
      });
    };

    const selectTier = (value) => {
      if (!Object.prototype.hasOwnProperty.call(tiers, value)) return;
      const changed = tier !== value;
      tier = value;
      root.dataset.tier = tier;
      if (changed || !giftsInitialized) updateTierGifts(tier);
      const selection = tiers[tier];
      root.querySelectorAll('[data-tier], [data-select-tier]').forEach((button) => {
        if (button === root || !button.matches('button, [role="button"], [role="tab"]')) return;
        const selected = (button.dataset.tier || button.dataset.selectTier) === tier;
        if (button.hasAttribute('data-tier')) button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('is-active', selected);
        if (button.getAttribute('role') === 'tab') button.setAttribute('aria-selected', String(selected));
      });
      setText('[data-tier-label]', selection.label);
      setText('[data-tier-price]', selection.price);
      setText('[data-keychain-count], [data-giveaway-count]', selection.count);
      setText('[data-keychain-method]', selection.method);
    };

    const scrollToSection = (section) => {
      if (!section) return;
      section.scrollIntoView({ behavior: motionPreference.matches ? 'instant' : 'smooth', block: 'start' });
    };

    const allScenesVisible = () => {
      scenes.forEach((scene) => scene.classList.add('is-visible'));
      root.classList.remove('motion-enabled');
      sceneObserver?.disconnect();
    };

    const observeScenes = () => {
      sceneObserver?.disconnect();
      if (motionPreference.matches || !('IntersectionObserver' in window)) {
        allScenesVisible();
        return;
      }
      root.classList.add('motion-enabled');
      sceneObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          sceneObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
      scenes.forEach((scene) => sceneObserver.observe(scene));
    };

    const updateDock = () => {
      if (!dock) return;
      const visible = opened && dockMedia.matches && root.classList.contains('is-ready')
        && dockState.heroPassed && !dockState.ticketsVisible && !dockState.footerVisible
        && !dialog?.open;
      if (visible === dockVisible) return;
      dockVisible = visible;
      dock.classList.toggle('is-visible', visible);
      dock.setAttribute('aria-hidden', String(!visible));
      dock.inert = !visible;
    };

    // Only old browsers without IntersectionObserver need a mobile scroll fallback.
    const fallbackDock = () => {
      if (!opened || !dockMedia.matches || dockFrame) return;
      dockFrame = requestAnimationFrame(() => {
        dockFrame = 0;
        const heroRect = hero?.getBoundingClientRect();
        const ticketRect = ticketSection?.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();
        dockState.heroPassed = !!heroRect && heroRect.bottom < 80;
        dockState.ticketsVisible = !!ticketRect && ticketRect.bottom > 0 && ticketRect.top < innerHeight;
        dockState.footerVisible = !!footerRect && footerRect.bottom > 0 && footerRect.top < innerHeight;
        updateDock();
      });
    };

    const observeDock = () => {
      dockObservers.forEach(observer => observer.disconnect());
      dockObservers.length = 0;
      window.removeEventListener('scroll', fallbackDock);
      if (!dock || !opened || !dockMedia.matches) { updateDock(); return; }
      if ('IntersectionObserver' in window) {
        const heroObserver = new IntersectionObserver(entries => {
          dockState.heroPassed = entries[0].boundingClientRect.bottom <= 80;
          updateDock();
        }, { rootMargin: '-80px 0px 0px 0px', threshold: 0 });
        if (hero) heroObserver.observe(hero);
        const contentObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            const visible = entry.isIntersecting && entry.intersectionRect.height > 0;
            if (entry.target === ticketSection) dockState.ticketsVisible = visible;
            if (entry.target === footer) dockState.footerVisible = visible;
          });
          updateDock();
        }, { threshold: [0, .001] });
        [ticketSection, footer].filter(Boolean).forEach(element => contentObserver.observe(element));
        dockObservers.push(heroObserver, contentObserver);
      } else {
        window.addEventListener('scroll', fallbackDock, { passive: true });
        fallbackDock();
      }
    };

    const finishOpening = () => {
      root.classList.remove('is-opening');
      root.classList.add('is-ready');
      updateDock();
      window.dispatchEvent(new CustomEvent('invitation:ready'));
    };

    const openInvitation = (replay = false) => {
      if (opened && !replay) return;
      opened = true;
      window.clearTimeout(openingTimer);
      window.cancelAnimationFrame(openingFrame);
      root.classList.remove('is-ready', 'is-opening');
      if (replay) window.scrollTo({ top: 0, behavior: 'instant' });
      observeScenes();
      observeDock();
      if (motionPreference.matches) {
        allScenesVisible();
        finishOpening();
        return;
      }
      // A committed initial frame lets CSS replay the paper-opening sequence.
      void root.offsetWidth;
      openingFrame = window.requestAnimationFrame(() => {
        root.classList.add('is-opening');
        openingTimer = window.setTimeout(finishOpening, 1400);
      });
    };

    const closeReservation = () => {
      if (!dialog) return;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      updateDock();
    };

    const openReservation = (trigger) => {
      if (!dialog) return;
      const requestedTier = trigger.dataset.reserve || trigger.dataset.tier || trigger.dataset.selectTier;
      if (Object.prototype.hasOwnProperty.call(tiers, requestedTier)) selectTier(requestedTier);
      // This dialog only summarizes a selection; it never pretends to book a ticket.
      selectCity(city);
      selectTier(tier);
      lastDialogTrigger = trigger;
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      updateDock();
      dialog.querySelector('[data-close-reservation]')?.focus({ preventScroll: true });
    };

    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const cityButton = target.closest('button[data-city], [role="tab"][data-city]');
      if (cityButton) {
        selectCity(cityButton.dataset.city);
        return;
      }
      const reserveButton = target.closest('[data-reserve]');
      if (reserveButton) {
        event.preventDefault();
        openReservation(reserveButton);
        return;
      }
      const tierButton = target.closest('button[data-tier], button[data-select-tier], [role="tab"][data-tier]');
      if (tierButton) {
        selectTier(tierButton.dataset.tier || tierButton.dataset.selectTier);
        if (tierButton.hasAttribute('data-select-tier')) scrollToSection(document.getElementById('ticket-package'));
        return;
      }
      if (target.closest('[data-close-reservation]')) {
        closeReservation();
        return;
      }
      if (target.closest('[data-replay-reveal]')) {
        event.preventDefault();
        openInvitation(true);
        return;
      }
      const anchor = target.closest('a[href^="#"]');
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.ctrlKey
          || event.metaKey || event.shiftKey || event.altKey) return;
      const id = anchor.getAttribute('href').slice(1);
      if (!id) return;
      let destination;
      try { destination = document.getElementById(decodeURIComponent(id)); } catch (_) { return; }
      if (!destination || !root.contains(destination)) return;
      event.preventDefault();
      scrollToSection(destination);
    });

    if (dialog) {
      if (!root.contains(dialog)) {
        dialog.querySelectorAll('[data-close-reservation]').forEach((button) => {
          button.addEventListener('click', closeReservation);
        });
      }
      const outsideDialog = (event) => {
        const rect = dialog.getBoundingClientRect();
        return event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom;
      };
      dialog.addEventListener('pointerdown', (event) => {
        dialogPointerDownOutside = event.target === dialog && outsideDialog(event);
      });
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog && dialogPointerDownOutside && outsideDialog(event)) closeReservation();
        dialogPointerDownOutside = false;
      });
      dialog.addEventListener('close', () => {
        updateDock();
        if (lastDialogTrigger?.isConnected) lastDialogTrigger.focus({ preventScroll: true });
      });
    }

    const onMotionChange = () => {
      if (motionPreference.matches) updateTierGifts(tier, false);
      if (!opened) return;
      if (motionPreference.matches) {
        window.clearTimeout(openingTimer);
        window.cancelAnimationFrame(openingFrame);
        allScenesVisible();
        finishOpening();
      }
    };
    if (typeof motionPreference.addEventListener === 'function') motionPreference.addEventListener('change', onMotionChange);
    else if (typeof motionPreference.addListener === 'function') motionPreference.addListener(onMotionChange);

    selectCity(city);
    selectTier(tier);
    if (dock) {
      dock.inert = true;
      dock.setAttribute('aria-hidden', 'true');
    }
    window.addEventListener('invitation:open', () => openInvitation());
    if (dockMedia.addEventListener) dockMedia.addEventListener('change', observeDock);
    else dockMedia.addListener(observeDock);
    window.addEventListener('resize', () => {
      if (!('IntersectionObserver' in window)) fallbackDock();
    }, { passive: true });
    if (document.body.classList.contains('invitation-open')) openInvitation();
    const previewInvitation = () => {
      if (window.location.hash.toLowerCase() === '#invitation') {
        window.dispatchEvent(new CustomEvent('invitation:preview'));
      }
    };
    window.addEventListener('hashchange', previewInvitation);
    // Wait until the main phone integration has installed its preview listener.
    window.setTimeout(previewInvitation, 0);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
