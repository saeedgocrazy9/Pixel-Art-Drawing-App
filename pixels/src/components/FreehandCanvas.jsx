import React, { useRef, useEffect, useState } from "react"
import "../styles/freehandCanvas.css"
import { 
  Undo2, 
  Redo2, 
  Trash2, 
  Download, 
  Palette,
  Paintbrush,
  Sliders
} from "lucide-react"

export default function FreehandCanvas() {
  const canvasRef = useRef()
  const lastPosRef = useRef({ x: 0, y: 0 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedColor, setSelectedColor] = useState("#e94560")
  const [lineWidth, setLineWidth] = useState(3)
  const [brushType, setBrushType] = useState("solid")
  
  const [history, setHistory] = useState([])
  const [historyStep, setHistoryStep] = useState(-1)

  const brushTypes = {
    solid: { name: "Solid", icon: "●" },
    dashed: { name: "Dashed", icon: "- -" },
    dotted: { name: "Dotted", icon: "· · ·" },
    fuzzy: { name: "Fuzzy", icon: "∿" },
    crayon: { name: "Crayon", icon: "✏" },
    spray: { name: "Spray", icon: "◆" },
    calligraphy: { name: "Calligraphy", icon: "㋡" },
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    const initialState = canvas.toDataURL()
    setHistory([initialState])
    setHistoryStep(0)
  }, [])

  const drawSolidBrush = (ctx, fromX, fromY, toX, toY) => {
    ctx.strokeStyle = selectedColor
    ctx.lineWidth = lineWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.stroke()
  }

  const drawDashedBrush = (ctx, fromX, fromY, toX, toY) => {
    ctx.strokeStyle = selectedColor
    ctx.lineWidth = lineWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.setLineDash([lineWidth * 2, lineWidth])
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  const drawDottedBrush = (ctx, fromX, fromY, toX, toY) => {
    const distance = Math.hypot(toX - fromX, toY - fromY)
    const steps = Math.ceil(distance / (lineWidth * 1.5))
    
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps
      const x = fromX + (toX - fromX) * t
      const y = fromY + (toY - fromY) * t
      
      ctx.fillStyle = selectedColor
      ctx.beginPath()
      ctx.arc(x, y, lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawFuzzyBrush = (ctx, fromX, fromY, toX, toY) => {
    ctx.strokeStyle = selectedColor
    ctx.lineWidth = lineWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    
    for (let i = 0; i < 3; i++) {
      const offsetX = (Math.random() - 0.5) * lineWidth * 0.5
      const offsetY = (Math.random() - 0.5) * lineWidth * 0.5
      
      ctx.beginPath()
      ctx.moveTo(fromX + offsetX, fromY + offsetY)
      ctx.lineTo(toX + offsetX, toY + offsetY)
      ctx.stroke()
    }
  }

  const drawCrayonBrush = (ctx, fromX, fromY, toX, toY) => {
    const distance = Math.hypot(toX - fromX, toY - fromY)
    const steps = Math.ceil(distance / 2)
    
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps
      const x = fromX + (toX - fromX) * t
      const y = fromY + (toY - fromY) * t
      
      const size = lineWidth / 2
      for (let j = 0; j < 3; j++) {
        const offsetX = (Math.random() - 0.5) * lineWidth
        const offsetY = (Math.random() - 0.5) * lineWidth
        
        ctx.fillStyle = selectedColor
        ctx.globalAlpha = 0.7 + Math.random() * 0.3
        ctx.fillRect(x + offsetX - size / 2, y + offsetY - size / 2, size, size)
        ctx.globalAlpha = 1
      }
    }
  }

  const drawSprayBrush = (ctx, fromX, fromY, toX, toY) => {
    const distance = Math.hypot(toX - fromX, toY - fromY)
    const steps = Math.ceil(distance / 3)
    
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps
      const x = fromX + (toX - fromX) * t
      const y = fromY + (toY - fromY) * t
      
      const sprayAmount = Math.ceil(lineWidth * 2)
      for (let j = 0; j < sprayAmount; j++) {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * lineWidth
        const spotX = x + Math.cos(angle) * radius
        const spotY = y + Math.sin(angle) * radius
        
        ctx.fillStyle = selectedColor
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.arc(spotX, spotY, 1, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
  }

  const drawCalligraphyBrush = (ctx, fromX, fromY, toX, toY) => {
    const angle = Math.atan2(toY - fromY, toX - fromX)
    const perpX = Math.cos(angle + Math.PI / 2) * lineWidth * 0.75
    const perpY = Math.sin(angle + Math.PI / 2) * lineWidth * 0.75
    
    ctx.fillStyle = selectedColor
    ctx.beginPath()
    ctx.moveTo(fromX - perpX, fromY - perpY)
    ctx.lineTo(toX - perpX, toY - perpY)
    ctx.lineTo(toX + perpX, toY + perpY)
    ctx.lineTo(fromX + perpX, fromY + perpY)
    ctx.fill()
  }

  const getBrushDrawFunction = () => {
    switch (brushType) {
      case "solid":
        return drawSolidBrush
      case "dashed":
        return drawDashedBrush
      case "dotted":
        return drawDottedBrush
      case "fuzzy":
        return drawFuzzyBrush
      case "crayon":
        return drawCrayonBrush
      case "spray":
        return drawSprayBrush
      case "calligraphy":
        return drawCalligraphyBrush
      default:
        return drawSolidBrush
    }
  }

  const saveToHistory = () => {
    const canvas = canvasRef.current
    const imageData = canvas.toDataURL()
    
    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push(imageData)
    
    setHistory(newHistory)
    setHistoryStep(newHistory.length - 1)
  }

  const draw = (x, y) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const brushFunction = getBrushDrawFunction()
    
    brushFunction(ctx, lastPosRef.current.x, lastPosRef.current.y, x, y)
    lastPosRef.current.x = x
    lastPosRef.current.y = y
  }

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1
      setHistoryStep(newStep)
      
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      const img = new Image()
      
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
      }
      
      img.src = history[newStep]
    }
  }

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1
      setHistoryStep(newStep)
      
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      const img = new Image()
      
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
      }
      
      img.src = history[newStep]
    }
  }

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    lastPosRef.current.x = x
    lastPosRef.current.y = y
    setIsDrawing(true)
  }

  const handleMouseMove = (e) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    draw(x, y)
  }

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false)
      saveToHistory()
    }
  }

  const handleTouchStart = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    
    lastPosRef.current.x = x
    lastPosRef.current.y = y
    setIsDrawing(true)
  }

  const handleTouchMove = (e) => {
    e.preventDefault()
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    
    draw(x, y)
  }

  const handleTouchEnd = (e) => {
    e.preventDefault()
    if (isDrawing) {
      setIsDrawing(false)
      saveToHistory()
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push(canvas.toDataURL())
    setHistory(newHistory)
    setHistoryStep(newHistory.length - 1)
  }

  const exportAsPNG = () => {
    const canvas = canvasRef.current
    const link = document.createElement("a")
    link.download = "freehand-drawing.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  return (
    <div className="freehand-container">
      <div className="freehand-header">
        <h1><Paintbrush size={32} /> Freehand Drawing</h1>
        <p>Draw freely with various brush styles</p>
      </div>

      <div className="freehand-controls">
        <div className="control-section">
          <label className="section-label"><Palette size={18} /> Color</label>
          <div className="color-input-wrapper">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="color-picker"
            />
            <span 
              className="color-display" 
              style={{ backgroundColor: selectedColor }}
            ></span>
          </div>
        </div>

        <div className="control-section">
          <label className="section-label"><Paintbrush size={18} /> Brush</label>
          <select
            value={brushType}
            onChange={(e) => setBrushType(e.target.value)}
            className="brush-select"
          >
            {Object.entries(brushTypes).map(([key, value]) => (
              <option key={key} value={key}>
                {value.icon} {value.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-section">
          <label className="section-label"><Sliders size={18} /> Size: {lineWidth}px</label>
          <input
            type="range"
            min="1"
            max="50"
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            className="size-slider"
          />
        </div>

        <div className="control-actions">
          <button 
            className={`control-btn ${historyStep <= 0 ? "disabled" : ""}`}
            onClick={undo}
            disabled={historyStep <= 0}
            title="Undo"
          >
            <Undo2 size={20} />
          </button>

          <button 
            className={`control-btn ${historyStep >= history.length - 1 ? "disabled" : ""}`}
            onClick={redo}
            disabled={historyStep >= history.length - 1}
            title="Redo"
          >
            <Redo2 size={20} />
          </button>

          <button className="control-btn danger" onClick={clearCanvas} title="Clear Canvas">
            <Trash2 size={20} />
          </button>

          <button className="control-btn success" onClick={exportAsPNG} title="Export as PNG">
            <Download size={20} />
          </button>
        </div>
      </div>

      <div className="brush-preview-section">
        <p className="preview-label">Preview</p>
        <canvas
          className="brush-preview"
          width="180"
          height="50"
          ref={(canvas) => {
            if (canvas) {
              const ctx = canvas.getContext("2d")
              ctx.fillStyle = "#1a1a2e"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              
              const brushFunction = getBrushDrawFunction()
              brushFunction(ctx, 20, 25, 160, 25)
            }
          }}
        ></canvas>
      </div>

      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        width={1000}
        height={500}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  )
}