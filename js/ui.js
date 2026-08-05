/* =========================================================================
   UI.JS — Todo lo que dibuja cosas en pantalla: grilla, tarjetas, modales,
   chips de categoría y la sección de contacto. No decide de dónde salen
   los datos (eso es data.js) ni qué significa "agregar al pedido" (eso es
   cart.js) — solo los muestra y conecta los clicks con esas funciones.
   ========================================================================= */
 
/* ------------------------------------------------------------------------
   Búsqueda
   ------------------------------------------------------------------------ */
function setupSearch() {
  let debounceTimer;
  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const value = e.target.value;
    debounceTimer = setTimeout(() => {
      searchTerm = value.trim().toLowerCase();
      renderGrid();
    }, 200);
  });
}
 
/* ------------------------------------------------------------------------
   Chips de categoría
   ------------------------------------------------------------------------ */
function buildCategoryChips() {
  const categories = [...new Set(allProducts.map((p) => p.category))].sort();
  categoryColorMap = {};
  categories.forEach((c, i) => (categoryColorMap[c] = CATEGORY_COLORS[i % CATEGORY_COLORS.length]));
 
  els.categoryChips.innerHTML = "";
  els.categoryChips.appendChild(makeChip("Todas", null));
  categories.forEach((c) => els.categoryChips.appendChild(makeChip(c, c)));
}
 
function makeChip(label, value) {
  const chip = document.createElement("button");
  chip.className = "chip" + (activeCategory === value ? " active" : "");
  chip.textContent = label;
  chip.type = "button";
  chip.addEventListener("click", () => {
    activeCategory = value;
    buildCategoryChips();
    renderGrid();
  });
  return chip;
}
 
/* ------------------------------------------------------------------------
   Grilla de productos
   ------------------------------------------------------------------------ */
function renderGrid() {
  const filtered = allProducts.filter((p) => {
    if (activeCategory && p.category !== activeCategory) return false;
    if (searchTerm) {
      // El código sigue siendo buscable (útil si alguien lo tipea de
      // memoria) aunque nunca se muestre en la tarjeta.
      const haystack = `${p.name} ${p.category} ${p.subcategory} ${p.code} ${p.lab}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });
 
  els.grid.innerHTML = "";
  cartIndicatorEls = {};
 
  if (filtered.length === 0) {
    els.emptyState.hidden = false;
    return;
  }
  els.emptyState.hidden = true;
 
  const fragment = document.createDocumentFragment();
  filtered.forEach((p) => fragment.appendChild(buildCard(p)));
  els.grid.appendChild(fragment);
}
 
function availabilityTagHtml(p) {
  const cls = p.availability === "En stock" ? "in" : "out";
  return `<span class="avail-tag ${cls}">${escapeHtml(p.availability)}</span>`;
}
 
// Nota: el producto trae "code" (p.code) pero deliberadamente no se
// renderiza en ningún lado de la tarjeta ni del modal — el cliente no debe
// verlo en pantalla. Sigue viajando en el mail de la cotización (cart.js).
function buildCard(p) {
  const key = productKey(p);
 
  const card = document.createElement("article");
  card.className = "product-card";
 
  const strip = document.createElement("div");
  strip.className = "card-strip";
  strip.style.background = categoryColorMap[p.category] || CATEGORY_COLORS[0];
  card.appendChild(strip);
 
  const media = document.createElement("div");
  media.className = "card-media";
  media.appendChild(buildImageEl(p, false));
  media.addEventListener("click", () => openProductModal(p));
  card.appendChild(media);
 
  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <h3 class="card-title">${escapeHtml(p.name)}</h3>
    <span class="card-category">${escapeHtml(p.category)}</span>
    ${p.subcategory ? `<span class="card-subcategory">${escapeHtml(p.subcategory)}</span>` : ""}
    <div class="card-footer">${availabilityTagHtml(p)}</div>
  `;
  body.querySelector(".card-title").addEventListener("click", () => openProductModal(p));
 
  const cartRow = buildCartRow(p, key);
  body.appendChild(cartRow.wrapper);
  card.appendChild(body);
 
  cartIndicatorEls[key] = cartRow.indicatorEl;
  updateCartIndicator(key);
 
  return card;
}
 
// Controles de cantidad + botón "Agregar" (reutilizados en tarjeta y modal)
function buildCartRow(p, key) {
  const wrapper = document.createElement("div");
  wrapper.className = "card-cart-row";
 
  const qtyControl = document.createElement("div");
  qtyControl.className = "qty-control";
 
  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "qty-btn";
  minusBtn.textContent = "−";
  minusBtn.setAttribute("aria-label", "Restar uno");
 
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.className = "qty-input";
  qtyInput.min = "0";
  qtyInput.value = "1";
  qtyInput.setAttribute("aria-label", `Cantidad de ${p.name}`);
 
  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "qty-btn";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", "Sumar uno");
 
  const stopBubble = (fn) => (e) => { e.stopPropagation(); fn(e); };
 
  minusBtn.addEventListener("click", stopBubble(() => {
    qtyInput.value = Math.max(0, safeInt(qtyInput.value) - 1);
  }));
  plusBtn.addEventListener("click", stopBubble(() => {
    qtyInput.value = safeInt(qtyInput.value) + 1;
  }));
  qtyInput.addEventListener("click", (e) => e.stopPropagation());
 
  qtyControl.append(minusBtn, qtyInput, plusBtn);
 
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-btn";
  addBtn.textContent = "Agregar";
  addBtn.addEventListener("click", stopBubble(() => {
    const qty = safeInt(qtyInput.value);
    if (qty <= 0) {
      removeFromCart(key);
    } else {
      addToCart(p, key, qty);
    }
  }));
 
  wrapper.append(qtyControl, addBtn);
 
  const indicatorEl = document.createElement("div");
  indicatorEl.className = "cart-indicator";
  indicatorEl.hidden = true;
 
  const outer = document.createElement("div");
  outer.appendChild(wrapper);
  outer.appendChild(indicatorEl);
 
  return { wrapper: outer, indicatorEl };
}
 
function buildImageEl(p, large) {
  if (!p.imageUrl) {
    const placeholder = document.createElement("div");
    placeholder.className = "no-image";
    placeholder.textContent = "Sin imagen";
    return placeholder;
  }
  const img = document.createElement("img");
  img.src = p.imageUrl;
  img.alt = p.name;
  img.loading = large ? "eager" : "lazy";
  img.onerror = () => {
    img.replaceWith(Object.assign(document.createElement("div"), {
      className: "no-image",
      textContent: "Imagen no disponible",
    }));
  };
  return img;
}
 
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
 
/* ------------------------------------------------------------------------
   Modal de detalle de producto
   ------------------------------------------------------------------------ */
function openProductModal(p) {
  const key = productKey(p);
  els.modalBody.innerHTML = "";
 
  const media = document.createElement("div");
  media.className = "modal-media";
  media.appendChild(buildImageEl(p, true));
 
  const info = document.createElement("div");
  info.className = "modal-info";
  info.innerHTML = `
    <h2 id="modal-title">${escapeHtml(p.name)}</h2>
    <span class="modal-category">${escapeHtml(p.category)}</span>
    ${p.subcategory ? `<span class="modal-subcategory">${escapeHtml(p.subcategory)}</span>` : ""}
    <div class="modal-avail-row">${availabilityTagHtml(p)}</div>
    ${p.lab ? `<div class="modal-row"><span class="k">Laboratorio</span><span>${escapeHtml(p.lab)}</span></div>` : ""}
    ${p.description ? `<p class="modal-desc">${escapeHtml(p.description)}</p>` : ""}
  `;
 
  const cartRow = buildCartRow(p, key);
  cartRow.wrapper.querySelector(".card-cart-row").classList.add("modal-cart-row");
  info.appendChild(cartRow.wrapper);
 
  els.modalBody.appendChild(media);
  els.modalBody.appendChild(info);
 
  cartIndicatorEls[key] = cartRow.indicatorEl;
  updateCartIndicator(key);
 
  openModalEl(els.productModal);
}
 
/* ------------------------------------------------------------------------
   Apertura / cierre genérico de modales
   ------------------------------------------------------------------------ */
function openModalEl(modalEl) {
  modalEl.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModalEl(modalEl) {
  modalEl.hidden = true;
  if (els.productModal.hidden && els.cartModal.hidden) {
    document.body.style.overflow = "";
  }
  if (modalEl === els.productModal) renderGrid();
}
 
function setupModalClosers() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModalEl(document.getElementById(btn.dataset.closeModal)));
  });
  [els.productModal, els.cartModal].forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModalEl(overlay);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!els.cartModal.hidden) closeModalEl(els.cartModal);
    else if (!els.productModal.hidden) closeModalEl(els.productModal);
  });
}
 
/* ------------------------------------------------------------------------
   Modal / botón del carrito
   ------------------------------------------------------------------------ */
function setupCartModal() {
  els.cartFab.addEventListener("click", () => {
    renderCartModal();
    openModalEl(els.cartModal);
  });
 
  els.clearCartBtn.addEventListener("click", () => {
    clearCart();
    showCartStatus("Vaciaste tu pedido.", "success");
  });
 
  els.sendGmailBtn.addEventListener("click", openGmailCompose);
}
 
function renderCartModal() {
  const items = Object.entries(cart);
  els.cartItemsEl.innerHTML = "";
  els.cartEmptyEl.hidden = items.length > 0;
 
  items.forEach(([key, entry]) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    // Acá tampoco se muestra el código: la referencia visible para el
    // cliente es la categoría (o subcategoría, si tiene).
    const metaText = entry.product.subcategory || entry.product.category;
    row.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(entry.product.name)}</div>
        <div class="cart-item-meta">${escapeHtml(metaText)}</div>
      </div>
    `;
 
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.className = "cart-item-qty";
    qtyInput.value = String(entry.qty);
    qtyInput.setAttribute("aria-label", `Cantidad de ${entry.product.name}`);
    qtyInput.addEventListener("change", () => {
      const qty = safeInt(qtyInput.value);
      if (qty <= 0) {
        removeFromCart(key);
      } else {
        entry.qty = qty;
        updateCartIndicator(key);
      }
    });
 
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "cart-item-remove";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Quitar ${entry.product.name}`);
    removeBtn.addEventListener("click", () => removeFromCart(key));
 
    row.appendChild(qtyInput);
    row.appendChild(removeBtn);
    els.cartItemsEl.appendChild(row);
  });
}
 
function showCartStatus(msg, type) {
  els.cartStatus.hidden = false;
  els.cartStatus.textContent = msg;
  els.cartStatus.className = "cart-status " + type;
}
function hideCartStatus() {
  els.cartStatus.hidden = true;
}
 
/* ------------------------------------------------------------------------
   Botón "Contacto": baja a la sección de contacto al final de la página.
   ------------------------------------------------------------------------ */
function setupContactFab() {
  els.contactFab.addEventListener("click", () => {
    els.contactSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
 
/* ------------------------------------------------------------------------
   Contacto de la empresa (Instagram, WhatsApp, email, horarios y mapa)
   ------------------------------------------------------------------------ */
function setupCompanyContact() {
  els.contactInstagram.href = CONFIG.COMPANY_INSTAGRAM_URL;
  els.contactInstagramValue.textContent = CONFIG.COMPANY_INSTAGRAM_HANDLE;
 
  els.contactWhatsapp.href = `https://wa.me/${CONFIG.COMPANY_WHATSAPP_NUMBER}`;
  els.contactWhatsappValue.textContent = CONFIG.COMPANY_WHATSAPP_DISPLAY;
 
  els.contactGmail.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONFIG.COMPANY_EMAIL)}&su=${encodeURIComponent(CONFIG.COMPANY_EMAIL)}`;
  els.contactGmailValue.textContent = CONFIG.COMPANY_EMAIL;
 
  els.contactHoursValue.textContent = CONFIG.COMPANY_HOURS;
 
  els.contactAddressValue.textContent = CONFIG.COMPANY_ADDRESS;
  // Ojo: acá se usa COMPANY_MAP_QUERY (coordenadas), no COMPANY_ADDRESS
  // (texto) — es lo que evita que aparezcan varias ubicaciones posibles.
  const encodedQuery = encodeURIComponent(CONFIG.COMPANY_MAP_QUERY);
  els.contactMapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  els.contactMapIframe.src = `https://www.google.com/maps?q=${encodedQuery}&output=embed`;
}
 
/* ------------------------------------------------------------------------
   Banner de estado del catálogo
   ------------------------------------------------------------------------ */
function showStatus(msg, type) {
  els.statusBanner.hidden = false;
  els.statusBanner.textContent = msg;
  els.statusBanner.className = "status-banner" + (type === "info" ? " info" : "");
}
function hideStatus() {
  els.statusBanner.hidden = true;
}
