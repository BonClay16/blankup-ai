# BlankUp AI

> Nền tảng thiết kế và cá nhân hóa áo thun với AI.

BlankUp là một ứng dụng web hướng đến trải nghiệm **thiết kế áo thun bằng AI**, cho phép người dùng tạo ý tưởng, xem trước sản phẩm, lựa chọn mẫu, áp dụng ưu đãi, đặt hàng và theo dõi quá trình sử dụng dịch vụ trên cùng một nền tảng.

Dự án được xây dựng với định hướng kết hợp giữa **AI Creative Studio**, **thương mại điện tử** và **quản trị vận hành**, đồng thời chú trọng khả năng mở rộng và trải nghiệm sử dụng thực tế.

---

## ✨ Điểm nổi bật

### 🎨 AI Studio

- Tạo thiết kế áo thun từ mô tả bằng văn bản.
- Hỗ trợ tạo thiết kế dựa trên hình ảnh đầu vào.
- Xem trước thiết kế trên sản phẩm.
- Quản lý và lưu các thiết kế đã tạo.
- Kết nối nhiều AI provider để tăng tính linh hoạt và khả năng mở rộng.

### 🛍️ Mua sắm & đặt hàng

- Lựa chọn loại sản phẩm và biến thể phù hợp.
- Tùy chỉnh thông tin trước khi đặt hàng.
- Áp dụng mã giảm giá theo điều kiện.
- Hỗ trợ nhiều phương thức thanh toán.
- Theo dõi trạng thái đơn hàng.

### 🌐 Community / Gallery

- Khám phá các thiết kế được chia sẻ.
- Tương tác với thiết kế thông qua lượt thích và bình luận.
- Trải nghiệm nội dung do cộng đồng tạo ra.

### 👤 Tài khoản người dùng

- Đăng ký và đăng nhập.
- Xác thực tài khoản qua email.
- Quên và đặt lại mật khẩu.
- Quản lý thông tin tài khoản.
- Quản lý đơn hàng và lịch sử sử dụng dịch vụ.

### 🛠️ Quản trị hệ thống

Khu vực quản trị hỗ trợ các nghiệp vụ chính như:

- Quản lý người dùng.
- Quản lý đơn hàng và thanh toán.
- Quản lý voucher và chương trình ưu đãi.
- Quản lý gói AI và credit.
- Quản lý thiết kế và nội dung cộng đồng.
- Theo dõi số liệu và báo cáo.
- Xuất dữ liệu phục vụ quản trị.

---

## 🤖 Hệ thống AI đa nhà cung cấp

BlankUp được thiết kế theo hướng **multi-provider**, giúp hệ thống không phụ thuộc hoàn toàn vào một dịch vụ AI duy nhất.

Các tích hợp hiện tại gồm:

- **OmniRoute** — lớp gateway/routing cho hệ thống AI.
- **OpenAI** — kết nối trực tiếp.
- **Cloudflare AI** — kết nối trực tiếp.

Kiến trúc này tạo nền tảng để bổ sung các provider khác trong tương lai mà không cần thay đổi các luồng nghiệp vụ cốt lõi của ứng dụng.

---

## 🎟️ Voucher & Ưu đãi

BlankUp hỗ trợ hệ thống voucher có thể cấu hình theo nhiều hình thức, chẳng hạn:

- Giảm theo số tiền cố định.
- Giảm theo phần trăm.
- Điều kiện giá trị đơn hàng tối thiểu.
- Thời gian hiệu lực.
- Giới hạn tổng lượt sử dụng.
- Giới hạn lượt sử dụng theo người dùng.
- Phạm vi áp dụng cho từng nhóm nghiệp vụ.

Điều này cho phép hệ thống đáp ứng nhiều kịch bản khuyến mãi khác nhau trong quá trình vận hành.

---

## 💳 Thanh toán

BlankUp được xây dựng để hỗ trợ nhiều hình thức thanh toán, tùy theo cấu hình triển khai và dịch vụ thanh toán được sử dụng.

Các phương thức hiện có trong phạm vi dự án gồm:

- **COD**
- **Chuyển khoản ngân hàng**
- **VNPay**
- **Sepay** cho các luồng xác nhận giao dịch phù hợp

---

## 👥 Vai trò hệ thống

Hiện tại dự án tập trung vào **2 vai trò chính**:

| Vai trò | Mô tả |
|---|---|
| **Khách hàng (Customer/User)** | Sử dụng Studio, AI, sản phẩm, voucher, đặt hàng, thanh toán và quản lý tài khoản. |
| **Quản trị viên (Admin)** | Quản lý người dùng, đơn hàng, thanh toán, voucher, AI plan, credit, thiết kế và báo cáo. |

Các vai trò chuyên biệt hơn có thể được bổ sung trong các giai đoạn phát triển tiếp theo.

---

## 🧩 Công nghệ sử dụng

### Frontend

- HTML5
- CSS3
- JavaScript
- Three.js

### Backend

- Node.js
- Express.js

### Database

- Microsoft SQL Server / SQL Server Express

### Tích hợp

- AI providers
- Email service
- Payment services
- OAuth / social login services

---

## 🚀 Chạy dự án

### Yêu cầu môi trường

- Node.js
- npm
- Microsoft SQL Server hoặc SQL Server Express

### Cài đặt

```bash
git clone <repository-url>
cd blankup-ai/backend
npm install
```

Chuẩn bị cơ sở dữ liệu và cấu hình môi trường cho backend theo tài liệu cấu hình của dự án, sau đó chạy:

```bash
npm start
```

Ứng dụng sẽ được khởi chạy trên cổng được cấu hình trong môi trường chạy.

> **Lưu ý:** Không đưa API key, mật khẩu cơ sở dữ liệu, thông tin SMTP hoặc thông tin xác thực dịch vụ bên thứ ba vào repository.

---

## ✅ Chất lượng & độ tin cậy

Trong quá trình phát triển, BlankUp đã trải qua nhiều vòng kiểm tra tập trung vào:

- Authentication & authorization.
- Bảo vệ dữ liệu và quyền truy cập tài nguyên.
- Độ nhất quán của đơn hàng và thanh toán.
- Voucher và các nghiệp vụ tài chính.
- AI credit và hoàn credit khi xử lý thất bại.
- Khả năng xử lý request đồng thời và retry.
- Kiểm tra lỗi và phản hồi giao diện.
- Kiểm thử regression cho các chức năng quan trọng.

Bộ kiểm thử được duy trì cùng source code nhằm hạn chế regression trong các giai đoạn phát triển tiếp theo.

---

## 📍 Trạng thái dự án

BlankUp hiện đang ở giai đoạn **hoàn thiện và chuẩn bị triển khai**, với các chức năng cốt lõi của khách hàng và quản trị đã được xây dựng, kiểm thử và tiếp tục hoàn thiện.

Trọng tâm hiện tại là:

- Hoàn thiện môi trường triển khai thực tế.
- Kiểm tra các tích hợp bên thứ ba trong môi trường thực.
- Hoàn thiện cấu hình production.
- Tiếp tục nâng cao trải nghiệm và khả năng mở rộng của hệ thống.

---

## 🗺️ Định hướng phát triển

- Mở rộng hệ thống AI multi-provider.
- Bổ sung thêm các AI provider mới.
- Mở rộng các tính năng quản trị.
- Hoàn thiện trải nghiệm người dùng.
- Nâng cao khả năng mở rộng và vận hành production.
- Phát triển thêm các tính năng tài khoản và thương mại điện tử.

---

## 🔐 Bảo mật

BlankUp áp dụng các nguyên tắc bảo mật ngay trong quá trình phát triển, bao gồm phân quyền theo vai trò, kiểm soát quyền truy cập dữ liệu và bảo vệ thông tin xác thực.

Khi triển khai dự án:

- Không commit secret hoặc credential vào Git.
- Sử dụng biến môi trường cho thông tin nhạy cảm.
- Không đưa API key phía server vào frontend.
- Không chia sẻ thông tin xác thực dịch vụ trong issue, commit hoặc tài liệu công khai.

---

## 📚 Ghi chú

BlankUp được phát triển trong phạm vi một dự án phần mềm thực tế/định hướng học thuật, với mục tiêu xây dựng một sản phẩm có trải nghiệm hoàn chỉnh thay vì chỉ dừng ở mức prototype chức năng.

---

## 📄 License

Dự án được phát triển cho mục đích học tập và dự án phần mềm.
