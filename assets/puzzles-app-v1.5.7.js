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

    const STORAGE_KEYS = Object.freeze({
      CART: 'puzzles_cart_v3',
      AGE: 'puzzles_age_confirmed_v1',
      CUSTOMER: 'puzzles_customer_v2',
      VIEW: 'puzzles_catalog_view_v1',
      SESSION: 'puzzles_session_v1'
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
        hero: 'Encuentra la pieza correcta para cada ocasión.',
        priceNotice: 'Cada precio y disponibilidad se confirma antes de cerrar la solicitud.',
        whatsapp: '',
        currency: 'MXN',
        allowDelivery: true,
        allowPickup: true,
        minimumOrder: 0,
        showWithoutTax: true,
        footerText: 'Venta exclusiva para mayores de 18 años. Evita el exceso.'
      },
      products: [],
      categories: [],
      filtered: [],
      search: '',
      category: 'Todas',
      minPrice: '',
      maxPrice: '',
      includeConsult: true,
      sort: 'featured',
      view: puzzlesStorageGet(STORAGE_KEYS.VIEW) || 'grid',
      page: 1,
      pageSize: 48,
      cart: loadJson(STORAGE_KEYS.CART, {}),
      quantities: {},
      submitting: false,
      user: null,
      sessionToken: puzzlesStorageGet(STORAGE_KEYS.SESSION) || '',
      carouselIndex: 0,
      carouselTimer: null,
      searchScores: new Map()
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

    async function init() {
      puzzlesStorageRemove('puzzles_cart_v1');
      puzzlesStorageRemove('puzzles_cart_v2');
      cacheDom();
      bindEvents();
      restoreAgeGate();
      restoreCustomer();

      if (dom.footerYear) {
        dom.footerYear.textContent =
          new Date().getFullYear();
      }

      setView(state.view, false);
      renderCart();
      await loadStore();
      await restoreSession();
    }

    function cacheDom() {
      [
        'ageGate','agePrompt','ageDenied','btnAgeNo','btnAgeYes','announcementText',
        'brandName','brandSubtitle','feature1Title','featureCatalogText','feature2Title','feature2Text','feature3Title','feature3Text','catalogKicker','catalogTitle','catalogDescription','githubSetup',
        'heroCarousel','heroSlides','heroDots','btnHeroPrev','btnHeroNext',
        'categoryList','priceMin','priceMax','includeConsult','filtersPanel','btnClearFilters',
        'btnMobileFilters','searchInput','sortSelect','btnGridView','btnTableView',
        'resultCount','resultRange','activeFilterWrap','loadingState','errorState','errorMessage',
        'emptyState','gridView','tableView','pagination','btnRetry','btnEmptyClear',
        'btnHeaderWhatsApp','btnFooterWhatsApp','btnSearchHeader','btnAccountHeader','accountLabel',
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
        'accountPanel','accountName','accountEmail','btnLogout'
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

      document.querySelectorAll('[data-scroll-catalog]').forEach(button => {
        button.addEventListener('click', () => document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' }));
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

      listen(dom.sortSelect, 'change', () => {
        state.sort = dom.sortSelect.value;
        state.page = 1;
        applyFilters();
      });

      listen(dom.btnGridView, 'click', () => setView('grid'));
      listen(dom.btnTableView, 'click', () => setView('table'));
      listen(dom.btnClearFilters, 'click', clearFilters);
      listen(dom.btnEmptyClear, 'click', clearFilters);
      listen(dom.btnRetry, 'click', loadStore);

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

      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (dom.successModal.classList.contains('is-open')) closeSuccess();
        else if (dom.authModal.classList.contains('is-open')) closeAuth();
        else if (dom.checkoutModal.classList.contains('is-open')) closeCheckout();
        else closeOverlays();
      });
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
    async function backendSaveAccountState(payload) {
      if (!state.sessionToken || !isAppsScriptHost()) return { ok: false };
      return gasRun('saveAccountState', { token: state.sessionToken, payload: payload });
    }

    // ==========================================================
    // CARGA Y CONFIGURACIÓN VISUAL
    // ==========================================================

    async function loadStore() {
      state.loading = true;
      showOnlyState('loading');
      try {
        const result = await backendGetStore();
        if (!result || !result.ok) throw new Error((result && result.error) || 'No se recibió un catálogo válido.');

        state.store = Object.assign({}, state.store, result.store || {});
        state.products = Array.isArray(result.products) ? result.products.map(normalizeProductRecord) : [];
        state.categories = Array.isArray(result.categories) ? result.categories : [];
        state.loading = false;

        applyStoreConfig(result.stats || {});
        renderCategories();
        normalizeCartAgainstCatalog();
        applyFilters();
        renderCart();

        try {
          window.parent.postMessage(
            {
              type: 'PUZZLES_READY',
              version: result.version || '',
              products: state.products.length
            },
            '*'
          );
        } catch (_) {}

      } catch (error) {
        state.loading = false;
        dom.errorMessage.textContent =
          error.message || String(error);

        showOnlyState('error');

        try {
          window.parent.postMessage(
            {
              type: 'PUZZLES_ERROR',
              message:
                error.message ||
                String(error)
            },
            '*'
          );
        } catch (_) {}
      }
    }


    function applyBrandLogos(logoUrl) {
      const brands =
        document.querySelectorAll('.brand');

      brands.forEach(brand => {
        const mark =
          brand.querySelector('.brand__mark');

        const copy =
          brand.querySelector('.brand__copy');

        if (!mark) return;

        if (!mark.dataset.originalHtml) {
          mark.dataset.originalHtml =
            mark.innerHTML;
        }

        if (logoUrl) {
          brand.classList.add(
            'brand--asset'
          );

          mark.innerHTML =
            '<img src="' +
            escapeHtml(logoUrl) +
            '" alt="PUZZLES · Vinos, licores y destilados">';

          if (copy) {
            copy.hidden = true;
          }
        } else {
          brand.classList.remove(
            'brand--asset'
          );

          mark.innerHTML =
            mark.dataset.originalHtml;

          if (copy) {
            copy.hidden = false;
          }
        }
      });
    }

    function applyStoreConfig(stats) {
      document.title = state.store.name + ' · Vinos y licores';
      dom.brandName.textContent = state.store.name;
      dom.brandSubtitle.textContent = state.store.subtitle;
      applyBrandLogos(state.store.logoUrl || '');
      dom.announcementText.textContent = state.store.priceNotice;
      dom.footerText.textContent = state.store.footerText;
      const features = Array.isArray(state.store.features) ? state.store.features : [];
      dom.feature1Title.textContent = (features[0] && features[0].title) || 'COLECCIÓN EN ORDEN';
      dom.featureCatalogText.textContent = (features[0] && features[0].text) || 'Productos, presentaciones y precios organizados en una sola pieza de consulta.';
      dom.feature2Title.textContent = (features[1] && features[1].title) || 'BÚSQUEDA QUE ENCAJA';
      dom.feature2Text.textContent = (features[1] && features[1].text) || 'Encuentra aunque cambies el orden o escribas con variaciones menores.';
      dom.feature3Title.textContent = (features[2] && features[2].title) || 'SELECCIÓN PERSISTENTE';
      dom.feature3Text.textContent = (features[2] && features[2].text) || 'Tu selección permanece en su lugar mientras continúas navegando.';
      dom.catalogKicker.textContent = state.store.catalogKicker || 'NUESTRA COLECCIÓN';
      dom.catalogTitle.textContent = state.store.catalogTitle || 'Explora la colección completa';
      dom.catalogDescription.textContent = state.store.catalogText || 'Elige piezas de la colección y agrégalas al carrito.';
      [dom.btnHeaderWhatsApp, dom.btnFooterWhatsApp].forEach(button => {
        button.style.display = state.store.whatsapp ? '' : 'none';
      });
      renderCarousel();
      renderFulfillmentOptions();
    }

    function heroToHtml(text) {
      const safe = escapeHtml(text || 'Encuentra la pieza correcta para cada ocasión.');
      const target = 'cada ocasión';
      const index = safe.toLowerCase().lastIndexOf(target);
      if (index < 0) return safe;
      return safe.slice(0, index) + '<em>' + safe.slice(index) + '</em>';
    }

    function renderCarousel() {
      const banners = Array.isArray(state.store.banners) && state.store.banners.length
        ? state.store.banners
        : [{ kicker:'SELECCIÓN PUZZLES', title:state.store.hero, text:'Explorar colección y arma tu pedido.', imageUrl:'' }];
      dom.heroSlides.innerHTML = banners.map((banner,index) => {
        const style = banner.imageUrl ? `style="background-image:url('${escapeAttr(banner.imageUrl)}')"` : '';
        return `<article class="hero-slide ${index===state.carouselIndex?'is-active':''}" ${style}>
          <div class="hero-slide__inner"><div class="hero-slide__content">
            <span class="eyebrow">${escapeHtml(banner.kicker || 'SELECCIÓN PUZZLES')}</span>
            <h1>${escapeHtml(banner.title || state.store.hero)}</h1>
            <p class="hero-slide__text">${escapeHtml(banner.text || '')}</p>
            <div class="hero-slide__actions">
              <button class="btn btn--gold" type="button" data-hero-catalog>Explorar catálogo</button>
              ${state.store.whatsapp ? '<button class="btn btn--outline-light" type="button" data-hero-whatsapp>Pedir asesoría</button>' : ''}
            </div>
          </div></div>
        </article>`;
      }).join('');
      dom.heroDots.innerHTML = banners.map((_,index) => `<button type="button" class="${index===state.carouselIndex?'is-active':''}" data-carousel-index="${index}" aria-label="Banner ${index+1}"></button>`).join('');
      dom.heroSlides.querySelectorAll('[data-hero-catalog]').forEach(btn => btn.addEventListener('click', () => document.getElementById('catalogo').scrollIntoView({behavior:'smooth'})));
      dom.heroSlides.querySelectorAll('[data-hero-whatsapp]').forEach(btn => btn.addEventListener('click', openConcierge));
      dom.heroDots.querySelectorAll('[data-carousel-index]').forEach(btn => btn.addEventListener('click', () => setCarousel(Number(btn.dataset.carouselIndex))));
      restartCarousel();
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
          state.category = button.dataset.category;
          state.page = 1;
          renderCategories();
          applyFilters();
          if (window.innerWidth <= 960) closeOverlays();
        });
      });
    }

    function applyFilters() {
      const queryInfo = prepareSearchQuery(state.search);
      const min = state.minPrice === '' ? null : Number(state.minPrice);
      const max = state.maxPrice === '' ? null : Number(state.maxPrice);
      state.searchScores = new Map();

      let products = state.products.filter(product => {
        if (state.category !== 'Todas' && product.category !== state.category) return false;
        if (!state.includeConsult && Number(product.priceNet) <= 0) return false;
        if (min !== null && Number(product.priceNet) < min) return false;
        if (max !== null && Number(product.priceNet) > max) return false;
        if (queryInfo.tokens.length) {
          const score = fuzzyProductScore(product, queryInfo);
          if (score < queryInfo.minimumScore) return false;
          state.searchScores.set(product.code, score);
        }
        return true;
      });

      if (queryInfo.tokens.length && state.sort === 'featured') {
        products.sort((a,b) => (state.searchScores.get(b.code)||0) - (state.searchScores.get(a.code)||0));
      } else {
        products = sortProducts(products, state.sort);
      }
      state.filtered = products;
      const totalPages = Math.max(1, Math.ceil(products.length / state.pageSize));
      if (state.page > totalPages) state.page = totalPages;
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
      const byName = (a, b) => String(a.description).localeCompare(String(b.description), 'es', { sensitivity: 'base', numeric: true });
      const byCode = (a, b) => String(a.code).localeCompare(String(b.code), 'es', { sensitivity: 'base', numeric: true });

      switch (mode) {
        case 'nameAsc': return copy.sort(byName);
        case 'nameDesc': return copy.sort((a,b) => byName(b,a));
        case 'priceAsc': return copy.sort((a,b) => {
          const av = Number(a.priceNet) <= 0 ? Number.POSITIVE_INFINITY : Number(a.priceNet);
          const bv = Number(b.priceNet) <= 0 ? Number.POSITIVE_INFINITY : Number(b.priceNet);
          return av - bv || byName(a,b);
        });
        case 'priceDesc': return copy.sort((a,b) => Number(b.priceNet) - Number(a.priceNet) || byName(a,b));
        case 'codeAsc': return copy.sort(byCode);
        default:
          return copy.sort((a,b) => {
            const ac = String(a.category).localeCompare(String(b.category), 'es', { sensitivity: 'base' });
            return ac || byName(a,b);
          });
      }
    }

    function clearFilters() {
      state.search = '';
      state.category = 'Todas';
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
      renderCategories();
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
        renderTable(pageProducts);
        showOnlyState('table');
      } else {
        renderGrid(pageProducts);
        showOnlyState('grid');
      }
      renderPagination();
    }

    function renderActiveFilter() {
      const labels = [];
      if (state.category !== 'Todas') labels.push(state.category);
      if (state.search.trim()) labels.push('“' + state.search.trim() + '”');
      if (state.minPrice !== '') labels.push('Desde ' + money(state.minPrice));
      if (state.maxPrice !== '') labels.push('Hasta ' + money(state.maxPrice));
      if (!state.includeConsult) labels.push('Sólo con precio');

      dom.activeFilterWrap.innerHTML = labels.length
        ? '<span class="active-filter">' + escapeHtml(labels.join(' · ')) + '</span>'
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
      dom.gridView.innerHTML = products.map(product => {
        const quantity = getDraftQuantity(product.code);
        const cartQty = extractCartQuantity(state.cart[product.code]);
        const canBuy = Boolean(product.available && toFiniteNumber(product.priceNet) > 0);
        const imageStyle = `--img-zoom:${Number(product.imageZoom||0.92)};--img-x:${Number(product.imageX||0)}%;--img-y:${Number(product.imageY||0)}%`;
        const image = product.imageUrl
          ? `<img class="product-card__image" style="${imageStyle}" src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.description)}" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="bottle-mark" data-letter="${escapeAttr(categoryLetter(product.category))}"></div>`;
        const compare = toFiniteNumber(product.priceCompare);
        const sale = toFiniteNumber(product.priceNet);
        const discount = compare > sale && sale > 0 ? Math.round((1 - sale / compare) * 100) : 0;
        const meta = productMetaItems(product);
        const displayName = product.shortName || product.description;
        const secondaryName = product.shortName && normalize(product.shortName) !== normalize(product.description)
          ? product.description : '';

        return `<article class="product-card" data-code="${escapeAttr(product.code)}">
          <div class="product-card__visual">
            <span class="product-card__category">${escapeHtml(product.category)}</span>${image}
          </div>
          <div class="product-card__body">
            <div class="product-card__code">CÓDIGO ${escapeHtml(product.code)}${product.upc ? ` · UPC ${escapeHtml(product.upc)}` : ''}</div>
            <h3 class="product-card__name">${escapeHtml(displayName)}</h3>
            ${secondaryName ? `<p class="product-card__description">${escapeHtml(secondaryName)}</p>` : ''}
            <div class="product-card__meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
            <div class="product-card__price-block">
              ${canBuy ? `${compare > sale ? `<div class="price-compare">${money(compare)}${discount ? `<span class="discount-badge">-${discount}%</span>` : ''}</div>` : ''}<div class="price-net">${money(sale)}</div>` : `<div class="consult-price">Precio a consultar</div>`}
            </div>
            <div class="product-card__actions">
              <div class="qty-control"><button type="button" data-qty-minus="${escapeAttr(product.code)}">−</button><span data-qty-value="${escapeAttr(product.code)}">${quantity}</span><button type="button" data-qty-plus="${escapeAttr(product.code)}">+</button></div>
              <button class="add-button" type="button" data-add="${escapeAttr(product.code)}" ${canBuy?'':'disabled'}>${canBuy?'Agregar al carrito':'Consultar'}</button>
            </div>
            ${cartQty>0?`<div class="in-cart-note">${cartQty} ${cartQty===1?'unidad':'unidades'} en el carrito</div>`:''}
          </div>
        </article>`;
      }).join('');
      bindProductControls(dom.gridView);
    }

    function renderTable(products) {
      dom.tableView.innerHTML = `<table class="product-table"><thead><tr>
        <th>Código</th><th>Producto</th><th>Marca</th><th>Presentación</th><th>Precio</th><th>Antes</th><th>Acción</th>
      </tr></thead><tbody>${products.map(product => {
        const canBuy = Boolean(product.available && toFiniteNumber(product.priceNet)>0);
        const compare = toFiniteNumber(product.priceCompare);
        const sale = toFiniteNumber(product.priceNet);
        return `<tr><td><strong>${escapeHtml(product.code)}</strong>${product.upc?`<br><small>UPC ${escapeHtml(product.upc)}</small>`:''}</td><td class="product-table__description">${escapeHtml(product.shortName||product.description)}</td><td>${escapeHtml(product.brand||'—')}</td><td>${escapeHtml(product.presentation||product.volume||product.unit||'—')}</td><td class="product-table__price">${canBuy?money(sale):'Consultar'}</td><td>${compare>sale?`<span class="price-compare">${money(compare)}</span>`:'—'}</td><td><button class="table-add" type="button" data-add-one="${escapeAttr(product.code)}" ${canBuy?'':'disabled'}>Agregar</button></td></tr>`;
      }).join('')}</tbody></table>`;
      dom.tableView.querySelectorAll('[data-add-one]').forEach(button => button.addEventListener('click',()=>addToCart(button.dataset.addOne,1)));
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
      state.view = view === 'table' ? 'table' : 'grid';
      puzzlesStorageSet(STORAGE_KEYS.VIEW, state.view);
      dom.btnGridView.classList.toggle('is-active', state.view === 'grid');
      dom.btnTableView.classList.toggle('is-active', state.view === 'table');
      if (render && !state.loading) renderCatalog();
    }

    function showOnlyState(type) {
      dom.loadingState.classList.add('hidden');
      dom.errorState.classList.add('hidden');
      dom.emptyState.classList.add('hidden');
      dom.gridView.classList.add('hidden');
      dom.tableView.classList.add('hidden');
      dom.pagination.classList.add('hidden');

      if (type === 'loading') dom.loadingState.classList.remove('hidden');
      if (type === 'error') dom.errorState.classList.remove('hidden');
      if (type === 'empty') dom.emptyState.classList.remove('hidden');
      if (type === 'grid') dom.gridView.classList.remove('hidden');
      if (type === 'table') dom.tableView.classList.remove('hidden');
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
      let raw = value;

      if (raw && typeof raw === 'object') {
        raw = raw.quantity ?? raw.cantidad ?? raw.qty ?? raw.units ?? raw.unidades ?? 1;
      }

      const quantity = Math.floor(toFiniteNumber(raw));
      return Math.max(1, Math.min(99, quantity || 1));
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
      if (!state.loading) renderCatalog();
    }

    function removeFromCart(code) {
      delete state.cart[code];
      saveCart();
      renderCart();
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
      updateAuthUi();
      toast('Sesión iniciada. Tu carrito quedó guardado.', 'success');
      setTimeout(closeAuth, 450);
    }
    function showAuthError(element, message) {
      element.textContent = message;
      element.classList.toggle('is-visible', Boolean(message));
    }
    async function restoreSession() {
      if (!state.sessionToken || !isAppsScriptHost()) { updateAuthUi(); return; }
      const result = await backendRestoreSession(state.sessionToken);
      if (!result || !result.ok) {
        state.sessionToken = '';
        state.user = null;
        puzzlesStorageRemove(STORAGE_KEYS.SESSION);
        updateAuthUi();
        return;
      }
      state.user = result.user;
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
      updateAuthUi();
    }
    async function logoutUser() {
      if (state.sessionToken) await backendLogout(state.sessionToken);
      state.sessionToken = '';
      state.user = null;
      puzzlesStorageRemove(STORAGE_KEYS.SESSION);
      updateAuthUi();
      closeAuth();
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
      const confirmed =
        puzzlesStorageGet(
          STORAGE_KEYS.AGE
        ) === 'true';

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
        !confirmed
      );
    }

    function confirmAge() {
      if (
        typeof window.PUZZLES_AGE_ACCEPT ===
        'function'
      ) {
        window.PUZZLES_AGE_ACCEPT();
      }
    }

    function denyAge() {
      if (
        typeof window.PUZZLES_AGE_DENY ===
        'function'
      ) {
        window.PUZZLES_AGE_DENY();
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
      const normalized = Object.assign({}, product || {});
      normalized.code = String(normalized.code ?? '').trim();
      normalized.description = String(normalized.description ?? '').trim();
      normalized.priceNet = round2(toFiniteNumber(normalized.priceNet));
      normalized.priceCompare = round2(toFiniteNumber(normalized.priceCompare));
      normalized.priceNetText = normalized.priceNet.toFixed(2);
      normalized.priceCompareText = normalized.priceCompare.toFixed(2);
      normalized.imageZoom = Math.max(.65, Math.min(3, toFiniteNumber(normalized.imageZoom) || 0.92));
      normalized.imageX = Math.max(-45, Math.min(45, toFiniteNumber(normalized.imageX)));
      normalized.imageY = Math.max(-45, Math.min(45, toFiniteNumber(normalized.imageY)));
      normalized.searchCanonical = canonicalSearchText([
        normalized.code, normalized.upc, normalized.sku, normalized.brand,
        normalized.shortName, normalized.description, normalized.model,
        normalized.color, normalized.presentation, normalized.category,
        normalized.unit, normalized.volume
      ].join(' '));
      normalized.searchTokens = normalized.searchCanonical.split(' ').filter(Boolean);
      if (normalized.stock === null || normalized.stock === undefined || normalized.stock === '') normalized.stock = null;
      else normalized.stock = Math.max(0, Math.floor(toFiniteNumber(normalized.stock)));
      normalized.available = normalized.priceNet > 0 && (normalized.stock === null || normalized.stock > 0);
      return normalized;
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
   CONTROL DE EDAD INDEPENDIENTE
   ============================================================ */
/*
     * Botones de edad independientes del resto de la aplicación.
     * Siguen funcionando aunque falle otro módulo o el navegador
     * bloquee localStorage dentro del iframe.
     */
    (function () {
      var AGE_KEY = 'puzzles_age_confirmed_v1';
      var memory = {};

      function getValue(key) {
        try {
          return window.puzzlesStorageGet(key);
        } catch (_) {
          return Object.prototype.hasOwnProperty.call(
            memory,
            key
          ) ? memory[key] : null;
        }
      }

      function setValue(key, value) {
        memory[key] = String(value);
        try {
          window.puzzlesStorageSet(
            key,
            String(value)
          );
        } catch (_) {}
      }

      window.PUZZLES_AGE_ACCEPT = function () {
        setValue(AGE_KEY, 'true');

        var gate =
          document.getElementById('ageGate');

        if (gate) {
          gate.classList.add('hidden');
          gate.setAttribute('aria-hidden', 'true');
          gate.style.display = 'none';
        }

        document.body.classList.remove('no-scroll');
        return false;
      };

      window.PUZZLES_AGE_DENY = function () {
        var prompt =
          document.getElementById('agePrompt');

        var denied =
          document.getElementById('ageDenied');

        if (prompt) {
          prompt.classList.add('hidden');
        }

        if (denied) {
          denied.classList.remove('hidden');
        }

        return false;
      };

      if (getValue(AGE_KEY) === 'true') {
        var gate =
          document.getElementById('ageGate');

        if (gate) {
          gate.classList.add('hidden');
          gate.setAttribute('aria-hidden', 'true');
          gate.style.display = 'none';
        }
      }
    })();
