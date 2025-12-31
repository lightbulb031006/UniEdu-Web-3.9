import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchDashboardData } from '../services/dashboardService';
import { fetchHomePostByCategory, upsertHomePost, HomePost } from '../services/homeService';
import AuthModal from '../components/AuthModal';
import Modal from '../components/Modal';
import { toast } from '../utils/toast';
import { hasRole } from '../utils/permissions';

/**
 * Home Page Component
 * Marketing style landing page before login
 * Migrated from backup/assets/js/pages/home.js
 * UI/UX giống hệt app cũ với logic đầy đủ
 */

const HOME_MENU = [
  { id: 'intro', label: 'Giới thiệu', description: 'Tầm nhìn & triết lý đào tạo.' },
  { id: 'news', label: 'Khóa học', description: 'Lộ trình học phù hợp từng trình độ.' },
  { id: 'docs', label: 'Cuộc thi', description: 'Sự kiện luyện thi & lập trình định kỳ.' },
  { id: 'policy', label: 'Liên hệ', description: 'Kết nối với đội ngũ Unicorns Edu.' },
];

const HOME_TEAMS = [
  {
    id: 'it',
    icon: '💻',
    name: 'Team Tin học',
    description: 'Đồng hành trong lập trình, thuật toán và ứng dụng CNTT với các lớp chuyên sâu & luyện thi.',
    link: 'https://www.facebook.com/profile.php?id=61577992693085',
  },
  {
    id: 'japanese',
    icon: '🇯🇵',
    name: 'Team Tiếng Nhật',
    description: 'Đào tạo từ sơ cấp đến JLPT, giao tiếp và hiểu sâu văn hóa Nhật với giáo trình chuẩn bản xứ.',
    link: 'https://www.facebook.com/unicornstiengnhat',
  },
  {
    id: 'math',
    icon: '📐',
    name: 'Team Toán học',
    description: 'Phát triển tư duy logic, luyện thi chuyên và thi HSG với lộ trình cá nhân hoá theo năng lực.',
    link: 'https://www.facebook.com/profile.php?id=61578074894066',
  },
];

const HOME_FEATURES = [
  {
    id: 'classes',
    title: 'Quản lý lớp học',
    description: 'Theo dõi sĩ số, lịch học và tình trạng học phí ngay trên một màn hình duy nhất.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    target: '#section-intro',
  },
  {
    id: 'lesson',
    title: 'Giáo án & bài tập',
    description: 'Hệ thống hóa giáo án, giao bài tập và chấm điểm chỉ với vài thao tác.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h4" />
      </svg>
    ),
    target: '#section-news',
  },
  {
    id: 'people',
    title: 'Nhân sự & SALE-CSKH',
    description: 'Quản lý KPIs, hoa hồng và lịch chăm sóc học sinh theo thời gian thực.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    target: '#section-news',
  },
  {
    id: 'contests',
    title: 'Cuộc thi & lập trình',
    description: 'Tổ chức contest nội bộ, luyện code và chia sẻ kết quả minh bạch.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path d="M8 20h8" />
        <path d="M12 16v4" />
      </svg>
    ),
    target: '#section-docs',
  },
];

const HOME_WORKFLOW_STEPS = [
  {
    id: 'sync',
    title: 'Đồng bộ dữ liệu tức thời',
    description: 'Kết nối dữ liệu học sinh, lớp học, lịch dạy và tài chính trong cùng một bảng điều khiển.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 9-9h9" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-9 9H3" />
      </svg>
    ),
    actionLabel: 'Xem Dashboard',
    page: 'dashboard',
  },
  {
    id: 'people',
    title: 'Quản trị nhân sự SALE & CSKH',
    description: 'Theo dõi KPIs, danh sách học sinh phụ trách và tự động nhắc lịch chăm sóc.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="7" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
    actionLabel: 'Đi tới Nhân sự',
    page: 'staff',
  },
  {
    id: 'students',
    title: 'Trải nghiệm chăm sóc học sinh',
    description: 'Từ hồ sơ, trạng thái học phí đến lịch sử học tập – tất cả đều cập nhật real-time.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    actionLabel: 'Xem Học sinh',
    page: 'students',
  },
];

const HOME_MODULE_PREVIEWS = [
  {
    id: 'students',
    label: 'Học sinh',
    metricKey: 'activeStudents',
    metricLabel: 'đang theo học',
    blurb: 'Quản lý hồ sơ, lịch sử học, thông tin phụ huynh và công nợ ở cùng một nơi.',
    page: 'students',
  },
  {
    id: 'classes',
    label: 'Lớp học',
    metricKey: 'activeClasses',
    metricLabel: 'lớp đang mở',
    blurb: 'Xếp lịch, phân giáo viên, chấm buổi và đồng bộ học phí chỉ với vài thao tác.',
    page: 'classes',
  },
  {
    id: 'staff',
    label: 'SALE & CSKH',
    metricKey: 'activeStaff',
    metricLabel: 'nhân sự đang hoạt động',
    blurb: 'Danh sách học sinh phụ trách, KPIs và hoa hồng được đồng bộ trực tiếp từ Supabase.',
    page: 'staff',
  },
];

const HOME_SECTION_DEFAULTS = {
  intro: {
    title: 'Nơi kết nối giáo viên, học sinh và phụ huynh trong một hệ thống thống nhất',
    content: 'Unicorns Edu cung cấp bộ công cụ quản lý dành riêng cho các trung tâm luyện thi và bồi dưỡng. Từ việc tạo lớp, xếp lịch đến đánh giá kết quả đều được số hóa giúp educator tiết kiệm thời gian và tập trung vào chất lượng giảng dạy.',
  },
  news: {
    title: 'Chương trình học cá nhân hoá theo trình độ',
    content: 'Hệ thống hỗ trợ xây dựng khóa học theo gói buổi, tự động nhắc lịch và cập nhật tình trạng học phí. Học sinh có ứng dụng riêng để theo dõi tiến độ, nhận tài liệu và tương tác với giáo viên.',
  },
  docs: {
    title: 'Cuộc thi lập trình & học thuật mỗi tháng',
    content: 'Unicorns Edu tích hợp module contest để trung tâm tạo đề, chấm điểm và công bố bảng xếp hạng. Lịch sử cuộc thi được lưu lại giúp học sinh theo dõi sự tiến bộ của chính mình.',
  },
};

const HOME_CONTACT = {
  email: 'unicornseducvp@gmail.com',
  phone: '0911 589 217 • 0336 755 856',
  address: 'Đại học Bách khoa Hà Nội',
  socials: [
    {
      label: 'Facebook',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3.64L18 10h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      ),
      url: 'https://facebook.com',
    },
    {
      label: 'YouTube',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 17.5v-11l9 5.5z" />
          <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
        </svg>
      ),
      url: 'https://youtube.com',
    },
    {
      label: 'LinkedIn',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      ),
      url: 'https://linkedin.com',
    },
  ],
};

// Get home stats from dashboard API
async function getHomeStats() {
  try {
    // Dashboard API cần filterType và filterValue
    const currentYear = new Date().getFullYear().toString();
    const dashboardData = await fetchDashboardData({ 
      filterType: 'year', 
      filterValue: currentYear 
    });
    return {
      activeStudents: dashboardData.summary.activeStudents || 0,
      activeClasses: dashboardData.summary.activeClasses || 0,
      activeStaff: dashboardData.summary.totalTeachers || 0,
      satisfaction: Math.min(99, 82 + Math.round(Math.random() * 12)),
      automationRate: 72 + Math.round(Math.random() * 12),
    };
  } catch (error) {
    // Fallback to default values - không log 400/404 errors
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as { response?: { status?: number } };
      if (httpError.response?.status === 400 || httpError.response?.status === 404) {
        // Ignore 400/404 errors silently
      } else {
        console.debug('Failed to fetch home stats:', error);
      }
    }
    return {
      activeStudents: 150,
      activeClasses: 25,
      activeStaff: 12,
      satisfaction: Math.min(99, 82 + Math.round(Math.random() * 12)),
      automationRate: 72 + Math.round(Math.random() * 12),
    };
  }
}

interface HomeProps {
  initialAuthMode?: 'login' | 'register';
}

function Home({ initialAuthMode }: HomeProps = {} as HomeProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [activeNav, setActiveNav] = useState('intro');
  const [stats, setStats] = useState({ activeStudents: 0, activeClasses: 0, activeStaff: 0, satisfaction: 85, automationRate: 75 });
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(!!initialAuthMode);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>(initialAuthMode || 'login');
  const [editSectionModalOpen, setEditSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<{ id: string; category: string } | null>(null);
  const [sections, setSections] = useState<Record<string, { title: string; content: string; id?: string }>>({});
  
  const isAdmin = hasRole('admin');

  // Set body class for landing mode
  useEffect(() => {
    document.body.classList.add('home-landing-mode');
    return () => {
      document.body.classList.remove('home-landing-mode');
    };
  }, []);

  // Scroll detection for header - giống code cũ
  useEffect(() => {
    const header = document.querySelector('.home-landing-header');
    if (!header) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
          if (currentScroll > 50) {
            header.classList.add('scrolled');
          } else {
            header.classList.remove('scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Scroll detection for active nav - giống code cũ
  useEffect(() => {
    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const sections = HOME_MENU.map((item) => {
          const element = document.getElementById(`section-${item.id}`);
          return { id: item.id, element };
        }).filter((s) => s.element);

        const scrollPosition = window.scrollY + window.innerHeight / 3;

        // Find the section that's currently in view
        for (let i = sections.length - 1; i >= 0; i--) {
          const section = sections[i];
          if (section.element && section.element.offsetTop <= scrollPosition) {
            setActiveNav(section.id);
            break;
          }
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleScrollTo = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Set active nav immediately when clicking
      const normalizedId = sectionId.replace('#section-', '').replace('section-', '');
      setActiveNav(normalizedId);
    }
  };

  const handleStart = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      setAuthModalMode('login');
      setAuthModalOpen(true);
    }
  };

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleNavClick = (navId: string) => {
    setActiveNav(navId);
    handleScrollTo(`section-${navId}`);
  };

  // Load stats from API (only if authenticated)
  useEffect(() => {
    const token = localStorage.getItem('unicorns.token');
    if (!token) {
      // Use default stats if not authenticated
      return;
    }

    let cancelled = false;
    
    getHomeStats()
      .then((stats) => {
        if (!cancelled) {
          setStats(stats);
        }
      })
      .catch((error) => {
        // Ignore errors (connection refused, etc.) - use default stats
        if (!cancelled && error?.code !== 'ERR_CONNECTION_REFUSED') {
          console.debug('Failed to load home stats:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load sections from API (only if authenticated)
  useEffect(() => {
    const token = localStorage.getItem('unicorns.token');
    if (!token) {
      // Use defaults if not authenticated
      setSections(HOME_SECTION_DEFAULTS);
      return;
    }

    let cancelled = false;

    const loadSections = async () => {
      const sectionIds = ['news', 'docs'];
      const loadedSections: Record<string, { title: string; content: string; id?: string }> = {};
      
      for (const sectionId of sectionIds) {
        if (cancelled) break;
        
        try {
          const post = await fetchHomePostByCategory(sectionId);
          if (cancelled) break;
          
          if (post) {
            loadedSections[sectionId] = {
              title: post.title,
              content: post.content,
              id: post.id,
            };
          } else {
            // Use default
            loadedSections[sectionId] = HOME_SECTION_DEFAULTS[sectionId as keyof typeof HOME_SECTION_DEFAULTS] || { title: '', content: '' };
          }
        } catch (error: any) {
          // Use default on error (ignore connection refused and 404)
          if (error?.code !== 'ERR_CONNECTION_REFUSED' && error?.response?.status !== 404) {
            console.debug(`Failed to load section ${sectionId}:`, error);
          }
          loadedSections[sectionId] = HOME_SECTION_DEFAULTS[sectionId as keyof typeof HOME_SECTION_DEFAULTS] || { title: '', content: '' };
        }
      }
      
      if (!cancelled) {
        setSections(loadedSections);
      }
    };
    
    loadSections();

    return () => {
      cancelled = true;
    };
  }, []);

  const getHomeSection = useCallback((sectionId: string) => {
    if (sections[sectionId]) {
      return sections[sectionId];
    }
    return HOME_SECTION_DEFAULTS[sectionId as keyof typeof HOME_SECTION_DEFAULTS] || { title: '', content: '' };
  }, [sections]);

  const handleEditSection = (sectionId: string) => {
    const sectionMeta = HOME_MENU.find((item) => item.id === sectionId);
    if (!sectionMeta) return;
    
    const current = getHomeSection(sectionId);
    setEditingSection({ id: current.id || '', category: sectionId });
    setEditSectionModalOpen(true);
  };

  const handleSaveSection = async (title: string, content: string) => {
    if (!editingSection) return;
    
    try {
      await upsertHomePost({
        id: editingSection.id || undefined,
        category: editingSection.category as 'intro' | 'news' | 'docs' | 'policy',
        title: title.trim(),
        content: content.trim(),
        author_id: user?.id,
        author_name: user?.name || user?.email,
      });
      
      // Update local state
      setSections((prev) => ({
        ...prev,
        [editingSection.category]: { title: title.trim(), content: content.trim(), id: editingSection.id },
      }));
      
      setEditSectionModalOpen(false);
      setEditingSection(null);
      toast.success('Đã cập nhật nội dung');
    } catch (error: any) {
      toast.error('Không thể lưu nội dung: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatSectionContent = (content: string) => {
    if (!content) return '';
    return content.split(/\n{2,}/).map((paragraph, i) => (
      <p key={i} style={{ marginBottom: 'var(--spacing-3)' }}>
        {paragraph.split('\n').map((line, j) => (
          <React.Fragment key={j}>
            {line}
            {j < paragraph.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    ));
  };

  const getHomeUserLinks = (user: any) => {
    if (!user) return [];
    switch (user.role) {
      case 'admin':
        return [
          { label: 'Về Dashboard', page: 'dashboard' },
          { label: 'Quản lý Trang Chủ', action: 'manage-home' },
        ];
      case 'teacher':
        return [
          { label: 'Dashboard', page: 'dashboard' },
          { label: 'Lớp học', page: 'classes' },
        ];
      case 'student':
        return [
          { label: 'Lớp học', page: 'classes' },
          { label: 'Lịch sử học', page: 'dashboard' },
        ];
      default:
        return [{ label: 'Dashboard', page: 'dashboard' }];
    }
  };

  const userLinks = getHomeUserLinks(user);

  return (
    <div className="home-landing">
      {/* Header */}
      <header className="home-landing-header">
        <div className="home-brand">
          <div className="home-logo" onClick={() => handleScrollTo('hero')} style={{ cursor: 'pointer' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6z" fill="currentColor" />
            </svg>
            <div>
              <span className="home-brand-name">Unicorns Edu</span>
              <span className="home-brand-tagline">Education Platform</span>
            </div>
          </div>
        </div>
        <nav className="home-primary-nav">
          {HOME_MENU.map((item, index) => (
            <button
              key={item.id}
              className={`home-nav-link ${activeNav === item.id || (index === 0 && activeNav === 'intro') ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="home-auth-actions">
          {isAuthenticated ? (
            <>
              <div className="home-user-chip">
                <span className="chip-name">{user?.name || user?.email || 'Người dùng'}</span>
                <span className="chip-role">
                  {user?.role === 'admin' ? 'Quản trị viên' : user?.role === 'teacher' ? 'Giáo viên' : 'Thành viên'}
                </span>
              </div>
              {userLinks.map((link, idx) =>
                link.action === 'manage-home' ? (
                  <button
                    key={idx}
                    className="btn btn-outline"
                    onClick={() => {
                      handleScrollTo('section-intro');
                      toast.info('Cuộn đến phần Giới thiệu để chỉnh sửa');
                    }}
                  >
                    Quản lý Trang Chủ
                  </button>
                ) : (
                  <button key={idx} className="btn btn-outline" onClick={() => navigate(`/${link.page}`)}>
                    {link.label}
                  </button>
                )
              )}
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => openAuthModal('login')}>
                <span>Đăng nhập</span>
              </button>
              <button className="btn btn-primary" onClick={() => openAuthModal('register')}>
                <span>Đăng ký</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        {/* Hero Section */}
        <section className="home-hero" id="hero">
          <div className="home-hero-content">
            <p className="home-pill">#1 Education Management Platform</p>
            <h1>Nền tảng quản lý giáo dục & luyện thi hiện đại</h1>
            <p className="home-hero-subtext">
              Quản lý lớp học, giáo án, học sinh và nhân sự trong một hệ thống duy nhất. Được phát triển riêng cho các trung tâm luyện thi, bồi dưỡng văn hoá và lập trình.
            </p>
            <div className="home-hero-actions">
              <button className="btn btn-primary btn-lg" onClick={handleStart}>
                Bắt đầu ngay
              </button>
              <button className="btn btn-text" onClick={() => handleScrollTo('section-intro')}>
                Tìm hiểu thêm
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'var(--spacing-2)' }}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
            <div className="home-hero-kpis">
              <div className="hero-kpi-card">
                <p>Học sinh đang theo học</p>
                <strong>{stats.activeStudents}</strong>
              </div>
              <div className="hero-kpi-card">
                <p>Lớp học đang vận hành</p>
                <strong>{stats.activeClasses}</strong>
              </div>
              <div className="hero-kpi-card">
                <p>Nhân sự Sale & CSKH</p>
                <strong>{stats.activeStaff}</strong>
              </div>
            </div>
          </div>
          <div className="home-hero-illustration">
            <div className="hero-badge">
              <span>Realtime Sync</span>
              <strong>+38%</strong>
            </div>
            <div className="hero-card hero-card--primary">
              <p>Giáo án đã hoàn thành</p>
              <strong>1,240+</strong>
            </div>
            <div className="hero-card hero-card--secondary">
              <p>Nhân sự đang hoạt động</p>
              <strong>63</strong>
            </div>
          </div>
        </section>

        {/* Insights Section */}
        <section className="home-insights">
          <div className="home-insight-card">
            <p className="insight-label">Mức độ hài lòng phụ huynh</p>
            <div className="insight-value">{stats.satisfaction}%</div>
            <p className="insight-meta">Tổng hợp từ khảo sát định kỳ & phản hồi CSKH</p>
          </div>
          <div className="home-insight-card">
            <p className="insight-label">Quy trình tự động hóa</p>
            <div className="insight-value">{stats.automationRate}%</div>
            <p className="insight-meta">Lịch học, nhắc học phí, chăm sóc học sinh đều chạy nền</p>
          </div>
          <div className="home-insight-card">
            <p className="insight-label">Module đang sử dụng</p>
            <div className="insight-chips">
              {['Dashboard', 'Students', 'Staff', 'Contest'].map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
            <p className="insight-meta">Học hỏi từ các trang Dashboard, Students, Staff</p>
          </div>
        </section>

        {/* Teams Section */}
        <section className="home-teams-section" id="section-intro">
          <div className="teams-header">
            <p className="section-eyebrow">Giới thiệu</p>
            <h2>Giới thiệu Teams Unicorns Edu</h2>
            <p className="teams-tagline">Đồng hành cùng bạn trên hành trình học tập</p>
          </div>
          <div className="home-teams-grid">
            {HOME_TEAMS.map((team) => (
              <article key={team.id} className="home-team-card">
                <div className="team-icon">{team.icon}</div>
                <h3>{team.name}</h3>
                <p>{team.description}</p>
                <a className="btn btn-outline" href={team.link} target="_blank" rel="noopener noreferrer">
                  Xem Fanpage
                </a>
              </article>
            ))}
          </div>
          <div className="home-teams-contact">
            <div>
              <p className="muted text-sm">Liên hệ ngay</p>
              <div className="contact-inline">
                <span>📞 {HOME_CONTACT.phone}</span>
                <span>📧 {HOME_CONTACT.email}</span>
                <span>📍 {HOME_CONTACT.address}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="home-feature-grid">
          {HOME_FEATURES.map((feature) => (
            <article key={feature.id} className="home-feature-card">
              <div className="feature-icon" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.12)', borderRadius: 'var(--radius)', color: 'var(--primary)', marginBottom: 'var(--spacing-3)' }}>
                {feature.icon}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <button className="feature-link" onClick={() => handleScrollTo(feature.target.replace('#section-', ''))} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, marginTop: 'var(--spacing-2)', textAlign: 'left' }}>
                Xem chi tiết →
              </button>
            </article>
          ))}
        </section>

        {/* Workflow Section */}
        <section className="home-workflow">
          <div className="workflow-header">
            <p className="section-eyebrow">Quy trình vận hành</p>
            <h2>Học hỏi từ Dashboard, Staff, Students</h2>
            <p className="workflow-tagline">Gắn kết dữ liệu từ Supabase và các trang nội bộ để tạo nên luồng chăm sóc hoàn chỉnh.</p>
          </div>
          <div className="workflow-grid">
            {HOME_WORKFLOW_STEPS.map((step) => (
              <article key={step.id} className="workflow-card">
                <div className="workflow-icon">{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <button className="feature-link" onClick={() => navigate(`/${step.page}`)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, marginTop: 'var(--spacing-2)', textAlign: 'left' }}>
                  {step.actionLabel}
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* Module Preview Section */}
        <section className="home-preview" aria-label="Tổng quan hệ thống">
          <div className="preview-header">
            <div>
              <p className="section-eyebrow">Giao diện sản phẩm</p>
              <h2>Góc nhìn nhanh từ Students, Classes, Staff</h2>
              <p className="preview-tagline">Tái sử dụng các layout đã quen thuộc ở trang quản trị để giới thiệu với khách truy cập.</p>
            </div>
          </div>
          <div className="preview-grid">
            {HOME_MODULE_PREVIEWS.map((module) => (
              <article key={module.id} className="preview-card">
                <div className="preview-card-top">
                  <div>
                    <p className="muted text-sm">{module.label}</p>
                    <h3>
                      {stats[module.metricKey as keyof typeof stats] || 0} <span>{module.metricLabel}</span>
                    </h3>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => navigate(`/${module.page}`)} title={`Đi tới ${module.label}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
                <p>{module.blurb}</p>
                <div className="preview-meta">
                  <span>Liên kết trực tiếp tới trang {module.page}</span>
                  <span className="status-pill">Realtime DB</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Sections */}
        {HOME_MENU.filter((item) => item.id !== 'policy' && item.id !== 'intro').map((section) => {
          const content = getHomeSection(section.id);
          return (
            <section key={section.id} className="home-section" id={`section-${section.id}`}>
              <div className="home-section-header">
                <p className="section-eyebrow">{section.label}</p>
                <div className="section-title-row">
                  <h2>{content.title}</h2>
                  {isAuthenticated && isAdmin && (
                    <button
                      className="home-edit-btn"
                      onClick={() => handleEditSection(section.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Chỉnh sửa
                    </button>
                  )}
                </div>
                <div className="home-section-description">{formatSectionContent(content.content)}</div>
              </div>
            </section>
          );
        })}
      </main>

      {/* Footer/Contact Section */}
      <footer className="home-footer" id="section-policy">
        <div className="home-footer-card">
          <div className="home-footer-left">
            <p className="section-eyebrow">Liên hệ</p>
            <h2>Kết nối với Unicorns Edu</h2>
            <p className="home-footer-lede">Đội ngũ CSKH của chúng tôi luôn sẵn sàng để hỗ trợ bạn triển khai hệ thống.</p>
            <div className="home-contact-grid">
              <div className="contact-item">
                <div className="contact-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16v16H4z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <p className="muted text-sm">Email</p>
                  <a href={`mailto:${HOME_CONTACT.email}`}>{HOME_CONTACT.email}</a>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92V21a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3 6.18 2 2 0 0 1 5 4h4.09a1 1 0 0 1 1 .75l1 4a1 1 0 0 1-.27.95l-2.2 2.2a16 16 0 0 0 5.66 5.66l2.2-2.2a1 1 0 0 1 .95-.27l4 1a1 1 0 0 1 .75 1z" />
                  </svg>
                </div>
                <div>
                  <p className="muted text-sm">Hotline</p>
                  <a href={`tel:${HOME_CONTACT.phone.replace(/[^0-9]/g, '')}`}>{HOME_CONTACT.phone}</a>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <p className="muted text-sm">Địa chỉ</p>
                  <p>{HOME_CONTACT.address}</p>
                </div>
              </div>
            </div>
            <div className="home-footer-actions">
              <button className="btn btn-primary" onClick={() => openAuthModal('register')}>
                Nhận tư vấn triển khai
              </button>
              <button className="btn btn-ghost" onClick={() => handleScrollTo('hero')}>
                Xem thêm tính năng
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'var(--spacing-2)' }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
          <div className="home-footer-right">
            <p className="muted text-sm">Theo dõi chúng tôi</p>
            <h3>SALE & CSKH cập nhật mỗi tuần</h3>
            <div className="home-footer-socials">
              {HOME_CONTACT.socials.map((social) => (
                <a key={social.label} href={social.url} target="_blank" rel="noopener" className="home-social-link">
                  <span className="home-social-icon">{social.icon}</span>
                  <span>{social.label}</span>
                </a>
              ))}
            </div>
            <div className="home-footer-note">© {new Date().getFullYear()} Unicorns Edu • Bản quyền thuộc Unicorns Edu.</div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authModalMode}
        onModeChange={setAuthModalMode}
      />

      {/* Edit Section Modal */}
      {editingSection && (
        <EditSectionModal
          isOpen={editSectionModalOpen}
          onClose={() => {
            setEditSectionModalOpen(false);
            setEditingSection(null);
          }}
          sectionId={editingSection.category}
          sectionMeta={HOME_MENU.find((item) => item.id === editingSection.category)}
          initialData={getHomeSection(editingSection.category)}
          onSave={handleSaveSection}
        />
      )}
    </div>
  );
}

// Edit Section Modal Component
function EditSectionModal({
  isOpen,
  onClose,
  sectionId,
  sectionMeta,
  initialData,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  sectionId: string;
  sectionMeta?: { id: string; label: string; description: string };
  initialData: { title: string; content: string };
  onSave: (title: string, content: string) => void;
}) {
  const [title, setTitle] = useState(initialData.title);
  const [content, setContent] = useState(initialData.content);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData.title);
      setContent(initialData.content);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.warning('Vui lòng nhập đầy đủ tiêu đề và nội dung');
      return;
    }

    setLoading(true);
    try {
      await onSave(title, content);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={sectionMeta ? `Chỉnh sửa ${sectionMeta.label}` : 'Chỉnh sửa nội dung'}
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Tiêu đề *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          />
        </div>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Nội dung mô tả *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={6}
            placeholder={`Nhập mô tả hiển thị ở mục ${sectionMeta?.label || sectionId}`}
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              resize: 'vertical',
            }}
          />
          <p style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
            Có thể xuống dòng để tách ý. Nội dung sẽ hiển thị trực tiếp trên trang chủ.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Lưu nội dung'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default Home;
