/**
 * عطورات اترند - ATRAND LUXURY PERFUMES
 * الملف البرمجي الرئيسي للواجهة الملكية، السلة الذكية، شريط العروض المتحركة، والطلب عبر الواتساب (محدث مع Supabase)
 * رقم المتجر المعتمد: +966568009474
 */

const WHATSAPP_PHONE = "966568009474";
const CART_STORAGE_KEY = "atrand_cart_items";

// إعدادات اتصال Supabase السحابي
const SUPABASE_URL = "https://iceianuxbnhnpeupbbrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_syiACLwvd6tIh7moWlWSdA_OXJ5o5KX";

// تهيئة عميل Supabase
let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// حالة المتجر الحالية
let currentCategoryFilter = "all";
let currentSearchQuery = "";
let currentSortOrder = "newest";
let activeModalProduct = null;
let modalProductQuantity = 1;

// ذاكرة المنتجات المؤقتة التي يتم جلبها من Supabase
let cachedProducts = [];

// سلة التسوق
let cart = [];

// جلب المنتجات من جدول perfumes في Supabase
async function fetchProductsFromSupabase() {
  if (!supabaseClient) {
    console.error("مكتبة Supabase غير محملة");
    return [];
  }
  try {
    const { data, error } = await supabaseClient
      .from('perfumes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("خطأ في جلب المنتجات من Supabase:", error.message);
      return [];
    }
    cachedProducts = data || [];
    return cachedProducts;
  } catch (err) {
    console.error("خطأ غير متوقع:", err);
    return [];
  }
}

// دالة مساعدة للحصول على المنتجات
window.getStoredProducts = function() {
  return cachedProducts;
};

// تحميل السلة من التخزين المحلي
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      cart = JSON.parse(raw);
    } else {
      cart = [];
    }
  } catch (e) {
    cart = [];
  }
  updateCartBadge();
}

// حفظ السلة في التخزين المحلي
function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    console.error("خطأ في حفظ السلة", e);
  }
  updateCartBadge();
  renderCartDrawer();
}

// إضافة منتج إلى السلة
function addToCart(productId, quantity = 1) {
  const product = cachedProducts.find(p => p.id === productId);
  if (!product) return;

  const effectivePrice = calculateEffectivePrice(product.price, product.discount);
  const existingIndex = cart.findIndex(item => item.id === productId);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      category: product.category,
      price: Number(product.price),
      discount: Number(product.discount || 0),
      effectivePrice: effectivePrice,
      image: product.image,
      size: product.size || "100 مل",
      type: product.type || "EDP",
      quantity: quantity
    });
  }

  saveCart();
  showToast(`تمت إضافة "${product.name}" إلى سلة التسوق`, "success");

  const droplet = document.getElementById("cartCountBadge");
  if (droplet) {
    droplet.classList.remove("pulsing");
    void droplet.offsetWidth;
    droplet.classList.add("pulsing");
  }
}

// تعديل كمية عنصر في السلة
function updateCartItemQuantity(productId, newQty) {
  const index = cart.findIndex(item => item.id === productId);
  if (index === -1) return;

  if (newQty <= 0) {
    removeFromCart(productId);
  } else {
    cart[index].quantity = newQty;
    saveCart();
  }
}

// حذف منتج من السلة
function removeFromCart(productId) {
  const item = cart.find(i => i.id === productId);
  const name = item ? item.name : "المنتج";
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  showToast(`تمت إزالة "${name}" من السلة`, "info");
}

function clearCart() {
  cart = [];
  saveCart();
}

// حساب السعر بعد الخصم
function calculateEffectivePrice(price, discount) {
  const p = Number(price) || 0;
  const d = Number(discount) || 0;
  if (d > 0) {
    const discounted = p - (p * (d / 100));
    return Math.round(discounted * 100) / 100;
  }
  return p;
}

// تحديث شارة السلة
function updateCartBadge() {
  const badge = document.getElementById("cartCountBadge");
  const valueEl = document.getElementById("cartCountValue");
  if (badge && valueEl) {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    valueEl.textContent = totalCount;
    badge.style.display = totalCount > 0 ? "flex" : "none";
  }
}

// عرض سلة التسوق الجانبية
function renderCartDrawer() {
  const listEl = document.getElementById("cartItemsList");
  const subtotalEl = document.getElementById("cartSubtotal");
  const discountEl = document.getElementById("cartDiscountTotal");
  const totalEl = document.getElementById("cartGrandTotal");
  const checkoutBtn = document.getElementById("btnProceedCheckout");

  if (!listEl) return;

  if (cart.length === 0) {
    listEl.innerHTML = `
      <div class="cart-empty-view">
        <svg width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        <h4 style="font-size: 1.15rem; color: var(--gold-light);">سلة التسوق فارغة</h4>
        <p style="font-size: 0.88rem;">استمتع بتصفح التشكيلة الملكية لعطورات اترند وأضف ما يناسب ذوقك الرفيع.</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = "0 ر.س";
    if (discountEl) discountEl.textContent = "0 ر.س";
    if (totalEl) totalEl.textContent = "0 ر.س";
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  let totalOriginal = 0;
  let totalEffective = 0;

  listEl.innerHTML = cart.map(item => {
    const itemOrigTotal = item.price * item.quantity;
    const itemEffTotal = item.effectivePrice * item.quantity;
    totalOriginal += itemOrigTotal;
    totalEffective += itemEffTotal;

    const defaultImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' fill='%23d4af37' viewBox='0 0 24 24'><path d='M12 2a3 3 0 0 0-3 3v1H7a2 2 0 0 0-2 2v2a7 7 0 0 0 5 6.7V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-2v-2.3A7 7 0 0 0 19 10V8a2 2 0 0 0-2-2h-2V5a3 3 0 0 0-3-3z'/></svg>";
    const imgSrc = item.image || defaultImg;

    return `
      <div class="cart-item">
        <div class="cart-item-img">
          <img src="${imgSrc}" alt="${escapeHtml(item.name)}" onerror="this.src='${defaultImg}'" />
        </div>
        <div class="cart-item-info">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="cart-item-title">${escapeHtml(item.name)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(item.size)} • ${escapeHtml(item.type || "EDP")}</div>
            </div>
            <button class="cart-item-remove" title="حذف" onclick="removeFromCart('${item.id}')">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="cart-item-controls">
            <div class="qty-stepper" style="width: 90px; height: 28px; padding: 2px;">
              <button class="qty-btn" style="width: 24px; height: 24px; font-size: 0.8rem;" onclick="updateCartItemQuantity('${item.id}', ${item.quantity - 1})">-</button>
              <span class="qty-display" style="font-size: 0.85rem;">${item.quantity}</span>
              <button class="qty-btn" style="width: 24px; height: 24px; font-size: 0.8rem;" onclick="updateCartItemQuantity('${item.id}', ${item.quantity + 1})">+</button>
            </div>
            <div class="cart-item-price">${itemEffTotal.toLocaleString()} ر.س</div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const discountSavings = totalOriginal - totalEffective;

  if (subtotalEl) subtotalEl.textContent = `${totalOriginal.toLocaleString()} ر.س`;
  if (discountEl) discountEl.textContent = `${discountSavings.toLocaleString()} ر.س`;
  if (totalEl) totalEl.textContent = `${totalEffective.toLocaleString()} ر.س`;
  if (checkoutBtn) checkoutBtn.disabled = false;
}

function openCartDrawer() {
  const drawer = document.getElementById("cartDrawerOverlay");
  if (drawer) {
    renderCartDrawer();
    drawer.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById("cartDrawerOverlay");
  if (drawer) {
    drawer.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// طلب السلة الشاملة عبر الواتساب
function proceedCartOrderViaWhatsApp() {
  if (cart.length === 0) {
    showToast("سلة التسوق فارغة", "error");
    return;
  }

  const notesInput = document.getElementById("cartDrawerSpecialNotes");
  const specialNotes = notesInput ? notesInput.value.trim() : "";

  let grandTotal = 0;
  let itemsListText = [];

  cart.forEach((item, index) => {
    const itemTotal = item.effectivePrice * item.quantity;
    grandTotal += itemTotal;
    itemsListText.push(`${index + 1}. عطر ${item.name} (عدد ${item.quantity}) - السعر: ${itemTotal.toLocaleString()} ر.س`);
  });

  let msg = `السلام عليكم، أود طلب المنتجات التالية من المتجر:\n`;
  msg += itemsListText.join("\n") + `\n`;
  msg += `الإجمالي: ${grandTotal.toLocaleString()} ر.س\n`;

  if (specialNotes) {
    msg += `ملاحظات: ${specialNotes}\n`;
  } else {
    msg += `ملاحظات: أرجو إفادتي بتوافر المنتجات وطرق الدفع.\n`;
  }
  msg += `عنوان الشحن الخاص بي هو: ...`;

  const encoded = encodeURIComponent(msg);
  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encoded}`;

  window.open(whatsappUrl, "_blank");
  closeCartDrawer();
  clearCart();
  showToast("تم تحويل طلبك مباشرة إلى الواتساب، شكراً لثقتك بعطورات اترند!", "success");
}

// طلب عطر منفرد عبر الواتساب
function orderSingleProductViaWhatsApp(productId) {
  const product = cachedProducts.find(p => p.id === productId);
  if (!product) return;

  const effectivePrice = calculateEffectivePrice(product.price, product.discount);
  let msg = `السلام عليكم، أود طلب هذا العطر مباشرة من متجر عطورات اترند:\n`;
  msg += `• عطر: ${product.name} (${product.size || "100 مل"})\n`;
  msg += `• السعر: ${effectivePrice.toLocaleString()} ر.س\n`;
  msg += `أرجو تزويدي بتفاصيل التوصيل وحساب الدفع.`;

  const encoded = encodeURIComponent(msg);
  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encoded}`;

  window.open(whatsappUrl, "_blank");
  showToast(`جاري تحويلك لطلب "${product.name}" عبر الواتساب...`, "success");
}

function orderBannerViaWhatsApp(whatsappText) {
  const textToSend = whatsappText || "السلام عليكم، أود الاستفسار عن العرض الإعلاني في المتجر";
  const encoded = encodeURIComponent(textToSend);
  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encoded}`;
  window.open(whatsappUrl, "_blank");
  showToast("جاري تحويلك لطلب العرض عبر الواتساب...", "success");
}

function consultExpertForProduct(productId) {
  const product = cachedProducts.find(p => p.id === productId);
  if (!product) return;

  let msg = `السلام عليكم، أود استشارة الخبير العطري بخصوص عطر *${product.name}* لمعرفة المزيد عن ثباته وفوحانه.`;
  const encoded = encodeURIComponent(msg);
  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encoded}`;
  window.open(whatsappUrl, "_blank");
}

// ==========================================
// عرض المنتجات في الواجهة
// ==========================================
async function renderProductsList() {
  const container = document.getElementById("productsGridContainer");
  const countDisplay = document.getElementById("productsCountDisplay");
  if (!container) return;

  // جلب أحدث المنتجات من Supabase
  const allProducts = await fetchProductsFromSupabase();

  let filtered = allProducts.filter(p => {
    if (currentCategoryFilter === "all") return true;
    if (currentCategoryFilter === "offers") {
      return (p.discount && Number(p.discount) > 0) || (p.offer && p.offer.trim() !== "");
    }
    return p.category === currentCategoryFilter;
  });

  if (currentSearchQuery.trim() !== "") {
    const q = currentSearchQuery.trim().toLowerCase();
    filtered = filtered.filter(p => {
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }

  if (currentSortOrder === "price-low") {
    filtered.sort((a, b) => calculateEffectivePrice(a.price, a.discount) - calculateEffectivePrice(b.price, b.discount));
  } else if (currentSortOrder === "price-high") {
    filtered.sort((a, b) => calculateEffectivePrice(b.price, b.discount) - calculateEffectivePrice(a.price, a.discount));
  } else {
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  if (countDisplay) {
    countDisplay.textContent = `(${filtered.length} عطر متوفر)`;
  }

  if (filtered.length === 0) {
    if (allProducts.length === 0) {
      container.innerHTML = `
        <div class="empty-store-state">
          <div class="empty-icon-circle">
            <svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v1H7a2 2 0 0 0-2 2v2a7 7 0 0 0 5 6.7V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-2v-2.3A7 7 0 0 0 19 10V8a2 2 0 0 0-2-2h-2V5a3 3 0 0 0-3-3z"/></svg>
          </div>
          <h3>متجر عطورات اترند جاهز لإضافة منتجاتك</h3>
          <p>المتجر فارغ حالياً. يمكنك تسجيل الدخول إلى لوحة التحكم كمدير للبدء بإضافة العطورات وتخصيص الأسعار عبر سحابة Supabase.</p>
          <button class="btn-gold" onclick="openAdminLoginModal()">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
            <span>تسجيل الدخول كمدير للمتجر</span>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-store-state">
          <div class="empty-icon-circle">
            <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h3>لم نعثر على أي عطور مطابقة للبحث</h3>
          <p>جرب البحث بكلمات مختلفة أو اختر قسماً آخر.</p>
          <button class="btn-gold" onclick="resetFilters()">عرض كافة العطور</button>
        </div>
      `;
    }
    return;
  }

  const defaultImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' fill='%23d4af37' viewBox='0 0 24 24'><path d='M12 2a3 3 0 0 0-3 3v1H7a2 2 0 0 0-2 2v2a7 7 0 0 0 5 6.7V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-2v-2.3A7 7 0 0 0 19 10V8a2 2 0 0 0-2-2h-2V5a3 3 0 0 0-3-3z'/></svg>";

  container.innerHTML = filtered.map(prod => {
    const effectivePrice = calculateEffectivePrice(prod.price, prod.discount);
    const hasDiscount = Number(prod.discount) > 0;
    const hasOffer = prod.offer && prod.offer.trim() !== "";
    const badgeType = prod.badge_tag || (hasDiscount ? "خصم" : (hasOffer ? "عرض" : ""));
    const imgSrc = prod.image || defaultImg;

    const topShort = prod.top_notes ? prod.top_notes.split("،")[0] : "البرغموت";
    const heartShort = prod.heart_notes ? prod.heart_notes.split("،")[0] : "الياسمين";
    const baseShort = prod.base_notes ? prod.base_notes.split("،")[0] : "خشب الصندل";

    return `
      <div class="product-card" onclick="openProductModal('${prod.id}')">
        <div class="card-badges">
          ${badgeType === "bestseller" ? `<span class="badge-bestseller">الأكثر مبيعاً ⭐</span>` : ""}
          ${badgeType === "limited" ? `<span class="badge-limited">إصدار محدود 👑</span>` : ""}
          ${hasDiscount ? `<span class="badge-discount">خصم ${prod.discount}%</span>` : ""}
          ${hasOffer && badgeType !== "limited" ? `<span class="badge-offer">${escapeHtml(prod.offer)}</span>` : ""}
        </div>

        <div class="card-img-wrapper">
          <img src="${imgSrc}" alt="${escapeHtml(prod.name)}" loading="lazy" onerror="this.src='${defaultImg}'" />
        </div>

        <div class="card-body">
          <div class="card-meta">
            <span class="card-category">${escapeHtml(prod.category || "عطور فاخرة")}</span>
            <span class="card-size">${escapeHtml(prod.size || "100 مل")}</span>
          </div>

          <h3 class="card-title">عطر "${escapeHtml(prod.name)}" - ${escapeHtml(prod.type || "EDP")}</h3>

          <div class="mini-notes-line">
            <span>🍊 ${escapeHtml(topShort)}</span> •
            <span>🌸 ${escapeHtml(heartShort)}</span> •
            <span>🪵 ${escapeHtml(baseShort)}</span>
          </div>

          <div class="card-footer" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div class="price-box">
                <div class="current-price">${effectivePrice.toLocaleString()} <span>ر.س</span></div>
                ${hasDiscount ? `<div class="old-price">${Number(prod.price).toLocaleString()} ر.س</div>` : ""}
              </div>
              <span style="font-size: 0.75rem; color: var(--gold-light); font-weight: 600;">التوصيل مجاني داخل الرياض</span>
            </div>

            <div class="card-actions-duo">
              <button class="btn-card-cart" onclick="event.stopPropagation(); addToCart('${prod.id}', 1)" title="إضافة إلى السلة">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                <span>أضف للسلة</span>
              </button>
              <button class="btn-card-whatsapp-quick" onclick="event.stopPropagation(); orderSingleProductViaWhatsApp('${prod.id}')" title="اطلب مباشرة عبر الواتساب">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824z"/></svg>
                <span>طلب بالواتساب</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// نافذة تفاصيل العطر
function openProductModal(productId) {
  const product = cachedProducts.find(p => p.id === productId);
  if (!product) return;

  activeModalProduct = product;
  modalProductQuantity = 1;

  const modal = document.getElementById("productDetailModal");
  if (!modal) return;

  const effectivePrice = calculateEffectivePrice(product.price, product.discount);
  const defaultImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300' fill='%23d4af37' viewBox='0 0 24 24'><path d='M12 2a3 3 0 0 0-3 3v1H7a2 2 0 0 0-2 2v2a7 7 0 0 0 5 6.7V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-2v-2.3A7 7 0 0 0 19 10V8a2 2 0 0 0-2-2h-2V5a3 3 0 0 0-3-3z'/></svg>";
  const imgSrc = product.image || defaultImg;

  document.getElementById("modalProductImg").src = imgSrc;
  document.getElementById("modalProductTitle").textContent = `عطر "${product.name}"`;
  document.getElementById("modalProductCategory").textContent = product.category || "عطور فاخرة";
  document.getElementById("modalProductSize").textContent = product.size || "100 مل";
  
  const typeEl = document.getElementById("modalProductType");
  if (typeEl) typeEl.textContent = product.type || "EDP";

  document.getElementById("modalProductCurrentPrice").textContent = `${effectivePrice.toLocaleString()} ر.س`;
  
  const oldPriceEl = document.getElementById("modalProductOldPrice");
  if (Number(product.discount) > 0) {
    oldPriceEl.textContent = `${Number(product.price).toLocaleString()} ر.س`;
    oldPriceEl.style.display = "inline";
  } else {
    oldPriceEl.style.display = "none";
  }

  const badgesBox = document.getElementById("modalProductBadges");
  badgesBox.innerHTML = "";
  if (product.badge_tag === "bestseller") badgesBox.innerHTML += `<span class="badge-bestseller">الأكثر مبيعاً ⭐</span>`;
  else if (product.badge_tag === "limited") badgesBox.innerHTML += `<span class="badge-limited">إصدار محدود 👑</span>`;
  if (Number(product.discount) > 0) badgesBox.innerHTML += `<span class="badge-discount">خصم ${product.discount}%</span>`;

  document.getElementById("pyramidTopNotes").textContent = product.top_notes || "برغموت، هيل، زعفران";
  document.getElementById("pyramidHeartNotes").textContent = product.heart_notes || "ورد طائفي، ياسمين";
  document.getElementById("pyramidBaseNotes").textContent = product.base_notes || "عود معتق، عنبر، مسك";

  document.getElementById("valLongevity").textContent = `${product.longevity || 98}%`;
  document.getElementById("valSillage").textContent = `${product.sillage || 95}%`;
  document.getElementById("valOccasion").textContent = product.occasion || "سهرات ومناسبات خاصة";

  document.getElementById("modalProductDesc").textContent = product.description || "عطر فاخر مصنوع بعناية فائقة من أجود الزيوت العطرية.";

  const consultBtn = document.getElementById("btnModalConsultWhatsapp");
  if (consultBtn) consultBtn.onclick = () => consultExpertForProduct(product.id);

  updateModalQuantityDisplay();
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  const modal = document.getElementById("productDetailModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
  activeModalProduct = null;
}

function updateModalQuantityDisplay() {
  const qtyEl = document.getElementById("modalProductQty");
  if (qtyEl) qtyEl.textContent = modalProductQuantity;
}

function stepModalQuantity(delta) {
  modalProductQuantity = Math.max(1, modalProductQuantity + delta);
  updateModalQuantityDisplay();
}

function addModalProductToCart() {
  if (!activeModalProduct) return;
  addToCart(activeModalProduct.id, modalProductQuantity);
  closeProductModal();
}

function filterCategoryFromNav(categoryName, element) {
  currentCategoryFilter = categoryName;
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  if (element) element.classList.add("active");

  document.querySelectorAll(".filter-pill").forEach(p => {
    if (p.getAttribute("data-category") === categoryName) p.classList.add("active");
    else p.classList.remove("active");
  });

  renderProductsList();
  const catSection = document.getElementById("catalogSection");
  if (catSection) catSection.scrollIntoView({ behavior: "smooth" });
}

function resetFilters() {
  currentCategoryFilter = "all";
  currentSearchQuery = "";
  document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
  const allPill = document.querySelector('.filter-pill[data-category="all"]');
  if (allPill) allPill.classList.add("active");
  renderProductsList();
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let icon = "";
  if (type === "success") icon = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`;
  else if (type === "error") icon = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  else icon = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// شريط العروض المتحركة
let currentBannerIndex = 0;
let bannerAutoTimer = null;
const BANNER_INTERVAL_MS = 2000;

function renderTopBannersSlider() {
  const track = document.getElementById('bannersSliderTrack');
  const dotsContainer = document.getElementById('bannersDotsContainer');
  const section = document.getElementById('topBannersSliderSection');

  if (!track || !dotsContainer) return;

  const banners = window.getStoredBanners ? window.getStoredBanners() : [];
  
  if (!banners || banners.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = 'block';

  track.innerHTML = banners.map((b, idx) => {
    const isActive = idx === currentBannerIndex;
    const defaultImg = "assets/images/logo.png";
    const imgSrc = b.image || defaultImg;

    return `
      <div class="banner-slide ${isActive ? 'active' : ''}" data-index="${idx}">
        <div class="banner-blur-bg" style="background-image: url('${imgSrc}');"></div>
        <div class="banner-overlay-tint"></div>

        <div class="banner-slide-content">
          <div class="banner-tag-pill">${escapeHtml(b.tag || 'عرض حصري')}</div>
          <h2 class="banner-slide-title">${escapeHtml(b.title)}</h2>
          ${b.subtitle ? `<p class="banner-slide-subtitle">${escapeHtml(b.subtitle)}</p>` : ''}
          
          <div class="banner-action-row">
            <button class="btn-gold banner-whatsapp-btn" onclick="orderBannerViaWhatsApp('${escapeHtml(b.whatsappMessage || b.title)}')">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824z"/></svg>
              <span>${escapeHtml(b.buttonText || 'اطلب العرض بالواتساب')}</span>
            </button>
          </div>
        </div>

        <div class="banner-full-img-stage">
          <img src="${imgSrc}" alt="${escapeHtml(b.title)}" class="banner-full-image" onerror="this.src='${defaultImg}'" />
        </div>
      </div>
    `;
  }).join("");

  dotsContainer.innerHTML = banners.map((b, idx) => {
    const isActive = idx === currentBannerIndex;
    return `
      <button class="banner-dot ${isActive ? 'active' : ''}" onclick="goToBanner(${idx})" title="${escapeHtml(b.title)}"></button>
    `;
  }).join("");

  if (currentBannerIndex >= banners.length) currentBannerIndex = 0;
  startBannerAutoPlay();
}

function goToBanner(index) {
  const slides = document.querySelectorAll(".banner-slide");
  const dots = document.querySelectorAll(".banner-dot");
  if (slides.length === 0) return;

  if (index >= slides.length) index = 0;
  if (index < 0) index = slides.length - 1;

  currentBannerIndex = index;

  slides.forEach((s, i) => s.classList.toggle("active", i === index));
  dots.forEach((d, i) => d.classList.toggle("active", i === index));

  startBannerAutoPlay();
}

function nextBanner() {
  const slides = document.querySelectorAll(".banner-slide");
  if (slides.length <= 1) return;
  goToBanner((currentBannerIndex + 1) % slides.length);
}

function startBannerAutoPlay() {
  if (bannerAutoTimer) clearInterval(bannerAutoTimer);
  bannerAutoTimer = setInterval(() => {
    nextBanner();
  }, BANNER_INTERVAL_MS);
}

function stopBannerAutoPlay() {
  if (bannerAutoTimer) {
    clearInterval(bannerAutoTimer);
    bannerAutoTimer = null;
  }
}

function initBannersSliderEvents() {
  renderTopBannersSlider();
  const stage = document.getElementById("bannersCarouselStage");
  if (stage) {
    stage.addEventListener("mouseenter", stopBannerAutoPlay);
    stage.addEventListener("mouseleave", startBannerAutoPlay);
  }
}

// تهيئة أحداث التطبيق
async function initAppEvents() {
  initBannersSliderEvents();
  loadCart();
  await renderProductsList();

  document.querySelectorAll(".filter-pill").forEach(pill => {
    pill.addEventListener("click", function() {
      document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      this.classList.add("active");
      currentCategoryFilter = this.getAttribute("data-category");
      renderProductsList();
    });
  });

  const toggleSearchBtn = document.getElementById("btnToggleSearch");
  const searchPopup = document.getElementById("searchPopupBar");
  const closeSearchBtn = document.getElementById("btnCloseSearchPopup");
  const searchInput = document.getElementById("headerSearchInput");

  if (toggleSearchBtn && searchPopup) {
    toggleSearchBtn.addEventListener("click", () => searchPopup.classList.toggle("active"));
  }
  if (closeSearchBtn && searchPopup) {
    closeSearchBtn.addEventListener("click", () => searchPopup.classList.remove("active"));
  }
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      currentSearchQuery = e.target.value;
      renderProductsList();
    });
  }

  const sortSelect = document.getElementById("catalogSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", e => {
      currentSortOrder = e.target.value;
      renderProductsList();
    });
  }

  const cartTrigger = document.getElementById("headerCartBtn");
  if (cartTrigger) cartTrigger.addEventListener("click", openCartDrawer);

  const closeCartBtn = document.getElementById("closeCartDrawerBtn");
  if (closeCartBtn) closeCartBtn.addEventListener("click", closeCartDrawer);

  const cartOverlay = document.getElementById("cartDrawerOverlay");
  if (cartOverlay) {
    cartOverlay.addEventListener("click", e => {
      if (e.target === cartOverlay) closeCartDrawer();
    });
  }

  const proceedBtn = document.getElementById("btnProceedCheckout");
  if (proceedBtn) proceedBtn.addEventListener("click", proceedCartOrderViaWhatsApp);

  const closeProductModalBtn = document.getElementById("closeProductModalBtn");
  if (closeProductModalBtn) closeProductModalBtn.addEventListener("click", closeProductModal);

  const decModalBtn = document.getElementById("btnModalQtyDec");
  const incModalBtn = document.getElementById("btnModalQtyInc");
  if (decModalBtn) decModalBtn.addEventListener("click", () => stepModalQuantity(-1));
  if (incModalBtn) incModalBtn.addEventListener("click", () => stepModalQuantity(1));

  const addModalCartBtn = document.getElementById("btnModalAddToCart");
  if (addModalCartBtn) addModalCartBtn.addEventListener("click", addModalProductToCart);

  document.querySelectorAll(".btn-open-admin").forEach(b => {
    b.addEventListener("click", e => {
      e.preventDefault();
      if (typeof window.openAdminDashboard === "function") window.openAdminDashboard();
    });
  });

  const closeLoginBtn = document.getElementById("closeAdminLoginBtn");
  if (closeLoginBtn) closeLoginBtn.addEventListener("click", window.closeAdminLoginModal);

  const backToStoreBtn = document.getElementById("btnAdminBackToStore");
  if (backToStoreBtn) backToStoreBtn.addEventListener("click", window.closeAdminDashboard);

  const logoutAdminBtn = document.getElementById("btnAdminLogout");
  if (logoutAdminBtn) logoutAdminBtn.addEventListener("click", window.logoutAdmin);

  if (typeof window.initAdminEvents === "function") window.initAdminEvents();
}

document.addEventListener("DOMContentLoaded", initAppEvents);

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.renderProductsList = renderProductsList;
window.addToCart = addToCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.showToast = showToast;
window.resetFilters = resetFilters;
window.filterCategoryFromNav = filterCategoryFromNav;
window.orderSingleProductViaWhatsApp = orderSingleProductViaWhatsApp;
window.orderBannerViaWhatsApp = orderBannerViaWhatsApp;
window.consultExpertForProduct = consultExpertForProduct;
window.proceedCartOrderViaWhatsApp = proceedCartOrderViaWhatsApp;
window.renderTopBannersSlider = renderTopBannersSlider;
window.goToBanner = goToBanner;
window.nextBanner = nextBanner;
window.supabaseClient = supabaseClient;