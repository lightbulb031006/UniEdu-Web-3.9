/**
 * Unicorn Edu - Math Tutoring Landing Page
 * Modern, beautiful design for prospective students and parents
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AuthModal from '../components/AuthModal';
import { fetchFeedbacks, fetchAllFeedbacks, createFeedback, updateFeedback, deleteFeedback, StudentFeedback } from '../services/feedbackService';
import { fetchFeaturedMentors, updateFeaturedMentors, FeaturedMentor } from '../services/featuredMentorService';
import { fetchTeachers, Teacher } from '../services/teachersService';

// ========== Course Card Types & Defaults ==========
interface CourseCardTag {
  label: string;
  bg: string;
  color: string;
}

interface CourseCard {
  icon: string;
  title: string;
  description: string;
  tags: CourseCardTag[];
  pricing: string;
  gradient: 'gradient-blue' | 'gradient-purple' | 'gradient-cyan' | 'gradient-orange';
}

interface CourseCardsData {
  toan: CourseCard[];
  tin: CourseCard[];
}

const DEFAULT_COURSE_CARDS: CourseCardsData = {
  toan: [
    {
      icon: '🖥️',
      title: 'Lớp VIP 1-1 TOÁN',
      description: 'Phù hợp mọi trình độ. Lộ trình cá nhân hóa, theo sát tốc độ tiếp thu.',
      tags: [
        { label: '👤 Sĩ số: 1 kèm 1', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
        { label: '⏱️ 2 tiếng/buổi', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
      ],
      pricing: '💬 Nhắn tin Page để trao đổi',
      gradient: 'gradient-blue',
    },
    {
      icon: '⚡',
      title: 'Lớp TOÁN CĂN BẢN',
      description: 'Củng cố nền tảng Đại số & Hình học.\nĐối tượng: Mất gốc, hổng kiến thức.',
      tags: [
        { label: 'Đại số & Hình học', bg: '#EDE9FE', color: '#7C3AED' },
        { label: 'Mất gốc, Hổng KT', bg: '#FEF3C7', color: '#D97706' },
        { label: '👥 3–5 HS', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
        { label: '⏱️ 1h30/buổi', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
      ],
      pricing: '💰 Học phí: 499.000đ/tuần (1 buổi/tuần)',
      gradient: 'gradient-purple',
    },
    {
      icon: '🏆',
      title: 'Lớp TOÁN ÔN THI HSG',
      description: 'Bồi dưỡng tư duy, toán nâng cao chuyên đề.\nĐối tượng: Ôn HSG tỉnh, thi chuyên Toán.',
      tags: [
        { label: 'Nâng cao', bg: '#E0F2FE', color: '#0284C7' },
        { label: 'HSG Tỉnh, Chuyên', bg: '#D1FAE5', color: '#059669' },
        { label: '👥 3–5 HS', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
        { label: '⏱️ 1h30/buổi', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
      ],
      pricing: '💰 Học phí: 699.000đ/tuần (1 buổi/tuần)',
      gradient: 'gradient-cyan',
    },
    {
      icon: '🎯',
      title: 'Lớp TOÁN THỰC CHIẾN (TSA, HSA)',
      description: 'Luyện dạng đặc thù, kỹ thuật Casio giải nhanh.\nĐối tượng: Học sinh thi HSA, TSA.',
      tags: [
        { label: 'TSA, HSA', bg: '#FEE2E2', color: '#DC2626' },
        { label: 'Casio & Giải nhanh', bg: '#FFF7ED', color: '#EA580C' },
        { label: '👥 3–5 HS', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
        { label: '⏱️ 1h30/buổi', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
      ],
      pricing: '💰 Học phí: 499.000đ/tuần (1 buổi/tuần)',
      gradient: 'gradient-orange',
    },
  ],
  tin: [
    {
      icon: '🖥️',
      title: 'Lớp VIP 1-1',
      description: 'Phù hợp mọi trình độ (từ cơ bản đến ôn thi Quốc gia). Lên lộ trình học riêng biệt, dạy theo tốc độ tiếp thu cá nhân.',
      tags: [
        { label: '👤 Sĩ số: 1 kèm 1', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
        { label: '⏱️ 2 tiếng/buổi', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
      ],
      pricing: '💬 Nhắn tin Page để trao đổi',
      gradient: 'gradient-blue',
    },
    {
      icon: '⚡',
      title: 'Lớp BASIC (Cơ bản)',
      description: 'Kiến thức: Level 0 và Level 1.\nĐối tượng: Mới học, mất gốc.',
      tags: [
        { label: 'Level 0, 1', bg: '#EDE9FE', color: '#7C3AED' },
        { label: 'Mới học, Mất gốc', bg: '#FEF3C7', color: '#D97706' },
        { label: '👥 Tối đa 3–7 HS', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
        { label: '⏱️ 1h30/buổi', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
      ],
      pricing: '💰 Học phí (Đợt 4 tuần):\n• 525.000đ (1 buổi/tuần)\n• 1.050.000đ (2 buổi/tuần)',
      gradient: 'gradient-purple',
    },
    {
      icon: '🏆',
      title: 'Lớp ADVANCED (Nâng cao)',
      description: 'Kiến thức: Level 2 và Level 3.\nĐối tượng: Ôn thi HSG Tỉnh, Chuyên Tin.',
      tags: [
        { label: 'Level 2, 3', bg: '#E0F2FE', color: '#0284C7' },
        { label: 'HSG Tỉnh, Chuyên', bg: '#D1FAE5', color: '#059669' },
        { label: '👥 Tối đa 3–7 HS', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
        { label: '⏱️ 1h30/buổi', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
      ],
      pricing: '💰 Học phí (Đợt 4 tuần):\n• 735.000đ (1 buổi/tuần)\n• 1.470.000đ (2 buổi/tuần)',
      gradient: 'gradient-cyan',
    },
    {
      icon: '🎯',
      title: 'Lớp HARDCORE (Chuyên sâu)',
      description: 'Kiến thức: Level 4 và Level 5.\nĐối tượng: Dự thi Đội Tuyển Quốc Gia.',
      tags: [
        { label: 'Level 4, 5', bg: '#FEE2E2', color: '#DC2626' },
        { label: 'Đội Tuyển QG', bg: '#FFF7ED', color: '#EA580C' },
        { label: '👥 Tối đa 3–7 HS', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
        { label: '⏱️ 1h30/buổi', bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' },
      ],
      pricing: '💰 Học phí (Đợt 4 tuần):\n• 840.000đ (1 buổi/tuần)\n• 1.680.000đ (2 buổi/tuần)',
      gradient: 'gradient-orange',
    },
  ],
};

const COURSE_CARDS_STORAGE_KEY = 'unicorns.courseCards';

function loadCourseCards(): CourseCardsData {
  try {
    const saved = localStorage.getItem(COURSE_CARDS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_COURSE_CARDS));
}

interface HomeProps {
  initialAuthMode?: 'login' | 'register';
}

function Home({ initialAuthMode }: HomeProps = {}) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [activeSection, setActiveSection] = useState('intro');
  const [isScrolled, setIsScrolled] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(!!initialAuthMode);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>(initialAuthMode || 'login');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    grade: '',
    goal: ''
  });
  const [heroSlide, setHeroSlide] = useState(0);
  const [courseSubject, setCourseSubject] = useState<'toan' | 'tin'>('toan');

  // Course cards state (admin-editable)
  const [courseCards, setCourseCards] = useState<CourseCardsData>(loadCourseCards);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<'toan' | 'tin'>('toan');
  const [editingIndex, setEditingIndex] = useState(0);
  const [editForm, setEditForm] = useState<CourseCard | null>(null);
  const [newTagLabel, setNewTagLabel] = useState('');

  const isAdmin = isAuthenticated && user?.role === 'admin';

  const openEditModal = (subject: 'toan' | 'tin', index: number) => {
    setEditingSubject(subject);
    setEditingIndex(index);
    setEditForm(JSON.parse(JSON.stringify(courseCards[subject][index])));
    setNewTagLabel('');
    setEditModalOpen(true);
  };

  const saveEditForm = () => {
    if (!editForm) return;
    const updated = { ...courseCards };
    updated[editingSubject] = [...updated[editingSubject]];
    updated[editingSubject][editingIndex] = editForm;
    setCourseCards(updated);
    localStorage.setItem(COURSE_CARDS_STORAGE_KEY, JSON.stringify(updated));
    setEditModalOpen(false);
  };

  const resetAllCards = () => {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_COURSE_CARDS));
    setCourseCards(defaults);
    localStorage.removeItem(COURSE_CARDS_STORAGE_KEY);
    setEditModalOpen(false);
  };

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<StudentFeedback[]>([]);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<StudentFeedback | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    student_name: '', student_class: '', content: '', rating: 5,
    is_active: true, display_order: 0, avatar_color: '#3B82F6',
    role: '', subject: '', highlight_text: '', badge_text: '',
    badge_icon: '', achievement_text: '', is_featured: false,
  });
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Default feedback data matching reference design
  const defaultFeedbacks: StudentFeedback[] = [
    {
      id: 'df1', student_name: 'Minh Anh', student_class: 'Học sinh lớp 10 – Toán',
      content: 'Trước mình học Toán rất yếu, không hiểu bản chất gì cả. Từ khi học với mentor ở Unicorn Edu, mình đã hiểu sâu hơn rất nhiều.',
      rating: 5, is_active: true, display_order: 1, avatar_color: '#3B82F6',
      highlight_text: 'Điểm từ 5.0 lên 8.5 chỉ sau 2 tháng!', badge_text: 'Tiến bộ vượt bậc', badge_icon: '📈',
    },
    {
      id: 'df2', student_name: 'Chị Hường', student_class: 'Phụ huynh – Con lớp 9',
      content: 'Con tôi trước rất sợ Toán, giờ lại thích học. Các mentor rất kiên nhẫn, báo cáo tiến độ hàng tuần rất rõ ràng. Con đã đỗ Chuyên Toán với điểm cao.',
      rating: 5, is_active: true, display_order: 2, avatar_color: '#10B981', is_featured: true,
      highlight_text: 'báo cáo tiến độ hàng tuần rất rõ ràng', badge_text: 'Phụ huynh tin tưởng', badge_icon: '👩‍👧',
      achievement_text: 'Đỗ Chuyên Toán với điểm cao',
    },
    {
      id: 'df3', student_name: 'Khang Nguyễn', student_class: 'Học sinh lớp 11 – Tin học',
      content: 'Mentor dạy thuật toán rất dễ hiểu, từ cơ bản đến nâng cao. Nhờ vậy em đã đạt giải Ba HSG Tin học cấp Thành phố. Lộ trình học rất rõ ràng và khoa học.',
      rating: 5, is_active: true, display_order: 3, avatar_color: '#F59E0B',
      highlight_text: 'đạt giải Ba HSG Tin học cấp Thành phố', badge_text: 'HSG Thành phố', badge_icon: '🏅',
    },
    {
      id: 'df4', student_name: 'Thu Trang', student_class: 'Học sinh lớp 12 – Toán',
      content: 'Em ôn thi Đại học với Unicorn Edu trong 4 tháng. Mentor giải thích rất kỹ, cho nhiều bài luyện đề.',
      rating: 5, is_active: true, display_order: 4, avatar_color: '#EC4899',
      highlight_text: 'Cuối cùng em đạt 9.2 điểm Toán trong kỳ thi tốt nghiệp!', badge_text: 'Thi Đại học', badge_icon: '🎓',
    },
    {
      id: 'df5', student_name: 'Anh Long', student_class: 'Phụ huynh – Con lớp 7',
      content: 'Chất lượng giảng dạy rất tốt, con tiến bộ rõ rệt. Hỗ trợ hướng nghiệp cho các con tiến tới các trường có chất lượng đào tạo tốt.',
      rating: 5, is_active: true, display_order: 5, avatar_color: '#8B5CF6',
      highlight_text: 'con tiến bộ rõ rệt', badge_text: 'Phụ huynh tin tưởng', badge_icon: '👨‍👦',
    },
    {
      id: 'df6', student_name: 'Đức Mạnh', student_class: 'Học sinh lớp 8 – Toán & Tin',
      content: 'Em học cả Toán và Tin ở đây. Hai mentor đều rất giỏi và nhiệt tình.',
      rating: 5, is_active: true, display_order: 6, avatar_color: '#06B6D4',
      highlight_text: 'Từ học sinh trung bình em đã vào top 5 lớp', badge_text: 'Top 5 lớp', badge_icon: '🏆',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide(prev => (prev === 0 ? 1 : 0));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch feedbacks
  useEffect(() => {
    fetchFeedbacks().then(data => {
      if (data.length > 0) setFeedbacks(data);
      else setFeedbacks(defaultFeedbacks);
    }).catch(() => setFeedbacks(defaultFeedbacks));
  }, []);

  const displayFeedbacks = feedbacks.length > 0 ? feedbacks : defaultFeedbacks;

  // Featured mentors state
  const MENTOR_COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#06B6D4', '#8B5CF6'];
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length < 2) return name.charAt(0).toUpperCase();
    return (parts[parts.length - 2].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const defaultMentors: FeaturedMentor[] = [
    { id: 'dm1', teacher_id: '', display_order: 0, custom_title: 'Chuyên gia Hình học, HSG Quốc gia Toán 2020', teacher: { id: '1', full_name: 'Nguyễn Minh Đức', university: 'ĐH Bách Khoa Hà Nội', high_school: 'THPT Chuyên KHTN', specialization: 'Toán Cao Cấp & Hình Học', roles: ['teacher'] } },
    { id: 'dm2', teacher_id: '', display_order: 1, custom_title: 'Top 10 ACM ICPC Asia, chuyên luyện thi HSG Tin', teacher: { id: '2', full_name: 'Lê Hoàng Nam', university: 'ĐH Bách Khoa Hà Nội', high_school: 'THPT Chuyên Vĩnh Phúc', specialization: 'Thuật Toán & CTDL', roles: ['teacher'] } },
    { id: 'dm3', teacher_id: '', display_order: 2, custom_title: 'Giải Nhì HSG Toán Quốc gia, mentor tận tâm', teacher: { id: '3', full_name: 'Trần Thị Mai Anh', university: 'ĐH Bách Khoa Hà Nội', high_school: 'THPT Chuyên HN-Amsterdam', specialization: 'Đại Số & Lý Thuyết Số', roles: ['teacher'] } },
    { id: 'dm4', teacher_id: '', display_order: 3, custom_title: 'Chuyên ôn thi ĐH, tỷ lệ đỗ 98%', teacher: { id: '4', full_name: 'Phạm Thanh Hương', university: 'ĐH Bách Khoa Hà Nội', high_school: 'THPT Chuyên Sư Phạm', specialization: 'Giải Tích & Xác Suất', roles: ['teacher'] } },
  ];

  const [featuredMentors, setFeaturedMentors] = useState<FeaturedMentor[]>(defaultMentors);
  const [mentorModalOpen, setMentorModalOpen] = useState(false);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [mentorSearch, setMentorSearch] = useState('');
  const [mentorSaving, setMentorSaving] = useState(false);

  // Fetch featured mentors from backend API
  useEffect(() => {
    (async () => {
      try {
        const fetchedMentors = await fetchFeaturedMentors();
        if (fetchedMentors && fetchedMentors.length > 0) {
          setFeaturedMentors(fetchedMentors);
        }
      } catch { /* keep defaults or cached */ }
    })();
  }, []);

  const openMentorModal = useCallback(async () => {
    setMentorModalOpen(true);
    setMentorSearch('');
    try {
      const teachers = await fetchTeachers();
      setAllTeachers(teachers.filter(t => t.status !== 'inactive'));
    } catch { setAllTeachers([]); }
    // Pre-select currently featured
    setSelectedTeacherIds(new Set(featuredMentors.map(m => m.teacher_id)));
  }, [featuredMentors]);

  const handleMentorToggle = (teacherId: string) => {
    setSelectedTeacherIds(prev => {
      const next = new Set(prev);
      if (next.has(teacherId)) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
  };

  const handleSaveMentors = async () => {
    setMentorSaving(true);
    try {
      const ids = Array.from(selectedTeacherIds);

      // Call backend to update
      const payload = ids.map((id, index) => ({
        teacher_id: id,
        display_order: index
      }));

      const updatedMentors = await updateFeaturedMentors(payload);
      if (updatedMentors && updatedMentors.length > 0) {
        setFeaturedMentors(updatedMentors);
      }

      // Also sync to localStorage as a fallback 
      localStorage.setItem('featured_mentor_ids', JSON.stringify(ids));
      setMentorModalOpen(false);
    } catch { alert('Lỗi khi lưu!'); }
    setMentorSaving(false);
  };

  const filteredTeachers = allTeachers.filter(t => {
    if (!mentorSearch) return true;
    const s = mentorSearch.toLowerCase();
    return (t.fullName || '').toLowerCase().includes(s)
      || (t.university || '').toLowerCase().includes(s)
      || (t.province || '').toLowerCase().includes(s);
  });

  // Admin feedback handlers
  const loadAllFeedbacks = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const data = await fetchAllFeedbacks();
      setFeedbacks(data.length > 0 ? data : defaultFeedbacks);
    } catch { setFeedbacks(defaultFeedbacks); }
    setFeedbackLoading(false);
  }, []);

  const resetFeedbackForm = () => setFeedbackForm({
    student_name: '', student_class: '', content: '', rating: 5,
    is_active: true, display_order: 0, avatar_color: '#3B82F6',
    role: '', subject: '', highlight_text: '', badge_text: '',
    badge_icon: '', achievement_text: '', is_featured: false,
  });

  const handleFeedbackSave = async () => {
    setFeedbackLoading(true);
    try {
      if (editingFeedback) {
        await updateFeedback(editingFeedback.id, feedbackForm);
      } else {
        await createFeedback(feedbackForm as any);
      }
      await loadAllFeedbacks();
      setEditingFeedback(null);
      resetFeedbackForm();
    } catch (err) { alert('Lỗi khi lưu feedback!'); }
    setFeedbackLoading(false);
  };

  const handleFeedbackDelete = async (id: string) => {
    if (!confirm('Xóa feedback này?')) return;
    try {
      await deleteFeedback(id);
      await loadAllFeedbacks();
    } catch { alert('Lỗi khi xóa!'); }
  };

  const handleEditFeedback = (fb: StudentFeedback) => {
    setEditingFeedback(fb);
    setFeedbackForm({
      student_name: fb.student_name, student_class: fb.student_class || '',
      content: fb.content, rating: fb.rating, is_active: fb.is_active,
      display_order: fb.display_order, avatar_color: fb.avatar_color || '#3B82F6',
      role: fb.role || '', subject: fb.subject || '',
      highlight_text: fb.highlight_text || '', badge_text: fb.badge_text || '',
      badge_icon: fb.badge_icon || '', achievement_text: fb.achievement_text || '',
      is_featured: fb.is_featured || false,
    });
  };

  // Scroll detection for header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(sectionId);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real implementation, this would submit to a backend
    alert(`Cảm ơn ${formData.name}! Chúng tôi sẽ liên hệ với bạn sớm nhất.`);
    setFormData({ name: '', phone: '', grade: '', goal: '' });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleDashboardClick = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      openAuthModal('login');
    }
  };

  return (
    <div className="math-landing">
      {/* Header */}
      <header className={`math-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="header-container">
          <a href="#hero" className="math-logo" onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }}>
            <img src={new URL('../assets/images/logo-unicorn.png', import.meta.url).href} alt="Unicorns Edu" />
            <div className="logo-text">
              <div className="logo-main">Unicorns Edu</div>
            </div>
          </a>

          <nav className="math-nav">
            <button className={`nav-link ${activeSection === 'intro' ? 'active' : ''}`} onClick={() => scrollToSection('intro')}>
              Giới thiệu
            </button>
            <button className={`nav-link ${activeSection === 'courses' ? 'active' : ''}`} onClick={() => scrollToSection('courses')}>
              Khóa học
            </button>
            <button className={`nav-link ${activeSection === 'mentors' ? 'active' : ''}`} onClick={() => scrollToSection('mentors')}>
              Đội ngũ Mentor
            </button>
            <button className={`nav-link ${activeSection === 'benefits' ? 'active' : ''}`} onClick={() => scrollToSection('benefits')}>
              Góc học tập
            </button>
          </nav>

          <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
            {isAuthenticated ? (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  padding: '8px 16px',
                  background: 'var(--gradient-card)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '14px'
                }}>
                  <span style={{ fontWeight: 600 }}>{user?.name || user?.email || 'User'}</span>
                </div>
                <button
                  className="header-cta"
                  onClick={handleDashboardClick}
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  Vào Dashboard
                </button>
              </>
            ) : (
              <>
                <button
                  className="nav-link"
                  onClick={() => openAuthModal('login')}
                  style={{ padding: '8px 16px' }}
                >
                  Đăng nhập
                </button>
                <button
                  className="header-cta"
                  onClick={() => openAuthModal('register')}
                >
                  Đăng ký
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Slider */}
      <section id="hero" className="hero-section" style={{
        position: 'relative',
        overflow: 'hidden',
        background: heroSlide === 0
          ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 30%, #0F172A 60%, #1A1A2E 100%)'
          : 'linear-gradient(135deg, #F5F0FF 0%, #EDE9FE 20%, #E8E4FD 40%, #E0E7FF 60%, #DBEAFE 80%, #EFF6FF 100%)',
        transition: 'background 0.8s ease'
      }}>
        <div style={{
          display: 'flex',
          transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: `translateX(-${heroSlide * 50}%)`,
          width: '200%'
        }}>
          {/* Slide 1: Tin hoc - Dark Coder Theme */}
          <div style={{ width: '50%', flexShrink: 0 }}>
            <div className="hero-container">
              <div className="hero-content">
                <h1 style={{ marginBottom: 'var(--spacing-4)', color: '#4ADE80' }}>
                  Chinh phục Tin học
                  <br />
                  <span style={{
                    fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                    fontSize: '0.55em',
                    color: '#22D3EE',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    letterSpacing: '0.05em'
                  }}>
                    {'<'}<span style={{ color: '#4ADE80' }}>code</span>{'>'} Bứt phá tư duy lập trình {'</'}<span style={{ color: '#4ADE80' }}>code</span>{'>'}
                  </span>
                  <br />
                  <span className="hero-tagline" style={{ color: '#94A3B8' }}>cùng Chuyên Tin</span>
                </h1>
                <div className="hero-subtitle" style={{ marginTop: 'var(--spacing-6)', color: 'rgba(148, 163, 184, 0.9)' }}>
                  <p style={{ marginBottom: 'var(--spacing-3)' }}>
                    <span style={{ color: '#4ADE80' }}>▸</span> Chuyên kèm Tin học 1-1 Online và Nhóm nhỏ (THCS – THPT)
                  </p>
                  <p style={{ marginBottom: 'var(--spacing-3)' }}>
                    <span style={{ color: '#4ADE80' }}>▸</span> Lập trình căn bản – Thuật toán nâng cao – Chinh phục HSG Tin học & CNTT
                  </p>
                  <p>
                    <span style={{ color: '#4ADE80' }}>▸</span> Rèn tư duy giải thuật, hiểu bản chất, không học thuộc code mẫu
                  </p>
                </div>
                <div className="hero-actions">
                  <button className="btn-primary-large" onClick={() => scrollToSection('contact')} style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
                    boxShadow: '0 0 30px rgba(16, 185, 129, 0.4), 0 8px 24px rgba(16, 185, 129, 0.3)',
                    border: '1px solid rgba(74, 222, 128, 0.3)'
                  }}>
                    Đăng ký tư vấn ngay
                  </button>
                  <button className="btn-secondary-large" onClick={() => scrollToSection('mentors')} style={{
                    color: '#4ADE80',
                    borderColor: 'rgba(74, 222, 128, 0.4)',
                    background: 'rgba(74, 222, 128, 0.05)'
                  }}>
                    Tìm hiểu đội ngũ Mentor
                  </button>
                </div>
                <div className="hero-stats">
                  <div className="stat-item" style={{ color: '#94A3B8' }}>
                    <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#4ADE80' }}>
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    <span><strong style={{ color: '#E2E8F0' }}>1-1 & Nhóm nhỏ</strong><br />(Zoom)</span>
                  </div>
                  <div className="stat-item" style={{ color: '#94A3B8' }}>
                    <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#22D3EE' }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span><strong style={{ color: '#E2E8F0' }}>Hỗ trợ 24/24</strong><br />(Giải đáp tức thì)</span>
                  </div>
                  <div className="stat-item" style={{ color: '#94A3B8' }}>
                    <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#A78BFA' }}>
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <polyline points="17 11 19 13 23 9"></polyline>
                    </svg>
                    <span><strong style={{ color: '#E2E8F0' }}>Sinh viên top đầu</strong><br />Bách Khoa & Chuyên Tin</span>
                  </div>
                </div>
              </div>
              <div className="hero-visual" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <svg width="700" height="700" viewBox="0 0 700 700" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: '100%', height: 'auto' }}>
                  <defs>
                    <filter id="neonGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    <filter id="softNeon"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  </defs>
                  <g opacity="0.06" stroke="#4ADE80" strokeWidth="0.5">
                    {[50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650].map(y => (<line key={`mh${y}`} x1="0" y1={y} x2="700" y2={y} />))}
                    {[50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650].map(x => (<line key={`mv${x}`} x1={x} y1="0" x2={x} y2="700" />))}
                  </g>
                  {[80, 180, 320, 480, 580, 650].map((x, i) => (
                    <g key={`bin${i}`} opacity={0.15 + i * 0.03}>
                      <text x={x} y="60" fontFamily="'Fira Code', monospace" fontSize="10" fill="#4ADE80">
                        {['01101', '10011', '11010', '00110', '10101', '01110'][i]}
                        <animate attributeName="y" values="-20;720" dur={`${8 + i * 2}s`} repeatCount="indefinite" />
                      </text>
                      <text x={x} y="160" fontFamily="'Fira Code', monospace" fontSize="10" fill="#22D3EE">
                        {['10010', '01101', '11100', '10001', '01011', '11001'][i]}
                        <animate attributeName="y" values="-120;620" dur={`${10 + i * 1.5}s`} repeatCount="indefinite" />
                      </text>
                    </g>
                  ))}
                  <g transform="translate(350, 320)">
                    <rect x="-130" y="-90" width="260" height="180" rx="12" fill="rgba(74, 222, 128, 0.03)" />
                    <rect x="-120" y="-80" width="240" height="160" rx="10" fill="#1E293B" stroke="#334155" strokeWidth="2" />
                    <rect x="-120" y="-80" width="240" height="28" rx="10" fill="#0F172A" />
                    <rect x="-120" y="-62" width="240" height="10" fill="#0F172A" />
                    <circle cx="-102" cy="-66" r="4" fill="#EF4444" />
                    <circle cx="-88" cy="-66" r="4" fill="#F59E0B" />
                    <circle cx="-74" cy="-66" r="4" fill="#4ADE80" />
                    <text x="-20" y="-62" fontFamily="'Fira Code', monospace" fontSize="9" fill="#64748B" textAnchor="middle">algorithm.py</text>
                    <text x="-105" y="-35" fontFamily="'Fira Code', monospace" fontSize="11" fill="#C084FC" filter="url(#softNeon)">def</text>
                    <text x="-78" y="-35" fontFamily="'Fira Code', monospace" fontSize="11" fill="#4ADE80" filter="url(#softNeon)">solve</text>
                    <text x="-40" y="-35" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8">(n, graph):</text>
                    <text x="-95" y="-16" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8">  dp = [</text>
                    <text x="-42" y="-16" fontFamily="'Fira Code', monospace" fontSize="11" fill="#F59E0B">0</text>
                    <text x="-32" y="-16" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8">] * (n+</text>
                    <text x="17" y="-16" fontFamily="'Fira Code', monospace" fontSize="11" fill="#F59E0B">1</text>
                    <text x="27" y="-16" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8">)</text>
                    <text x="-95" y="3" fontFamily="'Fira Code', monospace" fontSize="11" fill="#C084FC" filter="url(#softNeon)">  for</text>
                    <text x="-67" y="3" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8"> i </text>
                    <text x="-49" y="3" fontFamily="'Fira Code', monospace" fontSize="11" fill="#C084FC">in</text>
                    <text x="-33" y="3" fontFamily="'Fira Code', monospace" fontSize="11" fill="#22D3EE" filter="url(#softNeon)"> range</text>
                    <text x="8" y="3" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8">(n):</text>
                    <text x="-85" y="22" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8">    dp[i] = </text>
                    <text x="-3" y="22" fontFamily="'Fira Code', monospace" fontSize="11" fill="#22D3EE" filter="url(#softNeon)">max</text>
                    <text x="22" y="22" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8">(dp[i-</text>
                    <text x="62" y="22" fontFamily="'Fira Code', monospace" fontSize="11" fill="#F59E0B">1</text>
                    <text x="72" y="22" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8">],..</text>
                    <text x="-95" y="41" fontFamily="'Fira Code', monospace" fontSize="11" fill="#C084FC" filter="url(#softNeon)">  return</text>
                    <text x="-43" y="41" fontFamily="'Fira Code', monospace" fontSize="11" fill="#94A3B8"> dp[n]</text>
                    <rect x="-18" y="50" width="7" height="13" fill="#4ADE80" opacity="0.9"><animate attributeName="opacity" values="0;1;0" dur="1s" repeatCount="indefinite" /></rect>
                    <text x="-112" y="-35" fontFamily="'Fira Code', monospace" fontSize="9" fill="#475569">1</text>
                    <text x="-112" y="-16" fontFamily="'Fira Code', monospace" fontSize="9" fill="#475569">2</text>
                    <text x="-112" y="3" fontFamily="'Fira Code', monospace" fontSize="9" fill="#475569">3</text>
                    <text x="-112" y="22" fontFamily="'Fira Code', monospace" fontSize="9" fill="#475569">4</text>
                    <text x="-112" y="41" fontFamily="'Fira Code', monospace" fontSize="9" fill="#475569">5</text>
                    <text x="-112" y="57" fontFamily="'Fira Code', monospace" fontSize="9" fill="#475569">6</text>
                  </g>
                  <g transform="translate(560, 160)" opacity="0.7">
                    <circle cx="0" cy="0" r="12" fill="none" stroke="#4ADE80" strokeWidth="2" filter="url(#softNeon)" />
                    <circle cx="50" cy="-30" r="10" fill="none" stroke="#22D3EE" strokeWidth="2" filter="url(#softNeon)" />
                    <circle cx="60" cy="30" r="10" fill="none" stroke="#A78BFA" strokeWidth="2" filter="url(#softNeon)" />
                    <circle cx="-10" cy="50" r="10" fill="none" stroke="#4ADE80" strokeWidth="2" filter="url(#softNeon)" />
                    <line x1="10" y1="-5" x2="40" y2="-25" stroke="#4ADE80" strokeWidth="1.5" opacity="0.5" />
                    <line x1="10" y1="5" x2="50" y2="25" stroke="#22D3EE" strokeWidth="1.5" opacity="0.5" />
                    <line x1="-5" y1="10" x2="-8" y2="40" stroke="#A78BFA" strokeWidth="1.5" opacity="0.5" />
                    <text x="15" y="-40" fontFamily="'Fira Code', monospace" fontSize="9" fill="#64748B">Graph Theory</text>
                  </g>
                  <g transform="translate(80, 540)" opacity="0.6">
                    <text fontFamily="'Fira Code', monospace" fontSize="18" fill="#4ADE80" filter="url(#softNeon)">O(n log n)</text>
                    <text y="22" fontFamily="'Fira Code', monospace" fontSize="12" fill="#64748B">Time Complexity</text>
                  </g>
                  <text x="60" y="150" fontFamily="'Fira Code', monospace" fontSize="12" fill="#22D3EE" opacity="0.4">BFS</text>
                  <text x="520" y="500" fontFamily="'Fira Code', monospace" fontSize="12" fill="#4ADE80" opacity="0.4">DFS</text>
                  <text x="100" y="400" fontFamily="'Fira Code', monospace" fontSize="11" fill="#A78BFA" opacity="0.3" transform="rotate(-10 100 400)">Dijkstra</text>
                  <text x="500" y="350" fontFamily="'Fira Code', monospace" fontSize="11" fill="#22D3EE" opacity="0.3" transform="rotate(8 500 350)">Dynamic Programming</text>
                  <text x="400" y="580" fontFamily="'Fira Code', monospace" fontSize="11" fill="#4ADE80" opacity="0.3">Binary Search</text>
                  <g transform="translate(530, 500)" opacity="0.5">
                    {[0, 1, 2, 3, 4].map(i => (
                      <g key={`arr${i}`}>
                        <rect x={i * 28} y="0" width="25" height="25" rx="3" fill="none" stroke="#4ADE80" strokeWidth="1.5" />
                        <text x={i * 28 + 12.5} y="17" fontFamily="'Fira Code', monospace" fontSize="10" fill="#4ADE80" textAnchor="middle">
                          {[3, 7, 1, 9, 2][i]}
                        </text>
                      </g>
                    ))}
                    <text x="0" y="-8" fontFamily="'Fira Code', monospace" fontSize="9" fill="#64748B">Array</text>
                  </g>
                  <circle cx="100" cy="100" r="2" fill="#4ADE80" filter="url(#softNeon)"><animate attributeName="cy" values="100;70;100" dur="3s" repeatCount="indefinite" /></circle>
                  <circle cx="600" cy="200" r="2" fill="#22D3EE" filter="url(#softNeon)"><animate attributeName="cy" values="200;170;200" dur="4s" repeatCount="indefinite" /></circle>
                  <circle cx="300" cy="600" r="2" fill="#A78BFA" filter="url(#softNeon)"><animate attributeName="cy" values="600;570;600" dur="3.5s" repeatCount="indefinite" /></circle>
                  <text x="40" y="300" fontFamily="'Fira Code', monospace" fontSize="40" fill="#1E293B" opacity="0.8">{'{'}</text>
                  <text x="640" y="450" fontFamily="'Fira Code', monospace" fontSize="40" fill="#1E293B" opacity="0.8">{'}'}</text>
                </svg>
              </div>
            </div>
          </div>
          {/* Slide 2: Toan hoc - Original Purple Theme */}
          <div style={{ width: '50%', flexShrink: 0 }}>
            <div className="hero-container">
              <div className="hero-content">
                <h1 style={{ marginBottom: 'var(--spacing-4)', color: '#1E1B4B' }}>
                  Chinh phục Toán học
                  <br />
                  <span className="hero-tagline">÷ – Bứt phá điểm số</span>
                  <br />
                  <span className="hero-tagline">cùng Sinh viên Bách Khoa</span>
                </h1>

                <div className="hero-subtitle" style={{ marginTop: 'var(--spacing-6)', color: '#475569' }}>
                  <p style={{ marginBottom: 'var(--spacing-3)' }}>
                    • Chuyên kèm Toán 1-1 Online và Nhóm nhỏ (THCS – THPT)
                  </p>
                  <p style={{ marginBottom: 'var(--spacing-3)' }}>
                    • Mục tiêu toàn diện: Lấp lỗ hổng kiến thức – Bồi dưỡng HSG – Chinh phục kỳ thi Vào 10, Chuyên & Đại học.
                  </p>
                  <p>
                    • Lộ trình cá nhân hóa, học tư duy, hiểu bản chất, không học vẹt theo dạng bài.
                  </p>
                </div>

                <div className="hero-actions">
                  <button className="btn-primary-large" onClick={() => scrollToSection('contact')}>
                    Đăng ký tư vấn lộ trình
                  </button>
                  <button className="btn-secondary-large" onClick={() => scrollToSection('mentors')}>
                    Tìm hiểu đội ngũ Mentor
                  </button>
                </div>

                <div className="hero-stats">
                  <div className="stat-item">
                    <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span><strong>1-1 & Nhóm nhỏ</strong><br />(Zoom)</span>
                  </div>
                  <div className="stat-item">
                    <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span><strong>Hỗ trợ 24/24</strong><br />(Giải đáp tức thì)</span>
                  </div>
                  <div className="stat-item">
                    <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <polyline points="17 11 19 13 23 9"></polyline>
                    </svg>
                    <span><strong>Sinh viên top đầu</strong><br />Bách Khoa & Chuyên Toán</span>
                  </div>
                </div>
              </div>

              <div className="hero-visual" style={{ position: 'relative', width: '100%', minHeight: '520px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Floating geometric shapes */}
                {/* Triangle */}
                <div style={{
                  position: 'absolute', top: '5%', left: '15%',
                  width: 0, height: 0,
                  borderLeft: '30px solid transparent', borderRight: '30px solid transparent',
                  borderBottom: '52px solid rgba(196, 181, 253, 0.25)',
                  animation: 'float-slow 6s ease-in-out infinite',
                  zIndex: 1
                }} />

                {/* Diamond shape */}
                <div style={{
                  position: 'absolute', bottom: '25%', left: '25%',
                  width: '28px', height: '28px',
                  background: 'rgba(165, 180, 252, 0.15)',
                  border: '1.5px solid rgba(165, 180, 252, 0.3)',
                  transform: 'rotate(45deg)',
                  borderRadius: '4px',
                  animation: 'float-slow 7s ease-in-out infinite reverse',
                  zIndex: 1
                }} />

                {/* Small floating dots */}
                <div style={{
                  position: 'absolute', top: '30%', left: '8%',
                  width: '8px', height: '8px',
                  borderRadius: '50%',
                  background: 'rgba(96, 165, 250, 0.4)',
                  animation: 'float-slow 4s ease-in-out infinite',
                  zIndex: 1
                }} />
                <div style={{
                  position: 'absolute', bottom: '15%', right: '45%',
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: 'rgba(167, 139, 250, 0.5)',
                  animation: 'float-slow 5s ease-in-out infinite reverse',
                  zIndex: 1
                }} />
                <div style={{
                  position: 'absolute', top: '60%', left: '5%',
                  width: '10px', height: '10px',
                  borderRadius: '50%',
                  background: 'rgba(129, 140, 248, 0.3)',
                  animation: 'float-slow 8s ease-in-out infinite',
                  zIndex: 1
                }} />

                {/* Checkmark icon floating */}
                <div style={{
                  position: 'absolute', top: '45%', right: '15%',
                  width: '28px', height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #60A5FA, #818CF8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'float-slow 5s ease-in-out infinite',
                  zIndex: 1,
                  boxShadow: '0 4px 12px rgba(96, 165, 250, 0.3)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                {/* Floating ∫ symbol */}
                <div style={{
                  position: 'absolute', top: '22%', left: '35%',
                  fontSize: '28px',
                  fontFamily: 'Georgia, serif',
                  fontStyle: 'italic',
                  color: 'rgba(129, 140, 248, 0.5)',
                  animation: 'float-slow 6s ease-in-out infinite reverse',
                  zIndex: 1
                }}>∫</div>

                {/* π Card */}
                <div style={{
                  position: 'absolute', top: '30%', left: '20%',
                  width: '70px', height: '70px',
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
                  animation: 'float-slow 5s ease-in-out infinite',
                  zIndex: 2
                }}>
                  <span style={{ fontSize: '36px', color: 'white', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}>π</span>
                </div>

                {/* Stat Card: 98% */}
                <div style={{
                  position: 'absolute', top: '2%', right: '5%',
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  boxShadow: '0 8px 32px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid rgba(224, 231, 255, 0.6)',
                  zIndex: 3,
                  minWidth: '160px',
                  animation: 'float-slow 7s ease-in-out infinite'
                }}>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>Tỷ lệ đạt mục tiêu</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: '#4F46E5', lineHeight: 1 }}>98%</span>
                    <span style={{
                      fontSize: '11px', color: '#10B981', fontWeight: 600,
                      background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '50px'
                    }}>↑12%</span>
                  </div>
                  {/* Mini chart */}
                  <svg width="120" height="32" viewBox="0 0 120 32" style={{ marginTop: '8px' }}>
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818CF8" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 28 Q10 24 20 22 T40 18 T60 14 T80 8 T100 6 T120 4" fill="none" stroke="#818CF8" strokeWidth="2" />
                    <path d="M0 28 Q10 24 20 22 T40 18 T60 14 T80 8 T100 6 T120 4 V32 H0 Z" fill="url(#chartGrad)" />
                  </svg>
                </div>

                {/* Stat Card: 500+ */}
                <div style={{
                  position: 'absolute', top: '32%', right: '-2%',
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  boxShadow: '0 8px 32px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid rgba(224, 231, 255, 0.6)',
                  zIndex: 3,
                  minWidth: '155px',
                  animation: 'float-slow 8s ease-in-out infinite reverse'
                }}>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>Học sinh tin tưởng</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: '#7C3AED', lineHeight: 1 }}>500+</span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: `linear-gradient(135deg, ${['#818CF8', '#A78BFA', '#C4B5FD'][i - 1]}, ${['#6366F1', '#7C3AED', '#9333EA'][i - 1]})`,
                          border: '2px solid white',
                          marginLeft: i > 1 ? '-8px' : '0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', color: 'white', fontWeight: 700
                        }}>
                          {['👤', '👤', '👤'][i - 1]}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Formula Card */}
                <div style={{
                  position: 'absolute', bottom: '22%', left: '10%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  boxShadow: '0 8px 32px rgba(99, 102, 241, 0.15), 0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid rgba(224, 231, 255, 0.6)',
                  zIndex: 3,
                  animation: 'float-slow 6s ease-in-out infinite'
                }}>
                  <div style={{ fontSize: '10px', color: '#10B981', fontWeight: 600, marginBottom: '4px' }}>✦ Công thức Euler</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', color: '#1E1B4B', fontStyle: 'italic', fontWeight: 600 }}>
                    e<sup>iπ</sup> + 1 = 0
                  </div>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '8px', fontWeight: 500 }}>✦ Gaussian Integral</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: '#4338CA', fontStyle: 'italic', marginTop: '2px' }}>
                    ∫₋∞<sup>∞</sup> e<sup>-x²</sup> dx = √π
                  </div>
                </div>

                {/* Rating Card: 4.9 */}
                <div style={{
                  position: 'absolute', bottom: '10%', right: '5%',
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  boxShadow: '0 8px 32px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid rgba(224, 231, 255, 0.6)',
                  zIndex: 3,
                  minWidth: '155px',
                  animation: 'float-slow 6s ease-in-out infinite reverse'
                }}>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>Đánh giá từ phụ huynh</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: '#7C3AED', lineHeight: 1 }}>4.9</span>
                    <div>
                      <div style={{ color: '#F59E0B', fontSize: '14px', letterSpacing: '2px' }}>★★★★★</div>
                      <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>1000+ đánh giá</div>
                    </div>
                  </div>
                </div>

                {/* Background decorative lines */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 600 520">
                  {/* Subtle grid dots */}
                  {[...Array(8)].map((_, i) =>
                    [...Array(6)].map((_, j) => (
                      <circle key={`dot-${i}-${j}`} cx={60 + i * 70} cy={60 + j * 80} r="1.5" fill="#C4B5FD" opacity="0.2" />
                    ))
                  )}
                  {/* Connecting lines */}
                  <path d="M 200 120 Q 300 80 400 150" fill="none" stroke="#E0E7FF" strokeWidth="1" opacity="0.3" strokeDasharray="4 4" />
                  <path d="M 150 350 Q 300 300 450 380" fill="none" stroke="#DDD6FE" strokeWidth="1" opacity="0.25" strokeDasharray="4 4" />
                  {/* Floating V check */}
                  <g transform="translate(420, 270)" opacity="0.5">
                    <circle r="14" fill="none" stroke="#818CF8" strokeWidth="1.5" />
                    <polyline points="-5,0 -1,5 7,-5" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </svg>

                {/* CSS keyframes for floating animation */}
                <style>{`
                  @keyframes float-slow {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Dots */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '12px',
          zIndex: 10
        }}>
          {['Tin học', 'Toán học'].map((label, i) => (
            <button
              key={label}
              onClick={() => setHeroSlide(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '50px',
                border: heroSlide === i ? 'none' : '1px solid rgba(255,255,255,0.3)',
                background: heroSlide === i
                  ? (i === 0 ? 'linear-gradient(135deg, #10B981, #06B6D4)' : 'linear-gradient(135deg, #7C3AED, #3B82F6)')
                  : 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                color: 'white',
                fontSize: '13px',
                fontWeight: heroSlide === i ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: heroSlide === i ? '0 4px 15px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              <span>{i === 0 ? '💻' : '📐'}</span>
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Introduction - Teams Section with Modern SaaS Design */}
      <section id="intro" className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-24">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-indigo-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-violet-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-300/10 to-blue-300/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }}></div>
        </div>

        <div className="section-container relative z-10">
          {/* Modern Hero Header */}
          <div className="text-center max-w-4xl mx-auto">
            {/* Decorative Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 backdrop-blur-sm mb-6 animate-bounce" style={{ animationDuration: '3s' }}>
              <span className="text-2xl">🦄</span>
              <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Nền Tảng Giáo Dục Đa Ngành
              </span>
            </div>

            {/* Main Title with Gradient */}
            <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Giới thiệu Teams
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Unicorns Edu
              </span>
            </h2>

            {/* Subtitle */}
            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
              Đồng hành cùng bạn trên hành trình học tập với đội ngũ chuyên gia hàng đầu
            </p>
          </div>

          {/* Team Cards Grid - Modern Bento Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            {/* Team Toán học - Blue Theme */}
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-blue-100/50 overflow-hidden">
              {/* Background Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              {/* Icon Container */}
              <div className="relative mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="relative">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors duration-300">
                  Team Toán học
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Phát triển tư duy logic, luyện thi chuyên và thi HSG với lộ trình cá nhân hoá theo năng lực.
                </p>

                {/* CTA Button */}
                <a
                  href="https://www.facebook.com/profile.php?id=61578074894066"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <span>Xem Fanpage</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>

              {/* Decorative Element */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            </div>

            {/* Team Tin học - Indigo/Emerald Theme */}
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-indigo-100/50 overflow-hidden">
              {/* Background Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              {/* Icon Container */}
              <div className="relative mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 shadow-lg group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="relative">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors duration-300">
                  Team Tin học
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Đồng hành trong thuật toán và ứng dụng CNTT với các lớp chuyên sâu & luyện thi.
                </p>

                {/* CTA Button */}
                <a
                  href="https://www.facebook.com/profile.php?id=61577992693085"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 text-white font-semibold shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <span>Xem Fanpage</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>

              {/* Decorative Element */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            </div>

            {/* Team Tiếng Nhật - Rose/Red Theme */}
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-rose-100/50 overflow-hidden">
              {/* Background Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              {/* Icon Container */}
              <div className="relative mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 shadow-lg group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="relative">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-rose-600 transition-colors duration-300">
                  Team Tiếng Nhật
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Đào tạo từ sơ cấp đến JLPT, giao tiếp và hiểu sâu văn hóa Nhật với giáo trình chuẩn bản xứ.
                </p>

                {/* CTA Button */}
                <a
                  href="https://www.facebook.com/unicornstiengnhat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white font-semibold shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <span>Xem Fanpage</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>

              {/* Decorative Element */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            </div>
          </div>

          {/* Modern Contact Footer */}
          <div className="mt-20 relative">
            <div className="bg-white/60 backdrop-blur-lg rounded-3xl p-10 shadow-xl border border-gray-200/50">
              {/* Top Decoration */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-600">Liên hệ ngay</span>
                </div>
              </div>

              {/* Contact Information — Horizontal Layout */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
                {/* Toán Row */}
                <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', border: '1px solid #DDD6FE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px' }}>📐</span>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#7C3AED' }}>Toán học</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hotline</p>
                        <p className="text-sm font-bold text-gray-900">0912 888 908</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                        <p className="text-sm font-bold text-gray-900 break-all">unicornsmath@gmail.com</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tin Row */}
                <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid #BFDBFE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px' }}>💻</span>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#2563EB' }}>Tin học</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hotline</p>
                        <p className="text-sm font-bold text-gray-900">0911 589 217 • 0336 755 856</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                        <p className="text-sm font-bold text-gray-900 break-all">unicornseducvp@gmail.com</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shared Address */}
                <div className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-slate-100 border border-gray-200/60">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Địa chỉ</p>
                    <p className="text-sm font-bold text-gray-900">Đại học Bách Khoa Hà Nội</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subject Toggle Section */}
      <section style={{
        background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
        padding: '64px 0 24px 0',
        textAlign: 'center' as const
      }}>
        <div className="section-container" style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px' }}>
          <h2 style={{
            fontSize: 'clamp(2rem, 4vw, 2.8rem)',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px'
          }}>Khám phá chương trình học</h2>
          <p style={{ color: '#6B7280', fontSize: '16px', marginBottom: '40px' }}>
            Chọn môn học để xem chi tiết khóa học và lộ trình
          </p>

          {/* Toggle Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            maxWidth: '560px',
            margin: '0 auto'
          }}>
            {/* Tin học button */}
            <button
              onClick={() => setCourseSubject('tin')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px',
                padding: '22px 28px',
                borderRadius: '20px',
                border: courseSubject === 'tin' ? 'none' : '2px solid #E2E8F0',
                cursor: 'pointer',
                fontSize: '17px',
                fontWeight: 700,
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                background: courseSubject === 'tin'
                  ? 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)'
                  : 'white',
                color: courseSubject === 'tin' ? 'white' : '#334155',
                boxShadow: courseSubject === 'tin'
                  ? '0 10px 30px rgba(79, 70, 229, 0.35), 0 4px 12px rgba(6, 182, 212, 0.2)'
                  : '0 2px 8px rgba(0,0,0,0.04)',
                transform: courseSubject === 'tin' ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <span style={{
                fontSize: '32px',
                lineHeight: 1,
                filter: courseSubject === 'tin' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none'
              }}>💻</span>
              <div style={{ textAlign: 'left' as const }}>
                <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '2px' }}>Tin học</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  opacity: courseSubject === 'tin' ? 0.9 : 0.6,
                  letterSpacing: '0.01em'
                }}>Lập trình &amp; Thuật toán</div>
              </div>
            </button>

            {/* Toán học button */}
            <button
              onClick={() => setCourseSubject('toan')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px',
                padding: '22px 28px',
                borderRadius: '20px',
                border: courseSubject === 'toan' ? 'none' : '2px solid #E2E8F0',
                cursor: 'pointer',
                fontSize: '17px',
                fontWeight: 700,
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                background: courseSubject === 'toan'
                  ? 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'
                  : 'white',
                color: courseSubject === 'toan' ? 'white' : '#334155',
                boxShadow: courseSubject === 'toan'
                  ? '0 10px 30px rgba(124, 58, 237, 0.35), 0 4px 12px rgba(236, 72, 153, 0.2)'
                  : '0 2px 8px rgba(0,0,0,0.04)',
                transform: courseSubject === 'toan' ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <span style={{
                fontSize: '32px',
                lineHeight: 1,
                filter: courseSubject === 'toan' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none'
              }}>📐</span>
              <div style={{ textAlign: 'left' as const }}>
                <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '2px' }}>Toán học</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  opacity: courseSubject === 'toan' ? 0.9 : 0.6,
                  letterSpacing: '0.01em'
                }}>Tư duy logic &amp; Giải toán</div>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Courses Section - Redesigned */}
      <section id="courses" className="courses-section-redesigned">
        {/* Background Elements */}
        <div className="section-bg-pattern"></div>

        <div className="section-container">
          <div className="section-header" style={{ position: 'relative' }}>
            <h2 className="section-title">Bạn đang cần hỗ trợ <span className="text-highlight">mục tiêu nào?</span></h2>
            <p className="section-subtitle">
              {courseSubject === 'toan'
                ? 'Chọn lớp Toán phù hợp với trình độ và mục tiêu học tập của bạn.'
                : 'Chọn lớp Tin học phù hợp với trình độ và mục tiêu lập trình của bạn.'}
            </p>
            {/* Admin Settings Button */}
            {isAdmin && (
              <button
                onClick={() => openEditModal(courseSubject, 0)}
                title="Chỉnh sửa thẻ khóa học"
                style={{
                  position: 'absolute', top: 0, right: 0,
                  width: '44px', height: '44px', borderRadius: '12px',
                  border: '2px solid #E2E8F0', background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.transform = 'rotate(45deg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
              >
                ⚙️
              </button>
            )}
          </div>

          <div className="courses-grid-redesigned">
            {courseCards[courseSubject].map((card, idx) => (
              <div key={`${courseSubject}-${idx}`} className={`course-card-redesigned ${card.gradient}`} style={{ position: 'relative' }}>
                {/* Admin edit button per card */}
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(courseSubject, idx); }}
                    style={{
                      position: 'absolute', top: '12px', right: '12px', zIndex: 10,
                      width: '32px', height: '32px', borderRadius: '8px',
                      border: '1px solid #E2E8F0', background: 'rgba(255,255,255,0.9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '14px',
                      transition: 'all 0.2s ease',
                    }}
                    title={`Sửa thẻ ${idx + 1}`}
                  >
                    ✏️
                  </button>
                )}
                <div className="course-card-inner">
                  <div className="course-icon-large">{card.icon}</div>
                  <h3><strong>{card.title}</strong></h3>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                    {card.description.replace(/\\n/g, '\n')}
                  </p>
                  <div className="course-features">
                    {card.tags.map((tag, ti) => (
                      <span key={ti} className="feature-tag" style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>
                    ))}
                  </div>
                  {card.pricing && (
                    <div style={{
                      fontSize: '12px', fontWeight: 600, marginTop: '10px', lineHeight: '1.7', whiteSpace: 'pre-line',
                      color: card.gradient === 'gradient-purple' ? '#7C3AED'
                        : card.gradient === 'gradient-cyan' ? '#0891B2'
                          : card.gradient === 'gradient-orange' ? '#EA580C' : '#3B82F6'
                    }}>
                      {card.pricing.includes('Nhắn tin') ? (
                        <span className="feature-tag" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: 'white', border: 'none', marginTop: '8px', display: 'inline-flex' }}>{card.pricing}</span>
                      ) : (
                        card.pricing.replace(/\\n/g, '\n')
                      )}
                    </div>
                  )}
                </div>
                <div className="card-shine"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Edit Modal */}
        {editModalOpen && editForm && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }} onClick={() => setEditModalOpen(false)}>
            <div style={{
              background: 'white', borderRadius: '20px', width: '100%', maxWidth: '600px',
              maxHeight: '85vh', overflow: 'auto', padding: '32px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }} onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>✏️ Chỉnh sửa thẻ khóa học</h3>
                <button onClick={() => setEditModalOpen(false)} style={{
                  width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #E2E8F0',
                  background: 'white', cursor: 'pointer', fontSize: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>

              {/* Card Selector */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {['toan', 'tin'].map((subj) => (
                  <div key={subj} style={{ display: 'flex', gap: '4px' }}>
                    {courseCards[subj as 'toan' | 'tin'].map((c, i) => (
                      <button key={i}
                        onClick={() => openEditModal(subj as 'toan' | 'tin', i)}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.2s',
                          border: editingSubject === subj && editingIndex === i ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                          background: editingSubject === subj && editingIndex === i ? '#EEF2FF' : 'white',
                          color: editingSubject === subj && editingIndex === i ? '#4F46E5' : '#64748B',
                        }}>
                        {subj === 'toan' ? '📐' : '💻'} {i + 1}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Edit Form */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
                {/* Icon */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Icon (emoji)</label>
                  <input value={editForm.icon}
                    onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      border: '1.5px solid #E2E8F0', fontSize: '20px', outline: 'none',
                    }} />
                </div>

                {/* Title */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Tiêu đề</label>
                  <input value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      border: '1.5px solid #E2E8F0', fontSize: '15px', outline: 'none',
                    }} />
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Mô tả</label>
                  <textarea value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none',
                      resize: 'vertical' as const, fontFamily: 'inherit',
                    }} />
                </div>

                {/* Tags */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px', display: 'block' }}>Tags</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {editForm.tags.map((tag, ti) => (
                      <span key={ti} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '16px', fontSize: '13px',
                        background: tag.bg, color: tag.color, fontWeight: 500,
                      }}>
                        {tag.label}
                        <button onClick={() => {
                          const newTags = editForm.tags.filter((_, i) => i !== ti);
                          setEditForm({ ...editForm, tags: newTags });
                        }} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'inherit', fontSize: '14px', padding: 0, lineHeight: 1,
                        }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={newTagLabel}
                      onChange={(e) => setNewTagLabel(e.target.value)}
                      placeholder="Thêm tag mới..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTagLabel.trim()) {
                          e.preventDefault();
                          setEditForm({
                            ...editForm,
                            tags: [...editForm.tags, { label: newTagLabel.trim(), bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' }],
                          });
                          setNewTagLabel('');
                        }
                      }}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: '8px',
                        border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none',
                      }} />
                    <button onClick={() => {
                      if (newTagLabel.trim()) {
                        setEditForm({
                          ...editForm,
                          tags: [...editForm.tags, { label: newTagLabel.trim(), bg: 'rgba(79,70,229,0.08)', color: '#4F46E5' }],
                        });
                        setNewTagLabel('');
                      }
                    }} style={{
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      background: '#4F46E5', color: 'white', fontSize: '13px',
                      fontWeight: 600, cursor: 'pointer',
                    }}>+</button>
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Học phí / Ghi chú</label>
                  <textarea value={editForm.pricing}
                    onChange={(e) => setEditForm({ ...editForm, pricing: e.target.value })}
                    rows={2}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none',
                      resize: 'vertical' as const, fontFamily: 'inherit',
                    }} />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'space-between' }}>
                <button onClick={resetAllCards} style={{
                  padding: '10px 20px', borderRadius: '10px',
                  border: '1.5px solid #FCA5A5', background: '#FFF5F5',
                  color: '#DC2626', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}>🔄 Đặt lại mặc định</button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditModalOpen(false)} style={{
                    padding: '10px 20px', borderRadius: '10px',
                    border: '1.5px solid #E2E8F0', background: 'white',
                    color: '#64748B', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  }}>Hủy</button>
                  <button onClick={saveEditForm} style={{
                    padding: '10px 24px', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                    color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                  }}>💾 Lưu</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Process Section - Redesigned */}
      <section id="process" className="process-section-redesigned">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">📊 Quy trình đào tạo</span>
            <h2 className="section-title">Lộ trình học tập chặt chẽ & Linh hoạt</h2>
            <p className="section-subtitle">
              Quy trình đào tạo 4 bước được cá nhân hóa cho từng học sinh
            </p>
          </div>

          <div className="process-timeline">
            {/* Step 1 */}
            <div className="process-card">
              <div className="process-card-number">01</div>
              <div className="process-card-content">
                <div className="process-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3>Test trình độ đầu vào</h3>
                <p>Đánh giá chính xác năng lực hiện tại trước khi vào học chính thức.</p>
                <div className="process-tags">
                  <span>✓ Đánh giá năng lực</span>
                  <span>✓ Xác định lỗ hổng</span>
                </div>
              </div>
              <div className="process-connector"></div>
            </div>

            {/* Step 2 */}
            <div className="process-card">
              <div className="process-card-number">02</div>
              <div className="process-card-content">
                <div className="process-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3>Xây dựng lộ trình cá nhân hóa</h3>
                <p>Thiết kế kế hoạch học tập riêng biệt dựa trên kết quả test và mục tiêu cụ thể của học sinh.</p>
                <div className="process-tags">
                  <span>✓ Lộ trình riêng</span>
                  <span>✓ Mục tiêu rõ ràng</span>
                </div>
              </div>
              <div className="process-connector"></div>
            </div>

            {/* Step 3 */}
            <div className="process-card">
              <div className="process-card-number">03</div>
              <div className="process-card-content">
                <div className="process-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3>Học tập & Rèn tư duy</h3>
                <p>Gia sư giảng dạy đi từ bản chất, giải thích dễ hiểu. Tránh học vẹt, tập trung rèn tư duy giải toán.</p>
                <div className="process-tags">
                  <span>✓ Hiểu bản chất</span>
                  <span>✓ Tư duy logic</span>
                </div>
              </div>
              <div className="process-connector"></div>
            </div>

            {/* Step 4 */}
            <div className="process-card">
              <div className="process-card-number">04</div>
              <div className="process-card-content">
                <div className="process-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3>Theo dõi & Điều chỉnh</h3>
                <p>Theo dõi tiến độ thường xuyên. Chủ động điều chỉnh lộ trình nếu cần để đảm bảo học đúng trọng tâm.</p>
                <div className="process-tags">
                  <span>✓ Báo cáo tiến độ</span>
                  <span>✓ Linh hoạt điều chỉnh</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mentors Showcase Section */}
      <section id="mentors" className="mentors-section-redesigned">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">👨‍🏫 Đội ngũ giảng viên</span>
            <h2 className="section-title">Gặp gỡ các <span className="text-highlight">Mentor xuất sắc</span></h2>
            <p className="section-subtitle">
              Đội ngũ giảng viên trẻ, tài năng từ Đại học Bách Khoa Hà Nội
            </p>
            {isAuthenticated && user?.role === 'admin' && (
              <button onClick={openMentorModal} className="mentor-settings-btn" title="Chọn mentor hiển thị">
                ⚙️
              </button>
            )}
          </div>

          {/* Mentor Cards Grid */}
          {featuredMentors.length > 0 && (
            <div className="mentor-showcase-grid">
              {featuredMentors.map((fm, idx) => {
                const t = fm.teacher;
                if (!t) return null;
                const color = MENTOR_COLORS[idx % MENTOR_COLORS.length];
                const initials = getInitials(t.full_name || '?');
                return (
                  <div key={fm.id} className="mentor-showcase-card">
                    <div className="msc-avatar-ring" style={{ borderColor: color }}>
                      {t.photo_url
                        ? <img src={t.photo_url} alt={t.full_name} />
                        : <span style={{ color }}>{initials}</span>
                      }
                    </div>
                    <h4 className="mentor-showcase-name">{t.full_name}</h4>
                    {(fm.custom_title || t.specialization) && (() => {
                      const text = fm.custom_title || t.specialization || '';
                      const items = text.split(/\n|\s*-\s+/).filter(s => s.trim().length > 0);
                      return (
                        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', textAlign: 'left', width: '100%' }}>
                          {items.map((item, i) => (
                            <li key={i} style={{ fontSize: '12.5px', color: '#4B5563', lineHeight: 1.5, padding: '2px 0', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              <span style={{ color: '#7C3AED', flexShrink: 0, marginTop: '2px' }}>▸</span>
                              <span>{item.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                    {t.high_school && <p className="msc-detail">🏫 {t.high_school}</p>}
                    {t.university && (
                      <div className="msc-uni-badge" style={{ background: `${color}15`, color, borderColor: `${color}30` }}>
                        🎓 {t.university}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mentor Stats */}
          <div className="mentor-stats-bar">
            <div className="mentor-stat"><div className="stat-number">50+</div><div className="stat-label">MENTOR XUẤT SẮC</div></div>
            <div className="mentor-stat"><div className="stat-number">100+</div><div className="stat-label">HỌC SINH TIN TƯỞNG</div></div>
            <div className="mentor-stat"><div className="stat-number">5.0</div><div className="stat-label">ĐÁNH GIÁ</div></div>
            <div className="mentor-stat"><div className="stat-number">100%</div><div className="stat-label">HÀI LÒNG</div></div>
          </div>
        </div>

        {/* Admin Mentor Selection Modal */}
        {mentorModalOpen && (
          <div className="feedback-modal-overlay" onClick={() => setMentorModalOpen(false)}>
            <div className="feedback-modal" onClick={e => e.stopPropagation()}>
              <div className="feedback-modal-header">
                <h3>Chọn Mentor hiển thị</h3>
                <button onClick={() => setMentorModalOpen(false)} className="feedback-modal-close">✕</button>
              </div>
              <div className="feedback-modal-body">
                {/* Search */}
                <div className="mentor-search-box">
                  <input
                    type="text"
                    placeholder="🔍 Tìm theo tên, trường, tỉnh..."
                    value={mentorSearch}
                    onChange={e => setMentorSearch(e.target.value)}
                    className="mentor-search-input"
                  />
                </div>

                {/* Selected count */}
                <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 12px' }}>
                  Đã chọn: <strong style={{ color: '#7C3AED' }}>{selectedTeacherIds.size}</strong> mentor
                </p>

                {/* Teacher list */}
                <div className="mentor-select-list">
                  {filteredTeachers.map(t => (
                    <div
                      key={t.id}
                      className={`mentor-select-item ${selectedTeacherIds.has(t.id) ? 'selected' : ''}`}
                      onClick={() => handleMentorToggle(t.id)}
                    >
                      <div className="mentor-select-check">
                        {selectedTeacherIds.has(t.id) ? '✅' : '⬜'}
                      </div>
                      <div className="mentor-select-info">
                        <strong>{t.fullName || 'Chưa có tên'}</strong>
                        {t.university && <span className="mentor-select-meta">🎓 {t.university}</span>}
                        {t.province && <span className="mentor-select-meta">📍 {t.province}</span>}
                      </div>
                    </div>
                  ))}
                  {filteredTeachers.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#94A3B8', padding: '20px' }}>Không tìm thấy nhân sự nào</p>
                  )}
                </div>

                {/* Save */}
                <div className="feedback-form-actions" style={{ marginTop: '16px' }}>
                  <button onClick={handleSaveMentors} disabled={mentorSaving}>
                    {mentorSaving ? '⏳ Đang lưu...' : `💾 Lưu (${selectedTeacherIds.size} mentor)`}
                  </button>
                  <button onClick={() => setMentorModalOpen(false)} className="btn-cancel">Hủy</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Student Feedback Section */}
      <section id="feedback" className="feedback-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">⭐ Đánh giá từ học sinh & phụ huynh</span>
            <h2 className="section-title">Học sinh nói gì về <span className="text-highlight">Unicorn Edu</span></h2>
            <p className="section-subtitle">
              Những chia sẻ chân thực từ học sinh và phụ huynh đã tin tưởng Unicorn Edu
            </p>
            {isAuthenticated && user?.role === 'admin' && (
              <button
                onClick={() => { setFeedbackModalOpen(true); loadAllFeedbacks(); }}
                className="feedback-admin-btn"
              >
                ✏️ Quản lý Feedback
              </button>
            )}
          </div>

          {/* Stats Bar */}
          <div className="fb-stats-bar">
            <div className="fb-stat">
              <span className="fb-stat-icon">⭐</span>
              <div>
                <div className="fb-stat-number">4.9 / 5.0</div>
                <div className="fb-stat-label">Đánh giá trung bình</div>
              </div>
            </div>
            <div className="fb-stat">
              <span className="fb-stat-icon">👥</span>
              <div>
                <div className="fb-stat-number">100+</div>
                <div className="fb-stat-label">Học viên hài lòng</div>
              </div>
            </div>
            <div className="fb-stat">
              <span className="fb-stat-icon">💬</span>
              <div>
                <div className="fb-stat-number">98%</div>
                <div className="fb-stat-label">Tỷ lệ giới thiệu bạn bè</div>
              </div>
            </div>
          </div>

          {/* Masonry Grid */}
          <div className="fb-masonry">
            {displayFeedbacks.map((fb) => (
              <div key={fb.id} className={`fb-card ${fb.is_featured ? 'fb-card-featured' : ''}`}>
                {/* Quote icon */}
                <div className="fb-quote">“</div>

                {/* Featured badge */}
                {fb.is_featured && (
                  <div className="fb-featured-badge">⭐ Phản hồi nổi bật</div>
                )}

                {/* Header: avatar + info */}
                <div className="fb-card-header">
                  <div className="fb-avatar" style={{ background: fb.avatar_color || '#3B82F6' }}>
                    {fb.avatar_url
                      ? <img src={fb.avatar_url} alt={fb.student_name} />
                      : <span>{fb.student_name.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="fb-name-info">
                    <h4>{fb.student_name}</h4>
                    {fb.student_class && <p>{fb.student_class}</p>}
                  </div>
                </div>

                {/* Stars */}
                <div className="fb-stars">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={s <= fb.rating ? 'star-filled' : 'star-empty'}>★</span>
                  ))}
                </div>

                {/* Content */}
                <p className="fb-text">
                  {fb.highlight_text ? (
                    <>
                      {fb.content.split(fb.highlight_text)[0]}
                      <strong className="fb-highlight">{fb.highlight_text}</strong>
                      {fb.content.split(fb.highlight_text).slice(1).join(fb.highlight_text)}
                    </>
                  ) : fb.content}
                </p>

                {/* Achievement */}
                {fb.achievement_text && (
                  <div className="fb-achievement">
                    <div className="fb-achievement-label">🏆 KẾ́T QUẢ ĐẠT ĐƯỢC</div>
                    <div className="fb-achievement-text">{fb.achievement_text}</div>
                  </div>
                )}

                {/* Footer: badge + time */}
                <div className="fb-card-footer">
                  {fb.badge_text && (
                    <span className="fb-badge">
                      {fb.badge_icon && <span>{fb.badge_icon}</span>} {fb.badge_text}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Feedback Modal */}
        {feedbackModalOpen && (
          <div className="feedback-modal-overlay" onClick={() => setFeedbackModalOpen(false)}>
            <div className="feedback-modal" onClick={e => e.stopPropagation()}>
              <div className="feedback-modal-header">
                <h3>Quản lý Feedback học sinh</h3>
                <button onClick={() => setFeedbackModalOpen(false)} className="feedback-modal-close">✕</button>
              </div>

              <div className="feedback-modal-body">
                {/* Form */}
                <div className="feedback-form">
                  <h4>{editingFeedback ? '✏️ Chỉnh sửa' : '➕ Thêm mới'}</h4>
                  <div className="feedback-form-grid">
                    <div className="feedback-form-row-2col">
                      <input placeholder="Tên học sinh / phụ huynh *" value={feedbackForm.student_name}
                        onChange={e => setFeedbackForm(p => ({ ...p, student_name: e.target.value }))} />
                      <input placeholder="VD: Học sinh lớp 10 – Toán" value={feedbackForm.student_class}
                        onChange={e => setFeedbackForm(p => ({ ...p, student_class: e.target.value }))} />
                    </div>
                    <textarea placeholder="Nội dung feedback *" value={feedbackForm.content}
                      onChange={e => setFeedbackForm(p => ({ ...p, content: e.target.value }))} rows={3} />
                    <div className="feedback-form-row-2col">
                      <input placeholder="Highlight text (in đậm)" value={feedbackForm.highlight_text}
                        onChange={e => setFeedbackForm(p => ({ ...p, highlight_text: e.target.value }))} />
                      <input placeholder="Kết quả đạt được" value={feedbackForm.achievement_text}
                        onChange={e => setFeedbackForm(p => ({ ...p, achievement_text: e.target.value }))} />
                    </div>
                    <div className="feedback-form-row-2col">
                      <input placeholder="Badge (VD: HSG Thành phố)" value={feedbackForm.badge_text}
                        onChange={e => setFeedbackForm(p => ({ ...p, badge_text: e.target.value }))} />
                      <input placeholder="Badge icon (VD: 🏅)" value={feedbackForm.badge_icon}
                        onChange={e => setFeedbackForm(p => ({ ...p, badge_icon: e.target.value }))} />
                    </div>
                    <div className="feedback-form-row">
                      <label>Màu avatar:
                        <input type="color" value={feedbackForm.avatar_color}
                          onChange={e => setFeedbackForm(p => ({ ...p, avatar_color: e.target.value }))} />
                      </label>
                      <label>Rating:
                        <select value={feedbackForm.rating}
                          onChange={e => setFeedbackForm(p => ({ ...p, rating: Number(e.target.value) }))}>
                          {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} ⭐</option>)}
                        </select>
                      </label>
                      <label>Thứ tự:
                        <input type="number" value={feedbackForm.display_order} style={{ width: '60px' }}
                          onChange={e => setFeedbackForm(p => ({ ...p, display_order: Number(e.target.value) }))} />
                      </label>
                      <label className="feedback-checkbox">
                        <input type="checkbox" checked={feedbackForm.is_active}
                          onChange={e => setFeedbackForm(p => ({ ...p, is_active: e.target.checked }))} />
                        Hiển thị
                      </label>
                      <label className="feedback-checkbox">
                        <input type="checkbox" checked={feedbackForm.is_featured}
                          onChange={e => setFeedbackForm(p => ({ ...p, is_featured: e.target.checked }))} />
                        Nổi bật
                      </label>
                    </div>
                  </div>
                  <div className="feedback-form-actions">
                    <button onClick={handleFeedbackSave} disabled={feedbackLoading || !feedbackForm.student_name || !feedbackForm.content}>
                      {feedbackLoading ? '⏳ Đang lưu...' : editingFeedback ? '💾 Cập nhật' : '➕ Thêm'}
                    </button>
                    {editingFeedback && (
                      <button onClick={() => { setEditingFeedback(null); resetFeedbackForm(); }} className="btn-cancel">Hủy</button>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className="feedback-list">
                  <h4>📋 Danh sách ({feedbacks.length})</h4>
                  {feedbacks.map(fb => (
                    <div key={fb.id} className={`feedback-list-item ${!fb.is_active ? 'inactive' : ''}`}>
                      <div className="feedback-list-info">
                        <strong>{fb.student_name}</strong>
                        <span className="feedback-list-class">{fb.student_class}</span>
                        <p>{fb.content.substring(0, 80)}...</p>
                        <small>
                          {'⭐'.repeat(fb.rating)} • #{fb.display_order}
                          {fb.is_featured && ' • 🌟 Nổi bật'}
                          {!fb.is_active && ' • 🔴 Ẩn'}
                        </small>
                      </div>
                      <div className="feedback-list-actions">
                        <button onClick={() => handleEditFeedback(fb)} title="Sửa">✏️</button>
                        <button onClick={() => handleFeedbackDelete(fb.id)} title="Xóa">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <div className="contact-container">
          <h2>Giúp con nắm chắc kiến thức<br />Tự tin làm bài ngay hôm nay</h2>
          <p style={{ fontSize: '16px', marginBottom: 'var(--spacing-8)' }}>
            Đăng ký ngay để nhận tư vấn lộ trình học tập phù hợp
          </p>

          <form className="contact-form" onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <input
                type="text"
                name="name"
                className="form-input"
                placeholder="Tên phụ huynh/học sinh"
                value={formData.name}
                onChange={handleFormChange}
                required
              />
              <input
                type="tel"
                name="phone"
                className="form-input"
                placeholder="Số điện thoại"
                value={formData.phone}
                onChange={handleFormChange}
                required
              />
              <input
                type="text"
                name="grade"
                className="form-input form-input-full"
                placeholder="Lớp hiện tại (VD: Lớp 9)"
                value={formData.grade}
                onChange={handleFormChange}
                required
              />
              <input
                type="text"
                name="goal"
                className="form-input form-input-full"
                placeholder="Mục tiêu (VD: Ôn thi vào 10 Chuyên)"
                value={formData.goal}
                onChange={handleFormChange}
                required
              />
            </div>
            <button type="submit" className="submit-btn">
              Nhận tư vấn lộ trình
            </button>
          </form>

          <div style={{ marginTop: 'var(--spacing-12)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', alignItems: 'center' }}>
            {/* Toán row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: '16px' }}>📐</span>
              <span style={{ fontWeight: 700 }}>Toán:</span>
              <span>📞 0912 888 908</span>
              <span style={{ margin: '0 4px' }}>•</span>
              <span>📧 unicornsmath@gmail.com</span>
            </div>
            {/* Tin row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: '16px' }}>💻</span>
              <span style={{ fontWeight: 700 }}>Tin:</span>
              <span>📞 0911 589 217 • 0336 755 856</span>
              <span style={{ margin: '0 4px' }}>•</span>
              <span>📧 unicornseducvp@gmail.com</span>
            </div>
            {/* Fanpage links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
              <a href="https://www.facebook.com/profile.php?id=61578074894066" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', color: 'white', textDecoration: 'none', opacity: 0.95, transition: 'opacity 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.95'}
              >
                <span style={{ fontSize: '20px' }}>🌐</span>
                <span>Fanpage: Unicorn Edu - Học Toán Cùng Huster</span>
              </a>
              <a href="https://www.facebook.com/hoctincungchuyentin" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', color: 'white', textDecoration: 'none', opacity: 0.95, transition: 'opacity 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.95'}
              >
                <span style={{ fontSize: '20px' }}>🌐</span>
                <span>Fanpage: Học Tin Cùng Chuyên Tin</span>
              </a>
            </div>
          </div>
        </div>
      </section >

      {/* Footer */}
      < footer className="math-footer" >
        <div className="footer-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <h3>Unicorn Edu</h3>
              <p>
                Nền tảng giáo dục toán học chất lượng cao, kết nối học sinh với các mentor xuất sắc
                từ Đại học Bách Khoa Hà Nội.
              </p>
            </div>

            <div className="footer-section">
              <h4>Liên kết</h4>
              <div className="footer-links">
                <a href="#intro" className="footer-link" onClick={(e) => { e.preventDefault(); scrollToSection('intro'); }}>
                  Giới thiệu
                </a>
                <a href="#courses" className="footer-link" onClick={(e) => { e.preventDefault(); scrollToSection('courses'); }}>
                  Khóa học
                </a>
                <a href="#mentors" className="footer-link" onClick={(e) => { e.preventDefault(); scrollToSection('mentors'); }}>
                  Đội ngũ Mentor
                </a>
                <a href="#contact" className="footer-link" onClick={(e) => { e.preventDefault(); scrollToSection('contact'); }}>
                  Liên hệ
                </a>
              </div>
            </div>

            <div className="footer-section">
              <h4>Liên hệ</h4>
              <div className="footer-links">
                <span style={{ color: '#D8B4FE', fontSize: '13px', fontWeight: 600 }}>📐 Toán học</span>
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>📞 0912 888 908</span>
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>📧 unicornsmath@gmail.com</span>
                <span style={{ color: '#93C5FD', fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>💻 Tin học</span>
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>📞 0911 589 217 • 0336 755 856</span>
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>📧 unicornseducvp@gmail.com</span>
                <span style={{ color: '#9CA3AF', fontSize: '14px', marginTop: '4px' }}>📍 Đại học Bách Khoa Hà Nội</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            © 2026 Unicorns Edu Math. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)
        }
        mode={authModalMode}
        onModeChange={(mode) => setAuthModalMode(mode)}
      />
    </div>
  );
}

export default Home;
