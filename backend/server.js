import express from "express"
import axios from "axios"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array required" })
    }

    console.log("Received request with", messages.length, "messages")

    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: "openai/gpt-3.5-turbo",
        messages: messages,
        temperature: 0.7,
        max_tokens: 300
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "PixelArt Studio",
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    )

    console.log("Success response received")

    res.json({
      success: true,
      message: response.data.choices[0].message.content
    })
  } catch (error) {
    console.error("API Error:", error.message)
    console.error("Full error:", error.response?.data || error)
    
    let errorMessage = "Failed to get response from AI"
    if (error.response?.status === 401) {
      errorMessage = "API authentication failed - check your API key"
    } else if (error.response?.status === 404) {
      errorMessage = "Model not found - please check model name"
    } else if (error.response?.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment"
    } else if (error.code === "ECONNABORTED") {
      errorMessage = "Request timeout. Please try again"
    } else if (error.response?.status === 400) {
      errorMessage = "Bad request - check message format"
    } else if (error.response?.status === 402) {
      errorMessage = "Payment required - no free credits available"
    }

    res.status(error.response?.status || 500).json({
      success: false,
      error: errorMessage,
      details: error.message
    })
  }
})

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`🔑 API Key loaded: ${OPENROUTER_API_KEY ? "✅ YES" : "❌ NO"}`)
  console.log(`📍 Chat endpoint: http://localhost:${PORT}/api/chat`)
  console.log(`🤖 Using model: openai/gpt-3.5-turbo`)
})