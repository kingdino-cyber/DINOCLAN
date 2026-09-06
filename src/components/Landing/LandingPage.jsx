import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Servers & Channels',
    desc: 'Create your own server, set up channels, and invite your crew.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Friends & Groups',
    desc: 'Add friends, create group chats, and stay connected wherever you are.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    ),
    title: 'Voice Calls',
    desc: 'Hop into voice channels or start a private call with any friend.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Safe Community',
    desc: 'Trained monitors keep things safe. Report issues and get help fast.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5"/>
      </svg>
    ),
    title: 'Mobile Ready',
    desc: 'Full mobile layout — toggle mobile mode on the login page for the best experience.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07M4.93 4.93a10 10 0 0 0 0 14.14M8.46 8.46a5 5 0 0 0 0 7.07"/>
      </svg>
    ),
    title: 'Always Free',
    desc: 'No subscriptions, no paywalls. DINOCLAN is completely free to use.',
  },
]

export default function LandingPage() {
  return (
    <div className="lp-root">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-root {
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          background: #0a1a0a;
          color: #e8f5e9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* ── BACKGROUND TEXTURE ── */
        .lp-root::before {
          content: '';
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(76,175,80,0.07) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(76,175,80,0.05) 0%, transparent 45%);
        }

        /* ── NAV ── */
        .lp-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 40px; height: 68px;
          background: rgba(10,26,10,0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(76,175,80,0.12);
          box-shadow: 0 1px 24px rgba(0,0,0,0.4);
        }
        .lp-nav-brand {
          display: flex; align-items: center; gap: 12px;
          font-size: 20px; font-weight: 900; color: #fff; text-decoration: none;
          letter-spacing: -0.3px;
        }
        .lp-nav-brand img { width: 58px; height: 58px; object-fit: contain; }
        .lp-nav-links { display: flex; align-items: center; gap: 10px; }
        .lp-nav-login {
          padding: 9px 22px; border-radius: 10px; border: 1.5px solid rgba(76,175,80,0.4);
          background: transparent; color: #81c784; font-size: 14px; font-weight: 700;
          cursor: pointer; text-decoration: none; transition: all 0.18s;
        }
        .lp-nav-login:hover { background: rgba(76,175,80,0.1); border-color: #66bb6a; color: #a5d6a7; }
        .lp-nav-join {
          padding: 9px 22px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #4caf50, #43a047);
          color: #fff; font-size: 14px; font-weight: 700;
          cursor: pointer; text-decoration: none; transition: all 0.18s;
          box-shadow: 0 2px 12px rgba(76,175,80,0.35);
        }
        .lp-nav-join:hover { background: linear-gradient(135deg, #56c45a, #4caf50); transform: translateY(-1px); box-shadow: 0 4px 18px rgba(76,175,80,0.5); }

        /* ── HERO ── */
        .lp-hero {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 96px 24px 72px;
          background: radial-gradient(ellipse at 50% -10%, rgba(76,175,80,0.22) 0%, transparent 65%);
        }
        .lp-logo-wrap {
          position: relative; margin-bottom: 36px;
        }
        .lp-logo-wrap::before {
          content: '';
          position: absolute; inset: -18px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(76,175,80,0.22) 0%, transparent 70%);
          animation: lp-pulse 3s ease-in-out infinite;
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.08); }
        }
        .lp-logo {
          position: relative;
          width: 255px; height: 255px;
          object-fit: contain;
          filter: drop-shadow(0 12px 40px rgba(76,175,80,0.5));
        }
        .lp-hero h1 {
          font-size: clamp(44px, 9vw, 80px); font-weight: 900;
          letter-spacing: -2px; line-height: 1.02;
          background: linear-gradient(135deg, #c8e6c9 0%, #ffffff 45%, #a5d6a7 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; margin-bottom: 22px;
        }
        .lp-hero p {
          font-size: clamp(15px, 2.5vw, 19px); color: #81c784;
          max-width: 560px; line-height: 1.75; margin-bottom: 40px;
        }
        .lp-hero-btns { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
        .lp-btn-primary {
          padding: 15px 36px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, #4caf50, #388e3c);
          color: #fff; font-size: 16px; font-weight: 800;
          cursor: pointer; text-decoration: none; transition: all 0.18s;
          box-shadow: 0 6px 24px rgba(76,175,80,0.45);
          letter-spacing: 0.01em;
        }
        .lp-btn-primary:hover { background: linear-gradient(135deg, #56c45a, #43a047); transform: translateY(-2px); box-shadow: 0 10px 32px rgba(76,175,80,0.55); }
        .lp-btn-secondary {
          padding: 15px 36px; border-radius: 14px;
          border: 1.5px solid rgba(76,175,80,0.35);
          background: rgba(76,175,80,0.06); color: #81c784; font-size: 16px; font-weight: 700;
          cursor: pointer; text-decoration: none; transition: all 0.18s;
          letter-spacing: 0.01em;
        }
        .lp-btn-secondary:hover { background: rgba(76,175,80,0.12); border-color: #66bb6a; color: #a5d6a7; }

        /* ── STATS BAR ── */
        .lp-stats {
          position: relative; z-index: 1;
          display: flex; justify-content: center; gap: 0;
          padding: 0 32px; margin: 0 auto 96px; max-width: 900px;
          flex-wrap: wrap;
        }
        .lp-stat {
          display: flex; flex-direction: column; align-items: center;
          padding: 32px 40px;
          border: 1px solid rgba(76,175,80,0.18);
          background: rgba(76,175,80,0.07);
          flex: 1; min-width: 150px;
          transition: background 0.18s, border-color 0.18s;
        }
        .lp-stat:hover { background: rgba(76,175,80,0.12); border-color: rgba(76,175,80,0.35); }
        .lp-stat:first-child { border-radius: 18px 0 0 18px; }
        .lp-stat:last-child  { border-radius: 0 18px 18px 0; }
        .lp-stat-num { font-size: 34px; font-weight: 900; color: #fff; line-height: 1; }
        .lp-stat-label { font-size: 11px; color: #66bb6a; margin-top: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }

        /* ── DIVIDER ── */
        .lp-divider {
          position: relative; z-index: 1;
          display: flex; align-items: center; gap: 16px;
          max-width: 1100px; margin: 0 auto 56px; padding: 0 24px;
        }
        .lp-divider::before, .lp-divider::after {
          content: ''; flex: 1; height: 1px; background: rgba(76,175,80,0.15);
        }
        .lp-divider span {
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
          color: #4caf50; white-space: nowrap;
        }

        /* ── FEATURES ── */
        .lp-features {
          position: relative; z-index: 1;
          padding: 0 24px 96px; max-width: 1100px; margin: 0 auto;
        }
        .lp-section-title {
          text-align: center; font-size: clamp(28px, 4vw, 44px);
          font-weight: 900; color: #fff; margin-bottom: 56px; line-height: 1.15;
          letter-spacing: -0.5px;
        }
        .lp-section-title span { color: #66bb6a; }
        .lp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 18px;
        }
        .lp-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(76,175,80,0.13);
          border-radius: 20px; padding: 32px 28px;
          transition: border-color 0.2s, transform 0.2s, background 0.2s;
          position: relative; overflow: hidden;
        }
        .lp-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(76,175,80,0.4), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .lp-card:hover { border-color: rgba(76,175,80,0.35); transform: translateY(-4px); background: rgba(76,175,80,0.05); }
        .lp-card:hover::before { opacity: 1; }
        .lp-card-icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: rgba(76,175,80,0.13);
          color: #4caf50;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
          box-shadow: 0 2px 12px rgba(76,175,80,0.1);
        }
        .lp-card h3 { font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 10px; }
        .lp-card p  { font-size: 14px; color: #81c784; line-height: 1.65; }

        /* ── ABOUT ── */
        .lp-about {
          position: relative; z-index: 1;
          max-width: 860px; margin: 0 auto 96px; padding: 0 24px;
        }
        .lp-about-inner {
          background: rgba(76,175,80,0.05);
          border: 1px solid rgba(76,175,80,0.18);
          border-radius: 24px; padding: 52px 48px;
          position: relative; overflow: hidden;
        }
        .lp-about-inner::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent, #4caf50, transparent);
        }
        .lp-about-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.12em; color: #4caf50; margin-bottom: 14px;
        }
        .lp-about h2 {
          font-size: clamp(26px, 4vw, 38px); font-weight: 900; color: #fff;
          margin-bottom: 20px; line-height: 1.15; letter-spacing: -0.5px;
        }
        .lp-about p {
          font-size: 15px; color: #81c784; line-height: 1.8; margin-bottom: 16px;
        }
        .lp-about p:last-of-type { margin-bottom: 32px; }
        .lp-about-contact {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 12px 24px; border-radius: 12px;
          background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.3);
          color: #a5d6a7; font-size: 14px; font-weight: 600;
          text-decoration: none; transition: all 0.18s;
        }
        .lp-about-contact:hover { background: rgba(76,175,80,0.18); border-color: #66bb6a; color: #fff; }
        .lp-about-contact svg { flex-shrink: 0; }
        @media (max-width: 640px) {
          .lp-about-inner { padding: 36px 24px; }
        }

        /* ── CTA ── */
        .lp-cta {
          position: relative; z-index: 1;
          text-align: center; padding: 100px 24px;
          background: linear-gradient(160deg, rgba(76,175,80,0.12) 0%, rgba(56,142,60,0.06) 100%);
          border-top: 1px solid rgba(76,175,80,0.15);
          border-bottom: 1px solid rgba(76,175,80,0.15);
        }
        .lp-cta-badge {
          display: inline-block; padding: 5px 14px; border-radius: 20px;
          background: rgba(76,175,80,0.15); border: 1px solid rgba(76,175,80,0.3);
          font-size: 12px; font-weight: 700; color: #66bb6a;
          text-transform: uppercase; letter-spacing: 0.1em;
          margin-bottom: 24px;
        }
        .lp-cta h2 { font-size: clamp(30px, 5vw, 52px); font-weight: 900; color: #fff; margin-bottom: 14px; letter-spacing: -1px; }
        .lp-cta p  { font-size: 17px; color: #81c784; margin-bottom: 36px; }

        /* ── FOOTER ── */
        .lp-footer {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px;
          padding: 28px 40px;
          border-top: 1px solid rgba(76,175,80,0.08);
          font-size: 13px; color: #3d6b40;
        }
        .lp-footer-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; color: #4a7a4d; }
        .lp-footer-brand img { width: 30px; height: 30px; object-fit: contain; }
        .lp-footer-links { display: flex; gap: 24px; }
        .lp-footer-links a { color: #3d6b40; text-decoration: none; transition: color 0.15s; font-weight: 600; }
        .lp-footer-links a:hover { color: #66bb6a; }

        @media (max-width: 640px) {
          .lp-nav { padding: 0 16px; height: 60px; }
          .lp-nav-brand img { width: 36px; height: 36px; }
          .lp-stat { padding: 22px 20px; }
          .lp-stats { padding: 0 16px; margin-bottom: 64px; }
          .lp-hero { padding: 64px 20px 48px; }
          .lp-logo { width: 150px; height: 150px; }
          .lp-footer { flex-direction: column; align-items: flex-start; padding: 24px 20px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <a href="/" className="lp-nav-brand">
          <img src="/dinoclan-logo.png" alt="DINOCLAN" />
          DINOCLAN
        </a>
        <div className="lp-nav-links">
          <Link to="/login" className="lp-nav-login">Log In</Link>
          <Link to="/register" className="lp-nav-join">Join Free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-logo-wrap">
          <img src="/dinoclan-logo.png" alt="DINOCLAN logo" className="lp-logo" />
        </div>
        <h1>Chat with your Clan</h1>
        <p>
          DINOCLAN is a free chat platform built for communities. Servers, channels, voice calls, direct messages — everything your crew needs in one place.
        </p>
        <div className="lp-hero-btns">
          <Link to="/register" className="lp-btn-primary">Get Started — It's Free</Link>
          <Link to="/login" className="lp-btn-secondary">Already have an account</Link>
        </div>
      </section>

      {/* STATS */}
      <div className="lp-stats">
        <div className="lp-stat">
          <span className="lp-stat-num">100%</span>
          <span className="lp-stat-label">Free forever</span>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-num">🦕</span>
          <span className="lp-stat-label">Dino-powered</span>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-num">24/7</span>
          <span className="lp-stat-label">Always online</span>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-num" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </span>
          <span className="lp-stat-label">Mobile friendly</span>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="lp-divider"><span>Features</span></div>

      {/* FEATURES */}
      <section className="lp-features">
        <h2 className="lp-section-title">Everything your community <span>needs</span></h2>
        <div className="lp-grid">
          {FEATURES.map(f => (
            <div className="lp-card" key={f.title}>
              <div className="lp-card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      <div className="lp-divider"><span>About Us</span></div>
      <section className="lp-about">
        <div className="lp-about-inner">
          <p className="lp-about-label">Who we are</p>
          <h2>Built for communities, by a dino enthusiast</h2>
          <p>
            DINOCLAN is a passion project — a free, fully-featured chat platform built from the ground up for tight-knit communities. Whether you're gaming with friends, running a study group, or just hanging out, DINOCLAN gives you everything you need: servers, channels, voice calls, direct messages, groups, and more.
          </p>
          <p>
            Our mission is simple: provide another way to chat that works for everyone, at any age. We wanted a platform that's welcoming, safe, and genuinely fun to use — no matter who you are or how old you are. DINOCLAN is completely free — no subscriptions, no paywalls, no hidden fees. Our safety system is built in from day one, with trained monitors who keep things fair and a reporting system that actually works.
          </p>
          <p>
            Have a question, feedback, or just want to say hi? Reach out directly:
          </p>
          <a href="mailto:bohlehsaurus7@gmail.com" className="lp-about-contact">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            bohlehsaurus7@gmail.com
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <div className="lp-cta-badge">100% Free · No account required to browse</div>
        <h2>Ready to join the herd?</h2>
        <p>Create your account in seconds. No credit card needed.</p>
        <Link to="/register" className="lp-btn-primary">Create Free Account</Link>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <img src="/dinoclan-logo.png" alt="" />
          DINOCLAN © 2026
        </div>
        <div className="lp-footer-links">
          <Link to="/terms">Terms of Service</Link>
          <a href="mailto:bohlehsaurus7@gmail.com">Contact</a>
          <Link to="/login">Log In</Link>
          <Link to="/register">Sign Up</Link>
        </div>
      </footer>
    </div>
  )
}
