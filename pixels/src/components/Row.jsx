import React from "react"
import "../styles/row.css"
import Pixel from "./Pixel"

export default function Row({ width, selectedColor, rowIndex, pixelRefs, onPixelChange }) {
  let pixels = []
  for (let i = 0; i < width; i++) {
    const pixelKey = `pixel-${rowIndex}-${i}`
    pixels.push(
      <Pixel 
        key={i} 
        pixelKey={pixelKey}
        selectedColor={selectedColor}
        ref={(el) => {
          if (el) {
            pixelRefs.current[pixelKey] = el
          }
        }}
        onColorChange={onPixelChange}
      />
    )
  }

  return <div className="row">{pixels}</div>
}