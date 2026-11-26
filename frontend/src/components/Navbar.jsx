import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Zap, Menu, X } from 'lucide-react';
import { CONTENT } from '../data/content';

export default function Navbar() {
  const [theme, setTheme] = useState('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const progressBarRef = useRef(null);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    try {
      const active = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(active);
    } catch {
      setTheme('dark');
    }

    let ticking = false;
    const updateScrollState = () => {
      const scrollY = window.scrollY;
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalScroll > 0 ? (scrollY / totalScroll) * 100 : 0;

      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${progress}%`;
        progressBarRef.current.setAttribute('aria-valuenow', Math.round(progress));
      }

      // 80px scroll threshold for glassmorphism
      setScrolled(scrollY > 80);

      // Hide on scroll down, show on scroll up (with 10px buffer)
      if (scrollY > 200 && scrollY > lastScrollYRef.current + 8) {
        setHidden(true);
      } else if (scrollY < lastScrollYRef.current - 8 || scrollY <= 200) {
        setHidden(false);
      }
      lastScrollYRef.current = scrollY;

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollState);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Active Section Detection via IntersectionObserver
    const sectionIds = [
      'why-it-matters-heading',
      'the-problem-heading',
      'pipeline-heading',
      'vmd-heading',
      'features-heading',
      'model-heading',
      'limits-heading',
      'tracker-heading'
    ];

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, {
      rootMargin: '-30% 0px -60% 0px'
    });

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const handleNavClick = (e, href) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (!href || href === '#') {
      if (window.lenis) {
        window.lenis.scrollTo(0, { duration: 1.2, easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)) });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    const id = href.replace('#', '');
    const target = document.getElementById(id) || document.querySelector(`[data-section-target="${id}"]`);
    if (target) {
      if (window.lenis) {
        window.lenis.scrollTo(target, { offset: -70, duration: 1.2, easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)) });
      } else {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('nilm-theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new CustomEvent('nilm-theme-changed', { detail: { theme: nextTheme } }));
    } catch (e) {
      console.warn('Theme storage unavailable', e);
    }
  };

  const navLinks = [
    { label: "Overview", href: "#" },
    { label: "Why NILM", href: "#why-it-matters-heading" },
    { label: "Superposition", href: "#the-problem-heading" },
    { label: "Pipeline", href: "#pipeline-heading" },
    { label: "VMD", href: "#vmd-heading" },
    { label: "Features", href: "#features-heading" },
    { label: "Model", href: "#model-heading" },
    { label: "Limits", href: "#limits-heading" },
    { label: "Phases", href: "#tracker-heading" }
  ];

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <div
        ref={progressBarRef}
        className="scroll-progress-bar"
        style={{ width: '0%' }}
        role="progressbar"
        aria-valuenow={0}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Scroll progress"
      />

      <header className={`navbar ${scrolled ? 'scrolled-glass' : 'transparent-top'} ${hidden && !mobileMenuOpen ? 'nav-hidden' : ''}`}>
        <div className="nav-brand">
          <Zap size={20} color="var(--accent-cyan)" />
          <span>{CONTENT.header.title}</span>
        </div>

        {/* Desktop Navigation Links with Active State Underline */}
        <nav className="nav-links-desktop" aria-label="Desktop primary">
          {navLinks.map((link) => {
            const isActive = link.href.includes(activeSection) && activeSection !== '';
            return (
              <a
                key={link.label}
                href={link.href}
                className={`nav-link-item ${isActive ? 'active-section' : ''}`}
                onClick={(e) => handleNavClick(e, link.href)}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="nav-controls">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={16} color="var(--color-fridge)" />
                <span>{CONTENT.header.themeLight}</span>
              </>
            ) : (
              <>
                <Moon size={16} color="var(--accent-cyan)" />
                <span>{CONTENT.header.themeDark}</span>
              </>
            )}
          </button>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu - Only rendered when open to prevent aria-hidden focusable violations */}
      {mobileMenuOpen && (
        <nav
          className="mobile-drawer open"
          aria-label="Mobile navigation"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="mobile-nav-link"
              onClick={(e) => handleNavClick(e, link.href)}
            >
              <span>{link.label}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--accent-cyan)' }}>→</span>
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
