import React, { useRef, useEffect, useState, useCallback } from "react";
import { Download, Play, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import "../styles/HandGestureCanvas.css";

const HandGestureCanvas = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const contextRef = useRef(null);
  const overlayContextRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const animationIdRef = useRef(null);

  const [isRunning, setIsRunning] = useState(false);
  const [color, setColor] = useState("#FFFFFF");
  const [brushSize, setBrushSize] = useState(5);
  const [isMuted, setIsMuted] = useState(false);
  const [confidence, setConfidence] = useState(0.7);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [lastPos, setLastPos] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState(null);
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });

  // Load MediaPipe scripts
  useEffect(() => {
    const loadScripts = async () => {
      try {
        console.log("📥 Loading MediaPipe scripts...");

        // Create and load drawing utils
        const drawScript = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js";
          script.async = true;
          script.onload = resolve;
          script.onerror = () => {
            console.error("Failed to load drawing_utils");
            reject(new Error("Failed to load drawing_utils"));
          };
          document.head.appendChild(script);
        });

        // Create and load hands
        const handsScript = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js";
          script.async = true;
          script.onload = resolve;
          script.onerror = () => {
            console.error("Failed to load hands");
            reject(new Error("Failed to load hands"));
          };
          document.head.appendChild(script);
        });

        // Create and load camera utils
        const cameraScript = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js";
          script.async = true;
          script.onload = resolve;
          script.onerror = () => {
            console.error("Failed to load camera_utils");
            reject(new Error("Failed to load camera_utils"));
          };
          document.head.appendChild(script);
        });

        // Wait for all scripts to load
        await Promise.all([drawScript, handsScript, cameraScript]);
        console.log("✅ All scripts loaded");

        // Wait a moment for globals to be set
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify everything is loaded
        if (!window.Hands || !window.Camera) {
          throw new Error("MediaPipe modules not available in window");
        }

        console.log("✅ MediaPipe modules available");

        // Initialize Hands
        const hands = new window.Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: confidence,
          minTrackingConfidence: confidence,
        });

        hands.onResults(onHandsResults);
        handsRef.current = hands;

        setInitialized(true);
        console.log("✅ Hand detection initialized");
      } catch (err) {
        console.error("❌ Error loading MediaPipe:", err);
        setError(`Failed to initialize: ${err.message}`);
      }
    };

    loadScripts();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, []);

  // Update confidence
  useEffect(() => {
    if (handsRef.current) {
      handsRef.current.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: confidence,
        minTrackingConfidence: confidence,
      });
    }
  }, [confidence]);

  const onHandsResults = useCallback(
    (results) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = contextRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const overlayCtx = overlayContextRef.current;

      if (!canvas || !video || !ctx || !overlayCanvas || !overlayCtx) {
        return;
      }

      // Update FPS counter
      fpsCounterRef.current.frames++;
      const now = Date.now();
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }

      // Draw video frame with mirror
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      // Clear overlay
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Process hands
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setHandsDetected(results.multiHandLandmarks.length);

        results.multiHandLandmarks.forEach((landmarks) => {
          // Draw skeleton
          if (showSkeleton) {
            const HAND_CONNECTIONS = [
              [0, 1], [1, 2], [2, 3], [3, 4],
              [0, 5], [5, 6], [6, 7], [7, 8],
              [0, 9], [9, 10], [10, 11], [11, 12],
              [0, 13], [13, 14], [14, 15], [15, 16],
              [0, 17], [17, 18], [18, 19], [19, 20],
            ];

            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 2;
            HAND_CONNECTIONS.forEach(([start, end]) => {
              const p1 = landmarks[start];
              const p2 = landmarks[end];
              ctx.beginPath();
              ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
              ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
              ctx.stroke();
            });

            ctx.fillStyle = "#FF0000";
            landmarks.forEach((landmark) => {
              ctx.beginPath();
              ctx.arc(
                landmark.x * canvas.width,
                landmark.y * canvas.height,
                4,
                0,
                2 * Math.PI
              );
              ctx.fill();
            });
          }

          // Index finger (landmark 8)
          const indexFinger = landmarks[8];
          const fingerX = indexFinger.x * canvas.width;
          const fingerY = indexFinger.y * canvas.height;

          // Draw cursor on overlay
          overlayCtx.strokeStyle = "#FFD700";
          overlayCtx.lineWidth = 3;
          overlayCtx.beginPath();
          overlayCtx.arc(fingerX, fingerY, 12, 0, 2 * Math.PI);
          overlayCtx.stroke();

          // Draw
          if (lastPos) {
            overlayCtx.strokeStyle = color;
            overlayCtx.lineWidth = brushSize;
            overlayCtx.lineCap = "round";
            overlayCtx.lineJoin = "round";
            overlayCtx.beginPath();
            overlayCtx.moveTo(lastPos.x, lastPos.y);
            overlayCtx.lineTo(fingerX, fingerY);
            overlayCtx.stroke();
          }

          setLastPos({ x: fingerX, y: fingerY });
        });
      } else {
        setHandsDetected(0);
      }
    },
    [color, brushSize, lastPos, showSkeleton]
  );

  const startCamera = async () => {
    try {
      if (!initialized || !handsRef.current) {
        setError("MediaPipe not ready. Please wait...");
        return;
      }

      setError(null);
      console.log("🎥 Requesting camera access...");

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      const video = videoRef.current;
      video.srcObject = stream;

      // Wait for video to load
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          console.log("📹 Video metadata loaded");
          video.play()
            .then(() => {
              console.log("▶️ Video playing");
              resolve();
            })
            .catch(reject);
        };
        video.onerror = () => reject(new Error("Video error"));
      });

      // Set canvas sizes
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      console.log(`Canvas size: ${canvas.width}x${canvas.height}`);

      // Get contexts
      const ctx = canvas.getContext("2d");
      const overlayCtx = overlayCanvas.getContext("2d");
      contextRef.current = ctx;
      overlayContextRef.current = overlayCtx;

      // Create Camera instance for MediaPipe
      const Camera = window.Camera;
      const camera = new Camera(video, {
        onFrame: async () => {
          if (handsRef.current) {
            try {
              await handsRef.current.send({ image: video });
            } catch (err) {
              console.error("Error sending frame to hands:", err);
            }
          }
        },
        width: video.videoWidth,
        height: video.videoHeight,
      });

      await camera.start();
      cameraRef.current = camera;

      setIsRunning(true);
      console.log("✅ Camera started successfully");
    } catch (err) {
      console.error("❌ Camera error:", err);
      setError(`Camera error: ${err.message}`);
    }
  };

  const stopCamera = () => {
    try {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      setIsRunning(false);
      setLastPos(null);
      setHandsDetected(0);
      console.log("⏹️ Camera stopped");
    } catch (err) {
      console.error("Error stopping camera:", err);
    }
  };

  const clearDrawing = () => {
    const overlayCtx = overlayContextRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCtx && overlayCanvas) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");

    tempCtx.drawImage(canvas, 0, 0);
    tempCtx.drawImage(overlayCanvas, 0, 0);

    const link = document.createElement("a");
    link.href = tempCanvas.toDataURL("image/png");
    link.download = `hand-gesture-drawing-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="hand-gesture-container">
      <div className="gesture-header">
        <h2>✋ Hand Gesture Drawing Canvas</h2>
        <p>Capture hand motion and draw on screen with camera feed visible</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="gesture-content">
        {/* Canvas Area */}
        <div className="canvas-wrapper">
          <div className="canvas-container">
            <video
              ref={videoRef}
              style={{ display: "none" }}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="main-canvas"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 1,
              }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="overlay-canvas"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 2,
              }}
            />
            {!isRunning && (
              <div className="canvas-overlay">
                <div className="overlay-content">
                  <div className="overlay-icon">📷</div>
                  <h3>Hand Gesture Drawing</h3>
                  <p>
                    {!initialized
                      ? "⏳ Loading MediaPipe..."
                      : "Click START to enable camera"}
                  </p>
                </div>
              </div>
            )}
            {isRunning && (
              <div className="live-indicator">
                <span className="live-dot"></span>
                LIVE
              </div>
            )}
          </div>
        </div>

        {/* Control Panel */}
        <div className="control-panel">
          {/* Camera Controls */}
          <section className="control-section">
            <h3 className="section-title">📷 Camera</h3>
            <div className="button-group">
              <button
                onClick={startCamera}
                disabled={!initialized || isRunning}
                className="btn btn-primary"
              >
                <Play size={18} />
                <span>START</span>
              </button>
              <button
                onClick={stopCamera}
                disabled={!isRunning}
                className="btn btn-danger"
              >
                <Square size={18} />
                <span>STOP</span>
              </button>
            </div>
          </section>

          {/* Drawing Settings */}
          <section className="control-section">
            <h3 className="section-title">🎨 Drawing</h3>

            <div className="control-item">
              <label>Color</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="color-input"
                />
                <span className="color-code">{color}</span>
              </div>
            </div>

            <div className="control-item">
              <label>Size: {brushSize}px</label>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="slider"
              />
            </div>
          </section>

          {/* Advanced Settings */}
          <section className="control-section">
            <h3 className="section-title">⚙️ Advanced</h3>

            <div className="control-item">
              <label>Confidence: {Math.round(confidence * 100)}%</label>
              <input
                type="range"
                min="0.3"
                max="0.9"
                step="0.1"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className="slider"
              />
            </div>

            <div className="toggle-item">
              <label>Skeleton</label>
              <button
                onClick={() => setShowSkeleton(!showSkeleton)}
                className={`toggle-btn ${showSkeleton ? "active" : ""}`}
              >
                {showSkeleton ? "ON" : "OFF"}
              </button>
            </div>

            <div className="toggle-item">
              <label>Sound</label>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`toggle-btn ${!isMuted ? "active" : ""}`}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          </section>

          {/* Actions */}
          <section className="control-section">
            <h3 className="section-title">📥 Actions</h3>
            <div className="button-group">
              <button
                onClick={clearDrawing}
                disabled={!isRunning}
                className="btn btn-warning"
              >
                <Trash2 size={18} />
                <span>CLEAR</span>
              </button>
              <button
                onClick={downloadImage}
                disabled={!isRunning}
                className="btn btn-success"
              >
                <Download size={18} />
                <span>SAVE</span>
              </button>
            </div>
          </section>

          {/* Status */}
          <section className="control-section status-panel">
            <h3 className="section-title">📊 Status</h3>
            <div className="status-item">
              <span>Camera:</span>
              <span className={isRunning ? "active" : ""}>
                {isRunning ? "🔴 LIVE" : "⚪ OFF"}
              </span>
            </div>
            <div className="status-item">
              <span>Hands:</span>
              <span>{handsDetected}</span>
            </div>
            <div className="status-item">
              <span>FPS:</span>
              <span>{fps}</span>
            </div>
          </section>
        </div>
      </div>

      <div className="info-footer">
        <p>
          💡 Point your index finger at the camera and move it to draw. The camera feed will be visible in the background with your hand skeleton overlay.
        </p>
      </div>
    </div>
  );
};

export default HandGestureCanvas;