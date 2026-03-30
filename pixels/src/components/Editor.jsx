import React, { useState, useRef } from "react"
import "../styles/editor.css"
import { CirclePicker } from "react-color"
import DrawingPanel from "./DrawingPanel"
import { Play, RotateCcw, Palette, Grid3x3, Undo2, Redo2, Trash2 } from "lucide-react"

export default function Editor() {
  const [panelWidth, setPanelWidth] = useState(16)
  const [panelHeight, setPanelHeight] = useState(16)
  const [hideOptions, setHideOptions] = useState(false)
  const [hideDrawingPanel, setHideDrawingPanel] = useState(true)
  const [buttonText, setButtonText] = useState("Start Drawing")
  const [selectedColor, setColor] = useState("#e94560")
  const drawingPanelRef = useRef()

  // History for undo/redo
  const [history, setHistory] = useState([])
  const [historyStep, setHistoryStep] = useState(-1)

  function initializeDrawingPanel() {
    setHideOptions(!hideOptions)
    setHideDrawingPanel(!hideDrawingPanel)
    buttonText === "Start Drawing"
      ? setButtonText("Reset")
      : setButtonText("Start Drawing")

    // Initialize history when starting
    if (hideDrawingPanel && !hideOptions) {
      savePixelsToHistory()
    }
  }

  function changeColor(color) {
    setColor(color.hex)
  }

  // Save current pixel state to history
  const savePixelsToHistory = () => {
    if (drawingPanelRef.current) {
      const pixelState = drawingPanelRef.current.getPixelState?.()
      if (pixelState) {
        const newHistory = history.slice(0, historyStep + 1)
        newHistory.push(pixelState)
        setHistory(newHistory)
        setHistoryStep(newHistory.length - 1)
      }
    }
  }

  // Undo function
  const handleUndo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1
      setHistoryStep(newStep)
      if (drawingPanelRef.current) {
        drawingPanelRef.current.setPixelState?.(history[newStep])
      }
    }
  }

  // Redo function
  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1
      setHistoryStep(newStep)
      if (drawingPanelRef.current) {
        drawingPanelRef.current.setPixelState?.(history[newStep])
      }
    }
  }

  // Clear all pixels (actually reset)
  const handleClearCanvas = () => {
    if (drawingPanelRef.current) {
      drawingPanelRef.current.clearAllPixels?.()
      savePixelsToHistory()
    }
  }

  return (
    <div id="editor">
      <div className="editor-header">
        <h1><Grid3x3 size={32} /> Pixel Editor</h1>
        <p>Create pixel art with a customizable grid</p>
      </div>

      {hideDrawingPanel && (
        <div className="setup-section">
          <h2>Canvas Configuration</h2>
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
        </div>
      )}

      <button onClick={initializeDrawingPanel} className="primary-button">
        {buttonText === "Start Drawing" ? (
          <>
            <Play size={20} /> {buttonText}
          </>
        ) : (
          <>
            <RotateCcw size={20} /> {buttonText}
          </>
        )}
      </button>

      {hideOptions && (
        <div className="undo-redo-section">
          <button 
            className={`undo-redo-btn ${historyStep <= 0 ? "disabled" : ""}`}
            onClick={handleUndo}
            disabled={historyStep <= 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={20} />
            <span>Undo</span>
          </button>

          <button 
            className={`undo-redo-btn ${historyStep >= history.length - 1 ? "disabled" : ""}`}
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={20} />
            <span>Redo</span>
          </button>

          <button 
            className="undo-redo-btn clear-btn"
            onClick={handleClearCanvas}
            title="Clear All Pixels"
          >
            <Trash2 size={20} />
            <span>Clear</span>
          </button>

          <div className="history-info">
            <span>{historyStep + 1} / {history.length}</span>
          </div>
        </div>
      )}

      {hideOptions && (
        <div className="editor-tools">
          <div className="color-picker-section">
            <div className="color-header">
              <Palette size={20} />
              <p>Selected Color: <span style={{ color: selectedColor }}>■</span></p>
            </div>
            <CirclePicker color={selectedColor} onChangeComplete={changeColor} />
          </div>
        </div>
      )}

      {hideOptions && (
        <DrawingPanel
          ref={drawingPanelRef}
          width={panelWidth}
          height={panelHeight}
          selectedColor={selectedColor}
          onPixelChange={savePixelsToHistory}
        />
      )}
    </div>
  )
}