# DatPhongKhachSan

# Hệ thống Quản lý đặt phòng Khách sạn 

## Giới thiệu

Hệ thống Quản lý Khách sạn là một ứng dụng web toàn diện được xây dựng để hỗ trợ vận hành khách sạn vừa và nhỏ. Hệ thống bao gồm trang quản trị (Admin Dashboard) dành cho nhân viên/quản lý và các API hỗ trợ ứng dụng phía khách hàng. Backend được xây dựng bằng Node.js/Express với cơ sở dữ liệu dạng file (JSON) nhẹ nhàng, dễ triển khai.

## Tính năng chính

### 1. Quản trị viên (Admin Dashboard)
- **Quản lý Phòng (Rooms)**:
  - Xem danh sách và trạng thái phòng (Trống, Đã thuê, Đặt trước, Đang dọn, Bảo trì).
  - Thêm, sửa, xóa thông tin phòng.
  - Cập nhật trạng thái phòng thủ công.
- **Quản lý Đặt phòng (Bookings)**:
  - Tạo mới đặt phòng (Check-in/Booking).
  - Quản lý quá trình check-in, check-out.
  - Tính toán hóa đơn tự động bao gồm tiền phòng, dịch vụ và khuyến mãi.
- **Quản lý Khách hàng (Customers)**:
  - Lưu trữ hồ sơ khách hàng (CCCD, SĐT, Email).
  - Xem lịch sử đặt phòng của từng khách.
- **Quản lý Dịch vụ (Services)**:
  - Định nghĩa danh mục dịch vụ (Ăn uống, Spa, Giặt là, v.v.).
  - Thêm dịch vụ vào hóa đơn phòng.
- **Quản lý Khuyến mãi (Promotions)**:
  - Tạo các mã giảm giá với thời hạn và phần trăm giảm cụ thể.
  - Áp dụng mã giảm giá khi thanh toán.
- **Quản lý Đánh giá (Reviews)**:
  - Xem và quản lý đánh giá từ khách hàng.
  - Phản hồi đánh giá.

### 2. Khách hàng (Customer Portal - API)
- Đăng ký/Đăng nhập tài khoản khách hàng.
- Xem danh sách phòng và dịch vụ.
- Đặt phòng trực tuyến.
- Xem lịch sử đặt phòng cá nhân.
- Gửi đánh giá và phản hồi về dịch vụ.

## Công nghệ sử dụng

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: File-based JSON (lưu tại `server/data/db.json`) - Không cần cài đặt database server phức tạp.
- **Authentication**: JWT (JSON Web Token) & Cookies.
- **Security**: bcrypt (hashing password), cors, cookie-parser.

### Frontend (Admin Dashboard)
- **Core**: HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Architecture**: Single Page Application (SPA) - like behavior for dashboard components.
- **Styling**: Custom CSS (Responsive).

## Cấu trúc dự án

```
hotel_web/
├── public/                 # Frontend Static Files
│   ├── assets/            # CSS, JS, Images
│   │   ├── dashboard.css
│   │   └── dashboard.js   # Logic chính của Dashboard
│   ├── dashboard.html     # Giao diện quản lý chính
│   ├── login.html         # Trang đăng nhập Admin
│   └── customer/          # Giao diện phía khách hàng (nếu có)
│
├── server/                 # Backend
│   ├── data/              # Database lưu trữ
│   │   ├── db.json        # Dữ liệu chính (Users, Rooms, Bookings...)
│   │   └── update_users_info.js # Script tiện ích xử lý dữ liệu
│   ├── src/               # Source code backend
│   │   ├── controllers.*.js   # Logic xử lý request
│   │   ├── routes.*.js        # Định nghĩa API routes
│   │   ├── middleware.*.js    # Auth middleware
│   │   └── app.js             # Entry point của server
│   ├── package.json
│   └── README.md
```

## Cài đặt và Chạy ứng dụng

### 1. Yêu cầu hệ thống
- Node.js (v14.0.0 trở lên)
- NPM (đi kèm với Node.js)

### 2. Cài đặt dependencies
Di chuyển vào thư mục `server`:
```bash
cd server
npm install
```

### 3. Cấu hình (Tùy chọn)
Tạo file `.env` trong thư mục `server` nếu muốn thay đổi port hoặc secret key:
```env
PORT=3000
JWT_SECRET=mysecretkey123
```

### 4. Chạy ứng dụng
**Chế độ Development (tự động restart khi sửa code):
web cho nhà quản lý đặt phồng khách sạn**
```bash
cd server
npm run dev    
```
**web cho khách hàng đặt phòng**
```bash
cd server
npm run dev:customer    
```
**Chế độ Production:**
```bash
npm start
```

Server sẽ khởi chạy tại: `http://localhost:3000`

## Hướng dẫn sử dụng

### Truy cập Dashboard
1. Mở trình duyệt truy cập `http://localhost:3000`.
2. Hệ thống sẽ chuyển hướng đến trang đăng nhập (`/login.html`).
3. Sử dụng tài khoản Admin mặc định (nếu chưa đổi):
   - Username: `admin`
   - Password: `123` (hoặc mật khẩu đã hash trong db.json)

### API Endpoints Chính

**Authentication:**
- `POST /auth/login`: Đăng nhập Admin.
- `POST /customer-auth/login`: Đăng nhập Khách hàng.

**Admin APIs (Yêu cầu Header `Authorization` hoặc Cookie):**
- `/api/rooms`: CRUD Phòng.
- `/api/bookings`: CRUD Đặt phòng.
- `/api/customers`: CRUD Khách hàng.
- `/api/services`: CRUD Dịch vụ.
- `/api/promotions`: CRUD Khuyến mãi.
- `/api/reviews`: Quản lý đánh giá.

**Customer APIs:**
- `/api/customer/rooms`: Xem phòng trống.
- `/api/customer/bookings`: Đặt phòng & xem lịch sử.

## Lưu ý phát triển
- Dữ liệu được lưu trong `server/data/db.json`. Khi restart server, dữ liệu vẫn được bảo toàn.
- Để reset dữ liệu, bạn có thể xóa nội dung trong `db.json` (giữ lại cấu trúc mảng rỗng) hoặc dùng script seed (nếu có).

## License
Dự án phục vụ mục đích học tập và phát triển mã nguồn mở.


