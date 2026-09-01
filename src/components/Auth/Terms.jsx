import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="terms-page">
      <div className="terms-box">
        <Link to="/register" className="terms-back">← Back to Sign Up</Link>
        <h1>Terms of Service</h1>
        <p className="terms-updated">© 2026 DINOCLAN. All rights reserved.</p>

        <p>
          By creating an account or using DINOCLAN ("the Service"), you agree to be bound
          by these Terms of Service. If you do not agree, do not use the Service.
        </p>

        <section>
          <h2>Your Account</h2>
          <p>
            You are responsible for keeping your account credentials secure. You must not
            share your password or allow others to access your account. DINOCLAN is not
            liable for any loss resulting from unauthorised use of your account.
          </p>
        </section>

        <section>
          <h2>Acceptable Use</h2>
          <p>You agree NOT to:</p>
          <ul>
            <li>Intimidate other users</li>
            <li>Share anyone's personal information without their consent</li>
            <li>Attempt to hack, disrupt, or interfere with the Service</li>
            <li>Impersonate another person or DINOCLAN staff</li>
          </ul>
          <p>
            DINOCLAN reserves the right to suspend or terminate any account that violates
            these rules.
          </p>
        </section>

        <section>
          <h2>Your Content</h2>
          <p>
            You retain ownership of content you post (messages, images, etc.). By posting
            content on DINOCLAN, you grant DINOCLAN a non-exclusive, royalty-free licence
            to store and display that content solely for the purpose of operating the
            Service. You are solely responsible for any content you share.
          </p>
        </section>

        <section>
          <h2>Intellectual Property</h2>
          <p>
            All original code, design, branding, and features of DINOCLAN are the
            intellectual property of DINOCLAN and are protected by copyright law.
            You may not copy, reproduce, or redistribute any part of the Service
            without written permission.
          </p>
        </section>

        <p className="terms-copy">© 2026 DINOCLAN. All rights reserved.</p>
      </div>
    </div>
  )
}
