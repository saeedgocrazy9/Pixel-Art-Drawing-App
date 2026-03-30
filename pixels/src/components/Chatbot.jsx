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
  
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  // Use backend API instead of direct API call
  const BACKEND_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/chat"

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isChatbotEnabled) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in your browser")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.language = "en-US"

    recognition.onstart = () => {
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
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isChatbotEnabled])

  // Initialize initial message when chatbot enabled
  useEffect(() => {
    if (isChatbotEnabled && messages.length === 0) {
      const welcomeMessage = {
        id: 1,
        text: "Hello! 👋 I'm your PixelArt Studio AI Assistant. You can speak or type to me. How can I help you today?",
        sender: "bot",
        timestamp: new Date()
      }
      setMessages([welcomeMessage])
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
      if (recognitionRef.current && isChatbotEnabled) {
        setTimeout(() => {
          recognitionRef.current.start()
        }, 500)
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  // Toggle Voice Listening
  const toggleVoiceListening = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not available")
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setInputValue("")
      setError(null)
      recognitionRef.current.start()
    }
  }

  // Send Message to Backend
  const handleSendMessage = async (messageText = inputValue) => {
    if (!messageText.trim()) return

    const userMessage = {
      id: messages.length + 1,
      text: messageText,
      sender: "user",
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)
    setError(null)

    try {
      const systemPrompt = `You are a helpful AI assistant for PixelArt Studio, a web application for creating digital art.

IMPORTANT: Respond in the SAME LANGUAGE the user uses:
- If user writes in Hindi, respond in Hindi
- If user writes in English, respond in English
- If user writes in any other language, respond in that same language

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

      const botMessage = {
        id: messages.length + 2,
        text: response.data.message,
        sender: "bot",
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])

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
      } else if (error.message === "Network Error") {
        errorMsg += "Cannot connect to server - is backend running on port 5000?"
      } else if (error.response?.data?.error) {
        errorMsg += error.response.data.error
      } else {
        errorMsg += error.message || "Unknown error"
      }

      setError(errorMsg)

      const errorBotMessage = {
        id: messages.length + 2,
        text: errorMsg,
        sender: "bot",
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorBotMessage])
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