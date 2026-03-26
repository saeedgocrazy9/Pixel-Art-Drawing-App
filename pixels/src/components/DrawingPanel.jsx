import React, { useRef } from "react"
import "../styles/drawingPanel.css"
import Row from "./Row"
import html2canvas from "html2canvas"

export default function DrawingPanel({ width, height, selectedColor }) {
  const panelRef = useRef()

  async function exportAsPNG() {
    const canvas = await html2canvas(panelRef.current, {
      useCORS: true,
      backgroundColor: null,
    })
    const link = document.createElement("a")
    link.download = "pixel-art.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  let rows = []
  for (let i = 0; i < height; i++) {
    rows.push(
      <Row key={i} width={width} selectedColor={selectedColor} />
    )
  }

  return (
    <div id="drawingPanel">
      <div id="pixels" ref={panelRef}>
        {rows}
      </div>
      <button className="button" onClick={exportAsPNG}>
        💾 Export as PNG
      </button>
    </div>
  )
}