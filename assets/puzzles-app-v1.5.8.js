'use strict';

    /**
     * Para GitHub Pages:
     * 1) Implementa Code.gs como Aplicación web.
     * 2) Pega aquí la URL que termina en /exec.
     *
     * Dentro de Apps Script no necesitas modificar esta constante porque se usa
     * google.script.run automáticamente.
     */
    const GITHUB_GAS_URL = '';
    const PUZZLES_OFFICIAL_LOGO_URL = 'https://drgnzzo.github.io/PUZZLES/assets/puzzles_logo.png?v=1.5.8-ui-hotfix-1';
    const PUZZLES_OFFICIAL_MARK_URL = 'https://drgnzzo.github.io/PUZZLES/assets/puzzles_logo_mark.png?v=1.5.8-ui-hotfix-1';

    const STORAGE_KEYS = Object.freeze({
      CART: 'puzzles_cart_v3',
      AGE: 'puzzles_age_confirmed_v1',
      CUSTOMER: 'puzzles_customer_v2',
      VIEW: 'puzzles_catalog_view_v1',
      SESSION: 'puzzles_session_v1',
      STORE: 'puzzles_store_snapshot_v1_5_8_momentos'
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
      pageSize: 60,
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
      adminPrices: {},
      detailProductCode: '',
      detailQuantity: 1,
      initialLoadPromise: null,
      initialLoadComplete: false,
      entrySplashActive: false,
      intentWelcomeShown: false
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

    async function init() {
      puzzlesStorageRemove('puzzles_cart_v1');
      puzzlesStorageRemove('puzzles_cart_v2');

      repairEntryStructure();
      cleanupLegacyBrandArtifacts();
      cacheDom();

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
        'addressGroup','customerAddress','customerNotes','website','checkoutAge',
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
        document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => dom.searchInput.focus(), 500);
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
        dom.resultRange.textContent = '';
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

      state.products = Array.isArray(result.products)
        ? result.products.map(normalizeProductRecord)
        : [];

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
      document.title = state.store.name + ' · Vinos y licores';
      dom.brandName.textContent = state.store.name;
      dom.brandSubtitle.textContent = state.store.subtitle;
      applyBrandLogos();
      dom.announcementText.textContent = state.store.priceNotice;
      dom.footerText.textContent = state.store.footerText;
      const features = Array.isArray(state.store.features) ? state.store.features : [];
      dom.feature1Title.textContent = (features[0] && features[0].title) || 'MOMENTOS CON INTENCIÓN';
      dom.featureCatalogText.textContent = (features[0] && features[0].text) || 'Selecciones para celebrar, compartir, regalar, descubrir o completar tu cava.';
      dom.feature2Title.textContent = (features[1] && features[1].title) || 'ELECCIONES MÁS CLARAS';
      dom.feature2Text.textContent = (features[1] && features[1].text) || 'Compara categoría, marca, contenido y precio sin perder de vista la ocasión.';
      dom.feature3Title.textContent = (features[2] && features[2].title) || 'TU SELECCIÓN, A TU RITMO';
      dom.feature3Text.textContent = (features[2] && features[2].text) || 'Guarda lo que te interesa y continúa armando el momento cuando estés listo.';
      dom.catalogKicker.textContent = state.store.catalogKicker || 'LA COLECCIÓN COMPLETA';
      dom.catalogTitle.textContent = state.store.catalogTitle || 'Cuando ya sabes qué pieza estás buscando';
      dom.catalogDescription.textContent = state.store.catalogText || 'Filtra la colección y encuentra la opción que encaja con el momento.';
      [dom.btnHeaderWhatsApp, dom.btnFooterWhatsApp].forEach(button => {
        button.style.display = state.store.whatsapp ? '' : 'none';
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
      const banners =
        Array.isArray(state.store.banners)
          ? state.store.banners
          : [];

      if (!banners.length) {
        dom.heroSlides.innerHTML = '';
        dom.heroDots.innerHTML = '';
        return;
      }

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
        dom.resultCount.textContent = '0 resultados';
        dom.resultRange.textContent = '';
        renderActiveFilter();
        return;
      }

      const start = (state.page - 1) * state.pageSize;
      const end = Math.min(start + state.pageSize, state.filtered.length);
      const pageProducts = state.filtered.slice(start, end);

      dom.resultCount.textContent = state.filtered.length.toLocaleString('es-MX') + (state.filtered.length === 1 ? ' resultado' : ' resultados');
      dom.resultRange.textContent = '· Mostrando ' + (start + 1).toLocaleString('es-MX') + '–' + end.toLocaleString('es-MX');
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
            <article class="product-card" data-code="${escapeAttr(product.code)}">
              <button class="product-card__visual product-open-button" data-darkreader-lock style="background-color:#fff!important;color-scheme:light!important;forced-color-adjust:none!important" type="button" data-product-detail="${escapeAttr(product.code)}" aria-label="Ver información de ${escapeAttr(product.displayName)}">
                <div class="product-image-fallback" data-darkreader-lock style="background-color:#fff!important;color-scheme:light!important;forced-color-adjust:none!important" aria-hidden="true">
                  <span>${escapeHtml(categoryLetter(product.category))}</span>
                </div>
                ${productImageMarkup(product, 'product-card__image', product.displayName)}
                <span class="product-card__category">${escapeHtml(product.category)}</span>
              </button>

              <div class="product-card__body">
                <div class="product-card__code">
                  CÓDIGO ${escapeHtml(product.code)}
                  ${product.upc ? ` · UPC ${escapeHtml(product.upc)}` : ''}
                </div>

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
      const sortableHeader = (label, key) => `
        <button class="table-sort-button" type="button" data-table-sort="${escapeAttr(key)}">
          <span>${escapeHtml(label)}</span>
          <span class="table-sort-indicator">${tableSortIndicator(key)}</span>
        </button>`;

      const adminHeader = state.isAdmin
        ? '<th>Precio ADMIN</th>'
        : '';

      dom.tableView.innerHTML = `
        <table class="product-table">
          <thead>
            <tr>
              <th>${sortableHeader('Producto', 'name')}</th>
              <th>${sortableHeader('Contenido', 'volume')}</th>
              <th>${sortableHeader('Marca', 'brand')}</th>
              <th>${sortableHeader('Categoría', 'category')}</th>
              <th>${sortableHeader('Precio', 'price')}</th>
              <th>Antes</th>
              ${adminHeader}
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(product => {
              const canBuy = Boolean(
                product.available &&
                toFiniteNumber(product.priceNet) > 0
              );
              const compare = toFiniteNumber(product.priceCompare);
              const sale = toFiniteNumber(product.priceNet);
              const adminCost = getAdminCost(product.code);

              return `
                <tr>
                  <td class="product-table__product">
                    <button class="product-table__product-wrap product-row-button" type="button" data-product-detail="${escapeAttr(product.code)}">
                      <span class="product-table__thumb" data-darkreader-lock style="background-color:#fff!important;color-scheme:light!important;forced-color-adjust:none!important">
                        <span class="product-image-fallback" data-darkreader-lock style="background-color:#fff!important;color-scheme:light!important;forced-color-adjust:none!important" aria-hidden="true">
                          <span>${escapeHtml(categoryLetter(product.category))}</span>
                        </span>
                        ${productImageMarkup(product, 'product-table__image', product.displayName)}
                      </span>
                      <span>
                        <strong>${escapeHtml(product.displayName)}</strong>
                        <small>Código ${escapeHtml(product.code)}${product.upc ? ` · UPC ${escapeHtml(product.upc)}` : ''}</small>
                      </span>
                    </button>
                  </td>
                  <td>${escapeHtml(product.volume || '—')}</td>
                  <td>${escapeHtml(product.brand || '—')}</td>
                  <td><span class="table-category">${escapeHtml(product.category)}</span></td>
                  <td class="product-table__price">${canBuy ? money(sale) : 'Consultar'}</td>
                  <td>${compare > sale ? `<span class="price-compare">${money(compare)}</span>` : '—'}</td>
                  ${state.isAdmin ? `<td>${renderAdminPrice(adminCost, true)}</td>` : ''}
                  <td>
                    <button class="table-add" type="button" data-add-one="${escapeAttr(product.code)}" ${canBuy ? '' : 'disabled'}>
                      Agregar
                    </button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`;

      dom.tableView
        .querySelectorAll('[data-add-one]')
        .forEach(button =>
          button.addEventListener(
            'click',
            event => {
              event.stopPropagation();
              addToCart(button.dataset.addOne, 1);
            }
          )
        );

      dom.tableView
        .querySelectorAll('[data-table-sort]')
        .forEach(button =>
          button.addEventListener(
            'click',
            () => toggleTableSort(button.dataset.tableSort)
          )
        );

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
          style="background-color:#fff!important;color-scheme:light!important;forced-color-adjust:none!important;filter:none!important;mix-blend-mode:normal!important"
        >`;
    }

    function bindProductImageFallbacks(container) {
      if (!container) return;

      container
        .querySelectorAll('.js-product-image')
        .forEach(image => {
          image.addEventListener(
            'load',
            () => image.classList.add('is-loaded'),
            { once: true }
          );

          image.addEventListener('error', () => {
            const original =
              image.dataset.originalSrc || '';

            if (
              original &&
              image.dataset.originalTried !== 'true' &&
              image.src !== original
            ) {
              image.dataset.originalTried = 'true';
              image.src = original;
              return;
            }

            image.classList.add('is-broken');
          });
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

    function openProductDetail(code, preserveQuantity) {
      const product = getProduct(code);
      if (!product) return;

      state.detailProductCode = String(product.code);
      if (!preserveQuantity) {
        state.detailQuantity = getDraftQuantity(product.code);
      }

      const canBuy = Boolean(
        product.available &&
        toFiniteNumber(product.priceNet) > 0
      );
      const sale = toFiniteNumber(product.priceNet);
      const compare = toFiniteNumber(product.priceCompare);
      const adminCost = getAdminCost(product.code);

      dom.productDetailTitle.textContent = product.displayName;
      const highlights = [
        product.brand ? `Marca: ${product.brand}` : '',
        product.category ? `Categoría: ${product.category}` : '',
        product.volume ? `Contenido: ${product.volume}` : '',
        product.presentation ? `Presentación: ${product.presentation}` : ''
      ].filter(Boolean).slice(0, 4);

      dom.productDetailContent.innerHTML = `
        <div class="pdp-layout pdp-layout--amazonish">
          <div class="pdp-gallery">
            <div class="pdp-gallery-card">
              <button class="pdp-image-button" type="button" data-pdp-zoom aria-label="Ampliar imagen de ${escapeAttr(product.displayName)}">
                <span class="product-image-fallback" aria-hidden="true">
                  <span>${escapeHtml(categoryLetter(product.category))}</span>
                </span>
                ${productImageMarkup(product, 'pdp-image', product.displayName)}
              </button>
              <div class="pdp-gallery-actions">
                <button class="secondary-button" type="button" data-pdp-zoom>Ampliar imagen</button>
              </div>
            </div>
          </div>

          <div class="pdp-main">
            <div class="pdp-info">
              <div class="pdp-heading-block">
                <span class="pdp-category">${escapeHtml(product.category)}</span>
                <h3>${escapeHtml(product.displayName)}</h3>
                <p class="pdp-description">${escapeHtml(product.commercialDescription || product.description)}</p>
              </div>

              ${highlights.length ? `<ul class="pdp-highlights">${highlights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}

              <div class="pdp-specs-card">
                <div class="pdp-section-kicker">Datos clave</div>
                <dl class="pdp-specs">
                  ${pdpSpec('Código', product.code)}
                  ${pdpSpec('UPC', product.upc)}
                  ${pdpSpec('SKU', product.sku)}
                  ${pdpSpec('Marca', product.brand)}
                  ${pdpSpec('Contenido', product.volume || product.presentation)}
                  ${pdpSpec('Presentación', product.presentation)}
                  ${pdpSpec('Modelo', product.model)}
                  ${pdpSpec('Color', product.color)}
                  ${pdpSpec('Unidad', product.unit)}
                  ${pdpSpec('Disponibilidad', product.stock === null ? 'Sujeta a confirmación' : product.stock + ' disponibles')}
                </dl>
              </div>
            </div>

            <aside class="pdp-buybox">
              <div class="pdp-buybox__card">
                <div class="pdp-buybox__head">
                  <div class="pdp-section-kicker">Selección</div>
                  <div class="pdp-buybox__status">${canBuy ? 'Disponible para agregar' : 'Precio a consultar'}</div>
                </div>

                <div class="pdp-pricing pdp-pricing--buybox">
                  ${canBuy
                    ? `${compare > sale ? `<div class="price-compare">${money(compare)}</div>` : ''}
                       <div class="price-net">${money(sale)}</div>`
                    : '<div class="consult-price">Precio a consultar</div>'}
                  ${renderAdminPrice(adminCost)}
                </div>

                <div class="pdp-buybox__meta">
                  <div><span>Marca</span><strong>${escapeHtml(product.brand || 'Por confirmar')}</strong></div>
                  <div><span>Contenido</span><strong>${escapeHtml(product.volume || product.presentation || 'Por confirmar')}</strong></div>
                  <div><span>Unidad</span><strong>${escapeHtml(product.unit || 'pz')}</strong></div>
                  <div><span>Disponibilidad</span><strong>${escapeHtml(product.stock === null ? 'Sujeta a confirmación' : String(product.stock))}</strong></div>
                </div>

                <div class="pdp-actions">
                  <div class="qty-control pdp-qty-control">
                    <button type="button" data-pdp-minus>−</button>
                    <span id="pdpQuantityValue">${state.detailQuantity}</span>
                    <button type="button" data-pdp-plus>+</button>
                  </div>
                  <button class="add-button pdp-add-button" type="button" data-pdp-add ${canBuy ? '' : 'disabled'}>
                    ${canBuy ? 'Agregar al carrito' : 'Consultar'}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>`;

      bindProductImageFallbacks(dom.productDetailContent);

      const zoomButton = dom.productDetailContent.querySelector('[data-pdp-zoom]');
      const minus = dom.productDetailContent.querySelector('[data-pdp-minus]');
      const plus = dom.productDetailContent.querySelector('[data-pdp-plus]');
      const add = dom.productDetailContent.querySelector('[data-pdp-add]');

      listen(zoomButton, 'click', () => openImageZoom(product));
      listen(minus, 'click', () => changeDetailQuantity(-1));
      listen(plus, 'click', () => changeDetailQuantity(1));
      listen(add, 'click', () => {
        addToCart(product.code, state.detailQuantity);
        state.detailQuantity = 1;
        const value = document.getElementById('pdpQuantityValue');
        if (value) value.textContent = '1';
      });

      dom.productDetailModal.classList.add('is-open');
      dom.productDetailBackdrop.classList.add('is-open');
      document.body.classList.add('no-scroll');
    }

    function pdpSpec(label, value) {
      const clean = String(value || '').trim();
      if (!clean) return '';
      return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(clean)}</dd></div>`;
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

      dom.headerCartCount.textContent = String(totals.units);
      dom.floatingCartCount.textContent = String(totals.units);
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
          <div class="cart-item__visual">${line.product.imageUrl
            ? `<img src="${escapeAttr(line.product.imageUrl)}" alt="" style="--img-zoom:${Number(line.product.imageZoom||0.92)};--img-x:${Number(line.product.imageX||0)}%;--img-y:${Number(line.product.imageY||0)}%" onerror="this.style.display='none'">`
            : escapeHtml(categoryLetter(line.product.category))}</div>
          <div>
            <div class="cart-item__name">${escapeHtml(line.product.description)}</div>
            <div class="cart-item__code">CÓDIGO ${escapeHtml(line.product.code)}</div>
            <div class="cart-item__bottom">
              <div class="qty-control">
                <button type="button" data-cart-minus="${escapeAttr(line.product.code)}">−</button>
                <span>${line.quantity}</span>
                <button type="button" data-cart-plus="${escapeAttr(line.product.code)}">+</button>
              </div>
              <button class="remove-button" type="button" data-cart-remove="${escapeAttr(line.product.code)}">Quitar</button>
            </div>
          </div>
          <div class="cart-item__price">${money(line.lineNet)}</div>
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

      dom.cartUnits.textContent = totals.units.toLocaleString('es-MX');
      dom.cartSubtotal.textContent = totals.lines.toLocaleString('es-MX');
      dom.cartTotal.textContent = money(totals.net);
      dom.cartFooter.classList.remove('hidden');

      const belowMinimum =
        toFiniteNumber(state.store.minimumOrder) > 0 &&
        totals.net < toFiniteNumber(state.store.minimumOrder);

      dom.btnCheckout.disabled = belowMinimum;
      dom.minimumOrderNote.classList.toggle('hidden', !belowMinimum);
      dom.minimumOrderNote.textContent = belowMinimum
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
      dom.checkoutItemsText.textContent = totals.lines + (totals.lines === 1 ? ' producto' : ' productos');
      dom.checkoutUnitsText.textContent = totals.units + (totals.units === 1 ? ' unidad' : ' unidades');
      dom.checkoutTotal.textContent = money(totals.net);
    }

    function updateAddressVisibility() {
      const selected = dom.fulfillmentOptions.querySelector('input[name="fulfillment"]:checked');
      const isDelivery = selected && /entrega/i.test(selected.value);
      dom.addressGroup.classList.toggle('hidden', !isDelivery);
      dom.customerAddress.required = Boolean(isDelivery);
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
        address: dom.customerAddress.value.trim(),
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
      dom.btnSubmitOrder.disabled = value;
      dom.btnSubmitOrder.textContent = value ? 'Registrando…' : 'Registrar pedido';
    }

    function showCheckoutError(message) {
      dom.checkoutError.textContent = message;
      dom.checkoutError.classList.toggle('is-visible', Boolean(message));
    }

    function closeCheckoutForce() {
      dom.checkoutModal.classList.remove('is-open');
      dom.checkoutBackdrop.classList.remove('is-open');
    }

    function showSuccess(result) {
      dom.successFolio.textContent = result.folio || '—';
      dom.successTotal.textContent = money(result.totalNet || 0);
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
      dom.authTitle.textContent = login ? 'Iniciar sesión' : 'Crear cuenta';
    }
    function updateAuthUi() {
      const logged = Boolean(state.user && state.sessionToken);
      dom.accountLabel.textContent = logged ? (state.user.name || 'Mi cuenta') : 'Ingresar';
      dom.accountPanel.classList.toggle('hidden', !logged);
      dom.loginForm.classList.toggle('hidden', logged);
      dom.registerForm.classList.add('hidden');
      dom.btnGoogleLogin.classList.toggle('hidden', logged);
      dom.btnAuthLoginTab.parentElement.classList.toggle('hidden', logged);
      dom.authTitle.textContent = logged ? 'Mi cuenta' : 'Iniciar sesión';
      if (logged) {
        dom.accountName.textContent = state.user.name || 'Usuario';
        dom.accountEmail.textContent = state.user.email || '';
      }
      if (dom.accountRole) {
        dom.accountRole.classList.toggle('hidden', !state.isAdmin);
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
      toast('Sesión iniciada. Tu carrito quedó guardado.', 'success');
      setTimeout(closeAuth, 450);
    }
    function showAuthError(element, message) {
      element.textContent = message;
      element.classList.toggle('is-visible', Boolean(message));
    }
    async function restoreSession() {
      if (!state.sessionToken || !isAppsScriptHost()) { state.isAdmin = false; state.adminPrices = {}; updateAuthUi(); return; }
      const result = await backendRestoreSession(state.sessionToken);
      if (!result || !result.ok) {
        state.sessionToken = '';
        state.user = null;
        state.isAdmin = false;
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
    }
    async function logoutUser() {
      if (state.sessionToken) await backendLogout(state.sessionToken);
      state.sessionToken = '';
      state.user = null;
      state.isAdmin = false;
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

      await Promise.allSettled([
        minimumTime,
        initialLoad
      ]);

      state.entrySplashActive = false;

      if (dom.entrySplash) {
        dom.entrySplash.classList.add('is-leaving');

        setTimeout(() => {
          dom.entrySplash.classList.add('hidden');
          dom.entrySplash.classList.remove('is-leaving');
          dom.entrySplash.setAttribute('aria-hidden', 'true');

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
              !dom.intentWelcomeModal.classList.contains(
                'is-open'
              )
            ) {
              document.body.classList.remove(
                'no-scroll'
              );
            }
          }
        }, 320);
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

      // El título visible siempre conserva completa la descripción original.
      // No se recortan categorías ni abreviaturas: esto protege palabras como
      // AGUARDIENTE, TEQUILA y CHAMPAGNE en todos los productos.
      normalized.displayName = String(
        normalized.description ||
        normalized.shortName ||
        ''
      ).trim();

      normalized.volume =
        String(
          normalized.presentation ||
          normalized.volume ||
          extractVolumeDisplay(
            normalized.description
          ) ||
          ''
        ).trim();

      normalized.brand = String(
        normalized.brand ||
        inferBrandFromName(
          normalized.displayName
        ) ||
        ''
      ).trim();

      normalized.commercialDescription = String(
        normalized.commercialDescription ||
        buildCommercialDescription(
          normalized
        ) ||
        ''
      ).trim();

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

    const CATEGORY_PREFIX_PATTERN = new RegExp(
      '^(?:' +
      'TEQ\\.?|TEQUILA|' +
      'MEZ\\.?|MEZCAL|' +
      'WHI\\.?|WHISKY|WHISKEY|' +
      'RON|' +
      'VOD\\.?|VODKA|' +
      'GIN\\.?|GINEBRA|' +
      'BRA\\.?|BRANDY|' +
      'COG\\.?|COGNAC|COÑAC|' +
      'CHA\\.?|CHAMPAGNE|CHAMPÁN|' +
      'LIC\\.?|LICOR(?:ES)?|' +
      'AN[IÍ]S|' +
      'APE\\.?|APERITIVO(?:S)?|VERMOUTH|VERMUT|' +
      'V\\.?\\s*T\\.?|VINO\\s+TINTO|' +
      'V\\.?\\s*B\\.?|VINO\\s+BLANCO|' +
      'V\\.?\\s*R\\.?|VINO\\s+ROSADO|' +
      'V\\.?\\s*E\\.?|VINO\\s+ESPUMOSO|ESPUMOSO(?:S)?|CAVA|PROSECCO|' +
      'SIDRA|ROMPOPE|' +
      'JER\\.?|JEREZ|' +
      'OPO\\.?|OPORTO|' +
      'AGU\\.?|AGUARDIENTE|' +
      'CRE\\.?|CREMA(?:S)?|' +
      'DESTILADO(?:S)?|' +
      'BEBIDA(?:S)?|JARABE(?:S)?|MARGARITA|SANGRITA|' +
      'VAP|PAQUETE(?:S)?' +
      ')\\s*[.\\-:·/]*\\s*',
      'i'
    );

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

    function stripCategoryPrefix(value) {
      // Los títulos comerciales se conservan completos.
      // No se eliminan prefijos porque abreviaturas como TEQ, CHA o AGU
      // también forman parte del inicio de palabras completas como
      // TEQUILA, CHAMPAGNE y AGUARDIENTE.
      return String(value || '').trim();
    }

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

      const stripped = name
        .replace(
          CATEGORY_PREFIX_PATTERN,
          ''
        )
        .trim();

      const normalizedName = normalize(
        stripped
      );

      const orderedBrands =
        KNOWN_BRANDS
          .slice()
          .sort(
            (left, right) =>
              right.length - left.length
          );

      for (const brand of orderedBrands) {
        if (
          normalizedName.includes(
            normalize(brand)
          )
        ) {
          return brand;
        }
      }

      const cleaned = stripped
        .replace(
          /\b\d+(?:[.,]\d+)?\s*(?:ML|L)\b/gi,
          ' '
        )
        .replace(/\+\s*.*$/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const tokens = cleaned
        .split(' ')
        .filter(Boolean);

      const leadingNoise = new Set([
        'DE', 'DEL', 'CON', 'C',
        'C/HIERBA', 'C/TEQ', 'ORUJO',
        'LICOR', 'CREMA', 'ANIS',
        'ANÍS', 'AMARETTO', 'AMARO',
        'ESPUMOSO', 'VINO', 'WHISKY',
        'TEQUILA', 'RON', 'AGAVE', 'MA'
      ]);

      while (tokens.length) {
        const token = tokens[0]
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();

        if (
          leadingNoise.has(token) ||
          BRAND_STOP_WORDS.has(token) ||
          /^\d+$/.test(token)
        ) {
          tokens.shift();
          continue;
        }

        break;
      }

      if (!tokens.length) return '';

      const output = [];

      for (
        let index = 0;
        index < tokens.length &&
        output.length < 3;
        index++
      ) {
        const token = tokens[index];
        const normalizedToken = token
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .replace(/[.,;:]+$/g, '');

        if (
          output.length &&
          (
            BRAND_STOP_WORDS.has(
              normalizedToken
            ) ||
            /^\d/.test(normalizedToken)
          )
        ) {
          break;
        }

        output.push(token);
      }

      return output
        .join(' ')
        .replace(/[.,;:]+$/g, '')
        .trim();
    }

    function buildCommercialDescription(product) {
      const title = String(
        product.displayName ||
        product.description ||
        ''
      ).trim();

      const brand = String(
        product.brand || ''
      ).trim();

      const category = String(
        product.category || 'producto'
      ).trim();

      const volume = String(
        product.volume ||
        product.presentation ||
        ''
      ).trim();

      const key = normalize(category);

      const categoryNames = {
        tequila: 'una opción de tequila',
        mezcal: 'una opción de mezcal',
        whisky: 'un whisky',
        ron: 'un ron',
        vodka: 'un vodka',
        ginebra: 'una ginebra',
        brandy: 'un brandy',
        cognac: 'un cognac',
        champagne: 'un champagne',
        espumosos: 'un vino espumoso',
        'vino tinto': 'un vino tinto',
        'vino blanco': 'un vino blanco',
        'vino rosado': 'un vino rosado',
        licores: 'un licor',
        cremas: 'una crema de licor',
        anis: 'un anís',
        'aperitivos y vermouth':
          'un aperitivo o vermouth',
        aguardiente: 'un aguardiente',
        sidra: 'una sidra',
        jerez: 'un jerez',
        oporto: 'un oporto',
        rompope: 'un rompope'
      };

      const usageCopy = {
        champagne:
          'Está pensado para brindis, celebraciones y aperitivos; sírvelo bien frío.',
        espumosos:
          'Está pensado para brindis, celebraciones y aperitivos; sírvelo bien frío.',
        'vino tinto':
          'Puede acompañar comidas, cenas y sobremesas; sirve a la temperatura indicada por el productor.',
        'vino blanco':
          'Puede acompañar comidas, aperitivos y reuniones; sirve a la temperatura indicada por el productor.',
        'vino rosado':
          'Puede acompañar comidas ligeras, aperitivos y reuniones; sirve bien frío.',
        tequila:
          'Puede disfrutarse solo, con hielo o como base de coctelería, de acuerdo con el estilo indicado en la etiqueta.',
        mezcal:
          'Puede apreciarse solo o utilizarse en coctelería, de acuerdo con el estilo indicado en la etiqueta.',
        whisky:
          'Puede apreciarse solo, con hielo o en coctelería, según la ocasión y la preferencia de servicio.',
        ron:
          'Puede servirse solo, con hielo o en coctelería, según la ocasión y la preferencia de servicio.',
        brandy:
          'Puede disfrutarse solo, con hielo o durante la sobremesa.',
        cognac:
          'Puede disfrutarse solo, con hielo o durante la sobremesa.',
        ginebra:
          'Puede servirse con mezcladores o utilizarse como base de coctelería.',
        vodka:
          'Puede servirse frío, con mezcladores o utilizarse como base de coctelería.',
        licores:
          'Puede servirse solo, frío, durante la sobremesa o utilizarse en coctelería.',
        cremas:
          'Puede servirse fría, con hielo, durante la sobremesa o utilizarse en coctelería.'
      };

      const categoryPhrase =
        categoryNames[key] ||
        'una presentación de la colección';

      const brandPhrase = brand
        ? ' de ' + brand
        : '';

      const volumePhrase = volume
        ? ' en formato de ' + volume
        : '';

      return (
        title +
        ' es ' +
        categoryPhrase +
        brandPhrase +
        volumePhrase +
        '. ' +
        (
          usageCopy[key] ||
          'Es una opción para integrar a tu selección, regalar o compartir responsablemente.'
        ) +
        ' Consulta la etiqueta para confirmar origen, graduación alcohólica, ingredientes y recomendaciones específicas de servicio.'
      );
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
            'ffffff'
          );
          proxyUrl.searchParams.set(
            'bg',
            'ffffff'
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
        '&cbg=ffffff&bg=ffffff&output=webp&q=87&we=1'
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

