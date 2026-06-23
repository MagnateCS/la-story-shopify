(function () {
  const viewTransitionRenderBlocker = document.getElementById('view-transition-render-blocker');
  // Remove the view transition render blocker if the user has reduced motion enabled or is on a low power device.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isLowPowerDevice()) {
    viewTransitionRenderBlocker?.remove();
  } else {
    // If the browser didn't manage to parse the main content quickly, at least let the user see something.
    // We're aiming for the FCP to be under 1.8 seconds since the navigation started.
    const RENDER_BLOCKER_TIMEOUT_MS = Math.max(0, 1800 - performance.now());

    setTimeout(() => {
      viewTransitionRenderBlocker?.remove();
    }, RENDER_BLOCKER_TIMEOUT_MS);
  }

  const idleCallback = typeof requestIdleCallback === 'function' ? requestIdleCallback : setTimeout;

  const overlay = document.getElementById('page-transition-overlay');
  const OVERLAY_DURATION = 300;
  const OVERLAY_EASING = 'ease-in-out';

  console.log('[page-transition] script loaded, overlay el:', overlay);

  window.addEventListener('pageswap', async (event) => {
    const { viewTransition } = /** @type {PageSwapEvent} */ (event);

    console.log('[page-transition] pageswap fired, viewTransition:', viewTransition);

    if (shouldSkipViewTransition(viewTransition)) {
      console.log('[page-transition] skipping — shouldSkipViewTransition returned true');
      /** @type {ViewTransition | null} */ (viewTransition)?.skipTransition();
      return;
    }

    overlay?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: OVERLAY_DURATION,
      fill: 'forwards',
      easing: OVERLAY_EASING,
    });
    console.log('[page-transition] overlay fade-in started');

    // Cancel view transition on user interaction to improve INP (Interaction to Next Paint)
    ['pointerdown', 'keydown'].forEach((eventName) => {
      document.addEventListener(
        eventName,
        () => {
          viewTransition.skipTransition();
        },
        { once: true }
      );
    });

    // Clean in case you landed on the pdp first. We want to remove the default transition type on the PDP media gallery so there is no duplicate transition name
    document
      .querySelectorAll('[data-view-transition-type]:not([data-view-transition-triggered])')
      .forEach((element) => {
        element.removeAttribute('data-view-transition-type');
      });

    const transitionTriggered = document.querySelector('[data-view-transition-triggered]');
    const transitionType = transitionTriggered?.getAttribute('data-view-transition-type');

    if (transitionType) {
      viewTransition.types.clear();
      viewTransition.types.add(transitionType);
      sessionStorage.setItem('custom-transition-type', transitionType);
    } else {
      viewTransition.types.clear();
      viewTransition.types.add('page-navigation');
      sessionStorage.removeItem('custom-transition-type');
    }
  });

  window.addEventListener('pagereveal', async (event) => {
    const { viewTransition } = /** @type {PageRevealEvent} */ (event);

    console.log('[page-transition] pagereveal fired, viewTransition:', viewTransition);

    if (shouldSkipViewTransition(viewTransition)) {
      console.log('[page-transition] skipping — shouldSkipViewTransition returned true');
      /** @type {ViewTransition | null} */ (viewTransition)?.skipTransition();
      return;
    }

    if (overlay) {
      overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: OVERLAY_DURATION,
        fill: 'forwards',
        easing: OVERLAY_EASING,
      });
      console.log('[page-transition] overlay fade-out started');
    }

    const customTransitionType = sessionStorage.getItem('custom-transition-type');

    if (customTransitionType) {
      viewTransition.types.clear();
      viewTransition.types.add(customTransitionType);

      await viewTransition.finished;

      viewTransition.types.clear();
      viewTransition.types.add('page-navigation');

      idleCallback(() => {
        sessionStorage.removeItem('custom-transition-type');
        document.querySelectorAll('[data-view-transition-type]').forEach((element) => {
          element.removeAttribute('data-view-transition-type');
        });
      });
    } else {
      viewTransition.types.clear();
      viewTransition.types.add('page-navigation');
    }
  });

  /**
   * @param {ViewTransition | null} viewTransition
   * @returns {viewTransition is null}
   */
  function shouldSkipViewTransition(viewTransition) {
    return !(viewTransition instanceof ViewTransition) || isLowPowerDevice();
  }

  /*
   * We can't import this logic from utilities.js here, but we should keep them in sync.
   */
  function isLowPowerDevice() {
    /* Skip ESLint compatibility check. Number(undefined) <= 2 is always false anyway. */
    /* eslint-disable-next-line compat/compat */
    return Number(navigator.hardwareConcurrency) <= 2 || Number(navigator.deviceMemory) <= 2;
  }
})();
