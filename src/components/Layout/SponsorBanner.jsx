const SPONSORS = [
  {
    icon: '🦕',
    name: 'Dino Typer',
    desc: 'Test your typing speed!',
    url: 'https://dino-typer.netlify.app',
    cta: 'Play Now',
  },
  {
    icon: '🦖',
    name: 'DinoTycoon',
    desc: 'Build and grow your dino empire!',
    url: 'https://dinotycoon-lynr.onrender.com/',
    cta: 'Play Now',
  },
  {
    icon: '🐼',
    name: 'Panda Games',
    desc: 'A collection of fun mini games!',
    url: 'https://panda-games.vercel.app',
    cta: 'Play Now',
  },
]

export default function SponsorBanner() {
  return (
    <div className="sponsor-banner">
      <div className="sponsor-label">⭐ SPONSORS</div>
      {SPONSORS.map(s => (
        <div className="sponsor-card" key={s.name}>
          <div className="sponsor-icon">{s.icon}</div>
          <div className="sponsor-info">
            <div className="sponsor-name">{s.name}</div>
            <div className="sponsor-desc">{s.desc}</div>
          </div>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="sponsor-btn"
          >
            {s.cta}
          </a>
        </div>
      ))}
    </div>
  )
}
