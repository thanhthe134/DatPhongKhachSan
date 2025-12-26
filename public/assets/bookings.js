async function api(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "REQUEST_FAILED");
  return data;
}

function roomCard(room, extraHtml = "") {
  return `
    <div class="item">
      <div class="item-main">
        <div><b>${room.soPhong || room.tenPhong || ("Room #" + room.id)}</b> - ${room.loaiPhong || ""}</div>
        <div class="muted">Trạng thái: <b>${room.trangThai}</b> | Giá: ${room.gia || ""}</div>
      </div>
      <div class="item-actions">${extraHtml}</div>
    </div>
  `;
}

async function loadCustomersToSelect() {
  const customers = await api("/api/customers");
  const sel = document.getElementById("bkCustomer");
  sel.innerHTML = customers
    .map((c) => `<option value="${c.id}">${c.maKhach || ("KH" + c.id)} - ${c.hoTen || ""} (${c.sdt || ""})</option>`)
    .join("");
}

async function loadRoomsToSelect(roomsTrong) {
  const sel = document.getElementById("bkRoom");
  sel.innerHTML = roomsTrong
    .map((r) => `<option value="${r.id}">${r.soPhong || r.tenPhong || ("Room#" + r.id)} - ${r.loaiPhong || ""}</option>`)
    .join("");
}

function setMsg(text, isErr = false) {
  const el = document.getElementById("bkMsg");
  el.textContent = text;
  el.style.color = isErr ? "crimson" : "";
}

async function loadRoomsGrouped() {
  // bạn đang có routes.rooms.js => giả sử GET /api/rooms trả list rooms
  const rooms = await api("/api/rooms");
  const bookingsCho = await api("/api/bookings?status=CHO_CHECKIN");

  const mapBookingByRoomId = new Map(bookingsCho.map(b => [String(b.roomId), b]));

  const trong = rooms.filter(r => r.trangThai === "TRONG");
  const daDat = rooms.filter(r => r.trangThai === "DA_DAT");
  const busy = rooms.filter(r => r.trangThai === "DANG_VE_SINH" || r.trangThai === "BAO_TRI");

  // render TRONG
  document.getElementById("roomsTrong").innerHTML =
    trong.map(r => roomCard(r, `<button class="btn" data-pick-room="${r.id}">Chọn để đặt</button>`)).join("") || `<div class="muted">Không có phòng trống</div>`;

  // render DA_DAT (kèm booking)
  document.getElementById("roomsDaDat").innerHTML =
    daDat.map(r => {
      const b = mapBookingByRoomId.get(String(r.id));
      const bInfo = b ? `<div class="muted">Booking: <b>${b.maDatPhong}</b> | KH: ${b.customerId}</div>` : `<div class="muted">Không tìm thấy booking</div>`;
      return `
        <div class="item">
          <div class="item-main">
            <div><b>${r.soPhong || r.tenPhong || ("Room #" + r.id)}</b> - ${r.loaiPhong || ""}</div>
            <div class="muted">Trạng thái: <b>${r.trangThai}</b></div>
            ${bInfo}
          </div>
          <div class="item-actions">
            ${b ? `<button class="btn btn-primary" data-checkin="${b.id}">Check-in</button>` : ""}
            ${b ? `<button class="btn" data-cancel="${b.id}">Hủy</button>` : ""}
          </div>
        </div>
      `;
    }).join("") || `<div class="muted">Không có phòng đã đặt</div>`;

  // render BUSY
  document.getElementById("roomsBusy").innerHTML =
    busy.map(r => roomCard(r)).join("") || `<div class="muted">Không có phòng vệ sinh/bảo trì</div>`;

  // fill select room trống
  await loadRoomsToSelect(trong);

  // events pick room
  document.querySelectorAll("[data-pick-room]").forEach(btn => {
    btn.onclick = () => {
      document.getElementById("bkRoom").value = btn.getAttribute("data-pick-room");
      setMsg("Đã chọn phòng để đặt.");
    };
  });

  // events checkin/cancel
  document.querySelectorAll("[data-checkin]").forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/api/bookings/${btn.getAttribute("data-checkin")}/checkin`, { method: "POST" });
        setMsg("Check-in thành công.");
        await loadRoomsGrouped();
      } catch (e) {
        setMsg(e.message, true);
      }
    };
  });

  document.querySelectorAll("[data-cancel]").forEach(btn => {
    btn.onclick = async () => {
      const reason = prompt("Lý do hủy (tuỳ chọn):") || "";
      try {
        await api(`/api/bookings/${btn.getAttribute("data-cancel")}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason })
        });
        setMsg("Đã hủy đặt phòng.");
        await loadRoomsGrouped();
      } catch (e) {
        setMsg(e.message, true);
      }
    };
  });
}

async function initBookingPage() {
  document.getElementById("btnReloadBookings").onclick = loadRoomsGrouped;

  document.getElementById("bkCheckIn").onchange = calculateAdminPrice;
  document.getElementById("bkCheckOut").onchange = calculateAdminPrice;

  document.getElementById("btnCreateBooking").onclick = async () => {
    try {
      setMsg("Đang tạo...");
      const payload = {
        customerId: document.getElementById("bkCustomer").value,
        roomId: document.getElementById("bkRoom").value,
        checkInDate: document.getElementById("bkCheckIn").value,
        checkOutDate: document.getElementById("bkCheckOut").value,
        soNguoi: document.getElementById("bkSoNguoi").value,
        tienCoc: document.getElementById("bkTienCoc").value,
        ghiChu: document.getElementById("bkGhiChu").value
      };

      if (!payload.checkInDate || !payload.checkOutDate) throw new Error("Chưa chọn ngày nhận/trả");

      await api("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setMsg("Tạo đặt phòng thành công.");
      await loadRoomsGrouped();
    } catch (e) {
      setMsg(e.message, true);
    }
  };

  await loadCustomersToSelect();
  await loadRoomsGrouped();
}

initBookingPage();
