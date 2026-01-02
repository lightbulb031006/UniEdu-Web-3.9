/**
 * home.js - Marketing style homepage before login
 */

const HOME_MENU = [
    { id: 'intro', label: 'Giới thiệu', description: 'Tầm nhìn & triết lý đào tạo.' },
    { id: 'news', label: 'Khóa học', description: 'Lộ trình học phù hợp từng trình độ.' },
    { id: 'docs', label: 'Cuộc thi', description: 'Sự kiện luyện thi & lập trình định kỳ.' },
    { id: 'policy', label: 'Liên hệ', description: 'Kết nối với đội ngũ Unicorns Edu.' }
];

const HOME_TEAMS = [
    {
        id: 'it',
        icon: '💻',
        name: 'Team Tin học',
        description: 'Đồng hành trong lập trình, thuật toán và ứng dụng CNTT với các lớp chuyên sâu & luyện thi.',
        link: 'https://www.facebook.com/profile.php?id=61577992693085'
    },
    {
        id: 'japanese',
        icon: '🇯🇵',
        name: 'Team Tiếng Nhật',
        description: 'Đào tạo từ sơ cấp đến JLPT, giao tiếp và hiểu sâu văn hóa Nhật với giáo trình chuẩn bản xứ.',
        link: 'https://www.facebook.com/unicornstiengnhat'
    },
    {
        id: 'math',
        icon: '📐',
        name: 'Team Toán học',
        description: 'Phát triển tư duy logic, luyện thi chuyên và thi HSG với lộ trình cá nhân hoá theo năng lực.',
        link: 'https://www.facebook.com/profile.php?id=61578074894066'
    }
];

const HOME_FEATURES = [
    {
        id: 'classes',
        title: 'Quản lý lớp học',
        description: 'Theo dõi sĩ số, lịch học và tình trạng học phí ngay trên một màn hình duy nhất.',
        icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
        target: '#section-intro'
    },
    {
        id: 'lesson',
        title: 'Giáo án & bài tập',
        description: 'Hệ thống hóa giáo án, giao bài tập và chấm điểm chỉ với vài thao tác.',
        icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><path d="M8 7h8"></path><path d="M8 11h8"></path><path d="M8 15h4"></path>',
        target: '#section-news'
    },
    {
        id: 'people',
        title: 'Nhân sự & SALE-CSKH',
        description: 'Quản lý KPIs, hoa hồng và lịch chăm sóc học sinh theo thời gian thực.',
        icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
        target: '#section-news'
    },
    {
        id: 'contests',
        title: 'Cuộc thi & lập trình',
        description: 'Tổ chức contest nội bộ, luyện code và chia sẻ kết quả minh bạch.',
        icon: '<rect x="2" y="4" width="20" height="14" rx="2"></rect><path d="M8 20h8"></path><path d="M12 16v4"></path>',
        target: '#section-docs'
    }
];

const HOME_WORKFLOW_STEPS = [
    {
        id: 'sync',
        title: 'Đồng bộ dữ liệu tức thời',
        description: 'Kết nối dữ liệu học sinh, lớp học, lịch dạy và tài chính trong cùng một bảng điều khiển.',
        icon: '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 9-9h9"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-9 9H3"/>',
        actionLabel: 'Xem Dashboard',
        page: 'dashboard'
    },
    {
        id: 'people',
        title: 'Quản trị nhân sự SALE & CSKH',
        description: 'Theo dõi KPIs, danh sách học sinh phụ trách và tự động nhắc lịch chăm sóc.',
        icon: '<circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
        actionLabel: 'Đi tới Nhân sự',
        page: 'staff'
    },
    {
        id: 'students',
        title: 'Trải nghiệm chăm sóc học sinh',
        description: 'Từ hồ sơ, trạng thái học phí đến lịch sử học tập – tất cả đều cập nhật real-time.',
        icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
        actionLabel: 'Xem Học sinh',
        page: 'students'
    }
];

const HOME_MODULE_PREVIEWS = [
    {
        id: 'students',
        label: 'Học sinh',
        metricKey: 'activeStudents',
        metricLabel: 'đang theo học',
        blurb: 'Quản lý hồ sơ, lịch sử học, thông tin phụ huynh và công nợ ở cùng một nơi.',
        page: 'students'
    },
    {
        id: 'classes',
        label: 'Lớp học',
        metricKey: 'activeClasses',
        metricLabel: 'lớp đang mở',
        blurb: 'Xếp lịch, phân giáo viên, chấm buổi và đồng bộ học phí chỉ với vài thao tác.',
        page: 'classes'
    },
    {
        id: 'staff',
        label: 'SALE & CSKH',
        metricKey: 'activeStaff',
        metricLabel: 'nhân sự đang hoạt động',
        blurb: 'Danh sách học sinh phụ trách, KPIs và hoa hồng được đồng bộ trực tiếp từ Supabase.',
        page: 'staff'
    }
];

const HOME_SECTION_DEFAULTS = {
    intro: {
        title: 'Nơi kết nối giáo viên, học sinh và phụ huynh trong một hệ thống thống nhất',
        content: 'Unicorns Edu cung cấp bộ công cụ quản lý dành riêng cho các trung tâm luyện thi và bồi dưỡng. Từ việc tạo lớp, xếp lịch đến đánh giá kết quả đều được số hóa giúp educator tiết kiệm thời gian và tập trung vào chất lượng giảng dạy.'
    },
    news: {
        title: 'Chương trình học cá nhân hoá theo trình độ',
        content: 'Hệ thống hỗ trợ xây dựng khóa học theo gói buổi, tự động nhắc lịch và cập nhật tình trạng học phí. Học sinh có ứng dụng riêng để theo dõi tiến độ, nhận tài liệu và tương tác với giáo viên.'
    },
    docs: {
        title: 'Cuộc thi lập trình & học thuật mỗi tháng',
        content: 'Unicorns Edu tích hợp module contest để trung tâm tạo đề, chấm điểm và công bố bảng xếp hạng. Lịch sử cuộc thi được lưu lại giúp học sinh theo dõi sự tiến bộ của chính mình.'
    }
};

const HOME_CONTACT = {
    email: 'unicornseducvp@gmail.com',
    phone: '0911 589 217 • 0336 755 856',
    address: 'Đại học Bách khoa Hà Nội',
    socials: [
        { label: 'Facebook', icon: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3.64L18 10h-4V7a1 1 0 0 1 1-1h3z"></path>', url: 'https://facebook.com' },
        { label: 'YouTube', icon: '<path d="M2.5 17.5v-11l9 5.5z"></path><rect x="2.5" y="6.5" width="19" height="11" rx="2"></rect>', url: 'https://youtube.com' },
        { label: 'LinkedIn', icon: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle>', url: 'https://linkedin.com' }
    ]
};

function ensureHomeSectionRecords() {
    if (!Array.isArray(window.demo.homePosts)) {
        window.demo.homePosts = [];
    }
    HOME_MENU.slice(0, 3).forEach(section => {
        const existing = window.demo.homePosts.find(post => post.category === section.id);
        if (!existing) {
            window.demo.homePosts.push({
                id: window.UniData?.generateId ? window.UniData.generateId('home') : ('HP' + Math.random().toString(36).slice(2, 8).toUpperCase()),
                category: section.id,
                title: HOME_SECTION_DEFAULTS[section.id].title,
                content: HOME_SECTION_DEFAULTS[section.id].content,
                attachments: [],
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
    });
}

function getHomeStats() {
    const students = window.demo?.students || [];
    const classes = window.demo?.classes || [];
    const teachers = window.demo?.teachers || [];
    const activeStudents = students.filter(student => (student.status || 'active') === 'active').length || students.length || 0;
    const activeClasses = classes.filter(cls => (cls.status || 'running') === 'running').length || classes.length || 0;
    const activeStaff = teachers.length;
    const satisfaction = Math.min(99, 82 + Math.round(Math.random() * 12));
    const automationRate = 72 + Math.round(Math.random() * 12);
    return {
        activeStudents,
        activeClasses,
        activeStaff,
        satisfaction,
        automationRate
    };
}

function getHomeSection(sectionId) {
    ensureHomeSectionRecords();
    const fallback = HOME_SECTION_DEFAULTS[sectionId] || { title: '', content: '' };
    const record = (window.demo.homePosts || []).find(post => post.category === sectionId);
    if (!record) return { ...fallback, id: null };
    return {
        id: record.id,
        title: record.title || fallback.title,
        content: record.content || fallback.content,
        category: sectionId
    };
}

function formatSectionContent(value) {
    if (!value) return '';
    return value
        .split(/\n{2,}/)
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function getHomeUserLinks(user) {
    if (!user) return [];
    switch (user.role) {
        case 'admin':
            return [
                { label: 'Về Dashboard', page: 'dashboard' },
                { label: 'Quản lý Trang Chủ', action: 'manage-home' }
            ];
        case 'teacher':
            return [
                { label: 'Dashboard', page: 'dashboard' },
                { label: 'Lớp học', page: 'classes' }
            ];
        case 'student':
            return [
                { label: 'Lớp học', page: 'classes' },
                { label: 'Lịch sử học', page: 'dashboard' }
            ];
        default:
            return [{ label: 'Dashboard', page: 'dashboard' }];
    }
}

function openHomeSectionEditor(sectionId) {
    const sectionMeta = HOME_MENU.find(item => item.id === sectionId);
    if (!sectionMeta) return;
    const record = getHomeSection(sectionId);
    const form = document.createElement('form');
    form.className = 'home-section-form';
    form.innerHTML = `
        <div class="form-group">
            <label for="homeSectionTitle">Tiêu đề</label>
            <input id="homeSectionTitle" class="form-control" value="${record.title || ''}" required>
        </div>
        <div class="form-group">
            <label for="homeSectionContent">Nội dung mô tả</label>
            <textarea id="homeSectionContent" class="form-control" rows="6" placeholder="Nhập mô tả hiển thị ở mục ${sectionMeta.label}">${record.content || ''}</textarea>
            <p class="form-hint">Có thể xuống dòng để tách ý. Nội dung sẽ hiển thị trực tiếp trên trang chủ.</p>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Lưu nội dung</button>
        </div>
    `;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = form.querySelector('#homeSectionTitle').value.trim();
        const content = form.querySelector('#homeSectionContent').value.trim();
        if (!title || !content) {
            window.UniUI.toast('Vui lòng nhập đầy đủ tiêu đề và nội dung', 'warning');
            return;
        }

        await window.UniData.withOptimisticUpdate(
            () => {
                ensureHomeSectionRecords();
                const now = new Date().toISOString();
                let existing = window.demo.homePosts.find(post => post.category === sectionId);
                if (existing) {
                    existing.title = title;
                    existing.content = content;
                    existing.updatedAt = now;
                } else {
                    existing = {
                        id: window.UniData?.generateId ? window.UniData.generateId('home') : ('HP' + Math.random().toString(36).slice(2, 8).toUpperCase()),
                        category: sectionId,
                        title,
                        content,
                        attachments: [],
                        tags: [],
                        createdAt: now,
                        updatedAt: now
                    };
                    window.demo.homePosts.push(existing);
                }
                return {
                    supabaseEntities: {
                        homePosts: [existing]
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    renderHome();
                    window.UniUI.toast('Đã cập nhật nội dung', 'success');
                },
                onError: (error) => {
                    console.error('Error saving home section:', error);
                    window.UniUI.toast('Không thể lưu nội dung trang chủ', 'error');
                }
            }
        );
    });

    window.UniUI.openModal(`Chỉnh sửa ${sectionMeta.label}`, form);
}

function renderHome() {
    ensureHomeSectionRecords();
    const main = document.querySelector('#main-content');
    if (!main) return;
    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = currentUser?.role === 'admin';
    window.UniLayout?.enterLandingMode?.();

    const userLinks = getHomeUserLinks(currentUser);
    const stats = getHomeStats();

    const headerHtml = `
        <header class="home-landing-header">
            <div class="home-brand">
                <div class="home-logo" data-scroll-target="#hero">
                    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6z" fill="currentColor"></path>
                    </svg>
                    <div>
                        <span class="home-brand-name">Unicorns Edu</span>
                        <span class="home-brand-tagline">Education Platform</span>
                    </div>
                </div>
            </div>
            <nav class="home-primary-nav">
                ${HOME_MENU.map((item, index) => `
                    <button class="home-nav-link ${index === 0 ? 'active' : ''}" data-home-nav="${item.id}" data-scroll-target="#section-${item.id}">
                        ${item.label}
                    </button>
                `).join('')}
            </nav>
            <div class="home-auth-actions">
                ${currentUser ? `
                    <div class="home-user-chip">
                        <span class="chip-name">${currentUser.name || currentUser.email || 'Người dùng'}</span>
                        <span class="chip-role">${currentUser.role === 'admin' ? 'Quản trị viên' : currentUser.role === 'teacher' ? 'Giáo viên' : 'Thành viên'}</span>
                    </div>
                    ${userLinks.map(link => link.action === 'manage-home'
                        ? `<button class="btn btn-outline" data-home-manage="sections">Quản lý Trang Chủ</button>`
                        : `<button class="btn btn-outline" data-home-link="${link.page}">${link.label}</button>`).join('')}
                ` : `
                    <button class="btn btn-ghost" data-home-auth="login">
                        <span>Đăng nhập</span>
                    </button>
                    <button class="btn btn-primary" data-home-auth="register">
                        <span>Đăng ký</span>
                    </button>
                `}
            </div>
        </header>
    `;

    const heroHtml = `
        <section class="home-hero" id="hero">
            <div class="home-hero-content">
                <p class="home-pill">#1 Education Management Platform</p>
                <h1>Nền tảng quản lý giáo dục & luyện thi hiện đại</h1>
                <p class="home-hero-subtext">
                    Quản lý lớp học, giáo án, học sinh và nhân sự trong một hệ thống duy nhất.
                    Được phát triển riêng cho các trung tâm luyện thi, bồi dưỡng văn hoá và lập trình.
                </p>
                <div class="home-hero-actions">
                    <button class="btn btn-primary btn-lg" data-home-cta="start">Bắt đầu ngay</button>
                    <button class="btn btn-text" data-scroll-target="#section-intro">
                        Tìm hiểu thêm
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>
                    </button>
                </div>
                <div class="home-hero-kpis">
                    <div class="hero-kpi-card">
                        <p>Học sinh đang theo học</p>
                        <strong>${stats.activeStudents || 0}</strong>
                    </div>
                    <div class="hero-kpi-card">
                        <p>Lớp học đang vận hành</p>
                        <strong>${stats.activeClasses || 0}</strong>
                    </div>
                    <div class="hero-kpi-card">
                        <p>Nhân sự Sale & CSKH</p>
                        <strong>${stats.activeStaff || 0}</strong>
                    </div>
                </div>
            </div>
            <div class="home-hero-illustration">
                <div class="hero-badge">
                    <span>Realtime Sync</span>
                    <strong>+38%</strong>
                </div>
                <div class="hero-card hero-card--primary">
                    <p>Giáo án đã hoàn thành</p>
                    <strong>1,240+</strong>
                </div>
                <div class="hero-card hero-card--secondary">
                    <p>Nhân sự đang hoạt động</p>
                    <strong>63</strong>
                </div>
            </div>
        </section>
    `;

    const insightHtml = `
        <section class="home-insights">
            <div class="home-insight-card">
                <p class="insight-label">Mức độ hài lòng phụ huynh</p>
                <div class="insight-value">${stats.satisfaction}%</div>
                <p class="insight-meta">Tổng hợp từ khảo sát định kỳ & phản hồi CSKH</p>
            </div>
            <div class="home-insight-card">
                <p class="insight-label">Quy trình tự động hóa</p>
                <div class="insight-value">${stats.automationRate}%</div>
                <p class="insight-meta">Lịch học, nhắc học phí, chăm sóc học sinh đều chạy nền</p>
            </div>
            <div class="home-insight-card">
                <p class="insight-label">Module đang sử dụng</p>
                <div class="insight-chips">
                    ${['Dashboard', 'Students', 'Staff', 'Contest'].map(chip => `<span>${chip}</span>`).join('')}
                </div>
                <p class="insight-meta">Học hỏi từ các trang Dashboard, Students, Staff</p>
            </div>
        </section>
    `;

    const featureHtml = `
        <section class="home-feature-grid">
            ${HOME_FEATURES.map(feature => `
                <article class="home-feature-card">
                    <div class="feature-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${feature.icon}</svg>
                    </div>
                    <h3>${feature.title}</h3>
                    <p>${feature.description}</p>
                    <button class="feature-link" data-scroll-target="${feature.target}">Xem chi tiết →</button>
                </article>
            `).join('')}
        </section>
    `;

    const workflowHtml = `
        <section class="home-workflow">
            <div class="workflow-header">
                <p class="section-eyebrow">Quy trình vận hành</p>
                <h2>Học hỏi từ Dashboard, Staff, Students</h2>
                <p class="workflow-tagline">Gắn kết dữ liệu từ Supabase và các trang nội bộ để tạo nên luồng chăm sóc hoàn chỉnh.</p>
            </div>
            <div class="workflow-grid">
                ${HOME_WORKFLOW_STEPS.map(step => `
                    <article class="workflow-card">
                        <div class="workflow-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                ${step.icon}
                            </svg>
                        </div>
                        <h3>${step.title}</h3>
                        <p>${step.description}</p>
                        <button class="feature-link" data-home-link="${step.page}">${step.actionLabel}</button>
                    </article>
                `).join('')}
            </div>
        </section>
    `;

    const modulePreviewHtml = `
        <section class="home-preview" aria-label="Tổng quan hệ thống">
            <div class="preview-header">
                <div>
                    <p class="section-eyebrow">Giao diện sản phẩm</p>
                    <h2>Góc nhìn nhanh từ Students, Classes, Staff</h2>
                    <p class="preview-tagline">Tái sử dụng các layout đã quen thuộc ở trang quản trị để giới thiệu với khách truy cập.</p>
                </div>
            </div>
            <div class="preview-grid">
                ${HOME_MODULE_PREVIEWS.map(module => `
                    <article class="preview-card">
                        <div class="preview-card-top">
                            <div>
                                <p class="muted text-sm">${module.label}</p>
                                <h3>${stats[module.metricKey] || 0} <span>${module.metricLabel}</span></h3>
                            </div>
                            <button class="btn btn-ghost btn-icon" data-home-link="${module.page}" title="Đi tới ${module.label}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 18l6-6-6-6"></path>
                                </svg>
                            </button>
                        </div>
                        <p>${module.blurb}</p>
                        <div class="preview-meta">
                            <span>Liên kết trực tiếp tới trang ${module.page}</span>
                            <span class="status-pill">Realtime DB</span>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;

    const teamsHtml = `
        <section class="home-teams-section" id="section-intro">
            <div class="teams-header">
                <p class="section-eyebrow">Giới thiệu</p>
                <h2>Giới thiệu Teams Unicorns Edu</h2>
                <p class="teams-tagline">Đồng hành cùng bạn trên hành trình học tập</p>
            </div>
            <div class="home-teams-grid">
                ${HOME_TEAMS.map(team => `
                    <article class="home-team-card">
                        <div class="team-icon">${team.icon}</div>
                        <h3>${team.name}</h3>
                        <p>${team.description}</p>
                        <a class="btn btn-outline" href="${team.link}" target="_blank" rel="noopener noreferrer">
                            Xem Fanpage
                        </a>
                    </article>
                `).join('')}
            </div>
            <div class="home-teams-contact">
                <div>
                    <p class="muted text-sm">Liên hệ ngay</p>
                    <div class="contact-inline">
                        <span>📞 0911 589 217 • 0336 755 856</span>
                        <span>📧 unicornseducvp@gmail.com</span>
                        <span>📍 Đại học Bách khoa Hà Nội</span>
                    </div>
                </div>
            </div>
        </section>
    `;

    const sectionsHtml = HOME_MENU.filter(item => item.id !== 'policy' && item.id !== 'intro').map(section => {
        const content = getHomeSection(section.id);
        return `
            <section class="home-section" id="section-${section.id}">
                <div class="home-section-header">
                    <p class="section-eyebrow">${section.label}</p>
                    <div class="section-title-row">
                        <h2>${content.title}</h2>
                        ${isAdmin ? `<button class="home-edit-btn" data-edit-section="${section.id}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Chỉnh sửa
                        </button>` : ''}
                    </div>
                    <div class="home-section-description">${formatSectionContent(content.content)}</div>
                </div>
            </section>
        `;
    }).join('');

    const contactHtml = `
        <footer class="home-footer" id="section-policy">
            <div class="home-footer-card">
                <div class="home-footer-left">
                    <p class="section-eyebrow">Liên hệ</p>
                    <h2>Kết nối với Unicorns Edu</h2>
                    <p class="home-footer-lede">Đội ngũ CSKH của chúng tôi luôn sẵn sàng để hỗ trợ bạn triển khai hệ thống.</p>
                    <div class="home-contact-grid">
                        <div class="contact-item">
                            <div class="contact-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4h16v16H4z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                            </div>
                            <div>
                                <p class="muted text-sm">Email</p>
                                <a href="mailto:${HOME_CONTACT.email}">${HOME_CONTACT.email}</a>
                            </div>
                        </div>
                        <div class="contact-item">
                            <div class="contact-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 16.92V21a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3 6.18 2 2 0 0 1 5 4h4.09a1 1 0 0 1 1 .75l1 4a1 1 0 0 1-.27.95l-2.2 2.2a16 16 0 0 0 5.66 5.66l2.2-2.2a1 1 0 0 1 .95-.27l4 1a1 1 0 0 1 .75 1z"></path>
                                </svg>
                            </div>
                            <div>
                                <p class="muted text-sm">Hotline</p>
                                <a href="tel:${HOME_CONTACT.phone.replace(/[^0-9]/g, '')}">${HOME_CONTACT.phone}</a>
                            </div>
                        </div>
                        <div class="contact-item">
                            <div class="contact-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                            </div>
                            <div>
                                <p class="muted text-sm">Địa chỉ</p>
                                <p>${HOME_CONTACT.address}</p>
                            </div>
                        </div>
                    </div>
                    <div class="home-footer-actions">
                        <button class="btn btn-primary" data-home-auth="register">Nhận tư vấn triển khai</button>
                        <button class="btn btn-ghost" data-scroll-target="#hero">
                            Xem thêm tính năng
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="home-footer-right">
                    <p class="muted text-sm">Theo dõi chúng tôi</p>
                    <h3>SALE & CSKH cập nhật mỗi tuần</h3>
                    <div class="home-footer-socials">
                        ${HOME_CONTACT.socials.map(social => `
                            <a href="${social.url}" target="_blank" rel="noopener" class="home-social-link">
                                <span class="home-social-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${social.icon}</svg>
                                </span>
                                <span>${social.label}</span>
                            </a>
                        `).join('')}
                    </div>
                    <div class="home-footer-note">© ${new Date().getFullYear()} Unicorns Edu • Bản quyền thuộc Unicorns Edu.</div>
                </div>
            </div>
        </footer>
    `;

    main.innerHTML = `
        <div class="home-landing">
            ${headerHtml}
            <main class="home-main">
                ${heroHtml}
                ${insightHtml}
                ${teamsHtml}
                ${featureHtml}
                ${workflowHtml}
                ${modulePreviewHtml}
                ${sectionsHtml}
            </main>
            ${contactHtml}
        </div>
    `;

    const navLinks = main.querySelectorAll('.home-nav-link');
    const setActiveNav = (navId) => {
        if (!navId) return;
        const normalized = navId
            .replace('#', '')
            .replace('section-', '')
            .replace('#section-', '');
        navLinks.forEach(link => {
            const linkId = link.dataset.homeNav;
            if (linkId === normalized) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    };

    navLinks.forEach(button => {
        button.addEventListener('click', () => {
            setActiveNav(button.dataset.homeNav);
        });
    });

    main.querySelectorAll('[data-scroll-target]').forEach(button => {
        button.addEventListener('click', () => {
            const targetSelector = button.dataset.scrollTarget;
            if (targetSelector) {
                const normalizedId = targetSelector.replace('#section-', '');
                setActiveNav(normalizedId);
                const target = document.querySelector(targetSelector);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    main.querySelectorAll('[data-home-auth]').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.homeAuth;
            openHomeAuthModal(type === 'register' ? 'register' : 'login');
        });
    });

    main.querySelectorAll('[data-home-link]').forEach(button => {
        button.addEventListener('click', () => {
            const page = button.dataset.homeLink;
            if (page) {
                window.UniUI.loadPage(page);
            }
        });
    });

    main.querySelectorAll('[data-edit-section]').forEach(button => {
        button.addEventListener('click', () => openHomeSectionEditor(button.dataset.editSection));
    });

    main.querySelector('[data-home-manage="sections"]')?.addEventListener('click', () => {
        document.querySelector('#section-intro')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.UniUI.toast('Chọn nút "Chỉnh sửa" tại từng mục để cập nhật nội dung.', 'info');
    });

    main.querySelector('[data-home-cta="start"]')?.addEventListener('click', () => {
        if (currentUser) {
            window.UniUI.loadPage('dashboard');
        } else {
            openHomeAuthModal('login');
        }
    });

    // Thêm scroll detection để cải thiện header khi scroll
    const header = main.querySelector('.home-landing-header');
    if (header) {
        let lastScroll = 0;
        const handleScroll = () => {
            const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
            if (currentScroll > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            lastScroll = currentScroll;
        };
        
        // Throttle scroll event
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
        
        // Initial check
        handleScroll();
    }
}

function openHomeAuthModal(mode) {
    const isLogin = mode === 'login';
    const title = isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản';
    const form = document.createElement('form');
    form.className = 'home-auth-form';
    form.innerHTML = isLogin
        ? `
            <div class="form-group">
                <label for="homeAuthEmail">Email / Tên đăng nhập</label>
                <input id="homeAuthEmail" class="form-control" type="text" required autocomplete="username">
            </div>
            <div class="form-group">
                <label for="homeAuthPassword">Mật khẩu</label>
                <input id="homeAuthPassword" class="form-control" type="password" required autocomplete="current-password">
            </div>
            <div class="form-actions mt-4">
                <button type="button" class="btn" data-close-modal>Hủy</button>
                <button type="submit" class="btn btn-primary">Đăng nhập</button>
            </div>
            <div class="text-right mt-2">
                <a href="#" class="text-sm" data-forgot-password>Quên mật khẩu?</a>
            </div>
        `
        : `
            <div class="form-group">
                <label for="homeRegName">Họ tên</label>
                <input id="homeRegName" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="homeRegEmail">Email</label>
                <input id="homeRegEmail" class="form-control" type="email" required autocomplete="email">
            </div>
            <div class="form-group">
                <label for="homeRegPassword">Mật khẩu</label>
                <input id="homeRegPassword" class="form-control" type="password" required autocomplete="new-password">
            </div>
            <div class="form-group">
                <label for="homeRegPasswordConfirm">Xác nhận mật khẩu</label>
                <input id="homeRegPasswordConfirm" class="form-control" type="password" required autocomplete="new-password">
            </div>
            <div class="form-actions mt-4">
                <button type="button" class="btn" data-close-modal>Hủy</button>
                <button type="submit" class="btn btn-primary">Đăng ký</button>
            </div>
            <p class="text-muted text-sm mt-2">Đăng ký mặc định với vai trò Học sinh. Liên hệ admin nếu bạn là giáo viên.</p>
        `;

    form.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => window.UniUI.closeModal());
    });

    const submitButton = form.querySelector('button[type="submit"]');
    const setLoading = (state) => {
        if (!submitButton) return;
        submitButton.disabled = state;
        submitButton.dataset.loading = state ? '1' : '';
        submitButton.textContent = state
            ? (isLogin ? 'Đang xác thực...' : 'Đang đăng ký...')
            : (isLogin ? 'Đăng nhập' : 'Đăng ký');
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isLogin) {
            const emailOrHandle = form.querySelector('#homeAuthEmail').value.trim();
            const password = form.querySelector('#homeAuthPassword').value;
            try {
                setLoading(true);
                await window.UniAuth.login(emailOrHandle, password);
                window.UniUI.toast('Đăng nhập thành công', 'success');
                window.UniUI.closeModal();
                window.UniUI.refreshNavigation?.();
                window.UniUI.loadPage('dashboard');
            } catch (error) {
                window.UniUI.toast(error.message || 'Đăng nhập thất bại', 'danger');
            } finally {
                setLoading(false);
            }
        } else {
            const fullName = form.querySelector('#homeRegName').value.trim();
            const email = form.querySelector('#homeRegEmail').value.trim();
            const password = form.querySelector('#homeRegPassword').value;
            const confirm = form.querySelector('#homeRegPasswordConfirm').value;
            if (password !== confirm) {
                window.UniUI.toast('Mật khẩu và xác nhận không khớp', 'warning');
                return;
            }
            try {
                setLoading(true);
                await window.UniAuth.register(email, password, 'student', { fullName });
                window.UniUI.toast('Đăng ký thành công', 'success');
                window.UniUI.closeModal();
                window.UniUI.refreshNavigation?.();
                window.UniUI.loadPage('dashboard');
            } catch (error) {
                window.UniUI.toast(error.message || 'Đăng ký thất bại', 'danger');
            } finally {
                setLoading(false);
            }
        }
    });

    form.querySelector('[data-forgot-password]')?.addEventListener('click', (event) => {
        event.preventDefault();
        window.UniUI.toast('Liên hệ admin để đặt lại mật khẩu.', 'info');
    });

    window.UniUI.openModal(title, form);
}

// Expose openHomeAuthModal for use from top navigation
window.openHomeAuthModal = openHomeAuthModal;

window.HomePage = { render: renderHome };
