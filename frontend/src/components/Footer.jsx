import { CONTENT } from '../data/content';

export default function Footer() {
  const navLinks = [
    { label: 'Overview', href: '#overview' },
    { label: 'Why NILM', href: '#why-it-matters-heading' },
    { label: 'Superposition', href: '#the-problem-heading' },
    { label: 'Pipeline', href: '#pipeline-heading' },
    { label: 'VMD', href: '#vmd-heading' },
    { label: 'Features', href: '#features-heading' },
    { label: 'Model', href: '#model-heading' },
    { label: 'Limits', href: '#limits-heading' },
    { label: 'Phases', href: '#tracker-heading' }
  ];

  const handleLinkClick = (e, href) => {
    e.preventDefault();
    const id = href.replace('#', '');
    const target = document.getElementById(id) || document.querySelector(`[data-section-target="${id}"]`);
    if (target) {
      if (window.lenis) {
        window.lenis.scrollTo(target, { offset: -70, duration: 1.0 });
      } else {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="site-footer">
      <div className="section-wrapper" style={{ padding: '0 var(--space-md) var(--space-xl)', textAlign: 'center' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-md)'
        }}>
          <strong style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', color: 'var(--text-primary)' }}>
            {CONTENT.header.title}
          </strong>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--accent-cyan)' }}>
            {CONTENT.footer.tag}
          </span>
        </div>

        <nav aria-label="Footer navigation" style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-md)'
        }}>
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link.href)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                textDecoration: 'none'
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          margin: 0
        }}>
          {CONTENT.footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
