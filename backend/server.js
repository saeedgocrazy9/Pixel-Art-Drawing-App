import express from "express"
import axios from "axios"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY
const DEEPINFRA_API_URL = "https://api.deepinfra.com/v1/openai/chat/completions"

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array required" })
    }

    console.log("Received request with", messages.length, "messages")

    const response = await axios.post(
      DEEPINFRA_API_URL,
      {
        model: "meta-llama/Llama-2-70b-chat-hf",
        messages: messages,
        temperature: 0.7,
        max_tokens: 300
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
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
    } else if (error.response?.status === 429) {
      errorMessage = "Rate limit exceeded. Please wait a moment"
    } else if (error.code === "ECONNABORTED") {
      errorMessage = "Request timeout. Please try again"
    } else if (error.message.includes("Network Error")) {
      errorMessage = "Network error - check your connection"
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
  console.log(`🔑 API Key loaded: ${DEEPINFRA_API_KEY ? "✅ YES" : "❌ NO"}`)
  console.log(`📍 Chat endpoint: http://localhost:${PORT}/api/chat`)
})