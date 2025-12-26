// Dashboard JavaScript for customer
let roomsCache = [];
let bookingsCache = [];
let servicesCache = [];
let promotionsCache = [];
let currentFilter = "all";
let currentBookingRoom = null;

// ===== Navigation =====
const pages = ["rooms", "bookings", "profile"];
function setPage(page) {
  if (!pages.includes(page)) {
    page = "rooms";
  }
  
  pages.forEach(p => {
    const pageEl = document.getElementById("page-" + p);
    const navLink = document.querySelector(`.nav a[data-page="${p}"]`);
    
    if (pageEl) {
      pageEl.classList.toggle("active", p === page);
    }
    
    if (navLink) {
      navLink.classList.toggle("active", p === page);
    }
  });
  
  const titleMap = {
    rooms: "Phòng",
    bookings: "Lịch sử đặt phòng",
    profile: "Thông tin cá nhân"
  };
  
  const pageTitleEl = document.getElementById("pageTitle");
  if (pageTitleEl) {
    pageTitleEl.textContent = titleMap[page] || "Dashboard";
  }
  
  if (location.hash !== "#" + page) {
    location.hash = page;
  }
  
  // Load page-specific data
  if (page === "rooms") {
    loadRooms();
  } else if (page === "bookings") {
    loadBookings();
  } else if (page === "profile") {
    loadProfile();
  }
  
  // Preload services and promotions
  ensureServicesAndPromotionsLoaded();
}

async function ensureServicesAndPromotionsLoaded() {
  try {
    if (servicesCache.length === 0) {
      const res = await apiCall("/api/customer/services");
      if (res && res.ok) servicesCache = await res.json();
    }
    if (promotionsCache.length === 0) {
      const res = await apiCall("/api/customer/promotions");
      if (res && res.ok) promotionsCache = await res.json();
    }
  } catch (e) {
    console.error("Error loading services/promotions:", e);
  }
}

// Feedback
function openFeedbackModal(bookingId) {
  document.getElementById("feedbackBookingId").value = bookingId;
  document.getElementById("feedbackRating").value = "5";
  document.getElementById("feedbackComment").value = "";
  
  const errorMsg = document.getElementById("feedbackErrorMsg");
  const successMsg = document.getElementById("feedbackSuccessMsg");
  if (errorMsg) errorMsg.style.display = "none";
  if (successMsg) successMsg.style.display = "none";
  
  document.getElementById("feedbackModal").classList.add("open");
}

function closeFeedbackModal() {
  document.getElementById("feedbackModal").classList.remove("open");
}

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  const bookingId = document.getElementById("feedbackBookingId").value;
  const rating = document.getElementById("feedbackRating").value;
  const comment = document.getElementById("feedbackComment").value.trim();
  
  const errorMsg = document.getElementById("feedbackErrorMsg");
  const successMsg = document.getElementById("feedbackSuccessMsg");
  
  if (errorMsg) errorMsg.style.display = "none";
  if (successMsg) successMsg.style.display = "none";
  
  try {
    const res = await apiCall("/api/customer/feedback", {
      method: "POST",
      body: JSON.stringify({
        bookingId,
        rating,
        comment
      })
    });
    
    if (!res) return;
    
    const data = await res.json();
    
    if (!res.ok) {
      if (errorMsg) {
        errorMsg.textContent = data.message || "Gửi đánh giá thất bại";
        errorMsg.style.display = "block";
      }
      return;
    }
    
    if (successMsg) {
      successMsg.textContent = "Cảm ơn bạn đã đánh giá!";
      successMsg.style.display = "block";
    }
    
    // Reload bookings to update button state
    loadBookings();
    
    setTimeout(() => {
      closeFeedbackModal();
    }, 1500);
  } catch (e) {
    console.error("Error submitting feedback:", e);
    if (errorMsg) {
      errorMsg.textContent = "Lỗi kết nối, vui lòng thử lại";
      errorMsg.style.display = "block";
    }
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Check authentication
  const token = localStorage.getItem("customer_access_token");
  if (!token) {
    window.location.href = "/login";
    return;
  }
  
  // Load user info
  const customerInfo = JSON.parse(localStorage.getItem("customer_info") || "{}");
  const uNameEl = document.getElementById("uName");
  if (uNameEl) {
    uNameEl.textContent = customerInfo.fullName || customerInfo.username || customerInfo.email || "Khách hàng";
  }
  
  // Setup navigation
  document.querySelectorAll(".nav a").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const page = a.dataset.page;
      setPage(page);
    });
  });
  
  // Handle hash change
  window.addEventListener("hashchange", () => {
    const page = (location.hash || "#rooms").slice(1);
    setPage(page);
  });
  
  // Set initial page from hash or default to rooms
  const initialPage = (location.hash || "#rooms").slice(1);
  setPage(initialPage);
  
  // Setup event listeners
  setupEventListeners();
  
  // Reload button
  document.getElementById("btnReload").onclick = () => {
    const page = (location.hash || "#rooms").slice(1);
    if (page === "rooms") loadRooms();
    if (page === "bookings") loadBookings();
    if (page === "profile") loadProfile();
  };
});

function setupEventListeners() {
  // Logout
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.onclick = logout;
  }
  
  // Room filter
  const filterStatus = document.getElementById("filterStatus");
  if (filterStatus) {
    filterStatus.onchange = renderRooms;
  }
  
  // New Search Filters
  const searchName = document.getElementById("searchName");
  if (searchName) searchName.oninput = renderRooms;

  const searchPrice = document.getElementById("searchPrice");
  if (searchPrice) searchPrice.oninput = renderRooms;

  const searchCapacity = document.getElementById("searchCapacity");
  if (searchCapacity) searchCapacity.oninput = renderRooms;
  
  // Edit Profile form
  const editProfileForm = document.getElementById("editProfileForm");
  if (editProfileForm) {
    editProfileForm.onsubmit = handleEditProfileSubmit;
  }

  // Change Password form
  const changePasswordForm = document.getElementById("changePasswordForm");
  if (changePasswordForm) {
    changePasswordForm.onsubmit = handleChangePasswordSubmit;
  }

  // Feedback form
  const feedbackForm = document.getElementById("feedbackForm");
  if (feedbackForm) {
    feedbackForm.onsubmit = handleFeedbackSubmit;
  }
  
  // Booking modal close
  const btnCloseBookingModal = document.getElementById("btnCloseBookingModal");
  if (btnCloseBookingModal) {
    btnCloseBookingModal.onclick = closeBookingModal;
  }
  
  const bookingModal = document.getElementById("bookingModal");
  if (bookingModal) {
    bookingModal.onclick = (e) => {
      if (e.target.id === "bookingModal") {
        closeBookingModal();
      }
    };
  }

  // Room detail modal close
  const btnCloseRoomDetailModal = document.getElementById("btnCloseRoomDetailModal");
  if (btnCloseRoomDetailModal) {
    btnCloseRoomDetailModal.onclick = closeRoomDetailModal;
  }
  
  const roomDetailModal = document.getElementById("roomDetailModal");
  if (roomDetailModal) {
    roomDetailModal.onclick = (e) => {
      if (e.target.id === "roomDetailModal") {
        closeRoomDetailModal();
      }
    };
  }
}

// Removed switchTab - using setPage instead

// Get access token
function getAccessToken() {
  return localStorage.getItem("customer_access_token");
}

// API call helper
async function apiCall(endpoint, options = {}) {
  const token = getAccessToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: "include"
  });
  
  // Handle token refresh if needed
  if (res.status === 401 && token) {
    try {
      const refreshRes = await fetch("/customer-auth/refresh", {
        method: "POST",
        credentials: "include"
      });
      
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        localStorage.setItem("customer_access_token", data.accessToken);
        // Retry original request
        return apiCall(endpoint, options);
      } else {
        // Refresh failed, logout
        logout();
        return null;
      }
    } catch (e) {
      logout();
      return null;
    }
  }
  
  return res;
}

// Logout
function logout() {
  fetch("/customer-auth/logout", {
    method: "POST",
    credentials: "include"
  }).finally(() => {
    localStorage.removeItem("customer_access_token");
    localStorage.removeItem("customer_info");
    window.location.href = "/login";
  });
}

// Helper to get room amenities (from DB or default based on type)
function getRoomAmenities(room) {
  // If DB has amenities string, use it
  if (room.amenities && room.amenities.trim()) {
    return room.amenities.split(',').map(s => s.trim()).filter(Boolean);
  }
  
  // Fallback defaults if DB is empty
  const defaults = [
    "Wifi miễn phí", "Điều hòa 2 chiều", "Tivi thông minh", 
    "Tủ lạnh mini", "Máy sấy tóc", "Dọn phòng hàng ngày"
  ];
  
  if (room.roomType === "SUITE" || room.roomType === "DELUXE") {
    defaults.push("Bồn tắm", "Ban công view đẹp", "Két an toàn");
  }
  
  return defaults;
}

// Load rooms
async function loadRooms() {
  try {
    const res = await apiCall("/api/customer/rooms");
    if (!res) return;
    
    if (!res.ok) {
      const data = await res.json();
      console.error("Error loading rooms:", data.message);
      return;
    }
    
    roomsCache = await res.json();
    
    // Render amenities filter based on loaded rooms
    renderAmenitiesFilter();
    
    renderRooms();
  } catch (e) {
    console.error("Error loading rooms:", e);
  }
}

// Render Amenities Filter
function renderAmenitiesFilter() {
  const container = document.getElementById("amenitiesFilterContainer");
  if (!container) return;
  
  const allAmenities = new Set();
  (roomsCache || []).forEach(room => {
    const amenities = getRoomAmenities(room);
    amenities.forEach(a => allAmenities.add(a));
  });
  
  if (allAmenities.size === 0) {
    container.innerHTML = '<span style="color: #94a3b8; font-style: italic; font-size: 14px;">Không có thông tin tiện nghi</span>';
    return;
  }
  
  container.innerHTML = Array.from(allAmenities).sort().map(a => `
    <label style="display: flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; padding: 4px 8px; background: #fff; border-radius: 4px; border: 1px solid #e2e8f0;">
      <input type="checkbox" value="${a}" onchange="renderRooms()" style="accent-color: #0ea5e9;">
      <span>${a}</span>
    </label>
  `).join("");
}

// Render rooms
async function renderRooms() {
  const container = document.getElementById("roomsGridContainer");
  if (!container) return;
  
  let rooms = roomsCache || [];
  
  // --- Get Filter Values ---
  const searchNameVal = (document.getElementById("searchName")?.value || "").toLowerCase().trim();
  const searchPriceVal = Number(document.getElementById("searchPrice")?.value || 0);
  const searchCapacityVal = Number(document.getElementById("searchCapacity")?.value || 0);
  const statusVal = document.getElementById("filterStatus")?.value || "all";
  
  // Get selected amenities
  const checkedAmenities = Array.from(document.querySelectorAll('#amenitiesFilterContainer input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  // --- Apply Filters ---
  
  // 1. Status Filter
  if (statusVal !== "all") {
    rooms = rooms.filter(r => r.status === statusVal);
  }
  
  // 2. Name/Code Filter
  if (searchNameVal) {
    rooms = rooms.filter(r => 
      (r.roomName || "").toLowerCase().includes(searchNameVal) || 
      (r.roomCode || "").toLowerCase().includes(searchNameVal)
    );
  }
  
  // 3. Price Filter (Max Price)
  if (searchPriceVal > 0) {
    rooms = rooms.filter(r => (Number(r.pricePerNight) || 0) <= searchPriceVal);
  }
  
  // 4. Capacity Filter (Min Capacity)
  if (searchCapacityVal > 0) {
    rooms = rooms.filter(r => {
      const capacity = (Number(r.bedCount) || 1) * 2;
      return capacity >= searchCapacityVal;
    });
  }
  
  // 5. Amenities Filter (Must have ALL selected)
  if (checkedAmenities.length > 0) {
    rooms = rooms.filter(r => {
      const roomAmenities = getRoomAmenities(r);
      return checkedAmenities.every(req => roomAmenities.includes(req));
    });
  }
  
  // Load bookings to show customer info
  let bookings = [];
  try {
    const bookingsRes = await apiCall("/api/customer/bookings");
    if (bookingsRes && bookingsRes.ok) {
      bookings = await bookingsRes.json();
    }
  } catch (e) {
    console.error("Error loading bookings for room display:", e);
  }
  
  if (rooms.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Không tìm thấy phòng nào</h3>
        <p>Vui lòng thử thay đổi điều kiện tìm kiếm</p>
      </div>
    `;
    return;
  }
  
  // Sort: VACANT first, others last
  rooms.sort((a, b) => {
    const isAVacant = a.status === "VACANT";
    const isBVacant = b.status === "VACANT";
    if (isAVacant && !isBVacant) return -1;
    if (!isAVacant && isBVacant) return 1;
    return 0;
  });
  
  container.innerHTML = rooms.map(room => {
    const booking = bookings.find(b => 
      b.roomId === room.id && 
      (b.status === "PENDING" || b.status === "CHECKED_IN" || b.status === "RESERVED")
    );
    
    const statusClass = room.status === "VACANT" ? "vacant" : (room.status === "RESERVED" ? "reserved" : "occupied");
    const statusText = room.status === "VACANT" ? "Còn trống" : (room.status === "RESERVED" ? "Đã đặt" : "Đã thuê");
    const roomTypeName = getRoomTypeName(room.roomType);
    const capacity = (room.bedCount || 1) * 2;
    const roomIcon = getRoomIcon(room.roomType);
    const price = Number(room.pricePerNight || 0).toLocaleString("vi-VN");
    const description = room.description || "Phòng đầy đủ tiện nghi, thoải mái cho kỳ nghỉ của bạn.";
    
    const canBook = room.status === "VACANT";
    
    // Customer info for reserved/occupied rooms
    let customerInfo = "";
    if (booking && (room.status === "RESERVED" || room.status === "OCCUPIED")) {
      const checkInDate = formatDate(booking.checkInDate);
      const checkOutDate = formatDate(booking.checkOutDate);
      customerInfo = `
        <div class="room-customer-info">
          <div class="room-customer-detail">
            <span>Ngày nhận: ${checkInDate}</span>
          </div>
          <div class="room-date">
            <span>Ngày trả: ${checkOutDate}</span>
          </div>
        </div>
      `;
    } else {
      customerInfo = `
        <div class="room-customer-info empty">
          Chưa có khách thuê
        </div>
      `;
    }
    
    return `
      <div class="room-card" data-room-id="${room.id}">
        <div class="room-card-header">
          <span class="room-status-badge ${statusClass}">${statusText}</span>
          <span class="room-icon">${roomIcon}</span>
        </div>
        <div class="room-number">${room.roomCode || room.roomName || `Phòng ${room.id}`}</div>
        <div class="room-type">${roomTypeName} <span style="font-size: 0.9em; color: #64748b; font-weight: normal;">(${capacity} người)</span></div>
        <div class="room-description">${description}</div>
        ${customerInfo}
        <div class="room-price ${statusClass}">
          ${price} ₫/đêm
        </div>
        <div class="room-card-actions">
          <button class="btn" onclick="viewRoomDetail(${room.id})" style="flex: 1;">
            Xem chi tiết
          </button>
          ${canBook ? `
            <button class="btn primary" onclick="openBookingModal(${room.id})" style="flex: 1;">
              Đặt phòng
            </button>
          ` : `
            <button class="btn" disabled style="flex: 1; opacity: 0.5; cursor: not-allowed;">
              Đã được đặt
            </button>
          `}
        </div>
      </div>
    `;
  }).join("");
}

function getRoomTypeName(roomType) {
  const names = {
    STANDARD: "Phòng tiêu chuẩn",
    SUPERIOR: "Phòng cao cấp",
    DELUXE: "Phòng deluxe",
    SUITE: "Phòng suite"
  };
  return names[roomType] || roomType;
}

function getRoomIcon(roomType) {
  const icons = {
    STANDARD: "🛏️",
    SUPERIOR: "🛏️✨",
    DELUXE: "🏨",
    SUITE: "🏰"
  };
  return icons[roomType] || "🛏️";
}

// View room detail
function viewRoomDetail(roomId) {
  const room = roomsCache.find(r => r.id === roomId);
  if (!room) return;
  
  const modal = document.getElementById("roomDetailModal");
  const content = document.getElementById("roomDetailModalContent");
  
  const roomTypeName = getRoomTypeName(room.roomType);
  const capacity = (room.bedCount || 1) * 2;
  const roomIcon = getRoomIcon(room.roomType);
  const price = Number(room.pricePerNight || 0).toLocaleString("vi-VN");
  const description = room.description || "Phòng đầy đủ tiện nghi, thoải mái cho kỳ nghỉ của bạn.";
  
  // Use shared helper
  const amenities = getRoomAmenities(room);
  
  content.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 48px; margin-bottom: 10px;">${roomIcon}</div>
      <h2 style="margin: 0; color: #1e293b;">${room.roomCode || room.roomName}</h2>
      <div style="color: #64748b; margin-top: 4px;">${roomTypeName} (${capacity} người)</div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="margin-bottom: 10px; color: #334155;">Mô tả</h4>
      <p style="line-height: 1.6; color: #475569;">${description}</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="margin-bottom: 10px; color: #334155;">Tiện nghi</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        ${amenities.map(a => `<div style="display: flex; align-items: center; gap: 8px; color: #475569;"><span style="color: #22c55e;">✓</span> ${a}</div>`).join("")}
      </div>
    </div>
    
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 14px; color: #64748b;">Giá phòng</div>
        <div style="font-size: 24px; font-weight: 700; color: #0ea5e9;">${price} ₫<span style="font-size: 14px; color: #64748b; font-weight: 400;">/đêm</span></div>
      </div>
      ${room.status === "VACANT" ? `
        <button class="btn primary" onclick="closeRoomDetailModal(); openBookingModal(${room.id})" style="padding: 10px 24px; font-weight: 600;">
          Đặt phòng ngay
        </button>
      ` : `
        <button class="btn" disabled style="opacity: 0.7; cursor: not-allowed;">
          Đã được đặt
        </button>
      `}
    </div>
  `;
  
  modal.classList.add("open");
}

function closeRoomDetailModal() {
  document.getElementById("roomDetailModal").classList.remove("open");
}

// Open booking modal
async function openBookingModal(roomId) {
  await ensureServicesAndPromotionsLoaded();
  const room = roomsCache.find(r => r.id === roomId);
  if (!room) return;
  
  if (room.status !== "VACANT") {
    alert("Phòng này không còn trống");
    return;
  }
  
  currentBookingRoom = room;
  
  const modalContent = document.getElementById("bookingModalContent");
  const modalHeader = document.querySelector("#bookingModal .modal-header h3");
  
  const pricePerNight = Number(room.pricePerNight || 0);

  // Services HTML
  const activeServices = servicesCache.filter(s => s.trangThai === "ACTIVE" || !s.trangThai); // Default to active if status missing
  const servicesHtml = activeServices.length > 0 ? activeServices.map(s => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1; font-size: 15px;">
        <input type="checkbox" name="service" value="${s.id}" data-price="${s.gia}" onchange="updateBookingTotal()" style="width: 18px; height: 18px; accent-color: #0ea5e9;">
        <span>${s.tenDichVu}</span>
      </label>
      <span style="font-weight: 600; color: #0ea5e9;">${Number(s.gia).toLocaleString("vi-VN")} ₫</span>
    </div>
  `).join("") : "<p style='color: #64748b; font-style: italic; padding: 8px;'>Không có dịch vụ thêm</p>";

  // Promotions HTML
  const promotionsHtml = `
    <select id="promotionSelect" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;" onchange="updateBookingTotal()">
      <option value="">-- Chọn mã giảm giá (nếu có) --</option>
      ${promotionsCache.map(p => `
        <option value="${p.id}" data-code="${p.code}" data-discount="${p.giamGia}">
          ${p.code} - Giảm ${p.giamGia}% (${p.moTa})
        </option>
      `).join("")}
    </select>
  `;

  modalContent.innerHTML = `
    <!-- STEP 1: INFO -->
    <div id="bookingStep1" style="padding: 20px;">
        <div style="margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${room.roomCode || room.roomName}</div>
            <div style="color: #64748b;">${getRoomTypeName(room.roomType)} - <span style="color: #0ea5e9; font-weight: 600;">${pricePerNight.toLocaleString("vi-VN")} ₫/đêm</span></div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <label style="display: block;">
                <span style="display: block; margin-bottom: 6px; font-weight: 500;">Ngày nhận *</span>
                <input type="date" id="checkInDate" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;" onchange="updateBookingTotal()">
            </label>
            <label style="display: block;">
                <span style="display: block; margin-bottom: 6px; font-weight: 500;">Ngày trả *</span>
                <input type="date" id="checkOutDate" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;" onchange="updateBookingTotal()">
            </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 16px;">
             <label style="display: block;">
                <span style="display: block; margin-bottom: 6px; font-weight: 500;">Số người</span>
                <input type="number" id="soNguoi" min="1" value="1" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;">
            </label>
            <label style="display: block;">
                <span style="display: block; margin-bottom: 6px; font-weight: 500;">Ghi chú</span>
                <textarea id="bookingNote" rows="2" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;"></textarea>
            </label>
        </div>

        <div style="margin-bottom: 16px;">
            <span style="display: block; margin-bottom: 8px; font-weight: 500;">Dịch vụ thêm</span>
            <div style="max-height: 150px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #f8fafc;">
                ${servicesHtml}
            </div>
        </div>

        <div style="margin-bottom: 20px;">
             <span style="display: block; margin-bottom: 6px; font-weight: 500;">Mã giảm giá</span>
             ${promotionsHtml}
        </div>

        <div style="background: #f0f9ff; padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #bae6fd;">
             <div style="display: flex; justify-content: space-between; font-weight: 700; color: #0284c7;">
                <span>Tạm tính:</span>
                <span id="step1Total">0 ₫</span>
            </div>
        </div>

        <div id="step1Error" style="color: #ef4444; margin-bottom: 10px; display: none;"></div>

        <div style="display: flex; gap: 12px;">
            <button type="button" class="btn" onclick="closeBookingModal()" style="flex: 1; padding: 12px;">Hủy</button>
            <button type="button" class="btn primary" onclick="goToStep2()" style="flex: 1; padding: 12px; font-weight: 600;">Tiếp tục</button>
        </div>
    </div>

    <!-- STEP 2: PAYMENT -->
    <div id="bookingStep2" style="display: none; padding: 20px;">
        <h4 style="margin-bottom: 16px; font-size: 18px;">Xác nhận & Thanh toán</h4>
        
        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span id="invRoomName">Phòng...</span>
                    <span id="invRoomPrice">...</span>
                </div>
                <div id="invServicesList"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #64748b;">
                <span>Tổng tiền phòng & dịch vụ:</span>
                <span id="invSubTotal" style="font-weight: 600;">...</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #16a34a;">
                <span>Giảm giá (<span id="invPromoCode"></span>):</span>
                <span id="invDiscount">-0 ₫</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.4em; color: #0ea5e9; margin-top: 12px; padding-top: 12px; border-top: 2px solid #f1f5f9;">
                <span>THÀNH TIỀN:</span>
                <span id="invFinalTotal">0 ₫</span>
            </div>
        </div>

        <div style="margin-bottom: 24px;">
            <span style="display: block; margin-bottom: 12px; font-weight: 500;">Phương thức thanh toán</span>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <label style="display: flex; align-items: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; background: #f8fafc;">
                    <input type="radio" name="paymentMethod" value="CASH" checked style="margin-right: 12px;">
                    <div>
                        <div style="font-weight: 600;">Tiền mặt / Tại quầy</div>
                        <div style="font-size: 12px; color: #64748b;">Thanh toán trực tiếp khi nhận phòng</div>
                    </div>
                </label>
                <label style="display: flex; align-items: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; background: #f8fafc;">
                    <input type="radio" name="paymentMethod" value="TRANSFER" style="margin-right: 12px;">
                    <div>
                        <div style="font-weight: 600;">Chuyển khoản ngân hàng</div>
                        <div style="font-size: 12px; color: #64748b;">Vietcombank: 1234567890 (Nội dung: [SĐT] Dat phong)</div>
                    </div>
                </label>
            </div>
        </div>

        <div id="bookingErrorMsg" style="color: #ef4444; margin-bottom: 10px; display: none;"></div>
        <div id="bookingSuccessMsg" style="color: #16a34a; margin-bottom: 10px; display: none;"></div>

        <div style="display: flex; gap: 12px;">
            <button type="button" class="btn" onclick="goToStep1()" style="flex: 1; padding: 12px;">Quay lại</button>
            <button type="button" class="btn primary" id="btnConfirmBooking" onclick="confirmBooking()" style="flex: 1; padding: 12px; font-weight: 600;">Xác nhận đặt phòng</button>
        </div>
    </div>
  `;

  // Helper logic attached to window for inline events
  window.updateBookingTotal = () => {
     const inDate = new Date(document.getElementById("checkInDate").value);
     const outDate = new Date(document.getElementById("checkOutDate").value);
     
     let roomTotal = 0;
     let numNights = 0;
     if(inDate && outDate && outDate > inDate) {
        const diff = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
        roomTotal = diff * pricePerNight;
        numNights = diff;
     }

     let servicesTotal = 0;
     document.querySelectorAll('input[name="service"]:checked').forEach(cb => {
        servicesTotal += Number(cb.dataset.price || 0);
     });

     const promoSelect = document.getElementById("promotionSelect");
     let discountPercent = 0;
     if(promoSelect && promoSelect.selectedOptions.length > 0 && promoSelect.value) {
        discountPercent = Number(promoSelect.selectedOptions[0].dataset.discount || 0);
     }
     
     const subTotal = roomTotal + servicesTotal;
     const discount = subTotal * (discountPercent / 100);
     const total = subTotal - discount;

     const step1TotalEl = document.getElementById("step1Total");
     if(step1TotalEl) step1TotalEl.textContent = (total > 0 ? total : 0).toLocaleString("vi-VN") + " ₫";
     
     return { roomTotal, servicesTotal, discount, total, numNights, discountPercent };
  };

  window.goToStep2 = () => {
     const inDate = document.getElementById("checkInDate").value;
     const outDate = document.getElementById("checkOutDate").value;
     const errorEl = document.getElementById("step1Error");
     
     if(!inDate || !outDate) {
        errorEl.textContent = "Vui lòng chọn ngày nhận và trả phòng.";
        errorEl.style.display = "block";
        return;
     }
     
     if(new Date(outDate) <= new Date(inDate)) {
        errorEl.textContent = "Ngày trả phòng phải sau ngày nhận phòng.";
        errorEl.style.display = "block";
        return;
     }
     
     errorEl.style.display = "none";

     const totals = window.updateBookingTotal();
     
     document.getElementById("invRoomName").textContent = `${currentBookingRoom.roomCode || currentBookingRoom.roomName} (${totals.numNights} đêm)`;
     document.getElementById("invRoomPrice").textContent = totals.roomTotal.toLocaleString("vi-VN") + " ₫";
     
     const servicesList = document.getElementById("invServicesList");
     servicesList.innerHTML = "";
     document.querySelectorAll('input[name="service"]:checked').forEach(cb => {
         const sName = cb.nextElementSibling.textContent;
         const sPrice = Number(cb.dataset.price);
         servicesList.innerHTML += `<div style="display: flex; justify-content: space-between; font-size: 0.9em; color: #64748b; margin-top: 4px;"><span>+ ${sName}</span><span>${sPrice.toLocaleString("vi-VN")} ₫</span></div>`;
     });

     document.getElementById("invSubTotal").textContent = (totals.roomTotal + totals.servicesTotal).toLocaleString("vi-VN") + " ₫";
     document.getElementById("invDiscount").textContent = "-" + totals.discount.toLocaleString("vi-VN") + " ₫";
     
     const promoSelect = document.getElementById("promotionSelect");
     const promoCode = promoSelect.value ? promoSelect.selectedOptions[0].dataset.code : "";
     document.getElementById("invPromoCode").textContent = promoCode || "";
     document.getElementById("invFinalTotal").textContent = (totals.total > 0 ? totals.total : 0).toLocaleString("vi-VN") + " ₫";

     document.getElementById("bookingStep1").style.display = "none";
     document.getElementById("bookingStep2").style.display = "block";
     if(modalHeader) modalHeader.textContent = "Đặt phòng - Bước 2: Thanh toán";
  };

  window.goToStep1 = () => {
     document.getElementById("bookingStep2").style.display = "none";
     document.getElementById("bookingStep1").style.display = "block";
     if(modalHeader) modalHeader.textContent = "Đặt phòng - Bước 1: Thông tin";
  };
  
  // Initialize Dates
  const today = new Date().toISOString().split("T")[0];
  const checkInDateEl = document.getElementById("checkInDate");
  const checkOutDateEl = document.getElementById("checkOutDate");
  
  if (checkInDateEl) {
    checkInDateEl.min = today;
    checkInDateEl.value = today;
    
    checkInDateEl.onchange = () => {
      const checkIn = checkInDateEl.value;
      if (checkIn && checkOutDateEl) {
        checkOutDateEl.min = checkIn;
        if(checkOutDateEl.value <= checkIn) {
            const nextDay = new Date(checkIn);
            nextDay.setDate(nextDay.getDate() + 1);
            checkOutDateEl.value = nextDay.toISOString().split("T")[0];
        }
      }
      window.updateBookingTotal();
    };
  }
  
  if (checkOutDateEl) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    checkOutDateEl.min = today;
    checkOutDateEl.value = tomorrow.toISOString().split("T")[0];
    checkOutDateEl.onchange = window.updateBookingTotal;
  }

  if(modalHeader) modalHeader.textContent = "Đặt phòng - Bước 1: Thông tin";
  document.getElementById("bookingModal").classList.add("open");
  window.updateBookingTotal();
}


function closeBookingModal() {
  document.getElementById("bookingModal").classList.remove("open");
  currentBookingRoom = null;
}

// Confirm booking
async function confirmBooking() {
  const checkInDate = document.getElementById("checkInDate").value;
  const checkOutDate = document.getElementById("checkOutDate").value;
  const soNguoi = Number(document.getElementById("soNguoi").value) || 1;
  const note = document.getElementById("bookingNote").value;
  
  // Get selected services
  const services = [];
  document.querySelectorAll('input[name="service"]:checked').forEach(cb => {
    services.push(Number(cb.value));
  });

  // Get selected promotion
  const promoSelect = document.getElementById("promotionSelect");
  const promotionId = promoSelect && promoSelect.value ? Number(promoSelect.value) : null;

  // Get payment method
  const paymentMethodEl = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = paymentMethodEl ? paymentMethodEl.value : "CASH";
  
  const errorMsg = document.getElementById("bookingErrorMsg");
  const successMsg = document.getElementById("bookingSuccessMsg");
  
  if (errorMsg) {
    errorMsg.style.display = "none";
    errorMsg.textContent = "";
  }
  if (successMsg) {
    successMsg.style.display = "none";
    successMsg.textContent = "";
  }
  
  // Validation
  if (!checkInDate || !checkOutDate) {
    if (errorMsg) {
      errorMsg.textContent = "Vui lòng chọn ngày nhận phòng và trả phòng";
      errorMsg.style.display = "block";
    }
    return;
  }
  
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  checkIn.setHours(0, 0, 0, 0);
  checkOut.setHours(0, 0, 0, 0);
  
    if (checkIn < today) {
    if (errorMsg) {
      errorMsg.textContent = "Ngày nhận phòng không được là ngày quá khứ";
      errorMsg.style.display = "block";
    }
    return;
  }
  
  if (checkOut <= checkIn) {
    if (errorMsg) {
      errorMsg.textContent = "Ngày trả phòng phải sau ngày nhận phòng";
      errorMsg.style.display = "block";
    }
    return;
  }
  
  if (!currentBookingRoom) {
    if (errorMsg) {
      errorMsg.textContent = "Không tìm thấy thông tin phòng";
      errorMsg.style.display = "block";
    }
    return;
  }
  
  // Check customer info completeness
  let customerInfo = JSON.parse(localStorage.getItem("customer_info") || "{}");
  
  // Try to fetch latest info if missing
  if (!customerInfo.fullName || !customerInfo.idCard) {
    try {
      const res = await apiCall("/api/customer/account");
      if (res && res.ok) {
        const account = await res.json();
        localStorage.setItem("customer_info", JSON.stringify(account));
        customerInfo = account;
      }
    } catch (e) {
      console.error("Failed to fetch account info:", e);
    }
  }

  if (!customerInfo.fullName || !customerInfo.idCard) {
    if (errorMsg) {
      errorMsg.textContent = "Vui lòng cập nhật đầy đủ thông tin cá nhân (Họ tên và Căn cước công dân) trước khi đặt phòng";
      errorMsg.style.display = "block";
    }
    setTimeout(() => {
      closeBookingModal();
      setPage("profile");
    }, 2000);
    return;
  }
  
  try {
    const res = await apiCall("/api/customer/bookings", {
      method: "POST",
      body: JSON.stringify({
        roomId: currentBookingRoom.id,
        checkInDate,
        checkOutDate,
        soNguoi,
        tienCoc: 0,
        note,
        services,
        promotionId,
        paymentMethod
      })
    });
    
    if (!res) return;
    
    const data = await res.json();
    
    if (!res.ok) {
      if (errorMsg) {
        errorMsg.textContent = data.message || "Đặt phòng thất bại";
        errorMsg.style.display = "block";
      }
      return;
    }
    
    if (successMsg) {
      successMsg.textContent = "Đặt phòng thành công! Mã đặt phòng: " + (data.booking?.bookingCode || "");
      successMsg.style.display = "block";
    }
    
    // Reload rooms and bookings after 2 seconds
    setTimeout(() => {
      loadRooms();
      loadBookings();
      closeBookingModal();
    }, 2000);
  } catch (e) {
    console.error("Error booking room:", e);
    if (errorMsg) {
      errorMsg.textContent = "Lỗi kết nối, vui lòng thử lại";
      errorMsg.style.display = "block";
    }
  }
}

// Load bookings
async function loadBookings() {
  try {
    const res = await apiCall("/api/customer/bookings");
    if (!res) return;
    
    if (!res.ok) {
      console.error("Error loading bookings");
      return;
    }
    
    bookingsCache = await res.json();
    renderBookings();
  } catch (e) {
    console.error("Error loading bookings:", e);
  }
}

// Render bookings
function renderBookings() {
  const container = document.getElementById("bookingsList");
  if (!container) return;
  
  if (bookingsCache.length === 0) {
    container.innerHTML = `
      <div class="card">
        <p style="text-align: center; padding: 40px; color: #64748b;">
          Chưa có lịch sử lưu trú.
        </p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = bookingsCache.map(booking => {
    const statusClass = getBookingStatusClass(booking.status);
    const statusText = getBookingStatusText(booking.status);
    const room = booking.room || {};
    
    // Calculate nights
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    // Calculate final amount if PAID
    let amountDisplay = "";
    if (booking.status === "PAID" || booking.status === "CHECKED_OUT") {
        // ... (calculate total)
    }

    return `
      <div class="card" style="margin-bottom: 16px; border-left: 4px solid ${getBookingStatusColor(booking.status)};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
           <div>
              <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">Phòng ${room.roomCode || room.roomName || "N/A"}</div>
              <div style="color: #64748b; font-size: 13px;">Đặt ngày: ${new Date(booking.createdAt).toLocaleDateString("vi-VN")}</div>
           </div>
           <span class="badge ${statusClass}">${statusText}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; font-size: 14px;">
           <div>
              <span style="color: #64748b;">Ngày nhận:</span>
              <div style="font-weight: 500;">${formatDate(booking.checkInDate)}</div>
           </div>
           <div>
              <span style="color: #64748b;">Ngày trả:</span>
              <div style="font-weight: 500;">${formatDate(booking.checkOutDate)}</div>
           </div>
        </div>

        <div style="display: flex; gap: 10px; border-top: 1px solid #f1f5f9; padding-top: 12px; flex-wrap: wrap;">
            <button class="btn" onclick="viewBookingRoomInfo(${booking.id})" style="flex: 1; font-size: 13px; min-width: 140px;">
               🏨 Xem chi tiết phòng
            </button>
            <button class="btn primary" onclick="viewBookingPaymentInfo(${booking.id})" style="flex: 1; font-size: 13px; min-width: 140px;">
               💳 Xem lịch sử thanh toán
            </button>
            ${booking.status === 'CHECKED_OUT' && !booking.hasFeedback ? `
            <button class="btn" onclick="openFeedbackModal(${booking.id})" style="flex: 1; font-size: 13px; background-color: #f59e0b; color: white; border: none; min-width: 140px;">
               ⭐ Đánh giá
            </button>
            ` : ""}
            ${booking.hasFeedback ? `
            <button class="btn" disabled style="flex: 1; font-size: 13px; opacity: 0.7; min-width: 140px;">
               ✅ Đã đánh giá
            </button>
            ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// Helper for status color
function getBookingStatusColor(status) {
    if (status === "PENDING") return "#eab308"; // yellow
    if (status === "PAID") return "#22c55e";    // green
    if (status === "CHECKED_IN") return "#3b82f6"; // blue
    if (status === "CHECKED_OUT") return "#64748b"; // gray
    if (status === "CANCELLED") return "#ef4444"; // red
    return "#cbd5e1";
}

// View Room Info Only (No Payment)
function viewBookingRoomInfo(bookingId) {
  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) return;
  
  const room = booking.room || {};
  const roomTypeName = getRoomTypeName(room.roomType);
  const roomIcon = getRoomIcon(room.roomType);
  const description = room.description || "Phòng đầy đủ tiện nghi.";
  const capacity = (room.bedCount || 1) * 2;
  
  // Amenities
  const amenities = getRoomAmenities(room);
  
  const modal = document.getElementById("roomDetailModal");
  const content = document.getElementById("roomDetailModalContent");
  
  content.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 48px; margin-bottom: 10px;">${roomIcon}</div>
      <h2 style="margin: 0; color: #1e293b;">${room.roomCode || room.roomName}</h2>
      <div style="color: #64748b; margin-top: 4px;">${roomTypeName} (${capacity} người)</div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="margin-bottom: 10px; color: #334155;">Mô tả</h4>
      <p style="line-height: 1.6; color: #475569;">${description}</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="margin-bottom: 10px; color: #334155;">Tiện nghi</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        ${amenities.map(a => `<div style="display: flex; align-items: center; gap: 8px; color: #475569;"><span style="color: #22c55e;">✓</span> ${a}</div>`).join("")}
      </div>
    </div>
    
    <div style="margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 14px; text-align: center; color: #64748b;">
       Thông tin phòng này thuộc mã đặt chỗ: <b>${booking.bookingCode || `#${booking.id}`}</b>
    </div>
  `;
  
  modal.classList.add("open");
}

// View Payment Info
async function viewBookingPaymentInfo(bookingId) {
    await ensureServicesAndPromotionsLoaded();
    const booking = bookingsCache.find(b => b.id === bookingId);
    if (!booking) return;

    const room = booking.room || {};
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
    
    const pricePerNight = Number(room.pricePerNight || 0);
    const roomTotal = pricePerNight * nights;

    // Services
    const serviceIds = booking.selectedServices || [];
    let servicesTotal = 0;
    const servicesListHtml = serviceIds.map(sId => {
        const s = servicesCache.find(x => x.id === sId);
        if (!s) return "";
        servicesTotal += Number(s.gia || 0);
        return `<div style="display:flex; justify-content:space-between; font-size:13px; color:#475569; margin-top:4px;">
            <span>+ ${s.tenDichVu}</span>
            <span>${Number(s.gia).toLocaleString("vi-VN")} ₫</span>
        </div>`;
    }).join("");

    // Discount
    let discountAmount = 0;
    let promoCode = "";
    if (booking.promotionId) {
        const promo = promotionsCache.find(p => p.id === booking.promotionId);
        if (promo) {
            promoCode = promo.code;
            discountAmount = ((roomTotal + servicesTotal) * (promo.discountPercent || 0)) / 100;
        }
    }

    const finalTotal = roomTotal + servicesTotal - discountAmount;
    
    // Payment Method Text
    let paymentMethodText = "Tiền mặt / Tại quầy";
    if (booking.paymentMethod === "TRANSFER") paymentMethodText = "Chuyển khoản ngân hàng";
    else if (booking.paymentMethod === "CARD") paymentMethodText = "Thẻ tín dụng";

    // Show in a modal (using the existing booking modal structure or a new one)
    // Reuse booking modal for simplicity, but just show info
    const modalContent = document.getElementById("bookingModalContent");
    const modalHeader = document.querySelector("#bookingModal .modal-header h3");
    if(modalHeader) modalHeader.textContent = "Lịch sử thanh toán";

    modalContent.innerHTML = `
        <div style="padding: 10px;">
            <div style="margin-bottom: 20px; text-align: center;">
                <div style="font-size: 16px; font-weight: 600;">Mã đặt phòng: ${booking.bookingCode || `#${booking.id}`}</div>
                <span class="badge ${getBookingStatusClass(booking.status)}">${getBookingStatusText(booking.status)}</span>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #334155;">Chi tiết hóa đơn</h4>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Phòng (${nights} đêm)</span>
                    <span>${roomTotal.toLocaleString("vi-VN")} ₫</span>
                </div>
                
                ${servicesListHtml ? `<div style="margin-bottom: 8px; padding-left: 10px; border-left: 2px solid #e2e8f0;">${servicesListHtml}</div>` : ""}
                
                ${discountAmount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #16a34a;">
                    <span>Giảm giá (${promoCode})</span>
                    <span>-${discountAmount.toLocaleString("vi-VN")} ₫</span>
                </div>` : ""}
                
                <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.2em; color: #0ea5e9; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
                    <span>TỔNG CỘNG</span>
                    <span>${finalTotal.toLocaleString("vi-VN")} ₫</span>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #334155;">Thông tin thanh toán</div>
                <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="color: #64748b;">Phương thức:</span>
                        <span style="font-weight: 500;">${paymentMethodText}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">Trạng thái:</span>
                        <span style="font-weight: 500; color: ${booking.paymentStatus === 'PAID' ? '#16a34a' : '#eab308'}">
                            ${booking.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </span>
                    </div>
                </div>
            </div>
            
            <button class="btn" onclick="closeBookingModal()" style="width: 100%;">Đóng</button>
        </div>
    `;

    document.getElementById("bookingModal").classList.add("open");
}

function getBookingStatusClass(status) {
  const classes = {
    PENDING: "pending",
    CHECKED_IN: "checked-in",
    CHECKED_OUT: "checked-out",
    CANCELLED: "cancelled",
    RESERVED: "reserved"
  };
  return classes[status] || "pending";
}

function getBookingStatusText(status) {
  const texts = {
    PENDING: "Chờ nhận phòng",
    CHECKED_IN: "Đã nhận phòng",
    CHECKED_OUT: "Đã trả phòng",
    CANCELLED: "Đã hủy",
    RESERVED: "Đã đặt"
  };
  return texts[status] || status;
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

// View booking detail with services and invoice
async function viewBookingDetail(bookingId) {
  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) return;
  
  // Use booking modal for detail view
  const modal = document.getElementById("bookingModal");
  const content = document.getElementById("bookingModalContent");
  
  // Load services/invoices
  let servicesHtml = "";
  let totalServices = 0;
  
  try {
    const servicesRes = await apiCall(`/api/services/usage/booking/${bookingId}`);
    if (servicesRes && servicesRes.ok) {
      const services = await servicesRes.json();
      if (services.length > 0) {
        servicesHtml = `
          <div style="margin-bottom: 20px;">
            <h4>Dịch vụ đã sử dụng</h4>
            <table class="table">
              <thead>
                <tr>
                  <th>Dịch vụ</th>
                  <th style="text-align: right;">Số lượng</th>
                  <th style="text-align: right;">Giá</th>
                  <th style="text-align: right;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${services.map(s => {
                  const amount = Number(s.quantity || 0) * Number(s.service?.price || 0);
                  totalServices += amount;
                  return `
                    <tr>
                      <td>${s.service?.name || "N/A"}</td>
                      <td style="text-align: right;">${s.quantity || 0}</td>
                      <td style="text-align: right;">${Number(s.service?.price || 0).toLocaleString("vi-VN")} ₫</td>
                      <td style="text-align: right;">${amount.toLocaleString("vi-VN")} ₫</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `;
      }
    }
  } catch (e) {
    console.error("Error loading services:", e);
  }
  
  const room = booking.room || {};
  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  const roomTotal = Number(room.pricePerNight || 0) * nights;
  const deposit = Number(booking.tienCoc || 0);
  const total = roomTotal + totalServices - deposit;
  
  content.innerHTML = `
    <div style="padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0;">Mã đặt phòng: ${booking.bookingCode || `#${booking.id}`}</h3>
        <span class="badge">${getBookingStatusText(booking.status)}</span>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h4>Thông tin phòng</h4>
        <table class="table">
          <tr>
            <td><b>Phòng:</b></td>
            <td>${room.roomCode || room.roomName || "N/A"}</td>
          </tr>
          <tr>
            <td><b>Loại:</b></td>
            <td>${getRoomTypeName(room.roomType) || "N/A"}</td>
          </tr>
          <tr>
            <td><b>Ngày nhận:</b></td>
            <td>${formatDate(booking.checkInDate)}</td>
          </tr>
          <tr>
            <td><b>Ngày trả:</b></td>
            <td>${formatDate(booking.checkOutDate)}</td>
          </tr>
          <tr>
            <td><b>Số đêm:</b></td>
            <td>${nights} đêm</td>
          </tr>
          <tr>
            <td><b>Số người:</b></td>
            <td>${booking.soNguoi || 1} người</td>
          </tr>
        </table>
      </div>
      
      ${servicesHtml}
      
      <div style="margin-top: 20px;">
        <h4>Hóa đơn</h4>
        <table class="table">
          <tr>
            <td>Phòng (${nights} đêm × ${Number(room.pricePerNight || 0).toLocaleString("vi-VN")} ₫)</td>
            <td style="text-align: right;">${roomTotal.toLocaleString("vi-VN")} ₫</td>
          </tr>
          ${totalServices > 0 ? `
            <tr>
              <td>Dịch vụ</td>
              <td style="text-align: right;">${totalServices.toLocaleString("vi-VN")} ₫</td>
            </tr>
          ` : ""}
          ${deposit > 0 ? `
            <tr>
              <td>Tiền cọc đã trả</td>
              <td style="text-align: right; color: #16a34a;">-${deposit.toLocaleString("vi-VN")} ₫</td>
            </tr>
          ` : ""}
          <tr style="background: #f3f4f6;">
            <td><b>Tổng cộng:</b></td>
            <td style="text-align: right;"><b>${total.toLocaleString("vi-VN")} ₫</b></td>
          </tr>
        </table>
      </div>

      ${booking.feedback ? `
        <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <h4>Đánh giá của bạn</h4>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 18px; margin-right: 8px;">${"⭐".repeat(Number(booking.feedback.rating))}</span>
              <span style="font-weight: 600;">${Number(booking.feedback.rating)}/5</span>
            </div>
            <div style="color: #475569;">${booking.feedback.comment || "Không có nhận xét"}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
              Ngày đánh giá: ${formatDate(booking.feedback.createdAt)}
            </div>
          </div>
        </div>
      ` : ""}
    </div>
  `;
  
  // Update modal header
  const modalHeader = modal.querySelector(".modal-header h3");
  if (modalHeader) {
    modalHeader.textContent = "Chi tiết đặt phòng";
  }
  
  // Add close button handler
  const btnClose = modal.querySelector("#btnCloseBookingModal");
  if (btnClose) {
    btnClose.onclick = () => {
      modal.classList.remove("open");
    };
  }
  
  modal.classList.add("open");
}

// Load profile
async function loadProfile() {
  try {
    const res = await apiCall("/api/customer/account");
    if (!res || !res.ok) {
      console.error("Error loading profile");
      return;
    }
    
    const account = await res.json();
    
    // Update display
    const viewProfileFullName = document.getElementById("viewProfileFullName");
    const viewProfileUsername = document.getElementById("viewProfileUsername");
    const viewProfileEmail = document.getElementById("viewProfileEmail");
    const viewProfilePhone = document.getElementById("viewProfilePhone");
    const viewProfileIdCard = document.getElementById("viewProfileIdCard");
    const viewProfileAddress = document.getElementById("viewProfileAddress");
    
    if (viewProfileFullName) viewProfileFullName.textContent = account.fullName || "-";
    if (viewProfileUsername) viewProfileUsername.textContent = account.username || "-";
    if (viewProfileEmail) viewProfileEmail.textContent = account.email || "-";
    if (viewProfilePhone) viewProfilePhone.textContent = account.phone || "-";
    if (viewProfileIdCard) viewProfileIdCard.textContent = account.idCard || "-";
    if (viewProfileAddress) viewProfileAddress.textContent = account.address || "-";

    // Store for edit modal
    window.currentProfile = account;
  } catch (e) {
    console.error("Error loading profile:", e);
  }
}

// Open Edit Profile Modal
function openEditProfileModal() {
  const account = window.currentProfile || {};
  document.getElementById("editProfileFullName").value = account.fullName || "";
  document.getElementById("editProfileEmail").value = account.email || "";
  document.getElementById("editProfileIdCard").value = account.idCard || "";
  document.getElementById("editProfileAddress").value = account.address || "";
  
  const errorMsg = document.getElementById("editProfileErrorMsg");
  const successMsg = document.getElementById("editProfileSuccessMsg");
  if (errorMsg) errorMsg.style.display = "none";
  if (successMsg) successMsg.style.display = "none";
  
  document.getElementById("editProfileModal").classList.add("open");
}

function closeEditProfileModal() {
  document.getElementById("editProfileModal").classList.remove("open");
}

// Handle Edit Profile Submit
async function handleEditProfileSubmit(e) {
  e.preventDefault();
  const errorMsg = document.getElementById("editProfileErrorMsg");
  const successMsg = document.getElementById("editProfileSuccessMsg");
  
  if (errorMsg) {
    errorMsg.style.display = "none";
    errorMsg.textContent = "";
  }
  if (successMsg) {
    successMsg.style.display = "none";
    successMsg.textContent = "";
  }
  
  const fullName = document.getElementById("editProfileFullName").value.trim();
  const email = document.getElementById("editProfileEmail").value.trim();
  const idCard = document.getElementById("editProfileIdCard").value.trim();
  const address = document.getElementById("editProfileAddress").value.trim();
  
  if (!fullName || !idCard) {
    if (errorMsg) {
      errorMsg.textContent = "Họ tên và Căn cước công dân là bắt buộc";
      errorMsg.style.display = "block";
    }
    return;
  }
  
  try {
    const res = await apiCall("/api/customer/account", {
      method: "PUT",
      body: JSON.stringify({
        fullName,
        email: email || null,
        idCard,
        address
      })
    });
    
    if (!res) return;
    
    const data = await res.json();
    
    if (!res.ok) {
      if (errorMsg) {
        errorMsg.textContent = data.message || "Cập nhật thất bại";
        errorMsg.style.display = "block";
      }
      return;
    }
    
    // Update localStorage
    const customerInfo = JSON.parse(localStorage.getItem("customer_info") || "{}");
    customerInfo.fullName = fullName;
    customerInfo.email = email;
    customerInfo.idCard = idCard;
    customerInfo.address = address;
    localStorage.setItem("customer_info", JSON.stringify(customerInfo));
    
    // Update display
    const uNameEl = document.getElementById("uName");
    if (uNameEl) {
      uNameEl.textContent = fullName || customerInfo.username || customerInfo.email || "Khách hàng";
    }
    
    // Reload profile to update display
    loadProfile();
    
    if (successMsg) {
      successMsg.textContent = "Cập nhật thành công!";
      successMsg.style.display = "block";
      setTimeout(() => {
        closeEditProfileModal();
      }, 1500);
    }
  } catch (e) {
    console.error("Error updating profile:", e);
    if (errorMsg) {
      errorMsg.textContent = "Lỗi kết nối, vui lòng thử lại";
      errorMsg.style.display = "block";
    }
  }
}

// Open Change Password Modal
function openChangePasswordModal() {
  document.getElementById("changePasswordForm").reset();
  const errorMsg = document.getElementById("changePasswordErrorMsg");
  const successMsg = document.getElementById("changePasswordSuccessMsg");
  if (errorMsg) errorMsg.style.display = "none";
  if (successMsg) successMsg.style.display = "none";
  document.getElementById("changePasswordModal").classList.add("open");
}

function closeChangePasswordModal() {
  document.getElementById("changePasswordModal").classList.remove("open");
}

// Handle Change Password Submit
async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;
  
  const errorMsg = document.getElementById("changePasswordErrorMsg");
  const successMsg = document.getElementById("changePasswordSuccessMsg");
  
  if (errorMsg) errorMsg.style.display = "none";
  if (successMsg) successMsg.style.display = "none";
  
  if (newPassword !== confirmNewPassword) {
    if (errorMsg) {
      errorMsg.textContent = "Mật khẩu mới không khớp";
      errorMsg.style.display = "block";
    }
    return;
  }
  
  try {
    const res = await apiCall("/api/customer/account/password", {
      method: "PUT",
      body: JSON.stringify({
        oldPassword,
        newPassword
      })
    });
    
    if (!res) return;
    
    const data = await res.json();
    
    if (!res.ok) {
      if (errorMsg) {
        errorMsg.textContent = data.message || "Đổi mật khẩu thất bại";
        errorMsg.style.display = "block";
      }
      return;
    }
    
    if (successMsg) {
      successMsg.textContent = "Đổi mật khẩu thành công!";
      successMsg.style.display = "block";
      setTimeout(() => {
        closeChangePasswordModal();
      }, 1500);
    }
  } catch (e) {
    console.error("Error changing password:", e);
    if (errorMsg) {
      errorMsg.textContent = "Lỗi kết nối, vui lòng thử lại";
      errorMsg.style.display = "block";
    }
  }
}

// Open Delete Account Modal
function openDeleteAccountModal() {
  const errorMsg = document.getElementById("deleteAccountErrorMsg");
  if (errorMsg) errorMsg.style.display = "none";
  document.getElementById("deleteAccountModal").classList.add("open");
}

function closeDeleteAccountModal() {
  document.getElementById("deleteAccountModal").classList.remove("open");
}

// Confirm Delete Account
async function confirmDeleteAccount() {
  const errorMsg = document.getElementById("deleteAccountErrorMsg");
  if (errorMsg) errorMsg.style.display = "none";
  
  try {
    const res = await apiCall("/api/customer/account", {
      method: "DELETE"
    });
    
    if (!res) return;
    
    const data = await res.json();
    
    if (!res.ok) {
      if (errorMsg) {
        errorMsg.textContent = data.message || "Xóa tài khoản thất bại";
        errorMsg.style.display = "block";
      }
      return;
    }
    
    alert("Tài khoản đã được xóa thành công.");
    logout();
  } catch (e) {
    console.error("Error deleting account:", e);
    if (errorMsg) {
      errorMsg.textContent = "Lỗi kết nối, vui lòng thử lại";
      errorMsg.style.display = "block";
    }
  }
}
