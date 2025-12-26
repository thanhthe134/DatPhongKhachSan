# Customer Web Application

Ứng dụng web dành cho khách hàng, chạy trên port 5000.

## Tính năng

- ✅ Đăng ký tài khoản
- ✅ Đăng nhập/Đăng xuất
- ✅ Xem danh sách phòng với mô tả
- ✅ Đặt phòng với validation đầy đủ
- ✅ Xem lịch sử đặt phòng

## Cách chạy

### 1. Chạy server chính (port 3000)

```bash
cd server
npm run dev
# hoặc
npm start
```

### 2. Chạy server khách hàng (port 5000)

Trong một terminal khác:

```bash
cd server
npm run dev:customer
# hoặc
npm start:customer
```

### 3. Truy cập

- Server chính (Admin): http://localhost:4000
- Server khách hàng: http://localhost:6001

## Cấu trúc

- `index.html` - Trang SPA tích hợp tất cả chức năng
- `assets/customer-spa.css` - Stylesheet
- `assets/customer-spa.js` - JavaScript logic

## Lưu ý

- Server khách hàng sẽ proxy các API requests đến server chính (port 3000)
- Đảm bảo server chính đang chạy trước khi khởi động server khách hàng
