/* js/app.js
   Chargement produits depuis produits.json (fetch) avec fallback inline.
   Panier (localStorage), ajout, modifier qty, retirer, clear, valider (modal recap).
   Fonction globale ajouterArticle(name, price) exposée pour compat HTML.
*/

(() => {
  // DOM
  const productsList = document.getElementById('productsList');
  const cartItemsEl = document.getElementById('cartItems');
  const totalPriceEl = document.getElementById('totalPrice');
  const clearCartBtn = document.getElementById('clearCartBtn');
  const validateCartBtn = document.getElementById('validateCartBtn');

  const productForm = document.getElementById('productForm');
  const reloadProductsBtn = document.getElementById('reloadProductsBtn');
  const filterBtn = document.getElementById('filterBtn');
  const showAllBtn = document.getElementById('showAllBtn');
  const thresholdInput = document.getElementById('threshold');

  // modal
  const modalOverlay = document.getElementById('modalOverlay');
  const orderRecap = document.getElementById('orderRecap');
  const confirmOrderBtn = document.getElementById('confirmOrderBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // storage key
  const STORAGE_KEY = 'marché_panier_v1';

  // data
  let products = []; // {name, price, qty, image}
  let cart = {}; // key -> {name, price, qty, img}

  // helpers
  const fmt = (n) => Number(n).toLocaleString();

  function saveCart(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); }
  function loadCart(){ try{ cart = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e){ cart = {}; } }

  // fetch produits.json with fallback to inline <script id="produits-data">
  async function loadProducts() {
    try {
      const resp = await fetch('produit.json', {cache: "no-store"});
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      products = data.map(p => normalizeProduct(p));
    } catch (err) {
      // fallback inline JSON in HTML
      const el = document.getElementById('produits-data');
      if (el) {
        try {
          const inline = JSON.parse(el.textContent);
          products = inline.map(p => normalizeProduct(p));
        } catch (e) {
          console.error('Impossible de parser produits inline', e);
          products = [];
        }
      } else {
        console.error('Erreur chargement produit.json', err);
        products = [];
      }
    }
    renderProducts();
  }

  function normalizeProduct(p){
    return {
      name: String(p.name || p.nom || 'Produit'),
      price: Number(p.price || p.prix || 0),
      qty: Number(p.qty || p.quantity || 0),
      image: p.image ? String(p.image) : ''
    };
  }

  // render des produits (carrousel horizontal)
  function renderProducts(filterThreshold = null) {
    productsList.innerHTML = '';
    if (!products.length) {
      productsList.innerHTML = '<div class="empty">Aucun produit</div>';
      return;
    }

    products.forEach((p, idx) => {
      if (filterThreshold != null && p.qty >= filterThreshold) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.index = idx;
      card.innerHTML = `
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.src='https://via.placeholder.com/420x300?text=${encodeURIComponent(p.name)}'">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="price">${fmt(p.price)} FCFA</div>
        <div class="stock">Stock: <strong>${p.qty}</strong></div>
        <div class="actions">
          <input class="qty" type="number" min="1" value="1" />
          <button class="addBtn">Ajouter au panier</button>
        </div>
      `;
      productsList.appendChild(card);
    });
  }

  function escapeHtml(s){ if (s==null) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // find product image by name (used for cart if adding by name)
  function findImage(name){
    const p = products.find(x => x.name.toLowerCase() === name.toLowerCase());
    return (p && p.image) ? p.image : `https://via.placeholder.com/120x90?text=${encodeURIComponent(name)}`;
  }

  // productKey to identify cart entries (name + price)
  function productKey(name, price){ return `${name.trim().toLowerCase()}__${Number(price)}`; }

  // ajouterArticle exposée pour compatibilité inline (et utilisée par addBtn)
  window.ajouterArticle = function(name, price) {
    const key = productKey(name, price);
    if (!cart[key]) {
      cart[key] = { name, price: Number(price), qty: 1, img: findImage(name) };
    } else {
      cart[key].qty += 1;
    }
    saveCart();
    renderCart();
  };

  // render cart
  function renderCart(){
    cartItemsEl.innerHTML = '';
    const keys = Object.keys(cart);
    if (!keys.length) {
      cartItemsEl.innerHTML = '<div class="empty">Ton panier est vide</div>';
      totalPriceEl.textContent = '0';
      return;
    }

    let total = 0;
    keys.forEach(key => {
      const p = cart[key];
      const sub = p.price * p.qty;
      total += sub;
      const node = document.createElement('div');
      node.className = 'cart-item';
      node.dataset.key = key;
      node.innerHTML = `
        <img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" onerror="this.src='https://via.placeholder.com/120x90?text=${encodeURIComponent(p.name)}'"/>
        <div class="info">
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="sub">${fmt(p.price)} FCFA le kg • Sous-total: ${fmt(sub)} FCFA le kg</div>
        </div>
        <div class="qty-controls">
          <button class="dec">-</button>
          <input type="number" class="qty" value="${p.qty}" min="1" />
          <button class="inc">+</button>
          <button class="remove" title="Retirer" style="background:#fee2e2;color:#b91c1c;border:none;border-radius:6px;padding:6px 8px;cursor:pointer;margin-left:6px">✕</button>
        </div>
      `;
      cartItemsEl.appendChild(node);
    });
    totalPriceEl.textContent = fmt(total);
  }

  // délégation pour boutons inside productsList (Commander)
  productsList.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.addBtn');
    if (!btn) return;
    const card = btn.closest('.card');
    const idx = Number(card.dataset.index);
    const qtyInput = card.querySelector('.qty');
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const prod = products[idx];
    if (!prod) return;
    if (qty > prod.qty) { alert('Stock insuffisant'); return; }
    // decrement product stock
    prod.qty -= qty;
    // add to cart
    const key = productKey(prod.name, prod.price);
    if (!cart[key]) cart[key] = { name: prod.name, price: prod.price, qty: qty, img: prod.image || findImage(prod.name) };
    else cart[key].qty += qty;
    saveCart();
    renderProducts(); // update stock display
    renderCart();
  });

  // délégation pour cart interactions
  cartItemsEl.addEventListener('click', (ev) => {
    const btn = ev.target;
    const item = btn.closest('.cart-item');
    if (!item) return;
    const key = item.dataset.key;
    if (!key || !cart[key]) return;
    if (btn.classList.contains('inc')) { cart[key].qty += 1; saveCart(); renderCart(); }
    else if (btn.classList.contains('dec')) { if (cart[key].qty > 1) { cart[key].qty -= 1; saveCart(); renderCart(); } }
    else if (btn.classList.contains('remove')) { delete cart[key]; saveCart(); renderCart(); }
  });

  // input change in cart qty
  cartItemsEl.addEventListener('input', (ev) => {
    if (!ev.target.classList.contains('qty')) return;
    const item = ev.target.closest('.cart-item');
    const key = item.dataset.key;
    let v = parseInt(ev.target.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    cart[key].qty = v;
    saveCart(); renderCart();
  });

  // clear cart
  clearCartBtn.addEventListener('click', () => {
    if (!confirm('Vider le panier ?')) return;
    cart = {}; saveCart(); renderCart();
  });

  // validate -> show modal recap
  validateCartBtn.addEventListener('click', () => {
    const keys = Object.keys(cart);
    if (!keys.length) { alert('Panier vide'); return; }
    let recap = '';
    let total = 0;
    keys.forEach(k => {
      const p = cart[k];
      recap += `• ${p.name} x${p.qty} → ${fmt(p.price * p.qty)} FCFA\n`;
      total += p.price * p.qty;
    });
    recap += `\nTotal: ${fmt(total)} FCFA`;
    orderRecap.textContent = recap;
    openModal();
  });

  // modal controls
  function openModal(){ modalOverlay.style.display = 'flex'; modalOverlay.setAttribute('aria-hidden','false'); }
  function closeModal(){ modalOverlay.style.display = 'none'; modalOverlay.setAttribute('aria-hidden','true'); }

  closeModalBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  // confirm order: simulate, clear cart and close modal
  confirmOrderBtn.addEventListener('click', () => {
    alert('Commande confirmée. Merci !');
    cart = {}; saveCart(); renderCart();
    closeModal();
  });

  // form add product (optional)
  productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('inputName').value.trim();
    const price = Number(document.getElementById('inputPrice').value);
    const qty = Number(document.getElementById('inputQty').value);
    const image = document.getElementById('inputImage').value.trim();
    if (!name || isNaN(price) || isNaN(qty)) { alert('Remplis correctement le formulaire'); return; }
    products.push({ name, price, qty, image });
    renderProducts();
    productForm.reset();
  });

  // reload products from produits.json (revert to server/inline source)
  reloadProductsBtn.addEventListener('click', () => {
    if (!confirm('Recharger produits depuis produits.json (remplacera la liste actuelle) ?')) return;
    loadProducts();
  });

  // filters
  filterBtn.addEventListener('click', () => {
    const t = parseInt(thresholdInput.value, 10);
    if (isNaN(t)) return;
    renderProducts(t);
  });
  showAllBtn.addEventListener('click', () => renderProducts());

  // init
  function init(){
    loadCart();
    loadProducts().then(() => {
      renderCart();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
