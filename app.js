/* app.js
   Gère le panier pour le HTML déjà fourni.
   - Fonction globale ajouterArticle(name, price) (appelée depuis ton HTML)
   - Construction automatique d'une "mini-fiche produit" depuis la DOM
   - Rendu du panier, modification quantités, suppression, clear, persistence localStorage
*/

(() => {
  // --- Sélecteurs (correspondent au HTML fourni)
  const productsContainer = document.querySelectorAll('.item'); // NodeList des cartes produits
  const cartItemsEl = document.getElementById('cartItems');
  const totalPriceEl = document.getElementById('totalPrice');
  const clearCartBtn = document.getElementById('clearCartBtn');

  // --- LocalStorage key
  const KEY = 'panier_simple_v1';

  // --- Panier en mémoire : { key: {name, price, qty, img} }
  // key = slug (name sans espaces + price) to identify uniquely
  let cart = {};

  // --- Utilitaires
  function formatNum(n){ 
    return Number(n).toLocaleString(); 
  }
  function saveCart(){
    localStorage.setItem(KEY, JSON.stringify(cart)); 
  }
  function loadCart(){
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { 
        cart = JSON.parse(raw) || {}; 
      } catch(e){ 
        cart = {};
      }
    }
  }

  // Trouve l'image d'un produit en cherchant la carte qui a le même nom (h3)
  function findImageForName(name){
    for (const el of productsContainer) {
      const h = el.querySelector('h3');
      if (h && h.textContent.trim().toLowerCase() === String(name).trim().toLowerCase()) {
        const img = el.querySelector('img');
        if (img) {
          return img.getAttribute('src') || img.src;
        }
      }
    }
    // fallback placeholder
    return `https://via.placeholder.com/120x90?text=${encodeURIComponent(name)}`;
  }

  // key de produit (évite collision si même nom mais même prix)
  function productKey(name, price){
    return `${String(name).trim().toLowerCase()}__${Number(price)}`;
  }

  // --- Fonction exposée (appelée inline depuis ton HTML)
  window.ajouterArticle = function(name, price){
    // normalize
    const nm = String(name).trim();
    const pr = Number(price);
    if (!nm || isNaN(pr) || pr < 0) {
      alert('Produit invalide'); return;
    }

    const key = productKey(nm, pr);
    if (!cart[key]) {
      cart[key] = { name: nm, price: pr, qty: 1, img: findImageForName(nm) };
    } else {
      cart[key].qty += 1;
    }

    saveCart();
    renderCart();
  };

  
// Sélecteur du container produits
const productsSection = document.querySelector(".products");

// Charger produits depuis produits.json
function chargerProduits() {
  fetch("produits.json")
    .then(res => res.json())
    .then(data => {
      afficherProduits(data);
    })
    .catch(err => {
      console.error("Erreur chargement produits.json", err);
      productsSection.innerHTML += "<p style='color:red'>Impossible de charger les produits.</p>";
    });
}

// Générer le HTML des produits
function afficherProduits(produits) {
  const container = document.createElement("div");
  container.classList.add("list");

  produits.forEach(p => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <img src="${p.image}" alt="${p.name}" width="80" height="100">
      <div class="meta">
        <h3>${p.name}</h3>
        <h4>${p.price} FCFA</h4>
        <button onclick="ajouterArticle('${p.name}', ${p.price})">Commander</button>
      </div>
    `;
    container.appendChild(item);
  });

  productsSection.appendChild(container);
}

// Appeler le chargement au démarrage
document.addEventListener("DOMContentLoaded", chargerProduits);



  // --- Rendu du panier
  function renderCart(){
    cartItemsEl.innerHTML = '';
    const keys = Object.keys(cart);
    if (keys.length === 0) {
      cartItemsEl.innerHTML = '<div class="empty">Ton panier est vide</div>';
      totalPriceEl.textContent = '0';
      return;
    }

    let total = 0;
    for (const key of keys) {
      const p = cart[key];
      const subtotal = p.qty * p.price;
      total += subtotal;

      const item = document.createElement('div');
      item.className = 'cart-item';
      item.dataset.key = key;
      item.innerHTML = `
        <img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}"/>
        <div class="info">
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="sub">${formatNum(p.price)} FCFA • Sous-total: ${formatNum(subtotal)} FCFA</div>
        </div>
        <div class="qty-controls">
          <button class="dec">-</button>
          <input type="number" class="qty" value="${p.qty}" min="1" />
          <button class="inc">+</button>
          <button class="remove" title="Retirer" style="margin-left:8px;background:#fee2e2;color:${'#b91c1c'};border-radius:6px;padding:6px 8px;border:none;cursor:pointer">✕</button>
        </div>
      `;
      cartItemsEl.appendChild(item);
    }

    totalPriceEl.textContent = formatNum(total);
  }

  // simple escape pour src/texte
  function escapeHtml(s){
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // --- Écouteurs (délégation sur cartItems)
  cartItemsEl.addEventListener('click', (ev) => {
    const target = ev.target;
    const card = target.closest('.cart-item');
    if (!card) return;
    const key = card.dataset.key;
    if (!key || !cart[key]) return;

    if (target.classList.contains('inc')) {
      cart[key].qty += 1;
      saveCart(); renderCart();
    } else if (target.classList.contains('dec')) {
      if (cart[key].qty > 1) { cart[key].qty -= 1; saveCart(); renderCart(); }
    } else if (target.classList.contains('remove')) {
      delete cart[key]; saveCart(); renderCart();
    }
  });

  // input change (qty edits)
  cartItemsEl.addEventListener('input', (ev) => {
    if (!ev.target.classList.contains('qty')) return;
    const card = ev.target.closest('.cart-item');
    const key = card?.dataset.key;
    if (!key || !cart[key]) return;
    let v = parseInt(ev.target.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    cart[key].qty = v;
    saveCart();
    renderCart();
  });

  // Clear panier
  clearCartBtn?.addEventListener('click', () => {
    if (!confirm('Vider entièrement le panier ?')) return;
    cart = {};
    saveCart(); renderCart();
  });

  // --- Init : load et render
  function init(){
    loadCart();
    renderCart();

    // remplacer les onclick inline (optionnel) : si tu veux, on peut aussi attacher listeners modernes
    // mais on laisse la fonction globale ajouterArticle pour compatibilité
    // Désactivation visuelle des "Commander" si image/non dispo ? (non nécessaire)
  }

  document.addEventListener('DOMContentLoaded', init);
})();
