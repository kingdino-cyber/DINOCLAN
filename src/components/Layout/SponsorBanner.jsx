export default function SponsorBanner() {
  return (
    <div className="sponsor-banner">
      <div className="sponsor-label">⭐ SPONSORS</div>
      <div className="sponsor-card">
        <div className="sponsor-icon">🦕</div>
        <div className="sponsor-info">
          <div className="sponsor-name">Dino Typer</div>
          <div className="sponsor-desc">Test your typing speed!</div>
        </div>
        <a
          href="https://dino-typer.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          className="sponsor-btn"
        >
          Play Now
        </a>
      </div>
    </div>
  )
}
