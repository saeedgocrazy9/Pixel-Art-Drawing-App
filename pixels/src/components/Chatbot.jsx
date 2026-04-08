import React, { useState, useRef, useEffect } from "react"
import "../styles/chatbot.css"
import { 
  MessageCircle, 
  Send, 
  X, 
  Minimize2, 
  Maximize2, 
  Loader,
  Mic,
  MicOff,
  Volume2,
  Settings,
  AlertCircle
} from "lucide-react"
import axios from "axios"

// Navigation events for state-based routing
const navigateToPage = (pageName) => {
  const pageMap = {
    "freehand": 2,
    "freehand drawing": 2,
    "drawing": 2,
    "draw": 2,
    "hand gesture": 3,
    "gesture": 3,
    "hand": 3,
    "pixel": 1,
    "pixel editor": 1,
    "editor": 1,
    "home": 1,
    "main": 1
  }
  
  const pageNum = pageMap[pageName.toLowerCase().trim()]
  if (pageNum) {
    // Dispatch custom event that App.jsx can listen to
    window.dispatchEvent(new CustomEvent("navigatePage", { detail: { page: pageNum } }))
    console.log(`🚀 Navigating to page: ${pageNum}`)
    return true
  }
  return false
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isChatbotEnabled, setIsChatbotEnabled] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [error, setError] = useState(null)
  const [messageCounter, setMessageCounter] = useState(0)
  
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const isListeningRef = useRef(false)

  const BACKEND_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/chat"

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

  const parseColorInput = (value) => {
    if (!value) return null
    const normalized = value.trim().toLowerCase()
    const namedColors = {
      red: "#ff0000",
      blue: "#0000ff",
      green: "#00ff00",
      yellow: "#ffff00",
      orange: "#ffa500",
      purple: "#800080",
      pink: "#ffc0cb",
      white: "#ffffff",
      black: "#000000",
      cyan: "#00ffff",
      teal: "#008080"
    }

    if (namedColors[normalized]) {
      return namedColors[normalized]
    }

    if (/^#?[0-9a-f]{6}$/i.test(normalized)) {
      return normalized.startsWith("#") ? normalized : `#${normalized}`
    }

    return null
  }

  const dispatchAppCommand = (detail, delay = 0) => {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("appCommand", { detail }))
    }, delay)
  }

  const executeAppCommand = (text) => {
    const input = text.toLowerCase().trim()

    if (/(open|go to|switch to).*(hand|gesture)/.test(input)) {
      navigateToPage("hand gesture")
      return "✋ Opening Hand Gesture page..."
    }

    if (/(open|go to|switch to).*(freehand|drawing)/.test(input)) {
      navigateToPage("freehand")
      return "🎨 Opening Freehand Drawing page..."
    }

    if (/(open|go to|switch to).*(pixel|editor|home)/.test(input)) {
      navigateToPage("pixel")
      return "✏️ Opening Pixel Editor page..."
    }

    const canvasSizeMatch = input.match(/(?:set|change)\s+(?:canvas|grid)\s*(?:size)?\s*(?:to)?\s*(\d{1,2})\s*(?:x|by)\s*(\d{1,2})/)
    if (canvasSizeMatch) {
      const width = clamp(parseInt(canvasSizeMatch[1], 10), 1, 64)
      const height = clamp(parseInt(canvasSizeMatch[2], 10), 1, 64)
      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "setCanvasSize", width, height }, 350)
      return `📐 Canvas set to ${width} x ${height}.`
    }

    const widthInText = input.match(/width\s*(?:to)?\s*(\d{1,2})/)
    const heightInText = input.match(/height\s*(?:to)?\s*(\d{1,2})/)
    const isCanvasSizingIntent = /(canvas|grid)/.test(input)
    if (isCanvasSizingIntent && widthInText && heightInText) {
      const width = clamp(parseInt(widthInText[1], 10), 1, 64)
      const height = clamp(parseInt(heightInText[1], 10), 1, 64)
      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "setCanvasSize", width, height }, 350)
      return `📐 Canvas set to ${width} x ${height}.`
    }

    const widthMatch = input.match(/(?:set|change)\s+(?:canvas|grid)\s*width\s*(?:to)?\s*(\d{1,2})/)
    if (widthMatch) {
      const width = clamp(parseInt(widthMatch[1], 10), 1, 64)
      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "setCanvasWidth", width }, 350)
      return `↔️ Canvas width set to ${width}.`
    }

    const heightMatch = input.match(/(?:set|change)\s+(?:canvas|grid)\s*height\s*(?:to)?\s*(\d{1,2})/)
    if (heightMatch) {
      const height = clamp(parseInt(heightMatch[1], 10), 1, 64)
      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "setCanvasHeight", height }, 350)
      return `↕️ Canvas height set to ${height}.`
    }

    if (/(start drawing|start canvas)/.test(input)) {
      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "startDrawing" }, 350)
      return "🟢 Started the Pixel Editor canvas."
    }

    if (/(reset editor|reset canvas)/.test(input)) {
      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "resetEditor" }, 350)
      return "♻️ Pixel Editor has been reset."
    }

    if (/\bundo\b/.test(input)) {
      if (input.includes("freehand")) {
        navigateToPage("freehand")
        dispatchAppCommand({ target: "freehand", action: "undo" }, 350)
        return "↩️ Undo applied on Freehand canvas."
      }
      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "undo" }, 350)
      return "↩️ Undo applied on Pixel Editor."
    }

    if (/\bredo\b/.test(input)) {
      if (input.includes("freehand")) {
        navigateToPage("freehand")
        dispatchAppCommand({ target: "freehand", action: "redo" }, 350)
        return "↪️ Redo applied on Freehand canvas."
      }
      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "redo" }, 350)
      return "↪️ Redo applied on Pixel Editor."
    }

    if (/(clear canvas|clear drawing|erase all)/.test(input)) {
      if (input.includes("gesture") || input.includes("hand")) {
        navigateToPage("hand gesture")
        dispatchAppCommand({ target: "handgesture", action: "clearDrawing" }, 400)
        return "🧼 Cleared Hand Gesture drawing."
      }

      if (input.includes("freehand")) {
        navigateToPage("freehand")
        dispatchAppCommand({ target: "freehand", action: "clearCanvas" }, 350)
        return "🧼 Cleared Freehand canvas."
      }

      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "clearCanvas" }, 350)
      return "🧼 Cleared Pixel Editor canvas."
    }

    if (/(save image|download image|export)/.test(input)) {
      if (input.includes("gesture") || input.includes("hand")) {
        navigateToPage("hand gesture")
        dispatchAppCommand({ target: "handgesture", action: "downloadImage" }, 400)
        return "💾 Download started for Hand Gesture canvas."
      }

      if (input.includes("freehand")) {
        navigateToPage("freehand")
        dispatchAppCommand({ target: "freehand", action: "exportPNG" }, 350)
        return "💾 Download started for Freehand canvas."
      }

      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "exportPNG" }, 350)
      return "💾 Download started for Pixel Editor canvas."
    }

    const freehandBrushMatch = input.match(/(?:set|select|choose)\s+(?:brush|tool)\s*(?:to)?\s*(solid|dashed|dotted|fuzzy|crayon|spray|calligraphy)/)
    if (freehandBrushMatch) {
      const brushType = freehandBrushMatch[1]
      navigateToPage("freehand")
      dispatchAppCommand({ target: "freehand", action: "setBrushType", brushType }, 350)
      return `🖌️ Freehand brush changed to ${brushType}.`
    }

    const freehandSizeMatch = input.match(/(?:set|change)\s+(?:freehand\s+)?(?:brush\s+)?size\s*(?:to)?\s*(\d{1,2})/)
    if (freehandSizeMatch && !input.includes("gesture")) {
      const brushSize = clamp(parseInt(freehandSizeMatch[1], 10), 1, 50)
      navigateToPage("freehand")
      dispatchAppCommand({ target: "freehand", action: "setBrushSize", brushSize }, 350)
      return `📏 Freehand brush size set to ${brushSize}px.`
    }

    const colorMatch = input.match(/(?:set|change|select|choose)\s+color\s*(?:to)?\s*([#a-z0-9]+)/)
    if (colorMatch) {
      const colorValue = parseColorInput(colorMatch[1])
      if (!colorValue) {
        return "⚠️ I could not understand that color. Try a hex like #ff0000 or a basic name like red."
      }

      if (input.includes("gesture") || input.includes("hand")) {
        navigateToPage("hand gesture")
        dispatchAppCommand({ target: "handgesture", action: "setColor", color: colorValue }, 400)
        return `🎨 Hand Gesture color set to ${colorValue}.`
      }

      if (input.includes("freehand")) {
        navigateToPage("freehand")
        dispatchAppCommand({ target: "freehand", action: "setColor", color: colorValue }, 350)
        return `🎨 Freehand color set to ${colorValue}.`
      }

      navigateToPage("pixel")
      dispatchAppCommand({ target: "editor", action: "setColor", color: colorValue }, 350)
      return `🎨 Pixel Editor color set to ${colorValue}.`
    }

    if (/(start camera|start gesture|open camera)/.test(input)) {
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "startCamera" }, 500)
      return "📷 Started Hand Gesture camera."
    }

    if (/(stop camera|stop gesture|close camera)/.test(input)) {
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "stopCamera" }, 400)
      return "🛑 Stopped Hand Gesture camera."
    }

    const handBrushMatch = input.match(/(?:set|change)\s+(?:gesture|hand)\s*(?:brush\s+)?size\s*(?:to)?\s*(\d{1,2})/)
    if (handBrushMatch) {
      const brushSize = clamp(parseInt(handBrushMatch[1], 10), 1, 60)
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "setBrushSize", brushSize }, 400)
      return `🖊️ Hand Gesture brush size set to ${brushSize}px.`
    }

    const sensitivityMatch = input.match(/(?:set|change)\s+(?:gesture\s+)?sensitivity\s*(?:to)?\s*(\d{1,3})%?/)
    if (sensitivityMatch) {
      const sensitivity = clamp(parseInt(sensitivityMatch[1], 10), 30, 85) / 100
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "setSensitivity", sensitivity }, 400)
      return `🎯 Hand Gesture sensitivity set to ${Math.round(sensitivity * 100)}%.`
    }

    if (/(enable|turn on).*(rainbow mode|rainbow)/.test(input)) {
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "setRainbowMode", value: true }, 400)
      return "🌈 Rainbow mode enabled for Hand Gesture canvas."
    }

    if (/(disable|turn off).*(rainbow mode|rainbow)/.test(input)) {
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "setRainbowMode", value: false }, 400)
      return "🌈 Rainbow mode disabled for Hand Gesture canvas."
    }

    if (/(enable|turn on).*(pinch only|pinch mode)/.test(input)) {
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "setPinchOnly", value: true }, 400)
      return "🤏 Pinch-only mode enabled."
    }

    if (/(disable|turn off).*(pinch only|pinch mode)/.test(input)) {
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "setPinchOnly", value: false }, 400)
      return "🤏 Pinch-only mode disabled."
    }

    if (/(show|enable|turn on).*(skeleton)/.test(input)) {
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "setSkeleton", value: true }, 400)
      return "🦴 Skeleton view enabled."
    }

    if (/(hide|disable|turn off).*(skeleton)/.test(input)) {
      navigateToPage("hand gesture")
      dispatchAppCommand({ target: "handgesture", action: "setSkeleton", value: false }, 400)
      return "🦴 Skeleton view disabled."
    }

    return null
  }

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isChatbotEnabled) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in your browser")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.language = "en-US"

    recognition.onstart = () => {
      isListeningRef.current = true
      setIsListening(true)
      setError(null)
    }

    recognition.onresult = (event) => {
      let transcript = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      
      if (event.results[event.results.length - 1].isFinal) {
        setInputValue(transcript)
        setTimeout(() => {
          handleSendMessage(transcript)
        }, 500)
      }
    }

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error)
      setError(`Speech error: ${event.error}`)
      isListeningRef.current = false
      setIsListening(false)
    }

    recognition.onend = () => {
      isListeningRef.current = false
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [isChatbotEnabled])

  // Initialize initial message when chatbot enabled
  useEffect(() => {
    if (isChatbotEnabled && messages.length === 0) {
      const welcomeMessage = {
        id: `msg-${Date.now()}-welcome`,
        text: "Hello! 👋 I'm your PixelArt Studio AI Assistant. You can speak or type to me. How can I help you today?",
        sender: "bot",
        timestamp: new Date()
      }
      setMessages([welcomeMessage])
      setMessageCounter(1)
      setError(null)

      if (voiceEnabled) {
        speakMessage(welcomeMessage.text)
      }
    }
  }, [isChatbotEnabled])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Text-to-Speech Function
  const speakMessage = (text) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
    }

    window.speechSynthesis.speak(utterance)
  }

  // Toggle Voice Listening
  const toggleVoiceListening = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not available")
      return
    }

    if (isListeningRef.current) {
      recognitionRef.current.stop()
      isListeningRef.current = false
      setIsListening(false)
    } else {
      setInputValue("")
      setError(null)
      isListeningRef.current = true
      try {
        recognitionRef.current.start()
      } catch (e) {
        console.error("Error starting recognition:", e)
        isListeningRef.current = false
      }
    }
  }

  // Send Message to Backend
  const handleSendMessage = async (messageText = inputValue) => {
    if (!messageText.trim()) return

    const localCommandResponse = executeAppCommand(messageText)
    if (localCommandResponse) {
      const newCounter = messageCounter + 1
      const userMessage = {
        id: `msg-${Date.now()}-user-${newCounter}`,
        text: messageText,
        sender: "user",
        timestamp: new Date()
      }

      const botMessage = {
        id: `msg-${Date.now()}-cmd-${newCounter + 1}`,
        text: localCommandResponse,
        sender: "bot",
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage, botMessage])
      setInputValue("")
      setError(null)
      setMessageCounter(newCounter + 1)

      if (voiceEnabled) {
        speakMessage(localCommandResponse)
      }
      return
    }

    const newCounter = messageCounter + 1
    const userMessage = {
      id: `msg-${Date.now()}-user-${newCounter}`,
      text: messageText,
      sender: "user",
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)
    setError(null)
    setMessageCounter(newCounter)

    try {
      const systemPrompt = `You are a helpful AI assistant for PixelArt Studio, a web application for creating digital art.

IMPORTANT INSTRUCTIONS:
1. Respond in the SAME LANGUAGE the user uses:
   - If user writes in Hindi, respond in Hindi
   - If user writes in English, respond in English
   - If user writes in any other language, respond in that same language

2. The app can execute voice/text commands directly for:
  - Navigation: pixel editor, freehand, hand gesture page
  - Pixel editor: canvas width/height/size, undo, redo, clear
  - Freehand: brush type, brush size, color, undo, redo, clear
  - Hand gesture: start/stop camera, brush size, color, sensitivity, rainbow mode, pinch mode, skeleton

3. If command-style request is not auto-executed by app, then guide user clearly in 1-2 steps.

Features of PixelArt Studio:
- Pixel Editor: Grid-based art creation (1-64 pixels), color picker, undo/redo, PNG export
- Freehand Drawing: 7 brush styles (Solid, Dashed, Dotted, Fuzzy, Crayon, Spray, Calligraphy), adjustable sizes (1-50px), full history
- Fully responsive design for all devices
- Touch support for mobile devices

Provide helpful, friendly tips. Keep responses concise (2-3 sentences). Use emojis.`

      console.log("Sending to backend:", BACKEND_API_URL)

      const response = await axios.post(
        BACKEND_API_URL,
        {
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map(msg => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.text
            })),
            { role: "user", content: messageText }
          ]
        },
        {
          timeout: 30000
        }
      )

      console.log("Backend response:", response.data)

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to get response")
      }

      const newCounter2 = newCounter + 1
      const botMessage = {
        id: `msg-${Date.now()}-bot-${newCounter2}`,
        text: response.data.message,
        sender: "bot",
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
      setMessageCounter(newCounter2)

      if (voiceEnabled) {
        speakMessage(botMessage.text)
      }
    } catch (error) {
      console.error("Error:", error)
      
      let errorMsg = "Sorry, I encountered an error. "
      
      if (error.code === "ECONNABORTED") {
        errorMsg += "Request timeout - please try again"
      } else if (error.response?.status === 429) {
        errorMsg += "Rate limited - please wait a moment"
      } else if (error.response?.status === 401) {
        errorMsg += "Authentication error - check API key"
      } else if (error.response?.status === 404) {
        errorMsg += "Model not found - please try again"
      } else if (error.message === "Network Error") {
        errorMsg += "Cannot connect to server - is backend running on port 5000?"
      } else if (error.response?.data?.error) {
        errorMsg += error.response.data.error
      } else {
        errorMsg += error.message || "Unknown error"
      }

      setError(errorMsg)

      const newCounter2 = newCounter + 1
      const errorBotMessage = {
        id: `msg-${Date.now()}-error-${newCounter2}`,
        text: errorMsg,
        sender: "bot",
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorBotMessage])
      setMessageCounter(newCounter2)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    handleSendMessage()
  }

  const clearChat = () => {
    setMessages([])
    setInputValue("")
    setError(null)
    setShowSettings(false)
    setMessageCounter(0)
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          className="chatbot-floating-btn"
          onClick={() => setIsOpen(true)}
          title="Open Chat"
        >
          <MessageCircle size={24} />
          {isChatbotEnabled && <span className="chatbot-badge">●</span>}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`chatbot-window ${isMinimized ? "minimized" : ""}`}>
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-title">
              <MessageCircle size={20} />
              <span>PixelArt Assistant</span>
              {isChatbotEnabled && <span className="chatbot-status-dot"></span>}
            </div>
            <div className="chatbot-controls">
              <button
                className={`chatbot-btn ${showSettings ? "active" : ""}`}
                onClick={() => setShowSettings(!showSettings)}
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                className="chatbot-btn"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              <button
                className="chatbot-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && !isMinimized && (
            <div className="chatbot-settings">
              <div className="settings-group">
                <label className="settings-label">
                  <input
                    type="checkbox"
                    checked={isChatbotEnabled}
                    onChange={(e) => setIsChatbotEnabled(e.target.checked)}
                    className="settings-checkbox"
                  />
                  <span>Enable Chatbot</span>
                </label>
              </div>

              {isChatbotEnabled && (
                <>
                  <div className="settings-group">
                    <label className="settings-label">
                      <input
                        type="checkbox"
                        checked={voiceEnabled}
                        onChange={(e) => setVoiceEnabled(e.target.checked)}
                        className="settings-checkbox"
                      />
                      <span>
                        <Volume2 size={16} /> Voice Response
                      </span>
                    </label>
                  </div>

                  <div className="settings-divider"></div>

                  <button
                    className="settings-btn clear-btn"
                    onClick={clearChat}
                  >
                    Clear Chat History
                  </button>

                  <div className="settings-info">
                    <p>💡 <strong>Tips:</strong></p>
                    <ul>
                      <li>🎤 Click mic button to speak</li>
                      <li>💬 Or type your message</li>
                      <li>🌐 Supports Hindi, English & more</li>
                      <li>🔊 Toggle voice response on/off</li>
                      <li>🎨 Say "open freehand" to open drawing page</li>
                      <li>✏️ Say "set canvas size to 32x32" for pixel grid</li>
                      <li>✋ Say "go to hand gesture page" or "start camera"</li>
                      <li>🖌️ Say "select brush spray" or "set color to red"</li>
                    </ul>
                  </div>
                </>
              )}

              {!isChatbotEnabled && (
                <div className="settings-notice">
                  <p>⚙️ Enable the chatbot to start!</p>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {error && !isMinimized && (
            <div className="chatbot-error-banner">
              <AlertCircle size={16} />
              <p>{error}</p>
            </div>
          )}

          {/* Messages */}
          {!isMinimized && isChatbotEnabled && (
            <>
              <div className="chatbot-messages">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chatbot-message ${message.sender}`}
                  >
                    <div className="chatbot-message-content">
                      {message.text}
                    </div>
                    <span className="chatbot-time">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                ))}
                {isLoading && (
                  <div className="chatbot-message bot">
                    <div className="chatbot-message-content loading">
                      <Loader size={16} className="spinner" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}
                {isSpeaking && (
                  <div className="chatbot-message bot">
                    <div className="chatbot-message-content speaking">
                      <Volume2 size={16} className="spinner" />
                      <span>Speaking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="chatbot-input-area">
                <form className="chatbot-input-form" onSubmit={handleSubmit}>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isListening ? "Listening..." : "Type or speak..."}
                    disabled={isLoading || isSpeaking}
                    className="chatbot-input"
                  />
                  <button
                    type="button"
                    onClick={toggleVoiceListening}
                    disabled={isLoading || isSpeaking}
                    className={`chatbot-voice-btn ${isListening ? "active" : ""}`}
                    title={isListening ? "Stop listening" : "Start speaking"}
                  >
                    {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || isSpeaking || !inputValue.trim()}
                    className="chatbot-send-btn"
                    title="Send"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </>
          )}

          {/* Disabled State */}
          {!isMinimized && !isChatbotEnabled && (
            <div className="chatbot-disabled-state">
              <MessageCircle size={48} />
              <h3>Chatbot Disabled</h3>
              <p>Enable the chatbot in settings to start!</p>
              <button
                className="enable-btn"
                onClick={() => {
                  setShowSettings(false)
                  setIsChatbotEnabled(true)
                }}
              >
                Enable Now
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}