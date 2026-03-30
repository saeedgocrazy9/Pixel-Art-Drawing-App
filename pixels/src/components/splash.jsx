import React, { useState, useEffect } from "react"
import { Sparkles } from "lucide-react"

export default function Splash({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading (adjust timing as needed)
    const loadingTimer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    // Hide splash and show main content
    const hideTimer = setTimeout(() => {
      setIsVisible(false)
      onComplete()
    }, 3500)

    return () => {
      clearTimeout(loadingTimer)
      clearTimeout(hideTimer)
    }
  }, [onComplete])

  if (!isVisible) return null

  return (
    <div className="splash-container">
      {/* Background with animated gradient */}
      <div className="splash-bg">
        <div className="splash-blob blob-1"></div>
        <div className="splash-blob blob-2"></div>
        <div className="splash-blob blob-3"></div>
      </div>

      {/* Main content */}
      <div className="splash-content">
        {/* Logo animation */}
        <div className="splash-logo-wrapper">
          <div className="splash-logo">
            <div className="logo-icon">✨</div>
            <div className="logo-text">
              <h1>PixelArt</h1>
              <p>Studio</p>
            </div>
          </div>

          {/* Floating particles */}
          <div className="particles">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="particle"
                style={{
                  "--particle-index": i,
                }}
              >
                <div className="particle-dot"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Tagline with animation */}
        <div className="splash-tagline">
          <span className="tagline-word">Create</span>
          <span className="tagline-word">Pixel</span>
          <span className="tagline-word">Art</span>
          <span className="tagline-word">Magic</span>
        </div>

        {/* Loading animation */}
        {isLoading && (
          <div className="splash-loading">
            <div className="loading-bar-container">
              <div className="loading-bar"></div>
            </div>
            <p className="loading-text">Loading your canvas...</p>
          </div>
        )}

        {/* Completion message */}
        {!isLoading && (
          <div className="splash-ready">
            <div className="ready-icon">
              <Sparkles size={40} />
            </div>
            <p className="ready-text">Ready to Create!</p>
          </div>
        )}
      </div>

      {/* Overlay */}
      <div className={`splash-overlay ${!isVisible ? "hidden" : ""}`}></div>
    </div>
  )
}