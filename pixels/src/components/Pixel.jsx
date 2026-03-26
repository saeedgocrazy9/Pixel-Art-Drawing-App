import React, { useState } from "react"
import "../styles/pixel.css"

export default function Pixel({ selectedColor }) {
  const [pixelColor, setPixelColor] = useState("#1a1a2e")
  const [oldColor, setOldColor] = useState("#1a1a2e")
  const [canChangeColor, setCanChangeColor] = useState(true)

  function applyColor() {
    setPixelColor(selectedColor)
    setCanChangeColor(false)
  }

  function changeColorOnHover() {
    setOldColor(pixelColor)
    setPixelColor(selectedColor)
  }

  function resetColor() {
    if (canChangeColor) {
      setPixelColor(oldColor)
    }
    setCanChangeColor(true)
  }

  return (
    <div
      className="pixel"
      onClick={applyColor}
      onMouseEnter={changeColorOnHover}
      onMouseLeave={resetColor}
      style={{ backgroundColor: pixelColor }}
    />
  )
}