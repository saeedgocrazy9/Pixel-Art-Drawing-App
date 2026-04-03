import React, { useRef, useEffect, useState, useCallback } from "react";
import { Download, Play, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import "../styles/HandGestureCanvas.css";

// Adaptive smoothing filter — Kalman-inspired, handles both slow and fast movement
class AdaptiveFilter {
  constructor() {
    this.x = null;
    this.y = null;
    this.vx = 0;
    this.vy = 0;
    // Process noise (how much we trust prediction vs measurement)
    this.Q = 0.008;
    // Measurement noise (how noisy the raw input is)
    this.R = 0.02;
    this.Px = 1;
    this.Py = 1;
  }

  update(rawX, rawY) {
    if (this.x === null) {
      this.x = rawX;
      this.y = rawY;
      return { x: rawX, y: rawY };
    }

    // Predict (motion-adaptive process noise)
    const motion = Math.hypot(rawX - this.x, rawY - this.y);
    const adaptiveQ = this.Q + Math.min(0.02, motion * 0.0002);
    const predX = this.x + this.vx;
    const predY = this.y + this.vy;
    const predPx = this.Px + adaptiveQ;
    const predPy = this.Py + adaptiveQ;

    // Kalman gain (trust measurement more when movement is fast)
    const adaptiveR = Math.max(0.004, this.R - Math.min(0.015, motion * 0.00015));
    const Kx = predPx / (predPx + adaptiveR);
    const Ky = predPy / (predPy + adaptiveR);

    // Update
    const newX = predX + Kx * (rawX - predX);
    const newY = predY + Ky * (rawY - predY);

    // Velocity estimation (for gesture intent detection)
    this.vx = this.vx * 0.7 + (newX - this.x) * 0.3;
    this.vy = this.vy * 0.7 + (newY - this.y) * 0.3;

    this.Px = (1 - Kx) * predPx;
    this.Py = (1 - Ky) * predPy;
    this.x = newX;
    this.y = newY;

    return { x: newX, y: newY };
  }

  reset() {
    this.x = null;
    this.y = null;
    this.vx = 0;
    this.vy = 0;
    this.Px = 1;
    this.Py = 1;
  }

  getSpeed() {
    return Math.hypot(this.vx, this.vy);
  }
}

// Bézier stroke renderer — draws smooth curves through point history
class StrokeRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.points = [];
    this.maxHistory = 4;
  }

  addPoint(x, y, color, size) {
    this.points.push({ x, y, color, size });
    if (this.points.length > this.maxHistory) {
      this.points.shift();
    }
    this._render();
  }

  _render() {
    const pts = this.points;
    if (pts.length < 2) return;

    const ctx = this.ctx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (pts.length === 2) {
      ctx.strokeStyle = pts[pts.length - 1].color;
      ctx.lineWidth = pts[pts.length - 1].size;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      return;
    }

    // Quadratic Bézier through midpoints for smooth strokes
    const last = pts[pts.length - 1];
    ctx.strokeStyle = last.color;
    ctx.lineWidth = last.size;

    ctx.beginPath();
    const p0 = pts[pts.length - 3] || pts[pts.length - 2];
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];

    const mx1 = (p0.x + p1.x) / 2;
    const my1 = (p0.y + p1.y) / 2;
    const mx2 = (p1.x + p2.x) / 2;
    const my2 = (p1.y + p2.y) / 2;

    ctx.moveTo(mx1, my1);
    ctx.quadraticCurveTo(p1.x, p1.y, mx2, my2);
    ctx.stroke();
  }

  reset() {
    this.points = [];
  }
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
];

const HandGestureCanvas = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const contextRef = useRef(null);
  const overlayContextRef = useRef(null);
  const handsRef = useRef(null);
  const streamRef = useRef(null);
  const isRunningRef = useRef(false);
  const animationIdRef = useRef(null);
  const processingFrameRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);

  // Per-hand state: filter + pinch hysteresis + stroke renderer
  const handStateRef = useRef({});
  const lostFramesRef = useRef(0);
  const drawingBufferCanvasRef = useRef(null);
  const drawingBufferContextRef = useRef(null);
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });
  const colorRef = useRef("#FFFFFF");
  const brushSizeRef = useRef(5);
  const showSkeletonRef = useRef(true);
  const pinchOnlyRef = useRef(false);
  const confidenceRef = useRef(0.5);
  const confidenceDebounceRef = useRef(null);

  const [isRunning, setIsRunning] = useState(false);
  const [color, setColor] = useState("#FFFFFF");
  const [brushSize, setBrushSize] = useState(5);
  const [isMuted, setIsMuted] = useState(false);
  const [confidence, setConfidence] = useState(0.5);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [pinchOnly, setPinchOnly] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [drawMode, setDrawMode] = useState("HOVER");
  const [fps, setFps] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { showSkeletonRef.current = showSkeleton; }, [showSkeleton]);
  useEffect(() => { pinchOnlyRef.current = pinchOnly; }, [pinchOnly]);

  useEffect(() => {
    confidenceRef.current = confidence;
    // Debounce setOptions to avoid disrupting active MediaPipe session
    if (confidenceDebounceRef.current) {
      clearTimeout(confidenceDebounceRef.current);
    }
    confidenceDebounceRef.current = setTimeout(() => {
      if (handsRef.current) {
        handsRef.current.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: confidence,
          minTrackingConfidence: confidence,
        });
      }
    }, 400);
  }, [confidence]);

  const dist2D = (p1, p2, w, h) => {
    const dx = (p1.x - p2.x) * w;
    const dy = (p1.y - p2.y) * h;
    return Math.hypot(dx, dy);
  };

  const onHandsResults = useCallback((results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = contextRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayContextRef.current;
    if (!canvas || !video || !ctx || !overlayCanvas || !overlayCtx) return;

    // Skip duplicate frames (important for perf at high fps)
    if (video.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = video.currentTime;

    // FPS counter
    fpsCounterRef.current.frames += 1;
    const now = Date.now();
    if (now - fpsCounterRef.current.lastTime >= 1000) {
      setFps(fpsCounterRef.current.frames);
      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastTime = now;
    }

    // Draw mirrored video
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (drawingBufferCanvasRef.current) {
      overlayCtx.drawImage(drawingBufferCanvasRef.current, 0, 0);
    }

    const W = canvas.width;
    const H = canvas.height;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      lostFramesRef.current = 0;
      setHandsDetected(results.multiHandLandmarks.length);

      const activeHandKeys = new Set();
      let anyDrawing = false;

      results.multiHandLandmarks.forEach((landmarks, index) => {
        const handedness = results.multiHandedness?.[index];
        const handLabel =
          handedness?.label ??
          handedness?.classification?.[0]?.label ??
          `hand-${index}`;
        const handKey = `${handLabel}-${index}`;
        activeHandKeys.add(handKey);

        if (!handStateRef.current[handKey]) {
          handStateRef.current[handKey] = {
            filter: new AdaptiveFilter(),
            renderer: null, // created lazily when buffer context exists
            pinchFrames: 0,
            releaseFrames: 0,
            isPinching: false,
            indexExtFrames: 0,
            isIndexExtended: false,
            wasDrawing: false,
          };
        }

        const state = handStateRef.current[handKey];

        // Lazy-init renderer
        if (!state.renderer && drawingBufferContextRef.current) {
          state.renderer = new StrokeRenderer(drawingBufferContextRef.current);
        }

        // ── Skeleton ──────────────────────────────────────────────
        if (showSkeletonRef.current) {
          overlayCtx.strokeStyle = "rgba(0, 255, 102, 0.75)";
          overlayCtx.lineWidth = 2;
          HAND_CONNECTIONS.forEach(([s, e]) => {
            const p1 = landmarks[s];
            const p2 = landmarks[e];
            overlayCtx.beginPath();
            overlayCtx.moveTo((1 - p1.x) * W, p1.y * H);
            overlayCtx.lineTo((1 - p2.x) * W, p2.y * H);
            overlayCtx.stroke();
          });
          overlayCtx.fillStyle = "rgba(0, 255, 102, 0.9)";
          landmarks.forEach((lm) => {
            overlayCtx.beginPath();
            overlayCtx.arc((1 - lm.x) * W, lm.y * H, 3, 0, Math.PI * 2);
            overlayCtx.fill();
          });
        }

        // ── Landmark positions ────────────────────────────────────
        const indexTip = landmarks[8];
        const indexMid = landmarks[6];
        const thumbTip = landmarks[4];
        const wrist = landmarks[0];
        const midMcp = landmarks[9];

        const rawX = Math.min(W, Math.max(0, (1 - indexTip.x) * W));
        const rawY = Math.min(H, Math.max(0, indexTip.y * H));

        // Adaptive Kalman filter
        const { x: fingerX, y: fingerY } = state.filter.update(rawX, rawY);

        // ── Pinch detection with hysteresis ───────────────────────
        const palmScale = Math.max(30, dist2D(wrist, midMcp, W, H));
        const pinchDist = dist2D(indexTip, thumbTip, W, H);
        const pinchThreshold = Math.max(20, palmScale * 0.30);
        const releaseThreshold = pinchThreshold * 1.45; // wider release band

        if (pinchDist < pinchThreshold) {
          state.pinchFrames = Math.min(state.pinchFrames + 1, 10);
          state.releaseFrames = 0;
        } else if (pinchDist > releaseThreshold) {
          state.releaseFrames = Math.min(state.releaseFrames + 1, 10);
          state.pinchFrames = Math.max(state.pinchFrames - 1, 0);
        }

        // Require 2 frames to activate, 3 to deactivate (prevents flicker)
        if (!state.isPinching && state.pinchFrames >= 2) state.isPinching = true;
        if (state.isPinching && state.releaseFrames >= 3) {
          state.isPinching = false;
          state.pinchFrames = 0;
          state.releaseFrames = 0;
        }

        // ── Index-extended detection with hysteresis ──────────────
        const indexExtended = indexTip.y < indexMid.y - 0.02;
        if (indexExtended) {
          state.indexExtFrames = Math.min(state.indexExtFrames + 1, 8);
        } else {
          state.indexExtFrames = Math.max(state.indexExtFrames - 2, 0);
        }
        state.isIndexExtended = state.indexExtFrames >= 2;

        const isDrawing = pinchOnlyRef.current
          ? state.isPinching
          : (state.isPinching || state.isIndexExtended);

        if (isDrawing) anyDrawing = true;

        // ── Cursor ring ───────────────────────────────────────────
        const speed = state.filter.getSpeed();
        const cursorColor = isDrawing ? "#00FF7F" : "#FFD700";
        const innerR = isDrawing ? 10 : 13;
        const outerR = isDrawing ? 16 : 20;

        overlayCtx.strokeStyle = cursorColor;
        overlayCtx.lineWidth = isDrawing ? 2.5 : 2;
        overlayCtx.beginPath();
        overlayCtx.arc(fingerX, fingerY, innerR, 0, Math.PI * 2);
        overlayCtx.stroke();

        overlayCtx.strokeStyle = isDrawing
          ? "rgba(0, 255, 127, 0.4)"
          : "rgba(255, 215, 0, 0.35)";
        overlayCtx.lineWidth = 1.5;
        overlayCtx.beginPath();
        overlayCtx.arc(fingerX, fingerY, outerR, 0, Math.PI * 2);
        overlayCtx.stroke();

        // ── Draw stroke ───────────────────────────────────────────
        if (isDrawing && state.renderer) {
          // Gap detection: if hand teleported, reset stroke history
          const prevX = state.filter.x;
          const prevY = state.filter.y;
          const jump = Math.hypot(fingerX - (state._lastX ?? fingerX), fingerY - (state._lastY ?? fingerY));
          if (jump > palmScale * 1.2 && state.wasDrawing) {
            state.renderer.reset();
          }

          state.renderer.addPoint(fingerX, fingerY, colorRef.current, brushSizeRef.current);
        } else {
          // Reset stroke history on gesture release so next stroke starts fresh
          if (state.wasDrawing && state.renderer) {
            state.renderer.reset();
          }
        }

        state._lastX = fingerX;
        state._lastY = fingerY;
        state.wasDrawing = isDrawing;
      });

      // Remove stale hand states
      Object.keys(handStateRef.current).forEach((key) => {
        if (!activeHandKeys.has(key)) {
          handStateRef.current[key].filter.reset();
          if (handStateRef.current[key].renderer) handStateRef.current[key].renderer.reset();
          delete handStateRef.current[key];
        }
      });

      setDrawMode(anyDrawing ? "DRAW" : "HOVER");
    } else {
      lostFramesRef.current += 1;
      if (lostFramesRef.current > 5) {
        setHandsDetected(0);
        setDrawMode("HOVER");
        Object.values(handStateRef.current).forEach((s) => {
          s.filter.reset();
          if (s.renderer) s.renderer.reset();
        });
        handStateRef.current = {};
      }
    }
  }, []);

  useEffect(() => {
    const loadScripts = async () => {
      try {
        setError(null);
        await Promise.all([
          new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js";
            s.async = true;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Failed to load drawing_utils"));
            document.head.appendChild(s);
          }),
          new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js";
            s.async = true;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Failed to load hands"));
            document.head.appendChild(s);
          }),
        ]);

        await new Promise((r) => setTimeout(r, 300));
        if (!window.Hands) throw new Error("MediaPipe Hands not available");

        const hands = new window.Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: confidenceRef.current,
          minTrackingConfidence: confidenceRef.current,
        });

        hands.onResults(onHandsResults);
        handsRef.current = hands;
        setInitialized(true);
      } catch (err) {
        setError(`Failed to initialize: ${err.message}`);
      }
    };

    loadScripts();

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      isRunningRef.current = false;
    };
  }, [onHandsResults]);

  const startCamera = async () => {
    try {
      if (!initialized || !handsRef.current) {
        setError("MediaPipe not ready. Please wait...");
        return;
      }
      if (isRunningRef.current) return;
      setError(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) throw new Error("Video element not found");

      video.srcObject = stream;
      streamRef.current = stream;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
        video.onerror = () => reject(new Error("Video error"));
      });

      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!canvas || !overlayCanvas) throw new Error("Canvas element not found");

      const W = video.videoWidth || 1280;
      const H = video.videoHeight || 720;

      canvas.width = W;
      canvas.height = H;
      overlayCanvas.width = W;
      overlayCanvas.height = H;

      const buf = document.createElement("canvas");
      buf.width = W;
      buf.height = H;
      drawingBufferCanvasRef.current = buf;
      drawingBufferContextRef.current = buf.getContext("2d");

      contextRef.current = canvas.getContext("2d");
      overlayContextRef.current = overlayCanvas.getContext("2d");

      isRunningRef.current = true;
      processingFrameRef.current = false;
      lastVideoTimeRef.current = -1;
      fpsCounterRef.current = { frames: 0, lastTime: Date.now() };
      lostFramesRef.current = 0;
      handStateRef.current = {};

      const processFrame = async () => {
        if (!isRunningRef.current || !handsRef.current) return;

        if (processingFrameRef.current) {
          animationIdRef.current = requestAnimationFrame(processFrame);
          return;
        }

        processingFrameRef.current = true;
        try {
          await handsRef.current.send({ image: videoRef.current });
        } catch (e) {
          console.error("Frame send error:", e);
        } finally {
          processingFrameRef.current = false;
        }

        animationIdRef.current = requestAnimationFrame(processFrame);
      };

      processFrame();
      setIsRunning(true);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found. Please connect a webcam and try again.");
      } else if (err.name === "NotReadableError") {
        setError("Camera is busy in another app. Close other camera apps and retry.");
      } else {
        setError(`Camera error: ${err.message}`);
      }
      isRunningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
  };

  const stopCamera = () => {
    try {
      isRunningRef.current = false;
      processingFrameRef.current = false;
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsRunning(false);
      setHandsDetected(0);
      setDrawMode("HOVER");
      setFps(0);
      handStateRef.current = {};
      lostFramesRef.current = 0;
    } catch (err) {
      console.error("Error stopping camera:", err);
    }
  };

  const clearDrawing = () => {
    const buf = drawingBufferCanvasRef.current;
    const bufCtx = drawingBufferContextRef.current;
    const overlay = overlayCanvasRef.current;
    const overlayCtx = overlayContextRef.current;
    if (bufCtx && buf) bufCtx.clearRect(0, 0, buf.width, buf.height);
    if (overlayCtx && overlay) overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    // Reset all stroke histories so strokes don't bleed after clear
    Object.values(handStateRef.current).forEach((s) => {
      if (s.renderer) s.renderer.reset();
    });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const buf = drawingBufferCanvasRef.current;
    if (!canvas) return;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tmpCtx = tmp.getContext("2d");
    tmpCtx.drawImage(canvas, 0, 0);
    if (buf) tmpCtx.drawImage(buf, 0, 0);
    const link = document.createElement("a");
    link.href = tmp.toDataURL("image/png");
    link.download = `hand-gesture-drawing-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="hand-gesture-container">
      <div className="gesture-header">
        <h2>✋ Hand Gesture Drawing Canvas</h2>
        <p>Move index finger to draw. Pinch mode can be enabled for precision.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="gesture-content">
        <div className="canvas-wrapper">
          <div className="canvas-container">
            <video ref={videoRef} style={{ display: "none" }} autoPlay playsInline muted />
            <canvas ref={canvasRef} className="main-canvas" style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }} />
            <canvas ref={overlayCanvasRef} className="overlay-canvas" style={{ position: "absolute", top: 0, left: 0, zIndex: 2 }} />

            {!isRunning && (
              <div className="canvas-overlay">
                <div className="overlay-content">
                  <div className="overlay-icon">📷</div>
                  <h3>Hand Gesture Drawing</h3>
                  <p>{!initialized ? "⏳ Loading MediaPipe..." : "Click START to enable camera"}</p>
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

        <div className="control-panel">
          <section className="control-section">
            <h3 className="section-title">📷 Camera</h3>
            <div className="button-group">
              <button onClick={startCamera} disabled={!initialized || isRunning} className="btn btn-primary">
                <Play size={18} /><span>START</span>
              </button>
              <button onClick={stopCamera} disabled={!isRunning} className="btn btn-danger">
                <Square size={18} /><span>STOP</span>
              </button>
            </div>
          </section>

          <section className="control-section">
            <h3 className="section-title">🎨 Drawing</h3>
            <div className="control-item">
              <label>Color</label>
              <div className="color-input-group">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="color-input" />
                <span className="color-code">{color}</span>
              </div>
            </div>
            <div className="control-item">
              <label>Size: {brushSize}px</label>
              <input type="range" min="1" max="50" step="1" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} className="slider" />
            </div>
          </section>

          <section className="control-section">
            <h3 className="section-title">⚙️ Advanced</h3>
            <div className="control-item">
              <label>Confidence: {Math.round(confidence * 100)}%</label>
              <input type="range" min="0.3" max="0.9" step="0.1" value={confidence} onChange={(e) => setConfidence(parseFloat(e.target.value))} className="slider" />
            </div>
            <div className="toggle-item">
              <label>Skeleton</label>
              <button onClick={() => setShowSkeleton(!showSkeleton)} className={`toggle-btn ${showSkeleton ? "active" : ""}`}>
                {showSkeleton ? "ON" : "OFF"}
              </button>
            </div>
            <div className="toggle-item">
              <label>Pinch Only</label>
              <button onClick={() => setPinchOnly(!pinchOnly)} className={`toggle-btn ${pinchOnly ? "active" : ""}`}>
                {pinchOnly ? "ON" : "OFF"}
              </button>
            </div>
            <div className="toggle-item">
              <label>Sound</label>
              <button onClick={() => setIsMuted(!isMuted)} className={`toggle-btn ${!isMuted ? "active" : ""}`}>
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          </section>

          <section className="control-section">
            <h3 className="section-title">📥 Actions</h3>
            <div className="button-group">
              <button onClick={clearDrawing} disabled={!isRunning} className="btn btn-warning">
                <Trash2 size={18} /><span>CLEAR</span>
              </button>
              <button onClick={downloadImage} disabled={!isRunning} className="btn btn-success">
                <Download size={18} /><span>SAVE</span>
              </button>
            </div>
          </section>

          <section className="control-section status-panel">
            <h3 className="section-title">📊 Status</h3>
            <div className="status-item">
              <span>Camera:</span>
              <span className={isRunning ? "active" : ""}>{isRunning ? "🔴 LIVE" : "⚪ OFF"}</span>
            </div>
            <div className="status-item">
              <span>Hands:</span>
              <span>{handsDetected}</span>
            </div>
            <div className="status-item">
              <span>Mode:</span>
              <span className={drawMode === "DRAW" ? "active" : ""}>{drawMode}</span>
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
          💡 Extend your index finger to draw freely, or pinch thumb + index for precision mode. The Kalman filter smooths jitter without adding lag.
        </p>
      </div>
    </div>
  );
};

export default HandGestureCanvas;