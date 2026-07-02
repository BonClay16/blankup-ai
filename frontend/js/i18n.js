/**
 * Blankup i18n - Bilingual Translation System (VI/EN)
 * Handles language switching, localStorage persistence, and DOM updates
 */

const translations = {
  vi: {
    'studio.text.label': 'Chu / slogan tuy chon',
    'studio.text.placeholder': 'VD: BLANKUP, ten rieng, cau slogan...',
    'studio.placement.title': 'Vi tri in',
    'studio.placement.reset': 'Reset',
    'studio.placement.x': 'Ngang',
    'studio.placement.y': 'Doc',
    'studio.placement.scale': 'Kich thuoc',
    'studio.text.placement.title': 'Vi tri chu',
    'studio.placement.dragHelp': 'Keo truc tiep anh hoac chu tren ao de dat vi tri.',
    'studio.placement.image': 'Anh',
    'studio.placement.text': 'Chu',
    'studio.mode.position': 'Chinh vi tri',
    'studio.mode.rotate': 'Xoay ao',
    // Navigation
    'nav.home': 'Trang chủ',
    'nav.howItWorks': 'Cách hoạt động',
    'nav.products': 'Sản phẩm',
    'nav.studio': 'AI Studio',
    'nav.contact': 'Liên hệ',
    'nav.cta': 'Tạo thiết kế',

    // Hero
    'hero.badge': '✨ Nền tảng thiết kế áo AI đầu tiên',
    'hero.title1': 'Not Just A',
    'hero.titleHighlight': 'Shirt',
    'hero.subtitle': 'Biến ý tưởng thành chiếc áo độc nhất với trí tuệ nhân tạo. Chỉ cần mô tả — AI sẽ thiết kế cho bạn.',
    'hero.cta': 'Bắt đầu thiết kế',
    'hero.cta2': 'Xem sản phẩm',
    'hero.stats.designs': 'Thiết kế đã tạo',
    'hero.stats.customers': 'Khách hàng',
    'hero.stats.rating': 'Đánh giá',

    // How it works
    'how.badge': 'Đơn giản & Nhanh chóng',
    'how.title': 'Cách hoạt động',
    'how.subtitle': 'Chỉ 3 bước để có chiếc áo thun mang dấu ấn riêng của bạn',
    'how.step1.title': 'Chọn sản phẩm',
    'how.step1.desc': 'Chọn kiểu áo và màu sắc bạn yêu thích từ bộ sưu tập chất lượng cao',
    'how.step2.title': 'AI tạo design',
    'how.step2.desc': 'Viết ý tưởng hoặc upload hình ảnh — AI sẽ thiết kế cho bạn trong vài giây',
    'how.step3.title': 'Đặt hàng & Nhận',
    'how.step3.desc': 'Xác nhận đơn hàng, thanh toán khi nhận hàng. Giao tận nơi toàn quốc',

    // Products
    'products.badge': 'Bộ sưu tập',
    'products.title': 'Sản phẩm của chúng tôi',
    'products.subtitle': 'Khám phá thiết kế cộng đồng, chọn mẫu bạn thích rồi đưa vào AI Studio để chỉnh tiếp',
    'products.all': 'Tất cả',
    'products.tshirt': 'Áo thun',
    'products.oversize': 'Oversize',
    'products.polo': 'Áo polo',
    'products.hoodie': 'Hoodie',
    'products.customize': 'Tùy chỉnh với AI',
    'products.colors': 'màu',
    'products.from': 'Từ',

    // AI Studio Preview
    'ai.badge': 'Công nghệ AI',
    'ai.title': 'AI Design Studio',
    'ai.subtitle': 'Biến ý tưởng thành thiết kế áo thun trong vài giây với sức mạnh của trí tuệ nhân tạo',
    'ai.feature1.title': 'Viết Prompt',
    'ai.feature1.desc': 'Mô tả ý tưởng thiết kế bằng lời — AI sẽ biến nó thành hình ảnh',
    'ai.feature2.title': 'Upload Ảnh',
    'ai.feature2.desc': 'Tải lên hình ảnh tham khảo kèm ý tưởng để AI sáng tạo thêm',
    'ai.feature3.title': 'Preview Trực Tiếp',
    'ai.feature3.desc': 'Xem trước thiết kế trên mockup áo thật trước khi đặt hàng',
    'ai.cta': 'Mở AI Studio',
    'ai.demo.placeholder': 'Một con rồng Việt Nam phong cách cyberpunk với hiệu ứng neon xanh...',

    // Testimonials
    'testimonials.badge': 'Phản hồi',
    'testimonials.title': 'Khách hàng nói gì',
    'testimonials.subtitle': 'Hàng ngàn khách hàng đã tin tưởng và yêu thích sản phẩm của Blankup',

    // Contact
    'contact.badge': 'Liên hệ',
    'contact.title': 'Kết nối với chúng tôi',
    'contact.subtitle': 'Có câu hỏi? Đội ngũ Blankup luôn sẵn sàng hỗ trợ bạn',
    'contact.name': 'Họ tên',
    'contact.email': 'Email',
    'contact.phone': 'Số điện thoại',
    'contact.message': 'Tin nhắn',
    'contact.send': 'Gửi tin nhắn',
    'contact.sending': 'Đang gửi...',
    'contact.success': 'Tin nhắn đã được gửi thành công!',
    'contact.info.address': 'TP. Hồ Chí Minh, Việt Nam',
    'contact.info.email': 'hello@blankup.vn',
    'contact.info.phone': '0123 456 789',
    'contact.info.hours': 'T2 - T7: 8:00 - 18:00',

    // Footer
    'footer.desc': 'Nền tảng thiết kế áo thun bằng AI. Mỗi chiếc áo là một tác phẩm nghệ thuật độc nhất.',
    'footer.product': 'Sản phẩm',
    'footer.product.tshirt': 'Áo thun',
    'footer.product.polo': 'Áo polo',
    'footer.product.hoodie': 'Hoodie',
    'footer.product.oversize': 'Oversize',
    'footer.support': 'Hỗ trợ',
    'footer.support.faq': 'Câu hỏi thường gặp',
    'footer.support.shipping': 'Chính sách giao hàng',
    'footer.support.returns': 'Đổi trả',
    'footer.support.contact': 'Liên hệ',
    'footer.legal': 'Pháp lý',
    'footer.legal.terms': 'Điều khoản sử dụng',
    'footer.legal.privacy': 'Chính sách bảo mật',
    'footer.copyright': '© 2024 Blankup. Mọi quyền được bảo lưu.',
    'footer.made': 'Thiết kế với ❤️ tại Việt Nam',

    // Studio page
    'studio.title': 'AI Design Studio',
    'studio.subtitle': 'Tạo thiết kế áo thun độc nhất với AI',
    'studio.tab.prompt': 'Viết Prompt',
    'studio.tab.image': 'Ảnh + Ý tưởng',
    'studio.prompt.label': 'Mô tả thiết kế của bạn',
    'studio.prompt.placeholder': 'VD: "Một con rồng Việt Nam phong cách cyberpunk với hiệu ứng neon xanh, trên nền đen"',
    'studio.style.label': 'Phong cách',
    'studio.generate': 'Tạo Design',
    'studio.generating': 'AI đang sáng tạo...',
    'studio.upload.text': 'Kéo thả ảnh vào đây',
    'studio.upload.or': 'hoặc',
    'studio.upload.browse': 'Chọn file',
    'studio.upload.formats': 'PNG, JPG, WEBP (tối đa 5MB)',
    'studio.idea.label': 'Mô tả ý tưởng',
    'studio.idea.placeholder': 'Mô tả ý tưởng chỉnh sửa dựa trên ảnh này...',
    'studio.preview.title': 'Xem trước',
    'studio.preview.empty': 'Tạo một design để xem trước tại đây',
    'studio.color.label': 'Màu áo',
    'studio.size.label': 'Kích cỡ',
    'studio.quantity.label': 'Số lượng',
    'studio.order': 'Đặt hàng (COD)',
    'studio.download': 'Tải design',
    'studio.front': 'Trước',
    'studio.back': 'Sau',
    'studio.recent.title': 'Thiết kế cộng đồng',
    'studio.recent.subtitle': 'Lấy cảm hứng từ các thiết kế của cộng đồng Blankup',

    // Order modal
    'order.title': 'Xác nhận đơn hàng',
    'order.product': 'Sản phẩm',
    'order.color': 'Màu',
    'order.size': 'Kích cỡ',
    'order.qty': 'Số lượng',
    'order.total': 'Tổng tiền',
    'order.info': 'Thông tin giao hàng',
    'order.name': 'Họ tên *',
    'order.phone': 'Số điện thoại *',
    'order.address': 'Địa chỉ giao hàng *',
    'order.note': 'Ghi chú (tùy chọn)',
    'order.payment': 'Thanh toán khi nhận hàng (COD)',
    'order.submit': 'Xác nhận đặt hàng',
    'order.submitting': 'Đang xử lý...',
    'order.success.title': '🎉 Đặt hàng thành công!',
    'order.success.desc': 'Mã đơn hàng: ',
    'order.success.note': 'Chúng tôi sẽ liên hệ xác nhận trong vòng 24 giờ.',
    'order.close': 'Đóng',

    // Style names
    'style.minimalist': 'Tối giản',
    'style.streetwear': 'Streetwear',
    'style.vintage': 'Vintage',
    'style.abstract': 'Trừu tượng',
    'style.anime': 'Anime',
    'style.ai3d': 'AI 3D',
    'style.watercolor': 'Màu nước',
    'style.geometric': 'Hình học',
    'style.typography': 'Typography',

    // Auth & Admin
    'nav.login': 'Đăng nhập',
    'nav.logout': 'Đăng xuất',
    'nav.dashboard': 'Dashboard',
    'auth.modal.title': 'Đăng nhập vào Blankup',
    'auth.modal.registerTitle': 'Tạo tài khoản Blankup',
    'auth.modal.username': 'Tên đăng nhập',
    'auth.modal.password': 'Mật khẩu',
    'auth.modal.fullName': 'Họ và tên',
    'auth.modal.loginBtn': 'Đăng nhập',
    'auth.modal.registerBtn': 'Đăng ký',
    'auth.modal.noAccount': 'Chưa có tài khoản?',
    'auth.modal.hasAccount': 'Đã có tài khoản?',
    'auth.modal.switchToRegister': 'Đăng ký ngay',
    'auth.modal.loading': 'Đang xử lý...',

    // Admin Dashboard
    'admin.title': 'Bảng điều khiển Admin',
    'admin.welcome': 'Xin chào Admin',
    'admin.overview': 'Tổng quan',
    'admin.orders': 'Đơn hàng',
    'admin.users': 'Người dùng',
    'admin.designs': 'Thiết kế AI',
    'admin.stats.revenue': 'Doanh thu thực',
    'admin.stats.pendingRevenue': 'Doanh thu chờ',
    'admin.stats.completedCount': 'Đơn hoàn thành',
    'admin.stats.pendingCount': 'Đơn đang xử lý',
    'admin.stats.cancelledCount': 'Đơn đã hủy',
    'admin.stats.averageValue': 'Giá trị TB',
    'admin.stats.totalCount': 'Tổng số đơn',
    'admin.stats.usersCount': 'Người dùng hệ thống',
    'admin.stats.designsCount': 'Số mẫu AI gen',
    'admin.recentOrders': 'Đơn hàng gần đây',
    'admin.ordersList': 'Danh sách đơn hàng',
    'admin.usersList': 'Danh sách người dùng',
    'admin.designsList': 'Thư viện thiết kế',
    'admin.orderId': 'Mã đơn',
    'admin.customer': 'Khách hàng',
    'admin.product': 'Sản phẩm',
    'admin.total': 'Tổng tiền',
    'admin.status': 'Trạng thái',
    'admin.date': 'Ngày đặt',
    'admin.actions': 'Thao tác',
    'admin.markCompleted': 'Hoàn thành',
    'admin.cancelOrder': 'Hủy đơn',
    'admin.viewDesign': 'Xem design',
    'admin.username': 'Tên đăng nhập',
    'admin.fullName': 'Họ và tên',
    'admin.role': 'Vai trò',
    'admin.registered': 'Ngày đăng ký',
    'admin.totalSpend': 'Đã chi tiêu',
    'admin.categoryBreakdown': 'Phân tích danh mục',
    'admin.sales': 'Doanh số',
  },

  en: {
    'studio.text.label': 'Custom text / slogan',
    'studio.text.placeholder': 'E.g: BLANKUP, a name, a slogan...',
    'studio.placement.title': 'Print placement',
    'studio.placement.reset': 'Reset',
    'studio.placement.x': 'Horizontal',
    'studio.placement.y': 'Vertical',
    'studio.placement.scale': 'Size',
    'studio.text.placement.title': 'Text placement',
    'studio.placement.dragHelp': 'Drag the image or text directly on the shirt to position it.',
    'studio.placement.image': 'Image',
    'studio.placement.text': 'Text',
    'studio.mode.position': 'Position',
    'studio.mode.rotate': 'Rotate shirt',
    // Navigation
    'nav.home': 'Home',
    'nav.howItWorks': 'How It Works',
    'nav.products': 'Products',
    'nav.studio': 'AI Studio',
    'nav.contact': 'Contact',
    'nav.cta': 'Design Now',

    // Hero
    'hero.badge': '✨ First AI-Powered T-Shirt Design Platform',
    'hero.title1': 'Not Just A',
    'hero.titleHighlight': 'Shirt',
    'hero.subtitle': 'Turn your ideas into unique custom shirts with artificial intelligence. Just describe — AI will design for you.',
    'hero.cta': 'Start Designing',
    'hero.cta2': 'View Products',
    'hero.stats.designs': 'Designs Created',
    'hero.stats.customers': 'Customers',
    'hero.stats.rating': 'Rating',

    // How it works
    'how.badge': 'Simple & Fast',
    'how.title': 'How It Works',
    'how.subtitle': 'Just 3 steps to get your unique custom t-shirt',
    'how.step1.title': 'Choose Product',
    'how.step1.desc': 'Select your favorite shirt type and color from our premium collection',
    'how.step2.title': 'AI Creates Design',
    'how.step2.desc': 'Write your idea or upload an image — AI will design for you in seconds',
    'how.step3.title': 'Order & Receive',
    'how.step3.desc': 'Confirm your order, pay on delivery. Nationwide shipping available',

    // Products
    'products.badge': 'Collection',
    'products.title': 'Our Products',
    'products.subtitle': 'Explore community designs, pick one you like, then remix it in AI Studio',
    'products.all': 'All',
    'products.tshirt': 'T-Shirt',
    'products.oversize': 'Oversize',
    'products.polo': 'Polo',
    'products.hoodie': 'Hoodie',
    'products.customize': 'Customize with AI',
    'products.colors': 'colors',
    'products.from': 'From',

    // AI Studio Preview
    'ai.badge': 'AI Technology',
    'ai.title': 'AI Design Studio',
    'ai.subtitle': 'Turn your ideas into t-shirt designs in seconds with the power of artificial intelligence',
    'ai.feature1.title': 'Write Prompt',
    'ai.feature1.desc': 'Describe your design idea in words — AI will transform it into art',
    'ai.feature2.title': 'Upload Image',
    'ai.feature2.desc': 'Upload a reference image with your idea for AI to create from',
    'ai.feature3.title': 'Live Preview',
    'ai.feature3.desc': 'Preview your design on a real t-shirt mockup before ordering',
    'ai.cta': 'Open AI Studio',
    'ai.demo.placeholder': 'A Vietnamese dragon in cyberpunk style with neon blue effects...',

    // Testimonials
    'testimonials.badge': 'Feedback',
    'testimonials.title': 'What Customers Say',
    'testimonials.subtitle': 'Thousands of customers trust and love Blankup products',

    // Contact
    'contact.badge': 'Contact',
    'contact.title': 'Get In Touch',
    'contact.subtitle': 'Have a question? The Blankup team is always ready to help',
    'contact.name': 'Full Name',
    'contact.email': 'Email',
    'contact.phone': 'Phone Number',
    'contact.message': 'Message',
    'contact.send': 'Send Message',
    'contact.sending': 'Sending...',
    'contact.success': 'Message sent successfully!',
    'contact.info.address': 'Ho Chi Minh City, Vietnam',
    'contact.info.email': 'hello@blankup.vn',
    'contact.info.phone': '0123 456 789',
    'contact.info.hours': 'Mon - Sat: 8:00 AM - 6:00 PM',

    // Footer
    'footer.desc': 'AI-powered t-shirt design platform. Every shirt is a unique work of art.',
    'footer.product': 'Products',
    'footer.product.tshirt': 'T-Shirt',
    'footer.product.polo': 'Polo',
    'footer.product.hoodie': 'Hoodie',
    'footer.product.oversize': 'Oversize',
    'footer.support': 'Support',
    'footer.support.faq': 'FAQ',
    'footer.support.shipping': 'Shipping Policy',
    'footer.support.returns': 'Returns',
    'footer.support.contact': 'Contact',
    'footer.legal': 'Legal',
    'footer.legal.terms': 'Terms of Service',
    'footer.legal.privacy': 'Privacy Policy',
    'footer.copyright': '© 2024 Blankup. All rights reserved.',
    'footer.made': 'Designed with ❤️ in Vietnam',

    // Studio page
    'studio.title': 'AI Design Studio',
    'studio.subtitle': 'Create unique t-shirt designs with AI',
    'studio.tab.prompt': 'Write Prompt',
    'studio.tab.image': 'Image + Idea',
    'studio.prompt.label': 'Describe your design',
    'studio.prompt.placeholder': 'E.g: "A Vietnamese dragon in cyberpunk style with blue neon effects, on a black background"',
    'studio.style.label': 'Style',
    'studio.generate': 'Generate Design',
    'studio.generating': 'AI is creating...',
    'studio.upload.text': 'Drag & drop image here',
    'studio.upload.or': 'or',
    'studio.upload.browse': 'Browse files',
    'studio.upload.formats': 'PNG, JPG, WEBP (max 5MB)',
    'studio.idea.label': 'Describe your idea',
    'studio.idea.placeholder': 'Describe your editing idea based on this image...',
    'studio.preview.title': 'Preview',
    'studio.preview.empty': 'Generate a design to preview it here',
    'studio.color.label': 'Shirt Color',
    'studio.size.label': 'Size',
    'studio.quantity.label': 'Quantity',
    'studio.order': 'Order (COD)',
    'studio.download': 'Download Design',
    'studio.front': 'Front',
    'studio.back': 'Back',
    'studio.recent.title': 'Community Designs',
    'studio.recent.subtitle': 'Get inspired by designs from the Blankup community',

    // Order modal
    'order.title': 'Confirm Order',
    'order.product': 'Product',
    'order.color': 'Color',
    'order.size': 'Size',
    'order.qty': 'Quantity',
    'order.total': 'Total',
    'order.info': 'Delivery Information',
    'order.name': 'Full Name *',
    'order.phone': 'Phone Number *',
    'order.address': 'Delivery Address *',
    'order.note': 'Note (optional)',
    'order.payment': 'Cash on Delivery (COD)',
    'order.submit': 'Confirm Order',
    'order.submitting': 'Processing...',
    'order.success.title': '🎉 Order Placed Successfully!',
    'order.success.desc': 'Order ID: ',
    'order.success.note': 'We will contact you to confirm within 24 hours.',
    'order.close': 'Close',

    // Style names
    'style.minimalist': 'Minimalist',
    'style.streetwear': 'Streetwear',
    'style.vintage': 'Vintage',
    'style.abstract': 'Abstract',
    'style.anime': 'Anime',
    'style.ai3d': 'AI 3D',
    'style.watercolor': 'Watercolor',
    'style.geometric': 'Geometric',
    'style.typography': 'Typography',

    // Auth & Admin
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'nav.dashboard': 'Dashboard',
    'auth.modal.title': 'Login to Blankup',
    'auth.modal.registerTitle': 'Create Blankup Account',
    'auth.modal.username': 'Username',
    'auth.modal.password': 'Password',
    'auth.modal.fullName': 'Full Name',
    'auth.modal.loginBtn': 'Login',
    'auth.modal.registerBtn': 'Register',
    'auth.modal.noAccount': "Don't have an account?",
    'auth.modal.hasAccount': 'Already have an account?',
    'auth.modal.switchToRegister': 'Register now',
    'auth.modal.loading': 'Processing...',

    // Admin Dashboard
    'admin.title': 'Admin Dashboard',
    'admin.welcome': 'Hello Admin',
    'admin.overview': 'Overview',
    'admin.orders': 'Orders',
    'admin.users': 'Users',
    'admin.designs': 'AI Designs',
    'admin.stats.revenue': 'Actual Revenue',
    'admin.stats.pendingRevenue': 'Pending Revenue',
    'admin.stats.completedCount': 'Completed Orders',
    'admin.stats.pendingCount': 'Pending Orders',
    'admin.stats.cancelledCount': 'Cancelled Orders',
    'admin.stats.averageValue': 'Avg Order Value',
    'admin.stats.totalCount': 'Total Orders',
    'admin.stats.usersCount': 'System Users',
    'admin.stats.designsCount': 'AI Gen Designs',
    'admin.recentOrders': 'Recent Orders',
    'admin.ordersList': 'Orders List',
    'admin.usersList': 'Users List',
    'admin.designsList': 'Designs Gallery',
    'admin.orderId': 'Order ID',
    'admin.customer': 'Customer',
    'admin.product': 'Product',
    'admin.total': 'Total',
    'admin.status': 'Status',
    'admin.date': 'Order Date',
    'admin.actions': 'Actions',
    'admin.markCompleted': 'Complete',
    'admin.cancelOrder': 'Cancel',
    'admin.viewDesign': 'View Design',
    'admin.username': 'Username',
    'admin.fullName': 'Full Name',
    'admin.role': 'Role',
    'admin.registered': 'Registered Date',
    'admin.totalSpend': 'Total Spend',
    'admin.categoryBreakdown': 'Category Breakdown',
    'admin.sales': 'Sales',
  }
};

/**
 * i18n Manager
 */
class I18nManager {
  constructor() {
    this.currentLang = this.detectLanguage();
    this.listeners = [];
  }

  /** Detect language from localStorage or browser */
  detectLanguage() {
    const saved = localStorage.getItem('blankup_lang');
    if (saved && translations[saved]) return saved;
    const browserLang = navigator.language.slice(0, 2);
    return browserLang === 'vi' ? 'vi' : 'en';
  }

  /** Get translation by key */
  t(key) {
    return translations[this.currentLang]?.[key] || translations['vi']?.[key] || key;
  }

  /** Switch language */
  switchTo(lang) {
    if (!translations[lang]) return;
    this.currentLang = lang;
    localStorage.setItem('blankup_lang', lang);
    this.updateDOM();
    this.listeners.forEach(fn => fn(lang));
  }

  /** Toggle between VI and EN */
  toggle() {
    this.switchTo(this.currentLang === 'vi' ? 'en' : 'vi');
  }

  /** Update all DOM elements with data-i18n attribute */
  updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = text;
      } else {
        el.textContent = text;
      }
    });

    // Update data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.getAttribute('data-i18n-placeholder'));
    });

    // Update data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = this.t(el.getAttribute('data-i18n-title'));
    });

    // Update html lang attribute
    document.documentElement.lang = this.currentLang;
    document.documentElement.setAttribute('data-lang', this.currentLang);

    // Update language toggle button
    const toggleBtns = document.querySelectorAll('.lang-toggle');
    toggleBtns.forEach(btn => {
      const viLabel = btn.querySelector('.lang-vi');
      const enLabel = btn.querySelector('.lang-en');
      if (viLabel && enLabel) {
        viLabel.classList.toggle('active', this.currentLang === 'vi');
        enLabel.classList.toggle('active', this.currentLang === 'en');
      }
    });
  }

  /** Register language change listener */
  onChange(fn) {
    this.listeners.push(fn);
  }

  /** Initialize - call after DOM loaded */
  init() {
    this.updateDOM();
    // Bind language toggle buttons
    document.querySelectorAll('.lang-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target.closest('[data-lang]');
        if (target) {
          this.switchTo(target.getAttribute('data-lang'));
        }
      });
    });
  }
}

// Global instance
const i18n = new I18nManager();
