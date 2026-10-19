import upangLogo from '../assets/upang logo.png'

export default function LoadingPage() {
  return (
    <main className="home-loading" role="status" aria-live="polite">
      <div className="home-loading-mark">
        <img src={upangLogo} alt="" className="home-loading-logo" />
      </div>
      <p className="home-loading-kicker">UPANG ASSIST</p>
      <h1>Preparing your campus assistant</h1>
      <div className="home-loading-bar" aria-hidden="true"><span></span></div>
      <p className="home-loading-note">Loading your personalized experience...</p>
    </main>
  )
}

