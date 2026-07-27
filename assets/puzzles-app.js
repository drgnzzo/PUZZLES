'use strict';

    /**
     * La tienda se ejecuta dentro de la Web App de Apps Script y usa
     * google.script.run. GitHub Pages únicamente aloja este recurso y el iframe
     * exterior; no se requiere una URL CORS directa aquí.
     */
    const GITHUB_GAS_URL = '';
    const PUZZLES_OFFICIAL_LOGO_URL = 'https://drgnzzo.github.io/PUZZLES/assets/puzzles_logo.png?rev=stable';
    const PUZZLES_OFFICIAL_MARK_URL = 'https://drgnzzo.github.io/PUZZLES/assets/puzzles_logo_mark.png?rev=stable';

    const STORAGE_KEYS = Object.freeze({
      CART: 'puzzles_cart_v3',
      AGE: 'puzzles_age_confirmed_v1',
      CUSTOMER: 'puzzles_customer_v2',
      VIEW: 'puzzles_catalog_view_v1',
      SESSION: 'puzzles_session_v1',
      STORE: 'puzzles_store_snapshot_v1_6_0_editorial'
    });

    const PUZZLES_STORAGE_MEMORY = {};

    function puzzlesStorageGet(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (_) {
        return Object.prototype.hasOwnProperty.call(
          PUZZLES_STORAGE_MEMORY,
          key
        ) ? PUZZLES_STORAGE_MEMORY[key] : null;
      }
    }

    function puzzlesStorageSet(key, value) {
      PUZZLES_STORAGE_MEMORY[key] =
        String(value);

      try {
        window.localStorage.setItem(
          key,
          String(value)
        );
      } catch (_) {}
    }

    function puzzlesStorageRemove(key) {
      delete PUZZLES_STORAGE_MEMORY[key];

      try {
        window.localStorage.removeItem(key);
      } catch (_) {}
    }

    const state = {
      loading: true,
      store: {
        name: 'PUZZLES',
        subtitle: 'Vinos, licores y destilados',
        hero: 'No eliges solamente una botella. Eliges cómo quieres vivir el momento.',
        priceNotice: 'Cada precio y disponibilidad se confirma antes de cerrar la solicitud.',
        whatsapp: '',
        currency: 'MXN',
        allowDelivery: true,
        allowPickup: true,
        minimumOrder: 0,
        showWithoutTax: true,
        footerText: 'Elige con intención y disfruta con responsabilidad. Venta exclusiva para mayores de 18 años.'
      },
      products: [],
      categories: [],
      filtered: [],
      search: '',
      category: 'Todas',
      brand: 'Todas',
      brands: [],
      editorialIntent: null,
      ageConfirmedThisVisit: false,
      minPrice: '',
      maxPrice: '',
      includeConsult: true,
      sort: 'featured',
      view: 'grid',
      page: 1,
      pageSize: 25,
      cart: loadJson(STORAGE_KEYS.CART, {}),
      quantities: {},
      submitting: false,
      user: null,
      sessionToken: puzzlesStorageGet(STORAGE_KEYS.SESSION) || '',
      carouselIndex: 0,
      carouselTimer: null,
      searchScores: new Map(),
      hasStoreSnapshot: false,
      storeRefreshError: '',
      isAdmin: false,
      isStudio: false,
      studioStatus: 'TODOS',
      studioProducts: [],
      studioSelected: new Set(),
      adminPrices: {},
      detailProductCode: '',
      detailQuantity: 1,
      initialLoadPromise: null,
      initialLoadComplete: false,
      entrySplashActive: false,
      intentWelcomeShown: false,
      lastOrder: null
    };

    const dom = {};

    document.addEventListener(
      'DOMContentLoaded',
      function () {
        init().catch(function (error) {
          console.error(
            'PUZZLES init error:',
            error
          );

          var loading =
            document.getElementById('loadingState');

          var errorState =
            document.getElementById('errorState');

          var errorMessage =
            document.getElementById('errorMessage');

          if (loading) {
            loading.classList.add('hidden');
          }

          if (errorState) {
            errorState.classList.remove('hidden');
          }

          if (errorMessage) {
            errorMessage.textContent =
              'La interfaz cargó, pero ocurrió un error: ' +
              (
                error && error.message
                  ? error.message
                  : String(error)
              );
          }
        });
      }
    );



    function cleanupLegacyBrandArtifacts() {
      const keepIds = new Set(['ageGateLogo', 'entrySplashLogo', 'siteHeaderLogo', 'footerLogo']);
      const keepSelectors = [
        '#ageGate .age-gate__logo-wrap',
        '#entrySplash .entry-splash__inner',
        '.site-header__logo-link',
        '.footer__logo-link'
      ];

      document.querySelectorAll('.brand--gate, .brand.brand--official, .brand.brand--asset, img.brand__official-logo').forEach(function (node) {
        if (!node) return;
        if (node.id && keepIds.has(node.id)) return;
        if (keepSelectors.some(function (selector) { return node.closest(selector); })) return;
        node.remove();
      });

      document.querySelectorAll('body > img').forEach(function (img) {
        const src = (img.getAttribute('src') || '').toLowerCase();
        if (src.indexOf('puzzles_logo') !== -1 || src.indexOf('logo-puzzles') !== -1) {
          img.remove();
        }
      });

      document.body.classList.add('logo-fix-ready');
    }

    function repairEntryStructure() {
      let ageGate = document.getElementById('ageGate');

      if (!ageGate) {
        const legacyBrand = document.querySelector('body > .brand--gate, body > .brand.brand--official');
        const ageTitle = document.getElementById('ageTitle');
        const actions = document.querySelector('body > .age-gate__actions');
        const denied = document.getElementById('ageDenied');

        if (legacyBrand && ageTitle) {
          const paragraph = ageTitle.nextElementSibling && ageTitle.nextElementSibling.tagName === 'P'
            ? ageTitle.nextElementSibling
            : null;
          const prompt = document.createElement('div');
          prompt.id = 'agePrompt';
          prompt.appendChild(ageTitle);
          if (paragraph) prompt.appendChild(paragraph);
          if (actions) prompt.appendChild(actions);

          const card = document.createElement('div');
          card.className = 'age-gate__card';
          card.appendChild(legacyBrand);
          card.appendChild(prompt);
          if (denied) card.appendChild(denied);

          ageGate = document.createElement('div');
          ageGate.id = 'ageGate';
          ageGate.className = 'age-gate';
          ageGate.setAttribute('role', 'dialog');
          ageGate.setAttribute('aria-modal', 'true');
          ageGate.setAttribute('aria-labelledby', 'ageTitle');
          ageGate.appendChild(card);
          document.body.insertBefore(ageGate, document.body.firstChild);
        }
      }

      const legacyLogo = ageGate && ageGate.querySelector('.brand--gate img, .brand__official-logo');
      if (legacyLogo && !document.getElementById('ageGateLogo')) {
        legacyLogo.id = 'ageGateLogo';
        legacyLogo.className = 'age-gate__logo';
        const parent = legacyLogo.parentElement;
        if (parent) parent.className = 'age-gate__logo-wrap';
      }

      const headerAccount = document.getElementById('btnAccountHeader');
      if (headerAccount && !document.getElementById('btnLogoutHeader')) {
        const button = document.createElement('button');
        button.className = 'icon-button header-logout-button hidden';
        button.id = 'btnLogoutHeader';
        button.type = 'button';
        button.hidden = true;
        button.setAttribute('aria-label', 'Cerrar sesión');
        button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 5H5v14h5"></path><path d="M13 8l4 4-4 4"></path><path d="M8 12h9"></path></svg><span class="icon-button__label">Salir</span>';
        headerAccount.insertAdjacentElement('afterend', button);
      }

      document.body.classList.add('entry-structure-ready');
      cleanupLegacyBrandArtifacts();
    }

    function setText(element, value) {
      if (!element) return;
      element.textContent = value == null ? '' : String(value);
    }

    function setDisplay(element, value) {
      if (!element) return;
      element.style.display = value;
    }

    function installInteractionFeedback() {
      document.addEventListener('pointerdown', function (event) {
        const control = event.target.closest('button, .btn, [role="button"], a[href]');
        if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
        control.classList.add('is-pressing');
      });

      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (eventName) {
        document.addEventListener(eventName, function (event) {
          const control = event.target.closest && event.target.closest('button, .btn, [role="button"], a[href]');
          if (control) control.classList.remove('is-pressing');
        });
      });

      document.addEventListener('click', function (event) {
        const control = event.target.closest('button, .btn, [role="button"], a[href]');
        if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
        control.classList.remove('was-clicked');
        void control.offsetWidth;
        control.classList.add('was-clicked');
        window.setTimeout(function () { control.classList.remove('was-clicked'); }, 420);
      });
    }

    async function init() {
      puzzlesStorageRemove('puzzles_cart_v1');
      puzzlesStorageRemove('puzzles_cart_v2');

      repairEntryStructure();
      cleanupLegacyBrandArtifacts();
      cacheDom();
      installInteractionFeedback();

      // La vista inicial depende del dispositivo:
      // móvil abre en lista y escritorio abre en cuadrícula.
      // No se recuperan preferencias antiguas.
      puzzlesStorageRemove(
        STORAGE_KEYS.VIEW
      );

      state.view = window.matchMedia(
        '(max-width: 760px)'
      ).matches
        ? 'table'
        : 'grid';
      bindEvents();
      restoreAgeGate();
      restoreCustomer();

      if (dom.footerYear) {
        dom.footerYear.textContent =
          new Date().getFullYear();
      }

      state.loading = false;
      renderCarousel();
      setView(state.view, false);
      renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);

      const restored = restoreStoreSnapshot();

      if (!restored) {
        showCatalogShell();
      }

      const storeRequest = loadStore({
        background: restored
      });

      const sessionRequest = restoreSession();

      state.initialLoadPromise = Promise
        .allSettled([
          storeRequest,
          sessionRequest
        ])
        .then(function () {
          state.initialLoadComplete = true;
          restoreAgeGate();
        });

      await state.initialLoadPromise;

      setTimeout(
        maybeOpenIntentWelcome,
        220
      );
    }

    function cacheDom() {
      [
        'ageGate','agePrompt','ageDenied','btnAgeNo','btnAgeYes','announcementText',
        'brandName','brandSubtitle','feature1Title','featureCatalogText','feature2Title','feature2Text','feature3Title','feature3Text','catalogKicker','catalogTitle','catalogDescription','githubSetup',
        'heroCarousel','heroSlides','heroDots','btnHeroPrev','btnHeroNext','btnMomentsHeader',
        'intentWelcomeBackdrop','intentWelcomeModal','btnCloseIntentWelcome','intentWelcomeOptions','btnIntentCatalog',
        'categoryList','brandFilter','priceMin','priceMax','includeConsult','filtersPanel','btnClearFilters',
        'btnMobileFilters','searchInput','sortSelect','btnGridView','btnTableView',
        'resultCount','resultRange','activeFilterWrap','loadingState','errorState','errorMessage',
        'emptyState','gridView','tableView','pagination','btnRetry','btnEmptyClear',
        'btnHeaderWhatsApp','btnFooterWhatsApp','btnSearchHeader','btnAccountHeader','btnLogoutHeader','accountLabel','ageGateLogo','entrySplashLogo','siteHeaderLogo','footerLogo',
        'btnCartHeader','headerCartCount','floatingCart','floatingCartCount',
        'mainBackdrop','cartDrawer','btnCloseCart','cartBody','cartFooter','cartUnits',
        'cartSubtotal','cartTotal','btnCheckout','minimumOrderNote',
        'checkoutBackdrop','checkoutModal','btnCloseCheckout','btnCancelCheckout',
        'checkoutForm','customerName','customerPhone','customerEmail','fulfillmentOptions',
        'addressGroup','customerAddress','customerStreet','customerExterior','customerInterior','customerNeighborhood','customerPostalCode','customerCity','customerState','customerReferences','customerNotes','website','checkoutAge',
        'checkoutItemsText','checkoutUnitsText','checkoutTotal','checkoutError','btnSubmitOrder',
        'successBackdrop','successModal','successFolio','successTotal','btnSuccessWhatsApp',
        'btnSuccessClose','footerText','footerYear','toastStack',
        'authBackdrop','authModal','authTitle','btnCloseAuth','btnAuthLoginTab','btnAuthRegisterTab',
        'btnGoogleLogin','loginForm','loginEmail','loginPassword','loginError',
        'registerForm','registerName','registerEmail','registerPassword','registerError',
        'accountPanel','accountName','accountEmail','accountRole','btnLogout',
        'productDetailBackdrop','productDetailModal','btnCloseProductDetail','productDetailTitle','productDetailContent',
        'imageZoomBackdrop','imageZoomModal','btnCloseImageZoom','zoomedProductImage',
        'entrySplash','entrySplashBar'
      ].forEach(id => dom[id] = document.getElementById(id));
    }

    function listen(
      element,
      eventName,
      handler,
      options
    ) {
      if (
        !element ||
        typeof element.addEventListener !== 'function'
      ) {
        return;
      }

      element.addEventListener(
        eventName,
        handler,
        options
      );
    }

    function bindEvents() {
      listen(dom.btnAgeYes, 'click', confirmAge);
      listen(dom.btnAgeNo, 'click', denyAge);
      listen(dom.btnHeroPrev, 'click', () => moveCarousel(-1));
      listen(dom.btnHeroNext, 'click', () => moveCarousel(1));
      listen(dom.btnAccountHeader, 'click', openAuth);
      listen(dom.btnCloseAuth, 'click', closeAuth);
      listen(dom.authBackdrop, 'click', closeAuth);
      listen(dom.btnAuthLoginTab, 'click', () => setAuthTab('login'));
      listen(dom.btnAuthRegisterTab, 'click', () => setAuthTab('register'));
      listen(dom.loginForm, 'submit', submitLogin);
      listen(dom.registerForm, 'submit', submitRegister);
      listen(dom.btnGoogleLogin, 'click', submitGoogleLogin);
      listen(dom.btnLogout, 'click', logoutUser);
      listen(dom.btnLogoutHeader, 'click', logoutUser);

      document.querySelectorAll('[data-scroll-catalog]').forEach(button => {
        button.addEventListener('click', () => document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' }));
      });

      listen(
        dom.btnMomentsHeader,
        'click',
        () => openIntentWelcome(true)
      );

      listen(
        dom.btnCloseIntentWelcome,
        'click',
        () => closeIntentWelcome(false)
      );

      listen(
        dom.intentWelcomeBackdrop,
        'click',
        () => closeIntentWelcome(false)
      );

      listen(
        dom.btnIntentCatalog,
        'click',
        () => closeIntentWelcome(true)
      );

      document.addEventListener('click', event => {
        const intentTrigger = event.target.closest('[data-editorial-action]');
        if (!intentTrigger) return;

        event.preventDefault();
        handleEditorialAction(
          intentTrigger.dataset.editorialAction || 'catalog'
        );
      });

      listen(dom.btnSearchHeader, 'click', () => {
        const catalog = document.getElementById('catalogo');
        const mobile = window.matchMedia('(max-width: 760px)').matches;
        if (catalog) catalog.scrollIntoView({ behavior: mobile ? 'auto' : 'smooth', block: 'start' });
        setTimeout(() => {
          if (dom.searchInput) {
            try { dom.searchInput.focus({ preventScroll: true }); }
            catch (_) { dom.searchInput.focus(); }
          }
        }, mobile ? 60 : 500);
      });

      [dom.btnHeaderWhatsApp, dom.btnFooterWhatsApp].filter(Boolean).forEach(button => {
        button.addEventListener('click', openConcierge);
      });

      listen(dom.searchInput, 'input', debounce(() => {
        state.search = dom.searchInput.value;
        state.page = 1;
        applyFilters();
      }, 160));

      listen(dom.priceMin, 'input', debounce(() => {
        state.minPrice = dom.priceMin.value;
        state.page = 1;
        applyFilters();
      }, 160));

      listen(dom.priceMax, 'input', debounce(() => {
        state.maxPrice = dom.priceMax.value;
        state.page = 1;
        applyFilters();
      }, 160));

      listen(dom.includeConsult, 'change', () => {
        state.includeConsult = dom.includeConsult.checked;
        state.page = 1;
        applyFilters();
      });

      listen(dom.brandFilter, 'change', () => {
        state.brand = dom.brandFilter.value || 'Todas';
        state.page = 1;
        applyFilters();
      });

      listen(dom.sortSelect, 'change', () => {
        state.sort = dom.sortSelect.value;
        state.page = 1;
        applyFilters();
      });

      listen(dom.btnGridView, 'click', () => setView('grid'));
      listen(dom.btnTableView, 'click', () => setView('table'));
      listen(dom.btnClearFilters, 'click', clearFilters);
      listen(dom.btnEmptyClear, 'click', clearFilters);
      listen(dom.btnRetry, 'click', () => loadStore({ background: state.hasStoreSnapshot }));

      listen(dom.btnMobileFilters, 'click', () => openFilters());
      listen(dom.mainBackdrop, 'click', closeOverlays);

      listen(dom.btnCartHeader, 'click', openCart);
      listen(dom.floatingCart, 'click', openCart);
      listen(dom.btnCloseCart, 'click', closeCart);
      listen(dom.btnCheckout, 'click', openCheckout);

      listen(dom.checkoutBackdrop, 'click', closeCheckout);
      listen(dom.btnCloseCheckout, 'click', closeCheckout);
      listen(dom.btnCancelCheckout, 'click', closeCheckout);
      listen(dom.checkoutForm, 'submit', submitOrder);
      listen(dom.fulfillmentOptions, 'change', updateAddressVisibility);

      listen(dom.successBackdrop, 'click', closeSuccess);
      listen(dom.btnSuccessClose, 'click', closeSuccess);

      listen(dom.productDetailBackdrop, 'click', closeProductDetail);
      listen(dom.btnCloseProductDetail, 'click', closeProductDetail);
      listen(dom.imageZoomBackdrop, 'click', closeImageZoom);
      listen(dom.btnCloseImageZoom, 'click', closeImageZoom);

      document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-product-detail]');
        if (!trigger) return;
        event.preventDefault();
        openProductDetail(trigger.dataset.productDetail);
      });

      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (
          dom.intentWelcomeModal &&
          dom.intentWelcomeModal.classList.contains('is-open')
        ) {
          closeIntentWelcome(false);
        }
        else if (dom.imageZoomModal.classList.contains('is-open')) closeImageZoom();
        else if (dom.productDetailModal.classList.contains('is-open')) closeProductDetail();
        else if (dom.successModal.classList.contains('is-open')) closeSuccess();
        else if (dom.authModal.classList.contains('is-open')) closeAuth();
        else if (dom.checkoutModal.classList.contains('is-open')) closeCheckout();
        else closeOverlays();
      });
    }


    function showCatalogShell() {
      state.loading = false;

      if (dom.loadingState) {
        dom.loadingState.classList.add('hidden');
      }

      if (dom.errorState) {
        dom.errorState.classList.add('hidden');
      }

      if (dom.emptyState) {
        dom.emptyState.classList.add('hidden');
      }

      if (dom.gridView) {
        dom.gridView.classList.remove('hidden');
        dom.gridView.innerHTML = '';
      }

      if (dom.tableView) {
        dom.tableView.classList.add('hidden');
      }

      if (dom.pagination) {
        dom.pagination.classList.add('hidden');
      }

      if (dom.resultCount) {
        dom.resultCount.textContent =
          'Colección disponible';
      }

      if (dom.resultRange) {
        setText(dom.resultRange, '');
      }
    }

    function restoreStoreSnapshot() {
      const snapshot = loadJson(
        STORAGE_KEYS.STORE,
        null
      );

      if (
        !snapshot ||
        !snapshot.ok ||
        !Array.isArray(snapshot.products)
      ) {
        return false;
      }

      hydrateStoreResult(snapshot);
      state.hasStoreSnapshot = true;
      return true;
    }

    function saveStoreSnapshot(result) {
      try {
        puzzlesStorageSet(
          STORAGE_KEYS.STORE,
          JSON.stringify({
            ok: true,
            version: result.version || '',
            store: result.store || {},
            products: Array.isArray(result.products)
              ? result.products
              : [],
            categories: Array.isArray(result.categories)
              ? result.categories
              : [],
            stats: result.stats || {},
            savedAt: Date.now()
          })
        );
      } catch (_) {}
    }

    function hydrateStoreResult(result) {
      state.store = Object.assign(
        {},
        state.store,
        result.store || {}
      );

      const incomingProducts = Array.isArray(result.products)
        ? result.products.map(normalizeProductRecord).filter(function (product) {
            return product && String(product.code || '').trim();
          })
        : [];

      if (!incomingProducts.length && state.products.length) {
        throw new Error('La actualización llegó vacía; se conserva el catálogo anterior.');
      }

      state.products = incomingProducts;

      state.categories = Array.isArray(result.categories)
        ? result.categories
        : [];

      state.brands = Array.from(
        new Set(
          state.products
            .map(product => product.brand)
            .filter(Boolean)
        )
      ).sort((a, b) =>
        a.localeCompare(
          b,
          'es',
          { sensitivity: 'base', numeric: true }
        )
      );

      state.loading = false;

      applyStoreConfig(result.stats || {});
      renderCategories();
      renderBrands();
      normalizeCartAgainstCatalog();
      applyFilters();
      renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);
    }

    // ==========================================================
    // BACKEND HÍBRIDO: APPS SCRIPT O GITHUB PAGES
    // ==========================================================

    function isAppsScriptHost() {
      return typeof google !== 'undefined' && google.script && google.script.run;
    }

    function isGithubBackendConfigured() {
      return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(GITHUB_GAS_URL);
    }

    function gasRun(
      functionName,
      payload,
      timeoutMs
    ) {
      return new Promise((resolve, reject) => {
        const limit = Math.max(
          5000,
          timeoutMs || 25000
        );

        let finished = false;

        const timer = setTimeout(() => {
          if (finished) return;

          finished = true;

          reject(
            new Error(
              'La consulta del catálogo tardó demasiado. ' +
              'Revisa que la implementación de Apps Script ' +
              'permita el acceso a cualquier persona.'
            )
          );
        }, limit);

        try {
          let runner = google.script.run
            .withSuccessHandler(result => {
              if (finished) return;

              finished = true;
              clearTimeout(timer);
              resolve(result);
            })
            .withFailureHandler(error => {
              if (finished) return;

              finished = true;
              clearTimeout(timer);

              reject(
                new Error(
                  error && error.message
                    ? error.message
                    : String(error)
                )
              );
            });

          if (payload === undefined) {
            runner[functionName]();
          } else {
            runner[functionName](payload);
          }
        } catch (error) {
          if (finished) return;

          finished = true;
          clearTimeout(timer);
          reject(error);
        }
      });
    }

    function gasRunArgs(functionName, args, timeoutMs) {
      return new Promise((resolve, reject) => {
        const limit = Math.max(5000, timeoutMs || 25000);
        let finished = false;
        const timer = setTimeout(() => {
          if (finished) return;
          finished = true;
          reject(new Error('La operación tardó demasiado. Intenta nuevamente.'));
        }, limit);

        try {
          const runner = google.script.run
            .withSuccessHandler(result => {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              resolve(result);
            })
            .withFailureHandler(error => {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              reject(new Error(error && error.message ? error.message : String(error)));
            });

          const method = runner[functionName];
          if (typeof method !== 'function') throw new Error('La función ' + functionName + ' no está disponible.');
          method.apply(runner, Array.isArray(args) ? args : []);
        } catch (error) {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          reject(error);
        }
      });
    }

    async function backendGetStore() {
      if (isAppsScriptHost()) {
        return gasRun(
          'getStoreData',
          undefined,
          30000
        );
      }

      dom.githubSetup.classList.add(
        'is-visible'
      );

      throw new Error(
        'La interfaz necesita abrirse desde la Web App ' +
        'publicada de Apps Script.'
      );
    }

    async function backendCreateOrder(payload) {
      if (isAppsScriptHost()) return gasRun('createOrder', payload);
      throw new Error('Los pedidos deben registrarse desde la aplicación publicada en Apps Script.');
    }


    async function backendRegister(payload) { return gasRun('registerAccount', payload); }
    async function backendLogin(payload) { return gasRun('loginAccount', payload); }
    async function backendGoogleLogin() { return gasRun('loginWithGoogleAccount'); }
    async function backendRestoreSession(token) { return gasRun('restoreUserSession', token); }
    async function backendLogout(token) { return gasRun('logoutAccount', token); }
    async function backendGetAdminPricing(token) { return gasRun('getAdminPricing', token); }
    async function backendSaveAccountState(payload) {
      if (!state.sessionToken || !isAppsScriptHost()) return { ok: false };
      return gasRun('saveAccountState', { token: state.sessionToken, payload: payload });
    }

    // ==========================================================
    // CARGA Y CONFIGURACIÓN VISUAL
    // ==========================================================

    async function loadStore(options) {
      const background = Boolean(
        options && options.background
      );

      state.storeRefreshError = '';

      if (!background) {
        showCatalogShell();
      }

      try {
        const result = await backendGetStore();

        if (!result || !result.ok) {
          throw new Error(
            (result && result.error) ||
            'No se recibió una colección válida.'
          );
        }

        hydrateStoreResult(result);
        saveStoreSnapshot(result);
        state.hasStoreSnapshot = true;

      } catch (error) {
        state.loading = false;
        state.storeRefreshError =
          error && error.message
            ? error.message
            : String(error);

        if (state.hasStoreSnapshot) {
          showToast(
            'Se conserva la última versión disponible de la colección.',
            'warning'
          );
          return;
        }

        if (dom.errorMessage) {
          dom.errorMessage.textContent =
            state.storeRefreshError;
        }

        showOnlyState('error');
      }
    }


    function applyBrandLogos() {
      const targets = [
        [dom.ageGateLogo, PUZZLES_OFFICIAL_LOGO_URL],
        [dom.entrySplashLogo, PUZZLES_OFFICIAL_LOGO_URL],
        [dom.siteHeaderLogo, PUZZLES_OFFICIAL_MARK_URL],
        [dom.footerLogo, PUZZLES_OFFICIAL_LOGO_URL]
      ];

      targets.forEach(([image, source]) => {
        if (!image) return;
        image.src = source;
        image.removeAttribute('width');
        image.removeAttribute('height');
        image.style.transform = 'none';
      });
    }

    function applyStoreConfig(stats) {
      document.title = (state.store.name || 'PUZZLES') + ' · Vinos y licores';
      setText(dom.brandName, state.store.name || 'PUZZLES');
      setText(dom.brandSubtitle, state.store.subtitle || 'Vinos · Licores · Destilados');
      applyBrandLogos();
      setText(dom.announcementText, state.store.priceNotice || 'Disponibilidad sujeta a confirmación.');
      setText(dom.footerText, state.store.footerText || 'Venta exclusiva para mayores de 18 años. Evita el exceso.');

      const features = Array.isArray(state.store.features) ? state.store.features : [];
      setText(dom.feature1Title, (features[0] && features[0].title) || 'MOMENTOS CON INTENCIÓN');
      setText(dom.featureCatalogText, (features[0] && features[0].text) || 'Selecciones para celebrar, compartir, regalar, descubrir o completar tu cava.');
      setText(dom.feature2Title, (features[1] && features[1].title) || 'ELECCIONES MÁS CLARAS');
      setText(dom.feature2Text, (features[1] && features[1].text) || 'Compara categoría, marca, contenido y precio sin perder de vista la ocasión.');
      setText(dom.feature3Title, (features[2] && features[2].title) || 'TU SELECCIÓN, A TU RITMO');
      setText(dom.feature3Text, (features[2] && features[2].text) || 'Guarda lo que te interesa y continúa armando el momento cuando estés listo.');
      setText(dom.catalogKicker, state.store.catalogKicker || 'LA COLECCIÓN COMPLETA');
      setText(dom.catalogTitle, state.store.catalogTitle || 'Cuando ya sabes qué pieza estás buscando');
      setText(dom.catalogDescription, state.store.catalogText || 'Filtra la colección y encuentra la opción que encaja con el momento.');

      [dom.btnHeaderWhatsApp, dom.btnFooterWhatsApp].forEach(function (button) {
        if (button) button.style.display = state.store.whatsapp ? '' : 'none';
      });

      renderCarousel();
      renderEditorialSections();
      renderFulfillmentOptions();
    }

    function heroToHtml(text) {
      const safe = escapeHtml(text || 'Encuentra la pieza correcta para cada ocasión.');
      const target = 'cada ocasión';
      const index = safe.toLowerCase().lastIndexOf(target);
      if (index < 0) return safe;
      return safe.slice(0, index) + '<em>' + safe.slice(index) + '</em>';
    }


    const PUZZLES_BANNER_COPY_FALLBACKS = [
      {
        kicker: 'MOMENTOS PARA BRINDAR',
        title: 'Una celebración toma forma desde la primera elección.',
        text: 'Encuentra vinos, espumosos y destilados para acompañar los momentos que merecen recordarse.',
        ctaText: 'ARMAR MI SELECCIÓN',
        ctaAction: 'intent:celebration',
        imageUrl: 'https://drgnzzo.github.io/PUZZLES/assets/banner-01-editorial.png'
      },
      {
        kicker: 'REGALOS CON INTENCIÓN',
        title: 'Una buena botella también puede decir mucho.',
        text: 'Descubre etiquetas y presentaciones para agradecer, reconocer o celebrar a alguien.',
        ctaText: 'EXPLORAR REGALOS',
        ctaAction: 'intent:gift',
        imageUrl: 'https://drgnzzo.github.io/PUZZLES/assets/banner-02-botellas.png'
      },
      {
        kicker: 'COMPLETA TU CAVA',
        title: 'Tu colección se construye pieza por pieza.',
        text: 'Repón tus esenciales, descubre nuevas etiquetas y mantén una selección preparada para cada ocasión.',
        ctaText: 'VER SELECCIÓN PARA CAVA',
        ctaAction: 'intent:cellar',
        imageUrl: 'https://drgnzzo.github.io/PUZZLES/assets/banner-03-editorial.png'
      },
      {
        kicker: 'PARA COMPARTIR',
        title: 'Cada mesa tiene una combinación que encaja.',
        text: 'Selecciones pensadas para cenas, reuniones, sobremesas y momentos alrededor de la mesa.',
        ctaText: 'ELEGIR PARA MI MESA',
        ctaAction: 'intent:table',
        imageUrl: 'https://drgnzzo.github.io/PUZZLES/assets/banner-04-botellas.png'
      },
      {
        kicker: 'DESCUBRE OTRA PIEZA',
        title: 'Una nueva etiqueta puede cambiar la experiencia.',
        text: 'Explora distintos orígenes, estilos, variedades y perfiles de sabor.',
        ctaText: 'DESCUBRIR PRODUCTOS',
        ctaAction: 'intent:discovery',
        imageUrl: 'https://drgnzzo.github.io/PUZZLES/assets/banner-05-editorial.png'
      },
      {
        kicker: 'SELECCIONES COMPLETAS',
        title: 'Todo lo necesario para armar el momento.',
        text: 'Combinaciones sugeridas para celebrar, compartir, regalar o completar tu cava.',
        ctaText: 'VER SELECCIONES',
        ctaAction: 'intent:selections',
        imageUrl: 'https://drgnzzo.github.io/PUZZLES/assets/banner-06-botellas.png'
      }
    ];

    function renderCarousel() {
      const configuredBanners = Array.isArray(state.store.banners)
        ? state.store.banners.filter(Boolean)
        : [];

      const banners = configuredBanners.length
        ? configuredBanners
        : PUZZLES_BANNER_COPY_FALLBACKS.map(function (banner) {
            return Object.assign({}, banner, {
              showText: true,
              align: 'left',
              darkness: 0.58,
              imagePosition: 'center center'
            });
          });

      if (!dom.heroSlides || !dom.heroDots) return;

      dom.heroSlides.innerHTML = banners
        .map((banner, index) => {
          const fallback =
            PUZZLES_BANNER_COPY_FALLBACKS[
              index %
              PUZZLES_BANNER_COPY_FALLBACKS.length
            ] || {};

          const displayBanner = {
            ...fallback,
            ...banner,
            kicker:
              banner.kicker ||
              fallback.kicker ||
              '',
            title:
              banner.title ||
              fallback.title ||
              '',
            text:
              banner.text ||
              fallback.text ||
              '',
            ctaText:
              banner.ctaText ||
              fallback.ctaText ||
              '',
            ctaAction:
              banner.ctaAction ||
              fallback.ctaAction ||
              'catalog',
            imageUrl:
              banner.imageUrl ||
              fallback.imageUrl ||
              ''
          };

          const align =
            ['left', 'center', 'right'].includes(
              displayBanner.align
            )
              ? displayBanner.align
              : 'left';

          const darkness = Math.max(
            0,
            Math.min(
              0.9,
              Number(displayBanner.darkness || 0.58)
            )
          );

          const showTextValue =
            displayBanner.showText;

          const showText =
            !(
              showTextValue === false ||
              ['false', 'no', '0', 'oculto']
                .includes(
                  String(
                    showTextValue ?? ''
                  )
                    .trim()
                    .toLowerCase()
                )
            );

          const content = showText
            ? `
              <div class="hero-slide__content hero-slide__content--${align}">
                ${displayBanner.kicker
                  ? `<span class="hero-slide__kicker">${escapeHtml(displayBanner.kicker)}</span>`
                  : ''
                }
                ${displayBanner.title
                  ? `<h1>${escapeHtml(displayBanner.title)}</h1>`
                  : ''
                }
                ${displayBanner.text
                  ? `<p>${escapeHtml(displayBanner.text)}</p>`
                  : ''
                }
                ${displayBanner.ctaText
                  ? `
                    <button
                      class="btn btn--gold hero-slide__cta"
                      type="button"
                      data-editorial-action="${escapeAttr(displayBanner.ctaAction || 'catalog')}"
                    >
                      ${escapeHtml(displayBanner.ctaText)}
                    </button>
                  `
                  : ''
                }
              </div>
            `
            : '';

          return `
            <article
              class="hero-slide hero-slide--controlled ${index === state.carouselIndex ? 'is-active' : ''}"
              style="
                --banner-darkness:${darkness};
                --banner-text-color:${escapeAttr(displayBanner.textColor || '#FFFFFF')};
              "
              aria-label="${escapeAttr(displayBanner.title || 'Selección PUZZLES')}"
            >
              <img
                class="hero-slide__artwork"
                src="${escapeAttr(displayBanner.imageUrl || '')}"
                alt="${escapeAttr(displayBanner.title || 'Selección PUZZLES')}"
                style="
                  object-position:${escapeAttr(displayBanner.imagePosition || 'center center')};
                "
                decoding="async"
                fetchpriority="${index === 0 ? 'high' : 'auto'}"
              >
              <div class="hero-slide__shade" aria-hidden="true"></div>
              ${content}
            </article>
          `;
        })
        .join('');

      dom.heroDots.innerHTML = banners
        .map((_, index) => `
          <button
            type="button"
            class="${index === state.carouselIndex ? 'is-active' : ''}"
            data-carousel-index="${index}"
            aria-label="Banner ${index + 1}"
          ></button>
        `)
        .join('');

      dom.heroDots
        .querySelectorAll('[data-carousel-index]')
        .forEach(button => {
          button.addEventListener('click', () => {
            setCarousel(
              Number(button.dataset.carouselIndex)
            );
          });
        });

      restartCarousel();
    }

    function renderEditorialSections() {
      if (!dom.intentWelcomeOptions) {
        return;
      }

      const moments =
        Array.isArray(state.store.moments)
          ? state.store.moments
          : [];

      dom.intentWelcomeOptions.innerHTML = moments
        .slice(0, 6)
        .map(moment => `
          <button
            class="intent-welcome-option"
            type="button"
            data-editorial-action="${escapeAttr(moment.action || 'catalog')}"
          >
            <span>${escapeHtml(moment.eyebrow || '')}</span>
            <strong>${escapeHtml(moment.title || '')}</strong>
            <small>${escapeHtml(moment.text || '')}</small>
          </button>
        `)
        .join('');
    }

    function isAgeConfirmed() {
      return Boolean(
        state.ageConfirmedThisVisit ||
        (
          state.user &&
          state.sessionToken &&
          puzzlesStorageGet(
            STORAGE_KEYS.AGE
          ) === 'true'
        )
      );
    }

    function maybeOpenIntentWelcome() {
      if (
        state.intentWelcomeShown ||
        state.entrySplashActive ||
        !state.initialLoadComplete ||
        !isAgeConfirmed()
      ) {
        return;
      }

      openIntentWelcome(false);
    }

    function openIntentWelcome(force) {
      if (
        !isAgeConfirmed() ||
        (
          state.intentWelcomeShown &&
          !force
        )
      ) {
        return;
      }

      state.intentWelcomeShown = true;
      renderEditorialSections();

      if (dom.intentWelcomeModal) {
        dom.intentWelcomeModal.classList.add(
          'is-open'
        );
      }

      if (dom.intentWelcomeBackdrop) {
        dom.intentWelcomeBackdrop.classList.add(
          'is-open'
        );
      }

      document.body.classList.add(
        'no-scroll'
      );
    }

    function closeIntentWelcome(
      scrollToCatalog
    ) {
      if (dom.intentWelcomeModal) {
        dom.intentWelcomeModal.classList.remove(
          'is-open'
        );
      }

      if (dom.intentWelcomeBackdrop) {
        dom.intentWelcomeBackdrop.classList.remove(
          'is-open'
        );
      }

      document.body.classList.remove(
        'no-scroll'
      );

      if (scrollToCatalog) {
        document
          .getElementById('catalogo')
          .scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
      }
    }

    function handleEditorialAction(action) {
      const value = String(action || 'catalog').trim();

      if (
        dom.intentWelcomeModal &&
        dom.intentWelcomeModal.classList.contains(
          'is-open'
        )
      ) {
        closeIntentWelcome(false);
      }

      if (value === 'catalog') {
        document
          .getElementById('catalogo')
          .scrollIntoView({ behavior: 'smooth' });

        return;
      }

      if (value.startsWith('url:')) {
        const url = value.slice(4).trim();

        if (/^https:\/\//i.test(url)) {
          window.open(
            url,
            '_blank',
            'noopener,noreferrer'
          );
        }

        return;
      }

      if (value.startsWith('category:')) {
        state.editorialIntent = null;
        state.category =
          value.slice(9).trim() ||
          'Todas';
        state.page = 1;

        renderCategories();
        applyFilters();

        document
          .getElementById('catalogo')
          .scrollIntoView({ behavior: 'smooth' });

        return;
      }

      if (value.startsWith('intent:')) {
        applyEditorialIntent(
          value.slice(7).trim()
        );
      }
    }

    function findEditorialIntent(key) {
      const collections = []
        .concat(
          Array.isArray(state.store.moments)
            ? state.store.moments
            : []
        )
        .concat(
          Array.isArray(state.store.selections)
            ? state.store.selections
            : []
        );

      return collections.find(
        item => item.key === key
      ) || null;
    }

    function applyEditorialIntent(key) {
      const intent =
        findEditorialIntent(key);

      state.editorialIntent = intent;
      state.category = 'Todas';
      state.brand = 'Todas';
      state.search = '';
      state.minPrice = '';
      state.maxPrice = '';
      state.includeConsult = true;
      state.sort =
        intent && intent.sort
          ? intent.sort
          : 'featured';
      state.page = 1;

      dom.searchInput.value = '';
      dom.priceMin.value = '';
      dom.priceMax.value = '';
      dom.includeConsult.checked = true;
      dom.sortSelect.value = state.sort;

      if (dom.brandFilter) {
        dom.brandFilter.value = 'Todas';
      }

      renderCategories();
      renderBrands();
      applyFilters();

      document
        .getElementById('catalogo')
        .scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
    }

    function productMatchesEditorialIntent(product) {
      const intent =
        state.editorialIntent;

      if (
        !intent ||
        !Array.isArray(intent.categories) ||
        !intent.categories.length
      ) {
        return true;
      }

      const productCategory =
        normalize(product.category || '');

      return intent.categories.some(category => {
        const target = normalize(category);

        return (
          productCategory === target ||
          productCategory.includes(target) ||
          target.includes(productCategory)
        );
      });
    }

    function setCarousel(index) {
      const total = dom.heroSlides.children.length || 1;
      state.carouselIndex = (index + total) % total;
      Array.from(dom.heroSlides.children).forEach((slide,i) => slide.classList.toggle('is-active', i===state.carouselIndex));
      dom.heroDots.querySelectorAll('button').forEach((dot,i) => dot.classList.toggle('is-active', i===state.carouselIndex));
      restartCarousel();
    }

    function moveCarousel(delta) { setCarousel(state.carouselIndex + delta); }
    function restartCarousel() {
      clearInterval(state.carouselTimer);
      const seconds = Math.max(3, Number(state.store.carouselSeconds || 6));
      state.carouselTimer = setInterval(() => moveCarousel(1), seconds * 1000);
    }

    function renderFulfillmentOptions() {
      const options = [];
      if (state.store.allowPickup) {
        options.push({ value: 'Recolección', title: 'Recolección', text: 'Recibe confirmación y acuerda el punto de entrega.' });
      }
      if (state.store.allowDelivery) {
        options.push({ value: 'Entrega a domicilio', title: 'Entrega', text: 'La cobertura y el costo se confirman después.' });
      }
      if (!options.length) options.push({ value: 'Por confirmar', title: 'Por confirmar', text: 'El equipo de PUZZLES te contactará.' });

      dom.fulfillmentOptions.innerHTML = options.map((option, index) => `
        <label class="radio-card">
          <input type="radio" name="fulfillment" value="${escapeAttr(option.value)}" ${index === 0 ? 'checked' : ''}>
          <strong>${escapeHtml(option.title)}</strong>
          <span>${escapeHtml(option.text)}</span>
        </label>
      `).join('');
      updateAddressVisibility();
    }

    // ==========================================================
    // FILTROS, ORDEN Y PAGINACIÓN
    // ==========================================================

    function renderCategories() {
      const allCount = state.products.length;
      const rows = [{ name: 'Todas', count: allCount }].concat(state.categories);
      dom.categoryList.innerHTML = rows.map(category => `
        <button class="category-option ${state.category === category.name ? 'is-active' : ''}" type="button" data-category="${escapeAttr(category.name)}">
          <span>${escapeHtml(category.name)}</span>
          <span class="category-option__count">${Number(category.count || 0).toLocaleString('es-MX')}</span>
        </button>
      `).join('');

      dom.categoryList.querySelectorAll('[data-category]').forEach(button => {
        button.addEventListener('click', () => {
          state.editorialIntent = null;
          state.category = button.dataset.category;
          state.page = 1;
          renderCategories();
          applyFilters();
          if (window.innerWidth <= 960) closeOverlays();
        });
      });
    }

    function renderBrands() {
      if (!dom.brandFilter) return;

      const options = ['Todas'].concat(
        state.brands || []
      );

      if (
        state.brand !== 'Todas' &&
        !options.includes(state.brand)
      ) {
        state.brand = 'Todas';
      }

      dom.brandFilter.innerHTML = options
        .map(brand =>
          '<option value="' +
          escapeAttr(brand) +
          '">' +
          escapeHtml(
            brand === 'Todas'
              ? 'Todas las marcas'
              : brand
          ) +
          '</option>'
        )
        .join('');

      dom.brandFilter.value = state.brand;
    }

    function applyFilters() {
      const queryInfo = prepareSearchQuery(state.search);

      const min = state.minPrice === ''
        ? null
        : Number(state.minPrice);

      const max = state.maxPrice === ''
        ? null
        : Number(state.maxPrice);

      state.searchScores = new Map();

      let products = state.products.filter(product => {
        if (!productMatchesEditorialIntent(product)) {
          return false;
        }

        if (state.isStudio && state.studioStatus !== 'TODOS' && String(product.webStatus || 'ACTIVO') !== state.studioStatus) {
          return false;
        }

        if (
          state.category !== 'Todas' &&
          product.category !== state.category
        ) {
          return false;
        }

        if (
          state.brand !== 'Todas' &&
          product.brand !== state.brand
        ) {
          return false;
        }

        if (
          !state.includeConsult &&
          Number(product.priceNet) <= 0
        ) {
          return false;
        }

        if (
          min !== null &&
          Number(product.priceNet) < min
        ) {
          return false;
        }

        if (
          max !== null &&
          Number(product.priceNet) > max
        ) {
          return false;
        }

        if (queryInfo.tokens.length) {
          const score = fuzzyProductScore(
            product,
            queryInfo
          );

          if (score < queryInfo.minimumScore) {
            return false;
          }

          state.searchScores.set(
            product.code,
            score
          );
        }

        return true;
      });

      if (
        queryInfo.tokens.length &&
        state.sort === 'featured'
      ) {
        products.sort((a, b) =>
          (state.searchScores.get(b.code) || 0) -
          (state.searchScores.get(a.code) || 0)
        );
      } else {
        products = sortProducts(
          products,
          state.sort
        );
      }

      state.filtered = products;

      const totalPages = Math.max(
        1,
        Math.ceil(
          products.length / state.pageSize
        )
      );

      if (state.page > totalPages) {
        state.page = totalPages;
      }

      renderCatalog();
    }

    function prepareSearchQuery(value) {
      const canonical = canonicalSearchText(value);
      const tokens = canonical.split(' ').filter(Boolean);
      return { canonical, tokens, minimumScore: Math.max(1, tokens.length * 1.25) };
    }

    function canonicalSearchText(value) {
      let text = normalize(value);
      text = text.replace(/(\d+(?:[.,]\d+)?)\s*l\b/g, (_,n) => String(Math.round(Number(String(n).replace(',','.')) * 1000)) + 'ml');
      text = text.replace(/(\d+)\s*ml\b/g, '$1ml');
      return text.replace(/\s+/g,' ').trim();
    }

    function fuzzyProductScore(product, queryInfo) {
      const haystack = product.searchCanonical || canonicalSearchText([
        product.code, product.upc, product.sku, product.brand, product.shortName,
        product.description, product.model, product.color, product.presentation,
        product.category, product.unit, product.volume
      ].join(' '));
      const words = product.searchTokens || haystack.split(' ').filter(Boolean);
      let score = 0;
      for (const token of queryInfo.tokens) {
        if (haystack.includes(token)) { score += 4; continue; }
        let best = 0;
        for (const word of words) {
          if (word.startsWith(token) || token.startsWith(word)) best = Math.max(best, 3);
          const maxDistance = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
          if (maxDistance && Math.abs(word.length-token.length) <= maxDistance) {
            const distance = damerauLevenshtein(token, word, maxDistance);
            if (distance <= maxDistance) best = Math.max(best, 2.5 - distance * .5);
          }
        }
        if (!best) return -Infinity;
        score += best;
      }
      return score;
    }

    function damerauLevenshtein(a,b,limit=3) {
      if (a===b) return 0;
      if (Math.abs(a.length-b.length)>limit) return limit+1;
      const rows = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
      for(let i=0;i<=a.length;i++) rows[i][0]=i;
      for(let j=0;j<=b.length;j++) rows[0][j]=j;
      for(let i=1;i<=a.length;i++) {
        let rowMin=limit+1;
        for(let j=1;j<=b.length;j++) {
          const cost=a[i-1]===b[j-1]?0:1;
          rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+cost);
          if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
          rowMin=Math.min(rowMin,rows[i][j]);
        }
        if(rowMin>limit) return limit+1;
      }
      return rows[a.length][b.length];
    }

    function sortProducts(products, mode) {
      const copy = products.slice();

      const compareText = (left, right) =>
        String(left || '').localeCompare(
          String(right || ''),
          'es',
          {
            sensitivity: 'base',
            numeric: true
          }
        );

      const byName = (a, b) =>
        compareText(a.displayName, b.displayName);

      const byCode = (a, b) =>
        compareText(a.code, b.code);

      const bySource = (a, b) =>
        Number(a.rowNumber || 0) -
        Number(b.rowNumber || 0);

      switch (mode) {
        case 'nameAsc':
          return copy.sort(byName);

        case 'nameDesc':
          return copy.sort((a, b) => byName(b, a));

        case 'categoryAsc':
          return copy.sort((a, b) =>
            compareText(a.category, b.category) ||
            byName(a, b)
          );

        case 'categoryDesc':
          return copy.sort((a, b) =>
            compareText(b.category, a.category) ||
            byName(a, b)
          );

        case 'brandAsc':
          return copy.sort((a, b) =>
            compareText(a.brand, b.brand) ||
            byName(a, b)
          );

        case 'brandDesc':
          return copy.sort((a, b) =>
            compareText(b.brand, a.brand) ||
            byName(a, b)
          );

        case 'volumeAsc':
          return copy.sort((a, b) =>
            volumeToMl(a.volume) -
            volumeToMl(b.volume) ||
            byName(a, b)
          );

        case 'volumeDesc':
          return copy.sort((a, b) =>
            volumeToMl(b.volume) -
            volumeToMl(a.volume) ||
            byName(a, b)
          );

        case 'priceAsc':
          return copy.sort((a, b) => {
            const av = Number(a.priceNet) <= 0
              ? Number.POSITIVE_INFINITY
              : Number(a.priceNet);

            const bv = Number(b.priceNet) <= 0
              ? Number.POSITIVE_INFINITY
              : Number(b.priceNet);

            return av - bv || byName(a, b);
          });

        case 'priceDesc':
          return copy.sort((a, b) =>
            Number(b.priceNet) -
            Number(a.priceNet) ||
            byName(a, b)
          );

        case 'codeAsc':
          return copy.sort(byCode);

        default:
          return copy.sort(bySource);
      }
    }

    function clearFilters() {
      state.search = '';
      state.editorialIntent = null;
      state.category = 'Todas';
      state.brand = 'Todas';
      state.minPrice = '';
      state.maxPrice = '';
      state.includeConsult = true;
      state.sort = 'featured';
      state.page = 1;

      dom.searchInput.value = '';
      dom.priceMin.value = '';
      dom.priceMax.value = '';
      dom.includeConsult.checked = true;
      dom.sortSelect.value = 'featured';

      if (dom.brandFilter) {
        dom.brandFilter.value = 'Todas';
      }

      renderCategories();
      renderBrands();
      applyFilters();
    }

    function renderCatalog() {
      if (state.loading) return;
      if (!state.filtered.length) {
        showOnlyState('empty');
        setText(dom.resultCount, '0 resultados');
        setText(dom.resultRange, '');
        renderActiveFilter();
        return;
      }

      const start = (state.page - 1) * state.pageSize;
      const end = Math.min(start + state.pageSize, state.filtered.length);
      const pageProducts = state.filtered.slice(start, end);

      setText(dom.resultCount, state.filtered.length.toLocaleString('es-MX') + (state.filtered.length === 1 ? ' resultado' : ' resultados'));
      setText(dom.resultRange, '· Mostrando ' + (start + 1).toLocaleString('es-MX') + '–' + end.toLocaleString('es-MX') + ' · 25 por página');
      renderActiveFilter();

      if (state.view === 'table') {
        dom.gridView.innerHTML = '';
        renderTable(pageProducts);
        showOnlyState('table');
      } else {
        dom.tableView.innerHTML = '';
        renderGrid(pageProducts);
        showOnlyState('grid');
      }

      renderPagination();
      applyCatalogViewVisibility();
    }

    function renderActiveFilter() {
      const labels = [];

      if (
        state.editorialIntent &&
        state.editorialIntent.title
      ) {
        labels.push(
          'Momento: ' +
          state.editorialIntent.title
        );
      }

      if (state.category !== 'Todas') {
        labels.push(state.category);
      }

      if (state.brand !== 'Todas') {
        labels.push('Marca: ' + state.brand);
      }

      if (state.search.trim()) {
        labels.push('“' + state.search.trim() + '”');
      }

      if (state.minPrice !== '') {
        labels.push('Desde ' + money(state.minPrice));
      }

      if (state.maxPrice !== '') {
        labels.push('Hasta ' + money(state.maxPrice));
      }

      if (!state.includeConsult) {
        labels.push('Sólo con precio');
      }

      dom.activeFilterWrap.innerHTML = labels.length
        ? '<span class="active-filter">' +
          escapeHtml(labels.join(' · ')) +
          '</span>'
        : '';
    }

    function productMetaItems(product) {
      const items = [];
      const add = value => {
        const clean = String(value || '').trim();
        if (!clean) return;
        if (!items.some(item => normalize(item) === normalize(clean))) items.push(clean);
      };
      add(product.brand);
      add(product.presentation || product.volume);
      add(product.color);
      if (!product.presentation && !product.volume) add(product.unit);
      if (product.stock !== null) add(Number(product.stock).toLocaleString('es-MX') + ' disponibles');
      return items.slice(0, 4);
    }

    function renderGrid(products) {
      dom.gridView.innerHTML = products
        .map(product => {
          const quantity = getDraftQuantity(product.code);
          const cartQty = Math.max(0, extractCartQuantity(state.cart[product.code]));
          const canBuy = Boolean(
            product.available &&
            toFiniteNumber(product.priceNet) > 0
          );
          const compare = toFiniteNumber(product.priceCompare);
          const sale = toFiniteNumber(product.priceNet);
          const meta = productMetaItems(product);
          const adminCost = getAdminCost(product.code);

          return `
            <article class="product-card ${product.webStatus && product.webStatus !== 'ACTIVO' && product.webStatus !== 'CONSULTAR' ? 'product-card--hidden' : ''}" data-code="${escapeAttr(product.code)}">
              <button class="product-card__visual product-open-button" data-darkreader-lock type="button" data-product-detail="${escapeAttr(product.code)}" aria-label="Ver información de ${escapeAttr(product.displayName)}">
                <div class="product-image-fallback" data-darkreader-lock aria-hidden="true">
                  <span>${escapeHtml(categoryLetter(product.category))}</span>
                </div>
                ${productImageMarkup(product, 'product-card__image', product.displayName)}
                <span class="product-card__category">${escapeHtml(product.category)}</span>
              </button>

              ${state.isStudio && product.webStatus && product.webStatus !== 'ACTIVO' ? `<div class="studio-status-badge">${escapeHtml(product.webStatus.replace('_',' '))}</div>` : ''}
              <div class="product-card__body">
                <h3 class="product-card__name">
                  <button class="product-title-button" type="button" data-product-detail="${escapeAttr(product.code)}">
                    ${escapeHtml(product.displayName)}
                  </button>
                </h3>

                <div class="product-card__meta">
                  ${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
                </div>

                <div class="product-card__price-block">
                  ${canBuy
                    ? `${compare > sale
                        ? `<div class="price-compare">${money(compare)}</div>`
                        : ''}
                       <div class="price-net">${money(sale)}</div>`
                    : '<div class="consult-price">Precio a consultar</div>'}
                  ${renderAdminPrice(adminCost)}
                </div>

                <div class="product-card__actions">
                  <div class="qty-control">
                    <button type="button" data-qty-minus="${escapeAttr(product.code)}">−</button>
                    <span data-qty-value="${escapeAttr(product.code)}">${quantity}</span>
                    <button type="button" data-qty-plus="${escapeAttr(product.code)}">+</button>
                  </div>

                  <button class="add-button" type="button" data-add="${escapeAttr(product.code)}" ${canBuy ? '' : 'disabled'}>
                    ${canBuy ? 'Agregar al carrito' : 'Consultar'}
                  </button>
                </div>

                ${cartQty > 0
                  ? `<div class="in-cart-note">${cartQty} ${cartQty === 1 ? 'unidad' : 'unidades'} en el carrito</div>`
                  : ''}
              </div>
            </article>`;
        })
        .join('');

      bindProductControls(dom.gridView);
      bindProductImageFallbacks(dom.gridView);
    }

    function renderTable(products) {
      const isMobileList = window.matchMedia('(max-width: 760px)').matches;

      if (isMobileList) {
        dom.tableView.innerHTML = `
          <div class="mobile-product-list">
            ${products.map(function (product) {
              const canBuy = Boolean(product.available && toFiniteNumber(product.priceNet) > 0);
              const sale = toFiniteNumber(product.priceNet);
              const compare = toFiniteNumber(product.priceCompare);
              const adminCost = getAdminCost(product.code);

              return `
                <article class="mobile-list-card ${product.webStatus && product.webStatus !== 'ACTIVO' && product.webStatus !== 'CONSULTAR' ? 'product-card--hidden' : ''}" data-code="${escapeAttr(product.code)}">
                  <button class="mobile-list-card__visual" type="button" data-product-detail="${escapeAttr(product.code)}" aria-label="Ver ${escapeAttr(product.displayName)}">
                    <span class="product-image-fallback" aria-hidden="true"><span>${escapeHtml(categoryLetter(product.category))}</span></span>
                    ${productImageMarkup(product, 'mobile-list-card__image', product.displayName)}
                  </button>

                  <div class="mobile-list-card__body">
                    <span class="mobile-list-card__category">${escapeHtml(product.category)}</span>
                    <button class="mobile-list-card__title" type="button" data-product-detail="${escapeAttr(product.code)}">${escapeHtml(product.displayName)}</button>
                    <div class="mobile-list-card__meta">
                      ${product.brand ? `<span>${escapeHtml(product.brand)}</span>` : ''}
                      ${product.volume ? `<span>${escapeHtml(product.volume)}</span>` : ''}
                    </div>
                    ${state.isAdmin ? renderAdminPrice(adminCost, true) : ''}
                  </div>

                  <div class="mobile-list-card__buy">
                    ${compare > sale && canBuy ? `<span class="price-compare">${money(compare)}</span>` : ''}
                    <strong>${canBuy ? money(sale) : 'Consultar'}</strong>
                    <button class="table-add" type="button" data-add-one="${escapeAttr(product.code)}" ${canBuy ? '' : 'disabled'}>${canBuy ? 'Agregar' : 'Consultar'}</button>
                  </div>
                </article>`;
            }).join('')}
          </div>`;
      } else {
        const sortableHeader = function (label, key) {
          return `<button class="table-sort-button" type="button" data-table-sort="${escapeAttr(key)}"><span>${escapeHtml(label)}</span><span class="table-sort-indicator">${tableSortIndicator(key)}</span></button>`;
        };

        const adminHeader = state.isAdmin ? '<th>Precio ADMIN</th>' : '';
        dom.tableView.innerHTML = `
          <table class="product-table">
            <thead><tr>
              <th>${sortableHeader('Producto', 'name')}</th>
              <th>${sortableHeader('Contenido', 'volume')}</th>
              <th>${sortableHeader('Marca', 'brand')}</th>
              <th>${sortableHeader('Categoría', 'category')}</th>
              <th>${sortableHeader('Precio', 'price')}</th>
              <th>Antes</th>${adminHeader}<th>Acción</th>
            </tr></thead>
            <tbody>
              ${products.map(function (product) {
                const canBuy = Boolean(product.available && toFiniteNumber(product.priceNet) > 0);
                const compare = toFiniteNumber(product.priceCompare);
                const sale = toFiniteNumber(product.priceNet);
                const adminCost = getAdminCost(product.code);
                return `<tr>
                  <td class="product-table__product"><button class="product-table__product-wrap product-row-button" type="button" data-product-detail="${escapeAttr(product.code)}"><span class="product-table__thumb"><span class="product-image-fallback" aria-hidden="true"><span>${escapeHtml(categoryLetter(product.category))}</span></span>${productImageMarkup(product, 'product-table__image', product.displayName)}</span><span><strong>${escapeHtml(product.displayName)}</strong></span></button></td>
                  <td>${escapeHtml(product.volume || '—')}</td>
                  <td>${escapeHtml(product.brand || '—')}</td>
                  <td><span class="table-category">${escapeHtml(product.category)}</span></td>
                  <td class="product-table__price">${canBuy ? money(sale) : 'Consultar'}</td>
                  <td>${compare > sale ? `<span class="price-compare">${money(compare)}</span>` : '—'}</td>
                  ${state.isAdmin ? `<td>${renderAdminPrice(adminCost, true)}</td>` : ''}
                  <td><button class="table-add" type="button" data-add-one="${escapeAttr(product.code)}" ${canBuy ? '' : 'disabled'}>Agregar</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>`;
      }

      dom.tableView.querySelectorAll('[data-add-one]').forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.stopPropagation();
          addToCart(button.dataset.addOne, 1);
        });
      });

      dom.tableView.querySelectorAll('[data-table-sort]').forEach(function (button) {
        button.addEventListener('click', function () {
          toggleTableSort(button.dataset.tableSort);
        });
      });

      bindProductImageFallbacks(dom.tableView);
    }

    const TABLE_SORT_MODES = Object.freeze({
      name: ['nameAsc', 'nameDesc'],
      volume: ['volumeAsc', 'volumeDesc'],
      brand: ['brandAsc', 'brandDesc'],
      category: ['categoryAsc', 'categoryDesc'],
      price: ['priceAsc', 'priceDesc']
    });

    function toggleTableSort(key) {
      const modes = TABLE_SORT_MODES[key];
      if (!modes) return;

      state.sort = state.sort === modes[0]
        ? modes[1]
        : modes[0];

      state.page = 1;

      if (dom.sortSelect) {
        dom.sortSelect.value = state.sort;
      }

      applyFilters();
    }

    function tableSortIndicator(key) {
      const modes = TABLE_SORT_MODES[key];
      if (!modes || !modes.includes(state.sort)) {
        return '↕';
      }

      return state.sort === modes[0]
        ? '↑'
        : '↓';
    }

    function productImageMarkup(product, className, alt) {
      if (!product || !product.imageUrl) {
        return '';
      }

      const displayUrl =
        product.imageDisplayUrl ||
        product.imageUrl;

      return `
        <img
          class="${escapeAttr(className)} js-product-image"
          src="${escapeAttr(displayUrl)}"
          data-original-src="${escapeAttr(product.imageUrl)}"
          data-darkreader-lock
          alt="${escapeAttr(alt || '')}"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        >`;
    }

    function bindProductImageFallbacks(container) {
      if (!container) return;

      const visualSelector = [
        '.product-card__visual',
        '.mobile-list-card__visual',
        '.product-table__thumb',
        '.pdp-image-button',
        '.cart-item__visual'
      ].join(',');

      const setLoadedState = (image, loaded) => {
        const visual = image.closest(visualSelector) || image.parentElement;
        if (loaded) {
          image.classList.add('is-loaded');
          image.classList.remove('is-broken');
          if (visual) visual.classList.add('has-loaded-image');
        } else {
          image.classList.remove('is-loaded');
          if (visual) visual.classList.remove('has-loaded-image');
        }
      };

      container
        .querySelectorAll('.js-product-image')
        .forEach(image => {
          const markLoaded = () => setLoadedState(image, true);
          const markBroken = () => {
            const original = image.dataset.originalSrc || '';

            if (
              original &&
              image.dataset.originalTried !== 'true' &&
              image.src !== original
            ) {
              image.dataset.originalTried = 'true';
              setLoadedState(image, false);
              image.src = original;
              return;
            }

            setLoadedState(image, false);
            image.classList.add('is-broken');
          };

          image.addEventListener('load', markLoaded, { once: true });
          image.addEventListener('error', markBroken);

          // Las imágenes recuperadas de caché pueden haber terminado de cargar
          // antes de registrar el evento. Se valida su estado inmediatamente.
          if (image.complete) {
            if (image.naturalWidth > 0) markLoaded();
            else markBroken();
          }
        });
    }

    function bindProductControls(container) {
      container.querySelectorAll('[data-qty-minus]').forEach(button => {
        button.addEventListener('click', () => changeDraftQuantity(button.dataset.qtyMinus, -1));
      });
      container.querySelectorAll('[data-qty-plus]').forEach(button => {
        button.addEventListener('click', () => changeDraftQuantity(button.dataset.qtyPlus, 1));
      });
      container.querySelectorAll('[data-add]').forEach(button => {
        button.addEventListener('click', () => {
          const code = button.dataset.add;
          addToCart(code, getDraftQuantity(code));
          state.quantities[code] = 1;
          renderCatalog();
        });
      });
    }

    function getDraftQuantity(code) {
      return Math.max(1, Math.min(99, Number(state.quantities[code] || 1)));
    }

    function changeDraftQuantity(code, delta) {
      state.quantities[code] = Math.max(1, Math.min(99, getDraftQuantity(code) + delta));
      const value = document.querySelector('[data-qty-value="' + cssEscape(code) + '"]');
      if (value) value.textContent = state.quantities[code];
    }

    function renderPagination() {
      const pages = Math.ceil(state.filtered.length / state.pageSize);
      if (pages <= 1) {
        dom.pagination.classList.add('hidden');
        dom.pagination.innerHTML = '';
        return;
      }

      const visible = paginationSequence(state.page, pages);
      dom.pagination.innerHTML = `
        <button type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
        ${visible.map(item => item === '…'
          ? '<span class="pagination__ellipsis">…</span>'
          : `<button type="button" class="${item === state.page ? 'is-active' : ''}" data-page="${item}">${item}</button>`
        ).join('')}
        <button type="button" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="Página siguiente">›</button>
      `;
      dom.pagination.classList.remove('hidden');
      dom.pagination.querySelectorAll('[data-page]').forEach(button => {
        button.addEventListener('click', () => {
          const page = Number(button.dataset.page);
          if (!page || page < 1 || page > pages || page === state.page) return;
          state.page = page;
          renderCatalog();
          document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    function paginationSequence(current, total) {
      if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
      const sequence = [1];
      if (current > 4) sequence.push('…');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) sequence.push(i);
      if (current < total - 3) sequence.push('…');
      sequence.push(total);
      return sequence;
    }

    function setView(view, render = true) {
      state.view =
        view === 'table'
          ? 'table'
          : 'grid';

      // No se persiste la vista: cada nueva visita inicia en cuadrícula.
      puzzlesStorageRemove(
        STORAGE_KEYS.VIEW
      );

      document.body.dataset.catalogView =
        state.view;

      dom.btnGridView.classList.toggle(
        'is-active',
        state.view === 'grid'
      );

      dom.btnTableView.classList.toggle(
        'is-active',
        state.view === 'table'
      );

      dom.btnGridView.setAttribute(
        'aria-pressed',
        state.view === 'grid'
          ? 'true'
          : 'false'
      );

      dom.btnTableView.setAttribute(
        'aria-pressed',
        state.view === 'table'
          ? 'true'
          : 'false'
      );

      if (render && !state.loading) {
        renderCatalog();
      } else {
        applyCatalogViewVisibility();
      }
    }

    function applyCatalogViewVisibility() {
      const showTable =
        state.view === 'table';

      if (dom.gridView) {
        dom.gridView.hidden = showTable;
        dom.gridView.classList.toggle(
          'hidden',
          showTable
        );

        dom.gridView.style.setProperty(
          'display',
          showTable
            ? 'none'
            : 'grid',
          'important'
        );
      }

      if (dom.tableView) {
        dom.tableView.hidden = !showTable;
        dom.tableView.classList.toggle(
          'hidden',
          !showTable
        );

        dom.tableView.style.setProperty(
          'display',
          showTable
            ? 'block'
            : 'none',
          'important'
        );
      }
    }

    function showOnlyState(type) {
      const stateElements = [
        dom.loadingState,
        dom.errorState,
        dom.emptyState,
        dom.pagination
      ].filter(Boolean);

      stateElements.forEach(element => {
        element.classList.add('hidden');
        element.hidden = true;
      });

      const isCatalogView =
        type === 'grid' ||
        type === 'table';

      if (!isCatalogView) {
        [dom.gridView, dom.tableView]
          .filter(Boolean)
          .forEach(element => {
            element.classList.add('hidden');
            element.hidden = true;
            element.style.setProperty(
              'display',
              'none',
              'important'
            );
          });
      }

      if (
        type === 'error' &&
        dom.errorState
      ) {
        dom.errorState.classList.remove(
          'hidden'
        );

        dom.errorState.hidden = false;
      }

      if (
        type === 'empty' &&
        dom.emptyState
      ) {
        dom.emptyState.classList.remove(
          'hidden'
        );

        dom.emptyState.hidden = false;
      }

      if (isCatalogView) {
        state.view =
          type === 'table'
            ? 'table'
            : 'grid';

        document.body.dataset.catalogView =
          state.view;

        applyCatalogViewVisibility();
      }
    }

    // ==========================================================
    // DETALLE DE PRODUCTO Y MODO ADMIN
    // ==========================================================

    function getAdminCost(code) {
      if (!state.isAdmin) return null;
      const value = state.adminPrices[String(code)];
      return Number.isFinite(Number(value))
        ? Number(value)
        : null;
    }

    function renderAdminPrice(value, compact) {
      if (!state.isAdmin || value === null || value === undefined) {
        return '';
      }

      return `<div class="admin-price ${compact ? 'admin-price--compact' : ''}">
        <span>ADMIN · COSTO</span>
        <strong>${money(value)}</strong>
      </div>`;
    }

    async function loadAdminPricing() {
      state.isAdmin = Boolean(
        state.user && state.user.isAdmin
      );

      if (!state.isAdmin || !state.sessionToken) {
        state.adminPrices = {};
        updateAuthUi();
        if (!state.loading) renderCatalog();
        return;
      }

      const result = await backendGetAdminPricing(
        state.sessionToken
      );

      state.adminPrices = result && result.ok && result.prices
        ? result.prices
        : {};

      updateAuthUi();
      if (!state.loading) renderCatalog();

      if (state.detailProductCode) {
        openProductDetail(state.detailProductCode, true);
      }
    }

    function normalizeEditorialList(value, limit) {
      if (Array.isArray(value)) {
        return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, limit || 6);
      }
      if (!value) return [];
      try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed)
          ? parsed.map(item => String(item || '').trim()).filter(Boolean).slice(0, limit || 6)
          : [];
      } catch (_) {
        return String(value).split(/\n|\s*\|\s*/).map(item => item.trim()).filter(Boolean).slice(0, limit || 6);
      }
    }

    function normalizeEditorialFacts(value) {
      let list = value;
      if (!Array.isArray(list)) {
        try { list = JSON.parse(String(value || '[]')); } catch (_) { list = []; }
      }
      return Array.isArray(list)
        ? list.map(item => ({
            label: String(item && item.label || '').trim(),
            value: String(item && item.value || '').trim()
          })).filter(item => item.label && item.value).slice(0, 12)
        : [];
    }

    function buildPdpFacts(product) {
      const facts = [];
      const seen = new Set();
      const add = (label, value) => {
        const cleanLabel = String(label || '').trim();
        const cleanValue = String(value || '').trim();
        const key = (cleanLabel + '|' + cleanValue).toLowerCase();
        if (!cleanLabel || !cleanValue || seen.has(key)) return;
        seen.add(key);
        facts.push({ label: cleanLabel, value: cleanValue });
      };

      add('Marca', product.brand);
      add('Categoría', product.category);
      add('Tipo o especialidad', product.specialty);
      add('Contenido', product.volume || product.presentation);
      add('Origen', product.origin);
      add('Graduación alcohólica', product.alcohol);
      (product.pdpFacts || []).forEach(item => add(item.label, item.value));
      return facts.slice(0, 12);
    }

    function renderPdpFacts(facts) {
      if (!facts.length) return '';
      return `<dl class="pdp-tech-grid">${facts.map(item => `
        <div>
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${escapeHtml(item.value)}</dd>
        </div>`).join('')}</dl>`;
    }

    function renderPdpAccordion(title, content, open) {
      const clean = String(content || '').trim();
      if (!clean) return '';
      return `
        <details class="pdp-accordion" ${open ? 'open' : ''}>
          <summary>${escapeHtml(title)}<span aria-hidden="true"></span></summary>
          <div class="pdp-accordion__body"><p>${escapeHtml(clean)}</p></div>
        </details>`;
    }

    function openProductDetail(code, preserveQuantity) {
      const product = getProduct(code);
      if (!product) return;

      state.detailProductCode = String(product.code);
      if (!preserveQuantity) state.detailQuantity = getDraftQuantity(product.code);

      const canBuy = Boolean(product.available && toFiniteNumber(product.priceNet) > 0);
      const sale = toFiniteNumber(product.priceNet);
      const compare = toFiniteNumber(product.priceCompare);
      const adminCost = getAdminCost(product.code);
      const summary = String(product.pdpSummary || '').trim();
      const facts = buildPdpFacts(product);
      const highlights = normalizeEditorialList(product.pdpHighlights, 4);
      const serviceText = [product.pdpServing, product.pdpPairing]
        .filter(Boolean)
        .map((text, index) => `${index === 0 ? 'Servicio' : 'Maridaje'}: ${text}`)
        .join('\n\n');

      setText(dom.productDetailTitle, 'Detalle del producto');

      dom.productDetailContent.innerHTML = `
        <article class="pdp-editorial">
          <aside class="pdp-editorial__media">
            <button
              class="pdp-image-button"
              type="button"
              data-pdp-zoom
              aria-label="Ampliar imagen de ${escapeAttr(product.displayName)}"
            >
              <span class="product-image-fallback" aria-hidden="true">
                <span>${escapeHtml(categoryLetter(product.category))}</span>
              </span>
              ${productImageMarkup(product, 'pdp-image', product.displayName)}
            </button>
            <button class="pdp-image-link" type="button" data-pdp-zoom>Ampliar imagen</button>
          </aside>

          <section class="pdp-editorial__content">
            <header class="pdp-editorial__header">
              <div class="pdp-editorial__kickers">
                <span class="pdp-category">${escapeHtml(product.category || 'Producto')}</span>
                ${product.brand ? `<span class="pdp-brand">${escapeHtml(product.brand)}</span>` : ''}
              </div>
              <h3>${escapeHtml(product.displayName)}</h3>
              ${summary ? `<p class="pdp-summary">${escapeHtml(summary)}</p>` : ''}
              ${state.isStudio ? `<button class="studio-inline-edit" type="button" data-studio-edit-current>Editar publicación</button>` : ''}
              <div class="pdp-identity-line">
                ${product.specialty ? `<span>${escapeHtml(product.specialty)}</span>` : ''}
                ${(product.volume || product.presentation) ? `<span>${escapeHtml(product.volume || product.presentation)}</span>` : ''}
                ${product.origin ? `<span>${escapeHtml(product.origin)}</span>` : ''}
              </div>
            </header>

            <section class="pdp-buybox" aria-label="Compra del producto">
              <div class="pdp-buybox__price">
                ${canBuy
                  ? `${compare > sale ? `<div class="price-compare">${money(compare)}</div>` : ''}<div class="price-net">${money(sale)}</div>`
                  : '<div class="consult-price">Precio a consultar</div>'}
                ${renderAdminPrice(adminCost)}
              </div>
              <div class="pdp-buybox__availability">
                <span>${product.stock === null ? 'Disponibilidad sujeta a confirmación' : escapeHtml(String(product.stock)) + ' disponibles'}</span>
              </div>
              <div class="pdp-actions">
                <div class="qty-control pdp-qty-control">
                  <button type="button" data-pdp-minus aria-label="Restar una unidad">−</button>
                  <span id="pdpQuantityValue">${state.detailQuantity}</span>
                  <button type="button" data-pdp-plus aria-label="Agregar una unidad">+</button>
                </div>
                <button class="add-button pdp-add-button" type="button" data-pdp-add ${canBuy ? '' : 'disabled'}>
                  ${canBuy ? 'Agregar al carrito' : 'Consultar'}
                </button>
              </div>
            </section>

            ${highlights.length ? `
              <section class="pdp-highlights" aria-label="Puntos destacados">
                ${highlights.map(item => `<div><span aria-hidden="true">◆</span><p>${escapeHtml(item)}</p></div>`).join('')}
              </section>` : ''}

            <section class="pdp-editorial__accordions">
              ${renderPdpAccordion('Descripción', product.pdpDescription, true)}
              ${renderPdpAccordion('Perfil del producto', product.pdpProfile, false)}
              ${renderPdpAccordion('Servicio y maridaje', serviceText, false)}
              ${facts.length ? `
                <details class="pdp-accordion">
                  <summary>Ficha técnica<span aria-hidden="true"></span></summary>
                  <div class="pdp-accordion__body">${renderPdpFacts(facts)}</div>
                </details>` : ''}
            </section>
          </section>
        </article>`;

      bindProductImageFallbacks(dom.productDetailContent);
      dom.productDetailContent.querySelectorAll('[data-pdp-zoom]').forEach(button => {
        listen(button, 'click', () => openImageZoom(product));
      });

      const minus = dom.productDetailContent.querySelector('[data-pdp-minus]');
      const plus = dom.productDetailContent.querySelector('[data-pdp-plus]');
      const add = dom.productDetailContent.querySelector('[data-pdp-add]');
      listen(minus, 'click', () => changeDetailQuantity(-1));
      listen(plus, 'click', () => changeDetailQuantity(1));
      const studioEdit = dom.productDetailContent.querySelector('[data-studio-edit-current]');
      listen(studioEdit, 'click', () => openStudioEditor(product.code));
      listen(add, 'click', () => {
        addToCart(product.code, state.detailQuantity);
        state.detailQuantity = 1;
        const value = document.getElementById('pdpQuantityValue');
        if (value) value.textContent = '1';
      });

      dom.productDetailBackdrop.classList.add('is-open');
      dom.productDetailModal.classList.add('is-open');
      dom.productDetailModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
    }

    function changeDetailQuantity(delta) {
      state.detailQuantity = Math.max(
        1,
        Math.min(99, state.detailQuantity + delta)
      );
      const value = document.getElementById('pdpQuantityValue');
      if (value) value.textContent = state.detailQuantity;
    }

    function closeProductDetail() {
      dom.productDetailModal.classList.remove('is-open');
      dom.productDetailModal.setAttribute('aria-hidden', 'true');
      dom.productDetailBackdrop.classList.remove('is-open');
      state.detailProductCode = '';
      if (!document.querySelector('.modal.is-open, .drawer.is-open, .image-zoom-modal.is-open')) {
        document.body.classList.remove('no-scroll');
      }
    }

    function openImageZoom(product) {
      if (!product || !product.imageUrl) return;
      dom.zoomedProductImage.src = product.imageDisplayUrl || product.imageUrl;
      dom.zoomedProductImage.dataset.originalSrc = product.imageUrl;
      dom.zoomedProductImage.alt = product.displayName;
      dom.imageZoomModal.classList.add('is-open');
      dom.imageZoomBackdrop.classList.add('is-open');
      document.body.classList.add('no-scroll');

      dom.zoomedProductImage.onerror = function () {
        if (this.dataset.originalTried === 'true') return;
        this.dataset.originalTried = 'true';
        this.src = this.dataset.originalSrc || '';
      };
    }

    function closeImageZoom() {
      dom.imageZoomModal.classList.remove('is-open');
      dom.imageZoomBackdrop.classList.remove('is-open');
      dom.zoomedProductImage.removeAttribute('src');
      dom.zoomedProductImage.dataset.originalTried = '';
      if (!dom.productDetailModal.classList.contains('is-open')) {
        document.body.classList.remove('no-scroll');
      }
    }

    // ==========================================================
    // CARRITO
    // ==========================================================

    function normalizeCartAgainstCatalog() {
      const productMap = Object.fromEntries(
        state.products.map(product => [String(product.code), product])
      );
      const next = {};

      Object.keys(state.cart || {}).forEach(rawCode => {
        const code = String(rawCode);
        const product = productMap[code];
        if (!product || !product.available || toFiniteNumber(product.priceNet) <= 0) return;

        let qty = extractCartQuantity(state.cart[rawCode]);
        if (product.stock !== null && product.stock !== undefined) {
          qty = Math.min(qty, Math.max(0, Math.floor(toFiniteNumber(product.stock))));
        }

        if (qty > 0) next[code] = qty;
      });

      state.cart = next;
      saveCart();
    }

    function extractCartQuantity(value) {
      if (
        value === undefined ||
        value === null ||
        value === ''
      ) {
        return 0;
      }

      let raw = value;

      if (raw && typeof raw === 'object') {
        raw =
          raw.quantity ??
          raw.cantidad ??
          raw.qty ??
          raw.units ??
          raw.unidades ??
          0;
      }

      const quantity = Math.floor(
        toFiniteNumber(raw)
      );

      if (quantity <= 0) return 0;

      return Math.min(99, quantity);
    }

    function addToCart(code, quantity) {
      const product = getProduct(code);
      if (!product || !product.available || toFiniteNumber(product.priceNet) <= 0) {
        toast('Este producto requiere consulta antes de agregarlo.', 'error');
        return;
      }

      const current = state.cart[code] === undefined
        ? 0
        : extractCartQuantity(state.cart[code]);

      let next = Math.min(
        99,
        current + Math.max(1, Math.floor(toFiniteNumber(quantity)) || 1)
      );

      if (product.stock !== null && product.stock !== undefined) {
        next = Math.min(
          next,
          Math.max(0, Math.floor(toFiniteNumber(product.stock)))
        );
      }

      if (next <= 0) {
        toast('Este producto no tiene existencias disponibles.', 'error');
        return;
      }

      state.cart[String(code)] = next;
      saveCart();
      renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);
      if (!state.loading) renderCatalog();
      toast(product.description + ' se agregó al carrito.', 'success');
    }

    function changeCartQuantity(code, delta) {
      const product = getProduct(code);
      if (!product) return removeFromCart(code);

      const current = state.cart[code] === undefined
        ? 0
        : extractCartQuantity(state.cart[code]);

      let next = current + Math.trunc(toFiniteNumber(delta));

      if (product.stock !== null && product.stock !== undefined) {
        next = Math.min(
          next,
          Math.max(0, Math.floor(toFiniteNumber(product.stock)))
        );
      }

      if (next <= 0) delete state.cart[code];
      else state.cart[code] = Math.min(99, Math.max(1, next));

      saveCart();
      renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);
      if (!state.loading) renderCatalog();
    }

    function removeFromCart(code) {
      delete state.cart[code];
      saveCart();
      renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);
      if (!state.loading) renderCatalog();
    }

    function getCartLines() {
      return Object.keys(state.cart || {}).map(code => {
        const product = getProduct(code);
        if (!product) return null;

        const quantity = extractCartQuantity(state.cart[code]);
        const salePrice = toFiniteNumber(product.priceNet);
        if (quantity <= 0 || salePrice <= 0) return null;

        return {
          product,
          quantity,
          lineNet: round2(salePrice * quantity)
        };
      }).filter(Boolean);
    }

    function getCartTotals() {
      return getCartLines().reduce((acc, line) => {
        acc.lines += 1;
        acc.units += Math.max(0, Math.floor(toFiniteNumber(line.quantity)));
        acc.net = round2(acc.net + toFiniteNumber(line.lineNet));
        return acc;
      }, { lines: 0, units: 0, net: 0 });
    }

    function renderCart() {
      const lines = getCartLines();
      const totals = getCartTotals();

      setText(dom.headerCartCount, String(totals.units));
      setText(dom.floatingCartCount, String(totals.units));
      dom.floatingCart.classList.toggle('is-visible', totals.units > 0);

      if (!lines.length) {
        dom.cartBody.innerHTML = `
          <div class="cart-empty">
            <div>
              <div class="cart-empty__icon">◇</div>
              <h3>Tu carrito está vacío</h3>
              <p>Agrega piezas de la colección para crear una solicitud.</p>
            </div>
          </div>
        `;
        dom.cartFooter.classList.add('hidden');
        return;
      }

      dom.cartBody.innerHTML = lines.map(line => `
        <article class="cart-item">
          <div class="cart-item__visual">
            <span class="product-image-fallback" aria-hidden="true"><span>${escapeHtml(categoryLetter(line.product.category))}</span></span>
            ${productImageMarkup(line.product, 'cart-item__image', line.product.displayName || line.product.description)}
          </div>
          <div class="cart-item__content">
            <div class="cart-item__top">
              <div class="cart-item__name">${escapeHtml(line.product.displayName || line.product.description)}</div>
              <div class="cart-item__price">${money(line.lineNet)}</div>
            </div>
            <div class="cart-item__bottom">
              <div class="qty-control">
                <button type="button" data-cart-minus="${escapeAttr(line.product.code)}">−</button>
                <span>${line.quantity}</span>
                <button type="button" data-cart-plus="${escapeAttr(line.product.code)}">+</button>
              </div>
              <button class="remove-button" type="button" data-cart-remove="${escapeAttr(line.product.code)}">Quitar</button>
            </div>
          </div>
        </article>
      `).join('');

      bindProductImageFallbacks(dom.cartBody);

      dom.cartBody.querySelectorAll('[data-cart-minus]').forEach(button => {
        button.addEventListener('click', () => changeCartQuantity(button.dataset.cartMinus, -1));
      });

      dom.cartBody.querySelectorAll('[data-cart-plus]').forEach(button => {
        button.addEventListener('click', () => changeCartQuantity(button.dataset.cartPlus, 1));
      });

      dom.cartBody.querySelectorAll('[data-cart-remove]').forEach(button => {
        button.addEventListener('click', () => removeFromCart(button.dataset.cartRemove));
      });

      setText(dom.cartUnits, totals.units.toLocaleString('es-MX'));
      setText(dom.cartSubtotal, totals.lines.toLocaleString('es-MX'));
      setText(dom.cartTotal, money(totals.net));
      dom.cartFooter.classList.remove('hidden');

      const belowMinimum =
        toFiniteNumber(state.store.minimumOrder) > 0 &&
        totals.net < toFiniteNumber(state.store.minimumOrder);

      dom.btnCheckout.disabled = belowMinimum;
      dom.minimumOrderNote.classList.toggle('hidden', !belowMinimum);
      if (dom.minimumOrderNote) dom.minimumOrderNote.textContent = belowMinimum
        ? 'Pedido mínimo: ' + money(state.store.minimumOrder) +
          '. Faltan ' + money(toFiniteNumber(state.store.minimumOrder) - totals.net) + '.'
        : '';

      updateCheckoutSummary();
    }

    function openCart() {
      normalizeCartAgainstCatalog();
      renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);
      dom.cartDrawer.classList.add('is-open');
      dom.cartDrawer.setAttribute('aria-hidden', 'false');
      dom.mainBackdrop.classList.add('is-open');
      document.body.classList.add('no-scroll');
    }

    function closeCart() {
      dom.cartDrawer.classList.remove('is-open');
      dom.cartDrawer.setAttribute('aria-hidden', 'true');
      dom.mainBackdrop.classList.remove('is-open');
      dom.filtersPanel.classList.remove('is-open');
      if (!dom.checkoutModal.classList.contains('is-open') && !dom.successModal.classList.contains('is-open')) {
        document.body.classList.remove('no-scroll');
      }
    }

    function openFilters() {
      dom.filtersPanel.classList.add('is-open');
      dom.mainBackdrop.classList.add('is-open');
      document.body.classList.add('no-scroll');
    }

    function closeOverlays() {
      closeCart();
      dom.filtersPanel.classList.remove('is-open');
      dom.mainBackdrop.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }

    function saveCart() {
      puzzlesStorageSet(STORAGE_KEYS.CART, JSON.stringify(state.cart));
      scheduleAccountSync();
    }

    // ==========================================================
    // CHECKOUT Y PEDIDO
    // ==========================================================

    function openCheckout() {
      const totals = getCartTotals();
      if (!totals.lines) {
        toast('El carrito está vacío.', 'error');
        return;
      }
      if (state.store.minimumOrder > 0 && totals.net < state.store.minimumOrder) {
        toast('El pedido mínimo es ' + money(state.store.minimumOrder) + '.', 'error');
        return;
      }

      closeCart();
      updateCheckoutSummary();
      dom.checkoutError.classList.remove('is-visible');
      dom.checkoutModal.classList.add('is-open');
      dom.checkoutBackdrop.classList.add('is-open');
      document.body.classList.add('no-scroll');
      setTimeout(() => dom.customerName.focus(), 180);
    }

    function closeCheckout() {
      if (state.submitting) return;
      dom.checkoutModal.classList.remove('is-open');
      dom.checkoutBackdrop.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }

    function updateCheckoutSummary() {
      const totals = getCartTotals();
      setText(dom.checkoutItemsText, totals.lines + (totals.lines === 1 ? ' producto' : ' productos'));
      setText(dom.checkoutUnitsText, totals.units + (totals.units === 1 ? ' unidad' : ' unidades'));
      setText(dom.checkoutTotal, money(totals.net));
    }

    function updateAddressVisibility() {
      const selected = dom.fulfillmentOptions && dom.fulfillmentOptions.querySelector('input[name="fulfillment"]:checked');
      const isDelivery = selected && /entrega/i.test(selected.value);
      if (dom.addressGroup) dom.addressGroup.classList.toggle('hidden', !isDelivery);

      [dom.customerStreet, dom.customerExterior, dom.customerNeighborhood, dom.customerPostalCode, dom.customerCity, dom.customerState].forEach(function (field) {
        if (field) field.required = Boolean(isDelivery);
      });
    }

    function composeCheckoutAddress() {
      const parts = [];
      const street = dom.customerStreet ? dom.customerStreet.value.trim() : '';
      const exterior = dom.customerExterior ? dom.customerExterior.value.trim() : '';
      const interior = dom.customerInterior ? dom.customerInterior.value.trim() : '';
      const neighborhood = dom.customerNeighborhood ? dom.customerNeighborhood.value.trim() : '';
      const postal = dom.customerPostalCode ? dom.customerPostalCode.value.trim() : '';
      const city = dom.customerCity ? dom.customerCity.value.trim() : '';
      const stateName = dom.customerState ? dom.customerState.value.trim() : '';
      const references = dom.customerReferences ? dom.customerReferences.value.trim() : '';

      if (street || exterior) parts.push([street, exterior ? 'No. ' + exterior : '', interior ? 'Int. ' + interior : ''].filter(Boolean).join(' '));
      if (neighborhood) parts.push('Col. ' + neighborhood);
      if (postal) parts.push('C.P. ' + postal);
      if (city || stateName) parts.push([city, stateName].filter(Boolean).join(', '));
      if (references) parts.push('Referencias: ' + references);
      return parts.join(' · ');
    }

    async function submitOrder(event) {
      event.preventDefault();
      if (state.submitting) return;

      const form = dom.checkoutForm;
      if (!form.reportValidity()) return;

      const fulfillmentInput = dom.fulfillmentOptions.querySelector('input[name="fulfillment"]:checked');
      const payload = {
        name: dom.customerName.value.trim(),
        phone: dom.customerPhone.value.trim(),
        email: dom.customerEmail.value.trim(),
        fulfillment: fulfillmentInput ? fulfillmentInput.value : 'Por confirmar',
        address: composeCheckoutAddress(),
        notes: dom.customerNotes.value.trim(),
        website: dom.website.value.trim(),
        ageConfirmed: dom.checkoutAge.checked,
        source: isAppsScriptHost() ? 'Apps Script' : 'GitHub Pages',
        clientToken: createClientToken(),
        items: Object.keys(state.cart).map(code => ({ code, quantity: Number(state.cart[code]) }))
      };

      rememberCustomer(payload);
      setSubmitting(true);
      showCheckoutError('');

      try {
        const result = await backendCreateOrder(payload);
        if (!result || !result.ok) throw new Error((result && result.error) || 'No se pudo registrar el pedido.');

        state.lastOrder = {
          folio: result.folio || '',
          email: payload.email || '',
          total: Number(result.totalNet || 0)
        };
        state.cart = {};
        saveCart();
        renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);
        closeCheckoutForce();
        showSuccess(result);
      } catch (error) {
        showCheckoutError(error.message || String(error));
      } finally {
        setSubmitting(false);
      }
    }

    function setSubmitting(value) {
      state.submitting = value;
      if (dom.btnSubmitOrder) {
        dom.btnSubmitOrder.disabled = value;
        dom.btnSubmitOrder.setAttribute('aria-busy', value ? 'true' : 'false');
        dom.btnSubmitOrder.textContent = value ? 'Enviando compra…' : 'Confirmar y enviar compra';
      }
    }

    function showCheckoutError(message) {
      setText(dom.checkoutError, message);
      dom.checkoutError.classList.toggle('is-visible', Boolean(message));
    }

    function closeCheckoutForce() {
      dom.checkoutModal.classList.remove('is-open');
      dom.checkoutBackdrop.classList.remove('is-open');
    }

    function showSuccess(result) {
      setText(dom.successFolio, result.folio || '—');
      setText(dom.successTotal, money(result.totalNet || 0));
      if (result.whatsappUrl) {
        dom.btnSuccessWhatsApp.href = result.whatsappUrl;
        dom.btnSuccessWhatsApp.classList.remove('hidden');
      } else {
        dom.btnSuccessWhatsApp.classList.add('hidden');
        dom.btnSuccessWhatsApp.removeAttribute('href');
      }
      dom.successModal.classList.add('is-open');
      dom.successBackdrop.classList.add('is-open');
      document.body.classList.add('no-scroll');
    }

    function closeSuccess() {
      dom.successModal.classList.remove('is-open');
      dom.successBackdrop.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
    }

    function rememberCustomer(payload) {
      puzzlesStorageSet(STORAGE_KEYS.CUSTOMER, JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        email: payload.email
      }));
      scheduleAccountSync();
    }

    function restoreCustomer() {
      const customer = loadJson(STORAGE_KEYS.CUSTOMER, {});
      dom.customerName.value = customer.name || '';
      dom.customerPhone.value = customer.phone || '';
      dom.customerEmail.value = customer.email || '';
    }

    // ==========================================================
    // CUENTA Y SINCRONIZACIÓN
    // ==========================================================

    function openAuth() {
      updateAuthUi();
      dom.authModal.classList.add('is-open');
      dom.authBackdrop.classList.add('is-open');
      document.body.classList.add('no-scroll');
    }
    function closeAuth() {
      dom.authModal.classList.remove('is-open');
      dom.authBackdrop.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }
    function setAuthTab(tab) {
      const login = tab !== 'register';
      dom.btnAuthLoginTab.classList.toggle('is-active', login);
      dom.btnAuthRegisterTab.classList.toggle('is-active', !login);
      dom.loginForm.classList.toggle('hidden', !login);
      dom.registerForm.classList.toggle('hidden', login);
      dom.accountPanel.classList.add('hidden');
      dom.btnGoogleLogin.classList.remove('hidden');
      setText(dom.authTitle, login ? 'Iniciar sesión' : 'Crear cuenta');
    }
    function updateAuthUi() {
      const logged = Boolean(state.user && state.sessionToken);
      setText(dom.accountLabel, logged ? (state.user.name || 'Mi cuenta') : 'Ingresar');
      dom.accountPanel.classList.toggle('hidden', !logged);
      dom.loginForm.classList.toggle('hidden', logged);
      dom.registerForm.classList.add('hidden');
      dom.btnGoogleLogin.classList.toggle('hidden', logged);
      dom.btnAuthLoginTab.parentElement.classList.toggle('hidden', logged);
      setText(dom.authTitle, logged ? 'Mi cuenta' : 'Iniciar sesión');
      if (logged) {
        setText(dom.accountName, state.user.name || 'Usuario');
        setText(dom.accountEmail, state.user.email || '');
      }
      if (dom.accountRole) {
        dom.accountRole.classList.toggle('hidden', !(state.isAdmin || state.isStudio));
        if (state.isAdmin || state.isStudio) setText(dom.accountRole, state.isAdmin ? 'Administrador' : 'Studio');
      }

      if (dom.btnLogoutHeader) {
        dom.btnLogoutHeader.hidden = !logged;
        dom.btnLogoutHeader.classList.toggle('hidden', !logged);
      }
    }
    async function submitLogin(event) {
      event.preventDefault();
      if (!dom.loginForm.reportValidity()) return;
      showAuthError(dom.loginError, '');
      const result = await backendLogin({ email: dom.loginEmail.value.trim(), password: dom.loginPassword.value });
      handleAuthResult(result, dom.loginError);
    }
    async function submitRegister(event) {
      event.preventDefault();
      if (!dom.registerForm.reportValidity()) return;
      showAuthError(dom.registerError, '');
      const result = await backendRegister({ name: dom.registerName.value.trim(), email: dom.registerEmail.value.trim(), password: dom.registerPassword.value });
      handleAuthResult(result, dom.registerError);
    }
    async function submitGoogleLogin() {
      const result = await backendGoogleLogin();
      handleAuthResult(result, dom.loginError);
    }
    function handleAuthResult(result, errorElement) {
      if (!result || !result.ok) { showAuthError(errorElement, (result && result.error) || 'No se pudo iniciar sesión.'); return; }
      state.sessionToken = result.token;
      state.user = result.user;
      state.isAdmin = Boolean(result.user && result.user.isAdmin);
      state.isStudio = Boolean(result.user && result.user.isStudio);
      puzzlesStorageSet(STORAGE_KEYS.SESSION, state.sessionToken);
      const serverCart = result.cart && typeof result.cart === 'object' ? result.cart : {};
      const merged = Object.assign({}, serverCart, state.cart);
      state.cart = merged;
      saveCart();
      if (state.user) {
        dom.customerName.value = state.user.name || dom.customerName.value;
        dom.customerPhone.value = state.user.phone || dom.customerPhone.value;
        dom.customerEmail.value = state.user.email || dom.customerEmail.value;
      }
      normalizeCartAgainstCatalog();
      renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);
      if (state.ageConfirmedThisVisit) {
        puzzlesStorageSet(STORAGE_KEYS.AGE, 'true');
      }
      restoreAgeGate();
      updateAuthUi();
      loadAdminPricing().catch(() => {});
      if (state.isStudio) refreshStudioCatalog().catch(() => {});
      toast('Sesión iniciada. Tu carrito quedó guardado.', 'success');
      setTimeout(closeAuth, 450);
    }
    function showAuthError(element, message) {
      element.textContent = message;
      element.classList.toggle('is-visible', Boolean(message));
    }
    async function restoreSession() {
      if (!state.sessionToken || !isAppsScriptHost()) { state.isAdmin = false; state.isStudio = false; state.adminPrices = {}; updateAuthUi(); return; }
      const result = await backendRestoreSession(state.sessionToken);
      if (!result || !result.ok) {
        state.sessionToken = '';
        state.user = null;
        state.isAdmin = false;
        state.isStudio = false;
        state.adminPrices = {};
        puzzlesStorageRemove(STORAGE_KEYS.SESSION);
        puzzlesStorageRemove(STORAGE_KEYS.AGE);
        state.ageConfirmedThisVisit = false;
        restoreAgeGate();
        updateAuthUi();
        return;
      }
      state.user = result.user;
      state.isAdmin = Boolean(result.user && result.user.isAdmin);
      state.isStudio = Boolean(result.user && result.user.isStudio);
      const serverCart = result.cart && typeof result.cart === 'object' ? result.cart : {};
      if (!Object.keys(state.cart).length) state.cart = serverCart;
      if (state.user) {
        dom.customerName.value = state.user.name || dom.customerName.value;
        dom.customerPhone.value = state.user.phone || dom.customerPhone.value;
        dom.customerEmail.value = state.user.email || dom.customerEmail.value;
      }
      normalizeCartAgainstCatalog();
      saveCart();
      renderCart();
      window.setTimeout(cleanupLegacyBrandArtifacts, 0);
      restoreAgeGate();
      updateAuthUi();
      await loadAdminPricing();
      if (state.isStudio) await refreshStudioCatalog();
    }
    async function logoutUser() {
      if (state.sessionToken) await backendLogout(state.sessionToken);
      state.sessionToken = '';
      state.user = null;
      state.isAdmin = false;
      state.isStudio = false;
      state.adminPrices = {};
      puzzlesStorageRemove(STORAGE_KEYS.SESSION);
      puzzlesStorageRemove(STORAGE_KEYS.AGE);
      state.ageConfirmedThisVisit = false;
      updateAuthUi();
      closeAuth();
      restoreAgeGate();
      toast('Sesión cerrada.', 'success');
    }
    const scheduleAccountSync = debounce(async () => {
      if (!state.sessionToken || !state.user) return;
      const customer = loadJson(STORAGE_KEYS.CUSTOMER, {});
      await backendSaveAccountState({
        profile: { name: customer.name || state.user.name, phone: customer.phone || state.user.phone },
        cart: state.cart
      });
    }, 700);

    // ==========================================================
    // EDAD Y CONCIERGE
    // ==========================================================

    function restoreAgeGate() {
      const logged = Boolean(
        state.user &&
        state.sessionToken
      );

      const remembered = logged &&
        puzzlesStorageGet(
          STORAGE_KEYS.AGE
        ) === 'true';

      const confirmed =
        state.ageConfirmedThisVisit ||
        remembered;

      if (dom.agePrompt) {
        dom.agePrompt.classList.remove('hidden');
      }

      if (dom.ageDenied) {
        dom.ageDenied.classList.add('hidden');
      }

      if (dom.ageGate) {
        dom.ageGate.classList.toggle(
          'hidden',
          confirmed
        );

        dom.ageGate.setAttribute(
          'aria-hidden',
          confirmed ? 'true' : 'false'
        );

        dom.ageGate.style.display =
          confirmed ? 'none' : '';
      }

      document.body.classList.toggle(
        'no-scroll',
        !confirmed ||
        state.entrySplashActive ||
        Boolean(
          dom.intentWelcomeModal &&
          dom.intentWelcomeModal.classList.contains(
            'is-open'
          )
        )
      );
    }

    async function confirmAge() {
      state.ageConfirmedThisVisit = true;

      if (state.user && state.sessionToken) {
        puzzlesStorageSet(
          STORAGE_KEYS.AGE,
          'true'
        );
      } else {
        puzzlesStorageRemove(
          STORAGE_KEYS.AGE
        );
      }

      state.entrySplashActive = true;
      restoreAgeGate();

      if (dom.entrySplash) {
        dom.entrySplash.classList.remove('hidden');
        dom.entrySplash.setAttribute('aria-hidden', 'false');
      }

      if (dom.entrySplashBar) {
        dom.entrySplashBar.style.animation = 'none';
        void dom.entrySplashBar.offsetWidth;
        dom.entrySplashBar.style.animation =
          'entrySplashProgress 5s linear forwards';
      }

      document.body.classList.add('no-scroll');

      const minimumTime = new Promise(
        resolve => setTimeout(resolve, 5000)
      );

      const initialLoad =
        state.initialLoadPromise ||
        Promise.resolve();

      const guardedInitialLoad = Promise.race([
        initialLoad,
        new Promise(resolve => setTimeout(resolve, 8000))
      ]);

      await Promise.allSettled([
        minimumTime,
        guardedInitialLoad
      ]);

      state.entrySplashActive = false;

      const finishEntrySplash = () => {
        if (dom.entrySplash) {
          dom.entrySplash.classList.add('hidden');
          dom.entrySplash.classList.remove('is-leaving');
          dom.entrySplash.setAttribute('aria-hidden', 'true');
        }

        if (
          state.ageConfirmedThisVisit ||
          (
            state.user &&
            state.sessionToken &&
            puzzlesStorageGet(STORAGE_KEYS.AGE) === 'true'
          )
        ) {
          openIntentWelcome(false);

          if (
            !dom.intentWelcomeModal ||
            !dom.intentWelcomeModal.classList.contains('is-open')
          ) {
            document.body.classList.remove('no-scroll');
          }
        }
      };

      if (dom.entrySplash) {
        dom.entrySplash.classList.add('is-leaving');
        setTimeout(finishEntrySplash, 320);
      } else {
        finishEntrySplash();
      }
    }

    function denyAge() {
      state.ageConfirmedThisVisit = false;

      if (dom.agePrompt) {
        dom.agePrompt.classList.add('hidden');
      }

      if (dom.ageDenied) {
        dom.ageDenied.classList.remove('hidden');
      }
    }

    function openConcierge() {
      if (!state.store.whatsapp) {
        toast('Configura el número de WhatsApp en la hoja Config.', 'error');
        return;
      }
      const text = encodeURIComponent('Hola, necesito ayuda con el catálogo de ' + state.store.name + '.');
      window.open('https://wa.me/' + String(state.store.whatsapp).replace(/\D/g, '') + '?text=' + text, '_blank', 'noopener');
    }

    // ==========================================================
    // UTILIDADES
    // ==========================================================

    function toFiniteNumber(value) {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

      let text = String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[$MXN]/gi, '');

      if (!text) return 0;

      if (text.includes('.') && text.includes(',')) {
        text = text.replace(/,/g, '');
      } else if (text.includes(',') && !text.includes('.')) {
        text = /^-?\d+,\d{1,4}$/.test(text)
          ? text.replace(',', '.')
          : text.replace(/,/g, '');
      }

      text = text.replace(/[^0-9.\-]/g, '');
      const number = Number(text);
      return Number.isFinite(number) ? number : 0;
    }

    function normalizeProductRecord(product) {
      const normalized = Object.assign(
        {},
        product || {}
      );

      normalized.code = String(
        normalized.code ?? ''
      ).trim();

      normalized.description = String(
        normalized.description ?? ''
      ).trim();

      normalized.category = String(
        normalized.category || 'Otros'
      ).trim();

      // El nombre editorial llega persistido desde la hoja. La descripción
      // original se conserva como respaldo, pero ya no se usa para mezclar
      // categoría, marca y especialidad en una sola cadena sin jerarquía.
      normalized.canonicalName = String(
        normalized.canonicalName ||
        normalized.shortName ||
        normalized.description ||
        ''
      ).trim();

      normalized.displayName = normalized.canonicalName;

      normalized.volume =
        String(
          normalized.presentation ||
          normalized.volume ||
          extractVolumeDisplay(
            normalized.description
          ) ||
          ''
        ).trim();

      // La marca debe venir curada desde la hoja. El navegador ya no intenta
      // adivinarla porque esa lógica era la que mezclaba o cortaba nombres.
      normalized.brand = String(normalized.brand || '').trim();

      // No se fabrican descripciones genéricas en el frontend. El PDP muestra
      // exclusivamente el contenido editorial persistido en Google Sheets.
      normalized.commercialDescription = String(normalized.commercialDescription || '').trim();

      normalized.specialty = String(normalized.specialty || normalized.model || '').trim();
      normalized.pdpSummary = String(normalized.pdpSummary || '').trim();
      normalized.pdpDescription = String(normalized.pdpDescription || '').trim();
      normalized.pdpProfile = String(normalized.pdpProfile || '').trim();
      normalized.pdpServing = String(normalized.pdpServing || '').trim();
      normalized.pdpPairing = String(normalized.pdpPairing || '').trim();
      normalized.origin = String(normalized.origin || '').trim();
      normalized.alcohol = String(normalized.alcohol || '').trim();
      normalized.pdpHighlights = normalizeEditorialList(normalized.pdpHighlights, 4);
      normalized.pdpFacts = normalizeEditorialFacts(normalized.pdpFacts);

      normalized.priceNet = round2(
        toFiniteNumber(normalized.priceNet)
      );

      normalized.priceCompare = round2(
        toFiniteNumber(
          normalized.priceCompare
        )
      );

      normalized.priceNetText =
        normalized.priceNet.toFixed(2);

      normalized.priceCompareText =
        normalized.priceCompare.toFixed(2);

      normalized.imageUrl = String(
        normalized.imageUrl || ''
      ).trim();

      normalized.imageDisplayUrl =
        buildSquareImageUrl(
          normalized.imageUrl
        );

      normalized.searchCanonical = canonicalSearchText([
        normalized.code,
        normalized.upc,
        normalized.sku,
        normalized.brand,
        normalized.shortName,
        normalized.displayName,
        normalized.description,
        normalized.pdpSummary,
        normalized.pdpDescription,
        normalized.pdpProfile,
        normalized.pdpServing,
        normalized.pdpPairing,
        normalized.origin,
        normalized.alcohol,
        normalized.commercialDescription,
        normalized.model,
        normalized.color,
        normalized.presentation,
        normalized.category,
        normalized.unit,
        normalized.volume
      ].join(' '));

      normalized.searchTokens =
        normalized.searchCanonical
          .split(' ')
          .filter(Boolean);

      if (
        normalized.stock === null ||
        normalized.stock === undefined ||
        normalized.stock === ''
      ) {
        normalized.stock = null;
      } else {
        normalized.stock = Math.max(
          0,
          Math.floor(
            toFiniteNumber(normalized.stock)
          )
        );
      }

      normalized.available =
        normalized.priceNet > 0 &&
        (
          normalized.stock === null ||
          normalized.stock > 0
        );

      return normalized;
    }

    const CATEGORY_PREFIX_RULES = [
      [/^VINO\s+TINTO\b/i, 'Vino tinto'],
      [/^VINO\s+BLANCO\b/i, 'Vino blanco'],
      [/^VINO\s+ROSADO\b/i, 'Vino rosado'],
      [/^VINO\s+ESPUMOSO\b/i, 'Espumosos'],
      [/^CHAMPAGNE\b/i, 'Champagne'],
      [/^CHAMP[AÁ]N\b/i, 'Champagne'],
      [/^CHA(?:\.|\s)+(?!MP)/i, 'Champagne'],
      [/^AGUARDIENTE\b/i, 'Aguardiente'],
      [/^AGU(?:\.|\s)+(?!ARDIENTE)/i, 'Aguardiente'],
      [/^TEQUILA\b/i, 'Tequila'],
      [/^TEQ(?:\.|\s)+(?!UILA)/i, 'Tequila'],
      [/^MEZCAL\b/i, 'Mezcal'],
      [/^MEZ(?:\.|\s)+(?!CAL)/i, 'Mezcal'],
      [/^WHISK(?:E)?Y\b/i, 'Whisky'],
      [/^WHI(?:\.|\s)+(?!SK)/i, 'Whisky'],
      [/^VODKA\b/i, 'Vodka'],
      [/^VOD(?:\.|\s)+(?!KA)/i, 'Vodka'],
      [/^GINEBRA\b/i, 'Ginebra'],
      [/^GIN(?:\.|\s)+(?!EBRA)/i, 'Ginebra'],
      [/^BRANDY\b/i, 'Brandy'],
      [/^BRA(?:\.|\s)+(?!NDY)/i, 'Brandy'],
      [/^COGNAC\b/i, 'Cognac'],
      [/^CO[NÑ]AC\b/i, 'Cognac'],
      [/^LICOR(?:ES)?\b/i, 'Licores'],
      [/^LIC(?:\.|\s)+(?!OR)/i, 'Licores'],
      [/^CREMAS?\b/i, 'Cremas'],
      [/^CRE(?:\.|\s)+(?!MA)/i, 'Cremas'],
      [/^RON\b/i, 'Ron'],
      [/^AN[IÍ]S\b/i, 'Anís']
    ];

    const BRAND_ALIAS_RULES = [
      [/\b(?:LICOR\s+)?43(?:\s|$)/i, 'LICOR 43'],
      [/\bCHIVAS(?:\s+REGAL)?\b/i, 'CHIVAS REGAL'],
      [/\bSKYY\b/i, 'SKYY'],
      [/\bLOS\s+REYES\b/i, 'LOS REYES'],
      [/\bBYASS\b/i, 'BYASS'],
      [/\bCARLOS\s+I\b/i, 'CARLOS I'],
      [/\bDUQUE\s+DE\s+ALBA\b/i, 'DUQUE DE ALBA'],
      [/\bJAIME\s+I\b/i, 'JAIME I'],
      [/\bLEPANTO\b/i, 'LEPANTO'],
      [/\bBOODLES\b/i, 'BOODLES'],
      [/\bCANTERA\s+VERDE\b/i, 'CANTERA VERDE'],
      [/\bCONDESA\b/i, 'CONDESA'],
      [/\bDIEGA\b/i, 'DIEGA'],
      [/\bFIFTY\s+POUNDS\b/i, 'FIFTY POUNDS'],
      [/\bG\s*['’]?\s*VINE\b/i, 'G’VINE'],
      [/\bLARIOS\b/i, 'LARIOS'],
      [/\bLAS\s+CALIFORNIAS\b/i, 'LAS CALIFORNIAS'],
      [/\bLONDON\s+N(?:O|º|°)?\s*1\b/i, 'LONDON Nº1'],
      [/\bMARTIN\s+MILLER(?:['’´S]+)?\b/i, 'MARTIN MILLER’S'],
      [/\bMONKEY\s+47\b/i, 'MONKEY 47'],
      [/\bPUERTO\s+DE\s+INDIAS\b/i, 'PUERTO DE INDIAS'],
      [/\bWINT\s*(?:Y|&|AND)\s*LILA\b/i, 'WINT & LILA'],
      [/\bMOET(?:\s+(?:Y|ET|AND|&)\s+CHANDON|\s+CHANDON)?\b/i, 'MOËT & CHANDON'],
      [/\bVEUVE(?:\s+DE)?\s+CLICQUOT\b/i, 'VEUVE CLICQUOT'],
      [/\b(?:JOHNNIE|J)\s+WALKER\b/i, 'JOHNNIE WALKER'],
      [/\bMARTIN\s+CODAX\b/i, 'MARTÍN CÓDAX'],
      [/\bPITU\b/i, 'PITÚ'],
      [/\bMUMM\b/i, 'MUMM'],
      [/\bCUERVO\s+(?:ESPECIAL|TRADICIONAL|250\s+ANIV)/i, 'JOSÉ CUERVO'],
      [/\bTERRY\b/i, 'TERRY'],
      [/\bBRUXO\b/i, 'BRUXO'],
      [/\bOSO\s+NEGRO\b/i, 'OSO NEGRO'],
      [/\bPUERTO\s+DE\s+INDIAS\b/i, 'PUERTO DE INDIAS'],
      [/\bFIREBALL\b/i, 'FIREBALL'],
      [/\bPASSPORT\b/i, 'PASSPORT']
    ];

    function stripCategoryPrefix(value) {
      const original = String(value || '').trim();
      for (const [pattern, category] of CATEGORY_PREFIX_RULES) {
        const match = original.match(pattern);
        if (!match) continue;
        let rest = original.slice(match[0].length).replace(/^[\s.\-:·/]+/, '').trim();
        if (category === 'Aguardiente') rest = rest.replace(/^(?:DE\s+ORUJO(?:\s+CON\s+HIERBAS)?|DE\s+CA[NÑ]A)\b[\s.\-:·/]*/i, '');
        if (category === 'Licores') rest = rest.replace(/^(?:(?:DE|CON)\s+(?:WHISKY|WHISKEY|TEQUILA|AGAVE|CAF[EÉ]|HIERBAS?|FRUTAS?))\b[\s.\-:·/]*/i, '');
        return rest.trim();
      }
      return original;
    }

    const KNOWN_BRANDS = [
      '100 AÑOS',
      '1800',
      '3 GENERACIONES',
      '400 CONEJOS',
      '7 LEGUAS',
      'ALMA DE MAGNO',
      'ANCHO REYES',
      'APPLETON ESTATE',
      'ARMAND DE BRIGNAC',
      'AZTECA DE ORO',
      'BLACK & WHITE',
      'BLUE RHIN',
      'BOMBAY SAPPHIRE',
      'CAPITÁN MORGAN',
      'CARDENAL DE MENDOZA',
      'CASA DRAGONES',
      'CASA MADERO',
      'CASILLERO DEL DIABLO',
      'CHATEAU DOMECQ',
      'CHIVAS REGAL',
      'CONCHA Y TORO',
      'CUERVO 1800',
      'DON JULIO',
      'DON PEDRO',
      'DON RAMÓN',
      'DOM PÉRIGNON',
      'FLOR DE CAÑA',
      'GRAN CENTENARIO',
      'GRAND MARNIER',
      'HAVANA CLUB',
      'JACK DANIELS',
      'JOHNNIE WALKER',
      'JOSÉ CUERVO',
      'LA CETTO',
      'LAMBRUSCO RIUNITE',
      'LOS DANZANTES',
      'LOS VASCOS',
      'LOUIS ROEDERER',
      'MAESTRO DOBEL',
      'MARQUÉS DE CÁCERES',
      'MARQUÉS DE RISCAL',
      'MOËT & CHANDON',
      'MONTE XANIC',
      'OJO DE TIGRE',
      'OLMECA ALTOS',
      'PATA NEGRA',
      'PERRIER JOUËT',
      'RECUERDO DE OAXACA',
      'RÉMY MARTIN',
      'RON ZACAPA',
      'SANGRE DE TORO',
      'SANTO TOMÁS',
      'SAUZA HORNITOS',
      'ST RÉMY',
      'TERRAZAS DE LOS ANDES',
      'THE DALMORE',
      'VALLE REDONDO',
      'VEUVE CLICQUOT',
      'VIUDA DE ROMERO',
      'ABSOLUT',
      'ALACRÁN',
      'ALIPÚS',
      'AMARÁS',
      'ANTILLANO',
      'APEROL',
      'ARZUAGA',
      'BACARDÍ',
      'BALLANTINES',
      'BEEFEATER',
      'BENEVA',
      'BERONIA',
      'BOMBAY',
      'BROCKMANS',
      'BUCHANANS',
      'BULLDOG',
      'BUSHMILLS',
      'CABRITO',
      'CADENAS',
      'CAZADORES',
      'CHANDON',
      'CHINCHÓN',
      'CINZANO',
      'CORRALEJO',
      'COURVOISIER',
      'CREYENTE',
      'CUNE',
      'DISARONNO',
      'ENEMIGO',
      'FREIXENET',
      'FUNDADOR',
      'GLENFIDDICH',
      'GLENLIVET',
      'GLENMORANGIE',
      'HENDRICKS',
      'HENNESSY',
      'HERRADURA',
      'HPNOTIQ',
      'J&B',
      'JÄGERMEISTER',
      'JIMADOR',
      'JIM BEAM',
      'LILLET',
      'MACALLAN',
      'MARTELL',
      'MARTINI',
      'MATARROMERA',
      'MATUSALEM',
      'MIDORI',
      'MONTELOBOS',
      'ORENDAIN',
      'PATRÓN',
      'PESQUERA',
      'PRESIDENTE',
      'PROTOS',
      'RANCHO ESCONDIDO',
      'SMIRNOFF',
      'STOLICHNAYA',
      'TAITTINGER',
      'TANQUERAY',
      'TORRES',
      'TRAPICHE',
      'WYBOROWA',
      'ZAVERICH',
      'ZIGNUM'
    ];

    const BRAND_STOP_WORDS = new Set([
      'BLANCO', 'BLANCA', 'REPOSADO', 'AÑEJO',
      'ANEJO', 'EXTRA', 'DULCE', 'SECO', 'SECA',
      'RESERVA', 'ESPECIAL', 'PREMIUM', 'ORO',
      'GOLD', 'PLATA', 'SILVER', 'ROJO', 'ROSSO',
      'ROSADO', 'TINTO', 'BRUT', 'JOVEN',
      'CRISTALINO', 'CLASICO', 'CLÁSICO',
      'TRADICIONAL', 'IMPERIAL', 'DELUXE',
      'SIGNATURE', 'NEGRO', 'BLACK', 'WHITE',
      '100%', 'EDICION', 'EDICIÓN'
    ]);


    function extractVolumeDisplay(value) {
      const matches = String(value || '')
        .toUpperCase()
        .match(/\b\d+(?:[.,]\d+)?\s*(?:ML|L)\b/g);

      if (!matches || !matches.length) {
        return '';
      }

      return matches[matches.length - 1]
        .replace(/\s+/g, '')
        .replace(',', '.');
    }

    function volumeToMl(value) {
      const match = String(value || '')
        .toUpperCase()
        .replace(',', '.')
        .match(/(\d+(?:\.\d+)?)\s*(ML|L)/);

      if (!match) {
        return Number.POSITIVE_INFINITY;
      }

      const amount = Number(match[1]);
      return match[2] === 'L'
        ? amount * 1000
        : amount;
    }

    function inferBrandFromName(value) {
      const name = String(value || '').trim();
      if (!name) return '';

      const normalizedName = normalize(name).toUpperCase();
      for (const [pattern, brand] of BRAND_ALIAS_RULES) {
        if (pattern.test(normalizedName)) return brand;
      }

      const orderedBrands = KNOWN_BRANDS.slice().sort((left, right) => right.length - left.length);
      for (const brand of orderedBrands) {
        if (normalize(name).includes(normalize(brand))) return brand;
      }

      const stripped = stripCategoryPrefix(name)
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:ML|L)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!stripped) return '';

      const tokens = stripped.split(' ').filter(Boolean);
      const leadingNoise = new Set(['DE','DEL','CON','Y','ORUJO','HIERBAS','AGAVE','TEQUILA','WHISKY','WHISKEY','CAFE','CAFÉ']);
      while (tokens.length) {
        const first = normalize(tokens[0]).toUpperCase();
        if (!leadingNoise.has(first) && !BRAND_STOP_WORDS.has(first)) break;
        tokens.shift();
      }

      const output = [];
      for (const token of tokens) {
        const normalizedToken = normalize(token).toUpperCase();
        if (output.length && (BRAND_STOP_WORDS.has(normalizedToken) || /^\d/.test(normalizedToken))) break;
        output.push(token);
        if (output.length >= 4) break;
      }
      return output.join(' ').replace(/[.,;:]+$/g, '').trim();
    }

    function buildSquareImageUrl(value) {
      const source = String(
        value || ''
      ).trim();

      if (!/^https?:\/\//i.test(source)) {
        return source;
      }

      try {
        if (/images\.weserv\.nl\//i.test(source)) {
          const proxyUrl =
            new URL(source);

          proxyUrl.searchParams.set('w', '900');
          proxyUrl.searchParams.set('h', '900');
          proxyUrl.searchParams.set(
            'fit',
            'contain'
          );
          proxyUrl.searchParams.set(
            'cbg',
            'ececea'
          );
          proxyUrl.searchParams.set(
            'bg',
            'ececea'
          );
          proxyUrl.searchParams.set(
            'output',
            'webp'
          );
          proxyUrl.searchParams.set('q', '87');
          proxyUrl.searchParams.set('we', '1');

          return proxyUrl.toString();
        }
      } catch (_) {}

      return (
        'https://images.weserv.nl/?url=' +
        encodeURIComponent(source) +
        '&w=900&h=900&fit=contain' +
        '&cbg=ececea&bg=ececea&output=webp&q=88&we=1'
      );
    }

    function getProduct(code) {
      return state.products.find(product => String(product.code) === String(code));
    }

    function categoryLetter(category) {
      const clean = String(category || 'P').trim();
      return clean.charAt(0).toUpperCase() || 'P';
    }

    const MONEY_FORMATTER = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    function money(value) {
      return MONEY_FORMATTER.format(round2(toFiniteNumber(value)));
    }

    function round2(value) {
      return Math.round((toFiniteNumber(value) + Number.EPSILON) * 100) / 100;
    }

    function round4(value) {
      return Math.round((toFiniteNumber(value) + Number.EPSILON) * 10000) / 10000;
    }

    function normalize(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[char]);
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function cssEscape(value) {
      if (window.CSS && CSS.escape) return CSS.escape(String(value));
      return String(value).replace(/(["\\])/g, '\\$1');
    }

    function loadJson(key, fallback) {
      try {
        const parsed = JSON.parse(puzzlesStorageGet(key));
        return parsed && typeof parsed === 'object' ? parsed : fallback;
      } catch (_) {
        return fallback;
      }
    }

    function debounce(fn, wait) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
      };
    }

    function createClientToken() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'puz-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }

    function toast(message, type = '') {
      const item = document.createElement('div');
      item.className = 'toast ' + (type ? 'toast--' + type : '');
      item.textContent = message;
      dom.toastStack.appendChild(item);
      requestAnimationFrame(() => item.classList.add('is-visible'));
      setTimeout(() => {
        item.classList.remove('is-visible');
        setTimeout(() => item.remove(), 220);
      }, 3200);
    }

/* ============================================================
   PUZZLES · CAPA EDITORIAL DE INTERACCIÓN Y NAVEGACIÓN
   ============================================================ */
(function installPuzzlesEditorialExperience() {
  function run() {
    const root = document.documentElement;
    const announcement = document.querySelector('.announcement');
    const header = document.querySelector('.site-header');
    const hero = document.getElementById('heroCarousel');
    const controls = hero && hero.querySelector('.hero-carousel__controls');

    function updateChromeMetrics() {
      const announcementHeight = announcement ? Math.ceil(announcement.getBoundingClientRect().height) : 0;
      const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
      root.style.setProperty('--puzzles-announcement-real-h', announcementHeight + 'px');
      root.style.setProperty('--puzzles-header-real-h', headerHeight + 'px');
      root.style.setProperty('--puzzles-fixed-chrome-real-h', (announcementHeight + headerHeight) + 'px');
    }

    updateChromeMetrics();
    window.addEventListener('resize', debounceEditorial(updateChromeMetrics, 100), { passive: true });

    if (hero && !hero.querySelector('.hero-brand-signature')) {
      const signature = document.createElement('div');
      signature.className = 'hero-brand-signature';
      signature.setAttribute('aria-label', 'PUZZLES, vinos, licores y destilados');
      signature.innerHTML = '<strong>PUZZLES</strong><span>VINOS · LICORES · DESTILADOS</span>';
      hero.appendChild(signature);
    }

    if (hero && controls && controls.parentElement === hero) {
      controls.classList.add('hero-carousel__controls--external');
      hero.insertAdjacentElement('afterend', controls);
    }

    const closeControlByModalId = {
      checkoutModal: 'btnCloseCheckout',
      authModal: 'btnCloseAuth',
      productDetailModal: 'btnCloseProductDetail',
      imageZoomModal: 'btnCloseImageZoom',
      successModal: 'btnSuccessClose',
      intentWelcomeModal: 'btnCloseIntentWelcome'
    };

    const closeControlByBackdropId = {
      mainBackdrop: 'btnCloseCart',
      checkoutBackdrop: 'btnCloseCheckout',
      authBackdrop: 'btnCloseAuth',
      productDetailBackdrop: 'btnCloseProductDetail',
      imageZoomBackdrop: 'btnCloseImageZoom',
      successBackdrop: 'btnSuccessClose',
      intentWelcomeBackdrop: 'btnCloseIntentWelcome'
    };

    document.addEventListener('pointerup', function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const backdropButtonId = closeControlByBackdropId[target.id];
      if (backdropButtonId && target.classList.contains('is-open')) {
        const button = document.getElementById(backdropButtonId);
        if (button) button.click();
        return;
      }

      const modal = target.closest('.modal.is-open, .image-zoom-modal.is-open, .intent-welcome-modal.is-open');
      if (!modal) return;

      const isOutsideCard = modal.classList.contains('image-zoom-modal')
        ? target === modal
        : !target.closest('.modal__card, .intent-welcome-card, .image-zoom-modal img');

      if (!isOutsideCard) return;
      const buttonId = closeControlByModalId[modal.id];
      const button = buttonId ? document.getElementById(buttonId) : null;
      if (button) button.click();
    });

    document.body.classList.add('puzzles-editorial-ready');
  }

  function debounceEditorial(fn, wait) {
    let timer = 0;
    return function () {
      const args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

/* ============================================================
   PUZZLES · SISTEMA DE DISEÑO REVISITADO
   Función, proporción, claridad, cuidado y continuidad.
   ============================================================ */
(function installPuzzlesRevisitedSystem() {
  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function installFooter() {
    const footer = document.querySelector('.footer');
    const inner = footer && footer.querySelector('.footer__inner');
    const bottom = footer && footer.querySelector('.footer__bottom');
    if (!footer || !inner || footer.dataset.revisited === 'true') return;

    footer.dataset.revisited = 'true';
    footer.classList.add('footer--revisited');

    const columns = Array.from(inner.children);
    const brandColumn = columns[0] || null;
    const responsibleColumn = columns[1] || null;
    const serviceColumn = columns[2] || null;

    if (brandColumn) {
      brandColumn.classList.add('footer__brand-column');
      const paragraph = brandColumn.querySelector('p');
      if (paragraph) {
        paragraph.textContent = 'Una colección de vinos, licores y destilados elegida para celebrar, compartir, regalar y descubrir con intención.';
      }
    }

    if (responsibleColumn) {
      responsibleColumn.classList.add('footer__column');
      const heading = responsibleColumn.querySelector('h4');
      if (heading) heading.textContent = 'Compra responsable';
    }

    if (serviceColumn) {
      serviceColumn.classList.add('footer__column');
      const catalogButton = serviceColumn.querySelector('[data-scroll-catalog]');
      const conciergeButton = serviceColumn.querySelector('#btnFooterWhatsApp');
      serviceColumn.innerHTML = '<h4>Explorar</h4><ul class="footer__links"></ul>';
      const list = serviceColumn.querySelector('ul');

      if (catalogButton) {
        catalogButton.classList.add('footer__link-control');
        catalogButton.textContent = 'Ver catálogo completo';
        const item = document.createElement('li');
        item.appendChild(catalogButton);
        list.appendChild(item);
      }

      if (conciergeButton) {
        conciergeButton.classList.add('footer__link-control');
        conciergeButton.textContent = 'Atención y concierge';
        const item = document.createElement('li');
        item.appendChild(conciergeButton);
        list.appendChild(item);
      }
    }

    if (!inner.querySelector('.footer__contact-column')) {
      const contact = document.createElement('div');
      contact.className = 'footer__column footer__contact-column';
      contact.innerHTML = [
        '<h4>Contacto y mayoreo</h4>',
        '<p>Cotizaciones, pedidos especiales y consultas para compras por volumen.</p>',
        '<button class="footer__contact-button" type="button" data-open-contact>Solicitar atención</button>',
        '<span class="footer__response-note">Compártenos productos, cantidades y ciudad de entrega.</span>'
      ].join('');
      inner.appendChild(contact);
    }

    if (!inner.querySelector('.footer__legal-column')) {
      const legal = document.createElement('div');
      legal.className = 'footer__column footer__legal-column';
      legal.innerHTML = [
        '<h4>Información</h4>',
        '<ul class="footer__policy-list">',
        '<li>Venta exclusiva para mayores de 18 años</li>',
        '<li>Precios y disponibilidad sujetos a confirmación</li>',
        '<li>Imágenes de carácter ilustrativo</li>',
        '<li>Evita el exceso</li>',
        '</ul>'
      ].join('');
      inner.appendChild(legal);
    }

    if (bottom) {
      const year = new Date().getFullYear();
      bottom.innerHTML = [
        '<span id="footerText">Venta exclusiva para mayores de 18 años. Precios y disponibilidad sujetos a confirmación.</span>',
        '<span>PUZZLES · VINOS · LICORES · DESTILADOS · ' + year + '</span>'
      ].join('');
    }
  }

  function installFilterFollower() {
    const panel = document.getElementById('filtersPanel');
    const layout = document.querySelector('.catalog-layout');
    if (!panel || !layout || panel.dataset.followInstalled === 'true') return;

    panel.dataset.followInstalled = 'true';
    panel.classList.add('filters-panel--follow-ready');

    let slot = panel.parentElement && panel.parentElement.classList.contains('filters-panel-slot')
      ? panel.parentElement
      : null;

    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'filters-panel-slot';
      panel.parentNode.insertBefore(slot, panel);
      slot.appendChild(panel);
    }

    function updateStickyOffset() {
      const root = document.documentElement;
      const value = parseFloat(
        getComputedStyle(root).getPropertyValue('--puzzles-fixed-chrome-real-h')
      );
      const offset = Number.isFinite(value) ? value : 104;
      slot.style.setProperty('--filters-sticky-top', Math.round(offset + 16) + 'px');
    }

    updateStickyOffset();
    window.addEventListener('resize', updateStickyOffset, { passive: true });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateStickyOffset);
      const announcement = document.querySelector('.announcement');
      const header = document.querySelector('.site-header');
      if (announcement) observer.observe(announcement);
      if (header) observer.observe(header);
    }
  }

  function installDesignSignals() {
    document.documentElement.classList.add('puzzles-design-revisited');
    document.body.classList.add('puzzles-design-revisited');

    const catalog = document.getElementById('catalogo');
    if (catalog) catalog.setAttribute('data-page-size', '25');
  }



  function mountStudioWorkspace() {
    if (document.getElementById('studioWorkspace')) return document.getElementById('studioWorkspace');
    const modal = document.getElementById('studioModal');
    const backdrop = document.getElementById('studioBackdrop');
    if (!modal) return null;

    const tabs = modal.querySelector('.studio-tabs');
    const body = modal.querySelector('.studio-body');
    const catalog = document.getElementById('catalogo') || document.querySelector('.catalog-section');
    const layout = document.querySelector('.catalog-layout');
    if (!tabs || !body || !catalog) return null;

    const workspace = document.createElement('section');
    workspace.id = 'studioWorkspace';
    workspace.className = 'studio-workspace';
    workspace.hidden = true;
    workspace.setAttribute('aria-label', 'PUZZLES Studio');
    workspace.innerHTML = [
      '<header class="studio-workspace__head">',
      '<div><span class="operational-kicker">MODO EDITORIAL</span><h2>PUZZLES Studio</h2><p>Edita publicaciones, banners y documentos sin abrir otra sesión.</p></div>',
      '<span class="studio-workspace__session">La sesión se controla desde el encabezado principal.</span>',
      '</header>'
    ].join('');
    workspace.appendChild(tabs);
    workspace.appendChild(body);

    if (layout && layout.parentElement === catalog) catalog.insertBefore(workspace, layout);
    else catalog.insertBefore(workspace, catalog.firstChild);

    modal.remove();
    if (backdrop) backdrop.remove();
    return workspace;
  }

  function ensureOperationalUi() {
    const successActions = document.getElementById('successActions');
    if (successActions && !document.getElementById('btnRequestSalesNote')) {
      const documents = document.createElement('div');
      documents.className = 'success-document-actions';
      documents.innerHTML = '<p>¿Necesitas un documento comercial?</p><div><button id="btnRequestSalesNote" class="btn btn--ghost" type="button">Enviar nota de venta</button><button id="btnRequestQuote" class="btn btn--ghost" type="button">Enviar cotización</button></div><span id="successDocumentStatus" aria-live="polite"></span>';
      successActions.insertBefore(documents, document.getElementById('btnSuccessClose'));
    }
    if (!document.getElementById('contactModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="contactBackdrop" class="backdrop operational-backdrop"></div>
        <section id="contactModal" class="modal operational-modal" role="dialog" aria-modal="true" aria-labelledby="contactTitle">
          <div class="modal__card operational-card contact-card">
            <div class="modal__head"><div><span class="operational-kicker">PUZZLES</span><h2 id="contactTitle">Contacto y mayoreo</h2></div><button id="btnCloseContact" class="modal-close" type="button" aria-label="Cerrar">×</button></div>
            <div class="modal__body">
              <form id="contactForm" class="operational-form">
                <div class="operational-grid">
                  <label>Nombre<input id="contactName" required maxlength="120"></label>
                  <label>Correo<input id="contactEmail" type="email" maxlength="180"></label>
                  <label>Teléfono / WhatsApp<input id="contactPhone" inputmode="tel" maxlength="18"></label>
                  <label>Empresa<input id="contactCompany" maxlength="160"></label>
                  <label>Ciudad<input id="contactCity" maxlength="120"></label>
                  <label>Tipo de solicitud<select id="contactType"><option>Cotización</option><option>Mayoreo</option><option>Disponibilidad</option><option>Nota de venta</option><option>Consulta general</option></select></label>
                </div>
                <label class="operational-form__wide">Producto relacionado<input id="contactProduct" readonly></label>
                <input id="contactProductCode" type="hidden">
                <input id="contactWebsite" class="hp-field" autocomplete="off" tabindex="-1">
                <label class="operational-form__wide">¿Qué necesitas?<textarea id="contactMessage" required maxlength="1800" rows="5"></textarea></label>
                <div id="contactError" class="form-error"></div>
                <div class="modal__actions"><button type="button" class="btn btn--ghost" id="btnCancelContact">Cancelar</button><button type="submit" class="btn btn--primary" id="btnSubmitContact">Enviar solicitud</button></div>
              </form>
            </div>
          </div>
        </section>`);
    }

    if (!document.getElementById('studioModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="studioBackdrop" class="backdrop operational-backdrop"></div>
        <section id="studioModal" class="modal operational-modal studio-modal" role="dialog" aria-modal="true" aria-labelledby="studioTitle">
          <div class="modal__card operational-card studio-card">
            <div class="modal__head"><div><span class="operational-kicker">OPERACIÓN</span><h2 id="studioTitle">PUZZLES Studio</h2></div><button id="btnCloseStudio" class="modal-close" type="button" aria-label="Cerrar">×</button></div>
            <div class="studio-tabs" role="tablist">
              <button class="is-active" data-studio-tab="products" type="button">Productos</button>
              <button data-studio-tab="banners" type="button">Banners</button>
              <button data-studio-tab="documents" type="button">Documentos</button>
            </div>
            <div class="modal__body studio-body">
              <section data-studio-panel="products">
                <div class="studio-toolbar">
                  <input id="studioSearch" type="search" placeholder="Buscar producto, marca o categoría">
                  <select id="studioStatus"><option value="TODOS">Todos los estados</option><option>ACTIVO</option><option>OCULTO</option><option>BORRADOR</option><option>CONSULTAR</option><option>NO_ACTIVO</option></select>
                  <button id="btnStudioRefresh" type="button">Actualizar</button>
                </div>
                <div class="studio-bulk"><span id="studioSelectionCount">0 seleccionados</span><button data-bulk-status="ACTIVO" type="button">Activar</button><button data-bulk-status="OCULTO" type="button">Ocultar</button><button data-bulk-status="BORRADOR" type="button">Borrador</button></div>
                <div id="studioProductList" class="studio-product-list"><div class="studio-empty">Inicia sesión con una cuenta Studio o Admin.</div></div>
              </section>
              <section data-studio-panel="banners" hidden><div id="studioBannerList" class="studio-banner-list"></div></section>
              <section data-studio-panel="documents" hidden><div class="studio-toolbar"><button id="btnStudioLoadOrders" type="button">Cargar pedidos recientes</button></div><div id="studioOrderList" class="studio-order-list"></div></section>
            </div>
          </div>
        </section>`);
    }

    if (!document.getElementById('studioEditorModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="studioEditorBackdrop" class="backdrop operational-backdrop"></div>
        <section id="studioEditorModal" class="modal operational-modal" role="dialog" aria-modal="true" aria-labelledby="studioEditorTitle">
          <div class="modal__card operational-card studio-editor-card">
            <div class="modal__head"><div><span class="operational-kicker">EDICIÓN</span><h2 id="studioEditorTitle">Editar publicación</h2></div><button id="btnCloseStudioEditor" class="modal-close" type="button" aria-label="Cerrar">×</button></div>
            <div class="modal__body"><form id="studioEditorForm" class="operational-form"><input id="studioEditCode" type="hidden"><div class="operational-grid">
              <label class="operational-form__wide">Nombre visible<input id="studioEditName" maxlength="240"></label>
              <label>Marca<input id="studioEditBrand" maxlength="160"></label><label>Categoría<input id="studioEditCategory" maxlength="120"></label>
              <label>Especialidad / edición<input id="studioEditSpecialty" maxlength="180"></label><label>Presentación<input id="studioEditPresentation" maxlength="80"></label>
              <label>Estado web<select id="studioEditStatus"><option>ACTIVO</option><option>OCULTO</option><option>BORRADOR</option><option>CONSULTAR</option><option>NO_ACTIVO</option></select></label>
              <label>Precio venta<input id="studioEditPrice" inputmode="decimal"></label><label>Precio anterior<input id="studioEditCompare" inputmode="decimal"></label>
              <label class="operational-form__wide">Resumen<textarea id="studioEditSummary" rows="2" maxlength="700"></textarea></label>
              <label class="operational-form__wide">Descripción<textarea id="studioEditDescription" rows="7" maxlength="7000"></textarea></label>
              <label class="operational-form__wide">Perfil<textarea id="studioEditProfile" rows="3"></textarea></label>
              <label class="operational-form__wide">Servicio<textarea id="studioEditServing" rows="3"></textarea></label>
              <label class="operational-form__wide">Maridaje<textarea id="studioEditPairing" rows="3"></textarea></label>
              <label>Origen<input id="studioEditOrigin"></label><label>Graduación<input id="studioEditAlcohol"></label>
              <label class="operational-form__wide">Ficha técnica JSON<textarea id="studioEditFacts" rows="4"></textarea></label>
              <label class="operational-form__wide">URL de imagen procesada<input id="studioEditProcessedImage" type="url"></label>
            </div><div id="studioEditorError" class="form-error"></div><div class="modal__actions"><button type="button" class="btn btn--ghost" id="btnCancelStudioEditor">Cancelar</button><button type="submit" class="btn btn--primary">Guardar cambios</button></div></form></div>
          </div>
        </section>`);
    }

    if (!document.getElementById('btnStudioHeader')) {
      const anchor = document.getElementById('btnAccountHeader');
      if (anchor) {
        const button = document.createElement('button');
        button.id = 'btnStudioHeader'; button.type = 'button'; button.className = 'icon-button studio-header-button hidden';
        button.innerHTML = '<span class="studio-header-mark">S</span><span class="icon-button__label">Studio</span>';
        anchor.parentElement.insertBefore(button, anchor);
      }
    }

    mountStudioWorkspace();
    installOperationalEvents();
  }

  let operationalEventsInstalled = false;
  function installOperationalEvents() {
    if (operationalEventsInstalled) return;
    operationalEventsInstalled = true;
    const closePair = (modalId, backdropId) => {
      document.getElementById(modalId)?.classList.remove('is-open');
      document.getElementById(backdropId)?.classList.remove('is-open');
      if (!document.querySelector('.modal.is-open, .drawer.is-open')) document.body.classList.remove('no-scroll');
    };
    document.addEventListener('click', event => {
      const contactTrigger = event.target.closest('[data-open-contact]');
      if (contactTrigger) { event.preventDefault(); openContact(); return; }
      const studioTrigger = event.target.closest('#btnStudioHeader');
      if (studioTrigger) { event.preventDefault(); openStudio(); return; }
      const editCurrent = event.target.closest('[data-studio-edit-current]');
      if (editCurrent) {
        event.preventDefault();
        openStudioEditor(state.detailProductCode);
        return;
      }
      const edit = event.target.closest('[data-studio-edit-code]');
      if (edit) { event.preventDefault(); openStudioEditor(edit.dataset.studioEditCode); return; }
      const checkbox = event.target.closest('[data-studio-select]');
      if (checkbox) {
        const code = checkbox.dataset.studioSelect;
        checkbox.checked ? state.studioSelected.add(code) : state.studioSelected.delete(code);
        updateStudioSelection(); return;
      }
      const bulk = event.target.closest('[data-bulk-status]');
      if (bulk) { setSelectedStudioStatus(bulk.dataset.bulkStatus); return; }
      const tab = event.target.closest('[data-studio-tab]');
      if (tab) { setStudioTab(tab.dataset.studioTab); return; }
      const bannerSave = event.target.closest('[data-banner-save]');
      if (bannerSave) { saveStudioBanner(Number(bannerSave.dataset.bannerSave)); return; }
      const doc = event.target.closest('[data-generate-document]');
      if (doc) { generateStudioDocument(doc.dataset.folio, doc.dataset.generateDocument, doc.dataset.send === 'true'); return; }
    });
    document.getElementById('btnCloseContact')?.addEventListener('click', () => closePair('contactModal','contactBackdrop'));
    document.getElementById('btnCancelContact')?.addEventListener('click', () => closePair('contactModal','contactBackdrop'));
    document.getElementById('contactBackdrop')?.addEventListener('click', () => closePair('contactModal','contactBackdrop'));
    document.getElementById('contactForm')?.addEventListener('submit', submitContactForm);
    document.getElementById('btnStudioRefresh')?.addEventListener('click', () => refreshStudioCatalog(true));
    document.getElementById('studioSearch')?.addEventListener('input', renderStudioProducts);
    document.getElementById('studioStatus')?.addEventListener('change', renderStudioProducts);
    document.getElementById('btnCloseStudioEditor')?.addEventListener('click', () => closePair('studioEditorModal','studioEditorBackdrop'));
    document.getElementById('btnCancelStudioEditor')?.addEventListener('click', () => closePair('studioEditorModal','studioEditorBackdrop'));
    document.getElementById('studioEditorBackdrop')?.addEventListener('click', () => closePair('studioEditorModal','studioEditorBackdrop'));
    document.getElementById('studioEditorForm')?.addEventListener('submit', saveStudioProduct);
    document.getElementById('btnStudioLoadOrders')?.addEventListener('click', loadStudioOrders);
    document.getElementById('btnRequestSalesNote')?.addEventListener('click', () => requestCustomerDocument('NOTA DE VENTA'));
    document.getElementById('btnRequestQuote')?.addEventListener('click', () => requestCustomerDocument('COTIZACIÓN'));
  }

  async function requestCustomerDocument(type) {
    const status = document.getElementById('successDocumentStatus');
    const noteButton = document.getElementById('btnRequestSalesNote');
    const quoteButton = document.getElementById('btnRequestQuote');
    if (!state.lastOrder?.folio || !state.lastOrder?.email) {
      if (status) status.textContent = 'No encontramos el correo asociado a este pedido.';
      return;
    }
    [noteButton, quoteButton].forEach(button => { if (button) button.disabled = true; });
    if (status) status.textContent = 'Generando y enviando…';
    try {
      const result = await gasRun('solicitarDocumentoPedido', {
        folio: state.lastOrder.folio,
        email: state.lastOrder.email,
        type
      }, 45000);
      if (!result?.ok) throw new Error(result?.error || 'No se pudo generar el documento.');
      if (status) status.textContent = result.message || 'Documento enviado al correo asociado al pedido.';
      toast('Documento enviado.', 'success');
    } catch (error) {
      if (status) status.textContent = error.message || String(error);
      toast(error.message || 'No se pudo enviar el documento.', 'error');
    } finally {
      [noteButton, quoteButton].forEach(button => { if (button) button.disabled = false; });
    }
  }

  function syncStudioControls() {
    const button = document.getElementById('btnStudioHeader');
    if (button) button.classList.toggle('hidden', !state.isStudio);
    let wrap = document.getElementById('studioStatusFilterWrap');
    if (state.isStudio && dom.filtersPanel && !wrap) {
      wrap = document.createElement('div'); wrap.id = 'studioStatusFilterWrap'; wrap.className = 'filter-group studio-status-filter';
      wrap.innerHTML = '<label for="studioCatalogStatus">VISIBILIDAD</label><select id="studioCatalogStatus"><option value="TODOS">Todos</option><option>ACTIVO</option><option>OCULTO</option><option>BORRADOR</option><option>CONSULTAR</option><option>NO_ACTIVO</option></select>';
      dom.filtersPanel.appendChild(wrap);
      wrap.querySelector('select').addEventListener('change', event => { state.studioStatus = event.target.value; state.page = 1; applyFilters(); });
    }
    if (wrap) wrap.hidden = !state.isStudio;
  }

  function openContact(product) {
    const modal = document.getElementById('contactModal'); const backdrop = document.getElementById('contactBackdrop');
    if (!modal || !backdrop) return;
    const customer = loadJson(STORAGE_KEYS.CUSTOMER, {});
    document.getElementById('contactName').value = state.user?.name || customer.name || '';
    document.getElementById('contactEmail').value = state.user?.email || customer.email || '';
    document.getElementById('contactPhone').value = state.user?.phone || customer.phone || '';
    const related = product || (state.detailProductCode ? getProduct(state.detailProductCode) : null);
    document.getElementById('contactProduct').value = related ? related.displayName : '';
    document.getElementById('contactProductCode').value = related ? related.code : '';
    document.getElementById('contactMessage').value = related ? 'Quiero información, disponibilidad o una cotización de este producto.' : '';
    modal.classList.add('is-open'); backdrop.classList.add('is-open'); document.body.classList.add('no-scroll');
  }

  async function submitContactForm(event) {
    event.preventDefault();
    const error = document.getElementById('contactError'); const button = document.getElementById('btnSubmitContact');
    error.textContent = ''; button.disabled = true;
    try {
      const result = await gasRun('submitContactLead', {
        name: document.getElementById('contactName').value,
        email: document.getElementById('contactEmail').value,
        phone: document.getElementById('contactPhone').value,
        company: document.getElementById('contactCompany').value,
        city: document.getElementById('contactCity').value,
        type: document.getElementById('contactType').value,
        product: document.getElementById('contactProduct').value,
        productCode: document.getElementById('contactProductCode').value,
        message: document.getElementById('contactMessage').value,
        website: document.getElementById('contactWebsite').value
      });
      if (!result?.ok) throw new Error(result?.error || 'No se pudo enviar la solicitud.');
      toast(result.message || 'Solicitud enviada.', 'success');
      document.getElementById('contactForm').reset();
      document.getElementById('contactModal').classList.remove('is-open'); document.getElementById('contactBackdrop').classList.remove('is-open'); document.body.classList.remove('no-scroll');
    } catch (e) { error.textContent = e.message || String(e); error.classList.add('is-visible'); }
    finally { button.disabled = false; }
  }

  async function refreshStudioCatalog(forceRender) {
    if (!state.sessionToken) return;
    const result = await gasRun('getStudioCatalog', state.sessionToken, 45000);
    if (!result?.ok) throw new Error(result?.error || 'No se pudo cargar Studio.');
    state.isStudio = true;
    if (state.user) state.user.isStudio = true;
    state.studioProducts = Array.isArray(result.products) ? result.products : [];
    const activeMap = new Map(state.products.map(product => [String(product.code), product]));
    state.studioProducts.forEach(item => {
      const existing = activeMap.get(String(item.code));
      if (existing) Object.assign(existing, item, { canonicalName: item.displayName, description: item.originalName || item.displayName });
      else activeMap.set(String(item.code), normalizeProductRecord(Object.assign({
        canonicalName: item.displayName, description: item.originalName || item.displayName, unit: item.presentation,
        volume: item.presentation, pdpHighlights: [], pdpFacts: [], available: item.webStatus !== 'CONSULTAR' && Number(item.priceNet) > 0
      }, item)));
    });
    state.products = Array.from(activeMap.values());
    state.categories = Array.from(new Set(state.products.map(p => p.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'})).map(name => ({ name, count: state.products.filter(p => p.category === name).length }));
    state.brands = Array.from(new Set(state.products.map(p => p.brand).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
    renderCategories(); renderBrands(); syncStudioControls(); applyFilters();
    if (forceRender || document.getElementById('studioModal')?.classList.contains('is-open')) renderStudioProducts();
  }

  async function openStudio() {
    if (!state.sessionToken || !state.user) {
      toast('Inicia sesión para usar Studio.', 'error');
      return;
    }

    const workspace = mountStudioWorkspace();
    if (!workspace) {
      toast('No se pudo preparar el espacio Studio.', 'error');
      return;
    }

    if (!workspace.hidden) {
      workspace.hidden = true;
      document.getElementById('btnStudioHeader')?.setAttribute('aria-pressed', 'false');
      return;
    }

    try {
      const result = await gasRun('getStudioCatalog', state.sessionToken, 45000);
      if (!result || !result.ok) throw new Error((result && result.error) || 'Esta cuenta no tiene acceso a Studio.');

      state.isStudio = true;
      state.isAdmin = Boolean(state.user && state.user.isAdmin);
      if (state.user) {
        state.user.isStudio = true;
        state.user.role = state.user.role || (state.isAdmin ? 'ADMIN' : 'STUDIO');
      }
      state.studioProducts = Array.isArray(result.products) ? result.products : [];
      syncStudioControls();
      setStudioTab('products');
      renderStudioProducts();
      workspace.hidden = false;
      document.getElementById('btnStudioHeader')?.setAttribute('aria-pressed', 'true');
      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      toast(error.message || 'No se pudo abrir Studio.', 'error');
    }
  }

  function setStudioTab(tabName) {
    document.querySelectorAll('[data-studio-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.studioTab === tabName));
    document.querySelectorAll('[data-studio-panel]').forEach(panel => panel.hidden = panel.dataset.studioPanel !== tabName);
    if (tabName === 'banners') loadStudioBanners();
    if (tabName === 'documents') loadStudioOrders();
  }

  function renderStudioProducts() {
    const container = document.getElementById('studioProductList'); if (!container) return;
    const q = normalize(document.getElementById('studioSearch')?.value || '');
    const status = document.getElementById('studioStatus')?.value || 'TODOS';
    const rows = state.studioProducts.filter(item => {
      if (status !== 'TODOS' && item.webStatus !== status) return false;
      return !q || normalize([item.displayName,item.brand,item.category,item.specialty].join(' ')).includes(q);
    }).slice(0,250);
    container.innerHTML = rows.length ? rows.map(item => `<article class="studio-product-row ${item.isHidden ? 'is-hidden-product' : ''}">
      <label class="studio-select"><input type="checkbox" data-studio-select="${escapeAttr(item.code)}" ${state.studioSelected.has(String(item.code)) ? 'checked' : ''}><span></span></label>
      <div class="studio-product-thumb">${item.imageUrl ? `<img src="${escapeAttr(item.imageUrl)}" alt="">` : '<span>◇</span>'}</div>
      <div class="studio-product-copy"><strong>${escapeHtml(item.displayName)}</strong><span>${escapeHtml([item.brand,item.category,item.presentation].filter(Boolean).join(' · '))}</span></div>
      <span class="studio-row-status studio-row-status--${escapeAttr(item.webStatus.toLowerCase())}">${escapeHtml(item.webStatus.replace('_',' '))}</span>
      <button type="button" data-studio-edit-code="${escapeAttr(item.code)}">Editar</button>
    </article>`).join('') : '<div class="studio-empty">No hay productos con esos filtros.</div>';
    updateStudioSelection();
  }

  function updateStudioSelection() {
    const label = document.getElementById('studioSelectionCount'); if (label) label.textContent = `${state.studioSelected.size} seleccionados`;
  }

  async function setSelectedStudioStatus(status) {
    const codes = Array.from(state.studioSelected); if (!codes.length) { toast('Selecciona productos primero.','error'); return; }
    const result = await gasRunArgs('bulkSetProductStatus', [state.sessionToken, codes, status], 45000);
    if (!result?.ok) { toast(result?.error || 'No se pudo cambiar el estado.','error'); return; }
    state.studioSelected.clear(); toast(`${result.changed} productos actualizados.`, 'success'); await refreshStudioCatalog(true);
  }

  function findStudioProduct(code) { return state.studioProducts.find(item => String(item.code) === String(code)) || getProduct(code); }
  function openStudioEditor(code) {
    if (!state.isStudio) { toast('Esta sesión no tiene acceso a edición.', 'error'); return; }
    const item = findStudioProduct(code);
    if (!item) { toast('No encontramos la publicación para editar.', 'error'); return; }
    const values = {
      studioEditCode: item.code, studioEditName: item.displayName, studioEditBrand: item.brand, studioEditCategory: item.category,
      studioEditSpecialty: item.specialty, studioEditPresentation: item.presentation || item.volume, studioEditStatus: item.webStatus || 'ACTIVO',
      studioEditPrice: item.priceNet || '', studioEditCompare: item.priceCompare || '', studioEditSummary: item.pdpSummary || '',
      studioEditDescription: item.pdpDescription || '', studioEditProfile: item.pdpProfile || '', studioEditServing: item.pdpServing || '',
      studioEditPairing: item.pdpPairing || '', studioEditOrigin: item.origin || '', studioEditAlcohol: item.alcohol || '',
      studioEditFacts: item.pdpFactsJson || JSON.stringify(item.pdpFacts || [], null, 2), studioEditProcessedImage: item.processedImageUrl || ''
    };
    Object.keys(values).forEach(id => { const el=document.getElementById(id); if(el) el.value=values[id] ?? ''; });
    document.getElementById('studioEditorModal').classList.add('is-open'); document.getElementById('studioEditorBackdrop').classList.add('is-open'); document.body.classList.add('no-scroll');
  }

  async function saveStudioProduct(event) {
    event.preventDefault(); const error=document.getElementById('studioEditorError'); error.textContent='';
    const code=document.getElementById('studioEditCode').value;
    const patch={
      displayName:document.getElementById('studioEditName').value, brand:document.getElementById('studioEditBrand').value,
      category:document.getElementById('studioEditCategory').value, specialty:document.getElementById('studioEditSpecialty').value,
      presentation:document.getElementById('studioEditPresentation').value, webStatus:document.getElementById('studioEditStatus').value,
      priceNet:document.getElementById('studioEditPrice').value, priceCompare:document.getElementById('studioEditCompare').value,
      pdpSummary:document.getElementById('studioEditSummary').value, pdpDescription:document.getElementById('studioEditDescription').value,
      pdpProfile:document.getElementById('studioEditProfile').value, pdpServing:document.getElementById('studioEditServing').value,
      pdpPairing:document.getElementById('studioEditPairing').value, origin:document.getElementById('studioEditOrigin').value,
      alcohol:document.getElementById('studioEditAlcohol').value, pdpFactsJson:document.getElementById('studioEditFacts').value,
      processedImageUrl:document.getElementById('studioEditProcessedImage').value
    };
    const result=await gasRunArgs('updateProductFromStudio', [state.sessionToken, code, patch], 60000);
    if(!result?.ok){error.textContent=result?.error||'No se pudo guardar.';error.classList.add('is-visible');return;}
    toast('Publicación actualizada.','success'); document.getElementById('studioEditorModal').classList.remove('is-open'); document.getElementById('studioEditorBackdrop').classList.remove('is-open'); await loadStore({background:false}); await refreshStudioCatalog(true);
    if(state.detailProductCode===String(code)){closeProductDetail();setTimeout(()=>openProductDetail(code),150);}
  }

  async function loadStudioBanners() {
    const container=document.getElementById('studioBannerList'); if(!container)return; container.innerHTML='<div class="studio-empty">Cargando banners…</div>';
    const result=await gasRun('getStudioBanners',state.sessionToken); if(!result?.ok){container.innerHTML=`<div class="studio-empty">${escapeHtml(result?.error||'Error')}</div>`;return;}
    container.innerHTML=(result.banners||[]).map(item=>`<article class="studio-banner-editor" data-banner-row="${item.rowNumber}"><strong>Banner ${escapeHtml(item.Orden||String(item.rowNumber-1))}</strong><label>Kicker<input data-banner-field="kicker" value="${escapeAttr(item.Kicker||'')}"></label><label>Título<input data-banner-field="title" value="${escapeAttr(item['Título']||'')}"></label><label>Descripción<textarea data-banner-field="text" rows="3">${escapeHtml(item['Descripción']||'')}</textarea></label><label>Texto botón<input data-banner-field="ctaText" value="${escapeAttr(item['Texto botón']||'')}"></label><button type="button" data-banner-save="${item.rowNumber}">Guardar banner</button></article>`).join('');
  }

  async function saveStudioBanner(rowNumber) {
    const card=document.querySelector(`[data-banner-row="${rowNumber}"]`); if(!card)return;
    const patch={}; card.querySelectorAll('[data-banner-field]').forEach(input=>patch[input.dataset.bannerField]=input.value);
    const result=await gasRunArgs('updateBannerTextFromStudio', [state.sessionToken, rowNumber, patch], 45000); if(!result?.ok){toast(result?.error||'No se pudo guardar.','error');return;} toast('Banner actualizado.','success'); await loadStore({background:false});
  }

  async function loadStudioOrders() {
    const container=document.getElementById('studioOrderList'); if(!container)return; container.innerHTML='<div class="studio-empty">Cargando pedidos…</div>';
    const result=await gasRunArgs('getStudioOrders', [state.sessionToken, 40], 45000); if(!result?.ok){container.innerHTML=`<div class="studio-empty">${escapeHtml(result?.error||'Error')}</div>`;return;}
    container.innerHTML=(result.orders||[]).map(order=>`<article class="studio-order-row"><div><strong>${escapeHtml(order.Folio||'')}</strong><span>${escapeHtml(order.Nombre||'')} · ${escapeHtml(order.Fecha||'')}</span></div><strong>${escapeHtml(order.Total||'')}</strong><div class="studio-order-actions"><button type="button" data-generate-document="NOTA DE VENTA" data-folio="${escapeAttr(order.Folio||'')}">Nota</button><button type="button" data-generate-document="COTIZACIÓN" data-folio="${escapeAttr(order.Folio||'')}">Cotización</button><button type="button" data-generate-document="NOTA DE VENTA" data-send="true" data-folio="${escapeAttr(order.Folio||'')}">Enviar nota</button></div></article>`).join('')||'<div class="studio-empty">No hay pedidos.</div>';
  }

  async function generateStudioDocument(folio,type,send) {
    const result=await gasRunArgs('generarDocumentoVenta', [state.sessionToken, folio, type, Boolean(send)], 90000);
    if(!result?.ok){toast(result?.error||'No se pudo generar el documento.','error');return;} toast(send?'Documento enviado.':'Documento generado.','success'); if(result.fileUrl&&!send) window.open(result.fileUrl,'_blank','noopener');
  }

  const originalUpdateAuthUi = updateAuthUi;
  updateAuthUi = function () { originalUpdateAuthUi(); ensureOperationalUi(); syncStudioControls(); };

  onReady(function () {
    installDesignSignals();
    installFooter();
    ensureOperationalUi();
    syncStudioControls();
    installFilterFollower();
  });
})();



/* ============================================================
   PUZZLES · EXPERIENCIA Y MOVIMIENTO CONSOLIDADO
   Recorrido opcional, revelado progresivo y sistema de interacción.
   ============================================================ */
(function installPuzzlesExperienceLayer() {
  'use strict';

  const CELLAR_SCENES = [
    {
      image: 'https://drgnzzo.github.io/PUZZLES/assets/banner-01-editorial.png',
      kicker: 'EL UMBRAL',
      title: 'Entra a PUZZLES',
      text: 'Un recorrido breve por vinos, licores y destilados antes de abrir la colección.'
    },
    {
      image: 'https://drgnzzo.github.io/PUZZLES/assets/banner-02-botellas.png',
      kicker: 'LA CAVA',
      title: 'Vinos con intención',
      text: 'Selecciones para la mesa, el regalo y los momentos que merecen permanecer.'
    },
    {
      image: 'https://drgnzzo.github.io/PUZZLES/assets/banner-03-editorial.png',
      kicker: 'CELEBRAR',
      title: 'Burbujas y champagne',
      text: 'Formatos y etiquetas pensados para brindar, compartir y marcar una ocasión.'
    },
    {
      image: 'https://drgnzzo.github.io/PUZZLES/assets/banner-04-botellas.png',
      kicker: 'CARÁCTER',
      title: 'Destilados',
      text: 'Tequila, whisky, ron, ginebra, mezcal y otras expresiones reunidas con criterio.'
    },
    {
      image: 'https://drgnzzo.github.io/PUZZLES/assets/banner-05-editorial.png',
      kicker: 'DESCUBRIR',
      title: 'Una colección viva',
      text: 'La disponibilidad cambia. La selección se actualiza y cada solicitud se confirma personalmente.'
    },
    {
      image: 'https://drgnzzo.github.io/PUZZLES/assets/banner-06-botellas.png',
      kicker: 'PUZZLES',
      title: 'Abre el catálogo',
      text: 'Explora la colección completa, filtra por categoría o marca y guarda tus elecciones.'
    }
  ];

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function installCellarExperience() {
    if (document.getElementById('puzzlesCellar')) return;

    const hero = document.getElementById('heroCarousel') || document.querySelector('.hero-carousel');
    if (hero && !document.getElementById('btnOpenCellar')) {
      const launch = document.createElement('div');
      launch.className = 'puzzles-cellar-launch';
      launch.innerHTML = [
        '<button id="btnOpenCellar" class="puzzles-cellar-launch__button" type="button">',
        '<span>ENTRAR A LA CAVA</span>',
        '<small>Recorrido inmersivo opcional</small>',
        '</button>'
      ].join('');
      hero.insertAdjacentElement('afterend', launch);
    }

    const scenes = CELLAR_SCENES.map(function (scene, index) {
      const finalScene = index === CELLAR_SCENES.length - 1;
      return [
        '<article class="puzzles-cellar__scene" data-cellar-scene="', index, '" style="--cellar-image:url(\'', escapeText(scene.image), '\')">',
        '<div class="puzzles-cellar__media" aria-hidden="true"></div>',
        '<div class="puzzles-cellar__shade" aria-hidden="true"></div>',
        '<div class="puzzles-cellar__copy">',
        '<span class="puzzles-cellar__kicker">', escapeText(scene.kicker), '</span>',
        '<h2>', escapeText(scene.title), '</h2>',
        '<p>', escapeText(scene.text), '</p>',
        finalScene
          ? '<button class="puzzles-cellar__catalog-button" type="button" data-cellar-catalog>EXPLORAR CATÁLOGO</button>'
          : '<span class="puzzles-cellar__scroll-cue">Desliza para continuar</span>',
        '</div>',
        '</article>'
      ].join('');
    }).join('');

    document.body.insertAdjacentHTML('beforeend', [
      '<section id="puzzlesCellar" class="puzzles-cellar" aria-hidden="true">',
      '<header class="puzzles-cellar__topbar">',
      '<div><strong>PUZZLES</strong><span>VINOS · LICORES · DESTILADOS</span></div>',
      '<div class="puzzles-cellar__actions">',
      '<button type="button" data-cellar-catalog>Saltar recorrido</button>',
      '<button id="btnCloseCellar" type="button" aria-label="Cerrar recorrido">×</button>',
      '</div>',
      '</header>',
      '<div class="puzzles-cellar__progress" aria-hidden="true"><span></span></div>',
      '<div class="puzzles-cellar__viewport" tabindex="0">',
      scenes,
      '</div>',
      '<nav class="puzzles-cellar__dots" aria-label="Escenas del recorrido">',
      CELLAR_SCENES.map(function (_, index) {
        return '<button type="button" data-cellar-jump="' + index + '" aria-label="Ir a escena ' + (index + 1) + '"></button>';
      }).join(''),
      '</nav>',
      '</section>'
    ].join(''));

    const cellar = document.getElementById('puzzlesCellar');
    const viewport = cellar.querySelector('.puzzles-cellar__viewport');
    const progress = cellar.querySelector('.puzzles-cellar__progress span');
    const sceneNodes = Array.from(cellar.querySelectorAll('[data-cellar-scene]'));
    const dots = Array.from(cellar.querySelectorAll('[data-cellar-jump]'));
    let returnFocus = null;
    let scheduled = false;

    function update() {
      scheduled = false;
      const max = Math.max(1, viewport.scrollHeight - viewport.clientHeight);
      const ratio = Math.max(0, Math.min(1, viewport.scrollTop / max));
      progress.style.transform = 'scaleX(' + ratio + ')';

      let activeIndex = 0;
      let nearest = Infinity;
      sceneNodes.forEach(function (scene, index) {
        const rect = scene.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        const centerDistance = Math.abs((rect.top + rect.height / 2) - (viewportRect.top + viewportRect.height / 2));
        const visibility = Math.max(0, Math.min(1, 1 - centerDistance / Math.max(1, viewportRect.height)));
        const localProgress = Math.max(-1, Math.min(1, (viewportRect.top - rect.top) / Math.max(1, rect.height)));
        scene.style.setProperty('--cellar-visibility', visibility.toFixed(3));
        scene.style.setProperty('--cellar-shift', (localProgress * 44).toFixed(2) + 'px');
        scene.style.setProperty('--cellar-progress', localProgress.toFixed(3));
        scene.classList.toggle('is-active', visibility > 0.56);
        if (centerDistance < nearest) {
          nearest = centerDistance;
          activeIndex = index;
        }
      });
      dots.forEach(function (dot, index) {
        dot.classList.toggle('is-active', index === activeIndex);
        dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      });
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    }

    function openCellar(trigger) {
      returnFocus = trigger || document.activeElement;
      cellar.classList.add('is-open');
      cellar.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll', 'cellar-is-open');
      viewport.scrollTop = 0;
      window.setTimeout(function () {
        viewport.focus({ preventScroll: true });
        update();
      }, 40);
    }

    function closeCellar(goCatalog) {
      cellar.classList.remove('is-open');
      cellar.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll', 'cellar-is-open');
      if (goCatalog) {
        const catalog = document.getElementById('catalogo');
        if (catalog) {
          window.setTimeout(function () {
            catalog.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
          }, 80);
        }
      } else if (returnFocus && typeof returnFocus.focus === 'function') {
        returnFocus.focus({ preventScroll: true });
      }
    }

    document.getElementById('btnOpenCellar')?.addEventListener('click', function (event) {
      openCellar(event.currentTarget);
    });
    document.getElementById('btnCloseCellar')?.addEventListener('click', function () {
      closeCellar(false);
    });
    cellar.querySelectorAll('[data-cellar-catalog]').forEach(function (button) {
      button.addEventListener('click', function () { closeCellar(true); });
    });
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        const index = Number(dot.dataset.cellarJump || 0);
        sceneNodes[index]?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      });
    });
    viewport.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && cellar.classList.contains('is-open')) {
        event.stopPropagation();
        closeCellar(false);
      }
    }, true);
    update();
  }

  function installRevealSystem() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const selectors = [
      '.feature-card',
      '.product-card',
      '.mobile-list-card',
      '.catalog-toolbar',
      '.catalog-meta',
      '.footer__column',
      '.studio-workspace',
      '.pdp-section'
    ];

    function mark(root) {
      selectors.forEach(function (selector) {
        const nodes = [];
        if (root && root.matches && root.matches(selector)) nodes.push(root);
        if (root && root.querySelectorAll) nodes.push.apply(nodes, root.querySelectorAll(selector));
        nodes.forEach(function (node, index) {
          if (node.dataset.puzzlesReveal === 'true') return;
          node.dataset.puzzlesReveal = 'true';
          node.style.setProperty('--reveal-index', String(index % 8));
          if (reduceMotion) node.classList.add('is-revealed');
          else revealObserver.observe(node);
        });
      });
    }

    const revealObserver = reduceMotion || !('IntersectionObserver' in window)
      ? { observe: function (node) { node.classList.add('is-revealed'); } }
      : new IntersectionObserver(function (entries, observer) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    mark(document);
    const mutationObserver = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) mark(node);
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function installLegalInformation() {
    if (document.getElementById('puzzlesLegalModal')) return;
    const legalColumn = document.querySelector('.footer__legal-column');
    if (legalColumn) {
      legalColumn.innerHTML = [
        '<h4>Información</h4>',
        '<ul class="footer__policy-list">',
        '<li><button type="button" data-legal-topic="responsible">Compra responsable</button></li>',
        '<li><button type="button" data-legal-topic="privacy">Aviso de privacidad</button></li>',
        '<li><button type="button" data-legal-topic="terms">Términos comerciales</button></li>',
        '<li>Venta exclusiva para mayores de 18 años</li>',
        '</ul>'
      ].join('');
    }

    document.body.insertAdjacentHTML('beforeend', [
      '<div id="puzzlesLegalBackdrop" class="backdrop puzzles-legal-backdrop"></div>',
      '<section id="puzzlesLegalModal" class="modal puzzles-legal-modal" role="dialog" aria-modal="true" aria-labelledby="puzzlesLegalTitle">',
      '<div class="modal__card puzzles-legal-card">',
      '<div class="modal__head"><div><span class="operational-kicker">PUZZLES</span><h2 id="puzzlesLegalTitle">Información</h2></div><button id="btnClosePuzzlesLegal" class="modal-close" type="button" aria-label="Cerrar">×</button></div>',
      '<div id="puzzlesLegalBody" class="modal__body puzzles-legal-body"></div>',
      '</div></section>'
    ].join(''));

    const copy = {
      responsible: {
        title: 'Compra responsable',
        body: '<p>La venta de bebidas alcohólicas es exclusiva para mayores de 18 años. PUZZLES puede solicitar confirmación de edad y rechazar una solicitud cuando no sea posible verificarla.</p><p>Disfruta con responsabilidad. Evita el exceso y no conduzcas después de consumir alcohol.</p>'
      },
      privacy: {
        title: 'Aviso de privacidad',
        body: '<p>Los datos proporcionados en formularios, registro, pedidos y solicitudes se utilizan únicamente para atender la operación comercial, dar seguimiento y entregar información solicitada.</p><p>Los datos de contacto internos de PUZZLES no se publican. La información del cliente no se muestra públicamente ni se utiliza para fines ajenos a la solicitud registrada.</p>'
      },
      terms: {
        title: 'Términos comerciales',
        body: '<p>Los precios, promociones, imágenes y disponibilidad están sujetos a confirmación antes de cerrar el pedido. Una solicitud enviada desde la tienda no representa por sí sola una venta confirmada.</p><p>Las notas de venta y cotizaciones son documentos comerciales y no sustituyen un comprobante fiscal CFDI.</p>'
      }
    };

    const modal = document.getElementById('puzzlesLegalModal');
    const backdrop = document.getElementById('puzzlesLegalBackdrop');
    const title = document.getElementById('puzzlesLegalTitle');
    const body = document.getElementById('puzzlesLegalBody');
    let returnFocus = null;

    function open(topic, trigger) {
      const item = copy[topic] || copy.terms;
      returnFocus = trigger || document.activeElement;
      title.textContent = item.title;
      body.innerHTML = item.body;
      modal.classList.add('is-open');
      backdrop.classList.add('is-open');
      document.body.classList.add('no-scroll');
      window.setTimeout(function () { document.getElementById('btnClosePuzzlesLegal')?.focus(); }, 30);
    }

    function close() {
      modal.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      if (!document.querySelector('.modal.is-open, .cart-drawer.is-open, .puzzles-cellar.is-open')) {
        document.body.classList.remove('no-scroll');
      }
      if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
    }

    document.addEventListener('click', function (event) {
      const trigger = event.target.closest('[data-legal-topic]');
      if (!trigger) return;
      open(trigger.dataset.legalTopic, trigger);
    });
    document.getElementById('btnClosePuzzlesLegal')?.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) close();
    });
  }

  function installPaginationMotion() {
    document.addEventListener('click', function (event) {
      const pageButton = event.target.closest('.pagination [data-page]');
      if (!pageButton) return;
      [document.getElementById('gridView'), document.getElementById('tableView')]
        .filter(Boolean)
        .forEach(function (view) {
          view.classList.add('is-page-transitioning');
          window.setTimeout(function () { view.classList.remove('is-page-transitioning'); }, 260);
        });
    }, true);
  }

  function enforceCurrentInterfaceRules() {
    if (typeof state !== 'undefined') state.pageSize = 25;
    document.documentElement.classList.add('puzzles-experience-ready');
    document.body.classList.add('puzzles-experience-ready');
    document.querySelectorAll('[data-public-sku], .public-sku, .product-code-visible, .product-upc-visible').forEach(function (node) {
      node.remove();
    });
  }

  ready(function () {
    enforceCurrentInterfaceRules();
    installCellarExperience();
    installRevealSystem();
    installLegalInformation();
    installPaginationMotion();
  });
})();


/* ============================================================
   PUZZLES · CIERRE DE FRONTEND PRE-MEDUSA
   Accesibilidad, rendimiento perceptual, metadatos y profundidad.
   Esta capa estabiliza la tienda actual sin cambiar su backend.
   ============================================================ */
(function installPuzzlesFinalFrontendPass() {
  'use strict';

  const ROOT_TITLE = 'PUZZLES · Vinos, licores y destilados';
  const ROOT_DESCRIPTION = 'Descubre vinos, licores y destilados seleccionados por PUZZLES. Precios y disponibilidad sujetos a confirmación.';
  const FOCUSABLE_SELECTOR = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[contenteditable="true"]:not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const layerFocusMemory = new WeakMap();
  let previousOpenLayers = [];
  let layerSyncScheduled = false;
  let metadataScheduled = false;

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function isRendered(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function isLayerOpen(layer) {
    if (!layer || !isRendered(layer)) return false;
    if (layer.id === 'ageGate') return !layer.classList.contains('hidden');
    if (layer.id === 'filtersPanel') {
      return window.matchMedia('(max-width: 960px)').matches && layer.classList.contains('is-open');
    }
    return layer.classList.contains('is-open');
  }

  function layerZIndex(layer) {
    const value = Number.parseInt(window.getComputedStyle(layer).zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  }

  function getOpenLayers() {
    const candidates = Array.from(document.querySelectorAll([
      '#ageGate',
      '#puzzlesCellar',
      '.image-zoom-modal',
      '.modal',
      '.drawer',
      '#filtersPanel'
    ].join(','))).filter(isLayerOpen);

    return candidates.sort(function (first, second) {
      const zDifference = layerZIndex(first) - layerZIndex(second);
      if (zDifference) return zDifference;
      return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  function getFocusable(layer) {
    return Array.from(layer.querySelectorAll(FOCUSABLE_SELECTOR)).filter(function (element) {
      if (!isRendered(element)) return false;
      if (element.closest('[hidden], [aria-hidden="true"]')) return false;
      return element.getClientRects().length > 0;
    });
  }

  function focusLayer(layer) {
    if (!layer || !isLayerOpen(layer) || layer.contains(document.activeElement)) return;
    const preferred = layer.querySelector([
      '[data-autofocus]',
      '.modal-close',
      '#btnCloseCellar',
      '#btnCloseCart',
      'input:not([type="hidden"])',
      'button:not([disabled])'
    ].join(','));
    const target = preferred || getFocusable(layer)[0] || layer;
    if (!target.hasAttribute('tabindex') && target === layer) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); }
    catch (_) { try { target.focus(); } catch (_) {} }
  }

  function restoreLayerFocus(layer) {
    const trigger = layerFocusMemory.get(layer);
    layerFocusMemory.delete(layer);
    if (!trigger || !trigger.isConnected || typeof trigger.focus !== 'function') return;
    window.setTimeout(function () {
      if (getOpenLayers().length) return;
      try { trigger.focus({ preventScroll: true }); }
      catch (_) { try { trigger.focus(); } catch (_) {} }
    }, 30);
  }

  function syncOpenLayers() {
    layerSyncScheduled = false;
    const openLayers = getOpenLayers();

    openLayers.forEach(function (layer) {
      if (layer.getAttribute('aria-hidden') !== 'false') layer.setAttribute('aria-hidden', 'false');
      if (layer.classList.contains('drawer') || layer.id === 'puzzlesCellar') {
        layer.setAttribute('role', 'dialog');
        layer.setAttribute('aria-modal', 'true');
      }
      if (!previousOpenLayers.includes(layer)) {
        const trigger = document.activeElement && !layer.contains(document.activeElement)
          ? document.activeElement
          : null;
        if (trigger) layerFocusMemory.set(layer, trigger);
        window.setTimeout(function () { focusLayer(layer); }, 36);
      }
    });

    previousOpenLayers.forEach(function (layer) {
      if (openLayers.includes(layer)) return;
      if (layer.getAttribute('aria-hidden') !== 'true') layer.setAttribute('aria-hidden', 'true');
      restoreLayerFocus(layer);
    });

    document.body.classList.toggle('no-scroll', openLayers.length > 0);
    previousOpenLayers = openLayers;
  }

  function scheduleLayerSync() {
    if (layerSyncScheduled) return;
    layerSyncScheduled = true;
    window.requestAnimationFrame(syncOpenLayers);
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const layers = getOpenLayers();
    const layer = layers[layers.length - 1];
    if (!layer) return;
    const focusable = getFocusable(layer);
    if (!focusable.length) {
      event.preventDefault();
      focusLayer(layer);
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!layer.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function installAccessibleLayerManager() {
    document.addEventListener('keydown', trapFocus, true);
    const observer = new MutationObserver(scheduleLayerSync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden']
    });
    window.addEventListener('resize', scheduleLayerSync, { passive: true });
    scheduleLayerSync();
  }

  function installLiveAnnouncements() {
    let region = document.getElementById('puzzlesA11yStatus');
    if (!region) {
      region = document.createElement('div');
      region.id = 'puzzlesA11yStatus';
      region.className = 'puzzles-sr-only';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
    }

    const toastStack = document.getElementById('toastStack');
    if (!toastStack) return;
    toastStack.setAttribute('role', 'status');
    toastStack.setAttribute('aria-live', 'polite');
    toastStack.setAttribute('aria-atomic', 'false');

    const observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          const message = String(node.textContent || '').trim();
          if (!message) return;
          region.textContent = '';
          window.setTimeout(function () { region.textContent = message; }, 20);
        });
      });
    });
    observer.observe(toastStack, { childList: true });
  }

  function setupStudioTabs(root) {
    if (!root || root.dataset.a11yTabsReady === 'true') return;
    const tabs = Array.from(root.querySelectorAll('[data-studio-tab]'));
    const scope = root.closest('#studioWorkspace, #studioModal') || document;
    const panels = Array.from(scope.querySelectorAll('[data-studio-panel]'));
    if (!tabs.length || !panels.length) return;
    root.dataset.a11yTabsReady = 'true';
    root.setAttribute('role', 'tablist');
    root.setAttribute('aria-label', 'Secciones de PUZZLES Studio');

    function sync() {
      tabs.forEach(function (tab, index) {
        const key = tab.dataset.studioTab;
        const panel = panels.find(function (item) { return item.dataset.studioPanel === key; });
        const active = tab.classList.contains('is-active') && panel && !panel.hidden;
        const tabId = 'studioTab-' + key;
        const panelId = 'studioPanel-' + key;
        tab.id = tabId;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.setAttribute('aria-controls', panelId);
        tab.tabIndex = active ? 0 : -1;
        if (panel) {
          panel.id = panelId;
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', tabId);
          panel.tabIndex = 0;
        }
      });
    }

    root.addEventListener('click', function () { window.setTimeout(sync, 0); });
    root.addEventListener('keydown', function (event) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      let next = current;
      if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      tabs[next].click();
      tabs[next].focus();
      window.setTimeout(sync, 0);
    });
    sync();
  }

  function installTabSemantics() {
    document.querySelectorAll('.studio-tabs').forEach(setupStudioTabs);
    const observer = new MutationObserver(function () {
      document.querySelectorAll('.studio-tabs').forEach(setupStudioTabs);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setAutocomplete(id, value, inputMode) {
    const field = document.getElementById(id);
    if (!field) return;
    field.setAttribute('autocomplete', value);
    if (inputMode) field.setAttribute('inputmode', inputMode);
  }

  function installFormSemantics() {
    const fields = {
      customerName: ['name'], customerEmail: ['email'], customerPhone: ['tel', 'tel'],
      customerStreet: ['street-address'], customerExterior: ['address-line2'], customerInterior: ['address-line2'],
      customerNeighborhood: ['address-level3'], customerPostalCode: ['postal-code', 'numeric'],
      customerCity: ['address-level2'], customerState: ['address-level1'],
      contactName: ['name'], contactEmail: ['email'], contactPhone: ['tel', 'tel'],
      contactCompany: ['organization'], contactCity: ['address-level2'],
      loginEmail: ['username'], loginPassword: ['current-password'],
      registerName: ['name'], registerEmail: ['email'], registerPassword: ['new-password']
    };
    Object.keys(fields).forEach(function (id) {
      setAutocomplete(id, fields[id][0], fields[id][1]);
    });

    const checkoutError = document.getElementById('checkoutError');
    const contactError = document.getElementById('contactError');
    if (checkoutError) checkoutError.setAttribute('role', 'alert');
    if (contactError) contactError.setAttribute('role', 'alert');
  }

  function tuneImage(image) {
    if (!image || image.dataset.puzzlesImageTuned === 'true') return;
    image.dataset.puzzlesImageTuned = 'true';
    image.decoding = 'async';

    const isLogo = image.matches('.age-gate__logo, .entry-splash__logo, .site-header__logo, .footer__logo');
    const isFirstHero = image.matches('.hero-slide:first-child .hero-slide__artwork');
    const isZoom = image.id === 'zoomedProductImage';
    if (isLogo || isFirstHero || isZoom) image.loading = 'eager';
    else image.loading = 'lazy';
    if (isFirstHero) image.fetchPriority = 'high';

    if (image.matches('.product-image, .pdp-image, .product-card img, .mobile-list-card img')) {
      image.setAttribute('sizes', '(max-width: 760px) 42vw, (max-width: 1200px) 25vw, 280px');
    }

    const holder = image.closest('.product-card__visual, .mobile-list-card__visual, .pdp-image-button, .product-table__thumb, .hero-slide');
    if (holder) holder.classList.add('puzzles-image-loading');

    function finish() {
      image.classList.add('puzzles-image-loaded');
      if (holder) holder.classList.remove('puzzles-image-loading');
    }
    if (image.complete && image.naturalWidth > 0) finish();
    else {
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', function () {
        if (holder) holder.classList.remove('puzzles-image-loading');
      }, { once: true });
    }
  }

  function preloadFirstHero() {
    const image = document.querySelector('.hero-slide:first-child .hero-slide__artwork');
    if (!image || !image.currentSrc && !image.src) return;
    const href = image.currentSrc || image.src;
    if (document.querySelector('link[data-puzzles-hero-preload]')) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    link.dataset.puzzlesHeroPreload = 'true';
    document.head.appendChild(link);
  }

  function tuneAllImages(root) {
    if (root && root.matches && root.matches('img')) tuneImage(root);
    if (root && root.querySelectorAll) root.querySelectorAll('img').forEach(tuneImage);
    preloadFirstHero();
  }

  function installImagePerformance() {
    tuneAllImages(document);
    const observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) tuneAllImages(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function buildSkeletonMarkup() {
    return '<div class="puzzles-skeleton-grid" aria-hidden="true">' +
      Array.from({ length: 10 }).map(function () {
        return '<article class="puzzles-skeleton-card"><span></span><i></i><b></b><em></em></article>';
      }).join('') + '</div>';
  }

  function installCatalogSkeletons() {
    const loading = document.getElementById('loadingState');
    const grid = document.getElementById('gridView');
    if (!loading || !grid) return;

    function sync() {
      const active = !loading.classList.contains('hidden') && !state.hasStoreSnapshot;
      let skeleton = grid.querySelector('.puzzles-skeleton-grid');
      if (active && !skeleton && !grid.querySelector('.product-card')) {
        grid.insertAdjacentHTML('afterbegin', buildSkeletonMarkup());
        grid.classList.add('is-skeleton-loading');
      } else if (!active && skeleton) {
        skeleton.remove();
        grid.classList.remove('is-skeleton-loading');
      }
    }

    const observer = new MutationObserver(sync);
    observer.observe(loading, { attributes: true, attributeFilter: ['class'] });
    observer.observe(grid, { childList: true });
    sync();
  }

  function ensureMeta(selector, attributes) {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      Object.keys(attributes).forEach(function (key) { element.setAttribute(key, attributes[key]); });
      document.head.appendChild(element);
    }
    return element;
  }

  function productDescription(product) {
    const source = String(product.pdpSummary || product.pdpDescription || product.description || '').replace(/\s+/g, ' ').trim();
    const fallback = [product.category, product.brand, product.specialty].filter(Boolean).join(' · ');
    const text = source || fallback || ROOT_DESCRIPTION;
    return text.length > 158 ? text.slice(0, 155).trimEnd() + '…' : text;
  }

  function currentDetailProduct() {
    if (typeof state === 'undefined' || !state.detailProductCode || !Array.isArray(state.products)) return null;
    return state.products.find(function (product) {
      return String(product.code) === String(state.detailProductCode);
    }) || null;
  }

  function emitMetaToParent(title, description) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'PUZZLES_META',
          title: title,
          description: description
        }, '*');
      }
    } catch (_) {}
  }

  function updateProductMetadata() {
    metadataScheduled = false;
    const modal = document.getElementById('productDetailModal');
    const product = modal && modal.classList.contains('is-open') ? currentDetailProduct() : null;
    const descriptionMeta = ensureMeta('meta[name="description"]', { name: 'description' });
    const robotsMeta = ensureMeta('meta[name="robots"]', { name: 'robots', content: 'index,follow,max-image-preview:large' });
    robotsMeta.content = 'index,follow,max-image-preview:large';

    const schemaId = 'puzzlesProductSchema';
    const existingSchema = document.getElementById(schemaId);
    if (existingSchema) existingSchema.remove();

    if (!product) {
      document.title = ROOT_TITLE;
      descriptionMeta.content = ROOT_DESCRIPTION;
      emitMetaToParent(ROOT_TITLE, ROOT_DESCRIPTION);
      return;
    }

    const title = String(product.displayName || product.description || 'Producto') + ' · PUZZLES';
    const description = productDescription(product);
    document.title = title;
    descriptionMeta.content = description;
    emitMetaToParent(title, description);

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: String(product.displayName || product.description || ''),
      description: description,
      category: String(product.category || ''),
      image: product.imageDisplayUrl || product.imageUrl || undefined,
      brand: product.brand ? { '@type': 'Brand', name: String(product.brand) } : undefined
    };
    const price = Number(product.priceNet || 0);
    if (product.available && Number.isFinite(price) && price > 0) {
      schema.offers = {
        '@type': 'Offer',
        priceCurrency: String(state.store && state.store.currency || 'MXN'),
        price: price.toFixed(2),
        availability: 'https://schema.org/InStock',
        url: 'https://drgnzzo.github.io/PUZZLES/'
      };
    }
    Object.keys(schema).forEach(function (key) { if (schema[key] === undefined) delete schema[key]; });
    const script = document.createElement('script');
    script.id = schemaId;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  function scheduleMetadata() {
    if (metadataScheduled) return;
    metadataScheduled = true;
    window.requestAnimationFrame(updateProductMetadata);
  }

  function installMetadataBridge() {
    ensureMeta('meta[name="description"]', { name: 'description', content: ROOT_DESCRIPTION });
    const modal = document.getElementById('productDetailModal');
    if (modal) {
      const observer = new MutationObserver(scheduleMetadata);
      observer.observe(modal, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    }
    scheduleMetadata();
  }

  function enhanceCellarDepth() {
    const cellar = document.getElementById('puzzlesCellar');
    if (!cellar || cellar.dataset.finalDepthReady === 'true') return;
    cellar.dataset.finalDepthReady = 'true';
    cellar.setAttribute('role', 'dialog');
    cellar.setAttribute('aria-modal', 'true');
    cellar.setAttribute('aria-label', 'Recorrido inmersivo por la cava PUZZLES');

    const collections = [
      null,
      { label: 'EXPLORAR VINOS', terms: ['vino', 'tinto', 'blanco', 'rosado'] },
      { label: 'VER CHAMPAGNE', terms: ['champagne', 'espumoso', 'prosecco', 'cava'] },
      { label: 'VER DESTILADOS', terms: ['tequila', 'whisky', 'mezcal', 'ron', 'ginebra', 'vodka', 'brandy', 'cognac'] }
    ];

    cellar.querySelectorAll('[data-cellar-scene]').forEach(function (scene, index) {
      if (!scene.querySelector('.puzzles-cellar__architecture')) {
        scene.insertAdjacentHTML('afterbegin', [
          '<div class="puzzles-cellar__architecture" aria-hidden="true">',
          '<span class="puzzles-cellar__light-beam"></span>',
          '<span class="puzzles-cellar__shelf puzzles-cellar__shelf--back"></span>',
          '<span class="puzzles-cellar__bottles puzzles-cellar__bottles--back"></span>',
          '<span class="puzzles-cellar__shelf puzzles-cellar__shelf--front"></span>',
          '<span class="puzzles-cellar__bottles puzzles-cellar__bottles--front"></span>',
          '<span class="puzzles-cellar__haze"></span>',
          '</div>'
        ].join(''));
      }
      const collection = collections[index];
      const copy = scene.querySelector('.puzzles-cellar__copy');
      if (collection && copy && !copy.querySelector('[data-cellar-collection]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'puzzles-cellar__collection-button';
        button.dataset.cellarCollection = collection.terms.join('|');
        button.textContent = collection.label;
        copy.appendChild(button);
      }
    });

    function normalizeText(value) {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    cellar.addEventListener('click', function (event) {
      const button = event.target.closest('[data-cellar-collection]');
      if (!button) return;
      const terms = String(button.dataset.cellarCollection || '').split('|').filter(Boolean);
      const categories = Array.isArray(state.categories) ? state.categories.filter(function (category) {
        const normalized = normalizeText(category);
        return terms.some(function (term) { return normalized.includes(normalizeText(term)); });
      }) : [];

      state.category = 'Todas';
      state.brand = 'Todas';
      state.page = 1;
      state.editorialIntent = categories.length ? { key: 'cellar-selection', categories: categories, sort: 'featured' } : null;
      state.search = categories.length ? '' : (terms[0] || '');
      if (dom.searchInput) dom.searchInput.value = state.search;
      if (dom.brandFilter) dom.brandFilter.value = 'Todas';
      if (typeof renderCategories === 'function') renderCategories();
      if (typeof renderBrands === 'function') renderBrands();
      if (typeof applyFilters === 'function') applyFilters();
      const skip = cellar.querySelector('[data-cellar-catalog]');
      if (skip) skip.click();
    });
  }

  function installMotionDiscipline() {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    function sync() {
      document.documentElement.classList.toggle('puzzles-reduced-motion', motionQuery.matches);
    }
    sync();
    if (typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', sync);
    else if (typeof motionQuery.addListener === 'function') motionQuery.addListener(sync);
  }

  function installEditorialDetails() {
    const detailModal = document.getElementById('productDetailModal');
    if (detailModal) detailModal.setAttribute('aria-hidden', detailModal.classList.contains('is-open') ? 'false' : 'true');
    const cart = document.getElementById('cartDrawer');
    if (cart) {
      cart.setAttribute('role', 'dialog');
      cart.setAttribute('aria-modal', 'true');
    }
    document.querySelectorAll('button, a, input, select, textarea').forEach(function (element) {
      if (!element.hasAttribute('data-puzzles-interactive')) element.setAttribute('data-puzzles-interactive', 'true');
    });
  }

  ready(function () {
    document.documentElement.classList.add('puzzles-final-pass');
    document.body.classList.add('puzzles-final-pass');
    installMotionDiscipline();
    installAccessibleLayerManager();
    installLiveAnnouncements();
    installTabSemantics();
    installFormSemantics();
    installImagePerformance();
    installCatalogSkeletons();
    installMetadataBridge();
    enhanceCellarDepth();
    installEditorialDetails();
  });
})();
