import React, { useState } from "react"
import "./styles/App.css"
import Editor from "./components/Editor"
import FreehandCanvas from "./components/FreehandCanvas"
import Chatbot from "./components/Chatbot"
import { PaletteIcon, PenTool } from "lucide-react"

function App() {
  const [currentPage, setCurrentPage] = useState(1)

  return (
    <div className="App">
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-logo">
            <div className="logo-icon">✨</div>
            <span>PixelArt Studio</span>
          </div>
          
          <div className="nav-buttons">
            <button
              className={`nav-btn ${currentPage === 1 ? "active" : ""}`}
              onClick={() => setCurrentPage(1)}
            >
              <PaletteIcon size={20} />
              <span>Pixel Editor</span>
            </button>
            <button
              className={`nav-btn ${currentPage === 2 ? "active" : ""}`}
              onClick={() => setCurrentPage(2)}
            >
              <PenTool size={20} />
              <span>Freehand</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {currentPage === 1 && <Editor />}
        {currentPage === 2 && <FreehandCanvas />}
      </main>

      <footer className="footer">
        <p>PixelArt Studio © 2024 | Create & Express</p>
      </footer>

      {/* AI Chatbot - Voice Enabled */}
      <Chatbot />
    </div>
  )
}

export default App