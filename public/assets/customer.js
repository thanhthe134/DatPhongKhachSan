// Customer Home Page JavaScript

let roomsCache = [];
let currentFilter = "all";
let currentBookingRoom = null;

// Check authentication
function checkAuth() {
  const token = localStorage.getItem("customer_access_token");
  const customerInfo = localStorage.getItem("customer_info");
  
  if (!token || !customerInfo) {
    window.location.href = "/login";
    return false;
  }
  
  try {
    const info = JSON.parse(customerInfo);
    document.getElementById("userName").textContent = info.fullName || info.email;
  } catch (e) {
    console.error("Error parsing customer info:", e);
  }
  
  return true;
}

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
  if (res.status === 401) {
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
        // Refresh failed, redirect to login
        localStorage.removeItem("customer_access_token");
        localStorage.removeItem("customer_info");
        window.location.href = "/login";
        return null;
      }
    } catch (e) {
      window.location.href = "/login";
      return null;
    }
  }
  
  return res;
}

// Load rooms
async function loadRooms() {
  try {
    const res = await apiCall("/api/customer/rooms");
    if (!res) return;
    
    if (!res.ok) {
      const data = await res.json();
      alert(data.message || "Lỗi khi tải danh sách phòng");
      return;
    }
    
    roomsCache = await res.json();
    renderRooms();
  } catch (e) {
    console.error("Error loading rooms:", e);
    alert("Lỗi kết nối, vui lòng thử lại");
  }
}

// Render rooms
function renderRooms() {
  const container = document.getElementById("roomsGridContainer");
  if (!container) return;
  
  let rooms = roomsCache || [];
  
  // Filter by status
  if (currentFilter !== "all") {
    rooms = rooms.filter(r => r.status === currentFilter);
  }
  
  if (rooms.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Không có phòng nào</h3>
        <p>Hiện tại không có phòng phù hợp với bộ lọc của bạn</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = rooms.map(room => {
    const statusClass = room.status === "VACANT" ? "vacant" : "reserved";
    const statusText = room.status === "VACANT" ? "Còn trống" : "Đã đặt";
    const roomTypeName = getRoomTypeName(room.roomType);
    const roomIcon = getRoomIcon(room.roomType);
    const price = Number(room.pricePerNight || 0).toLocaleString("vi-VN");
    const description = room.description || "Phòng đầy đủ tiện nghi, thoải mái cho kỳ nghỉ của bạn.";
    
    const canBook = room.status === "VACANT";
    
    return `
      <div class="room-card" data-room-id="${room.id}">
        <div class="room-card-header">
          <span class="room-status-badge ${statusClass}">${statusText}</span>
          <span class="room-icon">${roomIcon}</span>
        </div>
        <div class="room-number">${room.roomCode || room.roomName || `Phòng ${room.id}`}</div>
        <div class="room-type">${roomTypeName}</div>
        <div class="room-description">${description}</div>
        <div class="room-price">${price} ₫/đêm</div>
        <div class="room-card-actions">
          <button class="btn btn-primary" ${!canBook ? "disabled" : ""} data-book-room="${room.id}">
            ${canBook ? "Đặt phòng" : "Đã được đặt"}
          </button>
        </div>
      </div>
    `;
  }).join("");
  
  // Bind booking buttons
  container.querySelectorAll("[data-book-room]").forEach(btn => {
    btn.onclick = () => {
      const roomId = Number(btn.dataset.bookRoom);
      openBookingModal(roomId);
    };
  });
}

function getRoomTypeName(roomType) {
  const names = {
    STANDARD: "Phòng Tiêu chuẩn",
    SUPERIOR: "Phòng Cao cấp",
    DELUXE: "Phòng Deluxe",
    SUITE: "Phòng Suite"
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

// Filter rooms
function setupFilters() {
  document.querySelectorAll(".status-filter").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".status-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderRooms();
    };
  });
}

// Booking modal
function openBookingModal(roomId) {
  const room = roomsCache.find(r => r.id === roomId);
  if (!room) return;
  
  if (room.status !== "VACANT") {
    alert("Phòng này không còn trống");
    return;
  }
  
  currentBookingRoom = room;
  
  document.getElementById("bookingRoomCode").textContent = room.roomCode || room.roomName;
  document.getElementById("bookingRoomInfo").innerHTML = `
    <div><strong>${room.roomCode || room.roomName}</strong> - ${getRoomTypeName(room.roomType)}</div>
    <div style="margin-top: 8px; color: #64748b;">${room.description || ""}</div>
    <div style="margin-top: 8px; font-size: 18px; font-weight: 700; color: #0ea5e9;">
      ${Number(room.pricePerNight || 0).toLocaleString("vi-VN")} ₫/đêm
    </div>
  `;
  
  // Set min date to today
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("checkInDate").min = today;
  document.getElementById("checkInDate").value = today;
  document.getElementById("checkOutDate").min = today;
  document.getElementById("checkOutDate").value = "";
  document.getElementById("soNguoi").value = 1;
  document.getElementById("tienCoc").value = 0;
  document.getElementById("bookingNote").value = "";
  
  document.getElementById("bookingErrorMsg").style.display = "none";
  document.getElementById("bookingSuccessMsg").style.display = "none";
  
  document.getElementById("bookingModal").classList.add("open");
  
  // Update checkout date min when checkin date changes
  document.getElementById("checkInDate").onchange = () => {
    const checkIn = document.getElementById("checkInDate").value;
    if (checkIn) {
      const nextDay = new Date(checkIn);
      nextDay.setDate(nextDay.getDate() + 1);
      document.getElementById("checkOutDate").min = nextDay.toISOString().split("T")[0];
    }
  };
}

function closeBookingModal() {
  document.getElementById("bookingModal").classList.remove("open");
  currentBookingRoom = null;
}

async function confirmBooking() {
  const checkInDate = document.getElementById("checkInDate").value;
  const checkOutDate = document.getElementById("checkOutDate").value;
  const soNguoi = Number(document.getElementById("soNguoi").value) || 1;
  const tienCoc = Number(document.getElementById("tienCoc").value) || 0;
  const note = document.getElementById("bookingNote").value;
  
  const errorMsg = document.getElementById("bookingErrorMsg");
  const successMsg = document.getElementById("bookingSuccessMsg");
  
  errorMsg.style.display = "none";
  successMsg.style.display = "none";
  
  // Validation
  if (!checkInDate || !checkOutDate) {
    errorMsg.textContent = "Vui lòng chọn ngày nhận phòng và trả phòng";
    errorMsg.style.display = "block";
    return;
  }
  
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  checkIn.setHours(0, 0, 0, 0);
  checkOut.setHours(0, 0, 0, 0);
  
  if (checkIn < today) {
    errorMsg.textContent = "Ngày nhận phòng không được là ngày quá khứ";
    errorMsg.style.display = "block";
    return;
  }
  
  if (checkOut <= checkIn) {
    errorMsg.textContent = "Ngày trả phòng phải sau ngày nhận phòng";
    errorMsg.style.display = "block";
    return;
  }
  
  if (!currentBookingRoom) {
    errorMsg.textContent = "Không tìm thấy thông tin phòng";
    errorMsg.style.display = "block";
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
        tienCoc,
        note
      })
    });
    
    if (!res) return;
    
    const data = await res.json();
    
    if (!res.ok) {
      errorMsg.textContent = data.message || "Đặt phòng thất bại";
      errorMsg.style.display = "block";
      return;
    }
    
    successMsg.textContent = "Đặt phòng thành công! Mã đặt phòng: " + (data.booking?.bookingCode || "");
    successMsg.style.display = "block";
    
    // Reload rooms after 2 seconds
    setTimeout(() => {
      loadRooms();
      closeBookingModal();
    }, 2000);
  } catch (e) {
    console.error("Error booking room:", e);
    errorMsg.textContent = "Lỗi kết nối, vui lòng thử lại";
    errorMsg.style.display = "block";
  }
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

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth()) return;
  
  setupFilters();
  loadRooms();
  
  // Modal handlers
  document.getElementById("btnCloseBookingModal").onclick = closeBookingModal;
  document.getElementById("btnCancelBooking").onclick = closeBookingModal;
  document.getElementById("btnConfirmBooking").onclick = confirmBooking;
  document.getElementById("btnLogout").onclick = logout;
  
  // Close modal on outside click
  document.getElementById("bookingModal").onclick = (e) => {
    if (e.target.id === "bookingModal") {
      closeBookingModal();
    }
  };
});
