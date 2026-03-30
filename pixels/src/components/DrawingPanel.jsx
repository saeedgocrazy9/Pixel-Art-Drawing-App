import React, { useRef, useState, useImperativeHandle, forwardRef } from "react"
import "../styles/drawingPanel.css"
import Row from "./Row"
import html2canvas from "html2canvas"
import { Download, Check, AlertCircle, Loader } from "lucide-react"

const DrawingPanel = forwardRef(({ width, height, selectedColor, onPixelChange }, ref) => {
  const panelRef = useRef()
  const pixelRefs = useRef({})
  const [exportState, setExportState] = useState("idle")
  const [exportMessage, setExportMessage] = useState("")

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getPixelState: () => {
      const state = {}
      Object.keys(pixelRefs.current).forEach(key => {
        const pixel = pixelRefs.current[key]
        if (pixel) {
          state[key] = {
            color: pixel.getColor?.(),
            canChange: pixel.getCanChange?.()
          }
        }
      })
      return state
    },
    setPixelState: (state) => {
      Object.keys(state).forEach(key => {
        const pixel = pixelRefs.current[key]
        if (pixel) {
          pixel.setColor?.(state[key].color)
          pixel.setCanChange?.(state[key].canChange)
        }
      })
    },
    clearAllPixels: () => {
      Object.keys(pixelRefs.current).forEach(key => {
        const pixel = pixelRefs.current[key]
        if (pixel) {
          pixel.resetToDefault?.()
        }
      })
    }
  }))

  async function exportAsPNG() {
    try {
      setExportState("loading")
      setExportMessage("Preparing your artwork...")

      await new Promise(resolve => setTimeout(resolve, 500))

      const canvas = await html2canvas(panelRef.current, {
        useCORS: true,
        backgroundColor: null,
        scale: 3,
      })

      setExportMessage("Generating PNG...")

      canvas.toBlob((blob) => {
        const link = document.createElement("a")
        const timestamp = new Date().toISOString().slice(0, 10)
        const time = new Date().toTimeString().slice(0, 5).replace(":", "")
        link.download = `pixel-art-${timestamp}-${time}.png`
        link.href = URL.createObjectURL(blob)
        link.click()
        URL.revokeObjectURL(link.href)

        setExportState("success")
        setExportMessage("Downloaded successfully! 🎉")

        setTimeout(() => {
          setExportState("idle")
          setExportMessage("")
        }, 2500)
      }, "image/png", 1)
    } catch (error) {
      setExportState("error")
      setExportMessage("Failed to export. Try again!")
      console.error("Export error:", error)

      setTimeout(() => {
        setExportState("idle")
        setExportMessage("")
      }, 3000)
    }
  }

  let rows = []
  for (let i = 0; i < height; i++) {
    rows.push(
      <Row 
        key={i} 
        width={width} 
        selectedColor={selectedColor}
        rowIndex={i}
        pixelRefs={pixelRefs}
        onPixelChange={onPixelChange}
      />
    )
  }

  return (
    <div id="drawingPanel">
      <div id="pixels" ref={panelRef}>
        {rows}
      </div>

      <div className="export-container">
        <button
          className={`export-btn ${exportState}`}
          onClick={exportAsPNG}
          disabled={exportState === "loading"}
          title={exportState === "loading" ? "Exporting..." : "Download your pixel art"}
        >
          <div className="export-btn-content">
            {exportState === "idle" && (
              <>
                <Download size={24} className="export-icon" />
                <span className="export-text">Export as PNG</span>
              </>
            )}

            {exportState === "loading" && (
              <>
                <Loader size={24} className="export-icon spinner" />
                <span className="export-text">Exporting...</span>
              </>
            )}

            {exportState === "success" && (
              <>
                <Check size={24} className="export-icon" />
                <span className="export-text">Downloaded!</span>
              </>
            )}

            {exportState === "error" && (
              <>
                <AlertCircle size={24} className="export-icon" />
                <span className="export-text">Export Failed</span>
              </>
            )}
          </div>

          <div className="export-btn-shine"></div>
        </button>

        {exportMessage && (
          <div className={`export-notification ${exportState}`}>
            <div className="notification-icon">
              {exportState === "loading" && <Loader size={18} className="spinner" />}
              {exportState === "success" && <Check size={18} />}
              {exportState === "error" && <AlertCircle size={18} />}
            </div>
            <span className="notification-text">{exportMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
})

DrawingPanel.displayName = "DrawingPanel"

export default DrawingPanel