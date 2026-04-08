import React, { useRef, useEffect, useState, useCallback } from "react";
import { Download, Play, Square, Trash2, Volume2, VolumeX } from "lucide-react";

// ─── One Euro Filter: Best-in-class low-latency smoothing ─────────────────────
class OneEuroFilter {
  constructor(freq = 60, minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  alpha(cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / this.freq;
    return 1.0 / (1.0 + tau / te);
  }

  filter(x, timestamp) {
    if (this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = timestamp;
      return x;
    }
    const elapsed = Math.max(0.001, (timestamp - this.tPrev) / 1000);
    this.freq = 1.0 / elapsed;
    this.tPrev = timestamp;

    const dx = (x - this.xPrev) * this.freq;
    const aDeriv = this.alpha(this.dCutoff);
    const dxHat = aDeriv * dx + (1 - aDeriv) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff);
    const xHat = a * x + (1 - a) * this.xPrev;

    this.dxPrev = dxHat;
    this.xPrev = xHat;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  getSpeed() {
    return Math.abs(this.dxPrev);
  }
}

class Point2DFilter {
  constructor() {
    // Tuned for hand tracking: low minCutoff = smooth, high beta = responsive
    this.fx = new OneEuroFilter(60, 1.5, 0.01, 1.0);
    this.fy = new OneEuroFilter(60, 1.5, 0.01, 1.0);
  }
  filter(x, y, t) {
    return { x: this.fx.filter(x, t), y: this.fy.filter(y, t) };
  }
  reset() { this.fx.reset(); this.fy.reset(); }
  getSpeed() { return Math.hypot(this.fx.getSpeed(), this.fy.getSpeed()); }
}

// ─── Catmull-Rom spline stroke renderer ────────────────────────────────────────
class StrokeRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.points = [];
    this.maxHistory = 6;
  }

  addPoint(x, y, color, size, opacity = 1) {
    this.points.push({ x, y, color, size, opacity });
    if (this.points.length > this.maxHistory) this.points.shift();
    this._render();
  }

  _catmullRomPoint(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  }

  _render() {
    const pts = this.points;
    if (pts.length < 2) return;
    const ctx = this.ctx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = pts[pts.length - 1].opacity;

    if (pts.length === 2) {
      ctx.strokeStyle = pts[1].color;
      ctx.lineWidth = pts[1].size;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    const last = pts[pts.length - 1];
    ctx.strokeStyle = last.color;
    ctx.lineWidth = last.size;

    // Use Catmull-Rom for smooth curves
    const n = pts.length;
    const p0 = pts[Math.max(0, n - 4)];
    const p1 = pts[Math.max(0, n - 3)];
    const p2 = pts[n - 2];
    const p3 = pts[n - 1];

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const pt = this._catmullRomPoint(p0, p1, p2, p3, t);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  reset() { this.points = []; }
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// Gradient color palette for rainbow mode
const RAINBOW_COLORS = [
  "#FF6B6B","#FF8E53","#FFD93D","#6BCB77","#4D96FF",
  "#C77DFF","#FF6B9D","#00F5D4","#F72585","#7209B7",
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
  const handStateRef = useRef({});
  const lostFramesRef = useRef(0);
  const drawingBufferCanvasRef = useRef(null);
  const drawingBufferContextRef = useRef(null);
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });
  const colorRef = useRef("#00F5D4");
  const brushSizeRef = useRef(6);
  const showSkeletonRef = useRef(true);
  const pinchOnlyRef = useRef(false);
  const confidenceRef = useRef(0.5);
  const confidenceDebounceRef = useRef(null);
  const rainbowModeRef = useRef(false);
  const rainbowHueRef = useRef(0);

  const [isRunning, setIsRunning] = useState(false);
  const [color, setColor] = useState("#00F5D4");
  const [brushSize, setBrushSize] = useState(6);
  const [isMuted, setIsMuted] = useState(false);
  const [confidence, setConfidence] = useState(0.5);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [pinchOnly, setPinchOnly] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [drawMode, setDrawMode] = useState("HOVER");
  const [fps, setFps] = useState(0);
  const [error, setError] = useState(null);
  const [rainbowMode, setRainbowMode] = useState(false);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { showSkeletonRef.current = showSkeleton; }, [showSkeleton]);
  useEffect(() => { pinchOnlyRef.current = pinchOnly; }, [pinchOnly]);
  useEffect(() => { rainbowModeRef.current = rainbowMode; }, [rainbowMode]);

  useEffect(() => {
    confidenceRef.current = confidence;
    if (confidenceDebounceRef.current) clearTimeout(confidenceDebounceRef.current);
    confidenceDebounceRef.current = setTimeout(() => {
      if (handsRef.current) {
        handsRef.current.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: confidence,
          minTrackingConfidence: confidence,
        });
      }
    }, 400);
  }, [confidence]);

  const dist2D = (p1, p2, W, H) => Math.hypot((p1.x - p2.x) * W, (p1.y - p2.y) * H);

  // ─── Fixed: proper mirroring + full canvas coverage ─────────────────────────
  // Camera: x=0 is left, x=1 is right
  // Mirrored display: x=0 (camera left) → x=W (display right)
  //                   x=1 (camera right) → x=0 (display left)
  // So mirrored display x = (1 - lm.x) * W  ✓
  // BUT we must NOT clamp aggressively — allow slight overshoot and let canvas clip it
  const lmToDisplay = (lm, W, H) => ({
    x: (1 - lm.x) * W,
    y: lm.y * H,
  });

  const onHandsResults = useCallback((results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = contextRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayContextRef.current;
    if (!canvas || !video || !ctx || !overlayCanvas || !overlayCtx) return;
    if (video.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = video.currentTime;

    fpsCounterRef.current.frames++;
    const now = Date.now();
    if (now - fpsCounterRef.current.lastTime >= 1000) {
      setFps(fpsCounterRef.current.frames);
      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastTime = now;
    }

    const W = canvas.width;
    const H = canvas.height;

    // Draw mirrored video
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -W, 0, W, H);
    ctx.restore();

    overlayCtx.clearRect(0, 0, W, H);
    if (drawingBufferCanvasRef.current) {
      overlayCtx.drawImage(drawingBufferCanvasRef.current, 0, 0);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      lostFramesRef.current = 0;
      setHandsDetected(results.multiHandLandmarks.length);

      const activeHandKeys = new Set();
      let anyDrawing = false;

      results.multiHandLandmarks.forEach((landmarks, index) => {
        const handedness = results.multiHandedness?.[index];
        const rawLabel = handedness?.label ?? handedness?.classification?.[0]?.label ?? `hand`;
        // Mirror handedness label too (camera mirror flips Left↔Right)
        const handLabel = rawLabel === "Left" ? "Right" : rawLabel === "Right" ? "Left" : rawLabel;
        const handKey = `${handLabel}-${index}`;
        activeHandKeys.add(handKey);

        if (!handStateRef.current[handKey]) {
          handStateRef.current[handKey] = {
            filter: new Point2DFilter(),
            renderer: null,
            pinchFrames: 0,
            releaseFrames: 0,
            isPinching: false,
            indexExtFrames: 0,
            isIndexExtended: false,
            wasDrawing: false,
            _lastX: null,
            _lastY: null,
            colorIndex: Math.floor(Math.random() * RAINBOW_COLORS.length),
          };
        }
        const state = handStateRef.current[handKey];
        if (!state.renderer && drawingBufferContextRef.current) {
          state.renderer = new StrokeRenderer(drawingBufferContextRef.current);
        }

        // ── Skeleton rendering ────────────────────────────────────────────────
        if (showSkeletonRef.current) {
          // Draw connections with gradient color
          HAND_CONNECTIONS.forEach(([s, e]) => {
            const p1 = lmToDisplay(landmarks[s], W, H);
            const p2 = lmToDisplay(landmarks[e], W, H);
            overlayCtx.strokeStyle = "rgba(0,245,212,0.6)";
            overlayCtx.lineWidth = 1.5;
            overlayCtx.beginPath();
            overlayCtx.moveTo(p1.x, p1.y);
            overlayCtx.lineTo(p2.x, p2.y);
            overlayCtx.stroke();
          });
          // Finger tip highlights
          [4, 8, 12, 16, 20].forEach((tipIdx) => {
            const p = lmToDisplay(landmarks[tipIdx], W, H);
            overlayCtx.fillStyle = "rgba(255,255,255,0.9)";
            overlayCtx.beginPath();
            overlayCtx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            overlayCtx.fill();
          });
          // Other joints
          landmarks.forEach((lm, i) => {
            if ([4,8,12,16,20].includes(i)) return;
            const p = lmToDisplay(lm, W, H);
            overlayCtx.fillStyle = "rgba(0,245,212,0.85)";
            overlayCtx.beginPath();
            overlayCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            overlayCtx.fill();
          });
        }

        // ── Key landmarks ─────────────────────────────────────────────────────
        const indexTip = landmarks[8];
        const indexPip = landmarks[6]; // PIP joint (better than MID for curl detection)
        const indexMcp = landmarks[5];
        const thumbTip = landmarks[4];
        const thumbIp  = landmarks[3];
        const wrist    = landmarks[0];
        const midMcp   = landmarks[9];

        // Convert index fingertip to display coords (FIXED: no aggressive clamping)
        const rawX = (1 - indexTip.x) * W;
        const rawY = indexTip.y * H;

        // One Euro Filter for ultra-smooth, low-latency tracking
        const t = now;
        const { x: fingerX, y: fingerY } = state.filter.filter(rawX, rawY, t);

        // ── Palm scale (normalized distance for threshold adaptation) ─────────
        const palmScale = Math.max(40, dist2D(wrist, midMcp, W, H));

        // ── Pinch detection with adaptive thresholds + hysteresis ────────────
        const pinchDist = dist2D(indexTip, thumbTip, W, H);
        const pinchThreshold  = Math.max(22, palmScale * 0.28);
        const releaseThreshold = pinchThreshold * 1.6;

        if (pinchDist < pinchThreshold) {
          state.pinchFrames = Math.min(state.pinchFrames + 1, 8);
          state.releaseFrames = 0;
        } else if (pinchDist > releaseThreshold) {
          state.releaseFrames = Math.min(state.releaseFrames + 1, 8);
          state.pinchFrames = Math.max(state.pinchFrames - 2, 0);
        }
        if (!state.isPinching && state.pinchFrames >= 2) state.isPinching = true;
        if (state.isPinching && state.releaseFrames >= 3) {
          state.isPinching = false;
          state.pinchFrames = 0;
          state.releaseFrames = 0;
        }

        // ── Index extension detection ─────────────────────────────────────────
        // Extended = tip higher than PIP and MCP (finger pointing up)
        const tipHigherThanPip = indexTip.y < indexPip.y - 0.025;
        const pipHigherThanMcp = indexPip.y < indexMcp.y - 0.01;
        const indexExtended = tipHigherThanPip && pipHigherThanMcp;

        if (indexExtended) state.indexExtFrames = Math.min(state.indexExtFrames + 1, 8);
        else               state.indexExtFrames = Math.max(state.indexExtFrames - 2, 0);
        state.isIndexExtended = state.indexExtFrames >= 2;

        const isDrawing = pinchOnlyRef.current
          ? state.isPinching
          : (state.isPinching || state.isIndexExtended);

        if (isDrawing) anyDrawing = true;

        // ── Cursor visualization ──────────────────────────────────────────────
        const speed = state.filter.getSpeed();
        const cursorColor = state.isPinching ? "#FF6B9D" : state.isIndexExtended ? "#00F5D4" : "#FFD93D";
        const cursorSize = state.isPinching ? 10 : 14;

        // Outer glow
        const grad = overlayCtx.createRadialGradient(fingerX, fingerY, 0, fingerX, fingerY, cursorSize * 2.5);
        grad.addColorStop(0, cursorColor + "60");
        grad.addColorStop(1, "transparent");
        overlayCtx.fillStyle = grad;
        overlayCtx.beginPath();
        overlayCtx.arc(fingerX, fingerY, cursorSize * 2.5, 0, Math.PI * 2);
        overlayCtx.fill();

        // Inner ring
        overlayCtx.strokeStyle = cursorColor;
        overlayCtx.lineWidth = isDrawing ? 3 : 2;
        overlayCtx.beginPath();
        overlayCtx.arc(fingerX, fingerY, cursorSize, 0, Math.PI * 2);
        overlayCtx.stroke();

        // Center dot when drawing
        if (isDrawing) {
          overlayCtx.fillStyle = cursorColor;
          overlayCtx.beginPath();
          overlayCtx.arc(fingerX, fingerY, 4, 0, Math.PI * 2);
          overlayCtx.fill();
        }

        // ── Color selection ───────────────────────────────────────────────────
        let drawColor;
        if (rainbowModeRef.current) {
          rainbowHueRef.current = (rainbowHueRef.current + 1.5) % 360;
          drawColor = `hsl(${rainbowHueRef.current},100%,60%)`;
        } else {
          drawColor = colorRef.current;
        }

        // ── Draw stroke ───────────────────────────────────────────────────────
        if (isDrawing && state.renderer) {
          const lastX = state._lastX;
          const lastY = state._lastY;
          // Teleport detection: if finger jumped > 1.5x palm width, reset stroke
          if (lastX !== null) {
            const jump = Math.hypot(fingerX - lastX, fingerY - lastY);
            if (jump > palmScale * 1.5 && state.wasDrawing) {
              state.renderer.reset();
            }
          }
          // Pressure simulation: size varies with speed (faster = thinner)
          const speedFactor = Math.max(0.6, 1 - Math.min(speed, 20) / 40);
          const dynamicSize = brushSizeRef.current * speedFactor;
          state.renderer.addPoint(fingerX, fingerY, drawColor, dynamicSize, 0.92);
        } else {
          if (state.wasDrawing && state.renderer) state.renderer.reset();
        }

        state._lastX = fingerX;
        state._lastY = fingerY;
        state.wasDrawing = isDrawing;

        // ── Hand label badge ─────────────────────────────────────────────────
        const wristDisplay = lmToDisplay(wrist, W, H);
        overlayCtx.fillStyle = "rgba(0,0,0,0.6)";
        overlayCtx.beginPath();
        overlayCtx.roundRect(wristDisplay.x - 25, wristDisplay.y + 10, 50, 20, 4);
        overlayCtx.fill();
        overlayCtx.fillStyle = cursorColor;
        overlayCtx.font = "bold 11px monospace";
        overlayCtx.textAlign = "center";
        overlayCtx.fillText(handLabel.toUpperCase(), wristDisplay.x, wristDisplay.y + 24);
        overlayCtx.textAlign = "left";
      });

      // Clean up stale hands
      Object.keys(handStateRef.current).forEach((key) => {
        if (!activeHandKeys.has(key)) {
          handStateRef.current[key].filter.reset();
          if (handStateRef.current[key].renderer) handStateRef.current[key].renderer.reset();
          delete handStateRef.current[key];
        }
      });

      setDrawMode(anyDrawing ? "DRAW" : "HOVER");
    } else {
      lostFramesRef.current++;
      if (lostFramesRef.current > 8) {
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
            s.async = true; s.onload = resolve; s.onerror = () => reject(new Error("Failed to load drawing_utils"));
            document.head.appendChild(s);
          }),
          new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js";
            s.async = true; s.onload = resolve; s.onerror = () => reject(new Error("Failed to load hands"));
            document.head.appendChild(s);
          }),
        ]);

        await new Promise((r) => setTimeout(r, 300));
        if (!window.Hands) throw new Error("MediaPipe Hands not available");

        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,    // Higher = better accuracy
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        hands.onResults(onHandsResults);
        handsRef.current = hands;
        setInitialized(true);
      } catch (err) {
        setError(`Init failed: ${err.message}`);
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
      if (!initialized || !handsRef.current) { setError("MediaPipe not ready. Please wait..."); return; }
      if (isRunningRef.current) return;
      setError(null);
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user", frameRate: { ideal: 60 } },
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
      if (!canvas || !overlayCanvas) throw new Error("Canvas not found");

      const W = video.videoWidth || 1280;
      const H = video.videoHeight || 720;
      canvas.width = W; canvas.height = H;
      overlayCanvas.width = W; overlayCanvas.height = H;

      const buf = document.createElement("canvas");
      buf.width = W; buf.height = H;
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
        if (!processingFrameRef.current) {
          processingFrameRef.current = true;
          try {
            await handsRef.current.send({ image: videoRef.current });
          } catch (e) {
            console.warn("Frame error:", e);
          } finally {
            processingFrameRef.current = false;
          }
        }
        animationIdRef.current = requestAnimationFrame(processFrame);
      };
      processFrame();
      setIsRunning(true);
    } catch (err) {
      const msgs = {
        NotAllowedError: "Camera permission denied. Please allow camera access.",
        NotFoundError: "No camera found. Connect a webcam and retry.",
        NotReadableError: "Camera is busy. Close other camera apps and retry.",
      };
      setError(msgs[err.name] || `Camera error: ${err.message}`);
      isRunningRef.current = false;
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    }
  };

  const stopCamera = () => {
    isRunningRef.current = false;
    if (animationIdRef.current) { cancelAnimationFrame(animationIdRef.current); animationIdRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRunning(false); setHandsDetected(0); setDrawMode("HOVER"); setFps(0);
    handStateRef.current = {}; lostFramesRef.current = 0;
  };

  const clearDrawing = () => {
    const buf = drawingBufferCanvasRef.current;
    const bufCtx = drawingBufferContextRef.current;
    const overlay = overlayCanvasRef.current;
    const overlayCtx = overlayContextRef.current;
    if (bufCtx && buf) bufCtx.clearRect(0, 0, buf.width, buf.height);
    if (overlayCtx && overlay) overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    Object.values(handStateRef.current).forEach((s) => { if (s.renderer) s.renderer.reset(); });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const buf = drawingBufferCanvasRef.current;
    if (!canvas) return;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tmpCtx = tmp.getContext("2d");
    tmpCtx.drawImage(canvas, 0, 0);
    if (buf) tmpCtx.drawImage(buf, 0, 0);
    const link = document.createElement("a");
    link.href = tmp.toDataURL("image/png");
    link.download = `gesture-art-${Date.now()}.png`;
    link.click();
  };

  const PALETTE = ["#FF6B6B","#FF8E53","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF6B9D","#00F5D4","#FFFFFF","#F72585"];

  return (
    <div style={{
      padding: "24px",
      background: "linear-gradient(135deg, #080812 0%, #0f0f1e 50%, #0a1628 100%)",
      minHeight: "100vh",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: "#e0e0ff",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <h2 style={{
          fontSize: "2rem", fontWeight: 800, margin: 0,
          background: "linear-gradient(90deg, #00F5D4, #C77DFF, #FF6B9D)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: "-1px",
        }}>
          ✋ Gesture Canvas
        </h2>
        <p style={{ color: "#7070a0", marginTop: 8, fontSize: "0.9rem" }}>
          Point index finger to draw • Pinch for precision • Rainbow mode for fun
        </p>
      </div>

      {error && (
        <div style={{
          background: "rgba(255,80,80,0.15)", border: "1px solid #ff5050",
          color: "#ff9090", padding: "12px 16px", borderRadius: 8,
          marginBottom: 20, fontSize: "0.9rem",
        }}>{error}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, maxWidth: 1800, margin: "0 auto" }}>
        {/* Canvas */}
        <div>
          <div style={{
            position: "relative", width: "100%", aspectRatio: "16/9",
            background: "#000", borderRadius: 16, overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(0,245,212,0.3), 0 20px 60px rgba(0,0,0,0.8), 0 0 80px rgba(0,245,212,0.08)",
          }}>
            <video ref={videoRef} style={{ display: "none" }} autoPlay playsInline muted />
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }} />
            <canvas ref={overlayCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, cursor: "crosshair" }} />

            {!isRunning && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5,
                backdropFilter: "blur(8px)",
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "4rem", marginBottom: 12 }}>🎨</div>
                  <h3 style={{ margin: "0 0 8px", fontSize: "1.4rem", color: "#00F5D4" }}>
                    {!initialized ? "⏳ Loading AI Model..." : "Ready to Draw"}
                  </h3>
                  <p style={{ color: "#6060a0", margin: 0 }}>
                    {!initialized ? "Downloading MediaPipe Hands..." : "Press START to begin"}
                  </p>
                </div>
              </div>
            )}

            {isRunning && (
              <div style={{
                position: "absolute", top: 12, right: 12, zIndex: 10,
                background: "rgba(255,0,80,0.9)", color: "#fff",
                padding: "6px 12px", borderRadius: 20, fontSize: "0.8rem",
                fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "pulse 1s infinite" }} />
                LIVE • {fps} FPS
              </div>
            )}

            {/* Mode indicator */}
            {isRunning && (
              <div style={{
                position: "absolute", bottom: 12, left: 12, zIndex: 10,
                background: drawMode === "DRAW" ? "rgba(0,245,212,0.2)" : "rgba(255,215,0,0.15)",
                border: `1px solid ${drawMode === "DRAW" ? "#00F5D4" : "#FFD93D"}`,
                color: drawMode === "DRAW" ? "#00F5D4" : "#FFD93D",
                padding: "5px 12px", borderRadius: 6, fontSize: "0.8rem", fontWeight: 700,
              }}>
                {drawMode === "DRAW" ? "✏️ DRAWING" : "👆 HOVER"}
              </div>
            )}

            {isRunning && handsDetected > 0 && (
              <div style={{
                position: "absolute", bottom: 12, right: 12, zIndex: 10,
                background: "rgba(199,125,255,0.2)", border: "1px solid #C77DFF",
                color: "#C77DFF", padding: "5px 12px", borderRadius: 6,
                fontSize: "0.8rem", fontWeight: 700,
              }}>
                🖐 {handsDetected} {handsDetected === 1 ? "Hand" : "Hands"}
              </div>
            )}
          </div>

          {/* Gesture guide */}
          <div style={{
            marginTop: 12, padding: "12px 16px",
            background: "rgba(0,245,212,0.05)", border: "1px solid rgba(0,245,212,0.15)",
            borderRadius: 10, display: "flex", gap: 24, flexWrap: "wrap",
            fontSize: "0.82rem", color: "#8080b0",
          }}>
            <span>☝️ <strong style={{ color: "#00F5D4" }}>Index up</strong> = Draw</span>
            <span>🤏 <strong style={{ color: "#FF6B9D" }}>Pinch</strong> = Precision</span>
            <span>✊ <strong style={{ color: "#FFD93D" }}>Fist/flat</strong> = Pause</span>
            <span>🎨 Works on <strong style={{ color: "#C77DFF" }}>full screen</strong> including edges</span>
          </div>
        </div>

        {/* Control Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Camera controls */}
          <Section title="📷 Camera">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Btn onClick={startCamera} disabled={!initialized || isRunning} color="#00F5D4">
                <Play size={16} /> START
              </Btn>
              <Btn onClick={stopCamera} disabled={!isRunning} color="#FF6B9D">
                <Square size={16} /> STOP
              </Btn>
            </div>
          </Section>

          {/* Color palette */}
          <Section title="🎨 Color">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {PALETTE.map((c) => (
                <button key={c} onClick={() => { setColor(c); setRainbowMode(false); }}
                  style={{
                    width: 32, height: 32, borderRadius: "50%", background: c, border: "none",
                    cursor: "pointer", outline: color === c && !rainbowMode ? `3px solid #fff` : "none",
                    outlineOffset: 2, transition: "transform 0.15s", transform: color === c && !rainbowMode ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setRainbowMode(false); }}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0, background: "none" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "0.85rem", color: "#a0a0c0" }}>🌈 Rainbow Mode</label>
              <Toggle active={rainbowMode} onClick={() => setRainbowMode(!rainbowMode)} />
            </div>
          </Section>

          {/* Brush */}
          <Section title="✏️ Brush">
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#a0a0c0", marginBottom: 8 }}>
                <span>Size</span><span style={{ color: "#fff", fontWeight: 700 }}>{brushSize}px</span>
              </div>
              <input type="range" min="1" max="60" value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "#00F5D4" }} />
            </div>
            {/* Brush preview */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{
                width: Math.max(8, Math.min(brushSize, 60)),
                height: Math.max(8, Math.min(brushSize, 60)),
                borderRadius: "50%",
                background: rainbowMode ? "linear-gradient(135deg,#FF6B6B,#FFD93D,#00F5D4,#C77DFF)" : color,
                transition: "all 0.2s",
              }} />
            </div>
          </Section>

          {/* Settings */}
          <Section title="⚙️ Detection">
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#a0a0c0", marginBottom: 6 }}>
                <span>Sensitivity</span><span style={{ color: "#fff", fontWeight: 700 }}>{Math.round(confidence * 100)}%</span>
              </div>
              <input type="range" min="0.3" max="0.85" step="0.05" value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#C77DFF" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "🦴 Skeleton", state: showSkeleton, set: setShowSkeleton },
                { label: "🤏 Pinch Only", state: pinchOnly, set: setPinchOnly },
                { label: isMuted ? "🔇 Sound" : "🔊 Sound", state: !isMuted, set: (v) => setIsMuted(!v) },
              ].map(({ label, state, set }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "#a0a0c0" }}>{label}</span>
                  <Toggle active={state} onClick={() => set(!state)} />
                </div>
              ))}
            </div>
          </Section>

          {/* Actions */}
          <Section title="💾 Actions">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Btn onClick={clearDrawing} disabled={!isRunning} color="#FFD93D">
                <Trash2 size={16} /> CLEAR
              </Btn>
              <Btn onClick={downloadImage} disabled={!isRunning} color="#6BCB77">
                <Download size={16} /> SAVE
              </Btn>
            </div>
          </Section>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        input[type=range]{-webkit-appearance:none;height:5px;border-radius:3px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4)}
        @media(max-width:900px){
          .gesture-grid{grid-template-columns:1fr!important}
        }
      `}</style>
    </div>
  );
};

// ─── Helper Components ─────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <div style={{
    background: "rgba(20,20,40,0.9)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12, padding: 18,
  }}>
    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6060a0", letterSpacing: "1px", marginBottom: 14, textTransform: "uppercase" }}>
      {title}
    </div>
    {children}
  </div>
);

const Btn = ({ onClick, disabled, color, children }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      padding: "10px 14px", border: `1px solid ${disabled ? "#333" : color}`,
      borderRadius: 8, background: disabled ? "rgba(50,50,70,0.5)" : `${color}18`,
      color: disabled ? "#505070" : color, cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 700, fontSize: "0.85rem", fontFamily: "inherit",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      transition: "all 0.2s",
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}30`; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = `${color}18`; }}
  >
    {children}
  </button>
);

const Toggle = ({ active, onClick }) => (
  <button onClick={onClick}
    style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
      background: active ? "#00F5D4" : "rgba(80,80,120,0.5)",
      position: "relative", transition: "background 0.3s",
    }}
  >
    <span style={{
      position: "absolute", top: 3, left: active ? 23 : 3,
      width: 18, height: 18, borderRadius: "50%", background: "#fff",
      transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
    }} />
  </button>
);

export default HandGestureCanvas;