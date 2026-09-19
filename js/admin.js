/**
 * عطورات اترند - ATRAND PERFUMES
 * ملف إدارة المتجر ولوحة التحكم السحابية - Admin & Supabase Storage Manager
 * البريد: omar@trand.com
 * كلمة المرور: trand1234
 */

const ADMIN_CREDENTIALS = {
  email: "omar@trand.com",
  password: "trand1234"
};

const BANNERS_STORAGE_KEY = "atrand_banners_db";
const SESSION_KEY = "atrand_admin_auth";

// إعدادات اتصال Supabase السحابي
const SUPABASE_URL = "https://iceianuxbnhnpeupbbrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_syiACLwvd6tIh7moWlWSdA_OXJ5o5KX";

let supabaseAdminClient = null;
if (window.supabase) {
  supabaseAdminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// الحالة الحالية للإدارة
let currentEditId = null;
let uploadedImageDataUrl = "";
let uploadedImageFile = null; // ملف الصورة الخام للرفع السحابي

// الحالة الحالية لإدارة العروض
let currentBannerEditId = null;
let uploadedBannerImageDataUrl = "";

const DEFAULT_INITIAL_BANNERS = [];

// ==========================================
// إدارة المنتجات عبر Supabase
// ==========================================
async function getStoredProducts() {
  if (!supabaseAdminClient) return [];
  try {
    const { data, error } = await supabaseAdminClient
      .from('perfumes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("خطأ في جلب المنتجات للإدارة:", error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error("خطأ غير متوقع في جلب المنتجات", e);
    return [];
  }
}

async function saveStoredProductsToCloud(productData, isEditing = false, editId = null) {
  if (!supabaseAdminClient) {
    showToast("خطأ: اتصال Supabase غير متوفر", "error");
    return false;
  }

  try {
    let imageUrl = productData.image;

    // إذا تم اختيار ملف صورة جديد، نقوم برفعه إلى Supabase Storage
    if (uploadedImageFile) {
      const fileExt = uploadedImageFile.name.split('.').pop();
      const fileName = `perfume_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabaseAdminClient.storage
        .from('perfume-images')
        .upload(filePath, uploadedImageFile);

      if (uploadError) {
        console.error("خطأ في رفع الصورة:", uploadError.message);
        showToast("فشل رفع الصورة إلى السحابة: " + uploadError.message, "error");
        return false;
      }

      // جلب الرابط العام للصورة المرفوعة
      const { data: publicUrlData } = supabaseAdminClient.storage
        .from('perfume-images')
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    const payload = {
      name: productData.name,
      category: productData.category,
      price: productData.price,
      discount: productData.discount,
      offer: productData.offer,
      size: productData.size,
      type: productData.type,
      badge_tag: productData.badgeTag,
      longevity: productData.longevity,
      sillage: productData.sillage,
      occasion: productData.occasion,
      top_notes: productData.topNotes,
      heart_notes: productData.heartNotes,
      base_notes: productData.baseNotes,
      description: productData.description,
      image: imageUrl
    };

    if (isEditing && editId) {
      const { error } = await supabaseAdminClient
        .from('perfumes')
        .update(payload)
        .eq('id', editId);

      if (error) throw error;
      showToast("تم تحديث بيانات العطر سحابياً بنجاح", "success");
    } else {
      const { error } = await supabaseAdminClient
        .from('perfumes')
        .insert([payload]);

      if (error) throw error;
      showToast("تمت إضافة العطر إلى سحابة Supabase بنجاح", "success");
    }

    if (typeof window.renderProductsList === "function") {
      window.renderProductsList();
    }
    updateAdminStats();
    renderAdminProductsTable();
    return true;

  } catch (err) {
    console.error("خطأ أثناء الحفظ في Supabase:", err.message);
    showToast("خطأ أثناء الحفظ: " + err.message, "error");
    return false;
  }
}

// ==========================================
// إدارة العروض المتحركة (Banners)
// ==========================================
function getStoredBanners() {
  try {
    const raw = localStorage.getItem(BANNERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return DEFAULT_INITIAL_BANNERS;
}

function saveStoredBanners(banners) {
  try {
    localStorage.setItem(BANNERS_STORAGE_KEY, JSON.stringify(banners));
    if (typeof window.renderTopBannersSlider === "function") {
      window.renderTopBannersSlider();
    }
    updateAdminStats();
    renderAdminBannersTable();
    return true;
  } catch (e) {
    showToast("خطأ في حفظ العروض", "error");
    return false;
  }
}

// التحقق من حالة تسجيل الدخول
function isAdminLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === "true";
}

function loginAdmin(email, password) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPass = (password || "").trim();

  if (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase() && cleanPass === ADMIN_CREDENTIALS.password) {
    sessionStorage.setItem(SESSION_KEY, "true");
    return { success: true };
  } else {
    return { success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
  }
}

function logoutAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
  closeAdminDashboard();
  showToast("تم تسجيل الخروج بنجاح", "info");
}

async function openAdminDashboard() {
  if (!isAdminLoggedIn()) {
    openAdminLoginModal();
    return;
  }
  const dashboard = document.getElementById("adminDashboardView");
  if (dashboard) {
    dashboard.classList.add("active");
    document.body.style.overflow = "hidden";
    await updateAdminStats();
    await renderAdminProductsTable();
    renderAdminBannersTable();
  }
}

function closeAdminDashboard() {
  const dashboard = document.getElementById("adminDashboardView");
  if (dashboard) {
    dashboard.classList.remove("active");
    document.body.style.overflow = "";
  }
}

function openAdminLoginModal() {
  const modal = document.getElementById("adminLoginModal");
  const errorBox = document.getElementById("adminLoginError");
  const form = document.getElementById("adminLoginForm");
  if (form) form.reset();
  if (errorBox) errorBox.style.display = "none";
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeAdminLoginModal() {
  const modal = document.getElementById("adminLoginModal");
  const form = document.getElementById("adminLoginForm");
  if (form) form.reset();
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

async function updateAdminStats() {
  const products = await getStoredProducts();
  const banners = getStoredBanners();
  
  const totalEl = document.getElementById("statTotalPerfumes");
  const discountEl = document.getElementById("statDiscountedPerfumes");
  const offersEl = document.getElementById("statSpecialOffers");

  if (totalEl) totalEl.textContent = products.length;
  
  const discountedCount = products.filter(p => Number(p.discount) > 0).length;
  if (discountEl) discountEl.textContent = discountedCount;

  if (offersEl) offersEl.textContent = banners.length;
}

// عرض جدول المنتجات في لوحة الإدارة
async function renderAdminProductsTable() {
  const tableBody = document.getElementById("adminProductsTableBody");
  if (!tableBody) return;

  const products = await getStoredProducts();
  if (products.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">
          لا توجد عطور مسجلة حالياً في قاعدة بيانات Supabase.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = products.map((prod) => {
    const defaultImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23d4af37' viewBox='0 0 24 24'><path d='M12 2a3 3 0 0 0-3 3v1H7a2 2 0 0 0-2 2v2a7 7 0 0 0 5 6.7V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-2v-2.3A7 7 0 0 0 19 10V8a2 2 0 0 0-2-2h-2V5a3 3 0 0 0-3-3z'/></svg>";
    const imgSrc = prod.image || defaultImg;
    const discountText = prod.discount ? `${prod.discount}%` : "-";
    const offerText = prod.offer ? `<span class="badge-offer">${escapeHtml(prod.offer)}</span>` : "-";

    return `
      <tr>
        <td>
          <img src="${imgSrc}" class="table-thumb" alt="${escapeHtml(prod.name)}" onerror="this.src='${defaultImg}'" />
        </td>
        <td>
          <strong>${escapeHtml(prod.name)}</strong>
          <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(prod.size || "100 مل")}</div>
        </td>
        <td><span class="gold-badge">${escapeHtml(prod.category || "عطور")}</span></td>
        <td><strong style="color:var(--gold-light);">${Number(prod.price).toLocaleString()} ر.س</strong></td>
        <td>${discountText}</td>
        <td>${offerText}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon-action btn-edit" title="تعديل العطر" onclick="editProduct('${prod.id}')">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon-action btn-delete" title="حذف العطر" onclick="deleteProduct('${prod.id}')">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderAdminBannersTable() {
  const tableBody = document.getElementById("adminBannersTableBody");
  if (!tableBody) return;

  const banners = getStoredBanners();
  if (banners.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">
          لا توجد عروض ترويجية مسجلة حالياً.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = banners.map((banner) => {
    const defaultImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23d4af37' viewBox='0 0 24 24'><rect width='24' height='24' fill='%23222'/></svg>";
    const imgSrc = banner.image || defaultImg;

    return `
      <tr>
        <td>
          <img src="${imgSrc}" class="table-thumb" alt="${escapeHtml(banner.title)}" onerror="this.src='${defaultImg}'" />
        </td>
        <td>
          <strong>${escapeHtml(banner.title)}</strong>
          <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(banner.subtitle || "")}</div>
        </td>
        <td><span class="gold-badge">${escapeHtml(banner.tag || "عرض خاص")}</span></td>
        <td><strong style="color:var(--gold-light);">${escapeHtml(banner.buttonText || "اطلب عبر الواتساب")}</strong></td>
        <td>
          <div class="table-actions">
            <button class="btn-icon-action btn-edit" title="تعديل العرض" onclick="editBanner('${banner.id}')">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon-action btn-delete" title="حذف العرض" onclick="deleteBanner('${banner.id}')">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// معالجة حفظ عطر جديد أو محدث
async function handleSaveProductForm(e) {
  e.preventDefault();

  const name = document.getElementById("perfumeName").value.trim();
  const category = document.getElementById("perfumeCategory").value;
  const price = parseFloat(document.getElementById("perfumePrice").value);
  const discount = parseFloat(document.getElementById("perfumeDiscount").value) || 0;
  const offer = document.getElementById("perfumeOffer") ? document.getElementById("perfumeOffer").value.trim() : "";
  const size = document.getElementById("perfumeSize").value.trim() || "100 مل";
  const type = (document.getElementById("perfumeType") ? document.getElementById("perfumeType").value.trim() : "") || "EDP";
  const badgeTag = (document.getElementById("perfumeBadgeTag") ? document.getElementById("perfumeBadgeTag").value : "") || "none";
  const longevity = parseFloat(document.getElementById("perfumeLongevity") ? document.getElementById("perfumeLongevity").value : 98) || 98;
  const sillage = parseFloat(document.getElementById("perfumeSillage") ? document.getElementById("perfumeSillage").value : 95) || 95;
  const occasion = (document.getElementById("perfumeOccasion") ? document.getElementById("perfumeOccasion").value.trim() : "") || "سهرات، مناسبات خاصة";
  
  const topNotes = document.getElementById("perfumeTopNotes") ? document.getElementById("perfumeTopNotes").value.trim() : "";
  const heartNotes = document.getElementById("perfumeHeartNotes") ? document.getElementById("perfumeHeartNotes").value.trim() : "";
  const baseNotes = document.getElementById("perfumeBaseNotes") ? document.getElementById("perfumeBaseNotes").value.trim() : "";
  const description = document.getElementById("perfumeDescription").value.trim();

  if (!name || isNaN(price) || price <= 0) {
    showToast("يرجى إدخال اسم العطر وسعر صحيح", "error");
    return;
  }

  showToast("جاري رفع البيانات والصورة إلى Supabase...", "info");

  const productData = {
    name,
    category,
    price,
    discount,
    offer,
    size,
    type,
    badgeTag,
    longevity,
    sillage,
    occasion,
    topNotes,
    heartNotes,
    baseNotes,
    description,
    image: uploadedImageDataUrl
  };

  const success = await saveStoredProductsToCloud(productData, !!currentEditId, currentEditId);
  if (success) {
    resetProductForm();
  }
}

function handleSaveBannerForm(e) {
  e.preventDefault();

  const title = document.getElementById("bannerTitle").value.trim();
  const subtitle = document.getElementById("bannerSubtitle").value.trim();
  const tag = document.getElementById("bannerTag").value.trim() || "عرض ملكي";
  const buttonText = document.getElementById("bannerButtonText").value.trim() || "طلب فوري بالواتساب";
  const whatsappMessage = document.getElementById("bannerWhatsappMessage").value.trim();

  if (!title) {
    showToast("يرجى إدخال عنوان العرض الإعلاني", "error");
    return;
  }

  const banners = getStoredBanners();

  if (currentBannerEditId) {
    const index = banners.findIndex(b => b.id === currentBannerEditId);
    if (index !== -1) {
      const existing = banners[index];
      banners[index] = {
        ...existing,
        title,
        subtitle,
        tag,
        buttonText,
        whatsappMessage,
        image: uploadedBannerImageDataUrl || existing.image || "",
        updatedAt: new Date().toISOString()
      };
      saveStoredBanners(banners);
      showToast("تم تحديث العرض الإعلاني بنجاح", "success");
    }
  } else {
    const newBanner = {
      id: "banner_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      title,
      subtitle,
      tag,
      buttonText,
      whatsappMessage: whatsappMessage || `السلام عليكم، أود الاستفسار عن عرض: ${title}`,
      image: uploadedBannerImageDataUrl || "",
      createdAt: new Date().toISOString()
    };
    banners.unshift(newBanner);
    saveStoredBanners(banners);
    showToast("تمت إضافة العرض الإعلاني المتحرك بنجاح", "success");
  }

  resetBannerForm();
}

async function editProduct(id) {
  const products = await getStoredProducts();
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  currentEditId = id;

  document.getElementById("perfumeName").value = prod.name || "";
  document.getElementById("perfumeCategory").value = prod.category || "عطور رجالية";
  document.getElementById("perfumePrice").value = prod.price || "";
  document.getElementById("perfumeDiscount").value = prod.discount || "";
  if (document.getElementById("perfumeOffer")) document.getElementById("perfumeOffer").value = prod.offer || "";
  document.getElementById("perfumeSize").value = prod.size || "100 مل";
  if (document.getElementById("perfumeType")) document.getElementById("perfumeType").value = prod.type || "EDP";
  if (document.getElementById("perfumeBadgeTag")) document.getElementById("perfumeBadgeTag").value = prod.badge_tag || "none";
  if (document.getElementById("perfumeLongevity")) document.getElementById("perfumeLongevity").value = prod.longevity || 98;
  if (document.getElementById("perfumeSillage")) document.getElementById("perfumeSillage").value = prod.sillage || 95;
  if (document.getElementById("perfumeOccasion")) document.getElementById("perfumeOccasion").value = prod.occasion || "سهرات، مناسبات خاصة";
  
  if (document.getElementById("perfumeTopNotes")) document.getElementById("perfumeTopNotes").value = prod.top_notes || "";
  if (document.getElementById("perfumeHeartNotes")) document.getElementById("perfumeHeartNotes").value = prod.heart_notes || "";
  if (document.getElementById("perfumeBaseNotes")) document.getElementById("perfumeBaseNotes").value = prod.base_notes || "";
  
  document.getElementById("perfumeDescription").value = prod.description || "";

  uploadedImageDataUrl = prod.image || "";
  uploadedImageFile = null;
  const previewContainer = document.getElementById("imagePreviewContainer");
  const previewImg = document.getElementById("imagePreviewImg");
  if (uploadedImageDataUrl && previewContainer && previewImg) {
    previewImg.src = uploadedImageDataUrl;
    previewContainer.style.display = "block";
  }

  const submitBtn = document.getElementById("submitProductBtn");
  if (submitBtn) submitBtn.innerHTML = `<span>تحديث بيانات العطر</span>`;

  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.style.display = "inline-flex";

  document.getElementById("adminAddEditSection").scrollIntoView({ behavior: "smooth" });
}

function editBanner(id) {
  const banners = getStoredBanners();
  const banner = banners.find(b => b.id === id);
  if (!banner) return;

  currentBannerEditId = id;

  document.getElementById("bannerTitle").value = banner.title || "";
  document.getElementById("bannerSubtitle").value = banner.subtitle || "";
  document.getElementById("bannerTag").value = banner.tag || "";
  document.getElementById("bannerButtonText").value = banner.buttonText || "";
  document.getElementById("bannerWhatsappMessage").value = banner.whatsappMessage || "";

  uploadedBannerImageDataUrl = banner.image || "";
  const previewContainer = document.getElementById("bannerImagePreviewContainer");
  const previewImg = document.getElementById("bannerImagePreviewImg");
  if (uploadedBannerImageDataUrl && previewContainer && previewImg) {
    previewImg.src = uploadedBannerImageDataUrl;
    previewContainer.style.display = "block";
  }

  const submitBtn = document.getElementById("submitBannerBtn");
  if (submitBtn) submitBtn.innerHTML = `<span>تحديث العرض الإعلاني</span>`;

  const cancelBtn = document.getElementById("cancelBannerEditBtn");
  if (cancelBtn) cancelBtn.style.display = "inline-flex";

  document.getElementById("adminBannersAddSection").scrollIntoView({ behavior: "smooth" });
}

function resetProductForm() {
  currentEditId = null;
  uploadedImageDataUrl = "";
  uploadedImageFile = null;

  const form = document.getElementById("addPerfumeForm");
  if (form) form.reset();

  const previewContainer = document.getElementById("imagePreviewContainer");
  if (previewContainer) previewContainer.style.display = "none";

  const submitBtn = document.getElementById("submitProductBtn");
  if (submitBtn) submitBtn.innerHTML = `<span>حفظ وإضافة إلى المتجر</span>`;

  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

function resetBannerForm() {
  currentBannerEditId = null;
  uploadedBannerImageDataUrl = "";

  const form = document.getElementById("addBannerForm");
  if (form) form.reset();

  const previewContainer = document.getElementById("bannerImagePreviewContainer");
  if (previewContainer) previewContainer.style.display = "none";

  const submitBtn = document.getElementById("submitBannerBtn");
  if (submitBtn) submitBtn.innerHTML = `<span>حفظ وإضافة العرض الإعلاني</span>`;

  const cancelBtn = document.getElementById("cancelBannerEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

// حذف عطر من Supabase
async function deleteProduct(id) {
  if (!supabaseAdminClient) return;

  if (confirm("هل أنت متأكد من حذف هذا العطر نهائياً من سحابة Supabase؟")) {
    const { error } = await supabaseAdminClient
      .from('perfumes')
      .delete()
      .eq('id', id);

    if (error) {
      showToast("فشل في حذف العطر: " + error.message, "error");
      return;
    }

    showToast("تم حذف العطر بنجاح", "info");
    if (typeof window.renderProductsList === "function") {
      window.renderProductsList();
    }
    updateAdminStats();
    renderAdminProductsTable();
  }
}

function deleteBanner(id) {
  const banners = getStoredBanners();
  const banner = banners.find(b => b.id === id);
  const title = banner ? banner.title : "العرض";

  if (confirm(`هل أنت متأكد من حذف العرض "${title}"؟`)) {
    const filtered = banners.filter(b => b.id !== id);
    saveStoredBanners(filtered);
    showToast(`تم حذف العرض بنجاح`, "info");
  }
}

async function exportProductsJson() {
  const products = await getStoredProducts();
  const jsonString = JSON.stringify(products, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = "products.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("تم تصدير ملف products.json بنجاح", "success");
}

// معالجة رفع الصور
function initImageUploader(inputId, dropZoneId, previewContainerId, previewImgId, removeBtnId, isBanner = false) {
  const fileInput = document.getElementById(inputId);
  const dropZone = document.getElementById(dropZoneId);
  const previewContainer = document.getElementById(previewContainerId);
  const previewImg = document.getElementById(previewImgId);
  const removeBtn = document.getElementById(removeBtnId);

  if (!fileInput) return;

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      showToast("يرجى اختيار ملف صورة صالح", "error");
      return;
    }

    if (isBanner) {
      const reader = new FileReader();
      reader.onload = function(e) {
        uploadedBannerImageDataUrl = e.target.result;
        if (previewImg && previewContainer) {
          previewImg.src = e.target.result;
          previewContainer.style.display = "block";
        }
        showToast("تم تحميل ومعاينة بنر العرض بنجاح", "success");
      };
      reader.readAsDataURL(file);
    } else {
      // حفظ ملف الصورة الخام لرفعه لاحقاً لـ Supabase Storage
      uploadedImageFile = file;
      const reader = new FileReader();
      reader.onload = function(e) {
        uploadedImageDataUrl = e.target.result;
        if (previewImg && previewContainer) {
          previewImg.src = e.target.result;
          previewContainer.style.display = "block";
        }
        showToast("تم تجهيز صورة العطر للرفع السحابي", "success");
      };
      reader.readAsDataURL(file);
    }
  }

  fileInput.addEventListener("change", function(e) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  if (dropZone) {
    dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", e => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (isBanner) {
        uploadedBannerImageDataUrl = "";
      } else {
        uploadedImageDataUrl = "";
        uploadedImageFile = null;
      }
      if (fileInput) fileInput.value = "";
      if (previewContainer) previewContainer.style.display = "none";
    });
  }
}

// إعداد أحداث الإدارة
function initAdminEvents() {
  const loginForm = document.getElementById("adminLoginForm");
  const errorBox = document.getElementById("adminLoginError");

  if (loginForm) {
    loginForm.addEventListener("submit", function(e) {
      e.preventDefault();
      const email = document.getElementById("adminEmail").value;
      const pass = document.getElementById("adminPassword").value;

      const res = loginAdmin(email, pass);
      if (res.success) {
        closeAdminLoginModal();
        loginForm.reset();
        openAdminDashboard();
        showToast("مرحباً بك في لوحة إدارة عطورات اترند السحابية", "success");
      } else {
        if (errorBox) {
          errorBox.textContent = res.message;
          errorBox.style.display = "block";
        }
      }
    });
  }

  const productForm = document.getElementById("addPerfumeForm");
  if (productForm) {
    productForm.addEventListener("submit", handleSaveProductForm);
  }

  const cancelEditBtn = document.getElementById("cancelEditBtn");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", resetProductForm);
  }

  const bannerForm = document.getElementById("addBannerForm");
  if (bannerForm) {
    bannerForm.addEventListener("submit", handleSaveBannerForm);
  }

  const cancelBannerBtn = document.getElementById("cancelBannerEditBtn");
  if (cancelBannerBtn) {
    cancelBannerBtn.addEventListener("click", resetBannerForm);
  }

  // تفعيل رفع الصور للمنتجات والعروض
  initImageUploader("perfumeImageInput", "imageDropZone", "imagePreviewContainer", "imagePreviewImg", "removeImageBtn", false);
  initImageUploader("bannerImageInput", "bannerImageDropZone", "bannerImagePreviewContainer", "bannerImagePreviewImg", "removeBannerImageBtn", true);

  const exportBtn = document.getElementById("btnExportJson");
  if (exportBtn) exportBtn.addEventListener("click", exportProductsJson);

  const tabBtns = document.querySelectorAll(".admin-tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", function() {
      tabBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".admin-tab-pane").forEach(p => p.classList.remove("active"));

      this.classList.add("active");
      const targetId = this.getAttribute("data-tab");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.getStoredBanners = getStoredBanners;
window.openAdminDashboard = openAdminDashboard;
window.closeAdminDashboard = closeAdminDashboard;
window.openAdminLoginModal = openAdminLoginModal;
window.closeAdminLoginModal = closeAdminLoginModal;
window.logoutAdmin = logoutAdmin;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.editBanner = editBanner;
window.deleteBanner = deleteBanner;
window.initAdminEvents = initAdminEvents;
window.supabaseAdminClient = supabaseAdminClient;