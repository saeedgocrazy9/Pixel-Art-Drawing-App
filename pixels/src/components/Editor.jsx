import React, { useState } from "react"
import "../styles/editor.css"
import { CirclePicker } from "react-color"
import DrawingPanel from "./DrawingPanel"

export default function Editor() {
  const [panelWidth, setPanelWidth] = useState(16)
  const [panelHeight, setPanelHeight] = useState(16)
  const [hideOptions, setHideOptions] = useState(false)
  const [hideDrawingPanel, setHideDrawingPanel] = useState(true)
  const [buttonText, setButtonText] = useState("Start Drawing")
  const [selectedColor, setColor] = useState("#f44336")

  function initializeDrawingPanel() {
    setHideOptions(!hideOptions)
    setHideDrawingPanel(!hideDrawingPanel)
    buttonText === "Start Drawing"
      ? setButtonText("Reset")
      : setButtonText("Start Drawing")
  }

  function changeColor(color) {
    setColor(color.hex)
  }

  return (
    <div id="editor">
      <h1>🎨 Pixel Editor</h1>

      {hideDrawingPanel && <h2>Set Canvas Size</h2>}

      {hideDrawingPanel && (
        <div id="options">
          <div className="option">
            <label>Width</label>
            <input
              type="number"
              min="1"
              max="64"
              className="panelInput"
              defaultValue={panelWidth}
              onChange={e => setPanelWidth(e.target.value)}
            />
          </div>
          <div className="option">
            <label>Height</label>
            <input
              type="number"
              min="1"
              max="64"
              className="panelInput"
              defaultValue={panelHeight}
              onChange={e => setPanelHeight(e.target.value)}
            />
          </div>
        </div>
      )}

      <button onClick={initializeDrawingPanel} className="button">
        {buttonText}
      </button>

      {hideOptions && (
        <div className="color-picker-wrapper">
          <p>Selected color: <span style={{ color: selectedColor }}>■</span></p>
          <CirclePicker color={selectedColor} onChangeComplete={changeColor} />
        </div>
      )}

      {hideOptions && (
        <DrawingPanel
          width={panelWidth}
          height={panelHeight}
          selectedColor={selectedColor}
        />
      )}
    </div>
  )
}