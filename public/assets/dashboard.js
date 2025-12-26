﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿// ===== Auth helpers =====
async function apiFetch(url, options = {}) {
  let token = localStorage.getItem("access_token");
  options.headers = options.headers || {};
  if (token) options.headers["Authorization"] = "Bearer " + token;

  let res = await fetch(url, { ...options, credentials: "include" });

  // auto refresh on 401
  if (res.status === 401) {
    const r = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
    if (r.ok) {
      const j = await r.json();
      localStorage.setItem("access_token", j.accessToken);
      options.headers["Authorization"] = "Bearer " + j.accessToken;
      res = await fetch(url, { ...options, credentials: "include" });
    } else {
      localStorage.removeItem("access_token");
      location.href = "/login.html";
    }
  }
  return res;
}

function badgeStatus(s) {
  const map = {
    VACANT: "Trống",
    RESERVED: "Đã đặt",
    OCCUPIED: "Có khách",
    CLEANING: "Đang dọn",
    MAINTENANCE: "Bảo trì"
  };
  return `<span class="badge">${s} - ${map[s] || ""}</span>`;
}

// ===== Navigation =====
const pages = ["overview", "rooms", "services", "customers", "promotions", "reviews", "revenue"];
function setPage(page) {
  if (!pages.includes(page)) {
    console.warn("Unknown page:", page);
    page = "overview";
  }
  
  console.log("Setting page to:", page);
  
  pages.forEach(p => {
    const pageEl = document.getElementById("page-" + p);
    const navLink = document.querySelector(`.nav a[data-page="${p}"]`);
    
    if (pageEl) {
      const isActive = p === page;
      pageEl.classList.toggle("active", isActive);
      console.log(`Page ${p}:`, isActive ? "active" : "inactive", "element:", pageEl);
    } else {
      console.warn(`Page element not found: page-${p}`);
    }
    
    if (navLink) {
      navLink.classList.toggle("active", p === page);
    }
  });
  
  const titleMap = {
    overview: "Tổng quan",
    rooms: "Quản lý phòng",
    services: "Quản lý dịch vụ",
    customers: "Quản lý thông tin khách hàng",
    promotions: "Quản lý khuyến mãi",
    revenue: "Quản lý báo cáo doanh thu"
  };
  
  const pageTitleEl = document.getElementById("pageTitle");
  if (pageTitleEl) {
    pageTitleEl.textContent = titleMap[page] || "Dashboard";
  }
  
  // Only update hash if it's different to avoid infinite loop
  if (location.hash !== "#" + page) {
    location.hash = page;
  }
}

let promotionsCache = [];
let reviewsCache = [];
let roomsCache = [];

document.querySelectorAll(".nav a").forEach(a => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    const page = a.dataset.page;
    console.log("Nav clicked, page:", page);
    setPage(page);
    
    // Load page-specific data
    if (page === "rooms") {
      loadRooms();
    } else if (page === "overview") {
      loadOverview();
    } else if (page === "customers") {
      console.log("Loading customers on nav click");
      loadCustomers();
    } else if (page === "services") {
      loadServices();
    } else if (page === "promotions") {
      loadPromotions();
    } else if (page === "reviews") {
      loadReviews();
    } else if (page === "revenue") {
      loadRevenue();
    }
  });
});

document.getElementById("btnReload").onclick = () => {
  const page = (location.hash || "#overview").slice(1);
  if (page === "rooms") loadRooms();
  if (page === "customers") loadCustomers();
  if (page === "services") loadServices();
  if (page === "revenue") loadRevenue();
  if (page === "promotions") loadPromotions();
  loadOverview();
};

// ===== Logout =====
document.getElementById("btnLogout").onclick = async () => {
  await fetch("/auth/logout", { method: "POST", credentials: "include" });
  localStorage.removeItem("access_token");
  location.href = "/login.html";
};

// ===== User info =====
async function loadUser() {
  const res = await apiFetch("/api/dashboard");
  const data = await res.json();
  document.getElementById("uName").textContent = data?.user?.username || "User";
  document.getElementById("uRole").textContent = "Role: " + (data?.user?.role || "UNKNOWN");
}

// ===== Overview (stats from rooms) =====
let bookingsCache = [];
let customersCache = [];
let servicesCache = [];
// let promotionsCache = []; REMOVED duplicate

async function ensureServicesAndPromotionsLoaded() {
  if (servicesCache.length === 0) {
    const res = await apiFetch("/api/services");
    if (res.ok) servicesCache = await res.json();
  }
  if (promotionsCache.length === 0) {
    const res = await apiFetch("/api/promotions");
    if (res.ok) promotionsCache = await res.json();
  }
}

async function loadOverview() {
  const [roomsRes, bookingsRes, customersRes] = await Promise.all([
    apiFetch("/api/rooms"),
    apiFetch("/api/bookings"),
    apiFetch("/api/customers")
  ]);
  
  const rooms = roomsRes.ok ? await roomsRes.json() : [];
  roomsCache = Array.isArray(rooms) ? rooms : []; // Update cache safely
  const bookingsData = bookingsRes.ok ? await bookingsRes.json() : [];
  bookingsCache = Array.isArray(bookingsData) ? bookingsData : [];
  const customersData = customersRes.ok ? await customersRes.json() : [];
  customersCache = Array.isArray(customersData) ? customersData : [];
  
  const total = roomsCache.length;
  const vacant = roomsCache.filter(r => r.status === "VACANT").length;
  const occupied = roomsCache.filter(r => r.status === "OCCUPIED").length;
  const reserved = roomsCache.filter(r => r.status === "RESERVED").length;
  const other = total - vacant - occupied - reserved;

  document.getElementById("stTotal").textContent = total;
  document.getElementById("stVacant").textContent = vacant;
  document.getElementById("stOccupied").textContent = occupied;
  document.getElementById("stOther").textContent = other;

  // Render rooms by status
  renderRoomsOverview(rooms);
}

function renderRoomsOverview(rooms) {
  // Phòng trống (VACANT) - có nút check-in
  const vacantRooms = rooms.filter(r => r.status === "VACANT");
  const vacantDiv = document.getElementById("roomsVacantOverview");
  if (vacantDiv) {
    if (vacantRooms.length === 0) {
      vacantDiv.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Không có phòng trống</div>';
    } else {
      vacantDiv.innerHTML = vacantRooms.map(r => `
        <div class="room-box room-vacant" style="cursor:pointer;padding:15px;border:1px solid #e2e8f0;border-radius:8px;margin:8px;display:inline-block;min-width:150px">
          <div style="font-weight:bold;font-size:18px;margin-bottom:8px">${r.roomCode || r.roomName || `Phòng ${r.id}`}</div>
          <div class="muted" style="margin-bottom:10px">${r.roomType || ""} - ${Number(r.pricePerNight || 0).toLocaleString("vi-VN")} VNĐ/đêm</div>
          <button class="btn primary" data-view-room="${r.id}" style="width:100%">Xem chi tiết</button>
        </div>
      `).join("");
      

      // Bind detail buttons
      vacantDiv.querySelectorAll("[data-view-room]").forEach(btn => {
        btn.onclick = () => viewRoomDetails(Number(btn.dataset.viewRoom));
      });

    }
  }

  // Phòng đã đặt (RESERVED) - hiển thị thông tin booking
  const reservedRooms = rooms.filter(r => r.status === "RESERVED");
  const reservedDiv = document.getElementById("roomsReservedOverview");
  if (reservedDiv) {
    if (reservedRooms.length === 0) {
      reservedDiv.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Không có phòng đã đặt</div>';
    } else {
      reservedDiv.innerHTML = reservedRooms.map(r => {
        const booking = bookingsCache.find(b => b.roomId === r.id && b.status === "PENDING");
        const customer = booking ? customersCache.find(c => c.id === booking.customerId) : null;
        const customerName = customer ? (customer.fullName || customer.hoTen || "N/A") : "N/A";
        const checkInDate = booking ? booking.checkInDate : "";
        const checkOutDate = booking ? booking.checkOutDate : "";
        
        return `
          <div class="room-box room-reserved" style="cursor:pointer;padding:15px;border:1px solid #fbbf24;border-radius:8px;margin:8px;display:inline-block;min-width:200px;background:#fef3c7">
            <div style="font-weight:bold;font-size:18px;margin-bottom:8px">${r.roomCode || r.roomName || `Phòng ${r.id}`}</div>
            <div class="muted" style="margin-bottom:5px"><b>Khách:</b> ${customerName}</div>
            <div class="muted" style="margin-bottom:5px"><b>Nhận:</b> ${checkInDate}</div>
            <div class="muted" style="margin-bottom:10px"><b>Trả:</b> ${checkOutDate}</div>
            <button class="btn" data-view-booking="${booking ? booking.id : r.id}" style="width:100%">Xem chi tiết</button>
          </div>
        `;
      }).join("");
      
      // Bind view booking buttons
      reservedDiv.querySelectorAll("[data-view-booking]").forEach(btn => {
        btn.onclick = () => openBookingInfoModal(Number(btn.dataset.viewBooking));
      });
    }
  }

  // Phòng đang có khách (OCCUPIED) - có nút check-out
  const occupiedRooms = rooms.filter(r => r.status === "OCCUPIED");
  const occupiedDiv = document.getElementById("roomsOccupiedOverview");
  if (occupiedDiv) {
    if (occupiedRooms.length === 0) {
      occupiedDiv.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Không có phòng đang có khách</div>';
    } else {
      occupiedDiv.innerHTML = occupiedRooms.map(r => {
        const booking = bookingsCache.find(b => b.roomId === r.id && b.status === "CHECKED_IN");
        const customer = booking ? customersCache.find(c => c.id === booking.customerId) : null;
        const customerName = customer ? (customer.fullName || customer.hoTen || "N/A") : "N/A";
        
        return `
          <div class="room-box room-occupied" style="cursor:pointer;padding:15px;border:1px solid #10b981;border-radius:8px;margin:8px;display:inline-block;min-width:200px;background:#d1fae5">
            <div style="font-weight:bold;font-size:18px;margin-bottom:8px">${r.roomCode || r.roomName || `Phòng ${r.id}`}</div>
            <div class="muted" style="margin-bottom:10px"><b>Khách:</b> ${customerName}</div>
            <button class="btn primary" data-checkout="${booking ? booking.id : r.id}" style="width:100%">Check-out</button>
          </div>
        `;
      }).join("");
      
      // Bind check-out buttons
      occupiedDiv.querySelectorAll("[data-checkout]").forEach(btn => {
        btn.onclick = () => openCheckOutModal(Number(btn.dataset.checkout));
      });
    }
  }

  // Phòng bận (CLEANING, MAINTENANCE)
  const maintenanceRooms = rooms.filter(r => r.status === "CLEANING" || r.status === "MAINTENANCE");
  const maintenanceDiv = document.getElementById("roomsMaintenanceOverview");
  if (maintenanceDiv) {
    if (maintenanceRooms.length === 0) {
      maintenanceDiv.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Không có phòng đang vệ sinh/bảo dưỡng</div>';
    } else {
      maintenanceDiv.innerHTML = maintenanceRooms.map(r => {
        const statusText = r.status === "CLEANING" ? "Đang vệ sinh" : "Bảo dưỡng";
        return `
          <div class="room-box room-maintenance" style="padding:15px;border:1px solid #6b7280;border-radius:8px;margin:8px;display:inline-block;min-width:150px;background:#f3f4f6">
            <div style="font-weight:bold;font-size:18px;margin-bottom:8px">${r.roomCode || r.roomName || `Phòng ${r.id}`}</div>
            <div class="muted">${statusText}</div>
          </div>
        `;
      }).join("");
    }
  }
}

// ===== Rooms CRUD UI =====
// let roomsCache = []; REMOVED duplicate
let currentRoomFilter = ""; // "" = all
let editingId = null;

const modal = document.getElementById("roomModal");
const openModal = () => modal.classList.add("open");
const closeModal = () => modal.classList.remove("open");

document.getElementById("btnCloseModal").onclick = closeModal;
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

document.getElementById("btnAddRoom").onclick = () => {
  editingId = null;
  document.getElementById("modalTitle").textContent = "Thêm phòng";
  
  // Enable inputs
  document.querySelectorAll('#roomModal input, #roomModal select, #roomModal textarea').forEach(el => el.disabled = false);
  document.getElementById("btnSaveRoom").style.display = "block";

  document.getElementById("roomCode").value = "";
  document.getElementById("roomName").value = "";
  document.getElementById("floor").value = 1;
  document.getElementById("roomType").value = "STANDARD";
  document.getElementById("pricePerNight").value = 0;
  document.getElementById("bedCount").value = 1;
  // Clear amenities checkboxes
  document.querySelectorAll('#amenitiesContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById("amenities").value = "";
  
  document.getElementById("description").value = "";
  document.getElementById("status").value = "VACANT";
  document.getElementById("note").value = "";
  openModal();
};

document.getElementById("btnSaveRoom").onclick = async () => {
  // Gather amenities
  const checkedAmenities = Array.from(document.querySelectorAll('#amenitiesContainer input[type="checkbox"]:checked'))
    .map(cb => cb.value)
    .join(", ");
    
  const payload = {
    roomCode: document.getElementById("roomCode").value.trim(),
    roomName: document.getElementById("roomName").value.trim(),
    floor: Number(document.getElementById("floor").value || 1),
    roomType: document.getElementById("roomType").value,
    pricePerNight: Number(document.getElementById("pricePerNight").value || 0),
    bedCount: Number(document.getElementById("bedCount").value || 1),
    amenities: checkedAmenities,
    description: document.getElementById("description").value.trim(),
    status: document.getElementById("status").value,
    note: document.getElementById("note").value.trim()
  };

  if (!payload.roomCode) return alert("Mã phòng không được để trống");

  let res;
  if (editingId == null) {
    res = await apiFetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } else {
    res = await apiFetch("/api/rooms/" + editingId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.message || "Lỗi lưu phòng");

  closeModal();
  await loadRooms();
  await loadOverview();
};

// Filter Tabs Logic
document.querySelectorAll(".status-filter").forEach(btn => {
  btn.addEventListener("click", () => {
    // Remove active class from all
    document.querySelectorAll(".status-filter").forEach(b => b.classList.remove("active"));
    // Add active to clicked
    btn.classList.add("active");
    // Set filter
    currentRoomFilter = btn.dataset.filter;
    renderRooms();
  });
});

async function loadRooms() {
  try {
    const [roomsRes, bookingsRes, customersRes] = await Promise.all([
      apiFetch("/api/rooms"),
      apiFetch("/api/bookings"),
      apiFetch("/api/customers")
    ]);

    roomsCache = roomsRes.ok ? await roomsRes.json() : [];
    const bookings = bookingsRes.ok ? await bookingsRes.json() : [];
    const customersList = customersRes.ok ? await customersRes.json() : [];

    // Map booking info to rooms
    roomsCache.forEach(room => {
      room.currentBooking = null;
      room.customer = null;
      
      if (room.status === "OCCUPIED" || room.status === "RESERVED") {
        // Find relevant booking (latest active one)
        // For OCCUPIED: status CHECKED_IN
        // For RESERVED: status CONFIRMED
        const booking = bookings.find(b => 
          b.roomId === room.id && 
          (
            (room.status === "OCCUPIED" && b.status === "CHECKED_IN") ||
            (room.status === "RESERVED" && b.status === "CONFIRMED")
          )
        );
        
        if (booking) {
          room.currentBooking = booking;
          room.customer = Array.isArray(customersList) 
            ? customersList.find(c => c.id === booking.customerId)
            : null;
        }
      }
    });

    updateRoomCounts();
    renderRooms();
  } catch (e) {
    console.error("Error loading rooms:", e);
  }
}

function updateRoomCounts() {
  const counts = {
    "": roomsCache.length,
    "VACANT": 0, "OCCUPIED": 0, "RESERVED": 0, "CLEANING": 0
  };
  
  roomsCache.forEach(r => {
    if (counts[r.status] !== undefined) counts[r.status]++;
    // Handle others (MAINTENANCE etc) if needed, but for now specific keys
  });
  
  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if(el) el.textContent = `(${txt})`;
  };
  
  setTxt("count-all", counts[""]);
  setTxt("count-vacant", counts["VACANT"]);
  setTxt("count-occupied", counts["OCCUPIED"]);
  setTxt("count-reserved", counts["RESERVED"]);
  setTxt("count-cleaning", counts["CLEANING"]);
}

function renderRooms() {
  const grid = document.getElementById("roomsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const filtered = currentRoomFilter 
    ? roomsCache.filter(r => r.status === currentRoomFilter) 
    : roomsCache;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="muted" style="grid-column: 1/-1; text-align: center; padding: 40px;">Không có phòng nào.</div>`;
    return;
  }

  filtered.forEach(r => {
    const card = document.createElement("div");
    card.className = "room-card";
    
    // Status Badge Logic
    let statusClass = r.status.toLowerCase();
    let statusText = r.status;
    if (r.status === "VACANT") statusText = "Trống";
    if (r.status === "OCCUPIED") statusText = "Đã Thuê";
    if (r.status === "RESERVED") statusText = "Đặt Trước";
    if (r.status === "CLEANING") statusText = "Đang Dọn";
    if (r.status === "MAINTENANCE") statusText = "Bảo Trì";

    // Customer Info HTML
    let customerHtml = "";
    if (r.status === "OCCUPIED" || r.status === "RESERVED") {
      const cusName = r.customer ? r.customer.fullName : "Khách vãng lai";
      const dates = r.currentBooking 
        ? `${formatDate(r.currentBooking.checkInDate)} - ${formatDate(r.currentBooking.checkOutDate)}`
        : "Chưa có ngày";
        
      customerHtml = `
        <div class="room-customer-info">
          <div class="room-customer-detail">
            <span class="room-customer-name">Khách: ${cusName}</span>
          </div>
          <div class="room-date">
             📅 ${dates}
          </div>
        </div>
      `;
    } else {
      customerHtml = `
        <div class="room-customer-info empty">
          Chưa có khách thuê
        </div>
      `;
    }

    card.innerHTML = `
      <div class="room-card-header">
        <span class="room-status-badge ${statusClass}">${statusText}</span>
        <div style="cursor:pointer" onclick="toggleActionMenu(${r.id})">⋮</div>
      </div>
      
      <div class="room-number">${r.roomCode}</div>
      <div class="room-type">${r.roomType || "Phòng"} - Tầng ${r.floor}</div>
      <div class="room-price ${statusClass}">
        ${Number(r.pricePerNight || 0).toLocaleString("vi-VN")} đ
      </div>
      
      ${customerHtml}
      
      <div class="room-card-actions">
        <button class="btn-details" onclick="viewRoomDetails(${r.id})">Chi tiết</button>
        <div class="action-menu-container" style="position: relative; display: inline-block;">
          <button class="btn-actions" onclick="toggleActionMenu(${r.id}, this)">Hành động</button>
          <div id="action-menu-${r.id}" class="action-menu-dropdown" style="display: none; position: absolute; bottom: 100%; right: 0; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10; min-width: 120px; text-align: left;">
            <div onclick="editRoom(${r.id})" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;">✎ Sửa</div>
            <div onclick="deleteRoom(${r.id})" style="padding: 8px 12px; cursor: pointer; color: red;">🗑 Xóa</div>
          </div>
        </div>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

window.editRoom = function(id) {
  const r = roomsCache.find(x => x.id === id);
  if (!r) return;
  editingId = id;
  document.getElementById("modalTitle").textContent = "Sửa phòng";
  
  // Enable inputs
  document.querySelectorAll('#roomModal input, #roomModal select, #roomModal textarea').forEach(el => el.disabled = false);
  document.getElementById("btnSaveRoom").style.display = "block";

  document.getElementById("roomCode").value = r.roomCode || "";
  document.getElementById("roomName").value = r.roomName || "";
  document.getElementById("floor").value = r.floor ?? 1;
  document.getElementById("roomType").value = r.roomType || "STANDARD";
  document.getElementById("pricePerNight").value = r.pricePerNight ?? 0;
  document.getElementById("bedCount").value = r.bedCount ?? 1;
  
  // Load amenities
  const currentAmenities = (r.amenities || "").split(",").map(s => s.trim());
  document.querySelectorAll('#amenitiesContainer input[type="checkbox"]').forEach(cb => {
    cb.checked = currentAmenities.includes(cb.value);
  });
  
  document.getElementById("description").value = r.description || "";
  document.getElementById("status").value = r.status || "VACANT";
  document.getElementById("note").value = r.note || "";
  openModal();
};

window.viewRoomDetails = function(id) {
  const r = roomsCache.find(x => x.id === id);
  if (!r) return;
  
  document.getElementById("modalTitle").textContent = "Chi tiết phòng";
  
  document.getElementById("roomCode").value = r.roomCode || "";
  document.getElementById("roomName").value = r.roomName || "";
  document.getElementById("floor").value = r.floor ?? 1;
  document.getElementById("roomType").value = r.roomType || "STANDARD";
  document.getElementById("pricePerNight").value = r.pricePerNight ?? 0;
  document.getElementById("bedCount").value = r.bedCount ?? 1;
  
  // Load amenities
  const currentAmenities = (r.amenities || "").split(",").map(s => s.trim());
  document.querySelectorAll('#amenitiesContainer input[type="checkbox"]').forEach(cb => {
    cb.checked = currentAmenities.includes(cb.value);
  });
  
  document.getElementById("description").value = r.description || "";
  document.getElementById("status").value = r.status || "VACANT";
  document.getElementById("note").value = r.note || "";
  
  // Disable inputs
  document.querySelectorAll('#roomModal input, #roomModal select, #roomModal textarea').forEach(el => el.disabled = true);
  document.getElementById("btnSaveRoom").style.display = "none";
  
  openModal();
};

window.deleteRoom = async function(id) {
  if (!confirm("Bạn có chắc chắn muốn xóa phòng này?")) return;
  
  try {
    const res = await apiFetch("/api/rooms/" + id, { method: "DELETE" });
    if (res.ok) {
      alert("Xóa phòng thành công");
      await loadRooms();
      await loadOverview();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Không thể xóa phòng (có thể đang có khách?)");
    }
  } catch (e) {
    console.error(e);
    alert("Lỗi kết nối");
  }
};

// Global click listener to close action menus
document.addEventListener('click', function(e) {
  if (!e.target.closest('.action-menu-container')) {
    document.querySelectorAll('.action-menu-dropdown').forEach(el => el.style.display = 'none');
  }
});

window.toggleActionMenu = function(id, btn) {
  // Close others
  document.querySelectorAll('.action-menu-dropdown').forEach(el => el.style.display = 'none');
  
  const menu = document.getElementById(`action-menu-${id}`);
  if (menu) {
    if (menu.style.display === 'block') {
      menu.style.display = 'none';
    } else {
      menu.style.display = 'block';
      // Optional: positioning if needed, but relative parent handles it
    }
  }
};

// ===== Customers CRUD UI =====
let editingCustomerId = null;

const customerModal = document.getElementById("customerModal");
const openCustomerModal = () => {
  if (customerModal) customerModal.classList.add("open");
};
const closeCustomerModal = () => {
  if (customerModal) customerModal.classList.remove("open");
};

const btnCloseCustomerModal = document.getElementById("btnCloseCustomerModal");
if (btnCloseCustomerModal) {
  btnCloseCustomerModal.onclick = closeCustomerModal;
}
if (customerModal) {
  customerModal.addEventListener("click", (e) => { if (e.target === customerModal) closeCustomerModal(); });
}

const btnAddCustomer = document.getElementById("btnAddCustomer");
if (btnAddCustomer) {
  btnAddCustomer.onclick = () => {
    editingCustomerId = null;
    document.getElementById("customerModalTitle").textContent = "Thêm khách hàng";
    document.getElementById("customerFullName").value = "";
    document.getElementById("customerEmail").value = "";
    document.getElementById("customerPhone").value = "";
    document.getElementById("customerIdCard").value = "";
    document.getElementById("customerAddress").value = "";
    openCustomerModal();
  };
}

const btnSaveCustomer = document.getElementById("btnSaveCustomer");
if (btnSaveCustomer) {
  btnSaveCustomer.onclick = async () => {
  const payload = {
    fullName: document.getElementById("customerFullName").value.trim(),
    email: document.getElementById("customerEmail").value.trim() || null,
    phone: document.getElementById("customerPhone").value.trim(),
    idCard: document.getElementById("customerIdCard").value.trim() || null,
    address: document.getElementById("customerAddress").value.trim() || null
  };

  if (!payload.fullName) return alert("Họ tên không được để trống");
  if (!payload.phone) return alert("Số điện thoại không được để trống");

  let res;
  if (editingCustomerId == null) {
    res = await apiFetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } else {
    res = await apiFetch("/api/customers/" + editingCustomerId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.message || "Lỗi lưu khách hàng");

  closeCustomerModal();
  await loadCustomers();
  };
}

const filterCustomerEl = document.getElementById("filterCustomer");
if (filterCustomerEl) {
  filterCustomerEl.addEventListener("input", () => renderCustomers());
}

async function loadCustomers() {
  try {
    console.log("Loading customers from API...");
    const res = await apiFetch("/api/customers");
    console.log("API response status:", res.status, res.ok);
    
    if (res.ok) {
      customersCache = await res.json();
      console.log("Loaded customers:", customersCache.length);
    } else {
      console.warn("API returned error:", res.status);
      customersCache = [];
    }
    
    renderCustomers();
  } catch (error) {
    console.error("Error loading customers:", error);
    customersCache = [];
    renderCustomers();
  }
}

function renderCustomers() {
  console.log("Rendering customers, cache size:", customersCache.length);
  
  const tbody = document.querySelector("#customersTable tbody");
  if (!tbody) {
    console.error("customersTable tbody not found - checking if page exists");
    const pageEl = document.getElementById("page-customers");
    console.log("page-customers element:", pageEl);
    if (pageEl) {
      console.log("page-customers classes:", pageEl.className);
      console.log("page-customers display:", window.getComputedStyle(pageEl).display);
    }
    return;
  }
  
  tbody.innerHTML = "";

  const filterInput = document.getElementById("filterCustomer");
  const filter = filterInput ? filterInput.value.toLowerCase() : "";
  const rows = filter
    ? customersCache.filter(c =>
        (c.fullName || "").toLowerCase().includes(filter) ||
        (c.email || "").toLowerCase().includes(filter) ||
        (c.phone || "").toLowerCase().includes(filter)
      )
    : customersCache;
  
  console.log("Filtered rows:", rows.length);

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8" style="text-align:center;padding:40px;color:#64748b">Chưa có khách hàng nào. Hãy thêm khách hàng mới!</td>`;
    tbody.appendChild(tr);
  } else {
    rows.forEach(c => {
      const tr = document.createElement("tr");
      const createdDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString("vi-VN") : "";
      tr.innerHTML = `
        <td><b>${c.id}</b></td>
        <td>${c.fullName || ""}</td>
        <td>${c.email || "<span class='muted'>-</span>"}</td>
        <td>${c.phone || ""}</td>
        <td class="muted">${c.idCard || "-"}</td>
        <td class="muted">${c.address || "-"}</td>
        <td class="muted">${createdDate}</td>
        <td>
          <button class="btn" data-edit-customer="${c.id}">Sửa</button>
          <button class="btn danger" data-del-customer="${c.id}">Xóa</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  tbody.querySelectorAll("[data-edit-customer]").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.editCustomer);
      const c = customersCache.find(x => x.id === id);
      if (!c) return;

      editingCustomerId = id;
      document.getElementById("customerModalTitle").textContent = "Sửa khách hàng";
      document.getElementById("customerFullName").value = c.fullName || "";
      document.getElementById("customerEmail").value = c.email || "";
      document.getElementById("customerPhone").value = c.phone || "";
      document.getElementById("customerIdCard").value = c.idCard || "";
      document.getElementById("customerAddress").value = c.address || "";
      openCustomerModal();
    };
  });

  tbody.querySelectorAll("[data-del-customer]").forEach(btn => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.delCustomer);
      if (!confirm("Xóa khách hàng này?")) return;

      const res = await apiFetch("/api/customers/" + id, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.message || "Lỗi xóa khách hàng");

      await loadCustomers();
    };
  });
}

// Helper function for date formatting
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// ===== Modal Handlers for Room Management =====
let currentCheckInRoomId = null;
let currentBookingId = null;
let currentCheckOutBookingId = null;
let currentEditCustomerId = null;

// Check-in Modal (for vacant rooms) - Removed

// Booking Info Modal (for reserved rooms)
async function openBookingInfoModal(bookingId) {
  currentBookingId = bookingId;
  await ensureServicesAndPromotionsLoaded();

  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) {
    alert("Không tìm thấy thông tin đặt phòng");
    return;
  }

  const room = roomsCache.find(r => r.id === booking.roomId);
  const customer = customersCache.find(c => c.id === booking.customerId);
  
  // Calculate Service Price
  let servicesHtml = '<div class="muted">Không sử dụng dịch vụ</div>';
  let servicesTotal = 0;
  if (booking.services && booking.services.length > 0) {
    const selectedServices = servicesCache.filter(s => booking.services.includes(s.id));
    if (selectedServices.length > 0) {
       servicesHtml = '<ul style="padding-left: 20px; margin: 5px 0;">' + 
            selectedServices.map(s => `<li>${s.tenDichVu} (${Number(s.gia).toLocaleString("vi-VN")} đ)</li>`).join("") + 
            '</ul>';
       servicesTotal = selectedServices.reduce((sum, s) => sum + (s.gia || 0), 0);
    }
  }

  // Calculate Promotion Discount
  let promotionHtml = '<div class="muted">Không áp dụng</div>';
  let discountAmount = 0;
  
  // Calculate Room Price for context
  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);
  const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
  const roomPrice = (room ? (room.pricePerNight || 0) : 0) * nights;

  if (booking.promotionId) {
      const promo = promotionsCache.find(p => p.id === booking.promotionId);
      if (promo) {
          const baseTotal = roomPrice + servicesTotal;
          discountAmount = (baseTotal * (promo.discountPercent || 0)) / 100;
          promotionHtml = `<div><span class="badge success">${promo.code}</span> - Giảm ${promo.discountPercent}% (${discountAmount.toLocaleString("vi-VN")} đ)</div>`;
      }
  }

  const totalAmount = roomPrice + servicesTotal - discountAmount;
  const finalAmount = Math.max(0, totalAmount);

  const content = document.getElementById("bookingInfoContent");
  content.innerHTML = `
    <div style="margin-bottom:15px">
      <div><b>Mã đặt phòng:</b> ${booking.bookingCode || ""}</div>
      <div><b>Phòng:</b> ${room ? (room.roomCode || room.roomName) : ""}</div>
      <div><b>Trạng thái:</b> ${badgeStatus(booking.status)}</div>
    </div>
    <div style="margin-bottom:15px">
      <h4 style="margin-bottom:10px">Thông tin khách hàng</h4>
      <div><b>Họ tên:</b> ${customer ? (customer.fullName || customer.hoTen || "") : ""}</div>
      <div><b>Số điện thoại:</b> ${customer ? (customer.phone || customer.sdt || "") : ""}</div>
      <div><b>Căn cước công dân:</b> ${customer ? (customer.idCard || customer.cccd || "") : ""}</div>
      <div><b>Email:</b> ${customer ? (customer.email || "") : ""}</div>
      <div><b>Địa chỉ:</b> ${customer ? (customer.address || customer.diaChi || "") : ""}</div>
    </div>
    <div style="margin-bottom:15px">
      <h4 style="margin-bottom:10px">Thông tin đặt phòng</h4>
      <div><b>Ngày nhận:</b> ${booking.checkInDate || ""}</div>
      <div><b>Ngày trả:</b> ${booking.checkOutDate || ""}</div>
      <div><b>Số người:</b> ${booking.soNguoi || 1}</div>
      <div><b>Ghi chú:</b> ${booking.note || ""}</div>
    </div>
    <div style="margin-bottom:15px; background: #f8fafc; padding: 10px; border-radius: 6px;">
      <h4 style="margin-bottom:10px">Chi tiết thanh toán</h4>
      <div><b>Dịch vụ thêm:</b> ${servicesHtml}</div>
      <div><b>Khuyến mãi:</b> ${promotionHtml}</div>
      <hr style="margin: 10px 0; border-top: 1px dashed #ccc;">
      <div style="display:flex; justify-content:space-between"><span>Tiền phòng (${nights} đêm):</span> <span>${roomPrice.toLocaleString("vi-VN")} đ</span></div>
      <div style="display:flex; justify-content:space-between"><span>Tiền dịch vụ:</span> <span>${servicesTotal.toLocaleString("vi-VN")} đ</span></div>
      <div style="display:flex; justify-content:space-between; color: green"><span>Giảm giá:</span> <span>-${discountAmount.toLocaleString("vi-VN")} đ</span></div>
      <div style="display:flex; justify-content:space-between; font-weight:bold; margin-top:5px; font-size:1.1em">
        <span>Tổng cộng:</span> 
        <span>${finalAmount.toLocaleString("vi-VN")} đ</span>
      </div>
      <div style="margin-top: 10px;">
        <b>Phương thức:</b> ${booking.paymentMethod || "CASH"} <br>
        <b>Trạng thái:</b> <span class="badge ${booking.paymentStatus === 'PAID' ? 'success' : 'warning'}">${booking.paymentStatus || "PENDING"}</span>
      </div>
    </div>
  `;

  document.getElementById("bookingInfoModal").classList.add("open");
}

function closeBookingInfoModal() {
  document.getElementById("bookingInfoModal").classList.remove("open");
  currentBookingId = null;
}

document.getElementById("btnCloseBookingInfoModal").onclick = closeBookingInfoModal;
document.getElementById("bookingInfoModal").addEventListener("click", (e) => {
  if (e.target.id === "bookingInfoModal") closeBookingInfoModal();
});

document.getElementById("btnEditBookingCustomer").onclick = () => {
  if (!currentBookingId) return;
  const booking = bookingsCache.find(b => b.id === currentBookingId);
  if (!booking) return;
  const customer = customersCache.find(c => c.id === booking.customerId);
  if (!customer) return;
  
  currentEditCustomerId = customer.id;
  document.getElementById("editBookingCustomerFullName").value = customer.fullName || customer.hoTen || "";
  document.getElementById("editBookingCustomerEmail").value = customer.email || "";
  document.getElementById("editBookingCustomerPhone").value = customer.phone || customer.sdt || "";
  document.getElementById("editBookingCustomerIdCard").value = customer.idCard || customer.cccd || "";
  document.getElementById("editBookingCustomerAddress").value = customer.address || customer.diaChi || "";
  
  closeBookingInfoModal();
  document.getElementById("editBookingCustomerModal").classList.add("open");
};

document.getElementById("btnCancelBooking").onclick = async () => {
  if (!currentBookingId) return;
  if (!confirm("Bạn có chắc muốn huỷ đặt phòng này?")) return;
  
  try {
    const res = await apiFetch(`/api/bookings/${currentBookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "" })
    });
    
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "Huỷ đặt phòng lỗi");
      return;
    }
    
    alert("Đã huỷ đặt phòng");
    closeBookingInfoModal();
    await loadOverview();
  } catch (e) {
    alert(e.message || "Lỗi huỷ đặt phòng");
  }
};

document.getElementById("btnCheckInFromBooking").onclick = async () => {
  if (!currentBookingId) return;
  
  try {
    const res = await apiFetch(`/api/bookings/${currentBookingId}/checkin`, {
      method: "POST"
    });
    
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "Check-in lỗi");
      return;
    }
    
    alert("Check-in thành công!");
    closeBookingInfoModal();
    await loadOverview();
  } catch (e) {
    alert(e.message || "Lỗi check-in");
  }
};

// Edit Customer Modal (from booking)
function closeEditBookingCustomerModal() {
  document.getElementById("editBookingCustomerModal").classList.remove("open");
  currentEditCustomerId = null;
}

document.getElementById("btnCloseEditBookingCustomerModal").onclick = closeEditBookingCustomerModal;
document.getElementById("btnCancelEditBookingCustomer").onclick = closeEditBookingCustomerModal;
document.getElementById("editBookingCustomerModal").addEventListener("click", (e) => {
  if (e.target.id === "editBookingCustomerModal") closeEditBookingCustomerModal();
});

document.getElementById("btnSaveEditBookingCustomer").onclick = async () => {
  if (!currentEditCustomerId) return;
  
  try {
    const payload = {
      fullName: document.getElementById("editBookingCustomerFullName").value.trim(),
      email: document.getElementById("editBookingCustomerEmail").value.trim(),
      phone: document.getElementById("editBookingCustomerPhone").value.trim(),
      idCard: document.getElementById("editBookingCustomerIdCard").value.trim(),
      address: document.getElementById("editBookingCustomerAddress").value.trim()
    };

    const res = await apiFetch(`/api/customers/${currentEditCustomerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "Lỗi cập nhật khách hàng");
      return;
    }

    alert("Đã cập nhật thông tin khách hàng");
    closeEditBookingCustomerModal();
    await loadCustomers();
    await loadOverview();
  } catch (e) {
    alert(e.message || "Lỗi cập nhật");
  }
};

// Check-out Modal (for occupied rooms)
async function openCheckOutModal(bookingId) {
  currentCheckOutBookingId = bookingId;
  await ensureServicesAndPromotionsLoaded();

  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) {
    alert("Không tìm thấy thông tin booking");
    return;
  }

  const room = roomsCache.find(r => r.id === booking.roomId);
  const customer = customersCache.find(c => c.id === booking.customerId);
  
  // Tính toán
  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);
  const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
  const roomPrice = (room ? (room.pricePerNight || 0) : 0) * nights;

  // Services
  let servicesTotal = 0;
  if (booking.services && booking.services.length > 0) {
    const selectedServices = servicesCache.filter(s => booking.services.includes(s.id));
    servicesTotal = selectedServices.reduce((sum, s) => sum + (s.gia || 0), 0);
  }

  // Discount
  let discountAmount = 0;
  if (booking.promotionId) {
    const promo = promotionsCache.find(p => p.id === booking.promotionId);
    if (promo) {
        const baseTotal = roomPrice + servicesTotal;
        discountAmount = (baseTotal * (promo.discountPercent || 0)) / 100;
    }
  }

  const subTotal = roomPrice + servicesTotal - discountAmount;
  const finalAmount = Math.max(0, subTotal - (booking.tienCoc || 0));

  document.getElementById("checkOutRoomCode").textContent = room ? (room.roomCode || room.roomName) : "";
  
  const content = document.getElementById("checkOutContent");
  content.innerHTML = `
    <div style="margin-bottom:15px">
      <h4 style="margin-bottom:10px">Thông tin khách hàng</h4>
      <div><b>Họ tên:</b> ${customer ? (customer.fullName || customer.hoTen || "") : ""}</div>
      <div><b>Số điện thoại:</b> ${customer ? (customer.phone || customer.sdt || "") : ""}</div>
      <div><b>Căn cước công dân:</b> ${customer ? (customer.idCard || customer.cccd || "") : ""}</div>
    </div>
    <div style="margin-bottom:15px;padding:15px;background:#f3f4f6;border-radius:8px">
      <h4 style="margin-bottom:10px">Hóa đơn thanh toán</h4>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span>Giá phòng (${nights} đêm):</span>
        <span>${roomPrice.toLocaleString("vi-VN")} VNĐ</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span>Dịch vụ:</span>
        <span>${servicesTotal.toLocaleString("vi-VN")} VNĐ</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;color:green">
        <span>Giảm giá:</span>
        <span>-${discountAmount.toLocaleString("vi-VN")} VNĐ</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span>Tổng cộng:</span>
        <span>${subTotal.toLocaleString("vi-VN")} VNĐ</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span>Tiền cọc đã trả:</span>
        <span>- ${Number(booking.tienCoc || 0).toLocaleString("vi-VN")} VNĐ</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:2px solid #000;font-weight:bold;font-size:18px">
        <span>Tổng cần thanh toán:</span>
        <span style="color:#10b981">${finalAmount.toLocaleString("vi-VN")} VNĐ</span>
      </div>
    </div>
  `;

  document.getElementById("checkOutModal").classList.add("open");
}

function closeCheckOutModal() {
  document.getElementById("checkOutModal").classList.remove("open");
  currentCheckOutBookingId = null;
}

document.getElementById("btnCloseCheckOutModal").onclick = closeCheckOutModal;
document.getElementById("btnCancelCheckOut").onclick = closeCheckOutModal;
document.getElementById("checkOutModal").addEventListener("click", (e) => {
  if (e.target.id === "checkOutModal") closeCheckOutModal();
});

document.getElementById("btnConfirmCheckOut").onclick = async () => {
  if (!currentCheckOutBookingId) return;
  
  try {
    const res = await apiFetch(`/api/bookings/${currentCheckOutBookingId}/checkout`, {
      method: "POST"
    });
    
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "Check-out lỗi");
      return;
    }
    
    alert("Check-out thành công!");
    closeCheckOutModal();
    await loadOverview();
  } catch (e) {
    alert(e.message || "Lỗi check-out");
  }
};


// ===== Revenue Reports =====
async function loadRevenue() {
  try {
    const [bookingsRes, invoicesRes, roomsRes, customersRes] = await Promise.all([
      apiFetch("/api/bookings"),
      apiFetch("/api/services/usage/invoices"),
      apiFetch("/api/rooms"),
      apiFetch("/api/customers")
    ]);
    
    const bookings = bookingsRes.ok ? await bookingsRes.json() : [];
    const invoices = invoicesRes.ok ? await invoicesRes.json() : [];
    const rooms = roomsRes.ok ? await roomsRes.json() : [];
    const customers = customersRes.ok ? await customersRes.json() : [];
    
    // Get date filters
    const startDate = document.getElementById("revenueStartDate")?.value || "";
    const endDate = document.getElementById("revenueEndDate")?.value || "";
    
    // Filter bookings by date if provided
    let filteredBookings = bookings;
    if (startDate || endDate) {
      filteredBookings = bookings.filter(b => {
        const checkoutDate = b.checkedOutAt || b.checkOutDate;
        if (!checkoutDate) return false;
        const date = new Date(checkoutDate);
        if (startDate && date < new Date(startDate)) return false;
        if (endDate && date > new Date(endDate + "T23:59:59")) return false;
        return true;
      });
    }
    
    // Only count completed bookings (CHECKED_OUT)
    const completedBookings = filteredBookings.filter(b => b.status === "CHECKED_OUT");
    
    // Calculate revenue
    let totalRevenue = 0;
    let roomRevenue = 0;
    let serviceRevenue = 0;
    
    completedBookings.forEach(booking => {
      // Room revenue
      const roomRevenueAmount = booking.finalAmount || booking.totalAmount || 0;
      roomRevenue += roomRevenueAmount;
      totalRevenue += roomRevenueAmount;
    });
    
    // Service revenue from invoices
    invoices.forEach(invoice => {
      if (invoice.status === "PAID" || invoice.status === "COMPLETED") {
        const serviceAmount = invoice.totalAmount || 0;
        serviceRevenue += serviceAmount;
        totalRevenue += serviceAmount;
      }
    });
    
    // Update summary cards
    document.getElementById("revenueTotal").textContent = totalRevenue.toLocaleString("vi-VN");
    document.getElementById("revenueRooms").textContent = roomRevenue.toLocaleString("vi-VN");
    document.getElementById("revenueServices").textContent = serviceRevenue.toLocaleString("vi-VN");
    document.getElementById("revenueBookings").textContent = completedBookings.length;
    
    // Render revenue table
    renderRevenueTable(completedBookings, invoices, rooms, customers);
    
    // Bind filter buttons
    const btnFilter = document.getElementById("btnFilterRevenue");
    const btnReset = document.getElementById("btnResetRevenue");
    
    if (btnFilter) {
      btnFilter.onclick = () => loadRevenue();
    }
    
    if (btnReset) {
      btnReset.onclick = () => {
        document.getElementById("revenueStartDate").value = "";
        document.getElementById("revenueEndDate").value = "";
        loadRevenue();
      };
    }
  } catch (error) {
    console.error("Error loading revenue:", error);
    alert("Lỗi tải báo cáo doanh thu");
  }
}

function renderRevenueTable(bookings, invoices, rooms, customers) {
  const tbody = document.querySelector("#revenueTable tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  if (bookings.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" style="text-align:center;padding:40px;color:#64748b">Chưa có dữ liệu doanh thu</td>`;
    tbody.appendChild(tr);
    return;
  }
  
  bookings.forEach(booking => {
    const room = rooms.find(r => r.id === booking.roomId);
    const customer = customers.find(c => c.id === booking.customerId);
    const bookingInvoices = invoices.filter(inv => inv.bookingId === booking.id);
    
    const roomRevenue = booking.finalAmount || booking.totalAmount || 0;
    const serviceRevenue = bookingInvoices.reduce((sum, inv) => {
      return sum + (inv.totalAmount || 0);
    }, 0);
    const totalRevenue = roomRevenue + serviceRevenue;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${booking.bookingCode || `BK${booking.id}`}</b></td>
      <td>${room ? (room.roomCode || room.roomName) : "N/A"}</td>
      <td>${customer ? (customer.fullName || customer.hoTen || "N/A") : "N/A"}</td>
      <td>${formatDate(booking.checkInDate)}</td>
      <td>${formatDate(booking.checkOutDate || booking.checkedOutAt)}</td>
      <td>${roomRevenue.toLocaleString("vi-VN")} VNĐ</td>
      <td>${serviceRevenue.toLocaleString("vi-VN")} VNĐ</td>
      <td><b>${totalRevenue.toLocaleString("vi-VN")} VNĐ</b></td>
      <td>${badgeStatus("CHECKED_OUT")}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== Service Management =====
let editingServiceId = null;

async function loadServices() {
  const tbody = document.querySelector("#servicesTable tbody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="muted center">Đang tải...</td></tr>';

  // Get filter values
  const q = document.getElementById("searchServiceInput")?.value || "";
  const type = document.getElementById("filterServiceType")?.value || "";
  const minPrice = document.getElementById("filterServiceMinPrice")?.value || "";
  const maxPrice = document.getElementById("filterServiceMaxPrice")?.value || "";

  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (type) params.append("type", type);
  if (minPrice) params.append("minPrice", minPrice);
  if (maxPrice) params.append("maxPrice", maxPrice);

  try {
    const res = await apiFetch("/api/services?" + params.toString());
    if (!res.ok) throw new Error("Lỗi tải dữ liệu");

    const services = await res.json();
    if (services.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted center">Chưa có dịch vụ nào</td></tr>';
      return;
    }

    tbody.innerHTML = services.map(s => `
      <tr>
        <td><b>${s.tenDichVu}</b></td>
        <td>${s.loaiDichVu}</td>
        <td>${Number(s.gia).toLocaleString("vi-VN")} VNĐ</td>
        <td>${s.moTa || ""}</td>
        <td>${s.trangThai === "ACTIVE" ? '<span style="color:green">Hoạt động</span>' : '<span class="muted">Ngưng hoạt động</span>'}</td>
        <td>
          <button class="btn small" data-edit-service="${s.id}">Sửa</button>
          <button class="btn danger small" data-del-service="${s.id}">Xóa</button>
        </td>
      </tr>
    `).join("");

    // Attach events
    tbody.querySelectorAll("[data-edit-service]").forEach(btn => {
      btn.onclick = () => openEditServiceModal(Number(btn.dataset.editService), services);
    });

    tbody.querySelectorAll("[data-del-service]").forEach(btn => {
      btn.onclick = () => deleteService(Number(btn.dataset.delService));
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="6" class="muted center">Lỗi tải dữ liệu</td></tr>';
  }
}

function openEditServiceModal(id, services) {
  const modal = document.getElementById("serviceModal");
  if (!modal) return;
  
  editingServiceId = id;
  const title = document.getElementById("serviceModalTitle");
  
  if (id) {
    const s = services.find(x => x.id === id);
    if (!s) return;
    title.textContent = "Sửa dịch vụ";
    document.getElementById("svName").value = s.tenDichVu;
    document.getElementById("svType").value = s.loaiDichVu;
    document.getElementById("svPrice").value = s.gia;
    document.getElementById("svDesc").value = s.moTa || "";
    document.getElementById("svStatus").value = s.trangThai;
  } else {
    title.textContent = "Thêm dịch vụ";
    document.getElementById("svName").value = "";
    document.getElementById("svType").value = "Khác";
    document.getElementById("svPrice").value = "";
    document.getElementById("svDesc").value = "";
    document.getElementById("svStatus").value = "ACTIVE";
  }
  
  modal.classList.add("open");
}

function closeServiceModal() {
  document.getElementById("serviceModal")?.classList.remove("open");
  editingServiceId = null;
}

async function deleteService(id) {
  if (!confirm("Bạn có chắc muốn xóa dịch vụ này?")) return;
  try {
    const res = await apiFetch(`/api/services/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Lỗi xóa dịch vụ");
    }
    loadServices();
  } catch (e) {
    alert(e.message);
  }
}

// Service Event Listeners
const btnAddService = document.getElementById("btnAddService");
if (btnAddService) btnAddService.addEventListener("click", () => openEditServiceModal(null));

const btnCloseServiceModal = document.getElementById("btnCloseServiceModal");
if (btnCloseServiceModal) btnCloseServiceModal.addEventListener("click", closeServiceModal);

const btnCancelService = document.getElementById("btnCancelService");
if (btnCancelService) btnCancelService.addEventListener("click", closeServiceModal);

const serviceModal = document.getElementById("serviceModal");
if (serviceModal) serviceModal.addEventListener("click", (e) => {
  if (e.target.id === "serviceModal") closeServiceModal();
});

const btnSaveService = document.getElementById("btnSaveService");
if (btnSaveService) btnSaveService.addEventListener("click", async () => {
  const tenDichVu = document.getElementById("svName").value.trim();
  const loaiDichVu = document.getElementById("svType").value;
  const gia = Number(document.getElementById("svPrice").value);
  const moTa = document.getElementById("svDesc").value.trim();
  const trangThai = document.getElementById("svStatus").value;

  if (!tenDichVu) return alert("Tên dịch vụ không được để trống");
  if (isNaN(gia) || gia <= 0) return alert("Giá phải là số dương");

  const payload = { tenDichVu, loaiDichVu, gia, moTa, trangThai };
  
  const url = editingServiceId ? `/api/services/${editingServiceId}` : "/api/services";
  const method = editingServiceId ? "PUT" : "POST";
  
  try {
    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Lỗi lưu dịch vụ");
    }
    
    closeServiceModal();
    loadServices();
  } catch (e) {
    alert(e.message);
  }
});

const btnSearchService = document.getElementById("btnSearchService");
if (btnSearchService) btnSearchService.addEventListener("click", loadServices);

const btnResetService = document.getElementById("btnResetServiceFilters");
if (btnResetService) btnResetService.addEventListener("click", () => {
  const ids = ["searchServiceInput", "filterServiceType", "filterServiceMinPrice", "filterServiceMaxPrice"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  loadServices();
});




// Handle hash changes
window.addEventListener("hashchange", () => {
  const hash = (location.hash || "#overview").slice(1);
  const page = pages.includes(hash) ? hash : "overview";
  console.log("Hash changed to:", page);
  setPage(page);
  
  if (page === "rooms") loadRooms();
  else if (page === "overview") loadOverview();
  else if (page === "customers") loadCustomers();
  else if (page === "services") loadServices();
  else if (page === "revenue") loadRevenue();
  else if (page === "reviews") loadReviews();
  else if (page === "promotions") loadPromotions();
});

// ===== Init =====
(async () => {
  try {
    await loadUser();
    const hash = (location.hash || "#overview").slice(1);
    const page = pages.includes(hash) ? hash : "overview";
    console.log("Initial page:", page);
    setPage(page);
    
    // Always load overview for stats
    await loadOverview();
    
    // Load specific page data
    if (page === "rooms") {
      await loadRooms();
    } else if (page === "customers") {
      console.log("Loading customers page...");
      await loadCustomers();
    } else if (page === "services") {
      await loadServices();
    } else if (page === "revenue") {
      await loadRevenue();
    } else if (page === "reviews") {
      await loadReviews();
    } else if (page === "promotions") {
      await loadPromotions();
    }
    
    // Verify page is visible
    const activePage = document.querySelector(".page.active");
    console.log("Active page element:", activePage?.id);
  } catch (error) {
    console.error("Error during initialization:", error);
  }
})();
/*
async function loadPage(page) {
  const content = document.getElementById("content");
  if (!content) {
    console.error("Missing #content in dashboard.html");
    return;
  }

  // active menu
  document.querySelectorAll(".nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.page === page);
  });

  // title
  const titles = {
    overview: "Tổng quan",
    rooms: "Phòng",
    bookings: "Đặt phòng",
    services: "Dịch vụ",
    customers: "Khách hàng",
  };
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = titles[page] || "Dashboard";

  try {
    const res = await fetch(`/partials/${page}.html`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    content.innerHTML = await res.text();
    if (page === "rooms") await loadRooms();
    if (page === "overview") await loadOverview();
    if (page === "bookings") {
    await bindBookingCreate();
    await loadBookings();
    }
  } catch (err) {
    console.error("Load partial failed:", err);
    content.innerHTML = `<div class="card">Không tải được trang: ${page}</div>`;
  }
}

function getPageFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("dashboard");
  return (idx >= 0 && parts[idx + 1]) ? parts[idx + 1] : "overview";
}

// click menu
document.addEventListener("click", (e) => {
  const link = e.target.closest(".nav a[data-page]");
  if (!link) return;
  e.preventDefault();

  const page = link.dataset.page;
  const url = page === "overview" ? "/dashboard" : `/dashboard/${page}`;
  history.pushState({ page }, "", url);
  loadPage(page);
});

// load / refresh
window.addEventListener("load", () => {
  console.log("dashboard.js loaded");
  loadPage(getPageFromPath());
});

// back/forward
window.addEventListener("popstate", () => {
  loadPage(getPageFromPath());
});

*/

//bookings
// ===== BOOKINGS UI =====
// ===== BOOKINGS =====
function setBkMsg(msg, err = false) {
  const el = document.getElementById("bkMsg");
  if (!el) return;
  el.textContent = msg;
  el.style.color = err ? "crimson" : "";
}

function roomLineHTML(r, extra = "") {
  return `
    <div class="card" style="margin:8px 0">
      <div class="row" style="justify-content:space-between; align-items:center">
        <div>
          <b>${r.roomCode}</b> - ${r.roomName || ""}
          <div class="muted">Tầng ${r.floor} | ${r.roomType} | ${Number(r.pricePerNight || 0).toLocaleString("vi-VN")} /đêm</div>
          ${badgeStatus(r.status)}
        </div>
        <div class="row">${extra}</div>
      </div>
    </div>
  `;
}

async function loadBookings() {
  // load data
  const [roomsRes, cusRes, bkRes] = await Promise.all([
    apiFetch("/api/rooms"),
    apiFetch("/api/customers"),
    apiFetch("/api/bookings")
  ]);

  const rooms = roomsRes.ok ? await roomsRes.json() : [];
  const customers = cusRes.ok ? await cusRes.json() : [];
  const bookings = bkRes.ok ? await bkRes.json() : [];

  // fill selects
  const selCus = document.getElementById("bkCustomer");
  const selRoom = document.getElementById("bkRoom");

  const roomsVacant = rooms.filter(r => r.status === "VACANT");
  if (selCus) {
    selCus.innerHTML = customers.map(c =>
      `<option value="${c.id}">${c.maKhach || ""} - ${c.hoTen || ""} (${c.sdt || ""})</option>`
    ).join("");
  }
  if (selRoom) {
    selRoom.innerHTML = roomsVacant.map(r =>
      `<option value="${r.id}">${r.roomCode} - ${r.roomName || ""}</option>`
    ).join("");
  }

  // booking map
  const cusMap = new Map(customers.map(c => [String(c.id), c]));
  const active = bookings.filter(b => b.status === "PENDING" || b.status === "CHECKED_IN");
  const bookingByRoom = new Map(active.map(b => [String(b.roomId), b]));

  // group rooms
  const trong = rooms.filter(r => r.status === "VACANT");
  const daDat = rooms.filter(r => r.status === "RESERVED");
  const busy = rooms.filter(r => r.status === "CLEANING" || r.status === "MAINTENANCE");

  // render
  const elTrong = document.getElementById("roomsTrong");
  const elDaDat = document.getElementById("roomsDaDat");
  const elBusy = document.getElementById("roomsBusy");

  if (elTrong) {
    elTrong.innerHTML = trong.length
      ? trong.map(r => roomLineHTML(r, `<button class="btn" data-pick-room="${r.id}">Chọn</button>`)).join("")
      : `<div class="muted">Không có phòng trống</div>`;
  }

  if (elDaDat) {
    elDaDat.innerHTML = daDat.length
      ? daDat.map(r => {
          const b = bookingByRoom.get(String(r.id));
          if (!b) return roomLineHTML(r, `<span class="muted">Chưa có booking</span>`);

          const cus = cusMap.get(String(b.customerId));
          const name = cus?.hoTen || "Khách";
          const info = `<div class="muted">Booking <b>${b.bookingCode}</b> | ${name} | ${b.checkInDate} → ${b.checkOutDate}</div>`;

          return `
            <div class="card" style="margin:8px 0">
              <div class="row" style="justify-content:space-between; align-items:center">
                <div>
                  <b>${r.roomCode}</b> - ${r.roomName || ""}
                  ${info}
                  ${badgeStatus(r.status)}
                </div>
                <div class="row">
                  <button class="btn primary" data-checkin="${b.id}">Check-in</button>
                  <button class="btn danger" data-cancel="${b.id}">Huỷ</button>
                </div>
              </div>
            </div>
          `;
        }).join("")
      : `<div class="muted">Không có phòng đã đặt</div>`;
  }

  if (elBusy) {
    elBusy.innerHTML = busy.length
      ? busy.map(r => roomLineHTML(r)).join("")
      : `<div class="muted">Không có phòng đang dọn/bảo trì</div>`;
  }

  // bind pick room
  document.querySelectorAll("[data-pick-room]").forEach(btn => {
    btn.onclick = () => {
      document.getElementById("bkRoom").value = btn.dataset.pickRoom;
      setBkMsg("Đã chọn phòng.");
    };
  });

  // bind checkin
  document.querySelectorAll("[data-checkin]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.checkin;
      const res = await apiFetch(`/api/bookings/${id}/checkin`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setBkMsg(j.message || "Check-in lỗi", true);
      setBkMsg("Check-in thành công.");
      await loadRooms();     // cập nhật cache rooms
      await loadOverview();
      await loadBookings();
    };
  });

  // bind cancel
  document.querySelectorAll("[data-cancel]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.cancel;
      const reason = prompt("Lý do huỷ (tuỳ chọn):") || "";
      const res = await apiFetch(`/api/bookings/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setBkMsg(j.message || "Huỷ lỗi", true);
      setBkMsg("Đã huỷ đặt phòng.");
      await loadRooms();
      await loadOverview();
      await loadBookings();
    };
  });

  // bind create booking (mỗi lần load tab cũng OK)
  const btnCreate = document.getElementById("btnCreateBooking");
  if (btnCreate) {
    btnCreate.onclick = async () => {
      try {
        setBkMsg("Đang tạo...");
        const payload = {
          customerId: document.getElementById("bkCustomer").value,
          roomId: document.getElementById("bkRoom").value,
          checkInDate: document.getElementById("bkCheckIn").value,
          checkOutDate: document.getElementById("bkCheckOut").value,
          soNguoi: Number(document.getElementById("bkSoNguoi").value || 1),
          tienCoc: Number(document.getElementById("bkTienCoc").value || 0),
          note: document.getElementById("bkNote").value.trim()
        };

        if (!payload.customerId) throw new Error("Chưa chọn khách");
        if (!payload.roomId) throw new Error("Chưa chọn phòng");
        if (!payload.checkInDate || !payload.checkOutDate) throw new Error("Chưa chọn ngày");

        const res = await apiFetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.message || "Tạo booking lỗi");

        setBkMsg("Tạo đặt phòng thành công.");
        await loadRooms();
        await loadOverview();
        await loadBookings();
      } catch (e) {
        setBkMsg(e.message, true);
      }
    };
  }
}

// ===== STAFF / EMPLOYEE MANAGEMENT =====
let staffCache = [];
let shiftsCache = [];
let editingStaffId = null;
let editingShiftId = null;
let currentAssignShiftId = null;

// Staff Modal
const staffModal = document.getElementById("staffModal");
const openStaffModal = () => staffModal.classList.add("open");
const closeStaffModal = () => staffModal.classList.remove("open");

document.getElementById("btnCloseStaffModal").onclick = closeStaffModal;
staffModal.addEventListener("click", (e) => { if (e.target === staffModal) closeStaffModal(); });

document.getElementById("btnCancelStaff").onclick = closeStaffModal;

document.getElementById("btnAddStaff").onclick = () => {
  editingStaffId = null;
  document.getElementById("staffModalTitle").textContent = "Thêm tài khoản nhân viên";
  document.getElementById("staffPasswordLabel").textContent = "*";
  document.getElementById("staffUsername").value = "";
  document.getElementById("staffPassword").value = "";
  document.getElementById("staffFullName").value = "";
  document.getElementById("staffEmail").value = "";
  document.getElementById("staffPhone").value = "";
  document.getElementById("staffRole").value = "EMPLOYEE";
  document.getElementById("staffDepartment").value = "";
  document.getElementById("staffStatus").value = "ACTIVE";
  openStaffModal();
};

document.getElementById("btnSaveStaff").onclick = async () => {
  const payload = {
    username: document.getElementById("staffUsername").value.trim(),
    fullName: document.getElementById("staffFullName").value.trim(),
    email: document.getElementById("staffEmail").value.trim(),
    phone: document.getElementById("staffPhone").value.trim(),
    role: document.getElementById("staffRole").value,
    department: document.getElementById("staffDepartment").value || null,
    status: document.getElementById("staffStatus").value
  };

  if (!payload.username) return alert("Tên đăng nhập không được để trống");
  if (!payload.fullName) return alert("Họ tên không được để trống");

  // Password chỉ bắt buộc khi tạo mới
  if (!editingStaffId) {
    const password = document.getElementById("staffPassword").value.trim();
    if (!password) return alert("Mật khẩu không được để trống");
    payload.password = password;
  } else {
    // Khi sửa, chỉ gửi password nếu có thay đổi
    const password = document.getElementById("staffPassword").value.trim();
    if (password) payload.password = password;
  }

  try {
    const url = editingStaffId ? `/api/staff/${editingStaffId}` : "/api/staff";
    const method = editingStaffId ? "PUT" : "POST";

    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const j = await res.json();
    if (!res.ok) throw new Error(j.message || "Lỗi");

    alert(editingStaffId ? "Đã cập nhật nhân viên" : "Đã thêm nhân viên");
    closeStaffModal();
    await loadStaff();
  } catch (e) {
    alert(e.message || "Lỗi");
  }
};

async function loadStaff() {
  try {
    const res = await apiFetch("/api/staff");
    if (!res.ok) throw new Error("Lỗi tải danh sách nhân viên");
    staffCache = await res.json();

    const tbody = document.querySelector("#staffTable tbody");
    if (!tbody) return;

    if (staffCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px" class="muted">Chưa có nhân viên</td></tr>';
      return;
    }

    tbody.innerHTML = staffCache.map(s => {
      const roleMap = {
        EMPLOYEE: "Nhân viên",
        RECEPTIONIST: "Lễ tân",
        RESTAURANT: "Nhà hàng",
        HOUSEKEEPING: "Dọn phòng",
        MANAGER: "Quản lý"
      };
      const statusMap = {
        ACTIVE: '<span style="color:#10b981">Hoạt động</span>',
        INACTIVE: '<span style="color:#ef4444">Không hoạt động</span>'
      };

      return `
        <tr>
          <td>${s.id}</td>
          <td>${s.username || ""}</td>
          <td>${s.fullName || ""}</td>
          <td>${s.email || ""}</td>
          <td>${s.phone || ""}</td>
          <td>${roleMap[s.role] || s.role}</td>
          <td>${s.department || ""}</td>
          <td>${statusMap[s.status] || s.status}</td>
          <td>
            <button class="btn" data-edit-staff="${s.id}">Sửa</button>
            <button class="btn danger" data-delete-staff="${s.id}">Xóa</button>
          </td>
        </tr>
      `;
    }).join("");

    // Bind edit buttons
    tbody.querySelectorAll("[data-edit-staff]").forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.editStaff);
        const s = staffCache.find(x => x.id === id);
        if (!s) return;

        editingStaffId = id;
        document.getElementById("staffModalTitle").textContent = "Sửa tài khoản nhân viên";
        document.getElementById("staffPasswordLabel").textContent = "(để trống nếu không đổi)";
        document.getElementById("staffUsername").value = s.username || "";
        document.getElementById("staffPassword").value = "";
        document.getElementById("staffFullName").value = s.fullName || "";
        document.getElementById("staffEmail").value = s.email || "";
        document.getElementById("staffPhone").value = s.phone || "";
        document.getElementById("staffRole").value = s.role || "EMPLOYEE";
        document.getElementById("staffDepartment").value = s.department || "";
        document.getElementById("staffStatus").value = s.status || "ACTIVE";
        openStaffModal();
      };
    });

    // Bind delete buttons
    tbody.querySelectorAll("[data-delete-staff]").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Bạn có chắc muốn xóa nhân viên này?")) return;
        const id = Number(btn.dataset.deleteStaff);
        try {
          const res = await apiFetch(`/api/staff/${id}`, { method: "DELETE" });
          const j = await res.json();
          if (!res.ok) throw new Error(j.message || "Lỗi xóa");
          alert("Đã xóa nhân viên");
          await loadStaff();
        } catch (e) {
          alert(e.message || "Lỗi xóa nhân viên");
        }
      };
    });

    // Update monitor staff select
    const monitorSelect = document.getElementById("monitorStaffSelect");
    if (monitorSelect) {
      monitorSelect.innerHTML = '<option value="">-- Chọn nhân viên --</option>' +
        staffCache.map(s => `<option value="${s.id}">${s.fullName || s.username} (${s.username})</option>`).join("");
      monitorSelect.onchange = () => {
        const staffId = monitorSelect.value;
        if (staffId) loadShiftsByStaff(staffId);
      };
    }

    // Update assign staff select
    const assignSelect = document.getElementById("assignStaffSelect");
    if (assignSelect) {
      assignSelect.innerHTML = '<option value="">-- Chọn nhân viên --</option>' +
        staffCache.filter(s => s.status === "ACTIVE").map(s => 
          `<option value="${s.id}">${s.fullName || s.username} (${s.username})</option>`
        ).join("");
    }
  } catch (e) {
    console.error("Load staff error:", e);
  }
}

// Shift Modal
const shiftModal = document.getElementById("shiftModal");
const openShiftModal = () => shiftModal.classList.add("open");
const closeShiftModal = () => shiftModal.classList.remove("open");

document.getElementById("btnCloseShiftModal").onclick = closeShiftModal;
shiftModal.addEventListener("click", (e) => { if (e.target === shiftModal) closeShiftModal(); });

document.getElementById("btnCancelShift").onclick = closeShiftModal;

document.getElementById("btnAddShift").onclick = () => {
  editingShiftId = null;
  document.getElementById("shiftModalTitle").textContent = "Thêm ca làm";
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("shiftDate").value = today;
  document.getElementById("shiftStartTime").value = "08:00";
  document.getElementById("shiftEndTime").value = "17:00";
  document.getElementById("shiftType").value = "REGULAR";
  document.getElementById("shiftDepartment").value = "";
  document.getElementById("shiftNote").value = "";
  openShiftModal();
};

document.getElementById("btnSaveShift").onclick = async () => {
  const payload = {
    shiftDate: document.getElementById("shiftDate").value.trim(),
    startTime: document.getElementById("shiftStartTime").value.trim(),
    endTime: document.getElementById("shiftEndTime").value.trim(),
    shiftType: document.getElementById("shiftType").value,
    department: document.getElementById("shiftDepartment").value || null,
    note: document.getElementById("shiftNote").value.trim()
  };

  if (!payload.shiftDate) return alert("Ngày ca làm không được để trống");
  if (!payload.startTime) return alert("Giờ bắt đầu không được để trống");
  if (!payload.endTime) return alert("Giờ kết thúc không được để trống");

  try {
    const url = editingShiftId ? `/api/shifts/${editingShiftId}` : "/api/shifts";
    const method = editingShiftId ? "PUT" : "POST";

    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const j = await res.json();
    if (!res.ok) throw new Error(j.message || "Lỗi");

    alert(editingShiftId ? "Đã cập nhật ca làm" : "Đã thêm ca làm");
    closeShiftModal();
    await loadShifts();
  } catch (e) {
    alert(e.message || "Lỗi");
  }
};

async function loadShifts() {
  try {
    const res = await apiFetch("/api/shifts");
    if (!res.ok) throw new Error("Lỗi tải danh sách ca làm");
    shiftsCache = await res.json();

    const tbody = document.querySelector("#shiftsTable tbody");
    if (!tbody) return;

    if (shiftsCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px" class="muted">Chưa có ca làm</td></tr>';
      return;
    }

    tbody.innerHTML = shiftsCache.map(s => {
      const typeMap = {
        REGULAR: "Ca thường",
        OVERTIME: "Ca tăng ca",
        HOLIDAY: "Ca ngày lễ"
      };
      const statusMap = {
        SCHEDULED: '<span style="color:#3b82f6">Đã lên lịch</span>',
        IN_PROGRESS: '<span style="color:#10b981">Đang làm</span>',
        COMPLETED: '<span style="color:#6b7280">Hoàn thành</span>',
        CANCELLED: '<span style="color:#ef4444">Đã hủy</span>'
      };

      const assignedNames = (s.assignments || []).map(a => a.staffName || `ID:${a.staffId}`).join(", ") || "Chưa phân công";

      return `
        <tr>
          <td>${s.id}</td>
          <td>${s.shiftDate || ""}</td>
          <td>${s.startTime || ""}</td>
          <td>${s.endTime || ""}</td>
          <td>${typeMap[s.shiftType] || s.shiftType}</td>
          <td>${s.department || ""}</td>
          <td>${statusMap[s.status] || s.status}</td>
          <td>${assignedNames}</td>
          <td>
            <button class="btn" data-assign-shift="${s.id}">Phân công</button>
            <button class="btn" data-edit-shift="${s.id}">Sửa</button>
            ${s.status === "SCHEDULED" ? `<button class="btn danger" data-cancel-shift="${s.id}">Hủy</button>` : ""}
            ${s.status === "SCHEDULED" ? `<button class="btn danger" data-delete-shift="${s.id}">Xóa</button>` : ""}
          </td>
        </tr>
      `;
    }).join("");

    // Bind assign buttons
    tbody.querySelectorAll("[data-assign-shift]").forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.assignShift);
        openAssignShiftModal(id);
      };
    });

    // Bind edit buttons
    tbody.querySelectorAll("[data-edit-shift]").forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.editShift);
        const s = shiftsCache.find(x => x.id === id);
        if (!s) return;

        editingShiftId = id;
        document.getElementById("shiftModalTitle").textContent = "Sửa ca làm";
        document.getElementById("shiftDate").value = s.shiftDate || "";
        document.getElementById("shiftStartTime").value = s.startTime || "";
        document.getElementById("shiftEndTime").value = s.endTime || "";
        document.getElementById("shiftType").value = s.shiftType || "REGULAR";
        document.getElementById("shiftDepartment").value = s.department || "";
        document.getElementById("shiftNote").value = s.note || "";
        openShiftModal();
      };
    });

    // Bind cancel buttons
    tbody.querySelectorAll("[data-cancel-shift]").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Bạn có chắc muốn hủy ca làm này?")) return;
        const id = Number(btn.dataset.cancelShift);
        try {
          const res = await apiFetch(`/api/shifts/${id}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "" })
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.message || "Lỗi hủy");
          alert("Đã hủy ca làm");
          await loadShifts();
        } catch (e) {
          alert(e.message || "Lỗi hủy ca làm");
        }
      };
    });

    // Bind delete buttons
    tbody.querySelectorAll("[data-delete-shift]").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Bạn có chắc muốn xóa ca làm này?")) return;
        const id = Number(btn.dataset.deleteShift);
        try {
          const res = await apiFetch(`/api/shifts/${id}`, { method: "DELETE" });
          const j = await res.json();
          if (!res.ok) throw new Error(j.message || "Lỗi xóa");
          alert("Đã xóa ca làm");
          await loadShifts();
        } catch (e) {
          alert(e.message || "Lỗi xóa ca làm");
        }
      };
    });
  } catch (e) {
    console.error("Load shifts error:", e);
  }
}

// Assign Shift Modal
const assignShiftModal = document.getElementById("assignShiftModal");
const openAssignShiftModal = async (shiftId) => {
  currentAssignShiftId = shiftId;
  const shift = shiftsCache.find(s => s.id === shiftId);
  if (!shift) return;

  document.getElementById("assignShiftInfo").innerHTML = `
    <div><b>Ngày:</b> ${shift.shiftDate || ""}</div>
    <div><b>Giờ:</b> ${shift.startTime || ""} - ${shift.endTime || ""}</div>
    <div><b>Bộ phận:</b> ${shift.department || ""}</div>
  `;

  await loadAssignedStaff(shiftId);
  assignShiftModal.classList.add("open");
};

const closeAssignShiftModal = () => {
  assignShiftModal.classList.remove("open");
  currentAssignShiftId = null;
};

document.getElementById("btnCloseAssignShiftModal").onclick = closeAssignShiftModal;
assignShiftModal.addEventListener("click", (e) => { if (e.target === assignShiftModal) closeAssignShiftModal(); });

document.getElementById("btnCancelAssignShift").onclick = closeAssignShiftModal;

async function loadAssignedStaff(shiftId) {
  const shift = shiftsCache.find(s => s.id === shiftId);
  if (!shift) return;

  const assignedItems = document.getElementById("assignedStaffItems");
  const assignments = shift.assignments || [];

  if (assignments.length === 0) {
    assignedItems.innerHTML = '<div class="muted">Chưa có nhân viên được phân công</div>';
  } else {
    assignedItems.innerHTML = assignments.map(a => {
      return `
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <b>${a.staffName || `ID:${a.staffId}`}</b>
            <div class="muted" style="font-size:12px">Phân công: ${new Date(a.assignedAt).toLocaleString("vi-VN")}</div>
          </div>
          <button class="btn danger" data-unassign="${a.staffId}" style="font-size:12px">Gỡ phân công</button>
        </div>
      `;
    }).join("");

    assignedItems.querySelectorAll("[data-unassign]").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Bạn có chắc muốn gỡ phân công nhân viên này?")) return;
        const staffId = Number(btn.dataset.unassign);
        try {
          const res = await apiFetch(`/api/shifts/${shiftId}/unassign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ staffId })
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.message || "Lỗi");
          alert("Đã gỡ phân công");
          await loadShifts();
          await loadAssignedStaff(shiftId);
        } catch (e) {
          alert(e.message || "Lỗi");
        }
      };
    });
  }
}

document.getElementById("btnConfirmAssignShift").onclick = async () => {
  const staffId = document.getElementById("assignStaffSelect").value;
  if (!staffId) return alert("Vui lòng chọn nhân viên");

  try {
    const res = await apiFetch(`/api/shifts/${currentAssignShiftId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: Number(staffId) })
    });

    const j = await res.json();
    if (!res.ok) throw new Error(j.message || "Lỗi");

    alert("Đã phân công nhân viên");
    document.getElementById("assignStaffSelect").value = "";
    await loadShifts();
    await loadAssignedStaff(currentAssignShiftId);
  } catch (e) {
    alert(e.message || "Lỗi phân công");
  }
};

// Monitor shifts by staff
async function loadShiftsByStaff(staffId) {
  try {
    const res = await apiFetch(`/api/shifts/staff/${staffId}`);
    if (!res.ok) throw new Error("Lỗi tải ca làm");
    const shifts = await res.json();

    const listDiv = document.getElementById("monitorShiftsList");
    if (!listDiv) return;

    if (shifts.length === 0) {
      listDiv.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Nhân viên này chưa có ca làm</div>';
      return;
    }

    listDiv.innerHTML = shifts.map(s => {
      const statusMap = {
        SCHEDULED: '<span style="color:#3b82f6">Đã lên lịch</span>',
        IN_PROGRESS: '<span style="color:#10b981">Đang làm</span>',
        COMPLETED: '<span style="color:#6b7280">Hoàn thành</span>',
        CANCELLED: '<span style="color:#ef4444">Đã hủy</span>'
      };

      return `
        <div style="padding:15px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <div><b>Ngày:</b> ${s.shiftDate || ""}</div>
              <div><b>Giờ:</b> ${s.startTime || ""} - ${s.endTime || ""}</div>
              <div><b>Bộ phận:</b> ${s.department || ""}</div>
              <div><b>Trạng thái:</b> ${statusMap[s.status] || s.status}</div>
              ${s.note ? `<div><b>Ghi chú:</b> ${s.note}</div>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    console.error("Load shifts by staff error:", e);
    document.getElementById("monitorShiftsList").innerHTML = 
      '<div class="muted" style="text-align:center;padding:20px">Lỗi tải ca làm</div>';
  }
}

// ===== PROMOTIONS =====
let editingPromotionId = null;

function resetPromotionForm() {
  editingPromotionId = null;
  const title = document.getElementById("promotionModalTitle");
  if (title) title.textContent = "Thêm khuyến mãi";
  const btnSave = document.getElementById("btnSavePromotion");
  if (btnSave) btnSave.textContent = "Lưu";
  ["pmCode", "pmDesc", "pmDiscount", "pmStartDate", "pmEndDate"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const statusEl = document.getElementById("pmStatus");
  if (statusEl) statusEl.value = "ACTIVE";
}

function toInputDate(val) {
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function openPromotionForm(promo) {
  const title = document.getElementById("promotionModalTitle");
  const btnSave = document.getElementById("btnSavePromotion");
  if (promo) {
    editingPromotionId = promo.id;
    if (title) title.textContent = "Sửa khuyến mãi";
    if (btnSave) btnSave.textContent = "Cập nhật";
    document.getElementById("pmCode").value = promo.code || "";
    document.getElementById("pmDesc").value = promo.description || "";
    document.getElementById("pmDiscount").value = Number(promo.discountPercent || 0);
    document.getElementById("pmStartDate").value = toInputDate(promo.startDate);
    document.getElementById("pmEndDate").value = toInputDate(promo.endDate);
    document.getElementById("pmStatus").value = promo.status || "ACTIVE";
  } else {
    resetPromotionForm();
  }
  openPromotionModal();
}

async function loadPromotions() {
  const tbody = document.querySelector("#promotionsTable tbody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="muted center">Đang tải...</td></tr>';

  try {
    const res = await apiFetch("/api/promotions");
    if (!res.ok) throw new Error("Lỗi tải dữ liệu");

    promotionsCache = await res.json();
    if (promotionsCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted center">Chưa có khuyến mãi nào</td></tr>';
      return;
    }

    tbody.innerHTML = promotionsCache.map(p => {
      const percent = Number(p.discountPercent || 0);
      const statusText = p.status === "ACTIVE" ? '<span style="color:green">Hoạt động</span>' : '<span class="muted">Ngưng</span>';
      return `
        <tr>
          <td><b>${p.code}</b></td>
          <td>${p.description || ""}</td>
          <td>${percent}%</td>
          <td>${formatDate(p.startDate)}</td>
          <td>${formatDate(p.endDate)}</td>
          <td>${statusText}</td>
          <td>
            <button class="btn small" data-action="promo-edit" data-id="${p.id}">Sửa</button>
            <button class="btn danger small" data-action="promo-delete" data-id="${p.id}">Xóa</button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="7" class="muted center">Lỗi tải dữ liệu</td></tr>';
  }
}

// Modal Promotion
const promotionModal = document.getElementById("promotionModal");
const openPromotionModal = () => {
  if (promotionModal) {
    promotionModal.classList.add("open");
    console.log("Promotion modal opened");
  } else {
    console.error("Promotion modal not found");
  }
};
const closePromotionModal = () => {
  if (promotionModal) promotionModal.classList.remove("open");
};

// Bind events safely
// document.addEventListener("DOMContentLoaded", () => { ... }); REMOVED in favor of event delegation

// ===== REVIEWS =====
async function loadReviews() {
  const tbody = document.querySelector("#reviewsTable tbody");
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="6" class="muted center">Đang tải...</td></tr>';
  
  const res = await apiFetch("/api/reviews");
  if (!res.ok) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted center">Lỗi tải dữ liệu</td></tr>';
    return;
  }
  
  reviewsCache = await res.json();
  if (reviewsCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted center">Chưa có đánh giá nào</td></tr>';
    return;
  }
  
  tbody.innerHTML = reviewsCache.map(r => `
    <tr>
      <td>${r.customerName || "Khách"}</td>
      <td>${r.roomName || "-"}</td>
      <td>${r.rating} / 5</td>
      <td>${r.comment || ""}</td>
      <td>${r.reply ? `<div style="color:blue">Admin: ${r.reply}</div>` : '<span class="muted">Chưa phản hồi</span>'}</td>
      <td>${new Date(r.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="btn small" data-action="review-edit" data-id="${r.id}">Sửa</button>
        ${!r.reply ? `<button class="btn small" data-action="review-reply" data-id="${r.id}" data-content="${r.comment}">Phản hồi</button>` : ""}
        <button class="btn danger small" data-action="review-delete" data-id="${r.id}">Xóa</button>
      </td>
    </tr>
  `).join("");
}

// Modal Reply Review
const replyReviewModal = document.getElementById("replyReviewModal");
const openReplyReviewModal = () => replyReviewModal.classList.add("open");
const closeReplyReviewModal = () => replyReviewModal.classList.remove("open");

if (document.getElementById("btnCloseReplyReviewModal")) {
  document.getElementById("btnCloseReplyReviewModal").onclick = closeReplyReviewModal;
}

if (document.getElementById("btnSaveReplyReview")) {
  document.getElementById("btnSaveReplyReview").onclick = async () => {
    const reply = document.getElementById("replyContent").value;
    if (!reply) return alert("Vui lòng nhập nội dung phản hồi");
    
    const id = window.currentReplyReviewId;
    if (!id) return;
    
    const res = await apiFetch(`/api/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    });
    
    if (res.ok) {
      closeReplyReviewModal();
      loadReviews();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Lỗi khi lưu");
    }
  };
}

// Modal Add Review
const addReviewModal = document.getElementById("addReviewModal");
const openAddReviewModal = () => { if(addReviewModal) addReviewModal.classList.add("open"); };
const closeAddReviewModal = () => { if(addReviewModal) addReviewModal.classList.remove("open"); };

if (document.getElementById("btnCloseAddReviewModal")) {
  document.getElementById("btnCloseAddReviewModal").onclick = closeAddReviewModal;
}
if (document.getElementById("btnCancelAddReview")) {
  document.getElementById("btnCancelAddReview").onclick = closeAddReviewModal;
}

let editingReviewId = null;
function resetAddReviewForm() {
  editingReviewId = null;
  const titleEl = document.getElementById("addReviewModalTitle");
  if (titleEl) titleEl.textContent = "Thêm đánh giá mới";
  const btn = document.getElementById("btnSaveAddReview");
  if (btn) btn.textContent = "Lưu đánh giá";
  document.getElementById("newRvCustomerName").value = "";
  document.getElementById("newRvRating").value = "5";
  document.getElementById("newRvComment").value = "";
  const roomSelect = document.getElementById("newRvRoomId");
  if (roomSelect) roomSelect.value = "";
}

async function ensureRoomsLoaded() {
  if (!roomsCache || roomsCache.length === 0) {
    try {
      const rRes = await apiFetch("/api/rooms");
      if (rRes.ok) roomsCache = await rRes.json();
    } catch(e) { console.error(e); }
  }
  const roomSelect = document.getElementById("newRvRoomId");
  if (roomSelect) {
    roomSelect.innerHTML = '<option value="">-- Chọn phòng --</option>';
    (roomsCache || []).forEach(r => {
      roomSelect.innerHTML += `<option value="${r.id}">${r.roomCode || r.roomName} (${r.roomType})</option>`;
    });
  }
}

async function openReviewForm(review) {
  await ensureRoomsLoaded();
  const titleEl = document.getElementById("addReviewModalTitle");
  const btn = document.getElementById("btnSaveAddReview");
  if (review) {
    editingReviewId = review.id;
    if (titleEl) titleEl.textContent = "Sửa đánh giá";
    if (btn) btn.textContent = "Cập nhật";
    document.getElementById("newRvCustomerName").value = review.customerName || "";
    document.getElementById("newRvRating").value = String(review.rating || 5);
    document.getElementById("newRvComment").value = review.comment || "";
    const roomSelect = document.getElementById("newRvRoomId");
    if (roomSelect) roomSelect.value = review.roomId ? String(review.roomId) : "";
  } else {
    resetAddReviewForm();
  }
  openAddReviewModal();
}

if (document.getElementById("btnAddReview")) {
  document.getElementById("btnAddReview").onclick = async () => {
    resetAddReviewForm();
    await ensureRoomsLoaded();
    openAddReviewModal();
  };
}

if (document.getElementById("btnSaveAddReview")) {
  document.getElementById("btnSaveAddReview").onclick = async () => {
    const customerName = document.getElementById("newRvCustomerName").value.trim();
    const roomId = document.getElementById("newRvRoomId").value;
    const rating = document.getElementById("newRvRating").value;
    const comment = document.getElementById("newRvComment").value.trim();
    
    if (!customerName) return alert("Vui lòng nhập tên khách hàng");
    if (!roomId) return alert("Vui lòng chọn phòng");
    
    const payload = { customerName, roomId, rating, comment };
    const url = editingReviewId ? `/api/reviews/${editingReviewId}` : "/api/reviews";
    const method = editingReviewId ? "PUT" : "POST";
    
    try {
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        closeAddReviewModal();
        resetAddReviewForm();
        loadReviews();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Lỗi khi lưu");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi hệ thống");
    }
  };
}

async function handleSavePromotion() {
  console.log("Btn Save Promotion clicked");
  const codeEl = document.getElementById("pmCode");
  const descEl = document.getElementById("pmDesc");
  const discEl = document.getElementById("pmDiscount");
  const startEl = document.getElementById("pmStartDate");
  const endEl = document.getElementById("pmEndDate");
  const statusEl = document.getElementById("pmStatus");

  if (!codeEl || !descEl || !discEl || !startEl || !endEl || !statusEl) {
    console.error("Form elements not found");
    return;
  }

  const payload = {
    code: codeEl.value.trim(),
    description: descEl.value.trim(),
    discountPercent: Number(discEl.value || 0),
    startDate: startEl.value,
    endDate: endEl.value,
    status: statusEl.value
  };

  if (!payload.code) return alert("Vui lòng nhập mã khuyến mãi");
  if (!payload.startDate) return alert("Vui lòng nhập ngày bắt đầu");
  if (!payload.endDate) return alert("Vui lòng nhập ngày kết thúc");
  
  const dStart = new Date(payload.startDate);
  const dEnd = new Date(payload.endDate);
  if (dStart > dEnd) return alert("Ngày kết thúc phải sau ngày bắt đầu");
  
  if (payload.discountPercent < 0 || payload.discountPercent > 100) return alert("Giảm giá phải từ 0 đến 100%");

  try {
    const url = editingPromotionId ? `/api/promotions/${editingPromotionId}` : "/api/promotions";
    const method = editingPromotionId ? "PUT" : "POST";
    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closePromotionModal();
      resetPromotionForm();
      loadPromotions();
      alert(editingPromotionId ? "Cập nhật thành công" : "Thêm mới thành công");
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Lỗi khi lưu");
    }
  } catch (e) {
    console.error(e);
    alert("Lỗi kết nối");
  }
}

// Global event delegation for action buttons
document.addEventListener("click", async (e) => {
  // Promotions
  if (e.target.closest('[data-action="promo-add"]') || e.target.id === "btnAddPromotion") {
    console.log("CLICK Add Promotion");
    resetPromotionForm();
    openPromotionModal();
    return;
  }
  if (e.target.closest('[data-action="promo-save"]') || e.target.id === "btnSavePromotion") {
    handleSavePromotion();
    return;
  }
  if (e.target.closest('[data-action="promo-cancel"]')) {
    console.log("CLICK Cancel/Close Promotion");
    closePromotionModal();
    resetPromotionForm();
    return;
  }

  // Click outside modal
  if (e.target === promotionModal) {
      closePromotionModal();
      resetPromotionForm();
      return;
  }
  
  const promoEditBtn = e.target.closest('[data-action="promo-edit"]');
  if (promoEditBtn) {
    const id = Number(promoEditBtn.dataset.id);
    console.log("Clicked promo-edit", { id });
    try {
      const promo = promotionsCache.find(x => x.id === id);
      if (!promo) {
        alert("Không tìm thấy thông tin khuyến mãi. Vui lòng tải lại trang.");
        return;
      }
      openPromotionForm(promo);
    } catch (err) {
      console.error("promo-edit error", err);
      alert("Lỗi mở sửa khuyến mãi");
    }
    return;
  }
  const promoDeleteBtn = e.target.closest('[data-action="promo-delete"]');
  if (promoDeleteBtn) {
    const id = promoDeleteBtn.dataset.id;
    console.log("Clicked promo-delete", { id });
    try {
      const promo = promotionsCache.find(x => x.id == id);
      const confirmMsg = promo ? `Bạn có chắc chắn muốn xóa khuyến mãi "${promo.code}" không?` : "Xóa khuyến mãi này?";
      if (!confirm(confirmMsg)) return;
      
      const res = await apiFetch("/api/promotions/" + id, { method: "DELETE" });
      if (res.ok) {
        loadPromotions();
        alert("Đã xóa khuyến mãi thành công");
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Xóa khuyến mãi thất bại");
      }
    } catch (err) {
      console.error("promo-delete error", err);
      alert("Lỗi khi xóa khuyến mãi");
    }
    return;
  }
  // Reviews
  const reviewEditBtn = e.target.closest('[data-action="review-edit"]');
  if (reviewEditBtn) {
    const id = Number(reviewEditBtn.dataset.id);
    console.log("Clicked review-edit", { id });
    try {
      const review = reviewsCache.find(x => x.id === id);
      await openReviewForm(review || null);
    } catch (err) {
      console.error("review-edit error", err);
      alert("Lỗi mở sửa đánh giá");
    }
    return;
  }
  const reviewReplyBtn = e.target.closest('[data-action="review-reply"]');
  if (reviewReplyBtn) {
    const id = reviewReplyBtn.dataset.id;
    const content = reviewReplyBtn.dataset.content || "";
    console.log("Clicked review-reply", { id });
    try {
      document.getElementById("reviewContentDisplay").textContent = content;
      document.getElementById("replyContent").value = "";
      window.currentReplyReviewId = id;
      openReplyReviewModal();
    } catch (err) {
      console.error("review-reply error", err);
      alert("Lỗi mở phản hồi đánh giá");
    }
    return;
  }
  const reviewDeleteBtn = e.target.closest('[data-action="review-delete"]');
  if (reviewDeleteBtn) {
    const id = reviewDeleteBtn.dataset.id;
    console.log("Clicked review-delete", { id });
    try {
      if (!confirm("Xóa đánh giá này?")) return;
      const res = await apiFetch("/api/reviews/" + id, { method: "DELETE" });
      if (res.ok) {
        loadReviews();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Xóa đánh giá thất bại");
      }
    } catch (err) {
      console.error("review-delete error", err);
      alert("Lỗi khi xóa đánh giá");
    }
    return;
  }
});
