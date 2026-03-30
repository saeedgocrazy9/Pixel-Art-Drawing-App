import React, { useState, useImperativeHandle, forwardRef } from "react"
import "../styles/pixel.css"

const Pixel = forwardRef(({ selectedColor, pixelKey, onColorChange }, ref) => {
  const [pixelColor, setPixelColor] = useState("#1a1a2e")
  const [oldColor, setOldColor] = useState("#1a1a2e")
  const [canChangeColor, setCanChangeColor] = useState(true)

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getColor: () => pixelColor,
    setColor: (color) => setPixelColor(color),
    getCanChange: () => canChangeColor,
    setCanChange: (value) => setCanChangeColor(value),
    resetToDefault: () => {
      setPixelColor("#1a1a2e")
      setOldColor("#1a1a2e")
      setCanChangeColor(true)
    }
  }))

  function applyColor() {
    setPixelColor(selectedColor)
    setCanChangeColor(false)
    onColorChange?.()
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
      title="Click to paint, hover to preview"
    />
  )
})

Pixel.displayName = "Pixel"

export default Pixel