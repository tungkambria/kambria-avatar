import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Container,
  Row,
  Col,
  Button,
  Form,
  FormControl,
} from "react-bootstrap";
import { saveAs } from "file-saver";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpload,
  faUndo,
  faSyncAlt,
  faDownload,
  faMousePointer,
  faMobileAlt,
  faBorderAll,
  faSearchPlus, // New import for zoom in
  faSearchMinus, // New import for zoom out
  faRotateLeft,
  faRotateRight, // Alias for rotate left
} from "@fortawesome/free-solid-svg-icons";
import { LanguageContext } from "../context/LanguageContext";

const presetFrames = [
  { name: "Circle 0", url: "/frames/circle-0.png" },
  { name: "Circle 1", url: "/frames/circle-1.png" },
  { name: "Circle 2", url: "/frames/circle-2.png" },
  { name: "Circle 3", url: "/frames/circle-3.png" },
  { name: "Circle 4", url: "/frames/circle-4.png" },
  { name: "Circle 5", url: "/frames/circle-5.png" },
];

const ProfilePictureBuilder = () => {
  const { language, setLanguage, t } = useContext(LanguageContext);

  const [sourceImage, setSourceImage] = useState(null);
  const [frameImage, setFrameImage] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState("None");
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // New state for rotation (degrees)
  const [history, setHistory] = useState([]);
  const canvasRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const pinchDistance = useRef(null);
  const [zoomValue, setZoomValue] = useState(100); // Zoom slider percentage

  const CANVAS_SIZE = 400;
  const MAX_OFFSET = 100;
  const MIN_SCALE = 0.2;
  const MAX_SCALE = 5;
  const MAX_IMAGE_SIZE = 1024;

  // Sync zoom slider with scale changes
  useEffect(() => {
    setZoomValue((scale * 100).toFixed(0));
  }, [scale]);

  const saveToHistory = () => {
    setHistory((prev) => [
      ...prev.slice(-9),
      { scale, position: { ...position }, rotation }, // Include rotation in history
    ]);
  };

  const preprocessImage = (file, callback) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
        const ratio = Math.min(MAX_IMAGE_SIZE / width, MAX_IMAGE_SIZE / height);
        width = width * ratio;
        height = height * ratio;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        const resizedUrl = URL.createObjectURL(blob);
        URL.revokeObjectURL(url);
        callback(resizedUrl);
      }, "image/png");
    };
  };

  const handleSourceUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      preprocessImage(file, (url) => {
        setSourceImage(url);
        setScale(1);
        setZoomValue(100);
        setPosition({ x: 0, y: 0 });
        setRotation(0); // Reset rotation
        setHistory([]);
      });
    }
  };

  const handleFrameUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      preprocessImage(file, (url) => {
        setFrameImage(url);
        setSelectedPreset("None");
      });
    }
  };

  const handlePresetSelect = (presetName) => {
    setSelectedPreset(presetName);
    const preset = presetFrames.find((frame) => frame.name === presetName);
    setFrameImage(preset.url);
  };

  const handleZoomChange = (e) => {
    const newZoom = Number(e.target.value);
    setZoomValue(newZoom);
    const newScale = newZoom / 100;
    saveToHistory();
    setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale)));
  };

  // New handler for rotation slider
  const handleRotationChange = (e) => {
    const newRotation = Number(e.target.value);
    saveToHistory();
    setRotation(newRotation);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawImages = async () => {
      if (sourceImage) {
        const img = new Image();
        img.src = sourceImage;
        await img.decode();
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        ctx.save(); // Save context state
        // Translate to canvas center, rotate, then translate back
        ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
        ctx.rotate((rotation * Math.PI) / 180); // Convert degrees to radians
        ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);
        // Draw image with position offset
        ctx.drawImage(
          img,
          position.x + (CANVAS_SIZE - scaledWidth) / 2,
          position.y + (CANVAS_SIZE - scaledHeight) / 2,
          scaledWidth,
          scaledHeight
        );
        ctx.restore(); // Restore context state
      }
      if (frameImage) {
        const frame = new Image();
        frame.src = frameImage;
        await frame.decode();
        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      }
    };

    drawImages();
  }, [sourceImage, frameImage, scale, position, rotation]); // Added rotation dependency

  const handleMouseDown = (e) => {
    if (!sourceImage) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    saveToHistory();
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current || !sourceImage) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    setPosition({
      x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newX)),
      y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newY)),
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e) => {
    if (!sourceImage) return;
    e.preventDefault();
    saveToHistory();
    const touches = e.touches;
    if (touches.length === 1) {
      isDragging.current = true;
      dragStart.current = {
        x: touches[0].clientX - position.x,
        y: touches[0].clientY - position.y,
      };
    } else if (touches.length === 2) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      pinchDistance.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e) => {
    if (!sourceImage) return;
    e.preventDefault();
    const touches = e.touches;
    if (touches.length === 1 && isDragging.current) {
      const newX = touches[0].clientX - dragStart.current.x;
      const newY = touches[0].clientY - dragStart.current.y;
      setPosition({
        x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newX)),
        y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newY)),
      });
    } else if (touches.length === 2) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      if (pinchDistance.current) {
        const scaleChange = newDistance / pinchDistance.current;
        let newScale = scale * scaleChange;
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

        const pinchCenterX = (touches[0].clientX + touches[1].clientX) / 2;
        const pinchCenterY = (touches[0].clientY + touches[1].clientY) / 2;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const canvasX = pinchCenterX - canvasRect.left - CANVAS_SIZE / 2;
        const canvasY = pinchCenterY - canvasRect.top - CANVAS_SIZE / 2;

        const newPositionX =
          position.x + (canvasX / scale - canvasX / newScale);
        const newPositionY =
          position.y + (canvasY / scale - canvasY / newScale);

        setScale(newScale);
        setPosition({
          x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newPositionX)),
          y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newPositionY)),
        });
      }
      pinchDistance.current = newDistance;
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    isDragging.current = false;
    pinchDistance.current = null;
  };

  const handleWheel = (e) => {
    if (!sourceImage) return;
    e.preventDefault();
    saveToHistory();
    const zoomSpeed = 0.001;
    const delta = e.deltaY;
    let newScale = scale - delta * zoomSpeed;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    setScale(newScale);
  };

  const handleKeyDown = (e) => {
    if (!sourceImage) return;
    const step = 5;
    const zoomStep = 0.05;
    let newPosition = { ...position };
    let newScale = scale;

    switch (e.key) {
      case "ArrowUp":
        newPosition.y = Math.max(-MAX_OFFSET, position.y - step);
        saveToHistory();
        break;
      case "ArrowDown":
        newPosition.y = Math.min(MAX_OFFSET, position.y + step);
        saveToHistory();
        break;
      case "ArrowLeft":
        newPosition.x = Math.max(-MAX_OFFSET, position.x - step);
        saveToHistory();
        break;
      case "ArrowRight":
        newPosition.x = Math.min(MAX_OFFSET, position.x + step);
        saveToHistory();
        break;
      case "+":
      case "=":
        newScale = Math.min(MAX_SCALE, scale + zoomStep);
        saveToHistory();
        break;
      case "-":
        newScale = Math.max(MIN_SCALE, scale - zoomStep);
        saveToHistory();
        break;
      default:
        return;
    }

    if (e.key.startsWith("Arrow")) {
      setPosition(newPosition);
    } else if (["+", "=", "-"].includes(e.key)) {
      setScale(newScale);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }); // Dependencies unchanged

  const handleReset = () => {
    saveToHistory();
    setScale(1);
    setZoomValue(100);
    setPosition({ x: 0, y: 0 });
    setRotation(0); // Reset rotation
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setScale(lastState.scale);
    setPosition({ ...lastState.position });
    setRotation(lastState.rotation); // Restore rotation
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      saveAs(blob, "fb-profile-picture.png");
    });
  };

  const handleZoomIn = () => {
    if (!sourceImage) return;
    saveToHistory();
    const newScale = Math.min(MAX_SCALE, scale + 0.1);
    setScale(newScale);
  };

  const handleZoomOut = () => {
    if (!sourceImage) return;
    saveToHistory();
    const newScale = Math.max(MIN_SCALE, scale - 0.1);
    setScale(newScale);
  };

  const handleRotateLeft = () => {
    if (!sourceImage) return;
    saveToHistory();
    setRotation((prev) => (prev - 15 + 360) % 360);
  };

  const handleRotateRight = () => {
    if (!sourceImage) return;
    saveToHistory();
    setRotation((prev) => (prev + 15) % 360);
  };

  return (
    <Container className="my-5">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center">{t("title")}</h1>
        </Col>
        <Col xs="auto">
          <Form.Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </Form.Select>
        </Col>
      </Row>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>
              <FontAwesomeIcon icon={faUpload} className="me-2" />
              {t("uploadProfile")}
            </Form.Label>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={handleSourceUpload}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>
              <FontAwesomeIcon icon={faBorderAll} className="me-2" />
              {t("selectFrame")}
            </Form.Label>
            <Row>
              {presetFrames.map((frame) => (
                <Col xs={4} key={frame.name} className="mb-2">
                  <div
                    className={`preset-frame ${
                      selectedPreset === frame.name ? "selected" : ""
                    }`}
                    onClick={() => handlePresetSelect(frame.name)}
                    style={{ cursor: "pointer", textAlign: "center" }}
                  >
                    {frame.url ? (
                      <img
                        src={frame.url}
                        alt={frame.name}
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          border:
                            selectedPreset === frame.name
                              ? "2px solid #007bff"
                              : "none",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100px",
                          height: "100px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#f0f0f0",
                          border:
                            selectedPreset === frame.name
                              ? "2px solid #007bff"
                              : "1px solid #ccc",
                        }}
                      >
                        {frame.name}
                      </div>
                    )}
                  </div>
                </Col>
              ))}
            </Row>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>
              <FontAwesomeIcon icon={faUpload} className="me-2" />
              {t("uploadFrame")}
            </Form.Label>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={handleFrameUpload}
            />
          </Form.Group>
          <div className="mb-3">
            <p>
              <strong>{t("instructions")}</strong>
            </p>
            <ul>
              <li>
                <FontAwesomeIcon icon={faMousePointer} className="me-2" />
                {t("desktopInstructions")}
              </li>
              <li>
                <FontAwesomeIcon icon={faMobileAlt} className="me-2" />
                {t("mobileInstructions")}
              </li>
            </ul>
          </div>
        </Col>
        <Col md={6} className="text-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="canvas-preview"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              cursor: sourceImage ? "move" : "default",
              touchAction: "none",
            }}
          ></canvas>
          <div className="mt-2">
            <Form.Group className="mb-2">
              <Form.Label>{t("zoom")}</Form.Label>
              <div className="d-flex align-items-center">
                <Button
                  variant="link"
                  onClick={handleZoomOut}
                  disabled={!sourceImage}
                  className="p-1"
                >
                  <FontAwesomeIcon icon={faSearchMinus} />
                </Button>
                <FormControl
                  type="range"
                  min={MIN_SCALE * 100}
                  max={MAX_SCALE * 100}
                  value={zoomValue}
                  onChange={handleZoomChange}
                  disabled={!sourceImage}
                  style={{ flex: 1, margin: "0 10px", touchAction: "none" }}
                />
                <Button
                  variant="link"
                  onClick={handleZoomIn}
                  disabled={!sourceImage}
                  className="p-1"
                >
                  <FontAwesomeIcon icon={faSearchPlus} />
                </Button>
              </div>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>{t("rotation")}</Form.Label>
              <div className="d-flex align-items-center">
                <Button
                  variant="link"
                  onClick={handleRotateLeft}
                  disabled={!sourceImage}
                  className="p-1"
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                </Button>
                <FormControl
                  type="range"
                  min={-180}
                  max={180}
                  value={rotation}
                  onChange={handleRotationChange}
                  disabled={!sourceImage}
                  style={{ flex: 1, margin: "0 10px", touchAction: "none" }}
                />
                <Button
                  variant="link"
                  onClick={handleRotateRight}
                  disabled={!sourceImage}
                  className="p-1"
                >
                  <FontAwesomeIcon icon={faRotateRight} />
                </Button>
              </div>
            </Form.Group>
            <small>
              {t("scale")}: {scale.toFixed(2)} | {t("position")}: (
              {position.x.toFixed(0)}, {position.y.toFixed(0)}) |{" "}
              {t("rotation")}: {rotation.toFixed(0)}°
            </small>
          </div>
        </Col>
      </Row>
      <Row className="text-center mt-5 mb-3">
        <Col className="d-flex justify-content-center gap-1">
          <Button
            variant="secondary"
            onClick={handleReset}
            className="me-2"
            disabled={!sourceImage}
          >
            <FontAwesomeIcon icon={faSyncAlt} className="me-2" />
            {t("reset")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleUndo}
            className="me-2"
            disabled={history.length === 0}
          >
            <FontAwesomeIcon icon={faUndo} className="me-2" />
            {t("undo")}
          </Button>
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={!sourceImage}
          >
            <FontAwesomeIcon icon={faDownload} className="me-2" />
            {t("download")}
          </Button>
        </Col>
      </Row>
    </Container>
  );
};

export default ProfilePictureBuilder;
