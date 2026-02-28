/**
 * Unicorn Edu - Math Tutoring Landing Page
 * Modern, beautiful design for prospective students and parents
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AuthModal from '../components/AuthModal';

function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [activeSection, setActiveSection] = useState('intro');
  const [isScrolled, setIsScrolled] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    grade: '',
    goal: ''
  });

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
            <div className="logo-icon">🦄</div>
            <div className="logo-text">
              <div className="logo-main">Unicorn Edu</div>
              <div className="logo-sub">Học Toán cùng Huster</div>
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

      {/* Hero Section */}
      <section id="hero" className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 style={{ marginBottom: 'var(--spacing-4)' }}>
              Chinh phục Toán học
              <br />
              <span className="hero-tagline">÷ – Bứt phá điểm số</span>
              <br />
              <span className="hero-tagline">cùng Sinh viên Bách Khoa</span>
            </h1>

            <div className="hero-subtitle" style={{ marginTop: 'var(--spacing-6)' }}>
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

          <div className="hero-visual" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <svg width="700" height="700" viewBox="0 0 700 700" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: '100%', height: 'auto' }}>
              <defs>
                <linearGradient id="purpleBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9333EA" stopOpacity="1" />
                  <stop offset="50%" stopColor="#7C3AED" stopOpacity="1" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity="1" />
                  <stop offset="100%" stopColor="#67E8F9" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="energyBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F0ABFC" stopOpacity="0" />
                  <stop offset="50%" stopColor="#A78BFA" stopOpacity="1" />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="glowingCore">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#C4B5FD" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#9333EA" stopOpacity="0" />
                </radialGradient>
                <filter id="softGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Technical Grid Background */}
              <g opacity="0.12" stroke="#E0E7FF" strokeWidth="0.5">
                <line x1="0" y1="50" x2="700" y2="50" />
                <line x1="0" y1="100" x2="700" y2="100" />
                <line x1="0" y1="150" x2="700" y2="150" />
                <line x1="0" y1="200" x2="700" y2="200" />
                <line x1="0" y1="250" x2="700" y2="250" />
                <line x1="0" y1="300" x2="700" y2="300" />
                <line x1="0" y1="350" x2="700" y2="350" />
                <line x1="0" y1="400" x2="700" y2="400" />
                <line x1="0" y1="450" x2="700" y2="450" />
                <line x1="0" y1="500" x2="700" y2="500" />
                <line x1="0" y1="550" x2="700" y2="550" />
                <line x1="0" y1="600" x2="700" y2="600" />
                <line x1="0" y1="650" x2="700" y2="650" />
                <line x1="50" y1="0" x2="50" y2="700" />
                <line x1="100" y1="0" x2="100" y2="700" />
                <line x1="150" y1="0" x2="150" y2="700" />
                <line x1="200" y1="0" x2="200" y2="700" />
                <line x1="250" y1="0" x2="250" y2="700" />
                <line x1="300" y1="0" x2="300" y2="700" />
                <line x1="350" y1="0" x2="350" y2="700" />
                <line x1="400" y1="0" x2="400" y2="700" />
                <line x1="450" y1="0" x2="450" y2="700" />
                <line x1="500" y1="0" x2="500" y2="700" />
                <line x1="550" y1="0" x2="550" y2="700" />
                <line x1="600" y1="0" x2="600" y2="700" />
                <line x1="650" y1="0" x2="650" y2="700" />
              </g>

              {/* Fibonacci Spiral */}
              <path d="M 100 100 Q 100 50, 150 50 Q 200 50, 200 100 Q 200 180, 120 180" fill="none" stroke="#C4B5FD" strokeWidth="1.5" opacity="0.3" />

              {/* Large geometric circles in background */}
              <circle cx="150" cy="150" r="120" fill="none" stroke="#E0E7FF" strokeWidth="1" opacity="0.2" />
              <circle cx="550" cy="550" r="100" fill="none" stroke="#DDD6FE" strokeWidth="1" opacity="0.2" />

              {/* Central 3D Energy Cube */}
              <g transform="translate(350, 350)">
                {/* Glowing core */}
                <circle cx="0" cy="0" r="80" fill="url(#glowingCore)" opacity="0.6">
                  <animate attributeName="r" values="80;90;80" dur="3s" repeatCount="indefinite" />
                </circle>

                {/* 3D Cube structure */}
                <path d="M -80 -40 L 0 -80 L 80 -40 L 0 0 Z" fill="none" stroke="#A78BFA" strokeWidth="2.5" opacity="0.7" filter="url(#softGlow)" />
                <path d="M -80 -40 L -80 40 L 0 80 L 0 0 Z" fill="none" stroke="#818CF8" strokeWidth="2.5" opacity="0.7" filter="url(#softGlow)" />
                <path d="M 80 -40 L 80 40 L 0 80 L 0 0 Z" fill="none" stroke="#60A5FA" strokeWidth="2.5" opacity="0.7" filter="url(#softGlow)" />

                {/* Energy beams */}
                <line x1="-80" y1="-40" x2="80" y2="40" stroke="url(#energyBeam)" strokeWidth="1.5" opacity="0.6">
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
                </line>
                <line x1="80" y1="-40" x2="-80" y2="40" stroke="url(#energyBeam)" strokeWidth="1.5" opacity="0.6">
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
                </line>

                {/* Math symbols */}
                <text x="-25" y="-10" fontFamily="Georgia, serif" fontSize="24" fill="#A78BFA" fontStyle="italic">∫</text>
                <text x="10" y="15" fontFamily="Arial, sans-serif" fontSize="20" fill="#818CF8">Σ</text>
                <text x="-30" y="25" fontFamily="Arial, sans-serif" fontSize="18" fill="#60A5FA">f(x)</text>

                {/* Shapes */}
                <path d="M -15 -25 L 0 -35 L 15 -25 L 0 -15 Z" fill="none" stroke="#C4B5FD" strokeWidth="1.5" />
                <circle cx="20" cy="-5" r="8" fill="none" stroke="#DDD6FE" strokeWidth="1.5" />

                {/* Rotating frame */}
                <g opacity="0.8">
                  <path d="M -100 -50 L -20 -90 M 100 -50 L 20 -90 M -100 50 L -20 90 M 100 50 L 20 90"
                    stroke="url(#cyanGlow)" strokeWidth="2" strokeLinecap="round" filter="url(#softGlow)">
                    <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
                  </path>
                  <animateTransform attributeName="transform" type="rotate" values="0 0 0; 360 0 0" dur="30s" repeatCount="indefinite" />
                </g>
              </g>

              {/* Energy particles */}
              <circle cx="100" cy="100" r="2" fill="#A78BFA" opacity="0.7"><animate attributeName="cy" values="100;80;100" dur="2s" repeatCount="indefinite" /></circle>
              <circle cx="140" cy="300" r="2" fill="#A78BFA" opacity="0.7"><animate attributeName="cy" values="300;280;300" dur="3s" repeatCount="indefinite" /></circle>
              <circle cx="180" cy="500" r="2" fill="#A78BFA" opacity="0.7"><animate attributeName="cy" values="500;480;500" dur="2s" repeatCount="indefinite" /></circle>
              <circle cx="220" cy="100" r="2" fill="#A78BFA" opacity="0.7"><animate attributeName="cy" values="100;80;100" dur="3s" repeatCount="indefinite" /></circle>
              <circle cx="260" cy="300" r="2" fill="#A78BFA" opacity="0.7"><animate attributeName="cy" values="300;280;300" dur="2s" repeatCount="indefinite" /></circle>
              <circle cx="300" cy="500" r="2" fill="#A78BFA" opacity="0.7"><animate attributeName="cy" values="500;480;500" dur="3s" repeatCount="indefinite" /></circle>
              <circle cx="340" cy="100" r="2" fill="#A78BFA" opacity="0.7"><animate attributeName="cy" values="100;80;100" dur="2s" repeatCount="indefinite" /></circle>
              <circle cx="380" cy="300" r="2" fill="#A78BFA" opacity="0.7"><animate attributeName="cy" values="300;280;300" dur="3s" repeatCount="indefinite" /></circle>

              {/* Formulas */}
              <text x="50" y="120" fontFamily="Georgia, serif" fontSize="16" fill="#A78BFA" opacity="0.8" fontStyle="italic">eⁱᵖⁱ + 1 = 0</text>
              <text x="520" y="150" fontFamily="Georgia, serif" fontSize="14" fill="#818CF8" opacity="0.7">∮ E·dl = -dΦ/dt</text>
              <text x="80" y="580" fontFamily="Georgia, serif" fontSize="15" fill="#60A5FA" opacity="0.8">∫₋∞^∞ e⁻ˣ² dx = √π</text>
              <text x="480" y="600" fontFamily="Arial, sans-serif" fontSize="13" fill="#A78BFA" opacity="0.7">lim(x→∞) (1+1/x)ˣ = e</text>
              <text x="30" y="350" fontFamily="Georgia, serif" fontSize="14" fill="#C4B5FD" opacity="0.7" transform="rotate(-15 30 350)">∇²φ = ρ/ε₀</text>
              <text x="580" y="380" fontFamily="Arial, sans-serif" fontSize="13" fill="#818CF8" opacity="0.6" transform="rotate(12 580 380)">Σ(n=1→∞) 1/n² = π²/6</text>

              {/* Greek */}
              <text x="120" y="200" fontFamily="Arial, sans-serif" fontSize="22" fill="#DDD6FE" opacity="0.5">α</text>
              <text x="560" y="280" fontFamily="Arial, sans-serif" fontSize="20" fill="#C4B5FD" opacity="0.5">β</text>
              <text x="180" y="520" fontFamily="Arial, sans-serif" fontSize="24" fill="#A78BFA" opacity="0.5">θ</text>
              <text x="520" y="480" fontFamily="Arial, sans-serif" fontSize="18" fill="#818CF8" opacity="0.5">λ</text>

              {/* Tools */}
              <g transform="translate(580, 120)" opacity="0.7">
                <rect x="0" y="0" width="60" height="80" rx="4" fill="none" stroke="#818CF8" strokeWidth="2" />
                <line x1="5" y1="20" x2="55" y2="20" stroke="#60A5FA" strokeWidth="1.5" />
                <line x1="5" y1="35" x2="55" y2="35" stroke="#60A5FA" strokeWidth="1.5" />
                <line x1="5" y1="50" x2="55" y2="50" stroke="#60A5FA" strokeWidth="1.5" />
                <line x1="5" y1="65" x2="55" y2="65" stroke="#60A5FA" strokeWidth="1.5" />
                <circle cx="20" cy="20" r="3" fill="#A78BFA" />
                <circle cx="35" cy="35" r="3" fill="#A78BFA" />
              </g>

              <g transform="translate(60, 520)" opacity="0.7">
                <line x1="20" y1="10" x2="20" y2="50" stroke="#818CF8" strokeWidth="2.5" />
                <line x1="20" y1="10" x2="35" y2="45" stroke="#60A5FA" strokeWidth="2.5" />
                <circle cx="20" cy="10" r="3" fill="#A78BFA" />
                <circle cx="35" cy="45" r="2" fill="#60A5FA" />
              </g>

              <g transform="translate(550, 520)" opacity="0.6">
                <rect x="0" y="0" width="100" height="15" fill="none" stroke="#818CF8" strokeWidth="1.5" />
                <line x1="0" y1="0" x2="0" y2="10" stroke="#60A5FA" strokeWidth="1" />
                <line x1="10" y1="0" x2="10" y2="6" stroke="#60A5FA" strokeWidth="1" />
                <line x1="20" y1="0" x2="20" y2="6" stroke="#60A5FA" strokeWidth="1" />
                <line x1="30" y1="0" x2="30" y2="6" stroke="#60A5FA" strokeWidth="1" />
                <line x1="40" y1="0" x2="40" y2="6" stroke="#60A5FA" strokeWidth="1" />
                <line x1="50" y1="0" x2="50" y2="10" stroke="#60A5FA" strokeWidth="1" />
                <line x1="60" y1="0" x2="60" y2="6" stroke="#60A5FA" strokeWidth="1" />
                <line x1="70" y1="0" x2="70" y2="6" stroke="#60A5FA" strokeWidth="1" />
                <line x1="80" y1="0" x2="80" y2="6" stroke="#60A5FA" strokeWidth="1" />
                <line x1="90" y1="0" x2="90" y2="6" stroke="#60A5FA" strokeWidth="1" />
                <line x1="100" y1="0" x2="100" y2="10" stroke="#60A5FA" strokeWidth="1" />
              </g>

              {/* Decorative */}
              <path d="M 150 50 L 165 65 L 150 80" fill="none" stroke="#C4B5FD" strokeWidth="1.5" opacity="0.4" />
              <path d="M 550 50 L 535 65 L 550 80" fill="none" stroke="#DDD6FE" strokeWidth="1.5" opacity="0.4" />

              {/* Stars */}
              <g transform="translate(150, 80)" opacity="0.6">
                <path d="M 0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z" fill="#E0E7FF">
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
                </path>
              </g>
              <g transform="translate(210, 230)" opacity="0.6">
                <path d="M 0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z" fill="#E0E7FF">
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
                </path>
              </g>
              <g transform="translate(270, 380)" opacity="0.6">
                <path d="M 0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z" fill="#E0E7FF">
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="4s" repeatCount="indefinite" />
                </path>
              </g>
              <g transform="translate(330, 530)" opacity="0.6">
                <path d="M 0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z" fill="#E0E7FF">
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
                </path>
              </g>
            </svg>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16" style={{ maxWidth: '900px', margin: '64px auto 0' }}>
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

              {/* Contact Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Phone */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-lg transition-shadow duration-300">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Hotline</p>
                    <p className="text-base font-bold text-gray-900">0912888908</p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 hover:shadow-lg transition-shadow duration-300">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</p>
                    <p className="text-sm font-bold text-gray-900 break-all">unicornsmath@gmail.com</p>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 hover:shadow-lg transition-shadow duration-300">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Địa chỉ</p>
                    <p className="text-sm font-bold text-gray-900">Đại học Bách Khoa Hà Nội</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Courses Section - Redesigned */}
      <section id="courses" className="courses-section-redesigned">
        {/* Background Elements */}
        <div className="section-bg-pattern"></div>

        <div className="section-container">
          <div className="section-header">
            {/* <span className="section-badge">🎯 Mục tiêu của bạn</span> */}
            <h2 className="section-title">Bạn đang cần hỗ trợ <span className="text-highlight">mục tiêu nào?</span></h2>
            <p className="section-subtitle">
              Lựa chọn khóa học phù hợp với nhu cầu và định hướng học tập để bắt đầu hành trình của riêng bạn.
            </p>
          </div>

          <div className="courses-grid-redesigned">
            {/* Card 1 */}
            <div className="course-card-redesigned gradient-blue">
              <div className="course-card-inner">
                <div className="course-icon-large">📚</div>
                <h3>Củng cố & Lấy lại gốc</h3>
                <p>
                  Dành cho học sinh mất căn bản, muốn cải thiện điểm số trên lớp.
                  Học từ bản chất, lấp lỗ hổng kiến thức nhanh chóng.
                </p>
                <div className="course-features">
                  <span className="feature-tag">✓ Học từ căn bản</span>
                  <span className="feature-tag">✓ Lấp lỗ hổng nhanh</span>
                </div>
              </div>
              <div className="card-shine"></div>
            </div>

            {/* Card 2 */}
            <div className="course-card-redesigned gradient-purple">
              <div className="course-card-inner">
                <div className="course-icon-large">🎯</div>
                <h3>Ôn thi Chuyển cấp</h3>
                <p>
                  Luyện đề chuyên sâu, rèn kỹ năng làm bài thi vào 10 và các trường Chuyên.
                  Chiến thuật làm bài thông minh, tối ưu điểm số.
                </p>
                <div className="course-features">
                  <span className="feature-tag">✓ Vào 10 Chuyên</span>
                  <span className="feature-tag">✓ Chiến thuật thi</span>
                </div>
              </div>
              <div className="card-shine"></div>
            </div>

            {/* Card 3 */}
            <div className="course-card-redesigned gradient-cyan">
              <div className="course-card-inner">
                <div className="course-icon-large">🎓</div>
                <h3>Luyện thi Tốt nghiệp & ĐH</h3>
                <p>
                  Tổng ôn kiến thức THPT. Rèn tư duy giải toán trắc nghiệm,
                  luyện đề thực chiến cho kỳ thi Tốt nghiệp, HSA, TSA.
                </p>
                <div className="course-features">
                  <span className="feature-tag">✓ Tốt nghiệp THPT</span>
                  <span className="feature-tag">✓ Thi Đại học</span>
                </div>
              </div>
              <div className="card-shine"></div>
            </div>

            {/* Card 4 */}
            <div className="course-card-redesigned gradient-orange">
              <div className="course-card-inner">
                <div className="course-icon-large">🏆</div>
                <h3>Bồi dưỡng HSG</h3>
                <p>
                  Dành cho học sinh có tố chất, hướng tới HSG Quận, Thành phố và Quốc gia.
                  Phát triển tư duy sáng tạo với Mentor từng đạt giải.
                </p>
                <div className="course-features">
                  <span className="feature-tag">✓ Chuyên đề nâng cao</span>
                  <span className="feature-tag">✓ Tư duy sáng tạo</span>
                </div>
              </div>
              <div className="card-shine"></div>
            </div>
          </div>
        </div>
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

      {/* Mentors Section - Redesigned */}
      <section id="mentors" className="mentors-section-redesigned">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">👨‍🏫 Đội ngũ giảng viên</span>
            <h2 className="section-title">Gặp gỡ các <span className="text-highlight">Mentor xuất sắc</span></h2>
            <p className="section-subtitle">
              Đội ngũ giảng viên trẻ, tài năng từ Đại học Bách Khoa Hà Nội
            </p>
          </div>

          {/* Stats Bar */}
          <div className="mentor-stats-bar">
            <div className="mentor-stat">
              <div className="stat-number">50+</div>
              <div className="stat-label">Mentor xuất sắc</div>
            </div>
            <div className="mentor-stat">
              <div className="stat-number">100+</div>
              <div className="stat-label">Học sinh tin tưởng</div>
            </div>
            <div className="mentor-stat">
              <div className="stat-number">5.0</div>
              <div className="stat-label">Đánh giá</div>
            </div>
            <div className="mentor-stat">
              <div className="stat-number">100%</div>
              <div className="stat-label">Hài lòng</div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="benefits-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Đồng hành 24/24 - Không chỉ là giờ học trên lớp</h2>
            <p className="section-subtitle">
              Quyền lợi đặc biệt cho học sinh Unicorn Edu
            </p>
          </div>

          <div className="benefits-grid">
            <div className="benefit-card">
              <h3>
                <span className="benefit-emoji">💬</span>
                Hỗ trợ giải đáp 24/24
              </h3>
              <p>
                Học sinh gặp bài khó khi tự học? Nhắn tin ngay cho Mentor để được hỗ trợ bất cứ lúc nào.
                Không phải chờ đến buổi học tiếp theo.
              </p>
            </div>

            <div className="benefit-card">
              <h3>
                <span className="benefit-emoji">✍️</span>
                Giao & Chữa bài chi tiết
              </h3>
              <p>
                Bài tập về nhà được giao sát với năng lực. Mentor chữa bài chi tiết,
                chỉ rõ lỗi sai tư duy và cách khắc phục.
              </p>
            </div>

            <div className="benefit-card">
              <h3>
                <span className="benefit-emoji">📊</span>
                Báo cáo tiến độ cho phụ huynh
              </h3>
              <p>
                Phụ huynh nắm bắt được sự tiến bộ rõ rệt của con theo từng giai đoạn.
                Minh bạch trong từng bước phát triển.
              </p>
            </div>
          </div>
        </div>
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

          <div style={{ marginTop: 'var(--spacing-12)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-8)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span style={{ fontSize: '20px' }}>📞</span>
                <span>0912888908</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span style={{ fontSize: '20px' }}>📧</span>
                <span>unicornsmath@gmail.com</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <span style={{ fontSize: '20px' }}>🌐</span>
              <span>Fanpage: Unicorn Edu - Học Toán Cùng Huster</span>
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
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>📞 0912888908</span>
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>📧 unicornsmath@gmail.com</span>
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>📍 Đại học Bách Khoa Hà Nội</span>
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
