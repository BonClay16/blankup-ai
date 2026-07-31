# Blankup

Nền tảng thiết kế áo thun tùy chỉnh bằng AI: người dùng nhập prompt tiếng Việt hoặc tải ảnh tham khảo, AI tạo artwork, xem trước trên mẫu áo 3D và đặt hàng COD.

## Tính năng hiện có

### Trang và giao diện
- Trang chủ hiển thị gallery thiết kế, xu hướng và thông tin sản phẩm.
- Trang đăng nhập/đăng ký với hỗ trợ Google và Facebook.
- Studio thiết kế: nhập prompt, tải ảnh, chọn phong cách, xem preview 3D và đặt hàng.
- Trang tài khoản: quản lý thông tin cá nhân, đơn hàng và thiết kế.
- Trang quản trị: quản lý người dùng, đơn hàng, thiết kế, voucher và gói AI.

### Tạo artwork AI
- Hỗ trợ hai nhà cung cấp: Cloudflare Workers AI (miễn phí) và OpenAI (trả phí, dự phòng).
- AI Prompt Enhancer: dịch và làm rõ prompt tiếng Việt sang prompt tiếng Anh, giữ đúng chủ thể, màu sắc và chi tiết yêu cầu.
- Chín phong cách thiết kế: minimalist, streetwear, vintage, abstract, anime, ai3d, watercolor, geometric, typography.
- Chuyển đổi text thành ảnh và ảnh thành ảnh (remix từ ảnh tham khảo).

### Xem trước 3D
- Viewer áo 3D bằng Three.js: xoay 360 độ, artwork được chiếu lên bề mặt áo qua `DecalGeometry`.
- Nút chuyển đổi trước/sau để xem cả hai mặt áo.
- Chế độ xem 2D khi không tải được model 3D.

### Xác thực người dùng
- Đăng nhập/đăng ký bằng tên đăng nhập và mật khẩu.
- Đăng nhập bằng Google: xác minh ID token phía server qua Google JWKS.
- Đăng nhập bằng Facebook: gửi thông tin profile từ client lên server.
- Mã OTP xác thực email và số điện thoại.
- JWT token (hết hạn 7 ngày) thay thế session mock-token cũ.
- Middleware hỗ trợ cả JWT và legacy mock-token để tương thích ngược.

### Hệ thống gói AI
- Năm gói: Free, Comeback (59.000đ), Premium (79.000đ), Pro (129.000đ), Studio Plus (199.000đ).
- Mỗi gói có số lượng credit tạo ảnh cao/thấp khác nhau.
- Theo dõi lịch sử sử dụng credit qua `AiCreditLedger`.

### Thanh toán
- COD (thanh toán khi nhận hàng).
- VNPay (sandbox, cần thông tin merchant thật cho production).
- Mã giảm giá (voucher): giảm cố định hoặc phần trăm, giới hạn lượt sử dụng.

### Quản trị
- Dashboard quản trị chỉ truy cập được từ localhost (bảo mật IP).
- Biểu đồ doanh thu 7 ngày gần nhất.
- Quản lý người dùng, đơn hàng, thiết kế, voucher và gói AI.

## Cấu trúc dự án

```text
frontend/
  index.html                    Trang chủ
  login.html                    Trang đăng nhập/đăng ký
  forgot-password.html          Quên mật khẩu
  reset-password.html           Đặt lại mật khẩu
  studio.html                   Studio thiết kế và preview 3D
  account.html                  Trang tài khoản cá nhân
  admin.html                    Dashboard quản trị
  css/
    style.css                   Kiểu dáng chung, trang chủ, login
    studio.css                  Giao diện studio và viewer
    home.css                    Trang chủ
    admin.css                   Dashboard quản trị
    account.css                 Trang tài khoản
  js/
    app.js                      Khởi tạo chung
    auth.js                     Quản lý phiên đăng nhập, điều hướng navbar
    login.js                    Xử lý đăng nhập/đăng ký/OTP/Social
    studio.js                   Xử lý UI studio, gọi API, artwork, đặt hàng
    tshirt-360.js               Three.js, GLTFLoader, OrbitControls, decal
    home.js                     Trang chủ, gallery
    admin.js                    Dashboard quản trị
    account.js                  Trang tài khoản
    i18n.js                     Đa ngôn ngữ (tiếng Việt, tiếng Anh)
    forgot-password.js          Xử lý quên mật khẩu
    reset-password.js           Xử lý đặt lại mật khẩu
  assets/models/
    tshirt-web.glb              Model áo 3D (Meshopt, ~5.4 MB)

backend/
  server.js                     Express server, static files, API routes
  db.js                         Kết nối và khởi tạo SQL Server
  create-blankup-db.sql         Script tạo database BlankupDB
  routes/
    auth.js                     API xác thực (login, register, social, OTP)
    ai-design.js                Tạo artwork AI, prompt enhancer, gallery
    orders.js                   API đơn hàng
    products.js                 API sản phẩm
    payment.js                  Thanh toán VNPay
    admin.js                    API quản trị
    contact.js                  API liên hệ
  services/
    jwt.service.js              Sign/verify JWT token
    google-auth.service.js      Xác minh Google ID token (JWKS)
    vnpay.service.js            Tích hợp VNPay
  service/
    mailer.js                   Gửi email OTP
  .env.example                  Mau biến môi trường
  run-localhost.ps1             Script chạy localhost (PowerShell)
  run-localhost.bat             Script chạy localhost (Command Prompt)
```

## Yêu cầu

- Node.js 18 trở lên.
- SQL Server Express (tùy chọn cho demo; cần có nếu muốn lưu database thật).
- Tài khoản Cloudflare và Workers AI API token để tạo artwork AI thật.
- Tài khoản Google Cloud Console và OAuth Client ID để kích hoạt đăng nhập Google.

## Cài đặt và chạy

### 1. Clone và cài đặt

```powershell
git clone https://github.com/BonClay16/blankup-ai.git
cd blankup-ai\backend
npm install
```

### 2. Cấu hình biến môi trường

```powershell
Copy-Item .env.example .env
```

Mở `backend/.env` và điền thông tin. **Không commit file này.**

### 3. Chạy server

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\run-localhost.ps1
```

Hoặc chạy trực tiếp:

```powershell
cd backend
node server.js
```

Mở: `http://localhost:3000`

> **Lưu ý:** Không dùng Live Server của VS Code vì trang studio cần Express backend để gọi AI và database.

## Biến môi trường quan trọng

```env
# Cloudflare Workers AI
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
CLOUDFLARE_PROMPT_MODEL=@cf/meta/llama-3.1-8b-instruct
ENABLE_AI_PROMPT_ENHANCER=true

# SQL Server
SQL_SERVER=.\SQLEXPRESS
SQL_DATABASE=BlankupDB
SQL_USER=sa
SQL_PASSWORD=...

# JWT
JWT_SECRET=change-me-in-production

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# VNPay (sandbox)
VNP_TMN_CODE=your-merchant-code
VNP_HASH_SECRET=your-hash-secret
```

Xem đầy đủ các biến trong `backend/.env.example`.

## Luong xử lý AI và preview 3D

1. `studio.js` gửi prompt/ảnh lên `/api/ai-design/generate` hoặc `/api/ai-design/generate-from-image`.
2. `ai-design.js` dùng prompt enhancer để chuyển prompt tiếng Việt thành prompt tiếng Anh trung thành với yêu cầu.
3. Workers AI (hoặc OpenAI) sinh artwork và lưu vào `backend/uploads/`.
4. `tshirt-360.js` tải model GLB, dùng `DecalGeometry` để chiếu artwork lên mặt trước áo.
5. Người dùng kéo chuột trên viewer để xoay 360 độ; nút "Trước/Sau" đặt lại góc camera.

## Hệ thống xác thực

### Đăng nhập thường
- Đăng ký: nhập tên đăng nhập, mật khẩu, họ tên, email hoặc SĐT → nhận OTP xác thực.
- Đăng nhập: tên đăng nhập + mật khẩu → kiểm tra xác thực → trả JWT.

### Đăng nhập Google
1. Người dùng bấm nút Google trên trang login.
2. Google Identity Services SDK hiện popup chọn tài khoản.
3. Frontend nhận `id_token` từ Google và gửi lên `/api/auth/social`.
4. Backend xác minh `id_token` qua Google JWKS (RS256, audience, issuer, expiry, chữ ký).
5. Tìm hoặc tạo người dùng trong database → trả JWT.

### Đăng nhập Facebook
- Frontend dùng Facebook SDK để lấy thông tin profile.
- Gửi `{ providerId, fullName, email, avatar }` lên `/api/auth/social`.
- Backend lưu người dùng và trả JWT (chưa xác minh token phía server).

## Database (SQL Server)

Mười bảng chính:

| Bảng | Mô tả |
|------|-------|
| `Users` | Tài khoản người dùng (local, Google, Facebook) |
| `Orders` | Đơn hàng COD với hỗ trợ voucher/giảm giá |
| `Designs` | Thiết kế AI đã tạo với theo dõi chất lượng/watermark |
| `AiPlans` | Gói đăng ký AI |
| `UserAiAccounts` | Số credit AI của từng người dùng |
| `AiPlanPurchases` | Lịch sử mua gói |
| `AiCreditLedger` | Nhật giao dịch credit |
| `Vouchers` | Mã giảm giá |
| `VoucherRedemptions` | Lịch sử sử dụng voucher |
| `VerificationCodes` | Mã OTP xác thực email/SĐT |

## Clone và test nhanh

Người dùng mới có thể test UI, upload ảnh, gallery và viewer 3D mà không cần token AI hay SQL Server.

```powershell
git clone https://github.com/BonClay16/blankup-ai.git
cd blankup-ai\backend
npm install
node server.js
```

Mở `http://localhost:3000`. Khi không có `backend/.env`, backend tự động dùng mock artwork và file-backed demo mode. Muốn tạo artwork AI thật thì copy `.env.example` thành `.env` và điền Cloudflare token riêng.

## Push lên Git

```powershell
git status
git add .
git commit -m "Mô tả thay đổi"
git push
```

Kiểm tra `git status` trước khi push: không được có `backend/.env`, `backend/node_modules/`, `backend/uploads/`, hoặc model trung gian `tshirt.glb` và `tshirt-optimized.glb`. `.gitignore` đã bỏ qua các file này.

## Lưu ý khi phát triển tiếp

- Artwork AI có thể khác chi tiết so với prompt, đặc biệt với meme/nhân vật có tên. Prompt enhancer đã giảm sai lệch, nhưng model ảnh vẫn có độ ngẫu nhiên.
- Decal hiện tại được chiếu vào phần thân trước của model. Nếu thay model áo khác, cần kiểm tra lại vị trí, kích thước và hướng decal trong `frontend/js/tshirt-360.js`.
- Model GLB đang dùng đã được nén Meshopt. `GLTFLoader` cần `MeshoptDecoder`; không xóa đoạn import/cấu hình này.
- Model gốc `tshirt.glb` và `tshirt-optimized.glb` là file trung gian, không cần đưa lên Git. Chỉ cần `tshirt-web.glb`.
- Frontend có fallback 2D nếu GLB không tải được, nhưng luong chính là viewer 3D.
- Cần kiểm tra license của model áo trước khi deploy/công khai sản phẩm.
- Google OAuth Client ID cần cấu hình tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials) và điền vào cả `frontend/login.html` lẫn `backend/.env`.
- Khi deploy lên production, thêm domain production vào Authorized JavaScript Origins trong Google Cloud Console.

## Kiểm tra nhanh

```powershell
cd backend
node --check server.js
node --check routes/auth.js
node --check routes/ai-design.js
node --check services/jwt.service.js
node --check services/google-auth.service.js
```

Sau khi sửa frontend, tải lại bằng `Ctrl + F5` để tránh cache script/module cũ.
